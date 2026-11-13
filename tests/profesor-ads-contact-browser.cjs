const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('./browser-runtime.cjs');
const html=fs.readFileSync('marketing/app_landings_demo/profesor-anuncios.html','utf8');
(async()=>{
 for(const [name,engine,viewport] of [['Chromium',chromium,{width:1440,height:950}],['WebKit móvil',webkit,{width:390,height:844}]]){
  const browser=await engine.launch(name==='Chromium'?{channel:'msedge'}:{});
  try{
   const page=await browser.newPage({viewport}), errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   const ad={id:'profesor-ensayo',title:'Clases de matemáticas',subject:'Matemáticas',course:'1.º ESO',location:'Online',information:'Consulta en privado@ejemplo.org o +34 600 123 456',contact:'privado@ejemplo.org',contact_phone:'600 123 456'};
   await page.route('http://ads.test/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/profesor/ad-policy')return route.fulfill({json:{version:'test',terms:'Condiciones de ensayo',publication:'Contacto privado'}});
    if(url.pathname==='/api/profesor/ads')return route.fulfill({json:{ads:[ad]}});
    if(url.pathname==='/api/profesor/ads/'+ad.id)return route.fulfill({json:{ad}});
    if(url.pathname.startsWith('/api/profesor/ads/manage/'))return route.fulfill({json:{ad,status:'active'}});
    if(url.pathname.startsWith('/profesor/'))return route.fulfill({contentType:'text/html',body:html});
    return route.fulfill({status:204,body:''});
   });
   for(const path of ['/profesor/anuncios','/profesor/anuncios/'+ad.id]){
    await page.goto('http://ads.test'+path);
    const contact=page.getByRole('link',{name:'Pedir contacto',exact:true});
    await contact.waitFor();
    const url=new URL(await contact.getAttribute('href'));
    assert.equal(url.pathname,'educamesuite@gmail.com');
    assert.match(url.searchParams.get('body'),/profesor-ensayo/);
    assert.doesNotMatch(await page.locator('body').innerText(),/privado@ejemplo.org|600 123 456/);
    assert.equal(await page.locator('a[href^="tel:"]').count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }
   await page.goto('http://ads.test/profesor/anunciar');
   await page.getByLabel('Contacto privado *',{exact:true}).fill('privado@ejemplo.org');
   await page.locator('#livePreview').getByRole('link',{name:'Pedir contacto',exact:true}).waitFor();
   assert.doesNotMatch(await page.locator('#livePreview').innerText(),/privado@ejemplo/);
   await page.goto('http://ads.test/profesor/anunciar/gestionar#id='+ad.id+'&key=ensayo');
   await page.getByRole('button',{name:'Editar',exact:true}).click();
   assert.equal(await page.getByLabel('Contacto privado *',{exact:true}).inputValue(),'privado@ejemplo.org');
   assert.deepEqual(errors,[]);
   console.log('OK pedir contacto, detalle, vista previa y edición privada: '+name);
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
