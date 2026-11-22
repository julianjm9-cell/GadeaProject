"""Managed visibility and real entry points, separate from licences and saved data."""
import json
import re

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import AppSetting
from app.services.app_availability import is_app_paused, PAUSE_MESSAGE, PRODUCT_CODES
from app.services import gadeos
from app.security.passwords import hash_password

REGISTRY_KEY = "managed_app_registry:v1"
DEFAULTS = [
    {"id": "profesor", "name": "Profesor Particular", "product": "PROFESOR_PARTICULAR", "path": "/profesor-particular", "landing": "/profesor", "prefixes": ["/profesor", "/api/profesor/", "/auth/profesor/"]},
    {"id": "eso", "name": "ESO Adultos", "product": "ESO_ADULTOS", "path": "/eso-adultos", "landing": "/e25", "prefixes": ["/eso-adultos", "/e25", "/auth/eso/"]},
    {"id": "ingles", "name": "Inglés", "product": "CAMBRIDGE", "path": "/cambridge", "landing": "/cambridge-info", "prefixes": ["/cambridge"]},
    {"id": "diplomator", "name": "Diplomator", "product": "DIPLOMATOR", "path": "/app", "landing": "/diplomator", "prefixes": ["/diplomator"]},
    {"id": "universidad", "name": "Universidad +25", "product": "UNIVERSIDAD_ADULTOS", "path": "/universidad-adultos", "landing": "/u25", "prefixes": ["/universidad-adultos", "/universidad-25", "/u25"]},
    {"id": "facturas", "name": "Facturas", "product": "OCR_FACTURAS", "path": "/facturas", "landing": "/ocr-facturas", "prefixes": ["/facturas", "/ocr-facturas", "/api/ocr"]},
    {"id": "hazlotu", "name": "HazloTú", "product": "HAZLOTU", "path": "/hazlo-tu", "landing": "/hazlo-tu", "prefixes": ["/hazlo-tu", "/hazlotu"]},
    {"id": "gadeos", "name": "GADEOS · La arena de los recuerdos", "product": "GADEOS", "path": gadeos.PUBLIC_PATH, "landing": None, "prefixes": ["/gadeos"], "template": "arena", "state": "privada", "personal": True},
]
ASSET_PREFIXES = {"profesor": ("/assets/profesor-", "/profesor-"), "ingles": ("/assets/cambridge-", "/assets/listening/"),
                  "eso": ("/assets/eso-",), "diplomator": ("/assets/diplomator-",)}


def registry(db: Session, *, include_secrets=False) -> dict:
    row = db.get(AppSetting, REGISTRY_KEY)
    saved = json.loads(row.value) if row else {"revision": 0, "apps": []}
    overrides = {app["id"]: app for app in saved["apps"]}
    apps = [{"state": "publica", "template": "existing", **app, **overrides.pop(app["id"], {})} for app in DEFAULTS]
    apps.extend(overrides.values())
    for app in apps:
        if app["id"] == "gadeos":
            app["path"] = gadeos.PUBLIC_PATH
        app["visibility"] = app["state"]
        if is_app_paused(db, app["product"]):
            app["state"] = "pausada"
        app["password_protected"] = bool(app.get("access_password_hash"))
        if not include_secrets:
            app.pop("access_password_hash", None)
    return {"revision": saved["revision"], "apps": apps}


def app_definition(db: Session, app_id: str) -> dict:
    app = next((app for app in registry(db)["apps"] if app["id"] == app_id), None)
    if not app:
        raise HTTPException(404, "Aplicación no encontrada.")
    return app


def product_is_public(db: Session, product: str) -> bool:
    app = next((app for app in registry(db)["apps"] if app["product"] == product), None)
    return not app or app["state"] == "publica"


def known_app_for_path(path: str):
    if path == "/app":
        return next(app for app in DEFAULTS if app["id"] == "diplomator")
    return next((app for app in DEFAULTS if path in {app["path"], app["landing"]} or path.startswith(ASSET_PREFIXES.get(app["id"], ())) or
                 any(path == prefix or path.startswith(prefix if prefix.endswith("/") else prefix + "/") or path.startswith((prefix + "-", prefix + ".")) for prefix in app["prefixes"])), None)


def save_app(db: Session, payload: dict, *, create: bool = False) -> dict:
    row = db.scalar(select(AppSetting).where(AppSetting.key == REGISTRY_KEY).with_for_update())
    original = row.value if row else None
    current = registry(db, include_secrets=True)
    if type(payload.get("revision")) is not int or payload["revision"] != current["revision"]:
        raise HTTPException(409, "El catálogo ha cambiado. Actualiza antes de guardar.")
    app_id, state = payload.get("id"), payload.get("state")
    if not isinstance(app_id, str) or not re.fullmatch(r"[a-z][a-z0-9-]{1,48}", app_id) or state not in {"publica", "privada", "pausada"}:
        raise HTTPException(422, "Revisa el identificador y el estado de la aplicación.")
    previous = next((app for app in current["apps"] if app["id"] == app_id), None)
    if create:
        name = payload.get("name")
        if previous or app_id in {"admin", "api", "assets", "login", "control", "ecosistema"}:
            raise HTTPException(409, "Ese identificador ya está en uso o está reservado.")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100 or len(current["apps"]) >= 60:
            raise HTTPException(422, "Escribe un nombre de hasta 100 caracteres.")
        app = {"id": app_id, "name": name.strip(), "product": "CUSTOM_" + app_id.upper().replace("-", "_"),
               "path": "/a/" + app_id, "landing": None, "prefixes": [], "template": "workspace", "state": state}
    else:
        if not previous:
            raise HTTPException(404, "Aplicación no encontrada.")
        app = {**previous, "state": state}
    password = payload.get("access_password")
    if password is not None:
        if not isinstance(password, str) or not 6 <= len(password) <= 72 or len(password.encode()) > 72:
            raise HTTPException(422, "La contraseña de acceso debe tener entre 6 y 72 caracteres.")
        app["access_password_hash"] = hash_password(password)
    if password is not None or (previous and state != previous["state"]):
        app["access_version"] = app.get("access_version", 0) + 1
    if app["product"] in PRODUCT_CODES and state == "pausada":
        previous_saved = next((item for item in json.loads(original)["apps"] if item["id"] == app_id), {}) if original else {}
        app["state"] = previous_saved.get("state", "publica")
    saved_apps = json.loads(original)["apps"] if original else []
    stored_app = {"id": app_id, "state": app["state"]} if app_id in {item["id"] for item in DEFAULTS} else app
    for key in ("access_password_hash", "access_version"):
        if key in app:
            stored_app[key] = app[key]
    apps = [item for item in saved_apps if item["id"] != app_id] + [stored_app]
    value = json.dumps({"revision": current["revision"] + 1, "apps": apps}, ensure_ascii=False)
    if row:
        changed = db.execute(update(AppSetting).where(AppSetting.key == REGISTRY_KEY, AppSetting.value == original).values(value=value))
        if changed.rowcount != 1:
            raise HTTPException(409, "Otro cambio llegó antes. Actualiza el catálogo.")
        db.expire(row)
    else:
        db.add(AppSetting(key=REGISTRY_KEY, value=value))
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Otro cambio llegó antes. Actualiza el catálogo.")
    if app["product"] in PRODUCT_CODES:
        pause = db.get(AppSetting, "app_paused:" + app["product"])
        if pause:
            pause.value = "1" if state == "pausada" else "0"
        else:
            db.add(AppSetting(key="app_paused:" + app["product"], value="1" if state == "pausada" else "0"))
    db.flush()
    return app


def touch_registry(db: Session):
    row = db.scalar(select(AppSetting).where(AppSetting.key == REGISTRY_KEY).with_for_update())
    data = json.loads(row.value) if row else {"revision": 0, "apps": []}
    data["revision"] += 1
    if row:
        row.value = json.dumps(data, ensure_ascii=False)
    else:
        db.add(AppSetting(key=REGISTRY_KEY, value=json.dumps(data)))


def require_password_gate(request, app):
    if app["visibility"] != "privada" or not app.get("access_password_hash"):
        return False
    request.state.managed_private = True
    if app["state"] == "pausada":
        raise HTTPException(503, PAUSE_MESSAGE, headers={"Retry-After": "3600"})
    from app.api.app_access import granted
    if not granted(request, app):
        request.state.gated_app_name = app["name"]
        raise HTTPException(401, "APP_ACCESS_REQUIRED:" + app["id"])
    return True


def require_product_password(request, db, product):
    app = next((item for item in registry(db, include_secrets=True)["apps"] if item["product"] == product), None)
    if app:
        require_password_gate(request, app)


def enforce_managed_access(request: Request, db: Session = Depends(get_db)):
    """Global route dependency: changing a label never grants private access."""
    path = request.url.path
    if not path.startswith(("/admin", "/api/app-access/", "/auth/")):
        candidate = known_app_for_path(path)
        app_id = candidate["id"] if candidate else None
        if path.startswith("/api/private-apps/") or path.startswith("/a/"):
            parts = path.strip("/").split("/")
            app_id = parts[2] if parts[0] == "api" and len(parts) > 2 else parts[1] if len(parts) > 1 else None
        if path.startswith((gadeos.PUBLIC_API + "/", "/api/arena-chinchon/")):
            app_id = "gadeos"
        raw_app = str(request.headers.get("x-client-app") or request.query_params.get("app") or "").lower()
        if not app_id and path.startswith("/api/"):
            app_id = {"cambridge":"ingles", "eso_adultos":"eso", "profesor_particular":"profesor", "diplomator":"diplomator", "universidad_adultos":"universidad", "ocr_facturas":"facturas"}.get(raw_app)
        gated = next((item for item in registry(db, include_secrets=True)["apps"] if item["id"] == app_id), None) if app_id else None
        if gated and require_password_gate(request, gated):
            return
    if path.startswith(("/admin", "/api/private-apps/", gadeos.PUBLIC_API + "/", gadeos.PUBLIC_PATH, "/gadeos", "/a/", "/auth/google/", "/auth/login", "/auth/refresh", "/auth/logout")):
        return
    raw = str(request.headers.get("x-client-app") or request.query_params.get("app") or "").lower().replace("-", "_")
    code = {"profesor_particular": "PROFESOR_PARTICULAR", "eso_adultos": "ESO_ADULTOS", "cambridge": "CAMBRIDGE",
            "universidad_adultos": "UNIVERSIDAD_ADULTOS", "diplomator": "DIPLOMATOR", "ocr_facturas": "OCR_FACTURAS"}.get(raw)
    candidate = known_app_for_path(path)
    if not candidate and not (code and path.startswith("/api/")):
        return
    app = app_definition(db, candidate["id"]) if candidate else next(item for item in registry(db)["apps"] if item["product"] == code)
    if app["state"] == "publica" or (app["state"] == "pausada" and app["visibility"] == "publica"):
        return
    if path.endswith("/login") or path.endswith("/signup-settings"):
        return
    if app["state"] == "pausada" and (path == app["path"] or path.startswith("/api/")):
        raise HTTPException(503, PAUSE_MESSAGE, headers={"Retry-After": "3600"})
    request.state.managed_private = True
    # The sign-in screen is reachable; registration and content are invitation-only.
    token = request.headers.get("authorization", "").removeprefix("Bearer ").strip() or request.cookies.get("diplomator_access", "")
    from app.security.sessions import authenticated_session
    from app.services.licenses import check_access
    try:
        user, _ = authenticated_session(db, token)
    except (ValueError, TypeError):
        raise HTTPException(401, "Aplicación privada. Entra con una cuenta invitada.")
    if user.role != "superadmin" and not check_access(db, user, app["product"], require_credits=False).ok:
        raise HTTPException(403, "Esta aplicación requiere una invitación de administración.")
