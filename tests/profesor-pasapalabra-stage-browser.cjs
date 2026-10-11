const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');

const words = ['árbol','barco','casa','dado','escuela','flor','gato','hielo','isla','juego','kilo','luna','mesa','nube','oso','perro','queso','río'];
const clues = ['Planta grande con tronco','Vehículo que navega','Edificio donde vivimos','Cubo numerado para jugar','Lugar donde se aprende','Parte vistosa de una planta','Felino doméstico','Agua congelada','Tierra rodeada de agua','Actividad para divertirse','Mil gramos','Satélite natural de la Tierra','Mueble con tablero','Masa blanca en el cielo','Animal de gran tamaño que hiberna','Animal doméstico que ladra','Alimento elaborado con leche','Corriente natural de agua'];
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
    const asset=await page.locator('#dialog').evaluate(async element=>{
      const background=getComputedStyle(element).backgroundImage;
      const url=background.match(/url\("?([^"\)]+)"?\)/)?.[1];
      if(!url)return false;
      const image=new Image();image.src=url;await image.decode();return image.naturalWidth===1672;
    });
    assert.equal(asset,true,'supplied background is loaded');
    await page.screenshot({path:'tmp/pasapalabra-stage-desktop.png'});
    await page.locator('[data-next]').click();
    assert.match(await page.locator('.play-progress').innerText(),/2 \/ 18/);
    await page.locator('[data-prev]').click();
    assert.match(await page.locator('.play-progress').innerText(),/1 \/ 18/);
    await page.locator('[data-pass]').click();
    assert.equal(await page.locator('[data-letter="0"]').evaluate(el=>el.classList.contains('passed')),true);
    await page.locator('[data-prev]').click();
    await page.locator('#pasapalabra-input-0').fill('árbol');
    await page.locator('[data-answer]').click();
    assert.equal(await page.locator('[data-letter="0"]').evaluate(el=>el.classList.contains('correct')),true);
    await page.locator('#dialog .close').click();
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(value=>runActivity(value,''),material);
    const mobile=await page.evaluate(()=>({horizontal:document.querySelector('#dialog').scrollWidth-document.querySelector('#dialog').clientWidth,buttons:[...document.querySelectorAll('.pasapalabra-controls button')].every(el=>el.getBoundingClientRect().bottom<=innerHeight),footer:document.querySelector('.play-footer').getBoundingClientRect().bottom}));
    assert.ok(mobile.horizontal<=2,`no mobile horizontal overflow: ${JSON.stringify(mobile)}`);
    assert.ok(mobile.buttons&&mobile.footer<=844,`mobile controls visible: ${JSON.stringify(mobile)}`);
    await page.screenshot({path:'tmp/pasapalabra-stage-mobile.png'});
    await page.setViewportSize({width:320,height:640});
    const narrow=await page.evaluate(()=>({horizontal:document.querySelector('#dialog').scrollWidth-document.querySelector('#dialog').clientWidth,buttons:[...document.querySelectorAll('.pasapalabra-controls button')].every(el=>el.getBoundingClientRect().bottom<=innerHeight),footer:document.querySelector('.play-footer').getBoundingClientRect().bottom}));
    assert.ok(narrow.horizontal<=2&&narrow.buttons&&narrow.footer<=640,`small mobile layout: ${JSON.stringify(narrow)}`);
    assert.deepEqual(errors,[]);
    console.log('PASS Pasapalabra stage, image, 18 letters, input, navigation and mobile');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
