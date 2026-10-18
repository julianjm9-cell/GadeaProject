"""Run with python -m app.services.ocr_worker (one bounded worker container)."""
import json
import subprocess
import sys
import threading
import time
from datetime import timedelta
from sqlalchemy import select
from app.database.session import SessionLocal
from app.models import User, UsageRecord
from app.models.core import utcnow
from app.models.ocr import OcrJob
from app.api.profesor_access import purge_expired_sessions
from app.services.licenses import check_access
from app.services.ocr_storage import job_dir, model_config


def run_one():
    with SessionLocal() as db:
        # Interrupted tasks are not replayed automatically: avoid duplicate AI charges.
        stale = db.scalars(select(OcrJob).where(OcrJob.status == "processing", OcrJob.updated_at < utcnow() - timedelta(minutes=20)).with_for_update(skip_locked=True)).all()
        for job in stale:
            job.status, job.error = "error", "Trabajo interrumpido. Puedes volver a subir el documento."
        db.commit()
        job = db.scalar(select(OcrJob).where(OcrJob.status == "queued").order_by(OcrJob.created_at).with_for_update(skip_locked=True).limit(1))
        if not job:
            return False
        user = db.get(User, job.user_id)
        try:
            if not user or not check_access(db, user, "OCR_FACTURAS", require_credits=False).ok:
                raise ValueError("Acceso revocado")
            config = model_config(db)
            if config["api_tipo"] != job.provider or config["modelo_externo"] != job.model:
                raise ValueError("Configuración modificada")
        except ValueError:
            job.status, job.error = "error", "Acceso o configuración no disponibles. Contacta con administración."
            db.commit()
            return True
        job.status = "processing"
        db.commit()
        job_id, folder, suffix = job.id, job_dir(job), job.suffix
    try:
        subprocess.run([sys.executable, "-m", "app.services.ocr_runner"],
            input=json.dumps({"folder": str(folder), "suffix": suffix, "config": config}),
            text=True, encoding="utf-8", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            timeout=900, check=True)
        result = json.loads((folder / "result.json").read_text(encoding="utf-8"))
        error = ""
    except (subprocess.SubprocessError, OSError, ValueError):
        result, error = {}, "No se pudo procesar. Revisa el documento o la configuración de IA antes de volver a enviarlo."
    with SessionLocal() as db:
        job = db.get(OcrJob, job_id)
        job.result, job.error, job.status = result, error, "error" if error else "done"
        usage = db.get(UsageRecord, job.usage_id)
        if usage and result:
            usage.input_tokens = result.get("usage", {}).get("input_tokens", 0)
            usage.output_tokens = result.get("usage", {}).get("output_tokens", 0)
        db.commit()
    return True


def run_session_cleanup_forever():
    while True:
        try:
            with SessionLocal() as db:
                purge_expired_sessions(db)
                from app.services.profesor_admin import prune_diagnostics
                prune_diagnostics(db)
                from app.models import ProfesorEditorDraft, AccountToken, AuthSession
                from sqlalchemy import delete
                db.execute(delete(ProfesorEditorDraft).where(ProfesorEditorDraft.expires_at < utcnow()))
                for model in (AccountToken, AuthSession):
                    db.execute(delete(model).where(model.expires_at < utcnow() - timedelta(days=1)))
                from app.models import ProviderCall
                db.execute(delete(ProviderCall).where(ProviderCall.created_at < utcnow() - timedelta(days=90)))
                db.commit()
        except Exception:
            print("Session cleanup: temporal database failure", flush=True)
        time.sleep(300)


def run_teacher_backups_forever():
    from app.services.profesor_state_history import next_midnight, run_daily_backups, trim_backup_history
    trimmed = False
    while True:
        try:
            from app.services.operation_health import heartbeat
            with SessionLocal() as db:
                heartbeat(db,'backups')
            if not trimmed:
                trim_backup_history(SessionLocal)
                trimmed = True
            count = run_daily_backups(SessionLocal)
            if count:
                print(f"Teacher daily backups: {count} accounts processed", flush=True)
            # Recompute in UTC so the Madrid clock changes still trigger at 00:00.
            time.sleep(min(300, max(1, (next_midnight() - utcnow()).total_seconds())))
        except Exception:
            print("Teacher daily backups: failure, retrying in 30 seconds", flush=True)
            time.sleep(30)


if __name__ == "__main__":
    threading.Thread(target=run_session_cleanup_forever, name="session-cleanup", daemon=True).start()
    threading.Thread(target=run_teacher_backups_forever, name="teacher-daily-backups", daemon=True).start()
    last_heartbeat=0
    while True:
        try:
            if time.monotonic()-last_heartbeat>60:
                from app.services.operation_health import heartbeat, signals
                with SessionLocal() as db:
                    heartbeat(db,'worker')
                    health=signals(db)
                    if health['alerts']:
                        print('Operational alerts: '+','.join(row['code'] for row in health['alerts']),flush=True)
                last_heartbeat=time.monotonic()
            if not run_one():
                time.sleep(3)
        except Exception:
            print("Background worker: temporal database failure", flush=True)
            time.sleep(10)
