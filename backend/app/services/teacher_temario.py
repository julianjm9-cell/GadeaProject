"""Trusted curricular resources and printable topic handouts."""
from __future__ import annotations

from functools import lru_cache
from html import escape
from io import BytesIO
import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

RESOURCES = {"scheme": "Esquema resumen", "practice": "Ejercicios básicos", "examples": "Ejemplos resueltos"}


@lru_cache(maxsize=1)
def topic_catalog() -> dict[str, dict]:
    path = Path(__file__).resolve().parents[1] / "data" / "profesor-temario.json"
    return {topic["id"]: topic for topic in json.loads(path.read_text(encoding="utf-8"))}


def render_topic_pdf(topic: dict, resource: str) -> bytes:
    if resource not in RESOURCES:
        raise ValueError("Recurso no válido.")
    content = topic["didactic"]
    blue, ink, muted = [colors.HexColor(v) for v in ("#0868dc", "#102753", "#577095")]
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("TopicTitle", fontName="Helvetica-Bold", fontSize=23, leading=28, textColor=ink, spaceAfter=10))
    styles.add(ParagraphStyle("TopicHeading", fontName="Helvetica-Bold", fontSize=12, leading=17, textColor=blue, spaceBefore=15, spaceAfter=7))
    styles.add(ParagraphStyle("TopicBody", fontName="Helvetica", fontSize=10, leading=16, textColor=ink, spaceAfter=6))
    styles.add(ParagraphStyle("TopicMeta", fontSize=9, leading=14, textColor=muted, spaceAfter=7))
    replace = str.maketrans({"→": " -> ", "−": "-", "–": "-", "—": "-", "×": " x ",
                            "²": "^2", "³": "^3", "₀": "0", "₂": "2"})

    def paragraph(text, style="TopicBody"):
        return Paragraph(escape(str(text).translate(replace)).replace("\n", "<br/>"), styles[style])

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
