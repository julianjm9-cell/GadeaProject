const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtemp, rm, readFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, relative, resolve } = require('node:path');
const { test } = require('node:test');
const { chromium, webkit } = require('./browser-runtime.cjs');

async function listen(t, directory, options) {
  const { createDashboard } = await import('../scripts/educame-dashboard.mjs');
  const server = await createDashboard({ directory, apiKey: '', ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const context of server.browserForTest?.contexts() || []) for (const page of context.pages()) await page.unrouteAll({ behavior: 'wait' });
    await server.browserForTest?.close();
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    assert.match(relative(resolve(tmpdir()), resolve(directory)), /^educame-(?:changes-)?browser-[\w-]+$/);
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  return server;
}

for (const [name, engine, viewport] of [
  ['Chromium escritorio', chromium, { width: 1440, height: 950 }],
  ['WebKit móvil', webkit, { width: 390, height: 844 }],
]) {
  test(`Motores API se conectan, cambian de modelo y conservan el encargo en ${name}`, { timeout: 35000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-browser-'));
    let modelCalls = 0, messages = 0;
    const server = await listen(t, directory, { codex: { status: async () => ({ ready: true }),
      models: async () => [{ id: 'codex-ensayo', label: 'Codex ensayo' }] }, fetchImpl: async (url, options) => {
      if (url === 'https://api.anthropic.com/v1/models') { modelCalls++; return new Response(JSON.stringify({ data: [{ id: 'claude-test', display_name: 'Claude ensayo' }] })); }
      if (url === 'https://api.anthropic.com/v1/messages') {
        messages++; const body = JSON.parse(options.body); assert.equal(body.model, 'claude-test');
        return new Response(JSON.stringify({ id: 'msg-test', content: [{ type: 'tool_use', id: 'finish', name: 'finish', input: { action: 'answer', reply: 'Consulta respondida por Claude.', tasks: [] } }],
          usage: { input_tokens: 20, output_tokens: 10 } }));
      }
      return new Response(JSON.stringify({ paused: [] }));
    } });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    server.browserForTest = browser; const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const base = 'http://127.0.0.1:' + server.address().port;
    await page.goto(base + '/#chat');
    await page.locator('.order-settings').evaluate(node => { node.open = true; });
    await page.locator('#chat-provider').selectOption('claude');
    await page.getByText('Configura Claude API en Conexiones.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Añadir a la cola', exact: true }).isEnabled(), false);
    await page.goto(base + '/#conexiones');
    await page.getByRole('button', { name: 'Agentes e IA', exact: true }).click();
    await page.getByLabel('Clave API de Claude').fill('sk-ant-ensayo-no-real');
    await page.getByRole('button', { name: 'Guardar clave de Claude', exact: true }).click();
    await page.locator('#claude-status').getByText('Clave guardada', { exact: true }).waitFor();
    await page.goto(base + '/#chat');
    await page.getByRole('button', { name: 'Actualizar modelos', exact: true }).click();
    await page.locator('.order-settings').evaluate(node => { node.open = true; });
    await page.locator('#chat-model').selectOption('claude-test');
    await page.getByLabel('¿Qué quieres hacer?').fill('Explícame la revisión de los juegos');
    await page.getByRole('button', { name: 'Añadir a la cola', exact: true }).click();
    await page.getByText('Consulta respondida por Claude.', { exact: true }).waitFor();
    assert.match(await page.locator('#chat-messages').innerText(), /Claude API/);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#chat-model').value === 'claude-test');
    assert.equal(await page.locator('#chat-provider').inputValue(), 'claude');
    await page.goto(base + '/#chat');
    const form = page.locator('#chat-form');
    await form.getByLabel('¿Qué quieres hacer?').fill('Mejora las pistas sin borrar contenido.');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#chat-model').value === 'claude-test');
    assert.equal(await form.getByLabel('¿Qué quieres hacer?').inputValue(), 'Mejora las pistas sin borrar contenido.');
    assert.equal(messages, 1); assert.ok(modelCalls >= 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
  });

  test(`Memoria exporta, revisa e importa criterios sin sustituirlos en ${name}`, { timeout: 30000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-browser-'));
    const server = await listen(t, directory, { codex: { status: async () => ({ ready: true }) } });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    server.browserForTest = browser;
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const base = 'http://127.0.0.1:' + server.address().port;
    await page.goto(base + '/#memoria');
    await page.locator('#memory-app').selectOption('profesor');
    await page.getByText('Añadir criterio', { exact: true }).click();
    const form = page.locator('#memory-form');
    await form.getByLabel('Criterio', { exact: true }).fill('Las pistas no tapan los botones.');
    await form.getByLabel('Cómo comprobarlo').fill('Abrir una pista y seguir jugando.');
    await form.getByRole('button', { name: 'Guardar criterio', exact: true }).click();
    await page.locator('#memory-rules').getByText('Las pistas no tapan los botones.', { exact: true }).waitFor();
    await page.getByText('Copiar o mover la memoria', { exact: true }).click();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar memoria completa' }).click();
    const bundle = JSON.parse(await readFile(await (await downloaded).path(), 'utf8'));
    assert.equal(bundle.rules.length, 1);
    assert.equal(bundle.tasks, undefined); assert.equal(bundle.connections, undefined);
    bundle.rules.push({ id: 'importado-ensayo', app: 'profesor', tema: 'pedagogia', criterio: 'Explica cada error con un ejemplo.', comprobacion: 'Equivocarse y leer la ayuda.', archived: false });
    await page.locator('#memory-import').setInputFiles({ name: 'memoria.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
    await page.locator('#memory-import-preview').getByText('1 criterios y 0 perfiles nuevos.', { exact: false }).waitFor();
    const before = await page.evaluate(async () => (await (await fetch('/api/panel')).json()).board.memory.length);
    assert.equal(before, 1);
    await page.getByRole('button', { name: 'Importar sin sustituir lo actual' }).click();
    await page.locator('#memory-import-preview').getByText('Memoria importada.', { exact: false }).waitFor();
    await page.locator('#memory-rules').getByText('Explica cada error con un ejemplo.', { exact: true }).waitFor();
    const mdDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar contexto de esta app' }).click();
    const md = await readFile(await (await mdDownload).path(), 'utf8');
    assert.match(md, /Profesor Particular/); assert.match(md, /Explica cada error/);
    await page.locator('#memory-import').setInputFiles({ name: 'memoria.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
    await page.locator('#memory-import-preview').getByText('0 criterios y 0 perfiles nuevos.', { exact: false }).waitFor();
    assert.equal(await page.locator('#memory-import-apply').isVisible(), false);
    await page.reload();
    await page.locator('#memory-app').selectOption('profesor');
    await page.locator('#memory-rules').getByText('Explica cada error con un ejemplo.', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
  });

  test(`Chat automático pregunta, conserva el borrador y permite responder en ${name}`, { timeout: 25000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-browser-'));
    const captured = [];
    const server = await listen(t, directory, { codex: { status: async () => ({ ready: true }),
      models: async () => [{ id: 'modelo', label: 'Modelo' }], coordinate: async input => {
        captured.push(input);
        return { plan: { action: input.text.includes('Profesor Particular') ? 'answer' : 'clarify',
          reply: input.text.includes('Profesor Particular') ? 'Entendido, conservamos los juegos.' : '¿En qué aplicación quieres cambiar el juego?', tasks: [] } };
      } } });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    server.browserForTest = browser;
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(8000);
    await page.goto('http://127.0.0.1:' + server.address().port + '/#chat');
    await page.locator('.order-settings').evaluate(node => { node.open = true; });
    await page.locator('#chat-model').selectOption('modelo');
    assert.equal(await page.locator('#chat-mode').inputValue(), 'auto');
    await page.getByLabel('¿Qué quieres hacer?').fill('Mejora el juego sin borrar contenido');
    await page.reload();
    assert.equal(await page.getByLabel('¿Qué quieres hacer?').inputValue(), 'Mejora el juego sin borrar contenido');
    await page.getByRole('button', { name: 'Añadir a la cola', exact: true }).click();
    await page.getByRole('button', { name: 'Responder', exact: true }).click();
    await page.getByLabel('¿Qué quieres hacer?').fill('Profesor Particular');
    await page.reload();
    await page.locator('#chat-reply-context').waitFor();
    await page.getByRole('button', { name: 'Añadir a la cola', exact: true }).click();
    await page.getByText('Entendido, conservamos los juegos.', { exact: true }).waitFor();
    assert.equal(captured.length, 2);
    assert.match(captured[1].text, /sin borrar contenido/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  });


  test(`El logo alterna el nombre del entorno y conserva la elección en ${name}`, { timeout: 25_000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-browser-'));
    const server = await listen(t, directory, { codex: { status: async () => ({ ready: false }) } });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    server.browserForTest = browser;
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(8000);
    await page.goto('http://127.0.0.1:' + server.address().port + '/#inicio');
    const toggle = page.locator('#environment-name-toggle');
    assert.equal(await page.locator('.terrace-photo').isVisible(), true);
    await page.getByRole('button', { name: 'Ocultar nombre del entorno', exact: true }).click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.terrace-photo').isVisible(), false);
    assert.ok(await page.locator('.terrace-welcome').evaluate(node =>
      Math.abs(node.getBoundingClientRect().width - node.parentElement.clientWidth) <= 1));
    assert.equal(await page.title(), 'Cuadro de mando · Educame');
    assert.deepEqual(await page.locator('[data-environment-name]').allTextContents(), ['Cuadro de mando', 'Cuadro de mando']);
    assert.equal(new URL(page.url()).hash, '#inicio');
    await page.reload();
    await page.getByRole('button', { name: 'Mostrar nombre del entorno', exact: true }).waitFor();
    assert.equal(await page.locator('.terrace-photo').isVisible(), false);
    assert.equal(await page.title(), 'Cuadro de mando · Educame');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await toggle.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.title(), 'LA TERRAZA · Educame');
    assert.equal(await page.locator('.terrace-photo').isVisible(), true);
    await page.keyboard.press('Space');
    assert.equal(await page.title(), 'Cuadro de mando · Educame');
    await toggle.click();
    await toggle.click();
    assert.equal(await page.title(), 'Cuadro de mando · Educame');
    await page.reload();
    await page.getByRole('button', { name: 'Mostrar nombre del entorno', exact: true }).waitFor();
    if (name.includes('móvil')) await page.getByRole('button', { name: 'Menú', exact: true }).click();
    await page.locator('#terrace-navigation').getByRole('link', { name: 'Inicio', exact: true }).click();
    assert.equal(await page.locator('[data-page="inicio"]').isVisible(), true);
  });


  test(`Chat permite seguir escribiendo y retoma los mensajes en espera en ${name}`, { timeout: 25000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-browser-'));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    t.after(() => release());
    const received = [];
    const server = await listen(t, directory, { codex: {
      status: async () => ({ ready: true }), models: async () => [{ id: 'modelo', label: 'Modelo' }],
      ask: async ({ text }) => { received.push(text); await gate; return { answer: 'Respuesta: ' + text }; },
      coordinate: async ({ text }) => { received.push(text); await gate; return { plan: { action: 'answer', reply: 'Respuesta: ' + text, tasks: [] } }; },
    } });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    server.browserForTest = browser;
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(8000);
    await page.goto('http://127.0.0.1:' + server.address().port + '/#chat');
    await page.locator('.order-settings').evaluate(node => { node.open = true; });
    await page.locator('#chat-model').selectOption('modelo');
    await page.getByLabel('¿Qué quieres hacer?').fill('Primera pregunta');
    await page.getByRole('button', { name: 'Añadir a la cola', exact: true }).click();
    await page.getByText('Entendiendo tu petición…', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Añadir a la cola', exact: true }).isEnabled(), true);
    await page.getByLabel('¿Qué quieres hacer?').fill('Segunda pregunta');
    await page.getByRole('button', { name: 'Añadir a la cola', exact: true }).click();
    await page.getByText('Mensaje guardado en la cola.', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('Mensaje guardado en la cola.', { exact: true }).waitFor();
    assert.deepEqual(received, ['Primera pregunta']);
    release();
    await page.getByText('Respuesta: Segunda pregunta', { exact: true }).waitFor();
    assert.deepEqual(received, ['Primera pregunta', 'Segunda pregunta']);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  });



  test(`Crear, configurar y encargar agentes en ${name}`, { timeout: 35_000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-changes-browser-'));
    const server = await listen(t, directory, { codex: { status: async () => ({ ready: true }) } });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    server.browserForTest = browser;
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(8000);
    const base = 'http://127.0.0.1:' + server.address().port;
    await page.goto(base + '/#agentes/nuevo');
    const editorButton = page.getByRole('button', { name: 'Gestionar agentes' });
    await editorButton.click();
    const editor = page.getByRole('dialog', { name: 'Gestionar agentes' });
    await editor.getByRole('button', { name: 'Juegos', exact: true }).click();
    const implementation = editor.getByLabel('Instrucciones para implementar con Codex');
    const original = await implementation.inputValue();
    assert.match(original, /Crea o mejora todos los juegos solicitados/);
    await implementation.fill('Comprueba la ronda final desde un móvil.');
    await editor.getByRole('button', { name: 'Guardar cambios' }).click();
    await editor.getByText('Cambios guardados para los próximos encargos.').waitFor();
    page.once('dialog', confirmation => confirmation.accept());
    await editor.getByRole('button', { name: 'Restaurar valores originales' }).click();
    await editor.getByText('Valores originales restaurados.').waitFor();
    assert.equal(await implementation.inputValue(), original);
    await editor.getByRole('button', { name: 'Copiador', exact: true }).click();
    assert.equal(await implementation.isVisible(), false);
    await editor.getByText('Ver reglas base de investigación').click();
    await editor.getByText(/Investiga las fuentes públicas indicadas/).waitFor();
    await editor.getByRole('button', { name: 'Nuevo agente', exact: true }).click();
    await editor.getByLabel('Nombre', { exact: true }).fill('Accesibilidad');
    await editor.getByLabel('Descripción breve').fill('Revisa las interacciones con teclado.');
    await implementation.fill('Corrige los controles que no se puedan usar con teclado.');
    await editor.getByRole('button', { name: 'Crear agente', exact: true }).click();
    await editor.getByText('Agente creado. Ya puedes preparar su primer encargo.').waitFor();
    assert.ok(await editor.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await editor.getByRole('button', { name: 'Preparar encargo', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });
    await page.getByRole('heading', { name: 'Encargos', exact: true }).waitFor();
    await page.getByLabel('¿Qué quieres hacer?').fill('Con el agente Accesibilidad: revisa la navegación de Inglés con teclado.');
    await page.reload();
    assert.match(await page.getByLabel('¿Qué quieres hacer?').inputValue(), /Accesibilidad/);
    await page.getByRole('button', { name: 'Gestionar agentes' }).click();
    await page.getByRole('dialog', { name: 'Gestionar agentes' }).getByRole('button', { name: 'Accesibilidad', exact: true }).waitFor();

  });

  test(`Operación y uso de Codex en ${name}`, { timeout: 35_000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-changes-browser-'));
    const server = await listen(t, directory, { codex: {
      status: async () => ({ ready: true, message: 'Sesión local activa' }),
      usage: async () => ({ windows: [{ usedPercent: 22, durationMinutes: 300, resetsAt: 1900000000 },
        { usedPercent: 41, durationMinutes: 10080, resetsAt: 1900500000 }],
        limitsFresh: true, accountTokens: 1234, tokensFresh: true }),
    } });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    server.browserForTest = browser;
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = 'http://127.0.0.1:' + server.address().port;
    const revision = '1'.repeat(40);
    const previous = '2'.repeat(40);
    const pull = { number: 9, title: 'Un cambio para revisar', branch: 'codex/example', base: 'main', head: revision, open: true,
      mergeable: true, url: 'https://github.com/educame/test/pull/9', checks: { rows: [{ name: 'Pruebas', conclusion: 'success' }], ready: true },
      files: [{ name: 'app.js', additions: 1, deletions: 0, patch: '+nuevo' }] };
    const target = 'educame-vps';
    let job, deploymentCount = 0, paused = false, signed = false;
    let checked = false, approved = false, published = false;
    const key = 'implementacion/cambio-ensayo';
    const delivery = () => ({ id: 'cambio-ensayo', key, mode: 'implementacion', agente: 'juegos', app: 'ingles',
      model: 'Codex local', encargo: 'Mejora el tablero de Inglés', finishedAt: '2026-11-10T12:00:00Z',
      usage: { total_tokens: 9876 },
      status: checked ? 'completado' : 'borrador', canRevalidate: !checked,
      draft: { resumen: 'Tablero de ensayo', entrega: 'El tablero está preparado.' },
      implementation: { verified: checked, commit: checked ? revision : undefined, files: ['apps/cambridge/index.html'] } });
    const review = { decision: 'aprobada', commit: revision, note: '' };
    const push = { commit: revision, pull: { number: pull.number, url: pull.url } };
    await page.route('**/api/panel', async route => {
      const data = await (await route.fetch()).json();
      data.history.unshift(delivery());
      if (approved) data.board.reviews[key] = review;
      if (published) data.board.pushes[key] = push;
      return route.fulfill({ json: data });
    });
    await page.route('**/api/revisar', async route => {
      assert.equal(route.request().postDataJSON().commit, revision);
      approved = true;
      const { board } = await (await page.request.get(base + '/api/panel')).json();
      return route.fulfill({ json: { ...board, reviews: { [key]: review } } });
    });
    await page.route('**/api/encargos/*', route => {
      const path = new URL(route.request().url()).pathname.split('/').at(-1);
      if (path === 'comprobar') { checked = true; return route.fulfill({ json: delivery() }); }
      if (path === 'diferencias') return route.fulfill({ json: { commit: revision, patch: '+nuevo tablero' } });
      if (path === 'publicar') {
        assert.equal(approved, true);
        assert.equal(route.request().postDataJSON().commit, revision);
        published = true;
        return route.fulfill({ json: { board: { pushes: { [key]: push } } } });
      }
      if (path === 'verificar-publicacion') return route.fulfill({ json: { revision } });
      return route.continue();
    });
    const account = { id: 'fixture', full_name: 'Docente de ensayo', email: 'docente@example.invalid', role: 'user',
      is_active: true, organization_name: 'Ensayo', accesses: [] };
    await page.route('**/api/operacion/**', route => {
      const path = new URL(route.request().url()).pathname.replace('/api/operacion/', '');
      let json;
      if (path === 'github') json = { connected: true, repository: 'educame/test', branches: [] };
      if (path === 'github/lista') json = [pull];
      if (path === 'github/detalle') json = { ...pull, deliveryKey: key };
      if (path === 'github/fusionar') {
        pull.open = false;
        pull.merged = true;
        json = { merged: true, sha: revision };
      }
      if (path === 'hostinger/estado') json = { target, job, history: job ? [job] : [] };
      if (path === 'hostinger/preparar') json = { id: 'fixture', revision, before: previous, target, ciChecked: true };
      if (path === 'hostinger/desplegar') {
        const request = route.request().postDataJSON();
        if (request.confirm !== '1111111') return route.fulfill({ status: 400, json: { error: 'Código incorrecto.' } });
        assert.equal(request.revision, revision);
        deploymentCount++;
        job = { revision, state: 'completed', startedAt: new Date().toISOString(), logs: ['[5/5] Comprobado'] };
        json = job;
      }
      if (path === 'admin') json = signed ? { connected: true, accounts: [account], organizations: [], apps: { CAMBRIDGE: { paused } } } : { connected: false };
      if (path === 'admin/apps') json = { revision: 0, apps: [] };
      if (path === 'admin/login') { signed = true; json = { connected: true }; }
      if (path === 'admin/logout') { signed = false; json = { connected: false }; }
      if (path === 'admin/pause') { paused = route.request().postDataJSON().paused; json = { paused }; }
      assert.ok(json, path);
      return route.fulfill({ json });
    });
    await page.route('**/api/cambios/sincronizar', route => route.fulfill({ json: {} }));
    await page.route('**/api/cambios?*', route => route.fulfill({ json: { upstream: revision, commits: [] } }));
    await page.route('**/api/cambios/hostinger', route => {
      assert.equal(route.request().postDataJSON().revision, revision);
      return route.fulfill({ json: { revision, command: 'bash infra/deploy-hostinger.sh' } });
    });
    await page.goto(base + '/#entregas/cambio-ensayo');
    await page.getByRole('link', { name: 'Codex · 78 % disponible' }).waitFor();
    const quotaTitle = await page.locator('#codex-quota-chip').getAttribute('title');
    assert.match(quotaTitle, /Límite de 5 h · 78 % disponible · Se renueva el/);
    assert.match(quotaTitle, /Límite semanal · 59 % disponible · Se renueva el/);
    await page.getByRole('heading', { name: 'Encargos', exact: true }).waitFor();
    assert.equal(await page.locator('#delivery-dialog').isVisible(), false);
    const chip = page.locator('#codex-quota-chip'), tooltip = page.getByRole('tooltip');
    await chip.hover();
    await tooltip.waitFor({ state: 'visible' });
    assert.match(await tooltip.textContent(), /Límite semanal · 59 % disponible/);
    const bounds = await tooltip.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
    await chip.focus();
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    await page.mouse.move(0, 0);
    await chip.blur();
    await page.goto(base + '/#control/github/9');
    assert.equal(new URL(page.url()).hash, '#control/github/9');
    await page.getByText('app.js', { exact: false }).click();
    await page.getByText('+nuevo', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Fusionar en main' }).click();
    const merge = page.getByRole('dialog', { name: 'Fusionar en GitHub' });
    await merge.getByRole('textbox').fill('1111111');
    await merge.getByRole('button', { name: 'Fusionar', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar a Hostinger' }).click();

    await page.getByText('Conexión configurada · educame-vps').waitFor();
    await page.getByText('Versión seleccionada para publicar · 1111111').waitFor();
    await page.getByRole('button', { name: 'Generar comando' }).click();
    const command = page.getByRole('dialog', { name: 'Comando para Hostinger' });
    await command.waitFor();
    await command.getByRole('button', { name: 'Cerrar' }).click();
    await page.getByRole('button', { name: 'Preparar despliegue' }).click();
    const confirm = page.getByRole('dialog', { name: 'Desplegar en Hostinger' });
    await confirm.getByRole('textbox').fill('incorrecto');
    await confirm.getByRole('button', { name: 'Desplegar', exact: true }).click();
    await confirm.getByText('Código incorrecto.').waitFor();
    assert.equal(deploymentCount, 0);
    await confirm.getByRole('textbox').fill('1111111');
    await confirm.getByRole('button', { name: 'Desplegar', exact: true }).click();
    await page.getByText('[5/5] Comprobado', { exact: true }).waitFor();
    assert.equal(deploymentCount, 1);

    await page.getByRole('button', { name: 'Cuentas y apps' }).click();
    await page.getByLabel('Correo del administrador').fill('admin@example.invalid');
    await page.getByLabel('Contraseña', { exact: true }).fill('fixture-password');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('button', { name: 'Docente de ensayo' }).click();
    await page.getByRole('heading', { name: 'Licencias' }).waitFor();
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await page.getByRole('dialog', { name: 'Pausar Inglés' }).getByRole('button', { name: 'Pausar', exact: true }).click();
    await page.getByRole('button', { name: 'Reactivar', exact: true }).waitFor();
    assert.equal(paused, true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await page.getByLabel('Correo del administrador').waitFor();
    assert.equal(await page.getByText('Docente de ensayo').count(), 0);

    await page.getByRole('link', { name: 'Codex · 78 % disponible' }).click();
    await page.getByText('Uso disponible de Codex', { exact: true }).waitFor();
    await page.getByText('Total informado por Codex').waitFor();
    assert.equal(await page.getByText('Encargos de Educame', { exact: true }).count(), 0);
    assert.doesNotMatch(await page.locator('#codex-usage').innerText(), /Tokens registrados|entregas/i);
    assert.deepEqual(errors, []);
  });

  test(`Cambios y vistas locales en ${name}`, { timeout: 45_000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-changes-browser-'));
    const server = await listen(t, directory, { codex: { status: async () => ({ ready: false }) } });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    server.browserForTest = browser;
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(8000);
    const base = 'http://127.0.0.1:' + server.address().port;
    const revision = '1'.repeat(40);
    const command = `cd /opt/educa-suite && git merge --ff-only ${revision} && bash infra/deploy-hostinger.sh`;
    await page.route('**/api/cambios?*', route => {
      const app = new URL(route.request().url()).searchParams.get('app');
      return route.fulfill({ json: {
        products: [{ key: 'profesor', name: 'Profesor Particular', app: true, landing: true },
          { key: 'ingles', name: 'Inglés', app: true, landing: true }],
        head: revision, upstream: revision, branch: 'main', local: { total: 1, count: 1, files: [{ file: 'apps/cambridge/index.html', status: ' M' }] },
        commits: [{ sha: revision, date: '2026-11-10T12:00:00Z', subject: app === 'ingles' ? 'Misión inglesa' : 'Revisión general',
          scopes: ['ingles'], files: ['apps/cambridge/index.html'], fileCount: 1, online: true }], more: false,
      } });
    });
    await page.route('**/api/cambios/hostinger', route => {
      assert.deepEqual(route.request().postDataJSON(), { revision });
      return route.fulfill({ json: { revision, command } });
    });
    await page.goto(base + '/#cambios');
    await page.getByRole('heading', { name: 'Revisión general' }).waitFor();
    await page.locator('#changes-app').selectOption('ingles');
    await page.getByRole('heading', { name: 'Misión inglesa' }).waitFor();
    assert.equal(await page.locator('#changes-preview').inputValue(), 'ingles');
    await page.waitForFunction(() => document.querySelector('#changes-preview-logo img')?.naturalWidth > 0);
    assert.equal(await page.getByRole('link', { name: 'Abrir app local' }).count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByRole('button', { name: 'Generar comando' }).click();
    await page.getByRole('dialog', { name: 'Comando para Hostinger' }).waitFor();
    assert.equal(await page.locator('#changes-command-code').inputValue(), command);
    await page.getByRole('button', { name: 'Copiar comando' }).click();
    await page.getByText(/Comando copiado|Comando seleccionado/).waitFor();
    await page.getByRole('button', { name: 'Cerrar comando' }).click();
    const preview = await browser.newPage({ viewport });
    await preview.goto(base + '/vista-local/ingles/app');
    await preview.locator('[data-tab-btn="juegos"]').click();
    await preview.locator('#tab-juegos').waitFor();
    assert.notEqual(new URL(preview.url()).origin, base);
    const audio = await preview.request.get(new URL('/assets/listening/b2-museum.wav', preview.url()).href, { headers: { Range: 'bytes=0-15' } });
    assert.equal(audio.status(), 206);
    assert.equal((await audio.body()).length, 16);
    await preview.close();

    const routes = {
      profesor: ['#main', 'Mis alumnos'],
      eso: ['#navGames', 'Juegos'],
      diplomator: ['body', 'Diplomator'],
      universidad: ['body', 'Universidad'],
      facturas: ['#currentUserBox', 'ensayo@example.invalid'],
      dashboard: ['#adminPage', 'Disponibilidad de las apps'],
    };
    for (const [key, [selector, expected]] of Object.entries(routes)) {
      const current = await browser.newPage({ viewport });
      const errors = [];
      current.on('pageerror', error => errors.push(error.message));
      const response = await current.goto(base + '/vista-local/' + key + '/app');
      assert.equal(response.status(), 200);
      await current.locator(selector).getByText(expected, { exact: false }).first().waitFor({ timeout: 5000 })
        .catch(async () => assert.match(await current.locator(selector).innerText(), new RegExp(expected, 'i'), key));
      assert.deepEqual(errors, [], key);
      await current.close();
    }
    const response = await page.request.get(base + '/vista-local/hazlotu/landing');
    assert.equal(response.status(), 200);
    assert.match(await response.text(), /HazloTú/i);
    if (process.env.EDUCAME_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.EDUCAME_SCREENSHOT_DIR, `cambios-${name.split(' ')[0]}.png`) });
  });

  test(`Centro de mando en ${name}`, { timeout: 50_000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-browser-'));
    const reference = 'https://www.youtube.com/watch?v=educame-test';
    const codex = {
      status: async () => ({ ready: true, message: 'Sesión de ensayo' }),
      async generate(task) {
        if (task.agente === 'copiador') {
          assert.deepEqual(task.fuentes, [reference]);
          assert.match(task.productContext.profile.priorities, /Temario/);
          return { draft: { resumen: 'Análisis de referencia', entrega: 'Informe ficticio.', comprobaciones: [], pendientes: [] },
            research: { searched: true, fuentes: [{ url: reference, title: 'Referencia de ensayo', estado: 'consultada', observacion: 'Rutas cortas.' }],
              ideas: [{ titulo: 'Ruta con decisiones', propuesta: 'Diseñar una actividad original.', beneficio: 'Práctica breve.',
                prueba: 'Completar dos caminos.', esfuerzo: 'medio', agente: 'juegos', fuentes: [reference] }] } };
        }
        return { draft: { resumen: 'Entrega de Codex', entrega: task.encargo, comprobaciones: [], pendientes: [],
          aprendizaje: { tema: 'estetica', criterio: 'Los vagones muestran el destino de cada respuesta.', comprobacion: 'Jugar una ronda en móvil.' } } };
      },
    };
    const server = await listen(t, directory, { codex });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    server.browserForTest = browser;
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(8000);
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    const base = 'http://127.0.0.1:' + server.address().port;
    const reportRow = { clicks: 12, impressions: 120, ctr: .1, position: 8, keys: ['2026-11-05'] };
    const channels = [{ id: 'channel', service: 'youtube', name: 'Educame de ensayo', canPublish: true, insights: true }];
    const posts = [];
    const stats = [];
    await page.route('**/api/conexiones', route => route.fulfill({ json: { buffer: true, google: true, openai: false, runway: true, redirect: base + '/api/conexiones/google/volver' } }));
    await page.route('**/api/conexiones/canales', route => route.fulfill({ json: channels }));
    await page.route('**/api/apps/estado', route => route.fulfill({ json: { paused: ['UNIVERSIDAD_ADULTOS'] } }));
    await page.route('**/api/conexiones/propiedades', route => route.fulfill({ json: ['sc-domain:educame.tech'] }));
    await page.route('**/api/estadisticas/busqueda', route => {
      stats.push(route.request().postDataJSON());
      return route.fulfill({ json: { total: reportRow, trend: [reportRow], searches: [{ ...reportRow, keys: ['juegos de fracciones'] }],
        pages: [{ ...reportRow, keys: ['https://educame.tech/profesor/juegos-interactivos'] }], startDate: '2026-11-01', endDate: '2026-11-07' } });
    });
    await page.route('**/api/publicaciones', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: posts });
      const { id, app, text } = route.request().postDataJSON();
      const result = { id, app, text, date: '2026-11-10T12:00:00Z', results: [{ ...channels[0], status: 'recibida', providerStatus: 'scheduled' }] };
      posts.push(result);
      return route.fulfill({ json: result });
    });
    const clips = [];
    await page.route('**/api/videos', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: clips });
      const { id, prompt } = route.request().postDataJSON();
      const clip = { id, prompt, status: 'SUCCEEDED', date: '2026-11-10T12:00:00Z' };
      clips.push(clip);
      return route.fulfill({ json: clip });
    });
    await page.goto(base);
    await page.getByRole('heading', { name: '¿Qué quieres hacer hoy?' }).waitFor();
    if (process.env.EDUCAME_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.EDUCAME_SCREENSHOT_DIR, `centro-${name.split(' ')[0]}.png`) });
    const navigate = async label => {
      const menu = page.getByRole('button', { name: 'Menú', exact: true });
      if (await menu.isVisible() && await menu.getAttribute('aria-expanded') === 'false') await menu.click();
      await page.getByRole('navigation').getByRole('link', { name: label, exact: true }).click();
    };
    await page.getByRole('link', { name: 'Aprender' }).click();
    await page.getByRole('heading', { name: 'Teoría', exact: true }).waitFor();
    const localLesson = page.locator('summary').filter({ hasText: 'Dónde vive LA TERRAZA' });
    assert.equal(await localLesson.locator('..').getAttribute('open'), null);
    await localLesson.press('Enter');
    await localLesson.locator('..').getByRole('button', { name: 'Marcar como aprendida' }).click();
    await page.getByText(/^1 de \d+ lecciones aprendidas$/).waitFor();
    await page.reload();
    await page.getByText(/^1 de \d+ lecciones aprendidas$/).waitFor();
    await page.getByRole('button', { name: 'Tus aplicaciones', exact: true }).click();
    assert.equal(await page.locator('.theory-lesson:visible img').count(), 7);
    const search = page.getByRole('searchbox', { name: 'Buscar en Teoría' });
    await search.fill('indexacion');
    await page.locator('summary').getByText('SEO, indexación y Search Console').waitFor();
    assert.equal(await page.locator('.theory-lesson:visible').count(), 1);
    await search.fill('sin resultado xyz');
    await page.getByText('Prueba con otra palabra o elige una categoría.').waitFor();
    await page.getByRole('button', { name: 'Mapa de Educame', exact: true }).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (process.env.EDUCAME_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.EDUCAME_SCREENSHOT_DIR, `teoria-${name.split(' ')[0]}.png`) });
    await page.getByRole('link', { name: 'Ruta de desarrollo' }).click();
    await page.getByRole('heading', { name: 'Etapas de la ruta' }).waitFor();
    assert.equal(await page.locator('#theory-categories .theory-step').count(), 6);
    const tools = page.locator('summary').filter({ hasText: 'Editor, terminal y navegador' });
    await tools.click();
    await tools.locator('..').getByText('Get-Location', { exact: false }).waitFor();
    await tools.locator('..').getByRole('button', { name: 'Marcar como aprendida' }).click();
    await page.getByText(/^1 de \d+ lecciones aprendidas$/).waitFor();
    await page.reload();
    await page.getByText(/^1 de \d+ lecciones aprendidas$/).waitFor();
    await page.getByRole('button', { name: 'Arquitectura de Educame', exact: true }).click();
    await page.getByText('Cómo viaja un guardado en la web pública').waitFor();
    assert.equal(await page.locator('.theory-flow li:visible').count(), 4);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (process.env.EDUCAME_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.EDUCAME_SCREENSHOT_DIR, `ruta-desarrollo-${name.split(' ')[0]}.png`) });
    await search.fill('idempotencia');
    await page.locator('summary').getByText('Caché, reintentos e idempotencia').waitFor();
    await page.getByRole('link', { name: 'Guía de Educame' }).click();
    await page.getByText('1 de 29 lecciones aprendidas').waitFor();
    await navigate('Encargos');
    await page.getByRole('heading', { name: 'Encargos', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Subir', exact: true }).count(), 0);
    await navigate('Publicar');
    const post = page.locator('#publish-form');
    await post.getByLabel('Texto', { exact: true }).fill('Anuncio de ensayo');
    await post.getByLabel('Formato').selectOption('video');
    await post.getByLabel('URL pública del archivo').fill('https://media.example.org/video.mp4');
    await post.getByRole('checkbox', { name: /Educame de ensayo/ }).check();
    await page.locator('#preview-destinations .network-youtube').waitFor();
    await post.getByLabel('Título', { exact: true }).fill('Juego educativo');
    await post.getByLabel('¿El vídeo de YouTube está dirigido a niños?').selectOption('no');
    await page.reload();
    await post.getByRole('button', { name: 'Revisar envío' }).click();
    assert.equal(posts.length, 0);
    await page.getByRole('button', { name: 'Confirmar envío' }).click();
    await page.locator('#publication-history').getByText('En cola', { exact: true }).waitFor();
    assert.equal(posts.length, 1);
    await navigate('Estadísticas');
    await page.locator('#stats-app').selectOption('profesor');
    await page.getByRole('button', { name: 'Consultar', exact: true }).click();
    await page.getByText('juegos de fracciones', { exact: true }).waitFor();
    assert.match(stats[0].pagePattern, /educame\\\.tech.*profesor/);
    await navigate('Conexiones');
    await page.locator('#connected-channels .network-youtube').waitFor();
    assert.equal(await page.locator('[data-network-icon] svg use').count(), 4);
    const sprite = await page.request.get(base + '/icons.svg');
    assert.match(sprite.headers()['content-type'], /image\/svg\+xml/);
    assert.equal(sprite.status(), 200);
    if (process.env.EDUCAME_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.EDUCAME_SCREENSHOT_DIR, `conexiones-${name.split(' ')[0]}.png`) });
    await page.getByRole('button', { name: 'Estadísticas', exact: true }).click();
    await page.getByText('Autorizado', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Generadores de vídeo' }).click();
    await page.getByRole('heading', { name: 'Runway' }).waitFor();
    await page.getByRole('link', { name: 'Crear vídeo', exact: true }).click();
    await page.getByLabel('Describe el clip').fill('Un tren de juguete');
    await page.getByRole('button', { name: 'Generar vídeo', exact: true }).click();
    await page.getByRole('link', { name: 'Descargar MP4' }).waitFor();
    assert.equal(clips.length, 1);
    await navigate('Apps');
    await page.locator('[data-catalog-app="gadeos"]').getByRole('heading', { name: 'GADEOS', exact: true }).waitFor();
    assert.equal(await page.locator('[data-catalog-app]').count(), 8);
    await page.getByRole('link', { name: 'Abrir dashboard online ↗' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Crear aplicación', exact: true }).isEnabled(), true);
    await page.getByRole('button', { name: 'Crear aplicación', exact: true }).click();
    await page.locator('#apps-admin-connect').getByLabel('Usuario o correo de administración').waitFor();
    await page.locator('#apps-admin-connect').getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Conectar administración', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(failures, []);
  });
}
