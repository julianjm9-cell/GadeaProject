"""Replace pupil accounts with short-lived anonymous material sessions."""
from alembic import op
import sqlalchemy as sa

revision = "0018_anonymous_material_sessions"
down_revision = "0017_teacher_generation_attempts"
branch_labels = None
depends_on = None


def upgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("profesor_material_sessions")}
    if "expires_at" not in columns:
        op.add_column("profesor_material_sessions", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE profesor_material_sessions SET expires_at = NOW() + INTERVAL '24 hours' WHERE expires_at IS NULL")
    op.alter_column("profesor_material_sessions", "expires_at", nullable=False)
    op.alter_column("profesor_material_sessions", "access_id", existing_type=sa.Uuid(), nullable=True)
    # The old pupil-account records are no longer accessible or required.
    op.execute("DELETE FROM profesor_material_sessions WHERE access_id IS NOT NULL")
    op.execute("DELETE FROM profesor_student_accesses")


def downgrade():
    op.execute("DELETE FROM profesor_material_sessions WHERE access_id IS NULL")
    op.alter_column("profesor_material_sessions", "access_id", existing_type=sa.Uuid(), nullable=False)
    op.drop_column("profesor_material_sessions", "expires_at")
