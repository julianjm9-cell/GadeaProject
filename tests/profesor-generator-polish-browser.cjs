const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
  await page.getByRole('button',{name:'+ Alumno',exact:true}).click();
  await page.getByLabel('Nombre del alumno').fill('Eva Música');
  await page.getByLabel('Curso o nivel').fill('5.º Primaria');
  await page.getByRole('checkbox',{name:'Matemáticas'}).uncheck();
  await page.getByLabel('Otra asignatura (opcional)').fill('Música');
  await page.getByRole('button',{name:'Crear alumno'}).click();
  await page.getByLabel('Espacio del alumno').getByRole('button',{name:'Progreso'}).click();
  await page.getByText('todavía no hay objetivos predefinidos',{exact:false}).waitFor();
  await page.getByLabel('Espacio del alumno').getByRole('button',{name:'Biblioteca'}).click();
  await page.getByRole('button',{name:'Crear material',exact:true}).click();
  assert.equal(await page.getByLabel('Curso',{exact:true}).inputValue(),'5.º Primaria');
  assert.equal(await page.locator('#workshopSubject').inputValue(),'Música');
  await page.getByLabel('Contenido o tema').fill('Instrumentos');
  await page.locator('[data-exercise="flashcard"]').click();
  await page.locator('[data-exercise="error"]').click();
  await page.locator('#workshopContinue').click();
  assert.equal(await page.locator('.exercise-jump button').count(),2);
  await page.locator('.exercise-jump button').last().click();
  await page.locator('#q-0').fill('¿Qué instrumento tiene teclas blancas y negras?');
  await page.locator('#a-0').fill('Piano');
  await page.locator('#q-1').fill('Un alumno dice que el violín es de viento. Corrige el error.');
  await page.locator('#a-1').fill('El violín es de cuerda.');
  await page.getByRole('button',{name:'Guardar material',exact:true}).click();
  await page.getByRole('button',{name:'Probar sin guardar'}).waitFor();
  const created=await page.evaluate(()=>state.library.find(m=>m.title==='Instrumentos'));
  assert.equal(created.subject,'Música');
  assert.equal(created.studentId,await page.evaluate(()=>state.students.find(s=>s.name==='Eva Música').id));
  await page.getByRole('button',{name:'Cerrar',exact:true}).last().click();
  await page.getByRole('button',{name:'+ Añadir material',exact:true}).click();
  assert.ok(await page.locator('#materialSubject option').allTextContents().then(values=>values.includes('Música')));
  assert.deepEqual(errors,[]);
  console.log('PASS custom school subject, safe progress, editor navigation and material persistence');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
