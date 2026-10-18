const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function setup(api){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',hidden:true,disabled:false,listeners:{},addEventListener(kind,fn){this.listeners[kind]=fn;},querySelectorAll(){return [];},reset(){get('notificationTitle').value='';get('notificationBody').value='';}});return elements.get(id);};
 let uuid=0;const ctx={window:{},$:get,api,esc:s=>String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;'),Date,JSON,crypto:{randomUUID:()=>`delivery-${++uuid}`}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'notifications.js'),'utf8'),ctx);
 return {get,controls:ctx.window.adminNotifications};
}

test('Review uses literal message text, and a failed delivery retries the same idempotency key',async()=>{
 const sent=[];let fail=true;
 const {get,controls}=setup(async(url,options)=>{if(!options)return {recipients:2,messages:[]};sent.push(JSON.parse(options.body));if(fail){fail=false;throw Error('Conexión interrumpida');}return {delivered:2};});
 await controls.load();get('notificationTitle').value='<img src=x onerror=alert(1)>';get('notificationBody').value='Mensaje\ncompleto';
 controls.review({preventDefault(){}});assert.equal(get('notificationPreviewTitle').textContent,'<img src=x onerror=alert(1)>');assert.equal(get('notificationReview').hidden,false);
 await controls.send();assert.match(get('notificationStatus').textContent,/reintentar/);assert.equal(get('notificationTitle').value,'<img src=x onerror=alert(1)>');assert.equal(get('notificationSend').disabled,false);
 await controls.send();assert.deepEqual(sent[1],sent[0]);assert.equal(get('notificationTitle').value,'');assert.equal(get('notificationReview').hidden,true);
});

test('Double clicks send once, and editing the message hides the old confirmation',async()=>{
 let release;let posts=0;
 const {get,controls}=setup(async(url,options)=>{if(!options)return {recipients:4,messages:[]};posts++;return new Promise(resolve=>{release=resolve;});});
 await controls.load();get('notificationTitle').value='Título';get('notificationBody').value='Mensaje';controls.review({preventDefault(){}});
 get('notificationForm').listeners.input();assert.equal(get('notificationReview').hidden,true);
 const first=controls.send();await controls.send();assert.equal(posts,1);assert.equal(get('notificationSend').disabled,true);release({delivered:4});await first;assert.equal(get('notificationSend').disabled,false);
});
