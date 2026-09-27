const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const apps=[['e25','logout','/eso-adultos-info','eso-adultos.html'],['u25','logout','/universidad-25-info','universidad-25.html'],['cambridge','logoutWeb','/cambridge-info','cambridge.html'],['diplomator','logoutWeb','/diplomator','diplomator.html']];
for(const [app,fn,route,landing] of apps){
 const html=fs.readFileSync(`apps/${app}/index.html`,'utf8');
 const start=html.indexOf(`async function ${fn}()`);const end=html.indexOf('\n}',start)+2;const source=html.slice(start,end);
 test(`${app}: logout closes the server session and returns to its public landing`,async()=>{
  const calls=[],removed=[];const context=vm.createContext({location:{protocol:'https:',href:''},BACKEND_SUPPORTED:true,localStorage:{removeItem:key=>removed.push(key)},fetch:async(...args)=>{calls.push(args);return {ok:true}}});
  vm.runInContext(source,context);await context[fn]();assert.equal(context.location.href,route);assert.equal(calls[0][0],'/auth/logout');assert.equal(calls[0][1].method,'POST');assert.equal(calls[0][1].credentials,'same-origin');if(fn==='logoutWeb')assert.equal(removed.length,1);
 });
 test(`${app}: local preview returns to the app's existing landing file`,async()=>{
  const context=vm.createContext({location:{protocol:'file:',href:''},BACKEND_SUPPORTED:false,localStorage:{removeItem(){}},fetch:async()=>({ok:true})});vm.runInContext(source,context);await context[fn]();assert.equal(context.location.href,`../../marketing/app_landings_demo/${landing}`);assert.ok(fs.existsSync(`marketing/app_landings_demo/${landing}`));
 });
 test(`${app}: profile has no general app selector and scripts parse`,()=>{
  assert.doesNotMatch(html, /href=["']\/apps["']|Todas las apps|Ver todas las apps/i);
  for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
 });
}
