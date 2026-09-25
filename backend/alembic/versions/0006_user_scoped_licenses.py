"""add user-scoped licenses

Revision ID: 0006_user_scoped_licenses
Revises: 0005_eso_desk_inventory
Create Date: 2026-09-25
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_user_scoped_licenses"
down_revision = "0005_eso_desk_inventory"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("licenses", sa.Column("user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_licenses_user_id_users", "licenses", "users", ["user_id"], ["id"])
    op.create_index("ix_licenses_user_id", "licenses", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_licenses_user_id", table_name="licenses")
    op.drop_constraint("fk_licenses_user_id_users", "licenses", type_="foreignkey")
    op.drop_column("licenses", "user_id")
