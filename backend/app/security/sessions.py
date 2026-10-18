"""Revocable authentication shared by cookies, bearer tokens and OAuth linking."""
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import secrets
from uuid import UUID, uuid4

from sqlalchemy import delete, select, update
from app.config import get_settings
from app.models import AuthSession, Organization, User
from app.security.tokens import create_token, decode_claims


def digest(value: str) -> str:
    return sha256(value.encode()).hexdigest()


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def revoke_sessions(db, user_id):
    db.execute(update(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None)).values(revoked_at=datetime.now(timezone.utc)))


def new_session(db, user):
    settings, now = get_settings(), datetime.now(timezone.utc)
    # Bound retention without storing raw credentials or identifying device data.
    db.execute(delete(AuthSession).where(AuthSession.expires_at < now - timedelta(days=1)))
    session_id, nonce = uuid4(), secrets.token_urlsafe(32)
    session = AuthSession(id=session_id, user_id=user.id, credential_stamp=digest(user.password_hash),
        refresh_hash=digest(nonce), expires_at=now + timedelta(days=settings.refresh_token_days))
    db.add(session)
    access = create_token(user.id, "access", timedelta(minutes=settings.access_token_minutes), sid=str(session_id))
    refresh = create_token(user.id, "refresh", timedelta(days=settings.refresh_token_days), sid=str(session_id), nonce=nonce)
    return access, refresh


def authenticated_session(db, raw, expected_type="access"):
    claims = decode_claims(raw, expected_type)
    try:
        sid = UUID(str(claims["sid"]))
    except (KeyError, ValueError, TypeError) as exc:
        # Pre-upgrade tokens cannot be revoked and require one fresh login.
        raise ValueError("Session upgrade required") from exc
    session = db.scalar(select(AuthSession).where(AuthSession.id == sid).with_for_update() if expected_type == "refresh" else select(AuthSession).where(AuthSession.id == sid))
    user = db.get(User, UUID(claims["sub"]))
    org = db.get(Organization, user.organization_id) if user else None
    if (not session or not user or session.user_id != user.id or session.revoked_at
        or utc(session.expires_at) <= datetime.now(timezone.utc) or not user.is_active
        or not org or org.status != "active" or user.requires_email_verification
        or not secrets.compare_digest(session.credential_stamp, digest(user.password_hash))):
        raise ValueError("Revoked session")
    if expected_type == "refresh" and not secrets.compare_digest(session.refresh_hash, digest(str(claims.get("nonce", "")))):
        raise ValueError("Refresh already used")
    return user, session
