const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const games=[
 ['laboratorio-medidas','public-laboratorio-stations-v2.webp'],
 ['archivo-sintagmas','public-archivo-drawers-v2.webp'],
 ['ciudad-economica','public-ciudad-economica-scene.webp'],
 ['redaccion-compuesta','public-redaccion-diagrams-v2.webp']
];

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
   for(const [slug,art] of games){
    const options=await page.evaluate(slug=>{
     const material=publicAdvancedGames.find(game=>game.id.endsWith(':'+slug));
     if(!material)return null;
     runActivity(material,'');
     return material.activity.questions[0].options.map(option=>option.split('|').map(s=>s.trim()));
    },slug);
    assert.ok(options,`${slug}: missing game`);
    const board=page.locator('#dialog .matching-studio.match-pack-two');
    assert.equal(await board.count(),1,`${slug}: missing board`);
    const scene=page.locator('#dialog .match-scene-targets');
    const artStyle=await scene.evaluate(element=>getComputedStyle(element).backgroundImage+' '+getComputedStyle(element,'::before').backgroundImage);
    assert.ok(artStyle.includes(art),`${slug}: missing artwork`);
    const loaded=await page.evaluate(name=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=`./assets/games/${name}`;}),art);
    assert.ok(loaded,`${slug}: artwork cannot load`);
    const metrics=await page.evaluate(()=>{const dialog=document.querySelector('#dialog'),content=dialog.querySelector('.play-content'),footer=dialog.querySelector('.play-footer');return {horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:content.scrollHeight-content.clientHeight,footerBottom:footer.getBoundingClientRect().bottom};});
    assert.ok(metrics.horizontal<=2,`${slug} ${width}px horizontal overflow ${JSON.stringify(metrics)}`);
    assert.ok(metrics.overflow===0||metrics.overflow>18,`${slug} ${width}px tiny scroll ${JSON.stringify(metrics)}`);
    assert.ok(metrics.footerBottom<=height+2,`${slug} ${width}px footer clipped ${JSON.stringify(metrics)}`);
    if(width!==1024)await page.screenshot({path:path.resolve(`tmp/pack-two-${slug}-${width}.png`)});
    const [firstItem,firstTarget]=options[0],wrongTarget=options.find(([,target])=>target!==firstTarget)?.[1];
    if(wrongTarget){
     await board.locator('.match-bank .match-piece').filter({hasText:firstItem}).click();
     await board.locator(`.match-bucket[data-match-target="${wrongTarget}"] > button`).click();
     await board.locator('[data-board-check]').click();
     assert.ok(await board.locator('.match-bucket.has-error').count()>0,`${slug}: wrong answer not marked`);
     await board.locator('[data-match-reset]').click();
    }
    for(const [item,target] of options){
     const piece=board.locator('.match-bank .match-piece').filter({hasText:item});
     assert.equal(await piece.count(),1,`${slug}: missing ${item}`);
     await piece.click();
     await board.locator(`.match-bucket[data-match-target="${target}"] > button`).click();
    }
    await board.locator('[data-board-check]').click();
    assert.equal(await board.locator('.match-scene-finish').count(),1,`${slug}: correct game not completed`);
    if(width===1366)await page.screenshot({path:path.resolve(`tmp/pack-two-${slug}-complete.png`)});
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`Page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS pack 2 scenes, answer feedback and complete rounds at 1366, 1024 and 390px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
