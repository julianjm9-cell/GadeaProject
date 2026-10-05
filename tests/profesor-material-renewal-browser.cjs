const { chromium } = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 950 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    const material = { id: 'renewal', title: 'Aprende y practica', subject: 'Ciencias', activity: { version: 1, questions: [
      { type: 'classify', prompt: 'Gato', answer: 'Mamífero', options: ['Mamífero','Ave'] },
      { type: 'classify', prompt: 'Perro', answer: 'Mamífero', options: ['Mamífero','Ave'] },
      { type: 'classify', prompt: 'Pato', answer: 'Ave', options: ['Mamífero','Ave'] },
      { type: 'multigaps', prompt: 'Uno más uno es ___ y cuatro entre dos es ___.', answer: '2 | 2', options: ['2~dos','2~dos'], explanation: 'Ambas operaciones dan dos.' },
      { type: 'numeric', prompt: 'La mitad de un litro', answer: '0.5', options: [], unit: 'L', tolerance: 0, explanation: 'Dividimos un litro entre dos.', hints: ['Piensa en dos partes iguales.'] },
      { type: 'sentence', prompt: 'Construye la frase', answer: 'Las plantas → necesitan → luz.', options: ['Las plantas','necesitan','luz.'] },
      { type: 'problem', prompt: 'Tres cajas con dos libros cada una. ¿Cuántos libros hay?', answer: '3 × 2 = 6 libros.', options: [], rubric: 'Identifica los grupos y multiplica; expresa el resultado en libros.' },
      { type: 'dragdrop', prompt: 'Agrupa los animales', answer: 'Completado', options: ['Gato | Mamíferos','Perro | Mamíferos','Pato | Aves'] },
      { type: 'gaps', prompt: 'La capital del Reino Unido es ___.', answer: 'Londres', alternatives: ['London'], wordBank: ['London','Paris'], options: [] },
    ] } };
    await page.evaluate(value => { validateActivityQuestions(value.activity.questions); runActivity(value, state.students[0].id); }, material);
    assert.equal(await page.locator('[data-group-member]').count(), 2);
    await page.selectOption('#playMode', 'step');
    assert.equal(await page.locator('.play-question:visible').count(), 1);
    for (const [piece,target] of [[0,0],[1,0],[2,1]]) {
      if (piece === 0) await page.locator(`[data-question="0"] [data-piece="${piece}"]`).dragTo(page.locator(`[data-question="0"] [data-bucket="${target}"]`));
      else {
        await page.locator(`[data-question="0"] [data-piece="${piece}"]`).click();
        await page.locator(`[data-question="0"] [data-bucket="${target}"]`).click();
      }
    }
    assert.equal(await page.locator('[data-question="0"] .placement-bucket').first().locator('[data-return]').count(), 2);
    await page.getByRole('button', { name: 'Actividad siguiente' }).click();
    await page.locator('[data-multi-gap="0"]').fill('dos');
    await page.locator('[data-multi-gap="1"]').fill('2');
    await page.getByRole('button', { name: 'Actividad siguiente' }).click();
    await page.getByRole('button', { name: 'Necesito una pista' }).click();
    assert.match(await page.locator('#hints-4').innerText(), /partes iguales/);
    await page.locator('#r-4').fill('1/2');
    await page.getByRole('button', { name: 'Actividad siguiente' }).click();
    for (const fragment of ['Las plantas','necesitan','luz.']) await page.locator('[data-fragment]').filter({ hasText: fragment }).click();
    assert.equal(await page.locator('#r-5').inputValue(), 'Las plantas → necesitan → luz.');
    await page.getByRole('button', { name: 'Actividad siguiente' }).click();
    await page.getByRole('textbox', { name: 'Datos importantes', exact: true }).fill('3 cajas y 2 libros por caja');
    await page.getByRole('textbox', { name: 'Planteamiento', exact: true }).fill('Multiplicar');
    await page.getByRole('textbox', { name: 'Cálculos', exact: true }).fill('3 × 2 = 6');
    await page.getByRole('textbox', { name: 'Respuesta y comprobación', exact: true }).fill('6 libros');
    await page.getByRole('button', { name: 'Actividad siguiente' }).click();
    for (const [piece,target] of [[0,0],[1,0],[2,1]]) {
      await page.locator(`#puzzle-7 [data-piece="${piece}"]`).click();
      await page.locator(`#puzzle-7 [data-bucket="${target}"]`).click();
    }
    await page.getByRole('button', { name: 'Actividad siguiente' }).click();
    await page.locator('[data-question="8"] .word-bank').getByRole('button',{name:'London',exact:true}).click();
    await page.getByRole('button', { name: 'Comprobar respuestas' }).click();
    assert.match(await page.locator('#activityScore').innerText(), /8\/9 correctas.*1 pendientes/);
    await page.selectOption('#playMode', 'worksheet');
    assert.equal(await page.locator('.gap-result').count(), 2);
    assert.match(await page.locator('#feedback-4').innerText(), /Dividimos/);
    await page.selectOption('#grade-6', 'correct');
    assert.equal(await page.evaluate(() => state.activityAttempts.at(-1).score), 9);

    // Retry only incorrect exercises; opening a second player must not keep old listeners.
    await page.evaluate(() => runActivity({ id: 'retry', title: 'Repaso', subject: 'Matemáticas', activity: { version: 1, questions: [
      { type: 'numeric', prompt: '2 + 2', answer: '4', options: [] },
      { type: 'gaps', prompt: '3 + 3 = ___', answer: '6', options: [] },
    ] } }, ''));
    await page.locator('#r-0').fill('5'); await page.locator('#r-1').fill('6');
    await page.getByRole('button', { name: 'Comprobar respuestas' }).click();
    await page.getByRole('button', { name: 'Repasar errores' }).click();
    assert.equal(await page.locator('.play-question').count(), 1);
    await page.locator('#r-0').fill('4');
    await page.getByRole('button', { name: 'Comprobar respuestas' }).click();
    assert.match(await page.locator('#activityScore').innerText(), /1\/1 correctas/);
    await page.locator('#dialog [data-action="close"]').last().click();

    // Structured editor keeps teaching metadata and repeated gap solutions on save/use.
    const edit = { ...material, activity: { version: 1, questions: [material.activity.questions[3], material.activity.questions[4]] } };
    await page.evaluate(value => editActivity(value), edit);
    assert.equal(await page.locator('#o-0').isVisible(), false);
    assert.equal(await page.locator('.structured-row').count(), 2);
    await page.locator('#useDraft').click();
    await page.locator('[data-multi-gap="0"]').fill('2'); await page.locator('[data-multi-gap="1"]').fill('dos');
    await page.locator('#r-1').fill('0,5');
    await page.getByRole('button', { name: 'Comprobar respuestas' }).click();
    assert.match(await page.locator('#feedback-0').innerText(), /Ambas operaciones/);
    assert.match(await page.locator('#feedback-1').innerText(), /Dividimos/);

    // Rosco supports a whole alphabet and distinguishes pending/passed/answered.
    const rosco = { id:'rosco', title:'El rosco del conocimiento', subject:'Lengua', activity:{version:1,questions:[{type:'pasapalabra',prompt:'Responde o pasa a la siguiente letra',answer:'Completado',options:['A | Insecto que produce miel | abeja','B | Lugar donde se prestan libros | biblioteca','C | Pigmento verde que capta la luz | clorofila','D | Parte dura de la boca que sirve para masticar | diente','E | Animal de gran tamaño con trompa | elefante','F | Parte de una planta con pétalos | flor','G | Felino doméstico | gato','H | Agua en estado sólido | hielo','I | Porción de tierra rodeada de agua | isla','J | Animal de cuello largo | jirafa','L | Satélite natural de la Tierra | luna','M | Elevación natural del terreno | montaña']}]}};
    await page.evaluate(value => { validateActivityQuestions(value.activity.questions); runActivity(value, ''); }, rosco);
    await page.locator('[data-pass]').click();
    assert.equal(await page.locator('[data-letter="0"]').getAttribute('class'), ' passed');
    await page.screenshot({ path: 'tools/profesor-renewal-rosco.png' });
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('#dialog').evaluate(d=>d.scrollWidth > d.clientWidth+2), false);
    await page.screenshot({ path: 'tools/profesor-renewal-mobile.png' });
    await page.setViewportSize({width:1300,height:950});
    await page.evaluate(() => runActivity({ id:'puzzles',title:'Palabras de animales',subject:'Ciencias',activity:{version:1,questions:[
      {type:'wordsearch',prompt:'Encuentra los animales',answer:'Completado',options:['GATO','PATO','RANA']},
      {type:'crossword',prompt:'Completa las pistas',answer:'Completado',options:['GATO | Felino','PATO | Ave acuática','RATA | Roedor']},
    ]}},''));
    const paths = await page.evaluate(() => buildWordSearch(['GATO','PATO','RANA']).placements.map(p=>({first:p.row*10+p.col,last:p.endRow*10+p.endCol})));
    for (const route of paths) {
      const first = page.locator(`#puzzle-0 [data-cell="${route.first}"]`), last = page.locator(`#puzzle-0 [data-cell="${route.last}"]`);
      await first.scrollIntoViewIfNeeded(); const a=await first.boundingBox(), b=await last.boundingBox();
      await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8}); await page.mouse.up();
    }
    assert.equal(await page.locator('#puzzle-0 .puzzle-word-list .found').count(),3);
    for (const [n,word] of ['GATO','PATO','RATA'].entries()) { await page.locator(`#puzzle-1 [data-clue="${n}"]`).click(); await page.keyboard.type(word); }
    await page.getByRole('button',{name:'Comprobar respuestas'}).click();
    assert.match(await page.locator('#activityScore').innerText(),/2\/2 correctas/);
    await page.screenshot({path:'tools/profesor-renewal-crossword.png'});
    await page.locator('#dialog [data-action="close"]').last().click();

    await page.evaluate(() => {
      const blob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#b5d9f7"/><circle cx="200" cy="100" r="40" fill="#215bac"/></svg>'],{type:'image/svg+xml'});
      visualImageUrls.set('server:renewal-zone',Promise.resolve(URL.createObjectURL(blob)));
      editActivity({id:'zones',title:'Observa la imagen',subject:'Geometría',activity:{version:1,questions:[{type:'imagepoint',prompt:'Señala el círculo',answer:'Zona marcada',options:[],image:{id:'renewal-zone',filename:'circle.svg'}}]}});
    });
    const photo = page.locator('#image-preview-0 img'); await photo.waitFor(); await photo.scrollIntoViewIfNeeded();
    const bounds = await photo.boundingBox();
    await page.mouse.move(bounds.x+bounds.width*.25,bounds.y+bounds.height*.25); await page.mouse.down();
    await page.mouse.move(bounds.x+bounds.width*.75,bounds.y+bounds.height*.75,{steps:8}); await page.mouse.up();
    assert.equal(await page.locator('#zone-width-0').inputValue(),'50');
    await page.locator('#useDraft').click();
    await page.locator('#visual-0 img').click();
    await page.getByRole('button',{name:'Comprobar respuestas'}).click();
    assert.match(await page.locator('#activityScore').innerText(),/1\/1 correctas/);
    assert.equal(await page.locator('.visual-solution-zone').evaluate(el=>el.style.width),'50%');
    assert.deepEqual(errors, []);
    console.log('PASS renewal: grouped boards, step view, guided problem, fractions, variants, per-gap feedback, retry, structured editor and responsive rosco');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
