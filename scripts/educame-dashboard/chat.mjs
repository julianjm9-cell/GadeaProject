import { OperationError } from './operations.mjs';
import { normalizeCoordination } from './coordinator.mjs';

const key = 'terrace-chat-v1';
const messageId = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const busyReply = /Hay un lote en marcha|Espera a que termine la comprobación o publicación actual|Termina o retoma el trabajo pendiente|Retoma primero el lote interrumpido|Todavía hay un mensaje en curso/;

export function createChat({ store, codex, providers, runner, implementation, readDelivery, assertIdle, instance, contextSnapshot, appCatalog }) {
  let active;
  let applying = false;
  let pumping = false;
  let closed = false;
  let activeId;
  let pumpDone = Promise.resolve();
  const entries = () => store.operation(key) || [];
  const write = rows => store.writeOperation(key, rows);
  const update = (id, changes, expected) => store.transaction(() => {
    const rows = entries();
    const row = rows.find(item => item.id === id);
    if (!row || (expected && row.state !== expected)) return false;
    write(rows.map(item => item.id === id ? { ...item, ...changes } : item));
    return true;
  });

  async function reconcile() {
    for (const row of entries()) {
      if (!(row.state === 'working' || (row.mode === 'change' && row.state === 'error') ||
        (row.batchId && row.taskIds && ['error', 'proposal'].includes(row.state))) || row.id === activeId) continue;
      if (row.batchId || row.mode === 'change') {
        const ids = row.taskIds || [row.taskId];
        const deliveries = (await Promise.all(ids.map(readDelivery))).filter(Boolean);
        const delivery = deliveries[0];
        if (row.taskIds) {
          const batch = row.batchId && store.batch(row.batchId);
          const jobs = batch?.jobs || {};
          if (ids.every(id => /^[a-f0-9]{40}$/.test(jobs[id]?.externalCompletion?.revision || '') && typeof jobs[id].externalCompletion.summary === 'string')) {
            update(row.id, { state: 'answer', previousError: row.previousError || { reply: row.reply },
              reply: 'Completado y subido a GitHub. ' + [...new Set(ids.map(id => jobs[id].externalCompletion.summary))].join(' '),
              externalCompletions: ids.map(id => jobs[id].externalCompletion), waiting: false }, row.state);
            continue;
          }
          const proposals = deliveries.filter(item => item.implementation?.verified).map(item => ({
            taskId: item.id, app: item.app, commit: item.implementation.commit, files: item.implementation.files,
            summary: item.draft?.resumen, checks: item.checks,
          }));
          const done = batch?.state === 'finished';
          if (row.state !== 'working' && !done) continue;
          const integrated = proposals.length === ids.length && proposals.every(proposal => {
            const push = store.board().pushes?.['implementacion/' + proposal.taskId];
            return push?.commit === proposal.commit && push.integratedRevision;
          });
          const next = { state: done ? (proposals.length ? 'proposal' : 'error') : 'working',
            progress: ids.map(id => ({ id, app: row.plan.tasks.find(task => task.id === id)?.app,
              request: row.plan.tasks.find(task => task.id === id)?.encargo,
              status: jobs[id]?.status || 'pendiente', error: jobs[id]?.error })),
            waiting: batch?.state === 'queued', proposals,
            reply: row.state === 'error' && !proposals.length ? row.reply : done ? integrated ? 'Cambios aplicados y subidos a GitHub.' : proposals.length === ids.length ? 'Implementación terminada. La cola continuará con la subida automática a GitHub.' :
              'Hay tareas que necesitan atención. Los resultados y las copias siguen guardados; los demás encargos pueden continuar.' : row.plan.reply,
            ...(row.state === 'error' && proposals.length ? { previousError: row.previousError || { reply: row.reply, recoveredAt: new Date().toISOString() } } : {}),
          };
          if (Object.entries(next).some(([name, value]) => JSON.stringify(row[name]) !== JSON.stringify(value))) update(row.id, next, row.state);
          continue;
        }
        if (delivery?.implementation?.verified) {
          update(row.id, { state: 'proposal', reply: delivery.draft?.resumen,
            proposal: { commit: delivery.implementation.commit, files: delivery.implementation.files,
              checks: delivery.checks, summary: delivery.draft?.entrega?.slice(0, 16000) } }, row.state);
        } else {
          const batch = row.batchId ? store.batch(row.batchId) : store.latest();
          if (row.state === 'working' && (!batch?.tasks?.some(task => task.id === row.taskId) || batch.state === 'finished')) {
            update(row.id, { state: 'error', reply: delivery?.error || batch?.jobs?.[row.taskId]?.error ||
              'La propuesta se interrumpió. Vuelve a enviarla cuando quieras retomarla.' }, 'working');
          }
        }
      } else {
        let alive = false;
        if (row.plannerPid) { try { process.kill(row.plannerPid, 0); alive = true; } catch {} }
        if (!alive) update(row.id, { state: 'queued', reply: undefined }, 'working');
      }
    }
  }
  async function read() {
    await reconcile();
    void pump().catch(() => {});
    const messages = entries();
    return { messages: messages.map(row => ({ ...row, retryable: row.state === 'error' && ((!row.batchId && row.mode === 'auto') || busyReply.test(row.reply || '')) })),
      needsRestart: messages.some(item => item.restartInstance === instance) };
  }

  async function send(body) {
    const { id, model, replyTo, provider = 'codex' } = body;
    const mode = body.mode || 'auto';
    const scope = body.scope ?? '';
    if (typeof scope !== 'string') throw new OperationError(400, 'Selecciona una conversación válida.');
    const [scopeApp, scopeArea] = scope.split('/');
    const scopedApp = scope && appCatalog?.().apps.find(app => app.id === scopeApp);
    if (typeof scope !== 'string' || (scope && (!scopedApp || !['app', 'landing', 'redes'].includes(scopeArea) || scope.split('/').length !== 2))) {
      throw new OperationError(400, 'Selecciona una conversación válida.');
    }
    if (scope && mode === 'change') throw new OperationError(400, 'Usa el modo automático para cambios en esta aplicación.');
    if (scopedApp?.personal && scopeArea !== 'app') throw new OperationError(400, 'Esta app personal no tiene landing ni redes públicas.');
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (typeof id !== 'string' || !messageId.test(id) || !['auto', 'ask', 'change'].includes(mode) || !['codex', 'openai', 'claude'].includes(provider) ||
        (replyTo !== undefined && (typeof replyTo !== 'string' || !messageId.test(replyTo))) ||
        typeof model !== 'string' || model.length > 100 || !text || text.length > 4000) {
      throw new OperationError(400, 'Elige un modelo y escribe un mensaje de hasta 4.000 caracteres.');
    }
    const duplicate = entries().find(row => row.id === id);
    if (duplicate) {
      if ((duplicate.scope || '') !== scope || duplicate.mode !== mode || duplicate.model !== model || duplicate.text !== text || duplicate.replyTo !== replyTo || (duplicate.provider || 'codex') !== provider) {
        throw new OperationError(409, 'Ese identificador ya pertenece a otro mensaje.');
      }
      if (duplicate.state === 'error' && ((!duplicate.batchId && duplicate.mode === 'auto') || busyReply.test(duplicate.reply || ''))) {
        update(id, { state: 'queued', reply: undefined }, 'error');
        await pump();
      }
      return read();
    }
    const adapter = providers ? providers.get(provider) : codex;
    const account = await adapter.status();
    if (!account.ready) throw new OperationError(503, account.message || 'Conecta Codex desde Conexiones.');
    if (!(await adapter.models?.())?.some(item => item.id === model)) {
      throw new OperationError(400, 'El modelo no figura en el catálogo de tu sesión. Actualiza la lista.');
    }
    await reconcile();
    const taskId = 'terraza-' + id;
    const source = replyTo && entries().find(row => row.id === replyTo);
    const continuations = {};
    if (source?.taskIds) for (const task of source.plan.tasks) {
      const delivery = await readDelivery(task.id);
      if (delivery?.implementation?.base) continuations[task.app] = task.id;
    }
    const previous = store.transaction(() => {
      const rows = entries();
      if (rows.some(row => row.id === id)) return null;
      if (rows.filter(row => row.state === 'queued').length >= 20) throw new OperationError(409, 'Hay veinte mensajes esperando. Deja que avancen antes de añadir más.');
      const question = replyTo && rows.find(row => row.id === replyTo);
      if (replyTo && (!question || (question.scope || '') !== scope || !['question', 'proposal', 'error'].includes(question.state) || question.answeredBy)) throw new OperationError(409, 'Ese mensaje ya tiene respuesta o sigue trabajando. Escribe un mensaje nuevo.');
      const context = question ? [question.context, 'Petición original: ' + question.text, 'Aclaración: ' + question.reply].filter(Boolean).join('\n').slice(-7000) : '';
      write([...rows.map(row => row.id === replyTo ? { ...row, answeredBy: id } : row),
        { id, text, mode, model, provider, ...(scope ? { scope, scopeContext: `Aplicación: ${scopedApp.name} (${scopeApp}). Sección: ${scopeArea}. Ruta de la app: ${scopedApp.path || '/a/' + scopeApp}. ${scopedApp.personal ? 'Es una aplicación personal privada, sin landing ni campañas públicas. No publiques datos personales ni cartas privadas en el repositorio.' : ''} ${scopedApp.existing ? '' : 'Si la app no figura entre los destinos del coordinador, usa ecosistema y limita el cambio a apps/custom/' + scopeApp + '/ y a su integración explícita. No inventes un destino desconocido.'}` } : {}), ...(replyTo ? { replyTo, context, continuations } : {}), state: 'queued', taskId, at: new Date().toISOString() }]);
      return rows;
    });
    if (!previous) return read();
    await pump();
    return read();
  }

  async function pump() {
    if (closed || pumping || active || applying) return;
    pumping = true;
    let done;
    pumpDone = new Promise(resolve => { done = resolve; });
    try {
      await reconcile();
      if (closed) return;
      const rows = entries();
      if (rows.some(row => row.state === 'working' && !row.batchId)) return;
      const row = rows.find(row => row.state === 'queued');
      if (!row) return;
      try { if (row.mode !== 'auto') assertIdle(); }
      catch (error) { if (error.status === 409) return; throw error; }
      const { id, mode, model, text, taskId } = row;
      const provider = row.provider || 'codex';
      const adapter = providers ? providers.get(provider) : codex;
      const previous = rows.slice(0, rows.findIndex(item => item.id === id));
      const history = previous.filter(item => (item.scope || '') === (row.scope || '')).filter(row => row.reply && ['answer', 'proposal', 'applied', 'question'].includes(row.state)).slice(-8)
      .map(row => ({ message: row.text.slice(0, 1700), answer: [
        row.proposal && (row.state === 'applied' ? 'Cambio aplicado localmente.' : 'Propuesta pendiente de aplicar.'),
        row.reply, row.proposal?.summary,
      ].filter(Boolean).join('\n').slice(0, 2000) }));
      if (!update(id, { state: 'working', reply: undefined, plannerPid: process.pid }, 'queued')) return;
      activeId = id;
      active = Promise.resolve().then(async () => {
      if (mode === 'auto') {
        let plan = row.plan;
        if (!plan) {
          if (!adapter.coordinate) throw new OperationError(503, 'Reinicia LA TERRAZA para cargar el coordinador de encargos. Tu mensaje está guardado.');
          const context = await contextSnapshot?.();
          const knowledge = context ? { revision: context.ecosistema?.revision,
            apps: Object.entries(context).map(([app, info]) => ({ app, accepted: info.accepted.slice(0, 2).map(fact => ({ summary: fact.summary, commit: fact.commit })) })) } : undefined;
          const result = await adapter.coordinate({ model, text: [row.scopeContext, row.context, text].filter(Boolean).join('\n\n'), history, board: store.board(), knowledge });
          plan = normalizeCoordination(result.plan, { ...row, context: [row.scopeContext, row.context].filter(Boolean).join('\n\n') }, store.board());
          // Persist the interpreted request BEFORE any implementation can start.
          update(id, { plan, tokens: result.tokens }, 'working');
        }
        if (plan.action !== 'implement') {
          update(id, { state: plan.action === 'clarify' ? 'question' : 'answer', reply: plan.reply }, 'working');
        } else {
          const batch = await runner.start({ mode: 'implementacion', engine: provider, codexModel: provider === 'codex' ? model : undefined,
            providerModel: provider === 'codex' ? undefined : model, qualityRequired: Boolean(providers), enqueue: true, tasks: plan.tasks });
          update(id, { batchId: batch.id, taskIds: plan.tasks.map(task => task.id), reply: plan.reply, waiting: batch.state === 'queued' }, 'working');
        }
      } else if (mode === 'ask') {
        const result = await adapter.ask({ model, text: [row.scopeContext, text].filter(Boolean).join('\n\n'), history });
        update(id, { state: 'answer', reply: result.answer, tokens: result.tokens }, 'working');
      } else {
        const context = history.map(item => 'Mensaje anterior\n' + item.message + '\nRespuesta\n' + item.answer).join('\n\n').slice(-7600);
        const batch = await runner.start({ mode: 'implementacion', engine: provider, codexModel: provider === 'codex' ? model : undefined,
          providerModel: provider === 'codex' ? undefined : model, qualityRequired: Boolean(providers), enqueue: true,
          tasks: [{ id: taskId, app: 'control', agente: 'codex', encargo: text.slice(0, 2000),
            contexto: [text.length > 2000 && text.slice(2000), context.slice(-5500)].filter(Boolean).join('\n\n'), revisar: '' }] });
        update(id, { batchId: batch.id }, 'working');
      }
    }).catch(error => {
      if (error.status === 409) {
        update(id, { state: 'queued', reply: undefined }, 'working');
        return;
      }
      update(id, { state: 'error', reply: error.status ? error.message : 'Codex no completó este mensaje. Puedes volver a enviarlo.' }, 'working');
      }).finally(() => { active = null; activeId = undefined; });
    } finally { pumping = false; done(); }
  }

  async function proposal(id) {
    const row = (await read()).messages.find(item => item.id === id);
    if (!row?.proposal) throw new OperationError(404, 'La propuesta todavía no está disponible.');
    const delivery = await readDelivery(row.taskId);
    if (delivery?.app !== 'control' || delivery.implementation?.commit !== row.proposal.commit) {
      throw new OperationError(409, 'La entrega ya no coincide con la propuesta.');
    }
    return { row, artifact: delivery.implementation };
  }

  return { read, send, pump, close() { closed = true; }, async wait() { await pumpDone; await active; },
    async review(id) {
      const { artifact } = await proposal(id);
      return implementation.reviewTerrace(artifact);
    },
    async apply({ id, commit }) {
      if (applying) throw new OperationError(409, 'Ya se está aplicando una propuesta.');
      applying = true;
      try {
        assertIdle();
        if (active) throw new OperationError(409, 'Espera a que termine el mensaje actual.');
        const { row, artifact } = await proposal(id);
        if (commit !== artifact.commit) throw new OperationError(409, 'Vuelve a revisar el commit antes de aplicar.');
        if (row.state === 'applied') return read();
        await implementation.applyTerrace(artifact);
        update(id, { state: 'applied', restartInstance: instance }, 'proposal');
        return read();
      } finally { applying = false; }
    },
    assertIdle() {
      if (applying) throw new OperationError(409, 'Espera a que termine el trabajo del chat.');
      assertIdle();
    },
  };
}
