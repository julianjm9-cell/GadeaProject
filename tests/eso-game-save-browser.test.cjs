const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

test('un juego solo confirma el guardado tras respuesta del servidor y permite reintentar', async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(resolve(__dirname, '../apps/e25/index.html')).href + '?demo=1');
    await page.waitForFunction(() => typeof startGame === 'function' && typeof EsoAdultGames !== 'undefined');
    await page.evaluate(() => {
      saveState = () => new Promise(done => { window.finishGameSave = done; });
      grantGamificationReward = async () => ({});
      startGame('mat-numeros', 'quiz');
      const module = MODULES.find(item => item.id === 'matematicas');
      const topic = module.tasks.find(item => item.id === 'mat-numeros');
      const questions = EsoAdultGames.topicQuiz(topic, module, MODEL_UNITS);
      for (const question of questions) {
        chooseGameAnswer(question.correct);
        nextGameRound();
      }
    });
    assert.match(await page.locator('.eso-game-result').innerText(), /Guardando tu resultado/);
    await page.evaluate(() => finishGameSave(false));
    await page.getByRole('button', {name:'Reintentar guardado'}).waitFor();
    assert.doesNotMatch(await page.locator('.eso-game-result').innerText(), /resultado está guardado/);
    await page.getByRole('button', {name:'Reintentar guardado'}).click();
    await page.evaluate(() => finishGameSave(true));
    await page.getByText('Tu resultado está guardado.').waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
