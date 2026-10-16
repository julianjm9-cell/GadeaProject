from test_access_control import client, seed_user, login
from app.api import auth as auth_api
from app.models import License


def test_profile_and_password_changes_preserve_teacher_data(client):
    web, factory = client
    assert web.post('/auth/change-password', json={'current_password':'temporal123','new_password':'NuevaClave123'}).status_code == 401
    seed_user(factory, product_codes=('PROFESOR_PARTICULAR',))
    assert login(web).status_code == 200
    data = {'version':2,'students':[{'id':'kept-student','name':'Alumno'}],'library':[{'id':'kept-material'}]}
    assert web.post('/api/state?app=profesor_particular', json=data).status_code == 200
    assert web.post('/api/profile?app=profesor_particular', json={'name':'Nombre nuevo'}).status_code == 200
    assert web.post('/auth/change-password', json={'current_password':'wrong','new_password':'NuevaClave123'}).status_code == 400
    assert web.post('/auth/change-password', json={'current_password':'temporal123','new_password':'short'}).status_code == 422
    assert web.post('/auth/change-password', json={'current_password':'temporal123','new_password':'NuevaClave123'}).status_code == 200
    web.post('/auth/logout')
    assert login(web).status_code == 401
    assert login(web,password='NuevaClave123').status_code == 200
    assert web.get('/auth/me').json()['user']['full_name'] == 'Nombre nuevo'
    saved=web.get('/api/state?app=profesor_particular').json()
    assert saved['students'] == data['students']
    assert saved['library'] == data['library']


def test_signup_has_no_personal_content_and_public_assets_work(client):
    web,_=client
    result=web.post('/auth/profesor/register',json={'email':'new-teacher@example.com','full_name':'Nuevo profesor','password':'Prueba12345'})
    assert result.status_code == 201
    state=web.get('/api/state?app=profesor_particular').json()
    assert not state.get('students') and not state.get('library')
    assert state['teacherProfile']['plan'] == 'premium'
    assert web.get('/api/profesor/material-sessions').status_code == 200
    for path in ['/profesor','/profesor/login']:
        html=web.get(path).text
        assert 'educamesuite@gmail.com' in html and 'profesorparticularapp' in html
    html=web.get('/profesor/demo').text
    assert 'src="/temario-presentation.js' in html
    for path in ['/assets/landing/profesor-materiales.png','/assets/landing/profesor-dashboard.png','/assets/landing/profesor-mobile.png']:
        response=web.get(path)
        assert response.status_code == 200 and response.content.startswith(b'\x89PNG')
    for path in ['/assets/games/pasapalabra-stage.png', '/assets/games/wordsearch-stage.png', '/assets/games/memory-stage.png', '/assets/games/flashcard-stage.png', '/assets/games/sentence-stage.png', '/assets/games/timeline-stage.png']:
        response=web.get(path)
        assert response.status_code == 200 and response.content.startswith(b'\x89PNG')
    assert web.get('/assets/profesor-wordsearch-theme.css').status_code == 200
    memory_theme = web.get('/assets/profesor-memory-theme.css')
    assert memory_theme.status_code == 200 and 'memory-stage.png' in memory_theme.text
    assert '/assets/profesor-memory-theme.css' in web.get('/profesor/alumno').text
    flashcard_theme=web.get('/assets/profesor-flashcard-theme.css')
    assert flashcard_theme.status_code == 200 and 'flashcard-stage.png' in flashcard_theme.text
    assert '/assets/profesor-flashcard-theme.css' in web.get('/profesor/alumno').text


def test_signup_plan_changes_only_future_teacher_accounts(client, monkeypatch):
    web, factory = client
    assert web.get('/auth/profesor/signup-settings').json()['plan'] == 'premium'
    first = {'email': 'premium@example.com', 'full_name': 'Primera profesora', 'password': 'Prueba12345'}
    second = {'email': 'normal@example.com', 'full_name': 'Segundo profesor', 'password': 'Prueba12345'}
    assert web.post('/auth/profesor/register', json=first).status_code == 201
    monkeypatch.setattr(auth_api.get_settings(), 'profesor_signup_plan', 'PROFESOR_FREE')
    assert web.get('/auth/profesor/signup-settings').json()['plan'] == 'normal'
    assert web.post('/auth/profesor/register', json=second).status_code == 201
    assert web.get('/api/state?app=profesor_particular').json()['teacherProfile']['plan'] == 'normal'
    with factory() as db:
        assert {license_obj.plan for license_obj in db.query(License).filter(License.product_code == 'PROFESOR_PARTICULAR')} == {'PROFESOR_PREMIUM', 'PROFESOR_FREE'}
    web.post('/auth/logout')
    assert web.post('/auth/login', json={'identifier': first['email'], 'password': first['password'], 'enroll_profesor': True}).status_code == 200
    assert web.get('/api/state?app=profesor_particular').json()['teacherProfile']['plan'] == 'premium'


def test_new_google_teacher_gets_the_same_premium_plan(client):
    _, factory = client
    with factory() as db:
        auth_api.get_or_create_google_user(db, {'email': 'google-teacher@example.com', 'sub': 'teacher-google-sub', 'name': 'Profesora Google', 'email_verified': True}, ('PROFESOR_PARTICULAR',))
        db.commit()
        plans = [license_obj.plan for license_obj in db.query(License).filter(License.product_code == 'PROFESOR_PARTICULAR')]
        assert plans == ['PROFESOR_PREMIUM']


def test_sentence_board_is_served_for_personal_and_shared_players(client):
    web,_=client
    assert 'profesorSentenceBoard' in web.get('/profesor-sentence-board.js').text
    css=web.get('/assets/profesor-sentence-theme.css')
    assert css.status_code==200 and 'sentence-stage.png' in css.text
    for path in ['/profesor/demo','/profesor/alumno']:
        assert 'profesor-sentence-board.js' in web.get(path).text


def test_timeline_theme_is_served_to_both_players(client):
    web,_=client
    css=web.get('/assets/profesor-timeline-theme.css')
    assert css.status_code==200 and 'timeline-stage.png' in css.text
    for path in ['/profesor/demo','/profesor/alumno']:
        assert 'profesor-timeline-theme.css' in web.get(path).text
