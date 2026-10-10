"""Short HTTP requests around a persisted, resumable generation job."""
import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import current_user, current_license
from app.database.session import get_db
from app.models import ProfesorGenerationJob, User, License
from app.services.licenses import check_access
from app.services.teacher_generator import generator_context, TYPES
from app.services.teacher_generation_contract import generation_units

router = APIRouter(tags=['profesor'])
logger = logging.getLogger(__name__)


def now():
    return datetime.now(timezone.utc)


def public_job(job):
    return {'request_id': job.request_id, 'status': job.status, 'completed': job.completed,
            'total': job.total, 'result': job.result if job.status == 'completed' else None,
            'error': job.error, 'error_status': job.error_status}


def stale(job):
    stamp = job.updated_at
    if stamp and stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return not stamp or stamp < now() - timedelta(minutes=10)


async def run_job(bind, job_id, lease):
    from app.api.app_routes import generate_teacher_material_impl
    started = now()
    with Session(bind=bind, expire_on_commit=False) as db:
        job = db.get(ProfesorGenerationJob, job_id)
        if not job or job.lease != lease:
            return
        user, license_obj = db.get(User, job.user_id), db.get(License, job.license_id)
        try:
            if not user or not user.is_active or not license_obj:
                raise HTTPException(403, 'El acceso ya no está disponible.')
            decision = check_access(db, user, 'PROFESOR_PARTICULAR', require_credits=False)
            if not decision.ok:
                raise HTTPException(403, decision.message)
            def progress(session, completed, total):
                session.refresh(job)
                if job.lease != lease:
                    raise HTTPException(409, 'La generación ya está siendo recuperada por otro intento.')
                job.completed, job.total, job.updated_at = completed, total, now()
            result = await generate_teacher_material_impl(job.payload, user, license_obj, db, progress)
            db.refresh(job)
            if job.lease != lease:
                return
            job.result, job.status, job.completed = result, 'completed', job.total
            job.error, job.error_status = '', 0
        except Exception as exc:
            db.rollback()
            job = db.get(ProfesorGenerationJob, job_id)
            if not job or job.lease != lease:
                return
            job.status = 'failed'
            job.error_status = exc.status_code if isinstance(exc, HTTPException) else 500
            job.error = str(exc.detail) if isinstance(exc, HTTPException) else 'La generación se interrumpió. Puedes recuperar el progreso guardado. Código de incidencia: ' + job.request_id[:8] + '.'
            logger.warning('teacher_generation_job_failed request=%s type=%s error=%s status=%s', job.request_id, next((k for k in TYPES if job.payload.get(k) == 1), 'unknown'), type(exc).__name__, job.error_status)
        job.finished_at = now()
        db.commit()
        logger.info('teacher_generation_job_finished request=%s status=%s completed=%s total=%s seconds=%.2f', job.request_id, job.status, job.completed, job.total, (now()-started).total_seconds())


@router.post('/api/profesor/generation/start')
def start_job(payload: dict, background_tasks: BackgroundTasks, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)):
    from app.api.app_routes import ensure_credit_balance
    if license_obj.product_code != 'PROFESOR_PARTICULAR':
        raise HTTPException(403, 'Esta función requiere acceso a Profesor Particular.')
    request_id, context = generator_context(payload)
    safe_payload = {**context, 'request_id': request_id}
    if 'regenerate' in payload:
        safe_payload.pop('regeneration', None)
        safe_payload['regenerate'] = payload['regenerate']
    # This brief lock also serializes final credit accounting; no account row
    # remains locked while waiting for the AI provider.
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    job = db.scalar(select(ProfesorGenerationJob).where(ProfesorGenerationJob.user_id == user.id, ProfesorGenerationJob.request_id == request_id))
    if job:
        if job.payload != safe_payload:
            raise HTTPException(409, 'Este intento ya se utilizó con otro contenido.')
        if job.status == 'completed' or job.status in ('running', 'queued') and not stale(job):
            return public_job(job)
    active = db.scalar(select(ProfesorGenerationJob).where(ProfesorGenerationJob.user_id == user.id, ProfesorGenerationJob.status.in_(('queued', 'running')), ProfesorGenerationJob.request_id != request_id))
    if active and not stale(active):
        raise HTTPException(409, 'Ya hay una generación en curso. Recupera ese intento antes de crear otro material.')
    ensure_credit_balance(db, user, license_obj, 1)
    if active:
        active.status, active.lease = 'failed', str(uuid4())
        active.error = 'El servidor se reinició. Puedes recuperar este material con sus datos originales.'
    if job is None:
        job = ProfesorGenerationJob(user_id=user.id, organization_id=user.organization_id, license_id=license_obj.id,
                                    request_id=request_id, payload=safe_payload, total=generation_units(context))
        db.add(job)
    job.status, job.lease, job.error, job.error_status, job.updated_at = 'running', str(uuid4()), '', 0, now()
    db.commit()
    background_tasks.add_task(run_job, db.get_bind(), job.id, job.lease)
    return public_job(job)


@router.get('/api/profesor/generation/{request_id}')
def get_job(request_id: UUID, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)):
    if license_obj.product_code != 'PROFESOR_PARTICULAR':
        raise HTTPException(403, 'Esta función requiere acceso a Profesor Particular.')
    job = db.scalar(select(ProfesorGenerationJob).where(ProfesorGenerationJob.user_id == user.id,
                    ProfesorGenerationJob.organization_id == user.organization_id, ProfesorGenerationJob.request_id == str(request_id)))
    if not job:
        raise HTTPException(404, 'No se encontró este intento de generación.')
    value = public_job(job)
    if job.status in ('queued', 'running') and stale(job):
        value.update(status='interrupted', error='El servidor se reinició. Pulsa Generar con IA para recuperar el progreso.')
    return value
