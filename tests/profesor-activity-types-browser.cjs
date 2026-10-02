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
    const material = {
      id: 'all-types', title: 'Repaso de actividades', subject: 'Ciencias', activity: { version: 1, questions: [
        { type: 'boolean', prompt: 'El sol es una estrella', answer: 'Verdadero', options: ['Verdadero', 'Falso'] },
        { type: 'classify', prompt: '¿Qué clase de animal es?', answer: 'Mamífero', options: ['Mamífero', 'Ave'] },
        { type: 'short', prompt: 'Explica la fotosíntesis', answer: 'Transformación de luz en energía', options: [] },
        { type: 'reading', prompt: 'Resume la lectura', text: 'Las plantas necesitan luz y agua.', answer: 'Necesitan luz y agua', options: [] },
        { type: 'problem', prompt: 'Resuelve 2 + 2', answer: '4', options: [] },
        { type: 'memory', prompt: 'Encuentra las parejas', answer: 'Completado', options: ['Sol | Estrella', 'Tierra | Planeta'] },
        { type: 'sentence', prompt: 'Construye la frase', answer: 'La Tierra → gira → alrededor del Sol', options: ['La Tierra', 'gira', 'alrededor del Sol'] },
        { type: 'timeline', prompt: 'Ordena los eventos', answer: '2020 → 2021 → 2022', options: ['2020', '2021', '2022'] },
        { type: 'error', prompt: 'Corrige: el Sol es un planeta', answer: 'El Sol es una estrella', options: [] },
        { type: 'wordsearch', prompt: 'Busca las palabras', answer: 'Completado', options: ['GATO', 'PATO', 'RANA'] },
        { type: 'crossword', prompt: 'Completa el crucigrama', answer: 'Completado', options: ['GATO | Felino', 'PATO | Ave', 'RATA | Roedor'] },
        { type: 'visualquiz', prompt: 'Elige el cuerpo celeste', answer: 'Estrella', options: ['Estrella', 'Planeta'], image: { id: 'test', filename: 'sol.svg' } },
        { type: 'imagepoint', prompt: 'Marca el Sol', answer: 'Zona marcada', options: [], image: { id: 'test', filename: 'sol.svg' }, target: { x: 50, y: 50 } },
      ] },
    };
    await page.evaluate(value => {
      const blob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#f8d474"/></svg>'], { type: 'image/svg+xml' });
      visualImageUrls.set('server:test', Promise.resolve(URL.createObjectURL(blob)));
      runActivity(value, '');
    }, material);
    assert.equal(await page.locator('.play-question').count(), 13);
    assert.equal(await page.locator('#memory-5 .memory-card').count(), 4);
    assert.equal(await page.locator('#puzzle-9 .puzzle-grid button').count(), 100);
    assert.ok(await page.locator('#puzzle-10 [data-puzzle-cell]').count() > 5);
    await page.locator('#puzzle-10 [data-puzzle-cell]').first().fill('G');
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-puzzle-cell')), true);
    await page.locator('#visual-12 img').click({ position: { x: 100, y: 50 } });
    assert.match(await page.locator('#r-12').inputValue(), /^\d+,\d+$/);
    await page.locator('#visual-12').focus();
    const before = await page.locator('#r-12').inputValue();
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await page.locator('#r-12').inputValue(), before);
    await page.locator('[data-action="close"]').last().click();
    await page.evaluate(value => editActivity(value), { ...material, activity: { version: 1, context: { course: '3.º ESO' }, questions: [{ type: 'gaps', prompt: 'She ___ here.', answer: 'lives', options: [] }] } });
    assert.match(await page.locator('.play-gap-preview').innerText(), /hueco para escribir/);
    assert.match(await page.locator('.play-editor-hint').innerText(), /___/);
    await page.locator('[data-action="close"]').last().click();
    await page.evaluate(() => runActivity({ id: 'teacher-review', title: 'Revisión', subject: 'Ciencias', activity: { version: 1, questions: [
      { type: 'gaps', prompt: 'El cielo es ___.', answer: 'azul', options: [] },
      { type: 'short', prompt: 'Explica por qué', answer: 'Dispersión de la luz', options: [] },
    ] } }, state.students[0].id));
    await page.locator('#r-0').fill('azul');
    await page.locator('#r-1').fill('Por la luz');
    await page.getByRole('button', { name: 'Comprobar respuestas' }).click();
    assert.match(await page.locator('#activityScore').innerText(), /1\/2 correctas.*1 pendientes/);
    await page.locator('#grade-1').selectOption('correct');
    assert.equal(await page.evaluate(() => state.activityAttempts.at(-1).score), 2);
    assert.deepEqual(errors, []);
    console.log('PASS remaining material types, crossword keyboard, image point keyboard and gap editor preview');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
