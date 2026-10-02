from io import BytesIO

import httpx
from PIL import Image

from test_access_control import client, login, seed_user
from app.api import app_routes


def enable_premium(web):
    assert web.post('/api/state?app=profesor_particular', json={'version': 2, 'teacherProfile': {'plan': 'premium'}}).status_code == 200


def test_image_search_requires_premium_account(client):
    web, factory = client
    seed_user(factory, product_codes=('PROFESOR_PARTICULAR',))
    assert login(web).status_code == 200
    blocked = web.get('/api/profesor/images/search?q=gato&app=profesor_particular')
    assert blocked.status_code == 403
    assert 'Premium' in blocked.json()['detail']


def test_pixabay_search_import_and_private_pdf(client, monkeypatch, tmp_path):
    web, factory = client
    seed_user(factory, role="superadmin", product_codes=("PROFESOR_PARTICULAR",))
    assert login(web).status_code == 200
    enable_premium(web)
    monkeypatch.setattr(app_routes, "LOCAL_DOCUMENT_DIR", tmp_path)
    missing = web.get("/api/profesor/images/search?q=gato&app=profesor_particular")
    assert missing.status_code == 503
    key = "12345678-" + "a" * 32
    saved = web.post("/admin/ai-settings/keys", json={"pixabay_api_key": key})
    assert saved.status_code == 200
    assert saved.json()["pixabay_configured"] is True
    assert key not in saved.text

    photo = BytesIO()
    Image.new("RGB", (240, 160), "#8ec5ff").save(photo, format="JPEG")
    calls = []

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, url, **kwargs):
            calls.append((url, kwargs))
            if url == "https://pixabay.com/get/cat.jpg":
                return httpx.Response(200, content=photo.getvalue(), request=httpx.Request("GET", url))
            assert url == "https://pixabay.com/api/"
            assert kwargs["params"]["key"] == key
            hit = {"id": 42, "webformatURL": "https://pixabay.com/get/cat.jpg", "pageURL": "https://pixabay.com/photos/cat-42/", "user": "Ana", "tags": "gato, animales"}
            return httpx.Response(200, json={"hits": [hit]}, request=httpx.Request("GET", url))

    monkeypatch.setattr(app_routes.httpx, "AsyncClient", FakeClient)
    first = web.get("/api/profesor/images/search?q=gato&app=profesor_particular")
    second = web.get("/api/profesor/images/search?q=gato&app=profesor_particular")
    assert first.status_code == second.status_code == 200
    assert first.json()["images"][0]["author"] == "Ana"
    assert len(calls) == 1  # The same search uses the 24-hour cache.

    imported = web.post("/api/profesor/images/import?app=profesor_particular", json={"id": 42})
    assert imported.status_code == 200, imported.text
    image = imported.json()
    assert image["credit"] == "Imagen de Ana en Pixabay"
    preview = web.get(f'/api/profesor/materials/{image["id"]}/preview?app=profesor_particular')
    assert preview.status_code == 200
    assert preview.headers["content-type"].startswith("image/jpeg")
    material = {"title": "Gatos", "subject": "Ciencias", "activity": {"context": {"course": "Primaria"}, "questions": [
        {"type": "visualquiz", "prompt": "¿Qué animal aparece?", "answer": "Gato", "options": ["Gato", "Perro"], "image": image}
    ]}}
    pdf = web.post("/api/profesor/export-pdf?app=profesor_particular", json={"material": material, "version": "worksheet"})
    assert pdf.status_code == 200, pdf.text
    assert pdf.content.startswith(b"%PDF")


def test_pixabay_key_requires_admin_and_image_requires_login(client):
    web, factory = client
    seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    assert web.get("/api/profesor/images/search?q=gato&app=profesor_particular").status_code == 401
    assert login(web).status_code == 200
    enable_premium(web)
    assert web.post("/admin/ai-settings/keys", json={"pixabay_api_key": "12345678-" + "a" * 32}).status_code == 403
    assert web.post("/api/profesor/images/import?app=profesor_particular", json={"id": -2}).status_code == 422


def test_pixabay_import_rejects_untrusted_image_host(client, monkeypatch):
    web, factory = client
    seed_user(factory, role="superadmin", product_codes=("PROFESOR_PARTICULAR",))
    assert login(web).status_code == 200
    enable_premium(web)
    assert web.post("/admin/ai-settings/keys", json={"pixabay_api_key": "12345678-" + "a" * 32}).status_code == 200

    async def unsafe_result(params, key):
        return {"hits": [{"id": 99, "webformatURL": "http://127.0.0.1/private", "pageURL": "https://pixabay.com/", "user": "Bad"}]}

    monkeypatch.setattr(app_routes, "_pixabay_data", unsafe_result)
    response = web.post("/api/profesor/images/import?app=profesor_particular", json={"id": 99})
    assert response.status_code == 502
