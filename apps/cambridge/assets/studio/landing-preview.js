/* Public previews for the English workspace. */
(() => {
  const byId = id => document.getElementById(id);
  const dialog = byId('previewDialog');
  const panels = [...dialog.querySelectorAll('[data-preview-panel]')];
  const titles = {lessons:'Temario', games:'Juegos', practice:'Práctica', library:'Biblioteca'};
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
    dialog.scrollTop = 0;
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
    opener?.focus({preventScroll:true});
  });
  const levels = [...dialog.querySelectorAll('[data-preview-level]')];
  levels.forEach(button => button.addEventListener('click', () => choose(levels, 'previewLevel', 'sample-', button.dataset.previewLevel)));
  const skills = [...dialog.querySelectorAll('[data-preview-skill]')];
  skills.forEach(button => button.addEventListener('click', () => choose(skills, 'previewSkill', 'sample-', button.dataset.previewSkill)));

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
