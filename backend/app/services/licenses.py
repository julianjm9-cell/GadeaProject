from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import case, func, or_, select
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


def license_is_current(license_obj: License, now: datetime | None = None) -> bool:
    now = now or current_utc()
    starts_at = license_obj.starts_at
    expires_at = license_obj.expires_at
    if starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=timezone.utc)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return license_obj.status == "active" and starts_at <= now <= expires_at


def usage_count_for_license(db: Session, user_id: UUID, organization_id: UUID, starts_at: datetime, expires_at: datetime, product_code: str = PRODUCT_CODE) -> int:
    stmt = select(func.count(UsageRecord.id)).where(
        UsageRecord.organization_id == organization_id,
        UsageRecord.user_id == user_id,
        UsageRecord.product_code == product_code,
        UsageRecord.created_at >= starts_at,
        UsageRecord.created_at <= expires_at,
    )
    return int(db.scalar(stmt) or 0)


def license_for_user(db: Session, user: User, product_code: str = PRODUCT_CODE) -> License | None:
    stmt = select(License).where(
        License.organization_id == user.organization_id,
        License.product_code == product_code,
        or_(License.user_id == user.id, License.user_id.is_(None)),
    )
    return db.scalar(
        stmt.order_by(
            case((License.user_id == user.id, 0), else_=1),
            License.created_at.desc(),
            License.expires_at.desc(),
        )
    )


def check_access(db: Session, user: User, product_code: str = PRODUCT_CODE) -> LicenseDecision:
    if not user.is_active:
        return LicenseDecision(False, "Usuario desactivado.")
    org = db.get(Organization, user.organization_id)
    if not org or org.status != "active":
        return LicenseDecision(False, "Organizacion inactiva.")
    license_obj = license_for_user(db, user, product_code)
    if not license_obj:
        if user.role == "superadmin":
            return LicenseDecision(True, "Superadmin activo.")
        return LicenseDecision(False, "Licencia no valida.")
    if not license_is_current(license_obj):
        return LicenseDecision(False, "Licencia no valida.", license_obj)
    used = usage_count_for_license(db, user.id, user.organization_id, license_obj.starts_at, license_obj.expires_at, product_code)
    if license_obj.usage_limit and used >= license_obj.usage_limit:
        return LicenseDecision(False, "Limite de uso agotado.", license_obj)
    return LicenseDecision(True, "Licencia activa.", license_obj)


def check_legacy_license(db: Session, legacy_key: str) -> LicenseDecision:
    license_obj = db.scalar(select(License).where(License.legacy_key == legacy_key.strip()))
    if not license_obj:
        return LicenseDecision(False, "Licencia no encontrada.")
    user = db.get(User, license_obj.user_id) if license_obj.user_id else db.scalar(
        select(User).where(User.organization_id == license_obj.organization_id, User.is_active.is_(True))
    )
    if not user:
        if license_obj.status != "active":
            return LicenseDecision(False, "Licencia inactiva.", license_obj)
        return LicenseDecision(False, "Licencia sin usuario activo.", license_obj)
    return check_access(db, user, license_obj.product_code)
