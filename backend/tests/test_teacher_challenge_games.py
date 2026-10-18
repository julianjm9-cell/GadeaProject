import json
from pathlib import Path
from uuid import uuid4, UUID
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader

from test_access_control import client
from test_profesor_material_sessions import prepare_teacher
from app.main import app
from app.api.profesor_material_sessions import prepare, grade, safe_question
from app.services.teacher_challenge_games import FIELDS, validate, safe_items
from app.services.teacher_generator import generator_context, generation_batches
from app.services.teacher_generation_contract import GenerationDraft, wire_schema
from app.services.profesor_entitlements import ADVANCED_TYPES
from app.services.teacher_pdf import render_teacher_pdf


def samples():
    return json.loads((Path(__file__).resolve().parents[2] / 'apps/profesor/tests/fixtures/challenge-games.json').read_text(encoding='utf-8'))


@pytest.mark.parametrize('index', range(4))
def test_generation_contract_recovers_elements_and_keeps_playable_content(index):
    q = samples()[index];kind = q['type']
    _, context = generator_context({'request_id':str(uuid4()), 'course':'3.º ESO', 'subject':'Ciencias Naturales', 'topic':'Ciencias', kind:1, 'activitySizes':{kind:len(q['options'])}})
    batch = generation_batches(context, content_contract=2)[0][0]
    draft = GenerationDraft(batch)
    schema = wire_schema(draft.request_context())['properties']['questions']['items']['properties']
    assert set(schema['entries']['items']['properties']) == set(FIELDS[kind])
    entries = [dict(zip(FIELDS[kind], [part.strip() for part in row.split('|')])) for row in q['options']]
    first = entries[:2] + [{field:'' for field in FIELDS[kind]}]
    payload = {'type':kind,'prompt':q['prompt'],'explanation':q['explanation'],'entries':first}
    assert draft.ingest(json.dumps({'questions':[payload]})) == 2, draft.issues
    assert draft.request_context()['elementCount'] == len(entries)-2
    payload['entries'] = entries[2:]
    assert draft.ingest(json.dumps({'questions':[payload]})) == len(entries)-2, draft.issues
    result = draft.result()[0]
    assert result['options'] == q['options']
    assert result['answer'] == 'Completado'


@pytest.mark.parametrize('index', range(4))
def test_server_prepares_validates_and_grades_without_exposing_answers(index):
    q = prepare(samples()[index],42);kind=q['type'];items=q['_challenge']
    correct=[item['answer'] if kind in ('multiselect','race') else item['answer'].split('~')[0] for item in items]
    assert grade(q,correct)=='correct'
    assert grade(q,[])=='unanswered'
    assert grade(q,correct,-1)=='unanswered'
    wrong=[not value if type(value) is bool else 'wrong' for value in correct]
    assert grade(q,wrong)=='incorrect'
    public=safe_question(q,[q],False)
    assert 'options' not in public and all('answer' not in item for item in public['items'])
    if kind=='cipher':
        assert all(not item['letter'] for item in public['items'])
        # An unsubmitted correct answer alone cannot reveal a reward.
        assert not safe_items(q,correct,{},False)[0]['letter']
        assert safe_items(q,correct,{'0':'correct'},False)[0]['letter']=='S'
    if kind=='race':
        other=prepare(samples()[index],42)
        assert grade(other,correct)=='incorrect'


def test_invalid_content_is_rejected_and_only_the_two_advanced_games_use_daily_quota():
    for q in samples():
        with pytest.raises(ValueError):validate(q['type'],q['options'][:2])
    with pytest.raises(ValueError):validate('multiselect',['A | sí','B | sí','C | sí'])
    with pytest.raises(ValueError):validate('cipher',['Un gato | gato | A','Un ave | ave | B','Un pez | pez | C'])
    assert {'cipher','race'} <= ADVANCED_TYPES
    assert not {'multiselect','table'} & ADVANCED_TYPES
    from fastapi import HTTPException
    for size in (5, 7, 11):
        with pytest.raises(HTTPException):
            generator_context({'request_id':str(uuid4()), 'course':'3.º ESO', 'subject':'Lengua', 'topic':'Vocabulario', 'table':1, 'activitySizes':{'table':size}})


def test_table_headers_are_normalized_consistently_and_rows_cannot_contain_linebreaks():
    q=prepare({**samples()[1], 'options':['Un metro | Centímetros | 100','un metro | Milímetros | 1000','Dos metros | CENTÍMETROS | 200','dos metros | MILÍMETROS | 2000']},42)
    assert len({item['row'] for item in q['_challenge']})==2
    assert len({item['column'] for item in q['_challenge']})==2
    with pytest.raises(ValueError):
        validate('multiselect',['A\nB | sí','C | sí','D | no'])


def test_shared_progress_and_letters_survive_reload_without_trusting_client_marks(client,monkeypatch):
    import test_profesor_material_sessions as existing
    monkeypatch.setattr(existing,'material_questions',samples)
    web,factory=prepare_teacher(client)
    created=web.post('/api/profesor/material-sessions',json={'material_id':'m1'}).json()['session']
    with TestClient(app) as pupil:
        pupil.post('/auth/profesor/student-join',json={'code':created['join_code']})
        path=f"/api/profesor/student-material-sessions/{created['id']}"
        pupil.post(path+'/move',json={'action':'start'})
        from app.models import ProfesorMaterialSession
        with factory() as db:
            stored=db.get(ProfesorMaterialSession,UUID(created['id'])).material_snapshot['questions']
        for n,q in enumerate(stored):
            answers=[item['answer'] if q['type'] in ('multiselect','race') else item['answer'].split('~')[0] for item in q['_challenge']]
            if q['type']=='cipher':
                draft=pupil.post(path+'/move',json={'action':'draft','question_index':n,'value':answers})
                assert not pupil.get(path).json()['session']['questions'][n]['items'][0]['letter']
                for i in range(len(answers)):
                    checked=pupil.post(path+'/move',json={'action':'check','question_index':n,'part':i,'value':answers}).json()
                    assert checked['feedback']=='correct'
                    assert checked['session']['questions'][n]['items'][i]['letter']
                reload=pupil.get(path).json()['session']
                assert ''.join(item['letter'] for item in reload['questions'][n]['items'])=='SOL'
                answers[0]='incorrecta'
                pupil.post(path+'/move',json={'action':'draft','question_index':n,'value':answers})
                reload=pupil.get(path).json()['session']
                assert reload['questions'][n]['items'][0]['letter']==''
                assert reload['questions'][n]['items'][1]['letter']=='O'
                answers[0]='gato'
            checked=pupil.post(path+'/move',json={'action':'check','question_index':n,'value':answers}).json()
            assert checked['feedback']=='correct',checked
            assert len(checked['session']['progress']['parts'][str(n)])==len(answers)
        finished=pupil.post(path+'/move',json={'action':'finish'}).json()['session']
        assert set(finished['progress']['grades'].values())=={'correct'}
        assert all(question['solutions'] for question in finished['questions'])


def test_printable_games_do_not_leak_solutions_and_assets_are_served(client):
    material={'title':'Cuatro juegos','subject':'Ciencias','activity':{'questions':samples()}}
    def text(solutions):return '\n'.join(page.extract_text() for page in PdfReader(BytesIO(render_teacher_pdf(material,solutions,lambda _:b''))).pages)
    worksheet,answers=text(False),text(True)
    assert '1000' not in worksheet and 'gato' not in worksheet
    assert '1000' in answers and 'gato' in answers and 'Mensaje: S O L' in answers
    web,_=client
    assert 'profesorChallengeGame' in web.get('/profesor-challenge-games.js').text
    assert 'cipher-message' in web.get('/assets/profesor-challenge-games.css').text
    for kind in ('multiselect','table','cipher','race'):
        for prefix in ('','mature-'):
            image=web.get('/assets/games/'+prefix+kind+'.webp')
            assert image.status_code==200 and image.content[8:12]==b'WEBP'
    for route in ['/profesor/demo','/profesor/alumno']:
        html=web.get(route).text
        assert html.index('profesor-challenge-games.js') < html.index('profesor-live.js')
