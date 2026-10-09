"""Consent evidence and private moderation records, preserving existing ads."""
from alembic import op
import sqlalchemy as sa

revision = "0013_ads_privacy"
down_revision = "0012_profesor_ads"
branch_labels = None
depends_on = None


def upgrade():
    # Runtime schema can have added these columns before Alembic runs.
    for table, column in (("profesor_ads", "governance"), ("profesor_ad_reports", "details")):
        if column not in {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}:
            op.add_column(table, sa.Column(column, sa.JSON(), nullable=False, server_default="{}"))


def downgrade():
    op.drop_column("profesor_ad_reports", "details")
    op.drop_column("profesor_ads", "governance")
