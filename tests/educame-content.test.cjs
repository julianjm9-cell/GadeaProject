const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtemp,mkdir,writeFile,readFile,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join,resolve,relative}=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {randomUUID}=require('node:crypto');
const {once}=require('node:events');
const exec=promisify(execFile);
const source='<!doctype html><html><head><title>Inglés</title></head><body><h1>La biblioteca</h1><script>globalThis.noEjecutar=true; const GAME={id:"juego-1",title:"La biblioteca",question:"¿Qué necesitas?",options:["Un libro","Una llave"],correct:0,explanation:"El libro se presta."};</script></body></html>\n';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'educame-content-')),root=join(directory,'repo'),data=join(directory,'data');
  const cleanup=[],stores=[];
  await mkdir(join(root,'apps/cambridge'),{recursive:true});await mkdir(join(root,'tests'));await mkdir(data);
  const git=async(...args)=>(await exec('git',args,{cwd:root,windowsHide:true})).stdout.trim();
  await git('init','-b','main');await git('config','user.email','content@example.invalid');await git('config','user.name','Content fixture');
  await writeFile(join(root,'apps/cambridge/index.html'),source);
  await writeFile(join(root,'tests/content-check.test.cjs'),"require('node:test')('contenido seguro',()=>require('node:assert/strict').match(require('node:fs').readFileSync('apps/cambridge/index.html','utf8'),/juego-1/));");
  await git('add','.');await git('-c','commit.gpgsign=false','commit','-m','Base');
  t.after(async()=>{for(const close of cleanup)await close();for(const store of stores)try{store.close();}catch{}assert.match(relative(resolve(tmpdir()),resolve(directory)),/^educame-content-[\w-]+$/);await rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
  const {openPanelStore}=await import('../scripts/educame-dashboard/store.mjs');
  const openStore=()=>{const store=openPanelStore(data,{revision:0,tasks:[],links:[],memory:[],pushes:{},reviews:{}});stores.push(store);return store;};
  return {root,data,directory,git,openStore,cleanup};
}

test('el catálogo lee datos y HTML sin ejecutar código ni exponer identificadores o claves',async()=>{
  const {extractContent}=await import('../scripts/educame-dashboard/content-catalog.mjs');
  const parsed=extractContent('apps/cambridge/index.html',source.replace('const GAME','function repeated(){} function repeated(){} const GAME'));
  assert.deepEqual(parsed.diagnostics,[]);assert.equal(global.noEjecutar,undefined);
  const game=parsed.groups.find(g=>g.category==='juegos');assert.ok(game);
  assert.ok(game.fields.some(f=>f.value==='¿Qué necesitas?'));
  assert.ok(!game.fields.some(f=>f.value==='juego-1'));
  const factory=extractContent('apps/e25/assets/eso-english-missions.js',"const data={title:'Biblioteca',topicId:'ref-estable',modules:['module-estable'],stages:[step('Acceso','Bring your card.','¿Qué traes?',['Tarjeta','Libro'],0,'Card significa tarjeta.')]}; race('identidad-estable','Una carrera',[], 'Repasa.');");
  assert.ok(factory.groups.some(g=>g.fields.some(f=>f.label.startsWith('Respuesta correcta'))));
  assert.ok(!factory.groups.flatMap(g=>g.fields).some(f=>f.value==='identidad-estable'));
  assert.ok(!factory.groups.flatMap(g=>g.fields).some(f=>['ref-estable','module-estable'].includes(f.value)));
});

test('borrador persistente, conflicto entre pestañas, corrección exacta y reenvío sin duplicar',async t=>{
  const f=await fixture(t),{createContentCatalog}=await import('../scripts/educame-dashboard/content-catalog.mjs');
  let store=f.openStore();const batches=new Map();const start=async body=>{if(!batches.has(body.tasks[0].id))batches.set(body.tasks[0].id,{id:randomUUID(),state:'queued'});return batches.get(body.tasks[0].id);};
  let catalog=createContentCatalog({root:f.root,store,start});
  const result=await catalog.search(new URLSearchParams('app=ingles&kind=juegos&q=necesitas'));
  assert.equal(result.total,1);let item=await catalog.detail(result.items[0].id);
  const question=item.fields.find(field=>field.value==='¿Qué necesitas?');const values={[question.id]:'¿Qué libro necesitas? <script>alert(1)</script> "😀"'};
  await catalog.draft({id:item.id,version:item.version,revision:0,values,note:''});
  await assert.rejects(catalog.draft({id:item.id,version:item.version,revision:0,values:{},note:''}),{status:409});
  store.close();store=f.openStore();catalog=createContentCatalog({root:f.root,store,start});
  item=await catalog.detail(item.id);assert.deepEqual(item.draft.values,values);
  const body={id:item.id,version:item.version,values,note:'',requestId:randomUUID(),engine:'codex'};
  const first=await catalog.submit(body),second=await catalog.submit(body);assert.equal(first.batchId,second.batchId);assert.equal(batches.size,1);
  await assert.rejects(catalog.submit({...body,values:{[question.id]:'Otra pregunta'}}),{status:409});
  const before=await readFile(join(f.root,'apps/cambridge/index.html'),'utf8');assert.equal(before,source,'no modifica el checkout al enviar');
  await catalog.apply(first.taskId,f.root);await catalog.verify(first.taskId,f.root,['apps/cambridge/index.html']);
  const after=await readFile(join(f.root,'apps/cambridge/index.html'),'utf8');assert.ok(after.includes('\\u003cscript\\u003e'));assert.match(after,/id:"juego-1"/);
  const edited=await catalog.detail(item.id);assert.equal(edited.fields.find(field=>field.id===question.id).value,values[question.id]);
  await assert.rejects(catalog.submit({...body,requestId:randomUUID()}),{status:409});
  await writeFile(join(f.root,'apps/cambridge/index.html'),after.replace('El libro se presta.','Otro contenido.'));
  await assert.rejects(catalog.verify(first.taskId,f.root),{status:409});
});

test('las plantillas Python mantienen Unicode, los datos JSON y el texto HTML conservan su formato',async t=>{
  const f=await fixture(t);await mkdir(join(f.root,'backend/app/services'),{recursive:true});await mkdir(join(f.root,'backend/app/data'),{recursive:true});
  await writeFile(join(f.root,'backend/app/services/teacher_challenge_games.py'),'# 😀 antes del contenido\nDATA = {"title": "Árbol de palabras", "question": "¿Qué ves?", "answer": "Árbol"}\n');
  await writeFile(join(f.root,'backend/app/data/profesor-temario.json'),JSON.stringify([{id:'estable',title:'Un tema',answer:'Sí'}]));await f.git('add','.');await f.git('-c','commit.gpgsign=false','commit','-m','Contenido');
  const store=f.openStore();const {createContentCatalog}=await import('../scripts/educame-dashboard/content-catalog.mjs');const catalog=createContentCatalog({root:f.root,store,start:async()=>({id:'batch',state:'queued'})});
  for(const [query,original,replacement]of [['Árbol de palabras','¿Qué ves?','¿Qué árbol ves? 😀'],['Un tema','Sí','Sí, con una explicación'],['La biblioteca','La biblioteca','Biblioteca & preguntas <seguras>']]){
    const results=await catalog.search(new URLSearchParams({q:query}));
    const entry=await catalog.detail(results.items.find(i=>query==='La biblioteca'?i.category==='interfaz':true).id),field=entry.fields.find(f=>f.value===original);
    const result=await catalog.submit({id:entry.id,version:entry.version,values:{[field.id]:replacement},note:'',requestId:randomUUID()});
    await catalog.apply(result.taskId,f.root);await catalog.verify(result.taskId,f.root);
    const changed=await catalog.detail(entry.id);assert.equal(changed.fields.find(f=>f.id===field.id).value,replacement);
  }
});

test('una corrección real recorre revisión, pruebas, cola y remoto Git de ensayo sin regenerar el texto', {timeout:60000}, async t=>{
  const f=await fixture(t),remote=join(f.directory,'remote.git');await f.git('init','--bare',remote);await f.git('remote','add','origin',remote);await f.git('push','origin','main');
  const {createDashboard}=await import('../scripts/educame-dashboard.mjs');let reviews=0;
  const server=await createDashboard({directory:f.data,repositoryRoot:f.root,apiKey:'',automaticPublication:true,implementationOptions:{localRemote:true},fetchImpl:async()=>Response.json({}),codex:{status:async()=>({ready:true}),models:async()=>[],implement:async task=>{
    assert.ok(task.revision,'la corrección exacta no necesita un implementador que reescriba los campos');reviews++;
    return {draft:{resumen:'Revisado',entrega:'Corrección conservada',comprobaciones:[],pendientes:[]},checks:[{command:'node --test tests/content-check.test.cjs'}]};
  }}});server.listen(0,'127.0.0.1');await once(server,'listening');f.cleanup.push(async()=>{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await new Promise(resolve=>setTimeout(resolve,250));});
  const origin='http://127.0.0.1:'+server.address().port,call=async(path,body)=>{const response=await fetch(origin+path,body?{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;};
  const found=await call('/api/content/catalog?app=ingles&kind=juegos');const item=await call('/api/content/item?id='+found.items[0].id),field=item.fields.find(f=>f.value==='¿Qué necesitas?');
  const request={id:item.id,version:item.version,values:{[field.id]:'¿Qué libro vas a pedir?'},note:'',requestId:randomUUID()};
  const sent=await call('/api/content/submit',request);assert.deepEqual(await call('/api/content/submit',request),sent);
  let completed=false,panel;
  for(let i=0;i<150;i++){panel=await call('/api/panel');if(panel.board.pushes?.['implementacion/'+sent.taskId]?.integratedRevision){completed=true;break;}if(panel.batch?.state==='finished'&&panel.history.some(row=>row.error))break;await new Promise(resolve=>setTimeout(resolve,200));}
  assert.ok(completed,JSON.stringify({batch:panel.batch,publication:panel.publication,history:panel.history}));assert.equal(reviews,1);
  assert.match(await f.git('show','refs/remotes/origin/main:apps/cambridge/index.html'),/¿Qué libro vas a pedir\?/);
  const outside=await fetch(origin+'/api/content/submit',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:JSON.stringify(request)});assert.equal(outside.status,403);
});
