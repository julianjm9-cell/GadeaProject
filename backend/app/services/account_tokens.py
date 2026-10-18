from datetime import datetime, timedelta, timezone
import secrets
from sqlalchemy import delete, select
from fastapi import HTTPException
from app.models import AccountToken
from app.security.sessions import digest, utc


def account_token(db, user, purpose, product_code=""):
    now = datetime.now(timezone.utc)
    db.execute(delete(AccountToken).where(AccountToken.expires_at < now - timedelta(days=1)))
    # Supersede unconsumed links of the same purpose.
    db.execute(delete(AccountToken).where(AccountToken.user_id == user.id, AccountToken.purpose == purpose))
    token = secrets.token_urlsafe(32)
    db.add(AccountToken(user_id=user.id, token_hash=digest(token), purpose=purpose, product_code=product_code, expires_at=now + timedelta(minutes=30)))
    return token


def consume_account_token(db, raw, purpose):
    row = db.scalar(select(AccountToken).where(AccountToken.token_hash == digest(raw), AccountToken.purpose == purpose).with_for_update())
    if not row or row.used_at or utc(row.expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(400, "El enlace ha caducado o ya se utilizó. Solicita uno nuevo.")
    row.used_at = datetime.now(timezone.utc)
    return row
