const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1250, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    const material = {
      id: 'activity-polish-test', title: 'Prueba interactiva', subject: 'Inglés',
      activity: { version: 1, questions: [
        { type: 'pairs', prompt: 'Gato', answer: 'Cat', options: [] },
        { type: 'pairs', prompt: 'Perro', answer: 'Dog', options: [] },
        { type: 'gaps', prompt: 'She ___ in London.', answer: 'lives', options: [] },
        { type: 'quiz', prompt: '¿Qué color es blue?', answer: 'Azul', options: ['Rojo', 'Azul', 'Verde'] },
        { type: 'order', prompt: 'Ordena los pasos', answer: 'Primero → Después → Final', options: ['Primero', 'Después', 'Final'] },
        { type: 'dragdrop', prompt: 'Relaciona', answer: 'Completado', options: ['Sol | Estrella', 'Tierra | Planeta', 'Luna | Satélite'] },
        { type: 'flashcard', prompt: 'Traduce apple', answer: 'Manzana', options: [] },
      ] },
    };
    await page.evaluate(value => runActivity(value, ''), material);
    assert.equal(await page.locator('.play-question').count(), 7);
    await page.locator('[data-question="0"] [data-piece="0"]').click();
    await page.locator('[data-question="0"] [data-bucket]').filter({ hasText: 'Cat' }).click();
    await page.locator('[data-question="0"] [data-piece="1"]').click();
    await page.locator('[data-question="0"] [data-bucket]').filter({ hasText: 'Dog' }).click();
    await page.locator('#r-2').fill('lives');
    assert.match(await page.locator('.play-gap-line').innerText(), /She[\s\S]*in London/);
    await page.locator('input[name="r-3"][value="Azul"]').check();
    const desired = ['Primero', 'Después', 'Final'];
    for (let target = 0; target < desired.length; target++) {
      const list = await page.locator('#order-4 .order-value').allTextContents();
      const source = list.findIndex(text => text.includes(desired[target]));
      if (source !== target) {
        await page.locator(`#order-4 [data-sequence-row="${source}"]`).click();
        await page.locator(`#order-4 [data-sequence-row="${target}"]`).click();
      }
    }
    // A moved piece must leave its previous destination empty.
    await page.locator('#puzzle-5 [data-item="0"]').dragTo(page.locator('#puzzle-5 [data-target="1"]'));
    await page.locator('#puzzle-5 [data-item="0"]').click();
    await page.locator('#puzzle-5 [data-target="0"]').click();
    assert.match(await page.locator('#puzzle-5 [data-target="1"]').innerText(), /Suelta o toca aquí/);
    for (const n of [1, 2]) {
      await page.locator(`#puzzle-5 [data-item="${n}"]`).click();
      await page.locator(`#puzzle-5 [data-target="${n}"]`).click();
    }
    await page.locator('#flip-6').click();
    await page.locator('#flash-assess-6 [data-flash="correct"]').click();
    await page.getByRole('button', { name: 'Comprobar respuestas' }).click();
    assert.match(await page.locator('#activityScore').innerText(), /7\/7 correctas/);
    await page.screenshot({ path: 'tools/profesor-activity-play.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    assert.equal(await page.evaluate(() => { const dialog = document.querySelector('.activity-play'); return dialog.scrollWidth > dialog.clientWidth + 2 || dialog.getBoundingClientRect().right > innerWidth + 2; }), false);
    assert.deepEqual(errors, []);
    console.log('PASS interactive player: matching, inline gap, choices, sequence, drag/drop, flashcard and mobile width');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
