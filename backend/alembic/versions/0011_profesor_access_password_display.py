"""Store encrypted copies of newly issued student passwords for teachers.

Revision ID: 0011_profesor_access_password
Revises: 0010_profesor_material_sessions
"""
from alembic import op
import sqlalchemy as sa


revision = "0011_profesor_access_password"
down_revision = "0010_profesor_material_sessions"
branch_labels = None
depends_on = None


def upgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("profesor_student_accesses")}
    if "password_encrypted" not in columns:
        op.add_column("profesor_student_accesses", sa.Column("password_encrypted", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("profesor_student_accesses", "password_encrypted")
