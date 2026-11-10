import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export function readCodexAppServer(executable, requests) {
  return new Promise(resolve => {
    const child = spawn(executable, ['app-server', '--listen', 'stdio://'], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'],
    });
    const replies = {};
    const lines = createInterface({ input: child.stdout });
    let finished = false;
    const timer = setTimeout(finish, 12_000);
    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      lines.close();
      child.kill();
      resolve(replies);
    }
    const send = message => child.stdin.write(JSON.stringify(message) + '\n');
    child.stdin.on('error', finish);
    child.on('error', finish);
    child.on('close', finish);
    lines.on('line', line => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (message.id === 1) {
        if (!message.result) return finish();
        send({ method: 'initialized' });
        requests.forEach((request, index) => send({ id: index + 2, ...request }));
      }
      if (Number.isInteger(message.id) && message.id >= 2 && message.id < requests.length + 2) {
        replies[message.id] = message.result || null;
        if (Object.keys(replies).length === requests.length) finish();
      }
    });
    send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'educame_dashboard', version: '1.0.0' } } });
  });
}

const readAccount = executable => readCodexAppServer(executable, [
  { method: 'account/rateLimits/read' }, { method: 'account/usage/read', params: {} },
]);

const validCount = value => Number.isFinite(value) && value >= 0;

export function createCodexUsage(executable, query = readAccount) {
  let pending;
  let cached;
  let lastSuccess = {};
  let nextCheck = 0;
  return function usage(refresh = false) {
    if (pending) return pending;
    if (!refresh && Date.now() < nextCheck) return Promise.resolve(cached);
    pending = query(executable).catch(() => ({})).then(replies => {
      const limits = replies[2]?.rateLimits;
      const windows = [limits?.primary, limits?.secondary].filter(window => validCount(window?.usedPercent))
        .map(window => ({ usedPercent: Math.min(100, window.usedPercent),
          durationMinutes: validCount(window.windowDurationMins) ? window.windowDurationMins : null,
          resetsAt: validCount(window.resetsAt) ? window.resetsAt : null }));
      const total = replies[3]?.summary?.lifetimeTokens;
      const accountTokens = validCount(total) ? total : null;
      const checkedAt = new Date().toISOString();
      if (windows.length) lastSuccess = { ...lastSuccess, windows, limitsAt: checkedAt };
      if (accountTokens !== null) lastSuccess = { ...lastSuccess, accountTokens, tokensAt: checkedAt };
      cached = { ...lastSuccess, checkedAt, limitsFresh: Boolean(windows.length), tokensFresh: accountTokens !== null };
      nextCheck = Date.now() + 60_000;
      return cached;
    }).finally(() => { pending = null; });
    return pending;
  };
}
