import { jsonRequest, OperationError, revisionPattern } from './operations.mjs';

const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'Educame-Command-Center' };
const branchPattern = /^codex\/educame-[a-z0-9][a-z0-9-]{0,63}$/;
const acceptableChecks = new Set(['success', 'neutral', 'skipped']);

export function githubOperations(changes, connections, store, fetchImpl = fetch) {
  let merging = false;
  const creating = new Set();
  const connected = () => Boolean(connections.githubToken());

  async function repo() {
    const url = await changes.repository();
    if (!url) throw new OperationError(409, 'El remoto origin debe apuntar a un repositorio de GitHub.');
    return url.slice('https://github.com/'.length);
  }
  async function request(path, method = 'GET', data, token = connections.githubToken(), repository) {
    if (!token) throw new OperationError(409, 'Conecta GitHub desde esta sección.');
    const name = repository || await repo();
    return jsonRequest(fetchImpl, `https://api.github.com/repos/${name}${path}`, { method, token, data, headers, label: 'GitHub' });
  }
  const numberPath = value => {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0) throw new OperationError(400, 'Selecciona una solicitud válida.');
    return `/pulls/${number}`;
  };
  const pull = (item, repository) => ({ number: item.number, title: item.title, body: item.body?.slice(0, 6000) || '',
    branch: item.head?.ref, head: item.head?.sha, base: item.base?.ref, open: item.state === 'open',
    merged: item.merged === true || Boolean(item.merged_at), mergeCommit: item.merge_commit_sha, draft: item.draft === true,
    mergeable: item.mergeable, fileCount: item.changed_files,
    url: `https://github.com/${repository}/pull/${item.number}` });

  async function checks(revision, repository) {
    if (!revisionPattern.test(revision || '')) throw new OperationError(400, 'Revisión de GitHub no válida.');
    const result = await request(`/commits/${revision}/check-runs?filter=latest&per_page=100`, 'GET', undefined, undefined, repository);
    const rows = (result.check_runs || []).map(({ name, status, conclusion }) => ({ name, status, conclusion }));
    return { rows, ready: rows.some(row => row.conclusion === 'success') && rows.length === result.total_count &&
      rows.every(row => row.status === 'completed' && acceptableChecks.has(row.conclusion)) };
  }

  async function detail(number) {
    const path = numberPath(number);
    const repository = await repo();
    const item = pull(await request(path, 'GET', undefined, undefined, repository), repository);
    const [files, check] = await Promise.all([
      request(path + '/files?per_page=100', 'GET', undefined, undefined, repository),
      checks(item.head, repository),
    ]);
    const current = await request(path, 'GET', undefined, undefined, repository);
    if (current.head?.sha !== item.head || current.base?.ref !== item.base || current.state !== (item.open ? 'open' : 'closed')) {
      throw new OperationError(409, 'La solicitud cambió durante la consulta. Vuelve a abrirla.');
    }
    const delivery = Object.entries(store.board().pushes || {}).find(([, value]) => value.branch === item.branch);
    return { ...item, checks: check, localOnly: delivery?.[1].app === 'control',
      deliveryKey: delivery?.[0], files: files.map(file => ({
      name: file.filename, status: file.status, additions: file.additions, deletions: file.deletions, patch: file.patch?.slice(0, 12000) || '',
      patchTruncated: (file.patch?.length || 0) > 12000,
    })) };
  }

  return {
    connected, checks,
    async status() {
      return { connected: connected(), repository: await repo().catch(() => null),
        branches: Object.values(store.board().pushes || {}).filter(item => branchPattern.test(item.branch) && !item.integratedRevision)
          .map(({ branch, commit }) => ({ branch, commit })) };
    },
    async connect(value) {
      const token = typeof value === 'string' ? value.trim() : '';
      if (!/^[a-zA-Z0-9_]{20,300}$/.test(token)) throw new OperationError(400, 'Introduce un token de acceso de GitHub.');
      await request('/pulls?state=open&base=main&per_page=1', 'GET', undefined, token);
      await connections.setGithubToken(token);
      return { connected: true };
    },
    async disconnect() { await connections.setGithubToken(null); return { connected: false }; },
    async list() {
      const repository = await repo();
      const values = await request('/pulls?state=open&base=main&per_page=50', 'GET', undefined, undefined, repository);
      return values.map(value => pull(value, repository));
    },
    detail,
    async create(branch) {
      const pushed = Object.values(store.board().pushes || {}).find(item => item.branch === branch);
      if (!branchPattern.test(branch || '') || !pushed || !revisionPattern.test(pushed.commit)) throw new OperationError(400, 'Selecciona una entrega subida desde el panel.');
      if (creating.has(branch)) throw new OperationError(409, 'La solicitud se está preparando.');
      creating.add(branch);
      try {
        const repository = await repo();
        const query = new URLSearchParams({ state: 'all', base: 'main', head: `${repository.split('/')[0]}:${branch}` });
        const [existing] = await request('/pulls?' + query, 'GET', undefined, undefined, repository);
        if (!existing?.merged_at && existing?.merged !== true) {
          const remote = await request('/branches/' + encodeURIComponent(branch), 'GET', undefined, undefined, repository);
          if (remote.commit?.sha !== pushed.commit) throw new OperationError(409, 'La rama remota cambió desde que se aprobó la entrega.');
        }
        const value = existing || await request('/pulls', 'POST', { head: branch, base: 'main', title: `Educame · ${branch.replace('codex/educame-', '')}`,
          body: `Entrega revisada en LA TERRAZA. Commit: ${pushed.commit}.` }, undefined, repository);
        if (value.head?.sha !== pushed.commit) throw new OperationError(409, 'La solicitud corresponde a otra revisión.');
        return pull(value, repository);
      } finally { creating.delete(branch); }
    },
    async merge({ number, revision, confirm }) {
      if (!revisionPattern.test(revision || '') || confirm !== revision.slice(0, 7)) {
        throw new OperationError(400, 'Confirma el código de la revisión antes de fusionar.');
      }
      if (merging) throw new OperationError(409, 'Hay una fusión en curso.');
      merging = true;
      try {
        const repository = await repo();
        const path = numberPath(number);
        const item = await request(path, 'GET', undefined, undefined, repository);
        if (item.head?.sha !== revision || item.base?.ref !== 'main') throw new OperationError(409, 'La revisión o la rama de destino cambió.');
        const board = store.board();
        const delivery = Object.entries(board.pushes || {}).find(([, value]) => value.branch === item.head?.ref);
        if (delivery && (delivery[1].commit !== revision || board.reviews?.[delivery[0]]?.decision !== 'aprobada' ||
            board.reviews?.[delivery[0]]?.commit !== revision)) throw new OperationError(409, 'Esta entrega cambió o requiere volver a aprobarse.');
        if (item.merged) return { merged: true, sha: item.merge_commit_sha, alreadyMerged: true };
        if (item.state !== 'open' || item.draft || item.mergeable !== true) throw new OperationError(409, 'GitHub todavía no permite fusionar esta solicitud.');
        if (!(await checks(revision, repository)).ready) throw new OperationError(409, 'Espera a que pasen las comprobaciones de GitHub de esta revisión.');
        const result = await request(path + '/merge', 'PUT', { sha: revision }, undefined, repository);
        if (!result.merged) throw new OperationError(409, 'GitHub no confirmó la fusión.');
        return { merged: true, sha: result.sha };
      } finally { merging = false; }
    },
  };
}
