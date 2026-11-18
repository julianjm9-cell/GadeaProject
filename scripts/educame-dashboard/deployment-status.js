const hash = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const time = value => { const date = new Date(value || ''); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); };

export function setupDeploymentStatus({ api, getState }) {
  const chip = document.getElementById('deployment-chip');
  let data, head, pending;
  function paint(checking = false) {
    const current = getState()?.currentRevision;
    chip.dataset.localRevision = current || '';
    const valid = data && data.local?.revision === current;
    const synced = valid && data.state === 'synced' && data.local.dirty === false && data.github?.verified && hash(current) &&
      data.github.revision === current && data.hostinger?.revision === current && data.hostinger.verifiedRevision === current && Number.isFinite(Date.parse(data.hostinger.verifiedAt));
    const state = synced ? 'synced' : valid && data.state === 'pending' ? 'pending' : 'unknown';
    chip.dataset.state = state;
    chip.textContent = checking ? 'Hostinger · comprobando…' : synced ? 'Hostinger · sincronizado' : state === 'pending' ? 'Hostinger · pendiente' : 'Hostinger · sin verificar';
    const message = checking ? 'Consultando la imagen que está funcionando en Hostinger…' :
      valid ? data.message : 'Hostinger sin verificar. Subir a GitHub no confirma el despliegue.';
    const versions = valid ? [
      data.github?.revision && 'GitHub ' + data.github.revision.slice(0, 8) + (data.github.verified ? '' : ' (referencia local)'),
      data.hostinger?.revision && 'Hostinger ' + data.hostinger.revision.slice(0, 8),
      time(data.checkedAt) && 'Consultado: ' + time(data.checkedAt),
    ].filter(Boolean).join(' · ') : '';
    chip.title = message + (versions ? '\n' + versions : '');
    for (const node of document.querySelectorAll('[data-deployment-summary]')) {
      node.textContent = message; node.dataset.state = state;
    }
    for (const node of document.querySelectorAll('[data-deployment-versions]')) node.textContent = versions;
  }
  async function refresh(force = false) {
    if (pending) return pending;
    data = undefined; paint(true);
    pending = api('/api/despliegue/estado' + (force ? '?actualizar=1' : '')).then(value => { data = value; })
      .catch(() => { data = undefined; }).finally(() => { pending = undefined; paint(); });
    return pending;
  }
  for (const button of document.querySelectorAll('[data-check-deployment]')) button.addEventListener('click', async () => {
    button.disabled = true; try { await refresh(true); } finally { button.disabled = false; }
  });
  window.addEventListener('focus', () => { if (hash(head)) refresh(); });
  setInterval(() => { if (!document.hidden && hash(head)) refresh(); }, 30000);
  return { update() {
    const current = getState()?.currentRevision;
    if (current !== head) { head = current; data = undefined; paint(); if (hash(head)) refresh(); }
  } };
}
