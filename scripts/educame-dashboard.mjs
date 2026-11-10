import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { concurrency, defaultModel, maxTasks, outputDir, requestDraft, validateTasks } from './educame-agents.mjs';
import { ConnectionError, createConnections, googleCallback } from './educame-dashboard/connections.mjs';
import { createCodex } from './educame-dashboard/codex.mjs';
import { ChangesError, createChanges } from './educame-dashboard/changes.mjs';
import { createPreviews } from './educame-dashboard/preview.mjs';
import { cleanRule, memoryTopics, projectProfiles } from './educame-dashboard/project-context.mjs';
import { openPanelStore } from './educame-dashboard/store.mjs';
import { createRunner, RunnerError } from './educame-dashboard/runner.mjs';
import { canRevalidate, createImplementation, ImplementationError } from './educame-dashboard/implementation.mjs';
import { createChat } from './educame-dashboard/chat.mjs';
import { researchRole } from './educame-dashboard/research.mjs';
import { OperationError } from './educame-dashboard/operations.mjs';
import { githubOperations } from './educame-dashboard/github-operations.mjs';
import { hostingerOperations } from './educame-dashboard/hostinger-operations.mjs';
import { adminOperations } from './educame-dashboard/admin-operations.mjs';
import { agentDirectory, agentEditor, defaultAgents, updateAgent } from './educame-dashboard/agent-profiles.mjs';

const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/panel.css', ['panel.css', 'text/css']],
  ['/panel.js', ['panel.js', 'text/javascript']],
  ['/workspace.js', ['workspace.js', 'text/javascript']],
  ['/workspace.css', ['workspace.css', 'text/css']],
  ['/changes.js', ['changes.js', 'text/javascript']],
  ['/operations.js', ['operations.js', 'text/javascript']],
  ['/admin-panel.js', ['admin-panel.js', 'text/javascript']],
  ['/operations.css', ['operations.css', 'text/css']],
  ['/terrace.css', ['terrace.css', 'text/css']],
  ['/terrace-hero.webp', ['terrace-hero.webp', 'image/webp']],
  ['/chat.js', ['chat.js', 'text/javascript']],
  ['/agent-editor.js', ['agent-editor.js', 'text/javascript']],
  ['/icons.js', ['icons.js', 'text/javascript']],
  ['/icons.svg', ['icons.svg', 'image/svg+xml']],
  ['/theory.js', ['theory.js', 'text/javascript']],
  ['/theory-library.js', ['theory-library.js', 'text/javascript']],
  ['/theory-development.js', ['theory-development.js', 'text/javascript']],
  ['/memory.js', ['memory.js', 'text/javascript']],
  ['/icon.svg', ['icon.svg', 'image/svg+xml']],
]);
const appIcons = new Set(['profesor-simple-v2.png', 'eso-simple-v2.png', 'ingles-simple.png', 'diplomator-simple-v2.png',
  'u25-simple.png', 'facturas.svg', 'hazlotu-logo.png']);
const kinds = ['App', 'Repositorio', 'Red social', 'Otro'];
const decisions = ['aprobada', 'cambios'];
const fixture = JSON.parse(await readFile(new URL('./educame-agents.example.json', import.meta.url), 'utf8'));
const initialLinks = [
  { id: 'profesor', name: 'Profesor Particular', kind: 'App', url: 'https://educame.tech/profesor-particular' },
  { id: 'eso', name: 'ESO Adultos', kind: 'App', url: 'https://educame.tech/eso-adultos' },
  { id: 'ingles', name: 'Inglés', kind: 'App', url: 'https://educame.tech/cambridge-info' },
];

class PanelError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJson(path, fallback) {
  const content = await readFile(path, 'utf8').catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  return content === undefined ? fallback : JSON.parse(content);
}

function validateLinks(links) {
  if (!Array.isArray(links) || links.length > 60) throw new PanelError(400, 'Puedes guardar hasta 60 enlaces.');
  const ids = new Set();
  return links.map(link => {
    if (!link || typeof link.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(link.id) || ids.has(link.id) ||
        typeof link.name !== 'string' || !link.name.trim() || link.name.length > 80 ||
        !kinds.includes(link.kind) || typeof link.url !== 'string' || link.url.length > 1500) {
      throw new PanelError(400, 'Revisa el nombre y la categoría del enlace.');
    }
    const url = URL.parse(link.url);
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new PanelError(400, 'Introduce un enlace completo que empiece por https:// o http://.');
    }
    ids.add(link.id);
    return { id: link.id, name: link.name.trim(), kind: link.kind, url: url.href };
  });
}

function validateBoard(tasks, board) {
  if (Array.isArray(tasks) && tasks.length === 0) return [];
  try {
    return validateTasks(tasks, agentDirectory(board.agentEdits));
  } catch (error) {
    throw new PanelError(400, error.message);
  }
}

function updateMemory(rules, input, source) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PanelError(400, 'Revisa el criterio.');
  const existing = source ? rules.find(rule => rule.source === source) : rules.find(rule => rule.id === input.id);
  if (input.id && !existing) throw new PanelError(404, 'El criterio ya no está disponible.');
  const updatedAt = new Date().toISOString();
  if (typeof input.archived === 'boolean' && existing && !source) {
    return rules.map(rule => rule === existing ? { ...rule, archived: input.archived, updatedAt } : rule);
  }
  if (!Object.hasOwn(projectProfiles, input.app)) throw new PanelError(400, 'Selecciona la aplicación del criterio.');
  let content;
  try { content = cleanRule(input); }
  catch (error) { throw new PanelError(400, error.message); }
  if (rules.some(rule => rule !== existing && rule.app === input.app && rule.criterio.toLowerCase() === content.criterio.toLowerCase())) {
    throw new PanelError(400, 'Ya hay un criterio con ese texto en esta app. Puedes editarlo en Memoria.');
  }
  const rule = {
    id: existing?.id || randomUUID(), app: input.app, ...content,
    archived: source ? false : existing?.archived || false,
    source: source || existing?.source, updatedAt,
  };
  return [...rules.filter(item => item !== existing), rule];
}

async function bodyJson(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) {
    throw new PanelError(415, 'Envía un documento JSON.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 300_000) {
      request.resume();
      throw new PanelError(413, 'El documento es demasiado grande.');
    }
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // Show the same error for malformed JSON and unsupported root values.
  }
  throw new PanelError(400, 'El documento JSON no es válido.');
}

async function readDeliveries(directory, mode) {
  const files = await readdir(directory, { withFileTypes: true }).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return [];
  });
  const records = await Promise.all(files
    .filter(file => file.isFile() && /^[a-z0-9][a-z0-9-]{0,63}\.json$/.test(file.name))
    .map(async file => {
      const record = await readJson(join(directory, file.name), null).catch(error => {
        if (!(error instanceof SyntaxError)) throw error;
        return null;
      });
      if (record?.id !== file.name.slice(0, -5) || !['borrador', 'fallido', 'completado', 'interrumpido'].includes(record.status) ||
          typeof record.finishedAt !== 'string' || !Number.isFinite(Date.parse(record.finishedAt))) return null;
      return { ...record, agentName: record.agentName || defaultAgents[record.agente]?.name, mode, key: `${mode}/${record.id}`,
        canRevalidate: mode === 'implementacion' && canRevalidate(record) };
    }));
  return records.filter(Boolean);
}

async function exampleDraft(task) {
  if (task.agente === researchRole) return {
    draft: { resumen: 'Simulación de análisis', entrega: 'Se guardaron los enlaces en el encargo de prueba.', comprobaciones: [],
      pendientes: ['Pulsa Analizar enlaces para consultar las fuentes públicas.'] },
    research: { searched: false, fuentes: task.fuentes.map(url => ({ url, estado: 'inaccesible', observacion: 'Simulación sin consulta web.' })), ideas: [] },
  };
  return {
    draft: {
      resumen: task.revision ? 'Entrega recibida para revisar' : 'Encargo recibido por el agente',
      entrega: task.revision
        ? `El flujo ha entregado el borrador de ${task.revisar} a Revisión.\n\nEncargo original: ${task.revision.encargo}\n\nResumen recibido: ${task.revision.borrador.resumen}`
        : `Encargo de ${task.agentProfile.name}\n\n${task.encargo}\n\nEste resultado permite probar la cola y la bandeja de entregas.`,
      comprobaciones: ['La entrega se ha guardado en el historial local.'],
      pendientes: ['Ejecuta el lote con OpenAI para obtener un borrador del agente.'],
    },
  };
}

export async function createDashboard({
  directory = outputDir,
  apiKey = process.env.EDUCAME_AGENTS_API_KEY?.trim(),
  model = process.env.EDUCAME_AGENTS_MODEL?.trim() || defaultModel,
  generate,
  fetchImpl,
  codex = createCodex(),
  repositoryRoot = fileURLToPath(new URL('../', import.meta.url)),
  implementationOptions,
  ssh,
  restartProcess,
} = {}) {
  await mkdir(directory, { recursive: true });
  const connections = await createConnections(directory, fetchImpl);
  const changes = createChanges(repositoryRoot);
  const previews = createPreviews(repositoryRoot);
  const activeApiKey = () => connections.openaiKey() || apiKey;
  const store = openPanelStore(directory, { memory: [], revision: 0, tasks: [], links: initialLinks, reviews: {}, pushes: {} });
  const github = githubOperations(changes, connections, store, fetchImpl);
  const hostinger = hostingerOperations(store, changes, github, ssh);
  const admin = adminOperations(fetchImpl);
  const implementation = createImplementation(repositoryRoot, directory, codex, implementationOptions);
  const implementationPreviews = new Map();
  const runner = createRunner(store, directory, {
    model, baseRevision: implementation.base, recoverImplementation: implementation.recover,
    async readiness(mode, engine) {
      if (mode === 'implementacion' && engine !== 'codex') throw new RunnerError(400, 'Implementar requiere Codex local.');
      if (mode !== 'prueba' && engine === 'codex') {
        const status = await codex.status();
        if (!status.ready) throw new RunnerError(503, status.message);
      }
      if (mode === 'real' && engine === 'openai' && !activeApiKey()) throw new RunnerError(503, 'Configura OpenAI desde Conexiones para usar la API.');
    },
    generator(batch) {
      if (batch.mode === 'prueba') return exampleDraft;
      if (batch.mode === 'implementacion') return task => implementation.execute(task, batch.base);
      if (batch.engine === 'codex') return codex.generate;
      const key = activeApiKey();
      return generate || (task => requestDraft(task, { apiKey: key, model: batch.model, fetchImpl }));
    },
  });
  let restarting = false;
  let terraceNeedsRestart = false;
  let deliveryWork;
  const implementationPath = id => join(runner.output('implementacion'), id + '.json');
  const chat = createChat({ store, runner, codex, implementation, instance: randomUUID(),
    readDelivery: id => readJson(implementationPath(id), null),
    assertIdle() {
      const job = hostinger.status().job;
      if (deliveryWork || ['running', 'paused'].includes(runner.latest()?.state) || ['running', 'uncertain'].includes(job?.state)) {
        throw new OperationError(409, 'Termina o retoma el trabajo pendiente antes de cambiar el panel.');
      }
    },
  });
  let appAvailability;
  let availabilityExpiry = 0;

  function publicAppStatus() {
    if (Date.now() >= availabilityExpiry) {
      availabilityExpiry = Date.now() + 60_000;
      appAvailability = fetch('https://educame.tech/api/public/app-availability', { signal: AbortSignal.timeout(5000), redirect: 'error' })
        .then(response => response.ok ? response.json() : {})
        .then(data => ({ paused: Object.entries(data.apps || {}).filter(([, app]) => app?.paused === true).map(([key]) => key) }))
        .catch(() => ({ paused: [] }));
    }
    return appAvailability;
  }

  function changeBoard(revision, change) {
    return store.transaction(() => {
      const board = store.board();
      if (revision !== board.revision) throw new PanelError(409, 'El panel cambió en otra pestaña. Vuelve a cargar y repite la acción.');
      const updated = { ...board, ...change(board), revision: board.revision + 1 };
      store.writeBoard(updated);
      return updated;
    });
  }

  async function deliveries() {
    const records = await Promise.all(['real', 'prueba', 'implementacion'].map(mode => readDeliveries(runner.output(mode), mode)));
    return records.flat().sort((left, right) => right.finishedAt.localeCompare(left.finishedAt));
  }

  async function implementationDelivery(key) {
    const id = /^implementacion\/([a-z0-9][a-z0-9-]{0,63})$/.exec(key || '')?.[1];
    const delivery = id && await readJson(implementationPath(id), null);
    if (!delivery || delivery.id !== id) throw new PanelError(404, 'No se encuentra la entrega.');
    return delivery;
  }

  function approveCheck(key, delivery) {
    if (delivery.status !== 'completado' || !delivery.implementation?.verified) {
      throw new PanelError(409, 'La implementación debe completar sus comprobaciones antes de publicar.');
    }
    const review = store.board().reviews[key];
    if (review?.decision !== 'aprobada' || review.commit !== delivery.implementation.commit) {
      throw new PanelError(409, 'Aprueba la revisión antes de publicarla.');
    }
  }

  function savePush(key, pushed) {
    return store.transaction(() => {
      const board = store.board();
      const current = board.pushes?.[key];
      if (current?.commit === pushed.commit && current.app === pushed.app &&
          (!pushed.integratedRevision || current.integratedRevision === pushed.integratedRevision) &&
          (!pushed.pull || (current.pull?.number === pushed.pull.number && current.pull.merged === pushed.pull.merged))) return board;
      if (current?.commit === pushed.commit) pushed = { ...current, ...pushed };
      const updated = { ...board, revision: board.revision + 1, pushes: { ...board.pushes, [key]: pushed } };
      store.writeBoard(updated);
      return updated;
    });
  }

  async function revalidate(delivery) {
    const result = await implementation.revalidate(delivery);
    const updated = { ...delivery, ...result, error: result.error,
      status: result.implementation.verified ? 'completado' : 'borrador' };
    const path = implementationPath(delivery.id);
    const temporary = path + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, JSON.stringify(updated, null, 2) + '\n', { flush: true });
    await rename(temporary, path);
    const batch = store.recent().find(item => item.mode === 'implementacion' && item.jobs[delivery.id]?.fingerprint === delivery.fingerprint);
    if (batch?.state === 'finished') {
      batch.jobs[delivery.id] = { ...batch.jobs[delivery.id], status: updated.status, error: updated.error };
      store.update(batch);
    }
    return { ...updated, key: 'implementacion/' + delivery.id, mode: 'implementacion', canRevalidate: canRevalidate(updated) };
  }

  async function publicationRevision(key, delivery, pull) {
    let revision = delivery.implementation?.commit;
    if (store.board().pushes?.[key]?.commit !== revision || !delivery.implementation?.verified) {
      throw new PanelError(409, 'La entrega debe estar publicada en GitHub.');
    }
    if (pull !== undefined) {
      const merged = await github.detail(pull);
      if (merged.deliveryKey !== key || !merged.merged || merged.head !== revision || merged.base !== 'main') {
        throw new PanelError(409, 'GitHub aún no confirma la fusión de esta revisión en main.');
      }
      revision = merged.mergeCommit;
    }
    return changes.integrated(revision);
  }

  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    function json(status, data) {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(data));
    }
    try {
      const host = `127.0.0.1:${request.socket.localPort}`;
      if (request.headers.host !== host || (request.headers.origin && request.headers.origin !== `http://${host}`)) {
        throw new PanelError(403, 'Abre el panel desde la dirección local que indica la terminal.');
      }
      const origin = `http://${host}`;
      const url = new URL(request.url, origin);
      const path = url.pathname;
      if (restarting && request.method !== 'GET') throw new OperationError(409, 'LA TERRAZA se está reiniciando.');
      if (request.method === 'GET' && path === '/api/chat') {
        const data = await chat.read();
        return json(200, { ...data, needsRestart: data.needsRestart || terraceNeedsRestart });
      }
      if (request.method === 'GET' && path === '/api/chat/modelos') {
        const fresh = url.searchParams.has('actualizar');
        const [models, account] = await Promise.all([codex.models?.(fresh), codex.status(fresh)]);
        return json(200, { models: models || [], ...account });
      }
      if (request.method === 'GET' && path === '/api/chat/propuesta') return json(200, await chat.review(url.searchParams.get('id')));
      if (request.method === 'POST' && ['/api/chat', '/api/chat/aplicar', '/api/chat/reiniciar'].includes(path)) {
        if (request.headers.origin !== origin) throw new OperationError(403, 'Usa el chat desde LA TERRAZA.');
        const body = await bodyJson(request);
        if (path === '/api/chat') return json(202, await chat.send(body));
        if (path === '/api/chat/aplicar') return json(200, await chat.apply(body));
        if (!restartProcess || (!terraceNeedsRestart && !(await chat.read()).needsRestart)) throw new OperationError(409, 'El panel no tiene cambios pendientes de recargar.');
        chat.assertIdle();
        restarting = true;
        response.once('finish', () => server.close(restartProcess));
        return json(202, { restarting: true });
      }
      if (request.method === 'GET' && path === '/api/encargos/diferencias') {
        const delivery = await implementationDelivery(url.searchParams.get('key'));
        return json(200, { ...await implementation.review(delivery.implementation), commit: delivery.implementation.commit });
      }
      if (request.method === 'POST' && path === '/api/encargos/verificar-publicacion') {
        if (request.headers.origin !== origin) throw new OperationError(403, 'Realiza esta acción desde LA TERRAZA.');
        const { key, pull } = await bodyJson(request);
        const delivery = await implementationDelivery(key);
        const publication = await publicationRevision(key, delivery, pull);
        const pushed = store.board().pushes[key];
        savePush(key, { ...pushed, integratedRevision: publication.revision });
        return json(200, publication);
      }
      if (request.method === 'POST' && ['/api/encargos/comprobar', '/api/encargos/publicar', '/api/encargos/aplicar'].includes(path)) {
        if (request.headers.origin !== origin) throw new OperationError(403, 'Realiza esta acción desde LA TERRAZA.');
        const { key, commit, fromGithub, pull } = await bodyJson(request);
        const delivery = await implementationDelivery(key);
        if (path === '/api/encargos/comprobar' && delivery.implementation?.verified) {
          return json(200, { ...delivery, key, mode: 'implementacion', canRevalidate: false });
        }
        chat.assertIdle();
        if (path !== '/api/encargos/comprobar') {
          approveCheck(key, delivery);
          if (commit !== delivery.implementation.commit) throw new PanelError(409, 'Vuelve a revisar la entrega antes de continuar.');
        }
        deliveryWork = (async () => {
          if (path === '/api/encargos/comprobar') return revalidate(delivery);
          if (path === '/api/encargos/aplicar') {
            if (delivery.app !== 'control') throw new PanelError(409, 'Esta acción solo actualiza LA TERRAZA.');
            const publication = fromGithub === true ? await publicationRevision(key, delivery, pull) : null;
            if (await implementation.applyTerrace(delivery.implementation, publication?.revision)) terraceNeedsRestart = true;
            return { needsRestart: terraceNeedsRestart };
          }
          const { commit, branch } = delivery.implementation;
          const integrated = await changes.integrated(commit).catch(error => {
            if (!(error instanceof ChangesError) || error.status !== 409) throw error;
            return null;
          });
          if (integrated) return { board: savePush(key, { commit, branch, app: delivery.app, integratedRevision: integrated.revision }) };
          const pushed = { ...await implementation.push(delivery.id, delivery.implementation), app: delivery.app };
          let board = savePush(key, pushed);
          if (!github.connected()) return { board };
          try {
            const pull = await github.create(pushed.branch);
            board = savePush(key, { ...pushed, pull: { number: pull.number, url: pull.url, merged: pull.merged } });
            return { board };
          } catch (error) {
            if (!(error instanceof OperationError)) throw error;
            return { board, warning: error.message };
          }
        })();
        try { return json(200, await deliveryWork); }
        finally { deliveryWork = null; }
      }
      if (path.startsWith('/api/operacion/')) {
        const route = path.slice('/api/operacion/'.length);
        if (request.method === 'GET') {
          const reads = {
            'github': github.status, 'github/lista': github.list,
            'github/detalle': () => github.detail(url.searchParams.get('numero')),
            'hostinger': hostinger.status, 'hostinger/estado': hostinger.readRemote,
            'admin': () => admin.handle('state', request.headers.cookie, {}, response),
          };
          if (Object.hasOwn(reads, route)) return json(200, await reads[route]());
        }
        if (request.method === 'POST') {
          if (request.headers.origin !== origin || request.headers['content-type']?.split(';')[0] !== 'application/json') {
            throw new OperationError(403, 'Realiza la operación desde LA TERRAZA.');
          }
          const payload = await bodyJson(request);
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new OperationError(400, 'Formulario no válido.');
          const writes = {
            'github/conectar': () => github.connect(payload.token), 'github/desconectar': github.disconnect,
            'github/crear': () => github.create(payload.branch),
            'github/fusionar': async () => {
              const result = await github.merge(payload);
              const delivery = Object.entries(store.board().pushes || {}).find(([, item]) =>
                item.commit === payload.revision && item.pull?.number === payload.number);
              if (delivery && result.merged) savePush(delivery[0], { ...delivery[1], pull: { ...delivery[1].pull, merged: true } });
              return result;
            },
            'hostinger/conectar': () => hostinger.connect(payload.target),
            'hostinger/preparar': () => hostinger.prepare(payload.revision), 'hostinger/desplegar': () => hostinger.start(payload),
          };
          if (Object.hasOwn(writes, route)) return json(200, await writes[route]());
          const action = route.match(/^admin\/(login|logout|pause|create-account|account|license)$/)?.[1];
          if (action) {
            const result = await admin.handle(action, request.headers.cookie, payload, response);
            if (action === 'pause') availabilityExpiry = 0;
            return json(200, result);
          }
        }
        throw new OperationError(404, 'Operación no disponible.');
      }
      const implementedPreview = path.match(/^\/vista-encargo\/([a-z0-9][a-z0-9-]{0,63})$/);
      if (request.method === 'GET' && implementedPreview) {
        const id = implementedPreview[1];
        const delivery = await readJson(join(runner.output('implementacion'), id + '.json'), null);
        if (!delivery?.implementation?.verified) throw new PanelError(404, 'Vista de la entrega no disponible.');
        if (!(await implementation.verifiedWorktree(id, delivery.implementation))) {
          throw new PanelError(409, 'La copia de la vista previa ya no coincide con el commit verificado.');
        }
        if (!implementationPreviews.has(id)) implementationPreviews.set(id, createPreviews(implementation.worktree(id)));
        response.writeHead(303, { Location: await implementationPreviews.get(id).open(delivery.app, delivery.app === 'hazlotu' ? 'landing' : 'app') });
        response.end();
        return;
      }
      const preview = path.match(/^\/vista-local\/([a-z]+)\/(app|landing)$/);
      if (request.method === 'GET' && preview) {
        response.writeHead(303, { Location: await previews.open(preview[1], preview[2]) });
        response.end();
        return;
      }
      if (request.method === 'GET' && path === '/api/cambios') return json(200, await changes.history(url.searchParams));
      if (request.method === 'POST' && path === '/api/cambios/sincronizar') return json(200, await changes.sync());
      if (request.method === 'POST' && path === '/api/cambios/hostinger') {
        const { revision } = await bodyJson(request);
        return json(200, await changes.deploy(revision));
      }
      if (request.method === 'GET' && path === googleCallback) {
        const connected = await connections.googleFinish(url.searchParams);
        response.writeHead(303, { Location: `/?google=${connected ? 'conectado' : 'pendiente'}#conexiones` });
        response.end();
        return;
      }
      if (request.method === 'GET' && path === '/api/videos/descargar') return await connections.downloadVideo(url.searchParams.get('id'), response);
      if (/^\/api\/(conexiones|publicaciones|estadisticas|videos)(\/|$)/.test(path)) {
        const payload = request.method === 'POST' ? await bodyJson(request) : {};
        return json(200, await connections.handle(path, request.method, payload, origin));
      }
      const asset = assets.get(path);
      const icon = path.startsWith('/marcas/') && path.slice('/marcas/'.length);
      if (request.method === 'GET' && appIcons.has(icon)) {
        const content = await readFile(new URL(`../marketing/app_landings_demo/assets/brand/${icon}`, import.meta.url));
        response.writeHead(200, { 'Content-Type': icon.endsWith('.svg') ? 'image/svg+xml' : 'image/png' });
        response.end(content);
        return;
      }
      if (request.method === 'GET' && asset) {
        const [file, type] = asset;
        const content = await readFile(new URL(`./educame-dashboard/${file}`, import.meta.url));
        response.writeHead(200, { 'Content-Type': type.startsWith('image/') ? type : `${type}; charset=utf-8` });
        response.end(content);
        return;
      }
      if (request.method === 'GET' && path === '/api/panel') {
        const batch = runner.latest();
        const batches = runner.recent();
        const history = await deliveries();
        const board = store.board();
        return json(200, { board, agentEditor: agentEditor(board.agentEdits), history: history.slice(0, 100), batch, batches,
          terraceNeedsRestart,
          model, apiReady: Boolean(activeApiKey()), concurrency, maxTasks, fixture, projectProfiles, memoryTopics });
      }
      if (request.method === 'PUT' && path === '/api/agentes') {
        if (request.headers.origin !== origin) throw new PanelError(403, 'Edita los agentes desde LA TERRAZA.');
        const payload = await bodyJson(request);
        const board = changeBoard(payload.revision, current => {
          try { return { agentEdits: updateAgent(current.agentEdits, payload) }; }
          catch (error) { throw new PanelError(400, error.message); }
        });
        return json(200, { board, agentEditor: agentEditor(board.agentEdits) });
      }
      if (request.method === 'GET' && path === '/api/codex') return json(200, await codex.status(url.searchParams.has('actualizar')));
      if (request.method === 'GET' && path === '/api/codex/uso') {
        const [account, history] = await Promise.all([codex.usage?.(url.searchParams.has('actualizar')), deliveries()]);
        const records = history.filter(item => item.model === 'Codex local' && Number.isFinite(item.usage?.total_tokens));
        return json(200, { ...account, local: { records: records.length,
          tokens: records.reduce((sum, item) => sum + item.usage.total_tokens, 0) } });
      }
      if (request.method === 'GET' && path === '/api/apps/estado') return json(200, await publicAppStatus());
      if (request.method === 'PUT' && path === '/api/panel') {
        const { revision, tasks, links } = await bodyJson(request);
        const updated = await changeBoard(revision, board => ({ tasks: validateBoard(tasks, board), links: validateLinks(links) }));
        return json(200, updated);
      }
      if (request.method === 'POST' && ['/api/ejecutar', '/api/encargos'].includes(path)) {
        if (deliveryWork) throw new PanelError(409, 'Espera a que termine la operación de la entrega.');
        const { mode, revision, tasks, engine = 'openai', researchOnly, agentRevision } = await bodyJson(request);
        if (!['openai', 'codex'].includes(engine)) throw new PanelError(400, 'Elige Codex u OpenAI API.');
        if (!['real', 'prueba', 'implementacion'].includes(mode)) throw new PanelError(400, 'Elige cómo ejecutar el lote.');
        const queued = path === '/api/ejecutar';
        const board = store.board();
        if (queued && revision !== board.revision) throw new PanelError(409, 'El lote ha cambiado. Vuelve a cargar antes de ejecutarlo.');
        let selected = queued ? board.tasks : validateBoard(tasks, board);
        if (queued && mode === 'real' && researchOnly === true) selected = selected.filter(task => task.agente === researchRole);
        if (queued && mode === 'implementacion') selected = selected.filter(task => task.agente !== researchRole);
        if (mode === 'implementacion' && selected.some(task => task.agente === researchRole)) {
          throw new PanelError(400, 'Ejecuta Copiador en modo de análisis. Sus ideas se pueden convertir en encargos de implementación.');
        }
        return json(202, await runner.start({ mode, engine, tasks: selected, revision: queued ? revision : agentRevision }));
      }
      if (request.method === 'POST' && path === '/api/encargos/retomar') {
        const { id } = await bodyJson(request);
        return json(202, await runner.resume(id));
      }
      if (request.method === 'POST' && path === '/api/encargos/github') {
        const { key } = await bodyJson(request);
        const delivery = await implementationDelivery(key);
        approveCheck(key, delivery);
        return json(200, savePush(key, { ...await implementation.push(delivery.id, delivery.implementation), app: delivery.app }));
      }
      if (request.method === 'POST' && path === '/api/revisar') {
        const { key, decision, note, revision, rule, commit } = await bodyJson(request);
        if (typeof key !== 'string' || !decisions.includes(decision) || typeof note !== 'string' || note.length > 2000) {
          throw new PanelError(400, 'Revisa la decisión y la nota.');
        }
        const delivery = (await deliveries()).find(item => item.key === key && ['borrador', 'completado'].includes(item.status));
        if (!delivery) throw new PanelError(404, 'La entrega no está disponible para revisar.');
        if (commit !== undefined && commit !== delivery.implementation?.commit) throw new PanelError(409, 'La entrega cambió. Ábrela de nuevo.');
        const updated = await changeBoard(revision, current => ({
          reviews: { ...current.reviews, [key]: { decision, note: note.trim(), date: new Date().toISOString(),
            ...(delivery.implementation?.verified ? { commit: delivery.implementation.commit } : {}) } },
          ...(rule != null ? { memory: updateMemory(current.memory, rule, key) } : {}),
        }));
        return json(200, updated);
      }
      if (request.method === 'POST' && path === '/api/memoria') {
        const { revision, rule } = await bodyJson(request);
        return json(200, await changeBoard(revision, current => ({ memory: updateMemory(current.memory, rule) })));
      }
      throw new PanelError(404, 'Página no encontrada.');
    } catch (error) {
      if (!(error instanceof PanelError || error instanceof ConnectionError || error instanceof ChangesError ||
            error instanceof RunnerError || error instanceof ImplementationError ||
            error instanceof OperationError)) console.error('Error del panel:', error.code || error.name);
      json(error.status || 500, { error: error.status ? error.message : 'No se pudo completar la operación local.' });
    }
  });
  server.on('close', () => {
    previews.close();
    for (const view of implementationPreviews.values()) view.close();
    Promise.allSettled([runner.wait(), hostinger.wait(), chat.wait(), deliveryWork]).finally(store.close).catch(() => {});
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.EDUCAME_DASHBOARD_PORT || 4317);
  try {
    const server = await createDashboard({
      restartProcess() {
        const child = spawn(process.execPath, [fileURLToPath(import.meta.url)],
          { detached: true, windowsHide: true, stdio: 'ignore' });
        child.on('error', error => console.error('No se pudo reiniciar LA TERRAZA:', error.code));
        child.unref();
      },
    });
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} ya está en uso.` : `No se pudo abrir el panel (${error.code}).`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => console.log(`LA TERRAZA · http://127.0.0.1:${server.address().port}/`));
  } catch (error) {
    console.error('No se pudo iniciar el panel:', error.code || error.name);
    process.exitCode = 1;
  }
}
