const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const {existsSync}=require('node:fs');

const slugs=['atlas-explorador','mapa-migraciones','ciudad-economica','asamblea-revoluciones','archivo-contemporaneo','hemeroteca-fuentes','plaza-saludos','album-recuerdos','cronica-pasado','puente-subjuntivo','consejo-modalidad','tribunal-ambiguedad'];
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(pathToFileURL(resolve(__dirname,'../apps/profesor/index.html')).href);
   for(const slug of slugs){
    const data=await page.evaluate(slug=>{
     const material=publicAdvancedGames.find(game=>game.id.endsWith(':'+slug));
     if(!material)return {error:'missing material'};
     runActivity(material,'');
     const question=document.querySelector('#dialog .play-question:not([hidden])');
     const content=document.querySelector('#dialog .play-content');
     const footer=document.querySelector('#dialog .play-footer');
     const buckets=[...(question?.querySelectorAll('.match-bucket')||[])];
     return {scene:question?.dataset.publicScene,image:question?getComputedStyle(question).getPropertyValue('--scene-image').trim():'',controls:!!question?.querySelector('.question-controls')?.children.length,
      questionScenes:material.activity?.questions?.map(item=>item.publicScene),artwork:material.artwork,
      bucketNames:buckets.map(bucket=>bucket.querySelector('strong')?.textContent),bucketCenters:buckets.map(bucket=>bucket.getBoundingClientRect().x+bucket.getBoundingClientRect().width/2),
      horizontal:document.querySelector('#dialog').scrollWidth-document.querySelector('#dialog').clientWidth,
      overflow:content.scrollHeight-content.clientHeight,footerBottom:footer.getBoundingClientRect().bottom};
    },slug);
    assert.equal(data.error,undefined,`${slug}: ${data.error}`);
    assert.equal(data.scene,slug,`${slug}: wrong scene`);
    assert.ok(data.image.includes('.webp'),`${slug}: missing artwork`);
    assert.ok(existsSync(resolve(__dirname,'../apps/profesor/assets/games',data.artwork)),`${slug}: artwork file does not exist: ${data.artwork}`);
    if(['cronica-pasado','consejo-modalidad','tribunal-ambiguedad'].includes(slug))
     assert.equal(data.artwork,`public-${slug}-scene.webp`,`${slug}: still sharing artwork`);
    assert.ok(data.questionScenes?.every(scene=>scene===slug),`${slug}: scene missing from question`);
    assert.ok(data.controls,`${slug}: missing controls`);
    assert.ok(data.horizontal<=2,`${slug} ${width}px horizontal overflow ${data.horizontal}`);
    assert.ok(data.overflow===0||data.overflow>18,`${slug} ${width}px tiny scrollbar ${data.overflow}`);
    assert.ok(data.footerBottom<=height+2,`${slug} ${width}px footer clipped`);
    if(slug==='ciudad-economica'&&width===1366){
     assert.deepEqual(data.bucketNames,['Primario','Secundario','Terciario'],'Sectors must follow the landscape');
     assert.ok(data.bucketCenters[2]-data.bucketCenters[0]>600,'Sector destinations must span the illustrated landscape');
    }
    if(slug==='hemeroteca-fuentes')assert.deepEqual(data.bucketNames,['Primaria','Secundaria'],'Historical sources must have a stable order');
    if(width===1366)await page.screenshot({path:resolve(__dirname,`../tmp/social-espanol-${slug}.png`)});
    await page.evaluate(()=>document.querySelector('#dialog')?.close());
   }
   assert.deepEqual(errors,[],`page errors at ${width}px`);
   await page.close();
  }
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  await page.goto(pathToFileURL(resolve(__dirname,'../apps/profesor/index.html')).href);
  await page.evaluate(()=>runActivity(publicAdvancedGames.find(game=>game.id.endsWith(':ciudad-economica')),''));
  await page.locator('.match-bank .match-piece').filter({hasText:'Cultivo de trigo'}).click();
  await page.locator('.match-bucket').filter({hasText:'Primario'}).locator('[data-match-bucket]').click();
  assert.ok(await page.locator('.match-bucket').filter({hasText:'Primario'}).locator('.match-piece').filter({hasText:'Cultivo de trigo'}).count(),'Sector card must move to its target');
  await page.locator('[data-board-check]').click();
  await page.waitForFunction(()=>document.querySelector('.match-bucket .match-piece.answer-right'));
  await page.evaluate(()=>document.querySelector('#dialog')?.close());
  await page.evaluate(()=>runActivity(publicAdvancedGames.find(game=>game.id.endsWith(':album-recuerdos')),''));
  await page.locator('.challenge-choice').filter({hasText:'Ayer fui al cine.'}).click();
  await page.locator('.challenge-choice').filter({hasText:'Ayer voy al cine.'}).click();
  await page.locator('[data-challenge-check]').click();
  await page.waitForFunction(()=>document.querySelector('.challenge-choice.is-incorrect'));
  const feedback=await page.evaluate(()=>({
   correct:getComputedStyle(document.querySelector('.challenge-choice.is-correct')).backgroundColor,
   incorrect:getComputedStyle(document.querySelector('.challenge-choice.is-incorrect')).backgroundColor,
   correctImage:getComputedStyle(document.querySelector('.challenge-choice.is-correct')).backgroundImage,
   incorrectImage:getComputedStyle(document.querySelector('.challenge-choice.is-incorrect')).backgroundImage
  }));
  assert.notEqual(feedback.correct,feedback.incorrect,'Correct and incorrect answers must be visibly different');
  assert.equal(feedback.correctImage,'none','Correct answer feedback must stay visible');
  assert.equal(feedback.incorrectImage,'none','Incorrect answer feedback must stay visible');
  await page.close();
  console.log('PASS 12 Social/Spanish games at desktop, tablet and mobile; sector placement and album feedback');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
