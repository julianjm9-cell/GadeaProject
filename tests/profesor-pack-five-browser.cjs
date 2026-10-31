const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const scenes=[
 ['boveda-racionales','public-cocina-racionales-board-v2.webp'],
 ['mercado-porcentajes','public-mercado-checkout-board-v2.webp'],
 ['torre-radicales','public-torre-radicales-board-v2.webp'],
 ['pista-movimiento','public-pista-movimiento-board-v2.webp']
];

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
   for(const [slug,art] of scenes){
    const found=await page.evaluate(slug=>{
     const game=publicAdvancedGames.find(entry=>entry.id.endsWith(':'+slug));
     if(!game)return null;
     runActivity(game,'');
     return game.activity.questions[0].options.length;
    },slug);
    assert.equal(found,6,`${slug}: game not found or incomplete`);
    const imageLoaded=await page.evaluate(name=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=`./assets/games/${name}`;}),art);
    assert.ok(imageLoaded,`${slug}: image failed to load`);
    const board=page.locator('#dialog .challenge-race.race-scene');
    assert.equal(await board.count(),1,`${slug}: board not mounted`);
    const artwork=await board.locator('.race-scene-workspace').evaluate(element=>getComputedStyle(element,'::before').backgroundImage);
    assert.ok(artwork.includes(art),`${slug}: image not integrated in board`);
    const metrics=await page.evaluate(()=>{const dialog=document.querySelector('#dialog'),content=dialog.querySelector('.play-content'),footer=dialog.querySelector('.play-footer'),actions=dialog.querySelector('.challenge-stage-actions');return {horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:content.scrollHeight-content.clientHeight,footerBottom:footer.getBoundingClientRect().bottom,actionsBottom:actions.getBoundingClientRect().bottom,footerTop:footer.getBoundingClientRect().top};});
    assert.ok(metrics.horizontal<=2,`${slug}: horizontal overflow at ${width}px ${JSON.stringify(metrics)}`);
    assert.ok(metrics.overflow===0||metrics.overflow>18,`${slug}: tiny scroll at ${width}px ${JSON.stringify(metrics)}`);
    assert.ok(metrics.footerBottom<=height+2,`${slug}: footer clipped at ${width}px ${JSON.stringify(metrics)}`);
    if(width>=1024){
     assert.equal(metrics.overflow,0,`${slug}: desktop content scroll at ${width}px ${JSON.stringify(metrics)}`);
     assert.ok(metrics.actionsBottom<=metrics.footerTop,`${slug}: game controls hidden by footer at ${width}px ${JSON.stringify(metrics)}`);
    }
    await page.screenshot({path:path.resolve(`tmp/pack-five-${slug}-${width}.png`)});
    let wrongCount=0;
    for(let i=0;i<found;i++){
     let correct=false;
     for(const choice of [2,1,0]){
      await board.locator('.race-answers button').nth(choice).click();
      await board.locator('[data-challenge-check]').click();
      if(await board.locator('.challenge-stage-feedback.is-correct').count()){correct=true;break;}
      assert.equal(await board.locator('.challenge-stage-feedback.is-incorrect').count(),1,`${slug}: wrong answer not marked`);
      wrongCount++;
     }
     assert.ok(correct,`${slug}: stage ${i+1} not correct`);
     if(i<found-1)await board.locator('[data-challenge-next]').click();
    }
    assert.ok(wrongCount>0,`${slug}: no wrong answer exercised`);
    assert.equal(await board.locator('.challenge-celebration').count(),1,`${slug}: game not completed`);
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`Page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS pack 5 artwork, corrections and full rounds at 1366, 1024 and 390px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
