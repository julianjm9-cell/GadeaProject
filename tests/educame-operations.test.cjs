const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, dirname } = require('node:path');

const head = '1'.repeat(40);
const before = '2'.repeat(40);

test('GitHub comprueba el commit, verifica sus pruebas y repite la solicitud sin duplicarla', async () => {
  const { githubOperations } = await import('../scripts/educame-dashboard/github-operations.mjs');
  const branch = 'codex/educame-example';
  const token = 'github_pat_example_12345678';
  let credential, created = 0, merged = 0, validChecks = false, sha = head;
  const pull = () => ({ number: 4, title: 'Ejemplo', state: merged ? 'closed' : 'open', merged: Boolean(merged),
    mergeable: true, merge_commit_sha: before, head: { sha, ref: branch }, base: { ref: 'main' } });
  const github = githubOperations({ repository: async () => 'https://github.com/educame/demo' }, {
    githubToken: () => credential, setGithubToken: value => { credential = value; },
  }, { board: () => ({ pushes: { delivery: { branch, commit: head } } }) }, async (url, options) => {
    assert.equal(new URL(url).origin, 'https://api.github.com');
    assert.equal(options.headers.Authorization, 'Bearer ' + token);
    const path = new URL(url).pathname;
    if (path.endsWith('/merge')) {
      assert.deepEqual(JSON.parse(options.body), { sha: head });
      merged++;
      return Response.json({ merged: true, sha: before });
    }
    if (path.endsWith('/branches/' + encodeURIComponent(branch))) return Response.json({ commit: { sha: head } });
    if (path.endsWith('/pulls/4/files')) return Response.json([{ filename: 'app.js', patch: '+texto' }]);
    if (path.endsWith('/pulls/4')) return Response.json(pull());
    if (path.endsWith('/check-runs')) return Response.json({ total_count: 1, check_runs: [
      { name: 'checks', status: 'completed', conclusion: validChecks ? 'success' : 'failure' },
    ] });
    if (options.method === 'POST') { created++; return Response.json(pull()); }
    return Response.json(created ? [pull()] : []);
  });
  await github.connect(token);
  await github.create(branch);
  await github.create(branch);
  assert.equal(created, 1);
  assert.equal((await github.detail(4)).files[0].patch, '+texto');
  const data = { number: 4, revision: head, confirm: head.slice(0, 7) };
  await assert.rejects(github.merge({ ...data, confirm: 'incorrecto' }), { status: 400 });
  await assert.rejects(github.merge(data), { status: 409 });
  validChecks = true;
  sha = before;
  await assert.rejects(github.merge(data), { status: 409 });
  sha = head;
  assert.equal((await github.merge(data)).sha, before);
  assert.equal((await github.merge(data)).alreadyMerged, true);
  assert.equal(merged, 1);
});

test('Hostinger conserva el despliegue confirmado y lo recupera al reabrir el panel', async t => {
  const { openPanelStore } = await import('../scripts/educame-dashboard/store.mjs');
  const { hostingerOperations } = await import('../scripts/educame-dashboard/hostinger-operations.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'educame-operations-'));
  let store = openPanelStore(directory, {});
  t.after(async () => {
    store.close();
    assert.equal(dirname(directory), tmpdir());
    await rm(directory, { recursive: true });
  });
  const calls = [];
  const changes = { deploy: async revision => { assert.equal(revision, head); } };
  const github = { connected: () => true, checks: async () => ({ ready: true }) };
  const ssh = async (target, args) => {
    assert.equal(target, 'educame-vps');
    calls.push(args);
    if (args[0] === 'check') return 'EDUCAME_HEAD ' + before + '\n';
    if (args[0] === 'start') return 'EDUCAME_STATE running\n';
    return 'EDUCAME_STATE 0\n[5/5] Comprobaciones\nDato descartado\n';
  };
  let deployment = hostingerOperations(store, changes, github, ssh);
  await deployment.connect('educame-vps');
  const plan = await deployment.prepare(head);
  const data = { id: plan.id, revision: head, confirm: head.slice(0, 7) };
  await assert.rejects(deployment.start({ ...data, revision: before }), { status: 400 });
  await deployment.start(data);
  await deployment.start(data);
  assert.deepEqual(calls.filter(args => args[0] === 'start'), [['start', plan.id, head, before]]);
  store.close();
  store = openPanelStore(directory, {});
  deployment = hostingerOperations(store, changes, github, ssh);
  const result = await deployment.readRemote();
  assert.equal(result.job.state, 'completed');
  assert.deepEqual(result.job.logs, ['[5/5] Comprobaciones']);
  assert.equal(result.history.length, 1);
});

test('El uso de Codex distingue límites y tokens y conserva la última lectura válida', async () => {
  const { createCodexUsage } = await import('../scripts/educame-dashboard/codex-usage.mjs');
  let reads = 0;
  const usage = createCodexUsage('unused', async () => ++reads === 1 ? {
    2: { rateLimits: { primary: { usedPercent: 24.5, windowDurationMins: 300, resetsAt: 1900000000 },
      secondary: { usedPercent: 0, windowDurationMins: 10080 } } },
    3: { summary: { lifetimeTokens: 54321 } },
  } : {});
  const first = await usage();
  assert.equal(first.windows[0].usedPercent, 24.5);
  assert.equal(first.windows[1].usedPercent, 0);
  assert.equal(first.accountTokens, 54321);
  assert.equal((await usage()).limitsFresh, true);
  const stale = await usage(true);
  assert.equal(stale.limitsFresh, false);
  assert.equal(stale.tokensFresh, false);
  assert.equal(stale.limitsAt, first.limitsAt);
  assert.equal(stale.accountTokens, first.accountTokens);
  assert.equal(reads, 2);
});

test('La administración exige una sesión local válida y protege los datos más recientes', async t => {
  const { createDashboard } = await import('../scripts/educame-dashboard.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'educame-operations-'));
  const organization = { id: randomUUID(), name: 'Ensayo' };
  const account = { id: randomUUID(), organization_id: organization.id, role: 'user', email: 'user@example.invalid',
    full_name: 'Ensayo', is_active: true, accesses: [] };
  let paused = false;
  let updates = 0;
  const server = await createDashboard({ directory, apiKey: '', codex: {}, fetchImpl: async (url, options) => {
    const { pathname, origin } = new URL(url);
    assert.equal(origin, 'https://educame.tech');
    if (pathname === '/auth/login') return Response.json({ access_token: JSON.parse(options.body).password,
      refresh_token: 'discarded' });
    if (pathname === '/auth/logout') return Response.json({ ok: true });
    if (options.headers.Authorization !== 'Bearer allowed') return Response.json({ detail: 'Sin permisos' }, { status: 403 });
    if (pathname === '/admin/app-availability') return Response.json({ CAMBRIDGE: { paused } });
    if (pathname === '/admin/app-availability/CAMBRIDGE') {
      paused = JSON.parse(options.body).paused;
      updates++;
      return Response.json({ paused });
    }
    if (pathname === '/admin/accounts') return Response.json({ accounts: [account] });
    if (pathname === '/admin/organizations') return Response.json([organization]);
    if (pathname === '/admin/users/' + account.id && options.method === 'GET') return Response.json(account);
    if (pathname === '/admin/users/' + account.id) {
      Object.assign(account, JSON.parse(options.body));
      return Response.json(account);
    }
    if (pathname === '/admin/licenses') {
      const data = JSON.parse(options.body);
      account.accesses.push({ license_id: randomUUID(), status: data.status, plan: data.plan, access_role: data.access_role,
        expires_at: data.expires_at, total_credits: data.usage_limit, product_code: data.product_code });
      return Response.json({ legacy_key: 'discarded' });
    }
    assert.fail(pathname);
  } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(dirname(directory), tmpdir());
    await rm(directory, { recursive: true });
  });
  const origin = 'http://127.0.0.1:' + server.address().port;
  let cookie;
  const request = (path, data, source = origin) => fetch(origin + '/api/operacion/admin' + path, {
    method: data ? 'POST' : 'GET',
    headers: { ...(cookie && { Cookie: cookie }), ...(data && { Origin: source, 'Content-Type': 'application/json' }) },
    body: data && JSON.stringify(data),
  });
  assert.deepEqual(await (await request('')).json(), { connected: false });
  const credentials = { identifier: 'admin@example.invalid', password: 'allowed' };
  assert.equal((await request('/login', credentials, 'https://other.example')).status, 403);
  assert.equal((await request('/login', { ...credentials, password: 'denied' })).status, 403);
  const login = await request('/login', credentials);
  assert.deepEqual(await login.json(), { connected: true });
  const sessionCookie = login.headers.get('set-cookie');
  assert.match(sessionCookie, /HttpOnly; SameSite=Strict/);
  cookie = sessionCookie.split(';')[0];
  assert.equal((await (await request('')).json()).accounts[0].id, account.id);
  assert.equal((await request('/pause', { product: 'CAMBRIDGE', paused: true, expected: false })).status, 200);
  assert.equal((await request('/pause', { product: 'CAMBRIDGE', paused: true, expected: false })).status, 200);
  assert.equal(updates, 1);
  const edit = { id: account.id, full_name: 'Nuevo', email: account.email, is_active: true };
  assert.equal((await request('/account', { ...edit, expected: { ...edit, full_name: 'Antiguo' } })).status, 409);
  assert.equal((await request('/account', { ...edit, expected: account })).status, 200);
  assert.equal(account.full_name, 'Nuevo');
  const license = { id: account.id, product: 'PROFESOR_PARTICULAR', status: 'active', plan: 'PROFESOR_PREMIUM',
    expires_at: new Date(Date.now() + 86400000).toISOString(), usage_limit: 100, expected: null };
  assert.deepEqual(await (await request('/license', license)).json(), { created: true });
  assert.equal((await request('/license', license)).status, 409);
  assert.equal((await request('/logout', {})).status, 200);
  assert.deepEqual(await (await request('')).json(), { connected: false });
});
