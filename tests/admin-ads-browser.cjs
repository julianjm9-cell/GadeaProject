const { chromium } = require('./browser-runtime.cjs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve('admin/index.html')).href);
      await page.evaluate(() => {
        ads = [
          { id: 'ad-1', name: 'Lucía Gómez', headline: 'Clases de Primaria y ESO', location: 'Madrid y online', levels: '1.º Primaria, 2.º Primaria, 1.º ESO', subjects: 'Matemáticas, Lengua, Inglés', status: 'active', reports: 2 },
          { id: 'ad-2', name: 'Mario Ruiz', headline: 'Refuerzo de ciencias', location: 'Online', levels: '3.º ESO', subjects: 'Física y Química, Biología', status: 'removed', reports: 0 }
        ];
        setLoginState(true);
        setView('ads');
      });
      const cards = page.locator('#adsTable .ad-admin-card');
      assert.equal(await cards.count(), 2);
      assert.match(await cards.first().innerText(), /Cursos\s+1.º Primaria/i);
      assert.match(await cards.first().innerText(), /Asignaturas\s+Matemáticas/i);
      assert.equal(await cards.first().getByRole('button').count(), 3);
      assert.equal(await cards.last().getByRole('button', { name: 'Restaurar' }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      if (process.env.ADMIN_ADS_SCREENSHOT) await page.screenshot({ path: path.resolve(`tmp/admin-ads-fixed-${width}.png`), fullPage: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log('OK: anuncios separados y legibles en escritorio y móvil.');
})().catch(error => { console.error(error); process.exit(1); });
