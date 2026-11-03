const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const scenes=[
 ['sentidos','sentidos','public-senses-explorer-board-v2.webp'],
 ['detectives-signos','signos','public-punctuation-detective-board-v2.webp'],
 ['biblioteca-secreta','biblioteca-secreta','public-secret-library-board-v2.webp'],
 ['agencia-oraciones','agencia-oraciones','public-grammar-agency-board-v2.webp']
];

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
   for(const [slug,scene,art] of scenes){
    const answer=await page.evaluate(slug=>{
     const game=publicAdvancedGames.find(entry=>entry.id.endsWith(':'+slug));
     if(!game)return null;
     const sample={...game,activity:{...game.activity,questions:[game.activity.questions[0]]}};
     runActivity(sample,'');
     return sample.activity.questions[0].answer;
    },slug);
    assert.ok(answer,`${slug}: missing game`);
    assert.ok(await page.evaluate(name=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(true);img.onerror=()=>resolve(false);img.src=`./assets/games/${name}`;}),art),`${slug}: missing art`);
    const question=page.locator('#dialog .play-question:not([hidden])');
    assert.equal(await question.getAttribute('data-public-scene'),scene);
    const board=question.locator(scene==='sentidos'?'.mystery-workbench':scene==='signos'?'.error-studio':'.challenge-cipher');
    const background=await board.evaluate(element=>getComputedStyle(element).backgroundImage);
    assert.ok(background.includes(art),`${slug}: art not on board (${background})`);
    const metrics=await page.evaluate(()=>{
     const dialog=document.querySelector('#dialog'),content=dialog.querySelector('.play-content'),footer=dialog.querySelector('.play-footer');
     return {horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:content.scrollHeight-content.clientHeight,footerBottom:footer.getBoundingClientRect().bottom};
    });
    await page.screenshot({path:path.resolve(`tmp/pack-fourteen-${slug}-${width}.png`)});
    assert.ok(metrics.horizontal<=2,`${slug}: horizontal overflow ${width}px ${JSON.stringify(metrics)}`);
    assert.ok(metrics.overflow===0||metrics.overflow>18,`${slug}: tiny scroll ${width}px ${JSON.stringify(metrics)}`);
    assert.ok(metrics.footerBottom<=height+2,`${slug}: clipped footer ${width}px ${JSON.stringify(metrics)}`);
    if(scene==='sentidos'){
     if(width===1366){
      await question.locator('[data-mystery-answer]').fill('otra cosa');
      await question.locator('[data-mini-check]').click();
      assert.ok((await question.locator('[data-mystery-answer]').getAttribute('class')).includes('answer-wrong'),`${slug}: wrong answer not red`);
     }
     await question.locator('[data-mystery-answer]').fill(answer);
     await question.locator('[data-mini-check]').click();
     assert.ok((await question.locator('[data-mystery-answer]').getAttribute('class')).includes('answer-right'),`${slug}: correct answer not green`);
    }else if(scene==='signos'){
     await board.locator('[data-error-token="0"]').click();
     if(width===1366){
      await board.locator('[data-error-inline]').fill('Ayer');
      await board.locator('[data-board-check]').click();
      assert.ok((await board.locator('[data-error-inline]').getAttribute('class')).includes('answer-wrong'),`${slug}: wrong edit not red`);
     }
     await board.locator('[data-error-inline]').fill('Mañana');
     await board.locator('[data-board-check]').click();
     assert.ok((await board.locator('[data-error-inline]').getAttribute('class')).includes('answer-right'),`${slug}: correct edit not green`);
    }else{
     const first=await page.evaluate(slug=>publicAdvancedGames.find(entry=>entry.id.endsWith(':'+slug)).activity.questions[0].options[0].split('|')[1].trim(),slug);
     if(width===1366){
      await board.locator('[data-challenge-answer]').fill('respuesta equivocada');
      await board.locator('[data-challenge-check]').click();
      assert.equal(await board.locator('[data-challenge-answer]').getAttribute('aria-invalid'),'true',`${slug}: wrong clue not flagged`);
     }
     await board.locator('[data-challenge-answer]').fill(first);
     await board.locator('[data-challenge-check]').click();
     assert.equal(await board.locator('.cipher-message .revealed').count(),1,`${slug}: clue did not reveal a letter`);
    }
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`Page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS pack 14 scene artwork, correct answers and responsive controls');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
