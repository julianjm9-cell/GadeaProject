const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  await page.route('**/api/**', async route => {
    const url = route.request().url();
    if (url.includes('/api/resources')) {
      const catalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../backend/app/content/official_resources.json'), 'utf8'));
      return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({resources:catalog.eso_adultos})});
    }
    if (url.includes('/api/state')) return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({state:{}})});
    if (url.includes('/api/me')) return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({user:{name:'Alumno'}})});
    return route.fulfill({status:200, contentType:'application/json', body:'{}'});
  });

  await page.goto('http://127.0.0.1:8770/apps/e25/index.html');
  await page.waitForTimeout(400);
  await page.evaluate(() => { openModule('lengua'); openTopic('len-comprension'); openLesson(0); });
  await page.waitForSelector('.model-unit-meta');
  assert.equal(await page.locator('.model-learning-block').count(), 4, 'La leccion modelo debe mostrar cuatro bloques de aprendizaje');
  assert.equal(await page.locator('.model-learning-block.example').count(), 1, 'Falta el ejemplo resuelto');
  assert.equal(await page.locator('.model-learning-block.practice').count(), 1, 'Falta la practica autonoma');
  assert.match(await page.locator('.model-objective').innerText(), /Objetivo de la lección/i);
  assert.match(await page.locator('.model-solution summary').innerText(), /solución razonada/i);
  assert((await page.locator('.topic-resource-list a').count()) >= 2, 'La unidad debe mostrar recursos relacionados');
  await page.getByRole('button', {name:/Completar lecci.n/i}).click();
  assert.match(await page.locator('#modelEvidenceStatus').innerText(), /Antes de completar/i, 'Debe bloquear el completado sin evidencia');
  await page.locator('#modelEvidenceAnswer').fill('El tema es el aula de informática. La idea principal explica que ofrece acceso gratuito con horario e inscripción por plazas limitadas.');
  await page.locator('[data-evidence-check]').nth(0).check();
  await page.locator('[data-evidence-check]').nth(1).check();
  await page.getByRole('button', {name:'Guardar evidencia'}).click();
  assert.match(await page.locator('#modelEvidenceStatus').innerText(), /Evidencia guardada/i);
  assert.equal(await page.locator('#modelEvidenceAnswer').inputValue(), 'El tema es el aula de informática. La idea principal explica que ofrece acceso gratuito con horario e inscripción por plazas limitadas.');
  await page.screenshot({path:path.resolve(__dirname, '../tools/eso-unidad-modelo.png'), fullPage:true});

  for (const [moduleId, topicId] of [['lengua','len-comprension'],['ingles','ing-reading'],['geografia','geo-fuentes'],['historia','his-fuentes'],['matematicas','mat-proporciones'],['ciencias','cie-metodo']]) {
    await page.evaluate(([module,topic]) => { openModule(module); openTopic(topic); openLesson(0); }, [moduleId,topicId]);
    assert.equal(await page.locator('.model-learning-block').count(), 4, `${topicId} no muestra el formato desarrollado`);
    assert.equal(await page.locator('#modelEvidenceAnswer').count(), 1, `${topicId} no incluye evidencia`);
  }
  await page.evaluate(() => { openModule('lengua'); openTopic('len-comprension'); openLesson(0); });

  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'La unidad modelo desborda en movil');
  await page.screenshot({path:path.resolve(__dirname, '../tools/eso-unidad-modelo-mobile.png'), fullPage:true});

  await browser.close();
  console.log('ESO: catalogo y unidad modelo OK');
})().catch(error => { console.error(error); process.exit(1); });
