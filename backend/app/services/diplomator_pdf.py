"""Printable study notes assembled from the points the user accepted."""

from __future__ import annotations

from html import escape
from datetime import datetime
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer


def _fonts() -> tuple[str, str]:
    roots = (
        Path('/usr/share/fonts/truetype/dejavu'),
        Path('C:/Windows/Fonts'),
    )
    for root in roots:
        regular = root / ('DejaVuSans.ttf' if root.name != 'Fonts' else 'arial.ttf')
        bold = root / ('DejaVuSans-Bold.ttf' if root.name != 'Fonts' else 'arialbd.ttf')
        if regular.is_file() and bold.is_file():
            if 'DiplomatorSans' not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont('DiplomatorSans', str(regular)))
                pdfmetrics.registerFont(TTFont('DiplomatorSansBold', str(bold)))
            return 'DiplomatorSans', 'DiplomatorSansBold'
    return 'Helvetica', 'Helvetica-Bold'


def _plain(value: object, limit: int = 10000) -> str:
    return escape(str(value or '')[:limit]).replace('\n', '<br/>')


def render_diplomator_pdf(entry: dict) -> bytes:
    raw_points = entry.get('points') or []
    if not isinstance(raw_points, list) or len(raw_points) > 30:
        raise ValueError('Selecciona hasta 30 puntos para exportar.')
    points = [point for point in raw_points if isinstance(point, dict) and str(point.get('text') or '').strip()]
    raw_oral = entry.get('oralPractices') or []
    oral = [item for item in raw_oral if isinstance(item, dict) and str(item.get('correction') or '').strip()] if isinstance(raw_oral, list) else []
    if not points and not oral:
        raise ValueError('No hay apuntes ni correcciones orales para exportar.')
    regular, bold = _fonts()
    navy, gold, muted = colors.HexColor('#102653'), colors.HexColor('#bd7b18'), colors.HexColor('#667895')
    title = ParagraphStyle('title', fontName=bold, fontSize=20, leading=25, textColor=navy, spaceAfter=8)
    meta = ParagraphStyle('meta', fontName=regular, fontSize=9, leading=14, textColor=muted, spaceAfter=14)
    heading = ParagraphStyle('heading', fontName=bold, fontSize=12, leading=17, textColor=navy, spaceBefore=13, spaceAfter=6)
    body = ParagraphStyle('body', fontName=regular, fontSize=9.5, leading=15, textColor=navy, spaceAfter=7)
    aside = ParagraphStyle('aside', fontName=regular, fontSize=8.8, leading=13, textColor=muted, leftIndent=12, spaceAfter=6)
    buffer = BytesIO()
    date_value = str(entry.get('date') or '')
    try:
        date_value = datetime.fromisoformat(date_value.replace('Z', '+00:00')).strftime('%d/%m/%Y')
    except ValueError:
        date_value = date_value[:40]
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=21*mm, leftMargin=21*mm, topMargin=18*mm, bottomMargin=18*mm, title=str(entry.get('topic') or 'Diplomator')[:150])
    story = [Paragraph('DIPLOMATOR', ParagraphStyle('brand', fontName=bold, fontSize=9, leading=12, textColor=gold, spaceAfter=8)),
             Paragraph(_plain(entry.get('topic'), 250), title),
             Paragraph(f"{_plain(date_value, 40)} &nbsp;·&nbsp; {_plain('Français C1' if entry.get('lang') == 'fr' else 'English C1', 30)}", meta),
             HRFlowable(width='100%', thickness=0.7, color=colors.HexColor('#dce5ee'))]
    for index, point in enumerate(points, 1):
        story.append(Paragraph(f"{index:02d} &nbsp; {_plain(point.get('title') or 'Idea', 250)}", heading))
        story.append(Paragraph(_plain(point.get('text'), 10000), body))
        for item in point.get('datedInfo') or []:
            if isinstance(item, dict) and item.get('text'):
                prefix = f"{_plain(item.get('date'), 60)} · " if item.get('date') else ''
                story.append(Paragraph(prefix + _plain(item.get('text'), 1200), aside))
        if point.get('connection') and index < len(points):
            story.append(Paragraph('→ ' + _plain(point['connection'], 1000), aside))
    vocab = entry.get('vocab') or []
    if not vocab:
        # Sessions created before vocabulary became a separate choice kept it on each point.
        seen: set[str] = set()
        vocab = []
        for point in points:
            for item in point.get('vocab') or []:
                key = str(item.get('word') or '').strip().casefold() if isinstance(item, dict) else ''
                if key and key not in seen:
                    seen.add(key)
                    vocab.append(item)
    if isinstance(vocab, list) and vocab:
        story.extend([Spacer(1, 8), HRFlowable(width='100%', thickness=0.7, color=colors.HexColor('#dce5ee')), Paragraph('Vocabulario guardado', heading)])
        for item in vocab[:30]:
            if isinstance(item, dict) and item.get('word'):
                line = f"{_plain(item.get('word'), 150)} — {_plain(item.get('def'), 300)}"
                if item.get('example'):
                    line += f"<br/><font color='#667895'>{_plain(item.get('example'), 450)}</font>"
                story.append(Paragraph(line, body))
    if oral:
        story.extend([Spacer(1, 10), HRFlowable(width='100%', thickness=0.7, color=colors.HexColor('#dce5ee')), Paragraph('Práctica oral y corrección', heading)])
        for index, practice in enumerate(oral[:20], 1):
            story.append(Paragraph(f'Práctica {index}', heading))
            if practice.get('notes'):
                story.append(Paragraph('Notas de preparación', heading))
                story.append(Paragraph(_plain(practice.get('notes'), 12000), body))
            if practice.get('transcript'):
                story.append(Paragraph('Transcripción', heading))
                story.append(Paragraph(_plain(practice.get('transcript'), 25000), body))
            story.append(Paragraph('Corrección', heading))
            story.append(Paragraph(_plain(practice.get('correction'), 25000), body))
    doc.build(story)
    return buffer.getvalue()
