const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const crypto=require('node:crypto').webcrypto;
const source=fs.readFileSync('apps/e25/assets/eso-state-recovery.js','utf8');
function setup(storage=new Map()){
 const node={children:[],append(child){this.children.push(child);}};
 const context={crypto,window:{},localStorage:new Proxy({getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},{ownKeys:()=>[...storage.keys()],getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})}),document:{getElementById:()=>node,createElement:()=>({})},showEsoSaveStatus:()=>{node.children=[];},state:{done:{}},esoStateETag:'"v1"',esoStateSaveQueue:Promise.resolve(),backend:async()=>{},render(){},confirm:()=>true,saveState:async()=>true};
 vm.runInNewContext(source,context);return {api:context.window.esoRecovery,context,node};
}
test('reload retains the previous pending snapshot and another account cannot recover it',()=>{
 const storage=new Map(),a=setup(storage);a.api.init('A','"v1"',{});a.api.capture('{"done":{"lesson":true}}','"v1"');
 const b=setup(storage);b.api.init('B','"v1"',{});assert.equal(b.node.children.length,0);
 const reload=setup(storage);reload.api.init('A','"v1"',{});reload.api.capture('{"done":{}}','"v1"');
 assert.equal(storage.size,2);assert.ok([...storage.values()].some(v=>JSON.parse(v).snapshot.done.lesson));
});
test('recovery checks the latest server version before replacing any state',async()=>{
 const storage=new Map(),first=setup(storage);first.api.init('A','"v1"',{});first.api.capture('{"done":{"lesson":true}}','"v1"');
 const reload=setup(storage);reload.api.init('A','"v1"',{});reload.context.backend=async()=>{reload.context.esoStateETag='"v2"';};
 await reload.node.children.find(n=>n.textContent==='Recuperar cambios pendientes').onclick();
 assert.equal(reload.context.state.done.lesson,undefined);assert.equal(storage.size,1);
});

test('pending copies expire after seven days and are limited to five per account',()=>{
 const storage=new Map([['eso.pending.A.expired',JSON.stringify({at:Date.now()-8*86400000,snapshot:{done:{old:true}}})]]);
 const first=setup(storage);first.api.init('A','"v1"',{});assert.equal(storage.size,0);
 for(let i=0;i<7;i++){const tab=setup(storage);tab.api.init('A','"v1"',{});tab.api.capture(JSON.stringify({lessonNotes:{topic:'Draft '+i}}),'"v1"');}
 assert.equal(storage.size,5);assert.ok([...storage.values()].every(value=>JSON.parse(value).snapshot.lessonNotes));
});
