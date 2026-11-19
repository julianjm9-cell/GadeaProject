from io import BytesIO
from uuid import uuid4
import base64
import json

from PIL import Image

from test_access_control import client
from test_private_apps import admin, playable_campaign, tribute
from app.api import private_apps

PATH = '/juegos-del-hambre'
API = '/api/arena-hambre'


def test_neutral_entry_assets_and_old_links_keep_the_secret_out_of_visible_routes(client):
    web, _ = client
    page = web.get(PATH)
    assert page.status_code == 200 and 'gadeos' not in page.text.lower()
    assert 'JUEGOS DEL HAMBRE' in page.text
    assert page.headers['x-robots-tag'] == 'noindex, nofollow'
    for old in ['/gadeos', '/a/gadeos', '/juegos-del-hambre-chinchon']:
        redirect = web.get(old, follow_redirects=False)
        assert redirect.status_code == 308 and redirect.headers['location'] == PATH
        assert web.get(old).status_code == 200
    script = web.get('/aventura-hambre-assets/app.js')
    assert script.status_code == 200 and API in script.text and 'gadeos' not in script.text.lower()
    for name in ['title-lockup-v2', 'alliance-hero-v2', 'emblem-v2', 'envelope-v2']:
        image = web.get('/aventura-hambre-assets/art/' + name + '.webp')
        assert image.status_code == 200 and image.content[:4] == b'RIFF'
    assert web.get('/aventura-hambre-assets/art/unknown.webp').status_code == 404
    assert web.get(API + '/state').status_code == 401
    assert web.get(API + '/companions.png').status_code == 401
    assert PATH not in web.get('/sitemap.xml').text


def test_existing_session_reveals_collection_only_after_its_trial_and_keeps_progress(client, monkeypatch, tmp_path):
    web, factory = client
    headers = admin(web, factory)
    account = tribute(web, headers)
    monkeypatch.setattr(private_apps, 'IMAGE_ROOT', tmp_path)
    image = Image.new('RGB', (40, 60), 'blue')
    data = BytesIO(); image.save(data, 'PNG')
    upload = web.post('/admin/apps/gadeos/images', headers=headers, json={'data': base64.b64encode(data.getvalue()).decode()})
    url = upload.json()['url']
    config = web.get('/admin/apps/gadeos/campaign', headers=headers).json()
    for number in (9, 10):
        config['stations'][number - 1].update(title=f'Pista {number}', prompt=f'Pista {number}', solution=f'Clave {number}')
    config['stations'][7]['solution'] = 'GADEOS'
    config['title'] = 'GADEOS: la colección secreta'
    config['media']['envelope'] = url
    config['stations'][0]['card'].update(title='Carta GADEOS', image=url)
    assert web.put('/admin/apps/gadeos/campaign', headers=headers, json=config).status_code == 200
    state = web.get(API + '/state').json()
    assert state['account']['id'] == account['id'] and state['completed'] == 0
    companions = web.get(API + '/companions.png')
    assert companions.status_code == 200 and companions.headers['content-type'].startswith('image/png')
    assert not state['secret_discovered'] and 'gadeos' not in json.dumps(state).lower()
    neutral_image = API + '/images/' + url.rsplit('/', 1)[-1]
    assert web.get(neutral_image).status_code == 403
    assert web.post(API + '/stations/answer', headers={'Origin': 'https://otro.example'}, json={'revision': 0}).status_code == 403
    for station in config['stations']:
        body = {'revision': state['revision'], 'request_id': str(uuid4()), 'campaign_revision': 1,
                'station': station['number'], 'answer': station['solution']}
        response = web.post(API + '/stations/answer', json=body)
        assert response.status_code == 200, response.text
        state = response.json()
        if station['number'] < 8:
            assert not state['secret_discovered'] and 'gadeos' not in response.text.lower()
            assert not state['cards'][0]['image'] and not state['campaign']['media']['envelope']
            assert web.get(neutral_image).status_code == 403
        else:
            assert state['secret_discovered'] and state['collection_name'] == 'GADEOS'
            assert state['cards'][0]['image'] == neutral_image
            assert web.get(neutral_image).status_code == 200
        assert web.post(API + '/stations/answer', json=body).json()['reused']
    assert state['completed'] == 10
    assert web.get('/api/private-apps/gadeos/state').json()['completed'] == 10
    battle = web.post(API + '/battle/start', json={'revision': state['revision'], 'request_id': str(uuid4())})
    assert battle.status_code == 200
    # Subsequent content edits cannot make an already discovered name secret again.
    config = web.get('/admin/apps/gadeos/campaign', headers=headers).json()
    config['stations'][7]['solution'] = 'OTRA'
    assert web.put('/admin/apps/gadeos/campaign', headers=headers, json=config).status_code == 200
    assert web.get(API + '/state').json()['collection_name'] == 'GADEOS'
    catalog = web.get('/admin/apps', headers=headers).json()
    assert next(app for app in catalog['apps'] if app['id'] == 'gadeos')['path'] == PATH
    paused = web.patch('/admin/apps/gadeos', headers=headers, json={'id': 'gadeos', 'state': 'pausada', 'revision': catalog['revision']})
    assert paused.status_code == 200
    assert web.get(API + '/state').status_code == 503
    assert web.get(PATH).status_code == 503


def test_neutral_login_password_reset_and_logout_reuse_the_existing_account(client):
    web, factory = client
    headers = admin(web, factory)
    account = tribute(web, headers)
    web.cookies.clear()
    credentials = {'name': 'Alma', 'password': 'ensayo-seguro-123'}
    assert web.post(API + '/login', json=credentials).status_code == 200
    assert web.get(API + '/state').json()['account']['id'] == account['id']
    assert web.patch('/admin/apps/gadeos/accounts/' + account['id'], headers=headers,
                     json={'revision': 0, 'password': 'ensayo-nuevo-123'}).status_code == 200
    assert web.get(API + '/state').status_code == 401
    assert web.post(API + '/login', json=credentials).status_code == 401
    credentials['password'] = 'ensayo-nuevo-123'
    assert web.post(API + '/login', json=credentials).status_code == 200
    assert web.post(API + '/logout').status_code == 200
    assert web.get('/api/private-apps/gadeos/state').status_code == 401
