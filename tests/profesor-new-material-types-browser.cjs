const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);

    await page.locator('.home-primary-nav').getByRole('button', { name: 'Material' }).click();
    await page.getByRole('button', { name: 'Crear material', exact: true }).click();
    if (!await page.locator('.basic-family').evaluate(element => element.open)) await page.locator('.basic-family summary').click();
    assert.equal(await page.locator('[data-exercise="multigaps"]').count(), 1);
    assert.equal(await page.locator('[data-exercise="numeric"]').count(), 1);
    assert.match(await page.locator('[data-exercise="numeric"] small').innerText(), /resultado/i);
    await page.locator('.playful-family summary').click();
    assert.equal(await page.locator('[data-exercise="pasapalabra"]').count(), 1);
    assert.equal(await page.locator('[data-exercise="hangman"]').count(), 1);
    await page.locator('#dialog').getByRole('button', { name: 'Cerrar' }).click();

    const material = {
      id: 'new-types', title: 'Repaso dinámico', subject: 'Ciencias', activity: { version: 1, questions: [
        { type: 'multigaps', prompt: 'El agua pasa de ___ a ___ cuando se congela.', answer: 'líquido | sólido', options: ['líquido', 'sólido'] },
        { type: 'numeric', prompt: '¿Cuánto es 25 ÷ 2?', answer: '12,5', options: [] },
        { type: 'pasapalabra', prompt: 'Completa la rueda del tema', answer: 'Completado', options: ['A | Líquido esencial para la vida | agua', 'B | Lugar donde se prestan libros | biblioteca', 'C | Pigmento verde que capta luz | clorofila'] },
        { type: 'hangman', prompt: 'Estrella del sistema solar', answer: 'Sol', options: [] },
      ] },
    };
    await page.evaluate(value => editActivity(value), material);
    assert.ok(await page.locator('.play-editor-hint').count() >= 4);
    assert.equal(await page.locator('.numeric-preview').count(), 1);
    assert.equal(await page.locator('.pasapalabra-preview').count(), 1);
    await page.locator('#dialog').getByRole('button', { name: 'Cerrar' }).click();
    await page.evaluate(value => runActivity(value, ''), material);
    const gaps = page.locator('#puzzle-0 [data-multi-gap]');
    await gaps.nth(0).fill('líquido');
    await gaps.nth(1).fill('sólido');
    await page.locator('#r-1').fill('12.5');
    for (const answer of ['agua', 'biblioteca', 'clorofila']) {
      await page.locator('#pasapalabra-input-2').fill(answer);
      await page.locator('#puzzle-2 [data-answer]').click();
    }
    for (const letter of ['S', 'O', 'L']) await page.locator(`#hangman-3 [data-hangman-letter="${letter}"]`).click();
    const completion = await page.locator('.play-question').evaluateAll(cards => cards.map(card => ({ type: card.querySelector('.play-kind')?.textContent, complete: card.classList.contains('is-complete') })));
    assert.match(await page.locator('#playCompleted').innerText(), /4 de 4/, JSON.stringify(completion));
    await page.screenshot({ path: 'tools/profesor-new-material-types.png', fullPage: true });
    await page.getByRole('button', { name: 'Comprobar respuestas' }).click();
    assert.match(await page.locator('#activityScore').innerText(), /4\/4 correctas/);
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await mobile.evaluate(value => runActivity(value, ''), material);
    assert.equal(await mobile.locator('.activity-play').evaluate(dialog => dialog.scrollWidth > dialog.clientWidth + 2), false, 'new games fit on mobile');
    await mobile.close();
    assert.deepEqual(errors, []);
    console.log('PASS new material types: catalog, multi-gap, numeric, Pasapalabra, Hangman and progress');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
