const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1905, height: 918 } });
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await page.evaluate(() => { state.students = state.students.slice(0, 2); homeAgendaMode = 'calendar'; calendarScale = 'month'; render(); });
    await page.locator('.home-calendar-grid.month').waitFor();
    const metrics = await page.evaluate(() => {
      const rect = selector => { const { x, y, width, height, bottom, right } = document.querySelector(selector).getBoundingClientRect(); return { x, y, width, height, bottom, right }; };
      return { cards: [...document.querySelectorAll('.home-student-card')].map(el => { const { x, y, width, height, right } = el.getBoundingClientRect(); return { x, y, width, height, right }; }), subjects: rect('.home-student-card .subject-tags'), next: rect('.home-student-card .home-next-label'), roster: rect('.home-roster'), side: rect('.home-side'), panel: rect('.home-side .home-panel'), calendar: rect('.home-calendar-grid.month'), lastDay: rect('.home-calendar-grid.month .home-calendar-day:last-child') };
    });
    await page.screenshot({ path: 'tools/profesor-home-cards-calendar.png' });
    assert.equal(metrics.cards.length, 2);
    assert.ok(metrics.cards[1].x > metrics.cards[0].x, 'two student cards fit side by side');
    assert.ok(metrics.cards[1].right <= metrics.side.x - 12, 'cards finish before calendar');
    assert.ok(metrics.next.y - metrics.subjects.bottom >= 12, 'subjects and next class have breathing room');
    assert.ok(metrics.next.x <= metrics.cards[0].x + 24, 'next class uses the full card width');
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
    await page.locator('input[name="cardColor"][value="peach"]').check();
    await page.getByRole('button', { name: 'Guardar color' }).click();
    assert.equal(await page.locator('.home-student-card').first().getAttribute('data-card-color'), 'peach');
    await page.locator('.home-primary-nav').getByRole('button', { name: 'Alumnos' }).click();
    assert.equal(await page.locator('.workspace-students .home-student-card').first().getAttribute('data-card-color'), 'peach', 'Alumnos shares the chosen color');
    await page.locator('.workspace-students .home-student-card').first().locator('.home-student-open').click();
    assert.equal(await page.locator('.student-overview').getAttribute('data-card-color'), 'peach', 'Resumen shares the chosen color');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
