"""Operational pause switches. Pausing never changes accounts, licences or saved work."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import AppSetting


PRODUCT_CODES = (
    "OCR_FACTURAS", "UNIVERSIDAD_ADULTOS", "ESO_ADULTOS", "CAMBRIDGE",
    "DIPLOMATOR", "PROFESOR_PARTICULAR", "HAZLOTU",
)
PAUSE_MESSAGE = "Esta aplicación está pausada temporalmente. Tus datos permanecen guardados; vuelve más tarde."
# Productos retirados del público y del servidor de Hostinger. Siguen visibles en LA TERRAZA como pausados.
# Su pausa es fija: no depende de un ajuste de base de datos y no se puede reanudar desde el panel público.
HIDDEN_PRODUCTS = frozenset({"OCR_FACTURAS", "UNIVERSIDAD_ADULTOS"})


def is_app_paused(db: Session, product_code: str) -> bool:
    if product_code in HIDDEN_PRODUCTS:
        return True
    if product_code not in PRODUCT_CODES:
        return False
    row = db.get(AppSetting, f"app_paused:{product_code}")
    return bool(row and row.value == "1")


def require_app_available(db: Session, product_code: str) -> None:
    if is_app_paused(db, product_code):
        raise HTTPException(status_code=503, detail=PAUSE_MESSAGE, headers={"Retry-After": "3600"})
