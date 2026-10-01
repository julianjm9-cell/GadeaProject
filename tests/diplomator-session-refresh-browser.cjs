const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
  const root=path.resolve('apps/diplomator');
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    const relative=url.pathname==='/assets/diplomator-refresh.css' ? 'assets/diplomator-refresh.css' : url.pathname.replace(/^\/apps\/diplomator\/?/,'') || 'index.html';
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep) && file!==path.join(root,'index.html')){res.writeHead(403);res.end();return}
    try {
      const data=fs.readFileSync(file);
      res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html; charset=utf-8'});
      res.end(data);
    } catch {res.writeHead(404);res.end()}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let generations=0;
    let pdfPayload=null;
    await page.route('**/api/**',route=>{
      const url=new URL(route.request().url());
      let data={ok:true};
      let status=200;
      if(url.pathname==='/api/status') data={ok:true,user:{email:'prueba@local',name:'Laura',license_key:'DIPLO-TEST'},limits:{max_vocab:5,profile_chars:420}};
      if(url.pathname==='/api/state'&&route.request().method()==='GET')data={};
      if(url.pathname==='/api/diplomator/points-models')data={ok:true,models:[{id:'gemini:gemini-3.8-flash',provider:'gemini',model:'gemini-3.8-flash'}]};
      if(url.pathname==='/api/diplomator/export-pdf'){
        pdfPayload=route.request().postDataJSON();
        return route.fulfill({status:200,contentType:'application/pdf',body:'%PDF-1.4 test'});
      }
      if(url.pathname==='/api/chat'){
        generations++;
        if(generations===1||generations===3){status=502;data={detail:'Gemini 503: This model is currently experiencing high demand.'}}
        else data={ok:true,provider:'gemini',model:'gemini-3.8-flash',content:JSON.stringify({points:[{title:'Baroja and the Generation of 1898',text:'Pío Baroja was one of the novelists of the Generation of 1898. His fiction follows restless characters and takes a critical view of Spanish society. His direct prose gives students a concrete way to discuss the period in an oral examination.',vocab:[{word:'restless',def:'inquieto'},{word:'outlook',def:'perspectiva'}]},{title:'The novel as a personal search',text:'Baroja’s protagonists move through doubt and difficult decisions. Their personal search helps explain his pessimism through the stories themselves, without relying on broad claims about the whole generation.',vocab:[]}]})};
      }
      return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/apps/diplomator/index.html`);
    await page.locator('#pointsModelChoice option').nth(1).waitFor({state:'attached'});
    await page.locator('[data-tab-btn="temas"]').click();
    assert.equal(await page.locator('#cattabs-2026 .cat-tab-btn').count()>0,true);
    assert.equal(await page.locator('#topicsgrid-2026 .topic-item').count()>0,true);
    await page.screenshot({path:'tools/diplomator-topics-refresh-desktop.png',fullPage:true});
    await page.locator('#topicSearchInput').fill('Sahel');
    assert.equal(await page.locator('#searchGrid .topic-item').count()>0,true);
    await page.locator('#topicSearchInput').fill('');
    await page.locator('#ytab-2025').click();
    assert.equal(await page.locator('#cattabs-2025 .cat-tab-btn:visible').count()>0,true);
    await page.locator('#ytab-2026').click();
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    await page.screenshot({path:'tools/diplomator-topics-refresh-mobile.png'});
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>showTab('config'));
    await page.screenshot({path:'tools/diplomator-config-refresh-desktop.png'});
    await page.evaluate(async()=>startSessionWithTopic('Pío Baroja',false));
    assert.equal(await page.locator('.session-header').evaluate(el=>getComputedStyle(el).borderRadius),'16px');
    assert.equal(await page.locator('#generateNotesButton').count(),1);
    assert.equal(await page.locator('.generation-empty').isVisible(),true);
    await page.locator('#generateNotesButton').click();
    await page.locator('.generation-error').waitFor();
    assert.equal(generations,1);
    assert.match(await page.locator('.generation-error').innerText(),/saturado temporalmente/i);
    assert.doesNotMatch(await page.locator('.generation-error').innerText(),/high demand/i);
    await page.getByRole('button',{name:'Reintentar'}).click();
    await page.locator('.point-card').first().waitFor();
    assert.equal(generations,2);
    assert.equal(await page.locator('.point-card').count(),2);
    assert.match(await page.locator('#pointsGenerationMeta').innerText(),/Gemini 3.8 Flash/);
    assert.equal(await page.locator('.session-vocab-card').count(),2);
    const initialWidth=await page.evaluate(()=>state.config.vocabColumnWidth);
    const resizeBox=await page.locator('#workspaceResizer').boundingBox();
    await page.mouse.move(resizeBox.x+resizeBox.width/2,resizeBox.y+50);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x-35,resizeBox.y+50);
    await page.mouse.up();
    assert.equal(await page.evaluate(()=>state.config.vocabColumnWidth)>initialWidth,true);
    await page.locator('.session-vocab-card button').first().click();
    assert.match(await page.locator('.session-vocab-card button').first().innerText(),/Guardado/);
    await page.screenshot({path:'tools/diplomator-session-refresh-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    assert.equal(await page.locator('#generateNotesButton').isVisible(),true);
    await page.screenshot({path:'tools/diplomator-session-refresh-mobile.png',fullPage:true});
    await page.locator('#generateNotesButton').click();
    await page.locator('.generation-error').waitFor();
    assert.equal(await page.locator('#aiPoints .point-card').count(),2,'Un error al regenerar no debe borrar los apuntes anteriores');
    await page.locator('#airow-1 .btn-danger').click();
    assert.equal(await page.locator('#aiPoints .point-card').count(),2,'Descartar conserva la posición del punto');
    assert.equal(await page.locator('#airow-1.rejected').count(),1);
    await page.locator('#airow-0 .point-actions button').first().click();
    assert.equal(await page.locator('#airow-0.accepted').count(),1);
    assert.equal(await page.locator('#savedPoints .point-card').count(),0,'El punto aceptado no debe duplicarse');
    assert.equal(await page.evaluate(()=>acceptedSessionPoints().length),1);
    await page.evaluate(async()=>saveSession());
    assert.equal(await page.evaluate(()=>state.history.length),1);
    await page.evaluate(async()=>saveSession());
    assert.equal(await page.evaluate(()=>state.history.length),1,'Guardar de nuevo actualiza la misma sesión');
    assert.equal(await page.locator('#sessionActive').isVisible(),true,'Guardar deja abierto el documento para exportarlo');
    await page.evaluate(async()=>exportSessionPdf());
    assert.equal(pdfPayload.points.length,1);
    assert.equal(pdfPayload.points[0].connection,'');
    assert.equal(pdfPayload.vocab.length,1);
    await page.locator('#saveCloseSessionButton').click();
    await page.waitForFunction(()=>state.currentSession===null);
    assert.equal(await page.evaluate(()=>state.currentSession),null,'Guardar y cerrar termina el borrador actual');
    assert.equal(await page.locator('.history-summary').count(),1);
    assert.match(await page.locator('#historyDetail').innerText(),/restless/);
    page.once('dialog',dialog=>dialog.accept('Idea propia'));
    await page.getByRole('button',{name:'Añadir punto'}).click();
    await page.waitForFunction(()=>state.history[0].points.length===2);
    assert.match(await page.locator('.history-summary small').innerText(),/2 puntos/);
    const legacyVocab=await page.evaluate(()=>{
      state.currentSession={topic:'Sesión anterior',aiPoints:[],savedPoints:[{title:'Idea',text:'Texto',type:'ai',vocab:[{word:'legacy',def:'antiguo'}]}]};
      normalizeAppState();
      return state.currentSession.savedVocab;
    });
    assert.deepEqual(legacyVocab.map(item=>item.word),['legacy']);
    assert.deepEqual(errors,[]);
    console.log('PASS Diplomator session desktop/mobile, retry and clear error');
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exit(1)});
