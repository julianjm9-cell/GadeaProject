const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

function catalog() {
  const base = join(__dirname, '..');
  const html = readFileSync(join(base, 'index.html'), 'utf8');
  const topics = JSON.parse(readFileSync(join(base, '../../backend/app/data/profesor-temario.json'), 'utf8'));
  const grouped = {};
  for (const topic of topics) {
    grouped[topic.course] ??= {};
    (grouped[topic.course][topic.subject] ??= []).push(topic);
  }
  const context = vm.createContext({window: {PROFESOR_TEMARIO: grouped}});
  vm.runInContext(readFileSync(join(base, 'profesor-public-games-extra.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(base, 'profesor-subjects.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(base, 'profesor-mini-games.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(base, 'profesor-challenge-games.js'), 'utf8'), context);
  const labels = html.split('\n').find(line => line.startsWith('const activityLabels='));
  const functions = html.slice(html.indexOf('let publicMaterialCache='), html.indexOf('function filteredMaterials()'));
  vm.runInContext(labels + '\nlet materialPublicFormat="combined";\n' + functions, context);
  return {context, eval: code => vm.runInContext(code, context)};
}

test('todos los juegos destacados y los materiales públicos tienen respuestas verificables', () => {
  const {context, eval: evaluate} = catalog();
  const advanced = JSON.parse(evaluate('JSON.stringify(publicAdvancedGames)'));
  const syllabus = JSON.parse(evaluate('JSON.stringify(publicTemarioMaterials())'));
  const issues = [];
  const key = value => String(value || '').trim().toLocaleLowerCase('es');
  const ids = new Set();
  for (const material of [...advanced, ...syllabus]) {
    if (!material.activity?.questions?.length) issues.push(`${material.id}: sin preguntas`);
    for (const q of material.activity?.questions || []) {
      const name = `${material.id}/${q.id}`;
      if (ids.has(q.id)) issues.push(`${name}: id repetido`);
      ids.add(q.id);
      if (!q.prompt?.trim()) issues.push(`${name}: sin enunciado`);
      if (!q.answer?.trim()) issues.push(`${name}: sin solución`);
      if (Array.isArray(q.options) && q.options.some(value => !String(value).trim())) issues.push(`${name}: opción vacía`);
      try {
        if (context.window.profesorMiniGames.types.includes(q.type)) {
          context.window.profesorMiniGames.validate(q);
          const prepared = context.window.profesorMiniGames.prepare(q, q.id);
          if (q.type === 'bingo') {
            const values = prepared.clues.map(clue => clue.answer);
            if (context.window.profesorMiniGames.grade(q, values, null, prepared) !== 'correct') issues.push(`${name}: bingo completo rechazado`);
          } else if (context.window.profesorMiniGames.grade(q, q.type === 'mystery' ? {answer:q.answer} : q.answer, null, prepared) !== 'correct') issues.push(`${name}: solución rechazada`);
        } else if (context.window.profesorChallengeGames.types.includes(q.type)) {
          const api = context.window.profesorChallengeGames;
          api.validate(q);
          const prepared = api.prepare(q, q.id);
          const values = prepared.map(item => item.answer);
          if (api.grade(q.type, prepared, values) !== 'correct') issues.push(`${name}: solución rechazada`);
        } else if (['memory', 'dragdrop', 'crossword', 'bingo', 'pasapalabra'].includes(q.type)) {
          const widths = {memory:2, dragdrop:2, crossword:2, bingo:2, pasapalabra:3};
          const rows = (q.options || []).map(value => value.split('|').map(part => part.trim()));
          if (!rows.length || rows.some(row => row.length !== widths[q.type] || row.some(part => !part))) issues.push(`${name}: filas incompletas`);
          if (q.type === 'memory' && [0,1].some(side => new Set(rows.map(row => key(row[side]))).size !== rows.length)) issues.push(`${name}: correspondencias ambiguas`);
          if (q.type === 'dragdrop' && new Set(rows.map(row => key(row[0]))).size !== rows.length) issues.push(`${name}: piezas repetidas`);
        } else if (['order', 'sentence', 'timeline'].includes(q.type) && q.answer !== q.options?.join(' → ')) {
          issues.push(`${name}: orden correcto distinto de la solución`);
        } else if (q.type === 'error' && q.errorSegment && (!q.prompt.includes(q.errorSegment) || q.correctedSegment && !q.answer.includes(q.correctedSegment))) {
          issues.push(`${name}: fragmento erróneo o corrección ausente`);
        } else if (['quiz', 'boolean', 'intruder'].includes(q.type) && !q.options?.includes(q.answer)) {
          issues.push(`${name}: solución no seleccionable`);
        }
      } catch (error) {
        issues.push(`${name}: ${error.message}`);
      }
    }
  }
  assert.equal(advanced.length, 61);
  assert.equal(syllabus.length, 351);
  assert.deepEqual(issues, []);
});
