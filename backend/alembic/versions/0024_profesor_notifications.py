"""Persistent teacher inboxes; existing account and material data are unchanged."""
from alembic import op

revision = '0024_profesor_notifications'
down_revision = '0023_teacher_editor_recovery'
branch_labels = depends_on = None


def upgrade():
    from app.models import ProfesorNotification, ProfesorNotificationRecipient
    ProfesorNotification.__table__.create(op.get_bind(), checkfirst=True)
    ProfesorNotificationRecipient.__table__.create(op.get_bind(), checkfirst=True)


def downgrade():
    op.drop_table('profesor_notification_recipients')
    op.drop_table('profesor_notifications')
