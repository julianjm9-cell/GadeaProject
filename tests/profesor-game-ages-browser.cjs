const { chromium } = require('./browser-runtime.cjs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');

const types = ['pasapalabra','hangman','wordsearch','memory','flashcard','sentence','timeline','error','crossword','dragdrop','mystery','intruder','bingo','cipher','race'];
const fallback = {
  pasapalabra:{prompt:'Completa el rosco.',answer:'Completado',options:['A | Líquido esencial | agua','B | Lugar con libros | biblioteca','C | Pigmento verde | clorofila']},
  hangman:{prompt:'Animal que maúlla.',answer:'GATO',options:[]},
  wordsearch:{prompt:'Encuentra los animales.',answer:'Completado',options:['GATO','PATO','RANA']},
  flashcard:{prompt:'¿Qué astro ilumina la Tierra?',answer:'El Sol',options:[]},
  crossword:{prompt:'Completa el crucigrama.',answer:'Completado',options:['GATO | Felino','PATO | Ave','RATA | Roedor']},
};

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const [width,height] of [[1366,768],[390,844]]) {
      const page = await browser.newPage({ viewport:{width,height} });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
      for (const [course,age] of [['4.º Primaria','child'],['3.º ESO','teen'],['','neutral']]) {
        await page.evaluate(({types,fallback,course}) => {
          const examples = new Map();
          for (const material of publicAdvancedGames) for (const question of material.activity.questions) {
            if (types.includes(question.type) && !examples.has(question.type)) examples.set(question.type,question);
          }
          const questions = types.map(type => {
            const question = structuredClone(examples.get(type) || fallback[type]);
            if (!question) throw Error('Falta una pregunta de ' + type);
            delete question.id;
            delete question.publicScene;
            return { ...question, type };
          });
          runActivity({id:'age-variants',title:'Repaso visual',subject:'Ciencias',activity:{version:1,context:{course},questions}},'');
        },{types,fallback,course});
        assert.equal(await page.locator('.play-question[data-game-age="'+age+'"]').count(),types.length,`${course}: all themed games`);
        assert.equal(await page.locator('.play-question[data-public-scene]').count(),0,'private games must not inherit public scenes');
        for (let i=0;i<types.length;i++) {
          if (i) await page.getByRole('button',{name:'Actividad siguiente'}).click();
          const question=page.locator('.play-question:visible');
          assert.equal(await question.getAttribute('data-type'),types[i]);
          const metrics=await question.evaluate(question => {
            const dialog=document.querySelector('#dialog'),content=document.querySelector('.play-content'),footer=document.querySelector('.play-footer');
            return {horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:content.scrollHeight-content.clientHeight,footerBottom:footer.getBoundingClientRect().bottom,background:getComputedStyle(question).backgroundImage};
          });
          assert.ok(metrics.horizontal<=2,`${age} ${types[i]} ${width}: horizontal overflow ${JSON.stringify(metrics)}`);
          assert.ok(metrics.footerBottom<=height+2,`${age} ${types[i]} ${width}: footer clipped`);
          assert.ok(metrics.overflow===0||metrics.overflow>18,`${age} ${types[i]} ${width}: tiny scrollbar ${metrics.overflow}`);
          if (age==='child'||age==='teen') assert.match(metrics.background,/profesor-play-(?:child|teen)-v1\.webp/,`${age} ${types[i]} should show its age-specific background`);
          if (age==='neutral') assert.doesNotMatch(metrics.background,/profesor-play-(?:child|teen)-v1\.webp/);
          if (i===1||i===2||i===14) await page.screenshot({path:path.resolve(`tmp/profesor-${age}-${types[i]}-${width}.png`)});
        }
        await page.locator('#dialog .close').click();
      }
      assert.deepEqual(errors,[],`page errors ${width}`);
      await page.close();
    }
    console.log('PASS fifteen game formats with child, teen and neutral themes on desktop and mobile');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
