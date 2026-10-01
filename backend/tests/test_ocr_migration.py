import importlib.util
from pathlib import Path
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect


def test_ocr_migration_upgrade_and_downgrade():
    path = Path(__file__).parents[1] / "alembic/versions/0007_ocr_jobs.py"
    spec = importlib.util.spec_from_file_location("ocr_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        module.op = Operations(MigrationContext.configure(connection))
        module.upgrade()
        inspector = inspect(connection)
        assert "ocr_jobs" in inspector.get_table_names()
        assert {c["name"] for c in inspector.get_columns("ocr_jobs")} >= {"user_id", "organization_id", "usage_id", "status", "result"}
        assert len(inspector.get_foreign_keys("ocr_jobs")) == 3
        module.downgrade()
        assert "ocr_jobs" not in inspect(connection).get_table_names()
