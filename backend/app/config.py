from __future__ import annotations

from functools import lru_cache

from pydantic import AnyHttpUrl, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Apps Suite"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://educa_suite:educa_suite@postgres:5432/educa_suite"
    jwt_secret: str = Field(default="change-me-in-.env", min_length=16)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    cors_origins: str = "http://127.0.0.1:8890,http://localhost:8890,http://127.0.0.1:5174,http://localhost:5174"
    cookie_secure: bool = False

    ai_provider: str = "groq"
    openai_api_key: str = ""
    groq_api_key: str = ""
    gemini_api_key: str = ""
    openai_chat_url: AnyHttpUrl = "https://api.openai.com/v1/chat/completions"
    openai_transcribe_url: AnyHttpUrl = "https://api.openai.com/v1/audio/transcriptions"
    groq_chat_url: AnyHttpUrl = "https://api.groq.com/openai/v1/chat/completions"
    groq_transcribe_url: AnyHttpUrl = "https://api.groq.com/openai/v1/audio/transcriptions"
    gemini_chat_url: AnyHttpUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    chat_model: str = "openai/gpt-oss-120b"
    transcribe_model: str = "whisper-large-v3-turbo"
    max_prompt_chars: int = 24000
    max_output_tokens: int = 3200
    max_points: int = 4
    max_vocab: int = 3
    profile_chars: int = 420

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://127.0.0.1:8890/auth/google/callback"
    google_signup_license_days: int = 365
    google_signup_usage_limit: int = 300

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
        if self.jwt_secret == "change-me-in-.env":
            raise ValueError("JWT_SECRET debe cambiarse en produccion.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
