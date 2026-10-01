"""Persistent isolated invoice processing jobs."""
from alembic import op
import sqlalchemy as sa

revision = "0007_ocr_jobs"
down_revision = "0006_user_scoped_licenses"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("ocr_jobs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("usage_id", sa.Uuid(), sa.ForeignKey("usage_records.id"), nullable=False),
        sa.Column("filename", sa.String(180), nullable=False),
        sa.Column("suffix", sa.String(8), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("model", sa.String(120), nullable=False),
        sa.Column("error", sa.String(300), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    for field in ("organization_id", "user_id", "status"):
        op.create_index("ix_ocr_jobs_" + field, "ocr_jobs", [field])


def downgrade():
    op.drop_table("ocr_jobs")
