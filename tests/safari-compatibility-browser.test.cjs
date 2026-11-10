const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, extname, sep } = require('node:path');
const { chromium, webkit } = require('./browser-runtime.cjs');

const root = resolve(__dirname, '..');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2' };

async function serve() {
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.startsWith('/api/')) {
      response.writeHead(404, { 'content-type':'application/json' });
      response.end('{}');
      return;
    }
    const assetPath = pathname.replace(/^\/assets\/cambridge-studio\//, '/apps/cambridge/assets/studio/');
    const file = resolve(root, '.' + assetPath);
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    try {
      const bytes = await readFile(file);
      response.writeHead(200, { 'content-type':mime[extname(file)] || 'application/octet-stream' });
      response.end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  return { origin:`http://127.0.0.1:${server.address().port}`, close:()=>new Promise(done => server.close(done)) };
}

test('ESO Adultos and Profesor Particular work with WebKit touch and Chromium at phone, tablet and desktop sizes', { timeout:120000 }, async () => {
  const site = await serve();
  try {
    for (const [engine, name] of [[webkit,'WebKit'],[chromium,'Chromium']]) {
      const browser = await engine.launch(name==='Chromium' ? { headless:true, channel:'msedge' } : { headless:true });
      try {
        for (const viewport of [{width:320,height:640},{width:390,height:844},{width:768,height:1024},{width:1366,height:768}]) {
          const page = await browser.newPage({ viewport, hasTouch:true, isMobile:viewport.width<=768 });
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          for(const landing of ['profesor-particular','eso-adultos']){
            await page.goto(`${site.origin}/marketing/app_landings_demo/${landing}.html`);
            assert.equal(await page.locator('#googleEntry').isVisible(),true,`${name} ${landing} Google entry ${viewport.width}`);
            const overflow=await page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth);
            assert.ok(overflow<=2,`${name} ${landing} landing ${viewport.width} horizontal overflow ${overflow}`);
          }
          await page.goto(`${site.origin}/apps/e25/index.html?demo=1`);
          await page.waitForFunction(() => typeof startGame === 'function' && typeof EsoAdultGames !== 'undefined');
          if(viewport.width===1366){
            const issues=await page.evaluate(() => {
              const problems=[];
              for(const module of MODULES.filter(item=>!['exam','oficial'].includes(item.id))) for(const topic of module.tasks) for(const kind of ['quiz','pairs','quest']) {
                try { startGame(topic.id,kind); if(!document.querySelector('.eso-game-run'))problems.push(`${topic.id}: ${kind} did not open`); }
                catch(error){problems.push(`${topic.id}: ${kind}: ${error.message}`);}
              }
              return problems;
            });
            assert.deepEqual(issues,[],`${name} ESO catalog`);
          }
          if(viewport.width===390||viewport.width===1366){
            const layoutIssues=await page.evaluate(() => {
              const problems=[];
              for(const module of MODULES.filter(item=>['ingles','lengua','geografia','historia','matematicas','ciencias'].includes(item.id))) for(const topic of module.tasks){
                if(!EsoAdultGames.missionBoard(topic))continue;
                startGame(topic.id,'quest');
                const board=document.querySelector('.eso-object-board'),surface=board?.querySelector('.eso-object-surface'),answers=board?.querySelector('.eso-object-answers');
                if(!board||!surface||!answers){problems.push(`${topic.id}: missing board`);continue;}
                if(board.scrollWidth-board.clientWidth>2||surface.scrollHeight-surface.clientHeight>2||document.documentElement.scrollWidth-document.documentElement.clientWidth>2)problems.push(`${topic.id}: clipped board`);
              }
              return problems;
            });
            assert.deepEqual(layoutIssues,[],`${name} ESO mission layouts ${viewport.width}`);
          }
          await page.evaluate(() => startGame('mat-geometria','quest'));
          assert.equal(await page.locator('.eso-game-run').count(),1,`${name} ESO ${viewport.width}`);
          const esoOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          assert.ok(esoOverflow <= 2,`${name} ESO ${viewport.width} horizontal overflow ${esoOverflow}`);
          const correct = await page.evaluate(() => { const mod=MODULES.find(item=>item.id==='matematicas');const topic=mod.tasks.find(item=>item.id==='mat-geometria');return EsoAdultGames.topicQuest(topic,mod,MODEL_UNITS).stations[0].correct; });
          await page.locator('.eso-object-answers button').nth(correct).tap();
          await page.locator('[data-eso-dock]').tap();
          assert.equal(await page.locator('.eso-object-board[data-solved="true"]').count(),1,`${name} ESO touch answer ${viewport.width}`);
          await page.evaluate(() => startGame('mat-geometria','quiz'));
          const quizCorrect=await page.evaluate(() => { const mod=MODULES.find(item=>item.id==='matematicas'),topic=mod.tasks.find(item=>item.id==='mat-geometria');return EsoAdultGames.topicQuiz(topic,mod,MODEL_UNITS)[0].correct; });
          await page.locator('.eso-game-options button').nth(quizCorrect).tap();
          assert.equal(await page.locator('.eso-game-options button.correct').count(),1,`${name} ESO quiz touch ${viewport.width}`);
          await page.evaluate(() => startGame('mat-geometria','pairs'));
          await page.locator('.eso-game-pairs button').first().tap();
          assert.equal(await page.locator('.eso-game-pairs button.revealed').count(),1,`${name} ESO pairs touch ${viewport.width}`);

          await page.goto(`${site.origin}/apps/profesor/index.html?demo=1`);
          await page.waitForFunction(() => typeof runActivity === 'function');
          if(viewport.width===1366){
            const issues=await page.evaluate(() => {
              const problems=[];
              for(const material of publicAdvancedGames){
                try { runActivity(material,''); if(!document.querySelector('#dialog [data-type]'))problems.push(`${material.id}: game did not open`);document.querySelector('#dialog')?.close(); }
                catch(error){problems.push(`${material.id}: ${error.message}`);document.querySelector('#dialog')?.close();}
              }
              return problems;
            });
            assert.deepEqual(issues,[],`${name} Profesor catalog`);
          }
          await page.evaluate(() => runActivity({id:'safari-wordsearch',title:'Biología',subject:'Biología',activity:{version:1,questions:[{type:'wordsearch',prompt:'Encuentra las palabras.',answer:'Completado',options:['CELULA','ATOMO','ENERGIA']}] }},''));
          assert.ok(await page.locator('.wordsearch-grid button').count() > 0,`${name} wordsearch ${viewport.width}`);
          const professorOverflow = await page.evaluate(() => ({page:document.documentElement.scrollWidth-document.documentElement.clientWidth,dialog:document.querySelector('#dialog').scrollWidth-document.querySelector('#dialog').clientWidth}));
          assert.ok(professorOverflow.page <= 2 && professorOverflow.dialog <= 2,`${name} professor ${viewport.width} overflow ${JSON.stringify(professorOverflow)}`);
          const cells = await page.evaluate(() => buildWordSearch(puzzleRows('wordsearch',['CELULA','ATOMO','ENERGIA'])).placements[0].cells.map(([r,c])=>r*10+c));
          await page.locator(`[data-cell="${cells[0]}"]`).tap();
          await page.locator(`[data-cell="${cells.at(-1)}"]`).tap();
          assert.equal(await page.locator('.wordsearch-grid button.selected').count(),cells.length,`${name} touch letter selection ${viewport.width}`);
          await page.evaluate(() => runActivity({id:'safari-rosco',title:'Vocabulario',subject:'Lengua',activity:{version:1,questions:[{type:'pasapalabra',prompt:'Completa el rosco.',answer:'Completado',options:Array.from({length:18},(_,i)=>`${String.fromCharCode(65+i)} | Pista breve | Palabra`)}]}},''));
          const rosco = await page.evaluate(() => {
            const card=document.querySelector('.pasapalabra-card').getBoundingClientRect();
            const overlap=rect=>card.left<rect.right&&card.right>rect.left&&card.top<rect.bottom&&card.bottom>rect.top;
            const letters=[...document.querySelectorAll('.pasapalabra-wheel button')].filter(button=>overlap(button.getBoundingClientRect())).map(button=>button.textContent.trim());
            const bounds=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();
            const content=document.querySelector('.play-content');
            return {letters,controls:bounds('.pasapalabra-controls'),meta:bounds('.pasapalabra-meta'),footer:bounds('.play-footer'),scrollHeight:content.scrollHeight,clientHeight:content.clientHeight};
          });
          assert.deepEqual(rosco.letters,[],`${name} rosco overlap ${viewport.width}: ${JSON.stringify(rosco)}`);
          if(viewport.width>700) assert.ok(rosco.controls.bottom<=rosco.meta.top+1,`${name} rosco controls overlap ${viewport.width}: ${JSON.stringify(rosco)}`);
          else assert.ok(rosco.meta.bottom<=rosco.footer.top+1||rosco.scrollHeight>rosco.clientHeight,`${name} mobile rosco is clipped without scrolling: ${JSON.stringify(rosco)}`);
          await page.locator('[data-next]').tap();
          assert.match(await page.locator('.pasapalabra-finish').innerText(),/2 \/ 18/,`${name} rosco navigation ${viewport.width}`);
          await page.evaluate(() => runActivity({id:'safari-matching',title:'Relaciona',subject:'Ciencias',activity:{version:1,questions:[{type:'dragdrop',prompt:'Relaciona cada elemento.',answer:'Completado',options:['Sol | Estrella','Tierra | Planeta','Luna | Satélite']}] }},''));
          const destination=page.locator('#puzzle-0 .match-bucket').filter({hasText:'Planeta'});
          await page.locator('#puzzle-0 .match-bank [data-match-piece="1"]').tap();
          await destination.locator('[data-match-bucket]').tap();
          assert.equal(await destination.locator('[data-match-piece="1"]').count(),1,`${name} touch matching ${viewport.width}`);
          if(viewport.width===1366){
            await page.locator('#puzzle-0 [data-match-reset]').click();
            await page.locator('#puzzle-0 .match-bank [data-match-piece="1"]').dragTo(destination);
            assert.equal(await destination.locator('[data-match-piece="1"]').count(),1,`${name} drag matching ${viewport.width}`);
            await page.evaluate(() => runActivity({id:'safari-pairs',title:'Parejas',subject:'Inglés',activity:{version:1,questions:[{type:'pairs',prompt:'Gato',answer:'Cat',options:[]},{type:'pairs',prompt:'Perro',answer:'Dog',options:[]}] }},''));
            await page.locator('[data-question="0"] [data-piece="0"]').dragTo(page.locator('[data-question="0"] [data-bucket]').filter({hasText:'Cat'}));
            assert.equal(await page.locator('[data-question="0"] [data-return="0"]').count(),1,`${name} drag pairs ${viewport.width}`);
            await page.evaluate(() => runActivity({id:'safari-order',title:'Ordenar',subject:'Ciencias',activity:{version:1,questions:[{type:'order',prompt:'Ordena las fases.',answer:'A → B → C',options:['A','B','C']}] }},''));
            const before=await page.locator('#order-0 .order-value').allTextContents();
            await page.locator('#order-0 [data-sequence-row="0"]').dragTo(page.locator('#order-0 [data-sequence-row="2"]'));
            const after=await page.locator('#order-0 .order-value').allTextContents();
            assert.notDeepEqual(after,before,`${name} drag order ${viewport.width}`);
          }
          if(viewport.width<=390){
            await page.evaluate(() => runActivity({id:'safari-long-clue',title:'Vocabulario',subject:'Lengua',activity:{version:1,questions:[{type:'pasapalabra',prompt:'Completa el rosco.',answer:'Completado',options:Array.from({length:18},(_,i)=>`${String.fromCharCode(65+i)} | Concepto que relaciona varias ideas del tema y se explica mediante una definición extensa con distintos matices para repasar antes de responder | palabra`)}]}},''));
            const fit=await page.evaluate(() => {
              const card=document.querySelector('.pasapalabra-card').getBoundingClientRect(),input=document.querySelector('.pasapalabra-card input').getBoundingClientRect(),button=document.querySelector('.pasapalabra-card [data-answer]').getBoundingClientRect();
              return {inputBottom:input.bottom,buttonBottom:button.bottom,cardBottom:card.bottom,cardTop:card.top};
            });
            assert.ok(fit.inputBottom<fit.buttonBottom&&fit.buttonBottom<=fit.cardBottom+1,`${name} long rosco clue ${viewport.width}: ${JSON.stringify(fit)}`);
          }
          assert.deepEqual(errors,[],`${name} page errors at ${viewport.width}`);
          await page.close();
        }
      } finally { await browser.close(); }
    }
  } finally { await site.close(); }
});

test('the four other suite apps render and navigate in WebKit and Chromium', { timeout:90000 }, async () => {
  const site=await serve();
  const apps=[
    {id:'diplomator',ready:'showTab',nav:'[data-tab-btn="temas"]',selected:'#tab-temas'},
    {id:'cambridge',ready:'showTab',nav:'[data-tab-btn="temas"]',selected:'#tab-temas'},
    {id:'u25',ready:'openLibrary',nav:'#navModules',selected:'#moduleGrid'},
    {id:'ocr',ready:'showView',nav:'#navArchivos',selected:'#viewArchivos'},
  ];
  try{
    for(const [engine,name] of [[webkit,'WebKit'],[chromium,'Chromium']]){
      const browser=await engine.launch(name==='Chromium'?{headless:true,channel:'msedge'}:{headless:true});
      try{
        for(const viewport of [{width:320,height:640},{width:390,height:844},{width:768,height:1024},{width:1366,height:768}]){
          const page=await browser.newPage({viewport,hasTouch:true,isMobile:viewport.width<700});
          for(const app of apps){
            const errors=[];
            const onError=error=>errors.push(error.message);
            page.on('pageerror',onError);
            await page.goto(`${site.origin}/apps/${app.id}/index.html`);
            await page.waitForFunction(name=>typeof window[name]==='function',app.ready);
            assert.ok((await page.title()).length>4,`${name} ${app.id} title`);
            const before=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
            assert.ok(before<=2,`${name} ${app.id} ${viewport.width} horizontal overflow ${before}`);
            if(await page.locator(app.nav).isVisible())await page.locator(app.nav).tap();
            else if(app.id==='u25')await page.evaluate(()=>openLibrary());
            else if(app.id==='ocr')await page.evaluate(()=>showView('archivos'));
            else await page.evaluate(()=>showTab('temas',document.querySelector('[data-tab-btn="temas"]')));
            assert.equal(await page.locator(app.selected).isVisible(),true,`${name} ${app.id} ${viewport.width} navigation`);
            const after=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
            const overflowElements=after>2?await page.evaluate(()=>[...document.querySelectorAll('body *')].map(el=>({tag:el.tagName,cls:String(el.className).slice(0,80),id:el.id,right:Math.round(el.getBoundingClientRect().right),width:Math.round(el.getBoundingClientRect().width)})).filter(el=>el.right>innerWidth+2).sort((a,b)=>b.right-a.right).slice(0,8)):[];
            assert.ok(after<=2,`${name} ${app.id} ${viewport.width} navigated overflow ${after}: ${JSON.stringify(overflowElements)}`);
            assert.deepEqual(errors,[],`${name} ${app.id} ${viewport.width} page errors`);
            page.off('pageerror',onError);
          }
          await page.close();
        }
      }finally{await browser.close();}
    }
  }finally{await site.close();}
});
