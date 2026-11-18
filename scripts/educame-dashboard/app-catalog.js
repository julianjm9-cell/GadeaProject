import { appLogo } from './workspace.js';
import { icon } from './icons.js';
const areas = [['app', 'App'], ['landing', 'Landing'], ['redes', 'Redes sociales']];
const labels = { publica: 'Pública', privada: 'Privada', pausada: 'Pausada' };
export function setupAppCatalog({ api, element: el, button, feedback }) {
  const root = document.getElementById('app-management'), dialog = document.getElementById('app-editor'), body = document.getElementById('app-editor-body');
  let catalog, live = false, saving = false, loading, connectionIssue, pendingConnection;
  let paused = [];
  const connectDialog = document.getElementById('apps-admin-connect'), connectForm = document.getElementById('apps-admin-connect-form');
  const connectError = connectForm.querySelector('.form-message'), connectSubmit = connectForm.querySelector('[type=submit]');
  function connectionMessage(error) {
    return error?.status === 404 ? 'El servidor necesita la actualización de Hostinger para gestionar estas apps.' :
      error?.status === 403 ? 'Esta cuenta necesita permisos de administración de Educame.' :
      error?.status && error.status !== 401 ? error.message : 'Conecta administración para crear apps y gestionar su acceso. La conexión con Codex es independiente.';
  }
  function acceptCatalog(data) {
    if (!Array.isArray(data?.apps) || !Number.isInteger(data.revision)) throw Object.assign(new Error('El servidor no devolvió un catálogo válido.'), { status: 502 });
    catalog = data; live = true; connectionIssue = null;
  }
  function connect(label, action) {
    pendingConnection = { label, action };
    document.getElementById('apps-admin-connect-copy').textContent = label + '. Entra con tu cuenta administradora de Educame; tu conexión de Codex es independiente.';
    connectError.hidden = true;
    if (!connectDialog.open) connectDialog.showModal();
    connectForm.elements.identifier.focus();
  }
  async function connectedAction(label, action) {
    if (!live) { connect(label, action); return; }
    try { await action(); }
    catch (error) {
      if ([401, 403].includes(error.status)) { live = false; connectionIssue = error; render(); connect(label, action); }
      else feedback(error.message, true);
    }
  }
  const cancelConnection = () => { if (!connectSubmit.disabled) connectDialog.close(); };
  connectDialog.querySelector('.icon-button').addEventListener('click', cancelConnection);
  connectForm.querySelector('[data-cancel-admin]').addEventListener('click', cancelConnection);
  connectDialog.addEventListener('cancel', event => { if (connectSubmit.disabled) event.preventDefault(); });
  connectDialog.addEventListener('close', () => { pendingConnection = null; connectForm.elements.password.value = ''; });
  connectForm.addEventListener('submit', async event => {
    event.preventDefault(); if (connectSubmit.disabled) return;
    const request = pendingConnection, credentials = Object.fromEntries(new FormData(connectForm));
    connectForm.elements.password.value = ''; connectSubmit.disabled = true; connectError.hidden = true;
    try {
      await api('/api/operacion/admin/login', 'POST', credentials);
      acceptCatalog(await api('/api/operacion/admin/apps')); render();
      pendingConnection = null; connectDialog.close();
      if (request) await request.action();
    } catch (error) {
      connectionIssue = error; connectError.textContent = error.status === 401 ? 'No se ha podido entrar. Revisa el usuario y la contraseña de administración.' : connectionMessage(error); connectError.hidden = false;
    } finally { connectSubmit.disabled = false; }
  });
  function heading(title) { document.getElementById('app-editor-title').textContent = title; body.replaceChildren(); if (!dialog.open) dialog.showModal(); }
  const field = (form, title, name, value = '', multiline = false) => { const label = el('label', '', title), input = el(multiline ? 'textarea' : 'input'); input.name = name; input.value = value; if (multiline) input.rows = 3; label.append(input); form.append(label); return input; };
  async function load() {
    if (loading) return loading;
    loading = (async () => {
      catalog = await api('/api/apps/catalogo');
      try { acceptCatalog(await api('/api/operacion/admin/apps')); }
      catch (error) { live = false; connectionIssue = error; }
      if (!live) try { paused = (await api('/api/apps/estado')).paused || []; } catch {}
      render();
    })().catch(error => feedback(error.message, true)).finally(() => { loading = null; });
    return loading;
  }
  async function save(path, data) {
    if (saving) return;
    saving = true; root.querySelectorAll('button').forEach(node => { node.disabled = true; });
    try { catalog = await api('/api/operacion/admin/' + path, 'POST', data); live = true; render(); return catalog; }
    catch (error) { feedback(error.message, true); await load(); throw error; }
    finally { saving = false; render(); }
  }
  function render() {
    if (!catalog) return;
    renderHome();
    root.replaceChildren();
    const toolbar = el('div', 'app-management-toolbar');
    const create = button('Crear aplicación', () => connectedAction('Crear una aplicación', newApp)); create.className = 'button primary'; create.disabled = saving;
    toolbar.append(el('p', 'muted', live ? 'Administración conectada. Los cambios conservan las cuentas y el progreso.' : connectionMessage(connectionIssue)), create);
    if (!live) toolbar.append(button('Conectar administración', () => connect('Gestionar tus aplicaciones', async () => {})));
    root.append(toolbar);
    const grid = el('div', 'managed-app-grid');
    for (const app of catalog.apps) {
      const card = el('article', 'card managed-app'); card.dataset.catalogApp = app.id;
      const top = el('div', 'managed-app-heading'), monogram = el('span', 'managed-app-monogram', app.id === 'gadeos' ? 'G' : app.name.slice(0, 1));
      top.append(monogram, el('h2', '', app.name)); card.append(top);
      const state = el('div', 'app-state-switch'); state.setAttribute('role', 'group'); state.setAttribute('aria-label', 'Acceso de ' + app.name);
      for (const [value, title] of Object.entries(labels)) {
        const toggle = button(title, () => connectedAction('Cambiar el acceso de ' + app.name + ' a ' + title, async () => {
          const current = catalog.apps.find(item => item.id === app.id);
          if (saving || current?.state === value) return;
          await save('app-state', { id: app.id, state: value, revision: catalog.revision }); feedback('Acceso actualizado en el servidor.');
        }));
        toggle.disabled = saving; toggle.setAttribute('aria-pressed', String(live && app.state === value));
        if (!live) toggle.title = 'Conectar administración y cambiar a ' + title;
        state.append(toggle);
      }
      card.append(state, el('p', 'managed-app-state', live ? ({ publica: 'Visible con sus accesos habituales.', privada: 'Acceso por invitación.', pausada: 'Temporalmente cerrada. Sus datos se conservan.' })[app.state] : 'Pulsa una opción para conectar y gestionar esta app.'));
      const actions = el('div', 'managed-app-sections');
      for (const [area, title] of (app.personal ? [['app', 'App']] : areas)) actions.append(button(title + ' →', () => {
        window.dispatchEvent(new CustomEvent('terrace-chat-scope', { detail: { app: app.id, area, name: app.name } })); location.hash = 'chat';
      }));
      card.append(actions);
      const footer = el('div', 'managed-app-footer');
      if (app.path) { const open = el('a', 'text-link', 'Abrir app ↗'); open.href = 'https://educame.tech' + app.path; open.target = '_blank'; open.rel = 'noopener noreferrer'; footer.append(open); }
      if (app.id === 'gadeos') footer.append(button('Tributos y recorrido', () => connectedAction('Gestionar tributos y recorrido', () => manageApp(app))));
      else if (app.template === 'workspace') footer.append(button('Gestionar cuentas', () => connectedAction('Gestionar las cuentas de ' + app.name, () => manageApp(app))));
      card.append(footer); grid.append(card);
    }
    root.append(grid);
  }
  function renderHome() {
    const host = document.getElementById('workspace-apps');
    host.replaceChildren(...catalog.apps.filter(app => app.path).map(app => {
      const card = el('article', 'product-card'); card.dataset.homeApp = app.id; card.dataset.product = app.product || '';
      const link = el('a', 'product-name'); link.href = 'https://educame.tech' + app.path; link.target = '_blank'; link.rel = 'noopener noreferrer';
      const tile = el('span', 'tile-icon green'); tile.append(appLogo(app.id) || el('span', app.id === 'gadeos' ? 'gadeos-home-mark' : 'app-home-mark', app.id === 'gadeos' ? 'G' : app.name.slice(0, 1)));
      const copy = el('span', 'product-copy'); copy.append(el('strong', '', app.name));
      const status = live ? app.state : paused.includes(app.product) ? 'pausada' : null;
      const badge = el('small', 'product-paused', status === 'privada' ? 'Privada' : 'En pausa'); badge.hidden = !['pausada', 'privada'].includes(status); copy.append(badge);
      const arrow = icon('external'); arrow.classList.add('product-arrow'); link.append(tile, copy, arrow); card.append(link); return card;
    }));
  }
  function newApp() {
    heading('Crear aplicación');
    const form = el('form', 'managed-app-form');
    const name = field(form, 'Nombre de la aplicación', 'name'), id = field(form, 'Identificador para su dirección', 'id'); name.required = id.required = true; name.maxLength = 100; id.pattern = '[a-z][a-z0-9-]{1,48}'; id.maxLength = 49;
    let custom = false; id.addEventListener('input', () => { custom = true; }); name.addEventListener('input', () => { if (!custom) id.value = name.value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 49); });
    form.append(el('p', 'muted', 'Se crea con acceso privado, cuentas propias y un espacio personal que se guarda. Después puedes pedir al agente que la adapte desde su sección App.'));
    const submit = el('button', 'button primary', 'Crear aplicación privada'); submit.type = 'submit'; form.append(submit);
    form.addEventListener('submit', async event => { event.preventDefault(); if (saving) return; submit.disabled = true; try { await save('create-app', { name: name.value, id: id.value, state: 'privada', revision: catalog.revision }); dialog.close(); feedback('Aplicación creada. Ya puedes gestionar sus cuentas y pedir cambios en App.'); } catch {} finally { submit.disabled = false; } });
    body.append(form);
  }
  async function manageApp(app) {
    heading(app.name); body.append(el('p', 'muted', 'Cargando…'));
    try {
      const tabs = el('div', 'actions'); tabs.append(button(app.id === 'gadeos' ? 'Tributos' : 'Cuentas', () => accounts(app)));
      if (app.id === 'gadeos') tabs.append(button('Editar recorrido y cartas', campaign), button('Imágenes', materials));
      body.replaceChildren(tabs); const content = el('div'); content.id = 'managed-app-content'; body.append(content); await accounts(app);
    } catch (error) { feedback(error.message, true); }
  }
  async function materials() {
    const host = document.getElementById('managed-app-content'); host.replaceChildren(el('p', 'muted', 'Consultando materiales privados…'));
    try {
      const data = await api('/api/operacion/admin/app-materials'); host.replaceChildren(el('h3', '', 'Imágenes de GADEOS'));
      if (!data.available) { host.append(el('p', 'muted', 'No hay un paquete preparado en este equipo. Se conservan el recorrido y las cartas actuales.')); return; }
      host.append(el('p', 'muted', data.title + ' · Un cartel, ' + (data.envelope ? 'el diseño de los sobres y ' : '') + data.pages + ' páginas originales. Se incorporan al espacio privado de GADEOS.'));
      const apply = button(data.applied ? 'Volver a comprobar los materiales' : 'Aplicar imágenes', async () => {
        apply.disabled = true; apply.textContent = 'Importando materiales…';
        try { await api('/api/operacion/admin/app-materials', 'POST', { hash: data.hash }); await materials(); feedback('Imágenes preparadas en GADEOS. La batalla y el progreso se conservan.'); }
        catch (error) { feedback(error.message, true); apply.disabled = false; apply.textContent = 'Reintentar importación'; }
      }); apply.className = 'button primary'; host.append(apply);
      if (data.applied) host.append(el('p', 'form-message', 'Ya están aplicados. Entra en GADEOS para ver el planning, el recorrido y los sobres.'));
    } catch (error) { host.replaceChildren(el('p', 'form-message', error.message)); }
  }
  async function accounts(app) {
    const host = document.getElementById('managed-app-content'); host.replaceChildren(el('p', 'muted', 'Cargando cuentas…'));
    try {
      const data = await api('/api/operacion/admin/app-accounts?app=' + app.id);
      host.replaceChildren(); const form = el('form', 'managed-app-form'); form.append(el('h3', '', app.id === 'gadeos' ? 'Nuevo tributo' : 'Nueva cuenta'));
      const name = field(form, 'Nombre', 'name'), password = field(form, 'Contraseña inicial', 'password'); password.type = 'password'; password.autocomplete = 'new-password'; password.minLength = 8; password.maxLength = 72; name.required = password.required = true; name.maxLength = 80;
      const submit = el('button', 'button primary', app.id === 'gadeos' ? 'Crear tributo' : 'Crear cuenta'); submit.type = 'submit'; form.append(submit);
      form.addEventListener('submit', async event => { event.preventDefault(); submit.disabled = true; try { await api('/api/operacion/admin/app-account-create', 'POST', { app: app.id, name: name.value, password: password.value }); password.value = ''; await accounts(app); feedback('Cuenta creada. Ya puede entrar con su nombre y contraseña.'); } catch (error) { feedback(error.message, true); } finally { submit.disabled = false; } });
      host.append(form);
      for (const account of data.accounts) {
        const details = el('details', 'managed-account'); details.append(el('summary', '', account.name + ' · ' + (account.active ? 'Activa' : 'Desactivada') + (app.id === 'gadeos' ? ' · ' + account.completed + '/8 estaciones' : '')));
        const edit = el('form', 'managed-app-form'), name = field(edit, 'Nombre de la cuenta', 'name', account.name), password = field(edit, 'Nueva contraseña (opcional)', 'password'); password.type = 'password'; password.autocomplete = 'new-password'; password.minLength = 8; password.maxLength = 72;
        const label = el('label', 'check-label', 'Cuenta activa'), active = el('input'); active.type = 'checkbox'; active.checked = account.active; label.prepend(active); edit.append(label);
        const saveButton = el('button', 'button secondary', 'Guardar cuenta'); saveButton.type = 'submit'; edit.append(saveButton); details.append(edit);
        edit.addEventListener('submit', async event => { event.preventDefault(); saveButton.disabled = true; try { await api('/api/operacion/admin/app-account-update', 'POST', { app: app.id, id: account.id, revision: account.revision, name: name.value, active: active.checked, ...(password.value ? { password: password.value } : {}) }); password.value = ''; await accounts(app); feedback('Cuenta actualizada. Su progreso se conserva.'); } catch (error) { feedback(error.message, true); } finally { saveButton.disabled = false; } }); host.append(details);
      }
    } catch (error) { host.replaceChildren(el('p', 'form-message', error.message)); }
  }
  async function campaign() {
    const host = document.getElementById('managed-app-content'); host.replaceChildren(el('p', 'muted', 'Cargando recorrido…'));
    try {
      const config = await api('/api/operacion/admin/app-campaign'); host.replaceChildren();
      const form = el('form', 'managed-app-form');
      const title = field(form, 'Título del recorrido', 'title', config.title), intro = field(form, 'Introducción', 'intro', config.intro, true), boss = field(form, 'Nombre del rival final', 'boss', config.boss), ending = field(form, 'Mensaje de la victoria', 'ending', config.ending, true);
      form.append(el('p', 'muted', 'Ocho preguntas, una respuesta correcta por etapa. Las soluciones solo las ve administración. Cambiar una pregunta o imagen conserva el progreso de los tributos.'));
      const entries = [];
      for (const [i, station] of config.stations.entries()) {
        const details = el('details', 'campaign-station'); details.append(el('summary', '', String(i + 1).padStart(2, '0') + ' · ' + station.title)); const fields = el('div', 'managed-app-form');
        const title = field(fields, 'Nombre de la estación', 'title', station.title), story = field(fields, 'Ambientación', 'story', station.story, true);
        const prompt = field(fields, 'Pregunta', 'prompt', station.prompt, true), solution = field(fields, 'Respuesta correcta', 'solution', station.solution || ''), clue = field(fields, 'Pista si falla', 'clue', station.clue), cardTitle = field(fields, 'Nombre de la carta del sobre', 'cardTitle', station.card.title), cardDescription = field(fields, 'Descripción de la carta', 'cardDescription', station.card.description, true);
        prompt.required = true; solution.required = true; solution.maxLength = 100; solution.pattern = '[^|]+';
        const imageLabel = el('label', '', 'Imagen de la carta'), image = el('input'); image.type = 'file'; image.accept = 'image/png,image/jpeg,image/webp'; imageLabel.append(image); fields.append(imageLabel);
        let imageUrl = station.card.image;
        const preview = el('img', 'campaign-card-preview'); preview.alt = 'Vista previa de la carta ' + (i + 1); preview.hidden = true; fields.append(preview);
        if (imageUrl) api('/api/operacion/admin/app-image?name=' + encodeURIComponent(imageUrl.split('/').at(-1))).then(data => { if (preview.isConnected) { preview.src = data.data; preview.hidden = false; } }).catch(() => {});
        image.addEventListener('change', async () => { if (!image.files[0]) return; image.disabled = true; submit.disabled = true; try { const data = await compressedImage(image.files[0]); const uploaded = await api('/api/operacion/admin/app-image', 'POST', { data }); imageUrl = uploaded.url; preview.src = data; preview.hidden = false; feedback('Imagen preparada. Guarda el recorrido para asignarla a la carta.'); } catch (error) { feedback(error.message, true); } finally { image.disabled = false; submit.disabled = false; } });
        entries.push(() => ({ number: i + 1, title: title.value, story: story.value, kind: 'code', prompt: prompt.value,
          options: [], solution: solution.value,
          clue: clue.value, card: { title: cardTitle.value, description: cardDescription.value, image: imageUrl } }));
        details.append(fields); form.append(details);
      }
      const submit = el('button', 'button primary', 'Guardar recorrido y cartas'); submit.type = 'submit'; form.append(submit);
      form.addEventListener('submit', async event => { event.preventDefault(); submit.disabled = true; try { const updated = await api('/api/operacion/admin/app-campaign', 'POST', { revision: config.revision, media: config.media, title: title.value, intro: intro.value, boss: boss.value, ending: ending.value, stations: entries.map(read => read()) }); config.revision = updated.revision; feedback('Recorrido guardado. Se conservan las cuentas y las estaciones completadas.'); } catch (error) { feedback(error.message, true); } finally { submit.disabled = false; } });
      host.append(form);
    } catch (error) { host.replaceChildren(el('p', 'form-message', error.message)); }
  }
  async function compressedImage(file) {
    if (file.size > 10_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Usa una imagen PNG, JPG o WebP de menos de 10 MB.');
    const url = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    const image = new Image(); image.src = url; await image.decode(); const scale = Math.min(1, 720 / image.width, 1000 / image.height), canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); const data = canvas.toDataURL('image/webp', .75);
    if (data.length > 260000) throw new Error('Reduce un poco la imagen para guardarla.'); return data;
  }
  window.addEventListener('hashchange', () => { if (['#apps', '#inicio', ''].includes(location.hash)) load(); });
  window.addEventListener('terrace-admin-changed', load);
  load();
}
