"""add user-scoped licenses

Revision ID: 0006_user_scoped_licenses
Revises: 0005_eso_desk_inventory
Create Date: 2026-09-25
"""

from alembic import context, op
import sqlalchemy as sa


revision = "0006_user_scoped_licenses"
down_revision = "0005_eso_desk_inventory"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Accommodate the compatibility schema created by earlier app startups.
    inspector = None if context.is_offline_mode() else sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("licenses")} if inspector else set()
    foreign_keys = {key["name"] for key in inspector.get_foreign_keys("licenses")} if inspector else set()
    indexes = {index["name"] for index in inspector.get_indexes("licenses")} if inspector else set()
    if "user_id" not in columns:
        op.add_column("licenses", sa.Column("user_id", sa.Uuid(), nullable=True))
    if "fk_licenses_user_id_users" not in foreign_keys:
        op.create_foreign_key("fk_licenses_user_id_users", "licenses", "users", ["user_id"], ["id"])
    if "ix_licenses_user_id" not in indexes:
        op.create_index("ix_licenses_user_id", "licenses", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_licenses_user_id", table_name="licenses")
    op.drop_constraint("fk_licenses_user_id_users", "licenses", type_="foreignkey")
    op.drop_column("licenses", "user_id")
