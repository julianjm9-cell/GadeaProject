from io import BytesIO
import json
from collections import Counter
from pathlib import Path
import pytest
from pypdf import PdfReader
from sqlalchemy import select
from test_access_control import client, seed_user, login
from app.models import License
from app.api import app_routes
from app.services.teacher_temario import RESOURCES, topic_catalog, render_topic_pdf
from app.services.teacher_generator import TYPES, parse_material
from app.services.teacher_question_quality import arithmetic


def test_math_notation_is_preserved_in_pdf():
    for symbol in "√∫Σθ²³×":
        topic = next(topic for topic in topic_catalog().values() if symbol in " ".join(topic["didactic"]["examples"]))
        pages = PdfReader(BytesIO(render_topic_pdf(topic, "examples"))).pages
        text = " ".join(page.extract_text() for page in pages)
        if symbol in "√²³":
            assert any(len(page.images) for page in pages), (topic["id"], symbol)
        else:
            assert symbol in text, (topic["id"], symbol)


def test_revised_prepared_materials_are_usable_and_topic_specific():
    catalog = topic_catalog()
    numeric, timelines, gaps = [], [], []
    for topic in catalog.values():
        content = topic['didactic']
        assert content['editorialRevision'] == '2026-10-06', topic['id']
        assert content['prior'] and content['evidence'], topic['id']
        assert len(content['examples']) >= 2 and len(set(content['examples'])) == len(content['examples'])
        assert '**' in content['examples'][1] and 'Solución explicada:' in content['examples'][1]
        material = content['preparedMaterial']
        assert material['revision'] == content['editorialRevision']
        counts = Counter(q['type'] for q in material['questions'])
        clean = parse_material(json.dumps({'questions': material['questions']}), {kind: counts[kind] for kind in TYPES})
        assert len(clean) == 6, topic['id']
        assert all(q.get('explanation') or q.get('rubric') for q in clean), topic['id']
        assert len(set(q['prompt'] for q in clean)) == 6, topic['id']
        assert set(content['activities']) == set(counts), topic['id']
        for question in clean:
            if question['type'] == 'numeric':
                assert arithmetic(question['calculation']) == pytest.approx(float(question['answer']))
                assert question['tolerance'] == 0
                numeric.append(topic['id'])
            if question['type'] == 'timeline':
                assert topic['subject'] == 'Geografía e Historia'
                assert all(any(char.isdigit() for char in event) for event in question['options'])
                timelines.append(topic['id'])
            if question['type'] == 'gaps' and topic['subject'] == 'Inglés':
                assert question['prompt'].count('___') == 1
                gaps.append(topic['id'])
    assert len(numeric) == 18
    assert len(timelines) == 6
    assert len(gaps) == 10


def test_all_topics_have_printable_resources():
    catalog = topic_catalog()
    assert len(catalog) == 351
    for topic in catalog.values():
        material = topic["didactic"]["preparedMaterial"]
        assert material["duration"] == 20
        assert len(material["questions"]) == 6
        # Choose types for their teaching purpose; don't add a generic puzzle just for variety.
        assert len({question["type"] for question in material["questions"]}) >= 4
        assert all(question["prompt"].strip() and question["answer"].strip() for question in material["questions"])
        for resource in RESOURCES:
            pdf = render_topic_pdf(topic, resource)
            pages = PdfReader(BytesIO(pdf)).pages
            assert 1 <= len(pages) <= 3, (topic["id"], resource)
            text = " ".join(page.extract_text() for page in pages)
            assert topic["title"] in " ".join(pages[0].extract_text().split())
            assert "\u25a0" not in text, (topic["id"], resource)
            if resource == "scheme":
                assert all(heading in text for heading in ("Para entenderlo", "Cuándo usarlo", "Recorrido de aprendizaje", "Un ejemplo")), topic["id"]


def test_topic_pdf_plan_is_checked_from_license(client):
    web, factory = client
    seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    assert login(web).status_code == 200
    topic = next(iter(topic_catalog().values()))
    url = "/api/profesor/temario/export-pdf?app=profesor_particular"
    payload = {"topic_id": topic["id"], "resource": "scheme"}
    response = web.post(url, json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
    web.post("/api/state?app=profesor_particular", json={"teacherProfile": {"plan": "premium"}})
    for resource in ("practice", "examples"):
        payload["resource"] = resource
        assert web.post(url, json=payload).status_code == 403
    with factory() as db:
        license_obj = db.scalar(select(License).where(License.product_code == "PROFESOR_PARTICULAR"))
        license_obj.plan = "PROFESOR_PREMIUM"
        db.commit()
    for resource in ("practice", "examples"):
        payload["resource"] = resource
        assert web.post(url, json=payload).status_code == 200
    assert web.post(url, json={"topic_id": "missing", "resource": "scheme"}).status_code == 404
    for resource in ("unknown", [], {}):
        assert web.post(url, json={"topic_id": topic["id"], "resource": resource}).status_code == 422
    with factory() as db:
        license_obj = db.scalar(select(License).where(License.product_code == "PROFESOR_PARTICULAR"))
        license_obj.plan = "PROFESOR_FREE"
        db.commit()
    assert web.post(url, json=payload).status_code == 403


def test_deployed_profesor_assets_are_routed(client, monkeypatch, tmp_path):
    web, _ = client
    filenames = ["temario-presentation.js", "profesor-rich-text.js", "profesor-temario.js", "profesor-temario-depth.js", "profesor-temario-revision.js", "profesor-spanish.js", "profesor-activity-play.js",
                 "profesor-final.css", "profesor-home.css", "profesor-studio.css", "profesor-temario.css",
                 "profesor-activity-play.css"]
    # Simulate Docker: only static copies exist, not the repository's apps directory.
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    root = Path(__file__).resolve().parents[2] / "apps" / "profesor"
    for name in filenames:
        source = root / ("assets" if name.endswith(".css") else "") / name
        (static / "assets" / name).write_bytes(source.read_bytes())
    monkeypatch.setattr(app_routes, "PROJECT_ROOT", tmp_path / "missing")
    monkeypatch.setattr(app_routes, "STATIC_DIR", static)
    for name in filenames:
        prefix = "/assets/" if name.endswith(".css") else "/"
        response = web.get(prefix + name)
        assert response.status_code == 200, name
        assert response.headers["content-type"].startswith("text/")
        assert response.content
