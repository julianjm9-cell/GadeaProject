const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, writeFile, readFile, rm, symlink } = require('node:fs/promises');
const { join, dirname } = require('node:path');
const { tmpdir } = require('node:os');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { once } = require('node:events');
const exec = promisify(execFile);
const draft = { resumen: 'Pista revisada', entrega: 'Se corrigió la pista.', comprobaciones: ['Regresión comprobada'], pendientes: [], aprendizaje: null };
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
function reply(provider, name, args, id = 'call-1') {
  return provider === 'claude' ? { id: 'msg-test', content: [{ type: 'tool_use', id, name, input: args }], stop_reason: 'tool_use', usage: { input_tokens: 10, output_tokens: 5 } } :
    { id: 'resp-test', output: [{ type: 'function_call', call_id: id, name, arguments: JSON.stringify(args) }], status: 'completed', usage: { input_tokens: 10, output_tokens: 5 } };
}
async function temporary(t, beforeCleanup = async () => {}) {
  const dir = await mkdtemp(join(tmpdir(), 'educame-providers-'));
  t.after(async () => { await beforeCleanup(); assert.equal(dirname(dir), tmpdir()); await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 80 }); });
  return dir;
}

test('las herramientas API aíslan ámbitos, secretos, enlaces, lectura y comandos', async t => {
  const { createProviderTools } = await import('../scripts/educame-dashboard/provider-tools.mjs');
  const { createImplementation } = await import('../scripts/educame-dashboard/implementation.mjs');
  const dir = await temporary(t);
  await mkdir(join(dir, 'apps/profesor'), { recursive: true }); await mkdir(join(dir, 'backups'));
  await writeFile(join(dir, 'apps/profesor/demo.js'), 'const pista = "buena";\n');
  await writeFile(join(dir, 'apps/profesor/.env'), 'PRIVATE_VALUE');
  await writeFile(join(dir, 'apps/profesor/credentials.json'), 'PRIVATE_VALUE');
  await writeFile(join(dir, 'backups/private.txt'), 'PRIVATE_VALUE');
  await writeFile(join(dir, 'package.json.extra'), 'PRIVATE_VALUE');
  const implementation = createImplementation(dir, join(dir, 'data'), {});
  const tools = await createProviderTools({ cwd: dir, allowed: ['apps/profesor/', 'package.json'], writable: true,
    runChecks: implementation.runChecks });
  assert.deepEqual((await tools.execute('list_files', { prefix: '', offset: 0 })).files, ['apps/profesor/demo.js']);
  assert.match((await tools.execute('read_file', { path: 'apps/profesor/demo.js', start: 1, count: 50 })).text, /pista/);
  for (const path of ['../private.txt', 'apps/profesor/../otro.js', 'apps/profesor/.env', 'apps/profesor/.git/config',
    'apps/profesor/credentials.json', 'backups/private.txt', 'package.json.extra', 'C:/data', 'apps\\profesor\\demo.js']) {
    assert.ok((await tools.execute('read_file', { path, start: 1, count: 10 })).error, path);
    assert.ok((await tools.execute('write_file', { path, content: 'incorrecto' })).error, path);
  }
  await symlink(join(dir, 'backups'), join(dir, 'apps/profesor/enlace'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.ok((await tools.execute('read_file', { path: 'apps/profesor/enlace/private.txt', start: 1, count: 10 })).error);
  assert.ok((await tools.execute('write_file', { path: 'apps/profesor/enlace/private.txt', content: 'incorrecto' })).error);
  assert.equal(await readFile(join(dir, 'backups/private.txt'), 'utf8'), 'PRIVATE_VALUE');
  assert.ok((await tools.execute('write_file', { path: 'apps/profesor/demo.js', content: 'sk-' + 'a'.repeat(30) })).error);
  assert.ok((await tools.execute('run_tests', { command: 'node --test tests/a.cjs && git push' })).error);
  const readonly = await createProviderTools({ cwd: dir, allowed: ['apps/profesor/'] });
  assert.ok(!readonly.definitions.some(tool => tool.name === 'write_file'));
  assert.ok((await readonly.execute('write_file', { path: 'apps/profesor/demo.js', content: 'incorrecto' })).error);
  assert.deepEqual(await tools.execute('write_file', { path: 'apps/profesor/nuevo.js', content: 'nuevo\n' }), { written: 'apps/profesor/nuevo.js' });
  assert.equal((await tools.execute('search_code', { text: 'nuevo', prefix: 'apps/' })).matches[0].path, 'apps/profesor/nuevo.js');
  const read = await tools.execute('read_file', { path: 'apps/profesor/nuevo.js', start: 1, count: 20 });
  assert.ok((await tools.execute('replace_text', { path: 'apps/profesor/nuevo.js', old_text: 'nuevo', new_text: 'mejorado', expected_revision: 'stale' })).error);
  assert.ok(!(await tools.execute('replace_text', { path: 'apps/profesor/nuevo.js', old_text: 'nuevo', new_text: 'mejorado', expected_revision: read.revision })).error);
  assert.equal(await readFile(join(dir, 'apps/profesor/nuevo.js'), 'utf8'), 'mejorado\n');
  assert.ok((await tools.execute('replace_text', { path: 'apps/profesor/nuevo.js', old_text: 'mejorado', new_text: 'anterior', expected_revision: read.revision })).error);
});

for (const provider of ['openai', 'claude']) {
  test(`${provider} consulta modelos y completa lectura, edición, prueba y entrega con su protocolo`, async t => {
    const { createApiAgent } = await import('../scripts/educame-dashboard/api-agent.mjs');
    const dir = await temporary(t); await mkdir(join(dir, 'apps/profesor'), { recursive: true });
    await writeFile(join(dir, 'apps/profesor/demo.js'), 'original\n');
    const model = provider === 'claude' ? 'claude-test' : 'gpt-test';
    const calls = [], usage = []; let checked = 0;
    const agent = createApiAgent({ provider, key: () => 'test-key', root: dir, onUsage: item => usage.push(item),
      runChecks: async (cwd, commands) => { assert.equal(cwd, dir); checked++; return commands.map(command => ({ command, passed: true })); },
      fetchImpl: async (url, options) => {
        assert.equal(options.headers.Authorization, 'Bearer test-key');
        assert.equal(options.redirect, 'error');
        if (provider === 'claude') assert.equal(options.headers['anthropic-version'], '2026-10-21');
        if (url.endsWith('/models')) return json({ data: [{ id: model, display_name: model }, { id: 'embedding-not-supported' }] });
        const body = JSON.parse(options.body); calls.push(body); assert.equal(body.model, model);
        assert.ok(body.tools.some(tool => tool.name === 'write_file'));
        const definitions = body.tools; assert.ok(definitions.every(tool => (tool.parameters || tool.input_schema).additionalProperties === false));
        if (calls.length === 1) return json(reply(provider, 'read_file', { path: 'apps/profesor/demo.js', start: 1, count: 10 }, 'read'));
        if (calls.length === 2) {
          assert.match(JSON.stringify(body), /original/);
          return json(reply(provider, 'write_file', { path: 'apps/profesor/demo.js', content: 'mejorado\n' }, 'write'));
        }
        if (calls.length === 3) return json(reply(provider, 'run_tests', { command: 'node --test tests/check.test.cjs' }, 'check'));
        assert.match(JSON.stringify(body), /function_call_output|tool_result/);
        if (provider === 'openai') { assert.equal(body.store, false); assert.ok(body.input.some(item => item.type === 'function_call')); }
        else assert.ok(body.messages.some(item => item.role === 'assistant' && item.content.some(part => part.type === 'tool_use')));
        return json(reply(provider, 'finish', draft, 'end'));
      } });
    assert.deepEqual((await agent.models()).map(item => item.id), [model]);
    const result = await agent.implement({ id: 'ensayo', agente: 'juegos', app: 'profesor', encargo: 'Mejora la pista', providerModel: model }, dir, ['apps/profesor/']);
    assert.equal(result.error, undefined); assert.equal(result.draft.resumen, draft.resumen);
    assert.equal(await readFile(join(dir, 'apps/profesor/demo.js'), 'utf8'), 'mejorado\n');
    assert.equal(checked, 1); assert.equal(result.checks[0].passed, true);
    assert.equal(result.usage.total_tokens, 60); assert.equal(usage.length, 4);
    assert.equal(calls.length, 4);
  });

  test(`${provider} no anuncia éxito ante límite, truncado, clave rechazada o falta de entrega`, async () => {
    const { createApiAgent } = await import('../scripts/educame-dashboard/api-agent.mjs');
    const model = provider === 'claude' ? 'claude-test' : 'gpt-test';
    for (const failure of ['limit', 'truncated', 'auth', 'empty', 'missing-answer', 'loop']) {
      let requests = 0;
      const agent = createApiAgent({ provider, key: () => 'test', fetchImpl: async url => {
        if (url.endsWith('/models')) return json({ data: [{ id: model }] });
        requests++;
        if (failure === 'limit' || failure === 'auth') return new Response('PRIVATE_PROVIDER_DETAIL', { status: failure === 'auth' ? 401 : 429 });
        if (failure === 'truncated') return json({ ...reply(provider, 'finish', { answer: 'partial' }), status: 'incomplete', stop_reason: 'max_tokens' });
        if (failure === 'empty') return json({ output: [], content: [] });
        if (failure === 'missing-answer') return json(reply(provider, 'finish', {}));
        return json(reply(provider, 'read_file', { path: 'x', start: 1, count: 1 }, 'same-id'));
      } });
      await assert.rejects(agent.ask({ model, text: 'Pregunta' }), error => !error.message.includes('PRIVATE_PROVIDER_DETAIL'));
      assert.equal(requests, failure === 'loop' ? 24 : 1);
    }
    const unavailable = createApiAgent({ provider, key: () => '', fetchImpl: () => assert.fail('No debería llamar sin clave') });
    assert.equal((await unavailable.status()).ready, false); assert.deepEqual(await unavailable.models(), []);
    await assert.rejects(unavailable.ask({ model, text: 'Pregunta' }));
  });
}

test('Claude pagina modelos y deduplica herramientas repetidas sin volver a escribir', async t => {
  const { createApiAgent } = await import('../scripts/educame-dashboard/api-agent.mjs');
  const dir = await temporary(t); await mkdir(join(dir, 'apps/profesor'), { recursive: true });
  let calls = 0, catalogueCalls = 0;
  const agent = createApiAgent({ provider: 'claude', key: () => 'test', root: dir, fetchImpl: async (url, options) => {
    if (url.includes('/models')) { catalogueCalls++; return json(url.includes('after_id') ? { data: [{ id: 'claude-test' }] } :
      { data: [{ id: 'claude-retired', lifecycle: 'retired' }], has_more: true, last_id: 'page-1' }); }
    calls++;
    if (calls === 2) await writeFile(join(dir, 'apps/profesor/demo.js'), 'posterior\n');
    return json(calls < 3 ? reply('claude', 'write_file', { path: 'apps/profesor/demo.js', content: 'primero\n' }, 'duplicate') : reply('claude', 'finish', draft));
  } });
  assert.equal((await agent.models()).length, 1);
  await agent.models(); assert.equal(catalogueCalls, 2);
  const result = await agent.implement({ agente: 'juegos', app: 'profesor', encargo: 'Mejora', providerModel: 'claude-test' }, dir, ['apps/profesor/']);
  assert.equal(result.error, undefined); assert.equal(await readFile(join(dir, 'apps/profesor/demo.js'), 'utf8'), 'posterior\n');
});

test('los criterios congelados, Claude y revisión llegan desde el chat hasta GitHub y sobreviven al reinicio', { timeout: 60000 }, async t => {
  const { createDashboard } = await import('../scripts/educame-dashboard.mjs');
  let server;
  const dir = await temporary(t, async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); }),
    root = join(dir, 'repo'), directory = join(dir, 'data'), remote = join(dir, 'origin.git');
  for (const path of ['apps/profesor', 'tests']) await mkdir(join(root, path), { recursive: true });
  await writeFile(join(root, 'apps/profesor/demo.js'), 'original\n');
  await writeFile(join(root, 'tests/check.test.cjs'), "require('node:test')('pista', () => {});\n");
  const git = (...args) => exec('git', args, { cwd: root, windowsHide: true }).then(({ stdout }) => stdout.trim());
  await git('init', '-b', 'main'); await git('config', 'user.email', 'test@example.invalid'); await git('config', 'user.name', 'Test');
  await git('add', '.'); await git('-c', 'commit.gpgsign=false', 'commit', '-m', 'Original');
  await git('init', '--bare', remote); await git('remote', 'add', 'origin', remote); await git('push', 'origin', 'main');
  let plans = 0, implementations = 0, reviews = 0, checks = 0;
  const fetchImpl = async (url, options) => {
    assert.ok(url.startsWith('https://api.anthropic.com/'), url);
    if (url.endsWith('/models')) return json({ data: [{ id: 'claude-test', display_name: 'Claude ensayo' }] });
    const body = JSON.parse(options.body); const input = JSON.parse(body.messages[0].content);
    if (input.mensaje) { plans++; return json(reply('claude', 'finish', { action: 'implement', reply: 'Mejoraré la pista.', tasks: [
      { app: 'profesor', agent: 'juegos', request: 'Mejora la pista sin borrar contenido', after: null } ] })); }
    const reviewing = input.encargo.startsWith('Revisa y corrige');
    assert.match(JSON.stringify(input), /profesor|Profesor Particular/);
    const results = body.messages.filter(item => item.role === 'user').flatMap(item => Array.isArray(item.content) ? item.content : []);
    if (reviewing) {
      if (!results.length) reviews++;
      assert.ok(input.entrega_a_revisar.borrador.resumen);
    } else if (!results.length) implementations++;
    if (!results.length) return json(reply('claude', 'write_file', { path: 'apps/profesor/demo.js', content: reviewing ? 'pista revisada\n' : 'pista nueva\n' }, 'write'));
    if (results.length === 1) { checks++; return json(reply('claude', 'run_tests', { command: 'node --test tests/check.test.cjs' }, 'check')); }
    return json(reply('claude', 'finish', draft));
  };
  async function listen() {
    server = await createDashboard({ directory, repositoryRoot: root, apiKey: '', fetchImpl,
      codex: { status: async () => ({ ready: false }), implement: () => assert.fail('Sin cambio de proveedor') }, implementationOptions: { localRemote: true } });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    return 'http://127.0.0.1:' + server.address().port;
  }
  let base = await listen();
  const get = path => fetch(base + path).then(response => response.json());
  const post = (path, value) => fetch(base + path, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  async function until(path, predicate) {
    for (let i = 0; i < 900; i++) { const value = await get(path); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 40)); }
    assert.fail('No terminó el flujo');
  }
  const key = 'sk-ant-' + 'ensayo-no-real';
  assert.equal((await post('/api/conexiones/claude', { key })).status, 200);
  assert.ok(!(await readFile(join(directory, 'connections-vault.json'), 'utf8')).includes(key));
  assert.equal((await get('/api/conexiones')).claude, true);
  const request = { id: randomUUID(), provider: 'claude', model: 'claude-test', text: 'Mejora la pista de Profesor Particular' };
  assert.equal((await post('/api/chat', request)).status, 202);
  assert.equal((await post('/api/chat', request)).status, 202);
  assert.equal((await post('/api/chat', { ...request, provider: 'codex' })).status, 409);
  await until('/api/chat', data => data.messages[0]?.state === 'proposal');
  let panel = await get('/api/panel');
  const delivery = panel.history.find(item => item.mode === 'implementacion');
  assert.equal(delivery.provider, 'claude'); assert.equal(delivery.providerModel, 'claude-test');
  assert.equal(delivery.quality.reviewed, true); assert.equal(delivery.quality.provider, 'claude');
  assert.ok(delivery.reviewerProfile.name); assert.equal(delivery.implementation.verified, true);
  assert.equal(delivery.checks[0].source, 'local'); assert.equal(plans, 1); assert.equal(implementations, 1); assert.equal(reviews, 1);
  assert.equal(checks, 2); assert.equal(await readFile(join(root, 'apps/profesor/demo.js'), 'utf8'), 'original\n');
  assert.equal((await post('/api/publicacion/subir', { id: randomUUID(), keys: [delivery.key] })).status, 202);
  const publication = await until('/api/publicacion', data => data.state === 'published');
  assert.equal(publication.sources[0].provider, 'claude');
  assert.equal((await readFile(join(root, 'apps/profesor/demo.js'), 'utf8')).replace(/\r\n/g, '\n'), 'pista revisada\n');
  assert.equal((await git('ls-remote', 'origin', 'refs/heads/main')).split(/\s/)[0], await git('rev-parse', 'HEAD'));
  const before = (await get('/api/proveedores')).usage.claude;
  assert.equal(before.calls, 7); assert.equal(before.input_tokens + before.output_tokens, 105);
  await new Promise(resolve => server.close(resolve)); base = await listen();
  assert.equal((await get('/api/conexiones')).claude, true);
  assert.equal((await get('/api/proveedores')).usage.claude.calls, 7);
  assert.equal((await post('/api/chat', request)).status, 202);
  panel = await get('/api/panel'); assert.equal(panel.history.length, 1);
  assert.equal(plans, 1); assert.equal(implementations, 1); assert.equal(reviews, 1);
});

test('una revisión fallida conserva la copia sin permitir completado o publicación', { timeout: 25000 }, async t => {
  const { createImplementation } = await import('../scripts/educame-dashboard/implementation.mjs');
  const dir = await temporary(t), root = join(dir, 'repo'); await mkdir(join(root, 'apps/profesor'), { recursive: true });
  await writeFile(join(root, 'apps/profesor/demo.js'), 'original\n');
  const git = (...args) => exec('git', args, { cwd: root, windowsHide: true }).then(({ stdout }) => stdout.trim());
  await git('init', '-b', 'main'); await git('config', 'user.email', 'test@example.invalid'); await git('config', 'user.name', 'Test');
  await git('add', '.'); await git('-c', 'commit.gpgsign=false', 'commit', '-m', 'Original');
  const implementation = createImplementation(root, join(dir, 'data'), { implement: async (task, cwd) => {
    if (task.agente === 'revision') return { error: 'API ocupada', uncertain: true };
    await writeFile(join(cwd, 'apps/profesor/demo.js'), 'conservado\n');
    return { draft, checks: [{ command: 'node --test tests/check.test.cjs', passed: true }] };
  } }, { localRemote: true });
  const task = { id: 'calidad-ensayo', app: 'profesor', agente: 'juegos', encargo: 'Pista', fingerprint: 'ensayo', qualityRequired: true };
  const result = await implementation.execute(task, await implementation.base());
  assert.equal(result.quality.reviewed, false); assert.ok(!result.implementation.verified);
  assert.equal(await readFile(join(implementation.worktree(task.id), 'apps/profesor/demo.js'), 'utf8'), 'conservado\n');
  const revalidated = await implementation.revalidate({ ...task, ...result });
  assert.ok(!revalidated.implementation.verified); assert.equal(revalidated.quality.reviewed, false); assert.equal(revalidated.error, 'API ocupada');
});

test('un lote API en espera conserva modelo, memoria y revisor originales al retomar', async t => {
  const { createRunner } = await import('../scripts/educame-dashboard/runner.mjs');
  const { openPanelStore } = await import('../scripts/educame-dashboard/store.mjs');
  const { defaultAgents } = await import('../scripts/educame-dashboard/agent-profiles.mjs');
  let store;
  const dir = await temporary(t, async () => store?.close());
  store = openPanelStore(dir, { tasks: [], revision: 0, memory: [{ id: 'regla', app: 'profesor', tema: 'reglas', criterio: 'Conservar las pistas', comprobacion: 'Recargar' }],
    agentEdits: { revision: { ...defaultAgents.revision, name: 'Revisión original' } } });
  const received = [];
  const options = { model: 'default', baseRevision: async () => 'a'.repeat(40), generator: () => async task => { received.push(task); return { draft }; } };
  const blocked = createRunner(store, dir, { ...options, readiness: async () => { const error = new Error('Subida en marcha'); error.status = 409; throw error; } });
  const request = { mode: 'implementacion', engine: 'claude', providerModel: 'claude-test', qualityRequired: true, enqueue: true,
    tasks: [{ id: 'espera-api', app: 'profesor', agente: 'juegos', encargo: 'Conserva las pistas', revisar: '' }] };
  const batch = await blocked.start(request); assert.equal(batch.state, 'queued');
  blocked.close(); await blocked.wait();
  store.writeBoard({ ...store.board(), memory: [], agentEdits: { revision: { ...defaultAgents.revision, name: 'Revisión posterior' } } });
  const runner = createRunner(store, dir, { ...options, readiness: async () => {} });
  t.after(async () => { runner.close(); await runner.wait(); });
  await runner.pump(); await runner.wait();
  assert.equal(received.length, 1);
  assert.equal(received[0].provider, 'claude'); assert.equal(received[0].providerModel, 'claude-test');
  assert.equal(received[0].reviewerProfile.name, 'Revisión original'); assert.equal(received[0].qualityRequired, true);
  assert.match(JSON.stringify(received[0].productContext), /Conservar las pistas/);
  const record = JSON.parse(await readFile(join(dir, 'implementaciones/espera-api.json'), 'utf8'));
  assert.equal(record.reviewerProfile.name, 'Revisión original'); assert.equal(record.provider, 'claude');
  assert.equal((await runner.start(request)).id, batch.id); assert.equal(received.length, 1);
});

test('el revisor recibe pruebas locales reales y resuelve EPERM sin ocultar pendientes funcionales', { timeout: 25000 }, async t => {
  const { createImplementation } = await import('../scripts/educame-dashboard/implementation.mjs');
  const dir = await temporary(t), root = join(dir, 'repo');
  for (const path of ['apps/profesor', 'tests']) await mkdir(join(root, path), { recursive: true });
  await writeFile(join(root, 'apps/profesor/demo.js'), 'original\n');
  await writeFile(join(root, 'tests/check.test.cjs'), "require('node:test')('pista', () => {});\n");
  const git = (...args) => exec('git', args, { cwd: root, windowsHide: true }).then(({ stdout }) => stdout.trim());
  await git('init', '-b', 'main'); await git('config', 'user.email', 'test@example.invalid'); await git('config', 'user.name', 'Test');
  await git('add', '.'); await git('-c', 'commit.gpgsign=false', 'commit', '-m', 'Original');
  let reviews = 0;
  const implementation = createImplementation(root, join(dir, 'data'), { implement: async (task, cwd) => {
    if (task.agente === 'revision') {
      reviews++;
      assert.equal(task.revision.comprobaciones_locales[0].passed, true);
      assert.equal(task.revision.comprobaciones_locales[0].source, 'local');
      assert.match(task.contexto, /no las dejes pendientes/);
      return { draft: { ...draft, pendientes: task.id === 'bloqueo-real' ? ['Terminar el guardado de respuestas.'] : [] } };
    }
    await writeFile(join(cwd, 'apps/profesor/demo.js'), 'pista accesible\n');
    return { draft: { ...draft, pendientes: ['Repetir pruebas por spawn EPERM.', 'Revisión automática de la entrega.'] },
      checks: [{ command: 'node --test tests/check.test.cjs', passed: false }] };
  } }, { localRemote: true });
  const task = { id: 'bloqueo-sandbox', app: 'profesor', agente: 'mantenimiento', encargo: 'Pista', fingerprint: 'ensayo', qualityRequired: true };
  const result = await implementation.execute(task, await implementation.base());
  assert.equal(result.implementation.verified, true); assert.equal(result.checks[0].passed, true);
  assert.equal(result.quality.implementationPending.length, 2); assert.deepEqual(result.draft.pendientes, []);
  assert.equal(reviews, 1);
  const blocked = await implementation.execute({ ...task, id: 'bloqueo-real' }, await implementation.base());
  assert.ok(!blocked.implementation.verified); assert.match(blocked.error, /puntos pendientes/);
  assert.deepEqual(blocked.draft.pendientes, ['Terminar el guardado de respuestas.']);
});
