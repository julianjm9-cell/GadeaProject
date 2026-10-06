"""Bounded, observable checks for generated questions; never execute model code."""
import ast
import math
import re
import unicodedata


def text_key(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.casefold()) if not unicodedata.combining(c)).strip()


def feedback_fields(question, kind, options):
    extra = {}
    if 'optionFeedback' in question:
        rows = question['optionFeedback']
        if kind not in ('quiz', 'boolean', 'classify') or not isinstance(rows, list) or len(rows) != len(options):
            raise ValueError('Añade una explicación por opción, sin omitir distractores.')
        if any(not isinstance(row, dict) or set(row) != {'option', 'explanation'} or
               row['option'] not in options or not isinstance(row['explanation'], str) or
               not 1 <= len(row['explanation'].strip()) <= 400 for row in rows):
            raise ValueError('Cada explicación necesita una opción exacta y hasta 400 caracteres.')
        if len({row['option'] for row in rows}) != len(options):
            raise ValueError('No repitas opciones en optionFeedback.')
        extra['optionFeedback'] = [dict(option=row['option'], explanation=row['explanation'].strip()) for row in rows]
    if 'itemExplanations' in question:
        values = question['itemExplanations']
        if kind not in ('multigaps', 'pasapalabra', 'crossword', 'memory', 'dragdrop', 'wordsearch', 'order', 'sentence', 'timeline') or not isinstance(values, list) or len(values) != len(options) or any(not isinstance(v, str) or not 1 <= len(v.strip()) <= 300 for v in values):
            raise ValueError('Añade una explicación breve por elemento, en el mismo orden que options.')
        extra['itemExplanations'] = [v.strip() for v in values]
    if 'calculation' in question:
        value = question['calculation']
        if kind != 'numeric' or not isinstance(value, str) or len(value) > 160:
            raise ValueError('calculation solo admite una expresión aritmética de hasta 160 caracteres.')
        extra['calculation'] = value.strip()
    return extra


def arithmetic(expression):
    """Only short literal arithmetic: no calls, names, attributes, or unbounded powers."""
    normalized = re.sub(r'\s+', ' ', expression.strip()).replace('×', '*').replace('·', '*').replace('÷', '/').replace('−', '-').replace('^', '**').replace(',', '.')
    if not normalized or len(normalized) > 160 or not re.fullmatch(r'[\d\s.+*/()\-]+', normalized):
        raise ValueError('Expresión aritmética no verificable.')
    tree = ast.parse(normalized, mode='eval')
    if sum(1 for _ in ast.walk(tree)) > 60:
        raise ValueError('El cálculo es demasiado extenso.')
    def evaluate(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            value = node.value
        elif isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            value = evaluate(node.operand) * (-1 if isinstance(node.op, ast.USub) else 1)
        elif isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow)):
            left, right = evaluate(node.left), evaluate(node.right)
            if isinstance(node.op, ast.Add): value = left + right
            elif isinstance(node.op, ast.Sub): value = left - right
            elif isinstance(node.op, ast.Mult): value = left * right
            elif isinstance(node.op, ast.Div): value = left / right
            else:
                if abs(right) > 12: raise ValueError('Potencia fuera del límite de comprobación.')
                value = left ** right
        else:
            raise ValueError('Usa únicamente números y operaciones aritméticas.')
        if isinstance(value, complex) or not math.isfinite(value) or abs(value) > 1e15:
            raise ValueError('Resultado fuera del límite de comprobación.')
        return value
    return evaluate(tree.body)


def explicit_expression(prompt):
    """Check only clearly specified calculations, not guessed word problems."""
    text = prompt.strip()
    if text.startswith('**') and text.endswith('**'):
        text = text[2:-2].strip()
    patterns = [r'^\s*(?:Calcula|Resuelve|¿Cuánto es|Cuánto es|El resultado de)\s*:?\s*([\d\s.,+*/×÷·^()−-]+?)(?:\s*=\s*___)?(?:\s*\?|\s*\.|\s*$)',
                r'^\s*([\d\s.,+*/×÷·^()−-]+?)\s*=\s*___(?:\s*[^\d\n=]*)?$']
    for pattern in patterns:
        match = re.match(pattern, text, re.I)
        if match and re.search(r'[+*/×÷·^−-]', match[1]):
            return match[1].strip()
    return None


_UNITS = {'mm': 'mm', 'cm': 'cm', 'm': 'm', 'km': 'km', 'mm²': 'mm2', 'cm²': 'cm2', 'm²': 'm2', 'km²': 'km2',
          'mm³': 'mm3', 'cm³': 'cm3', 'm³': 'm3', 'kg': 'kg', 'g': 'g', 'mg': 'mg', 'l': 'l', 'ml': 'ml',
          's': 's', 'min': 'min', 'h': 'h', '€': 'eur', 'euros': 'eur', '%': '%', 'porcentaje': '%'}
_UNITS.update({'milímetros': 'mm', 'centímetros': 'cm', 'metros': 'm', 'kilómetros': 'km', 'gramos': 'g',
               'kilogramos': 'kg', 'litros': 'l', 'mililitros': 'ml', 'segundos': 's', 'minutos': 'min', 'horas': 'h',
               'cm2': 'cm2', 'm2': 'm2', 'cm3': 'cm3', 'm3': 'm3'})


def check_question_quality(question):
    kind, prompt, answer = question['type'], question['prompt'], question['answer']
    # Verify explicit numerical claims in the reasoning as well as the final answer.
    # Approximate signs, symbolic algebra and intentionally incorrect examples are excluded.
    number = r'[+-]?\d+(?:[.,]\d+)?'
    expression = number + r'(?:\s*(?:\*\*|[+*/×÷·^−-])\s*' + number + r')*\s*%?'
    equality = re.compile(r'(?<![\w/+*^−×÷·-])(' + expression + r')\s*(?:=|equivale a|simplifica a|simplificado da)\s*(' + expression + r')(?![\w/])', re.I)
    reasoning = [question.get('explanation', '')] + [row['explanation'] for row in question.get('optionFeedback', [])]
    reasoning += question.get('itemExplanations', [])
    for text in reasoning:
        # Spanish digit grouping uses spaces. Never validate only the tail of 2 405.
        text = re.sub(r'(?<![\w\d])([+-]?\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?)(?!\d)',
                      lambda match: re.sub(r'[ \u00a0\u202f]', '', match[0]), text)
        text = text.replace('−', '-')
        for match in equality.finditer(text):
            before = text[:match.start()].rstrip()
            if before and (before[-1] in '+-*/^×÷·=\\√∛∜' or re.search(r'(?:^|\s)[a-zA-Z]$', before)):
                continue  # Never treat the numeric tail of a symbolic equation as arithmetic.
            preceding = text[max(0, match.start()-50):match.start()]
            if re.search(r'\b(?:incorrect[oa]|error|errone[oa]|no es|no equivale|no se cumple)\b', text_key(preceding)):
                continue
            def amount(value):
                value = value.strip()
                return arithmetic(value[:-1])/100 if value.endswith('%') else arithmetic(value)
            try:
                left, right = amount(match[1]), amount(match[2])
                # Conventional "decimal × 100 = n%" labels the percentage amount,
                # while "fraction = n%" compares the represented quantities.
                if match[2].strip().endswith('%') and re.search(r'[×·*]\s*100\s*$', match[1]):
                    right = arithmetic(match[2].strip()[:-1])
                if abs(left-right) > 1e-9:
                    raise ValueError(f'La explicación contiene una igualdad o simplificación incorrecta: {match[0]}. Corrige el razonamiento, la respuesta y los distractores.')
            except (SyntaxError, ZeroDivisionError, OverflowError) as exc:
                raise ValueError(f'La explicación contiene una operación no válida: {match[0]}.') from exc
    if kind in ('numeric', 'gaps', 'quiz'):
        expression = explicit_expression(prompt)
        if expression:
            try:
                expected = arithmetic(expression)
                try:
                    actual = arithmetic(answer)
                except (ValueError, SyntaxError):
                    actual = None  # E.g. a symbolic root, LaTeX fraction or quantity with units.
                tolerance = question.get('tolerance', 0) if kind == 'numeric' else 0
                if actual is not None and abs(actual - expected) > max(tolerance, 1e-9):
                    raise ValueError(f'La solución de {expression} no coincide con el cálculo. Corrige respuesta y explicación.')
                if kind == 'quiz' and actual is not None:
                    equivalent = 0
                    for option in question['options']:
                        try:
                            equivalent += abs(arithmetic(option)-expected) <= 1e-9
                        except (ValueError, SyntaxError, ZeroDivisionError, OverflowError):
                            continue
                    if equivalent != 1:
                        raise ValueError('Las opciones contienen más de una solución numérica equivalente. Cambia los distractores.')
            except (SyntaxError, ZeroDivisionError, OverflowError) as exc:
                raise ValueError('El cálculo contiene una operación no válida.') from exc
        calculation = question.get('calculation')
        if calculation:
            try:
                calculated = arithmetic(calculation)
                actual = float(answer.replace(',', '.'))
                if abs(actual-calculated) > max(question.get('tolerance', 0), 1e-9):
                    raise ValueError('La solución numérica no coincide con calculation. Revisa los pasos y el resultado.')
            except (SyntaxError, ZeroDivisionError, OverflowError) as exc:
                raise ValueError('calculation no es una operación aritmética válida.') from exc
    if kind == 'numeric':
        # A requested unit is checked only when the instruction is explicit and known.
        match = re.search(r'(?:responde|expresa|resultado|indica|convierte)[^.?!\n]{0,60}?\ben\s+(mm[²³]?|cm[²³]?|km[²³]?|m[²³]?|kg|mg|g|ml|l|min|s|h|euros|€|porcentaje|%)(?=\s*(?:[.?!,;]|$))', prompt, re.I)
        if match and _UNITS.get(match[1].lower()) != _UNITS.get(question.get('unit', '').lower(), question.get('unit', '').lower()):
            raise ValueError('La unidad de la solución debe coincidir con la unidad solicitada en el enunciado.')
    if kind in ('quiz', 'numeric') and not re.search(r'\b(?:aproximadamente|media|esperanza|estimacion|posible|compatible|incompatible|coherente|error)\b', text_key(prompt)):
        populations = list(re.finditer(r'\b(\d+)\s+(?:alumnos|alumnas|personas|chicas|chicos|niños|niñas)\b', prompt, re.I))
        proportion = re.search(r'\b(\d+(?:[.,]\d+)?)\s*%\s*(?:son\s+(?:chicas|chicos|alumnos|alumnas|niños|niñas)|de ellos|de ellas|del total)', prompt, re.I)
        if len(populations) == 1 and proportion and 0 <= float(proportion[1].replace(',', '.')) <= 100:
            count = int(populations[0][1])*float(proportion[1].replace(',', '.'))/100
            if abs(count-round(count)) > 1e-9:
                raise ValueError('Los datos producen una fracción de persona. Cambia el total o porcentaje para obtener un conteo entero, sin redondear personas.')
    if kind == 'quiz' and len({' '.join(option.casefold().split()) for option in question['options']}) != len(question['options']):
        raise ValueError('Los distractores deben ser distintos, incluso al normalizar mayúsculas y espacios.')
    if kind == 'boolean':
        match = re.fullmatch(r'\s*([\d\s.,+*/×÷·^()−-]+?)\s*=\s*([\d\s.,+*/×÷·^()−-]+?)\s*\.?\s*', prompt)
        if match:
            try:
                equal = abs(arithmetic(match[1])-arithmetic(match[2])) <= 1e-9
                if answer != ('Verdadero' if equal else 'Falso'):
                    raise ValueError('La valoración de la igualdad no coincide con el cálculo. Corrige la solución y su explicación.')
            except (SyntaxError, ZeroDivisionError, OverflowError) as exc:
                raise ValueError('La igualdad incluye una operación no válida.') from exc
    if kind in ('hangman', 'crossword'):
        rows = [(prompt, answer)] if kind == 'hangman' else [(row.split('|', 1)[1], row.split('|', 1)[0]) for row in question['options']]
        if any(re.search(r'(?<!\w)' + re.escape(text_key(word)) + r'(?!\w)', text_key(clue)) for clue, word in rows):
            raise ValueError('La pista revela la palabra. Sustitúyela por una definición precisa.')


def regeneration_context(payload, build_context, types, limits):
    """Reuse the generation endpoint and billing, but build exactly one replacement."""
    source = payload.get('regenerate')
    if not isinstance(source, dict) or not isinstance(source.get('question'), dict):
        raise ValueError('Indica la pregunta que quieres regenerar.')
    question = source['question']
    kind = question.get('type')
    if kind not in types:
        raise ValueError('Este tipo se prepara manualmente y no admite regeneración con IA.')
    clean = {'type': kind}
    for field, maximum in [('prompt', 12000 if kind == 'multigaps' else 1500), ('answer', 2500), ('text', 12000), ('explanation', 1500)]:
        value = question.get(field, '')
        if not isinstance(value, str) or len(value) > maximum:
            raise ValueError('La pregunta original supera el tamaño permitido.')
        clean[field] = value.strip()
    options = question.get('options', [])
    if not isinstance(options, list) or len(options) > 27 or any(not isinstance(v, str) or len(v) > 300 for v in options):
        raise ValueError('Opciones originales no válidas.')
    clean['options'] = options
    clean.update(feedback_fields(question, kind, options))
    siblings = source.get('siblings', [])
    if not isinstance(siblings, list) or len(siblings) > 79 or any(not isinstance(q, dict) for q in siblings):
        raise ValueError('Contexto de las demás preguntas no válido.')
    group = question.get('activityGroup', 1)
    if type(group) is not int or not 1 <= group <= 20:
        raise ValueError('Grupo original no válido.')
    sibling_context = []
    for q in siblings:
        if q.get('type') not in types:
            continue
        if not isinstance(q.get('prompt', ''), str) or not isinstance(q.get('answer', ''), str):
            raise ValueError('Contexto de preguntas no válido.')
        sibling_group = q.get('activityGroup', group)
        if type(sibling_group) is not int or not 1 <= sibling_group <= 20:
            raise ValueError('Grupo de las preguntas existentes no válido.')
        sibling_context.append({'type': q['type'], 'prompt': q.get('prompt', '')[:200], 'answer': q.get('answer', '')[:100] if kind == 'pairs' else '', 'activityGroup': sibling_group})
    changes = source.get('instructions', '')
    if not isinstance(changes, str) or len(changes) > 1500:
        raise ValueError('Describe la mejora en hasta 1500 caracteres.')
    size = len(options) if kind in limits else 2
    minimum = 3 if kind in ('wordsearch', 'crossword', 'dragdrop', 'pasapalabra') else 2
    size = max(minimum, min(limits.get(kind, 12), size))
    base = {**payload, **{key: 0 for key in types}, kind: 1, 'activitySizes': {kind: size}}
    base.pop('regenerate', None)
    request_id, context = build_context(base)
    context['regeneration'] = {'question': clean, 'instructions': changes.strip(), 'siblings': sibling_context, 'group': group}
    return request_id, context
