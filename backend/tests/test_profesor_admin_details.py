from datetime import timedelta
from uuid import UUID

import pytest
from sqlalchemy import select

from test_access_control import client, login, seed_user
from app.api.auth import issue_login_response
from app.models import AuditLog, ClientState, License, ProfesorGenerationJob, UsageRecord, User
from app.models.core import utcnow
from app.services.profesor_admin import prune_diagnostics
from fastapi import Response


def setup(client):
    web, factory = client
    _, teacher = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    login(web)
    content = {"students": [{"id": "s1", "name": "PRIVATE_PUPIL", "notes": "PRIVATE_NOTE"}],
        "sessions": [{"topic": "PRIVATE_CLASS"}], "tasks": [{"title": "PRIVATE_TASK"}],
        "library": [{"id": "m1", "title": "Sintaxis", "subject": "Lengua", "studentId": "PRIVATE_PUPIL",
            "kind": "Actividad interactiva", "body": "PRIVATE_BODY", "activity": {"context": {"course": "3.º ESO"},
                "questions": [{"type": "pasapalabra", "prompt": "PRIVATE_QUESTION", "answer": "PRIVATE_ANSWER"}]}}]}
    assert web.post('/api/state?app=profesor_particular', json=content).status_code == 200
    seed_user(factory, role="superadmin", email="admin@example.com")
    token = login(web, email="admin@example.com").json()["access_token"]
    return web, factory, teacher, {"Authorization": f"Bearer {token}"}


def test_details_and_catalog_are_allowlisted_and_do_not_change_teacher_state(client):
    web, factory, teacher, headers = setup(client)
    with factory() as db:
        row = db.scalar(select(ClientState).where(ClientState.user_id == UUID(teacher)))
        before = row.data, row.profesor_revision, row.updated_at
        user = db.get(User, UUID(teacher))
        user.drive_refresh_token = "PRIVATE_CREDENTIAL"
        license_id = db.scalar(select(License.id).where(License.user_id == user.id))
        db.add(ProfesorGenerationJob(user_id=user.id, organization_id=user.organization_id, license_id=license_id,
            request_id="incident-123", payload={"prompt": "PRIVATE_PROMPT"}, result={"text": "PRIVATE_RESULT"},
            error="PRIVATE_PROVIDER_ERROR", status="failed", failure_category="load", attempt_count=3))
        db.add(UsageRecord(user_id=user.id, organization_id=user.organization_id, product_code="PROFESOR_PARTICULAR", model="teacher-model"))
        db.add(UsageRecord(user_id=user.id, organization_id=user.organization_id, product_code="DIPLOMATOR", model="PRIVATE_OTHER_APP"))
        db.commit()
    result = web.get(f'/admin/profesor-users/{teacher}?purpose=support', headers=headers)
    assert result.status_code == 200, result.text
    assert result.headers['cache-control'] == 'private, no-store'
    assert result.headers['x-robots-tag'] == 'noindex, nofollow'
    data = result.json()
    assert data['counts']['students'] == data['counts']['library'] == 1
    assert data['account']['drive_connected'] is True
    assert data['generations'][0]['request_id'] == 'incident-123'
    assert data['generation_counts']['failed'] == 1
    assert data['changes'][0]['purpose'] == 'support'
    assert data['changes'][0]['actor_name'] == 'Cliente'
    assert data['usage'][0]['model'] == 'teacher-model'
    catalog = web.get(f'/admin/profesor-users/{teacher}/materials?purpose=support', headers=headers)
    assert catalog.status_code == 200 and catalog.json()['total'] == 1
    assert catalog.json()['materials'][0]['types'] == ['pasapalabra']
    assert catalog.json()['materials'][0]['created_at'] is None
    for response in (result, catalog):
        assert 'PRIVATE_' not in response.text
        assert 'password_hash' not in response.text and 'payload_zlib' not in response.text
    with factory() as db:
        row = db.scalar(select(ClientState).where(ClientState.user_id == UUID(teacher)))
        assert (row.data, row.profesor_revision, row.updated_at) == before
        records = list(db.scalars(select(AuditLog).where(AuditLog.action.in_(['profesor_account_viewed','profesor_catalog_viewed']))))
        assert len(records) == 2
        assert all(r.actor_user_id and r.entity_id == teacher and r.log_metadata['purpose'] == 'support' for r in records)


@pytest.mark.parametrize('role,active,org_status', [('user',True,'active'),('admin',True,'active'),('superadmin',False,'active'),('superadmin',True,'inactive')])
def test_details_require_an_active_superadmin(client, role, active, org_status):
    web, factory, teacher, _ = setup(client)
    # Issue a valid token first, then revoke the server-side privileges.
    with factory() as db:
        admin = db.scalar(select(User).where(User.email == 'admin@example.com'))
        admin.role, admin.is_active = role, active
        admin.organization.status = org_status
        db.commit()
    for suffix in ('','/materials'):
        expected=401 if not active or org_status!='active' else 403
        assert web.get(f'/admin/profesor-users/{teacher}{suffix}').status_code == expected
    with factory() as db:
        assert db.scalar(select(AuditLog.id).where(AuditLog.action == 'profesor_account_viewed')) is None


def test_unauthenticated_and_unknown_or_non_teacher_accounts(client):
    web, factory, teacher, headers = setup(client)
    web.cookies.clear()
    assert web.get(f'/admin/profesor-users/{teacher}').status_code == 401
    assert web.get('/admin/profesor-users/00000000-0000-0000-0000-000000000000', headers=headers).status_code == 404
    _, other = seed_user(factory, email='unrelated@example.com')
    assert web.get(f'/admin/profesor-users/{other}', headers=headers).status_code == 404
    assert web.get(f'/admin/profesor-users/{teacher}?purpose=anything', headers=headers).status_code == 422


def test_catalog_filters_pagination_and_account_isolation(client):
    web, factory, teacher, headers = setup(client)
    with factory() as db:
        row = db.scalar(select(ClientState).where(ClientState.user_id == UUID(teacher)))
        state = dict(row.data)
        state['__apps'] = {'profesor_particular': {'library': [
            {'id': str(i), 'title': f'Unidad {i}', 'subject': 'Lengua' if i < 28 else 'Inglés', 'kind': 'Ficha'} for i in range(30)]}}
        row.data = state
        db.commit()
    _, other = seed_user(factory, email='other-teacher@example.com', product_codes=('PROFESOR_PARTICULAR',))
    first = web.get(f'/admin/profesor-users/{teacher}/materials', headers=headers).json()
    second = web.get(f'/admin/profesor-users/{teacher}/materials?page=2', headers=headers).json()
    assert len(first['materials']) == 25 and len(second['materials']) == 5
    assert not {m['id'] for m in first['materials']} & {m['id'] for m in second['materials']}
    filtered = web.get(f'/admin/profesor-users/{teacher}/materials?subject=Ingl%C3%A9s&q=29', headers=headers).json()
    assert filtered['total'] == 1 and filtered['materials'][0]['title'] == 'Unidad 29'
    assert web.get(f'/admin/profesor-users/{other}', headers=headers).json()['counts']['library'] == 0
    assert web.get(f'/admin/profesor-users/{other}/materials', headers=headers).json()['total'] == 0
    assert web.get(f'/admin/profesor-users/{teacher}/materials?page=0', headers=headers).status_code == 422


def test_logins_are_real_auth_events_not_refreshes_or_every_state_read(client):
    web, factory = client
    _, teacher = seed_user(factory, product_codes=('PROFESOR_PARTICULAR',))
    assert login(web, password='incorrect').status_code == 401
    assert login(web).status_code == 200
    assert web.post('/auth/refresh').status_code == 200
    for _ in range(3):
        assert web.get('/api/state?app=profesor_particular').status_code == 200
    with factory() as db:
        user = db.get(User, UUID(teacher))
        issue_login_response(user, Response(), db=db, method='google')
        events = list(db.scalars(select(AuditLog).where(AuditLog.actor_user_id == user.id)))
        assert [e.log_metadata['method'] for e in events if e.action == 'profesor_login'] == ['password','google']
        assert len([e for e in events if e.action == 'profesor_activity']) == 1
        assert all(not {'ip','url','user_agent','prompt'} & e.log_metadata.keys() for e in events)


def test_diagnostic_retention_and_counts_do_not_depend_on_visible_event_limit(client):
    web, factory, teacher, headers = setup(client)
    with factory() as db:
        user = db.get(User, UUID(teacher))
        for i in range(60):
            db.add(AuditLog(actor_user_id=user.id, organization_id=user.organization_id,
                entity_type='user',entity_id=teacher,action='profesor_login',log_metadata={'method':'google'},created_at=utcnow()-timedelta(hours=i)))
        for action,days in [('profesor_login',91),('profesor_activity',91),('profesor_account_viewed',181),('profesor_catalog_viewed',181),('user_updated',181)]:
            db.add(AuditLog(actor_user_id=user.id,organization_id=user.organization_id,entity_type='user',entity_id=teacher,
                action=action,log_metadata={},created_at=utcnow()-timedelta(days=days)))
        db.commit()
        prune_diagnostics(db);db.commit()
        assert db.scalar(select(AuditLog.id).where(AuditLog.action=='user_updated')) is not None
    data = web.get(f'/admin/profesor-users/{teacher}',headers=headers).json()
    assert data['activity']['logins_7d'] == 61
    assert len(data['activity']['events']) == 50
    with factory() as db:
        assert db.scalar(select(AuditLog.id).where(AuditLog.action=='profesor_login',AuditLog.created_at < utcnow()-timedelta(days=90))) is None
    assert web.delete(f'/admin/users/{teacher}',headers=headers).status_code == 200
    with factory() as db:
        assert db.scalar(select(AuditLog.id).where(AuditLog.entity_id == teacher,AuditLog.action.in_(['profesor_login','profesor_activity','profesor_account_viewed','profesor_catalog_viewed']))) is None
