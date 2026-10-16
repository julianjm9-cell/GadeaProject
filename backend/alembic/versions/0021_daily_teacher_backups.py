"""Keep five teacher backups and allow an unchanged desktop on different days."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from alembic import op
import sqlalchemy as sa

revision = "0021_daily_teacher_backups"
down_revision = "0020_profesor_state_history"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {c["name"] for c in sa.inspect(bind).get_columns("profesor_state_snapshots")}
    if "backup_day" not in columns:
        op.add_column("profesor_state_snapshots", sa.Column("backup_day", sa.Date(), nullable=True))
    constraints = {c["name"] for c in sa.inspect(bind).get_unique_constraints("profesor_state_snapshots")}
    indexes = {c["name"] for c in sa.inspect(bind).get_indexes("profesor_state_snapshots")}
    if "uq_profesor_snapshot_revision" in constraints:
        with op.batch_alter_table("profesor_state_snapshots") as batch:
            batch.drop_constraint("uq_profesor_snapshot_revision", type_="unique")
    if "uq_profesor_snapshot_day" not in constraints | indexes:
        op.create_index("uq_profesor_snapshot_day", "profesor_state_snapshots", ["user_id", "backup_day"], unique=True)
    if "ix_audit_entity_action_created" not in {i["name"] for i in sa.inspect(bind).get_indexes("audit_logs")}:
        op.create_index("ix_audit_entity_action_created", "audit_logs", ["entity_type", "entity_id", "action", "created_at"])
    op.execute("""DELETE FROM profesor_state_snapshots WHERE id IN (
        SELECT id FROM (SELECT id, ROW_NUMBER() OVER (
            PARTITION BY user_id ORDER BY created_at DESC, revision DESC, id DESC
        ) AS position FROM profesor_state_snapshots) ranked WHERE position > 5)""")
    settings = sa.Table("app_settings", sa.MetaData(), autoload_with=bind)
    key = "profesor_history_last_daily_backup"
    if bind.execute(sa.select(settings.c.key).where(settings.c.key == key)).first() is None:
        now = datetime.now(timezone.utc)
        bind.execute(settings.insert().values(key=key, value=now.astimezone(ZoneInfo("Europe/Madrid")).date().isoformat(),
            created_at=now, updated_at=now))


def downgrade():
    raise RuntimeError("La reducción a cinco copias no se revierte automáticamente.")
