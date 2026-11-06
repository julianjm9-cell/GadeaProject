const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium,webkit} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browserType = process.env.CAMBRIDGE_BROWSER === 'webkit' ? webkit : chromium;
const launchOptions = process.env.CAMBRIDGE_BROWSER === 'webkit' ? {headless:true} : {headless:true,channel:'msedge'};

test('el progreso de Inglés separa niveles, cuenta actividades únicas y explica errores', async () => {
  const browser = await browserType.launch(launchOptions);
  try {
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(resolve(__dirname,'../apps/cambridge/index.html')).href);
    await page.waitForFunction(() => typeof renderEnglishDashboard === 'function' && document.getElementById('englishRouteProgressCards'));
    await page.evaluate(() => {
      state.b2Progress = {'open-cloze':{completed:true,attempts:3}};
      state.b2Games = {opencloze:{completed:true,mistakes:1,errors:[{stage:0,answer:'for <script>alert(1)</script>'}],at:'2026-11-06T12:00:00Z'}};
      state.writingPractice.versions = [{id:'draft-1',level:'B2 First',answer:'A short response'}];
      state.recitePractice = {...state.recitePractice,correction:'<p>Revisión</p>',feedbackFor:JSON.stringify(['B2 First','prompt','','text']),lastReviewedAt:'2026-11-06T12:00:00Z'};
      state.listeningResults = [{id:'part-1',score:7}];
      state.listeningMockResults = [{id:'mock-1',score:23}];
      setExamLevel('B2 First');
      showTab('progreso');
    });
    assert.equal(await page.locator('.english-route-progress-card').count(),3);
    assert.equal(await page.locator('#englishHomeRouteProgress').innerText(),'1/6 lecciones completadas');
    assert.equal(await page.locator('#englishHomeGameProgress').innerText(),'1/6 juegos terminados');
    assert.match(await page.locator('.english-route-progress-card.current').innerText(),/2\/12 actividades distintas completadas/);
    assert.match(await page.locator('.english-route-progress-card.current').innerText(),/1 partida terminada/);
    assert.equal(await page.locator('.english-error-card').count(),1);
    assert.match(await page.locator('#englishPracticeProgress').innerText(),/1 versión guardada/);
    assert.match(await page.locator('#englishPracticeProgress').innerText(),/Última revisión guardada/);
    assert.match(await page.locator('#englishPracticeProgress').innerText(),/2 resultados guardados/);
    assert.match(await page.locator('#englishPracticeProgress').innerText(),/23\/30/);
    assert.match(await page.locator('.english-error-card').innerText(),/Respuesta: since/);
    assert.equal(await page.locator('.english-error-card script').count(),0);
    if (process.env.CAMBRIDGE_PROGRESS_SCREENSHOT) await page.screenshot({path:process.env.CAMBRIDGE_PROGRESS_SCREENSHOT,fullPage:true});
    await page.getByRole('button',{name:'Volver al juego →'}).click();
    assert.match(await page.locator('#b2GameBoard').innerText(),/El texto incompleto/);
    await page.evaluate(() => showTab('progreso'));
    await page.getByRole('button',{name:'Ver este nivel'}).first().click();
    assert.match(await page.locator('.english-route-progress-card.current h4').innerText(),/C1 Advanced/);
    assert.match(await page.locator('#englishErrorReview').innerText(),/Aún no hay errores/);
    assert.doesNotMatch(await page.locator('#englishPracticeProgress').innerText(),/Listening B2/);
    await page.evaluate(() => {
      state.b2GameRuns.opencloze = {stage:2,mistakes:0,errors:[]};
      activeB2Game = 'opencloze';
      activeB2Stage = 2;
      nextB2GameStage();
    });
    assert.equal(await page.evaluate(() => state.b2Games.opencloze.plays),2);
    assert.equal(await page.evaluate(() => state.b2Games.opencloze.mistakes),0);
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(() => showTab('progreso'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),true);
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
  }
});

test('las ocho misiones terminan, se reanudan y registran una sola actividad por juego', async () => {
  const browser = await browserType.launch(launchOptions);
  try {
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(resolve(__dirname,'../apps/cambridge/index.html')).href);
    await page.waitForFunction(() => typeof openB2Game === 'function');
    for (const level of ['B2 First','C1 Advanced','C2 Proficiency']) {
      await page.evaluate(value => setExamLevel(value),level);
      const ids = await page.evaluate(() => englishRouteGames().map(game => game.id));
      for (const id of ids) {
        await page.evaluate(gameId => openB2Game(gameId),id);
        const stages = await page.evaluate(gameId => englishRouteGame(gameId).stages.map(stage => ({correct:stage.correct,options:stage.options?.length,answer:stage.answers?.[0]})),id);
        for (let index=0; index<stages.length; index++) {
          const stage = stages[index];
          await page.evaluate(({correct,options,answer}) => {
            if (options) {
              answerB2Game((correct+1)%options);
              answerB2Game(correct);
            } else {
              document.getElementById('b2TypedAnswer').value = answer;
              answerB2Game();
            }
          },stage);
          assert.match(await page.locator('#b2GameFeedback').innerText(),/Correcto/);
          await page.evaluate(() => nextB2GameStage());
        }
        assert.equal(await page.evaluate(gameId => state.b2Games[gameId]?.completed,id),true,id);
        assert.equal(await page.evaluate(gameId => state.b2Games[gameId]?.plays,id),1,id);
      }
    }
    await page.evaluate(() => {
      setExamLevel('B2 First');
      openB2Game('editor');
      answerB2Game(0);
      nextB2GameStage();
    });
    await page.reload();
    await page.waitForFunction(() => typeof state !== 'undefined' && state.b2GameRuns?.editor?.stage === 1);
    await page.evaluate(() => openB2Game('editor'));
    assert.match(await page.locator('#b2GameBoard').innerText(),/etapa 2\/3/i);
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
  }
});

test('un juego se puede iniciar y avanzar con tacto y teclado en móvil', async () => {
  const browser = await browserType.launch(launchOptions);
  try {
    const page = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(resolve(__dirname,'../apps/cambridge/index.html')).href);
    await page.waitForFunction(() => typeof showTab === 'function');
    await page.evaluate(() => { setExamLevel('B2 First'); showTab('juegos'); });
    await page.locator('#b2GameList .b2-card').first().getByRole('button',{name:'Jugar'}).tap();
    await page.locator('#b2GameBoard [data-answer-index="0"]').tap();
    assert.match(await page.locator('#b2GameFeedback').innerText(),/Correcto/);
    await page.getByRole('button',{name:'Siguiente etapa →'}).focus();
    await page.keyboard.press('Enter');
    assert.match(await page.locator('#b2GameBoard').innerText(),/etapa 2\/3/i);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),true);
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
  }
});
