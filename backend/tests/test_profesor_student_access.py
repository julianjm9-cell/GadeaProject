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


def test_old_pupil_records_are_removed_from_saved_teacher_state(client):
    web, factory = client
    _, teacher_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    assert login(web).status_code == 200
    with factory() as db:
        row = db.query(ClientState).filter(ClientState.user_id == UUID(teacher_id)).one_or_none()
        if row is None:
            from app.models import User
            user = db.get(User, UUID(teacher_id))
            row = ClientState(user_id=user.id, organization_id=user.organization_id)
            db.add(row)
        row.data = {"__apps": {"profesor_particular": {
            "students": [{"id": "s1", "name": "Nombre antiguo"}],
            "sessions": [{"studentId": "s1", "notes": "Notas antiguas"}],
            "assignments": [{"studentId": "s1"}],
            "activityAttempts": [{"studentId": "s1", "answer": "respuesta"}],
            "library": [
                {"id": "private", "studentId": "s1", "title": "Ficha privada"},
                {"id": "shared", "title": "Material común"},
            ],
        }}}
        db.commit()
    result = web.get("/api/state?app=profesor_particular")
    assert result.status_code == 200
    assert result.json()["library"] == [{"id": "shared", "title": "Material común"}]
    for key in ("students", "sessions", "assignments", "activityAttempts"):
        assert key not in result.json()
    with factory() as db:
        saved = db.query(ClientState).filter(ClientState.user_id == UUID(teacher_id)).one()
        assert "students" not in saved.data["__apps"]["profesor_particular"]
        assert saved.data["__apps"]["profesor_particular"]["library"] == [{"id": "shared", "title": "Material común"}]


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
