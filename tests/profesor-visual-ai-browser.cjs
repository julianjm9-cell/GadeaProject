const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href+'#biblioteca');
  await page.evaluate(()=>{
   demo=false;
   window.api=async(url)=>{
    if(url==='/api/profesor/generate')return {questions:[
     {type:'visualquiz',prompt:'¿Qué deporte aparece?',answer:'Fútbol',options:['Fútbol','Tenis'],imageQuery:'jugando fútbol'},
     {type:'imagepoint',prompt:'Señala el balón',answer:'Zona marcada',options:[],imageQuery:'balón de fútbol'}
    ]};
    if(url.startsWith('/api/profesor/images/search'))return {images:[{id:42,preview:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAA6klEQVR4nO3SMREAIRAEQXj/IpCEI97CTd4dbzS1+9y3mPmGO8RqPCsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArEGvN/ZTHAzfLJCsjAAAAAElFTkSuQmCC',author:'Ana',page:'https://pixabay.com/photos/42/',tags:'fútbol'}]};
    if(url==='/api/profesor/images/import')return {id:'mock-image',filename:'pixabay-42.jpg',credit:'Imagen de Ana en Pixabay',creditUrl:'https://pixabay.com/photos/42/'};
    if(url==='/api/state')return {ok:true};
    throw Error('Ruta inesperada: '+url);
   };
   window.authenticatedFetch=async()=>new Response(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAA6klEQVR4nO3SMREAIRAEQXj/IpCEI97CTd4dbzS1+9y3mPmGO8RqPCsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArEGvN/ZTHAzfLJCsjAAAAAElFTkSuQmCC'),c=>c.charCodeAt(0)),{status:200,headers:{'Content-Type':'image/png'}});
  });
  await page.getByRole('button',{name:'Crear material',exact:true}).click();
  await page.getByLabel('Contenido o tema').fill('Deportes');
  await page.locator('#workshopCourse').fill('3.º ESO');
  await page.locator('[data-exercise="visualquiz"]').click();
  await page.locator('[data-exercise="imagepoint"]').click();
  await page.locator('.studio-advanced summary').click();
  await page.locator('#count-pairs').fill('0');
  assert.equal(await page.locator('#workshopMode option[value="ai"]').isDisabled(),false);
  await page.getByLabel('Preparar el contenido').selectOption('ai');
  await page.getByRole('button',{name:/Continuar/}).click();
  await page.getByRole('button',{name:'Guardar material',exact:true}).waitFor();
  assert.equal(await page.locator('#pixabay-query-0').inputValue(),'jugando fútbol');
  assert.equal(await page.locator('#pixabay-query-1').inputValue(),'balón de fútbol');
  for(const index of [0,1]){
   await page.locator('#search-image-'+index).click();
   await page.locator('#pixabay-results-'+index+' [data-pixabay-id]').first().click();
  }
  await page.getByRole('button',{name:'Guardar material',exact:true}).click();
  assert.match(await page.locator('#notice').innerText(),/Marca el punto correcto/);
  await page.locator('#image-preview-1 img').click({position:{x:50,y:50},force:true});
  await page.getByRole('button',{name:'Guardar material',exact:true}).click();
  const saved=await page.evaluate(()=>state.library.find(m=>m.title==='Deportes'));
  assert.equal(saved.activity.questions[0].image.credit,'Imagen de Ana en Pixabay');
  assert.equal(saved.activity.questions[1].target.x>=0,true);
  assert.deepEqual(errors,[]);
  console.log('PASS visual AI draft, Pixabay image selection, target required, attribution retained');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
