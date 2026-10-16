"""Immediate versioned saves, five daily backups, and lightweight save receipts."""
from __future__ import annotations

import json
import zlib
import hashlib
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import delete, select, text, update
from sqlalchemy.orm import Session

from app.models import AppSetting, AuditLog, ClientState, ProfesorStateSnapshot
from app.models.core import utcnow


HISTORY_LIMIT = 5
RECEIPT_LIMIT = 50
BACKUP_ZONE = ZoneInfo("Europe/Madrid")
SCHEDULE_KEY = "profesor_history_last_daily_backup"
COLLECTIONS = ("students", "sessions", "library", "tasks", "assignments", "bundles",
               "personalTopics", "uploadedTopics", "activityAttempts")


def teacher_data(row: ClientState) -> dict:
    data = row.data or {}
    return data.get("__apps", {}).get("profesor_particular", {})


def counts(data: dict) -> dict:
    return {key: len(data.get(key, [])) for key in COLLECTIONS if isinstance(data.get(key, []), list)}


def etag(revision: int) -> str:
    return f'"profesor-{revision}"'


def check_revision(row: ClientState, supplied: str | None) -> int:
    revision = row.profesor_revision
    # A legacy first save into a genuinely empty account is safe. Once any data
    # exists, old tabs must reload the client which sends a version on every save.
    if supplied is None and revision == 0 and not teacher_data(row):
        return revision
    if supplied is None:
        raise HTTPException(428, detail={"code": "state_version_required", "message":
            "Esta pestaña necesita actualizarse antes de guardar. Tus datos guardados siguen intactos. Revisa el guardado para conservar tus cambios pendientes."})
    if supplied != etag(revision):
        raise HTTPException(409, detail={"code": "state_conflict", "message":
            "Hay una versión más reciente guardada desde otra pestaña o dispositivo. No se ha sobrescrito. Revisa el guardado para conservar tus cambios pendientes."})
    return revision


def validate_transition(previous: dict, incoming: dict, *, confirm_empty: bool = False) -> None:
    for key in COLLECTIONS:
        if key in incoming and not isinstance(incoming[key], list):
            raise HTTPException(422, f"Datos no válidos en {key}. No se ha modificado tu escritorio.")
        if previous.get(key) and key not in incoming:
            raise HTTPException(422, f"Faltan datos de {key} en el guardado. No se ha modificado tu escritorio.")
    if not confirm_empty and sum(counts(previous).values()) > 0 and sum(counts(incoming).values()) == 0:
        raise HTTPException(409, detail={"code": "state_empty", "message":
            "El guardado dejaría vacío tu escritorio. Lo hemos detenido para proteger tus datos. Revisa el guardado si quieres confirmar ese cambio."})


def checkpoint(db: Session, row: ClientState, reason: str, *, backup_day: date | None = None, now: datetime | None = None) -> None:
    data = teacher_data(row)
    if not data:
        return
    query = select(ProfesorStateSnapshot.id).where(ProfesorStateSnapshot.user_id == row.user_id)
    query = query.where(ProfesorStateSnapshot.backup_day == backup_day) if backup_day else query.where(ProfesorStateSnapshot.revision == row.profesor_revision)
    existing = db.scalar(query.limit(1))
    if existing:
        return
    db.add(ProfesorStateSnapshot(
        organization_id=row.organization_id, user_id=row.user_id,
        revision=row.profesor_revision, reason=reason, backup_day=backup_day, counts=counts(data), created_at=now or utcnow(),
        payload_zlib=zlib.compress(json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")),
    ))
    db.flush()
    prune(db, row)


def prune(db: Session, row: ClientState) -> None:
    retained = select(ProfesorStateSnapshot.id).where(
        ProfesorStateSnapshot.user_id == row.user_id,
    ).order_by(ProfesorStateSnapshot.created_at.desc(), ProfesorStateSnapshot.revision.desc(), ProfesorStateSnapshot.id.desc()).limit(HISTORY_LIMIT)
    db.execute(delete(ProfesorStateSnapshot).where(
        ProfesorStateSnapshot.user_id == row.user_id,
        ProfesorStateSnapshot.id.not_in(retained),
    ), execution_options={"synchronize_session": False})


def save_version(db: Session, row: ClientState, payload: dict, expected: int, *, reason: str = "save") -> int:
    previous = teacher_data(row)
    if reason == "restore" or (sum(counts(previous).values()) and not sum(counts(payload).values())):
        checkpoint(db, row, "before_restore" if reason == "restore" else "before_clear")
    # Preserve the other products sharing this row. The caller holds its row lock.
    current = row.data or {}
    apps = dict(current.get("__apps", {}))
    if current and "__apps" not in current:
        apps["diplomator"] = current
    apps["profesor_particular"] = payload
    result = db.execute(update(ClientState).where(
        ClientState.id == row.id, ClientState.profesor_revision == expected,
    ).values(data={"__apps": apps}, profesor_revision=expected + 1, updated_at=utcnow()),
        execution_options={"synchronize_session": False})
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, detail={"code": "state_conflict", "message":
            "Otra pestaña ha guardado cambios. No se ha sobrescrito tu información. Revisa el guardado."})
    db.refresh(row)
    # Hashes prove legitimate concurrent saves during deployment without storing
    # another full private desktop on every edit. They cannot restore content.
    def digest(value):
        return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()
    db.add(AuditLog(actor_user_id=row.user_id, organization_id=row.organization_id,
        action="profesor_state_saved", entity_type="client_state", entity_id=str(row.id),
        log_metadata={"previous_revision": expected, "revision": row.profesor_revision,
                      "previous_digest": digest(previous), "digest": digest(payload)}))
    db.flush()
    retained = select(AuditLog.id).where(AuditLog.action == "profesor_state_saved", AuditLog.entity_type == "client_state",
        AuditLog.entity_id == str(row.id)).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(RECEIPT_LIMIT)
    db.execute(delete(AuditLog).where(AuditLog.action == "profesor_state_saved", AuditLog.entity_type == "client_state",
        AuditLog.entity_id == str(row.id), AuditLog.id.not_in(retained)), execution_options={"synchronize_session": False})
    return row.profesor_revision


def next_midnight(now: datetime | None = None) -> datetime:
    now = now or utcnow()
    tomorrow = now.astimezone(BACKUP_ZONE).date() + timedelta(days=1)
    return datetime.combine(tomorrow, time.min, BACKUP_ZONE).astimezone(timezone.utc)


def trim_backup_history(factory) -> None:
    # Covers a last write by an old backend between migration and container swap.
    with factory() as db:
        db.execute(text("""DELETE FROM profesor_state_snapshots WHERE id IN (
            SELECT id FROM (SELECT id, ROW_NUMBER() OVER (
                PARTITION BY user_id ORDER BY created_at DESC, revision DESC, id DESC
            ) AS position FROM profesor_state_snapshots) ranked WHERE position > 5)"""))
        db.commit()


def run_daily_backups(factory, *, now: datetime | None = None) -> int:
    """One copy per account/Madrid date; resume partial or missed runs on restart."""
    clock_override = now
    now = now or utcnow()
    today = now.astimezone(BACKUP_ZONE).date()
    with factory() as db:
        setting = db.get(AppSetting, SCHEDULE_KEY)
        if setting is None:
            # First installation starts at the next midnight, not mid-afternoon.
            db.add(AppSetting(key=SCHEDULE_KEY, value=today.isoformat()))
            db.commit()
            return 0
        if setting.value >= today.isoformat():
            return 0
        ids = list(db.scalars(select(ClientState.id).order_by(ClientState.id)))
    processed = 0
    for state_id in ids:
        # A separate short transaction per account releases its lock promptly.
        with factory() as db:
            row = db.scalar(select(ClientState).where(ClientState.id == state_id).with_for_update())
            if row and teacher_data(row):
                checkpoint(db, row, "daily", backup_day=today, now=clock_override or utcnow())
                processed += 1
            db.commit()
    with factory() as db:
        setting = db.scalar(select(AppSetting).where(AppSetting.key == SCHEDULE_KEY).with_for_update())
        if setting and setting.value < today.isoformat():
            setting.value = today.isoformat()
        db.commit()
    return processed


def unpack(snapshot: ProfesorStateSnapshot) -> dict:
    try:
        data = json.loads(zlib.decompress(snapshot.payload_zlib))
        if not isinstance(data, dict):
            raise ValueError("Snapshot is not an object")
        return data
    except (ValueError, zlib.error, UnicodeError) as exc:
        raise HTTPException(422, "No se ha podido leer esta versión. El escritorio actual no se ha modificado.") from exc
