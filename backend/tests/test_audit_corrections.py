from uuid import uuid4, UUID
from unittest.mock import patch
from pathlib import Path
import importlib.util
import httpx
import pytest
from sqlalchemy import select, func
from alembic.migration import MigrationContext
from alembic.operations import Operations
from test_access_control import client, seed_user, login
from app.models import License, ProviderCall, UsageRecord


@pytest.mark.parametrize('product,app', [('ESO_ADULTOS','eso_adultos'),('CAMBRIDGE','cambridge')])
def test_study_empty_or_incomplete_save_cannot_remove_existing_work(client,product,app):
    web,factory=client;seed_user(factory,product_codes=(product,));login(web)
    path='/api/state?app='+app
    state={'done':{'lesson':True},'lessonNotes':{'lesson':'Apuntes'},'historicalField':{'keep':True}}
    first=web.post(path,json=state,headers={'If-Match':web.get(path).headers['etag']});assert first.status_code==200
    etag=first.headers['etag']
    for invalid in ({},{'done':{}},{**state,'done':[]}):
        assert web.post(path,json=invalid,headers={'If-Match':etag}).status_code in (409,422)
        assert web.get(path).json()==state
    assert web.post(path,json={},headers={'If-Match':etag,'X-Confirm-Empty-State':'true'}).status_code==200


def test_ai_lost_delivery_reuses_response_and_one_credit_even_after_balance_is_exhausted(client,monkeypatch):
    web,factory=client;_,uid=seed_user(factory,product_codes=('CAMBRIDGE',));login(web)
    from app.api import app_routes
    monkeypatch.setattr(app_routes.get_settings(),'groq_api_key','gsk-test')
    with factory() as db:
        db.scalar(select(License).where(License.user_id==UUID(uid))).usage_limit=1;db.commit()
    calls=[]
    async def post(self,url,**kwargs):
        calls.append(url);return httpx.Response(200,json={'choices':[{'message':{'content':'Respuesta válida'}}],'usage':{'prompt_tokens':2,'completion_tokens':3}})
    monkeypatch.setattr(httpx.AsyncClient,'post',post)
    path='/api/chat?app=cambridge';payload={'messages':[{'role':'user','content':'Test'}]};headers={'Idempotency-Key':str(uuid4())}
    first=web.post(path,json=payload,headers=headers);assert first.status_code==200,first.text
    assert web.post(path,json=payload,headers=headers).json()==first.json()
    assert len(calls)==1
    assert web.get('/api/state?app=cambridge').status_code==200
    assert web.post(path,json=payload,headers={'Idempotency-Key':str(uuid4())}).status_code==402
    assert web.post(path,json={'messages':[]},headers=headers).status_code==409
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(UsageRecord))==1
        assert db.scalar(select(ProviderCall)).product_code=='CAMBRIDGE'


def test_unknown_rewards_require_saved_evidence_and_do_not_change_inventory(client):
    web,factory=client;seed_user(factory,product_codes=('ESO_ADULTOS',));login(web)
    path='/api/gamification/rewards?app=eso_adultos'
    assert web.post(path,json={'event_type':'TOPIC_COMPLETED','source_id':'inventado'}).status_code==422
    assert web.post(path,json={'event_type':'TOPIC_COMPLETED','source_id':'mat-numeros'}).status_code==422
    statepath='/api/state?app=eso_adultos'
    web.post(statepath,json={'done':{'mat-numeros':True}},headers={'If-Match':web.get(statepath).headers['etag']})
    result=web.post(path,json={'event_type':'TOPIC_COMPLETED','source_id':'mat-numeros'})
    assert result.status_code==200 and result.json()['awarded']
    assert web.post(path,json={'event_type':'TOPIC_COMPLETED','source_id':'mat-numeros'}).json()['duplicate']


@pytest.mark.parametrize('path,payload', [('/chat',{'messages':[{'role':'user','content':'Test'}]}),('/ocr',{'image':'data:image/png;base64,YQ=='}),('/transcribe',{'audio':'YQ=='})])
def test_legacy_ai_routes_keep_argument_compatibility(client,monkeypatch,path,payload):
    web,factory=client;seed_user(factory,product_codes=('CAMBRIDGE',))
    from app.api import app_routes
    monkeypatch.setattr(app_routes.get_settings(),'groq_api_key','gsk-test')
    monkeypatch.setattr(app_routes.get_settings(),'openai_api_key','sk-test')
    async def post(self,url,**kwargs):
        return httpx.Response(200,json={'choices':[{'message':{'content':'Respuesta'}}],'text':'Texto'})
    monkeypatch.setattr(httpx.AsyncClient,'post',post)
    result=web.post(path,json={'license_key':'CAMB-cliente@example.com','client_app':'cambridge','payload':payload})
    assert result.status_code==200,result.text


def test_notification_upgrade_accepts_schema_created_by_current_models(client):
    _,factory=client
    p=Path(__file__).parents[1]/'alembic/versions/0025_app_notifications.py'
    spec=importlib.util.spec_from_file_location('fresh_notifications',p);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    with factory() as db:
        operations=Operations(MigrationContext.configure(db.connection()))
        with patch.object(module,'op',operations):module.upgrade();module.upgrade()


def test_packaged_notification_and_session_scripts_do_not_depend_on_checkout(client,tmp_path,monkeypatch):
    web,_=client
    from app.api import app_routes
    root=Path(__file__).parents[2]
    (tmp_path/'assets').mkdir()
    import shutil
    for file in (root/'apps/profesor').glob('*.js'):shutil.copyfile(file,tmp_path/'assets'/file.name)
    monkeypatch.setattr(app_routes,'PROJECT_ROOT',tmp_path/'no-checkout')
    monkeypatch.setattr(app_routes,'STATIC_DIR',tmp_path)
    for path in ('/app-notifications.js','/app-session.js','/profesor-notifications.js'):
        assert web.get(path).status_code==200


def test_optimized_raster_keeps_original_url_and_pixels(client):
    import io
    from PIL import Image, ImageChops
    web,_=client;path='/assets/cambridge-games/open-cloze-editor-v1.png'
    original=web.get(path,headers={'Accept':'image/png'})
    optimized=web.get(path,headers={'Accept':'image/webp'})
    assert optimized.status_code==200 and optimized.headers['content-type']=='image/webp'
    assert 'Accept' in {value.strip() for value in optimized.headers['vary'].split(',')}
    assert len(optimized.content)<len(original.content)
    assert ImageChops.difference(Image.open(io.BytesIO(original.content)).convert('RGBA'),Image.open(io.BytesIO(optimized.content)).convert('RGBA')).getbbox() is None
