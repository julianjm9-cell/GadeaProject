const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');

const words = ['árbol','barco','casa','dado','escuela','flor','gato','hielo','isla','juego','kilo','luna','mesa','nube','oso','perro','queso','río'];
const clues = ['Planta grande con tronco. Tiene raíces, ramas y hojas; algunas pierden las hojas cuando llega el otoño y vuelven a brotar en primavera. Su madera sirve para muebles.','Vehículo que navega','Edificio donde vivimos','Cubo numerado para jugar','Lugar donde se aprende','Parte vistosa de una planta','Felino doméstico','Agua congelada','Tierra rodeada de agua','Actividad para divertirse','Mil gramos','Satélite natural de la Tierra','Mueble con tablero','Masa blanca en el cielo','Animal de gran tamaño que hiberna','Animal doméstico que ladra','Alimento elaborado con leche','Corriente natural de agua'];
const material = { id:'pasapalabra-stage-check',title:'Vocabulario',subject:'Lengua',activity:{version:1,questions:[{
  type:'pasapalabra',prompt:'Completa el rosco de vocabulario.',answer:'Completado',options:words.map((word,index)=>`${'ABCDEFGHIJKLMNOPQR'[index]} | ${clues[index]} | ${word}`)
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
    assert.equal(await page.locator('.pasapalabra-wheel .empty').count(),9);
    assert.equal(await page.locator('.pasapalabra-wheel .empty:not(:disabled)').count(),0);
    assert.equal(await page.locator('.pasapalabra-wheel .empty').first().innerText(),'');
    assert.equal(await page.locator('[data-pass]').count(),0);
    assert.equal(await page.locator('.pasapalabra-controls button').count(),2);
    assert.equal(await page.locator('.pasapalabra-intro').innerText(),'Completa el rosco de vocabulario.');
    const asset=await page.locator('#dialog').evaluate(async element=>{
      const background=getComputedStyle(element).backgroundImage;
      const url=background.match(/url\("?([^"\)]+)"?\)/)?.[1];
      if(!url)return false;
      const image=new Image();image.src=url;await image.decode();return image.naturalWidth===1672;
    });
    assert.equal(asset,true,'supplied background is loaded');
    const geometry=await page.evaluate(()=>{
      const rect=selector=>document.querySelector(selector).getBoundingClientRect();
      const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      const card=rect('.pasapalabra-card'),score=rect('.pasapalabra-meta>span:first-child'),solution=rect('.play-solution-link'),controls=rect('.pasapalabra-controls'),intro=rect('.pasapalabra-intro'),topLetter=rect('.pasapalabra-wheel [data-slot="0"]'),position=rect('.pasapalabra-finish>strong'),finish=rect('.pasapalabra-finish [type="submit"]');
      return {card,scoreSolutionOverlap:overlap(score,solution),letterOverlap:[...document.querySelectorAll('.pasapalabra-wheel button')].filter(button=>overlap(card,button.getBoundingClientRect())).map(button=>button.dataset.slot),solutionCentered:Math.abs((solution.left+solution.right-controls.left-controls.right)/2)<3,solutionBelow:solution.top>=controls.bottom,solutionTop:solution.top,controlsBottom:controls.bottom,positionCentered:Math.abs((position.left+position.right-finish.left-finish.right)/2)<3,positionAbove:position.bottom<=finish.top,introGap:topLetter.top-intro.bottom};
    });
    assert.equal(geometry.scoreSolutionOverlap,false,'score and solution have separate space');
    assert.deepEqual(geometry.letterOverlap,[],`card does not cover rosco letters: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.solutionCentered&&geometry.solutionBelow&&geometry.positionCentered&&geometry.positionAbove&&geometry.introGap>=14,`controls and prompt aligned: ${JSON.stringify(geometry)}`);
    assert.equal(await page.locator('.pasapalabra-card>p').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,'long clue fits inside fixed card');
    const firstCard=await page.locator('.pasapalabra-card').boundingBox();
    await page.screenshot({path:'tmp/pasapalabra-stage-desktop.png'});
    await page.locator('[data-next]').click();
    assert.match(await page.locator('.pasapalabra-finish').innerText(),/2 \/ 18/);
    assert.equal(await page.locator('[data-letter="0"]').evaluate(el=>el.classList.contains('passed')),true);
    const nextCard=await page.locator('.pasapalabra-card').boundingBox();
    assert.equal(Math.round(firstCard.width),Math.round(nextCard.width));
    assert.equal(Math.round(firstCard.height),Math.round(nextCard.height));
    await page.locator('[data-prev]').click();
    assert.match(await page.locator('.pasapalabra-finish').innerText(),/1 \/ 18/);
    await page.locator('#pasapalabra-input-0').fill('árbol');
    await page.locator('[data-answer]').click();
    assert.equal(await page.locator('[data-letter="0"]').evaluate(el=>el.classList.contains('correct')),true);
    await page.locator('#dialog .close').click();
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(value=>runActivity(value,''),material);
    const mobile=await page.evaluate(()=>({horizontal:document.querySelector('#dialog').scrollWidth-document.querySelector('#dialog').clientWidth,buttons:[...document.querySelectorAll('.pasapalabra-controls button')].every(el=>el.getBoundingClientRect().bottom<=innerHeight),footer:document.querySelector('.play-footer').getBoundingClientRect().bottom,card:document.querySelector('.pasapalabra-card').getBoundingClientRect().toJSON(),solution:document.querySelector('.play-solution-link').getBoundingClientRect().toJSON(),score:document.querySelector('.pasapalabra-meta>span:first-child').getBoundingClientRect().toJSON()}));
    assert.ok(mobile.horizontal<=2,`no mobile horizontal overflow: ${JSON.stringify(mobile)}`);
    assert.ok(mobile.buttons&&mobile.footer<=844,`mobile controls visible: ${JSON.stringify(mobile)}`);
    assert.ok(mobile.score.right<=mobile.solution.left||mobile.solution.right<=mobile.score.left||mobile.score.bottom<=mobile.solution.top,`mobile status does not overlap: ${JSON.stringify(mobile)}`);
    await page.screenshot({path:'tmp/pasapalabra-stage-mobile.png'});
    await page.setViewportSize({width:320,height:640});
    const narrow=await page.evaluate(()=>({horizontal:document.querySelector('#dialog').scrollWidth-document.querySelector('#dialog').clientWidth,buttons:[...document.querySelectorAll('.pasapalabra-controls button')].every(el=>el.getBoundingClientRect().bottom<=innerHeight),footer:document.querySelector('.play-footer').getBoundingClientRect().bottom}));
    assert.ok(narrow.horizontal<=2&&narrow.buttons&&narrow.footer<=640,`small mobile layout: ${JSON.stringify(narrow)}`);
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.pasapalabra-card>p').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,'long clue fits on narrow screen');
    const narrowGeometry=await page.evaluate(()=>{const rect=selector=>document.querySelector(selector).getBoundingClientRect(),overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,card=rect('.pasapalabra-card'),score=rect('.pasapalabra-meta>span:first-child'),solution=rect('.play-solution-link');return {letters:[...document.querySelectorAll('.pasapalabra-wheel button')].filter(button=>overlap(card,button.getBoundingClientRect())).map(button=>button.dataset.slot),status:overlap(score,solution)}});
    assert.deepEqual(narrowGeometry,{letters:[],status:false},`narrow screen has no overlap: ${JSON.stringify(narrowGeometry)}`);
    await page.locator('#dialog .close').click();
    const sparse={...material,activity:{...material.activity,questions:[{...material.activity.questions[0],prompt:'En el contexto de las películas, completa los siguientes verbos en infinitivo que describen acciones típicas del proceso cinematográfico.',options:[material.activity.questions[0].options[0],material.activity.questions[0].options[4],material.activity.questions[0].options[17]]}]}};
    await page.evaluate(value=>runActivity(value,''),sparse);
    assert.equal(await page.locator('.pasapalabra-wheel [data-slot]').count(),27);
    assert.equal(await page.locator('.pasapalabra-wheel .empty').count(),24);
    assert.equal(await page.locator('.pasapalabra-wheel [data-letter]').count(),3);
    const sparseLayout=await page.evaluate(()=>{const r=selector=>document.querySelector(selector).getBoundingClientRect();return {intro:r('.pasapalabra-intro').bottom,firstLetter:r('.pasapalabra-wheel [data-slot="0"]').top,controls:r('.pasapalabra-controls').bottom,solution:r('.play-solution-link').top,finish:r('.pasapalabra-finish [type="submit"]').bottom}});
    assert.ok(sparseLayout.firstLetter-sparseLayout.intro>=10&&sparseLayout.solution>=sparseLayout.controls&&sparseLayout.finish<=640,`long prompt remains readable on narrow screen: ${JSON.stringify(sparseLayout)}`);
    await page.locator('#dialog .close').click();
    const full={...material,activity:{...material.activity,questions:[{...material.activity.questions[0],options:'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('').map(letter=>`${letter} | Pista para ${letter} | ${letter.toLowerCase()}`)}]}};
    await page.evaluate(value=>runActivity(value,''),full);
    assert.equal(await page.locator('.pasapalabra-wheel [data-letter]').count(),27);
    assert.equal(await page.locator('.pasapalabra-wheel .empty').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS Pasapalabra stage, image, 18 letters, input, navigation and mobile');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
