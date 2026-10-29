const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('apps/e25/index.html', 'utf8');
const start = source.indexOf('function saveState() {');
const end = source.indexOf('\nfunction ', start + 1);
assert.ok(start > 0 && end > start);
const saveFunction = source.slice(start, end);

function harness(backend) {
  const statuses = [];
  const context = vm.createContext({
    state: {done: {topic: true}},
    backend,
    showEsoSaveStatus: (kind, message) => statuses.push({kind, message}),
  });
  vm.runInContext(`let esoStateReady=true, esoSaveFailed=false, esoSaveBlocked=false, esoPendingSaves=0; let esoStateSaveQueue=Promise.resolve(); ${saveFunction}`, context);
  return {context, statuses, save: () => vm.runInContext('saveState()', context)};
}

test('failed saves remain visible and retry can confirm the same progress', async () => {
  let calls = 0;
  const {save, statuses} = harness(async () => {
    if (++calls === 1) throw new Error('network');
  });
  assert.equal(await save(), false);
  assert.equal(statuses.at(-1).kind, 'error');
  assert.match(statuses.at(-1).message, /No se pudo guardar/);
  assert.equal(await save(), true);
  assert.equal(calls, 2);
  assert.equal(statuses.at(-1).kind, 'saved');
});

test('revision conflicts stop later writes and keep a recovery warning', async () => {
  let calls = 0;
  const {save, statuses} = harness(async () => {
    calls++;
    throw Object.assign(new Error('conflict'), {code: 'state_conflict'});
  });
  assert.equal(await save(), false);
  assert.equal(await save(), false);
  assert.equal(calls, 1);
  assert.equal(statuses.at(-1).kind, 'error');
  assert.match(statuses.at(-1).message, /Descarga tus cambios/);
});
