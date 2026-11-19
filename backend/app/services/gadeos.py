"""Server-owned station unlocks, envelopes and turn-based final battle."""
import copy
import json
import re
import unicodedata
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.models import AppSetting
from app.models.private_apps import PrivateAppProgress
from app.security.passwords import hash_password, verify_password

CONFIG_KEY = "private_campaign:gadeos"
SCORE_KEY = "private_score:gadeos"
SECTION_NAMES = {"recorrido": "Recorrido", "batalla": "Batalla final", "restaurantes": "Restaurantes"}
PLANNING_NAMES = {"plan_viernes": "Viernes", "plan_sabado": "Sábado"}
ACCESS_NAMES = {**SECTION_NAMES, **PLANNING_NAMES}
STATION_COUNT = 10
PUBLIC_PATH = "/juegos-del-hambre"
PUBLIC_API = "/api/arena-hambre"
PUBLIC_ASSETS = "/aventura-hambre-assets"


def planning_config(value=None):
    days = [
        {"title": "Viernes 20", "subtitle": "", "activities": [
            {"time": "20:00", "text": "Llegada a Chinchón."},
            {"time": "20:00–22:00", "text": "Misiones."},
            {"time": "23:00", "text": "Batalla final."}]},
        {"title": "Sábado 21", "subtitle": "Descubrir Chinchón", "activities": [
            {"time": "11:00", "text": "Check-out del apartamento."},
            {"time": "11:30", "text": "Desayuno tranquilo en una cafetería del centro."},
            {"time": "12:30", "text": "Subida a la Torre del Reloj y paseo por las calles antiguas."},
            {"time": "13:00", "text": "Mirador de la iglesia, vistas panorámicas y fotos."},
            {"time": "13:30", "text": "Paseo hasta el Castillo de los Condes para verlo desde fuera."},
            {"time": "14:30", "text": "Comida en un restaurante típico de Chinchón."},
            {"time": "16:15", "text": "Última vuelta por la plaza y tiendas tradicionales."},
            {"time": "17:00", "text": "Regreso en el autobús 337 hacia Madrid."}]}
    ]
    for day in days:
        day.setdefault("locked", False)
        for entry in day["activities"]:
            entry.setdefault("locked", False)
    defaults = {"version": 6, "day": "Viernes", "place": "Chinchón", "start": "20:00", "final": "23:00",
                "transport": "Autobús 337 · Salida: Metro Pavones (Línea 9, Madrid)", "days": days}
    if value is None:
        return defaults
    if not isinstance(value, dict):
        raise HTTPException(422, "Revisa el planning del viaje.")
    result = {**defaults, **{key: copy.deepcopy(value[key]) for key in defaults if key in value}}
    version = value.get("version", 1)
    if type(version) is not int or not 1 <= version <= defaults["version"]:
        raise HTTPException(422, "Actualiza el editor del planning.")
    if version < 2:
        old_days = result["days"]
        if isinstance(old_days, list) and len(old_days) == 2 and all(isinstance(day, dict) for day in old_days) and [day.get("title") for day in old_days] == ["Viernes 20", "Sábado 21"]:
            result["days"] = [copy.deepcopy(days[0]), {**old_days[1], "locked": True}]
    result["version"] = defaults["version"]
    if any(not isinstance(result[key], str) or not 1 <= len(result[key].strip()) <= 80 for key in ("day", "place")) or any(not isinstance(result[key], str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", result[key]) for key in ("start", "final")):
        raise HTTPException(422, "Indica el día, el lugar y dos horas válidas para el planning.")
    if not isinstance(result["transport"], str) or len(result["transport"]) > 300 or not isinstance(result["days"], list) or not 1 <= len(result["days"]) <= 7:
        raise HTTPException(422, "Indica el transporte y entre uno y siete días de planning.")
    clean_days = []
    for day in result["days"]:
        if not isinstance(day, dict) or not isinstance(day.get("title"), str) or not 1 <= len(day["title"].strip()) <= 120 or not isinstance(day.get("subtitle"), str) or len(day["subtitle"].strip()) > 120 or not isinstance(day.get("activities"), list) or len(day["activities"]) > 24:
            raise HTTPException(422, "Cada día necesita título y admite hasta veinticuatro actividades.")
        if type(day.get("locked", False)) is not bool:
            raise HTTPException(422, "El bloqueo del día debe ser verdadero o falso.")
        entries = []
        for entry in day["activities"]:
            if not isinstance(entry, dict) or type(entry.get("locked", False)) is not bool or not isinstance(entry.get("time"), str) or len(entry["time"]) > 11 or not isinstance(entry.get("text"), str) or len(entry["text"].strip()) > 500:
                raise HTTPException(422, "Revisa los datos de la actividad y su bloqueo.")
            if not entry.get("locked", False) and (not entry["text"].strip() or (entry["time"] and not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d(?:[–-](?:[01]\d|2[0-3]):[0-5]\d)?", entry["time"]))):
                raise HTTPException(422, "Escribe el texto de la actividad. Si indicas una hora, usa un horario válido.")
            entries.append({"time": entry["time"], "text": entry["text"].strip(), "locked": entry.get("locked", False)})
            if entry.get("unlock_key") == "plan_viernes":
                entries[-1]["unlock_key"] = "plan_viernes"
        clean_days.append({"title": day["title"].strip(), "subtitle": day["subtitle"].strip(), "locked": day.get("locked", False), "activities": entries})
        if day.get("unlock_key") == "plan_sabado":
            clean_days[-1]["unlock_key"] = "plan_sabado"
    if version < 3 and result["transport"].strip() == defaults["transport"] + " → Chinchón":
        result["transport"] = defaults["transport"]
    if version < 4:
        for day in clean_days:
            if day["title"] != "Viernes 20":
                continue
            if version < 3 and day["subtitle"] == "Atardecer, paseo y noche de juegos":
                day["subtitle"] = ""
            day["activities"] = [
                entry for entry in day["activities"]
                if entry["text"].casefold().rstrip(".") not in {
                    "llegada a chinchón, dejar las mochilas en el apartamento",
                    "llegada al pueblo, dejar las mochilas en el apartamento",
                }
            ]
            for entry in day["activities"]:
                if entry["text"].casefold().rstrip(".") == "llegada al piso":
                    entry["text"] = "Llegada al refugio."
    if version < 5:
        for day in clean_days:
            if day["title"] == "Viernes 20" and not any(entry.get("unlock_key") for entry in day["activities"]):
                first_locked = next((entry for entry in day["activities"] if entry["locked"]), None)
                if first_locked is not None:
                    first_locked["unlock_key"] = "plan_viernes"
            if day["title"] == "Sábado 21":
                day["unlock_key"] = "plan_sabado"
    if version < 6:
        result["start"], result["final"] = "20:00", "23:00"
        result["transport"] = defaults["transport"]
        for day in clean_days:
            if day["title"] == "Viernes 20":
                day.update(copy.deepcopy(days[0]))
            day["locked"] = False
            day.pop("unlock_key", None)
            for entry in day["activities"]:
                entry["locked"] = False
                entry.pop("unlock_key", None)
    return {**result, "transport": result["transport"].strip(), "days": clean_days}


def public_planning(value, unlocked=()):
    result = copy.deepcopy(value)
    for day in result.get("days", []):
        if day.get("unlock_key") in unlocked:
            day["locked"] = False
        if day.get("locked"):
            day["subtitle"], day["activities"] = "", []
        else:
            for entry in day["activities"]:
                if entry.get("unlock_key") in unlocked:
                    entry["locked"] = False
                if entry.get("locked"):
                    entry["time"], entry["text"] = "", ""
    return result


def media_config(value=None):
    value = {} if value is None else value
    if not isinstance(value, dict) or not isinstance(value.get("guide", []), list) or len(value.get("guide", [])) > 8:
        raise HTTPException(422, "Revisa el cartel y las páginas de la guía.")
    def image(path):
        if path is None:
            return None
        if not isinstance(path, str) or not re.fullmatch(r"/api/private-apps/gadeos/images/[a-f0-9]{32}\.webp", path):
            raise HTTPException(422, "Usa imágenes privadas subidas a GADEOS.")
        return path
    pages = []
    for page in value.get("guide", []):
        if not isinstance(page, dict) or not isinstance(page.get("title"), str) or not 1 <= len(page["title"]) <= 100 or not page.get("image"):
            raise HTTPException(422, "Cada página necesita título e imagen.")
        text = page.get("text", "")
        if not isinstance(text, str) or len(text) > 6000:
            raise HTTPException(422, "El texto de la guía supera el límite.")
        pages.append({"title": page["title"], "image": image(page["image"]), "text": text})
    source = value.get("source", "")
    if not isinstance(source, str) or (source and not re.fullmatch(r"[a-f0-9]{64}", source)):
        raise HTTPException(422, "La referencia del material no es válida.")
    return {"poster": image(value.get("poster")), "envelope": image(value.get("envelope")), "guide": pages, "source": source}


def default_campaign():
    challenges = [
        ("¿Cuál es el número del autobús que nos llevó?", "337", "La partida"),
        ("No tengo alas, pero vuelo. No tengo voz, pero sueno a peligro. Si el tributo acierta, elijo matar. ¿Qué soy?", "Flecha", "Ingenio"),
        ("¿Cómo se llama nuestro refugio?", "Villa Elisa", "El refugio"),
        ("¿En qué calle está la Torre del Reloj?", "San Esteban Baja", "La torre"),
        ("¿A qué advocación de la Virgen está dedicada la iglesia?", "Asunción", "El mirador"),
        ("¿Con qué apodo se identifica al dueño de la taberna junto al ayuntamiento?", "Arriero", "La taberna"),
        ("¿Cómo se llama el dramaturgo que ya es amigo por segunda vez?", "Lope de Vega", "El teatro"),
        ("¿Qué animal aparece en el escudo del pueblo?", "Cabra", "El escudo"),
        ("", "", "Noveno sobre"),
        ("", "", "Décimo sobre"),
    ]
    return {"revision": 0, "challenge_format": 3, "title": "La arena de los recuerdos", "intro": "Un viaje a Chinchón. Diez pruebas. Vuestra propia alianza.",
            "media": media_config(), "planning": planning_config(),
            "boss": "El centinela de la arena", "ending": "La mejor recompensa es haber recorrido este camino juntos.",
            "stations": [{"number": number, "title": prompt, "story": "",
                          "kind": "code", "prompt": prompt, "options": [], "solution": solution, "clue": "",
                          "card": {"title": card, "description": "Una carta de vuestra alianza para la batalla final.", "image": None}}
                         for number, (prompt, solution, card) in enumerate(challenges, 1)]}


def campaign(db):
    row = db.get(AppSetting, CONFIG_KEY)
    result = json.loads(row.value) if row else default_campaign()
    result["media"] = media_config(result.get("media"))
    result["planning"] = planning_config(result.get("planning"))
    result["section_access"] = {
        key: {"enabled": key == "recorrido" or key in PLANNING_NAMES, "version": 0, "password_hash": None,
              **result.get("section_access", {}).get(key, {})}
        for key in ACCESS_NAMES
    }
    if result.get("challenge_format") != 3:
        defaults = default_campaign()
        for new, previous in zip(defaults["stations"], result["stations"]):
            new["card"] = previous.get("card", new["card"])
            new["legacy_challenge"] = {key: value for key, value in previous.items() if key != "card"}
        result["stations"] = defaults["stations"]
        result["revision"] += 1
        result["challenge_format"] = 3
        if re.fullmatch(r"Un viaje a Chinchón\. (?:Ocho|Nueve) (?:sobres|pruebas)\. Vuestra propia alianza\.", result["intro"]):
            result["intro"] = defaults["intro"]
    return result


def admin_campaign(config):
    return {**config, "section_access": {
        key: {"enabled": access["enabled"], "custom_password": bool(access["password_hash"])}
        for key, access in config["section_access"].items()
    }}


def update_section_access(current, changes):
    if not isinstance(changes, dict) or not changes.keys() <= ACCESS_NAMES.keys():
        raise HTTPException(422, "Revisa los accesos por sección.")
    sections = copy.deepcopy(current)
    for key, change in changes.items():
        if not isinstance(change, dict):
            raise HTTPException(422, "Revisa el acceso de " + ACCESS_NAMES[key] + ".")
        access = sections[key]
        enabled = True if key in PLANNING_NAMES else change.get("enabled", access["enabled"])
        password = change.get("password", "")
        reset = change.get("reset_password", False)
        if type(enabled) is not bool or type(reset) is not bool or not isinstance(password, str):
            raise HTTPException(422, "Revisa el acceso de " + ACCESS_NAMES[key] + ".")
        key_text = normalized(password)
        if password and (not key_text or len(key_text.encode()) > 72 or reset):
            raise HTTPException(422, "Escribe una clave válida o restaura la clave predeterminada.")
        if enabled != access["enabled"] or password or (reset and access["password_hash"]):
            access["version"] += 1
            access["enabled"] = enabled
            if password or reset:
                access["password_hash"] = hash_password(key_text) if password else None
    for key, other in (("plan_viernes", "plan_sabado"), ("plan_sabado", "plan_viernes")):
        change = changes.get(key, {})
        if change.get("password") or change.get("reset_password"):
            password = normalized(change.get("password") or ACCESS_NAMES[key])
            if matches_access_key(other, sections[other], password):
                raise HTTPException(422, "Usa contraseñas distintas para el viernes y el sábado.")
    return sections


def matches_access_key(key, access, password):
    password_hash = access["password_hash"]
    return verify_password(password, password_hash) if password_hash else password == normalized(ACCESS_NAMES[key])


def validate_campaign(data):
    if not isinstance(data, dict) or not isinstance(data.get("stations"), list) or len(data["stations"]) != STATION_COUNT:
        raise HTTPException(422, "El recorrido debe contener exactamente diez pruebas.")
    clean = {key: str(data.get(key, ""))[:1500] for key in ("title", "intro", "boss", "ending")}
    clean["media"] = media_config(data.get("media"))
    clean["planning"] = planning_config(data.get("planning"))
    clean["challenge_format"] = 3
    clean["stations"] = []
    for index, station in enumerate(data["stations"]):
        if not isinstance(station, dict) or not isinstance(station.get("card", {}), dict):
            raise HTTPException(422, "Revisa los datos de cada estación y carta.")
        kind = station.get("kind", "code")
        options = station.get("options", [])
        solution = station.get("solution")
        if kind != "code" or options != []:
            raise HTTPException(422, "Cada estación debe ser una pregunta con una única respuesta escrita.")
        text = station.get("prompt", station.get("title"))
        pending = index >= 8 and text == "" and solution == ""
        if not pending and (not isinstance(solution, str) or not 1 <= len(solution.strip()) <= 100 or "|" in solution):
            raise HTTPException(422, "Escribe una única respuesta correcta para la estación.")
        if not pending and (not isinstance(text, str) or not text.strip() or len(text) > 1500):
            raise HTTPException(422, "Escribe el título o pista de cada prueba.")
        card = station.get("card", {})
        clean["stations"].append({"number": index + 1, "kind": kind, "options": options, "solution": solution,
            **{key: str(station.get(key, ""))[:1500] for key in ("title", "story", "prompt", "clue")},
            "title": text.strip(), "prompt": text.strip(),
            "card": {"title": str(card.get("title", "Carta de la alianza"))[:80], "description": str(card.get("description", ""))[:500],
                     "image": card.get("image") if isinstance(card.get("image"), str) and card["image"].startswith("/api/private-apps/gadeos/images/") else None}})
    return clean


def completed_stations(data):
    return set(data.get("completed_stations", range(1, data.get("completed", 0) + 1)))


def section_status(config, data, key):
    access = config["section_access"][key]
    if get_settings().gadeos_home_only or not access["enabled"]:
        return "disabled"
    completed = completed_stations(data)
    if key == "batalla" and len(completed) < STATION_COUNT:
        return "waiting"
    if key == "restaurantes" and not {1, 2}.issubset(completed):
        return "waiting"
    if has_access(data, key, access):
        return "open"
    return "locked"


def has_access(data, key, access):
    return data.get("section_grants", {}).get(key) == access["version"]


def planning_is_locked(planning, key):
    for day in planning["days"]:
        if day["locked"]:
            if day.get("unlock_key") == key:
                return True
        elif any(entry["locked"] and entry.get("unlock_key") == key for entry in day["activities"]):
            return True
    return False


def require_section(db, account, key, config=None):
    if get_settings().gadeos_home_only:
        raise HTTPException(403, "Por ahora solo está disponible Inicio.")
    config = config if config is not None else campaign(db)
    data = db.get(PrivateAppProgress, account.id).data or {}
    if section_status(config, data, key) != "open":
        raise HTTPException(403, "La sección está bloqueada.")


def unlock_section(db, account, payload):
    config = campaign(db)
    key = payload.section
    access = config["section_access"][key]
    def apply(data):
        if key in PLANNING_NAMES:
            if not planning_is_locked(config["planning"], key):
                raise HTTPException(403, "Este contenido del planning ya está disponible.")
            status = "open" if has_access(data, key, access) else "locked"
        else:
            status = section_status(config, data, key)
        if status == "open":
            return
        if status != "locked":
            raise HTTPException(403, "La sección está bloqueada.")
        password = normalized(payload.password)
        if not password or len(password.encode()) > 72:
            raise HTTPException(403, "La contraseña no es correcta.")
        if not matches_access_key(key, access, password):
            raise HTTPException(403, "La contraseña no es correcta.")
        data.setdefault("section_grants", {})[key] = access["version"]
    return mutate(db, account, payload.revision, payload.request_id, apply)


def station_available(number, station, completed):
    return bool(station["solution"]) and (number == 1 or 1 in completed and (number == 2 or 2 in completed))


def collection_discovered(data, config):
    if data.get("secret_discovered"):
        return True
    if "completed_stations" in data:
        return False
    return any(
        normalized(station.get("legacy_challenge", {}).get("solution")) == "gadeos"
        for station in config["stations"][:data.get("completed", 0)]
    )


def public_campaign(config, completed, route_open, unlocked_planning):
    result = {key: config[key] for key in ("revision", "title", "intro", "boss", "ending")}
    result["media"] = config.get("media", media_config())
    planning = public_planning(config["planning"], unlocked_planning)
    result["planning"] = planning
    result["title"] = without_town_name(result["title"])
    result["intro"] = without_town_name(result["intro"])
    result["stations"] = []
    for number, station in enumerate(config["stations"], 1):
        done = number in completed
        available = route_open and (done or station_available(number, station, completed))
        title = station["title"] or f"Prueba {number}"
        entry = {"number": number, "title": title if available else f"Prueba {number}", "locked": not available,
                 "completed": done, "pending": not done and not station["solution"]}
        if available:
            entry.update({"prompt": title, "kind": "code", "options": []})
        result["stations"].append(entry)
    if route_open and {1, 2}.issubset(completed):
        return result

    result = map_text(result, without_town_name)
    result["planning"] = planning
    return result


def without_town_name(text):
    text = re.sub(r"\ba Chinch[oó]n\b", "al pueblo", text, flags=re.IGNORECASE)
    return re.sub(r"\bChinch[oó]n\b", "el pueblo", text, flags=re.IGNORECASE)


def map_text(value, transform):
    if isinstance(value, str):
        return transform(value)
    if isinstance(value, list):
        return [map_text(item, transform) for item in value]
    if isinstance(value, dict):
        return {key: map_text(item, transform) for key, item in value.items()}
    return value


def progress_payload(db, account):
    row = db.get(PrivateAppProgress, account.id)
    data = copy.deepcopy(row.data or {})
    completed = completed_stations(data)
    config = campaign(db)
    discovered = collection_discovered(data, config)
    home_only = get_settings().gadeos_home_only
    sections = {key: section_status(config, data, key) for key in SECTION_NAMES}
    unlocked_planning = {key for key in PLANNING_NAMES if has_access(data, key, config["section_access"][key])}
    score = battle_score(db.get(AppSetting, SCORE_KEY)) if sections["batalla"] == "open" else None
    return {"account": {"id": str(account.id), "name": account.name}, "revision": row.revision, "completed": len(completed),
            "home_only": home_only, "sections": sections,
            "score": {key: score[key] for key in ("revision", "wins")} if score else None,
            "secret_discovered": discovered, "collection_name": "GADEOS" if discovered else None,
            "cards": [{"id": number, **(station["card"] if number in completed else {"title": f"Sobre {number}", "description": "", "image": None}), "owned": number in completed} for number, station in enumerate(config["stations"], 1)],
            "campaign": public_campaign(config, completed, sections["recorrido"] == "open", unlocked_planning), "battle": data.get("battle"), "victory": data.get("victory", False)}


def mutate(db, account, revision, request_id, action, render=None):
    render = render or (lambda: progress_payload(db, account))
    row = db.get(PrivateAppProgress, account.id)
    data = copy.deepcopy(row.data or {})
    receipt = str(request_id)
    if receipt in data.get("receipts", []):
        return {"ok": True, "reused": True, **render()}
    if row.revision != revision:
        raise HTTPException(409, "Tu progreso cambió en otra pestaña. Lo hemos conservado; actualiza para continuar.")
    action(data)
    data["receipts"] = [*data.get("receipts", []), receipt][-64:]
    changed = db.execute(update(PrivateAppProgress).where(PrivateAppProgress.account_id == account.id, PrivateAppProgress.revision == revision)
                         .values(data=data, revision=revision + 1, updated_at=datetime.now(timezone.utc)))
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Otra respuesta llegó antes. Tu progreso sigue guardado.")
    db.commit()
    db.expire(row)
    return {"ok": True, **render()}


def normalized(value):
    return " ".join("".join(c for c in unicodedata.normalize("NFKD", str(value)) if not unicodedata.combining(c)).casefold().split())


def complete_station(db, account, payload):
    config = campaign(db)
    require_section(db, account, "recorrido", config)
    if payload.campaign_revision != config["revision"]:
        raise HTTPException(409, "La prueba se ha actualizado. Vuelve a abrir la estación.")
    station = config["stations"][payload.station - 1]
    answer = payload.answer
    expected = normalized(station["solution"])
    submitted = normalized(answer)
    valid = submitted == expected or (payload.station == 4 and expected == "san esteban baja" and submitted == "san estaban baja")
    def apply(data):
        completed = completed_stations(data)
        if payload.station in completed:
            raise HTTPException(409, "Esta prueba ya está completada.")
        if not station["solution"]:
            raise HTTPException(409, "Esta prueba aún está pendiente de configurar.")
        if not station_available(payload.station, station, completed):
            raise HTTPException(409, "Completa primero las pruebas del autobús.")
        if not valid:
            raise HTTPException(422, "Esa respuesta no es correcta. Revisa la pista e inténtalo de nuevo.")
        if collection_discovered(data, config) or expected == "gadeos":
            data["secret_discovered"] = True
        completed.add(payload.station)
        data["completed_stations"] = sorted(completed)
        data["completed"] = len(completed)
    return mutate(db, account, payload.revision, payload.request_id, apply)


INTENTS = ["strike", "feint", "charge"]


def battle_score(row):
    return json.loads(row.value) if row else {"revision": 0, "wins": [0, 0], "receipts": []}


def record_win(db, account, payload):
    require_section(db, account, "batalla")
    row = db.get(AppSetting, SCORE_KEY)
    score = battle_score(row)
    receipt = str(payload.request_id)
    if receipt in score["receipts"]:
        return {"ok": True, "reused": True, **progress_payload(db, account)}
    if payload.score_revision != score["revision"]:
        raise HTTPException(409, "El marcador cambió. Revísalo antes de anotar otra victoria.")

    score["wins"][payload.tribute - 1] += 1
    score["revision"] += 1
    score["receipts"] = [*score["receipts"], receipt][-64:]
    value = json.dumps(score)
    if row:
        saved = db.execute(update(AppSetting).where(AppSetting.key == SCORE_KEY, AppSetting.value == row.value).values(value=value))
        if saved.rowcount != 1:
            raise HTTPException(409, "Otra victoria llegó primero. El marcador se ha conservado.")
    else:
        db.add(AppSetting(key=SCORE_KEY, value=value))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Otra victoria llegó primero. El marcador se ha conservado.")
    return {"ok": True, **progress_payload(db, account)}


def start_battle(db, account, payload):
    require_section(db, account, "batalla")
    def apply(data):
        if len(completed_stations(data)) != STATION_COUNT:
            raise HTTPException(403, "La batalla se abre al completar las diez pruebas.")
        if not data.get("battle") or data["battle"]["state"] != "playing":
            data["battle"] = {"state": "playing", "energy": 28, "boss_energy": 30, "turn": 0, "focus": 0,
                              "used_cards": [], "intent": "strike", "log": "El centinela prepara un ataque. Elige tu estrategia."}
    return mutate(db, account, payload.revision, payload.request_id, apply)


def battle_turn(db, account, payload):
    require_section(db, account, "batalla")
    def apply(data):
        battle = data.get("battle")
        if len(completed_stations(data)) != STATION_COUNT or not battle or battle["state"] != "playing":
            raise HTTPException(409, "Inicia una batalla para jugar este turno.")
        bonus = 0
        if payload.card is not None:
            if payload.card not in range(1, STATION_COUNT + 1) or payload.card in battle["used_cards"]:
                raise HTTPException(422, "Esta carta no está disponible en la batalla.")
            battle["used_cards"].append(payload.card)
            bonus = 3
        intent, action = battle["intent"], payload.action
        dealt, taken = 0, 0
        if action == "attack":
            dealt = (8 if intent == "feint" else 4) + battle["focus"] * 2 + bonus
            taken = {"strike": 8, "feint": 1, "charge": 10}[intent]
            battle["focus"] = 0
        elif action == "guard":
            dealt = 2 + bonus
            taken = {"strike": 0, "feint": 2, "charge": 4}[intent]
        else:
            battle["focus"] = min(2, battle["focus"] + 1)
            battle["energy"] = min(28, battle["energy"] + 3 + bonus)
            taken = {"strike": 5, "feint": 2, "charge": 0}[intent]
        battle["boss_energy"] = max(0, battle["boss_energy"] - dealt)
        battle["energy"] = max(0, battle["energy"] - (taken if battle["boss_energy"] else 0))
        battle["turn"] += 1
        battle["state"] = "won" if not battle["boss_energy"] else "lost" if not battle["energy"] or battle["turn"] >= 12 else "playing"
        battle["intent"] = INTENTS[battle["turn"] % 3]
        battle["log"] = f"Has reducido {dealt} de resistencia y perdido {taken if battle['boss_energy'] else 0} de energía."
        if battle["state"] == "won":
            data["victory"] = True
            battle["log"] = "¡Victoria! Vuestra alianza ha conquistado la arena."
    return mutate(db, account, payload.revision, payload.request_id, apply)
