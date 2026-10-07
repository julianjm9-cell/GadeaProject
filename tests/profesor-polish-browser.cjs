const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({headless: true, channel: 'msedge'});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href + '#inicio');
    await page.locator('.home-primary-nav').getByRole('button', {name: 'Material'}).click();
    assert.equal(await page.getByRole('button', {name: 'Materiales enviados'}).count(), 0);
    const cards = page.locator('.material-hub-card');
    assert(await cards.count() >= 2);
    const first = cards.first().locator('.material-card-menu');
    const second = cards.nth(1).locator('.material-card-menu');
    await first.locator('summary').click();
    assert.equal(await first.evaluate(el => el.open), true);
    await second.locator('summary').click();
    assert.equal(await first.evaluate(el => el.open), false);
    assert.equal(await second.evaluate(el => el.open), true);
    await page.locator('.material-page-head h1').click();
    assert.equal(await second.evaluate(el => el.open), false);
    await first.locator('summary').click();
    await page.keyboard.press('Escape');
    assert.equal(await first.evaluate(el => el.open), false);
    await first.locator('summary').click();
    await first.getByRole('button', {name: 'Editar'}).click();
    assert.equal(await first.evaluate(el => el.open), false);
    await page.locator('#dialog .close').click();
    await page.evaluate(() => {
      state.library.push({id: 'menu-test', title: 'Actividad de prueba', subject: 'Matemáticas',
        activity: {version: 1, questions: [{id: 'q1', type: 'short', prompt: '¿Cuánto es 2 + 2?', answer: '4'}]}});
      render();
    });
    const useMenu = page.locator('.material-use-menu').first();
    await useMenu.locator('summary').click();
    assert.equal(await useMenu.evaluate(el => el.open), true);
    await page.locator('.material-page-head h1').click();
    assert.equal(await useMenu.evaluate(el => el.open), false);

    await page.evaluate(() => {view = 'Accesos'; render()});
    const access = page.locator('.access-card').first();
    assert(await access.count());
    const scale = await access.evaluate(card => ({
      heading: parseFloat(getComputedStyle(card.querySelector('h2')).fontSize),
      avatar: card.querySelector('.access-avatar').getBoundingClientRect().width,
      control: parseFloat(getComputedStyle(card.querySelector('.access-card-controls button')).fontSize)
    }));
    assert(scale.heading <= 20 && scale.avatar <= 70 && scale.control <= 13, JSON.stringify(scale));
    await page.screenshot({path: 'tools/profesor-access-polish.png'});
    await page.setViewportSize({width: 390, height: 844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    await page.setViewportSize({width: 1440, height: 900});
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href + '#temario');
    await page.locator('[data-support="open"]').waitFor();
    await page.evaluate(() => {
      const topic = PROFESOR_TEMARIO['3.º ESO'].Matemáticas[0];
      state.teacherProfile.plan = 'premium';
      state.supportWorkspace = {
        messages: [{role: 'assistant', text: 'Borrador listo'}], draft: JSON.parse(JSON.stringify(topic)),
        original: JSON.parse(JSON.stringify(topic)), sourceId: topic.id, sourceTitle: topic.title,
        course: '3.º ESO', subject: 'Matemáticas', mode: 'improve'
      };
    });
    await page.locator('[data-support="open"]').click();
    await page.locator('[data-support="review"]').click();
    const offsets = await page.evaluate(() => {
      const left = [...document.querySelectorAll('.support-preview > section')];
      const right = [...document.querySelectorAll('.support-edit-fields > .support-edit-section')];
      return left.map((section, index) => Math.abs(section.getBoundingClientRect().top - right[index].getBoundingClientRect().top));
    });
    assert.equal(offsets.length, 10);
    assert(offsets.every(offset => offset < 2), `apartados desalineados: ${offsets.join(', ')}`);
    assert.deepEqual(errors, []);
    console.log('PASS Materiales: menús; Accesos Alumnos: escala y móvil; editor: apartados alineados');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exit(1)});
