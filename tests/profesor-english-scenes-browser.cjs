const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const {existsSync}=require('node:fs');

const slugs=['mochila-bilingue','safari-parque','aeropuerto-habitos','ciudad-direcciones','portal-pasado','estacion-tiempos','estudio-habitos','cine-pasado','diario-viajes','portal-condicional','estudio-advanced-tenses','biblioteca-inference'];
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
     const game=question?.querySelector('.memory-stage,.sentence-board,.mini-game,.challenge-game');
     const image=getComputedStyle(question).getPropertyValue('--scene-image').trim();
     return {scene:question?.dataset.publicScene,image,artwork:material.artwork,game:!!game,bodyOverflow:document.querySelector('#dialog').scrollWidth-document.querySelector('#dialog').clientWidth,contentOverflow:content.scrollHeight-content.clientHeight,footerBottom:footer.getBoundingClientRect().bottom};
    },slug);
    assert.equal(data.error,undefined,`${slug}: ${data.error}`);
    assert.ok(data.scene===slug||slug==='safari-parque'&&data.scene==='safari',`${slug}: scene ${data.scene}`);
    assert.ok(data.image.includes('.webp'),`${slug}: missing scene artwork`);
    assert.ok(existsSync(resolve(__dirname,'../apps/profesor/assets/games',data.artwork)),`${slug}: missing artwork file ${data.artwork}`);
    if(['diario-viajes','portal-condicional','biblioteca-inference'].includes(slug))
     assert.equal(data.artwork,`public-${slug}-scene.webp`,`${slug}: still sharing artwork`);
    assert.ok(data.game,`${slug}: missing game controls`);
    assert.ok(data.bodyOverflow<=2,`${slug} ${width}px horizontal overflow ${data.bodyOverflow}`);
    assert.ok(data.contentOverflow===0||data.contentOverflow>18,`${slug} ${width}px tiny scrollbar ${data.contentOverflow}`);
    assert.ok(data.footerBottom<=height+2,`${slug} ${width}px footer clipped`);
    if(width===1366&&['diario-viajes','portal-condicional','biblioteca-inference'].includes(slug))
     await page.screenshot({path:resolve(__dirname,`../tmp/english-${slug}.png`)});
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS 12 English scenes mount on desktop and mobile with artwork and visible controls');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
