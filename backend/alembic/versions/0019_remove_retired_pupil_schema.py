"""Remove retired pupil credentials and scrub saved teacher state.

Revision ID: 0019_remove_retired_pupil_schema
Revises: 0018_anonymous_material_sessions
"""
from alembic import op
import sqlalchemy as sa

revision = "0019_remove_retired_pupil_schema"
down_revision = "0018_anonymous_material_sessions"
branch_labels = None
depends_on = None


def clean_teacher_state(payload):
    if not isinstance(payload, dict):
        return {}
    blocked = {"students", "sessions", "assignments", "activityAttempts", "bundles", "tasks", "selectedStudent", "studentProgress"}
    clean = {key: value for key, value in payload.items() if key not in blocked}
    library = clean.get("library")
    if isinstance(library, list):
        clean["library"] = [{key: value for key, value in item.items() if key not in {"studentId", "student_id"}}
                            for item in library if isinstance(item, dict) and not item.get("studentId") and not item.get("student_id")]
    return clean


def upgrade():
    bind = op.get_bind()
    metadata = sa.MetaData()
    states = sa.Table("client_states", metadata, autoload_with=bind)
    for row in bind.execute(sa.select(states.c.id, states.c.data)):
        data = row.data
        if not isinstance(data, dict):
            continue
        apps = data.get("__apps")
        if not isinstance(apps, dict) or "profesor_particular" not in apps:
            continue
        cleaned = clean_teacher_state(apps["profesor_particular"])
        if cleaned != apps["profesor_particular"]:
            bind.execute(states.update().where(states.c.id == row.id).values(
                data={**data, "__apps": {**apps, "profesor_particular": cleaned}},
            ))

    # Keep the migration safe if a previous runtime repair recreated legacy rows.
    op.execute("DELETE FROM profesor_material_sessions WHERE access_id IS NOT NULL")
    op.execute("DELETE FROM profesor_student_accesses")
    op.drop_column("profesor_material_sessions", "access_id")
    op.drop_table("profesor_student_accesses")


def downgrade():
    raise RuntimeError("Retired pupil credentials and state cannot be restored by a migration.")
