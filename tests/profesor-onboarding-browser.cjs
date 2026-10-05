const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  let saved={teacherProfile:{plan:'normal'}},name='Profesor nuevo',passwordRequest;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url()),p=url.pathname;
   const json=data=>route.fulfill({json:data});
   if(p==='/api/state'){if(route.request().method()==='POST')saved=route.request().postDataJSON();return json(saved)}
   if(p==='/auth/me')return json({user:{full_name:name,email:'nuevo@example.com'}});
   if(p==='/api/profile'){name=route.request().postDataJSON().name;return json({ok:true})}
   if(p==='/auth/change-password'){passwordRequest=route.request().postDataJSON();return json({ok:true})}
   if(p==='/auth/google/status')return json({enabled:false});
   if(p==='/auth/profesor/signup-settings')return json({enabled:true,days:30,credits:10});
   let file;
   if(p==='/profesor-particular')file='apps/profesor/index.html';
   else if(p==='/profesor')file='marketing/app_landings_demo/profesor-particular.html';
   else if(p==='/profesor/login')file='backend/app/static/product-access.html';
   else if(p.startsWith('/assets/landing/'))file='marketing/app_landings_demo'+p;
   else if(p.startsWith('/assets/'))file='apps/profesor'+p;
   else if(p.endsWith('.js'))file='apps/profesor'+p;
   if(file&&fs.existsSync(file))return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.png')?'image/png':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
   return route.fulfill({status:404,body:'Not found'});
  });
  await page.goto('http://profesor.test/profesor-particular#inicio');
  await page.locator('.home-nav').waitFor();
  assert.deepEqual(await page.evaluate(()=>[state.students.length,state.library.length,state.sessions.length,state.tasks.length]),[0,0,0,0]);
  assert.equal(await page.locator('.notification-button').count(),0);
  await page.getByRole('button',{name:'Tipo de cuenta: Normal'}).click();
  assert.match(await page.locator('#dialog').innerText(),/gratuito.*educamesuite@gmail.com/s);
  await page.locator('#dialog .close').click();
  await page.locator('.account-dropdown summary').click();
  await page.getByRole('button',{name:'Cambiar nombre visible'}).click();
  await page.getByLabel('Nombre visible',{exact:true}).fill('Julia Docente');
  await page.getByRole('button',{name:'Guardar nombre'}).click();
  await page.waitForFunction(()=>accountName==='Julia Docente');
  await page.locator('.account-dropdown summary').click();
  await page.getByRole('button',{name:'Cambiar contraseña',exact:true}).click();
  await page.getByLabel('Contraseña actual').fill('actual123');
  await page.getByLabel('Nueva contraseña',{exact:true}).fill('NuevaClave123');
  await page.getByLabel('Repite la nueva contraseña').fill('NuevaClave123');
  await page.getByRole('button',{name:'Guardar contraseña'}).click();
  await page.locator('#dialog').waitFor({state:'hidden'});
  assert.deepEqual(passwordRequest,{current_password:'actual123',new_password:'NuevaClave123'});
  await page.reload();await page.locator('.home-nav').waitFor();
  assert.equal(await page.evaluate(()=>state.library.length),0);
  for(const pathname of ['/profesor','/profesor/login'])for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});await page.goto('http://profesor.test'+pathname);
   await page.locator('a[href="mailto:educamesuite@gmail.com"]').waitFor();
   assert.equal(await page.locator('a[href*="instagram.com/profesorparticularapp"]').count(),1);
   await page.locator('.laptop-screen img').evaluate(img=>img.decode());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
   await page.screenshot({path:path.join('tools',`profesor-public-${pathname.endsWith('login')?'login':'landing'}-${width}.png`),fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: empty new workspace, account menu, Premium contact, public mockups and mobile');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
