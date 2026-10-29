const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL} = require('node:url');
const {resolve} = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({viewport:{width,height:900}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(resolve(__dirname, '../apps/profesor/index.html')).href);
      await page.locator('.home-primary-nav').getByRole('button', {name:'Material'}).click();
      await page.getByRole('button', {name:'Crear material', exact:true}).click();
      for (const name of ['basic-family', 'advanced-family']) {
        const family = page.locator('.' + name);
        if (!await family.evaluate(node => node.open)) await family.locator('summary').click();
        const tiles = family.locator('.exercise-tile.has-illustration');
        assert(await tiles.count() >= 10, `${name} must show its current games`);
        const images = tiles.locator('img');
        await page.waitForFunction(selector => [...document.querySelectorAll(selector)].every(img => img.complete && img.naturalWidth > 0), '.' + name + ' .exercise-tile img');
        assert.equal(await images.count(), await tiles.count());
      }
      await page.locator('#workshopCourse').selectOption('4.º Primaria');
      const childArt = await page.locator('[data-activity-art="pairs"]').getAttribute('src');
      await page.locator('#workshopCourse').selectOption('1.º ESO');
      const olderArt = await page.locator('[data-activity-art="pairs"]').getAttribute('src');
      assert.notEqual(childArt, olderArt, 'the same game uses age-appropriate artwork');
      await page.waitForFunction(() => [...document.querySelectorAll('[data-activity-art]')].every(img => img.complete && img.naturalWidth > 0));
      assert.equal(await page.locator('#dialog').evaluate(dialog => dialog.scrollWidth > dialog.clientWidth + 2), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS current basic and advanced game artwork loads for child and older courses on desktop and mobile');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
