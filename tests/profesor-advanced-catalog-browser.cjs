const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await page.locator('.home-primary-nav').getByRole('button', { name: 'Material' }).click();
    await page.getByRole('button', { name: 'Crear material', exact: true }).click();

    const advanced = page.locator('.advanced-family');
    assert.equal(await advanced.count(), 1);
    assert.match(await advanced.locator('summary').innerText(), /Ejercicios avanzados/);
    if (!await advanced.evaluate(element => element.open)) await advanced.locator('summary').click();
    assert.deepEqual(await advanced.locator('[data-exercise]').evaluateAll(elements => elements.map(element => element.dataset.exercise)), ['pasapalabra', 'hangman']);
    assert.equal(await page.locator('.playful-family [data-exercise="pasapalabra"], .playful-family [data-exercise="hangman"]').count(), 0);
    assert.equal(await page.locator('[data-exercise="visualquiz"], [data-exercise="imagepoint"]').count(), 0);
    assert.deepEqual(await advanced.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src').split('/').pop())), ['pasapalabra.webp', 'hangman.webp']);

    await page.locator('#workshopCourse').selectOption('3.º ESO');
    await page.locator('#workshopSubject').selectOption('Lengua');
    await page.locator('#workshopTopic').fill('Sintaxis');
    await advanced.locator('[data-exercise="pasapalabra"]').click();
    assert.equal(await page.locator('#count-pasapalabra').inputValue(), '1');
    assert.match(await page.locator('#workshopSelection').innerText(), /Pasapalabra/);
    await page.locator('#workshopManual').click();
    await page.locator('.activity-edit-block:visible').first().waitFor();
    assert.match(await page.locator('.activity-edit-block:visible h3').innerText(), /Pasapalabra/);
    assert.deepEqual(errors, []);
    console.log('PASS advanced catalog contains only Pasapalabra and Hangman and opens the editor');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
