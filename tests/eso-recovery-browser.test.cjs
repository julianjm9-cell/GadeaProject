const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {chromium,webkit}=require('./browser-runtime.cjs');
for(const [name,engine,options] of [['Chromium',chromium,{headless:true,channel:'msedge'}],['WebKit',webkit,{headless:true}]])test(name+': ESO recovers offline notes after reload without replacing a newer server state',async()=>{
 const browser=await engine.launch(options);
 try{
  const page=await browser.newPage();let saved={},revision=1,fail=false;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('http://study.test/**',async route=>{
   const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').at(-1);
   if(url.pathname==='/eso-adultos')return route.fulfill({contentType:'text/html',body:fs.readFileSync('apps/e25/index.html','utf8')});
   if(url.pathname==='/api/me')return route.fulfill({json:{ok:true,user:{id:'account-a',name:'Ensayo',total_credits:100,available_credits:100}}});
   if(url.pathname==='/api/state'){
    if(request.method()==='POST'){if(fail)return route.fulfill({status:503,json:{detail:'offline'}});saved=request.postDataJSON();revision++;}
    return route.fulfill({headers:{ETag:'"v'+revision+'"'},json:request.method()==='POST'?{ok:true}:saved});
   }
   const candidates=[path.join('apps/e25/assets',name),path.join('apps/profesor',name),path.join('apps/profesor/assets',name)];
   const file=candidates.find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
   if(file)return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'image/png'});
   return route.fulfill({status:404,json:{detail:'unavailable'}});
  });
  await page.goto('http://study.test/eso-adultos');await page.waitForFunction(()=>esoStateReady&&currentUser?.id);
  fail=true;assert.equal(await page.evaluate(()=>{state.lessonNotes={topic:'Apuntes sin conexión'};return saveState();}),false);
  await page.reload();await page.getByRole('button',{name:'Recuperar cambios pendientes'}).waitFor();
  assert.equal(saved.lessonNotes,undefined);fail=false;
  await page.getByRole('button',{name:'Recuperar cambios pendientes'}).click();
  await page.waitForFunction(()=>state.lessonNotes?.topic==='Apuntes sin conexión'&&!esoPendingSaves);
  assert.equal(saved.lessonNotes.topic,'Apuntes sin conexión');assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
