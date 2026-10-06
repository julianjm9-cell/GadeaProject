const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1366,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
 const questions=[
  {type:'boolean',prompt:String.raw`El número \(\sqrt{2}\) es racional.`,answer:'Falso',options:['Verdadero','Falso'],explanation:String.raw`\(\sqrt{2}\) es irracional.`},
  {type:'numeric',prompt:String.raw`Calcula \(\frac{1}{2}\).`,answer:'0.5',options:[]},
  {type:'pasapalabra',prompt:'Resuelve el rosco.',answer:'Completado',options:['A | Insecto que produce miel | abeja','B | Lugar donde se prestan libros | biblioteca','C | Pigmento verde de las plantas | clorofila']},
  {type:'short',prompt:'Explica qué es un número racional.',answer:'Puede expresarse como fracción de enteros.',options:[],rubric:'Usa numerador y denominador entero no nulo.'}
 ];
 await page.evaluate(qs=>runActivity({id:'immediate',title:'Este título no ocupa espacio',subject:'Matemáticas',activity:{questions:qs}},state.students[0].id),questions);
 assert.equal(await page.locator('#playMode,.play-intro,.play-toolbar').count(),0);
 assert.equal(await page.locator('.play-question:visible').count(),1);
 assert.equal(await page.locator('.play-question:visible .katex').count(),1);
 await page.locator('input[value="Verdadero"]').check();
 assert.match(await page.locator('.play-choice:has(input:checked)').getAttribute('class'),/answer-wrong/);
 assert.match(await page.locator('#feedback-0').innerText(),/Revisa/);
 await page.locator('input[value="Falso"]').check();
 assert.match(await page.locator('.play-choice:has(input:checked)').getAttribute('class'),/answer-right/);
 await page.getByRole('button',{name:'Actividad siguiente'}).click();
 await page.locator('#r-1').fill('3');assert.equal(await page.locator('#r-1').getAttribute('aria-invalid'),null);
 await page.locator('#r-1').press('Enter');assert.equal(await page.locator('#r-1').getAttribute('aria-invalid'),'true');
 await page.locator('#r-1').fill('1/2');await page.locator('#r-1').press('Enter');assert.equal(await page.locator('#r-1').getAttribute('aria-invalid'),'false');
 await page.getByRole('button',{name:'Actividad anterior'}).click();assert.equal(await page.locator('input[value="Falso"]').isChecked(),true);
 await page.getByRole('button',{name:'Actividad siguiente'}).click();assert.equal(await page.locator('#r-1').inputValue(),'1/2');
 await page.getByRole('button',{name:'Actividad siguiente'}).click();
 await page.locator('#pasapalabra-input-2').fill('avión');await page.locator('#pasapalabra-input-2').press('Enter');
 assert.match(await page.locator('[data-letter="0"]').getAttribute('class'),/incorrect/);
 await page.locator('#pasapalabra-input-2').fill('biblioteca');await page.locator('#pasapalabra-input-2').press('Enter');
 assert.match(await page.locator('[data-letter="1"]').getAttribute('class'),/correct/);
 await page.locator('[data-pass]').click();assert.match(await page.locator('[data-letter="2"]').getAttribute('class'),/passed/);
 await page.locator('[data-letter="2"]').click();await page.locator('#pasapalabra-input-2').fill('clorofila');await page.locator('#pasapalabra-input-2').press('Enter');
 await page.locator('[data-letter="0"]').click();await page.locator('#pasapalabra-input-2').fill('abeja');await page.locator('#pasapalabra-input-2').press('Enter');
 assert.match(await page.locator('[data-letter="0"]').getAttribute('class'),/correct/);
 await page.screenshot({path:'tools/profesor-immediate-rosco.png'});
 await page.setViewportSize({width:390,height:600});
 const next=await page.locator('#nextQuestion').boundingBox();assert.ok(next.y+next.height<=600,'Navigation stays visible in short mobile screens');
 assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth>el.clientWidth+2),false);
 await page.screenshot({path:'tools/profesor-immediate-rosco-mobile.png'});await page.setViewportSize({width:1366,height:850});
 await page.getByRole('button',{name:'Actividad siguiente'}).click();await page.locator('#r-3').fill('Un cociente de enteros.');
 await page.getByRole('button',{name:'Guardar respuesta',exact:true}).click();assert.match(await page.locator('#feedback-3').innerText(),/profesor/);
 await page.getByRole('button',{name:'Terminar',exact:true}).click();
 assert.match(await page.locator('#activityScore').innerText(),/3\/4 correctas.*3 con ayuda.*1 pendientes/);
 const result=await page.evaluate(()=>state.activityAttempts.at(-1));assert.equal(result.practice[0].parts[0].attempts,2);assert.equal(result.practice[2].parts[0].firstCorrect,false);assert.equal(result.firstGrades[2],'incorrect');
 const count=await page.evaluate(()=>state.activityAttempts.length);await page.evaluate(()=>$('form').requestSubmit());assert.equal(await page.evaluate(()=>state.activityAttempts.length),count);
 await page.locator('[data-review-question="3"]').click();await page.selectOption('#grade-3','correct');assert.equal(await page.evaluate(()=>state.activityAttempts.at(-1).score),4);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tools/profesor-immediate-mobile.png'});
 assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth>el.clientWidth+2),false);
 // Full mathematical structures and safe text are shared with the curriculum.
 const rendered=await page.evaluate(()=>profesorText.rich(String.raw`\[\begin{cases}x+y=3\\x-y=1\end{cases}\]`));assert.ok(rendered.includes('katex'));assert.ok(!rendered.includes('formula-fallback'));
 const safe=await page.evaluate(()=>profesorText.rich('<img src=x onerror="alert(1)"> **Importante**'));assert.ok(!safe.includes('<img'));assert.ok(safe.includes('<strong>Importante</strong>'));
 const table=await page.evaluate(()=>profesorText.rich('Antes\n\n| Valor | Mitad |\n| --- | --- |\n| uno | 1/2 |\n\nDespués'));assert.ok(table.includes('<table>')&&table.includes('katex')&&table.includes('Después'));
 assert.deepEqual(errors,[]);console.log('PASS immediate correction, clean single-question navigation, retry history, teacher review, math rendering and mobile');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
