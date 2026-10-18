import json
from pathlib import Path
from fastapi.testclient import TestClient
from test_access_control import client
import test_profesor_material_sessions as sessions
from app.main import app
from app.api.profesor_material_sessions import SUPPORTED, clean_hangman, expected_sequence, rows


def response_for(question):
    kind = question['type']
    if kind == 'memory':
        groups = {}
        for card in question['_cards']:
            groups.setdefault(card['pair'], []).append(card['token'])
        return list(groups.values())
    if kind == 'wordsearch':
        return question['_board']['positions']
    if kind == 'crossword':
        return question['_board']['words']
    if kind == 'dragdrop':
        return [row[1] for row in rows(question)]
    if kind == 'pasapalabra':
        return [row[2] for row in rows(question)]
    if kind == 'bingo':
        return [clue['answer'] for clue in question['_bingo']['clues']]
    if kind == 'hangman':
        return sorted(set(letter for letter in clean_hangman(question['answer']) if letter.isalpha()))
    if kind in {'order', 'sentence', 'timeline'}:
        return expected_sequence(question)
    if kind == 'multigaps':
        return question['options']
    if kind == 'imagepoint':
        return [50, 50]
    if kind == 'error':
        return {'selected': question['errorSegment'], 'correction': question['correctedSegment']}
    return 'correct' if kind == 'flashcard' else question['answer']


def test_all_formats_save_check_navigate_finish_and_reload_with_the_same_result(client, monkeypatch):
    from app.models import ProfesorMaterialSession
    from uuid import UUID
    fixtures = Path(__file__).resolve().parents[2] / 'apps/profesor/tests/fixtures/usability-games.json'
    questions = json.loads(fixtures.read_text(encoding='utf-8'))
    assert {q['type'] for q in questions} == SUPPORTED
    monkeypatch.setattr(sessions, 'material_questions', lambda: questions)
    teacher, factory = sessions.prepare_teacher(client)
    created = teacher.post('/api/profesor/material-sessions', json={'material_id': 'm1'}).json()['session']
    with factory() as db:
        prepared = db.get(ProfesorMaterialSession, UUID(created['id'])).material_snapshot['questions']
    expected = {}
    with TestClient(app) as pupil:
        assert pupil.post('/auth/profesor/student-join', json={'code': created['join_code']}).status_code == 200
        url = '/api/profesor/student-material-sessions/' + created['id']
        assert pupil.post(url+'/move', json={'action': 'start'}).status_code == 200
        for index, question in enumerate(prepared):
            move = {'question_index': index, 'value': response_for(question)}
            if question['type'] == 'flashcard':
                assert pupil.post(url+'/move', json={'action': 'reveal', 'question_index': index}).status_code == 200
            draft = pupil.post(url+'/move', json={**move, 'action': 'draft'})
            assert draft.status_code == 200, question['type']
            checked = pupil.post(url+'/move', json={**move, 'action': 'check'})
            assert checked.status_code == 200, (question['type'], checked.text)
            expected[str(index)] = 'pending' if question['type'] in {'reading', 'problem'} else 'correct'
            assert checked.json()['feedback'] == expected[str(index)], question['type']
            # A repeated acknowledgement must not erase a valid correction.
            pupil.post(url+'/move', json={**move, 'action': 'draft'})
            saved = pupil.get(url).json()['session']
            assert saved['progress']['responses'][str(index)] == move['value']
            assert saved['progress']['grades'][str(index)] == expected[str(index)]
            assert pupil.post(url+'/move', json={'action': 'next', 'question_index': index, 'current_index': min(index+1, len(prepared)-1)}).status_code == 200
        finished = pupil.post(url+'/move', json={'action': 'finish'}).json()['session']
        assert finished['status'] == 'completed' and finished['progress']['grades'] == expected
        assert pupil.get(url).json()['session']['progress']['grades'] == expected
        assert teacher.get('/api/profesor/material-sessions/'+created['id']).json()['session']['progress']['grades'] == expected


def test_changing_a_correct_answer_clears_stale_feedback_and_keeps_other_parts(client, monkeypatch):
    questions = [{'id': 'n', 'type': 'numeric', 'prompt': '2+2', 'answer': '4', 'options': []},
                 {'id': 'g', 'type': 'multigaps', 'prompt': '___ y ___', 'answer': 'Completado', 'options': ['sol', 'luna']}]
    monkeypatch.setattr(sessions, 'material_questions', lambda: questions)
    teacher, _ = sessions.prepare_teacher(client)
    created = teacher.post('/api/profesor/material-sessions', json={'material_id': 'm1'}).json()['session']
    with TestClient(app) as pupil:
        pupil.post('/auth/profesor/student-join', json={'code': created['join_code']})
        url = '/api/profesor/student-material-sessions/'+created['id']
        pupil.post(url+'/move', json={'action': 'start'})
        pupil.post(url+'/move', json={'action': 'check', 'value': '4'})
        pupil.post(url+'/move', json={'action': 'draft', 'value': '5'})
        assert '0' not in pupil.get(url).json()['session']['progress']['grades']
        for part in (0, 1):
            pupil.post(url+'/move', json={'action': 'check', 'question_index': 1, 'part': part, 'value': ['sol', 'luna']})
        pupil.post(url+'/move', json={'action': 'draft', 'question_index': 1, 'value': ['sol', 'estrella']})
        assert pupil.get(url).json()['session']['progress']['parts']['1'] == {'0': 'correct'}


def test_numeric_grading_uses_the_same_rounding_margin_as_personal_play():
    from app.api.profesor_material_sessions import grade
    question = {'type': 'numeric', 'answer': '0.1'}
    assert grade(question, str(0.3-0.2)) == 'correct'
    assert grade(question, '0.1000000000001') == 'incorrect'
    assert grade(question, '1e309') == 'incorrect'
    assert grade({**question, 'tolerance': 0.01}, '0.105') == 'correct'


def test_every_format_renders_for_personal_play_pupil_and_teacher_monitor():
    import shutil
    import subprocess
    from app.api.profesor_material_sessions import prepare, safe_question
    root = Path(__file__).resolve().parents[2]
    questions = json.loads((root/'apps/profesor/tests/fixtures/usability-games.json').read_text(encoding='utf-8'))
    values = [{'source': q, 'public': safe_question(prepare(q, 123), [q], False)} for q in questions]
    node = shutil.which('node')
    assert node, 'Node is needed for the shared interface contract checks'
    result = subprocess.run([node, str(root/'apps/profesor/tests/render-game-contract.cjs')], input=json.dumps(values), text=True, capture_output=True, cwd=root)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {'rendered': len(SUPPORTED), 'modes': 3}
