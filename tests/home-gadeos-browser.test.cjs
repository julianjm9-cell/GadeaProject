const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium, webkit } = require('./browser-runtime.cjs');

for (const [name, engine] of [['Chromium', chromium], ['WebKit', webkit]]) {
  for (const width of [1440, 390]) {
    test(`Acceso privado a GADEOS desde Inicio: ${name}, ${width}px`, async t => {
      const browser = await engine.launch(name === 'Chromium' ? { channel: 'msedge' } : {});
      t.after(() => browser.close());
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route('https://educame.test/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/public/app-availability') return route.fulfill({ json: { apps: { GADEOS: { private: true } } } });
        if (path === '/') return route.fulfill({ contentType: 'text/html', body: readFileSync(resolve(__dirname, '../marketing/app_landings_demo/index.html'), 'utf8') });
        if (path === '/juegos-del-hambre-chinchon') return route.fulfill({ contentType: 'text/html', body: readFileSync(resolve(__dirname, '../apps/gadeos/index.html'), 'utf8') });
        return route.fulfill({ status: 204 });
      });
      await page.goto('https://educame.test/');
      const link = page.locator('a[href="/juegos-del-hambre-chinchon"]');
      assert.equal(await link.count(), 1);
      assert.equal(await link.isVisible(), true);
      assert.match(await link.innerText(), /Juegos del Hambre en Chinchón/);
      assert.match(await link.innerText(), /Acceso privado/);
      assert.equal(await link.locator('svg[aria-hidden="true"]').count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await link.focus();
      assert.equal(await link.evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Enter');
      await page.waitForURL('https://educame.test/juegos-del-hambre-chinchon');
      assert.equal(await page.getByLabel('Nombre de tributo').isVisible(), true);
      assert.equal(await page.getByLabel('Contraseña', { exact: true }).getAttribute('type'), 'password');
    });
  }
}
