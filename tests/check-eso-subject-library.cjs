const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:950}});
    const errors = [];
    let saved = {};
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      let body = {};
      if (url.pathname === '/api/state') {
        if (route.request().method() === 'POST') saved = route.request().postDataJSON();
        else body = saved;
      }
      if (url.pathname === '/api/me') body = {user:{name:'Alumno'}};
      if (url.pathname === '/api/resources') body = {resources:[]};
      await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.goto('http://127.0.0.1:8770/apps/e25/index.html');
    await page.locator('#navModules').click();
    await page.locator('#moduleGrid').getByRole('button',{name:/LENGUA CASTELLANA/i}).click();
    assert.match(await page.locator('#moduleProgress').innerText(),/0 de 44 lecciones/);
    assert.equal(await page.locator('.subject-topic-trigger').count(),11);
    assert.equal(await page.locator('.subject-group').count(),2);
    await page.locator('#subject-len-comprension .subject-topic-trigger').click();
    assert.equal(await page.locator('#subject-len-comprension .subject-lesson-row').count(),4);
    assert.equal(await page.locator('#subject-len-comprension .subject-topic-trigger').getAttribute('aria-expanded'),'true');
    await page.screenshot({path:path.resolve(__dirname,'../tools/eso-biblioteca-desktop.png'),fullPage:true});
    await page.locator('#subject-len-resumen .subject-topic-trigger').click();
    assert.equal(await page.locator('#subject-len-comprension .subject-lesson-row').count(),0);
    assert.equal(await page.locator('#subject-len-resumen .subject-lesson-row').count(),4);
    await page.locator('#subject-len-comprension .subject-topic-trigger').click();
    await page.locator('#subject-len-comprension .subject-lesson-row').first().click();
    assert.match(await page.locator('.lesson-head').innerText(),/Idea principal/i);
    await page.locator('#modelEvidenceAnswer').fill('El tema del texto es el aula de informática. La idea principal explica el horario de acceso gratuito y la inscripción limitada.');
    await page.locator('[data-evidence-check]').nth(0).check();
    await page.locator('[data-evidence-check]').nth(1).check();
    await page.getByRole('button',{name:'Guardar y continuar'}).click();
    await page.getByRole('button',{name:'Volver a las lecciones'}).click();
    assert.match(await page.locator('#moduleProgress').innerText(),/1 de 44 lecciones/);
    assert.match(await page.locator('.subject-next').innerText(),/Continúa donde lo dejaste/);
    assert.equal(await page.locator('#subject-len-comprension .subject-lesson-row.done').count(),1);
    await page.locator('.subject-next button').click();
    assert.equal(await page.evaluate(() => state.activeLesson),1,'Seguir debe abrir la siguiente lección pendiente');
    await page.getByRole('button',{name:'Volver a las lecciones'}).click();
    await page.getByRole('button',{name:'Tests',exact:true}).click();
    await page.getByRole('button',{name:'Temas',exact:true}).click();
    assert.equal(await page.locator('#subject-len-comprension .subject-lesson-row').count(),4);
    await page.locator('#subject-len-comprension .subject-topic-test').click();
    assert.equal(await page.locator('#testBox .question').count(),8);
    await page.getByRole('button',{name:'Temas',exact:true}).click();

    for (const moduleId of ['lengua','ingles','geografia','historia','matematicas','ciencias']) {
      await page.evaluate(id => openModule(id),moduleId);
      const coverage = await page.evaluate(() => {
        const module = moduleById(state.activeModule);
        const ids = [...document.querySelectorAll('.subject-topic')].map(node => node.id.replace('subject-',''));
        return {expected:module.tasks.map(topic => topic.id), actual:ids};
      });
      assert.deepEqual([...coverage.actual].sort(),[...coverage.expected].sort(),`${moduleId}: faltan temas o están duplicados`);
    }
    await page.evaluate(() => openModule('lengua'));
    for (const width of [1024,768,390]) {
      await page.setViewportSize({width,height:844});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),true,`La biblioteca desborda a ${width}px`);
    }
    await page.locator('#subject-len-comprension .subject-topic-trigger').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),true,'La biblioteca desplegada desborda en móvil');
    await page.screenshot({path:path.resolve(__dirname,'../tools/eso-biblioteca-mobile.png'),fullPage:true});
    await page.reload();
    await page.evaluate(() => openModule('lengua'));
    assert.match(await page.locator('#moduleProgress').innerText(),/1 de 44 lecciones/);
    assert.deepEqual(errors,[]);
    console.log('ESO biblioteca: navegación, progreso, grupos, persistencia y móvil OK');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode=1;});
