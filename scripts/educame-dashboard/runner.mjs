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
  const { id, mode, engine, startedAt, finishedAt, state, tasks, jobs, error, agents } = batch;
  return { id, mode, engine, startedAt, finishedAt, state, running: state === 'running',
    tasks: tasks.map(({ id, agente, encargo }) => ({ id, agente, encargo, agentName: (agents?.[agente] || defaultAgents[agente])?.name })), jobs, error };
}

export function createRunner(store, directory, { model, readiness, generator, baseRevision, recoverImplementation }) {
  let active;
  const output = mode => mode === 'implementacion' ? join(directory, 'implementaciones') :
    mode === 'prueba' ? join(directory, 'simulaciones') : directory;

  function reconcile() {
    const latest = store.latest();
    if (latest?.state !== 'running' || running(latest.pid)) return latest;
    return store.transaction(() => {
      const batch = store.latest();
      if (batch?.state === 'running' && !running(batch.pid)) {
        batch.state = 'paused';
        batch.pid = null;
        store.update(batch);
      }
      return batch;
    });
  }

  function launch(batch, prior) {
    const save = () => store.update(batch);
    active = runBatch(batch.tasks, {
      directory: output(batch.mode), model: batch.model, memory: batch.memory, guidance: batch.guidance, settings: batch.settings,
      prior, agents: batch.agents, codexModel: batch.codexModel,
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

  async function start({ mode, engine, tasks, revision, codexModel }) {
    if (!tasks.length) throw new RunnerError(400, 'Añade al menos un encargo.');
    const id = createHash('sha256').update(JSON.stringify({ mode, engine, tasks, codexModel })).digest('hex');
    const existing = store.batch(id);
    if (existing) return publicBatch(reconcile()?.id === id ? store.batch(id) : existing);
    await readiness(mode, engine);
    const guidance = mode === 'prueba' ? '' : await readGuidance();
    const base = mode === 'implementacion' ? await baseRevision() : undefined;
    reconcile();
    const result = store.transaction(() => {
      const existing = store.batch(id);
      if (existing) return { batch: existing };
      const latest = store.latest();
      if (latest?.state === 'running') throw new RunnerError(409, 'Hay un lote en marcha.');
      if (latest?.state === 'paused') throw new RunnerError(409, 'Retoma primero el lote interrumpido.');
      const board = store.board();
      if (revision !== undefined && revision !== board.revision) throw new RunnerError(409, 'El lote ha cambiado. Vuelve a cargar antes de ejecutarlo.');
      const directory = agentDirectory(board.agentEdits);
      const agents = Object.fromEntries(tasks.map(task => [task.agente, directory[task.agente]]));
      const batch = {
        id, mode, engine, tasks, base, guidance, agents, codexModel, memory: board.memory, settings: contextSettings, pid: process.pid, state: 'running',
        model: mode === 'prueba' ? 'prueba-local' : engine === 'codex' ? 'Codex local' : model,
        startedAt: new Date().toISOString(),
        jobs: Object.fromEntries(tasks.map(task => [task.id, { status: task.revisar ? 'espera' : 'pendiente' }])),
      };
      store.insert(batch);
      return { batch, started: true };
    });
    if (result.started) launch(result.batch);
    return publicBatch(result.batch);
  }

  async function resume(id) {
    const current = reconcile();
    if (current?.id !== id) throw new RunnerError(404, 'No se encuentra el lote.');
    if (current.state !== 'paused') return publicBatch(current);
    await readiness(current.mode, current.engine);
    const result = store.transaction(() => {
      const batch = store.latest();
      if (batch?.id !== id) throw new RunnerError(409, 'El lote ha cambiado.');
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

  return { start, resume, output, latest: () => publicBatch(reconcile()),
    recent: () => store.recent().map(publicBatch), wait: () => active };
}
