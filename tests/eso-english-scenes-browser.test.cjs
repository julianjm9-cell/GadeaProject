const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const englishTopics = [
  'ing-reading', 'ing-vocabulary', 'ing-grammar', 'ing-writing', 'ing-listening',
  'ing-dialogues', 'ing-forms', 'ing-connectors', 'ing-exam-strategy',
];

test('los nueve temas de Inglés muestran escenas utilizables en los tres juegos', async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:850}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(resolve(__dirname, '../apps/e25/index.html')).href + '?demo=1');
    await page.waitForFunction(() => typeof startGame === 'function' && typeof EsoAdultGames?.englishScene === 'function');

    for (const topicId of englishTopics) {
      for (const mode of ['quiz', 'pairs', 'quest']) {
        await page.evaluate(([id, kind]) => startGame(id, kind), [topicId, mode]);
        assert.equal(await page.locator('.eso-english-run').count(), 1, `${topicId}: ${mode}`);
        const art = page.locator(mode === 'quest' ? '.eso-mission-backdrop' : '.eso-english-backdrop');
        assert.equal(await art.evaluate(image => image.complete && image.naturalWidth > 0), true, `${topicId}: imagen ${mode}`);
        if (mode === 'quest') {
          assert.equal(await page.locator('.eso-mission-steps span').count(), 4, `${topicId}: cuatro etapas`);
          assert.equal(await page.locator('.eso-mission-choices button').count(), 3, `${topicId}: tres opciones`);
        }
      }
    }

    await page.evaluate(() => startGame('ing-reading', 'quiz'));
    const answer = await page.evaluate(() => {
      const module = MODULES.find(item => item.id === 'ingles');
      return EsoAdultGames.topicQuiz(module.tasks[0], module, MODEL_UNITS)[0].correct;
    });
    await page.locator('.eso-english-run .eso-game-options button').nth(answer).click();
    assert.match(await page.locator('.eso-game-feedback').innerText(), /Correcto/);
    await page.getByRole('button', {name:/Siguiente ronda|Ver resultado/}).click();

    await page.evaluate(() => startGame('ing-reading', 'pairs'));
    await page.locator('.eso-english-run .eso-game-pairs button').first().click();
    assert.equal(await page.locator('.eso-english-run .eso-game-pairs button.revealed').count(), 1);

    await page.evaluate(() => startGame('ing-reading', 'quest'));
    await page.screenshot({path:resolve(__dirname,'../tmp/eso-english-mission-desktop.png')});
    await page.locator('.eso-mission-choices button').first().click();
    assert.match(await page.locator('.eso-mission-feedback').innerText(), /no encaja/i);
    assert.equal(await page.locator('.eso-mission-choices button.wrong').count(), 1);
    await page.locator('.eso-mission-choices button').nth(1).click();
    assert.match(await page.locator('.eso-mission-feedback').innerText(), /Correcto/);
    await page.getByRole('button', {name:/Siguiente etapa/}).click();
    assert.equal(await page.locator('.eso-mission-steps span.complete').count(), 1);

    await page.setViewportSize({width:390,height:844});
    await page.evaluate(() => startGame('ing-dialogues', 'quiz'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'sin desbordamiento horizontal en móvil');
    await page.evaluate(() => startGame('ing-dialogues', 'quest'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'misión sin desbordamiento horizontal en móvil');
    await page.screenshot({path:resolve(__dirname,'../tmp/eso-english-mission-mobile.png')});
    await page.setViewportSize({width:1280,height:850});
    for (const topicId of englishTopics) {
      await page.evaluate(id => startGame(id, 'quest'), topicId);
      const answers = await page.evaluate(id => EsoEnglishMissions[id].stages.map(stage => stage.correct), topicId);
      for (const answer of answers) {
        await page.locator('.eso-mission-choices button').nth(answer).click();
        await page.getByRole('button', {name:/Siguiente etapa|Ver resultado/}).click();
      }
      assert.match(await page.locator('.eso-game-result').innerText(), /100 %/, `${topicId}: resultado de la misión`);
      assert.equal(await page.evaluate(id => state.gameResults[id]?.quest?.best, topicId), 100, `${topicId}: resultado registrado`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
