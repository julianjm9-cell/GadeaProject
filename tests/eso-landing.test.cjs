const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function landing(settings, ok = true) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, {textContent:'',innerHTML:'',href:'/e25/login?mode=register'});
    return elements.get(id);
  };
  get('signupSummary').textContent = 'Consulta las condiciones al registrarte.';
  const context = vm.createContext({document:{getElementById:get},location:{protocol:'http:'},fetch:async()=>({ok,json:async()=>settings})});
  const html = fs.readFileSync(path.join(__dirname, '../marketing/app_landings_demo/eso-adultos.html'), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('loadFreeAccess();', '');
  vm.runInContext(source, context);
  return {get,run:()=>vm.runInContext('loadFreeAccess()',context)};
}

test('landing displays the configured allowance instead of a fixed promise', async()=>{
  const {get,run} = landing({enabled:true,credits:25,days:30});
  await run();
  assert.match(get('signupSummary').textContent,/25 créditos/);
  assert.match(get('priceAnswer').textContent,/30 días/);
  assert.match(get('priceAnswer').textContent,/No se renuevan automáticamente/);
});

test('closed registration routes visitors to existing-account login', async()=>{
  const {get,run} = landing({enabled:false});
  await run();
  assert.equal(get('registerLink').href,'/e25/login');
  assert.match(get('signupSummary').textContent,/cerrado temporalmente/);
});

test('unavailable configuration preserves access without inventing credit numbers', async()=>{
  const {get,run} = landing(null,false);
  await run();
  assert.equal(get('registerLink').href,'/e25/login?mode=register');
  assert.equal(get('signupSummary').textContent,'Consulta las condiciones al registrarte.');
});
