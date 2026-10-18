"""One broadcast, with a separate inbox state for every recipient."""
import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from app.database.session import Base
from app.models.core import new_uuid, utcnow


class ProfesorNotification(Base):
    __tablename__ = 'profesor_notifications'
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=new_uuid)
    send_key: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), unique=True, nullable=False)
    author_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)


class ProfesorNotificationRecipient(Base):
    __tablename__ = 'profesor_notification_recipients'
    __table_args__ = (Index('ix_profesor_notification_inbox', 'user_id', 'dismissed_at', 'read_at'),)
    notification_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey('profesor_notifications.id', ondelete='CASCADE'), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
