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
    dialog.dataset.panel = name;
    dialog.scrollTop = 0;
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

  const board = byId('stationBoard');
  const desk = byId('stationDesk');
  const spots = [...board.querySelectorAll('[data-station-spot]')];
  const intro = byId('station-intro');
  const progress = byId('stationProgress');
  const plan = byId('stationPlan');
  const form = byId('stationForm');
  const feedback = byId('stationFeedback');
  const result = byId('stationResult');
  const found = new Set();
  const itinerary = [
    {field:'service', value:'22:00', hint:'Cruza la hora de llegada del panel con la cancelación del aviso.'},
    {field:'platform', value:'6', hint:'El aviso actualiza el andén. El panel muestra el número anterior.'},
    {field:'ticket', value:'use', hint:'Relee la taquilla para comprobar cuándo sigue siendo válido tu billete.'},
  ];

  function showClue(active) {
    intro.hidden = Boolean(active);
    spots.forEach((spot, index) => {
      const name = spot.dataset.stationSpot;
      const opened = found.has(name);
      spot.toggleAttribute('data-found', opened);
      spot.querySelector('b').textContent = opened ? '✓' : String(index + 1);
      spot.setAttribute('aria-pressed', String(name === active));
      byId('station-' + name + '-clue').hidden = name !== active;
    });
    if (board.dataset.stage !== 'arrived') progress.textContent = `${found.size}/${spots.length} pistas`;
    plan.hidden = found.size !== spots.length || board.dataset.stage !== 'explore';
  }

  spots.forEach(spot => spot.addEventListener('click', () => {
    found.add(spot.dataset.stationSpot);
    showClue(spot.dataset.stationSpot);
  }));

  plan.addEventListener('click', () => {
    board.dataset.stage = 'plan';
    desk.classList.add('is-planning');
    plan.hidden = true;
    form.hidden = false;
    byId('stationPlanTitle').focus();
  });

  function clearFeedback() {
    form.querySelector('[aria-invalid]')?.removeAttribute('aria-invalid');
    feedback.textContent = '';
  }

  form.addEventListener('change', clearFeedback);
  form.addEventListener('submit', event => {
    event.preventDefault();
    clearFeedback();
    const mistake = itinerary.find(item => form.elements[item.field].value !== item.value);
    if (mistake) {
      const field = form.elements[mistake.field];
      field.setAttribute('aria-invalid', 'true');
      feedback.textContent = mistake.hint;
      field.focus();
      return;
    }
    board.dataset.stage = 'arrived';
    desk.classList.remove('is-planning');
    form.hidden = true;
    result.hidden = false;
    progress.textContent = 'Misión completada';
    byId('stationArrival').focus();
  });

  byId('stationReplay').addEventListener('click', () => {
    found.clear();
    board.dataset.stage = 'explore';
    result.hidden = true;
    form.reset();
    showClue();
    spots[0].focus();
  });

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
