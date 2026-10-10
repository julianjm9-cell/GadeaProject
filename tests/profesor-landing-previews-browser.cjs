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
  assert.equal(await page.getByRole('link',{name:/Crear cuenta gratis/}).getAttribute('href'),'/profesor/register');
  assert.equal(await page.getByRole('link',{name:'Tablón de profesores'}).getAttribute('href'),'/profesor/anuncios');
  assert.equal(await page.getByRole('link',{name:'Anúnciate Gratis'}).getAttribute('href'),'/profesor/anunciar');
  assert.equal(await page.getByRole('link',{name:'Iniciar sesión'}).getAttribute('href'),'/profesor/login');
  const actionLayout=await page.evaluate(()=>{const board=document.querySelector('.board-actions').getBoundingClientRect(),account=document.querySelector('.account-actions').getBoundingClientRect(),boardLinks=[...document.querySelectorAll('.board-actions a')].map(element=>element.getBoundingClientRect()),accountLinks=[...document.querySelectorAll('.account-actions a')].map(element=>element.getBoundingClientRect());return {boardAbove:board.top<account.top,boardAligned:Math.abs(boardLinks[0].top-boardLinks[1].top)<2,accountAligned:Math.abs(accountLinks[0].top-accountLinks[1].top)<2}});
  assert.deepEqual(actionLayout,{boardAbove:true,boardAligned:true,accountAligned:true});
  assert.equal(await page.getByRole('button',{name:/Ver cómo funciona/}).isDisabled(),true);
  await page.waitForFunction(()=>[...document.querySelectorAll('.material-card img')].every(image=>image.complete&&image.naturalWidth>0));
  assert.equal(await page.getByRole('tab',{name:/Alumnos/}).getAttribute('aria-selected'),'true');
  await page.screenshot({path:'tools/profesor-landing-new-desktop.png',fullPage:true});
  for(const [tab,panel,text] of [['Temario','preview-temario','Números enteros y racionales'],['Materiales','preview-materiales','Archivo subido por el profesor.'],['Alumnos','preview-alumnos','Próximas clases']]){
   await page.getByRole('tab',{name:new RegExp(tab)}).click();
   assert.equal(await page.locator('#'+panel).isVisible(),true);
   assert.match(await page.locator('#'+panel).innerText(),new RegExp(text));
   assert.equal(await page.getByRole('tab',{name:new RegExp(tab)}).getAttribute('aria-selected'),'true');
  }
  await page.getByRole('tab',{name:/Materiales/}).click();
  await page.waitForTimeout(250);
  await page.screenshot({path:'tools/profesor-landing-new-materiales.png',fullPage:true});
  for(const width of [900,390,320]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`horizontal overflow at ${width}px`);
   await page.getByRole('tab',{name:/Temario/}).click();
   assert.equal(await page.locator('#preview-temario').isVisible(),true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'tools/profesor-landing-new-mobile.png',fullPage:true});
  await page.getByRole('tab',{name:/Materiales/}).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab',{name:/Alumnos/}).getAttribute('aria-selected'),'true');
  assert.deepEqual(errors,[]);
  console.log('PASS public landing previews, current links, disabled video, artwork and responsive layout');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
