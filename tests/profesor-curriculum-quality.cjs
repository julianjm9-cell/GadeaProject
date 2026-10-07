const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', 'apps', 'profesor');
const context = vm.createContext({window: {}, document: {addEventListener() {}}, console});
for (const name of ['profesor-temario.js', 'profesor-temario-depth.js', 'profesor-spanish.js', 'profesor-temario-revision.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, {filename: name});
}
const catalogue = context.window.PROFESOR_TEMARIO;
const entries = Object.entries(catalogue).flatMap(([course, subjects]) =>
  Object.entries(subjects).flatMap(([subject, topics]) => topics.map(topic => ({course, subject, topic}))));
assert.equal(entries.length, 351);
assert.equal(new Set(entries.map(({topic}) => topic.id)).size, entries.length);
for (const {course, subject, topic} of entries) {
  const label = `${course} / ${subject} / ${topic.title}`;
  const d = topic.didactic;
  assert(topic.title && topic.explanation && topic.example && topic.question && topic.answer, `${label}: ficha incompleta`);
  assert(d.objective && d.explanation && d.deepDive && d.recognition && d.transfer, `${label}: explicación incompleta`);
  assert(d.concepts?.length >= 2 && d.steps?.length === 3 && d.examples?.length >= 2, `${label}: secuencia incompleta`);
  assert(d.practice?.length >= 3 && d.practice.every(q => q.prompt && q.answer), `${label}: práctica incompleta`);
  assert(d.preparedMaterial?.questions?.length === 6, `${label}: material preparado incompleto`);
  assert(d.preparedMaterial.questions.every(q => q.prompt && q.answer), `${label}: preguntas sin solución`);
  assert(!/respuesta abierta|depende del cuento/i.test(topic.answer), `${label}: falta una solución modelo`);
  assert(!/texto leído|lee un párrafo|resume un texto|frase sin puntuación/i.test(topic.question), `${label}: falta el texto de partida`);
  for (const question of d.preparedMaterial.questions) {
    if (question.type === 'quiz') assert(question.options.includes(question.answer), `${label}: test sin opción correcta`);
    if (question.type === 'numeric') {
      const expression = question.calculation;
      assert(/^[\d\s.+*/()-]+$/.test(expression), `${label}: cálculo no verificable`);
      const result = Function(`return (${expression})`)();
      assert(Math.abs(result - Number(question.answer)) < 1e-10, `${label}: respuesta numérica incorrecta`);
    }
  }
  assert(!/\b(?:lorem ipsum|texto genérico|respuesta genérica|pendiente de revisar)\b/i.test(JSON.stringify(topic)), `${label}: texto provisional`);
}
for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
  assert.equal(catalogue[level].Español.length, 12, `${level}: deben existir doce temas`);
}
if (process.argv.includes('--inspect')) {
  for (const {course, subject, topic} of entries) {
    console.log(`${course} / ${subject} / ${topic.title} :: ${topic.explanation} :: ${topic.example} :: ${topic.question} => ${topic.answer}`);
  }
}
console.log(`Temario validado: ${entries.length} temas con fichas, práctica y materiales preparados completos.`);
