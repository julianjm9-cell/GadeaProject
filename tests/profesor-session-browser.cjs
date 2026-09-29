const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
  const result=await page.evaluate(async()=>{
   let requests=0,refreshes=0;
   window.fetch=async url=>{
    if(String(url).startsWith('/auth/refresh')){refreshes++;await new Promise(resolve=>setTimeout(resolve,20));return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}})}
    requests++;
    return new Response(JSON.stringify(requests<=2?{detail:'No autenticado.'}:{questions:[]}),{status:requests<=2?401:200,headers:{'Content-Type':'application/json'}})
   };
   const values=await Promise.all([api('/api/profesor/generate',{topic:'Bosque'}),api('/api/profesor/generate',{topic:'Mar'} )]);
   return {requests,refreshes,count:values.length};
  });
  assert.deepEqual(result,{requests:4,refreshes:1,count:2});
  const expired=await page.evaluate(async()=>{
   window.fetch=async url=>new Response(JSON.stringify({detail:'No autenticado.'}),{status:401,headers:{'Content-Type':'application/json'}});
   try{await api('/api/profesor/generate',{topic:'Bosque'});return ''}catch(error){return error.message}
  });
  assert.match(expired,/sesión ha caducado/);
  assert.deepEqual(errors,[]);
  console.log('PASS session refresh: one renewal for concurrent requests and clear error when renewal fails');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
