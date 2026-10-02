const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href+'#temario');
    await page.locator('.temario-controls').waitFor();

    assert.equal(await page.evaluate(()=>fresh().teacherProfile.plan),'normal');
    assert.equal(await page.evaluate(()=>{const previous=state;state={...fresh(),version:2,teacherProfile:undefined};normalizeTeacherState();const plan=state.teacherProfile.plan;state=previous;return plan}),'premium');
    await page.evaluate(()=>{state=fresh();normalizeTeacherState();render()});
    assert.match(await page.locator('.account-plan').innerText(),/Normal/);
    assert.equal(await page.locator('.temario-topic').count()>0,true);
    assert.equal(await page.locator('.temario-preview-explanation').count(),0);
    assert.equal(await page.locator('.temario-example').count(),0);
    assert.match(await page.locator('.temario-locked-preview').innerText(),/Explicación del concepto/);
    await page.getByRole('button',{name:/Ver tema completo/}).click();
    assert.equal(await page.locator('#dialog[open]').count(),0);
    await page.getByRole('button',{name:'Usar en material'}).click();
    assert.equal(await page.locator('#temarioOwner').count(),1);
    await page.locator('#dialog .close').click();

    await page.locator('.account-plan').click();
    await page.locator('input[name="plan"][value="premium"]').check();
    await page.getByRole('button',{name:'Guardar tipo de cuenta'}).click();
    assert.match(await page.locator('.account-plan').innerText(),/Premium/);
    await page.evaluate(()=>saveQueue);
    await page.reload();
    await page.locator('.temario-controls').waitFor();
    assert.match(await page.locator('.account-plan').innerText(),/Premium/);
    assert.equal(await page.locator('.temario-preview-explanation').count(),1);
    await page.getByRole('button',{name:'Ver tema'}).click();
    assert.equal(await page.locator('.temario-lesson').count(),1);
    await page.locator('#dialog .close').click();

    await page.locator('.account-plan').click();
    await page.locator('input[name="plan"][value="normal"]').check();
    await page.getByRole('button',{name:'Guardar tipo de cuenta'}).click();
    await page.evaluate(()=>openWorkshop({course:'3.º ESO',subject:'Matemáticas',topic:'Ecuaciones',visualquiz:2}));
    assert.match(await page.locator('.photo-manual summary').innerText(),/Premium/);
    assert.equal(await page.locator('#count-visualquiz').inputValue(),'0');
    assert.equal(await page.locator('[data-exercise="visualquiz"]').isDisabled(),true);
    await page.evaluate(()=>{$('count-visualquiz').value='1';$('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});
    assert.match(await page.locator('#notice').innerText(),/requieren una cuenta Premium/);
    assert.deepEqual(errors,[]);
    console.log('PASS account plans: normal scheme and image lock, premium details, dashboard switching');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
