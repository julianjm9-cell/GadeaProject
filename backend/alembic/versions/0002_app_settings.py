"""add app settings

Revision ID: 0002_app_settings
Revises: 0001_initial_saas_core
Create Date: 2026-07-14
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_app_settings"
down_revision = "0001_initial_saas_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(120), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
