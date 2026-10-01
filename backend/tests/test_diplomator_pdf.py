from __future__ import annotations

from io import BytesIO
from pathlib import Path
import sys
import unittest

from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.diplomator_pdf import render_diplomator_pdf


class DiplomatorPdfTests(unittest.TestCase):
    def test_exports_only_submitted_points_and_saved_vocabulary_in_order(self):
        pdf = render_diplomator_pdf({
            'topic': 'El Sahel', 'date': '2026-10-01T12:34:00Z', 'lang': 'fr',
            'points': [
                {'title': 'Contexto', 'text': 'Primera idea.', 'connection': 'Esto conduce a los actores.', 'datedInfo': [{'date': '2026', 'text': 'Ejemplo.'}]},
                {'title': 'Actores', 'text': 'Segunda idea.'},
            ],
            'vocab': [{'word': 'stability', 'def': 'estabilidad', 'example': 'Regional stability matters.'}],
        })
        self.assertTrue(pdf.startswith(b'%PDF'))
        text = ' '.join(page.extract_text() for page in PdfReader(BytesIO(pdf)).pages)
        for phrase in ('El Sahel', '01/10/2026', 'Français C1', 'Contexto', 'Actores', 'Ejemplo.', 'stability', 'estabilidad'):
            self.assertIn(phrase, text)
        self.assertLess(text.index('Primera idea'), text.index('Segunda idea'))

    def test_requires_accepted_points(self):
        with self.assertRaisesRegex(ValueError, 'puntos'):
            render_diplomator_pdf({'topic': 'Tema', 'points': []})

    def test_legacy_point_vocabulary_is_kept(self):
        pdf = render_diplomator_pdf({'topic': 'Tema antiguo', 'points': [
            {'title': 'Idea', 'text': 'Contenido.', 'vocab': [{'word': 'resilience', 'def': 'resiliencia'}]}
        ]})
        text = ' '.join(page.extract_text() for page in PdfReader(BytesIO(pdf)).pages)
        self.assertIn('resilience', text)


if __name__ == '__main__':
    unittest.main()
