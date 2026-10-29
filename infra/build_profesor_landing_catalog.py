"""Refresh the public, crawlable game catalog from the real teacher app data."""
from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / "apps/profesor/index.html").read_text(encoding="utf-8")
extra = (ROOT / "apps/profesor/profesor-public-games-extra.js").read_text(encoding="utf-8")
page_path = ROOT / "marketing/app_landings_demo/profesor-juegos-interactivos.html"
page = page_path.read_text(encoding="utf-8")
assets = ROOT / "apps/profesor/assets/games"

basic_pattern = re.compile(
    r"id:'public:advanced:[^']+',(?:course:'([^']+)',)?title:'([^']+)',subject:'([^']+)',topic:'([^']+)',artwork:'([^']+)',body:'([^']+)'"
)
games = [
    (course or "1.º Primaria", title, subject, topic, art, body)
    for course, title, subject, topic, art, body in basic_pattern.findall(source)
]
extra_pattern = re.compile(
    r"game\('[^']+','([^']+)','[^']+','([^']+)','([^']+)','([^']+)','([^']+)','([^']+)'"
)
scene_map = dict(re.findall(r"'([^']+)':'(public-[^']+\.webp)'", extra.split("const game=", 1)[0]))
for course, subject, slug, title, topic, body in extra_pattern.findall(extra):
    art = scene_map.get(slug, f"public-{slug}.webp")
    if not (assets / art).exists():
        raise RuntimeError(f"Missing artwork for {title}: {art}")
    games.append((course, title, subject, topic, art, body))
if len(games) != 61:
    raise RuntimeError(f"Expected 61 real public games, found {len(games)}")

levels = [
    ("Primaria", [game for game in games if "Primaria" in game[0]]),
    ("ESO", [game for game in games if "ESO" in game[0]]),
    ("Bachillerato y otros niveles", [game for game in games if "Bachillerato" in game[0] or "ESO" not in game[0] and "Primaria" not in game[0]]),
]
parts = [
    '<!-- BEGIN REAL GAME CATALOG -->',
    '<section class="panel real-catalog" id="juegos-por-curso" aria-labelledby="real-catalog-title">',
    '<div class="section-heading"><span class="section-kicker">Catálogo real</span><h2 id="real-catalog-title">61 juegos destacados por curso y asignatura</h2><p>Elige el nivel para explorar aventuras de matemáticas, lengua, inglés, ciencias y geografía e historia. Son juegos disponibles en la biblioteca pública; entra en la app para probarlos.</p></div>',
    '<nav class="catalog-jump" aria-label="Niveles del catálogo"><a href="#catalog-primaria">Primaria</a><a href="#catalog-eso">ESO</a><a href="#catalog-bachillerato">Bachillerato y otros niveles</a></nav>',
]
for i, (label, items) in enumerate(levels):
    level_id = ("primaria", "eso", "bachillerato")[i]
    parts.append(f'<section class="catalog-level" id="catalog-{level_id}"><h3>{html.escape(label)} <span>{len(items)} juegos</span></h3><div class="catalog-grid">')
    for course, title, subject, topic, art, body in items:
        parts.append(
            '<article class="catalog-card">'
            f'<img src="/assets/games/{html.escape(art, quote=True)}" alt="" loading="lazy" decoding="async">'
            f'<div><span class="catalog-meta">{html.escape(course)} · {html.escape(subject)}</span>'
            f'<h4>{html.escape(title)}</h4><p>{html.escape(body)}</p>'
            f'<small>Tema: {html.escape(topic)}</small></div></article>'
        )
    parts.append('</div></section>')
parts.append('<p class="catalog-end"><a class="button primary" href="/profesor">Explorar juegos en la aplicación</a></p></section>')
parts.append('<!-- END REAL GAME CATALOG -->')
catalog = "\n".join(parts)
start = page.find("<!-- BEGIN REAL GAME CATALOG -->")
end = page.find("<!-- END REAL GAME CATALOG -->")
if start >= 0 and end > start:
    page = page[:start] + catalog + page[end + len("<!-- END REAL GAME CATALOG -->") :]
else:
    page = page.replace('<section class="panel cta-panel">', catalog + '\n<section class="panel cta-panel">', 1)
page = page.replace(
    "Crea Pasapalabra, Ahorcado, sopa de letras, Memory, flashcards y más juegos educativos. Prepara pistas y respuestas para el tema que enseñas.",
    "Explora 61 juegos destacados por curso y asignatura, además de Pasapalabra, Ahorcado, sopa de letras y otros formatos interactivos para preparar tus clases.",
)
page = page.replace("Tres formas de convertir un tema en un reto", "Tres clásicos para empezar a jugar")
page_path.write_text(page, encoding="utf-8")
for filename, old, new in [
    ("profesor-materiales-para-clases.html", 'href="/profesor/juegos-interactivos">Explorar los juegos', 'href="/profesor/juegos-interactivos#juegos-por-curso">Explorar los 61 juegos'),
    ("profesor-temario-clases.html", 'href="/profesor/juegos-interactivos">Ver juegos de repaso', 'href="/profesor/juegos-interactivos#juegos-por-curso">Ver juegos por curso'),
    ("profesor-accesos-alumnos.html", 'href="/profesor/juegos-interactivos">Explorar los juegos', 'href="/profesor/juegos-interactivos#juegos-por-curso">Explorar los 61 juegos'),
]:
    path = page_path.with_name(filename)
    content = path.read_text(encoding="utf-8")
    content = content.replace(old, new)
    path.write_text(content, encoding="utf-8")
print(f"Updated public catalog with {len(games)} games")
