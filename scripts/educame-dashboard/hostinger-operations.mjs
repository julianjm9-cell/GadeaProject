import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { OperationError, revisionPattern } from './operations.mjs';

const targetPattern = /^(?:[a-zA-Z0-9_][a-zA-Z0-9_.-]*@)?[a-zA-Z0-9][a-zA-Z0-9_.-]{0,190}$/;
const blocked = job => ['running', 'uncertain'].includes(job?.state);
const remoteScript = await readFile(new URL('./hostinger-remote.sh', import.meta.url), 'utf8');

function runSsh(target, args) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === 'win32' ? 'ssh.exe' : 'ssh';
    const child = spawn(executable, ['-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
      '-o', 'ConnectTimeout=8', '-o', 'ForwardAgent=no', '-o', 'ClearAllForwardings=yes', '--', target, 'bash', '-s', '--', ...args],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill(), 22_000);
    child.stdout.on('data', value => { stdout = (stdout + value).slice(-16000); });
    child.stderr.on('data', value => { stderr = (stderr + value).slice(-2500); });
    child.stdin.on('error', () => {});
    child.stdin.end(remoteScript.replace(/\r\n/g, '\n'));
    child.on('error', () => { clearTimeout(timer); reject(new OperationError(503, 'OpenSSH no está disponible en este equipo.')); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) return resolve(stdout);
      const message = /permission denied/i.test(stderr) ? 'Hostinger rechazó la autenticación por SSH. Autoriza la clave en el VPS.' :
        /host key verification failed|no .*host key is known|identification has changed/i.test(stderr) ?
          'Verifica la identidad del VPS en OpenSSH antes de conectar.' :
          'SSH no confirmó la operación. Comprueba el acceso y que el VPS tenga el repositorio main limpio, Docker y el archivo de configuración.';
      reject(new OperationError(502, message));
    });
  });
}

export function hostingerOperations(store, changes, github, ssh = runSsh) {
  const target = () => store.operation('hostinger-target') || '';
  const job = () => store.operation('hostinger-job');
  const plan = () => store.operation('hostinger-plan');
  const history = () => store.operation('hostinger-history') || [];
  let starting;
  let refreshing;

  function persist(value) {
    store.writeOperation('hostinger-job', value);
    store.writeOperation('hostinger-history', [value, ...history().filter(item => item.id !== value.id)].slice(0, 15));
    return value;
  }
  async function inspect(alias) {
    if (!targetPattern.test(alias)) throw new OperationError(400, 'Configura el alias SSH de Hostinger.');
    const output = await ssh(alias, ['check']);
    const head = /^EDUCAME_HEAD ([a-f0-9]{40})\r?$/m.exec(output)?.[1];
    if (!head) throw new OperationError(502, 'El VPS no confirmó su revisión actual.');
    return head;
  }
  const status = () => ({ target: target(), job: job(), history: history() });
  async function prepare(revision) {
    if (blocked(job())) throw new OperationError(409, 'Consulta el despliegue anterior antes de empezar otro.');
    await changes.deploy(revision);
    const alias = target();
    const before = await inspect(alias);
    if (github.connected() && !(await github.checks(revision)).ready) throw new OperationError(409, 'Las comprobaciones de GitHub de esta revisión aún no están aprobadas.');
    const prepared = { id: randomUUID(), revision, before, target: alias, expires: Date.now() + 300_000, ciChecked: github.connected() };
    store.transaction(() => {
      if (blocked(job()) || alias !== target()) throw new OperationError(409, 'La conexión o el despliegue cambió. Vuelve a preparar la revisión.');
      store.writeOperation('hostinger-plan', prepared);
    });
    return prepared;
  }
  async function start({ id, revision, confirm }) {
    if (!revisionPattern.test(revision || '') || confirm !== revision.slice(0, 7)) throw new OperationError(400, 'Escribe el código corto de la revisión para confirmar.');
    const last = job();
    if (last?.id === id && last.revision === revision) return last;
    const expected = plan();
    if (!expected || expected.id !== id || expected.revision !== revision || expected.expires < Date.now()) {
      throw new OperationError(409, 'La confirmación caducó. Vuelve a preparar el despliegue.');
    }
    const created = store.transaction(() => {
      const previous = job();
      if (previous?.id === id) return false;
      if (blocked(previous) || expected.target !== target()) throw new OperationError(409, 'Ya hay un despliegue abierto o cambió su conexión.');
      persist({ ...expected, state: 'running', startedAt: new Date().toISOString(), logs: [] });
      return true;
    });
    if (!created) return job();
    starting = id;
    try {
      const response = await ssh(expected.target, ['start', id, revision, expected.before]);
      if (!/^EDUCAME_STATE running\r?$/m.test(response)) throw new OperationError(502, 'El VPS no confirmó el inicio.');
      return job();
    } catch (error) {
      return store.transaction(() => persist({ ...job(), state: 'uncertain', message: error.message }));
    } finally { starting = null; }
  }
  async function readRemote() {
    const last = job();
    if (!blocked(last) || starting === last.id) return status();
    if (refreshing) return refreshing;
    refreshing = (async () => {
      let update;
      try {
        const output = await ssh(last.target, ['status', last.id, last.revision]);
        const remote = /^EDUCAME_STATE (running|missing|\d{1,3})\r?$/m.exec(output)?.[1];
        if (!remote) throw new OperationError(502, 'El VPS no devolvió un estado reconocible.');
        const logs = output.split(/\r?\n/).filter(line => /^\[[1-5]\/5\]|^EDUCAME_STEP |^La actualización se ha detenido en la línea/.test(line))
          .slice(-12).map(line => line.replace(/^EDUCAME_STEP /, '').slice(0, 240));
        const state = remote === 'running' ? 'running' : remote === '0' ? 'completed' : 'failed';
        const message = remote === 'missing' ? 'El VPS no registró este intento. Puedes preparar otro después de comprobar el acceso.' :
          remote === '125' ? 'El proceso del VPS se interrumpió. Consulta el último paso antes de repetir.' :
            state === 'failed' ? `La comprobación del VPS terminó con código ${remote}.` : '';
        update = { ...last, state, message, logs, finishedAt: state === 'running' ? null : new Date().toISOString() };
      } catch (error) { update = { ...last, state: 'uncertain', message: error.message }; }
      store.transaction(() => { if (job()?.id === last.id && blocked(job())) persist(update); });
      return status();
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  return { status, prepare, start, readRemote,
    async connect(alias) {
      if (typeof alias !== 'string') throw new OperationError(400, 'Introduce un alias SSH válido.');
      alias = alias.trim();
      const head = await inspect(alias);
      store.transaction(() => {
        if (blocked(job()) && target() !== alias) throw new OperationError(409, 'Espera a confirmar el despliegue anterior.');
        store.writeOperation('hostinger-target', alias);
      });
      return { ...status(), head };
    },
    wait: () => refreshing,
  };
}
