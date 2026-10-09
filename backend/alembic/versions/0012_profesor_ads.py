"""Public teacher advertisements and abuse reports.

Revision ID: 0012_profesor_ads
Revises: 0011_profesor_access_password
"""

from alembic import op
import sqlalchemy as sa


revision = "0012_profesor_ads"
down_revision = "0011_profesor_access_password"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "profesor_ads",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("manage_token_hash", sa.String(64), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("subjects", sa.String(300), nullable=False),
        sa.Column("headline", sa.String(140), nullable=False),
        sa.Column("levels", sa.String(200), nullable=False),
        sa.Column("modality", sa.String(30), nullable=False),
        sa.Column("location", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("price", sa.String(80), nullable=False),
        sa.Column("contact_email", sa.String(255), nullable=False),
        sa.Column("contact_phone", sa.String(40), nullable=False),
        sa.Column("image_name", sa.String(80), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consent_version", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_profesor_ads_status", "profesor_ads", ["status"])
    op.create_table(
        "profesor_ad_reports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("ad_id", sa.Uuid(), sa.ForeignKey("profesor_ads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_profesor_ad_reports_ad_id", "profesor_ad_reports", ["ad_id"])


def downgrade() -> None:
    op.drop_index("ix_profesor_ad_reports_ad_id", table_name="profesor_ad_reports")
    op.drop_table("profesor_ad_reports")
    op.drop_index("ix_profesor_ads_status", table_name="profesor_ads")
    op.drop_table("profesor_ads")
