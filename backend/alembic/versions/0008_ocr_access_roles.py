"""Add per-license app role for FACTURAS.

Revision ID: 0008_ocr_access_roles
Revises: 0007_ocr_jobs
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_ocr_access_roles"
down_revision = "0007_ocr_jobs"
branch_labels = None
depends_on = None


def upgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("licenses")}
    if "access_role" not in columns:
        op.add_column("licenses", sa.Column("access_role", sa.String(20), nullable=False, server_default="user"))


def downgrade():
    op.drop_column("licenses", "access_role")
