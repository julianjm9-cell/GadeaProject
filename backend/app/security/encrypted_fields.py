"""Authenticated encryption with a deployment key independent of the database."""
import base64
import hashlib
from cryptography.fernet import Fernet
from sqlalchemy.types import TypeDecorator, Text
from app.config import get_settings

PREFIX = "enc:v1:"


def cipher():
    settings = get_settings()
    key = settings.oauth_token_encryption_key
    if not key:
        if settings.environment.lower() in {"prod", "production"}:
            raise ValueError("OAUTH_TOKEN_ENCRYPTION_KEY is required")
        key = base64.urlsafe_b64encode(hashlib.sha256((settings.jwt_secret + ":local-oauth").encode()).digest())
    return Fernet(key)


def encrypt(value):
    return PREFIX + cipher().encrypt(value.encode()).decode() if value and not value.startswith(PREFIX) else value


class EncryptedToken(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt(value)

    def process_result_value(self, value, dialect):
        # Dual read supports existing credentials while the deployment encrypts them.
        return cipher().decrypt(value[len(PREFIX):].encode()).decode() if value and value.startswith(PREFIX) else value


def migrate_stored_tokens():
    from app.database.session import engine
    from sqlalchemy import text
    with engine.begin() as connection:
        count = 0
        for row in connection.execute(text("SELECT id, drive_refresh_token, meet_refresh_token FROM users")):
            for name, value in zip(("drive_refresh_token", "meet_refresh_token"), (row.drive_refresh_token, row.meet_refresh_token)):
                if value and not value.startswith(PREFIX):
                    connection.execute(text(f"UPDATE users SET {name} = :value WHERE id = :id AND {name} = :old"), {"id":row.id,"value":encrypt(value),"old":value})
                    count += 1
    print(f"OK credenciales OAuth cifradas: {count}")


if __name__ == "__main__":
    migrate_stored_tokens()
