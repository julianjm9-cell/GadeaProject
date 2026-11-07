const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const crypto=require('node:crypto').webcrypto;
function setup(fetch){const storage=new Map();const window={fetch};const context={window,navigator:{},crypto,URL,Request,Headers,TextEncoder,location:{origin:'https://app.test',href:'https://app.test/cambridge'},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};vm.runInNewContext(fs.readFileSync('apps/profesor/app-session.js','utf8'),context);return window.fetch;}
test('concurrent expired requests refresh once and replay their original body',async()=>{
 let refreshes=0,renewed=false;const bodies=[];
 const fetch=setup(async(url,options={})=>{if(url==='/auth/refresh'){refreshes++;await new Promise(r=>setTimeout(r,10));renewed=true;return new Response('{}');}bodies.push(options.body);return new Response('{}',{status:renewed?200:401});});
 await Promise.all([fetch('/api/state',{method:'POST',body:'one'}),fetch('/api/state',{method:'POST',body:'two'})]);
 assert.equal(refreshes,1);assert.deepEqual(bodies,['one','two','one','two']);
});
test('uncertain AI delivery retries the same key; a confirmed new request gets another',async()=>{
 const keys=[];let fail=true;
 const fetch=setup(async(url,options)=>{keys.push(options.headers.get('Idempotency-Key'));if(fail){fail=false;throw Error('offline');}return new Response('{"ok":true}');});
 const options={method:'POST',headers:{'X-Client-App':'cambridge'},body:'{"messages":[]}'};
 await assert.rejects(fetch('/api/chat',options));await fetch('/api/chat',options);await fetch('/api/chat',options);
 assert.equal(keys[0],keys[1]);assert.notEqual(keys[1],keys[2]);
});
test('third party and deliberately anonymous requests never trigger cookie refresh',async()=>{
 const calls=[];const fetch=setup(async url=>{calls.push(url);return new Response('{}',{status:401});});
 await fetch('https://external.test/api/status');await fetch('/api/status',{credentials:'omit'});
 const anonymous=new Request('https://app.test/api/status',{credentials:'omit'});await fetch(anonymous);
 assert.deepEqual(calls,['https://external.test/api/status','/api/status',anonymous]);
});
