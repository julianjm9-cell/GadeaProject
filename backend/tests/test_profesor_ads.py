from __future__ import annotations

import base64
from io import BytesIO
from uuid import UUID

from PIL import Image

from test_access_control import client  # noqa: F401 - shared SQLite test fixture

from app.auth.dependencies import require_superadmin
from app.main import app
from app.models import ProfesorAd, ProfesorAdReport


def ad_payload(**changes):
    return {
        "name": "María López", "subjects": "Matemáticas, Física", "description": "Clases para ESO",
        "contact_email": "maria@example.com", "consent": True, **changes,
    }


def test_simple_ad_can_be_published_and_edited(client):
    web, _ = client
    page = web.get('/profesor/anunciar').text
    assert '<label for="title">Título *' in page
    assert '<label for="course">Curso *' in page
    assert '<label for="subject">Materia *' in page
    assert '<label for="location">Ubicación' in page
    assert '<label for="information">Información' in page
    assert '<label for="photo">Imagen' in page
    assert 'id="contact_email"' not in page and 'id="locationFilter"' not in page

    payload = {"title": "Apoyo en matemáticas", "course": "3.º ESO", "subject": "Matemáticas",
               "location": "Madrid y online", "information": "Escríbeme a ejemplo@example.com", "consent": True}
    assert web.post('/api/profesor/ads', json={**payload, 'title': ' '}).status_code == 422
    assert web.post('/api/profesor/ads', json={**payload, 'course': 'Curso inventado'}).status_code == 422
    created = web.post('/api/profesor/ads', json=payload)
    assert created.status_code == 201, created.text
    ad_id, key = created.json()['ad']['id'], created.json()['manage_key']
    ad = web.get(f'/api/profesor/ads/{ad_id}').json()['ad']
    assert (ad['title'], ad['course'], ad['subject'], ad['location'], ad['information']) == (
        payload['title'], payload['course'], payload['subject'], payload['location'], payload['information'])
    assert ad['contact_email'] == ad['contact_phone'] == ''
    edited = web.post(f'/api/profesor/ads/manage/{ad_id}', headers={'X-Ad-Key': key},
                      json={**payload, 'title': 'Refuerzo de álgebra', 'course': '4.º ESO',
                            'location': 'Getafe', 'information': 'Clases presenciales'})
    assert edited.status_code == 200, edited.text
    assert edited.json()['ad']['title'] == 'Refuerzo de álgebra'
    assert edited.json()['ad']['course'] == '4.º ESO'
    assert edited.json()['ad']['location'] == 'Getafe'
    assert edited.json()['ad']['information'] == 'Clases presenciales'


def test_publication_management_and_public_visibility(client):
    web, factory = client
    assert 'Anúnciate Gratis' in web.get('/profesor').text
    assert 'Publica tu anuncio gratis' in web.get('/profesor/anunciar').text
    assert 'Tablón de profesores' in web.get('/profesor/anuncios').text
    assert web.get('/profesor/anunciar/gestionar').headers['x-robots-tag'] == 'noindex, nofollow'
    assert web.post("/api/profesor/ads", json=ad_payload(consent=False)).status_code == 422
    assert web.post("/api/profesor/ads", json=ad_payload(website="spam")).status_code == 422
    created = web.post("/api/profesor/ads", json=ad_payload())
    assert created.status_code == 201
    assert created.headers["cache-control"] == "no-store"
    ad_id, key = created.json()["ad"]["id"], created.json()["manage_key"]
    assert key not in web.get("/api/profesor/ads").text
    assert web.get(f"/api/profesor/ads/{ad_id}").status_code == 200
    assert web.get(f"/api/profesor/ads/manage/{ad_id}", headers={"X-Ad-Key": "wrong"}).status_code == 404
    managed = web.get(f"/api/profesor/ads/manage/{ad_id}", headers={"X-Ad-Key": key})
    assert managed.status_code == 200 and managed.headers["cache-control"] == "no-store"
    with factory() as db:
        stored = db.get(ProfesorAd, UUID(ad_id))
        assert stored.manage_token_hash != key
        assert stored.consent_at is not None
    updated = web.post(f"/api/profesor/ads/manage/{ad_id}", headers={"X-Ad-Key": key}, json=ad_payload(headline="Nueva propuesta"))
    assert updated.status_code == 200
    assert updated.json()["ad"]["headline"] == "Nueva propuesta"
    assert updated.json()["ad"]["title"] == "Nueva propuesta"
    paused = web.post(f"/api/profesor/ads/manage/{ad_id}/status", headers={"X-Ad-Key": key}, json={"status": "paused"})
    assert paused.status_code == 200
    assert web.get(f"/api/profesor/ads/{ad_id}").status_code == 404
    assert not web.get("/api/profesor/ads").json()["ads"]
    assert web.get(f"/api/profesor/ads/manage/{ad_id}", headers={"X-Ad-Key": key}).json()["status"] == "paused"
    assert web.post(f"/api/profesor/ads/manage/{ad_id}/status", headers={"X-Ad-Key": key}, json={"status": "active"}).status_code == 200
    assert web.delete(f"/api/profesor/ads/manage/{ad_id}", headers={"X-Ad-Key": "wrong"}).status_code == 404
    assert web.delete(f"/api/profesor/ads/manage/{ad_id}", headers={"X-Ad-Key": key}).status_code == 200
    assert web.get(f"/api/profesor/ads/{ad_id}").status_code == 404


def test_photo_validation_reports_and_admin_moderation(client, tmp_path, monkeypatch):
    import app.api.profesor_ads as ads_api

    web, factory = client
    monkeypatch.setattr(ads_api, "IMAGE_DIR", tmp_path)
    assert web.post("/api/profesor/ads", json=ad_payload(image_data="data:image/png;base64,garbage")).status_code == 422
    buffer = BytesIO()
    Image.new("RGB", (24, 24), "red").save(buffer, format="PNG")
    image_data = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()
    created = web.post("/api/profesor/ads", json=ad_payload(image_data=image_data)).json()
    ad_id, key = created["ad"]["id"], created["manage_key"]
    image = web.get(f"/api/profesor/ads/{ad_id}/image")
    assert image.status_code == 200 and image.headers["content-type"] == "image/webp"
    assert image.headers["cache-control"] == "no-store"
    assert web.post(f"/api/profesor/ads/{ad_id}/reports", json={"reason": "muy breve"}).status_code == 422
    assert web.post(f"/api/profesor/ads/{ad_id}/reports", json={"reason": "El contacto del anuncio es falso"}).status_code == 200
    assert web.get("/admin/profesor-ads").status_code == 401
    app.dependency_overrides[require_superadmin] = lambda: object()
    try:
        listed = web.get("/admin/profesor-ads")
        assert listed.status_code == 200 and listed.json()["ads"][0]["reports"] == 1
        reasons = web.get(f"/admin/profesor-ads/{ad_id}/reports")
        assert reasons.json()["reports"][0]["reason"] == "El contacto del anuncio es falso"
        assert web.post(f"/admin/profesor-ads/{ad_id}/status", json={"status": "removed"}).status_code == 200
    finally:
        app.dependency_overrides.pop(require_superadmin, None)
    assert web.get(f"/api/profesor/ads/{ad_id}").status_code == 404
    assert web.get(f"/api/profesor/ads/{ad_id}/image").status_code == 404
    assert web.post(f"/api/profesor/ads/manage/{ad_id}/status", headers={"X-Ad-Key": key}, json={"status": "active"}).status_code == 403
    assert web.delete(f"/api/profesor/ads/manage/{ad_id}", headers={"X-Ad-Key": key}).status_code == 200
    with factory() as db:
        assert db.query(ProfesorAdReport).count() == 0
