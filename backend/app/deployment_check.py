"""Read-only smoke checks for the packaged suite, run inside the backend container."""
from __future__ import annotations

import json
from urllib.error import HTTPError
from urllib.request import urlopen

from sqlalchemy import inspect, text

from app.database.session import engine
from app.services.app_availability import PAUSE_MESSAGE


PAUSABLE_PATHS = {
    "/facturas": "OCR_FACTURAS",
    "/cambridge": "CAMBRIDGE",
    "/profesor-particular": "PROFESOR_PARTICULAR",
}


def verify_expected_pause(exc: HTTPError, path: str, availability: dict) -> bool:
    product = PAUSABLE_PATHS.get(path)
    if exc.code != 503 or not product or availability.get(product, {}).get("paused") is not True:
        return False
    try:
        with exc:
            return bool(exc.headers.get("Retry-After")) and json.load(exc).get("detail") == PAUSE_MESSAGE
    except (ValueError, AttributeError):
        return False


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
        connection.execute(text("SELECT id, user_id, revoked_at FROM auth_sessions LIMIT 0"))
        connection.execute(text("SELECT email_verified_at, requires_email_verification FROM users LIMIT 0"))
        connection.execute(text("SELECT id, expires_at FROM profesor_editor_drafts LIMIT 0"))
        connection.execute(text("SELECT id, estimated_usd, product_code FROM profesor_provider_calls LIMIT 0"))
        connection.execute(text("SELECT id, request_id, status FROM ai_requests LIMIT 0"))
        connection.execute(text("SELECT id, send_key, product_code FROM profesor_notifications LIMIT 0"))
        connection.execute(text("SELECT notification_id, user_id, read_at, dismissed_at FROM profesor_notification_recipients LIMIT 0"))
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
        "/cambridge-info": b"/auth/google/login?next=%2Fcambridge",
        "/cambridge": b"/auth/google/login?next=%2Fcambridge",
        "/assets/landing/cambridge-hero-v1.png": b"\x89PNG\r\n\x1a\n",
        "/assets/cambridge-games/open-cloze-editor-v1.png": b"\x89PNG\r\n\x1a\n",
        "/assets/cambridge-games/word-formation-forge-v1.png": b"\x89PNG\r\n\x1a\n",
        "/assets/cambridge-games/writing-mailroom-v1.png": b"\x89PNG\r\n\x1a\n",
        "/assets/cambridge-games/c1-research-desk-v1.webp": b"RIFF",
        "/assets/cambridge-games/c1-debate-room-v1.webp": b"RIFF",
        "/assets/cambridge-games/c2-editorial-observatory-v1.webp": b"RIFF",
        "/assets/cambridge-games/c2-precision-press-v1.webp": b"RIFF",
        "/assets/cambridge-studio/studio.css": b"English studio",
        "/assets/cambridge-studio/landing.css": b".hero-shell",
        "/assets/cambridge-studio/landing-preview.js": b"showPreview",
        "/assets/cambridge-studio/last-train-station-v1.webp": b"RIFF",
        "/assets/cambridge-studio/last-train-sprite-v1.webp": b"RIFF",
        "/assets/cambridge-studio/word-bridge-preview-v1.webp": b"RIFF",
        "/assets/cambridge-studio/academy-v2.webp": b"RIFF",
        "/assets/cambridge-studio/academy-card-v2.webp": b"RIFF",
        "/assets/cambridge-studio/route-card-v2.webp": b"RIFF",
        "/assets/cambridge-studio/games-card-v2.webp": b"RIFF",
        "/assets/cambridge-studio/writing-card-v2.webp": b"RIFF",
        "/assets/cambridge-studio/audio-card-v2.webp": b"RIFF",
        "/assets/cambridge-studio/progress-card-v2.webp": b"RIFF",
        "/assets/cambridge-studio/games.js": b"EnglishMissionBoards",
        "/assets/cambridge-studio/expansion.js": b"EnglishExpansion",
        "/assets/cambridge-studio/games.css": b".mission-bridge",
        "/assets/cambridge-studio/journey.css": b".english-journey-path",
        "/assets/cambridge-studio/route-atlas-v1.webp": b"RIFF",
        "/assets/cambridge-studio/route-editor-v1.webp": b"RIFF",
        "/assets/cambridge-studio/route-archive-v1.webp": b"RIFF",
        "/assets/cambridge-studio/route-machine-v1.webp": b"RIFF",
        "/assets/cambridge-studio/route-forge-v1.webp": b"RIFF",
        "/assets/cambridge-studio/route-mailroom-v1.webp": b"RIFF",
        "/assets/cambridge-studio/route-research-v1.webp": b"RIFF",
        "/assets/cambridge-studio/route-debate-v1.webp": b"RIFF",
        "/assets/cambridge-studio/route-observatory-v1.webp": b"RIFF",
        "/assets/cambridge-studio/route-press-v1.webp": b"RIFF",
        "/assets/lighthouse/game.js": b"LighthouseMission",
        "/assets/lighthouse/game.css": b".faro-grid",
        "/assets/lighthouse/archipelago-v1.webp": b"RIFF",
        "/assets/study-appearance/appearance.css": b".study-look-dialog",
        "/assets/study-appearance/appearance.js": b"/api/study-appearance",
        "/assets/study-appearance/english-club-v1.webp": b"RIFF",
        "/assets/study-appearance/english-library-v1.webp": b"RIFF",
        "/assets/study-appearance/eso-courtyard-v1.webp": b"RIFF",
        "/assets/study-appearance/eso-observatory-v1.webp": b"RIFF",
        "/assets/cambridge-studio/bridge-world-v1.webp": b"RIFF",
        "/assets/cambridge-studio/guide-v1.webp": b"RIFF",
        "/assets/listening/b2-short-extracts.json": b"{",
        "/assets/listening/b2-museum.wav": b"RIFF",
        "/assets/listening/b2-sentence-completion.json": b"{",
        "/assets/listening/b2-repair-workshop.wav": b"RIFF",
        "/assets/listening/b2-multiple-matching.json": b"{",
        "/assets/listening/b2-matching-pottery.wav": b"RIFF",
        "/assets/listening/b2-interview.json": b"{",
        "/assets/listening/b2-city-wildlife-interview.wav": b"RIFF",
        "/assets/listening/b2-festival-brief.wav": b"RIFF",
        "/assets/listening/c1-library-brief.wav": b"RIFF",
        "/assets/listening/c2-metrics-brief.wav": b"RIFF",
        "/e25": b"/auth/google/login?next=%2Feso-adultos",
        "/e25/login": b"LOGIN_TARGETS",
        "/e25/register": b"signupMode",
        "/profesor/register": b"signupMode",
        "/diplomator": b"/diplomator/login",
        "/diplomator/login": b"diplomator-access",
        "/assets/landing/diplomator-dashboard.png": b"\x89PNG\r\n\x1a\n",
        "/assets/diplomator-refresh.css": b".session-header-actions",
        "/assets/landing/eso-dashboard.png": b"\x89PNG\r\n\x1a\n",
        "/profesor/login": b"/profesor-particular",
        "/cuenta": b"accountForm",
        "/profesor-editor-recovery.js": b"editorDrafts.v1",
        "/profesor-notifications.js": b"data-teacher-notifications",
        "/assets/profesor-notifications.css": b"teacher-notifications-dialog",
        "/app-notifications.js": b"data-app-notifications",
        "/app-session.js": b"educa-session-refresh",
        "/assets/eso-state-recovery.js": b"eso.pending.",
        "/assets/app-notifications.css": b"app-notifications-dialog",
        "/profesor-subjects.js": b"teacherAllowsSubject",
        "/profesor-profile.js": b"teacher-settings-dialog",
        "/profesor-public-games-extra.js": b"PROFESOR_ADVANCED_PUBLIC_GAMES_EXTRA",
        "/profesor-external-games.js": b"PROFESOR_EXTERNAL_GAMES",
        "/assets/profesor-public-games-extra.css": b"public-",
        "/assets/profesor-public-english.css": b"public-",
        "/assets/profesor-public-math.css": b"public-",
        "/assets/profesor-public-language.css": b"public-",
        "/assets/profesor-public-social-spanish.css": b"public-",
        "/assets/profesor-external-games.css": b"external-game-card",
        "/assets/eso-english-missions.js": b"EsoEnglishMissions",
        "/assets/eso-math-missions.js": b"EsoMathMissions",
        "/assets/eso-math-scenes.css": b"eso-math-board",
        "/assets/eso-english-mission-scenes.css": b"eso-english-illustrated",
        "/assets/eso-mission-boards.css": b"eso-object-board",
        "/assets/games/eso-english-library-board-v2.webp": b"WEBP",
        "/assets/games/eso-english-city-board-v2.webp": b"WEBP",
        "/assets/games/eso-english-calendar-board-v2.webp": b"WEBP",
        "/assets/games/eso-english-email-board-v2.webp": b"WEBP",
        "/assets/games/eso-math-market-checkout-v2.webp": b"WEBP",
        "/assets/games/eso-math-fruit-order-v2.webp": b"WEBP",
        "/assets/games/eso-math-invoice-desk-v2.webp": b"WEBP",
        "/assets/games/eso-math-recipe-kitchen-v2.webp": b"WEBP",
        "/assets/games/eso-geo-valley-v1.webp": b"WEBP",
        "/assets/games/eso-digital-safety-v1.webp": b"WEBP",
        "/assets/games/eso-medieval-city-v1.webp": b"WEBP",
        "/assets/games/eso-spreadsheet-v1.webp": b"WEBP",
        "/assets/games/eso-history-music-v1.webp": b"WEBP",
        "/assets/games/eso-earth-observatory-v1.webp": b"WEBP",
        "/assets/games/eso-reservoir-v1.webp": b"WEBP",
        "/assets/games/eso-garden-plan-v1.webp": b"WEBP",
        "/assets/games/eso-bike-rental-v1.webp": b"WEBP",
        "/assets/games/eso-neighborhood-survey-v1.webp": b"WEBP",
        "/assets/games/eso-moving-boxes-v1.webp": b"WEBP",
        "/assets/games/eso-thermometers-v1.webp": b"WEBP",
        "/assets/games/eso-information-point-v1.webp": b"WEBP",
        "/assets/games/eso-spain-europe-atlas-v1.webp": b"WEBP",
        "/assets/games/eso-logic-workbench-v1.webp": b"WEBP",
        "/assets/games/eso-sustainable-center-v1.webp": b"WEBP",
        "/assets/eso-language-missions.js": b"EsoLanguageMissions",
        "/assets/eso-geography-missions.js": b"EsoGeographyMissions",
        "/assets/eso-history-missions.js": b"EsoHistoryMissions",
        "/assets/eso-science-missions.js": b"EsoScienceMissions",
        "/assets/eso-external-games.js": b"EsoExternalGames",
        "/assets/subjects/lengua.svg": b"<svg",
        "/assets/profesor-matching-scenes.css": b"match-scene-targets",
        "/assets/profesor-matching-pack-one.css": b"public-tren-wagon-v2.png",
        "/assets/profesor-matching-pack-two.css": b"public-laboratorio-stations-v2.webp",
        "/assets/profesor-matching-pack-three.css": b"public-atlas-channels-v2.webp",
        "/assets/profesor-race-pack-four.css": b"public-laboratorio-mixtures-board-v2.webp",
        "/assets/profesor-race-pack-five.css": b"public-cocina-racionales-board-v2.webp",
        "/assets/profesor-race-pack-six.css": b"public-complejos-coordinate-board-v2.webp",
        "/assets/profesor-bingo-pack-seven.css": b"public-aeropuerto-departures-board-v2.webp",
        "/assets/profesor-bingo-pack-eight.css": b"public-expositivo-magazine-board-v2.webp",
        "/assets/profesor-choice-pack-nine.css": b"public-isla-signboards-v2.webp",
        "/assets/profesor-choice-pack-ten.css": b"public-portal-conditional-keys-v2.webp",
        "/assets/profesor-choice-pack-eleven.css": b"public-subjunctive-bridge-tablets-v2.webp",
        "/assets/games/public-atlas-channels-v2.webp": b"RIFF",
        "/assets/games/public-hemeroteca-vitrines-v2.webp": b"RIFF",
        "/assets/games/public-mercado-counter-v2.webp": b"RIFF",
        "/assets/games/public-observatorio-astrolabe-v2.webp": b"RIFF",
        "/assets/games/public-laboratorio-mixtures-board-v2.webp": b"RIFF",
        "/assets/games/public-feria-booth-board-v2.webp": b"RIFF",
        "/assets/games/public-ruta-cablecar-board-v2.webp": b"RIFF",
        "/assets/games/public-cocina-racionales-board-v2.webp": b"RIFF",
        "/assets/games/public-mercado-checkout-board-v2.webp": b"RIFF",
        "/assets/games/public-torre-radicales-board-v2.webp": b"RIFF",
        "/assets/games/public-pista-movimiento-board-v2.webp": b"RIFF",
        "/assets/games/public-complejos-coordinate-board-v2.webp": b"RIFF",
        "/assets/games/public-cinematica-sensors-board-v2.webp": b"RIFF",
        "/assets/games/public-matrices-gate-board-v2.webp": b"RIFF",
        "/assets/games/public-ondas-optics-board-v2.webp": b"RIFF",
        "/assets/games/public-cronica-diary-board-v2.webp": b"RIFF",
        "/assets/games/public-matices-studio-board-v2.webp": b"RIFF",
        "/assets/games/public-aeropuerto-departures-board-v2.webp": b"RIFF",
        "/assets/games/public-atlas-anatomy-board-v2.webp": b"RIFF",
        "/assets/games/public-atlas-expedition-board-v2.webp": b"RIFF",
        "/assets/games/public-expositivo-magazine-board-v2.webp": b"RIFF",
        "/assets/games/public-migraciones-map-board-v2.webp": b"RIFF",
        "/assets/games/public-atomo-lab-board-v2.webp": b"RIFF",
        "/assets/games/public-nutricion-atlas-board-v2.webp": b"RIFF",
        "/assets/games/public-asamblea-cork-board-v2.webp": b"RIFF",
        "/assets/games/public-contemporaneo-archive-board-v2.webp": b"RIFF",
        "/assets/games/public-comentario-manuscript-board-v2.webp": b"RIFF",
        "/assets/games/public-isla-signboards-v2.webp": b"RIFF",
        "/assets/games/public-habitos-studio-panels-v2.webp": b"RIFF",
        "/assets/games/public-cine-filmframes-v2.webp": b"RIFF",
        "/assets/games/public-viajes-diary-entries-v2.webp": b"RIFF",
        "/assets/games/public-portal-conditional-keys-v2.webp": b"RIFF",
        "/assets/games/public-advanced-tenses-timeline-v2.webp": b"RIFF",
        "/assets/games/public-inference-evidence-notes-v2.webp": b"RIFF",
        "/assets/games/public-album-memory-captions-v2.webp": b"RIFF",
        "/assets/games/public-subjunctive-bridge-tablets-v2.webp": b"RIFF",
        "/assets/games/public-interpretation-editor-slips-v2.webp": b"RIFF",
        "/assets/games/public-laboratorio-stations-v2.webp": b"RIFF",
        "/assets/games/public-archivo-drawers-v2.webp": b"RIFF",
        "/assets/games/public-redaccion-diagrams-v2.webp": b"RIFF",
        "/assets/games/public-tren-wagon-v2.png": b"\x89PNG\r\n\x1a\n",
        "/assets/games/public-bosque-fieldbook-v2.png": b"\x89PNG\r\n\x1a\n",
        "/assets/games/public-redaccion-trays-v2.png": b"\x89PNG\r\n\x1a\n",
        "/assets/games/public-central-dossier-v2.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-race-scenes.css": b"race-scene-workspace",
        "/assets/profesor-bingo-scenes.css": b"bingo-scene-art",
        "/assets/games/public-album-recuerdos.webp": b"WEBP",
        "/assets/profesor-profile.css": b"profile-look-preview",
        "/assets/profesor-study-preview.webp": b"WEBP",
        "/assets/profesor-academy-preview.webp": b"WEBP",
        "/profesor/demo": b"globalSearch",
        "/profesor-temario.js": b"PROFESOR_TEMARIO",
        "/profesor-temario-depth.js": b"deepDive",
        "/profesor-temario-revision.js": b"editorialRevision",
        "/profesor-uploaded-topics.js": b"uploadedTopicDetail",
        "/profesor-activity-play.js": b"runActivity",
        "/profesor-access.js": b"accessView",
        "/profesor-state-history.js": b"openStateHistory",
        "/profesor-live.js": b"studentMaterials",
        "/profesor-live-sync.js": b"profesorCreateLiveSync",
        "/profesor-generator.js": b"/api/profesor/generation/start",
        "/assets/profesor-home.css": b".home-roster",
        "/assets/profesor-studio.css": b"studio-renewed",
        "/assets/profesor-temario.css": b"temario-renewed",
        "/assets/profesor-uploaded-topics.css": b"uploaded-topic-section",
        "/assets/profesor-activity-play.css": b"activity-play",
        "/assets/profesor-game-theme.css": b"memory-card-mark",
        "/assets/profesor-game-ages.css": b"data-game-age",
        "/assets/games/profesor-play-child-v1.webp": b"WEBP",
        "/assets/games/profesor-play-teen-v1.webp": b"WEBP",
        "/assets/profesor-pasapalabra-theme.css": b"pasapalabra-stage.png",
        "/assets/games/pasapalabra-stage.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-flashcard-theme.css": b"flashcard-stage.png",
        "/assets/games/flashcard-stage.png": b"\x89PNG\r\n\x1a\n",
        "/profesor-sentence-board.js": b"profesorSentenceBoard",
        "/profesor-puzzle-boards.js": b"profesorErrorBoard",
        "/profesor-challenge-games.js": b"profesorChallengeGame",
        "/assets/profesor-challenge-games.css": b"cipher-message",
        "/profesor-mini-games.js": b"profesorMiniGame",
        "/assets/profesor-mini-games.css": b"bingo-workbench",
        "/assets/profesor-puzzle-theme.css": b"studio-cross-grid",
        "/assets/profesor-sentence-theme.css": b"sentence-stage.png",
        "/assets/games/sentence-stage.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-game-usability.css": b"live-pasapalabra-stage",
        "/assets/profesor-timeline-theme.css": b"timeline-stage.png",
        "/assets/games/timeline-stage.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-memory-theme.css": b"memory-stage.png",
        "/assets/profesor-memory-pack-twelve.css": b"public-word-factory-cards-v2.webp",
        "/assets/games/public-word-factory-cards-v2.webp": b"WEBP",
        "/assets/games/public-bilingual-backpack-cards-v2.webp": b"WEBP",
        "/assets/games/public-past-portal-cards-v2.webp": b"WEBP",
        "/assets/games/public-greetings-plaza-cards-v2.webp": b"WEBP",
        "/assets/profesor-order-pack-thirteen.css": b"public-safari-sentence-board-v2.webp",
        "/assets/games/public-safari-sentence-board-v2.webp": b"WEBP",
        "/assets/games/public-city-directions-board-v2.webp": b"WEBP",
        "/assets/games/public-tenses-station-board-v2.webp": b"WEBP",
        "/assets/games/public-butterfly-garden-board-v2.webp": b"WEBP",
        "/assets/games/public-greenhouse-notebook-board-v2.webp": b"WEBP",
        "/assets/profesor-special-pack-fourteen.css": b"public-senses-explorer-board-v2.webp",
        "/assets/games/public-senses-explorer-board-v2.webp": b"WEBP",
        "/assets/games/public-punctuation-detective-board-v2.webp": b"WEBP",
        "/assets/games/public-secret-library-board-v2.webp": b"WEBP",
        "/assets/games/public-grammar-agency-board-v2.webp": b"WEBP",
        "/assets/profesor-special-pack-fifteen.css": b"public-fraction-recipe-board-v2.webp",
        "/assets/games/public-fraction-recipe-board-v2.webp": b"WEBP",
        "/assets/games/public-decimal-tanks-board-v2.webp": b"WEBP",
        "/assets/games/public-circuit-workbench-board-v2.webp": b"WEBP",
        "/assets/games/memory-stage.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-wordsearch-theme.css": b"wordsearch-stage.png",
        "/assets/games/wordsearch-stage.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-hangman-theme.css": b"hangman-stage.png",
        "/assets/games/hangman-stage.png": b"\x89PNG\r\n\x1a\n",
        "/assets/profesor-access.css": b"access-page",
        "/assets/profesor-dashboard.css": b"profesor-study-room.png",
        "/assets/profesor-academy-theme.css": b"teacher-academy-theme",
        "/assets/profesor-appearance.css": b"teacher-study-theme",
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
        "/assets/games/multiselect.webp": b"WEBP",
        "/assets/games/mature-multiselect.webp": b"WEBP",
        "/assets/games/table.webp": b"WEBP",
        "/assets/games/mature-table.webp": b"WEBP",
        "/assets/games/cipher.webp": b"WEBP",
        "/assets/games/mature-cipher.webp": b"WEBP",
        "/assets/games/race.webp": b"WEBP",
        "/assets/games/mature-race.webp": b"WEBP",
        "/assets/games/bingo.webp": b"WEBP",
        "/assets/games/mature-bingo.webp": b"WEBP",
        "/assets/games/games-overview.webp": b"WEBP",
        "/assets/games/access-session.svg": b"<svg",
        "/assets/games/uploaded-material.webp": b"WEBP",
        "/profesor/alumno": b"studentJoinGate",
        "/profesor-particular": b"LOGIN_TARGETS",  # Unauthenticated request must reach login.
        "/assets/landing/profesor-dashboard.png": b"\x89PNG\r\n\x1a\n",
        "/assets/landing/profesor-clases-apoyo.png": b"\x89PNG\r\n\x1a\n",
        "/assets/landing/profesor-hero-app-v3.png": b"\x89PNG\r\n\x1a\n",
        "/assets/landing/profesor-hero-app-v4.png": b"\x89PNG\r\n\x1a\n",
    }
    with urlopen(base + "/api/public/app-availability", timeout=20) as response:
        availability = json.load(response)["apps"]
    for product in PAUSABLE_PATHS.values():
        assert isinstance(availability[product]["paused"], bool), f"Estado de pausa inválido: {product}"
    print("OK /api/public/app-availability")
    for path, expected in checks.items():
        try:
            with urlopen(base + path, timeout=20) as response:
                product = PAUSABLE_PATHS.get(path)
                assert not product or not availability[product]["paused"], f"{path} responde aunque está pausada"
                data = response.read()
                assert response.status == 200 and expected in data, f"Respuesta incorrecta: {path}"
                if path == "/":
                    assert b'href="/profesor"' in data, "Falta Profesor Particular en la portada"
                if path == "/profesor":
                    assert b"/assets/games/access-session.svg" in data, "Falta la ilustracion de accesos"
                    assert b'profesor-hero-app-v4.png' in data and b'Entrar con Google' in data, "Falta la nueva portada de Profesor Particular"
                if path == "/profesor/accesos-alumnos":
                    assert b'perfil del alumno' not in data, "La página anuncia perfiles de alumnos retirados"
                if path == "/profesor-particular":
                    assert "/login?next=/profesor-particular" in response.url, "La app no redirige al login"
                if path == "/cambridge":
                    assert response.url.endswith("/cambridge-info"), "Inglés no redirige a su landing al faltar sesión"
                if path == "/e25":
                    assert b'href="/e25/register"' not in data and b'href="/e25/login"' not in data, "La landing de ESO Adultos ofrece un acceso distinto de Google"
        except HTTPError as exc:
            if verify_expected_pause(exc, path, availability):
                print(f"OK {path} (pausa configurada)")
                continue
            raise AssertionError(f"No responde {path}: HTTP {exc.code}") from exc
        print(f"OK {path}")
    with urlopen(base + "/auth/profesor/signup-settings", timeout=20) as response:
        settings = json.load(response)
        assert {"enabled", "credits", "days"} <= settings.keys(), "Registro sin configuración"
    for product in ("profesor_particular", "cambridge"):
        try:
            urlopen(base + f"/api/state?app={product}", timeout=20)
        except HTTPError as exc:
            assert exc.code == 401, f"El estado privado de {product} debe requerir autenticación"
            assert exc.headers.get("Cache-Control") == "private, no-store", f"El estado privado de {product} permite caché"
            assert exc.headers.get("X-Robots-Tag") == "noindex, nofollow", f"El estado privado de {product} permite indexación"
        else:
            raise AssertionError(f"El estado privado de {product} no debe ser público")
    with urlopen(admin + "/", timeout=20) as response:
        page = response.read()
        assert b"PROFESOR_PARTICULAR" in page and b"aiAppPicker" in page and b"view-ads" in page, "El dashboard no incluye anuncios y modelos"
        assert b"appNotifications" in page, "Falta el apartado de avisos dentro de cada app"
    with urlopen(admin + "/notifications.js", timeout=20) as response:
        assert b"/admin/app-notifications" in response.read(), "Falta el editor de notificaciones"
    print("OK PostgreSQL, registro, autenticación y dashboard")


if __name__ == "__main__":
    check_deployment()
