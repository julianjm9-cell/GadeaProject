/* Self-contained games: educational content is loaded before play, with no AI calls. */
(() => {
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const key=value=>String(value||'').trim().toLocaleLowerCase('es').replaceAll('ñ','\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('\u0001','ñ').replace(/\s+/g,' ');
  const copy=value=>JSON.parse(JSON.stringify(value));
  const bingoScenes={
    'aeropuerto-habitos':['Panel de salidas','Aviso de megafonía','Localiza la frase del vuelo','✈','VUELO'],
    'atlas-cuerpo':['Lámina del cuerpo','Pista anatómica','Señala el nivel de organización','✚','NIVEL'],
    'atlas-explorador':['Mapa de expedición','Pista del cartógrafo','Encuentra el punto del mapa','✧','PUNTO'],
    'museo-expositivo':['Página de explicaciones','Nota de edición','Encuentra la pieza del texto','✎','BLOQUE'],
    'mapa-migraciones':['Mapa de movimientos','Pista demográfica','Señala el flujo o concepto','➜','SEÑAL'],
    'laboratorio-atomo':['Modelo del átomo','Pista del laboratorio','Localiza la partícula o propiedad','⚛','PIEZA'],
    'hospital-nutricion':['Atlas de la nutrición','Pista del cuerpo','Marca el órgano o proceso','✚','RUTA'],
    'asamblea-revoluciones':['Mural de la asamblea','Documento histórico','Encuentra la idea del mural','⚑','IDEA'],
    'archivo-contemporaneo':['Archivo contemporáneo','Expediente histórico','Sella el proceso correspondiente','▤','ARCHIVO'],
    'sala-comentario':['Página de comentario','Nota al margen','Señala el recurso lingüístico','✒','NOTA']
  };
  const circuitSymbols={
    'Pila':'🔋','Cables':'〰️','Bombilla':'💡','Regla':'📏',
    'Cobre':'🟠','Aluminio':'⚪','Hierro':'🔩','Goma':'🧽',
    'Camino cerrado':'🔁','Cables unidos':'🔌','Interruptor cerrado':'🎚️','Cable desconectado':'⛔',
    'Lámpara LED':'🔆','Linterna':'🔦','Ventilador':'🌀'
  };
  const shuffle=(items,seed)=>items.map((value,index)=>{let hash=2166136261;for(const char of String(seed)+':'+index)hash=Math.imul(hash^char.charCodeAt(0),16777619);hash=Math.imul(hash^(hash>>>16),2246822507);return {value,rank:hash>>>0};}).sort((a,b)=>a.rank-b.rank).map(item=>item.value);
  const types=['mystery','intruder','bingo'];
  function validate(q){
    const options=q.options;
    if(!types.includes(q.type))return;
    if(!Array.isArray(options)||options.some(item=>typeof item!=='string'||!item.trim()))throw Error('Completa todos los elementos del juego.');
    if(q.type==='mystery'){
      if(options.length!==3||typeof q.answer!=='string'||!q.answer.trim()||q.answer.length>100||options.some(clue=>clue.length>300)||new Set(options.map(key)).size!==3)throw Error('¿Quién soy?: escribe tres pistas distintas y una respuesta de hasta 100 caracteres.');
      const solution=key(q.answer).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      if(options.some(clue=>new RegExp('(^|[^\\p{L}\\p{N}_])'+solution+'($|[^\\p{L}\\p{N}_])','u').test(key(clue))))throw Error('Las pistas del misterio no pueden revelar la respuesta.');
    }else if(q.type==='intruder'){
      if(options.length<3||options.length>5||options.some(item=>item.length>140)||new Set(options.map(key)).size!==options.length||!options.includes(q.answer))throw Error('Intruso: de tres a cinco tarjetas distintas y una solución idéntica a una de ellas.');
    }else{
      const rows=options.map(item=>item.split('|').map(part=>part.trim()));
      if(rows.length!==9||rows.some(row=>row.length!==2||!row[0]||row[0].length>80||!row[1]||row[1].length>140)||[0,1].some(side=>new Set(rows.map(row=>key(row[side]))).size!==9))throw Error('Bingo: nueve líneas concepto | definición, sin repetir conceptos ni pistas. Conceptos hasta 80 caracteres y pistas hasta 140.');
      if(rows.some(([label,clue])=>key(label).length>=3&&new RegExp('(^|[^\\p{L}\\p{N}_])'+key(label).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^\\p{L}\\p{N}_])','u').test(key(clue))))throw Error('Las definiciones del bingo no deben contener su concepto.');
    }
  }
  function prepare(q,seed){
    validate(q);
    if(q.type!=='bingo')return {options:q.options.slice()};
    const rows=q.options.map(row=>row.split('|').map(part=>part.trim()));
    const cards=shuffle(rows.map(([label],i)=>({token:'card-'+i,label})),seed);
    const clues=shuffle(rows.map(([,clue],i)=>({token:'clue-'+i,clue,answer:'card-'+i})),seed+':clues');
    return {cards,clues};
  }
  function grade(q,value,part,data){
    if(q.type==='bingo'){
      const values=Array.isArray(value)?value:[];
      if(part!=null)return !values[part]?'unanswered':values[part]===data.clues[part]?.answer?'correct':'incorrect';
      return values.length!==9||values.some(item=>!item)?'unanswered':values.every((item,i)=>item===data.clues[i].answer)?'correct':'incorrect';
    }
    const answer=q.type==='mystery'?value?.answer:value;
    if(typeof answer!=='string'||!answer.trim())return 'unanswered';
    const normalize=q.type==='mystery'?text=>key(text).replace(/^[.!?¡¿ ]+|[.!?¡¿ ]+$/g,''):text=>String(text||'').trim().toLocaleLowerCase('es').replace(/\s+/g,' ');
    return [q.answer,...(q.alternatives||[])].some(expected=>normalize(answer)===normalize(expected))?'correct':'incorrect';
  }
  window.profesorMiniGames={types,validate,prepare,grade};

  window.profesorMiniGame=(root,config)=>{
    const kind=config.kind,locked=!!config.locked;
    const sceneId=root.closest('[data-public-scene]')?.dataset.publicScene||'';
    const bingoScene=bingoScenes[sceneId];
    let value=kind==='mystery'?{answer:typeof config.value?.answer==='string'?config.value.answer:'',cluesUsed:Math.max(1,Math.min(3,Number(config.value?.cluesUsed)||1))}:kind==='bingo'?Array.from({length:9},(_,i)=>config.value?.[i]||''):typeof config.value==='string'?config.value:'';
    let result=config.result,parts={...(config.parts||{})},explanation=config.explanation||'',active=Math.max(0,Math.min(8,Number(config.focus)||0)),busy=false,message='';
    const options=shuffle(config.options||[],config.seed||kind),cards=config.cards||[],clues=config.clues||[];
    const marks=()=>new Set(Object.keys(parts).filter(index=>parts[index]==='correct').map(index=>value[index]));
    const lines=()=>{const done=marks(),hit=i=>done.has(cards[i]?.token);return [...[0,1,2].map(r=>[r*3,r*3+1,r*3+2]),...[0,1,2].map(c=>[c,c+3,c+6]),[0,4,8],[2,4,6]].filter(line=>line.every(hit)).length;};
    const statusClass=grade=>grade==='correct'?'answer-right':grade==='incorrect'?'answer-wrong':'';
    function changed(){result=null;message='';if(kind!=='bingo')explanation='';config.onChange?.(copy(value));}
    async function check(){
      if(locked||busy)return;
      const answered=kind==='mystery'?value.answer.trim():kind==='bingo'?value[active]:value;
      if(!answered){message=kind==='mystery'?'Escribe el concepto antes de comprobar.':'Selecciona una tarjeta antes de comprobar.';draw();root.querySelector('[data-mystery-answer]')?.focus({preventScroll:true});return;}
      busy=true;draw();
      try{
        const feedback=await config.onCheck?.(copy(value),kind==='bingo'?active:null);
        if(feedback){if(kind==='bingo'){parts={...parts,...(feedback.parts||{}),[active]:feedback.result};}else result=feedback.result;explanation=feedback.explanation||explanation;}
        message='';
      }catch(error){message=error?.message||'No se pudo guardar. Tu respuesta sigue aquí; vuelve a comprobar.';}
      finally{busy=false;draw();root.querySelector('[data-mini-check]')?.focus({preventScroll:true});}
    }
    function advance(direction){
      active=(active+direction+clues.length)%clues.length;
      message='';draw();if(!locked)config.onFocus?.(active);root.querySelector('.bingo-definition')?.focus({preventScroll:true});
    }
    function draw(){
      root.className='mini-game mini-'+kind+(bingoScene?' bingo-scene bingo-scene--'+sceneId:'');
      const disabled=locked||busy?'disabled':'';
      if(kind==='mystery'){
        root.innerHTML=`<div class="mystery-workbench"><div class="mystery-secret" aria-hidden="true"><span>?</span><i>✦</i></div><div class="mystery-notebook"><div class="mini-section-title"><strong>Tus pistas</strong><span>${value.cluesUsed} / 3</span></div><ol class="mystery-clues">${(config.options||[]).map((clue,i)=>`<li class="${i<value.cluesUsed?'is-revealed':'is-hidden'}"><b>${i+1}</b><span>${i<value.cluesUsed?escape(clue):'Pista por descubrir'}</span>${i>=value.cluesUsed?'<small aria-hidden="true">◇</small>':''}</li>`).join('')}</ol><button type="button" data-mystery-hint ${disabled||value.cluesUsed===3?'disabled':''}>💡 ${value.cluesUsed===3?'Tienes todas las pistas':'Descubrir otra pista'}</button></div></div><div class="mystery-answer-row"><label><span>¿Qué concepto es?</span><input data-mystery-answer class="${statusClass(result)}" maxlength="100" autocomplete="off" value="${escape(value.answer)}" placeholder="Escribe tu respuesta" ${disabled}></label>${locked?'':`<button type="button" class="mini-primary" data-mini-check ${disabled}>${busy?'Comprobando…':'Comprobar'}</button>`}</div><div class="mini-feedback ${result||''}" role="status">${escape(message|| (result==='correct'?'✓ ¡Misterio resuelto! '+(4-value.cluesUsed)*10+' puntos.':result==='incorrect'?'× Todavía no. Prueba otra respuesta o descubre una pista.':'Empieza con una pista. Puedes pedir ayuda cuando la necesites.'))}${result==='correct'&&explanation?'<p>'+escape(explanation)+'</p>':''}</div>`;
        const input=root.querySelector('[data-mystery-answer]');
        input.oninput=()=>{value.answer=input.value;changed();input.classList.remove('answer-right','answer-wrong');input.removeAttribute('aria-invalid');root.querySelector('.mini-feedback').textContent='Pulsa Comprobar cuando tengas la respuesta.';};
        input.setAttribute('aria-invalid',String(result==='incorrect'));
        input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();check();}};
        root.querySelector('[data-mystery-hint]').onclick=()=>{if(locked||busy||value.cluesUsed>=3)return;value.cluesUsed++;changed();draw();root.querySelector('[data-mystery-answer]').focus({preventScroll:true});};
      }else if(kind==='intruder'){
        root.innerHTML=`<div class="mini-game-guide"><span aria-hidden="true">🔎</span><div><strong>Hay uno que no encaja</strong><p>Selecciona una tarjeta y comprueba tu elección.</p></div></div><div class="intruder-cards" role="group" aria-label="Conceptos: selecciona el intruso">${options.map((label,i)=>`<button type="button" data-intruder="${i}" aria-pressed="${value===label}" class="${value===label?'is-selected '+statusClass(result):''}" ${disabled}><b aria-hidden="true">${String.fromCharCode(65+i)}</b>${sceneId==='taller-circuitos'?`<i class="intruder-object" aria-hidden="true">${circuitSymbols[label]||'⚡'}</i>`:''}<span>${escape(label)}</span><small>${value===label?(result==='correct'?'✓ Correcto':result==='incorrect'?'× Revisa':'Seleccionado'):'Elegir'}</small></button>`).join('')}</div><div class="mini-game-bottom"><div class="mini-feedback ${result||''}" role="status">${escape(message||(result==='correct'?'✓ ¡Has encontrado al intruso!':result==='incorrect'?'× Ese concepto sí pertenece al grupo. Prueba otro.':'Busca qué comparten los demás.'))}${result==='correct'&&explanation?'<p>'+escape(explanation)+'</p>':''}</div>${locked?'':`<button type="button" class="mini-primary" data-mini-check ${disabled}>${busy?'Comprobando…':'Comprobar'}</button>`}</div>`;
        root.querySelectorAll('[data-intruder]').forEach(button=>button.onclick=()=>{if(locked||busy)return;value=options[Number(button.dataset.intruder)];changed();draw();root.querySelector(`[data-intruder="${button.dataset.intruder}"]`)?.focus({preventScroll:true});});
      }else{
        const done=marks(),selected=value[active],currentResult=parts[active],lineCount=lines();
        const boardArt=bingoScene?`<div class="bingo-scene-art" aria-hidden="true"><span class="bingo-scene-art-symbol">${escape(bingoScene[3])}</span><i></i><i></i><i></i></div>`:'';
        const cardButtons=cards.map((card,i)=>`<button type="button" data-bingo-card="${i}" aria-pressed="${card.token===selected}" class="${done.has(card.token)?'is-found':card.token===selected?'is-selected '+statusClass(currentResult):''}" ${disabled||done.has(card.token)?'disabled':''}>${bingoScene?`<b class="bingo-scene-card-code" aria-hidden="true">${escape(bingoScene[4])} ${String(i+1).padStart(2,'0')}</b>`:''}<span>${escape(card.label)}</span><small>${done.has(card.token)?'✓ Encontrado':card.token===selected?(currentResult==='incorrect'?'× Revisa':'Seleccionado'):'Elegir'}</small></button>`).join('');
        root.innerHTML=`<div class="bingo-workbench"><div class="bingo-carton"><div class="mini-section-title"><strong>${bingoScene?escape(bingoScene[0]):'Tu cartón'}</strong><span>${done.size} / 9</span></div><div class="bingo-cards" role="group" aria-label="${bingoScene?escape(bingoScene[0]):'Cartón de nueve conceptos'}">${boardArt}${cardButtons}</div><div class="bingo-line-status" role="status">${done.size===9?bingoScene?'★ ¡Tablero completo! Has localizado los nueve conceptos.':'★ ¡BINGO! Has completado el cartón.':lineCount?'★ ¡Línea! Sigue hasta completar el tablero.':'Completa una fila, columna o diagonal para conseguir línea.'}</div></div><aside class="bingo-clue-card"><div class="mini-section-title"><strong>${bingoScene?escape(bingoScene[1]):'Definición'}</strong><span>${active+1} / ${clues.length}</span></div><p class="bingo-definition" tabindex="-1">${escape(clues[active]?.clue||'')}</p><p class="mini-feedback ${currentResult||''}" role="status">${escape(message||(currentResult==='correct'?'✓ Concepto encontrado. Pasa a la siguiente definición.':currentResult==='incorrect'?'× Esa tarjeta no corresponde. Prueba otra.':bingoScene?bingoScene[2]+'.':'Selecciona el concepto que corresponde a esta definición.'))}</p>${locked?'':`<button type="button" class="mini-primary" data-mini-check ${disabled||currentResult==='correct'?'disabled':''}>${busy?'Comprobando…':'Comprobar'}</button>`}<div class="bingo-clue-navigation"><button type="button" data-bingo-prev ${busy?'disabled':''} aria-label="Definición anterior">←</button><button type="button" data-bingo-next ${busy?'disabled':''}>${currentResult==='correct'?'Siguiente definición →':'Pasar definición →'}</button></div></aside></div>`;
        if(bingoScene&&['atlas-cuerpo','atlas-explorador','mapa-migraciones','hospital-nutricion','laboratorio-atomo','sala-comentario'].includes(sceneId)&&done.size<9)root.querySelector('.bingo-line-status').textContent=`${done.size} de 9 conceptos localizados. Sigue las pistas para completar el tablero.`;
        root.querySelectorAll('[data-bingo-card]').forEach(button=>button.onclick=()=>{if(locked||busy||currentResult==='correct')return;value[active]=cards[Number(button.dataset.bingoCard)].token;delete parts[active];changed();draw();root.querySelector(`[data-bingo-card="${button.dataset.bingoCard}"]`)?.focus({preventScroll:true});});
        root.querySelector('[data-bingo-prev]').onclick=()=>advance(-1);root.querySelector('[data-bingo-next]').onclick=()=>advance(1);
      }
      root.querySelector('[data-mini-check]')?.addEventListener('click',check);
    }
    draw();return {value:()=>copy(value),review(feedback){result=feedback.result;parts={...(feedback.parts||{})};explanation=feedback.explanation||explanation;draw();}};
  };
})();
