from __future__ import annotations

import base64
import json
import os
import re
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import current_license, current_user
from app.config import get_settings
from app.database.session import get_db
from app.models import AppSetting, ClientState, Conversation, Document, License, Message, UsageRecord, User
from app.security.tokens import decode_token
from app.services.ai_config import (
    GROQ_TRANSCRIBE_DEFAULT,
    default_chat_model,
    normalize_chat_model,
    normalize_transcribe_model,
)
from app.services.audit import audit
from app.services.licenses import check_access, check_legacy_license
from app.services.resources import load_resource_catalog


router = APIRouter(tags=["diplomator"])
STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOCAL_DOCUMENT_DIR = Path(os.getenv("DOCUMENT_EXPORT_DIR") or ("/app/data/documents" if Path("/app").exists() else PROJECT_ROOT / "backend" / "data" / "documents"))
PRODUCTS = {
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


def chat_provider_config(db: Session, setting_key: str = "chat_provider") -> tuple[str, str, str]:
    settings = get_settings()
    provider = (setting_value(db, setting_key) or setting_value(db, "chat_provider") or setting_value(db, "ai_provider") or settings.ai_provider).lower()
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


def transcribe_provider_config(db: Session) -> tuple[str, str, str]:
    settings = get_settings()
    provider = (setting_value(db, "transcribe_provider") or setting_value(db, "ai_provider") or settings.ai_provider).lower()
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


def chat_model_for_purpose(db: Session, provider: str, purpose: str) -> str:
    if purpose == "points":
        return normalize_chat_model(provider, setting_value(db, "points_model") or setting_value(db, "chat_model") or default_chat_model(provider))
    return normalize_chat_model(provider, setting_value(db, "chat_model") or default_chat_model(provider))


def vision_provider_config(db: Session) -> tuple[str, str, str, str]:
    settings = get_settings()
    openai_api_key = setting_value(db, "openai_api_key") or settings.openai_api_key
    gemini_api_key = setting_value(db, "gemini_api_key") or settings.gemini_api_key
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


DEFAULT_TOPIC_STYLE_GUIDE = """Model the structure on strong Diplomator reference topics: start each point as part of an oral presentation, not as isolated notes; organise the answer around clear axes such as evolution/history, importance/impact, challenges/controversies and legacy/future prospects; move from context to concrete facts and then to significance; include named actors, dates, places, reforms, institutions, controversies and consequences; use simple but elegant oral transitions such as "This leads us to...", "Beyond this aspect..." or their natural equivalent in the target language. The tone must be exam-ready, diplomatic and analytical: fluent enough to recite, but dense enough to sound informed."""


def public_limits(db: Session | None = None) -> dict:
    settings = get_settings()
    limits = {
        "max_output_tokens": settings.max_output_tokens,
        "max_vocab": settings.max_vocab,
        "profile_chars": settings.profile_chars,
    }
    if db is not None:
        limits["topic_style_guide"] = setting_value(db, "topic_style_guide") or DEFAULT_TOPIC_STYLE_GUIDE
    return limits


def active_usage_count(db: Session, user: User, license_obj: License) -> int:
    return len(
        list(
            db.scalars(
                select(UsageRecord.id).where(
                    UsageRecord.organization_id == user.organization_id,
                    UsageRecord.user_id == user.id,
                    UsageRecord.product_code == license_obj.product_code,
                    UsageRecord.created_at >= license_obj.starts_at,
                    UsageRecord.created_at <= license_obj.expires_at,
                )
            )
        )
    )


def public_app_user(db: Session, user: User, license_obj: License) -> dict:
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
        "monthly_quota": license_obj.usage_limit,
        "usage_month": active_usage_count(db, user, license_obj),
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
        "eso-adultos-logo.png": "image/png",
        "simple-flow.svg": "image/svg+xml",
    }
    if filename not in allowed:
        raise HTTPException(status_code=404, detail="Asset no encontrado.")
    return marketing_file(filename, allowed[filename])


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


@router.get("/login")
@router.get("/u25/login")
@router.get("/e25/login")
@router.get("/cambridge-info/login")
@router.get("/diplomator/login")
def login_page():
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


@router.get("/api/apps")
def api_apps(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    result = []
    for product in PRODUCTS.values():
        decision = check_access(db, user, product["code"])
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


@router.post("/api/state")
def save_state(payload: dict, request: Request, user: User = Depends(current_user), _: License = Depends(current_license), db: Session = Depends(get_db)):
    row = state_row(db, user)
    set_app_state_data(row, request_app_key(request), payload)
    db.commit()
    return {"ok": True}


@router.post("/api/chat")
async def chat(payload: dict, request: Request, user: User = Depends(current_user), license_obj: License = Depends(current_license), db: Session = Depends(get_db), app_key_override: str | None = None):
    settings = get_settings()
    if len(str(payload)) > settings.max_prompt_chars:
        raise HTTPException(status_code=413, detail="Peticion demasiado grande.")
    purpose = str(payload.pop("purpose", "") or "").strip().lower()
    requested_credit_cost = requested_credit_cost_from_payload(payload, purpose)
    ensure_credit_balance(db, user, license_obj, requested_credit_cost)
    provider_key = "points_provider" if purpose == "points" else "chat_provider"
    api_key, chat_url, chat_provider = chat_provider_config(db, provider_key)
    payload["model"] = chat_model_for_purpose(db, chat_provider, purpose)
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
    data_url, _ = image_data_url_from_payload(payload)
    api_key, chat_url, provider, model = vision_provider_config(db)
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
    settings = get_settings()
    api_key, transcribe_url, transcribe_provider = transcribe_provider_config(db)
    audio_b64 = str(payload.get("audio", ""))
    if "," in audio_b64:
        audio_b64 = audio_b64.split(",", 1)[1]
    audio = base64.b64decode(audio_b64)
    if len(audio) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio demasiado grande.")
    files = {"file": (payload.get("filename") or "audio.webm", audio, payload.get("contentType") or "audio/webm")}
    transcribe_model = normalize_transcribe_model(transcribe_provider, setting_value(db, "transcribe_model") or settings.transcribe_model or GROQ_TRANSCRIBE_DEFAULT)
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
