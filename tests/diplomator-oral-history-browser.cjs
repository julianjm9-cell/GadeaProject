const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
  const root=path.resolve('apps/diplomator');
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const relative=pathname.replace(/^\/apps\/diplomator\/?/,'') || 'index.html';
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){res.writeHead(403);res.end();return}
    try {const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':'text/html; charset=utf-8'});res.end(data)}
    catch {res.writeHead(404);res.end()}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[];let pdfPayload;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/**',route=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/diplomator/export-pdf'){
        pdfPayload=route.request().postDataJSON();
        return route.fulfill({status:200,contentType:'application/pdf',body:'%PDF-1.4 test'});
      }
      let data={ok:true};
      if(url.pathname==='/api/status')data={ok:true,user:{email:'prueba@local',name:'Laura',license_key:'DIPLO-TEST'},limits:{max_vocab:5,profile_chars:420}};
      if(url.pathname==='/api/state'&&route.request().method()==='GET')data={};
      if(url.pathname==='/api/diplomator/points-models')data={ok:true,models:[]};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/apps/diplomator/index.html`);
    await page.evaluate(()=>showTab('recitar',document.querySelector('[data-tab-btn="recitar"]')));
    await page.locator('#reciteTopicInput').selectOption({label:'El Sahel'});
    await page.locator('#reciteNotes').fill('Plan oral sobre la región.');
    await page.locator('#reciteTranscript').fill('The Sahel faces several challenges.');
    await page.evaluate(()=>{state.recitePractice.correctionText='SUMMARY\n- Good structure.\nPRIORITY CORRECTIONS\n- Add a precise example.';document.getElementById('reciteCorrection').innerHTML=renderCorrectionReport(state.recitePractice.correctionText);document.getElementById('reciteCorrection').style.display='block';syncReciteSaveMenu()});
    assert.equal(await page.locator('#reciteSaveMenuButton').isVisible(),true);
    await page.screenshot({path:'tools/diplomator-oral-refresh-desktop.png'});
    await page.locator('#reciteSaveMenuButton').click();
    await page.getByRole('button',{name:'Guardar en app'}).last().click();
    assert.equal(await page.evaluate(()=>state.history.length),1);
    assert.equal(await page.evaluate(()=>state.history[0].oralPractices.length),1);
    await page.evaluate(async()=>exportReciteCorrectionPdf());
    assert.equal(pdfPayload.oralPractices.length,1);
    await page.evaluate(()=>showTab('historial',document.querySelector('[data-tab-btn="historial"]')));
    assert.match(await page.locator('.history-summary').innerText(),/corrección oral/);
    assert.match(await page.locator('#historyDetail').innerText(),/Add a precise example/);
    await page.evaluate(async()=>{session={topic:'El Sahel',aiPoints:[],savedPoints:[{title:'Contexto',text:'Notas del mismo tema',type:'manual'}],savedVocab:[]};await saveSession()});
    assert.equal(await page.evaluate(()=>state.history.length),1,'Apuntes y práctica oral deben compartir entrada');
    assert.equal(await page.evaluate(()=>state.history[0].oralPractices.length),1);
    await page.evaluate(async()=>saveAndCloseCurrentSession());
    assert.equal(await page.evaluate(()=>state.currentSession),null);
    assert.equal(await page.locator('.history-summary').count(),1);
    await page.evaluate(()=>exportHistoryEntryPdf(0));
    await page.waitForTimeout(100);
    assert.equal(pdfPayload.points.length,1);
    assert.equal(pdfPayload.oralPractices.length,1);
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>showTab('recitar',document.querySelector('[data-tab-btn="recitar"]')));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    await page.screenshot({path:'tools/diplomator-oral-refresh-mobile.png'});
    assert.deepEqual(errors,[]);
    console.log('PASS Diplomator oral save, history grouping, PDF and mobile layout');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exit(1)});
