/* Shared puzzle controls. This module receives student responses, never hidden solutions. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const letters = value => String(value || '').toUpperCase().replaceAll('Ñ','\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('\u0001','Ñ').replace(/[^A-ZÑ]/g,'');
  const shuffled = (values,seed) => values.map((value,index)=>{let hash=2166136261;for(const char of String(seed)+':'+index)hash=Math.imul(hash^char.charCodeAt(0),16777619);return {value,key:seed?(hash>>>0):Math.random()};}).sort((a,b)=>a.key-b.key).map(item=>item.value);
  const resultMark = result => result === 'correct' ? '✓' : result === 'incorrect' ? '×' : '';
  const setResult = (node, result) => {node.classList.remove('answer-right','answer-wrong');if(result==='correct'||result==='incorrect')node.classList.add(result==='correct'?'answer-right':'answer-wrong');node.setAttribute('aria-invalid',String(result==='incorrect'));};

  window.profesorErrorBoard = (root, config) => {
    const tokens = String(config.text || '').split(/\s+/).filter(Boolean);
    let start = -1, end = -1, correction = config.value?.correction || '', result = config.result;
    const selection = config.value?.selection;
    if (Array.isArray(selection) && selection.length===2 && selection.every(Number.isInteger) && selection[0]>=0 && selection[1]>=selection[0] && selection[1]<tokens.length && tokens.slice(selection[0],selection[1]+1).join(' ')===config.value?.selected) [start,end]=selection;
    else if(config.value?.selected){start=tokens.findIndex((_,i)=>tokens.slice(i,i+config.value.selected.split(/\s+/).length).join(' ')===config.value.selected);end=start<0?-1:start+config.value.selected.split(/\s+/).length-1;}
    const value = () => ({selected:start<0?'':tokens.slice(start,end+1).join(' '),correction,selection:start<0?[]:[start,end]});
    function changed(){result=null;config.onChange?.(value());}
    function draw(focus=false){
      root.className='puzzle-studio error-studio';
      root.innerHTML=`<div class="puzzle-guide"><span aria-hidden="true">🔎</span><div><strong>Detecta, corrige y comprueba</strong><p>Toca la palabra equivocada y escribe la corrección en su lugar.</p></div></div><div class="error-sentence" aria-label="Oración para corregir">${tokens.map((token,i)=>i===start?`<span class="error-inline"><input data-error-inline maxlength="200" autocomplete="off" spellcheck="false" aria-label="Corrección de ${esc(value().selected)}" value="${esc(correction)}" style="--answer-ch:${Math.min(28,Math.max(7,correction.length+2,value().selected.length+2))}" ${config.locked?'disabled':''}><span class="error-inline-result" aria-live="polite">${resultMark(result)}</span></span>`:i>start&&i<=end?'':`<button type="button" data-error-token="${i}" ${config.locked?'disabled':''}>${esc(token)}</button>`).join(' ')}</div><div class="error-selection-tools">${start<0?'<span>Primero selecciona el error.</span>':`<span>Has sustituido: <del>${esc(value().selected)}</del></span>${config.locked?'':`<div><button type="button" data-error-extend="left" ${start===0?'disabled':''} aria-label="Incluir la palabra anterior">← Ampliar</button><button type="button" data-error-extend="right" ${end===tokens.length-1?'disabled':''} aria-label="Incluir la palabra siguiente">Ampliar →</button><button type="button" data-error-reset>Cambiar selección</button></div>`}`}</div><div class="puzzle-board-actions"><span data-board-status role="status">${result==='correct'?'✓ ¡Corrección acertada!':result==='incorrect'?'× Revisa la selección o la corrección.':result==='pending'?'◷ Guardada para que la revise tu profesor.':'Puedes corregir una palabra o ampliar el fragmento.'}</span>${config.locked?'':'<button type="button" class="primary puzzle-check" data-board-check>Comprobar</button>'}</div>`;
      const input=root.querySelector('[data-error-inline]');
      if(input){setResult(input,result);input.oninput=()=>{correction=input.value;changed();setResult(input,null);input.style.setProperty('--answer-ch',Math.min(28,Math.max(7,correction.length+2)));root.querySelector('.error-inline-result').textContent='';root.querySelector('[data-board-status]').textContent='Pulsa Comprobar cuando termines.';};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();check();}};if(focus){input.focus({preventScroll:true});input.select();}}
      root.querySelectorAll('[data-error-token]').forEach(button=>button.onclick=()=>{if(config.locked)return;start=end=Number(button.dataset.errorToken);correction='';changed();draw(true);});
      root.querySelectorAll('[data-error-extend]').forEach(button=>button.onclick=()=>{if(config.locked)return;button.dataset.errorExtend==='left'?start--:end++;correction='';changed();draw(true);});
      root.querySelector('[data-error-reset]')?.addEventListener('click',()=>{start=end=-1;correction='';changed();draw();root.querySelector('[data-error-token]')?.focus({preventScroll:true});});
      root.querySelector('[data-board-check]')?.addEventListener('click',check);
    }
    function check(){if(config.locked)return;if(start<0||!correction.trim()){root.querySelector('[data-board-status]').textContent='Selecciona el error y escribe su corrección.';root.querySelector('[data-error-inline]')?.focus();return;}config.onCheck?.(value());}
    draw();
    return {value,review(grade){result=grade;draw();}};
  };

  window.profesorCrosswordBoard = (root, config) => {
    const entries=config.entries.map(entry=>({...entry,index:entry.number-1,cells:Array.from({length:entry.length},(_,i)=>`${entry.row+(entry.direction==='down'?i:0)}-${entry.col+(entry.direction==='down'?0:i)}`)}));
    let active=0, results={...(config.partResults||{})};
    const contents=new Map();
    entries.forEach(entry=>[...String(config.values?.[entry.index]||'')].forEach((letter,i)=>{if(letter!=='_'&&entry.cells[i])contents.set(entry.cells[i],letters(letter));}));
    const starts=new Map();entries.forEach(entry=>starts.set(entry.cells[0],[...(starts.get(entry.cells[0])||[]),entry.number]));
    const values=()=>{const response=Array(entries.length).fill('');entries.forEach(entry=>{const text=entry.cells.map(key=>contents.get(key)||'_').join('');response[entry.index]=text.replaceAll('_','')?text:'';});return response;};
    root.className='puzzle-studio crossword-studio';
    root.innerHTML=`<div class="puzzle-guide"><span aria-hidden="true">✦</span><div><strong>Una pista, una palabra</strong><p>Elige una pista y escribe en las casillas. Puedes pegar una palabra y usar las flechas.</p></div></div><div class="crossword-workbench"><div class="crossword-paper"><div class="crossword-scroll" tabindex="0" aria-label="Tablero de crucigrama; desplázalo si no cabe"><div class="studio-cross-grid" style="--columns:${config.grid[0]?.length||1}">${config.grid.flatMap((row,r)=>row.map((used,c)=>used?`<label class="studio-cross-cell"><small>${(starts.get(`${r}-${c}`)||[]).join('/')}</small><input data-cross-cell="${r}-${c}" value="${esc(contents.get(`${r}-${c}`)||'')}" maxlength="1" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Fila ${r+1}, columna ${c+1}" ${config.locked?'disabled':''}></label>`:'<span class="studio-cross-blank" aria-hidden="true"></span>')).join('')}</div></div><p class="crossword-scroll-help">Si el tablero es grande, deslízalo hacia los lados.</p></div><aside class="crossword-notebook"><div class="crossword-active" aria-live="polite"></div><div class="studio-cross-clues" aria-label="Pistas">${entries.map((entry,i)=>`<button type="button" data-cross-clue="${i}" aria-pressed="false"><b>${entry.number} ${entry.direction==='down'?'↓':'→'}</b><span>${esc(entry.clue)}<small>${entry.length} letras</small></span><em data-cross-result="${entry.index}"></em></button>`).join('')}</div></aside></div><div class="puzzle-board-actions"><span data-board-status role="status"></span>${config.locked?'':`<div>${config.onHint?'<button type="button" data-cross-hint>💡 Revelar letra</button>':''}<button type="button" class="primary puzzle-check" data-board-check>Comprobar</button></div>`}</div>`;
    const inputs=[...root.querySelectorAll('[data-cross-cell]')],cell=key=>inputs.find(input=>input.dataset.crossCell===key);
    function paint(){
      const current=entries[active];
      inputs.forEach(input=>{const key=input.dataset.crossCell;input.value=contents.get(key)||'';input.parentElement.classList.toggle('is-active',current.cells.includes(key));const memberships=entries.filter(entry=>entry.cells.includes(key));const grades=memberships.map(entry=>results[entry.index]).filter(Boolean);setResult(input,grades.includes('correct')?'correct':grades.includes('incorrect')?'incorrect':null);});
      root.querySelectorAll('[data-cross-clue]').forEach(button=>{const entry=entries[Number(button.dataset.crossClue)];button.setAttribute('aria-pressed',String(entries[active]===entry));setResult(button,results[entry.index]);button.querySelector('em').textContent=resultMark(results[entry.index]);});
      root.querySelector('.crossword-active').innerHTML=`<small>PISTA ${current.number} · ${current.direction==='down'?'VERTICAL':'HORIZONTAL'}</small><strong>${esc(current.clue)}</strong><span>${current.length} letras</span>`;
      const all=values();root.querySelector('[data-board-status]').textContent=`${inputs.filter(input=>input.value).length} / ${inputs.length} casillas · ${Object.values(results).filter(value=>value==='correct').length} / ${entries.length} palabras correctas`;
      return all;
    }
    function activate(index,focus=true){active=index;paint();if(focus){const key=entries[active].cells.find(key=>!contents.get(key))||entries[active].cells[0];cell(key)?.focus({preventScroll:true});cell(key)?.scrollIntoView({block:'nearest',inline:'nearest'});}}
    function change(keys){entries.filter(entry=>entry.cells.some(key=>keys.includes(key))).forEach(entry=>delete results[entry.index]);config.onChange?.(values());paint();}
    inputs.forEach(input=>{
      input.onfocus=()=>{input.select();if(!entries[active].cells.includes(input.dataset.crossCell))activate(entries.findIndex(entry=>entry.cells.includes(input.dataset.crossCell)),false);};
      input.oninput=()=>{if(config.locked)return;const key=input.dataset.crossCell;contents.set(key,letters(input.value).slice(-1));change([key]);const sequence=entries[active].cells,next=sequence[sequence.indexOf(key)+1];if(contents.get(key)&&next){cell(next)?.focus({preventScroll:true});cell(next)?.scrollIntoView({block:'nearest',inline:'nearest'});}};
      input.onkeydown=e=>{if(config.locked)return;const key=input.dataset.crossCell,[r,c]=key.split('-').map(Number),deltas={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]};if(deltas[e.key]){e.preventDefault();const [dr,dc]=deltas[e.key];cell(`${r+dr}-${c+dc}`)?.focus({preventScroll:true});}else if(e.key==='Backspace'&&!input.value){const sequence=entries[active].cells;cell(sequence[sequence.indexOf(key)-1])?.focus({preventScroll:true});}else if(e.key==='Enter'){e.preventDefault();config.onCheck?.(values());}};
      input.onpaste=e=>{if(config.locked)return;e.preventDefault();const sequence=entries[active].cells,offset=sequence.indexOf(input.dataset.crossCell),changed=[];[...letters(e.clipboardData.getData('text'))].forEach((letter,i)=>{if(sequence[offset+i]){contents.set(sequence[offset+i],letter);changed.push(sequence[offset+i]);}});change(changed);};
    });
    root.querySelectorAll('[data-cross-clue]').forEach(button=>button.onclick=()=>activate(Number(button.dataset.crossClue)));
    root.querySelector('[data-board-check]')?.addEventListener('click',()=>config.onCheck?.(values()));
    root.querySelector('[data-cross-hint]')?.addEventListener('click',()=>{const entry=entries[active],hint=config.onHint(entry.index,values()[entry.index]);if(hint&&entry.cells[hint.position]){const key=entry.cells[hint.position];contents.set(key,hint.letter);change([key]);cell(key)?.focus({preventScroll:true});}});
    paint();
    requestAnimationFrame(()=>{const first=cell(entries[active].cells[0]),viewport=root.querySelector('.crossword-scroll');if(first&&viewport)viewport.scrollLeft=Math.max(0,first.getBoundingClientRect().left-viewport.getBoundingClientRect().left+viewport.scrollLeft-viewport.clientWidth/2+first.clientWidth/2);});
    return {values,review(grades){results={...grades};paint();}};
  };

  const matchingScenes={
    'tren-decenas':{icon:'🚂',title:'Estación de las decenas',instruction:'Carga las cajas en el vagón que lleva su número.',piece:'Cajas de carga',object:'vagon',icons:{}},
    'bosque-vivo':{icon:'🌳',title:'Cuaderno del bosque',instruction:'Lleva cada observación a su zona del bosque.',piece:'Observaciones',object:'claro',icons:{'Nutrición':'🌱','Relación':'🦌','Reproducción':'🪺'}},
    'redaccion-titulares':{icon:'📰',title:'Mesa de titulares',instruction:'Deja cada recorte en la bandeja correspondiente.',piece:'Recortes de titulares',object:'bandeja',icons:{'Sujeto':'👤','Predicado':'✍️'}},
    'central-mensajes':{icon:'✉️',title:'Central de mensajes',instruction:'Completa las partes de las dos comunicaciones.',piece:'Pistas de comunicación',object:'mensaje',icons:{'Emisor':'✍️','Receptor':'👤','Mensaje':'💬','Canal':'📡'}},
    'laboratorio-medidas':{icon:'🔬',title:'Mesa de medición',instruction:'Coloca cada instrumento en su estación de medida.',piece:'Instrumentos y mediciones',object:'estacion',icons:{'Longitud':'📏','Tiempo':'⏱️','Masa':'⚖️','Temperatura':'🌡️'}},
    'archivo-sintagmas':{icon:'🗂️',title:'Archivo gramatical',instruction:'Guarda cada ficha en el cajón de su sintagma.',piece:'Fichas por archivar',object:'cajon',icons:{'Nominal':'N','Adverbial':'ADV','Adjetival':'ADJ','Preposicional':'PREP'}},
    'ciudad-economica':{icon:'🏙️',title:'Mapa de la ciudad',instruction:'Sitúa cada actividad en la zona económica correcta.',piece:'Actividades de la ciudad',object:'zona',icons:{'Primario':'🌾','Secundario':'🏭','Terciario':'🏪'}},
    'redaccion-compuesta':{icon:'🔗',title:'Taller de oraciones',instruction:'Conecta cada frase con su relación sintáctica.',piece:'Oraciones para conectar',object:'conexion',icons:{'Coordinada copulativa':'＋','Coordinada disyuntiva':'∨','Coordinada adversativa':'↔','Subordinada sustantiva':'↳'}},
    'atlas-registros':{icon:'📨',title:'Canales de comunicación',instruction:'Envía cada mensaje al canal de registro adecuado.',piece:'Mensajes pendientes',object:'canal',icons:{'Formal':'🏛️','Informal':'💬','Estándar':'📰'}},
    'hemeroteca-fuentes':{icon:'📚',title:'Hemeroteca histórica',instruction:'Coloca cada documento en la vitrina que le corresponde.',piece:'Documentos por catalogar',object:'vitrina',icons:{'Primaria':'✒️','Secundaria':'📖'}}
  };
  const matchingFinish={
    'tren-decenas':'¡Todos los vagones cargados! El tren puede salir.',
    'bosque-vivo':'Cuaderno de campo completo: las tres funciones vitales están clasificadas.',
    'redaccion-titulares':'¡Edición terminada! Los titulares ya tienen sujeto y predicado.',
    'central-mensajes':'Las dos comunicaciones están completas.',
    'laboratorio-medidas':'Las cuatro estaciones de medida están preparadas.',
    'archivo-sintagmas':'Archivo gramatical ordenado.',
    'ciudad-economica':'El mapa de actividades de la ciudad está completo.',
    'redaccion-compuesta':'Las relaciones entre proposiciones están conectadas.',
    'atlas-registros':'Los mensajes llegaron a su canal adecuado.',
    'hemeroteca-fuentes':'Las fuentes están catalogadas en la hemeroteca.'
  };
  window.profesorMatchingBoard = (root, config) => {
    let values=config.items.map((_,i)=>config.targets.includes(config.values?.[i])?config.values[i]:''),selected=null,results={...(config.partResults||{})};
    const order=shuffled(config.items.map((_,i)=>i),config.seed),targets=shuffled([...new Set(config.targets)],config.seed&&config.seed+':targets');
    const sceneId=root.closest('[data-public-scene]')?.dataset.publicScene;
    const scene=matchingScenes[sceneId];
    const transfer='application/x-profesor-match-'+Math.random().toString(36).slice(2);
    function changed(){results={};config.onChange?.(values.slice());draw();}
    function place(index,target){if(config.locked||!Number.isInteger(index)||index<0||index>=values.length)return;if(config.single)values=values.map(value=>value===target?'':value);values[index]=target;selected=null;changed();root.querySelector(`[data-match-bucket="${targets.indexOf(target)}"]`)?.focus({preventScroll:true});}
    const piece=(i,placed=false)=>`<button type="button" class="match-piece ${selected===i?'is-selected':''} ${results[i]==='correct'?'answer-right':results[i]==='incorrect'?'answer-wrong':''}" data-match-piece="${i}" aria-pressed="${selected===i}" draggable="${!config.locked}" ${config.locked?'disabled':''}><span>${esc(config.items[i])}</span><b aria-hidden="true">${resultMark(results[i])|| (placed?'×':'⠿')}</b><small class="sr-only">${results[i]==='correct'?'Correcta. ':results[i]==='incorrect'?'Incorrecta. ':''}${placed?'Toca para devolver o mover.':'Selecciona y elige destino.'}</small></button>`;
    function draw(){
      root.className='puzzle-studio matching-studio'+(scene?' match-scene':'');
      const guide=scene?`<div class="puzzle-guide"><span aria-hidden="true">${scene.icon}</span><div><strong>${scene.title}</strong><p>${scene.instruction} También puedes tocar una pieza y después su destino.</p></div></div>`:`<div class="puzzle-guide"><span aria-hidden="true">🧩</span><div><strong>Cada pieza en su lugar</strong><p>Arrastra una tarjeta o tócala y elige su destino. Toca una colocada para devolverla.</p></div></div>`;
      const sceneStart=scene?`<div class="match-scene-heading" aria-hidden="true"><span>${scene.icon}</span><b>${scene.title}</b><i></i></div>${sceneId==='tren-decenas'?'<div class="match-locomotive" aria-hidden="true"><span class="match-locomotive-cab">🚂</span><span>Expreso de los números</span><span class="match-locomotive-smoke">● ● ●</span></div>':''}`:'';
      const buckets=targets.map((target,t)=>{const placed=order.filter(i=>values[i]===target),solved=placed.length&&placed.every(i=>results[i]==='correct'),hasError=placed.some(i=>results[i]==='incorrect');const visual=scene?.icons[target]||'✦';return `<div class="match-bucket${placed.length?' has-pieces':''}${solved?' is-solved':''}${hasError?' has-error':''}"${scene?` data-match-object="${scene.object}"`:''}><button type="button" data-match-bucket="${t}" ${config.locked?'disabled':''}>${scene?`<span class="match-object-symbol" aria-hidden="true">${esc(visual)}</span>`:''}<strong>${esc(target)}</strong><small>${selected===null?'Elige una pieza o arrástrala aquí':'Colocar la pieza seleccionada aquí'}</small></button><div>${placed.map(i=>piece(i,true)).join('')}</div></div>`;}).join('');
      const completed=scene&&values.every(Boolean)&&config.items.every((_,i)=>results[i]==='correct');
      const finished=completed?`<div class="match-scene-finish" role="status"><span aria-hidden="true">★</span><strong>${matchingFinish[sceneId]}</strong>${sceneId==='redaccion-titulares'?`<div class="match-finished-headlines">${Array.from({length:Math.floor(config.items.length/2)},(_,i)=>`<span>${esc(config.items[i*2])} ${esc(config.items[i*2+1])}.</span>`).join('')}</div>`:''}</div>`:'';
      root.innerHTML=`${guide}<div class="matching-workbench"><section class="match-bank"><h4>${scene?scene.piece:'Piezas disponibles'} <small>${values.filter(value=>!value).length}</small></h4><div class="match-pieces" aria-label="Piezas disponibles">${order.filter(i=>!values[i]).map(i=>piece(i)).join('')||'<p class="match-empty">✓ Todas las piezas colocadas</p>'}</div></section><section class="match-destinations" aria-label="Destinos">${scene?`${sceneStart}<div class="match-scene-targets">${buckets}</div>`:buckets}</section></div>${finished}<div class="puzzle-board-actions"><span data-board-status role="status">${selected!==null?'Seleccionada: '+esc(config.items[selected])+'. Elige un destino.':`${values.filter(Boolean).length} / ${values.length} piezas colocadas${Object.keys(results).length?' · '+Object.values(results).filter(value=>value==='correct').length+' correctas':''}`}</span>${config.locked?'':'<div><button type="button" data-match-reset>↻ Reiniciar</button><button type="button" class="primary puzzle-check" data-board-check>Comprobar</button></div>'}</div>`;
      root.querySelectorAll('[data-match-piece]').forEach(button=>{const i=Number(button.dataset.matchPiece);button.onclick=()=>{if(config.locked)return;if(values[i]){values[i]='';selected=i;changed();}else{selected=selected===i?null:i;draw();}root.querySelector(`[data-match-piece="${i}"]`)?.focus({preventScroll:true});};button.ondragstart=e=>{if(config.locked)return e.preventDefault();e.dataTransfer.setData(transfer,String(i));e.dataTransfer.effectAllowed='move';};});
      root.querySelectorAll('[data-match-bucket]').forEach(button=>{const target=targets[Number(button.dataset.matchBucket)],bucket=button.parentElement;button.onclick=()=>place(selected,target);bucket.ondragover=e=>{if(!config.locked&&Array.from(e.dataTransfer.types).includes(transfer)){e.preventDefault();e.dataTransfer.dropEffect='move';bucket.classList.add('drag-over');}};bucket.ondragleave=e=>{if(!bucket.contains(e.relatedTarget))bucket.classList.remove('drag-over');};bucket.ondrop=e=>{e.preventDefault();bucket.classList.remove('drag-over');const text=e.dataTransfer.getData(transfer);if(text!=='')place(Number(text),target);};});
      root.querySelector('[data-match-reset]')?.addEventListener('click',()=>{values.fill('');selected=null;changed();root.querySelector('[data-match-piece]')?.focus({preventScroll:true});});
      root.querySelector('[data-board-check]')?.addEventListener('click',()=>{if(!values.some(Boolean)){root.querySelector('[data-board-status]').textContent='Coloca al menos una pieza antes de comprobar.';return;}config.onCheck?.(values.slice());});
    }
    draw();return {values:()=>values.slice(),review(grades){results={...grades};draw();}};
  };
})();
