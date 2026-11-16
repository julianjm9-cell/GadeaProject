const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, dirname } = require('node:path');

async function fixture(t) {
  const { openPanelStore } = await import('../scripts/educame-dashboard/store.mjs');
  const { createRunner, RunnerError } = await import('../scripts/educame-dashboard/runner.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'educame-runner-queue-'));
  let store = openPanelStore(directory, { memory: [], tasks: [], revision: 0 });
  let runner;
  let busy = false;
  const calls = [];
  const options = { model: 'ensayo', readiness: async () => { if (busy) throw new RunnerError(409, 'Publicación en curso'); },
    baseRevision: async () => 'a'.repeat(40), generator: () => async task => {
      calls.push(task.id);
      return { draft: { resumen: task.id, entrega: task.encargo, comprobaciones: [], pendientes: [] } };
    } };
  const open = () => { runner = createRunner(store, directory, options); return runner; };
  open();
  t.after(async () => { runner.close(); await runner.wait(); store.close(); assert.equal(dirname(directory), tmpdir()); await rm(directory, { recursive: true, force: true }); });
  return { directory, calls, options, get store() { return store; }, get runner() { return runner; }, setBusy(value) { busy = value; },
    async reopen() { runner.close(); await runner.wait(); store.close(); store = openPanelStore(directory, {}); open(); } };
}

const task = id => ({ id, app: 'profesor', agente: 'juegos', encargo: 'Ensayo ' + id });
const request = id => ({ mode: 'real', engine: 'codex', tasks: [task(id)], enqueue: true });

test('dos trabajos quedan guardados durante una publicación y continúan en orden tras reiniciar', async t => {
  const f = await fixture(t);
  f.setBusy(true);
  const first = await f.runner.start(request('primero'));
  const second = await f.runner.start(request('segundo'));
  assert.equal(first.state, 'queued'); assert.equal(second.state, 'queued');
  assert.equal((await f.runner.start(request('primero'))).id, first.id);
  assert.equal(f.runner.queued().length, 2);
  assert.deepEqual(f.calls, []);
  await f.reopen();
  f.setBusy(false);
  await f.runner.pump(); await f.runner.wait();
  await f.runner.pump(); await f.runner.wait();
  assert.deepEqual(f.calls, ['primero', 'segundo']);
  assert.equal(f.store.batch(first.id).state, 'finished');
  assert.equal(f.store.batch(second.id).state, 'finished');
});

test('recupera trabajos interrumpidos sin reenviar pasos inciertos y deja pasar los siguientes', async t => {
  const f = await fixture(t);
  f.setBusy(true);
  const first = await f.runner.start({ ...request('pendiente'), tasks: [task('incierto'), task('pendiente')] });
  const frozen = f.store.batch(first.id);
  Object.assign(frozen, { state: 'paused', pid: null });
  frozen.jobs.incierto = { status: 'en curso', fingerprint: 'original' };
  f.store.update(frozen);
  await f.runner.start(request('siguiente'));
  f.setBusy(false);
  await f.runner.pump(); await f.runner.wait();
  assert.equal(f.store.batch(first.id).jobs.incierto.status, 'interrumpido');
  assert.deepEqual(f.calls, ['pendiente']);
  await f.runner.pump(); await f.runner.wait();
  assert.deepEqual(f.calls, ['pendiente', 'siguiente']);
});

test('dos servidores que comparten la cola no ejecutan dos veces el mismo encargo', async t => {
  const f = await fixture(t);
  f.setBusy(true);
  await f.runner.start(request('unico'));
  const { createRunner } = await import('../scripts/educame-dashboard/runner.mjs');
  const other = createRunner(f.store, f.directory, f.options);
  f.setBusy(false);
  await Promise.all([f.runner.pump(), other.pump()]);
  await Promise.all([f.runner.wait(), other.wait()]);
  other.close();
  assert.deepEqual(f.calls, ['unico']);
});

test('un fallo de una tarea no impide completar la tarea independiente de otra app', async t => {
  const f = await fixture(t);
  f.options.generator = () => async input => input.app === 'control' ? { error: 'Error de ensayo' } :
    { draft: { resumen: 'Funciona', entrega: 'Hecho', comprobaciones: [], pendientes: [] } };
  await f.reopen();
  await f.runner.start({ ...request('bueno'), tasks: [{ ...task('malo'), app: 'control' }, task('bueno')] });
  await f.runner.wait();
  const batch = f.runner.latest();
  assert.equal(batch.state, 'finished');
  assert.equal(batch.jobs.malo.status, 'fallido');
  assert.equal(batch.jobs.bueno.status, 'borrador');
});
