"""Suite-authenticated, same-origin gateway for the original FACTURAS interface."""
import json
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import current_user
from app.database.session import get_db
from app.models import UsageRecord, User
from app.services.licenses import check_access
from app.services.ocr_storage import effective_model_config
from app.services.ocr_legacy_bridge import get_legacy_port, legacy_dir

router = APIRouter(tags=["ocr-original"])
MAX_BODY = 50 * 1024 * 1024
BLOCKED = ("auth/access", "auth/role")
PROVIDERS = {"ollama", "openai", "gemini", "groq", "anthropic", "anyformat"}
MODEL_FIELDS = {"api_tipo", "api_key", "modelo_externo", "modelo_analisis", "modelo_ocr", "vision_enabled", "modo_vision_ollama", "anyformat_api_key", "anyformat_workflow_id"}


def validate_motor_change(body: dict, user: User):
    """Preserve original controls, but never let a browser set server paths or URLs."""
    if not isinstance(body, dict):
        raise HTTPException(422, "Configuración no válida")
    provider = body.get("api_tipo")
    if provider is not None and provider not in PROVIDERS:
        raise HTTPException(422, "Motor de IA no admitido")
    for key in MODEL_FIELDS & body.keys():
        value = body[key]
        if isinstance(value, str) and len(value) > 500:
            raise HTTPException(422, "Valor de configuración demasiado largo")
    if "api_key" in body and not isinstance(body["api_key"], str):
        raise HTTPException(422, "Clave no válida")
    if "anyformat_api_key" in body and not isinstance(body["anyformat_api_key"], str):
        raise HTTPException(422, "Clave no válida")
    if body.get("api_url"):
        raise HTTPException(422, "La URL de la API se gestiona en el servidor")
    if body.get("ollama_url") and body["ollama_url"].rstrip("/") not in {"http://127.0.0.1:11434", "http://localhost:11434", "http://127.0.0.1:11435", "http://localhost:11435"}:
        raise HTTPException(422, "Ollama solo puede usarse en el servidor local")
    if body.get("anyformat_base_url") and body["anyformat_base_url"].rstrip("/") != "https://api.anyformat.ai":
        raise HTTPException(422, "La URL de Anyformat no se puede cambiar")
    # The original UI submits its default URL and port. The suite owns these.
    for key in ("api_url", "ollama_url", "puerto", "carpeta_facturas", "anyformat_base_url"):
        body.pop(key, None)
    if provider is not None:
        path = legacy_dir(user) / "config.json"
        saved = json.loads(path.read_text(encoding="utf-8-sig")) if path.exists() else {}
        if saved.get("api_tipo") != provider and "api_key" not in body and provider not in {"ollama", "anyformat"}:
            raise HTTPException(422, "Introduce la clave del nuevo proveedor")
    return body


@router.api_route("/facturas/legacy/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def legacy_api(path: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if request.method != "GET" and request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Solicitud no permitida")
    decision = check_access(db, user, "OCR_FACTURAS", require_credits=False)
    if not decision.ok:
        raise HTTPException(403, decision.message)
    if not path or path.startswith("/") or any(part in {".", ".."} for part in path.split("/")):
        raise HTTPException(404)
    if path == "auth/me":
        return {"authenticated": True, "user": {"email": user.email, "name": user.full_name, "role": "admin", "permissions": ["view", "process", "review", "manage_workspaces", "manage_config"]}, "roles": {"admin": {"label": "Administrador", "permissions": ["view", "process", "review", "manage_workspaces", "manage_config"]}}, "auth_disabled": False}
    if any(path == blocked or path.startswith(blocked) for blocked in BLOCKED):
        raise HTTPException(403, "El acceso y los modelos se administran desde la suite")
    config_body = None
    if path == "config" and request.method == "POST":
        config_body = validate_motor_change(await request.json(), user)
    if path == "config" and request.method == "GET":
        # Original app shows the first 8 characters of the provider key. Hide it.
        redact_config = True
    else:
        redact_config = False
    processing = path in {"facturas/upload", "facturas/upload-manual"} and request.method == "POST"
    if processing:
        db.scalar(select(User).where(User.id == user.id).with_for_update())
        decision = check_access(db, user, "OCR_FACTURAS", require_credits=True)
        if not decision.ok:
            raise HTTPException(402, decision.message)
    try:
        config = effective_model_config(db, user)
        configured = config.get("configured", True)
    except ValueError:
        config = {"api_tipo": "openai", "api_key": "", "modelo_externo": "pending"}
        configured = False
    needs_model = processing or path.startswith("facturas/results/") and path.endswith("/regenerar") or path in {"entrenamiento/procesar-ejemplo", "entrenamiento/generar-guia", "entrenamiento/añadir-ejemplo"}
    if needs_model and not configured:
        raise HTTPException(503, "Configura primero el modelo externo de OCR en la suite")
    try:
        port = get_legacy_port(user, config)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_BODY:
            raise HTTPException(413, "Máximo 50 MB por solicitud")
    if config_body is not None:
        data = bytearray(json.dumps(config_body).encode("utf-8"))
    target = f"http://127.0.0.1:{port}/api/{path}"
    headers = {"content-type": request.headers.get("content-type", "application/octet-stream")}
    response = None
    async with httpx.AsyncClient(timeout=httpx.Timeout(900, connect=3)) as client:
        for _ in range(25):
            try:
                response = await client.request(request.method, target, params=request.query_params, content=bytes(data), headers=headers)
                break
            except httpx.ConnectError:
                import asyncio
                await asyncio.sleep(0.2)
            except httpx.HTTPError:
                raise HTTPException(502, "El procesador de facturas no responde")
    if response is None:
        raise HTTPException(503, "El procesador de facturas está iniciándose. Vuelve a intentarlo.")
    if config_body is not None and response.is_success and MODEL_FIELDS.intersection(config_body):
        config_path = legacy_dir(user) / "config.json"
        saved = json.loads(config_path.read_text(encoding="utf-8-sig"))
        saved["suite_user_model_override"] = True
        config_path.write_text(json.dumps(saved, ensure_ascii=False), encoding="utf-8")
    if processing and response.is_success and response.json().get("total", 0) > 0:
        db.add(UsageRecord(id=uuid4(), organization_id=user.organization_id, user_id=user.id, product_code="OCR_FACTURAS", model=config["modelo_externo"]))
        db.commit()
    if redact_config and response.is_success:
        payload = response.json()
        payload["api_key_preview"] = ""
        payload["anyformat_api_key_preview"] = ""
        return JSONResponse(payload)
    forwarded = {key: value for key, value in response.headers.items() if key.lower() in {"content-type", "content-disposition", "cache-control"}}
    forwarded["Cache-Control"] = "no-store"
    return Response(content=response.content, status_code=response.status_code, headers=forwarded)
