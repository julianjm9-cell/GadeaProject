import { setupAdminPanel } from './admin-panel.js';

const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' });
const short = sha => sha?.slice(0, 7) || '—';
const stamp = value => date.format(new Date(value));

export function setupOperations({ api, element, button, feedback }) {
  const base = '/api/operacion/';
  const get = path => api(base + path);
  const post = (path, data = {}) => api(base + path, 'POST', data);
  let tab = 'github';
  let pullNumber;
  let pullQuery = 0;
  let hostinger;
  let statusQuery;
  let quotaQuery;
  let confirmation;
  const dialog = $('operation-confirm');
  const confirmForm = dialog.querySelector('form');
  const confirmInput = confirmForm.elements.confirmation;
  const confirmError = confirmForm.querySelector('.form-message');
  const confirmSubmit = confirmForm.querySelector('[type=submit]');
  const cancel = confirmForm.querySelector('[type=button]');
  const visible = () => !$('operations-title').closest('[data-page]').hidden && !document.hidden;
  const fail = error => feedback(error.message, true);
  function message(node, copy) { node.textContent = copy; }
  function link(label, url) {
    const node = element('a', 'text-link', label);
    node.href = url;
    node.target = '_blank';
    node.rel = 'noreferrer';
    return node;
  }
  function busy(control, action) {
    if (control.disabled) return;
    control.disabled = true;
    return Promise.resolve().then(action).catch(fail).finally(() => { control.disabled = false; });
  }
  function onForm(form, action) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      const password = form.querySelector('input[type=password]');
      if (password) password.value = '';
      busy(form.querySelector('button'), () => action(values));
    });
  }
  function confirm({ title, copy, code, label = 'Confirmar', action }) {
    confirmation = action;
    message($('operation-confirm-title'), title);
    message($('operation-confirm-copy'), copy);
    message($('operation-confirm-label').querySelector('span'), code ? 'Escribe ' + code + ' para confirmar' : '');
    $('operation-confirm-label').hidden = !code;
    confirmInput.required = Boolean(code);
    confirmInput.value = '';
    confirmError.hidden = true;
    confirmSubmit.textContent = label;
    dialog.showModal();
    (code ? confirmInput : cancel).focus();
  }
  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { if (confirmSubmit.disabled) event.preventDefault(); });
  confirmForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (confirmSubmit.disabled) return;
    confirmSubmit.disabled = cancel.disabled = true;
    confirmError.hidden = true;
    try {
      await confirmation(confirmInput.value.trim());
      dialog.close();
    } catch (error) {
      message(confirmError, error.message);
      confirmError.hidden = false;
    } finally { confirmSubmit.disabled = cancel.disabled = false; }
  });

  async function loadGitHub() {
    const result = await get('github');
    $('github-connect').hidden = $('github-help').hidden = result.connected;
    $('github-review').hidden = $('github-disconnect').hidden = !result.connected;
    $('github-create').hidden = !result.connected || !result.branches.length;
    message($('github-status'), result.repository ? (result.connected ? 'Conectado · ' : 'Repositorio · ') + result.repository : 'El checkout local necesita un remoto de GitHub.');
    if (!result.connected) {
      $('github-pulls').replaceChildren();
      $('github-detail').replaceChildren();
      pullNumber = null;
      ++pullQuery;
      return;
    }
    const branch = $('github-create').elements.branch;
    branch.replaceChildren(...result.branches.map(item => new Option(item.branch + ' · ' + short(item.commit), item.branch)));
    const items = await get('github/lista');
    $('github-pulls').replaceChildren(...items.map(item => button('#' + item.number + ' · ' + item.title, event => {
      busy(event.currentTarget, () => loadPull(item.number));
    })));
    if (!items.length) $('github-pulls').append(element('p', 'muted', 'No hay solicitudes abiertas hacia main.'));
    if (pullNumber) await loadPull(pullNumber);
    else message($('github-detail'), 'Abre una solicitud para revisar sus archivos y comprobaciones.');
  }

  async function loadPull(id) {
    pullNumber = id;
    const query = ++pullQuery;
    const panel = $('github-detail');
    panel.replaceChildren(element('p', 'muted', 'Consultando la revisión…'));
    const item = await get('github/detalle?numero=' + id);
    if (query !== pullQuery) return;
    panel.replaceChildren(element('h3', '', '#' + item.number + ' · ' + item.title),
      element('p', 'muted', item.branch + ' → ' + item.base + ' · ' + short(item.head)),
      link('Abrir en GitHub ↗', item.url));
    if (item.body) panel.append(element('p', 'operation-prose', item.body));
    panel.append(element('h4', '', 'Comprobaciones de la revisión'));
    for (const check of item.checks.rows) panel.append(element('p', 'muted',
      check.name + ' · ' + ({ success: 'Correcta', neutral: 'Neutral', skipped: 'Omitida', failure: 'Falló' }[check.conclusion] || 'Pendiente o incompleta')));
    if (!item.checks.rows.length) panel.append(element('p', 'muted', 'GitHub aún no muestra comprobaciones.'));
    panel.append(element('h4', '', 'Archivos · ' + (item.fileCount ?? item.files.length)));
    for (const file of item.files) {
      const detail = element('details', 'operation-file');
      detail.append(element('summary', '', file.name + ' · +' + file.additions + ' / −' + file.deletions),
        element('pre', '', file.patch || 'Vista previa disponible en GitHub.'));
      if (file.patchTruncated) detail.append(link('Ver diff completo ↗', item.url + '/files'));
      panel.append(detail);
    }
    if (item.fileCount > item.files.length) panel.append(link('Ver todos los archivos ↗', item.url + '/files'));
    if (item.merged) panel.append(element('p', 'badge ready', 'Fusionada'));
    if (item.open && !item.draft && item.mergeable === true && item.checks.ready) {
      panel.append(button('Fusionar en main', () => confirm({
        title: 'Fusionar en GitHub', copy: 'La solicitud #' + item.number + ' se incorporará a main. El despliegue se confirma por separado.',
        code: short(item.head), label: 'Fusionar', action: async code => {
          await post('github/fusionar', { number: item.number, revision: item.head, confirm: code });
          feedback('Solicitud fusionada en GitHub.');
          await loadGitHub().catch(fail);
        },
      })));
    } else if (item.open) panel.append(element('p', 'muted', 'La fusión se habilita cuando GitHub la permite y las comprobaciones están listas.'));
  }

  function showHostinger(result) {
    hostinger = result;
    const target = $('hostinger-connect').elements.target;
    if (document.activeElement !== target) target.value = result.target || '';
    message($('hostinger-status'), result.target ? 'Conexión configurada · ' + result.target +
      (result.head ? ' · revisión actual ' + short(result.head) : '') : 'Configura primero el acceso SSH al VPS.');
    const job = result.job;
    const running = ['running', 'uncertain'].includes(job?.state);
    $('hostinger-prepare').disabled = !result.target || running;
    const output = $('hostinger-job');
    output.replaceChildren(element('h3', '', job ? 'Último despliegue · ' + short(job.revision) : 'Aún no hay despliegues desde este panel'));
    const labels = { running: 'En curso', uncertain: 'Por confirmar', failed: 'Fallido', completed: 'Completado' };
    if (job) {
      output.append(element('p', 'muted', labels[job.state] + ' · ' + stamp(job.startedAt)));
      if (job.message) output.append(element('p', 'muted', job.message));
      if (job.logs?.length) output.append(element('pre', '', job.logs.join('\n')));
    }
    const history = $('hostinger-history');
    history.hidden = !result.history?.length;
    history.querySelector('ul').replaceChildren(...(result.history || []).map(item =>
      element('li', '', short(item.revision) + ' · ' + labels[item.state] + ' · ' + stamp(item.startedAt))));
  }
  function loadHostinger() {
    if (!statusQuery) statusQuery = get('hostinger/estado').then(showHostinger).finally(() => { statusQuery = null; });
    return statusQuery;
  }
  onForm($('github-connect'), async values => { await post('github/conectar', values); await loadGitHub(); });
  onForm($('github-create'), async values => {
    const result = await post('github/crear', values);
    pullNumber = result.number;
    await loadGitHub();
  });
  $('github-disconnect').addEventListener('click', event => busy(event.currentTarget, async () => {
    await post('github/desconectar');
    await loadGitHub();
  }));
  onForm($('hostinger-connect'), async values => showHostinger(await post('hostinger/conectar', values)));
  $('hostinger-prepare').addEventListener('click', event => busy(event.currentTarget, async () => {
    await api('/api/cambios/sincronizar', 'POST', {});
    const history = await api('/api/cambios?source=github');
    const plan = await post('hostinger/preparar', { revision: history.upstream });
    confirm({
      title: 'Desplegar en Hostinger', code: short(plan.revision), label: 'Desplegar',
      copy: plan.target + ' pasará de ' + short(plan.before) + ' a ' + short(plan.revision) + '. ' +
        (history.commits.find(item => item.sha === plan.revision)?.subject || 'Última revisión de main') + '. ' +
        (plan.ciChecked ? 'Comprobaciones de GitHub correctas.' : 'Comprobaciones de GitHub sin consultar.') +
        ' El script hará su copia y sus comprobaciones. Tienes cinco minutos para confirmar.',
      action: async code => {
        await post('hostinger/desplegar', { id: plan.id, revision: plan.revision, confirm: code });
        await loadHostinger().catch(fail);
      },
    });
  }));
  const admin = setupAdminPanel({ get, post, element, button, confirm, onForm, busy });
  const loaders = { github: loadGitHub, hostinger: loadHostinger, admin: admin.load };
  const load = () => loaders[tab]().catch(fail);
  for (const control of document.querySelectorAll('[data-operation]')) {
    control.addEventListener('click', () => {
      tab = control.dataset.operation;
      for (const node of document.querySelectorAll('[data-operation]')) {
        const active = node === control;
        node.setAttribute('aria-pressed', String(active));
        $('operation-' + node.dataset.operation).hidden = !active;
      }
      load();
    });
  }
  for (const control of document.querySelectorAll('[data-operation-refresh]')) control.addEventListener('click', () => busy(control, load));
  setInterval(() => {
    if (visible() && tab === 'hostinger' && ['running', 'uncertain'].includes(hostinger?.job?.state)) load();
  }, 6000);

  function quota(refresh = false) {
    if (quotaQuery) return quotaQuery;
    quotaQuery = api('/api/codex/uso' + (refresh ? '?actualizar=1' : '')).then(result => {
      const meter = $('codex-usage');
      const windows = result.windows || [];
      const used = windows[0]?.usedPercent;
      message($('codex-quota-chip'), used === undefined ? 'Uso de Codex' :
        (result.limitsFresh ? 'Codex · ' : 'Último dato · ') + number.format(100 - used) + ' % disponible');
      const nodes = windows.map(item => {
        const mins = item.durationMinutes;
        const label = mins === 10080 ? 'Límite semanal' : mins && mins % 60 === 0 ? 'Ventana de ' + mins / 60 + ' h' : 'Límite de uso';
        const card = element('div', 'quota-metric');
        const bar = element('progress', 'quota-progress');
        bar.max = 100;
        bar.value = item.usedPercent;
        bar.setAttribute('aria-label', label + ' consumido');
        card.append(element('h3', '', label), element('strong', '', number.format(100 - item.usedPercent) + ' % disponible'), bar,
          element('p', 'muted', item.resetsAt ? 'Se renueva el ' + stamp(item.resetsAt * 1000) : 'Renovación sin fecha disponible'));
        return card;
      });
      if (!nodes.length) nodes.push(element('p', 'muted', 'La sesión local de Codex no ha devuelto sus límites.'));
      if (Number.isFinite(result.accountTokens)) {
        const card = element('div', 'quota-metric');
        card.append(element('h3', '', 'Total informado por Codex'), element('strong', '', number.format(result.accountTokens)),
          element('p', 'muted', result.tokensFresh ? 'Tokens acumulados' : 'Último dato · ' + stamp(result.tokensAt)));
        nodes.push(card);
      }
      const local = element('div', 'quota-metric');
      local.append(element('h3', '', 'Encargos de Educame'), element('strong', '', number.format(result.local.tokens)),
        element('p', 'muted', 'Tokens registrados · ' + result.local.records + ' entregas'));
      nodes.push(local);
      if (windows.length && !result.limitsFresh) nodes.push(element('p', 'muted', 'Límites de la última consulta · ' + stamp(result.limitsAt)));
      meter.replaceChildren(...nodes);
    }).finally(() => { quotaQuery = null; });
    return quotaQuery;
  }
  const refreshQuota = () => quota().catch(() => message($('codex-quota-chip'), 'Uso de Codex sin actualizar'));
  $('codex-usage-refresh').addEventListener('click', event => busy(event.currentTarget, () => quota(true)));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshQuota(); });
  setInterval(() => { if (!document.hidden) refreshQuota(); }, 60_000);
  return { load, refreshQuota };
}
