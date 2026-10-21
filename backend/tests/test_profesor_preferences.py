import pytest
from test_access_control import client, login, seed_user


def teacher(client):
    web,factory=client
    seed_user(factory,product_codes=('PROFESOR_PARTICULAR',))
    login(web)
    return web


def save(web,payload,etag=None):
    etag=etag or web.get('/api/state?app=profesor_particular').headers['etag']
    return web.post('/api/state?app=profesor_particular',json=payload,headers={'If-Match':etag})


def test_preferences_roundtrip_preserves_every_material_and_plan_is_server_owned(client):
    web=teacher(client)
    material={'id':'kept','subject':'Matemáticas','title':'No se borra','body':'Contenido guardado'}
    payload={'students':[],'sessions':[],'tasks':[],'library':[material],'teacherProfile':{'subjects':['Inglés'],'courses':['2.º Primaria','A2'],'backgroundMode':'academy','plan':'premium'}}
    response=save(web,payload)
    assert response.status_code==200,response.text
    current=web.get('/api/state?app=profesor_particular').json()
    assert current['teacherProfile']['subjects']==['Inglés']
    assert current['teacherProfile']['courses']==['2.º Primaria','A2']
    assert current['teacherProfile']['backgroundMode']=='academy'
    assert current['teacherProfile']['plan']=='normal'
    assert current['library']==[material]
    login(web)
    assert web.get('/api/state?app=profesor_particular').json()['teacherProfile']['subjects']==['Inglés']
    payload['teacherProfile']['subjects']=['Matemáticas','Inglés']
    assert save(web,payload).status_code==200
    assert web.get('/api/state?app=profesor_particular').json()['library']==[material]


@pytest.mark.parametrize('profile',[{'subjects':'Inglés'},{'subjects':['']},{'subjects':['a'*81]},{'subjects':['x']*31},{'subjects':['bad\x00subject']},{'courses':'2.º Primaria'},{'courses':['']},{'courses':['x'*101]},{'courses':['x']*41},{'backgroundMode':'unknown'}])
def test_invalid_preferences_never_overwrite_saved_work(client,profile):
    web=teacher(client)
    original={'library':[{'id':'kept','title':'Guardado','subject':'Lengua','body':'Contenido'}],'teacherProfile':{'subjects':['Lengua'],'backgroundMode':'plain'}}
    assert save(web,original).status_code==200
    bad={**original,'teacherProfile':profile}
    assert save(web,bad).status_code==422
    assert web.get('/api/state?app=profesor_particular').json()['library']==original['library']
    assert web.get('/api/state?app=profesor_particular').json()['teacherProfile']['subjects']==['Lengua']


def test_old_tab_cannot_replace_newer_subject_selection(client):
    web=teacher(client)
    old=web.get('/api/state?app=profesor_particular').headers['etag']
    assert save(web,{'teacherProfile':{'subjects':['Inglés']}},old).status_code==200
    stale=save(web,{'teacherProfile':{'subjects':['Lengua']}},old)
    assert stale.status_code==409
    assert web.get('/api/state?app=profesor_particular').json()['teacherProfile']['subjects']==['Inglés']


def test_settings_assets_and_small_appearance_previews_are_served(client):
    web,_=client
    for path in ('/profesor-profile.js','/profesor-subjects.js','/assets/profesor-profile.css'):
        assert web.get(path).status_code==200
    for name in ('study','academy'):
        response=web.get('/assets/profesor-'+name+'-preview.webp')
        assert response.status_code==200
        assert response.headers['content-type']=='image/webp'
        assert response.content[:4]==b'RIFF' and len(response.content)<40000
