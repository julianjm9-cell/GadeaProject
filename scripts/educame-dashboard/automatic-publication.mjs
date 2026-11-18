import { randomUUID } from 'node:crypto';
import { OperationError } from './operations.mjs';

const key = 'automatic-publication-v1';

// Publication receipts survive restarts. A failed upload never reruns an agent.
export function createAutomaticPublication({ store, publication, readDelivery }) {
  let pumping;
  let closed = false;
  const initial = store.operation(key);
  if (!initial) store.writeOperation(key, { since: new Date().toISOString(),
    // Adopt waiting work and successful pending deliveries, never replay historical failures.
    adopted: store.batches().filter(batch => batch.mode === 'implementacion' &&
      (['running', 'queued', 'paused'].includes(batch.state) ||
        (batch.state === 'finished' && batch.tasks.every(task => batch.jobs?.[task.id]?.status === 'completado') &&
          batch.tasks.some(task => !store.board().pushes?.['implementacion/' + task.id]?.integratedRevision))))
      .map(batch => batch.id), attempts: {} });
  const read = () => store.operation(key);
  const save = (id, update) => store.transaction(() => {
    const data = read();
    if (Object.entries(update).every(([field, value]) => data.attempts[id]?.[field] === value)) return data.attempts[id];
    data.attempts[id] = { ...data.attempts[id], ...update };
    store.writeOperation(key, data);
    return data.attempts[id];
  });
  const eligible = batch => batch.mode === 'implementacion' &&
    (batch.automaticPublication || read().adopted.includes(batch.id));

  async function pump() {
    if (closed) return;
    if (pumping) return pumping;
    pumping = (async () => {
      const batches = store.batches().filter(eligible);
      for (const batch of batches) {
        if (batch.state !== 'finished') continue;
        for (const task of batch.tasks) {
          if (/^[a-f0-9]{40}$/.test(batch.jobs?.[task.id]?.externalCompletion?.revision || '') && typeof batch.jobs[task.id].externalCompletion.summary === 'string') continue;
          const deliveryKey = 'implementacion/' + task.id;
          const keys = [deliveryKey];
          const push = store.board().pushes?.[deliveryKey];
          let attempt = read().attempts[task.id];
          if (push?.undoneRevision) { save(task.id, { state: 'undone' }); continue; }
          if (attempt?.state === 'published') continue;
          const delivery = await readDelivery(deliveryKey);
          if (push?.integratedRevision && delivery?.implementation?.commit && push.commit === delivery.implementation.commit) {
            save(task.id, { state: 'published' }); continue;
          }
          if (attempt?.state === 'failed') continue;
          if (!delivery?.implementation) {
            save(task.id, { state: 'attention', message: 'El encargo necesita una corrección. Su copia está conservada.' });
            continue;
          }
          if (store.board().reviews[deliveryKey]?.decision === 'cambios') {
            save(task.id, { state: 'attention', message: 'Se han pedido ajustes para este encargo.' });
            continue;
          }
          const current = publication.status();
          if (attempt && current?.uploadId === attempt.id) {
            if (['failed', 'retry'].includes(current.state)) {
              if (current.message?.includes('El proceso se interrumpió') && attempt.recoveryPid !== process.pid) {
                attempt = save(task.id, { id: randomUUID(), state: 'waiting', recoveryPid: process.pid });
              } else {
                save(task.id, { state: 'failed', message: current.message }); continue;
              }
            }
            // Consume this receipt before another task can replace the shared publication.
            // Its state can settle between status() and busy() in the same pump.
            if (['queued', 'preparing', 'publishing'].includes(current.state)) return;
            if (current.state === 'published') continue;
          }
          if (publication.busy() || store.batches().some(item => item.state === 'running')) return;
          attempt ||= save(task.id, { id: randomUUID(), state: 'waiting', keys, batchId: batch.id });
          try {
            // Persist the exact id BEFORE calling Git. Reusing it cannot duplicate a push.
            save(task.id, { state: 'uploading' });
            await publication.upload({ id: attempt.id, keys });
          } catch (error) {
            save(task.id, error.status === 409 ? { state: 'waiting' } : { state: 'failed', message: error.message });
          }
          return;
        }
      }
    })().finally(() => { pumping = undefined; });
    return pumping;
  }

  return { pump, close() { closed = true; }, status: () => read().attempts,
    ready: () => store.batches().some(batch => eligible(batch) && batch.state === 'finished' && batch.tasks.some(task =>
      !(/^[a-f0-9]{40}$/.test(batch.jobs?.[task.id]?.externalCompletion?.revision || '') && typeof batch.jobs[task.id].externalCompletion.summary === 'string') &&
      !store.board().pushes?.['implementacion/' + task.id]?.integratedRevision &&
      !['failed', 'attention', 'published', 'undone'].includes(read().attempts[task.id]?.state))),
    retry(id) {
      if (!read().attempts[id] || !['failed', 'attention'].includes(read().attempts[id].state)) {
        throw new OperationError(409, 'Este encargo no tiene una subida pendiente de reintentar.');
      }
      return save(id, { id: randomUUID(), state: 'waiting', message: '' });
    },
    async wait() { await pumping; },
  };
}
