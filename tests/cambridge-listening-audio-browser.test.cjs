const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve, basename } = require('node:path');
const { chromium, webkit } = require('./browser-runtime.cjs');

const audioDir = resolve(__dirname, '../apps/cambridge/assets/listening');
const files = new Set(readdirSync(audioDir));
const landingFiles = {
  'cambridge-info': ['text/html', resolve(__dirname, '../marketing/app_landings_demo/cambridge.html')],
  'landing-preview.js': ['text/javascript', resolve(__dirname, '../apps/cambridge/assets/studio/landing-preview.js')],
  'landing.css': ['text/css', resolve(__dirname, '../apps/cambridge/assets/studio/landing.css')],
};

test('todos los audios del recorrido B2 existen y tienen una duración válida', () => {
  for (const manifest of [...files].filter(name => name.endsWith('.json'))) {
    const source = readFileSync(resolve(audioDir, manifest), 'utf8');
    const references = [...source.matchAll(/b2-[a-z-]+\.wav/g)].map(match => match[0]);
    assert.ok(references.length > 0, `${manifest} no enlaza ningún audio`);
    for (const name of references) {
      assert.ok(files.has(name), `${manifest} enlaza un audio inexistente: ${name}`);
      const wav = readFileSync(resolve(audioDir, name));
      assert.equal(wav.toString('ascii', 0, 4), 'RIFF', name);
      assert.equal(wav.toString('ascii', 8, 12), 'WAVE', name);
      const channels = wav.readUInt16LE(22);
      const sampleRate = wav.readUInt32LE(24);
      const byteRate = wav.readUInt32LE(28);
      assert.ok(channels > 0 && sampleRate >= 16000 && byteRate > 0, name);
      assert.ok(wav.length / byteRate >= 10, `${name} es demasiado corto`);
    }
  }
});

for (const [name, engine, options] of [
  ['Chromium', chromium, { headless: true, channel: 'msedge' }],
  ['WebKit', webkit, { headless: true }],
]) {
  test(`${name} decodifica, reproduce y pausa los cuatro tipos de audio B2`, { timeout: 120000 }, async () => {
    const server = createServer((request, response) => {
      const file = basename(new URL(request.url, 'http://localhost').pathname);
      if (file === 'test') {
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end('<button id="play" type="button">Play</button>');
      } else if (Object.hasOwn(landingFiles, file)) {
        const [mime, path] = landingFiles[file];
        response.writeHead(200, { 'content-type': mime });
        response.end(readFileSync(path));
      } else if (files.has(file) && file.endsWith('.wav')) {
        const bytes = readFileSync(resolve(audioDir, file));
        response.writeHead(200, { 'content-type': 'audio/wav', 'content-length': bytes.length });
        response.end(bytes);
      } else {
        response.writeHead(404).end();
      }
    });
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    let browser;
    try {
      browser = await engine.launch(options);
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/test`);
      for (const file of ['b2-museum.wav', 'b2-repair-workshop.wav', 'b2-matching-pottery.wav', 'b2-city-wildlife-interview.wav']) {
        const duration = await page.evaluate(async (url) => {
          const old = document.querySelector('audio');
          if (old) old.remove();
          const audio = document.createElement('audio');
          audio.preload = 'metadata';
          audio.src = url;
          document.body.append(audio);
          await new Promise((done, fail) => {
            audio.addEventListener('loadedmetadata', done, { once: true });
            audio.addEventListener('error', () => fail(new Error(`No se decodifica ${url}`)), { once: true });
          });
          document.querySelector('#play').onclick = () => audio.play();
          return audio.duration;
        }, `http://127.0.0.1:${server.address().port}/${file}`);
        assert.ok(Number.isFinite(duration) && duration > 10, `${name} no cargó ${file}: ${duration}`);
        await page.locator('#play').click();
        await page.waitForFunction(() => document.querySelector('audio').currentTime > 0.15, null, { timeout: 10000 });
        await page.evaluate(() => document.querySelector('audio').pause());
        assert.equal(await page.locator('audio').evaluate(audio => audio.paused), true);
      }
      await page.goto(`http://127.0.0.1:${server.address().port}/cambridge-info`);
      await page.locator('[data-preview-open="practice"]').click();
      const audio = page.locator('#previewAudio');
      await audio.evaluate(element => element.play());
      await page.waitForFunction(() => document.getElementById('previewAudio').currentTime > 0.15);
      await page.getByRole('button', {name:'Writing', exact:true}).click();
      assert.equal(await audio.evaluate(element => element.paused), true);
    } finally {
      if (browser) await browser.close();
      await new Promise(done => server.close(done));
    }
  });
}
