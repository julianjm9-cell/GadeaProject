const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const source = read('apps/e25/index.html');
const moduleData = source.slice(source.indexOf('const MODULES = ['), source.indexOf('\n];', source.indexOf('const MODULES = [')));
const topicIds = [...moduleData.matchAll(/\{id:'((?:len|ing|geo|his|mat|cie)-[^']+)'/g)].map(match => match[1]);

test('ESO Adultos offers an external game for every teaching topic', () => {
  const context = {window: {}};
  vm.runInNewContext(read('apps/e25/assets/eso-external-games.js'), context);
  const catalog = context.window.EsoExternalGames;
  assert.equal(topicIds.length, 65);
  assert.deepEqual([...catalog.topicIds].sort(), [...topicIds].sort());
  for (const id of topicIds) {
    const game = catalog.forTopic(id);
    assert.equal(game.provider, 'Educaplay');
    assert.match(game.url, /^https:\/\/es\.educaplay\.com\/recursos-educativos\/[0-9]+-[a-z0-9_]+\.html$/);
  }
});

test('Profesor Particular external cards use local artwork and direct source links', () => {
  const context = {window: {}};
  vm.runInNewContext(read('apps/profesor/profesor-external-games.js'), context);
  const games = context.window.PROFESOR_EXTERNAL_GAMES;
  const code = read('apps/profesor/index.html');
  const artSource = code.match(/const materialArtworkFiles=({[^;]+});/);
  assert.ok(artSource);
  const artFiles = vm.runInNewContext('(' + artSource[1] + ')');
  assert.equal(games.length, 25);
  for (const game of games) {
    assert.equal(game.external.provider, 'Educaplay');
    assert.match(game.external.url, /^https:\/\/es\.educaplay\.com\/recursos-educativos\/[0-9]+-[a-z0-9_]+\.html$/);
    const base = artFiles[game.external.artType];
    assert.ok(base, `${game.title}: missing art type`);
    const mature = /\b(?:eso|bachillerato)\b/i.test(game.course) || game.subject === 'Inglés';
    const filename = `${mature ? 'mature-' : ''}${base}.webp`;
    assert.ok(fs.existsSync(path.join(root, 'apps/profesor/assets/games', filename)), `${game.title}: missing ${filename}`);
  }
});
