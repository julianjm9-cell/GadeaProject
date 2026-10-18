"""Administrator broadcasts and private teacher inboxes. Messages are plain text."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import Uuid, and_, case, func, insert, literal, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.auth.dependencies import current_license, current_user, require_superadmin
from app.database.session import get_db
from app.models import License, Organization, ProfesorNotification as Notice, ProfesorNotificationRecipient as Receipt, User
from app.models.core import utcnow
from app.services.audit import audit

router = APIRouter(tags=['profesor-notifications'])


class Broadcast(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    send_key: UUID
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=3000)

    @field_validator('title', 'body')
    @classmethod
    def plain_text(cls, value):
        if any(ord(c) < 32 and c not in '\n\t\r' for c in value):
            raise ValueError('El mensaje contiene caracteres no válidos.')
        return value


class ReadMessages(BaseModel):
    model_config = ConfigDict(extra='forbid')
    ids: list[UUID] = Field(min_length=1, max_length=30)


def recipients():
    access = select(License.id).where(License.organization_id == User.organization_id,
        License.product_code == 'PROFESOR_PARTICULAR', or_(License.user_id == User.id, License.user_id.is_(None))).exists()
    return select(User.id).join(Organization).where(User.is_active.is_(True), User.role != 'superadmin', Organization.status == 'active', access)


def summary(db, user):
    total, unread = db.execute(select(func.count(), func.coalesce(func.sum(case((Receipt.read_at.is_(None), 1), else_=0)), 0))
        .where(Receipt.user_id == user.id, Receipt.dismissed_at.is_(None))).one()
    return {'total': total, 'unread': int(unread)}


def teacher_access(license_obj: License = Depends(current_license)):
    if license_obj.product_code != 'PROFESOR_PARTICULAR':
        raise HTTPException(403, 'Requiere acceso a Profesor Particular.')


@router.get('/admin/profesor-notifications')
def admin_inbox(_: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    counts = select(Receipt.notification_id.label('id'), func.count().label('delivered'),
        func.sum(case((Receipt.read_at.is_not(None), 1), else_=0)).label('read'),
        func.sum(case((Receipt.dismissed_at.is_not(None), 1), else_=0)).label('dismissed')).group_by(Receipt.notification_id).subquery()
    rows = db.execute(select(Notice, counts.c.delivered, counts.c.read, counts.c.dismissed)
        .outerjoin(counts, counts.c.id == Notice.id).order_by(Notice.created_at.desc(), Notice.id.desc()).limit(20))
    return {'recipients': db.scalar(select(func.count()).select_from(recipients().subquery())),
        'messages': [{'id': str(n.id), 'title': n.title, 'body': n.body, 'created_at': n.created_at,
            'delivered': delivered or 0, 'read': read or 0, 'dismissed': dismissed or 0} for n, delivered, read, dismissed in rows]}


@router.post('/admin/profesor-notifications')
def broadcast(payload: Broadcast, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    # Serialize this sender and make a network retry return the original delivery.
    db.scalar(select(User.id).where(User.id == actor.id).with_for_update())
    previous = db.scalar(select(Notice).where(Notice.send_key == payload.send_key))
    if previous:
        if previous.author_id != actor.id or previous.title != payload.title or previous.body != payload.body:
            raise HTTPException(409, 'Este envío ya se utilizó para otro mensaje. Revisa el historial.')
        return {'id': str(previous.id), 'delivered': db.scalar(select(func.count()).select_from(Receipt).where(Receipt.notification_id == previous.id)), 'reused': True}
    notice = Notice(send_key=payload.send_key, author_id=actor.id, title=payload.title, body=payload.body)
    db.add(notice)
    try:
        db.flush()
        db.execute(insert(Receipt).from_select(['notification_id', 'user_id'],
            recipients().with_only_columns(literal(notice.id, type_=Uuid(as_uuid=True)), User.id)))
        delivered = db.scalar(select(func.count()).select_from(Receipt).where(Receipt.notification_id == notice.id))
        if not delivered:
            raise HTTPException(409, 'No hay cuentas de Profesor Particular disponibles para recibir el aviso.')
        audit(db, actor=actor, organization_id=actor.organization_id, action='profesor_notification_sent',
            entity_type='profesor_notification', entity_id=str(notice.id), metadata={'recipients': delivered})
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, 'No se ha confirmado el envío. Actualiza el historial antes de reintentar.') from exc
    return {'id': str(notice.id), 'delivered': delivered, 'reused': False}


@router.get('/api/profesor/notifications/summary', dependencies=[Depends(teacher_access)])
def inbox_summary(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return summary(db, user)


@router.get('/api/profesor/notifications', dependencies=[Depends(teacher_access)])
def inbox(before: UUID | None = None, limit: int = Query(30, ge=1, le=30), user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Notice, Receipt).join(Receipt, Receipt.notification_id == Notice.id).where(Receipt.user_id == user.id, Receipt.dismissed_at.is_(None))
    if before:
        anchor = db.scalar(select(Notice).join(Receipt, Receipt.notification_id == Notice.id).where(Notice.id == before, Receipt.user_id == user.id))
        if not anchor:
            raise HTTPException(404, 'No se encuentra esta notificación.')
        stmt = stmt.where(or_(Notice.created_at < anchor.created_at, and_(Notice.created_at == anchor.created_at, Notice.id < anchor.id)))
    rows = list(db.execute(stmt.order_by(Notice.created_at.desc(), Notice.id.desc()).limit(limit + 1)))
    return {**summary(db, user), 'messages': [{'id': str(n.id), 'title': n.title, 'body': n.body, 'created_at': n.created_at,
        'read': r.read_at is not None} for n, r in rows[:limit]], 'next': str(rows[limit - 1][0].id) if len(rows) > limit else None}


@router.post('/api/profesor/notifications/read', dependencies=[Depends(teacher_access)])
def mark_read(payload: ReadMessages, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(Receipt).where(Receipt.user_id == user.id, Receipt.notification_id.in_(payload.ids),
        Receipt.dismissed_at.is_(None), Receipt.read_at.is_(None)).values(read_at=utcnow()))
    db.commit()
    return summary(db, user)


@router.post('/api/profesor/notifications/{notification_id}/dismiss', dependencies=[Depends(teacher_access)])
def dismiss(notification_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    receipt = db.get(Receipt, (notification_id, user.id))
    if not receipt:
        raise HTTPException(404, 'No se encuentra esta notificación.')
    if receipt.dismissed_at is None:
        receipt.dismissed_at = utcnow()
    db.commit()
    return summary(db, user)
