const {chromium}=require('./browser-runtime.cjs');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const scenes=[
 ['cocina-fracciones','public-fraction-recipe-board-v2.webp','table'],
 ['observatorio-decimales','public-decimal-tanks-board-v2.webp','table'],
 ['taller-circuitos','public-circuit-workbench-board-v2.webp','intruder']
];

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
   for(const [slug,art,type] of scenes){
    const data=await page.evaluate(slug=>{
     const game=publicAdvancedGames.find(entry=>entry.id.endsWith(':'+slug));
     if(!game)return null;
     const sample={...game,activity:{...game.activity,questions:[game.activity.questions[0]]}};
     runActivity(sample,'');
     return {answers:sample.activity.questions[0].options.map(row=>row.split('|').at(-1).trim()),correct:sample.activity.questions[0].answer};
    },slug);
    assert.ok(data,`${slug}: missing game`);
    assert.ok(await page.evaluate(name=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(true);img.onerror=()=>resolve(false);img.src=`./assets/games/${name}`;}),art),`${slug}: missing artwork`);
    const question=page.locator('#dialog .play-question:not([hidden])');
    assert.equal(await question.getAttribute('data-public-scene'),slug);
    const board=question.locator(type==='table'?'.challenge-table-wrap':'.mini-intruder');
    assert.ok((await board.evaluate(element=>getComputedStyle(element).backgroundImage)).includes(art),`${slug}: artwork not integrated`);
    const metrics=await page.evaluate(()=>{
     const dialog=document.querySelector('#dialog'),content=dialog.querySelector('.play-content'),footer=dialog.querySelector('.play-footer');
     return {horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:content.scrollHeight-content.clientHeight,footerBottom:footer.getBoundingClientRect().bottom};
    });
    await page.screenshot({path:path.resolve(`tmp/pack-fifteen-${slug}-${width}.png`)});
    assert.ok(metrics.horizontal<=2,`${slug}: horizontal overflow ${width}px ${JSON.stringify(metrics)}`);
    assert.ok(metrics.overflow===0||metrics.overflow>18,`${slug}: tiny scroll ${width}px ${JSON.stringify(metrics)}`);
    assert.ok(metrics.footerBottom<=height+2,`${slug}: clipped footer ${width}px ${JSON.stringify(metrics)}`);
    if(type==='table'){
     assert.equal(await board.locator('tbody tr').count(),slug==='cocina-fracciones'?3:4);
     for(let i=0;i<data.answers.length;i++)await board.locator(`[data-challenge-answer="${i}"]`).fill(i===0&&width===1366?'incorrecta':data.answers[i]);
     await question.locator('[data-challenge-check]').click();
     if(width===1366){
      assert.equal(await board.locator('td.is-incorrect').count(),1,`${slug}: wrong value not marked`);
      await board.locator('[data-challenge-answer="0"]').fill(data.answers[0]);
      await question.locator('[data-challenge-check]').click();
     }
     assert.equal(await board.locator('td.is-correct').count(),data.answers.length,`${slug}: correct cells not marked`);
    }else{
     await board.locator('[data-intruder]').filter({hasText:'Pila'}).click();
     await board.locator('[data-mini-check]').click();
     assert.ok(await board.locator('.intruder-cards .answer-wrong').count()>0,`${slug}: wrong selection not marked`);
     await board.locator('[data-intruder]').filter({hasText:data.correct}).click();
     await board.locator('[data-mini-check]').click();
     assert.ok(await board.locator('.intruder-cards .answer-right').count()>0,`${slug}: correct selection not marked`);
    }
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`Page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS pack 15 illustrated boards, correction and responsive controls');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
