const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

test('La portada ofrece un único acceso identificado al espacio privado GADEOS', () => {
  const html = readFileSync(resolve(__dirname, '../marketing/app_landings_demo/index.html'), 'utf8');
  const links = [...html.matchAll(/<a\b[^>]*href="\/gadeos"[^>]*>[\s\S]*?<\/a>/g)];
  assert.equal(links.length, 1, 'Debe existir un único acceso directo a /gadeos');
  const link = links[0][0];
  assert.match(link, /GADEOS · La arena de los recuerdos/);
  assert.match(link, /Acceso privado/);
  assert.match(link, /<svg\b[^>]*aria-hidden="true"/);
  // El acceso solicitado no es una ficha comercial filtrada por disponibilidad pública.
  assert.doesNotMatch(link, /data-product=/);
});
