from datetime import datetime
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.core import new_uuid, utcnow


class PrivateAppAccount(Base):
    __tablename__ = "private_app_accounts"
    __table_args__ = (UniqueConstraint("app_id", "normalized_name", name="uq_private_app_account_name"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=new_uuid)
    app_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class PrivateAppSession(Base):
    __tablename__ = "private_app_sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("private_app_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


class PrivateAppProgress(Base):
    __tablename__ = "private_app_progress"
    account_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("private_app_accounts.id", ondelete="CASCADE"), primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
