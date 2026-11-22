const $=id=>document.getElementById(id);
const ordinary=new Set(['profesor','eso','ingles','diplomator','universidad','facturas']);
const areas={resumen:'Resumen',usuarios:'Usuarios y licencias',notificaciones:'Notificaciones',ia:'Modelos de IA',anuncios:'Anuncios'};
export function setupManagement({api,feedback}){
  const frame=$('management-frame'),app=$('management-app'),tabs=$('management-tabs');let catalog=[],currentApp='todas',currentArea='resumen',loaded='',dirty=false;
  function available(){return currentApp==='todas'?['resumen','ia','anuncios']:ordinary.has(currentApp)?['usuarios','notificaciones','ia',...(currentApp==='profesor'?['anuncios']:[])]:['usuarios'];}
  function render(){
    const choices=available();if(!choices.includes(currentArea))currentArea=choices[0];
    tabs.replaceChildren(...choices.map(area=>{const button=document.createElement('button');button.type='button';button.className='button secondary';button.textContent=areas[area];button.setAttribute('aria-pressed',String(area===currentArea));button.addEventListener('click',()=>navigate(currentApp,area));return button;}));
    app.replaceChildren(new Option('Todas las apps','todas'),...catalog.map(row=>new Option(row.name,row.id)));app.value=currentApp;
  }
  function navigate(nextApp,nextArea){
    if(dirty&&!window.confirm('Hay cambios sin guardar en esta ficha. ¿Quieres cambiar de sección?')){app.value=currentApp;return;}
    currentApp=nextApp;currentArea=nextArea;render();location.hash='gestion/'+currentApp+'/'+currentArea;
  }
  async function open(){
    const route=/^#gestion(?:\/([a-z0-9-]+))?(?:\/([a-z]+))?$/.exec(location.hash);if(!route)return;
    currentApp=route[1]||'todas';currentArea=route[2]|| (currentApp==='todas'?'resumen':'usuarios');
    try{let data;try{data=await api('/api/operacion/admin/apps');}catch{data=await api('/api/apps/catalogo');}catalog=data.apps;render();
      const next=currentApp+'/'+currentArea;if(next!==loaded){loaded=next;dirty=false;frame.style.height='560px';$('management-status').textContent='Abriendo la gestión conectada al servidor…';frame.src='/gestion/?'+new URLSearchParams({app:currentApp,area:currentArea});}
    }catch(error){feedback(error.message,true);}
  }
  app.addEventListener('change',()=>navigate(app.value,app.value==='todas'?'resumen':'usuarios'));
  $('management-refresh').addEventListener('click',()=>{if(dirty&&!window.confirm('Hay cambios sin guardar. ¿Quieres recargar la ficha?'))return;frame.contentWindow.location.reload();});
  $('management-logout').addEventListener('click',async()=>{try{await api('/api/operacion/admin/logout','POST',{});frame.contentWindow.location.reload();window.dispatchEvent(new Event('terrace-admin-changed'));}catch(error){feedback(error.message,true);}});
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
    const message=event.data;if(!message||typeof message!=='object')return;
    if(message.type==='terrace-admin-ready')$('management-status').textContent='Misma administración y datos que el dashboard online.';
    if(message.type==='terrace-admin-session'){$('management-status').textContent=message.connected?'Administración conectada.':'Conecta tu cuenta administradora en el formulario.';window.dispatchEvent(new Event('terrace-admin-changed'));if(message.connected)api('/api/operacion/admin/apps').then(data=>{catalog=data.apps;render();}).catch(()=>{});}
    if(message.type==='terrace-admin-route'&&(message.app==='todas'||catalog.some(row=>row.id===message.app))&&Object.hasOwn(areas,message.area))navigate(message.app,message.area);
    if(message.type==='terrace-admin-changed'){dirty=false;window.dispatchEvent(new Event('terrace-admin-changed'));}
    if(message.type==='terrace-admin-dirty')dirty=message.dirty===true;
    if(message.type==='terrace-admin-size'&&Number.isFinite(message.height))frame.style.height=Math.max(560,Math.min(message.height,20000))+'px';
  });
  return {open};
}
