const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const scenes=[
 ['safari-parque','safari','public-safari-sentence-board-v2.webp'],
 ['ciudad-direcciones','ciudad-direcciones','public-city-directions-board-v2.webp'],
 ['estacion-tiempos','estacion-tiempos','public-tenses-station-board-v2.webp'],
 ['jardin-mariposa','jardin-mariposa','public-butterfly-garden-board-v2.webp'],
 ['invernadero-cientifico','invernadero-cientifico','public-greenhouse-notebook-board-v2.webp'],
 ['ciudad-direcciones-largo','ciudad-direcciones','public-city-directions-board-v2.webp',3]
];

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
   for(const [slug,scene,art,questionIndex=0] of scenes){
    const answer=await page.evaluate(({slug,questionIndex})=>{
     const game=publicAdvancedGames.find(entry=>entry.id.endsWith(':'+slug.replace(/-largo$/,'')));
     if(!game)return null;
     const sample={...game,activity:{...game.activity,questions:[game.activity.questions[questionIndex]]}};
     runActivity(sample,'');
     return sample.activity.questions[0].answer.split(' → ');
    },{slug,questionIndex});
    assert.ok(answer?.length>=4,`${slug}: no answer sequence`);
    assert.ok(await page.evaluate(name=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(true);img.onerror=()=>resolve(false);img.src=`./assets/games/${name}`;}),art),`${slug}: missing artwork`);
    const question=page.locator('#dialog .play-question:not([hidden])');
    assert.equal(await question.getAttribute('data-public-scene'),scene,`${slug}: wrong scene`);
    const board=question.locator('.sentence-board'),answerPanel=board.locator('.sentence-answer');
    assert.equal(await answerPanel.locator('.sentence-slot').count(),answer.length,`${slug}: wrong slot count`);
    const answerBackground=await answerPanel.evaluate(element=>getComputedStyle(element).backgroundImage);
    assert.ok(answerBackground.includes(art),`${slug}: artwork not in answer panel (${answerBackground})`);
    const metrics=await page.evaluate(()=>{
     const dialog=document.querySelector('#dialog'),content=dialog.querySelector('.play-content'),panel=dialog.querySelector('.play-question:not([hidden]) .sentence-answer'),footer=dialog.querySelector('.play-footer');
     return {horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:content.scrollHeight-content.clientHeight,panelWidth:panel.getBoundingClientRect().width,panelHeight:panel.getBoundingClientRect().height,footerBottom:footer.getBoundingClientRect().bottom};
    });
    await page.screenshot({path:path.resolve(`tmp/pack-thirteen-${slug}-${width}.png`)});
    assert.ok(metrics.horizontal<=2,`${slug}: horizontal overflow ${width}px ${JSON.stringify(metrics)}`);
    if(width>700)assert.equal(metrics.overflow,0,`${slug}: desktop scroll ${width}px ${JSON.stringify(metrics)}`);
    else assert.ok(metrics.overflow===0||metrics.overflow>18,`${slug}: tiny mobile scroll ${width}px ${JSON.stringify(metrics)}`);
    assert.ok(metrics.footerBottom<=height+2,`${slug}: footer clipped ${width}px ${JSON.stringify(metrics)}`);
    if(width===1366&&['safari-parque','invernadero-cientifico'].includes(slug)){
     for(const piece of [...answer].reverse())await board.getByRole('button',{name:`Añadir ${piece}`,exact:true}).click();
     await board.locator('[data-confirm-order]').click();
     assert.ok(await board.locator('.sentence-slot.answer-wrong').count()>0,'incorrect sequence not marked');
     await page.screenshot({path:path.resolve('tmp/pack-thirteen-safari-wrong-1366.png')});
     await board.locator('[data-sentence-reset]').click({timeout:3000});
    }
    for(const piece of answer)await board.getByRole('button',{name:`Añadir ${piece}`,exact:true}).click();
    assert.equal(await board.locator('.sentence-slot.filled').count(),answer.length,`${slug}: pieces did not fill slots`);
    await board.locator('[data-confirm-order]').click();
    assert.equal(await board.locator('.sentence-slot.answer-right').count(),answer.length,`${slug}: correct sequence not marked`);
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`Page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS pack 13 board images, ordered answers and layout at 1366, 1024 and 390px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
