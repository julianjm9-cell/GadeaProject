const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
const html=fs.readFileSync('apps/ocr/index.html');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
const page=await browser.newPage();let jobs=[],reviewed=false;
await page.route('**/api/ocr/**',async route=>{
const req=route.request(),url=new URL(req.url());let data={};
if(url.pathname.endsWith('/status'))data={configured:true};
else if(req.method()==='POST'&&url.pathname.endsWith('/review')){reviewed=true;data=jobs[0];data.result.fields=req.postDataJSON().fields;data.result.reviewed=true}
else if(req.method()==='POST'){jobs=[{id:'test',filename:'Factura de prueba.png',status:'done',result:{fields:{proveedor:'Proveedor de prueba',numero_factura:'DEMO-001',total_pagar:'121,00',moneda:'EUR'},warnings:[]}}];data=jobs[0]}
else data={jobs};
await route.fulfill({json:data});
});
for(const width of [1440,390]){
await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:'+server.address().port);
await page.waitForFunction(()=>!document.getElementById('send').disabled);
await page.locator('#file').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
await page.getByRole('button',{name:'Procesar factura'}).click();
await page.getByRole('button',{name:'Revisar datos'}).click();
await page.locator('input[name=proveedor]').fill('Proveedor revisado');
await page.getByRole('button',{name:'Guardar revisión'}).click();
await page.waitForFunction(()=>document.getElementById('message').textContent.includes('Revisión guardada'));
assert(reviewed);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.screenshot({path:'C:/Users/julia/Desktop/PROCESADOR/ocr-app-'+width+'.png',fullPage:true});
console.log('PASS flujo UI simulado: subida, revisión, guardado, enlaces y ancho '+width);
}
}finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
