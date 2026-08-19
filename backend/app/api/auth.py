from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets
from time import monotonic
from urllib.parse import urlencode
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import current_user
from app.config import get_settings
from app.database.session import get_db
from app.models import License, Organization, User
from app.schemas.core import ApiOk, LoginRequest, TokenResponse
from app.security.passwords import hash_password, verify_password
from app.security.tokens import create_token, decode_token
from app.services.audit import audit
from app.services.licenses import check_access


router = APIRouter(prefix="/auth", tags=["auth"])
LOGIN_BUCKET: dict[str, list[float]] = {}
PRODUCT_CODES = ("DIPLOMATOR", "CAMBRIDGE", "UNIVERSIDAD_ADULTOS", "ESO_ADULTOS")
SAFE_NEXT_PATHS = ("/apps", "/app", "/cambridge", "/universidad-adultos", "/eso-adultos")


def rate_limit_key(identifier: str) -> None:
    now = monotonic()
    key = identifier.lower().strip()[:255]
    attempts = [t for t in LOGIN_BUCKET.get(key, []) if now - t < 300]
    if len(attempts) >= 8:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Demasiados intentos. Espera unos minutos.")
    attempts.append(now)
    LOGIN_BUCKET[key] = attempts


def public_user(user: User) -> dict:
    return {
        "id": str(user.id),
        "organization_id": str(user.organization_id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "google_connected": bool(user.google_sub),
        "google_picture": user.google_picture or "",
        "drive_connected": bool(user.drive_refresh_token),
        "drive_folder_id": user.drive_folder_id or "",
    }


def issue_login_response(user: User, response: Response) -> TokenResponse:
    settings = get_settings()
    access = create_token(user.id, "access", timedelta(minutes=settings.access_token_minutes))
    refresh = create_token(user.id, "refresh", timedelta(days=settings.refresh_token_days))
    response.set_cookie("diplomator_access", access, httponly=True, secure=settings.cookie_secure, samesite="lax", max_age=settings.access_token_minutes * 60)
    response.set_cookie("diplomator_refresh", refresh, httponly=True, secure=settings.cookie_secure, samesite="lax", max_age=settings.refresh_token_days * 86400)
    return TokenResponse(access_token=access, refresh_token=refresh, user=public_user(user))


def google_enabled() -> bool:
    settings = get_settings()
    return bool(settings.google_client_id and settings.google_client_secret)


def clean_next_path(next_path: str | None, default: str = "/apps") -> str:
    raw = str(next_path or default).strip()
    if not raw.startswith("/"):
        return default
    if any(raw == path or raw.startswith(f"{path}?") for path in SAFE_NEXT_PATHS):
        return raw
    return default


def google_state_token(purpose: str, next_path: str = "/apps", user_id: str = "") -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "type": "google_oauth_state",
        "purpose": purpose,
        "next": clean_next_path(next_path),
        "user_id": user_id,
        "nonce": secrets.token_urlsafe(18),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=10)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_google_state(raw: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(raw, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "google_oauth_state":
            raise ValueError("invalid state type")
        return payload
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Estado OAuth no valido.") from exc


def google_auth_redirect(purpose: str, next_path: str = "/apps", user_id: str = "") -> RedirectResponse:
    if not google_enabled():
        raise HTTPException(status_code=500, detail="Google OAuth no configurado.")
    settings = get_settings()
    state = google_state_token(purpose, clean_next_path(next_path), user_id)
    scopes = ["openid", "email", "profile"]
    if purpose == "drive":
        scopes.append("https://www.googleapis.com/auth/drive.file")
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(scopes),
        "state": state,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent" if purpose == "drive" else "select_account",
    }
    response = RedirectResponse("https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params))
    response.set_cookie("diplomator_google_state", state, httponly=True, secure=settings.cookie_secure, samesite="lax", max_age=600)
    return response


async def exchange_google_code(code: str) -> dict:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if res.status_code >= 400:
            raise HTTPException(status_code=502, detail="Google no acepto el codigo OAuth.")
        token_data = res.json()
        userinfo = await client.get("https://openidconnect.googleapis.com/v1/userinfo", headers={"Authorization": f"Bearer {token_data['access_token']}"})
        if userinfo.status_code >= 400:
            raise HTTPException(status_code=502, detail="No se pudo leer el perfil de Google.")
        token_data["userinfo"] = userinfo.json()
        return token_data


async def ensure_drive_folder(access_token: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            "https://www.googleapis.com/drive/v3/files?fields=id",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json={"name": "Diplomator", "mimeType": "application/vnd.google-apps.folder"},
        )
    if res.status_code >= 400:
        raise HTTPException(status_code=502, detail="No se pudo crear la carpeta de Drive.")
    return str(res.json().get("id") or "")


def ensure_google_access(db: Session, user: User, product_codes: tuple[str, ...] = PRODUCT_CODES) -> None:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    for product_code in product_codes:
        active = db.scalar(
            select(License).where(
                License.organization_id == user.organization_id,
                License.product_code == product_code,
                License.status == "active",
                License.starts_at <= now,
                License.expires_at >= now,
            )
        )
        if active:
            continue
        prefix = {"CAMBRIDGE": "CAMB", "UNIVERSIDAD_ADULTOS": "U25", "ESO_ADULTOS": "E25"}.get(product_code, "DIPLO")
        db.add(
            License(
                organization_id=user.organization_id,
                product_code=product_code,
                status="active",
                starts_at=now - timedelta(minutes=1),
                expires_at=now + timedelta(days=settings.google_signup_license_days),
                usage_limit=settings.google_signup_usage_limit,
                legacy_key=f"{prefix}-GOOGLE-{secrets.token_urlsafe(10).upper()}",
            )
        )


def get_or_create_google_user(db: Session, info: dict) -> User:
    email = str(info.get("email") or "").strip().lower()
    google_sub = str(info.get("sub") or "").strip()
    if not email or not google_sub:
        raise HTTPException(status_code=400, detail="Google no devolvio email valido.")
    user = db.scalar(select(User).where(User.google_sub == google_sub)) or db.scalar(select(User).where(User.email == email))
    if user:
        user.google_sub = google_sub
        user.google_picture = str(info.get("picture") or "")[:500]
        if not user.full_name:
            user.full_name = str(info.get("name") or email)[:200]
        ensure_google_access(db, user)
        return user
    org = Organization(name=f"DIPLOMATOR - {email}", status="active")
    db.add(org)
    db.flush()
    user = User(
        organization_id=org.id,
        email=email,
        password_hash=hash_password(secrets.token_urlsafe(32)),
        full_name=str(info.get("name") or email)[:200],
        role="user",
        is_active=True,
        google_sub=google_sub,
        google_picture=str(info.get("picture") or "")[:500],
    )
    db.add(user)
    db.flush()
    ensure_google_access(db, user)
    audit(db, actor=user, organization_id=user.organization_id, action="google_user_created", entity_type="user", entity_id=str(user.id), metadata={"email": email})
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    identifier = (payload.email or payload.identifier or "").strip().lower()
    rate_limit_key(identifier or "anonymous")
    generic = "Usuario o contrasena incorrectos."
    user = db.scalar(select(User).where(User.email == identifier))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=generic)
    decision = check_access(db, user)
    for product_code in PRODUCT_CODES[1:]:
        if decision.ok:
            break
        decision = check_access(db, user, product_code)
    if not decision.ok:
        audit(db, actor=user, organization_id=user.organization_id, action="access_blocked", entity_type="user", entity_id=str(user.id), metadata={"reason": decision.message})
        db.commit()
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=decision.message)
    return issue_login_response(user, response)


@router.get("/google/login")
def google_login(next: str = "/apps"):
    return google_auth_redirect("login", clean_next_path(next))


@router.get("/google/drive")
def google_drive(next: str = "/app?drive=connected", user: User = Depends(current_user)):
    return google_auth_redirect("drive", clean_next_path(next, "/app?drive=connected"), str(user.id))


@router.get("/google/drive-status")
def google_drive_status(user: User = Depends(current_user)) -> dict:
    return {
        "ok": True,
        "google_connected": bool(user.google_sub),
        "drive_connected": bool(user.drive_refresh_token),
        "drive_folder_id": user.drive_folder_id or "",
    }


@router.post("/google/drive-disconnect", response_model=ApiOk)
def google_drive_disconnect(user: User = Depends(current_user), db: Session = Depends(get_db)) -> ApiOk:
    user.drive_refresh_token = None
    user.drive_folder_id = None
    user.drive_connected_at = None
    audit(db, actor=user, organization_id=user.organization_id, action="drive_disconnected", entity_type="user", entity_id=str(user.id))
    db.commit()
    return ApiOk()


@router.get("/google/callback")
async def google_callback(request: Request, response: Response, code: str | None = None, state: str | None = None, error: str | None = None, db: Session = Depends(get_db)):
    if error:
        return RedirectResponse("/login?google_error=1")
    if not code or not state:
        return RedirectResponse("/login?google_error=state")
    try:
        payload = decode_google_state(state)
    except ValueError:
        return RedirectResponse("/login?google_error=state")
    token_data = await exchange_google_code(code)
    info = token_data["userinfo"]
    purpose = str(payload.get("purpose") or "login")
    if purpose == "drive":
        user = db.get(User, UUID(str(payload.get("user_id"))))
        if not user:
            return RedirectResponse("/login?google_error=user")
        user.google_sub = user.google_sub or str(info.get("sub") or "")
        user.google_picture = user.google_picture or str(info.get("picture") or "")[:500]
        if token_data.get("refresh_token"):
            user.drive_refresh_token = token_data["refresh_token"]
        next_path = clean_next_path(str(payload.get("next") or "/app?drive=connected"), "/app?drive=connected")
        if not user.drive_refresh_token and not token_data.get("refresh_token"):
            missing_path = next_path.replace("drive=connected", "drive=missing_refresh")
            if "drive=" not in missing_path:
                missing_path += ("&" if "?" in missing_path else "?") + "drive=missing_refresh"
            return RedirectResponse(missing_path)
        user.drive_folder_id = user.drive_folder_id or await ensure_drive_folder(token_data["access_token"])
        user.drive_connected_at = datetime.now(timezone.utc)
        audit(db, actor=user, organization_id=user.organization_id, action="drive_connected", entity_type="user", entity_id=str(user.id))
        db.commit()
        redirect = RedirectResponse(next_path)
        redirect.delete_cookie("diplomator_google_state")
        return redirect
    user = get_or_create_google_user(db, info)
    decision = check_access(db, user)
    for product_code in PRODUCT_CODES[1:]:
        if decision.ok:
            break
        decision = check_access(db, user, product_code)
    if not decision.ok:
        db.commit()
        return RedirectResponse("/login?google_error=access")
    db.commit()
    login_response = RedirectResponse(clean_next_path(str(payload.get("next") or "/apps")))
    issue_login_response(user, login_response)
    login_response.delete_cookie("diplomator_google_state")
    return login_response


@router.post("/logout", response_model=ApiOk)
def logout(response: Response) -> ApiOk:
    response.delete_cookie("diplomator_access")
    response.delete_cookie("diplomator_refresh")
    return ApiOk()


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    decision = check_access(db, user)
    for product_code in PRODUCT_CODES[1:]:
        if decision.ok:
            break
        decision = check_access(db, user, product_code)
    return {"ok": decision.ok, "user": public_user(user), "license": {"ok": decision.ok, "message": decision.message}}


@router.post("/refresh")
def refresh(request: Request, response: Response, refresh_token: str | None = None, db: Session = Depends(get_db)) -> dict:
    raw_refresh = refresh_token or request.cookies.get("diplomator_refresh")
    if not raw_refresh:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token requerido.")
    try:
        user_id = decode_token(raw_refresh, "refresh")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token no valido.") from exc
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token no valido.")
    decision = check_access(db, user)
    for product_code in PRODUCT_CODES[1:]:
        if decision.ok:
            break
        decision = check_access(db, user, product_code)
    if not decision.ok:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=decision.message)
    settings = get_settings()
    access = create_token(user.id, "access", timedelta(minutes=settings.access_token_minutes))
    response.set_cookie("diplomator_access", access, httponly=True, secure=settings.cookie_secure, samesite="lax", max_age=settings.access_token_minutes * 60)
    return {"ok": True, "access_token": access, "token_type": "bearer"}
