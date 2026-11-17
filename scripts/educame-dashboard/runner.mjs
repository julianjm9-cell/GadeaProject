import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readGuidance, runBatch } from '../educame-agents.mjs';
import { contextSettings } from './project-context.mjs';
import { agentDirectory, defaultAgents } from './agent-profiles.mjs';

export class RunnerError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function running(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

export function publicBatch(batch) {
  if (!batch) return null;
  const { id, mode, engine, startedAt, finishedAt, state, tasks, jobs, error, agents, queuedAt, providerModel, automaticPublication } = batch;
  return { id, mode, engine, providerModel, startedAt, finishedAt, state, automaticPublication, running: state === 'running',
    queuedAt, tasks: tasks.map(({ id, agente, encargo, app, despues, continuar }) => ({ id, agente, encargo, app, despues, continuar, agentName: (agents?.[agente] || defaultAgents[agente])?.name })), jobs, error };
}

export function createRunner(store, directory, { model, readiness, generator, baseRevision, recoverImplementation, contextSnapshot, automaticPublication = false }) {
  let active;
  let pumping;
  let closed = false;
  const all = () => store.batches();
  const output = mode => mode === 'implementacion' ? join(directory, 'implementaciones') :
    mode === 'prueba' ? join(directory, 'simulaciones') : directory;

  function reconcile() {
    return store.transaction(() => {
      for (const batch of all()) {
        if (batch.state === 'running' && !running(batch.pid)) {
          batch.state = 'paused';
          batch.pid = null;
          store.update(batch);
        }
      }
      const batches = all();
      return batches.find(batch => batch.state === 'running') || batches.find(batch => batch.state === 'queued') || store.latest();
    });
  }

  function launch(batch, prior) {
    const save = () => store.update(batch);
    active = runBatch(batch.tasks, {
      directory: output(batch.mode), model: batch.model, memory: batch.memory, guidance: batch.guidance, settings: batch.settings,
      prior, agents: batch.agents, codexModel: batch.codexModel, provider: batch.engine, providerModel: batch.providerModel, qualityRequired: batch.qualityRequired,
      base: batch.base, recover: batch.mode === 'implementacion' ? recoverImplementation : undefined,
      generate: generator(batch),
      onStart: (id, fingerprint) => { batch.jobs[id] = { status: 'en curso', fingerprint }; save(); },
      report: ({ id, status, error, reused, fingerprint }) => {
        batch.jobs[id] = { status, error, reused, fingerprint: fingerprint || batch.jobs[id].fingerprint };
        save();
      },
    }).then(() => {
      batch.state = 'finished';
      batch.finishedAt = new Date().toISOString();
    }).catch(() => {
      batch.state = 'paused';
      batch.error = 'El lote se interrumpió. Puedes retomar los pasos pendientes.';
    }).finally(() => {
      batch.pid = null;
      save();
    });
  }

  async function start({ mode, engine, tasks, revision, codexModel, providerModel, qualityRequired = false, consumeQueue = false, enqueue = false }) {
    if (!tasks.length) throw new RunnerError(400, 'Añade al menos un encargo.');
    const id = createHash('sha256').update(JSON.stringify({ mode, engine, tasks, codexModel,
      ...(providerModel ? { providerModel } : {}), ...(qualityRequired ? { qualityRequired: true } : {}) })).digest('hex');
    const existing = store.batch(id);
    if (existing) return publicBatch(reconcile()?.id === id ? store.batch(id) : existing);
    try { await readiness(mode, engine); }
    catch (error) { if (!enqueue || error.status !== 409) throw error; }
    const guidance = mode === 'prueba' ? '' : await readGuidance();
    const base = !enqueue && mode === 'implementacion' ? await baseRevision() : undefined;
    const knowledge = !enqueue && mode !== 'prueba' ? await contextSnapshot?.(base) : undefined;
    reconcile();
    const result = store.transaction(() => {
      const existing = store.batch(id);
      if (existing) return { batch: existing };
      const latest = all().find(batch => batch.state === 'running') || store.latest();
      if (!enqueue && latest?.state === 'running') throw new RunnerError(409, 'Hay un lote en marcha.');
      if (!enqueue && latest?.state === 'paused') throw new RunnerError(409, 'Retoma primero el lote interrumpido.');
      if (enqueue && all().filter(batch => batch.state === 'queued').length >= 50) throw new RunnerError(409, 'Hay cincuenta trabajos guardados en espera. Deja que avance la cola.');
      const board = store.board();
      if (revision !== undefined && revision !== board.revision) throw new RunnerError(409, 'El lote ha cambiado. Vuelve a cargar antes de ejecutarlo.');
      const directory = agentDirectory(board.agentEdits);
      const agents = Object.fromEntries(tasks.map(task => [task.agente, directory[task.agente]]));
      if (qualityRequired) agents.revision = directory.revision;
      const batch = {
        id, mode, engine, tasks, base, guidance, agents, codexModel, providerModel, qualityRequired, memory: board.memory,
        automaticPublication: automaticPublication && mode === 'implementacion',
        settings: knowledge ? { ...contextSettings, knowledge } : contextSettings,
        pid: enqueue ? null : process.pid, state: enqueue ? 'queued' : 'running', managed: enqueue,
        ...(enqueue ? { queuedAt: new Date().toISOString() } : {}),
        model: mode === 'prueba' ? 'prueba-local' : engine === 'codex' ? 'Codex local' : providerModel || model,
        startedAt: new Date().toISOString(),
        jobs: Object.fromEntries(tasks.map(task => [task.id, { status: task.revisar ? 'espera' : 'pendiente' }])),
      };
      store.insert(batch);
      if (consumeQueue) {
        const selected = new Set(tasks.map(task => task.id));
        store.writeBoard({ ...board, revision: board.revision + 1,
          tasks: board.tasks.filter(task => !selected.has(task.id)) });
      }
      return { batch, started: true };
    });
    if (result.started && !enqueue) launch(result.batch);
    if (enqueue) await pump();
    return publicBatch(store.batch(result.batch.id));
  }

  async function resume(id) {
    reconcile();
    const current = store.batch(id);
    if (!current) throw new RunnerError(404, 'No se encuentra el lote.');
    if (current.state !== 'paused') return publicBatch(current);
    await readiness(current.mode, current.engine);
    const result = store.transaction(() => {
      const batch = store.batch(id);
      if (all().some(other => other.id !== id && other.state === 'running')) throw new RunnerError(409, 'Hay un lote en marcha.');
      if (batch.state !== 'paused') return { batch };
      const prior = structuredClone(batch.jobs);
      batch.state = 'running';
      batch.pid = process.pid;
      delete batch.error;
      store.update(batch);
      return { batch, prior };
    });
    if (result.prior) launch(result.batch, result.prior);
    return publicBatch(result.batch);
  }

  function pump() {
    if (closed) return Promise.resolve();
    if (pumping) return pumping;
    pumping = (async () => {
      reconcile();
      if (all().some(batch => batch.state === 'running')) return;
      // Resume once per restart. Receipts and fingerprints reuse completed steps;
      // uncertain executor calls are never silently sent a second time.
      const interrupted = all().find(batch => batch.managed && batch.state === 'paused' && batch.recoveryPid !== process.pid);
      if (interrupted) {
        try {
          await readiness(interrupted.mode, interrupted.engine);
          store.transaction(() => {
            const batch = store.batch(interrupted.id);
            batch.recoveryPid = process.pid;
            store.update(batch);
          });
          await resume(interrupted.id);
        } catch (error) {
          if (error.status === 409) return;
          store.transaction(() => {
            const batch = store.batch(interrupted.id);
            batch.error = error.message;
            batch.recoveryPid = process.pid;
            store.update(batch);
          });
        }
        return;
      }
      const queued = all().find(batch => batch.state === 'queued');
      if (!queued || queued.retryAfter > Date.now()) return;
      try {
        await readiness(queued.mode, queued.engine);
        const base = queued.mode === 'implementacion' ? await baseRevision() : undefined;
        const knowledge = queued.mode !== 'prueba' ? await contextSnapshot?.(base) : undefined;
        const claimed = store.transaction(() => {
          if (all().some(batch => batch.state === 'running')) return;
          const batch = store.batch(queued.id);
          if (batch.state !== 'queued') return;
          Object.assign(batch, { base, state: 'running', pid: process.pid, error: undefined, startedAt: new Date().toISOString(),
            ...(knowledge ? { settings: { ...batch.settings, knowledge } } : {}) });
          store.update(batch);
          return batch;
        });
        if (claimed) launch(claimed);
      } catch (error) {
        store.transaction(() => {
          const batch = store.batch(queued.id);
          if (batch.state !== 'queued') return;
          batch.error = error.status === 409 ? 'Esperando a que termine la operación actual.' : error.message;
          batch.retryAfter = error.status === 409 ? 0 : Date.now() + 15000;
          store.update(batch);
        });
      }
    })().finally(() => { pumping = undefined; });
    return pumping;
  }

  return { start, resume, pump, output, latest: () => publicBatch(reconcile()),
    close() { closed = true; },
    queued: () => all().filter(batch => batch.state === 'queued').map(publicBatch),
    recent: () => store.recent().map(publicBatch), async wait() { await pumping; await active; } };
}
