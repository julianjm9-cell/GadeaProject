"""Recoverable, versioned teacher saves. Snapshots share the state's transaction."""
from __future__ import annotations

import json
import zlib

from fastapi import HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models import ClientState, ProfesorStateSnapshot
from app.models.core import utcnow


HISTORY_LIMIT = 50
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


def checkpoint(db: Session, row: ClientState, reason: str) -> None:
    data = teacher_data(row)
    if not data:
        return
    existing = db.scalar(select(ProfesorStateSnapshot.id).where(
        ProfesorStateSnapshot.user_id == row.user_id,
        ProfesorStateSnapshot.revision == row.profesor_revision,
    ))
    if existing:
        return
    db.add(ProfesorStateSnapshot(
        organization_id=row.organization_id, user_id=row.user_id,
        revision=row.profesor_revision, reason=reason, counts=counts(data),
        payload_zlib=zlib.compress(json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")),
    ))
    db.flush()


def prune(db: Session, row: ClientState) -> None:
    retained = select(ProfesorStateSnapshot.id).where(
        ProfesorStateSnapshot.user_id == row.user_id,
    ).order_by(ProfesorStateSnapshot.revision.desc()).limit(HISTORY_LIMIT)
    db.execute(delete(ProfesorStateSnapshot).where(
        ProfesorStateSnapshot.user_id == row.user_id,
        ProfesorStateSnapshot.id.not_in(retained),
    ), execution_options={"synchronize_session": False})


def save_version(db: Session, row: ClientState, payload: dict, expected: int, *, reason: str = "save") -> int:
    checkpoint(db, row, "before_save")
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
    checkpoint(db, row, reason)
    prune(db, row)
    return row.profesor_revision


def unpack(snapshot: ProfesorStateSnapshot) -> dict:
    try:
        data = json.loads(zlib.decompress(snapshot.payload_zlib))
        if not isinstance(data, dict):
            raise ValueError("Snapshot is not an object")
        return data
    except (ValueError, zlib.error, UnicodeError) as exc:
        raise HTTPException(422, "No se ha podido leer esta versión. El escritorio actual no se ha modificado.") from exc
