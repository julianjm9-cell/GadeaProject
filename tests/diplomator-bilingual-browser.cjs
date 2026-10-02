const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve('apps/diplomator');
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const relative = pathname.replace(/^\/apps\/diplomator\/?/, '') || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { res.writeHead(403); res.end(); return; }
    try {
      res.writeHead(200, { 'Content-Type': file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless:true, channel:'msedge' });
  try {
    const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      let data = { ok:true };
      if (pathname === '/api/status') data = { ok:true, user:{ email:'test@local', name:'Test', license_key:'DIPLO-TEST' }, limits:{ max_vocab:5, profile_chars:420 } };
      if (pathname === '/api/state' && route.request().method() === 'GET') data = {};
      if (pathname === '/api/diplomator/points-models') data = { ok:true, models:[{ id:'gemini:gemini-3.8-flash', provider:'gemini', model:'gemini-3.8-flash' }] };
      return route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(data) });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/apps/diplomator/index.html`);
    await page.waitForFunction(() => document.body.dataset.lang === 'en');
    assert.match(await page.locator('#sessionEmpty h2').innerText(), /Daily session/);
    await page.screenshot({ path:'tools/diplomator-daily-en.png' });
    assert.match(await page.locator('[data-tab-btn="temas"]').innerText(), /Topics/);
    await page.locator('[data-tab-btn="temas"]').click();
    assert.match(await page.locator('#topicCount').innerText(), /completed.*topics/);
    assert.match(await page.locator('#cattabs-2026 .cat-tab-btn').first().innerText(), /International relations/);
    assert.match(await page.locator('#topicsgrid-2026 .topic-item').first().innerText(), /Alliance of Civilizations/);
    await page.locator('[data-tab-btn="recitar"]').click();
    assert.match(await page.locator('#speakModeBtn').innerText(), /RECORD 5 MIN/);
    assert.match(await page.locator('#reciteNotes').getAttribute('placeholder'), /Ideas, dates/);
    await page.locator('#btnFR').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
    assert.match(await page.locator('#speakModeBtn').innerText(), /ENREGISTRER 5 MIN/);
    assert.match(await page.locator('#reciteNotes').getAttribute('placeholder'), /Idées, dates/);
    await page.locator('[data-tab-btn="temas"]').click();
    assert.match(await page.locator('#topicsgrid-2026 .topic-item').first().innerText(), /Alliance des civilisations/);
    assert.match(await page.locator('#topicCount').innerText(), /terminés.*thèmes/);
    await page.locator('[data-tab-btn="sesion"]').click();
    assert.match(await page.locator('#sessionEmpty h2').innerText(), /Session quotidienne/);
    await page.screenshot({ path:'tools/diplomator-daily-fr.png' });
    await page.setViewportSize({ width:390, height:844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    await page.locator('[data-tab-btn="temas"]').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    assert.deepEqual(errors, []);
    console.log('PASS Diplomator EN/FR session, oral practice, topics and mobile layout');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
