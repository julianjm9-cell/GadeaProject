const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('./browser-runtime.cjs');
const {fixture,root}=require('./cambridge-studio-fixture.cjs');
fs.mkdirSync(path.join(root,'tmp/english-missions'),{recursive:true});

async function ready(page){await page.goto('http://studio.test/cambridge');await page.waitForFunction(()=>cambridgeStateETag!==null&&window.EnglishMissionBoards);}
async function place(page,index,{keyboard=false,drag=false}={}){
 const piece=page.locator('[data-mission-choice="'+index+'"]'),slot=page.locator('[data-mission-place]').first();
 if(drag){await piece.dragTo(slot);return;}
 if(keyboard){await piece.focus();await page.keyboard.press('Enter');await slot.focus();await page.keyboard.press('Enter');return;}
 await piece.click();await slot.click();
}
async function checkLayout(page,id,width){
 const result=await page.evaluate(()=>({page:document.documentElement.scrollWidth-document.documentElement.clientWidth,board:document.querySelector('.mission-board')?.scrollWidth-document.querySelector('.mission-board')?.clientWidth}));
 assert.ok(result.page<=2&&result.board<=2,id+' '+width+': '+JSON.stringify(result));
 assert.equal(await page.locator('#b2GameList').isVisible(),false);
}

for(const [name,engine,launch] of [['Chromium',chromium,{headless:true,channel:'msedge'}],['WebKit',webkit,{headless:true}]]){
 test(name+': every mission is played through its objects, remembers checked stages and completes only once',{timeout:180000},async()=>{
  const browser=await engine.launch(launch);
  try{
   const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));await fixture(page);await ready(page);
   for(const level of ['B2 First','C1 Advanced','C2 Proficiency']){
    await page.locator('#headerExamLevel').selectOption(level);
    const games=await page.evaluate(()=>englishRouteGames().map(game=>({id:game.id,stages:game.stages.map(stage=>({correct:stage.correct,answer:stage.answers?.[0],count:stage.options?.length}))})));
    for(const game of games){
     await page.evaluate(id=>openB2Game(id),game.id);await page.locator('.mission-board').waitFor();await checkLayout(page,game.id,1440);
     assert.equal(await page.evaluate(()=>{const before=activeB2Stage;nextB2GameStage();return activeB2Stage===before;}),true,'cannot skip a decision');
     await page.evaluate(()=>renderB2GameStage());
     if(name==='Chromium')await page.locator('#b2GameBoard').screenshot({path:path.join(root,'tmp/english-missions/'+game.id+'.png'),style:'body>header,.global-teacher{visibility:hidden!important}'});
     for(let i=0;i<game.stages.length;i++){
      const stage=game.stages[i];
      if(i===0){
       if(stage.count)await place(page,(stage.correct+1)%stage.count);else{await page.locator('#b2TypedAnswer').fill('not the answer');await page.locator('[data-mission-submit]').click();}
       assert.match(await page.locator('#b2GameFeedback').textContent(),/Todavía no/);
       assert.equal(await page.evaluate(id=>state.b2GameRuns[id].mistakes,game.id),1);
       if(stage.count){await page.locator('[data-mission-place]').first().dispatchEvent('click');assert.equal(await page.evaluate(id=>state.b2GameRuns[id].mistakes,game.id),1,'repeated placement without choosing again is not another attempt');}
      }
      if(stage.count)await place(page,stage.correct,{keyboard:i===1,drag:name==='Chromium'&&game.id==='editor'&&i===0});
      else{await page.locator('#b2TypedAnswer').fill(game.id==='machine'&&i===1?'don’t have to bring':stage.answer);await page.locator('#b2TypedAnswer').press('Enter');}
      assert.equal(await page.locator('.mission-board').getAttribute('data-status'),'solved');
      assert.match(await page.locator('#b2GameFeedback').textContent(),/Correcto/);
      assert.equal(await page.evaluate(()=>answerB2Game(0)),false,'a checked stage cannot be charged twice');
      if(game.id==='opencloze'&&i===0){
       await page.evaluate(()=>cambridgeSaveQueue);await page.reload();await page.waitForFunction(()=>cambridgeStateETag!==null);await page.evaluate(id=>openB2Game(id),game.id);
       assert.equal(await page.locator('.mission-board').getAttribute('data-status'),'solved','checked bridge step survives reload');
      }
      await page.locator('#b2GameNext button').click();
     }
     assert.equal(await page.locator('.mission-finale').count(),1);
     assert.deepEqual(await page.evaluate(id=>({plays:state.b2Games[id].plays,mistakes:state.b2Games[id].mistakes,finished:state.b2Games[id].completed}),game.id),{plays:1,mistakes:1,finished:true});
     await page.evaluate(()=>nextB2GameStage());assert.equal(await page.evaluate(id=>state.b2Games[id].plays,game.id),1);
     await page.getByRole('button',{name:'Ver todos los juegos',exact:true}).click();assert.equal(await page.locator('#b2GameList').isVisible(),true);
    }
   }
   assert.deepEqual(errors,[]);
  }finally{await browser.close();}
 });
 test(name+': every mission works on a phone with touch, keyboard alternatives and no clipped controls',{timeout:120000},async()=>{
  const browser=await engine.launch(launch);
  try{
   for(const width of [320,390]){
    const page=await browser.newPage({viewport:{width,height:844},hasTouch:true,reducedMotion:'reduce'});await fixture(page);await ready(page);
    for(const level of ['B2 First','C1 Advanced','C2 Proficiency']){
     await page.locator('#headerExamLevel').selectOption(level);
     const games=await page.evaluate(()=>englishRouteGames().map(game=>({id:game.id,correct:game.stages[0].correct,answer:game.stages[0].answers?.[0]})));
     for(const game of games){
      await page.evaluate(id=>openB2Game(id),game.id);await checkLayout(page,game.id,width);
      if(game.answer){await page.locator('#b2TypedAnswer').fill(game.answer);await page.locator('[data-mission-submit]').tap();}
      else{await page.locator('[data-mission-choice="'+game.correct+'"]').tap();await page.locator('[data-mission-place]').first().tap();}
      assert.equal(await page.locator('.mission-board').getAttribute('data-status'),'solved');
      if(name==='Chromium'&&width===390)await page.locator('#b2GameBoard').screenshot({path:path.join(root,'tmp/english-missions/'+game.id+'-phone.png'),style:'body>header,.global-teacher{visibility:hidden!important}'});
      await page.locator('[data-mission-exit]').tap();assert.equal(await page.evaluate(id=>state.b2GameRuns[id].solvedStage,game.id),0,'leaving keeps the checked stage');
     }
    }
    await page.close();
   }
  }finally{await browser.close();}
 });
}

test('a checked historic stage can still continue when the scene module fails to load',async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();await fixture(page);
  await page.route('**/assets/cambridge-studio/games.js*',route=>route.abort());
  await page.goto('http://studio.test/cambridge');await page.waitForFunction(()=>cambridgeStateETag!==null);
  await page.evaluate(()=>{setExamLevel('B2 First');state.b2GameRuns.editor={stage:0,solvedStage:0,mistakes:0,errors:[]};openB2Game('editor');});
  assert.equal(await page.locator('#b2GameNext button').isVisible(),true,JSON.stringify(await page.evaluate(()=>({game:activeB2Game,stage:activeB2Stage,run:state.b2GameRuns.editor,tab:document.getElementById('tab-juegos').className,button:document.querySelector('#b2GameNext')?.outerHTML}))));
  await page.locator('#b2GameNext button').click();
  assert.equal(await page.evaluate(()=>state.b2GameRuns.editor.stage),1);
  assert.equal(await page.evaluate(()=>nextB2GameStage()),false);
 }finally{await browser.close();}
});
