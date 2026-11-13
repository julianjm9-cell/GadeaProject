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
 t.after(async()=>{release();await new Promise(resolve=>server.close(resolve));assert.equal(dirname(directory),tmpdir());await rm(directory,{recursive:true,force:true});});
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
