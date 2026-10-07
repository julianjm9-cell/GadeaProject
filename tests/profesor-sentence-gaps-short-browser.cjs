const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const page=await browser.newPage({viewport:{width:1366,height:850}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
  const questions=[
    {type:'sentence',prompt:'Ordena los fragmentos.',options:['multiplica numerador y denominador por dos.','Para obtener fracciones equivalentes,','así conservas el mismo valor.'],answer:'multiplica numerador y denominador por dos. → Para obtener fracciones equivalentes, → así conservas el mismo valor.'},
    {type:'multigaps',prompt:'María necesita **___ (simplificar) una expresión y luego ___ (factorizar)** el trinomio.',options:['simplificar','factorizar'],answer:'simplificar | factorizar'},
    {type:'short',prompt:'Past of go',answer:'went',options:[],rubric:'Exact spelling.'}
  ];
  await page.evaluate(qs=>runActivity({id:'repair',title:'Revisión',subject:'Matemáticas',activity:{questions:qs}},state.students[0].id),questions);
  const desired=['Para obtener','multiplica numerador','así conservas'];
  for(let target=0;target<desired.length;target++){
    let rows=await page.locator('#order-0 [data-sequence-row]').allInnerTexts();
    let current=rows.findIndex(text=>text.includes(desired[target]));
    while(current>target){await page.locator(`#order-0 [data-sequence-row="${current}"] [data-move="-1"]`).click();current--;}
  }
  await page.locator('#order-0 [data-confirm-order]').click();
  assert.match(await page.locator('#feedback-0').innerText(),/Correcto/);
  assert.equal(await page.locator('#order-0 .answer-right').count(),3);
  await page.getByRole('button',{name:'Actividad siguiente'}).click();
  assert.equal(await page.locator('#puzzle-1').innerText().then(text=>/\(simplificar\)|\(factorizar\)|\*\*/.test(text)),false);
  await page.locator('[data-multi-gap="0"]').fill('simplificar');
  await page.locator('[data-multi-gap="1"]').fill('factorizar');
  await page.getByRole('button',{name:'Actividad siguiente'}).click();
  await page.locator('#r-2').fill('goed');
  await page.locator('[data-question="2"] [data-check-question]').click();
  assert.match(await page.locator('#feedback-2').innerText(),/Revisa/);
  await page.locator('#r-2').fill('went');
  await page.locator('[data-question="2"] [data-check-question]').click();
  assert.match(await page.locator('#feedback-2').innerText(),/Correcto/);
  await page.getByRole('button',{name:'Terminar',exact:true}).click();
  assert.equal(await page.locator('#dialog').evaluate(element=>element.open),true);
  assert.match(await page.locator('#activityScore').innerText(),/3\/3 correctas/);
  await page.evaluate(()=>$('dialog').close());
  await page.evaluate(question=>editActivity({id:'draft-repair',title:'Ejercicio de frase',subject:'Matemáticas',activity:{questions:[question]}}),questions[0]);
  await page.locator('#useDraft').click();
  assert.equal(await page.locator('#dialog').evaluate(element=>element.open),true);
  assert.equal(await page.locator('.play-question').count(),1);
  await page.getByRole('button',{name:'Terminar',exact:true}).click();
  assert.equal(await page.locator('#dialog').evaluate(element=>element.open),true);
  assert.match(await page.locator('#activityScore').innerText(),/1 sin completar/);
  assert.deepEqual(errors,[]);
  console.log('PASS sentence ordering, completion, legacy gaps and short answer grading');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
