const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const path=require('node:path');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.setContent('<div id="studentWelcome"></div><div id="studentMaterialList"></div><section id="studentMaterials" hidden></section>');
    await page.evaluate(()=>{
      const session={id:'test',title:'Práctica',subject:'Historia',status:'in_progress',revision:1,questions:[
        {type:'timeline',prompt:'Ordena los acontecimientos.',options:['1945-05-08 – Rendición de Alemania','1945-09-02 – Rendición de Japón'],hints:[]},
        {type:'error',prompt:'Corrige: “Tú trajistes el libro.”',hints:[]}
      ],progress:{current_index:0,responses:{},grades:{},parts:{}}};
      window.fetch=async(url,options={})=>{
        const body=options.body?JSON.parse(options.body):null;
        if(body){
          const index=body.question_index;
          if(body.value!=null)session.progress.responses[String(index)]=body.value;
          if(body.action==='draft'){delete session.progress.grades[String(index)];delete session.progress.parts[String(index)]}
          if(body.action==='check'){
            session.progress.grades[String(index)]='correct';
            if(index===0)session.progress.parts['0']={'0':'incorrect','1':'correct'};
          }
          session.revision++;
          return {ok:true,json:async()=>({ok:true,revision:session.revision,status:session.status,feedback:body.action==='check'?'correct':null,session:body.action==='check'&&index===0?structuredClone(session):null})};
        }
        return {ok:true,json:async()=>url.endsWith('/test')?{session:structuredClone(session)}:{sessions:[{id:'test',title:'Práctica',subject:'Historia',count:2,status:'in_progress'}]}};
      };
    });
    await page.addScriptTag({path:path.resolve('apps/profesor/profesor-live.js')});
    await page.locator('.live-stack-row').first().waitFor();
    assert.doesNotMatch(await page.locator('.live-stack').innerText(),/1945|05-08|09-02/);
    await page.getByRole('button',{name:'Comprobar respuesta'}).click();
    assert.match(await page.locator('.live-stack').innerText(),/1945-05-08|1945-09-02/);
    assert.equal(await page.locator('.live-stack-row.correct,.live-stack-row.incorrect').count(),2);
    await page.getByRole('button',{name:'Siguiente →'}).click();
    assert.equal(await page.getByRole('button',{name:'Corrige:',exact:false}).count(),0);
    assert.equal(await page.locator('.live-error-words button').count(),4);
    await page.getByRole('button',{name:'trajistes',exact:true}).click();
    await page.locator('[data-live-field="error-correction"]').fill('trajiste');
    await page.getByRole('button',{name:'Comprobar respuesta'}).click();
    assert.equal(await page.locator('.live-error-words button.correct').count(),1);
    assert.deepEqual(errors,[]);
    console.log('PASS student timeline reveals dates on check and error requires a correction');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
