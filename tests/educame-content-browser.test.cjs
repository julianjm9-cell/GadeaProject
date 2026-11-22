const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtemp,mkdir,writeFile,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join,resolve,relative}=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {once}=require('node:events');
const {chromium,webkit}=require('./browser-runtime.cjs');
const exec=promisify(execFile);
for(const [name,engine,viewport]of [['Chromium',chromium,{width:1440,height:1000}],['WebKit',webkit,{width:390,height:844}]]){
  test('Contenido permite encontrar, editar, recuperar y encargar una corrección en '+name,{timeout:60000},async t=>{
    const directory=await mkdtemp(join(tmpdir(),'educame-content-browser-')),root=join(directory,'repo');
    await mkdir(join(root,'apps/cambridge'),{recursive:true});await mkdir(join(root,'tests'));
    const git=async(...args)=>(await exec('git',args,{cwd:root,windowsHide:true})).stdout;
    await git('init','-b','main');await git('config','user.email','browser@example.invalid');await git('config','user.name','Browser');
    await writeFile(join(root,'apps/cambridge/index.html'),'<!doctype html><html><title>Inglés</title><body><h1>Práctica de inglés</h1><script>const GAME={id:"bus-1",title:"El autobús de las palabras",question:"¿Qué billete necesitas?",options:["Ida","Ida y vuelta"],correct:0,explanation:"One-way es un billete de ida.",stages:[{title:"La parada",question:"¿Cuándo sale?",answer:"Ahora"}]};</script></body></html>\n');
    await writeFile(join(root,'tests/content-check.test.cjs'),"require('node:test')('identidad conservada',()=>require('node:assert/strict').match(require('node:fs').readFileSync('apps/cambridge/index.html','utf8'),/bus-1/));");
    await git('add','.');await git('-c','commit.gpgsign=false','commit','-m','Ensayo');
    const {createDashboard}=await import('../scripts/educame-dashboard.mjs');
    const server=await createDashboard({directory:join(directory,'data'),repositoryRoot:root,apiKey:'',fetchImpl:async()=>Response.json({}),codex:{status:async()=>({ready:true}),models:async()=>[{id:'ensayo',label:'Ensayo'}],implement:async()=>({draft:{resumen:'Texto revisado',entrega:'Campo corregido',comprobaciones:[],pendientes:[]},checks:[{command:'node --test tests/content-check.test.cjs'}]})}});
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const browser=await engine.launch(name==='Chromium'?{channel:'msedge'}:{});
    t.after(async()=>{await browser.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await new Promise(resolve=>setTimeout(resolve,300));assert.match(relative(resolve(tmpdir()),resolve(directory)),/^educame-content-browser-[\w-]+$/);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
    const page=await browser.newPage({viewport});page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',error=>errors.push(error.message));const base='http://127.0.0.1:'+server.address().port;
    await page.goto(base+'/#contenido');await page.getByRole('combobox',{name:'Aplicación del contenido',exact:true}).selectOption('ingles');await page.getByRole('combobox',{name:'Tipo de contenido',exact:true}).selectOption('juegos');await page.getByPlaceholder('Tema, juego, pregunta o texto…').fill('autobús');
    await page.locator('.content-card').getByText('El autobús de las palabras',{exact:true}).waitFor();await page.locator('.content-card').filter({hasText:'El autobús de las palabras'}).click();
    const dialog=page.locator('#content-dialog');await dialog.getByRole('heading',{name:'El autobús de las palabras'}).waitFor();
    await dialog.getByRole('button',{name:'La parada →',exact:true}).click();await dialog.getByRole('heading',{name:'La parada',exact:true}).waitFor();await dialog.getByRole('button',{name:'← El autobús de las palabras',exact:true}).click();await dialog.getByRole('heading',{name:'El autobús de las palabras',exact:true}).waitFor();
    const question=dialog.getByRole('textbox',{name:'Pregunta',exact:true});await question.fill('¿Qué billete pedirías para volver hoy?');
    await dialog.getByRole('status').getByText('Borrador guardado en LA TERRAZA.',{exact:true}).waitFor();
    const secondOption=dialog.getByRole('textbox',{name:'Opciones 2',exact:true});await secondOption.fill('Ida y vuelta hoy');
    const correct=dialog.getByLabel('Respuesta correcta',{exact:false});await correct.selectOption({label:'Ida y vuelta hoy'});
    await page.reload();await page.locator('.content-card').filter({hasText:'El autobús de las palabras'}).click();
    assert.equal(await question.inputValue(),'¿Qué billete pedirías para volver hoy?');assert.equal(await correct.inputValue(),'1');assert.equal(await correct.locator('option:checked').textContent(),'Ida y vuelta hoy');
    assert.ok(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1));
    assert.ok(await dialog.evaluate(node=>{const rect=node.getBoundingClientRect();return rect.top>=0&&rect.bottom<=innerHeight+1;}),'el editor cabe en el alto de la pantalla');
    if(process.env.EDUCAME_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.EDUCAME_SCREENSHOT_DIR,'contenido-editor-'+name+'.png')});
    await dialog.getByRole('button',{name:'Aplicar correcciones',exact:true}).click();await page.waitForFunction(()=>location.hash==='#chat');
    await page.locator('#chat-messages').getByRole('heading',{name:'Corregir contenido: El autobús de las palabras',exact:true}).waitFor();
    let panel;for(let i=0;i<50;i++){panel=await (await page.request.get(base+'/api/panel')).json();if(panel.batch?.state==='finished')break;await page.waitForTimeout(200);}
    assert.equal(panel.history[0]?.implementation?.verified,true,JSON.stringify(panel.history[0]?.error));
    assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  });
}
