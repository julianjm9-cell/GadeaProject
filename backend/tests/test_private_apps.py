from uuid import UUID, uuid4
import json
import pytest
from sqlalchemy import select
from test_access_control import client, seed_user, login
from app.models import AppSetting, License, PrivateAppAccount, PrivateAppProgress
from app.services import gadeos
from app.api.auth import ensure_google_access


def admin(web, factory):
    seed_user(factory, role='superadmin', email='organizador@example.invalid')
    response = login(web, email='organizador@example.invalid')
    assert response.status_code == 200
    headers = {'Authorization': 'Bearer ' + response.json()['access_token']}
    web.cookies.clear()
    return headers


def tribute(web, headers, name='Alma'):
    created = web.post('/admin/apps/gadeos/accounts', headers=headers, json={'name': name, 'password': 'ensayo-seguro-123'})
    assert created.status_code == 201, created.text
    assert 'password' not in created.text
    signed = web.post('/api/private-apps/gadeos/login', json={'name': name, 'password': 'ensayo-seguro-123'})
    assert signed.status_code == 200, signed.text
    assert 'HttpOnly' in signed.headers['set-cookie'] and 'SameSite=strict' in signed.headers['set-cookie']
    return created.json()


def all_stations(web):
    for station in gadeos.default_campaign()['stations']:
        state = web.get('/api/private-apps/gadeos/state').json()
        response = web.post('/api/private-apps/gadeos/stations/answer', json={'station': station['number'], 'answer': station['solution'], 'campaign_revision': state['campaign']['revision'], 'revision': state['revision'], 'request_id': str(uuid4())})
        assert response.status_code == 200, response.text
    return response.json()


def test_eight_station_campaign_gains_ninth_without_losing_personal_content_or_progress(client):
    web, factory = client
    headers = admin(web, factory)
    account = tribute(web, headers)
    old = gadeos.default_campaign()
    old.pop('challenge_format')
    old['stations'] = old['stations'][:8]
    old['stations'][0].update(title='Nuestro autobús', prompt='¿Cuál es nuestra palabra?', solution='RECUERDO')
    old['stations'][0]['card'].update(title='Carta personal conservada')
    old['revision'] = 4
    with factory() as db:
        db.add(AppSetting(key=gadeos.CONFIG_KEY, value=json.dumps(old)))
        progress = db.get(PrivateAppProgress, UUID(account['id']))
        progress.data = {'completed': 8, 'victory': True, 'battle': {'state': 'won', 'used_cards': [1]}, 'receipts': ['old-receipt']}
        db.commit()
    state = web.get('/api/private-apps/gadeos/state').json()
    assert state['completed'] == 8 and len(state['campaign']['stations']) == 9
    assert len([card for card in state['cards'] if card['owned']]) == 8
    assert state['cards'][0]['title'] == 'Carta personal conservada'
    assert state['victory'] and state['battle']['state'] == 'won'
    assert not state['campaign']['stations'][8]['locked']
    start = {'revision': state['revision'], 'request_id': str(uuid4())}
    assert web.post('/api/private-apps/gadeos/battle/start', json=start).status_code == 403
    config = web.get('/admin/apps/gadeos/campaign', headers=headers).json()
    assert config['stations'][0]['title'] == 'Nuestro autobús\n¿Cuál es nuestra palabra?'
    assert config['stations'][0]['solution'] == 'RECUERDO'
    stale_eight = {**config, 'stations': config['stations'][:8]}
    assert web.put('/admin/apps/gadeos/campaign', headers=headers, json=stale_eight).status_code == 422
    # The simple editor can send only a title/clue and one answer for every trial.
    minimal = {**config, 'stations': [{'title': station['title'], 'solution': station['solution']} for station in config['stations']]}
    minimal['stations'][8] = {'title': 'Novena pista personalizada', 'solution': 'CANCIÓN'}
    saved = web.put('/admin/apps/gadeos/campaign', headers=headers, json=minimal)
    assert saved.status_code == 200, saved.text
    assert saved.json()['stations'][0]['card']['title'] == 'Carta personal conservada'
    assert web.put('/admin/apps/gadeos/campaign', headers=headers, json=minimal).status_code == 409
    body = {'revision': state['revision'], 'request_id': str(uuid4()), 'campaign_revision': 5, 'station': 9, 'answer': '  cancion '}
    completed = web.post('/api/private-apps/gadeos/stations/answer', json=body)
    assert completed.status_code == 200, completed.text
    assert completed.json()['completed'] == 9 and completed.json()['cards'][8]['owned']
    assert web.post('/api/private-apps/gadeos/stations/answer', json=body).json()['reused']
    state = completed.json()
    started = web.post('/api/private-apps/gadeos/battle/start', json={'revision': state['revision'], 'request_id': str(uuid4())}).json()
    turn = web.post('/api/private-apps/gadeos/battle/action', json={'revision': started['revision'], 'request_id': str(uuid4()), 'action': 'guard', 'card': 9})
    assert turn.status_code == 200 and turn.json()['battle']['used_cards'] == [9]
    assert web.get('/admin/apps/gadeos/accounts', headers=headers).json()['station_count'] == 9


def test_gadeos_generated_art_is_available_without_exposing_private_files(client):
    web, _ = client
    for name in ['alliance-hero', 'journey', 'arena', 'envelope', 'emblem']:
        response = web.get('/private-app-assets/gadeos/art/' + name + '-v2.webp')
        assert response.status_code == 200 and response.content[:4] == b'RIFF'
        assert response.headers['content-type'] == 'image/webp'
    assert web.get('/private-app-assets/gadeos/art/unknown.webp').status_code == 404


def test_registry_creates_real_private_app_and_preserves_old_accounts(client):
    web, factory = client
    headers = admin(web, factory)
    catalog = web.get('/admin/apps', headers=headers).json()
    assert next(app for app in catalog['apps'] if app['id'] == 'gadeos')['state'] == 'privada'
    body = {'id': 'mi-diario', 'name': 'Mi diario', 'state': 'privada', 'revision': catalog['revision']}
    created = web.post('/admin/apps', headers=headers, json=body)
    assert created.status_code == 201, created.text
    assert web.get('/a/mi-diario').status_code == 200
    assert web.get('/api/private-apps/mi-diario/state').status_code == 401
    assert web.post('/admin/apps', headers=headers, json=body).status_code == 409
    registry = created.json()
    private = web.patch('/admin/apps/ingles', headers=headers, json={'id':'ingles','state':'privada','revision':registry['revision']})
    assert private.status_code == 200
    assert web.get('/cambridge-info').status_code == 401
    assert web.get('/api/state?app=cambridge').status_code == 401
    assert web.get('/profesor').status_code == 200
    paused = web.patch('/admin/apps/ingles', headers=headers, json={'id':'ingles','state':'pausada','revision':private.json()['revision']})
    assert paused.status_code == 200
    assert web.get('/cambridge').status_code == 503
    assert web.patch('/admin/app-availability/CAMBRIDGE', headers=headers, json={'paused':False}).status_code == 200
    assert next(a for a in web.get('/admin/apps',headers=headers).json()['apps'] if a['id']=='ingles')['state']=='privada'
    public = web.patch('/admin/apps/ingles',headers=headers,json={'id':'ingles','state':'publica','revision':web.get('/admin/apps',headers=headers).json()['revision']})
    assert public.status_code == 200
    assert web.get('/cambridge-info').status_code == 200
    assert web.get('/admin/apps').status_code == 401


def test_private_google_login_does_not_grant_itself_an_invitation(client):
    web,factory=client; headers=admin(web,factory)
    catalog=web.get('/admin/apps',headers=headers).json()
    web.patch('/admin/apps/ingles',headers=headers,json={'id':'ingles','state':'privada','revision':catalog['revision']})
    _, user_id=seed_user(factory,email='invitado@example.invalid',product_codes=())
    from uuid import UUID
    from app.models import User
    with factory() as db:
        user=db.get(User,UUID(user_id)); ensure_google_access(db,user,('CAMBRIDGE',));db.commit()
        assert not db.scalar(select(License).where(License.user_id==user.id,License.product_code=='CAMBRIDGE'))


def test_tribute_login_unlocks_in_order_and_duplicate_does_not_duplicate_rewards(client):
    web,factory=client; headers=admin(web,factory); tribute(web,headers)
    assert web.get('/gadeos').headers['x-robots-tag']=='noindex, nofollow'
    assert '/gadeos' not in web.get('/sitemap.xml').text
    state=web.get('/api/private-apps/gadeos/state').json()
    assert state['completed']==0 and state['campaign']['stations'][1]['locked']
    assert 'solution' not in str(state)
    assert 'prompt' not in state['campaign']['stations'][1]
    assert state['campaign']['stations'][1]['title'] == 'Prueba 2'
    assert not any(card['owned'] for card in state['cards'])
    assert web.post('/api/private-apps/gadeos/battle/start',json={'revision':0,'request_id':str(uuid4())}).status_code==403
    body={'revision':0,'request_id':str(uuid4()),'campaign_revision':0,'station':2,'answer':'TIEMPO'}
    assert web.post('/api/private-apps/gadeos/stations/answer',json=body).status_code==409
    body.update(station=1,answer='NO')
    assert web.post('/api/private-apps/gadeos/stations/answer',json=body).status_code==422
    body.update(answer='ALIANZA',request_id=str(uuid4()))
    correct=web.post('/api/private-apps/gadeos/stations/answer',json=body)
    assert correct.status_code==200,correct.text
    assert correct.json()['completed']==1
    duplicate=web.post('/api/private-apps/gadeos/stations/answer',json=body)
    assert duplicate.json()['reused'] and duplicate.json()['revision']==1
    assert len([card for card in duplicate.json()['cards'] if card['owned']])==1
    body.update(station=2,answer='TIEMPO',request_id=str(uuid4()))
    assert web.post('/api/private-apps/gadeos/stations/answer',json=body).status_code==409
    assert web.get('/api/private-apps/gadeos/state').json()['completed']==1


def test_battle_loss_retry_victory_and_account_isolation(client):
    web,factory=client;headers=admin(web,factory);account=tribute(web,headers)
    state=all_stations(web)
    def start(state):
        response=web.post('/api/private-apps/gadeos/battle/start',json={'revision':state['revision'],'request_id':str(uuid4())});assert response.status_code==200;return response.json()
    def move(state,action,card=None):
        response=web.post('/api/private-apps/gadeos/battle/action',json={'revision':state['revision'],'request_id':str(uuid4()),'action':action,'card':card});assert response.status_code==200,response.text;return response.json()
    state=start(state)
    while state['battle']['state']=='playing':state=move(state,'attack')
    assert state['battle']['state']=='lost' and state['completed']==9
    state=start(state)
    while state['battle']['state']=='playing':state=move(state,{'strike':'guard','feint':'attack','charge':'focus'}[state['battle']['intent']])
    assert state['victory'] and state['battle']['state']=='won'
    assert web.get('/api/private-apps/gadeos/state').json()['victory']
    assert web.post('/api/private-apps/gadeos/battle/action',json={'revision':state['revision'],'request_id':str(uuid4()),'action':'attack'}).status_code==409
    reset=web.patch('/admin/apps/gadeos/accounts/'+account['id'],headers=headers,json={'password':'ensayo-renovado-123','revision':0})
    assert reset.status_code==200
    assert web.get('/api/private-apps/gadeos/state').status_code==401
    tribute(web,headers,'Leo')
    assert web.get('/api/private-apps/gadeos/state').json()['completed']==0
    assert web.post('/api/private-apps/gadeos/stations/answer',headers={'origin':'https://otro.example'},json={'revision':0}).status_code==403


@pytest.mark.parametrize('kind,options,solution',[
 ('choice',['A','B'],'B'),('order',['A','B','C'],['C','A','B']),
 ('memory',['A','B','A','B'],None),
])
def test_old_challenges_become_questions_without_exposing_or_losing_originals(client,kind,options,solution):
    web,factory=client;headers=admin(web,factory);tribute(web,headers)
    earned=web.post('/api/private-apps/gadeos/stations/answer',json={'revision':0,'request_id':str(uuid4()),'campaign_revision':0,'station':1,'answer':'ALIANZA'})
    assert earned.status_code==200
    config=gadeos.default_campaign()
    config['stations'][1].update(kind=kind,options=options,solution=solution)
    with factory() as db:
        db.add(AppSetting(key=gadeos.CONFIG_KEY,value=json.dumps(config)));db.commit()
    public=web.get('/api/private-apps/gadeos/state').json()
    assert public['campaign']['stations'][1]['kind']=='code'
    assert public['completed']==1 and len([card for card in public['cards'] if card['owned']])==1
    assert 'legacy_challenge' not in json.dumps(public)
    config=web.get('/admin/apps/gadeos/campaign',headers=headers).json()
    assert config['stations'][1]['legacy_challenge']['kind']==kind
    expected=solution if kind=='choice' else 'TIEMPO'
    assert config['stations'][1]['solution']==expected
    saved=web.put('/admin/apps/gadeos/campaign',headers=headers,json=config)
    assert saved.status_code==200,saved.text
    assert saved.json()['stations'][1]['legacy_challenge']['kind']==kind
    assert web.put('/admin/apps/gadeos/campaign',headers=headers,json=config).status_code==409
    answer=web.post('/api/private-apps/gadeos/stations/answer',json={'revision':1,'request_id':str(uuid4()),'campaign_revision':1,'station':2,'answer':expected.lower()})
    assert answer.status_code==200,answer.text
    assert answer.json()['completed']==2
    assert 'legacy_challenge' not in json.dumps(answer.json())


def test_each_station_requires_one_question_and_one_answer(client):
    web,factory=client;headers=admin(web,factory)
    for change in [dict(prompt=''),dict(solution='A|B'),dict(solution=''),dict(kind='memory')]:
        config=gadeos.default_campaign();config['stations'][0].update(change)
        assert web.put('/admin/apps/gadeos/campaign',headers=headers,json=config).status_code==422


def test_planning_and_question_edits_preserve_progress_and_older_editors(client):
    web,factory=client;headers=admin(web,factory);tribute(web,headers)
    config=gadeos.default_campaign()
    config['planning']={'day':'Sábado','place':'Chinchón','start':'15:30','final':'21:45'}
    config['stations'][1].update(prompt='¿Qué palabra habéis encontrado?',solution='RECUERDO')
    saved=web.put('/admin/apps/gadeos/campaign',headers=headers,json=config)
    assert saved.status_code==200
    first=web.post('/api/private-apps/gadeos/stations/answer',json={'revision':0,'request_id':str(uuid4()),'campaign_revision':1,'station':1,'answer':'ALIANZA'})
    assert first.status_code==200 and first.json()['completed']==1
    assert first.json()['campaign']['stations'][1]['prompt']=='¿Qué palabra habéis encontrado?'
    assert first.json()['campaign']['planning']=={**gadeos.planning_config(),**config['planning']}
    old=saved.json();old.pop('planning');old['title']='Título cambiado'
    kept=web.put('/admin/apps/gadeos/campaign',headers=headers,json=old)
    assert kept.status_code==200 and kept.json()['planning']=={**gadeos.planning_config(),**config['planning']}
    invalid=kept.json();invalid['planning']['start']='28:00'
    assert web.put('/admin/apps/gadeos/campaign',headers=headers,json=invalid).status_code==422
    current=web.get('/api/private-apps/gadeos/state').json()
    assert current['completed']==1 and current['cards'][0]['owned']
    assert current['campaign']['planning']['start']=='15:30'


def test_workspace_privacy_notes_and_stale_account_edits(client):
    web, factory = client
    headers = admin(web, factory)
    catalog = web.get('/admin/apps', headers=headers).json()
    created = web.post('/admin/apps', headers=headers, json={'id':'diario','name':'Diario','state':'privada','revision':catalog['revision']}).json()
    credentials = {'name':'Visitante','password':'ensayo-seguro-123'}
    assert web.post('/api/private-apps/diario/register', json=credentials).status_code == 403
    public = web.patch('/admin/apps/diario', headers=headers, json={'id':'diario','state':'publica','revision':created['revision']}).json()
    assert web.get('/api/private-apps/diario/info').json()['registration_enabled']
    assert web.post('/api/private-apps/diario/register', json=credentials).status_code == 201
    assert web.post('/api/private-apps/diario/register', json=credentials).status_code == 409
    assert web.post('/api/private-apps/diario/login', json=credentials).status_code == 200
    body = {'text':'Mis notas conservadas','revision':0,'request_id':str(uuid4())}
    assert web.post('/api/private-apps/diario/workspace', json=body).json()['text'] == body['text']
    assert web.post('/api/private-apps/diario/workspace', json=body).json()['reused']
    assert web.post('/api/private-apps/diario/workspace', json={**body,'text':'Otra pestaña','request_id':str(uuid4())}).status_code == 409
    assert web.get('/api/private-apps/diario/state').json()['text'] == body['text']
    account = web.get('/admin/apps/diario/accounts', headers=headers).json()['accounts'][0]
    url = '/admin/apps/diario/accounts/' + account['id']
    assert web.patch(url, headers=headers, json={'revision':0,'name':'Visitante nuevo'}).status_code == 200
    assert web.patch(url, headers=headers, json={'revision':0,'active':False}).status_code == 409
    assert web.patch(url, headers=headers, json={'revision':1,'active':False}).status_code == 200
    assert web.get('/api/private-apps/diario/state').status_code == 401
    assert web.post('/admin/apps/diario/accounts', headers=headers, json={**credentials,'name':'\ufb03'*80}).status_code == 422
    assert web.post('/api/private-apps/gadeos/register', json=credentials).status_code == 403
    assert web.patch('/admin/apps/diario', headers=headers, json={'id':'diario','state':'pausada','revision':public['revision']}).status_code == 200
    assert web.get('/a/diario').status_code == 503
    assert web.get('/api/private-apps/diario/info').status_code == 503


def test_private_images_unlock_with_card_and_admin_keeps_access(client, monkeypatch, tmp_path):
    import base64
    from io import BytesIO
    from PIL import Image
    from app.api import private_apps
    monkeypatch.setattr(private_apps, 'IMAGE_ROOT', tmp_path)
    web, factory = client
    headers = admin(web, factory)
    image = Image.new('RGB', (40, 60), 'purple')
    buffer = BytesIO(); image.save(buffer, 'PNG')
    uploaded = web.post('/admin/apps/gadeos/images', headers=headers, json={'data':base64.b64encode(buffer.getvalue()).decode()})
    assert uploaded.status_code == 201
    url = uploaded.json()['url']
    assert web.get(url).status_code == 401
    assert web.get(url, headers=headers).status_code == 200
    assert web.post('/admin/apps/gadeos/images', headers=headers, json={'data':'no es imagen'}).status_code == 422
    config = web.get('/admin/apps/gadeos/campaign', headers=headers).json()
    config['stations'][0]['card']['image'] = url
    assert web.put('/admin/apps/gadeos/campaign', headers=headers, json=config).status_code == 200
    tribute(web, headers)
    assert web.get(url).status_code in {401, 403}
    assert not web.get('/api/private-apps/gadeos/state').json()['cards'][0]['image']
    assert web.post('/api/private-apps/gadeos/stations/answer', json={'revision':0,'request_id':str(uuid4()),'campaign_revision':1,'station':1,'answer':'ALIANZA'}).status_code == 200
    response = web.get(url)
    assert response.status_code == 200 and response.headers['cache-control'] == 'private, no-store'
    assert Image.open(BytesIO(response.content)).format == 'WEBP'


def test_private_app_migration_is_repeatable_and_preserves_existing_data():
    import runpy
    import sqlalchemy as sa
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    engine = sa.create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(sa.text('CREATE TABLE users (id TEXT PRIMARY KEY, password_hash TEXT)'))
        connection.execute(sa.text("INSERT INTO users VALUES ('existing', 'unchanged')"))
        module = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'alembic/versions/0027_private_apps.py'))
        with Operations.context(MigrationContext.configure(connection)):
            module['upgrade'](); module['upgrade']()
        assert connection.execute(sa.text('SELECT * FROM users')).one() == ('existing','unchanged')
        assert {'private_app_accounts','private_app_sessions','private_app_progress'} <= set(sa.inspect(connection).get_table_names())


def test_poster_and_guide_are_private_preserved_and_do_not_unlock_cards(client, monkeypatch, tmp_path):
    import base64
    from io import BytesIO
    from PIL import Image
    from app.api import private_apps
    monkeypatch.setattr(private_apps, 'IMAGE_ROOT', tmp_path)
    web, factory = client; headers = admin(web, factory)
    def upload(color):
        buffer = BytesIO(); Image.new('RGB', (30, 40), color).save(buffer, 'PNG')
        result = web.post('/admin/apps/gadeos/images', headers=headers, json={'data':base64.b64encode(buffer.getvalue()).decode()})
        assert result.status_code == 201
        return result.json()['url']
    poster, page, locked_card, envelope = upload('red'), upload('blue'), upload('green'), upload('gold')
    config = web.get('/admin/apps/gadeos/campaign', headers=headers).json()
    config['media'] = {'poster':poster,'envelope':envelope,'guide':[{'title':'Reglas','image':page,'text':'Texto legible de la guía.'}],'source':'a'*64}
    config['stations'][7]['card']['image'] = locked_card
    saved = web.put('/admin/apps/gadeos/campaign', headers=headers, json=config)
    assert saved.status_code == 200
    assert web.get(poster).status_code == 401
    assert poster not in web.get('/gadeos').text
    assert 'media' not in web.get('/api/private-apps/gadeos/info').json()
    tribute(web, headers)
    for url in [poster, page, envelope]:
        result = web.get(url)
        assert result.status_code == 200 and result.headers['cache-control'] == 'private, no-store'
    assert web.get(locked_card).status_code in {401,403}
    state = web.get('/api/private-apps/gadeos/state').json()
    assert state['completed'] == 0 and state['campaign']['media']['guide'][0]['text'] == 'Texto legible de la guía.'
    old_editor = saved.json(); old_editor.pop('media'); old_editor['title'] = 'Título personalizado'
    kept = web.put('/admin/apps/gadeos/campaign', headers=headers, json=old_editor)
    assert kept.status_code == 200 and kept.json()['media']['poster'] == poster
    assert kept.json()['media']['envelope'] == envelope
    older_media_editor=kept.json();older_media_editor['media'].pop('envelope')
    kept=web.put('/admin/apps/gadeos/campaign',headers=headers,json=older_media_editor)
    assert kept.status_code==200 and kept.json()['media']['envelope']==envelope
    invalid = kept.json(); invalid['media']['poster'] = 'https://example.invalid/public.webp'
    assert web.put('/admin/apps/gadeos/campaign', headers=headers, json=invalid).status_code == 422
    assert web.post('/api/private-apps/gadeos/logout').status_code == 200
    assert web.get(page).status_code == 401


def test_trip_days_survive_legacy_edit_reload_and_progress(client):
    web,factory=client;headers=admin(web,factory);tribute(web,headers)
    config=web.get('/admin/apps/gadeos/campaign',headers=headers).json()
    assert [len(day['activities']) for day in config['planning']['days']]==[5,8]
    config['planning']['days'][0]['activities'][0]={'time':'18:15','text':'Dejar las mochilas.'}
    saved=web.put('/admin/apps/gadeos/campaign',headers=headers,json=config)
    assert saved.status_code==200
    legacy=saved.json();legacy['planning']={key:legacy['planning'][key] for key in ['day','place','start','final']}
    kept=web.put('/admin/apps/gadeos/campaign',headers=headers,json=legacy)
    assert kept.status_code==200
    assert kept.json()['planning']['days']==config['planning']['days']
    current=web.get('/api/arena-chinchon/state').json()
    assert current['completed']==0 and current['campaign']['planning']['days']==config['planning']['days']
    assert web.put('/admin/apps/gadeos/campaign',headers=headers,json=config).status_code==409
    for value in [[],[{'title':'Viernes','subtitle':'Viaje','activities':[]}],[{'title':'Viernes','subtitle':'Viaje','activities':[{'time':'29:00','text':'Cena'}]}]]:
        invalid=kept.json();invalid['planning']['days']=value
        assert web.put('/admin/apps/gadeos/campaign',headers=headers,json=invalid).status_code==422
    assert web.get('/admin/apps/gadeos/campaign',headers=headers).json()['planning']['days']==config['planning']['days']
