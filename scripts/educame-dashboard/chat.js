import { renderQueue } from './queue-view.js';
import { setupChatAttachments } from './chat-attachments.js';
const $ = id => document.getElementById(id);
const preference = 'terrace-chat-model';
const pendingKey = 'terrace-chat-pending';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export function setupChat({ api, element, button, feedback, formMessage, getState, openDelivery }) {
  const form = $('chat-form');
  const model = $('chat-model');
  const provider = $('chat-provider');
  try { provider.value = localStorage.getItem('terrace-chat-provider') || 'codex'; } catch {}
  const mode = $('chat-mode');
  const input = form.elements.text;
  const submit = form.querySelector('[type=submit]');
  const log = $('chat-messages');
  const refresh = $('chat-refresh-models');
  const restart = $('chat-restart').querySelector('button');
  let snapshot;
  let pending;
  let catalog = [];
  let modelStatus = 'Consultando modelos…';
  let sending = false;
  let uploading = false;
  let attachments;
  let loading;
  let timer;
  let publications;
  let replyTo;
  let adjustment;
  let scope = '';
  let scopeApps = [];
  try { scope = localStorage.getItem('terrace-chat-scope') || ''; } catch {}
  const draftKey = 'terrace-chat-draft';
  const scopedDraftKey = () => draftKey + (scope ? ':' + scope : '');
  const scopedPendingKey = () => pendingKey + (scope ? ':' + scope : '');
  let restoredDraft;
  try {
    const draft = JSON.parse(localStorage.getItem(scopedDraftKey()));
    restoredDraft = draft;
    if (draft && !pending) { input.value = draft.text || ''; replyTo = draft.replyTo; adjustment = draft.adjustment; }
  } catch {}
  try {
    pending = JSON.parse(sessionStorage.getItem(scopedPendingKey()));
    if (pending) {
      if (!restoredDraft) {
        input.value = pending.text || '';
        if (pending.key) { adjustment = { key: pending.key, title: pending.title || 'Entrega guardada' }; replyTo = undefined; }
        else replyTo = pending.replyTo;
      }
      if (!pending.key) { mode.value = pending.mode || 'auto'; provider.value = pending.provider || 'codex'; }
    }
  } catch {}

  function switchScope(next) {
    if (sending || uploading) { feedback('El mensaje o sus imágenes se están guardando. Puedes cambiar de sección enseguida.'); return; }
    saveDraft(); scope = next || ''; replyTo = undefined; adjustment = undefined; input.value = ''; pending = undefined;
    attachments.restore();
    try {
      localStorage.setItem('terrace-chat-scope', scope);
      const draft = JSON.parse(localStorage.getItem(scopedDraftKey()));
      if (draft) { input.value = draft.text || ''; replyTo = draft.replyTo; adjustment = draft.adjustment; }
      attachments.restore(draft?.attachments || []);
      pending = JSON.parse(sessionStorage.getItem(scopedPendingKey()));
      if (pending) {
        if (!draft) {
          input.value = pending.text || '';
          attachments.restore(pending.attachmentPreviews || []);
          if (pending.key) { adjustment = { key: pending.key, title: pending.title || 'Entrega guardada' }; replyTo = undefined; }
          else replyTo = pending.replyTo;
        }
        if (!pending.key) {
          mode.value = pending.mode || 'auto';
          if (provider.value !== (pending.provider || 'codex')) { provider.value = pending.provider || 'codex'; catalog = []; model.replaceChildren(); loadModels(); }
          else if (catalog.some(item => item.id === pending.model)) model.value = pending.model;
        }
      }
    } catch {}
    if (snapshot) { const previous = snapshot; snapshot = undefined; render(previous); }
    controls();
  }
  $('chat-general').addEventListener('click', () => switchScope(''));
  window.addEventListener('terrace-chat-scope', event => {
    if (!scopeApps.some(app => app.id === event.detail.app)) scopeApps.push({ id: event.detail.app, name: event.detail.name || event.detail.app });
    switchScope(event.detail.app + '/' + event.detail.area); input.focus();
  });
  api('/api/apps/catalogo').then(data => { scopeApps = data.apps; controls(); }).catch(() => {});

  const visible = () => !$('chat-title').closest('[data-page]').hidden;
  const isWorking = () => snapshot?.messages.some(item => item.state === 'working');
  const queued = () => snapshot?.messages.filter(item => item.state === 'queued').length || 0;
  const hasPending = () => isWorking() || queued() > 0;
  function controls() {
    const strip = $('chat-context');
    strip.hidden = !scope;
    const [scopeApp, area] = scope.split('/');
    $('chat-context-label').textContent = (scopeApps.find(app => app.id === scopeApp)?.name || scopeApp || '') + ' · ' + ({ app: 'App', landing: 'Landing', redes: 'Redes sociales' })[area];
    $('chat-general').disabled = sending || uploading;
    $('chat-attach-image').disabled = sending;

    submit.disabled = !snapshot || (!adjustment && !model.value) || sending || uploading;
    submit.textContent = adjustment ? 'Enviar ajuste' : 'Añadir a la cola';
    $('chat-status').textContent = sending ? 'Enviando…' : queued() ?
      queued() + ' en espera. Se enviarán automáticamente cuando termine el trabajo actual.' :
      isWorking() ? 'El agente está trabajando. Puedes añadir otro mensaje.' : adjustment ? 'El ajuste continuará desde la copia guardada con su motor original.' : modelStatus;
    model.required = !adjustment;
    input.maxLength = adjustment ? 2000 : 4000;
    const change = mode.value === 'change';
    $('chat-mode-hint').textContent = mode.value === 'auto' ?
      'Pregunta o pide cambios en tus apps y en LA TERRAZA. Si falta algo, te preguntará aquí. El encargo se hace y se sube a GitHub automáticamente.' : change ?
      'Codex prepara el cambio. Si hay otro trabajo en marcha, lo guarda y continúa después.' :
      'Pregunta sobre LA TERRAZA o cualquier otro tema. El agente usa los mensajes recientes para seguir el hilo.';
    if (provider.value !== 'codex') $('chat-mode-hint').textContent += ' API de pago. Hasta 24 pasos o 120.000 tokens por pasada, incluida una segunda pasada para revisar las implementaciones.';
    input.placeholder = mode.value === 'auto' ? 'Ejemplo: mejora el juego de fracciones de Profesor Particular y simplifica las tarjetas de LA TERRAZA.' : change ? 'Ejemplo: haz más fácil encontrar las entregas pendientes.' :
      'Ejemplo: ¿cómo se diferencia un commit de una propuesta en GitHub?';
    const context = $('chat-reply-context');
    if (context) {
      const question = snapshot?.messages.find(item => item.id === replyTo);
      context.hidden = !question && !adjustment;
      context.replaceChildren();
      if (question) context.append(element('span', '', 'Respondiendo: ' + question.reply), button('Cancelar respuesta', () => { replyTo = undefined; saveDraft(); controls(); }));
      if (adjustment) context.append(element('span', '', 'Ajustando: ' + adjustment.title), button('Cancelar ajuste', () => {
        adjustment = undefined;
        if (pending?.key) { pending = null; try { sessionStorage.removeItem(scopedPendingKey()); } catch {} }
        saveDraft(); controls();
      }));
    }
  }
  function saveDraft() { try { localStorage.setItem(scopedDraftKey(), JSON.stringify({ text: input.value, replyTo, adjustment, attachments: attachments?.items() || [] })); } catch {} }
  attachments = setupChatAttachments({ api, form, changed: saveDraft, busy: value => { uploading = value; controls(); },
    canAdd: () => !sending, error: message => formMessage(form, message) });
  attachments.restore(restoredDraft?.attachments || pending?.attachmentPreviews || []);
  input.addEventListener('input', saveDraft);
  window.addEventListener('terrace-compose', event => {
    const detail = event.detail || {};
    if (!input.value.trim()) input.value = detail.text || (detail.app ? 'En ' + (getState()?.projectProfiles?.[detail.app]?.name || detail.app) + ': ' : '');
    saveDraft(); input.focus();
  });
  function respond(item) { if (sending || uploading) return; if ((item.scope || '') !== scope) switchScope(item.scope || ''); adjustment = undefined; replyTo = item.id; mode.value = 'auto'; attachments.restore(item.attachmentPreviews || []); saveDraft(); controls(); form.scrollIntoView({ block: 'center' }); input.focus(); }

  function render(data) {
    clearTimeout(timer);
    const published = JSON.stringify([getState()?.board.pushes, getState()?.batches, getState()?.automaticUploads, getState()?.history]);
    const changed = JSON.stringify(snapshot?.messages) !== JSON.stringify(data.messages) || publications !== published;
    publications = published;
    snapshot = data;
    $('chat-restart').hidden = !data.needsRestart;
    if (changed) {
      renderQueue({ state: getState(), messages: data.messages, host: log, element, button, respond, scope, openReport: openDelivery,
        adjust: delivery => { if (sending || uploading) return; replyTo = undefined; adjustment = { key: delivery.key, title: delivery.encargo }; if (delivery.attachmentPreviews) attachments.restore(delivery.attachmentPreviews); else attachments.restoreIds(delivery.attachments || []); saveDraft(); controls(); form.scrollIntoView({ block: 'center' }); input.focus(); },
        retry: id => action('/api/encargos/reintentar-subida', { id }),
        resume: id => action('/api/encargos/retomar', { id }),
        retryMessage: item => action('/api/chat', { id: item.id, provider: item.provider || 'codex', mode: item.mode, model: item.model, text: item.text, ...(item.attachments?.length ? { attachments: item.attachments } : {}), ...(item.scope ? { scope: item.scope } : {}), ...(item.replyTo ? { replyTo: item.replyTo } : {}) }),
      });
    }
    controls();
    if (visible()) timer = setTimeout(load, 1500);
  }
  async function action(path, body) {
    try { await api(path, 'POST', body); await load(); }
    catch (error) { feedback(error.message, true); }
  }

  function load() {
    if (!loading) loading = api('/api/chat').then(render).catch(error => {
      formMessage(form, error.message);
      if (visible() && hasPending()) timer = setTimeout(load, 2400);
    }).finally(() => { loading = null; });
    return loading;
  }
  async function loadModels(fresh = false) {
    if (refresh.disabled) return;
    refresh.disabled = true;
    const chosenProvider = provider.value;
    const previousModel = model.dataset.provider === chosenProvider ? model.value : '';
    model.replaceChildren(); controls();
    try {
      const result = await api('/api/chat/modelos?provider=' + chosenProvider + (fresh ? '&actualizar=1' : ''));
      if (chosenProvider !== provider.value) return;
      catalog = result.ready ? result.models : [];
      let stored = pending && (pending.provider || 'codex') === chosenProvider ? pending.model : '';
      try { stored ||= localStorage.getItem(preference + '-' + chosenProvider) || (chosenProvider === 'codex' ? localStorage.getItem(preference) : ''); } catch {}
      const selectedModel = previousModel || stored;
      model.replaceChildren(...catalog.map(item => new Option(item.label + (item.recommended ? ' · Recomendado' : ''), item.id)));
      model.dataset.provider = chosenProvider;
      if (catalog.some(item => item.id === selectedModel)) model.value = selectedModel;
      else if (catalog.some(item => item.recommended)) model.value = catalog.find(item => item.recommended).id;
      modelStatus = catalog.length ? '' : result.ready ? 'El motor aún no devolvió el catálogo. Actualiza los modelos.' : result.message;
      if (snapshot) {
        const data = snapshot;
        snapshot = null;
        render(data);
      }
    } catch (error) { modelStatus = error.message; }
    finally { refresh.disabled = false; controls(); if (chosenProvider !== provider.value) loadModels(); }
  }
  provider.addEventListener('change', () => {
    try { localStorage.setItem('terrace-chat-provider', provider.value); } catch {}
    catalog = []; model.replaceChildren(); modelStatus = 'Consultando modelos…'; controls(); loadModels();
  });
  model.addEventListener('change', () => { try { localStorage.setItem(preference + '-' + provider.value, model.value); } catch {} });
  mode.addEventListener('change', controls);
  refresh.addEventListener('click', () => loadModels(true));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const text = input.value.trim();
    const imageIds = attachments.ids();
    if (!text) return formMessage(form, 'Escribe un mensaje para Codex.');
    if (adjustment) {
      if (text.length > 2000) return formMessage(form, 'El ajuste admite hasta 2.000 caracteres. Acorta el texto; el borrador sigue guardado.');
      if (!pending || pending.key !== adjustment.key || pending.text !== text || JSON.stringify(pending.attachments || []) !== JSON.stringify(imageIds)) pending = { id: crypto.randomUUID(), key: adjustment.key, title: adjustment.title, text, attachments: imageIds, attachmentPreviews: attachments.items() };
      try { sessionStorage.setItem(scopedPendingKey(), JSON.stringify(pending)); } catch {}
      sending = true; controls(); formMessage(form);
      try {
        const submitted = pending;
        await api('/api/encargos/ajustes', 'POST', { id: submitted.id, key: submitted.key, note: text, attachments: submitted.attachments });
        pending = null;
        if (adjustment?.key === submitted.key) adjustment = undefined;
        if (input.value.trim() === text) { input.value = ''; attachments.restore(); }
        saveDraft();
        try { sessionStorage.removeItem(scopedPendingKey()); } catch {}
        await load();
      } catch (error) { formMessage(form, error.message); }
      finally { sending = false; controls(); }
      return;
    }
    mode.value = pending?.text === text ? pending.mode || 'auto' :
      snapshot?.messages.find(item => item.id === replyTo)?.mode === 'ask' ? 'ask' : 'auto';
    const request = { ...(scope ? { scope } : {}), text, provider: provider.value, model: model.value, mode: mode.value, ...(replyTo ? { replyTo } : {}) };
    request.attachments = imageIds;
    if (!pending || JSON.stringify(pending.attachments || []) !== JSON.stringify(imageIds) || ['text', 'provider', 'model', 'mode', 'replyTo', 'scope'].some(key => request[key] !== (key === 'provider' ? pending[key] || 'codex' : pending[key]))) {
      pending = { id: crypto.randomUUID(), ...request, attachmentPreviews: attachments.items() };
    }
    try { sessionStorage.setItem(scopedPendingKey(), JSON.stringify(pending)); } catch {}
    sending = true;
    formMessage(form);
    controls();
    try {
      if (loading) await loading;
      render(await api('/api/chat', 'POST', pending));
      if (input.value.trim() === text && model.value === request.model && mode.value === request.mode) { input.value = ''; replyTo = undefined; attachments.restore(); saveDraft(); }
      pending = null;
      mode.value = 'auto';
      try { sessionStorage.removeItem(scopedPendingKey()); } catch {}
      input.focus();
    } catch (error) { formMessage(form, error.message); }
    finally { sending = false; controls(); }
  });

  async function restartPanel() {
    restart.disabled = true;
    restart.textContent = 'Reiniciando…';
    try {
      await api('/api/chat/reiniciar', 'POST', {});
      for (let attempt = 0; attempt < 35; attempt++) {
        await pause(500);
        const data = await api('/api/chat').catch(() => null);
        if (data && !data.needsRestart) { location.reload(); return; }
      }
      throw new Error('El panel aún no responde. Abre el acceso directo de LA TERRAZA.');
    } catch (error) { feedback(error.message, true); }
    finally { restart.disabled = false; restart.textContent = 'Cargar actualización'; }
  }
  restart.addEventListener('click', restartPanel);
  return { restart: restartPanel, open() { load(); if (!catalog.length) loadModels(); } };
}
