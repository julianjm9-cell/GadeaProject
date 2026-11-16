import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { projectProfiles, cleanRule, contextSettings } from './project-context.mjs';
import { defaultAgents, updateAgent, customAgentLimit } from './agent-profiles.mjs';
import { products } from './changes.mjs';
import { OperationError } from './operations.mjs';

const exec = promisify(execFile);
const key = 'knowledge-v1';
const sha = /^[a-f0-9]{40}$/;
const fold = text => text.normalize('NFKC').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sensitive = /-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:sk-|ghp_|github_pat_|AIza)[A-Za-z0-9_-]{20,}/;
const safeFile = file => typeof file === 'string' && !/(^|\/)(?:\.env(?:\.|$)|\.git(?:\/|$)|\.educame-agents(?:\/|$)|secrets|credentials)|\.(?:key|pem|sqlite|dump)$/i.test(file);
const cleanText = (text, limit) => typeof text === 'string' && !sensitive.test(text) ? text.slice(0, limit) : '';
const defaultGit = root => async args => (await exec('git', args, { cwd: root, windowsHide: true,
  timeout: 15000, maxBuffer: 3 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } })).stdout.trim();

export function createKnowledge({ store, root, readDelivery, git = defaultGit(root) }) {
  const state = () => store.operation(key) || { facts: {}, decisions: {}, imports: {} };
  let collecting;
  let cache;
  let cacheAt = 0;

  async function collect() {
    if (collecting) return collecting;
    collecting = (async () => {
      const board = store.board();
      const known = state().facts;
      const found = [];
      for (const [source, push] of Object.entries(board.pushes || {})) {
        if (!/^implementacion\/[a-z0-9-]{1,64}$/.test(source) || !sha.test(push.integratedRevision || '') || push.undoneRevision) continue;
        if (sha.test(push.commit || '') && known[digest([source, push.commit])]) continue;
        const delivery = await readDelivery(source).catch(() => null);
        const artifact = delivery?.implementation;
        if (!artifact?.verified || artifact.commit !== push.commit || !sha.test(artifact.commit) || !Object.hasOwn(projectProfiles, delivery.app)) continue;
        const id = digest([source, artifact.commit]);
        if (known[id]) continue;
        const learning = delivery.draft?.aprendizaje;
        let proposal;
        try { if (learning && !sensitive.test(JSON.stringify(learning))) proposal = cleanRule(learning); } catch {}
        found.push({ id, source, app: delivery.app, commit: artifact.commit, integratedRevision: push.integratedRevision,
          summary: cleanText(delivery.draft?.resumen, 500) || 'Cambio integrado',
          files: (artifact.files || []).filter(safeFile).slice(0, 30), checks: (delivery.checks || []).filter(check => check.passed).length,
          at: delivery.finishedAt, ...(proposal ? { proposal } : {}) });
      }
      const publication = store.operation('simple-publication-v1-last-published');
      if (publication?.state === 'published' && sha.test(publication.candidate || '') && !publication.undoOf && !publication.sources?.length) {
        const files = (publication.files || []).filter(safeFile);
        const scopes = Object.entries(products).filter(([app, product]) => Object.hasOwn(projectProfiles, app) &&
          files.some(file => product.paths.some(path => file.startsWith(path))));
        if (files.some(file => /^(?:backend\/|docs\/|tests\/|infra\/)/.test(file))) scopes.push(['ecosistema', projectProfiles.ecosistema]);
        for (const [app] of scopes) {
          const id = digest(['publicacion', publication.candidate, app]);
          if (known[id]) continue;
          found.push({ id, source: 'publicacion/' + publication.id, publicationId: publication.id, app,
            commit: publication.candidate, integratedRevision: publication.candidate,
            summary: 'Actualización de ' + projectProfiles[app].name + ' aceptada y subida desde LA TERRAZA.',
            files: files.slice(0, 30), checks: (publication.checks || []).filter(check => check.passed).length, at: publication.publishedAt });
        }
      }
      if (found.length || publication?.undoOf) store.transaction(() => {
        const current = state();
        for (const fact of found) current.facts[fact.id] ||= fact;
        if (publication?.undoOf) for (const fact of Object.values(current.facts)) if (fact.publicationId === publication.undoOf) fact.undone = true;
        store.writeOperation(key, current);
      });
    })().finally(() => { collecting = undefined; });
    return collecting;
  }

  async function repository(revision) {
    const head = revision || await git(['rev-parse', '--verify', 'HEAD']).catch(() => '');
    if (cache?.head === head && Date.now() - cacheAt < 5000) return cache;
    const upstream = await git(['rev-parse', '--verify', 'refs/remotes/origin/main']).catch(() => '');
    if (!sha.test(head)) return { head: '', upstream, files: [], changes: [], available: false };
    const [tree, log] = await Promise.all([
      git(['ls-tree', '-r', '--name-only', head, '--', 'apps/', 'marketing/', 'admin/', 'scripts/', 'docs/', 'tests/', 'backend/app/']).catch(() => ''),
      git(['log', '-12', '--format=%H%x09%aI%x09%s', head]).catch(() => ''),
    ]);
    cacheAt = Date.now();
    cache = { head, upstream, available: true, observedAt: new Date().toISOString(),
      files: tree.split('\n').filter(safeFile).filter(Boolean),
      changes: log.split('\n').map(line => {
        const [commit, at, ...subject] = line.split('\t');
        return { commit, at, summary: cleanText(subject.join(' '), 200) };
      }).filter(row => sha.test(row.commit)) };
    return cache;
  }

  async function snapshot(revision) {
    await collect();
    const repo = await repository(revision);
    const board = store.board();
    const facts = Object.values(state().facts).filter(fact => !fact.undone && !board.pushes[fact.source]?.undoneRevision);
    const result = {};
    for (const [app, profile] of Object.entries(projectProfiles)) {
      const paths = products[app]?.paths || ['apps/', 'marketing/', 'admin/', 'scripts/'];
      const files = repo.files.filter(file => paths.some(path => file.startsWith(path)));
      result[app] = {
        revision: repo.head, upstream: repo.upstream, observedAt: repo.observedAt,
        versionId: digest([repo.head, profile, board.memory.filter(rule => !rule.archived && [app, 'ecosistema'].includes(rule.app))]).slice(0, 16),
        versionNote: 'La revisión y los archivos corresponden a Git local. origin/main es la última referencia consultada, no una comprobación del VPS.',
        inventory: { files: files.length, illustrations: files.filter(file => /\.(?:png|webp|jpg|svg)$/i.test(file)).length,
          visualReferences: files.filter(file => /\.(?:png|webp|jpg)$/i.test(file) && /(?:preview|room|stage|board|hero|journey|mission)/i.test(file)).slice(0, 12),
          references: [...new Set([...profile.files.filter(file => repo.files.includes(file)), ...files.filter(file => /(?:index\.html|theme\.css|appearance\.css|mission.*\.js)$/.test(file))])].slice(0, 12) },
        accepted: facts.filter(fact => app === 'ecosistema' || fact.app === app || fact.app === 'ecosistema').sort((a, b) => String(b.at).localeCompare(String(a.at)))
          .slice(0, 6).map(({ proposal, ...fact }) => fact),
        recentCommits: repo.changes.slice(0, 4),
      };
    }
    return result;
  }

  async function read(app) {
    if (!Object.hasOwn(projectProfiles, app)) throw new OperationError(400, 'Selecciona una aplicación.');
    const context = (await snapshot())[app];
    const board = store.board(), current = state();
    const suggestions = Object.values(current.facts).filter(fact => fact.proposal && !current.decisions[fact.id] &&
      !board.pushes[fact.source]?.undoneRevision && (app === 'ecosistema' || fact.app === app) &&
      !board.memory.some(rule => rule.app === fact.app && fold(rule.criterio) === fold(fact.proposal.criterio)))
      .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20);
    return { app, context, suggestions, revision: board.revision };
  }

  async function decide({ id, revision, action }) {
    await collect();
    if (!['accept', 'dismiss'].includes(action)) throw new OperationError(400, 'Elige guardar o descartar el aprendizaje.');
    return store.transaction(() => {
      const board = store.board(), current = state(), fact = current.facts[id];
      if (current.decisions[id] === action) return board;
      if (revision !== board.revision) throw new OperationError(409, 'La memoria cambió. Actualiza antes de guardar.');
      if (!fact?.proposal || board.pushes[fact.source]?.undoneRevision) throw new OperationError(404, 'La propuesta ya no está disponible.');
      const memory = [...board.memory];
      if (action === 'accept' && !memory.some(rule => rule.app === fact.app && fold(rule.criterio) === fold(fact.proposal.criterio))) {
        memory.push({ id: 'aprendizaje-' + id.slice(0, 24), app: fact.app, ...fact.proposal, archived: false,
          source: fact.source, updatedAt: new Date().toISOString() });
      }
      const next = { ...board, memory, revision: board.revision + 1 };
      current.decisions[id] = action;
      store.writeBoard(next); store.writeOperation(key, current);
      return next;
    });
  }

  async function exportBundle(app) {
    if (app && !Object.hasOwn(projectProfiles, app)) throw new OperationError(400, 'Selecciona una aplicación.');
    const board = store.board();
    const contexts = await snapshot();
    const bundle = { format: 'educame-context', version: 1, exportedAt: new Date().toISOString(),
      rules: board.memory.filter(rule => !app || [app, 'ecosistema'].includes(rule.app)).map(({ id, app, tema, criterio, comprobacion, archived, updatedAt }) =>
        ({ id, app, tema, criterio, comprobacion, archived: Boolean(archived), updatedAt })),
      agents: board.agentEdits || {},
      reference: Object.fromEntries(Object.entries(contexts).filter(([key]) => !app || key === app)
        .map(([key, context]) => [key, { profile: projectProfiles[key], ...context }])) };
    if (sensitive.test(JSON.stringify(bundle))) throw new OperationError(400, 'Hay un texto que parece una clave. Revísalo en Memoria o en las instrucciones de los agentes antes de exportar.');
    if (Buffer.byteLength(JSON.stringify(bundle, null, 2)) > 260000) throw new OperationError(400, 'La memoria es grande. Exporta una aplicación cada vez.');
    return bundle;
  }

  async function markdown(app) {
    const bundle = await exportBundle(app);
    if (!app) throw new OperationError(400, 'Selecciona una aplicación para copiar su contexto.');
    const context = bundle.reference[app], profile = projectProfiles[app];
    const active = bundle.rules.filter(rule => !rule.archived);
    const text = [`# ${profile.name} · Contexto de desarrollo`, '',
      'Material de referencia: respeta la petición actual y comprueba el código antes de cambiarlo. Este documento no autoriza publicaciones ni acceso a datos privados.', '',
      `Revisión local: ${context.revision || 'No disponible'}`, context.versionNote, '',
      ...Object.entries({ audience: 'Público', style: 'Estética', flows: 'Funciones', priorities: 'Prioridades', rules: 'Reglas', pitfalls: 'Errores a evitar', verify: 'Comprobaciones' })
        .flatMap(([key, title]) => [`## ${title}`, profile[key], '']),
      '## Criterios confirmados', ...active.map(rule => `- ${rule.criterio} Comprobar: ${rule.comprobacion}`), '',
      '## Cambios aceptados en GitHub', ...context.accepted.map(fact => `- ${fact.summary} (${fact.commit}). Pruebas registradas: ${fact.checks}.`), '',
      '## Referencias del código', ...context.inventory.references.map(file => `- ${file}`), '',
      '## Referencias visuales existentes', ...context.inventory.visualReferences.map(file => `- ${file}`), '',
      '## Agentes personalizados', ...Object.entries(bundle.agents).map(([id, agent]) => `${id} · ${agent.name}\n${agent.description}\n${agent.implementation}`),
    ].join('\n');
    return { filename: `educame-contexto-${app}.md`, text };
  }

  function normalizeBundle(bundle) {
    if (!bundle || bundle.format !== 'educame-context' || bundle.version !== 1 || !Array.isArray(bundle.rules) ||
        bundle.rules.length > 400 || !bundle.agents || typeof bundle.agents !== 'object' || Array.isArray(bundle.agents) ||
        sensitive.test(JSON.stringify(bundle)) || Object.keys(bundle).some(key => !['format', 'version', 'exportedAt', 'rules', 'agents', 'reference'].includes(key))) {
      throw new OperationError(400, 'El archivo no es una memoria válida de Educame o contiene un texto que parece una clave.');
    }
    const rules = bundle.rules.map(rule => {
      if (!Object.hasOwn(projectProfiles, rule?.app) || Object.keys(rule).some(key => !['id', 'app', 'tema', 'criterio', 'comprobacion', 'archived', 'updatedAt'].includes(key))) throw new OperationError(400, 'Hay un criterio con campos no admitidos.');
      let content;
      try { content = cleanRule(rule); } catch (error) { throw new OperationError(400, error.message); }
      const id = typeof rule.id === 'string' && /^[a-z0-9-]{1,80}$/.test(rule.id) ? rule.id : 'importado-' + digest([rule.app, content]).slice(0, 24);
      return { id, app: rule.app, ...content, archived: rule.archived === true };
    });
    if (Object.keys(bundle.agents).length > Object.keys(defaultAgents).length + customAgentLimit) throw new OperationError(400, 'Hay demasiados perfiles de agentes.');
    const agents = {};
    for (const [id, profile] of Object.entries(bundle.agents)) {
      if (!Object.hasOwn(defaultAgents, id) && !/^agente-[a-f0-9-]{36}$/.test(id)) throw new OperationError(400, 'El identificador de un agente no es válido.');
      if (!profile || Object.keys(profile).some(key => !['name', 'description', 'draft', 'implementation', 'team'].includes(key))) throw new OperationError(400, 'El perfil de un agente contiene campos no admitidos.');
      try { agents[id] = updateAgent({ [id]: profile }, { action: 'edit', id, profile })[id]; }
      catch (error) { throw new OperationError(400, error.message); }
    }
    return { rules, agents };
  }

  function merge(board, bundle) {
    const memory = [...board.memory], agents = { ...board.agentEdits }, conflicts = [];
    let rulesAdded = 0, agentsAdded = 0;
    for (const rule of bundle.rules) {
      const existing = memory.find(item => item.id === rule.id || (item.app === rule.app && fold(item.criterio) === fold(rule.criterio)));
      if (existing) {
        if (existing.app !== rule.app || existing.tema !== rule.tema || fold(existing.criterio) !== fold(rule.criterio) || existing.comprobacion !== rule.comprobacion || Boolean(existing.archived) !== rule.archived) conflicts.push('Se conserva el criterio actual: ' + existing.criterio);
        continue;
      }
      memory.push({ ...rule, updatedAt: new Date().toISOString() }); rulesAdded++;
    }
    for (const [id, profile] of Object.entries(bundle.agents)) {
      const existing = agents[id];
      const sameName = Object.entries({ ...defaultAgents, ...agents }).find(([key, agent]) => key !== id && fold(agent.name) === fold(profile.name));
      if (sameName || (existing && JSON.stringify(existing) !== JSON.stringify(profile))) { conflicts.push('Se conserva el agente actual: ' + profile.name); continue; }
      if (existing) continue;
      if (!Object.hasOwn(defaultAgents, id) && Object.keys(agents).filter(key => !Object.hasOwn(defaultAgents, key)).length >= customAgentLimit) { conflicts.push('Sin espacio para el agente: ' + profile.name); continue; }
      agents[id] = profile; agentsAdded++;
    }
    return { memory, agentEdits: agents, rulesAdded, agentsAdded, conflicts };
  }

  function preview(bundle) {
    const normalized = normalizeBundle(bundle), id = digest(normalized), board = store.board();
    const merged = merge(board, normalized);
    store.writeOperation(key + '-import', { id, revision: board.revision, bundle: normalized });
    return { id, revision: board.revision, rulesAdded: merged.rulesAdded, agentsAdded: merged.agentsAdded, conflicts: merged.conflicts,
      rules: normalized.rules.map(({ app, criterio }) => ({ app, criterio })) };
  }

  function applyImport({ id, revision }) {
    return store.transaction(() => {
      const current = state(), board = store.board(), prepared = store.operation(key + '-import');
      if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw new OperationError(400, 'Prepara primero la importación.');
      if (current.imports[id]) return board;
      if (prepared?.id !== id || prepared.revision !== revision || board.revision !== revision) throw new OperationError(409, 'La memoria cambió. Vuelve a revisar el archivo antes de importar.');
      const merged = merge(board, prepared.bundle);
      const next = { ...board, memory: merged.memory, agentEdits: merged.agentEdits, revision: board.revision + 1 };
      current.imports[id] = new Date().toISOString();
      store.writeBoard(next); store.writeOperation(key, current);
      return next;
    });
  }

  return { read, snapshot, decide, exportBundle, markdown, preview, applyImport, wait: async () => { await collecting; } };
}
