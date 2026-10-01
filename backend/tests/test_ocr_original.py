"""The original Aliot interface and backend run with fresh, isolated data."""
from pathlib import Path
from unittest.mock import patch

from test_access_control import client, login, seed_user
from app.services import ocr_legacy_bridge


def test_original_interface_and_clean_isolated_workspaces(client, monkeypatch, tmp_path):
    c, factory = client
    monkeypatch.setenv("OCR_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OCR_PROVIDER", "gemini")
    monkeypatch.setenv("OCR_MODEL", "test-vision")
    monkeypatch.setenv("OCR_API_KEY", "test-private-key")
    seed_user(factory, product_codes=("OCR_FACTURAS",))
    seed_user(factory, email="otro@example.com", product_codes=("OCR_FACTURAS",))
    try:
        assert login(c).status_code == 200
        page = c.get("/facturas")
        assert page.status_code == 200
        assert 'const API=window.location.origin+\'/facturas/legacy\'' in page.text
        assert "function loadWorkspaces" in page.text
        first = c.get("/facturas/legacy/api/workspaces")
        assert first.status_code == 200, first.text
        assert first.json()["workspaces"] == []
        created = c.post("/facturas/legacy/api/workspaces", json={"nombre": "Cliente nuevo"})
        assert created.status_code == 200, created.text
        assert created.json()["workspace"] == "Cliente nuevo"
        assert c.get("/facturas/legacy/api/workspaces").json()["workspaces"] == ["Cliente nuevo"]
        config = c.get("/facturas/legacy/api/config").json()
        assert config["api_tipo"] == "gemini"
        assert config["api_key_preview"] == ""
        assert "test-private-key" not in str(config)
        assert c.post("/facturas/legacy/api/config", json={"api_url": "http://127.0.0.1"}).status_code == 403
        assert c.get("/facturas/legacy/api/auth/access").status_code == 403
        assert c.get("/facturas/legacy/api/auth/me").json()["user"]["email"] == "cliente@example.com"
        login(c, email="otro@example.com")
        assert c.get("/facturas/legacy/api/workspaces").json()["workspaces"] == []
        assert list(tmp_path.glob("legacy/*/*/facturas/*")) != []
        # The old processed invoices and supplier/training files were never copied.
        assert not list(tmp_path.rglob("facturas.xlsx"))
        assert not list(tmp_path.rglob("entrenamiento.json"))
        assert not list(tmp_path.rglob("proveedores.json"))
    finally:
        for proc, _, _ in ocr_legacy_bridge._servers.values():
            proc.terminate()
            proc.wait(timeout=5)
        ocr_legacy_bridge._servers.clear()


def test_original_ui_starts_clean_before_model_is_configured(client, monkeypatch, tmp_path):
    from app.api import ocr_legacy
    c, factory = client
    monkeypatch.setenv("OCR_DATA_DIR", str(tmp_path))
    seed_user(factory, product_codes=("OCR_FACTURAS",))
    login(c)
    monkeypatch.setattr(ocr_legacy, "model_config", lambda db: (_ for _ in ()).throw(ValueError("Sin modelo")))
    try:
        assert c.get("/facturas/legacy/api/workspaces").json()["workspaces"] == []
        response = c.post("/facturas/legacy/api/facturas/upload?workspace=demo")
        assert response.status_code == 503
        assert "Configura primero" in response.text
    finally:
        for proc, _, _ in ocr_legacy_bridge._servers.values():
            proc.terminate()
            proc.wait(timeout=5)
        ocr_legacy_bridge._servers.clear()
