const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const pages={
  '/ocr-facturas':['marketing/app_landings_demo/ocr-facturas.html','text/html'],
  '/facturas/login':['backend/app/static/product-access.html','text/html'],
  '/assets/brand/facturas.svg':['marketing/app_landings_demo/assets/brand/facturas.svg','image/svg+xml'],
  '/assets/landing/facturas-dashboard.png':['marketing/app_landings_demo/assets/landing/facturas-dashboard.png','image/png'],
  '/assets/landing/facturas-mobile.png':['marketing/app_landings_demo/assets/landing/facturas-mobile.png','image/png'],
};
const server=http.createServer((req,res)=>{
  const key=new URL(req.url,'http://localhost').pathname;
  if(key==='/auth/login'){
    res.setHeader('content-type','application/json');
    return res.end(JSON.stringify({ok:true}));
  }
  const file=pages[key];if(!file){res.writeHead(404);return res.end()}
  res.setHeader('content-type',file[1]);res.end(fs.readFileSync(path.join(root,file[0])));
});
(async()=>{
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const origin=`http://127.0.0.1:${server.address().port}`;
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
      const page=await browser.newPage({viewport});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin+'/ocr-facturas');
      assert.equal(await page.title(),'FACTURAS | Procesa, revisa y organiza tus facturas');
      assert.equal(await page.locator('a.cta').getAttribute('href'),'/facturas/login');
      assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0)),true);
      if(viewport.width>900)assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true,'landing has desktop scroll');
      if(process.env.FACTURAS_SCREENSHOT&&viewport.width>900)await page.screenshot({path:process.env.FACTURAS_SCREENSHOT});
      await page.goto(origin+'/facturas/login');
      assert.match(await page.title(),/^FACTURAS/);
      assert.equal(await page.locator('#switch').isHidden(),true);
      assert.equal(await page.locator('#signupFields').isHidden(),true);
      assert.equal(await page.locator('#back').getAttribute('href'),'/ocr-facturas');
      assert.equal(await page.locator('.devices img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0)),true);
      if(viewport.width>900)assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true,'login has desktop scroll');
      if(process.env.FACTURAS_LOGIN_SCREENSHOT&&viewport.width>900)await page.screenshot({path:process.env.FACTURAS_LOGIN_SCREENSHOT});
      assert.equal(errors.length,0,errors.join('\n'));
      await page.close();
    }
    console.log('PASS FACTURAS landing/login desktop and mobile');
  }finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
