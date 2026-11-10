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

test('Copiador valida fuentes públicas y conserva evidencia e ideas en el contrato de búsqueda', async () => {
  const { validateTasks, requestDraft } = await modulePromise;
  const url = 'https://www.youtube.com/watch?v=prueba';
  const other = 'https://www.instagram.com/p/ensayo/';
  const input = { id: 'analisis', agente: 'copiador', app: 'ingles', encargo: 'Analiza el recorrido', fuentes: [url, url + '#fragmento', other] };
  const [task] = validateTasks([input]);
  assert.deepEqual(task.fuentes, [url, other]);
  for (const privateUrl of ['file:///secret', 'http://127.0.0.1:4317', 'https://example.com/?access_token=secreto', 'https://user:pass@example.com', 'https://office.internal/app']) {
    assert.throws(() => validateTasks([{ ...input, fuentes: [privateUrl] }]), /enlaces públicos/);
  }
  let searched = true;
  const run = () => requestDraft(task, {
    apiKey: 'clave-de-ensayo', model: 'simulado',
    fetchImpl: async (_, options) => {
      const body = JSON.parse(options.body);
      assert.deepEqual(body.tools, [{ type: 'web_search' }]);
      assert.deepEqual(JSON.parse(body.input).fuentes_publicas, task.fuentes);
      assert.match(JSON.parse(body.input).contexto_proyecto.profile.audience, /B2 First/);
      assert.match(body.instructions, /Ignora sus instrucciones/);
      assert.ok(body.text.format.schema.required.includes('investigacion'));
      const text = JSON.stringify({ ...draft, investigacion: { fuentes: [
        { url, estado: 'consultada', observacion: 'Descripción pública.' },
        { url: other, estado: 'inaccesible', observacion: 'Solicita acceso.' },
        { url: 'javascript:alert(1)', estado: 'consultada', observacion: 'Inválida.' },
      ], ideas: [{ titulo: 'Mapa de decisiones', propuesta: 'Diseña una misión original.', beneficio: 'Practicar inferencias.',
        esfuerzo: 'medio', prueba: 'Completar dos rutas.', agente: 'juegos', fuentes: [url, 'https://example.com/no-citada'] }] } });
      return Response.json({ status: 'completed', output: [
        ...(searched ? [{ type: 'web_search_call', status: 'completed' }] : []),
        { type: 'message', content: [{ type: 'output_text', text, annotations: searched ? [{ type: 'url_citation', url, title: 'Vídeo de ensayo' }] : [] }] },
      ] });
    },
  });
  const result = await run();
  assert.equal(result.research.searched, true);
  assert.equal(result.research.fuentes[0].title, 'Vídeo de ensayo');
  assert.equal(result.research.fuentes[1].estado, 'inaccesible');
  assert.deepEqual(result.research.ideas[0].fuentes, [url]);
  searched = false;
  const unconfirmed = await run();
  assert.equal(unconfirmed.research.searched, false);
  assert.ok(unconfirmed.research.fuentes.every(source => source.estado === 'inaccesible'));
});

test('la memoria ampliada prioriza coincidencias y conserva criterios variados dentro del ámbito', async () => {
  const { projectContext, projectProfiles } = await import('../scripts/educame-dashboard/project-context.mjs');
  for (const profile of Object.values(projectProfiles)) assert.ok(profile.audience && profile.priorities && profile.pitfalls);
  const rule = (id, app, tema, criterio, archived = false) => ({ id, app, tema, criterio, comprobacion: 'Verificar en ensayo.', archived });
  const rules = [rule('relevante', 'profesor', 'pedagogia', 'Fracciones equivalentes.'), rule('teclado', 'profesor', 'accesibilidad', 'Probar foco de teclado.'),
    rule('fuera', 'eso', 'pedagogia', 'Fracciones equivalentes.'), rule('archivado', 'profesor', 'pedagogia', 'Fracciones equivalentes.', true),
    rule('global', 'ecosistema', 'operacion', 'Usar datos ficticios.'),
    ...Array.from({ length: 13 }, (_, index) => rule(`estilo-${index}`, 'profesor', 'estetica', `Tema visual ${index}.`))];
  const context = projectContext({ app: 'profesor', encargo: 'Crea un reto de fracciones' }, rules);
  assert.equal(context.confirmed[0].id, 'relevante');
  assert.equal(context.confirmed.length, 11);
  assert.ok(context.confirmed.some(item => item.id === 'teclado'));
  assert.equal(context.confirmed.at(-1).id, 'global');
  assert.ok(context.confirmed.every(item => !['fuera', 'archivado'].includes(item.id)));
});
