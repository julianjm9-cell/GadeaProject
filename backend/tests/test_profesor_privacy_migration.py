"""Pending upgrades retire login credentials without deleting private planning."""
import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_retired_credentials_removed_but_private_teacher_state_preserved():
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    metadata = sa.MetaData()
    states = sa.Table("client_states", metadata,
                      sa.Column("id", sa.Integer, primary_key=True), sa.Column("data", sa.JSON, nullable=False))
    sa.Table("profesor_student_accesses", metadata, sa.Column("id", sa.Integer, primary_key=True))
    sessions = sa.Table("profesor_material_sessions", metadata,
                        sa.Column("id", sa.Integer, primary_key=True), sa.Column("access_id", sa.Integer))
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(states.insert(), [{"id": 1, "data": {"__apps": {
            "profesor_particular": {
                "students": [{"name": "Nombre antiguo"}],
                "activityAttempts": [{"answer": "Respuesta antigua"}],
                "library": [{"id": "private", "studentId": "old"}, {"id": "shared", "title": "Común"}],
            }, "diplomator": {"keep": True},
        }}}, {"id": 2, "data": {"__apps": {"profesor_particular": {"library": [{"id": "m2"}]}}}}])
        connection.execute(sessions.insert(), [{"id": 1, "access_id": 99}, {"id": 2, "access_id": None}])

        path = Path(__file__).parents[1] / "alembic/versions/0019_remove_retired_pupil_schema.py"
        spec = importlib.util.spec_from_file_location("privacy_migration", path)
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()

        inspector = sa.inspect(connection)
        assert not inspector.has_table("profesor_student_accesses")
        assert "access_id" not in {column["name"] for column in inspector.get_columns("profesor_material_sessions")}
        assert connection.execute(sa.text("SELECT id FROM profesor_material_sessions")).scalars().all() == [2]
        first = connection.execute(sa.select(states.c.data).where(states.c.id == 1)).scalar_one()
        assert first["__apps"]["profesor_particular"] == {
            "students": [{"name": "Nombre antiguo"}],
            "activityAttempts": [{"answer": "Respuesta antigua"}],
            "library": [{"id": "private", "studentId": "old"}, {"id": "shared", "title": "Común"}],
        }
        assert first["__apps"]["diplomator"] == {"keep": True}
        second = connection.execute(sa.select(states.c.data).where(states.c.id == 2)).scalar_one()
        assert second["__apps"]["profesor_particular"]["library"] == [{"id": "m2"}]
