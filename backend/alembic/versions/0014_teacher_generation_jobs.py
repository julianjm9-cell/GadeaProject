"""Persist resumable material jobs without modifying existing materials."""
from alembic import op
from app.models import ProfesorGenerationJob

revision = '0014_teacher_generation_jobs'
down_revision = '0013_ads_privacy'
branch_labels = None
depends_on = None


def upgrade():
    ProfesorGenerationJob.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade():
    ProfesorGenerationJob.__table__.drop(bind=op.get_bind(), checkfirst=True)
