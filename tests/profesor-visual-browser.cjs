const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href+'#biblioteca');
  await page.getByRole('button',{name:'Crear material',exact:true}).click();
  await page.getByLabel('Contenido o tema').fill('Bosque');
  await page.locator('#workshopCourse').fill('4.º Primaria');
  await page.locator('[data-exercise="visualquiz"]').click();
  await page.locator('[data-exercise="imagepoint"]').click();
  await page.locator('.studio-advanced summary').click();
  await page.locator('#count-pairs').fill('0');
  await page.getByRole('button',{name:/Continuar/}).click();
  await page.locator('#image-0').waitFor();
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAA6klEQVR4nO3SMREAIRAEQXj/IpCEI97CTd4dbzS1+9y3mPmGO8RqPCsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArEGvN/ZTHAzfLJCsjAAAAAElFTkSuQmCC','base64');
  for(const n of [0,1])await page.locator('#image-'+n).setInputFiles({name:'bosque.png',mimeType:'image/png',buffer:png});
  await page.locator('#q-0').fill('¿Qué aparece?');
  await page.locator('#o-0').fill('Árbol\nCasa\nCoche');
  await page.locator('#a-0').fill('Árbol');
  await page.locator('#q-1').fill('Señala el centro');
  await page.locator('#image-preview-1 img').click({position:{x:50,y:50}});
  assert.equal(await page.locator('#image-preview-1 .visual-target-marker').count(),1);
  await page.getByRole('button',{name:'Guardar material',exact:true}).click();
  assert.equal(await page.evaluate(()=>state.library.find(m=>m.title==='Bosque').activity.questions.length),2);
  await page.getByRole('button',{name:'Probar sin guardar'}).click();
  assert.equal(await page.locator('.visual-image-box img').count(),2);
  await page.locator('#r-0').selectOption('Árbol');
  await page.locator('#visual-1 img').click({position:{x:50,y:50}});
  await page.getByRole('button',{name:'Comprobar respuestas'}).click();
  assert.match(await page.locator('#activityScore').innerText(),/2\/2 correctas/);
  await page.reload();
  assert.equal(await page.evaluate(()=>state.library.find(m=>m.title==='Bosque').activity.questions[1].target.x),50);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>runActivity(state.library.find(m=>m.title==='Bosque'),''));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.deepEqual(errors,[]);
  console.log('PASS visual quiz and image point: upload, mark, save, solve, persistence');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
