import importlib.util
from datetime import datetime, timezone
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def load_module(path):
    spec = importlib.util.spec_from_file_location("ads_test_module", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_migration_preserves_old_rows_and_can_follow_runtime_schema():
    module = load_module(Path(__file__).parents[1] / 'alembic/versions/0013_ads_privacy.py')
    engine = create_engine('sqlite://')
    with engine.begin() as conn:
        for table in ['profesor_ads', 'profesor_ad_reports']:
            conn.execute(text(f'CREATE TABLE {table} (id INTEGER PRIMARY KEY)'))
            conn.execute(text(f'INSERT INTO {table} (id) VALUES (1)'))
        module.op = Operations(MigrationContext.configure(conn))
        module.upgrade()
        module.upgrade()
        assert conn.execute(text('SELECT governance FROM profesor_ads WHERE id=1')).scalar() == '{}'
        assert conn.execute(text('SELECT details FROM profesor_ad_reports WHERE id=1')).scalar() == '{}'
        assert 'governance' in {c['name'] for c in inspect(conn).get_columns('profesor_ads')}


def test_backup_retention_only_deletes_expired_completed_deployments(tmp_path):
    module = load_module(Path(__file__).parents[2] / 'infra/expire-backups.py')
    for name in ['deploy-20260101T000000Z-abcdef', 'deploy-20261001T000000Z-abcdef',
                 'deploy-20260101T000000Z-incomp', 'keep-me']:
        path = tmp_path / name
        path.mkdir()
        (path / 'environment.env').write_text('test')
        if not name.endswith('incomp'):
            (path / 'database.dump').write_bytes(b'backup')
    assert module.prune(tmp_path, datetime(2026,10,9,tzinfo=timezone.utc)) == 1
    assert not (tmp_path / 'deploy-20260101T000000Z-abcdef').exists()
    assert (tmp_path / 'deploy-20261001T000000Z-abcdef').exists()
    assert (tmp_path / 'deploy-20260101T000000Z-incomp').exists()
    assert (tmp_path / 'keep-me').exists()
