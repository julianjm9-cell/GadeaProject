let studentAccessData=null, studentAccessLoading=false, studentAccessError='';

function accessView(){
 if(!isPremium())return `<section class="access-page"><div class="access-empty"><h1>Accesos Alumnos · Premium</h1><p>Solicita acceso Premium para crear cuentas de alumno y compartir videollamadas.</p></div></section>`;
 const accounts=studentAccessData?.accesses||[],byStudent=new Map(accounts.map(a=>[a.student_id,a]));
 const card=(s,a)=>{
  const name=String(s.name||'Alumno'),initials=name.split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase();
  const credential=(label,value,action)=>`<label class="access-credential"><span>${icon('users')} ${label}</span><span class="access-credential-value"><input value="${esc(value||'')}" placeholder="${a?label==='Contraseña'?'Contraseña anterior no recuperable':'Sin usuario':'Crea un acceso'}" aria-label="${label} de ${esc(name)}" readonly><button type="button" data-access-action="${action}" data-id="${esc(a?.id||'')}" aria-label="Copiar ${label.toLowerCase()} de ${esc(name)}" ${!value?'disabled':''}>${icon('cards')}</button></span></label>`;
  return `<article class="access-card" aria-label="Acceso de ${esc(name)}"><div class="access-card-person"><span class="access-avatar" data-color="${esc(s.cardColor||'sky')}">${esc(initials)}</span><div class="access-person-copy"><h2>${esc(name)}</h2><p>${esc(s.course||'Alumno')}</p><span class="access-status ${a?.active?'live':''}"><i></i>${a?a.active?'Activo':'Pausado':'Sin acceso'}</span></div></div><div class="access-card-credentials">${credential('Usuario',a?.username,'copy-user')}${credential('Contraseña',a?.password,'copy-password')}${a&&!a.password?'<small class="access-legacy-note">La clave antigua no se puede recuperar. Genera una nueva para verla aquí.</small>':''}${a?.meet_uri?'<small class="access-meet-ready">● Enlace de Meet disponible para el alumno</small>':''}</div><div class="access-card-controls">${a?`<button class="primary" data-access-action="paste-link" data-id="${esc(a.id)}">${icon('link')} ${a.meet_uri?'Cambiar enlace de Meet':'Pegar enlace de Meet'}</button><button data-access-action="reset" data-id="${esc(a.id)}">${icon('cards')} Nueva contraseña</button><div class="access-control-pair"><button data-access-action="toggle" data-id="${esc(a.id)}">${a.active?'Ⅱ Pausar':'▶ Activar'}</button><button data-live-teacher="student-watch" data-access-id="${esc(a.id)}">${icon('search')} Ver directo</button></div>${a.meet_uri?`<details class="access-more"><summary>Opciones del enlace</summary><div><button data-access-action="copy-link" data-id="${esc(a.id)}">Copiar enlace</button><button data-access-action="clear-link" data-id="${esc(a.id)}">Quitar enlace</button></div></details>`:''}`:`<p>Este alumno todavía no tiene cuenta.</p><button class="primary access-create" data-access-action="create" data-student="${esc(s.id)}">Crear acceso de alumno</button>`}</div></article>`;
 };
 return `<section class="access-page">${studentAccessError?`<p class="access-error" role="alert">${esc(studentAccessError)}</p>`:''}${studentAccessLoading?'<p class="access-loading">Cargando accesos…</p>':!state.students.length?'<div class="access-empty"><h2>Primero añade un alumno</h2><p>Sus accesos aparecerán aquí.</p></div>':`<div class="access-grid">${state.students.map(s=>card(s,byStudent.get(s.id))).join('')}</div>`}</section>`;
}

async function refreshAccesses(){
 if(view!=='Accesos'||!isPremium()||studentAccessLoading)return;
 if(demo){studentAccessData={accesses:[],google_meet_connected:false,google_meet_configured:false};studentAccessError='';render();return}
 const meetStatus=new URLSearchParams(location.search).get('meet');
 if(meetStatus){const next=new URL(location.href);next.searchParams.delete('meet');history.replaceState(null,'',next.pathname+next.search+next.hash)}
 studentAccessLoading=true;studentAccessError='';render();
 try{studentAccessData=await api('/api/profesor/access');if(meetStatus==='missing_refresh'||meetStatus==='error')studentAccessError='La conexión automática con Google Meet no se ha completado. Puedes pegar un enlace en la tarjeta del alumno.'}catch(err){studentAccessError=err.message}finally{studentAccessLoading=false;if(view==='Accesos')render()}
}

function accessRow(id){return studentAccessData?.accesses.find(a=>a.id===id)}
async function accessCopy(value,label){try{await navigator.clipboard.writeText(value);notify(label+' copiado.')}catch{throw Error('No se pudo copiar. Selecciona el texto y cópialo manualmente.')}}
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-access-action]');if(!b||b.disabled)return;
 event.preventDefault();const action=b.dataset.accessAction,a=accessRow(b.dataset.id);
 try{
  if(demo)throw Error('Entra con tu cuenta Premium para gestionar accesos.');
  if(action==='create'){
   const s=student(b.dataset.student);if(!s)return;
   const candidate=s.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'').slice(0,35);
   modal('Crear acceso para '+s.name,`<p>El alumno entrará desde la pantalla habitual de inicio de sesión. Su usuario y contraseña quedarán visibles en esta tarjeta.</p><label for="accessUsername">Nombre de usuario</label><input id="accessUsername" name="username" value="${esc(candidate+'.'+Math.floor(100+Math.random()*900))}" minlength="4" maxlength="80" pattern="[a-z0-9][a-z0-9._-]{3,79}" required autocomplete="off">${submit('Crear acceso')}`,async form=>{await saveQueue;await api('/api/profesor/access',{student_id:s.id,username:String(form.get('username')).trim()});await refreshAccesses();notify('Acceso creado. Ya puedes copiar el usuario y la contraseña desde su tarjeta.')});
  }
  if(action==='copy-user'&&a)await accessCopy(a.username,'Usuario');
  if(action==='copy-password'&&a?.password)await accessCopy(a.password,'Contraseña');
  if(action==='copy-link'&&a)await accessCopy(a.meet_uri,'Enlace');
  if(action==='reset'&&a){if(!confirm('¿Crear una nueva contraseña para '+a.name+'? La anterior dejará de funcionar.'))return;b.disabled=true;await api(`/api/profesor/access/${a.id}/reset-password`,{});await refreshAccesses();notify('Contraseña actualizada. Cópiala desde la tarjeta del alumno.')}
  if(action==='toggle'&&a){b.disabled=true;await api(`/api/profesor/access/${a.id}/active`,{active:!a.active});await refreshAccesses()}
  if(action==='paste-link'&&a){modal('Enlace de Meet para '+a.name,`<p>Pega el enlace de una reunión de Google Meet. Aparecerá en el espacio del alumno automáticamente.</p><label for="studentMeetUrl">Enlace de Google Meet</label><input id="studentMeetUrl" name="url" type="url" value="${esc(a.meet_uri)}" placeholder="https://meet.google.com/abc-defg-hij" required>${submit('Guardar enlace')}`,async form=>{await api(`/api/profesor/access/${a.id}/meet-link`,{url:String(form.get('url'))});await refreshAccesses()})}
  if(action==='clear-link'&&a){if(!confirm('¿Quitar este enlace del espacio de '+a.name+'?'))return;b.disabled=true;await api(`/api/profesor/access/${a.id}/meet-clear`,{});await refreshAccesses()}
 }catch(err){notify(err.message)}finally{if(b.isConnected)b.disabled=false}
});
