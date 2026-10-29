const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resolve}=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

test('la biblioteca alinea su navegación y carga seis iconos de asignatura',async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1900,900],[1180,800],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(resolve(__dirname,'../apps/e25/index.html')).href+'?demo=1');
   await page.waitForFunction(()=>typeof openLibrary==='function');
   await page.evaluate(()=>openLibrary('subjects'));
   const result=await page.evaluate(()=>{
    const box=selector=>document.querySelector(selector)?.getBoundingClientRect();
    const icons=[...document.querySelectorAll('.subject-tile-icon img')];
    return {heading:box('.subjects-heading>div:first-child'),nav:box('.subjects-heading .subject-library-toggle'),summary:box('.subjects-heading .subjects-summary'),tiles:icons.length,iconsLoaded:icons.every(icon=>icon.complete&&icon.naturalWidth>0),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
   });
   assert.equal(result.tiles,6,`${width}px: faltan asignaturas`);
   assert.ok(result.iconsLoaded,`${width}px: falta algún icono`);
   assert.ok(result.overflow<=2,`${width}px: desbordamiento horizontal`);
   if(width===1900){
    assert.ok(Math.abs(result.heading.top-result.nav.top)<70,'el selector no está alineado con el encabezado');
    assert.ok(Math.abs(result.summary.top-result.nav.top)<70,'el selector no está alineado con el progreso');
   }
   if(width===390)assert.ok(result.nav.top>=result.summary.bottom-2,'en móvil el selector debe ir bajo el progreso');
   if(width===1900||width===390)await page.screenshot({path:resolve(__dirname,`../tmp/eso-library-${width}.png`)});
   await page.getByRole('button',{name:'Recursos',exact:true}).first().click();
   assert.match(await page.locator('.subjects-heading h2').innerText(),/Recursos/);
   assert.deepEqual(errors,[],`${width}px: errores de JavaScript`);
   await page.close();
  }
 }finally{await browser.close()}
});
