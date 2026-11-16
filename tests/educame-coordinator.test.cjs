const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtemp, mkdir, writeFile, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, dirname } = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { once } = require('node:events');
const exec = promisify(execFile);

test('el coordinador valida destinos y dependencias y conserva la petición original al ajustar', async () => {
  const { normalizeCoordination } = await import('../scripts/educame-dashboard/coordinator.mjs');
  const row = { taskId: 'terraza-' + randomUUID(), text: 'Sí, en Inglés', context: 'No borrar ningún juego.', continuations: { ingles: 'anterior' } };
  const task = { app: 'ingles', agent: 'juegos', request: 'Mejora las pistas', after: null };
  const plan = normalizeCoordination({ action: 'implement', reply: 'Preparando cambios', tasks: [task, { ...task, after: 0 }] }, row, {});
  assert.equal(plan.tasks[0].continuar, 'anterior');
  assert.equal(plan.tasks[1].despues, plan.tasks[0].id);
  assert.match(plan.tasks[0].contexto, /No borrar ningún juego/);
  assert.throws(() => normalizeCoordination({ action: 'answer', reply: 'Nada', tasks: [task] }, row, {}));
  for (const bad of [{ ...task, app: 'inventada' }, { ...task, agent: 'copiador' }, { ...task, after: 0 }]) {
    assert.throws(() => normalizeCoordination({ action: 'implement', reply: 'Cambios', tasks: [bad] }, row, {}));
  }
  assert.throws(() => normalizeCoordination({ action: 'implement', reply: 'Cambios', tasks: [task, { ...task, app: 'control', after: 0 }] }, row, {}));
});

test('Codex recibe un contrato de coordinación sin herramientas de escritura', async () => {
  const { createCodex } = await import('../scripts/educame-dashboard/codex.mjs');
  let calls = 0;
  const codex = createCodex({ execute: async (_program, args, input) => {
    calls++;
    assert.ok(args.includes('read-only'));
    assert.ok(args.includes('features.shell_tool=false'));
    const schema = JSON.parse(await readFile(args[args.indexOf('--output-schema') + 1], 'utf8'));
    assert.deepEqual(schema.properties.action.enum, ['answer', 'clarify', 'implement']);
    assert.match(input, /Profesor Particular/);
    return { code: 0, stdout: [JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ action: 'clarify', reply: '¿En qué app?', tasks: [] }) } }),
      JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 8 } })].join('\n') };
  } });
  const result = await codex.coordinate({ text: 'Mejora este juego', history: [], model: 'ensayo', board: {} });
  assert.equal(result.plan.action, 'clarify');
  assert.equal(result.tokens, 18);
  assert.equal(calls, 1);
});

test('una aclaración genera cambios en apps y LA TERRAZA, respeta dependencias y sube juntos sin duplicar', { timeout: 45000 }, async t => {
  const { createDashboard } = await import('../scripts/educame-dashboard.mjs');
  const temporary = await mkdtemp(join(tmpdir(), 'educame-coordinator-'));
  const root = join(temporary, 'repo'), directory = join(temporary, 'data'), remote = join(temporary, 'origin.git');
  const git = (...args) => exec('git', args, { cwd: root, windowsHide: true }).then(({ stdout }) => stdout.trim());
  for (const path of ['apps/profesor', 'scripts/educame-dashboard', 'tests']) await mkdir(join(root, path), { recursive: true });
  await writeFile(join(root, 'apps/profesor/demo.js'), 'original\n');
  await writeFile(join(root, 'scripts/educame-dashboard/demo.js'), 'original\n');
  await writeFile(join(root, 'tests/check.test.cjs'), "require('node:test')('ensayo', () => {});\n");
  await git('init', '-b', 'main'); await git('config', 'user.email', 'test@example.invalid'); await git('config', 'user.name', 'Test');
  await git('add', '.'); await git('-c', 'commit.gpgsign=false', 'commit', '-m', 'Original');
  await git('init', '--bare', remote); await git('remote', 'add', 'origin', remote); await git('push', 'origin', 'main');
  let plans = 0, implementations = 0;
  const codex = { status: async () => ({ ready: true }), models: async () => [{ id: 'ensayo', label: 'Ensayo' }],
    coordinate: async ({ text }) => {
      plans++;
      if (!text.includes('Profesor Particular')) return { plan: { action: 'clarify', reply: '¿En qué app quieres mejorar el juego?', tasks: [] } };
      assert.match(text, /no borres contenido/);
      return { plan: { action: 'implement', reply: 'Mejoraré el juego y las tarjetas del panel.', tasks: [
        { app: 'profesor', agent: 'juegos', request: 'Mejora el juego conservando el contenido', after: null },
        { app: 'control', agent: 'codex', request: 'Simplifica las tarjetas', after: null },
        { app: 'control', agent: 'mantenimiento', request: 'Ajusta el foco de las tarjetas', after: 1 },
      ] } };
    },
    implement: async (task, cwd) => {
      implementations++;
      const path = join(cwd, task.app === 'control' ? 'scripts/educame-dashboard/demo.js' : 'apps/profesor/demo.js');
      if (task.despues) assert.match(await readFile(path, 'utf8'), /Simplifica las tarjetas/);
      await writeFile(path, await readFile(path, 'utf8') + task.encargo + '\n');
      return { draft: { resumen: task.encargo, entrega: 'Cambio de ensayo', comprobaciones: [], pendientes: [],
        ...(task.app === 'profesor' ? { aprendizaje: { tema: 'pedagogia', criterio: 'Las pistas conservan el tablero visible.', comprobacion: 'Abrir una pista en móvil.' } } : {}) },
        checks: [{ command: 'node --test tests/check.test.cjs', passed: true }] };
    } };
  const server = await createDashboard({ directory, repositoryRoot: root, codex, apiKey: '', implementationOptions: { localRemote: true } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); assert.equal(dirname(temporary), tmpdir()); await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 80 }); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const get = path => fetch(base + path).then(response => response.json());
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  async function until(path, ready) {
    for (let i = 0; i < 500; i++) { const data = await get(path); if (ready(data)) return data; await new Promise(resolve => setTimeout(resolve, 40)); }
    assert.fail('El trabajo no terminó');
  }
  const question = { id: randomUUID(), text: 'Mejora el juego, no borres contenido, y simplifica las tarjetas de LA TERRAZA', model: 'ensayo' };
  await post('/api/chat', question);
  await until('/api/chat', data => data.messages[0].state === 'question');
  assert.equal(implementations, 0);
  const answer = { id: randomUUID(), text: 'Profesor Particular', model: 'ensayo', replyTo: question.id };
  assert.equal((await post('/api/chat', answer)).status, 202);
  assert.equal((await post('/api/chat', answer)).status, 202);
  assert.equal((await post('/api/chat', { ...answer, id: randomUUID() })).status, 409);
  const done = await until('/api/chat', data => data.messages[1]?.state === 'proposal');
  assert.equal(plans, 2); assert.equal(implementations, 3);
  assert.equal(done.messages[0].answeredBy, answer.id);
  assert.equal(done.messages[1].proposals.length, 3);
  assert.equal(await readFile(join(root, 'apps/profesor/demo.js'), 'utf8'), 'original\n');
  const keys = done.messages[1].proposals.map(item => 'implementacion/' + item.taskId);
  assert.equal((await post('/api/publicacion/subir', { keys, id: randomUUID() })).status, 202);
  await until('/api/publicacion', data => data.state === 'published');
  assert.match(await readFile(join(root, 'apps/profesor/demo.js'), 'utf8'), /Mejora el juego/);
  assert.match(await readFile(join(root, 'scripts/educame-dashboard/demo.js'), 'utf8'), /Ajusta el foco/);
  assert.equal((await git('ls-remote', 'origin', 'refs/heads/main')).split(/\s/)[0], await git('rev-parse', 'HEAD'));
  const memory = await get('/api/memoria/contexto?app=profesor');
  assert.equal(memory.context.accepted.length, 1);
  assert.equal(memory.suggestions.length, 1);
  assert.equal((await get('/api/panel')).board.memory.length, 0);
  const confirmation = await post('/api/memoria/aprendizaje', { id: memory.suggestions[0].id, action: 'accept', revision: memory.revision });
  assert.equal(confirmation.status, 200);
  assert.equal((await confirmation.json()).memory.length, 1);
  await post('/api/chat', answer);
  assert.equal(implementations, 3);
});
