import json
from collections import Counter
from uuid import uuid4
import pytest
from fastapi import HTTPException
from test_access_control import client
from test_teacher_generator import setup
from test_teacher_support import premium
from app.services.teacher_generator import TYPES, generator_context, parse_material
from app.services.teacher_support import parse_topic
from app.services.teacher_temario import topic_catalog


def spanish_topics():
    return [topic for topic in topic_catalog().values() if topic['subject'] == 'Español']


def test_spanish_catalogue_and_material_contracts():
    topics = spanish_topics()
    assert Counter(t['course'] for t in topics) == {level: 12 for level in ('A1','A2','B1','B2','C1','C2')}
    assert len({t['id'] for t in topics}) == 72
    for topic in topics:
        parsed = parse_topic(json.dumps(topic))
        assert len(parsed['didactic']['practice']) == 3
        questions = topic['didactic']['preparedMaterial']['questions']
        counts = Counter(q['type'] for q in questions)
        context = {kind: counts[kind] for kind in TYPES}
        clean = parse_material(json.dumps({'questions': questions}), context)
        assert len(clean) == 6
        if topic['id'] == 'espanol-b2-02':
            assert clean[0]['alternatives'] == ['tuviese']
        assert len({q['type'] for q in clean}) >= 5
        assert topic['languageContrast'][0] != topic['languageContrast'][1]
    assert any(q['type'] == 'memory' for t in topics for q in t['didactic']['preparedMaterial']['questions'])


def test_spanish_generator_guidance_and_invalid_levels(client, monkeypatch):
    payload = {'request_id':str(uuid4()),'course':'A1','subject':'Español','topic':'Saludos','gaps':1}
    _, context = generator_context(payload)
    assert 'Principiante' in context['levelGuidance']
    payload['course'] = 'C2'
    assert 'Dominio' in generator_context(payload)[1]['levelGuidance']
    payload['course'] = '3.º ESO'
    with pytest.raises(HTTPException) as error:
        generator_context(payload)
    assert error.value.status_code == 422
    web, factory, calls = setup(client, monkeypatch, json.dumps({'questions':[{'type':'gaps','prompt':'Me ___ Ana.','answer':'llamo','options':[]}]}))
    payload['course'] = 'A1'
    response = web.post('/api/profesor/generate?app=profesor_particular', json=payload)
    assert response.status_code == 200, response.text
    assert 'lengua extranjera' in json.loads(calls[0]['messages'][1]['content'])['levelGuidance']


def test_support_spanish_level_is_enforced(client, monkeypatch):
    topic = spanish_topics()[24]
    web, factory, calls = setup(client, monkeypatch, json.dumps(topic))
    premium(factory)
    body = dict(course='B1',subject='Español',mode='new',question='Explica los pasados',request_id=str(uuid4()))
    response = web.post('/api/profesor/support?app=profesor_particular',json=body)
    assert response.status_code == 200, response.text
    assert 'B1' in json.loads(calls[0]['messages'][1]['content'])['levelGuidance']
    body.update(course='3.º ESO',request_id=str(uuid4()))
    assert web.post('/api/profesor/support?app=profesor_particular',json=body).status_code == 422
    assert len(calls) == 1


def test_spanish_level_state_and_pdf_permissions(client, monkeypatch):
    web, factory, _ = setup(client, monkeypatch)
    pupil = dict(id='ele',name='Ana',course='3.º ESO',subjects=['Matemáticas','Español'],spanishLevel='B2',progress={},materialIds=[])
    assert web.post('/api/state?app=profesor_particular',json={'students':[pupil],'library':[]}).status_code == 200
    state = web.get('/api/state?app=profesor_particular').json()
    assert state['students'][0]['spanishLevel'] == 'B2'
    assert state['students'][0]['course'] == '3.º ESO'
    topic = spanish_topics()[0]
    url = '/api/profesor/temario/export-pdf?app=profesor_particular'
    assert web.post(url,json={'topic_id':topic['id'],'resource':'scheme'}).status_code == 200
    assert web.post(url,json={'topic_id':topic['id'],'resource':'practice'}).status_code == 403
    premium(factory)
    assert web.post(url,json={'topic_id':topic['id'],'resource':'practice'}).content.startswith(b'%PDF')
