import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const googleCallback = '/api/conexiones/google/volver';
const googleApi = 'https://www.googleapis.com/webmasters/v3/sites';
const googleScope = 'https://www.googleapis.com/auth/webmasters.readonly';
const publishServices = new Set(['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'threads', 'bluesky', 'mastodon', 'twitter']);
const boardFile = 'connection-history.json';
const runwayBase = 'https://api.dev.runwayml.com/v1/';
const videoStates = new Set(['PENDING', 'THROTTLED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED']);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export class ConnectionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readLocal(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function writeLocal(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, path);
}

async function openVault(directory) {
  const secretPath = join(directory, '.connections-key');
  const dataPath = join(directory, 'connections-vault.json');
  const envelope = await readLocal(dataPath);
  let keyText = await readLocal(secretPath);
  if (!keyText && envelope) throw new Error('Falta la clave del almacén local.');
  let values = {};
  if (envelope) {
    const { iv, tag, data } = JSON.parse(envelope);
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyText, 'hex'), Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    values = JSON.parse(decipher.update(data, 'hex', 'utf8') + decipher.final('utf8'));
  }
  let writes = Promise.resolve();
  return {
    get: name => values[name],
    set(name, value) {
      const write = writes.then(async () => {
        if (!keyText) {
          const generated = randomBytes(32).toString('hex');
          await writeFile(secretPath, generated, { flag: 'wx', mode: 0o600 }).catch(error => {
            if (error.code !== 'EEXIST') throw error;
          });
          keyText = await readLocal(secretPath);
        }
        const next = { ...values, [name]: value };
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyText, 'hex'), iv);
        const data = cipher.update(JSON.stringify(next), 'utf8', 'hex') + cipher.final('hex');
        await writeLocal(dataPath, { iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data });
        values = next;
      });
      writes = write.catch(() => {});
      return write;
    },
  };
}

function inputText(value, max) {
  return typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
}

function requireText(value, max, message) {
  const result = inputText(value, max);
  if (!result) throw new ConnectionError(400, message);
  return result;
}

function range(value, delay = 0) {
  const days = [7, 28, 90].includes(Number(value)) ? Number(value) : 28;
  const day = 86_400_000;
  const end = Date.now() - delay * day;
  const date = offset => new Date(end - offset * day).toISOString().slice(0, 10);
  return { startDate: date(days - 1), endDate: date(0) };
}

function publicMedia(value) {
  const url = URL.parse(inputText(value, 2048));
  if (!url || url.protocol !== 'https:' || url.username || url.password ||
      !url.hostname.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname) ||
      /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
    throw new ConnectionError(400, 'Pega la URL HTTPS pública del archivo multimedia.');
  }
  return url.href;
}

function publicationInput(body, channels) {
  const id = requireText(body.id, 36, 'Falta el identificador de publicación.');
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new ConnectionError(400, 'El identificador de publicación no es válido.');
  if (!Array.isArray(body.channels) || !body.channels.length || body.channels.length > 10 ||
      new Set(body.channels).size !== body.channels.length) throw new ConnectionError(400, 'Elige de uno a diez perfiles.');
  if (!['shareNow', 'addToQueue'].includes(body.mode)) throw new ConnectionError(400, 'Elige cuándo publicar.');
  if (!['none', 'image', 'video'].includes(body.mediaType)) throw new ConnectionError(400, 'Elige el formato.');
  if (typeof body.text !== 'string' || body.text.length > 5000) throw new ConnectionError(400, 'El texto admite hasta 5.000 caracteres.');
  const text = inputText(body.text, 5000);
  const assets = body.mediaType === 'none' ? [] : [{ [body.mediaType]: { url: publicMedia(body.mediaUrl) } }];
  if (!text && !assets.length) throw new ConnectionError(400, 'Escribe el texto o añade un archivo.');
  const targets = body.channels.map(channelId => {
    const channel = channels.find(item => item.id === channelId && item.canPublish);
    if (!channel) throw new ConnectionError(400, 'Alguno de los perfiles ya no está disponible para publicar.');
    if (body.mode === 'addToQueue' && channel.isQueuePaused) {
      throw new ConnectionError(400, `La cola de ${channel.name} está pausada en Buffer.`);
    }
    if (['instagram', 'tiktok'].includes(channel.service) && !assets.length) {
      throw new ConnectionError(400, `Añade una imagen o un vídeo para ${channel.name}.`);
    }
    const input = { channelId, text, assets, mode: body.mode, schedulingType: 'automatic', needsApproval: false };
    const ai = body.ai === true;
    if (channel.service === 'instagram') {
      input.metadata = { instagram: { type: body.mediaType === 'video' ? 'reel' : 'post', shouldShareToFeed: true, isAiGenerated: ai } };
    }
    if (channel.service === 'tiktok') {
      const title = body.mediaType === 'image' ? requireText(body.title, 90, 'Escribe un título para la foto de TikTok.') : undefined;
      input.metadata = { tiktok: title ? { title } : { isAiGenerated: ai } };
    }
    if (channel.service === 'youtube') {
      if (body.mediaType !== 'video') throw new ConnectionError(400, 'YouTube requiere un vídeo.');
      const title = requireText(body.title, 90, 'Escribe un título para YouTube.');
      if (!['yes', 'no'].includes(body.kids)) throw new ConnectionError(400, 'Indica si el vídeo de YouTube está dirigido a niños.');
      input.metadata = { youtube: { title, categoryId: '27', madeForKids: body.kids === 'yes', isAiGenerated: ai } };
    }
    return { channel, input };
  });
  return { id, targets, text, mode: body.mode, app: inputText(body.app, 100) };
}

export async function createConnections(directory, fetchImpl = fetch) {
  const vault = await openVault(directory);
  const historyPath = join(directory, boardFile);
  let history = JSON.parse(await readLocal(historyPath) || '[]');
  const videosPath = join(directory, 'video-history.json');
  let videos = JSON.parse(await readLocal(videosPath) || '[]');
  let videoWrite = false;
  let publication = false;
  let authorization;
  let access;

  async function external(url, options, service) {
    let response;
    try {
      response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new ConnectionError(502, `No se pudo contactar con ${service}. Comprueba la conexión.`);
    }
    if (!response.ok) {
      if ([400, 401, 403].includes(response.status)) {
        throw new ConnectionError(400, `${service} rechazó la solicitud. Revisa las credenciales, los permisos y la configuración.`);
      }
      throw new ConnectionError(502, `${service} devolvió un error (${response.status}). Vuelve a intentarlo más tarde.`);
    }
    try {
      return await response.json();
    } catch {
      throw new ConnectionError(502, `${service} devolvió una respuesta que el panel no pudo leer.`);
    }
  }

  function runway(key, path, data) {
    if (!key) throw new ConnectionError(409, 'Conecta Runway antes de generar o descargar vídeos.');
    return external(runwayBase + path, {
      method: data ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${key}`, 'X-Runway-Version': '2024-11-06', 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    }, 'Runway');
  }

  async function updateVideos(change) {
    if (videoWrite) throw new ConnectionError(409, 'Hay una operación de vídeo en curso.');
    videoWrite = true;
    const save = async next => {
      await writeLocal(videosPath, next);
      videos = next;
    };
    try {
      return await change(save);
    } finally {
      videoWrite = false;
    }
  }

  function videoFor(id) {
    const found = videos.find(item => item.id === id && item.taskId);
    if (!found) throw new ConnectionError(404, 'No se encuentra esta generación.');
    return found;
  }

  async function createVideo(body) {
    if (!uuid.test(body.id || '')) throw new ConnectionError(400, 'Falta el identificador del vídeo.');
    const prompt = requireText(body.prompt, 1000, 'Describe el vídeo en un máximo de 1.000 caracteres.');
    if (!['720:1280', '1280:720'].includes(body.ratio)) throw new ConnectionError(400, 'Elige el formato del vídeo.');
    return updateVideos(async save => {
      const existing = videos.find(item => item.id === body.id);
      if (existing) return existing;
      const key = vault.get('runway');
      if (!key) throw new ConnectionError(409, 'Conecta Runway antes de generar un vídeo.');
      const entry = { id: body.id, prompt, ratio: body.ratio, date: new Date().toISOString(), status: 'UNKNOWN' };
      await save([entry, ...videos]);
      const result = await runway(key, 'text_to_video', { model: 'gen4.5', promptText: prompt, ratio: body.ratio, duration: 5 });
      if (!uuid.test(result.id || '')) throw new ConnectionError(502, 'Runway no devolvió un identificador válido.');
      const updated = { ...entry, taskId: result.id, status: 'PENDING' };
      await save(videos.map(item => item.id === updated.id ? updated : item));
      return updated;
    });
  }

  async function refreshVideo(id) {
    return updateVideos(async save => {
      const entry = videoFor(id);
      if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(entry.status) || Date.now() - (entry.checkedAt || 0) < 5_000) return entry;
      const details = await runway(vault.get('runway'), 'tasks/' + entry.taskId);
      if (!videoStates.has(details.status)) throw new ConnectionError(502, 'Runway no devolvió un estado válido.');
      const updated = { ...entry, status: details.status, checkedAt: Date.now() };
      await save(videos.map(item => item.id === id ? updated : item));
      return updated;
    });
  }

  async function downloadVideo(id, response) {
    const entry = videoFor(id);
    const details = await runway(vault.get('runway'), 'tasks/' + entry.taskId);
    const url = URL.parse(details.output?.[0] || '');
    if (details.status !== 'SUCCEEDED' || !url || url.protocol !== 'https:' || url.username || url.password ||
        !/\.(cloudfront\.net|runwayml\.com|runwayml\.cloud)$/.test(url.hostname)) {
      throw new ConnectionError(409, 'Runway todavía no ofrece un vídeo descargable para esta generación.');
    }
    const file = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) }).catch(() => null);
    if (!file?.ok || !file.body) throw new ConnectionError(502, 'No se pudo descargar el vídeo de Runway.');
    response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Disposition': `attachment; filename="educame-${entry.id}.mp4"` });
    await pipeline(Readable.fromWeb(file.body), response).catch(() => {});
  }

  async function graph(key, query, variables) {
    const result = await external('https://api.buffer.com', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    }, 'Buffer');
    if (result.errors?.length || !result.data) {
      throw new ConnectionError(502, 'Buffer no pudo completar la operación. Revisa el acceso y los permisos en Buffer.');
    }
    return result.data;
  }

  async function getChannels(key) {
    const { account } = await graph(key, 'query Organizations { account { organizations { id } } }');
    if (!Array.isArray(account?.organizations)) throw new ConnectionError(502, 'Buffer no devolvió las organizaciones de esta cuenta.');
    const responses = await Promise.all(account.organizations.map(async ({ id }) => {
      const { channels } = await graph(key, `query Channels($organizationId: OrganizationId!) {
        channels(input: { organizationId: $organizationId }) {
          id name displayName service isLocked isDisconnected isQueuePaused allowedActions
        }
      }`, { organizationId: id });
      return (channels || []).map(({ id: channelId, name, displayName, service, isLocked, isDisconnected, isQueuePaused, allowedActions }) => ({
        id: channelId, name: displayName || name, handle: name, service, organizationId: id, isQueuePaused,
        canPublish: !isLocked && !isDisconnected && publishServices.has(service) && allowedActions?.includes('scheduleUpdates'),
        insights: !isLocked && allowedActions?.includes('viewInsights'),
      }));
    }));
    return responses.flat();
  }

  function bufferKey() {
    const key = vault.get('buffer');
    if (!key) throw new ConnectionError(409, 'Conecta Buffer antes de usar tus redes.');
    return key;
  }

  function token(fields) {
    return external('https://oauth2.googleapis.com/token', {
      method: 'POST', body: new URLSearchParams(fields),
    }, 'Google');
  }

  async function googleAccess() {
    const config = vault.get('google');
    if (!config) throw new ConnectionError(409, 'Conecta Google Search Console para consultar estos datos.');
    if (access?.config === config && access.expiresAt > Date.now()) return access.value;
    const data = await token({
      client_id: config.clientId, client_secret: config.clientSecret,
      refresh_token: config.refreshToken, grant_type: 'refresh_token',
    });
    if (!data.access_token) throw new ConnectionError(502, 'Vuelve a autorizar Search Console desde Conexiones.');
    access = { config, value: data.access_token, expiresAt: Date.now() + Math.max(0, Number(data.expires_in || 0) - 60) * 1000 };
    return access.value;
  }

  function googleStart(body, origin) {
    const clientId = requireText(body.clientId, 250, 'Introduce el ID del cliente OAuth de Google.');
    const clientSecret = requireText(body.clientSecret, 250, 'Introduce el secreto del cliente OAuth.');
    if (!clientId.endsWith('.apps.googleusercontent.com')) throw new ConnectionError(400, 'El ID de cliente OAuth de Google no es válido.');
    const state = randomBytes(32).toString('hex');
    const verifier = randomBytes(32).toString('base64url');
    const redirect = origin + googleCallback;
    authorization = { state, verifier, redirect, clientId, clientSecret, expiresAt: Date.now() + 600_000 };
    const params = new URLSearchParams({
      client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: googleScope,
      access_type: 'offline', prompt: 'consent', state, code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  }

  async function googleFinish(query) {
    const attempt = authorization;
    if (!attempt || query.get('state') !== attempt.state || attempt.expiresAt < Date.now()) return false;
    authorization = null;
    const code = query.get('code');
    if (!code) return false;
    try {
      const data = await token({
        client_id: attempt.clientId, client_secret: attempt.clientSecret, code, code_verifier: attempt.verifier,
        grant_type: 'authorization_code', redirect_uri: attempt.redirect,
      });
      if (!data.refresh_token || !data.access_token || (data.scope && !data.scope.split(' ').includes(googleScope))) return false;
      await external(googleApi, { headers: { Authorization: `Bearer ${data.access_token}` } }, 'Search Console');
      await vault.set('google', { clientId: attempt.clientId, clientSecret: attempt.clientSecret, refreshToken: data.refresh_token });
      return true;
    } catch {
      return false;
    }
  }

  async function searchStats(body) {
    const property = requireText(body.property, 1000, 'Elige una propiedad de Search Console.');
    const pagePattern = inputText(body.pagePattern, 1000);
    const headers = { Authorization: `Bearer ${await googleAccess()}`, 'Content-Type': 'application/json' };
    const dates = range(body.days, 3);
    const filters = pagePattern ? { dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'includingRegex', expression: pagePattern }] }] } : {};
    const query = (dimensions, rowLimit) => external(`${googleApi}/${encodeURIComponent(property)}/searchAnalytics/query`, {
      headers, method: 'POST', body: JSON.stringify({ ...dates, ...filters, dataState: 'final', type: 'web', dimensions, rowLimit }),
    }, 'Search Console');
    const [summary, trend, searches, pages] = await Promise.all([query([], 1), query(['date'], 90), query(['query'], 8), query(['page'], 8)]);
    return { ...dates, total: summary.rows?.[0] || null, trend: trend.rows || [], searches: searches.rows || [], pages: pages.rows || [] };
  }

  async function socialStats(body) {
    const key = bufferKey();
    const channel = (await getChannels(key)).find(item => item.id === body.channel && item.insights);
    if (!channel) throw new ConnectionError(400, 'Elige un canal con acceso a estadísticas de Buffer.');
    const { startDate, endDate } = range(body.days);
    const { aggregatedPostMetrics } = await graph(key, `query Metrics($input: AggregatedPostMetricsInput!) {
      aggregatedPostMetrics(input: $input) { metricsUpdatedAt metrics { type name unit value } }
    }`, { input: { organizationId: channel.organizationId, channelIds: [channel.id],
      startDateTime: startDate + 'T00:00:00Z', endDateTime: endDate + 'T00:00:00Z' } });
    if (!aggregatedPostMetrics) throw new ConnectionError(502, 'Este perfil no devolvió métricas en Buffer.');
    return { ...aggregatedPostMetrics, startDate, endDate };
  }

  async function publish(body) {
    if (publication) throw new ConnectionError(409, 'Hay un envío en marcha.');
    const existing = history.find(entry => entry.id === body.id);
    if (existing) return existing;
    publication = true;
    try {
      const key = bufferKey();
      const { id, targets, text, mode, app } = publicationInput(body, await getChannels(key));
      const entry = { id, text, mode, app, date: new Date().toISOString(), results: targets.map(({ channel }) => ({
        name: channel.name, service: channel.service, status: 'sin confirmar',
      })) };
      const updated = [entry, ...history].slice(0, 200);
      await writeLocal(historyPath, updated);
      history = updated;
      await Promise.all(targets.map(async ({ input }, index) => {
        const result = entry.results[index];
        try {
          const { createPost } = await graph(key, `mutation Publish($input: CreatePostInput!) {
            createPost(input: $input) { ... on PostActionSuccess { post { id status } } ... on MutationError { message } }
          }`, { input });
          if (createPost?.post?.id) Object.assign(result, { id: createPost.post.id, providerStatus: createPost.post.status, status: 'recibida' });
          else if (createPost?.message) Object.assign(result, { status: 'rechazada', message: String(createPost.message).slice(0, 450) });
        } catch (error) {
          result.message = error.message;
        }
      }));
      await writeLocal(historyPath, history);
      return entry;
    } finally {
      publication = false;
    }
  }

  async function refreshPublication(id) {
    if (publication) throw new ConnectionError(409, 'Hay un envío en marcha.');
    const entry = history.find(item => item.id === id);
    if (!entry) throw new ConnectionError(404, 'No se encuentra este envío.');
    const key = bufferKey();
    publication = true;
    try {
      const updated = structuredClone(entry);
      const targets = updated.results.filter(item => item.id && !['sent', 'error'].includes(item.providerStatus));
      const responses = await Promise.allSettled(targets.map(async item => {
        const { post } = await graph(key, 'query PostStatus($input: PostInput!) { post(input: $input) { id status } }', { input: { id: item.id } });
        if (post?.status) item.providerStatus = post.status;
      }));
      if (responses.length && responses.every(result => result.status === 'rejected')) throw responses[0].reason;
      const next = history.map(item => item.id === id ? updated : item);
      await writeLocal(historyPath, next);
      history = next;
      return updated;
    } finally {
      publication = false;
    }
  }

  return {
    googleFinish, downloadVideo,
    openaiKey: () => vault.get('openai'),
    githubToken: () => vault.get('github'),
    setGithubToken: value => vault.set('github', value),
    async handle(path, method, body, origin) {
      if (path === '/api/conexiones' && method === 'GET') return {
        buffer: Boolean(vault.get('buffer')), google: Boolean(vault.get('google')), openai: Boolean(vault.get('openai')), runway: Boolean(vault.get('runway')),
        redirect: origin + googleCallback,
      };
      if (path === '/api/conexiones/buffer' && method === 'POST') {
        const key = requireText(body.key, 1000, 'Introduce una clave API de Buffer.');
        const channels = await getChannels(key);
        await vault.set('buffer', key);
        return { channels };
      }
      if (path === '/api/conexiones/openai' && method === 'POST') {
        const key = requireText(body.key, 1000, 'Introduce una clave API de OpenAI.');
        if (!/^sk-[\w-]+$/.test(key)) throw new ConnectionError(400, 'La clave debe empezar por sk-.');
        await vault.set('openai', key);
        return { configured: true };
      }
      if (path === '/api/conexiones/runway' && method === 'POST') {
        const key = requireText(body.key, 1000, 'Introduce la clave API de Runway.');
        await runway(key, 'organization');
        await vault.set('runway', key);
        return { configured: true };
      }
      if (path === '/api/conexiones/desconectar' && method === 'POST') {
        if (!['buffer', 'google', 'openai', 'runway'].includes(body.provider)) throw new ConnectionError(400, 'Elige una conexión.');
        if (body.provider === 'google') {
          authorization = null;
          access = null;
        }
        await vault.set(body.provider, null);
        return { disconnected: true };
      }
      if (path === '/api/conexiones/google' && method === 'POST') return googleStart(body, origin);
      if (path === '/api/conexiones/canales' && method === 'GET') return getChannels(bufferKey());
      if (path === '/api/conexiones/propiedades' && method === 'GET') {
        const { siteEntry } = await external(googleApi, { headers: { Authorization: `Bearer ${await googleAccess()}` } }, 'Search Console');
        return (siteEntry || []).filter(site => site.permissionLevel !== 'siteUnverifiedUser').map(site => site.siteUrl);
      }
      if (path === '/api/publicaciones' && method === 'GET') return history.slice(0, 50);
      if (path === '/api/publicaciones' && method === 'POST') return publish(body);
      if (path === '/api/publicaciones/actualizar' && method === 'POST') return refreshPublication(body.id);
      if (path === '/api/videos' && method === 'GET') return videos.slice(0, 30);
      if (path === '/api/videos' && method === 'POST') return createVideo(body);
      if (path === '/api/videos/actualizar' && method === 'POST') return refreshVideo(body.id);
      if (path === '/api/estadisticas/busqueda' && method === 'POST') return searchStats(body);
      if (path === '/api/estadisticas/redes' && method === 'POST') return socialStats(body);
      throw new ConnectionError(404, 'Página no encontrada.');
    },
  };
}
