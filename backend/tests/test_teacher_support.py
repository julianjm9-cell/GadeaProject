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
