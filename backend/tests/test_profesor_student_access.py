from uuid import UUID
from urllib.parse import parse_qs, urlparse
from fastapi.testclient import TestClient

from test_access_control import client, login, seed_user

from app.models import License, User
from app.main import app
from app.config import get_settings
from app.api import auth as auth_api
from app.services.licenses import PROFESOR_PREMIUM_PLAN


def premium(db_factory, user_id):
    with db_factory() as db:
        row = db.query(License).filter(License.user_id == UUID(user_id), License.product_code == "PROFESOR_PARTICULAR").one()
        row.plan = PROFESOR_PREMIUM_PLAN
        db.commit()


def test_student_login_is_isolated_and_downgrade_closes_portal(client):
    web, factory = client
    _, teacher_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    assert login(web).status_code == 200
    assert web.post("/api/state?app=profesor_particular", json={"version": 2, "students": [{"id": "s1", "name": "María", "course": "A1"}], "library": [{"id": "private"}]}).status_code == 200
    assert web.get("/api/profesor/access").status_code == 403
    assert web.post("/api/profesor/access", json={"student_id": "s1", "username": "maria.123"}).status_code == 403
    premium(factory, teacher_id)
    assert web.get("/api/profesor/access").status_code == 200
    created = web.post("/api/profesor/access", json={"student_id": "s1", "username": "maria.123"})
    assert created.status_code == 200
    access = created.json()["access"]
    password = created.json()["password"]
    assert password not in str(web.get("/api/profesor/access").json())
    assert web.post("/api/profesor/access", json={"student_id": "missing", "username": "fake.123"}).status_code == 404
    assert web.post(f"/api/profesor/access/{access['id']}/meet-link", json={"url": "https://evil.example/abc-defg-hij"}).status_code == 422
    assert web.post(f"/api/profesor/access/{access['id']}/meet-link", json={"url": "https://meet.google.com/abc-defg-hij"}).status_code == 200
    web.post("/auth/logout")
    assert web.post("/auth/profesor/student-login", json={"username": "maria.123", "password": "bad"}).status_code == 401
    assert web.post("/auth/profesor/student-login", json={"username": "maria.123", "password": password}).status_code == 200
    portal = web.get("/auth/profesor/student-me")
    assert portal.status_code == 200
    assert portal.json()["student"]["name"] == "María"
    assert portal.json()["meet_uri"] == "https://meet.google.com/abc-defg-hij"
    assert "private" not in portal.text
    assert web.get("/api/state?app=profesor_particular").status_code == 401
    assert web.get("/profesor/alumno").status_code == 200
    assert web.get("/profesor-access.js").status_code == 200
    assert web.get("/assets/profesor-access.css").status_code == 200
    with factory() as db:
        row = db.query(License).filter(License.user_id == UUID(teacher_id), License.product_code == "PROFESOR_PARTICULAR").one()
        row.plan = "PROFESOR_FREE"
        db.commit()
    assert web.get("/auth/profesor/student-me").status_code == 403


def test_reset_pause_and_teacher_isolation(client):
    web, factory = client
    _, teacher_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    premium(factory, teacher_id)
    login(web)
    web.post("/api/state?app=profesor_particular", json={"students": [{"id": "s1", "name": "Uno"}]})
    created = web.post("/api/profesor/access", json={"student_id": "s1", "username": "uno.123"}).json()
    access_id, old_password = created["access"]["id"], created["password"]
    _, second_id = seed_user(factory, email="second@example.com", product_codes=("PROFESOR_PARTICULAR",))
    premium(factory, second_id)
    login(web, email="second@example.com")
    assert web.get("/api/profesor/access").json()["accesses"] == []
    assert web.post(f"/api/profesor/access/{access_id}/reset-password").status_code == 404
    assert web.post(f"/api/profesor/access/{access_id}/meet-link", json={"url": "https://meet.google.com/abc-defg-hij"}).status_code == 404
    login(web)
    new_password = web.post(f"/api/profesor/access/{access_id}/reset-password").json()["password"]
    assert old_password != new_password
    web.post("/auth/logout")
    assert web.post("/auth/profesor/student-login", json={"username": "uno.123", "password": old_password}).status_code == 401
    assert web.post("/auth/profesor/student-login", json={"username": "uno.123", "password": new_password}).status_code == 200
    login(web)
    assert web.post(f"/api/profesor/access/{access_id}/active", json={"active": False}).status_code == 200
    assert web.post("/auth/profesor/student-login", json={"username": "uno.123", "password": new_password}).status_code == 401


def test_meet_create_reuses_link_and_student_deletion_revokes_access(client, monkeypatch):
    web, factory = client
    _, teacher_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    premium(factory, teacher_id)
    login(web)
    web.post("/api/state?app=profesor_particular", json={"students": [{"id": "s1", "name": "Uno"}]})
    created = web.post("/api/profesor/access", json={"student_id": "s1", "username": "meet.123"}).json()
    access_id = created["access"]["id"]
    assert web.post(f"/api/profesor/access/{access_id}/meet-create", json={}).status_code == 409
    with factory() as db:
        user = db.get(User, UUID(teacher_id))
        user.meet_refresh_token = "mock-refresh"
        db.commit()
    calls = []

    async def fake_meet(_):
        calls.append(1)
        return "https://meet.google.com/abc-defg-hij", "spaces/test"

    monkeypatch.setattr("app.api.profesor_access.google_meet_space", fake_meet)
    first = web.post(f"/api/profesor/access/{access_id}/meet-create", json={})
    second = web.post(f"/api/profesor/access/{access_id}/meet-create", json={})
    assert first.status_code == 200 and second.status_code == 200
    assert len(calls) == 1 and second.json()["existing"] is True
    web.post("/api/state?app=profesor_particular", json={"students": []})
    assert web.get("/api/profesor/access").json()["accesses"] == []
    web.post("/auth/logout")
    assert web.post("/auth/profesor/student-login", json={"username": "meet.123", "password": created["password"]}).status_code == 401


def test_student_portal_reads_the_latest_link_without_new_login(client):
    web, factory = client
    _, teacher_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    premium(factory, teacher_id)
    login(web)
    web.post("/api/state?app=profesor_particular", json={"students": [{"id": "s1", "name": "María"}]})
    created = web.post("/api/profesor/access", json={"student_id": "s1", "username": "maria.meet"}).json()
    with TestClient(app) as pupil:
        assert pupil.post("/auth/profesor/student-login", json={"username": "maria.meet", "password": created["password"]}).status_code == 200
        assert pupil.get("/auth/profesor/student-me").json()["meet_uri"] == ""
        access_id = created["access"]["id"]
        assert web.post(f"/api/profesor/access/{access_id}/meet-link", json={"url": "https://meet.google.com/abc-defg-hij?authuser=0"}).status_code == 200
        assert pupil.get("/auth/profesor/student-me").json()["meet_uri"] == "https://meet.google.com/abc-defg-hij"
        assert web.post(f"/api/profesor/access/{access_id}/meet-clear").status_code == 200
        assert pupil.get("/auth/profesor/student-me").json()["meet_uri"] == ""


def test_google_meet_connection_requires_premium_and_specific_scope(client, monkeypatch):
    web, factory = client
    _, teacher_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    login(web)
    assert web.get("/auth/google/meet").status_code == 403
    premium(factory, teacher_id)
    settings = get_settings()
    monkeypatch.setattr(settings, "google_client_id", "test-google-id")
    monkeypatch.setattr(settings, "google_client_secret", "test-google-secret")
    response = web.get("/auth/google/meet", follow_redirects=False)
    assert response.status_code in (302, 307)
    scopes = parse_qs(urlparse(response.headers["location"]).query)["scope"][0]
    assert "https://www.googleapis.com/auth/meetings.space.created" in scopes


def test_meet_oauth_callback_binds_connection_to_logged_in_teacher(client, monkeypatch):
    web, factory = client
    _, teacher_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    premium(factory, teacher_id)
    login(web)
    web.cookies.set("diplomator_google_state", "test-state")
    monkeypatch.setattr(auth_api, "decode_google_state", lambda _: {"purpose": "meet", "user_id": teacher_id, "next": "/profesor-particular"})

    async def exchange(_):
        return {"userinfo": {"sub": "google-id"}, "refresh_token": "refresh-for-meet"}

    monkeypatch.setattr(auth_api, "exchange_google_code", exchange)
    response = web.get("/auth/google/callback?code=test&state=test-state", follow_redirects=False)
    assert response.headers["location"] == "/profesor-particular?meet=connected#accesos"
    with factory() as db:
        assert db.get(User, UUID(teacher_id)).meet_refresh_token == "refresh-for-meet"
    _, other_id = seed_user(factory, email="other@example.com", product_codes=("PROFESOR_PARTICULAR",))
    web.cookies.set("diplomator_google_state", "test-state")
    monkeypatch.setattr(auth_api, "decode_google_state", lambda _: {"purpose": "meet", "user_id": other_id, "next": "/profesor-particular"})
    response = web.get("/auth/google/callback?code=test&state=test-state", follow_redirects=False)
    assert response.headers["location"] == "/profesor/login?expired=1"
    with factory() as db:
        assert db.get(User, UUID(other_id)).meet_refresh_token is None
