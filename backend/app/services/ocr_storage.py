import os
from pathlib import Path


def job_dir(job):
    root = Path(os.environ.get("OCR_DATA_DIR", "/app/data/documents/ocr"))
    return root / str(job.organization_id) / str(job.user_id) / str(job.id)


def model_config(db):
    from app.models import AppSetting
    from app.services.ai_config import app_ai_override
    from app.config import get_settings
    settings = get_settings()
    def value(key):
        row = db.get(AppSetting, key)
        return (row.value if row else "") or ""
    override = app_ai_override(db, "OCR_FACTURAS", "ocr")
    provider = os.environ.get("OCR_PROVIDER", "").strip() or settings.ocr_provider or override.get("provider", "") or value("ocr_provider").strip()
    model = os.environ.get("OCR_MODEL", "").strip() or settings.ocr_model or override.get("model", "") or value("ocr_model").strip()
    key = os.environ.get("OCR_API_KEY", "").strip() or settings.ocr_api_key or value(provider + "_api_key").strip() or os.environ.get(provider.upper() + "_API_KEY", "").strip() or getattr(settings, provider + "_api_key", "")
    if provider not in {"gemini", "openai", "groq", "anthropic"} or not model or not key:
        raise ValueError("Configura proveedor, modelo con visión y clave de OCR en el servidor.")
    return {"api_tipo": provider, "modelo_externo": model, "api_key": key, "vision_enabled": True, "timeout_api_ext": 90, "api_min_interval": 1, "entrenamiento_activo": False}
