"""Add teacher save revisions and baseline snapshots without changing saved data."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.models import ClientState, ProfesorStateSnapshot
from app.services.profesor_state_history import checkpoint

revision = "0020_profesor_state_history"
down_revision = "0019_remove_retired_pupil_schema"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if "profesor_revision" not in {c["name"] for c in sa.inspect(bind).get_columns("client_states")}:
        op.add_column("client_states", sa.Column("profesor_revision", sa.Integer(), nullable=False, server_default="0"))
    ProfesorStateSnapshot.__table__.create(bind=bind, checkfirst=True)
    with Session(bind=bind) as db:
        for row in db.scalars(sa.select(ClientState).execution_options(yield_per=50)):
            checkpoint(db, row, "initial")
        db.commit()


def downgrade():
    raise RuntimeError("El historial protege datos recuperables. No se elimina mediante downgrade automático.")
