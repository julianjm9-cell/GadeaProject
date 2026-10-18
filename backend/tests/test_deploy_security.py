import importlib.util
from pathlib import Path
from cryptography.fernet import Fernet


def test_security_configuration_is_idempotent_and_preserves_existing_secrets(tmp_path):
    source=Path(__file__).resolve().parents[2]/'infra'/'prepare-security-env.py'
    spec=importlib.util.spec_from_file_location('prepare_security_env',source)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    env=tmp_path/'.env'
    original_key=Fernet.generate_key().decode()
    env.write_text('SITE_ADDRESS=educame.tech\nJWT_SECRET=existing-signing-secret-that-must-not-change\nSMTP_PASSWORD=private-test-value\nOAUTH_TOKEN_ENCRYPTION_KEY='+original_key+'\nPROFESOR_SIGNUP_PLAN=PROFESOR_PREMIUM\n',encoding='utf-8')
    module.prepare(env);first=env.read_text(encoding='utf-8');module.prepare(env)
    assert env.read_text(encoding='utf-8')==first
    assert 'OAUTH_TOKEN_ENCRYPTION_KEY='+original_key in first
    assert 'JWT_SECRET=existing-signing-secret-that-must-not-change' in first
    assert 'SMTP_PASSWORD=private-test-value' in first
    assert 'PROFESOR_SIGNUP_PLAN=PROFESOR_FREE' in first
    assert 'PUBLIC_BASE_URL=https://educame.tech' in first


def test_restore_checker_accepts_readable_saved_state_without_modifying_it():
    import sqlalchemy as sa
    import zlib
    from app.restore_check import verify_restore
    engine=sa.create_engine('sqlite://')
    with engine.begin() as connection:
        for table in ('users','licenses','client_states','documents','profesor_state_snapshots'):
            extra=',user_id TEXT' if table=='licenses' else ',data TEXT' if table=='client_states' else ',payload_zlib BLOB' if table=='profesor_state_snapshots' else ''
            connection.execute(sa.text('CREATE TABLE '+table+' (id TEXT'+extra+')'))
        connection.execute(sa.text('INSERT INTO client_states VALUES (:id,:data)'),{'id':'kept','data':'{"library":[{"id":"m1"}]}'})
        connection.execute(sa.text('INSERT INTO profesor_state_snapshots VALUES (:id,:payload)'),{'id':'copy','payload':zlib.compress(b'{"library":[]}' )})
        verify_restore(connection)
        assert connection.execute(sa.text('SELECT data FROM client_states')).scalar_one()=='{"library":[{"id":"m1"}]}'
