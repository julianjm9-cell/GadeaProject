const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, mkdir, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');

test('Cambios distingue el repositorio local de GitHub y fija la revisión de Hostinger', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'educame-changes-'));
  let server;
  t.after(async () => {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const project = join(directory, 'project');
  const remote = join(directory, 'remote.git');
  await mkdir(project);
  const git = (...args) => execFileSync('git', args, { cwd: project, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  async function file(path, value) {
    await mkdir(join(project, path, '..'), { recursive: true });
    await writeFile(join(project, path), value);
  }
  git('init', '--bare', remote);
  git('init', '-b', 'main');
  git('config', 'user.name', 'Ensayo');
  git('config', 'user.email', 'ensayo@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('remote', 'add', 'origin', remote);
  await file('marketing/app_landings_demo/cambridge.html', '<title>Landing de ensayo</title>');
  await file('apps/cambridge/index.html', '<title>App de ensayo</title>');
  git('add', '.');
  git('commit', '-m', 'Primera revisión pública');
  git('push', 'origin', 'main');
  const published = git('rev-parse', 'HEAD');
  await file('apps/profesor/index.html', '<title>Profesor</title>');
  git('add', '.');
  git('commit', '-m', 'Profesor en local');
  const pending = git('rev-parse', 'HEAD');
  await file('apps/cambridge/index.html', '<title>Último cambio local</title>');
  await file('.env', 'PRIVATE_TEST_VALUE');
  const { createDashboard } = await import('../scripts/educame-dashboard.mjs');
  server = await createDashboard({ directory: join(directory, 'panel'), repositoryRoot: project, apiKey: '' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const get = path => fetch(base + path).then(response => response.json());
  const generate = revision => fetch(base + '/api/cambios/hostinger', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision }),
  });
  const history = await get('/api/cambios');
  assert.equal(history.head, pending);
  assert.equal(history.upstream, published);
  assert.equal(history.ahead, 1);
  assert.deepEqual(history.local.files.map(item => item.file), ['apps/cambridge/index.html']);
  assert.deepEqual(history.commits.map(({ sha, online }) => [sha, online]), [[pending, false], [published, true]]);
  const english = await get('/api/cambios?app=ingles&source=github');
  assert.deepEqual(english.commits[0].files, ['apps/cambridge/index.html', 'marketing/app_landings_demo/cambridge.html']);
  assert.equal((await get('/api/cambios?source=local')).commits.length, 1);
  assert.equal((await fetch(base + '/api/cambios?app=constructor')).status, 400);
  const command = await (await generate(published)).json();
  assert.equal(command.revision, published);
  assert.match(command.command, new RegExp('git merge --ff-only ' + published));
  assert.ok(!command.command.includes(pending));
  assert.match(command.command, /bash infra\/deploy-hostinger\.sh$/);
  git('push', 'origin', 'main');
  assert.equal((await generate(published)).status, 409);
  assert.equal((await get('/api/cambios')).upstream, pending);

  const preview = await fetch(base + '/vista-local/ingles/app');
  assert.match(await preview.text(), /Último cambio local/);
  const origin = new URL(preview.url).origin;
  assert.notEqual(origin, base);
  assert.equal((await fetch(origin + '/.env')).status, 404);
  assert.equal((await fetch(origin + '/api/chat', { method: 'POST' })).status, 501);
  assert.equal((await fetch(origin + '/api/state', { headers: { Origin: base } })).status, 403);
  const state = await fetch(origin + '/api/state');
  assert.deepEqual(await state.json(), {});
  const save = () => fetch(origin + '/api/state', { method: 'POST',
    headers: { 'If-Match': state.headers.get('ETag') }, body: '{"preview":true}' });
  assert.equal((await save()).status, 200);
  assert.equal((await save()).status, 412);
  assert.deepEqual(await fetch(origin + '/api/state').then(response => response.json()), { preview: true });
  await file('apps/cambridge/index.html', '<title>Segundo cambio sin commit</title>');
  assert.match(await fetch(preview.url).then(response => response.text()), /Segundo cambio sin commit/);
});
