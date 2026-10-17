const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const context={window:{}};
vm.runInNewContext(readFileSync(join(__dirname,'../profesor-mini-games.js'),'utf8'),context);
const api=context.window.profesorMiniGames;
const bingo={type:'bingo',answer:'Completado',options:Array.from({length:9},(_,i)=>`Concepto ${i} | Definición número ${i}`)};
test('Bingo has a stable nine-card layout and unique correct choices',()=>{
  const board=api.prepare(bingo,'session');
  assert.equal(board.cards.length,9);
  assert.equal(JSON.stringify(board),JSON.stringify(api.prepare(bingo,'session')));
  assert.equal(api.grade(bingo,board.clues.map(clue=>clue.answer),null,board),'correct');
  assert.equal(api.grade(bingo,Array(9).fill('other'),null,board),'incorrect');
  assert.equal(api.grade(bingo,Array(9).fill(''),0,board),'unanswered');
});
test('Mystery clues cannot reveal the answer; accents are accepted while Ñ stays distinct',()=>{
  assert.throws(()=>api.validate({type:'mystery',answer:'Gato',options:['Soy un gato','Soy un animal','Soy un felino']}));
  assert.equal(api.grade({type:'mystery',answer:'Águila'},{answer:'aguila'}),'correct');
  assert.equal(api.grade({type:'mystery',answer:'Año'},{answer:'ano'}),'incorrect');
});
test('Intruder must have one exact solution among distinct cards',()=>{
  assert.throws(()=>api.validate({type:'intruder',answer:'Pera',options:['Pera','pera','Limón']}));
  assert.throws(()=>api.validate({...bingo,options:bingo.options.slice(0,8)}));
  assert.equal(api.grade({type:'intruder',answer:'Águila'},'Gato'),'incorrect');
});
