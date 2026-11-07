const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {readFileSync} = require('node:fs');
const {chromium,webkit} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browserType = process.env.CAMBRIDGE_BROWSER === 'webkit' ? webkit : chromium;
const launchOptions = process.env.CAMBRIDGE_BROWSER === 'webkit' ? {headless:true} : {headless:true,channel:'msedge'};

test('dos pestañas conservan copias separadas si una guardó primero', async () => {
  const browser = await browserType.launch(launchOptions);
  try {
    const context = await browser.newContext();
    const html = readFileSync(resolve(__dirname,'../apps/cambridge/index.html'),'utf8');
    let serverState = {};
    let etag = '"cambridge-test-0"';
    let posts = 0;
    let startFirst;
    let releaseFirst;
    let completeFirst;
    const firstStarted = new Promise(resolve => { startFirst = resolve; });
    const firstHold = new Promise(resolve => { releaseFirst = resolve; });
    const firstCompleted = new Promise(resolve => { completeFirst = resolve; });
    await context.route('http://cambridge.test/**',async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/cambridge') return route.fulfill({status:200,contentType:'text/html',body:html});
      if (path === '/api/status') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,user:{id:77,name:'Prueba'}})});
      if (path === '/api/state' && request.method() === 'GET') return route.fulfill({status:200,contentType:'application/json',headers:{ETag:etag},body:JSON.stringify(serverState)});
      if (path === '/api/state' && request.method() === 'POST') {
        const order = ++posts;
        if (order === 1) { startFirst(); await firstHold; }
        if (order === 2) await firstCompleted;
        if (request.headers()['if-match'] !== etag) return route.fulfill({status:409,contentType:'application/json',body:'{}'});
        serverState = request.postDataJSON();
        etag = '"cambridge-test-1"';
        if (order === 1) completeFirst();
        return route.fulfill({status:200,contentType:'application/json',headers:{ETag:etag},body:'{"ok":true}'});
      }
      return route.fulfill({status:404,body:''});
    });
    const first = await context.newPage();
    const second = await context.newPage();
    await Promise.all([first.goto('http://cambridge.test/cambridge'),second.goto('http://cambridge.test/cambridge')]);
    await Promise.all([first.waitForFunction(() => cambridgeStateETag !== null),second.waitForFunction(() => cambridgeStateETag !== null)]);
    const firstSave = first.evaluate(() => { state.writingPractice.answer = 'Borrador de la primera pestaña'; return persist(); });
    await firstStarted;
    const secondSave = second.evaluate(() => { state.writingPractice.answer = 'Borrador de la segunda pestaña'; return persist(); });
    await second.waitForFunction(() => cambridgePendingEntries().length === 2);
    releaseFirst();
    assert.equal(await firstSave,true);
    assert.equal(await secondSave,false);
    assert.equal(serverState.writingPractice.answer,'Borrador de la primera pestaña');
    assert.deepEqual(await second.evaluate(() => cambridgePendingEntries().map(({pending}) => pending.snapshot.writingPractice.answer)),['Borrador de la segunda pestaña']);
    await second.reload();
    await second.waitForFunction(() => document.getElementById('cambridgeSaveStatus').textContent.includes('versión diferente'));
    assert.equal(await second.getByRole('button',{name:'Descargar copia'}).count(),1);
    assert.equal(await second.getByRole('button',{name:'Recuperar borrador'}).count(),0);
  } finally {
    await browser.close();
  }
});

test('Inglés bloquea el guardado si no puede identificar la cuenta', async () => {
  const browser = await browserType.launch(launchOptions);
  try {
    const context = await browser.newContext();
    const html = readFileSync(resolve(__dirname,'../apps/cambridge/index.html'),'utf8');
    let saves = 0;
    await context.route('http://cambridge.test/**',route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/cambridge') return route.fulfill({status:200,contentType:'text/html',body:html});
      if (path === '/api/status') return route.fulfill({status:503,contentType:'application/json',body:'{}'});
      if (path === '/api/state' && route.request().method() === 'GET') return route.fulfill({status:200,contentType:'application/json',headers:{ETag:'"cambridge-test-0"'},body:'{}'});
      if (path === '/api/state' && route.request().method() === 'POST') saves++;
      return route.fulfill({status:404,body:''});
    });
    const page = await context.newPage();
    await page.goto('http://cambridge.test/cambridge');
    await page.waitForFunction(() => cambridgeStateETag !== null);
    assert.equal(await page.evaluate(() => cambridgeSaveBlocked),true);
    assert.equal(await page.evaluate(() => { state.writingPractice.answer = 'No debe enviarse sin cuenta'; return persist(); }),false);
    assert.equal(saves,0);
    assert.match(await page.locator('#cambridgeSaveStatus').innerText(),/identificar tu cuenta|carga o la versión/i);
  } finally {
    await browser.close();
  }
});

test('Writing conserva el borrador y el destino del OCR al recargar', async () => {
  const browser = await browserType.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(__dirname,'../apps/cambridge/index.html')).href);
    await page.waitForFunction(() => typeof runWritingOcr === 'function');
    await page.evaluate(() => {
      showTab('escrita');
      backendRequest = async path => {
        if (path !== '/api/ocr') throw new Error(`Unexpected endpoint: ${path}`);
        return {text:'Write about a memorable journey.'};
      };
    });
    await page.locator('#writingAnswer').fill('My original answer.');
    await page.locator('#writingImageInput').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/iXsAAAAASUVORK5CYII=','base64')});
    await page.waitForFunction(() => writingImageDataUrl.startsWith('data:image/png'));
    await page.getByRole('button',{name:'Detectar texto'}).click();
    assert.equal(await page.locator('#writingOcrReview').inputValue(),'Write about a memorable journey.');
    await page.locator('#writingOcrReview').fill('Write about a journey you remember.');
    await page.locator('#writingOcrTarget').selectOption('prompt');
    await page.reload();
    await page.waitForFunction(() => typeof renderWritingPractice === 'function');
    await page.evaluate(() => showTab('escrita'));
    assert.equal(await page.locator('#writingOcrTarget').inputValue(),'prompt');
    assert.equal(await page.locator('#writingOcrReview').inputValue(),'Write about a journey you remember.');
    await page.getByRole('button',{name:'Insertar texto revisado'}).click();
    assert.equal(await page.locator('#writingPrompt').inputValue(),'Write about a journey you remember.');
    assert.equal(await page.locator('#writingAnswer').inputValue(),'My original answer.');
  } finally {
    await browser.close();
  }
});

test('Speaking libera el micrófono y ofrece escritura si se deniega el permiso', async () => {
  const browser = await browserType.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(__dirname,'../apps/cambridge/index.html')).href);
    await page.waitForFunction(() => typeof startReciteRecording === 'function');
    const result = await page.evaluate(async () => {
      let stopped = false;
      const stream = {getTracks:() => [{stop:() => { stopped = true; }}]};
      Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async () => stream}});
      window.MediaRecorder = class {
        static isTypeSupported() { return true; }
        constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; }
        start() { this.state = 'recording'; }
        requestData() { this.ondataavailable({data:new Blob(['a'.repeat(2048)],{type:'audio/webm'})}); }
        stop() { this.state = 'inactive'; this.onstop(); }
      };
      const started = await startReciteRecording();
      const blob = await stopReciteRecording();
      reciteAudioBlob = null;
      Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async () => { throw new DOMException('Denied','NotAllowedError'); }}});
      const denied = await startReciteRecording();
      return {started,size:blob?.size,stopped,denied,status:document.getElementById('reciteStatus').textContent};
    });
    assert.equal(result.started,true);
    assert.ok(result.size >= 2048);
    assert.equal(result.stopped,true);
    assert.equal(result.denied,false);
    assert.match(result.status,/permiso|bloqueado/i);
  } finally {
    await browser.close();
  }
});

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

test('las diez misiones y dieciocho lecciones terminan y se reanudan por nivel', async () => {
  const browser = await browserType.launch(launchOptions);
  try {
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(resolve(__dirname,'../apps/cambridge/index.html')).href);
    await page.waitForFunction(() => typeof openB2Game === 'function');
    for (const level of ['B2 First','C1 Advanced','C2 Proficiency']) {
      await page.evaluate(value => setExamLevel(value),level);
      const lessons = await page.evaluate(() => englishRouteLessons().map(lesson => ({id:lesson.id,correct:lesson.correct,options:lesson.options})));
      assert.equal(lessons.length,6,`${level}: seis lecciones`);
      for (const lesson of lessons) {
        assert.equal(new Set(lesson.options).size,lesson.options.length,`${lesson.id}: respuestas distintas`);
        assert.ok(lesson.correct >= 0 && lesson.correct < lesson.options.length,`${lesson.id}: solución válida`);
        assert.ok(await page.evaluate(id => Boolean(B2_GAME_BY_LESSON[id] && englishRouteGames().some(game => game.id === B2_GAME_BY_LESSON[id])),lesson.id),`${lesson.id}: juego relacionado`);
        await page.evaluate(id => openB2Lesson(id),lesson.id);
        await page.evaluate(({id,correct}) => answerB2Lesson(id,correct),lesson);
        assert.equal(await page.evaluate(id => state.b2Progress[id]?.completed,lesson.id),true,`${lesson.id}: lección completada`);
      }
      const ids = await page.evaluate(() => englishRouteGames().map(game => game.id));
      assert.equal(ids.length,level === 'B2 First' ? 6 : 2,`${level}: misiones`);
      for (const id of ids) {
        await page.evaluate(gameId => openB2Game(gameId),id);
        if (process.env.CAMBRIDGE_GAME_SCREENSHOT_DIR && ['c1-debate','c2-press'].includes(id)) await page.locator('#b2GameBoard').screenshot({path:resolve(process.env.CAMBRIDGE_GAME_SCREENSHOT_DIR,`${id}.png`)});
        assert.equal(await page.evaluate(async gameId => {
          const name = ENGLISH_GAME_ART[gameId];
          if (!name) return true;
          const image = new Image();
          image.src = cambridgeGameAsset(name);
          await image.decode();
          return image.naturalWidth > 0;
        },id),true,`${id}: fondo disponible`);
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
    await page.evaluate(() => { setExamLevel('C2 Proficiency'); openB2Game('c2-press'); });
    assert.equal(await page.locator('#b2GameBoard .b2-scene-option').count(),3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),true);
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
  }
});
