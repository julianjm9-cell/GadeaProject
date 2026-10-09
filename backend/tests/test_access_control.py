from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.session import Base, get_db
from app.api import app_routes, auth as auth_api
from app.api.app_routes import add_points_focus_instruction, points_credit_cost_from_content, record_usage
from app.api.auth import LOGIN_BUCKET, ensure_google_access
from app.main import app
from app.models import AppSetting, License, Organization, UsageRecord, User
from app.security.passwords import hash_password
from app.services.ai_config import GROQ_CHAT_DEFAULT, GROQ_TRANSCRIBE_DEFAULT
from app.services.licenses import check_access, license_for_user


@pytest.fixture()
def client():
    LOGIN_BUCKET.clear()
    engine = create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    def override_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client, TestingSessionLocal
    app.dependency_overrides.clear()


def seed_user(db_factory, *, org_status="active", user_active=True, license_status="active", expires_delta_days=30, role="user", email="cliente@example.com", product_codes=("DIPLOMATOR",), ocr_access_role="user"):
    with db_factory() as db:
        org = Organization(name=f"Org {email}", status=org_status)
        db.add(org)
        db.flush()
        user = User(
            organization_id=org.id,
            email=email,
            password_hash=hash_password("temporal123"),
            full_name="Cliente",
            role=role,
            is_active=user_active,
        )
        db.add(user)
        db.flush()
        now = datetime.now(timezone.utc)
        for product_code in product_codes:
            prefix = {"PROFESOR_PARTICULAR": "PROFE", "CAMBRIDGE": "CAMB", "UNIVERSIDAD_ADULTOS": "U25", "ESO_ADULTOS": "E25"}.get(product_code, "DIPLO")
            db.add(
                License(
                    organization_id=org.id,
                    user_id=user.id,
                    product_code=product_code,
                    plan="MVP",
                    access_role=ocr_access_role if product_code == "OCR_FACTURAS" else "user",
                    status=license_status,
                    starts_at=now - timedelta(days=1),
                    expires_at=now + timedelta(days=expires_delta_days),
                    usage_limit=300,
                    legacy_key=f"{prefix}-{email}",
                )
            )
        db.commit()
        return str(org.id), str(user.id)


def login(test_client: TestClient, email="cliente@example.com", password="temporal123"):
    return test_client.post("/auth/login", json={"email": email, "password": password})


def test_profesor_product_login_and_state_isolation(client):
    test_client, db_factory = client
    seed_user(db_factory, product_codes=("PROFESOR_PARTICULAR", "ESO_ADULTOS"))
    assert login(test_client).status_code == 200
    products = test_client.get("/api/apps").json()["apps"]
    product = next(p for p in products if p["code"] == "PROFESOR_PARTICULAR")
    assert product["available"] is True
    assert product["path"] == "/profesor-particular"
    assert test_client.get(product["path"]).status_code == 200
    teacher_data = {"version": 1, "students": [{"id": "student-a", "name": "Alumno A"}], "uploadedTopics": [{"id": "tema-propio", "title": "Mi unidad", "course": "3.º ESO", "subject": "Matemáticas", "uploadedDocuments": True, "documents": [{"id": "archivo-a", "filename": "apuntes.pdf", "size": 1024}]}]}
    assert test_client.post("/api/state?app=profesor_particular", json=teacher_data).status_code == 200
    assert test_client.post("/api/state?app=eso_adultos", json={"done": {"topic": True}}).status_code == 200
    assert test_client.get("/api/state?app=profesor-particular").json() == {**teacher_data, "teacherProfile": {"plan": "normal"}}
    assert test_client.get("/api/state?app=eso_adultos").json() == {"done": {"topic": True}}
    seed_user(db_factory, email="profesor2@example.com", product_codes=("PROFESOR_PARTICULAR",))
    assert login(test_client, email="profesor2@example.com").status_code == 200
    assert test_client.get("/api/state?app=profesor_particular").json() == {"teacherProfile": {"plan": "normal"}}


def test_profesor_requires_its_own_license(client):
    test_client, db_factory = client
    seed_user(db_factory, product_codes=("ESO_ADULTOS",))
    assert login(test_client).status_code == 200
    assert test_client.get("/api/state?app=profesor_particular").status_code == 402
    assert test_client.post("/api/state?app=profesor_particular", json={"students": []}).status_code == 402


def test_profesor_plan_is_controlled_by_server_license(client):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin", email="admin@example.com")
    _, teacher_id = seed_user(db_factory, email="teacher@example.com", product_codes=("PROFESOR_PARTICULAR",))
    admin_token = login(test_client, email="admin@example.com").json()["access_token"]
    teacher_token = login(test_client, email="teacher@example.com").json()["access_token"]
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    state_url = "/api/state?app=profesor_particular"
    access_url = f"/admin/users/{teacher_id}/access/PROFESOR_PARTICULAR"

    assert test_client.post(state_url, headers=teacher_headers, json={"version": 2, "teacherProfile": {"plan": "premium", "headline": "Docente"}}).status_code == 200
    assert test_client.get(state_url, headers=teacher_headers).json()["teacherProfile"] == {"plan": "normal", "headline": "Docente"}
    assert test_client.get("/api/profesor/images/search?q=gato&app=profesor_particular", headers=teacher_headers).status_code == 403
    assert test_client.patch(access_url, headers=teacher_headers, json={"usage_limit": 300, "plan": "PROFESOR_PREMIUM"}).status_code == 403

    upgraded = test_client.patch(access_url, headers=admin_headers, json={"usage_limit": 300, "plan": "PROFESOR_PREMIUM"})
    assert upgraded.status_code == 200
    assert upgraded.json()["access"]["plan"] == "PROFESOR_PREMIUM"
    assert test_client.get(state_url, headers=teacher_headers).json()["teacherProfile"]["plan"] == "premium"
    assert test_client.post(state_url, headers=teacher_headers, json={"version": 2, "teacherProfile": {"plan": "normal"}}).status_code == 200
    assert test_client.get(state_url, headers=teacher_headers).json()["teacherProfile"]["plan"] == "premium"

    downgraded = test_client.patch(access_url, headers=admin_headers, json={"usage_limit": 300, "plan": "PROFESOR_FREE"})
    assert downgraded.status_code == 200
    assert test_client.get(state_url, headers=teacher_headers).json()["teacherProfile"]["plan"] == "normal"


def test_profesor_login_redirect_is_preserved(client):
    test_client, _ = client
    response = test_client.get("/profesor-particular", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/login?next=/profesor-particular"
    assert auth_api.clean_next_path("/profesor-particular") == "/profesor-particular"


def test_profesor_public_routes_and_landing_links(client):
    test_client, _ = client
    landing = test_client.get("/profesor")
    assert landing.status_code == 200
    assert '/profesor/register' in landing.text
    assert '/assets/landing/profesor-dashboard.png' in landing.text
    assert '<link rel="canonical" href="https://educame.tech/profesor">' in landing.text
    assert 'href="/profesor"' in test_client.get("/").text
    assert test_client.get("/profesor-info", follow_redirects=False).headers["location"] == "/profesor"
    sitemap = test_client.get("/sitemap.xml")
    assert sitemap.status_code == 200
    assert sitemap.headers["content-type"].startswith("application/xml")
    assert "https://educame.tech/profesor" in sitemap.text
    assert "https://educame.tech/sitemap.xml" in test_client.get("/robots.txt").text
    assert test_client.get("/profesor/login").status_code == 200
    assert test_client.get("/profesor/demo").status_code == 200


def test_profesor_registration_and_admin_access_management(client):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin", email="admin@example.com")
    admin_token = login(test_client, email="admin@example.com").json()["access_token"]
    payload = {"email": "teacher@example.com", "full_name": "Laura Profesora", "password": "segura12345"}
    response = test_client.post("/auth/profesor/register", json=payload)
    assert response.status_code == 201
    teacher_id = response.json()["user"]["id"]
    assert test_client.get("/api/state?app=profesor_particular").status_code == 200
    assert test_client.get("/api/state?app=eso_adultos").status_code == 402
    assert test_client.post("/auth/profesor/register", json=payload).status_code == 409
    headers = {"Authorization": f"Bearer {admin_token}"}
    accounts = test_client.get("/admin/accounts", headers=headers).json()["accounts"]
    teacher = next(a for a in accounts if a["id"] == teacher_id)
    assert [a["product_code"] for a in teacher["accesses"]] == ["PROFESOR_PARTICULAR"]
    assert teacher["accesses"][0]["plan"] == "PROFESOR_PREMIUM"
    assert test_client.get("/api/state?app=profesor_particular").json()["teacherProfile"]["plan"] == "premium"
    result = test_client.patch(f"/admin/users/{teacher_id}/access/PROFESOR_PARTICULAR", headers=headers, json={"status": "suspended", "usage_limit": 100})
    assert result.status_code == 200
    assert test_client.get("/api/state?app=profesor_particular").status_code == 402
    assert test_client.post("/auth/login", json={"identifier": payload["email"], "password": payload["password"], "enroll_profesor": True}).status_code == 402


def test_profesor_enrollment_does_not_replenish_credits(client):
    test_client, db_factory = client
    _, user_id = seed_user(db_factory, product_codes=("ESO_ADULTOS",))
    credentials = {"identifier": "cliente@example.com", "password": "temporal123", "enroll_profesor": True}
    assert test_client.post("/auth/login", json=credentials).status_code == 200
    with db_factory() as db:
        user = db.get(User, UUID(user_id))
        license_obj = license_for_user(db, user, "PROFESOR_PARTICULAR")
        assert license_obj.plan == "PROFESOR_PREMIUM"
        license_obj.usage_limit = 7
        original_id = license_obj.id
        db.commit()
    assert test_client.post("/auth/login", json=credentials).status_code == 200
    with db_factory() as db:
        license_obj = license_for_user(db, db.get(User, UUID(user_id)), "PROFESOR_PARTICULAR")
        assert license_obj.id == original_id
        assert license_obj.usage_limit == 7


def test_profesor_signup_can_be_disabled(client, monkeypatch):
    test_client, db_factory = client
    monkeypatch.setattr(auth_api.get_settings(), "profesor_signup_enabled", False)
    payload = {"email": "teacher@example.com", "full_name": "Laura", "password": "segura12345"}
    assert test_client.get("/auth/profesor/signup-settings").json()["enabled"] is False
    assert test_client.post("/auth/profesor/register", json=payload).status_code == 403
    seed_user(db_factory, product_codes=("ESO_ADULTOS",))
    test_client.post("/auth/login", json={"identifier": "cliente@example.com", "password": "temporal123", "enroll_profesor": True})
    assert test_client.get("/api/state?app=profesor_particular").status_code == 402


def test_deployment_smoke_check_routes(client, monkeypatch):
    from io import BytesIO
    from pathlib import Path
    from urllib.error import HTTPError
    from app import deployment_check

    test_client, db_factory = client

    def open_local(url, timeout=20):
        if url == "http://admin/":
            return BytesIO((Path(__file__).parents[2] / "admin" / "index.html").read_bytes())
        response = test_client.get(url.replace("http://127.0.0.1:8000", ""))
        if response.status_code >= 400:
            raise HTTPError(url, response.status_code, "HTTP error", None, None)
        result = BytesIO(response.content)
        result.status = response.status_code
        result.url = str(response.url)
        return result

    monkeypatch.setattr(deployment_check, "urlopen", open_local)
    monkeypatch.setattr(deployment_check, "engine", db_factory.kw["bind"])
    deployment_check.check_deployment()


def test_profesor_material_files_are_private_and_persistent(client, monkeypatch, tmp_path):
    import base64
    test_client, db_factory = client
    monkeypatch.setattr(app_routes, "LOCAL_DOCUMENT_DIR", tmp_path)
    seed_user(db_factory, product_codes=("PROFESOR_PARTICULAR", "ESO_ADULTOS"))
    login(test_client)
    payload = {"filename": "apuntes.txt", "base64": base64.b64encode(b"Practicar ecuaciones").decode()}
    upload = test_client.post("/api/profesor/materials?app=profesor_particular", json=payload)
    assert upload.status_code == 200
    url = f'/api/profesor/materials/{upload.json()["id"]}?app=profesor_particular'
    download = test_client.get(url)
    assert download.status_code == 200
    assert download.content == b"Practicar ecuaciones"
    assert "attachment" in download.headers["content-disposition"]
    assert download.headers["x-content-type-options"] == "nosniff"
    assert test_client.post("/api/profesor/materials?app=eso_adultos", json=payload).status_code == 403
    seed_user(db_factory, email="otro-profesor@example.com", product_codes=("PROFESOR_PARTICULAR",))
    login(test_client, email="otro-profesor@example.com")
    assert test_client.get(url).status_code == 404
    assert test_client.get(url.replace("profesor_particular", "eso_adultos")).status_code == 402


def test_profesor_rejects_invalid_materials(client, monkeypatch, tmp_path):
    test_client, db_factory = client
    monkeypatch.setattr(app_routes, "LOCAL_DOCUMENT_DIR", tmp_path)
    seed_user(db_factory, product_codes=("PROFESOR_PARTICULAR",))
    login(test_client)
    for payload, code in [({"filename": "script.html", "base64": "YQ=="}, 422), ({"filename": "foto.png", "base64": "bad!"}, 422), ({"filename": "texto.txt", "base64": ""}, 413), ({"filename": "texto.txt", "base64": "A" * 11_184_813}, 413)]:
        assert test_client.post("/api/profesor/materials?app=profesor_particular", json=payload).status_code == code
    assert not list(tmp_path.rglob("*"))


def test_profesor_visual_material_preview_and_pdf_are_private(client, monkeypatch, tmp_path):
    import base64
    from io import BytesIO
    from PIL import Image
    from pypdf import PdfReader

    test_client, db_factory = client
    monkeypatch.setattr(app_routes, "LOCAL_DOCUMENT_DIR", tmp_path)
    seed_user(db_factory, product_codes=("PROFESOR_PARTICULAR",))
    login(test_client)
    image_file = BytesIO()
    Image.new("RGB", (32, 20), "#2567dd").save(image_file, format="PNG")
    uploaded = test_client.post("/api/profesor/materials?app=profesor_particular", json={
        "filename": "dibujo.png", "base64": base64.b64encode(image_file.getvalue()).decode(),
    })
    assert uploaded.status_code == 200
    image_id = uploaded.json()["id"]
    preview = test_client.get(f"/api/profesor/materials/{image_id}/preview?app=profesor_particular")
    assert preview.status_code == 200
    assert preview.headers["content-type"].startswith("image/png")
    assert "attachment" not in preview.headers.get("content-disposition", "")
    material = {"title": "Los animales", "subject": "Ciencias", "activity": {
        "context": {"course": "4.º Primaria"}, "questions": [
            {"type": "visualquiz", "prompt": "¿Qué animal aparece?", "answer": "Gato",
             "options": ["Gato", "Perro"], "image": {"id": image_id, "filename": "dibujo.png"}},
            {"type": "imagepoint", "prompt": "Señala la cabeza", "answer": "Zona marcada",
             "target": {"x": 50, "y": 40}, "image": {"id": image_id, "filename": "dibujo.png"}},
        ]}}
    for version in ("worksheet", "solutions"):
        response = test_client.post("/api/profesor/export-pdf?app=profesor_particular", json={"material": material, "version": version})
        assert response.status_code == 200, response.text
        assert response.content.startswith(b"%PDF")
        text = " ".join(page.extract_text() for page in PdfReader(BytesIO(response.content)).pages)
        assert "Los animales" in text and "Señala la cabeza" in text
        assert ("Solución:" in text) is (version == "solutions")
    seed_user(db_factory, email="otro-profesor@example.com", product_codes=("PROFESOR_PARTICULAR",))
    login(test_client, email="otro-profesor@example.com")
    assert test_client.get(f"/api/profesor/materials/{image_id}/preview?app=profesor_particular").status_code == 404
    assert test_client.post("/api/profesor/export-pdf?app=profesor_particular", json={"material": material, "version": "worksheet"}).status_code == 404


def test_profesor_uploaded_document_previews(client, monkeypatch, tmp_path):
    import base64
    from io import BytesIO
    from zipfile import ZipFile
    from reportlab.pdfgen.canvas import Canvas

    web, db_factory = client
    monkeypatch.setattr(app_routes, "LOCAL_DOCUMENT_DIR", tmp_path)
    seed_user(db_factory, product_codes=("PROFESOR_PARTICULAR",))
    login(web)
    pdf = BytesIO()
    canvas = Canvas(pdf)
    canvas.drawString(30, 700, "Mi material")
    canvas.save()
    word = BytesIO()
    with ZipFile(word, "w") as archive:
        archive.writestr("word/document.xml", '''<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Título &amp; contenido</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>&lt;script&gt;alert(1)&lt;/script&gt;</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>''')
    from openpyxl import Workbook
    workbook = Workbook()
    workbook.active.title = "Práctica"
    workbook.active.append(["Pregunta", "Respuesta"])
    workbook.active.append(["2 + 2", 4])
    spreadsheet = BytesIO()
    workbook.save(spreadsheet)
    slides = BytesIO()
    with ZipFile(slides, "w") as archive:
        archive.writestr("ppt/slides/slide1.xml", '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Diapositiva de prueba</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>')
    odt = BytesIO()
    with ZipFile(odt, "w") as archive:
        archive.writestr("content.xml", '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text><text:p>Mis apuntes</text:p></office:text></office:body></office:document-content>')
    ids = []
    samples = [("clase.pdf", pdf.getvalue(), "application/pdf"), ("notas.txt", "Español: explicación <script>".encode(), "text/plain"), ("tema.docx", word.getvalue(), "application/json"), ("tabla.xlsx", spreadsheet.getvalue(), "application/json"), ("presentacion.pptx", slides.getvalue(), "application/json"), ("apuntes.odt", odt.getvalue(), "application/json"), ("texto.rtf", b"{\\rtf1 Apuntes de clase}", "application/json"), ("resumen.md", b"# Resumen", "text/plain"), ("ejercicios.csv", b"pregunta,respuesta\n2+2,4", "text/plain")]
    for name, raw, mime in samples:
        uploaded = web.post("/api/profesor/materials?app=profesor_particular", json={"filename": name, "base64": base64.b64encode(raw).decode()})
        assert uploaded.status_code == 200
        document_id = uploaded.json()["id"]
        ids.append(document_id)
        preview = web.get(f"/api/profesor/materials/{document_id}/preview?app=profesor_particular")
        assert preview.status_code == 200, preview.text
        assert preview.headers["content-type"].startswith(mime)
        assert "attachment" not in preview.headers.get("content-disposition", "")
        assert preview.headers["cache-control"] == "private, no-store"
        if name.endswith(".docx"):
            blocks = preview.json()["blocks"]
            assert blocks[0]["heading"] == 1 and blocks[0]["runs"][0]["bold"]
            assert blocks[1]["type"] == "table"
            assert blocks[1]["rows"][0][0][0]["runs"][0]["text"] == "<script>alert(1)</script>"
        if name.endswith((".xlsx", ".pptx", ".odt", ".rtf")):
            assert preview.json()["blocks"]
        assert web.get(f"/api/profesor/materials/{document_id}?app=profesor_particular").content == raw
    broken = web.post("/api/profesor/materials?app=profesor_particular", json={"filename": "roto.docx", "base64": base64.b64encode(b"not a zip").decode()}).json()["id"]
    assert web.get(f"/api/profesor/materials/{broken}/preview?app=profesor_particular").status_code == 422
    seed_user(db_factory, email="documentos-otro@example.com", product_codes=("PROFESOR_PARTICULAR",))
    login(web, email="documentos-otro@example.com")
    for document_id in ids:
        assert web.get(f"/api/profesor/materials/{document_id}/preview?app=profesor_particular").status_code == 404


def test_eso_gamification_reward_is_idempotent(client):
    test_client, db_factory = client
    seed_user(db_factory, product_codes=("ESO_ADULTOS",))
    assert login(test_client).status_code == 200
    headers = {"X-Client-App": "eso_adultos"}

    initial = test_client.get("/api/gamification", headers=headers)
    assert initial.status_code == 200
    assert initial.json()["profile"]["xp"] == 0

    payload = {"event_type": "LESSON_COMPLETED", "source_id": "mat-numeros:lesson:0"}
    first = test_client.post("/api/gamification/rewards", json=payload, headers=headers)
    duplicate = test_client.post("/api/gamification/rewards", json=payload, headers=headers)

    assert first.status_code == 200
    assert first.json()["awarded"] is True
    assert first.json()["profile"]["xp"] == 50
    assert first.json()["profile"]["coins"] == 15
    assert duplicate.status_code == 200
    assert duplicate.json()["duplicate"] is True
    assert duplicate.json()["profile"]["xp"] == 50
    assert duplicate.json()["profile"]["coins"] == 15

    for index in range(1, 5):
        lesson = {"event_type": "LESSON_COMPLETED", "source_id": f"mat-numeros:lesson:{index}"}
        assert test_client.post("/api/gamification/rewards", json=lesson, headers=headers).status_code == 200
    assert test_client.post("/api/gamification/rewards", json={"event_type": "TOPIC_COMPLETED", "source_id": "mat-numeros"}, headers=headers).status_code == 200

    purchase = test_client.post("/api/gamification/purchases", json={"item_id": "lamp_warm"}, headers=headers)
    assert purchase.status_code == 200
    assert purchase.json()["profile"]["coins"] == 15
    equipment = test_client.post("/api/gamification/equipment", json={"item_id": "lamp_warm"}, headers=headers)
    assert equipment.status_code == 200
    assert equipment.json()["profile"]["equipped_items"]["lamp"] == "lamp_warm"


def test_requires_login(client):
    test_client, _ = client
    response = test_client.get("/api/state")
    assert response.status_code == 401


def test_google_login_redirects_back_when_not_configured(client, monkeypatch):
    monkeypatch.setattr(auth_api, "google_enabled", lambda: False)
    test_client, _ = client
    response = test_client.get("/auth/google/login?next=/apps", follow_redirects=False)
    assert response.status_code in {302, 307}
    assert response.headers["location"] == "/login?google_disabled=1&next=/apps"


def test_google_status_reports_disabled_when_not_configured(client, monkeypatch):
    monkeypatch.setattr(auth_api, "google_enabled", lambda: False)
    test_client, _ = client
    response = test_client.get("/auth/google/status")
    assert response.status_code == 200
    assert response.json()["enabled"] is False


def test_google_login_uses_the_site_callback_and_basic_identity_scopes(client, monkeypatch):
    test_client, _ = client
    settings = auth_api.get_settings()
    monkeypatch.setattr(settings, "google_client_id", "test-client-id")
    monkeypatch.setattr(settings, "google_client_secret", "test-client-secret")
    monkeypatch.setattr(settings, "google_redirect_uri", "https://educame.tech/auth/google/callback")
    response = test_client.get("/auth/google/login?next=/profesor-particular", follow_redirects=False)
    params = parse_qs(urlparse(response.headers["location"]).query)
    assert params["redirect_uri"] == ["https://educame.tech/auth/google/callback"]
    assert params["scope"] == ["openid email profile"]
    assert params["state"] == [test_client.cookies.get("diplomator_google_state")]


def register_eso(test_client, email="nuevo@example.com"):
    return test_client.post("/auth/eso/register", json={"email": email, "full_name": "Nueva alumna", "password": "segura12345"})


def test_eso_registration_creates_only_eso_and_appears_in_admin(client):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin", email="admin@example.com")
    admin_token = login(test_client, email="admin@example.com").json()["access_token"]
    response = register_eso(test_client)
    assert response.status_code == 201
    assert response.json()["user"]["role"] == "user"
    assert test_client.get("/api/state", headers={"X-Client-App": "eso_adultos"}).status_code == 200
    assert test_client.get("/api/state", headers={"X-Client-App": "cambridge"}).status_code == 402
    rows = test_client.get("/admin/accounts", headers={"Authorization": f"Bearer {admin_token}"}).json()["accounts"]
    user = next(row for row in rows if row["email"] == "nuevo@example.com")
    assert user["created_at"]
    assert len(user["accesses"]) == 1
    access = user["accesses"][0]
    assert access["plan"] == "ESO_FREE"
    assert access["total_credits"] == 100
    assert access["used_credits"] == 0
    assert access["available_credits"] == 100


def test_existing_account_enrolls_only_after_password_login_and_once(client):
    test_client, db_factory = client
    _, user_id = seed_user(db_factory)
    assert test_client.post("/auth/login", json={"email": "cliente@example.com", "password": "wrong", "enroll_eso": True}).status_code == 401
    payload = {"email": "cliente@example.com", "password": "temporal123", "enroll_eso": True}
    assert test_client.post("/auth/login", json=payload).status_code == 200
    with db_factory() as db:
        lic = license_for_user(db, db.get(User, UUID(user_id)), "ESO_ADULTOS")
        lic.usage_limit = 17
        lic.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()
    # Existing DIP access still permits account login; the ESO grant is not renewed.
    assert test_client.post("/auth/login", json=payload).status_code == 200
    with db_factory() as db:
        licenses = db.query(License).filter(License.user_id == UUID(user_id), License.product_code == "ESO_ADULTOS").all()
        assert len(licenses) == 1
        assert licenses[0].usage_limit == 17
        assert not check_access(db, db.get(User, UUID(user_id)), "ESO_ADULTOS").ok


def test_duplicate_eso_registration_does_not_replace_account(client):
    test_client, db_factory = client
    assert register_eso(test_client).status_code == 201
    assert register_eso(test_client, "NUEVO@example.com").status_code == 409
    with db_factory() as db:
        assert db.query(User).count() == 1
        assert db.query(License).count() == 1


def test_disabled_and_invalid_eso_registration(client, monkeypatch):
    test_client, db_factory = client
    assert test_client.post("/auth/eso/register", json={"email": "bad", "full_name": " ", "password": "short"}).status_code == 422
    monkeypatch.setattr(auth_api.get_settings(), "eso_signup_enabled", False)
    assert register_eso(test_client).status_code == 403
    assert test_client.get("/auth/eso/signup-settings").json()["enabled"] is False
    with db_factory() as db:
        with pytest.raises(HTTPException) as error:
            auth_api.get_or_create_google_user(db, {"email": "closed@example.com", "sub": "closed-sub", "email_verified": True}, ("ESO_ADULTOS",))
        assert error.value.status_code == 403
        assert db.query(User).count() == 0


def test_eso_registration_rate_limit(client):
    test_client, _ = client
    assert register_eso(test_client).status_code == 201
    for _ in range(7):
        assert register_eso(test_client).status_code == 409
    assert register_eso(test_client).status_code == 429


def test_exhausted_eso_credits_allow_study_but_block_all_ai(client):
    test_client, db_factory = client
    assert register_eso(test_client).status_code == 201
    with db_factory() as db:
        user = db.query(User).one()
        lic = license_for_user(db, user, "ESO_ADULTOS")
        lic.usage_limit = 1
        record_usage(db, user, "test", 0, 0, "ESO_ADULTOS")
        db.commit()
    assert login(test_client, "nuevo@example.com", "segura12345").status_code == 200
    headers = {"X-Client-App": "eso_adultos"}
    assert test_client.post("/api/state", json={"lesson": "saved"}, headers=headers).status_code == 200
    assert test_client.get("/api/state", headers=headers).json() == {"lesson": "saved"}
    assert test_client.get("/api/me", headers=headers).json()["user"]["available_credits"] == 0
    assert test_client.get("/api/gamification", headers=headers).status_code == 200
    assert test_client.post("/auth/refresh").status_code == 200
    for path in ("/api/chat", "/api/ocr", "/api/transcribe"):
        response = test_client.post(path, json={}, headers=headers)
        assert response.status_code == 402
        assert "Creditos insuficientes" in response.json()["detail"]


def test_google_eso_signup_is_scoped_and_never_replenishes(client):
    _, db_factory = client
    info = {"email": "google-eso@example.com", "sub": "eso-sub", "name": "Google ESO", "email_verified": True}
    with db_factory() as db:
        user = auth_api.get_or_create_google_user(db, info, ("ESO_ADULTOS",))
        db.commit()
        lic = license_for_user(db, user, "ESO_ADULTOS")
        lic.status = "suspended"
        lic.usage_limit = 5
        db.commit()
        auth_api.get_or_create_google_user(db, info, ("ESO_ADULTOS",))
        db.commit()
        assert db.query(License).count() == 1
        assert lic.usage_limit == 5
        assert lic.status == "suspended"


def test_blocked_account_cannot_receive_free_eso_access(client):
    test_client, db_factory = client
    seed_user(db_factory, user_active=False)
    response = test_client.post("/auth/login", json={"email": "cliente@example.com", "password": "temporal123", "enroll_eso": True})
    assert response.status_code == 402
    with db_factory() as db:
        assert db.query(License).filter(License.product_code == "ESO_ADULTOS").count() == 0


def test_google_callback_grants_only_the_requested_app(client, monkeypatch):
    test_client, db_factory = client
    test_client.cookies.set("diplomator_google_state", "test")
    monkeypatch.setattr(auth_api, "decode_google_state", lambda _: {"purpose": "login", "next": "/eso-adultos"})
    async def exchange(_):
        return {"userinfo": {"email": "google-callback@example.com", "sub": "callback-sub", "name": "Google", "email_verified": True}}
    monkeypatch.setattr(auth_api, "exchange_google_code", exchange)
    response = test_client.get("/auth/google/callback?code=test&state=test", follow_redirects=False)
    assert response.headers["location"] == "/eso-adultos"
    with db_factory() as db:
        assert [lic.product_code for lic in db.query(License).all()] == ["ESO_ADULTOS"]


def test_google_callback_rejects_missing_or_changed_state_before_token_exchange(client, monkeypatch):
    test_client, _ = client

    async def exchange(_):
        raise AssertionError("No se debe intercambiar un código sin el estado del navegador")

    monkeypatch.setattr(auth_api, "exchange_google_code", exchange)
    response = test_client.get("/auth/google/callback?code=test&state=test", follow_redirects=False)
    assert response.headers["location"] == "/login?google_error=state"
    test_client.cookies.set("diplomator_google_state", "different")
    response = test_client.get("/auth/google/callback?code=test&state=test", follow_redirects=False)
    assert response.headers["location"] == "/login?google_error=state"


def test_google_callback_requires_access_to_selected_app(client, monkeypatch):
    test_client, db_factory = client
    seed_user(db_factory, email="google-existing@example.com", product_codes=("ESO_ADULTOS",))
    test_client.cookies.set("diplomator_google_state", "test")
    monkeypatch.setattr(auth_api.get_settings(), "profesor_signup_enabled", False)
    monkeypatch.setattr(auth_api, "decode_google_state", lambda _: {"purpose": "login", "next": "/profesor-particular"})

    async def exchange(_):
        return {"userinfo": {"email": "google-existing@example.com", "sub": "existing-sub", "email_verified": True}}

    monkeypatch.setattr(auth_api, "exchange_google_code", exchange)
    response = test_client.get("/auth/google/callback?code=test&state=test", follow_redirects=False)
    assert response.headers["location"] == "/login?google_error=access&next=%2Fprofesor-particular"
    with db_factory() as db:
        assert {lic.product_code for lic in db.query(License).all()} == {"ESO_ADULTOS"}
        assert db.query(User).filter(User.email == "google-existing@example.com").one().google_sub is None


def test_eso_initial_credit_configuration_is_used(client, monkeypatch):
    test_client, db_factory = client
    monkeypatch.setattr(auth_api.get_settings(), "eso_signup_credits", 25)
    monkeypatch.setattr(auth_api.get_settings(), "eso_signup_days", 30)
    assert test_client.get("/auth/eso/signup-settings").json()["credits"] == 25
    assert register_eso(test_client).status_code == 201
    with db_factory() as db:
        lic = db.query(License).one()
        assert lic.usage_limit == 25
        assert 29 <= (lic.expires_at - datetime.now()).days <= 30


@pytest.mark.parametrize("path", ["/", "/suite", "/u25", "/e25", "/cambridge-info", "/diplomator"])
def test_public_marketing_pages_load_without_login(client, path):
    test_client, _ = client
    response = test_client.get(path)
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_hazlotu_access_is_admin_managed_and_rotation_revokes_cookies(client):
    test_client, db_factory = client
    for path in ("/hazlo-tu", "/hazlatu", "/hazlatu.html"):
        response = test_client.get(path)
        assert response.status_code == 200
        assert "Proyecto privado" not in response.text
        assert "El acceso aún no está configurado" in response.text
    assert test_client.get("/admin/hazlotu-access").status_code == 401
    seed_user(db_factory, role="superadmin", email="admin@example.com")
    token = login(test_client, email="admin@example.com").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert test_client.post("/admin/hazlotu-access", json={"password": "short"}, headers=headers).status_code == 400
    response = test_client.post("/admin/hazlotu-access", json={"password": "hazlotu-privado-2026"}, headers=headers)
    assert response.status_code == 200
    assert response.json() == {"configured": True}
    assert "password" not in test_client.get("/admin/hazlotu-access", headers=headers).text
    with db_factory() as db:
        assert db.get(AppSetting, "hazlotu_access_password_hash").value != "hazlotu-privado-2026"
    assert "Contraseña de acceso" in test_client.get("/hazlo-tu").text
    wrong = test_client.post("/hazlo-tu/unlock", data={"password": "incorrecta"}, follow_redirects=False)
    assert wrong.status_code == 303
    assert "hazlotu_access" not in wrong.cookies
    right = test_client.post("/hazlo-tu/unlock", data={"password": "hazlotu-privado-2026"}, follow_redirects=False)
    assert right.status_code == 303
    assert right.cookies.get("hazlotu_access")
    assert "Tu idea, tu herramienta" in test_client.get("/hazlo-tu").text
    assert test_client.post("/admin/hazlotu-access", json={"password": "nueva-clave-privada"}, headers=headers).status_code == 200
    assert "Contraseña de acceso" in test_client.get("/hazlo-tu").text


@pytest.mark.parametrize("filename", ["room.svg", "items.svg", "room-warm.png", "desk-light.png", "trophy-first.png"])
def test_eso_desk_assets_are_served_for_the_production_page(client, filename):
    test_client, _ = client
    response = test_client.get(f"/assets/desk/{filename}")
    assert response.status_code == 200
    assert ("image/png" if filename.endswith(".png") else "image/svg+xml") in response.headers["content-type"]


def test_hazlotu_logo_is_served_from_packaged_marketing_assets(client, tmp_path, monkeypatch):
    logo = tmp_path / "marketing" / "assets" / "brand" / "hazlotu-logo.png"
    logo.parent.mkdir(parents=True)
    logo.write_bytes(b"transparent-logo")
    monkeypatch.setattr(app_routes, "STATIC_DIR", tmp_path)
    monkeypatch.setattr(app_routes, "PROJECT_ROOT", tmp_path / "missing-project-root")
    test_client, _ = client
    response = test_client.get("/assets/brand/hazlotu-logo.png")
    assert response.status_code == 200
    assert "image/png" in response.headers["content-type"]
    assert response.content == b"transparent-logo"


def test_unknown_eso_desk_asset_is_rejected(client):
    test_client, _ = client
    assert test_client.get("/assets/desk/unknown.svg").status_code == 404


def test_eso_landing_image_is_served_in_the_packaged_app(client, tmp_path, monkeypatch):
    image = tmp_path / "marketing" / "assets" / "landing" / "eso-study-desk.png"
    image.parent.mkdir(parents=True)
    image.write_bytes(b"landing-image")
    monkeypatch.setattr(app_routes, "STATIC_DIR", tmp_path)
    monkeypatch.setattr(app_routes, "PROJECT_ROOT", tmp_path / "missing-project")
    test_client, _ = client
    response = test_client.get("/assets/landing/eso-study-desk.png")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content == b"landing-image"
    assert test_client.get("/assets/landing/unknown.png").status_code == 404


@pytest.mark.parametrize("path", ["/login", "/u25/login", "/e25/login", "/e25/register", "/profesor/login", "/profesor/register", "/cambridge-info/login", "/diplomator/login"])
def test_login_pages_load_without_login(client, path):
    test_client, _ = client
    response = test_client.get(path)
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


@pytest.mark.parametrize(
    ("path", "next_path"),
    [
        ("/apps", "/apps"),
        ("/app", "/app"),
        ("/cambridge", "/cambridge"),
        ("/universidad-adultos", "/universidad-adultos"),
        ("/eso-adultos", "/eso-adultos"),
    ],
)
def test_browser_pages_redirect_to_login_when_not_authenticated(client, path, next_path):
    test_client, _ = client
    response = test_client.get(path, follow_redirects=False)
    assert response.status_code in {302, 307}
    assert response.headers["location"] == f"/login?next={next_path}"


def test_wrong_password_is_rejected(client):
    test_client, db_factory = client
    seed_user(db_factory)
    response = login(test_client, password="bad-password")
    assert response.status_code == 401


@pytest.mark.parametrize(
    ("kwargs", "status_code"),
    [
        ({"user_active": False}, 402),
        ({"org_status": "suspended"}, 402),
        ({"license_status": "suspended"}, 402),
        ({"expires_delta_days": -1}, 402),
    ],
)
def test_blocked_access_states(client, kwargs, status_code):
    test_client, db_factory = client
    seed_user(db_factory, **kwargs)
    response = login(test_client)
    assert response.status_code == status_code


def test_active_license_allows_login_and_state_is_user_scoped(client):
    test_client, db_factory = client
    seed_user(db_factory)
    first = login(test_client)
    assert first.status_code == 200
    token_one = first.json()["access_token"]
    assert test_client.post("/api/state", json={"history": ["one"]}, headers={"Authorization": f"Bearer {token_one}"}).status_code == 200

    seed_user(db_factory, email="otro@example.com")
    second = login(test_client, email="otro@example.com")
    token_two = second.json()["access_token"]
    state_two = test_client.get("/api/state", headers={"Authorization": f"Bearer {token_two}"}).json()
    assert state_two == {}
    state_one = test_client.get("/api/state", headers={"Authorization": f"Bearer {token_one}"}).json()
    assert state_one == {"history": ["one"]}


def test_apps_selector_lists_available_products(client):
    test_client, db_factory = client
    seed_user(db_factory, product_codes=("DIPLOMATOR", "CAMBRIDGE", "UNIVERSIDAD_ADULTOS", "ESO_ADULTOS"))
    token = login(test_client).json()["access_token"]
    response = test_client.get("/api/apps", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    apps = {item["code"]: item for item in response.json()["apps"]}
    assert apps["DIPLOMATOR"]["available"] is True
    assert apps["CAMBRIDGE"]["available"] is True
    assert apps["UNIVERSIDAD_ADULTOS"]["available"] is True
    assert apps["ESO_ADULTOS"]["available"] is True


def test_app_state_is_separate_by_product(client):
    test_client, db_factory = client
    seed_user(db_factory, product_codes=("DIPLOMATOR", "CAMBRIDGE", "UNIVERSIDAD_ADULTOS", "ESO_ADULTOS"))
    token = login(test_client).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert test_client.post("/api/state", json={"app": "diplomator"}, headers=headers).status_code == 200
    assert test_client.post("/api/state", json={"app": "cambridge"}, headers={**headers, "X-Client-App": "cambridge"}).status_code == 200
    assert test_client.post("/api/state", json={"app": "universidad"}, headers={**headers, "X-Client-App": "universidad_adultos"}).status_code == 200
    assert test_client.post("/api/state", json={"app": "eso"}, headers={**headers, "X-Client-App": "eso_adultos"}).status_code == 200
    assert test_client.get("/api/state", headers=headers).json() == {"app": "diplomator"}
    assert test_client.get("/api/state", headers={**headers, "X-Client-App": "cambridge"}).json() == {"app": "cambridge"}
    assert test_client.get("/api/state", headers={**headers, "X-Client-App": "universidad_adultos"}).json() == {"app": "universidad"}
    assert test_client.get("/api/state", headers={**headers, "X-Client-App": "eso_adultos"}).json() == {"app": "eso"}


def test_google_signup_excludes_manually_licensed_diplomator(client):
    _, db_factory = client
    with db_factory() as db:
        org = Organization(name="Google Org", status="active")
        db.add(org)
        db.flush()
        user = User(
            organization_id=org.id,
            email="google@example.com",
            password_hash=hash_password("unused-password"),
            full_name="Google User",
            role="user",
            is_active=True,
            google_sub="google-sub",
        )
        db.add(user)
        db.flush()
        ensure_google_access(db, user)
        db.commit()
        codes = {license_obj.product_code for license_obj in db.query(License).filter(License.organization_id == org.id).all()}
    assert {"CAMBRIDGE", "UNIVERSIDAD_ADULTOS", "ESO_ADULTOS"} <= codes
    assert "DIPLOMATOR" not in codes


def test_regular_user_cannot_access_admin(client):
    test_client, db_factory = client
    seed_user(db_factory)
    token = login(test_client).json()["access_token"]
    response = test_client.get("/admin/organizations", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


def test_superadmin_can_access_admin(client):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin")
    token = login(test_client).json()["access_token"]
    response = test_client.get("/admin/organizations", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_admin_can_delete_user_and_private_documents(client, monkeypatch, tmp_path):
    test_client, db_factory = client
    _, admin_id = seed_user(db_factory, role="superadmin", email="admin-delete@example.com")
    org_id, user_id = seed_user(db_factory, email="delete@example.com")
    monkeypatch.setattr(app_routes, "LOCAL_DOCUMENT_DIR", tmp_path)
    user_dir = tmp_path / org_id / user_id / "profesor_materials"
    user_dir.mkdir(parents=True)
    document_path = user_dir / "material.txt"
    document_path.write_text("material privado", encoding="utf-8")
    with db_factory() as db:
        from app.models import Document
        db.add(Document(organization_id=UUID(org_id), user_id=UUID(user_id), filename="material.txt", storage_path=str(document_path)))
        db.commit()
    token = login(test_client, email="admin-delete@example.com").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert test_client.delete(f"/admin/users/{admin_id}", headers=headers).status_code == 403
    response = test_client.delete(f"/admin/users/{user_id}", headers=headers)
    assert response.status_code == 200
    assert not user_dir.exists()
    with db_factory() as db:
        assert db.get(User, UUID(user_id)) is None
        assert db.query(License).filter_by(user_id=UUID(user_id)).count() == 0
        assert db.query(Document).filter_by(user_id=UUID(user_id)).count() == 0


def test_credit_limit_is_scoped_to_each_user(client):
    _, db_factory = client
    with db_factory() as db:
        org = Organization(name="Cuenta compartida", status="active")
        db.add(org)
        db.flush()
        first = User(organization_id=org.id, email="first@example.com", password_hash=hash_password("temporal123"), full_name="First", role="user", is_active=True)
        second = User(organization_id=org.id, email="second@example.com", password_hash=hash_password("temporal123"), full_name="Second", role="user", is_active=True)
        db.add_all([first, second])
        db.flush()
        now = datetime.now(timezone.utc)
        shared = License(organization_id=org.id, product_code="DIPLOMATOR", status="active", starts_at=now - timedelta(days=1), expires_at=now + timedelta(days=30), usage_limit=1, legacy_key="DIPLO-SHARED")
        db.add(shared)
        db.add(UsageRecord(organization_id=org.id, user_id=first.id, product_code="DIPLOMATOR", model="test", input_tokens=1, output_tokens=1, estimated_cost=0))
        db.commit()
        assert check_access(db, first).ok is False
        assert check_access(db, second).ok is True


def test_admin_accounts_reports_exact_balances_and_creates_personal_override(client):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin", email="admin@example.com")
    token = login(test_client, email="admin@example.com").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    with db_factory() as db:
        org = Organization(name="Clientes", status="active")
        db.add(org)
        db.flush()
        first = User(organization_id=org.id, email="uno@example.com", password_hash=hash_password("temporal123"), full_name="Uno", role="user", is_active=True)
        second = User(organization_id=org.id, email="dos@example.com", password_hash=hash_password("temporal123"), full_name="Dos", role="user", is_active=True)
        db.add_all([first, second])
        db.flush()
        first_id, second_id = str(first.id), str(second.id)
        now = datetime.now(timezone.utc)
        db.add(License(organization_id=org.id, product_code="DIPLOMATOR", status="active", starts_at=now - timedelta(days=1), expires_at=now + timedelta(days=30), usage_limit=10, legacy_key="DIPLO-CLIENTS"))
        for _ in range(3):
            db.add(UsageRecord(organization_id=org.id, user_id=first.id, product_code="DIPLOMATOR", model="test", input_tokens=1, output_tokens=1, estimated_cost=0))
        db.add(UsageRecord(organization_id=org.id, user_id=second.id, product_code="DIPLOMATOR", model="test", input_tokens=1, output_tokens=1, estimated_cost=0))
        db.commit()

    response = test_client.get("/admin/accounts", headers=headers)
    assert response.status_code == 200
    accounts = {row["id"]: row for row in response.json()["accounts"]}
    first_access = accounts[first_id]["accesses"][0]
    second_access = accounts[second_id]["accesses"][0]
    assert (first_access["total_credits"], first_access["used_credits"], first_access["available_credits"]) == (10, 3, 7)
    assert (second_access["total_credits"], second_access["used_credits"], second_access["available_credits"]) == (10, 1, 9)

    patched = test_client.patch(f"/admin/users/{first_id}/access/DIPLOMATOR", headers=headers, json={"usage_limit": 20})
    assert patched.status_code == 200
    assert patched.json()["access"]["scope"] == "personal"
    assert patched.json()["access"]["available_credits"] == 17
    with db_factory() as db:
        first = db.get(User, UUID(first_id))
        second = db.get(User, UUID(second_id))
        assert license_for_user(db, first).usage_limit == 20
        assert license_for_user(db, second).usage_limit == 10


def test_ai_settings_default_to_current_groq_models(client):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin")
    token = login(test_client).json()["access_token"]
    response = test_client.get("/admin/ai-settings", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["chat_provider"] == "groq"
    assert data["points_model"] == GROQ_CHAT_DEFAULT
    assert data["chat_model"] == GROQ_CHAT_DEFAULT
    assert data["transcribe_model"] == GROQ_TRANSCRIBE_DEFAULT
    capabilities = {item["id"]: item for item in data["capabilities"]}
    assert capabilities["points"]["provider"] == data["points_provider"]
    assert capabilities["points"]["model"] == data["points_model"]
    assert capabilities["chat"]["provider"] == data["chat_provider"]
    assert capabilities["transcribe"]["model"] == data["transcribe_model"]
    assert {"points", "chat", "ocr", "transcribe"} == set(capabilities)


def test_ai_settings_reports_the_ocr_fallback_model_actually_used(client):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin")
    with db_factory() as db:
        db.add(AppSetting(key="chat_provider", value="groq"))
        db.add(AppSetting(key="chat_model", value="openai/gpt-oss-120b"))
        db.add(AppSetting(key="openai_api_key", value="sk-test-key"))
        db.commit()
    token = login(test_client).json()["access_token"]
    response = test_client.get("/admin/ai-settings", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    ocr = next(item for item in response.json()["capabilities"] if item["id"] == "ocr")
    assert ocr["provider"] == "openai"
    assert ocr["model"] == "gpt-4o-mini"


def test_point_generation_records_one_credit_per_point(client):
    _, db_factory = client
    _, user_id = seed_user(db_factory)
    with db_factory() as db:
        user = db.get(User, UUID(user_id))
        record_usage(db, user, "test-model", 10, 20, "DIPLOMATOR", credit_cost=5)
        db.commit()
        rows = db.query(UsageRecord).filter(UsageRecord.user_id == user.id).all()
    assert len(rows) == 5
    assert sum(row.input_tokens for row in rows) == 10
    assert sum(row.output_tokens for row in rows) == 20


def test_point_generation_charges_actual_returned_points():
    content = '{"points":[{"title":"A","text":"..."},{"title":"B","text":"..."},{"title":"C","text":"..."}]}'
    assert points_credit_cost_from_content(content, fallback=5) == 3


def test_point_generation_falls_back_when_response_is_not_countable():
    assert points_credit_cost_from_content('{"message":"ok"}', fallback=5) == 5


def test_point_generation_focus_allows_fewer_relevant_points():
    payload = {"messages": [{"role": "user", "content": 'EXACT TOPIC: "The Marshall Plan"'}]}
    add_points_focus_instruction(payload)
    assert payload["messages"][0]["role"] == "system"
    assert "requested number of points is a maximum" in payload["messages"][0]["content"]
    assert payload["messages"][1]["content"] == 'EXACT TOPIC: "The Marshall Plan"'


def test_diplomator_user_can_choose_only_configured_point_models(client, monkeypatch):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin")
    assert login(test_client).status_code == 200
    assert test_client.post("/admin/ai-settings/keys", json={"groq_api_key": "gsk_test-key", "gemini_api_key": "gemini-test-key"}).status_code == 200
    settings = test_client.get("/admin/ai-settings").json()
    assert "ocr" not in {cap["id"] for cap in settings["apps"]["DIPLOMATOR"]}
    options = test_client.get("/api/diplomator/points-models?app=diplomator")
    assert options.status_code == 200
    identifiers = {item["id"] for item in options.json()["models"]}
    assert "gemini:gemini-3.8-flash" in identifiers
    assert "groq:openai/gpt-oss-120b" in identifiers
    assert not any(item.startswith("openai:") for item in identifiers)

    sent = []
    class FakeResponse:
        status_code = 200
        def json(self):
            return {"choices": [{"message": {"content": '{"points":[{"title":"A","text":"B"}]}'}}], "usage": {"prompt_tokens": 5, "completion_tokens": 7}}
    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kwargs):
            sent.append((url, kwargs))
            return FakeResponse()
    monkeypatch.setattr(app_routes.httpx, "AsyncClient", FakeClient)
    selected = test_client.post("/api/chat?app=diplomator", json={"purpose": "points", "requested_points": 3, "points_model_choice": "gemini:gemini-3.8-flash", "messages": [{"role": "user", "content": "Tema"}]})
    assert selected.status_code == 200
    assert selected.json()["model"] == "gemini-3.8-flash"
    assert "generativelanguage.googleapis.com" in sent[-1][0]
    assert sent[-1][1]["json"]["model"] == "gemini-3.8-flash"
    before = len(sent)
    invalid = test_client.post("/api/chat?app=diplomator", json={"purpose": "points", "points_model_choice": "openai:gpt-4.1", "messages": []})
    assert invalid.status_code == 400
    assert len(sent) == before


def test_legacy_gemini_points_model_retries_current_model_without_extra_credits(client, monkeypatch):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin")
    assert login(test_client).status_code == 200
    assert test_client.post("/admin/ai-settings/keys", json={"gemini_api_key": "gemini-test-key"}).status_code == 200
    assert test_client.post("/admin/ai-settings/apps/DIPLOMATOR", json={"capabilities": {"points": {"provider": "gemini", "model": "gemini-2.5-pro"}}}).status_code == 200

    sent_models = []
    class FakeResponse:
        def __init__(self, status_code): self.status_code = status_code
        def json(self):
            return {"choices": [{"message": {"content": '{"points":[{"title":"A","text":"B"}]}'}}], "usage": {"prompt_tokens": 5, "completion_tokens": 7}}
    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kwargs):
            model = kwargs["json"]["model"]
            sent_models.append(model)
            return FakeResponse(404 if model == "gemini-2.5-pro" else 200)
    monkeypatch.setattr(app_routes.httpx, "AsyncClient", FakeClient)
    response = test_client.post("/api/chat?app=diplomator", json={"purpose": "points", "requested_points": 3, "points_model_choice": "auto", "messages": [{"role": "user", "content": "Tema"}]})
    assert response.status_code == 200
    assert sent_models == ["gemini-2.5-pro", "gemini-3.8-flash"]
    assert response.json()["model"] == "gemini-3.8-flash"
    assert response.json()["replaced_model"] == "gemini-2.5-pro"
    assert response.json()["legacy_model_replaced"] is True
    with db_factory() as db:
        assert db.query(UsageRecord).filter_by(product_code="DIPLOMATOR").count() == 1


def test_gemini_auth_key_uses_native_api_for_probe_and_points(client, monkeypatch):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin")
    assert login(test_client).status_code == 200
    assert test_client.post("/admin/ai-settings/keys", json={"gemini_api_key": "AQ.test-key"}).status_code == 200

    sent = []
    class FakeResponse:
        status_code = 200
        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": '{"points":[{"title":"A","text":"B"}]}' }]}}], "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 7}}
    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kwargs):
            sent.append((url, kwargs))
            return FakeResponse()
    monkeypatch.setattr(app_routes.httpx, "AsyncClient", FakeClient)
    probe = test_client.post("/admin/ai-settings/test-connection", json={"provider": "gemini"})
    assert probe.status_code == 200
    assert sent[-1][0].endswith("/models/gemini-3.8-flash:generateContent")
    assert sent[-1][1]["headers"]["x-goog-api-key"] == "AQ.test-key"
    assert sent[-1][1]["json"]["generationConfig"]["thinkingConfig"]["thinkingLevel"] == "low"
    assert "Authorization" not in sent[-1][1]["headers"]
    response = test_client.post("/api/chat?app=diplomator", json={"purpose": "points", "requested_points": 3, "points_model_choice": "gemini:gemini-3.8-flash", "messages": [{"role": "user", "content": "Tema"}]})
    assert response.status_code == 200
    assert response.json()["model"] == "gemini-3.8-flash"
    assert sent[-1][1]["json"]["contents"][0]["parts"][0]["text"] == "Tema"


def test_gemini_probe_reports_timeout_instead_of_generic_failure(client, monkeypatch):
    import httpx

    test_client, db_factory = client
    seed_user(db_factory, role="superadmin")
    assert login(test_client).status_code == 200
    assert test_client.post("/admin/ai-settings/keys", json={"gemini_api_key": "AQ.test-key"}).status_code == 200
    class TimeoutClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kwargs):
            raise httpx.ReadTimeout("read timed out")
    monkeypatch.setattr(app_routes.httpx, "AsyncClient", TimeoutClient)
    response = test_client.post("/admin/ai-settings/test-connection", json={"provider": "gemini"})
    assert response.status_code == 502
    assert "tiempo de espera agotado" in response.json()["detail"]


def test_diplomator_limits_overload_retries_without_charging(client, monkeypatch):
    from app.services import gemini_native

    test_client, db_factory = client
    seed_user(db_factory, role="superadmin")
    assert login(test_client).status_code == 200
    assert test_client.post("/admin/ai-settings/keys", json={"gemini_api_key": "AQ.test-key"}).status_code == 200
    attempts = []
    class FakeResponse:
        def __init__(self, status_code): self.status_code = status_code
        def json(self):
            if self.status_code == 503:
                return {"error": {"message": "High demand"}}
            return {"candidates": [{"content": {"parts": [{"text": '{"points":[{"title":"A","text":"B"}]}' }]}}], "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 7}}
    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kwargs):
            attempts.append(url)
            return FakeResponse(503 if "/gemini-3.8-flash:" in url else 200)
    async def quick_retry(client, url, *, headers, json):
        return await gemini_native.post_with_retry(client, url, headers=headers, json=json, delays=(0,))
    monkeypatch.setattr(app_routes.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(app_routes, "gemini_post_with_retry", quick_retry)
    response = test_client.post("/api/chat?app=diplomator", json={"purpose": "points", "requested_points": 3, "points_model_choice": "gemini:gemini-3.8-flash", "messages": [{"role": "user", "content": "Tema"}]})
    assert response.status_code == 502
    assert len(attempts) == 2
    assert all("/gemini-3.8-flash:" in url for url in attempts)
    with db_factory() as db:
        assert db.query(UsageRecord).filter_by(product_code="DIPLOMATOR").count() == 0


def test_ai_settings_replaces_deprecated_groq_model(client):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin")
    token = login(test_client).json()["access_token"]
    response = test_client.post(
        "/admin/ai-settings",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "ai_provider": "groq",
            "points_provider": "groq",
            "chat_provider": "groq",
            "transcribe_provider": "groq",
            "points_model": "llama-3.1-8b-instant",
            "chat_model": "llama-3.3-70b-versatile",
            "transcribe_model": "whisper-1",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["points_model"] == GROQ_CHAT_DEFAULT
    assert data["chat_model"] == GROQ_CHAT_DEFAULT
    assert data["transcribe_model"] == GROQ_TRANSCRIBE_DEFAULT


def test_ai_settings_rejects_openai_key_in_groq_field(client):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin")
    token = login(test_client).json()["access_token"]
    response = test_client.post(
        "/admin/ai-settings",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "ai_provider": "groq",
            "chat_provider": "groq",
            "groq_api_key": "sk-proj-wrong-provider",
        },
    )
    assert response.status_code == 400


def test_diplomator_google_requires_existing_account_and_preserves_license(client):
    test_client, db_factory = client
    with db_factory() as db:
        with pytest.raises(HTTPException) as exc:
            auth_api.get_or_create_google_user(db, {"email": "newdip@example.com", "sub": "newdip", "email_verified": True}, ("DIPLOMATOR",))
        assert exc.value.status_code == 403
        assert db.query(User).count() == 0
    seed_user(db_factory)
    with db_factory() as db:
        before = db.query(License).one()
        license_id, credits = before.id, before.usage_limit
        user = auth_api.get_or_create_google_user(db, {"email": "cliente@example.com", "sub": "existingdip", "email_verified": True}, ("DIPLOMATOR",))
        db.commit()
        assert db.query(License).count() == 1
        assert db.query(License).one().id == license_id
        assert db.query(License).one().usage_limit == credits
    assert login(test_client).status_code == 200
    assert test_client.get("/app").status_code == 200
    assert test_client.get("/diplomator/register").status_code == 404


def test_app_ai_models_are_isolated_and_used_by_requests(client, monkeypatch):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin", product_codes=("ESO_ADULTOS", "PROFESOR_PARTICULAR", "DIPLOMATOR"))
    assert login(test_client).status_code == 200
    assert test_client.post("/admin/ai-settings/keys", json={"openai_api_key": "sk-test-only", "groq_api_key": "gsk_test-only"}).status_code == 200
    current = test_client.get("/admin/ai-settings").json()
    professor_before = current["apps"]["PROFESOR_PARTICULAR"]
    response = test_client.post("/admin/ai-settings/apps/ESO_ADULTOS", json={"capabilities": {
        "chat": {"provider": "openai", "model": "test-eso-chat"},
        "ocr": {"provider": "openai", "model": "test-eso-vision"},
        "transcribe": {"provider": "groq", "model": "test-eso-audio"},
    }})
    assert response.status_code == 200
    assert response.json()["apps"]["PROFESOR_PARTICULAR"] == professor_before
    sent = []
    class FakeResponse:
        status_code = 200
        def json(self):
            return {"text": "Audio", "choices": [{"message": {"content": "Respuesta"}}], "usage": {"prompt_tokens": 1, "completion_tokens": 1}}
    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kwargs):
            sent.append((url, kwargs))
            return FakeResponse()
    monkeypatch.setattr(app_routes.httpx, "AsyncClient", FakeClient)
    assert test_client.post("/api/chat?app=eso_adultos", json={"model": "client-cannot-override", "messages": []}).status_code == 200
    assert sent[-1][1]["json"]["model"] == "test-eso-chat"
    assert test_client.post("/api/ocr?app=eso_adultos", json={"image": "aGVsbG8=", "mime_type": "image/png"}).status_code == 200
    assert sent[-1][1]["json"]["model"] == "test-eso-vision"
    assert test_client.post("/api/transcribe?app=eso_adultos", json={"audio": "aGVsbG8="}).status_code == 200
    assert sent[-1][1]["data"]["model"] == "test-eso-audio"
    assert test_client.post("/api/chat?app=profesor_particular", json={"messages": []}).status_code == 200
    assert sent[-1][1]["json"]["model"] == next(c["model"] for c in professor_before if c["id"] == "chat")
    assert test_client.post("/admin/ai-settings/apps/DIPLOMATOR", json={"capabilities": {"points": {"provider": "openai", "model": "test-dip-points"}}}).status_code == 200
    assert test_client.post("/api/chat?app=diplomator", json={"purpose": "points", "messages": []}).status_code == 200
    assert sent[-1][1]["json"]["model"] == "test-dip-points"
    test = test_client.post("/admin/ai-settings/test", json={"product": "ESO_ADULTOS", "capability": "chat"})
    assert test.status_code == 200
    assert sent[-1][1]["json"]["model"] == "test-eso-chat"
    reset = test_client.post("/admin/ai-settings/apps/ESO_ADULTOS", json={"capabilities": {"chat": None}})
    assert next(c for c in reset.json()["apps"]["ESO_ADULTOS"] if c["id"] == "chat")["inherited"] is True


def test_app_ai_validation_and_key_updates_do_not_overwrite_models(client):
    test_client, db_factory = client
    seed_user(db_factory, role="superadmin")
    login(test_client)
    before = test_client.get("/admin/ai-settings").json()
    for product, changes in [("UNKNOWN", {"chat": None}), ("ESO_ADULTOS", {"points": None}), ("ESO_ADULTOS", {"ocr": {"provider": "groq", "model": "anything"}}), ("ESO_ADULTOS", {"chat": {"provider": "openai", "model": "bad model"}})]:
        assert test_client.post("/admin/ai-settings/apps/"+product, json={"capabilities": changes}).status_code == 400
    assert test_client.get("/admin/ai-settings").json()["apps"] == before["apps"]
    keys = test_client.post("/admin/ai-settings/keys", json={"openai_api_key": "sk-test-key"})
    assert keys.status_code == 200
    assert keys.json()["chat_model"] == before["chat_model"]
    assert "sk-test-key" not in keys.text
    assert test_client.post("/admin/ai-settings/keys", json={"groq_api_key": "sk-wrong"}).status_code == 400


def test_app_ai_configuration_requires_admin(client):
    test_client, db_factory = client
    seed_user(db_factory)
    login(test_client)
    assert test_client.post("/admin/ai-settings/apps/ESO_ADULTOS", json={"capabilities": {"chat": None}}).status_code == 403
    assert test_client.post("/admin/ai-settings/keys", json={"openai_api_key": "sk-test"}).status_code == 403
