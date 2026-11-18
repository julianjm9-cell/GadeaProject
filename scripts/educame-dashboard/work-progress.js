export function deliveryStatus(delivery, board, attempt) {
    if (/^[a-f0-9]{40}$/.test(delivery.externalCompletion?.revision || '') && typeof delivery.externalCompletion.summary === 'string') return ['Completado en GitHub', 'ready'];
    if (delivery.mode === 'prueba') return ['Simulación terminada', 'demo'];
    if (!delivery.draft) return ['Necesita atención', 'error'];
    const review = board.reviews[delivery.key];
    const approved = review?.decision === 'aprobada' &&
      (!delivery.implementation || review.commit === delivery.implementation.commit);
    const published = board.pushes?.[delivery.key];
    if (published?.undoneRevision) return ['Subida deshecha', 'pending'];
    if (published?.integratedRevision || published?.pull?.merged) return ['Integrado en GitHub', 'ready'];
    if (published) return ['Pendiente de fusión', 'pending'];
    if (['failed', 'attention'].includes(attempt?.state)) return ['Necesita atención', 'error'];
    if (review?.decision === 'cambios') return ['Cambios solicitados', 'pending'];
    if (delivery.implementation && !delivery.implementation.verified) return ['Necesita atención', 'error'];
    if (delivery.implementation?.verified) return ['Subiendo a GitHub', 'pending'];
    if (approved) return [delivery.implementation ? 'Listo para publicar' : 'Revisado', 'ready'];
    return ['Por revisar', 'pending'];
}

export function setupWorkProgress({ element, button, badge, openDelivery, upload, getState }) {
  const terminal = new Set(['completado', 'borrador', 'fallido', 'bloqueado', 'interrumpido']);
  const attemptFor = delivery => getState?.()?.automaticUploads?.[delivery.id];

  function statusBadge(delivery, board) {
    const [label, color] = deliveryStatus(delivery, board, attemptFor(delivery));
    return element('span', 'badge ' + color, label);
  }

  function needsAttention(delivery, board) {
    return delivery.mode !== 'prueba' && ['Necesita atención', 'Por revisar']
      .includes(deliveryStatus(delivery, board, attemptFor(delivery))[0]);
  }

  function render(state) {
    const { batch, board, history, projectProfiles } = state;
    const progress = document.querySelector('#team-activity');
    if (!batch?.tasks?.length) {
      progress.hidden = true;
    } else {
      progress.hidden = false;
      const finished = batch.tasks.filter(task => terminal.has(batch.jobs[task.id]?.status)).length;
      const heading = element('div', 'card-heading');
      heading.append(element('h2', '', batch.running ? 'Trabajando ahora' :
        batch.state === 'paused' ? 'Trabajo interrumpido' : 'Último trabajo'));
      const summary = element('p', 'muted', finished + ' de ' + batch.tasks.length + ' encargos procesados');
      const bar = element('progress', 'work-total-progress');
      bar.max = batch.tasks.length;
      bar.value = finished;
      bar.setAttribute('aria-label', 'Encargos procesados del último trabajo');
      const items = element('div', 'work-task-list');
      for (const task of batch.tasks) {
        const job = batch.jobs[task.id];
        const delivery = history.find(item => item.id === task.id && item.mode === batch.mode);
        const row = element('article', 'work-task batch-chip');
        const copy = element('div', 'work-task-copy');
        copy.append(element('small', '', [task.agentName, projectProfiles[task.app]?.name].filter(Boolean).join(' · ')),
          element('h3', '', task.encargo));
        const actions = element('div', 'actions');
        actions.append(delivery ? statusBadge(delivery, board) :
          badge(batch.state === 'paused' && job?.status === 'en curso' ? 'interrumpido' : job?.status));
        if (delivery) {
          if (delivery.mode === 'implementacion') {
            if (delivery.draft?.resumen) copy.append(element('p', 'muted', delivery.draft.resumen));
            if (delivery.quality?.reviewed) copy.append(element('small', '', 'Revisión independiente completada · ' + delivery.quality.reviewer));
            if (delivery.implementation?.verified && !['control', 'ecosistema'].includes(delivery.app)) {
              const preview = element('a', 'button secondary', 'Ver en local');
              preview.href = '/vista-encargo/' + delivery.id; preview.target = '_blank'; preview.rel = 'noopener';
              actions.append(preview);
            }
            if (!board.pushes?.[delivery.key]?.integratedRevision && board.reviews[delivery.key]?.decision !== 'cambios') {
              actions.append(button('Subir', () => upload([delivery.key])));
            }
          } else actions.append(button('Ver resultado', () => openDelivery(delivery)));
        } else if (job?.status === 'en curso' && batch.running) {
          const running = element('progress', 'work-running');
          running.setAttribute('aria-label', 'El agente está trabajando');
          copy.append(running);
        }
        if (job?.status === 'espera') copy.append(element('p', 'muted', 'Empezará cuando termine el encargo que debe revisar.'));
        if (job?.error) copy.append(element('p', 'form-message', job.error));
        row.append(copy, actions);
        items.append(row);
      }
      progress.replaceChildren(heading, summary, bar, items);
      if (batch.error) progress.append(element('p', 'form-message', batch.error));
    }
    const pending = state.pendingBatches || [];
    if (pending.length) {
      progress.hidden = false;
      const list = element('div', 'chat-task-progress');
      list.append(element('h3', '', 'Encargos guardados para después'));
      for (const batch of pending) for (const task of batch.tasks) {
        list.append(element('p', 'muted', (projectProfiles[task.app]?.name || task.app) + ' · ' + task.encargo));
      }
      progress.append(list);
    }
    const activeCount = batch?.running ? batch.tasks.filter(task => !terminal.has(batch.jobs[task.id]?.status)).length : 0;
    const attention = history.filter(item => needsAttention(item, board)).length;
    for (const [id, count] of [['work-queue-count', board.tasks.length + pending.reduce((sum, batch) => sum + batch.tasks.length, 0)], ['work-running-count', activeCount], ['work-review-count', attention]]) {
      document.getElementById(id).textContent = count;
    }
  }
  return { render, statusBadge, needsAttention };
}
