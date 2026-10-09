"""Public, account-free teacher advertisements."""
from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import ipaddress
import re
import secrets
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.auth import rate_limit_key
from app.auth.dependencies import require_superadmin
from app.database.session import get_db
from app.models import ProfesorAd, ProfesorAdReport, User


router = APIRouter(tags=["profesor-ads"])
IMAGE_DIR = Path("/app/data/documents/teacher-ads") if Path("/app").exists() else Path(__file__).resolve().parents[3] / "backend" / "data" / "documents" / "teacher-ads"
MAX_IMAGE_BYTES = 5_000_000
MAX_IMAGE_PIXELS = 12_000_000
CONSENT_VERSION = "2026-10-09"
_ALL_SENDS: list[float] = []
AD_COURSES = {
    "Infantil", *(f"{number}.º Primaria" for number in range(1, 7)),
    *(f"{number}.º ESO" for number in range(1, 5)), "1.º Bachillerato", "2.º Bachillerato",
    "Formación Profesional", "Universidad", "Adultos / Otros",
}
AD_SUBJECTS = {
    "Apoyo escolar", "Matemáticas", "Lengua", "Inglés", "Español para extranjeros",
    "Ciencias Naturales", "Física y Química", "Biología y Geología", "Geografía e Historia",
    "Francés", "Tecnología", "Economía", "Latín y Griego", "Filosofía", "Música", "Dibujo",
    "Informática", "Preparación de exámenes", "Otra materia",
}


class AdInput(BaseModel):
    title: str = Field(default="", max_length=100)
    name: str = Field(default="", max_length=100)  # Older clients.
    course: str = Field(default="", max_length=200)
    subject: str = Field(default="", max_length=300)
    subjects: str = Field(default="", max_length=300)  # Older clients.
    information: str = Field(default="", max_length=1600)
    headline: str = Field(default="", max_length=140)
    levels: str = Field(default="", max_length=200)
    modality: str = Field(default="", max_length=30)
    location: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=1600)
    price: str = Field(default="", max_length=80)
    contact_email: str = Field(default="", max_length=255)
    contact_phone: str = Field(default="", max_length=40)
    image_data: str = Field(default="", max_length=7_000_000)
    remove_image: bool = False
    consent: bool = False
    website: str = Field(default="", max_length=200)  # Invisible form field for simple bots.


class ReportInput(BaseModel):
    reason: str = Field(min_length=10, max_length=500)


def remote_key(request: Request) -> str:
    # Only trust forwarding headers when the immediate peer is the internal proxy.
    peer = request.client.host if request.client else "unknown"
    try:
        trusted_peer = ipaddress.ip_address(peer).is_private or ipaddress.ip_address(peer).is_loopback
    except ValueError:
        trusted_peer = False
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip() if trusted_peer else ""
    value = forwarded or peer
    return re.sub(r"[^a-zA-Z0-9:.]", "", value)[:80] or "unknown"


def limit_public_write(request: Request, action: str, limit: int) -> None:
    from time import monotonic

    now = monotonic()
    _ALL_SENDS[:] = [at for at in _ALL_SENDS if now - at < 300]
    if len(_ALL_SENDS) >= 100:
        raise HTTPException(429, "Demasiados envíos. Vuelve a intentarlo más tarde.")
    rate_limit_key(f"profesor-ads:{action}:{remote_key(request)}", limit=limit)
    _ALL_SENDS.append(now)


def clean_line(value: str, maximum: int) -> str:
    return " ".join(value.strip().split())[:maximum]


def cleaned_input(payload: AdInput) -> dict:
    new_format = bool({"course", "subject"} & payload.model_fields_set)
    name = clean_line(payload.title if "title" in payload.model_fields_set else payload.name, 100)
    subjects = clean_line(payload.subject if new_format else payload.subjects, 300)
    course = clean_line(payload.course if new_format else payload.levels, 200)
    if len(name) < 2 or len(subjects) < 2 or new_format and len(course) < 2:
        raise HTTPException(422, "Escribe un título y selecciona el curso y la materia.")
    if new_format and (course not in AD_COURSES or subjects not in AD_SUBJECTS):
        raise HTTPException(422, "Selecciona un curso y una materia de las listas.")
    email = clean_line(payload.contact_email, 255)
    if email and not re.fullmatch(r"[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+", email):
        raise HTTPException(422, "Revisa el correo de contacto.")
    phone = clean_line(payload.contact_phone, 40)
    digits = re.sub(r"\D", "", phone)
    if phone and (not re.fullmatch(r"[+\d ()-]+", phone) or not 7 <= len(digits) <= 15):
        raise HTTPException(422, "Revisa el teléfono de contacto.")
    modality = clean_line(payload.modality, 30)
    if modality not in {"", "online", "presencial", "ambas"}:
        raise HTTPException(422, "Selecciona una modalidad válida.")
    return {
        "name": name,
        "subjects": subjects,
        "headline": "" if "title" in payload.model_fields_set else clean_line(payload.headline, 140),
        "levels": course,
        "modality": modality,
        "location": clean_line(payload.location, 120),
        "description": (payload.information if "information" in payload.model_fields_set else payload.description).strip()[:1600],
        "price": clean_line(payload.price, 80),
        "contact_email": email,
        "contact_phone": phone,
    }


def prepared_image(value: str) -> bytes | None:
    if not value:
        return None
    if not re.match(r"^data:image/(?:png|jpeg|webp);base64,", value, re.I):
        raise HTTPException(422, "La imagen debe ser PNG, JPG o WEBP.")
    encoded = value.split(",", 1)[1]
    if len(encoded) > MAX_IMAGE_BYTES * 4 // 3 + 16:
        raise HTTPException(422, "La imagen supera el límite de 5 MB.")
    try:
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > MAX_IMAGE_BYTES:
            raise ValueError("too large")
        with Image.open(BytesIO(raw)) as source:
            if source.format not in {"PNG", "JPEG", "WEBP"} or source.width * source.height > MAX_IMAGE_PIXELS:
                raise ValueError("invalid image")
            image = ImageOps.exif_transpose(source)
            image.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
            out = BytesIO()
            image.convert("RGB").save(out, format="WEBP", quality=82, method=4)
            return out.getvalue()
    except (ValueError, OSError, binascii.Error, UnidentifiedImageError) as exc:
        raise HTTPException(422, "No se pudo leer la imagen. Usa PNG, JPG o WEBP de hasta 5 MB.") from exc


def image_path(ad: ProfesorAd) -> Path:
    return IMAGE_DIR / f"{ad.id}.webp"


def public_ad(ad: ProfesorAd) -> dict:
    return {
        "id": str(ad.id), "title": ad.headline or ad.name, "subject": ad.subjects,
        "course": ad.levels, "subjects": ad.subjects,
        "information": ad.description, "name": ad.name,
        "headline": ad.headline, "levels": ad.levels, "modality": ad.modality,
        "location": ad.location, "description": ad.description, "price": ad.price,
        "contact_email": ad.contact_email, "contact_phone": ad.contact_phone,
        "image_url": f"/api/profesor/ads/{ad.id}/image" if ad.image_name else None,
        "created_at": ad.created_at.isoformat(),
    }


def private_ad(ad: ProfesorAd) -> dict:
    data = public_ad(ad)
    if ad.image_name and image_path(ad).is_file():
        data["image_url"] = "data:image/webp;base64," + base64.b64encode(image_path(ad).read_bytes()).decode()
    return data


def managed_ad(db: Session, ad_id: UUID, key: str) -> ProfesorAd:
    ad = db.get(ProfesorAd, ad_id)
    if not ad or not key or len(key) > 150 or not hmac.compare_digest(ad.manage_token_hash, hashlib.sha256(key.encode()).hexdigest()):
        raise HTTPException(404, "Anuncio o enlace de gestión no válido.")
    return ad


@router.get("/api/profesor/ads")
def list_ads(db: Session = Depends(get_db)):
    ads = db.scalars(select(ProfesorAd).where(ProfesorAd.status == "active").order_by(ProfesorAd.created_at.desc()).limit(200)).all()
    return {"ads": [public_ad(ad) for ad in ads]}


@router.post("/api/profesor/ads", status_code=201)
def publish_ad(payload: AdInput, request: Request, response: Response, db: Session = Depends(get_db)):
    limit_public_write(request, "create", 3)
    if payload.website:
        raise HTTPException(422, "No se pudo publicar el anuncio.")
    if not payload.consent:
        raise HTTPException(422, "Confirma que autorizas la publicación de los datos indicados.")
    fields = cleaned_input(payload)
    image = prepared_image(payload.image_data)
    key = secrets.token_urlsafe(32)
    ad = ProfesorAd(**fields, manage_token_hash=hashlib.sha256(key.encode()).hexdigest(), image_name="image.webp" if image else None,
                    status="active", consent_version=CONSENT_VERSION)
    db.add(ad)
    db.flush()
    if image:
        IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        image_path(ad).write_bytes(image)
    try:
        db.commit()
    except Exception:
        db.rollback()
        if image:
            image_path(ad).unlink(missing_ok=True)
        raise
    response.headers["Cache-Control"] = "no-store"
    return {"ad": public_ad(ad), "manage_key": key}


@router.get("/api/profesor/ads/manage/{ad_id}")
def get_managed_ad(ad_id: UUID, response: Response, x_ad_key: str = Header(default=""), db: Session = Depends(get_db)):
    ad = managed_ad(db, ad_id, x_ad_key)
    response.headers["Cache-Control"] = "no-store"
    return {"ad": private_ad(ad), "status": ad.status}


@router.post("/api/profesor/ads/manage/{ad_id}")
def update_ad(ad_id: UUID, payload: AdInput, request: Request, x_ad_key: str = Header(default=""), db: Session = Depends(get_db)):
    limit_public_write(request, "edit", 15)
    ad = managed_ad(db, ad_id, x_ad_key)
    if ad.status == "removed":
        raise HTTPException(403, "Este anuncio fue retirado. Contacta con administración.")
    if not payload.consent:
        raise HTTPException(422, "Confirma que autorizas la publicación de los datos indicados.")
    fields = cleaned_input(payload)
    image = prepared_image(payload.image_data)
    for key, value in fields.items():
        setattr(ad, key, value)
    if payload.remove_image:
        ad.image_name = None
        image_path(ad).unlink(missing_ok=True)
    if image:
        IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        image_path(ad).write_bytes(image)
        ad.image_name = "image.webp"
    ad.consent_version = CONSENT_VERSION
    ad.consent_at = datetime.now(timezone.utc)
    db.commit()
    return {"ad": private_ad(ad), "status": ad.status}


@router.post("/api/profesor/ads/manage/{ad_id}/status")
def change_status(ad_id: UUID, payload: dict, x_ad_key: str = Header(default=""), db: Session = Depends(get_db)):
    ad = managed_ad(db, ad_id, x_ad_key)
    if ad.status == "removed":
        raise HTTPException(403, "Este anuncio fue retirado. Contacta con administración.")
    if payload.get("status") not in {"active", "paused"}:
        raise HTTPException(422, "Estado no válido.")
    ad.status = payload["status"]
    db.commit()
    return {"status": ad.status}


@router.delete("/api/profesor/ads/manage/{ad_id}")
def delete_ad(ad_id: UUID, x_ad_key: str = Header(default=""), db: Session = Depends(get_db)):
    ad = managed_ad(db, ad_id, x_ad_key)
    db.execute(delete(ProfesorAdReport).where(ProfesorAdReport.ad_id == ad.id))
    db.delete(ad)
    db.commit()
    image_path(ad).unlink(missing_ok=True)
    return {"ok": True}


@router.get("/api/profesor/ads/{ad_id}/image")
def get_image(ad_id: UUID, db: Session = Depends(get_db)):
    ad = db.get(ProfesorAd, ad_id)
    if not ad or ad.status != "active" or not ad.image_name or not image_path(ad).is_file():
        raise HTTPException(404, "Imagen no disponible.")
    return FileResponse(image_path(ad), media_type="image/webp", headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"})


@router.get("/api/profesor/ads/{ad_id}")
def get_ad(ad_id: UUID, db: Session = Depends(get_db)):
    ad = db.get(ProfesorAd, ad_id)
    if not ad or ad.status != "active":
        raise HTTPException(404, "Anuncio no disponible.")
    return {"ad": public_ad(ad)}


@router.post("/api/profesor/ads/{ad_id}/reports")
def report_ad(ad_id: UUID, payload: ReportInput, request: Request, db: Session = Depends(get_db)):
    limit_public_write(request, "report", 5)
    ad = db.get(ProfesorAd, ad_id)
    if not ad or ad.status != "active":
        raise HTTPException(404, "Anuncio no disponible.")
    db.add(ProfesorAdReport(ad_id=ad.id, reason=payload.reason.strip()))
    db.commit()
    return {"ok": True}


@router.get("/admin/profesor-ads")
def admin_list_ads(_: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    ads = db.scalars(select(ProfesorAd).order_by(ProfesorAd.created_at.desc()).limit(300)).all()
    counts = dict(db.execute(select(ProfesorAdReport.ad_id, func.count()).group_by(ProfesorAdReport.ad_id)).all())
    return {"ads": [{**public_ad(ad), "status": ad.status, "reports": counts.get(ad.id, 0)} for ad in ads]}


@router.get("/admin/profesor-ads/{ad_id}/reports")
def admin_ad_reports(ad_id: UUID, _: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    reports = db.scalars(select(ProfesorAdReport).where(ProfesorAdReport.ad_id == ad_id).order_by(ProfesorAdReport.created_at.desc()).limit(100)).all()
    return {"reports": [{"reason": item.reason, "created_at": item.created_at.isoformat()} for item in reports]}


@router.post("/admin/profesor-ads/{ad_id}/status")
def admin_change_status(ad_id: UUID, payload: dict, _: User = Depends(require_superadmin), db: Session = Depends(get_db)):
    ad = db.get(ProfesorAd, ad_id)
    if not ad or payload.get("status") not in {"active", "removed"}:
        raise HTTPException(404, "Anuncio no encontrado.")
    ad.status = payload["status"]
    db.commit()
    return {"ok": True, "status": ad.status}
