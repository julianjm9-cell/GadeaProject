const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL} = require('node:url');
const {resolve} = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1366,height:768}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(resolve(__dirname, '../apps/profesor/index.html')).href);
    const problems = await page.evaluate(() => {
      const issues = [];
      for (const material of publicAdvancedGames) {
        try {
          runActivity(material, '');
          const questions = document.querySelectorAll('#dialog .play-question');
          if (questions.length !== material.activity.questions.length) issues.push(`${material.id}: expected ${material.activity.questions.length} questions, found ${questions.length}`);
          if (!document.querySelector('#dialog [data-type]')) issues.push(`${material.id}: no playable question`);
          document.querySelector('#dialog')?.close();
        } catch (error) {
          issues.push(`${material.id}: ${error.message}`);
          document.querySelector('#dialog')?.close();
        }
      }
      return issues;
    });
    assert.deepEqual(problems, []);
    assert.deepEqual(errors, []);
    console.log('PASS 61 advanced public games mount without exceptions');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
