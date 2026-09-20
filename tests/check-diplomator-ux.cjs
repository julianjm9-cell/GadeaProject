const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/status') return route.fulfill({contentType:'application/json', body:JSON.stringify({ok:true,user:{email:'prueba@local'},limits:{}})});
    if (url.pathname === '/api/state' && route.request().method() === 'GET') {
      return route.fulfill({contentType:'application/json', body:JSON.stringify({
        lang:'en', completedTopics:[], history:[], manualTopics:[],
        currentSession:{topic:'Tema antiguo',date:'2026-09-18T09:00:00.000Z',updatedAt:'2026-09-19T10:00:00.000Z',aiPoints:[{title:'Antiguo',text:'Debe conservarse'}],savedPoints:[]},
        topicChats:{profesor:[]}
      })});
    }
    return route.fulfill({contentType:'application/json', body:'{"ok":true}'});
  });
  await page.goto('http://127.0.0.1:8770/apps/diplomator/index.html');
  await page.waitForTimeout(800);

  assert.equal(await page.locator('.global-teacher').count(), 1, 'Debe existir un solo profesor flotante');
  assert.equal(await page.locator('.chat-panel').count(), 0, 'No deben quedar chats duplicados en las pestañas');
  assert.equal(await page.locator('#sessionEmpty').isVisible(), true, 'La visita debe comenzar en la pantalla de inicio');
  assert.equal(await page.locator('#sessionActive').isVisible(), false, 'No debe reabrirse la sesión anterior');
  assert.equal(await page.locator('#sessionDraft').isVisible(), true, 'Debe ofrecer continuar el borrador');
  assert.equal(await page.locator('#sessionDraftTopic').textContent(), 'Tema antiguo');
  assert.equal(await page.evaluate(() => state.currentSession.topic), 'Tema antiguo');
  await page.screenshot({path:'tools/diplomator-sesion-pendiente.png'});
  await page.getByRole('button', {name:'Continuar sesión'}).click();
  assert.equal(await page.locator('#sessionActive').isVisible(), true);
  assert.equal(await page.locator('#aiPoints').textContent().then(text => text.includes('Debe conservarse')), true);
  await page.evaluate(() => closeCurrentSession(true));
  assert.equal(await page.locator('#sessionDraft').isVisible(), false, 'Descartar debe eliminar el borrador');
  assert.equal(await page.evaluate(() => state.currentSession), null);

  await page.locator('#globalTeacherButton').click();
  assert.equal(await page.locator('#globalTeacherPanel').isVisible(), true);
  await page.evaluate(() => {
    state.topicChats.profesor = [{role:'assistant',text:'# Esquema\n\nUn **concepto clave**.\n\n| Actor | Función |\n|---|---|\n| ONU | Mediación |\n\n- Primer punto\n- Segundo punto\n- Tercer punto\n- Cuarto punto\n- Quinto punto'}];
    renderGlobalTeacherChat();
  });
  await page.locator('.teacher-open-answer').click();
  assert.equal(await page.locator('#teacherAnswerModal').isVisible(), true);
  assert.equal(await page.locator('#teacherAnswerBody strong').textContent(), 'concepto clave');
  assert.equal(await page.locator('#teacherAnswerBody table').count(), 1);
  assert.equal(await page.locator('#teacherAnswerBody th').first().textContent(), 'Actor');
  assert.equal(await page.evaluate(() => teacherMarkdownToHtml('<script>alert(1)</script>').includes('<script>')), false, 'El visor debe escapar HTML');
  await page.screenshot({path:'tools/diplomator-material-completo.png'});
  await page.evaluate(() => closeTeacherAnswer());

  await page.evaluate(() => startSessionWithTopic('Tema de prueba', false));
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#sessionActive').isVisible(), true);
  await page.evaluate(() => closeCurrentSession(true));
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#sessionEmpty').isVisible(), true);

  await page.screenshot({path:'tools/diplomator-profesor-desktop.png'});
  await page.evaluate(() => toggleGlobalTeacher(false));
  await page.setViewportSize({width:390,height:844});
  await page.locator('#globalTeacherButton').click();
  assert.equal(await page.locator('#globalTeacherPanel').isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, 'No debe haber desbordamiento horizontal en móvil');
  await page.screenshot({path:'tools/diplomator-profesor-mobile.png'});
  assert.deepEqual(errors, [], `Errores de navegador: ${errors.join(' | ')}`);
  await browser.close();
  console.log('Diplomator: profesor único, visor enriquecido y reinicio de sesión OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
