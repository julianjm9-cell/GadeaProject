const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { once } = require('node:events');
const { mkdir, mkdtemp, writeFile, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const execute = promisify(execFile);

test('las comprobaciones de apps y pytest se reconocen sin aceptar comandos arbitrarios', async () => {
  const { canRevalidate } = await import('../scripts/educame-dashboard/implementation.mjs');
  const ready = command => canRevalidate({ draft: {}, implementation: {}, checks: [{ command }] });
  assert.equal(ready('node --test --test-isolation=none apps/profesor/tests/ads-display.test.cjs'), true);
  assert.equal(ready('python -m pytest tests/test_profesor_ads.py -q -p no:cacheprovider'), true);
  assert.equal(ready('python -m pytest backend/tests/test_profesor_ads.py -q'), true);
  assert.equal(ready('python -m pytest tests/../../secrets.py -q'), false);
  assert.equal(ready('python -m pytest backend/tests -p malicious'), false);
  assert.equal(ready('node --test tests/a.cjs; git push'), false);
});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'educame-publication-'));
  const root = join(directory, 'repo'), data = join(directory, 'data'), remote = join(directory, 'remote.git');
  await mkdir(join(root, 'apps/cambridge'), { recursive: true });
  await mkdir(join(root, 'tests'));
  const git = (...args) => execute('git', args, { cwd: root, windowsHide: true }).then(result => result.stdout.trim());
  await git('init', '-b', 'main');
  await git('config', 'user.email', 'fixture@example.invalid');
  await git('config', 'user.name', 'Publication fixture');
  await writeFile(join(root, 'apps/cambridge/index.html'), 'Original\n');
  await writeFile(join(root, 'tests/check.test.cjs'), "require('node:test')('un caso',()=>require('node:assert/strict').match(require('node:fs').readFileSync('apps/cambridge/index.html','utf8'),/Improved/));\n");
  await git('add', '.');
  await git('-c', 'commit.gpgsign=false', 'commit', '-m', 'Original');
  await git('init', '--bare', remote);
  await git('remote', 'add', 'origin', remote);
  await git('push', 'origin', 'main');
  const original = await git('rev-parse', 'HEAD');
  const command = 'node --test --test-isolation=none --test-name-pattern="un caso" tests/check.test.cjs';
  const servers = [];
  let implementationCount = 0;
  async function start() {
    const { createDashboard } = await import('../scripts/educame-dashboard.mjs');
    const server = await createDashboard({ directory: data, repositoryRoot: root, apiKey: '', implementationOptions: { localRemote: true },
      codex: { status: async () => ({ ready: true }), implement: async (task, cwd) => {
        implementationCount++;
        if (task.repair && task.id === 'roto') return { error: 'Necesita ajustar la consigna.' };
        if (task.integration) {
          assert.match(await readFile(join(cwd, 'apps/cambridge/index.html'), 'utf8'), /<<<<<<< /);
          await writeFile(join(cwd, 'apps/cambridge/index.html'), 'Improved with current layout\n');
          return { draft: { resumen: 'Integrado', entrega: 'Conservadas ambas versiones.' } };
        }
        if (task.continuar) assert.match(await readFile(join(cwd, 'apps/cambridge/index.html'), 'utf8'), /Needs adjustment/);
        await writeFile(join(cwd, 'apps/cambridge/index.html'), task.encargo === 'Broken' ||
          (task.encargo === 'Repairable' && !task.repair) ? 'Needs adjustment\n' : 'Improved\n');
        return { draft: { resumen: task.encargo, entrega: 'Cambio de ensayo.', comprobaciones: [], pendientes: [] },
          checks: [{ command, passed: false }] };
      } } });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    servers.push(server);
    const base = 'http://127.0.0.1:' + server.address().port;
    return (path, body) => fetch(base + path, body ? { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify(body) } : undefined);
  }
  t.after(async () => {
    await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
    await rm(directory, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  });
  return { root, git, remote, original, start, count: () => implementationCount };
}
async function wait(request, path, predicate) {
  for (let i = 0; i < 500; i++) {
    const result = await request(path).then(response => response.json());
    if (predicate(result)) return result;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail('La operación no terminó.');
}
async function order(request, id, encargo) {
  assert.equal((await request('/api/encargos', { mode: 'implementacion', engine: 'codex',
    tasks: [{ id, app: 'ingles', agente: 'codex', encargo }] })).status, 202);
  return wait(request, '/api/panel', result => result.batch.state === 'finished');
}

test('comprueba, acepta y publica con el acceso Git existente y recupera el resultado sin duplicarlo', { timeout: 30_000 }, async t => {
  const f = await fixture(t), request = await f.start(), key = 'implementacion/mejora';
  const panel = await order(request, 'mejora', 'Improved');
  assert.equal(panel.history[0].canRevalidate, true);
  assert.equal((await request('/api/publicacion/preparar', { keys: [key] })).status, 202);
  const plan = await wait(request, '/api/publicacion', result => ['ready', 'failed'].includes(result.state));
  assert.equal(plan.state, 'ready', plan.message);
  assert.equal(plan.checks[0].passed, true);
  assert.equal(await f.git('rev-parse', 'HEAD'), f.original);
  assert.equal(f.count(), 1);
  assert.equal((await request('/api/publicacion/aceptar', { id: plan.id, candidate: f.original })).status, 409);
  const payload = { id: plan.id, candidate: plan.candidate };
  const responses = await Promise.all([request('/api/publicacion/aceptar', payload), request('/api/publicacion/aceptar', payload)]);
  assert.ok(responses.every(response => response.status === 202));
  const published = await wait(request, '/api/publicacion', result => ['published', 'retry'].includes(result.state));
  assert.equal(published.state, 'published', published.message);
  assert.equal(await f.git('rev-parse', 'HEAD'), plan.candidate);
  assert.match(await f.git('ls-remote', 'origin', 'refs/heads/main'), new RegExp('^' + plan.candidate));
  const refreshed = await request('/api/panel').then(response => response.json());
  assert.equal(refreshed.board.pushes[key].integratedRevision, plan.candidate);
  const reopened = await f.start();
  assert.equal((await reopened('/api/publicacion').then(response => response.json())).state, 'published');
  assert.equal((await reopened('/api/publicacion/aceptar', payload)).status, 202);
  assert.equal(f.count(), 1);
});

test('Subir integra conflictos y publica con una sola petición, incluso al repetirla o reiniciar', { timeout: 45_000 }, async t => {
  const f = await fixture(t), request = await f.start(), key = 'implementacion/antigua';
  await order(request, 'antigua', 'Improved');
  await writeFile(join(f.root, 'apps/cambridge/index.html'), 'Current layout\n');
  await f.git('add', '.');
  await f.git('-c', 'commit.gpgsign=false', 'commit', '-m', 'Current layout');
  await f.git('push', 'origin', 'main');
  const current = await f.git('rev-parse', 'HEAD');
  const payload = { id: randomUUID(), keys: [key] };
  const responses = await Promise.all([request('/api/publicacion/subir', payload), request('/api/publicacion/subir', payload)]);
  assert.ok(responses.every(response => response.status === 202));
  const result = await wait(request, '/api/publicacion', job => ['published', 'failed', 'retry'].includes(job?.state));
  assert.equal(result.state, 'published', result.message);
  assert.match(await readFile(join(f.root, 'apps/cambridge/index.html'), 'utf8'), /Improved with current layout/);
  assert.equal(f.count(), 2, 'un encargo y una integración, sin duplicación');
  await f.git('merge-base', '--is-ancestor', current, result.candidate);
  const reopened = await f.start();
  assert.equal((await reopened('/api/publicacion/subir', payload)).status, 202);
  assert.equal(f.count(), 2);
  assert.equal((await reopened('/api/publicacion').then(response => response.json())).state, 'published');
});

test('una entrega con fallos se conserva y el ajuste continúa desde su código sin volver a empezar', { timeout: 30_000 }, async t => {
  const f = await fixture(t), request = await f.start(), key = 'implementacion/roto';
  await order(request, 'roto', 'Broken');
  await request('/api/publicacion/preparar', { keys: [key] });
  const failed = await wait(request, '/api/publicacion', result => result.state === 'failed');
  assert.match(failed.message, /pruebas/);
  assert.equal(await f.git('rev-parse', 'HEAD'), f.original);
  const reply = { key, note: 'Improved', id: randomUUID() };
  assert.equal((await request('/api/encargos/ajustes', reply)).status, 202);
  const adjusted = await wait(request, '/api/panel', result => result.batch.state === 'finished');
  const delivery = adjusted.history.find(item => item.id === 'ajuste-' + reply.id);
  assert.ok(delivery.draft, delivery.error);
  assert.equal(f.count(), 3, 'encargo inicial, corrección automática y ajuste solicitado');
  assert.equal((await request('/api/encargos/ajustes', reply)).status, 202);
  assert.equal(f.count(), 3);
  await request('/api/publicacion/preparar', { keys: [delivery.key] });
  const plan = await wait(request, '/api/publicacion', result => ['ready', 'failed'].includes(result.state));
  assert.equal(plan.state, 'ready', plan.message);
  assert.equal(await f.git('rev-parse', 'HEAD'), f.original);
});

test('una revisión nueva en GitHub invalida la aceptación y se conserva al volver a preparar', { timeout: 30_000 }, async t => {
  const f = await fixture(t), request = await f.start(), key = 'implementacion/cambio';
  await order(request, 'cambio', 'Improved');
  await request('/api/publicacion/preparar', { keys: [key] });
  const plan = await wait(request, '/api/publicacion', result => ['ready', 'failed'].includes(result.state));
  assert.equal(plan.state, 'ready', plan.message);
  const tree = await f.git('rev-parse', 'HEAD^{tree}');
  const other = await f.git('-c', 'commit.gpgsign=false', 'commit-tree', tree, '-p', f.original, '-m', 'Otro cambio remoto');
  await f.git('push', 'origin', other + ':refs/heads/main');
  await request('/api/publicacion/aceptar', { id: plan.id, candidate: plan.candidate });
  const stale = await wait(request, '/api/publicacion', result => result.state === 'retry');
  assert.match(stale.message, /cambios nuevos/);
  assert.equal(await f.git('rev-parse', 'HEAD'), f.original);
  await request('/api/publicacion/preparar', { keys: [key] });
  const newer = await wait(request, '/api/publicacion', result => ['ready', 'failed'].includes(result.state));
  assert.equal(newer.state, 'ready', newer.message);
  assert.equal(newer.remote, other);
});


test('Deshacer sube una revisión nueva con el contenido anterior y tolera doble pulsación', { timeout: 30_000 }, async t => {
  const f = await fixture(t), request = await f.start();
  await order(request, 'deshacer', 'Improved');
  await request('/api/publicacion/subir', { id: randomUUID(), keys: ['implementacion/deshacer'] });
  const published = await wait(request, '/api/publicacion', job => ['published', 'failed', 'retry'].includes(job?.state));
  assert.equal(published.state, 'published', published.message);
  const payload = { id: published.id, candidate: published.candidate };
  assert.equal((await request('/api/publicacion/deshacer', { ...payload, candidate: f.original })).status, 409);
  assert.equal((await request('/api/publicacion/deshacer', payload)).status, 202);
  assert.equal((await request('/api/publicacion/deshacer', payload)).status, 202);
  const undone = await wait(request, '/api/publicacion', job => ['published', 'failed', 'retry'].includes(job?.state));
  assert.equal(undone.state, 'published', undone.message);
  assert.equal(await f.git('rev-parse', 'HEAD^{tree}'), await f.git('rev-parse', f.original + '^{tree}'));
  await f.git('merge-base', '--is-ancestor', published.candidate, undone.candidate);
  assert.match(await f.git('ls-remote', 'origin', 'refs/heads/main'), new RegExp('^' + undone.candidate));
  const reopened = await f.start();
  assert.equal((await reopened('/api/publicacion/deshacer', payload)).status, 202);
  assert.equal(await f.git('rev-parse', 'HEAD'), undone.candidate);
});

test('Subir corrige una entrega incompleta una vez y conserva el resultado al reabrir', { timeout: 45_000 }, async t => {
  const f = await fixture(t), request = await f.start();
  await order(request, 'corregible', 'Repairable');
  const payload = { id: randomUUID(), keys: ['implementacion/corregible'] };
  await request('/api/publicacion/subir', payload);
  const result = await wait(request, '/api/publicacion', job => ['published', 'failed', 'retry'].includes(job?.state));
  assert.equal(result.state, 'published', result.message);
  assert.equal(f.count(), 2, 'solo se solicita una corrección automática');
  const panel = await request('/api/panel').then(response => response.json());
  assert.equal(panel.history.find(item => item.id === 'corregible').implementation.verified, true);
  const reopened = await f.start();
  await reopened('/api/publicacion/subir', payload);
  assert.equal(f.count(), 2);
});

test('un intento fallido no borra la última subida que se puede deshacer', { timeout: 45_000 }, async t => {
  const f = await fixture(t), request = await f.start();
  await order(request, 'hecho', 'Improved');
  await request('/api/publicacion/subir', { id: randomUUID(), keys: ['implementacion/hecho'] });
  const previous = await wait(request, '/api/publicacion', job => ['published', 'failed'].includes(job?.state));
  assert.equal(previous.state, 'published', previous.message);
  await request('/api/publicacion/subir', { id: randomUUID(), keys: ['implementacion/inexistente'] });
  const failed = await wait(request, '/api/publicacion', job => job?.state === 'failed');
  assert.equal(failed.lastPublished.candidate, previous.candidate);
  await request('/api/publicacion/deshacer', { id: previous.id, candidate: previous.candidate });
  const undone = await wait(request, '/api/publicacion', job => ['published', 'failed', 'retry'].includes(job?.state));
  assert.equal(undone.state, 'published', undone.message);
  assert.equal(await f.git('rev-parse', 'HEAD^{tree}'), await f.git('rev-parse', f.original + '^{tree}'));
});
