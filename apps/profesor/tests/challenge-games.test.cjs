const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const context={window:{}};vm.runInNewContext(readFileSync(join(__dirname,'../profesor-challenge-games.js'),'utf8'),context);
const api=context.window.profesorChallengeGames;
const samples=JSON.parse(readFileSync(join(__dirname,'fixtures/challenge-games.json'),'utf8'));

test('All four games validate and check complete, missing and incorrect answers without leaking solutions',()=>{
 for(const q of samples){
  api.validate(q);const items=api.prepare(q,'sample');
  const correct=items.map(item=>q.type==='multiselect'?item.answer:q.type==='race'?item.answer:item.answer.split('~')[0]);
  assert.equal(api.grade(q.type,items,correct),'correct',q.type);
  assert.equal(api.grade(q.type,items,[]),'unanswered');
  const wrong=correct.map(value=>typeof value==='boolean'?!value:'Incorrecta');
  assert.equal(api.grade(q.type,items,wrong),'incorrect');
  const safe=api.safeItems(q.type,items);
  assert.ok(safe.every(item=>!Object.hasOwn(item,'answer')));
  if(q.type==='cipher')assert.ok(safe.every(item=>item.letter===''));
 }
});
test('Multiple selection rejects the all-empty shortcut and catches correct answers left unchecked',()=>{
 const q=samples[0],items=api.prepare(q,'test');
 assert.equal(api.grade(q.type,items,items.map(()=>false)),'unanswered');
 const answers=items.map(item=>item.answer),first=answers.indexOf(true);answers[first]=false;
 assert.equal(api.grade(q.type,items,answers),'incorrect');assert.equal(api.grade(q.type,items,answers,first),'incorrect');
 assert.throws(()=>api.validate({...q,options:['A | sí','B | sí','C | sí']}));
});
test('Malformed tables, answer-revealing clues and ambiguous race choices are rejected',()=>{
 assert.throws(()=>api.validate({...samples[1],options:samples[1].options.slice(0,3)}));
 assert.throws(()=>api.validate({...samples[1],options:[...samples[1].options.slice(0,3),samples[1].options[0]]}));
 assert.throws(()=>api.validate({...samples[2],options:['Soy un gato | gato | S',...samples[2].options.slice(1)]}));
 assert.throws(()=>api.validate({...samples[3],options:['Pregunta | Sí | sí | No',...samples[3].options.slice(1)]}));
});
test('Equivalent cipher answers preserve Ñ, and only checked clues reveal their reward letters',()=>{
 const q=samples[2],items=api.prepare(q,'test'),value=['gato','perro','pajaro'];
 assert.equal(api.grade(q.type,items,value),'correct');
 const safe=api.safeItems(q.type,items,{'0':'correct'});assert.equal(safe[0].letter,'S');assert.equal(safe[1].letter,'');
 assert.equal(api.grade('cipher',[{answer:'año'}],['ano']),'incorrect');
});
test('The new games keep the intended basic/advanced split and have thumbnails for both audiences',()=>{
 const html=readFileSync(join(__dirname,'../index.html'),'utf8');
 const advanced=html.split('\n').find(line=>line.startsWith('const advancedTypes='));
 assert.match(advanced,/'cipher','race'/);assert.doesNotMatch(advanced,/'multiselect'|'table'/);
 for(const q of samples)for(const prefix of ['', 'mature-'])assert.ok(readFileSync(join(__dirname,'../assets/games/'+prefix+q.type+'.webp')).length>1000);
});

test('The race requires the preceding success during play and allows every stage when reviewing',()=>{
 assert.equal(api.canVisit(0,{},false),true);
 assert.equal(api.canVisit(1,{},false),false);
 assert.equal(api.canVisit(1,{'0':'incorrect'},false),false);
 assert.equal(api.canVisit(1,{'0':'correct'},false),true);
 assert.equal(api.canVisit(3,{'0':'incorrect'},true),true);
});

test('Table headers remain coherent when source labels differ only in capitalization',()=>{
 const q={...samples[1],options:['Un metro | Centímetros | 100','un metro | Milímetros | 1000','Dos metros | CENTÍMETROS | 200','dos metros | MILÍMETROS | 2000']};
 const items=api.prepare(q,'table');
 assert.equal(new Set(items.map(item=>item.row)).size,2);
 assert.equal(new Set(items.map(item=>item.column)).size,2);
 assert.throws(()=>api.validate({...q,options:[...q.options.slice(0,3),'dos metros | Milímetros | Una\nrespuesta']}));
});
