"""Live material sessions shared with student accounts.

Revision ID: 0010_profesor_material_sessions
Revises: 0009_profesor_student_access
"""
from alembic import op
import sqlalchemy as sa


revision = "0010_profesor_material_sessions"
down_revision = "0009_profesor_student_access"
branch_labels = None
depends_on = None


def upgrade():
    # Older installations may already have this table from runtime schema repair.
    if "profesor_material_sessions" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "profesor_material_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("teacher_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("access_id", sa.Uuid(), sa.ForeignKey("profesor_student_accesses.id"), nullable=False),
        sa.Column("material_id", sa.String(120), nullable=False),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("subject", sa.String(100), nullable=False),
        sa.Column("material_snapshot", sa.JSON(), nullable=False),
        sa.Column("progress", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_profesor_material_sessions_teacher_user_id", "profesor_material_sessions", ["teacher_user_id"])
    op.create_index("ix_profesor_material_sessions_access_id", "profesor_material_sessions", ["access_id"])
    op.create_index("ix_profesor_material_sessions_status", "profesor_material_sessions", ["status"])


def downgrade():
    op.drop_table("profesor_material_sessions")
