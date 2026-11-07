const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('./browser-runtime.cjs');
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.wav':'audio/wav'};

async function fixture(page,{paused=false}={}){
 let state={},revision=1;
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),p=url.pathname;
  if(url.hostname!=='studio.test')return route.abort();
  if(p==='/api/state'){
   if(request.method()==='POST'){state=request.postDataJSON();revision++;}
   return route.fulfill({headers:{ETag:'"studio-'+revision+'"'},json:request.method()==='POST'?{ok:true}:state});
  }
  if(p==='/api/status')return route.fulfill({json:{ok:true,user:{id:'visual-trial',name:'Cuenta de prueba',total_credits:100,available_credits:100}}});
  if(p==='/auth/google/status')return route.fulfill({json:{enabled:true}});
  if(p==='/api/public/app-availability')return route.fulfill({json:{apps:{CAMBRIDGE:{paused}}}});
  if(p.startsWith('/api/app-notifications/'))return route.fulfill({json:{messages:[],next:null,unread:0}});
  if(p.startsWith('/api/'))return route.fulfill({json:{ok:true}});
  let file;
  if(p==='/cambridge')file=path.join(root,'apps/cambridge/index.html');
  else if(p==='/cambridge-info')file=path.join(root,'marketing/app_landings_demo/cambridge.html');
  else if(p.startsWith('/assets/cambridge-studio/'))file=path.join(root,'apps/cambridge/assets/studio',path.basename(p));
  else if(p.startsWith('/assets/cambridge-games/'))file=path.join(root,'apps/cambridge/assets/games',path.basename(p));
  else if(p.startsWith('/assets/listening/'))file=path.join(root,'apps/cambridge/assets/listening',path.basename(p));
  else if(p.startsWith('/assets/brand/'))file=path.join(root,'backend/app/static/assets/brand',path.basename(p));
  else if(p.startsWith('/assets/'))file=path.join(root,'apps/profesor/assets',path.basename(p));
  else file=path.join(root,'apps/profesor',path.basename(p));
  if(file&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
  return route.fulfill({status:404,body:''});
 });
}

for(const [name,engine,options] of [['Chromium',chromium,{headless:true,channel:'msedge'}],['WebKit',webkit,{headless:true}]]){
 test(name+': illustrated English landing and workspace keep their routes, drafts and responsive layout',{timeout:120000},async()=>{
  const browser=await engine.launch(options);
  try{
   for(const width of [320,390,768,1440]){
    const page=await browser.newPage({viewport:{width,height:960},hasTouch:width<=768});const errors=[];
    page.on('pageerror',error=>errors.push(error.message));await fixture(page);
    await page.goto('http://studio.test/cambridge-info');
    await page.locator('#demoOptions button').first().waitFor();
    assert.match(await page.locator('#googleEntry').getAttribute('href'),/next=%2Fcambridge/);
    await page.locator('#demoOptions button').nth(1).click();assert.match(await page.locator('#demoFeedback').textContent(),/Casi/);
    await page.locator('#demoOptions button').nth(0).click();assert.match(await page.locator('#demoFeedback').textContent(),/Correcto/);
    await page.locator('#demoNext').click();assert.match(await page.locator('#demoProgress').textContent(),/2 de 3/);
    await page.locator('.faq details').nth(0).locator('summary').click();
    assert.equal(await page.locator('.faq details[open]').count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=2,'landing overflow '+width);
    if(width===1440&&name==='Chromium'){
     fs.mkdirSync(path.join(root,'tmp'),{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));
     await page.screenshot({path:path.join(root,'tmp/ingles-landing-renovada.png'),fullPage:true});
     await page.screenshot({path:path.join(root,'tmp/ingles-landing-portada.png')});
    }
    await page.goto('http://studio.test/cambridge');await page.waitForFunction(()=>cambridgeStateETag!==null);
    assert.equal(await page.locator('[data-feature] .studio-card-art img').count(),6);
    for(const img of await page.locator('[data-feature] img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(image=>image.decode());}
    assert.equal(await page.locator('[data-feature] img').evaluateAll(images=>images.filter(image=>!image.naturalWidth).length),0);
    const brand=await page.locator('.brand-area').boundingBox(),account=await page.locator('.header-right').boundingBox();
    assert.ok(brand.x+brand.width<=account.x+2,'header overlap '+width);
    await page.locator('[data-feature="writing"] .english-link').click();
    await page.locator('#writingAnswer').fill('My writing stays here when I explore the new interface.');
    await page.locator('[data-tab-btn="sesion"]').click();
    await page.locator('[data-feature="writing"] .english-link').click();
    assert.match(await page.locator('#writingAnswer').inputValue(),/My writing stays here/);
    for(const [level,count] of [['B2 First',6],['C1 Advanced',2],['C2 Proficiency',2]]){
     await page.locator('#headerExamLevel').selectOption(level);
     await page.locator('[data-tab-btn="juegos"]').click();
     assert.equal(await page.locator('#b2GameList .b2-card').count(),count);
     await page.locator('[data-tab-btn="b2"]').click();
     assert.equal(await page.locator('#b2LessonList .b2-card').count(),6);
    }
    for(const tab of ['temas','entrenar','examenes','progreso','perfil','sesion']){
     await page.locator('[data-tab-btn="'+tab+'"]').click();
     assert.equal(await page.locator('#tab-'+tab).isVisible(),true);
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,inner:innerWidth,body:document.body.scrollWidth,items:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().right>document.documentElement.clientWidth+2).slice(0,8).map(e=>({tag:e.tagName,id:e.id,class:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))}));
     if(layout.overflow>2)await page.screenshot({path:path.join(root,'tmp/ingles-layout-failure.png'),fullPage:true});
     assert.ok(layout.overflow<=2,'app '+tab+' overflow '+width+' '+JSON.stringify(layout));
    }
    if(name==='Chromium'&&[390,1440].includes(width)){
     await page.locator('#headerExamLevel').selectOption('B2 First');await page.locator('[data-tab-btn="sesion"]').click();
     await page.evaluate(()=>window.scrollTo(0,0));
     await page.screenshot({path:path.join(root,'tmp/ingles-escritorio-'+width+'.png'),fullPage:true});
     if(width===1440)await page.screenshot({path:path.join(root,'tmp/ingles-escritorio-portada.png')});
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
  assert.equal(await page.locator('.app-entry[aria-disabled=true]').count(),8);
  await page.locator('#demoOptions button').first().click();assert.match(await page.locator('#demoFeedback').textContent(),/Correcto/);
 }finally{await browser.close();}
});
