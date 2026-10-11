const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const material = { id: 'game-theme-check', title: 'Repaso de Ciencias', subject: 'Ciencias', activity: { version: 1, questions: [
  { type: 'flashcard', prompt: '¿Cómo se llama el proceso por el que las plantas convierten la luz en energía?', answer: 'Fotosíntesis', options: [] },
  { type: 'memory', prompt: 'Relaciona cada concepto con su definición.', answer: 'Completado', options: ['Fotosíntesis | Luz y alimento', 'Evaporación | Agua a vapor', 'Órbita | Trayectoria de un astro'] },
  { type: 'hangman', prompt: 'Proceso por el que el agua pasa de líquido a gas.', answer: 'Evaporación', options: [] },
] } };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await page.evaluate(value => runActivity(value, ''), material);
    assert.equal(await page.locator('.game-timer').count(), 3);
    const timer = page.locator('[data-question="0"] [data-timer]');
    await timer.click();
    await page.waitForFunction(() => document.querySelector('#timer-0')?.textContent !== '00:00', null, { timeout: 3000 });
    assert.notEqual(await page.locator('#timer-0').innerText(), '00:00');
    await timer.click();
    await page.screenshot({ path: 'tmp/game-theme-flashcard.png' });
    await page.locator('#flip-0').click();
    assert.match(await page.locator('#flip-0').innerText(), /Fotosíntesis/);
    await page.locator('#flip-0').click();
    assert.match(await page.locator('#flip-0').innerText(), /plantas convierten la luz/);
    await page.getByRole('button', { name: 'Actividad siguiente' }).click();
    assert.equal(await page.locator('#memory-1 .memory-card').count(), 6);
    await page.locator('#memory-1 .memory-card').first().click();
    await page.screenshot({ path: 'tmp/game-theme-memory.png' });
    await page.getByRole('button', { name: 'Actividad siguiente' }).click();
    await page.locator('#hangman-2').press('E');
    assert.ok(await page.locator('#hangman-2 [data-hangman-letter="E"]').isDisabled());
    await page.screenshot({ path: 'tmp/game-theme-hangman.png' });
    const desktop = await page.evaluate(() => ({
      contentOverflow: document.querySelector('.play-content').scrollHeight - document.querySelector('.play-content').clientHeight,
      footerBottom: document.querySelector('.play-footer').getBoundingClientRect().bottom,
      horizontalOverflow: document.querySelector('#dialog').scrollWidth - document.querySelector('#dialog').clientWidth,
    }));
    assert.ok(desktop.contentOverflow <= 2, `Hangman fits at 1366×768: ${JSON.stringify(desktop)}`);
    assert.ok(desktop.footerBottom <= 768, `Footer stays visible: ${JSON.stringify(desktop)}`);
    assert.ok(desktop.horizontalOverflow <= 2, `No horizontal overflow: ${JSON.stringify(desktop)}`);
    await page.locator('#dialog .close').click();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(value => runActivity(value, ''), material);
    for (let index = 0; index < 3; index++) {
      if (index) await page.getByRole('button', { name: 'Actividad siguiente' }).click();
      const overflow = await page.evaluate(() => document.querySelector('#dialog').scrollWidth - document.querySelector('#dialog').clientWidth);
      assert.ok(overflow <= 2, `Game ${index + 1} has no horizontal overflow on mobile (${overflow}px)`);
    }
    await page.screenshot({ path: 'tmp/game-theme-mobile.png' });
    await page.locator('#dialog .close').click();
    await page.setViewportSize({ width: 1366, height: 768 });
    const otherGames = { ...material, activity: { version: 1, questions: [
      { type: 'sentence', prompt: 'Ordena las partes de la oración.', answer: 'La Tierra → gira → alrededor del Sol', options: ['La Tierra', 'gira', 'alrededor del Sol'] },
      { type: 'timeline', prompt: 'Ordena los acontecimientos.', answer: '1995 → 2003 → 2017', options: ['2017 – Coco', '1995 – Toy Story', '2003 – Buscando a Nemo'] },
      { type: 'error', prompt: 'Corrige: el Sol es un planeta', answer: 'El Sol es una estrella', options: [] },
      { type: 'wordsearch', prompt: 'Encuentra las palabras.', answer: 'Completado', options: ['GATO', 'PATO', 'RANA'] },
      { type: 'crossword', prompt: 'Resuelve el crucigrama.', answer: 'Completado', options: ['GATO | Felino', 'PATO | Ave', 'RATA | Roedor'] },
      { type: 'dragdrop', prompt: 'Relaciona cada astro.', answer: 'Completado', options: ['Sol | Estrella', 'Tierra | Planeta', 'Luna | Satélite'] },
      { type: 'pasapalabra', prompt: 'Completa el rosco.', answer: 'Completado', options: ['A | Líquido esencial | agua', 'B | Lugar con libros | biblioteca', 'C | Pigmento verde | clorofila'] },
    ] } };
    await page.evaluate(value => runActivity(value, ''), otherGames);
    for (let index = 0; index < otherGames.activity.questions.length; index++) {
      if (index) await page.getByRole('button', { name: 'Actividad siguiente' }).click();
      const type = otherGames.activity.questions[index].type;
      assert.equal(await page.locator('.play-question:visible').getAttribute('data-type'), type);
      assert.equal(await page.locator('.play-question:visible .game-timer').count(), 1);
      const bounds = await page.evaluate(() => ({
        horizontal: document.querySelector('#dialog').scrollWidth - document.querySelector('#dialog').clientWidth,
        footerBottom: document.querySelector('.play-footer').getBoundingClientRect().bottom,
      }));
      assert.ok(bounds.horizontal <= 2, `${type}: no horizontal overflow (${JSON.stringify(bounds)})`);
      assert.ok(bounds.footerBottom <= 768, `${type}: visible footer (${JSON.stringify(bounds)})`);
      await page.screenshot({ path: `tmp/game-theme-${type}.png` });
    }
    await page.locator('#dialog .close').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(value => runActivity(value, ''), otherGames);
    for (let index = 0; index < otherGames.activity.questions.length; index++) {
      if (index) await page.getByRole('button', { name: 'Actividad siguiente' }).click();
      const type = otherGames.activity.questions[index].type;
      const horizontal = await page.evaluate(() => document.querySelector('#dialog').scrollWidth - document.querySelector('#dialog').clientWidth);
      assert.ok(horizontal <= 2, `${type}: no horizontal overflow on mobile (${horizontal}px)`);
    }
    await page.locator('#dialog .close').click();
    await page.setViewportSize({ width: 1280, height: 720 });
    const longMemory = { ...material, activity: { version: 1, questions: [{ type: 'memory', prompt: 'Relaciona cada término con la definición correcta.', answer: 'Completado', options: [
      'Fotosíntesis de las plantas | Conversión de luz solar en energía química',
      'Evaporación en la atmósfera | Paso del agua líquida a vapor de agua',
      'Órbita de un planeta | Trayectoria que sigue alrededor de una estrella',
      'Condensación del vapor | Formación de pequeñas gotas de agua líquida',
      'Ecosistema de un bosque | Seres vivos y medio físico relacionados',
      'Energía cinética de un cuerpo | Energía asociada al movimiento del cuerpo',
    ] }] } };
    await page.evaluate(value => runActivity(value, ''), longMemory);
    const denseMemory = await page.evaluate(() => ({
      cards: document.querySelectorAll('.memory-card').length,
      overflow: document.querySelector('.play-content').scrollHeight - document.querySelector('.play-content').clientHeight,
      footerBottom: document.querySelector('.play-footer').getBoundingClientRect().bottom,
    }));
    assert.equal(denseMemory.cards, 12);
    assert.ok(denseMemory.overflow <= 2, `Six long pairs fit at 1280×720: ${JSON.stringify(denseMemory)}`);
    assert.ok(denseMemory.footerBottom <= 720, `Dense board keeps footer visible: ${JSON.stringify(denseMemory)}`);
    assert.deepEqual(errors, []);
    console.log('PASS coherent game theme, timer, all ten games and responsive layout');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
