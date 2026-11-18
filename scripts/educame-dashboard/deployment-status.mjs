const revision = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

// A Git checkout or a completed SSH job does not identify the running image.
export function createDeploymentStatus({ changes, fetchImpl = fetch, now = () => Date.now() }) {
  let cache, pending;
  async function inspect(local) {
    const result = { state: 'unknown', local: { revision: local.head, dirty: local.dirty },
      github: { revision: local.upstream || null, verified: false }, hostinger: null,
      checkedAt: new Date(now()).toISOString(), message: 'Hostinger sin verificar. Subir a GitHub no confirma el despliegue.' };
    try {
      const response = await fetchImpl('https://educame.tech/api/public/release?check=' + now(), {
        method: 'GET', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw Error('unavailable');
      const remote = await response.json();
      if (!revision(remote?.running_revision)) throw Error('unidentified');
      const validTime = typeof remote.verified_at === 'string' && Number.isFinite(Date.parse(remote.verified_at)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(remote.verified_at);
      result.hostinger = { revision: remote.running_revision,
        verifiedRevision: validTime && remote.verified_revision === remote.running_revision ? remote.verified_revision : null,
        verifiedAt: validTime ? remote.verified_at : null };
      const published = await changes.remoteRevision();
      const current = await changes.versions();
      result.local = { revision: current.head, dirty: current.dirty };
      result.github = { revision: published || null, verified: revision(published) };
      if (!result.github.verified) throw Error('github-unverified');
      if (current.head !== published || current.dirty) {
        result.state = 'pending'; result.message = 'Hay cambios locales pendientes. La versión completa aún no está alineada.';
      } else if (remote.running_revision !== published) {
        result.state = 'pending'; result.message = 'Pendiente de actualizar Hostinger. GitHub contiene una versión diferente de la que está funcionando.';
      } else if (result.hostinger.verifiedRevision === published) {
        result.state = 'synced'; result.message = 'Sincronizado: local, GitHub y el despliegue verificado de Hostinger coinciden.';
      } else result.message = 'La imagen de Hostinger coincide, pero su despliegue aún no está verificado.';
    } catch {
      if (result.hostinger) result.message = 'Hostinger ha respondido, pero no se pudo confirmar su coincidencia con GitHub.';
    }
    return result;
  }
  return async function status(force = false) {
    const local = await changes.versions();
    if (!force && cache && cache.local.revision === local.head && cache.local.dirty === local.dirty && now() - Date.parse(cache.checkedAt) < 30000) return cache;
    if (pending) { await pending; return status(false); }
    pending = inspect(local).then(result => { cache = result; return result; }).finally(() => { pending = undefined; });
    return pending;
  };
}
