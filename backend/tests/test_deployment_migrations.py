"""Older deployments may already have columns from runtime_schema startup repair."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest


@pytest.mark.parametrize("filename,columns,index,fk", [
    ("0003_google_oauth_drive.py", ["google_sub", "google_picture", "drive_refresh_token", "drive_folder_id", "drive_connected_at"], "ix_users_google_sub", None),
    ("0006_user_scoped_licenses.py", ["user_id"], "ix_licenses_user_id", "fk_licenses_user_id_users"),
])
@pytest.mark.parametrize("existing", [False, True])
def test_migration_handles_runtime_created_schema(monkeypatch, filename, columns, index, fk, existing):
    path = Path(__file__).parents[1] / "alembic" / "versions" / filename
    spec = importlib.util.spec_from_file_location("migration_under_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    operations = Mock()
    inspector = SimpleNamespace(
        get_columns=lambda table: [{"name": name} for name in columns] if existing else [],
        get_indexes=lambda table: [{"name": index}] if existing else [],
        get_foreign_keys=lambda table: [{"name": fk}] if existing and fk else [],
    )
    monkeypatch.setattr(module, "op", operations)
    monkeypatch.setattr(module.context, "is_offline_mode", lambda: False)
    monkeypatch.setattr(module.sa, "inspect", lambda bind: inspector)
    module.upgrade()
    assert operations.add_column.call_count == (0 if existing else len(columns))
    assert operations.create_index.call_count == (0 if existing else 1)
    assert operations.create_foreign_key.call_count == (1 if fk and not existing else 0)
