"""The old named pupil portal must not return after the code-only change."""
from uuid import UUID

from fastapi.testclient import TestClient

from test_access_control import client, login, seed_user

from app.main import app
from app.models import ClientState, License
from app.services.licenses import PROFESOR_PREMIUM_PLAN


def premium(db_factory, user_id):
    with db_factory() as db:
        row = db.query(License).filter(
            License.user_id == UUID(user_id),
            License.product_code == "PROFESOR_PARTICULAR",
        ).one()
        row.plan = PROFESOR_PREMIUM_PLAN
        db.commit()


def test_named_student_account_endpoints_are_gone(client):
    web, factory = client
    _, teacher_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    premium(factory, teacher_id)
    assert login(web).status_code == 200
    assert web.get("/api/profesor/access").status_code == 404
    assert web.post("/api/profesor/access", json={"student_id": "s1", "username": "pupil"}).status_code == 404
    assert web.post("/auth/profesor/student-login", json={"username": "pupil", "password": "secret"}).status_code == 404
    paths = app.openapi()["paths"]
    assert "/api/profesor/access" not in paths
    assert "/auth/profesor/student-login" not in paths


def test_teacher_profiles_and_planning_round_trip_remain_private(client):
    web, factory = client
    _, teacher_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    assert login(web).status_code == 200
    payload = {
        "version": 2,
        "students": [{"id": "s1", "name": "Alumno de prueba", "notes": "Revisar signos", "subjects": ["Lengua"]}],
        "sessions": [{"id": "c1", "studentId": "s1", "notes": "Preparar clase"}],
        "tasks": [{"id": "t1", "studentId": "s1", "title": "Preparar material", "done": False}],
        "assignments": [{"studentId": "s1"}],
        "library": [{"id": "private", "studentId": "s1", "title": "Ficha privada"},
                    {"id": "shared", "title": "Material común"}],
    }
    endpoint = "/api/state?app=profesor_particular"
    assert web.post(endpoint, json=payload).status_code == 200
    result = web.get(endpoint)
    assert result.status_code == 200
    for key, value in payload.items():
        assert result.json()[key] == value
    assert result.headers["Cache-Control"] == "private, no-store"
    with factory() as db:
        saved = db.query(ClientState).filter(ClientState.user_id == UUID(teacher_id)).one()
        assert saved.data["__apps"]["profesor_particular"]["students"] == payload["students"]
        assert saved.data["__apps"]["profesor_particular"]["tasks"] == payload["tasks"]
    seed_user(factory, email="other@example.com", product_codes=("PROFESOR_PARTICULAR",))
    assert login(web, email="other@example.com").status_code == 200
    assert "students" not in web.get(endpoint).json()
    with TestClient(app) as visitor:
        assert visitor.get(endpoint).status_code == 401


def test_teacher_downgrade_revokes_anonymous_game_session(client):
    web, factory = client
    _, teacher_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    premium(factory, teacher_id)
    assert login(web).status_code == 200
    material = {"id": "shared", "title": "Repaso", "subject": "Lengua", "activity": {"questions": [
        {"id": "q1", "type": "quiz", "prompt": "Capital de Francia", "options": ["París", "Lyon"], "answer": "París"},
    ]}}
    assert web.post("/api/state?app=profesor_particular", json={"library": [material]}).status_code == 200
    response = web.post("/api/profesor/material-sessions", json={"material_id": "shared"})
    assert response.status_code == 200
    code = response.json()["session"]["join_code"]
    with TestClient(app) as pupil:
        assert pupil.post("/auth/profesor/student-join", json={"code": code}).status_code == 200
        assert pupil.get("/auth/profesor/student-me").status_code == 200
        with factory() as db:
            license_row = db.query(License).filter(
                License.user_id == UUID(teacher_id), License.product_code == "PROFESOR_PARTICULAR"
            ).one()
            license_row.plan = "PROFESOR_FREE"
            db.commit()
        assert pupil.get("/auth/profesor/student-me").status_code == 403
