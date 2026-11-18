const areas = [['app', 'App'], ['landing', 'Landing'], ['redes', 'Redes sociales']];
const labels = { publica: 'Pública', privada: 'Privada', pausada: 'Pausada' };
export function setupAppCatalog({ api, element: el, button, feedback }) {
  const root = document.getElementById('app-management'), dialog = document.getElementById('app-editor'), body = document.getElementById('app-editor-body');
  let catalog, live = false, saving = false, loading;
  function heading(title) { document.getElementById('app-editor-title').textContent = title; body.replaceChildren(); if (!dialog.open) dialog.showModal(); }
  const field = (form, title, name, value = '', multiline = false) => { const label = el('label', '', title), input = el(multiline ? 'textarea' : 'input'); input.name = name; input.value = value; if (multiline) input.rows = 3; label.append(input); form.append(label); return input; };
  async function load() {
    if (loading) return loading;
    loading = (async () => {
      catalog = await api('/api/apps/catalogo');
      try { catalog = await api('/api/operacion/admin/apps'); live = true; }
      catch { live = false; }
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
    root.replaceChildren();
    const toolbar = el('div', 'app-management-toolbar');
    const create = button('Crear aplicación', newApp); create.className = 'button primary'; create.disabled = !live;
    toolbar.append(el('p', 'muted', live ? 'Los cambios de acceso se aplican en el servidor y conservan las cuentas y el progreso.' : 'Entra en Administración para crear apps y consultar o cambiar su acceso real.'), create);
    if (!live) { const login = el('a', 'button secondary', 'Conectar administración'); login.href = '#control/admin'; toolbar.append(login); }
    root.append(toolbar);
    const grid = el('div', 'managed-app-grid');
    for (const app of catalog.apps) {
      const card = el('article', 'card managed-app'); card.dataset.catalogApp = app.id;
      const top = el('div', 'managed-app-heading'), monogram = el('span', 'managed-app-monogram', app.id === 'gadeos' ? 'G' : app.name.slice(0, 1));
      top.append(monogram, el('h2', '', app.name)); card.append(top);
      const state = el('div', 'app-state-switch'); state.setAttribute('role', 'group'); state.setAttribute('aria-label', 'Acceso de ' + app.name);
      for (const [value, title] of Object.entries(labels)) {
        const toggle = button(title, async () => { if (!live || saving || app.state === value) return; try { await save('app-state', { id: app.id, state: value, revision: catalog.revision }); feedback('Acceso actualizado en el servidor.'); } catch {} });
        toggle.disabled = !live || saving; toggle.setAttribute('aria-pressed', String(app.state === value)); state.append(toggle);
      }
      card.append(state, el('p', 'managed-app-state', live ? ({ publica: 'Visible con sus accesos habituales.', privada: 'Acceso por invitación.', pausada: 'Temporalmente cerrada. Sus datos se conservan.' })[app.state] : 'Acceso del servidor sin consultar.'));
      const actions = el('div', 'managed-app-sections');
      for (const [area, title] of (app.personal ? [['app', 'App']] : areas)) actions.append(button(title + ' →', () => {
        window.dispatchEvent(new CustomEvent('terrace-chat-scope', { detail: { app: app.id, area, name: app.name } })); location.hash = 'chat';
      }));
      card.append(actions);
      const footer = el('div', 'managed-app-footer');
      if (app.path) { const open = el('a', 'text-link', 'Abrir app ↗'); open.href = 'https://educame.tech' + app.path; open.target = '_blank'; open.rel = 'noopener noreferrer'; footer.append(open); }
      if (app.id === 'gadeos') { const manage = button('Tributos y recorrido', () => manageApp(app)); manage.disabled = !live; footer.append(manage); }
      else if (app.template === 'workspace') { const manage = button('Gestionar cuentas', () => manageApp(app)); manage.disabled = !live; footer.append(manage); }
      card.append(footer); grid.append(card);
    }
    root.append(grid);
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
      if (app.id === 'gadeos') tabs.append(button('Editar recorrido y cartas', campaign));
      body.replaceChildren(tabs); const content = el('div'); content.id = 'managed-app-content'; body.append(content); await accounts(app);
    } catch (error) { feedback(error.message, true); }
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
      form.append(el('p', 'muted', 'Los códigos solo los ve administración. Pon en cada sobre la clave que configures aquí. Cambiar una prueba o imagen conserva el progreso de los tributos.'));
      const entries = [];
      for (const [i, station] of config.stations.entries()) {
        const details = el('details', 'campaign-station'); details.append(el('summary', '', String(i + 1).padStart(2, '0') + ' · ' + station.title)); const fields = el('div', 'managed-app-form');
        const title = field(fields, 'Nombre de la estación', 'title', station.title), story = field(fields, 'Ambientación', 'story', station.story, true);
        const kindLabel = el('label', '', 'Tipo de prueba'), kind = el('select'); for (const [value, title] of [['code', 'Código o adivinanza'], ['choice', 'Elegir una opción'], ['order', 'Ordenar los pasos'], ['memory', 'Encontrar parejas']]) { const option = el('option', '', title); option.value = value; kind.append(option); } kind.value = station.kind; kindLabel.append(kind); fields.append(kindLabel);
        const prompt = field(fields, 'Prueba o adivinanza', 'prompt', station.prompt, true), options = field(fields, 'Opciones (una por línea; en parejas repite cada símbolo dos veces)', 'options', station.options.join('\n'), true), solution = field(fields, 'Solución: código, opción exacta u orden correcto (una por línea)', 'solution', Array.isArray(station.solution) ? station.solution.join('\n') : station.solution || '', true), clue = field(fields, 'Pista si falla', 'clue', station.clue), cardTitle = field(fields, 'Nombre de la carta del sobre', 'cardTitle', station.card.title), cardDescription = field(fields, 'Descripción de la carta', 'cardDescription', station.card.description, true);
        const imageLabel = el('label', '', 'Imagen de la carta'), image = el('input'); image.type = 'file'; image.accept = 'image/png,image/jpeg,image/webp'; imageLabel.append(image); fields.append(imageLabel);
        let imageUrl = station.card.image;
        const preview = el('img', 'campaign-card-preview'); preview.alt = 'Vista previa de la carta ' + (i + 1); preview.hidden = true; fields.append(preview);
        if (imageUrl) api('/api/operacion/admin/app-image?name=' + encodeURIComponent(imageUrl.split('/').at(-1))).then(data => { if (preview.isConnected) { preview.src = data.data; preview.hidden = false; } }).catch(() => {});
        image.addEventListener('change', async () => { if (!image.files[0]) return; image.disabled = true; submit.disabled = true; try { const data = await compressedImage(image.files[0]); const uploaded = await api('/api/operacion/admin/app-image', 'POST', { data }); imageUrl = uploaded.url; preview.src = data; preview.hidden = false; feedback('Imagen preparada. Guarda el recorrido para asignarla a la carta.'); } catch (error) { feedback(error.message, true); } finally { image.disabled = false; submit.disabled = false; } });
        const refreshKind = () => { options.parentElement.hidden = kind.value === 'code'; solution.parentElement.hidden = kind.value === 'memory'; }; kind.addEventListener('change', refreshKind); refreshKind();
        entries.push(() => ({ number: i + 1, title: title.value, story: story.value, kind: kind.value, prompt: prompt.value,
          options: options.value.split('\n').map(value => value.trim()).filter(Boolean), solution: kind.value === 'order' ? solution.value.split('\n').map(value => value.trim()).filter(Boolean) : kind.value === 'memory' ? null : solution.value,
          clue: clue.value, card: { title: cardTitle.value, description: cardDescription.value, image: imageUrl } }));
        details.append(fields); form.append(details);
      }
      const submit = el('button', 'button primary', 'Guardar recorrido y cartas'); submit.type = 'submit'; form.append(submit);
      form.addEventListener('submit', async event => { event.preventDefault(); submit.disabled = true; try { const updated = await api('/api/operacion/admin/app-campaign', 'POST', { revision: config.revision, title: title.value, intro: intro.value, boss: boss.value, ending: ending.value, stations: entries.map(read => read()) }); config.revision = updated.revision; feedback('Recorrido guardado. Se conservan las cuentas y las estaciones completadas.'); } catch (error) { feedback(error.message, true); } finally { submit.disabled = false; } });
      host.append(form);
    } catch (error) { host.replaceChildren(el('p', 'form-message', error.message)); }
  }
  async function compressedImage(file) {
    if (file.size > 10_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Usa una imagen PNG, JPG o WebP de menos de 10 MB.');
    const url = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    const image = new Image(); image.src = url; await image.decode(); const scale = Math.min(1, 720 / image.width, 1000 / image.height), canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); const data = canvas.toDataURL('image/webp', .75);
    if (data.length > 260000) throw new Error('Reduce un poco la imagen para guardarla.'); return data;
  }
  window.addEventListener('hashchange', () => { if (location.hash === '#apps') load(); });
  load();
}
