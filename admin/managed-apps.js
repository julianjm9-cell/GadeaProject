/* Account administration for GADEOS and apps created from LA TERRAZA. */
(() => {
  const $ = id => document.getElementById(id);
  const node = (tag, text, cls) => { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; if (cls) item.className = cls; return item; };
  const button = (text, action, cls) => { const item = node('button', text, cls); item.type = 'button'; item.addEventListener('click', action); return item; };
  let catalog = { apps: [], revision: 0 }, selected, loading, initialRoute = false, generation = 0;
  const records = new Map(), requests = new Map(), stationCounts = new Map();
  const managed = () => catalog.apps.filter(app => ['arena', 'workspace'].includes(app.template));
  const label = app => app.id === 'gadeos' ? 'GADEOS' : app.name;
  const key = app => 'app/' + app.id;
  const find = next => managed().find(app => key(app) === next);
  function open(app) { history.replaceState(null, '', '#' + key(app)); setView(key(app)); }
  function identity(app) { const icon = node('span', app.id === 'gadeos' ? '✦' : app.name.slice(0, 1), 'nav-icon'); icon.setAttribute('aria-hidden', 'true'); return icon; }
  function renderCatalog() {
    $('managedAppsNav').replaceChildren(...managed().map(app => {
      const item = button('', () => open(app)); item.dataset.view = key(app); item.classList.toggle('active', view === key(app)); item.append(identity(app), document.createTextNode(label(app))); return item;
    }));
    const host = $('managedOverview'); host.replaceChildren(); host.hidden = !managed().length;
    if (!managed().length) return;
    host.append(node('h3', 'Otras aplicaciones'));
    const grid = node('div', undefined, 'managed-overview-grid');
    for (const app of managed()) {
      const item = button('', () => open(app), 'managed-overview-card'); item.append(identity(app), node('strong', label(app)), node('span', ({ privada: 'Privada', publica: 'Pública', pausada: 'Pausada' })[app.state], 'badge')); grid.append(item);
    }
    host.append(grid);
  }
  async function load() {
    if (loading) return loading;
    loading = (async () => {
      try {
        const data = await api('/admin/apps');
        if (!Array.isArray(data.apps) || !Number.isInteger(data.revision)) throw Error('No se pudo consultar el catálogo de aplicaciones.');
        if (data.revision >= catalog.revision) catalog = data;
        for (const app of catalog.apps) if (app.product) appAvailability[app.product] = { paused: app.state === 'pausada' };
        $('managedCatalogError').hidden = true; renderCatalog();
        if (!initialRoute) { initialRoute = true; const requested = location.hash.slice(1); if (find(requested)) return setView(requested); }
        render(view);
      } catch (error) { $('managedCatalogError').hidden = false; $('managedCatalogError').textContent = error.message; }
    })().finally(() => { loading = undefined; });
    return loading;
  }
  async function loadAccounts(app) {
    const request = (requests.get(app.id) || 0) + 1; requests.set(app.id, request);
    const data = await api('/admin/apps/' + app.id + '/accounts');
    if (!Array.isArray(data.accounts)) throw Error('No se pudo leer la lista de usuarios.');
    if (requests.get(app.id) !== request) return;
    records.set(app.id, data.accounts);
    if (app.id === 'gadeos') stationCounts.set(app.id, Number.isInteger(data.station_count) ? data.station_count : 9);
    if (selected?.id === app.id) paintAccounts(app);
  }
  function paintAccounts(app) {
    const rows = records.get(app.id) || [], query = $('managedUserSearch').value.trim().toLocaleLowerCase('es'), total = stationCounts.get(app.id) || 9;
    const metrics = $('managedMetrics'); metrics.replaceChildren();
    for (const [title, value] of [['Usuarios', rows.length], ['Accesos activos', rows.filter(row => row.active).length], ...(app.id === 'gadeos' ? [['Recorrido completado', rows.filter(row => row.completed >= total).length]] : [])]) {
      const metric = node('div', undefined, 'metric'); metric.append(node('span', title), node('strong', String(value))); metrics.append(metric);
    }
    const list = $('managedUsers'); list.replaceChildren();
    for (const account of rows.filter(row => !query || row.name.toLocaleLowerCase('es').includes(query))) {
      const card = node('article', undefined, 'managed-user-card'); card.dataset.managedAccount = account.id;
      const copy = node('div'); copy.append(node('strong', account.name), node('p', account.active ? 'Acceso activo' : 'Acceso desactivado', 'muted'));
      if (app.id === 'gadeos') copy.append(node('small', account.completed + ' / ' + total + ' pruebas completadas', 'muted'));
      card.append(copy, button('Editar usuario', () => edit(app, structuredClone(account)))); list.append(card);
    }
    if (!list.childElementCount) list.append(node('p', rows.length ? 'No hay usuarios con ese nombre.' : 'Todavía no hay usuarios en esta aplicación.', 'empty'));
  }
  function field(form, title, name, value = '', type = 'text') {
    const wrap = node('div'), id = 'managed-' + name, caption = node('label', title), input = node('input'); caption.htmlFor = id; input.id = id; input.name = name; input.type = type; input.value = value;
    if (type === 'password') { input.minLength = 8; input.maxLength = 72; input.autocomplete = 'new-password'; }
    else { input.required = true; input.minLength = 2; input.maxLength = 80; input.autocomplete = 'off'; }
    wrap.append(caption, input); form.append(wrap); return input;
  }
  function edit(app, account) {
    const host = $('managedEditor'); host.hidden = false; host.replaceChildren();
    const form = node('form', undefined, 'form-grid');
    const heading = node('div', undefined, 'head'); heading.append(node('h3', account ? 'Editar usuario' : 'Nuevo usuario'), button('Cerrar', () => { host.replaceChildren(); host.hidden = true; })); form.append(heading);
    const name = field(form, app.id === 'gadeos' ? 'Nombre de tributo' : 'Nombre de usuario', 'name', account?.name || '');
    const password = field(form, account ? 'Nueva contraseña (opcional)' : 'Contraseña inicial', 'password', '', 'password'); password.required = !account;
    let active;
    if (account) {
      const wrap = node('label', undefined, 'managed-active'); active = node('input'); active.type = 'checkbox'; active.checked = account.active; active.name = 'active'; wrap.append(active, document.createTextNode('Cuenta activa')); form.append(wrap);
      form.append(node('p', 'Cambiar la contraseña o desactivar la cuenta cierra sus sesiones. El progreso se conserva.', 'muted'));
    }
    const submit = node('button', account ? 'Guardar usuario' : 'Crear usuario', 'primary'); submit.type = 'submit';
    const status = node('p', undefined, 'managed-form-status'); status.setAttribute('role', 'status');
    form.append(submit, status); host.append(form); name.focus();
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (submit.disabled) return; status.textContent = '';
      for (const control of form.querySelectorAll('input,button')) control.disabled = true;
      try {
        await api('/admin/apps/' + app.id + '/accounts' + (account ? '/' + account.id : ''), { method: account ? 'PATCH' : 'POST', body: JSON.stringify({ name: name.value.trim(), ...(account ? { revision: account.revision, active: active.checked } : {}), ...(password.value ? { password: password.value } : {}) }) });
        password.value = '';
        await loadAccounts(app);
        if (selected?.id === app.id && form.isConnected) { host.hidden = true; host.replaceChildren(); }
        toast(account ? 'Usuario actualizado. Su progreso se conserva.' : 'Usuario creado en ' + label(app) + '.');
      } catch (error) { status.textContent = error.message; }
      finally { for (const control of form.querySelectorAll('input,button')) control.disabled = false; }
    });
  }
  function render(next) {
    const product = PRODUCTS.find(item => item.key === next);
    const normal = catalog.apps.find(app => app.product === (next === 'hazlotu' ? 'HAZLOTU' : product?.code));
    if (normal) renderAccess(normal, $(next === 'hazlotu' ? 'hazlotuAvailabilityControl' : 'appAvailabilityControl'));
    const app = find(next); $('view-managed').hidden = !app;
    if (!app) { selected = undefined; generation++; return; }
    renderAccess(app, $('managedAvailability'));
    if (selected?.id === app.id) return;
    selected = app; const current = ++generation;
    $('managedTitle').textContent = label(app); $('managedHint').textContent = app.id === 'gadeos' ? 'Acceso con nombre de tributo y contraseña.' : 'Acceso con nombre de usuario y contraseña.';
    $('managedContentHint').textContent = 'Para modificar el contenido o el diseño: LA TERRAZA → Apps → ' + label(app) + '.';
    const link = $('managedOpen'); link.href = app.path; link.hidden = !app.path;
    $('managedUserSearch').value = ''; $('managedUsers').replaceChildren(node('p', 'Cargando usuarios…', 'muted')); $('managedMetrics').replaceChildren(); $('managedEditor').replaceChildren(); $('managedEditor').hidden = true;
    $('managedNew').onclick = () => edit(app);
    $('managedUserSearch').oninput = () => paintAccounts(app);
    $('managedRefresh').onclick = () => loadAccounts(app).catch(error => toast(error.message));
    loadAccounts(app).catch(error => { if (current === generation) $('managedUsers').replaceChildren(node('p', error.message, 'notice')); });
  }
  function renderAccess(app, host) {
    if (host.querySelector('form')?.dataset.app === app.id) return;
    host.replaceChildren();
    const wrap = node('div', undefined, 'managed-access'), copy = node('div');
    copy.append(node('strong', 'Acceso de la aplicación'), node('p', ({ publica: 'Disponible con sus accesos habituales.', privada: app.password_protected ? 'Protegida con contraseña de acceso.' : 'Acceso con cuentas autorizadas.', pausada: 'Acceso detenido. Los datos se conservan.' })[app.state], 'muted'));
    const choices = node('div', undefined, 'managed-access-choices'); choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', 'Acceso de ' + label(app));
    for (const [value, title] of [['publica', 'Pública'], ['privada', 'Privada'], ['pausada', 'Pausada']]) {
      const control = button(title, async () => {
        if (value === 'privada') { editPassword(app, host); return; }
        if (control.getAttribute('aria-pressed') === 'true') return;
        for (const item of choices.querySelectorAll('button')) item.disabled = true;
        try {
          catalog = await api('/admin/apps/' + app.id, { method: 'PATCH', body: JSON.stringify({ id: app.id, state: value, revision: catalog.revision }) });
          if (!Array.isArray(catalog.apps)) throw Error('Actualiza el catálogo para confirmar el acceso.');
          for (const item of catalog.apps) if (item.product) appAvailability[item.product] = { paused: item.state === 'pausada' };
          renderCatalog(); renderAll(); toast('Acceso actualizado. Cuentas y progreso conservados.');
        } catch (error) { toast(error.message); await load(); }
        finally { for (const item of choices.querySelectorAll('button')) item.disabled = false; }
      });
      control.setAttribute('aria-pressed', String(app.state === value)); choices.append(control);
    }
    wrap.append(copy, choices); host.append(wrap);
    if (app.state === 'privada' && app.password_protected) host.append(button('Cambiar contraseña', () => editPassword(app, host)));
  }
  function editPassword(app, host) {
    let revision = catalog.revision;
    host.replaceChildren();
    const form = node('form', undefined, 'managed-access-password');
    form.dataset.app = app.id;
    const passwordLabel = node('label', 'Contraseña de acceso · ' + label(app));
    const password = node('input'); password.type = 'password'; password.minLength = 6; password.maxLength = 72; password.autocomplete = 'new-password'; password.required = !app.password_protected;
    passwordLabel.append(password);
    const hint = node('p', app.password_protected ? 'Déjalo vacío para conservar la contraseña guardada.' : 'Elige una contraseña de al menos seis caracteres.', 'muted');
    const submit = node('button', 'Guardar acceso privado'); submit.type = 'submit';
    const cancel = button('Cancelar', () => { host.replaceChildren(); renderAccess(catalog.apps.find(item => item.id === app.id) || app, host); });
    const status = node('p', '', 'muted'); status.setAttribute('role', 'alert');
    form.append(passwordLabel, hint, submit, cancel, status); host.append(form); password.focus();
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (submit.disabled) return;
      const value = password.value; password.value = ''; submit.disabled = cancel.disabled = true;
      try {
        const data = await api('/admin/apps/' + app.id, { method:'PATCH', body:JSON.stringify({ id:app.id, state:'privada', revision, ...(value ? {access_password:value} : {}) }) });
        if (!Array.isArray(data.apps)) throw Error('Actualiza el catálogo para confirmar el acceso.');
        if (value && !data.apps.find(item => item.id === app.id)?.password_protected) throw Error('Actualiza Hostinger para activar la contraseña de acceso.');
        if (data.revision >= catalog.revision) catalog = data;
        host.replaceChildren(); renderCatalog(); renderAll(); toast('Acceso privado guardado y sincronizado con LA TERRAZA.');
      } catch(error) {
        status.textContent = error.message;
        if (error.status === 409) { await load(); revision = catalog.revision; }
      }
      finally { submit.disabled = cancel.disabled = false; }
    });
  }
  window.managedApps = { load, render, hasView: next => Boolean(find(next)) };
  window.addEventListener('hashchange', () => { const next = location.hash.slice(1); if (find(next)) setView(next); });
  window.addEventListener('focus', () => { if (token && !document.querySelector('.managed-access-password')) load(); });
  setInterval(() => { if (token && !document.hidden && !document.querySelector('.managed-access-password')) load(); }, 30000);
  if (token) load();
})();
