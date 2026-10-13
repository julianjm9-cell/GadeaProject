const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await page.evaluate(()=>{
      accountEmail='test@example.com';demo=false;
      window.__generatorAttempts=[];
      api=async(path,body)=>{
        if(!path.includes('/generation/start'))throw Error('Ruta inesperada: '+path);
        window.__generatorAttempts.push(body.request_id);
        if(window.__generatorAttempts.length===1)return {status:'failed',error:'La IA no devolvió actividades válidas.',error_status:502,completed:1,total:2};
        return {status:'completed',result:{questions:[
          {type:'gaps',prompt:'Ana ___ a clase.',answer:'va',options:[],explanation:'El verbo expresa la acción.'},
          {type:'gaps',prompt:'Luis ___ en casa.',answer:'lee',options:[],explanation:'El verbo expresa la acción.'}
        ]}};
      };
      openWorkshop({course:'3.º ESO',subject:'Lengua',topic:'Sintaxis',gaps:1,activitySizes:{gaps:2}});
    });
    await page.locator('#workshopContinue').click();
    assert.equal(await page.locator('#workshopRetryNotice').isVisible(),true);
    assert.match(await page.locator('#workshopRetryNotice').innerText(),/1 de 2 elementos válidos/);
    await page.locator('#dialog .close').click();
    await page.evaluate(()=>openWorkshop());
    assert.equal(await page.locator('#workshopRetryNotice').isVisible(),true);
    await page.locator('#workshopRetryButton').click();
    await page.locator('#activityTitle').waitFor();
    const state=await page.evaluate(()=>({attempts:window.__generatorAttempts,saved:sessionStorage.getItem('profesor.generatorRetry')}));
    assert.equal(state.attempts.length,2);
    assert.equal(state.attempts[0],state.attempts[1],'retry keeps the same idempotency key');
    assert.equal(state.saved,null);
    assert.deepEqual(errors,[]);
    console.log('PASS generator 502 recovery, saved progress notice and same-attempt retry');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
