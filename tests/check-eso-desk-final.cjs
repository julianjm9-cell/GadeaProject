let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const catalog = [
  {id:'desk_basic',name:'Mesa clara',category:'desk',price:0,minimum_level:1,visual:'desk-light',owned:true,equipped:true,unlocked:true},
  {id:'chair_basic',name:'Silla azul',category:'chair',price:0,minimum_level:1,visual:'chair-blue',owned:true,equipped:true,unlocked:true},
  {id:'lamp_basic',name:'Lámpara de estudio',category:'lamp',price:0,minimum_level:1,visual:'lamp-blue',owned:true,equipped:true,unlocked:true},
  {id:'plant_basic',name:'Planta pequeña',category:'plant',price:0,minimum_level:1,visual:'plant-small',owned:true,equipped:true,unlocked:true},
  {id:'rug_blue',name:'Alfombra azul',category:'rug',price:0,minimum_level:1,visual:'rug-blue',owned:true,equipped:true,unlocked:true},
  {id:'books_study',name:'Libros de estudio',category:'books',price:0,minimum_level:1,visual:'books-study',owned:true,equipped:true,unlocked:true},
  {id:'rug_sand',name:'Alfombra cálida',category:'rug',price:130,minimum_level:3,visual:'rug-sand',owned:false,equipped:false,unlocked:true},
  {id:'books_reference',name:'Biblioteca de consulta',category:'books',price:160,minimum_level:4,visual:'books-reference',owned:false,equipped:false,unlocked:false},
  {id:'lamp_warm',name:'Lámpara cálida',category:'lamp',price:90,minimum_level:2,visual:'lamp-warm',owned:false,equipped:false,unlocked:true},
];

function staticServer() {
  const contentTypes = {'.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml'};
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + pathname);
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(target, (error, bytes) => {
      if (error) { res.writeHead(404).end(); return; }
      res.writeHead(200, {'Content-Type':contentTypes[path.extname(target)] || 'application/octet-stream'}).end(bytes);
    });
  });
}

(async () => {
  let profile = {
    xp:620, coins:320, level:{level:3,name:'Cojo ritmo',min_xp:500,next_min_xp:900},
    achievements:[], owned_items:catalog.filter(item => item.owned).map(item => item.id),
    equipped_items:{desk:'desk_basic',chair:'chair_basic',lamp:'lamp_basic',plant:'plant_basic',rug:'rug_blue',books:'books_study'},
    catalog:structuredClone(catalog),
  };
  const server = staticServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1366,height:820}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const reply = data => route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
      if (url.pathname === '/api/me') return reply({user:{name:'Marta García',email:'marta@example.com'}});
      if (url.pathname === '/api/resources') return reply({resources:[]});
      if (url.pathname === '/api/state') return reply({activityDates:[]});
      if (url.pathname === '/api/gamification' && route.request().method() === 'GET') return reply({profile,config:{achievements:[]}});
      if (url.pathname === '/api/gamification/purchases') {
        const {item_id:id} = route.request().postDataJSON();
        const item = profile.catalog.find(entry => entry.id === id);
        assert(item && item.unlocked && !item.owned && profile.coins >= item.price);
        profile.coins -= item.price;
        item.owned = true;
        profile.owned_items.push(id);
        return reply({ok:true,profile});
      }
      if (url.pathname === '/api/gamification/equipment') {
        const {item_id:id} = route.request().postDataJSON();
        const item = profile.catalog.find(entry => entry.id === id);
        assert(item?.owned);
        profile.catalog.filter(entry => entry.category === item.category).forEach(entry => entry.equipped = entry.id === id);
        profile.equipped_items[item.category] = id;
        return reply({ok:true,profile});
      }
      return reply({});
    });

    await page.goto('http://127.0.0.1:' + server.address().port + '/apps/e25/index.html');
    await page.locator('#navProgress').click();
    await page.waitForSelector('.next-desk-item');
    assert.equal(await page.locator('.next-desk-item').count(), catalog.length);
    assert.equal(await page.locator('.next-desk-scene [data-category="rug"]').getAttribute('data-visual'), 'rug-blue');

    await page.getByRole('button',{name:'Ver Alfombra cálida en el escritorio'}).click();
    assert.equal(await page.locator('.next-desk-scene [data-category="rug"]').getAttribute('data-visual'), 'rug-sand');
    assert.equal(profile.equipped_items.rug, 'rug_blue', 'La vista previa no debe guardar cambios');
    assert.match(await page.locator('#deskPreviewNote').innerText(), /Cómpralo con monedas/);
    await page.getByRole('button',{name:'Volver al actual'}).click();
    assert.equal(await page.locator('.next-desk-scene [data-category="rug"]').getAttribute('data-visual'), 'rug-blue');

    const rug = page.locator('.next-desk-item').filter({hasText:'Alfombra cálida'});
    await rug.getByRole('button',{name:'Comprar · 130 monedas'}).click();
    await rug.getByRole('button',{name:'Equipar'}).click();
    assert.equal(profile.coins, 190);
    assert.equal(profile.equipped_items.rug, 'rug_sand');
    assert.equal(await page.locator('.next-desk-scene [data-category="rug"]').getAttribute('data-visual'), 'rug-sand');

    const lamp = page.locator('.next-desk-item').filter({hasText:'Lámpara cálida'});
    await lamp.getByRole('button',{name:'Comprar · 90 monedas'}).click();
    await lamp.getByRole('button',{name:'Equipar'}).click();
    assert.equal(profile.coins, 100);
    assert.equal(profile.equipped_items.lamp, 'lamp_warm');
    await page.reload();
    await page.locator('#navProgress').click();
    await page.waitForSelector('.next-desk-item');
    assert.equal(await page.locator('.next-desk-scene [data-category="lamp"]').getAttribute('data-visual'), 'lamp-warm');
    assert.equal(await page.locator('.next-desk-scene [data-category="rug"]').getAttribute('data-visual'), 'rug-sand');

    const imagesLoaded = await page.locator('.next-desk-item-art img, .next-desk-scene img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0));
    assert(imagesLoaded, 'Todas las imágenes de objetos deben cargar');
    for (const width of [1366, 768, 390]) {
      await page.setViewportSize({width,height:820});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Sin desbordamiento horizontal a ' + width + ' px');
    }
    await page.locator('[data-next-tab="stats"]').click();
    assert.equal(await page.locator('.next-stats-achievements').count(), 0);
    assert.deepEqual(errors, [], 'El flujo no debe producir errores JavaScript');
    console.log('ESO escritorio: previsualización, compra, equipamiento, recarga, imágenes y diseño adaptable OK');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
