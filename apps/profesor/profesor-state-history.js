/* Private teacher recovery. Never silently overwrite a newer save. */
let teacherHistoryVersions=new Map();

function historyCounts(counts={}){
 return [['students','alumno','alumnos'],['sessions','clase','clases'],['tasks','tarea','tareas'],['library','material','materiales'],['personalTopics','tema propio','temas propios']]
  .map(([key,singular,plural])=>{const count=Number(counts[key])||0;return `${count} ${count===1?singular:plural}`}).join(' · ');
}

async function openStateHistory(){
 document.querySelector('.account-dropdown[open]')?.removeAttribute('open');
 await saveQueue;
 if(demo){modal('Historial y recuperación','<p>El historial protege los datos de tu cuenta. Entra con tu cuenta para consultar y recuperar versiones.</p>'+button('Cerrar','close'),()=>false);return}
 modal('Historial y recuperación','<div id="stateHistoryContent" aria-live="polite">Cargando versiones…</div>',()=>false);
 $('dialog').classList.add('state-history-dialog');
 $('dialog').addEventListener('close',()=>$('dialog').classList.remove('state-history-dialog'),{once:true});
 try{
  const data=await api('/api/profesor/state-history');
  const target=$('stateHistoryContent');if(!target)return;
  teacherHistoryVersions=new Map(data.versions.map(item=>[item.id,{...item,expectedRevision:data.revision}]));
  const reasons={save:'Guardado',restore:'Versión recuperada',initial:'Versión inicial',before_save:'Versión anterior',account_change:'Antes de un cambio de cuenta',daily:'Copia diaria',before_restore:'Antes de recuperar',before_clear:'Antes de vaciar el escritorio'};
  target.innerHTML=`<p class="state-history-intro">Recupera una versión de tus alumnos, clases, tareas y materiales. Conservamos hasta ${Number(data.limit)} copias. La copia automática se realiza cada día a las 00:00, hora de Madrid. Al recuperar otra, protegemos antes tu versión actual dentro del mismo límite. Los cambios se siguen guardando al momento, sin crear una copia por cada edición.</p>${saveFailed?'<p class="state-history-warning">Tienes cambios sin guardar. Revisa el guardado antes de recuperar una versión.</p>':''}<div class="state-history-list">${data.versions.map(item=>`<article class="state-history-version"><div><strong>${esc(new Date(item.created_at).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}))}</strong><span>${esc(reasons[item.reason]||'Guardado')} · Versión ${Number(item.revision)}</span><small>${esc(historyCounts(item.counts))}</small></div>${item.revision===data.revision?'<span class="state-history-current">Actual</span>':`<button type="button" data-state-history-action="restore" data-id="${esc(item.id)}" ${saveFailed?'disabled':''}>Recuperar</button>`}</article>`).join('')||'<p class="state-history-empty">Tu primera copia automática aparecerá después de las 00:00, hora de Madrid. Tus cambios se siguen guardando normalmente.</p>'}</div><div class="actions">${button('Cerrar','close')}</div>`;
 }catch(error){if($('stateHistoryContent'))$('stateHistoryContent').textContent=error.message}
}

function confirmTeacherRestore(id){
 const version=teacherHistoryVersions.get(id);if(!version)return;
 if(saveFailed||pendingSaves){notify('Resuelve primero los cambios pendientes de guardar.');return}
 modal('Recuperar esta versión',`<p>Se sustituirá tu escritorio por la versión del <strong>${esc(new Date(version.created_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}))}</strong>.</p><p>${esc(historyCounts(version.counts))}</p><p>La versión actual se conservará en el historial para que puedas volver a ella.</p>${submit('Recuperar esta versión')}`,async()=>{
  await saveQueue;if(saveFailed)throw Error('Resuelve primero los cambios pendientes de guardar.');
  const data=await api(`/api/profesor/state-history/${encodeURIComponent(id)}/restore`,{}, {'If-Match':`"profesor-${version.expectedRevision}"`});
  state={...fresh(),...data.state};stateETag=`"profesor-${data.revision}"`;normalizeTeacherState();saveFailed=false;saveBlocked='';selected=null;activeClass=null;view='Inicio';render();notify('Versión recuperada. Tu versión anterior sigue disponible en el historial.');
 });
}

function downloadPendingTeacherChanges(){
 const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='profesor-cambios-pendientes.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
 notify('Copia de tus cambios descargada. Consérvala para recuperar el trabajo pendiente.');
}

function openSaveResolution(){
 const empty=saveBlocked==='empty';
 modal('Proteger tus cambios',`<p>${empty?'El guardado dejaría tu escritorio vacío y se ha detenido por seguridad.':'Hay una versión más reciente guardada o esta pestaña necesita actualizarse. No hemos sobrescrito los datos del servidor.'}</p><p>Puedes descargar tus cambios pendientes antes de cargar lo que está guardado. Si necesitas unir ambas versiones, conserva el archivo y contacta con soporte.</p><div class="actions"><button type="button" data-state-history-action="download">Descargar mis cambios pendientes</button><button type="button" data-state-history-action="load-current">Cargar versión guardada</button>${empty?'<button type="button" data-state-history-action="confirm-empty">Confirmar escritorio vacío</button>':''}${button('Cerrar','close')}</div>`,()=>false);
}

document.addEventListener('click',async event=>{
 const action=event.target.closest('[data-action]')?.dataset.action;
 if(action==='stateHistory'){openStateHistory();return}
 if(action==='resolveStateSave'){openSaveResolution();return}
 const control=event.target.closest('[data-state-history-action]');if(!control)return;
 try{
  if(control.dataset.stateHistoryAction==='restore')confirmTeacherRestore(control.dataset.id);
  if(control.dataset.stateHistoryAction==='download')downloadPendingTeacherChanges();
  if(control.dataset.stateHistoryAction==='load-current')modal('Cargar la versión guardada',`<p>Se cargarán los datos que están guardados en tu cuenta. Los cambios pendientes de esta pestaña se sustituirán. Descarga una copia antes si quieres conservarlos.</p>${submit('Cargar versión guardada')}`,async()=>{
   await saveQueue;const data=await api('/api/state'),previous=state;state={...fresh(),...data};try{normalizeTeacherState()}catch(error){state=previous;throw error}saveFailed=false;saveBlocked='';selected=null;activeClass=null;view='Inicio';render();notify('Se ha cargado la última versión guardada.');
  });
  if(control.dataset.stateHistoryAction==='confirm-empty')modal('Confirmar escritorio vacío',`<p>Confirma solo si quieres eliminar el contenido actual de tu escritorio. La versión anterior quedará en el historial.</p>${submit('Guardar escritorio vacío')}`,async()=>{if(!await save({confirmEmpty:true}))return false;notify('Escritorio vacío guardado. La versión anterior sigue en el historial.');render()});
 }catch(error){notify(error.message)}
});
