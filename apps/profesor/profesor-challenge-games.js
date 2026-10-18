/* Four complete games. Content is prepared once; playing never calls an AI. */
(() => {
 'use strict';
 const types=['multiselect','table','cipher','race'];
 const fields={multiselect:['Opción','Correcta (sí/no)'],table:['Fila','Columna','Respuesta'],cipher:['Pista','Respuesta','Letra premio'],race:['Pregunta','Correcta','Distractor 1','Distractor 2']};
 const limits={multiselect:[3,6],table:[4,12],cipher:[3,10],race:[4,12]};
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key=value=>String(value??'').trim().toLocaleLowerCase('es').replaceAll('ñ','\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('\u0001','ñ');
 const copy=value=>JSON.parse(JSON.stringify(value));
 const canVisit=(index,parts,locked)=>locked||index===0||parts[index-1]==='correct';
 function rows(q){return (q.options||[]).map(row=>row.split('|').map(part=>part.trim()));}
 function validate(q){
  const range=limits[q.type];if(!range)return;
  if(!Array.isArray(q.options)||q.options.length<range[0]||q.options.length>range[1]||q.options.some(row=>typeof row!=='string'||row.length>300||/[\r\n]/.test(row)))throw Error(`Usa entre ${range[0]} y ${range[1]} filas completas.`);
  const entries=rows(q),kind=q.type;
  if(entries.some(row=>row.length!==fields[kind].length||row.some(part=>!part)))throw Error('Completa todas las columnas de cada fila.');
  if(new Set(entries.map(row=>JSON.stringify(row.slice(0,kind==='table'?2:1).map(key)))).size!==entries.length)throw Error('No repitas opciones, pistas, preguntas ni casillas.');
  if(kind==='multiselect'){
   if(entries.some(row=>row[0].length>180||!['si','no'].includes(key(row[1])))||entries.filter(row=>key(row[1])==='si').length<2||entries.every(row=>key(row[1])==='si'))throw Error('Marca al menos dos opciones correctas y una incorrecta con sí o no.');
  }else if(kind==='table'){
   const rowCount=new Set(entries.map(row=>key(row[0]))).size,columnCount=new Set(entries.map(row=>key(row[1]))).size;
   if(entries.some(row=>row.some(part=>part.length>80))||rowCount<2||rowCount>6||columnCount<2||columnCount>4||entries.length!==rowCount*columnCount)throw Error('Completa una tabla rectangular de al menos 2 filas y 2 columnas, hasta 12 casillas.');
  }else if(kind==='cipher'){
   if(entries.some(row=>row[0].length>180||row[1].length>80||!row[1].split('~').every(part=>part.trim())||!/^[a-záéíóúüñ]$/i.test(row[2])))throw Error('Cada pista necesita una respuesta (hasta 80 caracteres) y una sola letra de premio.');
   if(entries.some(row=>row[1].split('~').some(answer=>new RegExp('(^|[^\\p{L}\\p{N}_])'+key(answer).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^\\p{L}\\p{N}_])','u').test(key(row[0])))))throw Error('La pista no puede revelar su respuesta.');
  }else if(entries.some(row=>row[0].length>150||row.slice(1).some(part=>part.length>60)||new Set(row.slice(1).map(key)).size!==3))throw Error('Cada reto necesita tres respuestas diferentes; pregunta hasta 150 caracteres y respuestas hasta 60.');
 }
 function shuffle(items,seed){let n=0;for(const c of String(seed))n=(Math.imul(n,31)+c.charCodeAt(0))|0;return items.map((item,i)=>({item,rank:Math.imul(n^i*2654435761,2246822507)>>>0})).sort((a,b)=>a.rank-b.rank).map(row=>row.item);}
 function prepare(q,seed){
  validate(q);
  let items=rows(q).map((row,i)=>q.type==='multiselect'?{label:row[0],answer:key(row[1])==='si'}:q.type==='table'?{row:row[0],column:row[1],answer:row[2]}:q.type==='cipher'?{clue:row[0],answer:row[1],letter:row[2].toUpperCase()}:{clue:row[0],answer:`${i}-0`,choices:shuffle(row.slice(1).map((label,j)=>({token:`${i}-${j}`,label})),String(seed)+i)});
  if(q.type==='table'){const names=new Map(),columns=new Map();items.forEach(item=>{if(!names.has(key(item.row)))names.set(key(item.row),item.row);if(!columns.has(key(item.column)))columns.set(key(item.column),item.column);item.row=names.get(key(item.row));item.column=columns.get(key(item.column));});}
  if(q.type==='multiselect')items=shuffle(items,seed);
  return items;
 }
 function grade(kind,items,value,part=null){
  if(!Array.isArray(value)||value.length!==items.length)return 'unanswered';
  if(part!==null){
   if(!items[part])return 'unanswered';const actual=value[part],expected=items[part].answer;
   if(kind==='multiselect')return typeof actual!=='boolean'?'unanswered':actual===expected?'correct':'incorrect';
   if(typeof actual!=='string'||!actual.trim())return 'unanswered';
   return (kind==='race'?actual===expected:expected.split('~').some(answer=>key(answer)===key(actual)))?'correct':'incorrect';
  }
  if(kind==='multiselect'&&!value.some(answer=>answer===true))return 'unanswered';
  const results=items.map((_,i)=>grade(kind,items,value,i));return results.includes('unanswered')?'unanswered':results.every(result=>result==='correct')?'correct':'incorrect';
 }
 function safeItems(kind,items,parts={},completed=false){return items.map((item,i)=>{const out=Object.fromEntries(Object.entries(item).filter(([key])=>key!=='answer'&&key!=='letter'));if(kind==='cipher')out.letter=completed||parts[i]==='correct'?item.letter:'';return out;});}
 function summary(kind,items,value){return items.map((item,i)=>(item.label||[item.row,item.column].filter(Boolean).join(' · ')||item.clue)+': '+(kind==='multiselect'?(value?.[i]?'Marcada':'Sin marcar'):kind==='race'?item.choices.find(choice=>choice.token===value?.[i])?.label||'Sin responder':value?.[i]||'Sin responder')).join(' · ');}
 window.profesorChallengeGames={types,fields,limits,validate,prepare,grade,safeItems,summary,canVisit};
 window.profesorChallengeGame=(root,config)=>{
  const kind=config.kind,locked=!!config.locked;
  let items=copy(config.items||[]),value=items.map((_,i)=>kind==='multiselect'?config.value?.[i]===true:typeof config.value?.[i]==='string'?config.value[i]:''),parts={...(config.parts||{})},busy=false,message='',result=config.result;
  let active=Math.max(0,Math.min(items.length-1,config.focus??items.findIndex((_,i)=>parts[i]!=='correct')));
  const completed=()=>items.length>0&&items.every((_,i)=>parts[i]==='correct');
  const note=i=>parts[i]==='correct'?'✓ Correcto':parts[i]==='incorrect'?'× Revisa':'',state=i=>parts[i]==='correct'?'is-correct':parts[i]==='incorrect'?'is-incorrect':'';
  function changed(i){delete parts[i];result=null;message='';config.onChange?.(copy(value));}
  function focusField(){root.querySelector('[data-challenge-answer]')?.focus({preventScroll:true});}
  async function check(){
   if(locked||busy)return;
   if(kind==='multiselect'&&!value.some(Boolean)||kind==='table'&&!value.some(answer=>answer.trim())||['cipher','race'].includes(kind)&&!value[active]){message='Escribe o selecciona una respuesta antes de comprobar.';draw();focusField();return;}
   busy=true;draw();
   try{const feedback=await config.onCheck(copy(value),['cipher','race'].includes(kind)?active:null);if(feedback){parts={...(feedback.parts||{})};result=feedback.result;if(feedback.items)items=copy(feedback.items);}message='';}
   catch(error){message=error?.message||'No se pudo guardar. Tu respuesta sigue aquí; vuelve a intentarlo.';}
   finally{busy=false;draw();root.querySelector('[data-challenge-next]:not(:disabled),[data-challenge-check]')?.focus({preventScroll:true});}
  }
  function go(index){if(index<0||index>=items.length||busy)return;active=index;message='';config.onFocus?.(index);draw();focusField();}
  function draw(){
   root.className='challenge-game challenge-'+kind;
   const disabled=locked||busy?'disabled':'',done=items.filter((_,i)=>parts[i]==='correct').length;
   const guide={multiselect:'Marca todas las opciones correctas. Puede haber más de una.',table:'Escribe en las casillas y comprueba cada resultado.',cipher:'Resuelve cada pista para descubrir una letra del mensaje.',race:'Supera los retos para avanzar. Las casillas estrella valen el doble.'}[kind];
   let body='';
   if(kind==='multiselect')body=`<div class="challenge-choices">${items.map((item,i)=>`<label class="challenge-choice ${state(i)}"><input type="checkbox" data-challenge-choice="${i}" ${value[i]?'checked':''} ${disabled}><span>${escape(item.label)}</span><small>${parts[i]==='incorrect'?(value[i]?'× No corresponde':'× Faltaba marcar'):parts[i]==='correct'?(value[i]?'✓ Bien elegida':'✓ Bien descartada'):'Selecciona si corresponde'}</small></label>`).join('')}</div>`;
   else if(kind==='table'){
    const names=[...new Set(items.map(item=>item.row))],columns=[...new Set(items.map(item=>item.column))];
    body=`<div class="challenge-table-wrap" tabindex="0" aria-label="Tabla de respuestas"><table class="challenge-table"><thead><tr><th scope="col">Concepto</th>${columns.map(name=>`<th scope="col">${escape(name)}</th>`).join('')}</tr></thead><tbody>${names.map(name=>`<tr><th scope="row">${escape(name)}</th>${columns.map(column=>{const i=items.findIndex(item=>item.row===name&&item.column===column);return i<0?'<td>—</td>':`<td data-column="${escape(column)}" class="${state(i)}"><input data-challenge-answer="${i}" aria-label="${escape(name+' · '+column)}" aria-invalid="${parts[i]==='incorrect'}" aria-describedby="cell-status-${config.id||kind}-${i}" value="${escape(value[i])}" maxlength="80" autocomplete="off" ${disabled}><small id="cell-status-${config.id||kind}-${i}">${note(i)||'Sin comprobar'}</small></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
   }else{
    const current=items[active]||{},right=parts[active]==='correct',allDone=completed();
    const board=kind==='cipher'?`<div class="cipher-message" role="group" aria-label="Mensaje oculto">${items.map((item,i)=>`<span class="${item.letter?'revealed':''}" aria-label="${item.letter?'Letra '+item.letter:'Letra oculta '+(i+1)}">${escape(item.letter||'·')}</span>`).join('')}</div>`:`<div class="race-track" role="group" aria-label="Tablero de la carrera">${items.map((item,i)=>`<button type="button" data-challenge-stage="${i}" class="${i===active?'is-current':''} ${state(i)} ${(i+1)%3===0?'star-stage':''}" ${busy||!canVisit(i,parts,locked)?'disabled':''} aria-label="Casilla ${i+1}${(i+1)%3===0?', estrella':''}${parts[i]==='correct'?', superada':''}" aria-current="${i===active?'step':'false'}"><b>${parts[i]==='correct'?'✓':i===active?'♟':i===items.length-1?'🏁':i+1}</b><span>${(i+1)%3===0?'★ 20 puntos':'10 puntos'}</span></button>`).join('')}</div>`;
    body=`${board}<div class="challenge-stage-card"><div class="challenge-stage-label">${kind==='cipher'?'Pista':'Reto'} ${active+1} de ${items.length}${kind==='race'&&(active+1)%3===0?' · ★ Casilla estrella':''}</div><p class="challenge-clue" tabindex="0">${escape(current.clue||'')}</p>${kind==='cipher'?`<label class="cipher-answer">Tu respuesta<input data-challenge-answer="${active}" class="${state(active)}" aria-invalid="${parts[active]==='incorrect'}" maxlength="80" autocomplete="off" value="${escape(value[active]||'')}" ${disabled||right?'disabled':''}></label>`:`<div class="race-answers">${(current.choices||[]).map((choice,i)=>`<button type="button" data-race-choice="${i}" aria-pressed="${value[active]===choice.token}" class="${value[active]===choice.token?'is-selected '+state(active):''}" ${disabled||right?'disabled':''}><b>${String.fromCharCode(65+i)}</b>${escape(choice.label)}</button>`).join('')}</div>`}<p class="challenge-stage-feedback ${state(active)}" role="status">${right?(kind==='cipher'?'✓ Pista resuelta: has descubierto la letra '+escape(current.letter||'')+'.':active===items.length-1?'✓ ¡Último reto superado!':'✓ Reto superado. Puedes avanzar.'):parts[active]==='incorrect'?'× Todavía no. Revisa tu respuesta y prueba de nuevo.':'Piensa tu respuesta y pulsa Comprobar.'}</p><div class="challenge-stage-actions"><button type="button" data-challenge-prev ${busy||active===0?'disabled':''}>${kind==='cipher'?'← Pista anterior':'← Reto anterior'}</button><button type="button" data-challenge-check class="challenge-primary" ${disabled||right?'disabled':''}>${busy?'Comprobando…':'Comprobar'}</button><button type="button" data-challenge-next ${busy||active===items.length-1||kind==='race'&&!locked&&!right?'disabled':''}>${kind==='race'?'Avanzar →':'Siguiente pista →'}</button></div></div>${allDone?`<div class="challenge-celebration" role="status">${kind==='cipher'?'✦ ¡Mensaje descifrado! '+escape(items.map(item=>item.letter).join('')):'🏆 ¡Meta alcanzada! '+items.reduce((points,_,i)=>points+((i+1)%3===0?20:10),0)+' puntos'}</div>`:''}`;
   }
   root.innerHTML=`<div class="challenge-guide"><p>${escape(guide)}</p><strong role="status">${done} / ${items.length} ${kind==='table'?'casillas correctas':kind==='multiselect'?'opciones correctas':'retos superados'}</strong></div><progress value="${done}" max="${items.length}" aria-label="Progreso del juego"></progress>${body}${['multiselect','table'].includes(kind)?`<div class="challenge-bottom"><p role="status">${message?escape(message):result==='correct'?'✓ ¡Todo correcto!':result?'Revisa las marcas de cada respuesta y vuelve a comprobar.':'Puedes corregir tus respuestas después de comprobar.'}</p><button type="button" data-challenge-check class="challenge-primary" ${disabled}>${busy?'Comprobando…':'Comprobar'}</button></div>`:message?`<p class="challenge-error" role="alert">${escape(message)}</p>`:''}`;
   root.querySelectorAll('[data-challenge-choice]').forEach(input=>input.onchange=()=>{const i=Number(input.dataset.challengeChoice);value[i]=input.checked;changed(i);draw();root.querySelector(`[data-challenge-choice="${i}"]`)?.focus({preventScroll:true});});
   root.querySelectorAll('[data-challenge-answer]').forEach(input=>{input.oninput=()=>{const i=Number(input.dataset.challengeAnswer);value[i]=input.value;changed(i);input.setAttribute('aria-invalid','false');input.classList.remove('is-correct','is-incorrect');input.closest('td')?.classList.remove('is-correct','is-incorrect');const small=input.closest('td')?.querySelector('small');if(small)small.textContent='Sin comprobar';};input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();check();}};});
   root.querySelectorAll('[data-race-choice]').forEach(button=>button.onclick=()=>{if(locked||busy)return;value[active]=items[active].choices[Number(button.dataset.raceChoice)].token;changed(active);draw();root.querySelector(`[data-race-choice="${button.dataset.raceChoice}"]`)?.focus({preventScroll:true});});
   root.querySelector('[data-challenge-check]')?.addEventListener('click',check);
   root.querySelector('[data-challenge-prev]')?.addEventListener('click',()=>go(active-1));
   root.querySelector('[data-challenge-next]')?.addEventListener('click',()=>go(active+1));
   root.querySelectorAll('[data-challenge-stage]').forEach(button=>button.onclick=()=>go(Number(button.dataset.challengeStage)));
  }
  draw();return {value:()=>copy(value),review(feedback){parts={...(feedback.parts||{})};result=feedback.result;if(feedback.items)items=copy(feedback.items);draw();}};
 };
})();
