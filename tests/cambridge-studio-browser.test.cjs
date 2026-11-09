const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('./browser-runtime.cjs');
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'tmp'),{recursive:true});

const {fixture}=require('./cambridge-studio-fixture.cjs');

for(const [name,engine,options] of [['Chromium',chromium,{headless:true,channel:'msedge'}],['WebKit',webkit,{headless:true}]]){
 test(name+': interactive English landing and workspace keep their routes, drafts and responsive layout',{timeout:120000},async()=>{
  const browser=await engine.launch(options);
  try{
   for(const width of [320,390,768,1440]){
    const page=await browser.newPage({viewport:{width,height:960},hasTouch:width<=768});const errors=[];
    page.on('pageerror',error=>errors.push(error.message));await fixture(page);
    await page.goto('http://studio.test/cambridge-info');
    assert.match(await page.locator('#googleEntry').getAttribute('href'),/next=%2Fcambridge/);
    assert.equal(await page.locator('.site-header').count(),0);
    assert.equal(await page.getByText('Ver por dentro',{exact:true}).count(),0);
    assert.equal(await page.locator('#level-title').innerText(),'NIVELES');
    await page.locator('.workspace-scene img').evaluate(img=>img.decode());
    const game=page.locator('[data-preview-open="games"]');
    const dialog=page.getByRole('dialog');
    assert.equal(await dialog.isVisible(),false);
    if(width===1440) {
     await game.focus();
     await page.keyboard.press('Enter');
    } else await game.tap();
    await dialog.waitFor();
    const plan=dialog.getByRole('button',{name:'Preparar mi viaje →'});
    assert.equal(await plan.isVisible(),false);
    await page.waitForFunction(()=>document.querySelector('.station-train').naturalWidth>0);
    for(const [index,label] of ['Aviso','Panel','Taquilla'].entries()){
     const clue=dialog.getByRole('button',{name:label,exact:true});
     if(width<=768)await clue.tap();
     else {await clue.focus();await page.keyboard.press('Enter');}
     assert.equal(await page.locator('#stationProgress').innerText(),`${index+1}/3 pistas`);
    }
    await dialog.getByRole('button',{name:'Aviso',exact:true}).click();
    assert.equal(await page.locator('#stationProgress').innerText(),'3/3 pistas');
    await plan.click();
    const departure=dialog.getByRole('combobox',{name:'Tren'}),platform=dialog.getByRole('combobox',{name:'Andén'}),ticket=dialog.getByRole('combobox',{name:'Billete'});
    const board=dialog.getByRole('button',{name:'Embarcar →'});
    await departure.selectOption('21:45');await platform.selectOption('4');await ticket.selectOption('exchange');
    await board.click();
    assert.match(await page.locator('#stationFeedback').innerText(),/cancelación/);
    await departure.selectOption('22:00');await board.click();
    assert.equal(await platform.getAttribute('aria-invalid'),'true');
    await dialog.getByRole('button',{name:'Taquilla',exact:true}).click();
    assert.equal(await departure.inputValue(),'22:00');
    await platform.selectOption('6');await board.click();
    assert.match(await page.locator('#stationFeedback').innerText(),/billete/);
    await ticket.selectOption('use');
    assert.ok(await dialog.evaluate(node=>node.scrollWidth-node.clientWidth<=2),'mission overflow '+width);
    if(name==='Chromium'&&[390,1440].includes(width))await dialog.screenshot({path:path.join(root,`tmp/ingles-estacion-mision-${width}.png`),animations:'disabled'});
    await board.click();
    assert.equal(await page.locator('#stationBoard').getAttribute('data-stage'),'arrived');
    assert.equal(await dialog.getByText('22:35 · Andén 6 · Billete válido').isVisible(),true);
    await dialog.getByRole('button',{name:'Volver a jugar'}).click();
    assert.equal(await page.locator('#stationProgress').innerText(),'0/3 pistas');
    assert.equal(await plan.isVisible(),false);
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(),false);
    assert.equal(await game.evaluate(button=>button===document.activeElement),true);
    await page.locator('[data-preview-open="lessons"]').click();
    await dialog.getByRole('button',{name:'C2 Proficiency'}).click();
    await page.locator('#sample-c2 summary').click();
    assert.match(await page.locator('#sample-c2').innerText(),/Sugges/);
    await dialog.getByRole('button',{name:'Cerrar vista interactiva'}).click();
    await page.locator('[data-preview-open="practice"]').click();
    assert.equal(await page.locator('#previewAudio').getAttribute('src'),'/assets/listening/b2-station.wav');
    await dialog.getByRole('button',{name:'Writing',exact:true}).click();
    await page.locator('#sampleAnswer').fill('I am writing to enquire.');
    assert.match(await page.locator('#sampleWordCount').innerText(),/5 palabras/);
    await dialog.getByRole('button',{name:'Cerrar vista interactiva'}).click();
    await page.locator('.faq details').nth(0).locator('summary').click();
    assert.equal(await page.locator('.faq details[open]').count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=2,'landing overflow '+width);
    if([390,1440].includes(width)&&name==='Chromium'){
     fs.mkdirSync(path.join(root,'tmp'),{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));
     await page.screenshot({path:path.join(root,'tmp/ingles-landing-interactiva-'+width+'.png')});
    }
    await page.goto('http://studio.test/cambridge');await page.waitForFunction(()=>cambridgeStateETag!==null);
    assert.equal(await page.locator('.workspace-header nav button').count(),3);
    assert.equal(await page.locator('.studio-welcome').count(),0);
    for(const img of await page.locator('.quick-mode img').filter({visible:true}).all())await img.evaluate(image=>image.decode());
    assert.equal(await page.getByRole('button',{name:'15 min',exact:true}).getAttribute('aria-pressed'),'true');
    const brand=await page.locator('.brand-area').boundingBox(),account=await page.locator('.header-right').boundingBox();
    assert.ok(brand.x+brand.width<=account.x+2,'header overlap '+width);
    if(name==='Chromium'&&[390,1440].includes(width))await page.screenshot({path:path.join(root,'tmp/ingles-inicio-simple-'+width+'.png')});
    await page.locator('.quick-skills').getByRole('button',{name:'Writing'}).click();
    await page.locator('#writingAnswer').fill('My writing stays here when I explore the new interface.');
    await page.locator('[data-tab-btn="sesion"]').click();
    await page.locator('#englishWritingResume').getByRole('button',{name:'Continuar →'}).click();
    assert.match(await page.locator('#writingAnswer').inputValue(),/My writing stays here/);
    for(const [level,count] of [['B2 First',6],['C1 Advanced',2],['C2 Proficiency',2]]){
     await page.locator('#headerExamLevel').selectOption(level);
     await page.locator('[data-tab-btn="juegos"]').click();
     assert.equal(await page.locator('#b2GameList .b2-card').count(),count);
     const routeImages=page.locator('.english-journey-art img');
     assert.equal(await routeImages.count(),6);
     for(const image of await routeImages.all())await image.scrollIntoViewIfNeeded();
     await page.waitForFunction(()=>[...document.querySelectorAll('.english-journey-art img')].every(image=>image.complete&&image.naturalWidth>0));
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`route overflow ${width}px at ${level}`);
     await page.locator('[data-tab-btn="b2"]').click();
     assert.equal(await page.locator('#b2LessonList .b2-card').count(),6);
    }
    const practice=page.locator('#tab-entrenar');
    await page.locator('[data-tab-btn="entrenar"]').click();
    const practiceList=practice.locator('.practice-list');
    const {x,width:practiceWidth}=await practiceList.boundingBox();
    assert.ok(Math.abs(x+practiceWidth/2-width/2)<=2,'practice cards centered '+width);
    assert.equal(await practiceList.evaluate(list=>getComputedStyle(list).gridTemplateColumns.split(' ').length),width<=620?1:3);
    for(const [label,tab] of [['Speaking','recitar'],['Writing','escrita']]){
     const option=practice.getByRole('button',{name:label,exact:true});
     if(width<=620)await option.tap();
     else {await option.focus();await page.keyboard.press('Enter');}
     const destination=page.locator('#tab-'+tab);
     assert.equal(await destination.getByRole('heading',{name:label,exact:true}).isVisible(),true);
     await destination.getByRole('button',{name:'← Práctica',exact:true}).click();
    }
    if(name==='Chromium'&&[390,1440].includes(width))await page.screenshot({path:path.join(root,'tmp/ingles-practica-'+width+'.png')});
    for(const tab of ['temas','entrenar','examenes','progreso','perfil','sesion']){
     if(['temas','progreso'].includes(tab)){
      await page.locator('[data-tab-btn="sesion"]').click();
      await page.locator('#sessionEmpty .workspace-links').getByRole('button',{name:tab==='temas'?'Biblioteca':'Mi progreso'}).click();
     }else if(tab==='examenes'){
      await page.locator('[data-tab-btn="entrenar"]').click();
      await page.locator('#tab-entrenar').getByRole('button',{name:/Listening B2/}).click();
     }else await page.locator('[data-tab-btn="'+tab+'"]').click();
     assert.equal(await page.locator('#tab-'+tab).isVisible(),true);
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,inner:innerWidth,body:document.body.scrollWidth,items:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().right>document.documentElement.clientWidth+2).slice(0,8).map(e=>({tag:e.tagName,id:e.id,class:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))}));
     if(layout.overflow>2)await page.screenshot({path:path.join(root,'tmp/ingles-layout-failure.png'),fullPage:true});
     assert.ok(layout.overflow<=2,'app '+tab+' overflow '+width+' '+JSON.stringify(layout));
    }
    if(width===390){
     await page.locator('#headerExamLevel').selectOption('B2 First');await page.locator('[data-tab-btn="sesion"]').click();
     await page.getByRole('button',{name:'Empezar sesión →'}).click();
     assert.equal(await page.evaluate(()=>state.currentSession.duration),15);
     await page.locator('[data-tab-btn="sesion"]').click();
     assert.equal(await page.locator('#englishSessionOptions').evaluate(details=>details.open),false);
     await page.getByRole('button',{name:'Reanudar sesión →'}).click();
     assert.equal(await page.locator('#sessionActive').isVisible(),true);
     await page.locator('[data-tab-btn="b2"]').click();
     await page.locator('#b2LessonList button').first().click();
     assert.equal(await page.locator('#b2LessonOverview').isVisible(),false);
     await page.getByRole('button',{name:'← Volver al temario'}).click();
     assert.equal(await page.locator('#b2LessonOverview').isVisible(),true);
    }
    assert.deepEqual(errors,[]);await page.close();
   }
  }finally{await browser.close();}
 });
}

test('paused English disables every landing entry while keeping the public trial usable',async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();await fixture(page,{paused:true});await page.goto('http://studio.test/cambridge-info');
  await page.locator('#googleStatus').waitFor();
  assert.equal(await page.locator('.app-entry[href]').count(),0);
  assert.equal(await page.locator('.app-entry[aria-disabled=true]').count(),1);
  await page.locator('[data-preview-open="games"]').click();
  await page.getByRole('dialog').getByRole('button',{name:'Panel',exact:true}).click();
  assert.equal(await page.locator('#stationProgress').innerText(),'1/3 pistas');
 }finally{await browser.close();}
});

test('study and game modes share topics, unlock the next stop and restore each level',async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
  await fixture(page);
  await page.goto('http://studio.test/cambridge');
  await page.waitForFunction(()=>cambridgeStateETag!==null);
  const mode=page.getByRole('button',{name:'Modo juegos',exact:true});
  const stops=page.locator('.english-journey-stop');
  const next=stops.filter({has:page.getByRole('button',{name:'Jugar →',exact:true})}).first();
  await page.locator('#headerExamLevel').selectOption('B2 First');
  await mode.tap();
  assert.equal(await stops.count(),6);
  assert.equal(await stops.locator('button').count(),1);
  assert.match(await next.innerText(),/Collocations/);
  assert.equal(await stops.filter({hasText:'Bloqueada'}).count(),5);
  await page.locator('.english-journey-art img').first().evaluate(image=>image.decode());
  await page.screenshot({path:path.join(root,'tmp/ingles-mapa-ilustrado-390.png')});
  await next.getByRole('button').tap();
  for(let stage=0;stage<3;stage++){
   await page.locator('[data-mission-choice="0"]').tap();
   await page.locator('[data-mission-place]').first().tap();
   await page.locator('#b2GameNext button').tap();
  }
  await page.getByRole('button',{name:'Volver al recorrido →'}).tap();
  assert.match(await stops.nth(0).innerText(),/Completada/);
  assert.match(await stops.nth(1).getAttribute('aria-current'),/step/);
  await page.getByRole('button',{name:'Modo temario',exact:true}).tap();
  assert.match(await page.locator('#b2LessonList').innerText(),/Collocations/);
  await page.locator('#headerExamLevel').selectOption('C1 Advanced');
  await mode.tap();
  assert.match(await page.locator('.english-journey-meter').innerText(),/0\/6/);
  await page.locator('[aria-current="step"] button').tap();
  for(let stage=0;stage<2;stage++){
   const correct=await page.evaluate(()=>englishRouteGame(activeB2Game).stages[activeB2Stage].correct);
   await page.locator(`[data-mission-choice="${correct}"]`).tap();
   await page.locator('[data-mission-place]').first().tap();
   await page.locator('#b2GameNext button').tap();
  }
  assert.match(await stops.nth(0).innerText(),/Completada/);
  await page.locator('[aria-current="step"] button').tap();
  assert.match(await page.locator('.mission-stage-count').innerText(),/3\/5/);
  await page.evaluate(()=>cambridgeSaveQueue);
  await page.reload();
  await page.waitForFunction(()=>cambridgeStateETag!==null);
  await page.locator('#headerExamLevel').selectOption('B2 First');
  await mode.tap();
  assert.match(await page.locator('.english-journey-meter').innerText(),/1\/6/);
  await page.setViewportSize({width:1440,height:960});
  await page.getByRole('button',{name:'Continuar recorrido →'}).waitFor();
  await page.locator('.english-journey-art img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  await page.screenshot({path:path.join(root,'tmp/ingles-mapa-ilustrado-1440.png')});
  await page.getByRole('button',{name:'Ver catálogo de juegos ↓'}).click();
  assert.equal(await page.locator('#englishGameCatalog summary').evaluate(summary=>summary===document.activeElement),true);
  await page.locator('.english-catalog-art img').last().evaluate(image=>image.decode());
  assert.equal(await page.locator('#b2GameList .b2-card button').last().isVisible(),true);
 }finally{await browser.close();}
});
