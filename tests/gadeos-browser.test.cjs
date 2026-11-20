const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {mkdtemp,rm,readFile}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join,resolve,relative}=require('node:path');
const {chromium,webkit}=require('./browser-runtime.cjs');
async function fixture(t, homeOnly = false){
 const directory=await mkdtemp(join(tmpdir(),'gadeos-browser-'));
 const child=spawn(process.env.PYTHON||'python',['tests/private-apps-browser-server.py'],{cwd:resolve(__dirname,'..'),windowsHide:true,env:{...process.env,ENVIRONMENT:'test',GADEOS_HOME_ONLY:String(homeOnly),DATABASE_URL:'sqlite:///'+join(directory,'test.sqlite').replaceAll('\\','/'),EDUCAME_PRIVATE_IMAGE_DIR:join(directory,'images'),JWT_SECRET:'gadeos-browser-isolated-signing-key-32-bytes',COOKIE_SECURE:'false',PYTHONPATH:'backend',PYTHONUNBUFFERED:'1'}});
 t.after(async()=>{if(child.exitCode===null){child.kill();await once(child,'exit',{signal:AbortSignal.timeout(5000)}).catch(()=>{});}assert.match(relative(resolve(tmpdir()),resolve(directory)),/^gadeos-browser-[\w-]+$/);await rm(directory,{recursive:true,force:true,maxRetries:4,retryDelay:100});});
 let output='',errors='';child.stderr.on('data',chunk=>{errors+=chunk;});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('El backend de ensayo no arrancó: '+errors)),15000);child.once('error',reject);child.once('exit',()=>reject(Error('Backend de ensayo detenido: '+errors)));child.stdout.on('data',chunk=>{output+=chunk;const line=output.split(/\r?\n/).find(line=>line.startsWith('{"url"'));if(line){clearTimeout(timer);resolve(JSON.parse(line).url);}});});
 for(let i=0;i<60;i++){try{if((await fetch(base+'/health')).ok)return base;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 assert.fail('El backend de ensayo no responde.');
}
for(const [name,engine,viewport] of [['Chromium escritorio',chromium,{width:1440,height:1000}],['WebKit móvil',webkit,{width:390,height:844}]]){
 test(`Ajustes reinicia y desbloquea solo el perfil actual en ${name}`,{timeout:45000},async t=>{
  const base=await fixture(t),browser=await engine.launch(name.startsWith('Chromium')?{channel:'msedge'}:{});t.after(()=>browser.close());
  const page=await browser.newPage({viewport});
  const signed=await page.request.post(base+'/auth/login',{data:{email:'organizador@example.invalid',password:'ensayo-temporal-123'}});
  const headers={Authorization:'Bearer '+(await signed.json()).access_token};
  await page.request.post(base+'/admin/apps/gadeos/accounts',{headers,data:{name:'Alma',password:'ensayo-seguro-123'}});
  await page.request.post(base+'/api/arena-hambre/login',{data:{name:'Alma',password:'ensayo-seguro-123'}});
  await page.goto(base+'/juegos-del-hambre');
  const settings=page.getByRole('dialog',{name:'Ajustes',exact:true});
  await page.getByRole('button',{name:'Ajustes',exact:true}).click();
  assert.equal(await settings.getByRole('button',{name:'Desbloquear todo',exact:true}).count(),0);
  await settings.getByLabel('Contraseña de Ajustes',{exact:true}).fill('incorrecta');
  await settings.getByRole('button',{name:'Entrar en Ajustes',exact:true}).click();
  await settings.getByText('La contraseña no es correcta.',{exact:true}).waitFor();
  await settings.getByLabel('Contraseña de Ajustes',{exact:true}).fill('ajustes');
  await settings.getByRole('button',{name:'Entrar en Ajustes',exact:true}).click();
  await page.route('**/api/arena-hambre/profile',route=>route.abort(),{times:1});
  await settings.getByRole('button',{name:'Desbloquear todo',exact:true}).click();
  await settings.getByRole('alert').waitFor();
  const pending=await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('arena-pending:')).map(key=>sessionStorage.getItem(key)));
  assert.equal(pending.length,1);
  assert.doesNotMatch(pending.join(''),/ajustes/);
  await settings.getByRole('button',{name:'Desbloquear todo',exact:true}).click();
  await settings.waitFor({state:'hidden'});
  await page.getByText('Ruta al Castillo de los Condes.',{exact:true}).waitFor();
  assert.deepEqual(await page.locator('.planning-day').last().locator('.planning-time').allTextContents(),['11:00','11:30','12:00–13:30','14:00','15:00']);
  await page.getByText('Regreso a Madrid · hora por determinar.',{exact:true}).waitFor();
  await page.locator('.bottom-nav a[href="#recorrido"]').click();
  await page.locator('.journey-town').waitFor();
  assert.equal(await page.locator('.route-count').innerText(),'10 / 10');
  await page.reload();await page.locator('.journey-town').waitFor();
  await page.locator('.bottom-nav a[href="#batalla"]').click();await page.locator('.tribute-scoreboard').waitFor();
  await page.getByRole('button',{name:'Ajustes',exact:true}).click();
  await settings.getByLabel('Contraseña de Ajustes',{exact:true}).fill('ajustes');
  await settings.getByRole('button',{name:'Entrar en Ajustes',exact:true}).click();
  await settings.getByRole('button',{name:'Reiniciar mi perfil',exact:true}).click();
  await settings.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal((await (await page.request.get(base+'/api/arena-hambre/state')).json()).completed,10);
  await page.getByRole('button',{name:'Ajustes',exact:true}).click();
  await settings.getByLabel('Contraseña de Ajustes',{exact:true}).fill('ajustes');
  await settings.getByRole('button',{name:'Entrar en Ajustes',exact:true}).click();
  await settings.getByRole('button',{name:'Reiniciar mi perfil',exact:true}).click();
  await settings.getByRole('button',{name:'Confirmar reinicio',exact:true}).click();
  await settings.waitFor({state:'hidden'});await page.reload();
  await page.getByRole('heading',{name:'Vuestro planning',exact:true}).waitFor();
  const fresh=await (await page.request.get(base+'/api/arena-hambre/state')).json();
  assert.equal(fresh.completed,0);assert.equal(fresh.secret_discovered,false);
  await page.locator('.bottom-nav a[href="#recorrido"]').click();
  await page.getByLabel('Contraseña de Recorrido').waitFor();
  assert.equal(await page.locator('.journey-town').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 });

 test(`GADEOS solo permite abrir Inicio en ${name}`,{timeout:45000},async t=>{
  const base=await fixture(t,true),browser=await engine.launch(name.startsWith('Chromium')?{channel:'msedge'}:{});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport});
  const signed=await page.request.post(base+'/auth/login',{data:{email:'organizador@example.invalid',password:'ensayo-temporal-123'}});
  const headers={Authorization:'Bearer '+(await signed.json()).access_token};
  assert.equal((await page.request.post(base+'/admin/apps/gadeos/accounts',{headers,data:{name:'Alma',password:'ensayo-seguro-123'}})).status(),201);
  assert.equal((await page.request.post(base+'/api/arena-hambre/login',{data:{name:'Alma',password:'ensayo-seguro-123'}})).status(),200);
  await page.goto(base+'/juegos-del-hambre#recorrido');
  await page.getByRole('heading',{name:'Vuestro planning'}).waitFor();
  for(const section of ['recorrido','batalla','restaurantes']){
   const control=page.locator(`.bottom-nav [data-section="${section}"]`);
   assert.equal(await control.getAttribute('aria-disabled'),'true');
   assert.equal(await control.getAttribute('href'),null);
   await page.evaluate(section=>{location.hash=section;},section);
   await page.waitForURL('**/juegos-del-hambre#inicio');
  }
  assert.equal(await page.locator('.planning-transport').innerText(),'Autobús 337 · Salida: Metro Pavones (Línea 9, Madrid)');
  assert.equal(await page.locator('.next-step,.planning-food-link').count(),0);
  await page.getByText('Llegada a Chinchón.',{exact:true}).waitFor();
  await page.getByText('Misiones.',{exact:true}).waitFor();
  await page.getByText('Check-out del refugio.',{exact:true}).waitFor();
  assert.equal(await page.locator('.planning-locked').count(),0);
  assert.equal(await page.locator('.planning-unlock').count(),0);
  await page.getByText('Ruta al Castillo de los Condes.',{exact:true}).waitFor();
  assert.deepEqual((await page.locator('.planning-time').allTextContents()).slice(0,3),['20:00','20:00–22:00','23:00']);
  await page.reload();
  await page.getByText('Check-out del refugio.',{exact:true}).waitFor();
  assert.equal(await page.locator('.planning-unlock').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 });

 test(`GADEOS desbloquea secciones, completa diez pruebas y registra victorias con API real en ${name}`,{timeout:90000},async t=>{
  const base=await fixture(t),browser=await engine.launch(name.startsWith('Chromium')?{channel:'msedge'}:{});t.after(()=>browser.close());
  const page=await browser.newPage({viewport});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const signed=await page.request.post(base+'/auth/login',{data:{email:'organizador@example.invalid',password:'ensayo-temporal-123'}});assert.equal(signed.status(),200);const token=(await signed.json()).access_token;
  const headers={Authorization:'Bearer '+token};
  const created=await page.request.post(base+'/admin/apps/gadeos/accounts',{headers,data:{name:'Alma',password:'ensayo-seguro-123'}});assert.equal(created.status(),201);
  const config=await (await page.request.get(base+'/admin/apps/gadeos/campaign',{headers})).json();
  assert.deepEqual(Object.values(config.section_access).map(item=>item.enabled),[true,false,true,true,true]);
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
  assert.equal(await page.locator('.planning-list li').count(),9);
  assert.deepEqual((await page.locator('.planning-time').allTextContents()).slice(0,3),['20:00','20:00–22:00','23:00']);
  assert.equal(await page.locator('.planning-locked').count(),0);
  await page.getByText('Llegada a Chinchón.',{exact:true}).waitFor();
  assert.match(await page.locator('.planning-transport').innerText(),/^Autobús 337 · Salida: Metro Pavones/);
  assert.equal(await page.locator('.planning-food-link').count(),0);
  await page.locator('.bottom-nav a[href="#restaurantes"]').click();
  await page.getByLabel('Contraseña de Restaurantes',{exact:true}).waitFor();
  assert.equal(await page.locator('#restaurant-map').count(),0);
  assert.doesNotMatch(await page.locator('#main').innerText(),/chinch[oó]n/i);
  async function unlock(label, password=label){
   await page.getByLabel('Contraseña de '+label).fill(password);
   await page.getByRole('button',{name:'Desbloquear',exact:true}).click();
  }
  await page.locator('.bottom-nav a[href="#recorrido"]').click();
  await unlock('Recorrido','incorrecta');
  await page.getByText('La contraseña no es correcta.').waitFor();
  await unlock('Recorrido');
  await page.locator('[data-station="2"]').waitFor();
  assert.equal(await page.locator('[data-station="2"]').isEnabled(),false);
  assert.equal(await page.locator('[data-station]').count(),2);
  assert.equal(await page.locator('.journey-town-section').count(),0);
  assert.doesNotMatch(await page.locator('.journey-bus').innerText(),/Chinchón/);
  await page.waitForFunction(()=>document.querySelector('.journey-bus .journey-map')?.naturalWidth>0);
  async function checkRoute(){
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.equal(await page.locator('.journey-town .town-anchor').count(),6);
   const pins=await page.locator('.journey-town .station').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
   for(let i=0;i<pins.length;i++)for(let j=i+1;j<pins.length;j++)assert.ok(Math.hypot(pins[i].x-pins[j].x,pins[i].y-pins[j].y)>=48,'Los puntos del mapa se pueden pulsar por separado.');
  }
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
  for(const i of [0,1,7,3,6,4,2,5,8,9]){
   await page.locator(`[data-station="${i+1}"]`).click().catch(async error=>{await page.screenshot({path:'.educame-agents/chinchon-click-failed.png',fullPage:true,animations:'disabled'});throw Error(error.message+'; estado='+JSON.stringify(await page.locator(`[data-station="${i+1}"]`).evaluate(node=>({style:getComputedStyle(node).transform,box:node.getBoundingClientRect().toJSON(),animations:node.getAnimations().map(a=>({state:a.playState,time:a.currentTime})),dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id)}))));});const dialog=page.locator('#challenge');await dialog.waitFor();const input=dialog.getByLabel('Tu respuesta',{exact:true});
   if(i===0){if(process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-question-'+name.split(' ')[0]+'.png'),animations:'disabled'});await input.fill('INCORRECTO');await dialog.getByRole('button',{name:'Comprobar',exact:true}).click();await dialog.getByRole('alert').waitFor({state:'visible'});assert.equal((await (await page.request.get(base+'/api/private-apps/gadeos/state')).json()).completed,0);}
   assert.equal(await dialog.locator('input').count(),1);assert.equal(await dialog.locator('.choice-list,.memory-board,.order-slot').count(),0);
   assert.equal(await dialog.locator('.challenge-prompt').count(),1);
   if(i===8){
    assert.match(await page.locator('.journey-refuge img').getAttribute('src'),/refuge-v2\.webp$/);
    await input.fill('Respuesta incorrecta');
    await dialog.getByRole('button',{name:'Comprobar',exact:true}).click();
    await dialog.getByRole('alert').waitFor({state:'visible'});
    assert.match(await page.locator('.journey-refuge img').getAttribute('src'),/refuge-v2\.webp$/);
   }
   await input.fill(config.stations[i].solution);
   await dialog.getByRole('button',{name:'Comprobar',exact:true}).click();
   if(i===0){await dialog.getByRole('alert').waitFor({state:'visible'});await dialog.getByRole('button',{name:'Comprobar',exact:true}).click();}
   await checkReward();
   const saved=await (await page.request.get(base+'/api/arena-hambre/state')).json();assert.equal(saved.secret_discovered,false);
   if(i===8)assert.equal(saved.sections.batalla,'waiting');
   if(i===0&&process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-pack-'+name.split(' ')[0]+'.png'),fullPage:true,animations:'disabled'});
   if(i%3===0)await page.keyboard.press('Enter');else if(i%3===1)await page.locator('#reward').click();else await page.keyboard.press('Escape');
   await page.locator('#reward').waitFor({state:'hidden'});
   if(i===8){
    const checkWindow=()=>page.waitForFunction(()=>document.querySelector('.journey-refuge img')?.src.endsWith('/refuge-v1.webp')&&document.querySelector('.journey-refuge img').naturalWidth>0);
    await checkWindow();
    await page.reload();await checkWindow();
    await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
    await page.getByLabel('Nombre de tributo').fill('Alma');
    await page.getByLabel('Contraseña',{exact:true}).fill('ensayo-seguro-123');
    await page.getByRole('button',{name:/Entrar en la arena/}).click();
    await page.locator('.bottom-nav a[href="#recorrido"]').click();
    await checkWindow();
   }
   if(i===1){
    assert.equal(await page.locator('.journey-bus').count(),0);
    await page.waitForFunction(()=>document.querySelector('.journey-town .journey-map')?.naturalWidth>0);
    for(const width of [320,390,768,1440]){
     await page.setViewportSize({width,height:viewport.height});
     await page.getByRole('button',{name:'Centrar',exact:true}).click();
     await checkRoute();
    }
    await page.setViewportSize(viewport);
    await page.getByRole('button',{name:'Centrar',exact:true}).click();
    const townMap=page.locator('.journey-town');
    const mapImage=townMap.locator('.journey-map');
    async function checkOverview(){
     const image=await mapImage.boundingBox(),frame=await townMap.boundingBox();
     assert.ok(image.width>=frame.width*.92&&image.height>=frame.height*.92,'El mapa completo ocupa el visor al alejarlo.');
     assert.ok(image.x>=frame.x-2&&image.y>=frame.y-2&&image.x+image.width<=frame.x+frame.width+2&&image.y+image.height<=frame.y+frame.height+2,'La vista completa conserva todos los bordes. '+JSON.stringify({image,frame}));
    }
    for(const width of [320,768,390]){
     await page.setViewportSize({width,height:viewport.height});
     await page.waitForTimeout(150);
     await checkOverview();
    }
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    const startWidth=(await mapImage.boundingBox()).width;
    await townMap.getByRole('button',{name:'Ampliar mapa',exact:true}).click();
    assert.ok((await mapImage.boundingBox()).width>startWidth);
    const mapBox=await townMap.boundingBox();
    const beforeDrag=await mapImage.boundingBox();
    await page.mouse.move(mapBox.x+mapBox.width*.70,mapBox.y+mapBox.height*.83);
    await page.mouse.down();
    await page.mouse.move(mapBox.x+mapBox.width*.58,mapBox.y+mapBox.height*.90,{steps:8});
    await page.mouse.up();
    assert.ok(Math.abs((await mapImage.boundingBox()).x-beforeDrag.x)>12);
    await townMap.getByRole('button',{name:'Alejar mapa',exact:true}).click();
    for(let zoom=0;zoom<8&&await townMap.locator('.leaflet-control-zoom-out').getAttribute('aria-disabled')!=='true';zoom++)await townMap.getByRole('button',{name:'Alejar mapa',exact:true}).click();
    assert.equal(await townMap.locator('.leaflet-control-zoom-out').getAttribute('aria-disabled'),'true');
    await checkOverview();
    await page.getByRole('button',{name:'Centrar',exact:true}).click();
    await checkRoute();
    assert.equal(await page.locator('[data-station="8"]').isEnabled(),true);
    assert.equal(await page.locator('[data-station="9"]').isEnabled(),false);
    assert.equal(await page.locator('[data-station="10"]').isEnabled(),false);
    await page.locator('.bottom-nav a[href="#batalla"]').click();
    await page.getByText('Completa las 10 pruebas del recorrido para abrir la batalla.').waitFor();
    await page.locator('.bottom-nav a[href="#recorrido"]').click();
    await page.waitForFunction(()=>document.querySelector('.journey-town .journey-map')?.naturalWidth>0);
    if(process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-town-'+name.split(' ')[0]+'.png'),fullPage:true,animations:'disabled'});
    await page.locator('.bottom-nav a[href="#inicio"]').click();
    await page.getByRole('link',{name:'Dónde comer →'}).waitFor();
    assert.equal(await page.locator('.poster-copy .eyebrow').innerText(),'Viernes');
    await page.getByText('Llegada a Chinchón.',{exact:true}).waitFor();
    assert.equal(await page.locator('.planning-unlock').count(),0);
    await page.getByText('Ruta al Castillo de los Condes.',{exact:true}).waitFor();
    assert.equal(await page.locator('.planning-locked').count(),0);
    await page.reload();
    await page.getByText('Ruta al Castillo de los Condes.',{exact:true}).waitFor();
    await page.locator('.bottom-nav a[href="#restaurantes"]').click();
    await unlock('Restaurantes','restaurantes');
    await page.locator('.leaflet-container').waitFor();
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
    await page.goto(base+'/juegos-del-hambre#recorrido');
    await page.reload();
    await page.locator('.journey-town').waitFor();
    await page.waitForFunction(()=>document.querySelector('.journey-refuge img')?.naturalWidth>0);
   }
   if(i===5){
    assert.equal(await page.locator('[data-station="9"]').isEnabled(),true);
    assert.equal(await page.locator('[data-station="10"]').isEnabled(),true);
    assert.equal((await (await page.request.get(base+'/api/arena-hambre/state')).json()).sections.batalla,'waiting');
   }
   if(i===7){
    await page.reload();
    await page.locator('.journey-town').waitFor();
    const reopened=await (await page.request.get(base+'/api/arena-hambre/state')).json();
    assert.deepEqual(reopened.cards.filter(card=>card.owned).map(card=>card.id),[1,2,8]);
   }

   if(i===0){await page.reload();await page.locator('[data-station="2"]').waitFor();assert.equal(await page.locator('[data-station="2"]').isEnabled(),true);assert.equal(await page.locator('.journey-town-section').count(),0);assert.equal((await (await page.request.get(base+'/api/private-apps/gadeos/state')).json()).cards.filter(card=>card.owned).length,1);
    await page.locator('.bottom-nav a[href="#inicio"]').click();
    await page.getByText(/^Autobús 337 · Salida: Metro Pavones/).waitFor();
    await page.getByText('Llegada a Chinchón.',{exact:true}).waitFor();
    await page.locator('.bottom-nav a[href="#recorrido"]').click();
    const before=await (await page.request.get(base+'/api/arena-hambre/state')).json();
    await page.locator('[data-station="1"]').click();await page.locator('#challenge').getByRole('heading',{name:config.stations[0].title,exact:true}).waitFor();
    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#challenge').getByRole('button',{name:'Ver sobres',exact:true}).click();await checkReward();assert.equal(await page.locator('.earned-pack').first().evaluate(node=>getComputedStyle(node).animationName),'none');await page.mouse.click(5,5);await page.locator('#reward').waitFor({state:'hidden'});
    await page.emulateMedia({reducedMotion:'no-preference'});const after=await (await page.request.get(base+'/api/arena-hambre/state')).json();assert.equal(after.revision,before.revision);assert.equal(after.completed,1);assert.equal(after.cards.filter(card=>card.owned).length,1);

   }
  }
  assert.ok(lost);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(!page.url().endsWith('#batalla'))await page.locator('.bottom-nav a[href="#batalla"]').click();
  await page.locator('.tribute-scoreboard').waitFor();
  const buttons=page.locator('#main button');
  assert.equal(await buttons.count(),2);
  assert.deepEqual(await page.locator('.tribute-win-count').allTextContents(),['0','0']);
  for(const index of [1,2,1]){
   const done=page.waitForResponse(response=>response.url().endsWith('/battle/win')&&response.status()===200);
   await page.locator('.tribute-win[data-tribute="'+index+'"]').click();
   await done;
  }
  await page.reload();
  await page.locator('.tribute-scoreboard').waitFor();
  assert.deepEqual(await page.locator('.tribute-win-count').allTextContents(),['2','1']);
  if(process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-'+name.split(' ')[0]+'.png'),fullPage:true,animations:'disabled'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 });
}
