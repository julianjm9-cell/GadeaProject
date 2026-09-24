const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

const catalog = [
  {id:'desk_basic',name:'Mesa clara',category:'desk',price:0,minimum_level:1,visual:'desk-light',owned:true,equipped:true,unlocked:true},
  {id:'chair_basic',name:'Silla azul',category:'chair',price:0,minimum_level:1,visual:'chair-blue',owned:true,equipped:true,unlocked:true},
  {id:'lamp_basic',name:'Lámpara de estudio',category:'lamp',price:0,minimum_level:1,visual:'lamp-blue',owned:true,equipped:true,unlocked:true},
  {id:'plant_basic',name:'Planta pequeña',category:'plant',price:0,minimum_level:1,visual:'plant-small',owned:true,equipped:true,unlocked:true},
  {id:'lamp_warm',name:'Lámpara cálida',category:'lamp',price:90,minimum_level:2,visual:'lamp-warm',owned:false,equipped:false,unlocked:true},
];

(async () => {
  let failFirstProfileLoad = true;
  let purchaseCalls = 0;
  const errors = [];
  const profile = {xp:620,coins:320,level:{level:3,name:'Cojo ritmo',min_xp:500,next_min_xp:900},achievements:[],owned_items:['desk_basic','chair_basic','lamp_basic','plant_basic'],equipped_items:{desk:'desk_basic',chair:'chair_basic',lamp:'lamp_basic',plant:'plant_basic'},catalog};
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  const context = await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/me') return route.fulfill({contentType:'application/json',body:'{"user":{"name":"Marta García","email":"marta@example.com"}}'});
    if (url.pathname === '/api/resources') return route.fulfill({contentType:'application/json',body:'{"resources":[]}'});
    if (url.pathname === '/api/state') return route.fulfill({contentType:'application/json',body:'{"activityDates":["2026-09-24"]}'});
    if (url.pathname === '/api/gamification' && route.request().method() === 'GET') {
      if (failFirstProfileLoad) {
        failFirstProfileLoad = false;
        return route.fulfill({status:503,contentType:'application/json',body:'{"detail":"Servicio temporalmente no disponible"}'});
      }
      return route.fulfill({contentType:'application/json',body:JSON.stringify({profile,config:{achievements:[]}})});
    }
    if (url.pathname === '/api/gamification/purchases') {
      purchaseCalls += 1;
      const item = profile.catalog.find(entry => entry.id === route.request().postDataJSON().item_id);
      if (item.owned) return route.fulfill({status:400,contentType:'application/json',body:'{"detail":"Este objeto ya forma parte de tu inventario."}'});
      profile.coins -= item.price;
      item.owned = true;
      profile.owned_items.push(item.id);
      return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,profile})});
    }
    return route.fulfill({contentType:'application/json',body:'{}'});
  });

  const page = await context.newPage();
  page.on('pageerror',error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8770/apps/e25/index.html?ui=next');
  await page.locator('#navProgress').click();
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(),/temporalmente no disponible/i,'El fallo de red debe explicarse');
  await page.getByRole('button',{name:'Reintentar'}).click();
  await page.waitForFunction(() => document.querySelector('#nextDeskLevel')?.textContent.includes('Cojo ritmo'));
  assert.equal(await page.locator('#navProgress').getAttribute('aria-current'),'page','La navegación debe exponer la sección activa');
  assert.equal(await page.locator('.next-desk-scene:visible svg.desk-object').count(),4,'La escena visible debe usar los assets SVG equipados');

  await page.locator('#navHome').click();
  await page.locator('[data-next-duration="15"]').click();
  assert.equal(await page.locator('[data-next-duration="15"]').getAttribute('aria-pressed'),'true','La duración debe comunicar su selección');
  assert.match(await page.locator('.next-desk-scene:visible').evaluate(element => getComputedStyle(element).backgroundImage),/room\.svg/,'La escena debe usar el fondo final');

  const secondPage = await context.newPage();
  secondPage.on('pageerror',error => errors.push(error.message));
  await secondPage.goto('http://127.0.0.1:8770/apps/e25/index.html?ui=next');
  await secondPage.waitForFunction(() => window.gamification?.profile || document.querySelector('#nextDeskLevel')?.textContent.includes('Cojo ritmo'));
  await page.locator('#navProgress').click();
  await page.getByRole('button',{name:'Ir a la tienda'}).click();
  await page.evaluate(() => Promise.all([buyDeskItem('lamp_warm'),buyDeskItem('lamp_warm')]));
  await secondPage.waitForFunction(() => gamification.profile?.owned_items?.includes('lamp_warm'));
  assert.equal(purchaseCalls,1,'Una doble acción no debe lanzar dos compras');

  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),true,'El acabado final no debe desbordar en móvil');
  await page.screenshot({path:'tools/eso-next-final-mobile.png',fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await page.locator('#navHome').click();
  await page.screenshot({path:'tools/eso-next-final-desktop.png',fullPage:true});
  assert.deepEqual(errors,[],'El recorrido final no debe producir errores JavaScript');
  await browser.close();
  console.log('ESO paquete 5: assets, accesibilidad, recuperación, dos pestañas y móvil OK');
})().catch(error => { console.error(error); process.exit(1); });
