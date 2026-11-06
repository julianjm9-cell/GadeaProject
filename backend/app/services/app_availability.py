"""Operational pause switches. Pausing never changes accounts, licences or saved work."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import AppSetting


PRODUCT_CODES = (
    "OCR_FACTURAS", "UNIVERSIDAD_ADULTOS", "ESO_ADULTOS", "CAMBRIDGE",
    "DIPLOMATOR", "PROFESOR_PARTICULAR", "HAZLOTU",
)
PAUSE_MESSAGE = "Esta aplicación está pausada temporalmente. Tus datos permanecen guardados; vuelve más tarde."


def is_app_paused(db: Session, product_code: str) -> bool:
    if product_code not in PRODUCT_CODES:
        return False
    row = db.get(AppSetting, f"app_paused:{product_code}")
    return bool(row and row.value == "1")


def require_app_available(db: Session, product_code: str) -> None:
    if is_app_paused(db, product_code):
        raise HTTPException(status_code=503, detail=PAUSE_MESSAGE, headers={"Retry-After": "3600"})
