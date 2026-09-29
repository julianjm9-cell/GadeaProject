const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href+'#alumnos/lucia/Biblioteca');
  await page.getByRole('button',{name:'Crear material',exact:true}).click();
  await page.getByLabel('Contenido o tema').fill('Animales');
  for(const type of ['wordsearch','crossword','dragdrop'])await page.locator(`[data-exercise="${type}"]`).click();
  await page.locator('.studio-advanced summary').click();
  await page.locator('#count-pairs').fill('0');
  await page.getByRole('button',{name:/Continuar/}).click();
  for(const [index,prompt,options] of [
   [0,'Busca los animales','GATO\nPATO\nRANA'],
   [1,'Completa el crucigrama','GATO | Felino\nPATO | Ave acuática\nRATA | Roedor'],
   [2,'Relaciona cada animal con su grupo','Gato | Mamífero\nPato | Ave\nRana | Anfibio'],
  ]){await page.locator('#q-'+index).fill(prompt);await page.locator('#o-'+index).fill(options)}
  assert.equal(await page.locator('.puzzle-preview-error').count(),0);
  await page.screenshot({path:'tools/profesor-puzzles-editor.png'});
  await page.getByRole('button',{name:'Guardar material',exact:true}).click();
  await page.getByRole('button',{name:'Usar en clase'}).click();
  await page.getByRole('button',{name:'Abrir actividad',exact:true}).click();
  await page.screenshot({path:'tools/profesor-puzzles-class.png'});
  assert.equal(await page.locator('#puzzle-0 .puzzle-grid button').count(),100);
  const placements=await page.evaluate(()=>buildWordSearch(['GATO','PATO','RANA']).placements.map(p=>[p.row*10+p.col,p.endRow*10+p.endCol]));
  for(const [index,[start,end]] of placements.entries()){
   if(index===0){await page.locator(`#puzzle-0 [data-cell="${start}"]`).focus();await page.keyboard.press('Enter')}else await page.locator(`#puzzle-0 [data-cell="${start}"]`).click();
   await page.locator(`#puzzle-0 [data-cell="${end}"]`).click();
  }
  assert.match(await page.locator('#r-0').inputValue(),/GATO/);
  const crossword=await page.evaluate(()=>buildCrossword(['GATO','PATO','RATA']).grid);
  for(let row=0;row<crossword.length;row++)for(let col=0;col<crossword[row].length;col++)if(crossword[row][col])await page.locator(`#puzzle-1 [data-puzzle-cell="${row}-${col}"]`).fill(crossword[row][col]);
  await page.locator('#puzzle-2 [data-item="0"]').dragTo(page.locator('#puzzle-2 [data-target="0"]'));
  for(const [item,target] of [[1,1],[2,2]]){await page.locator(`#puzzle-2 [data-item="${item}"]`).click();await page.locator(`#puzzle-2 [data-target="${target}"]`).click()}
  await page.getByRole('button',{name:'Comprobar respuestas'}).click();
  assert.match(await page.locator('#activityScore').innerText(),/3\/3 correctas/);
  await page.reload();
  assert.equal(await page.evaluate(()=>state.activityAttempts[0].score),3);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>runActivity(state.library.find(m=>m.title==='Animales'),''));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.equal(await page.evaluate(()=>document.querySelector('#puzzle-0 .puzzle-grid').getBoundingClientRect().right>innerWidth+2),false);
  assert.deepEqual(errors,[]);
  console.log('PASS word search, crossword and drag/drop: editor, visual boards, classroom attempt and persistence');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
