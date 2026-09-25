from __future__ import annotations

import base64
import secrets
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from xml.etree import ElementTree as ET
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import httpx

from app.auth.dependencies import require_superadmin
from app.config import get_settings
from app.database.session import get_db
from app.models import AppSetting, AuditLog, License, Organization, UsageRecord, User
from app.schemas.core import LicenseCreate, LicenseOut, LicensePatch, OrganizationCreate, OrganizationOut, OrganizationPatch, UserAccessPatch, UserCreate, UserOut, UserPatch
from app.security.passwords import hash_password
from app.services.ai_config import (
    GROQ_CHAT_DEFAULT,
    GROQ_TRANSCRIBE_DEFAULT,
    normalize_chat_model,
    normalize_transcribe_model,
    valid_gemini_key,
    valid_groq_key,
    valid_openai_key,
)
from app.services.audit import audit
from app.services.licenses import license_for_user, license_is_current, usage_count_for_license
from app.services.resources import load_resource_catalog, save_resource_catalog


router = APIRouter(prefix="/admin", tags=["admin"])
AI_SETTING_KEYS = ("points_provider", "chat_provider", "transcribe_provider", "openai_api_key", "groq_api_key", "gemini_api_key", "points_model", "chat_model", "transcribe_model", "topic_style_guide")
DEFAULT_TOPIC_STYLE_GUIDE = """Treat the selected topic as a strict boundary. Build a coherent oral presentation from the few angles that directly answer that exact topic; never force a standard history, impact, controversy or future section when it is not relevant. Prefer specific explanations, mechanisms, examples and dates that help explain the subject. Every paragraph must earn its place: remove generic introductions, broad international-relations filler, moral conclusions and nearby subjects that were not requested. The student profile controls language and difficulty only; it is never source material. Use natural transitions and an informed C1/C2 tone. Include only facts you can state confidently and never invent dates, statistics, institutions or quotations."""
PRODUCT_CODES = ("UNIVERSIDAD_ADULTOS", "ESO_ADULTOS", "CAMBRIDGE", "DIPLOMATOR")


def get_or_404(db: Session, model, item_id: UUID):
    obj = db.get(model, item_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado.")
    return obj


def comparable_datetime(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def mask_secret(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:3]}...{value[-4:]}"


def get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.get(AppSetting, key)
    return (row.value if row else default).strip()


def setting_or_env(db: Session, key: str, env_value: str = "") -> str:
    return get_setting(db, key) or (env_value or "").strip()


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.get(AppSetting, key)
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))


def docx_paragraphs(raw: bytes) -> list[str]:
    try:
        with zipfile.ZipFile(BytesIO(raw)) as zf:
            xml = zf.read("word/document.xml")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="No se pudo leer el DOCX.") from exc
    root = ET.fromstring(xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs: list[str] = []
    for para in root.findall(".//w:p", ns):
        text = "".join(node.text or "" for node in para.findall(".//w:t", ns)).strip()
        if text:
            paragraphs.append(" ".join(text.split()))
    return paragraphs


def analyze_reference_docs(files: list[dict]) -> str:
    titles: list[str] = []
    headings: list[str] = []
    transitions: list[str] = []
    paragraph_counts: list[int] = []
    for item in files:
        encoded = str(item.get("content_base64") or "")
        if "," in encoded:
            encoded = encoded.split(",", 1)[1]
        try:
            raw = base64.b64decode(encoded)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Archivo DOCX invalido.") from exc
        paragraphs = docx_paragraphs(raw)
        if not paragraphs:
            continue
        titles.append(paragraphs[0][:120])
        paragraph_counts.append(len(paragraphs))
        for para in paragraphs[1:]:
            clean = para.strip()
            lower = clean.lower()
            is_heading = len(clean) <= 80 and (clean.isupper() or clean[:2].isdigit() or lower in {"history", "importance", "legacy", "evolution", "impact", "characteristics"})
            if is_heading:
                headings.append(clean)
            if any(token in lower for token in ("lead us", "leads us", "conduit", "aborder", "point suivant", "beyond", "au-delà", "as a final point")):
                transitions.append(clean)
    axes = ", ".join(dict.fromkeys(h.strip("0123456789. ") for h in headings if h.strip()))[:500]
    sample_topics = ", ".join(titles[:8])
    avg = round(sum(paragraph_counts) / len(paragraph_counts), 1) if paragraph_counts else 0
    transition_line = " Use explicit oral bridge sentences between sections."
    if transitions:
        transition_line = f" Use explicit oral bridge sentences similar in function to: {transitions[0][:180]}"
    axes_line = f" Common axes detected: {axes}." if axes else " Use clear axes such as history/evolution, importance/impact, challenges/controversies and legacy/future prospects."
    return (
        "Generate Diplomator topics as polished C1/C2 oral presentations, not isolated notes. "
        f"The analysed examples ({sample_topics}) average about {avg} paragraphs and usually open with a brief framing sentence before moving through 3 major axes."
        f"{axes_line} "
        "Each point should move from context to concrete facts and then to significance, with named actors, institutions, dates, places, reforms, controversies and consequences. "
        "Use elegant but recitable language: informed, diplomatic, structured and natural aloud. "
        "Avoid generic textbook introductions, vague moralising and lists of disconnected facts."
        f"{transition_line} "
        "For any new topic, imitate these structural habits, not the literal subject matter of the examples."
    )


@router.get("/organizations", response_model=list[OrganizationOut])
def list_organizations(_: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    return list(db.scalars(select(Organization).order_by(Organization.created_at.desc())))


@router.get("/ai-settings")
def get_ai_settings(_: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    settings = get_settings()
    configured_provider = get_setting(db, "ai_provider", settings.ai_provider)
    points_provider = get_setting(db, "points_provider", get_setting(db, "chat_provider", configured_provider))
    chat_provider = get_setting(db, "chat_provider", configured_provider)
    transcribe_provider = get_setting(db, "transcribe_provider", configured_provider)
    openai_key = setting_or_env(db, "openai_api_key", settings.openai_api_key)
    groq_key = setting_or_env(db, "groq_api_key", settings.groq_api_key)
    gemini_key = setting_or_env(db, "gemini_api_key", settings.gemini_api_key)
    points_model = normalize_chat_model(points_provider, get_setting(db, "points_model", get_setting(db, "chat_model", settings.chat_model)))
    chat_model = normalize_chat_model(chat_provider, get_setting(db, "chat_model", settings.chat_model))
    transcribe_model = normalize_transcribe_model(transcribe_provider, get_setting(db, "transcribe_model", settings.transcribe_model))
    configured = {
        "openai": valid_openai_key(openai_key),
        "groq": valid_groq_key(groq_key),
        "gemini": valid_gemini_key(gemini_key),
    }
    sources = {
        "openai": "panel" if get_setting(db, "openai_api_key", "") else ("servidor" if settings.openai_api_key else "sin clave"),
        "groq": "panel" if get_setting(db, "groq_api_key", "") else ("servidor" if settings.groq_api_key else "sin clave"),
        "gemini": "panel" if get_setting(db, "gemini_api_key", "") else ("servidor" if settings.gemini_api_key else "sin clave"),
    }
    if chat_provider == "gemini" and configured["gemini"]:
        ocr_provider, ocr_model = "gemini", chat_model
    elif chat_provider == "openai" and configured["openai"]:
        ocr_provider, ocr_model = "openai", chat_model
    elif configured["openai"]:
        ocr_provider, ocr_model = "openai", normalize_chat_model("openai", "")
    elif configured["gemini"]:
        ocr_provider, ocr_model = "gemini", normalize_chat_model("gemini", "")
    else:
        ocr_provider, ocr_model = chat_provider, normalize_chat_model(chat_provider, chat_model)
    capabilities = [
        {"id": "points", "label": "Apuntes Diplomator", "apps": ["DIPLOMATOR"], "provider": points_provider, "model": points_model, "configured": configured.get(points_provider, False), "key_source": sources.get(points_provider, "sin clave")},
        {"id": "chat", "label": "Chat y generación", "apps": list(PRODUCT_CODES), "provider": chat_provider, "model": chat_model, "configured": configured.get(chat_provider, False), "key_source": sources.get(chat_provider, "sin clave")},
        {"id": "ocr", "label": "Lectura de imágenes", "apps": list(PRODUCT_CODES), "provider": ocr_provider, "model": ocr_model, "configured": configured.get(ocr_provider, False), "key_source": sources.get(ocr_provider, "sin clave")},
        {"id": "transcribe", "label": "Transcripción de audio", "apps": list(PRODUCT_CODES), "provider": transcribe_provider, "model": transcribe_model, "configured": configured.get(transcribe_provider, False), "key_source": sources.get(transcribe_provider, "sin clave")},
    ]
    saved_topic_style = get_setting(db, "topic_style_guide", "")
    topic_style_guide = (
        DEFAULT_TOPIC_STYLE_GUIDE
        if not saved_topic_style or saved_topic_style.startswith("Model the structure on strong Diplomator reference topics")
        else saved_topic_style
    )
    return {
        "ok": True,
        "ai_provider": chat_provider,
        "points_provider": points_provider,
        "chat_provider": chat_provider,
        "transcribe_provider": transcribe_provider,
        "openai_configured": valid_openai_key(openai_key),
        "openai_masked": mask_secret(openai_key) if valid_openai_key(openai_key) else "",
        "groq_configured": valid_groq_key(groq_key),
        "groq_masked": mask_secret(groq_key) if valid_groq_key(groq_key) else "",
        "gemini_configured": valid_gemini_key(gemini_key),
        "gemini_masked": mask_secret(gemini_key) if valid_gemini_key(gemini_key) else "",
        "points_model": points_model,
        "chat_model": chat_model,
        "transcribe_model": transcribe_model,
        "capabilities": capabilities,
        "recommended_provider": "groq",
        "recommended_chat_model": GROQ_CHAT_DEFAULT,
        "recommended_transcribe_model": GROQ_TRANSCRIBE_DEFAULT,
        "topic_style_guide": topic_style_guide,
    }


@router.post("/ai-settings")
def save_ai_settings(payload: dict, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    points_provider = str(payload.get("points_provider") or payload.get("chat_provider") or payload.get("ai_provider") or "groq").strip().lower()
    chat_provider = str(payload.get("chat_provider") or payload.get("ai_provider") or "groq").strip().lower()
    transcribe_provider = str(payload.get("transcribe_provider") or chat_provider).strip().lower()
    if points_provider not in {"openai", "groq", "gemini"}:
        raise HTTPException(status_code=400, detail="Proveedor de puntos no valido.")
    if chat_provider not in {"openai", "groq", "gemini"}:
        raise HTTPException(status_code=400, detail="Proveedor de chat no valido.")
    if transcribe_provider not in {"openai", "groq"}:
        raise HTTPException(status_code=400, detail="La transcripcion ahora admite OpenAI o Groq.")
    set_setting(db, "ai_provider", chat_provider)
    set_setting(db, "points_provider", points_provider)
    set_setting(db, "chat_provider", chat_provider)
    set_setting(db, "transcribe_provider", transcribe_provider)
    points_model = normalize_chat_model(points_provider, str(payload.get("points_model") or "").strip())
    chat_model = str(payload.get("chat_model") or "").strip()
    transcribe_model = str(payload.get("transcribe_model") or "").strip()
    chat_model = normalize_chat_model(chat_provider, chat_model)
    transcribe_model = normalize_transcribe_model(transcribe_provider, transcribe_model)
    set_setting(db, "points_model", points_model[:120])
    set_setting(db, "chat_model", chat_model[:120])
    set_setting(db, "transcribe_model", transcribe_model[:120])
    topic_style_guide = str(payload.get("topic_style_guide") or "").strip()
    set_setting(db, "topic_style_guide", (topic_style_guide or DEFAULT_TOPIC_STYLE_GUIDE)[:6000])
    for key in ("openai_api_key", "groq_api_key", "gemini_api_key"):
        value = str(payload.get(key) or "").strip()
        if key == "openai_api_key" and value and value.startswith("gsk_"):
            raise HTTPException(status_code=400, detail="Esa parece una clave de Groq. Pegala en Groq API key y selecciona Groq.")
        if key == "groq_api_key" and value and value.startswith(("sk-", "sk-proj-")):
            raise HTTPException(status_code=400, detail="Esa parece una clave de OpenAI. Pegala en OpenAI API key y selecciona OpenAI.")
        if value:
            set_setting(db, key, value)
    audit(db, actor=actor, organization_id=actor.organization_id, action="ai_settings_updated", entity_type="app_settings", entity_id="ai", metadata={"points_provider": points_provider, "chat_provider": chat_provider, "transcribe_provider": transcribe_provider})
    db.commit()
    return get_ai_settings(actor, db)


@router.post("/ai-settings/test")
async def test_ai_settings(payload: dict, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    settings = get_settings()
    capability_id = str(payload.get("capability") or "chat").strip().lower()
    current = get_ai_settings(actor, db)
    capability = next((item for item in current["capabilities"] if item["id"] == capability_id), None)
    if not capability:
        raise HTTPException(status_code=400, detail="Funcion IA no valida.")
    provider = capability["provider"]
    model = capability["model"]
    if not capability["configured"]:
        raise HTTPException(status_code=400, detail=f"Falta una clave valida de {provider} para {capability['label']}.")
    if capability_id == "transcribe":
        return {"ok": True, "provider": provider, "model": model, "capability": capability_id, "message": "Configuracion de audio valida. La prueba completa se realiza al transcribir una grabacion."}
    if provider == "groq":
        api_key = setting_or_env(db, "groq_api_key", settings.groq_api_key)
        url = str(settings.groq_chat_url)
        if not valid_groq_key(api_key):
            raise HTTPException(status_code=400, detail="Pega una clave Groq valida que empiece por gsk_ y guarda la configuracion.")
    elif provider == "openai":
        api_key = setting_or_env(db, "openai_api_key", settings.openai_api_key)
        url = str(settings.openai_chat_url)
        if not valid_openai_key(api_key):
            raise HTTPException(status_code=400, detail="Pega una clave OpenAI valida y guarda la configuracion.")
    elif provider == "gemini":
        api_key = setting_or_env(db, "gemini_api_key", settings.gemini_api_key)
        url = str(settings.gemini_chat_url)
        if not valid_gemini_key(api_key):
            raise HTTPException(status_code=400, detail="Pega una clave Gemini valida y guarda la configuracion.")
    else:
        raise HTTPException(status_code=400, detail="Proveedor IA no valido.")
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "Responde solo: OK"}],
        "temperature": 0,
        "max_tokens": 8,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload)
    if response.status_code >= 400:
        detail = "La prueba IA fallo. Revisa la clave, el proveedor y el modelo."
        try:
            provider_detail = response.json().get("error", {}).get("message")
            if provider_detail:
                detail = f"{detail} Detalle: {provider_detail[:240]}"
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=detail)
    audit(db, actor=actor, organization_id=actor.organization_id, action="ai_settings_tested", entity_type="app_settings", entity_id="ai", metadata={"capability": capability_id, "provider": provider, "model": model})
    db.commit()
    return {"ok": True, "provider": provider, "model": model, "capability": capability_id, "message": f"{capability['label']}: conexion correcta."}


@router.post("/style-guide/analyze-docx")
def analyze_style_guide(payload: dict, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    files = payload.get("files")
    if not isinstance(files, list) or not files:
        raise HTTPException(status_code=400, detail="Sube al menos un DOCX.")
    guide = analyze_reference_docs(files[:12])[:6000]
    set_setting(db, "topic_style_guide", guide)
    audit(db, actor=actor, organization_id=actor.organization_id, action="topic_style_guide_analyzed", entity_type="app_settings", entity_id="topic_style_guide", metadata={"files": len(files)})
    db.commit()
    return {"ok": True, "topic_style_guide": guide}


@router.post("/organizations", response_model=OrganizationOut)
def create_organization(payload: OrganizationCreate, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    org = Organization(name=payload.name, status=payload.status)
    db.add(org)
    db.flush()
    audit(db, actor=actor, organization_id=org.id, action="organization_created", entity_type="organization", entity_id=str(org.id))
    db.commit()
    db.refresh(org)
    return org


@router.get("/organizations/{organization_id}", response_model=OrganizationOut)
def get_organization(organization_id: UUID, _: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    return get_or_404(db, Organization, organization_id)


@router.patch("/organizations/{organization_id}", response_model=OrganizationOut)
def patch_organization(organization_id: UUID, payload: OrganizationPatch, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    org = get_or_404(db, Organization, organization_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(org, key, value)
    audit(db, actor=actor, organization_id=org.id, action="organization_updated", entity_type="organization", entity_id=str(org.id), metadata=payload.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(org)
    return org


@router.get("/users", response_model=list[UserOut])
def list_users(_: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    return list(db.scalars(select(User).order_by(User.created_at.desc())))


def access_payload(db: Session, user: User, product_code: str) -> dict | None:
    license_obj = license_for_user(db, user, product_code)
    if not license_obj:
        return None
    used = usage_count_for_license(
        db,
        user.id,
        user.organization_id,
        license_obj.starts_at,
        license_obj.expires_at,
        product_code,
    )
    total = int(license_obj.usage_limit or 0)
    effective_status = "active" if (
        user.is_active
        and license_is_current(license_obj)
    ) else "inactive"
    return {
        "product_code": product_code,
        "license_id": str(license_obj.id),
        "scope": "personal" if license_obj.user_id else "shared",
        "status": license_obj.status,
        "effective_status": effective_status,
        "plan": license_obj.plan,
        "starts_at": license_obj.starts_at.isoformat(),
        "expires_at": license_obj.expires_at.isoformat(),
        "total_credits": total,
        "used_credits": used,
        "available_credits": None if total == 0 else max(total - used, 0),
        "unlimited": total == 0,
    }


@router.get("/accounts")
def list_accounts(_: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    rows = []
    users = list(db.scalars(select(User).order_by(User.created_at.desc())))
    for user in users:
        accesses = [item for code in PRODUCT_CODES if (item := access_payload(db, user, code))]
        rows.append({
            "id": str(user.id),
            "organization_id": str(user.organization_id),
            "organization_name": user.organization.name,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "accesses": accesses,
        })
    return {"ok": True, "accounts": rows}


@router.patch("/users/{user_id}/access/{product_code}")
def patch_user_access(user_id: UUID, product_code: str, payload: UserAccessPatch, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    user = get_or_404(db, User, user_id)
    product_code = product_code.strip().upper()
    if product_code not in PRODUCT_CODES:
        raise HTTPException(status_code=400, detail="Aplicacion no valida.")
    current = license_for_user(db, user, product_code)
    personal = db.scalar(
        select(License).where(
            License.user_id == user.id,
            License.product_code == product_code,
        ).order_by(License.created_at.desc(), License.expires_at.desc())
    )
    if personal:
        license_obj = personal
    elif current:
        license_obj = License(
            organization_id=user.organization_id,
            user_id=user.id,
            product_code=product_code,
            plan=current.plan,
            status=current.status,
            starts_at=current.starts_at,
            expires_at=current.expires_at,
            usage_limit=current.usage_limit,
            legacy_key=None,
        )
        db.add(license_obj)
        db.flush()
    else:
        raise HTTPException(status_code=404, detail="El usuario no tiene acceso a esta aplicacion.")
    license_obj.usage_limit = payload.usage_limit
    if payload.status is not None:
        if payload.status not in {"active", "suspended", "expired"}:
            raise HTTPException(status_code=400, detail="Estado de acceso no valido.")
        license_obj.status = payload.status
    if payload.starts_at is not None:
        license_obj.starts_at = payload.starts_at
    if payload.expires_at is not None:
        license_obj.expires_at = payload.expires_at
    if comparable_datetime(license_obj.starts_at) >= comparable_datetime(license_obj.expires_at):
        raise HTTPException(status_code=400, detail="La fecha de fin debe ser posterior a la de inicio.")
    audit(
        db,
        actor=actor,
        organization_id=user.organization_id,
        action="user_access_updated",
        entity_type="license",
        entity_id=str(license_obj.id),
        metadata={"user_id": str(user.id), "product_code": product_code, "usage_limit": payload.usage_limit, "status": license_obj.status},
    )
    db.commit()
    db.refresh(license_obj)
    return {"ok": True, "access": access_payload(db, user, product_code)}


@router.post("/users", response_model=UserOut)
def create_user(payload: UserCreate, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    if not db.get(Organization, payload.organization_id):
        raise HTTPException(status_code=404, detail="Organizacion no encontrada.")
    if db.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(status_code=409, detail="Email ya existe.")
    user = User(
        organization_id=payload.organization_id,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(user)
    db.flush()
    audit(db, actor=actor, organization_id=user.organization_id, action="user_created", entity_type="user", entity_id=str(user.id), metadata={"email": user.email, "role": user.role})
    db.commit()
    db.refresh(user)
    return user


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: UUID, _: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    return get_or_404(db, User, user_id)


@router.patch("/users/{user_id}", response_model=UserOut)
def patch_user(user_id: UUID, payload: UserPatch, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    user = get_or_404(db, User, user_id)
    updates = payload.model_dump(exclude_unset=True)
    if "email" in updates and updates["email"]:
        updates["email"] = updates["email"].lower()
    if "password" in updates and updates["password"]:
        user.password_hash = hash_password(updates.pop("password"))
    for key, value in updates.items():
        setattr(user, key, value)
    audit(db, actor=actor, organization_id=user.organization_id, action="user_updated", entity_type="user", entity_id=str(user.id), metadata={k: v for k, v in updates.items() if k != "password"})
    db.commit()
    db.refresh(user)
    return user


@router.get("/licenses", response_model=list[LicenseOut])
def list_licenses(_: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    return list(db.scalars(select(License).order_by(License.created_at.desc())))


@router.post("/licenses", response_model=LicenseOut)
def create_license(payload: LicenseCreate, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    if not db.get(Organization, payload.organization_id):
        raise HTTPException(status_code=404, detail="Organizacion no encontrada.")
    if payload.user_id:
        user = db.get(User, payload.user_id)
        if not user or user.organization_id != payload.organization_id:
            raise HTTPException(status_code=400, detail="El usuario no pertenece a la organizacion indicada.")
    if comparable_datetime(payload.starts_at) >= comparable_datetime(payload.expires_at):
        raise HTTPException(status_code=400, detail="La fecha de fin debe ser posterior a la de inicio.")
    data = payload.model_dump()
    if not data.get("legacy_key"):
        data["legacy_key"] = f"DIPLO-{secrets.token_urlsafe(12).upper()}"
    license_obj = License(**data)
    db.add(license_obj)
    db.flush()
    audit(db, actor=actor, organization_id=license_obj.organization_id, action="license_created", entity_type="license", entity_id=str(license_obj.id), metadata={"status": license_obj.status})
    db.commit()
    db.refresh(license_obj)
    return license_obj


@router.get("/licenses/{license_id}", response_model=LicenseOut)
def get_license(license_id: UUID, _: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    return get_or_404(db, License, license_id)


@router.patch("/licenses/{license_id}", response_model=LicenseOut)
def patch_license(license_id: UUID, payload: LicensePatch, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    license_obj = get_or_404(db, License, license_id)
    updates = payload.model_dump(exclude_unset=True)
    target_org_id = updates.get("organization_id", license_obj.organization_id)
    target_user_id = updates.get("user_id", license_obj.user_id)
    if target_user_id:
        user = db.get(User, target_user_id)
        if not user or user.organization_id != target_org_id:
            raise HTTPException(status_code=400, detail="El usuario no pertenece a la organizacion indicada.")
    starts_at = updates.get("starts_at", license_obj.starts_at)
    expires_at = updates.get("expires_at", license_obj.expires_at)
    if comparable_datetime(starts_at) >= comparable_datetime(expires_at):
        raise HTTPException(status_code=400, detail="La fecha de fin debe ser posterior a la de inicio.")
    for key, value in updates.items():
        setattr(license_obj, key, value)
    audit(db, actor=actor, organization_id=license_obj.organization_id, action="license_updated", entity_type="license", entity_id=str(license_obj.id), metadata=updates)
    db.commit()
    db.refresh(license_obj)
    return license_obj


@router.get("/usage")
def list_usage(_: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    records = db.scalars(select(UsageRecord).order_by(UsageRecord.created_at.desc()).limit(500))
    return {
        "ok": True,
        "usage": [
            {
                "id": str(r.id),
                "organization_id": str(r.organization_id),
                "user_id": str(r.user_id),
                "product_code": r.product_code,
                "model": r.model,
                "input_tokens": r.input_tokens,
                "output_tokens": r.output_tokens,
                "estimated_cost": float(r.estimated_cost),
                "created_at": r.created_at.isoformat(),
            }
            for r in records
        ],
    }


@router.get("/audit-logs")
def list_audit_logs(_: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    logs = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(500))
    return {
        "ok": True,
        "audit_logs": [
            {
                "id": str(log.id),
                "actor_user_id": str(log.actor_user_id) if log.actor_user_id else None,
                "organization_id": str(log.organization_id) if log.organization_id else None,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "metadata": log.log_metadata,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
    }


@router.get("/resources")
def get_resources(_: User = Depends(require_superadmin)):
    return {"ok": True, "catalog": load_resource_catalog()}


@router.put("/resources")
def update_resources(payload: dict, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    catalog = save_resource_catalog(payload.get("catalog") or payload)
    audit(db, actor=actor, organization_id=actor.organization_id, action="resources_updated", entity_type="content", entity_id="official_resources", metadata={"apps": list(catalog.keys())})
    db.commit()
    return {"ok": True, "catalog": catalog}
