const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

test('las doce misiones de Matemáticas cargan y se completan con corrección y progreso', async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:850}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(resolve(__dirname,'../apps/e25/index.html')).href + '?demo=1');
    await page.waitForFunction(() => typeof startGame === 'function' && typeof EsoMathMissions === 'object');
    const topicIds = Object.keys(await page.evaluate(() => EsoMathMissions));
    assert.equal(topicIds.length,12);
    for (const topicId of topicIds) {
      await page.evaluate(id => startGame(id,'quest'),topicId);
      assert.equal(await page.locator('.eso-math-run .eso-mission-steps span').count(),4,`${topicId}: etapas`);
      const art = page.locator('.eso-mission-backdrop');
      assert.equal(await art.evaluate(image => image.complete && image.naturalWidth > 0),true,`${topicId}: imagen`);
      const answers = await page.evaluate(id => EsoMathMissions[id].stages.map(stage => stage.correct),topicId);
      for (const answer of answers) {
        await page.locator('.eso-mission-choices button').nth(answer).click();
        assert.match(await page.locator('.eso-mission-feedback').innerText(),/Correcto/,`${topicId}: corrección`);
        await page.getByRole('button',{name:/Siguiente etapa|Ver resultado/}).click();
      }
      assert.match(await page.locator('.eso-game-result').innerText(),/100 %/,`${topicId}: resultado`);
      assert.equal(await page.evaluate(id => state.gameResults[id]?.quest?.best,topicId),100,`${topicId}: progreso`);
      if (topicId === 'mat-geometria') await page.screenshot({path:resolve(__dirname,'../tmp/eso-math-mission-result.png')});
    }
    await page.evaluate(() => startGame('mat-proporciones','quest'));
    await page.screenshot({path:resolve(__dirname,'../tmp/eso-math-mission-desktop.png')});
    const wrong = await page.evaluate(() => (EsoMathMissions['mat-proporciones'].stages[0].correct + 1) % 3);
    await page.locator('.eso-mission-choices button').nth(wrong).click();
    assert.equal(await page.locator('.eso-mission-choices button.wrong:disabled').count(),1,'fallo marcado y bloqueado');
    assert.match(await page.locator('.eso-mission-feedback').innerText(),/no encaja/);
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(() => startGame('mat-medida','quest'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),true,'sin desbordamiento horizontal en móvil');
    await page.screenshot({path:resolve(__dirname,'../tmp/eso-math-mission-mobile.png')});
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
  }
});
