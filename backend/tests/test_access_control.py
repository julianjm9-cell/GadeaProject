from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.session import Base, get_db
from app.api.auth import LOGIN_BUCKET, ensure_google_access
from app.main import app
from app.models import License, Organization, User
from app.security.passwords import hash_password


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


@pytest.mark.parametrize(
    ("path", "next_path"),
    [
        ("/", "/apps"),
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
