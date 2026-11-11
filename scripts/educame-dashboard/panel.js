import { setupWorkspace, sourceLines } from './workspace.js';
import { setupChanges } from './changes.js';
import { mountIcons } from './icons.js';
import { setupTheory } from './theory.js';
import { setupMemory } from './memory.js';
import { setupOperations } from './operations.js';
import { setupAgentEditor } from './agent-editor.js';
import { setupChat } from './chat.js';
import { setupWorkProgress } from './work-progress.js';

const agents = Object.create(null);
const agentName = item => item.agentName || agents[item.agente]?.name || item.agente;
const states = {
  pendiente: ['Listo', 'pending'], espera: ['Espera un borrador', 'pending'], 'en curso': ['En curso', 'ready'],
  borrador: ['Borrador', 'ready'], fallido: ['Fallido', 'error'], bloqueado: ['Bloqueado', 'error'],
  completado: ['Completado', 'ready'], interrumpido: ['Interrumpido', 'pending'],
  aprobada: ['Aprobado', 'ready'], cambios: ['Cambios solicitados', 'pending'],
};
const taskForm = document.querySelector('#task-form');
const linkForm = document.querySelector('#link-form');
const reviewForm = document.querySelector('#review-form');
const historyFilter = document.querySelector('#history-filter');
const menu = document.querySelector('.terrace-menu');
const navigation = document.querySelector('#terrace-navigation');
const dates = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' });
let state;
let reviewing;
let poll;
let workspace;
let changes;
let operations;
let agentProfilesKey;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, action) {
  const node = element('button', 'button secondary', label);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

function badge(status) {
  const [label, color] = states[status] || states.pendiente;
  return element('span', `badge ${color}`, label);
}

async function api(path, method = 'GET', payload) {
  const response = await fetch(path, {
    method, headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function feedback(message, error = false) {
  const node = document.querySelector('#feedback');
  node.classList.toggle('error', error);
  document.querySelector('#feedback-text').textContent = message;
  node.hidden = !message;
}

function formMessage(form, message = '') {
  const node = form.querySelector('.form-message');
  node.textContent = message;
  node.hidden = !message;
}

function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  menu.closest('.sidebar').classList.toggle('is-open', open);
}

function showPage() {
  const hash = location.hash.slice(1);
  const development = hash === 'teoria/desarrollo';
  const operation = /^control\/(github|hostinger|admin)(?:\/([a-f0-9]+))?$/.exec(hash);
  const deliveryId = /^entregas\/([a-z0-9][a-z0-9-]{0,63})$/.exec(hash)?.[1];
  const work = deliveryId || ['entregas', 'flujos', 'operaciones'].includes(hash) || hash.startsWith('agentes/');
  const requested = development ? 'teoria' : operation ? 'control' : work ? 'agentes' : hash;
  const page = [...document.querySelectorAll('[data-page]')].some(node => node.dataset.page === requested) ? requested : 'inicio';
  document.querySelectorAll('[data-page]').forEach(node => { node.hidden = node.dataset.page !== page; });
  navigation.querySelectorAll('a').forEach(node => {
    if (node.hash === `#${page === 'enlaces' ? 'apps' : page}`) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  });
  const active = navigation.querySelector('[aria-current="page"]');
  document.querySelector('#page-location').textContent = active?.textContent || 'Inicio';
  setMenu(false);
  window.scrollTo(0, 0);
  if (page === 'cambios') changes?.load();
  if (page === 'control') operations?.open(operation?.[1], operation?.[2]);
  if ((deliveryId || hash === 'entregas') && state) refresh().then(openLinkedDelivery).catch(error => feedback(error.message, true));
  if (page === 'chat') chat.open();
  if (page === 'teoria') theory.openTrack(development);
  if (page === 'agentes') {
    memory.renderAgentHint(); operations?.refreshQuota();
    if (hash === 'agentes/nuevo') workspace.openComposer();
    if (hash === 'agentes/revisar') {
      historyFilter.value = 'pendientes';
      if (state) renderHistory();
    }
    if (hash === 'agentes/uso') {
      const usage = document.querySelector('#codex-usage').closest('details');
      usage.open = true;
      usage.scrollIntoView({ block: 'start' });
    }
    const target = { operaciones: '#work-queue', entregas: '#work-results',
      'agentes/cola': '#work-queue', 'agentes/progreso': '#team-activity',
      'agentes/resultados': '#work-results', 'agentes/revisar': '#work-results' }[hash];
    if (target) document.querySelector(target).scrollIntoView({ block: 'start' });
    document.querySelectorAll('.work-navigation a').forEach(link => {
      if (link.hash === '#' + hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
}

function openLinkedDelivery() {
  const id = /^#entregas\/([a-z0-9][a-z0-9-]{0,63})$/.exec(location.hash)?.[1];
  const delivery = id && state.history.find(item => item.key === 'implementacion/' + id);
  if (delivery && !reviewForm.closest('dialog').open) openDelivery(delivery);
}

function taskRow(task, index) {
  const row = element('article', 'item');
  const copy = element('div');
  const parent = state.board.tasks.find(item => item.id === task.revisar);
  const source = state.batch?.jobs[task.id];
  const stored = state.history.find(item => item.id === task.id);
  const status = source || stored || { status: task.revisar ? 'espera' : 'pendiente' };
  const mode = source ? state.batch.mode : stored?.mode;
  copy.append(
    element('p', 'item-title', task.encargo),
    element('p', 'item-meta', `${index + 1} · ${agentName(task)}${parent ? ` · Revisa el encargo ${state.board.tasks.indexOf(parent) + 1}` : ''}`),
  );
  if (status.error) copy.append(element('p', 'item-meta', status.error));
  const controls = element('div', 'actions');
  controls.append(badge(status.status));
  if (mode === 'prueba') controls.append(element('span', 'badge demo', 'Simulación'));
  const edit = button('Editar', () => openTask(task));
  const remove = button('Retirar', () => {
    if (state.board.tasks.some(item => item.revisar === task.id)) {
      feedback('Retira primero el encargo de Revisión que depende de este.', true);
      return;
    }
    saveBoard({ tasks: state.board.tasks.filter(item => item.id !== task.id) })
      .then(() => feedback('Encargo retirado del lote.')).catch(error => feedback(error.message, true));
  });
  edit.disabled = remove.disabled = Boolean(state.batch?.running && state.batch.tasks.some(item => item.id === task.id));
  controls.append(edit, remove);
  if (stored) controls.append(button('Ver entrega', () => openDelivery(stored)));
  row.append(copy, controls);
  return row;
}

function deliveryVerdict(delivery) {
  const saved = state.board.reviews[delivery.key];
  return delivery.implementation && saved?.commit !== delivery.implementation.commit ? undefined : saved;
}

function renderHistory() {
  const filter = historyFilter.value;
  const selected = state.history.filter(item => filter === 'todas' ||
    (filter === 'copiador' && item.mode === 'real' && item.agente === 'copiador') ||
    (filter === 'pendientes' && workProgress.needsAttention(item, state.board)) || item.mode === filter);
  const rows = selected.map(delivery => {
    const row = element('article', 'item');
    const copy = element('div');
    copy.append(
      element('p', 'item-title', delivery.draft?.resumen || delivery.encargo),
      element('p', 'item-meta', `${agentName(delivery)} · ${dates.format(new Date(delivery.finishedAt))}`),
    );
    const controls = element('div', 'actions');
    if (delivery.mode === 'prueba') controls.append(element('span', 'badge demo', 'Simulación'));
    controls.append(workProgress.statusBadge(delivery, state.board));
    controls.append(button('Abrir entrega', () => openDelivery(delivery)));
    row.append(copy, controls);
    return row;
  });
  document.querySelector('#history').replaceChildren(...(rows.length ? rows : [element('p', 'empty', 'No hay entregas en esta vista. Los resultados aparecerán al ejecutar o simular un lote.')]));
}

function renderLinks() {
  const cards = state.board.links.map(link => {
    const card = element('article', 'link-card');
    const anchor = element('a', 'button secondary', 'Abrir ↗');
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    const controls = element('div', 'actions');
    controls.append(anchor, button('Editar', () => openLink(link)), button('Quitar', () => {
      saveBoard({ links: state.board.links.filter(item => item.id !== link.id) })
        .then(() => feedback('Enlace retirado.')).catch(error => feedback(error.message, true));
    }));
    card.append(element('span', 'badge', link.kind), element('h3', '', link.name), element('p', '', link.url), controls);
    return card;
  });
  document.querySelector('#links').replaceChildren(...(cards.length ? cards : [element('p', 'empty', 'Añade el primer enlace.')]));
}

function renderAgentProfiles() {
  const key = JSON.stringify(state.agentEditor.profiles);
  if (key === agentProfilesKey) return;
  agentProfilesKey = key;
  for (const id of Object.keys(agents)) delete agents[id];
  for (const profile of state.agentEditor.profiles) agents[profile.id] = profile;
  const select = taskForm.elements.agente;
  const selected = select.value;
  select.replaceChildren(...Object.values(agents).map(({ id, name }) => selectOption(id, name)));
  if (Object.hasOwn(agents, selected)) select.value = selected;
  workspace.refreshAgents();
  agentEditor.ready();
}

function render() {
  renderAgentProfiles();
  const { board, batch, concurrency, maxTasks, fixture, history } = state;
  const running = Boolean(batch?.running);
  const paused = batch?.state === 'paused';
  const codex = workspace?.codexStatus();
  const tasks = board.tasks;
  const rows = tasks.map(taskRow);
  document.querySelector('#task-list').replaceChildren(...(rows.length ? rows : [element('p', 'empty', 'La cola está vacía. Pulsa Nuevo encargo para preparar el siguiente trabajo.')]));
  document.querySelector('#limits').textContent = `${tasks.length} de ${maxTasks} preparados · hasta ${concurrency} agentes a la vez`;
  const apiStatus = document.querySelector('#api-status');
  apiStatus.textContent = !codex ? 'Comprobando Codex' : codex.ready ? 'Sesión activa' : 'Conectar Codex ↗';
  apiStatus.classList.toggle('ready', Boolean(codex?.ready));
  document.querySelector('#run-status').textContent = running ? 'Los agentes están trabajando. Puedes añadir encargos para después.'
    : paused ? 'Hay un trabajo interrumpido. Pulsa Retomar trabajo para continuar.'
      : tasks.length ? 'Pulsa Empezar cola para ejecutar los encargos preparados.' : 'Prepara un encargo para empezar.';
  document.querySelector('[data-resume-batch]').hidden = !paused;
  const runs = (state.batches || []).map(run => {
    const detail = element('details', 'memory-detail');
    const kind = run.mode === 'implementacion' ? 'Implementación' : run.mode === 'prueba' ? 'Simulación' : 'Borrador';
    const label = run.state === 'running' ? 'En curso' : run.state === 'paused' ? 'Interrumpido' : 'Finalizado';
    detail.append(element('summary', '', `${kind} · ${label} · ${dates.format(new Date(run.startedAt))}`));
    for (const task of run.tasks) {
      const job = run.jobs[task.id];
      const row = element('p', '', agentName(task) + ' · ' + task.encargo + ' ');
      row.append(badge(job?.status));
      detail.append(row);
      if (job?.error) detail.append(element('p', 'muted', job.error));
    }
    return detail;
  });
  document.querySelector('#run-history').replaceChildren(...(runs.length ? runs : [element('p', 'empty', 'Aquí aparecerán los lotes que ejecutes.')]));
  document.querySelectorAll('[data-action="new-task"]').forEach(node => { node.disabled = tasks.length >= maxTasks; });
  document.querySelectorAll('[data-action="example"]').forEach(node => {
    node.disabled = tasks.length + fixture.length > maxTasks;
    node.title = node.disabled ? 'El ejemplo requiere tres huecos en la cola.' : '';
  });
  document.querySelector('[data-action="new-link"]').disabled = false;
  document.querySelectorAll('[data-run]').forEach(node => {
    const mode = node.dataset.run;
    const researchers = tasks.some(task => task.agente === 'copiador');
    if (mode === 'real') node.hidden = !researchers;
    if (mode === 'implementacion') node.hidden = tasks.length > 0 && tasks.every(task => task.agente === 'copiador');
    node.disabled = running || paused || !tasks.length ||
      (mode === 'implementacion' && (!codex?.ready || tasks.every(task => task.agente === 'copiador'))) ||
      (mode === 'real' && (!researchers || (!codex?.ready && !state.apiReady)));
  });
  const activity = history.slice(0, 3).map(delivery => {
    const row = element('button', 'activity-row');
    row.type = 'button';
    const copy = element('span', 'activity-copy');
    copy.append(element('strong', '', delivery.draft?.resumen || delivery.encargo),
      element('small', '', [agentName(delivery), delivery.mode === 'prueba' ? 'Simulación' : delivery.model].filter(Boolean).join(' · ')));
    row.append(copy, delivery.implementation && !delivery.implementation.verified
      ? element('span', 'badge pending', 'Pruebas pendientes') : badge(deliveryVerdict(delivery)?.decision || delivery.status));
    row.addEventListener('click', () => openDelivery(delivery));
    return row;
  });
  if (running) {
    const progress = element('a', 'activity-progress', 'Hay un encargo en curso →');
    progress.href = '#agentes';
    activity.unshift(progress);
  }
  if (!activity.length) activity.push(element('p', 'empty', 'Tus encargos aparecerán aquí cuando haya resultados.'));
  document.querySelector('#home-activity').replaceChildren(...activity);
  renderHistory();
  renderLinks();
  memory.render();
  workspace?.render();
  workProgress.render(state);
}

async function refresh() {
  const next = await api('/api/panel');
  if (state && state.board.revision > next.board.revision) {
    next.board = state.board;
    next.agentEditor = state.agentEditor;
  }
  state = next;
  render();
  clearTimeout(poll);
  if (state.batch?.running) poll = setTimeout(() => refresh().catch(error => feedback(error.message, true)), 900);
}

async function saveBoard(changes) {
  const { revision, tasks, links } = state.board;
  state.board = await api('/api/panel', 'PUT', { revision, tasks, links, ...changes });
  render();
}

function selectOption(value, label) {
  const option = element('option', '', label);
  option.value = value;
  return option;
}

function openTask(task = null, agent = 'juegos') {
  const fields = taskForm.elements;
  const index = task ? state.board.tasks.findIndex(item => item.id === task.id) : state.board.tasks.length;
  document.querySelector('#task-dialog-title').textContent = task ? 'Editar encargo' : 'Nuevo encargo';
  fields.id.value = task?.id || '';
  fields.agente.value = task?.agente || agent;
  fields.app.value = memory.appFor(task);
  fields.encargo.value = task?.encargo || '';
  fields.contexto.value = task?.contexto || '';
  fields.fuentes.value = task?.fuentes?.join('\n') || '';
  fields.revisar.replaceChildren(selectOption('', 'Sin dependencia'), ...state.board.tasks.slice(0, index)
    .filter(item => !['revision', 'copiador'].includes(item.agente)).map(item => selectOption(item.id, item.encargo.slice(0, 90))));
  fields.revisar.value = task?.revisar || '';
  fields.agente.dispatchEvent(new Event('change'));
  formMessage(taskForm);
  taskForm.closest('dialog').showModal();
  fields.encargo.focus();
}

function openLink(link) {
  const fields = linkForm.elements;
  document.querySelector('#link-dialog-title').textContent = link ? 'Editar enlace' : 'Añadir enlace';
  fields.id.value = link?.id || '';
  fields.name.value = link?.name || '';
  fields.url.value = link?.url || '';
  fields.kind.value = link?.kind || 'App';
  formMessage(linkForm);
  linkForm.closest('dialog').showModal();
  fields.name.focus();
}

function renderResearch(report, delivery) {
  const section = element('section', 'research-report');
  section.append(element('h3', '', 'Fuentes y observaciones'));
  if (!report.searched) section.append(element('p', 'muted', 'Esta entrega carece de una consulta web confirmada. Las ideas pueden basarse en el contexto facilitado.'));
  const list = element('ul', 'research-list');
  function sourceLink(url, label) {
    const link = element('a', 'text-link', label || url);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    return link;
  }
  const statuses = { consultada: ['Consultada', 'ready'], parcial: ['Parcial', 'pending'], inaccesible: ['Acceso sin confirmar', 'pending'] };
  const byUrl = new Map();
  for (const source of report.fuentes) {
    if (!/^https?:\/\//i.test(source.url)) continue;
    byUrl.set(source.url, source.title || new URL(source.url).hostname);
    const row = element('li', 'research-card');
    const [label, style] = statuses[source.estado] || statuses.inaccesible;
    const heading = element('div', 'research-meta');
    heading.append(sourceLink(source.url, source.title), element('span', `badge ${style}`, label));
    row.append(heading);
    if (source.observacion) row.append(element('p', '', source.observacion));
    list.append(row);
  }
  section.append(list);
  if (report.ideas.length) section.append(element('h3', '', 'Ideas para Educame'));
  for (const idea of report.ideas) {
    if (!Object.hasOwn(agents, idea.agente) || idea.agente === 'copiador') continue;
    const row = element('article', 'research-card');
    row.append(element('h4', '', idea.titulo), element('p', '', idea.propuesta));
    if (idea.beneficio) row.append(element('p', '', idea.beneficio));
    row.append(element('p', 'muted', 'Cómo probarlo · ' + idea.prueba));
    const links = element('div', 'research-meta');
    for (const url of idea.fuentes) if (byUrl.has(url)) links.append(sourceLink(url, byUrl.get(url)));
    if (links.children.length) row.append(links);
    const actions = element('div', 'research-meta');
    if (idea.esfuerzo) actions.append(element('span', 'badge pending', `Esfuerzo ${idea.esfuerzo}`));
    if (delivery.mode !== 'prueba') actions.append(button('Preparar encargo para ' + agents[idea.agente].name, () => {
      reviewForm.closest('dialog').close();
      workspace.prepareIdea(delivery.app, idea);
    }));
    row.append(actions);
    section.append(row);
  }
  return section;
}

function deliveryFlow(delivery, verdict) {
  const artifact = delivery.implementation;
  const verified = artifact.verified;
  const approved = verified && verdict?.decision === 'aprobada' && verdict.commit === artifact.commit;
  const pushed = state.board.pushes?.[delivery.key];
  const integrated = pushed?.pull?.merged || pushed?.integratedRevision;
  const local = delivery.app === 'control';
  const box = element('section', 'delivery-flow');
  const steps = element('ol', 'delivery-steps');
  const phases = ['Pruebas', 'Revisión', 'GitHub', ...(!local ? ['Hostinger'] : [])];
  const current = !verified ? 0 : !approved ? 1 : integrated ? 3 : 2;
  phases.forEach((label, index) => {
    const done = index < current;
    const step = element('li', '', label);
    if (done) step.className = 'is-done';
    else if (index === current) step.setAttribute('aria-current', 'step');
    steps.append(step);
  });
  const summary = !verified ? 'Pruebas pendientes' : !approved ? 'Lista para revisar' :
    integrated ? 'Integrada en GitHub' : pushed?.pull ? 'Solicitud de cambios preparada' :
      pushed ? 'Rama subida a GitHub' : 'Entrega aprobada';
  const status = element('p', 'form-message');
  status.setAttribute('role', 'status');
  status.hidden = true;
  const actions = element('div', 'actions');
  const payload = { key: delivery.key, commit: artifact.commit };
  const dialog = reviewForm.closest('dialog');
  function action(label, pending, run, primary = false) {
    const control = button(label, async () => {
      const buttons = [...dialog.querySelectorAll('button:not([data-close])')].filter(node => !node.disabled);
      buttons.forEach(node => { node.disabled = true; });
      control.textContent = pending;
      status.hidden = true;
      try { await run(); }
      catch (error) { status.textContent = error.message; status.hidden = false; }
      finally {
        control.textContent = label;
        buttons.forEach(node => { node.disabled = false; });
      }
    });
    if (primary) control.className = 'button primary';
    actions.append(control);
  }
  function link(label, href, external = false) {
    const anchor = element('a', 'button secondary', label);
    anchor.href = href;
    if (external) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    } else anchor.addEventListener('click', () => { feedback(''); dialog.close(); });
    actions.append(anchor);
  }
  box.append(element('h3', '', summary), steps);
  if (verified) box.append(element('p', 'muted', 'Commit ' + artifact.commit.slice(0, 8)));
  if (!verified) {
    box.append(element('p', 'muted', delivery.canRevalidate ?
      'Puedes ejecutar las pruebas de esta copia en tu equipo y conservar el trabajo ya hecho.' :
      'La copia está guardada. Prepara un seguimiento para resolver las comprobaciones pendientes.'));
    if (delivery.canRevalidate) action('Volver a comprobar', 'Ejecutando pruebas…', async () => {
      const result = await api('/api/encargos/comprobar', 'POST', payload);
      await refresh();
      if (dialog.open && reviewing.key === delivery.key) openDelivery(result);
    }, true);
  } else {
    if (!['ecosistema', 'control'].includes(delivery.app)) link('Vista de la entrega', '/vista-encargo/' + delivery.id, true);
    const diff = element('details', 'operation-file');
    const patch = element('pre');
    diff.append(element('summary', '', 'Ver cambios de código'), patch);
    diff.addEventListener('toggle', async () => {
      if (!diff.open || diff.dataset.loaded) return;
      diff.dataset.loaded = 'true';
      patch.textContent = 'Cargando…';
      try {
        const result = await api('/api/encargos/diferencias?key=' + encodeURIComponent(delivery.key));
        if (result.commit !== artifact.commit) throw new Error('La entrega cambió. Ábrela de nuevo.');
        patch.textContent = result.patch + (result.truncated ? '\n\nVista previa parcial. Consulta el diff completo en GitHub.' : '');
      } catch (error) { delete diff.dataset.loaded; patch.textContent = error.message; }
    });
    box.append(diff);
  }
  if (approved) {
    if (local) {
      if (state.terraceNeedsRestart) action('Reiniciar LA TERRAZA', 'Reiniciando…', () => chat.restart(), true);
      else action(integrated ? 'Actualizar LA TERRAZA desde GitHub' : 'Aplicar en este equipo', 'Aplicando…', async () => {
        const result = await api('/api/encargos/aplicar', 'POST', {
          ...payload, fromGithub: Boolean(integrated), pull: pushed?.pull?.number,
        });
        await refresh();
        if (dialog.open && reviewing.key === delivery.key) openDelivery(delivery);
        feedback(result.needsRestart ? 'Cambio aplicado. Reinicia LA TERRAZA para cargarlo.' : 'La revisión ya está aplicada.');
      }, true);
      if (integrated && !state.terraceNeedsRestart) box.append(element('p', 'muted', 'La actualización trae la versión de main a este equipo.'));
    }
    if (pushed?.pull || integrated) {
      if (pushed.pull) link('Revisar solicitud #' + pushed.pull.number, '#control/github/' + pushed.pull.number);
      if (!local && integrated) action('Continuar a Hostinger', 'Verificando revisión…', async () => {
        const result = await api('/api/encargos/verificar-publicacion', 'POST', { ...payload, pull: pushed.pull?.number });
        dialog.close();
        location.hash = 'control/hostinger/' + result.revision;
      }, true);
    }
    else {
      action(pushed ? 'Preparar solicitud en el panel' : 'Preparar publicación', 'Preparando GitHub…', async () => {
        const result = await api('/api/encargos/publicar', 'POST', payload);
        await refresh();
        if (dialog.open && reviewing.key === delivery.key) openDelivery(delivery);
        const publication = result.board.pushes[delivery.key];
        feedback(result.warning || (publication.integratedRevision ? 'La entrega ya está en main.' : publication.pull ?
          'Solicitud preparada. Puedes revisar y fusionar desde el panel.' :
          'Rama subida. Abre GitHub para preparar la solicitud o conecta tu cuenta en Operación.'), Boolean(result.warning));
      }, !local && !pushed);
      if (pushed?.url) {
        link('Abrir propuesta en GitHub', pushed.url, true);
        link('Conectar GitHub', '#control/github');
        action('Comprobar fusión', 'Consultando GitHub…', async () => {
          const result = await api('/api/encargos/verificar-publicacion', 'POST', payload);
          if (local) {
            await refresh();
            if (dialog.open && reviewing.key === delivery.key) openDelivery(delivery);
            return;
          }
          dialog.close();
          location.hash = 'control/hostinger/' + result.revision;
        });
      }
    }
  }
  const evidence = element('details', 'operation-file');
  evidence.append(element('summary', '', 'Ver archivos y registro técnico'));
  const list = element('ul');
  for (const file of artifact.files || []) list.append(element('li', '', file));
  if (!verified) list.append(element('li', '', '.educame-agents/worktrees/' + delivery.id));
  evidence.append(list);
  box.append(actions, status, evidence);
  return box;
}

function openDelivery(delivery) {
  reviewing = delivery;
  const artifact = delivery.implementation;
  const verdict = deliveryVerdict(delivery);
  document.querySelector('#delivery-title').textContent = delivery.draft?.resumen || 'Detalle del encargo';
  const meta = [delivery.mode === 'prueba' ? 'Simulación local' : delivery.model, dates.format(new Date(delivery.finishedAt))];
  if (delivery.app) meta.push(state.projectProfiles[delivery.app]?.name);
  if (verdict) meta.push(states[verdict.decision][0]);
  document.querySelector('#delivery-meta').textContent = meta.join(' · ');
  const body = document.querySelector('#delivery-body');
  body.replaceChildren();
  if (delivery.draft) {
    body.append(element('h3', '', artifact ? 'Qué se ha hecho' : 'Qué se propone'));
    const preview = element('pre', '', delivery.draft.entrega);
    preview.tabIndex = 0;
    body.append(preview);
    if (delivery.research) body.append(renderResearch(delivery.research, delivery));
    for (const [title, list, empty] of [
      ['Qué se ha comprobado', delivery.draft.comprobaciones, 'El agente no ha indicado comprobaciones.'],
      ['Qué falta', delivery.draft.pendientes, 'El agente no ha indicado pendientes. Revisa el resultado antes de aprobar.'],
    ]) {
      const section = element('section', 'delivery-summary');
      section.append(element('h3', '', title));
      if (title === 'Qué se ha comprobado' && delivery.checks?.length) {
        section.append(element('p', 'muted', 'Pruebas registradas por el panel:'));
        const checks = element('ul');
        for (const check of delivery.checks) checks.append(element('li', '',
          `${check.passed ? 'Pasó' : 'No pasó'}${check.source === 'local' ? ' en este equipo' : ''} · ${check.command}`));
        section.append(checks);
      }
      if (!list?.length) {
        section.append(element('p', 'muted', empty));
        body.append(section);
        continue;
      }
      if (title === 'Qué se ha comprobado') section.append(element('p', 'muted', 'Según la entrega del agente.'));
      const items = element('ul');
      items.append(...list.map(item => element('li', '', item)));
      section.append(items);
      body.append(section);
    }
    if (delivery.agente === 'marketing' && delivery.mode === 'real' && verdict?.decision === 'aprobada') {
      body.append(button('Llevar borrador a Publicar', () => {
        workspace.preparePost(delivery.draft.entrega);
        reviewForm.closest('dialog').close();
      }));
    }
  }
  if (delivery.error) body.append(element('p', 'form-message', delivery.error));
  body.append(element('h3', '', 'Siguiente paso'));
  if (artifact) body.append(deliveryFlow(delivery, verdict));
  else body.append(element('p', 'muted', delivery.mode === 'prueba' ?
    'Es una simulación: no se han aplicado cambios.' : delivery.draft ?
      'Revisa la propuesta. Puedes aprobarla o pedir cambios con una nota.' :
      'Prepara un seguimiento para resolver el error y continuar.'));
  if ((delivery.draft || delivery.error) && delivery.mode !== 'prueba') {
    const next = element('div', 'actions delivery-next');
    next.append(button('Preparar seguimiento', () => {
      if (workspace.prepareFollowUp(delivery)) body.closest('dialog').close();
    }));
    body.append(next);
  }
  const request = element('details', 'operation-file');
  request.append(element('summary', '', 'Ver encargo original'), element('p', '', delivery.encargo));
  body.append(request);
  if (delivery.productContext) body.append(memory.contextDetails(delivery.productContext));
  reviewForm.hidden = !delivery.draft || Boolean(artifact && !artifact.verified);
  reviewForm.querySelector('[value="aprobada"]').textContent = artifact?.verified ? 'Aprobar implementación' :
    delivery.research ? 'Aprobar análisis' : 'Aprobar borrador';
  reviewForm.elements.note.value = verdict?.note || '';
  memory.prepareReview(delivery);
  formMessage(reviewForm);
  if (!reviewForm.closest('dialog').open) reviewForm.closest('dialog').showModal();
}

async function submit(form, action, close = true) {
  const buttons = [...form.querySelectorAll('button[type="submit"]')];
  buttons.forEach(node => { node.disabled = true; });
  formMessage(form);
  try {
    await action();
    if (close) form.closest('dialog').close();
  } catch (error) {
    formMessage(form, error.message);
  } finally {
    buttons.forEach(node => { node.disabled = false; });
  }
}

taskForm.elements.agente.addEventListener('change', () => {
  const agent = taskForm.elements.agente.value;
  document.querySelector('#depends-field').hidden = agent !== 'revision';
  document.querySelector('#task-sources').hidden = agent !== 'copiador';
  taskForm.elements.fuentes.disabled = agent !== 'copiador';
  taskForm.elements.fuentes.required = agent === 'copiador';
});
taskForm.addEventListener('submit', event => {
  event.preventDefault();
  submit(taskForm, async () => {
    const { id: oldId, agente, app, encargo, contexto, revisar, fuentes } = Object.fromEntries(new FormData(taskForm));
    const newId = `enc-${crypto.randomUUID()}`;
    const task = { id: newId, agente, app, encargo: encargo.trim(), contexto: contexto.trim(), revisar: agente === 'revision' ? revisar : '',
      ...(agente === 'copiador' ? { fuentes: sourceLines(fuentes) } : {}) };
    const tasks = oldId ? state.board.tasks.map(item => {
      if (item.id === oldId) return task;
      if (item.revisar === oldId) return { ...item, id: `enc-${crypto.randomUUID()}`, revisar: newId };
      return item;
    }) : [...state.board.tasks, task];
    await saveBoard({ tasks });
    feedback('Encargo guardado.');
  });
});
linkForm.addEventListener('submit', event => {
  event.preventDefault();
  submit(linkForm, async () => {
    const link = Object.fromEntries(new FormData(linkForm));
    const links = link.id ? state.board.links.map(item => item.id === link.id ? link : item)
      : [...state.board.links, { ...link, id: `link-${crypto.randomUUID()}` }];
    await saveBoard({ links });
    feedback('Enlace guardado.');
  });
});
reviewForm.addEventListener('submit', event => {
  event.preventDefault();
  submit(reviewForm, async () => {
    const rule = memory.reviewRule();
    state.board = await api('/api/revisar', 'POST', {
      key: reviewing.key, decision: event.submitter.value, note: reviewForm.elements.note.value, revision: state.board.revision, rule,
      commit: reviewing.implementation?.commit,
    });
    render();
    feedback(rule ? 'Decisión y criterio guardados.' : 'Decisión guardada en la bandeja.');
    if (reviewing.implementation?.verified) openDelivery(reviewing);
  }, !reviewing.implementation?.verified);
});
document.querySelectorAll('[data-close]').forEach(node => node.addEventListener('click', () => node.closest('dialog').close()));
document.querySelector('.feedback-close').addEventListener('click', () => feedback(''));
document.querySelector('[data-action="new-task"]').addEventListener('click', () => openTask());
document.querySelector('[data-action="new-link"]').addEventListener('click', () => openLink());
document.querySelectorAll('[data-action="example"]').forEach(node => node.addEventListener('click', async () => {
  const ids = new Map(state.fixture.map(task => [task.id, `enc-${crypto.randomUUID()}`]));
  const example = state.fixture.map(task => ({ ...task, id: ids.get(task.id), revisar: ids.get(task.revisar) || '' }));
  try {
    await saveBoard({ tasks: [...state.board.tasks, ...example] });
    location.hash = 'operaciones';
    feedback('Ejemplo añadido al lote.');
  } catch (error) {
    feedback(error.message, true);
  }
}));
document.querySelectorAll('[data-run]').forEach(node => node.addEventListener('click', async () => {
  node.disabled = true;
  feedback('');
  try {
    const engine = node.dataset.run === 'implementacion' || (node.dataset.run === 'real' && workspace.codexStatus()?.ready) ? 'codex' : 'openai';
    await api('/api/ejecutar', 'POST', { mode: node.dataset.run, revision: state.board.revision, engine,
      researchOnly: node.dataset.run === 'real', consumeQueue: true });
    await refresh();
  } catch (error) {
    render();
    feedback(error.message, true);
  }
}));
document.querySelector('[data-resume-batch]').addEventListener('click', async event => {
  const node = event.currentTarget;
  node.disabled = true;
  try {
    await api('/api/encargos/retomar', 'POST', { id: state.batch.id });
    await refresh();
  } catch (error) { feedback(error.message, true); }
  finally { node.disabled = false; }
});

historyFilter.addEventListener('change', () => { if (state) renderHistory(); });
window.addEventListener('hashchange', showPage);
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
navigation.addEventListener('click', event => {
  if (event.target.closest('a') && menu.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    document.querySelector('#main').focus({ preventScroll: true });
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true' && !document.querySelector('dialog[open]')) {
    setMenu(false);
    menu.focus();
  }
});
document.querySelector('.skip-content').addEventListener('click', event => {
  event.preventDefault();
  setMenu(false);
  document.querySelector('#main').focus();
});
mountIcons();
const theory = setupTheory({ element });
const memory = setupMemory({ api, getState: () => state, setBoard: board => { state.board = board; render(); },
  element, button, selectOption, feedback, formMessage });
workspace = setupWorkspace({ agents, element, button, api, feedback, formMessage, selectOption, badge, saveBoard, refresh,
  getState: () => state, renderPanel: () => { if (state) render(); } });
const agentEditor = setupAgentEditor({ api, button, formMessage, getState: () => state, prepare: workspace.selectAgent,
  apply(result) {
    if (result.board.revision < state.board.revision) return;
    Object.assign(state, result);
    render();
  },
});
const chat = setupChat({ api, element, button, feedback, formMessage });
const workProgress = setupWorkProgress({ element, button, badge, openDelivery });
changes = setupChanges({ api, element });
operations = setupOperations({ api, element, button, feedback, openCommand: changes.openCommand });
showPage();
operations.refreshQuota();
refresh().then(openLinkedDelivery).catch(error => feedback(error.message, true));
