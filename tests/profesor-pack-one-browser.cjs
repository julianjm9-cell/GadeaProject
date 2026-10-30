const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const slugs=['tren-decenas','bosque-vivo','redaccion-titulares','central-mensajes'];
const imageNames=['public-tren-wagon-v2.png','public-bosque-fieldbook-v2.png','public-redaccion-trays-v2.png','public-central-dossier-v2.png'];

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
   for(const [n,slug] of slugs.entries()){
    const data=await page.evaluate(slug=>{
     const material=publicAdvancedGames.find(game=>game.id.endsWith(':'+slug));
     if(!material)return null;
     runActivity(material,'');
     const options=material.activity.questions[0].options.map(option=>option.split('|').map(s=>s.trim()));
     return {options,scene:document.querySelector('#dialog .play-question')?.dataset.publicScene};
    },slug);
    assert.ok(data,`Missing ${slug}`);
    assert.equal(data.scene,slug);
    const board=page.locator('#dialog .matching-studio.match-pack-one');
    assert.equal(await board.count(),1,`${slug}: no illustrated board`);
    const image=page.locator(`#dialog [data-public-scene="${slug}"] .match-bucket`).first();
    const background=await image.evaluate(element=>getComputedStyle(element).backgroundImage);
    const sceneBackground=await page.locator('#dialog .match-scene-targets').evaluate(element=>getComputedStyle(element).backgroundImage);
    const beforeBackground=await page.locator('#dialog .match-scene-targets').evaluate(element=>getComputedStyle(element,'::before').backgroundImage);
    assert.ok((background+sceneBackground+beforeBackground).includes(imageNames[n]),`${slug}: missing board art`);
    const imageLoaded=await page.evaluate(name=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=`./assets/games/${name}`;}),imageNames[n]);
    assert.ok(imageLoaded,`${slug}: art cannot load`);
    const metrics=await page.evaluate(()=>{const dialog=document.querySelector('#dialog'),content=dialog.querySelector('.play-content'),footer=dialog.querySelector('.play-footer');return {horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:content.scrollHeight-content.clientHeight,footerBottom:footer.getBoundingClientRect().bottom};});
    assert.ok(metrics.horizontal<=2,`${slug} ${width}px horizontal overflow ${JSON.stringify(metrics)}`);
    assert.ok(metrics.overflow===0||metrics.overflow>18,`${slug} ${width}px tiny scroll ${JSON.stringify(metrics)}`);
    assert.ok(metrics.footerBottom<=height+2,`${slug} ${width}px footer clipped ${JSON.stringify(metrics)}`);
    if(width!==1024)await page.screenshot({path:path.resolve(`tmp/pack-one-${slug}-${width}.png`)});
    const [firstItem,firstTarget]=data.options[0];
    const wrongTarget=data.options.find(([,target])=>target!==firstTarget)?.[1];
    if(wrongTarget){
     await board.locator('.match-bank .match-piece').filter({hasText:firstItem}).click();
     await board.locator(`.match-bucket[data-match-target="${wrongTarget}"] > button`).click();
     await board.locator('[data-board-check]').click();
     assert.ok(await board.locator('.match-bucket.has-error').count()>0,`${slug}: incorrect placement not shown`);
     await board.locator('[data-match-reset]').click();
    }
    for(const [item,target] of data.options){
     const piece=board.locator('.match-bank .match-piece').filter({hasText:item});
     assert.equal(await piece.count(),1,`${slug}: missing piece ${item}`);
     await piece.click();
     await board.locator(`.match-bucket[data-match-target="${target}"] > button`).click({timeout:3000});
    }
    await board.locator('[data-board-check]').click();
    assert.equal(await board.locator('.match-scene-finish').count(),1,`${slug}: correct solution not accepted`);
    if(width!==1024)await page.screenshot({path:path.resolve(`tmp/pack-one-${slug}-complete-${width}.png`)});
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`Page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS pack 1 illustrated scenes and complete answers on desktop and mobile');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
