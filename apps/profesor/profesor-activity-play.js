/* Interactive material player. The saved activity format remains version 1. */
(function () {
  const shuffle = values => values.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(item => item.value);
  const normalize = value => String(value || '').trim().toLocaleLowerCase('es').replace(/\s+/g, ' ');
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
    const root = $('puzzle-' + index), rows = puzzleRows('crossword', question.options);
    const words = rows.map(([word]) => puzzleWord(word)), board = buildCrossword(words);
    const entries = rows.map(([word, clue], n) => {
      const key = puzzleWord(word), vertical = key === board.anchor;
      const placed = board.placed.find(p => p.word === key);
      const cells = [...key].map((_, k) => vertical ? `${k}-${board.left}` : `${placed.row}-${board.left - placed.col + k}`);
      return { key, clue, cells, vertical, number: n + 1 };
    });
    let active = 0;
    const starts = new Map(); entries.forEach(e => starts.set(e.cells[0], [...(starts.get(e.cells[0]) || []), e.number]));
    root.innerHTML = `<p class="play-hint">Elige una pista. Escribe seguido; usa las flechas para cambiar de casilla.</p><div class="crossword-layout"><div class="puzzle-grid" style="--puzzle-size:${board.width}">${board.grid.flatMap((row, r) => row.map((letter, c) => letter ? `<label class="cross-cell"><small>${(starts.get(`${r}-${c}`) || []).join('/')}</small><input data-puzzle-cell="${r}-${c}" maxlength="1" autocomplete="off" aria-label="Fila ${r + 1}, columna ${c + 1}"></label>` : '<span class="blank"></span>')).join('')}</div><div class="puzzle-clues">${entries.map((e, n) => `<button type="button" data-clue="${n}">${e.number}. ${e.vertical ? '↓' : '→'} ${escape(e.clue)} <small>(${e.key.length})</small></button>`).join('')}<button type="button" data-letter-hint>Revelar una letra</button><p class="play-progress" role="status"></p></div></div>`;
    const cells = [...root.querySelectorAll('[data-puzzle-cell]')];
    const cell = key => root.querySelector(`[data-puzzle-cell="${key}"]`);
    let hinted = 0;
    const helped=new Set();
    function activate(n, focus = true) { active = n; cells.forEach(input => input.parentElement.classList.toggle('active', entries[n].cells.includes(input.dataset.puzzleCell))); root.querySelectorAll('[data-clue]').forEach(button => button.classList.toggle('selected', Number(button.dataset.clue) === n)); if (focus) cell(entries[n].cells[0]).focus({ preventScroll: true }); }
    function update() {
      entries.forEach((entry,n)=>{const value=entry.cells.map(key=>cell(key).value).join(''),clue=root.querySelector(`[data-clue="${n}"]`);clue.querySelector('[data-clue-result]')?.remove();if(value.length===entry.key.length){const right=value===entry.key;markControl(clue,right);clue.insertAdjacentHTML('beforeend',`<b data-clue-result aria-label="${right?'Correcta':'Incorrecta'}"> ${right?'✓':'×'}</b>`);recordAnswer(index,n,right,value,helped.has(n));}else{clue.classList.remove('answer-right','answer-wrong');clue.removeAttribute('aria-invalid');}});
      const correct = cells.every(input => { const [r, c] = input.dataset.puzzleCell.split('-').map(Number); return input.value === board.grid[r][c]; });
      $('r-' + index).value = cells.map(input => input.value || '_').join('');
      root.querySelector('[role="status"]').textContent = `${cells.filter(input => input.value).length}/${cells.length} casillas · ${hinted} letras de ayuda`;
      report(index, { complete: cells.every(input => input.value), correct, answer: $('r-' + index).value, review: () => cells.forEach(input => { const [r,c] = input.dataset.puzzleCell.split('-').map(Number); input.classList.add(input.value === board.grid[r][c] ? 'answer-right' : 'answer-wrong'); input.title = `Solución: ${board.grid[r][c]}`; }) });
    }
    cells.forEach(input => {
      input.onfocus = () => { input.select(); if (!entries[active].cells.includes(input.dataset.puzzleCell)) activate(entries.findIndex(e => e.cells.includes(input.dataset.puzzleCell)), false); };
      input.oninput = () => { input.value = letterKey(input.value).replace(/[^A-ZÑ]/g, '').slice(-1); update(); const sequence = entries[active].cells, position = sequence.indexOf(input.dataset.puzzleCell); if (input.value && sequence[position + 1]) cell(sequence[position + 1]).focus({ preventScroll: true }); };
      input.onkeydown = event => {
        if (isChecked()) return;
        const [r, c] = input.dataset.puzzleCell.split('-').map(Number);
        const deltas = { ArrowLeft: [0,-1], ArrowRight: [0,1], ArrowUp: [-1,0], ArrowDown: [1,0] };
        if (deltas[event.key]) { event.preventDefault(); const [dr, dc] = deltas[event.key]; cell(`${r + dr}-${c + dc}`)?.focus({ preventScroll: true }); }
        if (event.key === 'Backspace' && !input.value) { const sequence = entries[active].cells, previous = sequence[sequence.indexOf(input.dataset.puzzleCell) - 1]; if (previous) cell(previous).focus({ preventScroll: true }); }
      };
      input.onpaste = event => { if (isChecked()) return; event.preventDefault(); const sequence = entries[active].cells, start = sequence.indexOf(input.dataset.puzzleCell); [...letterKey(event.clipboardData.getData('text')).replace(/[^A-ZÑ]/g, '')].forEach((letter, offset) => { if (sequence[start + offset]) cell(sequence[start + offset]).value = letter; }); update(); };
    });
    root.querySelectorAll('[data-clue]').forEach(button => button.onclick = () => activate(Number(button.dataset.clue)));
    root.querySelector('[data-letter-hint]').onclick = () => { if (isChecked()) return; const entry = entries[active], position = entry.cells.findIndex((key, n) => cell(key).value !== entry.key[n]); if (position >= 0) {helped.add(active);recordAnswer(index,'hint-'+active,null,'revealed',true);cell(entry.cells[position]).value = entry.key[position]; hinted++; update(); } };
    activate(0, false); update();
  }
  const baseValidate = validateActivityQuestions;
  validateActivityQuestions = function (questions, requireImages = true) {
    const cleaned = baseValidate(questions, requireImages);
    return cleaned.map((q, i) => {
      const source = questions[i];
      for (const [key, limit] of [['explanation', 1500], ['rubric', 1000], ['unit', 30], ['errorSegment', 200]]) {
        if (source[key] != null && (typeof source[key] !== 'string' || source[key].length > limit)) throw Error(`Revisa ${key} en el ejercicio ${i + 1}.`);
        if (source[key]?.trim()) q[key] = source[key].trim();
      }
      if (q.errorSegment && !q.prompt.includes(q.errorSegment)) throw Error('El fragmento erróneo debe aparecer en el enunciado.');
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
  mountMemory = function (q, index, isChecked) {
    const pairs = validateMemory(q.options), cards = shuffle(pairs.flatMap((pair, id) => pair.map(label => ({ id, label }))));
    const root = $('memory-' + index), answer = $('r-' + index), status = $('memory-status-' + index);
    let opened = [], moves = 0, busy = false;
    const matched = new Set();
    function draw() {
      root.style.setProperty('--memory-columns', cards.some(card => card.label.length > 40) ? 2 : cards.length <= 6 ? 3 : 4);
      root.innerHTML = cards.map((card, n) => `<button type="button" class="memory-card ${matched.has(card.id) ? 'matched' : ''} ${opened.includes(n) ? 'revealed' : ''}" style="--pair-hue:${card.id * 47 + 150}" data-card="${n}" aria-label="${opened.includes(n) || matched.has(card.id) ? escape(card.label) : `Tarjeta ${n + 1}`}" ${matched.has(card.id) ? 'disabled' : ''}>${opened.includes(n) || matched.has(card.id) ? escape(card.label) : '<span aria-hidden="true">?</span>'}${matched.has(card.id) ? '<small>✓ Pareja</small>' : ''}</button>`).join('');
      status.textContent = `${matched.size}/${pairs.length} parejas · ${moves} intentos`;
      root.querySelectorAll('[data-card]').forEach(button => button.onclick = () => {
        const n = Number(button.dataset.card);
        if (busy || isChecked() || opened.includes(n) || matched.has(cards[n].id)) return;
        opened.push(n);
        if (opened.length === 2) {
          moves++;
          if (cards[opened[0]].id === cards[opened[1]].id) { recordAnswer(index,cards[n].id,true,'matched');matched.add(cards[n].id); opened = []; if (matched.size === pairs.length) { answer.value = 'Completado'; answer.dispatchEvent(new Event('input', { bubbles: true })); } }
          else { opened.forEach(pos=>recordAnswer(index,cards[pos].id,false,'miss-'+moves));busy = true; setTimeout(() => { if (!root.isConnected) return; opened = []; busy = false; draw(); }, 950); }
        }
        draw();
        if(busy)root.querySelectorAll('.memory-card.revealed').forEach(card=>{card.classList.add('answer-wrong');card.insertAdjacentHTML('beforeend','<small>× Otra pareja</small>')});
      });
    }
    draw();
  };
  mountPuzzleGame = function (question, index, isChecked, report) {
    if (question.type === 'crossword') return mountCrossword(question, index, isChecked, report);
    if (question.type === 'dragdrop' && new Set(question.options.map(value => value.split('|')[1].trim())).size < question.options.length) {
      const root = $('puzzle-' + index), rows = puzzleRows('dragdrop', question.options), targets = [...new Set(rows.map(row => row[1]))];
      const board = placementBoard(root, rows.map(row => row[0]), targets, isChecked, assignments => {
        const values = assignments.map(n => n === null ? '' : targets[n]);
        $('r-' + index).value = values.join(' | ');
        board.review(rows.map(row=>row[1]));
        values.forEach((value,n)=>{if(value)recordAnswer(index,n,value===rows[n][1],value)});
        report(index, { complete: values.every(Boolean), correct: values.every((value, n) => value === rows[n][1]), answer: $('r-' + index).value, review: () => board.review(rows.map(row => row[1])) });
      });
      return;
    }
    if (question.type === 'multigaps') {
      const root = $('puzzle-' + index), answer = $('r-' + index), solutions = puzzleRows('multigaps', question.options);
      const parts = question.prompt.split('___');
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
      const values = Array(rows.length).fill('');
      const outcomes=Array(rows.length).fill(null);
      let active = 0, focusInput = false;
      const passed = new Set();
      const draw = () => {
        const completed = values.filter(Boolean).length;
        root.innerHTML = `<div class="rosco-layout"><div class="pasapalabra-wheel" aria-label="Rosco de Pasapalabra">${rows.map(([letter],position)=>{const angle=position/rows.length*Math.PI*2-Math.PI/2;const status=outcomes[position]===true?'correct':outcomes[position]===false?'incorrect':passed.has(position)?'passed':'';return `<button type="button" style="--x:${50+43*Math.cos(angle)}%;--y:${50+43*Math.sin(angle)}%" class="${position===active?'active':''} ${status}" data-letter="${position}" aria-label="Letra ${escape(letter)}: ${outcomes[position]===true?'correcta':outcomes[position]===false?'incorrecta':passed.has(position)?'pasada':'pendiente'}">${escape(letter)}${outcomes[position]!==null?`<small>${outcomes[position]?'✓':'×'}</small>`:''}</button>`}).join('')}<div class="rosco-center"><strong>${outcomes.filter(v=>v===true).length}/${rows.length}</strong><span>aciertos</span></div></div><div class="pasapalabra-card"><span>${letterKey(rows[active][2]).startsWith(letterKey(rows[active][0]))?'Empieza por':'Contiene'} ${escape(rows[active][0])}</span><p>${rich(rows[active][1])}</p><label>Tu respuesta<input id="pasapalabra-input-${index}" value="${escape(values[active])}" autocomplete="off" maxlength="60"></label><div><button type="button" data-pass>Pasapalabra</button><button type="button" class="primary" data-answer>Confirmar</button></div>${completed===rows.length&&outcomes.some(v=>v===false)?'<button type="button" data-review-rosco>Volver a los fallos</button>':''}</div></div><p class="play-progress" role="status">${outcomes.filter(v=>v===true).length} correctas · ${outcomes.filter(v=>v===false).length} incorrectas · ${rows.length-completed} pendientes</p>`;
        root.querySelectorAll('[data-letter]').forEach(button => button.onclick = () => { if (!isChecked()) { active = Number(button.dataset.letter); draw(); } });
        const input = root.querySelector(`#pasapalabra-input-${index}`);
        input.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); saveAnswer(); } };
        root.querySelector('[data-answer]').onclick = saveAnswer;
        root.querySelector('[data-review-rosco]')?.addEventListener('click',()=>{active=Math.max(0,outcomes.findIndex(v=>v===false));focusInput=true;draw();});
        root.querySelector('[data-pass]').onclick = () => { if (isChecked()) return; if (!values[active]) passed.add(active); const next = Array.from({length:rows.length}, (_, n) => (active + n + 1) % rows.length).find(n => !values[n]); active = next ?? (active + 1) % rows.length; focusInput = true; draw(); };
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
        report(index, { complete, correct, answer: answer.value, review: () => root.querySelectorAll('[data-letter]').forEach((button, n) => { const right = accepts(values[n], rows[n][2]); button.classList.remove('correct','incorrect');button.classList.add(right ? 'correct' : 'incorrect'); button.setAttribute('aria-label', `${rows[n][0]}: ${right ? 'correcta' : 'incorrecta'}`);button.querySelector('small')?.remove();button.innerHTML += `<small>${right ? '✓' : '×'}</small>`; }) });
        draw();
      };
      draw();
      return;
    }
    if (question.type === 'wordsearch') {
      originalPuzzleGame(question, index, isChecked, report);
      const root = $('puzzle-' + index);
      const status = document.createElement('p');
      status.className = 'play-progress';
      status.setAttribute('role', 'status');
      root.after(status);
      let before = 0;
      let misses=0;const foundWords=new Set();
      let start = null, end = null, suppressClick = false;
      root.addEventListener('pointerdown', event => { const button = event.target.closest('[data-cell]'); if (!button || isChecked()) return; start = Number(button.dataset.cell); end = start; });
      root.addEventListener('pointermove', event => {
        if (start === null || isChecked()) return;
        const button = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-cell]');
        if (!button || !root.contains(button)) return;
        end = Number(button.dataset.cell);
        const size = Math.sqrt(root.querySelectorAll('[data-cell]').length), ar = Math.floor(start / size), ac = start % size, br = Math.floor(end / size), bc = end % size;
        const valid = ar === br || ac === bc || Math.abs(ar - br) === Math.abs(ac - bc), path = [];
        if (valid) for (let n = 0; n <= Math.max(Math.abs(br - ar), Math.abs(bc - ac)); n++) path.push((ar + Math.sign(br - ar) * n) * size + ac + Math.sign(bc - ac) * n);
        root.querySelectorAll('[data-cell]').forEach(cell => cell.classList.toggle('trail', path.includes(Number(cell.dataset.cell))));
        event.preventDefault();
      });
      root.addEventListener('pointerup', () => {
        if (start !== null && end !== start) { const first = start, last = end; root.querySelector(`[data-cell="${first}"]`)?.click(); root.querySelector(`[data-cell="${last}"]`)?.click(); suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
        start = end = null;
      });
      root.addEventListener('pointercancel', () => { start = end = null; root.querySelectorAll('.trail').forEach(cell => cell.classList.remove('trail')); });
      root.addEventListener('click', event => { if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
      root.querySelector('.puzzle-help').textContent = 'Arrastra desde la primera hasta la última letra, o pulsa ambos extremos.';
      root.addEventListener('click', event => {
        if (!event.target.closest('[data-cell]') || isChecked()) return;
        const found = root.querySelectorAll('.puzzle-word-list .found').length;
        if(found>before)root.querySelectorAll('.puzzle-word-list span').forEach((word,n)=>{if(word.classList.contains('found')&&!foundWords.has(n)){foundWords.add(n);recordAnswer(index,n,true,question.options[n]);}});
        else if(!root.querySelector('.puzzle-grid .picked'))recordAnswer(index,'selection',null,'miss-'+(++misses),true);
        status.textContent = found > before ? `¡Encontrada! ${found} de ${question.options.length} palabras.` : root.querySelector('.puzzle-grid .picked') ? 'Primera letra seleccionada: pulsa la última.' : 'Esa línea no forma una palabra pendiente. Prueba otra.';
        before = found;
      });
      return;
    }
    if (question.type !== 'dragdrop') return originalPuzzleGame(question, index, isChecked, report);
    const rows = puzzleRows('dragdrop', question.options);
    const root = $('puzzle-' + index);
    const answer = $('r-' + index);
    const assignments = Array(rows.length).fill(null);
    let selected = null;
    const displayOrder = shuffle(rows.map((_, n) => n));

    function update() {
      const complete = assignments.every(value => value !== null);
      answer.value = assignments.map((source, target) => `${rows[target][1]}: ${source === null ? '—' : rows[source][0]}`).join(' · ');
      report(index, { complete, correct: complete && assignments.every((source, target) => source === target), answer: answer.value, review: () => root.querySelectorAll('[data-target]').forEach((button, target) => { const right = assignments[target] === target; button.classList.add(right ? 'answer-right' : 'answer-wrong'); button.textContent = `${right ? '✓' : '↻'} ${button.textContent}`; }) });
      $('drag-status-' + index).textContent = `${assignments.filter(value => value !== null).length} de ${rows.length} colocados`;
      root.querySelectorAll('[data-target]').forEach((button,target)=>{if(assignments[target]!==null){const right=assignments[target]===target;markControl(button,right);button.textContent=(right?'✓ ':'× ')+rows[assignments[target]][0];recordAnswer(index,target,right,String(assignments[target]));}});
    }
    function place(source, target) {
      if (isChecked() || source === null || !Number.isInteger(source) || source < 0 || source >= rows.length) return;
      const previous = assignments.indexOf(source);
      if (previous !== -1) assignments[previous] = null;
      assignments[target] = source;
      selected = null;
      draw();
      root.querySelector(`[data-target="${target}"]`)?.focus();
    }
    function draw() {
      root.innerHTML = `<p class="play-hint">Arrastra una pieza a su destino. En móvil o con teclado, toca la pieza y después el destino.</p>
        <div class="drag-items" aria-label="Piezas disponibles">${displayOrder.map(n => `<button type="button" class="drag-item ${selected === n ? 'selected' : ''} ${assignments.includes(n) ? 'assigned' : ''}" data-item="${n}" draggable="true" aria-pressed="${selected === n}">${escape(rows[n][0])}</button>`).join('')}</div>
        <div class="drag-targets">${rows.map(([, target], n) => `<div class="play-drop-row"><span>${escape(target)}</span><button type="button" class="drag-target ${assignments[n] !== null ? 'filled' : ''}" data-target="${n}" aria-label="Destino ${escape(target)}; ${assignments[n] === null ? 'vacío' : escape(rows[assignments[n]][0])}">${assignments[n] === null ? 'Suelta o toca aquí' : escape(rows[assignments[n]][0])}</button>${assignments[n] === null ? '' : `<button type="button" class="play-remove" data-clear="${n}" aria-label="Quitar ${escape(rows[assignments[n]][0])}">×</button>`}</div>`).join('')}</div>
        <p class="play-progress" id="drag-status-${index}" role="status"></p>`;
      root.querySelectorAll('[data-item]').forEach(button => {
        button.onclick = () => { if (isChecked()) return; selected = selected === Number(button.dataset.item) ? null : Number(button.dataset.item); draw(); root.querySelector(`[data-item="${button.dataset.item}"]`)?.focus(); };
        button.ondragstart = event => { if (isChecked()) { event.preventDefault(); return; } event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', button.dataset.item); };
      });
      root.querySelectorAll('[data-target]').forEach(button => {
        const target = Number(button.dataset.target);
        button.onclick = () => place(selected, target);
        button.ondragover = event => { if (!isChecked()) { event.preventDefault(); button.classList.add('drag-over'); } };
        button.ondragleave = () => button.classList.remove('drag-over');
        button.ondrop = event => { event.preventDefault(); button.classList.remove('drag-over'); const value = event.dataTransfer.getData('text/plain'); if (value !== '') place(Number(value), target); };
      });
      root.querySelectorAll('[data-clear]').forEach(button => button.onclick = () => { if (isChecked()) return; assignments[Number(button.dataset.clear)] = null; draw(); });
      update();
    }
    draw();
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
      section.insertAdjacentHTML('beforeend', `<details class="pedagogy-editor"><summary>Explicación, pistas y criterios</summary><label>Explicación de la solución<textarea name="explanation-${index}" maxlength="1500" placeholder="Por qué es correcta y cómo se llega a ella">${escape(question.explanation || '')}</textarea></label><label>Pistas progresivas (una por línea, hasta 3)<textarea name="hints-${index}" maxlength="902">${escape((question.hints || []).join('\n'))}</textarea></label>${openAnswerTypes.includes(question.type) ? `<label>Criterios para revisar<textarea name="rubric-${index}" maxlength="1000">${escape(question.rubric || '')}</textarea></label>` : ''}${['gaps','short'].includes(question.type) ? `<label>Respuestas equivalentes (una por línea)<textarea name="alternatives-${index}" maxlength="605">${escape((question.alternatives || []).join('\n'))}</textarea></label>` : ''}${question.type === 'numeric' ? `<div class="editor-pair"><label>Unidad<input name="unit-${index}" maxlength="30" value="${escape(question.unit || '')}"></label><label>Tolerancia absoluta<input name="tolerance-${index}" type="number" min="0" max="1000000" step="any" value="${Number(question.tolerance || 0)}"></label></div>` : ''}${question.type === 'error' ? `<label>Fragmento erróneo exacto<input name="errorSegment-${index}" maxlength="200" value="${escape(question.errorSegment || '')}"></label>` : ''}</details>`);
      const options = $('o-' + index);
      if (['gaps','multigaps'].includes(question.type)) section.querySelector('.pedagogy-editor').insertAdjacentHTML('beforeend', `<label>Banco de palabras opcional (una por línea, hasta 12)<textarea name="wordBank-${index}" maxlength="1211">${escape((question.wordBank || []).join('\n'))}</textarea></label>`);
      if (options) {
        const columns = ['memory','crossword','dragdrop'].includes(question.type) ? 2 : question.type === 'pasapalabra' ? 3 : 1;
        const labels = question.type === 'pasapalabra' ? ['Letra','Pista','Respuesta'] : question.type === 'crossword' ? ['Palabra','Pista'] : question.type === 'memory' ? ['Concepto','Pareja'] : question.type === 'dragdrop' ? ['Elemento','Destino'] : [sequenceTypes.includes(question.type) ? 'Paso en orden correcto' : question.type === 'multigaps' ? 'Solución (variantes con ~)' : 'Opción'];
        let rows = options.value.split('\n').map(line => columns === 1 ? [line.trim()] : line.split('|').map(value => value.trim()));
        // HTML textareas remove a leading newline; preserve empty manual board rows.
        if (question.options?.length && question.options.every(value => !value.trim())) rows = Array.from({ length: question.options.length }, () => Array(columns).fill(''));
        options.hidden = true; options.previousElementSibling.hidden = true;
        const editor = document.createElement('div'); editor.className = 'structured-options'; options.after(editor);
        function sync() { options.value = rows.map(row => row.join(' | ')).join('\n'); options.dispatchEvent(new Event('input', { bubbles: true })); }
        function draw() {
          editor.innerHTML = `<p class="play-editor-hint">${labels.map(escape).join(' · ')}${sequenceTypes.includes(question.type) ? ' · El alumno recibirá los pasos mezclados.' : ''}</p>${rows.map((row, n) => `<div class="structured-row" style="--columns:${columns}"><span>${n + 1}</span>${Array.from({ length: columns }, (_, c) => c===1&&columns>1?`<textarea data-row="${n}" data-col="${c}" aria-label="${labels[c]} ${n + 1}" maxlength="${question.type==='pasapalabra'?180:question.type==='crossword'?120:140}" rows="2">${escape(row[c]||'')}</textarea>`:`<input data-row="${n}" data-col="${c}" aria-label="${labels[c]} ${n + 1}" value="${escape(row[c] || '')}" maxlength="${question.type==='pasapalabra'?(c===0?1:60):columns === 1 ? 300 : 140}">`).join('')}<button type="button" data-remove-row="${n}" aria-label="Eliminar fila ${n + 1}">×</button></div>`).join('')}<button type="button" data-add-row>+ Añadir fila</button>`;
          editor.querySelectorAll('input,textarea').forEach(input => input.oninput = () => { rows[Number(input.dataset.row)][Number(input.dataset.col)] = input.value.replace(/[\r\n|]+/g,' '); sync(); });
          editor.querySelector('[data-add-row]').onclick = () => { rows.push(Array(columns).fill('')); draw(); sync(); };
          editor.querySelectorAll('[data-remove-row]').forEach(button => button.onclick = () => { rows.splice(Number(button.dataset.removeRow), 1); draw(); sync(); });
        }
        draw();
      }
    });
  };

  function choiceMarkup(question, index, options) {
    return `<div class="play-choice-grid" role="group" aria-label="Opciones del ejercicio ${index + 1}">${options.map((option, n) => `<label class="play-choice"><input type="radio" name="r-${index}" value="${escape(option)}" required><span class="play-choice-letter">${String.fromCharCode(65 + n)}</span><span>${escape(option)}</span></label>`).join('')}</div>`;
  }
  function questionMarkup(question, index, pairChoices) {
    const type = question.type;
    const heading = type === 'gaps' || type === 'multigaps' ? '' : `<h3 id="question-${index}">${index + 1}. ${escape(question.prompt)}</h3>`;
    const image = visualTypes.includes(type) ? `<div class="visual-image-box ${type === 'imagepoint' ? 'visual-answer-box' : ''}" id="visual-${index}" ${type === 'imagepoint' ? 'tabindex="0" role="button" aria-label="Marca el punto en la imagen; usa las flechas para ajustarlo"' : ''}><img data-activity-image="${index}" alt="${escape(question.image?.filename || 'Imagen del ejercicio')}"></div>` : '';
    let control = '';
    if (type === 'gaps') {
      const [before, after] = question.prompt.split('___');
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
      control = `<p class="play-hint">Destapa dos tarjetas y encuentra cada pareja.</p><div id="memory-${index}" class="memory-board"></div><input id="r-${index}" name="r-${index}" type="hidden"><p id="memory-status-${index}" class="play-progress" role="status"></p>`;
    } else if (type === 'flashcard') {
      control = `<button type="button" id="flip-${index}" class="flash-card" aria-pressed="false"><small>Toca para girar</small><strong>${escape(question.prompt)}</strong></button><div class="play-flash-assess" id="flash-assess-${index}" hidden><button type="button" data-flash="correct" data-index="${index}">✓ La sabía</button><button type="button" data-flash="partial" data-index="${index}">◷ Con ayuda</button><button type="button" data-flash="incorrect" data-index="${index}">↻ Repasar</button></div><input id="r-${index}" name="r-${index}" type="hidden">`;
    } else if (sequenceTypes.includes(type)) {
      control = `<p class="play-hint">Arrastra para ordenar. También puedes tocar una fila y luego otra, o usar las flechas.</p><div id="order-${index}" class="play-order-list"></div><input type="hidden" id="r-${index}" name="r-${index}">`;
    } else if (type === 'problem') {
      control = `<div class="problem-steps">${['Datos importantes','Planteamiento','Cálculos','Respuesta y comprobación'].map((label, n) => `<label><span>${n + 1}</span>${label}<textarea data-problem-step="${index}" maxlength="700" rows="2" ${n === 3 ? 'required' : ''} aria-label="${label}"></textarea></label>`).join('')}</div><input type="hidden" id="r-${index}" name="r-${index}">`;
    } else if (type === 'error') {
      control = `<div class="error-fragments" role="group" aria-label="Selecciona el fragmento que contiene el error">${question.prompt.split(/(\s+)/).filter(part => part.trim()).map((part, n) => `<button type="button" data-error-word="${n}" aria-pressed="false">${escape(part)}</button>`).join('')}</div><label>Escribe la corrección y explica por qué<textarea id="r-${index}" name="r-${index}" maxlength="3000" required rows="3"></textarea></label>`;
    } else if (openAnswerTypes.includes(type)) {
      control = `<textarea id="r-${index}" name="r-${index}" maxlength="${type === 'short' ? 800 : 3000}" rows="${type === 'short' ? 2 : 4}" required placeholder="Escribe tu respuesta con tus propias palabras…" aria-label="Respuesta del ejercicio ${index + 1}"></textarea>`;
    } else if (type === 'pairs' && pairChoices.length < 2) {
      control = `<input id="r-${index}" name="r-${index}" autocomplete="off" maxlength="300" required placeholder="Escribe el término relacionado" aria-label="Término relacionado con ${escape(question.prompt)}">`;
    } else {
      const options = type === 'pairs' ? pairChoices : type === 'boolean' ? question.options : shuffle(question.options);
      control = choiceMarkup(question, index, options);
    }
    const review = openAnswerTypes.includes(type) && type !== 'flashcard' ? `<div id="review-${index}" hidden><label for="grade-${index}">Valoración del profesor</label><select id="grade-${index}"><option value="pending">Pendiente de revisar</option><option value="correct">Correcta</option><option value="incorrect">Necesita revisión</option><option value="partial">Parcialmente correcta</option></select></div>` : '';
    return `<section class="block play-question" data-type="${type}" data-tone="${materialTone(type)}" data-question="${index}"><div class="play-question-top"><span class="play-number">${String(index + 1).padStart(2, '0')}</span><span class="play-kind">${escape(activityLabels[type])}</span>${['memory','pasapalabra','hangman','wordsearch'].includes(type) ? `<div class="game-timer"><button type="button" data-timer="${index}" aria-label="Iniciar cronómetro opcional">Cronómetro</button><output id="timer-${index}" aria-label="Tiempo de práctica">00:00</output></div>` : ''}</div>${heading}<div class="question-workspace">${type === 'reading' ? `<div class="reading-passage prewrap" tabindex="0">${escape(question.text)}<button type="button" data-highlight="${index}">Subrayar selección</button></div>` : ''}<div class="question-controls">${image}${type === 'visualquiz' ? `<button type="button" data-zoom="${index}">Ampliar imagen</button>` : ''}${control}</div></div>${question.hints?.length ? `<div class="play-hints"><button type="button" data-hint="${index}">Necesito una pista</button><ol id="hints-${index}"></ol></div>` : ''}<p id="feedback-${index}" class="play-feedback prewrap" role="status"></p>${review}</section>`;
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
      const errors = misses(), parts = ['<path d="M15 105H95M30 105V10H75V25"/>','<circle cx="75" cy="36" r="11"/>','<path d="M75 47V74"/>','<path d="M75 53L55 64"/>','<path d="M75 53L95 64"/>','<path d="M75 74L57 96"/>','<path d="M75 74L93 96"/>'];
      root.innerHTML = `<div class="hangman-stage"><div class="hangman-figure" data-errors="${errors}" aria-label="${errors} de 7 fallos"><svg viewBox="0 0 115 115" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">${parts.slice(0, errors).join('')}</svg></div><div><div class="hangman-word" aria-live="polite">${[...solution].map(letter => `<span class="${/[A-ZÑ]/.test(letter) ? 'letter-slot' : ''}">${/[A-ZÑ]/.test(letter) ? chosen.has(letter) || finished ? escape(letter) : '·' : escape(letter)}</span>`).join('')}</div><p>${finished ? won() ? '✓ ¡Palabra descubierta!' : `↻ La respuesta era ${escape(question.answer)}.` : `Te quedan ${7 - errors} intentos. Usa también el teclado.`}</p></div></div><div class="hangman-keyboard">${letters.map(letter => `<button type="button" class="${chosen.has(letter) ? solution.includes(letter) ? 'answer-right' : 'answer-wrong' : ''}" data-hangman-letter="${letter}" ${chosen.has(letter) || finished ? 'disabled' : ''}>${letter}</button>`).join('')}</div>`;
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
    root.addEventListener('keydown', event => { const key = letterKey(event.key); if (!isChecked() && key.length === 1 && letters.includes(key)) { event.preventDefault(); root.querySelector(`[data-hangman-letter="${key}"]:not(:disabled)`)?.click(); root.focus({ preventScroll: true }); } });
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
    const games = {};
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
      if(puzzleTypes.includes(q.type))return !games[index]?.complete?'unanswered':games[index].correct?'correct':'incorrect';
      if(q.type==='memory')return value?'correct':'unanswered';
      if(!String(value).trim())return 'unanswered';
      if(openAnswerTypes.includes(q.type))return 'pending';
      if(sequenceTypes.includes(q.type))return touchedSequences.has(index)?accepts(value,q.answer)?'correct':'incorrect':'unanswered';
      if(q.type==='numeric'){const n=numberValue(value),s=numberValue(q.answer);return Number.isFinite(n)&&Math.abs(n-s)<=(q.tolerance||0)+Number.EPSILON*Math.max(1,Math.abs(s))*4?'correct':'incorrect';}
      if(q.type==='imagepoint'){const [x,y]=value.split(',').map(Number);return (q.target.width&&q.target.height?Math.abs(x-q.target.x)<=q.target.width/2&&Math.abs(y-q.target.y)<=q.target.height/2:Math.hypot(x-q.target.x,y-q.target.y)<=10)?'correct':'incorrect';}
      return accepts(value,q.answer,q.alternatives)?'correct':'incorrect';
    }
    function feedback(index,grade) {
      const box=$('feedback-'+index),q=questions[index];box.className='play-feedback '+(grade==='correct'?'is-correct':grade==='pending'?'is-pending':'is-incorrect');
      box.innerHTML=grade==='correct'?'✓ ¡Correcto!'+(q.explanation?'<div>'+rich(q.explanation)+'</div>':''):grade==='pending'?'◷ Respuesta guardada. La revisa el profesor.'+(q.rubric?'<div>'+rich(q.rubric)+'</div>':''):'× Revisa tu respuesta. Puedes volver a intentarlo o consultar la solución.';
      document.querySelector(`[data-question="${index}"]`).dataset.result=grade;
    }
    function confirmQuestion(index) {
      if(checked)return;const grade=gradeQuestion(index),q=questions[index];if(grade==='unanswered')return;
      if(!puzzleTypes.includes(q.type)&&!['memory','hangman'].includes(q.type))logAnswer({index,correct:grade==='pending'?null:grade==='correct',value:String(new FormData($('form')).get('r-'+index)||''),assisted:q.type==='flashcard'&&flashGrades[index]!=='correct'});
      if(!puzzleTypes.includes(q.type))feedback(index,grade);
      const field=$('r-'+index);if(field&&field.type!=='hidden'&&grade!=='pending')markControl(field,grade==='correct');
      document.querySelector(`[data-question="${index}"]`)?.querySelectorAll('.play-choice').forEach(label=>{const input=label.querySelector('input');label.classList.remove('answer-right','answer-wrong');label.querySelector('.choice-result')?.remove();if(input.checked){const right=grade==='correct';markControl(label,right);label.insertAdjacentHTML('beforeend',`<b class="choice-result" aria-label="${right?'Correcta':'Incorrecta'}">${right?'✓':'×'}</b>`);}});
      if(sequenceTypes.includes(q.type))document.querySelectorAll(`#order-${index} [data-sequence-row]`).forEach((row,n)=>markControl(row,sequences[index][n]===q.options[n]));
    }
    const touchedSequences = new Set(), groupReviews = [];
    let checked = false;
    let attempt = null;
    questions.forEach((q, index) => {
      if (!sequenceTypes.includes(q.type)) return;
      sequences[index] = shuffle(q.options);
      if (sequences[index].join(' → ') === q.answer && sequences[index].length > 1) sequences[index].reverse();
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
        const solution = puzzleTypes.includes(q.type) ? puzzleSolution(q) : q.type === 'imagepoint' ? 'Punto marcado por el profesor' : q.answer;
        feedback.innerHTML = rich((grades[index]==='unanswered'?'Sin responder. ':openAnswerTypes.includes(q.type) && q.type !== 'flashcard' ? '◷ Solución orientativa: ' + q.answer : grades[index] === 'correct' ? '✓ ¡Correcto!' : '↻ Solución: ' + solution) + (q.errorSegment ? '\nFragmento que había que corregir: ' + q.errorSegment : '') + (q.explanation ? '\n\n' + q.explanation : '') + (q.rubric ? '\n\nCriterios de revisión: ' + q.rubric : ''));
        feedback.classList.add(grades[index] === 'correct' ? 'is-correct' : grades[index] === 'pending' ? 'is-pending' : 'is-incorrect');
        document.querySelector(`[data-question="${index}"]`).dataset.result = grades[index];
        games[index]?.review?.();
        document.querySelector(`[data-question="${index}"]`).querySelectorAll('.play-choice').forEach(label => { const input = label.querySelector('input');label.classList.remove('answer-right','answer-wrong');label.querySelector('.choice-result')?.remove(); if (input.value === q.answer || input.checked) { const right = input.value === q.answer; label.classList.add(right ? 'answer-right' : 'answer-wrong'); label.insertAdjacentHTML('beforeend', `<b class="choice-result" aria-label="${right ? 'Opción correcta' : 'Opción incorrecta'}">${right ? '✓' : '×'}</b>`); } });
        if (q.type === 'imagepoint') $('visual-' + index).insertAdjacentHTML('beforeend', `<span class="visual-solution-zone" style="left:${q.target.x}%;top:${q.target.y}%;width:${q.target.width || 20}%;height:${q.target.height || 20}%" aria-label="Zona correcta">✓</span>`);
        document.querySelector(`[data-question="${index}"]`).querySelectorAll('input,textarea,button').forEach(control => control.disabled = true);
        if (openAnswerTypes.includes(q.type) && q.type !== 'flashcard') $('review-' + index).hidden = false;
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
    $('form').addEventListener('play:answer',event=>{logAnswer(event.detail);const {index,correct}=event.detail;if(correct!==null){const log=practice[index],parts=Object.values(log.parts).filter(p=>p.correct!==null);$('feedback-'+index).className='play-feedback '+(correct?'is-correct':'is-incorrect');$('feedback-'+index).textContent=`${correct?'✓ Correcto.':'× Prueba de nuevo.'} ${parts.filter(p=>p.correct).length} aciertos · ${parts.filter(p=>!p.correct).length} por revisar.`;if(!correct)document.querySelector(`[data-question="${index}"] [data-show-solution]`)?.removeAttribute('hidden');}},{signal});
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
    function renderView() {summary.hidden=true;toolbar.hidden=false;if($('showPracticeResult'))$('showPracticeResult').hidden=false; const sections=visibleQuestions();currentStep=Math.max(0,Math.min(currentStep,sections.length-1));sections.forEach((section,n)=>section.hidden=n!==currentStep);$('form').querySelectorAll('.reading-repeat').forEach(details=>details.open=true);$('stepPosition').textContent=`${currentStep+1} / ${sections.length}`;$('previousQuestion').disabled=currentStep===0;$('nextQuestion').hidden=currentStep===sections.length-1;$('form').querySelector('[type="submit"]').hidden=checked||currentStep!==sections.length-1;content.scrollTop=0; }
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
      const list = sequences[index], root = $('order-' + index);
      if (questions[index].type === 'sentence') {
        if (!root.dataset.started) { root.dataset.started = '1'; list.splice(0); }
        const bank = questions[index].options.filter(value => !list.includes(value)).sort((a,b) => a.localeCompare(b));
        root.innerHTML = `<div class="sentence-bank" aria-label="Fragmentos disponibles">${bank.map(value => `<button type="button" data-fragment="${escape(value)}" draggable="true">${escape(value)}</button>`).join('') || '✓ Todos los fragmentos usados'}</div><div class="sentence-line" tabindex="0" aria-label="Frase construida; suelta aquí los fragmentos">${list.map((value, n) => `<span class="sentence-chip ${checked ? value === questions[index].options[n] ? 'answer-right' : 'answer-wrong' : ''}"><button type="button" data-remove-fragment="${n}" ${checked ? 'disabled' : ''}>${escape(value)} ×</button><button type="button" data-left-fragment="${n}" aria-label="Mover ${escape(value)} a la izquierda" ${checked || n === 0 ? 'disabled' : ''}>←</button></span>`).join('') || 'Toca o arrastra los fragmentos para construir la frase'}</div>`;
        $('r-' + index).value = list.join(' → ');
        const add = value => { if (checked || !bank.includes(value)) return; list.push(value); if (list.length === questions[index].options.length) touchedSequences.add(index); renderSequence(index); updateProgress(); };
        root.querySelectorAll('[data-fragment]').forEach(button => { button.onclick = () => add(button.dataset.fragment); button.ondragstart = event => event.dataTransfer.setData('application/x-profesor-fragment', button.dataset.fragment); });
        const line = root.querySelector('.sentence-line'); line.ondragover = event => event.preventDefault(); line.ondrop = event => { event.preventDefault(); add(event.dataTransfer.getData('application/x-profesor-fragment')); };
        root.querySelectorAll('[data-remove-fragment]').forEach(button => button.onclick = () => { if (checked) return; list.splice(Number(button.dataset.removeFragment), 1); touchedSequences.delete(index); renderSequence(index); updateProgress(); });
        root.querySelectorAll('[data-left-fragment]').forEach(button => button.onclick = () => { if (checked) return; const n = Number(button.dataset.leftFragment); [list[n-1],list[n]] = [list[n],list[n-1]]; renderSequence(index); });
        return;
      }
      root.innerHTML = list.map((value, position) => `<div class="order-row ${checked ? value === questions[index].options[position] ? 'answer-right' : 'answer-wrong' : ''}" data-sequence-row="${position}" draggable="${!checked}" tabindex="${checked ? '-1' : '0'}" aria-label="${position + 1} de ${list.length}: ${escape(value)}"><span class="order-grip" aria-hidden="true">${checked ? value === questions[index].options[position] ? '✓' : '↻' : '⠿'}</span><span class="order-value"><b>${position + 1}.</b> ${escape(value)}</span><div class="order-actions"><button type="button" data-move="-1" data-pos="${position}" aria-label="Subir ${escape(value)}" ${checked || position === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="1" data-pos="${position}" aria-label="Bajar ${escape(value)}" ${checked || position === list.length - 1 ? 'disabled' : ''}>↓</button></div></div>`).join('') + (checked ? '' : '<button type="button" data-confirm-order>Confirmar este orden</button>');
      $('r-' + index).value = list.join(' → ');
      if (checked) return;
      root.querySelector('[data-confirm-order]').onclick = () => { touchedSequences.add(index); updateProgress();confirmQuestion(index); };
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
        const [item] = list.splice(from, 1); list.splice(to, 0, item); renderSequence(index, to);
        touchedSequences.add(index); updateProgress();
      }
    }
    Object.keys(sequences).forEach(index => renderSequence(Number(index)));
    paintActivityImages(questions, $('form'));
    questions.forEach((q, index) => {
      if (puzzleTypes.includes(q.type)) mountPuzzleGame(q, index, () => checked, (key, result) => { games[key] = result; updateProgress(); });
      if (q.type === 'memory') mountMemory(q, index, () => checked);
      if (q.type === 'hangman') mountHangman(q, index, () => checked);
      const section = document.querySelector(`[data-question="${index}"]`);
      if(!['quiz','boolean','visualquiz','pairs','classify','pasapalabra','memory','wordsearch','crossword','dragdrop','hangman','order','timeline'].includes(q.type)){
        const check=document.createElement('button');check.type='button';check.dataset.checkQuestion=index;check.textContent=openAnswerTypes.includes(q.type)?'Guardar respuesta':'Comprobar';
        check.onclick=()=>{if(q.type==='multigaps'){section.querySelectorAll('[data-multi-gap]').forEach((input,n)=>{if(input.value.trim()){const right=q.options[n].split('~').some(s=>accepts(input.value,s));markControl(input,right);recordAnswer(index,n,right,input.value.trim());}});}else confirmQuestion(index);};section.querySelector('.question-controls').append(check);
      }
      const solution=document.createElement('button');solution.type='button';solution.dataset.showSolution=index;solution.textContent='Ver solución';solution.hidden=q.type==='flashcard';solution.className='play-solution-link';solution.onclick=()=>{practice[index].assisted=true;const model=q.type==='memory'?validateMemory(q.options).map(pair=>pair.join(' → ')).join('\n'):q.type==='wordsearch'?buildWordSearch(puzzleRows(q.type,q.options)).placements.map(p=>p.word+': fila '+(p.row+1)+', columna '+(p.col+1)+' → fila '+(p.endRow+1)+', columna '+(p.endCol+1)).join('\n'):puzzleTypes.includes(q.type)?puzzleSolution(q):q.answer;$('feedback-'+index).innerHTML='<strong>Solución orientativa</strong><div>'+rich(model)+'</div>'+(q.explanation?'<div>'+rich(q.explanation)+'</div>':'');};section.append(solution);
      if(!puzzleTypes.includes(q.type))section.addEventListener('click',()=>queueMicrotask(()=>{if(section.dataset.result==='incorrect'||section.dataset.result==='pending')solution.hidden=false;}),{signal});
      section.querySelectorAll('input:not([type="radio"]):not([type="hidden"])').forEach(input=>{
        if(q.type==='multigaps'||q.type==='pasapalabra'||q.type==='crossword')return;
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
      if (q.type === 'error') section.querySelectorAll('[data-error-word]').forEach(button => button.onclick = () => { if (checked) return; button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true')); });
      let hintsUsed = 0;
      section.querySelector('[data-hint]')?.addEventListener('click', event => { if (checked || hintsUsed >= q.hints.length) return;practice[index].assisted=true;$('hints-' + index).insertAdjacentHTML('beforeend', `<li>${rich(q.hints[hintsUsed++])}</li>`); event.currentTarget.disabled = hintsUsed === q.hints.length; });
      section.querySelector('[data-zoom]')?.addEventListener('click', event => { const image = $('visual-' + index); image.classList.toggle('zoomed'); event.currentTarget.textContent = image.classList.contains('zoomed') ? 'Reducir imagen' : 'Ampliar imagen'; });
      section.querySelector('[data-highlight]')?.addEventListener('click', () => { const selection = window.getSelection(); if (!selection.rangeCount || selection.isCollapsed) return; const range = selection.getRangeAt(0), passage = section.querySelector('.reading-passage'); if (!passage.contains(range.commonAncestorContainer) || range.cloneContents().querySelector?.('button')) return; const mark = document.createElement('mark'); try { range.surroundContents(mark); selection.removeAllRanges(); } catch (_) { /* A selection spanning existing highlights can be selected again in smaller portions. */ } });
      if (q.type === 'flashcard') {
        $('flip-' + index).onclick = () => {
          if (checked) return;
          const flipped = $('flip-' + index).getAttribute('aria-pressed') !== 'true';
          $('flip-' + index).setAttribute('aria-pressed', String(flipped));
          $('flip-' + index).innerHTML = flipped ? `<small>Respuesta</small><strong>${escape(q.answer)}</strong>` : '<small>Toca para girar</small><strong>¿Recuerdas la respuesta?</strong>';
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
      $('flash-assess-' + index).querySelectorAll('button').forEach(option => option.classList.toggle('selected', option === button));
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
  reviewAttempt=function(id){originalReviewAttempt(id);profesorText.paint($('form'));};
})();
