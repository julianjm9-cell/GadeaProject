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
  await page.locator('.temario-controls').waitFor();
  const coverage=await page.evaluate(()=>{
   const topics=Object.values(PROFESOR_TEMARIO).flatMap(subjects=>Object.values(subjects).flat());
   return {courses:Object.keys(PROFESOR_TEMARIO).length,topics:topics.length,incomplete:topics.filter(topic=>!topic.didactic?.objective||!topic.didactic?.explanation||!topic.didactic?.concepts?.length||!topic.didactic?.examples?.length||!topic.didactic?.commonErrors?.length||!topic.didactic?.practice?.length||!topic.didactic?.activities?.length||!topic.didactic?.solutions?.length||topic.didactic?.deepDive?.length<70||topic.didactic?.steps?.length!==3||!topic.didactic?.recognition||!topic.didactic?.transfer||topic.didactic?.preparedMaterial?.questions?.length!==6).length};
  });
  assert.deepEqual(coverage,{courses:12,topics:279,incomplete:0});
  const lessonAudit=await page.evaluate(()=>{
    const failed=[];let rendered=0,materials=0;
    for(const [course,subjects] of Object.entries(PROFESOR_TEMARIO))for(const [subject,topics] of Object.entries(subjects))for(const topic of topics){
      try{temarioCourse=course;temarioSubject=subject;const prepared=preparedTopicMaterial(topic),clean=validateActivityQuestions(prepared.activity.questions);if(clean.length!==6||new Set(clean.map(question=>question.type)).size<5)throw Error('material preparado demasiado breve o repetitivo');materials++;openTemarioLesson(topic);rendered++;const detail=document.querySelector('.temario-lesson');if(!detail?.textContent.includes(topic.didactic.deepDive)||detail.querySelectorAll('.lesson-steps li').length!==3||detail.querySelectorAll('.lesson-class-guide>div').length!==3)failed.push(topic.id);$('dialog').close()}
      catch(error){failed.push(topic.id+': '+error.message);if($('dialog').open)$('dialog').close()}
    }
    temarioCourse='3.º ESO';temarioSubject='Matemáticas';render();return {rendered,materials,failed};
  });
  assert.equal(lessonAudit.rendered,279);
  assert.equal(lessonAudit.materials,279);
  assert.deepEqual(lessonAudit.failed,[]);
  assert.equal(await page.locator('.temario-controls select').count(),3);
  assert.equal(await page.locator('.temario-heading').count(),0);
  assert.match(await page.locator('.temario-base-count').innerText(),/6 temas/);
  assert.equal(await page.locator('.temario-controls input').count(),1);
  assert.equal(await page.locator('.temario-resource').count(),3);
  assert.match(await page.locator('.temario-prepared').innerText(),/6 actividades/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.equal(await page.evaluate(()=>document.querySelector('.temario-main-actions').getBoundingClientRect().bottom<=innerHeight),true,'actions fit at normal desktop height');
  await page.getByRole('button',{name:'Abrir Esquema resumen'}).click();
  assert.match(await page.locator('.topic-resource-view').innerText(),/Cómo abordarlo|Un ejemplo/);
  await page.locator('#dialog .close').click();

  await page.locator('#temarioSubject').selectOption('Inglés');
  assert.equal(await page.locator('.temario-topic').count(),5);
  await page.setViewportSize({width:1252,height:670});
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.temario-topic')[4].getBoundingClientRect().bottom<=innerHeight),true,'five topics are visible without page scrolling');
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  assert.equal(await page.evaluate(()=>document.querySelector('.temario-main-actions').getBoundingClientRect().bottom<=innerHeight),true,'actions remain reachable on short screens');
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#temarioSearch').fill('conditionals');
  assert.equal(await page.locator('.temario-topic').count(),1);
  await page.locator('#temarioSearch').fill('');
  await page.locator('#temarioSubject').selectOption('Matemáticas');
  await page.getByRole('button',{name:/Ecuaciones/}).first().click();
  assert.match(await page.locator('.temario-preview-explanation').innerText(),/ecuaci/i);
  await page.getByRole('button',{name:'Ver tema completo'}).click();
  await page.screenshot({path:'tools/profesor-temario-leccion.png'});
  assert.equal(await page.locator('.lesson-grid .lesson-card').count(),6);
  assert.equal(await page.locator('.lesson-steps li').count(),3);
  assert.match(await page.locator('.lesson-understand').innerText(),/ecuaci/i);
  assert.match(await page.locator('.lesson-error').innerText(),/comprobar|igualdad|miembros/i);
  assert.equal(await page.locator('.temario-extra').evaluate(el=>el.open),false);
  await page.locator('.temario-extra summary').click();
  assert.match(await page.locator('.temario-extra').innerText(),/Error frecuente/);
  await page.getByRole('button',{name:'Practicar ahora'}).click();
  assert.equal(await page.locator('#dialog.activity-play[open]').count(),1);
  assert.equal(await page.locator('[name="r-0"]').count(),1);
  await page.locator('#dialog .close').click();

  await page.getByRole('button',{name:'Probar ahora'}).click();
  await page.locator('#dialog.activity-play .block').first().waitFor();
  assert.equal(await page.locator('#dialog.activity-play .block').count(),6);
  assert.equal(await page.locator('#dialog.activity-play [data-tone]').count(),6);
  await page.locator('#dialog .close').click();
  const libraryBefore=await page.evaluate(()=>state.library.length);
  await page.getByRole('button',{name:'Guardar copia'}).click();
  assert.equal(await page.evaluate(()=>state.library.length),libraryBefore+1);
  assert.match(await page.evaluate(()=>state.library.at(-1).title),/práctica guiada/);

  await page.getByRole('button',{name:'+ Crear otro material'}).click();
  assert.equal(await page.locator('#temarioOwner option').count()>1,true);
  await page.locator('#temarioOwner').selectOption('lucia');
  await page.getByRole('button',{name:'Continuar a Materiales'}).click();
  await page.locator('#workshopCourse').waitFor();
  assert.equal(await page.locator('#workshopStudent').inputValue(),'lucia');
  assert.match(await page.locator('#workshopCourse').inputValue(),/^3[.º\s]*ESO$/);
  assert.equal(await page.locator('#workshopSubject').inputValue(),'Matemáticas');
  assert.equal(await page.locator('#workshopTopic').inputValue(),'Ecuaciones');
  assert.equal(await page.locator('#count-gaps').inputValue(),'0');
  assert.equal(await page.locator('#count-problem').inputValue(),'0');
  assert.equal(await page.locator('.home-primary-nav button.active').innerText(),'Material');
  await page.locator('#dialog .close').click();

  await page.setViewportSize({width:390,height:844});
  await page.locator('.home-primary-nav').getByRole('button',{name:'Temario'}).click();
  await page.locator('#temarioSubject').selectOption('Inglés');
  await page.getByRole('button',{name:'Ver tema completo'}).click();
  assert.equal(await page.evaluate(()=>document.querySelector('#dialog').scrollWidth>document.querySelector('#dialog').clientWidth+2),false);
  assert.equal(await page.locator('.lesson-grid .lesson-card').count(),6);
  await page.screenshot({path:'tools/profesor-temario-leccion-mobile.png'});
  await page.locator('#dialog .close').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.deepEqual(errors,[]);
  console.log('PASS Temario: 279 fichas, flujo sencillo, práctica y uso en Materiales');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
