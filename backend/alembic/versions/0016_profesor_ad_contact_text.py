"""Store a teacher ad's contact instructions as free text."""

from alembic import op
import sqlalchemy as sa


revision = "0016_profesor_ad_contact_text"
down_revision = "0015_profesor_session_codes"
branch_labels = None
depends_on = None


def upgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("profesor_ads")}
    if "contact" not in columns:
        op.add_column("profesor_ads", sa.Column("contact", sa.String(255), nullable=False, server_default=""))
        op.execute("UPDATE profesor_ads SET contact = substr(CASE WHEN contact_email <> '' AND contact_phone <> '' THEN contact_email || ' · ' || contact_phone WHEN contact_email <> '' THEN contact_email ELSE contact_phone END, 1, 255)")


def downgrade():
    op.drop_column("profesor_ads", "contact")
