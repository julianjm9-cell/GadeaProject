const {test}=require('node:test');
const assert=require('node:assert/strict');

test('la subida automática conserva el recibo, exige reintento tras un fallo y no repite la implementación',async()=>{
 const {createAutomaticPublication}=await import('../scripts/educame-dashboard/automatic-publication.mjs');
 const operations=new Map(),batch={id:'uno',mode:'implementacion',state:'finished',automaticPublication:true,tasks:[{id:'juego'}]};
 const board={pushes:{},reviews:{}};
 const store={operation:key=>structuredClone(operations.get(key)),writeOperation:(key,value)=>operations.set(key,structuredClone(value)),transaction:fn=>fn(),batches:()=>[batch],board:()=>board};
 let calls=0,current=null;
 const publication={status:()=>current,busy:()=>false,upload:async payload=>{calls++; current={uploadId:payload.id,state:'failed',message:'GitHub no responde.'};}};
 let service=createAutomaticPublication({store,publication,readDelivery:async()=>({implementation:{commit:'c'.repeat(40),verified:true}})});
 await Promise.all([service.pump(),service.pump()]);
 assert.equal(calls,1);
 await service.pump();
 assert.equal(service.status().juego.state,'failed');
 service=createAutomaticPublication({store,publication,readDelivery:async()=>({implementation:{commit:'c'.repeat(40),verified:true}})});
 await service.pump();assert.equal(calls,1,'reiniciar no dispara un bucle de subidas');
 service.retry('juego');await service.pump();assert.equal(calls,2);
 board.pushes['implementacion/juego']={commit:'c'.repeat(40),integratedRevision:'a'.repeat(40),undoneRevision:'b'.repeat(40)};
 await service.pump();assert.equal(service.status().juego.state,'undone');assert.equal(calls,2);
});

test('la cola no duplica tareas del chat ni anuncia completado antes de confirmar su revisión en GitHub',async()=>{
 const {queueEntries}=await import('../scripts/educame-dashboard/queue-view.js');
 const state={board:{pushes:{}},history:[{id:'juego',mode:'implementacion',implementation:{commit:'a'.repeat(40),verified:true}}],
 batches:[{id:'lote',mode:'implementacion',state:'finished',tasks:[{id:'juego',app:'ingles',encargo:'Mejora el juego'}],jobs:{juego:{status:'completado'}}}]};
 const messages=[{id:'mensaje',batchId:'lote',taskIds:['juego'],text:'Petición original',state:'proposal'}];
 let entries=queueEntries(state,messages);assert.equal(entries.length,1);assert.equal(entries[0].status,'publishing');
 state.board.pushes['implementacion/juego']={commit:'c'.repeat(40),integratedRevision:'d'.repeat(40)};
 assert.notEqual(queueEntries(state,messages)[0].status,'completed','una revisión anterior subida no confirma la actual');
 state.board.pushes['implementacion/juego'].commit='a'.repeat(40);
 assert.equal(queueEntries(state,messages)[0].status,'completed');
 state.board.pushes['implementacion/juego'].undoneRevision='e'.repeat(40);
 assert.equal(queueEntries(state,messages)[0].status,'undone');
});


test('una reparación terminada fuera del lote conserva el fallo original y no vuelve a publicar la copia antigua', async () => {
 const {queueEntries}=await import('../scripts/educame-dashboard/queue-view.js');
 const {createAutomaticPublication}=await import('../scripts/educame-dashboard/automatic-publication.mjs');
 const task={id:'reparado',app:'gadeos',encargo:'Crear recorrido privado'};
 const batch={id:'antiguo',mode:'implementacion',state:'finished',automaticPublication:true,tasks:[task],jobs:{reparado:{status:'borrador',error:'Copia incompleta'}}};
 const state={board:{pushes:{},reviews:{}},history:[],batches:[batch]};
 assert.equal(queueEntries(state)[0].status,'attention');
 batch.jobs.reparado.externalCompletion={revision:'a'.repeat(40),summary:'Recorrido y gestión terminados con pruebas.'};
 assert.equal(queueEntries(state)[0].status,'completed');
 assert.equal(batch.jobs.reparado.error,'Copia incompleta');
 const operations=new Map();
 const store={operation:key=>operations.get(key),writeOperation:(key,value)=>operations.set(key,value),transaction:fn=>fn(),batches:()=>state.batches,board:()=>state.board};
 const service=createAutomaticPublication({store,publication:{upload:()=>assert.fail('No debe subir la copia antigua')},readDelivery:()=>assert.fail('No debe retomar la implementación antigua')});
 await service.pump();assert.equal(service.ready(),false);
});
