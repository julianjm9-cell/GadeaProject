"""Allowlisted, read-only account diagnostics; never serialize the private state."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import AuditLog, ClientState, License, ProfesorGenerationJob, ProfesorMaterialSession, ProfesorStateSnapshot, UsageRecord, User
from app.models.core import utcnow
from app.services.audit import audit
from app.services.profesor_state_history import COLLECTIONS, counts, teacher_data

ACTIVITY_ACTIONS = ("profesor_login", "profesor_activity")
ADMIN_ACTIONS = ("profesor_account_viewed", "profesor_catalog_viewed")
ACTIVITY_DAYS = 90
ADMIN_DAYS = 180


def prune_diagnostics(db: Session) -> None:
    now = utcnow()
    for actions, days in ((ACTIVITY_ACTIONS, ACTIVITY_DAYS), (ADMIN_ACTIONS, ADMIN_DAYS)):
        db.execute(delete(AuditLog).where(AuditLog.action.in_(actions), AuditLog.created_at < now - timedelta(days=days)))


def record_activity(db: Session, user: User, *, login_method: str | None = None) -> None:
    """One app-open marker per 30 minutes; no IP, fingerprint, URL or content."""
    action = "profesor_login" if login_method else "profesor_activity"
    if not login_method and db.scalar(select(AuditLog.id).where(
        AuditLog.actor_user_id == user.id, AuditLog.action == action,
        AuditLog.created_at >= utcnow() - timedelta(minutes=30)).limit(1)):
        return
    audit(db, actor=user, organization_id=user.organization_id, action=action,
          entity_type="user", entity_id=str(user.id),
          metadata={"method": login_method} if login_method else {})


def stamp(value):
    return value.isoformat() if value else None


def collections_for(db: Session, user: User):
    row = db.scalar(select(ClientState).where(ClientState.user_id == user.id, ClientState.organization_id == user.organization_id))
    data = teacher_data(row) if row else {}
    data = data if isinstance(data, dict) else {}
    library = [item for item in data.get("library", []) if isinstance(item, dict)] if isinstance(data.get("library"), list) else []
    return row, data, library


def short(value, limit=180):
    return value[:limit] if isinstance(value, str) else ""


def material_metadata(item):
    activity = item.get("activity") if isinstance(item.get("activity"), dict) else {}
    context = activity.get("context") if isinstance(activity.get("context"), dict) else {}
    questions = activity.get("questions") if isinstance(activity.get("questions"), list) else []
    types = sorted({short(q.get("type"), 60) for q in questions if isinstance(q, dict) and isinstance(q.get("type"), str)})
    return {"id": short(item.get("id"), 120), "title": short(item.get("title")),
            "kind": short(item.get("kind"), 80), "subject": short(item.get("subject"), 100),
            "course": short(context.get("course"), 80), "types": types, "questions": len(questions),
            "created_at": short(item.get("createdAt"), 40) or None,
            "updated_at": short(item.get("updatedAt"), 40) or None}


def account_diagnostics(db: Session, user: User) -> dict:
    row, data, _ = collections_for(db, user)
    totals = counts(data)
    events = list(db.scalars(select(AuditLog).where(AuditLog.actor_user_id == user.id,
        AuditLog.action.in_(ACTIVITY_ACTIONS), AuditLog.created_at >= utcnow() - timedelta(days=ACTIVITY_DAYS))
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(50)))
    activity_stats = db.execute(select(AuditLog.action, func.max(AuditLog.created_at)).where(
        AuditLog.actor_user_id == user.id, AuditLog.action.in_(ACTIVITY_ACTIONS),
        AuditLog.created_at >= utcnow() - timedelta(days=ACTIVITY_DAYS)).group_by(AuditLog.action)).all()
    latest = dict(activity_stats)
    login_counts = {days: db.scalar(select(func.count()).select_from(AuditLog).where(
        AuditLog.actor_user_id == user.id, AuditLog.action == "profesor_login",
        AuditLog.created_at >= utcnow() - timedelta(days=days))) for days in (7, 30)}
    # Only the selected columns are fetched: payload, result and provider error text may contain private data.
    jobs = db.execute(select(ProfesorGenerationJob.request_id, ProfesorGenerationJob.status,
        ProfesorGenerationJob.attempt_count, ProfesorGenerationJob.failure_category,
        ProfesorGenerationJob.created_at, ProfesorGenerationJob.finished_at)
        .where(ProfesorGenerationJob.user_id == user.id, ProfesorGenerationJob.organization_id == user.organization_id)
        .order_by(ProfesorGenerationJob.created_at.desc()).limit(50)).all()
    job_counts = dict(db.execute(select(ProfesorGenerationJob.status, func.count()).where(
        ProfesorGenerationJob.user_id == user.id, ProfesorGenerationJob.organization_id == user.organization_id)
        .group_by(ProfesorGenerationJob.status)).all())
    usage = db.execute(select(UsageRecord.created_at, UsageRecord.model, UsageRecord.input_tokens, UsageRecord.output_tokens)
        .where(UsageRecord.user_id == user.id, UsageRecord.organization_id == user.organization_id,
               UsageRecord.product_code == "PROFESOR_PARTICULAR")
        .order_by(UsageRecord.created_at.desc()).limit(50)).all()
    snapshots = db.execute(select(ProfesorStateSnapshot.revision, ProfesorStateSnapshot.reason,
        ProfesorStateSnapshot.created_at, ProfesorStateSnapshot.counts).where(
        ProfesorStateSnapshot.user_id == user.id, ProfesorStateSnapshot.organization_id == user.organization_id)
        .order_by(ProfesorStateSnapshot.revision.desc()).limit(50)).all()
    licenses = select(License.id).where(License.organization_id == user.organization_id,
        License.product_code == "PROFESOR_PARTICULAR", (License.user_id == user.id) | License.user_id.is_(None))
    license_ids = [str(value) for value in db.scalars(licenses)]
    changes = db.execute(select(AuditLog, User.full_name).outerjoin(User, User.id == AuditLog.actor_user_id).where(
        ((AuditLog.entity_type == "user") & (AuditLog.entity_id == str(user.id))) |
        ((AuditLog.entity_type == "license") & AuditLog.entity_id.in_(license_ids)))
        .where(AuditLog.action.in_(("user_updated", "user_access_updated", "license_updated", "profesor_account_viewed", "profesor_catalog_viewed")))
        .order_by(AuditLog.created_at.desc()).limit(50)).all()
    sessions = dict(db.execute(select(ProfesorMaterialSession.status, func.count()).where(
        ProfesorMaterialSession.teacher_user_id == user.id, ProfesorMaterialSession.expires_at > utcnow())
        .group_by(ProfesorMaterialSession.status)).all())
    return {
        "counts": totals,
        "last_saved_at": stamp(snapshots[0].created_at) if snapshots else None,
        "revision": row.profesor_revision if row else 0,
        "activity": {"retention_days": ACTIVITY_DAYS, "last_login_at": stamp(latest.get("profesor_login")),
            "last_open_at": stamp(latest.get("profesor_activity")),
            "logins_7d": login_counts[7], "logins_30d": login_counts[30],
            "events": [{"at": stamp(e.created_at), "type": e.action,
                "method": (e.log_metadata or {}).get("method") if (e.log_metadata or {}).get("method") in {"google", "password"} else None} for e in events[:50]]},
        "generation_counts": job_counts,
        "generations": [{"request_id": j.request_id, "status": j.status, "attempts": j.attempt_count,
            "failure_category": j.failure_category, "created_at": stamp(j.created_at), "finished_at": stamp(j.finished_at)} for j in jobs],
        "usage": [{"at": stamp(u.created_at), "model": u.model, "input_tokens": u.input_tokens, "output_tokens": u.output_tokens} for u in usage],
        "versions": [{"revision": s.revision, "reason": s.reason, "at": stamp(s.created_at),
            "counts": {key: value for key, value in (s.counts or {}).items() if key in COLLECTIONS and isinstance(value, int)}} for s in snapshots],
        "changes": [{"at": stamp(e.created_at), "action": e.action, "actor_id": str(e.actor_user_id) if e.actor_user_id else None,
            "actor_name": name or None,
            "purpose": (e.log_metadata or {}).get("purpose") if e.action in ADMIN_ACTIONS and (e.log_metadata or {}).get("purpose") in {"administration", "support", "security"} else None}
            for e, name in changes],
        "live_sessions": sessions,
    }
