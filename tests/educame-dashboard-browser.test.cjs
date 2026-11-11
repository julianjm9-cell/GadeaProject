const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtemp, rm } = require('node:fs/promises');
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
    await new Promise(resolve => server.close(resolve));
    assert.match(relative(resolve(tmpdir()), resolve(directory)), /^educame-(?:changes-)?browser-[\w-]+$/);
    await rm(directory, { recursive: true, force: true });
  });
  return server;
}

for (const [name, engine, viewport] of [
  ['Chromium escritorio', chromium, { width: 1440, height: 950 }],
  ['WebKit móvil', webkit, { width: 390, height: 844 }],
]) {
  test(`Chat con Codex selecciona modelo y revisa cambios en ${name}`, { timeout: 25_000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-changes-browser-'));
    const server = await listen(t, directory, { codex: {
      status: async () => ({ ready: true }),
      models: async () => [{ id: 'modelo-a', label: 'Modelo A', recommended: true }, { id: 'modelo-b', label: 'Modelo B' }],
      ask: async ({ model }) => ({ answer: 'Respuesta de ' + model, tokens: 24 }),
    } });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport });
    const base = 'http://127.0.0.1:' + server.address().port;
    let proposal;
    let applied = false;
    const commit = 'a'.repeat(40);
    await page.route('**/api/chat**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/api/chat' && request.method() === 'POST' && request.postDataJSON().mode === 'change') {
        proposal = { ...request.postDataJSON(), state: 'proposal', reply: 'Cambio preparado.',
          proposal: { commit, files: ['scripts/educame-dashboard/theme.css'], checks: [{ command: 'node --test', passed: true }] } };
        return route.fulfill({ json: { messages: [proposal], needsRestart: false } });
      }
      if (path === '/api/chat/propuesta') return route.fulfill({ json: { patch: '+ body { color: olive; }' } });
      if (path === '/api/chat/aplicar') {
        assert.deepEqual(request.postDataJSON(), { id: proposal.id, commit });
        applied = true;
        return route.fulfill({ json: { messages: [{ ...proposal, state: 'applied' }], needsRestart: true } });
      }
      return route.continue();
    });
    await page.goto(base + '/#chat');
    const model = page.getByLabel('Modelo de Codex');
    await model.selectOption('modelo-b');
    await page.getByLabel('Tu mensaje').fill('¿Qué es Git?');
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await page.getByText('Respuesta de modelo-b', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('Respuesta de modelo-b', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('#chat-model').value === 'modelo-b');
    await page.getByLabel('¿Qué quieres hacer?').selectOption('change');
    await page.getByLabel('Tu mensaje').fill('Ajusta los colores del panel.');
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await page.getByRole('button', { name: 'Revisar propuesta' }).click();
    const dialog = page.getByRole('dialog', { name: 'Revisar propuesta' });
    await dialog.getByText('+ body { color: olive; }').waitFor();
    assert.equal(applied, false);
    await dialog.getByRole('button', { name: 'Aplicar en este equipo' }).click();
    await page.getByText('Aplicada en este equipo', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reiniciar LA TERRAZA' }).waitFor();
    assert.equal(applied, true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  });

  test(`LA TERRAZA envía encargos a Codex desde Inicio en ${name}`, { timeout: 35_000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-changes-browser-'));
    const received = [];
    const server = await listen(t, directory, { codex: {
      status: async () => ({ ready: true, message: 'Sesión local activa' }),
      generate: async task => {
        received.push(task);
        return { draft: { resumen: 'Plan de ensayo ' + 'con una descripción larga '.repeat(9),
          entrega: 'Prueba los botones desde el teclado.', comprobaciones: [], pendientes: [] } };
      },
    } });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = 'http://127.0.0.1:' + server.address().port;
    const sent = [];
    await page.route('**/api/encargos', async route => {
      const data = route.request().postDataJSON();
      sent.push(data);
      if (sent.length === 1) {
        await route.fetch();
        await route.abort();
      } else await route.continue();
    });
    await page.goto(base + '/#inicio');
    assert.match(await page.title(), /^LA TERRAZA/);
    await page.waitForFunction(() => document.querySelector('.terrace-photo').naturalWidth > 0);
    const order = page.locator('#terrace-order');
    await order.getByLabel('¿En qué app?').selectOption('profesor');
    await order.getByLabel('¿Qué quieres recibir?').selectOption('implementacion');
    await order.getByText(/copia aislada/).waitFor();
    await order.getByLabel('¿Qué quieres recibir?').selectOption('real');
    await order.getByLabel('¿Qué quieres que haga Codex?').fill('Comprueba la navegación con teclado.');
    await page.reload();
    assert.equal(await order.getByLabel('¿Qué quieres que haga Codex?').inputValue(), 'Comprueba la navegación con teclado.');
    await order.getByRole('button', { name: 'Pedir a Codex' }).click();
    await order.getByRole('alert').waitFor();
    await order.getByRole('button', { name: 'Pedir a Codex' }).click();
    await page.locator('#team-activity').getByText('Borrador').waitFor();
    assert.equal(received.length, 1);
    assert.equal(received[0].agente, 'codex');
    assert.equal(received[0].app, 'profesor');
    assert.equal(sent[0].engine, 'codex');
    assert.deepEqual(sent[0].tasks, sent[1].tasks);
    await page.locator('#team-activity').getByRole('link', { name: /Abrir entregas/ }).click();
    await page.locator('#history article').filter({ hasText: 'Plan de ensayo' }).getByRole('button', { name: 'Abrir entrega' }).click();
    await page.getByRole('button', { name: 'Preparar seguimiento' }).click();
    const composer = page.locator('#agent-compose');
    assert.match(await composer.locator('[name=context]').inputValue(), /Prueba los botones/);
    assert.equal(await composer.locator('[name=app]').inputValue(), 'profesor');
    await page.goto(base + '/#conexiones');
    const nav = page.getByRole('button', { name: 'Menú', exact: true });
    if (await nav.isVisible()) {
      await nav.click();
      assert.equal(await nav.getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await nav.getAttribute('aria-expanded'), 'false');
    }
    await page.getByRole('button', { name: 'Agentes e IA' }).click();
    await page.getByText('Cómo iniciar sesión en Codex', { exact: true }).click();
    await page.getByText('codex login', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.setViewportSize({ width: 320, height: 790 });
    for (const section of ['inicio', 'estadisticas']) {
      await page.goto(base + '/#' + section);
      await page.locator('[data-page="' + section + '"] h1').waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), section);
    }
    assert.deepEqual(errors, []);
  });

  test(`Crear, configurar y encargar agentes en ${name}`, { timeout: 35_000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-changes-browser-'));
    const server = await listen(t, directory, { codex: { status: async () => ({ ready: true }) } });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport });
    const base = 'http://127.0.0.1:' + server.address().port;
    await page.goto(base + '/#agentes');
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
    await page.getByRole('button', { name: /Accesibilidad Revisa las interacciones/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Accesibilidad Revisa las interacciones/ }).getAttribute('aria-pressed'), 'true');
    await page.getByLabel('¿Qué necesitas?').fill('Revisa la navegación con el teclado.');
    await page.getByRole('button', { name: 'Añadir a la cola', exact: true }).click();
    await page.locator('#task-list').getByText('Revisa la navegación con el teclado.').waitFor();
    await page.locator('#task-list').getByRole('button', { name: 'Editar', exact: true }).click();
    assert.equal(await page.locator('#task-form select[name=agente] option:checked').textContent(), 'Accesibilidad');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.reload();
    await page.locator('#task-list').getByText(/Accesibilidad/).waitFor();
  });

  test(`Operación y uso de Codex en ${name}`, { timeout: 35_000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-changes-browser-'));
    const server = await listen(t, directory, { codex: {
      status: async () => ({ ready: true, message: 'Sesión local activa' }),
      usage: async () => ({ windows: [{ usedPercent: 22, durationMinutes: 300, resetsAt: 1900000000 },
        { usedPercent: 40, durationMinutes: 10080, resetsAt: 1900500000 }],
        limitsFresh: true, accountTokens: 1234, tokensFresh: true }),
    } });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport });
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
    const account = { id: 'fixture', full_name: 'Docente de ensayo', email: 'docente@example.invalid', role: 'user',
      is_active: true, organization_name: 'Ensayo', accesses: [] };
    await page.route('**/api/operacion/**', route => {
      const path = new URL(route.request().url()).pathname.replace('/api/operacion/', '');
      let json;
      if (path === 'github') json = { connected: true, repository: 'educame/test', branches: [] };
      if (path === 'github/lista') json = [pull];
      if (path === 'github/detalle') json = pull;
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
      if (path === 'admin/login') { signed = true; json = { connected: true }; }
      if (path === 'admin/logout') { signed = false; json = { connected: false }; }
      if (path === 'admin/pause') { paused = route.request().postDataJSON().paused; json = { paused }; }
      assert.ok(json, path);
      return route.fulfill({ json });
    });
    await page.route('**/api/cambios/sincronizar', route => route.fulfill({ json: {} }));
    await page.route('**/api/cambios?*', route => route.fulfill({ json: { upstream: revision, commits: [] } }));
    await page.goto(base + '/#control');
    await page.getByRole('link', { name: 'Codex · 78 % disponible' }).waitFor();
    const quotaChip = page.locator('#codex-quota-chip');
    await quotaChip.hover();
    const quotaTitle = await quotaChip.getAttribute('title');
    assert.match(quotaTitle, /Límite de 5 h · 78 % disponible · Se renueva el/);
    assert.match(quotaTitle, /Límite semanal · 60 % disponible · Se renueva el/);
    await page.getByRole('button', { name: '#9 · Un cambio para revisar' }).click();
    await page.getByText('app.js', { exact: false }).click();
    await page.getByText('+nuevo', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Fusionar en main' }).click();
    await page.getByRole('dialog', { name: 'Fusionar en GitHub' }).waitFor();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await page.getByRole('button', { name: 'Hostinger', exact: true }).click();
    await page.getByText('Conexión configurada · educame-vps').waitFor();
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
    await page.getByRole('heading', { name: 'Uso de Codex' }).waitFor();
    await page.getByText('Total informado por Codex').waitFor();
    await page.getByText('Encargos de Educame').waitFor();
    assert.deepEqual(errors, []);
  });

  test(`Cambios y vistas locales en ${name}`, { timeout: 45_000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'educame-changes-browser-'));
    const server = await listen(t, directory, { codex: { status: async () => ({ ready: false }) } });
    const browser = await engine.launch(name.startsWith('Chromium') ? { channel: 'msedge' } : {});
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport });
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
    await page.getByText('1 archivo local sin commit', { exact: true }).click();
    assert.match(await page.locator('#changes-dirty').innerText(), /apps\/cambridge\/index.html/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByRole('button', { name: 'Generar comando' }).click();
    await page.getByRole('dialog', { name: 'Comando para Hostinger' }).waitFor();
    assert.equal(await page.locator('#changes-command-code').inputValue(), command);
    await page.getByRole('button', { name: 'Copiar comando' }).click();
    await page.getByText(/Comando copiado|Comando seleccionado/).waitFor();
    await page.getByRole('button', { name: 'Cerrar comando' }).click();
    const opened = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Abrir app local' }).click();
    const preview = await opened;
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
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport });
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
    await navigate('Agentes');
    await page.getByRole('button', { name: /Juegos Crea/ }).click();
    await page.locator('#agent-app').selectOption('profesor');
    await page.getByLabel('¿Qué necesitas?').fill('Prepara una misión sobre fracciones.');
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    await page.locator('#team-activity').getByText('Borrador').waitFor();
    assert.equal(await page.locator('.batch-chip').count(), 1);
    await page.getByRole('button', { name: 'Seleccionar equipo' }).click();
    assert.equal(await page.locator('.team-tile[aria-pressed="true"]').count(), 5);
    if (process.env.EDUCAME_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.EDUCAME_SCREENSHOT_DIR, `agentes-${name.split(' ')[0]}.png`) });
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.batch-chip .badge')].filter(node => node.textContent === 'Borrador').length === 5);
    const panel = await (await page.request.get(base + '/api/panel')).json();
    assert.equal(panel.history.length, 6);
    await page.getByRole('button', { name: 'Quitar selección' }).click();
    await page.getByRole('button', { name: /Juegos Crea/ }).click();
    await page.locator('#game-pack select').selectOption('Crear y mejorar');
    await page.getByLabel('Cantidad', { exact: true }).fill('3');
    assert.equal(await page.getByRole('button', { name: 'Implementar con Codex' }).isEnabled(), true);
    await page.getByRole('button', { name: 'Preparar borrador', exact: true }).click();
    await page.locator('#team-activity').getByRole('heading', { name: 'Encargo en Codex' }).waitFor();
    await page.locator('#team-activity').getByText('Borrador').waitFor();
    const draftPanel = await (await page.request.get(base + '/api/panel')).json();
    assert.match(draftPanel.history.find(item => item.mode === 'real').contexto, /Trabajo: Crear y mejorar\. Cantidad solicitada: 3/);
    await navigate('Inicio');
    await page.getByRole('button', { name: /Entrega de Codex/ }).click();
    await page.getByRole('dialog', { name: 'Entrega de Codex' }).waitFor();
    const delivery = page.getByRole('dialog', { name: 'Entrega de Codex' });
    await delivery.getByText('Contexto usado en este encargo').click();
    await delivery.getByText(/Respetar los modos Estudio, Academia y Sin fondo/).waitFor();
    await delivery.getByText('Conservar un aprendizaje en Memoria').click();
    await delivery.getByRole('button', { name: 'Usar propuesta del agente' }).click();
    await delivery.getByRole('button', { name: 'Aprobar borrador' }).click();
    await delivery.waitFor({ state: 'hidden' });
    await navigate('Memoria');
    await page.locator('#memory-app').selectOption('profesor');
    await page.getByText('Los vagones muestran el destino de cada respuesta.').click();
    await page.getByText(/Jugar una ronda en móvil/).waitFor();
    await page.getByRole('button', { name: 'Archivar' }).click();
    await page.getByText('Todavía no hay criterios para esta app.').waitFor();
    await page.getByLabel('Mostrar archivados').check();
    await page.getByText('Los vagones muestran el destino de cada respuesta.').click();
    await page.getByRole('button', { name: 'Reactivar' }).click();
    await page.getByText('Criterio reactivado.').waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (process.env.EDUCAME_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.EDUCAME_SCREENSHOT_DIR, `memoria-${name.split(' ')[0]}.png`) });
    const profile = page.locator('#memory-profile');
    await profile.getByText('Prioridades de producto', { exact: true }).click();
    await profile.getByText(/variantes infantil y adolescente/).waitFor();
    await navigate('Agentes');
    await page.getByRole('button', { name: /Copiador Analiza/ }).click();
    await page.locator('#agent-app').selectOption('ingles');
    await page.getByLabel('¿Qué necesitas?').fill('');
    await page.locator('#agent-sources textarea').fill(reference);
    await page.getByRole('button', { name: 'Analizar enlaces', exact: true }).click();
    await page.locator('#team-activity').getByRole('heading', { name: 'Análisis de enlaces' }).waitFor();
    await page.locator('#team-activity').getByText('Borrador').waitFor();
    await navigate('Inicio');
    await page.getByRole('button', { name: /Análisis de referencia/ }).click();
    const analysis = page.getByRole('dialog', { name: 'Análisis de referencia' });
    assert.equal(await analysis.getByRole('link', { name: 'Referencia de ensayo' }).first().getAttribute('href'), reference);
    await analysis.getByRole('button', { name: 'Preparar encargo para Juegos' }).click();
    await page.getByRole('button', { name: 'Implementar con Codex' }).waitFor();
    assert.match(await page.getByLabel('¿Qué necesitas?').inputValue(), /Ruta con decisiones/);
    assert.equal(await page.locator('#agent-app').inputValue(), 'ingles');
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
    await page.getByText('En cola', { exact: true }).waitFor();
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
    assert.equal(await page.locator('#directory-apps img').count(), 7);
    await page.waitForFunction(() => [...document.querySelectorAll('#directory-apps img')].every(img => img.complete && img.naturalWidth > 0));
    await page.getByRole('link', { name: 'Abrir dashboard online ↗' }).waitFor();
    await page.getByRole('link', { name: /Universidad \+25 En pausa/ }).waitFor();
    const opened = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Vista local de Profesor Particular' }).click();
    const preview = await opened;
    await preview.getByText('Mis alumnos', { exact: false }).first().waitFor();
    await preview.close();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(failures, []);
  });
}
