const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtemp, mkdir, readFile, writeFile, chmod, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, dirname, resolve, relative, delimiter } = require('node:path');

test('el despliegue identifica la imagen solo después de pasar las pruebas y nunca tras un fallo', { timeout: 45000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'educame-deploy-proof-'));
  t.after(async () => { assert.match(relative(resolve(tmpdir()), resolve(directory)), /^educame-deploy-proof-[\w-]+$/); await rm(directory, { recursive: true, force: true, maxRetries: 5 }); });
  const repo = join(directory, 'repo'), bin = join(directory, 'bin'), log = join(directory, 'docker.log');
  await mkdir(join(repo, 'infra'), { recursive: true }); await mkdir(bin);
  await writeFile(join(repo, 'infra/deploy-hostinger.sh'), await readFile('infra/deploy-hostinger.sh'));
  await writeFile(join(repo, '.env'), 'ISOLATED_TEST=1\n');
  const command = (file, args, options = {}) => execFileSync(file, args, { cwd: repo, windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
  command('git', ['init', '-b', 'main']); command('git', ['config', 'user.name', 'Deployment fixture']); command('git', ['config', 'user.email', 'fixture@example.invalid']);
  command('git', ['add', 'infra/deploy-hostinger.sh']); command('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', 'Fixture']);
  const revision = command('git', ['rev-parse', 'HEAD']).trim();
  async function script(name, body) { const file = join(bin, name); await writeFile(file, '#!/bin/sh\n' + body.replace(/\r\n/g, '\n')); await chmod(file, 0o755); }
  await script('flock', 'exit 0\n'); await script('python3', 'exit 0\n');
  // Optional host service cleanup must never reach the machine running this fixture.
  await script('systemctl', 'exit 0\n'); await script('rm', 'exit 0\n');
  await script('docker', `printf 'REVISION %s ARGS %s\\n' "$EDUCAME_BUILD_REVISION" "$*" >> "$MOCK_DOCKER_LOG"
case "$*" in
  *"deployment_check"*) [ "$FAIL_AT" != checks ] || exit 17;;
  *"build backend"*) [ "$FAIL_AT" != build ] || exit 18;;
  *"pg_dump"*) printf 'isolated-fake-dump';;
esac
exit 0
`);
  let shell = 'bash';
  if (process.platform === 'win32') {
    const git = execFileSync('where.exe', ['git'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/)[0];
    shell = join(dirname(dirname(git)), 'usr/bin/sh.exe');
  }
  const env = { ...process.env, PATH: [bin, ...(process.platform === 'win32' ? [dirname(shell)] : []), process.env.PATH].join(delimiter), MOCK_DOCKER_LOG: log };
  for (const fail of ['checks', 'build']) {
    await writeFile(log, '');
    assert.throws(() => command(shell, ['infra/deploy-hostinger.sh'], { env: { ...env, FAIL_AT: fail } }));
    assert.doesNotMatch(await readFile(log, 'utf8'), /release_status stamp/, 'un fallo no genera recibo de despliegue');
  }
  await writeFile(log, ''); command(shell, ['infra/deploy-hostinger.sh'], { env: { ...env, FAIL_AT: '' } });
  const passed = await readFile(log, 'utf8');
  assert.match(passed, new RegExp('release_status stamp ' + revision));
  assert.ok(passed.indexOf('release_status stamp') > passed.indexOf('app.deployment_check'));
  await writeFile(join(repo, 'infra/deploy-hostinger.sh'), (await readFile(join(repo, 'infra/deploy-hostinger.sh'), 'utf8')) + '\n# Unsaved local change\n');
  await writeFile(log, ''); command(shell, ['infra/deploy-hostinger.sh'], { env: { ...env, FAIL_AT: '' } });
  assert.match(await readFile(log, 'utf8'), /release_status stamp unknown/, 'un checkout modificado no se anuncia como una revisión Git exacta');
});
