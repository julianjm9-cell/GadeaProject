const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function page() {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { value: '', hidden: false, textContent: '', disabled: false });
    return elements.get(id);
  };
  const location = { pathname: '/e25/login', search: '?mode=register', href: '' };
  const calls = [];
  const context = vm.createContext({
    URLSearchParams, location,
    document: { getElementById: get },
    fetch: async (url, options) => {
      calls.push({url, options});
      return { ok: true, json: async () => url.includes('signup-settings') ? {enabled: true, credits: 100, days: 365} : {ok: true} };
    }
  });
  const source = fs.readFileSync(path.join(__dirname, '../backend/app/static/login.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(source.replace('applyLoginBrand();\napplyLoginLinks();\nloadSignupSettings();', ''), context);
  return { get, location, calls, run: code => vm.runInContext(code, context) };
}

test('free signup submits to ESO and enters the ESO app', async () => {
  const {get, location, calls, run} = page();
  await run('loadSignupSettings()');
  assert.equal(get('signupFields').hidden, false);
  assert.match(get('signupAllowance').textContent, /100 créditos/);
  get('email').value = 'alumna@example.com';
  get('fullName').value = 'Alumna';
  get('password').value = get('confirmPassword').value = 'password123';
  await run('login({preventDefault(){}})');
  assert.equal(calls[1].url, '/auth/eso/register');
  assert.equal(JSON.parse(calls[1].options.body).full_name, 'Alumna');
  assert.equal(location.href, '/eso-adultos');
  assert.equal(get('submitButton').disabled, false);
});

test('existing-account mode preserves login and opts into ESO access', async () => {
  const {get, calls, run} = page();
  await run('loadSignupSettings()');
  run('toggleSignup(false)');
  get('email').value = 'existente@example.com';
  get('password').value = 'password123';
  await run('login({preventDefault(){}})');
  assert.equal(calls[1].url, '/auth/login');
  assert.equal(JSON.parse(calls[1].options.body).enroll_eso, true);
  assert.equal(get('fullName').required, false);
});

test('password mismatch does not send a signup request', async () => {
  const {get, calls, run} = page();
  await run('loadSignupSettings()');
  get('password').value = 'password123';
  get('confirmPassword').value = 'different123';
  await run('login({preventDefault(){}})');
  assert.equal(calls.length, 1);
  assert.match(get('error').textContent, /no coinciden/);
});
