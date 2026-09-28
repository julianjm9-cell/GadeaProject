const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const base=process.env.PRODUCT_TEST_URL||'http://127.0.0.1:8893';
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
 await page.goto(base+'/');
 assert.deepEqual(await page.locator('.app-card h2').allTextContents(),['ESO Adultos','Profesor Particular','Diplomator','Prueba accesouniversidad +25','Título de inglés']);
 assert.equal(await page.locator('.developing a, a.developing').count(),0);
 assert.equal(await page.locator('.development-label').count(),2);
 assert.match(await page.locator('.project-mark img').getAttribute('src'),/hazlotu-logo/);
 for(const product of [{base:'/e25',target:'/eso-adultos',name:'ESO Adultos'},{base:'/profesor',target:'/profesor-particular',name:'Profesor Particular'}]){
  await context.clearCookies();
  await page.goto(base+product.base);
  assert.equal(await page.locator('.allowance,.brand-note,figcaption,.footer-contact').count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));
  await page.getByRole('link',{name:'Crear cuenta gratis'}).click();
  await page.waitForURL('**'+product.base+'/register');
  await page.getByRole('button',{name:'Crear cuenta y empezar'}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));
  const email=`access-${product.base.slice(1)}-${Date.now()}@example.com`,password='PruebaLocal123!';
  await page.getByLabel('Tu nombre').fill('Nueva cuenta');await page.getByLabel('Usuario o email').fill(email);
  await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByLabel('Repite la contraseña').fill('Diferente123!');
  await page.getByRole('button',{name:'Crear cuenta y empezar'}).click();await page.getByRole('alert').filter({hasText:'Las contraseñas no coinciden'}).waitFor();
  await page.getByRole('button',{name:'Mostrar contraseña'}).click();assert.equal(await page.locator('#password').getAttribute('type'),'text');
  await page.getByLabel('Repite la contraseña').fill(password);await page.getByRole('button',{name:'Crear cuenta y empezar'}).click();await page.waitForURL('**'+product.target+'**');
  const me=await page.request.get(base+'/auth/me');assert.equal(me.status(),200);
  await context.clearCookies();await page.goto(base+product.base+'/login');
  await page.getByLabel('Usuario o email').fill(email);await page.getByLabel('Contraseña',{exact:true}).fill('Incorrecta123');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.locator('#error').filter({hasText:/./}).waitFor();
  await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('**'+product.target+'**');
  await page.goto(base+'/login?next='+product.target);await page.getByRole('heading',{name:'Iniciar sesión',exact:true}).waitFor();assert((await page.locator('#brand').innerText()).includes(product.name));
  await page.goto(base+product.base+'/login?mode=register');await page.getByRole('heading',{name:'Crear cuenta gratis',exact:true}).waitFor();
 }
 // A disabled signup cannot be submitted; OAuth and expired-session state are still shown correctly.
 await page.route('**/auth/eso/signup-settings',r=>r.fulfill({json:{enabled:false,days:365,credits:100}}));
 await page.goto(base+'/e25/register');await page.getByRole('alert').filter({hasText:/cerrado/}).waitFor();assert(await page.getByRole('button',{name:'Crear cuenta y empezar'}).isDisabled());
 await page.goto(base+'/e25/login?expired=1');await page.getByRole('alert').filter({hasText:/caducado/}).waitFor();assert.equal(await page.getByRole('link',{name:'Crear cuenta gratis',exact:true}).count(),0);
 // Diplomator is login-only even when an old registration query is supplied.
 for(const route of ['/diplomator/login?mode=register','/login?next=/app&mode=register']){
  await page.goto(base+route);await page.getByRole('heading',{name:'Iniciar sesión',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:/Crear cuenta|Google/}).count(),0);
  assert(await page.locator('#signupFields').isHidden());assert(await page.locator('#conditions').isHidden());
 }
 let dipPayload;
 await page.route('**/auth/login',async route=>{dipPayload=route.request().postDataJSON();await route.fulfill({status:401,json:{detail:'Credenciales incorrectas'}})});
 await page.getByLabel('Usuario o email').fill('existing@example.com');await page.getByLabel('Contraseña',{exact:true}).fill('incorrect-password');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByRole('alert').filter({hasText:'Credenciales incorrectas'}).waitFor();
 assert.equal(dipPayload.enroll_eso,false);assert.equal(dipPayload.enroll_profesor,false);assert.equal(dipPayload.identifier,'existing@example.com');
 console.log('OK: portada, landings, cuatro accesos, registros y logins reales, errores, contraseña, rutas antiguas y registro cerrado.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
