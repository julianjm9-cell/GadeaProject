const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const scenes=[
 ['puente-subjuntivo','public-subjunctive-bridge-tablets-v2.webp'],
 ['tribunal-ambiguedad','public-interpretation-editor-slips-v2.webp']
];

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
   for(const [slug,art] of scenes){
    const rows=await page.evaluate(slug=>{
     const game=publicAdvancedGames.find(entry=>entry.id.endsWith(':'+slug));
     if(!game)return null;
     runActivity(game,'');
     return game.activity.questions[0].options.map(row=>row.split('|').map(part=>part.trim()));
    },slug);
    assert.equal(rows?.length,6,`${slug}: missing six options`);
    const imageLoaded=await page.evaluate(name=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=`./assets/games/${name}`;}),art);
    assert.ok(imageLoaded,`${slug}: artwork missing`);
    const game=page.locator('#dialog .play-question:not([hidden]) .challenge-multiselect');
    assert.equal(await game.count(),1,`${slug}: game not mounted`);
    assert.equal(await game.locator('.challenge-choice').count(),6,`${slug}: choice count`);
    const boardImage=await game.locator('.challenge-choices').evaluate(element=>getComputedStyle(element).backgroundImage);
    assert.ok(boardImage.includes(art),`${slug}: image not integrated in answer board (${boardImage})`);
    const metrics=await page.evaluate(()=>{const dialog=document.querySelector('#dialog'),content=dialog.querySelector('.play-content'),board=dialog.querySelector('.challenge-choices'),footer=dialog.querySelector('.play-footer');return {horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:content.scrollHeight-content.clientHeight,boardWidth:board.getBoundingClientRect().width,footerBottom:footer.getBoundingClientRect().bottom};});
    assert.ok(metrics.horizontal<=2,`${slug}: horizontal overflow at ${width}px ${JSON.stringify(metrics)}`);
    if(width>700)assert.equal(metrics.overflow,0,`${slug}: desktop scroll at ${width}px ${JSON.stringify(metrics)}`);
    else assert.ok(metrics.overflow===0||metrics.overflow>18,`${slug}: tiny scroll at ${width}px ${JSON.stringify(metrics)}`);
    assert.ok(metrics.footerBottom<=height+2,`${slug}: footer clipped at ${width}px`);
    await page.screenshot({path:path.resolve(`tmp/pack-eleven-${slug}-${width}.png`)});
    const [wrong]=rows.find(([,correct])=>correct.toLowerCase()==='no');
    await game.getByText(wrong,{exact:true}).click();
    await game.locator('[data-challenge-check]').click();
    assert.ok(await game.locator('.challenge-choice.is-incorrect').count()>0,`${slug}: wrong choice not marked`);
    await game.getByText(wrong,{exact:true}).click();
    for(const [label,correct] of rows){if(correct.toLowerCase()==='sí')await game.getByText(label,{exact:true}).click();}
    await game.locator('[data-challenge-check]').click();
    assert.equal(await game.locator('.challenge-choice.is-correct').count(),6,`${slug}: correct choices not marked`);
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`Page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS pack 11 artwork, multiselect correction and layout at 1366, 1024 and 390px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
