// Canonical catalog used by PDF export. Re-run after editing either curricular source.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: { addEventListener() {} } });
for (const name of ['profesor-temario.js', 'profesor-temario-depth.js', 'profesor-spanish.js', 'profesor-temario-revision.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'apps/profesor', name), 'utf8'), context);
}
const topics = Object.entries(context.window.PROFESOR_TEMARIO).flatMap(([course, subjects]) =>
  Object.entries(subjects).flatMap(([subject, list]) => list.map(topic => ({ ...topic, course, subject }))));
const target = path.join(root, 'backend/app/data/profesor-temario.json');
const content = JSON.stringify(topics, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== content) throw Error('Re-export the curricular catalog.');
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
console.log(topics.length + ' complete topics ' + (process.argv.includes('--check') ? 'verified.' : 'exported.'));
