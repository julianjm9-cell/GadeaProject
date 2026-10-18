(() => {
  'use strict';
  const bell='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=value=>new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:value+'Z').toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'});
  let unread=0,total=0,messages=[],next=null,busy=false,revision=0,pendingSummary=null;
  let dialog;
  const isDemo=()=>typeof demo!=='undefined'&&demo;
  function button(){return `<button type="button" class="teacher-notifications-button" data-teacher-notifications aria-label="Notificaciones${unread?', '+unread+' sin leer':''}" aria-haspopup="dialog">${bell}<span data-notifications-count ${unread?'':'hidden'}>${unread>99?'99+':unread}</span></button>`;}
  function counts(data){unread=Number(data.unread)||0;total=Number(data.total)||0;document.querySelectorAll('[data-teacher-notifications]').forEach(node=>{node.setAttribute('aria-label',`Notificaciones${unread?', '+unread+' sin leer':''}`);const badge=node.querySelector('[data-notifications-count]');if(badge){badge.hidden=!unread;badge.textContent=unread>99?'99+':unread;}});}
  async function api(path,options={}){
    const response=await authenticatedFetch('/api/profesor/notifications'+path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'No se han podido cargar los avisos. Inténtalo de nuevo.');
    return data;
  }
  async function refresh(){
    if(isDemo()||document.hidden)return;
    if(pendingSummary)return pendingSummary;
    const stamp=revision;
    pendingSummary=api('/summary').then(data=>{if(stamp===revision)counts(data);}).catch(()=>{}).finally(()=>{pendingSummary=null;});
    return pendingSummary;
  }
  function render(){
    dialog.querySelector('[data-inbox-description]').textContent=total?`${total} ${total===1?'aviso guardado. Se conservará hasta que lo elimines.':'avisos guardados. Se conservarán hasta que los elimines.'}`:'Tus avisos permanecerán aquí hasta que los elimines.';
    dialog.querySelector('[data-inbox-list]').innerHTML=messages.length?messages.map(item=>`<article class="teacher-notification" data-notice="${escape(item.id)}"><div class="teacher-notification-meta"><span>Profesor Particular</span><time datetime="${escape(item.created_at)}">${escape(date(item.created_at))}</time></div><h3>${escape(item.title)}</h3><p>${escape(item.body)}</p><button type="button" data-dismiss-notice="${escape(item.id)}" aria-label="Eliminar aviso: ${escape(item.title)}">Eliminar</button></article>`).join(''):'<div class="teacher-notification-empty">'+bell+'<strong>No tienes notificaciones</strong><p>Las novedades y mensajes de Profesor Particular aparecerán aquí.</p></div>';
    dialog.querySelector('[data-inbox-more]').hidden=!next;
    dialog.querySelectorAll('[data-dismiss-notice],[data-inbox-more],[data-inbox-refresh]').forEach(node=>node.disabled=busy);
  }
  const status=text=>{dialog.querySelector('[data-inbox-status]').textContent=text;};
  async function load(reset=true){
    if(busy)return;
    busy=true;render();status('Cargando avisos…');
    try{
      const data=isDemo()?{messages:[],total:0,unread:0,next:null}:await api(reset?'':'?before='+encodeURIComponent(next));
      revision++;counts(data);messages=reset?data.messages:[...messages,...data.messages.filter(item=>!messages.some(old=>old.id===item.id))];next=data.next;render();
      const ids=data.messages.filter(item=>!item.read).map(item=>item.id);
      if(ids.length){try{counts(await api('/read',{method:'POST',body:JSON.stringify({ids})}));ids.forEach(id=>{const item=messages.find(item=>item.id===id);if(item)item.read=true;});}catch{status('Los avisos están disponibles. No se ha podido confirmar su lectura. Pulsa Actualizar para reintentar.');return;}}
      status('');
    }catch(error){status(error.message);}
    finally{busy=false;render();}
  }
  async function dismiss(id){
    if(busy)return;
    busy=true;render();status('Eliminando aviso…');
    try{counts(await api('/'+encodeURIComponent(id)+'/dismiss',{method:'POST'}));revision++;messages=messages.filter(item=>item.id!==id);status('Aviso eliminado de tu bandeja.');}
    catch(error){status(error.message);}
    finally{busy=false;render();if(!messages.length&&next)await load(false);(dialog.querySelector('[data-dismiss-notice]')||dialog.querySelector('[data-inbox-close]')).focus({preventScroll:true});}
  }
  function open(){
    document.querySelectorAll('.account-dropdown[open]').forEach(node=>node.open=false);
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='teacher-notifications-dialog';dialog.setAttribute('aria-labelledby','teacherInboxTitle');
      dialog.innerHTML=`<header><div class="teacher-inbox-icon">${bell}</div><div><h2 id="teacherInboxTitle">Notificaciones</h2><p data-inbox-description></p></div><button type="button" data-inbox-close aria-label="Cerrar notificaciones">×</button></header><div data-inbox-status role="status" aria-live="polite"></div><div data-inbox-list></div><footer><button type="button" data-inbox-refresh>Actualizar</button><button type="button" data-inbox-more hidden>Ver más avisos</button></footer>`;
      document.body.append(dialog);
      dialog.addEventListener('click',event=>{const target=event.target.closest('button');if(!target)return;if(target.hasAttribute('data-inbox-close'))dialog.close();if(target.hasAttribute('data-inbox-refresh'))load();if(target.hasAttribute('data-inbox-more'))load(false);if(target.dataset.dismissNotice)dismiss(target.dataset.dismissNotice);});
    }
    dialog.showModal();load();
  }
  window.profesorNotifications={button,refresh};
  document.addEventListener('click',event=>{if(event.target.closest('[data-teacher-notifications]'))open();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('focus',refresh);
  document.addEventListener('DOMContentLoaded',()=>{refresh();setInterval(refresh,60000);});
})();
