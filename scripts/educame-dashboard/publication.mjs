import { execFile } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { OperationError } from './operations.mjs';

const exec = promisify(execFile);
const stateKey = 'simple-publication-v1';
const revision = /^[a-f0-9]{40}$/;
const privateFile = /(^|\/)(\.env(?:\.|$)|\.git(?:\/|$)|\.educame-agents(?:\/|$)|(?:secrets|credentials)(?:\.|\/|$))|\.(?:pem|key|p12|pfx|sqlite|dump)$/i;
const credential = /^\+(?!\+\+).*?(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:sk-|ghp_|github_pat_|AIza)[A-Za-z0-9_-]{20,})/m;

export function createPublication({ root, directory, store, implementation, readDelivery, revalidate, assertIdle,
  onApplied, localRemote = false }) {
  let active;
  const git = (args, cwd = root) => exec('git', ['-c', 'core.hooksPath=' + join(directory, 'agent-empty-hooks'),
    '-c', 'commit.gpgsign=false', ...args], { cwd, windowsHide: true, timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } }).then(result => result.stdout.trim());
  const read = () => store.operation(stateKey);
  const save = update => {
    const next = { ...read(), ...update, updatedAt: new Date().toISOString() };
    store.writeOperation(stateKey, next);
    return next;
  };
  const cwdFor = id => join(directory, 'worktrees', 'publication-' + id);
  const ancestor = (before, after, cwd) => git(['merge-base', '--is-ancestor', before, after], cwd).then(() => true, () => false);
  const remoteHead = async () => (await git(['ls-remote', '--heads', 'origin', 'refs/heads/main'])).split(/\s/)[0];
  async function sync() {
    const url = await git(['remote', 'get-url', '--push', 'origin']);
    if (!localRemote && !/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)[\w.-]+\/[\w.-]+(?:\.git)?$/.test(url)) {
      throw new OperationError(409, 'El proyecto necesita su repositorio de GitHub configurado.');
    }
    await git(['fetch', '--no-tags', '--no-recurse-submodules', 'origin', '+refs/heads/main:refs/remotes/origin/main']);
    return git(['rev-parse', 'refs/remotes/origin/main']);
  }
  async function clean() {
    if (await git(['branch', '--show-current']) !== 'main' || await git(['status', '--porcelain', '--untracked-files=no'])) {
      throw new OperationError(409, 'Hay trabajo local pendiente de guardar. Conserva esos cambios antes de preparar la publicación.');
    }
    return git(['rev-parse', 'HEAD']);
  }
  function status() {
    const job = read();
    if (!active && ['preparing', 'publishing'].includes(job?.state)) {
      return save({ state: job.state === 'publishing' ? 'retry' : 'failed',
        message: 'El proceso se interrumpió. Puedes retomarlo desde aquí.' });
    }
    return job;
  }
  function background(action) {
    active = Promise.resolve().then(action).catch(error => {
      const publishing = read()?.state === 'publishing';
      save({ state: publishing ? 'retry' : 'failed', message: error.status ? error.message :
        'No se pudo completar este paso. Comprueba el acceso a GitHub y vuelve a intentarlo.' });
    }).finally(() => { active = null; });
  }
  async function prepare({ keys }) {
    if (!Array.isArray(keys) || keys.length > 12 || keys.some(key => !/^implementacion\/[a-z0-9][a-z0-9-]{0,63}$/.test(key)) ||
        new Set(keys).size !== keys.length) throw new OperationError(400, 'Selecciona las entregas que quieres preparar.');
    if (active) throw new OperationError(409, 'Los cambios ya se están procesando.');
    assertIdle();
    const id = randomUUID();
    save({ id, state: 'preparing', phase: 'Comprobando entregas', keys, sources: [], files: [], checks: [], candidate: null,
      message: '', root: null, remote: null, requiresRestart: false, requiresWeb: false, acceptedAt: null });
    background(async () => {
      const head = await clean();
      const remote = await sync();
      const sources = [];
      for (const [index, key] of keys.entries()) {
        save({ phase: 'Comprobando entrega ' + (index + 1) + ' de ' + keys.length });
        let delivery = await readDelivery(key);
        if (!delivery.implementation?.verified) delivery = await revalidate(delivery);
        if (!delivery.implementation?.verified) throw new OperationError(409,
          'Una entrega necesita ajustes porque sus pruebas siguen fallando. Abre el resultado y escribe qué debe corregir el agente.');
        await implementation.review(delivery.implementation);
        if (await git(['rev-parse', 'refs/heads/' + delivery.implementation.branch]) !== delivery.implementation.commit) {
          throw new OperationError(409, 'La revisión de una entrega cambió. Vuelve a prepararla.');
        }
        sources.push({ key, commit: delivery.implementation.commit, title: delivery.draft?.resumen || delivery.encargo, app: delivery.app,
          checks: delivery.checks || [] });
      }
      const cwd = cwdFor(id);
      await mkdir(join(directory, 'worktrees'), { recursive: true });
      await git(['worktree', 'add', '--detach', cwd, head]);
      save({ phase: 'Uniendo los cambios', root: head, remote, sources });
      for (const commit of [remote, ...sources.map(item => item.commit)]) {
        if (!(await ancestor(commit, await git(['rev-parse', 'HEAD'], cwd), cwd))) {
          try { await git(['merge', '--no-edit', commit], cwd); }
          catch { throw new OperationError(409, 'Dos cambios necesitan ajustes para encajar. Las copias están conservadas. Pide al agente que resuelva la integración.'); }
        }
      }
      const candidate = await git(['rev-parse', 'HEAD'], cwd);
      const files = (await git(['diff', '--name-only', '--no-renames', remote, candidate], cwd)).split('\n').filter(Boolean);
      const patch = await git(['diff', '--no-ext-diff', '--no-textconv', '--unified=0', remote, candidate], cwd);
      if (files.some(file => privateFile.test(file)) || credential.test(patch)) {
        throw new OperationError(409, 'La publicación contiene un archivo privado o una posible credencial. Requiere revisión.');
      }
      try { await git(['diff', '--check', remote, candidate], cwd); }
      catch { throw new OperationError(409, 'Hay errores de formato que deben corregirse antes de publicar.'); }
      const commands = [...new Set(sources.flatMap(item => item.checks.map(check => check.command)))];
      if (files.length && await access(join(cwd, 'tests/run-unit.cjs')).then(() => true, () => false)) commands.unshift('npm.cmd test');
      if (files.length && !commands.length) throw new OperationError(409, 'Esta versión necesita una comprobación antes de publicarse.');
      const checks = files.length ? await implementation.runChecks(cwd, commands, () => save({ phase: 'Comprobando la versión conjunta' })) : [];
      save({ checks });
      if (checks.some(check => !check.passed)) throw new OperationError(409, 'La versión conjunta tiene una prueba pendiente. Pide ajustes antes de aceptarla.');
      if (await git(['status', '--porcelain'], cwd) || await git(['rev-parse', 'HEAD'], cwd) !== candidate) {
        throw new OperationError(409, 'Las pruebas modificaron la copia. Vuelve a revisar y preparar los cambios.');
      }
      const localFiles = (await git(['diff', '--name-only', head, candidate], cwd)).split('\n');
      save({ state: 'ready', phase: 'Lista para aceptar', candidate, files, checks, preparedAt: new Date().toISOString(),
        localCommits: Number(await git(['rev-list', '--count', remote + '..' + head], cwd)),
        requiresRestart: localFiles.some(file => file.startsWith('scripts/educame-dashboard') || file === 'scripts/educame-agents.mjs'),
        requiresWeb: files.some(file => /^(?:apps\/|backend\/|admin\/|marketing\/|infra\/|docker-compose|compose\.)/.test(file)) });
    });
    return read();
  }
  async function accept({ id, candidate }) {
    const plan = status();
    if (plan?.id !== id || !revision.test(candidate || '') || plan.candidate !== candidate) {
      throw new OperationError(409, 'La versión cambió. Vuelve a comprobar los cambios antes de aceptarlos.');
    }
    if (plan.state === 'published') return plan;
    if (active) {
      if (plan.state === 'publishing') return plan;
      throw new OperationError(409, 'Espera a que terminen las comprobaciones.');
    }
    if (!['ready', 'retry'].includes(plan.state)) throw new OperationError(409, 'Comprueba los cambios antes de aceptarlos.');
    assertIdle();
    save({ state: 'publishing', phase: 'Aplicando y publicando', message: '', acceptedAt: plan.acceptedAt || new Date().toISOString() });
    background(async () => {
      const head = await clean();
      if (![plan.root, candidate].includes(head)) throw new OperationError(409, 'La versión local cambió. Prepara de nuevo los cambios.');
      for (const item of plan.sources) {
        const delivery = await readDelivery(item.key);
        if (delivery.implementation?.commit !== item.commit) throw new OperationError(409, 'Una entrega cambió después de la comprobación.');
        const review = store.board().reviews[item.key];
        if (review?.decision === 'cambios' && review.date > plan.preparedAt) throw new OperationError(409, 'Se pidieron ajustes después de preparar la versión.');
      }
      let online = await remoteHead();
      if (online !== plan.remote && online !== candidate) throw new OperationError(409, 'GitHub tiene cambios nuevos. Vuelve a preparar para incluirlos.');
      if (head !== candidate) {
        await git(['merge', '--ff-only', candidate]);
        if (plan.requiresRestart) onApplied();
      }
      if (online !== candidate) {
        try { await git(['push', 'origin', candidate + ':refs/heads/main']); }
        catch {
          online = await remoteHead();
          if (online !== candidate) throw new OperationError(502, 'Los cambios están aplicados en este equipo y falta confirmar la subida. Pulsa Reintentar publicación.');
        }
      }
      if (await remoteHead() !== candidate) throw new OperationError(409, 'GitHub cambió durante la publicación. Vuelve a comprobar el estado.');
      await git(['fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main']);
      store.transaction(() => {
        const board = store.board();
        const reviews = { ...board.reviews }, pushes = { ...board.pushes };
        for (const item of plan.sources) {
          const delivery = item.key.slice('implementacion/'.length);
          reviews[item.key] = { decision: 'aprobada', commit: item.commit, note: '', date: new Date().toISOString() };
          pushes[item.key] = { ...pushes[item.key], branch: 'codex/educame-' + delivery, commit: item.commit,
            app: item.app, integratedRevision: candidate };
        }
        store.writeBoard({ ...board, revision: board.revision + 1, reviews, pushes });
      });
      save({ state: 'published', phase: 'Cambios publicados', message: '', publishedAt: new Date().toISOString() });
    });
    return read();
  }
  return { status, prepare, accept, busy: () => Boolean(active), wait: () => active };
}
