"""add ESO Adultos gamification ledger

Revision ID: 0004_eso_gamification
Revises: 0003_google_oauth_drive
Create Date: 2026-09-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_eso_gamification"
down_revision = "0003_google_oauth_drive"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gamification_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("app_key", sa.String(80), nullable=False),
        sa.Column("xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("coins", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "user_id", "app_key", name="uq_gamification_profile_owner_app"),
    )
    op.create_index("ix_gamification_profiles_organization_id", "gamification_profiles", ["organization_id"])
    op.create_index("ix_gamification_profiles_user_id", "gamification_profiles", ["user_id"])
    op.create_index("ix_gamification_profiles_app_key", "gamification_profiles", ["app_key"])

    op.create_table(
        "gamification_reward_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("event_key", sa.String(320), nullable=False),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("source_id", sa.String(220), nullable=False),
        sa.Column("xp_awarded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("coins_awarded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("event_metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["gamification_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_id", "event_key", name="uq_gamification_reward_event"),
    )
    op.create_index("ix_gamification_reward_events_profile_id", "gamification_reward_events", ["profile_id"])
    op.create_index("ix_gamification_reward_events_event_type", "gamification_reward_events", ["event_type"])

    op.create_table(
        "gamification_achievements",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("achievement_id", sa.String(120), nullable=False),
        sa.Column("xp_awarded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("coins_awarded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["gamification_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_id", "achievement_id", name="uq_gamification_achievement"),
    )
    op.create_index("ix_gamification_achievements_profile_id", "gamification_achievements", ["profile_id"])


def downgrade() -> None:
    op.drop_index("ix_gamification_achievements_profile_id", table_name="gamification_achievements")
    op.drop_table("gamification_achievements")
    op.drop_index("ix_gamification_reward_events_event_type", table_name="gamification_reward_events")
    op.drop_index("ix_gamification_reward_events_profile_id", table_name="gamification_reward_events")
    op.drop_table("gamification_reward_events")
    op.drop_index("ix_gamification_profiles_app_key", table_name="gamification_profiles")
    op.drop_index("ix_gamification_profiles_user_id", table_name="gamification_profiles")
    op.drop_index("ix_gamification_profiles_organization_id", table_name="gamification_profiles")
    op.drop_table("gamification_profiles")
