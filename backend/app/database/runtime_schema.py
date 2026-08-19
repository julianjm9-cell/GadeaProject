from __future__ import annotations

from sqlalchemy import text

from app.database.session import engine


def ensure_runtime_schema() -> None:
    statements = [
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
