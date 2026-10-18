import json
from datetime import timedelta
from uuid import UUID, uuid4
import httpx
import asyncio
from sqlalchemy import select
from fastapi.testclient import TestClient
from test_access_control import client, seed_user, login
from test_profesor_student_access import premium
from test_teacher_generation_recovery import payload
from app.main import app
from app.models import User, License, ProfesorEditorDraft, ProfesorGenerationJob, ProviderCall
from app.models.core import utcnow
from app.services.operation_health import heartbeat, signals


def test_private_drafts_are_bounded_expire_and_never_change_saved_material(client):
    web,factory=client
    _,uid=seed_user(factory,product_codes=('PROFESOR_PARTICULAR',));login(web)
    body={'title':'Sin terminar','material':{'id':'m1','activity':{'questions':[{'type':'gaps','prompt':'','answer':''}]}},'fields':[{'id':'q-0','value':'Aún incompleto'}]}
    ids=[str(uuid4()) for _ in range(6)]
    for draft in ids:assert web.post('/api/profesor/editor-drafts/'+draft,json=body).status_code==200
    assert len(web.get('/api/profesor/editor-drafts').json()['drafts'])==5
    assert web.get('/api/profesor/editor-drafts/'+ids[0]).status_code==404
    assert web.get('/api/profesor/editor-drafts/'+ids[-1]).json()['draft']==body
    assert not web.get('/api/state?app=profesor_particular').json().get('library')
    seed_user(factory,email='other@example.com',product_codes=('PROFESOR_PARTICULAR',));login(web,email='other@example.com')
    assert web.get('/api/profesor/editor-drafts/'+ids[-1]).status_code==404
    assert web.post('/api/profesor/editor-drafts/'+ids[-1],json=body).status_code==404
    login(web)
    with factory() as db:
        db.get(ProfesorEditorDraft,UUID(ids[-1])).expires_at=utcnow()-timedelta(seconds=1);db.commit()
    assert web.get('/api/profesor/editor-drafts/'+ids[-1]).status_code==404
    assert web.post('/api/profesor/editor-drafts/'+ids[-2]+'/discard',json={}).status_code==200
    assert web.get('/api/profesor/editor-drafts/'+ids[-2]).status_code==404


def test_eighty_questions_can_be_shared_answered_and_polled_without_full_payload(client):
    web,factory=client
    _,uid=seed_user(factory,product_codes=('PROFESOR_PARTICULAR',));premium(factory,uid);login(web)
    questions=[{'id':str(i),'type':'gaps','prompt':f'Pregunta {i}: ___','answer':'x','options':[]} for i in range(80)]
    assert web.post('/api/state?app=profesor_particular',json={'library':[{'id':'long','title':'Ochenta preguntas','activity':{'questions':questions}}]}).status_code==200
    session=web.post('/api/profesor/material-sessions',json={'material_id':'long'}).json()['session']
    assert len(session['questions'])==80
    with TestClient(app) as pupil:
        assert pupil.post('/auth/profesor/student-join',json={'code':session['join_code']}).status_code==200
        url='/api/profesor/student-material-sessions/'+session['id']+'/move'
        assert pupil.post(url,json={'action':'start'}).status_code==200
        result=pupil.post(url,json={'action':'check','question_index':79,'value':'x'})
        assert result.status_code==200 and result.json()['feedback']=='correct'
        revision=result.json()['revision']
        assert pupil.post(url,json={'action':'heartbeat'}).json()['revision']==revision
        watch=web.get('/api/profesor/material-sessions/'+session['id'],params={'since_revision':revision}).json()
        assert watch['unchanged'] and 'session' not in watch and 'questions' not in watch


def test_all_generation_entrypoints_respect_admission_and_recovery_acknowledgement(client):
    web,factory=client
    _,uid=seed_user(factory,product_codes=('PROFESOR_PARTICULAR',));login(web)
    _,other=seed_user(factory,email='busy@example.com',product_codes=('PROFESOR_PARTICULAR',))
    with factory() as db:
        lic=db.scalar(select(License).where(License.user_id==UUID(uid)))
        organization_id,license_id=lic.organization_id,lic.id
        other_license=db.scalar(select(License).where(License.user_id==UUID(other)))
        for _ in range(3):db.add(ProfesorGenerationJob(user_id=UUID(other),organization_id=other_license.organization_id,license_id=other_license.id,request_id=str(uuid4()),payload={},status='running',updated_at=utcnow()))
        db.commit()
    for endpoint in ['/api/profesor/generate?app=profesor_particular','/api/profesor/generation/start?app=profesor_particular']:
        response=web.post(endpoint,json=payload('pasapalabra',3))
        assert response.status_code==503 and response.headers.get('retry-after')=='15'
    request_id=str(uuid4())
    with factory() as db:
        job=ProfesorGenerationJob(user_id=UUID(uid),organization_id=organization_id,license_id=license_id,request_id=request_id,payload={'topic':'Recuperable'},status='completed',result={'questions':[]})
        db.add(job);db.commit()
    assert request_id in [row['request_id'] for row in web.get('/api/profesor/generation-inbox').json()['jobs']]
    url='/api/profesor/generation/'+request_id+'/incorporated'
    assert web.post(url,json={}).status_code==409
    assert web.post('/api/state?app=profesor_particular',json={'library':[{'id':'saved','generationRequestId':request_id}]}).status_code==200
    assert web.post(url,json={}).status_code==200
    assert request_id not in [row['request_id'] for row in web.get('/api/profesor/generation-inbox').json()['jobs']]


def test_operational_signals_distinguish_unknown_costs_and_worker_health(client):
    web,factory=client
    _,uid=seed_user(factory,product_codes=('PROFESOR_PARTICULAR',));login(web)
    assert web.get('/admin/operations-health').status_code==403
    with factory() as db:
        user=db.get(User,UUID(uid));heartbeat(db,'worker');heartbeat(db,'backups')
        db.add(ProviderCall(user_id=user.id,organization_id=user.organization_id,request_id=str(uuid4()),provider='groq',model='test',status_code=503,duration_ms=100,created_at=utcnow()))
        db.commit();result=signals(db)
        assert result['ai']['unpriced_calls']==1
        assert 'unpriced_provider_calls' in [row['code'] for row in result['alerts']]
        assert 'worker_heartbeat' not in [row['code'] for row in result['alerts']]


def test_malformed_and_oversized_state_cannot_replace_saved_content(client, monkeypatch):
    from app.config import get_settings
    web,factory=client
    seed_user(factory,product_codes=('PROFESOR_PARTICULAR',));login(web)
    assert web.post('/api/state?app=profesor_particular',json={'students':[{'id':'keep','name':'Prueba'}]}).status_code==200
    etag=web.get('/api/state?app=profesor_particular').headers['etag']
    assert web.post('/api/state?app=profesor_particular',headers={'If-Match':etag},json={'students':['invalid']}).status_code==422
    monkeypatch.setattr(get_settings(),'max_state_bytes',100000)
    assert web.post('/api/state?app=profesor_particular',headers={'If-Match':etag},json={'students':[{'id':'keep','notes':'x'*100001}]}).status_code==413
    assert web.get('/api/state?app=profesor_particular').json()['students'][0]['id']=='keep'


def test_provider_meter_counts_failed_calls_separately_from_credits(client, monkeypatch):
    from app.services.provider_metering import context
    from app.services.teacher_generator import generation_post
    from app.config import get_settings
    web,factory=client
    _,uid=seed_user(factory,product_codes=('PROFESOR_PARTICULAR',))
    with factory() as db:
        user=db.get(User,UUID(uid));owner={'bind':db.get_bind(),'user_id':user.id,'organization_id':user.organization_id,'request_id':str(uuid4())}
    monkeypatch.setattr(get_settings(),'ai_model_prices_json',json.dumps({'meter-test':{'input':1,'output':2}}))
    async def no_wait(_):pass
    monkeypatch.setattr('app.services.teacher_generator.asyncio.sleep',no_wait)
    class Fake:
        calls=0
        async def post(self,*args,**kwargs):
            self.calls+=1
            return httpx.Response(503,json={'error':'busy'}) if self.calls==1 else httpx.Response(200,json={'usage':{'prompt_tokens':100,'completion_tokens':20}})
    async def run():
        token=context.set(owner)
        try:return await generation_post(Fake(),'https://api.groq.com/test',headers={},json={'model':'meter-test'})
        finally:context.reset(token)
    assert asyncio.run(run()).status_code==200
    with factory() as db:
        rows=list(db.scalars(select(ProviderCall).order_by(ProviderCall.created_at)))
        assert [row.status_code for row in rows]==[503,200]
        assert rows[0].estimated_usd is None and float(rows[1].estimated_usd)==0.00014


def test_body_limits_preserve_existing_document_uploads(client, monkeypatch, tmp_path):
    import base64
    from app.api import app_routes
    web,factory=client
    seed_user(factory,product_codes=('PROFESOR_PARTICULAR',));login(web)
    monkeypatch.setattr(app_routes,'LOCAL_DOCUMENT_DIR',tmp_path)
    raw=b'Apuntes de prueba\n'*60000
    response=web.post('/api/profesor/materials',json={'filename':'apuntes.txt','base64':base64.b64encode(raw).decode()})
    assert response.status_code==200,response.text
    assert web.get('/api/profesor/materials/'+response.json()['id']).content==raw
