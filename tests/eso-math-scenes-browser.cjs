const {chromium}=require('./browser-runtime.cjs');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const missions=['mat-numeros','mat-proporciones','mat-finanzas','mat-problemas'];

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(path.resolve('apps/e25/index.html')).href+'?demo=1');
   await page.waitForFunction(()=>typeof startGame==='function'&&typeof EsoMathMissions==='object');
   for(const id of missions){
    await page.evaluate(id=>startGame(id,'quest'),id);
    const board=page.locator(`.eso-math-illustrated[data-mission="${id}"] .eso-math-board`);
    assert.equal(await board.count(),1,`${id}: board`);
    const art=board.locator('.eso-math-backdrop');
    assert.ok(await art.evaluate(img=>img.complete&&img.naturalWidth>0),`${id}: art loaded`);
    assert.equal(await board.locator('.eso-math-options button').count(),3,`${id}: choices`);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${id}: horizontal overflow at ${width}`);
    const boxes=await board.evaluate(element=>{
     const board=element.getBoundingClientRect();
     const buttons=[...element.querySelectorAll('.eso-math-options button')].map(button=>button.getBoundingClientRect());
     return {board:{left:board.left,right:board.right},buttons:buttons.map(item=>({left:item.left,right:item.right,width:item.width}))};
    });
    assert.ok(boxes.buttons.every(item=>item.left>=boxes.board.left-2&&item.right<=boxes.board.right+2&&item.width>=65),`${id}: answers outside board ${width}`);
    await page.screenshot({path:path.resolve(`tmp/eso-math-scene-${id}-${width}.png`)});
    const correct=await page.evaluate(id=>EsoMathMissions[id].stages[0].correct,id);
    const wrong=(correct+1)%3;
    await board.locator('.eso-math-options button').nth(wrong).click();
    await page.locator('[data-eso-dock]').click();
    assert.equal(await board.locator('.eso-math-options button.wrong:disabled').count(),1,`${id}: wrong state`);
    if(width===1366){
     await board.locator('.eso-math-options button').nth(correct).dragTo(board.locator('[data-eso-dock]'));
    }else{
     await board.locator('.eso-math-options button').nth(correct).focus();
     await page.keyboard.press('Enter');
     await page.keyboard.press('Enter');
    }
    assert.equal(await board.getAttribute('data-solved'),'true',`${id}: solved state`);
    assert.match(await page.locator('.eso-math-feedback-row').innerText(),/Correcto/);
    await page.getByRole('button',{name:/Siguiente etapa/}).click();
    assert.equal(await board.getAttribute('data-stage'),'2',`${id}: next stage`);
   }
   assert.deepEqual(errors,[],`page errors ${width}`);
   await page.close();
  }
  console.log('PASS four illustrated ESO math missions on desktop, tablet and mobile');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
