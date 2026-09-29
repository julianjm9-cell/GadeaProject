const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href+'#alumnos/lucia/Biblioteca');
  await p.getByRole('button',{name:'Crear material',exact:true}).click();
  await p.getByLabel('Contenido o tema').fill('Animales y naturaleza');
  for(const key of ['flashcard','memory','sentence','timeline','error']){
   const tile=p.locator('.playful-family [data-exercise="'+key+'"]');
   await tile.click();assert.equal(await tile.getAttribute('aria-pressed'),'true');
  }
  await p.screenshot({path:'tools/games-catalog.png'});
  await p.locator('.studio-advanced summary').click();await p.locator('#count-pairs').fill('0');
  await p.getByRole('button',{name:/Continuar/}).click();
  const prompts=['¿Cómo se dice gato en inglés?','Encuentra las traducciones','Construye la frase','Ordena el crecimiento','Corrige: los gatos tienen seis patas'];
  const answers=['Cat','','','','Los gatos tienen cuatro patas'];
  for(let i=0;i<5;i++){await p.locator('#q-'+i).fill(prompts[i]);await p.locator('#a-'+i).fill(answers[i]);}
  await p.locator('#o-1').fill('Gato | Cat\nPerro | Dog');
  await p.locator('#o-2').fill('El gato\nduerme\nen casa');
  await p.locator('#o-3').fill('Semilla\nBrote\nPlanta adulta');
  await p.getByRole('button',{name:'Guardar material',exact:true}).click();
  await p.getByRole('button',{name:'Usar en clase'}).click();
  await p.getByRole('button',{name:'Abrir actividad',exact:true}).click();
  await p.locator('#flip-0').click();assert.equal(await p.locator('#flip-0').innerText(),'Cat');
  // Discover the shuffled board by flipping cards, then match through the visible UI.
  const labels={};
  for(let j=0;j<4;j+=2){
   for(let k=j;k<j+2;k++){await p.locator('#memory-1 [data-card="'+k+'"]').click();labels[await p.locator('#memory-1 [data-card="'+k+'"]').innerText()]=k;}
   await p.waitForTimeout(950);
  }
  for(const pair of [['Gato','Cat'],['Perro','Dog']]){
   const first=p.locator('#memory-1 [data-card="'+labels[pair[0]]+'"]');
   if(await first.isEnabled()){await first.click();await p.locator('#memory-1 [data-card="'+labels[pair[1]]+'"]').click();}
  }
  assert.equal(await p.locator('#r-1').inputValue(),'Completado');
  for(const [i,wanted] of [[2,['El gato','duerme','en casa']],[3,['Semilla','Brote','Planta adulta']]]){
   for(let target=0;target<wanted.length;target++){
    let current=(await p.locator('#order-'+i+' .order-row span').allTextContents()).findIndex(t=>t.endsWith(wanted[target]));
    while(current>target){await p.locator('#order-'+i+' [data-pos="'+current+'"][data-dir="-1"]').click();current--;}
   }
  }
  await p.locator('#r-4').fill('Tienen cuatro patas');
  await p.getByRole('button',{name:'Comprobar respuestas'}).click();
  assert.match(await p.locator('#activityScore').innerText(),/3\/5 correctas.*2 pendientes/);
  await p.locator('#grade-0').selectOption('correct');await p.locator('#grade-4').selectOption('correct');
  await p.reload();assert.equal(await p.evaluate(()=>state.activityAttempts[0].score),5);
  await p.setViewportSize({width:390,height:844});
  await p.getByRole('button',{name:'Crear material',exact:true}).click();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log('PASS game selection, editor, flashcard, Memory, sequences, review and persistence');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
