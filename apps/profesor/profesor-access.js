let studentAccessData=null, studentAccessLoading=false, studentAccessError='';

function accessView(){
 if(!isPremium())return `<section class="access-page"><div class="access-empty"><h1>Accesos Alumnos · Premium</h1><p>Solicita acceso Premium para crear cuentas de alumno y compartir videollamadas.</p></div></section>`;
 const accounts=studentAccessData?.accesses||[],byStudent=new Map(accounts.map(a=>[a.student_id,a]));
 const meetConnected=studentAccessData?.google_meet_connected;
 const autoSetup=meetConnected
  ? '<span class="access-connection connected">● Google Meet conectado</span><button data-access-action="disconnect">Desconectar</button>'
  : studentAccessData?.google_meet_configured
   ? '<details class="access-auto-setup"><summary>Conexión automática opcional</summary><button data-access-action="connect">Conectar Google Meet</button></details>'
   : '';
 return `<section class="access-page"><div class="access-title"><div><span class="access-eyebrow">ESPACIO PREMIUM</span><h1>Accesos Alumnos</h1><p>Crea una cuenta para cada alumno y comparte su clase por Google Meet.</p></div><span class="access-count">${accounts.length} de ${state.students.length} con acceso</span></div><div class="access-setup"><div><strong>Comparte una videollamada</strong><small>Crea la reunión en Google Meet y pega su enlace en la tarjeta del alumno. No necesitas conectar tu cuenta.</small></div><div class="access-setup-actions"><a class="button" href="https://meet.google.com/" target="_blank" rel="noopener noreferrer">Abrir Google Meet ↗</a>${demo?'<span class="access-connection">Vista de demostración</span>':autoSetup}</div></div>${studentAccessError?`<p class="access-error" role="alert">${esc(studentAccessError)}</p>`:''}${studentAccessLoading?'<p class="access-loading">Cargando accesos…</p>':!state.students.length?'<div class="access-empty"><h2>Primero añade un alumno</h2><p>Sus accesos aparecerán aquí. Cada alumno tendrá su propia entrada y solo verá su videollamada.</p></div>':`<div class="access-grid">${state.students.map(s=>{const a=byStudent.get(s.id);return `<article class="access-card"><div class="access-card-top"><span class="access-avatar" data-color="${esc(s.cardColor||'sky')}">${esc(s.name.split(' ').slice(0,2).map(x=>x[0]).join(''))}</span><div><h2>${esc(s.name)}</h2><small>${esc(s.course||'Alumno')}</small></div><span class="access-status ${a?.active?'live':''}">${a?a.active?'Activo':'Pausado':'Sin acceso'}</span></div>${a?`<div class="access-info"><span>Usuario</span><strong>${esc(a.username)}</strong></div><div class="access-info"><span>Videollamada</span><strong>${a.meet_uri?'Enlace listo para el alumno':'Sin enlace todavía'}</strong></div><div class="access-card-actions"><button data-access-action="copy-user" data-id="${esc(a.id)}">Copiar usuario</button><button data-access-action="reset" data-id="${esc(a.id)}">Nueva contraseña</button><button data-access-action="toggle" data-id="${esc(a.id)}">${a.active?'Pausar':'Activar'}</button></div><div class="access-meet-actions">${a.meet_uri?`<a class="button" href="${esc(a.meet_uri)}" target="_blank" rel="noopener noreferrer">Entrar a Meet ↗</a><button data-access-action="paste-link" data-id="${esc(a.id)}">Cambiar enlace</button><button data-access-action="copy-link" data-id="${esc(a.id)}">Copiar enlace</button><button data-access-action="clear-link" data-id="${esc(a.id)}">Quitar enlace</button>${meetConnected?`<button data-access-action="replace-meet" data-id="${esc(a.id)}">Nuevo Meet</button>`:''}`:`<button class="primary" data-access-action="paste-link" data-id="${esc(a.id)}">Pegar enlace de Meet</button>${meetConnected?`<button data-access-action="create-meet" data-id="${esc(a.id)}">Generar automáticamente</button>`:''}`}</div>`:`<p class="access-card-note">Todavía no puede entrar. Crea sus credenciales para compartirle la clase.</p><button class="primary access-create" data-access-action="create" data-student="${esc(s.id)}">Crear acceso</button>`}</article>`}).join('')}</div>`}</section>`;
}

async function refreshAccesses(){
 if(view!=='Accesos'||!isPremium()||studentAccessLoading)return;
 if(demo){studentAccessData={accesses:[],google_meet_connected:false,google_meet_configured:false};studentAccessError='';render();return}
 const meetStatus=new URLSearchParams(location.search).get('meet');
 if(meetStatus){const next=new URL(location.href);next.searchParams.delete('meet');history.replaceState(null,'',next.pathname+next.search+next.hash)}
 studentAccessLoading=true;studentAccessError='';render();
 try{studentAccessData=await api('/api/profesor/access');if(meetStatus==='missing_refresh')studentAccessError='Google no devolvió el permiso necesario. Vuelve a conectar Meet o pega un enlace manual.';if(meetStatus==='error')studentAccessError='No se pudo completar la conexión con Google. Puedes reintentarlo o pegar un enlace manual.'}catch(err){studentAccessError=err.message}finally{studentAccessLoading=false;if(view==='Accesos')render()}
}

function accessRow(id){return studentAccessData?.accesses.find(a=>a.id===id)}
async function accessCopy(value,label){try{await navigator.clipboard.writeText(value);notify(label+' copiado.')}catch{throw Error('No se pudo copiar. Selecciona el texto y cópialo manualmente.')}}
function showStudentCredentials(a,password){modal('Credenciales de '+a.name,`<p>Comparte estos datos por un canal privado. La contraseña solo se muestra ahora. Después, pega el enlace de Meet en la tarjeta del alumno.</p><div class="access-credentials"><label>Usuario<input value="${esc(a.username)}" readonly></label><label>Contraseña<input value="${esc(password)}" readonly></label><label>Entrada<input value="${location.origin}/profesor/login" readonly></label></div><div class="actions"><button type="button" data-access-action="copy-credentials" data-username="${esc(a.username)}" data-password="${esc(password)}">Copiar datos</button>${button('Cerrar','close')}</div>`,()=>false)}

document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-access-action]');if(!b||b.disabled)return;
 event.preventDefault();const action=b.dataset.accessAction,a=accessRow(b.dataset.id);
 try{
  if(demo)throw Error('Entra con tu cuenta Premium para gestionar accesos.');
  if(action==='connect'){await api('/auth/me');location.href='/auth/google/meet';return}
  if(action==='create'){
   const s=student(b.dataset.student);if(!s)return;
   const candidate=s.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'').slice(0,35);
   modal('Crear acceso para '+s.name,`<p>El alumno entrará desde la pantalla habitual de inicio de sesión. Solo verá su espacio de videollamada.</p><label for="accessUsername">Nombre de usuario</label><input id="accessUsername" name="username" value="${esc(candidate+'.'+Math.floor(100+Math.random()*900))}" minlength="4" maxlength="80" pattern="[a-z0-9][a-z0-9._-]{3,79}" required autocomplete="off">${submit('Crear acceso')}`,async form=>{await saveQueue;const result=await api('/api/profesor/access',{student_id:s.id,username:String(form.get('username')).trim()});await refreshAccesses();setTimeout(()=>showStudentCredentials(result.access,result.password),0)});
  }
  if(action==='copy-credentials')await accessCopy(`Profesor Particular\n${location.origin}/profesor/login\nUsuario: ${b.dataset.username}\nContraseña: ${b.dataset.password}`,'Credenciales');
  if(action==='copy-user'&&a)await accessCopy(a.username,'Usuario');
  if(action==='copy-link'&&a)await accessCopy(a.meet_uri,'Enlace');
  if(action==='reset'&&a){if(!confirm('¿Crear una nueva contraseña para '+a.name+'? La anterior dejará de funcionar.'))return;b.disabled=true;const r=await api(`/api/profesor/access/${a.id}/reset-password`,{});showStudentCredentials(a,r.password)}
  if(action==='toggle'&&a){b.disabled=true;await api(`/api/profesor/access/${a.id}/active`,{active:!a.active});await refreshAccesses()}
  if(action==='paste-link'&&a){modal('Enlace de Meet para '+a.name,`<p>Pega el enlace de una reunión de Google Meet. Aparecerá en el espacio del alumno automáticamente.</p><label for="studentMeetUrl">Enlace de Google Meet</label><input id="studentMeetUrl" name="url" type="url" value="${esc(a.meet_uri)}" placeholder="https://meet.google.com/abc-defg-hij" required>${submit('Guardar enlace')}`,async form=>{await api(`/api/profesor/access/${a.id}/meet-link`,{url:String(form.get('url'))});await refreshAccesses()})}
  if(action==='create-meet'&&a){b.disabled=true;const r=await api(`/api/profesor/access/${a.id}/meet-create`,{replace:false});await refreshAccesses();notify(r.existing?'El enlace ya estaba creado.':'Sala creada y compartida con '+a.name+'.')}
  if(action==='replace-meet'&&a){if(!confirm('¿Crear un nuevo Meet para '+a.name+'? El enlace anterior dejará de mostrarse en su espacio.'))return;b.disabled=true;await api(`/api/profesor/access/${a.id}/meet-create`,{replace:true});await refreshAccesses();notify('Nuevo enlace compartido con '+a.name+'.')}
  if(action==='clear-link'&&a){if(!confirm('¿Quitar este enlace del espacio de '+a.name+'?'))return;b.disabled=true;await api(`/api/profesor/access/${a.id}/meet-clear`,{});await refreshAccesses()}
  if(action==='disconnect'){if(!confirm('¿Desconectar Google Meet? Los enlaces ya compartidos permanecerán visibles.'))return;await api('/auth/google/meet-disconnect',{});await refreshAccesses()}
 }catch(err){notify(err.message)}finally{if(b.isConnected)b.disabled=false}
});
