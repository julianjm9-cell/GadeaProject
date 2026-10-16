"""Remove retired pupil credentials while preserving private teacher planning.

Revision ID: 0019_remove_retired_pupil_schema
Revises: 0018_anonymous_material_sessions
"""
from alembic import op

revision = "0019_remove_retired_pupil_schema"
down_revision = "0018_anonymous_material_sessions"
branch_labels = None
depends_on = None


def upgrade():
    # The current product retains private teacher-owned profiles, calendar and
    # tasks. Pending upgrades must not run the former blanket state deletion.
    # Keep the migration safe if a previous runtime repair recreated legacy rows.
    op.execute("DELETE FROM profesor_material_sessions WHERE access_id IS NOT NULL")
    op.execute("DELETE FROM profesor_student_accesses")
    op.drop_column("profesor_material_sessions", "access_id")
    op.drop_table("profesor_student_accesses")


def downgrade():
    raise RuntimeError("Retired pupil credentials and state cannot be restored by a migration.")
