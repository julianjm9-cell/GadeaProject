import json
from uuid import UUID, uuid4
import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import select, func
from test_access_control import client, seed_user, login
from app.api import app_routes
from app.models import UsageRecord, Conversation, Message
from app.services.teacher_generator import generator_context, generation_batches, parse_material, generation_response_format, generation_post, rosco_chunks, ROSCO_LETTERS, TYPES


def payload(**extra):
    return dict(request_id=str(uuid4()), course='A2', subject='Español', topic='Imperfecto y pretérito perfecto simple',
                gaps=1, activitySizes={'gaps': 8}, instructions='Solo estos dos tiempos, con infinitivos entre paréntesis.', extent='standard', **extra)


def test_one_activity_uses_its_requested_size_and_bounded_batches():
    body = payload()
    body.update(activitySizes={'gaps': 8}, instructions='Más contexto, sin tiempos compuestos.')
    _, context = generator_context(body)
    batches = generation_batches(context)
    assert [(batch['gaps'], group) for batch, group in batches] == [(6,1),(2,1)]
    assert context['instructions'] == body['instructions']
    rosco = payload()
    rosco.update(gaps=0, pasapalabra=1, activitySizes={'pasapalabra': 18})
    _, rosco_context = generator_context(rosco)
    rosco_batches = generation_batches(rosco_context)
    assert [batch['elementCount'] for batch, _ in rosco_batches] == [6, 6, 6]
    assert ''.join(batch['roscoLetters'] for batch, _ in rosco_batches) == 'ABCDEFGHIJLMNOPRST'
    body.update(gaps=10, activitySizes={'gaps': 12})
    with pytest.raises(HTTPException) as exc: generator_context(body)
    assert exc.value.status_code == 422


def test_rosco_chunks_keep_every_batch_playable():
    for size in range(7, 28):
        chunks = rosco_chunks(size)
        assert ''.join(letters for _, letters in chunks) == ROSCO_LETTERS[:size]
        assert all(3 <= len(letters) <= 6 for _, letters in chunks)
    assert [letters for _, letters in rosco_chunks(9)] == ['ABC', 'DEF', 'GHI']


def test_strict_schema_rejection_retries_with_plain_json(client, monkeypatch):
    web, factory = client
    seed_user(factory, product_codes=('PROFESOR_PARTICULAR',)); login(web)
    monkeypatch.setattr(app_routes, 'chat_provider_config', lambda *args, **kw: ('test-key', 'https://example.test', 'groq'))
    monkeypatch.setattr(app_routes, 'chat_model_for_purpose', lambda *args: 'openai/gpt-oss-120b')
    formats = []

    class FakeClient:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kw):
            body = kw['json']
            formats.append(body['response_format']['type'])
            if len(formats) == 1:
                return httpx.Response(400, json={'error': {'message': 'Schema validation failed'}})
            context = json.loads(body['messages'][1]['content'])
            questions = [dict(type='gaps', prompt=f'Ayer, a las {n+1}, Ana ___ (caminar) por el parque.',
                              answer='caminaba', explanation='El imperfecto expresa una acción en curso.') for n in range(context['gaps'])]
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps({'questions': questions})}}]})

    monkeypatch.setattr(app_routes.httpx, 'AsyncClient', FakeClient)
    body = payload(); body.update(activitySizes={'gaps': 2})
    response = web.post('/api/profesor/generate?app=profesor_particular', json=body)
    assert response.status_code == 200, response.text
    assert formats == ['json_schema', 'json_object']
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1


@pytest.mark.parametrize('counts', [dict(gaps=0), dict(gaps=2), dict(gaps=4), dict(gaps=1, quiz=1), dict(gaps=1, quiz=1, short=1, problem=1)])
def test_selection_limit_rejects_excess_activities_before_provider_and_charging(client, monkeypatch, counts):
    web, factory = client
    seed_user(factory, product_codes=('PROFESOR_PARTICULAR',)); login(web)
    def no_provider(*args, **kwargs):
        pytest.fail('An invalid selection must not reach the AI provider')
    monkeypatch.setattr(app_routes, 'chat_provider_config', no_provider)
    body = payload(); body.update(counts)
    response = web.post('/api/profesor/generate?app=profesor_particular', json=body)
    assert response.status_code == 422, response.text
    assert response.json()['detail']
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(UsageRecord)) == 0
        assert db.scalar(select(func.count()).select_from(Conversation)) == 0


def test_one_activity_keeps_its_full_question_size():
    body = payload(); body.update(activitySizes={'gaps':12})
    _, context = generator_context(body)
    batches = generation_batches(context)
    assert sum(batch['gaps'] for batch, _ in batches) == 12
    assert {group for _, group in batches} == {1}


def test_long_cloze_and_real_rosco_contract():
    body=payload()
    body.update(gaps=0, multigaps=1, activitySizes={'multigaps':12}, extent='long')
    _, context=generator_context(body)
    batch,_=generation_batches(context)[0]
    prompt=' '.join(f'En el momento {n}, el personaje ___ (caminar) por una calle distinta, mientras sus amigos miraban los edificios antiguos y comentaban las historias del barrio.' for n in range(12))
    q=dict(type='multigaps', prompt=prompt, answer='Completado', options=['caminaba']*12, explanation='El imperfecto presenta acciones en curso.')
    result=parse_material(json.dumps({'questions':[q]}),batch)
    assert result[0]['prompt']==prompt and len(result[0]['options'])==12
    q['options']=q['options'][:6]
    with pytest.raises(HTTPException): parse_material(json.dumps({'questions':[q]}),batch)
    body.update(multigaps=0, pasapalabra=1, activitySizes={'pasapalabra':3})
    _, context=generator_context(body);batch,_=generation_batches(context)[0]
    q=dict(type='pasapalabra', prompt='Resuelve el rosco.', answer='Completado', options=['I | Tiempo que presenta hábitos en el pasado | imperfecto', 'B | Forma de beber con yo en imperfecto | bebía', 'C | Forma de caminar con él en imperfecto | caminaba'], explanation='Cada pista identifica una forma o un concepto.')
    assert len(parse_material(json.dumps({'questions':[q]}),batch)[0]['options'])==3
    q['options'][1]='B | Verbo en imperfecto que describe una costumbre | bebía'
    with pytest.raises(HTTPException): parse_material(json.dumps({'questions':[q]}),batch)
    q['options'][1]='B | Yo ___ agua | bebía'
    with pytest.raises(HTTPException): parse_material(json.dumps({'questions':[q]}),batch)
    q['options'][1]='B | Esta respuesta es bebía | bebía'
    with pytest.raises(HTTPException): parse_material(json.dumps({'questions':[q]}),batch)


def test_rejects_wrong_tense_and_repeated_questions():
    _, context=generator_context(payload());batch,_=generation_batches(context)[0]
    def questions():
        return [dict(type='gaps',prompt=f'Ayer, a las {n+1}, Ana ___ (caminar) por el parque.',answer='caminaba',explanation='La acción se presenta en curso en ese momento.') for n in range(6)]
    qs=questions();qs[0]['answer']='ha caminado'
    with pytest.raises(HTTPException): parse_material(json.dumps({'questions':qs}),batch)
    qs=questions();qs[1]=qs[0]
    with pytest.raises(HTTPException): parse_material(json.dumps({'questions':qs}),batch)


def test_expanded_generation_cached_once_and_repair_before_charging(client, monkeypatch):
    web,factory=client
    seed_user(factory,product_codes=('PROFESOR_PARTICULAR',));login(web)
    monkeypatch.setattr(app_routes,'chat_provider_config',lambda *args,**kw:('test-key','https://example.test','groq'))
    monkeypatch.setattr(app_routes,'chat_model_for_purpose',lambda *args:'openai/gpt-oss-120b')
    sent=[]
    class FakeClient:
        def __init__(self,**kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def post(self,url,**kw):
            body=kw['json'];sent.append(body);context=json.loads(body['messages'][1]['content'])
            if len(sent)==1: return httpx.Response(200,json={'choices':[{'message':{'content':'{"questions":[]}'}}]})
            qs=[dict(type='gaps',prompt=f'Ayer, a las {context["itemOffset"]+n+1}, Ana ___ (caminar) por el parque.',answer='caminaba',explanation='El imperfecto presenta una acción en curso.') for n in range(context['gaps'])]
            return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps({'questions':qs})}}], 'usage':{'prompt_tokens':100,'completion_tokens':200}})
    monkeypatch.setattr(app_routes.httpx,'AsyncClient',FakeClient)
    body=payload()
    for _ in range(2):
        response=web.post('/api/profesor/generate?app=profesor_particular',json=body)
        assert response.status_code==200,response.text
        assert len(response.json()['questions'])==8
        assert {q['activityGroup'] for q in response.json()['questions']}=={1}
    assert len(sent)==3
    assert all(b['max_tokens']==3000 and b['reasoning_effort']=='medium' for b in sent)
    assert 'repairInstruction' in json.loads(sent[1]['messages'][1]['content'])
    assert json.loads(sent[2]['messages'][1]['content'])['previousPrompts']
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord))==1


def test_context_rejects_invalid_controls():
    for change in [dict(activitySizes=[]),dict(activitySizes={'invented':6}),dict(activitySizes={'gaps':True}),dict(activitySizes={'gaps':13}),dict(extent='huge'),dict(difficulty='unknown'),dict(instructions='x'*3001)]:
        body=payload();body.update(change)
        with pytest.raises(HTTPException) as exc:generator_context(body)
        assert exc.value.status_code==422


def test_cloze_extraction_counts_word_boundaries_and_safe_locators():
    body=payload();body.update(gaps=0,multigaps=1,extent='short',activitySizes={'multigaps':3})
    _,context=generator_context(body);batch,_=generation_batches(context)[0]
    q=dict(type='multigaps',prompt='Lee y completa.',answer='Completado',clozeText='En verano, Ana era feliz. Ayer caminó al parque. Luego volvió a casa.',
           clozeGaps=[dict(fragment='Ana era feliz',answer='era',infinitive='ser'),dict(fragment='Una descripción equivocada del contexto',answer='caminó',infinitive='caminar'),dict(fragment='Luego volvió a casa',answer='volvió',infinitive='volver')],explanation='El estado se expresa en imperfecto y las acciones terminadas en indefinido.')
    result=parse_material(json.dumps({'questions':[q]}),batch)[0]
    assert result['options']==['era','caminó','volvió']
    assert result['prompt'].count('___')==3
    assert 'En verano' in result['prompt'] and '___ (ser)' in result['prompt']
    q['clozeGaps'][1]['answer']='salió'
    with pytest.raises(HTTPException):parse_material(json.dumps({'questions':[q]}),batch)
    q['clozeGaps'][1]['answer']='era'
    q['clozeText']+=' Su hermano también era feliz.'
    with pytest.raises(HTTPException):parse_material(json.dumps({'questions':[q]}),batch)


def test_shared_reading_is_transmitted_once_and_cannot_change_between_batches():
    body=payload();body.update(gaps=0,reading=1,extent='short',activitySizes={'reading':8})
    _,context=generator_context(body);batches=generation_batches(context)
    passage=' '.join(['Ana caminaba por el parque y escuchaba a los pájaros.']*7)
    def questions(n):return [dict(type='reading',prompt=f'Pregunta {i+1}',answer='Ana.',explanation='La respuesta se extrae del texto.') for i in range(n)]
    qs=questions(6);qs[0]['text']=passage
    assert all(q['text']==passage for q in parse_material(json.dumps({'questions':qs}),batches[0][0]))
    later={**batches[1][0],'readingPassage':passage}
    assert all(q['text']==passage for q in parse_material(json.dumps({'questions':questions(2)}),later))
    qs=questions(2);qs[0]['text']=passage+' Un final diferente.'
    with pytest.raises(HTTPException):parse_material(json.dumps({'questions':qs}),later)


def test_negative_compound_restriction_is_not_mistaken_for_permission():
    body=payload();body.update(instructions='Solo imperfecto y perfecto simple, nunca tiempos compuestos.')
    _,context=generator_context(body);batch,_=generation_batches(context)[0]
    qs=[dict(type='gaps',prompt=f'Ayer Ana ___ (caminar) a las {i+1}.',answer='caminaba',explanation='Acción en curso.') for i in range(6)]
    qs[0]['prompt']='Ana ___ (caminar) por el parque que había conocido.'
    with pytest.raises(HTTPException) as exc:parse_material(json.dumps({'questions':qs}),batch)
    assert 'habia conocido' in exc.value.detail


def test_provider_wait_is_bounded_and_does_not_spin(monkeypatch):
    import asyncio
    from app.services import teacher_generator
    sleeps=[]
    async def sleep(delay):sleeps.append(delay)
    monkeypatch.setattr(teacher_generator.asyncio,'sleep',sleep)
    class Fake:
        def __init__(self):self.calls=0
        async def post(self,*args,**kw):
            self.calls+=1
            return httpx.Response(429 if self.calls<3 else 200,headers={'Retry-After':'2.4'})
    fake=Fake();assert asyncio.run(generation_post(fake,'https://test',headers={},json={})).status_code==200
    assert sleeps==[4,4] and fake.calls==3
    class Full:
        async def post(self,*args,**kw):return httpx.Response(429,headers={'Retry-After':'120'})
    with pytest.raises(HTTPException) as exc:asyncio.run(generation_post(Full(),'https://test',headers={},json={}))
    assert exc.value.status_code==429 and sleeps==[4,4]
    class TemporaryFailure:
        def __init__(self): self.calls=0
        async def post(self,*args,**kw):
            self.calls+=1
            return httpx.Response(503 if self.calls<3 else 200)
    temporary=TemporaryFailure()
    assert asyncio.run(generation_post(temporary,'https://test',headers={},json={})).status_code==200
    assert temporary.calls==3 and sleeps==[4,4,1,2]
    class TemporaryNetwork:
        def __init__(self): self.calls=0
        async def post(self,*args,**kw):
            self.calls+=1
            if self.calls==1: raise httpx.ConnectError('temporary')
            return httpx.Response(200)
    network=TemporaryNetwork()
    assert asyncio.run(generation_post(network,'https://test',headers={},json={})).status_code==200
    assert network.calls==2 and sleeps[-1]==1


def test_later_invalid_batch_does_not_charge_partial_material(client,monkeypatch):
    web,factory=client;seed_user(factory,product_codes=('PROFESOR_PARTICULAR',));login(web)
    monkeypatch.setattr(app_routes,'chat_provider_config',lambda *args,**kw:('test-key','https://example.test','groq'))
    monkeypatch.setattr(app_routes,'chat_model_for_purpose',lambda *args:'openai/gpt-oss-120b')
    sent=[]
    class FakeClient:
        def __init__(self,**kw):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def post(self,url,**kw):
            body=kw['json'];sent.append(body);context=json.loads(body['messages'][1]['content'])
            qs=[dict(type='gaps',prompt=f'Ayer Ana ___ (caminar) a las {i+1}.',answer='caminaba',explanation='Acción en curso.') for i in range(6)] if not context['itemOffset'] else []
            return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps({'questions':qs})}}]})
    monkeypatch.setattr(app_routes.httpx,'AsyncClient',FakeClient)
    response=web.post('/api/profesor/generate?app=profesor_particular',json=payload())
    assert response.status_code==502 and len(sent)==4
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(UsageRecord))==0
        assert db.scalar(select(func.count()).select_from(Conversation))==1


def test_sensitive_board_schema_and_legacy_fallback():
    body=payload();body.update(gaps=0,pasapalabra=1,activitySizes={'pasapalabra':18})
    _,context=generator_context(body);batch,_=generation_batches(context)[0]
    response=generation_response_format(batch,'groq','openai/gpt-oss-120b')
    options=response['json_schema']['schema']['properties']['questions']['items']['properties']['options']
    assert response['json_schema']['strict'] and options['minItems']==options['maxItems']==6
    assert generation_response_format(batch,'openai','other')=={'type':'json_object'}


def test_malformed_json_does_not_expose_parser_in_user_message():
    _, context = generator_context(payload())
    batch, _ = generation_batches(context)[0]
    with pytest.raises(HTTPException) as exc:
        parse_material('not JSON', batch)
    assert 'Expecting value' not in exc.value.detail
    assert 'No se han descontado créditos' in exc.value.detail


def test_empty_response_retries_with_more_room_and_without_strict_schema(client, monkeypatch):
    web, factory = client
    seed_user(factory, product_codes=('PROFESOR_PARTICULAR',)); login(web)
    monkeypatch.setattr(app_routes, 'chat_provider_config', lambda *args, **kw: ('test-key', 'https://example.test', 'groq'))
    monkeypatch.setattr(app_routes, 'chat_model_for_purpose', lambda *args: 'openai/gpt-oss-120b')
    sent = []
    class FakeClient:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kw):
            sent.append(kw['json'])
            if len(sent) == 1:
                return httpx.Response(200, json={'choices': [{'message': {'content': None}, 'finish_reason': 'length'}]})
            questions = [dict(type='gaps', prompt=f'Ayer, a las {n+1}, Ana ___ (caminar) por el parque.',
                              answer='caminaba', explanation='La acción se presenta en curso en ese momento.') for n in range(2)]
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps({'questions': questions})}, 'finish_reason': 'stop'}]})
    monkeypatch.setattr(app_routes.httpx, 'AsyncClient', FakeClient)
    body = payload(); body.update(activitySizes={'gaps': 2})
    response = web.post('/api/profesor/generate?app=profesor_particular', json=body)
    assert response.status_code == 200, response.text
    assert len(response.json()['questions']) == 2
    assert len(sent) == 2
    assert sent[0]['response_format']['type'] == 'json_schema'
    assert sent[1]['response_format'] == {'type': 'json_object'}
    assert sent[1]['max_tokens'] == 6000 and sent[1]['reasoning_effort'] == 'low'
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1


def test_large_rosco_empty_response_is_clear_and_does_not_charge(client, monkeypatch):
    web, factory = client
    seed_user(factory, product_codes=('PROFESOR_PARTICULAR',)); login(web)
    monkeypatch.setattr(app_routes, 'chat_provider_config', lambda *args, **kw: ('test-key', 'https://example.test', 'groq'))
    monkeypatch.setattr(app_routes, 'chat_model_for_purpose', lambda *args: 'openai/gpt-oss-120b')
    sent = []
    class FakeClient:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kw):
            sent.append(kw['json'])
            return httpx.Response(200, json={'choices': [{'message': {'content': ''}, 'finish_reason': 'stop'}]})
    monkeypatch.setattr(app_routes.httpx, 'AsyncClient', FakeClient)
    body = payload(); body.update(gaps=0, pasapalabra=1, activitySizes={'pasapalabra': 18})
    response = web.post('/api/profesor/generate?app=profesor_particular', json=body)
    assert response.status_code == 502 and len(sent) == 3
    assert 'respuesta vacía o incompleta' in response.json()['detail']
    assert 'Expecting value' not in response.json()['detail']
    assert [request['max_tokens'] for request in sent] == [4000, 6000, 6000]
    assert all(request['reasoning_effort'] == 'low' for request in sent)
    assert sent[1]['response_format'] == {'type': 'json_object'}
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(UsageRecord)) == 0
        assert db.scalar(select(func.count()).select_from(Conversation)) == 0


def test_rosco_is_generated_in_small_batches_and_returned_as_one_activity(client, monkeypatch):
    web, factory = client
    seed_user(factory, product_codes=('PROFESOR_PARTICULAR',)); login(web)
    monkeypatch.setattr(app_routes, 'chat_provider_config', lambda *args, **kw: ('test-key', 'https://example.test', 'groq'))
    monkeypatch.setattr(app_routes, 'chat_model_for_purpose', lambda *args: 'openai/gpt-oss-120b')
    sent = []
    class FakeClient:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kw):
            batch = json.loads(kw['json']['messages'][1]['content'])
            sent.append(batch)
            letters = batch['roscoLetters']
            question = dict(type='pasapalabra', prompt='Resuelve el rosco de conceptos.', answer='Completado',
                            options=[f'{letter} | Definición del concepto número {batch["itemOffset"]+i+1} | palabra{letter}' for i, letter in enumerate(letters)],
                            itemExplanations=[f'La pista del concepto número {batch["itemOffset"]+i+1} se relaciona con el tema.' for i in range(len(letters))],
                            explanation='Cada pista se resuelve mediante una palabra distinta relacionada con el tema.')
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps({'questions': [question]})}}]})
    monkeypatch.setattr(app_routes.httpx, 'AsyncClient', FakeClient)
    body = payload(); body.update(gaps=0, pasapalabra=1, activitySizes={'pasapalabra': 18})
    response = web.post('/api/profesor/generate?app=profesor_particular', json=body)
    assert response.status_code == 200, response.text
    questions = response.json()['questions']
    assert len(sent) == 3 and len(questions) == 1 and len(questions[0]['options']) == 18
    assert ''.join(q['roscoLetters'] for q in sent) == 'ABCDEFGHIJLMNOPRST'
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1


def test_old_nine_letter_checkpoint_restarts_rosco_without_duplicate_letters(client, monkeypatch):
    web, factory = client
    org_id, user_id = (UUID(value) for value in seed_user(factory, product_codes=('PROFESOR_PARTICULAR',)))
    login(web)
    monkeypatch.setattr(app_routes, 'chat_provider_config', lambda *args, **kw: ('test-key', 'https://example.test', 'groq'))
    monkeypatch.setattr(app_routes, 'chat_model_for_purpose', lambda *args: 'openai/gpt-oss-120b')
    body = payload(); body.update(gaps=0, pasapalabra=1, activitySizes={'pasapalabra': 9})
    _, context = generator_context(body)

    def rosco_part(letters, offset):
        return dict(type='pasapalabra', prompt='Resuelve el rosco de conceptos.', answer='Completado',
                    options=[f'{letter} | Concepto número {offset+i+1} del tema | palabra{letter}' for i, letter in enumerate(letters)],
                    itemExplanations=[f'El concepto número {offset+i+1} se relaciona con el tema.' for i in range(len(letters))],
                    explanation='Cada pista identifica una palabra diferente relacionada con el tema.', activityGroup=1)

    with factory() as db:
        conversation = Conversation(organization_id=org_id, user_id=user_id, title='teacher-generator:' + body['request_id'])
        db.add(conversation); db.flush()
        old_checkpoint = dict(context=context, questions=[], complete=False, completed_batches=1,
                              rosco_parts={'1': [rosco_part('ABCDE', 0)]}, reading_passages={},
                              classification_categories={}, input_tokens=0, output_tokens=0)
        db.add(Message(conversation_id=conversation.id, organization_id=org_id, user_id=user_id,
                       role='assistant', content=json.dumps(old_checkpoint)))
        db.commit()

    offsets = []
    class FakeClient:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kw):
            batch = json.loads(kw['json']['messages'][1]['content'])
            offsets.append(batch['itemOffset'])
            question = rosco_part(batch['roscoLetters'], batch['itemOffset'])
            question.pop('activityGroup')
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps({'questions': [question]})}}]})

    monkeypatch.setattr(app_routes.httpx, 'AsyncClient', FakeClient)
    response = web.post('/api/profesor/generate?app=profesor_particular', json=body)
    assert response.status_code == 200, response.text
    assert offsets == [0, 3, 6]
    assert len(response.json()['questions'][0]['options']) == 9
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1


def test_resume_uses_valid_batches_without_charging_twice(client, monkeypatch):
    web, factory = client
    seed_user(factory, product_codes=('PROFESOR_PARTICULAR',)); login(web)
    monkeypatch.setattr(app_routes, 'chat_provider_config', lambda *args, **kw: ('test-key', 'https://example.test', 'groq'))
    monkeypatch.setattr(app_routes, 'chat_model_for_purpose', lambda *args: 'openai/gpt-oss-120b')
    sent = []
    state = {'recover': False}
    class FakeClient:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kw):
            batch = json.loads(kw['json']['messages'][1]['content'])
            sent.append(batch['itemOffset'])
            if batch['itemOffset'] and not state['recover']:
                return httpx.Response(200, json={'choices': [{'message': {'content': '{"questions":[]}'}}]})
            questions = [dict(type='gaps', prompt=f'Ayer, a las {batch["itemOffset"]+i+1}, Ana ___ (caminar) por el parque.',
                              answer='caminaba', explanation='La acción se presenta en curso en ese momento.') for i in range(batch['gaps'])]
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps({'questions': questions})}}]})
    monkeypatch.setattr(app_routes.httpx, 'AsyncClient', FakeClient)
    body = payload()
    first = web.post('/api/profesor/generate?app=profesor_particular', json=body)
    assert first.status_code == 502 and sent == [0, 6, 6, 6]
    with factory() as db:
        saved = db.scalar(select(Conversation))
        assert saved and db.scalar(select(func.count()).select_from(UsageRecord)) == 0
    state['recover'] = True
    second = web.post('/api/profesor/generate?app=profesor_particular', json=body)
    assert second.status_code == 200, second.text
    assert len(second.json()['questions']) == 8 and sent == [0, 6, 6, 6, 6]
    assert web.post('/api/profesor/generate?app=profesor_particular', json=body).json()['reused'] is True
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1


@pytest.mark.parametrize('gemini_key', ['AQ.test', 'AIza-test'])
def test_reserve_uses_gemini_after_primary_has_invalid_output(client, monkeypatch, gemini_key):
    web, factory = client
    seed_user(factory, role='superadmin', product_codes=('PROFESOR_PARTICULAR',)); login(web)
    response = web.post('/admin/ai-settings/apps/PROFESOR_PARTICULAR', json={'capabilities': {'generator_fallback': {'provider': 'gemini', 'model': 'gemini-3.8-flash'}}})
    assert response.status_code == 200, response.text
    assert next(cap for cap in response.json()['apps']['PROFESOR_PARTICULAR'] if cap['id'] == 'generator_fallback')['enabled'] is True
    monkeypatch.setattr(app_routes, 'chat_provider_config', lambda *args, **kw: (gemini_key, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'gemini') if kw.get('provider_override') == 'gemini' else ('test-key', 'https://example.test', 'groq'))
    monkeypatch.setattr(app_routes, 'chat_model_for_purpose', lambda *args: 'openai/gpt-oss-120b')
    sent = []
    class FakeClient:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kw):
            sent.append((url, kw))
            if url == 'https://example.test':
                return httpx.Response(200, json={'choices': [{'message': {'content': ''}}]})
            questions = [dict(type='gaps', prompt=f'Ayer, a las {i+1}, Ana ___ (caminar) por el parque.',
                              answer='caminaba', explanation='La acción se presenta en curso en ese momento.') for i in range(2)]
            if 'generateContent' in url:
                return httpx.Response(200, json={'candidates': [{'content': {'parts': [{'text': json.dumps({'questions': questions})}]}}]})
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps({'questions': questions})}}]})
    monkeypatch.setattr(app_routes.httpx, 'AsyncClient', FakeClient)
    body = payload(); body.update(activitySizes={'gaps': 2})
    generated = web.post('/api/profesor/generate?app=profesor_particular', json=body)
    assert generated.status_code == 200, generated.text
    assert len(sent) == 4 and len(generated.json()['questions']) == 2
    if gemini_key.startswith('AQ.'):
        assert sent[-1][1]['headers']['x-goog-api-key'] == gemini_key
        assert sent[-1][1]['json']['generationConfig']['responseMimeType'] == 'application/json'
    else:
        assert sent[-1][1]['headers']['Authorization'] == 'Bearer ' + gemini_key
        assert sent[-1][1]['json']['response_format'] == {'type': 'json_object'}
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1


def test_configured_reserve_works_when_primary_key_is_missing(client, monkeypatch):
    web, factory = client
    seed_user(factory, role='superadmin', product_codes=('PROFESOR_PARTICULAR',)); login(web)
    configured = web.post('/admin/ai-settings/apps/PROFESOR_PARTICULAR', json={
        'capabilities': {'generator_fallback': {'provider': 'gemini', 'model': 'gemini-3.8-flash'}}})
    assert configured.status_code == 200, configured.text

    def provider(*args, **kwargs):
        if kwargs.get('provider_override') == 'gemini':
            return 'AQ.test', 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'gemini'
        raise HTTPException(500, 'Falta GROQ_API_KEY.')

    monkeypatch.setattr(app_routes, 'chat_provider_config', provider)
    sent = []

    class FakeClient:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kw):
            sent.append(url)
            questions = [dict(type='gaps', prompt=f'Ayer, a las {n+1}, Ana ___ (caminar) por el parque.',
                              answer='caminaba', explanation='El imperfecto expresa una acción en curso.') for n in range(2)]
            return httpx.Response(200, json={'candidates': [{'content': {'parts': [{'text': json.dumps({'questions': questions})}]}}]})

    monkeypatch.setattr(app_routes.httpx, 'AsyncClient', FakeClient)
    body = payload(); body.update(activitySizes={'gaps': 2})
    response = web.post('/api/profesor/generate?app=profesor_particular', json=body)
    assert response.status_code == 200, response.text
    assert len(sent) == 1 and 'generateContent' in sent[0]
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1


def test_generator_assets_available_on_server_routes(client):
    web,_=client
    script=web.get('/profesor-generator.js');style=web.get('/assets/profesor-generator.css')
    assert script.status_code==style.status_code==200
    assert 'activitySizes' in script.text and '.generator-brief' in style.text


@pytest.mark.parametrize('kind',['reading','classify'])
def test_route_preserves_shared_content_between_batches(client,monkeypatch,kind):
    web,factory=client;seed_user(factory,product_codes=('PROFESOR_PARTICULAR',));login(web)
    monkeypatch.setattr(app_routes,'chat_provider_config',lambda *args,**kw:('test-key','https://example.test','groq'))
    monkeypatch.setattr(app_routes,'chat_model_for_purpose',lambda *args:'openai/gpt-oss-120b')
    passage=' '.join(['Ana caminaba por el parque y escuchaba a los pájaros.']*7)
    sent=[]
    class FakeClient:
        def __init__(self,**kw):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def post(self,url,**kw):
            context=json.loads(kw['json']['messages'][1]['content']);sent.append(context)
            qs=[dict(type=kind,prompt=f'Pregunta {context["itemOffset"]+i+1}',answer='Ana' if kind=='reading' else 'Animal',explanation='La respuesta se extrae del contenido.') for i in range(context[kind])]
            if kind=='reading':
                if not context['itemOffset']:qs[0]['text']=passage
                else:assert context['readingPassage']==passage
            else:
                for q in qs:q['options']=['Animal','Planta']
                if context['itemOffset']:assert context['classificationCategories']==['Animal','Planta']
            return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps({'questions':qs})}}]})
    monkeypatch.setattr(app_routes.httpx,'AsyncClient',FakeClient)
    body=payload();body.update(gaps=0,extent='short',activitySizes={kind:8},**{kind:1})
    response=web.post('/api/profesor/generate?app=profesor_particular',json=body)
    assert response.status_code==200,response.text
    qs=response.json()['questions']
    assert len(sent)==2 and len(qs)==8 and {q['activityGroup'] for q in qs}=={1}
    if kind=='reading':assert {q['text'] for q in qs}=={passage}
    else:assert all(q['options']==['Animal','Planta'] for q in qs)
    with factory() as db:assert db.scalar(select(func.count()).select_from(UsageRecord))==1
