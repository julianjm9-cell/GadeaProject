"""Server-owned station unlocks, envelopes and turn-based final battle."""
import copy
import json
import re
import unicodedata
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import update

from app.models import AppSetting
from app.models.private_apps import PrivateAppProgress

CONFIG_KEY = "private_campaign:gadeos"
STATION_COUNT = 9
PUBLIC_PATH = "/juegos-del-hambre"
PUBLIC_API = "/api/arena-hambre"
PUBLIC_ASSETS = "/aventura-hambre-assets"


def planning_config(value=None):
    days = [
        {"title": "Viernes 20", "subtitle": "Atardecer, paseo y noche de juegos", "activities": [
            {"time": "18:00", "text": "Llegada a Chinchón, dejar las mochilas en el apartamento."},
            {"time": "", "text": "", "locked": True},
            {"time": "21:00", "text": "Llegada al piso."},
            {"time": "22:00", "text": "Batallas Finales de los juegos del hambre."}]},
        {"title": "Sábado 21", "subtitle": "Descubrir Chinchón", "locked": True, "activities": [
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
    defaults = {"version": 2, "day": "Viernes", "place": "Chinchón", "start": "16:00", "final": "22:00",
                "transport": "Autobús 337 · Salida: Metro Pavones (Línea 9, Madrid) → Chinchón", "days": days}
    if value is None:
        return defaults
    if not isinstance(value, dict):
        raise HTTPException(422, "Revisa el planning del viaje.")
    result = {**defaults, **{key: value[key] for key in defaults if key in value}}
    if type(result["version"]) is not int or not 1 <= result["version"] <= 2:
        raise HTTPException(422, "Actualiza el editor del planning.")
    if "version" not in value or value["version"] < 2:
        old_days = result["days"]
        if isinstance(old_days, list) and len(old_days) == 2 and all(isinstance(day, dict) for day in old_days) and [day.get("title") for day in old_days] == ["Viernes 20", "Sábado 21"]:
            result["days"] = [copy.deepcopy(days[0]), {**old_days[1], "locked": True}]
        result["version"] = 2
    if any(not isinstance(result[key], str) or not 1 <= len(result[key].strip()) <= 80 for key in ("day", "place")) or any(not isinstance(result[key], str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", result[key]) for key in ("start", "final")):
        raise HTTPException(422, "Indica el día, el lugar y dos horas válidas para el planning.")
    if not isinstance(result["transport"], str) or len(result["transport"]) > 300 or not isinstance(result["days"], list) or not 1 <= len(result["days"]) <= 7:
        raise HTTPException(422, "Indica el transporte y entre uno y siete días de planning.")
    clean_days = []
    for day in result["days"]:
        if not isinstance(day, dict) or any(not isinstance(day.get(key), str) or not 1 <= len(day[key].strip()) <= 120 for key in ("title", "subtitle")) or not isinstance(day.get("activities"), list) or not 1 <= len(day["activities"]) <= 24:
            raise HTTPException(422, "Cada día necesita título, descripción y entre una y veinticuatro actividades.")
        if type(day.get("locked", False)) is not bool:
            raise HTTPException(422, "El bloqueo del día debe ser verdadero o falso.")
        entries = []
        for entry in day["activities"]:
            if not isinstance(entry, dict) or type(entry.get("locked", False)) is not bool or not isinstance(entry.get("time"), str) or len(entry["time"]) > 11 or not isinstance(entry.get("text"), str) or len(entry["text"].strip()) > 500:
                raise HTTPException(422, "Revisa los datos de la actividad y su bloqueo.")
            if not entry.get("locked", False) and (not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d(?:[–-](?:[01]\d|2[0-3]):[0-5]\d)?", entry["time"]) or not entry["text"].strip()):
                raise HTTPException(422, "Cada actividad visible necesita una hora o intervalo válido y un texto.")
            entries.append({"time": entry["time"], "text": entry["text"].strip(), "locked": entry.get("locked", False)})
        clean_days.append({"title": day["title"].strip(), "subtitle": day["subtitle"].strip(), "locked": day.get("locked", False), "activities": entries})
    return {**result, "transport": result["transport"].strip(), "days": clean_days}


def public_planning(value):
    result = copy.deepcopy(value)
    for day in result.get("days", []):
        if day.get("locked"):
            day["subtitle"], day["activities"] = "", []
        else:
            for entry in day["activities"]:
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
    titles = ['A tiempo para el bus', 'La adivinanza', 'Llegada a Chinchón', 'Vuestro refugio', 'El atardecer', 'El banquete', 'El séptimo sobre', 'La última llave', 'La novena alianza']
    cards = ['La partida', 'Ingenio', 'El distrito', 'Refugio', 'Fuego dorado', 'El banquete', 'Complicidad', 'Siempre juntos', 'La novena alianza']
    prompts = ['¿Qué palabra de siete letras nombra vuestro pacto como tributos? Empieza por ALI.',
               'No tiene alas y vuela; no tiene pies y corre. Nunca vuelve atrás. ¿Qué es?',
               '¿Cómo se llama el pueblo al que habéis llegado?',
               '¿Qué palabra de siete letras nombra un lugar que os protege? Empieza por REF.',
               '¿Qué línea parece unir el cielo y la tierra al mirar el atardecer?',
               '¿Cómo se llama el gesto de chocar las copas para celebrar? Empieza por BRI.',
               '¿Qué palabra secreta aparece en el séptimo sobre?',
               '¿Cómo se llama vuestra colección de cartas?',
               'Completa la frase «Siempre ____».']
    solutions = ['ALIANZA', 'TIEMPO', 'CHINCHON', 'REFUGIO', 'HORIZONTE', 'BRINDIS', 'COMPLICIDAD', 'GADEOS', 'JUNTOS']
    prompts = [title + '\n' + prompt for title, prompt in zip(titles, prompts)]
    return {"revision": 0, "challenge_format": 2, "title": "La arena de los recuerdos", "intro": "Un viaje a Chinchón. Nueve pruebas. Vuestra propia alianza.",
            "media": media_config(), "planning": planning_config(),
            "boss": "El centinela de la arena", "ending": "La mejor recompensa es haber recorrido este camino juntos.",
            "stations": [{"number": i + 1, "title": prompts[i], "story": "",
                          "kind": "code", "prompt": prompts[i], "options": [], "solution": solutions[i], "clue": "",
                          "card": {"title": cards[i], "description": "Una carta de vuestra alianza para la batalla final.", "image": None}}
                         for i in range(STATION_COUNT)]}


def campaign(db):
    row = db.get(AppSetting, CONFIG_KEY)
    result = json.loads(row.value) if row else default_campaign()
    result["media"] = media_config(result.get("media"))
    result["planning"] = planning_config(result.get("planning"))
    # Preserve old challenges privately while presenting only one-answer questions.
    defaults = default_campaign()["stations"]
    if len(result["stations"]) == STATION_COUNT - 1:
        result["stations"].append(copy.deepcopy(defaults[-1]))
    if result.get("intro") in {"Un viaje a Chinchón. Ocho sobres. Vuestra propia alianza.", "Un viaje a Chinchón. Nueve sobres. Vuestra propia alianza."}:
        result["intro"] = default_campaign()["intro"]
    old_prompts = ['Llega puntual al bus y consigue el código de esta primera parada.', None,
                   'Habéis llegado a Chinchón. Busca el código del siguiente sobre.',
                   'Conseguid la habitación y dejad vuestros enseres. Abre el sobre de esta parada.',
                   'Buscad vuestro lugar para ver el atardecer y consigue el código de esta estación.',
                   'Conseguid la cena. El siguiente sobre os espera en esta parada.',
                   'Esta prueba está lista para que el organizador la personalice.',
                   'Esta prueba está lista para que el organizador la personalice antes de la batalla final.', None]
    for index, station in enumerate(result["stations"]):
        if station.get("kind") != "code":
            station.setdefault("legacy_challenge", {key: copy.deepcopy(station.get(key)) for key in ("kind", "prompt", "options", "solution")})
            if station.get("kind") != "choice":
                station["prompt"], station["solution"] = defaults[index]["prompt"], defaults[index]["solution"]
            station["kind"], station["options"] = "code", []
        if station.get("prompt") == old_prompts[index]:
            station["prompt"] = defaults[index]["prompt"]
        if isinstance(station.get("solution"), str) and "|" in station["solution"]:
            station.setdefault("legacy_challenge", {key: copy.deepcopy(station.get(key)) for key in ("kind", "prompt", "options", "solution")})
            station["solution"] = station["solution"].split("|")[0].strip()
        if result.get("challenge_format") != 2:
            # Collapse old title/question fields without dropping a personalised clue.
            title, prompt = station.get("title", "").strip(), station.get("prompt", "").strip()
            station["title"] = "\n".join(dict.fromkeys(line.strip() for text in (title, prompt) for line in text.splitlines() if line.strip()))
        station["prompt"] = station["title"]
    result["challenge_format"] = 2
    return result


def validate_campaign(data):
    if not isinstance(data, dict) or not isinstance(data.get("stations"), list) or len(data["stations"]) != STATION_COUNT:
        raise HTTPException(422, "El recorrido debe contener exactamente nueve pruebas.")
    clean = {key: str(data.get(key, ""))[:1500] for key in ("title", "intro", "boss", "ending")}
    clean["media"] = media_config(data.get("media"))
    clean["planning"] = planning_config(data.get("planning"))
    clean["challenge_format"] = 2
    clean["stations"] = []
    for index, station in enumerate(data["stations"]):
        if not isinstance(station, dict) or not isinstance(station.get("card", {}), dict):
            raise HTTPException(422, "Revisa los datos de cada estación y carta.")
        kind = station.get("kind", "code")
        options = station.get("options", [])
        solution = station.get("solution")
        if kind != "code" or options != []:
            raise HTTPException(422, "Cada estación debe ser una pregunta con una única respuesta escrita.")
        if not isinstance(solution, str) or not 1 <= len(solution.strip()) <= 100 or "|" in solution:
            raise HTTPException(422, "Escribe una única respuesta correcta para la estación.")
        text = station.get("prompt", station.get("title"))
        if not isinstance(text, str) or not text.strip() or len(text) > 1500:
            raise HTTPException(422, "Escribe el título o pista de cada prueba.")
        card = station.get("card", {})
        clean["stations"].append({"number": index + 1, "kind": kind, "options": options, "solution": solution,
            **{key: str(station.get(key, ""))[:1500] for key in ("title", "story", "prompt", "clue")},
            "title": text.strip(), "prompt": text.strip(),
            "card": {"title": str(card.get("title", "Carta de la alianza"))[:80], "description": str(card.get("description", ""))[:500],
                     "image": card.get("image") if isinstance(card.get("image"), str) and card["image"].startswith("/api/private-apps/gadeos/images/") else None}})
    return clean


def public_campaign(config, completed):
    result = {key: config[key] for key in ("revision", "title", "intro", "boss", "ending")}
    result["media"] = config.get("media", media_config())
    result["planning"] = public_planning(config.get("planning", planning_config()))
    result["stations"] = []
    for index, station in enumerate(config["stations"]):
        entry = {"number": index + 1, "title": station["title"] if index <= completed else f"Prueba {index + 1}", "locked": index > completed, "completed": index < completed}
        if index <= completed:
            entry.update({"prompt": station["title"], "kind": "code", "options": []})
        result["stations"].append(entry)
    return result


def progress_payload(db, account):
    row = db.get(PrivateAppProgress, account.id)
    data = copy.deepcopy(row.data or {})
    completed = data.get("completed", 0)
    config = campaign(db)
    discovered = bool(data.get("secret_discovered")) or any(index < completed and normalized(station["solution"]) == "gadeos" for index, station in enumerate(config["stations"]))
    return {"account": {"id": str(account.id), "name": account.name}, "revision": row.revision, "completed": completed,
            "secret_discovered": discovered, "collection_name": "GADEOS" if discovered else None,
            "cards": [{"id": i + 1, **(station["card"] if i < completed else {"title": "Sobre " + str(i + 1), "description": "", "image": None}), "owned": i < completed} for i, station in enumerate(config["stations"])],
            "campaign": public_campaign(config, completed), "battle": data.get("battle"), "victory": data.get("victory", False)}


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
    if payload.campaign_revision != config["revision"]:
        raise HTTPException(409, "La prueba se ha actualizado. Vuelve a abrir la estación.")
    station = config["stations"][payload.station - 1]
    answer = payload.answer
    valid = isinstance(answer, str) and normalized(answer) == normalized(str(station["solution"]).split("|")[0])
    def apply(data):
        if data.get("completed", 0) != payload.station - 1:
            raise HTTPException(409, "Completa primero la estación anterior. Las estaciones superadas permanecen guardadas.")
        if not valid:
            raise HTTPException(422, "Esa respuesta no es correcta. Revisa la pista e inténtalo de nuevo.")
        data["completed"] = payload.station
        if normalized(station["solution"]) == "gadeos":
            data["secret_discovered"] = True
    return mutate(db, account, payload.revision, payload.request_id, apply)


INTENTS = ["strike", "feint", "charge"]


def start_battle(db, account, payload):
    def apply(data):
        if data.get("completed") != STATION_COUNT:
            raise HTTPException(403, "La batalla se abre al completar las nueve pruebas.")
        if not data.get("battle") or data["battle"]["state"] != "playing":
            data["battle"] = {"state": "playing", "energy": 28, "boss_energy": 30, "turn": 0, "focus": 0,
                              "used_cards": [], "intent": "strike", "log": "El centinela prepara un ataque. Elige tu estrategia."}
    return mutate(db, account, payload.revision, payload.request_id, apply)


def battle_turn(db, account, payload):
    def apply(data):
        battle = data.get("battle")
        if data.get("completed") != STATION_COUNT or not battle or battle["state"] != "playing":
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
