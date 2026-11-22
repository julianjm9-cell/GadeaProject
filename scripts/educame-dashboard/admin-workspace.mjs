import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute } from 'node:path';
import { OperationError } from './operations.mjs';

const adminRoot=fileURLToPath(new URL('../../admin/',import.meta.url));
const brandRoot=fileURLToPath(new URL('../../marketing/app_landings_demo/assets/brand/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
export const managementPolicy="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://educame.tech; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'";

export async function managementAsset(path){
  const file=path==='/gestion/'?'index.html':path.slice('/gestion/'.length);
  if(!/^(?:[a-z-]+\.(?:html|js|css)|assets\/brand\/[a-z0-9-]+\.(?:png|svg))$/.test(file))throw new OperationError(404,'Archivo de administración no disponible.');
  let base=adminRoot;
  let local=file;
  if(file==='assets/brand/facturas.svg'){base=brandRoot;local='facturas.svg';}
  const target=await realpath(resolve(base,local)).catch(()=>{throw new OperationError(404,'Archivo de administración no disponible.');});
  const rel=relative(base,target);if(rel.startsWith('..')||isAbsolute(rel))throw new OperationError(404,'Archivo no disponible.');
  const extension='.'+file.split('.').at(-1),type=types[extension];
  let bytes=await readFile(target);
  if(extension==='.html'){
    let source=bytes.toString('utf8');
    if(file==='index.html'){
      const tokenMarker="let token=localStorage.getItem('educa_admin_token')||''";
      if(!source.includes(tokenMarker))throw new OperationError(409,'La administración cambió. Revisa su integración antes de abrirla.');
      source=source.replace(tokenMarker,"let token='terraza-session'").replace('>Entrar al dashboard<','>Conectar administración<');
    }
    source=source.replace('<head>','<head><script src="/management-bridge.js"></script><link rel="stylesheet" href="/management-embedded.css">').replaceAll('/assets/brand/facturas.svg','/gestion/assets/brand/facturas.svg');
    bytes=Buffer.from(source);
  }
  return {bytes,type,headers:{'Content-Security-Policy':managementPolicy,'X-Frame-Options':'SAMEORIGIN'}};
}

export function validateManagementRequest(body){
  const {path,method='GET',data}=body;
  if(typeof path!=='string'||path.length>1500||!path.startsWith('/admin/')||path.includes('\\')||path.includes('#'))throw new OperationError(400,'Ruta de administración no permitida.');
  const url=new URL(path,'https://educame.tech');
  const id='[a-zA-Z0-9-]{1,64}';
  const reads=new RegExp('^/admin/(?:accounts|users(?:/'+id+')?|organizations(?:/'+id+')?|licenses(?:/'+id+')?|ai-settings|app-availability|hazlotu-access|operations-health|profesor-ads(?:/'+id+'/reports)?|app-notifications/'+id+'|profesor-users/'+id+'(?:/materials)?|apps(?:/'+id+'/accounts)?)$');
  const writes=new RegExp('^/admin/(?:organizations|users|licenses|apps(?:/'+id+'/accounts)?|hazlotu-access|ai-settings(?:/(?:apps/'+id+'|keys|test|test-connection))?|app-notifications/'+id+'|profesor-ads/'+id+'/(?:status|delete|reports/'+id+'))$');
  const patches=new RegExp('^/admin/(?:app-availability/'+id+'|apps/'+id+'(?:/accounts/'+id+')?|organizations/'+id+'|licenses/'+id+'|users/'+id+'(?:/access/'+id+')?)$');
  const deletes=new RegExp('^/admin/users/'+id+'$');
  if(url.origin!=='https://educame.tech'||!({GET:reads,POST:writes,PATCH:patches,DELETE:deletes}[method]?.test(url.pathname)))throw new OperationError(400,'Esta operación no forma parte de la administración integrada.');
  if(data!==undefined&&(!data||typeof data!=='object'||Array.isArray(data)))throw new OperationError(400,'Datos de administración no válidos.');
  if(JSON.stringify(data||{}).length>150000)throw new OperationError(413,'Divide este cambio en envíos más pequeños.');
  return {path:url.pathname+url.search,method,data};
}
