const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('./browser-runtime.cjs');
const {fixture,root}=require('./cambridge-studio-fixture.cjs');

const apps=[
 {id:'cambridge',path:'cambridge',names:['Club de Londres','Biblioteca británica'],looks:['london','library'],nav:'.workspace-header',tab:'[data-tab-btn="juegos"]',card:'.english-journey-stop article'},
 {id:'eso_adultos',path:'eso-adultos',names:['Aula mediterránea','Observatorio'],looks:['courtyard','observatory'],nav:'.app > header',tab:'#navModules',card:'.subject-tile'},
];

for(const [name,engine,options,width] of [['Chromium',chromium,{headless:true,channel:'msedge'},1440],['WebKit',webkit,{headless:true},390]]){
 test(name+': ambos perfiles permiten probar, cancelar, guardar y recuperar la apariencia',{timeout:90000},async()=>{
  const browser=await engine.launch(options);
  try{
   for(const app of apps){
    const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<500});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await fixture(page);
    let saved='original',fail=true;
    await page.route('**/api/study-appearance',async route=>{
     const request=route.request();
     assert.equal(request.headers()['x-client-app'],app.id);
     if(request.method()==='POST'){
      if(fail)return route.fulfill({status:503,json:{detail:'unavailable'}});
      saved=request.postDataJSON().look;
     }
     return route.fulfill({json:{look:saved}});
    });
    await page.goto('http://studio.test/'+app.path);
    const html=page.locator('html');
    const originalNav=await page.locator(app.nav).evaluate(node=>getComputedStyle(node).backgroundColor);
    const profile=page.getByRole('button',{name:'Perfil',exact:true});
    await profile.click();
    const opener=page.getByRole('button',{name:'Cambiar estilo'});
    const dialog=page.getByRole('dialog',{name:'Apariencia'});
    await opener.click();
    const first=dialog.getByRole('radio',{name:app.names[0]});
    await first.check();
    assert.equal(await html.getAttribute('data-study-look'),app.looks[0]);
    assert.equal(await page.locator(app.nav).evaluate(node=>getComputedStyle(node).backgroundColor)===originalNav,false);
    assert.match(await dialog.locator('[data-look-preview="original"]').evaluate(node=>getComputedStyle(node).backgroundImage),/^linear-gradient/);
    assert.ok(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+2),'appearance dialog fits the viewport');
    fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
    await page.screenshot({path:path.join(root,`tmp/${app.path}-apariencia-${width}.png`)});
    if(width===390){
     await page.setViewportSize({width:320,height:740});
     assert.ok(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+2),'appearance dialog fits a narrow phone');
     await page.setViewportSize({width,height:900});
    }
    await page.keyboard.press('Escape');
    await dialog.waitFor({state:'hidden'});
    await page.waitForFunction(()=>!document.documentElement.dataset.studyLook);
    assert.equal(await opener.evaluate(node=>node===document.activeElement),true);

    await opener.click();
    await dialog.getByRole('radio',{name:app.names[1]}).check();
    const submit=dialog.getByRole('button',{name:'Guardar estilo'});
    await submit.click();
    await dialog.getByText('No se pudo guardar el estilo.',{exact:false}).waitFor();
    assert.equal(saved,'original');
    assert.equal(await html.getAttribute('data-study-look'),app.looks[1]);
    fail=false;
    await submit.click();
    await dialog.waitFor({state:'hidden'});
    assert.equal(saved,app.looks[1]);
    await page.reload();
    await page.waitForFunction(look=>document.documentElement.dataset.studyLook===look,saved);
    await page.locator(app.tab).click();
    assert.ok(await page.locator(app.card).first().isVisible());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    if(app.id==='eso_adultos')await page.locator('#esoSaveStatus').waitFor({state:'hidden'});
    await page.screenshot({path:path.join(root,`tmp/${app.path}-${saved}-${width}.png`)});
    await profile.click();
    await opener.click();
    await dialog.getByRole('radio',{name:'Estilo original'}).check();
    await submit.click();
    await dialog.waitFor({state:'hidden'});
    assert.equal(saved,'original');
    assert.equal(await html.getAttribute('data-study-look'),null);
    assert.equal(await page.locator(app.nav).evaluate(node=>getComputedStyle(node).backgroundColor),originalNav);
    assert.deepEqual(errors,[]);
    await page.close();
   }
  }finally{await browser.close();}
 });
}
