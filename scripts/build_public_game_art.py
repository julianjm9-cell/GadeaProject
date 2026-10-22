"""Derive small, distinct WebP covers from the licensed game scenes in the repo.

Usage: node -e "...JSON.stringify(window.PROFESOR_ADVANCED_PUBLIC_GAMES_EXTRA)..." |
       python scripts/build_public_game_art.py
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "apps" / "profesor" / "assets" / "games"
COLORS = {
    "Matemáticas": (34, 105, 193),
    "Lengua": (119, 73, 172),
    "Inglés": (26, 124, 167),
    "Español": (146, 72, 134),
    "Ciencias Naturales": (49, 132, 92),
    "Física y Química": (29, 123, 136),
    "Geografía e Historia": (152, 99, 47),
}


def font(size, bold=False):
    name = "arialbd.ttf" if bold else "arial.ttf"
    for path in (Path("C:/Windows/Fonts") / name, Path("/usr/share/fonts/truetype/dejavu") / ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")):
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def cover(item):
    path = ASSETS / item["artwork"]
    source = ASSETS / item["sceneSource"]
    with Image.open(source) as original:
        image = ImageOps.fit(original.convert("RGB"), (1200, 675), method=Image.Resampling.LANCZOS)
    color = COLORS[item["subject"]]
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    # Preserve the scene while giving every game a legible, branded cover.
    draw.rounded_rectangle((38, 382, 1162, 628), radius=34, fill=(255, 253, 247, 232))
    draw.rounded_rectangle((40, 381, 1160, 626), radius=32, outline=(*color, 235), width=5)
    draw.rounded_rectangle((68, 411, 460, 460), radius=23, fill=(*color, 235))
    draw.text((90, 418), f'{item["course"]}  ·  {item["subject"]}', font=font(23, True), fill="white")
    title = item["title"]
    title_font = font(48 if len(title) < 31 else 42, True)
    words = title.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and draw.textlength(candidate, font=title_font) > 1010:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    for index, line in enumerate(lines[:2]):
        draw.text((70, 476 + index * 56), line, font=title_font, fill=(17, 40, 81))
    draw.rounded_rectangle((70, 606, 280, 618), radius=6, fill=(*color, 250))
    image = Image.alpha_composite(image.convert("RGBA"), layer).convert("RGB")
    image.save(path, "WEBP", quality=84, method=6)
    return path.stat().st_size


def stylesheet(games):
    lines = ["/* Portadas y tableros de los juegos destacados de ESO, Bachillerato y Español. */"]
    for item in games:
        slug = item["slug"]
        color = COLORS[item["subject"]]
        accent = "#{:02x}{:02x}{:02x}".format(*color)
        pale = "#{:02x}{:02x}{:02x}".format(*[round(channel * .12 + 255 * .88) for channel in color])
        image = f"./games/{item['sceneSource']}"
        lines.append(f'[data-public-scene="{slug}"]{{--scene-accent:{accent}!important;--scene-soft:{pale}!important;--scene-image:url(\'{image}\')!important;--scene-position:center 50%!important;--mission-name:"{item["topic"].upper()}"}}')
        lines.append(f'dialog.activity-play:has(.play-question[data-public-scene="{slug}"]:not([hidden])){{background-image:linear-gradient(90deg,#f7faffb8,#f7faff58),url(\'{image}\');background-position:center;background-size:cover}}')
    lines.extend([
        '/* El alumno ve el mismo escenario cuando entra con el código de sesión. */',
        '.live-question[data-public-scene]{background-image:linear-gradient(#f8fbffbb,#f8fbffbd),var(--scene-image)!important;background-size:cover!important;background-position:center!important}',
        '.live-question[data-public-scene] .live-controls{border-radius:22px;background:#fffdf3df;padding:14px;backdrop-filter:blur(8px)}',
        'dialog.activity-play:has(.play-question[data-public-scene]:not([hidden])) .play-footer{display:flex;align-items:center;gap:8px;min-height:55px;padding:7px 10px}',
        'dialog.activity-play:has(.play-question[data-public-scene]:not([hidden])) .play-footer .actions{flex:1;min-width:0}',
        'dialog.activity-play:has(.play-question[data-public-scene]:not([hidden])) .play-footer>.play-solution-link{order:-1;align-self:center;min-height:38px;margin:0 auto 0 0;padding:7px 12px;border:1px solid #bcd7f3;border-radius:10px;background:#fff;color:#075cbe;font-weight:800;text-decoration:none}',
        '@media(max-width:620px){.live-question[data-public-scene] .live-controls{padding:8px}dialog.activity-play:has(.play-question[data-public-scene]:not([hidden])) .play-footer{flex-wrap:wrap}}',
    ])
    (ASSETS.parent / "profesor-public-games-extra.css").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    games = json.load(sys.stdin)
    total = 0 if "--css-only" in sys.argv else sum(cover(item) for item in games)
    stylesheet(games)
    print(f"{len(games)} escenarios preparados" + (f"; portadas WebP: {total // 1024} KiB" if total else ""))
