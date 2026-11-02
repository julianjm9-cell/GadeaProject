const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const scenes=[
 ['museo-expositivo','public-expositivo-magazine-board-v2.webp'],
 ['mapa-migraciones','public-migraciones-map-board-v2.webp'],
 ['laboratorio-atomo','public-atomo-lab-board-v2.webp'],
 ['hospital-nutricion','public-nutricion-atlas-board-v2.webp'],
 ['asamblea-revoluciones','public-asamblea-cork-board-v2.webp'],
 ['archivo-contemporaneo','public-contemporaneo-archive-board-v2.webp'],
 ['sala-comentario','public-comentario-manuscript-board-v2.webp']
];

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
   for(const [slug,art] of scenes){
    const pairs=await page.evaluate(slug=>{
     const game=publicAdvancedGames.find(entry=>entry.id.endsWith(':'+slug));
     if(!game)return null;
     runActivity(game,'');
     return game.activity.questions[0].options.map(row=>row.split('|').map(part=>part.trim()));
    },slug);
    assert.equal(pairs?.length,9,`${slug}: missing game or concepts`);
    const imageLoaded=await page.evaluate(name=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=`./assets/games/${name}`;}),art);
    assert.ok(imageLoaded,`${slug}: artwork missing`);
    const game=page.locator('#dialog .mini-game.bingo-scene');
    assert.equal(await game.count(),1,`${slug}: bingo not mounted`);
    const boardImage=await game.locator('.bingo-cards').evaluate(element=>getComputedStyle(element).backgroundImage);
    assert.ok(boardImage.includes(art),`${slug}: image not integrated in board`);
    const metrics=await page.evaluate(()=>{const dialog=document.querySelector('#dialog'),content=dialog.querySelector('.play-content'),footer=dialog.querySelector('.play-footer');return {horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:content.scrollHeight-content.clientHeight,footerBottom:footer.getBoundingClientRect().bottom};});
    assert.ok(metrics.horizontal<=2,`${slug}: horizontal overflow at ${width}px ${JSON.stringify(metrics)}`);
    assert.ok(metrics.overflow===0||metrics.overflow>18,`${slug}: tiny scroll at ${width}px ${JSON.stringify(metrics)}`);
    assert.ok(metrics.footerBottom<=height+2,`${slug}: footer clipped at ${width}px`);
    await page.screenshot({path:path.resolve(`tmp/pack-eight-${slug}-${width}.png`)});
    const currentLabel=async()=>{
     const clue=(await game.locator('.bingo-definition').textContent()).trim();
     const pair=pairs.find(([,definition])=>definition===clue);
     assert.ok(pair,`${slug}: unknown clue ${clue}`);
     return pair[0];
    };
    const clickLabel=async label=>{
     const index=await game.locator('[data-bingo-card]').evaluateAll((nodes,text)=>nodes.findIndex(node=>node.querySelector('span')?.textContent?.trim()===text),label);
     assert.ok(index>=0,`${slug}: missing card ${label}`);
     await game.locator('[data-bingo-card]').nth(index).click();
    };
    const firstCorrect=await currentLabel();
    await clickLabel(pairs.find(([label])=>label!==firstCorrect)[0]);
    await game.locator('[data-mini-check]').click();
    assert.equal(await game.locator('.mini-feedback.incorrect').count(),1,`${slug}: wrong answer not marked`);
    for(let i=0;i<pairs.length;i++){
     await clickLabel(await currentLabel());
     await game.locator('[data-mini-check]').click();
     assert.equal(await game.locator('.mini-feedback.correct').count(),1,`${slug}: clue ${i+1} not correct`);
     if(i<pairs.length-1)await game.locator('[data-bingo-next]').click();
    }
    assert.equal(await game.locator('.bingo-cards button.is-found').count(),9,`${slug}: board not completed`);
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`Page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS pack 8 artwork, corrections and nine clues at 1366, 1024 and 390px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
