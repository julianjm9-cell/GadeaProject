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
        image_ref = {"id": "owned-image", "filename": "animal.png", "credit": "Imagen de Ana en Pixabay"}
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
            self.assertIn("Imagen de Ana en Pixabay", text)
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

    def test_extended_formats_are_printable(self):
        material = {"title": "Repaso dinámico", "subject": "Ciencias", "activity": {
            "context": {"course": "3.º ESO"},
            "questions": [
                {"type": "multigaps", "prompt": "El agua pasa de ___ a ___.", "answer": "líquido | sólido", "options": ["líquido", "sólido"]},
                {"type": "numeric", "prompt": "¿Cuánto es 25 ÷ 2?", "answer": "12,5", "options": []},
                {"type": "pasapalabra", "prompt": "Completa la rueda", "answer": "Completado", "options": ["A | Líquido esencial | agua", "B | Lugar con libros | biblioteca", "C | Pigmento verde | clorofila"]},
                {"type": "hangman", "prompt": "Estrella del sistema solar", "answer": "Sol", "options": []},
            ]}}
        worksheet = self.text(render_teacher_pdf(material, False, lambda _: self.image))
        solutions = self.text(render_teacher_pdf(material, True, lambda _: self.image))
        self.assertIn("Pasapalabra", worksheet)
        self.assertIn("Lugar con libros", worksheet)
        self.assertNotIn("biblioteca", worksheet)
        self.assertIn("biblioteca", solutions)
        self.assertIn("12,5", solutions)
        self.assertIn("Sol", solutions)

    def test_worksheet_reorders_sequences_and_matching_without_explanations(self):
        material = {'title': 'Razonamiento', 'activity': {'questions': [
            {'type': 'order', 'prompt': 'Ordena el crecimiento', 'answer': 'Semilla → Brote → Planta', 'options': ['Semilla', 'Brote', 'Planta'], 'explanation': 'La semilla germina y produce un brote.'},
            {'type': 'dragdrop', 'prompt': 'Relaciona', 'answer': 'Completado', 'options': ['Gato | Mamífero', 'Pato | Ave', 'Rana | Anfibio']},
            {'type': 'problem', 'prompt': 'Dos cajas con tres libros cada una', 'answer': '6 libros', 'rubric': 'Multiplica y expresa la unidad.'},
        ]}}
        worksheet = self.text(render_teacher_pdf(material, False, lambda _: self.image))
        solutions = self.text(render_teacher_pdf(material, True, lambda _: self.image))
        self.assertLess(worksheet.index('Planta'), worksheet.index('Semilla'))
        self.assertIn('A. Ave', worksheet)
        self.assertNotIn('Gato | Mamífero', worksheet)
        self.assertNotIn('La semilla germina', worksheet)
        self.assertIn('La semilla germina', solutions)
        self.assertIn('Criterios de revisión', solutions)
        for field in ['Datos', 'Planteamiento', 'Cálculos', 'Respuesta y comprobación']:
            self.assertIn(field, worksheet)

    def test_long_materials_keep_reading_once_and_matching_banks_separate(self):
        material={'title':'Lectura y vocabulario','activity':{'questions':[
            {'type':'reading','activityGroup':1,'prompt':'¿Quién llega?','answer':'Ana','text':'Una historia única sobre el barrio.'},
            {'type':'reading','activityGroup':1,'prompt':'¿Dónde ocurre?','answer':'En el barrio','text':'Una historia única sobre el barrio.'},
            {'type':'pairs','activityGroup':2,'prompt':'Primer concepto','answer':'Respuesta del primer bloque'},
            {'type':'pairs','activityGroup':2,'prompt':'Segundo concepto','answer':'Otra respuesta del primer bloque'},
            {'type':'pairs','activityGroup':3,'prompt':'Tercer concepto','answer':'Respuesta del segundo bloque'},
            {'type':'pairs','activityGroup':3,'prompt':'Cuarto concepto','answer':'Otra respuesta del segundo bloque'},
        ]}}
        text=self.text(render_teacher_pdf(material,False,lambda _:self.image))
        self.assertEqual(text.count('Una historia única sobre el barrio.'),1)
        first=text[text.index('Primer concepto'):text.index('Segundo concepto')]
        self.assertNotIn('segundo bloque',first)
        self.assertIn('primer bloque',first)
        material['activity']['questions']=[{'type':'gaps','prompt':f'Pregunta {i}: ___','answer':str(i)} for i in range(30)]
        text=self.text(render_teacher_pdf(material,False,lambda _:self.image))
        self.assertIn('Pregunta 29',text)


if __name__ == "__main__":
    unittest.main()
