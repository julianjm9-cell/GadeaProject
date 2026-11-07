"""Check rewards against the saved study account, without changing old inventory."""
import json
import re
from pathlib import Path
from datetime import date
from app.models import ClientState
from sqlalchemy import select

CATALOG = json.loads((Path(__file__).parents[1] / 'data' / 'eso-catalog.json').read_text(encoding='utf-8'))
TOPICS = {topic for items in CATALOG.values() for topic in items}


def validate_reward(db, user, event, source):
    try:
        return _validate_reward(db, user, event, source)
    except (TypeError, AttributeError, OverflowError) as exc:
        raise ValueError('No se ha podido validar el resultado guardado de esta actividad.') from exc


def _validate_reward(db, user, event, source):
    row = db.scalar(select(ClientState).where(ClientState.user_id == user.id, ClientState.organization_id == user.organization_id))
    state = ((row.data or {}).get('__apps', {}).get('eso_adultos', {})) if row else {}
    done = state.get('done') or {}
    ok = False
    if event == 'LESSON_COMPLETED':
        match = re.fullmatch(r'(.+):lesson:([0-3])', source)
        ok = bool(match and match[1] in TOPICS and done.get(source))
    elif event == 'TOPIC_COMPLETED':
        ok = source in TOPICS and bool(done.get(source))
    elif event == 'SUBJECT_COMPLETED':
        ok = source in CATALOG and all(done.get(topic) or all(done.get(f'{topic}:lesson:{i}') for i in range(4)) for topic in CATALOG[source])
    elif event == 'EXERCISE_SET_COMPLETED':
        match = re.fullmatch(r'game:(quiz|pairs|quest):(.+)', source)
        result = (state.get('gameResults') or {}).get(match[2], {}).get(match[1], {}) if match else {}
        ok = bool(match and match[2] in TOPICS and float(result.get('best') or 0) >= 70)
    elif event == 'TEST_PASSED':
        ok = bool(done.get('test:'+source) and float((state.get('testAttempts') or {}).get(source, {}).get('score') or 0) >= 70)
    elif event == 'MOCK_EXAM_COMPLETED':
        ok = any(item.get('id') == source and (item.get('exam') or {}).get('correction') for item in state.get('attempts', []) if isinstance(item, dict))
    elif event == 'DAILY_SESSION_COMPLETED':
        session = state.get('activeSession') or {}
        steps = session.get('stepKeys') or []
        ok = bool(session.get('day') == source and session.get('completedAt') and steps and set(steps) <= set(session.get('completedStepKeys') or []))
    elif event == 'WEEKLY_RHYTHM_REACHED':
        days = set()
        for value in state.get('activityDates', []):
            try:
                day = date.fromisoformat(value); year, week, _ = day.isocalendar()
                if source == f'{year}-W{week:02}': days.add(day)
            except (TypeError, ValueError):
                continue
        ok = len(days) >= 4
    if not ok:
        raise ValueError('Primero guarda la actividad completada para poder registrar su recompensa.')
