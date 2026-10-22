const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,existsSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
const topics=JSON.parse(readFileSync(join(__dirname,'../../../backend/app/data/profesor-temario.json'),'utf8'));
function library(){
  const catalogue={};
  for(const topic of topics){catalogue[topic.course]??={};catalogue[topic.course][topic.subject]??=[];catalogue[topic.course][topic.subject].push(topic);}
  const context={window:{PROFESOR_TEMARIO:catalogue}};
  const labels=html.split('\n').find(line=>line.startsWith('const activityLabels='));
  const functions=html.slice(html.indexOf('let publicMaterialCache='),html.indexOf('function filteredMaterials()'));
  vm.createContext(context);
  vm.runInContext(readFileSync(join(__dirname,'../profesor-subjects.js'),'utf8'),context);
  vm.runInContext(labels+"\nlet materialPublicFormat='combined';\n"+functions,context);
  return {run:code=>vm.runInContext(code,context),context};
}
test('All public questions remain available separately with stable identities and their original context',()=>{
  const {run}=library();
  const before=run('JSON.stringify(publicTemarioMaterials())');
  assert.equal(run('temarioLibraryMaterials().length'),351);
  assert.equal(run("materialPublicFormat='single';temarioLibraryMaterials().length"),2106);
  assert.equal(run('new Set(publicSingleMaterials().map(m=>m.id)).size'),2106);
  assert.equal(run('publicSingleMaterials().every(m=>m.activity.questions.length===1&&m.activity.context.course&&m.subject&&m.activity.context.topic&&publicMaterial(m.id)===m)'),true);
  const original=JSON.parse(before).flatMap(m=>m.activity.questions.map(q=>q.id)).sort();
  const singles=JSON.parse(run('JSON.stringify(publicSingleMaterials().flatMap(m=>m.activity.questions.map(q=>q.id)))')).sort();
  assert.deepEqual(singles,original);
  assert.equal(run('JSON.stringify(publicTemarioMaterials())'),before);
  assert.equal(run("materialPublicFormat='combined';temarioLibraryMaterials().length"),351);
});

test('The public showcase is an explicit, stable selection and never mutates or replaces syllabus activities',()=>{
  const {run}=library();
  const before=run('JSON.stringify(publicTemarioMaterials())');
  assert.equal(run('publicMaterialSelection.length'),42);
  assert.equal(run('publicLibraryMaterials().length'),71);
  assert.equal(run('new Set(publicLibraryMaterials().map(m=>m.id)).size'),71);
  assert.equal(run('new Set(publicMaterialSelection.map(([id])=>id)).size'),42);
  assert.equal(run('curatedPublicMaterials().every(m=>m.activity.context.curated&&m.title&&m.body&&publicMaterial(m.id)===m&&publicMaterial(m.activity.context.curatedSourceId))'),true);
  assert.equal(run('curatedPublicMaterials().every(m=>JSON.stringify(m.activity.questions)===JSON.stringify(publicMaterial(m.activity.context.curatedSourceId).activity.questions))'),true);
  assert.equal(run("materialPublicFormat='single';publicLibraryMaterials().length"),71);
  assert.equal(run("materialPublicFormat='combined';publicLibraryMaterials().length"),71);
  assert.equal(run('new Set(publicLibraryMaterials().flatMap(m=>m.activity.questions.map(q=>q.type))).size'),18);
  run("curatedPublicMaterials()[0].activity.questions[0].options.push('Copia de prueba')");
  assert.equal(run('JSON.stringify(publicTemarioMaterials())'),before);
  assert.equal(run('publicSingleMaterials().length'),2106);
});

test('First four advanced public games cover distinct 1.º Primaria subjects with valid rounds and stable previews',()=>{
  const {run,context}=library();
  vm.runInContext(readFileSync(join(__dirname,'../profesor-mini-games.js'),'utf8'),context);
  const games=JSON.parse(run('JSON.stringify(publicAdvancedGames.slice(0,4))'));
  assert.deepEqual(games.map(game=>game.subject),['Matemáticas','Lengua','Inglés','Ciencias Naturales']);
  assert.ok(games.every(game=>game.activity.context.course==='1.º Primaria'&&game.activity.context.public&&game.activity.context.publicSourceId===game.id&&game.activity.questions.length));
  assert.ok(games.every(game=>/^public-[a-z-]+\.webp$/.test(game.artwork)&&existsSync(join(__dirname,'../assets/games',game.artwork))));
  assert.equal(new Set(games.map(game=>game.artwork)).size,4);
  assert.equal(run('publicAdvancedGames.every(game=>publicMaterial(game.id)===game)'),true);
  assert.equal(games[0].activity.questions[0].type,'dragdrop');
  assert.equal(games[0].activity.questions[0].options.length,6);
  assert.ok(games[0].activity.questions[0].options.every(row=>{const [place,number]=row.split('|').map(x=>x.trim());const match=place.match(/(\d) decenas? y (\d) unidad(?:es)?/);return match&&Number(number)===Number(match[1])*10+Number(match[2])}));
  for(const game of games.slice(1,3)){
    const pairs=game.activity.questions[0].options.map(row=>row.split('|').map(value=>value.trim()));
    assert.equal(game.activity.questions[0].type,'memory');
    assert.equal(pairs.length,6);
    assert.ok(pairs.every(pair=>pair.length===2&&pair.every(Boolean)));
    assert.equal(new Set(pairs.map(pair=>pair[0])).size,6);
    assert.equal(new Set(pairs.map(pair=>pair[1])).size,6);
  }
  assert.deepEqual(games[3].activity.questions.map(question=>question.answer),['Vista','Oído','Olfato','Gusto','Tacto']);
  assert.ok(games[3].activity.questions.every(question=>{context.window.profesorMiniGames.validate(question);return context.window.profesorMiniGames.grade(question,{answer:question.answer})==='correct'}));
});

test('Next four advanced public games cover 2.º Primaria with checkable market, spelling, English and life cycles',()=>{
  const {run,context}=library();
  vm.runInContext(readFileSync(join(__dirname,'../profesor-challenge-games.js'),'utf8'),context);
  const games=JSON.parse(run('JSON.stringify(publicAdvancedGames.slice(4,8))'));
  assert.deepEqual(games.map(game=>game.subject),['Matemáticas','Lengua','Inglés','Ciencias Naturales']);
  assert.ok(games.every(game=>game.activity.context.course==='2.º Primaria'&&game.activity.context.publicSourceId===game.id&&game.activity.questions.length&&existsSync(join(__dirname,'../assets/games',game.artwork))));
  assert.equal(new Set(games.map(game=>game.artwork)).size,4);
  const market=games[0].activity.questions[0];
  assert.equal(market.type,'race');
  assert.equal(market.options.length,6);
  context.window.profesorChallengeGames.validate(market);
  assert.equal(run('publicAdvancedGames.slice(4,8).every(game=>publicMaterial(game.id)===game)'),true);
  const spelling=games[1].activity.questions;
  assert.equal(spelling.length,5);
  assert.ok(spelling.every(question=>question.type==='error'&&question.strictCorrection===true&&question.prompt.includes(question.errorSegment)&&question.correctedSegment!==question.errorSegment&&question.answer.includes(question.correctedSegment)));
  assert.ok(spelling.some(question=>question.correctedSegment.startsWith('¿')));
  assert.ok(spelling.some(question=>question.correctedSegment.startsWith('¡')));
  const safari=games[2].activity.questions;
  assert.equal(safari.length,4);
  assert.ok(safari.every(question=>question.type==='sentence'&&question.options.length>=5&&question.options.join(' → ')===question.answer));
  assert.ok(safari.some(question=>question.options[1]==='is')&&safari.some(question=>question.options[1]==='are'));
  const garden=games[3].activity.questions;
  assert.equal(garden.length,3);
  assert.ok(garden.every(question=>question.type==='timeline'&&question.options.length===4&&question.options.join(' → ')===question.answer));
});

test('Four new 3.º Primaria games have playable rounds, unique artwork and correct course metadata',()=>{
  const {run,context}=library();
  vm.runInContext(readFileSync(join(__dirname,'../profesor-challenge-games.js'),'utf8'),context);
  vm.runInContext(readFileSync(join(__dirname,'../profesor-mini-games.js'),'utf8'),context);
  const games=JSON.parse(run('JSON.stringify(publicAdvancedGames.slice(8,12))'));
  assert.deepEqual(games.map(game=>game.subject),['Matemáticas','Lengua','Inglés','Ciencias Naturales']);
  assert.ok(games.every(game=>game.activity.context.course==='3.º Primaria'&&game.activity.context.publicSourceId===game.id&&existsSync(join(__dirname,'../assets/games',game.artwork))));
  assert.equal(new Set(games.map(game=>game.artwork)).size,4);
  assert.equal(run('publicAdvancedGames.slice(8,12).every(game=>publicMaterial(game.id)===game)'),true);
  const [numbers,grammar,english,science]=games.map(game=>game.activity.questions[0]);
  assert.equal(numbers.type,'race');
  assert.equal(numbers.options.length,6);
  context.window.profesorChallengeGames.validate(numbers);
  assert.equal(grammar.type,'cipher');
  context.window.profesorChallengeGames.validate(grammar);
  assert.equal(grammar.options.map(row=>row.split('|')[2].trim()).join(''),'LECTOR');
  assert.equal(english.type,'bingo');
  context.window.profesorMiniGames.validate(english);
  const bingo=context.window.profesorMiniGames.prepare(english,'3-primaria-test');
  assert.equal(bingo.cards.length,9);
  assert.equal(bingo.clues.length,9);
  assert.equal(science.type,'dragdrop');
  assert.equal(science.options.length,8);
  assert.deepEqual(new Set(science.options.map(row=>row.split('|')[1].trim())),new Set(['Nutrición','Relación','Reproducción']));
  vm.runInContext(html.slice(html.indexOf('function puzzleRows('),html.indexOf('function buildWordSearch(')),context);
  assert.equal(run("puzzleRows('dragdrop',publicAdvancedGames[11].activity.questions[0].options).length"),8);
});

test('Four 4.º Primaria scenes have complete puzzles and correct answer keys',()=>{
  const {run,context}=library();
  vm.runInContext(readFileSync(join(__dirname,'../profesor-challenge-games.js'),'utf8'),context);
  const games=JSON.parse(run('JSON.stringify(publicAdvancedGames.slice(12,16))'));
  assert.deepEqual(games.map(game=>game.subject),['Matemáticas','Lengua','Inglés','Ciencias Naturales']);
  assert.ok(games.every(game=>game.activity.context.course==='4.º Primaria'&&game.activity.context.publicSourceId===game.id&&existsSync(join(__dirname,'../assets/games',game.artwork))));
  assert.equal(new Set(games.map(game=>game.artwork)).size,4);
  assert.equal(run('publicAdvancedGames.slice(12,16).every(game=>publicMaterial(game.id)===game)'),true);
  const [fractions,accents,directions,mixtures]=games.map(game=>game.activity.questions);
  assert.equal(fractions[0].type,'table');
  context.window.profesorChallengeGames.validate(fractions[0]);
  assert.equal(fractions[0].options.length,6);
  assert.ok(fractions[0].options.every(option=>{const [fraction,multiplier,result]=option.split('|').map(value=>value.trim());const [a,b]=fraction.split('/').map(Number);const [c,d]=result.split('/').map(Number);const n=Number(multiplier.slice(1));return a*n===c&&b*n===d;}));
  assert.equal(accents.length,2);
  assert.ok(accents.every(question=>{context.window.profesorChallengeGames.validate(question);return question.type==='multiselect'&&question.options.length===6;}));
  assert.equal(directions.length,4);
  assert.ok(directions.every(question=>question.type==='sentence'&&question.options.length>=4&&question.options.join(' → ')===question.answer));
  assert.equal(mixtures[0].type,'race');
  context.window.profesorChallengeGames.validate(mixtures[0]);
  assert.equal(mixtures[0].options.length,6);
});

test('Four 5.º Primaria games have complete rounds, unique artwork and valid answer keys',()=>{
  const {run,context}=library();
  vm.runInContext(readFileSync(join(__dirname,'../profesor-challenge-games.js'),'utf8'),context);
  vm.runInContext(readFileSync(join(__dirname,'../profesor-mini-games.js'),'utf8'),context);
  const games=JSON.parse(run('JSON.stringify(publicAdvancedGames.slice(16,20))'));
  assert.deepEqual(games.map(game=>game.subject),['Matemáticas','Lengua','Inglés','Ciencias Naturales']);
  assert.ok(games.every(game=>game.activity.context.course==='5.º Primaria'&&game.activity.context.publicSourceId===game.id&&existsSync(join(__dirname,'../assets/games',game.artwork))));
  assert.equal(new Set(games.map(game=>game.artwork)).size,4);
  assert.equal(run('publicAdvancedGames.slice(16,20).every(game=>publicMaterial(game.id)===game)'),true);
  const [percentages,headlines,past,circuits]=games.map(game=>game.activity.questions);
  assert.equal(percentages[0].type,'race');
  assert.equal(percentages[0].options.length,6);
  context.window.profesorChallengeGames.validate(percentages[0]);
  assert.equal(headlines[0].type,'dragdrop');
  assert.equal(headlines[0].options.length,8);
  assert.deepEqual(new Set(headlines[0].options.map(row=>row.split('|')[1].trim())),new Set(['Sujeto','Predicado']));
  vm.runInContext(html.slice(html.indexOf('function puzzleRows('),html.indexOf('function buildWordSearch(')),context);
  assert.equal(run("puzzleRows('dragdrop',publicAdvancedGames[17].activity.questions[0].options).length"),8);
  assert.equal(past[0].type,'memory');
  assert.equal(past[0].options.length,6);
  assert.ok(past[0].options.every(row=>row.split('|').map(value=>value.trim()).every(Boolean)));
  assert.equal(circuits.length,4);
  assert.ok(circuits.every(question=>{context.window.profesorMiniGames.validate(question);return question.type==='intruder'&&question.options.length===4&&context.window.profesorMiniGames.grade(question,question.answer)==='correct'}));
});

test('Four 6.º Primaria games have valid boards, answers and their own illustrations',()=>{
  const {run,context}=library();
  vm.runInContext(readFileSync(join(__dirname,'../profesor-challenge-games.js'),'utf8'),context);
  vm.runInContext(readFileSync(join(__dirname,'../profesor-mini-games.js'),'utf8'),context);
  const games=JSON.parse(run('JSON.stringify(publicAdvancedGames.slice(20,24))'));
  assert.deepEqual(games.map(game=>game.subject),['Matemáticas','Lengua','Inglés','Ciencias Naturales']);
  assert.ok(games.every(game=>game.activity.context.course==='6.º Primaria'&&game.activity.context.publicSourceId===game.id&&existsSync(join(__dirname,'../assets/games',game.artwork))));
  assert.equal(new Set(games.map(game=>game.artwork)).size,4);
  assert.equal(run('publicAdvancedGames.slice(20,24).every(game=>publicMaterial(game.id)===game)'),true);
  const [decimal,grammar,english,body]=games.map(game=>game.activity.questions);
  assert.equal(decimal[0].type,'table');
  context.window.profesorChallengeGames.validate(decimal[0]);
  assert.equal(decimal[0].options.length,8);
  assert.ok(decimal[0].options.every(option=>{const [fraction,format,result]=option.split('|').map(value=>value.trim());const [a,b]=fraction.split('/').map(Number),actual=Number(result.replace('%','').replace(',','.'));return format==='Decimal'?actual===a/b:actual===100*a/b;}));
  assert.equal(grammar[0].type,'cipher');
  context.window.profesorChallengeGames.validate(grammar[0]);
  assert.equal(grammar[0].options.map(row=>row.split('|')[2].trim()).join(''),'VERBOS');
  assert.equal(english.length,4);
  assert.ok(english.every(question=>question.type==='sentence'&&question.options.join(' → ')===question.answer));
  assert.ok(english.some(question=>question.answer.includes('walked'))&&english.some(question=>question.answer.includes('plays')));
  assert.equal(body[0].type,'bingo');
  context.window.profesorMiniGames.validate(body[0]);
  const bingo=context.window.profesorMiniGames.prepare(body[0],'6-primaria-test');
  assert.equal(bingo.cards.length,9);
  assert.equal(bingo.clues.length,9);
});

test('Five 1.º ESO featured games match the syllabus, validate and keep their own scenes',()=>{
  const {run,context}=library();
  vm.runInContext(readFileSync(join(__dirname,'../profesor-challenge-games.js'),'utf8'),context);
  vm.runInContext(readFileSync(join(__dirname,'../profesor-mini-games.js'),'utf8'),context);
  const games=JSON.parse(run('JSON.stringify(publicAdvancedGames.slice(24,29))'));
  const player=readFileSync(join(__dirname,'../profesor-activity-play.js'),'utf8');
  const live=readFileSync(join(__dirname,'../profesor-live.js'),'utf8');
  const scenes=readFileSync(join(__dirname,'../assets/profesor-public-games.css'),'utf8');
  assert.deepEqual(games.map(game=>game.subject),['Matemáticas','Lengua','Inglés','Ciencias Naturales','Geografía e Historia']);
  assert.ok(games.every(game=>game.activity.context.course==='1.º ESO'&&game.activity.context.publicSourceId===game.id&&existsSync(join(__dirname,'../assets/games',game.artwork))));
  assert.equal(new Set(games.map(game=>game.artwork)).size,5);
  assert.ok(games.every(game=>{const scene=game.activity.questions[0].id.match(/^advanced-(.*)-1$/)[1],marker=new RegExp('\\|'+scene+'(?:\\||\\))');return marker.test(player)&&marker.test(live)&&scenes.includes(`data-public-scene="${scene}"`)}));
  assert.equal(run('publicAdvancedGames.slice(24,29).every(game=>publicMaterial(game.id)===game)'),true);
  const [mountain,news,english,science,atlas]=games.map(game=>game.activity.questions);
  assert.equal(mountain[0].type,'race');
  context.window.profesorChallengeGames.validate(mountain[0]);
  assert.equal(mountain[0].options.length,6);
  assert.equal(news[0].type,'dragdrop');
  assert.equal(news[0].options.length,8);
  assert.deepEqual(new Set(news[0].options.map(row=>row.split('|')[1].trim())),new Set(['Emisor','Receptor','Mensaje','Canal']));
  assert.ok(english.every(question=>{context.window.profesorChallengeGames.validate(question);return question.type==='multiselect'&&question.options.length===6&&question.options.filter(row=>row.endsWith('| sí')).length===3;}));
  assert.ok(science.every(question=>question.type==='timeline'&&question.options.length===4&&question.options.join(' → ')===question.answer));
  assert.equal(atlas[0].type,'bingo');
  context.window.profesorMiniGames.validate(atlas[0]);
  assert.equal(context.window.profesorMiniGames.prepare(atlas[0],'eso-test').cards.length,9);
});

test('Private, curated public and syllabus libraries use separate sources and filters',()=>{
  const {context,run}=library();
  context.state={library:[{id:'mine',title:'Privado',subject:'Lengua',updatedAt:'2026-10-18'}]};
  context.student=()=>null;
  vm.runInContext(html.slice(html.indexOf('function filteredMaterials()'),html.indexOf('function materialPageSize()')),context);
  vm.runInContext(html.slice(html.indexOf("let homeStudentQuery=''"),html.indexOf('function materialResultSummary()')).replace(",materialPublicFormat='combined'",''),context);
  assert.equal(run('materialLibrarySource()[0]===state.library[0]'),true);
  assert.equal(run('state.library.length'),1);
  run("switchMaterialMode('public')");
  assert.equal(run('filteredMaterials().length'),71);
  assert.equal(run('filteredMaterials()[0].id===publicLibraryMaterials()[0].id'),true);
  assert.equal(run("filteredMaterials().slice(0,29).every(m=>m.id.startsWith('public:advanced:'))"),true);
  assert.equal(run("filteredMaterials().slice(29).every(m=>!m.id.startsWith('public:advanced:'))"),true);
  run("materialCourse='6.º Primaria'");
  assert.equal(run("filteredMaterials().slice(0,4).every(m=>m.id.startsWith('public:advanced:'))"),true);
  run("materialCourse=''");
  run("materialType='memory';materialCourse='A1'");
  assert.equal(run('filteredMaterials().length'),2);
  run("switchMaterialMode('temario')");
  assert.equal(run('materialLibrarySource().length'),351);
  assert.equal(run("materialPublicFormat='single';materialLibrarySource().length"),2106);
  run("switchMaterialMode('mine')");
  assert.equal(run('filteredMaterials()[0].id'),'mine');
  run("switchMaterialMode('public')");
  assert.equal(run('filteredMaterials().length'),2);
  run("switchMaterialMode('temario')");
  assert.equal(run('materialPublicFormat'),'single');
});
test('Split activities preserve question groups, passages, alternatives and feedback without changing their pack',()=>{
  const {context,run}=library();
  const source={id:'public:fixture',title:'Tema',subject:'Lengua',activity:{version:1,context:{course:'3.º ESO',subject:'Lengua',topic:'Lectura',prepared:true,public:true},questions:[
    {id:'read-1',type:'reading',activityGroup:4,prompt:'Primera pregunta',answer:'Uno',text:'Un texto que se necesita para responder.',alternatives:['1'],rubric:'Justifica tu respuesta.'},
    {id:'read-2',type:'reading',activityGroup:4,prompt:'Segunda pregunta',answer:'Dos',text:''},
    {id:'read-3',type:'reading',activityGroup:8,prompt:'Otra actividad sobre el texto',answer:'Tres',text:''},
    {id:'quiz-1',type:'quiz',prompt:'Elige una respuesta',answer:'A',options:['A','B'],optionFeedback:[{option:'A',explanation:'Correcto'}]},
  ]}};
  const before=JSON.stringify(source);context.fixture=source;
  const split=JSON.parse(run('JSON.stringify(splitPublicMaterial(fixture))'));
  assert.deepEqual(split.map(m=>m.activity.questions.length),[2,1,1]);
  assert.equal(split[0].activity.questions[1].text,source.activity.questions[0].text);
  assert.equal(split[1].activity.questions[0].text,source.activity.questions[0].text);
  assert.deepEqual(split[0].activity.questions[0].alternatives,['1']);
  assert.deepEqual(split[2].activity.questions[0].optionFeedback,source.activity.questions[3].optionFeedback);
  assert.ok(split.every(m=>m.activity.questions.every(q=>q.activityGroup===1)&&m.activity.context.publicParentSourceId===source.id));
  run("splitPublicMaterial(fixture)[0].activity.questions[0].alternatives.push('mutación de prueba')");
  assert.equal(JSON.stringify(source),before);
});
