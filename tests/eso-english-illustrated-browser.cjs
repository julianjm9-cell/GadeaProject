const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');

const missions = ['ing-reading', 'ing-vocabulary', 'ing-grammar', 'ing-writing'];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const [width, height] of [[1366, 768], [1024, 768], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve('apps/e25/index.html')).href + '?demo=1');
      await page.waitForFunction(() => typeof startGame === 'function' && typeof EsoEnglishMissions === 'object');
      for (const id of missions) {
        await page.evaluate(id => startGame(id, 'quest'), id);
        const board = page.locator(`.eso-english-illustrated[data-mission="${id}"] .eso-math-board`);
        assert.equal(await board.count(), 1, `${id}: board`);
        assert.ok(await board.locator('.eso-math-backdrop').evaluate(img => img.complete && img.naturalWidth > 0), `${id}: art loaded`);
        const choices = board.locator('.eso-math-options button');
        assert.equal(await choices.count(), 3, `${id}: choices`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id}: horizontal overflow at ${width}`);
        const layout = await board.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const buttons = [...element.querySelectorAll('.eso-math-options button')].map(button => {
            const box = button.getBoundingClientRect();
            return { left: box.left, right: box.right, width: box.width, height: box.height, clippedText: button.scrollHeight > button.clientHeight + 2 };
          });
          const ticket = element.querySelector('.eso-math-ticket');
          return { board: { left: rect.left, right: rect.right }, buttons, ticketClipped: ticket.scrollHeight > ticket.clientHeight + 2 };
        });
        assert.ok(layout.buttons.every(button => button.left >= layout.board.left - 2 && button.right <= layout.board.right + 2 && button.width >= 65 && !button.clippedText), `${id}: clipped answers at ${width}: ${JSON.stringify(layout)}`);
        assert.ok(!layout.ticketClipped, `${id}: clipped question at ${width}`);
        await page.screenshot({ path: path.resolve(`tmp/eso-english-scene-${id}-${width}.png`) });
        const correct = await page.evaluate(id => EsoEnglishMissions[id].stages[0].correct, id);
        await choices.nth((correct + 1) % 3).click();
        assert.equal(await board.locator('.eso-math-options button.wrong:disabled').count(), 1, `${id}: wrong state`);
        await choices.nth(correct).click();
        assert.equal(await board.getAttribute('data-solved'), 'true', `${id}: solved state`);
        await page.getByRole('button', { name: /Siguiente etapa/ }).click();
        assert.equal(await board.getAttribute('data-stage'), '2', `${id}: next stage`);
        for (let step = 1; step < 4; step++) {
          const clipped = await board.evaluate(element => {
            const ticket = element.querySelector('.eso-math-ticket');
            return ticket.scrollHeight > ticket.clientHeight + 2 || [...element.querySelectorAll('.eso-math-options button')].some(button => button.scrollHeight > button.clientHeight + 2);
          });
          assert.ok(!clipped, `${id}: clipped text in stage ${step + 1} at ${width}`);
          const nextCorrect = await page.evaluate(({ id, step }) => EsoEnglishMissions[id].stages[step].correct, { id, step });
          await choices.nth(nextCorrect).click();
          await page.getByRole('button', { name: /Siguiente etapa|Ver resultado/ }).click();
        }
        assert.equal(await page.locator('.eso-game-result').count(), 1, `${id}: final result`);
      }
      assert.deepEqual(errors, [], `page errors ${width}`);
      await page.close();
    }
    console.log('PASS four illustrated ESO English missions on desktop, tablet and mobile');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
