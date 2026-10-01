const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href+'#temario');
  await page.getByRole('heading',{name:'Temario',exact:true}).waitFor();
  const coverage=await page.evaluate(()=>{
   const topics=Object.values(PROFESOR_TEMARIO).flatMap(subjects=>Object.values(subjects).flat());
   return {courses:Object.keys(PROFESOR_TEMARIO).length,topics:topics.length,incomplete:topics.filter(topic=>!topic.didactic?.objective||!topic.didactic?.explanation||!topic.didactic?.concepts?.length||!topic.didactic?.examples?.length||!topic.didactic?.commonErrors?.length||!topic.didactic?.practice?.length||!topic.didactic?.activities?.length||!topic.didactic?.solutions?.length).length};
  });
  assert.deepEqual(coverage,{courses:12,topics:279,incomplete:0});
  assert.equal(await page.locator('.temario-controls select').count(),2);
  assert.equal(await page.locator('.temario-controls input').count(),1);
  assert.equal(await page.locator('.temario-detail button').count(),2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);

  await page.locator('#temarioSubject').selectOption('Inglés');
  assert.equal(await page.locator('.temario-topic').count(),5);
  await page.setViewportSize({width:1252,height:670});
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.temario-topic')[4].getBoundingClientRect().bottom<=innerHeight),true,'five topics are visible without page scrolling');
  assert.equal(await page.evaluate(()=>document.querySelector('.temario-main-actions').getBoundingClientRect().bottom<=innerHeight),true,'preview action remains visible');
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#temarioSearch').fill('conditionals');
  assert.equal(await page.locator('.temario-topic').count(),1);
  await page.locator('#temarioSearch').fill('');
  await page.locator('#temarioSubject').selectOption('Matemáticas');
  await page.getByRole('button',{name:/Ecuaciones/}).first().click();
  assert.match(await page.locator('.temario-preview-explanation').innerText(),/ecuaci/i);
  await page.getByRole('button',{name:'Ver tema'}).click();
  await page.screenshot({path:'tools/profesor-temario-leccion.png'});
  assert.equal(await page.locator('.temario-lesson section').count(),3);
  assert.equal(await page.locator('.temario-extra').evaluate(el=>el.open),false);
  await page.locator('.temario-extra summary').click();
  assert.match(await page.locator('.temario-extra').innerText(),/Error frecuente/);
  await page.getByRole('button',{name:'Practicar ahora'}).click();
  assert.equal(await page.locator('#dialog.activity-play[open]').count(),1);
  assert.equal(await page.locator('[name="r-0"]').count(),1);
  await page.locator('#dialog .close').click();

  await page.getByRole('button',{name:'Usar en material'}).click();
  assert.equal(await page.locator('#temarioOwner option').count()>1,true);
  await page.locator('#temarioOwner').selectOption('lucia');
  await page.getByRole('button',{name:'Continuar a Materiales'}).click();
  await page.locator('#workshopCourse').waitFor();
  assert.equal(await page.locator('#workshopStudent').inputValue(),'lucia');
  assert.match(await page.locator('#workshopCourse').inputValue(),/^3[.º\s]*ESO$/);
  assert.equal(await page.locator('#workshopSubject').inputValue(),'Matemáticas');
  assert.equal(await page.locator('#workshopTopic').inputValue(),'Ecuaciones');
  assert.equal(await page.locator('#count-gaps').inputValue(),'3');
  assert.equal(await page.locator('#count-problem').inputValue(),'0');
  assert.equal(await page.locator('.home-primary-nav button.active').innerText(),'Material');
  await page.locator('#dialog .close').click();

  await page.setViewportSize({width:390,height:844});
  await page.locator('.home-primary-nav').getByRole('button',{name:'Temario'}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.deepEqual(errors,[]);
  console.log('PASS Temario: 279 fichas, flujo sencillo, práctica y uso en Materiales');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
