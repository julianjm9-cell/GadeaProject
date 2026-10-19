"""Exercise real licensed OCR/chat routes with a local fake AI provider."""
import base64
from io import BytesIO
import httpx
import pytest
from PIL import Image
from test_access_control import client, seed_user, login  # noqa: F401
from app.api import app_routes


@pytest.mark.parametrize('target,label',[('prompt','enunciado'),('answer','respuesta del alumno')])
def test_eso_photo_to_text_and_correction_use_the_right_app_and_content(client, monkeypatch, target, label):
    web,factory=client
    seed_user(factory,product_codes=('ESO_ADULTOS',))
    assert login(web).status_code==200
    sent=[]
    class FakeAI:
        def __init__(self, **kwargs):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def post(self,url,**kwargs):
            sent.append((url,kwargs['json']))
            return httpx.Response(200,json={'choices':[{'message':{'content':'2 + 2 = 4'}}],'usage':{'prompt_tokens':10,'completion_tokens':5}})
    monkeypatch.setattr(app_routes.httpx,'AsyncClient',FakeAI)
    monkeypatch.setattr(app_routes,'vision_provider_config',lambda db,product:('fake-local-key','https://ai.invalid/ocr','openai','test-eso-vision'))
    monkeypatch.setattr(app_routes,'chat_provider_config',lambda *args:('fake-local-key','https://ai.invalid/chat','openai'))
    monkeypatch.setattr(app_routes,'chat_model_for_purpose',lambda *args:'test-eso-chat')
    buffer=BytesIO();Image.new('RGB',(40,40),'white').save(buffer,format='PNG')
    image='data:image/png;base64,'+base64.b64encode(buffer.getvalue()).decode()
    result=web.post('/api/ocr',headers={'X-Client-App':'eso_adultos'},json={'image':image,'mime_type':'image/png','target':target})
    assert result.status_code==200 and result.json()['text']=='2 + 2 = 4'
    content=sent[-1][1]['messages'][0]['content']
    assert label in content[0]['text']
    assert content[1]['image_url']['url']==image
    assert sent[-1][1]['model']=='test-eso-vision'
    result=web.post('/api/chat',headers={'X-Client-App':'eso_adultos'},json={'purpose':'study','messages':[{'role':'user','content':'Enunciado: calcula 2 + 2. Respuesta: '+result.json()['text']}]})
    assert result.status_code==200 and result.json()['content']=='2 + 2 = 4'
    assert sent[-1][1]['model']=='test-eso-chat'
    assert 'Respuesta: 2 + 2 = 4' in sent[-1][1]['messages'][0]['content']
    before=len(sent)
    assert web.post('/api/ocr',headers={'X-Client-App':'eso_adultos'},json={'image':'data:application/pdf;base64,aA==','target':target}).status_code==400
    assert len(sent)==before


def test_eso_exam_drafts_and_history_roundtrip_without_replacing_existing_progress(client):
    web,factory=client
    seed_user(factory,product_codes=('ESO_ADULTOS',))
    assert login(web).status_code==200
    headers={'X-Client-App':'eso_adultos'}
    payload={'done':{'len-comprension':True},'scores':[{'score':80}],
             'currentExam':'Calcula 2 + 2','examDraft':{'id':'draft-qa','answer':'4','correction':'Correcto'},
             'attempts':[{'id':'attempt-qa','exam':{'prompt':'Calcula 2 + 2','answer':'4','correction':'Correcto'}}]}
    assert web.post('/api/state',headers=headers,json=payload).status_code==200
    assert web.get('/api/state',headers=headers).json()==payload
