from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import License, Organization, UsageRecord, User


PRODUCT_CODE = "DIPLOMATOR"


@dataclass
class LicenseDecision:
    ok: bool
    message: str
    license: License | None = None


def current_utc() -> datetime:
    return datetime.now(timezone.utc)


def usage_count_for_license(db: Session, organization_id: UUID, starts_at: datetime, expires_at: datetime, product_code: str = PRODUCT_CODE) -> int:
    stmt = select(func.count(UsageRecord.id)).where(
        UsageRecord.organization_id == organization_id,
        UsageRecord.product_code == product_code,
        UsageRecord.created_at >= starts_at,
        UsageRecord.created_at <= expires_at,
    )
    return int(db.scalar(stmt) or 0)


def check_access(db: Session, user: User, product_code: str = PRODUCT_CODE) -> LicenseDecision:
    if not user.is_active:
        return LicenseDecision(False, "Usuario desactivado.")
    org = db.get(Organization, user.organization_id)
    if not org or org.status != "active":
        return LicenseDecision(False, "Organizacion inactiva.")
    now = current_utc()
    license_obj = db.scalar(
        select(License)
        .where(
            License.organization_id == user.organization_id,
            License.product_code == product_code,
            License.status == "active",
            License.starts_at <= now,
            License.expires_at >= now,
        )
        .order_by(License.expires_at.desc())
    )
    if not license_obj:
        if user.role == "superadmin":
            return LicenseDecision(True, "Superadmin activo.")
        return LicenseDecision(False, "Licencia no valida.")
    used = usage_count_for_license(db, user.organization_id, license_obj.starts_at, license_obj.expires_at, product_code)
    if license_obj.usage_limit and used >= license_obj.usage_limit:
        return LicenseDecision(False, "Limite de uso agotado.", license_obj)
    return LicenseDecision(True, "Licencia activa.", license_obj)


def check_legacy_license(db: Session, legacy_key: str) -> LicenseDecision:
    license_obj = db.scalar(select(License).where(License.legacy_key == legacy_key.strip()))
    if not license_obj:
        return LicenseDecision(False, "Licencia no encontrada.")
    user = db.scalar(
        select(User).where(
            User.organization_id == license_obj.organization_id,
            User.is_active.is_(True),
        )
    )
    if not user:
        if license_obj.status != "active":
            return LicenseDecision(False, "Licencia inactiva.", license_obj)
        return LicenseDecision(False, "Licencia sin usuario activo.", license_obj)
    return check_access(db, user, license_obj.product_code)
