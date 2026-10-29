const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/auth/profesor/signup-settings')return route.fulfill({json:{enabled:true,plan:'normal',days:30,credits:10}});
   let file;
   if(pathname==='/profesor')file='marketing/app_landings_demo/profesor-particular.html';
   else if(pathname.startsWith('/assets/brand/')||pathname.startsWith('/assets/landing/'))file='marketing/app_landings_demo'+pathname;
   else if(pathname.startsWith('/assets/games/'))file='apps/profesor'+pathname;
   if(file&&fs.existsSync(file)){
    const contentType=path.extname(file)==='.webp'?'image/webp':path.extname(file)==='.png'?'image/png':path.extname(file)==='.svg'?'image/svg+xml':'text/html';
    return route.fulfill({body:fs.readFileSync(file),contentType});
   }
   return route.fulfill({status:404,body:'Not found'});
  });
  await page.goto('http://profesor.test/profesor');
  assert.equal(await page.getByRole('heading',{level:1,name:/Prepara tus clases/}).count(),1);
  assert.equal(await page.getByRole('link',{name:'Entrar con Google'}).getAttribute('href'),'/auth/google/login?next=%2Fprofesor-particular');
  assert.equal(await page.getByRole('link',{name:/Entrar con código/}).getAttribute('href'),'/profesor/alumno');
  assert.equal(await page.getByRole('link',{name:/Ver cómo funciona/}).getAttribute('href'),'https://www.instagram.com/profesorparticularapp/');
  assert.equal(await page.getByRole('link',{name:/Anúnciate gratis/}).getAttribute('href'),'/profesor/anunciar');
  assert.equal(await page.locator('.quick-link').count(),3);
  assert.equal(await page.locator('.step').count(),3);
  await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
  await page.screenshot({path:'tools/profesor-landing-new-desktop.png',fullPage:true});
  for(const width of [1280,900,390,320]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`horizontal overflow at ${width}px`);
   assert.equal(await page.locator('.hero-art img').isVisible(),true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'tools/profesor-landing-new-mobile.png',fullPage:true});
  await page.getByText('¿Qué puedo hacer con Profesor Particular?').click();
  assert.equal(await page.locator('.faq details').first().getAttribute('open'),'');
  assert.deepEqual(errors,[]);
  console.log('PASS Profesor Particular landing: links, imagery, FAQ and responsive layout');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
