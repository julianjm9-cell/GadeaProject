import { icon, networkIcon } from './icons.js';

const apps = {
  ecosistema: ['Educame · todas las apps'],
  profesor: ['Profesor Particular', '/profesor-particular', 'profesor-simple-v2.png', 'violet', 'profesor(?:-particular)?', 'PROFESOR_PARTICULAR'],
  eso: ['ESO Adultos', '/eso-adultos', 'eso-simple-v2.png', 'green', 'eso-adultos|e25', 'ESO_ADULTOS'],
  ingles: ['Inglés', '/cambridge-info', 'ingles-simple.png', 'blue', 'cambridge(?:-info)?', 'CAMBRIDGE'],
  diplomator: ['Diplomator', '/diplomator', 'diplomator-simple-v2.png', 'gold', 'diplomator', 'DIPLOMATOR'],
  universidad: ['Universidad +25', '/u25', 'u25-simple.png', 'coral', 'universidad-adultos|u25', 'UNIVERSIDAD_ADULTOS'],
  facturas: ['Lector de facturas', '/ocr-facturas', 'facturas.svg', 'blue', 'ocr-facturas|facturas', 'OCR_FACTURAS'],
  hazlotu: ['HazloTú', '/hazlo-tu', 'hazlotu-logo.png', 'green', null, 'HAZLOTU'],
};
const agentArt = {
  mantenimiento: ['tool', 'blue'], juegos: ['game', 'violet'], marketing: ['send', 'coral'],
  adaptacion: ['apps', 'gold'], revision: ['shield', 'green'],
  copiador: ['search', 'violet'],
};
const networks = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn',
  threads: 'Threads', twitter: 'X', bluesky: 'Bluesky', mastodon: 'Mastodon',
};
const publishStatus = {
  sent: 'Publicada', scheduled: 'En cola', sending: 'Enviándose',
  error: 'Error de publicación', draft: 'Borrador en Buffer', needs_approval: 'Pendiente de aprobación',
};
const $ = selector => document.querySelector(selector);
const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 2 });
const dates = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
const draftKey = 'educame-publication-draft';
const batchDraftKey = 'educame-agent-request-v1';
const directDraftKey = 'educame-terrace-draft-v1';
const directRequestKey = 'educame-terrace-request-v1';
const researchObjective = 'Analiza estos enlaces y propón ideas originales y priorizadas para la app seleccionada.';
export const sourceLines = text => text?.split(/\r?\n/).map(line => line.trim()).filter(Boolean) || [];

export function appLogo(key) {
  const file = apps[key]?.[2];
  if (!file) return null;
  const image = document.createElement('img');
  image.src = '/marcas/' + file;
  image.alt = '';
  image.width = 24;
  image.height = 24;
  return image;
}

export function setupWorkspace({ agents, element, button, api, feedback, formMessage, selectOption, badge, saveBoard, refresh, getState, renderPanel }) {
  const agentForm = $('#agent-compose');
  const directForm = $('#terrace-order');
  const postForm = $('#publish-form');
  const confirmForm = $('#publish-confirm');
  const searchForm = $('#search-stats');
  const socialForm = $('#social-stats');
  const videoForm = $('#video-form');
  const selectedAgents = new Set();
  const previousRequests = new Map();
  for (const key of [batchDraftKey, directRequestKey]) {
    try { previousRequests.set(key, JSON.parse(sessionStorage.getItem(key))); } catch {}
  }
  let connections;
  let codex;
  let channels = [];
  let publicationHistory = [];
  let pendingPost;
  let publicationId = crypto.randomUUID();
  let sending = false;
  let sendingDirect = false;
  let posting = false;
  let loadVersion = 0;
  let selectedChannels = [];
  let videoId = crypto.randomUUID();
  let videoHistory = [];
  let videoBusy = false;
  let videoTimer;
  const teamIds = () => Object.keys(agents).filter(id => id !== 'copiador' && id !== 'codex');
  const selectGroup = () => teamIds().slice(0, getState()?.maxTasks || 6);

  function fillSelect(select, values, placeholder) {
    const previous = select.value;
    select.replaceChildren(...(placeholder ? [selectOption('', placeholder)] : []),
      ...values.map(([value, label]) => selectOption(value, label)));
    if (values.some(([value]) => value === previous)) select.value = previous;
  }

  for (const id of ['agent-app', 'terrace-app', 'publish-app', 'stats-app']) {
    fillSelect($('#' + id), Object.entries(apps).filter(([key, app]) => id !== 'stats-app' || key === 'ecosistema' || app[4])
      .map(([key, [name]]) => [key, name]), id === 'terrace-app' ? 'Elige una app o el ecosistema' : undefined);
  }
  try {
    const draft = JSON.parse(sessionStorage.getItem(directDraftKey));
    if (draft) for (const key of ['app', 'mode', 'objective']) directForm.elements[key].value = draft[key];
  } catch {}

  async function requestOrder(key, signature, tasks, mode, engine, agentRevision) {
    const previous = previousRequests.get(key);
    const request = { signature, tasks: previous?.signature === signature ? previous.tasks : tasks };
    previousRequests.set(key, request);
    try { sessionStorage.setItem(key, JSON.stringify(request)); } catch {}
    return api('/api/encargos', 'POST', { mode, tasks: request.tasks, engine, agentRevision });
  }

  function renderDirect() {
    const state = getState();
    const batch = state?.batch;
    const implementation = directForm.elements.mode.value === 'implementacion';
    $('#terrace-mode-hint').textContent = implementation ?
      'Codex hace el cambio en una copia aislada. Podrás revisar el resultado antes de subirlo.' :
      'Codex consulta el proyecto y responde con un plan o un diagnóstico.';
    $('#terrace-connect').hidden = !codex || codex.ready;
    $('#terrace-order-status').textContent = sendingDirect ? 'Enviando encargo…' :
      !codex ? 'Comprobando la sesión de Codex…' :
        batch?.running ? 'Hay un lote en curso. Puedes seguirlo en Cola de trabajo.' :
          batch?.state === 'paused' ? 'Retoma el lote interrumpido desde Cola de trabajo.' : '';
    directForm.querySelector('[type=submit]').disabled = !state || !codex?.ready || !agents.codex ||
      sending || sendingDirect || batch?.running || batch?.state === 'paused';
  }

  directForm.addEventListener('input', () => {
    try { sessionStorage.setItem(directDraftKey, JSON.stringify(Object.fromEntries(new FormData(directForm)))); } catch {}
    renderDirect();
  });
  $('#terrace-agents').addEventListener('click', () => {
    if (agentForm.elements.objective.value.trim() || agentForm.elements.context.value.trim()) return;
    const { app, objective } = directForm.elements;
    if (app.value) {
      agentForm.elements.app.value = app.value;
      agentForm.elements.app.dispatchEvent(new Event('change'));
    }
    agentForm.elements.objective.value = objective.value;
  });
  directForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (directForm.querySelector('[type=submit]').disabled) return;
    const { app, mode, objective } = Object.fromEntries(new FormData(directForm));
    const encargo = objective.trim();
    if (!encargo) return formMessage(directForm, 'Escribe qué necesitas antes de pedir el encargo.');
    sendingDirect = true;
    formMessage(directForm);
    renderTeam();
    try {
      const signature = JSON.stringify({ app, mode, encargo, profile: agents.codex });
      await requestOrder(directRequestKey, signature, [{ id: 'enc-' + crypto.randomUUID(), agente: 'codex', app, encargo }],
        mode, 'codex', getState().board.revision);
      if (directForm.elements.objective.value === objective && directForm.elements.app.value === app && directForm.elements.mode.value === mode) {
        directForm.elements.objective.value = '';
        directForm.dispatchEvent(new Event('input'));
      }
      previousRequests.delete(directRequestKey);
      try { sessionStorage.removeItem(directRequestKey); } catch {}
      location.hash = 'agentes';
      await refresh();
      $('#team-activity').scrollIntoView({ block: 'nearest' });
    } catch (error) {
      if (location.hash === '#agentes') feedback(error.message, true);
      else formMessage(directForm, error.message);
    } finally {
      sendingDirect = false;
      renderTeam();
    }
  });
  try {
    const saved = JSON.parse(sessionStorage.getItem(draftKey));
    if (saved) {
      publicationId = saved.id;
      selectedChannels = saved.channels;
      for (const field of ['app', 'text', 'mediaType', 'mediaUrl', 'title', 'kids', 'mode']) postForm.elements[field].value = saved.fields[field];
      postForm.elements.ai.checked = saved.fields.ai === 'on';
    }
  } catch {
    // Draft storage is optional in browsers that restrict session storage.
  }
  function productCard(id, name, path, color, showActions) {
    const card = element('article', 'product-card');
    card.dataset.product = apps[id][5];
    const launch = element('a', 'product-name');
    launch.href = 'https://educame.tech' + path;
    launch.target = '_blank';
    launch.rel = 'noreferrer';
    const tile = element('span', 'tile-icon ' + color);
    tile.append(appLogo(id));
    const copy = element('span', 'product-copy');
    const paused = element('small', 'product-paused', 'En pausa');
    paused.hidden = true;
    copy.append(element('strong', '', name), paused);
    const arrow = icon('external');
    arrow.classList.add('product-arrow');
    launch.append(tile, copy, arrow);
    card.append(launch);
    if (!showActions) return card;
    const actions = element('div', 'product-actions');
    const task = button('Crear encargo', () => {
      agentForm.elements.app.value = id;
      location.hash = 'agentes';
      requestAnimationFrame(() => agentForm.elements.objective.focus());
    });
    task.prepend(icon('plus'));
    const local = element('a', 'button secondary', id === 'hazlotu' ? 'Landing local' : 'Vista local');
    local.setAttribute('aria-label', `${local.textContent} de ${name}`);
    local.href = `/vista-local/${id}/${id === 'hazlotu' ? 'landing' : 'app'}`;
    local.target = '_blank';
    local.rel = 'noopener noreferrer';
    local.prepend(icon('monitor'));
    actions.append(task, local);
    card.append(actions);
    return card;
  }
  for (const [id, [name, path, , color]] of Object.entries(apps)) {
    if (!path) continue;
    $('#workspace-apps').append(productCard(id, name, path, color, false));
    $('#directory-apps').append(productCard(id, name, path, color, true));
  }
  api('/api/apps/estado').then(({ paused }) => {
    for (const card of document.querySelectorAll('[data-product]')) card.querySelector('.product-paused').hidden = !paused.includes(card.dataset.product);
  }).catch(() => {});

  function renderTeam() {
    renderDirect();
    const state = getState();
    const engine = agentForm.elements.engine;
    const ids = teamIds();
    const research = selectedAgents.has('copiador');
    const selectTeam = $('#select-team');
    const group = selectGroup();
    const all = group.length > 0 && group.length === selectedAgents.size && group.every(id => selectedAgents.has(id));
    selectTeam.setAttribute('aria-pressed', String(all));
    selectTeam.disabled = !group.length;
    selectTeam.textContent = all ? 'Quitar selección' : ids.length > group.length ? 'Seleccionar ' + group.length : 'Seleccionar equipo';
    for (const node of $('#team-picker').children) {
      node.setAttribute('aria-pressed', String(selectedAgents.has(node.dataset.agent)));
    }
    $('#team-review-hint').hidden = !selectedAgents.has('revision') || selectedAgents.size < 2;
    $('#team-summary').textContent = research ? agents.copiador.name + ' · análisis de fuentes públicas' : selectedAgents.size ?
      `${selectedAgents.size} de ${state.maxTasks} agentes por lote` : 'Selecciona al menos un agente.';
    $('#engine-options').hidden = !state?.apiReady;
    engine.options[1].disabled = !state?.apiReady;
    if (!state?.apiReady) engine.value = 'codex';
    const ready = engine.value === 'codex' ? codex?.ready : state?.apiReady;
    $('#agent-sources').hidden = !research;
    agentForm.elements.sources.disabled = !research;
    agentForm.elements.sources.required = research;
    agentForm.elements.objective.required = !research;
    agentForm.elements.objective.placeholder = research ? 'Opcional. Por ejemplo, fíjate en la navegación, los juegos o los ganchos para redes.' :
      'Ejemplo: diseña un juego de fracciones que se pueda jugar en el móvil.';
    agentForm.querySelector('[value="implementacion"]').hidden = research;
    $('#agent-draft').hidden = research;
    $('#agent-research').hidden = !research;
    $('#game-pack').hidden = !selectedAgents.has('juegos');
    $('#game-pack').disabled = !selectedAgents.has('juegos');
    $('#team-setup').hidden = !state || Boolean(ready);
    for (const node of agentForm.querySelectorAll('[type="submit"]')) {
      node.disabled = node.hidden || !state || !selectedAgents.size || sending || sendingDirect || Boolean(state.batch?.running) || state?.batch?.state === 'paused' ||
        (node.value === 'real' && !ready) ||
        (node.value === 'implementacion' && !codex?.ready) ||
        (node.value === 'queue' && state.board.tasks.length + selectedAgents.size > state.maxTasks);
    }
    const activity = $('#team-activity');
    activity.hidden = !state?.batch?.tasks?.length;
    if (!activity.hidden) {
      const { batch } = state;
      const title = element('div', 'card-heading');
      const link = element('a', 'text-link', 'Abrir entregas →');
      link.href = '#entregas';
      title.append(element('h2', '', batch.mode === 'implementacion' ? 'Implementación en Codex' : batch.mode === 'prueba' ?
        'Última simulación' : batch.tasks.every(task => task.agente === 'copiador') ? 'Análisis de enlaces' :
        batch.engine === 'codex' ? 'Encargo en Codex' : 'Encargo en OpenAI API'), link);
      if (batch.state === 'paused') {
        const resume = element('a', 'button secondary', 'Retomar en Cola de trabajo');
        resume.href = '#operaciones';
        title.append(resume);
      }
      const items = element('div', 'batch-chips');
      for (const task of batch.tasks) {
        const item = element('div', 'batch-chip');
        const job = batch.jobs[task.id];
        item.append(element('strong', '', task.agentName || agents[task.agente]?.name || task.agente), badge(job?.status));
        if (job?.error) item.append(element('small', 'form-message', job.error));
        items.append(item);
      }
      activity.replaceChildren(title, items);
      if (batch.error) activity.append(element('p', 'form-message', batch.error));
    }
  }
  agentForm.elements.engine.addEventListener('change', renderTeam);

  $('#select-team').addEventListener('click', () => {
    const team = selectGroup();
    const all = team.length === selectedAgents.size && team.every(id => selectedAgents.has(id));
    selectedAgents.clear();
    if (!all) for (const id of team) selectedAgents.add(id);
    renderTeam();
  });
  function agentCard(id, { name, description, builtIn }) {
    const [glyph, color] = agentArt[id] || ['sparkles', 'blue'];
    const choice = element('button', 'team-tile');
    choice.type = 'button';
    choice.dataset.agent = id;
    choice.setAttribute('aria-pressed', 'false');
    const header = element('span', 'team-tile-top');
    const check = element('span', 'team-check', '✓');
    check.setAttribute('aria-hidden', 'true');
    const symbol = element('span', 'tile-icon ' + color);
    symbol.append(icon(glyph));
    header.append(symbol, check);
    choice.append(header, element('strong', '', name), element('small', '', description));
    if (!builtIn) choice.append(element('span', 'badge', 'Personalizado'));
    choice.addEventListener('click', () => {
      if (selectedAgents.has(id)) selectedAgents.delete(id);
      else {
        if (id === 'copiador') selectedAgents.clear();
        else selectedAgents.delete('copiador');
        if (selectedAgents.size >= getState().maxTasks) {
          formMessage(agentForm, 'Puedes seleccionar hasta ' + getState().maxTasks + ' agentes por lote.');
          return;
        }
        selectedAgents.add(id);
      }
      formMessage(agentForm);
      renderTeam();
    });
    return choice;
  }

  agentForm.addEventListener('submit', async event => {
    event.preventDefault();
    const state = getState();
    if (!state || sending || sendingDirect || !selectedAgents.size) return;
    const { app, objective, context, gameWork, gameCount, sources } = Object.fromEntries(new FormData(agentForm));
    const research = selectedAgents.has('copiador');
    const links = sourceLines(sources);
    if (research && (links.length === 0 || links.length > 6)) {
      formMessage(agentForm, 'Añade entre uno y seis enlaces públicos.');
      return;
    }
    if (!research && !objective.trim()) {
      formMessage(agentForm, 'Describe el encargo antes de enviarlo.');
      return;
    }
    const agentsInOrder = Object.keys(agents).filter(id => selectedAgents.has(id));
    const ids = Object.fromEntries(agentsInOrder.map(id => [id, `enc-${crypto.randomUUID()}`]));
    const reviewTarget = ids.juegos || ids[agentsInOrder.find(id => id !== 'revision')];
    const tasks = agentsInOrder.map(agente => ({
      id: ids[agente], agente, app, encargo: objective.trim() || researchObjective,
      ...(research ? { fuentes: links } : {}),
      contexto: [agentsInOrder.length > 1 ? agents[agente].team : '', agente === 'juegos' ?
        `Pack de juegos. Trabajo: ${gameWork}. Cantidad solicitada: ${Number(gameCount) || 1}. Informa por separado del resultado y las comprobaciones de cada juego.` : '',
      context.trim()].filter(Boolean).join('\n\n'),
      revisar: agente === 'revision' ? reviewTarget || '' : '',
    }));
    sending = true;
    formMessage(agentForm);
    renderTeam();
    try {
      const mode = event.submitter?.value || 'prueba';
      if (mode === 'queue') {
        await saveBoard({ tasks: [...state.board.tasks, ...tasks] });
        location.hash = 'operaciones';
        feedback('Encargos añadidos a la cola.');
      } else {
        const engine = mode === 'implementacion' ? 'codex' : mode === 'prueba' ? 'openai' : agentForm.elements.engine.value;
        const customized = agentsInOrder.map(id => agents[id]).filter(profile => !profile.builtIn || profile.modified);
        const signature = JSON.stringify({ mode, engine, app, objective, context, gameWork, gameCount, agentsInOrder,
          ...(research ? { links } : {}), ...(customized.length ? { customized } : {}) });
        await requestOrder(batchDraftKey, signature, tasks, mode, engine, state.board.revision);
        await refresh();
        renderTeam();
        $('#team-activity').scrollIntoView({ block: 'nearest' });
      }
    } catch (error) {
      formMessage(agentForm, error.message);
    } finally {
      sending = false;
      renderTeam();
    }
  });

  function connectionBadge(id, text, ready) {
    const node = $('#' + id + '-status');
    node.textContent = text;
    node.classList.toggle('ready', ready);
  }

  function connectionTab(selected) {
    for (const node of document.querySelectorAll('[data-connection]')) {
      node.setAttribute('aria-pressed', String(node.dataset.connection === selected));
    }
    for (const node of document.querySelectorAll('[data-connection-panel]')) node.hidden = node.dataset.connectionPanel !== selected;
  }

  for (const node of document.querySelectorAll('[data-connection], [data-open-connection]')) {
    node.addEventListener('click', () => connectionTab(node.dataset.connection || node.dataset.openConnection));
  }
  $('#copy-google-redirect').addEventListener('click', async () => {
    const field = $('#google-redirect');
    if (!field.value) return;
    try {
      await navigator.clipboard.writeText(field.value);
      feedback('URL de retorno copiada.');
    } catch {
      field.focus();
      field.select();
      feedback('URL de retorno seleccionada. Cópiala con Ctrl + C.');
    }
  });

  async function checkCodex(fresh = false) {
    codex = await api('/api/codex' + (fresh ? '?actualizar=1' : ''));
    connectionBadge('codex', codex.ready ? 'Listo' : 'Por conectar', codex.ready);
    $('#codex-detail').textContent = codex.message;
    renderTeam();
    renderPanel();
  }

  $('#check-codex').addEventListener('click', async event => {
    const node = event.currentTarget;
    node.disabled = true;
    try {
      await checkCodex(true);
    } catch (error) {
      feedback(error.message, true);
    } finally {
      node.disabled = false;
    }
  });

  function renderConnections() {
    if (!connections) return;
    connectionBadge('buffer', connections.buffer ? 'Clave guardada' : 'Por conectar', connections.buffer);
    connectionBadge('google', connections.google ? 'Autorizado' : 'Por conectar', connections.google);
    connectionBadge('openai', getState()?.apiReady ? 'Configurado' : 'Por configurar', getState()?.apiReady);
    connectionBadge('runway', connections.runway ? 'Conectado' : 'Por conectar', connections.runway);
    $('#google-redirect').value = connections.redirect;
    for (const node of document.querySelectorAll('[data-disconnect]')) node.hidden = !connections[node.dataset.disconnect];
    $('#buffer-form').hidden = connections.buffer;
    $('#google-form').hidden = connections.google;
    $('#openai-form').hidden = Boolean(getState()?.apiReady);
    $('#runway-form').hidden = connections.runway;
    $('#runway-actions').hidden = !connections.runway;
    $('[data-reload-connections]').hidden = !connections.buffer;
    $('#publish-from-connections').hidden = !channels.some(channel => channel.canPublish);
    const connected = $('#connected-channels');
    const profiles = channels.map(channel => {
      const item = element('div', 'channel-option connected-channel');
      item.append(channelIdentity(channel, channel.canPublish ? 'Disponible' : 'Sin permiso de publicación'));
      return item;
    });
    connected.replaceChildren(...(profiles.length ? profiles : [element('p', 'empty channel-empty', connections.buffer
      ? 'Todavía no hay perfiles vinculados en Buffer.'
      : 'Conecta Buffer para ver aquí tus perfiles de redes.')]));
    renderChannelPicker();
    renderStatsFilters();
    renderVideos();
    scheduleVideo();
  }

  async function loadConnections() {
    const version = ++loadVersion;
    const data = await api('/api/conexiones');
    if (version !== loadVersion) return;
    connections = data;
    const [channelList, properties] = await Promise.allSettled([
      data.buffer ? api('/api/conexiones/canales') : [],
      data.google ? api('/api/conexiones/propiedades') : [],
    ]);
    if (version !== loadVersion) return;
    channels = channelList.status === 'fulfilled' ? channelList.value : [];
    fillSelect(searchForm.elements.property, (properties.status === 'fulfilled' ? properties.value : []).map(value => [value, value]), 'Elige una propiedad');
    if (searchForm.elements.property.options.length === 2 && !searchForm.elements.property.value) searchForm.elements.property.selectedIndex = 1;
    renderConnections();
    if (channelList.status === 'rejected') $('#connected-channels').replaceChildren(element('p', 'form-message channel-empty', channelList.reason.message));
    if (properties.status === 'rejected') $('#search-setup').textContent = properties.reason.message;
  }

  for (const id of ['buffer', 'google', 'openai', 'runway']) {
    const form = $('#' + id + '-form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const submitter = form.querySelector('[type="submit"]');
      submitter.disabled = true;
      formMessage(form);
      try {
        const result = await api('/api/conexiones/' + id, 'POST', Object.fromEntries(new FormData(form)));
        form.reset();
        if (id === 'google') {
          location.assign(result.url);
          return;
        }
        await refresh();
        await loadConnections();
        feedback(id === 'buffer' ? 'Buffer conectado. Ya puedes seleccionar tus perfiles.' :
          id === 'runway' ? 'Runway conectado. Ya puedes crear clips.' : 'OpenAI API configurada.');
      } catch (error) {
        formMessage(form, error.message);
      } finally {
        submitter.disabled = false;
      }
    });
  }
  document.querySelectorAll('[data-disconnect]').forEach(node => node.addEventListener('click', async () => {
    node.disabled = true;
    try {
      await api('/api/conexiones/desconectar', 'POST', { provider: node.dataset.disconnect });
      await refresh();
      await loadConnections();
      feedback('Conexión quitada de este equipo.');
    } catch (error) {
      feedback(error.message, true);
    } finally {
      node.disabled = false;
    }
  }));
  $('[data-reload-connections]').addEventListener('click', () => loadConnections().catch(error => feedback(error.message, true)));

  const videoStatus = {
    UNKNOWN: 'Envío sin confirmar', PENDING: 'En cola', THROTTLED: 'En espera', RUNNING: 'Generando',
    SUCCEEDED: 'Listo', FAILED: 'Fallido', CANCELED: 'Cancelado',
  };
  const videoPending = video => ['PENDING', 'THROTTLED', 'RUNNING'].includes(video.status);

  function renderVideos() {
    videoForm.querySelector('[type="submit"]').disabled = !connections?.runway || videoBusy;
    const setup = $('#video-setup');
    setup.replaceChildren();
    if (connections && !connections.runway) {
      const link = element('a', 'text-link', 'Conectar Runway →');
      link.href = '#conexiones';
      link.addEventListener('click', () => connectionTab('video'));
      setup.append(link);
    }
    const rows = videoHistory.map(video => {
      const row = element('article', 'publication-entry');
      row.append(element('h3', '', video.prompt.slice(0, 100)),
        element('p', 'inline-hint', dates.format(new Date(video.date))),
        element('span', 'badge ' + (video.status === 'SUCCEEDED' ? 'ready' : 'pending'), videoStatus[video.status]));
      if (video.status === 'UNKNOWN') row.append(element('p', 'inline-hint', 'Comprueba si el clip aparece en Runway antes de volver a generarlo.'));
      if (video.status === 'SUCCEEDED' && connections?.runway) {
        const download = element('a', 'button secondary', 'Descargar MP4');
        download.href = '/api/videos/descargar?id=' + encodeURIComponent(video.id);
        download.download = '';
        row.append(download);
      }
      return row;
    });
    $('#video-list').replaceChildren(...(rows.length ? rows : [element('p', 'empty', 'Los clips que generes aparecerán aquí.')]));
  }

  function scheduleVideo() {
    clearTimeout(videoTimer);
    const pending = videoHistory.find(videoPending);
    if (!pending || location.hash !== '#video' || !connections?.runway) return;
    videoTimer = setTimeout(async () => {
      try {
        const result = await api('/api/videos/actualizar', 'POST', { id: pending.id });
        videoHistory = videoHistory.map(item => item.id === result.id ? result : item);
        renderVideos();
        scheduleVideo();
      } catch (error) {
        if (videoBusy) scheduleVideo();
        else {
          formMessage(videoForm, error.message);
          const retry = button('Volver a consultar estado', () => {
            formMessage(videoForm);
            renderVideos();
            scheduleVideo();
          });
          $('#video-setup').append(retry);
        }
      }
    }, 5_000);
  }

  async function loadVideos() {
    videoHistory = await api('/api/videos');
    renderVideos();
    scheduleVideo();
  }

  videoForm.addEventListener('input', () => {
    videoId = crypto.randomUUID();
    formMessage(videoForm);
  });
  videoForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (videoBusy || !connections?.runway) return;
    videoBusy = true;
    clearTimeout(videoTimer);
    renderVideos();
    formMessage(videoForm);
    try {
      const result = await api('/api/videos', 'POST', { id: videoId, ...Object.fromEntries(new FormData(videoForm)) });
      if (result.status === 'UNKNOWN') throw new Error('Comprueba esta solicitud en Runway antes de repetirla.');
      videoForm.reset();
      videoId = crypto.randomUUID();
      await loadVideos();
    } catch (error) {
      formMessage(videoForm, error.message);
      await loadVideos().catch(() => {});
    } finally {
      videoBusy = false;
      renderVideos();
    }
  });
  window.addEventListener('hashchange', () => {
    if (location.hash === '#video') loadVideos().catch(error => formMessage(videoForm, error.message));
    else clearTimeout(videoTimer);
  });

  function channelIdentity(channel, detail) {
    const identity = element('span', 'channel-identity');
    const copy = element('span', 'channel-name');
    const platform = networks[channel.service] || channel.service;
    copy.append(element('strong', '', channel.name), element('small', '', detail ? `${platform} · ${detail}` : platform));
    identity.append(networkIcon(channel.service), copy);
    return identity;
  }

  function renderChannelPicker() {
    const picker = $('#publication-channels');
    const checked = new Set(selectedChannels);
    const options = channels.filter(channel => channel.canPublish).map(channel => {
      const label = element('label', 'channel-option check-label');
      const input = element('input');
      input.type = 'checkbox';
      input.name = 'channel';
      input.value = channel.id;
      input.checked = checked.has(channel.id);
      label.append(input, channelIdentity(channel));
      return label;
    });
    picker.replaceChildren(...(options.length ? options : [element('p', 'empty', connections?.buffer
      ? 'No hay perfiles habilitados. Vincúlalos o revisa sus permisos en Buffer y pulsa Actualizar perfiles.'
      : 'Conecta Buffer desde Conexiones para elegir dónde publicar.')]));
    renderPreview();
  }

  function renderPreview() {
    const data = new FormData(postForm);
    const mediaType = data.get('mediaType');
    const selected = new Set(data.getAll('channel'));
    const services = channels.filter(item => selected.has(item.id)).map(item => item.service);
    const youtube = services.includes('youtube');
    const tiktokPhoto = mediaType === 'image' && services.includes('tiktok');
    const ai = (mediaType === 'video' && ['youtube', 'tiktok', 'instagram'].some(id => services.includes(id))) ||
      (mediaType === 'image' && services.includes('instagram'));
    $('#media-field').hidden = mediaType === 'none';
    postForm.elements.mediaUrl.required = mediaType !== 'none';
    $('#network-options').hidden = !youtube && !tiktokPhoto && !ai;
    $('#publication-title-field').hidden = !youtube && !tiktokPhoto;
    postForm.elements.title.required = youtube || tiktokPhoto;
    $('#publication-kids-field').hidden = !youtube;
    postForm.elements.kids.required = youtube;
    $('#publication-ai-field').hidden = !ai;
    $('#preview-app').textContent = (apps[data.get('app')] || apps.ecosistema)[0];
    const destinations = $('#preview-destinations');
    destinations.hidden = !services.length;
    destinations.replaceChildren(...[...new Set(services)].map(service => {
      const chip = element('span', '', networks[service] || service);
      chip.prepend(networkIcon(service));
      return chip;
    }));
    $('#preview-copy').textContent = data.get('text').trim() || 'Tu texto aparecerá aquí.';
    $('#preview-media').hidden = mediaType === 'none';
    $('#preview-media').textContent = `${mediaType === 'video' ? 'Vídeo' : 'Imagen'} · ${data.get('mediaUrl').trim() || 'Pendiente de adjuntar'}`;
    postForm.querySelector('[type="submit"]').disabled = !services.length || posting;
  }
  postForm.addEventListener('input', event => {
    publicationId = crypto.randomUUID();
    const values = new FormData(postForm);
    if (event.target.name === 'channel') selectedChannels = values.getAll('channel');
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ id: publicationId, channels: selectedChannels, fields: Object.fromEntries(values) }));
    } catch {
      // The editor still works without session storage.
    }
    formMessage(postForm);
    renderPreview();
  });
  postForm.addEventListener('submit', event => {
    event.preventDefault();
    const values = new FormData(postForm);
    const chosen = channels.filter(channel => values.getAll('channel').includes(channel.id));
    const data = Object.fromEntries(values);
    const { mediaType, text, mode } = data;
    const problem = !chosen.length ? 'Elige al menos un perfil.'
      : !text.trim() && mediaType === 'none' ? 'Escribe el texto o añade un archivo.'
      : chosen.some(item => item.service === 'youtube') && mediaType !== 'video' ? 'YouTube necesita un vídeo.'
      : chosen.some(item => ['instagram', 'tiktok'].includes(item.service)) && mediaType === 'none' ? 'Instagram y TikTok necesitan una imagen o un vídeo.'
      : mode === 'addToQueue' && chosen.some(item => item.isQueuePaused) ? 'Alguno de los perfiles seleccionados tiene la cola pausada en Buffer.' : '';
    if (problem) return formMessage(postForm, problem);
    pendingPost = { id: publicationId, ...data, app: (apps[data.app] || apps.ecosistema)[0], channels: chosen.map(item => item.id), ai: values.has('ai') };
    $('#publish-confirm-copy').textContent = `${mode === 'shareNow' ? 'Solicitar publicación ahora' : 'Añadir a la cola de Buffer'} en ${chosen.map(item => `${item.name} (${networks[item.service] || item.service})`).join(', ')}.`;
    formMessage(confirmForm);
    $('#publish-dialog').showModal();
  });

  function renderPublications() {
    $('#publication-history').replaceChildren(...(publicationHistory.length ? publicationHistory.map(post => {
      const item = element('article', 'publication-entry');
      item.append(element('h3', '', post.text.slice(0, 120) || 'Publicación multimedia'),
        element('p', 'item-meta', `${dates.format(new Date(post.date))} · ${post.app || 'Educame'}`));
      for (const result of post.results) {
        const row = element('p', 'publication-result');
        const label = publishStatus[result.providerStatus] || (result.status === 'recibida' ? 'Recibida por Buffer' : result.status === 'rechazada' ? 'Rechazada' : 'Estado sin confirmar');
        row.append(channelIdentity(result),
          element('span', `badge ${result.providerStatus === 'error' || result.status === 'rechazada' ? 'error' : result.status === 'recibida' ? 'ready' : 'pending'}`, label));
        if (result.message) row.append(element('small', 'inline-hint', result.message));
        if (result.status === 'sin confirmar') row.append(element('small', 'inline-hint', 'Comprueba el envío en Buffer antes de repetirlo.'));
        item.append(row);
      }
      if (post.results.some(result => result.id && !['sent', 'error'].includes(result.providerStatus))) {
        const update = button('Actualizar estado', async () => {
          update.disabled = true;
          try {
            const latest = await api('/api/publicaciones/actualizar', 'POST', { id: post.id });
            publicationHistory = publicationHistory.map(item => item.id === latest.id ? latest : item);
            renderPublications();
          } catch (error) {
            feedback(error.message, true);
          } finally {
            update.disabled = false;
          }
        });
        item.append(update);
      }
      return item;
    }) : [element('p', 'empty', 'Aquí aparecerán los resultados por perfil cuando hagas tu primer envío.')]));
  }

  async function loadPublications() {
    publicationHistory = await api('/api/publicaciones');
    renderPublications();
    renderLocal();
  }
  confirmForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!pendingPost || posting) return;
    posting = true;
    const dialog = $('#publish-dialog');
    const controls = [...confirmForm.querySelectorAll('button')];
    controls.forEach(node => { node.disabled = true; });
    formMessage(confirmForm);
    renderPreview();
    try {
      const result = await api('/api/publicaciones', 'POST', pendingPost);
      await loadPublications();
      dialog.close();
      const accepted = result.results.filter(row => row.status === 'recibida').length;
      if (accepted === result.results.length) {
        postForm.reset();
        selectedChannels = [];
        publicationId = crypto.randomUUID();
        try { sessionStorage.removeItem(draftKey); } catch {}
      }
      feedback(`Buffer aceptó ${accepted} de ${result.results.length} destinos. Consulta el estado de cada perfil en el historial.`, accepted < result.results.length);
    } catch (error) {
      formMessage(confirmForm, error.message);
    } finally {
      posting = false;
      controls.forEach(node => { node.disabled = false; });
      renderPreview();
    }
  });
  $('#publish-dialog').addEventListener('cancel', event => { if (posting) event.preventDefault(); });

  function renderStatsFilters() {
    fillSelect(socialForm.elements.channel, channels.filter(channel => channel.insights)
      .map(channel => [channel.id, `${channel.name} · ${networks[channel.service] || channel.service}`]), 'Elige un perfil');
    for (const [form, field] of [[searchForm, 'property'], [socialForm, 'channel']]) {
      const hint = form === searchForm ? $('#search-setup') : $('#social-setup');
      const provider = form === searchForm ? 'google' : 'buffer';
      form.querySelector('[type="submit"]').disabled = form.elements[field].options.length < 2 || form.dataset.loading === 'true';
      hint.replaceChildren();
      if (!connections?.[provider]) {
        const link = element('a', 'text-link', 'Configurar en Conexiones →');
        link.href = '#conexiones';
        link.addEventListener('click', () => connectionTab(provider === 'google' ? 'stats' : 'redes'));
        hint.append(link);
      } else if (form.elements[field].options.length < 2) {
        hint.textContent = form === searchForm ? 'La cuenta no tiene propiedades verificadas.' : 'Buffer no ha devuelto perfiles con acceso a estadísticas.';
      }
    }
  }

  function metric(name, value) {
    const node = element('div', 'stat-tile');
    node.append(element('span', '', name), element('strong', '', value));
    return node;
  }

  function metricGrid(metrics) {
    const grid = element('div', 'stat-metrics');
    grid.append(...metrics);
    return grid;
  }

  function searchTable(title, rows, firstLabel) {
    const block = element('section', 'search-table');
    block.append(element('h3', '', title));
    if (!rows.length) {
      block.append(element('p', 'inline-hint', 'No hay datos para esta selección.'));
      return block;
    }
    const table = element('table');
    const head = table.createTHead().insertRow();
    for (const label of [firstLabel, 'Clics', 'Impresiones']) {
      const cell = element('th', '', label);
      cell.scope = 'col';
      head.append(cell);
    }
    const body = table.createTBody();
    for (const row of rows) {
      const tr = body.insertRow();
      tr.insertCell().textContent = row.keys[0];
      tr.insertCell().textContent = number.format(row.clicks);
      tr.insertCell().textContent = number.format(row.impressions);
    }
    block.append(table);
    return block;
  }

  function chart(trend) {
    const block = element('section', 'trend-chart');
    block.append(element('h3', '', 'Clics por día'));
    const chartBody = element('div', 'chart-bars');
    chartBody.setAttribute('aria-hidden', 'true');
    const max = Math.max(1, ...trend.map(row => row.clicks));
    for (const row of trend) {
      const meter = element('progress');
      meter.max = max;
      meter.value = row.clicks;
      meter.title = `${row.keys[0]} · ${number.format(row.clicks)} clics`;
      chartBody.append(meter);
    }
    const detail = element('details');
    detail.append(element('summary', '', 'Ver los datos por día'), searchTable('Serie diaria', trend, 'Fecha'));
    block.append(chartBody, detail);
    return block;
  }

  function renderSearch(result) {
    const { total, trend, searches, pages, startDate, endDate } = result;
    const panel = $('#search-results');
    panel.replaceChildren(element('p', 'inline-hint', `${startDate} a ${endDate} · Datos definitivos de búsqueda web`));
    if (!total) {
      panel.append(element('p', 'empty', 'Google no devolvió datos para este periodo y esta selección.'));
      return;
    }
    const tables = element('div', 'search-tables');
    tables.append(searchTable('Consultas principales', searches, 'Consulta'), searchTable('Páginas principales', pages, 'Página'));
    panel.append(metricGrid([
      metric('Clics', number.format(total.clicks)), metric('Impresiones', number.format(total.impressions)),
      metric('CTR', percent.format(total.ctr)), metric('Posición media', number.format(total.position)),
    ]), chart(trend), tables);
  }

  function renderSocial(result) {
    const panel = $('#social-results');
    panel.replaceChildren(element('p', 'inline-hint', `${result.startDate} a ${result.endDate} · ${result.metricsUpdatedAt
      ? 'Actualizado el ' + dates.format(new Date(result.metricsUpdatedAt))
      : 'Sin publicaciones con métricas en este periodo'}`));
    panel.append(metricGrid(result.metrics.map(item => metric(item.name, `${number.format(item.value)}${item.unit === 'percentage' ? ' %' : ''}`))));
  }

  async function runStats(form, endpoint, panel, render, payload) {
    if (form.dataset.loading === 'true') return;
    const submitter = form.querySelector('[type="submit"]');
    form.dataset.loading = 'true';
    const controls = [...form.querySelectorAll('select')];
    controls.forEach(node => { node.disabled = true; });
    submitter.disabled = true;
    panel.replaceChildren(element('p', 'inline-hint', 'Consultando datos…'));
    try {
      render(await api(endpoint, 'POST', payload));
    } catch (error) {
      panel.replaceChildren(element('p', 'form-message', error.message));
    } finally {
      form.dataset.loading = 'false';
      controls.forEach(node => { node.disabled = false; });
      submitter.disabled = false;
    }
  }
  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    const { app, ...data } = Object.fromEntries(new FormData(searchForm));
    const route = apps[app][4];
    runStats(searchForm, '/api/estadisticas/busqueda', $('#search-results'), renderSearch,
      { ...data, pagePattern: route ? '^https?://(?:www\\.)?educame\\.tech/(?:' + route + ')(?:[/?#]|$)' : '' });
  });
  socialForm.addEventListener('submit', event => {
    event.preventDefault();
    runStats(socialForm, '/api/estadisticas/redes', $('#social-results'), renderSocial, Object.fromEntries(new FormData(socialForm)));
  });
  document.querySelectorAll('[data-stat]').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-stat]').forEach(node => node.setAttribute('aria-pressed', String(node === tab)));
    document.querySelectorAll('[data-stat-panel]').forEach(node => { node.hidden = node.dataset.statPanel !== tab.dataset.stat; });
  }));

  function renderLocal() {
    const state = getState();
    if (!state) return;
    const real = state.history.filter(item => item.mode === 'real');
    $('#local-metrics').replaceChildren(
      metric('Entregas de agentes', number.format(real.filter(item => item.status === 'borrador').length)),
      metric('Simulaciones', number.format(state.history.filter(item => item.mode === 'prueba').length)),
      metric('Tokens registrados', number.format(real.reduce((sum, item) => sum + (item.usage?.total_tokens || 0), 0))),
      metric('Envíos a Buffer', number.format(publicationHistory.length)),
    );
  }

  const callback = new URLSearchParams(location.search).get('google');
  if (callback) {
    connectionTab('stats');
    history.replaceState(null, '', location.pathname + location.hash);
    feedback(callback === 'conectado' ? 'Search Console autorizado. Ya puedes consultar tus propiedades.' :
      'Google no completó la conexión. Revisa la URL de retorno, la API y los permisos e inténtalo de nuevo.', callback !== 'conectado');
  }
  renderTeam();
  renderPreview();
  Promise.all([loadConnections(), loadPublications(), checkCodex(), loadVideos()]).catch(error => feedback(error.message, true));

  return {
    codexStatus: () => codex,
    refreshAgents() {
      $('#team-picker').replaceChildren(...Object.entries(agents).map(([id, profile]) => agentCard(id, profile)));
    },
    selectAgent(id) {
      selectedAgents.clear();
      selectedAgents.add(id);
      formMessage(agentForm);
      renderTeam();
      agentForm.elements.objective.focus();
    },
    prepareFollowUp(delivery) {
      if ((agentForm.elements.objective.value.trim() || agentForm.elements.context.value.trim()) &&
          !window.confirm('¿Sustituir el borrador de encargo que estás preparando?')) return false;
      selectedAgents.clear();
      selectedAgents.add(Object.hasOwn(agents, delivery.agente) ? delivery.agente : 'codex');
      agentForm.elements.app.value = Object.hasOwn(apps, delivery.app) ? delivery.app : 'ecosistema';
      agentForm.elements.app.dispatchEvent(new Event('change'));
      agentForm.elements.objective.value = '';
      agentForm.elements.sources.value = (delivery.fuentes || []).join('\n');
      agentForm.elements.context.value = [
        'Encargo anterior\n' + delivery.encargo,
        delivery.implementation?.verified && 'Revisión anterior de referencia\n' + delivery.implementation.commit,
        'Resultado anterior\n' + (delivery.draft?.entrega || delivery.error || 'Sin entrega registrada.'),
      ].filter(Boolean).join('\n\n').slice(0, 7500);
      agentForm.elements.context.closest('details').open = true;
      formMessage(agentForm);
      location.hash = 'agentes';
      renderTeam();
      requestAnimationFrame(() => agentForm.elements.objective.focus());
      return true;
    },
    prepareIdea(app, idea) {
      selectedAgents.clear();
      selectedAgents.add(idea.agente);
      agentForm.elements.app.value = Object.hasOwn(apps, app) ? app : 'ecosistema';
      agentForm.elements.app.dispatchEvent(new Event('change'));
      agentForm.elements.objective.value = `Adapta esta idea a Educame. ${idea.titulo}\n${idea.propuesta}`.slice(0, 2000);
      const links = idea.fuentes.slice(0, 3).join('\n');
      agentForm.elements.context.value = [idea.beneficio, `Comprobación: ${idea.prueba}`, links && `Enlaces de referencia\n${links}`].filter(Boolean).join('\n\n').slice(0, 7500);
      agentForm.elements.context.closest('details').open = true;
      if (idea.agente === 'juegos') {
        agentForm.elements.gameWork.value = 'Crear y mejorar';
        agentForm.elements.gameCount.value = '1';
      }
      formMessage(agentForm);
      location.hash = 'agentes';
      renderTeam();
      requestAnimationFrame(() => agentForm.elements.objective.focus());
    },
    render() {
      renderTeam();
      renderLocal();
      if (connections) {
        const configured = Boolean(getState()?.apiReady);
        connectionBadge('openai', configured ? 'Configurado' : 'Por configurar', configured);
        $('#openai-form').hidden = configured;
      }
    },
    preparePost(text) {
      if (posting) return;
      if (postForm.elements.text.value.trim() && !window.confirm('¿Sustituir el texto que estás preparando?')) return;
      postForm.elements.text.value = text.slice(0, 5000);
      postForm.elements.text.dispatchEvent(new Event('input', { bubbles: true }));
      location.hash = 'publicar';
    },
  };
}
