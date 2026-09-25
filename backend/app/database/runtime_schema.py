from __future__ import annotations

from sqlalchemy import text

from app.database.session import engine


def ensure_runtime_schema() -> None:
    statements = [
        "ALTER TABLE licenses ADD COLUMN IF NOT EXISTS user_id UUID",
        "CREATE INDEX IF NOT EXISTS ix_licenses_user_id ON licenses (user_id)",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_licenses_user_id_users') THEN ALTER TABLE licenses ADD CONSTRAINT fk_licenses_user_id_users FOREIGN KEY (user_id) REFERENCES users(id); END IF; END $$",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_picture VARCHAR(500)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS drive_refresh_token TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS drive_folder_id VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS drive_connected_at TIMESTAMP WITH TIME ZONE",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub)",
    ]
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
