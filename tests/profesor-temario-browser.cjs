const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href+'#temario');
  await page.getByRole('heading',{name:'Temario',exact:true}).waitFor();
  const coverage=await page.evaluate(()=>({courses:Object.keys(PROFESOR_TEMARIO).length,topics:Object.values(PROFESOR_TEMARIO).flatMap(subjects=>Object.values(subjects).flat()).length,invalid:Object.values(PROFESOR_TEMARIO).flatMap(subjects=>Object.values(subjects).flat()).filter(topic=>['title','explanation','example','question','answer'].some(key=>!topic[key])).length}));
  assert.deepEqual(coverage,{courses:12,topics:279,invalid:0});
  assert.equal(await page.locator('.temario-topic').count(),6);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await page.setViewportSize({width:1366,height:768});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+2),false);
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:/Ecuaciones/}).first().click();
  assert.match(await page.locator('.temario-preview-explanation').innerText(),/ecuaci/i);
  await page.getByRole('button',{name:/Ver tema/}).click();
  assert.match(await page.locator('.temario-lesson').innerText(),/3\(x − 2\)/);
  await page.getByRole('button',{name:'Mostrar solución'}).click();
  assert.equal(await page.locator('.temario-lesson-answer').isVisible(),true);
  await page.getByRole('button',{name:'Cerrar',exact:true}).last().click();
  await page.getByRole('button',{name:/Usar en material/}).click();
  assert.equal(await page.locator('#workshopCourse').inputValue(),'3.º ESO');
  assert.equal(await page.locator('#workshopSubject').inputValue(),'Matemáticas');
  assert.equal(await page.locator('#workshopTopic').inputValue(),'Ecuaciones');
  await page.locator('#dialog .close').click();
  await page.getByRole('button',{name:/Planificar con alumno/}).click();
  assert.equal(await page.locator('#temarioStudent').inputValue(),'lucia');
  await page.getByRole('button',{name:'Añadir a mi plan'}).click();
  await page.evaluate(()=>saveQueue);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('profesor-demo-v1')).tasks.some(task=>task.title==='Trabajar Ecuaciones'&&task.studentId==='lucia')),true);
  await page.locator('#temarioCourse').selectOption('1.º Primaria');
  assert.equal(await page.locator('.temario-topic').count(),5);
  await page.locator('#temarioSubject').selectOption('Ciencias Naturales');
  await page.locator('#temarioSearch').fill('sentidos');
  assert.equal(await page.locator('.temario-topic').count(),1);
  await page.locator('#temarioSearch').fill('');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.deepEqual(errors,[]);
  console.log('profesor temario: ok');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
