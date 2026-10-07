"""Read-only smoke checks for the packaged suite, run inside the backend container."""
from __future__ import annotations

import json
from urllib.error import HTTPError
from urllib.request import urlopen

from sqlalchemy import text

from app.database.session import engine


def check_deployment(base: str = "http://127.0.0.1:8000", admin: str = "http://admin") -> None:
    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar() == 1, "PostgreSQL no responde"
        connection.execute(text("SELECT id, password_encrypted FROM profesor_student_accesses LIMIT 0"))
        connection.execute(text("SELECT id FROM profesor_material_sessions LIMIT 0"))
    checks = {
        "/ocr-facturas": b'href="/facturas/login"',
        "/facturas": b"LOGIN_TARGETS",
        "/facturas/login": b"facturas-access",
        "/assets/brand/facturas.svg": b"<svg",
        "/health": b'"ok"',
        "/": b"<h1>Educame Tech</h1>",
        "/privacidad": b"Pol\xc3\xadtica de privacidad",
        "/profesor": b"/profesor/register",
        "/e25": b"/e25/register",
        "/e25/login": b"LOGIN_TARGETS",
        "/e25/register": b"signupMode",
        "/profesor/register": b"signupMode",
        "/diplomator": b"/diplomator/login",
        "/diplomator/login": b"diplomator-access",
        "/assets/landing/diplomator-dashboard.png": b"\x89PNG\r\n\x1a\n",
        "/assets/diplomator-refresh.css": b".session-header-actions",
        "/assets/landing/eso-dashboard.png": b"\x89PNG\r\n\x1a\n",
        "/profesor/login": b"/profesor-particular",
        "/profesor/demo": b"globalSearch",
        "/profesor-temario.js": b"PROFESOR_TEMARIO",
        "/profesor-temario-depth.js": b"deepDive",
        "/profesor-temario-revision.js": b"editorialRevision",
        "/profesor-activity-play.js": b"runActivity",
        "/profesor-access.js": b"accessView",
        "/profesor-live.js": b"studentMaterials",
        "/assets/profesor-home.css": b".home-roster",
        "/assets/profesor-studio.css": b"studio-renewed",
        "/assets/profesor-temario.css": b"temario-renewed",
        "/assets/profesor-activity-play.css": b"activity-play",
        "/assets/profesor-access.css": b"access-page",
        "/assets/profesor-live.css": b"live-player",
        "/profesor/alumno": b"Mi espacio de clase",
        "/profesor-particular": b"LOGIN_TARGETS",  # Unauthenticated request must reach login.
        "/assets/landing/profesor-dashboard.png": b"\x89PNG\r\n\x1a\n",
    }
    for path, expected in checks.items():
        with urlopen(base + path, timeout=20) as response:
            data = response.read()
            assert response.status == 200 and expected in data, f"Respuesta incorrecta: {path}"
            if path == "/":
                assert b'href="/profesor"' in data, "Falta Profesor Particular en la portada"
            if path == "/profesor-particular":
                assert "/login?next=/profesor-particular" in response.url, "La app no redirige al login"
        print(f"OK {path}")
    with urlopen(base + "/auth/profesor/signup-settings", timeout=20) as response:
        settings = json.load(response)
        assert {"enabled", "credits", "days"} <= settings.keys(), "Registro sin configuración"
    try:
        urlopen(base + "/api/state?app=profesor_particular", timeout=20)
    except HTTPError as exc:
        assert exc.code == 401, "El estado privado debe requerir autenticación"
    else:
        raise AssertionError("El estado privado no debe ser público")
    with urlopen(admin + "/", timeout=20) as response:
        page = response.read()
        assert b"PROFESOR_PARTICULAR" in page and b"aiAppPicker" in page, "El dashboard no incluye la nueva selección de modelos"
    print("OK PostgreSQL, registro, autenticación y dashboard")


if __name__ == "__main__":
    check_deployment()
