from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api import admin, app_routes, auth, ocr, ocr_legacy, profesor_access, profesor_ads, profesor_material_sessions, teacher_generation_jobs
from app.api import teacher_recovery
from app.api import profesor_notifications
from app.config import get_settings
from app.database.runtime_schema import ensure_runtime_schema
from starlette.responses import HTMLResponse, JSONResponse
from app.services.app_availability import PAUSE_MESSAGE


settings = get_settings()
try:
    ensure_runtime_schema()
except Exception:
    pass
app = FastAPI(title=settings.app_name)


@app.exception_handler(HTTPException)
async def paused_application_page(request: Request, exc: HTTPException):
    if exc.status_code != 503 or exc.detail != PAUSE_MESSAGE or "text/html" not in request.headers.get("accept", ""):
        return await http_exception_handler(request, exc)
    html = ('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<meta name="robots" content="noindex,nofollow"><title>Volvemos pronto · Educame Tech</title>'
            '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:linear-gradient(135deg,#e9f4ff,#f8fbff);font-family:system-ui,sans-serif;color:#0e2855}'
            'main{max-width:460px;padding:36px;border:1px solid #c9def6;border-radius:24px;background:white;box-shadow:0 20px 60px #133d7120}span{font-size:36px}h1{margin:12px 0;font-size:27px}p{line-height:1.55;color:#546987}a{display:inline-block;margin-top:12px;padding:12px 18px;border-radius:10px;background:#086bf3;color:#fff;text-decoration:none;font-weight:700}</style>'
            '</head><body><main><span aria-hidden="true">✦</span><h1>Volvemos pronto</h1><p>Esta aplicación está pausada temporalmente. Tu progreso y tus materiales siguen guardados. Podrás continuar cuando se reactive.</p><a href="/">Ver las aplicaciones</a></main></body></html>')
    return HTMLResponse(html, status_code=503, headers={"Cache-Control": "no-store", "Retry-After": "3600", "X-Robots-Tag": "noindex, nofollow"})


@app.middleware("http")
async def protect_ads(request, call_next):
    path = request.scope.get("path", "")
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and (request.cookies.get("diplomator_access") or request.cookies.get("profesor_student_access")):
        origin=request.headers.get("origin")
        if origin and origin not in {*settings.cors_origin_list, settings.public_base_url.rstrip("/")}:
            return JSONResponse({"detail":"Origen no permitido."},status_code=403,headers={"Cache-Control":"private, no-store"})
    protected = path.startswith(("/api/profesor/ads", "/api/profesor/ad-", "/profesor/anunc", "/admin/profesor-ads"))
    private_data = path.startswith(("/api/", "/auth/", "/cuenta", "/admin/")) and not path.startswith(("/api/public/", "/api/profesor/ads", "/api/profesor/ad-policy"))
    limit = 512_000
    if path == "/api/state":
        limit = settings.max_state_bytes
    elif path == '/api/transcribe':
        limit = 36_000_000
    elif path == '/api/ocr':
        limit = 12_000_000
    elif path == "/api/profesor/materials":
        limit = 11_300_000  # Preserve existing 8 MiB uploads encoded as base64.
    elif protected:
        limit = 7_100_000
    elif path.startswith("/api/profesor/editor-drafts/"):
        limit = 1_100_000
    bounded = protected or path in {"/api/state", "/api/chat", "/api/ocr", "/api/transcribe"} or path.startswith(("/auth/", "/api/profesor/", "/api/app-notifications/"))
    if bounded and request.method in {"POST", "PUT", "PATCH"}:
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > limit:
                return JSONResponse({"detail": "El envío supera el tamaño permitido. Divide el material o elimina archivos incrustados innecesarios."}, status_code=413, headers={"Cache-Control":"private, no-store"})
        request._body = bytes(body)
    response = await call_next(request)
    if protected:
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        if path.startswith(("/api/", "/admin/")):
            response.headers["X-Robots-Tag"] = "noindex, nofollow"
        if path.startswith("/profesor/anunc"):
            response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'"
    if private_data:
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Client-App", "If-Match", "X-Confirm-Empty-State", "Idempotency-Key"],
    expose_headers=["ETag", "Retry-After"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=[host.strip() for host in settings.allowed_hosts.split(",") if host.strip()], www_redirect=False)

app.include_router(auth.router)
app.include_router(profesor_access.router)
app.include_router(profesor_ads.router)
app.include_router(profesor_material_sessions.router)
app.include_router(teacher_generation_jobs.router)
app.include_router(teacher_recovery.router)
app.include_router(profesor_notifications.router)
app.include_router(admin.router)
app.include_router(app_routes.router)
app.include_router(ocr.router)
app.include_router(ocr_legacy.router)
