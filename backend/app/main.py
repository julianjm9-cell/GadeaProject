from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api import admin, app_routes, auth, ocr, ocr_legacy, profesor_access, profesor_ads, profesor_material_sessions, teacher_generation_jobs
from app.api import teacher_recovery
from app.api import profesor_notifications
from app.config import get_settings
from app.database.runtime_schema import ensure_runtime_schema
from starlette.responses import JSONResponse


settings = get_settings()
try:
    ensure_runtime_schema()
except Exception:
    pass
app = FastAPI(title=settings.app_name)


@app.middleware("http")
async def protect_ads(request, call_next):
    path = request.scope.get("path", "")
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and (request.cookies.get("diplomator_access") or request.cookies.get("profesor_student_access")):
        origin=request.headers.get("origin")
        if origin and origin not in {*settings.cors_origin_list, settings.public_base_url.rstrip("/")}:
            return JSONResponse({"detail":"Origen no permitido."},status_code=403,headers={"Cache-Control":"private, no-store"})
    protected = path.startswith(("/api/profesor/ads", "/api/profesor/ad-", "/profesor/anunc", "/admin/profesor-ads"))
    private_data = path in {"/api/state", "/api/profile"} or path.startswith(("/api/profesor/", "/auth/", "/cuenta", "/admin/"))
    limit = 512_000
    if path == "/api/state":
        limit = settings.max_state_bytes
    elif path == "/api/profesor/materials":
        limit = 11_300_000  # Preserve existing 8 MiB uploads encoded as base64.
    elif protected:
        limit = 7_100_000
    elif path.startswith("/api/profesor/editor-drafts/"):
        limit = 1_100_000
    bounded = protected or path == "/api/state" or path.startswith(("/auth/", "/api/profesor/"))
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
    allow_headers=["Authorization", "Content-Type"],
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
