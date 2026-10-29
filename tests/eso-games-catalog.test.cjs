const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

test('los tres juegos de los 65 temas tienen soluciones visibles y unívocas', async () => {
  const browser = await chromium.launch({headless: true, channel: 'msedge'});
  try {
    const page = await browser.newPage();
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    await page.goto(pathToFileURL(resolve(__dirname, '../apps/e25/index.html')).href + '?demo=1');
    await page.waitForFunction(() => typeof MODULES !== 'undefined' && typeof MODEL_UNITS !== 'undefined' && typeof EsoAdultGames !== 'undefined');
    const issues = await page.evaluate(() => {
      const issues = [];
      const norm = value => String(value || '').trim().toLocaleLowerCase('es');
      const modules = MODULES.filter(module => !['exam', 'oficial'].includes(module.id));
      for (const module of modules) for (const topic of module.tasks) {
        const name = topic.id;
        const quiz = EsoAdultGames.topicQuiz(topic, module, MODEL_UNITS);
        if (quiz.length < 3) issues.push(`${name}: menos de tres preguntas`);
        for (const [i, question] of quiz.entries()) {
          if (!question.prompt.trim() || question.choices.length < 2 || question.correct < 0 || question.correct >= question.choices.length) issues.push(`${name}: pregunta ${i + 1} incompleta`);
          if (new Set(question.choices.map(norm)).size !== question.choices.length) issues.push(`${name}: pregunta ${i + 1} con opciones repetidas`);
        }
        const pairs = EsoAdultGames.topicPairs(topic, module);
        if (pairs.length < 6 || new Set(pairs.map(card => card.text.trim().toLocaleLowerCase('es'))).size !== pairs.length) issues.push(`${name}: parejas ambiguas`);
        const quest = EsoAdultGames.topicQuest(topic, module, MODEL_UNITS);
        if (['ingles','matematicas','lengua','geografia','historia','ciencias'].includes(module.id)) {
          if (quest?.mode !== 'story' || quest.stations.length !== 4 || !quest.title || !quest.brief) issues.push(`${name}: misión incompleta`);
          for (const [index, stage] of (quest?.stations || []).entries()) {
            if (!stage.place || !stage.context || !stage.prompt || !stage.explanation || stage.correct < 0 || stage.correct >= stage.choices.length || new Set(stage.choices.map(norm)).size !== 3) issues.push(`${name}: etapa ${index + 1} ambigua`);
          }
        } else if (!quest || quest.stations.length !== 3 || new Set(quest.cards.map(card => norm(card.text))).size !== quest.cards.length) issues.push(`${name}: mapa ambiguo`);
        for (const kind of ['quiz', 'pairs', 'quest']) {
          try {
            startGame(topic.id, kind);
            if (!document.querySelector('.eso-game-run')) issues.push(`${name}: ${kind} no se abre`);
          } catch (error) {
            issues.push(`${name}: ${kind} falla al abrir: ${error.message}`);
          }
        }
      }
      return issues;
    });
    assert.deepEqual(issues, []);
    assert.deepEqual(browserErrors, []);
  } finally {
    await browser.close();
  }
});
