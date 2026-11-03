const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const scenes=[
 ['fabrica-palabras','public-word-factory-cards-v2.webp'],
 ['mochila-bilingue','public-bilingual-backpack-cards-v2.webp'],
 ['portal-pasado','public-past-portal-cards-v2.webp'],
 ['plaza-saludos','public-greetings-plaza-cards-v2.webp']
];

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
   await page.evaluate(()=>{Math.random=()=>0.5});
   for(const [slug,art] of scenes){
    const found=await page.evaluate(slug=>{
     const game=publicAdvancedGames.find(entry=>entry.id.endsWith(':'+slug));
     if(!game)return false;
     runActivity(game,'');
     return true;
    },slug);
    assert.ok(found,`${slug}: missing game`);
    assert.ok(await page.evaluate(name=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(true);img.onerror=()=>resolve(false);img.src=`./assets/games/${name}`;}),art),`${slug}: missing artwork`);
    const stage=page.locator('#dialog .play-question:not([hidden]) .memory-stage');
    const board=stage.locator('.memory-board');
    assert.equal(await board.locator('.memory-card').count(),12,`${slug}: expected twelve cards`);
    const background=await board.evaluate(element=>getComputedStyle(element).backgroundImage);
    assert.ok(background.includes(art),`${slug}: artwork not integrated in cards board (${background})`);
    const metrics=await page.evaluate(()=>{
     const dialog=document.querySelector('#dialog'),content=dialog.querySelector('.play-content'),board=dialog.querySelector('.memory-board'),footer=dialog.querySelector('.play-footer');
     return {horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:content.scrollHeight-content.clientHeight,boardWidth:board.getBoundingClientRect().width,boardHeight:board.getBoundingClientRect().height,footerBottom:footer.getBoundingClientRect().bottom};
    });
    assert.ok(metrics.horizontal<=2,`${slug}: horizontal overflow ${width}px ${JSON.stringify(metrics)}`);
    if(width>700)assert.equal(metrics.overflow,0,`${slug}: desktop scroll ${width}px ${JSON.stringify(metrics)}`);
    else assert.ok(metrics.overflow===0||metrics.overflow>18,`${slug}: tiny scroll ${width}px ${JSON.stringify(metrics)}`);
    assert.ok(metrics.footerBottom<=height+2,`${slug}: footer clipped ${width}px ${JSON.stringify(metrics)}`);
    await page.screenshot({path:path.resolve(`tmp/pack-twelve-${slug}-${width}.png`)});
    if(width===1366&&slug==='fabrica-palabras'){
     await board.locator('[data-card="0"]').click();
     await board.locator('[data-card="2"]').click();
     assert.equal(await board.locator('.memory-card.answer-wrong').count(),2,'wrong pair not marked');
     await page.waitForTimeout(1050);
     assert.equal(await board.locator('.memory-card.answer-wrong').count(),0,'wrong pair did not close');
    }
    await board.locator('[data-card="0"]').click();
    assert.ok((await board.locator('[data-card="0"]').getAttribute('aria-label'))!=='Tarjeta 1',`${slug}: card did not reveal`);
    await board.locator('[data-card="1"]').click();
    assert.equal(await board.locator('.memory-card.matched').count(),2,`${slug}: pair not matched`);
    for(let n=2;n<12;n+=2){await board.locator(`[data-card="${n}"]`).click();await board.locator(`[data-card="${n+1}"]`).click();}
    assert.equal(await stage.locator('.memory-progress').getAttribute('value'),'6',`${slug}: progress incomplete`);
    assert.equal(await page.locator('#r-0').inputValue(),'Completado',`${slug}: answer not complete`);
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`Page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS pack 12 artwork, six matching pairs, progress and layout at 1366, 1024 and 390px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
