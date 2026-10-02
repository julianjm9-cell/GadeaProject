from io import BytesIO
from pathlib import Path
import pytest
from pypdf import PdfReader
from sqlalchemy import select
from test_access_control import client, seed_user, login
from app.models import License
from app.api import app_routes
from app.services.teacher_temario import RESOURCES, topic_catalog, render_topic_pdf


def test_all_topics_have_printable_resources():
    catalog = topic_catalog()
    assert len(catalog) == 279
    for topic in catalog.values():
        material = topic["didactic"]["preparedMaterial"]
        assert material["duration"] == 20
        assert len(material["questions"]) == 6
        assert len({question["type"] for question in material["questions"]}) >= 5
        assert all(question["prompt"].strip() and question["answer"].strip() for question in material["questions"])
        for resource in RESOURCES:
            pdf = render_topic_pdf(topic, resource)
            pages = PdfReader(BytesIO(pdf)).pages
            assert 1 <= len(pages) <= 3, (topic["id"], resource)
            assert topic["title"] in pages[0].extract_text()
            assert "\u25a0" not in " ".join(page.extract_text() for page in pages), (topic["id"], resource)


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
    filenames = ["profesor-temario.js", "profesor-temario-depth.js", "profesor-activity-play.js",
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
