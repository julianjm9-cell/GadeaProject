import { execFile } from 'node:child_process';
import { access, lstat, mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { products } from './changes.mjs';

const exec = promisify(execFile);
const sha = /^[a-f0-9]{40}$/;
const safeId = /^[a-z0-9][a-z0-9-]{0,63}$/;
const commonPaths = ['backend/app/', 'backend/tests/', 'tests/', 'docs/'];
const terracePaths = ['scripts/educame-dashboard/', 'scripts/educame-dashboard.mjs', 'scripts/educame-agents.mjs',
  'docs/agentes-educame.md', 'tests/educame-dashboard.test.cjs', 'tests/educame-dashboard-browser.test.cjs', 'tests/educame-chat.test.cjs'];
const terraceFile = file => terracePaths.some(path => path.endsWith('/') ? file.startsWith(path) : file === path) && !excluded.test(file);
const excluded = /(^|\/)(\.env(?:\.|$)|\.git(?:\/|$)|\.educame-agents(?:\/|$)|(?:credentials|secrets)(?:\.|\/|$))|\.(pem|key|p12|pfx|sqlite|dump)$/i;
const credential = /^\+(?!\+\+).*?(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:sk-|ghp_|github_pat_|AIza)[A-Za-z0-9_-]{20,})/m;
const github = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i;

export class ImplementationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createImplementation(root, directory, codex, { localRemote = false } = {}) {
  const worktrees = join(directory, 'worktrees');
  const hooks = join(directory, 'agent-empty-hooks');
  const git = (args, cwd = root, timeout = 60_000) => exec('git', ['-c', 'core.hooksPath=' + hooks, ...args], {
    cwd, windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
  }).then(({ stdout }) => stdout);
  const ref = async (name, cwd) => (await git(['rev-parse', '--verify', name], cwd)).trim();
  const branch = id => 'codex/educame-' + id;
  const receipt = id => join(worktrees, id + '.json');
  const worktree = id => join(worktrees, id);
  const pathsFor = app => app === 'control' ? terracePaths : [...commonPaths, ...(app === 'ecosistema'
    ? ['apps/', 'marketing/', 'admin/', 'scripts/educame-'] : products[app]?.paths || [])];

  async function base() {
    try { return await ref('HEAD'); }
    catch { throw new ImplementationError(409, 'El proyecto necesita una revisión de Git antes de implementar.'); }
  }

  async function commitBranch(artifact) {
    const name = 'refs/heads/' + artifact.branch;
    const current = await ref(name).catch(() => '');
    if (current === artifact.commit) return;
    if (current) throw new ImplementationError(409, 'La rama de esta entrega contiene otra revisión.');
    await git(['update-ref', name, artifact.commit, '0'.repeat(40)]);
  }

  async function recover(task) {
    if (!safeId.test(task.id)) return;
    const saved = await readFile(receipt(task.id), 'utf8').then(JSON.parse).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (!saved || saved.fingerprint !== task.fingerprint) return;
    const { result } = saved;
    if (result.implementation?.commit) await commitBranch(result.implementation);
    return result;
  }

  async function execute(task, baseRevision) {
    const cached = await recover(task);
    if (cached) return cached;
    const start = task.parentImplementation?.commit || baseRevision;
    const cwd = worktree(task.id);
    const allowed = pathsFor(task.app);
    await mkdir(worktrees, { recursive: true });
    await mkdir(hooks, { recursive: true });
    if (await access(cwd).then(() => true, error => {
      if (error.code !== 'ENOENT') throw error;
      return false;
    })) return { uncertain: true, error: 'Ya existe una copia aislada de este encargo. Revisa su contenido antes de repetirlo.' };
    await git(['worktree', 'add', '--detach', cwd, start], root, 120_000);
    const output = await codex.implement(task, cwd, allowed);
    const pending = { branch: branch(task.id), base: baseRevision };
    if (!output.draft) return { ...output, implementation: pending };
    const reject = error => ({ ...output, error, implementation: pending });
    if (await ref('HEAD', cwd) !== start) return reject('La copia cambió de revisión durante el encargo. Requiere revisión manual.');
    const changes = new Set([
      ...(await git(['diff', '--name-only', '--no-renames', '-z', 'HEAD'], cwd)).split('\0').filter(Boolean),
      ...(await git(['ls-files', '--others', '--exclude-standard', '-z'], cwd)).split('\0').filter(Boolean),
    ]);
    if (!changes.size) return reject('El agente entregó una revisión sin cambios de código.');
    const files = [...changes];
    if (files.length > 120 || files.some(file => task.app === 'control' ? !terraceFile(file) :
      excluded.test(file) || !allowed.some(prefix => file.startsWith(prefix)))) {
      return reject('La entrega contiene archivos fuera del ámbito permitido. La copia aislada conserva los cambios.');
    }
    for (const file of files) {
      const entry = await lstat(join(cwd, file)).catch(error => { if (error.code !== 'ENOENT') throw error; });
      if (entry && (!entry.isFile() || entry.size > 15 * 1024 * 1024 || relative(join(cwd, file), await realpath(join(cwd, file))))) {
        return reject('La entrega contiene un enlace, un archivo especial o un archivo demasiado grande.');
      }
    }
    const literal = files.map(file => ':(literal)' + file);
    await git(['add', '-A', '--', ...literal], cwd);
    const staged = await git(['diff', '--cached', '--no-renames', '--unified=0', '--', ...literal], cwd);
    if (credential.test(staged)) return reject('Hay un valor que parece una credencial. La entrega requiere revisión.');
    if (!(await git(['diff', '--cached', '--check'], cwd).then(() => true, () => false))) return reject('Git encontró errores de formato en la entrega.');
    if (!output.checks?.length) return reject('Falta una prueba ejecutada con éxito dentro de la copia aislada.');
    if (output.checks.some(check => !check.passed)) return reject('Quedan pruebas con errores. La copia aislada conserva los cambios.');
    await git(['-c', 'commit.gpgsign=false', 'commit', '-m', 'Educame: ' + task.agente + ' · ' + task.encargo.replace(/\s+/g, ' ').slice(0, 95)], cwd);
    const commit = await ref('HEAD', cwd);
    const result = { ...output, implementation: { ...pending, commit, files, verified: true } };
    const temp = receipt(task.id) + '.' + randomUUID() + '.tmp';
    await writeFile(temp, JSON.stringify({ fingerprint: task.fingerprint, result }), { flush: true });
    await rename(temp, receipt(task.id));
    await commitBranch(result.implementation);
    return result;
  }

  async function push(id, artifact) {
    if (!safeId.test(id) || artifact?.branch !== branch(id) || !sha.test(artifact?.commit || '') || !sha.test(artifact?.base || '')) {
      throw new ImplementationError(409, 'La entrega no tiene una revisión lista para subir.');
    }
    const name = 'refs/heads/' + artifact.branch;
    if (await ref(name).catch(() => '') !== artifact.commit) throw new ImplementationError(409, 'La rama local ya no coincide con la entrega.');
    const pushUrl = (await git(['remote', 'get-url', '--push', 'origin']).catch(() => '')).trim();
    const repo = github.exec(pushUrl)?.[1];
    if (!repo && !localRemote) throw new ImplementationError(409, 'Configura un remoto origin de GitHub para subir la rama.');
    const remote = async () => (await git(['ls-remote', '--heads', 'origin', name], root, 35_000)).split(/\s+/)[0];
    try {
      const previous = await remote();
      if (previous && previous !== artifact.commit) throw new ImplementationError(409, 'GitHub ya tiene otra revisión en esa rama.');
      if (!previous) {
        try {
          await git(['push', '--force-with-lease=' + name + ':', 'origin', artifact.commit + ':' + name], root, 120_000);
        } catch (error) {
          if (await remote() !== artifact.commit) throw error;
        }
      }
      if (await remote() !== artifact.commit) throw new Error('unexpected remote');
    } catch (error) {
      if (error instanceof ImplementationError) throw error;
      throw new ImplementationError(502, 'No se pudo verificar la subida a GitHub. Reintenta la misma entrega para comprobarla.');
    }
    const link = repo ? 'https://github.com/' + repo : '';
    return { branch: artifact.branch, commit: artifact.commit, url: link && link + '/compare/main...' + encodeURIComponent(artifact.branch) + '?expand=1' };
  }

  async function terraceRevision(artifact) {
    if (!artifact?.verified || !sha.test(artifact.commit) || !sha.test(artifact.base) ||
        await ref(artifact.commit + '^').catch(() => '') !== artifact.base) {
      throw new ImplementationError(409, 'La propuesta de LA TERRAZA todavía no tiene un commit verificable.');
    }
    const files = (await git(['diff', '--name-only', '--no-renames', '-z', artifact.base, artifact.commit])).split('\0').filter(Boolean);
    if (!files.length || files.some(file => !terraceFile(file))) throw new ImplementationError(409, 'La propuesta contiene archivos fuera de LA TERRAZA.');
    return files;
  }

  async function reviewTerrace(artifact) {
    const files = await terraceRevision(artifact);
    const patch = await git(['diff', '--no-ext-diff', '--no-textconv', '--no-renames', artifact.base, artifact.commit]);
    return { files, patch: patch.slice(0, 90_000), truncated: patch.length > 90_000 };
  }

  async function applyTerrace(artifact) {
    await terraceRevision(artifact);
    const head = await base();
    if ((await git(['branch', '--show-current'])).trim() !== 'main') {
      throw new ImplementationError(409, 'Abre la rama main del proyecto antes de aplicar la propuesta.');
    }
    if (head === artifact.commit) return;
    if (head !== artifact.base) throw new ImplementationError(409, 'La revisión local cambió. Pide una propuesta nueva sobre el código actual.');
    if ((await git(['status', '--porcelain', '--untracked-files=no'])).trim()) {
      throw new ImplementationError(409, 'Hay cambios de Git sin guardar. Guarda tu trabajo antes de aplicar la propuesta.');
    }
    try { await git(['merge', '--ff-only', artifact.commit]); }
    catch { throw new ImplementationError(409, 'Git no pudo aplicar esta revisión. Comprueba la rama y los archivos locales.'); }
  }

  return { base, execute, recover, push, worktree, reviewTerrace, applyTerrace };
}
