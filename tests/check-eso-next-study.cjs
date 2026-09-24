const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  let savedState = {};
  const rewards = [];
  const errors = [];
  const profile = {xp:0,coins:0,level:{level:1,name:'Inicio',min_xp:0,next_min_xp:200},achievements:[],owned_items:[],equipped_items:{},catalog:[]};
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',async route=>{
    const url = new URL(route.request().url());
    if (url.pathname === '/api/me') return route.fulfill({contentType:'application/json',body:'{"user":{"name":"Marta García","email":"marta@example.com"}}'});
    if (url.pathname === '/api/resources') return route.fulfill({contentType:'application/json',body:'{"resources":[]}'});
    if (url.pathname === '/api/state') {
      if (route.request().method() === 'POST') savedState = route.request().postDataJSON();
      return route.fulfill({contentType:'application/json',body:JSON.stringify(savedState)});
    }
    if (url.pathname === '/api/gamification' && route.request().method() === 'GET') return route.fulfill({contentType:'application/json',body:JSON.stringify({profile,config:{achievements:[]}})});
    if (url.pathname === '/api/gamification/rewards') {
      rewards.push(route.request().postDataJSON());
      return route.fulfill({contentType:'application/json',body:JSON.stringify({awarded:true,profile})});
    }
    return route.fulfill({contentType:'application/json',body:'{}'});
  });

  await page.goto('http://127.0.0.1:8770/apps/e25/index.html?ui=next');
  await page.waitForTimeout(250);
  await page.locator('[data-next-duration="15"]').click();
  await page.locator('#nextContinue').click();
  assert.equal(await page.evaluate(()=>state.activeSession?.stepKeys.length),1,'La sesión de 15 minutos debe tener un paso verificable');
  await page.evaluate(()=>openLesson(0));
  await page.locator('#modelEvidenceAnswer').fill('El texto explica que el aula de informática ofrece acceso gratuito, tiene un horario concreto y exige inscripción porque las plazas son limitadas.');
  await page.locator('[data-evidence-check]').nth(0).check();
  await page.locator('[data-evidence-check]').nth(1).check();
  await page.getByRole('button',{name:'Guardar y continuar'}).click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>Boolean(state.activeSession?.completedAt)),true,'La sesión debe finalizar al completar todos sus pasos');
  assert.equal(rewards.filter(item=>item.event_type==='DAILY_SESSION_COMPLETED').length,1,'La sesión completada debe emitir una recompensa diaria');

  await page.locator('#navModules').click();
  assert.equal(await page.locator('.library-tabs').getByRole('button',{name:'SIMULACROS'}).count(),1,'Simulacros debe estar accesible desde Asignaturas');
  await page.locator('#moduleGrid').getByRole('button',{name:/LENGUA CASTELLANA/i}).click();
  assert.equal(await page.locator('.subject-catalog').isVisible(),true,'La biblioteca renovada debe reutilizar el catálogo real');
  await page.screenshot({path:'tools/eso-next-asignatura-desktop.png',fullPage:true});
  await page.locator('#profileButton').click();
  assert.equal(await page.locator('#profilePanel').isVisible(),true,'Perfil debe seguir disponible en el modo nuevo');
  await page.locator('#profileButton').click();

  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Las pantallas de estudio no deben desbordar en móvil');
  await page.screenshot({path:'tools/eso-next-asignatura-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  await browser.close();
  console.log('ESO: sesión diaria medible, Asignaturas, simulacros y Perfil renovados OK');
})().catch(error=>{console.error(error);process.exit(1)});
