import importlib.util
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
