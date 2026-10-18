"""Add revocable sessions and one-use account verification tokens; retain all user data."""
from alembic import op
import sqlalchemy as sa

revision = "0022_revocable_accounts"
down_revision = "0021_daily_teacher_backups"
branch_labels = depends_on = None


def upgrade():
    columns={row['name'] for row in sa.inspect(op.get_bind()).get_columns('users')}
    if 'email_verified_at' not in columns:
        op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    if 'requires_email_verification' not in columns:
        op.add_column("users", sa.Column("requires_email_verification", sa.Boolean(), nullable=False, server_default=sa.false()))
    from app.models import AuthSession, AccountToken
    AuthSession.__table__.create(op.get_bind(), checkfirst=True)
    AccountToken.__table__.create(op.get_bind(), checkfirst=True)
    op.execute(sa.text("UPDATE users SET email_verified_at = updated_at WHERE google_sub IS NOT NULL AND email_verified_at IS NULL"))


def downgrade():
    op.drop_table("account_tokens")
    op.drop_table("auth_sessions")
    op.drop_column("users", "requires_email_verification")
    op.drop_column("users", "email_verified_at")
