const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const material={id:'wordsearch-stage-check',title:'Biología',subject:'Biología',activity:{version:1,questions:[{
  type:'wordsearch',prompt:'Encuentra las palabras relacionadas con la Biología.',answer:'Completado',options:['ECOSISTEMA','ENERGIA','ATOMO','CELULA','GRAVEDAD']
}]}};

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    assert.equal(await page.evaluate(()=>advancedTypes.includes('wordsearch')&&!gameTypes.filter(type=>!advancedTypes.includes(type)).includes('wordsearch')),true,'word search appears in advanced exercises');
    const layout=()=>page.evaluate(()=>{
      const rect=selector=>document.querySelector(selector).getBoundingClientRect();
      const dialog=document.querySelector('#dialog'),content=document.querySelector('.play-content');
      return {horizontal:dialog.scrollWidth-dialog.clientWidth,contentOverflow:content.scrollHeight-content.clientHeight,board:rect('.wordsearch-board').toJSON(),grid:rect('.wordsearch-grid').toJSON(),sidebar:rect('.wordsearch-sidebar').toJSON(),footer:rect('.play-footer').toJSON()};
    });
    const open=async()=>{await page.evaluate(value=>runActivity(value,''),material);assert.equal(await page.locator('.wordsearch-grid button').count(),100);};
    await open();
    assert.equal(await page.locator('.wordsearch-list li').count(),5);
    assert.equal(await page.locator('.wordsearch-intro').innerText(),material.activity.questions[0].prompt);
    const asset=await page.locator('#dialog').evaluate(async element=>{const url=getComputedStyle(element).backgroundImage.match(/url\("?([^"\)]+)"?\)/)?.[1];if(!url)return false;const image=new Image();image.src=url;await image.decode();return image.naturalWidth>1000});
    assert.equal(asset,true,'wordsearch stage image loads');
    let dimensions=await layout();
    assert.ok(dimensions.horizontal<=2&&dimensions.contentOverflow<=2&&dimensions.grid.bottom<=dimensions.board.bottom&&dimensions.board.bottom<=dimensions.footer.top,JSON.stringify(dimensions));
    await page.screenshot({path:'tmp/wordsearch-stage-desktop.png'});
    const cells=await page.evaluate(words=>buildWordSearch(puzzleRows('wordsearch',words)).placements[0].cells.map(([r,c])=>r*10+c),material.activity.questions[0].options);
    const firstCell=await page.locator(`[data-cell="${cells[0]}"]`).boundingBox();
    await page.mouse.move(firstCell.x+firstCell.width/2,firstCell.y+firstCell.height/2);
    await page.mouse.down();
    assert.equal(await page.locator('.wordsearch-grid button.selected').count(),1,'the first letter responds on pointer down');
    await page.mouse.up();
    await page.locator(`[data-cell="${cells.at(-1)}"]`).click();
    assert.equal(await page.locator('.wordsearch-grid button.selected').count(),cells.length);
    await page.locator('[data-wordsearch-check]').click();
    assert.match(await page.locator('.wordsearch-status').innerText(),/Encontraste/);
    assert.match(await page.locator('.wordsearch-progress strong').innerText(),/1\s*\/\s*5/);
    await page.locator('[data-wordsearch-hint]').click();
    assert.equal(await page.locator('.wordsearch-grid button.hinted').count(),1);
    const dragCells=await page.evaluate(words=>buildWordSearch(puzzleRows('wordsearch',words)).placements[1].cells.map(([r,c])=>r*10+c),material.activity.questions[0].options);
    const first=await page.locator(`[data-cell="${dragCells[0]}"]`).boundingBox(),last=await page.locator(`[data-cell="${dragCells.at(-1)}"]`).boundingBox();
    await page.mouse.move(first.x+first.width/2,first.y+first.height/2);
    await page.mouse.down();
    await page.mouse.move(last.x+last.width/2,last.y+last.height/2,{steps:dragCells.length+2});
    await page.mouse.up();
    assert.equal(await page.locator('.wordsearch-grid button.selected').count(),dragCells.length,'dragging selects the full word');
    await page.locator('[data-wordsearch-check]').click();
    assert.match(await page.locator('.wordsearch-progress strong').innerText(),/2\s*\/\s*5/);
    await page.locator('.play-footer .play-solution-link').click();
    assert.equal(await page.locator('.wordsearch-solution-dock').isVisible(),true);
    assert.ok(await page.locator('.wordsearch-grid button.solution').count()>0,'solution highlights remaining words on the grid');
    dimensions=await layout();
    assert.ok(dimensions.board.bottom<=dimensions.footer.top,JSON.stringify(dimensions));
    assert.ok(dimensions.grid.height>400,'opening the solution does not shrink the letter grid');
    await page.screenshot({path:'tmp/wordsearch-stage-solution.png'});
    await page.locator('#dialog .close').click();
    for(const viewport of [{width:390,height:844},{width:320,height:640}]){
      await page.setViewportSize(viewport);await open();dimensions=await layout();
      await page.screenshot({path:`tmp/wordsearch-stage-${viewport.width}.png`});
      assert.ok(dimensions.horizontal<=2&&dimensions.footer.bottom<=viewport.height,`mobile ${viewport.width}: ${JSON.stringify(dimensions)}`);
      const controls=await page.evaluate(()=>{const rect=selector=>document.querySelector(selector).getBoundingClientRect(),overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;const badge=rect('.play-question[data-type="wordsearch"] .play-kind'),timer=rect('.play-question[data-type="wordsearch"] .game-timer'),close=rect('#dialog .close'),intro=rect('.wordsearch-intro');return {badgeTimer:overlap(badge,timer),timerClose:overlap(timer,close),timerIntro:overlap(timer,intro)}});
      assert.deepEqual(controls,{badgeTimer:false,timerClose:false,timerIntro:false},`mobile header controls: ${JSON.stringify(controls)}`);
      await page.locator('#dialog .close').click();
    }
    await page.setViewportSize({width:1366,height:768});
    const long={...material,activity:{...material.activity,questions:[{...material.activity.questions[0],prompt:'Encuentra en la cuadrícula los conceptos científicos de este tema y comprueba cada selección antes de continuar con la actividad.',options:['ELECTRICIDAD','TEMPERATURA','ECOSISTEMA','FOTOSINTESIS','EVOLUCION','GRAVEDAD','ORGANISMO','CELULA']}]}};
    await page.evaluate(value=>runActivity(value,''),long);
    const longLayout=await layout();
    assert.equal(await page.locator('.wordsearch-grid button').count(),144);
    assert.ok(longLayout.horizontal<=2&&longLayout.contentOverflow<=2&&longLayout.grid.bottom<=longLayout.board.bottom&&longLayout.board.bottom<=longLayout.footer.top,`long words: ${JSON.stringify(longLayout)}`);
    await page.screenshot({path:'tmp/wordsearch-stage-long.png'});
    await page.locator('#dialog .close').click();
    const touchContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const touchPage=await touchContext.newPage();
    await touchPage.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await touchPage.evaluate(value=>runActivity(value,''),material);
    const touchCells=await touchPage.evaluate(words=>buildWordSearch(puzzleRows('wordsearch',words)).placements[0].cells.map(([r,c])=>r*10+c),material.activity.questions[0].options);
    await touchPage.locator(`[data-cell="${touchCells[0]}"]`).tap();
    await touchPage.locator(`[data-cell="${touchCells.at(-1)}"]`).tap();
    assert.equal(await touchPage.locator('.wordsearch-grid button.selected').count(),touchCells.length,'touching first and last letters selects a word');
    await touchPage.locator('[data-wordsearch-check]').tap();
    assert.match(await touchPage.locator('.wordsearch-progress strong').innerText(),/1\s*\/\s*5/);
    const swipeCells=await touchPage.evaluate(words=>buildWordSearch(puzzleRows('wordsearch',words)).placements[1].cells.map(([r,c])=>r*10+c),material.activity.questions[0].options);
    const swipeStart=await touchPage.locator(`[data-cell="${swipeCells[0]}"]`).boundingBox();
    const swipeEnd=await touchPage.locator(`[data-cell="${swipeCells.at(-1)}"]`).boundingBox();
    const from={x:swipeStart.x+swipeStart.width/2,y:swipeStart.y+swipeStart.height/2};
    const to={x:swipeEnd.x+swipeEnd.width/2,y:swipeEnd.y+swipeEnd.height/2};
    const session=await touchContext.newCDPSession(touchPage);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});
    for(let step=1;step<=swipeCells.length+2;step++){
      const fraction=step/(swipeCells.length+2);
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*fraction,y:from.y+(to.y-from.y)*fraction,id:1}]});
    }
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await touchPage.waitForTimeout(100);
    assert.equal(await touchPage.locator('.wordsearch-grid button.selected').count(),swipeCells.length,'touch dragging selects the full word');
    await touchPage.locator('[data-wordsearch-check]').tap();
    assert.match(await touchPage.locator('.wordsearch-progress strong').innerText(),/2\s*\/\s*5/);
    await touchContext.close();
    assert.deepEqual(errors,[]);
    console.log('PASS wordsearch stage, selection, hint, solution and responsive layout');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
