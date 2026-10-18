/* Shared student player and read-only teacher view for delivered materials. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const rich = value => window.profesorText?.rich ? window.profesorText.rich(value) : escape(value);
  const errorExample = prompt => {const quoted=[...String(prompt).matchAll(/[«“"]([^«»“”"]+)[»”"]/g)];return quoted.length?quoted.at(-1)[1]:String(prompt).split(/:\s*/).at(-1).trim()};
  const timelineLabel = (value,reveal) => reveal?String(value):String(value)
    .replace(/\b(?:1\d{3}|20\d{2})-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/.]\d{1,2}[/.](?:1\d{3}|20\d{2})\b|\b\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(?:1\d{3}|20\d{2})\b|\b(?:1\d{3}|20\d{2})\b/gi,'fecha oculta')
    .replace(/\bfecha oculta\s*[–—:-]\s*/gi,'').trim()||'Fecha oculta';
  const labels = {pairs:'Relacionar',gaps:'Completar',multigaps:'Texto con huecos',numeric:'Respuesta numérica',quiz:'Elegir respuesta',short:'Respuesta breve',order:'Ordenar',classify:'Clasificar',boolean:'Verdadero / Falso',reading:'Comprensión',problem:'Problemas',flashcard:'Flashcards',memory:'Memory',sentence:'Construye la frase',timeline:'Línea temporal',error:'Encuentra el error',wordsearch:'Sopa de letras',crossword:'Crucigrama',dragdrop:'Arrastrar y soltar',pasapalabra:'Pasapalabra',hangman:'Ahorcado',visualquiz:'Quiz visual',imagepoint:'Señalar imagen',mystery:'¿Quién soy?',intruder:'Elimina al intruso',bingo:'Bingo de conceptos'};
  const choice = new Set(['pairs','quiz','boolean','classify','visualquiz']);
  const sequence = new Set(['order','sentence','timeline']);
  const open = new Set(['short','reading','problem','error']);
  const studentRoot = document.getElementById('studentMaterials');
  const flashFront = new Set();
  const letterKey=value=>String(value||'').toUpperCase().replaceAll('Ñ','\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('\u0001','Ñ');
  const wordKey=value=>String(value||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function findWordPath(grid,word){
    const text=wordKey(word);
    for(let r=0;r<grid.length;r++)for(let c=0;c<(grid[r]||[]).length;c++)for(const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const path=Array.from(text,(_,i)=>[r+i*dr,c+i*dc]);
      if(path.every(([y,x],i)=>grid[y]?.[x]===text[i]))return path;
    }
    return null;
  }
  let wordsearchHint=null,wordsearchMessage='';
  let flashBusy = false, memoryBusy = false, memoryOpen = [], active = null, activeWord = 0, activeLetter = 0, pickedCell = null, firstCard = null, saving = Promise.resolve(), draftTimer = null, lastList = '', watcher = null, reviewIndex = null, teacherReviewIndex = null, watchedSession = null;
  const val = (session, n) => session.progress?.responses?.[String(n)];
  const grade = (session, n) => session.progress?.grades?.[String(n)];
  const partGrade = (session, n, part) => session.progress?.parts?.[String(n)]?.[String(part)];
  const option = (label, selected, action, value, disabled) => `<button type="button" class="live-option ${selected?'selected':''}" data-live-action="${action}" data-value="${escape(value)}" ${disabled?'disabled':''}>${label}</button>`;
  const image = (session, q, teacher) => q.image ? `<img class="live-image" src="${teacher?'/api/profesor/materials/'+encodeURIComponent(q.image.id)+'/preview?app=profesor_particular':'/api/profesor/student-material-sessions/'+encodeURIComponent(session.id)+'/images/'+encodeURIComponent(q.image.id)}" alt="${escape(q.image.filename)}">` : '';
  function summaryValue(value, question) {
    const empty='Aún sin responder',kind=question?.type;
    if(value==null||value===''||(Array.isArray(value)&&!value.length))return empty;
    if(kind==='memory'&&Array.isArray(value)){
      const cards=new Map((question.cards||[]).map(card=>[card.token,card.label]));
      return value.map((pair,index)=>Array.isArray(pair)&&pair.length===2&&pair.every(token=>cards.has(token))?pair.map(token=>cards.get(token)).join(' ↔ '):'Pareja '+(index+1)+' encontrada').join(' · ');
    }
    if(kind==='bingo'&&Array.isArray(value))return (question.clues||[]).map((clue,index)=>clue.clue+': '+((question.cards||[]).find(card=>card.token===value[index])?.label||'Sin responder')).join(' · ');
    if(kind==='wordsearch'&&Array.isArray(value)){
      const words=(question.words||[]).filter((word,index)=>Array.isArray(value[index])&&value[index].length);
      return words.length?'Palabras marcadas: '+words.join(' · '):empty;
    }
    if(kind==='dragdrop'&&Array.isArray(value))return (question.items||[]).map((item,index)=>item+' → '+(value[index]||'Sin colocar')).join(' · ');
    if(kind==='pasapalabra'&&Array.isArray(value))return (question.entries||[]).map((entry,index)=>entry.letter+': '+(value[index]||'Sin responder')).join(' · ');
    if(kind==='crossword'&&Array.isArray(value))return (question.entries||[]).map((entry,index)=>(entry.number||index+1)+': '+(value[index]||'Sin responder')).join(' · ');
    if(kind==='multigaps'&&Array.isArray(value))return value.map((answer,index)=>'Hueco '+(index+1)+': '+(answer||'Sin responder')).join(' · ');
    if(kind==='imagepoint'&&Array.isArray(value))return 'Zona marcada en la imagen';
    if(kind==='hangman'&&Array.isArray(value))return 'Letras elegidas: '+value.filter(letter=>typeof letter==='string'&&letter.length===1).join(', ');
    if(kind==='flashcard')return {correct:'La sabía',partial:'Con ayuda',incorrect:'Repasar'}[value]||'Sin valorar';
    if(Array.isArray(value))return value.filter(item=>typeof item==='string'||typeof item==='number').join(' → ')||empty;
    if(typeof value==='object')return value.answer!==undefined?(String(value.answer||empty)+' · '+Math.max(1,Math.min(3,Number(value.cluesUsed)||1))+' pistas abiertas'):[value.selected?'Error: '+value.selected:'',value.correction?'Corrección: '+value.correction:''].filter(Boolean).join(' · ')||empty;
    return String(value);
  }
  function questionMarkup(session, n, teacher = false) {
    const q = session.questions[n], response = val(session,n), result=grade(session,n), locked = teacher || session.status==='completed';
    const disabled=locked?'disabled':'', kind=q.type;
    let controls='';
    if(['mystery','intruder','bingo'].includes(kind)){
      controls=`<div id="live-mini-${n}" data-mini-kind="${kind}"></div>`;
    } else if(choice.has(kind)) {
      controls=`<div class="live-options">${(q.options||[]).map((item,i)=>option(`<b>${String.fromCharCode(65+i)}</b><span>${escape(item)}</span>`,response===item,'choice',item,locked)).join('')}</div>`;
      if(!q.options?.length)controls=`<input class="live-text" data-live-field="text" value="${escape(response||'')}" placeholder="Escribe la respuesta" ${disabled}>`;
    } else if(kind==='gaps') {
      const parts=q.prompt.split('___');controls=`<div class="live-gap">${rich(parts[0])}<input data-live-field="text" value="${escape(response||'')}" aria-label="Completa el hueco" ${disabled}>${rich(parts.slice(1).join('___'))}</div>`;
    } else if(kind==='multigaps') {
      const parts=q.prompt.split('___'), answers=Array.isArray(response)?response:[];
      controls=`<div class="live-gap">${parts.map((text,i)=>`${rich(text)}${i<q.count?`<input data-live-field="part" data-part="${i}" value="${escape(answers[i]||'')}" aria-label="Hueco ${i+1}" ${disabled}>${locked?'':`<button type="button" data-live-action="check-part" data-part="${i}" aria-label="Comprobar hueco ${i+1}">✓</button>`}<small class="live-mini-result ${partGrade(session,n,i)||''}">${partGrade(session,n,i)==='correct'?'✓':partGrade(session,n,i)==='incorrect'?'×':''}</small>`:''}`).join('')}</div>`;
    } else if((kind==='sentence'||kind==='timeline')) {
      controls=`<div id="live-sentence-${n}" class="sentence-game"></div>`;
    } else if(sequence.has(kind)) {
      const steps=Array.isArray(response)?response:q.options||[];
      controls=`<p class="live-hint">Ordena los elementos con las flechas.${kind==='timeline'&&(q.options||[]).some(item=>/\b(?:1\d{3}|20\d{2})\b/.test(item))?' Las fechas aparecerán al comprobar.':''}</p><div class="live-stack">${steps.map((item,i)=>{const label=kind==='timeline'?timelineLabel(item,!!result):item;return `<div class="live-stack-row ${kind==='timeline'&&result?partGrade(session,n,i)||'':''}"><b>${i+1}.</b><span>${escape(label)}</span><button type="button" data-live-action="move" data-pos="${i}" data-dir="-1" ${locked||i===0?'disabled':''} aria-label="Subir ${escape(label)}">↑</button><button type="button" data-live-action="move" data-pos="${i}" data-dir="1" ${locked||i===steps.length-1?'disabled':''} aria-label="Bajar ${escape(label)}">↓</button></div>`}).join('')}</div>`;
    } else if(kind==='pasapalabra') {
      const entries=q.entries||[], answers=Array.isArray(response)?response:[], focused=session.progress?.focus?.question_index===n?session.progress.focus.part:null,current=Math.min(teacher&&focused!=null?focused:activeLetter,entries.length-1);
      const alphabet=[...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'];
      controls=`<div class="live-pasapalabra-stage"><div class="live-rosco live-advanced-rosco" aria-label="Rosco de Pasapalabra">${alphabet.map((letter,slot)=>{const i=entries.findIndex(entry=>letterKey(entry.letter)===letter),angle=slot/alphabet.length*Math.PI*2,style=`left:${50+44*Math.sin(angle)}%;top:${50-44*Math.cos(angle)}%`;if(i<0)return `<span class="live-empty-letter" style="${style}" aria-hidden="true"></span>`;const status=partGrade(session,n,i);return `<button type="button" style="${style}" data-live-action="letter" data-index="${i}" class="${i===current?'active':''} ${status||''}" aria-label="Letra ${escape(letter)}: ${status==='correct'?'correcta':status==='incorrect'?'para repasar':'pendiente'}" ${locked?'disabled':''}>${escape(letter)}${status?`<small>${status==='correct'?'✓':'×'}</small>`:''}</button>`}).join('')}</div><div class="live-clue"><strong>${entries[current]?.mode==='contains'?'Contiene la':'Con la'} ${escape(entries[current]?.letter||'')}:</strong><p tabindex="0" aria-label="Pista">${rich(entries[current]?.clue||'')}</p><input data-live-field="part" data-part="${current}" value="${escape(answers[current]||'')}" maxlength="60" aria-label="Respuesta para la letra ${escape(entries[current]?.letter||'')}" autocomplete="off" ${disabled}><button type="button" data-live-action="check-part" data-part="${current}" class="live-primary" ${disabled}>Comprobar</button></div></div><div class="live-letter-navigation"><button type="button" data-live-action="letter-previous" ${disabled}>‹ Anterior</button><span role="status">${current+1} / ${entries.length}</span><button type="button" data-live-action="pass" ${disabled}>Siguiente ›</button></div><p class="live-game-summary" role="status">${entries.filter((_,i)=>partGrade(session,n,i)==='correct').length} correctas · ${entries.filter((_,i)=>partGrade(session,n,i)==='incorrect').length} para repasar</p>`;
    } else if(kind==='dragdrop') {
      controls=`<div id="live-puzzle-${n}" data-shared-puzzle="dragdrop"></div>`;
    } else if(kind==='memory') {
      const matched=Array.isArray(response)?response:[], tokens=new Set(matched.flat()), selected=teacher&&session.progress?.focus?.question_index===n?session.progress.focus.token:firstCard;
      controls=`<div class="memory-stage"><div class="memory-toolbar"><span>Destapa dos tarjetas y encuentra su pareja.</span><p role="status">${matched.length}/${(q.cards||[]).length/2} parejas encontradas</p></div><progress class="memory-progress" value="${matched.length}" max="${(q.cards||[]).length/2}" aria-label="Parejas encontradas"></progress><div class="live-memory memory-board" style="--memory-columns:${q.cards?.length===4?2:q.cards?.length<=6?3:4}">${(q.cards||[]).map((card,i)=>{const revealed=tokens.has(card.token)||selected===card.token||memoryOpen.includes(card.token);return `<button type="button" data-live-action="card" data-value="${escape(card.token)}" aria-label="${revealed?escape(card.label):'Tarjeta '+(i+1)}" aria-pressed="${revealed}" class="memory-card ${tokens.has(card.token)?'matched':revealed?'revealed':''}" ${locked||tokens.has(card.token)||memoryBusy?'disabled':''}><span class="memory-card-content">${revealed?escape(card.label):'<span class="memory-card-mark" aria-hidden="true">✦</span>'}</span>${tokens.has(card.token)?'<small>✓ Pareja</small>':''}</button>`}).join('')}</div></div>`;
    } else if(kind==='wordsearch') {
      const found=Array.isArray(response)?response:[], size=q.grid?.length||0, correct=(q.words||[]).map((_,i)=>partGrade(session,n,i)==='correct'),paths=new Set(found.flatMap((path,i)=>correct[i]&&Array.isArray(path)?path.map(cell=>cell.join('-')):[])),word=activeWord;
      controls=`<div class="live-wordsearch-board"><div class="live-word-grid" role="group" aria-label="Sopa de letras de ${size} filas y ${size} columnas" style="--size:${size}">${(q.grid||[]).flatMap((row,r)=>row.map((letter,c)=>`<button type="button" data-live-action="cell" data-row="${r}" data-col="${c}" tabindex="${r===0&&c===0?0:-1}" class="${paths.has(r+'-'+c)?'found':''} ${pickedCell?.[0]===r&&pickedCell?.[1]===c?'picked':''} ${wordsearchHint?.[0]===r&&wordsearchHint?.[1]===c?'hinted':''}" ${locked?'disabled':''} aria-label="Fila ${r+1}, columna ${c+1}: ${escape(letter)}">${escape(letter)}</button>`)).join('')}</div><aside class="live-wordsearch-sidebar"><strong role="status">${correct.filter(Boolean).length} / ${(q.words||[]).length} palabras encontradas</strong><p>Toca la primera y la última letra, o arrastra. Puedes buscar las palabras en cualquier orden.</p><div class="live-words">${(q.words||[]).map((item,i)=>`<button type="button" data-live-action="word" data-index="${i}" class="${i===word?'active':''} ${correct[i]?'correct':''}" ${locked||correct[i]?'disabled':''}>${correct[i]?'✓ ':''}${escape(item)}</button>`).join('')}</div><p class="live-wordsearch-status" role="status">${escape(wordsearchMessage||'Elige una palabra y localízala en el tablero.')}</p><button type="button" data-live-action="wordsearch-hint" ${locked||correct.every(Boolean)?'disabled':''}>Pista</button><button type="button" data-live-action="wordsearch-clear" ${locked||!pickedCell?'disabled':''}>Borrar selección</button></aside></div>`;
    } else if(kind==='crossword') {
      controls=`<div id="live-puzzle-${n}" data-shared-puzzle="crossword"></div>`;
    } else if(kind==='hangman') {
      const chosen=Array.isArray(response)?response:[];
      const errors=q.errors||0,mask=String(q.mask||'_'.repeat(q.length||0)),finished=errors>=7||!mask.includes('_'),parts=['<circle cx="75" cy="36" r="11"/>','<path d="M75 47V74"/>','<path d="M75 53L55 64"/>','<path d="M75 53L95 64"/>','<path d="M75 74L57 96"/>','<path d="M75 74L93 96"/>','<path d="M71 33l2 2m6-2l-2 2"/>'];
      controls=`<div class="live-hangman-board"><div class="live-hangman-figure" aria-label="${errors} de 7 fallos"><svg viewBox="0 0 115 115" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" aria-hidden="true"><path d="M15 105H95M30 105V10H75V25"/>${parts.slice(0,errors).join('')}</svg></div><div class="live-hangman-clue"><strong>Pista</strong><p>${rich(q.prompt)}</p></div><div class="live-hangman-lives" role="status"><strong>${Math.max(0,7-errors)} intentos restantes</strong><span aria-hidden="true">${'♥'.repeat(Math.max(0,7-errors))}<i>${'♡'.repeat(Math.min(7,errors))}</i></span></div><div class="live-hangman-word" aria-label="Palabra: ${escape(mask.replaceAll('_',' letra oculta '))}">${[...mask].map(letter=>letter===' '?'<span class="word-space" aria-hidden="true"></span>':`<span aria-hidden="true">${letter==='_'?'':escape(letter)}</span>`).join('')}</div><div class="live-letters" role="group" aria-label="Letras disponibles">${[...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'].map(letter=>`<button type="button" data-live-action="guess" data-value="${letter}" ${locked||chosen.includes(letter)||finished?'disabled':''} class="${chosen.includes(letter)?mask.includes(letter)?'correct':'incorrect':''}" aria-label="Letra ${letter}">${letter}</button>`).join('')}</div><p class="live-hangman-help" role="status">${finished?errors<7?'✓ ¡Palabra descubierta!':'Se han agotado los intentos. Puedes terminar para ver la solución.':'Elige una letra. También puedes usar el teclado.'}</p></div>`;
    } else if(kind==='imagepoint') {
      const point=Array.isArray(response)?response:null;
      controls=`<div class="live-image-point" data-live-action="point">${image(session,q,teacher)}${point?`<span style="left:${Math.max(0,Math.min(100,Number(point[0])||0))}%;top:${Math.max(0,Math.min(100,Number(point[1])||0))}%">●</span>`:''}</div><p class="live-hint">Toca el lugar correcto en la imagen.</p>`;
    } else if(kind==='flashcard') {
      const back=q.revealed_answer!=null&&!flashFront.has(n), text=back?q.revealed_answer:q.prompt;
      controls=`<div class="flashcard-study"><button type="button" class="flash-card" data-live-action="flash-flip" aria-pressed="${back}" ${locked||flashBusy?'disabled':''}><span class="flashcard-face-label">${back?'Respuesta':'Pregunta'}</span><strong class="flashcard-copy ${String(text).length>220?'flashcard-copy-long':''}">${rich(text)}</strong><span class="flashcard-turn"><span aria-hidden="true">↻</span> ${back?'Volver a la pregunta':'Ver respuesta'}</span></button><div class="flashcard-assess-slot"><p class="flashcard-help">${locked?'Tu valoración: '+({correct:'La sabía',partial:'Con ayuda',incorrect:'Repasar'}[response]||'Sin valorar'):back?'¿Cómo te ha ido? Elige una opción para guardar tu valoración.':'Piensa la respuesta y gira la tarjeta para comprobarla.'}</p>${locked?'':`<div class="play-flash-assess" role="group" aria-label="Valora tu respuesta" ${back?'':'hidden'}>${[['correct','✓ La sabía'],['partial','◷ Con ayuda'],['incorrect','↻ Repasar']].map(([value,label])=>`<button type="button" data-live-action="flash-grade" data-value="${value}" aria-pressed="${response===value}" class="${response===value?'selected':''}" ${flashBusy?'disabled':''}>${label}</button>`).join('')}</div>`}</div></div>`;
    } else if(kind==='error') {
      controls=`<div id="live-puzzle-${n}" data-shared-puzzle="error"></div>`;
    } else if(kind==='problem') {
      controls=`<textarea data-live-field="text" placeholder="Datos, planteamiento, cálculos y respuesta…" ${disabled}>${escape(response||'')}</textarea>`;
    } else if(open.has(kind)) {
      controls=`<textarea data-live-field="text" placeholder="Escribe tu respuesta…" ${disabled}>${escape(response||'')}</textarea>`;
    } else {
      controls=`<input class="live-text" data-live-field="text" value="${escape(response||'')}" placeholder="${kind==='numeric'?'Escribe el resultado':'Escribe tu respuesta'}" ${disabled}>${q.unit?`<strong>${escape(q.unit)}</strong>`:''}`;
    }
    const partial=['pasapalabra','multigaps','crossword','dragdrop','memory','wordsearch'].includes(kind);
    const feedback=result&&!(kind==='hangman'&&result==='unanswered')?`<p class="live-feedback ${result}" role="status">${kind==='flashcard'?'Valoración guardada: '+({correct:'La sabía',partial:'Con ayuda',incorrect:'Repasar'}[result]||'Sin valorar'):result==='correct'?'✓ Correcto':result==='pending'?'◷ Guardado para revisión':result==='partial'?'◷ Parcialmente correcto':result==='unanswered'?(['crossword','dragdrop'].includes(kind)?'Completa las casillas o piezas que faltan.':'Sin responder'):'× Puedes volver a intentarlo'}</p>`:'';
    const review=teacher&&session.status==='completed'&&open.has(kind)&&(kind!=='error'||result==='pending')?`<div class="live-grade-actions"><b>Valorar respuesta:</b>${[['correct','Correcta'],['partial','Parcial'],['incorrect','Revisar']].map(([value,label])=>`<button type="button" data-live-teacher="grade" data-id="${escape(session.id)}" data-index="${n}" data-grade="${value}" class="${result===value?'active':''}">${label}</button>`).join('')}</div>`:'';
    return `<article class="live-question" data-live-type="${escape(kind)}"><div class="live-kind"><span>${String(n+1).padStart(2,'0')}</span>${escape(labels[kind]||'Ejercicio')}</div>${(kind==='flashcard'&&!teacher)||kind==='hangman'?'':`<h3>${rich(kind==='error'?'Encuentra el error y corrígelo en la frase.':q.prompt)}</h3>`}${kind==='reading'&&q.text?`<div class="live-reading">${rich(q.text)}</div>`:''}${kind==='visualquiz'?image(session,q,teacher):''}<div class="live-controls">${controls}</div>${!teacher&&q.hints?.length?`${kind==='pasapalabra'?'':'<button type="button" class="live-hint-button" data-live-action="hint">Necesito una pista</button>'}<div class="live-hint-box" id="liveHintBox"></div>`:''}${feedback}${!locked&&!partial&&!choice.has(kind)&&kind!=='flashcard'&&kind!=='hangman'&&kind!=='sentence'&&kind!=='timeline'&&kind!=='error'&&!['mystery','intruder','bingo'].includes(kind)?'<button type="button" data-live-action="check" class="live-check">Comprobar respuesta</button>':''}${teacher?`<p class="live-observed-answer"><b>Respuesta del alumno:</b> ${escape(summaryValue(response,q))}</p>`:''}${session.status==='completed'&&q.solution?`<div class="live-solution"><b>Solución:</b> ${rich(q.solutions?.join(' · ')||q.solution)}</div>`:''}${review}</article>`;
  }
  function mountSentence(session, root, teacher=false){
    root.querySelectorAll('[data-mini-kind]').forEach(board=>{
      const index=Number(board.id.split('-').at(-1)),q=session.questions[index],locked=teacher||session.status==='completed';
      window.profesorMiniGame(board,{
        kind:q.type,options:q.options,cards:q.cards,clues:q.clues,value:val(session,index),result:grade(session,index),
        parts:session.progress?.parts?.[String(index)],explanation:q.explanation,seed:session.id+':'+index,locked,
        focus:session.progress?.focus?.question_index===index?session.progress.focus.part:0,
        onChange(value){
          if(locked)return;
          const previous=val(active,index);
          delete active.progress.grades?.[String(index)];
          if(q.type==='bingo'){
            const parts=active.progress.parts?.[String(index)]||{};
            Object.keys(parts).forEach(key=>{if(value[key]!==previous?.[key])delete parts[key];});
          }
          board.closest('.live-question')?.querySelector('.live-feedback')?.remove();
          draft(index,value);
        },
        async onCheck(value,part){
          if(locked)return;
          await flush();
          const response=await send('check',index,value,part);
          return {result:response.feedback,parts:active.progress.parts?.[String(index)],explanation:response.extra?.explanation||''};
        },
        onFocus(part){if(!locked){flush().then(()=>send('focus',index,null,part)).catch(error=>{const status=board.querySelector('[role="status"]');if(status)status.textContent=error.message;});}}
      });
    });
    root.querySelectorAll('[data-shared-puzzle]').forEach(board=>{
      const index=Number(board.id.split('-').at(-1)),q=session.questions[index],locked=teacher||session.status==='completed';
      const config={
        locked,seed:session.id+':'+index,result:grade(session,index),partResults:session.progress?.parts?.[String(index)],values:Array.isArray(val(session,index))?val(session,index):[],
        onChange(value){if(locked)return;delete active.progress.grades?.[String(index)];delete active.progress.parts?.[String(index)];board.closest('.live-question')?.querySelector('.live-feedback')?.remove();draft(index,value);},
        async onCheck(value){if(locked)return;try{await flush();await send('check',index,value);renderActive();}catch(error){alert(error.message)}}
      };
      if(q.type==='error')window.profesorErrorBoard(board,{...config,text:errorExample(q.prompt),value:val(session,index)});
      if(q.type==='crossword')window.profesorCrosswordBoard(board,{...config,grid:q.grid||[],entries:q.entries||[]});
      if(q.type==='dragdrop')window.profesorMatchingBoard(board,{...config,items:q.items||[],targets:q.targets||[],single:(q.items||[]).length===(q.targets||[]).length});
    });
    root.querySelectorAll('.live-question:is([data-live-type="sentence"],[data-live-type="timeline"])').forEach(article=>{
      const board=article.querySelector('.sentence-game'),index=Number(board.id.split('-').at(-1));
      const q=session.questions[index];
      window.profesorSentenceBoard(board,{
        kind:q.type,label:q.type==='timeline'?(value,revealed)=>timelineLabel(value,revealed):null,partResults:session.progress?.parts?.[String(index)],
        options:q.options||[],values:Array.isArray(val(session,index))?val(session,index):[],
        locked:teacher||session.status==='completed',reviewed:!!grade(session,index),result:grade(session,index),
        onChange(values){setValue(index,values);delete active.progress.grades?.[String(index)];if(q.type==='timeline')delete active.progress.parts?.[String(index)];send('draft',index,values).catch(error=>alert(error.message));},
        async onCheck(values){await saving.catch(()=>{});try{await send('check',index,values);renderActive();}catch(error){alert(error.message)}}
      });
    });
  }
  function statusText(session, teacher){return session.status==='pending'?(teacher?'Esperando a que el alumno abra el material':'Nuevo material disponible'):session.status==='completed'?'Actividad terminada':session.status==='cancelled'?'Material retirado':teacher?'El alumno está trabajando':'Estás trabajando';}
  function sessionMarkup(session, teacher=false){
    const selected=teacher?teacherReviewIndex:reviewIndex;
    const current=Math.max(0,Math.min(session.questions.length-1,session.status==='completed'&&selected!==null?selected:Number(session.progress?.current_index)||0));
    const answered=Object.values(session.progress?.responses||{}).filter(value=>value!==null&&value!==''&&(!Array.isArray(value)||value.length)).length;
    const seen=session.progress?.last_seen?Date.parse(session.progress.last_seen):0;
    const presence=session.status==='in_progress'?(Date.now()-seen<30000?'● Conectado':'○ Sin conexión reciente'):'';
    const progressBar=`<div class="live-progress"><span style="width:${Math.round((session.status==='completed'?session.questions.length:Math.max(answered,current))/session.questions.length*100)}%"></span></div>`;
    const header=teacher?`<div class="live-player-head"><span class="live-eyebrow">SEGUIMIENTO EN DIRECTO</span><h2>${escape(session.title)}</h2><p>${escape(session.subject)} · ${session.questions.length} ${session.questions.length===1?'ejercicio':'ejercicios'}</p><div class="live-status"><span>${escape(statusText(session,true))}</span>${presence?`<small>${presence}</small>`:''}</div>${progressBar}</div>`:`<div class="live-player-head live-student-head"><span class="live-head-number">${String(current+1).padStart(2,'0')}</span><div class="live-head-title"><small>${escape(session.title)}</small><h2>${escape(session.status==='pending'?session.title:labels[session.questions[current]?.type]||'Ejercicio')}</h2></div><span class="live-subject">✦ ${escape(session.subject)}</span></div>${progressBar}`;
    if(session.status==='pending')return `<div class="live-player">${header}${teacher?'<p class="live-wait">Aparecerá aquí en cuanto el alumno lo abra.</p>':'<div class="live-start"><p>Tu profesor ha preparado este material para ti. Puedes continuar si cambias de dispositivo o recargas la página.</p><button type="button" data-live-action="start" class="live-primary">Empezar</button></div>'}</div>`;
    const review=session.status==='completed'?`<div class="live-result"><b>Material terminado</b><p>${Object.values(session.progress?.grades||{}).filter(value=>value==='correct').length} de ${session.questions.length} correctas · ${Object.values(session.progress?.grades||{}).filter(value=>value==='pending').length} pendientes de revisión</p><div class="live-review-list">${session.questions.map((q,i)=>`<button type="button" data-live-${teacher?'teacher':'action'}="review" data-index="${i}" class="${i===current?'active':''}">${i+1}. ${escape(labels[q.type]||'Ejercicio')} <small>${escape(session.progress?.grades?.[String(i)]||'Sin responder')}</small></button>`).join('')}</div></div>`:'';
    const navigation=teacher||session.status==='completed'?'':`<div class="live-navigation"><button type="button" data-live-action="previous" ${current===0?'disabled':''}>← Anterior</button>${current===session.questions.length-1?'<button type="button" data-live-action="finish" class="live-primary">Terminar material</button>':'<button type="button" data-live-action="next" class="live-primary">Siguiente →</button>'}</div>`;
    return `<div class="live-player">${header}<div class="live-step"><span>Ejercicio ${current+1} de ${session.questions.length}</span>${teacher?'':`<span>${escape(statusText(session,false))} · progreso guardado</span>`}</div>${questionMarkup(session,current,teacher)}${review}${navigation}</div>`;
  }

  // Teacher flow: the current personal play mode remains unchanged.
  if(!studentRoot){
    let closeMaterialPicker=null;
    function sessionMaterialIssue(material){
      const questions=material.activity?.questions;
      if(!Array.isArray(questions)||!questions.length||questions.length>80)return 'Las sesiones admiten entre 1 y 80 preguntas. Divide este material antes de compartirlo.';
      if(questions.some(question=>!question||!Object.hasOwn(activityLabels,question.type)))return 'Este material contiene un tipo de ejercicio que necesita revisión.';
      if(questions.some(question=>question.image?.local))return 'Guarda primero las imágenes locales en tu cuenta.';
      if(JSON.stringify(questions).length>110000)return 'Este material es muy extenso para una sesión en directo. Divídelo en materiales más pequeños.';
      return '';
    }
    function pickSessionMaterial(){
      const materials=state.library.filter(item=>Array.isArray(item.activity?.questions)&&item.activity.questions.length);
      if(!materials.length){notify('Primero crea un material interactivo.');return}
      const courseOf=m=>m.activity?.context?.course||student(m.studentId)?.course||m.course||'';
      const choices=(values,label)=>`<option value="">${label}</option>${[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).map(value=>`<option value="${escape(value)}">${escape(value)}</option>`).join('')}`;
      const types=[...new Set(materials.flatMap(m=>m.activity.questions.map(q=>q.type)).filter(Boolean))];
      const dialog=$('dialog');
      modal('Elige un material para la sesión',`<p class="session-material-intro">Elige una tarjeta para continuar y crear un código válido durante 24 horas. Solo aparecen tus materiales interactivos.</p><div class="session-material-filters"><div><label for="sessionMaterialSearch">Buscar material</label><input id="sessionMaterialSearch" type="search" placeholder="Título o contenido del material" autocomplete="off"></div><div><label for="sessionMaterialSubject">Asignatura</label><select id="sessionMaterialSubject">${choices(materials.map(m=>m.subject),'Todas las asignaturas')}</select></div><div><label for="sessionMaterialCourse">Curso</label><select id="sessionMaterialCourse">${choices(materials.map(courseOf),'Todos los cursos')}</select></div><div><label for="sessionMaterialType">Tipo de ejercicio</label><select id="sessionMaterialType"><option value="">Todos los tipos</option>${types.sort((a,b)=>(activityLabels[a]||a).localeCompare(activityLabels[b]||b,'es')).map(type=>`<option value="${escape(type)}">${escape(activityLabels[type]||type)}</option>`).join('')}</select></div></div><div class="session-material-summary" id="sessionMaterialCount" role="status" aria-live="polite"></div><div id="sessionMaterialCards" class="material-hub-grid session-material-grid"></div><div class="session-material-footer"><button type="button" data-action="close">Cancelar</button><div class="session-material-pages"><button type="button" id="sessionMaterialPrevious" aria-label="Página anterior de materiales">‹ Anterior</button><span id="sessionMaterialPage"></span><button type="button" id="sessionMaterialNext" aria-label="Página siguiente de materiales">Siguiente ›</button></div></div>`,()=>false);
      dialog.classList.add('session-material-picker');
      let page=0;
      const root=$('sessionMaterialCards'),form=$('form'),search=$('sessionMaterialSearch'),subject=$('sessionMaterialSubject'),course=$('sessionMaterialCourse'),type=$('sessionMaterialType'),previous=$('sessionMaterialPrevious'),next=$('sessionMaterialNext');
      function paint(){
        const query=search.value.trim().toLocaleLowerCase('es');
        const filtered=materials.filter(m=>(!subject.value||m.subject===subject.value)&&(!course.value||courseOf(m)===course.value)&&(!type.value||m.activity.questions.some(q=>q.type===type.value))&&(!query||[m.title,m.subject,courseOf(m),m.body,...m.activity.questions.map(q=>q.prompt)].join(' ').toLocaleLowerCase('es').includes(query)));
        const pages=Math.max(1,Math.ceil(filtered.length/12));page=Math.min(page,pages-1);
        root.innerHTML=filtered.slice(page*12,page*12+12).map(m=>materialHubCard(m,false,false,true)).join('')||'<div class="session-material-empty"><strong>No hay materiales con esos filtros</strong><p>Prueba otra búsqueda o cambia la asignatura, el curso o el tipo de ejercicio.</p></div>';
        $('sessionMaterialCount').textContent=`${filtered.length} ${filtered.length===1?'material disponible':'materiales disponibles'}`;
        $('sessionMaterialPage').textContent=`${page+1} / ${pages}`;
        previous.disabled=page===0;next.disabled=page===pages-1;
        root.scrollTop=0;paintMaterialCards(root);
        root.querySelectorAll('[data-live-teacher="choose-material"]').forEach(button=>{const material=materials.find(item=>String(item.id)===button.dataset.id),reason=material?sessionMaterialIssue(material):'Material no disponible';if(reason){button.disabled=true;button.title=reason;const note=document.createElement('p');note.className='generator-help';note.textContent=reason;button.closest('.material-hub-card')?.append(note)}});
      }
      const filter=()=>{page=0;paint()};
      const back=()=>{if(page>0){page--;paint()}};
      const forward=()=>{page++;paint()};
      const preventSubmit=event=>{event.preventDefault();event.stopImmediatePropagation()};
      form.addEventListener('submit',preventSubmit,true);
      search.addEventListener('input',filter);[subject,course,type].forEach(field=>field.addEventListener('change',filter));
      previous.addEventListener('click',back);next.addEventListener('click',forward);
      const cleanup=()=>{dialog.classList.remove('session-material-picker');dialog.removeEventListener('close',cleanup);form.removeEventListener('submit',preventSubmit,true);search.removeEventListener('input',filter);[subject,course,type].forEach(field=>field.removeEventListener('change',filter));previous.removeEventListener('click',back);next.removeEventListener('click',forward);closeMaterialPicker=null};
      closeMaterialPicker=cleanup;dialog.addEventListener('close',cleanup,{once:true});
      paint();if(matchMedia('(pointer:fine)').matches)search.focus();
    }
    async function sendMaterial(material){
      if(!isPremium()){openPremiumInfo('Las sesiones de juegos con código se activan con Premium.');return;}
      if(typeof demo!=='undefined'&&demo)throw Error('Inicia sesión con una cuenta Premium para mandar materiales.');
      const issue=sessionMaterialIssue(material);if(issue)throw Error(issue);
      await saveQueue;
      if(saveFailed)throw Error('Guarda el material antes de enviarlo.');
       modal('Crear sesión · '+material.title,`<p>Generaremos un código único, válido durante 24 horas. Compártelo junto con <b>educame.tech/profesor/alumno</b>. El participante no necesita cuenta ni nombre.</p>${submit('Crear sesión y código')}`,async()=>{
         const result=await api('/api/profesor/material-sessions',{material_id:material.id});
        if(typeof refreshAccesses==='function'&&view==='Accesos')setTimeout(()=>refreshAccesses(),0);
        setTimeout(()=>watchSession(result.session.id),0);
      });
    }
    async function listSessions(){
      const data=await api('/api/profesor/material-sessions');
       modal('Sesiones de juegos',data.sessions.length?`<div class="live-sent-list">${data.sessions.map(item=>`<button type="button" data-live-teacher="watch" data-id="${escape(item.id)}"><strong>${escape(item.title)}</strong><span>${escape(item.subject)}</span><small>${item.status==='pending'?'Nueva':item.status==='in_progress'?'En curso':item.status==='completed'?'Terminada':item.status==='expired'?'Caducada':'Cerrada'} · ${new Date(item.created_at).toLocaleDateString('es-ES')}</small></button>`).join('')}</div>`:'<p>Todavía no has creado sesiones.</p>',()=>false);
    }
    async function watchSession(id){
      const result=await api('/api/profesor/material-sessions/'+encodeURIComponent(id));
      teacherReviewIndex=null;watchedSession=result.session;
       modal('Seguir material',`${result.session.join_code?`<div class="live-join-code"><span><b>Código de la sesión</b><small>Se introduce en educame.tech/profesor/alumno</small></span><strong>${escape(result.session.join_code)}</strong><button type="button" data-live-teacher="copy-code" data-code="${escape(result.session.join_code)}">Copiar código</button></div>`:''}<div id="liveWatch">${sessionMarkup(result.session,true)}</div><div class="live-teacher-actions"><button type="button" data-live-teacher="refresh" data-id="${escape(id)}">Actualizar</button>${result.session.status==='pending'||result.session.status==='in_progress'?`<button type="button" data-live-teacher="cancel" data-id="${escape(id)}">Cerrar sesión</button>`:''}<button type="button" data-live-teacher="delete" data-id="${escape(id)}">Borrar sesión y respuestas</button></div>`,()=>false);
      mountSentence(result.session,$('liveWatch'),true);
      const dialog=$('dialog');dialog.classList.add('live-watch-dialog');const joinCode=dialog.querySelector('.live-join-code');if(joinCode)dialog.querySelector(':scope > .row').insertBefore(joinCode,dialog.querySelector(':scope > .row .close'));let revision=result.session.revision;
      let connected=result.session.status==='in_progress'&&Boolean(result.session.progress?.last_seen)&&Date.now()-Date.parse(result.session.progress.last_seen)<30000;
      clearInterval(watcher);
      let failures=0,stopped=false,pollBusy=false;
      const connection=document.createElement('p');connection.className='live-error';connection.setAttribute('role','status');connection.hidden=true;dialog.querySelector('.live-teacher-actions').before(connection);
      async function poll(){
        if(stopped||!dialog.open||!$('liveWatch')||pollBusy)return;
        if(document.hidden){watcher=setTimeout(poll,10000);return}
        pollBusy=true;
        try{
          const data=await api('/api/profesor/material-sessions/'+encodeURIComponent(id)+'?since_revision='+revision);
          const next=data.session||{...watchedSession,status:data.status,progress:{...watchedSession.progress,last_seen:data.last_seen}};
          const nextConnected=next.status==='in_progress'&&Boolean(next.progress?.last_seen)&&Date.now()-Date.parse(next.progress.last_seen)<30000;
          failures=0;connection.hidden=true;
          if(next.revision!==revision||nextConnected!==connected){
            revision=next.revision;connected=nextConnected;watchedSession=next;$('liveWatch').innerHTML=sessionMarkup(next,true);mountSentence(next,$('liveWatch'),true);
            if(!next.join_code)dialog.querySelector('.live-join-code')?.remove();
            const actions=dialog.querySelector('.live-teacher-actions');if(actions)actions.querySelector('[data-live-teacher="cancel"]')?.remove();
            if(next.status==='pending'||next.status==='in_progress')actions?.insertAdjacentHTML('beforeend',`<button type="button" data-live-teacher="cancel" data-id="${escape(id)}">Retirar material</button>`);
          }
        }catch(error){failures++;connection.hidden=false;connection.textContent='Conexión interrumpida. Reconectando automáticamente… '+error.message}
        finally{pollBusy=false;if(!stopped)watcher=setTimeout(poll,failures?Math.min(30000,2500*2**Math.min(failures,4)):2500)}
      }
      const resume=()=>{if(!document.hidden&&!stopped){clearTimeout(watcher);poll()}};
      document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);watcher=setTimeout(poll,2500);
      dialog.addEventListener('close',()=>{stopped=true;clearTimeout(watcher);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);dialog.classList.remove('live-watch-dialog');joinCode?.remove()},{once:true});
    }
    document.addEventListener('click',async event=>{
      const button=event.target.closest('[data-action="sendLiveMaterial"],[data-action="liveSessionList"],[data-live-teacher]');if(!button)return;
      event.preventDefault();button.closest('details')?.removeAttribute('open');
      if(!isPremium()){openPremiumInfo('Las sesiones de juegos con código se activan con Premium.');return;}
      try{
        if(button.dataset.action==='sendLiveMaterial'){const material=state.library.find(item=>item.id===button.dataset.id);if(material)await sendMaterial(material)}
        if(button.dataset.liveTeacher==='create-anonymous'){
          pickSessionMaterial();
        }
        if(button.dataset.liveTeacher==='choose-material'&&$('dialog').classList.contains('session-material-picker')){
          const material=state.library.find(item=>item.id===button.dataset.id&&item.activity?.questions?.length);
          if(!material){notify('El material ya no está disponible. Vuelve a abrir el selector.');return}
          closeMaterialPicker?.();$('dialog').close();await sendMaterial(material);
        }
        if(button.dataset.action==='liveSessionList')await listSessions();
        if(button.dataset.liveTeacher==='watch'){$('dialog').close();setTimeout(()=>watchSession(button.dataset.id).catch(error=>notify(error.message)),0)}
        if(button.dataset.liveTeacher==='refresh'){const data=await api('/api/profesor/material-sessions/'+button.dataset.id);watchedSession=data.session;$('liveWatch').innerHTML=sessionMarkup(data.session,true);mountSentence(data.session,$('liveWatch'),true)}
        if(button.dataset.liveTeacher==='copy-code')await navigator.clipboard.writeText(button.dataset.code).then(()=>notify('Código copiado.'));
        if(button.dataset.liveTeacher==='review'&&watchedSession){teacherReviewIndex=Number(button.dataset.index);$('liveWatch').innerHTML=sessionMarkup(watchedSession,true);mountSentence(watchedSession,$('liveWatch'),true)}
        if(button.dataset.liveTeacher==='grade'&&watchedSession){const data=await api('/api/profesor/material-sessions/'+button.dataset.id+'/review',{question_index:Number(button.dataset.index),grade:button.dataset.grade});watchedSession=data.session;$('liveWatch').innerHTML=sessionMarkup(watchedSession,true);mountSentence(watchedSession,$('liveWatch'),true)}
        if(button.dataset.liveTeacher==='cancel'){if(!confirm('¿Retirar este material del espacio del alumno?'))return;await api('/api/profesor/material-sessions/'+button.dataset.id+'/cancel',{});$('dialog').close();if(typeof refreshAccesses==='function'&&view==='Accesos')await refreshAccesses();notify('Material retirado.')}
        if(button.dataset.liveTeacher==='delete'){if(!confirm('¿Borrar definitivamente esta sesión y todas sus respuestas?'))return;await api('/api/profesor/material-sessions/'+button.dataset.id+'/delete',{});$('dialog').close();if(typeof refreshAccesses==='function'&&view==='Accesos')await refreshAccesses();notify('Sesión y respuestas borradas.')}
      }catch(error){notify(error.message)}
    });
    return;
  }

  async function request(path,body){const response=await fetch(path,{credentials:'same-origin',cache:'no-store',method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});let data={};try{data=await response.json()}catch{}if(response.status===401||response.status===403){window.profesorStudentReady=false;window.profesorRequireJoin?.();throw Error('Introduce el código de tu sesión para continuar.')}if(!response.ok)throw Error(data.detail||'No se pudo guardar tu respuesta.');return data;}
  const path=id=>'/api/profesor/student-material-sessions/'+encodeURIComponent(id);
  function enqueue(move){const run=()=>request(path(active.id)+'/move',move);saving=saving.catch(()=>{}).then(run);return saving;}
  function renderList(sessions){
    const panel=document.getElementById('studentMaterialList');if(!panel)return;
    const running=sessions.some(item=>item.status==='in_progress');
    panel.innerHTML=sessions.length?`<div class="live-inbox">${sessions.map((item,i)=>`<button type="button" data-live-open="${escape(item.id)}" class="${item.status==='pending'?'new':''} ${active?.id===item.id?'current':''}" ${running&&item.status==='pending'?'disabled':''}><span class="live-inbox-icon">${item.status==='completed'?'✓':String(i+1).padStart(2,'0')}</span><span class="live-inbox-copy"><strong>${escape(item.title)}</strong><small>${item.count} ${item.count===1?'ejercicio':'ejercicios'} · ${escape(item.subject)}</small>${item.status==='pending'?'<em>Nuevo material disponible</em>':item.status==='in_progress'?'<em>En curso</em>':''}</span><span class="live-inbox-arrow" aria-hidden="true">›</span></button>`).join('')}</div>`:'<p class="student-inbox-empty">Cuando tu profesor te mande un material, aparecerá aquí.</p>';
  }
  async function loadList(){try{const data=await request('/api/profesor/student-material-sessions');const fingerprint=JSON.stringify(data.sessions);if(fingerprint!==lastList){lastList=fingerprint;renderList(data.sessions)}if(active?.status==='in_progress'&&!data.sessions.some(item=>item.id===active.id)){active=null;studentRoot.hidden=true;studentRoot.innerHTML='';document.getElementById('studentWelcome')?.removeAttribute('hidden');document.getElementById('studentMaterialList').insertAdjacentHTML('afterbegin','<p class="live-error">El profesor ha retirado el material que tenías abierto.</p>')}if(!active){const running=data.sessions.find(item=>item.status==='in_progress');if(running)await openSession(running.id)}}catch(error){document.getElementById('studentMaterialList').innerHTML=`<p class="live-error">${escape(error.message)}</p>`}}
  async function openSession(id){wordsearchHint=null;wordsearchMessage='';flashFront.clear();clearTimeout(draftTimer);await saving.catch(()=>{});active=(await request(path(id))).session;activeWord=0;activeLetter=0;firstCard=null;pickedCell=null;reviewIndex=null;const focus=active.progress?.focus;if(focus?.question_index===active.progress?.current_index){const type=active.questions[active.progress.current_index]?.type;if(type==='pasapalabra')activeLetter=focus.part||0;if(type==='wordsearch')activeWord=focus.part||0;if(type==='memory')firstCard=focus.token||null}document.getElementById('studentWelcome')?.setAttribute('hidden','');studentRoot.hidden=false;studentRoot.innerHTML=sessionMarkup(active);mountSentence(active,studentRoot);studentRoot.scrollIntoView({behavior:'smooth',block:'start'});}
  function renderActive(keepFocus=false){if(!active)return;const focused=keepFocus?document.activeElement?.dataset.liveField:null,part=keepFocus?document.activeElement?.dataset.part:null,selection=keepFocus?document.activeElement?.selectionStart:null;studentRoot.innerHTML=sessionMarkup(active);mountSentence(active,studentRoot);if(focused){const field=[...studentRoot.querySelectorAll('[data-live-field]')].find(input=>input.dataset.liveField===focused&&(part==null||input.dataset.part===part));if(field){field.focus({preventScroll:true});if(Number.isInteger(selection)&&field.setSelectionRange)field.setSelectionRange(selection,selection)}}}
  function current(){return Math.max(0,Math.min(active.questions.length-1,Number(active.progress?.current_index)||0))}
  function setValue(index,value){active.progress.responses??={};active.progress.responses[String(index)]=value;}
  function valueFor(index){const q=active.questions[index],value=val(active,index);if(q.type==='order'||q.type==='sentence'||q.type==='timeline')return Array.isArray(value)?value:q.options||[];return value;}
  async function send(action,index,value,part=null,currentIndex=null){const result=await enqueue({action,question_index:index,value,part,current_index:currentIndex});if(result.session)active=result.session;else{active.revision=result.revision;active.status=result.status;if(result.feedback!=null&&action!=='reveal'){if(part==null){active.progress.grades??={};active.progress.grades[String(index)]=result.feedback}else{active.progress.parts??={};active.progress.parts[String(index)]??={};active.progress.parts[String(index)][String(part)]=result.feedback}}if(result.extra&&active.questions[index].type==='hangman')Object.assign(active.questions[index],result.extra)}return result}
  function draft(index,value){setValue(index,value);clearTimeout(draftTimer);draftTimer=setTimeout(()=>send('draft',index,value).catch(error=>{studentRoot.insertAdjacentHTML('afterbegin',`<p class="live-error">${escape(error.message)}</p>`)}),400)}
  async function flush(){if(draftTimer){clearTimeout(draftTimer);draftTimer=null;await send('draft',current(),valueFor(current()))}else await saving.catch(()=>{})}
  async function checkPart(index,part,value){setValue(index,value);await send('check',index,value,part);renderActive();}
  async function selectWordsearchCell(r,c){
    const index=current(),q=active.questions[index];
    if(!pickedCell){pickedCell=[r,c];wordsearchMessage='Ahora marca la última letra.';renderActive();focusCell(r,c);return}
    const [sr,sc]=pickedCell;const steps=Math.max(Math.abs(r-sr),Math.abs(c-sc));pickedCell=null;
    if(!steps||!(sr===r||sc===c||Math.abs(r-sr)===Math.abs(c-sc))){wordsearchMessage='Selecciona una línea horizontal, vertical o diagonal.';renderActive();focusCell(r,c);return}
    const cells=Array.from({length:steps+1},(_,i)=>[sr+i*Math.sign(r-sr),sc+i*Math.sign(c-sc)]),text=cells.map(([y,x])=>q.grid[y][x]).join(''),reverse=[...text].reverse().join('');
    const part=q.words.findIndex(word=>wordKey(word)===text||wordKey(word)===reverse);
    if(part<0||partGrade(active,index,part)==='correct'){wordsearchMessage=part>=0?'Esa palabra ya está encontrada. Busca otra.':'La selección no coincide con una palabra pendiente. Prueba de nuevo.';renderActive();focusCell(r,c);return}
    const values=Array.isArray(val(active,index))?[...val(active,index)]:[];values[part]=cells;setValue(index,values);
    const result=await send('check',index,values,part);wordsearchHint=null;wordsearchMessage=result.feedback==='correct'?`✓ ¡Encontraste ${q.words[part]}!`:'Revisa la primera y la última letra.';renderActive();focusCell(r,c);
  }
  function focusCell(r,c){const cells=[...studentRoot.querySelectorAll('[data-live-action="cell"]')];cells.forEach(cell=>cell.tabIndex=Number(cell.dataset.row)===r&&Number(cell.dataset.col)===c?0:-1);cells.find(cell=>cell.tabIndex===0)?.focus({preventScroll:true})}
  let wordDrag=null,suppressWordClick=false;
  studentRoot.addEventListener('pointerdown',event=>{const cell=event.target.closest('[data-live-action="cell"]');if(!cell||cell.disabled||event.button!==0)return;suppressWordClick=false;wordDrag={r:Number(cell.dataset.row),c:Number(cell.dataset.col),x:event.clientX,y:event.clientY,moved:false};});
  studentRoot.addEventListener('pointermove',event=>{if(!wordDrag||event.buttons!==1)return;if(Math.hypot(event.clientX-wordDrag.x,event.clientY-wordDrag.y)>8){wordDrag.moved=true;studentRoot.setPointerCapture(event.pointerId)}});
  studentRoot.addEventListener('pointercancel',()=>wordDrag=null);
  studentRoot.addEventListener('pointerup',event=>{const drag=wordDrag;wordDrag=null;if(!drag?.moved)return;suppressWordClick=true;const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-live-action="cell"]');if(!cell)return;pickedCell=[drag.r,drag.c];selectWordsearchCell(Number(cell.dataset.row),Number(cell.dataset.col)).catch(error=>alert(error.message));});
  studentRoot.addEventListener('keydown',event=>{
    const cell=event.target.closest('[data-live-action="cell"]');
    if(cell&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const size=active.questions[current()].grid.length;focusCell(Math.max(0,Math.min(size-1,Number(cell.dataset.row)+(event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0))),Math.max(0,Math.min(size-1,Number(cell.dataset.col)+(event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0))));}
    if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.repeat&&active?.questions[current()]?.type==='hangman'&&!event.target.matches('input,textarea,select')&&event.key.length===1){const letter=letterKey(event.key);if('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.includes(letter)){event.preventDefault();studentRoot.querySelector(`[data-live-action="guess"][data-value="${letter}"]:not(:disabled)`)?.click()}}
  });
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
    const button=event.target.closest('[data-live-action]');if(!button||!active||button.disabled||memoryBusy||flashBusy)return;
    const action=button.dataset.liveAction,index=current(),q=active.questions[index];
    if(action==='cell'&&suppressWordClick){suppressWordClick=false;return}
    try{
      if(action==='start'){await send('start',0,null);renderActive();return}
      if(action==='review'&&active.status==='completed'){reviewIndex=Number(button.dataset.index);renderActive();return}
      if(action==='previous'||action==='next'){await flush();const next=Math.max(0,Math.min(active.questions.length-1,index+(action==='next'?1:-1)));await send('next',index,null,null,next);active.progress.current_index=next;activeWord=activeLetter=0;firstCard=pickedCell=null;wordsearchHint=null;wordsearchMessage='';renderActive();studentRoot.scrollIntoView({block:'start',behavior:'instant'});return}
      if(action==='finish'){await flush();if(!confirm('¿Terminar el material y ver tu resultado?'))return;await send('finish',index,null);renderActive();await loadList();return}
      if(action==='choice'){const value=button.dataset.value;setValue(index,value);await send('check',index,value);renderActive();return}
      if(action==='flash-flip'||action==='flash-grade'){
        flashBusy=true;
        try {
          if(action==='flash-flip'){
            if(q.revealed_answer==null){const result=await send('reveal',index,null);active.questions[index].revealed_answer=result.feedback;flashFront.delete(index);}
            else if(flashFront.has(index))flashFront.delete(index);else flashFront.add(index);
          } else {await send('check',index,button.dataset.value);setValue(index,button.dataset.value);}
        } finally {flashBusy=false;renderActive();}
        return;
      }
      if(action==='check'){await flush();const value=valueFor(index);if(q.type==='error'&&(!value||typeof value!=='object'||!value.selected?.trim()||!value.correction?.trim())){alert('Selecciona el error y escribe su corrección.');return}await send('check',index,value);renderActive();return}
      if(action==='move'){const value=[...valueFor(index)],from=Number(button.dataset.pos),to=from+Number(button.dataset.dir);[value[from],value[to]]=[value[to],value[from]];setValue(index,value);if(q.type==='timeline'){delete active.progress.grades?.[String(index)];delete active.progress.parts?.[String(index)]}await send('draft',index,value);renderActive();return}
      if(action==='letter'){await flush();activeLetter=Number(button.dataset.index);active.progress.focus={question_index:index,part:activeLetter};renderActive();studentRoot.querySelector('.live-clue input')?.focus();await send('focus',index,null,activeLetter);return}
      if(action==='pass'||action==='letter-previous'){await flush();activeLetter=(activeLetter+(action==='pass'?1:-1)+q.entries.length)%q.entries.length;active.progress.focus={question_index:index,part:activeLetter};renderActive();studentRoot.querySelector('.live-clue input')?.focus();await send('focus',index,null,activeLetter);return}
      if(action==='check-part'){if(q.type==='pasapalabra'&&!String(val(active,index)?.[Number(button.dataset.part)]||'').trim()){studentRoot.querySelector('.live-clue input')?.focus();return}await flush();await checkPart(index,Number(button.dataset.part),val(active,index));if(q.type==='pasapalabra'){const pending=q.entries.findIndex((_,i)=>i>activeLetter&&partGrade(active,index,i)!=='correct');activeLetter=pending>=0?pending:(q.entries.findIndex((_,i)=>partGrade(active,index,i)!=='correct')+q.entries.length)%q.entries.length;active.progress.focus={question_index:index,part:activeLetter};await send('focus',index,null,activeLetter)}renderActive();if(q.type==='pasapalabra')studentRoot.querySelector('.live-clue input')?.focus({preventScroll:true});return}
      if(action==='card'){
        const token=button.dataset.value;
        const previous=Array.isArray(val(active,index))?[...val(active,index)]:[];
        memoryBusy=true;
        try {
          if(!firstCard){firstCard=token;active.progress.focus={question_index:index,token};renderActive();await send('focus',index,token);return}
          if(firstCard===token){firstCard=null;active.progress.focus={question_index:index,token:null};await send('focus',index,null);return}
          const values=Array.isArray(val(active,index))?[...val(active,index)]:[],pair=[firstCard,token];
          memoryOpen=pair;renderActive();
          setValue(index,[...values,pair]);
          const result=await send('check',index,[...values,pair],values.length);
          if(result.feedback!=='correct'){
            // Keep both faces visible before hiding a mismatch; block extra flips meanwhile.
            await new Promise(resolve=>setTimeout(resolve,950));
            setValue(index,values);await send('draft',index,values);
          }
          firstCard=null;active.progress.focus={question_index:index,token:null};await send('focus',index,null);
        } catch(error) { setValue(index,previous);firstCard=null;active.progress.focus={question_index:index,token:null};throw error; }
        finally { memoryBusy=false;memoryOpen=[];renderActive();const cards=[...studentRoot.querySelectorAll('[data-live-action="card"]')];(cards.find(card=>card.dataset.value===token&&!card.disabled)||cards.find(card=>!card.disabled))?.focus({preventScroll:true}); }
        return;
      }
      if(action==='word'){activeWord=Number(button.dataset.index);pickedCell=null;active.progress.focus={question_index:index,part:activeWord};renderActive();await send('focus',index,null,activeWord);return}
      if(action==='wordsearch-clear'){pickedCell=null;wordsearchMessage='Selecciona otra palabra.';renderActive();return}
      if(action==='wordsearch-hint'){
        const part=(q.words||[]).findIndex((_,i)=>partGrade(active,index,i)!=='correct');if(part<0)return;
        activeWord=part;const cells=findWordPath(q.grid,q.words[part]);wordsearchHint=cells?.[0]||null;wordsearchMessage=cells?`Pista: ${q.words[part]} empieza en la fila ${cells[0][0]+1}, columna ${cells[0][1]+1}.`:'Busca la primera letra de la palabra.';renderActive();return;
      }
      if(action==='cell'){await selectWordsearchCell(Number(button.dataset.row),Number(button.dataset.col));return}

      if(action==='guess'){const values=Array.isArray(val(active,index))?[...val(active,index)]:[];values.push(button.dataset.value);setValue(index,values);await send('check',index,values);renderActive();studentRoot.querySelector('[data-live-action="guess"]:not(:disabled)')?.focus({preventScroll:true});return}
      if(action==='point'){if(q.type!=='imagepoint'||active.status!=='in_progress')return;const img=button.querySelector('img');if(!img)return;const rect=img.getBoundingClientRect(),value=[Math.round(100*(event.clientX-rect.left)/rect.width),Math.round(100*(event.clientY-rect.top)/rect.height)];setValue(index,value);await send('check',index,value);renderActive();return}
      if(action==='reveal'){const result=await send('reveal',index,null);q.revealed_answer=result.feedback;renderActive();return}
      if(action==='hint'){const box=studentRoot.querySelector('#liveHintBox'),visible=box.childElementCount;box.insertAdjacentHTML('beforeend',`<p>💡 ${rich(q.hints[Math.min(visible,q.hints.length-1)])}</p>`);if(visible+1>=q.hints.length)button.hidden=true;return}
      if(action==='error-word'){const words=errorExample(q.prompt).split(/\s+/).filter(Boolean),current=typeof val(active,index)==='object'&&val(active,index)||{},selected=new Set(String(current.selected||'').split(' ').filter(Boolean)),word=words[Number(button.dataset.index)];if(selected.has(word))selected.delete(word);else selected.add(word);const value={...current,selected:words.filter(item=>selected.has(item)).join(' ')};setValue(index,value);delete active.progress.grades?.[String(index)];draft(index,value);renderActive();return}
    }catch(error){alert(error.message)}
  });
  document.getElementById('studentMaterialList').addEventListener('click',event=>{const button=event.target.closest('[data-live-open]');if(button)openSession(button.dataset.liveOpen).catch(error=>alert(error.message))});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadList()});
  setInterval(()=>{if(!document.hidden&&window.profesorStudentReady){if(active?.status==='in_progress')send('heartbeat',current(),null).catch(()=>{});if(active?.status==='completed')request(path(active.id)).then(data=>{if(data.session.revision!==active.revision){active=data.session;renderActive()}}).catch(()=>{});loadList()}},5000);
  document.addEventListener('profesor-student-ready',()=>{active=null;lastList='';studentRoot.hidden=true;studentRoot.innerHTML='';loadList()});
  if(window.profesorStudentReady)loadList();
})();
