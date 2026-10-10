from __future__ import annotations

from sqlalchemy import text

from app.database.session import engine
from app.models import ProfesorStudentAccess, ProfesorMaterialSession, ProfesorAd, ProfesorAdReport, ProfesorGenerationJob


def ensure_runtime_schema() -> None:
    statements = [
        "ALTER TABLE licenses ADD COLUMN IF NOT EXISTS user_id UUID",
        "ALTER TABLE licenses ADD COLUMN IF NOT EXISTS access_role VARCHAR(20) NOT NULL DEFAULT 'user'",
        "CREATE INDEX IF NOT EXISTS ix_licenses_user_id ON licenses (user_id)",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_licenses_user_id_users') THEN ALTER TABLE licenses ADD CONSTRAINT fk_licenses_user_id_users FOREIGN KEY (user_id) REFERENCES users(id); END IF; END $$",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_picture VARCHAR(500)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS drive_refresh_token TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS drive_folder_id VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS drive_connected_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS meet_refresh_token TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS meet_connected_at TIMESTAMP WITH TIME ZONE",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub)",
    ]
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
        ProfesorStudentAccess.__table__.create(bind=conn, checkfirst=True)
        conn.execute(text("ALTER TABLE profesor_student_accesses ADD COLUMN IF NOT EXISTS password_encrypted TEXT"))
        ProfesorMaterialSession.__table__.create(bind=conn, checkfirst=True)
        ProfesorAd.__table__.create(bind=conn, checkfirst=True)
        ProfesorAdReport.__table__.create(bind=conn, checkfirst=True)
        ProfesorGenerationJob.__table__.create(bind=conn, checkfirst=True)
        conn.execute(text("ALTER TABLE profesor_ads ADD COLUMN IF NOT EXISTS governance JSON NOT NULL DEFAULT '{}'"))
        conn.execute(text("ALTER TABLE profesor_ad_reports ADD COLUMN IF NOT EXISTS details JSON NOT NULL DEFAULT '{}'"))
