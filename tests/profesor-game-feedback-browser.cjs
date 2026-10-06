const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
 await page.evaluate(()=>{const random=Math.random;Math.random=()=>.5;try{runActivity({id:'feedback-games',title:'Práctica',subject:'Ciencias',activity:{questions:[
  {type:'memory',prompt:'Encuentra las parejas.',answer:'Completado',options:['Gato | Cat','Perro | Dog']},
  {type:'crossword',prompt:'Completa las palabras.',answer:'Completado',options:['GATO | Felino','PATO | Ave acuática','RATA | Roedor']},
  {type:'gaps',prompt:'La raíz de \\(\\sqrt{4}\\) es ___.',answer:'2',options:[],hints:['Piensa en qué número al cuadrado da 4.']},
  {type:'short',prompt:'Explica el procedimiento.',answer:'Orientativo',options:[]}
 ]}},state.students[0].id);}finally{Math.random=random;}});
 await page.locator('#memory-0 [data-card="0"]').click();await page.locator('#memory-0 [data-card="2"]').click();
 assert.equal(await page.locator('#memory-0 .answer-wrong').count(),2);
 await page.waitForFunction(()=>!document.querySelector('#memory-0 .answer-wrong'));
 for(const [a,b] of [[0,1],[2,3]]){await page.locator(`#memory-0 [data-card="${a}"]`).click();await page.locator(`#memory-0 [data-card="${b}"]`).click();}
 assert.equal(await page.locator('#memory-0 .matched').count(),4);
 await page.getByRole('button',{name:'Actividad siguiente'}).click();
 await page.locator('#puzzle-1 [data-clue="0"]').click();await page.keyboard.type('G');
 assert.equal(await page.locator('#puzzle-1 [data-clue="0"]').getAttribute('aria-invalid'),null);
 await page.keyboard.type('AAA');assert.equal(await page.locator('#puzzle-1 [data-clue="0"]').getAttribute('aria-invalid'),'true');
 for(const [n,word] of ['GATO','PATO','RATA'].entries()){await page.locator(`#puzzle-1 [data-clue="${n}"]`).click();await page.keyboard.type(word);}
 assert.equal(await page.locator('#puzzle-1 [data-clue].answer-right').count(),3);
 await page.getByRole('button',{name:'Actividad siguiente'}).click();
 assert.equal(await page.locator('.play-question:visible .katex').count(),1);
 await page.locator('#r-2').fill('5');await page.getByRole('button',{name:'Comprobar',exact:true}).click();
 await page.getByRole('button',{name:'Ver solución',exact:true}).click();assert.match(await page.locator('#feedback-2').innerText(),/Solución orientativa/);
 await page.locator('#r-2').fill('2');await page.locator('#r-2').press('Enter');
 await page.getByRole('button',{name:'Actividad siguiente'}).click();await page.getByRole('button',{name:'Terminar',exact:true}).click();
 assert.match(await page.locator('.practice-result').innerText(),/3\/4 correctas.*3 con ayuda.*1 sin completar/s);
 assert.equal(await page.locator('.play-question:visible').count(),0);
 await page.reload();const attempt=await page.evaluate(()=>state.activityAttempts.at(-1));assert.equal(attempt.firstGrades[0],'incorrect');assert.equal(attempt.practice[2].assisted,true);assert.equal(attempt.grades[3],'unanswered');
 assert.deepEqual(errors,[]);console.log('PASS Memory mismatch/match, crossword word-level correction, gap math, solution reveal, unfinished answers and persistence');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
