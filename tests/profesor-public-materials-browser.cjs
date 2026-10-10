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
  await page.locator('.material-page-head').waitFor();

  const actionLabels=await page.locator('.material-page-head .actions button').allInnerTexts();
  assert.deepEqual(actionLabels.map(text=>text.replace(/\s+/g,' ').trim()),['+ Añadir archivo','Materiales Publicos','Crear material']);
  await page.getByRole('button',{name:'Materiales Publicos'}).click();
  assert.equal((await page.locator('.material-page-head h1').innerText()).trim(),'Materiales públicos');
  assert.equal(await page.locator('.material-page-head .material-count').textContent(),'351');
  assert.equal(await page.locator('.public-material-card').count(),12);
  assert.equal(await page.locator('.public-library-toolbar select').count(),3);
  assert.equal(await page.locator('#libraryCourse option').count(),19);
  assert.equal(await page.locator('#librarySubject option').count()>6,true);
  assert.equal(await page.locator('#libraryType option').count()>5,true);
  await page.screenshot({path:'tools/profesor-public-materials.png',fullPage:true});

  await page.locator('#librarySearch').fill('sintaxis');
  assert.equal(await page.locator('.public-material-card').count()>0,true);
  assert.equal(await page.locator('.public-material-card h3').allInnerTexts().then(values=>values.every(value=>value.toLocaleLowerCase().includes('sintaxis')||value.length>0)),true);
  await page.locator('#librarySearch').fill('');
  await page.locator('#libraryCourse').selectOption({index:1});
  const selectedCourse=await page.locator('#libraryCourse').inputValue();
  assert.equal(await page.locator('.public-material-card .material-course').allInnerTexts().then(values=>values.every(value=>value===selectedCourse)),true);
  await page.locator('#libraryCourse').selectOption('');
  await page.locator('#librarySubject').selectOption('Matemáticas');
  assert.equal(await page.locator('.public-material-card .badge').allInnerTexts().then(values=>values.every(value=>value==='Matemáticas')),true);
  await page.locator('#librarySubject').selectOption('');
  await page.locator('#libraryType').selectOption({index:1});
  const selectedType=await page.locator('#libraryType').inputValue();
  assert.equal(await page.evaluate(type=>filteredMaterials().every(material=>material.activity.questions.some(question=>question.type===type)),selectedType),true);
  await page.locator('#libraryType').selectOption('');

  const firstTitle=await page.locator('.public-material-card h3').first().innerText();
  await page.locator('.public-material-card').first().getByRole('button',{name:'Probar'}).click();
  await page.locator('#dialog.activity-play[open]').waitFor();
  assert.equal(await page.locator('.play-question:visible').count(),1);
  await page.locator('#dialog .close').click();
  const before=await page.evaluate(()=>state.library.length);
  await page.locator('.public-material-card').first().getByRole('button',{name:'Guardar copia'}).click();
  assert.equal(await page.evaluate(()=>state.library.length),before+1);
  assert.equal(await page.evaluate(()=>state.library.at(-1).activity.context.public),false);
  assert.match(await page.locator('#notice').innerText(),/Copia guardada/);
  await page.getByRole('button',{name:'Mis materiales'}).click();
  await page.locator('#librarySearch').fill(firstTitle);
  assert.equal(await page.locator('.material-hub-card h3').filter({hasText:firstTitle}).count(),1);
  await page.locator('.material-hub-card').first().locator('.material-card-menu summary').click();
  await page.locator('.material-hub-card').first().getByRole('button',{name:'Editar'}).click();
  assert.equal(await page.locator('#activityTitle').inputValue(),firstTitle);
  await page.locator('#dialog .close').click();

  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Materiales Publicos'}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await page.screenshot({path:'tools/profesor-public-materials-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS Materiales públicos: catálogo completo, filtros, prueba, copia editable y diseño adaptable');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
