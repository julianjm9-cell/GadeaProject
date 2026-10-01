"""Suite-authenticated, same-origin gateway for the original Aliot interface."""
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
from app.services.ocr_storage import model_config
from app.services.ocr_legacy_bridge import get_legacy_port

router = APIRouter(tags=["ocr-original"])
MAX_BODY = 50 * 1024 * 1024
BLOCKED = ("auth/access", "auth/role", "ollama/", "set_modelo")
MODEL_FIELDS = {"api_tipo", "api_key", "modelo_externo", "api_url", "ollama_url", "modelo_analisis", "modelo_ocr", "puerto", "vision_enabled", "modo_vision_ollama", "anyformat_api_key", "anyformat_workflow_id", "anyformat_base_url"}


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
    if path == "config" and request.method == "POST":
        body = await request.json()
        if MODEL_FIELDS.intersection(body):
            raise HTTPException(403, "Configura el modelo de facturas desde la suite")
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
        config = model_config(db)
        configured = True
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
