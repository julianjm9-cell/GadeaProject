const $ = id => document.getElementById(id);
const preference = 'terrace-chat-model';
const pendingKey = 'terrace-chat-pending';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export function setupChat({ api, element, button, feedback, formMessage, preparePublication, getState }) {
  const form = $('chat-form');
  const model = $('chat-model');
  const mode = $('chat-mode');
  const input = form.elements.text;
  const submit = form.querySelector('[type=submit]');
  const log = $('chat-messages');
  const refresh = $('chat-refresh-models');
  const review = $('chat-review');
  const apply = $('chat-apply');
  const restart = $('chat-restart').querySelector('button');
  let snapshot;
  let pending;
  let catalog = [];
  let modelStatus = 'Consultando modelos…';
  let sending = false;
  let loading;
  let timer;
  let selected;
  let publications;
  let replyTo;
  replyTo = pending?.replyTo;
  const draftKey = 'terrace-chat-draft';
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey));
    if (draft && !pending) { input.value = draft.text || ''; replyTo = draft.replyTo; }
  } catch {}
  try {
    pending = JSON.parse(sessionStorage.getItem(pendingKey));
    if (pending) { input.value = pending.text; mode.value = pending.mode; }
  } catch {}

  const visible = () => !$('chat-title').closest('[data-page]').hidden;
  const isWorking = () => snapshot?.messages.some(item => item.state === 'working');
  const queued = () => snapshot?.messages.filter(item => item.state === 'queued').length || 0;
  const hasPending = () => isWorking() || queued() > 0;
  function controls() {
    submit.disabled = !snapshot || !model.value || sending;
    $('chat-status').textContent = sending ? 'Enviando…' : queued() ?
      queued() + ' en espera. Se enviarán automáticamente cuando termine el trabajo actual.' :
      isWorking() ? 'Codex está trabajando. Puedes añadir otro mensaje.' : modelStatus;
    const change = mode.value === 'change';
    $('chat-mode-hint').textContent = mode.value === 'auto' ?
      'Pregunta o pide cambios en tus apps y en LA TERRAZA. Si falta algo, te preguntará aquí. Después solo tendrás que pulsar Subir.' : change ?
      'Codex prepara el cambio. Si hay otro trabajo en marcha, lo guarda y continúa después.' :
      'Pregunta sobre LA TERRAZA o cualquier otro tema. Codex usa los mensajes recientes para seguir el hilo.';
    input.placeholder = mode.value === 'auto' ? 'Ejemplo: mejora el juego de fracciones de Profesor Particular y simplifica las tarjetas de LA TERRAZA.' : change ? 'Ejemplo: haz más fácil encontrar las entregas pendientes.' :
      'Ejemplo: ¿cómo se diferencia un commit de una propuesta en GitHub?';
    const context = $('chat-reply-context');
    if (context) {
      const question = snapshot?.messages.find(item => item.id === replyTo);
      context.hidden = !question;
      context.replaceChildren();
      if (question) context.append(element('span', '', 'Respondiendo: ' + question.reply), button('Cancelar respuesta', () => { replyTo = undefined; saveDraft(); controls(); }));
    }
  }
  function saveDraft() { try { localStorage.setItem(draftKey, JSON.stringify({ text: input.value, replyTo })); } catch {} }
  input.addEventListener('input', saveDraft);
  function respond(item) { replyTo = item.id; mode.value = 'auto'; saveDraft(); controls(); input.focus(); }

  function render(data) {
    clearTimeout(timer);
    const published = JSON.stringify(getState()?.board.pushes);
    const changed = JSON.stringify(snapshot?.messages) !== JSON.stringify(data.messages) || publications !== published;
    publications = published;
    snapshot = data;
    $('chat-restart').hidden = !data.needsRestart;
    if (changed) {
      const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
      log.replaceChildren(...data.messages.map(turn));
      if (!data.messages.length) log.append(element('p', 'muted', 'Escribe tu primer mensaje para empezar.'));
      if (atEnd) log.scrollTop = log.scrollHeight;
    }
    controls();
    if (visible() && hasPending()) timer = setTimeout(load, 1200);
  }
  function turn(item) {
    const section = element('article', 'chat-turn');
    const user = element('div', 'chat-bubble chat-user');
    user.append(element('small', '', item.mode === 'change' ? 'Tú · Cambio en LA TERRAZA' : item.mode === 'auto' ? 'Tú' : 'Tú · Consulta'), element('p', '', item.text));
    const reply = element('div', 'chat-bubble');
    reply.append(element('small', '', 'Codex · ' + (catalog.find(entry => entry.id === item.model)?.label || item.model)));
    if (item.state === 'queued') {
      reply.append(element('p', 'muted', 'En espera. Se ejecutará automáticamente al terminar el trabajo anterior.'));
    } else if (item.state === 'working') {
      reply.append(element('p', 'muted', item.waiting ? 'Encargo guardado. Empezará automáticamente cuando termine el anterior.' : item.batchId ? item.reply || 'Preparando los cambios…' : 'Leyendo tu mensaje…'));
      if (item.batchId || item.mode === 'change') {
        const queue = element('a', 'text-link', 'Ver cola de trabajo →');
        queue.href = '#operaciones';
        reply.append(queue);
      }
    } else {
      reply.append(element('p', item.retryable ? 'muted' : item.state === 'error' ? 'form-message' : '', item.retryable ?
        'Este mensaje no llegó a ejecutarse porque había otro trabajo en marcha.' : item.reply || 'Propuesta preparada.'));
      if (item.retryable) {
        const retry = button('Reintentar', async () => {
          retry.disabled = true;
          try { render(await api('/api/chat', 'POST', { id: item.id, mode: item.mode, model: item.model, text: item.text, ...(item.replyTo ? { replyTo: item.replyTo } : {}) })); }
          catch (error) { feedback(error.message, true); }
          finally { retry.disabled = false; }
        });
        reply.append(retry);
      }
      if (item.state === 'question' && !item.answeredBy) reply.append(button('Responder', () => respond(item)));
      if (item.taskIds?.length && ['proposal', 'error'].includes(item.state) && !item.answeredBy) {
        reply.append(button('Pedir ajustes', () => respond(item)));
      }
      if (item.proposals?.length) {
        const pending = item.proposals.filter(proposal => !getState()?.board.pushes?.['implementacion/' + proposal.taskId]?.integratedRevision);
        reply.append(pending.length ? button('Subir', () => preparePublication(pending.map(proposal => 'implementacion/' + proposal.taskId))) :
          element('strong', '', 'Aplicados y subidos a GitHub'));
      }
      if (item.proposal) {
        if (item.proposal.summary) reply.append(element('p', 'muted', item.proposal.summary));
        if (getState()?.board.pushes?.['implementacion/' + item.taskId]?.integratedRevision) reply.append(element('strong', '', 'Aplicada y subida a GitHub'));
        else if (item.state === 'applied') reply.append(element('strong', '', 'Aplicada en este equipo'));
        else reply.append(button('Subir', () => preparePublication(['implementacion/' + (item.taskId || 'terraza-' + item.id)])));
      }
      if (item.mode === 'change' && item.taskId) {
        const delivery = element('a', 'text-link', 'Ir a los cambios →');
        delivery.href = '#entregas/' + item.taskId;
        reply.append(delivery);
      }
    }
    if (item.progress?.length) {
      const list = element('ul', 'chat-task-progress');
      for (const task of item.progress) {
        const title = getState()?.projectProfiles?.[task.app]?.name || task.app;
        const label = task.status === 'en curso' ? 'En curso' : task.status === 'completado' ? 'Completado' :
          ['fallido', 'interrumpido', 'bloqueado'].includes(task.status) ? 'Necesita atención' : 'En espera';
        const row = element('li', '', title + ' · ' + label);
        if (task.request) row.append(element('small', '', task.request));
        if (task.error) row.append(element('small', 'muted', task.error));
        if (['fallido', 'interrumpido', 'bloqueado'].includes(task.status)) {
          const link = element('a', 'text-link', 'Ver trabajo →'); link.href = '#entregas/' + task.id; row.append(link);
        }
        list.append(row);
      }
      reply.append(list);
    }
    if (Number.isFinite(item.tokens)) reply.append(element('small', '', item.tokens.toLocaleString('es-ES') + ' tokens'));
    section.append(user, reply);
    return section;
  }

  function load() {
    if (!loading) loading = api('/api/chat').then(render).catch(error => {
      formMessage(form, error.message);
      if (visible() && hasPending()) timer = setTimeout(load, 2400);
    }).finally(() => { loading = null; });
    return loading;
  }
  async function loadModels(fresh = false) {
    if (refresh.disabled) return;
    refresh.disabled = true;
    try {
      const result = await api('/api/chat/modelos' + (fresh ? '?actualizar=1' : ''));
      catalog = result.ready ? result.models : [];
      let stored = pending?.model;
      try { stored ||= localStorage.getItem(preference); } catch {}
      const selectedModel = model.value || stored;
      model.replaceChildren(...catalog.map(item => new Option(item.label + (item.recommended ? ' · Recomendado' : ''), item.id)));
      if (catalog.some(item => item.id === selectedModel)) model.value = selectedModel;
      else if (catalog.some(item => item.recommended)) model.value = catalog.find(item => item.recommended).id;
      modelStatus = catalog.length ? '' : result.ready ? 'Codex aún no devolvió el catálogo. Actualiza los modelos.' : result.message;
      if (snapshot) {
        const data = snapshot;
        snapshot = null;
        render(data);
      }
    } catch (error) { modelStatus = error.message; }
    finally { refresh.disabled = false; controls(); }
  }
  model.addEventListener('change', () => { try { localStorage.setItem(preference, model.value); } catch {} });
  mode.addEventListener('change', controls);
  refresh.addEventListener('click', () => loadModels(true));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const text = input.value.trim();
    if (!text) return formMessage(form, 'Escribe un mensaje para Codex.');
    const request = { text, model: model.value, mode: mode.value, ...(replyTo ? { replyTo } : {}) };
    if (!pending || Object.keys(request).some(key => request[key] !== pending[key])) {
      pending = { id: crypto.randomUUID(), ...request };
    }
    try { sessionStorage.setItem(pendingKey, JSON.stringify(pending)); } catch {}
    sending = true;
    formMessage(form);
    controls();
    try {
      if (loading) await loading;
      render(await api('/api/chat', 'POST', pending));
      if (input.value.trim() === text && model.value === request.model && mode.value === request.mode) { input.value = ''; replyTo = undefined; saveDraft(); }
      pending = null;
      try { sessionStorage.removeItem(pendingKey); } catch {}
      log.scrollTop = log.scrollHeight;
    } catch (error) { formMessage(form, error.message); }
    finally { sending = false; controls(); }
  });

  async function openReview(item) {
    if (review.open) return;
    selected = item;
    $('chat-review-commit').textContent = 'Commit ' + item.proposal.commit.slice(0, 10);
    $('chat-review-diff').textContent = 'Cargando las diferencias…';
    $('chat-review-note').textContent = 'Subir aplica y guarda los cambios en GitHub. El resto se hace automáticamente.';
    $('chat-review-error').hidden = true;
    apply.disabled = true;
    review.showModal();
    try {
      const result = await api('/api/chat/propuesta?id=' + encodeURIComponent(item.id));
      if (selected !== item || !review.open) return;
      $('chat-review-diff').textContent = result.patch;
      if (result.truncated) $('chat-review-note').textContent += ' La vista muestra los primeros 90.000 caracteres del diff.';
      apply.disabled = false;
    } catch (error) {
      $('chat-review-error').textContent = error.message;
      $('chat-review-error').hidden = false;
    }
  }
  apply.addEventListener('click', async () => {
    if (apply.disabled || !selected) return;
    const controls = review.querySelectorAll('button');
    controls.forEach(node => { node.disabled = true; });
    $('chat-review-error').hidden = true;
    try {
      review.close();
      await preparePublication(['implementacion/' + (selected.taskId || 'terraza-' + selected.id)]);
    } catch (error) {
      $('chat-review-error').textContent = error.message;
      $('chat-review-error').hidden = false;
    } finally { controls.forEach(node => { node.disabled = false; }); }
  });
  async function restartPanel() {
    restart.disabled = true;
    restart.textContent = 'Reiniciando…';
    try {
      await api('/api/chat/reiniciar', 'POST', {});
      for (let attempt = 0; attempt < 35; attempt++) {
        await pause(500);
        const data = await api('/api/chat').catch(() => null);
        if (data && !data.needsRestart) { location.reload(); return; }
      }
      throw new Error('El panel aún no responde. Abre el acceso directo de LA TERRAZA.');
    } catch (error) { feedback(error.message, true); }
    finally { restart.disabled = false; restart.textContent = 'Reiniciar LA TERRAZA'; }
  }
  restart.addEventListener('click', restartPanel);
  return { restart: restartPanel, open() { load(); if (!catalog.length) loadModels(); } };
}
