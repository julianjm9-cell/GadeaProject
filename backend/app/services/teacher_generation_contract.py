"""One wire contract and lossless recovery for every generated exercise.

The model supplies educational content. Application-only fields and game layouts
are assembled here, before the existing academic and player validators run.
"""
import json
import re
import unicodedata

from fastapi import HTTPException


BOARDS = {'wordsearch', 'crossword', 'memory', 'dragdrop', 'pasapalabra'}
SEQUENCES = {'order', 'sentence', 'timeline'}
LETTER_ORDER = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'


def generation_units(context):
    from app.services.teacher_generator import TYPES, ELEMENT_LIMITS
    if context.get('regeneration'):
        kind = context['regeneration']['question']['type']
        return context['activitySizes'][kind] if kind in ELEMENT_LIMITS else 1
    return sum(context.get('activitySizes', {}).values()) or sum(context[k] for k in TYPES)


class GenerationAlreadyCompleted(Exception):
    def __init__(self, questions):
        self.result = {'ok': True, 'questions': questions, 'credits': 1, 'reused': True}


def text_key(value):
    value = str(value).casefold().replace('ñ', '\x01')
    return ''.join(c for c in unicodedata.normalize('NFD', value) if not unicodedata.combining(c)).replace('\x01', 'ñ').strip()


def read_document(content):
    if not isinstance(content, str) or not content.strip() or len(content) > 60000:
        raise ValueError('response: la respuesta está vacía o supera el tamaño permitido.')
    raw = content.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Read the first complete JSON value; do not repair truncated strings or
        # guess answers. Fences and introductory prose are harmless formatting.
        starts = [match.start() for match in re.finditer(r'[\[{]', raw)]
        for start in starts[:8]:
            try:
                return json.JSONDecoder().raw_decode(raw[start:])[0]
            except json.JSONDecodeError:
                continue
        raise ValueError('json: la IA devolvió un JSON incompleto o ilegible.') from None


def question_rows(document, kind):
    if isinstance(document, list):
        return document
    if not isinstance(document, dict):
        raise ValueError('questions: debe ser un objeto o una lista de ejercicios.')
    for field in ('questions', 'activities'):
        if field in document:
            if not isinstance(document[field], list):
                raise ValueError(f'{field}: debe ser una lista.')
            return document[field]
    if document.get('type') == kind or any(field in document for field in ('prompt', 'roscoEntries', 'entries', 'clozeText', 'words', 'items')):
        return [document]
    raise ValueError('questions: falta la lista de ejercicios solicitados.')


def wire_schema(context):
    from app.services.teacher_generator import TYPES
    kind = next(k for k in TYPES if context[k])
    string = {'type': 'string'}
    size = context.get('elementCount')
    def array(items, count=None):
        value = {'type': 'array', 'items': items}
        if count is not None:
            value.update(minItems=count, maxItems=count)
        return value
    def obj(properties):
        return {'type': 'object', 'properties': properties, 'required': list(properties), 'additionalProperties': False}
    properties = {'type': {'type': 'string', 'enum': [kind]}, 'prompt': string, 'explanation': string}
    if kind == 'pasapalabra':
        properties['roscoEntries'] = array(obj({'clue': string, 'answer': string}), size)
    elif kind in ('memory', 'dragdrop', 'crossword'):
        fields = ('left', 'right') if kind == 'memory' else ('element', 'target') if kind == 'dragdrop' else ('word', 'clue')
        properties['entries'] = array(obj({field: string for field in fields}), size)
    elif kind == 'wordsearch':
        properties['words'] = array(string, size)
    elif kind in SEQUENCES:
        properties['items'] = array(string, size)
    elif kind == 'multigaps':
        properties['clozeText'] = string
        properties['clozeGaps'] = array(obj({'fragment': string, 'answer': string, 'infinitive': string, 'explanation': string}), size)
    else:
        properties['answer'] = string
        if kind in ('quiz', 'classify'):
            properties['options'] = {**array(string), 'minItems': 2, 'maxItems': 5}
        if kind == 'boolean':
            properties['answer'] = {'type': 'string', 'enum': ['Verdadero', 'Falso']}
        if kind == 'reading':
            properties['text'] = string
        if kind == 'numeric':
            properties.update(calculation=string, unit=string)
        if kind == 'error':
            properties.update(errorSegment=string, correctedSegment=string)
    return obj({'questions': array(obj(properties), context[kind])})


def normalize_question(source, kind, context):
    if not isinstance(source, dict):
        raise ValueError('question: cada ejercicio debe ser un objeto.')
    q = dict(source)
    q.setdefault('type', kind)  # Exactly one type is selected in this request.
    for canonical, aliases in {'prompt': ('enunciado', 'question'), 'answer': ('respuesta', 'solution'), 'explanation': ('explicacion',)}.items():
        if canonical not in q:
            for alias in aliases:
                if alias in q:
                    q[canonical] = q[alias]
                    break
    if q['type'] != kind:
        raise ValueError(f'type: se pidió {kind}, no {q["type"]}.')
    if kind in BOARDS | SEQUENCES | {'multigaps'}:
        q.setdefault('prompt', {'pasapalabra': 'Resuelve las pistas del rosco.', 'wordsearch': 'Encuentra las palabras.', 'crossword': 'Completa el crucigrama.', 'memory': 'Encuentra las parejas.', 'dragdrop': 'Relaciona cada elemento con su destino.', 'multigaps': 'Completa el texto.'}.get(kind, 'Ordena los elementos.'))
        q['answer'] = 'Completado'  # These formats derive their answer from items.
    if kind in ('numeric', 'gaps') and type(q.get('answer')) in (int, float):
        q['answer'] = str(q['answer'])
    if kind == 'numeric' and isinstance(q.get('calculation'), str) and q['calculation'].count('=') == 1:
        from app.services.teacher_question_quality import arithmetic
        expression, result = q['calculation'].split('=')
        # A verified equality is harmless notation. Never remove an incorrect
        # result, prose or units to make an unverifiable calculation pass.
        try:
            expected, stated, answer = arithmetic(expression), arithmetic(result), arithmetic(q['answer'])
            if abs(expected - stated) <= 1e-9 and abs(expected - answer) <= max(q.get('tolerance', 0), 1e-9):
                q['calculation'] = expression.strip()
        except (ValueError, SyntaxError, KeyError, TypeError, ZeroDivisionError, OverflowError):
            pass
    if kind == 'boolean':
        q['options'] = ['Verdadero', 'Falso']
        if type(q.get('answer')) is bool:
            q['answer'] = 'Verdadero' if q['answer'] else 'Falso'
        elif isinstance(q.get('answer'), str):
            q['answer'] = {'true': 'Verdadero', 'false': 'Falso', 'verdadero': 'Verdadero', 'falso': 'Falso'}.get(q['answer'].strip().casefold(), q['answer'])
    if kind in SEQUENCES and 'items' in q:
        q['options'] = q['items']
    if kind == 'wordsearch' and 'words' in q:
        q['options'] = q['words']
    if kind in ('memory', 'dragdrop', 'crossword') and isinstance(q.get('entries'), list):
        fields = ('left', 'right') if kind == 'memory' else ('element', 'target') if kind == 'dragdrop' else ('word', 'clue')
        q['options'] = [' | '.join(str(row.get(field, '')).strip() for field in fields) if isinstance(row, dict) else row for row in q['entries']]
    # Optional display metadata never discards playable content. Academic
    # assertions in explanation and numeric calculation remain strictly checked.
    for field, count, limit in (('hints', 3, 300), ('alternatives', 6, 100), ('wordBank', 12, 100)):
        values = q.get(field)
        if isinstance(values, list):
            q[field] = [value.strip() for value in values if isinstance(value, str) and 0 < len(value.strip()) <= limit][:count]
        else:
            q.pop(field, None)
    for field in ('rubric', 'optionFeedback', 'itemExplanations'):
        if q.get(field) is None:
            q.pop(field, None)
    if isinstance(q.get('answer'), str) and len(q['answer'].strip()) >= 3 and q.get('hints'):
        solution = text_key(q['answer'])
        q['hints'] = [hint for hint in q['hints'] if not re.search(r'(?<!\w)' + re.escape(solution) + r'(?!\w)', text_key(hint))]
    if kind == 'reading' and context.get('readingPassage') and not q.get('text'):
        q['text'] = context['readingPassage']
    return q


def assign_rosco_letters(entries):
    """Maximum matching: choose a different letter present in each real answer."""
    owners = {}
    choices = []
    for row in entries:
        answer = text_key(row['answer']).upper()
        choices.append(list(dict.fromkeys([answer[0]] + [letter for letter in LETTER_ORDER if letter in answer])) if answer else [])
    def place(index, visited):
        for letter in choices[index]:
            if letter not in LETTER_ORDER or letter in visited:
                continue
            visited.add(letter)
            owner = owners.get(letter)
            if owner is None or place(owner, visited):
                owners[letter] = index
                return True
        return False
    for index in range(len(entries)):
        if not place(index, set()):
            raise ValueError('rosco_letters: estas respuestas no permiten letras distintas; elige otro concepto del tema.')
    assigned = {index: letter for letter, index in owners.items()}
    return [{**row, 'letter': assigned[index]} for index, row in enumerate(entries)]


class GenerationDraft:
    """Keep validated questions/items across provider and repair attempts."""
    def __init__(self, context, saved=None, prior=None):
        from app.services.teacher_generator import TYPES
        self.context = dict(context)
        self.kind = next(k for k in TYPES if context[k])
        self.target = context.get('elementCount', context[self.kind])
        self.questions = list((saved or {}).get('questions', []))
        self.elements = list((saved or {}).get('elements', []))
        self.metadata = dict((saved or {}).get('metadata', {}))
        self.prior = list(prior or [])
        self.issues = []

    @property
    def completed(self):
        return len(self.elements) if self.kind in BOARDS else len(self.questions)

    @property
    def complete(self):
        return self.completed == (self.target if self.kind in BOARDS else self.context[self.kind])

    def snapshot(self):
        return {'questions': self.questions, 'elements': self.elements, 'metadata': self.metadata}

    def request_context(self):
        batch = {**self.context, 'contentContract': 2}
        if self.kind in BOARDS:
            batch['elementCount'] = min(6, self.target - len(self.elements)) if self.kind == 'pasapalabra' else self.target - len(self.elements)
            batch['acceptedElements'] = self.elements
            batch.pop('roscoLetters', None)
            batch['roscoFlexible'] = self.kind == 'pasapalabra'
        else:
            batch[self.kind] = self.context[self.kind] - len(self.questions)
            batch['batchQuestionCount'] = batch[self.kind]
            batch['previousPrompts'] = batch.get('previousPrompts', []) + [q['prompt'] for q in self.questions]
            if self.kind == 'reading' and self.questions:
                batch['readingPassage'] = self.questions[0]['text']
            if self.kind == 'classify' and self.questions:
                batch['classificationCategories'] = self.questions[0]['options']
        if self.issues:
            batch['repairInstruction'] = 'Corrige solo los elementos pendientes: ' + ' '.join(self.issues[:3])[:900]
        return batch

    def ingest(self, content):
        from app.services.teacher_generator import TYPES, parse_material, check_material_quality, puzzle_word
        self.issues = []
        try:
            rows = question_rows(read_document(content), self.kind)
        except ValueError as exc:
            self.issues = [str(exc)]
            return 0
        before = self.completed
        for source in rows:
            if self.complete:
                break
            try:
                q = normalize_question(source, self.kind, self.request_context())
                if self.kind in BOARDS:
                    if isinstance(q.get('explanation'), str) and q['explanation'].strip():
                        self.metadata.update(prompt=q['prompt'], explanation=q['explanation'].strip())
                    items = q.get('roscoEntries', q.get('options', [])) if self.kind == 'pasapalabra' else q.get('options', [])
                    if not isinstance(items, list):
                        raise ValueError('elements: falta la lista de elementos del tablero.')
                    for item in items:
                        if self.complete:
                            break
                        try:
                            if self.kind == 'pasapalabra':
                                if isinstance(item, str):
                                    parts = item.split('|')
                                    item = {'clue': parts[-2].strip(), 'answer': parts[-1].strip()} if len(parts) in (2, 3) else {}
                                if not isinstance(item, dict) or any(not isinstance(item.get(field), str) or not item[field].strip() for field in ('clue', 'answer')):
                                    raise ValueError('rosco_entry: cada pista necesita clue y answer.')
                                value = {field: item[field].strip() for field in ('clue', 'answer')}
                                if len(value['clue']) > 180 or len(value['answer']) > 60 or '|' in value['clue'] + value['answer']:
                                    raise ValueError('rosco_entry: pista de hasta 180 caracteres y respuesta de hasta 60, sin barras |.')
                                if '___' in value['clue'] or re.search(r'(?<!\w)' + re.escape(text_key(value['answer'])) + r'(?!\w)', text_key(value['clue'])):
                                    raise ValueError('rosco_clue: la pista revela la respuesta o usa huecos.')
                                if any(text_key(value[field]) == text_key(old[field]) for old in self.elements for field in ('clue', 'answer')):
                                    raise ValueError('rosco_duplicate: esta pista o respuesta ya está aceptada.')
                                from app.services.teacher_generator import check_rosco_clue
                                check_rosco_clue(value['clue'], self.context)
                                assign_rosco_letters(self.elements + [value])
                            else:
                                if not isinstance(item, str):
                                    raise ValueError('element: cada elemento debe ser texto.')
                                value = item.strip()
                                if not value or len(value) > 300:
                                    raise ValueError('element: texto vacío o demasiado largo.')
                                if self.kind == 'wordsearch':
                                    value = puzzle_word(value)
                                    if not value:
                                        raise ValueError('word: usa una palabra de 3 a 12 letras.')
                                else:
                                    pair = [part.strip() for part in value.split('|')]
                                    if len(pair) != 2 or any(not part or len(part) > (120 if self.kind == 'crossword' else 100 if self.kind == 'dragdrop' else 140) for part in pair):
                                        raise ValueError('pair: faltan las dos partes de la pareja o exceden el límite.')
                                    if self.kind == 'crossword':
                                        pair[0] = puzzle_word(pair[0])
                                        if not pair[0]:
                                            raise ValueError('word: el crucigrama requiere palabras de 3 a 12 letras.')
                                        if re.search(r'(?<!\w)' + re.escape(text_key(pair[0])) + r'(?!\w)', text_key(pair[1])):
                                            raise ValueError('clue: la pista revela la palabra del crucigrama.')
                                    value = ' | '.join(pair)
                                sides = (0, 1) if self.kind == 'memory' else (0,)
                                if any(text_key(value.split('|')[side]) == text_key(old.split('|')[side]) for old in self.elements for side in sides):
                                    raise ValueError('duplicate: el elemento o su pareja ya están aceptados.')
                            self.elements.append(value)
                        except ValueError as exc:
                            self.issues.append(str(exc))
                else:
                    single = {**self.context, **{k: int(k == self.kind) for k in TYPES}, 'contentContract': 2, 'allowOptionalFeedback': True}
                    if self.kind == 'reading' and self.questions:
                        single['readingPassage'] = self.questions[0]['text']
                    if self.kind == 'classify' and self.questions:
                        single['classificationCategories'] = self.questions[0]['options']
                    clean = parse_material(json.dumps({'questions': [q]}, ensure_ascii=False), single)[0]
                    check_material_quality(self.prior + self.questions + [clean], single)
                    self.questions.append(clean)
            except (ValueError, HTTPException, KeyError, TypeError) as exc:
                self.issues.append(str(exc.detail) if isinstance(exc, HTTPException) else str(exc))
        if self.complete:
            try:
                self.result()
            except (ValueError, HTTPException) as exc:
                self.issues.append(str(exc.detail) if isinstance(exc, HTTPException) else str(exc))
                # Global layout failures need a new board; individual invalid
                # clues never clear accepted Pasapalabra/wordsearch content.
                if self.kind in BOARDS - {'pasapalabra', 'wordsearch'}:
                    self.elements = []
                elif self.kind not in BOARDS:
                    self.questions = []
                else:
                    self.elements.pop()
        return max(0, self.completed - before)

    def result(self):
        from app.services.teacher_generator import parse_material, check_material_quality
        if not self.complete:
            raise ValueError('count: faltan elementos válidos para completar la actividad.')
        if self.kind in BOARDS:
            q = {**self.metadata, 'type': self.kind, 'answer': 'Completado'}
            if self.kind == 'pasapalabra':
                assigned = assign_rosco_letters(self.elements)
                assigned.sort(key=lambda row: LETTER_ORDER.index(row['letter']))
                q['roscoEntries'] = assigned
            else:
                q['options'] = self.elements
            result = parse_material(json.dumps({'questions': [q]}, ensure_ascii=False), {**self.context, 'contentContract': 2, 'allowOptionalFeedback': True})
        else:
            result = parse_material(json.dumps({'questions': self.questions}, ensure_ascii=False), {**self.context, 'contentContract': 2, 'allowOptionalFeedback': True})
        check_material_quality(self.prior + result, self.context)
        return result
