const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.wav':'audio/wav'};
async function fixture(page,{paused=false,licenseKey}={}){
 let state={},revision=1;
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),p=url.pathname;
  if(url.hostname!=='studio.test')return route.abort();
  if(p==='/api/state'){
   if(request.method()==='POST'){state=request.postDataJSON();revision++;}
   return route.fulfill({headers:{ETag:'"studio-'+revision+'"'},json:request.method()==='POST'?{ok:true}:state});
  }
  if(p==='/api/status')return route.fulfill({json:{ok:true,user:{id:'visual-trial',name:'Cuenta de prueba',total_credits:100,available_credits:100,license_key:licenseKey}}});
  if(p==='/api/me')return route.fulfill({json:{ok:true,user:{id:'visual-trial',name:'Cuenta de prueba',status:'active',total_credits:100,available_credits:100}}});
  if(p==='/api/study-appearance')return route.fulfill({json:{look:'original'}});
  if(p==='/auth/google/status')return route.fulfill({json:{enabled:true}});
  if(p==='/api/public/app-availability')return route.fulfill({json:{apps:{CAMBRIDGE:{paused}}}});
  if(p.startsWith('/api/app-notifications/'))return route.fulfill({json:{messages:[],next:null,unread:0}});
  if(p.startsWith('/api/'))return route.fulfill({json:{ok:true}});
  let file;
  if(p==='/cambridge')file=path.join(root,'apps/cambridge/index.html');
  else if(p==='/eso-adultos')file=path.join(root,'apps/e25/index.html');
  else if(p==='/cambridge-info')file=path.join(root,'marketing/app_landings_demo/cambridge.html');
  else if(p.startsWith('/assets/cambridge-studio/'))file=path.join(root,'apps/cambridge/assets/studio',path.basename(p));
  else if(p.startsWith('/assets/cambridge-games/'))file=path.join(root,'apps/cambridge/assets/games',path.basename(p));
  else if(p.startsWith('/assets/listening/'))file=path.join(root,'apps/cambridge/assets/listening',path.basename(p));
  else if(p.startsWith('/assets/brand/'))file=path.join(root,'backend/app/static/assets/brand',path.basename(p));
  else if(p.startsWith('/assets/study-appearance/'))file=path.join(root,'backend/app/static/assets/study-appearance',path.basename(p));
  else if(/^\/assets\/(eso-|desk\/|subjects\/)/.test(p))file=path.join(root,'apps/e25',p);
  else if(p.startsWith('/assets/'))file=path.join(root,'apps/profesor/assets',path.basename(p));
  else file=path.join(root,'apps/profesor',path.basename(p));
  if(file&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
  return route.fulfill({status:404,body:''});
 });
}

module.exports={fixture,root};
