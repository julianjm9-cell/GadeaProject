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
    await page.route('**/api/**',route=>{
      const url=new URL(route.request().url());
      let data={ok:true};
      let status=200;
      if(url.pathname==='/api/status') data={ok:true,user:{email:'prueba@local',name:'Laura',license_key:'DIPLO-TEST'},limits:{max_vocab:5,profile_chars:420}};
      if(url.pathname==='/api/state'&&route.request().method()==='GET')data={};
      if(url.pathname==='/api/diplomator/points-models')data={ok:true,models:[{id:'gemini:gemini-3.8-flash',provider:'gemini',model:'gemini-3.8-flash'}]};
      if(url.pathname==='/api/chat'){
        generations++;
        if(generations===1||generations===3){status=502;data={detail:'Gemini 503: This model is currently experiencing high demand.'}}
        else data={ok:true,provider:'gemini',model:'gemini-3.8-flash',content:JSON.stringify({points:[{title:'Baroja y la Generación del 98',text:'Pío Baroja fue uno de los novelistas de la Generación del 98. Sus obras muestran personajes inquietos y una mirada crítica de la sociedad española, con una prosa directa que resulta fácil de comentar en un examen oral.',vocab:[{word:'restless',def:'inquieto'},{word:'outlook',def:'perspectiva'}]},{title:'La novela como búsqueda',text:'En sus novelas, los protagonistas avanzan entre dudas y decisiones difíciles. Esa búsqueda personal permite explicar el pesimismo de Baroja sin repetir ideas generales.',vocab:[]}]})};
      }
      return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/apps/diplomator/index.html`);
    await page.locator('#pointsModelChoice option').nth(1).waitFor({state:'attached'});
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
    assert.equal(await page.locator('.vocab-card').count(),1);
    await page.locator('.points-how').click();
    assert.equal(await page.locator('#pointsHelp').isVisible(),true);
    await page.screenshot({path:'tools/diplomator-session-refresh-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    assert.equal(await page.locator('#generateNotesButton').isVisible(),true);
    await page.screenshot({path:'tools/diplomator-session-refresh-mobile.png',fullPage:true});
    await page.locator('#generateNotesButton').click();
    await page.locator('.generation-error').waitFor();
    assert.equal(await page.locator('#aiPoints .point-card').count(),2,'Un error al regenerar no debe borrar los apuntes anteriores');
    await page.locator('#airow-1 .btn-danger').click();
    assert.equal(await page.locator('#aiPoints .point-card').count(),1);
    assert.match(await page.locator('#pointsGenerationMeta').innerText(),/1 por revisar/);
    await page.locator('#airow-0 .btn-accept').click();
    assert.equal(await page.locator('#savedPoints .point-card').count(),1);
    assert.deepEqual(errors,[]);
    console.log('PASS Diplomator session desktop/mobile, retry and clear error');
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exit(1)});
