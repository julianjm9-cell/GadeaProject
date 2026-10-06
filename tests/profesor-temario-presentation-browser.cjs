const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href + '#temario');
    await page.locator('.temario-controls').waitFor();
    const audit = await page.evaluate(() => {
      const host = document.createElement('div'); document.body.append(host);
      host.innerHTML = temarioRichText('**Clave**: 3/4; √(3² + 4²); v₀; x^2.');
      const notation = { fractions: host.querySelectorAll('mfrac').length, roots: host.querySelectorAll('msqrt').length, powers: host.querySelectorAll('msup').length, subs: host.querySelectorAll('msub').length, bold: host.querySelectorAll('strong').length };
      host.innerHTML = temarioRichText('<img src=x onerror=alert(1)> **seguro**');
      const safe = !host.querySelector('img') && host.textContent.includes('<img');
      host.innerHTML = temarioRichText('x + y = 5; x − y = 1 → 2x = 6 → x = 3, y = 2');
      const system = host.querySelectorAll('.topic-system>span').length;
      const stages = host.querySelectorAll('.topic-equation-stack>span').length;
      host.innerHTML = temarioRichText('lim x→2 de x + 3');
      const limit = !host.querySelector('.topic-equation-stack,.topic-concept-flow') && host.textContent.includes('x→2');
      host.remove();
      let resources = 0; const failures = [];
      const original = JSON.stringify(PROFESOR_TEMARIO);
      for (const [course, subjects] of Object.entries(PROFESOR_TEMARIO)) for (const [subject, topics] of Object.entries(subjects)) for (const topic of topics) {
        temarioCourse = course; temarioSubject = subject;
        for (const kind of ['scheme', 'examples', 'practice']) {
          openTopicResource(topic, kind);
          const view = document.querySelector('.topic-resource-view');
          if (!view || view.textContent.includes('undefined') || !view.querySelector('.lesson-card')) failures.push(topic.id + ':' + kind);
          if (kind === 'examples' && view.querySelectorAll('.lesson-example').length !== topic.didactic.examples.length) failures.push(topic.id + ':missing-example');
          if (kind === 'practice' && view.querySelectorAll('.temario-lesson-practice').length !== topic.didactic.practice.length) failures.push(topic.id + ':missing-practice');
          resources++; document.querySelector('dialog').close();
        }
      }
      return { notation, safe, system, stages, limit, resources, failures, unchanged: original === JSON.stringify(PROFESOR_TEMARIO) };
    });
    assert.deepEqual(audit.notation, { fractions: 1, roots: 1, powers: 3, subs: 1, bold: 1 });
    assert.equal(audit.safe, true); assert.equal(audit.system, 2); assert.equal(audit.stages, 3); assert.equal(audit.limit, true);
    assert.equal(audit.resources, 1053); assert.deepEqual(audit.failures, []); assert.equal(audit.unchanged, true);
    const copies = await page.evaluate(() => {
      temarioCourse='3.º ESO';temarioSubject='Matemáticas';
      const topic=PROFESOR_TEMARIO[temarioCourse][temarioSubject][0], before=JSON.stringify(topic);
      const prepared=preparedTopicMaterial(topic);
      prepared.activity.questions[1].optionFeedback[0].explanation='Edición local';
      const detached=JSON.stringify(topic)===before;
      savePreparedTopicMaterial(topic);
      const saved=state.library.at(-1);
      saved.activity.questions[0].prompt='Mi ejercicio';
      return {detached,unchanged:JSON.stringify(topic)===before,version:saved.activity.context.preparedRevision,distinct:saved.id!==prepared.id&&saved.activity.questions[0].id!==topic.didactic.preparedMaterial.questions[0].id};
    });
    assert.deepEqual(copies,{detached:true,unchanged:true,version:'2026-10-06',distinct:true});
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => { temarioCourse = '3.º ESO'; temarioSubject = 'Matemáticas'; openTemarioLesson(PROFESOR_TEMARIO[temarioCourse][temarioSubject].find(t => t.title === 'Geometría básica')); });
      assert.equal(await page.locator('.topic-diagram svg').count(), 1);
      assert.equal(await page.locator('msqrt').count() > 0, true);
      assert.equal(await page.locator('#dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 2), true);
      await page.locator('.topic-diagram').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join('tools', `temario-notation-${width}.png`) });
      await page.locator('#dialog .close').click();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: 1053 resource views, safe math notation, systems, diagrams, responsive layout; catalogue unchanged');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
