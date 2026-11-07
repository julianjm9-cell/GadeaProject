const {chromium}=require('./browser-runtime.cjs');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const scenes=[
 ['laboratorio-mezclas','public-laboratorio-mixtures-board-v2.webp'],
 ['feria-porcentajes','public-feria-booth-board-v2.webp'],
 ['ruta-bajo-cero','public-ruta-cablecar-board-v2.webp']
];

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
   for(const [slug,art] of scenes){
    const options=await page.evaluate(slug=>{
     const game=publicAdvancedGames.find(entry=>entry.id.endsWith(':'+slug));
     if(!game)return null;
     runActivity(game,'');
     return game.activity.questions[0].options.map(option=>option.split('|').map(part=>part.trim()));
    },slug);
    assert.ok(options,`${slug}: game not found`);
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
    await page.screenshot({path:path.resolve(`tmp/pack-four-${slug}-${width}.png`)});
    const wrong=options[0][2];
    await board.locator('.race-answers button span').getByText(wrong,{exact:true}).click();
    await board.locator('[data-challenge-check]').click();
    assert.equal(await board.locator('.challenge-stage-feedback.is-incorrect').count(),1,`${slug}: wrong answer not marked`);
    for(let i=0;i<options.length;i++){
     await board.locator('.race-answers button span').getByText(options[i][1],{exact:true}).click();
     await board.locator('[data-challenge-check]').click();
     assert.equal(await board.locator('.challenge-stage-feedback.is-correct').count(),1,`${slug}: stage ${i+1} not correct`);
     if(i<options.length-1)await board.locator('[data-challenge-next]').click();
    }
    assert.equal(await board.locator('.challenge-celebration').count(),1,`${slug}: game not completed`);
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`Page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS pack 4 artwork, corrections and full rounds at 1366, 1024 and 390px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
