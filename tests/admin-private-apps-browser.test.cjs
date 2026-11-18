const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve, join, relative } = require('node:path');
const { chromium, webkit } = require('./browser-runtime.cjs');

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'gadeos-admin-browser-'));
  const child = spawn(process.env.PYTHON || 'python', ['tests/private-apps-browser-server.py'], { cwd: resolve(__dirname, '..'), windowsHide: true,
    env: { ...process.env, ENVIRONMENT: 'test', DATABASE_URL: 'sqlite:///' + join(directory, 'test.sqlite').replaceAll('\\', '/'), EDUCAME_PRIVATE_IMAGE_DIR: join(directory, 'images'), JWT_SECRET: 'private-admin-browser-test-signing-key-32-bytes', COOKIE_SECURE: 'false', PYTHONPATH: 'backend', PYTHONUNBUFFERED: '1' } });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit', { signal: AbortSignal.timeout(5000) }).catch(() => {}); }
    assert.match(relative(resolve(tmpdir()), resolve(directory)), /^gadeos-admin-browser-[\w-]+$/); await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
  let output = '', errors = '';
  child.stderr.on('data', data => { errors += data; });
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('No arrancó el backend de ensayo: ' + errors)), 15000);
    child.once('error', reject); child.once('exit', () => reject(Error('Backend detenido: ' + errors)));
    child.stdout.on('data', data => { output += data; const line = output.split(/\r?\n/).find(line => line.startsWith('{"url"')); if (line) { clearTimeout(timer); resolve(JSON.parse(line).url); } });
  });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base + '/health')).ok) return base; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  assert.fail('El backend de ensayo no responde.');
}
for (const [name, engine, viewport] of [['Chromium', chromium, { width: 1440, height: 1000 }], ['WebKit móvil', webkit, { width: 390, height: 844 }]]) {
  test(`Dashboard administra GADEOS y nuevas apps, conserva progreso y rechaza ediciones antiguas en ${name}`, { timeout: 90000 }, async t => {
    const base = await fixture(t), browser = await engine.launch(name === 'Chromium' ? { channel: 'msedge' } : {}); t.after(() => browser.close());
    const page = await browser.newPage({ viewport }); page.setDefaultTimeout(12000); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/admin-dashboard/#app/gadeos'); await page.getByLabel('Admin', { exact: true }).fill('organizador@example.invalid'); await page.getByLabel('Clave', { exact: true }).fill('ensayo-temporal-123'); await page.getByRole('button', { name: 'Entrar al dashboard' }).click();
    const screen = page.locator('#view-managed'); await screen.getByRole('heading', { name: 'GADEOS', exact: true }).waitFor();
    assert.equal(await screen.getByLabel('Correo electrónico', { exact: true }).count(), 0);
    await screen.getByRole('button', { name: '+ Nuevo usuario', exact: true }).click(); await screen.getByLabel('Nombre de tributo').fill('Alma'); await screen.getByLabel('Contraseña inicial', { exact: true }).fill('ensayo-seguro-123'); await screen.getByRole('button', { name: 'Crear usuario', exact: true }).click();
    await screen.locator('.managed-user-card').getByText('Alma', { exact: true }).waitFor();
    const token = await page.evaluate(() => localStorage.getItem('educa_admin_token')), headers = { Authorization: 'Bearer ' + token };
    const rows = await (await page.request.get(base + '/admin/apps/gadeos/accounts', { headers })).json(); assert.equal(rows.accounts.length, 1); const accountId = rows.accounts[0].id;
    const tribute = await browser.newContext(); t.after(() => tribute.close());
    assert.equal((await tribute.request.post(base + '/api/private-apps/gadeos/login', { data: { name: 'Alma', password: 'ensayo-seguro-123' } })).status(), 200);
    assert.equal((await tribute.request.post(base + '/api/private-apps/gadeos/stations/answer', { data: { station: 1, answer: 'ALIANZA', revision: 0, campaign_revision: 0, request_id: crypto.randomUUID() } })).status(), 200);
    await screen.getByRole('button', { name: 'Actualizar', exact: true }).click(); await screen.getByText('1 / 8 etapas completadas', { exact: true }).waitFor();
    await screen.getByRole('button', { name: 'Editar usuario', exact: true }).click(); await screen.getByLabel('Nueva contraseña (opcional)').fill('ensayo-renovado-123'); await screen.getByLabel('Cuenta activa', { exact: true }).uncheck(); await screen.getByRole('button', { name: 'Guardar usuario', exact: true }).click(); await screen.getByText('Acceso desactivado', { exact: true }).waitFor();
    assert.equal((await tribute.request.get(base + '/api/private-apps/gadeos/state')).status(), 401);
    await screen.getByRole('button', { name: 'Editar usuario', exact: true }).click(); await screen.getByLabel('Nombre de tributo').fill('Alma nueva'); await screen.getByLabel('Cuenta activa', { exact: true }).check(); await screen.getByRole('button', { name: 'Guardar usuario', exact: true }).click(); await screen.getByText('Alma nueva', { exact: true }).waitFor();
    assert.equal((await tribute.request.post(base + '/api/private-apps/gadeos/login', { data: { name: 'Alma nueva', password: 'ensayo-renovado-123' } })).status(), 200);
    assert.equal((await (await tribute.request.get(base + '/api/private-apps/gadeos/state')).json()).completed, 1);
    await screen.getByRole('button', { name: 'Editar usuario', exact: true }).click();
    const snapshot = (await (await page.request.get(base + '/admin/apps/gadeos/accounts', { headers })).json()).accounts[0];
    assert.equal((await page.request.patch(base + '/admin/apps/gadeos/accounts/' + accountId, { headers, data: { revision: snapshot.revision, name: 'Desde otra pestaña' } })).status(), 200);
    await screen.getByLabel('Nombre de tributo').fill('No debe ganar'); await screen.getByRole('button', { name: 'Guardar usuario', exact: true }).click(); await screen.getByRole('status').getByText(/La cuenta ha cambiado/).waitFor();
    assert.equal((await (await page.request.get(base + '/admin/apps/gadeos/accounts', { headers })).json()).accounts[0].name, 'Desde otra pestaña');
    await page.reload(); await screen.getByText('Desde otra pestaña', { exact: true }).waitFor(); assert.match(page.url(), /#app\/gadeos$/);
    await screen.getByRole('button', { name: 'Pausada', exact: true }).click(); await page.waitForFunction(() => document.querySelector('#managedAvailability button[aria-pressed=true]')?.textContent === 'Pausada'); assert.equal((await tribute.request.get(base + '/api/private-apps/gadeos/state')).status(), 503);
    await screen.getByRole('button', { name: 'Privada', exact: true }).click(); await page.waitForFunction(() => document.querySelector('#managedAvailability button[aria-pressed=true]')?.textContent === 'Privada'); assert.equal((await (await tribute.request.get(base + '/api/private-apps/gadeos/state')).json()).completed, 1);
    const registry = await (await page.request.get(base + '/admin/apps', { headers })).json();
    assert.equal((await page.request.post(base + '/admin/apps', { headers, data: { id: 'diario-prueba', name: 'Diario de ensayo', state: 'privada', revision: registry.revision } })).status(), 201);
    await page.reload(); await page.locator('#managedAppsNav').getByRole('button', { name: 'Diario de ensayo', exact: false }).click(); await screen.getByRole('heading', { name: 'Diario de ensayo', exact: true }).waitFor();
    await screen.getByRole('button', { name: '+ Nuevo usuario', exact: true }).click(); await screen.getByLabel('Nombre de usuario').fill('Alma nueva'); await screen.getByLabel('Contraseña inicial', { exact: true }).fill('otro-ensayo-123'); await screen.getByRole('button', { name: 'Crear usuario', exact: true }).click(); await screen.getByText('Alma nueva', { exact: true }).waitFor();
    assert.equal((await (await page.request.get(base + '/admin/apps/gadeos/accounts', { headers })).json()).accounts.length, 1);
    assert.equal((await (await page.request.get(base + '/admin/apps/diario-prueba/accounts', { headers })).json()).accounts.length, 1);
    await page.locator('#tabs [data-view="overview"]').click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('switch', { name: 'Disponibilidad de Titulo de ingles', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[onclick="toggleAppAvailability(\'CAMBRIDGE\')"]')?.getAttribute('aria-checked') === 'false');
    await page.locator('#tabs [data-view="cambridge"]').click();
    await page.waitForFunction(() => document.querySelector('#appAvailabilityControl button[aria-pressed=true]')?.textContent === 'Pausada');
    await page.locator('#appAvailabilityControl').getByRole('button', { name: 'Pública', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#appAvailabilityControl button[aria-pressed=true]')?.textContent === 'Pública');
    assert.equal((await (await page.request.get(base + '/admin/app-availability', { headers })).json()).CAMBRIDGE.paused, false);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); assert.deepEqual(errors, []);
    if (process.env.EDUCAME_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.EDUCAME_SCREENSHOT_DIR, 'admin-private-' + name.split(' ')[0] + '.png'), fullPage: true });
  });
}
