"""Count resumptions of material generation jobs."""
from alembic import op
import sqlalchemy as sa

revision = "0017_teacher_generation_attempts"
down_revision = "0016_profesor_ad_contact_text"
branch_labels = None
depends_on = None


def upgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("profesor_generation_jobs")}
    if "attempt_count" not in columns:
        op.add_column("profesor_generation_jobs", sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"))
    if "failure_category" not in columns:
        op.add_column("profesor_generation_jobs", sa.Column("failure_category", sa.String(24), nullable=False, server_default=""))


def downgrade():
    op.drop_column("profesor_generation_jobs", "attempt_count")
    op.drop_column("profesor_generation_jobs", "failure_category")
