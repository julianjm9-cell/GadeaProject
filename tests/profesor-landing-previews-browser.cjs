const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url()),pathname=url.pathname;
   if(pathname==='/auth/profesor/signup-settings')return route.fulfill({json:{enabled:true,plan:'normal',days:30,credits:10}});
   let file;
   if(pathname==='/profesor')file='marketing/app_landings_demo/profesor-particular.html';
   else if(pathname.startsWith('/assets/brand/'))file='marketing/app_landings_demo'+pathname;
   else if(pathname.startsWith('/assets/games/'))file='apps/profesor'+pathname;
   if(file&&fs.existsSync(file))return route.fulfill({body:fs.readFileSync(file),contentType:path.extname(file)==='.webp'?'image/webp':path.extname(file)==='.png'?'image/png':'text/html'});
   return route.fulfill({status:404,body:'Not found'});
  });
  await page.goto('http://profesor.test/profesor');
  assert.equal(await page.getByRole('heading',{name:'Todo para tus clases'}).count(),1);
  assert.equal(await page.getByRole('link',{name:/Entrar con Google/}).getAttribute('href'),'/auth/google/login?next=%2Fprofesor-particular');
  assert.equal(await page.getByRole('link',{name:'Tablón de profesores'}).getAttribute('href'),'/profesor/anuncios');
  assert.equal(await page.getByRole('link',{name:'Anúnciate Gratis'}).getAttribute('href'),'/profesor/anunciar');
  assert.equal(await page.getByRole('link',{name:'Crear cuenta gratis'}).count(),0);
  assert.equal(await page.getByRole('link',{name:'Iniciar sesión'}).count(),0);
  const actionLayout=await page.evaluate(()=>{const top=document.querySelector('.landing-top-actions').getBoundingClientRect(),logo=document.querySelector('.brand').getBoundingClientRect(),links=[...document.querySelectorAll('.landing-top-actions a')].map(element=>element.getBoundingClientRect());return {aboveLogo:top.bottom<=logo.top+2,leftAligned:top.left<innerWidth*.2,linksAligned:Math.abs(links[0].top-links[1].top)<2}});
  assert.deepEqual(actionLayout,{aboveLogo:true,leftAligned:true,linksAligned:true});
  assert.equal(await page.locator('#googleEntry .google-mark path').count(),4);
  assert.match(await page.locator('#googleEntry').evaluate(element=>getComputedStyle(element).backgroundColor),/rgb\(255, 255, 255\)/);
  assert.equal(await page.getByRole('button',{name:/Ver cómo funciona/}).isDisabled(),true);
  await page.waitForFunction(()=>[...document.querySelectorAll('.material-card img')].every(image=>image.complete&&image.naturalWidth>0));
  const desktopLayout=await page.evaluate(()=>({screen:document.querySelector('.product-screen').getBoundingClientRect().height,tabs:document.querySelector('.feature-tabs').getBoundingClientRect().top+scrollY}));
  assert.equal(await page.getByRole('tab',{name:/Alumnos/}).getAttribute('aria-selected'),'true');
  await page.screenshot({path:'tools/profesor-landing-new-desktop.png',fullPage:true});
  for(const [tab,panel,text] of [['Temario','preview-temario','Números enteros y racionales'],['Materiales','preview-materiales','Archivo subido por el profesor.'],['Alumnos','preview-alumnos','Próximas clases']]){
   await page.getByRole('tab',{name:new RegExp(tab)}).click();
   const switchedLayout=await page.evaluate(()=>({screen:document.querySelector('.product-screen').getBoundingClientRect().height,tabs:document.querySelector('.feature-tabs').getBoundingClientRect().top+scrollY}));
   assert.ok(Math.abs(switchedLayout.screen-desktopLayout.screen)<1&&Math.abs(switchedLayout.tabs-desktopLayout.tabs)<1,`${tab} keeps preview and tabs fixed`);
   assert.equal(await page.locator('#'+panel).isVisible(),true);
   assert.match(await page.locator('#'+panel).innerText(),new RegExp(text));
   assert.equal(await page.getByRole('tab',{name:new RegExp(tab)}).getAttribute('aria-selected'),'true');
   assert.equal(await page.locator('.feature-tabs').evaluate(element=>element.getBoundingClientRect().bottom<=innerHeight),true,`${tab} controls fit without scrolling`);
  }
  await page.getByRole('tab',{name:/Materiales/}).click();
  await page.waitForTimeout(250);
  await page.screenshot({path:'tools/profesor-landing-new-materiales.png',fullPage:true});
  for(const viewport of [{width:1366,height:768},{width:1280,height:720}]){
   await page.setViewportSize(viewport);
   const fixedTabs=await page.locator('.feature-tabs').evaluate(element=>element.getBoundingClientRect().top+scrollY);
   for(const tab of ['Temario','Materiales']){
    await page.getByRole('tab',{name:new RegExp(tab)}).click();
    assert.ok(Math.abs(await page.locator('.feature-tabs').evaluate(element=>element.getBoundingClientRect().top+scrollY)-fixedTabs)<1,`${tab} does not move controls at ${viewport.width}`);
    assert.equal(await page.locator('.feature-tabs').evaluate(element=>element.getBoundingClientRect().bottom<=innerHeight),true,`${tab} controls fit at ${viewport.width}x${viewport.height}`);
   }
  }
  for(const width of [900,390,320]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`horizontal overflow at ${width}px`);
   const fixed=await page.evaluate(()=>({height:document.querySelector('.product-screen').getBoundingClientRect().height,tabs:document.querySelector('.feature-tabs').getBoundingClientRect().top+scrollY}));
   for(const tab of ['Alumnos','Temario','Materiales']){
    await page.getByRole('tab',{name:new RegExp(tab)}).click();
    const dimensions=await page.evaluate(()=>({height:document.querySelector('.product-screen').getBoundingClientRect().height,tabs:document.querySelector('.feature-tabs').getBoundingClientRect().top+scrollY}));
    assert.ok(Math.abs(dimensions.height-fixed.height)<1&&Math.abs(dimensions.tabs-fixed.tabs)<1,`${tab} controls stay fixed at ${width}px`);
   }
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('tab',{name:/Temario/}).click();
  await page.screenshot({path:'tools/profesor-landing-new-mobile.png',fullPage:true});
  await page.getByRole('tab',{name:/Materiales/}).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab',{name:/Alumnos/}).getAttribute('aria-selected'),'true');
  assert.deepEqual(errors,[]);
  console.log('PASS direct Google entry, top board links, compact previews, disabled video, artwork and responsive layout');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
