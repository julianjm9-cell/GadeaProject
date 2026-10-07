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
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import current_user
from app.config import get_settings
from app.database.session import get_db
from app.models import License, Organization, User
from app.schemas.core import ApiOk, EsoRegisterRequest, LoginRequest, TokenResponse, PasswordChangeRequest
from app.security.passwords import hash_password, verify_password
from app.security.tokens import create_token, decode_token
from app.services.audit import audit
from app.services.licenses import PROFESOR_PREMIUM_PLAN, check_access, license_for_user, profesor_account_plan


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/change-password")
def change_password(payload: PasswordChangeRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit_key("password-change:" + str(user.id))
    if len(payload.current_password.encode("utf-8")) > 72 or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(400, "La contraseña actual no es correcta.")
    if len(payload.new_password.encode("utf-8")) > 72:
        raise HTTPException(400, "La contraseña no puede superar los 72 bytes.")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}
LOGIN_BUCKET: dict[str, list[float]] = {}
PRODUCT_CODES = ("DIPLOMATOR", "CAMBRIDGE", "UNIVERSIDAD_ADULTOS", "ESO_ADULTOS", "PROFESOR_PARTICULAR", "OCR_FACTURAS")
SAFE_NEXT_PATHS = ("/apps", "/app", "/cambridge", "/universidad-adultos", "/eso-adultos", "/profesor-particular", "/facturas")


def rate_limit_key(identifier: str, limit: int = 8) -> None:
    now = monotonic()
    key = identifier.lower().strip()[:255]
    attempts = [t for t in LOGIN_BUCKET.get(key, []) if now - t < 300]
    if len(attempts) >= limit:
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
    response.delete_cookie("profesor_student_access")
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
    if purpose == "meet":
        scopes.append("https://www.googleapis.com/auth/meetings.space.created")
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(scopes),
        "state": state,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent" if purpose in {"drive", "meet"} else "select_account",
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
        if product_code in {"DIPLOMATOR", "OCR_FACTURAS"}:
            continue  # Access is assigned by administration only.
        # Never renew suspended/expired access or replenish credits on login.
        if license_for_user(db, user, product_code):
            continue
        if product_code == "PROFESOR_PARTICULAR" and not settings.profesor_signup_enabled:
            continue
        if product_code == "ESO_ADULTOS" and not settings.eso_signup_enabled:
            continue
        prefix = {"PROFESOR_PARTICULAR": "PROFE", "CAMBRIDGE": "CAMB", "UNIVERSIDAD_ADULTOS": "U25", "ESO_ADULTOS": "E25"}.get(product_code, "DIPLO")
        db.add(
            License(
                organization_id=user.organization_id,
                user_id=user.id,
                product_code=product_code,
                status="active",
                starts_at=now - timedelta(minutes=1),
                expires_at=now + timedelta(days=settings.eso_signup_days if product_code == "ESO_ADULTOS" else settings.profesor_signup_days if product_code == "PROFESOR_PARTICULAR" else settings.google_signup_license_days),
                usage_limit=settings.eso_signup_credits if product_code == "ESO_ADULTOS" else settings.profesor_signup_credits if product_code == "PROFESOR_PARTICULAR" else settings.google_signup_usage_limit,
                plan="ESO_FREE" if product_code == "ESO_ADULTOS" else settings.profesor_signup_plan if product_code == "PROFESOR_PARTICULAR" else "MVP",
                legacy_key=f"{prefix}-GOOGLE-{secrets.token_urlsafe(10).upper()}",
            )
        )
    # The OAuth callback checks access before committing (autoflush is disabled).
    db.flush()


def get_or_create_google_user(db: Session, info: dict, product_codes: tuple[str, ...] = ("DIPLOMATOR",)) -> User:
    email = str(info.get("email") or "").strip().lower()
    google_sub = str(info.get("sub") or "").strip()
    if not email or not google_sub or info.get("email_verified") is not True:
        raise HTTPException(status_code=400, detail="Google no devolvio email valido.")
    user = db.scalar(select(User).where(User.google_sub == google_sub).with_for_update()) or db.scalar(select(User).where(User.email == email).with_for_update())
    if user:
        org = db.get(Organization, user.organization_id)
        if not user.is_active or not org or org.status != "active":
            raise HTTPException(status_code=403, detail="Cuenta desactivada.")
        if user.google_sub and user.google_sub != google_sub:
            raise HTTPException(status_code=409, detail="Esta cuenta ya está vinculada a otra cuenta de Google.")
        user.google_sub = google_sub
        user.google_picture = str(info.get("picture") or "")[:500]
        if not user.full_name:
            user.full_name = str(info.get("name") or email)[:200]
        ensure_google_access(db, user, product_codes)
        return user
    if "DIPLOMATOR" in product_codes:
        raise HTTPException(status_code=403, detail="Diplomator requiere una cuenta y una licencia asignadas.")
    if "PROFESOR_PARTICULAR" in product_codes and not get_settings().profesor_signup_enabled:
        raise HTTPException(status_code=403, detail="El registro está cerrado temporalmente.")
    if "ESO_ADULTOS" in product_codes and not get_settings().eso_signup_enabled:
        raise HTTPException(status_code=403, detail="El registro gratuito está cerrado temporalmente.")
    org = Organization(name=f"Cuenta - {email}"[:200], status="active")
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
    ensure_google_access(db, user, product_codes)
    audit(db, actor=user, organization_id=user.organization_id, action="google_user_created", entity_type="user", entity_id=str(user.id), metadata={"email": email})
    return user


@router.get("/eso/signup-settings")
def eso_signup_settings():
    settings = get_settings()
    return {"enabled": settings.eso_signup_enabled, "credits": settings.eso_signup_credits, "days": settings.eso_signup_days}


@router.post("/eso/register", response_model=TokenResponse, status_code=201)
def register_eso(payload: EsoRegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    settings = get_settings()
    if not settings.eso_signup_enabled:
        raise HTTPException(status_code=403, detail="El registro gratuito está cerrado temporalmente.")
    email = str(payload.email).strip().lower()
    # Allow shared connections/proxies while limiting repeated attempts per email.
    rate_limit_key(f"register-ip:{request.client.host if request.client else 'unknown'}", limit=60)
    rate_limit_key(f"register-email:{email}")
    if len(payload.password.encode("utf-8")) > 72 or not payload.full_name.strip():
        raise HTTPException(status_code=422, detail="Revisa el nombre y la longitud de la contraseña.")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Este correo ya tiene cuenta. Inicia sesión para acceder a ESO.")
    try:
        org = Organization(name=f"ESO Adultos - {email}"[:200], status="active")
        db.add(org)
        db.flush()
        user = User(organization_id=org.id, email=email, full_name=payload.full_name.strip(), password_hash=hash_password(payload.password), role="user", is_active=True)
        db.add(user)
        db.flush()
        ensure_google_access(db, user, ("ESO_ADULTOS",))
        audit(db, actor=user, organization_id=org.id, action="eso_user_registered", entity_type="user", entity_id=str(user.id), metadata={"credits": settings.eso_signup_credits})
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Este correo ya tiene cuenta. Inicia sesión para acceder a ESO.")
    return issue_login_response(user, response)


@router.get("/profesor/signup-settings")
def profesor_signup_settings():
    settings = get_settings()
    return {"enabled": settings.profesor_signup_enabled, "credits": settings.profesor_signup_credits, "days": settings.profesor_signup_days,
            "plan": "premium" if settings.profesor_signup_plan == PROFESOR_PREMIUM_PLAN else "normal"}


@router.post("/profesor/register", response_model=TokenResponse, status_code=201)
def register_profesor(payload: EsoRegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    settings = get_settings()
    if not settings.profesor_signup_enabled:
        raise HTTPException(status_code=403, detail="El registro gratuito está cerrado temporalmente.")
    email = str(payload.email).strip().lower()
    # Allow shared connections/proxies while limiting repeated attempts per email.
    rate_limit_key(f"register-ip:{request.client.host if request.client else 'unknown'}", limit=60)
    rate_limit_key(f"register-email:{email}")
    if len(payload.password.encode("utf-8")) > 72 or not payload.full_name.strip():
        raise HTTPException(status_code=422, detail="Revisa el nombre y la longitud de la contraseña.")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Este correo ya tiene cuenta. Inicia sesión para acceder a Profesor Particular.")
    try:
        org = Organization(name=f"Profesor Particular - {email}"[:200], status="active")
        db.add(org)
        db.flush()
        user = User(organization_id=org.id, email=email, full_name=payload.full_name.strip(), password_hash=hash_password(payload.password), role="user", is_active=True)
        db.add(user)
        db.flush()
        ensure_google_access(db, user, ("PROFESOR_PARTICULAR",))
        audit(db, actor=user, organization_id=org.id, action="profesor_user_registered", entity_type="user", entity_id=str(user.id), metadata={"credits": settings.profesor_signup_credits})
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Este correo ya tiene cuenta. Inicia sesión para acceder a Profesor Particular.")
    return issue_login_response(user, response)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    identifier = (payload.email or payload.identifier or "").strip().lower()
    rate_limit_key(identifier or "anonymous")
    generic = "Usuario o contrasena incorrectos."
    user = db.scalar(select(User).where(User.email == identifier))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=generic)
    if payload.enroll_profesor:
        user = db.scalar(select(User).where(User.id == user.id).with_for_update())
        org = db.get(Organization, user.organization_id)
        if user.is_active and org and org.status == "active":
            ensure_google_access(db, user, ("PROFESOR_PARTICULAR",))
            db.commit()
    if payload.enroll_eso:
        user = db.scalar(select(User).where(User.id == user.id).with_for_update())
        org = db.get(Organization, user.organization_id)
        if user.is_active and org and org.status == "active":
            ensure_google_access(db, user, ("ESO_ADULTOS",))
            db.commit()
    decision = check_access(db, user)
    for product_code in PRODUCT_CODES[1:]:
        if decision.ok:
            break
        decision = check_access(db, user, product_code, require_credits=product_code not in {"ESO_ADULTOS", "PROFESOR_PARTICULAR", "OCR_FACTURAS"})
    if not decision.ok:
        audit(db, actor=user, organization_id=user.organization_id, action="access_blocked", entity_type="user", entity_id=str(user.id), metadata={"reason": decision.message})
        db.commit()
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=decision.message)
    return issue_login_response(user, response)


@router.get("/google/login")
def google_login(next: str = "/apps"):
    next_path = clean_next_path(next)
    if not google_enabled():
        return RedirectResponse(f"/login?google_disabled=1&next={next_path}")
    return google_auth_redirect("login", next_path)


@router.get("/google/status")
def google_status() -> dict:
    return {"ok": True, "enabled": google_enabled()}


@router.get("/google/drive")
def google_drive(next: str = "/app?drive=connected", user: User = Depends(current_user)):
    return google_auth_redirect("drive", clean_next_path(next, "/app?drive=connected"), str(user.id))


@router.get("/google/meet")
def google_meet(user: User = Depends(current_user), db: Session = Depends(get_db)):
    decision = check_access(db, user, "PROFESOR_PARTICULAR", require_credits=False)
    if not decision.ok or not decision.license or profesor_account_plan(decision.license) != "premium":
        raise HTTPException(403, "Conectar Meet requiere Profesor Premium.")
    return google_auth_redirect("meet", "/profesor-particular", str(user.id))


@router.post("/google/meet-disconnect", response_model=ApiOk)
def google_meet_disconnect(user: User = Depends(current_user), db: Session = Depends(get_db)):
    decision = check_access(db, user, "PROFESOR_PARTICULAR", require_credits=False)
    if not decision.ok or not decision.license or profesor_account_plan(decision.license) != "premium":
        raise HTTPException(403, "Requiere Profesor Premium.")
    user.meet_refresh_token = None
    user.meet_connected_at = None
    db.commit()
    return ApiOk()


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
    cookie_state = request.cookies.get("diplomator_google_state") or ""
    if not state or not cookie_state or not secrets.compare_digest(state, cookie_state):
        return RedirectResponse("/login?google_error=state")
    try:
        payload = decode_google_state(state)
    except HTTPException:
        return RedirectResponse("/login?google_error=state")
    target = clean_next_path(str(payload.get("next") or "/apps"))
    purpose = str(payload.get("purpose") or "login")
    if error or not code:
        if purpose == "meet":
            return RedirectResponse("/profesor-particular?meet=cancelled#accesos")
        return RedirectResponse("/login?" + urlencode({"google_error": "1", "next": target}))
    try:
        token_data = await exchange_google_code(code)
    except HTTPException:
        if purpose == "meet":
            return RedirectResponse("/profesor-particular?meet=error#accesos")
        raise
    info = token_data["userinfo"]
    if purpose == "meet":
        try:
            user_id = UUID(str(payload.get("user_id")))
            session_id = decode_token(request.cookies.get("diplomator_access") or "", "access")
        except (ValueError, TypeError):
            return RedirectResponse("/profesor/login?expired=1")
        if session_id != user_id:
            return RedirectResponse("/profesor/login?expired=1")
        user = db.get(User, user_id)
        decision = check_access(db, user, "PROFESOR_PARTICULAR", require_credits=False) if user else None
        if not decision or not decision.ok or not decision.license or profesor_account_plan(decision.license) != "premium":
            return RedirectResponse("/profesor-particular#accesos")
        if token_data.get("refresh_token"):
            user.meet_refresh_token = token_data["refresh_token"]
        if not user.meet_refresh_token:
            return RedirectResponse("/profesor-particular?meet=missing_refresh#accesos")
        user.meet_connected_at = datetime.now(timezone.utc)
        db.commit()
        redirect = RedirectResponse("/profesor-particular?meet=connected#accesos")
        redirect.delete_cookie("diplomator_google_state")
        return redirect
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
    product = {"/facturas": "OCR_FACTURAS", "/profesor-particular": "PROFESOR_PARTICULAR", "/eso-adultos": "ESO_ADULTOS", "/universidad-adultos": "UNIVERSIDAD_ADULTOS", "/cambridge": "CAMBRIDGE"}.get(target.split("?")[0], "DIPLOMATOR")
    try:
        user = get_or_create_google_user(db, info, () if product == "OCR_FACTURAS" else (product,))
    except HTTPException as exc:
        db.rollback()
        reason = "account" if exc.status_code == 409 else "access"
        return RedirectResponse("/login?" + urlencode({"google_error": reason, "next": target}))
    decision = check_access(db, user, product, require_credits=product not in {"ESO_ADULTOS", "PROFESOR_PARTICULAR", "OCR_FACTURAS"})
    if target == "/apps" and not decision.ok:
        for product_code in PRODUCT_CODES[1:]:
            decision = check_access(db, user, product_code, require_credits=product_code not in {"ESO_ADULTOS", "PROFESOR_PARTICULAR", "OCR_FACTURAS"})
            if decision.ok:
                break
    if not decision.ok:
        db.rollback()
        return RedirectResponse("/login?" + urlencode({"google_error": "access", "next": target}))
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
        decision = check_access(db, user, product_code, require_credits=product_code not in {"ESO_ADULTOS", "PROFESOR_PARTICULAR", "OCR_FACTURAS"})
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
        decision = check_access(db, user, product_code, require_credits=product_code not in {"ESO_ADULTOS", "PROFESOR_PARTICULAR", "OCR_FACTURAS"})
    if not decision.ok:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=decision.message)
    settings = get_settings()
    access = create_token(user.id, "access", timedelta(minutes=settings.access_token_minutes))
    response.set_cookie("diplomator_access", access, httponly=True, secure=settings.cookie_secure, samesite="lax", max_age=settings.access_token_minutes * 60)
    return {"ok": True, "access_token": access, "token_type": "bearer"}
