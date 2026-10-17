/* Interactive material player. The saved activity format remains version 1. */
(function () {
  const shuffle = values => values.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(item => item.value);
  const normalize = value => String(value || '').trim().toLocaleLowerCase('es').replace(/\s+/g, ' ');
  const shortKey = value => normalize(value).replace(/[.!?¡¿]+$/g, '').trim();
  const objectiveShort = q => q.type === 'short' && /^\S+(?:\s+\S+){0,2}$/.test(String(q.answer || '').trim()) && !/[;:]/.test(q.answer);
  const escape = value => esc(String(value ?? ''));
  const accepts = (value, solution, alternatives = []) => [solution, ...alternatives].some(item => normalize(value) === normalize(item));
  const letterKey = value => String(value || '').toUpperCase().replaceAll('Ñ', '\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('\u0001', 'Ñ');
  const numberValue = value => {
    const text = String(value).trim().replace(',', '.');
    if (text.split('/').length > 2 || text.split('/').some(part => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(part.trim()))) return NaN;
    const [a, b] = text.split('/').map(Number);
    return b === undefined ? a : b === 0 ? NaN : a / b;
  };
  let playerAbort = null;
  const rich = value => window.profesorText ? profesorText.rich(value) : escape(value);
  const itemReasons = q => {
    const rows=q.optionFeedback?.map(row=>[row.option,row.explanation])||q.itemExplanations?.map((value,n)=>[q.type==='multigaps'?'Hueco '+(n+1):q.options[n]?.split('|')[0]||String(n+1),value])||[];
    return rows.length?'<details class="play-item-reasons"><summary>Explicación de cada respuesta</summary><ol>'+rows.map(([label,value])=>'<li><b>'+escape(label)+':</b> '+rich(value)+'</li>').join('')+'</ol></details>':'';
  };
  const errorExample = prompt => {
    const quoted = [...String(prompt).matchAll(/[«“"]([^«»“”"]+)[»”"]/g)];
    return quoted.length ? quoted.at(-1)[1] : String(prompt).split(/:\s*/).at(-1).trim();
  };
  const errorValue = value => normalize(String(value).replace(/^[.,;:!?«»“”"]+|[.,;:!?«»“”"]+$/g,''));
  const timelineLabel = (value, reveal) => reveal ? value : String(value)
    .replace(/\b(?:1\d{3}|20\d{2})-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/.]\d{1,2}[/.](?:1\d{3}|20\d{2})\b|\b\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(?:1\d{3}|20\d{2})\b|\b(?:1\d{3}|20\d{2})\b/gi, 'fecha oculta')
    .replace(/\bfecha oculta\s*[–—:-]\s*/gi, '').trim() || 'Fecha oculta';
  window.profesorTimelineLabel = timelineLabel;
  const expectedSequence = q => {
    if(q.type==='sentence'){
      const options=q.options, starts=options.filter(value=>/^[«“"(¿¡]*[A-ZÁÉÍÓÚÑÜ]/.test(value.trim()));
      const ends=options.filter(value=>/[.!?][»”"’')]*$/.test(value.trim()));
      if(starts.length===1)return [starts[0],...options.filter(value=>value!==starts[0])];
      if(ends.length===1)return [...options.filter(value=>value!==ends[0]),ends[0]];
      return options;
    }
    if(q.type!=='timeline')return q.options;
    const dated=q.options.map(value=>({value,year:Number(String(value).match(/\b(?:1\d{3}|20\d{2})\b/)?.[0])}));
    return dated.every(item=>Number.isFinite(item.year))&&new Set(dated.map(item=>item.year)).size===dated.length?dated.sort((a,b)=>a.year-b.year).map(item=>item.value):q.options;
  };
  const displayGapPrompt = q => {
    let prompt=String(q.prompt||'');
    const solutions=q.type==='multigaps'?q.options||[]:[q.answer];
    solutions.forEach(solution=>{
      const exact=String(solution||'').split('~')[0].trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      if(exact)prompt=prompt.replace(new RegExp('___\\s*\\(\\s*'+exact+'\\s*\\)','i'),'___');
    });
    return prompt.replace(/\*\*/g,'');
  };
  function recordAnswer(index, part, correct, value, assisted = false) {
    $('form').dispatchEvent(new CustomEvent('play:answer', {detail:{index,part,correct,value,assisted}}));
  }
  function markControl(control, correct) {
    control.classList.toggle('answer-right',correct); control.classList.toggle('answer-wrong',!correct);
    control.setAttribute('aria-invalid',String(!correct));
  }
  // Shared accessible placement board: drag, tap, or keyboard, with explicit undo.
  function placementBoard(root, items, targets, isChecked, changed, single = false) {
    const order = shuffle(items.map((_, n) => n)), assignments = items.map(() => null);
    const transferType = 'application/x-profesor-piece-' + uid().toLowerCase();
    let selected = null;
    function draw() {
      root.innerHTML = `<p class="play-hint">Elige una pieza y después su destino, o arrástrala. Pulsa × para devolverla.</p><div class="placement-bank" aria-label="Piezas pendientes">${order.filter(n => assignments[n] === null).map(n => `<button type="button" draggable="true" data-piece="${n}" aria-pressed="${selected === n}" class="${selected === n ? 'selected' : ''}">${escape(items[n])}</button>`).join('') || '<span>✓ Todas las piezas colocadas</span>'}</div><div class="placement-targets">${targets.map((target, n) => `<div class="placement-bucket"><button type="button" class="bucket-title" data-bucket="${n}" aria-label="Colocar en ${escape(target)}">${escape(target)}<small>${single ? 'Una pieza' : 'Coloca las piezas de este grupo'}</small></button><div>${assignments.flatMap((t, k) => t === n ? [`<button type="button" data-return="${k}" aria-label="Devolver ${escape(items[k])}">${escape(items[k])}<b aria-hidden="true">×</b></button>`] : []).join('')}</div></div>`).join('')}</div>`;
      root.querySelectorAll('[data-piece]').forEach(button => {
        button.onclick = () => { if (isChecked()) return; selected = Number(button.dataset.piece); draw(); root.querySelector(`[data-piece="${selected}"]`)?.focus({ preventScroll: true }); };
        button.ondragstart = e => { if (isChecked()) return e.preventDefault(); e.dataTransfer.setData(transferType, button.dataset.piece); };
      });
      root.querySelectorAll('[data-bucket]').forEach(button => {
        const place = source => { if (isChecked() || source === null || !Number.isInteger(source) || source < 0 || source >= items.length) return; const destination = Number(button.dataset.bucket); if (single) assignments.forEach((t, n) => { if (t === destination) assignments[n] = null; }); assignments[source] = destination; selected = null; draw(); changed(assignments.slice()); root.querySelector(`[data-bucket="${destination}"]`)?.focus({preventScroll:true}); };
        button.onclick = () => place(selected);
        const bucket = button.parentElement;
        bucket.ondragover = e => { if (!isChecked()) { e.preventDefault(); bucket.classList.add('drag-over'); } };
        bucket.ondragleave = () => bucket.classList.remove('drag-over');
        bucket.ondrop = e => { e.preventDefault(); const value = e.dataTransfer.getData(transferType); if (value !== '') place(Number(value)); };
      });
      root.querySelectorAll('[data-return]').forEach(button => button.onclick = () => { if (isChecked()) return; assignments[Number(button.dataset.return)] = null; draw(); changed(assignments.slice()); });
    }
    draw();
    return { review(expected) { root.querySelectorAll('[data-return]').forEach(button => { const n = Number(button.dataset.return), right = targets[assignments[n]] === expected[n]; markControl(button,right); button.querySelector('b').textContent = right ? '✓' : '×'; }); } };
  }

  function mountCrossword(question, index, isChecked, report) {
    const root=$('puzzle-'+index),rows=puzzleRows('crossword',question.options),words=rows.map(([word])=>puzzleWord(word)),layout=buildCrossword(words);
    const entries=rows.map(([word,clue],n)=>{const key=puzzleWord(word),vertical=key===layout.anchor,placed=layout.placed.find(p=>p.word===key);return {number:n+1,clue,length:key.length,row:vertical?0:placed.row,col:vertical?layout.left:layout.left-placed.col,direction:vertical?'down':'across'};});
    const helped=new Set();
    const review=values=>Object.fromEntries(values.map((value,n)=>[n,value&&!value.includes('_')?(value===words[n]?'correct':'incorrect'):'unanswered']));
    const update=values=>{
      const complete=values.length===words.length&&values.every(value=>value&&!value.includes('_'));
      $('r-'+index).value=values.join(' | ');
      report(index,{complete,correct:complete&&values.every((value,n)=>value===words[n]),answer:$('r-'+index).value,review:()=>board.review(review(values))});
    };
    const board=window.profesorCrosswordBoard(root,{
      grid:layout.grid.map(row=>row.map(Boolean)),entries,
      onChange(values){root.closest('.play-question').removeAttribute('data-result');$('feedback-'+index).textContent='';update(values);},
      onCheck(values){if(isChecked())return;const results=review(values);board.review(results);values.forEach((value,n)=>{if(value&&!value.includes('_'))recordAnswer(index,n,results[n]==='correct',value,helped.has(n));});update(values);},
      onHint(n,value){if(isChecked())return;const position=[...words[n]].findIndex((letter,i)=>letter!==value?.[i]);if(position<0)return;helped.add(n);recordAnswer(index,'hint-'+n,null,'revealed',true);return {position,letter:words[n][position]};}
    });
    update(board.values());
  }
  function mountMatching(question,index,isChecked,report){
    const rows=puzzleRows('dragdrop',question.options),targets=[...new Set(rows.map(row=>row[1]))],expected=rows.map(row=>row[1]);
    const review=values=>Object.fromEntries(values.map((value,n)=>[n,!value?'unanswered':value===expected[n]?'correct':'incorrect']));
    const update=values=>{
      $('r-'+index).value=values.join(' | ');
      report(index,{complete:values.every(Boolean),correct:values.every((value,n)=>value===expected[n]),answer:$('r-'+index).value,review:()=>board.review(review(values))});
    };
    const board=window.profesorMatchingBoard($('puzzle-'+index),{
      items:rows.map(row=>row[0]),targets,single:targets.length===rows.length,
      onChange(values){$('puzzle-'+index).closest('.play-question').removeAttribute('data-result');$('feedback-'+index).textContent='';update(values);},
      onCheck(values){if(isChecked())return;const grades=review(values);board.review(grades);values.forEach((value,n)=>{if(value)recordAnswer(index,n,grades[n]==='correct',value);});update(values);}
    });
    update(board.values());
  }
  function mountMiniGame(question,index,isChecked,report){
    const api=window.profesorMiniGames,data=api.prepare(question,question.id||String(index));
    const parts={},root=$('mini-'+index);
    const review=value=>({result:api.grade(question,value,null,data),parts:question.type==='bingo'?Object.fromEntries(data.clues.map((_,n)=>[n,api.grade(question,value,n,data)])):undefined,explanation:question.explanation||''});
    const answerText=value=>question.type==='mystery'?value.answer:question.type==='intruder'?value:data.clues.map((clue,n)=>clue.clue+': '+(data.cards.find(card=>card.token===value[n])?.label||'—')).join('\n');
    const update=value=>{
      const grade=api.grade(question,value,null,data);
      $('r-'+index).value=answerText(value);
      report(index,{complete:grade!=='unanswered',correct:grade==='correct',answer:$('r-'+index).value,review:()=>board.review(review(value))});
    };
    const board=window.profesorMiniGame(root,{
      kind:question.type,options:data.options,cards:data.cards,clues:data.clues?.map(({token,clue})=>({token,clue})),seed:question.id||String(index),
      onChange(value){if(isChecked())return;root.closest('.play-question').removeAttribute('data-result');$('feedback-'+index).textContent='';update(value);},
      onCheck(value,part){
        if(isChecked())return;
        const grade=api.grade(question,value,part,data);
        if(part!=null)parts[part]=grade;
        recordAnswer(index,part??0,grade==='correct',part==null?answerText(value):(data.cards.find(card=>card.token===value[part])?.label||''),question.type==='mystery'&&value.cluesUsed>1);
        update(value);
        return {result:grade,parts:part!=null?parts:undefined,explanation:grade==='correct'?question.explanation||'':''};
      }
    });
    update(board.value());
  }
  const baseValidate = validateActivityQuestions;
  validateActivityQuestions = function (questions, requireImages = true) {
    const cleaned = baseValidate(questions, requireImages);
    return cleaned.map((q, i) => {
      const source = questions[i];
      for (const [key, limit] of [['explanation', 1500], ['rubric', 1000], ['unit', 30], ['errorSegment', 200], ['correctedSegment', 200]]) {
        if (source[key] != null && (typeof source[key] !== 'string' || source[key].length > limit)) throw Error(`Revisa ${key} en el ejercicio ${i + 1}.`);
        if (source[key]?.trim()) q[key] = source[key].trim();
      }
      if (q.errorSegment && !q.prompt.includes(q.errorSegment)) throw Error('El fragmento erróneo debe aparecer en el enunciado.');
      if (q.type === 'error' && q.correctedSegment && (!q.errorSegment || normalize(q.correctedSegment) === normalize(q.errorSegment))) throw Error('Indica un fragmento erróneo y una corrección distinta.');
      for (const [key, count, limit] of [['hints', 3, 300], ['alternatives', 6, 100], ['wordBank', 12, 100]]) {
        const values = source[key] || [];
        if (!Array.isArray(values) || values.length > count || values.some(v => typeof v !== 'string' || !v.trim() || v.length > limit)) throw Error(`Revisa las pistas o respuestas alternativas del ejercicio ${i + 1}.`);
        if (values.length) q[key] = values.map(v => v.trim());
      }
      if (source.tolerance != null) {
        if (!Number.isFinite(source.tolerance) || source.tolerance < 0 || source.tolerance > 1e6) throw Error('Tolerancia numérica no válida.');
        q.tolerance = source.tolerance;
      }
      if (source.target && q.target) {
        for (const key of ['width', 'height']) if (source.target[key] != null) {
          const value = Number(source.target[key]);
          if (!Number.isFinite(value) || value < 1 || value > 100) throw Error('Zona de imagen no válida.');
          q.target[key] = value;
        }
      }
      if (q.type === 'pasapalabra' && puzzleRows(q.type, q.options).some(([letter,, answer]) => !letterKey(answer).includes(letterKey(letter)))) throw Error('Cada respuesta del rosco debe empezar por su letra o contenerla.');
      return q;
    });
  };

  const originalPuzzleGame = mountPuzzleGame;
  function mountWordSearch(question, index, isChecked, report) {
    const root = $('puzzle-' + index), answer = $('r-' + index);
    const solutionDock = document.querySelector('.wordsearch-solution-dock');
    const words = puzzleRows('wordsearch', question.options), board = buildWordSearch(words);
    const found = new Set(), foundPaths = new Map();
    let start = null, selection = [], hintCell = null, message = 'Marca una palabra arrastrando o tocando su primera y última letra.';
    let dragging = false, dragStart = null, moved = false, misses = 0, showSolution = false;
    const cellIndex = (row, col) => row * board.size + col;
    const placementPath = placement => placement.cells.map(([row, col]) => cellIndex(row, col));
    const pathBetween = (from, to) => {
      const [r1, c1, r2, c2] = [Math.floor(from / board.size), from % board.size, Math.floor(to / board.size), to % board.size];
      const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1), distance = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1));
      if (r1 !== r2 && c1 !== c2 && Math.abs(r2 - r1) !== Math.abs(c2 - c1)) return [];
      return Array.from({ length: distance + 1 }, (_, step) => cellIndex(r1 + dr * step, c1 + dc * step));
    };
    function update() {
      answer.value = [...found].sort((a, b) => a - b).map(n => words[n]).join(', ');
      report(index, { complete: found.size === words.length, correct: found.size === words.length, answer: answer.value,
        review: () => board.placements.forEach((placement, n) => { if (!found.has(n)) placementPath(placement).forEach(cell => root.querySelector(`[data-cell="${cell}"]`)?.classList.add('solution')); }) });
    }
    function paintSelection() {
      const marked = new Set(selection), discovered = new Set([...found].flatMap(n => foundPaths.get(n) || placementPath(board.placements[n])));
      const remaining = showSolution ? new Set(board.placements.flatMap((placement, n) => found.has(n) ? [] : placementPath(placement))) : new Set();
      root.querySelectorAll('[data-cell]').forEach(button => {
        const cell = Number(button.dataset.cell);
        button.classList.toggle('selected', marked.has(cell));
        button.classList.toggle('found', discovered.has(cell));
        button.classList.toggle('solution', remaining.has(cell));
        button.classList.toggle('hinted', cell === hintCell && !marked.has(cell) && !discovered.has(cell));
        button.setAttribute('aria-pressed', String(marked.has(cell)));
      });
      root.querySelector('[data-wordsearch-check]').disabled = isChecked() || selection.length < 3;
      root.querySelector('[data-wordsearch-clear]').disabled = isChecked() || (!selection.length && start === null);
    }
    function setSelection(cell) {
      if (start === null || selection.length >= 3) {
        start = cell;
        selection = [cell];
        message = 'Ahora toca la última letra, o arrastra hasta ella.';
      } else {
        selection = pathBetween(start, cell);
        start = null;
        message = selection.length >= 3 ? 'Pulsa Comprobar para confirmar la palabra.' : 'Marca una línea recta de al menos tres letras.';
      }
      root.querySelector('.wordsearch-status').textContent = message;
      paintSelection();
    }
    function draw() {
      root.innerHTML = `<div class="wordsearch-board"><div class="wordsearch-grid-wrap"><div class="puzzle-grid wordsearch-grid" role="group" aria-label="Sopa de letras de ${board.size} filas y ${board.size} columnas" style="--puzzle-size:${board.size}">${board.grid.flatMap((row, r) => row.map((letter, c) => `<button type="button" data-cell="${cellIndex(r,c)}" tabindex="${r===0&&c===0?0:-1}" aria-label="Fila ${r+1}, columna ${c+1}, letra ${letter}" aria-pressed="false">${escape(letter)}</button>`)).join('')}</div></div><aside class="wordsearch-sidebar"><div class="wordsearch-progress"><span>Palabras encontradas</span><strong>${found.size}<small> / ${words.length}</small></strong><div role="progressbar" aria-label="Palabras encontradas" aria-valuemin="0" aria-valuemax="${words.length}" aria-valuenow="${found.size}"><span style="width:${found.size / words.length * 100}%"></span></div></div><div class="wordsearch-list"><h4>Palabras a encontrar</h4><ul>${words.map((word, n) => `<li class="${found.has(n) ? 'found' : ''}"><span aria-hidden="true">${found.has(n) ? '✓' : '⌕'}</span>${escape(word)}</li>`).join('')}</ul></div><p class="wordsearch-status" role="status">${escape(message)}</p><div class="wordsearch-actions"><button type="button" data-wordsearch-hint ${found.size===words.length?'disabled':''}>Pista</button><button type="button" data-wordsearch-check class="primary">Comprobar</button><button type="button" data-wordsearch-clear>Borrar selección</button></div></aside></div>`;
      if (solutionDock) root.querySelector('.wordsearch-sidebar').append(solutionDock);
      const bindAction = (selector, action) => {
        const button = root.querySelector(selector);
        let handledTouch = false;
        button.addEventListener('pointerup', event => {
          if (event.pointerType !== 'touch' || button.disabled) return;
          handledTouch = true;
          action();
        });
        button.addEventListener('click', () => {
          if (handledTouch) { handledTouch = false; return; }
          action();
        });
      };
      bindAction('[data-wordsearch-check]', check);
      bindAction('[data-wordsearch-clear]', () => { start = null; selection = []; message = 'Selecciona otra palabra.'; draw(); });
      bindAction('[data-wordsearch-hint]', () => {
        if (isChecked()) return;
        const n = words.findIndex((_, i) => !found.has(i));
        if (n < 0) return;
        hintCell = placementPath(board.placements[n])[0];
        message = `Pista: ${words[n]} empieza en la fila ${board.placements[n].row + 1}, columna ${board.placements[n].col + 1}.`;
        recordAnswer(index, 'hint-' + n, null, 'pista', true);
        draw();
      });
      paintSelection();
      update();
    }
    function check() {
      if (isChecked() || selection.length < 3) return;
      const text=selection.map(cell=>board.grid[Math.floor(cell/board.size)][cell%board.size]).join('');
      const chosen=words.findIndex((word,n)=>!found.has(n)&&(word===text||word===[...text].reverse().join('')));
      if (chosen >= 0) { foundPaths.set(chosen,[...selection]); found.add(chosen); hintCell = null; recordAnswer(index, chosen, true, words[chosen]); message = found.size === words.length ? '¡Muy bien! Has encontrado todas las palabras.' : `¡Encontraste ${words[chosen]}! Sigue con las demás.`; }
      else { recordAnswer(index, 'miss-' + ++misses, false, selection.join('-')); message = 'Esa selección no coincide con una palabra pendiente. Inténtalo de nuevo.'; }
      start = null; selection = []; draw();
    }
    root.addEventListener('keydown',event=>{
      const cell=event.target.closest('[data-cell]');
      if(!cell||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();const n=Number(cell.dataset.cell),r=Math.floor(n/board.size),c=n%board.size;
      const row=Math.max(0,Math.min(board.size-1,r+(event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0)));
      const col=Math.max(0,Math.min(board.size-1,c+(event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0)));
      root.querySelectorAll('[data-cell]').forEach(button=>button.tabIndex=Number(button.dataset.cell)===cellIndex(row,col)?0:-1);
      root.querySelector(`[data-cell="${cellIndex(row,col)}"]`)?.focus({preventScroll:true});
    });
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-cell]');
      if (button && event.detail === 0 && !isChecked()) setSelection(Number(button.dataset.cell));
    });
    root.addEventListener('pointerdown', event => {
      const button = event.target.closest('[data-cell]');
      if (!button || isChecked()) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      dragging = true; moved = false;
      const cell = Number(button.dataset.cell);
      dragStart = start === null || selection.length >= 3 ? cell : start;
      setSelection(cell);
      if (event.pointerType === 'mouse') root.setPointerCapture(event.pointerId);
    });
    root.addEventListener('pointermove', event => {
      if (!dragging || isChecked()) return;
      const button = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-cell]');
      if (!button || !root.contains(button)) return;
      const end = Number(button.dataset.cell);
      if (end !== dragStart) moved = true;
      if (!moved) return;
      selection = pathBetween(dragStart, end);
      start = null;
      paintSelection();
    });
    root.addEventListener('pointerup', event => {
      if (!dragging) return;
      dragging = false;
      if (event.pointerType === 'mouse' && root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
      if (!moved) return;
      const button = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-cell]');
      if (button && root.contains(button)) selection = pathBetween(dragStart, Number(button.dataset.cell));
      message = selection.length >= 3 ? 'Pulsa Comprobar para confirmar la palabra.' : 'Marca una línea recta de al menos tres letras.';
      root.querySelector('.wordsearch-status').textContent = message;
      paintSelection();
    });
    root.addEventListener('pointercancel', () => {
      dragging = false; moved = false;
    });
    root.revealWordSearchSolution = () => { showSolution = true; paintSelection(); };
    draw();
  }
  mountMemory = function (q, index, isChecked) {
    const pairs = validateMemory(q.options), cards = shuffle(pairs.flatMap((pair, id) => pair.map(label => ({ id, label }))));
    const root = $('memory-' + index), answer = $('r-' + index), status = $('memory-status-' + index);
    let opened = [], moves = 0, busy = false;
    const matched = new Set();
    root.tabIndex=-1;
    function draw(focusPosition=null) {
      root.style.setProperty('--memory-columns', cards.length === 4 ? 2 : cards.length <= 6 ? 3 : 4);
      root.classList.toggle('memory-long-text', cards.some(card => card.label.length > 70));
      root.innerHTML = cards.map((card, n) => `<button type="button" class="memory-card ${matched.has(card.id) ? 'matched' : ''} ${opened.includes(n) ? 'revealed' : ''}" data-card="${n}" aria-label="${opened.includes(n) || matched.has(card.id) ? escape(card.label) : `Tarjeta ${n + 1}`}" aria-pressed="${opened.includes(n) || matched.has(card.id)}" ${matched.has(card.id) || busy || isChecked() ? 'disabled' : ''}><span class="memory-card-content">${opened.includes(n) || matched.has(card.id) ? escape(card.label) : '<span class="memory-card-mark" aria-hidden="true">✦</span>'}</span>${matched.has(card.id) ? '<small>✓ Pareja</small>' : ''}</button>`).join('');
      status.textContent = `${matched.size}/${pairs.length} parejas · ${moves} ${moves===1?'intento':'intentos'}${matched.size === pairs.length ? ' · ¡Completado!' : busy ? ' · Prueba otra pareja' : ''}`;
      const progress = root.parentElement.querySelector('progress');
      if (progress) { progress.max = pairs.length; progress.value = matched.size; }
      root.querySelectorAll('[data-card]').forEach(button => button.onclick = () => {
        const n = Number(button.dataset.card);
        if (busy || isChecked() || opened.includes(n) || matched.has(cards[n].id)) return;
        opened.push(n);
        if (opened.length === 2) {
          moves++;
          if (cards[opened[0]].id === cards[opened[1]].id) { recordAnswer(index,cards[n].id,true,'matched');matched.add(cards[n].id); opened = []; if (matched.size === pairs.length) { answer.value = 'Completado'; answer.dispatchEvent(new Event('input', { bubbles: true })); } }
          else { opened.forEach(pos=>recordAnswer(index,cards[pos].id,false,'miss-'+moves));busy = true; setTimeout(() => { if (!root.isConnected) return; const restore=document.activeElement===root;opened = []; busy = false; draw(restore?n:null); }, 950); }
        }
        draw(n);
        if(busy)root.querySelectorAll('.memory-card.revealed').forEach(card=>{card.classList.add('answer-wrong');card.insertAdjacentHTML('beforeend','<small>× Otra pareja</small>')});
      });
      if(focusPosition!==null){const target=root.querySelector(`[data-card="${focusPosition}"]:not(:disabled)`)||root.querySelector('[data-card]:not(:disabled)');(target||root).focus({preventScroll:true});}
    }
    draw();
  };
  mountPuzzleGame = function (question, index, isChecked, report) {
    if (question.type === 'crossword') return mountCrossword(question, index, isChecked, report);
    if (question.type === 'dragdrop') return mountMatching(question,index,isChecked,report);
    if (question.type === 'multigaps') {
      const root = $('puzzle-' + index), answer = $('r-' + index), solutions = puzzleRows('multigaps', question.options);
      const parts = displayGapPrompt(question).split('___');
      root.innerHTML = `<div class="multi-gap-play" aria-label="Texto con ${solutions.length} huecos">${parts.map((part, position) => `${escape(part)}${position < solutions.length ? `<input data-multi-gap="${position}" autocomplete="off" spellcheck="false" maxlength="100" placeholder="${position + 1}" aria-label="Respuesta del hueco ${position + 1}">` : ''}`).join('')}</div><p class="play-progress" id="multi-status-${index}" role="status">0 de ${solutions.length} huecos completados</p>`;
      const inputs = [...root.querySelectorAll('[data-multi-gap]')];
      const update = () => {
        const values = inputs.map(input => input.value.trim());
        const complete = values.every(Boolean);
        const correct = complete && values.every((value, position) => solutions[position].split('~').some(solution => accepts(value, solution)));
        answer.value = values.join(' | ');
        report(index, { complete, correct, answer: answer.value, review: () => inputs.forEach((input, n) => { const right = solutions[n].split('~').some(solution => accepts(input.value, solution)); markControl(input,right);input.parentElement.querySelector(`[data-gap-result="${n}"]`)?.remove();input.insertAdjacentHTML('afterend', `<small class="gap-result">${right ? '✓' : `→ ${escape(solutions[n].split('~')[0])}`}</small>`); }) });
        $('multi-status-' + index).textContent = `${values.filter(Boolean).length} de ${solutions.length} huecos completados`;
      };
      inputs.forEach((input, position) => {
        input.style.width = `${Math.min(220, Math.max(75, solutions[position].split('~')[0].length * 10 + 30))}px`;
        input.oninput = update;
        const confirm=()=>{const value=input.value.trim();if(!value||isChecked())return;const right=solutions[position].split('~').some(s=>accepts(value,s));markControl(input,right);input.parentElement.querySelector(`[data-gap-result="${position}"]`)?.remove();input.insertAdjacentHTML('afterend',`<small class="gap-result" data-gap-result="${position}" role="status">${right?'✓':'×'}</small>`);recordAnswer(index,position,right,value);};
        input.addEventListener('blur',confirm);
        input.addEventListener('input',()=>{input.classList.remove('answer-right','answer-wrong');input.removeAttribute('aria-invalid');input.parentElement.querySelector(`[data-gap-result="${position}"]`)?.remove();});
        input.onkeydown = event => { if(event.key==='Enter'){event.preventDefault();confirm();inputs[position+1]?.focus();} };
      });
      update();
      return;
    }
    if (question.type === 'pasapalabra') {
      const root = $('puzzle-' + index), answer = $('r-' + index), rows = puzzleRows('pasapalabra', question.options);
      const alphabet = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
      const rowForSlot = alphabet.map(letter => rows.findIndex(([rowLetter]) => letterKey(rowLetter) === letter));
      const values = Array(rows.length).fill('');
      const outcomes=Array(rows.length).fill(null);
      let active = 0, focusInput = false;
      const passed = new Set();
      const fitClue = () => {
        const clue = root.querySelector('.pasapalabra-card>p');
        if (!clue) return;
        clue.style.fontSize = '';
        clue.tabIndex=0;clue.setAttribute('aria-label','Pista');
        let clueSize = parseFloat(getComputedStyle(clue).fontSize);
        while (clue.scrollHeight > clue.clientHeight + 1 && clueSize > 14) {
          clueSize -= .5;
          clue.style.fontSize = `${clueSize}px`;
        }
      };
      const draw = () => {
        const completed = values.filter(Boolean).length;
        const slots = alphabet.map((letter, slot) => {
          const angle = slot / alphabet.length * Math.PI * 2 - Math.PI / 2;
          const style = `--x:${50 + 46 * Math.cos(angle)}%;--y:${50 + 46 * Math.sin(angle)}%`;
          const position = rowForSlot[slot];
          if (position < 0) return `<button type="button" style="${style}" class="empty" data-slot="${slot}" aria-label="Letra ${letter} sin actividad" disabled></button>`;
          const status = outcomes[position] === true ? 'correct' : outcomes[position] === false ? 'incorrect' : passed.has(position) ? 'passed' : '';
          const state = outcomes[position] === true ? 'correcta' : outcomes[position] === false ? 'incorrecta' : passed.has(position) ? 'pasada' : 'pendiente';
          return `<button type="button" style="${style}" class="${position === active ? 'active' : ''} ${status}" data-slot="${slot}" data-letter="${position}" aria-label="Letra ${letter}: ${state}">${letter}${outcomes[position] !== null ? `<small>${outcomes[position] ? '✓' : '×'}</small>` : ''}</button>`;
        }).join('');
        const clueLength = String(rows[active][1] || '').length;
        root.innerHTML = `<div class="rosco-layout"><div class="pasapalabra-wheel" aria-label="Rosco de Pasapalabra">${slots}</div><div class="pasapalabra-card ${clueLength > 145 ? 'very-long-clue' : clueLength > 85 ? 'long-clue' : ''}"><span>${letterKey(rows[active][2]).startsWith(letterKey(rows[active][0])) ? 'Con la' : 'Contiene la'} ${escape(rows[active][0])}:</span><p>${rich(rows[active][1])}</p><input id="pasapalabra-input-${index}" value="${escape(values[active])}" autocomplete="off" maxlength="60" aria-label="Respuesta para la letra ${escape(rows[active][0])}"><button type="button" class="primary" data-answer>Comprobar</button>${completed === rows.length && outcomes.some(v => v === false) ? '<button type="button" data-review-rosco>Volver a los fallos</button>' : ''}</div></div><div class="pasapalabra-controls"><button type="button" data-prev aria-label="Letra anterior">‹ <span>Anterior</span></button><button type="button" data-next>› <span>Siguiente</span></button></div>`;
        fitClue();
        const score = $('pasapalabra-score-' + index), position = $('pasapalabra-position-' + index);
        if (score) score.textContent = `${outcomes.filter(v => v === true).length} correctas · ${outcomes.filter(v => v === false).length} incorrectas · ${rows.length - completed} pendientes`;
        if (position) position.textContent = `${active + 1} / ${rows.length}`;
        root.querySelectorAll('[data-letter]').forEach(button => button.onclick = () => { if (!isChecked()) { active = Number(button.dataset.letter); draw(); } });
        const input = root.querySelector(`#pasapalabra-input-${index}`);
        input.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); saveAnswer(); } };
        root.querySelector('[data-answer]').onclick = saveAnswer;
        root.querySelector('[data-review-rosco]')?.addEventListener('click',()=>{active=Math.max(0,outcomes.findIndex(v=>v===false));focusInput=true;draw();});
        root.querySelector('[data-prev]').onclick = () => { if (isChecked()) return; active = (active - 1 + rows.length) % rows.length; focusInput = true; draw(); };
        root.querySelector('[data-next]').onclick = () => { if (isChecked()) return; if (!values[active]) passed.add(active); active = (active + 1) % rows.length; focusInput = true; draw(); };
        if (focusInput) input.focus({ preventScroll: true });
      };
      const saveAnswer = () => {
        if (isChecked()) return;
        const input = root.querySelector(`#pasapalabra-input-${index}`), value = input.value.trim();
        if (!value) return input.focus();
        values[active] = value;
        outcomes[active]=accepts(value,rows[active][2]);recordAnswer(index,active,outcomes[active],value);
        passed.delete(active);
        focusInput = true;
        const next = values.findIndex((value, position) => !value && position > active);
        active = next >= 0 ? next : Math.max(0, values.findIndex(value => !value));
        const complete = values.every(Boolean), correct = complete && outcomes.every(Boolean);
        answer.value = values.join(' | ');
        report(index, { complete, correct, answer: answer.value, review: () => root.querySelectorAll('[data-letter]').forEach(button => { const n = Number(button.dataset.letter), right = accepts(values[n], rows[n][2]); button.classList.remove('correct','incorrect');button.classList.add(right ? 'correct' : 'incorrect'); button.setAttribute('aria-label', `${rows[n][0]}: ${right ? 'correcta' : 'incorrecta'}`);button.querySelector('small')?.remove();button.innerHTML += `<small>${right ? '✓' : '×'}</small>`; }) });
        draw();
      };
      draw();
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fitClue).observe(root);
      return;
    }
    if (question.type === 'wordsearch') return mountWordSearch(question, index, isChecked, report);
    return originalPuzzleGame(question,index,isChecked,report);
  };

  const originalEditorPreview = editorExercisePreview;
  editorExercisePreview = function (question, index) {
    if (question.type === 'gaps') {
      const prompt = $('q-' + index)?.value || '';
      const [before, after] = prompt.split('___');
      return `<div class="play-gap-preview">${escape(before)}<span>hueco para escribir</span>${escape(after || '')}</div><small>Solución: ${escape($('a-' + index)?.value || 'sin completar')}</small>`;
    }
    if (question.type === 'multigaps') {
      const prompt = $('q-' + index)?.value || '', answers = ($('o-' + index)?.value || '').split('\n').map(value => value.trim()).filter(Boolean);
      let position = 0;
      return `<div class="play-gap-preview">${prompt.split('___').map((part, partIndex) => `${escape(part)}${partIndex < prompt.split('___').length - 1 ? `<span>${escape(answers[position++] || `hueco ${position}`)}</span>` : ''}`).join('')}</div>`;
    }
    if (question.type === 'numeric') return `<div class="numeric-preview"><span>=</span><strong>${escape($('a-' + index)?.value || 'resultado')}</strong></div>`;
    return originalEditorPreview(question, index);
  };
  const originalEditActivity = editActivity;
  editActivity = function (source) {
    originalEditActivity(source);
    const dialog = $('dialog'), form = $('form');
    dialog.classList.add('material-editor-dialog');
    const previewAbort = new AbortController();
    const renderEditorPreview = () => {
      const index = Number(dialog.dataset.editorStep || 0);
      const original = source.activity.questions[index];
      if (!original || !$('editorPreview')) return;
      const question = {
        ...original,
        prompt: $('q-' + index)?.value || '',
        answer: $('a-' + index)?.value || '',
        text: $('text-' + index)?.value || original.text,
        options: $('o-' + index)?.value.split('\n').map(value => value.trim()).filter(Boolean) || original.options,
      };
      const editorImage = $('image-preview-' + index)?.querySelector('img');
      if (editorImage && !question.image) question.image = { filename: 'Imagen del ejercicio' };
      const preview = $('editorPreview');
      preview.innerHTML = `<div class="activity-play editor-preview-play">${playableEditorPreview(question, index)}</div>`;
      preview.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      preview.querySelectorAll('[name],[required]').forEach(node => { node.removeAttribute('name'); node.removeAttribute('required'); });
      preview.querySelectorAll('button,input,textarea,select,[tabindex]').forEach(node => node.setAttribute('tabindex', '-1'));
      Promise.resolve(paintActivityImages(source.activity.questions, preview)).then(() => {
        const target = preview.querySelector('[data-activity-image]');
        if (target && editorImage?.src && preview.isConnected) target.src = editorImage.src;
      });
    };
    form.addEventListener('input', renderEditorPreview, { signal: previewAbort.signal });
    form.addEventListener('editor:step', renderEditorPreview, { signal: previewAbort.signal });
    dialog.addEventListener('close', () => { previewAbort.abort(); dialog.classList.remove('material-editor-dialog'); }, { once: true });
    renderEditorPreview();
    const hints = {
      pairs: 'Cada tarjeta relaciona este enunciado con su respuesta. Crea al menos dos tarjetas para que haya opciones entre las que elegir.',
      gaps: 'Escribe ___ dentro de la frase donde quieres que el alumno complete la palabra. Solo un hueco por ejercicio.',
      multigaps: 'Escribe de 2 a 6 marcas ___ en el texto y, debajo, una solución por línea en el mismo orden.',
      numeric: 'Plantea un cálculo inequívoco. La solución debe contener solo el valor numérico; se aceptan coma y punto decimal.',
      order: 'Una línea por paso, en el orden correcto. El alumno podrá arrastrarlos o moverlos con las flechas.',
      sentence: 'Escribe los fragmentos de la frase en su orden correcto, uno por línea.',
      timeline: 'Pon cada fecha o acontecimiento en orden cronológico, uno por línea.',
      memory: 'Escribe una pareja por línea: concepto | respuesta. Las tarjetas se mezclarán automáticamente.',
      dragdrop: 'Escribe una pareja por línea: pieza | destino. Cada pieza solo podrá ocupar un destino.',
      crossword: 'Escribe PALABRA | pista en cada línea. Usa palabras que compartan letras.',
      wordsearch: 'Escribe una palabra por línea; el tablero se generará automáticamente.',
      pasapalabra: 'Prepara entre 3 y 27 letras distintas. Cada respuesta debe empezar por su letra o contenerla.',
      mystery: 'Escribe el concepto en Solución y tres pistas progresivas en las filas de abajo, sin nombrar la respuesta. El alumno empieza con la primera pista.',
      intruder: 'Escribe entre tres y cinco conceptos: solo uno no pertenece al grupo. En Solución copia exactamente la tarjeta intrusa y explica el criterio.',
      bingo: 'Nueve parejas concepto | definición. El cartón y las pistas se mezclan por separado; una definición no debe incluir su propio concepto.',
      hangman: 'Escribe una pista clara en el enunciado y la palabra o expresión que debe descubrir en la solución.',
      flashcard: 'El enunciado es el anverso y la solución es el reverso. El alumno indicará si la sabía.',
      imagepoint: 'Marca en la imagen el punto que el alumno deberá localizar.',
    };
    source.activity.questions.forEach((question, index) => {
      const field = $('q-' + index);
      if (!field) return;
      const hint = document.createElement('p');
      hint.className = 'play-editor-hint';
      hint.textContent = hints[question.type] || 'Redacta una tarea concreta y añade una explicación que ayude a aprender de la respuesta.';
      field.after(hint);
      const section = field.closest('.activity-edit-block');
      if (question.type === 'imagepoint') {
        const box = $('image-preview-' + index);
        box.insertAdjacentHTML('afterend', `<div class="zone-fields">${[['x','Centro horizontal',50],['y','Centro vertical',50],['width','Ancho',20],['height','Alto',20]].map(([key,label,fallback]) => `<label>${label} (%)<input id="zone-${key}-${index}" name="zone-${key}-${index}" type="number" min="${key === 'x' || key === 'y' ? 0 : 1}" max="100" value="${question.target?.[key] ?? fallback}"></label>`).join('')}</div>`);
        section.querySelectorAll('[name^="zone-"]').forEach(input => input.oninput = () => box.dispatchEvent(new Event('zonechange')));
        if (question.image && !question.target) box.dispatchEvent(new Event('zonechange'));
      }
      section.insertAdjacentHTML('beforeend', `<details class="pedagogy-editor"><summary>Explicación, pistas y criterios</summary><label>Explicación de la solución<textarea name="explanation-${index}" maxlength="1500" placeholder="Por qué es correcta y cómo se llega a ella">${escape(question.explanation || '')}</textarea></label>${question.type === 'error' ? `<label>Fragmento erróneo exacto<input name="errorSegment-${index}" maxlength="200" value="${escape(question.errorSegment || '')}"></label><label>Corrección exacta del fragmento<input name="correctedSegment-${index}" maxlength="200" value="${escape(question.correctedSegment || '')}"></label>` : ''}<label>Pistas progresivas (una por línea, hasta 3)<textarea name="hints-${index}" maxlength="902">${escape((question.hints || []).join('\n'))}</textarea></label>${openAnswerTypes.includes(question.type) ? `<label>Criterios para revisar<textarea name="rubric-${index}" maxlength="1000">${escape(question.rubric || '')}</textarea></label>` : ''}${['gaps','short','mystery'].includes(question.type) ? `<label>Respuestas equivalentes (una por línea)<textarea name="alternatives-${index}" maxlength="605">${escape((question.alternatives || []).join('\n'))}</textarea></label>` : ''}${question.type === 'numeric' ? `<div class="editor-pair"><label>Unidad<input name="unit-${index}" maxlength="30" value="${escape(question.unit || '')}"></label><label>Tolerancia absoluta<input name="tolerance-${index}" type="number" min="0" max="1000000" step="any" value="${Number(question.tolerance || 0)}"></label></div>` : ''}</details>`);
      const options = $('o-' + index);
      if (['gaps','multigaps'].includes(question.type)) section.querySelector('.pedagogy-editor').insertAdjacentHTML('beforeend', `<label>Banco de palabras opcional (una por línea, hasta 12)<textarea name="wordBank-${index}" maxlength="1211">${escape((question.wordBank || []).join('\n'))}</textarea></label>`);
      if (options) {
        const columns = ['memory','crossword','dragdrop','bingo'].includes(question.type) ? 2 : question.type === 'pasapalabra' ? 3 : 1;
        const labels = question.type === 'bingo' ? ['Concepto','Definición'] : question.type === 'mystery' ? ['Pista'] : question.type === 'intruder' ? ['Tarjeta'] : question.type === 'pasapalabra' ? ['Letra','Pista','Respuesta'] : question.type === 'crossword' ? ['Palabra','Pista'] : question.type === 'memory' ? ['Concepto','Pareja'] : question.type === 'dragdrop' ? ['Elemento','Destino'] : [sequenceTypes.includes(question.type) ? 'Paso en orden correcto' : question.type === 'multigaps' ? 'Solución (variantes con ~)' : 'Opción'];
        let rows = options.value.split('\n').map(line => columns === 1 ? [line.trim()] : line.split('|').map(value => value.trim()));
        // HTML textareas remove a leading newline; preserve empty manual board rows.
        if (question.options?.length && question.options.every(value => !value.trim())) rows = Array.from({ length: question.options.length }, () => Array(columns).fill(''));
        options.hidden = true; options.previousElementSibling.hidden = true;
        const editor = document.createElement('div'); editor.className = 'structured-options'; options.after(editor);
        function sync() { options.value = rows.map(row => row.join(' | ')).join('\n'); options.dispatchEvent(new Event('input', { bubbles: true })); }
        function draw() {
          editor.innerHTML = `<p class="play-editor-hint">${labels.map(escape).join(' · ')}${sequenceTypes.includes(question.type) ? ' · El alumno recibirá los pasos mezclados.' : ''}</p>${rows.map((row, n) => `<div class="structured-row" style="--columns:${columns}"><span>${n + 1}</span>${Array.from({ length: columns }, (_, c) => (c===1&&columns>1)||question.type==='mystery'?`<textarea data-row="${n}" data-col="${c}" aria-label="${labels[c]} ${n + 1}" maxlength="${question.type==='mystery'?300:question.type==='pasapalabra'?180:question.type==='crossword'?120:140}" rows="2">${escape(row[c]||'')}</textarea>`:`<input data-row="${n}" data-col="${c}" aria-label="${labels[c]} ${n + 1}" value="${escape(row[c] || '')}" maxlength="${question.type==='bingo'?80:question.type==='intruder'?140:question.type==='pasapalabra'?(c===0?1:60):columns === 1 ? 300 : 140}">`).join('')}<button type="button" data-remove-row="${n}" aria-label="Eliminar fila ${n + 1}" ${question.type==='bingo'&&rows.length<=9||question.type==='mystery'&&rows.length<=3||question.type==='intruder'&&rows.length<=3?'disabled':''}>×</button></div>`).join('')}<button type="button" data-add-row ${question.type==='bingo'&&rows.length>=9||question.type==='mystery'&&rows.length>=3||question.type==='intruder'&&rows.length>=5?'disabled':''}>+ Añadir fila</button>`;
          editor.querySelectorAll('input,textarea').forEach(input => input.oninput = () => { rows[Number(input.dataset.row)][Number(input.dataset.col)] = input.value.replace(/[\r\n|]+/g,' '); sync(); });
          editor.querySelector('[data-add-row]').onclick = () => { rows.push(Array(columns).fill('')); draw(); sync(); };
          editor.querySelectorAll('[data-remove-row]').forEach(button => button.onclick = () => { rows.splice(Number(button.dataset.removeRow), 1); draw(); sync(); });
        }
        draw();
        options.addEventListener('editor:options',()=>{rows=options.value.split('\n').map(line=>columns===1?[line.trim()]:line.split('|').map(value=>value.trim()));draw()});
      }
    });
  };

  function playableEditorPreview(question, index) {
    const shell = document.createElement('div');
    shell.innerHTML = questionMarkup(question, index, [question.answer]);
    const type = question.type;
    const options = question.options || [];
    if(['mystery','intruder','bingo'].includes(type)){
      const preview=shell.querySelector('[id^="mini-"]');
      const data=type==='bingo'?{
        cards:Array.from({length:9},(_,n)=>({token:String(n),label:options[n]?.split('|')[0]?.trim()||'Concepto '+(n+1)})),
        clues:Array.from({length:9},(_,n)=>({token:String(n),clue:options[n]?.split('|')[1]?.trim()||'Escribe una definición para este concepto.'}))
      }:{options:type==='mystery'?Array.from({length:3},(_,n)=>options[n]||'Escribe la pista '+(n+1)):(options.length?options:['Tarjeta 1','Tarjeta 2','Tarjeta 3'])};
      window.profesorMiniGame(preview,{kind:type,...data,locked:true,seed:question.id||'preview'});
    }
    const sequence = shell.querySelector('.play-order-list');
    if (sequence) {
      const labels = options.map(value => type === 'timeline' ? timelineLabel(value, false) : value);
      sequence.classList.toggle('is-dense', labels.length >= 8);
      sequence.classList.toggle('is-very-dense', labels.length > 12);
      sequence.innerHTML = labels.map((label, position) => `<div class="order-row"><span class="order-grip" aria-hidden="true">⠿</span><span class="order-value"><b>${position + 1}.</b> ${escape(label)}</span><div class="order-actions"><button type="button">↑</button><button type="button">↓</button></div></div>`).join('') + '<div class="sequence-actions"><button type="button" class="primary">Comprobar orden</button></div>';
      if (type === 'timeline') sequence.style.maxWidth = `min(100%, ${Math.max(430, Math.min(960, Math.max(...labels.map(label => label.length), 0) * 7 + 145))}px)`;
    }
    const memory = shell.querySelector('.memory-board');
    if (memory) {
      const count = Math.max(2, Math.min(12, options.length * 2));
      memory.style.setProperty('--memory-columns', count <= 6 ? 3 : 4);
      memory.innerHTML = Array.from({ length: count }, (_, position) => `<button type="button" class="memory-card" aria-label="Tarjeta ${position + 1}"><span class="memory-card-mark" aria-hidden="true">✦</span></button>`).join('');
    }
    const puzzle = shell.querySelector('[id^="puzzle-"]');
    if (type === 'multigaps' && puzzle) {
      const parts = displayGapPrompt(question).split('___');
      puzzle.innerHTML = `<div class="multi-gap-play">${parts.map((part, position) => `${escape(part)}${position < parts.length - 1 ? '<input placeholder="' + (position + 1) + '">' : ''}`).join('')}</div>`;
    } else if (type === 'pasapalabra' && puzzle) {
      try {
        const rows = puzzleRows(type, options);
        puzzle.innerHTML = `<div class="rosco-layout"><div class="pasapalabra-wheel" aria-label="Rosco de Pasapalabra">${rows.map(([letter], position) => { const angle = position / rows.length * Math.PI * 2 - Math.PI / 2; return `<button type="button" class="${position === 0 ? 'active' : ''}" style="--x:${50 + 43 * Math.cos(angle)}%;--y:${50 + 43 * Math.sin(angle)}%">${escape(letter)}</button>`; }).join('')}<div class="rosco-center"><strong>0/${rows.length}</strong><span>aciertos</span></div></div><div class="pasapalabra-card"><span>Empieza por ${escape(rows[0][0])}</span><p>${escape(rows[0][1] || 'Escribe una pista')}</p><label>Tu respuesta<input placeholder="Respuesta"></label><div><button type="button">Pasapalabra</button><button type="button" class="primary">Confirmar</button></div></div></div>`;
      } catch { puzzle.innerHTML = '<p class="play-hint">Completa las letras, pistas y respuestas para ver el rosco.</p>'; }
    } else if (type === 'dragdrop' && puzzle) {
      try {
        const rows = puzzleRows(type, options);
        const targets = [...new Set(rows.map(([, destination]) => destination))];
        puzzle.innerHTML = `<p class="play-hint">Elige una pieza y después su destino, o arrástrala. Pulsa × para devolverla.</p><div class="placement-bank" aria-label="Piezas pendientes">${rows.map(([piece]) => `<button type="button">${escape(piece || 'Elemento')}</button>`).join('')}</div><div class="placement-targets">${targets.map(destination => `<div class="placement-bucket"><button type="button" class="bucket-title">${escape(destination || 'Destino')}<small>Coloca las piezas de este grupo</small></button><div></div></div>`).join('')}</div>`;
      } catch { puzzle.innerHTML = '<p class="play-hint">Completa las piezas y destinos para ver el tablero.</p>'; }
    } else if (type === 'wordsearch' && puzzle) {
      try {
        const rows = puzzleRows(type, options), board = buildWordSearch(rows);
        puzzle.innerHTML = `<p class="puzzle-help">Pulsa la primera y la última letra de cada palabra. Puedes usar el teclado.</p><div class="puzzle-grid" style="--puzzle-size:${board.size}">${board.grid.flatMap(row => row.map(letter => `<button type="button">${escape(letter)}</button>`)).join('')}</div><div class="puzzle-word-list">${rows.map(word => `<span>${escape(word)}</span>`).join('')}</div>`;
      } catch { puzzle.innerHTML = '<p class="puzzle-help">Añade palabras para ver la sopa de letras.</p>'; }
    } else if (type === 'crossword' && puzzle) {
      try {
        const rows = puzzleRows(type, options), board = buildCrossword(rows.map(([word]) => puzzleWord(word)));
        puzzle.innerHTML = `<p class="puzzle-help">Escribe una letra en cada casilla. La columna azul es la palabra vertical.</p><div class="puzzle-grid" style="--puzzle-size:${board.width}">${board.grid.flatMap(row => row.map((letter, column) => letter ? `<input class="${column === board.left ? 'anchor' : ''}" maxlength="1">` : '<span class="blank"></span>')).join('')}</div><ol class="puzzle-clues">${rows.map(([word, clue]) => `<li>${puzzleWord(word) === board.anchor ? '↓ vertical' : '→ horizontal'} · ${escape(clue)} <small>(${puzzleWord(word).length} letras)</small></li>`).join('')}</ol>`;
      } catch { puzzle.innerHTML = '<p class="puzzle-help">Añade palabras que compartan letras para ver el crucigrama.</p>'; }
    }
    const hangman = shell.querySelector('.hangman-game');
    if (hangman) hangman.innerHTML = `<div class="hangman-stage"><div class="hangman-figure"><svg viewBox="0 0 115 115" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M15 105H95M30 105V10H75V25"/></svg></div><div><p class="hangman-preview-clue">${escape(question.prompt)}</p><div class="hangman-word">${'· '.repeat(Math.min(15, Math.max(3, String(question.answer || '').length)))}</div><p>Te quedan 7 intentos.</p></div></div><div class="hangman-keyboard">${'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('').map(letter => `<button type="button">${letter}</button>`).join('')}</div>`;
    const image = shell.querySelector('[data-activity-image]');
    if (image && !question.image) image.replaceWith(Object.assign(document.createElement('div'), { className: 'material-image-slot', innerHTML: '<strong>Tu imagen irá aquí</strong><small>Añade una imagen en el editor.</small>' }));
    return shell.innerHTML;
  }

  function flashcardFace(text, revealed) {
    return `<span class="flashcard-face-label">${revealed ? 'Respuesta' : 'Pregunta'}</span><strong class="flashcard-copy ${String(text).length > 220 ? 'flashcard-copy-long' : ''}">${escape(text)}</strong><span class="flashcard-turn"><span aria-hidden="true">↻</span> ${revealed ? 'Volver a la pregunta' : 'Ver respuesta'}</span>`;
  }

  function choiceMarkup(question, index, options) {
    return `<div class="play-choice-grid" role="group" aria-label="Opciones del ejercicio ${index + 1}">${options.map((option, n) => `<label class="play-choice"><input type="radio" name="r-${index}" value="${escape(option)}" required><span class="play-choice-letter">${String.fromCharCode(65 + n)}</span><span>${escape(option)}</span></label>`).join('')}</div>`;
  }
  function questionMarkup(question, index, pairChoices) {
    const type = question.type;
    const heading = ['gaps','multigaps','flashcard'].includes(type) ? '' : type === 'hangman' ? `<div class="hangman-heading"><h3 id="question-${index}">Adivina el concepto antes de quedarte sin intentos.</h3><p>Lee la pista y selecciona letras.</p></div>` : ['pasapalabra','wordsearch','memory','sentence','timeline','error','crossword','dragdrop','mystery','intruder','bingo'].includes(type) ? `<h3 id="question-${index}" class="${type}-intro">${escape(type==='error'?'Encuentra el error y corrígelo en la frase.':question.prompt)}</h3>` : `<h3 id="question-${index}">${type === 'flashcard' ? 'Lee la tarjeta y piensa la respuesta.' : `${index + 1}. ${escape(question.prompt)}`}</h3>`;
    const image = visualTypes.includes(type) ? `<div class="visual-image-box ${type === 'imagepoint' ? 'visual-answer-box' : ''}" id="visual-${index}" ${type === 'imagepoint' ? 'tabindex="0" role="button" aria-label="Marca el punto en la imagen; usa las flechas para ajustarlo"' : ''}><img data-activity-image="${index}" alt="${escape(question.image?.filename || 'Imagen del ejercicio')}"></div>` : '';
    let control = '';
    if (['mystery','intruder','bingo'].includes(type)) {
      control = `<div id="mini-${index}"></div><input type="hidden" name="r-${index}" id="r-${index}">`;
    } else if (type === 'gaps') {
      const [before, after] = displayGapPrompt(question).split('___');
      control = `<div class="play-gap-line"><span>${escape(before)}</span><input id="r-${index}" name="r-${index}" aria-label="Respuesta del hueco ${index + 1}" autocomplete="off" spellcheck="false" maxlength="300" required placeholder="Escribe aquí"><span>${escape(after)}</span></div>`;
    } else if (type === 'multigaps') {
      control = `<div id="puzzle-${index}"></div><input id="r-${index}" name="r-${index}" type="hidden">`;
    } else if (type === 'numeric') {
      control = `<div class="numeric-answer"><span aria-hidden="true">=</span><input id="r-${index}" name="r-${index}" inputmode="text" autocomplete="off" required placeholder="Resultado" aria-label="Resultado numérico del ejercicio ${index + 1}">${question.unit ? `<strong>${escape(question.unit)}</strong>` : ''}</div><p class="play-hint">Puedes escribir un decimal o una fracción, por ejemplo 1/2.${question.tolerance ? ` Margen admitido: ±${question.tolerance}.` : ''}</p>`;
    } else if (type === 'hangman') {
      control = `<div id="hangman-${index}" class="hangman-game"></div><input id="r-${index}" name="r-${index}" type="hidden">`;
    } else if (type === 'imagepoint') {
      control = `<input id="r-${index}" name="r-${index}" type="hidden"><p class="play-hint" id="point-status-${index}" role="status">Toca la imagen donde está la respuesta. También puedes usar las flechas del teclado.</p>`;
    } else if (puzzleTypes.includes(type)) {
      control = `<div id="puzzle-${index}"></div><input id="r-${index}" name="r-${index}" type="hidden">`;
    } else if (type === 'memory') {
      control = `<div class="memory-stage"><div class="memory-toolbar"><span>Destapa dos tarjetas y encuentra su pareja.</span><p id="memory-status-${index}" class="play-progress" role="status"></p></div><progress class="memory-progress" max="1" value="0" aria-label="Parejas encontradas"></progress><div id="memory-${index}" class="memory-board" role="group" aria-label="Tarjetas de Memory"></div></div><input id="r-${index}" name="r-${index}" type="hidden">`;
    } else if (type === 'flashcard') {
      control = `<div class="flashcard-study"><button type="button" id="flip-${index}" class="flash-card" aria-pressed="false" aria-describedby="flash-help-${index}">${flashcardFace(question.prompt,false)}</button><div class="flashcard-assess-slot"><p id="flash-help-${index}" class="flashcard-help">Piensa la respuesta y gira la tarjeta para comprobarla.</p><div class="play-flash-assess" id="flash-assess-${index}" role="group" aria-label="Valora tu respuesta" hidden><button type="button" data-flash="correct" data-index="${index}" aria-pressed="false">✓ La sabía</button><button type="button" data-flash="partial" data-index="${index}" aria-pressed="false">◷ Con ayuda</button><button type="button" data-flash="incorrect" data-index="${index}" aria-pressed="false">↻ Repasar</button></div></div></div><input id="r-${index}" name="r-${index}" type="hidden">`;
    } else if (['sentence','timeline'].includes(type)) {
      control = `<div id="order-${index}" class="sentence-game"></div><input type="hidden" id="r-${index}" name="r-${index}">`;
    } else if (sequenceTypes.includes(type)) {
      control = `<p class="play-hint">Arrastra para ordenar. También puedes tocar una fila y luego otra, o usar las flechas.${type === 'timeline' && question.options.some(value => /\b(?:1\d{3}|20\d{2})\b/.test(value)) ? ' Las fechas se mostrarán al comprobar.' : ''}</p><div id="order-${index}" class="play-order-list"></div><input type="hidden" id="r-${index}" name="r-${index}">`;
    } else if (type === 'problem') {
      control = `<div class="problem-steps">${['Datos importantes','Planteamiento','Cálculos','Respuesta y comprobación'].map((label, n) => `<label><span>${n + 1}</span>${label}<textarea data-problem-step="${index}" maxlength="700" rows="2" ${n === 3 ? 'required' : ''} aria-label="${label}"></textarea></label>`).join('')}</div><input type="hidden" id="r-${index}" name="r-${index}">`;
    } else if (type === 'error') {
      control = `<div id="error-${index}"></div><input id="r-${index}" name="r-${index}" type="hidden">`;
    } else if (openAnswerTypes.includes(type)) {
      control = `<textarea id="r-${index}" name="r-${index}" maxlength="${type === 'short' ? 800 : 3000}" rows="${type === 'short' ? 2 : 4}" required placeholder="${objectiveShort(question)?'Escribe la palabra o expresión solicitada…':'Escribe tu respuesta con tus propias palabras…'}" aria-label="Respuesta del ejercicio ${index + 1}"></textarea>`;
    } else if (type === 'pairs' && pairChoices.length < 2) {
      control = `<input id="r-${index}" name="r-${index}" autocomplete="off" maxlength="300" required placeholder="Escribe el término relacionado" aria-label="Término relacionado con ${escape(question.prompt)}">`;
    } else {
      const options = type === 'pairs' ? pairChoices : type === 'boolean' ? question.options : shuffle(question.options);
      control = choiceMarkup(question, index, options);
    }
    const review = openAnswerTypes.includes(type) && type !== 'flashcard' ? `<div id="review-${index}" hidden><label for="grade-${index}">Valoración del profesor</label><select id="grade-${index}"><option value="pending">Pendiente de revisar</option><option value="correct">Correcta</option><option value="incorrect">Necesita revisión</option><option value="partial">Parcialmente correcta</option></select></div>` : '';
    return `<section class="block play-question" data-type="${type}" data-tone="${materialTone(type)}" data-question="${index}"><div class="play-question-top"><span class="play-number">${String(index + 1).padStart(2, '0')}</span><span class="play-kind">${escape(activityLabels[type])}</span>${['flashcard','memory','sentence','timeline','error','wordsearch','crossword','dragdrop','pasapalabra','hangman','mystery','intruder','bingo'].includes(type) ? `<div class="game-timer"><button type="button" data-timer="${index}" aria-label="Iniciar cronómetro opcional">Cronómetro</button><output id="timer-${index}" aria-label="Tiempo de práctica">00:00</output></div>` : ''}</div>${heading}<div class="question-workspace">${type === 'reading' ? `<div class="reading-passage prewrap" tabindex="0">${escape(question.text)}<button type="button" data-highlight="${index}">Subrayar selección</button></div>` : ''}<div class="question-controls">${image}${type === 'visualquiz' ? `<button type="button" data-zoom="${index}">Ampliar imagen</button>` : ''}${control}</div></div>${type === 'pasapalabra' ? `<div class="pasapalabra-meta" role="status"><div class="pasapalabra-score-group"><span id="pasapalabra-score-${index}"></span><span class="pasapalabra-meta-actions"></span></div><strong id="pasapalabra-position-${index}"></strong></div>` : ''}${question.hints?.length ? `<div class="play-hints"><button type="button" data-hint="${index}">Necesito una pista</button><ol id="hints-${index}"></ol></div>` : ''}<p id="feedback-${index}" class="play-feedback prewrap" role="status"></p>${review}</section>`;
  }

  function mountHangman(question, index, isChecked) {
    const root = $('hangman-' + index), answer = $('r-' + index);
    const clean = value => String(value || '').toLocaleUpperCase('es').replaceAll('Ñ', '\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('\u0001', 'Ñ');
    const solution = clean(question.answer), letters = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
    const chosen = new Set();
    const misses = () => [...chosen].filter(letter => !solution.includes(letter)).length;
    const won = () => [...solution].filter(letter => /[A-ZÑ]/.test(letter)).every(letter => chosen.has(letter));
    const draw = () => {
      const failed = misses() >= 7, finished = won() || failed;
      const errors = misses(), parts = ['<circle cx="75" cy="36" r="11"/>','<path d="M75 47V74"/>','<path d="M75 53L55 64"/>','<path d="M75 53L95 64"/>','<path d="M75 74L57 96"/>','<path d="M75 74L93 96"/>','<path d="M71 33l2 2m6-2l-2 2"/>'];
      const wordMarkup = solution.split(/(\s+|-)/).filter(Boolean).map(segment => /^\s+$/.test(segment) ? '<span class="word-gap" aria-hidden="true">&nbsp;</span>' : segment === '-' ? '<span class="word-separator">-</span>' : `<span class="hangman-word-group">${[...segment].map(letter => `<span class="letter-slot">${chosen.has(letter) || !/[A-ZÑ]/.test(letter) || finished ? escape(letter) : '&nbsp;'}</span>`).join('')}</span>`).join('');
      root.innerHTML = `<div class="hangman-board"><div class="hangman-figure" data-errors="${errors}" aria-label="${errors} de 7 fallos"><svg viewBox="0 0 115 115" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 105H95M30 105V10H75V25"/>${parts.slice(0, errors).join('')}</svg></div><div class="hangman-clue"><span class="hangman-clue-mark" aria-hidden="true">💡</span><div><strong>Pista:</strong><p>${rich(question.prompt)}</p></div></div><div class="hangman-attempts" role="status" aria-label="${7-errors} de 7 intentos restantes"><strong>Intentos restantes</strong><div class="hangman-hearts" aria-hidden="true">${Array.from({length:7},(_,heart)=>`<span class="${heart>=7-errors?'lost':''}">♥</span>`).join('')}</div><small>${7-errors} de 7</small></div><div class="hangman-word-panel"><div class="hangman-word ${solution.length > 26 ? 'very-long-word' : solution.length > 16 ? 'long-word' : ''}" aria-live="polite">${wordMarkup}</div></div><div class="hangman-keyboard" aria-label="Letras disponibles">${letters.map(letter => `<button type="button" class="${chosen.has(letter) ? solution.includes(letter) ? 'answer-right' : 'answer-wrong' : ''}" data-hangman-letter="${letter}" aria-label="Letra ${letter}" ${chosen.has(letter) || finished ? 'disabled' : ''}>${letter}</button>`).join('')}</div></div><div class="hangman-bottom"><button type="button" data-hangman-reset ${won()?'disabled':''}>↻ Reiniciar</button><button type="button" class="primary" data-hangman-check>¿Cómo voy?</button><p class="hangman-status" role="status">${finished ? won() ? '✓ ¡Palabra descubierta!' : `La respuesta era ${escape(question.answer)}.` : ''}</p></div>`;
      root.querySelector('[data-hangman-reset]').onclick=()=>{if(isChecked()||won())return;chosen.clear();answer.value='';const feedback=$('feedback-'+index);feedback.textContent='';feedback.className='play-feedback prewrap';root.closest('.play-question')?.removeAttribute('data-result');draw();root.focus({preventScroll:true});};
      root.querySelector('[data-hangman-check]').onclick=()=>{const status=root.querySelector('.hangman-status');if(finished){status.textContent=won()?'✓ ¡Palabra descubierta!':`La respuesta era ${question.answer}.`;return;}status.textContent=`Aún faltan letras. Te quedan ${7-errors} intentos.`;};
      root.querySelectorAll('[data-hangman-letter]').forEach(button => button.onclick = () => {
        if (isChecked()) return;
        chosen.add(button.dataset.hangmanLetter);
        if (won()) answer.value = question.answer;
        else if (misses() >= 7) answer.value = '__hangman_failed__';
        if(won()||misses()>=7)recordAnswer(index,0,won(),answer.value,misses()>0);
        if (answer.value) answer.dispatchEvent(new Event('input', { bubbles: true }));
        draw();
      });
    };
    root.tabIndex = 0;
    root.setAttribute('aria-label', 'Ahorcado. Escribe una letra con el teclado.');
    root.addEventListener('keydown', event => { const key = letterKey(event.key); if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat && !isChecked() && key.length === 1 && letters.includes(key)) { event.preventDefault(); root.querySelector(`[data-hangman-letter="${key}"]:not(:disabled)`)?.click(); root.focus({ preventScroll: true }); } });
    draw();
  }

  runActivity = function (material, studentId) {
    playerAbort?.abort();
    playerAbort = new AbortController();
    const signal = playerAbort.signal;
    const m = JSON.parse(JSON.stringify(material));
    const questions = m.activity.questions;
    const pairChoices = shuffle(questions.filter(q => q.type === 'pairs').map(q => q.answer));
    const sequences = {};
    const sentenceBanks = {};
    const games = {};
    const errorBoards = {};
    const flashGrades = {};
    const practice = questions.map(() => ({parts:{},assisted:false}));
    function logAnswer({index,part=0,correct,value,assisted=false}) {
      if(checked)return;
      const log=practice[index], previous=log.parts[part];log.assisted ||= assisted;
      if(previous?.value===value && previous.correct===correct)return;
      log.parts[part]={attempts:(previous?.attempts||0)+1,firstCorrect:previous?.firstCorrect??correct,correct,value};
    }
    function gradeQuestion(index) {
      const q=questions[index],value=new FormData($('form')).get('r-'+index)||'';
      if(q.type==='flashcard')return flashGrades[index]||'unanswered';
      if(['mystery','intruder','bingo'].includes(q.type))return !games[index]?.complete?'unanswered':games[index].correct?'correct':'incorrect';
      if(puzzleTypes.includes(q.type))return !games[index]?.complete?'unanswered':games[index].correct?'correct':'incorrect';
      if(q.type==='memory')return value?'correct':'unanswered';
      if(q.type==='error') {
        const selected = errorBoards[index]?.value().selected || '';
        if (!selected || !String(value).trim()) return 'unanswered';
        if (!q.errorSegment || !q.correctedSegment) return 'pending';
        return errorValue(selected) === errorValue(q.errorSegment) && errorValue(value) === errorValue(q.correctedSegment) ? 'correct' : 'incorrect';
      }
      if(!String(value).trim())return 'unanswered';
      if(objectiveShort(q))return [q.answer,...(q.alternatives||[])].some(answer=>shortKey(value)===shortKey(answer))?'correct':'incorrect';
      if(openAnswerTypes.includes(q.type))return 'pending';
      if(sequenceTypes.includes(q.type))return touchedSequences.has(index)?sequences[index].length===q.options.length&&sequences[index].every((item,position)=>item===expectedSequence(q)[position])?'correct':'incorrect':'unanswered';
      if(q.type==='numeric'){const n=numberValue(value),s=numberValue(q.answer);return Number.isFinite(n)&&Math.abs(n-s)<=(q.tolerance||0)+Number.EPSILON*Math.max(1,Math.abs(s))*4?'correct':'incorrect';}
      if(q.type==='imagepoint'){const [x,y]=value.split(',').map(Number);return (q.target.width&&q.target.height?Math.abs(x-q.target.x)<=q.target.width/2&&Math.abs(y-q.target.y)<=q.target.height/2:Math.hypot(x-q.target.x,y-q.target.y)<=10)?'correct':'incorrect';}
      return accepts(value,q.answer,q.alternatives)?'correct':'incorrect';
    }
    function feedback(index,grade) {
      const box=$('feedback-'+index),q=questions[index];box.className='play-feedback '+(grade==='correct'?'is-correct':grade==='pending'?'is-pending':'is-incorrect');
      const selected=String(new FormData($('form')).get('r-'+index)||''),reason=q.optionFeedback?.find(row=>row.option===selected)?.explanation;
      box.innerHTML=grade==='correct'?'✓ ¡Correcto!'+(reason||q.explanation?'<div>'+rich(reason||q.explanation)+'</div>':''):grade==='pending'?'◷ Respuesta guardada. La revisa el profesor.'+(q.rubric?'<div>'+rich(q.rubric)+'</div>':''):'× Revisa tu respuesta. Puedes volver a intentarlo o consultar la solución.'+(reason?'<div>'+rich(reason)+'</div>':'');
      if(q.type==='flashcard')box.textContent={correct:'✓ Valoración guardada: la sabías.',partial:'◷ Valoración guardada: con ayuda.',incorrect:'↻ Guardada para repasar. Puedes volver a girar la tarjeta.'}[grade]||'Valoración guardada.';
      if(grade==='correct'&&sequenceTypes.includes(q.type)&&q.itemExplanations?.length)box.innerHTML+=itemReasons(q);
      document.querySelector(`[data-question="${index}"]`).dataset.result=grade;
    }
    function confirmQuestion(index) {
      if(checked)return;const grade=gradeQuestion(index),q=questions[index];if(grade==='unanswered')return;
      if(!puzzleTypes.includes(q.type)&&!['memory','hangman'].includes(q.type))logAnswer({index,correct:grade==='pending'?null:grade==='correct',value:String(new FormData($('form')).get('r-'+index)||''),assisted:q.type==='flashcard'&&flashGrades[index]!=='correct'});
      if(!puzzleTypes.includes(q.type))feedback(index,grade);
      const field=$('r-'+index);if(field&&field.type!=='hidden'&&grade!=='pending')markControl(field,grade==='correct');
      document.querySelector(`[data-question="${index}"]`)?.querySelectorAll('.play-choice').forEach(label=>{const input=label.querySelector('input');label.classList.remove('answer-right','answer-wrong');label.querySelector('.choice-result')?.remove();if(input.checked){const right=grade==='correct';markControl(label,right);label.insertAdjacentHTML('beforeend',`<b class="choice-result" aria-label="${right?'Correcta':'Incorrecta'}">${right?'✓':'×'}</b>`);}});
      if(sequenceTypes.includes(q.type))document.querySelectorAll(`#order-${index} [data-sequence-row]`).forEach((row,n)=>markControl(row,sequences[index][n]===expectedSequence(q)[n]));
      if(sequenceTypes.includes(q.type))renderSequence(index);
      if(q.type==='error')errorBoards[index]?.review(grade);
    }
    const touchedSequences = new Set(), confirmedSequences = new Set(), groupReviews = [];
    let checked = false;
    let attempt = null;
    questions.forEach((q, index) => {
      if (!sequenceTypes.includes(q.type)) return;
      sequences[index] = shuffle(q.options);
      if (sequences[index].every((item,position)=>item===expectedSequence(q)[position]) && sequences[index].length > 1) sequences[index].reverse();
    });
    const studentName = studentId ? student(studentId)?.name || 'Alumno' : '';
    modal('Ejercicios', `${questions.map((q, i) => questionMarkup(q, i, pairChoices)).join('')}<p id="activityScore" class="play-score" role="status"></p>${submit('Terminar')}`, form => {
      if (checked) return false;
      questions.forEach((q,index)=>confirmQuestion(index));
      const answers = questions.map((q, index) => String(form.get('r-' + index) || ''));
      const grades = questions.map((q,index)=>gradeQuestion(index));
      const firstGrades=grades.map((grade,i)=>grade==='pending'||grade==='unanswered'?grade:Object.values(practice[i].parts).some(p=>p.firstCorrect===false)?'incorrect':practice[i].assisted?'assisted':grade);
      attempt = { id: uid(), materialId: m.id, studentId, date: new Date().toISOString(), mode: 'with_teacher', answers, grades, firstGrades, practice, score: 0, total: questions.length, pending: 0, materialSnapshot: m.activity };
      checked = true;
      questions.forEach((q, index) => {
        const feedback = $('feedback-' + index);
        const solution = puzzleTypes.includes(q.type) ? puzzleSolution(q) : sequenceTypes.includes(q.type) ? expectedSequence(q).join(' → ') : q.type === 'imagepoint' ? 'Punto marcado por el profesor' : q.answer;
        feedback.innerHTML = rich((grades[index]==='unanswered'?'Sin responder. ':grades[index]==='pending' ? '◷ Solución orientativa: ' + q.answer : grades[index] === 'correct' ? '✓ ¡Correcto!' : '↻ Solución: ' + solution) + (q.errorSegment ? '\nFragmento que había que corregir: ' + q.errorSegment : '') + (q.explanation ? '\n\n' + q.explanation : '') + (q.rubric ? '\n\nCriterios de revisión: ' + q.rubric : '')) + itemReasons(q);
        feedback.classList.add(grades[index] === 'correct' ? 'is-correct' : grades[index] === 'pending' ? 'is-pending' : 'is-incorrect');
        document.querySelector(`[data-question="${index}"]`).dataset.result = grades[index];
        games[index]?.review?.();
        if(q.type==='error')errorBoards[index]?.review(grades[index]);
        document.querySelector(`[data-question="${index}"]`).querySelectorAll('.play-choice').forEach(label => { const input = label.querySelector('input');label.classList.remove('answer-right','answer-wrong');label.querySelector('.choice-result')?.remove(); if (input.value === q.answer || input.checked) { const right = input.value === q.answer; label.classList.add(right ? 'answer-right' : 'answer-wrong'); label.insertAdjacentHTML('beforeend', `<b class="choice-result" aria-label="${right ? 'Opción correcta' : 'Opción incorrecta'}">${right ? '✓' : '×'}</b>`); } });
        if (q.type === 'imagepoint') $('visual-' + index).insertAdjacentHTML('beforeend', `<span class="visual-solution-zone" style="left:${q.target.x}%;top:${q.target.y}%;width:${q.target.width || 20}%;height:${q.target.height || 20}%" aria-label="Zona correcta">✓</span>`);
        document.querySelector(`[data-question="${index}"]`).querySelectorAll('input,textarea,button').forEach(control => control.disabled = true);
        if (openAnswerTypes.includes(q.type) && q.type !== 'flashcard' && grades[index] === 'pending') $('review-' + index).hidden = false;
      });
      Object.keys(sequences).forEach(index => renderSequence(Number(index)));
      groupReviews.forEach(review => review());
      if (studentId) { state.activityAttempts ??= []; state.activityAttempts.push(attempt); }
      updateScore();
      $('form').querySelector('[type="submit"]').hidden = true;
      const close = $('form').querySelector('[data-action="close"]');
      if (close) {close.textContent = 'Cerrar';close.hidden=false;}
      $('form').querySelector('.play-footer .actions').insertAdjacentHTML('afterbegin', '<button type="button" id="retryActivity">Repasar errores</button>');
      $('retryActivity').onclick = () => { const retry = questions.filter((q, i) => ['incorrect','partial','unanswered'].includes(attempt.grades[i])); if (!retry.length) return notify(attempt.pending ? 'Primero revisa las respuestas pendientes.' : 'No quedan errores que repasar.'); runActivity({ ...m, title: m.title + ' · Repaso', activity: { ...m.activity, questions: retry } }, studentId); };
      actions.insertAdjacentHTML('afterbegin','<button type="button" id="showPracticeResult">Resultado</button>');
      $('showPracticeResult').onclick=showResult;
      showResult();
      return false;
    });
    $('form').noValidate = true;
    $('form').addEventListener('play:answer',event=>{logAnswer(event.detail);const {index,part,correct}=event.detail;if(correct!==null){const log=practice[index],parts=Object.values(log.parts).filter(p=>p.correct!==null),q=questions[index],reason=Number.isInteger(part)?q.itemExplanations?.[part]:'';$('feedback-'+index).className='play-feedback '+(correct?'is-correct':'is-incorrect');$('feedback-'+index).innerHTML=`${correct?'✓ Correcto.':'× Prueba de nuevo.'} ${parts.filter(p=>p.correct).length} aciertos · ${parts.filter(p=>!p.correct).length} por revisar.`+(reason?'<div>'+rich(reason)+'</div>':'');if(!correct)document.querySelector(`[data-question="${index}"] [data-show-solution]`)?.removeAttribute('hidden');}},{signal});
    $('dialog').classList.add('activity-play');
    $('dialog').addEventListener('close', () => { if (!$('dialog').open) { $('dialog').classList.remove('activity-play'); $('form').noValidate = false; playerAbort?.abort(); } }, { signal });
    const toolbar = document.createElement('div'); toolbar.className = 'step-navigation';
    toolbar.innerHTML = '<button type="button" id="previousQuestion" aria-label="Actividad anterior">←</button><span id="stepPosition" aria-live="polite"></span><button type="button" id="nextQuestion" aria-label="Actividad siguiente">→</button>';
    const content = document.createElement('div'); content.className = 'play-content';
    const sections = [...$('form').querySelectorAll('[data-question]')];
    sections[0].before(content); sections.forEach(section => content.append(section));
    const footer = document.createElement('div'); footer.className = 'play-footer';
    const score = $('activityScore'), actions = score.nextElementSibling;
    score.before(footer); footer.append(score, actions);
    actions.prepend(toolbar);actions.querySelector('[data-action="close"]').hidden=true;
    const hasPasapalabra = questions.some(question => ['pasapalabra','memory','sentence','timeline','error','crossword','dragdrop','mystery','intruder','bingo'].includes(question.type));
    let pasapalabraSolutionModal = null;
    let solutionTrigger = null;
    if (hasPasapalabra) {
      questions.forEach((question, index) => { if (question.type === 'pasapalabra') $('feedback-' + index).hidden = true; });
      pasapalabraSolutionModal = document.createElement('dialog');
      pasapalabraSolutionModal.className = 'pasapalabra-solution-popup';
      pasapalabraSolutionModal.setAttribute('aria-labelledby', 'pasapalabra-solution-title');
      pasapalabraSolutionModal.innerHTML = '<div class="pasapalabra-solution-shell"><header><div><span class="pasapalabra-solution-eyebrow">PASAPALABRA</span><h2 id="pasapalabra-solution-title">Solución del rosco</h2><p>Consulta las respuestas y vuelve al juego cuando quieras.</p></div><button type="button" class="pasapalabra-solution-close" aria-label="Cerrar solución">×</button></header><div class="pasapalabra-solution-body"></div><footer><button type="button" class="pasapalabra-solution-return">Volver al juego</button></footer></div>';
      document.body.append(pasapalabraSolutionModal);
      const closeSolution = () => pasapalabraSolutionModal.close();
      pasapalabraSolutionModal.querySelectorAll('.pasapalabra-solution-close,.pasapalabra-solution-return').forEach(button => button.addEventListener('click', closeSolution));
      pasapalabraSolutionModal.addEventListener('click', event => { if (event.target === pasapalabraSolutionModal) closeSolution(); });
      pasapalabraSolutionModal.addEventListener('close', () => { if ($('dialog').open && solutionTrigger?.isConnected) solutionTrigger.focus({ preventScroll: true }); });
      signal.addEventListener('abort', () => { if (pasapalabraSolutionModal.open) pasapalabraSolutionModal.close(); pasapalabraSolutionModal.remove(); }, { once: true });
    }
    if (questions.length === 1 && questions[0].type === 'wordsearch') {
      const dock = document.createElement('div');
      dock.className = 'wordsearch-solution-dock';
      dock.hidden = true;
      const feedback = $('feedback-0');
      feedback.hidden = true;
      dock.append(feedback);
      footer.append(dock);
    }
    if (questions.length === 1 && questions[0].type === 'pasapalabra') {
      const finish = actions.querySelector('[type="submit"]');
      const finishStack = document.createElement('div');
      finishStack.className = 'pasapalabra-finish';
      finish.before(finishStack);
      finishStack.append($('pasapalabra-position-0'), finish);
    }
    let currentStep = 0;
    const summary=document.createElement('section');summary.className='practice-result';summary.hidden=true;content.append(summary);
    function showResult(){renderSummary();summary.hidden=false;visibleQuestions().forEach(section=>section.hidden=true);toolbar.hidden=true;$('showPracticeResult').hidden=true;content.scrollTop=0;}
    function renderSummary(){if(!attempt)return;const labels={correct:'✓ Correcta',incorrect:'× Para repasar',partial:'◷ Parcialmente correcta',pending:'◷ Revisión del profesor',unanswered:'— Sin completar'};summary.innerHTML='<h2>Resultado de la práctica</h2><p>'+escape($('activityScore').textContent)+'</p><div class="practice-result-list">'+questions.map((q,i)=>`<button type="button" data-review-question="${i}" class="${attempt.grades[i]}"><span>${i+1}. ${escape(activityLabels[q.type])}</span><small>${labels[attempt.grades[i]]||labels.unanswered}${attempt.grades[i]==='correct'&&wasAssisted(i)?' · con ayuda o reintentos':''}</small><b aria-hidden="true">→</b></button>`).join('')+'</div>';summary.querySelectorAll('[data-review-question]').forEach(button=>button.onclick=()=>showQuestion(Number(button.dataset.reviewQuestion)));}
    const visibleQuestions = () => [...$('form').querySelectorAll('[data-question]')].filter(section => !section.dataset.groupMember);
    const readingTexts = new Set();
    questions.forEach((q, index) => {
      if (q.type !== 'reading') return;
      const key = JSON.stringify([q.activityGroup || 0, q.text]);
      const passage = document.querySelector(`[data-question="${index}"] .reading-passage`);
      if (readingTexts.has(key)) {
        const details = document.createElement('details'); details.className = 'reading-repeat';
        const summary = document.createElement('summary'); summary.textContent = 'Consultar el texto de esta actividad';
        passage.before(details); details.append(summary, passage);
      }
      readingTexts.add(key);
    });
    function renderView() {summary.hidden=true;if($('showPracticeResult'))$('showPracticeResult').hidden=false; const sections=visibleQuestions();currentStep=Math.max(0,Math.min(currentStep,sections.length-1));sections.forEach((section,n)=>section.hidden=n!==currentStep);toolbar.hidden=sections.length===1&&sections[0].dataset.type==='pasapalabra';$('form').querySelectorAll('.reading-repeat').forEach(details=>details.open=true);$('stepPosition').textContent=`${currentStep+1} / ${sections.length}`;$('previousQuestion').disabled=currentStep===0;$('nextQuestion').hidden=currentStep===sections.length-1;$('form').querySelector('[type="submit"]').hidden=checked||currentStep!==sections.length-1;content.scrollTop=0; }
    function showQuestion(index) { const section = document.querySelector(`[data-question="${index}"]`); currentStep = visibleQuestions().findIndex(item => item === section || item.dataset.question === section?.dataset.groupMember); renderView(); }
    $('previousQuestion').onclick = () => { currentStep--; renderView(); content.scrollTop = 0; };
    $('nextQuestion').onclick = () => {const section=visibleQuestions()[currentStep];questions.forEach((q,i)=>{const node=document.querySelector(`[data-question="${i}"]`);if(node===section||node.dataset.groupMember===section.dataset.question)confirmQuestion(i)});currentStep++;renderView();};

    function updateProgress() {
      const complete = questions.map((question, index) => {
        if (puzzleTypes.includes(question.type)) return !!games[index]?.complete;
        if (question.type === 'flashcard') return !!flashGrades[index];
        if (sequenceTypes.includes(question.type)) return touchedSequences.has(index);
        const controls = [...$('form').querySelectorAll(`[name="r-${index}"]`)];
        return controls.some(control => control.type === 'radio' ? control.checked : String(control.value || '').trim());
      });
      complete.forEach((done, index) => document.querySelector(`[data-question="${index}"]`)?.classList.toggle('is-complete', done));
      const amount = complete.filter(Boolean).length;
      if ($('playCompleted')) $('playCompleted').textContent = `${amount} de ${questions.length} completados`;
      if ($('playProgress')) $('playProgress').style.width = `${Math.round(100 * amount / questions.length)}%`;
    }

    function wasAssisted(index){return practice[index].assisted||Object.values(practice[index].parts).some(part=>part.firstCorrect===false)||['incorrect','assisted'].includes(attempt.firstGrades[index]);}
    function updateScore() {
      attempt.score = attempt.grades.filter(grade => grade === 'correct').length;
      attempt.pending = attempt.grades.filter(grade => grade === 'pending').length;
      const partial = attempt.grades.filter(grade => grade === 'partial').length;
      const assisted=attempt.grades.filter((g,i)=>g==='correct'&&wasAssisted(i)).length,unanswered=attempt.grades.filter(g=>g==='unanswered').length,incorrect=attempt.grades.filter(g=>g==='incorrect').length;
      $('activityScore').textContent = `${attempt.score}/${attempt.total} correctas.${assisted?' '+assisted+' con ayuda o reintentos.':''}${incorrect?' '+incorrect+' para repasar.':''}${unanswered?' '+unanswered+' sin completar.':''}${attempt.pending ? ' ' + attempt.pending + ' pendientes de revisión del profesor.' : ''}${partial ? ' ' + partial + ' parcialmente correctas.' : ''}`;
      renderSummary();
      if (studentId) save();
    }
    function renderSequence(index, focusPosition = null) {
      if (['sentence','timeline'].includes(questions[index].type)) {
        if (!sentenceBanks[index]) { sentenceBanks[index]=[...sequences[index]]; sequences[index]=[]; }
        const root=$('order-'+index);
        window.profesorSentenceBoard(root, {
          options:sentenceBanks[index],values:sequences[index],locked:checked,kind:questions[index].type,
          label:questions[index].type==='timeline'?(value,revealed)=>timelineLabel(value,revealed):null,
          reviewed:checked||confirmedSequences.has(index),expected:expectedSequence(questions[index]),
          onChange(values){
            sequences[index]=values;$('r-'+index).value=values.join(' → ');
            if(values.length===sentenceBanks[index].length)touchedSequences.add(index);else touchedSequences.delete(index);
            confirmedSequences.delete(index);root.closest('[data-question]').removeAttribute('data-result');$('feedback-'+index).textContent='';updateProgress();
          },
          onCheck(){confirmedSequences.add(index);touchedSequences.add(index);confirmQuestion(index);updateProgress();}
        });
        return;
      }
      const list = sequences[index], root = $('order-' + index);
      root.classList.toggle('is-dense', list.length >= 8);
      root.classList.toggle('is-very-dense', list.length > 12);
      const revealDates = checked || (questions[index].type === 'timeline' && confirmedSequences.has(index));
      if(questions[index].type==='timeline'){
        const longest=Math.max(...list.map(value=>timelineLabel(value,revealDates).length),0);
        root.style.maxWidth=`min(100%, ${Math.max(430,Math.min(960,longest*7+145))}px)`;
      }
      const expected = expectedSequence(questions[index]);
      root.innerHTML = list.map((value, position) => {const display = questions[index].type === 'timeline' ? timelineLabel(value,revealDates) : value;const result = checked || confirmedSequences.has(index);return `<div class="order-row ${result ? value === expected[position] ? 'answer-right' : 'answer-wrong' : ''}" data-sequence-row="${position}" draggable="${!checked}" tabindex="${checked ? '-1' : '0'}" aria-label="${position + 1} de ${list.length}: ${escape(display)}"><span class="order-grip" aria-hidden="true">${result ? value === expected[position] ? '✓' : '↻' : '⠿'}</span><span class="order-value"><b>${position + 1}.</b> ${escape(display)}</span><div class="order-actions"><button type="button" data-move="-1" data-pos="${position}" aria-label="Subir ${escape(display)}" ${checked || position === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="1" data-pos="${position}" aria-label="Bajar ${escape(display)}" ${checked || position === list.length - 1 ? 'disabled' : ''}>↓</button></div></div>`;}).join('') + (checked ? '' : '<div class="sequence-actions"><button type="button" class="primary" data-confirm-order>Comprobar orden</button></div>');
      $('r-' + index).value = list.join(' → ');
      if (checked) return;
      root.querySelector('[data-confirm-order]').onclick = () => { touchedSequences.add(index); confirmedSequences.add(index); updateProgress();confirmQuestion(index); };
      let picked = null;
      root.querySelectorAll('[data-sequence-row]').forEach(row => {
        const position = Number(row.dataset.sequenceRow);
        row.onclick = event => {
          if (event.target.closest('button')) return;
          if (picked === null) { picked = position; row.classList.add('selected'); return; }
          if (picked !== position) move(picked, position);
          else { picked = null; row.classList.remove('selected'); }
        };
        row.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); row.click(); } };
        row.ondragstart = event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-profesor-order-' + index, String(position)); };
        row.ondragover = event => { event.preventDefault(); row.classList.add('drag-over'); };
        row.ondragleave = () => row.classList.remove('drag-over');
        row.ondrop = event => { event.preventDefault(); row.classList.remove('drag-over'); const value = event.dataTransfer.getData('application/x-profesor-order-' + index); const source = Number(value); if (value !== '' && Number.isInteger(source)) move(source, position); };
      });
      root.querySelectorAll('[data-move]').forEach(button => button.onclick = () => move(Number(button.dataset.pos), Number(button.dataset.pos) + Number(button.dataset.move)));
      if (focusPosition !== null) root.querySelector(`[data-sequence-row="${focusPosition}"]`)?.focus();
      function move(from, to) {
        if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return;
        const [item] = list.splice(from, 1); list.splice(to, 0, item);
        touchedSequences.add(index);confirmedSequences.delete(index);document.querySelector(`[data-question="${index}"]`).removeAttribute('data-result');$('feedback-'+index).textContent='';
        renderSequence(index, to); updateProgress();
      }
    }
    Object.keys(sequences).forEach(index => renderSequence(Number(index)));
    paintActivityImages(questions, $('form'));
    questions.forEach((q, index) => {
      if (['mystery','intruder','bingo'].includes(q.type)) mountMiniGame(q,index,()=>checked,(key,result)=>{games[key]=result;updateProgress();});
      else if (puzzleTypes.includes(q.type)) mountPuzzleGame(q, index, () => checked, (key, result) => { games[key] = result; updateProgress(); });
      if (q.type === 'memory') mountMemory(q, index, () => checked);
      if (q.type === 'hangman') mountHangman(q, index, () => checked);
      const section = document.querySelector(`[data-question="${index}"]`);
      if(!['quiz','boolean','visualquiz','pairs','classify','flashcard','pasapalabra','memory','wordsearch','crossword','dragdrop','hangman','order','sentence','timeline','error','mystery','intruder','bingo'].includes(q.type)){
        const check=document.createElement('button');check.type='button';check.dataset.checkQuestion=index;check.textContent=openAnswerTypes.includes(q.type)&&q.type!=='error'&&!objectiveShort(q)?'Guardar respuesta':'Comprobar';
        check.onclick=()=>{if(q.type==='multigaps'){section.querySelectorAll('[data-multi-gap]').forEach((input,n)=>{if(input.value.trim()){const right=q.options[n].split('~').some(s=>accepts(input.value,s));markControl(input,right);recordAnswer(index,n,right,input.value.trim());}});}else if(q.type==='error'&&gradeQuestion(index)==='unanswered'){$('feedback-'+index).className='play-feedback is-incorrect';$('feedback-'+index).textContent='Selecciona el error de la oración y escribe su corrección.';}else confirmQuestion(index);};section.querySelector('.question-controls').append(check);
      }
      const solution=document.createElement('button');
      solution.type='button';solution.dataset.showSolution=index;solution.textContent='Ver solución';solution.hidden=q.type==='flashcard';solution.className='play-solution-link';
      solution.onclick=()=>{
        practice[index].assisted=true;
        if (['pasapalabra','memory','sentence','timeline','error','crossword','dragdrop','mystery','intruder','bingo'].includes(q.type) && pasapalabraSolutionModal) {
          if(['mystery','intruder','bingo'].includes(q.type)){
            pasapalabraSolutionModal.querySelector('.pasapalabra-solution-eyebrow').textContent=activityLabels[q.type].toUpperCase();
            pasapalabraSolutionModal.querySelector('h2').textContent='Solución del juego';
            const rows=q.type==='bingo'?q.options.map(row=>row.split('|').map(part=>part.trim())):[[q.type==='mystery'?'Concepto oculto':'El intruso',q.answer]];
            pasapalabraSolutionModal.querySelector('.pasapalabra-solution-body').innerHTML='<ol class="puzzle-solution-list">'+rows.map(([label,answer])=>'<li><strong>'+rich(label)+'</strong> → '+rich(answer)+'</li>').join('')+'</ol>'+(q.explanation?'<p>'+rich(q.explanation)+'</p>':'');
            solutionTrigger=solution;pasapalabraSolutionModal.showModal();pasapalabraSolutionModal.querySelector('.pasapalabra-solution-close').focus();return;
          }
          if(['error','crossword','dragdrop'].includes(q.type)){
            const rows=q.type==='error'?[[q.errorSegment||'Fragmento',q.correctedSegment||q.answer]]:puzzleRows(q.type,q.options);
            pasapalabraSolutionModal.querySelector('.pasapalabra-solution-eyebrow').textContent=activityLabels[q.type].toUpperCase();
            pasapalabraSolutionModal.querySelector('h2').textContent='Solución del ejercicio';
            pasapalabraSolutionModal.querySelector('.pasapalabra-solution-body').innerHTML='<ol class="puzzle-solution-list">'+rows.map(row=>'<li><strong>'+rich(row[0])+'</strong> → '+rich(row[1])+'</li>').join('')+'</ol>'+(q.explanation?'<p>'+rich(q.explanation)+'</p>':'')+itemReasons(q);
            solutionTrigger=solution;pasapalabraSolutionModal.showModal();pasapalabraSolutionModal.querySelector('.pasapalabra-solution-close').focus();return;
          }
          if(['sentence','timeline'].includes(q.type)){
            pasapalabraSolutionModal.querySelector('.pasapalabra-solution-eyebrow').textContent=q.type==='timeline'?'LÍNEA TEMPORAL':'CONSTRUYE LA FRASE';
            pasapalabraSolutionModal.querySelector('h2').textContent=q.type==='timeline'?'Los acontecimientos en orden':'La frase en orden';
            pasapalabraSolutionModal.querySelector('.pasapalabra-solution-body').innerHTML=(q.type==='timeline'?'<ol class="timeline-solution-list">'+expectedSequence(q).map(value=>'<li>'+rich(value)+'</li>').join('')+'</ol>':'<p class="sentence-solution-text">'+rich(expectedSequence(q).join(' '))+'</p>')+(q.explanation?'<p>'+rich(q.explanation)+'</p>':'')+itemReasons(q);
            solutionTrigger=solution;pasapalabraSolutionModal.showModal();pasapalabraSolutionModal.querySelector('.pasapalabra-solution-close').focus();return;
          }
          const isMemory = q.type === 'memory';
          pasapalabraSolutionModal.querySelector('.pasapalabra-solution-eyebrow').textContent = isMemory ? 'MEMORY' : 'PASAPALABRA';
          pasapalabraSolutionModal.querySelector('h2').textContent = isMemory ? 'Todas las parejas' : 'Solución del rosco';
          if (isMemory) {
            pasapalabraSolutionModal.querySelector('.pasapalabra-solution-body').innerHTML = '<ol class="memory-solutions">' + validateMemory(q.options).map(pair => '<li><strong>'+rich(pair[0])+'</strong><span>↔</span><strong>'+rich(pair[1])+'</strong></li>').join('') + '</ol>' + (q.explanation ? '<p>'+rich(q.explanation)+'</p>' : '');
            solutionTrigger=solution;pasapalabraSolutionModal.showModal();pasapalabraSolutionModal.querySelector('.pasapalabra-solution-close').focus();return;
          }
          const rows=puzzleRows('pasapalabra',q.options);
          pasapalabraSolutionModal.querySelector('.pasapalabra-solution-body').innerHTML=
            '<ol class="pasapalabra-solution-list">'+rows.map(([letter,clue,answer])=>`<li><span class="pasapalabra-solution-letter">${escape(letter)}</span><div><strong>${escape(answer)}</strong><p>${rich(clue)}</p></div></li>`).join('')+'</ol>'+
            (q.explanation?'<div class="pasapalabra-solution-explanation"><strong>Explicación</strong><p>'+rich(q.explanation)+'</p></div>':'')+itemReasons(q);
          solutionTrigger=solution;
          pasapalabraSolutionModal.showModal();
          pasapalabraSolutionModal.querySelector('.pasapalabra-solution-close').focus();
          return;
        }
        const model=q.type==='memory'?validateMemory(q.options).map(pair=>pair.join(' → ')).join('\n'):q.type==='wordsearch'?buildWordSearch(puzzleRows(q.type,q.options)).placements.map(p=>p.word+': fila '+(p.row+1)+', columna '+(p.col+1)+' → fila '+(p.endRow+1)+', columna '+(p.endCol+1)).join('\n'):puzzleTypes.includes(q.type)?puzzleSolution(q):sequenceTypes.includes(q.type)?expectedSequence(q).join(' → '):q.answer;
        $('feedback-'+index).innerHTML='<strong>Solución orientativa</strong><div>'+rich(model)+'</div>'+(q.explanation?'<div>'+rich(q.explanation)+'</div>':'')+itemReasons(q);
        const dock=$('feedback-'+index).closest('.wordsearch-solution-dock');
        if(dock){$('feedback-'+index).hidden=false;dock.hidden=false;}
      };
      (q.type==='pasapalabra'?section.querySelector('.pasapalabra-meta-actions'):q.type==='wordsearch'&&questions.length===1?footer:section).append(solution);
      if (q.type === 'wordsearch') solution.addEventListener('click', () => section.querySelector('#puzzle-' + index)?.revealWordSearchSolution?.());
      if(!puzzleTypes.includes(q.type))section.addEventListener('click',()=>queueMicrotask(()=>{if(section.dataset.result==='incorrect'||section.dataset.result==='pending')solution.hidden=false;}),{signal});
      section.querySelectorAll('input:not([type="radio"]):not([type="hidden"])').forEach(input=>{
        if(['multigaps','pasapalabra','crossword','mystery','intruder','bingo'].includes(q.type))return;
        input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();confirmQuestion(index);if(section.dataset.result==='incorrect')solution.hidden=false;}},{signal});
        input.addEventListener('input',()=>{input.classList.remove('answer-right','answer-wrong');input.removeAttribute('aria-invalid');},{signal});
      });
      if (['gaps','multigaps'].includes(q.type) && q.wordBank?.length) {
        const inputs = [...section.querySelectorAll(q.type === 'gaps' ? '.play-gap-line input' : '[data-multi-gap]')];
        let focused = inputs[0]; inputs.forEach(input => input.addEventListener('focus', () => focused = input));
        const bank = document.createElement('div'); bank.className = 'word-bank'; bank.setAttribute('aria-label','Banco de palabras');
        bank.innerHTML = `<span>Palabras de apoyo</span>${shuffle(q.wordBank).map(word => `<button type="button" data-bank-word="${escape(word)}">${escape(word)}</button>`).join('')}`;
        section.querySelector('.question-controls').append(bank);
        bank.querySelectorAll('button').forEach(button => button.onclick = () => { if (checked || !focused) return; focused.value = button.dataset.bankWord; focused.dispatchEvent(new Event('input',{bubbles:true})); const next = inputs.find(input => !input.value); (next || focused).focus({preventScroll:true}); });
      }
      const timer = section.querySelector('[data-timer]');
      if (timer) {
        let running = false, elapsed = 0, started = 0;
        timer.onclick = () => { if (checked) return; if (running) elapsed += Date.now() - started; else started = Date.now(); running = !running; timer.textContent = running ? 'Pausar' : 'Continuar'; timer.setAttribute('aria-label', running ? 'Pausar cronómetro' : 'Continuar cronómetro'); };
        const tick = setInterval(() => { if (checked && running) { elapsed += Date.now() - started; running = false; } const seconds = Math.floor((elapsed + (running ? Date.now() - started : 0)) / 1000); const output = $('timer-' + index); if (output) output.textContent = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`; }, 500);
        signal.addEventListener('abort', () => clearInterval(tick), { once: true });
      }
      if (q.type === 'gaps') $('r-' + index).style.setProperty('--gap-width', `${Math.min(280, Math.max(85, q.answer.length * 10 + 35))}px`);
      if (q.type === 'problem') section.querySelectorAll('[data-problem-step]').forEach(input => input.oninput = () => { const inputs = [...section.querySelectorAll('[data-problem-step]')]; $('r-' + index).value = inputs[3].value.trim() ? inputs.map((control, n) => `${['Datos','Planteamiento','Cálculos','Respuesta'][n]}: ${control.value}`).join('\n') : ''; });
      if(q.type==='error'){
        errorBoards[index]=window.profesorErrorBoard($('error-'+index),{
          text:errorExample(q.prompt),
          onChange(value){if(checked)return;$('r-'+index).value=value.correction;section.removeAttribute('data-result');$('feedback-'+index).textContent='';updateProgress();},
          onCheck(){if(!checked)confirmQuestion(index);}
        });
      }
      let hintsUsed = 0;
      section.querySelector('[data-hint]')?.addEventListener('click', event => { if (checked || hintsUsed >= q.hints.length) return;practice[index].assisted=true;$('hints-' + index).insertAdjacentHTML('beforeend', `<li>${rich(q.hints[hintsUsed++])}</li>`); event.currentTarget.disabled = hintsUsed === q.hints.length; });
      section.querySelector('[data-zoom]')?.addEventListener('click', event => { const image = $('visual-' + index); image.classList.toggle('zoomed'); event.currentTarget.textContent = image.classList.contains('zoomed') ? 'Reducir imagen' : 'Ampliar imagen'; });
      section.querySelector('[data-highlight]')?.addEventListener('click', () => { const selection = window.getSelection(); if (!selection.rangeCount || selection.isCollapsed) return; const range = selection.getRangeAt(0), passage = section.querySelector('.reading-passage'); if (!passage.contains(range.commonAncestorContainer) || range.cloneContents().querySelector?.('button')) return; const mark = document.createElement('mark'); try { range.surroundContents(mark); selection.removeAllRanges(); } catch (_) { /* A selection spanning existing highlights can be selected again in smaller portions. */ } });
      if (q.type === 'flashcard') {
        $('flip-' + index).onclick = () => {
          if (checked) return;
          const flipped = $('flip-' + index).getAttribute('aria-pressed') !== 'true';
          $('flip-' + index).setAttribute('aria-pressed', String(flipped));
          $('flip-' + index).innerHTML = flashcardFace(flipped ? q.answer : q.prompt,flipped);
          $('flash-help-' + index).textContent = flipped ? '¿Cómo te ha ido? Elige una opción para guardar tu valoración.' : 'Piensa la respuesta y gira la tarjeta para comprobarla.';
          $('flash-assess-' + index).hidden = !flipped;
        };
      }
      if (q.type === 'imagepoint') {
        const box = $('visual-' + index);
        const mark = (x, y) => {
          x = Math.max(0, Math.min(100, Math.round(x))); y = Math.max(0, Math.min(100, Math.round(y)));
          $('r-' + index).value = `${x},${y}`;
          box.querySelector('.visual-target-marker')?.remove();
          box.insertAdjacentHTML('beforeend', `<span class="visual-target-marker" style="left:${x}%;top:${y}%"></span>`);
          $('point-status-' + index).textContent = `Punto marcado: ${x}% horizontal, ${y}% vertical. Puedes ajustarlo con las flechas.`;
        };
        box.onclick = event => { if (checked || event.target.tagName !== 'IMG') return; const rect = event.target.getBoundingClientRect(); mark(100 * (event.clientX - rect.left) / rect.width, 100 * (event.clientY - rect.top) / rect.height); };
        box.onkeydown = event => { if (checked || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); const [x, y] = ($('r-' + index).value || '50,50').split(',').map(Number); mark(x + (event.key === 'ArrowRight' ? 2 : event.key === 'ArrowLeft' ? -2 : 0), y + (event.key === 'ArrowDown' ? 2 : event.key === 'ArrowUp' ? -2 : 0)); };
      }
    });
    $('form').querySelectorAll('[data-flash]').forEach(button => button.onclick = () => {
      const index = Number(button.dataset.index);
      flashGrades[index] = button.dataset.flash;
      $('r-' + index).value = {correct:'La sabía',partial:'Con ayuda',incorrect:'Necesito repasarla'}[button.dataset.flash];
      $('flash-assess-' + index).querySelectorAll('button').forEach(option => {option.classList.toggle('selected', option === button);option.setAttribute('aria-pressed',String(option === button));});
      updateProgress();
      confirmQuestion(index);
    });
    $('form').querySelectorAll('input[type="radio"]').forEach(input => input.onchange = () => {
      if (!input.checked) return;
      const index = Number(input.name.slice(2));
      if (questions[index].type !== 'pairs') return;
      questions.forEach((q, other) => { if (other !== index && q.type === 'pairs' && (q.activityGroup || 0) === (questions[index].activityGroup || 0)) { const previous = [...document.querySelectorAll(`input[name="r-${other}"]`)].find(option => option.value === input.value && option.checked); if (previous) previous.checked = false; } });
    });
    questions.forEach((q, index) => {
      if (openAnswerTypes.includes(q.type) && q.type !== 'flashcard') $('grade-' + index).onchange = () => { if (!attempt) return; attempt.grades[index] = $('grade-' + index).value; const grade = attempt.grades[index]; const section = document.querySelector(`[data-question="${index}"]`); section.dataset.result = grade; $('feedback-' + index).className = 'play-feedback prewrap ' + (grade === 'correct' ? 'is-correct' : grade === 'pending' ? 'is-pending' : 'is-incorrect'); updateScore(); };
    });
    for (const kind of ['pairs','classify']) {
      const indices = questions.flatMap((q, index) => q.type === kind ? [index] : []);
      const groups = Object.values(indices.reduce((groups,index)=>{const key=String(questions[index].activityGroup||0)+(kind==='classify'?'|'+JSON.stringify([...questions[index].options].sort()):'');(groups[key]??=[]).push(index);return groups;},{}));
      groups.filter(group => group.length >= (kind === 'pairs' ? 2 : 1)).forEach(group => {
        const first = group[0], section = document.querySelector(`[data-question="${first}"]`), root = section.querySelector('.question-controls');
        const targets = kind === 'pairs' ? shuffle(group.map(index => questions[index].answer)) : questions[first].options;
        section.querySelector('h3').textContent = kind === 'pairs' ? 'Relaciona cada concepto con su pareja' : 'Clasifica los elementos en su grupo';
        group.slice(1).forEach(index => { const member = document.querySelector(`[data-question="${index}"]`); member.dataset.groupMember = String(first); member.hidden = true; });
        const boardRoot = document.createElement('div'); root.replaceChildren(boardRoot);
        group.forEach(index => { const old = document.querySelector(`[name="r-${index}"]`); if (old) document.querySelector(`[data-question="${index}"] .question-controls`).innerHTML = ''; root.insertAdjacentHTML('beforeend', `<input type="hidden" name="r-${index}" id="r-${index}">`); });
        const board = placementBoard(boardRoot, group.map(index => questions[index].prompt), targets, () => checked, values => { values.forEach((value,n)=>{$('r-'+group[n]).value=value===null?'':targets[value];if(value!==null){confirmQuestion(group[n]);}});board.review(group.map(index=>questions[index].answer));updateProgress(); }, kind === 'pairs');
        groupReviews.push(() => { board.review(group.map(index => questions[index].answer)); group.slice(1).forEach(index => { const feedback = $('feedback-' + index); const copy = document.createElement('p'); copy.className = feedback.className; copy.textContent = questions[index].prompt + ': ' + feedback.textContent; root.append(copy); }); });
      });
    }
    $('form').addEventListener('input', updateProgress, { signal });
    $('form').addEventListener('change', updateProgress, { signal });
    $('form').addEventListener('change',event=>{if(event.target.matches('input[type="radio"]'))confirmQuestion(Number(event.target.name.slice(2)))},{signal});
    $('form').addEventListener('input',event=>{const match=event.target.name?.match(/^r-(\d+)$/);if(match&&['memory','hangman'].includes(questions[+match[1]].type))confirmQuestion(+match[1]);},{signal});
    const paint=()=>content.querySelectorAll('.play-question').forEach(section=>profesorText.paint(section));
    const observer=new MutationObserver(paint);observer.observe($('form'),{childList:true,subtree:true});signal.addEventListener('abort',()=>observer.disconnect(),{once:true});paint();
    $('form').addEventListener('click', () => queueMicrotask(() => { if (!signal.aborted) updateProgress(); }), { signal });
    renderView();
    updateProgress();
  };
  const originalReviewAttempt=reviewAttempt;
  reviewAttempt=function(id){originalReviewAttempt(id);const attempt=state.activityAttempts.find(item=>item.id===id);if(attempt){$('form').querySelectorAll('section.block').forEach((section,n)=>{const q=attempt.materialSnapshot.questions[n];if(q){if(q.explanation)section.insertAdjacentHTML('beforeend','<div>'+rich(q.explanation)+'</div>');section.insertAdjacentHTML('beforeend',itemReasons(q));}});}profesorText.paint($('form'));};
})();
