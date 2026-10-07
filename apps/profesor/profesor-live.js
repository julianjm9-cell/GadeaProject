/* Shared student player and read-only teacher view for delivered materials. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const rich = value => window.profesorText?.rich ? window.profesorText.rich(value) : escape(value);
  const errorExample = prompt => {const quoted=[...String(prompt).matchAll(/[«“"]([^«»“”"]+)[»”"]/g)];return quoted.length?quoted.at(-1)[1]:String(prompt).split(/:\s*/).at(-1).trim()};
  const timelineLabel = (value,reveal) => reveal?String(value):String(value).replace(/\b(?:1\d{3}|20\d{2})\b/g,'año oculto').replace(/\baño oculto\s*[–—:-]\s*/gi,'')||'Fecha oculta';
  const labels = {pairs:'Relacionar',gaps:'Completar',multigaps:'Texto con huecos',numeric:'Respuesta numérica',quiz:'Elegir respuesta',short:'Respuesta breve',order:'Ordenar',classify:'Clasificar',boolean:'Verdadero / Falso',reading:'Comprensión',problem:'Problemas',flashcard:'Flashcards',memory:'Memory',sentence:'Construye la frase',timeline:'Línea temporal',error:'Encuentra el error',wordsearch:'Sopa de letras',crossword:'Crucigrama',dragdrop:'Arrastrar y soltar',pasapalabra:'Pasapalabra',hangman:'Ahorcado',visualquiz:'Quiz visual',imagepoint:'Señalar imagen'};
  const choice = new Set(['pairs','quiz','boolean','classify','visualquiz']);
  const sequence = new Set(['order','sentence','timeline']);
  const open = new Set(['short','reading','problem','error']);
  const studentRoot = document.getElementById('studentMaterials');
  let active = null, activeWord = 0, activeLetter = 0, pickedCell = null, firstCard = null, saving = Promise.resolve(), draftTimer = null, lastList = '', watcher = null, reviewIndex = null, teacherReviewIndex = null, watchedSession = null;
  const val = (session, n) => session.progress?.responses?.[String(n)];
  const grade = (session, n) => session.progress?.grades?.[String(n)];
  const partGrade = (session, n, part) => session.progress?.parts?.[String(n)]?.[String(part)];
  const option = (label, selected, action, value, disabled) => `<button type="button" class="live-option ${selected?'selected':''}" data-live-action="${action}" data-value="${escape(value)}" ${disabled?'disabled':''}>${label}</button>`;
  const image = (session, q, teacher) => q.image ? `<img class="live-image" src="${teacher?'/api/profesor/materials/'+encodeURIComponent(q.image.id)+'/preview?app=profesor_particular':'/api/profesor/student-material-sessions/'+encodeURIComponent(session.id)+'/images/'+encodeURIComponent(q.image.id)}" alt="${escape(q.image.filename)}">` : '';
  function summaryValue(value) {
    if (value == null || value === '') return 'Aún sin responder';
    if (Array.isArray(value)) return value.map(item => Array.isArray(item) ? item.join(' → ') : typeof item === 'object' ? JSON.stringify(item) : String(item)).join(' · ') || 'Aún sin responder';
    if (typeof value === 'object') return [value.selected ? `Error: ${value.selected}` : '', value.correction ? `Corrección: ${value.correction}` : ''].filter(Boolean).join(' · ') || 'Aún sin responder';
    return String(value);
  }
  function questionMarkup(session, n, teacher = false) {
    const q = session.questions[n], response = val(session,n), result=grade(session,n), locked = teacher || session.status==='completed';
    const disabled=locked?'disabled':'', kind=q.type;
    let controls='';
    if(choice.has(kind)) {
      controls=`<div class="live-options">${(q.options||[]).map((item,i)=>option(`<b>${String.fromCharCode(65+i)}</b><span>${escape(item)}</span>`,response===item,'choice',item,locked)).join('')}</div>`;
      if(!q.options?.length)controls=`<input class="live-text" data-live-field="text" value="${escape(response||'')}" placeholder="Escribe la respuesta" ${disabled}>`;
    } else if(kind==='gaps') {
      const parts=q.prompt.split('___');controls=`<div class="live-gap">${rich(parts[0])}<input data-live-field="text" value="${escape(response||'')}" aria-label="Completa el hueco" ${disabled}>${rich(parts.slice(1).join('___'))}</div>`;
    } else if(kind==='multigaps') {
      const parts=q.prompt.split('___'), answers=Array.isArray(response)?response:[];
      controls=`<div class="live-gap">${parts.map((text,i)=>`${rich(text)}${i<q.count?`<input data-live-field="part" data-part="${i}" value="${escape(answers[i]||'')}" aria-label="Hueco ${i+1}" ${disabled}>${locked?'':`<button type="button" data-live-action="check-part" data-part="${i}" aria-label="Comprobar hueco ${i+1}">✓</button>`}<small class="live-mini-result ${partGrade(session,n,i)||''}">${partGrade(session,n,i)==='correct'?'✓':partGrade(session,n,i)==='incorrect'?'×':''}</small>`:''}`).join('')}</div>`;
    } else if(sequence.has(kind)) {
      const steps=Array.isArray(response)?response:q.options||[];
      controls=`<p class="live-hint">Ordena los elementos con las flechas.${kind==='timeline'?' Las fechas aparecerán al comprobar.':''}</p><div class="live-stack">${steps.map((item,i)=>{const label=kind==='timeline'?timelineLabel(item,!!result):item;return `<div class="live-stack-row ${kind==='timeline'&&result?partGrade(session,n,i)||'':''}"><b>${i+1}.</b><span>${escape(label)}</span><button type="button" data-live-action="move" data-pos="${i}" data-dir="-1" ${locked||i===0?'disabled':''} aria-label="Subir ${escape(label)}">↑</button><button type="button" data-live-action="move" data-pos="${i}" data-dir="1" ${locked||i===steps.length-1?'disabled':''} aria-label="Bajar ${escape(label)}">↓</button></div>`}).join('')}</div>`;
    } else if(kind==='pasapalabra') {
      const entries=q.entries||[], answers=Array.isArray(response)?response:[], focused=session.progress?.focus?.question_index===n?session.progress.focus.part:null,current=Math.min(teacher&&focused!=null?focused:activeLetter,entries.length-1);
      controls=`<div class="live-rosco" style="--letter-size:${entries.length>22?32:entries.length>14?44:58}px;--mobile-letter-size:${entries.length>22?28:entries.length>14?35:46}px" aria-label="Rosco de Pasapalabra">${entries.map((entry,i)=>{const angle=2*Math.PI*i/Math.max(entries.length,1);return `<button type="button" style="left:${(50+40*Math.sin(angle)).toFixed(2)}%;top:${(50-40*Math.cos(angle)).toFixed(2)}%" data-live-action="letter" data-index="${i}" class="${i===current?'active':''} ${partGrade(session,n,i)||''}" aria-label="Letra ${escape(entry.letter)}" ${locked?'disabled':''}>${partGrade(session,n,i)==='incorrect'?'×':escape(entry.letter)}${partGrade(session,n,i)==='correct'?'<small>✓</small>':''}</button>`}).join('')}<span class="live-rosco-center">${escape(session.title)}</span></div><div class="live-clue"><strong>${escape(entries[current]?.letter||'')}</strong><p>${rich(entries[current]?.clue||'')}</p><input data-live-field="part" data-part="${current}" value="${escape(answers[current]||'')}" placeholder="Tu respuesta" ${disabled}><div class="live-inline-actions">${!teacher&&q.hints?.length?'<button type="button" data-live-action="hint">♧ Necesito una pista</button>':''}<button type="button" data-live-action="check-part" data-part="${current}" class="live-primary" ${disabled}>✓ Confirmar</button></div><button type="button" class="live-pass" data-live-action="pass" ${disabled}>Pasapalabra →</button></div>`;
    } else if(kind==='dragdrop') {
      const values=Array.isArray(response)?response:[];
      controls=`<p class="live-hint">Elige un destino para cada pieza.</p><div class="live-stack">${(q.items||[]).map((item,i)=>`<label class="live-assign"><strong>${escape(item)}</strong><select data-live-field="part" data-part="${i}" ${disabled}><option value="">Elige destino…</option>${(q.targets||[]).map(target=>`<option value="${escape(target)}" ${values[i]===target?'selected':''}>${escape(target)}</option>`).join('')}</select><small class="${partGrade(session,n,i)||''}">${partGrade(session,n,i)==='correct'?'✓':partGrade(session,n,i)==='incorrect'?'×':''}</small></label>`).join('')}</div>`;
    } else if(kind==='memory') {
      const matched=Array.isArray(response)?response:[], tokens=new Set(matched.flat()), selected=teacher&&session.progress?.focus?.question_index===n?session.progress.focus.token:firstCard;
      controls=`<p class="live-hint">Destapa dos tarjetas y encuentra las parejas.</p><div class="live-memory">${(q.cards||[]).map((card,i)=>`<button type="button" data-live-action="card" data-value="${escape(card.token)}" class="${tokens.has(card.token)?'matched':selected===card.token?'flipped':''}" ${locked||tokens.has(card.token)?'disabled':''}>${tokens.has(card.token)||selected===card.token?escape(card.label):'?'}${tokens.has(card.token)?'<small>✓</small>':''}</button>`).join('')}</div><p>${matched.length} de ${(q.cards||[]).length/2} parejas encontradas</p>`;
    } else if(kind==='wordsearch') {
      const found=Array.isArray(response)?response:[], size=q.grid?.length||0, paths=new Set(found.flatMap(path=>Array.isArray(path)?path.map(cell=>cell.join('-')):[])),focused=session.progress?.focus?.question_index===n?session.progress.focus.part:null,word=teacher&&focused!=null?focused:activeWord;
      controls=`<p class="live-hint">Elige una palabra y marca su primera y última letra.</p><div class="live-words">${(q.words||[]).map((item,i)=>`<button type="button" data-live-action="word" data-index="${i}" class="${i===word?'active':''} ${partGrade(session,n,i)||''}" ${locked?'disabled':''}>${escape(item)}</button>`).join('')}</div><div class="live-word-grid" style="--size:${size}">${(q.grid||[]).flatMap((row,r)=>row.map((letter,c)=>`<button type="button" data-live-action="cell" data-row="${r}" data-col="${c}" class="${paths.has(r+'-'+c)?'found':''} ${pickedCell?.[0]===r&&pickedCell?.[1]===c?'picked':''}" ${locked?'disabled':''} aria-label="Fila ${r+1}, columna ${c+1}: ${escape(letter)}">${escape(letter)}</button>`)).join('')}</div>`;
    } else if(kind==='crossword') {
      const words=Array.isArray(response)?response:[], letters={};(q.entries||[]).forEach(entry=>[...(words[entry.number-1]||'')].forEach((letter,i)=>{letters[(entry.row+(entry.direction==='down'?i:0))+'-'+(entry.col+(entry.direction==='across'?i:0))]=letter}));
      controls=`<div class="live-crossword" style="--size:${q.grid?.[0]?.length||1}">${(q.grid||[]).flatMap((row,r)=>row.map((on,c)=>on?`<span>${escape(letters[r+'-'+c]||'')}</span>`:'<span class="blank"></span>')).join('')}</div><div class="live-clues">${(q.entries||[]).map(entry=>`<label><span>${entry.number}. ${entry.direction==='down'?'↓':'→'} ${rich(entry.clue)} <small>(${entry.length})</small></span><input data-live-field="part" data-part="${entry.number-1}" value="${escape(words[entry.number-1]||'')}" maxlength="${entry.length}" ${disabled}>${locked?'':`<button type="button" data-live-action="check-part" data-part="${entry.number-1}" aria-label="Comprobar palabra ${entry.number}">✓</button>`}<small class="${partGrade(session,n,entry.number-1)||''}">${partGrade(session,n,entry.number-1)==='correct'?'✓':partGrade(session,n,entry.number-1)==='incorrect'?'×':''}</small></label>`).join('')}</div>`;
    } else if(kind==='hangman') {
      const chosen=Array.isArray(response)?response:[];
      controls=`<div class="live-hangman"><strong>${escape(q.mask||'_'.repeat(q.length||0))}</strong><small>${q.errors||0} de 7 fallos</small></div><div class="live-letters">${[...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'].map(letter=>`<button type="button" data-live-action="guess" data-value="${letter}" ${locked||chosen.includes(letter)||q.errors>=7?'disabled':''} class="${chosen.includes(letter)?(q.mask||'').includes(letter)?'correct':'incorrect':''}">${letter}</button>`).join('')}</div>`;
    } else if(kind==='imagepoint') {
      const point=Array.isArray(response)?response:null;
      controls=`<div class="live-image-point" data-live-action="point">${image(session,q,teacher)}${point?`<span style="left:${Math.max(0,Math.min(100,Number(point[0])||0))}%;top:${Math.max(0,Math.min(100,Number(point[1])||0))}%">●</span>`:''}</div><p class="live-hint">Toca el lugar correcto en la imagen.</p>`;
    } else if(kind==='flashcard') {
      controls=q.revealed_answer!=null?`<div class="live-flash-back">${rich(q.revealed_answer)}</div>${locked?'':`<p>¿La sabías?</p><div class="live-options">${[['correct','✓ La sabía'],['partial','◷ Con ayuda'],['incorrect','↻ Repasar']].map(([value,label])=>option(label,response===value,'flash-grade',value,false)).join('')}</div>`}`:`<button type="button" class="live-flash" data-live-action="reveal" ${disabled}>Girar tarjeta y ver respuesta</button>`;
    } else if(kind==='error') {
      const words=errorExample(q.prompt).split(/\s+/).filter(Boolean),selected=typeof response==='object'&&response?response.selected||'':'',correction=typeof response==='object'&&response?response.correction||'':typeof response==='string'?response:'';
      controls=`<p class="live-hint">Toca la palabra errónea de la oración y escribe cómo debería aparecer.</p><div class="live-error-words">${words.map((word,i)=>`<button type="button" data-live-action="error-word" data-index="${i}" class="${selected.split(' ').includes(word)?'selected':''} ${result==='correct'&&selected.split(' ').includes(word)?'correct':result==='incorrect'&&selected.split(' ').includes(word)?'incorrect':''}" ${disabled}>${escape(word)}</button>`).join('')}</div><input class="live-text ${result==='correct'?'correct':result==='incorrect'?'incorrect':''}" data-live-field="error-correction" value="${escape(correction)}" placeholder="Escribe la corrección" aria-label="Corrección del error" ${disabled}>`;
    } else if(kind==='problem') {
      controls=`<textarea data-live-field="text" placeholder="Datos, planteamiento, cálculos y respuesta…" ${disabled}>${escape(response||'')}</textarea>`;
    } else if(open.has(kind)) {
      controls=`<textarea data-live-field="text" placeholder="Escribe tu respuesta…" ${disabled}>${escape(response||'')}</textarea>`;
    } else {
      controls=`<input class="live-text" data-live-field="text" value="${escape(response||'')}" placeholder="${kind==='numeric'?'Escribe el resultado':'Escribe tu respuesta'}" ${disabled}>${q.unit?`<strong>${escape(q.unit)}</strong>`:''}`;
    }
    const partial=['pasapalabra','multigaps','crossword','dragdrop','memory','wordsearch'].includes(kind);
    const feedback=result&&!(kind==='hangman'&&result==='unanswered')?`<p class="live-feedback ${result}" role="status">${result==='correct'?'✓ Correcto':result==='pending'?'◷ Guardado para revisión':result==='partial'?'◷ Parcialmente correcto':result==='unanswered'?'Sin responder':'× Puedes volver a intentarlo'}</p>`:'';
    const review=teacher&&session.status==='completed'&&open.has(kind)&&(kind!=='error'||result==='pending')?`<div class="live-grade-actions"><b>Valorar respuesta:</b>${[['correct','Correcta'],['partial','Parcial'],['incorrect','Revisar']].map(([value,label])=>`<button type="button" data-live-teacher="grade" data-id="${escape(session.id)}" data-index="${n}" data-grade="${value}" class="${result===value?'active':''}">${label}</button>`).join('')}</div>`:'';
    return `<article class="live-question" data-live-type="${escape(kind)}"><div class="live-kind"><span>${String(n+1).padStart(2,'0')}</span>${escape(labels[kind]||'Ejercicio')}</div><h3>${rich(q.prompt)}</h3>${kind==='reading'&&q.text?`<div class="live-reading">${rich(q.text)}</div>`:''}${kind==='visualquiz'?image(session,q,teacher):''}<div class="live-controls">${controls}</div>${!teacher&&q.hints?.length?`${kind==='pasapalabra'?'':'<button type="button" class="live-hint-button" data-live-action="hint">Necesito una pista</button>'}<div class="live-hint-box" id="liveHintBox"></div>`:''}${feedback}${!locked&&!partial&&!choice.has(kind)&&kind!=='flashcard'&&kind!=='hangman'?'<button type="button" data-live-action="check" class="live-check">Comprobar respuesta</button>':''}${teacher?`<p class="live-observed-answer"><b>Respuesta del alumno:</b> ${escape(summaryValue(response))}</p>`:''}${session.status==='completed'&&q.solution?`<div class="live-solution"><b>Solución:</b> ${rich(q.solutions?.join(' · ')||q.solution)}</div>`:''}${review}</article>`;
  }
  function statusText(session, teacher){return session.status==='pending'?(teacher?'Esperando a que el alumno abra el material':'Nuevo material disponible'):session.status==='completed'?'Actividad terminada':session.status==='cancelled'?'Material retirado':teacher?'El alumno está trabajando':'Estás trabajando';}
  function sessionMarkup(session, teacher=false){
    const selected=teacher?teacherReviewIndex:reviewIndex;
    const current=Math.max(0,Math.min(session.questions.length-1,session.status==='completed'&&selected!==null?selected:Number(session.progress?.current_index)||0));
    const answered=Object.values(session.progress?.responses||{}).filter(value=>value!==null&&value!==''&&(!Array.isArray(value)||value.length)).length;
    const seen=session.progress?.last_seen?Date.parse(session.progress.last_seen):0;
    const presence=session.status==='in_progress'?(Date.now()-seen<18000?'● Conectado':'○ Sin conexión reciente'):'';
    const progressBar=`<div class="live-progress"><span style="width:${Math.round((session.status==='completed'?session.questions.length:Math.max(answered,current))/session.questions.length*100)}%"></span></div>`;
    const header=teacher?`<div class="live-player-head"><span class="live-eyebrow">SEGUIMIENTO EN DIRECTO</span><h2>${escape(session.title)}</h2><p>${escape(session.subject)} · ${escape(session.student_name||'Alumno')} · ${session.questions.length} ${session.questions.length===1?'ejercicio':'ejercicios'}</p><div class="live-status"><span>${escape(statusText(session,true))}</span>${presence?`<small>${presence}</small>`:''}</div>${progressBar}</div>`:`<div class="live-player-head live-student-head"><span class="live-head-number">${String(current+1).padStart(2,'0')}</span><div class="live-head-title"><small>${escape(session.title)}</small><h2>${escape(session.status==='pending'?session.title:labels[session.questions[current]?.type]||'Ejercicio')}</h2></div><span class="live-subject">✦ ${escape(session.subject)}</span></div>${progressBar}`;
    if(session.status==='pending')return `<div class="live-player">${header}${teacher?'<p class="live-wait">Aparecerá aquí en cuanto el alumno lo abra.</p>':'<div class="live-start"><p>Tu profesor ha preparado este material para ti. Puedes continuar si cambias de dispositivo o recargas la página.</p><button type="button" data-live-action="start" class="live-primary">Empezar</button></div>'}</div>`;
    const review=session.status==='completed'?`<div class="live-result"><b>Material terminado</b><p>${Object.values(session.progress?.grades||{}).filter(value=>value==='correct').length} de ${session.questions.length} correctas · ${Object.values(session.progress?.grades||{}).filter(value=>value==='pending').length} pendientes de revisión</p><div class="live-review-list">${session.questions.map((q,i)=>`<button type="button" data-live-${teacher?'teacher':'action'}="review" data-index="${i}" class="${i===current?'active':''}">${i+1}. ${escape(labels[q.type]||'Ejercicio')} <small>${escape(session.progress?.grades?.[String(i)]||'Sin responder')}</small></button>`).join('')}</div></div>`:'';
    const navigation=teacher||session.status==='completed'?'':`<div class="live-navigation"><button type="button" data-live-action="previous" ${current===0?'disabled':''}>← Anterior</button>${current===session.questions.length-1?'<button type="button" data-live-action="finish" class="live-primary">Terminar material</button>':'<button type="button" data-live-action="next" class="live-primary">Siguiente →</button>'}</div>`;
    return `<div class="live-player">${header}<div class="live-step"><span>Ejercicio ${current+1} de ${session.questions.length}</span>${teacher?'':`<span>${escape(statusText(session,false))} · progreso guardado</span>`}</div>${questionMarkup(session,current,teacher)}${review}${navigation}</div>`;
  }

  // Teacher flow: the current personal play mode remains unchanged.
  if(!studentRoot){
    async function sendMaterial(material){
      if(typeof demo!=='undefined'&&demo)throw Error('Inicia sesión con una cuenta Premium para mandar materiales.');
      if(!isPremium())throw Error('Mandar materiales a alumnos requiere Premium.');
      await saveQueue;
      if(saveFailed)throw Error('Guarda el material antes de enviarlo.');
      const data=await api('/api/profesor/access');
      const eligible=data.accesses.filter(access=>access.active&&state.students.find(s=>s.id===access.student_id)?.subjects?.includes(material.subject));
      if(!eligible.length){modal('Mandar a alumno',`<p>Necesitas un alumno de ${escape(material.subject)} con acceso activo.</p><p>Créale un usuario en «Accesos Alumnos» y vuelve a este material.</p><div class="actions">${button('Cerrar','close')}</div>`,()=>false);return;}
      modal('Mandar · '+material.title,`<p>El material aparecerá en el espacio del alumno. Podrás observarlo mientras lo resuelve.</p><label for="liveAccess">Alumno</label><select id="liveAccess" name="access_id">${eligible.map(access=>`<option value="${escape(access.id)}" ${material.studentId===access.student_id?'selected':''}>${escape(access.name)}</option>`).join('')}</select>${submit('Mandar material')}`,async form=>{
        const result=await api('/api/profesor/material-sessions',{access_id:String(form.get('access_id')),material_id:material.id});
        setTimeout(()=>watchSession(result.session.id),0);
      });
    }
    async function listSessions(){
      const data=await api('/api/profesor/material-sessions');
      modal('Materiales enviados',data.sessions.length?`<div class="live-sent-list">${data.sessions.map(item=>`<button type="button" data-live-teacher="watch" data-id="${escape(item.id)}"><strong>${escape(item.title)}</strong><span>${escape(item.student_name)} · ${escape(item.subject)}</span><small>${item.status==='pending'?'Nuevo':item.status==='in_progress'?'En curso':item.status==='completed'?'Terminado':'Retirado'} · ${new Date(item.created_at).toLocaleDateString('es-ES')}</small></button>`).join('')}</div>`:'<p>Todavía no has mandado materiales a alumnos.</p>',()=>false);
    }
    async function watchStudent(accessId){
      const data=await api('/api/profesor/access/'+encodeURIComponent(accessId)+'/material-sessions');
      if(!data.sessions.length){notify('Este alumno no tiene materiales pendientes ni en curso.');return}
      if(data.sessions.length===1){await watchSession(data.sessions[0].id);return}
      modal('Materiales del alumno',`<div class="live-sent-list">${data.sessions.map(item=>`<button type="button" data-live-teacher="watch" data-id="${escape(item.id)}"><strong>${escape(item.title)}</strong><span>${escape(item.subject)}</span><small>${item.status==='in_progress'?'En curso':'Pendiente'} · ${new Date(item.created_at).toLocaleDateString('es-ES')}</small></button>`).join('')}</div>`,()=>false);
    }
    async function watchSession(id){
      const result=await api('/api/profesor/material-sessions/'+encodeURIComponent(id));
      teacherReviewIndex=null;watchedSession=result.session;
      modal('Seguir material',`<div id="liveWatch">${sessionMarkup(result.session,true)}</div><div class="live-teacher-actions"><button type="button" data-live-teacher="refresh" data-id="${escape(id)}">Actualizar</button>${result.session.status==='pending'||result.session.status==='in_progress'?`<button type="button" data-live-teacher="cancel" data-id="${escape(id)}">Retirar material</button>`:''}</div>`,()=>false);
      const dialog=$('dialog');dialog.classList.add('live-watch-dialog');let revision=result.session.revision;
      let connected=result.session.status==='in_progress'&&Boolean(result.session.progress?.last_seen)&&Date.now()-Date.parse(result.session.progress.last_seen)<18000;
      clearInterval(watcher);
      watcher=setInterval(async()=>{if(!dialog.open||!$('liveWatch')){clearInterval(watcher);return}try{const next=(await api('/api/profesor/material-sessions/'+encodeURIComponent(id))).session;const nextConnected=next.status==='in_progress'&&Boolean(next.progress?.last_seen)&&Date.now()-Date.parse(next.progress.last_seen)<18000;if(next.revision!==revision||nextConnected!==connected){revision=next.revision;connected=nextConnected;watchedSession=next;$('liveWatch').innerHTML=sessionMarkup(next,true);const actions=dialog.querySelector('.live-teacher-actions');if(actions)actions.querySelector('[data-live-teacher="cancel"]')?.remove();if(next.status==='pending'||next.status==='in_progress')actions?.insertAdjacentHTML('beforeend',`<button type="button" data-live-teacher="cancel" data-id="${escape(id)}">Retirar material</button>`);}}catch(error){if($('liveWatch'))$('liveWatch').insertAdjacentHTML('beforeend',`<p class="live-error">${escape(error.message)}</p>`);clearInterval(watcher)}},1200);
      dialog.addEventListener('close',()=>{clearInterval(watcher);dialog.classList.remove('live-watch-dialog')},{once:true});
    }
    document.addEventListener('click',async event=>{
      const button=event.target.closest('[data-action="sendLiveMaterial"],[data-action="liveSessionList"],[data-live-teacher]');if(!button)return;
      event.preventDefault();button.closest('details')?.removeAttribute('open');
      try{
        if(button.dataset.action==='sendLiveMaterial'){const material=state.library.find(item=>item.id===button.dataset.id);if(material)await sendMaterial(material)}
        if(button.dataset.action==='liveSessionList')await listSessions();
        if(button.dataset.liveTeacher==='student-watch')await watchStudent(button.dataset.accessId);
        if(button.dataset.liveTeacher==='watch'){$('dialog').close();setTimeout(()=>watchSession(button.dataset.id).catch(error=>notify(error.message)),0)}
        if(button.dataset.liveTeacher==='refresh'){const data=await api('/api/profesor/material-sessions/'+button.dataset.id);watchedSession=data.session;$('liveWatch').innerHTML=sessionMarkup(data.session,true)}
        if(button.dataset.liveTeacher==='review'&&watchedSession){teacherReviewIndex=Number(button.dataset.index);$('liveWatch').innerHTML=sessionMarkup(watchedSession,true)}
        if(button.dataset.liveTeacher==='grade'&&watchedSession){const name=watchedSession.student_name;const data=await api('/api/profesor/material-sessions/'+button.dataset.id+'/review',{question_index:Number(button.dataset.index),grade:button.dataset.grade});watchedSession=data.session;watchedSession.student_name=name;$('liveWatch').innerHTML=sessionMarkup(watchedSession,true)}
        if(button.dataset.liveTeacher==='cancel'){if(!confirm('¿Retirar este material del espacio del alumno?'))return;await api('/api/profesor/material-sessions/'+button.dataset.id+'/cancel',{});$('dialog').close();notify('Material retirado.')}
      }catch(error){notify(error.message)}
    });
    return;
  }

  async function request(path,body){const response=await fetch(path,{credentials:'same-origin',cache:'no-store',method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});let data={};try{data=await response.json()}catch{}if(response.status===401||response.status===403){location.replace('/profesor/login?expired=1');throw Error('Tu sesión ha caducado.')}if(!response.ok)throw Error(data.detail||'No se pudo guardar tu respuesta.');return data;}
  const path=id=>'/api/profesor/student-material-sessions/'+encodeURIComponent(id);
  function enqueue(move){const run=()=>request(path(active.id)+'/move',move);saving=saving.catch(()=>{}).then(run);return saving;}
  function renderList(sessions){
    const panel=document.getElementById('studentMaterialList');if(!panel)return;
    const running=sessions.some(item=>item.status==='in_progress');
    panel.innerHTML=sessions.length?`<div class="live-inbox">${sessions.map((item,i)=>`<button type="button" data-live-open="${escape(item.id)}" class="${item.status==='pending'?'new':''} ${active?.id===item.id?'current':''}" ${running&&item.status==='pending'?'disabled':''}><span class="live-inbox-icon">${item.status==='completed'?'✓':String(i+1).padStart(2,'0')}</span><span class="live-inbox-copy"><strong>${escape(item.title)}</strong><small>${item.count} ${item.count===1?'ejercicio':'ejercicios'} · ${escape(item.subject)}</small>${item.status==='pending'?'<em>Nuevo material disponible</em>':item.status==='in_progress'?'<em>En curso</em>':''}</span><span class="live-inbox-arrow" aria-hidden="true">›</span></button>`).join('')}</div>`:'<p class="student-inbox-empty">Cuando tu profesor te mande un material, aparecerá aquí.</p>';
  }
  async function loadList(){try{const data=await request('/api/profesor/student-material-sessions');const fingerprint=JSON.stringify(data.sessions);if(fingerprint!==lastList){lastList=fingerprint;renderList(data.sessions)}if(active?.status==='in_progress'&&!data.sessions.some(item=>item.id===active.id)){active=null;studentRoot.hidden=true;studentRoot.innerHTML='';document.getElementById('studentWelcome')?.removeAttribute('hidden');document.getElementById('studentMaterialList').insertAdjacentHTML('afterbegin','<p class="live-error">El profesor ha retirado el material que tenías abierto.</p>')}if(!active){const running=data.sessions.find(item=>item.status==='in_progress');if(running)await openSession(running.id)}}catch(error){document.getElementById('studentMaterialList').innerHTML=`<p class="live-error">${escape(error.message)}</p>`}}
  async function openSession(id){clearTimeout(draftTimer);await saving.catch(()=>{});active=(await request(path(id))).session;activeWord=0;activeLetter=0;firstCard=null;pickedCell=null;reviewIndex=null;const focus=active.progress?.focus;if(focus?.question_index===active.progress?.current_index){const type=active.questions[active.progress.current_index]?.type;if(type==='pasapalabra')activeLetter=focus.part||0;if(type==='wordsearch')activeWord=focus.part||0;if(type==='memory')firstCard=focus.token||null}document.getElementById('studentWelcome')?.setAttribute('hidden','');studentRoot.hidden=false;studentRoot.innerHTML=sessionMarkup(active);studentRoot.scrollIntoView({behavior:'smooth',block:'start'});}
  function renderActive(keepFocus=false){if(!active)return;const focused=keepFocus?document.activeElement?.dataset.liveField:null,part=keepFocus?document.activeElement?.dataset.part:null,selection=keepFocus?document.activeElement?.selectionStart:null;studentRoot.innerHTML=sessionMarkup(active);if(focused){const field=[...studentRoot.querySelectorAll('[data-live-field]')].find(input=>input.dataset.liveField===focused&&(part==null||input.dataset.part===part));if(field){field.focus({preventScroll:true});if(Number.isInteger(selection)&&field.setSelectionRange)field.setSelectionRange(selection,selection)}}}
  function current(){return Math.max(0,Math.min(active.questions.length-1,Number(active.progress?.current_index)||0))}
  function setValue(index,value){active.progress.responses??={};active.progress.responses[String(index)]=value;}
  function valueFor(index){const q=active.questions[index],value=val(active,index);if(q.type==='order'||q.type==='sentence'||q.type==='timeline')return Array.isArray(value)?value:q.options||[];return value;}
  async function send(action,index,value,part=null,currentIndex=null){const result=await enqueue({action,question_index:index,value,part,current_index:currentIndex});if(result.session)active=result.session;else{active.revision=result.revision;active.status=result.status;if(result.feedback!=null){if(part==null){active.progress.grades??={};active.progress.grades[String(index)]=result.feedback}else{active.progress.parts??={};active.progress.parts[String(index)]??={};active.progress.parts[String(index)][String(part)]=result.feedback}}if(result.extra&&active.questions[index].type==='hangman')Object.assign(active.questions[index],result.extra)}return result}
  function draft(index,value){setValue(index,value);clearTimeout(draftTimer);draftTimer=setTimeout(()=>send('draft',index,value).catch(error=>{studentRoot.insertAdjacentHTML('afterbegin',`<p class="live-error">${escape(error.message)}</p>`)}),400)}
  async function flush(){if(draftTimer){clearTimeout(draftTimer);draftTimer=null;await send('draft',current(),valueFor(current()))}else await saving.catch(()=>{})}
  async function checkPart(index,part,value){setValue(index,value);await send('check',index,value,part);renderActive();}
  studentRoot.addEventListener('input',event=>{
    const field=event.target.closest('[data-live-field]');if(!field||!active||active.status!=='in_progress')return;
    const index=current();let value;
    if(field.dataset.liveField==='part'){value=Array.isArray(val(active,index))?[...val(active,index)]:[];value[Number(field.dataset.part)]=field.value;}
    else if(field.dataset.liveField==='error-correction')value={...(typeof val(active,index)==='object'&&val(active,index)||{}),correction:field.value};
    else value=field.value;
    if(active.questions[index].type==='error')delete active.progress.grades?.[String(index)];
    draft(index,value);
  });
  studentRoot.addEventListener('change',async event=>{
    const field=event.target.closest('select[data-live-field="part"]');if(!field||!active)return;
    try{await flush();await checkPart(current(),Number(field.dataset.part),val(active,current()))}catch(error){alert(error.message)}
  });
  studentRoot.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches('input[data-live-field]')){event.preventDefault();const part=event.target.dataset.part;const check=part!=null?studentRoot.querySelector(`[data-live-action="check-part"][data-part="${part}"]`):studentRoot.querySelector('[data-live-action="check"]');check?.click()}});
  studentRoot.addEventListener('click',async event=>{
    const button=event.target.closest('[data-live-action]');if(!button||!active||button.disabled)return;
    const action=button.dataset.liveAction,index=current(),q=active.questions[index];
    try{
      if(action==='start'){await send('start',0,null);renderActive();return}
      if(action==='review'&&active.status==='completed'){reviewIndex=Number(button.dataset.index);renderActive();return}
      if(action==='previous'||action==='next'){await flush();const next=Math.max(0,Math.min(active.questions.length-1,index+(action==='next'?1:-1)));await send('next',index,null,null,next);active.progress.current_index=next;activeWord=activeLetter=0;firstCard=pickedCell=null;renderActive();return}
      if(action==='finish'){await flush();if(!confirm('¿Terminar el material y ver tu resultado?'))return;await send('finish',index,null);renderActive();await loadList();return}
      if(action==='choice'||action==='flash-grade'){const value=button.dataset.value;setValue(index,value);await send('check',index,value);renderActive();return}
      if(action==='check'){await flush();const value=valueFor(index);if(q.type==='error'&&(!value||typeof value!=='object'||!value.selected?.trim()||!value.correction?.trim())){alert('Selecciona el error y escribe su corrección.');return}await send('check',index,value);renderActive();return}
      if(action==='move'){const value=[...valueFor(index)],from=Number(button.dataset.pos),to=from+Number(button.dataset.dir);[value[from],value[to]]=[value[to],value[from]];setValue(index,value);if(q.type==='timeline'){delete active.progress.grades?.[String(index)];delete active.progress.parts?.[String(index)]}await send('draft',index,value);renderActive();return}
      if(action==='letter'){activeLetter=Number(button.dataset.index);active.progress.focus={question_index:index,part:activeLetter};renderActive();await send('focus',index,null,activeLetter);return}
      if(action==='pass'){activeLetter=(activeLetter+1)%q.entries.length;active.progress.focus={question_index:index,part:activeLetter};renderActive();await send('focus',index,null,activeLetter);return}
      if(action==='check-part'){await flush();await checkPart(index,Number(button.dataset.part),val(active,index));if(q.type==='pasapalabra'){activeLetter=(activeLetter+1)%q.entries.length;active.progress.focus={question_index:index,part:activeLetter};await send('focus',index,null,activeLetter)}renderActive();return}
      if(action==='card'){const token=button.dataset.value;if(!firstCard){firstCard=token;active.progress.focus={question_index:index,token};renderActive();await send('focus',index,token);return}if(firstCard===token){firstCard=null;active.progress.focus={question_index:index,token:null};renderActive();await send('focus',index,null);return}const values=Array.isArray(val(active,index))?[...val(active,index)]:[],pair=[firstCard,token];firstCard=null;active.progress.focus={question_index:index,token:null};values.push(pair);setValue(index,values);const result=await send('check',index,values,values.length-1);if(result.feedback!=='correct'){values.pop();setValue(index,values);await send('draft',index,values)}await send('focus',index,null);renderActive();return}
      if(action==='word'){activeWord=Number(button.dataset.index);pickedCell=null;active.progress.focus={question_index:index,part:activeWord};renderActive();await send('focus',index,null,activeWord);return}
      if(action==='cell'){const r=Number(button.dataset.row),c=Number(button.dataset.col);if(!pickedCell){pickedCell=[r,c];renderActive();return}const [startR,startC]=pickedCell,pieces=Math.max(Math.abs(r-startR),Math.abs(c-startC)),dr=Math.sign(r-startR),dc=Math.sign(c-startC);pickedCell=null;if(!(startR===r||startC===c||Math.abs(r-startR)===Math.abs(c-startC)))return;const cells=Array.from({length:pieces+1},(_,i)=>[startR+i*dr,startC+i*dc]),values=Array.isArray(val(active,index))?[...val(active,index)]:[];values[activeWord]=cells;await checkPart(index,activeWord,values);return}
      if(action==='guess'){const values=Array.isArray(val(active,index))?[...val(active,index)]:[];values.push(button.dataset.value);setValue(index,values);await send('check',index,values);renderActive();return}
      if(action==='point'){if(q.type!=='imagepoint'||active.status!=='in_progress')return;const img=button.querySelector('img');if(!img)return;const rect=img.getBoundingClientRect(),value=[Math.round(100*(event.clientX-rect.left)/rect.width),Math.round(100*(event.clientY-rect.top)/rect.height)];setValue(index,value);await send('check',index,value);renderActive();return}
      if(action==='reveal'){const result=await send('reveal',index,null);q.revealed_answer=result.feedback;renderActive();return}
      if(action==='hint'){const box=studentRoot.querySelector('#liveHintBox'),visible=box.childElementCount;box.insertAdjacentHTML('beforeend',`<p>💡 ${rich(q.hints[Math.min(visible,q.hints.length-1)])}</p>`);if(visible+1>=q.hints.length)button.hidden=true;return}
      if(action==='error-word'){const words=errorExample(q.prompt).split(/\s+/).filter(Boolean),current=typeof val(active,index)==='object'&&val(active,index)||{},selected=new Set(String(current.selected||'').split(' ').filter(Boolean)),word=words[Number(button.dataset.index)];if(selected.has(word))selected.delete(word);else selected.add(word);const value={...current,selected:words.filter(item=>selected.has(item)).join(' ')};setValue(index,value);delete active.progress.grades?.[String(index)];draft(index,value);renderActive();return}
    }catch(error){alert(error.message)}
  });
  document.getElementById('studentMaterialList').addEventListener('click',event=>{const button=event.target.closest('[data-live-open]');if(button)openSession(button.dataset.liveOpen).catch(error=>alert(error.message))});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadList()});
  setInterval(()=>{if(!document.hidden){if(active?.status==='in_progress')send('heartbeat',current(),null).catch(()=>{});if(active?.status==='completed')request(path(active.id)).then(data=>{if(data.session.revision!==active.revision){active=data.session;renderActive()}}).catch(()=>{});loadList()}},5000);
  loadList();
})();
