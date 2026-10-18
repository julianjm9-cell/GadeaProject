from uuid import UUID, uuid4
import importlib.util
from pathlib import Path
from unittest.mock import patch
from sqlalchemy import func, select
from test_access_control import client, login, seed_user
from app.models import AuditLog, ClientState, License, ProfesorNotification, ProfesorNotificationRecipient, User
from app.api.profesor_notifications import recipients


def setup(client):
    web, factory = client
    _, teacher = seed_user(factory, product_codes=('PROFESOR_PARTICULAR',))
    teacher_headers = {'Authorization': 'Bearer '+login(web).json()['access_token']}
    _, other = seed_user(factory, email='other@example.com', product_codes=('PROFESOR_PARTICULAR',))
    other_headers = {'Authorization': 'Bearer '+login(web, email='other@example.com').json()['access_token']}
    seed_user(factory, email='different-app@example.com')
    seed_user(factory, email='blocked@example.com', user_active=False, product_codes=('PROFESOR_PARTICULAR',))
    seed_user(factory, email='admin@example.com', role='superadmin')
    admin_headers = {'Authorization': 'Bearer '+login(web, email='admin@example.com').json()['access_token']}
    return web, factory, UUID(teacher), UUID(other), teacher_headers, other_headers, admin_headers


def send(web, admin, **changes):
    payload = {'send_key': str(uuid4()), 'title': 'Nuevos juegos', 'body': 'Ya puedes crear más actividades.\nDisfrútalas.'}
    payload.update(changes)
    result = web.post('/admin/profesor-notifications', headers=admin, json=payload)
    assert result.status_code == 200, result.text
    return payload, result.json()


def test_broadcast_private_persistent_read_and_independent_dismissal(client):
    web, factory, teacher, other, a, b, admin = setup(client)
    with factory() as db:
        db.add(ClientState(user_id=teacher, organization_id=db.get(User, teacher).organization_id,
            data={'private': 'unchanged'}, profesor_revision=3))
        db.commit()
    payload, delivery = send(web, admin)
    assert delivery['delivered'] == 2
    path = '/api/profesor/notifications'
    for headers in (a, b):
        listing = web.get(path, headers=headers)
        assert listing.status_code == 200
        assert listing.headers['cache-control'] == 'private, no-store'
        assert listing.json()['unread'] == 1
        assert listing.json()['messages'][0]['body'] == payload['body']
    assert web.post(path+'/read', headers=a, json={'ids': [delivery['id']]}).json() == {'total': 1, 'unread': 0}
    assert web.get(path, headers=a).json()['messages'][0]['read'] is True
    assert web.get(path+'/summary', headers=b).json()['unread'] == 1
    for _ in range(2):
        assert web.post(path+'/'+delivery['id']+'/dismiss', headers=a).json() == {'total': 0, 'unread': 0}
    assert web.get(path, headers=a).json()['messages'] == []
    assert web.get(path, headers=b).json()['total'] == 1
    assert web.post(path+'/'+str(uuid4())+'/dismiss', headers=a).status_code == 404
    with factory() as db:
        saved = db.scalar(select(ClientState).where(ClientState.user_id == teacher))
        assert saved.data == {'private': 'unchanged'} and saved.profesor_revision == 3
        assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == 'profesor_notification_sent')) == 1
    # The unread marker and deletion survive a fresh authentication.
    fresh = {'Authorization': 'Bearer '+login(web).json()['access_token']}
    assert web.get(path, headers=fresh).json()['total'] == 0


def test_access_controls_and_validation(client):
    web, factory, teacher, other, a, b, admin = setup(client)
    assert web.get('/admin/profesor-notifications', headers=a).status_code == 403
    assert web.post('/admin/profesor-notifications', headers=a, json={'title': 'x'}).status_code == 403
    foreign = {'Authorization': 'Bearer '+login(web, email='different-app@example.com').json()['access_token']}
    assert web.get('/api/profesor/notifications', headers=foreign).status_code == 402
    assert web.get('/api/profesor/notifications', headers={'Authorization': 'Bearer invalid'}).status_code == 401
    for title, body in [('   ', 'body'), ('a'*121, 'body'), ('title', 'x'*3001), ('title', 'bad\x00text')]:
        assert web.post('/admin/profesor-notifications', headers=admin, json={'send_key': str(uuid4()), 'title': title, 'body': body}).status_code == 422
    assert web.post('/admin/profesor-notifications', headers={**admin, 'Origin': 'https://untrusted.invalid'}, json={'send_key': str(uuid4()), 'title': 'x', 'body': 'y'}).status_code == 403


def test_idempotent_send_and_account_audience(client):
    web, factory, teacher, other, a, b, admin = setup(client)
    with factory() as db:
        license_obj = db.scalar(select(License).where(License.user_id == teacher))
        # Organization-level and repeated licenses do not duplicate recipients.
        db.add(License(organization_id=license_obj.organization_id, user_id=None, product_code='PROFESOR_PARTICULAR',
            plan='PROFESOR_NORMAL', status='active', starts_at=license_obj.starts_at, expires_at=license_obj.expires_at, usage_limit=0))
        db.commit()
        assert len(list(db.scalars(recipients()))) == 2
    payload, result = send(web, admin)
    retried = web.post('/admin/profesor-notifications', headers=admin, json=payload).json()
    assert retried == {**result, 'reused': True}
    assert web.post('/admin/profesor-notifications', headers=admin, json={**payload, 'title': 'Otro contenido'}).status_code == 409
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(ProfesorNotification)) == 1
        assert db.scalar(select(func.count()).select_from(ProfesorNotificationRecipient)) == 2
    history = web.get('/admin/profesor-notifications', headers=admin).json()
    assert history['recipients'] == 2 and history['messages'][0]['delivered'] == 2
    # Future accounts do not receive broadcasts sent before their registration.
    seed_user(factory, email='future@example.com', product_codes=('PROFESOR_PARTICULAR',))
    future = {'Authorization': 'Bearer '+login(web, email='future@example.com').json()['access_token']}
    assert web.get('/api/profesor/notifications', headers=future).json()['messages'] == []
    assert web.post('/api/profesor/notifications/'+result['id']+'/dismiss', headers=future).status_code == 404
    assert web.get('/api/profesor/notifications?before='+result['id'], headers=future).status_code == 404
    assert web.post('/api/profesor/notifications/read', headers=future, json={'ids': [result['id']]}).json() == {'total': 0, 'unread': 0}


def test_paging_and_statistics_preserve_read_messages(client):
    web, factory, teacher, other, a, b, admin = setup(client)
    ids = [send(web, admin, title='Aviso '+str(i))[1]['id'] for i in range(5)]
    path = '/api/profesor/notifications'
    first = web.get(path+'?limit=2', headers=a).json()
    second = web.get(path+'?limit=2&before='+first['next'], headers=a).json()
    third = web.get(path+'?limit=2&before='+second['next'], headers=a).json()
    assert [m['id'] for page in (first, second, third) for m in page['messages']] == ids[::-1]
    assert third['next'] is None
    web.post(path+'/read', headers=a, json={'ids': ids})
    assert web.get(path, headers=a).json()['total'] == 5
    history = web.get('/admin/profesor-notifications', headers=admin).json()
    assert all(m['read'] == 1 and m['delivered'] == 2 for m in history['messages'])


def test_migration_and_assets_are_packaged(client):
    web, factory = client
    root = Path(__file__).resolve().parents[2]
    file = root/'backend/alembic/versions/0024_profesor_notifications.py'
    spec = importlib.util.spec_from_file_location('notification_migration', file)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    with factory() as db, patch.object(module.op, 'get_bind', return_value=db.get_bind()):
        module.upgrade()  # A repeated upgrade remains safe.
        module.upgrade()
    for url in ('/profesor-notifications.js', '/assets/profesor-notifications.css'):
        assert web.get(url).status_code == 200


def test_account_deletion_removes_only_its_recipient_records(client):
    web, factory, teacher, other, a, b, admin = setup(client)
    send(web, admin)
    assert web.delete('/admin/users/'+str(teacher), headers=admin).status_code == 200
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(ProfesorNotificationRecipient).where(ProfesorNotificationRecipient.user_id == teacher)) == 0
        assert db.scalar(select(func.count()).select_from(ProfesorNotification)) == 1
    assert web.get('/api/profesor/notifications', headers=b).json()['total'] == 1
