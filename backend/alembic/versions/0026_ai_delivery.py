"""Recoverable AI deliveries and app-scoped operational metering."""
from alembic import op
import sqlalchemy as sa

revision = '0026_ai_delivery'
down_revision = '0025_app_notifications'
branch_labels = depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    if 'product_code' not in {c['name'] for c in inspector.get_columns('profesor_provider_calls')}:
        op.add_column('profesor_provider_calls', sa.Column('product_code', sa.String(40), nullable=False, server_default='PROFESOR_PARTICULAR'))
    if 'ix_profesor_provider_calls_product_code' not in {i['name'] for i in inspector.get_indexes('profesor_provider_calls')}:
        op.create_index('ix_profesor_provider_calls_product_code', 'profesor_provider_calls', ['product_code'])
    from app.models import AiRequest
    AiRequest.__table__.create(op.get_bind(), checkfirst=True)


def downgrade():
    op.drop_table('ai_requests')
    op.drop_index('ix_profesor_provider_calls_product_code', table_name='profesor_provider_calls')
    op.drop_column('profesor_provider_calls', 'product_code')
