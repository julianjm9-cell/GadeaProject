export function setupPublication({ api, element, button, feedback, getState, refresh, restart }) {
  const host = document.getElementById('queue-publication');
  let job, busy = false, restarting = false;
  async function undo() {
    if (busy) return;
    const previous = job?.lastPublished || job;
    busy = true; render(getState());
    try {
      job = await api('/api/publicacion/deshacer', 'POST', { id: previous.id, candidate: previous.candidate });
      await refresh();
    } catch (error) { feedback(error.message, true); }
    finally { busy = false; render(getState()); }
  }
  function render(state) {
    if (!state) return;
    job = state.publication || job;
    host.replaceChildren();
    const running = ['queued', 'preparing', 'publishing'].includes(job?.state);
    const last = job?.lastPublished || (job?.state === 'published' ? job : null);
    const canUndo = last && !last.undoOf && last.files?.length && (!state.currentRevision || state.currentRevision === last.candidate);
    host.hidden = !running && !canUndo;
    if (running) host.append(element('span', 'muted', job.undoOf ? 'Deshaciendo la última subida…' : 'Subiendo los encargos terminados a GitHub…'));
    else if (canUndo) {
      host.append(element('span', 'muted', 'Última subida · ' + last.candidate.slice(0, 7)));
      const control = button('Deshacer última subida', undo);
      control.disabled = busy;
      host.append(control);
    }
    if (state.terraceNeedsRestart && !running && !state.batch?.running && !state.pendingBatches?.length && !restarting) {
      restarting = true;
      restart().catch(() => {}).finally(() => { restarting = false; });
    }
  }
  return { render, async load() { job = await api('/api/publicacion'); render(getState()); },
    async upload(keys) {
      // Compatibility for saved links and old clients; the current queue never asks for this step.
      await api('/api/publicacion/subir', 'POST', { id: crypto.randomUUID(), keys });
      await refresh();
    },
  };
}
