from pathlib import Path
import runpy
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_account_and_recovery_migrations_keep_existing_identity_and_private_state():
    engine=sa.create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(sa.text('CREATE TABLE organizations (id CHAR(32) PRIMARY KEY)'))
        connection.execute(sa.text('CREATE TABLE users (id CHAR(32) PRIMARY KEY, email TEXT, password_hash TEXT, google_sub TEXT, updated_at DATETIME)'))
        connection.execute(sa.text("INSERT INTO users VALUES ('same-user','kept@example.com','unchanged-hash',NULL,'2026-10-17')"))
        connection.execute(sa.text('CREATE TABLE client_states (id TEXT, data TEXT)'))
        connection.execute(sa.text("INSERT INTO client_states VALUES ('same-state','{\"library\":[{\"id\":\"kept\"}]}')"))
        connection.execute(sa.text('CREATE TABLE profesor_generation_jobs (id CHAR(32) PRIMARY KEY)'))
        directory=Path(__file__).resolve().parents[1]/'alembic'/'versions'
        for filename in ('0022_revocable_accounts.py','0023_teacher_editor_recovery.py'):
            module=runpy.run_path(str(directory/filename))
            with Operations.context(MigrationContext.configure(connection)):
                module['upgrade']();module['upgrade']()
        assert connection.execute(sa.text('SELECT id,email,password_hash,requires_email_verification FROM users')).one()==('same-user','kept@example.com','unchanged-hash',0)
        assert connection.execute(sa.text('SELECT data FROM client_states')).scalar_one()=='{"library":[{"id":"kept"}]}'
        assert {'auth_sessions','account_tokens','profesor_editor_drafts','profesor_provider_calls'}<=set(sa.inspect(connection).get_table_names())
