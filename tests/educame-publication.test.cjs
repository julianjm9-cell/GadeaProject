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
        if (task.continuar) assert.match(await readFile(join(cwd, 'apps/cambridge/index.html'), 'utf8'), /Needs adjustment/);
        await writeFile(join(cwd, 'apps/cambridge/index.html'), task.encargo === 'Broken' ? 'Needs adjustment\n' : 'Improved\n');
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
  assert.equal(f.count(), 2);
  assert.equal((await request('/api/encargos/ajustes', reply)).status, 202);
  assert.equal(f.count(), 2);
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
