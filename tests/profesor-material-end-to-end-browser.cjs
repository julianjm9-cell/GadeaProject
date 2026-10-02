const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await page.locator('.home-primary-nav').getByRole('button', { name: 'Material' }).click();
    await page.getByRole('button', { name: 'Crear material', exact: true }).click();
    await page.locator('#workshopCourse').selectOption('4.º Primaria');
    await page.locator('#workshopTopic').fill('Presente y vocabulario');
    await page.locator('.basic-family summary').click();
    await page.locator('[data-exercise="gaps"]').click();
    await page.locator('[data-exercise="gaps"] [data-step="-1"]').click();
    await page.locator('[data-exercise="gaps"] [data-step="-1"]').click();
    await page.locator('.playful-family summary').click();
    await page.locator('[data-exercise="dragdrop"]').click();
    await page.locator('#workshopContinue').click();
    await page.locator('#q-0').fill('She ___ a student.');
    await page.locator('#a-0').fill('is');
    await page.locator('#q-1').fill('Relaciona los términos');
    await page.locator('#o-1').fill('Cat | Gato\nDog | Perro\nBird | Pájaro');
    await page.getByRole('button', { name: 'Guardar material', exact: true }).click();
    await page.getByRole('button', { name: 'Probar sin guardar' }).click();
    await page.locator('#r-0').fill('is');
    for (const index of [0, 1, 2]) {
      await page.locator(`#puzzle-1 [data-item="${index}"]`).click();
      await page.locator(`#puzzle-1 [data-target="${index}"]`).click();
    }
    await page.getByRole('button', { name: 'Comprobar respuestas' }).click();
    assert.match(await page.locator('#activityScore').innerText(), /2\/2 correctas/);
    assert.deepEqual(errors, []);
    console.log('PASS material creator to editor, save, practice, inline gap and drag/drop');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
