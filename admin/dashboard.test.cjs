const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function loadDashboard() {
  const html = fs.readFileSync(require('node:path').join(__dirname, 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'admin script is present');
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', innerHTML: '', textContent: '', hidden: false,
      classList: { add() {}, remove() {}, toggle() {} },
      reset() {}, focus() {}, scrollIntoView() {}
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { getElementById: element, querySelectorAll: () => [] },
    localStorage: { getItem: () => '', removeItem() {} },
    window: {}, setTimeout: () => 0, clearTimeout() {},
    console, Date, Math, JSON
  });
  vm.runInContext(script, context);
  return { context, element, run: source => vm.runInContext(source, context) };
}

test('the overview does not duplicate app or user controls', () => {
  const { run, element } = loadDashboard();
  run(`accounts=[{id:'u1',is_active:true,accesses:[{product_code:'ESO_ADULTOS',effective_status:'active',used_credits:4}]}];ai={capabilities:[{configured:true}]};renderOverview()`);
  assert.match(element('globalMetrics').innerHTML, /Créditos gastados/);
  assert.match(element('globalMetrics').innerHTML, />4</);
  assert.doesNotMatch(fs.readFileSync(require('node:path').join(__dirname, 'index.html'), 'utf8'), /id="view-users"|id="appCards"|id="recentUsage"|id="alerts"/);
});

test('editing an ESO student grants credits only to ESO', async () => {
  const { run, element } = loadDashboard();
  run(`currentApp='eso';users=[{id:'u1',email:'alumno@example.com',full_name:'Alumno',is_active:true}];accounts=[{id:'u1',email:'alumno@example.com',full_name:'Alumno',is_active:true,accesses:[{product_code:'ESO_ADULTOS',status:'active',effective_status:'active',total_credits:20,used_credits:5,available_credits:15,expires_at:'2027-01-01T00:00:00Z'},{product_code:'DIPLOMATOR',status:'active',effective_status:'active',total_credits:40,used_credits:10,available_credits:30}]}];renderApp();openUser('u1')`);
  assert.match(element('appUsersTable').innerHTML, /alumno@example.com/);
  assert.equal(element('creditAvailablePreview').textContent, '15');
  element('editAddCredits').value = '8';
  run('updateCreditPreview()');
  assert.equal(element('creditTotalPreview').textContent, '28');
  assert.equal(element('creditUsedPreview').textContent, '5');
  assert.equal(element('creditAvailablePreview').textContent, '23');
  run(`globalThis.calls=[];api=async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return {ok:true}};loadAll=async()=>{}`);
  await run('saveSelectedUser({preventDefault(){}})');
  const calls = run('calls');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].path, '/admin/users/u1/access/ESO_ADULTOS');
  assert.equal(calls[1].body.usage_limit, 28);
  assert.equal(calls[0].body.email, 'alumno@example.com');
});

test('an existing blocked account must be explicitly reactivated', async () => {
  const { run, element } = loadDashboard();
  run(`currentApp='eso';users=[{id:'u2',email:'bloqueado@example.com',full_name:'Bloqueado',role:'user',is_active:false,organization_id:'org1'}];accounts=[{id:'u2',email:'bloqueado@example.com',is_active:false,accesses:[]}];orgs=[];globalThis.calls=[];api=async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return {ok:true}};loadAll=async()=>{}`);
  element('newEmail').value = 'bloqueado@example.com';
  element('newLimit').value = '30';
  element('newDays').value = '90';
  run('updateCreateAccountHint()');
  assert.equal(element('newReactivateBox').hidden, false);
  assert.equal(element('newReactivate').required, true);
  assert.equal(element('newPassword').required, false);
  element('newReactivate').checked = true;
  await run('createAppUser({preventDefault(){},target:{reset(){}}})');
  const calls = run('calls');
  assert.equal(calls[0].path, '/admin/licenses');
  assert.equal(calls[0].body.product_code, 'ESO_ADULTOS');
  assert.equal(calls[1].path, '/admin/users/u2');
  assert.equal(calls[1].body.is_active, true);
});

test('a new account is created inside the selected app', async () => {
  const { run, element } = loadDashboard();
  run(`currentApp='cambridge';users=[];accounts=[];orgs=[{id:'org-cam',name:'Educa Suite - Cambridge'}];globalThis.calls=[];api=async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return path==='/admin/users'?{id:'new-user',organization_id:'org-cam'}:{ok:true}};loadAll=async()=>{}`);
  element('newEmail').value = 'nuevo@example.com';
  element('newPassword').value = 'password123';
  element('newName').value = 'Nuevo alumno';
  element('newLimit').value = '50';
  element('newDays').value = '365';
  await run('createAppUser({preventDefault(){},target:{reset(){}}})');
  const calls = run('calls');
  assert.equal(calls[0].path, '/admin/users');
  assert.equal(calls[1].path, '/admin/licenses');
  assert.equal(calls[1].body.product_code, 'CAMBRIDGE');
  assert.equal(calls[1].body.usage_limit, 50);
});
