const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join,dirname}=require('node:path');
const {once}=require('node:events');

test('la cola del chat persiste, conserva el orden y no duplica mensajes al reabrir',async t=>{
 const {createChat}=await import('../scripts/educame-dashboard/chat.mjs');
 const {openPanelStore}=await import('../scripts/educame-dashboard/store.mjs');
 const {OperationError}=await import('../scripts/educame-dashboard/operations.mjs');
 const directory=await mkdtemp(join(tmpdir(),'educame-chat-queue-'));
 let store,chat,busy=true,release;
 const gate=new Promise(resolve=>{release=resolve;});
 const received=[],deliveries=new Map();
 const options={
  codex:{status:async()=>({ready:true}),models:async()=>[{id:'modelo'}],ask:async input=>{
   received.push({kind:'ask',...input});await gate;return{answer:'Respuesta guardada'};
  }},
  runner:{start:async input=>{received.push({kind:'change',...input});const id=input.tasks[0].id;
   deliveries.set(id,{app:'control',draft:{resumen:'Cambio preparado'},implementation:{verified:true,commit:'a'.repeat(40)}});
   return{id:'lote',state:'finished',tasks:input.tasks};}},
  readDelivery:async id=>deliveries.get(id),implementation:{},instance:'ensayo',
  assertIdle(){if(busy)throw new OperationError(409,'Publicación en curso');}
 };
 const open=()=>{store=openPanelStore(directory,{tasks:[],reviews:{},pushes:{},revision:0});chat=createChat({...options,store});};
 t.after(async()=>{release();chat.close();await chat.wait();store.close();assert.equal(dirname(directory),tmpdir());await rm(directory,{recursive:true,force:true});});
 open();
 const ask={id:randomUUID(),mode:'ask',model:'modelo',text:'Primera pregunta'};
 const change={id:randomUUID(),mode:'change',model:'modelo',text:'Segundo encargo'};
 await chat.send(ask);await chat.send(change);await chat.send(ask);
 assert.deepEqual((await chat.read()).messages.map(row=>row.state),['queued','queued']);
 assert.equal(received.length,0);
 chat.close();await chat.wait();store.close();open();
 busy=false;
 await chat.pump();
 assert.equal(received.length,1);
 await chat.send(change);
 assert.equal(received.length,1);
 release();await chat.wait();await chat.pump();await chat.wait();
 const result=await chat.read();
 assert.deepEqual(result.messages.map(row=>row.state),['answer','proposal']);
 assert.deepEqual(received.map(row=>row.kind),['ask','change']);
 assert.match(received[1].tasks[0].contexto,/Respuesta guardada/);
 await chat.send(change);
 assert.equal(received.length,2);
});

test('un bloqueo que aparece al arrancar vuelve a espera y los errores antiguos se reintentan con el mismo id',async t=>{
 const {createChat}=await import('../scripts/educame-dashboard/chat.mjs');
 const {openPanelStore}=await import('../scripts/educame-dashboard/store.mjs');
 const {OperationError}=await import('../scripts/educame-dashboard/operations.mjs');
 const directory=await mkdtemp(join(tmpdir(),'educame-chat-queue-'));
 const store=openPanelStore(directory,{tasks:[],reviews:{},pushes:{},revision:0});
 const request={id:randomUUID(),mode:'change',model:'modelo',text:'Continúa este cambio'};
 store.writeOperation('terrace-chat-v1',[{...request,taskId:'terraza-'+request.id,state:'error',reply:'Hay un lote en marcha.'}]);
 let attempts=0;
 const chat=createChat({store,instance:'ensayo',implementation:{},assertIdle(){},
  codex:{status:async()=>({ready:true}),models:async()=>[{id:'modelo'}]},
  readDelivery:async()=>undefined,
  runner:{start:async input=>{attempts++;assert.equal(input.tasks[0].id,'terraza-'+request.id);throw new OperationError(409,'Hay un lote en marcha.');}}
 });
 t.after(async()=>{chat.close();await chat.wait();store.close();assert.equal(dirname(directory),tmpdir());await rm(directory,{recursive:true,force:true});});
 assert.equal((await chat.read()).messages[0].retryable,true);
 await chat.send(request);await chat.wait();
 assert.equal(store.operation('terrace-chat-v1')[0].state,'queued');
 assert.equal(attempts,1);
});

test('el servidor retoma el chat al terminar otro encargo sin necesitar consultas del navegador',{timeout:15000},async t=>{
 const {createDashboard}=await import('../scripts/educame-dashboard.mjs');
 const directory=await mkdtemp(join(tmpdir(),'educame-chat-queue-'));
 let release,answered;
 const gate=new Promise(resolve=>{release=resolve;});
 const done=new Promise(resolve=>{answered=resolve;});
 const server=await createDashboard({directory,apiKey:'',codex:{status:async()=>({ready:true}),
  models:async()=>[{id:'modelo'}],generate:async()=>{await gate;return{draft:{resumen:'Otro encargo',entrega:'Terminado',comprobaciones:[],pendientes:[]}};},
  ask:async()=>{answered();return{answer:'Ya está libre'};}
 }});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{release();await new Promise(resolve=>server.close(resolve));assert.equal(dirname(directory),tmpdir());await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:80});});
 const base='http://127.0.0.1:'+server.address().port;
 const post=(path,body)=>fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('/api/encargos',{mode:'real',engine:'codex',tasks:[{id:'otro',app:'control',agente:'codex',encargo:'Otro trabajo'}]})).status,202);
 const response=await post('/api/chat',{id:randomUUID(),mode:'ask',model:'modelo',text:'¿Puedes responder después?'});
 assert.equal(response.status,202);
 assert.equal((await response.json()).messages[0].state,'queued');
 release();
 await done;
 const state=await (await fetch(base+'/api/chat')).json();
 assert.equal(state.messages[0].state,'answer');
});

test('el coordinador retoma un plan guardado sin volver a planificar ni duplicar el encargo', async t => {
 const {createChat}=await import('../scripts/educame-dashboard/chat.mjs');
 const {openPanelStore}=await import('../scripts/educame-dashboard/store.mjs');
 const directory=await mkdtemp(join(tmpdir(),'educame-chat-queue-'));
 let store=openPanelStore(directory,{tasks:[],reviews:{},pushes:{},revision:0}),chat,blocked=true,planned=0;
 const ids=[],deliveries=new Map();
 const options={instance:'ensayo',implementation:{},assertIdle(){},readDelivery:async id=>deliveries.get(id),
  codex:{status:async()=>({ready:true}),models:async()=>[{id:'modelo'}],coordinate:async()=>{planned++;return{plan:{action:'implement',reply:'Preparando',
   tasks:[{app:'ingles',agent:'juegos',request:'Mejora el juego sin borrar contenido',after:null}]}};}},
  runner:{start:async input=>{
   ids.push(input.tasks[0].id);
   if(blocked)throw Object.assign(new Error('Operación en curso'),{status:409});
   const task=input.tasks[0];deliveries.set(task.id,{id:task.id,app:task.app,draft:{resumen:'Terminado'},implementation:{verified:true,commit:'a'.repeat(40)}});
   const batch={id:'guardado',state:'finished',tasks:input.tasks,jobs:{[task.id]:{status:'completado'}}};store.insert(batch);return batch;
  }} };
 chat=createChat({...options,store});
 t.after(async()=>{chat.close();await chat.wait();store.close();assert.equal(dirname(directory),tmpdir());await rm(directory,{recursive:true,force:true});});
 const message={id:randomUUID(),mode:'auto',model:'modelo',text:'Mejora el juego de Inglés'};
 await chat.send(message);await chat.wait();
 assert.equal(store.operation('terrace-chat-v1')[0].state,'queued');
 assert.ok(store.operation('terrace-chat-v1')[0].plan);
 chat.close();await chat.wait();store.close();
 store=openPanelStore(directory,{});blocked=false;chat=createChat({...options,store});
 await chat.pump();await chat.wait();
 const result=await chat.read();
 assert.equal(result.messages[0].state,'proposal');
 assert.equal(planned,1);assert.equal(new Set(ids).size,1);
});

test('las preguntas automáticas se responden aunque otro agente esté implementando', {timeout:15000}, async t => {
 const {createDashboard}=await import('../scripts/educame-dashboard.mjs');
 const directory=await mkdtemp(join(tmpdir(),'educame-chat-queue-'));
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const server=await createDashboard({directory,apiKey:'',codex:{status:async()=>({ready:true}),models:async()=>[{id:'modelo'}],
  generate:async()=>{await gate;return{draft:{resumen:'Terminado',entrega:'Ensayo',comprobaciones:[],pendientes:[]}};},
  coordinate:async()=>({plan:{action:'answer',reply:'Puedes seguir preguntando.',tasks:[]}})
 }});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{release();await new Promise(resolve=>server.close(resolve));assert.equal(dirname(directory),tmpdir());await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:80});});
 const base='http://127.0.0.1:'+server.address().port;
 const get=path=>fetch(base+path).then(response=>response.json());
 const post=(path,body)=>fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});
 await post('/api/encargos',{mode:'real',engine:'codex',tasks:[{id:'trabajando',app:'profesor',agente:'juegos',encargo:'Otro trabajo'}]});
 assert.equal((await get('/api/panel')).batch.state,'running');
 await post('/api/chat',{id:randomUUID(),model:'modelo',text:'¿Qué es una copia aislada?'});
 for(let i=0;i<60;i++){
  const chat=await get('/api/chat');
  if(chat.messages[0]?.state==='answer')break;
  await new Promise(resolve=>setTimeout(resolve,25));
 }
 assert.equal((await get('/api/chat')).messages[0].reply,'Puedes seguir preguntando.');
 assert.equal((await get('/api/panel')).batch.state,'running');
});

test('el chat actualiza una entrega reparada y publicada sin reenviar agentes ni perder el error anterior', async t => {
 const {createChat}=await import('../scripts/educame-dashboard/chat.mjs');
 const {openPanelStore}=await import('../scripts/educame-dashboard/store.mjs');
 const directory=await mkdtemp(join(tmpdir(),'educame-chat-queue-'));
 const store=openPanelStore(directory,{tasks:[],reviews:{},pushes:{},revision:0});
 const id=randomUUID(),taskId='reparada',commit='a'.repeat(40);let verified=false,calls=0,writes=0;
 store.insert({id:'lote',state:'finished',jobs:{[taskId]:{status:'borrador'}}});
 store.writeOperation('terrace-chat-v1',[{id,taskId,taskIds:[taskId],batchId:'lote',mode:'auto',state:'error',
  text:'Arregla Inglés',reply:'Las pruebas necesitaban atención.',plan:{tasks:[{id:taskId,app:'ingles',encargo:'Arregla Inglés'}]}}]);
 const write=store.writeOperation;store.writeOperation=(...args)=>{writes++;return write(...args);};
 const chat=createChat({store,instance:'ensayo',implementation:{},assertIdle(){},
  readDelivery:async()=>({id:taskId,app:'ingles',draft:{resumen:'Reparado'},implementation:{verified,commit,files:['apps/cambridge/index.html']}}),
  runner:{start:async()=>{calls++;throw Error('No debe reenviar');}},codex:{coordinate:async()=>{calls++;throw Error('No debe consultar');}}});
 t.after(async()=>{chat.close();await chat.wait();store.close();assert.equal(dirname(directory),tmpdir());await rm(directory,{recursive:true,force:true});});
 assert.equal((await chat.read()).messages[0].state,'error');
 verified=true;store.update({id:'lote',state:'finished',jobs:{[taskId]:{status:'completado'}}});
 const repaired=(await chat.read()).messages[0];
 assert.equal(repaired.state,'proposal');assert.equal(repaired.previousError.reply,'Las pruebas necesitaban atención.');
 const board=store.board();store.writeBoard({...board,pushes:{['implementacion/'+taskId]:{commit,integratedRevision:commit}}});
 const published=(await chat.read()).messages[0];
 assert.match(published.reply,/subidos a GitHub/);assert.equal(published.proposals.length,1);
 const before=writes;await chat.read();assert.equal(writes,before,'no reescribe estados idénticos');
 await chat.wait();assert.equal(calls,0);
});
