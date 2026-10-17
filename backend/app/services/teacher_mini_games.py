"""Content rules shared by generation and code-based play for the three new games."""
import re
from app.services.teacher_generation_contract import text_key

MINI_GAMES = frozenset(('mystery', 'intruder', 'bingo'))


def validate_bingo_pair(concept, clue):
    if not isinstance(concept, str) or not isinstance(clue, str) or not 1 <= len(concept.strip()) <= 80 or not 1 <= len(clue.strip()) <= 140:
        raise ValueError('Bingo: concepto hasta 80 caracteres y definición hasta 140.')
    if len(text_key(concept)) >= 3 and re.search(r'(?<!\w)' + re.escape(text_key(concept)) + r'(?!\w)', text_key(clue)):
        raise ValueError('Una definición del bingo contiene su propia respuesta.')


def validate_mini_game(kind, answer, options):
    if kind not in MINI_GAMES:
        return
    if not isinstance(options, list) or any(not isinstance(item, str) or not item.strip() for item in options):
        raise ValueError('Completa todos los elementos del juego.')
    if kind == 'mystery':
        if len(options) != 3 or not isinstance(answer, str) or not 1 <= len(answer.strip()) <= 100 or any(len(clue) > 300 for clue in options):
            raise ValueError('¿Quién soy?: tres pistas y una respuesta de hasta 100 caracteres.')
        if len({text_key(clue) for clue in options}) != 3:
            raise ValueError('Las tres pistas deben ser distintas.')
        if any(re.search(r'(?<!\w)' + re.escape(text_key(answer)) + r'(?!\w)', text_key(clue)) for clue in options):
            raise ValueError('Las pistas no pueden incluir la respuesta del misterio.')
    elif kind == 'intruder':
        if not 3 <= len(options) <= 5 or any(len(item) > 140 for item in options) or answer not in options or len({text_key(item) for item in options}) != len(options):
            raise ValueError('Intruso: entre tres y cinco tarjetas distintas y una solución que coincida exactamente con una tarjeta.')
    else:
        pairs = [[part.strip() for part in item.split('|')] for item in options]
        if len(pairs) != 9 or any(len(pair) != 2 or not 1 <= len(pair[0]) <= 80 or not 1 <= len(pair[1]) <= 140 for pair in pairs):
            raise ValueError('Bingo: nueve líneas concepto | definición; concepto hasta 80 caracteres y definición hasta 140.')
        if any(len({text_key(pair[side]) for pair in pairs}) != 9 for side in (0, 1)):
            raise ValueError('Bingo: no repitas conceptos ni definiciones.')
        for concept, clue in pairs:
            validate_bingo_pair(concept, clue)
