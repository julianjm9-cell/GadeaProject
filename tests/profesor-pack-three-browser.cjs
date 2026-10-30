const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const matching=[
 ['atlas-registros','public-atlas-channels-v2.webp'],
 ['hemeroteca-fuentes','public-hemeroteca-vitrines-v2.webp']
];
const races=[
 ['mercado-monedas','public-mercado-counter-v2.webp'],
 ['observatorio-numeros','public-observatorio-astrolabe-v2.webp']
];

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
   for(const [slug,art] of [...matching,...races]){
    const options=await page.evaluate(slug=>{
     const game=publicAdvancedGames.find(entry=>entry.id.endsWith(':'+slug));
     if(!game)return null;
     runActivity(game,'');
     return game.activity.questions[0].options.map(option=>option.split('|').map(part=>part.trim()));
    },slug);
    assert.ok(options,`${slug}: game not found`);
    const artwork=await page.evaluate(name=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(true);img.onerror=()=>resolve(false);img.src=`./assets/games/${name}`;}),art);
    assert.ok(artwork,`${slug}: artwork not loaded`);
    const isRace=races.some(([id])=>id===slug),board=page.locator(isRace?'#dialog .challenge-race.race-scene':'#dialog .matching-studio.match-pack-three');
    assert.equal(await board.count(),1,`${slug}: board not mounted`);
    const scene=page.locator(isRace?'#dialog .race-scene-workspace':'#dialog .match-scene-targets');
    const artStyle=await scene.evaluate(el=>getComputedStyle(el).backgroundImage+' '+getComputedStyle(el,'::before').backgroundImage);
    assert.ok(artStyle.includes(art),`${slug}: artwork not integrated`);
    const metrics=await page.evaluate(()=>{const dialog=document.querySelector('#dialog'),content=dialog.querySelector('.play-content'),footer=dialog.querySelector('.play-footer');return {horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:content.scrollHeight-content.clientHeight,footerBottom:footer.getBoundingClientRect().bottom};});
    assert.ok(metrics.horizontal<=2,`${slug}: horizontal overflow at ${width}px ${JSON.stringify(metrics)}`);
    assert.ok(metrics.overflow===0||metrics.overflow>18,`${slug}: tiny scroll at ${width}px ${JSON.stringify(metrics)}`);
    assert.ok(metrics.footerBottom<=height+2,`${slug}: clipped footer at ${width}px ${JSON.stringify(metrics)}`);
    await page.screenshot({path:path.resolve(`tmp/pack-three-${slug}-${width}.png`)});
    if(isRace){
     const first=options[0],wrong=first[2];
     await board.locator('.race-answers button').filter({hasText:wrong}).click();
     await board.locator('[data-challenge-check]').click();
     assert.ok(await board.locator('.challenge-stage-feedback.is-incorrect').count(),`${slug}: wrong answer not marked`);
     for(let i=0;i<options.length;i++){
      await board.locator('.race-answers button').filter({hasText:options[i][1]}).click();
      await board.locator('[data-challenge-check]').click();
      assert.ok(await board.locator('.challenge-stage-feedback.is-correct').count(),`${slug}: stage ${i+1} not correct`);
      if(i<options.length-1)await board.locator('[data-challenge-next]').click();
     }
     assert.equal(await board.locator('.challenge-celebration').count(),1,`${slug}: game not completed`);
    }else{
     const [firstItem,firstTarget]=options[0],wrongTarget=options.find(([,target])=>target!==firstTarget)?.[1];
     await board.locator('.match-bank .match-piece').filter({hasText:firstItem}).click();
     await board.locator(`.match-bucket[data-match-target="${wrongTarget}"] > button`).click();
     await board.locator('[data-board-check]').click();
     assert.ok(await board.locator('.match-bucket.has-error').count(),`${slug}: wrong placement not marked`);
     await board.locator('[data-match-reset]').click();
     for(const [item,target] of options){
      await board.locator('.match-bank .match-piece').filter({hasText:item}).click();
      await board.locator(`.match-bucket[data-match-target="${target}"] > button`).click();
     }
     await board.locator('[data-board-check]').click();
     assert.equal(await board.locator('.match-scene-finish').count(),1,`${slug}: game not completed`);
    }
    if(width===1366)await page.screenshot({path:path.resolve(`tmp/pack-three-${slug}-complete.png`)});
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`Page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS pack 3 artwork, feedback and full rounds at 1366, 1024 and 390px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
