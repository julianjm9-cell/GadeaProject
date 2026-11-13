import { OperationError } from './operations.mjs';

const key = 'terrace-chat-v1';
const messageId = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const busyReply = /Hay un lote en marcha|Espera a que termine la comprobación o publicación actual|Termina o retoma el trabajo pendiente|Retoma primero el lote interrumpido|Todavía hay un mensaje en curso/;

export function createChat({ store, codex, runner, implementation, readDelivery, assertIdle, instance }) {
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
      if (!(row.state === 'working' || (row.mode === 'change' && row.state === 'error')) || row.id === activeId) continue;
      if (row.mode === 'change') {
        const delivery = await readDelivery(row.taskId);
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
      } else update(row.id, { state: 'error', reply: 'La consulta se interrumpió. Puedes volver a enviarla.' }, 'working');
    }
  }
  async function read() {
    await reconcile();
    void pump().catch(() => {});
    const messages = entries();
    return { messages: messages.map(row => ({ ...row, retryable: row.state === 'error' && busyReply.test(row.reply || '') })),
      needsRestart: messages.some(item => item.restartInstance === instance) };
  }

  async function send(body) {
    const { id, mode, model } = body;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (typeof id !== 'string' || !messageId.test(id) || !['ask', 'change'].includes(mode) ||
        typeof model !== 'string' || model.length > 100 || !text || text.length > 4000) {
      throw new OperationError(400, 'Elige un modelo y escribe un mensaje de hasta 4.000 caracteres.');
    }
    const duplicate = entries().find(row => row.id === id);
    if (duplicate) {
      if (duplicate.mode !== mode || duplicate.model !== model || duplicate.text !== text) {
        throw new OperationError(409, 'Ese identificador ya pertenece a otro mensaje.');
      }
      if (duplicate.state === 'error' && busyReply.test(duplicate.reply || '')) {
        update(id, { state: 'queued', reply: undefined }, 'error');
        await pump();
      }
      return read();
    }
    const account = await codex.status();
    if (!account.ready) throw new OperationError(503, account.message || 'Conecta Codex desde Conexiones.');
    if (!(await codex.models?.())?.some(item => item.id === model)) {
      throw new OperationError(400, 'El modelo no figura en el catálogo de tu sesión. Actualiza la lista.');
    }
    await reconcile();
    const taskId = 'terraza-' + id;
    const previous = store.transaction(() => {
      const rows = entries();
      if (rows.some(row => row.id === id)) return null;
      if (rows.filter(row => row.state === 'queued').length >= 20) throw new OperationError(409, 'Hay veinte mensajes esperando. Deja que avancen antes de añadir más.');
      write([...rows, { id, text, mode, model, state: 'queued', taskId, at: new Date().toISOString() }]);
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
      if (rows.some(row => row.state === 'working')) return;
      const row = rows.find(row => row.state === 'queued');
      if (!row) return;
      try { assertIdle(); }
      catch (error) { if (error.status === 409) return; throw error; }
      const { id, mode, model, text, taskId } = row;
      const previous = rows.slice(0, rows.findIndex(item => item.id === id));
      const history = previous.filter(row => row.reply && ['answer', 'proposal', 'applied'].includes(row.state)).slice(-8)
      .map(row => ({ message: row.text.slice(0, 1700), answer: [
        row.proposal && (row.state === 'applied' ? 'Cambio aplicado localmente.' : 'Propuesta pendiente de aplicar.'),
        row.reply, row.proposal?.summary,
      ].filter(Boolean).join('\n').slice(0, 2000) }));
      if (!update(id, { state: 'working', reply: undefined }, 'queued')) return;
      activeId = id;
      active = Promise.resolve().then(async () => {
      if (mode === 'ask') {
        const result = await codex.ask({ model, text, history });
        update(id, { state: 'answer', reply: result.answer, tokens: result.tokens }, 'working');
      } else {
        const context = history.map(item => 'Mensaje anterior\n' + item.message + '\nRespuesta\n' + item.answer).join('\n\n').slice(-7600);
        const batch = await runner.start({ mode: 'implementacion', engine: 'codex', codexModel: model,
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
      if (active || applying) throw new OperationError(409, 'Espera a que termine el trabajo del chat.');
      assertIdle();
    },
  };
}
