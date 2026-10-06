import json
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import select, func

from test_access_control import client, seed_user, login
from app.api import app_routes
from app.models import UsageRecord, Conversation
from app.services.teacher_generator import generator_context, generation_batches, parse_material, generation_response_format
from app.services.teacher_question_quality import arithmetic


def context(kind, **kwargs):
    _, data = generator_context(dict(request_id=str(uuid4()), course='3.º ESO', subject='Matemáticas', topic='Operaciones',
                                    **{kind: 1}, activitySizes={kind: 3}, extent='short', **kwargs))
    return generation_batches(data)[0][0]


def parse(question, kind=None, batch=None):
    return parse_material(json.dumps({'questions': [question]}, ensure_ascii=False), batch or {**context(kind or question['type']), kind or question['type']: 1})[0]


def quiz():
    return dict(type='quiz', prompt='¿Cuánto es 3 × 4?', answer='12', options=['7', '12', '34'],
                explanation='Son tres grupos de cuatro unidades.',
                optionFeedback=[dict(option='7', explanation='Has sumado los factores; aquí se multiplican.'),
                                dict(option='12', explanation='Tres grupos de cuatro suman doce.'),
                                dict(option='34', explanation='Juntar las cifras no equivale a multiplicar.')])


def test_specific_feedback_and_distractors_checked():
    q = quiz()
    assert parse(q)['optionFeedback'] == q['optionFeedback']
    q['optionFeedback'][0]['option'] = 'otra opción'
    with pytest.raises(HTTPException): parse(q)
    q = quiz(); q.update(prompt='Calcula 1 / 2.', answer='0.5', options=['0.5', '1/2', '2']); q.pop('optionFeedback')
    with pytest.raises(HTTPException) as exc: parse(q)
    assert 'equivalente' in exc.value.detail
    q = quiz(); q.update(prompt='Elige el pronombre personal.', answer='tú', options=['tú', 'tu'], explanation='El pronombre personal lleva tilde.', optionFeedback=[dict(option='tú', explanation='Es un pronombre personal.'), dict(option='tu', explanation='Es un determinante posesivo.')])
    assert parse(q)['answer'] == 'tú'
    q = quiz(); q.update(prompt='Calcula 1 / 2.', answer=r'\(\frac{1}{2}\)', options=[r'\(\frac{1}{2}\)', '2'], explanation='Es la mitad de una unidad.'); q.pop('optionFeedback')
    assert parse(q)['answer'] == q['answer']


def test_new_clients_require_specific_reasons_and_preserve_legacy_format():
    q = quiz(); q.pop('optionFeedback')
    batch = {**context('quiz'), 'quiz': 1, 'qualityVersion': 1}
    with pytest.raises(HTTPException) as exc: parse(q, batch=batch)
    assert 'corrección específica' in exc.value.detail
    assert parse(q)['answer'] == '12'  # Older clients and saved materials stay supported.
    for value in (True, '1', 2):
        with pytest.raises(HTTPException): context('quiz', qualityVersion=value)


def test_boolean_arithmetic_and_compound_units_are_not_misread():
    q = dict(type='boolean', prompt='2 + 2 = 5', answer='Verdadero', options=['Verdadero', 'Falso'], explanation='Dos más dos son cuatro.')
    with pytest.raises(HTTPException): parse(q)
    q['answer'] = 'Falso'
    assert parse(q)['answer'] == 'Falso'
    q = dict(type='numeric', prompt='Un móvil recorre 20 m en 10 s. Responde en m/s.', answer='2', unit='m/s', calculation='20/10', explanation='Divide distancia entre tiempo.')
    assert parse(q)['unit'] == 'm/s'


def test_reasoning_equalities_are_checked_and_false_examples_remain_possible():
    q = quiz(); q['explanation'] = '11/28 simplifica a 1/2.'
    with pytest.raises(HTTPException) as exc: parse(q)
    assert 'simplificación incorrecta' in exc.value.detail
    q['explanation'] = '40% = 2/5 y 3/8 = 0.375. Un resultado aproximado es 1/3 ≈ 0.33.'
    assert parse(q)['answer'] == '12'
    q['optionFeedback'][1]['explanation'] = 'Correcto: 3 × 4 = 14.'
    with pytest.raises(HTTPException): parse(q)
    q['optionFeedback'][1]['explanation'] = 'Correcto: 3 × 4 = 12.'
    q['optionFeedback'][0]['explanation'] = 'Error: 3 × 4 = 7 es un ejemplo incorrecto; has sumado.'
    assert parse(q)['answer'] == '12'
    q['explanation'] = 'Una ecuación diferente es x^2 = 4 o x + 2 = 4; una raíz es √9 = 3.'
    assert parse(q)['answer'] == '12'
    q['explanation'] = '3/8 = 0.375 y 0.375\u202f×\u202f100 = 37.5.'
    assert parse(q)['answer'] == '12'
    q['explanation'] = '3/8 = 37.5% y 0.375 × 100 = 37.5%.'
    assert parse(q)['answer'] == '12'


def test_exact_population_percentages_cannot_round_people():
    q = quiz(); q.update(prompt='En una clase hay 28 alumnos. El 40% son chicas. ¿Cuántas chicas hay?')
    with pytest.raises(HTTPException) as exc: parse(q)
    assert 'fracción de persona' in exc.value.detail
    q['prompt'] = 'En una clase hay 30 alumnos. El 40% son chicas. ¿Cuántas chicas hay?'
    assert parse(q)['answer'] == '12'


def test_cloze_explanation_follows_locator_order():
    batch = context('multigaps')
    q = dict(type='multigaps', prompt='Completa.', answer='Completado', explanation='Contrasta acciones terminadas y habituales.',
             clozeText='Ayer fui al parque. Siempre jugaba allí. Después volví a casa.',
             clozeGaps=[dict(fragment='Después volví', answer='volví', infinitive='volver', explanation='Después introduce un hecho terminado.'),
                        dict(fragment='Ayer fui', answer='fui', infinitive='ir', explanation='Ayer sitúa la acción en un día terminado.'),
                        dict(fragment='Siempre jugaba', answer='jugaba', infinitive='jugar', explanation='Siempre presenta una costumbre.')])
    result = parse(q, batch=batch)
    assert result['options'] == ['fui', 'jugaba', 'volví']
    assert result['itemExplanations'] == [q['clozeGaps'][i]['explanation'] for i in (1, 2, 0)]
    q['clozeGaps'][0]['explanation'] = ''
    with pytest.raises(HTTPException): parse(q, batch=batch)


def test_numeric_calculation_rounding_and_units():
    q = dict(type='numeric', prompt='Tres lápices cuestan 1,25 euros cada uno. Responde en euros.', answer='3,75',
             explanation='Multiplica cantidad y precio unitario.', calculation='3 * 1.25', unit='€')
    assert parse(q)['calculation'] == '3 * 1.25'
    q['answer'] = '3.25'
    with pytest.raises(HTTPException): parse(q)
    q.update(answer='3.75', unit='cm')
    with pytest.raises(HTTPException) as exc: parse(q)
    assert 'unidad' in exc.value.detail
    q.update(prompt='Calcula 1 / 3.', answer='0.33', calculation='1/3', unit='', tolerance=0.005)
    assert parse(q)['tolerance'] == 0.005
    q['tolerance'] = 0
    with pytest.raises(HTTPException): parse(q)
    # No guesswork: an ordinary factual number is not treated as a calculation.
    q.update(prompt='¿Cuántos lados tiene un hexágono?', answer='6', calculation='')
    assert parse(q)['answer'] == '6'


@pytest.mark.parametrize('expression', ['__import__("os")', 'sum([2,3])', '2**1000000', '1/0', 'nan', '(2).__class__', '1e999'])
def test_arithmetic_does_not_execute_or_accept_unbounded_expressions(expression):
    with pytest.raises((ValueError, SyntaxError, ZeroDivisionError)): arithmetic(expression)


def test_unambiguous_word_clues_and_schema():
    q = dict(type='hangman', prompt='La palabra es triángulo.', answer='triángulo', explanation='Tiene tres lados.')
    with pytest.raises(HTTPException): parse(q)
    for kind in ('quiz', 'boolean', 'classify'):
        schema = generation_response_format(context(kind), 'groq', 'openai/gpt-oss-120b')['json_schema']['schema']['properties']['questions']['items']
        assert 'optionFeedback' in schema['required']
    schema = generation_response_format(context('multigaps'), 'groq', 'openai/gpt-oss-120b')['json_schema']['schema']['properties']['questions']['items']
    assert 'explanation' in schema['properties']['clozeGaps']['items']['required']


def regeneration(kind='quiz', **extra):
    source = quiz() if kind == 'quiz' else dict(type='reading', prompt='¿Dónde pasea Ana?', answer='En el parque.', text='Ana pasea por el parque cada tarde.', options=[], explanation='El texto señala el lugar.')
    return dict(request_id=str(uuid4()), course='3.º ESO', subject='Matemáticas', topic='Operaciones', extent='short',
                regenerate=dict(question={**source, 'activityGroup': 2}, siblings=[dict(type='quiz', prompt='¿Cuánto es 2 + 2?', answer='4')], instructions='Otro ejemplo con más contexto.'), **extra)


def test_regeneration_is_one_question_with_unchanged_shared_reading():
    body = regeneration('reading'); _, data = generator_context(body)
    batch, group = generation_batches(data)[0]
    assert group == 2 and batch['reading'] == batch['batchQuestionCount'] == 1
    assert batch['readingPassage'] == body['regenerate']['question']['text']
    q = dict(type='reading', prompt='¿Con qué frecuencia pasea Ana?', answer='Cada tarde.', text='', options=[], explanation='Cada tarde expresa la frecuencia.', rubric='Identifica la frecuencia.')
    assert parse(q, batch=batch)['text'] == body['regenerate']['question']['text']
    q['text'] = 'La IA ha cambiado el texto.'
    with pytest.raises(HTTPException): parse(q, batch=batch)
    body['regenerate']['question']['type'] = 'imagepoint'
    with pytest.raises(HTTPException) as exc: generator_context(body)
    assert exc.value.status_code == 422


def test_regeneration_keeps_categories_and_pairs_unique_in_their_group():
    body = regeneration()
    body['regenerate']['question'] = dict(type='classify', activityGroup=2, prompt='Gato', answer='Animal', options=['Animal', 'Planta'], explanation='Es un animal.')
    _, data = generator_context(body); batch, _ = generation_batches(data)[0]
    q = dict(type='classify', prompt='Rosa', answer='Planta', options=['Animal', 'Planta'], explanation='Es una planta.')
    assert parse(q, batch=batch)['options'] == ['Animal', 'Planta']
    q.update(options=['Ser vivo', 'Objeto'], answer='Ser vivo')
    with pytest.raises(HTTPException): parse(q, batch=batch)
    body['regenerate']['question'] = dict(type='pairs', activityGroup=2, prompt='Primer concepto', answer='20', options=[], explanation='Explicación original.')
    body['regenerate']['siblings'] = [dict(type='pairs', activityGroup=2, prompt='Otra pregunta', answer='10')]
    _, data = generator_context(body); batch, _ = generation_batches(data)[0]
    q = dict(type='pairs', prompt='Nuevo concepto', answer='10', options=[], explanation='Nueva relación específica.')
    with pytest.raises(HTTPException): parse(q, batch=batch)
    body['regenerate']['siblings'][0]['activityGroup'] = 1
    _, data = generator_context(body); batch, _ = generation_batches(data)[0]
    assert parse(q, batch=batch)['answer'] == '10'


def test_metadata_only_improvement_is_allowed_and_answer_in_hint_is_not():
    body = regeneration(); _, data = generator_context(body); batch, _ = generation_batches(data)[0]
    q = quiz(); q['optionFeedback'][0]['explanation'] = 'Sumar 3 y 4 cuenta cantidades sueltas, no tres grupos de cuatro.'
    assert parse(q, batch=batch)['optionFeedback'][0] == q['optionFeedback'][0]
    q = dict(type='hangman', prompt='Objeto donde se guardan y consultan libros.', answer='biblioteca', options=[], explanation='Organiza libros para consulta o préstamo.', hints=['La respuesta es biblioteca.'])
    with pytest.raises(HTTPException) as exc: parse(q, batch={**context('hangman'), 'hangman': 1, 'qualityVersion': 1})
    assert 'pista revela' in exc.value.detail


def setup(client, monkeypatch, fail=False):
    web, factory = client
    seed_user(factory, product_codes=('PROFESOR_PARTICULAR',)); login(web)
    monkeypatch.setattr(app_routes, 'chat_provider_config', lambda *a, **kw: ('test-key', 'https://example.test', 'groq'))
    monkeypatch.setattr(app_routes, 'chat_model_for_purpose', lambda *a: 'openai/gpt-oss-120b')
    sent = []
    class Fake:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass
        async def post(self, url, **kw):
            batch = json.loads(kw['json']['messages'][1]['content']); sent.append(batch)
            q = quiz(); q.update(prompt='¿Cuánto es 4 × 3?', explanation='Cuatro grupos de tres dan doce unidades.')
            if fail: q['answer'] = '7'
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps({'questions': [q]})}}]})
    monkeypatch.setattr(app_routes.httpx, 'AsyncClient', Fake)
    return web, factory, sent


def test_single_regeneration_cached_billed_once_and_original_not_mutated(client, monkeypatch):
    web, factory, sent = setup(client, monkeypatch)
    body = regeneration(); original = json.dumps(body)
    for _ in range(2):
        response = web.post('/api/profesor/generate?app=profesor_particular', json=body)
        assert response.status_code == 200, response.text
        assert len(response.json()['questions']) == 1
        assert response.json()['questions'][0]['activityGroup'] == 2
    assert len(sent) == 1 and json.dumps(body) == original
    assert sent[0]['previousPrompts'] == ['¿Cuánto es 2 + 2?']
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1
    body['regenerate']['instructions'] = 'Otra dificultad.'
    assert web.post('/api/profesor/generate?app=profesor_particular', json=body).status_code == 409


def test_failed_regeneration_and_duplicate_do_not_charge(client, monkeypatch):
    web, factory, sent = setup(client, monkeypatch, fail=True)
    response = web.post('/api/profesor/generate?app=profesor_particular', json=regeneration())
    assert response.status_code == 502 and len(sent) == 3
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(UsageRecord)) == 0
        assert db.scalar(select(func.count()).select_from(Conversation)) == 0
    _, batch_context = generator_context(regeneration())
    batch, _ = generation_batches(batch_context)[0]
    q = quiz(); q['prompt'] = '¿Cuánto es 2 + 2?'
    q.update(answer='4', options=['3', '4'], optionFeedback=[dict(option='3', explanation='Falta una unidad.'), dict(option='4', explanation='Dos más dos son cuatro.')])
    with pytest.raises(HTTPException) as exc: parse(q, batch=batch)
    assert 'repite' in exc.value.detail
