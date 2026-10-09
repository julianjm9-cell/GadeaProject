const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await page.evaluate(() => {
      const material = {
        id: 'generated-edit-save', title: 'Material generado', subject: 'Matemáticas', kind: 'Actividad interactiva', body: '',
        activity: { version: 1, context: { course: '3.º ESO', subject: 'Matemáticas' }, questions: [
          { id: 'q1', type: 'quiz', activityGroup: 1, prompt: 'Pregunta original', answer: '4', options: ['4', '5'], explanation: 'Suma las unidades.' },
          { id: 'q2', type: 'numeric', activityGroup: 2, prompt: 'La mitad de diez', answer: '5', options: [], explanation: 'Divide entre dos.' },
        ] },
      };
      state.library = [material];
      demo = false;
      saveQueue = Promise.resolve();
      saveFailed = false;
      pendingSaves = 0;
      window.__savedState = null;
      window.__remainingFailures = 1;
      api = async (requestPath, body) => {
        if (requestPath !== '/api/state') throw Error('Unexpected API call: ' + requestPath);
        await new Promise(resolve => setTimeout(resolve, 120));
        if (window.__remainingFailures-- > 0) throw Error('Fallo de red simulado');
        window.__savedState = structuredClone(body);
        return { ok: true };
      };
      editActivity(material);
    });

    const saveButton = page.getByRole('button', { name: 'Guardar y cerrar', exact: true });
    assert.equal(await page.locator('#dialog').getAttribute('data-editor-step'), '0');
    assert.equal(await saveButton.isVisible(), true, 'saving must be available from the first generated question');
    await page.locator('#activityTitle').fill('Material corregido');
    await page.locator('#q-0').fill('¿Cuánto suman dos y dos?');

    await saveButton.click();
    await page.waitForFunction(() => saveFailed && pendingSaves === 0);
    assert.equal(await page.locator('#dialog').evaluate(dialog => dialog.open), true, 'the editor must stay open when persistence fails');

    await saveButton.click();
    await page.waitForFunction(() => !document.querySelector('#dialog').open);
    const saved = await page.evaluate(() => ({ material: state.library.find(item => item.id === 'generated-edit-save'), request: window.__savedState }));
    assert.equal(saved.material.title, 'Material corregido');
    assert.equal(saved.material.activity.questions[0].prompt, '¿Cuánto suman dos y dos?');
    assert.equal(saved.request.library.find(item => item.id === 'generated-edit-save').title, 'Material corregido');

    await page.evaluate(() => editActivity(state.library.find(item => item.id === 'generated-edit-save')));
    assert.equal(await page.locator('#activityTitle').inputValue(), 'Material corregido');
    assert.equal(await page.locator('#q-0').inputValue(), '¿Cuánto suman dos y dos?');
    assert.deepEqual(errors, []);
    console.log('PASS generated material edits persist, can save from any question, and remain open after a failed save');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
