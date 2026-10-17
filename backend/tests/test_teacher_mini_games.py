import json
from io import BytesIO
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader

from test_access_control import client
from test_profesor_material_sessions import prepare_teacher
from app.main import app
from app.api.profesor_material_sessions import prepare, grade, safe_question
from app.services.teacher_generator import generator_context, generation_batches, TYPES
from app.services.teacher_generation_contract import GenerationDraft, wire_schema
from app.services.teacher_mini_games import validate_mini_game
from app.services.teacher_pdf import render_teacher_pdf


def samples():
    return [
        {'id':'m','type':'mystery','prompt':'Descubre un animal doméstico.', 'answer':'Gato',
         'options':['Soy un mamífero','Soy un felino que vive en muchas casas','Me comunico maullando'],
         'explanation':'Las pistas describen un felino doméstico que maúlla.'},
        {'id':'i','type':'intruder','prompt':'¿Cuál no es un mamífero?', 'answer':'Águila',
         'options':['Gato','Perro','Águila','Delfín'], 'explanation':'El águila es un ave y los otros tres son mamíferos.'},
        {'id':'b','type':'bingo','prompt':'Relaciona cada definición con el concepto.', 'answer':'Completado',
         'options':[f'Concepto {i} | Definición número {i}' for i in range(9)],
         'explanation':'Cada concepto tiene una definición distinta.'},
    ]


@pytest.mark.parametrize('index', [0,1,2])
def test_generation_contract_accepts_all_three_and_keeps_playable_data(index):
    source = samples()[index]
    kind = source['type']
    _, context = generator_context(dict(request_id=str(uuid4()), course='3.º ESO', subject='Lengua', topic='Conceptos',
                                      activitySizes={kind:9 if kind=='bingo' else 2}, **{k:int(k==kind) for k in TYPES}))
    batch = generation_batches(context, content_contract=2)[0][0]
    if kind != 'bingo':
        # A single replacement uses the same schema as a round in a larger pack.
        batch = {**batch, kind:1}
    draft = GenerationDraft(batch)
    wire = wire_schema(draft.request_context())['properties']['questions']['items']['properties']
    assert wire['type']['enum'] == [kind]
    if kind=='bingo':
        payload = {'type':kind,'prompt':source['prompt'],'explanation':source['explanation'],
                   'entries':[{'concept':row.split('|')[0].strip(),'clue':row.split('|')[1].strip()} for row in source['options']]}
    else:
        payload = source
    assert draft.ingest(json.dumps({'questions':[payload]})) == (9 if kind=='bingo' else 1), draft.issues
    clean = draft.result()[0]
    assert clean['options'] == source['options'] and clean['answer'] == source['answer']


def test_mini_game_validation_rejects_answer_leaks_ambiguity_and_bad_boards():
    with pytest.raises(ValueError):
        validate_mini_game('mystery','Gato',['Un gato','Un animal','Un felino'])
    with pytest.raises(ValueError):
        validate_mini_game('intruder','Pera',['Pera','pera','Manzana'])
    for options in [samples()[2]['options'][:8], samples()[2]['options'][:8]+[samples()[2]['options'][0]]]:
        with pytest.raises(ValueError):
            validate_mini_game('bingo','Completado',options)
    _, context = generator_context(dict(request_id=str(uuid4()),course='3.º ESO',subject='Lengua',topic='Conceptos',bingo=1))
    assert context['activitySizes']['bingo']==9


def test_bingo_recovery_keeps_good_definitions_when_one_entry_is_invalid():
    _, context = generator_context(dict(request_id=str(uuid4()), course='3.º ESO', subject='Lengua', topic='Conceptos', bingo=1))
    batch=generation_batches(context,content_contract=2)[0][0]
    draft=GenerationDraft(batch)
    entries=[{'concept':f'Concepto {i}','clue':f'Definición número {i}'} for i in range(9)]
    entries[4]={'concept':'Repetido','clue':'Esta definición dice Repetido literalmente'}
    assert draft.ingest(json.dumps({'questions':[{'type':'bingo','prompt':'Juega al bingo.','explanation':'Asocia cada concepto.','entries':entries}]}))==8
    assert draft.request_context()['elementCount']==1
    assert draft.ingest(json.dumps({'questions':[{'type':'bingo','prompt':'Juega al bingo.','explanation':'Asocia cada concepto.','entries':[{'concept':'Concepto final','clue':'La definición que faltaba'}]}]}))==1
    assert len(draft.result()[0]['options'])==9


def test_bingo_uses_private_opaque_mapping_and_does_not_accept_foreign_tokens():
    q=prepare(samples()[2],12)
    public=safe_question(q,[q],False)
    assert 'options' not in public and 'answer' not in str(public['clues'])
    assert all(set(clue)=={'token','clue'} for clue in public['clues'])
    correct=[clue['answer'] for clue in q['_bingo']['clues']]
    assert grade(q,correct)=='correct'
    assert grade(q,['foreign']*9)=='incorrect'
    assert grade(q,correct[:3])=='unanswered'
    assert grade(q,['']*9,0)=='unanswered'
    assert safe_question(q,[q],False)==public
    other=prepare(samples()[2],12)
    assert grade(other,correct)=='incorrect'


def test_shared_mystery_intruder_and_bingo_preserve_progress_and_verified_marks(client,monkeypatch):
    import test_profesor_material_sessions as sessions_test
    monkeypatch.setattr(sessions_test,'material_questions',samples)
    web,factory=prepare_teacher(client)
    created=web.post('/api/profesor/material-sessions',json={'material_id':'m1'}).json()['session']
    with TestClient(app) as pupil:
        pupil.post('/auth/profesor/student-join',json={'code':created['join_code']})
        path=f"/api/profesor/student-material-sessions/{created['id']}"
        pupil.post(path+'/move',json={'action':'start'})
        before=pupil.get(path).json()['session']
        assert 'answer' not in before['questions'][0]
        assert 'explanation' not in before['questions'][1]
        value={'answer':'gato','cluesUsed':2}
        answer=pupil.post(path+'/move',json={'action':'check','value':value}).json()
        assert answer['feedback']=='correct' and answer['extra']['explanation']
        assert pupil.get(path).json()['session']['progress']['responses']['0']==value
        assert pupil.get(path).json()['session']['questions'][0]['explanation']==samples()[0]['explanation']
        wrong=pupil.post(path+'/move',json={'action':'check','question_index':1,'value':'Gato'}).json()
        assert wrong['feedback']=='incorrect' and not wrong.get('extra')
        assert pupil.post(path+'/move',json={'action':'check','question_index':1,'value':'Águila'}).json()['feedback']=='correct'
        from app.models import ProfesorMaterialSession
        from uuid import UUID
        with factory() as db:
            row=db.get(ProfesorMaterialSession,UUID(created['id']))
            correct=[clue['answer'] for clue in row.material_snapshot['questions'][2]['_bingo']['clues']]
        choices=['']*9
        for i in range(9):
            choices[i]=correct[i]
            # A new draft must keep previously verified cells green.
            pupil.post(path+'/move',json={'action':'draft','question_index':2,'value':choices})
            assert pupil.post(path+'/move',json={'action':'check','question_index':2,'part':i,'value':choices}).json()['feedback']=='correct'
            saved=pupil.get(path).json()['session']['progress']
            assert saved['parts']['2']=={str(n):'correct' for n in range(i+1)}
        complete=pupil.post(path+'/move',json={'action':'finish'}).json()['session']
        assert complete['progress']['grades']=={'0':'correct','1':'correct','2':'correct'}
        assert len(complete['questions'][2]['solutions'])==9


def test_new_games_export_worksheets_and_separate_solutions():
    material={'title':'Tres juegos nuevos','subject':'Lengua','activity':{'questions':samples()}}
    def text(solutions):
        return '\n'.join(page.extract_text() for page in PdfReader(BytesIO(render_teacher_pdf(material,solutions,lambda _:b''))).pages)
    worksheet,solution=text(False),text(True)
    assert 'Bingo de conceptos' in worksheet and 'Pista 3' in worksheet and 'Concepto 8' in worksheet
    assert 'Solución: Gato' not in worksheet and 'Solución: Gato' in solution


def test_new_players_and_css_are_available_in_both_entry_points(client):
    web,_=client
    assert 'profesorMiniGame' in web.get('/profesor-mini-games.js').text
    assert 'bingo-workbench' in web.get('/assets/profesor-mini-games.css').text
    for path in ['/profesor/demo','/profesor/alumno']:
        html=web.get(path).text
        assert 'profesor-mini-games.css' in html
        assert html.index('profesor-mini-games.js') < html.index('profesor-live.js')
