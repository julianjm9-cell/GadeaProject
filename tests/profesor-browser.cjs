const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:940}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
  await page.getByRole('heading',{name:'Mis alumnos',exact:true}).waitFor();
  await page.screenshot({path:'tools/profesor-home-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'+ Alumno',exact:true}).click();
  await page.getByLabel('Nombre del alumno').fill('Alumno prueba');
  await page.getByLabel('Curso',{exact:true}).selectOption('3.º ESO');
  await page.getByRole('button',{name:'Crear alumno',exact:true}).click();
  await page.getByRole('button',{name:'Progreso',exact:true}).click();
  await page.getByLabel('Estado: Controla los cambios de signo').selectOption('Reforzar');
  await page.getByLabel('Espacio del alumno').getByRole('button',{name:'Clases',exact:true}).click();
  await page.getByRole('button',{name:'+ Nueva clase',exact:true}).click();
  await page.getByLabel('Tema y objetivo de la sesión').fill('Repasar signos');
  await page.getByRole('button',{name:'Añadir a la agenda'}).click();
  await page.getByRole('button',{name:'Preparar',exact:true}).click();
  await page.getByRole('button',{name:'Añadir guion base'}).click();
  await page.getByRole('button',{name:'Guardar preparación'}).click();
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.getByLabel('Notas rápidas').fill('Mejora al comprobar las soluciones.');
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Completar y continuar →'}).click();
  await page.getByRole('button',{name:'Completar y cerrar clase'}).click();
  await page.getByLabel('Próximo foco').fill('Paréntesis');
  await page.getByRole('button',{name:'Finalizar y guardar'}).click();
  await page.getByRole('button',{name:'Resumen',exact:true}).waitFor();
  await page.locator('.home-primary-nav').getByRole('button',{name:'Material'}).click();
  await page.locator('.material-hub-card').filter({has:page.getByRole('heading',{name:'Quiz · Ecuaciones',exact:true})}).getByRole('button',{name:'Asignar',exact:true}).click();
  await page.getByLabel('Alumno',{exact:true}).selectOption({label:'Alumno prueba'});
  await page.getByRole('button',{name:'Asignar actividad'}).click();
  await page.locator('.home-primary-nav').getByRole('button',{name:'Alumnos'}).click();
  await page.getByLabel('Buscar alumno',{exact:true}).fill('Alumno prueba');
  await page.getByRole('button',{name:'Abrir espacio de Alumno prueba'}).click();
  await page.getByRole('button',{name:'Actividades',exact:true}).click();
  await page.getByRole('button',{name:'Abrir actividad'}).click();
  await page.getByLabel('Respuesta del alumno').fill('3');
  await page.getByRole('button',{name:'Registrar entrega'}).click();
  await page.getByRole('button',{name:'Revisar',exact:true}).click();
  await page.getByLabel('Corrección del profesor').fill('Bien resuelto');
  await page.getByRole('button',{name:'Confirmar corrección'}).click();
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('profesor-demo-v1')));
  const s=data.students.find(s=>s.name==='Alumno prueba');
  assert.equal(s.progress['Matemáticas:2'],'Reforzar');
  assert.equal(data.students.find(s=>s.id==='alba').progress['Matemáticas:2'],undefined);
  assert.equal(data.sessions.find(c=>c.studentId===s.id).status,'Finalizada');
  assert.equal(data.assignments.find(a=>a.studentId===s.id).contentId,'game0');
  assert.equal(data.assignments.find(a=>a.studentId===s.id).status,'Corregida');
  await page.reload();
  await page.locator('.home-primary-nav').getByRole('button',{name:'Alumnos'}).click();
  await page.getByRole('heading',{name:'Alumno prueba',exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.locator('.home-primary-nav').getByRole('button',{name:'Inicio'}).click();
  await page.screenshot({path:'tools/profesor-home-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.deepEqual(errors,[]);
  // Exercise the account path and AI approval without calling a real provider.
  const remote=await browser.newPage();
  let stored={},aiPayload=null,failSave=false;
  const html=require('node:fs').readFileSync('apps/profesor/index.html','utf8');
  await remote.route('http://profesor.test/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/auth/me')return route.fulfill({contentType:'application/json',body:JSON.stringify({user:{full_name:'Laura'}})});
   if(url.pathname==='/api/state'){
    assert.equal(url.searchParams.get('app'),'profesor_particular');
    if(req.method()==='POST'){
     if(failSave)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Servidor temporalmente no disponible'})});
     stored=req.postDataJSON();
    }
    return route.fulfill({contentType:'application/json',body:JSON.stringify(req.method()==='POST'?{ok:true}:stored)});
   }
   if(url.pathname==='/api/chat'){
    aiPayload=req.postDataJSON();
    return route.fulfill({contentType:'application/json',body:JSON.stringify({content:'Explicación 10 min. Practica 2x + 1 = 7. Solución: x = 3.'})});
   }
   return route.fulfill({contentType:'text/html',body:html});
  });
  await remote.goto('http://profesor.test/profesor-particular');
  await remote.getByRole('button',{name:'+ Alumno',exact:true}).waitFor();
  await remote.evaluate(()=>{state=demoState();ready=true;render();save()});
  await remote.evaluate(()=>saveQueue);
  await remote.locator('.home-primary-nav').getByRole('button',{name:'Material',exact:true}).click();
  await remote.evaluate(()=>aiForm());
  await remote.getByLabel('Objetivo concreto').fill('Practicar signos');
  await remote.getByRole('button',{name:'Generar propuesta'}).click();
  await remote.getByLabel('Contenido propuesto').waitFor();
  assert.equal(stored.sessions.length,3,'AI proposal must not save before approval');
  const context=JSON.parse(aiPayload.messages[1].content).context;
  assert.equal(context.course,'3º ESO');
  assert.equal(context.progress['Matemáticas:2'],'Reforzar');
  await remote.getByLabel('Contenido propuesto').fill('Texto revisado por el profesor');
  await remote.getByRole('button',{name:'Validar y guardar'}).click();
  await remote.evaluate(()=>saveQueue);
  assert.equal(stored.sessions.length,4);
  assert.equal(stored.sessions.at(-1).blocks[0].body,'Texto revisado por el profesor');
  assert.equal(stored.students[0].progress['Matemáticas:2'],'Reforzar');
  failSave=true;
  await remote.evaluate(()=>{state.students[0].notes='Cambio pendiente';save()});
  await remote.evaluate(()=>saveQueue);
  assert.equal(await remote.evaluate(()=>saveFailed),true);
  failSave=false;
  await remote.getByRole('button',{name:'Sin guardar · pulsa Reintentar'}).click();
  await remote.evaluate(()=>saveQueue);
  assert.equal(stored.students[0].notes,'Cambio pendiente');
  assert.equal(await remote.evaluate(()=>saveFailed),false);
  const admin=await browser.newPage({viewport:{width:1440,height:940}});
  admin.on('pageerror',e=>errors.push(e.message));
  await admin.goto(pathToFileURL(path.resolve('admin/index.html')).href);
  await admin.evaluate(()=>{
   accounts=[{id:'teacher-test',email:'teacher@example.com',full_name:'Laura Profesora',is_active:true,accesses:[{product_code:'PROFESOR_PARTICULAR',effective_status:'active',status:'active',plan:'PROFESOR_FREE',total_credits:100,used_credits:12,available_credits:88,unlimited:false}]}];
   setLoginState(true);setView('profesor');
  });
  await admin.getByRole('heading',{name:'Profesores de esta aplicación'}).waitFor();
  assert.equal(await admin.locator('#appPublicLink').getAttribute('href'),'/profesor');
  assert.equal(await admin.locator('#appPrivateLink').getAttribute('href'),'/profesor-particular');
  assert.match(await admin.locator('#appUsersTable').textContent(),/Laura Profesora/);
  assert.match(await admin.locator('#appUsersTable').textContent(),/88/);
  await admin.getByRole('button',{name:'+ Añadir profesor',exact:true}).click();
  await admin.getByRole('heading',{name:'Añadir profesor a Profesor Particular'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('OK: alta, progreso aislado, preparación, clase, cierre, asignación, entrega, revisión, persistencia y móvil.');
  console.log('OK: guardado por cuenta, contexto IA, validación explícita y reintento tras fallo.');
  console.log('OK: dashboard de profesores, créditos, formulario y enlaces de landing/app.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

