const { test } = require('node:test');
const assert = require('node:assert/strict');

test('el catálogo conservado de LA TERRAZA abre la dirección neutral sin perder estado ni contexto', async () => {
  const { createAppCatalog } = await import('../scripts/educame-dashboard/app-catalog.mjs');
  const legacy = { revision: 7, verified: true, apps: [{ id: 'gadeos', path: '/gadeos', state: 'privada', personal: true }] };
  let saved = legacy;
  const catalog = createAppCatalog({ operation: () => saved, writeOperation: (_key, value) => { saved = value; } });
  const current = catalog.read();
  assert.equal(current.apps[0].path, '/juegos-del-hambre');
  assert.equal(current.revision, 7); assert.equal(current.apps[0].state, 'privada'); assert.equal(current.apps[0].personal, true);
  assert.equal(legacy.apps[0].path, '/gadeos', 'no reescribe los datos guardados solo por consultar');
  catalog.remember(legacy);
  assert.equal(catalog.read().apps[0].path, '/juegos-del-hambre');
  assert.equal(catalog.read().apps[0].existing, true);
});
