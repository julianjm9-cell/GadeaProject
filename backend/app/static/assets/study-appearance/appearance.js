(() => {
  const root = document.documentElement;
  const app = root.dataset.studyApp;
  const opener = document.querySelector('[data-study-appearance-open]');
  if (!opener) return;

  const looks = [
    {id: 'original', name: 'Estilo original', detail: 'La vista azul de siempre, sin fondo ilustrado.'},
    ...({
      cambridge: [
        {id: 'london', name: 'Club de Londres', detail: 'Verde petróleo, luz suave y un rincón junto al Támesis.'},
        {id: 'library', name: 'Biblioteca británica', detail: 'Burdeos, pergamino y una biblioteca clásica.'},
      ],
      eso_adultos: [
        {id: 'courtyard', name: 'Aula mediterránea', detail: 'Verde oliva, terracota y un patio luminoso.'},
        {id: 'observatory', name: 'Observatorio', detail: 'Índigo, cobre y una sala de estudio bajo las estrellas.'},
      ],
    })[app],
  ];
  const label = document.querySelector('[data-study-look-label]');
  let dialog, form, status, options, submit;
  let savedLook = 'original';
  let loading = true;
  let loadFailed = false;
  let saving = false;

  function apply(look) {
    if (look === 'original') delete root.dataset.studyLook;
    else root.dataset.studyLook = look;
  }

  async function preference(look) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const headers = {'X-Client-App': app};
    try {
      const response = await fetch('/api/study-appearance', {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        ...(look ? {method: 'POST', headers: {...headers, 'Content-Type': 'application/json'}, body: JSON.stringify({look})} : {headers}),
      });
      if (!response.ok) throw new Error('Preferencia no disponible');
      const result = await response.json();
      if (!looks.some(item => item.id === result.look)) throw new Error('Preferencia no válida');
      return result.look;
    } finally {
      clearTimeout(timeout);
    }
  }

  function showSavedLook() {
    apply(savedLook);
    label.textContent = looks.find(look => look.id === savedLook).name;
    if (form) form.elements.look.value = savedLook;
  }

  function showControls() {
    options.disabled = loading || saving;
    submit.disabled = loading || saving || (!loadFailed && form.elements.look.value === savedLook);
    dialog.querySelectorAll('[data-look-close]').forEach(button => { button.disabled = saving; });
  }

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('error', error);
  }

  function createDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'study-look-dialog';
    dialog.setAttribute('aria-labelledby', 'studyLookTitle');
    dialog.innerHTML = `<form>
      <div class="study-look-head"><div><h2 id="studyLookTitle" tabindex="-1">Apariencia</h2><p>Prueba un estilo y guarda el que más te guste.</p></div><button type="button" data-look-close aria-label="Cerrar apariencia">×</button></div>
      <fieldset><legend>Estilo de la aplicación</legend><div class="study-look-options">
      ${looks.map(look => `<label class="study-look-choice">
        <input type="radio" name="look" value="${look.id}" aria-labelledby="look-name-${look.id}" aria-describedby="look-detail-${look.id}">
        <span class="study-look-preview" data-look-preview="${look.id}" aria-hidden="true"><i></i><span><i></i><i></i><i></i></span></span>
        <span class="study-look-copy"><strong id="look-name-${look.id}">${look.name}</strong><small id="look-detail-${look.id}">${look.detail}</small></span>
      </label>`).join('')}
      </div></fieldset>
      <div class="study-look-footer"><p role="status"></p><div><button type="button" data-look-close>Cancelar</button><button type="submit">Guardar estilo</button></div></div>
    </form>`;
    document.body.append(dialog);
    form = dialog.querySelector('form');
    status = dialog.querySelector('[role="status"]');
    options = dialog.querySelector('fieldset');
    submit = dialog.querySelector('[type="submit"]');
    dialog.querySelectorAll('[data-look-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
    dialog.addEventListener('close', () => {
      showSavedLook();
      opener.focus({preventScroll: true});
    });
    form.addEventListener('change', () => {
      apply(form.elements.look.value);
      setStatus('');
      showControls();
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submit.disabled) return;
      saving = true;
      showControls();
      setStatus('Guardando estilo…');
      try {
        savedLook = await preference(form.elements.look.value);
        loadFailed = false;
        dialog.close();
      } catch {
        setStatus('No se pudo guardar el estilo. Puedes volver a intentarlo.', true);
      } finally {
        saving = false;
        showControls();
      }
    });
  }

  opener.addEventListener('click', () => {
    if (!dialog) createDialog();
    showSavedLook();
    showControls();
    setStatus(loading ? 'Cargando tu estilo…' : loadFailed ? 'No se pudo consultar tu estilo guardado.' : '', loadFailed);
    dialog.showModal();
    dialog.querySelector('h2').focus({preventScroll: true});
  });
  opener.hidden = false;
  preference().then(look => { savedLook = look; }).catch(() => { loadFailed = true; }).finally(() => {
    loading = false;
    showSavedLook();
    if (dialog?.open) {
      setStatus(loadFailed ? 'No se pudo consultar tu estilo guardado.' : '', loadFailed);
      showControls();
    }
  });
})();
