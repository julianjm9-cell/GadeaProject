(() => {
  'use strict';
  let count=0,busy=false,sendKey='',signature='';
  const date=value=>new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:value+'Z').toLocaleString('es-ES');
  const status=text=>{$('notificationStatus').textContent=text;};
  async function load(){
    const data=await api('/admin/profesor-notifications');count=data.recipients;
    $('notificationAudience').textContent=`${count} ${count===1?'cuenta recibirá':'cuentas recibirán'} el aviso en Profesor Particular (normales y Premium). Se excluyen usuarios u organizaciones bloqueados y otras apps.`;
    $('notificationHistory').innerHTML=data.messages.length?data.messages.map(item=>`<article class="card" style="margin-top:12px"><div class="head" style="flex-wrap:wrap"><h3 style="overflow-wrap:anywhere;min-width:0">${esc(item.title)}</h3><time class="muted">${esc(date(item.created_at))}</time></div><p style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65">${esc(item.body)}</p><p class="muted" style="margin-top:14px">${item.delivered} entregados · ${item.read} leídos · ${item.dismissed} eliminados de su bandeja</p></article>`).join(''):'<div class="empty">Aún no has enviado avisos.</div>';
  }
  function review(event){
    event.preventDefault();if(busy)return;
    const title=$('notificationTitle').value.trim(),body=$('notificationBody').value.trim();
    if(!title||!body)return status('Escribe un título y un mensaje.');
    if(!count)return status('No hay cuentas disponibles. Actualiza la lista de destinatarios.');
    $('notificationPreviewTitle').textContent=title;$('notificationPreviewBody').textContent=body;
    $('notificationSend').textContent=`Enviar a ${count} ${count===1?'cuenta':'cuentas'}`;
    $('notificationReview').hidden=false;status('Revisa el mensaje antes de enviarlo.');
  }
  async function send(){
    if(busy)return;
    const title=$('notificationTitle').value.trim(),body=$('notificationBody').value.trim(),current=JSON.stringify([title,body]);
    if(!title||!body)return;
    if(signature!==current){signature=current;sendKey=crypto.randomUUID();}
    busy=true;$('notificationSend').disabled=true;$('notificationForm').querySelectorAll('input,textarea,button').forEach(node=>node.disabled=true);status('Enviando aviso…');
    try{
      const result=await api('/admin/profesor-notifications',{method:'POST',body:JSON.stringify({send_key:sendKey,title,body})});
      $('notificationForm').reset();$('notificationReview').hidden=true;sendKey='';signature='';
      status(`Aviso enviado a ${result.delivered} cuentas. Permanecerá en cada bandeja hasta que su usuario lo elimine.`);
      try{await load();}catch{status(`Aviso enviado a ${result.delivered} cuentas. No se ha podido actualizar el historial; pulsa Actualizar.`);}
    }catch(error){status(error.message+' Puedes reintentar el mismo envío sin duplicarlo.');}
    finally{busy=false;$('notificationSend').disabled=false;$('notificationForm').querySelectorAll('input,textarea,button').forEach(node=>node.disabled=false);}
  }
  window.adminNotifications={load:()=>load().catch(error=>status(error.message)),review,send};
  $('notificationForm').addEventListener('submit',review);
  $('notificationForm').addEventListener('input',()=>{if(!busy)$('notificationReview').hidden=true;});
  $('notificationSend').addEventListener('click',send);
})();
