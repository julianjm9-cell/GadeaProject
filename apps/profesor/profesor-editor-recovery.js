/* Private editor recovery: five drafts, seven days, no automatic overwrite of the library. */
(()=>{
 const ttl=7*86400000,limit=5,storageKey='profesor.editorDrafts.v1',pendingKey='profesor.pendingState.v1';
 let active=null,restoring=null,saveTimer=null,noticeCount=0,checkedAccount='';
 const clone=value=>JSON.parse(JSON.stringify(value));
 const draftKey=()=>storageKey+':'+(accountId||'demo'),pendingAccountKey=()=>pendingKey+':'+accountId;
 function localRows(){try{const rows=JSON.parse(localStorage.getItem(draftKey())||'[]'),kept=rows.filter(row=>row.expiresAt>Date.now()).slice(-limit);if(kept.length!==rows.length)localStorage.setItem(draftKey(),JSON.stringify(kept));return kept}catch{return []}}
 function ownRows(){return localRows().filter(row=>row.account===accountId)}
 function putLocal(row){try{const rows=localRows().filter(item=>item.id!==row.id);rows.push(row);localStorage.setItem(draftKey(),JSON.stringify(rows.slice(-limit)));return true}catch{return false}}
 function removeLocal(id){try{localStorage.setItem(draftKey(),JSON.stringify(localRows().filter(item=>item.id!==id)))}catch{}}
 function readEditor(){
  const fields=[...$('form').querySelectorAll('input[id],textarea[id],select[id]')].map(field=>({id:field.id,value:field.value,checked:field.checked})),values=new Map(fields.map(row=>[row.id,row.value])),material=clone($('form').editorMaterial);
  material.title=values.get('activityTitle')||'';
  material.activity.questions.forEach((question,index)=>{
   for(const [prefix,name] of [['q','prompt'],['a','answer'],['text','text'],['explanation','explanation'],['unit','unit'],['rubric','rubric'],['errorSegment','errorSegment'],['correctedSegment','correctedSegment']])if(values.has(prefix+'-'+index))question[name]=values.get(prefix+'-'+index);
   for(const [prefix,name] of [['o','options'],['hints','hints'],['alternatives','alternatives'],['wordBank','wordBank']])if(values.has(prefix+'-'+index))question[name]=values.get(prefix+'-'+index).split('\n').map(value=>value.trim()).filter(Boolean);
  });
  return {material,title:material.title||'Material',step:Number($('dialog').dataset.editorStep)||0,fields};
 }
 function changed(){return Boolean(active&&JSON.stringify(readEditor())!==active.baseline)}
 function status(message){if(active&&$('editorDraftStatus'))$('editorDraftStatus').textContent=message}
 function capture(){
  if(!active||!changed())return null;
  const row={id:active.id,account:accountId,at:Date.now(),expiresAt:Date.now()+ttl,payload:readEditor(),version:++active.version};
  active.serverSaved=false;
  active.localSaved=putLocal(row);noticeCount=Math.max(1,noticeCount);
  status(active.localSaved?'Cambios conservados en este dispositivo. Sincronizando borrador…':'Borrador pendiente. Mantén esta ventana abierta hasta confirmar el guardado.');
  return row;
 }
 function flush(){
  clearTimeout(saveTimer);const row=capture(),editor=active;if(!row||demo||!accountId)return Promise.resolve();
  editor.queue=editor.queue.catch(()=>{}).then(async()=>{
   try{await api('/api/profesor/editor-drafts/'+row.id,row.payload);if(editor.version===row.version){editor.serverSaved=true;if(active===editor)status('Borrador guardado · recuperable durante 7 días. El material solo cambia al pulsar Guardar.')}}
   catch(error){if(active===editor)status(editor.localSaved?'Sin conexión con el guardado. Borrador conservado en este dispositivo; se reintentará al volver la conexión.':error.message)}
  });return editor.queue;
 }
 function onInput(){capture();clearTimeout(saveTimer);saveTimer=setTimeout(flush,900)}
 async function discard(id){removeLocal(id);if(!demo)await api('/api/profesor/editor-drafts/'+id+'/discard',{});noticeCount=Math.max(0,noticeCount-1)}
 const originalEdit=editActivity,originalPersist=persistEditedMaterial;
 editActivity=function(source){
  originalEdit(source);
  if(!$('form').editorMaterial)return;
  if(restoring){
   const fields=restoring.payload.fields||[];
   for(const saved of fields){const field=document.getElementById(saved.id);if(field&&$('form').contains(field)){field.value=saved.value;if('checked' in field)field.checked=saved.checked}}
   $('form').dispatchEvent(new Event('input',{bubbles:true}));
  }
  const draft=restoring;restoring=null;
  active={id:draft?.id||crypto.randomUUID(),version:0,baseline:'',queue:Promise.resolve(),localSaved:false,serverSaved:false};
  const banner=document.createElement('p');banner.id='editorDraftStatus';banner.className='generator-help';banner.setAttribute('role','status');
  banner.textContent='Los cambios se conservan como borrador durante 7 días. Pulsa Guardar para actualizar la biblioteca.';
  $('activityTitle').before(banner);
  active.baseline=JSON.stringify(readEditor());
  // A new AI/manual material already contains work even before the first keystroke.
  if(draft||!state.library.some(item=>item.id===source.id))active.baseline='';
  $('form').addEventListener('input',onInput);$('form').addEventListener('change',onInput);
  $('dialog').addEventListener('close',()=>{clearTimeout(saveTimer);$('form').removeEventListener('input',onInput);$('form').removeEventListener('change',onInput);active=null},{once:true});
  if(changed())flush();
 };
 persistEditedMaterial=async function(material){
  const editor=active;await originalPersist(material);
  if(editor){await editor.queue.catch(()=>{});await discard(editor.id).catch(()=>{});if(active===editor){editor.baseline=JSON.stringify(readEditor());active=null}}
  if(material.generationRequestId)await api('/api/profesor/generation/'+material.generationRequestId+'/incorporated',{}).catch(()=>{});
 };
 const nativeClose=$('dialog').close.bind($('dialog'));
 function confirmEditorLeave(args){
  if(document.getElementById('editorLeaveConfirmation'))return;
  const editor=active,prompt=document.createElement('dialog');prompt.id='editorLeaveConfirmation';prompt.className='editor-leave-dialog';
  prompt.innerHTML='<h2>Conservar tu edición</h2><p>Los cambios todavía no están incorporados a la biblioteca. Puedes seguir editando o cerrar conservando el borrador.</p><p role="status" id="editorLeaveStatus"></p><div class="actions"><button type="button" data-leave="stay">Seguir editando</button><button type="button" class="primary" data-leave="keep">Cerrar y conservar borrador</button></div>';
  document.body.append(prompt);prompt.showModal();
  const keep=prompt.querySelector('[data-leave="keep"]'),message=prompt.querySelector('#editorLeaveStatus');
  const update=()=>{keep.disabled=!editor.localSaved&&!editor.serverSaved;message.textContent=keep.disabled?'Esperando a conservar una copia. Mantén la edición abierta si no hay conexión.':editor.serverSaved?'Borrador conservado en tu cuenta durante siete días.':'Borrador conservado en este dispositivo; se sincronizará cuando haya conexión.'};
  update();flush().then(update);
  prompt.querySelector('[data-leave="stay"]').onclick=()=>prompt.close();
  keep.onclick=()=>{prompt.close();nativeClose(...args)};
  prompt.addEventListener('close',()=>prompt.remove(),{once:true});
 }
 $('dialog').close=function(...args){
  if(changed()){
   flush();confirmEditorLeave(args);return;
  }
  return nativeClose(...args);
 };
 $('dialog').addEventListener('cancel',event=>{if(changed()){event.preventDefault();$('dialog').close()}});
 window.addEventListener('beforeunload',event=>{if(changed()){capture();event.preventDefault();event.returnValue=''}});
 window.addEventListener('online',()=>flush());

 function pendingState(){try{const row=JSON.parse(localStorage.getItem(pendingAccountKey())||'null');if(row&&row.expiresAt<=Date.now()){localStorage.removeItem(pendingAccountKey());return null}return row?.account===accountId?row:null}catch{return null}}
 const originalSave=save;
 save=function(...args){
  if(demo||!ready||!accountId)return originalSave(...args);
  const row={account:accountId,at:Date.now(),expiresAt:Date.now()+ttl,etag:stateETag,state:clone(state)};
  try{localStorage.setItem(pendingAccountKey(),JSON.stringify(row))}catch{}
  return originalSave(...args).then(result=>{if(result){const latest=pendingState();if(latest?.at===row.at)try{localStorage.removeItem(pendingAccountKey())}catch{}}return result});
 };
 async function openRecovery(){
  let remote={drafts:[]},inbox={jobs:[]},error='';
  if(!demo){const results=await Promise.allSettled([api('/api/profesor/editor-drafts'),api('/api/profesor/generation-inbox')]);if(results[0].status==='fulfilled')remote=results[0].value;else error='No se pudo consultar el servidor. Se muestran los borradores de este dispositivo.';if(results[1].status==='fulfilled')inbox=results[1].value}
  const pending=pendingState();
  const merged=new Map(remote.drafts.map(row=>[row.id,{...row,at:Date.parse(row.updated_at),title:row.title}]));
  for(const row of ownRows()){const server=merged.get(row.id);if(!server||server.at<row.at)merged.set(row.id,{...row,title:row.payload.title,local:true})}
  const rows=[...merged.values()].sort((a,b)=>b.at-a.at).slice(0,limit);
  modal('Recuperar trabajo',`<p>Hasta cinco borradores durante siete días. Recuperarlos abre una edición; no sobrescribe tu biblioteca automáticamente.</p>${error?`<p role="status">${esc(error)}</p>`:''}${pending?`<article class="card"><h3>Cambios del escritorio pendientes</h3><p>Conservados en este dispositivo. ${pending.etag===stateETag?'Puedes revisar y volver a guardar esta edición.':'El servidor tiene otra revisión. Descarga los cambios para unirlos sin sobrescribir la información más reciente.'}</p><div class="actions"><button type="button" id="downloadPendingRecovery">Descargar cambios</button>${pending.etag===stateETag?'<button type="button" id="restorePendingRecovery">Recuperar y guardar</button>':''}</div></article>`:''}<h3>Borradores</h3>${rows.length?rows.map(row=>`<article class="card"><strong>${esc(row.title)}</strong><p>${esc(new Date(row.at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}))}${row.local?' · Este dispositivo':''}</p><div class="actions"><button type="button" data-recover-draft="${row.id}">Recuperar borrador</button><button type="button" data-discard-draft="${row.id}">Descartar</button></div></article>`).join(''):'<p>No hay borradores pendientes.</p>'}<h3>Generaciones recientes</h3><p>El reintento continúa el mismo trabajo y conserva su identificador.</p>${inbox.jobs.length?inbox.jobs.map(job=>`<article class="card"><strong>${esc(job.topic)}</strong><p>${esc(job.status==='completed'?'Lista para revisar':job.status==='failed'?'Interrumpida': 'En preparación')}</p><button type="button" data-recover-generation="${esc(job.request_id)}">${job.status==='completed'?'Abrir resultado':'Recuperar intento'}</button></article>`).join(''):'<p>No hay generaciones pendientes de incorporar.</p>'}`,()=>false);
  if(pending){
   $('downloadPendingRecovery').onclick=()=>{const blob=new Blob([JSON.stringify(pending,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='profesor-cambios-pendientes.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000)};
   if($('restorePendingRecovery'))$('restorePendingRecovery').onclick=async()=>{if(!confirm('¿Recuperar estos cambios pendientes en tu escritorio y guardarlos?'))return;const previous=state;try{state=clone(pending.state);normalizeTeacherState();if(!await save())throw Error('No se pudo guardar. Los cambios siguen conservados.');$('dialog').close();render()}catch(error){state=previous;notify(error.message)}};
  }
  $('form').querySelectorAll('[data-recover-draft]').forEach(button=>button.onclick=async()=>{try{const row=merged.get(button.dataset.recoverDraft),payload=row.local?row.payload:(await api('/api/profesor/editor-drafts/'+row.id)).draft;$('dialog').close();restoring={id:row.id,payload};setTimeout(()=>editActivity(payload.material),0)}catch(e){notify(e.message)}});
  $('form').querySelectorAll('[data-discard-draft]').forEach(button=>button.onclick=async()=>{if(!confirm('¿Descartar este borrador? El material guardado en la biblioteca no cambia.'))return;try{await discard(button.dataset.discardDraft);$('dialog').close();openRecovery()}catch(e){notify(e.message)}});
  $('form').querySelectorAll('[data-recover-generation]').forEach(button=>button.onclick=async()=>{
   try{const job=await api('/api/profesor/generation/'+button.dataset.recoverGeneration);
    $('dialog').close();
    if(job.status==='completed'&&job.result?.questions){const material={id:job.request_id,generationRequestId:job.request_id,title:job.context?.topic||'Material recuperado',subject:job.context?.subject||'Lengua',kind:'Actividad interactiva',body:'',activity:{version:1,context:job.context,questions:job.result.questions.map(q=>({...q,id:q.id||uid()}))}};setTimeout(()=>editActivity(material),0)}
    else{
     setTimeout(async()=>{
      modal('Recuperar generación','<p id="recoveryGenerationStatus" role="status">Consultando el mismo intento…</p>',()=>false);
      $('dialog').dataset.recoveryJob=job.request_id;
      $('dialog').addEventListener('close',()=>delete $('dialog').dataset.recoveryJob,{once:true});
      try{const material=await window.profesorResumeGeneration(job,$('recoveryGenerationStatus'));if($('dialog').dataset.recoveryJob!==job.request_id){notify('El material está listo en Recuperar trabajo.');return}$('dialog').close();setTimeout(()=>editActivity(material),0)}catch(error){if($('recoveryGenerationStatus'))$('recoveryGenerationStatus').textContent=error.message}
     },0)
    }
   }catch(e){notify(e.message)}
  });
 }
 document.addEventListener('click',event=>{if(event.target.closest('[data-action="recoverWork"]')){event.preventDefault();openRecovery().catch(e=>notify(e.message))}});
 const originalRender=render;
 render=function(...args){const result=originalRender(...args);if(accountId&&checkedAccount!==accountId){checkedAccount=accountId;api('/api/profesor/editor-drafts').then(data=>{noticeCount=data.drafts.length+ownRows().length;if(noticeCount||pendingState())notify('Tienes borradores disponibles en Perfil → Recuperar trabajo.')}).catch(()=>{})}return result};
 const style=document.createElement('style');style.textContent='.editor-leave-dialog{width:min(520px,calc(100vw - 28px));padding:26px;border:1px solid #bdd5f2;border-radius:22px;background:var(--look-dialog,#f5faff);color:var(--look-ink,#17365b);box-shadow:0 20px 80px #102b4955}.editor-leave-dialog::backdrop{background:#112e5559;backdrop-filter:blur(3px)}.editor-leave-dialog h2{margin:0 0 14px}.editor-leave-dialog p{line-height:1.6}.editor-leave-dialog .actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:12px}.editor-leave-dialog button{border-radius:var(--look-button-radius,12px);background:var(--look-button,#fff);border:1px solid var(--look-button-edge,#b6ceeb);padding:12px 16px;color:var(--look-button-ink,#1856a0)}.editor-leave-dialog .primary{background:var(--look-primary,#0868e9);color:var(--look-primary-ink,#fff)}';document.head.append(style);
})();
