const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, relative, resolve } = require('node:path');
const { chromium, webkit } = require('./browser-runtime.cjs');

for (const [name, engine, viewport] of [['Chromium', chromium, { width: 1440, height: 950 }], ['WebKit móvil', webkit, { width: 390, height: 844 }]]) {
  test(`Hostinger distingue GitHub, servidor antiguo, comprobaciones pendientes y respuestas tardías en ${name}`, { timeout: 45000 }, async t => {
    const { createDashboard } = await import('../scripts/educame-dashboard.mjs');
    const directory = await mkdtemp(join(tmpdir(), 'educame-release-browser-'));
    const server = await createDashboard({ directory, apiKey: '', codex: { status: async () => ({ ready: false }) } });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const browser = await engine.launch(name === 'Chromium' ? { channel: 'msedge' } : {});
    t.after(async () => { await browser.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); assert.match(relative(resolve(tmpdir()), resolve(directory)), /^educame-release-browser-[\w-]+$/); await rm(directory, { recursive: true, force: true, maxRetries: 5 }); });
    const page = await browser.newPage({ viewport }); page.setDefaultTimeout(8000);
    const a = 'a'.repeat(40), b = 'b'.repeat(40); let head = a, running = a, verified = a, fail = false, hold = false, arrived;
    let release; const gate = new Promise(resolve => { release = resolve; }); t.after(() => release());
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/panel', async route => { const response = await route.fetch(), state = await response.json(); state.currentRevision = head; await route.fulfill({ json: state }); });
    await page.route('**/api/cambios?*', route => route.fulfill({ json: { products: [], local: { count: 0, total: 0, files: [] }, commits: [], branch: 'main', head, upstream: head, syncedAt: null, ahead: 0, behind: 0, more: false, repository: '' } }));
    await page.route('**/api/despliegue/estado*', async route => {
      if (fail) return route.fulfill({ status: 503, json: { error: 'Error de ensayo' } });
      const state = head === running && verified === running ? 'synced' : head !== running ? 'pending' : 'unknown';
      const payload = { state, local: { revision: head, dirty: false }, github: { revision: head, verified: true }, hostinger: { revision: running, verifiedRevision: verified, verifiedAt: verified ? '2026-11-18T12:00:00Z' : null }, checkedAt: '2026-11-18T12:30:00Z',
        message: state === 'synced' ? 'Sincronizado: las tres revisiones coinciden.' : state === 'pending' ? 'Pendiente de actualizar Hostinger.' : 'La imagen coincide, pero el despliegue no está verificado.' };
      if (hold) { hold = false; arrived(); await gate; }
      await route.fulfill({ json: payload });
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/#cambios');
    const chip = page.locator('#deployment-chip'), check = page.getByRole('button', { name: 'Comprobar Hostinger', exact: true });
    await page.waitForFunction(() => document.querySelector('#deployment-chip').dataset.state === 'synced');
    assert.match(await chip.innerText(), /sincronizado/);
    hold = true; const waiting = new Promise(resolve => { arrived = resolve; }); await check.click(); await waiting;
    head = b;
    await page.waitForFunction(value => document.querySelector('#deployment-chip').dataset.localRevision === value, b);
    release(); await page.waitForFunction(() => !document.querySelector('[data-check-deployment]').disabled);
    assert.doesNotMatch(await chip.innerText(), /sincronizado/);
    await check.click(); await page.waitForFunction(() => document.querySelector('#deployment-chip').dataset.state === 'pending');
    assert.match(await page.locator('[data-deployment-versions]').first().innerText(), /GitHub bbbbbbbb · Hostinger aaaaaaaa/);
    running = b; verified = null; await check.click(); await page.waitForFunction(() => document.querySelector('#deployment-chip').dataset.state === 'unknown');
    verified = b; await check.click(); await page.waitForFunction(() => document.querySelector('#deployment-chip').dataset.state === 'synced');
    fail = true; await check.click(); await page.waitForFunction(() => document.querySelector('#deployment-chip').dataset.state === 'unknown');
    assert.doesNotMatch(await chip.innerText(), /sincronizado/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); assert.deepEqual(errors, []);
  });
}
