"""Neutral public routes keep the collection's name a surprise; account IDs stay stable."""
import copy
import re

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.api import private_apps
from app.database.session import get_db
from app.services import gadeos

router = APIRouter(tags=["chinchon-adventure"])


def member(request: Request, db: Session = Depends(get_db)):
    return private_apps.member("gadeos", request, db)


def public_payload(value):
    result = copy.deepcopy(value)
    if not result["secret_discovered"]:
        # Personal foil packs and card faces may carry the collection's secret logo.
        result["campaign"]["media"] = {"poster": None, "envelope": None, "guide": [], "source": ""}
        for card in result["cards"]:
            card["image"] = None
        def conceal(node):
            if isinstance(node, str):
                return re.sub(r"\bgadeos\b", "la alianza", node, flags=re.IGNORECASE)
            if isinstance(node, list):
                return [conceal(item) for item in node]
            if isinstance(node, dict):
                return {key: conceal(item) for key, item in node.items()}
            return node
        result["campaign"] = conceal(result["campaign"])
        result["cards"] = conceal(result["cards"])
    def neutral_urls(node):
        if isinstance(node, str) and node.startswith("/api/private-apps/gadeos/images/"):
            return gadeos.PUBLIC_API + "/images/" + node.rsplit("/", 1)[-1]
        if isinstance(node, list):
            return [neutral_urls(item) for item in node]
        if isinstance(node, dict):
            return {key: neutral_urls(item) for key, item in node.items()}
        return node
    return neutral_urls(result)


@router.get(gadeos.PUBLIC_PATH)
def entry(db: Session = Depends(get_db)):
    return private_apps.app_page(db, "gadeos")


@router.get("/juegos-del-hambre-chinchon")
def old_entry():
    return RedirectResponse(gadeos.PUBLIC_PATH, status_code=308, headers={"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow"})


@router.get("/aventura-chinchon-assets/{filename:path}", include_in_schema=False)
@router.get(gadeos.PUBLIC_ASSETS + "/{filename:path}")
def asset(filename: str):
    if filename.startswith("art/"):
        return private_apps.gadeos_art(filename.removeprefix("art/"))
    return private_apps.app_asset("gadeos", filename)


@router.get(gadeos.PUBLIC_API + "/companions.png")
def companions(account=Depends(member)):
    for root in (private_apps.PROJECT_ROOT / "apps/gadeos/assets", private_apps.STATIC / "gadeos/assets"):
        source = root / "arena-companions-v1.png"
        if source.is_file():
            return FileResponse(source, media_type="image/png", headers={"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow"})
    raise HTTPException(404, "Ilustración no encontrada.")


@router.post("/api/arena-chinchon/login", include_in_schema=False)
@router.post(gadeos.PUBLIC_API + "/login")
def login(payload: private_apps.AccountCreate, request: Request, response: Response, db: Session = Depends(get_db)):
    return private_apps.private_login("gadeos", payload, request, response, db)


@router.post("/api/arena-chinchon/logout", include_in_schema=False)
@router.post(gadeos.PUBLIC_API + "/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    return private_apps.private_logout("gadeos", request, response, db)


@router.get("/api/arena-chinchon/state", include_in_schema=False)
@router.get(gadeos.PUBLIC_API + "/state")
def state(account=Depends(member), db: Session = Depends(get_db)):
    return public_payload(gadeos.progress_payload(db, account))


@router.post("/api/arena-chinchon/stations/answer", include_in_schema=False)
@router.post(gadeos.PUBLIC_API + "/stations/answer")
def answer(payload: private_apps.StationAnswer, account=Depends(member), db: Session = Depends(get_db)):
    return public_payload(gadeos.complete_station(db, account, payload))


@router.post("/api/arena-chinchon/battle/start", include_in_schema=False)
@router.post(gadeos.PUBLIC_API + "/battle/start")
def start(payload: private_apps.GameAction, account=Depends(member), db: Session = Depends(get_db)):
    return public_payload(gadeos.start_battle(db, account, payload))


@router.post("/api/arena-chinchon/battle/action", include_in_schema=False)
@router.post(gadeos.PUBLIC_API + "/battle/action")
def turn(payload: private_apps.BattleAction, account=Depends(member), db: Session = Depends(get_db)):
    return public_payload(gadeos.battle_turn(db, account, payload))


@router.get("/api/arena-chinchon/images/{filename}", include_in_schema=False)
@router.get(gadeos.PUBLIC_API + "/images/{filename}")
def image(filename: str, request: Request, account=Depends(member), db: Session = Depends(get_db)):
    data = public_payload(gadeos.progress_payload(db, account))
    permitted = {card["image"] for card in data["cards"] if card["owned"]}
    media = data["campaign"]["media"]
    permitted |= {media["poster"], media.get("envelope")} | {page["image"] for page in media["guide"]}
    if gadeos.PUBLIC_API + "/images/" + filename not in permitted:
        raise HTTPException(403, "La imagen todavía no se ha descubierto.")
    return private_apps.private_image("gadeos", filename, request, db)
