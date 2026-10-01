const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const errors=[];
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
  const brand=await page.locator('.home-brand').boundingBox(),nav=await page.locator('.home-primary-nav').boundingBox();
  assert(nav.x-brand.x-brand.width<45,'navigation stays beside the logo');
  assert.equal(await page.locator('.home-roster #homeStudentSearch').count(),0,'home shows a clean student summary');
  assert.equal(await page.locator('.home-roster').getByRole('button',{name:'+ Alumno'}).count(),0,'student creation stays in Alumnos');
  await page.locator('.home-primary-nav').getByRole('button',{name:'Alumnos'}).click();
  assert.equal(await page.locator('#homeStudentSearch').count(),1,'search remains available in Alumnos');
  assert.equal(await page.getByRole('button',{name:'+ Alumno',exact:true}).count(),1,'student creation remains available in Alumnos');
  await page.getByRole('button',{name:'Abrir espacio de Lucía Martín'}).click();
  assert.equal(await page.getByText('3º ESO',{exact:true}).count(),1,'course shown once');
  for(const label of ['Objetivo principal','Próxima clase','Intereses','A reforzar','Notas','Objetivos y tareas','Historial de clases'])assert(await page.getByText(label,{exact:true}).count()>=1,label);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true,'student overview fits desktop');
  await page.getByRole('button',{name:'+ Añadir tarea'}).click();
  assert.equal(await page.locator('#taskStudent').inputValue(),'lucia');
  await page.getByLabel('Qué quieres hacer').fill('Repasar fracciones');
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await page.getByText('Repasar fracciones',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Editar intereses'}).click();
  await page.locator('#profileInterests').fill('Animales y astronomía');
  await page.locator('#profileGoal').fill('Resolver problemas de fracciones');
  await page.getByRole('button',{name:'Guardar perfil'}).click();
  await page.getByText('Animales y astronomía',{exact:true}).waitFor();
  await page.evaluate(()=>{state.sessions.push({id:'history-test',studentId:'lucia',subject:'Matemáticas',date:'2026-01-15T17:00',duration:60,topic:'Fracciones',status:'Finalizada',blocks:[],notes:'',summary:'Buen progreso'});render()});
  await page.locator('.student-overview-history-row').first().getByRole('button',{name:'✎'}).click();
  await page.locator('#historySummary').fill('Domina sumas de fracciones');
  await page.getByRole('button',{name:'Guardar clase'}).click();
  await page.getByText('Domina sumas de fracciones',{exact:true}).waitFor();
  await page.screenshot({path:'tools/profesor-student-overview-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  for(const section of ['notes','tasks','history']){
   await page.locator(`[data-action="studentOverviewPanel"][data-id="${section}"]`).click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true,section);
  }
  await page.screenshot({path:'tools/profesor-student-overview-mobile.png'});
  await page.setViewportSize({width:375,height:667});
  for(const section of ['notes','tasks','history']){
   await page.locator(`[data-action="studentOverviewPanel"][data-id="${section}"]`).click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true,`${section} on a compact phone`);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS student overview layout, editing, tasks, history and responsive panels');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
