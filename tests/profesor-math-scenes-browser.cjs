const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const {existsSync}=require('node:fs');

const slugs=['tren-decenas','mercado-monedas','observatorio-numeros','cocina-fracciones','feria-porcentajes','observatorio-decimales','ruta-bajo-cero','boveda-racionales','mercado-porcentajes','torre-radicales','observatorio-complejos','camara-matrices'];
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
     const controls=question?.querySelector('.matching-studio,.challenge-game');
     const image=question?getComputedStyle(question).getPropertyValue('--scene-image').trim():'';
     return {scene:question?.dataset.publicScene,image,controls:!!controls,artwork:material.artwork,
      stageLabels:[...(question?.querySelectorAll('.race-track button span')||[])].map(node=>node.textContent),
      horizontal:document.querySelector('#dialog').scrollWidth-document.querySelector('#dialog').clientWidth,
      overflow:content.scrollHeight-content.clientHeight,footerBottom:footer.getBoundingClientRect().bottom,
      tableWrap:question?.querySelector('.challenge-table-wrap')?.clientWidth||0,
      tableScroll:question?.querySelector('.challenge-table-wrap')?.scrollWidth||0};
    },slug);
    assert.equal(data.error,undefined,`${slug}: ${data.error}`);
    assert.equal(data.scene,slug,`${slug}: wrong scene`);
    assert.ok(data.image.includes('.webp'),`${slug}: missing artwork`);
    assert.ok(existsSync(resolve(__dirname,'../apps/profesor/assets/games',data.artwork)),`${slug}: artwork file missing: ${data.artwork}`);
    if(['boveda-racionales','mercado-porcentajes','torre-radicales','observatorio-complejos'].includes(slug))
     assert.equal(data.artwork,`public-${slug}-scene.webp`,`${slug}: still sharing another game's scene`);
    if(slug==='torre-radicales')assert.ok(data.stageLabels.every(label=>label.includes('Planta')),`Tower floors not labelled: ${data.stageLabels}`);
    assert.ok(data.controls,`${slug}: missing controls`);
    assert.ok(data.horizontal<=2,`${slug} ${width}px horizontal overflow ${data.horizontal}`);
    assert.ok(data.overflow===0||data.overflow>18,`${slug} ${width}px tiny scrollbar ${data.overflow}`);
    assert.ok(data.footerBottom<=height+2,`${slug} ${width}px footer clipped`);
    if(width===1366&&['cocina-fracciones','observatorio-decimales','boveda-racionales','mercado-porcentajes','torre-radicales','observatorio-complejos'].includes(slug))
     await page.screenshot({path:resolve(__dirname,`../tmp/math-${slug}.png`)});
    assert.ok(data.tableScroll<=data.tableWrap+2,`${slug} ${width}px table clipped`);
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`page errors at ${width}px`);
   await page.close();
  }
  console.log('PASS 12 Math scenes mount at desktop, tablet and mobile with artwork and controls');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
