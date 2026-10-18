from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi.testclient import TestClient

from test_access_control import client, login, seed_user
from test_profesor_student_access import premium

from app.main import app
from app.models import ProfesorMaterialSession


def material_questions():
    return [
        {"id": "q1", "type": "quiz", "prompt": "¿Cuánto es 2 + 2?", "options": ["3", "4", "5"], "answer": "4", "explanation": "Suma dos y dos."},
        {"id": "q2", "type": "pasapalabra", "prompt": "Rosco", "options": ["A | Número después de cero | uno", "B | Dos más uno | tres"], "answer": "Completado"},
        {"id": "q3", "type": "short", "prompt": "Explica tu razonamiento", "answer": "Sumé dos unidades dos veces."},
    ]


def prepare_teacher(client):
    web, factory = client
    _, teacher_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    premium(factory, teacher_id)
    login(web)
    saved = {"version": 2, "students": [{"id": "old", "name": "Nombre antiguo", "notes": "Dato privado"}],
             "library": [{"id": "m1", "title": "Sumas", "subject": "Matemáticas", "activity": {"questions": material_questions()}}]}
    stored = web.post("/api/state?app=profesor_particular", json=saved)
    assert stored.status_code == 200
    assert stored.headers["cache-control"] == "private, no-store"
    state_response = web.get("/api/state?app=profesor_particular")
    assert state_response.headers["cache-control"] == "private, no-store"
    assert state_response.headers["x-robots-tag"] == "noindex, nofollow"
    state = state_response.json()
    assert state["students"] == saved["students"]
    return web, factory


def test_codes_are_unique_scoped_and_do_not_require_pupil_accounts(client):
    web, _ = prepare_teacher(client)
    first = web.post("/api/profesor/material-sessions", json={"material_id": "m1"})
    second = web.post("/api/profesor/material-sessions", json={"material_id": "m1"})
    assert first.status_code == second.status_code == 200
    assert first.headers["cache-control"] == "private, no-store"
    assert first.headers["referrer-policy"] == "no-referrer"
    assert first.headers["x-robots-tag"] == "noindex, nofollow"
    first_session, second_session = first.json()["session"], second.json()["session"]
    assert first_session["join_code"] != second_session["join_code"]
    assert len(first_session["join_code"]) == 10
    assert "student_name" not in first_session
    assert web.post("/api/profesor/material-sessions", json={"student_id": "old", "material_id": "m1"}).status_code == 422
    with TestClient(app) as pupil:
        assert pupil.post("/auth/profesor/student-join", json={"code": "WRONGCODE"}).status_code == 401
        joined = pupil.post("/auth/profesor/student-join", json={"code": first_session["join_code"].lower()})
        assert joined.status_code == 200
        assert joined.headers["cache-control"] == "private, no-store"
        assert pupil.get("/auth/profesor/student-me").json()["student"]["name"] == "Participante"
        listed = pupil.get("/api/profesor/student-material-sessions")
        assert [item["id"] for item in listed.json()["sessions"]] == [first_session["id"]]
        assert "Nombre antiguo" not in listed.text and "Dato privado" not in listed.text
        assert pupil.get("/api/state?app=profesor_particular").status_code == 401
        assert listed.headers["cache-control"] == "private, no-store"
        assert pupil.get(f"/api/profesor/student-material-sessions/{second_session['id']}").status_code == 404
        assert pupil.post(f"/api/profesor/student-material-sessions/{second_session['id']}/move", json={"action": "start"}).status_code == 404
        assert pupil.post(f"/api/profesor/student-material-sessions/{first_session['id']}/move", json={"action": "start"}).status_code == 200
        assert pupil.post(f"/api/profesor/student-material-sessions/{first_session['id']}/move", json={"action": "draft", "value": "4"}).status_code == 200
        watched = web.get(f"/api/profesor/material-sessions/{first_session['id']}").json()["session"]
        assert watched["progress"]["responses"]["0"] == "4"
        assert "join_code" not in pupil.get(f"/api/profesor/student-material-sessions/{first_session['id']}").text
        assert web.post(f"/api/profesor/material-sessions/{first_session['id']}/cancel").status_code == 200
        assert pupil.get("/auth/profesor/student-me").status_code == 401
        assert pupil.post("/auth/profesor/student-join", json={"code": first_session["join_code"]}).status_code == 401


def test_live_answers_are_private_and_can_be_deleted(client):
    web, factory = prepare_teacher(client)
    session = web.post("/api/profesor/material-sessions", json={"material_id": "m1"}).json()["session"]
    with TestClient(app) as pupil:
        assert pupil.post("/auth/profesor/student-join", json={"code": session["join_code"]}).status_code == 200
        material = pupil.get(f"/api/profesor/student-material-sessions/{session['id']}").json()["session"]
        assert material["questions"][0]["options"] == ["3", "4", "5"]
        assert "Suma dos y dos" not in str(material)
        assert pupil.post(f"/api/profesor/student-material-sessions/{session['id']}/move", json={"action": "start"}).status_code == 200
        assert pupil.post(f"/api/profesor/student-material-sessions/{session['id']}/move", json={"action": "check", "value": "4"}).json()["feedback"] == "correct"
        assert pupil.post(f"/api/profesor/student-material-sessions/{session['id']}/move", json={"action": "finish"}).status_code == 200
        assert pupil.get(f"/api/profesor/student-material-sessions/{session['id']}").json()["session"]["questions"][0]["solution"] == "4"
        assert web.post(f"/api/profesor/material-sessions/{session['id']}/delete").status_code == 200
        assert pupil.get("/auth/profesor/student-me").status_code == 401
        assert pupil.post("/auth/profesor/student-join", json={"code": session["join_code"]}).status_code == 401
    with factory() as db:
        assert db.get(ProfesorMaterialSession, UUID(session["id"])) is None


def test_expired_codes_and_cookies_cannot_reopen_a_session(client):
    web, factory = prepare_teacher(client)
    session = web.post("/api/profesor/material-sessions", json={"material_id": "m1"}).json()["session"]
    with TestClient(app) as pupil:
        assert pupil.post("/auth/profesor/student-join", json={"code": session["join_code"]}).status_code == 200
        with factory() as db:
            row = db.get(ProfesorMaterialSession, UUID(session["id"]))
            row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            db.commit()
        assert pupil.get("/auth/profesor/student-me").status_code == 401
        assert pupil.post("/auth/profesor/student-join", json={"code": session["join_code"]}).status_code == 401
    assert web.get("/api/profesor/material-sessions").json()["sessions"] == []
    with factory() as db:
        assert db.get(ProfesorMaterialSession, UUID(session["id"])) is None


def test_periodic_cleanup_removes_completed_responses_too(client):
    from app.api.profesor_access import purge_expired_sessions

    web, factory = prepare_teacher(client)
    expired = web.post("/api/profesor/material-sessions", json={"material_id": "m1"}).json()["session"]
    current = web.post("/api/profesor/material-sessions", json={"material_id": "m1"}).json()["session"]
    with factory() as db:
        row = db.get(ProfesorMaterialSession, UUID(expired["id"]))
        row.status = "completed"
        row.progress = {"responses": {"0": "texto que debe desaparecer"}}
        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    with factory() as db:
        assert purge_expired_sessions(db) == 1
        assert db.get(ProfesorMaterialSession, UUID(expired["id"])) is None
        assert db.get(ProfesorMaterialSession, UUID(current["id"])) is not None


def test_pasapalabra_clue_mode_without_disclosing_answers():
    from app.api.profesor_material_sessions import safe_question
    q = {'id': 'p', 'type': 'pasapalabra', 'prompt': 'Rosco', 'options': ['A | Animal doméstico | gato', 'B | Medio de transporte | barco'], 'answer': 'Completado'}
    safe = safe_question(q, [q], False)
    assert [entry['mode'] for entry in safe['entries']] == ['contains', 'starts_with']
    assert 'gato' not in str(safe) and 'barco' not in str(safe)


def test_hangman_distinguishes_enye_preserves_punctuation_and_hides_answer():
    from app.api.profesor_material_sessions import grade, safe_question
    q = {'id': 'h', 'type': 'hangman', 'prompt': 'Una persona pequeña', 'answer': 'NIÑO-2'}
    safe = safe_question(q, [q], False, response=['N', 'I', 'O'])
    assert safe['mask'] == 'NI_O-2' and safe['errors'] == 0
    assert 'answer' not in safe and 'solution' not in safe
    assert grade(q, ['N', 'I', 'O']) == 'unanswered'
    assert grade(q, ['N', 'I', 'Ñ', 'O']) == 'correct'
    assert safe_question(q, [q], False, response=['N', 'X'])['errors'] == 1


def test_wordsearch_accepts_alternative_occurrences_and_rejects_invalid_paths():
    from app.api.profesor_material_sessions import grade
    q = {'type': 'wordsearch', '_board': {'grid': [list('CASA'), list('CASA'), list('XXXX'), list('XXXX')], 'words': ['CASA'], 'positions': [[[0, c] for c in range(4)]]}}
    alternative = [[1, c] for c in range(4)]
    assert grade(q, [alternative], 0) == 'correct'
    assert grade(q, [alternative[::-1]], 0) == 'correct'
    assert grade(q, [alternative]) == 'correct'
    for invalid in [[[0, 0], [0, 1], [1, 2], [1, 3]], [[0, 0]] * 4, [[-1, c] for c in range(4)], [[True, c] for c in range(4)], [[4, c] for c in range(4)], [[0, 0], [0, 1]]]:
        assert grade(q, [invalid], 0) == 'incorrect'


def test_game_grading_does_not_send_hidden_keys():
    from app.api.profesor_material_sessions import grade, prepare, safe_question
    pasapalabra = prepare({"id": "p", "type": "pasapalabra", "prompt": "Rosco", "options": ["A | Pista | Azul", "B | Pista | Barco"], "answer": "Completado"}, 1)
    assert "Azul" not in str(safe_question(pasapalabra, [pasapalabra], False))
    assert grade(pasapalabra, ["Azul", "Baco"], 0) == "correct"
    assert grade(pasapalabra, ["Azul", "Baco"], 1) == "incorrect"
    memory = prepare({"id": "m", "type": "memory", "prompt": "Parejas", "options": ["perro | dog", "gato | cat"], "answer": "Completado"}, 2)
    cards = memory["_cards"]
    pair = [card["token"] for card in cards if card["pair"] == 0]
    assert grade(memory, [pair], 0) == "correct"
    assert grade(memory, [pair]) == "incorrect"
    assert all("pair" not in card for card in safe_question(memory, [memory], False)["cards"])


def test_sentence_legacy_order_short_answers_and_hidden_cloze_solutions():
    from app.api.profesor_material_sessions import expected_sequence, grade, safe_question
    sentence = {"type": "sentence", "prompt": "Ordena", "options": ["multiplica ambos términos.", "Para obtener fracciones equivalentes,", "así mantienes el valor."], "answer": "Ordena"}
    corrected = [sentence["options"][1], sentence["options"][0], sentence["options"][2]]
    assert expected_sequence(sentence) == corrected
    assert grade(sentence, corrected) == "correct"
    assert grade(sentence, sentence["options"]) == "incorrect"
    short = {"type": "short", "prompt": "Past of go", "answer": "went", "alternatives": ["had gone"]}
    assert grade(short, "went.") == "correct"
    assert grade(short, "goed") == "incorrect"
    assert grade(short, "had gone") == "correct"
    subjective = {"type": "short", "answer": "Puede expresarse como fracción de enteros."}
    assert grade(subjective, "Una fracción") == "pending"
    cloze = {"type": "multigaps", "prompt": "Debe **___ (simplificar) y ___ (factorizar)**.", "options": ["simplificar", "factorizar"]}
    public = safe_question(cloze, [cloze], False)
    assert public["prompt"] == "Debe ___ y ___."
    assert "options" not in public


def test_error_correction_requires_selection_and_never_exposes_solution():
    from app.api.profesor_material_sessions import grade, prepare, safe_question

    question = prepare({"id": "error", "type": "error", "prompt": "Corrige: Tú trajistes el libro.",
                        "answer": "Tú trajiste el libro.", "errorSegment": "trajistes",
                        "correctedSegment": "trajiste", "options": []}, 1)
    public = safe_question(question, [question], False)
    assert "correctedSegment" not in public and "errorSegment" not in public
    assert grade(question, {"selected": "", "correction": "trajiste"}) == "unanswered"
    assert grade(question, {"selected": "trajistes", "correction": "trajistes"}) == "incorrect"
    assert grade(question, {"selected": "trajistes", "correction": "trajiste"}) == "correct"
    assert grade({**question, "correctedSegment": ""}, {"selected": "trajistes", "correction": "trajiste"}) == "pending"


def test_timeline_uses_dates_even_for_older_unsorted_materials():
    from app.api.profesor_material_sessions import grade, prepare

    question = prepare({"id": "timeline", "type": "timeline", "prompt": "Ordena los hechos.",
                        "answer": "1901, 1910, 1920", "options": ["1910 – Segundo", "1901 – Primero", "1920 – Tercero"]}, 1)
    assert grade(question, ["1901 – Primero", "1910 – Segundo", "1920 – Tercero"]) == "correct"
    assert grade(question, question["options"]) == "incorrect"


def test_every_generated_activity_type_can_be_prepared_for_a_student():
    from app.api.profesor_material_sessions import SUPPORTED, grade, prepare, safe_question

    base = {"id": "sample", "prompt": "Ejercicio", "answer": "Correcto", "options": ["Incorrecto", "Correcto"]}
    overrides = {
        "multigaps": {"options": ["uno", "dos"], "answer": "Completado"},
        "numeric": {"answer": "1.5", "options": []},
        "order": {"options": ["primero", "segundo"], "answer": "primero → segundo"},
        "sentence": {"options": ["Hola", "mundo"], "answer": "Hola → mundo"},
        "timeline": {"options": ["ayer", "hoy"], "answer": "ayer → hoy"},
        "memory": {"options": ["perro | dog", "gato | cat"], "answer": "Completado"},
        "wordsearch": {"options": ["CASA", "PERRO", "SOL"], "answer": "Completado"},
        "crossword": {"options": ["CASA | Vivienda", "SOL | Astro", "SAL | Condimento"], "answer": "Completado"},
        "dragdrop": {"options": ["uno | número", "dos | cantidad"], "answer": "Completado"},
        "pasapalabra": {"options": ["A | Ave | Águila", "B | Embarcación | Barco"], "answer": "Completado"},
        "hangman": {"answer": "CASA", "options": []},
        "imagepoint": {"answer": "Zona marcada", "options": [], "target": {"x": 50, "y": 50}},
        "flashcard": {"answer": "Reverso", "options": []},
        "mystery": {"answer": "Gato", "options": ["Es un animal", "Es un felino doméstico", "Suele maullar"]},
        "intruder": {"answer": "Piedra", "options": ["Gato", "Perro", "Piedra"]},
        "bingo": {"answer": "Completado", "options": [f"Concepto {i} | Definición número {i}" for i in range(9)]},
    }
    from pathlib import Path
    import json
    overrides.update({q['type']:q for q in json.loads((Path(__file__).resolve().parents[2]/'apps/profesor/tests/fixtures/challenge-games.json').read_text(encoding='utf-8'))})
    for kind in SUPPORTED:
        source = {**base, **overrides.get(kind, {}), "type": kind}
        question = prepare(source, 123)
        public = safe_question(question, [question], False)
        assert "answer" not in public and "solution" not in public, kind
        assert public["type"] == kind
        if kind == "crossword":
            assert public["entries"] and public["grid"]
        if kind == "wordsearch":
            assert public["words"] and public["grid"]
        if kind == "memory":
            assert all("pair" not in card for card in public["cards"])
        if kind == "pasapalabra":
            assert all("answer" not in entry for entry in public["entries"])
    assert grade(prepare({**base, "type": "numeric", "answer": "1.5"}, 1), "3/2") == "correct"
    assert grade(prepare({**base, "type": "imagepoint", "target": {"x": 50, "y": 50}}, 1), [51, 49]) == "correct"


def test_flashcard_reveal_and_self_assessment_survive_reload(client, monkeypatch):
    """Turning a card reveals content; it must not submit an assessment."""
    import sys
    monkeypatch.setattr(sys.modules[__name__], 'material_questions', lambda: [
        {'id': 'flash', 'type': 'flashcard', 'prompt': 'Capital de Francia',
         'answer': 'París', 'options': []}
    ])
    web, _ = prepare_teacher(client)
    session = web.post('/api/profesor/material-sessions', json={'material_id': 'm1'}).json()['session']
    with TestClient(app) as pupil:
        assert pupil.post('/auth/profesor/student-join', json={'code': session['join_code']}).status_code == 200
        path = f"/api/profesor/student-material-sessions/{session['id']}"
        assert pupil.post(path + '/move', json={'action': 'start'}).status_code == 200
        before = pupil.get(path).json()['session']
        assert 'revealed_answer' not in before['questions'][0]
        assert 'París' not in str(before)
        assert pupil.post(path + '/move', json={'action': 'check', 'value': 'correct'}).status_code == 409
        revealed = pupil.post(path + '/move', json={'action': 'reveal'})
        assert revealed.status_code == 200 and revealed.json()['feedback'] == 'París'
        after = pupil.get(path).json()['session']
        assert after['questions'][0]['revealed_answer'] == 'París'
        assert not after['progress'].get('grades', {}).get('0')
        for value in ['partial', 'correct']:
            assert pupil.post(path + '/move', json={'action': 'check', 'value': value}).status_code == 200
            saved = pupil.get(path).json()['session']
            assert saved['progress']['responses']['0'] == value
            assert saved['progress']['grades']['0'] == value
        finished = pupil.post(path + '/move', json={'action': 'finish'}).json()['session']
        assert finished['status'] == 'completed'
        assert finished['progress']['grades']['0'] == 'correct'


def test_sentence_draft_preserves_duplicates_and_clears_previous_grade(client, monkeypatch):
    import sys
    pieces=['I','like','tea','and','I','like','coffee.']
    monkeypatch.setattr(sys.modules[__name__], 'material_questions', lambda: [
        {'id':'sentence','type':'sentence','prompt':'Ordena la frase.',
         'options':pieces,'answer':' → '.join(pieces)}
    ])
    web,_=prepare_teacher(client)
    session=web.post('/api/profesor/material-sessions',json={'material_id':'m1'}).json()['session']
    with TestClient(app) as pupil:
        assert pupil.post('/auth/profesor/student-join',json={'code':session['join_code']}).status_code==200
        path=f"/api/profesor/student-material-sessions/{session['id']}"
        pupil.post(path+'/move',json={'action':'start'})
        assert pupil.post(path+'/move',json={'action':'check','value':pieces}).json()['feedback']=='correct'
        changed=['I','like']
        assert pupil.post(path+'/move',json={'action':'draft','value':changed}).status_code==200
        reloaded=pupil.get(path).json()['session']
        assert reloaded['progress']['responses']['0']==changed
        assert '0' not in reloaded['progress'].get('grades',{})
        assert pupil.post(path+'/move',json={'action':'check','value':pieces}).json()['feedback']=='correct'
        assert pupil.get(path).json()['session']['progress']['responses']['0'].count('I')==2


def test_timeline_partial_order_and_reset_clear_saved_feedback(client, monkeypatch):
    import sys
    events=['1901 – Fundación','1910 – Primera edición','1920 – Ampliación']
    monkeypatch.setattr(sys.modules[__name__], 'material_questions', lambda: [
        {'id':'timeline','type':'timeline','prompt':'Ordena los acontecimientos.',
         'options':events,'answer':' → '.join(events)}
    ])
    web,_=prepare_teacher(client)
    session=web.post('/api/profesor/material-sessions',json={'material_id':'m1'}).json()['session']
    with TestClient(app) as pupil:
        assert pupil.post('/auth/profesor/student-join',json={'code':session['join_code']}).status_code==200
        path=f"/api/profesor/student-material-sessions/{session['id']}"
        pupil.post(path+'/move',json={'action':'start'})
        assert pupil.post(path+'/move',json={'action':'draft','value':events[:1]}).status_code==200
        assert pupil.get(path).json()['session']['progress']['responses']['0']==events[:1]
        result=pupil.post(path+'/move',json={'action':'check','value':events}).json()
        assert result['feedback']=='correct'
        assert result['session']['progress']['parts']['0']=={'0':'correct','1':'correct','2':'correct'}
        assert pupil.post(path+'/move',json={'action':'draft','value':[]}).status_code==200
        reset=pupil.get(path).json()['session']['progress']
        assert reset['responses']['0']==[]
        assert '0' not in reset.get('grades',{}) and '0' not in reset.get('parts',{})


def test_crossword_and_matching_check_all_and_edit_survive_reload(client, monkeypatch):
    import sys
    questions = [
        {'id':'cross','type':'crossword','prompt':'Completa el tablero.',
         'options':['CASA | Lugar donde vives','SACO | Bolsa grande'],'answer':'Completado'},
        {'id':'match','type':'dragdrop','prompt':'Clasifica los animales.',
         'options':['Gato | Mamífero','Perro | Mamífero','Águila | Ave'],'answer':'Completado'},
    ]
    monkeypatch.setattr(sys.modules[__name__], 'material_questions', lambda: questions)
    web, _ = prepare_teacher(client)
    session = web.post('/api/profesor/material-sessions', json={'material_id':'m1'}).json()['session']
    with TestClient(app) as pupil:
        pupil.post('/auth/profesor/student-join', json={'code':session['join_code']})
        path = f"/api/profesor/student-material-sessions/{session['id']}"
        pupil.post(path+'/move', json={'action':'start'})
        initial = pupil.get(path).json()['session']
        assert 'CASA' not in str(initial['questions'][0]) and 'SACO' not in str(initial['questions'][0])
        for index, partial, expected in [(0, ['CA_A','XXXX'], ['CASA','SACO']), (1, ['Mamífero','','Mamífero'], ['Mamífero','Mamífero','Ave'])]:
            result = pupil.post(path+'/move', json={'action':'check','question_index':index,'value':partial}).json()['session']
            assert result['progress']['parts'][str(index)] == ({'0':'unanswered','1':'incorrect'} if index==0 else {'0':'correct','1':'unanswered','2':'incorrect'})
            result = pupil.post(path+'/move', json={'action':'check','question_index':index,'value':expected}).json()['session']
            assert result['progress']['grades'][str(index)] == 'correct'
            assert all(value=='correct' for value in result['progress']['parts'][str(index)].values())
            pupil.post(path+'/move', json={'action':'draft','question_index':index,'value':partial})
            saved = pupil.get(path).json()['session']['progress']
            assert saved['responses'][str(index)] == partial
            assert str(index) not in saved['grades'] and str(index) not in saved['parts']
            pupil.post(path+'/move', json={'action':'check','question_index':index,'value':expected})
        finished = pupil.post(path+'/move', json={'action':'finish'}).json()['session']
        assert finished['progress']['grades'] == {'0':'correct','1':'correct'}


def test_inline_error_selection_position_persists_without_revealing_answer(client, monkeypatch):
    import sys
    monkeypatch.setattr(sys.modules[__name__], 'material_questions', lambda: [
        {'id':'error','type':'error','prompt':'Corrige: Tú trajistes el libro.',
         'errorSegment':'trajistes','correctedSegment':'trajiste','answer':'Tú trajiste el libro.'}
    ])
    web, _ = prepare_teacher(client)
    session = web.post('/api/profesor/material-sessions', json={'material_id':'m1'}).json()['session']
    with TestClient(app) as pupil:
        pupil.post('/auth/profesor/student-join', json={'code':session['join_code']})
        path = f"/api/profesor/student-material-sessions/{session['id']}"
        pupil.post(path+'/move', json={'action':'start'})
        assert 'correctedSegment' not in pupil.get(path).text
        value = {'selected':'trajistes','correction':'trajiste','selection':[1,1]}
        pupil.post(path+'/move', json={'action':'draft','value':value})
        assert pupil.get(path).json()['session']['progress']['responses']['0'] == value
        assert pupil.post(path+'/move', json={'action':'check','value':value}).json()['feedback'] == 'correct'
        wrong = {**value, 'correction':'trajistes'}
        assert pupil.post(path+'/move', json={'action':'check','value':wrong}).json()['feedback'] == 'incorrect'
