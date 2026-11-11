export function setupPublication({ api, element, button, feedback, getState, refresh, restart, openCommand }) {
  const host = document.getElementById('work-publication');
  let job, busy = false, timer, restarting = false, pending;
  try { pending = JSON.parse(sessionStorage.getItem('terrace-upload-pending')); } catch {}
  const running = () => busy || ['preparing', 'publishing'].includes(job?.state);
  function remember(value) {
    pending = value;
    try {
      if (value) sessionStorage.setItem('terrace-upload-pending', JSON.stringify(value));
      else sessionStorage.removeItem('terrace-upload-pending');
    } catch {}
  }
  async function load() {
    clearTimeout(timer);
    try {
      job = await api('/api/publicacion');
      render(getState());
      if (['preparing', 'publishing'].includes(job?.state)) timer = setTimeout(load, 1200);
      if (job?.state === 'published') {
        remember(null);
        await refresh();
        const panel = await api('/api/chat');
        if (panel.needsRestart && !restarting) {
          restarting = true;
          await restart();
        }
      }
      if (job?.state === 'failed') remember(null);
    } catch (error) {
      feedback(error.message, true);
      if (['preparing', 'publishing'].includes(job?.state)) timer = setTimeout(load, 2400);
    }
  }
  async function upload(keys) {
    if (running()) return;
    busy = true;
    render(getState());
    if (!pending || JSON.stringify(pending.keys) !== JSON.stringify(keys)) remember({ id: crypto.randomUUID(), keys });
    try {
      job = await api('/api/publicacion/subir', 'POST', pending);
      location.hash = 'agentes/publicar';
      host.scrollIntoView({ block: 'start' });
      timer = setTimeout(load, 500);
    } catch (error) { feedback(error.message, true); }
    finally { busy = false; render(getState()); }
  }
  function render(state) {
    if (!state) return;
    host.replaceChildren(element('h2', '', 'Subir cambios'));
    if (running()) {
      const progress = element('progress');
      progress.setAttribute('aria-label', 'Subiendo cambios');
      host.append(element('p', '', 'Estamos preparando y subiendo tus cambios…'), progress,
        element('p', 'muted', 'Puedes dejar esta pantalla abierta. Todo el proceso es automático.'));
      return;
    }
    const pendingItems = state.history.filter(item => item.mode === 'implementacion' &&
      !state.board.pushes?.[item.key]?.integratedRevision && state.board.reviews[item.key]?.decision !== 'cambios');
    if (job?.state === 'published') {
      host.append(element('p', 'badge ready', 'Subido a GitHub'));
      if (job.requiresWeb) host.append(button('Copiar comando de Hostinger', () => openCommand(job.candidate)));
    }
    if (['failed', 'retry'].includes(job?.state)) {
      host.append(element('p', 'form-message', job.state === 'retry' ?
        'No se confirmó la subida. Pulsa Subir para retomarla.' :
        'No se pudo completar la subida. Tus cambios están guardados. Puedes pulsar Subir o pedir cambios en la entrega.'));
    }
    if (pendingItems.length) {
      const list = element('ul');
      for (const item of pendingItems) list.append(element('li', '', item.draft?.resumen || item.encargo));
      const submit = button('Subir', () => upload(pendingItems.map(item => item.key)));
      submit.className = 'button primary';
      submit.disabled = state.batch?.running || state.batch?.state === 'paused';
      host.append(list, submit);
    } else if (['ready', 'retry', 'failed'].includes(job?.state) && job.keys?.length) {
      const submit = button('Subir', () => upload(job.keys));
      submit.className = 'button primary';
      host.append(submit);
    } else if (job?.state !== 'published') host.append(element('p', 'muted', 'Las entregas aparecerán aquí cuando estén listas.'));
  }
  return { render, upload, load };
}
