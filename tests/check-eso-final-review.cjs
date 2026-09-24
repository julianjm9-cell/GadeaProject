const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const resources = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'backend', 'app', 'content', 'official_resources.json'), 'utf8')).eso_adultos;

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [];
  let chatPrompt = '';
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/me') return route.fulfill({contentType:'application/json', body:'{"user":{"name":"Alumno","email":"alumno@example.com","status":"Activo"}}'});
    if (url.pathname === '/api/resources') return route.fulfill({contentType:'application/json', body:JSON.stringify({resources})});
    if (url.pathname === '/api/chat') {
      chatPrompt = route.request().postDataJSON().messages[0].content;
      return route.fulfill({contentType:'application/json', body:'{"content":"Short English study notes."}'});
    }
    if (url.pathname === '/api/state' && route.request().method() === 'GET') {
      return route.fulfill({contentType:'application/json', body:JSON.stringify({
        done:null, scores:'antiguo', attempts:null, teacherChats:[], testAttempts:[],
        activeModule:'modulo-eliminado', activeTopic:'tema-eliminado', activeLesson:99,
        activeTab:'pestana-antigua', examPracticeType:'antiguo'
      })});
    }
    return route.fulfill({contentType:'application/json', body:'{}'});
  });
  await page.goto('http://127.0.0.1:8770/apps/e25/index.html');
  await page.waitForTimeout(500);

  assert.equal(await page.locator('#homeView').isVisible(), true, 'Debe recuperarse de un estado antiguo');
  assert.equal(await page.locator('#teacherPanel').count(), 1, 'Solo debe existir un Profesor IA');
  assert.deepEqual(await page.evaluate(() => ({module:state.activeModule, tab:state.activeTab, topic:state.activeTopic, lesson:state.activeLesson})), {module:'lengua',tab:'contenidos',topic:null,lesson:null});

  await page.locator('#profileButton').click();
  assert.equal(await page.locator('#profilePanel').isVisible(), true);
  await page.locator('#navModules').click();
  assert.equal(await page.locator('#profilePanel').isVisible(), false, 'La navegación debe cerrar el perfil');
  assert.equal(await page.locator('.curriculum-scope').count(), 3);

  await page.evaluate(() => { showView('home'); setSessionDuration(45); });
  assert.equal(await page.locator('#todayPlan .session-step').count(), 3, 'La sesión de 45 minutos debe tener tres pasos');
  assert.match(await page.locator('#sessionPlan').innerText(), /Tema[\s\S]*Práctica[\s\S]*Comprobar/i);

  await page.evaluate(() => { openModule('lengua'); openTopic('len-comprension'); openLesson(0); });
  assert.equal(await page.locator('.model-objective').isVisible(), true);
  assert.equal(await page.locator('#modelEvidenceAnswer').isVisible(), true);
  assert.equal(await page.getByRole('button', {name:'Guardar y continuar'}).isVisible(), true);

  await page.evaluate(() => { openModule('ingles'); openTopic('ing-reading'); openLesson(0); });
  await page.locator('.ai-notes-card summary').click();
  await page.getByRole('button', {name:'Generar con IA'}).click();
  await page.waitForFunction(() => document.querySelector('#lessonAiNotes')?.value === 'Short English study notes.');
  assert.match(chatPrompt, /Write the complete answer in English/);

  await page.evaluate(() => { openModule('lengua'); setTab('test'); startTopicTest('lengua:mixed:0'); });
  const questions = page.locator('.question');
  const questionCount = await questions.count();
  assert.equal(questionCount, 10);
  for (let index = 0; index < questionCount; index += 1) await questions.nth(index).locator('.answers button').first().click();
  await page.locator('#scoreTestButton').click();
  assert.equal(await page.locator('.question-feedback').count(), questionCount);
  assert.equal(await page.locator('.answer-correct').count(), questionCount, 'Cada pregunta debe mostrar claramente la respuesta correcta');
  assert.equal(await page.locator('.question.correct, .question.wrong').count(), questionCount);

  await page.evaluate(() => openLibrary('resources'));
  assert.equal(await page.locator('.simple-resource-list a').count(), 14);
  assert.equal(await page.locator('.simple-resource-list a[target="_blank"][rel="noopener"]').count(), 14);

  await page.evaluate(() => { openModule('exam'); showOfficialSimulators(); startOfficialSimulator('social'); });
  assert.equal(await page.locator('.official-rubric-row').count(), 4);
  assert.match(await page.locator('#examPrompt').inputValue(), /100 puntos/i);
  assert.match(await page.locator('#correctionOutput').innerText(), /orientativa/i);

  await page.evaluate(() => showView('progress'));
  assert.equal(await page.locator('#nextProgressView').isVisible(), true, 'La sección Progreso debe mostrar el escritorio nuevo');
  await page.locator('[data-next-tab="study"]').click();
  assert.equal(await page.locator('#progressView').isVisible(), true);
  assert.equal(await page.locator('#progressSubjects .progress-subject-row').count(), 6);
  await page.screenshot({path:'tools/eso-revision-final.png', fullPage:true});

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => { showView('home'); clearSessionDuration(); });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, 'La app no debe desbordar horizontalmente en móvil');
  assert.equal(await page.locator('#sessionChooser').isVisible(), true);
  await page.screenshot({path:'tools/eso-revision-final-mobile.png', fullPage:true});

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('ESO: revisión final de recorrido, migración, test, recursos y móvil OK');
})().catch(error => { console.error(error); process.exit(1); });
