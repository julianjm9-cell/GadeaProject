export function setupWorkProgress({ element, button, badge, openDelivery }) {
  const terminal = new Set(['completado', 'borrador', 'fallido', 'bloqueado', 'interrumpido']);

  function deliveryStatus(delivery, board) {
    if (delivery.mode === 'prueba') return ['Simulación terminada', 'demo'];
    if (!delivery.draft) return ['Necesita atención', 'error'];
    if (delivery.implementation && !delivery.implementation.verified) return ['Requiere comprobación', 'pending'];
    const review = board.reviews[delivery.key];
    const approved = review?.decision === 'aprobada' &&
      (!delivery.implementation || review.commit === delivery.implementation.commit);
    const published = board.pushes?.[delivery.key];
    if (published?.integratedRevision || published?.pull?.merged) return ['Integrado en GitHub', 'ready'];
    if (published) return ['Pendiente de fusión', 'pending'];
    if (review?.decision === 'cambios') return ['Cambios solicitados', 'pending'];
    if (approved) return [delivery.implementation ? 'Listo para publicar' : 'Revisado', 'ready'];
    return ['Por revisar', 'pending'];
  }

  function statusBadge(delivery, board) {
    const [label, color] = deliveryStatus(delivery, board);
    return element('span', 'badge ' + color, label);
  }

  function needsAttention(delivery, board) {
    return delivery.mode !== 'prueba' && ['Necesita atención', 'Requiere comprobación', 'Por revisar', 'Cambios solicitados']
      .includes(deliveryStatus(delivery, board)[0]);
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
          actions.append(button(delivery.implementation && !delivery.implementation.verified ? 'Resolver comprobaciones' : 'Ver resultado',
            () => openDelivery(delivery)));
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
    const activeCount = batch?.running ? batch.tasks.filter(task => !terminal.has(batch.jobs[task.id]?.status)).length : 0;
    const attention = history.filter(item => needsAttention(item, board)).length;
    for (const [id, count] of [['work-queue-count', board.tasks.length], ['work-running-count', activeCount], ['work-review-count', attention]]) {
      document.getElementById(id).textContent = count;
    }
  }
  return { render, statusBadge, needsAttention };
}
