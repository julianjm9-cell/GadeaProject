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
    assert.equal(await page.locator('#workshopDuration').count(), 0);
    assert.equal(await page.locator('.studio-preview').count(), 0);
    await page.locator('#workshopCourse').selectOption('4.º Primaria');
    await page.locator('#workshopTopic').fill('Fracciones');
    const pairs = page.locator('[data-exercise="pairs"]');
    assert.equal(await page.locator('.basic-family').evaluate(el=>el.open),false,'exercise groups start collapsed');
    if (!await page.locator('.basic-family').evaluate(el => el.open)) await page.locator('.basic-family summary').click();
    await pairs.click();
    assert.equal(await pairs.getAttribute('aria-pressed'), 'true');
    await pairs.locator('[data-step="1"]').click();
    assert.equal(await page.locator('#count-pairs').inputValue(), '2');
    assert.match(await page.locator('#workshopSelection').innerText(), /2 ejercicios/);
    const contained = await pairs.evaluate(tile => {
      const tileRect = tile.getBoundingClientRect();
      const quantityRect = tile.querySelector('.tile-quantity').getBoundingClientRect();
      return quantityRect.left >= tileRect.left && quantityRect.right <= tileRect.right && quantityRect.top >= tileRect.top && quantityRect.bottom <= tileRect.bottom;
    });
    assert.equal(contained, true, 'quantity control remains inside its tile');
    await pairs.locator('[data-step="-1"]').click();
    assert.equal(await page.locator('#count-pairs').inputValue(), '1');
    await page.locator('.playful-family summary').click();
    await page.locator('[data-exercise="memory"]').click();
    assert.equal(await page.locator('.basic-family').evaluate(el=>el.open),false);
    assert.equal(await page.locator('#count-pairs').inputValue(),'1','collapsing a group preserves its selection');
    assert.match(await page.locator('#workshopSelection').innerText(),/2 ejercicios/);
    await page.locator('[data-exercise="memory"]').click();
    if (!await page.locator('.basic-family').evaluate(el => el.open)) await page.locator('.basic-family summary').click();
    for (let i = 0; i < 9; i++) await pairs.locator('[data-step="1"]').click();
    assert.equal(await page.locator('#count-pairs').inputValue(), '10');
    await page.locator('#workshopManual').click();
    await page.locator('#q-0').waitFor();
    assert.equal(await page.locator('#q-0').count(), 1, 'manual editor opens');
    assert.equal(await page.locator('.activity-edit-block:visible').count(), 1);
    assert.equal(await page.locator('#editorPreview .preview-exercise').count(), 1);

    await page.locator('#dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.evaluate(() => { demo = false; });
    await page.getByRole('button', { name: 'Crear material', exact: true }).click();
    await page.locator('#workshopCourse').selectOption('4.º Primaria');
    await page.locator('#workshopTopic').fill('Células');
    if (!await page.locator('.basic-family').evaluate(el => el.open)) await page.locator('.basic-family summary').click();
    if (!await page.locator('.photo-manual').evaluate(el => el.open)) await page.locator('.photo-manual summary').click();
    await page.locator('[data-exercise="visualquiz"]').click();
    assert.equal(await page.locator('#count-visualquiz').inputValue(), '1');
    assert.equal(await page.locator('#workshopContinue').isDisabled(), true, 'AI unavailable for photo-only material');
    assert.equal(await page.locator('#workshopManual').isDisabled(), false);
    await page.locator('#workshopManual').click();
    await page.locator('#q-0').waitFor();
    assert.equal(await page.locator('#q-0').count(), 1, 'photo material opens in manual editor');
    await page.locator('#dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
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
    if (!await page.locator('.photo-manual').evaluate(el => el.open)) await page.locator('.photo-manual summary').click();
    await page.locator('[data-exercise="visualquiz"]').click();
    if (!await page.locator('.playful-family').evaluate(el => el.open)) await page.locator('.playful-family summary').click();
    await page.locator('[data-exercise="flashcard"]').click();
    await page.locator('#workshopContinue').click();
    await page.locator('#q-0').waitFor();
    assert.equal(await page.locator('#q-0').inputValue(), '¿Cuánto es 2 + 2?');
    assert.equal(await page.evaluate(() => window.generatorCalls), 1, 'AI path still generates');
    await page.locator('#dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await mobile.locator('.home-primary-nav').getByRole('button', { name: 'Material' }).click();
    await mobile.getByRole('button', { name: 'Crear material', exact: true }).click();
    for (const category of ['basic-family', 'playful-family', 'photo-manual']) {
      const family = mobile.locator('.' + category);
      await family.locator('summary').click();
      assert.equal(await family.evaluate(el => el.open), true);
      await family.locator('summary').click();
    }
    assert.equal(await mobile.evaluate(() => document.querySelector('#dialog').scrollWidth > document.querySelector('#dialog').clientWidth + 2), false);
    await mobile.locator('#workshopCourse').selectOption('4.º Primaria');
    await mobile.locator('#workshopTopic').fill('Fracciones');
    await mobile.locator('.basic-family summary').click();
    const mobilePairs = mobile.locator('[data-exercise="pairs"]');
    await mobilePairs.click();
    for (let i = 0; i < 7; i++) await mobilePairs.locator('[data-step="1"]').click();
    assert.deepEqual(await mobile.locator('#form').evaluate(form => [...form.elements].filter(element => !element.checkValidity()).map(element => ({ id: element.id, message: element.validationMessage }))), [], 'mobile workshop form is valid');
    await mobile.locator('#workshopManual').click();
    await mobile.locator('#q-0').waitFor();
    assert.equal(await mobile.locator('#editorPreview .preview-exercise').count(), 1);
    await mobile.screenshot({ path: 'tools/profesor-crear-material-mobile.png' });
    assert.deepEqual(errors, []);
    console.log('PASS creator layout, one-by-one selection, one-exercise preview, manual/AI/photo paths and mobile accordions');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
