"""Safe text and mathematical notation shared by the two teacher PDF exporters.

Mathtext renders locally: no shell, TeX installation or external requests.
"""
from __future__ import annotations

import base64
from functools import lru_cache
from html import escape
from io import BytesIO
import re
from threading import RLock

from matplotlib import mathtext
from matplotlib.font_manager import FontProperties, findfont
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_lock = RLock()
_notation = re.compile(
    r"\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+)\$|\\\(([\s\S]+?)\\\)"
    r"|\\begin\{(cases|aligned|align\*?|[pbv]?matrix)\}([\s\S]*?)\\end\{\5\}"
)
_auto_math = re.compile(
    r"\\(?:sqrt(?:\[[^\]]+\])?\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}"
    r"|(?:d?frac)\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}"
    r"|(?:pi|alpha|beta|theta|times|div|pm|leq|geq|neq|infty)\b)"
    r"|√(?:\([^()]+\)|\d+)|\b\d+\s*/\s*\d+\b|\b[a-zA-Z\d]+(?:\^[−-]?\d+|[²³⁴⁵⁶⁷⁸⁹⁰¹₀₁₂₃]+)"
)
_sup = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹", "0123456789")
_sub = str.maketrans("₀₁₂₃", "0123")


@lru_cache(maxsize=1)
def presentation_fonts():
    # Embed Unicode fonts so standalone Greek symbols do not become black boxes.
    for name, weight, style in [("TopicVera", "normal", "normal"),
                                ("TopicVeraBold", "bold", "normal"),
                                ("TopicVeraItalic", "normal", "italic"),
                                ("TopicVeraBoldItalic", "bold", "italic")]:
        pdfmetrics.registerFont(TTFont(name, findfont(FontProperties(family="DejaVu Sans", weight=weight, style=style))))
    pdfmetrics.registerFontFamily("TopicVera", normal="TopicVera", bold="TopicVeraBold",
                                  italic="TopicVeraItalic", boldItalic="TopicVeraBoldItalic")


def normalize_math(source: str) -> str:
    source = re.sub(r"\\\\(?=[()[\]]|(?:sqrt|frac|dfrac|begin|end|text|left|right)\b)", r"\\", source)
    source = source.replace("−", "-").replace("×", r"\times ").replace("÷", r"\div ")
    source = re.sub(r"√\(([^)]+)\)", r"\\sqrt{\1}", source)
    source = re.sub(r"√(\d+)", r"\\sqrt{\1}", source)
    source = re.sub(r"[⁰¹²³⁴⁵⁶⁷⁸⁹]+", lambda m: "^{" + m[0].translate(_sup) + "}", source)
    source = re.sub(r"[₀₁₂₃]+", lambda m: "_{" + m[0].translate(_sub) + "}", source)
    if re.fullmatch(r"\d+\s*/\s*\d+", source):
        a, b = source.split("/")
        source = r"\frac{" + a.strip() + "}{" + b.strip() + "}"
    return source.replace(r"\dfrac", r"\frac").strip()


def _formula_image(source: str) -> Image.Image:
    raw = BytesIO()
    mathtext.math_to_image("$" + source + "$", raw, prop=FontProperties(size=10),
                           dpi=180, format="png", color="#102753")
    raw.seek(0)
    return Image.open(raw).convert("RGBA")


@lru_cache(maxsize=256)
def _math_markup(source: str) -> str:
    source = normalize_math(source)
    if len(source) > 1600:
        return _readable_math(source)
    try:
        with _lock:
            environment = re.fullmatch(r"\\begin\{([^}]+)\}([\s\S]*)\\end\{\1\}", source)
            if environment:
                name, body = environment.groups()
                rows = [row.strip() for row in re.split(r"\\\\(?:\[[^\]]+\])?", body) if row.strip()]
                if not rows or len(rows) > 20:
                    raise ValueError("Invalid math rows")
                matrix = name.endswith("matrix")
                # Render cells separately, preserving both rows and alignment.
                cells = [[_formula_image(cell.strip().replace("&", "")) for cell in row.split("&")]
                         for row in rows]
                columns = max(map(len, cells))
                widths = [max((row[c].width for row in cells if c < len(row)), default=1)
                          for c in range(columns)]
                heights = [max(cell.height for cell in row) for row in cells]
                gutter, pad = 16, 22 if matrix or name == "cases" else 3
                image = Image.new("RGBA", (sum(widths) + gutter * (columns - 1) + pad * 2,
                                          sum(heights) + 8 * (len(rows) - 1) + 8))
                y = 4
                for row, height in zip(cells, heights):
                    x = pad
                    for c, cell in enumerate(row):
                        offset = widths[c] - cell.width if c == 0 and not matrix else (widths[c] - cell.width) // 2
                        image.alpha_composite(cell, (x + offset, y + (height - cell.height) // 2))
                        x += widths[c] + gutter
                    y += height + 8
                draw = ImageDraw.Draw(image)
                w, h = image.size
                def delimiter(character, x):
                    font = ImageFont.truetype(findfont(FontProperties(family="DejaVu Sans")), h)
                    box = font.getbbox(character)
                    glyph = Image.new("RGBA", (box[2]-box[0]+4, box[3]-box[1]+4))
                    ImageDraw.Draw(glyph).text((2-box[0],2-box[1]), character, font=font, fill="#102753")
                    image.alpha_composite(glyph.resize((pad-6,h-4), Image.Resampling.LANCZOS), (x,2))
                if name == "cases":
                    delimiter("{", 2)
                elif matrix:
                    if name.startswith("p"):
                        delimiter("(", 2)
                        delimiter(")", w-pad+4)
                    for x, direction in [(5, 1), (w-5, -1)]:
                        if name.startswith("v"):
                            draw.line([(x, 2), (x, h-2)], fill="#102753", width=2)
                        elif name.startswith("p"):
                            pass
                        else:
                            draw.line([(x+direction*8, 2), (x, 2), (x, h-2),
                                       (x+direction*8, h-2)], fill="#102753", width=2)
            else:
                image = _formula_image(source)
            raw = BytesIO()
            image.save(raw, format="PNG")
            # Preserve the aspect ratio and keep wide formulae within A4 columns.
            scale = min(72 / 180, 245 / image.width)
            data = base64.b64encode(raw.getvalue()).decode("ascii")
            return (f'<img src="data:image/png;base64,{data}" '
                    f'width="{image.width * scale:.2f}" height="{image.height * scale:.2f}" valign="middle"/>')
    except (ValueError, RuntimeError, TypeError, OverflowError):
        return _readable_math(source)


def _readable_math(source: str) -> str:
    """Unsupported notation stays readable; it never becomes executable markup."""
    source = re.sub(r"\\(?:begin|end)\{[^}]+\}", "", source).replace(r"\\", "\n")
    source = re.sub(r"\\(?:d?frac)\{([^{}]+)\}\{([^{}]+)\}", r"(\1)/(\2)", source)
    source = re.sub(r"\\sqrt\{([^{}]+)\}", r"√(\1)", source)
    for command, symbol in {"times": "×", "div": "÷", "leq": "≤", "geq": "≥",
                            "neq": "≠", "pi": "π", "infty": "∞"}.items():
        source = source.replace("\\" + command, symbol)
    source = re.sub(r"\\(?:text|mathrm|mathbf|left|right)\b", "", source)
    return escape(source.replace("&", " ").replace("{", "").replace("}", "")).replace("\n", "<br/>")


def formatted_text(value: object, limit: int = 16000) -> str:
    source = re.sub(r"\\\\(?=[()[\]]|(?:sqrt|frac|dfrac|begin|end|text|left|right)\b)", r"\\",
                    str(value or "")[:limit])
    stored = []
    def store(formula):
        stored.append(_math_markup(formula))
        return "\uE000" + str(len(stored)-1) + "\uE001"
    source = _notation.sub(lambda m: store(r"\begin{" + m[5] + "}" + m[6] + r"\end{" + m[5] + "}"
                                          if m[5] else next(v for v in m.groups()[:4] if v is not None)), source)
    source = _auto_math.sub(lambda m: store(m[0]), source)
    steps = source.split(" → ")
    if len(steps) > 1 and all("=" in step for step in steps):
        source = "\n".join(re.sub(r";\s*|\s+y\s+(?=[xy](?:\s*[+−-]\s*[xy])?\s*=)", "\n", step) for step in steps)
    source = escape(source)
    source = re.sub(r"\*\*([^*]+)\*\*|__([^_]+)__", lambda m: "<b>" + (m[1] or m[2]) + "</b>", source)
    source = re.sub(r"(?<!\*)\*([^*\n<>]+)\*(?!\*)", r"<i>\1</i>", source)
    source = re.sub(r"~~([^~<>]+)~~", r"<u>\1</u>", source)
    palette = {"blue": "#0868dc", "green": "#008e6c", "purple": "#7951be", "orange": "#a6660d"}
    source = re.sub(r"\[([^\]<>]+)\]\{(blue|green|purple|orange)\}",
                    lambda m: '<font color="' + palette[m[2]] + '">' + m[1] + '</font>', source)
    source = re.sub(r"^#{1,4}\s+(.+)$", r"<b>\1</b>", source, flags=re.MULTILINE)
    # Preserve the catalogue's automatic emphasis without touching formulae or tags.
    parts, bold = [], 0
    for part in re.split(r"(<[^>]+>)", source):
        if part.startswith("<"):
            if part == "<b>":
                bold += 1
            elif part == "</b>":
                bold = max(0, bold-1)
        elif not bold:
            part = re.sub(r"\b(teorema de Pitágoras|numerador|denominador|hipotenusa|incógnita|idea principal|presente simple|sujeto|predicado|hipótesis)\b",
                          r"<b>\1</b>", part, flags=re.IGNORECASE)
        parts.append(part)
    source = "".join(parts)
    source = source.replace("\n", "<br/>")
    return re.sub("\uE000(\\d+)\uE001", lambda m: stored[int(m[1])], source)


def text_blocks(value: object, style, width: float, limit: int = 16000) -> list:
    """Render Markdown tables as real tables, including mixed prose and tables."""
    lines = str(value or "")[:limit].splitlines()
    blocks, prose = [], []
    def flush():
        if prose:
            blocks.append(Paragraph(formatted_text("\n".join(prose)), style))
            prose.clear()
    n = 0
    while n < len(lines):
        if n+1 < len(lines) and "|" in lines[n] and re.fullmatch(r"\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*", lines[n+1]):
            flush()
            raw = [lines[n]]
            n += 2
            while n < len(lines) and "|" in lines[n] and lines[n].strip():
                raw.append(lines[n])
                n += 1
            cells = [line.strip().strip("|").split("|") for line in raw]
            columns = max(map(len, cells))
            rows = [[Paragraph(formatted_text(cell.strip()), style) for cell in row] +
                    [Paragraph("", style)] * (columns-len(row)) for row in cells]
            table = Table(rows, colWidths=[width/columns]*columns, repeatRows=1, hAlign="LEFT")
            table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#eaf3ff")),
                                      ("GRID", (0,0), (-1,-1), .4, colors.HexColor("#c9ddf5")),
                                      ("VALIGN", (0,0), (-1,-1), "TOP"),
                                      ("LEFTPADDING", (0,0), (-1,-1), 7),
                                      ("RIGHTPADDING", (0,0), (-1,-1), 7),
                                      ("TOPPADDING", (0,0), (-1,-1), 6),
                                      ("BOTTOMPADDING", (0,0), (-1,-1), 6)]))
            blocks.append(table)
        else:
            prose.append(lines[n])
            n += 1
    flush()
    return blocks or [Paragraph("", style)]
