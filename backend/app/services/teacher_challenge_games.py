"""Validated content and server-side answers for four self-contained games."""
import random
import re
import secrets

from app.services.teacher_generation_contract import text_key

TYPES = frozenset(('multiselect', 'table', 'cipher', 'race'))
FIELDS = {'multiselect': ('label', 'correct'), 'table': ('row', 'column', 'answer'),
          'cipher': ('clue', 'answer', 'letter'), 'race': ('question', 'answer', 'distractor1', 'distractor2')}
LIMITS = {'multiselect': (3, 6), 'table': (4, 12), 'cipher': (3, 10), 'race': (4, 12)}


def parse_entry(kind, value):
    if not isinstance(value, str) or len(value) > 300 or '\n' in value or '\r' in value:
        raise ValueError('Cada fila admite hasta 300 caracteres.')
    parts = [part.strip() for part in value.split('|')]
    if len(parts) != len(FIELDS[kind]) or any(not part for part in parts):
        raise ValueError('Completa todas las columnas de cada fila, separadas con |.')
    if kind == 'multiselect':
        if len(parts[0]) > 180 or parts[1].casefold() not in ('sí', 'si', 'no'):
            raise ValueError('Cada opción necesita un texto y sí o no para indicar si es correcta.')
        parts[1] = 'sí' if parts[1].casefold() in ('sí', 'si') else 'no'
    elif kind == 'table':
        if any(len(part) > 80 for part in parts):
            raise ValueError('Tabla: fila, columna y solución de hasta 80 caracteres.')
    elif kind == 'cipher':
        if len(parts[0]) > 180 or len(parts[1]) > 80 or not re.fullmatch(r'[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]', parts[2]):
            raise ValueError('Mensaje: pista hasta 180 caracteres, respuesta hasta 80 y una letra como premio.')
        if any(not answer.strip() for answer in parts[1].split('~')):
            raise ValueError('Las respuestas equivalentes no pueden quedar vacías.')
        if any(re.search(r'(?<!\w)' + re.escape(text_key(answer)) + r'(?!\w)', text_key(parts[0])) for answer in parts[1].split('~')):
            raise ValueError('La pista no puede contener su respuesta.')
        parts[2] = parts[2].upper()
    elif kind == 'race':
        if len(parts[0]) > 150 or any(len(part) > 60 for part in parts[1:]) or len({text_key(part) for part in parts[1:]}) != 3:
            raise ValueError('Carrera: pregunta hasta 150 caracteres y tres respuestas distintas de hasta 60.')
    return parts


def validate(kind, options):
    if kind not in TYPES:
        return
    minimum, maximum = LIMITS[kind]
    if not isinstance(options, list) or not minimum <= len(options) <= maximum:
        raise ValueError(f'{kind}: usa entre {minimum} y {maximum} filas.')
    rows = [parse_entry(kind, item) for item in options]
    identity = lambda row: tuple(text_key(part) for part in row[:2]) if kind == 'table' else (text_key(row[0]),)
    if len({identity(row) for row in rows}) != len(rows):
        raise ValueError('No repitas opciones, pistas, preguntas ni casillas de una tabla.')
    if kind == 'multiselect' and not 2 <= sum(row[1] == 'sí' for row in rows) < len(rows):
        raise ValueError('Selecciona todas: al menos dos opciones correctas y una incorrecta.')
    if kind == 'table':
        row_names, columns = {text_key(row[0]) for row in rows}, {text_key(row[1]) for row in rows}
        if not 2 <= len(row_names) <= 6 or not 2 <= len(columns) <= 4 or len(rows) != len(row_names) * len(columns):
            raise ValueError('La tabla necesita de 2 a 6 filas, de 2 a 4 columnas y todas sus casillas (hasta 12).')


def prepare(kind, options, seed):
    validate(kind, options)
    entries = []
    row_names, columns = {}, {}
    for parts in map(lambda item: parse_entry(kind, item), options):
        if kind == 'multiselect':
            entries.append({'label': parts[0], 'answer': parts[1] == 'sí'})
        elif kind == 'table':
            entries.append({'row': row_names.setdefault(text_key(parts[0]), parts[0]),
                            'column': columns.setdefault(text_key(parts[1]), parts[1]), 'answer': parts[2]})
        elif kind == 'cipher':
            entries.append({'clue': parts[0], 'answer': parts[1], 'letter': parts[2]})
        else:
            choices = [{'token': secrets.token_urlsafe(12), 'label': label} for label in parts[1:]]
            answer = choices[0]['token']
            random.Random(str(seed) + parts[0]).shuffle(choices)
            entries.append({'clue': parts[0], 'choices': choices, 'answer': answer})
    if kind == 'multiselect':
        random.Random(seed).shuffle(entries)
    return entries


def grade(q, value, part=None):
    entries = q['_challenge']
    if not isinstance(value, list) or len(value) != len(entries):
        return 'unanswered'
    if part is not None:
        if not 0 <= part < len(entries):
            return 'unanswered'
        actual, expected = value[part], entries[part]['answer']
        if q['type'] == 'multiselect':
            return 'unanswered' if type(actual) is not bool else 'correct' if actual is expected else 'incorrect'
        if not isinstance(actual, str) or not actual.strip():
            return 'unanswered'
        if q['type'] == 'race':
            return 'correct' if actual == expected else 'incorrect'
        return 'correct' if text_key(actual) in [text_key(answer) for answer in expected.split('~')] else 'incorrect'
    if q['type'] == 'multiselect' and not any(item is True for item in value):
        return 'unanswered'
    results = [grade(q, value, index) for index in range(len(entries))]
    return 'unanswered' if 'unanswered' in results else 'correct' if all(result == 'correct' for result in results) else 'incorrect'


def safe_items(q, value, parts, completed=False):
    items = []
    for index, entry in enumerate(q['_challenge']):
        item = {field: entry[field] for field in ('label', 'row', 'column', 'clue', 'choices') if field in entry}
        if q['type'] == 'cipher':
            item['letter'] = entry['letter'] if completed or parts.get(str(index)) == 'correct' and grade(q, value, index) == 'correct' else ''
        items.append(item)
    return items


def solutions(q):
    return [(entry.get('label') or ' · '.join(filter(None, (entry.get('row'), entry.get('column')))) or entry.get('clue', '')) + ': ' +
            (('Sí' if entry['answer'] else 'No') if q['type'] == 'multiselect' else
             next(choice['label'] for choice in entry['choices'] if choice['token'] == entry['answer']) if q['type'] == 'race' else entry['answer'])
            for entry in q['_challenge']]
