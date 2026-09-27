"""add google oauth and drive fields

Revision ID: 0003_google_oauth_drive
Revises: 0002_app_settings
Create Date: 2026-07-15
"""

from alembic import context, op
import sqlalchemy as sa


revision = "0003_google_oauth_drive"
down_revision = "0002_app_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Older app versions create these fields at startup before Alembic runs.
    inspector = None if context.is_offline_mode() else sa.inspect(op.get_bind())
    existing = {column["name"] for column in inspector.get_columns("users")} if inspector else set()
    columns = (
        sa.Column("google_sub", sa.String(255), nullable=True),
        sa.Column("google_picture", sa.String(500), nullable=True),
        sa.Column("drive_refresh_token", sa.Text(), nullable=True),
        sa.Column("drive_folder_id", sa.String(255), nullable=True),
        sa.Column("drive_connected_at", sa.DateTime(timezone=True), nullable=True),
    )
    for column in columns:
        if column.name not in existing:
            op.add_column("users", column)
    indexes = {index["name"] for index in inspector.get_indexes("users")} if inspector else set()
    if "ix_users_google_sub" not in indexes:
        op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_google_sub", table_name="users")
    op.drop_column("users", "drive_connected_at")
    op.drop_column("users", "drive_folder_id")
    op.drop_column("users", "drive_refresh_token")
    op.drop_column("users", "google_picture")
    op.drop_column("users", "google_sub")
