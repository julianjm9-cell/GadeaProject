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
  const png='iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAA6klEQVR4nO3SMREAIRAEQXj/IpCEI97CTd4dbzS1+9y3mPmGO8RqPCsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArEGvN/ZTHAzfLJCsjAAAAAElFTkSuQmCC';
  await page.evaluate(png=>{
   demo=false;
   const raw=Uint8Array.from(atob(png),c=>c.charCodeAt(0));
   window.api=async (url,body)=>{
    if(url.startsWith('/api/profesor/images/search'))return {images:[{id:42,preview:'data:image/png;base64,'+png,author:'Ana',page:'https://pixabay.com/photos/cat-42/',tags:'gato'}]};
    if(url==='/api/profesor/images/import')return {id:'mock-image',filename:'pixabay-42.jpg',size:raw.length,credit:'Imagen de Ana en Pixabay',creditUrl:'https://pixabay.com/photos/cat-42/'};
    if(url==='/api/state')return {ok:true};
    throw Error('Ruta inesperada: '+url);
   };
   window.authenticatedFetch=async()=>new Response(raw,{status:200,headers:{'Content-Type':'image/png'}});
  },png);
  await page.getByRole('button',{name:'Crear material',exact:true}).click();
  await page.getByLabel('Contenido o tema').fill('Bosque');
  await page.locator('#workshopCourse').selectOption('4.º Primaria');
  await page.locator('.photo-manual summary').click();
  await page.locator('[data-exercise="visualquiz"]').click();
  await page.locator('[data-exercise="imagepoint"]').click();
  await page.locator('#workshopManual').click();
  assert.equal(await page.locator('input[type="file"]').count(),0);
  assert.equal(await page.locator('#editorPreview img').count(),0);
  await page.locator('#editorPreview [data-search-preview="0"]').click();
  assert.equal(await page.locator('#pixabay-picker-0').isVisible(),true);
  await page.locator('#pixabay-results-0 [data-pixabay-id]').first().click();
  await page.locator('#image-preview-0 img').waitFor();
  assert.equal(await page.locator('#editorPreview .visual-placeholder').count(),0);
  await page.locator('#q-0').fill('¿Qué aparece?');
  while(await page.locator('#edit-question-0 .structured-row input').count()<3) await page.locator('#edit-question-0 [data-add-row]').click();
  for(const [i,value] of ['Árbol','Casa','Coche'].entries()) await page.locator('#edit-question-0 .structured-row input').nth(i).fill(value);
  await page.locator('#a-0').fill('Árbol');
  await page.locator('#editorNext').click();
  await page.locator('#search-image-1').click();
  await page.locator('#pixabay-results-1 [data-pixabay-id]').first().click();
  await page.locator('#image-preview-1 img').waitFor();
  await page.locator('#q-1').fill('Señala el centro');
  await page.locator('#image-preview-1 img').click({position:{x:50,y:50}});
  assert.equal(await page.locator('#image-preview-1 .visual-solution-zone').count(),1);
  await page.getByRole('button',{name:'Guardar y cerrar',exact:true}).click();
  assert.equal(await page.evaluate(()=>state.library.find(m=>m.title==='Bosque').activity.questions.length),2);
  await page.evaluate(()=>openMaterial(state.library.find(m=>m.title==='Bosque').id));
  await page.getByRole('button',{name:'Probar sin guardar'}).click();
  assert.equal(await page.locator('.visual-image-box img').count(),2);
  await page.getByRole('radio',{name:/Árbol/}).check();
  await page.getByRole('button',{name:'Actividad siguiente'}).click();
  await page.locator('#visual-1 img').click({position:{x:50,y:50}});
  await page.getByRole('button',{name:'Terminar',exact:true}).click();
  assert.match(await page.locator('#activityScore').innerText(),/2\/2 correctas/);
  await page.evaluate(()=>localStorage.setItem('profesor-demo-v1',JSON.stringify(state)));
  await page.reload();
  assert.equal(await page.evaluate(()=>state.library.find(m=>m.title==='Bosque').activity.questions[1].target.x),50);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>runActivity(state.library.find(m=>m.title==='Bosque'),''));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.deepEqual(errors,[]);
  console.log('PASS Pixabay visual quiz and image point: search, select, mark, save, solve, persistence');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
