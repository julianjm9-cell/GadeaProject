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
    await page.locator('.basic-family summary').click();
    const basicTiles = page.locator('.basic-family .exercise-tile.has-illustration');
    const basicImages = basicTiles.locator('.exercise-visual img');
    assert.equal(await basicTiles.count(), 11);
    await page.waitForFunction(() => [...document.querySelectorAll('.basic-family .exercise-visual img')].every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator('.basic-family .exercise-tiles').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 6);
    assert.equal(await basicImages.evaluateAll(nodes => new Set(nodes.map(node => node.getAttribute('src'))).size), 11);
    const pairs = page.locator('[data-exercise="pairs"]');
    await pairs.click();
    assert.equal(await pairs.getAttribute('aria-pressed'), 'true');
    assert.equal(await pairs.locator('.exercise-visual').isVisible(), true);
    await page.locator('#workshopCourse').selectOption('4.º Primaria');
    assert.equal(await basicImages.evaluateAll(nodes => nodes.every(node => !node.getAttribute('src').includes('/mature/'))), true, 'Primaria keeps the child illustrations');
    await page.locator('#workshopCourse').selectOption('3.º ESO');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-activity-art]')].every(image => image.getAttribute('src').includes('/mature/') && image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator('[data-activity-art="problem"]').getAttribute('src'), './assets/games/mature/basic-problem.webp');
    await page.locator('#workshopCourse').selectOption('4.º Primaria');
    await page.locator('#workshopSubject').selectOption('Inglés');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-activity-art]')].every(image => image.getAttribute('src').includes('/mature/') && image.complete && image.naturalWidth > 0));
    await page.locator('#workshopSubject').selectOption('Matemáticas');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-activity-art]')].every(image => !image.getAttribute('src').includes('/mature/') && image.complete && image.naturalWidth > 0));
    assert.deepEqual(await page.evaluate(() => ({
      primary: activityArtworkUrl('pairs', '4.º Primaria', 'Matemáticas'),
      eso: activityArtworkUrl('pairs', '1.º ESO', 'Matemáticas'),
      bach: activityArtworkUrl('pairs', '2.º Bachillerato', 'Lengua'),
      english: activityArtworkUrl('pairs', '2.º Primaria', 'Inglés')
    })), {
      primary: './assets/games/basic-pairs.webp',
      eso: './assets/games/mature/basic-pairs.webp',
      bach: './assets/games/mature/basic-pairs.webp',
      english: './assets/games/mature/basic-pairs.webp'
    });
    assert.deepEqual(await page.evaluate(() => {
      const source = (course, subject) => {
        const host = document.createElement('div');
        host.innerHTML = materialArtwork({ subject, activity: { context: { course }, questions: [{ type: 'pairs' }] } });
        return host.querySelector('img').getAttribute('src');
      };
      return {
        primaryCard: source('4.º Primaria', 'Matemáticas'),
        secondaryCard: source('3.º ESO', 'Matemáticas'),
        englishCard: source('4.º Primaria', 'Inglés')
      };
    }), {
      primaryCard: './assets/games/basic-pairs.webp',
      secondaryCard: './assets/games/mature/basic-pairs.webp',
      englishCard: './assets/games/mature/basic-pairs.webp'
    }, 'material library cards use the same age-aware artwork rule');
    await page.screenshot({ path: 'tools/profesor-game-illustrations.png' });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await mobile.locator('.home-primary-nav').getByRole('button', { name: 'Material' }).click();
    await mobile.getByRole('button', { name: 'Crear material', exact: true }).click();
    await mobile.locator('.basic-family summary').click();
    assert.equal(await mobile.locator('.basic-family .exercise-tiles').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 2);
    assert.equal(await mobile.locator('#dialog').evaluate(dialog => dialog.scrollWidth > dialog.clientWidth + 2), false);
    assert.deepEqual(errors, []);
    console.log('PASS child and mature activity illustrations, live course/English switching, six-column desktop catalog and two-column mobile catalog');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
