import importlib.util
from copy import deepcopy
from pathlib import Path
from uuid import UUID
from datetime import date, datetime, timezone

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient

from test_access_control import client, login, seed_user
from app.main import app
from app.models import AuditLog, ClientState, Organization, ProfesorStateSnapshot
from app.services import profesor_state_history as history
from app.state_preservation_check import fingerprints, verify

URL = "/api/state?app=profesor_particular"
HISTORY = "/api/profesor/state-history?app=profesor_particular"


def content(note="Antes"):
    return {"version": 2, "students": [{"id": "s1", "name": "Nombre de prueba", "notes": note,
            "subjects": ["Lengua"], "course": "3.º ESO"}],
        "sessions": [{"id": "c1", "studentId": "s1", "topic": "Clase"}],
        "tasks": [{"id": "t1", "title": "Preparar clase"}],
        "library": [{"id": "m1", "title": "Lectura"}]}


def setup(client):
    web, factory = client
    _, user_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    assert login(web).status_code == 200
    return web, factory, user_id


def save(web, data):
    version = web.get(URL).headers["etag"]
    return web.post(URL, json=data, headers={"If-Match": version})


def backup(factory, user_id, day=1):
    with factory() as db:
        row = db.scalar(sa.select(ClientState).where(ClientState.user_id == UUID(user_id)))
        history.checkpoint(db, row, "daily", backup_day=date(2026, 1, day), now=datetime(2026, 1, day, tzinfo=timezone.utc))
        db.commit()


def test_stale_tab_and_old_client_cannot_overwrite_data(client):
    web, factory, _ = setup(client)
    before = web.get(URL).headers["etag"]
    first = web.post(URL, json=content(), headers={"If-Match": before})
    assert first.status_code == 200
    assert first.headers["etag"] != before
    stale = web.post(URL, json=content("Antiguo"), headers={"If-Match": before})
    assert stale.status_code == 409 and stale.json()["detail"]["code"] == "state_conflict"
    missing = web.post(URL, json={"version": 2, "students": []})
    assert missing.status_code == 428
    assert web.get(URL).json()["students"][0]["notes"] == "Antes"
    with factory() as db:
        assert db.scalar(sa.select(sa.func.count()).select_from(ProfesorStateSnapshot)) == 0


def test_history_and_restoration_preserve_the_pre_restore_version(client):
    web, factory, user_id = setup(client)
    assert save(web, content()).status_code == 200
    backup(factory, user_id)
    assert save(web, content("Después")).status_code == 200
    listed = web.get(HISTORY)
    assert listed.status_code == 200
    assert listed.headers["cache-control"] == "private, no-store"
    assert "Nombre de prueba" not in listed.text and "payload_zlib" not in listed.text
    versions = listed.json()["versions"]
    older = next(v for v in versions if v["revision"] == 1)
    restore = f'/api/profesor/state-history/{older["id"]}/restore?app=profesor_particular'
    restored = web.post(restore, json={}, headers={"If-Match": web.get(URL).headers["etag"]})
    assert restored.status_code == 200
    assert restored.json()["state"]["students"][0]["notes"] == "Antes"
    assert restored.headers["etag"] == '"profesor-3"'
    assert web.get(URL).json()["students"][0]["notes"] == "Antes"
    previous = next(v for v in web.get(HISTORY).json()["versions"] if v["revision"] == 2)
    undo = web.post(f'/api/profesor/state-history/{previous["id"]}/restore?app=profesor_particular',
        json={}, headers={"If-Match": restored.headers["etag"]})
    assert undo.status_code == 200
    assert undo.json()["state"]["students"][0]["notes"] == "Después"
    assert web.post(restore, json={}, headers={"If-Match": restored.headers["etag"]}).status_code == 409


def test_history_is_owned_by_teacher_and_never_exposed_to_participants(client):
    web, factory, user_id = setup(client)
    save(web, content())
    backup(factory, user_id)
    version = web.get(HISTORY).json()["versions"][0]
    with TestClient(app) as visitor:
        assert visitor.get(HISTORY).status_code == 401
    seed_user(factory, email="other@example.com", product_codes=("PROFESOR_PARTICULAR",))
    login(web, email="other@example.com")
    assert web.get(HISTORY).json()["versions"] == []
    response = web.post(f'/api/profesor/state-history/{version["id"]}/restore?app=profesor_particular',
        json={}, headers={"If-Match": web.get(URL).headers["etag"]})
    assert response.status_code == 404


def test_empty_save_requires_explicit_confirmation_and_missing_data_is_rejected(client):
    web, _, _ = setup(client)
    save(web, content())
    etag = web.get(URL).headers["etag"]
    empty = {"version": 2, "students": [], "sessions": [], "tasks": [], "library": []}
    blocked = web.post(URL, json=empty, headers={"If-Match": etag})
    assert blocked.status_code == 409 and blocked.json()["detail"]["code"] == "state_empty"
    assert web.post(URL, json={"version": 2}, headers={"If-Match": etag}).status_code == 422
    invalid = {**content(), "students": "bad"}
    assert web.post(URL, json=invalid, headers={"If-Match": etag}).status_code == 422
    assert web.get(URL).json()["students"][0]["notes"] == "Antes"
    cleared = web.post(URL, json=empty, headers={"If-Match": etag, "X-Confirm-Empty-State": "true"})
    assert cleared.status_code == 200
    assert web.get(URL).json()["students"] == []
    assert any(v["counts"]["students"] == 1 for v in web.get(HISTORY).json()["versions"])


def test_retention_is_bounded_and_no_op_does_not_fill_history(client):
    web, factory, user_id = setup(client)
    for index in range(history.HISTORY_LIMIT + 3):
        response = save(web, content(str(index)))
        assert response.status_code == 200, response.text
        backup(factory, user_id, index + 1)
    version = web.get(URL).headers["etag"]
    assert save(web, content(str(history.HISTORY_LIMIT + 2))).headers["etag"] == version
    versions = web.get(HISTORY).json()["versions"]
    assert len(versions) == history.HISTORY_LIMIT
    assert versions[-1]["revision"] == 4
    with factory() as db:
        snapshot = db.scalar(sa.select(ProfesorStateSnapshot).where(ProfesorStateSnapshot.user_id == UUID(user_id)))
        assert history.unpack(snapshot)["students"]


def test_plan_and_identity_changes_preserve_all_private_data_and_server_plan(client):
    web, factory, user_id = setup(client)
    assert save(web, content()).status_code == 200
    backup(factory, user_id)
    saved = web.get(URL).json()
    version = web.get(HISTORY).json()["versions"][0]
    seed_user(factory, role="superadmin", email="admin@example.com")
    admin_token = login(web, email="admin@example.com").json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    for plan in ("PROFESOR_PREMIUM", "PROFESOR_FREE", "PROFESOR_PREMIUM"):
        assert web.patch(f"/admin/users/{user_id}/access/PROFESOR_PARTICULAR",
            json={"usage_limit": 300, "plan": plan}, headers=headers).status_code == 200
    assert web.patch(f"/admin/users/{user_id}", json={"full_name": "Nombre actualizado"}, headers=headers).status_code == 200
    login(web)
    current = web.get(URL)
    for key in ("students", "sessions", "tasks", "library"):
        assert current.json()[key] == saved[key]
    assert current.json()["teacherProfile"]["plan"] == "premium"
    restored = web.post(f'/api/profesor/state-history/{version["id"]}/restore?app=profesor_particular',
        json={}, headers={"If-Match": current.headers["etag"]})
    assert restored.status_code == 200 and restored.json()["state"]["teacherProfile"]["plan"] == "premium"
    with factory() as db:
        other = Organization(name="Otra organización")
        db.add(other); db.commit(); other_id = str(other.id)
    moved = web.patch(f"/admin/users/{user_id}", json={"organization_id": other_id}, headers=headers)
    assert moved.status_code == 409
    assert web.get(URL).json()["students"] == saved["students"]


def test_compare_and_swap_rejects_stale_service_state_without_partial_snapshot(client):
    web, factory, user_id = setup(client)
    save(web, content())
    with factory() as stale_db:
        stale = stale_db.scalar(sa.select(ClientState).where(ClientState.user_id == UUID(user_id)))
        old_revision = stale.profesor_revision
        assert save(web, content("Nueva")).status_code == 200
        with pytest.raises(Exception) as exc:
            history.save_version(stale_db, stale, content("Perdida"), old_revision)
        assert exc.value.status_code == 409
    assert web.get(URL).json()["students"][0]["notes"] == "Nueva"
    assert web.get(HISTORY).json()["versions"] == []


def test_history_migration_creates_baseline_idempotently_without_changing_state(client):
    web, factory, user_id = setup(client)
    save(web, content())
    with factory() as db:
        saved = db.scalar(sa.select(ClientState).where(ClientState.user_id == UUID(user_id)))
        original = deepcopy(saved.data)
    migration_path = Path(__file__).parents[1] / "alembic/versions/0020_profesor_state_history.py"
    spec = importlib.util.spec_from_file_location("state_history_migration", migration_path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    with factory.kw["bind"].begin() as connection:
        ProfesorStateSnapshot.__table__.drop(connection)
        connection.execute(sa.text("ALTER TABLE client_states DROP COLUMN profesor_revision"))
        module.op = Operations(MigrationContext.configure(connection))
        module.upgrade(); module.upgrade()
        data = connection.execute(sa.select(ClientState.data)).scalar_one()
        assert data == original
        assert connection.execute(sa.select(sa.func.count()).select_from(ProfesorStateSnapshot)).scalar_one() == 1


def test_deployment_fingerprints_detect_missing_or_modified_teachers_but_ignore_other_apps(client):
    web, factory, _ = setup(client)
    save(web, content())
    with factory.kw["bind"].connect() as connection:
        original = fingerprints(connection)
    verify(original, dict(original))
    with pytest.raises(RuntimeError):
        verify(original, {})
    with pytest.raises(RuntimeError):
        verify(original, {key: {"digest": "different", "revision": value["revision"]} for key, value in original.items()})
    # Lightweight receipts prove legitimate writes without a full copy per edit.
    # An unversioned migration changing content is still blocked.
    assert save(web, content("Edición durante despliegue")).status_code == 200
    with factory.kw["bind"].connect() as connection:
        verify(original, fingerprints(connection), connection)
    with factory() as db:
        row = db.scalar(sa.select(ClientState))
        row.data = {"__apps": {"profesor_particular": {"version": 2, "students": []}}}
        db.commit()
    with factory.kw["bind"].connect() as connection:
        with pytest.raises(RuntimeError):
            verify(original, fingerprints(connection), connection)
    assert web.post("/api/state", json={"another_app": "unchanged"}).status_code == 402
    assert all("Nombre de prueba" not in value["digest"] for value in original.values())


def test_deleting_account_removes_private_history(client):
    web, factory, user_id = setup(client)
    assert save(web, content()).status_code == 200
    backup(factory, user_id)
    seed_user(factory, role="superadmin", email="admin@example.com")
    assert login(web, email="admin@example.com").status_code == 200
    assert web.delete(f"/admin/users/{user_id}").status_code == 200
    with factory() as db:
        assert db.scalar(sa.select(ProfesorStateSnapshot.id).where(ProfesorStateSnapshot.user_id == UUID(user_id))) is None
        assert db.scalar(sa.select(ClientState.id).where(ClientState.user_id == UUID(user_id))) is None
        assert db.scalar(sa.select(AuditLog.id).where(AuditLog.action == "profesor_state_saved")) is None
