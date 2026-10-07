"""Isolated Premium student accounts and their single-purpose Meet portal."""
from __future__ import annotations

import re
import secrets
import base64
import hashlib
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from uuid import UUID

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import current_user
from app.config import get_settings
from app.database.session import get_db
from app.models import ClientState, ProfesorStudentAccess, User
from app.security.passwords import hash_password, verify_password
from app.services.licenses import check_access, profesor_account_plan

router = APIRouter(tags=["profesor-student-access"])


class Credentials(BaseModel):
    student_id: str = Field(min_length=1, max_length=120)
    username: str = Field(min_length=4, max_length=80)


class StudentLogin(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=72)


class ActiveUpdate(BaseModel):
    active: bool


class MeetLink(BaseModel):
    url: str = Field(min_length=1, max_length=500)


class CreateMeet(BaseModel):
    replace: bool = False


def teacher_premium(db: Session, user: User) -> None:
    decision = check_access(db, user, "PROFESOR_PARTICULAR", require_credits=False)
    if not decision.ok or not decision.license:
        raise HTTPException(403, "Esta cuenta no tiene acceso a Profesor Particular.")
    if profesor_account_plan(decision.license) != "premium":
        raise HTTPException(403, "Accesos Alumnos requiere una cuenta Premium.")


def teacher_students(db: Session, user: User) -> dict[str, dict]:
    row = db.scalar(select(ClientState).where(ClientState.user_id == user.id, ClientState.organization_id == user.organization_id))
    data = row.data if row and isinstance(row.data, dict) else {}
    app = data.get("__apps", {}).get("profesor_particular", {})
    return {str(s.get("id")): s for s in app.get("students", []) if isinstance(s, dict) and s.get("id")}


def owned_access(db: Session, user: User, access_id: UUID, *, for_update: bool = False) -> ProfesorStudentAccess:
    query = select(ProfesorStudentAccess).where(ProfesorStudentAccess.id == access_id, ProfesorStudentAccess.teacher_user_id == user.id)
    access = db.scalar(query.with_for_update() if for_update else query)
    if not access or access.student_id not in teacher_students(db, user):
        raise HTTPException(404, "Acceso no encontrado.")
    return access


def public_access(access: ProfesorStudentAccess, student: dict) -> dict:
    return {"id": str(access.id), "student_id": access.student_id, "name": str(student.get("name") or "Alumno"), "username": access.username, "password": visible_password(access), "active": access.is_active, "meet_uri": access.meet_uri or "", "created_at": access.created_at.isoformat()}


def password_cipher() -> Fernet:
    secret = get_settings().jwt_secret.encode("utf-8")
    key = base64.urlsafe_b64encode(hashlib.sha256(b"profesor-student-password-v1:" + secret).digest())
    return Fernet(key)


def visible_password(access: ProfesorStudentAccess) -> str | None:
    if not access.password_encrypted:
        return None
    try:
        return password_cipher().decrypt(access.password_encrypted.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeError):
        return None


def meet_url(raw: str) -> str:
    value = raw.strip()
    try:
        parts = urlparse(value)
        valid_host = parts.hostname == "meet.google.com" and parts.port in (None, 443)
    except ValueError:
        valid_host = False
        parts = urlparse("")
    if parts.scheme != "https" or not valid_host or parts.username or parts.password or not re.fullmatch(r"/[a-z]{3}-[a-z]{4}-[a-z]{3}/?", parts.path):
        raise HTTPException(422, "Pega un enlace válido de Google Meet.")
    return f"https://meet.google.com{parts.path.rstrip('/')}"


@router.get("/api/profesor/access")
def list_accesses(response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    teacher_premium(db, user)
    response.headers["Cache-Control"] = "private, no-store"
    students = teacher_students(db, user)
    rows = db.scalars(select(ProfesorStudentAccess).where(ProfesorStudentAccess.teacher_user_id == user.id).order_by(ProfesorStudentAccess.created_at)).all()
    return {"ok": True, "google_meet_connected": bool(user.meet_refresh_token), "google_meet_configured": bool(get_settings().google_client_id and get_settings().google_client_secret), "accesses": [public_access(row, students[row.student_id]) for row in rows if row.student_id in students]}


@router.post("/api/profesor/access")
def create_access(payload: Credentials, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    teacher_premium(db, user)
    response.headers["Cache-Control"] = "private, no-store"
    students = teacher_students(db, user)
    if payload.student_id not in students:
        raise HTTPException(404, "Alumno no encontrado en tu cuenta.")
    username = payload.username.strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{3,79}", username):
        raise HTTPException(422, "El usuario debe tener 4–80 letras minúsculas, números, puntos, guiones o guiones bajos.")
    if db.scalar(select(ProfesorStudentAccess.id).where(ProfesorStudentAccess.teacher_user_id == user.id, ProfesorStudentAccess.student_id == payload.student_id)):
        raise HTTPException(409, "Este alumno ya tiene acceso. Puedes restablecer su contraseña.")
    password = secrets.token_urlsafe(15)
    access = ProfesorStudentAccess(teacher_user_id=user.id, student_id=payload.student_id, username=username, password_hash=hash_password(password), password_encrypted=password_cipher().encrypt(password.encode("utf-8")).decode("ascii"))
    db.add(access)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Ese nombre de usuario ya existe.") from exc
    db.refresh(access)
    return {"ok": True, "access": public_access(access, students[payload.student_id]), "password": password}


@router.post("/api/profesor/access/{access_id}/reset-password")
def reset_password(access_id: UUID, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    teacher_premium(db, user)
    response.headers["Cache-Control"] = "private, no-store"
    access = owned_access(db, user, access_id)
    password = secrets.token_urlsafe(15)
    access.password_hash = hash_password(password)
    access.password_encrypted = password_cipher().encrypt(password.encode("utf-8")).decode("ascii")
    access.session_version += 1
    db.commit()
    return {"ok": True, "password": password}


@router.post("/api/profesor/access/{access_id}/active")
def set_active(access_id: UUID, payload: ActiveUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    teacher_premium(db, user)
    access = owned_access(db, user, access_id)
    access.is_active = payload.active
    access.session_version += 1
    db.commit()
    return {"ok": True, "active": access.is_active}


@router.post("/api/profesor/access/{access_id}/meet-link")
def set_meet_link(access_id: UUID, payload: MeetLink, user: User = Depends(current_user), db: Session = Depends(get_db)):
    teacher_premium(db, user)
    access = owned_access(db, user, access_id)
    access.meet_uri = meet_url(payload.url)
    access.meet_space = None
    db.commit()
    return {"ok": True, "meet_uri": access.meet_uri}


@router.post("/api/profesor/access/{access_id}/meet-clear")
def clear_meet_link(access_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    teacher_premium(db, user)
    access = owned_access(db, user, access_id)
    access.meet_uri = None
    access.meet_space = None
    db.commit()
    return {"ok": True}


async def google_meet_space(refresh_token: str) -> tuple[str, str]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=25) as client:
        token = await client.post("https://oauth2.googleapis.com/token", data={"client_id": settings.google_client_id, "client_secret": settings.google_client_secret, "refresh_token": refresh_token, "grant_type": "refresh_token"})
        if token.status_code != 200 or not token.json().get("access_token"):
            raise HTTPException(502, "No se pudo renovar la conexión con Google. Vuelve a conectar Meet.")
        response = await client.post("https://meet.googleapis.com/v2/spaces", headers={"Authorization": "Bearer " + token.json()["access_token"]}, json={})
        if response.status_code not in (200, 201):
            raise HTTPException(502, "Google Meet no pudo crear la sala. Comprueba que la API de Meet esté habilitada o pega un enlace manual.")
        body = response.json()
        return meet_url(str(body.get("meetingUri") or "")), str(body.get("name") or "")[:255]


@router.post("/api/profesor/access/{access_id}/meet-create")
async def create_meet(access_id: UUID, payload: CreateMeet, user: User = Depends(current_user), db: Session = Depends(get_db)):
    teacher_premium(db, user)
    access = owned_access(db, user, access_id, for_update=True)
    if access.meet_uri and not payload.replace:
        return {"ok": True, "meet_uri": access.meet_uri, "existing": True}
    if not user.meet_refresh_token:
        raise HTTPException(409, "Conecta Google Meet primero o pega un enlace manual.")
    try:
        uri, space = await google_meet_space(user.meet_refresh_token)
    except httpx.HTTPError as exc:
        raise HTTPException(502, "No se pudo conectar con Google Meet.") from exc
    access.meet_uri = uri
    access.meet_space = space
    db.commit()
    return {"ok": True, "meet_uri": uri, "existing": False}


def active_student(request: Request, db: Session) -> tuple[ProfesorStudentAccess, User, dict]:
    token = request.cookies.get("profesor_student_access") or ""
    try:
        claims = jwt.decode(token, get_settings().jwt_secret, algorithms=[get_settings().jwt_algorithm])
        if claims.get("type") != "profesor_student":
            raise ValueError()
        access = db.get(ProfesorStudentAccess, UUID(str(claims["sub"])))
        if not access or not access.is_active or access.session_version != claims.get("sv"):
            raise ValueError()
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(401, "Acceso de alumno no válido. Inicia sesión de nuevo.") from exc
    teacher = db.get(User, access.teacher_user_id)
    if not teacher:
        raise HTTPException(401, "Acceso no disponible.")
    teacher_premium(db, teacher)
    student = teacher_students(db, teacher).get(access.student_id)
    if not student:
        raise HTTPException(403, "Este alumno ya no está en la cuenta del profesor.")
    return access, teacher, student


@router.post("/auth/profesor/student-login")
def student_login(payload: StudentLogin, request: Request, response: Response, db: Session = Depends(get_db)):
    from app.api.auth import rate_limit_key

    username = payload.username.strip().lower()
    rate_limit_key("profesor-student-ip:" + str(request.client.host if request.client else "unknown"), limit=30)
    rate_limit_key("profesor-student:" + username, limit=8)
    access = db.scalar(select(ProfesorStudentAccess).where(ProfesorStudentAccess.username == username))
    if not access or not access.is_active or not verify_password(payload.password, access.password_hash):
        raise HTTPException(401, "Usuario o contraseña incorrectos.")
    teacher = db.get(User, access.teacher_user_id)
    if not teacher or not teacher_students(db, teacher).get(access.student_id):
        raise HTTPException(401, "Acceso no disponible.")
    teacher_premium(db, teacher)
    now = datetime.now(timezone.utc)
    settings = get_settings()
    token = jwt.encode({"sub": str(access.id), "type": "profesor_student", "sv": access.session_version, "iat": int(now.timestamp()), "exp": int((now + timedelta(hours=12)).timestamp())}, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    response.set_cookie("profesor_student_access", token, httponly=True, secure=settings.cookie_secure, samesite="lax", max_age=43200, path="/")
    response.delete_cookie("diplomator_access")
    response.delete_cookie("diplomator_refresh")
    return {"ok": True, "next": "/profesor/alumno"}


@router.get("/auth/profesor/student-me")
def student_me(request: Request, db: Session = Depends(get_db)):
    access, teacher, student = active_student(request, db)
    return {"ok": True, "student": {"name": str(student.get("name") or "Alumno"), "course": str(student.get("course") or "")}, "teacher": {"name": teacher.full_name or "Tu profesor"}, "meet_uri": access.meet_uri or ""}


@router.post("/auth/profesor/student-logout")
def student_logout(response: Response):
    response.delete_cookie("profesor_student_access", path="/")
    return {"ok": True}
