const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
  await page.locator('.home-primary-nav').getByRole('button',{name:'Material'}).click();
  await page.getByRole('button',{name:'Crear material',exact:true}).click();
  const advanced=page.locator('.advanced-family');
  if(!await advanced.evaluate(node=>node.open))await advanced.locator('summary').click();
  for(const type of ['flashcard','memory','sentence','timeline','error']){
   const tile=advanced.locator(`[data-exercise="${type}"]`);
   await tile.click();
   assert.equal(await tile.getAttribute('aria-pressed'),'true',`${type} selected`);
  }
  await page.locator('#workshopCourse').selectOption('3.º ESO');
  await page.locator('#workshopSubject').selectOption('Lengua');
  await page.locator('#workshopTopic').fill('Repaso de vocabulario');
  await page.locator('#workshopManual').click();
  await page.locator('.activity-edit-block:visible').first().waitFor();
  assert.ok(await page.locator('.activity-edit-block').count()>=5);
  await page.locator('#dialog .close').click();
  if(await page.locator('#editorLeaveConfirmation').isVisible())await page.locator('#editorLeaveConfirmation [data-leave="keep"]').click();

  const material={id:'games-smoke',title:'Repaso',subject:'Lengua',activity:{version:1,questions:[
   {type:'flashcard',prompt:'Traduce apple',answer:'Manzana',options:[]},
   {type:'memory',prompt:'Encuentra parejas',answer:'Completado',options:['Gato | Cat','Perro | Dog']},
   {type:'sentence',prompt:'Construye la frase',answer:'La Tierra → gira → alrededor del Sol',options:['La Tierra','gira','alrededor del Sol']},
   {type:'timeline',prompt:'Ordena hechos',answer:'Primero → Después → Final',options:['Primero','Después','Final']},
   {type:'error',prompt:'Corrige: el Sol es un planeta',answer:'El Sol es una estrella',options:[]},
  ]}};
  await page.evaluate(value=>runActivity(value,''),material);
  await page.locator('#flip-0').click();
  assert.match(await page.locator('#flip-0').innerText(),/Manzana/);
  for(const type of ['memory','sentence','timeline','error']){
   await page.getByRole('button',{name:'Actividad siguiente'}).click();
   assert.equal(await page.locator('.play-question:visible').getAttribute('data-type'),type);
  }
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.deepEqual(errors,[]);
  console.log('PASS current catalog selection, editor, five games and mobile width');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
