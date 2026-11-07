(() => {
  'use strict';
  const button = document.querySelector('[data-app-notifications]');
  if (!button) return;
  const product = button.dataset.appNotifications;
  const label = button.dataset.appLabel || 'esta aplicación';
  const base = '/api/app-notifications/' + encodeURIComponent(product);
  const bell = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let dialog, messages = [], next = null, busy = false;
  button.innerHTML = bell + '<span class="app-notifications-count" hidden></span>';
  async function request(path = '', options = {}) {
    const response = await fetch(base + path, {credentials:'same-origin', ...options, headers:{'Content-Type':'application/json', ...(options.headers || {})}});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.detail || 'No se han podido cargar los avisos.');
    return data;
  }
  function count(data) {
    const unread = Number(data.unread) || 0, badge = button.querySelector('.app-notifications-count');
    badge.hidden = !unread; badge.textContent = unread > 99 ? '99+' : unread;
    button.setAttribute('aria-label', 'Notificaciones de ' + label + (unread ? ', ' + unread + ' sin leer' : ''));
  }
  async function refresh() { if (!document.hidden) try { count(await request('/summary')); } catch {} }
  function status(text) { dialog.querySelector('[data-app-notice-status]').textContent = text; }
  function render() {
    dialog.querySelector('[data-app-notice-list]').innerHTML = messages.length ? messages.map(item =>
      `<article class="app-notice"><div class="app-notice-meta"><span>${escape(label)}</span><time>${escape(new Date(item.created_at).toLocaleString('es-ES'))}</time></div><h3>${escape(item.title)}</h3><p>${escape(item.body)}</p><button type="button" data-dismiss="${escape(item.id)}" aria-label="Eliminar aviso: ${escape(item.title)}">Eliminar</button></article>`
    ).join('') : '<div class="app-notice-empty">No tienes notificaciones de ' + escape(label) + '.</div>';
    dialog.querySelector('[data-app-notice-more]').hidden = !next;
  }
  async function load(reset = true) {
    if (busy || (!reset && !next)) return;
    busy = true; status('Cargando avisos…');
    try {
      const data = await request(reset ? '' : '?before=' + encodeURIComponent(next));
      count(data); messages = reset ? data.messages : [...messages, ...data.messages]; next = data.next; render();
      const ids = data.messages.filter(item => !item.read).map(item => item.id);
      if (ids.length) count(await request('/read', {method:'POST', body:JSON.stringify({ids})}));
      status('');
    } catch (error) { status(error.message); }
    finally { busy = false; }
  }
  async function dismiss(id) {
    if (busy) return;
    busy = true; status('Eliminando aviso…');
    try { count(await request('/' + encodeURIComponent(id) + '/dismiss', {method:'POST'})); messages = messages.filter(item => item.id !== id); render(); status('Aviso eliminado.'); }
    catch (error) { status(error.message); }
    finally { busy = false; }
  }
  function open() {
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.className = 'app-notifications-dialog';
      dialog.innerHTML = `<div class="app-notice-head"><div class="app-notice-icon">${bell}</div><div><h2>Notificaciones</h2><p>${escape(label)}</p></div><button type="button" data-app-notice-close aria-label="Cerrar">×</button></div><div class="app-notice-status" data-app-notice-status role="status"></div><div class="app-notice-list" data-app-notice-list></div><footer><button type="button" data-app-notice-refresh>Actualizar</button><button type="button" data-app-notice-more hidden>Ver más</button></footer>`;
      document.body.append(dialog);
      dialog.addEventListener('click', event => {
        const target = event.target.closest('button'); if (!target) return;
        if (target.hasAttribute('data-app-notice-close')) dialog.close();
        if (target.hasAttribute('data-app-notice-refresh')) load();
        if (target.hasAttribute('data-app-notice-more')) load(false);
        if (target.dataset.dismiss) dismiss(target.dataset.dismiss);
      });
    }
    dialog.showModal(); load();
  }
  button.addEventListener('click', open);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
  refresh(); setInterval(refresh, 60000);
})();
