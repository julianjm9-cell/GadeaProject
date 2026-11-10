import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const remoteRef = 'refs/remotes/origin/main';
const pageSize = 20;
const shared = ['backend/', 'infra/', 'scripts/', 'tests/', 'docs/', '.github/', 'docker-compose.yml', 'compose.yml'];

export const products = {
  profesor: { name: 'Profesor Particular', app: '/profesor-particular?demo=1', landing: '/profesor', paths: ['apps/profesor/', 'marketing/app_landings_demo/profesor'] },
  eso: { name: 'ESO Adultos', app: '/eso-adultos', landing: '/eso-adultos-info', paths: ['apps/e25/', 'marketing/app_landings_demo/eso-adultos'] },
  ingles: { name: 'Inglés', app: '/cambridge', landing: '/cambridge-info', paths: ['apps/cambridge/', 'marketing/app_landings_demo/cambridge'] },
  diplomator: { name: 'Diplomator', app: '/app', landing: '/diplomator', paths: ['apps/diplomator/', 'marketing/app_landings_demo/diplomator'] },
  universidad: { name: 'Universidad +25', app: '/universidad-adultos', landing: '/u25', paths: ['apps/u25/', 'marketing/app_landings_demo/universidad-25'] },
  facturas: { name: 'Lector de facturas', app: '/facturas', landing: '/ocr-facturas', paths: ['apps/ocr/', 'marketing/app_landings_demo/ocr-facturas'] },
  hazlotu: { name: 'HazloTú', landing: '/hazlo-tu', paths: ['marketing/app_landings_demo/hazlatu', 'apps/hazlotu/'] },
  dashboard: { name: 'Administración online', app: '/admin-dashboard/', paths: ['admin/', 'backend/app/api/admin'] },
  control: { name: 'LA TERRAZA', paths: ['scripts/educame-'] },
};

const suitePaths = ['apps/', 'marketing/', 'admin/', ...shared, 'package.json', 'package-lock.json'];
const scopedPaths = key => key === 'all' ? suitePaths : products[key].paths;
const pathspecs = paths => paths.map(path => path.endsWith('/') || suitePaths.includes(path) ? path : path + '*');
const matches = (file, paths) => paths.some(prefix => file.startsWith(prefix));
const scopes = files => {
  const labels = Object.entries(products).filter(([, product]) => files.some(file => matches(file, product.paths))).map(([key]) => key);
  if (files.some(file => !Object.values(products).some(product => matches(file, product.paths)))) labels.push('shared');
  return labels;
};

export class ChangesError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function githubUrl(remote) {
  const match = remote.trim().match(/^(?:https:\/\/(?:[^/@]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i);
  return match ? 'https://github.com/' + match[1] : '';
}

export function createChanges(cwd) {
  const git = async (args, message = 'No se pudo leer el historial Git de este proyecto.') => {
    try {
      const { stdout } = await run('git', args, {
        cwd, windowsHide: true, timeout: 25_000, maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
      });
      return stdout;
    } catch {
      throw new ChangesError(503, message);
    }
  };
  const readRef = async ref => (await git(['rev-parse', '--verify', ref]).catch(() => '')).trim();
  const repository = async () => githubUrl(await git(['remote', 'get-url', 'origin']));
  let syncing;
  let syncedAt = null;
  async function sync() {
    syncing ??= git(['fetch', '--no-tags', '--no-recurse-submodules', 'origin', `+refs/heads/main:${remoteRef}`],
      'No se pudo consultar origin/main. Comprueba la conexión y el acceso a GitHub.')
      .then(() => { syncedAt = new Date().toISOString(); })
      .finally(() => { syncing = null; });
    await syncing;
    return { syncedAt };
  }

  async function history(query) {
    const app = query.get('app') || 'all';
    const source = query.get('source') || 'all';
    const page = Number(query.get('page') || 1);
    if ((app !== 'all' && !Object.hasOwn(products, app)) || !['all', 'github', 'local'].includes(source) ||
        !Number.isSafeInteger(page) || page < 1) throw new ChangesError(400, 'Filtro de historial no válido.');
    const [head, upstream, branch, remote, status] = await Promise.all([
      readRef('HEAD'), readRef(remoteRef), git(['branch', '--show-current']),
      git(['remote', 'get-url', 'origin']).catch(() => ''),
      git(['status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=all', '--', ...suitePaths]),
    ]);
    const paths = scopedPaths(app);
    const localFiles = status.split('\0').filter(Boolean).map(entry => {
      const file = entry.slice(3);
      return { file, status: entry.slice(0, 2), scopes: scopes([file]) };
    });
    const selected = localFiles.filter(item => matches(item.file, paths));
    const refs = source === 'github' ? [upstream] :
      source === 'local' ? [head, upstream && '^' + upstream] : [head, upstream];
    const canList = refs[0];
    const repository = githubUrl(remote);
    const [log, githubHashes, divergence] = await Promise.all([
      canList ? git(['log', '--date-order', '--no-renames', '--name-only', '-z',
        '--format=%x00%x00%H%x00%aI%x00%s', `--max-count=${pageSize + 1}`, `--skip=${(page - 1) * pageSize}`,
        ...refs.filter(Boolean), '--', ...pathspecs(paths)]) : '',
      upstream && source === 'all' ? git(['rev-list', upstream]) : '',
      head && upstream ? git(['rev-list', '--left-right', '--count', `${head}...${upstream}`]) : '',
    ]);
    const published = new Set(githubHashes.trim().split('\n').map(hash => hash.trim()));
    const [ahead = 0, behind = 0] = divergence.trim().split(/\s+/).filter(Boolean).map(Number);
    const commits = log.split(/\0{2,}(?=[a-f0-9]{40}\0)/).filter(Boolean).map(record => {
      const [sha, date, subject, ...rawFiles] = record.split('\0');
      const files = rawFiles.filter(Boolean).map(file => file.replace(/^\r?\n/, ''));
      const online = source === 'github' || published.has(sha);
      return { sha, date, subject, scopes: scopes(files), files: files.slice(0, 60), fileCount: files.length, online,
        url: online && repository ? `${repository}/commit/${sha}` : '' };
    });
    return {
      products: Object.entries(products).map(([key, { name, app, landing }]) => ({ key, name, app: Boolean(app), landing: Boolean(landing) })),
      repository, head, upstream, branch: branch.trim(), syncedAt, ahead, behind, page,
      local: { total: localFiles.length, count: selected.length, files: selected.slice(0, 100) },
      commits: commits.slice(0, pageSize), more: commits.length > pageSize,
    };
  }

  async function deploy(expected) {
    if (!/^[a-f0-9]{40}$/.test(expected || '')) throw new ChangesError(400, 'Selecciona primero la revisión de GitHub.');
    await sync();
    const revision = await readRef(remoteRef);
    if (expected !== revision) throw new ChangesError(409, 'GitHub cambió desde que abriste el historial. Revisa la nueva revisión antes de generar el comando.');
    const command = 'cd /opt/educa-suite &&\n' +
      'test -z "$(git status --porcelain --untracked-files=no)" &&\n' +
      'git fetch origin main &&\n' +
      `git merge-base --is-ancestor ${revision} FETCH_HEAD &&\n` +
      `git merge --ff-only ${revision} &&\n` +
      `test "$(git rev-parse HEAD)" = ${revision} &&\n` +
      'bash infra/deploy-hostinger.sh';
    return { revision, command };
  }
  async function integrated(commit) {
    if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new ChangesError(400, 'La entrega no tiene una revisión válida.');
    await sync();
    const revision = await readRef(remoteRef);
    const included = await git(['merge-base', '--is-ancestor', commit, revision]).then(() => true, () => false);
    if (!included) throw new ChangesError(409, 'La entrega aún no figura en main. Comprueba la fusión en GitHub.');
    return { revision };
  }
  return { history, sync, deploy, repository, integrated };
}
