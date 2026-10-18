from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from jwt import InvalidTokenError as JWTError

from app.config import get_settings


def create_token(user_id: UUID, token_type: str, expires_delta: timedelta, **claims) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        **claims,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: str = "access") -> UUID:
    return UUID(str(decode_claims(token, expected_type)["sub"]))


def decode_claims(token: str, expected_type: str = "access") -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != expected_type:
            raise ValueError("Invalid token type")
        UUID(str(payload["sub"]))
        return payload
    except (JWTError, KeyError, ValueError) as exc:
        raise ValueError("Invalid token") from exc
