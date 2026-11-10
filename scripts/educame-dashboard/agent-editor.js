const $ = id => document.getElementById(id);
const specialCapabilities = {
  juegos: 'Puedes pedir un pack de hasta diez juegos.',
  revision: 'Puede revisar la entrega de otro agente del lote.',
};

export function setupAgentEditor({ api, button, formMessage, getState, apply, prepare }) {
  const dialog = $('agent-editor');
  const form = $('agent-profile-form');
  const { elements: fields } = form;
  const open = $('open-agent-editor');
  const close = $('close-agent-editor');
  const restore = $('restore-agent');
  const use = $('use-agent');
  const save = $('save-agent');
  const create = $('create-agent');
  const list = $('agent-editor-list');
  const status = $('agent-profile-message');
  let selected;
  let revision;
  let initial;
  let saving = false;

  const values = () => Object.fromEntries(new FormData(form));
  const canLeave = () => !saving && (initial === JSON.stringify(values()) || window.confirm('¿Descartar los cambios sin guardar de este agente?'));

  function show(id = '') {
    selected = id;
    const { agentEditor, board } = getState();
    const { profiles, template, researchInstructions, customAgentLimit } = agentEditor;
    const profile = profiles.find(item => item.id === id);
    const research = id === 'copiador';
    const kind = profile?.builtIn ? 'Agente de Educame' : 'Agente personalizado';
    revision = board.revision;
    list.replaceChildren(...profiles.map(item => {
      const row = button(item.name, () => {
        if (item.id === selected || !canLeave()) return;
        show(item.id);
        list.querySelector('[aria-pressed="true"]').focus();
      });
      row.setAttribute('aria-pressed', String(id === item.id));
      return row;
    }));
    create.disabled = profiles.filter(item => !item.builtIn).length >= customAgentLimit;
    $('agent-profile-title').textContent = profile?.name || 'Nuevo agente';
    $('agent-profile-kind').textContent = kind;
    for (const key of ['name', 'description', 'draft', 'implementation', 'team']) {
      fields[key].value = (profile || template)[key] || '';
    }
    $('agent-profile-draft-label').textContent = research ? 'Instrucciones adicionales de investigación (opcional)' : 'Instrucciones para borradores';
    $('agent-profile-implement').hidden = $('agent-profile-team').hidden = research;
    fields.implementation.disabled = fields.team.disabled = research;
    fields.implementation.required = fields.draft.required = !research;
    const rules = $('agent-profile-research');
    rules.hidden = !research;
    rules.open = false;
    rules.querySelector('p').textContent = research ? researchInstructions : '';
    $('agent-profile-scope').textContent = research ? 'Analiza fuentes públicas. Las reglas base y el formato de investigación se aplican a cada encargo.' :
      [specialCapabilities[id], 'Usa el contexto de la app elegida. Codex implementa en una copia Git aislada y la entrega pasa por revisión antes de subirla.']
        .filter(Boolean).join(' ');
    restore.hidden = !profile?.modified;
    use.hidden = !profile;
    save.textContent = profile ? 'Guardar cambios' : 'Crear agente';
    status.textContent = '';
    formMessage(form);
    initial = JSON.stringify(values());
  }

  async function submit(action) {
    if (saving) return;
    saving = true;
    save.disabled = close.disabled = restore.disabled = use.disabled = true;
    const profile = values();
    formMessage(form);
    status.textContent = '';
    try {
      const result = await api('/api/agentes', 'PUT', { revision, action, id: selected, profile });
      apply(result);
      show(action === 'create' ? result.agentEditor.profiles.at(-1).id : selected);
      status.textContent = action === 'create' ? 'Agente creado. Ya puedes preparar su primer encargo.' :
        action === 'restore' ? 'Valores originales restaurados.' : 'Cambios guardados para los próximos encargos.';
    } catch (error) {
      formMessage(form, error.message);
    } finally { saving = false; save.disabled = close.disabled = restore.disabled = use.disabled = false; }
  }
  open.addEventListener('click', () => {
    const { profiles } = getState().agentEditor;
    show(profiles.some(item => item.id === selected) ? selected : profiles[0].id);
    dialog.showModal();
    close.focus();
  });
  close.addEventListener('click', () => { if (canLeave()) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (!canLeave()) event.preventDefault(); });
  create.addEventListener('click', () => {
    if (!canLeave()) return;
    show();
    fields.name.focus();
  });
  restore.addEventListener('click', () => {
    if (window.confirm('¿Recuperar los valores originales de este agente?')) submit('restore');
  });
  use.addEventListener('click', () => {
    if (!canLeave()) return;
    dialog.close();
    prepare(selected);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    submit(selected ? 'edit' : 'create');
  });
  return { ready() { open.disabled = false; } };
}
