import { icon } from './icons.js';
import { appLogo } from './workspace.js';

const dates = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
const short = sha => sha.slice(0, 8);
const fileStatus = {
  '?': 'Nuevo', A: 'Añadido', D: 'Eliminado', M: 'Modificado', T: 'Cambio de tipo', U: 'Conflicto',
};

export function setupChanges({ api, element }) {
  const $ = id => document.getElementById(id);
  const app = $('changes-app');
  const source = $('changes-source');
  const preview = $('changes-preview');
  const entries = $('changes-entries');
  const status = $('changes-status');
  const sync = $('changes-sync');
  const deploy = $('changes-deploy');
  const dialog = $('changes-command-dialog');
  let data;
  let page = 1;
  let loadId = 0;

  function feedback(message, error = false) {
    status.textContent = message;
    status.classList.toggle('error-text', error);
  }

  function previews() {
    const product = data?.products.find(item => item.key === preview.value);
    const logoTile = $('changes-preview-logo');
    const logo = appLogo(product?.key);
    logoTile.hidden = !logo;
    logoTile.replaceChildren(...(logo ? [logo] : []));
    for (const type of ['app', 'landing']) {
      const link = $('changes-open-' + type);
      link.hidden = !product?.[type];
      if (product?.[type]) link.href = `/vista-local/${product.key}/${type}`;
    }
  }

  function render() {
    const { products, local, commits, branch, head, upstream, syncedAt, ahead, behind, more, repository } = data;
    if (!preview.options.length) {
      products.forEach(product => {
        app.add(new Option(product.name, product.key));
        if (product.app || product.landing) preview.add(new Option(product.name, product.key));
      });
    }
    previews();

    const branchBadge = $('changes-branch');
    branchBadge.hidden = !head;
    branchBadge.textContent = branch || short(head);
    const dirty = $('changes-dirty');
    dirty.hidden = !local.count;
    dirty.querySelector('summary').textContent = `${local.count} ${local.count === 1 ? 'archivo local sin commit' : 'archivos locales sin commit'}`;
    dirty.querySelector('ul').replaceChildren(...local.files.map(item => {
      const row = element('li', '', item.file);
      const code = item.status.includes('U') ? 'U' : item.status.trim().at(-1);
      row.append(element('span', 'muted', fileStatus[code] || item.status.trim()));
      return row;
    }));
    const remaining = dirty.querySelector('p');
    remaining.hidden = local.count <= local.files.length;
    remaining.textContent = `Mostrando ${local.files.length} de ${local.count} archivos.`;

    const repo = $('changes-repo');
    repo.hidden = !repository;
    if (repository) repo.href = repository;
    $('changes-release').textContent = upstream
      ? `Revisión de GitHub ${short(upstream)} · main`
      : 'Sin referencia de GitHub. Sincroniza para consultar main.';
    const differences = [];
    if (local.total) differences.push(`${local.total} ${local.total === 1 ? 'archivo local sin commit' : 'archivos locales sin commit'}`);
    if (ahead) differences.push(`${ahead} ${ahead === 1 ? 'commit solo en local' : 'commits solo en local'}`);
    if (behind) differences.push(`${behind} ${behind === 1 ? 'commit de GitHub pendiente' : 'commits de GitHub pendientes'} en local`);
    $('changes-divergence').textContent = differences.length
      ? `La vista local y el despliegue pueden diferir. ${differences.join(' · ')}.`
      : upstream && head === upstream ? 'La revisión local coincide con main de GitHub.' : '';
    deploy.disabled = !upstream;
    feedback(syncedAt ? `GitHub consultado el ${dates.format(new Date(syncedAt))}.` : 'Mostrando la última referencia de GitHub disponible en este equipo.');

    const names = new Map(products.map(item => [item.key, item.name]));
    names.set('shared', 'Compartido');
    const rows = commits.map(commit => {
      const entry = element('article', 'changes-entry');
      const heading = element('div', 'changes-entry-heading');
      heading.append(element('h3', '', commit.subject || '(Sin título)'), element('span', `badge ${commit.online ? 'ready' : 'pending'}`, commit.online ? 'En GitHub' : 'Solo local'));
      const meta = element('div', 'changes-entry-meta');
      const time = element('time', 'muted', dates.format(new Date(commit.date)));
      time.dateTime = commit.date;
      meta.append(element('code', '', short(commit.sha)), time);
      for (const key of commit.scopes) {
        const tag = element('span', 'changes-tag', names.get(key));
        const logo = appLogo(key);
        if (logo) tag.prepend(logo);
        meta.append(tag);
      }
      if (commit.url) {
        const link = element('a', 'text-link icon-label', 'Ver en GitHub');
        link.prepend(icon('github'));
        link.href = commit.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        meta.append(link);
      }
      entry.append(heading, meta);
      if (commit.fileCount) {
        const details = element('details');
        const list = element('ul', 'changes-files');
        list.append(...commit.files.map(file => element('li', '', file)));
        if (commit.fileCount > commit.files.length) list.append(element('li', 'muted', `y ${commit.fileCount - commit.files.length} más`));
        details.append(element('summary', '', `${commit.fileCount} ${commit.fileCount === 1 ? 'archivo' : 'archivos'}`), list);
        entry.append(details);
      }
      return entry;
    });
    entries.replaceChildren(...(rows.length ? rows : [element('p', 'muted', 'No hay commits con estos filtros.')]));
    $('changes-pagination').hidden = page === 1 && !more;
    $('changes-prev').disabled = page === 1;
    $('changes-next').disabled = !more;
    $('changes-page').textContent = `Página ${page}`;
  }

  async function load() {
    const request = ++loadId;
    entries.setAttribute('aria-busy', 'true');
    feedback('Leyendo el historial…');
    try {
      const next = await api('/api/cambios?' + new URLSearchParams({ app: app.value, source: source.value, page }));
      if (request === loadId) {
        data = next;
        render();
      }
    } catch (error) {
      if (request === loadId) feedback(error.message, true);
    } finally {
      if (request === loadId) entries.setAttribute('aria-busy', 'false');
    }
  }

  [app, source].forEach(control => control.addEventListener('change', () => {
    if (control === app && [...preview.options].some(option => option.value === app.value)) {
      preview.value = app.value;
      previews();
    }
    page = 1;
    load();
  }));
  preview.addEventListener('change', previews);
  $('changes-prev').addEventListener('click', () => { if (page > 1) { page--; load(); } });
  $('changes-next').addEventListener('click', () => { if (data?.more) { page++; load(); } });
  sync.addEventListener('click', async () => {
    sync.disabled = true;
    deploy.disabled = true;
    feedback('Consultando GitHub…');
    try {
      await api('/api/cambios/sincronizar', 'POST');
      page = 1;
      await load();
    } catch (error) {
      feedback(error.message, true);
    } finally {
      sync.disabled = false;
      deploy.disabled = !data?.upstream;
    }
  });
  deploy.addEventListener('click', async () => {
    deploy.disabled = true;
    sync.disabled = true;
    feedback('Verificando la revisión de GitHub…');
    try {
      const { revision, command } = await api('/api/cambios/hostinger', 'POST', { revision: data.upstream });
      $('changes-command-code').value = command;
      $('changes-command-note').textContent = `El bloque despliega la revisión ${short(revision)} de GitHub mediante el procedimiento habitual de copia y comprobación.`;
      $('changes-copy-status').textContent = '';
      dialog.showModal();
      await load();
    } catch (error) {
      page = 1;
      await load();
      feedback(error.message, true);
    } finally {
      deploy.disabled = !data?.upstream;
      sync.disabled = false;
    }
  });
  $('changes-copy').addEventListener('click', async () => {
    const field = $('changes-command-code');
    const hint = $('changes-copy-status');
    try {
      await navigator.clipboard.writeText(field.value);
      hint.textContent = 'Comando copiado.';
    } catch {
      field.focus();
      field.select();
      hint.textContent = 'Comando seleccionado. Usa Ctrl+C o la opción Copiar.';
    }
  });
  return { load };
}
