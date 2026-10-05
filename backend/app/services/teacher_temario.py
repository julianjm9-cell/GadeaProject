"""Trusted curricular resources and printable topic handouts."""
from __future__ import annotations

from functools import lru_cache
from html import escape
from io import BytesIO
import json
import re
import reportlab
from pathlib import Path
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Line, Rect, Polygon, String

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

RESOURCES = {"scheme": "Esquema resumen", "practice": "Ejercicios básicos", "examples": "Ejemplos resueltos"}

@lru_cache(maxsize=1)
def presentation_fonts():
    fonts = Path(reportlab.__file__).parent / "fonts"
    pdfmetrics.registerFont(TTFont("TopicVera", str(fonts / "Vera.ttf")))
    pdfmetrics.registerFont(TTFont("TopicVeraBold", str(fonts / "VeraBd.ttf")))
    pdfmetrics.registerFontFamily("TopicVera", normal="TopicVera", bold="TopicVeraBold")

def formatted_topic_text(text):
    """Safe ReportLab markup preserving notation instead of ASCII substitutions."""
    value = escape(str(text))
    value = re.sub(r"\b(teorema de Pitágoras|numerador|denominador|hipotenusa|incógnita|idea principal|presente simple|sujeto|predicado|hipótesis)\b", r"<b>\1</b>", value, flags=re.IGNORECASE)
    value = re.sub(r"\*\*([^*]+)\*\*|__([^_]+)__", lambda m: "<b>" + (m[1] or m[2]) + "</b>", value)
    value = re.sub(r"«([^»]+)»", r"«<b>\1</b>»", value)
    value = re.sub(r"\*([^*<>\n]+)\*", r"<i>\1</i>", value)
    value = re.sub(r"~~([^~<>]+)~~", r"<u>\1</u>", value)
    palette = {"blue": "#0868dc", "green": "#008e6c", "purple": "#7951be", "orange": "#a6660d"}
    value = re.sub(r"\[([^\]<>]+)\]\{(blue|green|purple|orange)\}", lambda m: '<font color="' + palette[m[2]] + '">' + m[1] + '</font>', value)
    value = re.sub(r"^#{1,4}\s+(.+)$", r"<b>\1</b>", value, flags=re.MULTILINE)

    value = re.sub(r"([a-zA-Z0-9])\^(-?\d+)", r"\1<super>\2</super>", value)
    value = re.sub(r"(?<![\w/])(-?\d+)\s*/\s*(\d+)(?![\w/])", r"<super>\1</super>/<sub>\2</sub>", value)
    for character, digit in zip("₀₁₂₃", "0123"):
        value = value.replace(character, "<sub>" + digit + "</sub>")
    for character in "→ΣθΔ":
        value = value.replace(character, '<font name="Symbol">' + character + '</font>')
    parts = value.split("→")
    # Keep the arrow in limits; vertically align actual chains of equalities.
    if len(parts) > 1 and all("=" in part for part in parts):
        value = value.replace('<font name="Symbol">→</font>', '<br/>')
        value = re.sub(r";\s*|\s+y\s+(?=[xy](?:\s*[+−-]\s*[xy])?\s*=)", '<br/>', value)
    return value.replace("\n", "<br/>")

def topic_diagram(topic):
    title = topic["title"].lower()
    drawing = Drawing(320, 180)
    blue = colors.HexColor("#0868dc")
    def label(x, y, text):
        drawing.add(String(x, y, text, fontName="TopicVera", fontSize=10, fillColor=colors.HexColor("#102753")))
    if any(word in title for word in ("geometr", "trigonometr")) and any(word in topic["explanation"]+topic["example"] for word in ("triángulo rectángulo", "catetos")):
        drawing.add(Polygon([65, 25, 65, 125, 250, 25], fillColor=None, strokeColor=blue))
        drawing.add(Line(65, 39, 79, 39, strokeColor=blue))
        drawing.add(Line(79, 39, 79, 25, strokeColor=blue))
        label(15, 75, "cateto")
        label(135, 8, "cateto")
        label(150, 100, "hipotenusa")
    elif "geometr" in title and "base 6 y altura 4" in topic["example"]:
        drawing.add(Polygon([45,25,145,125,265,25], fillColor=None, strokeColor=blue))
        drawing.add(Line(145,25,145,125,strokeColor=blue,strokeDashArray=[4,4]))
        label(115,8,"base: 6")
        label(155,75,"altura: 4")
    elif any(word in title for word in ("formas y cuerpos", "geometría y volumen")):
        drawing.add(Rect(25,25,75,75,fillColor=None,strokeColor=blue))
        drawing.add(Rect(175,25,75,75,fillColor=None,strokeColor=blue))
        drawing.add(Rect(210,60,75,75,fillColor=None,strokeColor=blue))
        for x,y in [(175,25),(175,100),(250,25),(250,100)]:
            drawing.add(Line(x,y,x+35,y+35,strokeColor=blue))
        label(25,8,"figura plana")
        label(185,8,"cuerpo")
    elif "funciones y geometría" in title and "y = 2x" in topic["example"]:
        drawing.add(Line(50,25,280,25,strokeColor=blue))
        drawing.add(Line(50,25,50,140,strokeColor=blue))
        drawing.add(Line(50,25,160,135,strokeColor=blue))
        for x,y,text in [(50,25,"(0,0)"),(105,80,"(1,2)"),(160,135,"(2,4)")]:
            label(x+6,y-8,text)
        label(280,8,"x")
        label(30,140,"y")
    elif any(word in title for word in ("área", "perímetro")):
        drawing.add(Rect(65, 25, 180, 100, fillColor=None, strokeColor=blue))
        label(135, 8, "base")
        label(15, 75, "altura")
    else:
        return None
    label(65, 165, "Esquema de apoyo: no está a escala")
    return drawing


@lru_cache(maxsize=1)
def topic_catalog() -> dict[str, dict]:
    path = Path(__file__).resolve().parents[1] / "data" / "profesor-temario.json"
    return {topic["id"]: topic for topic in json.loads(path.read_text(encoding="utf-8"))}


def render_topic_pdf(topic: dict, resource: str) -> bytes:
    if resource not in RESOURCES:
        raise ValueError("Recurso no válido.")
    content = topic["didactic"]
    presentation_fonts()
    blue, ink, muted = [colors.HexColor(v) for v in ("#0868dc", "#102753", "#577095")]
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("TopicTitle", fontName="Helvetica-Bold", fontSize=23, leading=28, textColor=ink, spaceAfter=10))
    styles.add(ParagraphStyle("TopicHeading", fontName="Helvetica-Bold", fontSize=12, leading=17, textColor=blue, spaceBefore=15, spaceAfter=7))
    styles.add(ParagraphStyle("TopicBody", fontName="TopicVera", fontSize=10, leading=16, textColor=ink, spaceAfter=6))
    styles.add(ParagraphStyle("TopicMeta", fontSize=9, leading=14, textColor=muted, spaceAfter=7))
    def paragraph(text, style="TopicBody"):
        return Paragraph(formatted_topic_text(text), styles[style])

    story = [paragraph("PROFESOR PARTICULAR", "TopicMeta"), paragraph(topic["title"], "TopicTitle"),
             paragraph(topic["course"] + "  |  " + topic["subject"] + "  |  " + RESOURCES[resource], "TopicMeta")]
    intro = Table([[paragraph(topic["explanation"])]], colWidths=[174*mm])
    intro.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eaf3ff")),
                              ("BOX", (0, 0), (-1, -1), .5, colors.HexColor("#c9ddf5")),
                              ("LEFTPADDING", (0, 0), (-1, -1), 12),
                              ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                              ("TOPPADDING", (0, 0), (-1, -1), 10),
                              ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story.extend([Spacer(1, 5*mm), intro])

    def section(title, body):
        story.extend([paragraph(title, "TopicHeading"), paragraph(body)])

    if resource == "scheme":
        section("Para entenderlo", content["deepDive"])
        story.append(paragraph("Conceptos clave", "TopicHeading"))
        for index, concept in enumerate(content["concepts"], 1):
            story.append(paragraph(str(index) + ". " + concept))
        section("Cuándo usarlo", content["recognition"])
        story.append(paragraph("Recorrido de aprendizaje", "TopicHeading"))
        for index, step in enumerate(content["steps"], 1):
            story.append(paragraph(str(index) + ". " + step))
        section("Un ejemplo", content["examples"][0])
    elif resource == "examples":
        for index, example in enumerate(content["examples"], 1):
            section("Ejemplo explicado " + str(index), example)
        section("Cómo interpretarlo", content["deepDive"])
        story.append(paragraph("Pasos para resolverlo", "TopicHeading"))
        for index, step in enumerate(content["steps"], 1):
            story.append(paragraph(str(index) + ". " + step))
        section("Error frecuente", content["commonErrors"][0])
    else:
        for index, exercise in enumerate(content["practice"], 1):
            section("Actividad " + str(index), exercise["prompt"])
            for _ in range(3):
                story.extend([paragraph("_" * 95, "TopicMeta"), Spacer(1, 2*mm)])
        section("Amplía la actividad", content["transfer"])
        story.extend([PageBreak(), paragraph("Guía de corrección", "TopicTitle"),
                      paragraph(topic["title"], "TopicMeta")])
        for index, solution in enumerate(content["solutions"], 1):
            section("Solución orientativa " + str(index), solution)
        section("Qué comprobar", content["recognition"])
        section("Error frecuente", content["commonErrors"][0])

    if resource != "practice" and topic.get("subject") == "Español" and topic.get("languageTable"):
        table = topic["languageTable"]
        story.append(paragraph("Formas de referencia", "TopicHeading"))
        rows = [[paragraph(cell) for cell in table["head"]]] + [[paragraph(cell) for cell in row] for row in table["rows"]]
        paradigm = Table(rows, colWidths=[174*mm/len(table["head"])]*len(table["head"]), repeatRows=1)
        paradigm.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef6ff")),
                                      ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dbe8f7")),
                                      ("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(paradigm)

    if resource != "practice" and topic.get("subject") == "Español" and topic.get("languageContrast"):
        wrong, correct = topic["languageContrast"]
        story.append(paragraph("Forma y significado", "TopicHeading"))
        contrast = Table([[paragraph("Para revisar"), paragraph("Modelo adecuado")],
                          [paragraph(wrong), paragraph(correct)]], colWidths=[84*mm, 84*mm])
        contrast.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef6ff")),
                                      ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dbe8f7")),
                                      ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                      ("LEFTPADDING", (0, 0), (-1, -1), 8),
                                      ("RIGHTPADDING", (0, 0), (-1, -1), 8)]))
        story.append(contrast)

    if resource != "practice":
        diagram = topic_diagram(topic)
        if diagram:
            story.append(diagram)

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#dbe8f7"))
        canvas.line(18*mm, 17*mm, 192*mm, 17*mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(muted)
        canvas.drawString(18*mm, 12*mm, "Profesor Particular | " + RESOURCES[resource])
        canvas.drawRightString(192*mm, 12*mm, str(doc.page))
        canvas.restoreState()

    stream = BytesIO()
    document = SimpleDocTemplate(stream, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm,
                                 topMargin=18*mm, bottomMargin=24*mm,
                                 title=topic["title"] + " - " + RESOURCES[resource], author="Profesor Particular")
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return stream.getvalue()
