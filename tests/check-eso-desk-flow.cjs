const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

const baseCatalog = [
  {id:'desk_basic',name:'Mesa clara',category:'desk',price:0,minimum_level:1,visual:'desk-light',owned:true,equipped:true,unlocked:true},
  {id:'chair_basic',name:'Silla azul',category:'chair',price:0,minimum_level:1,visual:'chair-blue',owned:true,equipped:true,unlocked:true},
  {id:'lamp_basic',name:'Lámpara de estudio',category:'lamp',price:0,minimum_level:1,visual:'lamp-blue',owned:true,equipped:true,unlocked:true},
  {id:'plant_basic',name:'Planta pequeña',category:'plant',price:0,minimum_level:1,visual:'plant-small',owned:true,equipped:true,unlocked:true},
  {id:'lamp_warm',name:'Lámpara cálida',category:'lamp',price:90,minimum_level:2,visual:'lamp-warm',owned:false,equipped:false,unlocked:true},
  {id:'chair_comfort',name:'Silla cómoda',category:'chair',price:250,minimum_level:5,visual:'chair-comfort',owned:false,equipped:false,unlocked:false},
];

(async () => {
  let profile = {xp:620,coins:320,level:{level:3,name:'Cojo ritmo',min_xp:500,next_min_xp:900},achievements:[],owned_items:['desk_basic','chair_basic','lamp_basic','plant_basic'],equipped_items:{desk:'desk_basic',chair:'chair_basic',lamp:'lamp_basic',plant:'plant_basic'},catalog:structuredClone(baseCatalog)};
  const errors = [];
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/me') return route.fulfill({contentType:'application/json',body:'{"user":{"name":"Marta García","email":"marta@example.com"}}'});
    if (url.pathname === '/api/resources') return route.fulfill({contentType:'application/json',body:'{"resources":[]}'});
    if (url.pathname === '/api/state') return route.fulfill({contentType:'application/json',body:JSON.stringify({activityDates:['2026-09-24','2026-09-23','2026-09-21','2026-09-19']})});
    if (url.pathname === '/api/gamification' && route.request().method() === 'GET') return route.fulfill({contentType:'application/json',body:JSON.stringify({profile,config:{achievements:[]}})});
    if (url.pathname === '/api/gamification/purchases') {
      const {item_id: itemId} = route.request().postDataJSON();
      const item = profile.catalog.find(entry => entry.id === itemId);
      profile.coins -= item.price; item.owned = true; profile.owned_items.push(item.id);
      return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,profile})});
    }
    if (url.pathname === '/api/gamification/equipment') {
      const {item_id: itemId} = route.request().postDataJSON();
      const item = profile.catalog.find(entry => entry.id === itemId);
      profile.catalog.filter(entry => entry.category === item.category).forEach(entry => entry.equipped = entry.id === item.id);
      profile.equipped_items[item.category] = item.id;
      return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,profile})});
    }
    return route.fulfill({contentType:'application/json',body:'{}'});
  });

  await page.goto('http://127.0.0.1:8770/apps/e25/index.html?ui=next');
  await page.waitForFunction(() => document.querySelector('#nextDeskLevel')?.textContent.includes('Cojo ritmo'));
  assert.equal(await page.locator('#nextHomeView').isVisible(), true, 'La nueva Inicio debe estar activa en modo next');
  assert.equal(await page.locator('#homeView').isVisible(), false, 'La Inicio anterior debe quedar como respaldo');
  assert.equal(await page.locator('#navExam').isVisible(), false, 'Exámenes no debe ocupar una pestaña global en la nueva navegación');

  await page.locator('#navProgress').click();
  await page.getByRole('button',{name:'Ir a la tienda'}).click();
  const warmLamp = page.locator('.next-item').filter({hasText:'Lámpara cálida'});
  await warmLamp.getByRole('button',{name:'Comprar'}).click();
  await warmLamp.getByRole('button',{name:'Equipar'}).click();
  assert.equal(profile.coins, 230, 'La compra debe descontar exactamente el precio');
  assert.equal(profile.equipped_items.lamp, 'lamp_warm', 'El objeto adquirido debe poder equiparse');

  await page.locator('#navHome').click();
  assert.equal(await page.locator('#nextHomeDesk [data-visual="lamp-warm"]').count(), 1, 'Inicio debe mostrar el objeto equipado');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#nextHomeDesk [data-visual="lamp-warm"]'));
  assert.equal(await page.locator('#nextHomeDesk [data-visual="lamp-warm"]').count(), 1, 'El objeto debe seguir equipado después de recargar');
  await page.screenshot({path:'tools/eso-next-home-desktop.png', fullPage:true});

  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'La nueva Inicio no debe desbordar en móvil');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('header .screen-nav')).position), 'fixed', 'La navegación móvil debe permanecer accesible abajo');
  await page.screenshot({path:'tools/eso-next-home-mobile.png', fullPage:true});
  assert.deepEqual(errors, [], 'El flujo no debe producir errores JavaScript');
  await browser.close();
  console.log('ESO: compra, equipamiento, Inicio y persistencia visual del escritorio OK');
})().catch(error => { console.error(error); process.exit(1); });
