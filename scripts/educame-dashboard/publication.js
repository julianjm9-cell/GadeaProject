export function setupPublication({ api, element, button, feedback, getState, refresh, restart, openCommand }) {
  const host = document.getElementById('work-publication');
  const selected = new Set();
  let known = new Set(), job, busy = false, timer, restarting = false;
  const link = (label, href) => {
    const node = element('a', 'text-link', label);
    node.href = href;
    return node;
  };
  function action(label, run, primary = true) {
    const node = button(label, async () => {
      if (busy) return;
      busy = true;
      render(getState());
      try { await run(); }
      catch (error) { feedback(error.message, true); }
      finally { busy = false; render(getState()); }
    });
    if (primary) node.className = 'button primary';
    node.disabled = busy;
    return node;
  }
  async function load() {
    clearTimeout(timer);
    try {
      job = await api('/api/publicacion');
      render(getState());
      if (['preparing', 'publishing'].includes(job?.state)) timer = setTimeout(load, 1200);
      if (job?.state === 'published') {
        await refresh();
        const panel = await api('/api/chat');
        if (panel.needsRestart && !restarting) {
          restarting = true;
          await restart();
        }
      }
    } catch (error) { feedback(error.message, true); }
  }
  async function prepare(keys) {
    if (busy) return;
    busy = true;
    try {
      job = await api('/api/publicacion/preparar', 'POST', { keys });
      location.hash = 'agentes/publicar';
      render(getState());
      document.getElementById('work-publication').scrollIntoView({ block: 'start' });
      timer = setTimeout(load, 500);
    } catch (error) { feedback(error.message, true); }
    finally { busy = false; render(getState()); }
  }
  function render(state) {
    if (!state) return;
    const pending = state.history.filter(item => item.mode === 'implementacion' &&
      !state.board.pushes?.[item.key]?.integratedRevision && state.board.reviews[item.key]?.decision !== 'cambios');
    const fresh = new Set(pending.map(item => item.key));
    for (const item of pending) {
      if (!known.has(item.key) && (item.implementation?.verified || item.key === pending[0]?.key)) selected.add(item.key);
    }
    for (const key of selected) if (!fresh.has(key)) selected.delete(key);
    known = fresh;
    host.replaceChildren(element('h2', '', 'Aceptar y publicar cambios'));
    if (job && ['preparing', 'publishing'].includes(job.state)) {
      const progress = element('progress');
      progress.setAttribute('aria-label', job.phase);
      host.append(element('p', '', job.phase + '…'), progress,
        element('p', 'muted', 'Puedes seguir el estado aquí. El resultado queda guardado aunque recargues la página.'));
      return;
    }
    if (job?.state === 'ready' || job?.state === 'retry') {
      host.append(element('p', '', job.state === 'retry' ? job.message :
        'La versión está comprobada. Al aceptar se aplicará en este equipo y se subirá a GitHub.'),
        element('p', 'muted', job.files.length + ' archivos · ' + job.sources.length + ' entregas' +
          (job.localCommits ? ' · Incluye cambios que ya habías aplicado en este equipo.' : '')));
      for (const item of job.sources) host.append(element('p', '', '✓ ' + item.title));
      const details = element('details', 'operation-file'), files = element('ul');
      for (const file of job.files) files.append(element('li', '', file));
      details.append(element('summary', '', 'Ver archivos y comprobaciones'), files);
      for (const check of job.checks) details.append(element('p', 'muted', (check.passed ? 'Correcta · ' : 'Falló · ') + check.command));
      const controls = element('div', 'actions');
      controls.append(action(job.state === 'retry' ? 'Reintentar publicación' : 'Aceptar y publicar', async () => {
        job = await api('/api/publicacion/aceptar', 'POST', { id: job.id, candidate: job.candidate });
        timer = setTimeout(load, 500);
      }));
      controls.append(action('Volver a comprobar', async () => {
        busy = false;
        await prepare([...selected]);
      }, false));
      host.append(details, controls);
      if (job.requiresRestart) host.append(element('p', 'muted', 'El panel se recargará al terminar para mostrar los cambios.'));
      if (job.requiresWeb) host.append(element('p', 'muted', 'Después podrás copiar el comando para actualizar la web en Hostinger.'));
      return;
    }
    if (job?.state === 'published') {
      host.append(element('p', 'badge ready', 'Aplicado y subido a GitHub'));
      if (job.requiresWeb) host.append(action('Copiar comando de Hostinger', () => openCommand(job.candidate)));
    }
    if (job?.state === 'failed') host.append(element('p', 'form-message', job.message));
    const list = element('div', 'publication-choices');
    for (const item of pending) {
      const label = element('label', 'publication-choice');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(item.key);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selected.add(item.key);
        else selected.delete(item.key);
      });
      label.append(checkbox, element('span', '', item.draft?.resumen || item.encargo));
      list.append(label);
    }
    host.append(element('p', 'muted', 'Selecciona las entregas. El panel reúne los cambios y comprueba la versión completa antes de pedirte que la aceptes.'), list);
    const start = button('Comprobar y preparar', () => prepare([...selected]));
    start.className = 'button primary';
    start.disabled = busy || state.batch?.running || state.batch?.state === 'paused';
    host.append(start, link('Ver resultados', '#agentes/resultados'));
  }
  return { render, prepare, load };
}
