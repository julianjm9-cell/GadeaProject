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
    checks = {
        "/health": b'"ok"',
        "/": b'href="/profesor"',
        "/profesor": b"/profesor/register",
        "/e25": b"/e25/register",
        "/e25/login": b"LOGIN_TARGETS",
        "/e25/register": b"signupMode",
        "/profesor/register": b"signupMode",
        "/diplomator": b"/diplomator/login",
        "/diplomator/login": b"diplomator-access",
        "/assets/landing/diplomator-dashboard.png": b"\x89PNG\r\n\x1a\n",
        "/assets/landing/eso-dashboard.png": b"\x89PNG\r\n\x1a\n",
        "/profesor/login": b"/profesor-particular",
        "/profesor/demo": b"globalSearch",
        "/profesor-particular": b"LOGIN_TARGETS",  # Unauthenticated request must reach login.
        "/assets/landing/profesor-dashboard.png": b"\x89PNG\r\n\x1a\n",
    }
    for path, expected in checks.items():
        with urlopen(base + path, timeout=20) as response:
            data = response.read()
            assert response.status == 200 and expected in data, f"Respuesta incorrecta: {path}"
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
