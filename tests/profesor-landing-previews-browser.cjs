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
   else if(pathname==='/profesor/juegos-interactivos')file='marketing/app_landings_demo/profesor-juegos-interactivos.html';
   else if(pathname==='/profesor/seo.css')file='marketing/app_landings_demo/profesor-seo.css';
   else if(pathname.startsWith('/assets/brand/')||pathname.startsWith('/assets/landing/'))file='marketing/app_landings_demo'+pathname;
   else if(pathname.startsWith('/assets/games/'))file='apps/profesor'+pathname;
   if(file&&fs.existsSync(file)){
    const contentType=path.extname(file)==='.webp'?'image/webp':path.extname(file)==='.png'?'image/png':path.extname(file)==='.svg'?'image/svg+xml':path.extname(file)==='.css'?'text/css':'text/html';
    return route.fulfill({body:fs.readFileSync(file),contentType});
   }
   return route.fulfill({status:404,body:'Not found'});
  });
  await page.goto('http://profesor.test/profesor');
  assert.equal(await page.getByRole('heading',{level:1,name:/PREPARA TUS CLASES/}).count(),1);
  assert.equal(await page.locator('.site-header .header-entry').count(),0);
  assert.equal(await page.locator('#googleEntry').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(255, 255, 255)');
  assert.deepEqual(await page.locator('#googleEntry .google-mark path').evaluateAll(paths=>paths.map(path=>path.getAttribute('fill'))),['#4285F4','#34A853','#FBBC05','#EA4335']);
  assert.equal(await page.getByRole('link',{name:'Entrar con Google'}).getAttribute('href'),'/auth/google/login?next=%2Fprofesor-particular');
  assert.equal(await page.getByRole('link',{name:/Entrar con código/}).getAttribute('href'),'/profesor/alumno');
  assert.equal(await page.getByRole('link',{name:'Instagram de Profesor Particular'}).getAttribute('href'),'https://www.instagram.com/profesorparticularapp/');
  assert.equal(await page.getByRole('link',{name:/Ver cómo funciona/}).count(),0);
  assert.equal(await page.getByRole('link',{name:/Anúnciate gratis/}).getAttribute('href'),'/profesor/anunciar');
  assert.equal(await page.locator('.quick-link').count(),3);
  assert.equal(await page.locator('.step').count(),3);
  await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
  assert.equal(await page.locator('.headline-play').evaluate(element=>element.getBoundingClientRect().height<=getComputedStyle(element).lineHeight.replace('px','')*1.1),true,'headline is one line on desktop');
  await page.screenshot({path:'tools/profesor-landing-new-desktop.png',fullPage:true});
  for(const [zone,heading,detail] of [['game','Juegos interactivos','La ruta bajo cero'],['temario','Temario para tus clases','Bachillerato'],['alumnos','Alumnos y clases','Calendario']]){
   await page.mouse.move(10,10);
   await page.locator(`[data-hero-zone="${zone}"]`).hover();
   assert.equal(await page.locator('#heroPopover').isVisible(),true,`${zone} popover opens`);
   assert.equal(await page.locator(`[data-hero-panel="${zone}"] h2`).innerText(),heading);
   assert.match(await page.locator(`[data-hero-panel="${zone}"]`).innerText(),new RegExp(detail));
   if(zone==='game')await page.locator('.hero-art').screenshot({path:'tools/profesor-landing-game-popover.png'});
  }
  await page.mouse.move(10,10);
  assert.equal(await page.locator('#heroPopover').isVisible(),false);
  for(const width of [1280,900,390,320]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`horizontal overflow at ${width}px`);
   assert.equal(await page.locator('.hero-art img').isVisible(),true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-hero-zone="game"]').click();
  assert.equal(await page.locator('#heroPopover').isVisible(),true,'mobile tap opens popover');
  await page.locator('.popover-close').click();
  assert.equal(await page.locator('#heroPopover').isVisible(),false,'mobile close works');
  await page.screenshot({path:'tools/profesor-landing-new-mobile.png',fullPage:true});
  await page.getByText('¿Qué puedo hacer con Profesor Particular?').click();
  assert.equal(await page.locator('.faq details').first().getAttribute('open'),'');
  await page.goto('http://profesor.test/profesor/juegos-interactivos');
  assert.equal(await page.locator('.catalog-card').count(),61);
  assert.equal(await page.locator('.exercise-card').count(),14);
  for(const source of await page.locator('.catalog-card img').evaluateAll(images=>images.map(image=>image.getAttribute('src')))){
   assert.ok(fs.existsSync('apps/profesor'+source),`missing catalog image ${source}`);
  }
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'catalog mobile horizontal overflow');
  assert.deepEqual(errors,[]);
  console.log('PASS Profesor Particular landing: links, imagery, FAQ and responsive layout');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
