"""Server-owned station unlocks, envelopes and turn-based final battle."""
import copy
import json
import unicodedata
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import update

from app.models import AppSetting
from app.models.private_apps import PrivateAppProgress

CONFIG_KEY = "private_campaign:gadeos"


def default_campaign():
    titles = ['A tiempo para el bus', 'La adivinanza', 'Llegada a Chinchón', 'Vuestro refugio', 'El atardecer', 'El banquete', 'El séptimo sobre', 'La última llave']
    cards = ['La partida', 'Ingenio', 'El distrito', 'Refugio', 'Fuego dorado', 'El banquete', 'Complicidad', 'Siempre juntos']
    kinds = ['code'] * 8
    prompts = ['Llega puntual al bus y consigue el código de esta primera parada.',
               'No tiene alas y vuela; no tiene pies y corre. Nunca vuelve atrás. ¿Qué es?',
               'Habéis llegado a Chinchón. Busca el código del siguiente sobre.',
               'Conseguid la habitación y dejad vuestros enseres. Abre el sobre de esta parada.',
               'Buscad vuestro lugar para ver el atardecer y consigue el código de esta estación.',
               'Conseguid la cena. El siguiente sobre os espera en esta parada.',
               'Esta prueba está lista para que el organizador la personalice.',
               'Esta prueba está lista para que el organizador la personalice antes de la batalla final.']
    options = [[] for _ in range(8)]
    solutions = ['ALIANZA', 'TIEMPO', 'CHINCHON', 'REFUGIO', 'HORIZONTE', 'BRINDIS', 'COMPLICIDAD', 'GADEOS']
    return {"revision": 0, "title": "La arena de los recuerdos", "intro": "Un viaje a Chinchón. Ocho sobres. Vuestra propia alianza.",
            "boss": "El centinela de la arena", "ending": "La mejor recompensa es haber recorrido este camino juntos.",
            "stations": [{"number": i + 1, "title": titles[i], "story": "Supera la prueba y abre un sobre de vuestra colección.",
                          "kind": kinds[i], "prompt": prompts[i], "options": options[i], "solution": solutions[i],
                          "clue": "Observa las pistas de esta estación y vuelve a intentarlo.",
                          "card": {"title": cards[i], "description": "Una carta de vuestra alianza para la batalla final.", "image": None}}
                         for i in range(8)]}


def campaign(db):
    row = db.get(AppSetting, CONFIG_KEY)
    return json.loads(row.value) if row else default_campaign()


def validate_campaign(data):
    if not isinstance(data, dict) or not isinstance(data.get("stations"), list) or len(data["stations"]) != 8:
        raise HTTPException(422, "El recorrido debe contener exactamente ocho estaciones.")
    clean = {key: str(data.get(key, ""))[:1500] for key in ("title", "intro", "boss", "ending")}
    clean["stations"] = []
    for index, station in enumerate(data["stations"]):
        if not isinstance(station, dict) or not isinstance(station.get("card", {}), dict):
            raise HTTPException(422, "Revisa los datos de cada estación y carta.")
        kind = station.get("kind")
        options = station.get("options", [])
        solution = station.get("solution")
        if kind not in {"choice", "order", "memory", "code"} or not isinstance(options, list) or len(options) > 12 or any(not isinstance(item, str) or not 1 <= len(item) <= 150 for item in options):
            raise HTTPException(422, "Revisa las opciones y el tipo de prueba.")
        if kind == "choice" and (len(options) < 2 or len(set(options)) != len(options) or solution not in options):
            raise HTTPException(422, "Una decisión necesita opciones distintas y una respuesta correcta.")
        if kind == "order" and (len(options) < 3 or not isinstance(solution, list) or any(not isinstance(item, str) for item in solution) or sorted(options) != sorted(solution) or len(set(options)) != len(options)):
            raise HTTPException(422, "El orden correcto debe incluir una vez cada opción.")
        if kind == "memory" and (len(options) < 4 or any(options.count(option) != 2 for option in options)):
            raise HTTPException(422, "Memoria necesita entre dos y seis parejas de símbolos.")
        if kind == "code" and (not isinstance(solution, str) or not 1 <= len(solution.strip()) <= 100):
            raise HTTPException(422, "Escribe la clave de la estación.")
        card = station.get("card", {})
        clean["stations"].append({"number": index + 1, "kind": kind, "options": options, "solution": solution,
            **{key: str(station.get(key, ""))[:1500] for key in ("title", "story", "prompt", "clue")},
            "card": {"title": str(card.get("title", "Carta de la alianza"))[:80], "description": str(card.get("description", ""))[:500],
                     "image": card.get("image") if isinstance(card.get("image"), str) and card["image"].startswith("/api/private-apps/gadeos/images/") else None}})
    return clean


def public_campaign(config, completed):
    result = {key: config[key] for key in ("revision", "title", "intro", "boss", "ending")}
    result["stations"] = []
    for index, station in enumerate(config["stations"]):
        entry = {"number": index + 1, "title": station["title"], "locked": index > completed, "completed": index < completed}
        if index <= completed:
            entry.update({key: value for key, value in station.items() if key not in {"solution", "card"}})
        result["stations"].append(entry)
    return result


def progress_payload(db, account):
    row = db.get(PrivateAppProgress, account.id)
    data = copy.deepcopy(row.data or {})
    completed = data.get("completed", 0)
    config = campaign(db)
    return {"account": {"id": str(account.id), "name": account.name}, "revision": row.revision, "completed": completed,
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
    if station["kind"] == "memory":
        valid = isinstance(answer, list) and all(type(i) is int for i in answer) and sorted(answer) == list(range(len(station["options"])))
        valid = valid and all(station["options"][answer[i]] == station["options"][answer[i + 1]] for i in range(0, len(answer), 2))
    elif station["kind"] == "order":
        valid = answer == station["solution"]
    elif station["kind"] == "choice":
        valid = isinstance(answer, str) and answer == station["solution"]
    else:
        valid = isinstance(answer, str) and normalized(answer) in [normalized(option) for option in str(station["solution"]).split("|")]
    def apply(data):
        if data.get("completed", 0) != payload.station - 1:
            raise HTTPException(409, "Completa primero la estación anterior. Las estaciones superadas permanecen guardadas.")
        if not valid:
            raise HTTPException(422, station["clue"] or "Revisa las pistas de la prueba e inténtalo de nuevo.")
        data["completed"] = payload.station
    return mutate(db, account, payload.revision, payload.request_id, apply)


INTENTS = ["strike", "feint", "charge"]


def start_battle(db, account, payload):
    def apply(data):
        if data.get("completed") != 8:
            raise HTTPException(403, "La batalla se abre al completar las ocho estaciones.")
        if not data.get("battle") or data["battle"]["state"] != "playing":
            data["battle"] = {"state": "playing", "energy": 28, "boss_energy": 30, "turn": 0, "focus": 0,
                              "used_cards": [], "intent": "strike", "log": "El centinela prepara un ataque. Elige tu estrategia."}
    return mutate(db, account, payload.revision, payload.request_id, apply)


def battle_turn(db, account, payload):
    def apply(data):
        battle = data.get("battle")
        if data.get("completed") != 8 or not battle or battle["state"] != "playing":
            raise HTTPException(409, "Inicia una batalla para jugar este turno.")
        bonus = 0
        if payload.card is not None:
            if payload.card not in range(1, 9) or payload.card in battle["used_cards"]:
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
