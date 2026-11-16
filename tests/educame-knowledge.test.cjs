const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, dirname } = require('node:path');
const { randomUUID } = require('node:crypto');

const commit = 'a'.repeat(40), published = 'b'.repeat(40);
const learning = { tema: 'pedagogia', criterio: 'Explica los errores sin tapar el tablero.', comprobacion: 'Completar un error y seguir jugando.' };
const rule = { id: 'regla-1', app: 'profesor', ...learning, archived: false, updatedAt: '2026-11-16T12:00:00Z' };
const customId = 'agente-' + randomUUID();
const profile = { name: 'Foco', description: 'Revisa accesibilidad', draft: 'Comprueba el teclado.', implementation: 'Corrige el foco.', team: '' };

async function fixture(t) {
  const { openPanelStore } = await import('../scripts/educame-dashboard/store.mjs');
  const { createKnowledge } = await import('../scripts/educame-dashboard/knowledge.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'educame-knowledge-'));
  let store = openPanelStore(directory, { memory: [], revision: 0, agentEdits: {}, tasks: [], pushes: {}, reviews: {} });
  const delivery = { id: 'juego', app: 'profesor', finishedAt: '2026-11-16T12:00:00Z', draft: { resumen: 'Pistas integradas', aprendizaje: learning },
    checks: [{ command: 'node --test', passed: true }], implementation: { commit, verified: true, files: ['apps/profesor/index.html'] } };
  const gitCalls = [];
  const git = async args => {
    gitCalls.push(args);
    if (args[0] === 'rev-parse') return args.at(-1) === 'HEAD' ? commit : published;
    if (args[0] === 'ls-tree') return 'apps/profesor/index.html\napps/profesor/assets/train.webp\napps/cambridge/index.html\n.env\n.educame-agents/panel.sqlite';
    if (args[0] === 'log') return `${commit}\t2026-11-16T12:00:00Z\tActualiza el juego`;
    throw new Error('Comando inesperado');
  };
  const options = () => ({ store, root: directory, git, readDelivery: async () => delivery });
  let knowledge = createKnowledge(options());
  const close = async () => { await knowledge.wait(); store.close(); };
  t.after(async () => { await close(); assert.equal(dirname(directory), tmpdir()); await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 80 }); });
  return { directory, gitCalls, delivery, get store() { return store; }, get knowledge() { return knowledge; },
    publish() { const board = store.board(); store.writeBoard({ ...board, pushes: { 'implementacion/juego': { commit, integratedRevision: published } } }); },
    async reopen() { await close(); store = openPanelStore(directory, {}); knowledge = createKnowledge(options()); } };
}

test('solo los cambios integrados producen hechos y sus propuestas requieren confirmación', async t => {
  const f = await fixture(t);
  let data = await f.knowledge.read('profesor');
  assert.equal(data.context.accepted.length, 0);
  f.publish();
  data = await f.knowledge.read('profesor');
  assert.equal(data.context.accepted.length, 1);
  assert.equal(data.suggestions.length, 1);
  assert.equal(f.store.board().memory.length, 0);
  assert.equal(data.context.inventory.illustrations, 1);
  assert.ok(data.context.inventory.references.every(file => !file.includes('.env') && !file.includes('.educame-agents')));
  assert.match(data.context.versionNote, /no una comprobación del VPS/);
  const id = data.suggestions[0].id;
  const saved = await f.knowledge.decide({ id, action: 'accept', revision: data.revision });
  assert.equal(saved.memory.length, 1);
  assert.equal(saved.memory[0].app, 'profesor');
  assert.equal((await f.knowledge.decide({ id, action: 'accept', revision: 0 })).memory.length, 1);
  await f.reopen();
  data = await f.knowledge.read('profesor');
  assert.equal(data.context.accepted.length, 1);
  assert.equal(data.suggestions.length, 0);
  assert.ok(f.gitCalls.every(args => ['rev-parse', 'ls-tree', 'log'].includes(args[0])));
});

test('descartar, archivar o deshacer no vuelve a promover una propuesta automáticamente', async t => {
  const f = await fixture(t); f.publish();
  const data = await f.knowledge.read('profesor');
  await f.knowledge.decide({ id: data.suggestions[0].id, action: 'dismiss', revision: data.revision });
  await f.reopen();
  assert.equal((await f.knowledge.read('profesor')).suggestions.length, 0);
  const board = f.store.board(); board.pushes['implementacion/juego'].undoneRevision = 'c'.repeat(40); f.store.writeBoard(board);
  assert.equal((await f.knowledge.read('profesor')).context.accepted.length, 0);
  assert.equal(f.store.board().memory.length, 0);
});

test('una entrega sin verificar o con otro commit no entra en el contexto aceptado', async t => {
  const f = await fixture(t); f.publish();
  f.delivery.implementation.verified = false;
  assert.equal((await f.knowledge.read('profesor')).suggestions.length, 0);
  f.delivery.implementation.verified = true; f.delivery.implementation.commit = 'c'.repeat(40);
  assert.equal((await f.knowledge.read('profesor')).context.accepted.length, 0);
});

test('una publicación sin entregas también conserva su contexto y respeta Deshacer', async t => {
  const f = await fixture(t);
  f.store.writeOperation('simple-publication-v1-last-published', { id: 'subida-directa', state: 'published', candidate: commit,
    files: ['apps/profesor/index.html'], sources: [], publishedAt: '2026-11-16T12:00:00Z', checks: [{ passed: true }] });
  const data = await f.knowledge.read('profesor');
  assert.equal(data.context.accepted.length, 1); assert.equal(data.suggestions.length, 0);
  f.store.writeOperation('simple-publication-v1-last-published', { id: 'deshacer', state: 'published', candidate: published, undoOf: 'subida-directa', files: [] });
  assert.equal((await f.knowledge.read('profesor')).context.accepted.length, 0);
});

test('exporta contexto portable sin colas ni credenciales y aplica imports sin pisar o duplicar', async t => {
  const f = await fixture(t);
  f.store.writeBoard({ ...f.store.board(), memory: [rule], agentEdits: { [customId]: profile }, tasks: [{ text: 'CONVERSACION_PRIVADA' }], privateAccount: 'DATO_PRIVADO' });
  f.store.writeOperation('vault', { apiKey: 'SECRETO_DE_ENSAYO' });
  const bundle = await f.knowledge.exportBundle();
  assert.doesNotMatch(JSON.stringify(bundle), /CONVERSACION_PRIVADA|DATO_PRIVADO|SECRETO_DE_ENSAYO|apiKey/);
  const md = await f.knowledge.markdown('profesor');
  assert.match(md.text, /Profesor Particular/); assert.match(md.text, /Explica los errores/);
  assert.equal(md.filename, 'educame-contexto-profesor.md');
  f.store.writeBoard({ ...f.store.board(), memory: [], agentEdits: {} });
  const preview = f.knowledge.preview(bundle);
  assert.equal(preview.rulesAdded, 1); assert.equal(preview.agentsAdded, 1);
  assert.equal(f.store.board().memory.length, 0, 'preparar no importa nada');
  const saved = f.knowledge.applyImport(preview);
  assert.equal(saved.memory.length, 1); assert.equal(saved.agentEdits[customId].name, 'Foco');
  assert.equal(f.knowledge.applyImport(preview).memory.length, 1);
  const again = f.knowledge.preview(bundle);
  assert.equal(again.rulesAdded, 0); assert.equal(again.agentsAdded, 0);
  const changed = structuredClone(bundle); changed.rules[0].criterio = 'Texto que intenta sustituir el actual.';
  const conflict = f.knowledge.preview(changed);
  assert.equal(conflict.rulesAdded, 0); assert.equal(conflict.conflicts.length, 1);
  f.knowledge.applyImport(conflict);
  assert.equal(f.store.board().memory[0].criterio, rule.criterio);
});

test('una edición posterior invalida la importación y se rechazan documentos privados', async t => {
  const f = await fixture(t);
  const bundle = { format: 'educame-context', version: 1, rules: [rule], agents: {} };
  const preview = f.knowledge.preview(bundle);
  f.store.writeBoard({ ...f.store.board(), revision: 1 });
  assert.throws(() => f.knowledge.applyImport(preview), { status: 409 });
  assert.throws(() => f.knowledge.preview({ ...bundle, credentials: {} }), { status: 400 });
  assert.throws(() => f.knowledge.preview({ ...bundle, rules: [{ ...rule, criterio: 'sk-' + 'X'.repeat(32) }] }), { status: 400 });
  assert.throws(() => f.knowledge.preview({ ...bundle, agents: { [customId]: { ...profile, token: 'no permitido' } } }), { status: 400 });
  assert.throws(() => f.knowledge.preview({ ...bundle, rules: [{ ...rule, app: 'inventada' }] }), { status: 400 });
});

test('el contexto del lote queda fijado y se conserva al retomar aunque cambie la revisión', async t => {
  const f = await fixture(t);
  const { createRunner } = await import('../scripts/educame-dashboard/runner.mjs');
  let version = commit, snapshots = 0;
  const received = [];
  const runner = createRunner(f.store, f.directory, { model: 'ensayo', readiness: async () => {},
    baseRevision: async () => version, contextSnapshot: async () => { snapshots++; return { profesor: { revision: version, accepted: [] } }; },
    generator: () => async task => { received.push(task.productContext); return { draft: { resumen: 'Ensayo', entrega: 'Hecho', comprobaciones: [], pendientes: [] } }; } });
  t.after(async () => { runner.close(); await runner.wait(); });
  const first = await runner.start({ mode: 'real', engine: 'codex', enqueue: true,
    tasks: [{ id: 'con-contexto', app: 'profesor', agente: 'juegos', encargo: 'Mejora el juego' }] });
  await runner.wait();
  assert.equal(received[0].evidence.revision, commit);
  const batch = f.store.batch(first.id); batch.state = 'paused'; batch.tasks.push({ id: 'despues', app: 'profesor', agente: 'juegos', encargo: 'Revisa el siguiente' });
  batch.jobs.despues = { status: 'pendiente' }; f.store.update(batch);
  version = published;
  await runner.resume(first.id); await runner.wait();
  assert.equal(received.at(-1).evidence.revision, commit);
  assert.equal(snapshots, 1);
});
