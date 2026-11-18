const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm, mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { once } = require('node:events');

test('Inicio no anuncia una subida en curso cuando el recibo de publicación conserva un fallo', async () => {
  const { deliveryStatus } = await import('../scripts/educame-dashboard/work-progress.js');
  const delivery = { id:'task', key:'implementacion/task', mode:'implementacion', draft:{}, implementation:{verified:true} };
  const board = { reviews:{}, pushes:{} };
  assert.equal(deliveryStatus(delivery,board,{state:'failed'})[0],'Necesita atención');
  assert.equal(deliveryStatus(delivery,board,{state:'uploading'})[0],'Subiendo a GitHub');
  delivery.externalCompletion={revision:'a'.repeat(40),summary:'Resuelto en la revisión publicada.'};
  assert.equal(deliveryStatus(delivery,board,{state:'failed'})[0],'Completado en GitHub');
});

test('la sesión administrativa sobrevive al reinicio cifrada, conserva su caducidad y se revoca al salir', async t => {
  const { adminOperations } = await import('../scripts/educame-dashboard/admin-operations.mjs');
  const { createConnections } = await import('../scripts/educame-dashboard/connections.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'educame-admin-session-'));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 5 }));
  let clock = Date.now(), revoked = false, cookie;
  t.mock.method(Date, 'now', () => clock);
  const token = 'private-token-for-restart-test';
  const upstream = async (url, options) => {
    const path = new URL(url).pathname;
    if (path === '/auth/login') { revoked = false; return Response.json({ access_token: token }); }
    assert.equal(options.headers.Authorization, 'Bearer ' + token);
    if (path === '/auth/logout') { revoked = true; return Response.json({ ok: true }); }
    if (revoked) return Response.json({ detail: 'Sesión revocada' }, { status: 401 });
    if (path === '/admin/app-availability') return Response.json({ CAMBRIDGE: { paused: false } });
    if (path === '/admin/apps') return Response.json({ revision: 0, apps: [] });
    assert.fail(path);
  };
  const response = { setHeader(name, value) { if (name === 'Set-Cookie') cookie = value.split(';')[0]; } };
  let connections = await createConnections(directory, upstream), admin = adminOperations(upstream, connections);
  await assert.rejects(admin.handle('apps', '', {}, response), { status: 401 });
  await admin.handle('login', '', { identifier: 'owner@example.invalid', password: 'do-not-save-this-password' }, response);
  const cookieBeforeRestart = cookie;
  const encrypted = await readFile(join(directory, 'connections-vault.json'), 'utf8');
  assert.ok(!encrypted.includes(token) && !encrypted.includes('do-not-save-this-password'));
  connections = await createConnections(directory, upstream); admin = adminOperations(upstream, connections);
  assert.equal((await admin.handle('apps', cookie, {}, response)).revision, 0);
  await admin.handle('logout', cookie, {}, response);
  admin = adminOperations(upstream, await createConnections(directory, upstream));
  await assert.rejects(admin.handle('apps', cookieBeforeRestart, {}, response), { status: 401 });
  await admin.handle('login', '', { identifier: 'owner@example.invalid', password: 'another-password' }, response);
  clock += 29 * 60_000;
  admin = adminOperations(upstream, await createConnections(directory, upstream));
  assert.equal((await admin.handle('apps', cookie, {}, response)).revision, 0);
  clock += 2 * 60_000;
  await assert.rejects(admin.handle('apps', cookie, {}, response), { status: 401 });
});

test('Inicio recibe la resolución de una entrega antigua sin borrar la copia fallida ni ocultar otro error real', async t => {
  const { openPanelStore } = await import('../scripts/educame-dashboard/store.mjs');
  const { createDashboard } = await import('../scripts/educame-dashboard.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'educame-home-resolution-'));
  const store = openPanelStore(directory, { memory: [], revision: 0, tasks: [], links: [], reviews: {}, pushes: {} });
  const resolution = { revision: 'a'.repeat(40), summary: 'Catálogo y controles terminados.' };
  store.insert({ id: 'old', state: 'finished', mode: 'implementacion', tasks: [{ id: 'resolved', app: 'control' }], jobs: { resolved: { status: 'borrador', error: 'Original conservado', externalCompletion: resolution } } });
  for (let i = 0; i < 14; i++) store.insert({ id: 'later-' + i, state: 'finished', mode: 'prueba', tasks: [], jobs: {} });
  store.close(); await mkdir(join(directory, 'implementaciones'), { recursive: true });
  const original = { id: 'resolved', status: 'borrador', finishedAt: new Date().toISOString(), error: 'Original conservado', implementation: { verified: false }, draft: { resumen: 'Implementación parcial' } };
  await writeFile(join(directory, 'implementaciones', 'resolved.json'), JSON.stringify(original));
  await writeFile(join(directory, 'implementaciones', 'unresolved.json'), JSON.stringify({ ...original, id: 'unresolved' }));
  const server = await createDashboard({ directory, apiKey: '', codex: {} }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); await rm(directory, { recursive: true, force: true, maxRetries: 5 }); });
  const state = await (await fetch('http://127.0.0.1:' + server.address().port + '/api/panel')).json();
  assert.deepEqual(state.history.find(row => row.id === 'resolved').externalCompletion, resolution);
  assert.equal(state.history.find(row => row.id === 'unresolved').externalCompletion, undefined);
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'implementaciones', 'resolved.json'), 'utf8')), original);
});
