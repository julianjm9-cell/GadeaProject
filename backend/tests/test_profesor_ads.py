from __future__ import annotations

import base64
from io import BytesIO
from uuid import UUID

from PIL import Image

from test_access_control import client  # noqa: F401 - shared SQLite test fixture

from app.auth.dependencies import require_superadmin
from app.main import app
from app.models import ProfesorAd, ProfesorAdReport
from app.api.profesor_ads import CONSENT_VERSION, TERMS_TEXT, PUBLICATION_TEXT
from datetime import datetime, timedelta, timezone


def test_separate_current_consent_is_required_and_recorded(client):
    web, factory = client
    for changes in ({"terms_accepted": False}, {"consent": False}, {"consent_version": "old"}):
        assert web.post('/api/profesor/ads', json=ad_payload(**changes)).status_code == 422
    # Invalid attempts also consume rate limits; this test checks evidence through policy
    # with a fresh bucket for its successful request.
    from app.api.auth import LOGIN_BUCKET
    LOGIN_BUCKET.clear()
    created = web.post('/api/profesor/ads', json=ad_payload()).json()
    with factory() as db:
        ad = db.get(ProfesorAd, UUID(created['ad']['id']))
        assert ad.governance['terms'] == TERMS_TEXT
        assert ad.governance['publication'] == PUBLICATION_TEXT
        assert ad.consent_version == CONSENT_VERSION
    public = web.get('/api/profesor/ads')
    assert 'governance' not in public.text and 'manage_token_hash' not in public.text
    assert public.headers['cache-control'] == 'no-store'
    assert public.headers['x-robots-tag'] == 'noindex, nofollow'
    assert web.get('/api/profesor/ad-policy').json()['version'] == CONSENT_VERSION


def test_expiry_covers_details_images_and_renewal(client, tmp_path, monkeypatch):
    import app.api.profesor_ads as api
    web, factory = client
    monkeypatch.setattr(api, 'IMAGE_DIR', tmp_path)
    result = web.post('/api/profesor/ads', json=ad_payload()).json()
    ad_id, key = result['ad']['id'], result['manage_key']
    headers = {'X-Ad-Key': key}
    with factory() as db:
        ad = db.get(ProfesorAd, UUID(ad_id))
        ad.consent_at = datetime.now(timezone.utc) - timedelta(days=91)
        ad.image_name = 'image.webp'
        api.image_path(ad).write_bytes(b'old-image')
        db.commit()
    assert web.get('/api/profesor/ads').json()['ads'] == []
    assert web.get(f'/api/profesor/ads/{ad_id}').status_code == 404
    assert web.get(f'/api/profesor/ads/{ad_id}/image').status_code == 404
    assert web.get(f'/api/profesor/ads/manage/{ad_id}', headers=headers).json()['status'] == 'expired'
    assert web.post(f'/api/profesor/ads/manage/{ad_id}/status', headers=headers, json={'status':'active'}).status_code == 422
    assert web.post(f'/api/profesor/ads/manage/{ad_id}', headers=headers, json=ad_payload()).status_code == 200
    assert web.get(f'/api/profesor/ads/{ad_id}').status_code == 200


def test_retention_purges_image_ad_and_reports(client, tmp_path, monkeypatch):
    import app.api.profesor_ads as api
    web, factory = client
    monkeypatch.setattr(api, 'IMAGE_DIR', tmp_path)
    result = web.post('/api/profesor/ads', json=ad_payload()).json()
    ad_id = UUID(result['ad']['id'])
    with factory() as db:
        ad = db.get(ProfesorAd, ad_id)
        ad.consent_at = datetime.now(timezone.utc) - timedelta(days=181)
        ad.image_name = 'image.webp'
        path = api.image_path(ad)
        path.write_bytes(b'old-image')
        db.add(ProfesorAdReport(ad_id=ad_id, reason='An old report'))
        db.commit()
        assert api.purge_expired(db) == 1
        assert db.get(ProfesorAd, ad_id) is None
        assert db.query(ProfesorAdReport).count() == 0
    assert not path.exists()


def test_private_reports_receipts_moderation_and_notification(client):
    web, _ = client
    result = web.post('/api/profesor/ads', json=ad_payload()).json()
    ad_id, key = result['ad']['id'], result['manage_key']
    report = {'reason':'Este anuncio suplanta a otra persona', 'name':'Informante privado',
              'email':'privado@example.com', 'good_faith':True, 'category':'privacy'}
    url=f'/api/profesor/ads/{ad_id}/reports'
    assert web.post(url, json={**report,'good_faith':False}).status_code == 422
    assert web.post(url, json={**report,'email':''}).status_code == 422
    result=web.post(url,json=report).json()
    rid=result['report_id']
    receipt=f'/api/profesor/ad-reports/{rid}'
    h={'X-Ad-Key':result['receipt_key']}
    assert web.get(receipt).status_code == 404
    assert web.get(receipt,headers=h).json()['status']=='pending'
    assert report['email'] not in web.get(receipt,headers=h).text
    assert web.post(url,json={'reason':'Aviso de abuso sexual de menores', 'category':'child_sexual_abuse','good_faith':True}).status_code == 200
    admin=f'/admin/profesor-ads/{ad_id}/reports/{rid}'
    assert web.post(admin,json={'decision':'Contenido revisado'}).status_code == 401
    app.dependency_overrides[require_superadmin]=lambda: object()
    try:
        assert web.post(f'/admin/profesor-ads/{ad_id}/status',json={'status':'removed'}).status_code==422
        assert web.post(admin,json={'notification':'decision'}).status_code==422
        assert web.post(admin,json={'notification':'receipt'}).status_code==200
        decision='Retirado por suplantación de identidad.'
        assert web.post(f'/admin/profesor-ads/{ad_id}/status',json={'status':'removed','reason':decision}).status_code==200
        assert web.post(admin,json={'decision':decision}).status_code==200
        assert web.post(admin,json={'notification':'decision'}).status_code==200
        assert web.get(receipt,headers=h).json()['decision']==decision
        private=web.get(f'/api/profesor/ads/manage/{ad_id}',headers={'X-Ad-Key':key})
        assert private.json()['ad']['moderation_reason']==decision
        assert report['email'] not in private.text and report['name'] not in private.text
        assert web.post(f'/admin/profesor-ads/{ad_id}/delete',json={'verified':False,'reason':'Solicitud de supresión'}).status_code==422
        assert web.post(f'/admin/profesor-ads/{ad_id}/delete',json={'verified':True,'reason':'Solicitud de supresión verificada'}).status_code==200
        assert web.get(receipt,headers=h).status_code==404
    finally:
        app.dependency_overrides.pop(require_superadmin,None)


def test_legal_pages_and_management_headers(client):
    web,_=client
    for path in ['/aviso-legal','/cookies','/privacidad','/profesor/condiciones']:
        assert web.get(path).status_code==200
    page=web.get('/profesor/anunciar/gestionar')
    assert page.headers['referrer-policy']=='no-referrer'
    assert "frame-ancestors 'none'" in page.headers['content-security-policy']
    assert 'id="termsAccepted" type="checkbox" required' in page.text
    assert 'Calle Santa Maria, 36' in web.get('/aviso-legal').text
    assert web.post('/api/profesor/ads',content=b'x'*7_100_001,headers={'Content-Type':'application/json'}).status_code==413


def ad_payload(**changes):
    return {
        "name": "María López", "subjects": "Matemáticas, Física", "description": "Clases para ESO",
        "contact_email": "maria@example.com", "consent": True, "terms_accepted": True, "consent_version": CONSENT_VERSION, **changes,
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
               "location": "Madrid y online", "information": "Escríbeme a ejemplo@example.com", "consent": True, "terms_accepted": True, "consent_version": CONSENT_VERSION}
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
    assert web.post(f"/api/profesor/ads/{ad_id}/reports", json={"reason": "El contacto del anuncio es falso", "name": "Informante", "email": "informante@example.com", "good_faith": True}).status_code == 200
    assert web.get("/admin/profesor-ads").status_code == 401
    app.dependency_overrides[require_superadmin] = lambda: object()
    try:
        listed = web.get("/admin/profesor-ads")
        assert listed.status_code == 200 and listed.json()["ads"][0]["reports"] == 1
        reasons = web.get(f"/admin/profesor-ads/{ad_id}/reports")
        assert reasons.json()["reports"][0]["reason"] == "El contacto del anuncio es falso"
        assert web.post(f"/admin/profesor-ads/{ad_id}/status", json={"status": "removed", "reason": "Contacto falso: norma de suplantaciones"}).status_code == 200
    finally:
        app.dependency_overrides.pop(require_superadmin, None)
    assert web.get(f"/api/profesor/ads/{ad_id}").status_code == 404
    assert web.get(f"/api/profesor/ads/{ad_id}/image").status_code == 404
    assert web.post(f"/api/profesor/ads/manage/{ad_id}/status", headers={"X-Ad-Key": key}, json={"status": "active"}).status_code == 403
    assert web.delete(f"/api/profesor/ads/manage/{ad_id}", headers={"X-Ad-Key": key}).status_code == 200
    with factory() as db:
        assert db.query(ProfesorAdReport).count() == 0
