import { spawn } from 'node:child_process';
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { draftRequest, parseDraft } from '../educame-agents.mjs';

const workspace = fileURLToPath(new URL('../../', import.meta.url));
const stdoutLimit = 1_000_000;
const maxRuntime = 180_000;
const runnableTests = /^(?:node(?:\.exe)?\s+(?:--test\b|tests[\\/]run-unit\.cjs\b)|npm(?:\.cmd)?\s+(?:test\b|run\s+test:browser\b)|python(?:3)?\s+-m\s+pytest\b)/i;
const baseEnv = /^(path|pathext|systemroot|windir|comspec|home|userprofile|appdata|localappdata|temp|tmp|programfiles(?:\(x86\))?|programdata|codex_home)$/i;

function testCommand(value) {
  const wrapped = /^(?:"[^"]+"|\S+)(?:\s+-(?:NoProfile|NonInteractive|NoLogo))*\s+(?:-Command|-lc|-c)\s+(["'])([\s\S]*)\1$/i.exec(value);
  const command = (wrapped?.[2] || value).trim();
  return runnableTests.test(command) && !/[;|&<>\r\n]/.test(command) ? command : '';
}

function run(executable, args, input, timeout, cwd = workspace) {
  return new Promise(resolve => {
    const env = cwd === workspace ? process.env : Object.fromEntries(Object.entries(process.env).filter(([key]) => baseEnv.test(key)));
    const child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stopped = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (stopped) return;
      stdout += chunk;
      if (stdout.length > stdoutLimit) {
        stopped = 'La salida de Codex excedió el tamaño permitido.';
        child.kill();
      }
    });
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.stdin.end(input);
    const timer = setTimeout(() => {
      stopped = 'Codex agotó el tiempo de este encargo.';
      child.kill();
    }, timeout);
    child.on('error', error => {
      stopped = error.code === 'ENOENT' ? 'No se encontró Codex CLI.' : 'No se pudo iniciar Codex CLI.';
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code, stdout, error: stopped });
    });
  });
}

export function createCodex({ executable = process.env.EDUCAME_CODEX_EXECUTABLE || (process.platform === 'win32' ? 'codex.exe' : 'codex'), execute = run } = {}) {
  let checked;
  let expires = 0;

  function status(fresh = false) {
    if (!checked || fresh || expires < Date.now()) {
      expires = Date.now() + 30_000;
      checked = execute(executable, ['login', 'status'], '', 5_000).then(({ code, error }) => ({
        ready: code === 0 && !error,
        message: error || (code === 0 ? 'Sesión local activa' : 'Inicia sesión con codex login'),
      }));
    }
    return checked;
  }

  async function generate(task, cwd = workspace, allowed) {
    const implement = Boolean(allowed);
    const testInstructions = process.platform === 'win32'
      ? 'En Windows, ejecuta las pruebas de Node pertinentes con node --test --test-isolation=none <archivos>. En este entorno, los tests que crean otros procesos pueden necesitar una comprobación manual posterior.'
      : 'Ejecuta node tests/run-unit.cjs y las pruebas relacionadas que tengas disponibles.';
    const { instructions, input, schema } = await draftRequest(task, { repository: true, implement });
    const folder = await mkdtemp(join(tmpdir(), 'educame-codex-'));
    const schemaFile = join(folder, 'entrega.json');
    try {
      await writeFile(schemaFile, JSON.stringify(schema), { mode: 0o600 });
      const prompt = `${instructions}

${implement ? `Trabajas en una copia Git aislada.
Edita solo archivos de estas rutas: ${allowed.join(', ')}. Excluye datos privados, credenciales, .env, bases de datos y archivos del panel local.
No hagas commits, push, despliegues ni publicaciones. No consultes el checkout principal. ${testInstructions}
Una vez editados los archivos, ejecuta cada comando de prueba por separado para conservar su resultado. Indica qué hiciste y qué quedó pendiente en el esquema solicitado.` :
    'Puedes consultar código y documentación del producto para fundamentar la propuesta. Excluye datos privados, archivos .env, claves, copias de bases de datos y el almacén .educame-agents. Trabaja en modo de solo lectura. Entrega la propuesta en el esquema solicitado.'}

Encargo y contexto proporcionados
${JSON.stringify(input)}`;
      const result = await execute(executable, ['-a', 'never', 'exec', '--ignore-user-config', '--sandbox', implement ? 'workspace-write' : 'read-only',
        '--config', 'shell_environment_policy.inherit="core"',
        ...(process.platform === 'win32' ? ['--config', `windows.sandbox="${process.env.EDUCAME_CODEX_WINDOWS_SANDBOX === 'elevated' ? 'elevated' : 'unelevated'}"`] : []),
        ...(implement ? ['--config', 'sandbox_workspace_write.network_access=false', '--config', 'web_search="disabled"'] : []),
        '--ephemeral', '--json', '--output-schema', schemaFile, '-'], prompt, implement ? 720_000 : maxRuntime, cwd);
      if (result.error) return { error: result.error, uncertain: implement };
      let responseId;
      let usage;
      let message;
      const checks = new Map();
      for (const line of result.stdout.split(/\r?\n/)) {
        let event;
        try { event = JSON.parse(line); } catch { continue; }
        if (event.type === 'thread.started') responseId = event.thread_id;
        if (event.type === 'item.completed' && event.item?.type === 'agent_message') message = event.item.text;
        if (implement && event.type === 'item.completed' && event.item?.type === 'command_execution') {
          const command = testCommand(event.item.command || '');
          if (command) checks.set(command, { command: command.slice(0, 320), passed: event.item.exit_code === 0 });
        }
        if (event.type === 'turn.completed') usage = event.usage;
      }
      const total = usage ? { ...usage, total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0) } : undefined;
      if (result.code !== 0 || !usage) return { responseId, uncertain: implement, error: 'Codex interrumpió el encargo. Comprueba su sesión y la copia aislada antes de repetirlo.' };
      try {
        return { responseId, usage: total, draft: parseDraft(message), ...(implement ? { checks: [...checks.values()].slice(-12) } : {}) };
      } catch {
        return { responseId, usage: total, error: 'Codex no devolvió una entrega estructurada válida.' };
      }
    } finally {
      await unlink(schemaFile).catch(() => {});
      await rmdir(folder).catch(() => {});
    }
  }

  return { status, generate, implement: (task, cwd, allowed) => generate(task, cwd, allowed) };
}
