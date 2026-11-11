const assert = require('node:assert/strict');
const { execFile, spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, relative, resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { promisify } = require('node:util');

const dashboard = import('../scripts/educame-dashboard.mjs');
const servers = new WeakMap();
const fakeKey = 'buffer-key-fixture';
const googleId = 'example.apps.googleusercontent.com';
const searchProperty = 'sc-domain:educame.tech';
const fakeChannels = ['instagram', 'facebook', 'tiktok', 'youtube'].map(service => ({
  id: service, name: `educame-${service}`, service, allowedActions: ['scheduleUpdates', 'viewInsights'],
}));

function fakeProviders() {
  const received = { mutations: [], reports: [] };
  const googleScope = 'https://www.googleapis.com/auth/webmasters.readonly';
  async function fetchImpl(url, options) {
    if (url === 'https://api.buffer.com') {
      assert.equal(options.headers.Authorization, 'Bearer ' + fakeKey);
      const { query, variables } = JSON.parse(options.body);
      if (query.includes('query Organizations')) return Response.json({ data: { account: { organizations: [{ id: 'edu' }] } } });
      if (query.includes('query Channels')) {
        assert.equal(variables.organizationId, 'edu');
        return Response.json({ data: { channels: fakeChannels } });
      }
      if (query.includes('mutation Publish')) {
        received.mutations.push(variables.input);
        const createPost = variables.input.channelId === 'facebook' ? { message: 'Canal de ensayo rechazado.' } : { post: { id: 'post-1', status: 'sending' } };
        return Response.json({ data: { createPost } });
      }
      if (query.includes('query PostStatus')) return Response.json({ data: { post: { id: variables.input.id, status: 'sent' } } });
      assert.match(query, /aggregatedPostMetrics/);
      assert.equal(variables.input.channelIds[0], 'youtube');
      return Response.json({ data: { aggregatedPostMetrics: { metricsUpdatedAt: '2026-11-10T12:00:00Z', metrics: [{ type: 'postCount', name: 'Publicaciones', value: 4 }] } } });
    }
    if (url === 'https://oauth2.googleapis.com/token') {
      assert.equal(options.body.get('client_id'), googleId);
      assert.equal(options.body.get('client_secret'), 'fake-secret');
      if (options.body.get('grant_type') === 'authorization_code') {
        assert.equal(options.body.get('code'), 'fake-code');
        assert.ok(options.body.get('code_verifier'));
      } else {
        assert.equal(options.body.get('refresh_token'), 'fake-refresh');
      }
      return Response.json({ access_token: 'fake-access', refresh_token: 'fake-refresh', scope: googleScope, expires_in: 3600 });
    }
    assert.equal(options.headers.Authorization, 'Bearer fake-access');
    if (url.endsWith('/sites')) return Response.json({ siteEntry: [{ siteUrl: searchProperty, permissionLevel: 'siteOwner' }] });
    assert.match(url, /sc-domain%3Aeducame.tech\/searchAnalytics\/query$/);
    const report = JSON.parse(options.body);
    received.reports.push(report);
    return Response.json({ rows: [{ keys: report.dimensions.length ? ['clave'] : [], clicks: 24, impressions: 80, ctr: .3, position: 6 }] });
  }
  return { fetchImpl, received };
}

async function start(t, directory, options = {}) {
  const { createDashboard } = await dashboard;
  const server = await createDashboard({ directory, apiKey: '', ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  servers.get(t).push(server);
  return 'http://127.0.0.1:' + server.address().port;
}

function request(base, path, body, overrides) {
  return fetch(base + path, {
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    ...overrides,
  });
}

async function local(t) {
  const directory = await mkdtemp(join(tmpdir(), 'educame-dashboard-test-'));
  servers.set(t, []);
  t.after(async () => {
    await Promise.all(servers.get(t).map(server => new Promise(resolve => server.close(resolve))));
    assert.match(relative(resolve(tmpdir()), resolve(directory)), /^educame-dashboard-test-[\w-]+$/);
    return rm(directory, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  });
  return directory;
}

async function waitPanel(base, ready) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const panel = await request(base, '/api/panel').then(response => response.json());
    if (ready(panel)) return panel;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.fail('El panel no llegó al estado esperado.');
}

const fakeDraft = () => ({ draft: { resumen: 'Ensayo', entrega: 'Entrega ficticia', comprobaciones: [], pendientes: [] } });

function saveAgent(base, data) {
  return request(base, '/api/agentes', data, { method: 'PUT', headers: { Origin: base, 'Content-Type': 'application/json' } });
}

test('los agentes nuevos y editados se guardan y se usan desde la cola y el encargo directo', async t => {
  const directory = await local(t);
  const { draftRequest } = await import('../scripts/educame-agents.mjs');
  const captured = [];
  const base = await start(t, directory, { codex: { status: async () => ({ ready: true }), async generate(task) {
    captured.push({ draft: (await draftRequest(task)).instructions, implementation: (await draftRequest(task, { implement: true })).instructions });
    return fakeDraft();
  } } });
  const initial = await request(base, '/api/panel').then(response => response.json());
  const profile = { name: 'Accesibilidad', description: 'Prueba el teclado y los lectores de pantalla.', draft: 'Explica cómo comprobar el foco.',
    implementation: 'Corrige el orden de foco.', team: 'Revisa los controles.' };
  const create = { revision: initial.board.revision, action: 'create', profile };
  assert.equal((await request(base, '/api/agentes', create, { method: 'PUT' })).status, 403);
  const saved = await (await saveAgent(base, create)).json();
  const agent = saved.agentEditor.profiles.find(item => item.name === profile.name);
  assert.equal(agent.builtIn, false);
  assert.equal((await saveAgent(base, create)).status, 409);
  assert.equal((await saveAgent(base, { ...create, revision: saved.board.revision,
    profile: { ...profile, name: 'ACCESIBILIDAD' } })).status, 400);
  const task = { id: 'accessible-1', agente: agent.id, encargo: 'Comprueba el foco', app: 'profesor' };
  const put = await request(base, '/api/panel', { ...saved.board, tasks: [task] }, { method: 'PUT' });
  assert.equal(put.status, 200);
  const board = await put.json();
  const first = await request(base, '/api/ejecutar', { revision: board.revision, engine: 'codex', mode: 'prueba' });
  assert.equal(first.status, 202);
  await waitPanel(base, ({ batch }) => batch?.state === 'finished');
  const updated = await (await saveAgent(base, { revision: board.revision, action: 'edit', id: agent.id,
    profile: { ...profile, name: 'Accesibilidad web', draft: 'Describe la navegación con Tab.' } })).json();
  const direct = { engine: 'codex', mode: 'real', tasks: [{ ...task, id: 'accessible-2' }] };
  assert.equal((await request(base, '/api/encargos', { ...direct, agentRevision: board.revision })).status, 409);
  assert.equal((await request(base, '/api/encargos', { ...direct, agentRevision: updated.board.revision })).status, 202);
  const final = await waitPanel(base, ({ batch }) => batch?.state === 'finished' && batch?.mode === 'real');
  assert.equal(final.board.tasks[0].agente, agent.id);
  assert.equal(final.history.find(item => item.id === task.id).agentName, 'Accesibilidad');
  assert.equal(final.history.find(item => item.id === 'accessible-2').agentName, 'Accesibilidad web');
  assert.match(captured[0].draft, /Describe la navegación con Tab/);
  assert.match(captured[0].implementation, /Corrige el orden de foco/);
  const second = await start(t, directory);
  assert.equal((await request(second, '/api/panel').then(response => response.json())).agentEditor.profiles.find(item => item.id === agent.id).name, 'Accesibilidad web');
});

test('tras cerrar el proceso a la fuerza se conservan criterios y se retoma solo lo pendiente', { timeout: 30_000 }, async t => {
  const directory = await local(t);
  const task = id => ({ id, app: 'profesor', agente: 'juegos', encargo: 'Prueba de recuperación ' + id });
  const body = { mode: 'real', tasks: ['hecho', 'en-curso-1', 'en-curso-2', 'pendiente'].map(task) };
  const gameProfile = { name: 'Juegos de clase', description: 'Juegos integrados.', draft: 'Criterio original de la partida.',
    implementation: 'Prueba la ronda.', team: '' };
  const legacy = { revision: 8, tasks: [task('de-la-cola')], agentEdits: { juegos: gameProfile }, memory: [{ id: 'regla-preexistente', app: 'profesor',
    tema: 'estetica', criterio: 'Integrar vagones en el tablero.', comprobacion: 'Probar un acierto.' }] };
  await writeFile(join(directory, 'panel.json'), JSON.stringify(legacy));
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { createDashboard } from './scripts/educame-dashboard.mjs';
    const server = await createDashboard({directory: process.argv[1], apiKey: 'fixture',
      generate: task => task.id === 'hecho'
        ? {draft: {resumen: 'Primera entrega', entrega: 'Ficticia', comprobaciones: [], pendientes: []}}
        : new Promise(() => {})});
    server.listen(0, '127.0.0.1', () => console.log(server.address().port));
  `, directory], { cwd: resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  const exited = once(child, 'exit');
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill(); await exited; });
  const [port] = await Promise.race([once(child.stdout, 'data'), exited.then(() => assert.fail('El panel de ensayo no arrancó.'))]);
  const old = 'http://127.0.0.1:' + String(port).trim();
  const opened = await request(old, '/api/encargos', body);
  assert.equal(opened.status, 202);
  const { id } = await opened.json();
  await waitPanel(old, ({ batch }) => batch?.jobs.hecho?.status === 'borrador' && batch.jobs['en-curso-2']?.status === 'en curso');
  assert.equal(child.kill(), true);
  await exited;

  const called = [];
  const base = await start(t, directory, { apiKey: 'fixture', generate: task => {
    called.push(task);
    return fakeDraft();
  } });
  const second = await start(t, directory, { apiKey: 'fixture', generate: task => {
    called.push(task);
    return fakeDraft();
  } });
  const resumed = await waitPanel(base, ({ batch }) => batch?.state === 'paused');
  assert.equal(resumed.board.tasks[0].id, 'de-la-cola');
  assert.equal(resumed.board.memory[0].criterio, legacy.memory[0].criterio);
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'panel.json'), 'utf8')), legacy);
  const rule = { app: 'profesor', tema: 'flujos', criterio: 'Mostrar el progreso del viaje.', comprobacion: 'Completar un vagón.' };
  assert.equal((await request(base, '/api/memoria', { revision: resumed.board.revision, rule })).status, 200);
  assert.equal((await request(second, '/api/memoria', { revision: resumed.board.revision, rule })).status, 409);
  const afterMemory = await request(second, '/api/panel').then(response => response.json());
  const modified = await saveAgent(second, { revision: afterMemory.board.revision, action: 'edit', id: 'juegos',
    profile: { ...gameProfile, draft: 'Criterio nuevo para próximos lotes.' } });
  assert.equal(modified.status, 200);
  assert.equal((await request(second, '/api/encargos', body).then(response => response.json())).id, id);
  assert.deepEqual(called, []);
  const retries = await Promise.all([request(base, '/api/encargos/retomar', { id }), request(second, '/api/encargos/retomar', { id })]);
  assert.ok(retries.every(response => response.status === 202));
  const done = await waitPanel(base, ({ batch }) => batch?.state === 'finished');
  assert.deepEqual(called.map(task => task.id), ['pendiente']);
  assert.equal(called[0].agentProfile.draft, gameProfile.draft);
  assert.deepEqual(called[0].productContext.confirmed.map(rule => rule.id), ['regla-preexistente']);
  assert.equal(done.board.memory.length, 2);
  assert.equal(done.batch.jobs.hecho.reused, true);
  assert.equal(done.batch.jobs['en-curso-1'].status, 'interrumpido');
  assert.equal(done.batch.jobs['en-curso-2'].status, 'interrumpido');
  assert.equal(done.batch.jobs.pendiente.status, 'borrador');
  assert.equal((await request(base, '/api/encargos', body).then(response => response.json())).id, id);
  assert.equal(done.history.length, 2);
});

test('la cola ejecutada pasa al seguimiento y admite encargos nuevos durante el trabajo', async t => {
  const directory = await local(t);
  let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  t.after(() => finish());
  const base = await start(t, directory, { apiKey: 'ensayo-local', generate: async () => { await gate; return fakeDraft(); } });
  const panel = await request(base, '/api/panel').then(response => response.json());
  const task = id => ({ id, agente: 'juegos', app: 'ingles', encargo: 'Encargo ' + id });
  const saved = await request(base, '/api/panel', { ...panel.board, tasks: [task('primero')] }, { method: 'PUT' }).then(response => response.json());
  assert.equal((await request(base, '/api/ejecutar', { mode: 'real', engine: 'openai', revision: saved.revision, consumeQueue: true })).status, 202);
  const active = await waitPanel(base, ({ batch }) => batch?.running);
  assert.equal(active.board.tasks.length, 0);
  assert.equal(active.batch.tasks[0].app, 'ingles');
  assert.equal((await request(base, '/api/panel', { ...active.board, tasks: [task('siguiente')] }, { method: 'PUT' })).status, 200);
  finish();
  const done = await waitPanel(base, ({ batch }) => batch?.state === 'finished');
  assert.deepEqual(done.board.tasks.map(task => task.id), ['siguiente']);
  assert.equal(done.history.filter(item => item.id === 'primero').length, 1);
  const reopened = await start(t, directory);
  const restored = await request(reopened, '/api/panel').then(response => response.json());
  assert.equal(restored.board.tasks[0].id, 'siguiente');
  assert.equal(restored.batch.tasks[0].id, 'primero');
});

test('implementa en copias separadas, revisa sobre el cambio y sube solo la revisión aprobada', { timeout: 30_000 }, async t => {
  const directory = await local(t);
  const root = join(directory, 'repo');
  const remote = join(directory, 'remote');
  const file = 'apps/profesor/index.html';
  const git = (cwd, ...args) => promisify(execFile)('git', args, { cwd, windowsHide: true }).then(({ stdout }) => stdout.trim());
  await mkdir(join(root, 'apps', 'profesor'), { recursive: true });
  await mkdir(remote);
  await git(root, 'init', '-b', 'main');
  await git(remote, 'init', '--bare');
  await git(root, 'config', 'user.email', 'educame@example.invalid');
  await git(root, 'config', 'user.name', 'Educame fixture');
  await writeFile(join(root, file), '<h1>Base</h1>\n');
  await git(root, 'add', file);
  await git(root, '-c', 'commit.gpgsign=false', 'commit', '-m', 'Base');
  const initial = await git(root, 'rev-parse', 'HEAD');
  await git(root, 'remote', 'add', 'origin', remote);
  await git(root, 'push', 'origin', 'main');
  await writeFile(join(root, file), '<h1>Trabajo local sin commit</h1>\n');
  const base = await start(t, join(directory, 'panel'), {
    repositoryRoot: root, implementationOptions: { localRemote: true },
    codex: { status: async () => ({ ready: true }), async implement(task, cwd, allowed) {
      assert.ok(allowed.includes('apps/profesor/'));
      const original = await readFile(join(cwd, file), 'utf8');
      assert.match(original, task.agente === 'revision' ? /Pack listo/ : /Base/);
      assert.doesNotMatch(original, /Trabajo local/);
      const title = task.agente === 'revision' ? 'Pack revisado' : 'Pack listo';
      await writeFile(join(cwd, file), `<h1>${title}</h1>\n`);
      return { ...fakeDraft(), checks: [{ command: 'node --test', passed: task.id !== 'sin-prueba' }] };
    } },
  });
  const task = (id, agente = 'juegos', revisar = '') => ({ id, agente, revisar, app: 'profesor', encargo: 'Crea y mejora tres juegos.' });
  const body = { mode: 'implementacion', engine: 'codex', tasks: [task('pack'), task('pack-revisado', 'revision', 'pack'), task('sin-prueba')] };
  assert.equal((await request(base, '/api/encargos', body)).status, 202);
  const panel = await waitPanel(base, ({ batch }) => batch?.state === 'finished');
  assert.equal(panel.batch.jobs.pack.status, 'completado');
  assert.equal(panel.batch.jobs['pack-revisado'].status, 'completado');
  assert.equal(panel.batch.jobs['sin-prueba'].status, 'borrador');
  const key = 'implementacion/pack-revisado';
  const delivery = panel.history.find(item => item.key === key);
  assert.equal(delivery.implementation.commit, await git(root, 'rev-parse', 'codex/educame-pack-revisado'));
  assert.equal(await git(root, 'rev-parse', 'codex/educame-pack-revisado^'), await git(root, 'rev-parse', 'codex/educame-pack'));
  assert.equal((await request(base, '/api/encargos/github', { key })).status, 409);
  assert.equal((await request(base, '/api/encargos/github', { key: 'implementacion/sin-prueba' })).status, 409);
  assert.equal((await request(base, '/api/revisar', { key, decision: 'aprobada', note: '', revision: panel.board.revision })).status, 200);
  const sent = await Promise.all(Array.from({ length: 2 }, () => request(base, '/api/encargos/github', { key })));
  assert.ok(sent.every(response => response.status === 200));
  const pushed = (await sent[0].json()).pushes[key];
  assert.equal(pushed.commit, delivery.implementation.commit);
  assert.equal(await git(remote, 'rev-parse', 'codex/educame-pack-revisado'), pushed.commit);
  assert.equal(await git(remote, 'rev-parse', 'main'), initial);
  assert.match(await readFile(join(root, file), 'utf8'), /Trabajo local sin commit/);
  const preview = await request(base, '/vista-encargo/pack-revisado', undefined, { redirect: 'manual' });
  assert.equal(preview.status, 303);
  assert.match(await fetch(preview.headers.get('location')).then(response => response.text()), /Pack revisado/);
  const opts = { headers: { Origin: base, 'Content-Type': 'application/json' } };
  const payload = { key, commit: pushed.commit };
  assert.equal((await request(base, '/api/encargos/publicar', payload)).status, 403);
  assert.equal((await request(base, '/api/encargos/publicar', { ...payload, commit: initial }, opts)).status, 409);
  assert.equal((await request(base, '/api/encargos/publicar', payload, opts)).status, 200);
  assert.equal((await request(base, '/api/encargos/verificar-publicacion', payload, opts)).status, 409);
  await git(root, 'push', 'origin', pushed.commit + ':main');
  const release = await request(base, '/api/encargos/verificar-publicacion', payload, opts).then(response => response.json());
  assert.equal(release.revision, pushed.commit);
});

test('recupera la misma copia con pruebas locales y vuelve a pedir aprobación para el commit', { timeout: 30_000 }, async t => {
  const directory = await local(t);
  const root = join(directory, 'repo');
  const output = join(directory, 'panel');
  const file = 'apps/cambridge/index.html';
  const check = 'tests/recover.test.cjs';
  const git = (...args) => promisify(execFile)('git', args, { cwd: root, windowsHide: true });
  await mkdir(join(root, 'apps', 'cambridge'), { recursive: true });
  await mkdir(join(root, 'tests'));
  await git('init', '-b', 'main');
  await git('config', 'user.email', 'educame@example.invalid');
  await git('config', 'user.name', 'Educame fixture');
  await writeFile(join(root, file), '<h1>Base</h1>\n');
  await writeFile(join(root, check), "require('node:test')('copia', () => require('node:assert/strict').match(require('node:fs').readFileSync('apps/cambridge/index.html', 'utf8'), /Mejora/));\n");
  await git('add', '.');
  await git('-c', 'commit.gpgsign=false', 'commit', '-m', 'Base');
  let calls = 0;
  const base = await start(t, output, { repositoryRoot: root, codex: {
    status: async () => ({ ready: true }), async implement(task, cwd) {
      calls++;
      await writeFile(join(cwd, file), '<h1>Mejora</h1>\n');
      return { ...fakeDraft(), checks: [{ command: 'node --test --test-isolation=none ' + check, passed: false }] };
    },
  } });
  const key = 'implementacion/rescate';
  const opts = { headers: { Origin: base, 'Content-Type': 'application/json' } };
  const tasks = [{ id: 'rescate', agente: 'juegos', revisar: '', app: 'ingles', encargo: 'Mejora este juego.' }];
  assert.equal((await request(base, '/api/encargos', { mode: 'implementacion', engine: 'codex', tasks })).status, 202);
  const panel = await waitPanel(base, ({ batch }) => batch?.state === 'finished');
  assert.equal(panel.history[0].canRevalidate, true);
  assert.equal((await request(base, '/api/revisar', { key, decision: 'aprobada', note: '', revision: panel.board.revision })).status, 200);
  const checked = await request(base, '/api/encargos/comprobar', { key }, opts).then(response => response.json());
  assert.equal(checked.status, 'completado', checked.error);
  assert.equal(checked.checks[0].source, 'local');
  assert.equal(checked.checks[0].passed, true);
  assert.equal(calls, 1);
  const { commit } = checked.implementation;
  assert.equal((await request(base, '/api/encargos/publicar', { key, commit }, opts)).status, 409);
  const repeated = await request(base, '/api/encargos/comprobar', { key }, opts).then(response => response.json());
  assert.equal(repeated.implementation.commit, commit);
  assert.equal((await request(base, '/api/panel').then(response => response.json())).batch.jobs.rescate.status, 'completado');
  const diff = await request(base, '/api/encargos/diferencias?key=' + encodeURIComponent(key)).then(response => response.json());
  assert.match(diff.patch, /\+<h1>Mejora/);
  assert.match(await readFile(join(root, file), 'utf8'), /Base/);
});

test('el equipo recibe encargos directos sin reemplazar la cola y entrega el borrador a Revisión', async t => {
  const directory = await local(t);
  const received = [];
  const base = await start(t, directory, {
    generate: async task => {
      received.push(task);
      return { draft: { resumen: task.agente, entrega: 'Entrega ficticia', comprobaciones: [], pendientes: [] } };
    },
  });
  const tasks = ['mantenimiento', 'juegos', 'marketing', 'adaptacion', 'revision']
    .map(agente => ({ id: agente, agente, encargo: 'Una misión de prueba', contexto: 'ESO Adultos', revisar: agente === 'revision' ? 'juegos' : '' }));
  assert.equal((await request(base, '/api/encargos', { tasks, mode: 'real' })).status, 503);
  assert.equal((await request(base, '/api/conexiones/openai', { key: 'sk-ensayo' })).status, 200);
  assert.equal((await request(base, '/api/encargos', { tasks, mode: 'real' })).status, 202);
  let panel;
  for (let attempt = 0; attempt < 100; attempt++) {
    panel = await (await request(base, '/api/panel')).json();
    if (!panel.batch.running) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(panel.batch.running, false);
  assert.equal(panel.board.tasks.length, 0);
  assert.equal(panel.history.length, 5);
  assert.equal(received.find(task => task.agente === 'revision').revision.borrador.resumen, 'juegos');
  assert.equal(await (await request(base, '/api/conexiones')).text().then(data => data.includes('sk-ensayo')), false);
});

test('Copiador retoma enlaces guardados y separa el análisis de los encargos de implementación', async t => {
  const directory = await local(t);
  const calls = [];
  const reference = 'https://www.youtube.com/watch?v=educame-test';
  const research = { id: 'referencia', agente: 'copiador', app: 'ingles', encargo: 'Analiza este enlace', fuentes: [reference] };
  const game = { id: 'juego-guardado', agente: 'juegos', app: 'profesor', encargo: 'Prepara un juego.' };
  const options = { codex: { status: async () => ({ ready: true }), generate: async task => { calls.push(task); return fakeDraft(); } } };
  const first = await start(t, directory, options);
  const initial = await request(first, '/api/panel').then(response => response.json());
  const saved = await request(first, '/api/panel', { revision: initial.board.revision, tasks: [research, game], links: initial.board.links }, { method: 'PUT' });
  assert.equal(saved.status, 200);
  const second = await start(t, directory, options);
  const before = await request(second, '/api/panel').then(response => response.json());
  assert.deepEqual(before.board.tasks[0].fuentes, [reference]);
  assert.equal((await request(second, '/api/encargos', { mode: 'implementacion', engine: 'codex', tasks: [research] })).status, 400);
  const body = { mode: 'real', engine: 'codex', revision: before.board.revision, researchOnly: true };
  const submitted = await request(second, '/api/ejecutar', body);
  assert.equal(submitted.status, 202);
  const batch = await submitted.json();
  const done = await waitPanel(second, ({ batch }) => batch?.state === 'finished');
  assert.deepEqual(calls.map(({ id }) => id), [research.id]);
  assert.deepEqual(done.history[0].fuentes, [reference]);
  assert.deepEqual(done.board.tasks.map(({ id }) => id), [research.id, game.id]);
  assert.equal((await request(second, '/api/ejecutar', body).then(response => response.json())).id, batch.id);
});

test('la memoria solo reutiliza criterios confirmados y respeta el ámbito del encargo', async t => {
  const directory = await local(t);
  const received = [];
  const aprendizaje = { tema: 'estetica', criterio: 'Integrar los vagones en el tablero.', comprobacion: 'Verificar un acierto en móvil.' };
  const base = await start(t, directory, {
    apiKey: 'clave-ficticia',
    generate: async task => {
      received.push(task);
      return { draft: { resumen: 'Ensayo', entrega: 'Borrador ficticio', comprobaciones: [], pendientes: [], aprendizaje } };
    },
  });
  const panel = () => request(base, '/api/panel').then(response => response.json());
  const task = (id, app) => ({ id, app, agente: 'juegos', encargo: 'Diseña un juego con vagones' });
  async function run(tasks) {
    assert.equal((await request(base, '/api/encargos', { mode: 'real', tasks })).status, 202);
    for (let attempt = 0; attempt < 100; attempt++) {
      const current = await panel();
      if (!current.batch.running) return current;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.fail('El lote de ensayo no terminó.');
  }
  const first = await run([task('primero', 'profesor')]);
  assert.equal(first.board.memory.length, 0);
  assert.match(received[0].productContext.profile.style, /Academia/);
  const review = { key: 'real/primero', decision: 'aprobada', note: 'Observación privada de ensayo.', revision: first.board.revision };
  assert.equal((await request(base, '/api/revisar', { ...review, rule: { app: 'profesor' } })).status, 400);
  assert.deepEqual((await panel()).board.reviews, {});
  const confirmed = await request(base, '/api/revisar', { ...review, rule: { app: 'profesor', ...aprendizaje } });
  assert.equal(confirmed.status, 200);
  const saved = await confirmed.json();
  assert.equal(saved.memory[0].source, review.key);
  assert.equal(saved.reviews[review.key].note, review.note);
  assert.equal((await request(base, '/api/revisar', review)).status, 409);
  await run([task('segundo', 'profesor'), task('otro', 'ingles'),
    { id: 'revision-contexto', agente: 'revision', encargo: 'Evalúa el borrador', revisar: 'segundo' }]);
  const [same, different, reviewer] = ['segundo', 'otro', 'revision-contexto'].map(id => received.find(entry => entry.id === id));
  assert.equal(same.productContext.confirmed[0].criterio, aprendizaje.criterio);
  assert.equal(reviewer.productContext.app, 'profesor');
  assert.equal(reviewer.productContext.confirmed[0].id, saved.memory[0].id);
  assert.deepEqual(different.productContext.confirmed, []);
  assert.doesNotMatch(JSON.stringify(same), /Observación privada de ensayo/);
  const restarted = await start(t, directory);
  const restored = await request(restarted, '/api/panel').then(response => response.json());
  assert.equal(restored.board.memory[0].criterio, aprendizaje.criterio);
  const archived = await request(base, '/api/memoria', {
    revision: restored.board.revision, rule: { id: saved.memory[0].id, archived: true },
  });
  assert.equal(archived.status, 200);
  await run([task('tercero', 'profesor')]);
  assert.deepEqual(received.find(entry => entry.id === 'tercero').productContext.confirmed, []);
});

test('redes valida formatos, registra resultados parciales y evita repetir tras reiniciar', async t => {
  const directory = await local(t);
  const { fetchImpl, received } = fakeProviders();
  const base = await start(t, directory, { fetchImpl });
  assert.equal((await request(base, '/api/conexiones/buffer', { key: fakeKey }, {
    headers: { Origin: 'https://ejemplo.com', 'Content-Type': 'application/json' },
  })).status, 403);
  const connected = await (await request(base, '/api/conexiones/buffer', { key: fakeKey })).json();
  assert.equal(connected.channels.length, 4);
  assert.doesNotMatch(await readFile(join(directory, 'connections-vault.json'), 'utf8'), /buffer-key-fixture/);
  const body = { id: randomUUID(), channels: ['youtube', 'facebook'], mediaType: 'video', mediaUrl: 'https://media.example.org/video.mp4',
    text: 'Publicación ficticia', title: 'Aprende con Educame', mode: 'shareNow', kids: 'no', app: 'Inglés' };
  assert.equal((await request(base, '/api/publicaciones', { ...body, mediaType: 'none' })).status, 400);
  assert.equal(received.mutations.length, 0);
  const response = await request(base, '/api/publicaciones', body);
  assert.equal(response.status, 200);
  const published = await response.json();
  assert.deepEqual(published.results.map(item => item.status), ['recibida', 'rechazada']);
  const youtube = received.mutations.find(item => item.channelId === 'youtube');
  assert.equal(youtube.mode, 'shareNow');
  assert.deepEqual(youtube.metadata.youtube, { title: body.title, categoryId: '27', madeForKids: false, isAiGenerated: false });
  const restarted = await start(t, directory, { fetchImpl });
  assert.deepEqual(await (await request(restarted, '/api/publicaciones', body)).json(), published);
  assert.equal(received.mutations.length, 2);
  const refreshed = await (await request(restarted, '/api/publicaciones/actualizar', { id: body.id })).json();
  assert.equal(refreshed.results[0].providerStatus, 'sent');
  assert.equal(received.mutations.length, 2);
  const stats = await (await request(restarted, '/api/estadisticas/redes', { channel: 'youtube', days: 7 })).json();
  assert.equal(stats.metrics[0].value, 4);
});

test('Search Console exige estado OAuth, guarda la autorización y filtra páginas por app', async t => {
  const directory = await local(t);
  const { fetchImpl, received } = fakeProviders();
  const base = await start(t, directory, { fetchImpl });
  const authorization = await (await request(base, '/api/conexiones/google', { clientId: googleId, clientSecret: 'fake-secret' })).json();
  const params = new URL(authorization.url).searchParams;
  assert.equal(params.get('scope'), 'https://www.googleapis.com/auth/webmasters.readonly');
  assert.equal(params.get('code_challenge_method'), 'S256');
  const callback = '/api/conexiones/google/volver';
  assert.equal((await request(base, callback + '?state=incorrecto&code=fake-code', null, { redirect: 'manual' })).headers.get('location'), '/?google=pendiente#conexiones');
  const result = await request(base, `${callback}?state=${params.get('state')}&code=fake-code`, null, { redirect: 'manual' });
  assert.equal(result.status, 303);
  assert.equal(result.headers.get('location'), '/?google=conectado#conexiones');
  const properties = await (await request(base, '/api/conexiones/propiedades')).json();
  assert.deepEqual(properties, [searchProperty]);
  const pagePattern = 'profesor';
  const report = await (await request(base, '/api/estadisticas/busqueda', { property: searchProperty, pagePattern, days: 28 })).json();
  assert.equal(report.total.clicks, 24);
  assert.equal(report.trend.length, 1);
  assert.equal(received.reports.length, 4);
  assert.ok(received.reports.every(item => item.dimensionFilterGroups[0].filters[0].expression === pagePattern));
  assert.doesNotMatch(await readFile(join(directory, 'connections-vault.json'), 'utf8'), /fake-secret|fake-refresh/);
  await request(base, '/api/conexiones/desconectar', { provider: 'google' });
  assert.equal((await request(base, '/api/conexiones/propiedades')).status, 409);
});

test('Runway genera un clip por solicitud, conserva su estado y descarga un MP4', async t => {
  const directory = await local(t);
  const taskId = randomUUID();
  let requested = 0;
  const base = await start(t, directory, {
    fetchImpl: async (url, options) => {
      if (String(url) === 'https://clips.cloudfront.net/salida.mp4') {
        assert.equal(options.headers, undefined);
        return new Response('mp4-de-prueba');
      }
      assert.equal(options.headers['X-Runway-Version'], '2024-11-06');
      assert.equal(options.headers.Authorization, 'Bearer runway-fixture');
      if (url.endsWith('/organization')) return Response.json({ creditBalance: 20 });
      if (url.endsWith('/text_to_video')) {
        requested++;
        assert.deepEqual(JSON.parse(options.body), { model: 'gen4.5', promptText: 'Tren de prueba', ratio: '720:1280', duration: 5 });
        return Response.json({ id: taskId });
      }
      assert.ok(url.endsWith('/tasks/' + taskId));
      return Response.json({ status: 'SUCCEEDED', output: ['https://clips.cloudfront.net/salida.mp4'] });
    },
  });
  const body = { id: randomUUID(), prompt: 'Tren de prueba', ratio: '720:1280' };
  assert.equal((await request(base, '/api/videos', body)).status, 409);
  assert.equal((await request(base, '/api/conexiones/runway', { key: 'runway-fixture' })).status, 200);
  const video = await (await request(base, '/api/videos', body)).json();
  assert.equal(video.status, 'PENDING');
  assert.equal((await request(base, '/api/videos', body)).status, 200);
  assert.equal(requested, 1);
  const updated = await (await request(base, '/api/videos/actualizar', { id: body.id })).json();
  assert.equal(updated.status, 'SUCCEEDED');
  const file = await request(base, '/api/videos/descargar?id=' + body.id);
  assert.equal(file.headers.get('content-type'), 'video/mp4');
  assert.equal(await file.text(), 'mp4-de-prueba');
});
