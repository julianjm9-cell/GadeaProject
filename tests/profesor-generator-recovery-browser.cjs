const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const fs=require('node:fs');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:850}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const url=pathToFileURL(path.resolve('apps/profesor/index.html')).href;
  await page.goto(url);
  await page.evaluate(()=>{
   demo=false;accountEmail='verification@example.invalid';window.starts=[];window.polls=0;
   api=async(url,body)=>{
    if(url==='/api/state')return{};
    if(url==='/api/profesor/generation/start'){window.starts.push(body);window.savedRetry=sessionStorage.getItem('profesor.generatorRetry');return{status:'running',completed:1,total:2}}
    if(url.startsWith('/api/profesor/generation/')){
     if(++window.polls===1)throw Error('Temporary connection failure');
     return{status:'completed',result:{questions:[{type:'gaps',prompt:'2 + 2 = ___',answer:'4',options:[],explanation:'Suma dos y dos.'},{type:'gaps',prompt:'3 + 3 = ___',answer:'6',options:[],explanation:'Suma tres y tres.'}]}};
    }
    throw Error('Unexpected URL '+url);
   };
   openWorkshop({course:'3.º ESO',subject:'Matemáticas',topic:'Sumas',gaps:1,activitySizes:{gaps:2}});
  });
  await page.locator('#workshopContinue').click();
  await page.getByText('1 de 2 elementos preparados.',{exact:false}).waitFor();
  await page.locator('#q-0').waitFor();
  assert.equal(await page.evaluate(()=>window.starts.length),1);
  assert.equal(await page.evaluate(()=>window.polls),2);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('profesor.generatorRetry')),null);
  await page.locator('#dialog .close').click();
  // A reload retains the original request id and fields. Recovery uses that
  // same id, so the server can return the existing material without charging.
  await page.evaluate(()=>{
   sessionStorage.setItem('profesor.generatorRetry',window.savedRetry);
  });
  const oldRequest=await page.evaluate(()=>JSON.parse(window.savedRetry).id);
  await page.reload();
  await page.evaluate(()=>{demo=false;accountEmail='verification@example.invalid';window.resumedId='';api=async(url,body)=>{if(url==='/api/state')return{};if(url==='/api/profesor/generation/start'){window.resumedId=body.request_id;return{status:'completed',result:{questions:[{type:'gaps',prompt:'2 + 2 = ___',answer:'4',options:[]},{type:'gaps',prompt:'3 + 3 = ___',answer:'6',options:[]}]}}}throw Error(url)};openWorkshop()});
  assert.equal(await page.locator('#workshopTopic').inputValue(),'Sumas');
  assert.equal(await page.locator('#size-gaps').inputValue(),'2');
  await page.locator('#workshopContinue').click();await page.locator('#q-0').waitFor();
  assert.equal(await page.evaluate(()=>window.resumedId),oldRequest);
  await page.locator('#dialog .close').click();
  // Feed real model results through the actual frontend validator, editor,
  // persistence and player. Supply artifacts with TEACHER_LIVE_ARTIFACTS.
  const directory=process.env.TEACHER_LIVE_ARTIFACTS;
  if(directory){
   for(const name of fs.readdirSync(directory).filter(name=>name.endsWith('-1.json'))){
    const result=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
    const material={id:'live-'+name,title:'Verification '+name,subject:'Lengua',activity:{version:1,questions:result.questions}};
    await page.evaluate(m=>{validateActivityQuestions(m.activity.questions);editActivity(m)},material);
    await page.locator('#q-0').waitFor();
    await page.locator('#activityTitle').fill(material.title+' edited');
    await page.getByRole('button',{name:'Guardar y cerrar',exact:true}).click();
    await page.locator('#dialog').waitFor({state:'hidden'});
    const saved=await page.evaluate(id=>state.library.find(m=>m.id===id),material.id);
    assert.equal(saved.title,material.title+' edited',name);
    assert.equal(saved.activity.questions.length,result.questions.length,name);
    assert.deepEqual(saved.activity.questions.map(q=>[q.type,q.prompt,q.answer,q.options]),result.questions.map(q=>[q.type,q.prompt,q.answer,q.options]),name);
    await page.evaluate(m=>runActivity(m,''),saved);
    await page.locator('#dialog').waitFor();
    assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth>el.clientWidth+2),false,name);
    await page.locator('#dialog .close').click();
   }
  }
  assert.equal(await page.evaluate(()=>profesorTimelineLabel('1945-05-08 — Rendición de Alemania',false)),'Rendición de Alemania');
  assert.equal(await page.evaluate(()=>profesorTimelineLabel('8 de mayo de 1945 — Rendición de Alemania',false)),'Rendición de Alemania');
  assert.deepEqual(errors,[]);
  console.log('PASS background progress, connection recovery, reload fields and real-model frontend contracts');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
