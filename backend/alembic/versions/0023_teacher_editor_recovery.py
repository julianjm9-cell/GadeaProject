"""Bounded private drafts and acknowledgement of incorporated AI results."""
from alembic import op
import sqlalchemy as sa
revision = "0023_teacher_editor_recovery"
down_revision = "0022_revocable_accounts"
branch_labels = depends_on = None


def upgrade():
    from app.models import ProfesorEditorDraft, ProviderCall
    ProfesorEditorDraft.__table__.create(op.get_bind(), checkfirst=True)
    ProviderCall.__table__.create(op.get_bind(), checkfirst=True)
    if 'imported_at' not in {row['name'] for row in sa.inspect(op.get_bind()).get_columns('profesor_generation_jobs')}:
        op.add_column("profesor_generation_jobs", sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_table("profesor_provider_calls")
    op.drop_column("profesor_generation_jobs", "imported_at")
    op.drop_table("profesor_editor_drafts")
