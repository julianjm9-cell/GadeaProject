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
  await page.context().clearCookies();await page.goto(base+'/gadeos');await page.getByRole('heading',{name:'JUEGOS DEL HAMBRE EN CHINCHÓN',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.login-scene')?.naturalWidth>0);
  if(process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-login-'+name.split(' ')[0]+'.png'),fullPage:true,animations:'disabled'});
  assert.equal((await page.request.get(base+config.media.poster)).status(),401);
  assert.equal(await page.getByRole('button',{name:'Crear cuenta',exact:true}).count(),0);assert.equal(await page.title(),'JUEGOS DEL HAMBRE EN CHINCHÓN');assert.doesNotMatch(await page.locator('body').innerText(),/GADEOS/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByLabel('Nombre de tributo').fill('Alma');await page.getByLabel('Contraseña',{exact:true}).fill('ensayo-seguro-123');await page.getByRole('button',{name:/Entrar en la arena/}).click();
  await page.getByText('TU TRIBUTO · Alma',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.event-poster')?.naturalWidth>0);
  assert.equal(await page.locator('.bottom-nav a').count(),3);
  await page.getByRole('heading',{name:'Vuestro planning',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Guía',exact:true}).count(),0);
  const cta=await page.locator('.next-step').boundingBox(),nav=await page.locator('.bottom-nav').boundingBox();assert.ok(cta.y+cta.height<=nav.y,'El siguiente paso queda visible por encima de la navegación.');
  assert.equal((await (await page.request.get(base+'/api/private-apps/gadeos/state')).json()).completed,0);
  if(process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-home-'+name.split(' ')[0]+'.png'),fullPage:true,animations:"disabled"});
  await page.locator('.bottom-nav a[href="#recorrido"]').click();assert.equal(await page.locator('[data-station="2"]').isEnabled(),false);
  assert.equal(await page.locator('[data-station]').count(),9);
  await page.waitForFunction(()=>document.querySelector('.collection-cover')?.naturalWidth>0);
  if(process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-route-'+name.split(' ')[0]+'.png'),fullPage:true,animations:"disabled"});
  let lost=false;await page.route('**/stations/answer',async route=>{const body=route.request().postDataJSON();if(!lost&&body.station===1&&body.answer===config.stations[0].solution){lost=true;await route.fetch();return route.abort();}return route.continue();});
  for(let i=0;i<9;i++){
   await page.locator(`[data-station="${i+1}"]`).click();const dialog=page.locator('#challenge');await dialog.waitFor();const input=dialog.getByLabel('Tu respuesta',{exact:true});
   if(i===0){await input.fill('INCORRECTO');await dialog.getByRole('button',{name:'Comprobar y abrir sobre'}).click();await dialog.getByRole('alert').waitFor({state:'visible'});assert.equal((await (await page.request.get(base+'/api/private-apps/gadeos/state')).json()).completed,0);}
   assert.equal(await dialog.locator('input').count(),1);assert.equal(await dialog.locator('.choice-list,.memory-board,.order-slot').count(),0);
   assert.equal(await dialog.locator('.challenge-prompt').count(),1);
   await input.fill(config.stations[i].solution);
   await dialog.getByRole('button',{name:'Comprobar y abrir sobre'}).click();
   if(i===0){await dialog.getByRole('alert').waitFor({state:'visible'});await dialog.getByRole('button',{name:'Comprobar y abrir sobre'}).click();}
   await page.getByRole('button',{name:'Abrir sobre',exact:true}).waitFor().catch(async error=>{await page.screenshot({path:'.educame-agents/gadeos-failed.png',fullPage:true,animations:"disabled"});throw Error('Estación '+(i+1)+': '+await page.locator('#challenge').innerText()+'; errores='+JSON.stringify(errors));});await page.waitForFunction(()=>document.querySelector('.earned-pack img')?.naturalWidth>0);await page.locator('.earned-pack').evaluate(node=>Promise.all(node.getAnimations().map(animation=>animation.finished)));assert.equal(await page.locator('.earned-pack').evaluate(node=>getComputedStyle(node).opacity),'1');if(i===0&&process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'gadeos-pack-'+name.split(' ')[0]+'.png'),fullPage:true,animations:"disabled"});await page.getByRole('button',{name:'Abrir sobre',exact:true}).click();await page.locator('.reward-card').waitFor();await page.getByRole('button',{name:'Continuar recorrido',exact:true}).click();
   if(i===0){await page.reload();await page.locator('[data-station="2"]').waitFor();assert.equal(await page.locator('[data-station="2"]').isEnabled(),true);assert.equal((await (await page.request.get(base+'/api/private-apps/gadeos/state')).json()).cards.filter(card=>card.owned).length,1);}
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
