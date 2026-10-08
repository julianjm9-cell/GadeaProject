const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const url=pathToFileURL(path.resolve('apps/profesor/index.html')).href+'#temario';
  await page.goto(url);
  await page.locator('.temario-controls').waitFor();
  await page.getByRole('button',{name:/Subir mi tema/}).click();
  await page.locator('#uploadedTopicTitle').fill('Mi unidad de ecuaciones');
  await page.locator('#uploadedTopicFiles').setInputFiles([
   {name:'apuntes.txt',mimeType:'text/plain',buffer:Buffer.from('Explicación propia de ecuaciones')},
   {name:'actividades.md',mimeType:'text/markdown',buffer:Buffer.from('# Actividades\nResolver x + 2 = 5')}
  ]);
  assert.match(await page.locator('#uploadedTopicSelection').innerText(),/apuntes.txt.*actividades.md/);
  await page.getByRole('button',{name:'Guardar tema'}).click();
  await page.locator('#dialog').waitFor({state:'hidden'});
  assert.equal(await page.locator('.temario-topic').count(),7);
  assert.match(await page.locator('.temario-detail').innerText(),/Mi unidad de ecuaciones/);
  assert.match(await page.locator('#uploadedTopicPreview').innerText(),/Explicación propia/);
  await page.getByRole('button',{name:/actividades.md/}).click();
  assert.match(await page.locator('#uploadedTopicPreview').innerText(),/Resolver x/);
  await page.locator('#temarioSubject').selectOption('Inglés');
  assert.equal(await page.locator('.temario-topic').count(),5);
  await page.locator('#temarioSubject').selectOption('Matemáticas');
  await page.getByRole('button',{name:/Mi unidad de ecuaciones/}).click();
  assert.match(await page.locator('#uploadedTopicPreview').innerText(),/Resolver x/);
  await page.reload();
  await page.locator('.temario-controls').waitFor();
  await page.getByRole('button',{name:/Mi unidad de ecuaciones/}).click();
  assert.match(await page.locator('#uploadedTopicPreview').innerText(),/Explicación propia/);
  await page.getByRole('button',{name:/Añadir archivos/}).click();
  await page.locator('#uploadedTopicFiles').setInputFiles({name:'ejemplos.csv',mimeType:'text/csv',buffer:Buffer.from('ejemplo,solución\n2+2,4')});
  await page.getByRole('button',{name:'Añadir documentos'}).click();
  await page.locator('#dialog').waitFor({state:'hidden'});
  assert.equal(await page.locator('.uploaded-topic-file').count(),3);
  assert.match(await page.locator('#uploadedTopicPreview').innerText(),/2\+2,4/);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.deepEqual(errors,[]);
  console.log('PASS upload de temas: varios archivos, curso/asignatura, vista previa y persistencia');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
