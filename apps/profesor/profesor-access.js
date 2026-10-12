let studentAccessData=null, studentLiveSessions=[], studentAccessLoading=false, studentAccessError='';

function accessView(){
 if(!isPremium())return `<section class="access-page"><div class="access-empty"><h1>Sesiones de alumnos · Premium</h1><p>Con Premium puedes crear sesiones con un código distinto para cada alumno y seguir sus respuestas en directo.</p></div></section>`;
 const byStudent=new Map((studentAccessData?.accesses||[]).map(a=>[a.student_id,a]));
 const card=s=>{
  const name=String(s.name||'Alumno'),initials=name.split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase(),a=byStudent.get(s.id);
  const sessions=studentLiveSessions.filter(item=>item.student_id===s.id&&item.join_code);
  return `<article class="access-card" aria-label="Sesiones de ${esc(name)}"><div class="access-card-person"><span class="access-avatar" data-color="${esc(s.cardColor||'sky')}">${esc(initials)}</span><div class="access-person-copy"><h2>${esc(name)}</h2><p>${esc(s.course||'Alumno')}</p><span class="access-status ${sessions.length?'live':''}"><i></i>${sessions.length?`${sessions.length} ${sessions.length===1?'sesión abierta':'sesiones abiertas'}`:'Sin sesión abierta'}</span></div></div><div class="access-card-credentials"><strong>Códigos de clase</strong>${sessions.length?sessions.map(item=>`<div class="access-session-code"><span><b>${esc(item.title)}</b><small>${item.status==='in_progress'?'En curso':'Esperando al alumno'}</small></span><code>${esc(item.join_code)}</code><button type="button" data-access-action="copy-code" data-code="${esc(item.join_code)}" aria-label="Copiar código de ${esc(item.title)}">Copiar</button><button type="button" data-live-teacher="watch" data-id="${esc(item.id)}">Ver directo</button></div>`).join(''):'<p>Al crear una sesión aparecerá aquí el código que debe introducir el alumno.</p>'}<small>El alumno entra en <a href="/profesor/alumno" target="_blank" rel="noopener">educame.tech/profesor/alumno</a>.</small></div><div class="access-card-controls"><button class="primary" type="button" data-live-teacher="create" data-student-id="${esc(s.id)}">＋ Crear sesión</button>${a?`<button type="button" data-live-teacher="student-watch" data-access-id="${esc(a.id)}">Ver sesiones en directo</button><button type="button" data-access-action="paste-link" data-id="${esc(a.id)}">${a.meet_uri?'Cambiar enlace de Meet':'Pegar enlace de Meet'}</button>${a.meet_uri?`<button type="button" data-access-action="clear-link" data-id="${esc(a.id)}">Quitar enlace de Meet</button>`:''}`:''}</div></article>`;
 };
 return `<section class="access-page"><div class="access-page-heading"><h1>Sesiones de alumnos</h1><p>Crea una sesión para cada alumno, comparte su código y observa cómo resuelve el material. No necesita cuenta ni contraseña.</p></div>${studentAccessError?`<p class="access-error" role="alert">${esc(studentAccessError)}</p>`:''}${studentAccessLoading?'<p class="access-loading">Cargando sesiones…</p>':!state.students.length?'<div class="access-empty"><h2>Primero añade un alumno</h2><p>Después podrás crearle una sesión con código.</p></div>':`<div class="access-grid">${state.students.map(card).join('')}</div>`}</section>`;
}

async function refreshAccesses(){
 if(view!=='Accesos'||!isPremium()||studentAccessLoading)return;
 if(demo){studentAccessData={accesses:[]};studentLiveSessions=[];studentAccessError='';render();return}
 studentAccessLoading=true;studentAccessError='';render();
 try{const [accesses,sessions]=await Promise.all([api('/api/profesor/session-students'),api('/api/profesor/material-sessions')]);studentAccessData=accesses;studentLiveSessions=sessions.sessions||[]}catch(error){studentAccessError=error.message}finally{studentAccessLoading=false;if(view==='Accesos')render()}
}

function accessRow(id){return studentAccessData?.accesses.find(a=>a.id===id)}
async function accessCopy(value,label){try{await navigator.clipboard.writeText(value);notify(label+' copiado.')}catch{throw Error('No se pudo copiar. Selecciona el texto y cópialo manualmente.')}}
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-access-action]');if(!b||b.disabled)return;
 event.preventDefault();const action=b.dataset.accessAction,a=accessRow(b.dataset.id);
 try{
  if(action==='copy-code')return await accessCopy(b.dataset.code,'Código');
  if(demo)throw Error('Entra con tu cuenta Premium para gestionar sesiones.');
  if(action==='paste-link'&&a){modal('Enlace de Meet para '+a.name,`<p>El enlace aparecerá en las sesiones de este alumno.</p><label for="studentMeetUrl">Enlace de Google Meet</label><input id="studentMeetUrl" name="url" type="url" value="${esc(a.meet_uri)}" placeholder="https://meet.google.com/abc-defg-hij" required>${submit('Guardar enlace')}`,async form=>{await api(`/api/profesor/access/${a.id}/meet-link`,{url:String(form.get('url'))});await refreshAccesses()})}
  if(action==='clear-link'&&a){if(!confirm('¿Quitar este enlace del espacio de '+a.name+'?'))return;b.disabled=true;await api(`/api/profesor/access/${a.id}/meet-clear`,{});await refreshAccesses()}
 }catch(error){notify(error.message)}finally{if(b.isConnected)b.disabled=false}
});
