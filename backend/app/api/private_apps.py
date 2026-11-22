import base64
import copy
import hashlib
import json
import secrets
import unicodedata
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_superadmin
from app.config import get_settings
from app.database.session import get_db
from app.models import AppSetting, User
from app.models.private_apps import PrivateAppAccount, PrivateAppSession, PrivateAppProgress
from app.security.passwords import hash_password, verify_password
from app.security.sessions import utc
from app.services.app_registry import app_definition, registry, save_app
from app.services.app_availability import PAUSE_MESSAGE
from app.services.audit import audit
from app.services import gadeos

router = APIRouter(tags=["private-apps"])
PROJECT_ROOT = Path(__file__).resolve().parents[3]
STATIC = Path(__file__).resolve().parents[1] / "static"
IMAGE_ROOT = (Path("/app/data/documents") if Path("/app").exists() else PROJECT_ROOT / "backend/data/documents") / "private-apps/gadeos"
DUMMY_PASSWORD = hash_password(secrets.token_urlsafe(24))


def active_app(db, app_id):
    app = app_definition(db, app_id)
    if app["template"] not in {"arena", "workspace"}:
        raise HTTPException(404, "Esta aplicación utiliza sus cuentas habituales.")
    if app["state"] == "pausada":
        raise HTTPException(503, PAUSE_MESSAGE, headers={"Retry-After": "3600"})
    return app


def member(app_id: str, request: Request, db: Session = Depends(get_db)):
    active_app(db, app_id)
    token = request.cookies.get("educame_private_" + app_id, "")
    session = db.get(PrivateAppSession, hashlib.sha256(token.encode()).hexdigest()) if token else None
    account = db.get(PrivateAppAccount, session.account_id) if session else None
    if not session or utc(session.expires_at) <= datetime.now(timezone.utc) or not account or not account.active or account.app_id != app_id:
        raise HTTPException(401, "Introduce tu nombre de tributo y contraseña para entrar.")
    return account


def name_key(name):
    key = unicodedata.normalize("NFKC", name).strip().casefold()
    if not 2 <= len(key) <= 100:
        raise HTTPException(422, "El nombre normalizado debe tener entre 2 y 100 caracteres.")
    return key


class AppWrite(BaseModel):
    revision: int = Field(ge=0)
    id: str = Field(max_length=50)
    state: str
    name: str | None = Field(default=None, max_length=100)
    access_password: str | None = Field(default=None, max_length=72)


class AccountCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=8, max_length=72)


class AccountPatch(BaseModel):
    revision: int = Field(ge=0)
    name: str | None = Field(default=None, min_length=2, max_length=80)
    password: str | None = Field(default=None, min_length=8, max_length=72)
    active: bool | None = None


class GameAction(BaseModel):
    revision: int = Field(ge=0)
    request_id: UUID


class StationAnswer(GameAction):
    station: int = Field(ge=1, le=gadeos.STATION_COUNT)
    campaign_revision: int = Field(ge=0)
    answer: str = Field(max_length=100)


class BattleAction(GameAction):
    action: str = Field(pattern="^(attack|guard|focus)$")
    card: int | None = Field(default=None, ge=1, le=gadeos.STATION_COUNT)


class WorkspaceNote(GameAction):
    text: str = Field(max_length=5000)


@router.get("/admin/apps")
def apps_list(_: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    return registry(db)


@router.post("/admin/apps", status_code=201)
def app_create(payload: AppWrite, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    app = save_app(db, payload.model_dump(), create=True)
    audit(db, actor=actor, organization_id=actor.organization_id, action="managed_app_created", entity_type="managed_app", entity_id=app["id"], metadata={"state": app["state"]})
    db.commit()
    return registry(db)


@router.patch("/admin/apps/{app_id}")
def app_patch(app_id: str, payload: AppWrite, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    if payload.id != app_id:
        raise HTTPException(422, "La aplicación no coincide.")
    app = save_app(db, payload.model_dump())
    audit(db, actor=actor, organization_id=actor.organization_id, action="managed_app_access_changed", entity_type="managed_app", entity_id=app_id, metadata={"state": payload.state})
    db.commit()
    return registry(db)


def admin_account(account):
    return {"id": str(account.id), "name": account.name, "active": account.active, "revision": account.revision, "created_at": account.created_at.isoformat()}


@router.get("/admin/apps/{app_id}/accounts")
def accounts(app_id: str, _: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    app_definition(db, app_id)
    rows = db.scalars(select(PrivateAppAccount).where(PrivateAppAccount.app_id == app_id).order_by(PrivateAppAccount.created_at)).all()
    return {"station_count": gadeos.STATION_COUNT if app_id == "gadeos" else None, "accounts": [{**admin_account(row), "completed": (db.get(PrivateAppProgress, row.id).data or {}).get("completed", 0)} for row in rows]}


@router.post("/admin/apps/{app_id}/accounts", status_code=201)
def create_account(app_id: str, payload: AccountCreate, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    app = app_definition(db, app_id)
    if app["template"] not in {"arena", "workspace"} or len(payload.password.encode()) > 72 or len(payload.name.strip()) < 2 or any(ord(c) < 32 for c in payload.name):
        raise HTTPException(422, "Revisa el nombre, la contraseña y la aplicación.")
    account = PrivateAppAccount(app_id=app_id, name=payload.name.strip(), normalized_name=name_key(payload.name), password_hash=hash_password(payload.password))
    db.add(account)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe un tributo con ese nombre.")
    db.add(PrivateAppProgress(account_id=account.id, data={"completed": 0}))
    audit(db, actor=actor, organization_id=actor.organization_id, action="private_app_account_created", entity_type="private_app_account", entity_id=str(account.id), metadata={"app": app_id})
    db.commit()
    return admin_account(account)


@router.patch("/admin/apps/{app_id}/accounts/{account_id}")
def patch_account(app_id: str, account_id: UUID, payload: AccountPatch, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    account = db.get(PrivateAppAccount, account_id)
    if not account or account.app_id != app_id:
        raise HTTPException(404, "Tributo no encontrado.")
    if payload.revision != account.revision:
        raise HTTPException(409, "La cuenta ha cambiado. Actualiza antes de guardar.")
    changes = {"revision": account.revision + 1}
    if payload.name is not None:
        if len(payload.name.strip()) < 2 or any(ord(c) < 32 for c in payload.name):
            raise HTTPException(422, "Revisa el nombre del tributo.")
        changes.update(name=payload.name.strip(), normalized_name=name_key(payload.name))
    if payload.password is not None:
        if len(payload.password.encode()) > 72:
            raise HTTPException(422, "La contraseña supera los 72 bytes.")
        changes["password_hash"] = hash_password(payload.password)
    if payload.active is not None:
        changes["active"] = payload.active
    try:
        result = db.execute(update(PrivateAppAccount).where(PrivateAppAccount.id == account.id, PrivateAppAccount.revision == payload.revision).values(**changes))
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe un tributo con ese nombre.")
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Otra edición de la cuenta llegó antes.")
    if payload.password is not None or payload.active is False:
        db.execute(delete(PrivateAppSession).where(PrivateAppSession.account_id == account.id))
    audit(db, actor=actor, organization_id=actor.organization_id, action="private_app_account_updated", entity_type="private_app_account", entity_id=str(account.id), metadata={"app": app_id, "password_reset": payload.password is not None})
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe un tributo con ese nombre.")
    return admin_account(account)


@router.get("/admin/apps/gadeos/campaign")
def campaign_admin(_: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    return gadeos.admin_campaign(gadeos.campaign(db))


@router.put("/admin/apps/gadeos/campaign")
def campaign_save(payload: dict, actor: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    original = db.get(AppSetting, gadeos.CONFIG_KEY)
    current = gadeos.campaign(db)
    data = copy.deepcopy(payload)
    if isinstance(data.get("stations"), list):
        for index, station in enumerate(data["stations"]):
            if not isinstance(station, dict) or index >= len(current["stations"]):
                continue
            previous = current["stations"][index]
            # Minimal two-field editors retain the private card and legacy content.
            if "prompt" not in station or (station.get("title") != previous["title"] and station.get("prompt") == previous["prompt"]):
                station["prompt"] = station.get("title")
            data["stations"][index] = {**previous, **station}
    if isinstance(data.get("planning"), dict):
        if "days" in data["planning"] and data["planning"].get("version") != current["planning"]["version"]:
            raise HTTPException(409, "El planning se ha actualizado. Recarga el editor antes de guardar.")
        data["planning"] = {**current["planning"], **data["planning"]}
    clean = gadeos.validate_campaign(data)
    if "planning" not in payload:
        clean["planning"] = current["planning"]
    if "media" not in payload:
        clean["media"] = current["media"]  # Older editors must preserve the private poster and guide.
    elif isinstance(payload["media"], dict) and "envelope" not in payload["media"]:
        clean["media"]["envelope"] = current["media"].get("envelope")
    for station, previous in zip(clean["stations"], current["stations"]):
        if "legacy_challenge" in previous:
            station["legacy_challenge"] = previous["legacy_challenge"]
    if type(payload.get("revision")) is not int or payload["revision"] != current["revision"]:
        raise HTTPException(409, "El recorrido cambió. Actualiza antes de guardar.")
    clean["section_access"] = gadeos.update_section_access(current["section_access"], payload.get("section_access", {}))
    clean["revision"] = current["revision"] + 1
    value = json.dumps(clean, ensure_ascii=False)
    if original:
        result = db.execute(update(AppSetting).where(AppSetting.key == gadeos.CONFIG_KEY, AppSetting.value == original.value).values(value=value))
        if result.rowcount != 1:
            raise HTTPException(409, "Otra edición llegó antes. Actualiza el recorrido.")
    else:
        db.add(AppSetting(key=gadeos.CONFIG_KEY, value=value))
    audit(db, actor=actor, organization_id=actor.organization_id, action="gadeos_campaign_updated", entity_type="managed_app", entity_id="gadeos", metadata={"revision": clean["revision"]})
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Otra edición llegó antes. Actualiza el recorrido.")
    return gadeos.admin_campaign(clean)


@router.post("/admin/apps/gadeos/images", status_code=201)
def campaign_image(payload: dict, _: User = Depends(require_superadmin)):
    encoded = payload.get("data", "")
    if not isinstance(encoded, str) or len(encoded) > 7_000_000:
        raise HTTPException(422, "La imagen debe pesar menos de 5 MB.")
    try:
        raw = base64.b64decode(encoded.split(",", 1)[-1], validate=True)
        if len(raw) > 5_000_000:
            raise ValueError()
        with Image.open(BytesIO(raw)) as source:
            if source.width * source.height > 16_000_000:
                raise ValueError()
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((1200, 1600))
            IMAGE_ROOT.mkdir(parents=True, exist_ok=True)
            filename = uuid4().hex + ".webp"
            image.save(IMAGE_ROOT / filename, "WEBP", quality=88)
    except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError):
        raise HTTPException(422, "No se pudo leer la imagen. Usa PNG, JPG o WebP.")
    return {"url": "/api/private-apps/gadeos/images/" + filename}


@router.post("/api/private-apps/{app_id}/login")
def private_login(app_id: str, payload: AccountCreate, request: Request, response: Response, db: Session = Depends(get_db)):
    active_app(db, app_id)
    from app.api.auth import rate_limit_key
    rate_limit_key("private-login:" + app_id + ":" + (request.client.host if request.client else "unknown"), limit=30)
    account = db.scalar(select(PrivateAppAccount).where(PrivateAppAccount.app_id == app_id, PrivateAppAccount.normalized_name == name_key(payload.name)))
    valid = len(payload.password.encode()) <= 72 and verify_password(payload.password, account.password_hash if account else DUMMY_PASSWORD)
    if not valid or not account or not account.active:
        raise HTTPException(401, "Nombre o contraseña incorrectos.")
    token = secrets.token_urlsafe(32)
    db.execute(delete(PrivateAppSession).where(PrivateAppSession.expires_at < datetime.now(timezone.utc)))
    db.add(PrivateAppSession(id=hashlib.sha256(token.encode()).hexdigest(), account_id=account.id, expires_at=datetime.now(timezone.utc) + timedelta(days=7)))
    db.commit()
    response.set_cookie("educame_private_" + app_id, token, httponly=True, secure=get_settings().cookie_secure, samesite="strict", max_age=604800, path="/")
    return {"ok": True, "name": account.name}


@router.get("/api/private-apps/{app_id}/info")
def app_info(app_id: str, db: Session = Depends(get_db)):
    app = active_app(db, app_id)
    return {"name": app["name"], "registration_enabled": app["state"] == "publica" and app["template"] == "workspace"}


@router.post("/api/private-apps/{app_id}/register", status_code=201)
def workspace_register(app_id: str, payload: AccountCreate, request: Request, db: Session = Depends(get_db)):
    app = active_app(db, app_id)
    if app["state"] != "publica" or app["template"] != "workspace":
        raise HTTPException(403, "Esta aplicación solo admite cuentas creadas por administración.")
    from app.api.auth import rate_limit_key
    rate_limit_key("private-app-register:" + app_id + ":" + (request.client.host if request.client else "unknown"), limit=10)
    if len(payload.password.encode()) > 72 or len(payload.name.strip()) < 2 or any(ord(c) < 32 for c in payload.name):
        raise HTTPException(422, "Revisa el nombre y la contraseña.")
    account = PrivateAppAccount(app_id=app_id, name=payload.name.strip(), normalized_name=name_key(payload.name), password_hash=hash_password(payload.password))
    db.add(account)
    try:
        db.flush()
        db.add(PrivateAppProgress(account_id=account.id, data={}))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe una cuenta con ese nombre. Inicia sesión.")
    return {"ok": True}


@router.post("/api/private-apps/{app_id}/logout")
def private_logout(app_id: str, request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("educame_private_" + app_id, "")
    db.execute(delete(PrivateAppSession).where(PrivateAppSession.id == hashlib.sha256(token.encode()).hexdigest()))
    db.commit()
    response.delete_cookie("educame_private_" + app_id, path="/", secure=get_settings().cookie_secure, httponly=True, samesite="strict")
    return {"ok": True}


@router.get("/api/private-apps/{app_id}/state")
def private_state(app_id: str, account=Depends(member), db: Session = Depends(get_db)):
    if app_id == "gadeos":
        return gadeos.progress_payload(db, account)
    return workspace_state(db, account)


def workspace_state(db, account):
    row = db.get(PrivateAppProgress, account.id)
    return {"account": {"id": str(account.id), "name": account.name}, "app": app_definition(db, account.app_id), "revision": row.revision, "text": (row.data or {}).get("text", "")}


@router.post("/api/private-apps/{app_id}/workspace")
def workspace_note(payload: WorkspaceNote, account=Depends(member), db: Session = Depends(get_db)):
    if app_definition(db, account.app_id)["template"] != "workspace":
        raise HTTPException(404, "Espacio no encontrado.")
    return gadeos.mutate(db, account, payload.revision, payload.request_id, lambda data: data.update(text=payload.text), lambda: workspace_state(db, account))


def arena(account):
    if account.app_id != "gadeos":
        raise HTTPException(404, "Prueba no encontrada.")


@router.post("/api/private-apps/{app_id}/stations/answer")
def station_answer(payload: StationAnswer, account=Depends(member), db: Session = Depends(get_db)):
    arena(account)
    return gadeos.complete_station(db, account, payload)


@router.post("/api/private-apps/{app_id}/battle/start")
def battle_start(payload: GameAction, account=Depends(member), db: Session = Depends(get_db)):
    arena(account)
    return gadeos.start_battle(db, account, payload)


@router.post("/api/private-apps/{app_id}/battle/action")
def battle_action(payload: BattleAction, account=Depends(member), db: Session = Depends(get_db)):
    arena(account)
    return gadeos.battle_turn(db, account, payload)


@router.get("/api/private-apps/{app_id}/images/{filename}")
@router.get("/admin/apps/{app_id}/images/{filename}", dependencies=[Depends(require_superadmin)])
def private_image(app_id: str, filename: str, request: Request, db: Session = Depends(get_db)):
    if len(filename) != 37 or not filename.endswith(".webp") or any(c not in "0123456789abcdef" for c in filename[:-5]) or app_id != "gadeos":
        raise HTTPException(404, "Imagen no encontrada.")
    try:
        account = member(app_id, request, db)
        data = gadeos.progress_payload(db, account)
        media = data["campaign"]["media"]
        permitted = {card["image"] for card in data["cards"] if card["owned"]} | {media["poster"], media.get("envelope")} | {page["image"] for page in media["guide"]}
        if "/api/private-apps/gadeos/images/" + filename not in permitted:
            raise HTTPException(403, "Esta carta todavía no se ha desbloqueado.")
    except HTTPException:
        from app.auth.dependencies import current_user
        header = request.headers.get("authorization", "")
        actor = current_user(request, header[7:] if header.startswith("Bearer ") else None, db)
        if actor.role != "superadmin":
            raise HTTPException(403, "Imagen privada.")
    path = IMAGE_ROOT / filename
    if not path.is_file():
        raise HTTPException(404, "Imagen no encontrada.")
    return FileResponse(path, headers={"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow"})


def app_page(db, app_id):
    app = active_app(db, app_id)
    if app["template"] == "workspace":
        for root in (PROJECT_ROOT / "apps/custom", STATIC / "custom"):
            custom = root / app_id / "index.html"
            if custom.is_file():
                return FileResponse(custom, headers={"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow"})
    source = PROJECT_ROOT / "apps" / ("gadeos" if app["template"] == "arena" else "private-workspace") / "index.html"
    if not source.is_file():
        source = STATIC / ("gadeos" if app["template"] == "arena" else "private-workspace") / "index.html"
    return FileResponse(source, headers={"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow"})


@router.get("/gadeos")
def gadeos_page(db: Session = Depends(get_db)):
    return RedirectResponse(gadeos.PUBLIC_PATH, status_code=308, headers={"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow"})


@router.get("/a/{app_id}")
def workspace_page(app_id: str, db: Session = Depends(get_db)):
    if app_id == "gadeos":
        return gadeos_page(db)
    return app_page(db, app_id)


@router.get("/private-app-assets/{template}/{filename}")
def app_asset(template: str, filename: str):
    if template not in {"gadeos", "private-workspace"} or filename not in {"app.js", "style.css", "arena.svg", "restaurants.js", "leaflet.js", "leaflet.css", "town-map.svg", "journey-town.svg", "leaflet-LICENSE.txt"}:
        raise HTTPException(404, "Archivo no encontrado.")
    source = PROJECT_ROOT / "apps" / template / filename
    if not source.is_file():
        source = STATIC / template / filename
    if not source.is_file():
        raise HTTPException(404, "Archivo no encontrado.")
    return FileResponse(source, headers={"X-Robots-Tag": "noindex, nofollow"})


@router.get("/private-app-assets/gadeos/art/{filename}")
def gadeos_art(filename: str):
    if filename not in {"alliance-hero-v2.webp", "journey-v2.webp", "journey-bus-v2.webp", "refuge-v1.webp", "refuge-v2.webp", "arena-v2.webp", "envelope-v2.webp", "emblem-v2.webp", "title-lockup-v1.webp", "title-lockup-v2.webp"}:
        raise HTTPException(404, "Ilustración no encontrada.")
    source = PROJECT_ROOT / "apps/gadeos/assets" / filename
    if not source.is_file():
        source = STATIC / "gadeos/assets" / filename
    if not source.is_file():
        raise HTTPException(404, "Ilustración no encontrada.")
    return FileResponse(source, media_type="image/webp", headers={"X-Robots-Tag": "noindex, nofollow"})


@router.get("/private-app-assets/custom/{app_id}/{filename:path}")
def custom_asset(app_id: str, filename: str, db: Session = Depends(get_db)):
    app = active_app(db, app_id)
    if app["template"] != "workspace" or Path(filename).suffix.lower() not in {".js", ".css", ".svg", ".png", ".jpg", ".webp", ".woff2"}:
        raise HTTPException(404, "Archivo no encontrado.")
    for root in (PROJECT_ROOT / "apps/custom", STATIC / "custom"):
        base = (root / app_id).resolve()
        source = (base / filename).resolve()
        if source.is_relative_to(base) and source.is_file():
            return FileResponse(source, headers={"X-Robots-Tag": "noindex, nofollow"})
    raise HTTPException(404, "Archivo no encontrado.")
