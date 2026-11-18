const test = require('node:test');
const assert = require('node:assert/strict');

test('Hostinger solo coincide con una imagen verificada y main remoto comprobado; un encargo nuevo invalida el verde', async () => {
  const { createDeploymentStatus } = await import('../scripts/educame-dashboard/deployment-status.mjs');
  const a = 'a'.repeat(40), b = 'b'.repeat(40);
  let head = a, upstream = a, published = a, dirty = false, calls = 0, failGit = false, failServer = false;
  let remote = { running_revision: a, verified_revision: a, verified_at: '2026-11-18T12:00:00+00:00' };
  const read = createDeploymentStatus({ now: () => Date.parse('2026-11-18T13:00:00Z'), changes: {
    versions: async () => ({ head, upstream, dirty }), remoteRevision: async () => { if (failGit) throw Error('Sin GitHub'); return published; },
  }, fetchImpl: async (url, options) => {
    calls++; assert.equal(new URL(url).pathname, '/api/public/release'); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
    if (failServer) throw Error('No responde'); return Response.json(remote);
  } });
  assert.equal((await read()).state, 'synced');
  await read(); assert.equal(calls, 1, 'reutiliza brevemente una lectura de la misma revisión');
  head = published = b;
  const pending = await read(); assert.equal(pending.state, 'pending'); assert.equal(calls, 2, 'detecta el commit nuevo sin esperar a que caduque la caché');
  assert.equal(pending.hostinger.revision, a); assert.equal(pending.github.revision, b);
  remote = { running_revision: b, verified_revision: null, verified_at: null };
  assert.equal((await read(true)).state, 'unknown', 'git pull o una imagen nueva sin comprobaciones no bastan');
  remote.verified_revision = b; remote.verified_at = '2026-11-18T13:00:00Z';
  assert.equal((await read(true)).state, 'synced', 'verifica main remoto aunque origin/main local todavía sea antiguo');
  dirty = true; assert.equal((await read()).state, 'pending'); dirty = false;
  failServer = true; assert.equal((await read(true)).state, 'unknown', 'no conserva un verde anterior si la consulta falla'); failServer = false;
  failGit = true; assert.equal((await read(true)).state, 'unknown', 'no deduce main remoto de una referencia antigua'); failGit = false;
  for (const invalid of [null, [], { running_revision: b }, { running_revision: b, verified_revision: b, verified_at: 'fecha inventada' }]) {
    remote = invalid; assert.equal((await read(true)).state, 'unknown');
  }
});

test('un cambio solo en GitHub y un servidor antiguo o sin endpoint nunca se consideran sincronizados', async () => {
  const { createDeploymentStatus } = await import('../scripts/educame-dashboard/deployment-status.mjs');
  const a = 'a'.repeat(40), b = 'b'.repeat(40);
  const changes = { versions: async () => ({ head: a, upstream: a, dirty: false }), remoteRevision: async () => b };
  const read = createDeploymentStatus({ changes, fetchImpl: async () => Response.json({ running_revision: a, verified_revision: a, verified_at: '2026-11-18T10:00:00Z' }) });
  assert.equal((await read()).state, 'pending');
  const legacy = createDeploymentStatus({ changes, fetchImpl: async () => new Response('Sin endpoint', { status: 404 }) });
  const result = await legacy(); assert.equal(result.state, 'unknown'); assert.equal(result.github.verified, false);
});
