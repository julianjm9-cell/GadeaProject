const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {chromium,webkit}=require('./browser-runtime.cjs');
for(const [name,engine,viewport] of [['Chromium',chromium,{width:1440,height:1000}],['WebKit',webkit,{width:390,height:844}]]) {
 test(`Encargos tiene una entrada, conserva borradores y muestra estados sin publicar a mano en ${name}`,{timeout:35000},async t=>{
  const {createDashboard}=await import('../scripts/educame-dashboard.mjs');
  const directory=await mkdtemp(join(tmpdir(),'educame-queue-browser-'));
  let plans=0;
  const server=await createDashboard({directory,apiKey:'',codex:{status:async()=>({ready:true}),models:async()=>[{id:'ensayo',label:'Modelo de ensayo',recommended:true}],
   coordinate:async()=>{plans++;return {plan:{action:'answer',reply:'Respuesta de ensayo, sin modificar aplicaciones.',tasks:[]},tokens:12};}}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
  const browser=await engine.launch(name==='Chromium'?{channel:'msedge'}:{});t.after(()=>browser.close());
  const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const submitted=[];
  await page.route('**/api/chat',async route=>{if(route.request().method()!=='POST')return route.continue();submitted.push(route.request().postDataJSON().id);if(submitted.length===1){await route.fetch();return route.abort();}return route.continue();});
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base+'/#agentes/publicar');
  await page.getByRole('heading',{name:'Encargos',exact:true}).waitFor();
  assert.equal(new URL(page.url()).hash,'#chat');
  const input=page.getByLabel('¿Qué quieres hacer?');await input.fill('Explícame el sistema de cola de Inglés');
  await page.reload();await page.getByRole('button',{name:'Añadir a la cola',exact:true}).waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#chat-form [type=submit]').disabled);
  assert.equal(await input.inputValue(),'Explícame el sistema de cola de Inglés');
  await page.getByRole('button',{name:'Añadir a la cola',exact:true}).click();
  await page.locator('#chat-form [role=alert]').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Añadir a la cola',exact:true}).click();
  assert.equal(submitted.length,2);assert.equal(submitted[0],submitted[1],'el reintento usa el mismo recibo');
  await page.getByText('Respuesta de ensayo, sin modificar aplicaciones.',{exact:true}).waitFor();
  assert.equal(await page.locator('#chat-messages .order-card').count(),1);assert.equal(plans,1);
  await page.getByRole('button',{name:'Gestionar agentes',exact:true}).click();
  await page.locator('#agent-editor').waitFor({state:'visible'});
  await page.locator('#close-agent-editor').click();
  assert.equal(await page.getByRole('button',{name:'Subir',exact:true}).count(),0);
  assert.equal(await page.getByRole('link',{name:'Ver en local',exact:true}).count(),0);
  assert.equal(await page.locator('#terrace-navigation a[href="#agentes"]').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(name==='Chromium') await page.screenshot({path:'.educame-agents/encargos-cola-escritorio.png',fullPage:true});
  else await page.screenshot({path:'.educame-agents/encargos-cola-movil.png',fullPage:true});
  assert.deepEqual(errors,[]);
 });
}
