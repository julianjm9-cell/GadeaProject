from uuid import UUID

from fastapi.testclient import TestClient

from test_access_control import client, login, seed_user
from test_profesor_student_access import premium

from app.main import app


def material_questions():
    return [
        {"id": "q1", "type": "quiz", "prompt": "¿Cuánto es 2 + 2?", "options": ["3", "4", "5"], "answer": "4", "explanation": "Suma dos y dos."},
        {"id": "q2", "type": "pasapalabra", "prompt": "Rosco de matemáticas", "options": ["A | Número después de cero | uno", "B | Dos más uno | tres", "C | Cinco menos uno | cuatro"], "answer": "Completado"},
        {"id": "q3", "type": "short", "prompt": "Explica tu razonamiento", "answer": "Sumé dos unidades dos veces."},
    ]


def test_material_delivery_live_progress_and_private_answers(client):
    web, factory = client
    _, teacher_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    premium(factory, teacher_id)
    login(web)
    saved = {"version": 2, "students": [{"id": "s1", "name": "María", "course": "A1", "subjects": ["Matemáticas"]}],
             "library": [{"id": "m1", "title": "Sumas", "subject": "Matemáticas", "activity": {"version": 1, "questions": material_questions()}}]}
    assert web.post("/api/state?app=profesor_particular", json=saved).status_code == 200
    access = web.post("/api/profesor/access", json={"student_id": "s1", "username": "maria.live"}).json()
    sent = web.post("/api/profesor/material-sessions", json={"access_id": access["access"]["id"], "material_id": "m1"})
    assert sent.status_code == 200, sent.text
    session_id = sent.json()["session"]["id"]
    assert web.get(f"/api/profesor/material-sessions/{session_id}").json()["session"]["status"] == "pending"
    assert web.get(f"/api/profesor/access/{access['access']['id']}/material-sessions").json()["sessions"][0]["id"] == session_id

    with TestClient(app) as pupil:
        assert pupil.post("/auth/profesor/student-login", json={"username": "maria.live", "password": access["password"]}).status_code == 200
        listed = pupil.get("/api/profesor/student-material-sessions").json()["sessions"]
        assert listed[0]["id"] == session_id and listed[0]["status"] == "pending"
        material = pupil.get(f"/api/profesor/student-material-sessions/{session_id}").json()["session"]
        assert material["questions"][0]["options"] == ["3", "4", "5"]
        assert "answer" not in str(material) and "Suma dos y dos" not in str(material)
        assert material["questions"][1]["entries"][0] == {"letter": "A", "clue": "Número después de cero"}
        assert "'solutions'" not in str(material) and "'solution'" not in str(material)
        assert pupil.get("/api/state?app=profesor_particular").status_code == 401
        started = pupil.post(f"/api/profesor/student-material-sessions/{session_id}/move", json={"action": "start"})
        assert started.status_code == 200
        assert pupil.post(f"/api/profesor/student-material-sessions/{session_id}/move", json={"action": "focus", "question_index": 1, "part": 0}).status_code == 200
        assert web.get(f"/api/profesor/material-sessions/{session_id}").json()["session"]["progress"]["focus"]["part"] == 0
        draft = pupil.post(f"/api/profesor/student-material-sessions/{session_id}/move", json={"action": "draft", "question_index": 0, "value": "3"})
        assert draft.status_code == 200
        watching = web.get(f"/api/profesor/material-sessions/{session_id}").json()["session"]
        assert watching["progress"]["responses"]["0"] == "3"
        wrong = pupil.post(f"/api/profesor/student-material-sessions/{session_id}/move", json={"action": "check", "question_index": 0, "value": "3"})
        assert wrong.json()["feedback"] == "incorrect"
        right = pupil.post(f"/api/profesor/student-material-sessions/{session_id}/move", json={"action": "check", "question_index": 0, "value": "4"})
        assert right.json()["feedback"] == "correct"
        rosco = pupil.post(f"/api/profesor/student-material-sessions/{session_id}/move", json={"action": "check", "question_index": 1, "part": 0, "value": ["uno", "", ""]})
        assert rosco.json()["feedback"] == "correct"
        assert "answer" not in str(pupil.get(f"/api/profesor/student-material-sessions/{session_id}").json())
        pupil.post(f"/api/profesor/student-material-sessions/{session_id}/move", json={"action": "draft", "question_index": 2, "value": "Lo pensé paso a paso."})
        finished = pupil.post(f"/api/profesor/student-material-sessions/{session_id}/move", json={"action": "finish"})
        assert finished.status_code == 200 and finished.json()["status"] == "completed"
        assert pupil.get("/api/profesor/student-material-sessions").json()["sessions"][0]["status"] == "completed"
        result = pupil.get(f"/api/profesor/student-material-sessions/{session_id}").json()["session"]
        assert result["progress"]["grades"]["0"] == "correct"
        assert result["progress"]["grades"]["2"] == "pending"
        assert result["questions"][0]["solution"] == "4"
        assert pupil.post(f"/api/profesor/student-material-sessions/{session_id}/move", json={"action": "draft", "question_index": 0, "value": "5"}).status_code == 409

    review = web.post(f"/api/profesor/material-sessions/{session_id}/review", json={"question_index": 2, "grade": "correct"})
    assert review.status_code == 200
    assert review.json()["session"]["progress"]["grades"]["2"] == "correct"
    assert web.get(f"/api/profesor/access/{access['access']['id']}/material-sessions").json()["sessions"] == []
    next_id = web.post("/api/profesor/material-sessions", json={"access_id": access["access"]["id"], "material_id": "m1"}).json()["session"]["id"]
    with TestClient(app) as pupil:
        pupil.post("/auth/profesor/student-login", json={"username": "maria.live", "password": access["password"]})
        visible = pupil.get("/api/profesor/student-material-sessions").json()["sessions"]
        assert [(item["id"], item["status"]) for item in visible] == [(next_id, "pending"), (session_id, "completed")]


def test_material_isolation_and_one_active_session(client):
    web, factory = client
    _, teacher_id = seed_user(factory, product_codes=("PROFESOR_PARTICULAR",))
    premium(factory, teacher_id)
    login(web)
    web.post("/api/state?app=profesor_particular", json={"students": [{"id": "s1", "name": "Uno", "subjects": ["Matemáticas"]}, {"id": "s2", "name": "Dos", "subjects": ["Matemáticas"]}], "library": [{"id": "m1", "title": "Sumas", "subject": "Matemáticas", "activity": {"questions": material_questions()}}]})
    a1 = web.post("/api/profesor/access", json={"student_id": "s1", "username": "one.live"}).json()
    a2 = web.post("/api/profesor/access", json={"student_id": "s2", "username": "two.live"}).json()
    first = web.post("/api/profesor/material-sessions", json={"access_id": a1["access"]["id"], "material_id": "m1"}).json()["session"]["id"]
    second = web.post("/api/profesor/material-sessions", json={"access_id": a1["access"]["id"], "material_id": "m1"}).json()["session"]["id"]
    own_sessions = web.get(f"/api/profesor/access/{a1['access']['id']}/material-sessions").json()["sessions"]
    assert {item["id"] for item in own_sessions} == {first, second}
    assert web.get(f"/api/profesor/access/{a2['access']['id']}/material-sessions").json()["sessions"] == []
    with TestClient(app) as other:
        other.post("/auth/profesor/student-login", json={"username": "two.live", "password": a2["password"]})
        assert other.get(f"/api/profesor/student-material-sessions/{first}").status_code == 404
        assert other.post(f"/api/profesor/student-material-sessions/{first}/move", json={"action": "start"}).status_code == 404
    with TestClient(app) as pupil:
        pupil.post("/auth/profesor/student-login", json={"username": "one.live", "password": a1["password"]})
        assert pupil.post(f"/api/profesor/student-material-sessions/{first}/move", json={"action": "start"}).status_code == 200
        assert pupil.post(f"/api/profesor/student-material-sessions/{second}/move", json={"action": "start"}).status_code == 409
        assert web.post(f"/api/profesor/material-sessions/{first}/cancel").status_code == 200
        assert pupil.get(f"/api/profesor/student-material-sessions/{first}").status_code == 410
        assert [item["id"] for item in pupil.get("/api/profesor/student-material-sessions").json()["sessions"]] == [second]
        assert pupil.post(f"/api/profesor/student-material-sessions/{second}/move", json={"action": "start"}).status_code == 200
    assert [item["id"] for item in web.get(f"/api/profesor/access/{a1['access']['id']}/material-sessions").json()["sessions"]] == [second]


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
