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
  await page.goto('http://127.0.0.1:8770/apps/e25/index.html?ui=classic');
  await page.waitForTimeout(500);

  assert.equal(await page.locator('.home-subjects button').count(), 3);
  await page.getByRole('button', {name:/Comunicaci.n/}).click();
  assert.equal(await page.locator('#moduleGrid .curriculum-scope').count(), 3);
  for (const id of ['comunicacion','social','cientifico']) {
    assert.equal(await page.locator(`#scope-${id} .module-card`).count(), 2, `${id} debe contener dos materias`);
  }
  await page.screenshot({path:'tools/eso-indice-ambitos.png', fullPage:true});

  await page.evaluate(() => openModule('exam'));
  await page.getByRole('button', {name:/Simulacros oficiales/}).click();
  await page.getByRole('button', {name:/Consultar estructura y criterios/}).click();
  assert.equal(await page.getByText('ESTRUCTURA OFICIAL ANDALUCIA 2026').isVisible(), true);
  assert.equal(await page.getByText(/Tres pruebas independientes/).isVisible(), true);
  assert.equal(await page.locator('#viewer .curriculum-scope').count(), 3);
  await page.screenshot({path:'tools/eso-estructura-oficial.png', fullPage:true});

  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, 'No debe haber desbordamiento horizontal');
  await page.screenshot({path:'tools/eso-estructura-oficial-mobile.png', fullPage:true});
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('ESO: indice por ambitos y estructura oficial OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
