const {test}=require('node:test');const assert=require('node:assert/strict');
test('el puente administrativo limita rutas, métodos y destinos y conserva el dashboard original',async()=>{
  const {validateManagementRequest,managementAsset}=await import('../scripts/educame-dashboard/admin-workspace.mjs');
  for(const [path,method]of [['/admin/accounts','GET'],['/admin/ai-settings/apps/CAMBRIDGE','POST'],['/admin/app-notifications/CAMBRIDGE','POST'],['/admin/apps/gadeos/accounts/abc-123','PATCH'],['/admin/profesor-ads/abc-123/reports','GET'],['/admin/profesor-users/abc-123/materials?purpose=support','GET']])assert.equal(validateManagementRequest({path,method}).path,path);
  for(const product of ['PROFESOR_PARTICULAR','ESO_ADULTOS','CAMBRIDGE','DIPLOMATOR','OCR_FACTURAS','UNIVERSIDAD_ADULTOS']){
    for(const [path,method]of [['/admin/users/abc-123/access/'+product,'PATCH'],['/admin/ai-settings/apps/'+product,'POST'],['/admin/app-notifications/'+product,'GET'],['/admin/app-notifications/'+product,'POST'],['/admin/app-availability/'+product,'PATCH']])assert.equal(validateManagementRequest({path,method}).path,path);
  }
  for(const path of ['https://evil.invalid/admin/accounts','/admin/../../etc/passwd','/api/state','/admin/accounts#secret','/admin/%2e%2e/secrets'])assert.throws(()=>validateManagementRequest({path}),{status:400});
  assert.throws(()=>validateManagementRequest({path:'/admin/accounts',method:'DELETE'}),{status:400});
  const page=await managementAsset('/gestion/');assert.match(page.bytes.toString(),/let token='terraza-session'/);assert.match(page.bytes.toString(),/management-bridge.js/);assert.match(page.headers['Content-Security-Policy'],/frame-ancestors 'self'/);
  const original=await require('node:fs/promises').readFile('admin/index.html','utf8');assert.ok(!original.includes('management-bridge.js'));assert.ok(original.includes("let token=localStorage.getItem('educa_admin_token')"));
  await assert.rejects(managementAsset('/gestion/../.env'),{status:404});
});
test('la sesión del puente permanece en el servidor y ninguna ruta recibe un token del navegador',async()=>{
  const {adminOperations}=await import('../scripts/educame-dashboard/admin-operations.mjs');let cookie;
  const response={setHeader:(name,value)=>{if(name==='Set-Cookie')cookie=value;}};
  const stored={};const sessionStore={adminSessions:()=>stored,setAdminSessions:value=>Object.assign(stored,value)};
  const calls=[];const fetchImpl=async(url,options)=>{calls.push({url,options});if(url.endsWith('/auth/login'))return Response.json({access_token:'token-servidor-ensayo'});assert.equal(options.headers.Authorization,'Bearer token-servidor-ensayo');return Response.json(url.endsWith('/admin/accounts')?{accounts:[]}:{CAMBRIDGE:{paused:false}});};
  let admin=adminOperations(fetchImpl,sessionStore);
  await assert.rejects(admin.handle('bridge','',{path:'/admin/accounts'},response),{status:401});
  assert.deepEqual(await admin.handle('login','',{identifier:'admin@example.invalid',password:'ensayo-123'},response),{connected:true});
  assert.ok(!cookie.includes('token-servidor'));assert.ok(cookie.includes('HttpOnly'));
  admin=adminOperations(fetchImpl,sessionStore);const sessionCookie=cookie.split(';')[0];
  assert.deepEqual(await admin.handle('bridge',sessionCookie,{path:'/admin/accounts'},response),{accounts:[]});
  await assert.rejects(admin.handle('bridge',sessionCookie,{path:'https://evil.invalid/admin/users'},response),{status:400});
  assert.ok(calls.every(call=>new URL(call.url).origin==='https://educame.tech'));
});
