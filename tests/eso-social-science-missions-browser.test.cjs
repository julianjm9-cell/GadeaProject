const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

test('las 33 misiones sociales y científicas se ven, corrigen y guardan el progreso', async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:850}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(resolve(__dirname,'../apps/e25/index.html')).href + '?demo=1');
    await page.waitForFunction(() => typeof startGame === 'function' && typeof EsoScienceMissions === 'object');
    for (const [catalogName,cssClass,count] of [
      ['EsoGeographyMissions','eso-geo-run',10],
      ['EsoHistoryMissions','eso-history-run',11],
      ['EsoScienceMissions','eso-science-run',12],
    ]) {
      const ids = await page.evaluate(name => Object.keys(window[name]),catalogName);
      assert.equal(ids.length,count,`${catalogName}: temas`);
      for (const topicId of ids) {
        await page.evaluate(id => startGame(id,'quest'),topicId);
        assert.equal(await page.locator(`.${cssClass} .eso-mission-steps span`).count(),4,`${topicId}: etapas`);
        assert.equal(await page.locator('.eso-mission-backdrop').evaluate(image => image.complete && image.naturalWidth > 0),true,`${topicId}: imagen`);
        const answers = await page.evaluate(([name,id]) => window[name][id].stages.map(stage => stage.correct),[catalogName,topicId]);
        for (const answer of answers) {
          await page.locator('.eso-mission-choices button').nth(answer).click();
          assert.match(await page.locator('.eso-mission-feedback').innerText(),/Correcto/,`${topicId}: corrección`);
          await page.getByRole('button',{name:/Siguiente etapa|Ver resultado/}).click();
        }
        assert.match(await page.locator('.eso-game-result').innerText(),/100 %/,`${topicId}: resultado`);
        assert.equal(await page.evaluate(id => state.gameResults[id]?.quest?.best,topicId),100,`${topicId}: progreso`);
      }
    }
    await page.evaluate(() => startGame('geo-mapas','quest'));
    const wrong = await page.evaluate(() => (EsoGeographyMissions['geo-mapas'].stages[0].correct + 1) % 3);
    await page.locator('.eso-mission-choices button').nth(wrong).click();
    assert.equal(await page.locator('.eso-mission-choices button.wrong:disabled').count(),1,'error marcado sin cerrar la misión');
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(() => startGame('cie-proyecto','quest'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),true,'sin desbordamiento horizontal móvil');
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
  }
});
