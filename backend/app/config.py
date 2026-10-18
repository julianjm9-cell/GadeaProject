from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore", hide_input_in_errors=True)

    app_name: str = "Apps Suite"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://educa_suite:educa_suite@postgres:5432/educa_suite"
    jwt_secret: str = Field(default="change-me-in-.env", min_length=16)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    cors_origins: str = "http://127.0.0.1:8890,http://localhost:8890,http://127.0.0.1:5174,http://localhost:5174"
    cookie_secure: bool = False
    public_base_url: str = "http://127.0.0.1:8890"
    allowed_hosts: str = "localhost,127.0.0.1,testserver,backend,educame.tech,www.educame.tech"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_starttls: bool = True
    smtp_ssl: bool = False
    oauth_token_encryption_key: str = ""
    max_state_bytes: int = Field(default=8_000_000, ge=100_000, le=30_000_000)

    ai_provider: str = "groq"
    openai_api_key: str = ""
    groq_api_key: str = ""
    gemini_api_key: str = ""
    ocr_provider: str = ""
    ocr_model: str = ""
    ocr_api_key: str = ""
    pixabay_api_key: str = ""
    openai_chat_url: AnyHttpUrl = "https://api.openai.com/v1/chat/completions"
    openai_transcribe_url: AnyHttpUrl = "https://api.openai.com/v1/audio/transcriptions"
    groq_chat_url: AnyHttpUrl = "https://api.groq.com/openai/v1/chat/completions"
    groq_transcribe_url: AnyHttpUrl = "https://api.groq.com/openai/v1/audio/transcriptions"
    gemini_chat_url: AnyHttpUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    chat_model: str = "openai/gpt-oss-120b"
    transcribe_model: str = "whisper-large-v3-turbo"
    max_prompt_chars: int = 24000
    max_output_tokens: int = 3200
    max_vocab: int = 3
    profile_chars: int = 420
    profesor_generation_max_concurrent: int = Field(default=3, ge=1, le=20)
    ai_model_prices_json: str = "{}"
    ai_monthly_budget_usd: float = Field(default=0, ge=0)

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://127.0.0.1:8890/auth/google/callback"
    google_signup_license_days: int = 365
    google_signup_usage_limit: int = 300
    eso_signup_enabled: bool = True
    eso_signup_credits: int = Field(default=100, ge=1)
    eso_signup_days: int = Field(default=365, ge=1)
    profesor_signup_enabled: bool = True
    profesor_signup_credits: int = Field(default=100, ge=1)
    profesor_signup_days: int = Field(default=365, ge=1)
    profesor_signup_plan: Literal["PROFESOR_FREE", "PROFESOR_PREMIUM"] = "PROFESOR_FREE"

    bootstrap_superadmin_email: str = ""
    bootstrap_superadmin_password: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.environment.lower() not in {"prod", "production"}:
            return self
        local_markers = ("localhost", "127.0.0.1")
        if any(marker in self.cors_origins.lower() for marker in local_markers):
            raise ValueError("CORS_ORIGINS debe usar dominios reales en produccion.")
        if any(marker in self.google_redirect_uri.lower() for marker in local_markers):
            raise ValueError("GOOGLE_REDIRECT_URI debe usar el dominio publico en produccion.")
        if not self.cookie_secure:
            raise ValueError("COOKIE_SECURE debe ser true en produccion.")
        if self.jwt_secret == "change-me-in-.env" or len(self.jwt_secret.encode()) < 32:
            raise ValueError("JWT_SECRET debe cambiarse en produccion.")
        if not self.public_base_url.startswith("https://"):
            raise ValueError("PUBLIC_BASE_URL debe usar HTTPS en producción.")
        if "*" in self.allowed_hosts:
            raise ValueError("ALLOWED_HOSTS debe enumerar dominios concretos.")
        if self.smtp_host and not (self.smtp_ssl or self.smtp_starttls):
            raise ValueError("El correo saliente requiere TLS en producción.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
