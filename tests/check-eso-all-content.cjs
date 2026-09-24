const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => route.fulfill({contentType:'application/json',body:JSON.stringify(route.request().url().endsWith('/api/me') ? {user:{name:'Auditoria'}} : {})}));
    await page.goto('http://127.0.0.1:8770/apps/e25/index.html');
    await page.waitForFunction(() => typeof MODEL_UNITS === 'object' && Object.keys(MODEL_UNITS).length === 65);

    const report = await page.evaluate(() => {
      const subjects = MODULES.filter(module => ['lengua','ingles','geografia','historia','matematicas','ciencias'].includes(module.id));
      return subjects.flatMap(module => module.tasks.map(topic => {
        const unit = MODEL_UNITS[topic.id];
        return {
          module:module.id,
          id:topic.id,
          lessons:unit?.lessons?.length || 0,
          questions:unit?.questions?.length || 0,
          sources:unit?.sourceLinks?.length || 0,
          theoryMin:Math.min(...(unit?.lessons || []).map(lesson => lesson.theory.length)),
          uniqueQuestions:new Set((unit?.questions || []).map(question => question[0])).size
        };
      }));
    });
    assert.equal(report.length,65);
    report.forEach(topic => {
      assert.equal(topic.lessons,4,`${topic.id}: lecciones`);
      assert(topic.questions >= 8,`${topic.id}: preguntas`);
      assert(topic.sources >= 1,`${topic.id}: fuentes`);
      assert(topic.theoryMin >= 180,`${topic.id}: teoria demasiado breve`);
      assert.equal(topic.uniqueQuestions,topic.questions,`${topic.id}: preguntas repetidas`);
    });

    for (const topic of report) {
      await page.evaluate(({module,id}) => { openModule(module); openTopic(id); openLesson(0); },topic);
      assert.equal(await page.locator('.model-learning-block').count(),4,topic.id);
      assert(await page.locator('.topic-resource-list a').count() >= 1,topic.id);
      await page.evaluate(id => openTopicPractice(id),topic.id);
      assert(await page.locator('#testBox .question').count() >= 8,topic.id);
    }

    for (const width of [390,768,1440]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(() => { openModule('ciencias'); openTopic('cie-digitalizacion'); openLesson(3); });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),`desbordamiento ${width}px`);
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.evaluate(() => { openModule('geografia'); openTopic('geo-relieve'); openLesson(0); });
    await page.screenshot({path:'tools/eso-contenido-completo.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('ESO completa: 65 temas, 260 lecciones y al menos 520 preguntas verificadas');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
