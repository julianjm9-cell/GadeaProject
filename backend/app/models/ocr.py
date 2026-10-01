import uuid
from sqlalchemy import String, ForeignKey, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database.session import Base
from app.models.core import TimestampMixin, new_uuid


class OcrJob(Base, TimestampMixin):
    __tablename__ = "ocr_jobs"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("organizations.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    usage_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("usage_records.id"))
    filename: Mapped[str] = mapped_column(String(180))
    suffix: Mapped[str] = mapped_column(String(8))
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    provider: Mapped[str] = mapped_column(String(30))
    model: Mapped[str] = mapped_column(String(120))
    error: Mapped[str] = mapped_column(String(300), default="")
    result: Mapped[dict] = mapped_column(JSON, default=dict)
