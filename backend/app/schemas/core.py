from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ApiOk(BaseModel):
    ok: bool = True


class LoginRequest(BaseModel):
    email: str | None = None
    identifier: str | None = None
    password: str


class TokenResponse(BaseModel):
    ok: bool = True
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    status: str = "active"


class OrganizationPatch(BaseModel):
    name: str | None = None
    status: str | None = None


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    status: str
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    organization_id: UUID
    email: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8)
    full_name: str = ""
    role: str = "user"
    is_active: bool = True


class UserPatch(BaseModel):
    organization_id: UUID | None = None
    email: str | None = Field(default=None, min_length=2, max_length=255)
    password: str | None = Field(default=None, min_length=8)
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class LicenseCreate(BaseModel):
    organization_id: UUID
    product_code: str = "DIPLOMATOR"
    plan: str = "MVP"
    status: str = "active"
    starts_at: datetime
    expires_at: datetime
    usage_limit: int = 300
    legacy_key: str | None = None


class LicensePatch(BaseModel):
    organization_id: UUID | None = None
    product_code: str | None = None
    plan: str | None = None
    status: str | None = None
    starts_at: datetime | None = None
    expires_at: datetime | None = None
    usage_limit: int | None = None
    legacy_key: str | None = None


class LicenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    product_code: str
    plan: str
    status: str
    starts_at: datetime
    expires_at: datetime
    usage_limit: int
    legacy_key: str | None
    created_at: datetime
    updated_at: datetime


class UsageOut(BaseModel):
    id: UUID
    organization_id: UUID
    user_id: UUID
    product_code: str
    model: str
    input_tokens: int
    output_tokens: int
    estimated_cost: float
    created_at: datetime


class AuditOut(BaseModel):
    id: UUID
    actor_user_id: UUID | None
    organization_id: UUID | None
    action: str
    entity_type: str
    entity_id: str
    metadata: dict
    created_at: datetime
