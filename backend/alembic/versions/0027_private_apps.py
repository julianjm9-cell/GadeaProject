"""Private app accounts, sessions and progression without changing existing users."""
from alembic import op
from app.models.private_apps import PrivateAppAccount, PrivateAppSession, PrivateAppProgress

revision = "0027_private_apps"
down_revision = "0026_ai_delivery"
branch_labels = None
depends_on = None


def upgrade():
    for model in (PrivateAppAccount, PrivateAppSession, PrivateAppProgress):
        model.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade():
    for model in (PrivateAppProgress, PrivateAppSession, PrivateAppAccount):
        model.__table__.drop(bind=op.get_bind(), checkfirst=True)
