from __future__ import annotations

import os

from sqlalchemy import select

from app.config import get_settings
from app.database.session import SessionLocal
from app.models import Organization, User
from app.security.passwords import hash_password


def bootstrap_superadmin(email: str | None = None, password: str | None = None) -> None:
    settings = get_settings()
    email = (email or settings.bootstrap_superadmin_email or os.getenv("SUPERADMIN_EMAIL") or "").strip().lower()
    password = password or settings.bootstrap_superadmin_password or os.getenv("SUPERADMIN_PASSWORD") or ""
    if not email or not password:
        raise SystemExit("Define SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD.")
    with SessionLocal() as db:
        org = db.scalar(select(Organization).where(Organization.name == "DIPLOMATOR Admin"))
        if not org:
            org = Organization(name="DIPLOMATOR Admin", status="active")
            db.add(org)
            db.flush()
        user = db.scalar(select(User).where(User.email == email))
        if not user and email != "admin@diplomator.local":
            user = db.scalar(select(User).where(User.email == "admin@diplomator.local", User.role == "superadmin"))
        if user:
            user.email = email
            user.password_hash = hash_password(password)
            user.role = "superadmin"
            user.is_active = True
            user.organization_id = org.id
        else:
            db.add(User(organization_id=org.id, email=email, password_hash=hash_password(password), full_name="Superadmin", role="superadmin", is_active=True))
        db.commit()
    print(f"Superadmin listo: {email}")


if __name__ == "__main__":
    bootstrap_superadmin()
