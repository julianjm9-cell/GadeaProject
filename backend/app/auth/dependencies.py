from __future__ import annotations

from datetime import timedelta
import secrets

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import License, Organization, User
from app.models.core import utcnow
from app.security.tokens import decode_token
from app.services.licenses import LicenseDecision, check_access


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def _token_from_request(request: Request, bearer: str | None) -> str:
    if bearer:
        return bearer
    cookie = request.cookies.get("diplomator_access")
    if cookie:
        return cookie
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado.")


def current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    raw = _token_from_request(request, token)
    try:
        user_id = decode_token(raw, "access")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesion no valida.") from exc
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesion no valida.")
    return user


def current_organization(user: User = Depends(current_user), db: Session = Depends(get_db)) -> Organization:
    org = db.get(Organization, user.organization_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organizacion no valida.")
    return org


def product_code_from_request(request: Request) -> str:
    raw = str(request.headers.get("x-client-app") or request.query_params.get("app") or "").strip().lower()
    if raw in {"cambridge", "cambridgetrainer", "cambridge-trainer"} or request.url.path.startswith("/cambridge"):
        return "CAMBRIDGE"
    if raw in {"universidad_adultos", "universidad-adultos", "acceso-universidad-adultos", "adult_uni"} or request.url.path.startswith("/universidad-adultos"):
        return "UNIVERSIDAD_ADULTOS"
    if raw in {"eso_adultos", "eso-adultos", "adult_eso"} or request.url.path.startswith("/eso-adultos"):
        return "ESO_ADULTOS"
    return "DIPLOMATOR"


def license_prefix(product_code: str) -> str:
    return {
        "CAMBRIDGE": "CAMB",
        "UNIVERSIDAD_ADULTOS": "U25",
        "ESO_ADULTOS": "E25",
    }.get(product_code, "DIPLO")


def current_license(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> License:
    product_code = product_code_from_request(request)
    decision: LicenseDecision = check_access(db, user, product_code)
    if decision.ok and not decision.license and user.role == "superadmin":
        now = utcnow()
        license_obj = License(
            organization_id=user.organization_id,
            product_code=product_code,
            status="active",
            starts_at=now - timedelta(minutes=1),
            expires_at=now + timedelta(days=3650),
            usage_limit=0,
            legacy_key=f"{license_prefix(product_code)}-ADMIN-{secrets.token_urlsafe(10).upper()}",
        )
        db.add(license_obj)
        db.commit()
        db.refresh(license_obj)
        return license_obj
    if not decision.ok or not decision.license:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=decision.message)
    return decision.license


def require_superadmin(user: User = Depends(current_user)) -> User:
    if user.role != "superadmin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requiere superadmin.")
    return user
