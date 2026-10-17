"""Read-only smoke checks for the packaged suite, run inside the backend container."""
from __future__ import annotations

import json
from urllib.error import HTTPError
from urllib.request import urlopen

from sqlalchemy import inspect, text

from app.database.session import engine


def check_deployment(base: str = "http://127.0.0.1:8000", admin: str = "http://admin") -> None:
    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar() == 1, "PostgreSQL no responde"
        inspector = inspect(connection)
        assert not inspector.has_table("profesor_student_accesses"), "Persiste la tabla de cuentas de alumnos retirada"
        connection.execute(text("SELECT profesor_revision FROM client_states LIMIT 0"))
        connection.execute(text("SELECT id, revision, backup_day, payload_zlib FROM profesor_state_snapshots LIMIT 0"))
        assert connection.execute(text("SELECT COUNT(*) FROM (SELECT user_id FROM profesor_state_snapshots GROUP BY user_id HAVING COUNT(*) > 5) excess")).scalar() == 0, "Hay cuentas con más de cinco copias"
        connection.execute(text("SELECT id FROM profesor_material_sessions LIMIT 0"))
        connection.execute(text("SELECT join_code_hash, join_code_encrypted, expires_at FROM profesor_material_sessions LIMIT 0"))
        assert "access_id" not in {column["name"] for column in inspector.get_columns("profesor_material_sessions")}, "Persiste la vinculación a cuentas de alumnos"
        connection.execute(text("SELECT id FROM profesor_ads LIMIT 0"))
        connection.execute(text("SELECT id FROM profesor_ad_reports LIMIT 0"))
        connection.execute(text("SELECT id, request_id, status, attempt_count, failure_category FROM profesor_generation_jobs LIMIT 0"))
    checks = {
        "/ocr-facturas": b'href="/facturas/login"',
        "/facturas": b"LOGIN_TARGETS",
        "/facturas/login": b"facturas-access",
        "/assets/brand/facturas.svg": b"<svg",
        "/health": b'"ok"',
        "/": b"<h1>Educame Tech</h1>",
        "/privacidad": b"Pol\xc3\xadtica de privacidad",
        "/aviso-legal": b"06294184G",
        "/cookies": b"Cookies",
        "/profesor/condiciones": b"2026-10-09.3",
        "/api/profesor/ad-policy": b"2026-10-09.3",
        "/profesor": b"/auth/google/login?next=%2Fprofesor-particular",
        "/profesor/seo.css": b".site-header",
        "/profesor/materiales-para-clases": b"Materiales para clase, sin empezar de cero",
        "/profesor/juegos-interactivos": b"Juegos interactivos que",
        "/profesor/temario-clases": b"El temario de tu",
        "/profesor/accesos-alumnos": b"Accesos Alumnos",
        "/profesor/anunciar": b"Publica tu anuncio gratis",
        "/profesor/anuncios": "Tablón de profesores".encode("utf-8"),
        "/sitemap.xml": b"/profesor/juegos-interactivos",
        "/api/profesor/ads": b'"ads"',
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
        "/profesor-uploaded-topics.js": b"uploadedTopicDetail",
        "/profesor-activity-play.js": b"runActivity",
        "/profesor-access.js": b"accessView",
        "/profesor-state-history.js": b"openStateHistory",
        "/profesor-live.js": b"studentMaterials",
        "/profesor-generator.js": b"/api/profesor/generation/start",
        "/assets/profesor-home.css": b".home-roster",
        "/assets/profesor-studio.css": b"studio-renewed",
        "/assets/profesor-temario.css": b"temario-renewed",
        "/assets/profesor-uploaded-topics.css": b"uploaded-topic-section",
        "/assets/profesor-activity-play.css": b"activity-play",
        "/assets/profesor-game-theme.css": b"memory-card-mark",
        "/assets/profesor-pasapalabra-theme.css": b"pasapalabra-stage.png",
        "/assets/games/pasapalabra-stage.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-flashcard-theme.css": b"flashcard-stage.png",
        "/assets/games/flashcard-stage.png": b"\x89PNG\r\n\x1a\n",
        "/profesor-sentence-board.js": b"profesorSentenceBoard",
        "/profesor-puzzle-boards.js": b"profesorErrorBoard",
        "/profesor-mini-games.js": b"profesorMiniGame",
        "/assets/profesor-mini-games.css": b"bingo-workbench",
        "/assets/profesor-puzzle-theme.css": b"studio-cross-grid",
        "/assets/profesor-sentence-theme.css": b"sentence-stage.png",
        "/assets/games/sentence-stage.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-game-usability.css": b"live-pasapalabra-stage",
        "/assets/profesor-timeline-theme.css": b"timeline-stage.png",
        "/assets/games/timeline-stage.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-memory-theme.css": b"memory-stage.png",
        "/assets/games/memory-stage.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-wordsearch-theme.css": b"wordsearch-stage.png",
        "/assets/games/wordsearch-stage.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-hangman-theme.css": b"hangman-stage.png",
        "/assets/games/hangman-stage.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-access.css": b"access-page",
        "/assets/profesor-dashboard.css": b"profesor-study-room.png",
        "/assets/profesor-academy-theme.css": b"teacher-academy-theme",
        "/assets/profesor-academy-room.webp": b"WEBP",
        "/assets/profesor-academy-paper.webp": b"WEBP",
        "/assets/profesor-study-room.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-live.css": b"live-player",
        "/assets/games/flashcards.webp": b"WEBP",
        "/assets/games/basic-pairs.webp": b"WEBP",
        "/assets/games/mature-basic-pairs.webp": b"WEBP",
        "/assets/games/mystery.webp": b"WEBP",
        "/assets/games/mature-mystery.webp": b"WEBP",
        "/assets/games/intruder.webp": b"WEBP",
        "/assets/games/mature-intruder.webp": b"WEBP",
        "/assets/games/bingo.webp": b"WEBP",
        "/assets/games/mature-bingo.webp": b"WEBP",
        "/assets/games/games-overview.webp": b"WEBP",
        "/assets/games/access-session.svg": b"<svg",
        "/assets/games/uploaded-material.webp": b"WEBP",
        "/profesor/alumno": b"studentJoinGate",
        "/profesor-particular": b"LOGIN_TARGETS",  # Unauthenticated request must reach login.
        "/assets/landing/profesor-dashboard.png": b"\x89PNG\r\n\x1a\n",
        "/assets/landing/profesor-clases-apoyo.png": b"\x89PNG\r\n\x1a\n",
    }
    for path, expected in checks.items():
        with urlopen(base + path, timeout=20) as response:
            data = response.read()
            assert response.status == 200 and expected in data, f"Respuesta incorrecta: {path}"
            if path == "/":
                assert b'href="/profesor"' in data, "Falta Profesor Particular en la portada"
            if path == "/profesor":
                assert b"/assets/games/access-session.svg" in data, "Falta la ilustracion de accesos"
                assert b'preview-juegos' in data and b'<h2>Mis alumnos</h2>' not in data, "La portada anuncia fichas de alumnos retiradas"
            if path == "/profesor/accesos-alumnos":
                assert b'perfil del alumno' not in data, "La página anuncia perfiles de alumnos retirados"
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
        assert exc.headers.get("Cache-Control") == "private, no-store", "El estado privado permite caché"
        assert exc.headers.get("X-Robots-Tag") == "noindex, nofollow", "El estado privado permite indexación"
    else:
        raise AssertionError("El estado privado no debe ser público")
    with urlopen(admin + "/", timeout=20) as response:
        page = response.read()
        assert b"PROFESOR_PARTICULAR" in page and b"aiAppPicker" in page and b"view-ads" in page, "El dashboard no incluye anuncios y modelos"
    print("OK PostgreSQL, registro, autenticación y dashboard")


if __name__ == "__main__":
    check_deployment()
