const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function landing(settings, ok = true) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, {textContent:'',innerHTML:'',href:id==='googleEntry'?'/auth/google/login?next=%2Feso-adultos':'',hidden:false,setAttribute(){},removeAttribute(name){if(name==='href')this.href='';}});
    return elements.get(id);
  };
  get('priceAnswer').textContent = 'Consulta las condiciones al registrarte.';
  const context = vm.createContext({document:{getElementById:get},location:{protocol:'http:'},fetch:async url=>({ok: url.includes('google/status') || ok,json:async()=>url.includes('google/status')?{enabled:true}:settings})});
  const html = fs.readFileSync(path.join(__dirname, '../marketing/app_landings_demo/eso-adultos.html'), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('loadFreeAccess();', '');
  vm.runInContext(source, context);
  return {get,run:()=>vm.runInContext('loadFreeAccess()',context)};
}

test('landing displays the configured allowance instead of a fixed promise', async()=>{
  const {get,run} = landing({enabled:true,credits:25,days:30});
  await run();
  assert.match(get('priceAnswer').textContent,/25 créditos/);
  assert.match(get('priceAnswer').textContent,/30 días/);
  assert.match(get('priceAnswer').textContent,/No se renuevan automáticamente/);
});

test('closed registration explains the pause while keeping the Google entry visible', async()=>{
  const {get,run} = landing({enabled:false});
  await run();
  assert.equal(get('googleEntry').href,'/auth/google/login?next=%2Feso-adultos');
  assert.match(get('priceAnswer').textContent,/pausadas temporalmente/);
});

test('unavailable configuration preserves access without inventing credit numbers', async()=>{
  const {get,run} = landing(null,false);
  await run();
  assert.equal(get('googleEntry').href,'/auth/google/login?next=%2Feso-adultos');
  assert.equal(get('priceAnswer').textContent,'Consulta las condiciones al registrarte.');
});
