from copy import deepcopy
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
import json

import pytest
from fastapi import HTTPException
from sqlalchemy import select, func

from test_access_control import client, login, seed_user
from test_teacher_generator import setup
from app.models import AppSetting, ClientState, License, User, UsageRecord
from app.services import profesor_entitlements as plans

STATE = '/api/state?app=profesor_particular'


def students(count):
    return {'students': [{'id': str(index), 'name': 'Alumno ' + str(index), 'notes': 'Conservar'} for index in range(count)],
            'library': [{'id': 'material', 'title': 'Conservar material'}]}


def save(web, value):
    return web.post(STATE, json=value, headers={'If-Match': web.get(STATE).headers['etag']})


def set_plan(factory, value):
    with factory() as db:
        db.scalar(select(License)).plan = value
        db.commit()


def body(kind='hangman'):
    return {'request_id': str(uuid4()), 'course': '3.º ESO', 'subject': 'Lengua', 'topic': 'Vocabulario', kind: 1}


def test_normal_three_students_and_premium_more_without_data_loss(client):
    web, factory = client
    seed_user(factory, product_codes=('PROFESOR_PARTICULAR',)); login(web)
    assert save(web, students(3)).status_code == 200
    rejected = save(web, students(4))
    assert rejected.status_code == 403 and rejected.json()['detail']['code'] == 'student_limit'
    assert len(web.get(STATE).json()['students']) == 3
    set_plan(factory, 'PROFESOR_PREMIUM')
    assert save(web, students(5)).status_code == 200
    set_plan(factory, 'PROFESOR_FREE')
    edited = students(5); edited['students'][0]['notes'] = 'Nota nueva'
    assert save(web, edited).status_code == 200
    assert save(web, students(6)).status_code == 403
    replaced = deepcopy(edited); replaced['students'][-1]['id'] = 'nuevo'
    assert save(web, replaced).status_code == 403
    assert web.get(STATE).json()['students'] == edited['students']
    assert web.get(STATE).json()['library'] == edited['library']
    assert save(web, students(3)).status_code == 200


def test_daily_advanced_allowance_shared_reused_and_manual_saves_free(client, monkeypatch):
    web, factory, calls = setup(client, monkeypatch, json.dumps({'questions': [
        {'type': 'hangman', 'prompt': 'Capital de España.', 'answer': 'Madrid'}]}))
    endpoint = '/api/profesor/entitlements?app=profesor_particular'
    assert web.get(endpoint).json()['advanced_ai']['remaining'] == 1
    request = body()
    for _ in range(2):
        assert web.post('/api/profesor/generate?app=profesor_particular', json=request).status_code == 200
    assert len(calls) == 1
    assert web.get(endpoint).json()['advanced_ai']['remaining'] == 0
    for kind in plans.ADVANCED_TYPES:
        response = web.post('/api/profesor/generation/start?app=profesor_particular', json=body(kind))
        assert response.status_code == 403, response.text
        assert response.json()['detail']['code'] == 'advanced_daily_limit'
    regeneration = body()
    regeneration['regenerate'] = {'question': {'type': 'hangman', 'prompt': 'Capital de España.', 'answer': 'Madrid'}}
    assert web.post('/api/profesor/generation/start?app=profesor_particular', json=regeneration).status_code == 403
    # Editing/saving manually created advanced content does not use AI quota.
    data = students(1)
    data['library'][0]['activity'] = {'questions': [{'type': 'hangman', 'answer': 'Madrid'}]}
    assert save(web, data).status_code == 200
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1


def test_failed_advanced_generation_releases_allowance_and_retry_counts_once(client, monkeypatch):
    web, factory, calls = setup(client, monkeypatch, '{"questions":[]}')
    request = body()
    assert web.post('/api/profesor/generate?app=profesor_particular', json=request).status_code == 502
    assert web.get('/api/profesor/entitlements?app=profesor_particular').json()['advanced_ai']['remaining'] == 1
    with factory() as db:
        quota = db.scalar(select(AppSetting).where(AppSetting.key.startswith('profesor_advanced_quota:')))
        assert 'pending_request_id' not in json.loads(quota.value)
    async def success(*args, **kwargs):
        import httpx
        return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps({'questions': [
            {'type': 'hangman', 'prompt': 'Capital de España.', 'answer': 'Madrid'}]})}}]})
    from app.api import app_routes
    monkeypatch.setattr(app_routes.httpx.AsyncClient, 'post', success)
    assert web.post('/api/profesor/generate?app=profesor_particular', json=request).status_code == 200
    assert web.get('/api/profesor/entitlements?app=profesor_particular').json()['advanced_ai']['remaining'] == 0


def test_premium_has_no_daily_allowance_and_sessions_stay_premium(client, monkeypatch):
    web, factory, calls = setup(client, monkeypatch, json.dumps({'questions': [
        {'type': 'hangman', 'prompt': 'Capital de España.', 'answer': 'Madrid'}]}))
    assert web.get('/api/profesor/material-sessions?app=profesor_particular').status_code == 403
    set_plan(factory, 'PROFESOR_PREMIUM')
    for _ in range(3):
        assert web.post('/api/profesor/generate?app=profesor_particular', json=body()).status_code == 200
    assert len(calls) == 3
    limits = web.get('/api/profesor/entitlements?app=profesor_particular').json()
    assert limits['student_limit'] is None and limits['advanced_ai']['remaining'] is None
    assert web.get('/api/profesor/material-sessions?app=profesor_particular').status_code == 200


def test_background_generation_uses_same_quota_and_completed_attempt_is_recoverable(client, monkeypatch):
    web, factory, _ = setup(client, monkeypatch, json.dumps({'questions': [
        {'type': 'hangman', 'prompt': 'Capital de España.', 'answer': 'Madrid'}]}))
    request = body()
    endpoint = '/api/profesor/generation/start?app=profesor_particular'
    assert web.post(endpoint, json=request).status_code == 200
    assert web.get('/api/profesor/generation/' + request['request_id'] + '?app=profesor_particular').json()['status'] == 'completed'
    assert web.post(endpoint, json=request).json()['status'] == 'completed'
    assert web.post(endpoint, json=body()).status_code == 403
    assert web.post('/api/profesor/generate?app=profesor_particular', json=request).status_code == 200
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1
        quota = db.scalar(select(AppSetting).where(AppSetting.key.startswith('profesor_advanced_quota:')))
        assert 'pending_request_id' not in json.loads(quota.value)


def test_quota_midnight_madrid_dst_reservations_and_account_isolation(client, monkeypatch):
    _, factory = client
    _, first = seed_user(factory, product_codes=('PROFESOR_PARTICULAR',))
    _, second = seed_user(factory, email='second@example.com', product_codes=('PROFESOR_PARTICULAR',))
    clock = datetime(2026, 10, 24, 21, 59, 59, tzinfo=timezone.utc)  # 23:59 Madrid
    monkeypatch.setattr(plans, 'now', lambda: clock)
    with factory() as db:
        user = db.get(User, UUID(first)); lic = db.scalar(select(License).where(License.user_id == user.id))
        plans.reserve(db, user, lic, {'memory': 1}, 'first'); db.commit()
        with pytest.raises(HTTPException) as busy:
            plans.reserve(db, user, lic, {'sentence': 1}, 'second')
        assert busy.value.status_code == 409
        db.rollback()
        plans.complete(db, user, lic, {'memory': 1}, 'first'); db.commit()
        assert plans.limits(db, user, lic)['advanced_ai']['remaining'] == 0
        other = db.get(User, UUID(second))
        assert plans.limits(db, other, lic)['advanced_ai']['remaining'] == 1
        clock += timedelta(seconds=1)
        assert plans.limits(db, user, lic)['advanced_ai']['remaining'] == 1
        assert plans.limits(db, user, lic)['advanced_ai']['reset_at'] == '2026-10-26T00:00:00+01:00'
        plans.reserve(db, user, lic, {'timeline': 1}, 'second')
        plans.release(db, user, 'first'); db.commit()
        assert json.loads(db.get(AppSetting, 'profesor_advanced_quota:' + first).value)['pending_request_id'] == 'second'


def test_basic_ai_not_limited_by_advanced_daily_use(client, monkeypatch):
    web, factory, calls = setup(client, monkeypatch)
    with factory() as db:
        user = db.scalar(select(User)); lic = db.scalar(select(License))
        plans.reserve(db, user, lic, {'memory': 1}, 'used')
        plans.complete(db, user, lic, {'memory': 1}, 'used'); db.commit()
    for _ in range(2):
        assert web.post('/api/profesor/generate?app=profesor_particular', json=body('gaps')).status_code == 200
    assert len(calls) == 2
