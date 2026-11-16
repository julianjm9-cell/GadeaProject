import { appLogo } from './workspace.js';
import { icon } from './icons.js';

const dates = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });
const fields = [
  ['audience', 'A quién sirve'], ['style', 'Estética'], ['flows', 'Funcionalidades'], ['priorities', 'Prioridades de producto'],
  ['rules', 'Reglas'], ['pitfalls', 'Errores a evitar'], ['verify', 'Comprobaciones'],
];

export function setupMemory({ api, getState, setBoard, element, button, selectOption, feedback, formMessage }) {
  const $ = id => document.getElementById(id);
  const selection = $('memory-app');
  const agentApp = $('agent-app');
  const form = $('memory-form');
  const editor = $('memory-editor');
  const archived = $('memory-archived');
  const review = $('review-form');
  let editing;
  let lastView;
  let contextRequest = 0;
  let importPreview;
  const visible = () => !$('memory-title').closest('[data-page]').hidden;

  function appFor(record) {
    const profiles = getState().projectProfiles;
    if (Object.hasOwn(profiles, record?.app)) return record.app;
    const legacy = /^Proyecto: ([^\r\n]+)/.exec(record?.contexto || '')?.[1].trim();
    return Object.keys(profiles).find(key => profiles[key].name === legacy) || 'ecosistema';
  }

  function resetEditor(rule) {
    editing = rule;
    form.reset();
    formMessage(form);
    editor.querySelector('summary').textContent = rule ? 'Editar criterio' : 'Añadir criterio';
    $('memory-cancel').hidden = !rule;
    if (rule) {
      for (const field of ['tema', 'criterio', 'comprobacion']) form.elements[field].value = rule[field];
      editor.open = true;
      form.elements.criterio.focus();
    }
  }

  function renderAgentHint() {
    if (!getState()) return;
    const scope = agentApp.value || 'ecosistema';
    const count = getState().board.memory.filter(rule => !rule.archived && (rule.app === scope || rule.app === 'ecosistema')).length;
    $('agent-memory-status').textContent = count
      ? `Ficha de la app y selección de ${count} ${count === 1 ? 'criterio disponible' : 'criterios disponibles'}`
      : 'Se adjunta la ficha de la app';
  }

  function render() {
    const { projectProfiles, memoryTopics, board } = getState();
    if (!selection.options.length) {
      const appOptions = () => Object.entries(projectProfiles).map(([key, profile]) => selectOption(key, profile.name));
      selection.append(...appOptions());
      review.elements.app.append(...appOptions());
      $('task-form').elements.app.append(...appOptions());
      for (const select of [form.elements.tema, review.elements.tema]) {
        select.append(...Object.entries(memoryTopics).map(([id, name]) => selectOption(id, name)));
      }
    }
    const view = `${board.revision}/${selection.value}/${archived.checked}`;
    renderAgentHint();
    if (lastView === view) return;
    lastView = view;
    const profile = projectProfiles[selection.value];
    const heading = element('h3', 'icon-label', profile.name);
    heading.prepend(appLogo(selection.value) || icon('apps'));
    const info = fields.map(([key, name]) => {
      const section = element('details', 'memory-detail');
      section.open = key === 'audience';
      section.append(element('summary', '', name), element('p', '', profile[key]));
      return section;
    });
    const references = element('details', 'memory-detail');
    const files = element('ul');
    for (const file of profile.files) {
      const row = element('li');
      row.append(element('code', '', file));
      files.append(row);
    }
    references.append(element('summary', '', 'Referencias del proyecto'), files);
    $('memory-profile').replaceChildren(heading, ...info, references);

    const rules = board.memory.filter(rule => rule.app === selection.value && (archived.checked || !rule.archived))
      .sort((left, right) => Number(left.archived) - Number(right.archived) || right.updatedAt.localeCompare(left.updatedAt));
    $('memory-rules').replaceChildren(...(rules.length ? rules.map(rule => {
      const item = element('details', 'memory-detail memory-rule');
      const heading = element('summary', '', rule.criterio);
      const meta = element('p', 'muted', [memoryTopics[rule.tema], rule.archived ? 'Archivado' : 'Confirmado',
        rule.source ? 'Desde una entrega' : '', dates.format(new Date(rule.updatedAt))].filter(Boolean).join(' · '));
      const check = element('p', '');
      check.append(element('strong', '', 'Cómo comprobarlo'), document.createTextNode(' ' + rule.comprobacion));
      const actions = element('div', 'actions');
      const archive = button(rule.archived ? 'Reactivar' : 'Archivar', async () => {
        archive.disabled = true;
        try {
          await save({ id: rule.id, archived: !rule.archived });
          feedback(rule.archived ? 'Criterio reactivado.' : 'Criterio archivado.');
        } catch (error) {
          feedback(error.message, true);
          archive.disabled = false;
        }
      });
      actions.append(button('Editar', () => resetEditor(rule)), archive);
      item.append(heading, meta, check, actions);
      return item;
    }) : [element('p', 'empty', 'Todavía no hay criterios para esta app.')]));
    if (visible()) loadContext();
  }

  async function loadContext() {
    if (!getState() || !selection.value) return;
    const request = ++contextRequest, app = selection.value;
    $('memory-refresh').disabled = true;
    try {
      const data = await api('/api/memoria/contexto?app=' + encodeURIComponent(app));
      if (request !== contextRequest || selection.value !== app) return;
      const { context } = data;
      $('memory-context-status').textContent = context.revision ?
        'Revisión local ' + context.revision.slice(0, 8) + ' · ' + context.inventory.files + ' archivos · ' + context.inventory.illustrations + ' imágenes e iconos.' :
        'No se pudo leer Git. La ficha de producto y tus criterios siguen disponibles.';
      const facts = $('memory-context-facts');
      facts.replaceChildren(element('p', 'inline-hint', context.versionNote));
      if (context.accepted.length) {
        const details = element('details', 'memory-detail');
        details.append(element('summary', '', 'Últimos cambios aceptados en GitHub'));
        for (const fact of context.accepted) details.append(element('p', '', fact.summary), element('small', 'muted', fact.commit.slice(0, 8) + ' · ' + fact.checks + ' comprobaciones registradas'));
        facts.append(details);
      } else facts.append(element('p', 'muted', 'Los próximos cambios subidos desde LA TERRAZA aparecerán aquí con su procedencia.'));
      const suggestions = $('memory-suggestions');
      suggestions.replaceChildren();
      if (data.suggestions.length) suggestions.append(element('h3', '', 'Aprendizajes por confirmar'));
      for (const fact of data.suggestions) {
        const row = element('article', 'memory-suggestion');
        row.append(element('small', 'muted', getState().projectProfiles[fact.app]?.name + ' · ' + fact.commit.slice(0, 8)),
          element('p', '', fact.proposal.criterio), element('p', 'muted', 'Comprobar: ' + fact.proposal.comprobacion));
        const actions = element('div', 'actions');
        for (const [action, title] of [['accept', 'Guardar como criterio'], ['dismiss', 'Descartar propuesta']]) {
          actions.append(button(title, async () => {
            actions.querySelectorAll('button').forEach(node => { node.disabled = true; });
            try {
              setBoard(await api('/api/memoria/aprendizaje', 'POST', { id: fact.id, action, revision: data.revision }));
              feedback(action === 'accept' ? 'Aprendizaje confirmado para los próximos encargos.' : 'Propuesta descartada.');
              await loadContext();
            } catch (error) { feedback(error.message, true); await loadContext(); }
            finally { actions.querySelectorAll('button').forEach(node => { node.disabled = false; }); }
          }));
        }
        row.append(actions); suggestions.append(row);
      }
    } catch (error) { if (request === contextRequest) $('memory-context-status').textContent = error.message; }
    finally { if (request === contextRequest) $('memory-refresh').disabled = false; }
  }
  $('memory-refresh').addEventListener('click', loadContext);
  window.addEventListener('hashchange', () => { if (visible()) loadContext(); });

  function transferError(message = '') {
    $('memory-transfer-error').textContent = message;
    $('memory-transfer-error').hidden = !message;
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a'); link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  for (const [id, markdown, scoped] of [['memory-export', false, false], ['memory-export-app', false, true], ['memory-markdown', true, true]]) {
    $(id).addEventListener('click', async () => {
      $(id).disabled = true; transferError();
      try {
        const data = await api('/api/memoria/exportar' + (scoped ? '?' + (markdown ? 'format=md&' : '') + 'app=' + encodeURIComponent(selection.value) : ''));
        download(markdown ? data.filename : scoped ? 'educame-memoria-' + selection.value + '.json' : 'educame-memoria.json', markdown ? data.text : JSON.stringify(data, null, 2), markdown ? 'text/markdown' : 'application/json');
      } catch (error) { transferError(error.message); }
      finally { $(id).disabled = false; }
    });
  }
  $('memory-import').addEventListener('change', async () => {
    importPreview = null; $('memory-import-apply').hidden = true; $('memory-import-preview').replaceChildren(); transferError();
    const file = $('memory-import').files[0];
    if (!file) return;
    try {
      if (file.size > 280000) throw new Error('El archivo es demasiado grande. Exporta una app cada vez.');
      const bundle = JSON.parse(await file.text());
      const result = await api('/api/memoria/importar/preparar', 'POST', { bundle });
      importPreview = result;
      const preview = $('memory-import-preview');
      preview.append(element('p', '', result.rulesAdded + ' criterios y ' + result.agentsAdded + ' perfiles nuevos. Se conserva todo lo actual.'));
      if (result.conflicts.length) {
        const conflicts = element('ul');
        for (const text of result.conflicts) conflicts.append(element('li', '', text));
        preview.append(conflicts);
      }
      const details = element('details', 'memory-detail');
      details.append(element('summary', '', 'Revisar los criterios del archivo'));
      for (const rule of result.rules) details.append(element('p', '', getState().projectProfiles[rule.app].name + ' · ' + rule.criterio));
      preview.append(details);
      $('memory-import-apply').hidden = !(result.rulesAdded || result.agentsAdded);
    } catch (error) { transferError(error instanceof SyntaxError ? 'El archivo no contiene un JSON válido.' : error.message); }
  });
  $('memory-import-apply').addEventListener('click', async () => {
    if (!importPreview) return;
    $('memory-import-apply').disabled = true; transferError();
    try {
      setBoard(await api('/api/memoria/importar/aplicar', 'POST', { id: importPreview.id, revision: importPreview.revision }));
      importPreview = null; $('memory-import-apply').hidden = true;
      $('memory-import-preview').replaceChildren(element('p', '', 'Memoria importada. Los próximos encargos usarán estos criterios y perfiles.'));
      $('memory-import').value = ''; await loadContext();
    } catch (error) { transferError(error.message); $('memory-import').value = ''; importPreview = null; $('memory-import-apply').hidden = true; }
    finally { $('memory-import-apply').disabled = false; }
  });

  async function save(rule) {
    setBoard(await api('/api/memoria', 'POST', { revision: getState().board.revision, rule }));
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    formMessage(form);
    try {
      const rule = { ...Object.fromEntries(new FormData(form)), app: selection.value, id: editing?.id };
      await save(rule);
      resetEditor();
      editor.open = false;
      feedback('Criterio guardado en Memoria.');
    } catch (error) {
      formMessage(form, error.message);
    } finally {
      submit.disabled = false;
    }
  });
  $('memory-cancel').addEventListener('click', () => { resetEditor(); editor.open = false; });
  selection.addEventListener('change', () => { resetEditor(); render(); });
  archived.addEventListener('change', render);
  agentApp.addEventListener('change', renderAgentHint);
  $('agent-memory-link').addEventListener('click', () => {
    if (!getState()) return;
    selection.value = agentApp.value;
    resetEditor();
    render();
  });

  function prepareReview(delivery) {
    const saved = getState().board.memory.find(rule => rule.source === delivery.key);
    const proposal = delivery.draft?.aprendizaje;
    const details = $('review-memory');
    const use = $('review-memory-suggest');
    const existing = $('review-memory-existing');
    details.open = false;
    use.hidden = !proposal;
    existing.hidden = !saved;
    existing.textContent = saved?.archived ? 'Hay un criterio archivado de esta entrega.' : 'Esta entrega ya tiene un criterio guardado en Memoria.';
    review.elements.learn.checked = false;
    review.elements.app.value = saved?.app || appFor(delivery);
    for (const field of ['tema', 'criterio', 'comprobacion']) {
      review.elements[field].value = saved?.[field] || (field === 'tema' ? 'reglas' : '');
    }
    use.onclick = proposal ? () => {
      for (const field of ['tema', 'criterio', 'comprobacion']) review.elements[field].value = proposal[field];
      review.elements.learn.checked = true;
      review.elements.criterio.focus();
    } : null;
  }

  function contextDetails(context) {
    const details = element('details', 'memory-detail memory-snapshot');
    const title = element('summary', '', 'Contexto usado en este encargo');
    details.append(title, element('p', '', context.profile.name));
    for (const [key, label] of fields) {
      if (!context.profile[key]) continue;
      const row = element('p');
      row.append(element('strong', '', label), document.createTextNode(' · ' + context.profile[key]));
      details.append(row);
    }
    if (context.confirmed.length) {
      const list = element('ul');
      for (const rule of context.confirmed) list.append(element('li', '', rule.criterio + ' · ' + rule.comprobacion));
      details.append(element('strong', '', 'Criterios enviados con el encargo'), list);
    } else details.append(element('p', 'muted', 'Este encargo utilizó la ficha de producto.'));
    if (context.evidence) {
      details.append(element('p', 'muted', 'Código de referencia: ' + (context.evidence.revision?.slice(0, 8) || 'No disponible')));
      for (const fact of context.evidence.accepted || []) details.append(element('p', '', fact.summary + ' · ' + fact.commit.slice(0, 8)));
    }
    return details;
  }

  return {
    render, renderAgentHint, prepareReview, contextDetails, appFor,
    reviewRule() {
      if (!review.elements.learn.checked) return undefined;
      return Object.fromEntries(['app', 'tema', 'criterio', 'comprobacion'].map(field => [field, review.elements[field].value]));
    },
  };
}
