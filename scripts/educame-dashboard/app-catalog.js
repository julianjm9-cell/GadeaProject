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
      error?.status && error.status !== 401 ? error.message : 'Conecta administración para crear apps y editar su contenido. Usuarios y accesos están en el dashboard online.';
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
    toolbar.append(el('p', 'muted', live ? 'Edición conectada. Las cuentas y los accesos se gestionan en el dashboard online.' : connectionMessage(connectionIssue)), create);
    if (!live) toolbar.append(button('Conectar administración', () => connect('Gestionar tus aplicaciones', async () => {})));
    root.append(toolbar);
    const grid = el('div', 'managed-app-grid');
    for (const app of catalog.apps) {
      const card = el('article', 'card managed-app'); card.dataset.catalogApp = app.id;
      const top = el('div', 'managed-app-heading'), monogram = el('span', 'managed-app-monogram', app.id === 'gadeos' ? 'G' : app.name.slice(0, 1));
      top.append(monogram, el('h2', '', app.name)); card.append(top);
      card.append(el('p', 'managed-app-state', (live ? labels[app.state] : 'Estado del servidor sin consultar') + ' · Usuarios y accesos en el dashboard online.'));
      const actions = el('div', 'managed-app-sections');
      for (const [area, title] of (app.personal ? [['app', 'App']] : areas)) actions.append(button(title + ' →', () => {
        window.dispatchEvent(new CustomEvent('terrace-chat-scope', { detail: { app: app.id, area, name: app.name } })); location.hash = 'chat';
      }));
      card.append(actions);
      const footer = el('div', 'managed-app-footer');
      if (app.path) { const open = el('a', 'text-link', 'Abrir app ↗'); open.href = 'https://educame.tech' + app.path; open.target = '_blank'; open.rel = 'noopener noreferrer'; footer.append(open); }
      if (app.id === 'gadeos') footer.append(button('Editar contenido', () => connectedAction('Editar GADEOS', () => manageApp(app))));
      const admin = el('a', 'text-link', 'Gestionar usuarios ↗');
      const target = ['arena', 'workspace'].includes(app.template) ? 'app/' + app.id : ({ ingles: 'cambridge', facturas: 'ocr' })[app.id] || app.id;
      admin.href = 'https://educame.tech/admin-dashboard/#' + target; admin.target = '_blank'; admin.rel = 'noopener noreferrer'; footer.append(admin);
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
    form.addEventListener('submit', async event => { event.preventDefault(); if (saving) return; submit.disabled = true; try { await save('create-app', { name: name.value, id: id.value, state: 'privada', revision: catalog.revision }); dialog.close(); feedback('Aplicación creada. Pide cambios en App y gestiona sus usuarios en el dashboard online.'); } catch {} finally { submit.disabled = false; } });
    body.append(form);
  }
  async function manageApp(app) {
    heading(app.name); body.append(el('p', 'muted', 'Cargando…'));
    try {
      const tabs = el('div', 'actions');
      if (app.id === 'gadeos') tabs.append(button('Editar recorrido y cartas', campaign), button('Imágenes', materials));
      body.replaceChildren(tabs); const content = el('div'); content.id = 'managed-app-content'; body.append(content); await campaign();
    } catch (error) { feedback(error.message, true); }
  }
  async function materials() {
    const host = document.getElementById('managed-app-content'); host.replaceChildren(el('p', 'muted', 'Consultando materiales privados…'));
    try {
      const data = await api('/api/operacion/admin/app-materials'); host.replaceChildren(el('h3', '', 'Imágenes de GADEOS'));
      const config = await api('/api/operacion/admin/app-campaign');
      mediaEditor(host, config);
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
  function mediaEditor(host, config) {
    const form = el('form', 'managed-app-form'), media = structuredClone(config.media || { poster: null, envelope: null, guide: [], source: '' });
    const submit = el('button', 'button primary', 'Guardar imágenes'); submit.type = 'submit';
    let uploads = 0, changed = false;
    form.append(el('p', 'muted', 'Elige el cartel de Inicio, el paisaje de Recorrido y el diseño de los sobres. Las imágenes de cada carta se editan en su etapa.'));
    for (const [key, title, original] of [['poster', 'Cartel de Inicio', media.poster], ['cover', 'Imagen de Recorrido', media.guide[0]?.image], ['envelope', 'Diseño del sobre', media.envelope]]) {
      const label = el('label', '', title), image = el('input'); image.type = 'file'; image.accept = 'image/png,image/jpeg,image/webp'; label.append(image); form.append(label);
      const preview = el('img', 'campaign-card-preview'); preview.alt = title; preview.hidden = true; form.append(preview);
      if (original) api('/api/operacion/admin/app-image?name=' + encodeURIComponent(original.split('/').at(-1))).then(data => { if (preview.isConnected && !image.files.length) { preview.src = data.data; preview.hidden = false; } }).catch(() => {});
      image.addEventListener('change', async () => {
        if (!image.files[0]) return; uploads++; image.disabled = submit.disabled = true;
        try {
          const data = await compressedImage(image.files[0]), uploaded = await api('/api/operacion/admin/app-image', 'POST', { data });
          if (key === 'cover') media.guide[0] = { ...(media.guide[0] || { title: 'Portada de la colección', text: '' }), image: uploaded.url };
          else media[key] = uploaded.url;
          media.source = ''; changed = true; preview.src = data; preview.hidden = false; feedback('Imagen preparada. Pulsa Guardar imágenes para aplicarla.');
        } catch (error) { feedback(error.message, true); }
        finally { uploads--; image.disabled = false; submit.disabled = uploads > 0; }
      });
    }
    form.append(submit); host.append(form);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (uploads || submit.disabled) return;
      if (!changed) { feedback('Elige una imagen para cambiarla.'); return; }
      submit.disabled = true;
      try { const saved = await api('/api/operacion/admin/app-campaign', 'POST', { ...config, media }); config.revision = saved.revision; config.media = saved.media; changed = false; feedback('Imágenes guardadas. El progreso se conserva.'); }
      catch (error) { feedback(error.message, true); }
      finally { submit.disabled = false; }
    });
  }
  async function campaign() {
    const host = document.getElementById('managed-app-content'); host.replaceChildren(el('p', 'muted', 'Cargando recorrido…'));
    try {
      const config = await api('/api/operacion/admin/app-campaign'); host.replaceChildren();
      const form = el('form', 'managed-app-form');
      const title = field(form, 'Título del recorrido', 'title', config.title), intro = field(form, 'Introducción', 'intro', config.intro, true), boss = field(form, 'Nombre del rival final', 'boss', config.boss), ending = field(form, 'Mensaje de la victoria', 'ending', config.ending, true);
      const schedule = config.planning || { day: 'Viernes', place: 'Chinchón', start: '16:00', final: '22:00' };
      const day = field(form, 'Día del viaje', 'day', schedule.day), place = field(form, 'Lugar del viaje', 'place', schedule.place), start = field(form, 'Hora de inicio', 'start', schedule.start), final = field(form, 'Hora de la batalla', 'final', schedule.final);
      day.required = place.required = start.required = final.required = true; day.maxLength = place.maxLength = 80; start.type = final.type = 'time';
      const itinerary = el('details', 'campaign-itinerary'); itinerary.append(el('summary', '', 'Planning por días'));
      const itineraryFields = el('div', 'managed-app-form');
      const transport = field(itineraryFields, 'Transporte', 'transport', schedule.transport || '', true); transport.maxLength = 300;
      const itineraryDays = el('div', 'managed-app-form'), dayReaders = []; itineraryFields.append(itineraryDays);
      function addDay(value = { title: 'Nuevo día', subtitle: 'Plan del día', activities: [{time:'12:00',text:''}] }) {
        const box = el('fieldset', 'campaign-day'); box.append(el('legend', '', 'Día del planning'));
        const name = field(box, 'Nombre del día', 'dayTitle', value.title), subtitle = field(box, 'Plan del día', 'daySubtitle', value.subtitle);
        name.required = subtitle.required = true; name.maxLength = subtitle.maxLength = 120;
        const dayLockLabel = el('label', 'check-label', 'Bloquear este día'), dayLock = el('input'); dayLock.type = 'checkbox'; dayLock.checked = Boolean(value.locked); dayLock.disabled = schedule.version !== 2; dayLockLabel.append(dayLock); box.append(dayLockLabel);
        const activities = el('div', 'managed-app-form'), readers = []; box.append(activities);
        function addActivity(entry = {time:'12:00',text:''}) {
          const row = el('div', 'managed-app-form');
          const time = field(row, 'Hora o intervalo', 'activityTime', entry.time), text = field(row, 'Actividad', 'activityText', entry.text, true);
          const activityLockLabel = el('label', 'check-label', 'Bloquear actividad'), activityLock = el('input'); activityLock.type = 'checkbox'; activityLock.checked = Boolean(entry.locked); activityLock.disabled = schedule.version !== 2; activityLockLabel.append(activityLock); row.append(activityLockLabel);
          const applyLock = () => { time.required = text.required = !activityLock.checked; }; activityLock.addEventListener('change', applyLock); applyLock(); time.placeholder = '19:20–19:45'; time.maxLength = 11; text.maxLength = 500;
          const remove = el('button', 'button', 'Quitar actividad'); remove.type = 'button'; remove.addEventListener('click', () => row.remove()); row.append(remove); activities.append(row);
          readers.push(() => row.isConnected ? {time:time.value,text:text.value,locked:activityLock.checked} : null);
        }
        for (const activity of value.activities || []) addActivity(activity);
        const add = el('button', 'button', 'Añadir actividad'); add.type = 'button'; add.addEventListener('click', () => addActivity());
        const remove = el('button', 'button', 'Quitar día'); remove.type = 'button'; remove.addEventListener('click', () => box.remove()); box.append(add, remove); itineraryDays.append(box);
        dayReaders.push(() => box.isConnected ? {title:name.value,subtitle:subtitle.value,locked:dayLock.checked,activities:readers.map(read => read()).filter(Boolean)} : null);
      }
      for (const value of schedule.days || []) addDay(value);
      const addDayButton = el('button', 'button', 'Añadir día'); addDayButton.type = 'button'; addDayButton.addEventListener('click', () => addDay()); itineraryFields.append(addDayButton); itinerary.append(itineraryFields); form.append(itinerary);
      if (Array.isArray(schedule.days) && schedule.version !== 2) itineraryFields.append(el('p', 'form-message', 'Actualiza Hostinger para activar los bloqueos del planning.'));
      if (!Array.isArray(schedule.days)) { transport.disabled = addDayButton.disabled = true; itineraryFields.append(el('p', 'form-message', 'Actualiza Hostinger para editar el planning por días. Se conserva el planning actual.')); }
      form.append(el('p', 'muted', 'Diez pruebas. Las dos últimas quedan pendientes hasta que guardes su pista y respuesta. El progreso de los tributos se conserva.'));
      const cards = el('details', 'campaign-cards'); cards.append(el('summary', '', 'Cartas de recompensa'));
      let imageUploads = 0;
      const entries = [];
      for (const [i, station] of config.stations.entries()) {
        const details = el('details', 'campaign-station'); details.append(el('summary', '', String(i + 1).padStart(2, '0') + ' · ' + (station.title || 'Pendiente'))); const fields = el('div', 'managed-app-form');
        const title = field(fields, 'Título / pista', 'title', station.title, true), solution = field(fields, 'Respuesta correcta', 'solution', station.solution || '');
        title.required = i < 8; title.maxLength = 1500; solution.required = i < 8; solution.maxLength = 100; solution.pattern = '[^|]+';
        title.addEventListener('input', () => { details.querySelector('summary').textContent = String(i + 1).padStart(2, '0') + ' · ' + (title.value || 'Prueba sin título'); });
        const cardFields = el('div', 'managed-app-form'); cardFields.append(el('h4', '', 'Sobre ' + (i + 1)));
        const cardTitle = field(cardFields, 'Nombre de la carta del sobre', 'cardTitle', station.card.title), cardDescription = field(cardFields, 'Descripción de la carta', 'cardDescription', station.card.description, true);
        const imageLabel = el('label', '', 'Imagen de la carta'), image = el('input'); image.type = 'file'; image.accept = 'image/png,image/jpeg,image/webp'; imageLabel.append(image); cardFields.append(imageLabel);
        let imageUrl = station.card.image;
        const preview = el('img', 'campaign-card-preview'); preview.alt = 'Vista previa de la carta ' + (i + 1); preview.hidden = true; cardFields.append(preview); cards.append(cardFields);
        if (imageUrl) api('/api/operacion/admin/app-image?name=' + encodeURIComponent(imageUrl.split('/').at(-1))).then(data => { if (preview.isConnected) { preview.src = data.data; preview.hidden = false; } }).catch(() => {});
        image.addEventListener('change', async () => { if (!image.files[0]) return; image.disabled = true; imageUploads++; submit.disabled = true; try { const data = await compressedImage(image.files[0]); const uploaded = await api('/api/operacion/admin/app-image', 'POST', { data }); imageUrl = uploaded.url; preview.src = data; preview.hidden = false; feedback('Imagen preparada. Guarda el recorrido para asignarla a la carta.'); } catch (error) { feedback(error.message, true); } finally { image.disabled = false; imageUploads--; submit.disabled = imageUploads > 0 || config.stations.length !== 10; } });
        entries.push(() => ({ ...station, number: i + 1, title: title.value, kind: 'code', prompt: title.value,
          options: [], solution: solution.value,
          card: { title: cardTitle.value, description: cardDescription.value, image: imageUrl } }));
        details.append(fields); form.append(details);
      }
      form.append(cards);
      const submit = el('button', 'button primary', 'Guardar recorrido y cartas'); submit.type = 'submit'; form.append(submit);
      if (config.stations.length !== 10) { submit.disabled = true; form.append(el('p', 'form-message', 'Actualiza Hostinger para activar el recorrido de diez pruebas.')); }
      form.addEventListener('submit', async event => { event.preventDefault(); if (submit.disabled) return; submit.disabled = true; try { const updated = await api('/api/operacion/admin/app-campaign', 'POST', { revision: config.revision, media: config.media, planning: { ...schedule, day: day.value, place: place.value, start: start.value, final: final.value, ...(schedule.days || dayReaders.length ? {transport:transport.value,days:dayReaders.map(read => read()).filter(Boolean)} : {}) }, title: title.value, intro: intro.value, boss: boss.value, ending: ending.value, stations: entries.map(read => read()) }); config.revision = updated.revision; feedback('Recorrido guardado. Se conservan las cuentas y las estaciones completadas.'); } catch (error) { feedback(error.message, true); } finally { submit.disabled = false; } });
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
