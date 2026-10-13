let studentLiveSessions=[], studentAccessLoading=false, studentAccessError='';

function accessView(){
 if(!isPremium())return `<section class="access-page" aria-label="Sesiones de juegos"><div class="access-empty"><h2>Activa las sesiones con Premium</h2><p>Comparte un código para que otra persona juegue sin crear una cuenta.</p></div></section>`;
 const materials=state.library.filter(item=>item.activity?.questions?.length);
 const cards=studentLiveSessions.map(item=>`<article class="access-card"><div class="access-card-person"><span class="access-avatar">✦</span><div class="access-person-copy"><h2>${esc(item.title)}</h2><p>${esc(item.subject)}</p><span class="access-status ${item.status==='in_progress'?'live':''}"><i></i>${item.status==='pending'?'Esperando participante':item.status==='in_progress'?'En curso':item.status==='completed'?'Terminada':item.status==='expired'?'Caducada':'Cerrada'}</span></div></div><div class="access-card-credentials"><strong>Código de esta sesión</strong>${item.join_code?`<div class="access-session-code"><code>${esc(item.join_code)}</code><button type="button" data-access-action="copy-code" data-code="${esc(item.join_code)}">Copiar</button></div><small>Válido hasta ${esc(new Date(item.expires_at).toLocaleString('es-ES'))}. Abrir en <a href="/profesor/alumno" target="_blank" rel="noopener">educame.tech/profesor/alumno</a>.</small>`:'<p>La sesión ya no admite nuevas entradas.</p>'}</div><div class="access-card-controls"><button type="button" data-live-teacher="watch" data-id="${esc(item.id)}">Ver sesión</button></div></article>`).join('');
 return `<section class="access-page" aria-label="Sesiones de juegos"><div class="access-page-actions"><button class="primary" type="button" data-live-teacher="create-anonymous" ${materials.length?'':'disabled'}>＋ Crear sesión</button></div>${studentAccessError?`<p class="access-error" role="alert">${esc(studentAccessError)}</p>`:''}${studentAccessLoading?'<p class="access-loading">Cargando sesiones…</p>':cards?`<div class="access-grid">${cards}</div>`:'<div class="access-empty"><h2>Aún no hay sesiones</h2><p>Crea un material interactivo y después una sesión con código.</p></div>'}</section>`;
}

async function refreshAccesses(){
 if(view!=='Accesos'||!isPremium()||studentAccessLoading)return;
 if(demo){studentLiveSessions=[];studentAccessError='';render();return}
 studentAccessLoading=true;studentAccessError='';render();
 try{studentLiveSessions=(await api('/api/profesor/material-sessions')).sessions||[]}
 catch(error){studentAccessError=error.message}
 finally{studentAccessLoading=false;if(view==='Accesos')render()}
}

document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-access-action="copy-code"]');if(!button)return;
 try{await navigator.clipboard.writeText(button.dataset.code);notify('Código copiado.')}
 catch{notify('Selecciona el código y cópialo manualmente.')}
});
