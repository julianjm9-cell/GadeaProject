from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON
from app.database.session import Base
from app.models.core import TimestampMixin, new_uuid
import uuid


class ProfesorGenerationJob(Base, TimestampMixin):
    __tablename__ = 'profesor_generation_jobs'
    __table_args__ = (UniqueConstraint('user_id', 'request_id', name='uq_profesor_generation_request'),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey('users.id'), index=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey('organizations.id'), index=True)
    license_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey('licenses.id'))
    request_id: Mapped[str] = mapped_column(String(36), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default='queued', nullable=False)
    lease: Mapped[str] = mapped_column(String(36), default='', nullable=False)
    completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str] = mapped_column(Text, default='', nullable=False)
    error_status: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
