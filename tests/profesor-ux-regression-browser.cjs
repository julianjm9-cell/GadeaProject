const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1920,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href+'#inicio');
    await page.evaluate(()=>{state.students=state.students.slice(0,1);render()});
    assert.equal(await page.locator('.home-roster-head').count(),0);
    assert.equal(await page.locator('.home-students .home-student-card').count(),1);
    assert((await page.locator('.home-students .home-student-card').boundingBox()).height<210);
    assert((await page.locator('.home-agenda-date').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)))<=15);
    await page.screenshot({path:'tools/profesor-ux-inicio-un-alumno.png'});

    await page.locator('.home-primary-nav').getByRole('button',{name:'Temario'}).click();
    const temario=await page.evaluate(()=>({filters:document.querySelector('.temario-controls').getBoundingClientRect().toJSON(),list:document.querySelector('.temario-list-panel').getBoundingClientRect().toJSON(),preview:document.querySelector('.temario-detail').getBoundingClientRect().toJSON()}));
    assert(temario.filters.bottom<temario.list.top+4);
    assert(temario.list.right<temario.preview.left);
    assert(Math.abs(temario.list.top-temario.preview.top)<3);
    await page.screenshot({path:'tools/profesor-ux-temario.png'});

    await page.locator('.home-primary-nav').getByRole('button',{name:'Material'}).click();
    const buttons=await page.locator('.material-page-tools>.actions button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().toJSON()));
    assert.equal(buttons.length,2);
    assert(Math.abs(buttons[0].height-buttons[1].height)<1);
    assert(Math.abs(buttons[0].width-buttons[1].width)<1);
    assert((await page.locator('.material-hub-card').first().boundingBox()).height<190);
    await page.screenshot({path:'tools/profesor-ux-materiales.png'});

    await page.locator('.home-primary-nav').getByRole('button',{name:'Alumnos'}).click();
    assert.equal(await page.locator('.students-hub-side').count(),0);
    assert.equal(await page.locator('.workspace-student-head h1').count(),0);
    assert((await page.locator('.workspace-students .home-student-card').first().boundingBox()).height<210);
    await page.screenshot({path:'tools/profesor-ux-alumnos-un-alumno.png'});
    await page.locator('.workspace-students .home-student-open').first().click();
    assert.equal(await page.locator('.student-section-nav>button').count(),9);
    const first=await page.locator('.student-section-nav').boundingBox();
    for(const name of ['Clases','Materiales','Progreso','Cobros','Acceso','Actividades','Perfil','Resumen']){
      await page.locator('.student-section-nav').getByRole('button',{name,exact:true}).click();
      const rect=await page.locator('.student-section-nav').boundingBox();
      assert(Math.abs(rect.x-first.x)<2&&Math.abs(rect.y-first.y)<2&&Math.abs(rect.width-first.width)<2,`${name}: navigation moved`);
      assert.equal(await page.locator('.student-section-nav>button').count(),9);
    }
    await page.screenshot({path:'tools/profesor-ux-alumno-detalle.png'});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    assert.equal(await page.locator('.student-section-nav>button').last().isVisible(),true);
    await page.screenshot({path:'tools/profesor-ux-alumno-mobile.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS compact cards, two-column temario, aligned actions and fixed student navigation');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
