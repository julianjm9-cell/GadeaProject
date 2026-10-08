const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    const timeline = { type: 'timeline', prompt: 'Ordena cronológicamente estos estrenos de películas animadas para niños.', answer: '', options: ['2021 – Encanto', '1995 – Toy Story', '2017 – Coco', '2016 – Moana', '2013 – Frozen', '2003 – Finding Nemo'] };
    const material = { id: 'layout-test', title: 'Animación', subject: 'Cultura', activity: { version: 1, questions: [timeline] } };
    await page.evaluate(value => runActivity(value, ''), material);
    const layout = await page.evaluate(() => {
      const dialog = $('dialog'), content = dialog.querySelector('.play-content'), list = $('order-0'), row = list.querySelector('.order-row'), value = row.querySelector('.order-value');
      return { dialogHeight: dialog.getBoundingClientRect().height, contentHeight: content.clientHeight, contentScrollHeight: content.scrollHeight, listWidth: list.getBoundingClientRect().width, labelOffset: value.getBoundingClientRect().left - row.getBoundingClientRect().left, footerBottom: dialog.querySelector('.play-footer').getBoundingClientRect().bottom };
    });
    assert.ok(layout.listWidth < 650, `Timeline adapts to short labels: ${JSON.stringify(layout)}`);
    assert.ok(layout.labelOffset < 60, `Timeline label starts beside drag handle: ${JSON.stringify(layout)}`);
    assert.ok(layout.contentScrollHeight <= layout.contentHeight + 2, `Normal timeline fits without internal scroll: ${JSON.stringify(layout)}`);
    assert.ok(layout.footerBottom < 768, `Footer remains in view: ${JSON.stringify(layout)}`);
    await page.screenshot({ path: 'tools/profesor-timeline-compact.png' });
    await page.locator('[data-action="close"]:visible').last().click();

    const longTimeline = { ...timeline,
      prompt: 'Arrange the following six stages in the correct chronological order. Each stage is described using the passive voice and relates to the making of a film.',
      options: ['The script was written by the screenwriter.', 'The main actors were cast by the director.',
        'Filming was started on the studio set.', 'Special effects were added during post-production.',
        'The movie was released in cinemas.', 'The finished film was considered for awards.'],
      hints: ['Think about what happens before filming.'],
      explanation: 'The steps progress from writing to release and possible recognition.',
    };
    await page.evaluate(value => runActivity(value, ''), { ...material, activity: { version: 1, questions: [longTimeline] } });
    await page.getByRole('button', { name: 'Necesito una pista' }).click();
    await page.locator('[data-confirm-order]').click();
    const confirmedOverflow = await page.locator('.play-content').evaluate(node => node.scrollHeight - node.clientHeight);
    assert.ok(confirmedOverflow <= 2, `Confirmed six-step timeline with a hint fits without scrolling (${confirmedOverflow}px)`);
    await page.locator('[data-action="close"]:visible').last().click();

    const eightSteps = { ...longTimeline, options: [
      'The initial screenplay was drafted by the writer.', 'The screenplay was revised by the producer.',
      'The lead actors were cast by the director.', 'The sets were designed by the art department.',
      'The scenes were filmed by the crew.', 'The footage was edited by the team.',
      'The special effects were added in post-production.', 'The film was released in cinemas.',
    ] };
    await page.evaluate(value => runActivity(value, ''), { ...material, activity: { version: 1, questions: [eightSteps] } });
    await page.getByRole('button', { name: 'Necesito una pista' }).click();
    await page.locator('[data-confirm-order]').click();
    const denseOverflow = await page.locator('.play-content').evaluate(node => node.scrollHeight - node.clientHeight);
    assert.ok(denseOverflow <= 1, `Eight-step timeline with a hint fits without scrolling (${denseOverflow}px)`);
    await page.locator('[data-action="close"]:visible').last().click();

    await page.evaluate(value => editActivity(value), material);
    assert.equal(await page.locator('.material-editor-dialog').count(), 1);
    assert.equal(await page.locator('#dialogTitle').isVisible(), false);
    assert.equal(await page.locator('.studio-subtitle').isVisible(), false);
    assert.equal(await page.locator('#activityTitle').isVisible(), true);
    assert.equal(await page.locator('#editorPreview .play-question[data-type="timeline"] .order-row').count(), 6);
    assert.doesNotMatch(await page.locator('#editorPreview').innerText(), /1995|2021|2017/);
    await page.locator('#q-0').fill('Ordena estas películas.');
    assert.match(await page.locator('#editorPreview .play-question h3').innerText(), /Ordena estas películas/);
    await page.screenshot({ path: 'tools/profesor-editor-player-preview.png' });
    await page.locator('[data-action="close"]:visible').last().click();
    const cards = { id: 'preview-cards', title: 'Tarjetas', subject: 'Lengua', activity: { version: 1, questions: [
      { type: 'flashcard', prompt: '¿Qué es un sustantivo?', answer: 'Una palabra que nombra.', options: [] },
      { type: 'memory', prompt: 'Relaciona las parejas.', answer: 'Completado', options: ['Gato | Cat', 'Perro | Dog'] },
    ] } };
    await page.evaluate(value => editActivity(value), cards);
    assert.equal(await page.locator('#editorPreview .flash-card').count(), 1);
    await page.getByRole('button', { name: 'Siguiente ejercicio' }).click();
    assert.equal(await page.locator('#editorPreview .memory-card').count(), 4);
    await page.locator('[data-action="close"]:visible').last().click();
    const incompleteRosco = { id: 'preview-draft', title: 'Borrador', subject: 'Lengua', activity: { version: 1, questions: [
      { type: 'pasapalabra', prompt: 'Completa el rosco.', answer: '', options: ['A | Pista | abeja', 'B | Otra pista | barco', 'C | Última pista | casa'] },
    ] } };
    await page.evaluate(value => editActivity(value), incompleteRosco);
    assert.equal(await page.locator('#editorPreview .pasapalabra-wheel button').count(), 3);
    await page.locator('.structured-options [data-row="2"][data-col="0"]').fill('');
    assert.match(await page.locator('#editorPreview').innerText(), /Completa las letras/);
    assert.deepEqual(errors, []);
    console.log('PASS timeline compact layout and matching editor preview');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
