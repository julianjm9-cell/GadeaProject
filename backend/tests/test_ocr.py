from io import BytesIO
from unittest.mock import Mock
import json
import subprocess
from fastapi.testclient import TestClient
from sqlalchemy import select
from PIL import Image
import pytest
from test_access_control import client, seed_user, login
from app.models.ocr import OcrJob
from app.models import UsageRecord
from app.services import ocr_worker


@pytest.fixture(autouse=True)
def ocr_config(monkeypatch, tmp_path):
    monkeypatch.setenv("OCR_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OCR_PROVIDER", "gemini")
    monkeypatch.setenv("OCR_MODEL", "test-vision-model")
    monkeypatch.setenv("OCR_API_KEY", "test-secret-never-return")


def image_bytes():
    stream = BytesIO()
    Image.new("RGB", (50, 50), "white").save(stream, format="PNG")
    return stream.getvalue()


def upload(c, **kwargs):
    return c.post("/api/ocr/jobs?filename=factura.png", content=image_bytes(), headers={"Content-Type": "application/octet-stream"}, **kwargs)


def test_ocr_requires_own_license_and_hides_keys(client):
    c, factory = client
    assert c.get("/api/ocr/jobs").status_code == 401
    seed_user(factory)
    login(c)
    assert c.get("/api/ocr/jobs", headers={"x-client-app": "diplomator"}).status_code == 403
    assert upload(c).status_code == 403


def test_ocr_rejects_inactive_accounts_and_excess_queue(client):
    from app.models import User
    c, factory = client
    seed_user(factory, product_codes=("OCR_FACTURAS",))
    assert login(c).status_code == 200
    for _ in range(3):
        assert upload(c).status_code == 202
    assert upload(c).status_code == 429
    assert c.post("/api/ocr/jobs?filename=x.png", content=image_bytes(), headers={"Content-Type": "application/octet-stream", "Sec-Fetch-Site": "cross-site"}).status_code == 403
    with factory() as db:
        user = db.scalar(select(User))
        user.is_active = False
        db.commit()
    assert c.get("/api/ocr/jobs").status_code == 403


def test_ocr_google_does_not_grant_free_license(client):
    from app.api.auth import ensure_google_access
    from app.models import User, License
    c, factory = client
    seed_user(factory)
    with factory() as db:
        ensure_google_access(db, db.scalar(select(User)))
        assert db.scalar(select(License).where(License.product_code == "OCR_FACTURAS")) is None


def test_isolation_review_and_formula_safe_export(client):
    from openpyxl import load_workbook
    c, factory = client
    seed_user(factory, product_codes=("OCR_FACTURAS",))
    seed_user(factory, email="other@example.com", product_codes=("OCR_FACTURAS",))
    login(c)
    assert "test-secret" not in c.get("/api/ocr/status").text
    response = upload(c)
    assert response.status_code == 202, response.text
    job_id = response.json()["id"]
    from uuid import UUID
    with factory() as db:
        job = db.get(OcrJob, UUID(job_id))
        job.status = "done"
        job.result = {"fields": {"proveedor": "Original", "total_pagar": "121"}}
        db.commit()
    assert c.post(f"/api/ocr/jobs/{job_id}/review", json={"fields": {"proveedor": "=1+1"}}).status_code == 200
    wb = load_workbook(BytesIO(c.get(f"/api/ocr/jobs/{job_id}/export").content))
    assert wb.active["B2"].value == "=1+1"
    assert wb.active["B2"].data_type == "s"
    assert c.get(f"/api/ocr/jobs/{job_id}/original").content == image_bytes()
    login(c, email="other@example.com")
    assert c.get("/api/ocr/jobs").json()["jobs"] == []
    for endpoint in ("", "/original", "/export"):
        assert c.get(f"/api/ocr/jobs/{job_id}{endpoint}").status_code == 404
    assert c.post(f"/api/ocr/jobs/{job_id}/review", json={"fields": {}}).status_code == 404


def test_credit_reservation_and_invalid_files(client):
    from app.models import License
    c, factory = client
    seed_user(factory, product_codes=("OCR_FACTURAS",))
    login(c)
    bad = c.post("/api/ocr/jobs?filename=x.pdf", content=b"not a pdf", headers={"Content-Type": "application/octet-stream"})
    assert bad.status_code == 422
    with factory() as db:
        assert not db.scalars(select(UsageRecord)).all()
        license = db.scalar(select(License))
        license.usage_limit = 1
        db.commit()
    assert upload(c).status_code == 202
    assert upload(c).status_code == 402
    assert c.get("/api/ocr/jobs").status_code == 200


def test_worker_success_and_failure_are_persistent(client, monkeypatch):
    from pathlib import Path
    c, factory = client
    seed_user(factory, product_codes=("OCR_FACTURAS",))
    login(c)
    assert upload(c).status_code == 202
    monkeypatch.setattr(ocr_worker, "SessionLocal", factory)
    def run(*args, **kwargs):
        payload = json.loads(kwargs["input"])
        (Path(payload["folder"]) / "result.json").write_text(json.dumps({"fields": {"total_pagar": "121"}, "usage": {"input_tokens": 10, "output_tokens": 5}}))
    monkeypatch.setattr(ocr_worker.subprocess, "run", run)
    assert ocr_worker.run_one()
    assert c.get("/api/ocr/jobs").json()["jobs"][0]["status"] == "done"
    assert not ocr_worker.run_one()
    assert upload(c).status_code == 202
    monkeypatch.setattr(ocr_worker.subprocess, "run", Mock(side_effect=subprocess.TimeoutExpired("runner", 900)))
    assert ocr_worker.run_one()
    job = c.get("/api/ocr/jobs").json()["jobs"][0]
    assert job["status"] == "error"
    assert "secret" not in job["error"]


@pytest.mark.parametrize("document_kind", ["image", "text_pdf", "scanned_pdf"])
def test_original_engine_in_isolated_process(tmp_path, document_kind):
    """Real parser, legacy engine and subprocess; only the external API is simulated."""
    import fitz
    import os
    import sys
    import threading
    from pathlib import Path
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    fields = {"proveedor": "Proveedor Demo", "numero_factura": "TEST-2026-001", "fecha_factura": "01/10/2026", "nif_cif": "B12345678", "base_imponible": "100.00", "iva_porcentaje": "21", "iva_importe": "21.00", "total_pagar": "121.00", "moneda": "EUR", "concepto_mejorado": "Servicio de prueba"}
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            self.rfile.read(int(self.headers["Content-Length"]))
            data = json.dumps({"choices": [{"message": {"content": json.dumps(fields)}}], "usage": {"prompt_tokens": 12, "completion_tokens": 20}}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(data)
        def log_message(self, *args):
            pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        suffix = ".png" if document_kind == "image" else ".pdf"
        if document_kind == "image":
            (tmp_path / "source.png").write_bytes(image_bytes())
        else:
            with fitz.open() as doc:
                for _ in range(2 if document_kind == "scanned_pdf" else 1):
                    page = doc.new_page()
                    if document_kind == "text_pdf":
                        page.insert_text((40, 60), "Factura TEST-2026-001 Proveedor Demo NIF B12345678\nFecha 01/10/2026 Servicio de prueba\nBase imponible 100.00 EUR IVA 21% 21.00 EUR Total 121.00 EUR")
                    else:
                        page.insert_image(page.rect, stream=image_bytes())
                doc.save(tmp_path / "source.pdf")
        config = {"api_tipo": "gemini", "modelo_externo": "fake-model", "api_key": "test", "vision_enabled": True, "api_min_interval": 0, "api_url": f"http://127.0.0.1:{server.server_port}/chat", "entrenamiento_activo": False}
        run = subprocess.run([sys.executable, "-m", "app.services.ocr_runner"], input=json.dumps({"folder": str(tmp_path), "suffix": suffix, "config": config}), text=True, encoding="utf-8", capture_output=True, timeout=30, cwd=Path(__file__).parents[1])
        assert run.returncode == 0, run.stderr
        data = json.loads((tmp_path / "result.json").read_text(encoding="utf-8"))
        assert data["fields"]["numero_factura"] == "TEST-2026-001"
        assert data["usage"]["input_tokens"] >= 12
        assert not (tmp_path / "config.json").exists()
    finally:
        server.shutdown()
        server.server_close()
