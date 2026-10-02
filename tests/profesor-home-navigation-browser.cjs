const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await page.locator('.home-student-card').first().waitFor();
    await page.evaluate(() => {
      state.students = state.students.slice(0, 3);
      state.students[1].subjects = ['Matemáticas', 'Lengua', 'Inglés', 'Ciencias Naturales', 'Física y Química', 'Geografía e Historia', 'Tecnología'];
      state.students[1].notes = '';
      state.students[2].name = 'Nombre de alumno muy largo para comprobar la alineación';
      state.students[2].notes = 'Una observación larga que se puede consultar completa desde el editor sin desplazar los demás controles.';
      render();
    });
    assert.deepEqual((await page.locator('.home-primary-nav button').allTextContents()).map(s => s.trim()), ['Temario', 'Material']);
    assert.equal(await page.locator('.home-nav .home-start').getAttribute('aria-label'), 'Inicio');
    assert.equal(await page.locator('.home-student-open').count(), 0);
    assert.equal(await page.locator('.home-page').getByRole('button', { name: /Ver todas/ }).count(), 0);
    const layout = await page.locator('.home-student-card').evaluateAll(cards => cards.map(card => {
      const r = card.getBoundingClientRect(), next = card.querySelector('.home-next-label').getBoundingClientRect(), note = card.querySelector('.home-student-note').getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, nextX: next.x, nextY: next.y - r.y, noteX: note.x, noteY: note.y - r.y };
    }));
    assert.equal(new Set(layout.map(r => r.height)).size, 1, 'all cards have the same height');
    assert.equal(new Set(layout.map(r => r.x)).size, 1, 'students stack in one column');
    assert.ok(layout[1].y > layout[0].y + layout[0].height, 'cards have consistent vertical spacing');
    assert.equal(new Set(layout.map(r => r.nextX)).size, 1, 'next classes use the same column');
    assert.equal(new Set(layout.map(r => r.nextY)).size, 1, 'subjects do not displace next classes');
    assert.equal(new Set(layout.map(r => r.noteY)).size, 1, 'notes use the same row');
    await page.screenshot({ path: 'tools/profesor-home-navigation-desktop.png' });

    await page.locator('.home-student-card').first().getByRole('button', { name: /Cambiar color/ }).click();
    assert.equal(await page.locator('input[name="cardColor"]').count(), 8);
    assert.equal(await page.evaluate(() => selected), null, 'color does not open the student');
    await page.locator('input[name="cardColor"][value="peach"]').check();
    await page.getByRole('button', { name: 'Guardar color', exact: true }).click();
    assert.equal(await page.locator('.home-student-card').first().getAttribute('data-card-color'), 'peach');
    await page.locator('.home-student-card').first().getByRole('button', { name: /Editar nota/ }).click();
    assert.equal(await page.evaluate(() => selected), null, 'note editor does not open the student');
    await page.getByLabel('Contexto y observaciones').fill('Nota de prueba guardada');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.evaluate(() => saveQueue);
    await page.reload();
    await page.getByText('Nota de prueba guardada', { exact: true }).waitFor();
    assert.equal(await page.locator('.home-student-card').first().getAttribute('data-card-color'), 'peach', 'color persists');
    await page.locator('.home-student-card').first().locator('.home-next-label').click();
    await page.getByRole('heading', { name: 'Lucía Martín', exact: true, level: 1 }).waitFor();
    assert.equal(await page.locator('.student-overview').getAttribute('data-card-color'), null);
    await page.getByRole('button', { name: '← Inicio', exact: true }).click();
    await page.locator('.home-student-card').first().focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Lucía Martín', exact: true, level: 1 }).waitFor();
    await page.locator('.home-start').click();
    await page.getByRole('button', { name: 'Añadir alumno', exact: true }).click();
    await page.getByLabel('Nombre del alumno').fill('Alumno añadido desde Inicio');
    await page.getByLabel('Curso', { exact: true }).selectOption({ label: '3.º ESO' });
    await page.getByRole('button', { name: 'Crear alumno', exact: true }).click();
    await page.getByRole('heading', { name: 'Alumno añadido desde Inicio', exact: true, level: 1 }).waitFor();
    await page.locator('.home-start').click();
    assert.equal(await page.locator('.home-student-card').count(), 4);

    await page.getByRole('button', { name: 'Calendario', exact: true }).click();
    await page.getByRole('button', { name: 'Mes', exact: true }).click();
    await page.evaluate(() => {
      for (let offset = 0; offset < 12; offset++) { monthOffset = offset; if (monthDays().length === 42) break; }
      render();
    });
    assert.equal(await page.locator('.home-calendar-day').count(), 42);
    for (const width of [1672, 1366, 1024, 768]) {
      await page.setViewportSize({ width, height: 941 });
      const calendar = await page.evaluate(() => ({ last: document.querySelector('.home-calendar-day:last-child').getBoundingClientRect().bottom, panel: document.querySelector('.home-side .home-panel').getBoundingClientRect().bottom, overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
      assert.ok(calendar.last < calendar.panel, 'whole calendar is visible at ' + width);
      assert.equal(calendar.overflow, false, 'no horizontal overflow at ' + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.equal(await page.locator('.home-student-card').evaluateAll(cards => new Set(cards.map(c => c.getBoundingClientRect().height)).size), 1);
    await page.screenshot({ path: 'tools/profesor-home-navigation-mobile.png', fullPage: true });
    await page.locator('[data-action="homeMobilePanel"][data-id="classes"]').click();
    assert.equal(await page.locator('.home-calendar-day').count(), 42);
    await page.screenshot({ path: 'tools/profesor-home-navigation-mobile-calendar.png', fullPage: true });
    await page.locator('.home-primary-nav').getByRole('button', { name: 'Material', exact: true }).click();
    await page.getByRole('heading', { name: 'Materiales', exact: true }).waitFor();
    await page.locator('.home-start').click();
    await page.locator('#homeRosterTitle').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS Inicio: aligned stacked cards, independent controls, persistence, keyboard, navigation and full calendar.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
