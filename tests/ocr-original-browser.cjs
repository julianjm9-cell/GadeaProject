const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http=require('node:http');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('apps/ocr/index.html');
const server=http.createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/facturas'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html)}
 if(!path.startsWith('/facturas/legacy/api/')){res.writeHead(404);return res.end()}
 const endpoint=path.slice('/facturas/legacy/api/'.length);
 let data={};
 if(endpoint==='auth/me')data={authenticated:true,user:{email:'demo@example.com',name:'Demo',role:'admin',permissions:['view','process','review','manage_workspaces','manage_config']},roles:{admin:{label:'Administrador',permissions:['view','process','review','manage_workspaces','manage_config']}},auth_disabled:false};
 else if(endpoint==='workspaces')data={workspaces:[],paused:{}};
 else if(endpoint==='ollama/status')data={ollama_ok:true,estado:'idle',mensaje:'API externa: gemini',api_externa:true,modelos:[]};
 else if(endpoint==='config')data={api_tipo:'gemini',modelo_externo:'modelo-externo',api_key_existe:true};
 else if(endpoint==='proveedores')data={todos:{},custom:{}};
 else if(endpoint==='facturas/health')data={estado:'idle'};
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const calls=[];page.on('request',r=>{if(r.url().includes('/api/'))calls.push(r.url())});
   await page.goto(`http://127.0.0.1:${server.address().port}/facturas`);
   await page.waitForTimeout(1300);
   assert(calls.length>0);
   assert(calls.every(url=>url.includes('/facturas/legacy/api/')));
   assert.equal(errors.length,0,errors.join('\n'));
   await page.screenshot({path:`C:/Users/julia/Desktop/PROCESADOR/ocr-original-${width}.png`,fullPage:true});
   console.log('PASS Aliot original, API de suite y navegador '+width);
   await page.close();
  }
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
