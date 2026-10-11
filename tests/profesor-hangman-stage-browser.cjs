const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const material={id:'hangman-stage-check',title:'Filosofía',subject:'Historia',activity:{version:1,questions:[{
  type:'hangman',prompt:'Filósofo griego discípulo de Sócrates.',answer:'Platón',options:[]
}]}};
const longMaterial={...material,activity:{...material.activity,questions:[{
  type:'hangman',prompt:'Nombre de una especialidad científica que estudia las señales eléctricas del cerebro y requiere analizar registros con mucha precisión.',answer:'Electroencefalografía avanzada',options:[]
}]}};

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await page.evaluate(value=>runActivity(value,''),material);
    assert.equal(await page.locator('.hangman-clue p').innerText(),material.activity.questions[0].prompt);
    assert.equal(await page.locator('.play-question[data-type="hangman"]>h3').count(),0,'the clue is not duplicated above the board');
    assert.equal(await page.locator('.hangman-keyboard button').count(),27);
    assert.equal(await page.locator('.hangman-hearts span:not(.lost)').count(),7);
    assert.equal(await page.locator('.hangman-word .letter-slot').count(),6);
    const asset=await page.locator('#dialog').evaluate(async element=>{
      const url=getComputedStyle(element).backgroundImage.match(/url\("?([^"\)]+)"?\)/)?.[1];
      if(!url)return false;const image=new Image();image.src=url;await image.decode();return image.naturalWidth===1672;
    });
    assert.equal(asset,true,'the supplied empty stage loads');
    const layout=async()=>page.evaluate(()=>{
      const rect=selector=>document.querySelector(selector).getBoundingClientRect();
      const board=rect('.hangman-board'),keyboard=rect('.hangman-keyboard'),footer=rect('.play-footer'),clue=rect('.hangman-clue'),word=rect('.hangman-word-panel');
      return {horizontal:document.querySelector('#dialog').scrollWidth-document.querySelector('#dialog').clientWidth,contentOverflow:document.querySelector('.play-content').scrollHeight-document.querySelector('.play-content').clientHeight,board:board.toJSON(),keyboard:keyboard.toJSON(),footer:footer.toJSON(),clue:clue.toJSON(),word:word.toJSON()};
    });
    const desktop=await layout();
    assert.ok(desktop.horizontal<=2&&desktop.contentOverflow<=2&&desktop.board.bottom<=desktop.footer.top&&desktop.clue.bottom<=desktop.keyboard.top&&desktop.word.bottom<=desktop.keyboard.top,`desktop layout: ${JSON.stringify(desktop)}`);
    await page.screenshot({path:'tmp/hangman-stage-desktop.png'});
    await page.locator('#hangman-0').press('p');
    assert.equal(await page.locator('[data-hangman-letter="P"]').isDisabled(),true);
    assert.equal(await page.locator('.hangman-word .letter-slot').first().innerText(),'P');
    await page.getByRole('button',{name:'Letra Z'}).click();
    assert.equal(await page.locator('.hangman-hearts .lost').count(),1);
    assert.equal(await page.locator('.hangman-figure').getAttribute('data-errors'),'1');
    await page.locator('[data-hangman-reset]').click();
    assert.equal(await page.locator('.hangman-hearts .lost').count(),0);
    assert.equal(await page.locator('[data-hangman-letter="P"]').isEnabled(),true);
    for(const letter of ['P','L','A','T','O','N'])await page.getByRole('button',{name:`Letra ${letter}`,exact:true}).click();
    assert.match(await page.locator('.hangman-status').innerText(),/Palabra descubierta/);
    assert.equal(await page.locator('#r-0').inputValue(),'Platón','accented answer is accepted through unaccented keyboard letters');
    assert.equal(await page.locator('.hangman-keyboard button:not(:disabled)').count(),0);
    assert.equal(await page.locator('[data-hangman-reset]').isDisabled(),true);
    await page.locator('#dialog .close').click();

    await page.setViewportSize({width:1848,height:900});
    await page.evaluate(value=>runActivity(value,''),material);
    const wide=await layout();
    assert.ok(wide.horizontal<=2&&wide.contentOverflow<=2&&wide.board.bottom<=wide.footer.top,`wide layout: ${JSON.stringify(wide)}`);
    await page.screenshot({path:'tmp/hangman-stage-wide.png'});
    await page.locator('#dialog .close').click();

    for(const viewport of [{width:390,height:844},{width:320,height:640}]){
      await page.setViewportSize(viewport);
      await page.evaluate(value=>runActivity(value,''),material);
      const mobile=await layout();
      assert.ok(mobile.horizontal<=2&&mobile.keyboard.bottom<=mobile.board.bottom&&mobile.board.bottom<=mobile.footer.top&&mobile.footer.bottom<=viewport.height,`mobile ${viewport.width}: ${JSON.stringify(mobile)}`);
      const header=await page.evaluate(()=>{const rect=selector=>document.querySelector(selector).getBoundingClientRect(),overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,badge=rect('.play-question[data-type="hangman"] .play-kind'),timer=rect('.play-question[data-type="hangman"] .game-timer'),close=rect('#dialog .close');return {badgeTimer:overlap(badge,timer),timerClose:overlap(timer,close)}});
      assert.deepEqual(header,{badgeTimer:false,timerClose:false},`mobile header controls do not overlap: ${JSON.stringify(header)}`);
      await page.screenshot({path:`tmp/hangman-stage-${viewport.width}.png`});
      await page.locator('#dialog .close').click();
    }

    await page.setViewportSize({width:1366,height:768});
    await page.evaluate(value=>runActivity(value,''),longMaterial);
    const long=await layout();
    assert.ok(long.horizontal<=2&&long.board.bottom<=long.footer.top,`long answer layout: ${JSON.stringify(long)}`);
    assert.equal(await page.locator('.hangman-word .letter-slot').count(),longMaterial.activity.questions[0].answer.replaceAll(' ','').length);
    await page.screenshot({path:'tmp/hangman-stage-long.png'});
    await page.locator('#dialog .close').click();
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(value=>runActivity(value,''),longMaterial);
    assert.ok((await layout()).horizontal<=2,'long answer has no horizontal overflow on mobile');
    await page.getByRole('button',{name:'Letra E',exact:true}).click();
    await page.screenshot({path:'tmp/hangman-stage-long-mobile.png'});
    await page.locator('#dialog .close').click();
    await page.setViewportSize({width:320,height:640});
    await page.evaluate(value=>runActivity(value,''),longMaterial);
    const narrowLong=await layout();
    assert.ok(narrowLong.horizontal<=2&&narrowLong.footer.bottom<=640,`long answer on a narrow screen remains reachable: ${JSON.stringify(narrowLong)}`);
    await page.getByRole('button',{name:'Letra E',exact:true}).click();
    await page.locator('#dialog .close').click();
    await page.evaluate(value=>runActivity(value,''),material);
    for(const letter of ['B','C','D','E','F','G','H'])await page.getByRole('button',{name:`Letra ${letter}`,exact:true}).click();
    assert.equal(await page.locator('.hangman-hearts .lost').count(),7);
    assert.match(await page.locator('.hangman-status').innerText(),/respuesta era Platón/);
    await page.locator('[data-hangman-reset]').click();
    assert.equal(await page.locator('.hangman-hearts .lost').count(),0);
    assert.equal(await page.locator('#r-0').inputValue(),'');
    assert.equal(await page.locator('#feedback-0').innerText(),'');
    assert.equal(await page.locator('[data-hangman-letter="B"]').isEnabled(),true);
    assert.deepEqual(errors,[]);
    console.log('PASS Ahorcado stage, gameplay, reset, accents, long answers and responsive layout');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
