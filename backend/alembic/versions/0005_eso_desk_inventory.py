"""add ESO Adultos desk inventory

Revision ID: 0005_eso_desk_inventory
Revises: 0004_eso_gamification
Create Date: 2026-09-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_eso_desk_inventory"
down_revision = "0004_eso_gamification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gamification_owned_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.String(120), nullable=False),
        sa.Column("acquired_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["gamification_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_id", "item_id", name="uq_gamification_owned_item"),
    )
    op.create_index("ix_gamification_owned_items_profile_id", "gamification_owned_items", ["profile_id"])
    op.create_table(
        "gamification_equipped_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("item_id", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["gamification_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_id", "category", name="uq_gamification_equipped_category"),
    )
    op.create_index("ix_gamification_equipped_items_profile_id", "gamification_equipped_items", ["profile_id"])
    op.execute("UPDATE gamification_profiles SET schema_version = 2")


def downgrade() -> None:
    op.execute("UPDATE gamification_profiles SET schema_version = 1")
    op.drop_index("ix_gamification_equipped_items_profile_id", table_name="gamification_equipped_items")
    op.drop_table("gamification_equipped_items")
    op.drop_index("ix_gamification_owned_items_profile_id", table_name="gamification_owned_items")
    op.drop_table("gamification_owned_items")
