const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

const words=['árbol','barco','casa','dado','escuela','flor','gato','hielo','isla','juego','kilo','luna','mesa','nube','oso','perro','queso','río'];
const material={id:'pasapalabra-stage-check',title:'Vocabulario',subject:'Lengua',activity:{version:1,questions:[{
  type:'pasapalabra',prompt:'Completa el rosco de vocabulario.',answer:'Completado',
  options:words.map((word,index)=>String.fromCharCode(65+index)+' | Pista para '+word+' | '+word)
}]}};

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await page.evaluate(value=>runActivity(value,''),material);
    assert.equal(await page.locator('.pasapalabra-wheel [data-letter]').count(),18);
    assert.equal(await page.locator('.pasapalabra-wheel [data-slot]').count(),27);
    assert.equal(await page.locator('.pasapalabra-wheel .empty:disabled').count(),9);
    assert.equal(await page.locator('.pasapalabra-controls button').count(),2);
    assert.equal(await page.locator('.pasapalabra-intro').innerText(),material.activity.questions[0].prompt);
    const image=await page.locator('#dialog').evaluate(async dialog=>{
      const match=getComputedStyle(dialog).backgroundImage.match(/url\("([^"]+)"\)/);
      if(!match)return false;
      const asset=new Image();asset.src=match[1];await asset.decode();return asset.naturalWidth===1672;
    });
    assert.equal(image,true,'the background loads');
    const layout=await page.evaluate(()=>{
      const rect=s=>document.querySelector(s).getBoundingClientRect();
      const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      const card=rect('.pasapalabra-card'),score=rect('.pasapalabra-score-group>span:first-child'),solution=rect('.play-solution-link');
      return {letters:[...document.querySelectorAll('.pasapalabra-wheel button')].filter(button=>overlap(card,button.getBoundingClientRect())).length,scoreSolution:overlap(score,solution),controlsGap:rect('.pasapalabra-controls').top-rect('.rosco-layout').bottom};
    });
    assert.equal(layout.letters,0,'the card does not cover letters');
    assert.equal(layout.scoreSolution,false,'score and solution do not overlap');
    assert.ok(layout.controlsGap>=8,JSON.stringify(layout));
    await page.locator('.play-solution-link').click();
    assert.equal(await page.getByRole('dialog',{name:'Solución del rosco'}).isVisible(),true);
    await page.getByRole('button',{name:'Volver al juego'}).click();
    await page.locator('[data-next]').click();
    assert.match(await page.locator('.pasapalabra-finish').innerText(),/2 \/ 18/);
    await page.locator('[data-prev]').click();
    await page.locator('#pasapalabra-input-0').fill('árbol');
    await page.locator('[data-answer]').click();
    assert.equal(await page.locator('[data-letter="0"]').evaluate(el=>el.classList.contains('correct')),true);
    await page.setViewportSize({width:390,height:844});
    const mobile=await page.evaluate(()=>({overflow:document.querySelector('#dialog').scrollWidth-document.querySelector('#dialog').clientWidth,footer:document.querySelector('.play-footer').getBoundingClientRect().bottom}));
    assert.ok(mobile.overflow<=2&&mobile.footer<=844,JSON.stringify(mobile));
    assert.deepEqual(errors,[]);
    console.log('PASS Pasapalabra background, rosco, controls, solution and mobile');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
