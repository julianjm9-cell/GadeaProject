const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/me') return route.fulfill({contentType:'application/json', body:'{"user":{"name":"Alumno"}}'});
    if (url.pathname === '/api/resources') return route.fulfill({contentType:'application/json', body:'{"resources":[]}'});
    return route.fulfill({contentType:'application/json', body:'{}'});
  });
  await page.goto('http://127.0.0.1:8770/apps/e25/index.html');
  await page.waitForTimeout(400);

  const totals = await page.evaluate(() => Object.fromEntries(Object.entries(OFFICIAL_SIMULATORS).map(([id,simulator]) => [id,simulator.sections.reduce((sum,section) => sum + section.points,0)])));
  assert.deepEqual(totals, {comunicacion:100,social:100,cientifico:100});

  await page.evaluate(() => { openModule('exam'); showOfficialSimulators(); });
  assert.equal(await page.locator('.official-sim-card').count(), 3);
  await page.screenshot({path:'tools/eso-simulacros-ambito.png', fullPage:true});
  await page.evaluate(() => startOfficialSimulator('comunicacion'));
  assert.equal(await page.locator('.official-rubric-row').count(), 5);
  assert.match(await page.locator('#examPrompt').inputValue(), /100 puntos/i);
  assert.match(await page.locator('#examPrompt').inputValue(), /50-70 words/i);

  await page.evaluate(() => {
    openModule('lengua'); openTopic('len-comprension'); openLesson(0);
    state.learningEvidence[evidenceKey('len-comprension',0)] = {response:'La idea principal explica que la biblioteca amplía el horario y ofrece una sala con reserva.',checks:[true,true,true],ready:true};
    const ctx = teacherContext();
    state.teacherChats[ctx.key] = [{role:'assistant',text:'## Revisión\n\n**Acierto:** has indicado la idea principal.\n\n| Criterio | Estado |\n| --- | --- |\n| Idea principal | Bien |'}];
    state.teacherOpen = true;
    renderTeacherPanel();
  });
  const brief = await page.evaluate(() => teacherContext().brief);
  assert.match(brief, /Evidencia del alumno:/);
  assert.match(brief, /Criterio:/);
  assert.match(await page.locator('.teacher-suggestions').innerText(), /Revisa mi evidencia/i);
  await page.getByRole('button', {name:'Ver respuesta ampliada'}).click();
  assert.equal(await page.locator('#teacherReadingModal table').count(), 1);
  assert.equal(await page.locator('#teacherReadingModal').isVisible(), true);
  await page.screenshot({path:'tools/eso-profesor-ia-ampliado.png', fullPage:true});
  await page.evaluate(() => closeTeacherAnswer());

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => { openModule('exam'); showOfficialSimulators(); });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, 'Simulacros desbordan en móvil');
  await page.screenshot({path:'tools/eso-simulacros-mobile.png', fullPage:true});
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('ESO: simulacros oficiales y Profesor IA contextual OK');
})().catch(error => { console.error(error); process.exit(1); });
