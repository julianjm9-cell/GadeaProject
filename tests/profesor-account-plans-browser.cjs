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
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href + '#temario');
    await page.locator('.temario-controls').waitFor();

    assert.equal(await page.evaluate(() => fresh().teacherProfile.plan), 'normal');
    assert.equal(await page.evaluate(() => {
      const previous = state;
      state = { ...fresh(), version: 2, teacherProfile: undefined };
      normalizeTeacherState();
      const plan = state.teacherProfile.plan;
      state = previous;
      return plan;
    }), 'normal');
    await page.evaluate(() => { state = fresh(); normalizeTeacherState(); render(); });
    assert.match(await page.locator('.account-plan').innerText(), /Normal/);
    assert.equal(await page.locator('button.account-plan').count(), 0);
    await page.locator('.account-plan').click();
    assert.equal(await page.locator('#dialog[open]').count(), 0);
    assert.equal(await page.locator('.temario-preview-explanation').count(), 1);
    assert.equal(await page.locator('.temario-resource.locked').count(), 2);
    await page.getByRole('button', { name: 'Abrir Esquema resumen', exact: true }).click();
    assert.equal(await page.locator('.topic-resource-view').count(), 1);
    await page.locator('#dialog .close').click();
    await page.getByRole('button', { name: /Tema completo/ }).click();
    assert.equal(await page.locator('#dialog[open]').count(), 0);

    // Simulate a plan supplied by the server, without a user-facing switch.
    await page.evaluate(() => { state.teacherProfile.plan = 'premium'; render(); });
    assert.match(await page.locator('.account-plan').innerText(), /Premium/);
    assert.equal(await page.locator('button.account-plan').count(), 0);
    assert.equal(await page.locator('.temario-preview-explanation').count(), 1);
    await page.getByRole('button', { name: 'Ver tema completo' }).click();
    assert.equal(await page.locator('.temario-lesson').count(), 1);
    await page.locator('#dialog .close').click();

    await page.evaluate(() => { state.teacherProfile.plan = 'normal'; render(); openWorkshop({ course: '3.º ESO', subject: 'Matemáticas', topic: 'Ecuaciones', visualquiz: 2 }); });
    assert.match(await page.locator('.photo-manual summary').innerText(), /Premium/);
    assert.equal(await page.locator('#count-visualquiz').inputValue(), '0');
    assert.equal(await page.locator('[data-exercise="visualquiz"]').isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('PASS account plan is read-only in Profesor; normal and premium gates follow server state');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
