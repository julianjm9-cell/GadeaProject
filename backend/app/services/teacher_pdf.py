"""Printable worksheets for the teacher's structured activities."""

from __future__ import annotations

from io import BytesIO
from html import escape
from typing import Callable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, Flowable, CondPageBreak
from reportlab.lib.utils import ImageReader


BLUE = colors.HexColor("#0868dc")
INK = colors.HexColor("#102753")
MUTED = colors.HexColor("#577095")
PALE = colors.HexColor("#eaf3ff")


class _MarkedImage(Flowable):
    def __init__(self, raw: bytes, width: float, height: float, x: float, y: float, zone_width=0, zone_height=0):
        super().__init__()
        self.raw, self.width, self.height, self.x, self.y = raw, width, height, x, y
        self.hAlign = "CENTER"
        self.zone_width, self.zone_height = zone_width, zone_height

    def draw(self):
        self.canv.drawImage(ImageReader(BytesIO(self.raw)), 0, 0, self.width, self.height)
        self.canv.setStrokeColor(colors.white)
        self.canv.setFillColor(BLUE)
        self.canv.setLineWidth(2)
        if self.zone_width and self.zone_height:
            self.canv.setStrokeColor(BLUE)
            self.canv.rect(self.width*(self.x-self.zone_width/2)/100, self.height*(1-(self.y+self.zone_height/2)/100), self.width*self.zone_width/100, self.height*self.zone_height/100, stroke=1, fill=0)
        else:
            self.canv.circle(self.width*self.x/100, self.height*(1-self.y/100), 7, stroke=1, fill=1)


def _text(value: object, limit: int = 3000) -> str:
    return escape(str(value or "")[:limit].replace('→', ' -> ')).replace("\n", "<br/>")


def _lines(value: object, limit: int = 27) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip()[:300] for item in value if str(item).strip()][:limit]


def _grid_flowable(grid: list[list[str]], reveal: bool) -> Table:
    size = min(11*mm, 154*mm/max(len(grid[0]), 1))
    cells = [[letter if reveal and letter != '#' else "" for letter in row] for row in grid]
    table = Table(cells, colWidths=[size]*len(grid[0]), rowHeights=[size]*len(grid), hAlign="CENTER")
    commands = [("GRID", (0, 0), (-1, -1), .5, colors.HexColor("#a9c4e6")),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]
    for row, line in enumerate(grid):
        for col, letter in enumerate(line):
            if letter == "#":
                commands.append(("BACKGROUND", (col, row), (col, row), colors.HexColor("#dce7f6")))
    table.setStyle(TableStyle(commands))
    return table


def _wordsearch(words: list[str]) -> list[list[str]]:
    clean = ["".join(c for c in word.upper() if c.isalpha()) for word in words]
    clean = [word for word in clean if word]
    size = max(10, max(map(len, clean), default=1))
    size = min(size, 15)
    grid = [["" for _ in range(size)] for _ in range(size)]
    # A compact printable variant: each word has a guaranteed horizontal path.
    for row, word in enumerate(clean[:size]):
        if len(word) > size:
            continue
        start = (row*3) % (size-len(word)+1)
        for col, letter in enumerate(word):
            grid[row][start+col] = letter
    alphabet = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"
    for row in range(size):
        for col in range(size):
            if not grid[row][col]:
                grid[row][col] = alphabet[(row*17+col*11+row*col) % len(alphabet)]
    return grid


def _crossword(words: list[str], with_entries=False):
    clean = ["".join(c for c in word.upper() if c.isalpha()) for word in words]
    clean = [word for word in clean if word]
    for anchor in sorted(clean, key=len, reverse=True):
        others = [word for word in clean if word != anchor]
        used: set[int] = set()
        placed: list[tuple[str, int, int]] = []
        def assign(index: int) -> bool:
            if index == len(others):
                return True
            word = others[index]
            for row, anchor_letter in enumerate(anchor):
                if row in used:
                    continue
                for col, letter in enumerate(word):
                    if letter != anchor_letter:
                        continue
                    used.add(row)
                    placed.append((word, row, col))
                    if assign(index+1):
                        return True
                    placed.pop()
                    used.remove(row)
            return False
        if not assign(0):
            continue
        left = max((col for _, _, col in placed), default=0)
        right = max((len(word)-col-1 for word, _, col in placed), default=0)
        grid = [["#" for _ in range(left+right+1)] for _ in anchor]
        for row, letter in enumerate(anchor):
            grid[row][left] = letter
        for word, row, col in placed:
            for offset, letter in enumerate(word):
                grid[row][left-col+offset] = letter
        if with_entries:
            entries = {anchor: (0, left, 'vertical')}
            entries.update({word: (row, left-col, 'horizontal') for word, row, col in placed})
            return grid, entries
        return grid
    raise ValueError("No se pudo construir el crucigrama para PDF.")


def render_teacher_pdf(material: dict, solutions: bool, image_loader: Callable[[str], bytes]) -> bytes:
    """Render one A4 PDF. Image references are resolved by the authenticated caller."""
    if not isinstance(material, dict) or not isinstance(material.get("activity"), dict):
        raise ValueError("Material no válido.")
    questions = material["activity"].get("questions")
    if not isinstance(questions, list) or not 1 <= len(questions) <= 80:
        raise ValueError("El material debe contener entre 1 y 80 preguntas.")
    title = str(material.get("title") or "Material de clase")[:180]
    subject = str(material.get("subject") or "")[:80]
    context = material["activity"].get("context") or {}
    if not isinstance(context, dict):
        context = {}
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TeacherTitle", fontName="Helvetica-Bold", fontSize=19, leading=23, textColor=INK, spaceAfter=7))
    styles.add(ParagraphStyle(name="TeacherHeading", fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=INK, spaceBefore=12, spaceAfter=5, keepWithNext=True))
    styles.add(ParagraphStyle(name="TeacherBody", fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK, spaceAfter=6))
    styles.add(ParagraphStyle(name="TeacherSmall", fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTED, spaceAfter=8))
    styles.add(ParagraphStyle(name="TeacherAnswer", fontName="Helvetica", fontSize=9, leading=13, textColor=BLUE, leftIndent=10, spaceBefore=5))
    styles.add(ParagraphStyle(name="TeacherCenter", parent=styles["TeacherBody"], alignment=TA_CENTER))
    out = BytesIO()
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=19*mm, rightMargin=19*mm,
                            topMargin=18*mm, bottomMargin=18*mm, title=title,
                            author="Profesor Particular")
    story = [Paragraph("PROFESOR PARTICULAR  /  " + ("SOLUCIONES" if solutions else "FICHA DE TRABAJO"), styles["TeacherSmall"]),
             Paragraph(_text(title), styles["TeacherTitle"]),
             Paragraph(_text(" · ".join(v for v in [subject, str(context.get("course") or "")[:80]] if v)), styles["TeacherSmall"])]
    if not solutions:
        story.extend([Paragraph("Nombre: _____________________________________    Fecha: __________________", styles["TeacherBody"]), Spacer(1, 5*mm)])
    labels = {"pairs":"Relacionar", "gaps":"Completar", "multigaps":"Texto con huecos", "numeric":"Respuesta numérica", "quiz":"Elegir respuesta", "short":"Respuesta breve",
              "order":"Ordenar", "classify":"Clasificar", "boolean":"Verdadero o falso", "reading":"Comprensión",
              "problem":"Problemas", "flashcard":"Tarjeta", "memory":"Memory", "sentence":"Construye la frase",
              "timeline":"Línea temporal", "error":"Encuentra el error", "wordsearch":"Sopa de letras",
              "crossword":"Crucigrama", "dragdrop":"Asociar", "pasapalabra":"Pasapalabra", "hangman":"Ahorcado", "visualquiz":"Quiz visual", "imagepoint":"Señalar imagen"}
    seen_readings = set()
    for index, q in enumerate(questions, 1):
        if not isinstance(q, dict) or q.get("type") not in labels:
            raise ValueError(f"El ejercicio {index} no es válido.")
        kind = q["type"]
        section = []
        prompt = str(q.get("prompt") or "")[:12000 if kind == 'multigaps' else 1500].strip()
        if not prompt:
            raise ValueError(f"El ejercicio {index} necesita un enunciado.")
        if kind == "crossword":
            section.append(CondPageBreak(75*mm))
        elif kind in ("visualquiz", "imagepoint"):
            section.append(CondPageBreak(85*mm))
        section.append(Paragraph(f"{index}. {labels[kind]}", styles["TeacherHeading"]))
        if kind == "reading" and q.get("text"):
            reading_key = (q.get('activityGroup'), q['text'])
            if reading_key not in seen_readings:
                section.append(Paragraph(_text(q["text"], 12000), styles["TeacherBody"]))
                seen_readings.add(reading_key)
        section.append(Paragraph(_text(prompt.replace('___', '____________'), 16000), styles["TeacherBody"]))
        if kind in ("visualquiz", "imagepoint"):
            image = q.get("image")
            if not isinstance(image, dict) or not image.get("id"):
                raise ValueError(f"El ejercicio {index} necesita una imagen.")
            raw = image_loader(str(image["id"]))
            try:
                source = ImageReader(BytesIO(raw))
                width, height = source.getSize()
                if width < 1 or height < 1:
                    raise ValueError()
                scale = min(154*mm/width, 70*mm/height)
                if solutions and kind == "imagepoint":
                    target = q.get("target") or {}
                    x, y = float(target.get("x")), float(target.get("y"))
                    if not (0 <= x <= 100 and 0 <= y <= 100):
                        raise ValueError()
                    section.append(_MarkedImage(raw, width*scale, height*scale, x, y, min(100, max(0, float(target.get('width', 0)))), min(100, max(0, float(target.get('height', 0))))))
                else:
                    section.append(Image(BytesIO(raw), width=width*scale, height=height*scale, hAlign="CENTER"))
                if image.get("credit"):
                    section.append(Paragraph(_text(image["credit"], 160), styles["TeacherSmall"]))
            except Exception as exc:
                raise ValueError(f"La imagen del ejercicio {index} no se puede incluir en el PDF.") from exc
        options = _lines(q.get("options"))
        if kind == 'numeric' and q.get('unit'):
            section.append(Paragraph('Unidad: ' + _text(q['unit'], 30), styles['TeacherSmall']))
        if not solutions and kind in ('gaps', 'multigaps') and q.get('wordBank'):
            section.append(Paragraph('Banco de palabras: ' + ' / '.join(_text(word, 100) for word in sorted(_lines(q['wordBank'], 12))), styles['TeacherSmall']))
        if kind in ("quiz", "visualquiz", "boolean", "classify"):
            for letter, option in zip("ABCDEFGH", options):
                section.append(Paragraph(f"{letter}. {_text(option, 300)}", styles["TeacherBody"]))
        elif kind == "wordsearch":
            section.append(_grid_flowable(_wordsearch(options), True))
            section.append(Paragraph("Palabras: " + ", ".join(_text(o, 100) for o in options), styles["TeacherSmall"]))
        elif kind == "crossword":
            grid, entries = _crossword([o.split("|", 1)[0].strip() for o in options], True)
            crossword_parts = [_grid_flowable(grid, solutions)]
            for clue, option in enumerate(options, 1):
                word = ''.join(c for c in option.split('|', 1)[0].upper() if c.isalpha())
                row, col, direction = entries[word]
                crossword_parts.append(Paragraph(f"{clue}. ({direction}, fila {row+1}, columna {col+1}) " + _text(option.split("|", 1)[-1].strip(), 300), styles["TeacherBody"]))
            section.append(KeepTogether(crossword_parts))
        elif kind in ("dragdrop", "memory"):
            pairs = [option.split('|', 1) for option in options if '|' in option]
            right = [pair[1].strip() for pair in pairs]
            if not solutions:
                right = right[1:] + right[:1]
                section.append(Paragraph('Relaciona las dos columnas. Escribe la letra junto al número.', styles['TeacherSmall']))
            table = Table([[Paragraph(f'{n+1}. {_text(pair[0])}', styles['TeacherBody']), Paragraph(f'{chr(65+n)}. {_text(right[n])}', styles['TeacherBody'])] for n, pair in enumerate(pairs)], colWidths=[77*mm, 77*mm])
            table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BOX',(0,0),(-1,-1),.5,PALE),('INNERGRID',(0,0),(-1,-1),.5,PALE),('LEFTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7)]))
            if pairs:
                section.append(table)
        elif kind == 'pairs' and not solutions:
            bank = [str(item.get('answer', '')) for item in reversed(questions) if item.get('type') == 'pairs' and item.get('activityGroup') == q.get('activityGroup')]
            if len(bank) > 1:
                section.append(Paragraph('Banco de respuestas: ' + ' / '.join(_text(item, 300) for item in bank), styles['TeacherSmall']))
        elif kind == "pasapalabra":
            for option in options:
                parts = [part.strip() for part in option.split("|", 2)]
                if len(parts) == 3:
                    section.append(Paragraph(f"<b>{_text(parts[0], 2)}</b> · {_text(parts[1], 180)}" + (f" — {_text(parts[2], 60)}" if solutions else ""), styles["TeacherBody"]))
        elif kind == "hangman" and not solutions:
            section.append(Paragraph(' '.join('_' if char.isalpha() else ' / ' for char in str(q.get('answer') or '')), styles["TeacherCenter"]))
        elif kind in ("order", "sentence", "timeline"):
            if kind == 'sentence':
                section.append(Paragraph(' / '.join(_text(o, 300) for o in (options if solutions else list(reversed(options)))), styles['TeacherBody']))
            else:
                for option in (options if solutions else list(reversed(options))):
                    section.append(Paragraph(('Paso: ____   ' if not solutions else '') + _text(option, 300), styles['TeacherBody']))
        elif kind == 'problem' and not solutions:
            for label in ['Datos', 'Planteamiento', 'Cálculos', 'Respuesta y comprobación']:
                    section.extend([Paragraph(label, styles['TeacherBody']), Spacer(1, 8*mm)])
        if solutions:
            answer = q.get("answer") or ""
            if kind == "imagepoint":
                target = q.get("target") or {}
                answer = f"Zona marcada por el profesor ({target.get('x', '?')} %, {target.get('y', '?')} %)"
            elif kind in ("wordsearch", "crossword", "dragdrop", "memory", "pasapalabra", "multigaps"):
                answer = "; ".join(options)
            section.append(Paragraph("Solución: " + _text(answer, 2500), styles["TeacherAnswer"]))
            if q.get('explanation'):
                section.append(Paragraph(_text(q['explanation'], 1500), styles['TeacherBody']))
            if q.get('rubric'):
                section.append(Paragraph('Criterios de revisión: ' + _text(q['rubric'], 1000), styles['TeacherSmall']))
        elif kind not in ("quiz", "visualquiz", "boolean", "classify", "wordsearch", "crossword", "dragdrop", "memory", "pasapalabra", "multigaps", "hangman"):
            section.append(Paragraph("________________________________________________________________________", styles["TeacherSmall"]))
        section.append(Spacer(1, 2*mm))

        if kind == "crossword":
            story.append(KeepTogether(section))
        else:
            story.extend(section)

    def footer(canvas, document):
        canvas.saveState()
        canvas.setStrokeColor(PALE)
        canvas.line(19*mm, 14*mm, A4[0]-19*mm, 14*mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(19*mm, 10*mm, "Profesor Particular")
        canvas.drawRightString(A4[0]-19*mm, 10*mm, str(document.page))
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return out.getvalue()
