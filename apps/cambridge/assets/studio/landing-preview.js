/* Public previews for the English workspace. */
(() => {
  const byId = id => document.getElementById(id);
  const dialog = byId('previewDialog');
  const audio = byId('previewAudio');
  const panels = [...dialog.querySelectorAll('[data-preview-panel]')];
  const titles = {lessons:'Modo temario', games:'Modo juegos', practice:'Práctica directa'};
  let opener;

  function choose(buttons, key, id, active) {
    buttons.forEach(button => {
      const name = button.dataset[key];
      button.setAttribute('aria-pressed', String(name === active));
      byId(id + name).hidden = name !== active;
    });
  }

  function showPreview(name) {
    choose(panels, 'previewPanel', 'preview-', name);
    byId('previewTitle').textContent = titles[name];
    if (name !== 'practice') audio.pause();
  }

  document.querySelectorAll('[data-preview-open]').forEach(button => {
    button.addEventListener('click', () => {
      opener = button;
      showPreview(button.dataset.previewOpen);
      dialog.showModal();
      byId('previewTitle').focus();
    });
  });
  panels.forEach(button => button.addEventListener('click', () => showPreview(button.dataset.previewPanel)));
  dialog.addEventListener('close', () => {
    audio.pause();
    opener?.focus({preventScroll:true});
  });
  const levels = [...dialog.querySelectorAll('[data-preview-level]')];
  levels.forEach(button => button.addEventListener('click', () => choose(levels, 'previewLevel', 'sample-', button.dataset.previewLevel)));
  const skills = [...dialog.querySelectorAll('[data-preview-skill]')];
  skills.forEach(button => button.addEventListener('click', () => {
    const skill = button.dataset.previewSkill;
    choose(skills, 'previewSkill', 'sample-', skill);
    if (skill !== 'listening') audio.pause();
  }));
  byId('sampleAnswer').addEventListener('input', event => {
    const words = event.target.value.trim().split(/\s+/).filter(Boolean).length;
    byId('sampleWordCount').textContent = `${words} ${words === 1 ? 'palabra' : 'palabras'}`;
  });

  const stages = [
    {before:'She has lived here', after:'2020.', pieces:['for', 'since', 'during'], answer:'since', clue:'Since indica el inicio de un periodo: 2020.'},
    {before:'We have been waiting', after:'two hours.', pieces:['during', 'since', 'for'], answer:'for', clue:'For indica cuánto tiempo ha pasado: dos horas.'},
    {before:'The exhibition is open', after:'everyone.', pieces:['to', 'of', 'by'], answer:'to', clue:'Open to everyone significa «abierta a todo el mundo».'}
  ];
  const slot = byId('bridgeSlot');
  const board = byId('bridgeBoard');
  const bank = byId('bridgePieces');
  const feedback = byId('bridgeFeedback');
  const next = byId('bridgeNext');
  let step = 0;
  let selected = null;
  let solved = false;

  function writeSentence(word) {
    const {before, after} = stages[step];
    const blank = document.createElement('b');
    blank.textContent = word;
    byId('bridgeSentence').replaceChildren(before + ' ', blank, ' ' + after);
  }

  function selectPiece(button) {
    if (solved) return;
    selected = button;
    for (const piece of bank.children) piece.setAttribute('aria-pressed', String(piece === button));
    slot.textContent = 'Colocar «' + button.textContent + '»';
    board.dataset.state = 'ready';
    feedback.textContent = 'Coloca la pieza en el puente.';
  }

  function placePiece() {
    if (solved) return;
    if (!selected) {
      feedback.textContent = 'Primero elige una pieza.';
      bank.firstElementChild.focus();
      return;
    }
    const stage = stages[step];
    if (selected.textContent !== stage.answer) {
      board.dataset.state = 'try-again';
      feedback.textContent = 'Esa pieza no encaja. Prueba otra.';
      selected.setAttribute('aria-pressed', 'false');
      selected.focus();
      selected = null;
      slot.textContent = 'Colocar pieza';
      return;
    }
    solved = true;
    const finished = step === stages.length - 1;
    board.dataset.state = 'solved';
    writeSentence(stage.answer);
    slot.textContent = stage.answer;
    slot.setAttribute('aria-disabled', 'true');
    for (const piece of bank.children) piece.disabled = true;
    feedback.textContent = (finished ? '¡Puente completo! ' : '¡Correcto! ') + stage.clue;
    next.textContent = finished ? 'Volver a jugar' : 'Siguiente tramo →';
    next.hidden = false;
    next.focus();
  }

  function renderStage() {
    solved = false;
    selected = null;
    board.dataset.state = 'waiting';
    writeSentence('___');
    byId('bridgeProgress').textContent = `${step+1} de ${stages.length}`;
    slot.textContent = 'Colocar pieza';
    slot.removeAttribute('aria-disabled');
    next.hidden = true;
    feedback.textContent = 'Elige la pieza que falta.';
    bank.replaceChildren(...stages[step].pieces.map(word => {
      const button = document.createElement('button');
      button.type = 'button';
      button.lang = 'en';
      button.textContent = word;
      button.draggable = true;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => selectPiece(button));
      button.addEventListener('dragstart', event => {
        if (solved) return event.preventDefault();
        selectPiece(button);
        event.dataTransfer.setData('text/plain', word);
      });
      return button;
    }));
  }

  slot.addEventListener('click', placePiece);
  slot.addEventListener('dragover', event => { if (selected && !solved) event.preventDefault(); });
  slot.addEventListener('drop', event => {
    event.preventDefault();
    if (selected && event.dataTransfer.getData('text/plain') === selected.textContent) placePiece();
  });
  next.addEventListener('click', () => {
    step = (step + 1) % stages.length;
    renderStage();
    bank.firstElementChild.focus();
  });
  renderStage();

  function status(path) {
    return fetch(path, {credentials:'same-origin'}).then(response => response.ok ? response.json() : null).catch(() => null);
  }
  Promise.all([status('/auth/google/status'), status('/api/public/app-availability')]).then(([google, availability]) => {
    const paused = availability?.apps?.CAMBRIDGE?.paused === true;
    if (!paused && google?.enabled !== false) return;
    document.querySelectorAll('.app-entry').forEach(link => {
      link.setAttribute('aria-disabled', 'true');
      link.removeAttribute('href');
    });
    const message = byId('googleStatus');
    if (paused) message.textContent = 'La aplicación está pausada temporalmente. Tu progreso sigue guardado.';
    message.hidden = false;
  });
})();
