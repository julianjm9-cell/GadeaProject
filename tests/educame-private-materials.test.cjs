const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

test('el material privado retoma subidas, conserva cambios recientes y no duplica una importación', async t => {
  const { createPrivateMaterials } = await import('../scripts/educame-dashboard/private-materials.mjs');
  const { openPanelStore } = await import('../scripts/educame-dashboard/store.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'educame-materials-'));
  let store = openPanelStore(directory, {});
  t.after(async () => { store.close(); await rm(directory, { recursive: true, force: true, maxRetries: 5 }); });
  const root = join(directory, 'private-materials', 'gadeos'); await mkdir(root, { recursive: true });
  const manifest = { version: 1, title: 'Guía de ensayo', poster: 'poster.webp', guide: [{ title: 'Instrucciones', file: 'rules.webp', text: 'Texto accesible de ensayo.' }] };
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  for (const [i, name] of ['poster.webp', 'rules.webp'].entries()) await writeFile(join(root, name), Buffer.from('RIFF0000WEBP' + i));
  let failUpload = true, failSave = true, writes = 0;
  const uploads = [0, 0]; let campaign = { revision: 0, title: 'Personalizado', stations: [{ title: 'Conservar' }], media: { source: '', poster: null, guide: [] } };
  const admin = { async handle(action, cookie, body) {
    if (cookie !== 'authenticated') throw Object.assign(Error('Entra en administración'), { status: 401 });
    if (action === 'app-campaign-read') return structuredClone(campaign);
    if (action === 'app-image') {
      const index = Number(Buffer.from(body.data, 'base64').toString().at(-1)); uploads[index]++;
      if (index === 1 && failUpload) throw Error('Conexión interrumpida');
      return { url: '/api/private-apps/gadeos/images/' + String(index).repeat(32) + '.webp' };
    }
    assert.equal(action, 'app-campaign'); writes++;
    if (failSave) { campaign.title = 'Editado en otra pestaña'; campaign.revision++; throw Object.assign(Error('Conflicto de revisión'), { status: 409 }); }
    assert.equal(body.revision, campaign.revision); campaign = { ...body, revision: body.revision + 1 }; return campaign;
  } };
  let service = createPrivateMaterials({ directory, store, admin });
  await assert.rejects(service.status('', {}), { status: 401 });
  const status = await service.status('authenticated', {}); assert.equal(status.applied, false);
  await assert.rejects(service.apply('authenticated', {}, 'changed'), { status: 409 });
  await assert.rejects(service.apply('authenticated', {}, status.hash), /interrumpida/);
  store.close(); store = openPanelStore(directory, {}); service = createPrivateMaterials({ directory, store, admin });
  failUpload = false;
  await assert.rejects(service.apply('authenticated', {}, status.hash), { status: 409 });
  failSave = false; await service.apply('authenticated', {}, status.hash);
  assert.deepEqual(uploads, [1, 2]); assert.equal(campaign.title, 'Editado en otra pestaña'); assert.equal(campaign.stations[0].title, 'Conservar');
  assert.equal(campaign.media.guide[0].text, 'Texto accesible de ensayo.');
  assert.equal((await service.apply('authenticated', {}, status.hash)).reused, true); assert.equal(writes, 2);
  assert.equal((await service.status('authenticated', {})).applied, true);
  manifest.poster = '../outside.webp'; await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  await assert.rejects(service.status('authenticated', {}), { status: 400 });
});
