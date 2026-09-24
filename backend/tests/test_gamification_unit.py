from __future__ import annotations

import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.session import Base
from app.models import Organization, User
from app.services.gamification import award_event, equip_item, level_for_xp, profile_payload, purchase_item, validate_event


class GamificationServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.db = sessionmaker(bind=engine)()
        organization = Organization(name="ESO Test")
        self.db.add(organization)
        self.db.flush()
        self.user = User(
            organization_id=organization.id,
            email="progreso@example.com",
            password_hash="test",
            full_name="Alumna",
        )
        self.db.add(self.user)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()

    def test_level_boundaries(self) -> None:
        self.assertEqual(level_for_xp(0)["level"], 1)
        self.assertEqual(level_for_xp(199)["level"], 1)
        self.assertEqual(level_for_xp(200)["level"], 2)
        self.assertEqual(level_for_xp(3800)["level"], 8)
        self.assertIsNone(level_for_xp(999999)["next_min_xp"])

    def test_lesson_reward_and_achievement_are_idempotent(self) -> None:
        first = award_event(self.db, self.user, "LESSON_COMPLETED", "mat-numeros:lesson:0")
        self.db.commit()
        self.assertTrue(first.awarded)
        self.assertEqual(first.profile.xp, 50)
        self.assertEqual(first.profile.coins, 15)
        self.assertEqual([item["id"] for item in first.unlocked_achievements], ["first_lesson"])

        duplicate = award_event(self.db, self.user, "LESSON_COMPLETED", "mat-numeros:lesson:0")
        self.db.commit()
        self.assertTrue(duplicate.duplicate)
        self.assertEqual(duplicate.profile.xp, 50)
        self.assertEqual(duplicate.profile.coins, 15)

    def test_five_lesson_achievement_is_granted_once(self) -> None:
        for index in range(5):
            award_event(self.db, self.user, "LESSON_COMPLETED", f"mat-topic:lesson:{index}")
            self.db.commit()
        payload = profile_payload(self.db, award_event(self.db, self.user, "LESSON_COMPLETED", "mat-topic:lesson:4").profile)
        self.assertEqual(payload["xp"], 220)
        self.assertEqual(payload["coins"], 55)
        self.assertEqual({item["id"] for item in payload["achievements"]}, {"first_lesson", "five_lessons"})

    def test_invalid_event_does_not_change_balance(self) -> None:
        with self.assertRaises(ValueError):
            validate_event("FREE_COINS", "anything")
        with self.assertRaises(ValueError):
            validate_event("LESSON_COMPLETED", "invalid source with spaces")

    def test_purchase_and_equipment_require_level_balance_and_ownership(self) -> None:
        for index in range(5):
            award_event(self.db, self.user, "LESSON_COMPLETED", f"mat-topic:lesson:{index}")
            self.db.commit()
        award_event(self.db, self.user, "TOPIC_COMPLETED", "mat-topic")
        self.db.commit()

        profile = purchase_item(self.db, self.user, "lamp_warm")
        self.db.commit()
        self.assertEqual(profile.coins, 15)
        equipped = equip_item(self.db, self.user, "lamp_warm")
        self.db.commit()
        payload = profile_payload(self.db, equipped)
        self.assertEqual(payload["equipped_items"]["lamp"], "lamp_warm")

        with self.assertRaisesRegex(ValueError, "ya forma parte"):
            purchase_item(self.db, self.user, "lamp_warm")
        with self.assertRaisesRegex(ValueError, "nivel 5"):
            purchase_item(self.db, self.user, "chair_comfort")
        with self.assertRaisesRegex(ValueError, "adquirir"):
            equip_item(self.db, self.user, "plant_monstera")


if __name__ == "__main__":
    unittest.main()
