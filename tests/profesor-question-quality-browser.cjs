const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:820}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
  const quiz={id:'quiz-1',type:'quiz',activityGroup:1,prompt:'¿Cuánto es 3 × 4?',answer:'12',options:['7','12','34'],explanation:'Multiplica tres grupos de cuatro.',hints:['Piensa en grupos iguales.'],optionFeedback:[{option:'7',explanation:'Has sumado los factores en vez de multiplicar.'},{option:'12',explanation:'Tres grupos de cuatro suman doce.'},{option:'34',explanation:'Unir las cifras no es multiplicar.'}]};
  const reading={id:'reading-2',type:'reading',activityGroup:2,prompt:'¿Dónde pasea Ana?',answer:'Por el parque.',text:'Ana pasea por el parque cada tarde.',options:[],explanation:'El texto menciona el parque.',rubric:'Identifica el lugar del paseo.'};
  const other={id:'numeric-3',type:'numeric',activityGroup:3,prompt:'Calcula 2 + 2.',answer:'4',options:[],explanation:'Suma dos y dos.',unit:'',calculation:'2+2'};
  const material={id:'quality-question-material',title:'Operaciones y comprensión',subject:'Matemáticas',studentId:'',kind:'Actividad interactiva',body:'',activity:{version:1,context:{course:'3.º ESO',subject:'Matemáticas',topic:'Operaciones',extent:'short'},questions:[quiz,reading,other]}};
  await page.evaluate(m=>{
   demo=false;window.qualityMaterial=m;window.regenRequests=[];window.savedStates=[];window.failNext=false;
   const oldApi=api;
   api=async(url,body)=>{
    if(url==='/api/state'){savedStates.push(body);return{}}
    if(url==='/api/profesor/generation/start'){
     regenRequests.push(JSON.parse(JSON.stringify(body)));await new Promise(resolve=>setTimeout(resolve,120));
     if(failNext){failNext=false;throw Error('Límite temporal de IA. No se han descontado créditos.')}
     const q=body.regenerate.question;
     if(q.type==='reading')return{status:'completed',result:{questions:[{...q,prompt:'¿Con qué frecuencia pasea Ana?',answer:'Cada tarde.',explanation:'Cada tarde indica la frecuencia.'}]}};
     return{status:'completed',result:{questions:[{...q,prompt:'¿Cuánto es 4 × 3?',options:['12','43','7'],explanation:'Cuatro grupos de tres dan doce.',optionFeedback:[{option:'12',explanation:'Cuatro grupos de tres suman doce.'},{option:'43',explanation:'Unir las cifras no calcula el producto.'},{option:'7',explanation:'Has sumado los factores; aquí multiplicas.'}]}]}};
    }
    return oldApi(url,body);
   };
   editActivity(m);
  },material);
  await page.locator('#q-0').waitFor();
  async function actionsVisible(){const bounds=await page.locator('#editorNext:visible, #useDraft:visible').first().boundingBox();assert.ok(bounds.y+ bounds.height <= page.viewportSize().height,'Editor navigation stays visible');}
  await actionsVisible();
  await page.locator('.question-feedback-editor').first().locator('summary').click();
  assert.equal(await page.locator('#feedbackField-0-0').inputValue(),quiz.optionFeedback[0].explanation);
  // Unsaved edits to other questions must survive a single-question replacement.
  await page.locator('#q-2').evaluate(el=>{el.value='Calcula 6 + 1.';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.locator('#a-2').evaluate(el=>{el.value='7';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.locator('.regenerate-question').first().locator('summary').click();
  await page.locator('#regenerateInstructions-0').fill('Otro ejemplo con mejores distractores.');
  await page.locator('[data-regenerate="0"]').click();
  await page.waitForFunction(()=>document.getElementById('q-0').value==='¿Cuánto es 4 × 3?');
  assert.equal(await page.locator('#q-2').inputValue(),'Calcula 6 + 1.');
  assert.equal(await page.locator('#a-2').inputValue(),'7');
  assert.equal(await page.locator('.activity-edit-block:visible').count(),1);
  assert.deepEqual(await page.locator('#edit-question-0 .structured-row input').evaluateAll(els=>els.map(el=>el.value)),['12','43','7']);
  assert.match(await page.locator('#feedbackField-0-1').inputValue(),/Unir las cifras/);
  const first=await page.evaluate(()=>regenRequests[0]);
  assert.equal(first.regenerate.question.id,'quiz-1');assert.equal(first.regenerate.instructions,'Otro ejemplo con mejores distractores.');
  assert.equal(await page.evaluate(()=>state.library.some(m=>m.id===qualityMaterial.id)),false,'Regeneration does not silently save');
  await page.screenshot({path:'tools/profesor-question-quality-editor.png'});
  await actionsVisible();
  await page.locator('[data-undo-regenerate="0"]').click();
  assert.equal(await page.locator('#q-0').inputValue(),quiz.prompt);
  assert.equal(await page.locator('#feedbackField-0-0').inputValue(),quiz.optionFeedback[0].explanation);
  // A failed request preserves edits and reuses its id on retry.
  await page.evaluate(()=>failNext=true);
  await page.locator('[data-regenerate="0"]').click();
  await page.locator('.regenerate-question').first().getByRole('status').filter({hasText:'Límite temporal'}).waitFor();
  assert.equal(await page.locator('#q-0').inputValue(),quiz.prompt);
  await page.locator('[data-regenerate="0"]').click();
  await page.waitForFunction(()=>document.getElementById('q-0').value==='¿Cuánto es 4 × 3?');
  assert.equal(await page.evaluate(()=>regenRequests[1].request_id),await page.evaluate(()=>regenRequests[2].request_id));
  await page.locator('#editorNext').click();
  await page.locator('#edit-question-1 .regenerate-question summary').click();
  await page.locator('[data-regenerate="1"]').click();
  await page.waitForFunction(()=>document.getElementById('q-1').value==='¿Con qué frecuencia pasea Ana?');
  assert.equal(await page.locator('#text-1').inputValue(),reading.text);
  // Confirm edits to a feedback field are saved, not overwritten by preview changes.
  await page.locator('#feedbackField-0-2').evaluate(el=>{el.value='Suma y producto son operaciones diferentes.';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.locator('#editorNext').click();
  await page.getByRole('button',{name:'Guardar y cerrar',exact:true}).click();
  await page.locator('#dialog').waitFor({state:'hidden'});
  const saved=await page.evaluate(()=>state.library.find(m=>m.id===qualityMaterial.id));
  assert.equal(saved.activity.questions.length,3);assert.equal(saved.activity.questions[0].id,'quiz-1');
  assert.equal(saved.activity.questions[0].optionFeedback[2].explanation,'Suma y producto son operaciones diferentes.');
  assert.equal(saved.activity.questions[1].text,reading.text);assert.equal(saved.activity.questions[2].prompt,'Calcula 6 + 1.');
  await page.evaluate(m=>runActivity(m,''),saved);
  await page.locator('input[name="r-0"][value="7"]').check();
  assert.match(await page.locator('#feedback-0').innerText(),/Suma y producto/);
  await page.locator('input[name="r-0"][value="12"]').check();
  assert.match(await page.locator('#feedback-0').innerText(),/Cuatro grupos de tres/);
  await page.locator('#dialog > .row [data-action="close"]').click();
  const cloze={...material,id:'quality-cloze',activity:{version:1,questions:[{id:'cloze-1',type:'multigaps',prompt:'Ayer ___ al parque. Siempre ___ allí.',options:['fui','jugaba'],answer:'fui | jugaba',explanation:'Contrasta hechos y hábitos.',itemExplanations:['Ayer sitúa un hecho terminado.','Siempre presenta una costumbre.']}],context:{}}};
  await page.setViewportSize({width:390,height:650});
  await page.evaluate(m=>runActivity(m,''),cloze);
  await page.locator('[data-multi-gap="0"]').fill('fui');await page.locator('[data-multi-gap="0"]').press('Enter');
  assert.match(await page.locator('#feedback-0').innerText(),/Ayer sitúa/);
  await page.locator('[data-multi-gap="1"]').fill('jugó');await page.locator('[data-multi-gap="1"]').press('Enter');
  assert.match(await page.locator('#feedback-0').innerText(),/Siempre presenta/);
  const footer=await page.locator('button[type="submit"]:visible').boundingBox();assert.ok(footer.y+footer.height<=650);
  await page.screenshot({path:'tools/profesor-question-quality-mobile.png'});
  await page.locator('#dialog > .row [data-action="close"]').click();
  await page.evaluate(m=>editActivity(m),saved);
  await page.locator('#edit-question-0 .regenerate-question summary').click();
  await actionsVisible();
  await page.screenshot({path:'tools/profesor-question-quality-editor-mobile.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS per-option/gap reasons, individual regeneration, unchanged siblings/shared reading, undo, retry id, saved metadata and mobile');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
