/* Interactive material player. The saved activity format remains version 1. */
(function () {
  const shuffle = values => values.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(item => item.value);
  const normalize = value => String(value || '').trim().toLocaleLowerCase('es').replace(/\s+/g, ' ');
  const escape = value => esc(String(value ?? ''));

  const originalPuzzleGame = mountPuzzleGame;
  mountPuzzleGame = function (question, index, isChecked, report) {
    if (question.type === 'wordsearch') {
      originalPuzzleGame(question, index, isChecked, report);
      const root = $('puzzle-' + index);
      const status = document.createElement('p');
      status.className = 'play-progress';
      status.setAttribute('role', 'status');
      root.after(status);
      let before = 0;
      root.addEventListener('click', event => {
        if (!event.target.closest('[data-cell]') || isChecked()) return;
        const found = root.querySelectorAll('.puzzle-word-list .found').length;
        status.textContent = found > before ? `¡Encontrada! ${found} de ${question.options.length} palabras.` : root.querySelector('.puzzle-grid .picked') ? 'Primera letra seleccionada: pulsa la última.' : 'Esa línea no forma una palabra pendiente. Prueba otra.';
        before = found;
      });
      return;
    }
    if (question.type === 'crossword') {
      originalPuzzleGame(question, index, isChecked, report);
      const root = $('puzzle-' + index);
      const cells = [...root.querySelectorAll('[data-puzzle-cell]')];
      const status = document.createElement('p');
      status.className = 'play-progress';
      status.setAttribute('role', 'status');
      root.after(status);
      const progress = () => { status.textContent = `${cells.filter(cell => cell.value).length} de ${cells.length} casillas completadas`; };
      progress();
      cells.forEach((cell, position) => {
        cell.addEventListener('input', () => { progress(); if (cell.value && !isChecked()) cells[position + 1]?.focus(); });
        cell.addEventListener('keydown', event => {
          if (isChecked()) return;
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); cells[position + 1]?.focus(); }
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); cells[position - 1]?.focus(); }
          if (event.key === 'Backspace' && !cell.value) cells[position - 1]?.focus();
        });
        cell.addEventListener('paste', event => {
          const letters = puzzleWord(event.clipboardData.getData('text')).replace(/[^A-ZÑ]/g, '').split('');
          if (letters.length < 2 || isChecked()) return;
          event.preventDefault();
          letters.forEach((letter, offset) => { const target = cells[position + offset]; if (target) { target.value = letter; target.dispatchEvent(new Event('input', { bubbles: true })); } });
          cells[Math.min(position + letters.length, cells.length - 1)]?.focus();
        });
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
      report(index, { complete, correct: complete && assignments.every((source, target) => source === target), answer: answer.value });
      $('drag-status-' + index).textContent = `${assignments.filter(value => value !== null).length} de ${rows.length} colocados`;
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
    return originalEditorPreview(question, index);
  };
  const originalEditActivity = editActivity;
  editActivity = function (source) {
    originalEditActivity(source);
    const hints = {
      pairs: 'Cada tarjeta relaciona este enunciado con su respuesta. Crea al menos dos tarjetas para que haya opciones entre las que elegir.',
      gaps: 'Escribe ___ dentro de la frase donde quieres que el alumno complete la palabra. Solo un hueco por ejercicio.',
      order: 'Una línea por paso, en el orden correcto. El alumno podrá arrastrarlos o moverlos con las flechas.',
      sentence: 'Escribe los fragmentos de la frase en su orden correcto, uno por línea.',
      timeline: 'Pon cada fecha o acontecimiento en orden cronológico, uno por línea.',
      memory: 'Escribe una pareja por línea: concepto | respuesta. Las tarjetas se mezclarán automáticamente.',
      dragdrop: 'Escribe una pareja por línea: pieza | destino. Cada pieza solo podrá ocupar un destino.',
      crossword: 'Escribe PALABRA | pista en cada línea. Usa palabras que compartan letras.',
      wordsearch: 'Escribe una palabra por línea; el tablero se generará automáticamente.',
      flashcard: 'El enunciado es el anverso y la solución es el reverso. El alumno indicará si la sabía.',
      imagepoint: 'Marca en la imagen el punto que el alumno deberá localizar.',
    };
    source.activity.questions.forEach((question, index) => {
      const field = $('q-' + index);
      if (!field || !hints[question.type]) return;
      const hint = document.createElement('p');
      hint.className = 'play-editor-hint';
      hint.textContent = hints[question.type];
      field.after(hint);
    });
  };

  function choiceMarkup(question, index, options) {
    return `<div class="play-choice-grid" role="group" aria-label="Opciones del ejercicio ${index + 1}">${options.map((option, n) => `<label class="play-choice"><input type="radio" name="r-${index}" value="${escape(option)}" required><span class="play-choice-letter">${String.fromCharCode(65 + n)}</span><span>${escape(option)}</span></label>`).join('')}</div>`;
  }
  function questionMarkup(question, index, pairChoices) {
    const type = question.type;
    const heading = type === 'gaps' ? '' : `<h3 id="question-${index}">${index + 1}. ${escape(question.prompt)}</h3>`;
    const image = visualTypes.includes(type) ? `<div class="visual-image-box ${type === 'imagepoint' ? 'visual-answer-box' : ''}" id="visual-${index}" ${type === 'imagepoint' ? 'tabindex="0" role="button" aria-label="Marca el punto en la imagen; usa las flechas para ajustarlo"' : ''}><img data-activity-image="${index}" alt="${escape(question.image?.filename || 'Imagen del ejercicio')}"></div>` : '';
    let control = '';
    if (type === 'gaps') {
      const [before, after] = question.prompt.split('___');
      control = `<div class="play-gap-line"><span>${escape(before)}</span><input id="r-${index}" name="r-${index}" aria-label="Respuesta del hueco ${index + 1}" autocomplete="off" spellcheck="false" maxlength="300" required placeholder="Escribe aquí"><span>${escape(after)}</span></div>`;
    } else if (type === 'imagepoint') {
      control = `<input id="r-${index}" name="r-${index}" type="hidden"><p class="play-hint" id="point-status-${index}" role="status">Toca la imagen donde está la respuesta. También puedes usar las flechas del teclado.</p>`;
    } else if (puzzleTypes.includes(type)) {
      control = `<div id="puzzle-${index}"></div><input id="r-${index}" name="r-${index}" type="hidden">`;
    } else if (type === 'memory') {
      control = `<p class="play-hint">Destapa dos tarjetas y encuentra cada pareja.</p><div id="memory-${index}" class="memory-board"></div><input id="r-${index}" name="r-${index}" type="hidden"><p id="memory-status-${index}" class="play-progress" role="status"></p>`;
    } else if (type === 'flashcard') {
      control = `<button type="button" id="flip-${index}" class="flash-card" aria-pressed="false"><small>Toca para girar</small><strong>¿Recuerdas la respuesta?</strong></button><div class="play-flash-assess" id="flash-assess-${index}" hidden><button type="button" data-flash="correct" data-index="${index}">✓ La sabía</button><button type="button" data-flash="incorrect" data-index="${index}">↻ Necesito repasarla</button></div><input id="r-${index}" name="r-${index}" type="hidden">`;
    } else if (sequenceTypes.includes(type)) {
      control = `<p class="play-hint">Arrastra para ordenar. También puedes tocar una fila y luego otra, o usar las flechas.</p><div id="order-${index}" class="play-order-list"></div><input type="hidden" id="r-${index}" name="r-${index}">`;
    } else if (openAnswerTypes.includes(type)) {
      control = `<textarea id="r-${index}" name="r-${index}" maxlength="3000" required placeholder="Escribe tu respuesta con tus propias palabras…" aria-label="Respuesta del ejercicio ${index + 1}"></textarea>`;
    } else if (type === 'pairs' && pairChoices.length < 2) {
      control = `<input id="r-${index}" name="r-${index}" autocomplete="off" maxlength="300" required placeholder="Escribe el término relacionado" aria-label="Término relacionado con ${escape(question.prompt)}">`;
    } else {
      const options = type === 'pairs' ? pairChoices : type === 'boolean' ? question.options : shuffle(question.options);
      control = choiceMarkup(question, index, options);
    }
    const review = openAnswerTypes.includes(type) && type !== 'flashcard' ? `<div id="review-${index}" hidden><label for="grade-${index}">Valoración del profesor</label><select id="grade-${index}"><option value="pending">Pendiente de revisar</option><option value="correct">Correcta</option><option value="incorrect">Necesita revisión</option><option value="partial">Parcialmente correcta</option></select></div>` : '';
    return `<section class="block play-question" data-tone="${materialTone(type)}" data-question="${index}"><div class="play-question-top"><span class="play-number">${String(index + 1).padStart(2, '0')}</span><span class="play-kind">${escape(activityLabels[type])}</span></div>${heading}${type === 'reading' ? `<div class="reading-passage prewrap">${escape(question.text)}</div>` : ''}${image}${control}<p id="feedback-${index}" class="play-feedback prewrap" role="status"></p>${review}</section>`;
  }

  runActivity = function (material, studentId) {
    const m = JSON.parse(JSON.stringify(material));
    const questions = m.activity.questions;
    const pairChoices = shuffle(questions.filter(q => q.type === 'pairs').map(q => q.answer));
    const sequences = {};
    const games = {};
    const flashGrades = {};
    let checked = false;
    let attempt = null;
    questions.forEach((q, index) => {
      if (!sequenceTypes.includes(q.type)) return;
      sequences[index] = shuffle(q.options);
      if (sequences[index].join(' → ') === q.answer && sequences[index].length > 1) sequences[index].reverse();
    });
    const studentName = studentId ? student(studentId)?.name || 'Alumno' : '';
    modal(studentId ? 'En clase · ' + studentName : 'Prueba · sin guardar', `<div class="play-intro"><span class="badge">${escape(m.subject)}</span><h2>${escape(m.title)}</h2><p>${questions.length} ${questions.length === 1 ? 'ejercicio' : 'ejercicios'} · Resuelve y comprueba al final</p></div>${questions.map((q, i) => questionMarkup(q, i, pairChoices)).join('')}<p id="activityScore" class="play-score" role="status"></p>${submit('Comprobar respuestas')}`, form => {
      if (checked) return false;
      const answers = questions.map((q, index) => String(form.get('r-' + index) || ''));
      const missing = questions.findIndex((q, index) => puzzleTypes.includes(q.type) ? !games[index]?.complete : !answers[index].trim());
      if (missing !== -1) {
        document.querySelector(`[data-question="${missing}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        throw Error(`Completa el ejercicio ${missing + 1} antes de comprobar.`);
      }
      const grades = questions.map((q, index) => {
        if (q.type === 'flashcard') return flashGrades[index];
        if (openAnswerTypes.includes(q.type)) return 'pending';
        if (puzzleTypes.includes(q.type)) return games[index].correct ? 'correct' : 'incorrect';
        if (q.type === 'imagepoint') {
          const [x, y] = answers[index].split(',').map(Number);
          return Math.hypot(x - q.target.x, y - q.target.y) <= 10 ? 'correct' : 'incorrect';
        }
        return normalize(answers[index]) === normalize(q.answer) ? 'correct' : 'incorrect';
      });
      attempt = { id: uid(), materialId: m.id, studentId, date: new Date().toISOString(), mode: 'with_teacher', answers, grades, score: 0, total: questions.length, pending: 0, materialSnapshot: m.activity };
      checked = true;
      questions.forEach((q, index) => {
        const feedback = $('feedback-' + index);
        const solution = puzzleTypes.includes(q.type) ? puzzleSolution(q) : q.type === 'imagepoint' ? 'Punto marcado por el profesor' : q.answer;
        feedback.textContent = openAnswerTypes.includes(q.type) && q.type !== 'flashcard' ? 'Solución orientativa: ' + q.answer : grades[index] === 'correct' ? '¡Correcto!' : 'Solución: ' + solution;
        feedback.classList.add(grades[index] === 'correct' ? 'is-correct' : grades[index] === 'pending' ? 'is-pending' : 'is-incorrect');
        document.querySelector(`[data-question="${index}"]`).querySelectorAll('input,textarea,button').forEach(control => control.disabled = true);
        if (openAnswerTypes.includes(q.type) && q.type !== 'flashcard') $('review-' + index).hidden = false;
      });
      Object.keys(sequences).forEach(index => renderSequence(Number(index)));
      if (studentId) { state.activityAttempts ??= []; state.activityAttempts.push(attempt); }
      updateScore();
      $('form').querySelector('[type="submit"]').hidden = true;
      const close = $('form').querySelector('[data-action="close"]');
      if (close) close.textContent = 'Cerrar';
      return false;
    });
    $('dialog').classList.add('activity-play');
    $('dialog').addEventListener('close', () => $('dialog').classList.remove('activity-play'), { once: true });

    function updateScore() {
      attempt.score = attempt.grades.filter(grade => grade === 'correct').length;
      attempt.pending = attempt.grades.filter(grade => grade === 'pending').length;
      const partial = attempt.grades.filter(grade => grade === 'partial').length;
      $('activityScore').textContent = `${attempt.score}/${attempt.total} correctas.${attempt.pending ? ' ' + attempt.pending + ' pendientes de revisión del profesor.' : ''}${partial ? ' ' + partial + ' parcialmente correctas.' : ''}${studentId ? ' Sesión registrada con el profesor.' : ' No se guardan resultados.'}`;
      if (studentId) save();
    }
    function renderSequence(index, focusPosition = null) {
      const list = sequences[index], root = $('order-' + index);
      root.innerHTML = list.map((value, position) => `<div class="order-row" data-sequence-row="${position}" draggable="${!checked}" tabindex="${checked ? '-1' : '0'}" aria-label="${position + 1} de ${list.length}: ${escape(value)}"><span class="order-grip" aria-hidden="true">⠿</span><span class="order-value"><b>${position + 1}.</b> ${escape(value)}</span><div class="order-actions"><button type="button" data-move="-1" data-pos="${position}" aria-label="Subir ${escape(value)}" ${checked || position === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="1" data-pos="${position}" aria-label="Bajar ${escape(value)}" ${checked || position === list.length - 1 ? 'disabled' : ''}>↓</button></div></div>`).join('');
      $('r-' + index).value = list.join(' → ');
      if (checked) return;
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
        row.ondragstart = event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(position)); };
        row.ondragover = event => { event.preventDefault(); row.classList.add('drag-over'); };
        row.ondragleave = () => row.classList.remove('drag-over');
        row.ondrop = event => { event.preventDefault(); row.classList.remove('drag-over'); const source = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(source)) move(source, position); };
      });
      root.querySelectorAll('[data-move]').forEach(button => button.onclick = () => move(Number(button.dataset.pos), Number(button.dataset.pos) + Number(button.dataset.move)));
      if (focusPosition !== null) root.querySelector(`[data-sequence-row="${focusPosition}"]`)?.focus();
      function move(from, to) {
        if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return;
        const [item] = list.splice(from, 1); list.splice(to, 0, item); renderSequence(index, to);
      }
    }
    Object.keys(sequences).forEach(index => renderSequence(Number(index)));
    paintActivityImages(questions, $('form'));
    questions.forEach((q, index) => {
      if (puzzleTypes.includes(q.type)) mountPuzzleGame(q, index, () => checked, (key, result) => { games[key] = result; });
      if (q.type === 'memory') mountMemory(q, index, () => checked);
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
      $('r-' + index).value = button.dataset.flash === 'correct' ? 'La sabía' : 'Necesito repasarla';
      $('flash-assess-' + index).querySelectorAll('button').forEach(option => option.classList.toggle('selected', option === button));
    });
    $('form').querySelectorAll('input[type="radio"]').forEach(input => input.onchange = () => {
      if (!input.checked) return;
      const index = Number(input.name.slice(2));
      if (questions[index].type !== 'pairs') return;
      questions.forEach((q, other) => { if (other !== index && q.type === 'pairs') { const previous = [...document.querySelectorAll(`input[name="r-${other}"]`)].find(option => option.value === input.value && option.checked); if (previous) previous.checked = false; } });
    });
    questions.forEach((q, index) => {
      if (openAnswerTypes.includes(q.type) && q.type !== 'flashcard') $('grade-' + index).onchange = () => { if (!attempt) return; attempt.grades[index] = $('grade-' + index).value; updateScore(); };
    });
  };
})();
