const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const errors=[];
  const url=pathToFileURL(path.resolve('apps/profesor/index.html')).href;
  const desktop=await browser.newPage({viewport:{width:1366,height:768}});
  desktop.on('pageerror',e=>errors.push(e.message));
  await desktop.goto(url);
  await desktop.locator('.home-primary-nav').getByRole('button',{name:'Material'}).click();
  assert.equal(await desktop.locator('.material-hub-card .material-art,.material-hub-card .material-hover-preview').count(),0);
  assert.equal(await desktop.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true,'desktop Material');
  await desktop.locator('.home-primary-nav').getByRole('button',{name:'Alumnos'}).click();
  assert.equal(await desktop.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true,'desktop Alumnos');
  await desktop.locator('.home-primary-nav').getByRole('button',{name:'Material'}).click();
  await desktop.evaluate(()=>{demo=false;window.generated=[];api=async(route,body)=>{if(route==='/api/profesor/generate'){window.generated.push(body);return {questions:[{type:'flashcard',prompt:'¿Cuánto es un medio de diez?',answer:'Cinco',options:[]}]}}return {}}});
  await desktop.getByRole('button',{name:'Crear material',exact:true}).click();
  assert.equal(await desktop.getByRole('button',{name:/Generar con IA/}).isVisible(),true);
  assert.equal(await desktop.locator('.studio-advanced').isVisible(),false);
  await desktop.locator('#workshopCourse').selectOption('4.º Primaria');
  await desktop.locator('#workshopTopic').fill('Fracciones');
  await desktop.locator('[data-exercise="flashcard"]').click();
  assert.equal(await desktop.locator('dialog').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true);
  await desktop.locator('#workshopContinue').click();
  await desktop.locator('#q-0').waitFor();
  assert.equal(await desktop.locator('#q-0').inputValue(),'¿Cuánto es un medio de diez?');
  assert.equal(await desktop.evaluate(()=>window.generated.length),1);

  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(url);
  for(const panel of ['students','classes','tasks']){
   await mobile.locator(`[data-action="homeMobilePanel"][data-id="${panel}"]`).click();
   assert.equal(await mobile.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true,panel);
  }
  await mobile.locator('.home-primary-nav').getByRole('button',{name:'Material'}).click();
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true,'Material');
  await mobile.getByRole('button',{name:'Crear material',exact:true}).click();
  for(const category of ['basic','game','photo']){
   await mobile.locator(`[data-workshop-category="${category}"]`).click();
   assert.equal(await mobile.locator('dialog').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,category);
  }
  await mobile.locator('#dialog').getByRole('button',{name:'Cerrar'}).click();
  await mobile.setViewportSize({width:375,height:667});
  for(const section of ['Material','Alumnos','Inicio']){
   await mobile.locator('.home-primary-nav').getByRole('button',{name:section,exact:true}).click();
   assert.equal(await mobile.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true,section+' short mobile');
   const lastCard=section==='Material'?'.material-hub-card:last-child':section==='Alumnos'?'.workspace-students .home-student-card:last-child':'.home-students .home-student-card:last-child';
   assert.equal(await mobile.locator(lastCard).evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight-5),true,section+' last card visible');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS compact material cards, AI creation, and no-scroll top-level screens and creator');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
