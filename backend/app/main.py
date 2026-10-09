from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, app_routes, auth, ocr, ocr_legacy, profesor_access, profesor_ads, profesor_material_sessions
from app.config import get_settings
from app.database.runtime_schema import ensure_runtime_schema
from app.services.ads_maintenance import lifespan
from starlette.responses import JSONResponse


settings = get_settings()
try:
    ensure_runtime_schema()
except Exception:
    pass
app = FastAPI(title=settings.app_name, lifespan=lifespan)


@app.middleware("http")
async def protect_ads(request, call_next):
    path = request.url.path
    protected = path.startswith(("/api/profesor/ads", "/api/profesor/ad-", "/profesor/anunc", "/admin/profesor-ads"))
    if protected and request.method in {"POST", "PUT", "PATCH"}:
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 7_100_000:
                return JSONResponse({"detail": "El envío supera el tamaño permitido."}, status_code=413)
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
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(profesor_access.router)
app.include_router(profesor_ads.router)
app.include_router(profesor_material_sessions.router)
app.include_router(admin.router)
app.include_router(app_routes.router)
app.include_router(ocr.router)
app.include_router(ocr_legacy.router)
