const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('url');
const path = require('path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('admin/index.html')).href);
    await page.evaluate(() => {
      const chat = { id: 'chat', provider: 'groq', model: 'openai/gpt-oss-120b', inherited: true, configured: true };
      const reserve = { id: 'generator_fallback', provider: 'gemini', model: 'gemini-3.8-flash', inherited: true, enabled: false, configured: true };
      ai = {
        groq_configured: true, gemini_configured: true,
        capabilities: [chat], apps: { PROFESOR_PARTICULAR: [chat, reserve] },
        model_choices: {
          chat: { groq: ['openai/gpt-oss-120b'], gemini: ['gemini-3.8-flash'] },
          generator_fallback: { groq: ['openai/gpt-oss-120b'], gemini: ['gemini-3.8-flash'] }
        }
      };
      window.savedPayload = null;
      api = async (url, options) => {
        savedPayload = JSON.parse(options.body);
        ai.apps.PROFESOR_PARTICULAR[1].inherited = false;
        ai.apps.PROFESOR_PARTICULAR[1].enabled = true;
        return ai;
      };
      setLoginState(true);
      openAppAI('PROFESOR_PARTICULAR');
    });
    const toggle = page.getByLabel('Activar proveedor de reserva');
    assert.equal(await toggle.isChecked(), false);
    await toggle.check();
    assert.equal(await page.locator('#provider-generator_fallback').inputValue(), 'gemini');
    await page.getByRole('button', { name: 'Guardar esta aplicación' }).click();
    assert.deepEqual(await page.evaluate(() => savedPayload.capabilities.generator_fallback), { provider: 'gemini', model: 'gemini-3.8-flash' });
    assert.deepEqual(errors, []);
    console.log('OK: el respaldo del generador se activa y guarda en Profesor Particular.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
