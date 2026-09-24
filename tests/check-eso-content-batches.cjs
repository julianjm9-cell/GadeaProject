const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors = [];
    let saved = {};
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      let body = {};
      if (url.pathname === '/api/state') {
        if (route.request().method() === 'POST') saved = route.request().postDataJSON();
        else body = saved;
      }
      if (url.pathname === '/api/me') body = {user:{name:'Prueba de contenido'}};
      if (url.pathname === '/api/resources') body = {resources:[]};
      await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.goto('http://127.0.0.1:8770/apps/e25/index.html');
    await page.waitForFunction(() => document.querySelector('#moduleGrid .module-card'));
    const ids = ['len-resumen','len-ortografia','mat-algebra','len-gramatica','len-redaccion','len-argumentacion'];
    const content = await page.evaluate(ids => ids.map(id => ({id,...MODEL_UNITS[id]})),ids);
    for (const unit of content) {
      assert.equal(unit.lessons.length,4);
      assert.equal(unit.questions.length,8);
      assert(unit.sourceLinks.length);
      unit.lessons.forEach(lesson => {
        assert(lesson.theory.length > 180,unit.id);
        assert(lesson.exampleSteps.length >= 3);
        assert(lesson.solution.length > 50);
      });
    }
    const algebra = content.find(unit => unit.id === 'mat-algebra');
    assert.deepEqual(algebra.questions.map(q => q[1][q[2]]),['5x','2x - 6','14','x = 5','x = 8','x = 6, y = 3','No tiene solución','8 euros']);

    for (const id of ids) {
      const moduleId = id.startsWith('mat-') ? 'matematicas' : 'lengua';
      for (let lesson = 0; lesson < 4; lesson++) {
        await page.evaluate(({moduleId,id,lesson}) => { openModule(moduleId); openTopic(id); openLesson(lesson); },{moduleId,id,lesson});
        assert.equal(await page.locator('.model-learning-block').count(),4);
        assert(await page.locator('.topic-resource-list a').count() >= 2);
        assert.equal(await page.locator('.theory-card').innerText().then(text => text.includes('En esta leccion se trabaja')),false);
      }
      await page.getByRole('button',{name:'Practicar este tema: test con explicación'}).click();
      const questions = page.locator('#testBox .question');
      assert.equal(await questions.count(),8);
      const actual = await questions.evaluateAll(nodes => nodes.map(node => node.dataset.question));
      assert.deepEqual(actual,content.find(unit => unit.id === id).questions.map(q => q[0]));
      for (let i=0;i<8;i++) {
        const correct = Number(await questions.nth(i).getAttribute('data-answer'));
        await questions.nth(i).locator('.answers button').nth(i === 0 ? (correct + 1) % 3 : correct).click();
      }
      await page.getByRole('button',{name:'Corregir test',exact:true}).click();
      assert.match(await page.locator('#testResult').innerText(),/7\/8/);
      assert.equal(await page.locator('.question-explanation').count(),8);
      assert.equal(await page.locator('.answer-wrong').count(),1);
      assert.equal(await page.locator('.answer-correct').count(),8);
      await page.waitForFunction(id => state.testAttempts[id]?.ok === 7,`${moduleId}:${id}:0`);
    }
    await page.screenshot({path:'tools/eso-lotes-1-2-test.png',fullPage:true});
    await page.evaluate(() => { openModule('matematicas'); openTopic('mat-algebra'); openLesson(1); });
    await page.locator('.ai-notes-card summary').click();
    await page.locator('#lessonAiNotes').fill('Mis apuntes: hago la misma operación en ambos miembros y compruebo x = 8.');
    await page.getByRole('button',{name:'Guardar apuntes',exact:true}).click();
    const response = '2(x - 3) = 10; x - 3 = 5; x = 8. Comprobación: 2(8 - 3) = 10.';
    await page.locator('#modelEvidenceAnswer').fill(response);
    await page.locator('[data-evidence-check]').nth(0).check();
    await page.locator('[data-evidence-check]').nth(1).check();
    await page.getByRole('button',{name:'Guardar y continuar'}).click();
    assert.equal(await page.evaluate(() => state.activeLesson),2);
    await page.evaluate(() => saveState());
    await page.reload();
    await page.waitForFunction(() => state.learningEvidence && Object.keys(state.learningEvidence).length > 0);
    await page.evaluate(() => { openModule('matematicas'); openTopic('mat-algebra'); openLesson(1); });
    assert.equal(await page.locator('#modelEvidenceAnswer').inputValue(),response);
    await page.locator('.ai-notes-card summary').click();
    assert.match(await page.locator('#lessonAiNotes').inputValue(),/^Mis apuntes:/);
    assert.equal(await page.evaluate(() => state.testAttempts['lengua:len-resumen:0'].score),88);
    await page.screenshot({path:'tools/eso-lotes-1-2-algebra.png',fullPage:true});
    for (const width of [390,768]) {
      await page.setViewportSize({width,height:900});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'tools/eso-lotes-1-2-mobile.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('ESO lotes 1-2: 24 lecciones, 48 preguntas, corrección por tema y persistencia OK');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode=1;});
