const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await page.locator('.home-primary-nav').getByRole('button', { name: 'Material' }).click();
    await page.getByRole('button', { name: 'Crear material', exact: true }).click();
    assert.equal(await page.locator('.studio-fields > div:visible').count(), 5);
    assert.equal(await page.locator('.studio-preview').isVisible(), true);
    await page.locator('#workshopCourse').selectOption('4.º Primaria');
    await page.locator('#workshopTopic').fill('Fracciones');
    const pairs = page.locator('[data-exercise="pairs"]');
    await pairs.click();
    assert.equal(await pairs.getAttribute('aria-pressed'), 'true');
    await pairs.locator('[data-step="1"]').click();
    assert.equal(await page.locator('#count-pairs').inputValue(), '4');
    assert.match(await page.locator('.preview-section-title').innerText(), /\(4\)/);
    const contained = await pairs.evaluate(tile => {
      const tileRect = tile.getBoundingClientRect();
      const quantityRect = tile.querySelector('.tile-quantity').getBoundingClientRect();
      return quantityRect.left >= tileRect.left && quantityRect.right <= tileRect.right && quantityRect.top >= tileRect.top && quantityRect.bottom <= tileRect.bottom;
    });
    assert.equal(contained, true, 'quantity control remains inside its tile');
    await pairs.locator('[data-step="-1"]').click();
    assert.equal(await page.locator('#count-pairs').inputValue(), '3');
    await page.locator('#workshopContinue').click();
    await page.locator('#q-0').waitFor();
    assert.equal(await page.locator('#q-0').count(), 1, 'manual editor opens');

    await page.locator('#dialog').getByRole('button', { name: 'Cerrar' }).click();
    await page.evaluate(() => { demo = false; });
    await page.getByRole('button', { name: 'Crear material', exact: true }).click();
    await page.locator('#workshopCourse').selectOption('4.º Primaria');
    await page.locator('#workshopTopic').fill('Células');
    await page.locator('[data-exercise="pairs"]').click();
    await page.locator('.photo-manual summary').click();
    await page.locator('[data-exercise="visualquiz"]').click();
    assert.equal(await page.locator('#count-visualquiz').inputValue(), '1');
    assert.equal(await page.locator('#workshopContinue').isDisabled(), true, 'AI unavailable for photo-only material');
    assert.equal(await page.locator('#workshopManual').isDisabled(), false);
    await page.locator('#workshopManual').click();
    await page.locator('#q-0').waitFor();
    assert.equal(await page.locator('#q-0').count(), 1, 'photo material opens in manual editor');
    await page.locator('#dialog').getByRole('button', { name: 'Cerrar' }).click();
    await page.evaluate(() => {
      window.generatorCalls = 0;
      api = async (route) => {
        if (route === '/api/profesor/generate') {
          window.generatorCalls++;
          return { questions: [{ type: 'flashcard', prompt: '¿Cuánto es 2 + 2?', answer: '4', options: [] }] };
        }
        return {};
      };
    });
    await page.getByRole('button', { name: 'Crear material', exact: true }).click();
    await page.locator('#workshopCourse').selectOption('4.º Primaria');
    await page.locator('#workshopTopic').fill('Sumas');
    await page.locator('.photo-manual summary').click();
    await page.locator('[data-exercise="visualquiz"]').click();
    await page.locator('[data-exercise="flashcard"]').click();
    await page.locator('#workshopContinue').click();
    await page.locator('#q-0').waitFor();
    assert.equal(await page.locator('#q-0').inputValue(), '¿Cuánto es 2 + 2?');
    assert.equal(await page.evaluate(() => window.generatorCalls), 1, 'AI path still generates');
    await page.locator('#dialog').getByRole('button', { name: 'Cerrar' }).click();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await mobile.locator('.home-primary-nav').getByRole('button', { name: 'Material' }).click();
    await mobile.getByRole('button', { name: 'Crear material', exact: true }).click();
    for (const category of ['basic', 'game', 'photo']) {
      await mobile.locator(`[data-workshop-category="${category}"]`).click();
      assert.equal(await mobile.locator('.catalog-main').getAttribute('data-mobile-category'), category);
    }
    await mobile.screenshot({ path: 'tools/profesor-crear-material-mobile.png' });
    assert.deepEqual(errors, []);
    console.log('PASS creator layout, quantity, preview, manual/photo paths and mobile categories');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
