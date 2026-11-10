const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require('./browser-runtime.cjs');
const {levels, inspect, initialRotations} = require('../backend/app/static/assets/lighthouse/game.js');

const root = path.resolve(__dirname, '..');
const shared = path.join(root, 'backend/app/static');
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webp':'image/webp', '.svg':'image/svg+xml', '.png':'image/png'};
fs.mkdirSync(path.join(root, 'tmp'), {recursive:true});

async function launchApp(page, app) {
  await page.route('http://faro.test/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/state') return route.fulfill({headers:{ETag:'"test-1"'}, json:{}});
    if (pathname === '/auth/me' || pathname === '/api/status') return route.fulfill({json:{ok:true,user:{id:'player-1',name:'Prueba',status:'active'}}});
    if (pathname.startsWith('/api/')) return route.fulfill({json:{ok:true,notifications:[]}});
    const local = pathname === '/index.html' ? path.join(root, app, 'index.html') : path.join(root, app, pathname);
    const file = [local, path.join(shared, pathname)].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    return file ? route.fulfill({path:file,contentType:mime[path.extname(file)] || 'application/octet-stream'}) : route.fulfill({status:404});
  });
  await page.goto('http://faro.test/index.html?demo=1');
  if (app === 'apps/profesor') {
    await page.locator('.home-primary-nav').getByRole('button',{name:'Juegos',exact:true}).click();
    await page.getByRole('button',{name:'Avanzados',exact:true}).click();
  } else {
    await page.locator('#navGames').click();
  }
  await page.getByRole('button',{name:'Iniciar misión →'}).click();
}

test('the island rules distinguish short circuits, overload and two valid routes', () => {
  for (const level of levels) {
    assert.equal(inspect(level, initialRotations(level)).won, false);
    assert.equal(inspect(level, level.tiles.map(() => 0)).won, true);
  }
  assert.equal(inspect(levels[2], initialRotations(levels[2])).short, true);
  const last = levels[3];
  const rotations = last.tiles.map(() => 0);
  rotations[7] = 1;
  const overloaded = inspect(last, rotations);
  assert.equal(overloaded.lit, overloaded.total);
  assert.ok(overloaded.load > last.limit);
  assert.equal(overloaded.won, false);
  rotations[9] = 3;
  rotations[14] = 1;
  assert.equal(inspect(last, rotations).won, true);
});

for (const [name, engine, options, app, width] of [
  ['Chromium', chromium, {headless:true,channel:'msedge'}, 'apps/profesor', 1440],
  ['WebKit', webkit, {headless:true}, 'apps/e25', 320]
]) {
  test(name + ': Operación Faro opens inside ' + app + ' and plays all four islands', {timeout:90000}, async () => {
    const browser = await engine.launch(options);
    try {
      const page = await browser.newPage({viewport:{width,height:850},hasTouch:width<500,reducedMotion:'reduce'});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await launchApp(page, app);
      const game = page.getByRole('dialog',{name:'Operación Faro'});
      const status = game.getByRole('status');
      assert.equal(await page.evaluate(async () => {
        const image = new Image();
        image.src = '/assets/lighthouse/archipelago-v1.webp';
        await image.decode();
        return image.naturalWidth > 0;
      }), true);
      assert.equal(await game.locator('[data-faro-level="1"]').isDisabled(), true);
      for (const [index, level] of levels.entries()) {
        const initial = initialRotations(level);
        const relays = game.locator('[data-faro-rotate]');
        assert.equal(await relays.count(), initial.filter(Boolean).length);
        const layout = await game.evaluate(element => {
          const right = element.getBoundingClientRect().right;
          return {scroll:element.scrollWidth, width:element.clientWidth, children:[...element.querySelectorAll('*')].filter(child => child.getBoundingClientRect().right > right + 1).slice(0,6).map(child => [child.tagName, child.getAttribute('class'), child.getBoundingClientRect().width])};
        });
        assert.ok(layout.scroll <= layout.width + 1, JSON.stringify(layout));
        if (index === 0) {
          const first = relays.first();
          await first.focus();
          await page.keyboard.press('Enter');
          assert.match(await game.locator('.faro-round').innerText(), /1 giro/);
          await page.keyboard.press('Escape');
          await page.getByRole('button',{name:'Iniciar misión →'}).click();
          assert.match(await game.locator('.faro-round').innerText(), /1 giro/);
          const direction=game.getByRole('button',{name:'Girar en sentido antihorario'});
          await direction.click();
          assert.equal(await direction.getAttribute('aria-pressed'),'true');
          await first.click();
          assert.match(await game.locator('.faro-round').innerText(), /2 giros/);
          await direction.click();
          await game.getByRole('button',{name:'Reiniciar mapa'}).click();
        }
        if (index === 2) assert.match(await status.innerText(), /Cortocircuito/);
        if (index === 3) await game.screenshot({path:path.join(root,`tmp/operacion-faro-${width}.png`)});
        for (const [position, rotation] of initial.entries()) {
          if (!rotation) continue;
          const tile = game.locator(`[data-faro-rotate="${position}"]`);
          for (let turn = rotation; turn < 4 && await tile.getAttribute('aria-disabled') !== 'true'; turn++) {
            if (width<500) await tile.tap();
            else await tile.click();
          }
        }
        assert.equal(await status.getAttribute('data-tone'), 'win');
        if (index < levels.length-1) await game.getByRole('button',{name:'Siguiente isla →'}).click();
      }
      await game.getByRole('button',{name:'Cerrar Operación Faro'}).click();
      assert.equal(await page.getByRole('button',{name:'Iniciar misión →'}).evaluate(button => button === document.activeElement), true);
      await page.reload();
      if (app === 'apps/profesor') await page.getByRole('button',{name:'Avanzados',exact:true}).click();
      else await page.locator('#navGames').click();
      await page.getByRole('button',{name:'Iniciar misión →'}).click();
      assert.match(await game.getByRole('status').innerText(), /vuelve a tener luz/);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
}
