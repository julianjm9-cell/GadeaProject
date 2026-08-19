"""add google oauth and drive fields

Revision ID: 0003_google_oauth_drive
Revises: 0002_app_settings
Create Date: 2026-07-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_google_oauth_drive"
down_revision = "0002_app_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_sub", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("google_picture", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("drive_refresh_token", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("drive_folder_id", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("drive_connected_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_google_sub", table_name="users")
    op.drop_column("users", "drive_connected_at")
    op.drop_column("users", "drive_folder_id")
    op.drop_column("users", "drive_refresh_token")
    op.drop_column("users", "google_picture")
    op.drop_column("users", "google_sub")
