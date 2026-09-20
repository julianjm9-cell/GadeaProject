const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps', 'e25', 'index.html'), 'utf8');

function extractBetween(start, end) {
  const match = source.match(new RegExp(`${start} = ([\\s\\S]*?);\\s*${end}`));
  if (!match) throw new Error(`No se pudo extraer ${start}`);
  return match[1];
}

const context = vm.createContext({});
vm.runInContext(`
  const MODULES = ${extractBetween('const MODULES', 'const LESSON_TITLES')};
  const LESSON_TITLES = ${extractBetween('const LESSON_TITLES', 'const VERIFIED_TOPIC_THEORY')};
  const VERIFIED_TOPIC_THEORY = ${extractBetween('const VERIFIED_TOPIC_THEORY', 'const MODEL_UNITS')};
  function curatedUnit(source, lessons) { return {label:'Unidad desarrollada', source, reviewed:'20/09/2026', lessons}; }
  const MODEL_UNITS = ${extractBetween('const MODEL_UNITS', 'const CURATED_UNITS')};
  const CURATED_UNITS = ${extractBetween('const CURATED_UNITS', 'Object\\.assign\\(MODEL_UNITS, CURATED_UNITS\\)')};
  Object.assign(MODEL_UNITS, CURATED_UNITS);
  const DEFAULT_OFFICIAL_LINKS = ${extractBetween('const DEFAULT_OFFICIAL_LINKS', 'let OFFICIAL_LINKS')};
  const QUESTIONS = ${extractBetween('const QUESTIONS', 'let state')};
`, context);
const scopesSource = source.match(/const OFFICIAL_SCOPES = ([\s\S]*?);\s*let homeDuration/);
if (!scopesSource) throw new Error('No se pudo extraer OFFICIAL_SCOPES');
vm.runInContext(`const OFFICIAL_SCOPES = ${scopesSource[1]};`, context);

const data = vm.runInContext('({MODULES, LESSON_TITLES, VERIFIED_TOPIC_THEORY, MODEL_UNITS, DEFAULT_OFFICIAL_LINKS, QUESTIONS, OFFICIAL_SCOPES})', context);
const subjects = data.MODULES.filter(module => !['exam', 'oficial'].includes(module.id));
const rows = subjects.map(module => {
  const topics = module.tasks.length;
  const lessons = module.tasks.reduce((total, topic) => total + (data.LESSON_TITLES[topic.id] || []).length, 0);
  const reviewed = module.tasks.filter(topic => data.VERIFIED_TOPIC_THEORY[topic.id]).length;
  const questions = (data.QUESTIONS[module.id] || []).length;
  return {id:module.id, topics, lessons, reviewed, questions};
});

for (const module of subjects) {
  if (!data.QUESTIONS[module.id]) throw new Error(`Falta banco de preguntas: ${module.id}`);
  for (const topic of module.tasks) {
    if ((data.LESSON_TITLES[topic.id] || []).length !== 4) throw new Error(`Desglose incompleto: ${topic.id}`);
  }
}

const model = data.MODEL_UNITS['len-comprension'];
if (!model || model.lessons.length !== 4) throw new Error('La unidad modelo de comprension debe tener cuatro lecciones');
for (const [index, lesson] of model.lessons.entries()) {
  for (const field of ['objective','theory','exampleTitle','exampleText','practice','solution','evidence','pass']) {
    if (!String(lesson[field] || '').trim()) throw new Error(`Unidad modelo: falta ${field} en leccion ${index + 1}`);
  }
  if (!Array.isArray(lesson.exampleSteps) || lesson.exampleSteps.length < 3) throw new Error(`Unidad modelo: ejemplo incompleto en leccion ${index + 1}`);
  if (!Array.isArray(lesson.errors) || lesson.errors.length < 3) throw new Error(`Unidad modelo: errores incompletos en leccion ${index + 1}`);
}
if (Object.keys(data.MODEL_UNITS).length !== 6) throw new Error('El primer lote debe contener seis unidades desarrolladas');
for (const [topicId, unit] of Object.entries(data.MODEL_UNITS)) {
  if (!subjects.some(module => module.tasks.some(topic => topic.id === topicId))) throw new Error(`Unidad desarrollada huerfana: ${topicId}`);
  if (!Array.isArray(unit.lessons) || unit.lessons.length !== 4) throw new Error(`Unidad desarrollada incompleta: ${topicId}`);
  for (const [index, lesson] of unit.lessons.entries()) {
    for (const field of ['objective','theory','exampleTitle','exampleText','practice','solution','evidence','pass']) {
      if (!String(lesson[field] || '').trim()) throw new Error(`${topicId}: falta ${field} en leccion ${index + 1}`);
    }
  }
}
const scopedModules = data.OFFICIAL_SCOPES.flatMap(scope => scope.modules);
if (data.OFFICIAL_SCOPES.length !== 3) throw new Error('Deben existir tres ambitos oficiales');
if (new Set(scopedModules).size !== scopedModules.length) throw new Error('Una materia aparece en mas de un ambito');
for (const module of subjects) {
  if (!scopedModules.includes(module.id)) throw new Error(`Materia sin ambito oficial: ${module.id}`);
}

console.table(rows);
console.log({
  subjects: rows.length,
  topics: rows.reduce((sum, row) => sum + row.topics, 0),
  lessonSlots: rows.reduce((sum, row) => sum + row.lessons, 0),
  reviewedTopicTheory: rows.reduce((sum, row) => sum + row.reviewed, 0),
  subjectQuestionsUsed: rows.reduce((sum, row) => sum + row.questions, 0),
  allDeclaredQuestions: Object.values(data.QUESTIONS).reduce((sum, bank) => sum + bank.length, 0),
  officialLinks: data.DEFAULT_OFFICIAL_LINKS.length,
  developedUnits: Object.keys(data.MODEL_UNITS).length,
  developedLessons: Object.values(data.MODEL_UNITS).reduce((sum, unit) => sum + unit.lessons.length, 0)
});
