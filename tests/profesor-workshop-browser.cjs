const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href+'#alumnos/lucia/Biblioteca');
    await page.getByRole('button',{name:'Crear material',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Perfil',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Acceso',exact:true}).count(),0);
    assert.equal(await page.locator('[data-exercise]').count(),19);
    assert.equal(await page.locator('[data-planned]').count(),0);
    assert.equal(await page.locator('#workshopContinue').isDisabled(),true);

    await page.getByLabel('Contenido o tema').fill('Multiplicaciones');
    await page.getByLabel('Ambientación (opcional)',{exact:true}).fill('Animales');
    await page.locator('[data-exercise="pairs"]').click();
    await page.locator('[data-exercise="gaps"]').click();
    assert.equal(await page.locator('#count-pairs').inputValue(),'3');
    assert.equal(await page.locator('[data-exercise="gaps"]').getAttribute('data-count'),'3');
    assert.match(await page.locator('#workshopPreview').innerText(),/6 ejercicios · 2 tipos/);
    assert.equal(await page.locator('#workshopContinue').isDisabled(),false);
    await page.locator('.studio-advanced summary').click();
    await page.locator('#count-pairs').fill('1');
    assert.match(await page.locator('#workshopPreview').innerText(),/4 ejercicios · 2 tipos/);
    await page.screenshot({path:'tools/profesor-workshop-v2.png'});

    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    console.log('PASS 19 usable formats, explicit selection, live counts and mobile');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
