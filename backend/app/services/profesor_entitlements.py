"""Server-owned plan limits, independent of editable teacher materials."""
import json
from datetime import datetime, timedelta, time, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select

from app.models import AppSetting, User
from app.services.licenses import profesor_account_plan

ADVANCED_TYPES = frozenset(('pasapalabra', 'hangman', 'wordsearch', 'memory', 'flashcard', 'sentence', 'timeline', 'error', 'crossword', 'dragdrop', 'mystery', 'intruder', 'bingo'))
STUDENT_LIMIT = 3
ZONE = ZoneInfo('Europe/Madrid')


def now():
    return datetime.now(timezone.utc)


def advanced(context):
    return any(context.get(kind, 0) for kind in ADVANCED_TYPES)


def quota_row(db, user, *, lock=False):
    if lock:
        db.scalar(select(User).where(User.id == user.id).with_for_update())
    row = db.get(AppSetting, 'profesor_advanced_quota:' + str(user.id), populate_existing=True)
    return row, json.loads(row.value) if row else {}


def limits(db, user, license_obj):
    premium = profesor_account_plan(license_obj) == 'premium'
    clock = now().astimezone(ZONE)
    _, quota = quota_row(db, user)
    used = quota.get('used_day') == clock.date().isoformat()
    reset = datetime.combine(clock.date() + timedelta(days=1), time.min, ZONE)
    return {'plan': 'premium' if premium else 'normal', 'student_limit': None if premium else STUDENT_LIMIT,
            'advanced_ai': {'limit': None if premium else 1, 'remaining': None if premium else int(not used),
                            'reset_at': reset.isoformat(), 'time_zone': 'Europe/Madrid'}}


def validate_students(previous, incoming, license_obj):
    if profesor_account_plan(license_obj) == 'premium':
        return
    before, after = previous.get('students', []), incoming.get('students', [])
    # Existing profiles survive a downgrade and remain editable. Only additions
    # above the free allowance are refused; nothing is truncated or deleted.
    ids = {item.get('id') for item in before if isinstance(item, dict) and isinstance(item.get('id'), str)}
    if len(after) > STUDENT_LIMIT and (len(after) > len(before) or any(
            not isinstance(item, dict) or not isinstance(item.get('id'), str) or item.get('id') not in ids for item in after)):
        raise HTTPException(403, detail={'code': 'student_limit', 'message':
            'La cuenta normal permite hasta 3 alumnos. Activa Premium para añadir más.'})


def reserve(db, user, license_obj, context, request_id):
    if not advanced(context) or profesor_account_plan(license_obj) == 'premium':
        return
    row, quota = quota_row(db, user, lock=True)
    clock = now()
    if quota.get('used_day') == clock.astimezone(ZONE).date().isoformat() and quota.get('used_request_id') != request_id:
        raise HTTPException(403, detail={'code': 'advanced_daily_limit', 'message':
            'Ya has generado tu juego avanzado con IA de hoy. Puedes generar otro a las 00:00 (hora de Madrid), prepararlo manualmente o activar Premium.'})
    stamp = datetime.fromisoformat(quota['pending_at']) if quota.get('pending_at') else None
    if quota.get('pending_request_id') not in (None, request_id) and stamp and stamp > clock - timedelta(minutes=30):
        raise HTTPException(409, 'Ya hay un juego avanzado en preparación. Recupera ese intento antes de generar otro.')
    quota.update(pending_request_id=request_id, pending_at=clock.isoformat())
    if row is None:
        row = AppSetting(key='profesor_advanced_quota:' + str(user.id))
        db.add(row)
    row.value = json.dumps(quota)
    db.flush()


def complete(db, user, license_obj, context, request_id):
    if not advanced(context) or profesor_account_plan(license_obj) == 'premium':
        return
    # Recheck under the final accounting lock, including a day change in flight.
    reserve(db, user, license_obj, context, request_id)
    row, quota = quota_row(db, user)
    quota.update(used_day=now().astimezone(ZONE).date().isoformat(), used_request_id=request_id)
    quota.pop('pending_request_id', None)
    quota.pop('pending_at', None)
    row.value = json.dumps(quota)


def release(db, user, request_id):
    row, quota = quota_row(db, user, lock=True)
    if row and quota.get('pending_request_id') == request_id:
        quota.pop('pending_request_id', None)
        quota.pop('pending_at', None)
        row.value = json.dumps(quota)
