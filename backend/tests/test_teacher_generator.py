import json
from uuid import uuid4
import httpx
import pytest
from sqlalchemy import select, func
from test_access_control import client, seed_user, login
from app.api import app_routes
from app.models import UsageRecord


def setup(client, monkeypatch, content=None):
    web, factory = client
    seed_user(factory, product_codes=('PROFESOR_PARTICULAR',))
    assert login(web).status_code == 200
    monkeypatch.setattr(app_routes, 'chat_provider_config', lambda *a, **kw: ('test-key','https://example.test','openai'))
    monkeypatch.setattr(app_routes, 'chat_model_for_purpose', lambda *a: 'configured-model')
    calls=[]
    class FakeClient:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self,*a): pass
        async def post(self,url,**kw):
            calls.append(kw['json'])
            return httpx.Response(200,json={'choices':[{'message':{'content':content or json.dumps({'questions':[{'type':'gaps','prompt':'2 + 2 = ___','answer':'4','options':[]}]})}}]})
    monkeypatch.setattr(app_routes.httpx,'AsyncClient',FakeClient)
    return web,factory,calls

def request():
    return dict(request_id=str(uuid4()),course='4 Primaria',subject='Matemáticas',topic='Sumas',theme='Animales',duration=15,pairs=0,gaps=1,quiz=0)

def test_generate_charge_once_and_context_conflict(client,monkeypatch):
    web,factory,calls=setup(client,monkeypatch)
    body=request()
    for _ in range(2):
        r=web.post('/api/profesor/generate?app=profesor_particular',json=body)
        assert r.status_code==200,r.text
        assert r.json()['questions'][0]['answer']=='4'
    assert len(calls)==1
    assert calls[0]['model']=='configured-model'
    assert 'studentId' not in json.loads(calls[0]['messages'][1]['content'])
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord))==1
    body['topic']='Restas'
    assert web.post('/api/profesor/generate?app=profesor_particular',json=body).status_code==409

def test_invalid_output_no_charge(client,monkeypatch):
    web,factory,calls=setup(client,monkeypatch,content='{"questions":[]}')
    assert web.post('/api/profesor/generate?app=profesor_particular',json=request()).status_code==502
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord))==0

def test_invalid_counts_no_provider(client,monkeypatch):
    web,factory,calls=setup(client,monkeypatch)
    body=request();body['gaps']=99
    assert web.post('/api/profesor/generate?app=profesor_particular',json=body).status_code==422
    assert not calls


def test_course_guidance_and_learning_focus_reach_model_without_student_identifier(client, monkeypatch):
    web, _, calls = setup(client, monkeypatch)
    body = request()
    body['course'] = '3.º ESO'
    body['focus'] = 'Necesita reforzar los cambios de signo.'
    response = web.post('/api/profesor/generate?app=profesor_particular', json=body)
    assert response.status_code == 200, response.text
    context = json.loads(calls[0]['messages'][1]['content'])
    assert context['course'] == '3.º ESO'
    assert 'ESO final' in context['levelGuidance']
    assert context['focus'] == 'Necesita reforzar los cambios de signo.'
    assert 'studentId' not in context

def test_requires_login(client):
    web,_=client
    assert web.post('/api/profesor/generate?app=profesor_particular',json=request()).status_code in (401,403)


def test_expired_access_can_refresh_before_generation(client, monkeypatch):
    web, _, calls = setup(client, monkeypatch)
    web.cookies.delete('diplomator_access')
    assert web.post('/api/profesor/generate?app=profesor_particular',json=request()).status_code == 401
    assert web.post('/auth/refresh').status_code == 200
    assert web.post('/api/profesor/generate?app=profesor_particular',json=request()).status_code == 200
    assert len(calls) == 1

def test_insufficient_balance_no_provider(client,monkeypatch):
    from app.models import User, License
    web,factory,calls=setup(client,monkeypatch)
    with factory() as db:
        user=db.scalar(select(User))
        lic=db.scalar(select(License));lic.usage_limit=1
        app_routes.record_usage(db,user,'test',0,0,'PROFESOR_PARTICULAR',1)
        db.commit()
    assert web.post('/api/profesor/generate?app=profesor_particular',json=request()).status_code==402
    assert not calls

def test_timeout_no_charge(client,monkeypatch):
    web,factory,calls=setup(client,monkeypatch)
    async def timeout(*args,**kwargs): raise httpx.ReadTimeout('test')
    monkeypatch.setattr(app_routes.httpx.AsyncClient,'post',timeout)
    assert web.post('/api/profesor/generate?app=profesor_particular',json=request()).status_code==504
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord))==0

def test_wrong_product(client):
    web,factory=client
    seed_user(factory,product_codes=('DIPLOMATOR',));login(web)
    assert web.post('/api/profesor/generate?app=diplomator',json=request()).status_code==403

def parse_format_groups(questions):
    """Cover every format in a separate one-type material request."""
    from app.services.teacher_generator import generator_context, parse_material, TYPES
    result = []
    for question in questions:
        data = request(); data.update({kind: int(question['type'] == kind) for kind in TYPES})
        _, context = generator_context(data)
        result.extend(parse_material(json.dumps({'questions': [question]}), context))
    return result


def test_all_basic_formats_validation():
    questions=[dict(type='pairs',prompt='Plumas',answer='Pájaro'),dict(type='gaps',prompt='2 + 2 = ___',answer='4'),dict(type='quiz',prompt='Mamífero',answer='Delfín',options=['Delfín','Pájaro']),dict(type='short',prompt='Explica',answer='Respuesta orientativa'),dict(type='order',prompt='Ordena',answer='Secuencia',options=['Primero','Después','Finalmente']),dict(type='classify',prompt='Gato',answer='Mamífero',options=['Mamífero','Ave']),dict(type='boolean',prompt='2 + 2 = 4',answer='Verdadero',options=['Verdadero','Falso']),dict(type='reading',text='Ana tiene un gato.',prompt='¿Qué tiene Ana?',answer='Un gato'),dict(type='problem',prompt='Tres cajas con dos libros cada una.',answer='3 × 2 = 6 libros')]
    result=parse_format_groups(questions)
    assert len(result)==9
    assert result[4]['answer']=='Primero → Después → Finalmente'
    questions[7]['text']=''
    with pytest.raises(Exception):parse_format_groups(questions)

def test_game_formats_and_invalid_memory():
    from fastapi import HTTPException
    questions=[
        dict(type='flashcard',prompt='Gato en inglés',answer='Cat'),
        dict(type='memory',prompt='Relaciona',answer='Completado',options=['Gato | Cat','Perro | Dog']),
        dict(type='sentence',prompt='Construye',answer='El gato duerme',options=['El gato','duerme']),
        dict(type='timeline',prompt='Ordena',answer='Crecimiento',options=['Semilla','Brote','Planta']),
        dict(type='error',prompt='Corrige: 2 + 2 = 5',answer='2 + 2 = 4'),
    ]
    result=parse_format_groups(questions)
    assert result[2]['answer']=='El gato → duerme'
    assert result[1]['answer']=='Completado'
    questions[1]['options']=['Gato | Cat','Perro | Cat']
    with pytest.raises(HTTPException):parse_format_groups(questions)


def test_timeline_rejects_invented_years_for_language_processes():
    from fastapi import HTTPException
    from app.services.teacher_generator import generator_context, parse_material, TYPES
    data = request()
    data.update({kind: 0 for kind in TYPES})
    data.update(subject='Inglés', topic='Voz pasiva en la producción de una película', timeline=1,
                activitySizes={'timeline': 3})
    _, context = generator_context(data)
    question = dict(type='timeline', prompt='Arrange the steps in making a film.', answer='Completado',
                    options=['1938 – The script was written.', '1939 – The actors were cast.',
                             '1940 – The film was released.'], explanation='The production stages follow one another.')
    with pytest.raises(HTTPException, match='sin inventar años'):
        parse_material(json.dumps({'questions': [question]}), context)
    question['options'] = ['The script was written.', 'The actors were cast.', 'The film was released.']
    assert len(parse_material(json.dumps({'questions': [question]}), context)) == 1
    question['options'][-1] = 'The film was awarded the Best Picture Oscar.'
    with pytest.raises(HTTPException, match='no implica ganar un premio'):
        parse_material(json.dumps({'questions': [question]}), context)


def test_timeline_allows_named_historical_events_with_dates():
    from fastapi import HTTPException
    from app.services.teacher_generator import generator_context, parse_material, TYPES
    data = request()
    data.update({kind: 0 for kind in TYPES})
    data.update(subject='Geografía e Historia', topic='Segunda Guerra Mundial', timeline=1,
                activitySizes={'timeline': 3})
    _, context = generator_context(data)
    question = dict(type='timeline', prompt='Ordena tres hitos de la Segunda Guerra Mundial.', answer='Completado',
                    options=['1945 – Alemania se rinde.', '1939 – Alemania invade Polonia.',
                             '1941 – Japón ataca Pearl Harbor.'], explanation='Los hechos se ordenan por año.')
    result = parse_material(json.dumps({'questions': [question]}), context)
    assert [item[:4] for item in result[0]['options']] == ['1939', '1941', '1945']
    context['instructions'] = 'Ordena los hechos sin fechas.'
    with pytest.raises(HTTPException, match='sin inventar años'):
        parse_material(json.dumps({'questions': [question]}), context)


def test_puzzle_formats_are_validated_before_charging(client, monkeypatch):
    from fastapi import HTTPException
    questions=[
        dict(type='wordsearch',prompt='Encuentra los animales',answer='Completado',options=['GATO','PATO','RANA']),
        dict(type='crossword',prompt='Completa el crucigrama',answer='Completado',options=['GATO | Felino','PATO | Ave acuática','RATA | Roedor']),
        dict(type='dragdrop',prompt='Une cada animal con su grupo',answer='Completado',options=['Gato | Mamífero','Pato | Ave','Rana | Anfibio']),
    ]
    assert len(parse_format_groups(questions))==3
    questions[1]['options']=['GATO | Felino','PERRO | Canino','BUHO | Ave']
    with pytest.raises(HTTPException):parse_format_groups(questions)
    questions[1]['options']=['GATO | Felino','PATO | Ave acuática','RATA | Roedor']
    questions[2]['options']=['Gato | Mamífero','Pato | Ave','Gato | Ave']
    with pytest.raises(HTTPException):parse_format_groups(questions)


def test_puzzle_generation_charges_only_for_valid_board(client, monkeypatch):
    questions=[dict(type='wordsearch',prompt='Encuentra los animales',answer='Completado',options=['GATO','PATO','RANA'])]
    web,factory,_=setup(client,monkeypatch,content=json.dumps({'questions':questions}))
    body=request();body.update(gaps=0,wordsearch=1)
    result=web.post('/api/profesor/generate?app=profesor_particular',json=body)
    assert result.status_code==200,result.text
    assert [q['type'] for q in result.json()['questions']]==['wordsearch']
    with factory() as db:assert db.scalar(select(func.count()).select_from(UsageRecord))==1


def test_extended_activity_formats_are_validated():
    from fastapi import HTTPException
    questions = [
        dict(type='multigaps', prompt='El agua pasa de ___ a ___.', answer='líquido | sólido', options=['líquido', 'sólido']),
        dict(type='numeric', prompt='¿Cuánto es 25 ÷ 2?', answer='12,5'),
        dict(type='pasapalabra', prompt='Completa la rueda', answer='Completado', options=['A | Líquido esencial | agua', 'B | Lugar con libros | biblioteca', 'C | Pigmento verde | clorofila']),
        dict(type='hangman', prompt='Estrella del sistema solar', answer='Sol'),
    ]
    result = parse_format_groups(questions)
    assert result[0]['answer'] == 'líquido | sólido'
    assert result[1]['answer'] == '12,5'
    assert result[2]['answer'] == 'Completado'
    questions[0]['prompt'] = 'Solo hay un ___.'
    with pytest.raises(HTTPException):
        parse_format_groups(questions)



def test_visual_types_are_manual_and_not_sent_to_ai(client, monkeypatch):
    web, factory, calls = setup(client, monkeypatch)
    for kind in ('visualquiz', 'imagepoint'):
        body = request()
        body[kind] = 1
        response = web.post('/api/profesor/generate?app=profesor_particular', json=body)
        assert response.status_code == 422
        assert 'manualmente' in response.json()['detail']
    assert not calls
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(UsageRecord)) == 0


def test_teaching_metadata_repeated_answers_and_shared_destinations():
    questions = [
        dict(type='multigaps', prompt='Uno más uno es ___ y cuatro entre dos es ___.', answer='2 | 2', options=['2~dos', '2~dos'], explanation='Ambas operaciones dan dos.', hints=['Piensa en dos objetos.']),
        dict(type='numeric', prompt='Una mitad en decimal', answer='0.5', unit='L', tolerance=0.001),
        dict(type='dragdrop', prompt='Agrupa', answer='Completado', options=['Gato | Mamífero','Perro | Mamífero','Pato | Ave']),
    ]
    result = parse_format_groups(questions)
    assert result[0]['hints'] == ['Piensa en dos objetos.']
    assert result[1]['unit'] == 'L'
    assert result[1]['tolerance'] == 0.001
    assert len(result[2]['options']) == 3
    for bad in ['NaN', 'Infinity', '-Infinity']:
        questions[1]['answer'] = bad
        with pytest.raises(Exception): parse_format_groups(questions)
    questions[1]['answer'] = '0.5'
    questions[0]['hints'] = ['x' * 301]
    with pytest.raises(Exception): parse_format_groups(questions)


def test_pasapalabra_full_alphabet_and_letter_validation():
    from app.services.teacher_generator import generator_context, parse_material, TYPES
    data = request(); data.update({key: 0 for key in TYPES}); data['pasapalabra'] = 1
    _, context = generator_context(data)
    # Contract boundary, not educational content: all 27 letters must round-trip.
    rows = [f'{letter} | Escribe esta letra | {letter}' for letter in 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ']
    question = dict(type='pasapalabra', prompt='Identifica las letras', answer='Completado', options=rows)
    assert len(parse_material(json.dumps({'questions': [question]}), context)[0]['options']) == 27
    rows[0] = 'A | Estrella del sistema solar | sol'
    with pytest.raises(Exception): parse_material(json.dumps({'questions': [question]}), context)
