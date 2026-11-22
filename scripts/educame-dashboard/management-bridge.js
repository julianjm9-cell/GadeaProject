/* Loaded only by the local administrative workspace, never by the online dashboard. */
(() => {
  const nativeFetch=window.fetch.bind(window),origin=location.origin;
  const notify=data=>{if(parent!==window)parent.postMessage(data,origin);};
  let dirty=false;
  window.fetch=async(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    if(url.origin!==origin)return nativeFetch(input,options);
    if(url.pathname.startsWith('/admin/')){
      const method=(options.method||'GET').toUpperCase();
      const response=await nativeFetch('/api/operacion/admin/bridge',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:url.pathname+url.search,method,...(options.body?{data:JSON.parse(options.body)}:{})})});
      if(response.status===401||response.status===403)notify({type:'terrace-admin-session',connected:false});
      if(response.ok&&method!=='GET'){dirty=false;notify({type:'terrace-admin-changed'});}
      return response;
    }
    if(url.pathname==='/auth/login'){
      const response=await nativeFetch('/api/operacion/admin/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:options.body});
      const password=document.getElementById('password');if(password)password.value='';
      const data=await response.json();if(response.ok)notify({type:'terrace-admin-session',connected:true});
      return new Response(JSON.stringify(response.ok?{access_token:'terraza-session'}:{detail:data.error||'No se pudo conectar la administración.'}),{status:response.status,headers:{'Content-Type':'application/json'}});
    }
    return nativeFetch(input,options);
  };
  document.documentElement.classList.add('terrace-embedded');
  document.addEventListener('input',event=>{if(event.target.closest('form')&&!event.target.closest('#authScreen')){dirty=true;notify({type:'terrace-admin-dirty',dirty:true});}});
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link)return;
    const url=new URL(link.href,location.href);
    if(url.origin===origin&&!url.pathname.startsWith('/gestion/')&&!url.hash.startsWith('#')){event.preventDefault();window.open('https://educame.tech'+url.pathname+url.search+url.hash,'_blank','noopener,noreferrer');}
  });
  document.addEventListener('DOMContentLoaded',()=>{
    const query=new URLSearchParams(location.search),app=query.get('app')||'todas';let area=query.get('area')||'resumen',routing=false;
    const map={ingles:'cambridge',facturas:'ocr'},codes={profesor:'PROFESOR_PARTICULAR',eso:'ESO_ADULTOS',ingles:'CAMBRIDGE',diplomator:'DIPLOMATOR',universidad:'UNIVERSIDAD_ADULTOS',facturas:'OCR_FACTURAS'};
    document.body.dataset.terraceScope=app;
    function skin(){
      document.body.dataset.terraceArea=area;
      if(area==='notificaciones'&&window.adminNotifications){const details=document.getElementById('appNotifications');if(details&&!details.open){details.open=true;}}
      notify({type:'terrace-admin-dirty',dirty});
    }
    const oldRender=window.renderAll;if(oldRender)window.renderAll=function(){oldRender();skin();};
    const oldView=window.setView;if(oldView)window.setView=function(next){
      const changed=!routing&&next!==view;
      if(changed){area=next==='ai'?'ia':next==='ads'?'anuncios':next==='overview'?'resumen':'usuarios';}
      oldView(next);skin();
      if(changed)notify({type:'terrace-admin-route',app:next==='overview'||next==='ai'?'todas':next==='ads'?'profesor':({cambridge:'ingles',ocr:'facturas'})[next]||next.replace(/^app\//,''),area});
    };
    const oldLogout=window.logout;if(oldLogout)window.logout=async()=>{await nativeFetch('/api/operacion/admin/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});oldLogout();notify({type:'terrace-admin-session',connected:false});};
    function route(){
      if(!window.setView||document.getElementById('adminPage')?.hidden)return;
      routing=true;
      try{
        if(area==='ia'){if(codes[app])aiApp=codes[app];setView('ai');}
        else if(area==='anuncios')setView('ads');
        else if(app==='todas')setView('overview');
        else setView(map[app]||((['profesor','eso','diplomator','universidad','hazlotu'].includes(app))?app:'app/'+app));
        skin();
      }finally{routing=false;}
    }
    const oldLoad=window.loadAll;if(oldLoad)window.loadAll=async()=>{await oldLoad();route();};
    const page=document.getElementById('adminPage');
    if(page){new MutationObserver(()=>{if(!page.hidden)route();}).observe(page,{attributes:true,attributeFilter:['hidden']});}
    route();
    new ResizeObserver(()=>notify({type:'terrace-admin-size',height:Math.ceil(document.body.scrollHeight)})).observe(document.body);
    notify({type:'terrace-admin-ready'});
  });
})();
