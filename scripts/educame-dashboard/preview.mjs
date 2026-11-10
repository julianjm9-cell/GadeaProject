import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, realpath } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { ChangesError, products } from './changes.mjs';

const pages = {
  '/profesor-particular': 'apps/profesor/index.html',
  '/profesor/demo': 'apps/profesor/index.html',
  '/eso-adultos': 'apps/e25/index.html',
  '/cambridge': 'apps/cambridge/index.html',
  '/app': 'apps/diplomator/index.html',
  '/universidad-adultos': 'apps/u25/index.html',
  '/facturas': 'apps/ocr/index.html',
  '/admin-dashboard/': 'admin/index.html',
  '/admin-dashboard/profesor-user.html': 'admin/profesor-user.html',
  '/profesor/alumno': 'backend/app/static/profesor-alumno.html',
};
const marketing = 'marketing/app_landings_demo';
const landings = {
  '/': 'index', '/profesor': 'profesor-particular', '/eso-adultos-info': 'eso-adultos', '/e25': 'eso-adultos',
  '/cambridge-info': 'cambridge', '/diplomator': 'diplomator', '/u25': 'universidad-25', '/ocr-facturas': 'ocr-facturas',
  '/hazlo-tu': 'hazlatu', '/privacidad': 'privacidad', '/aviso-legal': 'aviso-legal', '/cookies': 'cookies',
  '/profesor/materiales-para-clases': 'profesor-materiales-para-clases', '/profesor/juegos-interactivos': 'profesor-juegos-interactivos',
  '/profesor/temario-clases': 'profesor-temario-clases', '/profesor/accesos-alumnos': 'profesor-accesos-alumnos',
  '/profesor/anunciar': 'profesor-anuncios', '/profesor/anuncios': 'profesor-anuncios', '/profesor/planes': 'profesor-planes',
  '/profesor/condiciones': 'profesor-condiciones',
};
const assetDirs = [
  ['/assets/cambridge-studio/', 'apps/cambridge/assets/studio/'],
  ['/assets/cambridge-games/', 'apps/cambridge/assets/games/'],
  ['/assets/listening/', 'apps/cambridge/assets/listening/'],
  ['/assets/eso-', 'apps/e25/assets/eso-'],
  ['/assets/desk/', 'apps/e25/assets/desk/'],
  ['/assets/subjects/', 'apps/e25/assets/subjects/'],
  ['/assets/diplomator-refresh.css', 'apps/diplomator/assets/diplomator-refresh.css'],
  ['/assets/landing/', marketing + '/assets/landing/'],
  ['/assets/brand/', 'backend/app/static/assets/brand/'],
  ['/assets/brand/', marketing + '/assets/brand/'],
  ['/assets/lighthouse/', 'backend/app/static/assets/lighthouse/'],
  ['/assets/study-appearance/', 'backend/app/static/assets/study-appearance/'],
  ['/assets/', 'apps/profesor/assets/'],
  ['/marketing-assets/', marketing + '/'],
  ['/admin-dashboard/assets/', 'admin/assets/'],
  ['/admin-dashboard/', 'admin/'],
];
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.avif': 'image/avif', '.gif': 'image/gif', '.json': 'application/json',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff': 'font/woff', '.woff2': 'font/woff2',
};
const localUser = {
  id: 'preview-user', name: 'Cuenta de ensayo', full_name: 'Cuenta de ensayo', email: 'ensayo@example.invalid',
  status: 'active', role: 'admin', license_key: 'PREVIEW-LOCAL', total_credits: 100, available_credits: 100,
};
const unavailable = 'Esta función requiere el servidor de la app. La vista local usa datos de ensayo.';

function assetCandidates(path) {
  if (Object.hasOwn(pages, path)) return [pages[path]];
  if (Object.hasOwn(landings, path)) return [`${marketing}/${landings[path]}.html`];
  if (path === '/profesor/seo.css') return [marketing + '/profesor-seo.css'];
  if (/^\/(?:profesor-[\w-]+|app-notifications|app-session|temario-presentation)\.js$/.test(path)) return ['apps/profesor' + path];
  if (/^\/demo-shared\.(css|js)$/.test(path)) return [marketing + path];
  if (extname(path) === '.html') return [];
  return assetDirs.filter(([prefix]) => path.startsWith(prefix)).map(([prefix, dir]) => dir + path.slice(prefix.length));
}

async function readAsset(root, path) {
  for (const candidate of assetCandidates(path)) {
    const type = mime[extname(candidate).toLowerCase()];
    if (!type) continue;
    try {
      const expected = resolve(root, candidate);
      const actual = await realpath(expected);
      const within = relative(root, actual);
      if (relative(expected, actual) || isAbsolute(within) || within === '..' || /^\.\.[/\\]/.test(within) ||
          within.split(/[/\\]/).some(segment => segment.startsWith('.'))) continue;
      return { type, content: await readFile(actual) };
    } catch (error) {
      if (!['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) throw error;
    }
  }
}

function demoApi() {
  const states = new Map();
  let look = 'original';
  let user = localUser;
  return async (request, response, path, json) => {
    const method = request.method;
    const get = method === 'GET';
    const body = async () => {
      let value = '';
      for await (const chunk of request) {
        value += chunk;
        if (value.length > 2_000_000) throw new ChangesError(413, 'El ensayo supera el tamaño admitido.');
      }
      try { return JSON.parse(value || '{}'); }
      catch { throw new ChangesError(400, 'Datos de ensayo no válidos.'); }
    };
    if (path === '/api/state' && (get || method === 'POST')) {
      const app = String(request.headers['x-client-app'] || 'default').slice(0, 60);
      const state = states.get(app) || { revision: 0, data: {} };
      if (get) {
        response.setHeader('ETag', `"preview-${state.revision}"`);
        return json(200, state.data);
      }
      const data = await body();
      const tag = request.headers['if-match'];
      const latest = states.get(app)?.revision ?? 0;
      if (tag && tag !== `"preview-${latest}"`) return json(412, { detail: 'La vista local tiene cambios más recientes. Recarga para verlos.' });
      states.set(app, { revision: latest + 1, data });
      response.setHeader('ETag', `"preview-${latest + 1}"`);
      return json(200, { ok: true });
    }
    if (get && ['/api/status', '/api/me', '/auth/me'].includes(path)) return json(200, { ok: true, user, limits: {} });
    if (get && path === '/api/license') return json(200, { license: 'PREVIEW-LOCAL' });
    if (get && path === '/auth/google/status') return json(200, { enabled: false });
    if (get && path === '/api/public/app-availability') return json(200, { apps: {} });
    if (get && path === '/api/resources') return json(200, { resources: [] });
    if (get && path === '/api/gamification') return json(200, { profile: null, config: null });
    if (get && path === '/api/diplomator/points-models') return json(200, { models: [] });
    if (get && path === '/api/profesor/ads') return json(200, { ads: [] });
    if (get && path.startsWith('/api/app-notifications/')) return json(200, { messages: [], next: null, unread: 0 });
    if (path === '/api/study-appearance' && (get || method === 'PUT')) {
      if (!get) look = String((await body()).look || 'original').slice(0, 32);
      return json(200, { look });
    }
    if (method === 'POST' && path === '/api/profile') {
      const name = String((await body()).name || '').trim().slice(0, 90);
      if (!name) return json(400, { detail: 'Escribe tu nombre.' });
      user = { ...user, name, full_name: name };
      return json(200, { ok: true, user });
    }
    if (get && path === '/facturas/legacy/api/auth/me') return json(200, { user: { ...user, permissions: ['process', 'review', 'manage_config', 'manage_workspaces', 'manage_access'] }, roles: {} });
    if (get && path === '/facturas/legacy/api/facturas/health') return json(200, { ok: true });
    if (get && path === '/facturas/legacy/api/workspaces') return json(200, { workspaces: [] });
    if (get && path === '/admin/ai-settings') return json(200, null);
    if (get && ['/admin/organizations', '/admin/users'].includes(path)) return json(200, []);
    if (get && ['/admin/accounts', '/admin/hazlotu-access', '/admin/profesor-ads', '/admin/app-availability'].includes(path)) return json(200, {});
    if (path === '/api/frontend-error' && method === 'POST') return json(200, { ok: true });
    return json(501, { detail: unavailable });
  };
}

async function listenPreview(root) {
  const api = demoApi();
  const server = createServer(async (request, response) => {
    const host = `127.0.0.1:${request.socket.localPort}`;
    const origin = `http://${host}`;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(data));
    };
    try {
      if (request.headers.host !== host || (request.headers.origin && request.headers.origin !== origin)) {
        return json(403, { detail: 'Abre la vista previa desde LA TERRAZA.' });
      }
      const path = decodeURIComponent(new URL(request.url, origin).pathname);
      if (path.includes('\\') || path.split('/').some(segment => segment.startsWith('.'))) return json(404, { detail: 'Página no disponible.' });
      if (/^\/(?:api|auth|admin|facturas\/legacy\/api)(?:\/|$)/.test(path)) return await api(request, response, path, json);
      if (request.method !== 'GET' && request.method !== 'HEAD') return json(405, { detail: unavailable });
      const asset = await readAsset(root, path);
      if (!asset) return json(404, { detail: 'Página no disponible en la vista local.' });
      let content = asset.content;
      if (asset.type.startsWith('text/html')) {
        content = content.toString('utf8').replace(/<title>/i, '<title>Vista local · ');
        if (path === '/admin-dashboard/') {
          content = content.replace('</head>', "<script>localStorage.setItem('educa_admin_token','preview-local')</script></head>");
        }
      }
      if (asset.type.startsWith('audio/')) {
        response.setHeader('Accept-Ranges', 'bytes');
        if (request.headers.range) {
          const range = request.headers.range.match(/^bytes=(\d*)-(\d*)$/);
          const size = content.length;
          const start = range?.[1] ? Number(range[1]) : Math.max(0, size - Number(range?.[2]));
          const end = range?.[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) {
            response.writeHead(416, { 'Content-Range': `bytes */${size}` });
            response.end();
            return;
          }
          response.writeHead(206, { 'Content-Type': asset.type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
          response.end(request.method === 'HEAD' ? undefined : content.subarray(start, end + 1));
          return;
        }
      }
      response.writeHead(200, { 'Content-Type': asset.type, 'Content-Length': Buffer.byteLength(content) });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      json(error.status || 400, { detail: error.status ? error.message : 'No se pudo abrir el recurso local.' });
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  server.unref();
  return server;
}

export function createPreviews(repositoryRoot) {
  const servers = new Map();
  async function open(key, type) {
    const product = Object.hasOwn(products, key) && products[key];
    const target = ['app', 'landing'].includes(type) && product?.[type];
    if (!target) throw new ChangesError(404, 'Vista local no disponible.');
    if (!servers.has(key)) servers.set(key, realpath(repositoryRoot).then(listenPreview).catch(() => {
      servers.delete(key);
      throw new ChangesError(503, 'No se pudo iniciar la vista local.');
    }));
    const server = await servers.get(key);
    return `http://127.0.0.1:${server.address().port}${target}`;
  }
  function close() {
    for (const pending of servers.values()) pending.then(server => server.close()).catch(() => {});
  }
  return { open, close };
}
