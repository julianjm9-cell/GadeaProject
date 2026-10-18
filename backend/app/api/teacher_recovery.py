"""Private, bounded recovery. Drafts never change the saved material automatically."""
import json
import zlib
from datetime import timedelta
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from app.auth.dependencies import current_user, current_license
from app.database.session import get_db
from app.models import User, License, ProfesorEditorDraft, ProfesorGenerationJob, ClientState
from app.models.core import utcnow

router = APIRouter(tags=["profesor-recovery"])
DRAFT_DAYS = 7
DRAFT_LIMIT = 5


def require_teacher(license_obj):
    if license_obj.product_code != "PROFESOR_PARTICULAR":
        raise HTTPException(403, "Requiere acceso a Profesor Particular.")


def own_draft(db, user, draft_id):
    row = db.scalar(select(ProfesorEditorDraft).where(ProfesorEditorDraft.id == draft_id, ProfesorEditorDraft.user_id == user.id,
        ProfesorEditorDraft.organization_id == user.organization_id, ProfesorEditorDraft.expires_at > utcnow()))
    if not row:
        raise HTTPException(404, "Este borrador no está disponible.")
    return row


@router.get("/api/profesor/editor-drafts")
def drafts(user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)):
    require_teacher(license_obj)
    db.execute(delete(ProfesorEditorDraft).where(ProfesorEditorDraft.expires_at < utcnow()))
    db.commit()
    rows = db.scalars(select(ProfesorEditorDraft).where(ProfesorEditorDraft.user_id == user.id, ProfesorEditorDraft.organization_id == user.organization_id)
        .order_by(ProfesorEditorDraft.updated_at.desc()).limit(DRAFT_LIMIT))
    return {"days": DRAFT_DAYS, "limit": DRAFT_LIMIT, "drafts":[{"id":str(row.id),"title":row.title,"updated_at":row.updated_at,"expires_at":row.expires_at} for row in rows]}


@router.post("/api/profesor/editor-drafts/{draft_id}")
def save_draft(draft_id: UUID, payload: dict, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)):
    require_teacher(license_obj)
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    material = payload.get("material")
    if not isinstance(material, dict) or not isinstance(material.get("activity"), dict) or not isinstance(payload.get("fields", []), list):
        raise HTTPException(422, "Borrador no válido.")
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    if len(raw) > 1_000_000:
        raise HTTPException(413, "Este borrador es demasiado grande. Guarda el material o descarga los cambios.")
    row = db.get(ProfesorEditorDraft, draft_id)
    if row and (row.user_id != user.id or row.organization_id != user.organization_id):
        raise HTTPException(404, "Borrador no encontrado.")
    if row is None:
        row = ProfesorEditorDraft(id=draft_id,user_id=user.id,organization_id=user.organization_id)
        db.add(row)
    row.title = str(payload.get("title") or material.get("title") or "Material sin título")[:180]
    row.payload_zlib = zlib.compress(raw)
    row.expires_at = utcnow() + timedelta(days=DRAFT_DAYS)
    row.updated_at = utcnow()
    db.flush()
    keep = select(ProfesorEditorDraft.id).where(ProfesorEditorDraft.user_id == user.id).order_by(ProfesorEditorDraft.updated_at.desc(), ProfesorEditorDraft.id.desc()).limit(DRAFT_LIMIT)
    db.execute(delete(ProfesorEditorDraft).where(ProfesorEditorDraft.user_id == user.id, ProfesorEditorDraft.id.not_in(keep)), execution_options={"synchronize_session":False})
    db.commit()
    return {"ok":True,"saved_at":row.updated_at,"expires_at":row.expires_at}


@router.get("/api/profesor/editor-drafts/{draft_id}")
def get_draft(draft_id: UUID, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)):
    require_teacher(license_obj)
    return {"draft":json.loads(zlib.decompress(own_draft(db,user,draft_id).payload_zlib))}


@router.post("/api/profesor/editor-drafts/{draft_id}/discard")
def discard_draft(draft_id: UUID, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)):
    require_teacher(license_obj)
    db.execute(delete(ProfesorEditorDraft).where(ProfesorEditorDraft.id == draft_id,ProfesorEditorDraft.user_id == user.id,ProfesorEditorDraft.organization_id == user.organization_id))
    db.commit()
    return {"ok":True}


@router.get("/api/profesor/generation-inbox")
def generation_inbox(user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)):
    require_teacher(license_obj)
    state=db.scalar(select(ClientState).where(ClientState.user_id==user.id,ClientState.organization_id==user.organization_id))
    library=((state.data or {}).get("__apps",{}).get("profesor_particular",{}).get("library",[])) if state else []
    incorporated={item.get('generationRequestId') for item in library if isinstance(item,dict)}
    rows = db.scalars(select(ProfesorGenerationJob).where(ProfesorGenerationJob.user_id==user.id,ProfesorGenerationJob.organization_id==user.organization_id,
        ProfesorGenerationJob.imported_at.is_(None),ProfesorGenerationJob.created_at>=utcnow()-timedelta(days=30))
        .order_by(ProfesorGenerationJob.created_at.desc()).limit(20))
    return {"jobs":[{"request_id":row.request_id,"status":row.status,"topic":str((row.payload or {}).get("topic") or "Material"),"at":row.created_at} for row in rows if row.request_id not in incorporated]}


@router.post("/api/profesor/generation/{request_id}/incorporated")
def incorporate_generation(request_id: UUID, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)):
    require_teacher(license_obj)
    job = db.scalar(select(ProfesorGenerationJob).where(ProfesorGenerationJob.user_id==user.id,ProfesorGenerationJob.organization_id==user.organization_id,ProfesorGenerationJob.request_id==str(request_id)))
    if not job:
        raise HTTPException(404,"Generación no encontrada.")
    row=db.scalar(select(ClientState).where(ClientState.user_id==user.id,ClientState.organization_id==user.organization_id))
    library=((row.data or {}).get("__apps",{}).get("profesor_particular",{}).get("library",[])) if row else []
    if not any(isinstance(material,dict) and material.get("generationRequestId")==str(request_id) for material in library):
        raise HTTPException(409,"Guarda primero el material en tu biblioteca.")
    job.imported_at=utcnow();db.commit()
    return {"ok":True}
