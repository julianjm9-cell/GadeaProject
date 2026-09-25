const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

const catalog = [
  {id:'desk_basic',name:'Mesa clara',category:'desk',price:0,minimum_level:1,visual:'desk-light',owned:true,equipped:true,unlocked:true},
  {id:'chair_basic',name:'Silla azul',category:'chair',price:0,minimum_level:1,visual:'chair-blue',owned:true,equipped:true,unlocked:true},
  {id:'lamp_basic',name:'Lámpara de estudio',category:'lamp',price:0,minimum_level:1,visual:'lamp-blue',owned:true,equipped:true,unlocked:true},
  {id:'plant_basic',name:'Planta pequeña',category:'plant',price:0,minimum_level:1,visual:'plant-small',owned:true,equipped:true,unlocked:true},
];
const profile = {xp:620,coins:320,level:{level:3,name:'Cojo ritmo',min_xp:500,next_min_xp:900},achievements:[],owned_items:catalog.map(item=>item.id),equipped_items:{desk:'desk_basic',chair:'chair_basic',lamp:'lamp_basic',plant:'plant_basic'},catalog};

(async () => {
  const errors = [];
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/me') return route.fulfill({contentType:'application/json',body:'{"user":{"name":"Marta García","email":"marta@example.com"}}'});
    if (url.pathname === '/api/resources') return route.fulfill({contentType:'application/json',body:'{"resources":[]}'});
    if (url.pathname === '/api/state') return route.fulfill({contentType:'application/json',body:'{"activityDates":["2026-09-24"]}'});
    if (url.pathname === '/api/gamification') return route.fulfill({contentType:'application/json',body:JSON.stringify({profile,config:{achievements:[]}})});
    return route.fulfill({contentType:'application/json',body:'{}'});
  });

  await page.goto('http://127.0.0.1:8770/apps/e25/index.html');
  await page.waitForFunction(() => document.querySelectorAll('#homeDeskPreview img.desk-object').length === 4);
  await page.waitForFunction(() => [...document.querySelectorAll('#homeDeskPreview img.desk-object')].every(image=>image.complete && image.naturalWidth));
  assert.ok((await page.locator('#homeDeskPreview .next-desk-scene').boundingBox()).width > 200,'El escritorio debe ocupar el espacio visual del inicio');
  assert.equal(await page.locator('body').evaluate(body=>body.classList.contains('desktop-refresh')),true);
  assert.equal(await page.locator('#navExam').isVisible(),true,'Exámenes debe seguir accesible');
  assert.equal(await page.locator('#sessionChooser').isVisible(),true,'Inicio conserva la sesión diaria');
  await page.screenshot({path:'tools/eso-refresh-home-desktop.png',fullPage:true});

  await page.locator('#navModules').click();
  assert.equal(await page.locator('#moduleGrid').isVisible(),true,'La biblioteca debe abrir');
  await page.screenshot({path:'tools/eso-refresh-library-desktop.png',fullPage:true});
  await page.locator('#moduleGrid .module-card').first().click();
  assert.equal(await page.locator('#workspace').isVisible(),true,'La ficha de asignatura debe abrir');
  await page.screenshot({path:'tools/eso-refresh-subject-desktop.png',fullPage:true});
  await page.locator('#navExam').click();
  assert.equal(await page.locator('#workspace').isVisible(),true,'Exámenes debe abrir');
  assert.equal(await page.locator('#navExam').getAttribute('aria-current'),'page','La navegación debe señalar Exámenes');
  await page.screenshot({path:'tools/eso-refresh-exams-desktop.png',fullPage:true});
  await page.locator('#navProgress').click();
  assert.equal(await page.locator('#nextProgressView').isVisible(),true,'Progreso debe abrir');
  await page.locator('#navHome').click();
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),true,'Inicio no debe desbordar en móvil');
  assert.equal(await page.locator('#navExam').isVisible(),true,'Exámenes debe seguir en móvil');
  await page.screenshot({path:'tools/eso-refresh-home-mobile.png',fullPage:true});
  for (const id of ['navModules','navExam','navProgress']) {
    await page.locator(`#${id}`).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),true,`${id} no debe desbordar en móvil`);
  }
  assert.deepEqual(errors,[]);
  await browser.close();
  console.log('ESO: renovación visual con Inicio, Biblioteca, Exámenes y Progreso intactos OK');
})().catch(error=>{console.error(error);process.exit(1)});
