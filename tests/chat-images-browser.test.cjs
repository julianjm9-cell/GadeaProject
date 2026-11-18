const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm, readFile, mkdir, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, dirname } = require('node:path');
const { once } = require('node:events');
const { chromium, webkit } = require('./browser-runtime.cjs');
const images = require('./chat-image-fixtures.cjs');

for (const [name, engine, viewport] of [['Chromium', chromium, { width: 1440, height: 950 }], ['WebKit móvil', webkit, { width: 390, height: 844 }]]) {
  test(`los encargos adjuntan, pegan y arrastran referencias sin perder borradores ni duplicar en ${name}`, { timeout: 65000 }, async t => {
    const { createDashboard } = await import('../scripts/educame-dashboard.mjs');
    const directory = await mkdtemp(join(tmpdir(), 'educame-images-browser-'));
    const calls = []; let release, received; const gate = new Promise(resolve => { release = resolve; });
    const firstReceived = new Promise(resolve => { received = resolve; });
    const server = await createDashboard({ directory, apiKey: '', codex: {
      status: async () => ({ ready: true }), models: async () => [{ id: 'modelo', label: 'Modelo de ensayo' }],
      coordinate: async input => { calls.push(input); received(); if (calls.length === 1) await gate; return { plan: { action: 'answer', reply: 'Referencias recibidas: ' + input.attachments.length, tasks: [] } }; },
    } });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const browser = await engine.launch(name === 'Chromium' ? { channel: 'msedge' } : {});
    t.after(async () => { release(); await browser.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); assert.equal(dirname(directory), tmpdir()); await rm(directory, { recursive: true, force: true, maxRetries: 5 }); });
    const page = await browser.newPage({ viewport }); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const base = 'http://127.0.0.1:' + server.address().port;
    await page.goto(base + '/#chat');
    const input = page.locator('#chat-form textarea'), picker = page.locator('#chat-images-input');
    const count = value => page.waitForFunction(value => document.querySelectorAll('#chat-attachments img').length === value && !document.querySelector('#chat-form [type=submit]').disabled, value);
    const attach = (name, mimeType, buffer) => picker.setInputFiles({ name, mimeType, buffer });
    await input.fill('Analiza estas referencias para Inglés');
    await picker.setInputFiles([{ name: 'Roja.png', mimeType: 'image/png', buffer: images.red }, { name: 'Azul.png', mimeType: 'image/png', buffer: images.blue }]); await count(2);
    await page.reload(); await count(2); assert.equal(await input.inputValue(), 'Analiza estas referencias para Inglés');
    await page.getByRole('button', { name: 'Quitar Azul.png', exact: true }).click(); await count(1);
    const pasteOrDrop = (kind, name, type, bytes) => page.evaluate(({ kind, name, type, bytes }) => {
      const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(bytes)], name, { type }));
      const node = document.querySelector('#chat-form textarea');
      const event = new Event(kind, { bubbles: true, cancelable: true }); Object.defineProperty(event, kind === 'paste' ? 'clipboardData' : 'dataTransfer', { value: transfer }); node.dispatchEvent(event);
    }, { kind, name, type, bytes: [...bytes] });
    await pasteOrDrop('paste', 'Pegada.png', 'image/png', images.blue); await count(2);
    await pasteOrDrop('drop', 'Arrastrada.jpg', 'image/jpeg', images.jpeg); await count(3);
    await attach('No válida.svg', 'image/svg+xml', Buffer.from('<svg/>'));
    await page.locator('#chat-form .form-message').filter({ hasText: /PNG, JPG o WebP/ }).waitFor(); await count(3);
    await attach('Demasiado grande.png', 'image/png', Buffer.alloc(5_000_001)); await count(3);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('terrace-chat-scope', { detail: { app: 'ingles', name: 'Inglés', area: 'app' } })));
    await count(0); await input.fill('Borrador de la app'); await attach('Privada.webp', 'image/webp', images.webp); await count(1);
    await page.getByRole('button', { name: 'Ver todos los encargos', exact: true }).click(); await count(3);
    assert.equal(await input.inputValue(), 'Analiza estas referencias para Inglés');
    // A lost acknowledgement must retain the same image IDs and request ID on retry.
    let lost = false; const ids = [];
    await page.route('**/api/chat', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      ids.push(route.request().postDataJSON().id);
      if (!lost) { lost = true; await route.fetch(); return route.abort('failed'); }
      return route.continue();
    });
    const send = page.locator('#chat-form [type=submit]');
    await send.click(); await page.locator('#chat-form .form-message:not([hidden])').waitFor(); await count(3);
    await send.click(); await count(0); await firstReceived; assert.equal(ids[0], ids[1]); assert.equal(calls.length, 1);
    await page.locator('#chat-messages .order-images img').first().waitFor();
    await input.fill('Segunda consulta con otra imagen'); await attach('Privada.webp', 'image/webp', images.webp); await count(1);
    await send.click(); await count(0);
    release();
    await page.waitForFunction(() => [...document.querySelectorAll('#chat-messages .order-status')].filter(node => node.textContent === 'Completado').length === 2);
    assert.deepEqual(calls.map(call => call.attachments.length), [3, 1]);
    for (const call of calls) for (const id of call.attachments) assert.ok((await readFile(join(directory, 'chat-images', id + (call.attachments.length === 1 ? '.webp' : id === calls[0].attachments[2] ? '.jpg' : '.png')))).length);
    await page.reload(); await page.locator('#chat-messages .order-images img').first().waitFor();
    assert.equal(await page.locator('#chat-messages .order-images img').count(), 4);
    // Adjustments recover the actual receipt's references and save that draft immediately.
    await mkdir(join(directory, 'implementaciones'), { recursive: true });
    const delivery = { id: 'entrega-visual', status: 'borrador', app: 'ingles', agente: 'juegos', encargo: 'Entrega con referencias',
      finishedAt: new Date().toISOString(), attachments: calls[0].attachments, implementation: { base: 'a'.repeat(40) },
      draft: { resumen: 'Tablero de ensayo', entrega: 'Preparado para ajustes', comprobaciones: [], pendientes: [] } };
    await writeFile(join(directory, 'implementaciones/entrega-visual.json'), JSON.stringify(delivery));
    await page.route('**/api/panel', async route => {
      const response = await route.fetch(), data = await response.json();
      data.batches.push({ id: 'lote-visual', mode: 'implementacion', state: 'finished', tasks: [{ id: delivery.id, app: delivery.app, agente: delivery.agente, encargo: delivery.encargo }], jobs: { [delivery.id]: { status: 'borrador' } } });
      return route.fulfill({ json: data });
    });
    await page.reload(); await page.getByRole('button', { name: 'Pedir ajuste', exact: true }).click(); await count(3);
    await input.fill('Ajusta la escena usando estas referencias'); await page.reload(); await count(3);
    assert.equal(await input.inputValue(), 'Ajusta la escena usando estas referencias');
    await page.getByRole('button', { name: 'Quitar Roja.png', exact: true }).click(); await count(2);
    let adjustment;
    await page.route('**/api/encargos/ajustes', route => { adjustment = route.request().postDataJSON(); return route.fulfill({ status: 202, json: { id: 'ensayo' } }); });
    await page.getByRole('button', { name: 'Enviar ajuste', exact: true }).click(); await count(0);
    assert.deepEqual(adjustment.attachments, calls[0].attachments.slice(1));
    assert.equal(calls.length, 2); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); assert.deepEqual(errors, []);
  });
}
