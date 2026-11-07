"""Assign existing teacher notices to their app and allow isolated inboxes per product."""
from alembic import op
import sqlalchemy as sa

revision = '0025_app_notifications'
down_revision = '0024_profesor_notifications'
branch_labels = depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    if 'product_code' not in {column['name'] for column in inspector.get_columns('profesor_notifications')}:
        op.add_column('profesor_notifications', sa.Column('product_code', sa.String(40), nullable=False, server_default='PROFESOR_PARTICULAR'))
    if 'ix_profesor_notifications_product_code' not in {index['name'] for index in inspector.get_indexes('profesor_notifications')}:
        op.create_index('ix_profesor_notifications_product_code', 'profesor_notifications', ['product_code'])


def downgrade():
    op.drop_index('ix_profesor_notifications_product_code', table_name='profesor_notifications')
    op.drop_column('profesor_notifications', 'product_code')
