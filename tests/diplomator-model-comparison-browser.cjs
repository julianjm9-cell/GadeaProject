const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const html=fs.readFileSync(path.resolve('apps/diplomator/index.html'));
 const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const errors=[];
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  page.on('pageerror',error=>errors.push(error.message));
  let generation=0;
  await page.route('**/api/**',route=>{
   const url=new URL(route.request().url());
   let data={ok:true};
   if(url.pathname==='/api/status')data={ok:true,user:{email:'prueba@local',name:'Laura',license_key:'DIPLO-TEST'},limits:{max_vocab:3,profile_chars:420}};
   if(url.pathname==='/api/state'&&route.request().method()==='GET')data={};
   if(url.pathname==='/api/diplomator/points-models')data={ok:true,models:[{id:'gemini:gemini-3.8-flash',provider:'gemini',model:'gemini-3.8-flash'},{id:'groq:openai/gpt-oss-120b',provider:'groq',model:'openai/gpt-oss-120b'}]};
   if(url.pathname==='/api/chat'){
    const request=route.request().postDataJSON();
    generation++;
    assert.equal(request.purpose,'points');
    assert(request.messages[0].content.includes('TOPIC: "The Marshall Plan"'));
    assert(request.messages[0].content.includes('at most 5 distinct points'));
    assert(!request.messages[0].content.includes('exactly 2 concrete facts'));
    if(generation===1){assert.equal(request.points_model_choice,'gemini:gemini-3.8-flash');assert(request.messages[0].content.includes('Con ejemplos de instituciones'));}
    if(generation===2)assert.equal(request.points_model_choice,'groq:openai/gpt-oss-120b');
    data={ok:true,provider:generation===1?'gemini':'groq',model:generation===1?'gemini-3.8-flash':'openai/gpt-oss-120b',replaced_model:'',fallback_reason:'',content:JSON.stringify({points:[{title:generation===1?'Versión Gemini':'Versión Groq',text:generation===1?'Explicación concreta de Gemini.':'Explicación concreta de Groq.',connection:'Frase de transición innecesaria.',datedInfo:[{date:'1898',text:'1898'}],vocab:[]}]})};
   }
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/app`);
  await page.locator('#pointsModelChoice option').nth(2).waitFor({state:'attached'});
  await page.evaluate(()=>showTab('perfil',document.getElementById('profileHeaderBtn')));
  await page.locator('#pointsModelChoice').selectOption('gemini:gemini-3.8-flash');
  await page.locator('#pointsPrompt').fill('Con ejemplos de instituciones');
  await page.evaluate(async()=>startSessionWithTopic('The Marshall Plan',false));
  await page.evaluate(async()=>generateCurrentSession());
  assert.equal(await page.locator('#aititle-0').inputValue(),'Versión Gemini');
  assert.equal(await page.locator('#pointsModelChoice').inputValue(),'gemini:gemini-3.8-flash');
  assert.equal(await page.locator('#pointsFallbackNotice').isVisible(),false);
  assert.equal(await page.locator('.point-connection').count(),0);
  assert.equal(await page.locator('.point-info').count(),0);
  await page.evaluate(()=>{document.getElementById('pointsModelChoice').value='groq:openai/gpt-oss-120b'});
  await page.evaluate(async()=>generateCurrentSession());
  assert.equal(await page.locator('#pointsVersions button').count(),2);
  await page.locator('#pointsVersions button').first().click();
  assert.equal(await page.locator('#aititle-0').inputValue(),'Versión Gemini');
  assert.equal(await page.evaluate(()=>state.currentSession.versions.length),2);
  await page.evaluate(()=>showTab('perfil'));
  await page.screenshot({path:'tools/diplomator-model-preferences.png'});
  assert.deepEqual(errors,[]);

  const admin=await browser.newPage({viewport:{width:1366,height:850}});
  admin.on('pageerror',error=>errors.push(error.message));
  await admin.goto(pathToFileURL(path.resolve('admin/index.html')).href);
  await admin.evaluate(()=>{
   const caps=[{id:'chat',provider:'groq',model:'openai/gpt-oss-120b',configured:true,inherited:true},{id:'points',provider:'gemini',model:'gemini-3.8-flash',configured:true,inherited:false},{id:'transcribe',provider:'groq',model:'whisper-large-v3-turbo',configured:true,inherited:true}];
   ai={groq_configured:true,openai_configured:false,gemini_configured:true,pixabay_configured:false,capabilities:caps,apps:{DIPLOMATOR:caps},model_choices:{chat:{groq:['openai/gpt-oss-120b'],gemini:['gemini-2.5-flash']},points:{groq:['openai/gpt-oss-120b'],gemini:['gemini-2.5-flash','gemini-3.8-flash'],openai:['gpt-4o-mini']},transcribe:{groq:['whisper-large-v3-turbo'],openai:['whisper-1']}}};
   api=async (url,options)=>{if(url.endsWith('/test-connection')){const provider=JSON.parse(options.body).provider;if(provider==='gemini')return {ok:true,message:'Conexión verificada ahora'};throw Error('Clave rechazada')}return ai};
   setLoginState(true);aiApp='DIPLOMATOR';setView('ai');
  });
  assert.equal(await admin.locator('#aiEditor .model-card').count(),3);
  assert.equal(await admin.getByText('Lectura de imágenes',{exact:true}).count(),0);
  assert.equal(await admin.getByText('Ajustes generales',{exact:false}).count(),0);
  assert.equal(await admin.locator('#geminiKeyStatus').innerText(),'● Sin comprobar');
  await admin.getByRole('button',{name:'Comprobar Gemini'}).click();
  assert.equal(await admin.locator('#geminiKeyStatus').innerText(),'● Funciona');
  await admin.getByRole('button',{name:'Comprobar Groq'}).click();
  assert.equal(await admin.locator('#groqKeyStatus').innerText(),'● Falló la prueba');
  assert.equal(await admin.locator('#groqKeyDetail').innerText(),'Clave rechazada');
  await admin.screenshot({path:'tools/admin-ai-connections.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS Diplomator model comparison, flexible prompt and admin connections');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exit(1)});
