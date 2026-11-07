"""Compatible validation for existing study accounts; never discard unknown fields."""
from fastapi import HTTPException

MAPS = {'done', 'lessonNotes', 'learningEvidence', 'gameResults', 'teacherChats', 'testAttempts',
        'monthlyProgress', 'b2Progress', 'b2Games', 'b2GameRuns', 'writingPractice', 'recitePractice'}
LISTS = {'scores', 'attempts', 'mistakes', 'activityDates', 'savedNotes', 'history'}


def validate_study_state(previous, incoming, *, confirm_empty=False):
    if previous and not incoming and not confirm_empty:
        raise HTTPException(409, detail={'code': 'state_empty', 'message':
            'El guardado dejaría vacío tu progreso. Se ha detenido para proteger tus apuntes y resultados.'})
    if confirm_empty and not incoming:
        return
    for field in MAPS | LISTS:
        expected = dict if field in MAPS else list
        if field in incoming and (field not in previous or incoming[field] != previous[field]) and not isinstance(incoming[field], expected):
            raise HTTPException(422, f'El campo {field} no es válido. El progreso guardado se conserva.')
        if previous.get(field) and field not in incoming:
            raise HTTPException(422, f'Faltan datos de {field}. El progreso guardado se conserva.')
    stack, nodes = [(incoming, 0)], 0
    while stack:
        value, depth = stack.pop(); nodes += 1
        if depth > 24 or nodes > 250_000:
            raise HTTPException(422, 'El progreso supera el tamaño de estructura permitido.')
        if isinstance(value, dict):
            stack.extend((item, depth + 1) for item in value.values())
        elif isinstance(value, list):
            if len(value) > 10_000:
                raise HTTPException(422, 'Una lista de progreso es demasiado grande.')
            stack.extend((item, depth + 1) for item in value)
