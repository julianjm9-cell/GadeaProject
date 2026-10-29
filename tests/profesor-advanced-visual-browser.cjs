const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');
const challenges=require('../apps/profesor/tests/fixtures/challenge-games.json');

const questions=[
 {type:'mystery',prompt:'Descubre el sentido.',answer:'Vista',options:['Detecto colores y formas.','Me ayudan dos órganos de la cara.','Necesito luz.']},
 {type:'intruder',prompt:'¿Cuál no forma parte del circuito?',answer:'Regla',options:['Pila','Cables','Bombilla','Regla']},
 {type:'bingo',prompt:'Encuentra los conceptos.',answer:'Completado',options:Array.from({length:9},(_,i)=>`Concepto ${i+1} | Pista ${i+1}`)},
 ...challenges,
];
const material={id:'advanced-layout',title:'Juegos avanzados',subject:'Ciencias',activity:{version:1,questions}};

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
   await page.evaluate(value=>runActivity(value,''),material);
   for(let i=0;i<questions.length;i++){
    if(i)await page.getByRole('button',{name:'Actividad siguiente'}).click();
    const type=questions[i].type;
    assert.equal(await page.locator('.play-question:visible').getAttribute('data-type'),type);
    const metrics=await page.evaluate(()=>{
     const dialog=document.querySelector('#dialog'),content=document.querySelector('.play-content'),footer=document.querySelector('.play-footer');
     return {horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:content.scrollHeight-content.clientHeight,footerBottom:footer.getBoundingClientRect().bottom};
    });
    assert.ok(metrics.horizontal<=2,`${type} ${width}px horizontal overflow: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.footerBottom<=height+2,`${type} ${width}px footer clipped: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.overflow===0||metrics.overflow>18,`${type} ${width}px has a tiny needless scrollbar: ${JSON.stringify(metrics)}`);
   }
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS advanced games fit desktop, laptop and mobile without clipped controls or tiny scrollbars');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
