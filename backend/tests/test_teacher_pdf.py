from __future__ import annotations

from io import BytesIO
from pathlib import Path
import sys
import unittest

from PIL import Image
from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.teacher_pdf import render_teacher_pdf


class TeacherPdfTests(unittest.TestCase):
    def setUp(self):
        image = BytesIO()
        Image.new("RGB", (500, 300), "#cceeff").save(image, "PNG")
        self.image = image.getvalue()
        image_ref = {"id": "owned-image", "filename": "animal.png"}
        self.material = {"title": "Los animales", "subject": "Ciencias", "activity": {
            "context": {"course": "4.º Primaria"},
            "questions": [
                {"type": "visualquiz", "prompt": "¿Qué aparece?", "answer": "Zorro", "options": ["Zorro", "Oso"], "image": image_ref},
                {"type": "imagepoint", "prompt": "Señala la cabeza", "answer": "Zona marcada", "target": {"x": 40, "y": 30}, "image": image_ref},
                {"type": "wordsearch", "prompt": "Busca los nombres", "answer": "Completado", "options": ["GATO", "PATO", "RANA"]},
                {"type": "crossword", "prompt": "Completa las palabras", "answer": "Completado", "options": ["GATO | Felino", "PATO | Ave acuática", "RATA | Roedor"]},
            ]}}

    def text(self, pdf):
        self.assertTrue(pdf.startswith(b"%PDF"))
        reader = PdfReader(BytesIO(pdf))
        return " ".join(page.extract_text() for page in reader.pages)

    def test_ficha_and_separate_solutions(self):
        worksheet = self.text(render_teacher_pdf(self.material, False, lambda _: self.image))
        solutions = self.text(render_teacher_pdf(self.material, True, lambda _: self.image))
        for text in (worksheet, solutions):
            self.assertIn("Los animales", text)
            self.assertIn("Señala la cabeza", text)
            self.assertIn("Ave acuática", text)
        self.assertNotIn("Solución:", worksheet)
        self.assertIn("Solución:", solutions)
        self.assertIn("Zona marcada por el profesor", solutions)

    def test_rejects_missing_or_invalid_image(self):
        with self.assertRaisesRegex(ValueError, "imagen"):
            render_teacher_pdf(self.material, False, lambda _: b"not an image")
        self.material["activity"]["questions"][0].pop("image")
        with self.assertRaisesRegex(ValueError, "imagen"):
            render_teacher_pdf(self.material, False, lambda _: self.image)

    def test_escapes_teacher_text(self):
        self.material["title"] = "Ciencias <script>alert(1)</script>"
        text = self.text(render_teacher_pdf(self.material, False, lambda _: self.image))
        self.assertIn("Ciencias", text)
        self.assertIn("<script>", text)


if __name__ == "__main__":
    unittest.main()
