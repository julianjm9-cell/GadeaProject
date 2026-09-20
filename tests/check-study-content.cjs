const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const resources = JSON.parse(fs.readFileSync(path.join(root, 'backend/app/content/official_resources.json'), 'utf8'));
for (const app of ['e25', 'u25', 'cambridge']) {
  const source = fs.readFileSync(path.join(root, 'apps', app, 'index.html'), 'utf8');
  for (const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new Function(match[1]);
  if (app === 'cambridge') continue;
  const context = vm.createContext({});
  const modules = source.match(/const MODULES = ([\s\S]*?);\s*const LESSON_TITLES/)[1];
  const questions = source.match(/const QUESTIONS = ([\s\S]*?);\s*let state/)[1];
  const theory = source.match(/const VERIFIED_TOPIC_THEORY = ([\s\S]*?);\s*const DEFAULT_OFFICIAL_LINKS/)[1];
  const fallback = source.match(/const DEFAULT_OFFICIAL_LINKS = ([\s\S]*?);\s*let OFFICIAL_LINKS/)[1];
  vm.runInContext(`const MODULES=${modules}; const QUESTIONS=${questions};`, context);
  vm.runInContext(source.match(/function prepareTestQuestions\([\s\S]*?\n\}/)[0], context);
  const data = vm.runInContext('({modules:MODULES, questions:QUESTIONS})', context);
  const topicIds = new Set(data.modules.flatMap(m => m.tasks.map(t => t.id)));
  for (const id of Object.keys(vm.runInContext(`(${theory})`, context))) assert(topicIds.has(id), `Orphan theory: ${id}`);
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext(`(${fallback})`, context))), resources[app === 'e25' ? 'eso_adultos' : 'universidad_adultos']);
  let count = 0;
  for (const module of data.modules.filter(m => !['test', 'exam', 'oficial'].includes(m.id))) {
    const bank = data.questions[module.id];
    assert(bank?.length >= 12, `Full exam needs 12 questions: ${module.id}`);
    assert.equal(new Set(bank.map(q => q[0])).size, bank.length);
    for (const q of bank) {
      assert(q[0] && Array.isArray(q[1]) && q[1].length >= 3);
      assert(Number.isInteger(q[2]) && q[2] >= 0 && q[2] < q[1].length);
      assert.equal(new Set(q[1]).size, q[1].length);
    }
    const before = JSON.stringify(bank);
    for (let run = 0; run < 20; run++) {
      const shuffled = vm.runInContext(`prepareTestQuestions(QUESTIONS[${JSON.stringify(module.id)}])`, context);
      shuffled.forEach((q, i) => assert.equal(q[1][q[2]], bank[i][1][bank[i][2]], 'Shuffle changed correct answer'));
    }
    assert.equal(JSON.stringify(bank), before, 'Question bank mutated');
    count += bank.length;
  }
  console.log(`${app}: ${count} questions; subjects, answer integrity, theory IDs and fallback sources OK`);
}
console.log('All inline scripts parse.');
