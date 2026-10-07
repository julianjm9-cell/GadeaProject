"""Premium student credentials and teacher Meet connection.

Revision ID: 0009_profesor_student_access
Revises: 0008_ocr_access_roles
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_profesor_student_access"
down_revision = "0008_ocr_access_roles"
branch_labels = None
depends_on = None


def upgrade():
    existing_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("users")}
    if "meet_refresh_token" not in existing_columns:
        op.add_column("users", sa.Column("meet_refresh_token", sa.Text(), nullable=True))
    if "meet_connected_at" not in existing_columns:
        op.add_column("users", sa.Column("meet_connected_at", sa.DateTime(timezone=True), nullable=True))
    if "profesor_student_accesses" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "profesor_student_accesses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("teacher_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("student_id", sa.String(120), nullable=False),
        sa.Column("username", sa.String(80), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("session_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("meet_uri", sa.String(500), nullable=True),
        sa.Column("meet_space", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("teacher_user_id", "student_id", name="uq_profesor_access_teacher_student"),
        sa.UniqueConstraint("username", name="uq_profesor_access_username"),
    )
    op.create_index("ix_profesor_student_accesses_teacher_user_id", "profesor_student_accesses", ["teacher_user_id"])
    op.create_index("ix_profesor_student_accesses_username", "profesor_student_accesses", ["username"])


def downgrade():
    op.drop_table("profesor_student_accesses")
    op.drop_column("users", "meet_connected_at")
    op.drop_column("users", "meet_refresh_token")
