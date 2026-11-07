"""Assign existing teacher notices to their app and allow isolated inboxes per product."""
from alembic import op
import sqlalchemy as sa

revision = '0025_app_notifications'
down_revision = '0024_profesor_notifications'
branch_labels = depends_on = None


def upgrade():
    op.add_column('profesor_notifications', sa.Column('product_code', sa.String(40), nullable=False, server_default='PROFESOR_PARTICULAR'))
    op.create_index('ix_profesor_notifications_product_code', 'profesor_notifications', ['product_code'])


def downgrade():
    op.drop_index('ix_profesor_notifications_product_code', table_name='profesor_notifications')
    op.drop_column('profesor_notifications', 'product_code')
