const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const serviceSource = fs.readFileSync(path.join(root, 'backend/app/services/gamification.py'), 'utf8');
const migrationSource = fs.readFileSync(path.join(root, 'backend/alembic/versions/0004_eso_gamification.py'), 'utf8');

assert.match(serviceSource, /"LESSON_COMPLETED": \{"xp": 30, "coins": 5\}/, 'La recompensa de lección debe estar centralizada');
assert.match(serviceSource, /event_key = f"\{normalized_type\}:\{normalized_source\}"/, 'Falta la clave estable de idempotencia');
assert.match(migrationSource, /uq_gamification_reward_event/, 'Falta la restricción única de recompensas');

(async () => {
  const rewardRequests = [];
  const errors = [];
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/resources') return route.fulfill({contentType:'application/json', body:'{"resources":[]}'});
    if (url.pathname === '/api/state') return route.fulfill({contentType:'application/json', body:'{}'});
    if (url.pathname === '/api/me') return route.fulfill({contentType:'application/json', body:'{"user":{"name":"Alumno"}}'});
    if (url.pathname === '/api/gamification' && route.request().method() === 'GET') {
      return route.fulfill({contentType:'application/json', body:'{"profile":{"xp":0,"coins":0,"level":{"level":1,"name":"Inicio"}},"config":{}}'});
    }
    if (url.pathname === '/api/gamification/rewards') {
      rewardRequests.push(route.request().postDataJSON());
      return route.fulfill({contentType:'application/json', body:'{"awarded":true,"duplicate":false,"profile":{"xp":50,"coins":15,"level":{"level":1,"name":"Inicio"}}}'});
    }
    return route.fulfill({contentType:'application/json', body:'{}'});
  });

  await page.goto('http://127.0.0.1:8770/apps/e25/index.html');
  await page.waitForTimeout(300);
  await page.evaluate(() => { openModule('lengua'); openTopic('len-comprension'); openLesson(0); });
  await page.locator('#modelEvidenceAnswer').fill('El texto explica el servicio del aula, su horario, la inscripción y las condiciones necesarias para poder utilizarla correctamente.');
  await page.locator('[data-evidence-check]').nth(0).check();
  await page.locator('[data-evidence-check]').nth(1).check();
  await page.getByRole('button', {name:'Guardar y continuar'}).click();
  await page.waitForTimeout(150);

  assert.equal(rewardRequests.filter(item => item.event_type === 'LESSON_COMPLETED').length, 1, 'Completar una lección debe emitir un evento');
  assert.equal(rewardRequests.find(item => item.event_type === 'LESSON_COMPLETED').source_id, 'len-comprension:lesson:0');

  await page.evaluate(() => completeLesson('len-comprension', 0));
  await page.waitForTimeout(100);
  assert.equal(rewardRequests.filter(item => item.event_type === 'LESSON_COMPLETED').length, 1, 'Reabrir una lección no debe emitir otra recompensa');
  assert.deepEqual(errors, [], 'La integración no debe producir errores JavaScript');

  await browser.close();
  console.log('ESO: motor de recompensas conectado e idempotente en la interfaz OK');
})().catch(error => { console.error(error); process.exit(1); });
