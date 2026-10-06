from io import BytesIO
from pypdf import PdfReader
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Table
from app.services.teacher_pdf import render_teacher_pdf
from app.services.teacher_rich_text import formatted_text, text_blocks


def test_safe_math_blocks_and_emphasis():
    examples = [r'\(\frac{3}{4}\)', r'\[\sqrt{x^2 + 1}\]',
                r'\[\begin{cases}x+y=3\\x-y=1\end{cases}\]',
                r'\[\begin{pmatrix}1&2\\3&4\end{pmatrix}\]']
    for source in examples:
        rendered = formatted_text(source)
        assert '<img src="data:image/png;base64,' in rendered
        assert '\\begin' not in rendered and '\\sqrt' not in rendered and '\\frac' not in rendered
    safe = formatted_text('<script>alert(1)</script> **Importante** y *detalle*.')
    assert '<script>' not in safe
    assert '<b>Importante</b>' in safe and '<i>detalle</i>' in safe
    assert formatted_text('2x = 4 → x = 2').count('<br/>') == 1
    assert formatted_text('x+y = 3; x-y = 1 → 2x = 4 → x = 2').count('<br/>') == 3
    assert formatted_text('**El denominador** y la incógnita').count('<b>') == 2
    mixed = text_blocks('Antes\n\n| Concepto | Valor |\n| --- | --- |\n| mitad | 1/2 |\n\nDespués', getSampleStyleSheet()['BodyText'], 400)
    assert len(mixed) == 3 and isinstance(mixed[1], Table)


def test_math_pdf_contains_formulae_and_formatted_table_without_raw_tex():
    material = {'title':'Fórmulas y resolución','subject':'Matemáticas','activity':{'questions':[
        {'type':'short','prompt':r'Resuelve \[\begin{cases}x+y=3\\x-y=1\end{cases}\].',
         'answer':'x=2, y=1','explanation':'x + y = 3 → 2x = 4 → x = 2'},
        {'type':'numeric','prompt':r'Calcula \(\frac{1}{2}+\sqrt{4}\).','answer':'2.5'},
        {'type':'reading','text':'| Magnitud | Valor |\n| --- | --- |\n| Lado | 3 cm |\n| Área | 9 cm² |',
         'prompt':'**Compara** los valores de la tabla.','answer':'Las unidades son distintas.'}
    ]}}
    pdf = render_teacher_pdf(material, True, lambda _: b'')
    pages = PdfReader(BytesIO(pdf)).pages
    text = '\n'.join(page.extract_text() for page in pages)
    assert 'Magnitud' in text and 'Compara' in text and '**' not in text
    assert '\\begin' not in text and '\\frac' not in text and '\\sqrt' not in text
    assert sum(len(page.images) for page in pages) >= 3
    assert '■' not in text
