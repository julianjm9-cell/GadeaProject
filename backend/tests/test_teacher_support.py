import json
from uuid import uuid4
from sqlalchemy import select, func
from test_access_control import client, login, seed_user
from test_teacher_generator import setup
from app.models import License, UsageRecord
from app.services.teacher_temario import topic_catalog

URL='/api/profesor/support?app=profesor_particular'
def premium(factory):
    with factory() as db:
        lic=db.scalar(select(License).where(License.product_code=='PROFESOR_PARTICULAR'))
        lic.plan='PROFESOR_PREMIUM'
        db.commit()
def request():
    return dict(course='3.º ESO',subject='Matemáticas',mode='new',question='Explica ecuaciones con ejemplos',request_id=str(uuid4()))
def generated():
    return next(iter(topic_catalog().values()))

def test_support_premium_and_idempotency(client,monkeypatch):
    web,factory,calls=setup(client,monkeypatch,json.dumps(generated()))
    body=request()
    assert web.post(URL,json=body).status_code==403
    assert not calls
    premium(factory)
    for _ in range(2):
        response=web.post(URL,json=body)
        assert response.status_code==200,response.text
        assert response.json()['topic']['didactic']['practice']
    assert len(calls)==1
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord))==1
    body['question']='otra petición'
    assert web.post(URL,json=body).status_code==409

def test_support_invalid_no_charge(client,monkeypatch):
    web,factory,calls=setup(client,monkeypatch,'{"title":"incompleto"}')
    premium(factory)
    assert web.post(URL,json=request()).status_code==502
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord))==0

def test_personal_topics_pdf_and_normal_lock(client):
    web,factory=client
    seed_user(factory,product_codes=('PROFESOR_PARTICULAR',))
    assert login(web).status_code==200
    topic={**generated(),'id':'personal-test','personal':True,'sourceId':None}
    state={'version':2,'personalTopics':[topic]}
    assert web.post('/api/state?app=profesor_particular',json=state).status_code==403
    premium(factory)
    response=web.post('/api/state?app=profesor_particular',json=state)
    assert response.status_code==200,response.text
    for resource in ('scheme','examples','practice'):
        r=web.post('/api/profesor/temario/export-pdf?app=profesor_particular',json={'topic_id':'personal-test','resource':resource})
        assert r.status_code==200,r.text
        assert r.content.startswith(b'%PDF')
    assert web.post('/api/profesor/temario/export-pdf?app=profesor_particular',json={'topic_id':'another-account-topic','resource':'scheme'}).status_code==404

def test_support_bad_input_before_provider(client,monkeypatch):
    web,factory,calls=setup(client,monkeypatch,json.dumps(generated()))
    premium(factory)
    body=request();body['mode']='improve'
    assert web.post(URL,json=body).status_code==422
    body=request();body['question']=''
    assert web.post(URL,json=body).status_code==422
    assert not calls

def test_support_script_is_served(client):
    web,_=client
    response=web.get('/profesor-support.js')
    assert response.status_code==200
    assert 'supportWorkspace' in response.text

def test_personal_topic_format_pdf():
    from app.services.teacher_temario import formatted_topic_text, render_topic_pdf
    topic=generated().copy()
    topic['explanation']='**Clave** y *detalle* con ~~énfasis~~ y [color]{purple}.\n## Apartado\nx^2 + 3/4'
    markup=formatted_topic_text(topic['explanation'])
    assert '<b>Clave</b>' in markup
    assert '<i>detalle</i>' in markup
    assert '<u>énfasis</u>' in markup
    assert 'color="#7951be"' in markup
    assert render_topic_pdf(topic,'scheme').startswith(b'%PDF')

def test_support_repairs_invalid_response_without_second_charge(client,monkeypatch):
    import httpx
    from app.api import app_routes
    web,factory,calls=setup(client,monkeypatch)
    premium(factory)
    async def recover(self,url,**kw):
        calls.append(kw['json'].copy())
        content='{"title":"tema truncado",' if len(calls)==1 else json.dumps(generated())
        return httpx.Response(200,json={'choices':[{'message':{'content':content}}],'usage':{'prompt_tokens':20,'completion_tokens':30}})
    monkeypatch.setattr(app_routes.httpx.AsyncClient,'post',recover)
    body=request()
    response=web.post(URL,json=body)
    assert response.status_code==200,response.text
    assert len(calls)==2
    assert calls[0]['response_format']=={'type':'json_object'}
    assert 'Repara el JSON' in calls[1]['messages'][-1]['content']
    assert len(calls[1]['messages']) == 3
    assert not any(item['role'] == 'assistant' for item in calls[1]['messages'])
    assert web.post(URL,json=body).status_code==200
    assert len(calls)==2
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord))==1

def test_support_accepts_json_with_surrounding_text():
    from app.services.teacher_support import parse_topic
    content=json.dumps({'topic':generated()})
    assert parse_topic('Aquí está el tema:\n```json\n'+content+'\n```')['title']==generated()['title']

def test_support_rejects_placeholder_solution():
    from fastapi import HTTPException
    from app.services.teacher_support import parse_topic
    topic=json.loads(json.dumps(generated()))
    topic['didactic']['practice'][0]['answer']='Respuesta abierta.'
    try:
        parse_topic(json.dumps(topic))
    except HTTPException as exc:
        assert exc.status_code==502
    else:
        raise AssertionError('Una solución provisional no debe publicarse como tema terminado.')

def test_support_model_without_json_mode(client,monkeypatch):
    import httpx
    from app.api import app_routes
    web,factory,calls=setup(client,monkeypatch)
    premium(factory)
    async def compatible(self,url,**kw):
        body=kw['json'];calls.append(body.copy())
        if 'response_format' in body:
            return httpx.Response(400,json={'error':{'message':'response_format not supported'}})
        return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps(generated())}}]})
    monkeypatch.setattr(app_routes.httpx.AsyncClient,'post',compatible)
    assert web.post(URL,json=request()).status_code==200
    assert len(calls)==2
    assert 'response_format' not in calls[1]
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord))==1


def test_compact_context_and_budget(client, monkeypatch):
    from app.api import app_routes
    web, factory, calls = setup(client, monkeypatch, json.dumps(generated()))
    premium(factory)
    monkeypatch.setattr(app_routes, 'chat_provider_config', lambda *a, **kw: ('key', 'https://example.test', 'groq'))
    monkeypatch.setattr(app_routes, 'chat_model_for_purpose', lambda *a: 'openai/gpt-oss-120b')
    body = request(); body.update(mode='improve', topic=generated())
    assert web.post(URL, json=body).status_code == 200
    sent = calls[0]
    assert sent['max_tokens'] == 3000 and sent['reasoning_effort'] == 'low'
    topic = json.loads(sent['messages'][1]['content'])['topic']
    assert 'solutions' not in topic['didactic'] and 'example' not in topic
    assert topic['didactic']['practice'] == generated()['didactic']['practice']
    body['request_id'] = str(uuid4())
    body['topic'] = json.loads(json.dumps(generated()))
    body['topic']['didactic']['deepDive'] = 'x' * 15000
    assert web.post(URL, json=body).status_code == 422
    assert len(calls) == 1


def test_rate_limit_wait_and_no_charge(client, monkeypatch):
    import httpx
    from app.api import app_routes
    from app.services import teacher_support
    web, factory, calls = setup(client, monkeypatch)
    premium(factory)
    waits = []
    async def sleep(seconds): waits.append(seconds)
    monkeypatch.setattr(teacher_support.asyncio, 'sleep', sleep)
    async def limited(self, url, **kw):
        calls.append(kw['json'].copy())
        return httpx.Response(429, headers={'Retry-After': '2.5'})
    monkeypatch.setattr(app_routes.httpx.AsyncClient, 'post', limited)
    response = web.post(URL, json=request())
    assert response.status_code == 429 and response.headers['Retry-After'] == '3'
    assert waits == [3] and len(calls) == 2
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord)) == 0
    calls.clear(); waits.clear()
    async def long_wait(self, url, **kw):
        calls.append(kw['json'])
        return httpx.Response(429, headers={'Retry-After': '65'})
    monkeypatch.setattr(app_routes.httpx.AsyncClient, 'post', long_wait)
    response = web.post(URL, json=request())
    assert response.status_code == 429 and response.headers['Retry-After'] == '65'
    assert len(calls) == 1 and not waits


def test_rate_limit_recovery_single_charge(client, monkeypatch):
    import httpx
    from app.api import app_routes
    from app.services import teacher_support
    web, factory, calls = setup(client, monkeypatch)
    premium(factory)
    async def sleep(seconds): pass
    monkeypatch.setattr(teacher_support.asyncio, 'sleep', sleep)
    async def recover(self, url, **kw):
        calls.append(kw['json'].copy())
        if len(calls) == 1: return httpx.Response(429, headers={'Retry-After': '1'})
        return httpx.Response(200, json={'choices':[{'message':{'content':json.dumps(generated())}}]})
    monkeypatch.setattr(app_routes.httpx.AsyncClient, 'post', recover)
    assert web.post(URL, json=request()).status_code == 200
    assert len(calls) == 2
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1
