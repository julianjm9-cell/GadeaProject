const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => route.fulfill({contentType:'application/json',body:JSON.stringify(route.request().url().endsWith('/api/me') ? {user:{name:'Revision comunicacion'}} : {})}));
    await page.goto('http://127.0.0.1:8770/apps/e25/index.html');
    await page.waitForFunction(() => Object.keys(MODEL_UNITS || {}).length === 65);
    const expected = {
      'len-literatura':['narrativa','metafora','Romanticismo','valoracion'],
      'len-textos-vida':['solicitud','advertencia','consentimiento','adjunto'],
      'len-medios':['titular','opinion','urgencia','fuentes independientes'],
      'len-comentario':['tema','estructura','imperativos','valoracion'],
      'len-presentacion':['margenes','tildes','coherente','archivo'],
      'ing-vocabulary':['chunks','collocations','appointment','context'],
      'ing-grammar':['present simple','going to','must not','conditional'],
      'ing-writing':['personal description','routine','informal email','opinion'],
      'ing-listening':['question word','numbers','directions','workplace'],
      'ing-dialogues':['transaction','symptoms','booking','Politeness'],
      'ing-forms':['Given name','date format','Signs','short message'],
      'ing-connectors':['Connectors','Sentence order','paragraph','final check'],
      'ing-exam-strategy':['Skimming','Scanning','word','review'],
      'ing-reading':['main idea','key word','true','infer']
    };
    for (const [id,terms] of Object.entries(expected)) {
      const unit = await page.evaluate(id => MODEL_UNITS[id],id);
      assert.equal(unit.label,'Unidad revisada en profundidad');
      assert.equal(unit.lessons.length,4);
      assert.equal(unit.questions.length,8);
      assert(unit.sourceLinks.length >= 2);
      terms.forEach((term,index) => assert.match(`${unit.lessons[index].theory} ${unit.lessons[index].exampleText} ${unit.lessons[index].solution}`,new RegExp(term,'i'),`${id}: ${term}`));
      await page.evaluate(id => { openModule(id.startsWith('ing-') ? 'ingles' : 'lengua'); openTopic(id); openLesson(0); },id);
      assert.match(await page.locator('.model-badge').innerText(),/REVISADA EN PROFUNDIDAD/i);
      assert.equal(await page.locator('.model-learning-block').count(),4);
      await page.getByRole('button',{name:'Practicar este tema: test con explicación'}).click();
      const questions = page.locator('#testBox .question');
      assert.equal(await questions.count(),8);
      for (let index=0; index<8; index++) {
        const correct = Number(await questions.nth(index).getAttribute('data-answer'));
        await questions.nth(index).locator('.answers button').nth(index === 0 ? (correct + 1) % 3 : correct).click();
      }
      await page.getByRole('button',{name:'Corregir test',exact:true}).click();
      assert.match(await page.locator('#testResult').innerText(),/7\/8/);
      assert.equal(await page.locator('.question-explanation').count(),8);
      assert.equal(await page.locator('.answer-wrong').count(),1);
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(() => { openModule('lengua'); openTopic('len-medios'); openLesson(3); });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({path:'tools/eso-comunicacion-profunda-mobile.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('ESO Comunicacion: catorce unidades y 112 preguntas revisadas en profundidad');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
