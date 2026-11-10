const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');

const modulePromise = import('../scripts/educame-agents.mjs');
const draft = { resumen: 'Borrador', entrega: 'Entrega de prueba', comprobaciones: [], pendientes: [] };
const tasks = [
  { id: 'juego', agente: 'juegos', encargo: 'Crea un juego', contexto: 'Inglés B1' },
  { id: 'guion', agente: 'marketing', encargo: 'Prepara un guion' },
  { id: 'revisa', agente: 'revision', encargo: 'Verifica las soluciones', revisar: 'juego' },
];

async function testDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'educame-agents-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('dos encargos trabajan en paralelo y Revisión recibe solo el borrador del que depende', { timeout: 5000 }, async t => {
  const { runBatch } = await modulePromise;
  const directory = await testDirectory(t);
  const marketingStarted = Promise.withResolvers();
  const reviewStarted = Promise.withResolvers();
  const started = [];
  let active = 0;
  let peak = 0;
  let reviewInput;
  const receivedGuides = [];
  const options = { directory, model: 'simulado', generate: async task => {
    started.push(task.id);
    receivedGuides.push(task.guidance);
    peak = Math.max(peak, ++active);
    if (task.id === 'juego') await marketingStarted.promise;
    if (task.id === 'guion') {
      marketingStarted.resolve();
      await reviewStarted.promise;
    }
    if (task.id === 'revisa') {
      reviewInput = task.revision;
      reviewStarted.resolve();
    }
    active--;
    return { draft, usage: { total_tokens: 20 } };
  } };
  const results = await runBatch(tasks, options);
  assert.deepEqual(new Set(started.slice(0, 2)), new Set(['juego', 'guion']));
  assert.equal(peak, 2);
  assert.deepEqual(reviewInput, { encargo: 'Crea un juego', contexto: 'Inglés B1', borrador: draft });
  assert.ok(receivedGuides.every(guide => guide === receivedGuides[0] && guide.includes('Criterios compartidos de Educame')));
  assert.ok(results.every(record => record.status === 'borrador'));
  assert.equal(JSON.parse(await readFile(join(directory, 'juego.json'), 'utf8')).usage.total_tokens, 20);

  const repeated = await runBatch(tasks, options);
  assert.ok(repeated.every(record => record.reused));
  const [changed] = await runBatch([{ ...tasks[0], encargo: 'Otro juego' }], options);
  assert.equal(changed.status, 'bloqueado');
  const [updatedGuide] = await runBatch([tasks[0]], { ...options, guidance: 'Criterios actualizados' });
  assert.equal(updatedGuide.status, 'bloqueado');
  assert.equal(started.length, 3);
});

test('un error del proveedor bloquea su revisión y conserva la entrega independiente', async t => {
  const { runBatch } = await modulePromise;
  const directory = await testDirectory(t);
  const called = [];
  const results = await runBatch(tasks, { directory, model: 'simulado', generate: async task => {
    called.push(task.id);
    return task.id === 'juego' ? { error: 'OpenAI devolvió HTTP 429.' } : { draft };
  } });
  assert.deepEqual(results.map(result => result.status), ['fallido', 'borrador', 'bloqueado']);
  assert.ok(!called.includes('revisa'));
});

test('Responses recibe el contrato y guarda el consumo de las respuestas incompletas', async () => {
  const { requestDraft } = await modulePromise;
  const result = await requestDraft(tasks[0], {
    apiKey: 'clave-de-ensayo', model: 'simulado',
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.tools, undefined);
      assert.match(body.instructions, /Criterios compartidos de Educame/);
      assert.doesNotMatch(body.instructions, /Qué debe superar una partida/);
      const input = JSON.parse(body.input);
      assert.equal(input.encargo, 'Crea un juego');
      assert.equal(input.contexto, 'Inglés B1');
      assert.equal(input.contexto_proyecto.app, 'ecosistema');
      assert.deepEqual(input.contexto_proyecto.confirmed, []);
      assert.ok(body.text.format.schema.required.includes('aprendizaje'));
      return Response.json({ status: 'completed', id: 'resp_ensayo', usage: { total_tokens: 20 },
        output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(draft) }] }] });
    },
  });
  assert.deepEqual(result.draft, draft);
  const incomplete = await requestDraft(tasks[0], {
    apiKey: 'clave-de-ensayo', model: 'simulado',
    fetchImpl: async () => Response.json({ status: 'incomplete', usage: { total_tokens: 2001 } }),
  });
  assert.equal(incomplete.draft, undefined);
  assert.equal(incomplete.usage.total_tokens, 2001);
  assert.match(incomplete.error, /no completó/);
});
