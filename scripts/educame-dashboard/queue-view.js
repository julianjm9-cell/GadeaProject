const failing = new Set(['fallido', 'bloqueado', 'interrumpido', 'borrador']);
export function queueEntries(state, messages = []) {
  if (!state) return [];
  const entries = [], seen = new Set();
  const continued = new Set((state.batches || []).flatMap(batch => batch.tasks.map(task => task.continuar)).filter(Boolean));
  for (const batch of state.batches || []) for (const task of batch.tasks) {
    if (seen.has(task.id) || continued.has(task.id)) continue;
    seen.add(task.id);
    const source = messages.find(message => message.batchId === batch.id) || (task.continuar && messages.find(message => message.taskIds?.includes(task.continuar) || message.taskId === task.continuar));
    const delivery = state.history.find(item => item.id === task.id && item.mode === batch.mode);
    const push = state.board.pushes?.['implementacion/' + task.id];
    const uploaded = push?.integratedRevision && (!delivery || push.commit === delivery.implementation?.commit);
    const attempt = state.automaticUploads?.[task.id];
    const job = batch.jobs[task.id];
    const external = job?.externalCompletion;
    const resolved = /^[a-f0-9]{40}$/.test(external?.revision || '') && typeof external.summary === 'string';
    let status = 'queued', detail = 'Empezará automáticamente cuando llegue su turno.';
    if (resolved) { status = 'completed'; detail = external.summary + ' · GitHub ' + external.revision.slice(0, 7); }
    else if (uploaded) { status = push.undoneRevision ? 'undone' : 'completed'; detail = push.undoneRevision ? 'Se ha deshecho esta subida.' : 'Guardado en GitHub · ' + push.integratedRevision.slice(0, 7); }
    else if (['failed', 'attention'].includes(attempt?.state)) { status = 'attention'; detail = attempt.message; }
    else if (attempt?.state === 'uploading') { status = 'publishing'; detail = 'Comprobando e integrando los cambios para subirlos a GitHub.'; }
    else if (batch.state === 'paused' || failing.has(job?.status)) { status = 'attention'; detail = job?.error || batch.error || delivery?.error || 'El encargo necesita una corrección. Su copia sigue guardada.'; }
    else if (batch.state === 'finished') {
      if (batch.mode !== 'implementacion') { status = 'completed'; detail = 'Resultado disponible.'; }
      else if (delivery?.implementation?.verified) { status = 'publishing'; detail = 'Se está preparando la subida automática a GitHub.'; }
      else { status = 'attention'; detail = delivery?.error || 'No se ha podido completar el encargo. Su copia sigue guardada.'; }
    } else if (job?.status === 'en curso' || (job?.status === 'completado' && batch.state === 'running')) { status = 'running'; detail = 'El agente está implementando y comprobando el encargo.'; }
    entries.push({ id: task.id, title: task.encargo, app: task.app, agent: task.agentName || task.agente,
      status, detail, at: batch.queuedAt || batch.startedAt, batch, delivery, source,
      publicationRetry: attempt?.state === 'failed' });
  }
  for (const message of messages) {
    if (message.batchId && (state.batches || []).some(batch => batch.id === message.batchId)) continue;
    // Older chat receipts remain visible even after their batch leaves the recent window.
    const ids = message.taskIds || (message.proposal ? [message.taskId] : []);
    if (ids.length && ids.every(id => continued.has(id))) continue;
    const published = ids.length && ids.every(id => state.board.pushes?.['implementacion/' + id]?.integratedRevision);
    entries.push({ id: message.id, title: message.text, source: message, at: message.at,
      status: published ? (ids.some(id => state.board.pushes['implementacion/' + id].undoneRevision) ? 'undone' : 'completed') :
        ({ queued: 'queued', working: 'running', question: 'question', error: 'attention', answer: 'completed' })[message.state] || 'attention',
      detail: message.reply || (message.state === 'queued' ? 'Mensaje guardado en la cola.' : 'Entendiendo tu petición…') });
  }
  const order = { running: 0, publishing: 0, question: 1, attention: 2, queued: 3, completed: 4, undone: 4 };
  return entries.sort((a, b) => order[a.status] - order[b.status] || (b.at || '').localeCompare(a.at || ''));
}

export function renderQueue({ state, messages, host, element, button, respond, retry, resume, retryMessage, adjust, openReport, scope = '' }) {
  const labels = { queued: 'En cola', running: 'En curso', publishing: 'Subiendo a GitHub', completed: 'Completado',
    question: 'Necesita tu respuesta', attention: 'Necesita atención', undone: 'Deshecho' };
  const entries = queueEntries(state, messages).filter(row => !scope || row.source?.scope === scope);
  for (const [id, statuses] of [['queue-waiting', ['queued']], ['queue-active', ['running', 'publishing']], ['queue-done', ['completed']]]) {
    document.getElementById(id).textContent = entries.filter(row => statuses.includes(row.status)).length;
  }
  host.replaceChildren(...entries.map(row => {
    const card = element('article', 'order-card order-' + row.status);
    card.dataset.orderId = row.id;
    const heading = element('div', 'order-heading'), copy = element('div');
    copy.append(element('small', 'order-meta', [state?.projectProfiles?.[row.app]?.name || row.app,
      row.agent || ({ codex: 'Codex local', openai: 'OpenAI API', claude: 'Claude API' })[row.source?.provider || 'codex'], row.at && new Date(row.at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })].filter(Boolean).join(' · ')),
      element('h3', '', row.title));
    heading.append(copy, element('span', 'order-status', labels[row.status]));
    let detailText = row.detail;
    if (row.source?.retryable) detailText = 'Este mensaje antiguo no llegó a ejecutarse. Puedes reintentarlo.';
    else if (/^Falta la entrega de /.test(detailText || '')) detailText = 'Depende de otro encargo que todavía necesita una corrección.';
    else if (/La revisión conserva puntos pendientes/.test(detailText || '')) detailText = 'Quedan ajustes pendientes. Pide al agente que los resuelva desde esta tarjeta.';
    card.append(heading, element('p', 'order-detail', detailText));
    const actions = element('div', 'actions');
    if (row.delivery?.mode === 'real') actions.append(button('Ver resultado', () => openReport(row.delivery)));
    if (row.source?.state === 'question' && !row.source.answeredBy) actions.append(button('Responder', () => respond(row.source)));
    if (row.publicationRetry) actions.append(button('Reintentar', () => retry(row.id)));
    else if (row.status !== 'completed' && row.batch?.state === 'paused') actions.append(button('Retomar', () => resume(row.batch.id)));
    else if (row.source?.retryable) actions.append(button('Reintentar', () => retryMessage(row.source)));
    else if (row.status === 'attention' && row.delivery?.implementation) actions.append(button('Pedir ajuste', () => adjust(row.delivery)));
    else if (row.status === 'attention' && row.source && !row.source.answeredBy) actions.append(button('Pedir ajuste', () => respond(row.source)));
    const result = row.delivery?.draft?.entrega || (row.delivery?.draft && JSON.stringify(row.delivery.draft, null, 2));
    if (result) {
      const detail = element('details', 'order-result');
      detail.append(element('summary', '', 'Resultado'), element('p', '', result));
      card.append(detail);
    }
    if (actions.childElementCount) card.append(actions);
    return card;
  }));
  if (!entries.length) host.append(element('p', 'queue-empty', 'Tu cola está vacía. Escribe arriba el primer encargo.'));
}
