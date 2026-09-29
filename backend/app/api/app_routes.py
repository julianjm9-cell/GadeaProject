from __future__ import annotations
from app.services.ai_config import app_ai_override

import base64
import hashlib
import hmac
import json
import os
import re
import time
from decimal import Decimal
from pathlib import Path
from urllib.parse import parse_qs
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import current_license, current_user
from app.api.auth import rate_limit_key
from app.config import get_settings
from app.database.session import get_db
from app.models import AppSetting, ClientState, Conversation, Document, License, Message, UsageRecord, User
from app.security.tokens import decode_token
from app.security.passwords import verify_password
from app.services.ai_config import (
    GROQ_TRANSCRIBE_DEFAULT,
    default_chat_model,
    normalize_chat_model,
    normalize_transcribe_model,
)
from app.services.audit import audit
from app.services.licenses import check_access, check_legacy_license, usage_count_for_license
from app.services.gamification import award_event, equip_item, get_or_create_profile, level_for_xp, profile_payload, public_config, purchase_item
from app.services.resources import load_resource_catalog


router = APIRouter(tags=["diplomator"])
STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOCAL_DOCUMENT_DIR = Path(os.getenv("DOCUMENT_EXPORT_DIR") or ("/app/data/documents" if Path("/app").exists() else PROJECT_ROOT / "backend" / "data" / "documents"))
PRODUCTS = {
    "profesor_particular": {
        "code": "PROFESOR_PARTICULAR",
        "name": "Profesor Particular",
        "path": "/profesor-particular",
        "description": "Tu agenda, tus alumnos y cada clase en un mismo escritorio.",
    },
    "diplomator": {
        "code": "DIPLOMATOR",
        "name": "Diplomator",
        "path": "/app",
        "description": "Temas claros y practica oral guiada.",
    },
    "cambridge": {
        "code": "CAMBRIDGE",
        "name": "Cambridge Trainer",
        "path": "/cambridge",
        "description": "Speaking y writing con estructura de examen.",
    },
    "universidad_adultos": {
        "code": "UNIVERSIDAD_ADULTOS",
        "name": "ACCESO UNIVERSIDAD +25",
        "path": "/universidad-adultos",
        "description": "Sesiones cortas y simulacros tipo prueba.",
    },
    "eso_adultos": {
        "code": "ESO_ADULTOS",
        "name": "ACCESO ESO ADULTOS",
        "path": "/eso-adultos",
        "description": "Bloques simples, mini tests y progreso.",
    },
}
APP_ALIASES = {
    "profesor_particular": "profesor_particular",
    "profesor-particular": "profesor_particular",
    "diplomator": "diplomator",
    "gadea": "diplomator",
    "cambridge": "cambridge",
    "cambridgetrainer": "cambridge",
    "cambridge-trainer": "cambridge",
    "universidad_adultos": "universidad_adultos",
    "universidad-adultos": "universidad_adultos",
    "acceso-universidad-adultos": "universidad_adultos",
    "acceso_universidad_adultos": "universidad_adultos",
    "adult_uni": "universidad_adultos",
    "eso_adultos": "eso_adultos",
    "eso-adultos": "eso_adultos",
    "adult_eso": "eso_adultos",
}


def static_html(filename: str, fallback: Path) -> FileResponse:
    path = STATIC_DIR / filename
    return FileResponse(
        fallback if fallback.exists() else path,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


def marketing_file(filename: str, media_type: str | None = None) -> FileResponse:
    static_path = STATIC_DIR / "marketing" / filename
    fallback = PROJECT_ROOT / "marketing" / "app_landings_demo" / filename
    path = static_path if static_path.exists() else fallback
    return FileResponse(
        path,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=300",
        },
    )


def page_user_or_redirect(request: Request, db: Session, next_path: str) -> User | RedirectResponse:
    token = request.cookies.get("diplomator_access") or ""
    auth_header = request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return RedirectResponse(f"/login?next={next_path}")
    try:
        user_id = decode_token(token, "access")
    except ValueError:
        return RedirectResponse(f"/login?next={next_path}")
    user = db.get(User, user_id)
    if not user:
        return RedirectResponse(f"/login?next={next_path}")
    return user


def request_app_key(request: Request) -> str:
    raw = str(request.headers.get("x-client-app") or request.query_params.get("app") or "diplomator").strip().lower()
    return APP_ALIASES.get(raw, "diplomator")


def app_state_data(row: ClientState, app_key: str) -> dict:
    data = row.data or {}
    if app_key == "diplomator":
        return data.get("__apps", {}).get("diplomator", data) if isinstance(data, dict) else {}
    return data.get("__apps", {}).get(app_key, {}) if isinstance(data, dict) else {}


def set_app_state_data(row: ClientState, app_key: str, payload: dict) -> None:
    current = row.data or {}
    if app_key == "diplomator" and "__apps" not in current:
        row.data = payload
        return
    apps = dict(current.get("__apps", {})) if isinstance(current, dict) else {}
    if "diplomator" not in apps and isinstance(current, dict) and current and "__apps" not in current:
        apps["diplomator"] = current
    apps[app_key] = payload
    row.data = {"__apps": apps}


def setting_value(db: Session, key: str) -> str:
    row = db.get(AppSetting, key)
    return (row.value if row else "").strip()


def chat_provider_config(db: Session, setting_key: str = "chat_provider", product: str = "") -> tuple[str, str, str]:
    settings = get_settings()
    provider = (app_ai_override(db, product, "points" if setting_key == "points_provider" else "chat").get("provider") or setting_value(db, setting_key) or setting_value(db, "chat_provider") or setting_value(db, "ai_provider") or settings.ai_provider).lower()
    openai_api_key = setting_value(db, "openai_api_key") or settings.openai_api_key
    groq_api_key = setting_value(db, "groq_api_key") or settings.groq_api_key
    gemini_api_key = setting_value(db, "gemini_api_key") or settings.gemini_api_key
    if provider == "groq":
        if not groq_api_key:
            raise HTTPException(status_code=500, detail="Falta GROQ_API_KEY.")
        if groq_api_key.startswith(("sk-", "sk-proj-")):
            raise HTTPException(status_code=500, detail="La clave guardada en Groq parece de OpenAI. Revisa Admin > IA.")
        return groq_api_key, str(settings.groq_chat_url), provider
    if provider == "gemini":
        if not gemini_api_key:
            raise HTTPException(status_code=500, detail="Falta GEMINI_API_KEY.")
        return gemini_api_key, str(settings.gemini_chat_url), provider
    if not openai_api_key:
        raise HTTPException(status_code=500, detail="Falta OPENAI_API_KEY.")
    if openai_api_key.startswith("gsk_"):
        raise HTTPException(status_code=500, detail="La clave guardada en OpenAI parece de Groq. Revisa Admin > IA.")
    return openai_api_key, str(settings.openai_chat_url), "openai"


def transcribe_provider_config(db: Session, product: str = "") -> tuple[str, str, str]:
    settings = get_settings()
    provider = (app_ai_override(db, product, "transcribe").get("provider") or setting_value(db, "transcribe_provider") or setting_value(db, "ai_provider") or settings.ai_provider).lower()
    if provider == "groq":
        api_key = setting_value(db, "groq_api_key") or settings.groq_api_key
        if not api_key:
            raise HTTPException(status_code=500, detail="Falta GROQ_API_KEY.")
        if api_key.startswith(("sk-", "sk-proj-")):
            raise HTTPException(status_code=500, detail="La clave guardada en Groq parece de OpenAI. Revisa Admin > IA.")
        return api_key, str(settings.groq_transcribe_url), provider
    api_key = setting_value(db, "openai_api_key") or settings.openai_api_key
    if not api_key:
        raise HTTPException(status_code=500, detail="Falta OPENAI_API_KEY.")
    if api_key.startswith("gsk_"):
        raise HTTPException(status_code=500, detail="La clave guardada en OpenAI parece de Groq. Revisa Admin > IA.")
    return api_key, str(settings.openai_transcribe_url), "openai"


def chat_model_for_purpose(db: Session, provider: str, purpose: str, product: str = "") -> str:
    override = app_ai_override(db, product, "points" if purpose == "points" else "chat")
    if override:
        return override["model"]
    if purpose == "points":
        return normalize_chat_model(provider, setting_value(db, "points_model") or setting_value(db, "chat_model") or default_chat_model(provider))
    return normalize_chat_model(provider, setting_value(db, "chat_model") or default_chat_model(provider))


def vision_provider_config(db: Session, product: str = "") -> tuple[str, str, str, str]:
    settings = get_settings()
    openai_api_key = setting_value(db, "openai_api_key") or settings.openai_api_key
    gemini_api_key = setting_value(db, "gemini_api_key") or settings.gemini_api_key
    override = app_ai_override(db, product, "ocr")
    if override:
        provider = override["provider"]
        key = openai_api_key if provider == "openai" else gemini_api_key
        if not key:
            raise HTTPException(status_code=500, detail=f"Falta la clave de {provider} configurada para imágenes.")
        return key, str(settings.openai_chat_url if provider == "openai" else settings.gemini_chat_url), provider, override["model"]
    preferred = (setting_value(db, "chat_provider") or setting_value(db, "ai_provider") or settings.ai_provider).lower()

    if preferred == "gemini" and gemini_api_key:
        return gemini_api_key, str(settings.gemini_chat_url), "gemini", setting_value(db, "chat_model") or "gemini-2.5-flash"
    if preferred == "openai" and openai_api_key:
        return openai_api_key, str(settings.openai_chat_url), "openai", setting_value(db, "chat_model") or "gpt-4o-mini"
    if openai_api_key:
        return openai_api_key, str(settings.openai_chat_url), "openai", "gpt-4o-mini"
    if gemini_api_key:
        return gemini_api_key, str(settings.gemini_chat_url), "gemini", "gemini-2.5-flash"
    raise HTTPException(status_code=500, detail="OCR necesita OpenAI o Gemini configurado en Admin > IA.")


def image_data_url_from_payload(payload: dict) -> tuple[str, str]:
    image = str(payload.get("image") or "").strip()
    mime_type = str(payload.get("mime_type") or payload.get("contentType") or "image/png").strip().lower()
    allowed = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
    if not image:
        raise HTTPException(status_code=400, detail="Falta la imagen.")
    if image.startswith("data:"):
        header, _, body = image.partition(",")
        if not body:
            raise HTTPException(status_code=400, detail="Imagen no valida.")
        mime_type = header[5:].split(";", 1)[0].lower() or mime_type
        image_b64 = body
    else:
        image_b64 = image
    if mime_type == "image/jpg":
        mime_type = "image/jpeg"
    if mime_type not in allowed:
        raise HTTPException(status_code=400, detail="Formato de imagen no soportado. Usa PNG, JPG o WEBP.")
    try:
        raw = base64.b64decode(image_b64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Imagen no valida.") from exc
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Imagen demasiado grande. Maximo 8 MB.")
    return f"data:{mime_type};base64,{image_b64}", mime_type


def state_row(db: Session, user: User) -> ClientState:
    row = db.scalar(select(ClientState).where(ClientState.organization_id == user.organization_id, ClientState.user_id == user.id))
    if row:
        return row
    row = ClientState(organization_id=user.organization_id, user_id=user.id, data={})
    db.add(row)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        row = db.scalar(select(ClientState).where(ClientState.organization_id == user.organization_id, ClientState.user_id == user.id))
        if row:
            return row
        raise
    return row


def token_usage(data: dict) -> tuple[int, int]:
    usage = data.get("usage") or {}
    return int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0), int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)


def product_code_for_app(app_key: str) -> str:
    return PRODUCTS.get(app_key, PRODUCTS["diplomator"])["code"]


@router.get("/api/resources")
def public_resources(app: str = "") -> dict:
    raw = str(app or "").strip().lower()
    app_key = APP_ALIASES.get(raw, raw)
    catalog = load_resource_catalog()
    return {"ok": True, "app": app_key, "resources": catalog.get(app_key, [])}


@router.post("/api/frontend-error")
def frontend_error(payload: dict, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    app_key = request_app_key(request)
    metadata = {
        "app": app_key,
        "product_code": product_code_for_app(app_key),
        "message": str(payload.get("message") or "")[:500],
        "source": str(payload.get("source") or "")[:300],
        "line": str(payload.get("line") or "")[:30],
        "column": str(payload.get("column") or "")[:30],
        "path": str(payload.get("path") or "")[:300],
    }
    audit(db, actor=user, organization_id=user.organization_id, action="frontend_error", entity_type="frontend", entity_id=app_key, metadata=metadata)
    db.commit()
    return {"ok": True}


def requested_credit_cost_from_payload(payload: dict, purpose: str) -> int:
    if purpose != "points":
        payload.pop("credit_cost", None)
        payload.pop("requested_points", None)
        return 1
    raw = payload.pop("requested_points", payload.pop("credit_cost", 1))
    try:
        cost = int(raw)
    except (TypeError, ValueError):
        cost = 1
    return max(1, min(cost, 50))


def points_credit_cost_from_content(content: str, fallback: int) -> int:
    try:
        body = json.loads(content)
    except (TypeError, ValueError, json.JSONDecodeError):
        return fallback
    points = body.get("points") if isinstance(body, dict) else None
    if isinstance(points, list) and points:
        return max(1, min(len(points), 50))
    return fallback


def ensure_credit_balance(db: Session, user: User, license_obj: License, credit_cost: int) -> None:
    if not license_obj.usage_limit:
        return
    # Serialize paid AI requests from the same account until usage is committed.
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    used = active_usage_count(db, user, license_obj)
    if used + credit_cost > license_obj.usage_limit:
        remaining = max(license_obj.usage_limit - used, 0)
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Creditos insuficientes. Te quedan {remaining} y esta generacion necesita {credit_cost}.",
        )


def record_usage(db: Session, user: User, model: str, input_tokens: int, output_tokens: int, product_code: str = "DIPLOMATOR", credit_cost: int = 1) -> None:
    for index in range(max(1, credit_cost)):
        db.add(
            UsageRecord(
                organization_id=user.organization_id,
                user_id=user.id,
                product_code=product_code,
                model=model,
                input_tokens=input_tokens if index == 0 else 0,
                output_tokens=output_tokens if index == 0 else 0,
                estimated_cost=Decimal("0"),
            )
        )


def provider_error(prefix: str, response: httpx.Response) -> HTTPException:
    if response.status_code in {401, 403}:
        detail = f"{prefix}: clave API no valida o proveedor mal seleccionado. Revisa Admin > IA."
    else:
        detail = f"{prefix} ({response.status_code}). Revisa Admin > IA."
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)


DEFAULT_TOPIC_STYLE_GUIDE = """Treat the selected topic as a strict boundary. Build a coherent oral presentation from the few angles that directly answer that exact topic; never force a standard history, impact, controversy or future section when it is not relevant. Prefer specific explanations, mechanisms, examples and dates that help explain the subject. Every paragraph must earn its place: remove generic introductions, broad international-relations filler, moral conclusions and nearby subjects that were not requested. The student profile controls language and difficulty only; it is never source material. Use natural transitions and an informed C1/C2 tone. Include only facts you can state confidently and never invent dates, statistics, institutions or quotations."""

POINTS_FOCUS_SYSTEM_PROMPT = """You create study notes for Diplomator. The user's quoted topic is the complete scope of the answer. Stay tightly on that topic and ignore nearby themes unless they are essential to explain it. The requested number of points is a layout requirement, not permission to add filler. Choose only topic-specific angles, make each point distinct, and remove any sentence that could be pasted unchanged into an unrelated topic. A style guide is subordinate to relevance. Do not invent facts. Return only the requested JSON."""


def add_points_focus_instruction(payload: dict) -> None:
    messages = payload.get("messages")
    if not isinstance(messages, list):
        return
    payload["messages"] = [{"role": "system", "content": POINTS_FOCUS_SYSTEM_PROMPT}, *messages]


def public_limits(db: Session | None = None) -> dict:
    settings = get_settings()
    limits = {
        "max_output_tokens": settings.max_output_tokens,
        "max_vocab": settings.max_vocab,
        "profile_chars": settings.profile_chars,
    }
    if db is not None:
        saved_guide = setting_value(db, "topic_style_guide")
        limits["topic_style_guide"] = (
            DEFAULT_TOPIC_STYLE_GUIDE
            if not saved_guide or saved_guide.startswith("Model the structure on strong Diplomator reference topics")
            else saved_guide
        )
    return limits


def active_usage_count(db: Session, user: User, license_obj: License) -> int:
    return usage_count_for_license(
        db,
        user.id,
        user.organization_id,
        license_obj.starts_at,
        license_obj.expires_at,
        license_obj.product_code,
    )


def public_app_user(db: Session, user: User, license_obj: License) -> dict:
    used_credits = active_usage_count(db, user, license_obj)
    total_credits = int(license_obj.usage_limit or 0)
    return {
        "id": str(user.id),
        "organization_id": str(user.organization_id),
        "license_key": license_obj.legacy_key or str(license_obj.id),
        "username": user.email,
        "has_password": True,
        "name": user.full_name or user.email,
        "email": user.email,
        "phone": "",
        "status": license_obj.status,
        "plan": license_obj.plan,
        "notes": "",
        "expires_at": license_obj.expires_at.isoformat(),
        "monthly_quota": total_credits,
        "usage_month": used_credits,
        "total_credits": total_credits,
        "used_credits": used_credits,
        "available_credits": None if total_credits == 0 else max(total_credits - used_credits, 0),
        "unlimited_credits": total_credits == 0,
        "google_connected": bool(user.google_sub),
        "drive_connected": bool(user.drive_refresh_token),
        "drive_folder_id": user.drive_folder_id or "",
        "created_at": user.created_at.isoformat(),
        "updated_at": user.updated_at.isoformat(),
        "last_used_at": "",
    }


def safe_document_name(value: str, default: str = "documento.doc") -> str:
    clean = re.sub(r"[<>:\"/\\|?*\x00-\x1F]+", "_", value or "").strip(" ._")
    return (clean or default)[:180]


def extract_drive_folder_id(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    patterns = [
        r"/folders/([A-Za-z0-9_-]+)",
        r"[?&]id=([A-Za-z0-9_-]+)",
        r"^([A-Za-z0-9_-]{10,})$",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw)
        if match:
            return match.group(1)
    return raw[:255]


def safe_drive_path(parts: object) -> list[str]:
    if not isinstance(parts, list):
        return []
    cleaned: list[str] = []
    for part in parts[:6]:
        text = safe_document_name(str(part), "Carpeta")
        if text:
            cleaned.append(text[:80])
    return cleaned


@router.get("/health")
def health() -> dict:
    return {"ok": True, "app": "Apps Suite"}


@router.get("/")
@router.get("/index.html")
def root():
    return marketing_file("index.html", "text/html")


@router.get("/suite")
def suite_public_page():
    return marketing_file("index.html", "text/html")


HAZLOTU_PASSWORD_KEY = "hazlotu_access_password_hash"
HAZLOTU_COOKIE = "hazlotu_access"
HAZLOTU_ACCESS_SECONDS = 60 * 60 * 12


def hazlotu_access_token(password_hash: str, issued: int) -> str:
    fingerprint = hashlib.sha256(password_hash.encode()).hexdigest()[:16]
    payload = f"{issued}.{fingerprint}"
    signature = hmac.new(get_settings().jwt_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def hazlotu_access_valid(token: str, password_hash: str) -> bool:
    try:
        issued_text, fingerprint, signature = token.split(".")
        issued = int(issued_text)
    except (ValueError, TypeError):
        return False
    if issued > time.time() or time.time() - issued > HAZLOTU_ACCESS_SECONDS:
        return False
    expected = hazlotu_access_token(password_hash, issued)
    return hmac.compare_digest(token, expected)


def hazlotu_gate(error: bool = False, configured: bool = True) -> HTMLResponse:
    message = '<p class="error" role="alert">Contraseña incorrecta. Inténtalo de nuevo.</p>' if error else ""
    form = ('<form action="/hazlo-tu/unlock" method="post"><label for="password">Contraseña de acceso</label>'
            '<input id="password" name="password" type="password" autocomplete="current-password" required autofocus>'
            '<button type="submit">Entrar <span aria-hidden="true">→</span></button></form>') if configured else '<p class="pending">El acceso aún no está configurado. La contraseña se establece desde el panel de administración.</p>'
    html = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Acceso privado · HazloTú</title><link rel="icon" href="/assets/brand/hazlotu-logo.png"><style>*{{box-sizing:border-box}}body{{min-height:100dvh;margin:0;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 85% 10%,#cce9ff,transparent 35%),linear-gradient(135deg,#f7fbff,#eaf3ff);font-family:Inter,system-ui,sans-serif;color:#0b255d}}.card{{width:min(430px,100%);padding:36px;border:1px solid #d7e6fa;border-radius:26px;background:#fff;box-shadow:0 24px 70px #174a8b1c}}img{{width:68px;height:68px;object-fit:contain}}h1{{font-size:32px;letter-spacing:-.04em;margin:14px 0 6px}}p{{color:#637a9c;line-height:1.5;margin:0 0 25px}}label{{display:block;font-size:13px;font-weight:700;margin-bottom:8px}}input{{width:100%;height:48px;padding:12px 14px;border:1px solid #bfd4f0;border-radius:12px;font:inherit}}input:focus{{outline:3px solid #b9d8ff}}button{{width:100%;height:48px;margin-top:16px;border:0;border-radius:12px;background:#086bf3;color:#fff;font:inherit;font-weight:700;cursor:pointer}}.error{{color:#b52d47;margin:0 0 14px}}.pending{{margin:0 0 16px}}a{{display:inline-block;margin-top:22px;color:#3265aa;text-decoration:none;font-size:13px}}</style></head><body><main class="card"><img src="/assets/brand/hazlotu-logo.png" alt=""><h1>HazloTú</h1><p>Este proyecto es privado por ahora. Introduce la contraseña para verlo.</p>{message}{form}<a href="/">← Volver a las aplicaciones</a></main></body></html>'''
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


@router.get("/hazlatu")
@router.get("/hazlo-tu")
@router.get("/hazlatu.html")
def hazlatu_public_page(request: Request, db: Session = Depends(get_db)):
    if request.url.path != "/hazlo-tu":
        return RedirectResponse("/hazlo-tu", status_code=308)
    password_hash = setting_value(db, HAZLOTU_PASSWORD_KEY)
    if not password_hash or not hazlotu_access_valid(request.cookies.get(HAZLOTU_COOKIE, ""), password_hash):
        return hazlotu_gate(request.query_params.get("error") == "1", bool(password_hash))
    response = marketing_file("hazlatu.html", "text/html")
    response.headers["Cache-Control"] = "private, no-store"
    return response


@router.post("/hazlo-tu/unlock")
async def hazlotu_unlock(request: Request, db: Session = Depends(get_db)):
    rate_limit_key(f"hazlotu:{request.client.host if request.client else 'unknown'}", limit=15)
    body = await request.body()
    if len(body) > 4096:
        raise HTTPException(status_code=413, detail="Solicitud demasiado grande.")
    password = parse_qs(body.decode("utf-8", errors="replace")).get("password", [""])[0]
    password_hash = setting_value(db, HAZLOTU_PASSWORD_KEY)
    if not password_hash or not verify_password(password, password_hash):
        return RedirectResponse("/hazlo-tu?error=1", status_code=303, headers={"Cache-Control": "no-store"})
    response = RedirectResponse("/hazlo-tu", status_code=303, headers={"Cache-Control": "no-store"})
    response.set_cookie(HAZLOTU_COOKIE, hazlotu_access_token(password_hash, int(time.time())), max_age=HAZLOTU_ACCESS_SECONDS, secure=get_settings().cookie_secure, httponly=True, samesite="lax", path="/hazlo-tu")
    return response


@router.get("/marketing-assets/demo-shared.css")
@router.get("/demo-shared.css")
def marketing_css():
    return marketing_file("demo-shared.css", "text/css")


@router.get("/marketing-assets/demo-shared.js")
@router.get("/demo-shared.js")
def marketing_js():
    return marketing_file("demo-shared.js", "application/javascript")


@router.get("/marketing-assets/{filename}")
def marketing_asset(filename: str):
    allowed = {
        "flujo-pantallas-suite.png": "image/png",
        "roadmap-suite-terraza.png": "image/png",
        "roadmap-suite-terraza-3-fases.png": "image/png",
        "simple-flow.svg": "image/svg+xml",
    }
    if filename not in allowed:
        raise HTTPException(status_code=404, detail="Asset no encontrado.")
    return marketing_file(filename, allowed[filename])


@router.get("/assets/landing/{filename}")
def eso_landing_asset(filename: str):
    if filename not in {"eso-study-desk.png", "profesor-dashboard.png", "eso-dashboard.png", "eso-mobile.png", "profesor-mobile.png", "diplomator-dashboard.png", "diplomator-mobile.png"}:
        raise HTTPException(status_code=404, detail="Asset no encontrado.")
    return marketing_file(f"assets/landing/{filename}", "image/png")


@router.get("/assets/brand/{filename}")
def brand_asset(filename: str):
    allowed = {
        "u25-simple.png",
        "u25-full.png",
        "eso-simple.png",
        "profesor-simple-v2.png",
        "profesor-full-v2.png",
        "eso-simple-v2.png",
        "eso-full-v2.png",
        "eso-full.png",
        "ingles-simple.png",
        "ingles-full.png",
        "diplomator-simple.png",
        "diplomator-simple-v2.png",
        "diplomator-full-v2.png",
        "diplomator-white-v2.png",
        "diplomator-full.png",
        "hazlotu-logo.png",
        "teacher-ai.png",
    }
    if filename not in allowed:
        raise HTTPException(status_code=404, detail="Asset no encontrado.")
    candidates = (
        STATIC_DIR / "assets" / "brand" / filename,
        STATIC_DIR / "marketing" / "assets" / "brand" / filename,
        PROJECT_ROOT / "marketing" / "app_landings_demo" / "assets" / "brand" / filename,
    )
    path = next((candidate for candidate in candidates if candidate.exists()), candidates[-1])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Asset no encontrado.")
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


@router.get("/assets/desk/{filename}")
def eso_desk_asset(filename: str):
    allowed = {
        "room.svg", "items.svg", "room-warm.png",
        "desk-light.png", "chair-blue.png", "lamp-blue.png", "plant-small.png",
        "desk-oak.png", "chair-comfort.png", "lamp-warm.png", "plant-monstera.png",
        "shelf-wood.png", "poster-focus.png", "poster-steps.png", "mug-steps.png",
        "plant-olive.png", "trophy-first.png",
    }
    if filename not in allowed:
        raise HTTPException(status_code=404, detail="Asset no encontrado.")
    static_path = STATIC_DIR / "assets" / "desk" / filename
    fallback = PROJECT_ROOT / "apps" / "e25" / "assets" / "desk" / filename
    path = static_path if static_path.exists() else fallback
    if not path.exists():
        raise HTTPException(status_code=404, detail="Asset no encontrado.")
    media_type = "image/png" if filename.endswith(".png") else "image/svg+xml"
    return FileResponse(path, media_type=media_type, headers={"Cache-Control": "public, max-age=86400"})


@router.get("/diplomator")
@router.get("/diplomator.html")
def diplomator_public_page():
    return marketing_file("diplomator.html", "text/html")


@router.get("/cambridge-info")
@router.get("/cambridge.html")
def cambridge_public_page():
    return marketing_file("cambridge.html", "text/html")


@router.get("/universidad-25-info")
@router.get("/u25")
@router.get("/universidad-25.html")
def universidad_public_page():
    return marketing_file("universidad-25.html", "text/html")


@router.get("/eso-adultos-info")
@router.get("/e25")
@router.get("/eso-adultos.html")
def eso_public_page():
    return marketing_file("eso-adultos.html", "text/html")


@router.get("/profesor")
@router.get("/profesor-info")
def profesor_landing():
    return marketing_file("profesor-particular.html", "text/html")


@router.get("/profesor/demo")
def profesor_demo():
    return static_html("profesor-particular.html", PROJECT_ROOT / "apps" / "profesor" / "index.html")


@router.get("/login")
@router.get("/profesor/login")
@router.get("/profesor/register")
@router.get("/e25/register")
@router.get("/u25/login")
@router.get("/e25/login")
@router.get("/cambridge-info/login")
@router.get("/diplomator/login")
def login_page(request: Request):
    if request.url.path in {"/diplomator/login", "/e25/login", "/e25/register", "/profesor/login", "/profesor/register"} or request.query_params.get("next") in {"/app", "/eso-adultos", "/profesor-particular"}:
        return static_html("product-access.html", PROJECT_ROOT / "backend" / "app" / "static" / "product-access.html")
    return static_html("login.html", PROJECT_ROOT / "backend" / "app" / "static" / "login.html")


@router.get("/apps")
def apps_page(request: Request, db: Session = Depends(get_db)):
    user = page_user_or_redirect(request, db, "/apps")
    if isinstance(user, RedirectResponse):
        return user
    return static_html("apps.html", PROJECT_ROOT / "backend" / "app" / "static" / "apps.html")


@router.get("/app")
def app_page(request: Request, db: Session = Depends(get_db)):
    user = page_user_or_redirect(request, db, "/app")
    if isinstance(user, RedirectResponse):
        return user
    return static_html("student.html", PROJECT_ROOT / "apps" / "diplomator" / "index.html")


@router.get("/cambridge")
def cambridge_page(request: Request, db: Session = Depends(get_db)):
    user = page_user_or_redirect(request, db, "/cambridge")
    if isinstance(user, RedirectResponse):
        return user
    return static_html("cambridge.html", PROJECT_ROOT / "apps" / "cambridge" / "index.html")


@router.get("/universidad-adultos")
def universidad_adultos_page(request: Request, db: Session = Depends(get_db)):
    user = page_user_or_redirect(request, db, "/universidad-adultos")
    if isinstance(user, RedirectResponse):
        return user
    return static_html("universidad-adultos.html", PROJECT_ROOT / "apps" / "u25" / "index.html")


@router.get("/eso-adultos")
def eso_adultos_page(request: Request, db: Session = Depends(get_db)):
    user = page_user_or_redirect(request, db, "/eso-adultos")
    if isinstance(user, RedirectResponse):
        return user
    return static_html("eso-adultos.html", PROJECT_ROOT / "apps" / "e25" / "index.html")


@router.get("/profesor-particular")
def profesor_particular_page(request: Request, db: Session = Depends(get_db)):
    user = page_user_or_redirect(request, db, "/profesor-particular")
    if isinstance(user, RedirectResponse):
        return user
    return static_html("profesor-particular.html", PROJECT_ROOT / "apps" / "profesor" / "index.html")


@router.get("/api/apps")
def api_apps(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    result = []
    for product in PRODUCTS.values():
        decision = check_access(db, user, product["code"], require_credits=product["code"] not in {"ESO_ADULTOS", "PROFESOR_PARTICULAR"})
        result.append({**product, "available": decision.ok, "message": decision.message})
    return {"ok": True, "apps": result}


@router.get("/api/status")
def api_status(user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)) -> dict:
    return {
        "ok": True,
        "app": "Apps Suite",
        "user": public_app_user(db, user, license_obj),
        "license": {"id": str(license_obj.id), "expires_at": license_obj.expires_at.isoformat()},
        "limits": public_limits(db),
    }


@router.get("/api/me")
def api_me(user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)) -> dict:
    return {"ok": True, "user": public_app_user(db, user, license_obj), "limits": public_limits(db)}


@router.post("/api/profile")
def update_profile(payload: dict, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)) -> dict:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El nombre no puede estar vacío.")
    user.full_name = name[:90]
    db.commit()
    db.refresh(user)
    return {"ok": True, "user": public_app_user(db, user, license_obj)}


@router.get("/api/license")
def get_license_key(_: User = Depends(current_user), license_obj: License = Depends(current_license)) -> dict:
    return {"ok": True, "license": license_obj.legacy_key or str(license_obj.id)}


@router.post("/api/license")
def set_license_key(_: dict, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)) -> dict:
    return {"ok": True, "user": public_app_user(db, user, license_obj)}


@router.get("/api/apikey")
def get_api_key_placeholder(_: User = Depends(current_user), __: License = Depends(current_license)) -> dict:
    return {"ok": True, "apikey": ""}


@router.post("/api/apikey")
def set_api_key_placeholder(_: dict, __: User = Depends(current_user), ___: License = Depends(current_license)) -> dict:
    return {"ok": True}


@router.post("/api/export-text")
def export_text_placeholder(payload: dict, __: User = Depends(current_user), ___: License = Depends(current_license)) -> dict:
    return {"ok": True, "filename": str(payload.get("filename") or "")}


@router.post("/api/export-db")
def export_db_placeholder(payload: dict, __: User = Depends(current_user), ___: License = Depends(current_license)) -> dict:
    return {"ok": True, "filename": str(payload.get("filename") or "")}


async def google_drive_access_token(user: User) -> str:
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Falta configurar Google OAuth.")
    if not user.drive_refresh_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Drive no esta conectado.")
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": user.drive_refresh_token,
                "grant_type": "refresh_token",
            },
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="No se pudo renovar el acceso a Drive.")
    access_token = str(response.json().get("access_token") or "")
    if not access_token:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Google no devolvio token de acceso.")
    return access_token


async def create_drive_folder(access_token: str, name: str, parent_id: str | None = None) -> str:
    metadata: dict[str, object] = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
    if parent_id:
        metadata["parents"] = [parent_id]
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://www.googleapis.com/drive/v3/files?fields=id",
            headers={"Authorization": f"Bearer {access_token}"},
            json=metadata,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="No se pudo crear la carpeta en Drive.")
    folder_id = str(response.json().get("id") or "")
    if not folder_id:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Drive no devolvio la carpeta creada.")
    return folder_id


async def find_drive_folder(access_token: str, name: str, parent_id: str | None = None) -> str:
    escaped_name = name.replace("\\", "\\\\").replace("'", "\\'")
    q = f"name = '{escaped_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    if parent_id:
        q += f" and '{parent_id}' in parents"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"q": q, "fields": "files(id,name)", "pageSize": "1"},
        )
    if response.status_code >= 400:
        return ""
    files = response.json().get("files") or []
    return str(files[0].get("id") or "") if files else ""


async def find_or_create_drive_folder(access_token: str, name: str, parent_id: str | None = None) -> str:
    return await find_drive_folder(access_token, name, parent_id) or await create_drive_folder(access_token, name, parent_id)


async def ensure_drive_path(access_token: str, root_folder_id: str | None, parts: list[str]) -> str | None:
    parent_id = root_folder_id
    for part in parts:
        parent_id = await find_or_create_drive_folder(access_token, part, parent_id)
    return parent_id


@router.get("/api/drive/folder")
def get_drive_folder(user: User = Depends(current_user), _: License = Depends(current_license)) -> dict:
    return {"ok": True, "drive_connected": bool(user.drive_refresh_token), "drive_folder_id": user.drive_folder_id or ""}


@router.post("/api/drive/folder")
def set_drive_folder(payload: dict, user: User = Depends(current_user), _: License = Depends(current_license), db: Session = Depends(get_db)) -> dict:
    folder_id = extract_drive_folder_id(str(payload.get("folder") or payload.get("folder_id") or ""))
    user.drive_folder_id = folder_id or None
    db.commit()
    db.refresh(user)
    return {"ok": True, "drive_connected": bool(user.drive_refresh_token), "drive_folder_id": user.drive_folder_id or ""}


@router.post("/api/documents/save-local")
def save_local_document(payload: dict, user: User = Depends(current_user), _: License = Depends(current_license), db: Session = Depends(get_db)) -> dict:
    filename = safe_document_name(str(payload.get("filename") or f"documento_{uuid4().hex}.doc"))
    content = str(payload.get("content") or "")
    if not content.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Documento vacio.")
    app_key = APP_ALIASES.get(str(payload.get("app") or "").strip().lower(), "diplomator")
    folder_parts = [safe_document_name(str(part), "carpeta")[:80] for part in (payload.get("folder_path") or []) if str(part or "").strip()]
    target_dir = LOCAL_DOCUMENT_DIR / str(user.organization_id) / str(user.id) / app_key
    for part in folder_parts[:6]:
        target_dir = target_dir / part
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / filename
    target.write_text(content, encoding="utf-8")
    db.add(Document(organization_id=user.organization_id, user_id=user.id, filename=filename, storage_path=str(target)))
    db.commit()
    return {"ok": True, "filename": filename, "path": str(target)}


@router.post("/api/profesor/materials")
def upload_profesor_material(payload: dict, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)):
    if license_obj.product_code != "PROFESOR_PARTICULAR":
        raise HTTPException(403, "Requiere acceso a Profesor Particular.")
    filename = safe_document_name(str(payload.get("filename") or "material"))[:200]
    suffix = Path(filename).suffix.lower()
    if suffix not in {".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp", ".txt"}:
        raise HTTPException(422, "Admite PDF, DOCX, imágenes PNG/JPG/WebP y TXT.")
    encoded = payload.get("base64")
    if not isinstance(encoded, str) or len(encoded) > 11_184_812:
        raise HTTPException(413, "El archivo no puede superar 8 MB.")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, "Archivo no válido.") from exc
    if not raw or len(raw) > 8 * 1024 * 1024:
        raise HTTPException(413, "El archivo debe contener datos y no superar 8 MB.")
    root = LOCAL_DOCUMENT_DIR / str(user.organization_id) / str(user.id) / "profesor_materials"
    root.mkdir(parents=True, exist_ok=True)
    document_id = uuid4()
    target = root / f"{document_id}{suffix}"
    target.write_bytes(raw)
    row = Document(id=document_id, organization_id=user.organization_id, user_id=user.id, filename=filename, storage_path=str(target))
    try:
        db.add(row)
        db.commit()
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return {"id": str(document_id), "filename": filename, "size": len(raw)}


@router.get("/api/profesor/materials/{document_id}")
def download_profesor_material(document_id: UUID, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)):
    row, target = _private_profesor_document(document_id, user, license_obj, db)
    return FileResponse(target, filename=row.filename, media_type="application/octet-stream", headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"})


def _private_profesor_document(document_id: UUID, user: User, license_obj: License, db: Session):
    if license_obj.product_code != "PROFESOR_PARTICULAR":
        raise HTTPException(403, "Requiere acceso a Profesor Particular.")
    row = db.get(Document, document_id)
    if not row or row.user_id != user.id or row.organization_id != user.organization_id:
        raise HTTPException(404, "Material no encontrado.")
    root = (LOCAL_DOCUMENT_DIR / str(user.organization_id) / str(user.id) / "profesor_materials").resolve()
    target = Path(row.storage_path).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        raise HTTPException(404, "Material no encontrado.")
    return row, target


@router.get("/api/profesor/materials/{document_id}/preview")
def preview_profesor_image(document_id: UUID, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)):
    row, target = _private_profesor_document(document_id, user, license_obj, db)
    mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}.get(target.suffix.lower())
    if not mime:
        raise HTTPException(415, "Este archivo no es una imagen.")
    from PIL import Image as PILImage, UnidentifiedImageError
    expected = {".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG", ".webp": "WEBP"}[target.suffix.lower()]
    try:
        with PILImage.open(target) as image:
            if image.format != expected or image.width * image.height > 20_000_000:
                raise ValueError("Formato o tamaño de imagen no válido.")
            image.verify()
    except (OSError, ValueError, UnidentifiedImageError) as exc:
        raise HTTPException(422, "La imagen no es válida.") from exc
    return FileResponse(target, media_type=mime, headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"})


@router.post("/api/profesor/export-pdf")
def export_profesor_pdf(payload: dict, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)):
    if license_obj.product_code != "PROFESOR_PARTICULAR":
        raise HTTPException(403, "Requiere acceso a Profesor Particular.")
    if payload.get("version") not in ("worksheet", "solutions"):
        raise HTTPException(422, "Elige ficha o soluciones.")
    material = payload.get("material")
    if len(json.dumps(material, ensure_ascii=False, default=str)) > 200_000:
        raise HTTPException(413, "El material es demasiado grande.")
    from app.services.teacher_pdf import render_teacher_pdf
    def load_image(value: str) -> bytes:
        try:
            document_id = UUID(value)
        except (TypeError, ValueError) as exc:
            raise ValueError("Referencia de imagen no válida.") from exc
        _, target = _private_profesor_document(document_id, user, license_obj, db)
        if target.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            raise ValueError("El recurso seleccionado no es una imagen.")
        from PIL import Image as PILImage, UnidentifiedImageError
        try:
            with PILImage.open(target) as image:
                if image.width * image.height > 20_000_000:
                    raise ValueError("La imagen es demasiado grande para el PDF.")
                image.verify()
        except (OSError, UnidentifiedImageError) as exc:
            raise ValueError("La imagen no es válida.") from exc
        return target.read_bytes()
    try:
        pdf = render_teacher_pdf(material, payload["version"] == "solutions", load_image)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    filename = "profesor-soluciones.pdf" if payload["version"] == "solutions" else "profesor-ficha.pdf"
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@router.post("/api/drive/upload-document")
async def upload_drive_document(
    payload: dict,
    user: User = Depends(current_user),
    _: License = Depends(current_license),
    db: Session = Depends(get_db),
) -> dict:
    filename = safe_document_name(str(payload.get("filename") or f"Diplomator_{uuid4().hex}.doc"))
    content = str(payload.get("content") or "")
    mime_type = str(payload.get("mime_type") or "application/msword").strip()[:120]
    if not filename:
        filename = f"Diplomator_{uuid4().hex}.doc"
    if not content.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Documento vacio.")

    access_token = await google_drive_access_token(user)
    folder_id = extract_drive_folder_id(str(payload.get("folder_id") or "")) or user.drive_folder_id
    folder_path = safe_drive_path(payload.get("folder_path"))
    if folder_path:
        folder_id = await ensure_drive_path(access_token, folder_id, folder_path)
    metadata: dict[str, object] = {"name": filename}
    if folder_id:
        metadata["parents"] = [folder_id]
    boundary = f"diplomator_{uuid4().hex}"
    body = (
        f"--{boundary}\r\n"
        "Content-Type: application/json; charset=UTF-8\r\n\r\n"
        f"{json.dumps(metadata, ensure_ascii=False)}\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: {mime_type}\r\n\r\n"
        f"{content}\r\n"
        f"--{boundary}--\r\n"
    ).encode("utf-8")

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": f"multipart/related; boundary={boundary}",
            },
            content=body,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="No se pudo subir el documento a Drive.")

    data = response.json()
    drive_ref = str(data.get("webViewLink") or data.get("id") or "")
    db.add(Document(organization_id=user.organization_id, user_id=user.id, filename=filename, storage_path=drive_ref))
    db.commit()
    return {"ok": True, "file_id": data.get("id"), "webViewLink": data.get("webViewLink")}


@router.get("/api/state")
def get_state(request: Request, user: User = Depends(current_user), _: License = Depends(current_license), db: Session = Depends(get_db)):
    return app_state_data(state_row(db, user), request_app_key(request))


@router.get("/api/gamification")
def get_gamification(request: Request, user: User = Depends(current_user), _: License = Depends(current_license), db: Session = Depends(get_db)):
    if request_app_key(request) != "eso_adultos":
        raise HTTPException(status_code=404, detail="El progreso de escritorio solo está disponible en ESO Adultos.")
    profile = get_or_create_profile(db, user)
    db.commit()
    db.refresh(profile)
    return {"profile": profile_payload(db, profile), "config": public_config()}


@router.post("/api/gamification/rewards")
def grant_gamification_reward(payload: dict, request: Request, user: User = Depends(current_user), _: License = Depends(current_license), db: Session = Depends(get_db)):
    if request_app_key(request) != "eso_adultos":
        raise HTTPException(status_code=404, detail="El progreso de escritorio solo está disponible en ESO Adultos.")
    metadata = payload.get("metadata") or {}
    if not isinstance(metadata, dict) or len(json.dumps(metadata, ensure_ascii=False)) > 4000:
        raise HTTPException(status_code=422, detail="Metadatos de recompensa no válidos.")
    try:
        result = award_event(db, user, payload.get("event_type", ""), payload.get("source_id", ""), metadata)
        db.commit()
        db.refresh(result.profile)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except IntegrityError:
        db.rollback()
        profile = get_or_create_profile(db, user)
        db.commit()
        db.refresh(profile)
        return {"awarded": False, "duplicate": True, "profile": profile_payload(db, profile), "unlocked_achievements": []}
    current_level = level_for_xp(result.profile.xp)["level"]
    return {
        "awarded": result.awarded,
        "duplicate": result.duplicate,
        "event_type": result.event_type,
        "source_id": result.source_id,
        "xp_awarded": result.xp_awarded,
        "coins_awarded": result.coins_awarded,
        "level_up": current_level > result.previous_level,
        "unlocked_achievements": list(result.unlocked_achievements),
        "profile": profile_payload(db, result.profile),
    }


@router.post("/api/gamification/purchases")
def buy_gamification_item(payload: dict, request: Request, user: User = Depends(current_user), _: License = Depends(current_license), db: Session = Depends(get_db)):
    if request_app_key(request) != "eso_adultos":
        raise HTTPException(status_code=404, detail="La tienda del escritorio solo está disponible en ESO Adultos.")
    try:
        profile = purchase_item(db, user, payload.get("item_id", ""))
        db.commit()
        db.refresh(profile)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Este objeto ya forma parte de tu inventario.") from exc
    return {"ok": True, "profile": profile_payload(db, profile)}


@router.post("/api/gamification/equipment")
def set_gamification_equipment(payload: dict, request: Request, user: User = Depends(current_user), _: License = Depends(current_license), db: Session = Depends(get_db)):
    if request_app_key(request) != "eso_adultos":
        raise HTTPException(status_code=404, detail="La personalización del escritorio solo está disponible en ESO Adultos.")
    try:
        profile = equip_item(db, user, payload.get("item_id", ""))
        db.commit()
        db.refresh(profile)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"ok": True, "profile": profile_payload(db, profile)}


@router.post("/api/state")
def save_state(payload: dict, request: Request, user: User = Depends(current_user), _: License = Depends(current_license), db: Session = Depends(get_db)):
    row = state_row(db, user)
    set_app_state_data(row, request_app_key(request), payload)
    db.commit()
    return {"ok": True}


@router.post("/api/profesor/generate")
async def generate_teacher_material(payload: dict, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db)):
    from app.services.teacher_generator import generator_context, parse_material, SYSTEM
    if license_obj.product_code != "PROFESOR_PARTICULAR":
        raise HTTPException(403, "Esta función requiere acceso a Profesor Particular.")
    request_id, context = generator_context(payload)
    # Lock the same account row used by credit accounting, including unlimited plans.
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    title = "teacher-generator:" + request_id
    previous = db.scalar(select(Conversation).where(Conversation.user_id == user.id, Conversation.organization_id == user.organization_id, Conversation.title == title))
    if previous:
        message = db.scalar(select(Message).where(Message.conversation_id == previous.id, Message.role == "assistant"))
        result = json.loads(message.content)
        if result["context"] != context:
            raise HTTPException(409, "Este identificador ya se utilizó con otro contexto.")
        return {"ok": True, "questions": result["questions"], "credits": 1, "reused": True}
    ensure_credit_balance(db, user, license_obj, 1)
    try:
        api_key, url, provider = chat_provider_config(db, product="PROFESOR_PARTICULAR")
    except HTTPException as exc:
        raise HTTPException(503, "Configura el proveedor y la clave de Profesor Particular en Administración → IA.") from exc
    model = chat_model_for_purpose(db, provider, "chat", "PROFESOR_PARTICULAR")
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json={"model": model, "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": json.dumps(context, ensure_ascii=False)}]})
    except httpx.TimeoutException as exc:
        raise HTTPException(504, "La IA ha tardado demasiado. No se han descontado créditos.") from exc
    except httpx.RequestError as exc:
        raise HTTPException(502, "No se pudo conectar con la IA. No se han descontado créditos.") from exc
    if response.status_code >= 400:
        raise provider_error("No se pudo generar el material. No se han descontado créditos", response)
    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
    except (ValueError, KeyError, TypeError, IndexError) as exc:
        raise HTTPException(502, "Respuesta del proveedor no válida. No se han descontado créditos.") from exc
    questions = parse_material(content, context)
    input_tokens, output_tokens = token_usage(data)
    record_usage(db, user, model, input_tokens, output_tokens, "PROFESOR_PARTICULAR", 1)
    conv = Conversation(organization_id=user.organization_id, user_id=user.id, title=title)
    db.add(conv)
    db.flush()
    db.add(Message(conversation_id=conv.id, organization_id=user.organization_id, user_id=user.id, role="assistant", content=json.dumps({"context": context, "questions": questions}, ensure_ascii=False)))
    db.commit()
    return {"ok": True, "questions": questions, "credits": 1, "reused": False}


@router.post("/api/chat")
async def chat(payload: dict, request: Request, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db), app_key_override: str | None = None):
    settings = get_settings()
    if len(str(payload)) > settings.max_prompt_chars:
        raise HTTPException(status_code=413, detail="Peticion demasiado grande.")
    purpose = str(payload.pop("purpose", "") or "").strip().lower()
    requested_credit_cost = requested_credit_cost_from_payload(payload, purpose)
    ensure_credit_balance(db, user, license_obj, requested_credit_cost)
    provider_key = "points_provider" if purpose == "points" else "chat_provider"
    api_key, chat_url, chat_provider = chat_provider_config(db, provider_key, license_obj.product_code)
    payload["model"] = chat_model_for_purpose(db, chat_provider, purpose, license_obj.product_code)
    if purpose == "points":
        add_points_focus_instruction(payload)
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(chat_url, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload)
    if res.status_code >= 400:
        raise provider_error("Error del proveedor IA", res)
    data = res.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    input_tokens, output_tokens = token_usage(data)
    actual_credit_cost = points_credit_cost_from_content(content, requested_credit_cost) if purpose == "points" else requested_credit_cost
    record_usage(db, user, payload["model"], input_tokens, output_tokens, product_code_for_app(app_key_override or request_app_key(request)), actual_credit_cost)
    conv = Conversation(organization_id=user.organization_id, user_id=user.id, title="AI request")
    db.add(conv)
    db.flush()
    db.add(Message(conversation_id=conv.id, organization_id=user.organization_id, user_id=user.id, role="assistant", content=content[:20000]))
    db.commit()
    return {"ok": True, "content": content}


@router.post("/api/ocr")
async def ocr(payload: dict, request: Request, user: User = Depends(current_user), _: License = Depends(current_license), db: Session = Depends(get_db), app_key_override: str | None = None):
    ensure_credit_balance(db, user, _, 1)
    product = _.product_code
    data_url, _ = image_data_url_from_payload(payload)
    api_key, chat_url, provider, model = vision_provider_config(db, product)
    target = str(payload.get("target") or "answer").strip().lower()
    label = "enunciado" if target == "prompt" else "respuesta del alumno"
    request_payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Extrae todo el texto legible de esta imagen para una practica escrita o examen educativo. "
                            f"El texto pertenece a: {label}. Devuelve solo el texto detectado, manteniendo saltos de linea utiles. "
                            "No expliques el proceso y no inventes contenido si alguna zona no se lee."
                        ),
                    },
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "max_tokens": 1800,
        "temperature": 0,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(chat_url, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=request_payload)
    if res.status_code >= 400:
        raise provider_error("Error del proveedor OCR", res)
    body = res.json()
    text = body.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    input_tokens, output_tokens = token_usage(body)
    record_usage(db, user, model, input_tokens, output_tokens, product_code_for_app(app_key_override or request_app_key(request)))
    db.commit()
    return {"ok": True, "text": text, "provider": provider, "model": model}


@router.post("/api/transcribe")
async def transcribe(payload: dict, request: Request, user: User = Depends(current_user), _: License = Depends(current_license), db: Session = Depends(get_db), app_key_override: str | None = None):
    ensure_credit_balance(db, user, _, 1)
    settings = get_settings()
    api_key, transcribe_url, transcribe_provider = transcribe_provider_config(db, _.product_code)
    audio_b64 = str(payload.get("audio", ""))
    if "," in audio_b64:
        audio_b64 = audio_b64.split(",", 1)[1]
    audio = base64.b64decode(audio_b64)
    if len(audio) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio demasiado grande.")
    files = {"file": (payload.get("filename") or "audio.webm", audio, payload.get("contentType") or "audio/webm")}
    transcribe_model = normalize_transcribe_model(transcribe_provider, app_ai_override(db, _.product_code, "transcribe").get("model") or setting_value(db, "transcribe_model") or settings.transcribe_model or GROQ_TRANSCRIBE_DEFAULT)
    data = {"model": transcribe_model, "language": payload.get("language") or "en"}
    async with httpx.AsyncClient(timeout=180) as client:
        res = await client.post(transcribe_url, headers={"Authorization": f"Bearer {api_key}"}, data=data, files=files)
    if res.status_code >= 400:
        raise provider_error("Error del proveedor de transcripcion", res)
    body = res.json()
    record_usage(db, user, transcribe_model, 0, 0, product_code_for_app(app_key_override or request_app_key(request)))
    db.commit()
    return {"ok": True, "text": body.get("text", "")}


@router.post("/validate")
def legacy_validate(payload: dict, db: Session = Depends(get_db)):
    decision = check_legacy_license(db, str(payload.get("license_key") or ""))
    if not decision.ok:
        audit(db, actor=None, organization_id=decision.license.organization_id if decision.license else None, action="access_blocked", entity_type="license", entity_id=str(decision.license.id) if decision.license else "", metadata={"reason": decision.message})
        db.commit()
    return {"ok": decision.ok, "message": decision.message}


def legacy_app_key(payload: dict) -> str:
    raw = str(payload.get("client_app") or payload.get("app") or "").strip().lower()
    return APP_ALIASES.get(raw, "diplomator")


@router.post("/chat")
async def legacy_chat(payload: dict, request: Request, db: Session = Depends(get_db)):
    decision = check_legacy_license(db, str(payload.get("license_key") or ""))
    if not decision.ok or not decision.license:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=decision.message)
    user = db.scalar(select(User).where(User.organization_id == decision.license.organization_id, User.is_active.is_(True)))
    return await chat(dict(payload.get("payload") or {}), request=request, user=user, _=decision.license, db=db, app_key_override=legacy_app_key(payload))


@router.post("/ocr")
async def legacy_ocr(payload: dict, request: Request, db: Session = Depends(get_db)):
    decision = check_legacy_license(db, str(payload.get("license_key") or ""))
    if not decision.ok or not decision.license:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=decision.message)
    user = db.scalar(select(User).where(User.organization_id == decision.license.organization_id, User.is_active.is_(True)))
    return await ocr(dict(payload.get("payload") or {}), request=request, user=user, _=decision.license, db=db, app_key_override=legacy_app_key(payload))


@router.post("/transcribe")
async def legacy_transcribe(payload: dict, request: Request, db: Session = Depends(get_db)):
    decision = check_legacy_license(db, str(payload.get("license_key") or ""))
    if not decision.ok or not decision.license:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=decision.message)
    user = db.scalar(select(User).where(User.organization_id == decision.license.organization_id, User.is_active.is_(True)))
    return await transcribe(dict(payload.get("payload") or {}), request=request, user=user, _=decision.license, db=db, app_key_override=legacy_app_key(payload))
