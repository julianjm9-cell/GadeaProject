const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtemp, rm, readFile, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, dirname } = require('node:path');
const { once } = require('node:events');
const fixtures = require('./chat-image-fixtures.cjs');
const draft = { resumen: 'Referencia aplicada', entrega: 'Cambio de ensayo', comprobaciones: [], pendientes: [], aprendizaje: null };
const defaults = { tasks: [], reviews: {}, pushes: {}, revision: 0, memory: [] };
async function temporary(t, beforeCleanup = async () => {}) {
  const directory = await mkdtemp(join(tmpdir(), 'educame-images-'));
  t.after(async () => { await beforeCleanup(); assert.equal(dirname(directory), tmpdir()); await rm(directory, { recursive: true, force: true, maxRetries: 5 }); });
  return directory;
}
async function library(t) {
  const { createChatImages } = await import('../scripts/educame-dashboard/chat-images.mjs');
  const { openPanelStore } = await import('../scripts/educame-dashboard/store.mjs');
  let store; const directory = await temporary(t, () => store?.close()); store = openPanelStore(directory, defaults);
  const images = createChatImages({ directory, store });
  const reference = await images.save({ name: 'Referencia.png', type: 'image/png', data: fixtures.red.toString('base64') });
  return { directory, store, images, reference };
}

test('los adjuntos privados validan formato, integridad y límites y se deduplican al reintentar', async t => {
  const { images, reference } = await library(t);
  assert.equal(reference.width, 48); assert.equal(reference.height, 32); assert.equal(reference.size, fixtures.red.length);
  assert.equal((await images.save({ name: 'Otra copia.png', type: 'image/png', data: fixtures.red.toString('base64') })).id, reference.id);
  for (const [name, type] of [['jpeg', 'image/jpeg'], ['webp', 'image/webp']]) assert.equal((await images.save({ name, type, data: fixtures[name].toString('base64') })).width, 48);
  for (const payload of [{ type: 'image/svg+xml', data: Buffer.from('<svg/>').toString('base64') }, { type: 'image/png', data: 'abcd' },
    { type: 'image/jpeg', data: fixtures.red.toString('base64') }, { type: 'image/png', data: 'a'.repeat(6_700_004) }]) {
    await assert.rejects(images.save({ name: 'No válida', ...payload }), /imagen|imágenes|MB|PNG/i);
  }
  await assert.rejects(images.load(['../config']), /cuatro imágenes/);
  await assert.rejects(images.load([reference.id, reference.id]), /cuatro imágenes/);
  await assert.rejects(images.load(['f'.repeat(64)]), /encuentra/);
  const [image] = await images.load([reference.id]); assert.deepEqual(image.bytes, fixtures.red);
  await writeFile(image.path, fixtures.blue);
  await assert.rejects(images.load([reference.id]), /ha cambiado/);
});

test('HTTP conserva imágenes tras reiniciar y rechaza subidas de otro origen y rutas arbitrarias', async t => {
  const { createDashboard } = await import('../scripts/educame-dashboard.mjs');
  let server; const directory = await temporary(t, () => close());
  const open = async () => { server = await createDashboard({ directory, apiKey: '', codex: { status: async () => ({ ready: false }) } }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); return 'http://127.0.0.1:' + server.address().port; };
  const close = async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); };
  let base = await open();
  const payload = JSON.stringify({ name: 'Referencia.png', type: 'image/png', data: fixtures.red.toString('base64') });
  const upload = headers => fetch(base + '/api/chat/imagenes', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: payload });
  assert.equal((await upload({})).status, 403);
  assert.equal((await upload({ Origin: 'https://otro.test' })).status, 403);
  const response = await upload({ Origin: base }); assert.equal(response.status, 201); const image = await response.json();
  assert.equal((await upload({ Origin: base }).then(r => r.json())).id, image.id);
  const content = await fetch(base + image.url); assert.equal(content.headers.get('Content-Type'), 'image/png'); assert.deepEqual(Buffer.from(await content.arrayBuffer()), fixtures.red);
  assert.equal((await fetch(base + image.url, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await fetch(base + '/api/chat/imagenes/not-a-file')).status, 400);
  await close(); base = await open();
  assert.deepEqual((await fetch(base + '/api/chat/imagenes?ids=' + image.id).then(r => r.json()))[0], image);
  assert.deepEqual(Buffer.from(await fetch(base + image.url).then(r => r.arrayBuffer())), fixtures.red);
});

test('la cola conserva referencias al reiniciar, aclarar, implementar y repetir sin duplicar', async t => {
  const { createChat } = await import('../scripts/educame-dashboard/chat.mjs');
  const { createChatImages } = await import('../scripts/educame-dashboard/chat-images.mjs');
  const { openPanelStore } = await import('../scripts/educame-dashboard/store.mjs');
  const { OperationError } = await import('../scripts/educame-dashboard/operations.mjs');
  let store, chat, images, busy = true, calls = [], batches = [];
  const directory = await temporary(t, () => close());
  const open = () => {
    store = openPanelStore(directory, defaults); images = createChatImages({ directory, store });
    chat = createChat({ store, images, readDelivery: async () => undefined, instance: randomUUID(), implementation: {},
      assertIdle() { if (busy) throw new OperationError(409, 'Trabajo activo'); },
      codex: { status: async () => ({ ready: true }), models: async () => [{ id: 'modelo' }],
        ask: async input => { calls.push(input); await images.load(input.attachments); return { action: 'clarify', answer: '¿En qué app?' }; },
        coordinate: async input => { calls.push(input); await images.load(input.attachments); return { plan: { action: 'implement', reply: 'Voy a aplicar la referencia.', tasks: [{ app: 'ingles', agent: 'juegos', request: 'Mejora el tablero con la referencia', after: null }] } }; } },
      runner: { start: async batch => { batches.push(batch); return { id: 'lote', state: 'queued' }; } } });
  };
  const close = async () => { chat.close(); await chat.wait(); store.close(); };
  open();
  const image = await images.save({ name: 'Referencia.png', type: 'image/png', data: fixtures.red.toString('base64') });
  const first = { id: randomUUID(), mode: 'ask', model: 'modelo', text: 'Analiza esta referencia', attachments: [image.id] };
  await chat.send(first); assert.equal(calls.length, 0);
  await close(); open(); busy = false; await chat.pump(); await chat.wait();
  const question = (await chat.read()).messages[0]; assert.equal(question.state, 'question'); assert.equal(question.attachmentPreviews[0].id, image.id);
  await chat.send(first); assert.equal(calls.length, 1);
  await assert.rejects(chat.send({ ...first, attachments: [] }), /identificador/);
  const answer = { id: randomUUID(), mode: 'ask', model: 'modelo', text: 'Es la de inglés', replyTo: first.id };
  await chat.send(answer); await chat.wait(); assert.deepEqual(calls[1].attachments, [image.id]);
  // A separate change uses the same stored reference in every planned task.
  const change = { id: randomUUID(), model: 'modelo', text: 'Mejora los juegos de inglés con la referencia', attachments: [image.id] };
  await chat.send(change); await chat.wait(); assert.equal(batches.length, 1); assert.deepEqual(batches[0].tasks[0].attachments, [image.id]);
  await chat.send(change); assert.equal(batches.length, 1);
});

test('un adjunto desaparecido termina con un error claro sin dejar el chat en un bucle de espera', async t => {
  const { createChat } = await import('../scripts/educame-dashboard/chat.mjs');
  const { OperationError } = await import('../scripts/educame-dashboard/operations.mjs');
  const { images, reference, store } = await library(t); let busy = true;
  const chat = createChat({ store, images, instance: 'ensayo', runner: {}, implementation: {}, readDelivery: async () => undefined,
    assertIdle() { if (busy) throw new OperationError(409, 'Trabajo activo'); },
    codex: { status: async () => ({ ready: true }), models: async () => [{ id: 'modelo' }], ask: async input => { await images.load(input.attachments); return { answer: 'Vista' }; } } });
  const body = { id: randomUUID(), mode: 'ask', model: 'modelo', text: 'Mira la referencia', attachments: [reference.id] };
  await chat.send(body); const [file] = await images.load(body.attachments); await rm(file.path);
  busy = false; await chat.pump(); await chat.wait();
  assert.equal((await chat.read()).messages[0].state, 'error');
  assert.match((await chat.read()).messages[0].reply, /ya no está disponible/);
  store.writeOperation('chat-images-v1', {});
  assert.equal((await chat.read()).messages[0].state, 'error'); chat.close();
});

test('Codex recibe los archivos reales con --image al coordinar y al implementar y revisar', async t => {
  const { images, reference } = await library(t);
  const { createCodex } = await import('../scripts/educame-dashboard/codex.mjs');
  let calls = 0;
  const codex = createCodex({ images, execute: async (_program, args, input) => {
    const image = args[args.indexOf('--image') + 1]; assert.deepEqual(await readFile(image), fixtures.red);
    assert.match(input, /referencias aportadas por el usuario/); calls++;
    const schema = JSON.parse(await readFile(args[args.indexOf('--output-schema') + 1], 'utf8'));
    const value = schema.properties.tasks ? { action: 'clarify', reply: '¿Qué app?', tasks: [] } : schema.properties.answer ? { action: 'answer', answer: 'Referencia vista' } : draft;
    return { code: 0, stdout: [JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(value) } }), JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 5 } })].join('\n') };
  } });
  const input = { model: 'modelo', text: 'Usa esta imagen', history: [], attachments: [reference.id] };
  await codex.coordinate({ ...input, board: defaults }); await codex.ask(input);
  const task = { id: 'ejemplo', agente: 'juegos', app: 'ingles', encargo: 'Usa esta referencia', attachments: [reference.id] };
  assert.equal((await codex.implement(task, process.cwd(), ['apps/cambridge/'])).error, undefined);
  await codex.implement({ ...task, agente: 'revision' }, process.cwd(), ['apps/cambridge/']); assert.equal(calls, 4);
});

test('el generador OpenAI de borradores y los recibos también conservan las referencias', async t => {
  const { images, reference, directory } = await library(t);
  const { requestDraft, runBatch } = await import('../scripts/educame-agents.mjs');
  const task = { id: 'borrador-visual', agente: 'juegos', app: 'ingles', encargo: 'Usa la referencia visual', attachments: [reference.id] };
  const result = await requestDraft(task, { apiKey: 'ensayo', model: 'gpt-test', images, fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    const visual = body.input[0].content.find(part => part.type === 'input_image');
    assert.deepEqual(Buffer.from(visual.image_url.split(',')[1], 'base64'), fixtures.red);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(draft) }] }] });
  } });
  assert.equal(result.draft.resumen, draft.resumen);
  const output = join(directory, 'deliveries');
  await runBatch([task], { directory: output, model: 'ensayo', memory: [], generate: async input => { assert.deepEqual(input.attachments, [reference.id]); return { draft }; } });
  assert.deepEqual(JSON.parse(await readFile(join(output, task.id + '.json'), 'utf8')).attachments, [reference.id]);
});

for (const provider of ['openai', 'claude']) test(`${provider} recibe contenido visual real en coordinación, implementación y revisión`, async t => {
  const { images, reference, directory } = await library(t);
  const { createApiAgent } = await import('../scripts/educame-dashboard/api-agent.mjs');
  const model = provider === 'claude' ? 'claude-test' : 'gpt-test'; let calls = 0, stage = 'coordinate';
  const agent = createApiAgent({ provider, key: () => 'ensayo', images, root: directory, fetchImpl: async (url, options) => {
    if (url.endsWith('/models')) return Response.json({ data: [{ id: model }] });
    const body = JSON.parse(options.body), content = (body.messages || body.input)[0].content;
    const image = content.find(part => part.type === (provider === 'claude' ? 'image' : 'input_image'));
    assert.deepEqual(Buffer.from(provider === 'claude' ? image.source.data : image.image_url.split(',')[1], 'base64'), fixtures.red);
    if (provider === 'claude') assert.equal(image.source.media_type, 'image/png');
    assert.match(body.system || body.instructions, /referencias aportadas por el usuario/);
    calls++;
    const value = stage === 'coordinate' ? { action: 'clarify', reply: '¿Qué app?', tasks: [] } : draft;
    return Response.json(provider === 'claude' ? { id: 'message', content: [{ type: 'tool_use', id: 'finish', name: 'finish', input: value }], usage: {} } : { id: 'response', status: 'completed', output: [{ type: 'function_call', call_id: 'finish', name: 'finish', arguments: JSON.stringify(value) }], usage: {} });
  } });
  await agent.coordinate({ model, text: 'Mira la imagen', history: [], board: defaults, attachments: [reference.id] });
  stage = 'implement';
  const task = { id: 'ejemplo', agente: 'juegos', app: 'ingles', encargo: 'Aplica esta referencia', providerModel: model, attachments: [reference.id] };
  assert.equal((await agent.implement(task, directory, ['apps/'])).error, undefined);
  assert.equal((await agent.implement({ ...task, agente: 'revision' }, directory, ['apps/'])).error, undefined);
  assert.equal(calls, 3);
});
