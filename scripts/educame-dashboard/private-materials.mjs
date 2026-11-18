import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OperationError } from './operations.mjs';

// Prepared personal artwork stays outside Git and is sent only to the authenticated admin API.
export function createPrivateMaterials({ directory, store, admin }) {
  const root = join(directory, 'private-materials', 'gadeos'), key = 'gadeos-private-materials-v1';
  let working = false;
  async function readBundle() {
    let manifest;
    try { manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw new OperationError(400, 'No se puede leer el paquete privado de GADEOS.'); }
    if (manifest.version !== 1 || !Array.isArray(manifest.guide) || manifest.guide.length > 8 || typeof manifest.title !== 'string' || manifest.title.length > 120) throw new OperationError(400, 'El paquete privado no tiene un formato válido.');
    const files = [manifest.poster, ...manifest.guide.map(page => page.file)];
    if (files.some(name => !/^[a-z0-9-]+\.webp$/.test(name || '')) || manifest.guide.some(page => typeof page.title !== 'string' || !page.title || page.title.length > 100)) throw new OperationError(400, 'Revisa los nombres de las imágenes preparadas.');
    const data = [];
    for (const name of files) {
      const bytes = await readFile(join(root, name));
      if (bytes.length > 5_000_000 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new OperationError(400, 'Usa imágenes WebP privadas de menos de 5 MB.');
      data.push({ name, bytes, hash: createHash('sha256').update(bytes).digest('hex') });
    }
    const hash = createHash('sha256').update(JSON.stringify(manifest)).update(data.map(file => file.hash).join('')).digest('hex');
    return { manifest, data, hash };
  }
  const call = (action, cookie, body, response) => admin.handle(action, cookie, body, response);
  return {
    async status(cookie, response) {
      const campaign = await call('app-campaign-read', cookie, {}, response);
      const bundle = await readBundle();
      return bundle ? { available: true, title: bundle.manifest.title, pages: bundle.manifest.guide.length,
        hash: bundle.hash, applied: campaign.media?.source === bundle.hash } : { available: false };
    },
    async apply(cookie, response, expectedHash) {
      if (working) throw new OperationError(409, 'Se están importando los materiales. Espera a que termine.');
      working = true;
      try {
        const campaign = await call('app-campaign-read', cookie, {}, response);
        if (!campaign.media) throw new OperationError(409, 'Actualiza Hostinger para activar el cartel y la guía privados.');
        const bundle = await readBundle();
        if (!bundle || bundle.hash !== expectedHash) throw new OperationError(409, 'Los materiales preparados han cambiado. Vuelve a abrir esta sección.');
        const saved = store.operation(key) || { uploads: {} };
        if (campaign.media.source === bundle.hash) return { applied: true, revision: campaign.revision, reused: true };
        for (const file of bundle.data) {
          if (!saved.uploads[file.hash]) {
            const result = await call('app-image', cookie, { data: file.bytes.toString('base64') }, response);
            if (!/^\/api\/private-apps\/gadeos\/images\/[a-f0-9]{32}\.webp$/.test(result.url || '')) throw new OperationError(502, 'La subida no devolvió una imagen privada válida.');
            saved.uploads[file.hash] = result.url;
            store.writeOperation(key, saved); // Resume after a restart without repeating acknowledged uploads.
          }
        }
        const media = { source: bundle.hash, poster: saved.uploads[bundle.data[0].hash],
          guide: bundle.manifest.guide.map((page, i) => ({ title: page.title, image: saved.uploads[bundle.data[i + 1].hash], text: page.text || '' })) };
        const result = await call('app-campaign', cookie, { ...campaign, media }, response);
        saved.applied = { hash: bundle.hash, revision: result.revision, at: new Date().toISOString() };
        store.writeOperation(key, saved);
        return { applied: true, revision: result.revision };
      } finally { working = false; }
    },
  };
}
