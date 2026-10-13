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
    assert web.post("/api/state?app=profesor_particular", json=saved).status_code == 200
    state = web.get("/api/state?app=profesor_particular").json()
    assert "students" not in state and "Nombre antiguo" not in str(state)
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
    }
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
