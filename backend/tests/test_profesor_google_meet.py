"""Teacher-owned Google Meet connection remains isolated from game codes."""
from urllib.parse import parse_qs, urlparse
from uuid import UUID

from test_access_control import client, login, seed_user
from test_profesor_student_access import premium

from app.api import auth as auth_api
from app.config import get_settings
from app.models import User


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
