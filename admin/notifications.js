(() => {
  'use strict';
  let count=0,busy=false,sendKey='',signature='',loadedProduct='';
  const selected=()=>productByKey();
  const endpoint=()=>'/admin/app-notifications/'+encodeURIComponent(selected().code);
  const date=value=>new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:value+'Z').toLocaleString('es-ES');
  const status=text=>{$('notificationStatus').textContent=text;};
  async function load(){
    const product=selected(),data=await api(endpoint());if(selected().code!==product.code)return;loadedProduct=product.code;count=data.recipients;
    $('notificationAudience').textContent=`${count} ${count===1?'cuenta recibirá':'cuentas recibirán'} el aviso en ${product.label}. Se excluyen usuarios sin acceso activo y otras aplicaciones.`;
    $('notificationHistory').innerHTML=data.messages.length?data.messages.map(item=>`<article class="card" style="margin-top:12px"><div class="head" style="flex-wrap:wrap"><h3 style="overflow-wrap:anywhere;min-width:0">${esc(item.title)}</h3><time class="muted">${esc(date(item.created_at))}</time></div><p style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65">${esc(item.body)}</p><p class="muted" style="margin-top:14px">${item.delivered} entregados · ${item.read} leídos · ${item.dismissed} eliminados de su bandeja</p></article>`).join(''):'<div class="empty">Aún no has enviado avisos.</div>';
  }
  function review(event){
    event.preventDefault();if(busy)return;
    const title=$('notificationTitle').value.trim(),body=$('notificationBody').value.trim();
    if(!title||!body)return status('Escribe un título y un mensaje.');
    if(loadedProduct!==selected().code)return status('Actualiza los destinatarios de esta aplicación.');
    if(!count)return status('No hay cuentas disponibles. Actualiza la lista de destinatarios.');
    $('notificationPreviewTitle').textContent=title;$('notificationPreviewBody').textContent=body;
    $('notificationSend').textContent=`Enviar a ${count} ${count===1?'cuenta':'cuentas'}`;
    $('notificationReview').hidden=false;status('Revisa el mensaje antes de enviarlo.');
  }
  async function send(){
    if(busy)return;
    const product=selected(),title=$('notificationTitle').value.trim(),body=$('notificationBody').value.trim(),current=JSON.stringify([product.code,title,body]);
    if(!title||!body)return;
    if(signature!==current){signature=current;sendKey=crypto.randomUUID();}
    busy=true;$('notificationSend').disabled=true;$('notificationForm').querySelectorAll('input,textarea,button').forEach(node=>node.disabled=true);status('Enviando aviso…');
    try{
      const result=await api(endpoint(),{method:'POST',body:JSON.stringify({send_key:sendKey,title,body})});
      $('notificationForm').reset();$('notificationReview').hidden=true;sendKey='';signature='';
      status(`Aviso enviado a ${result.delivered} cuentas. Permanecerá en cada bandeja hasta que su usuario lo elimine.`);
      try{await load();}catch{status(`Aviso enviado a ${result.delivered} cuentas. No se ha podido actualizar el historial; pulsa Actualizar.`);}
    }catch(error){status(error.message+' Puedes reintentar el mismo envío sin duplicarlo.');}
    finally{busy=false;$('notificationSend').disabled=false;$('notificationForm').querySelectorAll('input,textarea,button').forEach(node=>node.disabled=false);}
  }
  function reset(){count=0;loadedProduct='';sendKey='';signature='';$('notificationForm').reset();$('notificationReview').hidden=true;$('notificationHistory').innerHTML='';$('notificationAudience').textContent='Abre esta sección para consultar destinatarios.';status('');}
  window.adminNotifications={load:()=>load().catch(error=>status(error.message)),review,send,reset};
  $('notificationForm').addEventListener('submit',review);
  $('notificationForm').addEventListener('input',()=>{if(!busy)$('notificationReview').hidden=true;});
  $('notificationSend').addEventListener('click',send);
  $('appNotifications').addEventListener('toggle',()=>{if($('appNotifications').open)window.adminNotifications.load();});
})();
