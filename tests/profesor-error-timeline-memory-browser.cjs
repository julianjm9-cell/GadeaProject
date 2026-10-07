const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    const play=async(question)=>page.evaluate(q=>runActivity({id:'ui-games',title:'Práctica',subject:'Lengua',activity:{questions:[q]}},''),question);
    await play({type:'error',prompt:'Identifica y corrige el error en la siguiente oración: “Tú trajistes el libro.”',answer:'Tú trajiste el libro.',errorSegment:'trajistes',correctedSegment:'trajiste',options:[]});
    assert.equal(await page.locator('[data-error-word]').count(),4);
    assert.equal(await page.getByRole('button',{name:'Identifica',exact:true}).count(),0);
    await page.getByRole('button',{name:'Comprobar',exact:true}).click();
    assert.match(await page.locator('#feedback-0').innerText(),/Selecciona el error/);
    await page.locator('#r-0').fill('trajiste');
    await page.getByRole('button',{name:'Comprobar',exact:true}).click();
    assert.match(await page.locator('#feedback-0').innerText(),/Selecciona el error/);
    await page.getByRole('button',{name:'trajistes',exact:true}).click();
    await page.getByRole('button',{name:'Comprobar',exact:true}).click();
    assert.equal(await page.locator('[data-error-word].answer-right').count(),1);
    assert.equal(await page.locator('#r-0.answer-right').count(),1);
    await page.locator('[data-action="close"]:visible').last().click();

    await play({type:'timeline',prompt:'Ordena estos acontecimientos.',answer:'1901, 1910, 1920',options:['1910 – Primera edición','1901 – Fundación','1920 – Ampliación']});
    const timeline=page.locator('#order-0');
    assert.doesNotMatch(await timeline.innerText(),/1901|1910|1920/);
    for(const [target,label] of ['Fundación','Primera edición','Ampliación'].entries()){
      let position=await timeline.locator('.order-row').evaluateAll((rows,name)=>rows.findIndex(row=>row.textContent.includes(name)),label);
      while(position>target){await timeline.locator(`[data-pos="${position}"][data-move="-1"]`).click();position--}
    }
    await timeline.locator('[data-confirm-order]').click();
    assert.match(await timeline.innerText(),/1901|1910|1920/);
    assert.equal(await timeline.locator('.order-row.answer-right').count(),3);
    await page.locator('[data-action="close"]:visible').last().click();

    await page.evaluate(()=>{const original=Math.random;Math.random=()=>.5;try{runActivity({id:'ui-memory',title:'Memory',subject:'Lengua',activity:{questions:[{type:'memory',prompt:'Empareja.',answer:'Completado',options:['Gato | Cat','Perro | Dog']}]}},'')}finally{Math.random=original}});
    for(const [a,b] of [[0,1],[2,3]]){await page.locator(`#memory-0 [data-card="${a}"]`).click();await page.locator(`#memory-0 [data-card="${b}"]`).click()}
    const colors=await page.locator('#memory-0 .matched').evaluateAll(cards=>cards.map(card=>getComputedStyle(card).backgroundColor));
    assert.equal(new Set(colors).size,1);
    assert.deepEqual(errors,[]);
    console.log('PASS error selection and correction, timeline hidden dates and row feedback, uniform Memory matches');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
