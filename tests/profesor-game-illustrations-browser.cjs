const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await page.locator('.home-primary-nav').getByRole('button', { name: 'Material' }).click();
    await page.getByRole('button', { name: 'Crear material', exact: true }).click();
    await page.locator('.playful-family summary').click();

    const tiles = page.locator('.playful-family .exercise-tile.has-illustration');
    const images = tiles.locator('.exercise-visual img');
    assert.equal(await tiles.count(), 10);
    await page.waitForFunction(() => [...document.querySelectorAll('.playful-family .exercise-visual img')].every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator('.playful-family .exercise-tiles').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 6);
    assert.equal(await images.evaluateAll(nodes => new Set(nodes.map(node => node.getAttribute('src'))).size), 10);
    assert.equal(await images.evaluateAll(nodes => nodes.every(node => /assets\/games\/.+\.webp$/.test(node.getAttribute('src')))), true);

    const memory = page.locator('[data-exercise="memory"]');
    await memory.click();
    assert.equal(await memory.getAttribute('aria-pressed'), 'true');
    assert.equal(await memory.locator('.exercise-visual').isVisible(), true);
    await page.screenshot({ path: 'tools/profesor-game-illustrations.png' });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await mobile.locator('.home-primary-nav').getByRole('button', { name: 'Material' }).click();
    await mobile.getByRole('button', { name: 'Crear material', exact: true }).click();
    await mobile.locator('.playful-family summary').click();
    assert.equal(await mobile.locator('.playful-family .exercise-tiles').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 2);
    assert.equal(await mobile.locator('#dialog').evaluate(dialog => dialog.scrollWidth > dialog.clientWidth + 2), false);
    assert.deepEqual(errors, []);
    console.log('PASS ten optimized game illustrations, six-column desktop catalog and two-column mobile catalog');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
