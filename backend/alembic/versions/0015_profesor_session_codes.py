"""Give each live material session its own student join code."""
from alembic import op
import sqlalchemy as sa

revision = "0015_profesor_session_codes"
down_revision = "0014_teacher_generation_jobs"
branch_labels = None
depends_on = None


def upgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("profesor_material_sessions")}
    if "join_code_hash" not in columns:
        op.add_column("profesor_material_sessions", sa.Column("join_code_hash", sa.String(64), nullable=True))
    if "join_code_encrypted" not in columns:
        op.add_column("profesor_material_sessions", sa.Column("join_code_encrypted", sa.Text(), nullable=True))
    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("profesor_material_sessions")}
    if "ix_profesor_material_sessions_join_code_hash" not in indexes:
        op.create_index("ix_profesor_material_sessions_join_code_hash", "profesor_material_sessions", ["join_code_hash"], unique=True)


def downgrade():
    op.drop_index("ix_profesor_material_sessions_join_code_hash", table_name="profesor_material_sessions")
    op.drop_column("profesor_material_sessions", "join_code_encrypted")
    op.drop_column("profesor_material_sessions", "join_code_hash")
