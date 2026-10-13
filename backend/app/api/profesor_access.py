"""Anonymous, single-session access to shared teacher materials."""
from __future__ import annotations

import base64
import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database.session import get_db
from app.models import ProfesorMaterialSession, User
from app.services.licenses import check_access, profesor_account_plan

router = APIRouter(tags=["profesor-student-access"])
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
SESSION_LIFETIME = timedelta(hours=24)


class StudentCode(BaseModel):
    code: str = Field(min_length=1, max_length=24)


def teacher_premium(db: Session, user: User) -> None:
    decision = check_access(db, user, "PROFESOR_PARTICULAR", require_credits=False)
    if not decision.ok or not decision.license:
        raise HTTPException(403, "Esta cuenta no tiene acceso a Profesor Particular.")
    if profesor_account_plan(decision.license) != "premium":
        raise HTTPException(403, "Las sesiones en directo requieren una cuenta Premium.")


def new_session_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(10))


def normalized_code(raw: str) -> str:
    return re.sub(r"[\s-]", "", raw).upper()


def session_code_hash(code: str) -> str:
    secret = get_settings().jwt_secret.encode("utf-8")
    return hashlib.sha256(b"profesor-session-code-v1:" + secret + normalized_code(code).encode("ascii")).hexdigest()


def session_code_cipher() -> Fernet:
    secret = get_settings().jwt_secret.encode("utf-8")
    key = base64.urlsafe_b64encode(hashlib.sha256(b"profesor-session-code-cipher-v1:" + secret).digest())
    return Fernet(key)


def aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def session_is_expired(session: ProfesorMaterialSession) -> bool:
    return not session.expires_at or aware(session.expires_at) <= datetime.now(timezone.utc)


def expire_stale_sessions(db: Session, teacher_user_id: UUID | None = None) -> None:
    query = update(ProfesorMaterialSession).where(
        ProfesorMaterialSession.status.in_(("pending", "in_progress")),
        ProfesorMaterialSession.expires_at <= datetime.now(timezone.utc),
    )
    if teacher_user_id:
        query = query.where(ProfesorMaterialSession.teacher_user_id == teacher_user_id)
    result = db.execute(query.values(status="expired", join_code_hash=None, join_code_encrypted=None,
                                     revision=ProfesorMaterialSession.revision + 1))
    if result.rowcount:
        db.commit()


def visible_session_code(session: ProfesorMaterialSession) -> str | None:
    if not session.join_code_encrypted or session.status not in {"pending", "in_progress"} or session_is_expired(session):
        return None
    try:
        return session_code_cipher().decrypt(session.join_code_encrypted.encode("ascii")).decode("ascii")
    except (InvalidToken, ValueError, UnicodeError):
        return None


def active_student(request: Request, db: Session) -> tuple[ProfesorMaterialSession, User]:
    token = request.cookies.get("profesor_student_access") or ""
    try:
        claims = jwt.decode(token, get_settings().jwt_secret, algorithms=[get_settings().jwt_algorithm])
        if claims.get("type") != "profesor_anonymous_session":
            raise ValueError()
        session = db.get(ProfesorMaterialSession, UUID(str(claims["sid"])))
        if (not session or session.access_id is not None or session.status in {"cancelled", "expired"}
                or session_is_expired(session) or not session.join_code_hash
                or session.join_code_hash != claims.get("jch")):
            raise ValueError()
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(401, "Sesión cerrada o caducada. Pide un código nuevo al profesor.") from exc
    teacher = db.get(User, session.teacher_user_id)
    if not teacher:
        raise HTTPException(401, "Sesión no disponible.")
    teacher_premium(db, teacher)
    request.state.profesor_session_id = session.id
    return session, teacher


@router.post("/auth/profesor/student-join")
def student_join(payload: StudentCode, request: Request, response: Response, db: Session = Depends(get_db)):
    from app.api.auth import rate_limit_key

    rate_limit_key("profesor-code-ip:" + str(request.client.host if request.client else "unknown"), limit=60)
    code = normalized_code(payload.code)
    if len(code) != 10 or any(letter not in CODE_ALPHABET for letter in code):
        raise HTTPException(401, "Código no válido o sesión cerrada.")
    rate_limit_key("profesor-code:" + code, limit=30)
    session = db.scalar(select(ProfesorMaterialSession).where(ProfesorMaterialSession.join_code_hash == session_code_hash(code)))
    if not session or session.access_id is not None or session.status not in {"pending", "in_progress"} or session_is_expired(session):
        raise HTTPException(401, "Código no válido o sesión cerrada.")
    teacher = db.get(User, session.teacher_user_id)
    if not teacher:
        raise HTTPException(401, "Código no válido o sesión cerrada.")
    teacher_premium(db, teacher)
    now = datetime.now(timezone.utc)
    seconds = max(1, min(43200, int((aware(session.expires_at) - now).total_seconds())))
    settings = get_settings()
    token = jwt.encode({"sid": str(session.id), "jch": session.join_code_hash,
                        "type": "profesor_anonymous_session", "iat": int(now.timestamp()),
                        "exp": int((now + timedelta(seconds=seconds)).timestamp())},
                       settings.jwt_secret, algorithm=settings.jwt_algorithm)
    response.set_cookie("profesor_student_access", token, httponly=True, secure=settings.cookie_secure,
                        samesite="lax", max_age=seconds, path="/")
    response.delete_cookie("diplomator_access")
    response.delete_cookie("diplomator_refresh")
    response.headers["Cache-Control"] = "no-store"
    return {"ok": True, "next": "/profesor/alumno"}


@router.get("/auth/profesor/student-me")
def student_me(request: Request, response: Response, db: Session = Depends(get_db)):
    _, teacher = active_student(request, db)
    response.headers["Cache-Control"] = "no-store"
    return {"ok": True, "student": {"name": "Participante", "course": ""},
            "teacher": {"name": teacher.full_name or "Tu profesor"}, "meet_uri": ""}


@router.post("/auth/profesor/student-logout")
def student_logout(response: Response):
    response.delete_cookie("profesor_student_access", path="/")
    return {"ok": True}
