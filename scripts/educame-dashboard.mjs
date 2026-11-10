import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
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
import { createImplementation, ImplementationError } from './educame-dashboard/implementation.mjs';

const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/panel.css', ['panel.css', 'text/css']],
  ['/panel.js', ['panel.js', 'text/javascript']],
  ['/workspace.js', ['workspace.js', 'text/javascript']],
  ['/workspace.css', ['workspace.css', 'text/css']],
  ['/changes.js', ['changes.js', 'text/javascript']],
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

function validateBoard(tasks) {
  if (Array.isArray(tasks) && tasks.length === 0) return [];
  try {
    return validateTasks(tasks);
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
      return { ...record, mode, key: `${mode}/${record.id}` };
    }));
  return records.filter(Boolean);
}

async function exampleDraft(task) {
  return {
    draft: {
      resumen: task.revision ? 'Entrega recibida para revisar' : 'Encargo recibido por el agente',
      entrega: task.revision
        ? `El flujo ha entregado el borrador de ${task.revisar} a Revisión.\n\nEncargo original: ${task.revision.encargo}\n\nResumen recibido: ${task.revision.borrador.resumen}`
        : `Encargo de ${task.agente}\n\n${task.encargo}\n\nEste resultado permite probar la cola y la bandeja de entregas.`,
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
} = {}) {
  await mkdir(directory, { recursive: true });
  const connections = await createConnections(directory, fetchImpl);
  const changes = createChanges(repositoryRoot);
  const previews = createPreviews(repositoryRoot);
  const activeApiKey = () => connections.openaiKey() || apiKey;
  const store = openPanelStore(directory, { memory: [], revision: 0, tasks: [], links: initialLinks, reviews: {}, pushes: {} });
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
      const implementedPreview = path.match(/^\/vista-encargo\/([a-z0-9][a-z0-9-]{0,63})$/);
      if (request.method === 'GET' && implementedPreview) {
        const id = implementedPreview[1];
        const delivery = await readJson(join(runner.output('implementacion'), id + '.json'), null);
        if (!delivery?.implementation?.verified) throw new PanelError(404, 'Vista de la entrega no disponible.');
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
        response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
        response.end(content);
        return;
      }
      if (request.method === 'GET' && path === '/api/panel') {
        const history = await deliveries();
        return json(200, { board: store.board(), history: history.slice(0, 100), batch: runner.latest(), batches: runner.recent(),
          model, apiReady: Boolean(activeApiKey()), concurrency, maxTasks, fixture, projectProfiles, memoryTopics });
      }
      if (request.method === 'GET' && path === '/api/codex') return json(200, await codex.status(url.searchParams.has('actualizar')));
      if (request.method === 'GET' && path === '/api/apps/estado') return json(200, await publicAppStatus());
      if (request.method === 'PUT' && path === '/api/panel') {
        const { revision, tasks, links } = await bodyJson(request);
        const updated = await changeBoard(revision, () => ({ tasks: validateBoard(tasks), links: validateLinks(links) }));
        return json(200, updated);
      }
      if (request.method === 'POST' && ['/api/ejecutar', '/api/encargos'].includes(path)) {
        const { mode, revision, tasks, engine = 'openai' } = await bodyJson(request);
        if (!['openai', 'codex'].includes(engine)) throw new PanelError(400, 'Elige Codex u OpenAI API.');
        if (!['real', 'prueba', 'implementacion'].includes(mode)) throw new PanelError(400, 'Elige cómo ejecutar el lote.');
        const queued = path === '/api/ejecutar';
        const board = store.board();
        if (queued && revision !== board.revision) throw new PanelError(409, 'El lote ha cambiado. Vuelve a cargar antes de ejecutarlo.');
        const selected = queued ? board.tasks : validateBoard(tasks);
        return json(202, await runner.start({ mode, engine, tasks: selected, revision: queued ? revision : undefined }));
      }
      if (request.method === 'POST' && path === '/api/encargos/retomar') {
        const { id } = await bodyJson(request);
        return json(202, await runner.resume(id));
      }
      if (request.method === 'POST' && path === '/api/encargos/github') {
        const { key } = await bodyJson(request);
        const id = /^implementacion\/([a-z0-9][a-z0-9-]{0,63})$/.exec(key || '')?.[1];
        if (!id) throw new PanelError(404, 'No se encuentra la entrega.');
        const delivery = await readJson(join(runner.output('implementacion'), id + '.json'), null);
        if (delivery?.status !== 'completado') throw new PanelError(409, 'La implementación debe completar sus comprobaciones antes de subirla.');
        const review = store.board().reviews[key];
        if (review?.decision !== 'aprobada' || review.commit !== delivery.implementation.commit) {
          throw new PanelError(409, 'Aprueba la revisión antes de subirla a GitHub.');
        }
        const pushed = await implementation.push(id, delivery.implementation);
        return json(200, store.transaction(() => {
          const board = store.board();
          if (board.pushes?.[key]?.commit === pushed.commit) return board;
          const updated = { ...board, revision: board.revision + 1, pushes: { ...board.pushes, [key]: pushed } };
          store.writeBoard(updated);
          return updated;
        }));
      }
      if (request.method === 'POST' && path === '/api/revisar') {
        const { key, decision, note, revision, rule } = await bodyJson(request);
        if (typeof key !== 'string' || !decisions.includes(decision) || typeof note !== 'string' || note.length > 2000) {
          throw new PanelError(400, 'Revisa la decisión y la nota.');
        }
        const delivery = (await deliveries()).find(item => item.key === key && ['borrador', 'completado'].includes(item.status));
        if (!delivery) throw new PanelError(404, 'La entrega no está disponible para revisar.');
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
            error instanceof RunnerError || error instanceof ImplementationError)) console.error('Error del panel:', error.code || error.name);
      json(error.status || 500, { error: error.status ? error.message : 'No se pudo completar la operación local.' });
    }
  });
  server.on('close', () => {
    previews.close();
    for (const view of implementationPreviews.values()) view.close();
    Promise.resolve(runner.wait()).finally(store.close).catch(() => {});
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.EDUCAME_DASHBOARD_PORT || 4317);
  try {
    const server = await createDashboard();
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} ya está en uso.` : `No se pudo abrir el panel (${error.code}).`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => console.log(`Educame · Centro de mando en http://127.0.0.1:${server.address().port}/`));
  } catch (error) {
    console.error('No se pudo iniciar el panel:', error.code || error.name);
    process.exitCode = 1;
  }
}
