from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    GamificationAchievement,
    GamificationEquippedItem,
    GamificationOwnedItem,
    GamificationProfile,
    GamificationRewardEvent,
    User,
)


APP_KEY = "eso_adultos"
SOURCE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,219}$")

LEVELS = (
    {"level": 1, "name": "Inicio", "min_xp": 0},
    {"level": 2, "name": "Primeros pasos", "min_xp": 200},
    {"level": 3, "name": "Cojo ritmo", "min_xp": 500},
    {"level": 4, "name": "Constancia", "min_xp": 900},
    {"level": 5, "name": "Avanzando", "min_xp": 1400},
    {"level": 6, "name": "Mi espacio", "min_xp": 2000},
    {"level": 7, "name": "Recta final", "min_xp": 2800},
    {"level": 8, "name": "Mi espacio completo", "min_xp": 3800},
)

REWARD_RULES = {
    "LESSON_COMPLETED": {"xp": 30, "coins": 5},
    "EXERCISE_SET_COMPLETED": {"xp": 15, "coins": 3},
    "TEST_PASSED": {"xp": 25, "coins": 5},
    "TOPIC_COMPLETED": {"xp": 100, "coins": 30},
    "SUBJECT_COMPLETED": {"xp": 500, "coins": 100},
    "MOCK_EXAM_COMPLETED": {"xp": 200, "coins": 40},
    "DAILY_SESSION_COMPLETED": {"xp": 50, "coins": 10},
    "WEEKLY_RHYTHM_REACHED": {"xp": 100, "coins": 20},
}

ACHIEVEMENTS = (
    {"id": "first_lesson", "name": "Primera lección", "event_type": "LESSON_COMPLETED", "count": 1, "xp": 20, "coins": 10},
    {"id": "five_lessons", "name": "Cinco lecciones", "event_type": "LESSON_COMPLETED", "count": 5, "xp": 50, "coins": 20},
    {"id": "first_topic", "name": "Primer tema", "event_type": "TOPIC_COMPLETED", "count": 1, "xp": 50, "coins": 20},
    {"id": "first_subject", "name": "Primera asignatura", "event_type": "SUBJECT_COMPLETED", "count": 1, "xp": 100, "coins": 50},
    {"id": "first_mock_exam", "name": "Primer simulacro", "event_type": "MOCK_EXAM_COMPLETED", "count": 1, "xp": 50, "coins": 20},
    {"id": "weekly_rhythm", "name": "Semana constante", "event_type": "WEEKLY_RHYTHM_REACHED", "count": 1, "xp": 50, "coins": 20},
)

DESK_CATALOG = (
    {"id": "desk_basic", "name": "Mesa clara", "category": "desk", "price": 0, "minimum_level": 1, "visual": "desk-light", "is_default": True},
    {"id": "chair_basic", "name": "Silla azul", "category": "chair", "price": 0, "minimum_level": 1, "visual": "chair-blue", "is_default": True},
    {"id": "lamp_basic", "name": "Lámpara de estudio", "category": "lamp", "price": 0, "minimum_level": 1, "visual": "lamp-blue", "is_default": True},
    {"id": "plant_basic", "name": "Planta pequeña", "category": "plant", "price": 0, "minimum_level": 1, "visual": "plant-small", "is_default": True},
    {"id": "desk_oak", "name": "Mesa de roble", "category": "desk", "price": 220, "minimum_level": 4, "visual": "desk-oak", "is_default": False},
    {"id": "chair_comfort", "name": "Silla cómoda", "category": "chair", "price": 250, "minimum_level": 5, "visual": "chair-comfort", "is_default": False},
    {"id": "lamp_warm", "name": "Lámpara cálida", "category": "lamp", "price": 90, "minimum_level": 2, "visual": "lamp-warm", "is_default": False},
    {"id": "plant_monstera", "name": "Planta monstera", "category": "plant", "price": 120, "minimum_level": 3, "visual": "plant-monstera", "is_default": False},
    {"id": "shelf_wood", "name": "Estantería de madera", "category": "shelf", "price": 200, "minimum_level": 3, "visual": "shelf-wood", "is_default": False},
    {"id": "poster_focus", "name": "Póster Constancia", "category": "poster", "price": 80, "minimum_level": 2, "visual": "poster-focus", "is_default": False},
    {"id": "poster_steps", "name": "Póster Un paso más", "category": "poster", "price": 100, "minimum_level": 3, "visual": "poster-steps", "is_default": False},
    {"id": "mug_steps", "name": "Taza especial", "category": "mug", "price": 50, "minimum_level": 2, "visual": "mug-steps", "is_default": False},
    {"id": "plant_olive", "name": "Olivo de escritorio", "category": "plant", "price": 180, "minimum_level": 4, "visual": "plant-olive", "is_default": False},
    {"id": "trophy_first", "name": "Trofeo Primer tema", "category": "trophy", "price": 0, "minimum_level": 2, "visual": "trophy-first", "is_default": False, "unlock_condition": "first_topic"},
)
CATALOG_BY_ID = {item["id"]: item for item in DESK_CATALOG}


@dataclass(frozen=True)
class AwardResult:
    awarded: bool
    duplicate: bool
    event_type: str
    source_id: str
    xp_awarded: int
    coins_awarded: int
    previous_level: int
    unlocked_achievements: tuple[dict, ...]
    profile: GamificationProfile


def level_for_xp(xp: int) -> dict:
    current = LEVELS[0]
    for candidate in LEVELS:
        if xp < candidate["min_xp"]:
            break
        current = candidate
    index = LEVELS.index(current)
    next_level = LEVELS[index + 1] if index + 1 < len(LEVELS) else None
    return {**current, "next_min_xp": next_level["min_xp"] if next_level else None}


def get_or_create_profile(db: Session, user: User, app_key: str = APP_KEY) -> GamificationProfile:
    profile = db.scalar(select(GamificationProfile).where(
        GamificationProfile.organization_id == user.organization_id,
        GamificationProfile.user_id == user.id,
        GamificationProfile.app_key == app_key,
    ))
    if not profile:
        profile = GamificationProfile(organization_id=user.organization_id, user_id=user.id, app_key=app_key)
        db.add(profile)
        db.flush()
    _ensure_default_inventory(db, profile)
    return profile


def _ensure_default_inventory(db: Session, profile: GamificationProfile) -> None:
    owned = set(db.scalars(select(GamificationOwnedItem.item_id).where(GamificationOwnedItem.profile_id == profile.id)).all())
    equipped = {item.category: item for item in db.scalars(select(GamificationEquippedItem).where(GamificationEquippedItem.profile_id == profile.id)).all()}
    for item in DESK_CATALOG:
        if not item.get("is_default"):
            continue
        if item["id"] not in owned:
            db.add(GamificationOwnedItem(profile_id=profile.id, item_id=item["id"]))
        if item["category"] not in equipped:
            db.add(GamificationEquippedItem(profile_id=profile.id, category=item["category"], item_id=item["id"]))
    db.flush()


def profile_payload(db: Session, profile: GamificationProfile) -> dict:
    level = level_for_xp(profile.xp)
    achievements = db.scalars(select(GamificationAchievement).where(
        GamificationAchievement.profile_id == profile.id
    ).order_by(GamificationAchievement.unlocked_at)).all()
    owned = set(db.scalars(select(GamificationOwnedItem.item_id).where(GamificationOwnedItem.profile_id == profile.id)).all())
    equipped = {item.category: item.item_id for item in db.scalars(select(GamificationEquippedItem).where(GamificationEquippedItem.profile_id == profile.id)).all()}
    achievement_ids = {item.achievement_id for item in achievements}
    catalog = []
    for item in DESK_CATALOG:
        unlocked_by_achievement = not item.get("unlock_condition") or item["unlock_condition"] in achievement_ids
        unlocked = level["level"] >= item["minimum_level"] and unlocked_by_achievement
        catalog.append({
            **item,
            "owned": item["id"] in owned,
            "equipped": equipped.get(item["category"]) == item["id"],
            "unlocked": unlocked,
        })
    return {
        "xp": profile.xp,
        "coins": profile.coins,
        "level": level,
        "achievements": [
            {"id": item.achievement_id, "xp_awarded": item.xp_awarded, "coins_awarded": item.coins_awarded, "unlocked_at": item.unlocked_at.isoformat()}
            for item in achievements
        ],
        "owned_items": sorted(owned),
        "equipped_items": equipped,
        "catalog": catalog,
        "schema_version": profile.schema_version,
    }


def public_config() -> dict:
    return {
        "levels": list(LEVELS),
        "rewards": REWARD_RULES,
        "achievements": [{key: value for key, value in item.items() if key != "event_type"} for item in ACHIEVEMENTS],
        "test_pass_percent": 70,
    }


def purchase_item(db: Session, user: User, item_id: str) -> GamificationProfile:
    item = CATALOG_BY_ID.get(str(item_id or "").strip())
    if not item:
        raise ValueError("El objeto no existe.")
    profile = get_or_create_profile(db, user)
    profile = db.scalar(select(GamificationProfile).where(GamificationProfile.id == profile.id).with_for_update())
    if db.scalar(select(GamificationOwnedItem).where(GamificationOwnedItem.profile_id == profile.id, GamificationOwnedItem.item_id == item["id"])):
        raise ValueError("Este objeto ya forma parte de tu inventario.")
    current_level = level_for_xp(profile.xp)["level"]
    if current_level < item["minimum_level"]:
        raise ValueError(f"Necesitas alcanzar el nivel {item['minimum_level']}.")
    if item.get("unlock_condition"):
        unlocked = db.scalar(select(GamificationAchievement).where(
            GamificationAchievement.profile_id == profile.id,
            GamificationAchievement.achievement_id == item["unlock_condition"],
        ))
        if not unlocked:
            raise ValueError("Aún no has conseguido el logro necesario.")
    if profile.coins < item["price"]:
        raise ValueError("No tienes monedas suficientes.")
    profile.coins -= item["price"]
    db.add(GamificationOwnedItem(profile_id=profile.id, item_id=item["id"]))
    db.flush()
    return profile


def equip_item(db: Session, user: User, item_id: str) -> GamificationProfile:
    item = CATALOG_BY_ID.get(str(item_id or "").strip())
    if not item:
        raise ValueError("El objeto no existe.")
    profile = get_or_create_profile(db, user)
    profile = db.scalar(select(GamificationProfile).where(GamificationProfile.id == profile.id).with_for_update())
    owned = db.scalar(select(GamificationOwnedItem).where(
        GamificationOwnedItem.profile_id == profile.id,
        GamificationOwnedItem.item_id == item["id"],
    ))
    if not owned:
        raise ValueError("Debes adquirir el objeto antes de equiparlo.")
    equipped = db.scalar(select(GamificationEquippedItem).where(
        GamificationEquippedItem.profile_id == profile.id,
        GamificationEquippedItem.category == item["category"],
    ))
    if equipped:
        equipped.item_id = item["id"]
    else:
        db.add(GamificationEquippedItem(profile_id=profile.id, category=item["category"], item_id=item["id"]))
    db.flush()
    return profile


def validate_event(event_type: str, source_id: str) -> tuple[str, str]:
    normalized_type = str(event_type or "").strip().upper()
    normalized_source = str(source_id or "").strip()
    if normalized_type not in REWARD_RULES:
        raise ValueError("Tipo de recompensa no permitido.")
    if not SOURCE_ID_PATTERN.fullmatch(normalized_source):
        raise ValueError("Identificador de actividad no válido.")
    return normalized_type, normalized_source


def _unlock_achievements(db: Session, profile: GamificationProfile, event_type: str) -> tuple[dict, ...]:
    unlocked: list[dict] = []
    relevant = [item for item in ACHIEVEMENTS if item["event_type"] == event_type]
    if not relevant:
        return ()
    event_count = db.scalar(select(func.count()).select_from(GamificationRewardEvent).where(
        GamificationRewardEvent.profile_id == profile.id,
        GamificationRewardEvent.event_type == event_type,
    )) or 0
    owned = set(db.scalars(select(GamificationAchievement.achievement_id).where(
        GamificationAchievement.profile_id == profile.id
    )).all())
    for definition in relevant:
        if definition["id"] in owned or event_count < definition["count"]:
            continue
        grant = GamificationAchievement(
            profile_id=profile.id,
            achievement_id=definition["id"],
            xp_awarded=definition["xp"],
            coins_awarded=definition["coins"],
        )
        db.add(grant)
        profile.xp += definition["xp"]
        profile.coins += definition["coins"]
        unlocked.append({key: value for key, value in definition.items() if key != "event_type"})
    return tuple(unlocked)


def award_event(db: Session, user: User, event_type: str, source_id: str, metadata: dict | None = None) -> AwardResult:
    normalized_type, normalized_source = validate_event(event_type, source_id)
    profile = get_or_create_profile(db, user)
    event_key = f"{normalized_type}:{normalized_source}"
    existing = db.scalar(select(GamificationRewardEvent).where(
        GamificationRewardEvent.profile_id == profile.id,
        GamificationRewardEvent.event_key == event_key,
    ))
    previous_level = level_for_xp(profile.xp)["level"]
    if existing:
        return AwardResult(False, True, normalized_type, normalized_source, 0, 0, previous_level, (), profile)
    rule = REWARD_RULES[normalized_type]
    event = GamificationRewardEvent(
        profile_id=profile.id,
        event_key=event_key,
        event_type=normalized_type,
        source_id=normalized_source,
        xp_awarded=rule["xp"],
        coins_awarded=rule["coins"],
        event_metadata=metadata or {},
    )
    db.add(event)
    profile.xp += rule["xp"]
    profile.coins += rule["coins"]
    db.flush()
    achievements = _unlock_achievements(db, profile, normalized_type)
    db.flush()
    return AwardResult(True, False, normalized_type, normalized_source, rule["xp"], rule["coins"], previous_level, achievements, profile)
