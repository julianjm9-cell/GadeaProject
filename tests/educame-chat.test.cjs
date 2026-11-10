const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { once } = require('node:events');
const { mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, dirname } = require('node:path');
const run = require('node:util').promisify(execFile);

test('Chat usa el modelo elegido y aplica una revisión del panel solo después de confirmarla', { timeout: 45_000 }, async t => {
  const { createDashboard } = await import('../scripts/educame-dashboard.mjs');
  const temporary = await mkdtemp(join(tmpdir(), 'educame-chat-test-'));
  const root = join(temporary, 'repo');
  const directory = join(temporary, 'data');
  const git = (...args) => run('git', args, { cwd: root, windowsHide: true }).then(({ stdout }) => stdout.trim());
  const file = 'scripts/educame-dashboard/theme.css';
  await mkdir(dirname(join(root, file)), { recursive: true });
  await mkdir(join(root, 'apps'), { recursive: true });
  await writeFile(join(root, file), 'body { color: black; }\n');
  await writeFile(join(root, 'apps/demo.js'), 'export const demo = 1;\n');
  await git('init', '-b', 'main');
  await git('config', 'user.email', 'test@example.invalid');
  await git('config', 'user.name', 'Educame Test');
  await git('add', '.');
  await git('-c', 'commit.gpgsign=false', 'commit', '-m', 'Original');
  const original = await git('rev-parse', 'HEAD');
  const received = [];
  const codex = {
    status: async () => ({ ready: true }),
    models: async () => [{ id: 'ensayo-a', label: 'Ensayo A' }, { id: 'ensayo-b', label: 'Ensayo B', recommended: true }],
    ask: async input => { received.push(input); return { answer: 'Una respuesta de prueba.', tokens: 40 }; },
    implement: async (task, cwd) => {
      received.push(task);
      const target = task.encargo === 'Cambia la app pública' ? 'apps/demo.js' : file;
      await writeFile(join(cwd, target), '/* Cambio propuesto */\n');
      return { draft: { resumen: 'Una propuesta de prueba.', entrega: 'Ajusta los estilos.', comprobaciones: [], pendientes: [] },
        checks: [{ command: 'node --test', passed: true }] };
    },
  };
  const servers = new Set();
  let restartCount = 0;
  const start = async () => {
    const server = await createDashboard({ directory, repositoryRoot: root, codex, apiKey: '', restartProcess: () => { restartCount++; } });
    servers.add(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return { server, base: 'http://127.0.0.1:' + server.address().port };
  };
  const close = async server => { await new Promise(resolve => server.close(resolve)); servers.delete(server); };
  t.after(async () => {
    for (const server of servers) await close(server);
    assert.equal(dirname(temporary), tmpdir());
    await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 80 });
  });
  const { base, server } = await start();
  const get = path => fetch(base + path).then(response => response.json());
  const post = (path, body, origin = base) => fetch(base + path, { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  async function finished() {
    for (let i = 0; i < 250; i++) {
      const state = await get('/api/chat');
      if (state.messages.at(-1)?.state !== 'working') return state.messages.at(-1);
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    assert.fail('El mensaje siguió en ejecución.');
  }

  assert.equal((await get('/api/chat/modelos')).models[1].id, 'ensayo-b');
  const ask = { id: randomUUID(), text: '¿Qué es Git?', mode: 'ask', model: 'ensayo-b' };
  assert.equal((await post('/api/chat', ask, 'http://localhost:9000')).status, 403);
  assert.equal((await post('/api/chat', { ...ask, model: 'no-disponible' })).status, 400);
  assert.equal((await post('/api/chat', ask)).status, 202);
  assert.equal((await finished()).tokens, 40);
  assert.equal((await post('/api/chat', ask)).status, 202);
  assert.equal(received.length, 1);
  assert.equal(received[0].model, 'ensayo-b');
  await post('/api/chat', { ...ask, id: randomUUID(), text: '¿Y un commit?' });
  await finished();
  assert.equal(received[1].history[0].message, ask.text);

  const change = { id: randomUUID(), mode: 'change', model: 'ensayo-a', text: 'Mejora el estilo del panel' };
  assert.equal((await post('/api/chat', change)).status, 202);
  const proposal = await finished();
  assert.equal(proposal.state, 'proposal');
  assert.equal(received.at(-1).codexModel, 'ensayo-a');
  assert.equal(received.at(-1).app, 'control');
  assert.match((await get('/api/chat/propuesta?id=' + change.id)).patch, /Cambio propuesto/);
  assert.equal(await git('rev-parse', 'HEAD'), original);
  const apply = { id: change.id, commit: proposal.proposal.commit };
  assert.equal((await post('/api/chat/aplicar', { ...apply, commit: original })).status, 409);
  await writeFile(join(root, file), 'body { color: blue; }\n');
  assert.equal((await post('/api/chat/aplicar', apply)).status, 409);
  assert.match(await readFile(join(root, file), 'utf8'), /blue/);
  await writeFile(join(root, file), 'body { color: black; }\n');
  assert.equal((await (await post('/api/chat/aplicar', apply)).json()).needsRestart, true);
  assert.equal((await post('/api/chat/aplicar', apply)).status, 200);
  assert.equal(await git('rev-parse', 'HEAD'), apply.commit);
  assert.match(await readFile(join(root, file), 'utf8'), /Cambio propuesto/);
  await post('/api/chat', { ...change, id: randomUUID(), text: 'Cambia la app pública' });
  assert.equal((await finished()).state, 'error');
  assert.equal(await git('rev-parse', 'HEAD'), apply.commit);
  const stopping = once(server, 'close');
  assert.equal((await post('/api/chat/reiniciar', {})).status, 202);
  await stopping;
  servers.delete(server);
  assert.equal(restartCount, 1);
  const restarted = await start();
  const restored = await fetch(restarted.base + '/api/chat').then(response => response.json());
  assert.equal(restored.needsRestart, false);
  assert.equal(restored.messages[2].state, 'applied');
  assert.equal(restored.messages[0].reply, 'Una respuesta de prueba.');
});
