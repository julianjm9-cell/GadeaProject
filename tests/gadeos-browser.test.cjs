const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {mkdtemp,rm,readFile}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join,resolve,relative}=require('node:path');
const {chromium,webkit}=require('./browser-runtime.cjs');
async function fixture(t){
 const directory=await mkdtemp(join(tmpdir(),'gadeos-browser-'));
 const child=spawn(process.env.PYTHON||'python',['tests/private-apps-browser-server.py'],{cwd:resolve(__dirname,'..'),windowsHide:true,env:{...process.env,ENVIRONMENT:'test',DATABASE_URL:'sqlite:///'+join(directory,'test.sqlite').replaceAll('\\','/'),EDUCAME_PRIVATE_IMAGE_DIR:join(directory,'images'),JWT_SECRET:'gadeos-browser-isolated-signing-key-32-bytes',COOKIE_SECURE:'false',PYTHONPATH:'backend',PYTHONUNBUFFERED:'1'}});
 t.after(async()=>{if(child.exitCode===null){child.kill();await once(child,'exit',{signal:AbortSignal.timeout(5000)}).catch(()=>{});}assert.match(relative(resolve(tmpdir()),resolve(directory)),/^gadeos-browser-[\w-]+$/);await rm(directory,{recursive:true,force:true,maxRetries:4,retryDelay:100});});
 let output='',errors='';child.stderr.on('data',chunk=>{errors+=chunk;});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('El backend de ensayo no arrancó: '+errors)),15000);child.once('error',reject);child.once('exit',()=>reject(Error('Backend de ensayo detenido: '+errors)));child.stdout.on('data',chunk=>{output+=chunk;const line=output.split(/\r?\n/).find(line=>line.startsWith('{"url"'));if(line){clearTimeout(timer);resolve(JSON.parse(line).url);}});});
 for(let i=0;i<60;i++){try{if((await fetch(base+'/health')).ok)return base;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 assert.fail('El backend de ensayo no responde.');
}
for(const [name,engine,viewport] of [['Chromium escritorio',chromium,{width:1440,height:1000}],['WebKit móvil',webkit,{width:390,height:844}]]){
 test(`GADEOS completa nueve pruebas, recupera una respuesta perdida y gana la batalla con API real en ${name}`,{timeout:90000},async t=>{
  const base=await fixture(t),browser=await engine.launch(name.startsWith('Chromium')?{channel:'msedge'}:{});t.after(()=>browser.close());
  const page=await browser.newPage({viewport});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const signed=await page.request.post(base+'/auth/login',{data:{email:'organizador@example.invalid',password:'ensayo-temporal-123'}});assert.equal(signed.status(),200);const token=(await signed.json()).access_token;
  const headers={Authorization:'Bearer '+token};
  const created=await page.request.post(base+'/admin/apps/gadeos/accounts',{headers,data:{name:'Alma',password:'ensayo-seguro-123'}});assert.equal(created.status(),201);
  const config=await (await page.request.get(base+'/admin/apps/gadeos/campaign',{headers})).json();
  const materialRoot=process.env.EDUCAME_GADEOS_MATERIALS_DIR;
  const manifest=materialRoot?JSON.parse(await readFile(join(materialRoot,'manifest.json'),'utf8')):{poster:'fixture',guide:[{title:'Portada',file:'fixture'},{title:'Instrucciones',file:'fixture',text:'Texto legible de ensayo.'}]};
  async function upload(file){const bytes=await readFile(materialRoot?join(materialRoot,file):resolve('marketing/app_landings_demo/assets/landing/profesor-dashboard.png'));const response=await page.request.post(base+'/admin/apps/gadeos/images',{headers,data:{data:bytes.toString('base64')}});assert.equal(response.status(),201);return (await response.json()).url;}
  config.media={poster:await upload(manifest.poster),envelope:materialRoot?await upload(manifest.envelope||manifest.poster):null,source:'b'.repeat(64),guide:[]};
  for(const entry of manifest.guide)config.media.guide.push({title:entry.title,image:await upload(entry.file),text:entry.text||''});
  assert.equal((await page.request.put(base+'/admin/apps/gadeos/campaign',{headers,data:config})).status(),200);
  await page.context().clearCookies();await page.goto(base+'/juegos-del-hambre');await page.getByRole('heading',{name:'JUEGOS DEL HAMBRE',exact:true}).waitFor();
  assert.equal(await page.locator('.hero-companions').count(),0);assert.equal((await page.request.get(base+'/api/arena-hambre/companions.png')).status(),401);
  await page.waitForFunction(()=>document.querySelector('.login-scene')?.naturalWidth>0);
  if(process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-login-'+name.split(' ')[0]+'.png'),fullPage:true,animations:'disabled'});
  assert.equal((await page.request.get(base+config.media.poster)).status(),401);
  assert.equal(await page.getByRole('button',{name:'Crear cuenta',exact:true}).count(),0);assert.equal(await page.title(),'JUEGOS DEL HAMBRE');assert.doesNotMatch(await page.locator('body').innerText(),/GADEOS/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByLabel('Nombre de tributo').fill('Alma');await page.getByLabel('Contraseña',{exact:true}).fill('ensayo-seguro-123');await page.getByRole('button',{name:/Entrar en la arena/}).click();
  await page.getByText('TU TRIBUTO · Alma',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.event-poster')?.naturalWidth>0);
  await page.waitForFunction(()=>document.querySelector('.hero-companions')?.naturalWidth>0);
  assert.equal(await page.locator('.bottom-nav a').count(),4);assert.doesNotMatch(await page.locator('body').innerText(),/GADEOS/);assert.ok(page.url().includes('/juegos-del-hambre'));await page.waitForFunction(()=>document.querySelector('.brand-title')?.naturalWidth>0);
  await page.getByRole('heading',{name:'Vuestro planning',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Guía',exact:true}).count(),0);
  const cta=await page.locator('.next-step').boundingBox(),nav=await page.locator('.bottom-nav').boundingBox();assert.ok(cta.y+cta.height<=nav.y,'El siguiente paso queda visible por encima de la navegación.');
  assert.equal((await (await page.request.get(base+'/api/private-apps/gadeos/state')).json()).completed,0);
  if(process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-home-'+name.split(' ')[0]+'.png'),fullPage:true,animations:"disabled"});
  assert.deepEqual(await page.locator('.planning-day h3').allTextContents(),['Viernes 20','Sábado 21']);
  assert.equal(await page.locator('.planning-list li').count(),4);assert.deepEqual(await page.locator('.planning-time').allTextContents(),['18:00','21:00','22:00']);assert.equal(await page.locator('.planning-locked').count(),2);assert.doesNotMatch(await page.locator('.planning').innerText(),/Check-out|Torre del Reloj|11:30|19:45/);await page.getByText(/Autobús 337 · Salida/).waitFor();
  await page.locator('.bottom-nav a[href="#restaurantes"]').click();await page.locator('.leaflet-container').waitFor();
  assert.equal((await page.request.get(base+'/aventura-hambre-assets/town-map.svg')).status(),200);
  await page.waitForFunction(()=>document.querySelector('.leaflet-image-layer')?.naturalWidth>0).catch(async error=>{throw Error(error.message+'; JS='+JSON.stringify(errors)+'; mapa='+await page.locator('#restaurant-map').innerHTML());});
  assert.equal(await page.locator('[data-restaurant]').count(),12);
  assert.ok(await page.locator('.food-marker').count()>0);
  assert.equal(await page.locator('.refuge-marker').count(),1);
  assert.match(await page.locator('.refuge-bar .refuge-google').getAttribute('href'),/^https:\/\/www\.google\.com\/maps\/place\//);
  await page.locator('.refuge-bar .refuge-locate').click();await page.locator('.leaflet-popup-content strong').getByText('Nuestro refugio',{exact:true}).waitFor();
  assert.match(await page.locator('.leaflet-popup-content').innerText(),/Plaza Mayor, 36/);
  await page.locator('.leaflet-popup-close-button').click();
  await page.getByRole('button',{name:'Ver todos',exact:true}).click();
  const widthBeforeZoom=(await page.locator('.leaflet-image-layer').boundingBox()).width;await page.locator('.food-marker-body.clustered').first().click();
  await page.waitForFunction(width=>document.querySelector('.leaflet-image-layer').getBoundingClientRect().width>width,widthBeforeZoom);
  await page.getByRole('button',{name:'Ver todos',exact:true}).click();
  if(process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'chinchon-restaurants-'+name.split(' ')[0]+'.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Desayuno del sábado',exact:true}).click();assert.equal(await page.locator('[data-restaurant]').count(),3);
  const coffee=page.locator('[data-restaurant="tomeguin"]');assert.match(await coffee.getByRole('link',{name:'Google Maps ↗',exact:true}).getAttribute('href'),/^https:\/\/www\.google\.com\/maps\/search\//);
  await coffee.getByRole('button',{name:'Ver en mapa',exact:true}).click();await page.locator('.leaflet-popup-content strong').getByText('Tomeguín & Colibrí',{exact:true}).waitFor();
  await page.locator('.leaflet-popup-close-button').click();
  await page.getByRole('button',{name:'Cuevas y vino',exact:true}).click();assert.equal(await page.locator('[data-restaurant]').count(),3);
  assert.equal(await page.locator('.refuge-marker').count(),1);
  assert.match(await page.locator('[data-restaurant="bayona"]').innerText(),/Titulcia/);assert.equal(await page.locator('[data-restaurant="bayona"]').getByRole('button',{name:'Ver en mapa'}).count(),0);
  await page.getByRole('button',{name:'Todos',exact:true}).click();assert.equal(await page.locator('[data-restaurant]').count(),12);
  await page.reload();await page.locator('.leaflet-container').waitFor();assert.equal(await page.locator('[data-restaurant]').count(),12);assert.equal(await page.locator('.refuge-marker').count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('.bottom-nav a[href="#recorrido"]').click();assert.equal(await page.locator('[data-station="2"]').isEnabled(),false);
  assert.equal(await page.locator('[data-station]').count(),9);
  await page.waitForFunction(()=>document.querySelector('.journey-map')?.naturalWidth>0);
  async function checkRoute(){
   const geometry=await page.locator('.journey').evaluate(root=>{
    const image=root.querySelector('.journey-map').getBoundingClientRect();
    return {width:image.width,height:image.height,ratio:image.height/image.width,nodes:[...root.querySelectorAll('[data-station]')].map(node=>{const box=node.getBoundingClientRect();return {text:node.textContent,width:box.width,height:box.height,x:100*(box.x+box.width/2-image.x)/image.width,y:100*(box.y+box.height/2-image.y)/image.height};})};
   });
   assert.ok(Math.abs(geometry.ratio-1.5)<.01,'La imagen conserva sus proporciones sin recortes.');
   const stops=[[58,93],[47,82],[70,72],[40,65],[28,55.5],[64,50.5],[20,35.6],[75,28.5],[49,23.3]];
   geometry.nodes.forEach((node,i)=>{assert.equal(node.text,String(i+1));assert.ok(node.width>=48&&node.width<=61&&Math.abs(node.width-node.height)<1);assert.ok(Math.abs(node.x-stops[i][0])<.4&&Math.abs(node.y-stops[i][1])<.4,'Cada número sigue el camino al cambiar de tamaño.');});
   for(let i=0;i<geometry.nodes.length;i++)for(let j=i+1;j<geometry.nodes.length;j++){const a=geometry.nodes[i],b=geometry.nodes[j];assert.ok(Math.hypot((a.x-b.x)*geometry.width/100,(a.y-b.y)*geometry.height/100)>(a.width+b.width)/2,'Los botones circulares no se superponen.');}
   assert.equal(await page.locator('.station-copy,.station-pack').count(),0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  for(const width of [320,768,1440]){await page.setViewportSize({width,height:viewport.height});await checkRoute();}
  await page.setViewportSize(viewport);await checkRoute();
  async function checkReward(){
   const overlay=page.locator('#reward');await overlay.waitFor({state:'visible'});
   assert.equal(await overlay.locator('.earned-pack').count(),2);
   await page.waitForFunction(()=>[...document.querySelectorAll('.earned-pack img')].length===2&&[...document.querySelectorAll('.earned-pack img')].every(image=>image.naturalWidth>0));
   await overlay.locator('.earned-pack').evaluateAll(nodes=>Promise.all(nodes.flatMap(node=>node.getAnimations().map(animation=>animation.finished))));
   assert.equal((await overlay.innerText()).trim(),'');assert.equal(await overlay.getByRole('button').count(),0);
   assert.deepEqual(await overlay.locator('.earned-pack').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).opacity)),['1','1']);
   const boxes=await overlay.locator('.earned-pack').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
   assert.ok(boxes.every(box=>box.left>=0&&box.right<=viewport.width&&box.top>=0&&box.bottom<=viewport.height),'Ambos sobres caben en la pantalla.');
  }
  if(process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-route-'+name.split(' ')[0]+'.png'),fullPage:true,animations:"disabled"});
  let lost=false;await page.route('**/stations/answer',async route=>{const body=route.request().postDataJSON();if(!lost&&body.station===1&&body.answer===config.stations[0].solution){lost=true;await route.fetch();return route.abort();}return route.continue();});
  for(let i=0;i<9;i++){
   await page.locator(`[data-station="${i+1}"]`).click().catch(async error=>{await page.screenshot({path:'.educame-agents/chinchon-click-failed.png',fullPage:true,animations:'disabled'});throw Error(error.message+'; estado='+JSON.stringify(await page.locator(`[data-station="${i+1}"]`).evaluate(node=>({style:getComputedStyle(node).transform,box:node.getBoundingClientRect().toJSON(),animations:node.getAnimations().map(a=>({state:a.playState,time:a.currentTime})),dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id)}))));});const dialog=page.locator('#challenge');await dialog.waitFor();const input=dialog.getByLabel('Tu respuesta',{exact:true});
   if(i===0){if(process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-question-'+name.split(' ')[0]+'.png'),animations:'disabled'});await input.fill('INCORRECTO');await dialog.getByRole('button',{name:'Comprobar',exact:true}).click();await dialog.getByRole('alert').waitFor({state:'visible'});assert.equal((await (await page.request.get(base+'/api/private-apps/gadeos/state')).json()).completed,0);}
   assert.equal(await dialog.locator('input').count(),1);assert.equal(await dialog.locator('.choice-list,.memory-board,.order-slot').count(),0);
   assert.equal(await dialog.locator('.challenge-prompt').count(),1);
   await input.fill(config.stations[i].solution);
   await dialog.getByRole('button',{name:'Comprobar',exact:true}).click();
   if(i===0){await dialog.getByRole('alert').waitFor({state:'visible'});await dialog.getByRole('button',{name:'Comprobar',exact:true}).click();}
   await checkReward();
   const saved=await (await page.request.get(base+'/api/arena-hambre/state')).json();assert.equal(saved.secret_discovered,i>=7);
   if(i===0&&process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-pack-'+name.split(' ')[0]+'.png'),fullPage:true,animations:'disabled'});
   if(i%3===0)await page.keyboard.press('Enter');else if(i%3===1)await page.locator('#reward').click();else await page.keyboard.press('Escape');
   await page.locator('#reward').waitFor({state:'hidden'});
   if(i===0){await page.reload();await page.locator('[data-station="2"]').waitFor();assert.equal(await page.locator('[data-station="2"]').isEnabled(),true);assert.equal((await (await page.request.get(base+'/api/private-apps/gadeos/state')).json()).cards.filter(card=>card.owned).length,1);
    const before=await (await page.request.get(base+'/api/arena-hambre/state')).json();
    await page.locator('[data-station="1"]').click();await page.locator('#challenge').getByRole('heading',{name:config.stations[0].title,exact:true}).waitFor();
    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#challenge').getByRole('button',{name:'Ver sobres',exact:true}).click();await checkReward();assert.equal(await page.locator('.earned-pack').first().evaluate(node=>getComputedStyle(node).animationName),'none');await page.mouse.click(5,5);await page.locator('#reward').waitFor({state:'hidden'});
    await page.emulateMedia({reducedMotion:'no-preference'});const after=await (await page.request.get(base+'/api/arena-hambre/state')).json();assert.equal(after.revision,before.revision);assert.equal(after.completed,1);assert.equal(after.cards.filter(card=>card.owned).length,1);
    await checkRoute();
   }
  }
  assert.ok(lost);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('.bottom-nav a[href="#batalla"]').click();await page.getByRole('button',{name:'Entrar en la arena',exact:true}).click();await page.locator('.battle-actions').waitFor();
  if(process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-'+name.split(' ')[0]+'.png'),fullPage:true,animations:"disabled"});
  let state=await (await page.request.get(base+'/api/private-apps/gadeos/state')).json();
  await page.getByRole('button',{name:'Preparar una carta · bonus de alianza',exact:true}).click();await page.locator('#reward').getByRole('button',{name:'Ver carta La partida',exact:true}).click();
  while(state.battle.state==='playing'){
   const done=page.waitForResponse(response=>response.url().endsWith('/battle/action')&&response.status()===200);
   await page.locator(`[data-move="${({strike:'guard',feint:'attack',charge:'focus'})[state.battle.intent]}"]`).click();state=await (await done).json();
  }
  assert.deepEqual(state.battle.used_cards,[1]);
  await page.getByRole('heading',{name:'Vuestra alianza ha vencido',exact:true}).waitFor();assert.equal(state.victory,true);await page.reload();await page.getByRole('heading',{name:'Vuestra alianza ha vencido',exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 });
}
