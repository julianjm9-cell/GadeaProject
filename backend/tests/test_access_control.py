from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.session import Base, get_db
from app.api import auth as auth_api
from app.api.app_routes import points_credit_cost_from_content, record_usage
from app.api.auth import LOGIN_BUCKET, ensure_google_access
from app.main import app
from app.models import License, Organization, UsageRecord, User
from app.security.passwords import hash_password
from app.services.ai_config import GROQ_CHAT_DEFAULT, GROQ_TRANSCRIBE_DEFAULT


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


def seed_user(db_factory, *, org_status="active", user_active=True, license_status="active", expires_delta_days=30, role="user", email="cliente@example.com", product_codes=("DIPLOMATOR",)):
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
            prefix = {"CAMBRIDGE": "CAMB", "UNIVERSIDAD_ADULTOS": "U25", "ESO_ADULTOS": "E25"}.get(product_code, "DIPLO")
            db.add(
                License(
                    organization_id=org.id,
                    product_code=product_code,
                    plan="MVP",
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


@pytest.mark.parametrize("path", ["/", "/suite", "/u25", "/e25", "/cambridge-info", "/diplomator"])
def test_public_marketing_pages_load_without_login(client, path):
    test_client, _ = client
    response = test_client.get(path)
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


@pytest.mark.parametrize("path", ["/login", "/u25/login", "/e25/login", "/cambridge-info/login", "/diplomator/login"])
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


def test_google_signup_creates_access_for_both_apps(client):
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
    assert {"DIPLOMATOR", "CAMBRIDGE", "UNIVERSIDAD_ADULTOS", "ESO_ADULTOS"} <= codes


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


def test_point_generation_records_one_credit_per_point(client):
    _, db_factory = client
    _, user_id = seed_user(db_factory)
    with db_factory() as db:
        user = db.get(User, user_id)
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
