const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL} = require('node:url');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1366,height:900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await page.locator('.home-primary-nav').getByRole('button',{name:'Juegos',exact:true}).click();
    await page.getByRole('button',{name:'Externos',exact:true}).click();
    const cards = page.locator('.external-game-card');
    await cards.first().waitFor();
    assert.equal(await cards.count(),12);
    assert.match(await page.locator('#libraryResultSummary').innerText(),/de 25/);
    await cards.locator('img').evaluateAll(images => images.forEach(image => {image.loading = 'eager'}));
    await page.waitForFunction(() => [...document.querySelectorAll('.external-game-card img')].every(image => image.complete));
    assert.equal(await cards.locator('img').evaluateAll(images => images.every(image => image.naturalWidth > 0)),true);
    const link = cards.first().locator('a.external-game-open');
    assert.match(await link.getAttribute('href'),/^https:\/\/es\.educaplay\.com\/recursos-educativos\//);
    assert.equal(await link.getAttribute('target'),'_blank');
    assert.match(await link.getAttribute('rel'),/noopener/);
    assert.deepEqual(errors,[]);
    console.log('PASS Profesor Particular: Juegos > Externos shows source links and artwork');

    const eso = await browser.newPage({viewport:{width:1366,height:900}});
    const esoErrors = [];
    eso.on('pageerror', error => esoErrors.push(error.message));
    await eso.goto(pathToFileURL(path.resolve('apps/e25/index.html')).href);
    await eso.evaluate(() => openGames('lengua'));
    const external = eso.locator('.eso-game-card .eso-external-game');
    await external.first().waitFor();
    assert.equal(await external.count(),11);
    assert.equal(await eso.locator('.eso-game-card:first-child .game-card-actions > *').count(),4);
    assert.deepEqual(esoErrors,[]);
    console.log('PASS ESO Adultos: each Lengua topic has four game options');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exit(1)});
