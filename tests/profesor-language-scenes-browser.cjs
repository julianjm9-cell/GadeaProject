const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');

const slugs=['fabrica-palabras','detectives-signos','biblioteca-secreta','isla-tildes','redaccion-titulares','agencia-oraciones','central-mensajes','museo-expositivo','archivo-sintagmas','redaccion-compuesta','atlas-registros','sala-comentario'];
const newScenes=new Set(['museo-expositivo','archivo-sintagmas','redaccion-compuesta','atlas-registros','sala-comentario']);
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(resolve(__dirname,'../apps/profesor/index.html')).href);
   for(const slug of slugs){
    const data=await page.evaluate(slug=>{
     const material=publicAdvancedGames.find(game=>game.slug===slug||game.id.endsWith(':'+slug));
     if(!material)return {error:'missing material'};
     runActivity(material,'');
     const question=document.querySelector('#dialog .play-question:not([hidden])');
     const content=document.querySelector('#dialog .play-content');
     const footer=document.querySelector('#dialog .play-footer');
     const controls=question?.querySelector('.memory-stage,.error-studio,.challenge-game,.matching-studio,.mini-game');
     return {scene:question?.dataset.publicScene,image:question?getComputedStyle(question).getPropertyValue('--scene-image').trim():'',artwork:material.artwork,controls:!!controls,
      horizontal:document.querySelector('#dialog').scrollWidth-document.querySelector('#dialog').clientWidth,
      overflow:content.scrollHeight-content.clientHeight,footerBottom:footer.getBoundingClientRect().bottom};
    },slug);
    assert.equal(data.error,undefined,`${slug}: ${data.error}`);
    assert.equal(data.scene,slug==='detectives-signos'?'signos':slug,`${slug}: wrong scene`);
    assert.ok(data.image.includes('.webp'),`${slug}: missing artwork`);
    if(newScenes.has(slug)){
     assert.equal(data.artwork,`public-${slug}-scene.webp`,`${slug}: library cover does not use its scene`);
     assert.ok(data.image.includes(data.artwork),`${slug}: play scene differs from its library cover`);
    }
    assert.ok(data.controls,`${slug}: missing controls`);
    assert.ok(data.horizontal<=2,`${slug} ${width}px horizontal overflow ${data.horizontal}`);
    assert.ok(data.overflow===0||data.overflow>18,`${slug} ${width}px tiny scrollbar ${data.overflow}`);
    assert.ok(data.footerBottom<=height+2,`${slug} ${width}px footer clipped`);
    if(width===1366)await page.screenshot({path:resolve(__dirname,`../tmp/language-${slug}.png`)});
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS 12 Lengua scenes mount at desktop, tablet and mobile with artwork and controls');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
