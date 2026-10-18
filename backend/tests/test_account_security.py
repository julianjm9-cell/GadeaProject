from datetime import timedelta
from uuid import UUID
import pytest
from sqlalchemy import select, text
from test_access_control import client, seed_user, login
from app.api import auth
from app.models import User, License, AccountToken, AuthSession
from app.models.core import utcnow
from app.security.tokens import create_token


@pytest.fixture
def mailbox(monkeypatch):
    sent = []
    monkeypatch.setattr(auth.get_settings(), 'smtp_host', 'smtp.invalid')
    monkeypatch.setattr(auth.get_settings(), 'smtp_from', 'app@example.com')
    monkeypatch.setattr(auth, 'send_account_mail', lambda email, token, purpose: sent.append((email,token,purpose)))
    return sent


def test_new_accounts_need_mailbox_ownership_and_owner_chosen_password(client, mailbox):
    web, factory = client
    payload={'email':'owner@example.com','full_name':'Owner','password':'RegistrantPassword1'}
    response=web.post('/auth/profesor/register',json=payload)
    assert response.status_code==201 and response.json()['verification_required']
    assert 'access_token' not in response.text
    assert web.post('/auth/login',json=payload).status_code==403
    with factory() as db:
        assert db.query(License).count()==0
        assert db.query(AccountToken).one().token_hash!=mailbox[-1][1]
    token=mailbox[-1][1]
    assert web.post('/auth/account/verify',json={'token':token,'new_password':'OwnerPassword123'}).status_code==200
    assert web.post('/auth/account/verify',json={'token':token,'new_password':'OwnerPassword123'}).status_code==400
    assert login(web,email=payload['email'],password=payload['password']).status_code==401
    assert login(web,email=payload['email'],password='OwnerPassword123').status_code==200
    with factory() as db:
        assert db.query(License).one().plan=='PROFESOR_FREE'


def test_google_claim_revokes_prior_unverified_password_and_sessions(client):
    web,factory=client
    _,user_id=seed_user(factory,product_codes=('PROFESOR_PARTICULAR',))
    old=login(web).json()
    with factory() as db:
        user=auth.get_or_create_google_user(db,{'email':'cliente@example.com','sub':'verified-owner','email_verified':True},('PROFESOR_PARTICULAR',))
        assert str(user.id)==user_id
        db.commit()
    assert login(web).status_code==401
    assert web.get('/auth/me',headers={'Authorization':'Bearer '+old['access_token']}).status_code==401
    assert web.post('/auth/refresh',params={'refresh_token':old['refresh_token']}).status_code==401


def test_password_logout_rotation_and_admin_changes_revoke_sessions(client):
    web,factory=client
    _,user_id=seed_user(factory,product_codes=('PROFESOR_PARTICULAR',))
    first=login(web).json()
    assert web.post('/auth/change-password',json={'current_password':'temporal123','new_password':'ChangedPassword123'}).status_code==200
    assert web.get('/auth/me',headers={'Authorization':'Bearer '+first['access_token']}).status_code==401
    assert web.post('/auth/refresh',params={'refresh_token':first['refresh_token']}).status_code==401
    fresh=login(web,password='ChangedPassword123').json()
    rotated=web.post('/auth/refresh',params={'refresh_token':fresh['refresh_token']})
    assert rotated.status_code==200
    assert web.post('/auth/refresh',params={'refresh_token':fresh['refresh_token']}).status_code==401
    assert web.post('/auth/logout').status_code==200
    assert web.get('/auth/me',headers={'Authorization':'Bearer '+rotated.json()['access_token']}).status_code==401
    assert web.post('/auth/refresh',params={'refresh_token':rotated.json()['refresh_token']}).status_code==401
    seed_user(factory,role='superadmin',email='admin@example.com')
    token=login(web,password='ChangedPassword123').json()['access_token']
    admin=login(web,email='admin@example.com').json()['access_token']
    assert web.patch('/admin/users/'+user_id,headers={'Authorization':'Bearer '+admin},json={'password':'AdminNewPassword123'}).status_code==200
    assert web.get('/auth/me',headers={'Authorization':'Bearer '+token}).status_code==401


def test_recovery_expiry_and_logout_all_preserve_data(client, mailbox):
    web,factory=client
    _,user_id=seed_user(factory,product_codes=('PROFESOR_PARTICULAR',))
    token=login(web).json()['access_token']
    assert web.post('/api/state?app=profesor_particular',json={'students':[{'id':'kept','name':'Test'}]}).status_code==200
    for email in ['missing@example.com','cliente@example.com']:
        assert web.post('/auth/account/request-link',json={'email':email}).json()['message'].startswith('Si el correo')
    reset=mailbox[-1][1]
    assert web.post('/auth/account/reset-password',json={'token':reset,'new_password':'RecoveredPassword123'}).status_code==200
    assert web.post('/auth/account/reset-password',json={'token':reset,'new_password':'RecoveredPassword123'}).status_code==400
    assert web.get('/auth/me',headers={'Authorization':'Bearer '+token}).status_code==401
    assert login(web,password='RecoveredPassword123').status_code==200
    assert web.get('/api/state?app=profesor_particular').json()['students'][0]['id']=='kept'
    assert web.post('/auth/logout-all').status_code==200
    assert web.get('/auth/me').status_code==401
    assert web.post('/auth/account/request-link',json={'email':'cliente@example.com'}).status_code==200
    with factory() as db:
        row=db.scalar(select(AccountToken).where(AccountToken.user_id==UUID(user_id)))
        row.expires_at=utcnow()-timedelta(minutes=1);db.commit()
    assert web.post('/auth/account/reset-password',json={'token':mailbox[-1][1],'new_password':'OtherPassword123'}).status_code==400


def test_host_privacy_legacy_tokens_and_encrypted_oauth(client):
    web,factory=client
    _,uid=seed_user(factory,product_codes=('PROFESOR_PARTICULAR',))
    login(web)
    assert 'private' in web.get('/api/state?app=profesor_particular').headers['cache-control']
    assert web.get('/api/state?app=profesor_particular',headers={'Host':'untrusted.invalid/path'}).status_code==400
    old=create_token(UUID(uid),'access',timedelta(minutes=5))
    assert web.get('/auth/me',headers={'Authorization':'Bearer '+old}).status_code==401
    with factory() as db:
        user=db.get(User,UUID(uid));user.drive_refresh_token='private-provider-token';db.commit()
        raw=db.execute(text('SELECT drive_refresh_token FROM users')).scalar_one()
        assert raw.startswith('enc:v1:') and 'private-provider-token' not in raw
        db.expire_all();assert db.get(User,UUID(uid)).drive_refresh_token=='private-provider-token'
