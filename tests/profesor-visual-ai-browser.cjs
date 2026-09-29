const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href+'#biblioteca');
  await page.evaluate(()=>{
   demo=false;
   window.generatorRequest=null;
   window.api=async(url,body)=>{
    if(url==='/api/profesor/generate'){
     window.generatorRequest=body;
     return {questions:[{type:'memory',prompt:'Empareja los deportes',answer:'Completado',options:['Fútbol | Football','Tenis | Tennis']}]};
    }
    if(url==='/api/state')return {ok:true};
    throw Error('Ruta inesperada: '+url);
   };
  });
  await page.getByRole('button',{name:'Crear material',exact:true}).click();
  await page.getByLabel('Contenido o tema').fill('Deportes');
  await page.locator('#workshopCourse').selectOption('3.º ESO');
  assert.equal(await page.locator('[data-exercise="visualquiz"]').isVisible(),false);
  await page.locator('.photo-manual summary').click();
  await page.locator('[data-exercise="visualquiz"]').click();
  assert.equal(await page.locator('#workshopMode option[value="ai"]').isDisabled(),true);
  assert.match(await page.locator('.creation-method p').innerText(),/manualmente/);
  await page.locator('[data-exercise="memory"]').click();
  assert.equal(await page.locator('#workshopMode option[value="ai"]').isDisabled(),false);
  await page.getByLabel('Preparar el contenido').selectOption('ai');
  await page.getByRole('button',{name:/Continuar/}).click();
  await page.getByRole('button',{name:'Guardar material',exact:true}).waitFor();
  const payload=await page.evaluate(()=>window.generatorRequest);
  assert.equal(payload.visualquiz,0);
  assert.equal(payload.memory,1);
  assert.equal(await page.locator('#q-0').inputValue(),'Empareja los deportes');
  assert.equal(await page.locator('#q-1').inputValue(),'');
  assert.match(await page.locator('#editorPreview').innerText(),/Football/);
  assert.deepEqual(errors,[]);
  console.log('PASS AI prepares photo-free games; photo activities remain clearly manual');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
