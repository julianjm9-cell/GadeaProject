import json
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
import httpx
import pytest
from sqlalchemy import select, func
from fastapi import HTTPException

from test_access_control import client, seed_user, login
from app.api import app_routes, teacher_generation_jobs
from app.models import Conversation, Message, UsageRecord, ProfesorGenerationJob, User, License
from app.services.teacher_generator import generator_context, generation_batches, parse_material, TYPES
from app.services.teacher_generation_contract import GenerationDraft, assign_rosco_letters, wire_schema


def payload(kind='pasapalabra', size=18):
    return dict(request_id=str(uuid4()), course='3.º ESO', subject='Lengua', topic='Sintaxis',
                activitySizes={kind:size}, qualityVersion=1, **{k:int(k==kind) for k in TYPES})


def batch(kind='pasapalabra', size=18):
    _, context = generator_context(payload(kind, size))
    return generation_batches(context, content_contract=2)[0][0]


def rosco(entries):
    return json.dumps({'questions':[{'roscoEntries':entries, 'explanation':'Cada definición identifica un concepto de sintaxis.'}]})


def setup_provider(web, factory, monkeypatch, responder):
    seed_user(factory, product_codes=('PROFESOR_PARTICULAR',)); login(web)
    monkeypatch.setattr(app_routes, 'chat_provider_config', lambda *a, **kw: ('test-key','https://example.test','groq'))
    monkeypatch.setattr(app_routes, 'chat_model_for_purpose', lambda *a: 'openai/gpt-oss-120b')
    class Fake:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass
        async def post(self, url, **kw): return responder(kw['json'])
    monkeypatch.setattr(app_routes.httpx, 'AsyncClient', Fake)


def test_rosco_retains_good_clues_and_assigns_letters_from_answers():
    draft = GenerationDraft(batch(size=3))
    assert draft.ingest(rosco([{'clue':'Núcleo del predicado verbal','answer':'verbo'},
                              {'clue':'Es la palabra verbo','answer':'verbo'},
                              {'clue':'Constituyente que concuerda con el predicado','answer':'sujeto'}])) == 2
    assert not draft.complete
    request = draft.request_context()
    assert request['elementCount']==1 and 'roscoLetters' not in request
    assert [row['answer'] for row in request['acceptedElements']] == ['verbo','sujeto']
    assert draft.ingest(rosco([{'clue':'Función desempeñada por un adjetivo con verbo copulativo','answer':'atributo'}])) == 1
    options = draft.result()[0]['options']
    assert len(options)==3 and len({row.split('|')[0] for row in options})==3
    assert {row.split('|')[-1].strip() for row in options}=={'verbo','sujeto','atributo'}


def test_letter_matching_backtracks_instead_of_discarding_valid_answers():
    rows = assign_rosco_letters([{'answer':'abc','clue':'uno'},{'answer':'a','clue':'dos'},{'answer':'b','clue':'tres'}])
    assert {row['letter'] for row in rows}=={'A','B','C'}
    assert all(row['letter'].casefold() in row['answer'] for row in rows)
    with pytest.raises(ValueError, match='letras distintas'):
        assign_rosco_letters([{'answer':'aaa'},{'answer':'aa'}])


def test_bundle_repair_keeps_valid_questions_and_rejects_wrong_calculation():
    draft=GenerationDraft(batch('quiz',3))
    good=dict(prompt='Calcula 2 + 2.',answer='4',options=['3','4'],explanation='Dos más dos son cuatro.')
    wrong=dict(prompt='Calcula 3 + 3.',answer='5',options=['5','6'],explanation='Tres más tres son seis.')
    assert draft.ingest(json.dumps({'questions':[good, wrong]}))==1
    request=draft.request_context()
    assert request['quiz']==2 and '2 + 2' in request['previousPrompts'][0]
    final=[dict(prompt='Calcula 3 + 3.',answer='6',options=['5','6'],explanation='Tres más tres son seis.'),
           dict(prompt='Calcula 4 + 4.',answer='8',options=['7','8'],explanation='Cuatro más cuatro son ocho.')]
    assert draft.ingest(json.dumps({'questions':final}))==2
    assert [q['answer'] for q in draft.result()]==['4','6','8']


def test_partial_classification_preserves_categories_before_retry():
    draft=GenerationDraft(batch('classify',3))
    def row(prompt,options,answer):
        return dict(prompt=prompt,options=options,answer=answer,explanation='La clasificación usa la presencia de columna vertebral.')
    assert draft.ingest(json.dumps({'questions':[row('Gato',['Vertebrado','Invertebrado'],'Vertebrado'),row('Mosca',['Animal','Planta'],'Animal')]}))==1
    assert draft.request_context()['classificationCategories']==['Vertebrado','Invertebrado']
    assert draft.ingest(json.dumps({'questions':[row('Mosca',['Vertebrado','Invertebrado'],'Invertebrado'),row('Perro',['Vertebrado','Invertebrado'],'Vertebrado')]}))==2
    assert draft.complete


def test_invalid_verbal_clue_does_not_poison_previously_accepted_rosco_clues():
    context={**batch(size=3), 'subject':'Español', 'course':'A2'}
    draft=GenerationDraft(context)
    assert draft.ingest(rosco([{'clue':'Forma de cantar con yo en imperfecto','answer':'cantaba'},
                              {'clue':'Verbo en imperfecto','answer':'jugaba'},
                              {'clue':'Forma de beber con él en imperfecto','answer':'bebía'}]))==2
    assert [row['answer'] for row in draft.elements]==['cantaba','bebía']
    assert draft.ingest(rosco([{'clue':'Forma de caminar con ellos en imperfecto','answer':'caminaban'}]))==1
    assert draft.complete


@pytest.mark.parametrize('kind', TYPES)
def test_each_type_has_only_its_own_wire_contract(kind):
    context=batch(kind,3); request=GenerationDraft(context).request_context()
    schema=wire_schema(request)['properties']['questions']['items']
    assert schema['properties']['type']['enum']==[kind]
    assert set(schema['required'])==set(schema['properties'])
    assert not {'hints','optionFeedback','itemExplanations'} & set(schema['properties'])
    if kind=='pasapalabra':
        assert set(schema['properties']['roscoEntries']['items']['properties'])=={'clue','answer'}
        assert 'answer' not in schema['properties']


def test_missing_core_answer_has_a_precise_error_without_guessing():
    with pytest.raises(HTTPException) as exc:
        parse_material(json.dumps({'questions':[{'prompt':'¿Qué es el sujeto?','explanation':'Constituyente de la oración.'}]}), {**batch('short',2), 'short':1, 'contentContract':2})
    assert 'answer' in exc.value.detail and exc.value.validation_code=='prompt_answer'


def test_historical_timeline_accepts_and_sorts_days_in_the_same_year():
    context = {**batch('timeline',3), 'subject':'Geografía e Historia', 'topic':'Segunda Guerra Mundial', 'contentContract':2}
    draft = GenerationDraft(context)
    events = ['1945-09-02 — Rendición de Japón', '1945-05-08 — Rendición de Alemania', '1939-09-01 — Invasión de Polonia por Alemania']
    assert draft.ingest(json.dumps({'questions':[dict(items=events, prompt='Ordena los hitos.', explanation='Cada hecho se sitúa por su fecha completa.')]}))==1
    assert draft.result()[0]['options']==[events[2],events[1],events[0]]
    # Equal years are valid only with sufficient precision to determine order.
    events[0]='1945 — Rendición de Japón'
    assert GenerationDraft(context).ingest(json.dumps({'questions':[dict(items=events,prompt='Ordena los hitos.',explanation='Compara las fechas.')]}))==0


def test_numeric_notation_recovery_verifies_both_sides_without_guessing():
    context={**batch('numeric',2), 'numeric':1, 'contentContract':2}
    q=dict(prompt='Calcula (-8) + 5.', answer='-3', calculation='(-8)+5 = -3', unit='', explanation='Sumar cinco a menos ocho da menos tres.')
    assert parse_material(json.dumps({'questions':[q]}),context)[0]['calculation']=='(-8)+5'
    q['calculation']='(-8)+5 = -2'
    with pytest.raises(HTTPException,match='calculation'):
        parse_material(json.dumps({'questions':[q]}),context)


def test_atomic_completion_returns_existing_result_before_second_charge(client,monkeypatch):
    web,factory=client
    body=payload('gaps',2)
    _,context=generator_context(body)
    questions=[dict(type='gaps',prompt=f'Calcula {i} + 2 = ___.',answer=str(i+2),options=[],explanation='Suma dos unidades.') for i in (1,2)]
    def responder(_):
        with factory() as db:
            user=db.scalar(select(User));lic=db.scalar(select(License))
            app_routes.record_usage(db,user,'test-model',1,1,'PROFESOR_PARTICULAR',1)
            conv=Conversation(organization_id=user.organization_id,user_id=user.id,title='teacher-generator:'+body['request_id'])
            db.add(conv);db.flush()
            db.add(Message(conversation_id=conv.id,organization_id=user.organization_id,user_id=user.id,role='assistant',content=json.dumps(dict(context=context,questions=questions,complete=True))))
            db.commit()
        return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps({'questions':questions})}}]})
    setup_provider(web,factory,monkeypatch,responder)
    response=web.post('/api/profesor/generate?app=profesor_particular',json=body)
    assert response.status_code==200,response.text
    assert response.json()['reused']
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(UsageRecord))==1
        assert db.scalar(select(func.count()).select_from(Conversation))==1


def test_partial_questions_survive_failed_call_and_resume_only_missing(client, monkeypatch):
    web,factory=client
    calls=[]; recovering=False
    def responder(body):
        context=json.loads(body['messages'][1]['content']);calls.append(context)
        good=dict(prompt='Calcula 2 + 2.',answer='4',options=['3','4'],explanation='Dos más dos son cuatro.')
        if len(calls)==1:
            content=json.dumps({'questions':[good,{'prompt':'Calcula 3 + 3.'}]})
        elif not recovering:
            content='{}'
        else:
            assert context['quiz']==1 and context['previousPrompts']==['Calcula 2 + 2.']
            content=json.dumps({'questions':[dict(prompt='Calcula 3 + 3.',answer='6',options=['5','6'],explanation='Tres más tres son seis.')]})
        return httpx.Response(200,json={'choices':[{'message':{'content':content}}]})
    setup_provider(web,factory,monkeypatch,responder)
    body=payload('quiz',2)
    response=web.post('/api/profesor/generate?app=profesor_particular',json=body)
    assert response.status_code==502
    with factory() as db:
        checkpoint=json.loads(db.scalar(select(Message)).content)
        assert len(checkpoint['drafts']['0']['questions'])==1
        assert db.scalar(select(func.count()).select_from(UsageRecord))==0
    recovering=True
    response=web.post('/api/profesor/generate?app=profesor_particular',json=body)
    assert response.status_code==200,response.text
    assert [q['answer'] for q in response.json()['questions']]==['4','6']
    assert web.post('/api/profesor/generate?app=profesor_particular',json=body).json()['reused']
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord))==1


def test_background_job_is_idempotent_and_private(client, monkeypatch):
    web,factory=client;calls=[]
    def responder(body):
        calls.append(body)
        questions=[dict(type='gaps',prompt=f'Calcula {i} + 2 = ___.',answer=str(i+2),explanation='Suma dos unidades.') for i in (1,2)]
        return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps({'questions':questions})}}]})
    setup_provider(web,factory,monkeypatch,responder)
    body=payload('gaps',2)
    result=web.post('/api/profesor/generation/start?app=profesor_particular',json=body)
    assert result.status_code==200,result.text
    status=web.get('/api/profesor/generation/'+body['request_id']+'?app=profesor_particular').json()
    assert status['status']=='completed',status
    assert status['completed']==status['total']==2
    assert len(status['result']['questions'])==2
    result=web.post('/api/profesor/generation/start?app=profesor_particular',json=body)
    assert result.json()['status']=='completed' and len(calls)==1
    seed_user(factory,email='second@example.com',product_codes=('PROFESOR_PARTICULAR',));login(web,email='second@example.com')
    assert web.get('/api/profesor/generation/'+body['request_id']+'?app=profesor_particular').status_code==404
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord))==1


def test_interrupted_job_can_resume_and_old_worker_cannot_overwrite(client,monkeypatch):
    web,factory=client;calls=[]
    def responder(body):
        calls.append(body)
        questions=[dict(prompt=f'Calcula {i} + 2 = ___.',answer=str(i+2),explanation='Suma dos unidades.') for i in (1,2)]
        return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps({'questions':questions})}}]})
    setup_provider(web,factory,monkeypatch,responder)
    body=payload('gaps',2)
    _,context=generator_context(body)
    with factory() as db:
        user=db.scalar(select(User));lic=db.scalar(select(License))
        job=ProfesorGenerationJob(user_id=user.id,organization_id=user.organization_id,license_id=lic.id,
                                  request_id=body['request_id'],payload={**context,'request_id':body['request_id']},
                                  status='running',lease='old',total=2,updated_at=datetime.now(timezone.utc)-timedelta(minutes=11))
        db.add(job);db.commit();old_id=job.id
    status=web.get('/api/profesor/generation/'+body['request_id']+'?app=profesor_particular').json()
    assert status['status']=='interrupted'
    response=web.post('/api/profesor/generation/start?app=profesor_particular',json=body)
    assert response.status_code==200,response.text
    with factory() as db:
        assert db.get(ProfesorGenerationJob,old_id).status=='completed'
        assert db.scalar(select(func.count()).select_from(UsageRecord))==1


def test_failed_background_job_preserves_partial_progress_without_charging(client,monkeypatch):
    web,factory=client; recovered=False; calls=[]
    first=dict(prompt='Calcula 2 + 2 = ___.',answer='4',explanation='Sumar dos y dos da cuatro.')
    second=dict(prompt='Calcula 3 + 3 = ___.',answer='6',explanation='Sumar tres y tres da seis.')
    def responder(body):
        context=json.loads(body['messages'][1]['content']);calls.append(context)
        if len(calls)==1: questions=[first]
        elif recovered:
            assert context['gaps']==1
            questions=[second]
        else: questions=[]
        return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps({'questions':questions})}}]})
    setup_provider(web,factory,monkeypatch,responder)
    body=payload('gaps',2)
    assert web.post('/api/profesor/generation/start?app=profesor_particular',json=body).status_code==200
    url='/api/profesor/generation/'+body['request_id']+'?app=profesor_particular'
    status=web.get(url).json()
    assert status['status']=='failed' and status['completed']==1 and status['total']==2
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord))==0
    recovered=True
    assert web.post('/api/profesor/generation/start?app=profesor_particular',json=body).status_code==200
    status=web.get(url).json()
    assert status['status']=='completed' and len(status['result']['questions'])==2
    with factory() as db: assert db.scalar(select(func.count()).select_from(UsageRecord))==1


def test_background_regeneration_returns_one_replacement_and_correct_progress(client,monkeypatch):
    web,factory=client
    def responder(body):
        context=json.loads(body['messages'][1]['content'])
        assert context['gaps']==1 and context['regeneration']['question']['prompt']=='Calcula 2 + 2 = ___.'
        question=dict(prompt='Calcula 3 + 3 = ___.',answer='6',explanation='Sumar tres y tres da seis.')
        return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps({'questions':[question]})}}]})
    setup_provider(web,factory,monkeypatch,responder)
    body=payload('gaps',2)
    body['regenerate']=dict(question=dict(type='gaps',prompt='Calcula 2 + 2 = ___.',answer='4',options=[],explanation='Sumar dos y dos da cuatro.'),siblings=[],instructions='Otra suma.')
    response=web.post('/api/profesor/generation/start?app=profesor_particular',json=body)
    assert response.status_code==200,response.text
    status=web.get('/api/profesor/generation/'+body['request_id']+'?app=profesor_particular').json()
    assert status['status']=='completed',status
    assert status['completed']==status['total']==1
    assert len(status['result']['questions'])==1


def test_active_job_blocks_new_material_and_changed_request_context(client,monkeypatch):
    web,factory=client
    setup_provider(web,factory,monkeypatch,lambda _: pytest.fail('No provider call expected.'))
    body=payload('gaps',2); _,context=generator_context(body)
    with factory() as db:
        user=db.scalar(select(User));lic=db.scalar(select(License))
        db.add(ProfesorGenerationJob(user_id=user.id,organization_id=user.organization_id,license_id=lic.id,request_id=body['request_id'],payload={**context,'request_id':body['request_id']},status='running',lease='active',total=2,updated_at=datetime.now(timezone.utc)))
        db.commit()
    assert web.post('/api/profesor/generation/start?app=profesor_particular',json=payload('gaps',2)).status_code==409
    assert web.post('/api/profesor/generation/start?app=profesor_particular',json={**body,'topic':'Other topic'}).status_code==409
    assert web.post('/api/profesor/generation/start?app=profesor_particular',json=body).json()['status']=='running'


def test_job_migration_is_idempotent_and_preserves_existing_tables(client):
    import runpy
    from sqlalchemy import inspect
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    _,factory=client
    seed_user(factory,product_codes=('PROFESOR_PARTICULAR',))
    migration=runpy.run_path('alembic/versions/0014_teacher_generation_jobs.py')
    with factory() as db:
        bind=db.connection()
        old_tables=set(inspect(bind).get_table_names())-{'profesor_generation_jobs'}
        with Operations.context(MigrationContext.configure(bind)):
            migration['downgrade']()
            assert set(inspect(bind).get_table_names())==old_tables
            migration['upgrade']();migration['upgrade']()
        assert set(inspect(bind).get_table_names())==old_tables|{'profesor_generation_jobs'}
        assert db.scalar(select(func.count()).select_from(User))==1
