'use strict';
const $ = id => document.getElementById(id);
const userId = new URLSearchParams(location.search).get('user') || '';
const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
const base = `/admin/profesor-users/${encodeURIComponent(userId)}`;
let page = 1, total = 0, materialRequest = 0, detailRequest = 0, ready = false;
const names = {profesor_login:'Inicio de sesión',profesor_activity:'Apertura del escritorio',google:'Google',password:'Contraseña',
  user_updated:'Datos de cuenta actualizados',user_access_updated:'Acceso o plan actualizado',license_updated:'Licencia actualizada',
  profesor_account_viewed:'Consulta de la ficha',profesor_catalog_viewed:'Consulta del catálogo',
  completed:'Completada',failed:'Fallida',queued:'En cola',running:'En curso',pending:'Pendiente',active:'Activo',inactive:'Inactivo',
  save:'Guardado',restore:'Recuperación',account_change:'Cambio de cuenta',baseline:'Versión inicial',initial:'Versión inicial',daily:'Copia diaria',before_restore:'Antes de recuperar',before_clear:'Antes de vaciar',
  administration:'Administración',support:'Soporte',security:'Seguridad',
  pasapalabra:'Pasapalabra',hangman:'Ahorcado',wordsearch:'Sopa de letras',flashcard:'Flashcards',memory:'Memory',sentence:'Construye la frase',
  timeline:'Línea temporal',error:'Encuentra el error',crossword:'Crucigrama',dragdrop:'Arrastrar y soltar',pairs:'Relacionar parejas',gaps:'Completar frases',
  multigaps:'Completar huecos',numeric:'Respuesta numérica',quiz:'Quiz',short:'Respuesta corta',order:'Ordenar',classify:'Clasificar',boolean:'Verdadero o falso',
  reading:'Lectura',problem:'Problemas',load:'Carga del servicio',content:'Contenido no válido',other:'Otra incidencia'};
const label = value => names[value] || value || 'Sin registro';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function date(value){
  if(!value) return 'Sin registro';
  const raw = /(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? value : `${value}Z`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? 'Sin registro' : new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}).format(parsed);
}
function table(headers, rows){
  if(!rows.length) return '<div class="empty">No hay registros disponibles.</div>';
  return `<div class="table-wrap"><table><thead><tr>${headers.map(x=>`<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function details(rows){return rows.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('');}
function status(value){return `<span class="status ${['completed','active'].includes(value)?'ok':value==='failed'?'bad':''}">${esc(label(value))}</span>`;}
function notice(message,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);}
async function api(path){
  const token = localStorage.getItem('educa_admin_token');
  const response = await fetch(path,{credentials:'same-origin',cache:'no-store',headers:token?{Authorization:`Bearer ${token}`}:{}});
  if(response.status===401||response.status===403){
    $('content').hidden=true;ready=false;materialRequest++;detailRequest++;
    $('name').textContent='Acceso restringido';$('email').textContent='';$('avatar').textContent='P';
    $('content').querySelectorAll('dl, .table-wrap').forEach(el=>el.replaceChildren());
    throw new Error('Necesitas una sesión de administrador activa. Abre el dashboard, inicia sesión y vuelve a actualizar esta ficha.');
  }
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(typeof data.detail==='string'?data.detail:'No se ha podido consultar la cuenta.');
  return data;
}
const purpose = () => $('purpose').value;
async function load(){
  if(!validId){notice('El enlace de la cuenta no es válido.',true);$('name').textContent='Cuenta no válida';return;}
  const request=++detailRequest;materialRequest++;ready=false;$('content').hidden=true;
  $('refresh').disabled=true;notice('Consultando información…');
  try{
    const data=await api(`${base}?purpose=${purpose()}`);
    if(request!==detailRequest)return;
    const account=data.account,a=account.access||{},c=data.counts||{},activity=data.activity;
    $('name').textContent=account.full_name||'Profesor';$('email').textContent=account.email;
    $('avatar').textContent=(account.full_name||account.email).trim().slice(0,1).toUpperCase();
    $('metrics').innerHTML=[['Alumnos',c.students||0,'Fichas privadas actuales'],['Materiales',c.library||0,'Guardados actualmente'],['Clases',c.sessions||0,'En la planificación'],['Tareas',c.tasks||0,'Guardadas en el escritorio']].map(([k,v,h])=>`<article class="metric"><span>${esc(k)}</span><strong>${v}</strong><small>${esc(h)}</small></article>`).join('');
    $('account').innerHTML=details([['Alta',date(account.created_at)],['Cuenta',account.is_active?'Activa':'Bloqueada'],['Acceso',a.effective_status==='active'?'Activo':'Inactivo'],['Plan',a.plan==='PROFESOR_PREMIUM'?'Premium':'Normal'],['Vencimiento',date(a.expires_at)],['Créditos disponibles',a.unlimited?'Sin límite':a.available_credits??'Sin registro'],['Créditos gastados',a.used_credits??'Sin registro'],['Google vinculado',account.google_linked?'Sí':'No'],['Drive / Meet',`${account.drive_connected?'Conectado':'No conectado'} / ${account.meet_connected?'Conectado':'No conectado'}`],['Temas propios / subidos',`${c.personalTopics||0} / ${c.uploadedTopics||0}`],['Sesiones de juego vigentes',Object.values(data.live_sessions).reduce((x,y)=>x+y,0)],['Versión del escritorio',data.revision]]);
    $('activity').innerHTML=details([['Último inicio de sesión',date(activity.last_login_at)],['Última apertura registrada',date(activity.last_open_at)],['Último guardado',date(data.last_saved_at)],['Última copia conservada',date(data.last_backup_at)],['Inicios de sesión · 7 días',activity.logins_7d],['Inicios de sesión · 30 días',activity.logins_30d],['Conservación del registro',`${activity.retention_days} días`]]);
    $('events').innerHTML=table(['Fecha · Madrid','Evento','Método'],activity.events.map(e=>[esc(date(e.at)),esc(label(e.type)),e.method?esc(label(e.method)):'—']));
    $('generationSummary').textContent=Object.entries(data.generation_counts).map(([k,v])=>`${label(k)}: ${v}`).join(' · ')||'No hay trabajos conservados de generación.';
    $('generations').innerHTML=table(['Fecha · Madrid','Estado','Intentos','Incidencia','Código de solicitud'],data.generations.map(g=>[esc(date(g.created_at)),status(g.status),esc(g.attempts),g.failure_category?esc(label(g.failure_category)):'—',`<code>${esc(g.request_id)}</code>`]));
    $('usage').innerHTML=table(['Fecha · Madrid','Modelo','Tokens de entrada','Tokens de salida'],data.usage.map(u=>[esc(date(u.at)),esc(u.model),esc(u.input_tokens),esc(u.output_tokens)]));
    $('versions').innerHTML=table(['Versión','Fecha · Madrid','Origen','Alumnos','Materiales','Clases','Tareas'],data.versions.map(v=>[esc(v.revision),esc(date(v.at)),esc(label(v.reason)),v.counts.students||0,v.counts.library||0,v.counts.sessions||0,v.counts.tasks||0]));
    $('changes').innerHTML=table(['Fecha · Madrid','Acción','Motivo','Realizada por'],data.changes.map(e=>[esc(date(e.at)),esc(label(e.action)),e.purpose?esc(label(e.purpose)):'—',esc(e.actor_name||e.actor_id||'Sin registro')]));
    $('content').hidden=false;ready=true;page=1;
    notice('Ficha actualizada. Las cifras reflejan los datos conservados; las consultas administrativas quedan registradas.');
    if(!$('materials').hidden)await loadMaterials();
  }catch(error){if(request===detailRequest)notice(error.message,true);else if(!ready)notice(error.message,true);}
  finally{$('refresh').disabled=false;}
}
function options(id,items,all){
  const selected=$(id).value;
  $(id).replaceChildren(new Option(all,''),...items.map(x=>new Option(x,x)));
  $(id).value=items.includes(selected)?selected:'';
}
async function loadMaterials(){
  if(!ready)return;
  const request=++materialRequest;
  $('materialRows').innerHTML='<div class="empty">Consultando materiales…</div>';
  $('previous').disabled=true;$('next').disabled=true;
  const params=new URLSearchParams({page:String(page),q:$('search').value.trim(),subject:$('subject').value,kind:$('kind').value,purpose:purpose()});
  try{
    const data=await api(`${base}/materials?${params}`);
    if(request!==materialRequest||!ready)return;
    total=data.total;options('subject',data.subjects,'Todas las asignaturas');options('kind',data.kinds,'Todos los formatos');
    $('materialTotal').textContent=`${total} materiales`;
    $('materialRows').innerHTML=table(['Material','Asignatura / curso','Ejercicios','Actividades','Creación / actualización'],data.materials.map(m=>[`<strong>${esc(m.title||'Sin título')}</strong><br><span class="muted">${esc(m.kind)}</span>`,`${esc(m.subject||'—')}<br><span class="muted">${esc(m.course||'—')}</span>`,esc(m.types.map(label).join(', ')||'—'),esc(m.questions),`${esc(date(m.created_at))}<br><span class="muted">${esc(date(m.updated_at))}</span>`]));
    $('pageLabel').textContent=`${page} / ${Math.max(1,Math.ceil(total/25))}`;
    $('previous').disabled=page<=1;$('next').disabled=page*25>=total;
  }catch(error){if(request===materialRequest){$('materialRows').textContent=error.message;notice(error.message,true);}}
}
document.querySelectorAll('[data-panel]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  document.querySelectorAll('.panel').forEach(panel=>panel.hidden=panel.id!==button.dataset.panel);
  if(button.dataset.panel==='materials')loadMaterials();
}));
$('refresh').addEventListener('click',load);
$('purpose').addEventListener('change',load);
let searchTimer;
$('search').addEventListener('input',()=>{clearTimeout(searchTimer);materialRequest++;searchTimer=setTimeout(()=>{page=1;loadMaterials();},300);});
['subject','kind'].forEach(id=>$(id).addEventListener('change',()=>{page=1;loadMaterials();}));
$('previous').addEventListener('click',()=>{if(page>1){page--;loadMaterials();}});
$('next').addEventListener('click',()=>{if(page*25<total){page++;loadMaterials();}});
window.addEventListener('storage',event=>{if(event.key==='educa_admin_token')load();});
load();
