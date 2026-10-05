const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1905, height: 918 } });
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await page.evaluate(() => { state.students = state.students.slice(0, 2); state.students[1].subjects=['Matemáticas','Lengua','Inglés','Ciencias Naturales','Física y Química','Geografía e Historia']; state.students[1].notes=''; homeAgendaMode = 'calendar'; calendarScale = 'month'; render(); });
    await page.locator('.home-calendar-grid.month').waitFor();
    const metrics = await page.evaluate(() => {
      const rect = selector => { const { x, y, width, height, bottom, right } = document.querySelector(selector).getBoundingClientRect(); return { x, y, width, height, bottom, right }; };
      return { cards: [...document.querySelectorAll('.home-student-card')].map(el => { const { x, y, width, height, right } = el.getBoundingClientRect(); return { x, y, width, height, right }; }), subjects: rect('.home-student-card .subject-tags'), next: rect('.home-student-card .home-next-label'), roster: rect('.home-roster'), side: rect('.home-side'), panel: rect('.home-side .home-panel'), calendar: rect('.home-calendar-grid.month'), lastDay: rect('.home-calendar-grid.month .home-calendar-day:last-child') };
    });
    await page.screenshot({ path: 'tools/profesor-home-cards-calendar.png' });
    assert.equal(metrics.cards.length, 2);
    assert.equal(metrics.cards[0].height, metrics.cards[1].height, 'student cards keep the same height');
    assert.equal(metrics.cards[1].x, metrics.cards[0].x, 'student cards stack in one column');
    assert.ok(metrics.cards[1].y > metrics.cards[0].y + metrics.cards[0].height, 'student cards have a gap');
    assert.ok(metrics.cards[1].right <= metrics.side.x - 12, 'cards finish before calendar');
    assert.ok(metrics.cards[0].width < 1100 && metrics.cards[0].height <= 145, 'cards use a narrower, denser layout');
    const subjectColors = await page.locator('.home-student-card').nth(1).locator('.subject-tags .badge').evaluateAll(tags => tags.map(tag => getComputedStyle(tag).backgroundColor));
    assert.equal(new Set(subjectColors).size, subjectColors.length, 'each listed subject has its own color');
    assert.ok(metrics.next.x > metrics.subjects.right, 'subjects and next class use separate columns');
    assert.ok(metrics.lastDay.bottom <= metrics.panel.bottom - 12, 'whole month stays inside calendar panel');
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.evaluate(() => { for (let offset = 0; offset < 12; offset++) { monthOffset = offset; if (monthDays().length === 42) break; } render(); });
    const sixWeekMonth = await page.evaluate(() => ({ days: document.querySelectorAll('.home-calendar-grid.month .home-calendar-day').length, lastBottom: document.querySelector('.home-calendar-grid.month .home-calendar-day:last-child').getBoundingClientRect().bottom, panelBottom: document.querySelector('.home-side .home-panel').getBoundingClientRect().bottom }));
    assert.equal(sixWeekMonth.days, 42);
    assert.ok(sixWeekMonth.lastBottom <= sixWeekMonth.panelBottom - 12, 'six-week month stays inside calendar panel');
    await page.screenshot({ path: 'tools/profesor-home-cards-calendar-1366.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-action="homeMobilePanel"][data-id="classes"]').click();
    const mobile = await page.evaluate(() => { const panel = document.querySelector('.home-side .home-panel'); const day = document.querySelector('.home-calendar-grid.month .home-calendar-day:last-child'); panel.scrollTop = panel.scrollHeight; return { canScroll: panel.scrollHeight > panel.clientHeight, dayBottom: day.getBoundingClientRect().bottom, panelBottom: panel.getBoundingClientRect().bottom, pageWidth: document.documentElement.scrollWidth }; });
    assert.ok(mobile.dayBottom <= mobile.panelBottom, 'last calendar week can be reached on mobile');
    assert.ok(mobile.pageWidth <= 392, 'mobile has no horizontal page overflow');
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.locator('.home-student-card').first().getByRole('button', { name: /Cambiar color/ }).click();
    assert.equal(await page.locator('input[name="cardColor"]').count(), 8, 'the expanded palette is available');
    await page.locator('input[name="cardColor"][value="peach"]').check();
    await page.getByRole('button', { name: 'Guardar color' }).click();
    assert.equal(await page.locator('.home-student-card').first().getAttribute('data-card-color'), 'peach');
    await page.evaluate(() => { view='Alumnos'; render(); });
    assert.equal(await page.locator('.workspace-students .home-student-card').first().getAttribute('data-card-color'), 'peach', 'Alumnos shares the chosen color');
    assert.equal(await page.locator('.workspace-students .home-student-card').evaluateAll(cards => new Set(cards.map(card => card.getBoundingClientRect().height)).size), 1, 'Alumnos cards keep a uniform height');
    await page.screenshot({path:'tools/profesor-uniform-student-cards.png'});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('.workspace-students .home-student-card').evaluateAll(cards => new Set(cards.map(card => card.getBoundingClientRect().height)).size), 1, 'mobile cards keep a uniform height');
    assert.equal(await page.locator('.workspace-students .home-student-card').nth(1).locator('.subject-tags').evaluate(el=>{el.scrollLeft=el.scrollWidth;const last=el.lastElementChild.getBoundingClientRect();return last.right<=el.getBoundingClientRect().right+1}),true,'all subjects remain reachable without enlarging the card');
    await page.locator('.workspace-students .home-student-card').first().click();
    assert.equal(await page.locator('.student-overview').getAttribute('data-card-color'), null, 'the custom color is limited to student cards');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
