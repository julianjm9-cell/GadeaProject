const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const code=readFileSync(join(__dirname,'../profesor-live.js'),'utf8');
const context={};vm.createContext(context);
vm.runInContext(code.slice(code.indexOf('  function summaryValue('),code.indexOf('  function questionMarkup(')),context);
const summary=(value,question)=>context.summaryValue(value,question);
test('Memory shows the matched concepts and never opaque tokens, including unavailable historic cards',()=>{
  const question={type:'memory',cards:[{token:'private-token-1',label:'árbitro'},{token:'private-token-2',label:'referee'}]};
  assert.equal(summary([['private-token-1','private-token-2']],question),'árbitro ↔ referee');
  assert.equal(summary([['old-token','missing-token']],question),'Pareja 1 encontrada');
  assert.equal(summary([],question),'Aún sin responder');
});
test('Board answers use concepts, clue letters or words instead of internal coordinates',()=>{
  assert.equal(summary([[[2,4],[2,5]],[]],{type:'wordsearch',words:['SOL','LUNA']}),'Palabras marcadas: SOL');
  assert.equal(summary(['Planta','Animal'],{type:'dragdrop',items:['Roble','Gato']}),'Roble → Planta · Gato → Animal');
  assert.equal(summary(['azul',''],{type:'pasapalabra',entries:[{letter:'A'},{letter:'B'}]}),'A: azul · B: Sin responder');
  assert.equal(summary(['SOL'],{type:'crossword',entries:[{number:3}]}),'3: SOL');
  assert.equal(summary(['card-token'],{type:'bingo',clues:[{clue:'Unidad de vida'}],cards:[{token:'card-token',label:'Célula'}]}),'Unidad de vida: Célula');
});
test('Simple answers, flashcard assessment and error corrections remain readable',()=>{
  assert.equal(summary('partial',{type:'flashcard'}),'Con ayuda');
  assert.equal(summary({selected:'comé',correction:'come'},{type:'error'}),'Error: comé · Corrección: come');
  assert.equal(summary([12,45],{type:'imagepoint'}),'Zona marcada en la imagen');
  assert.equal(summary(['A','R'],{type:'hangman'}),'Letras elegidas: A, R');
  assert.equal(summary('Una respuesta libre con ñ y tildes.',{type:'short'}),'Una respuesta libre con ñ y tildes.');
  assert.equal(summary(['Primero','Después'],{type:'timeline'}),'Primero → Después');
  assert.equal(summary({answer:'Águila',cluesUsed:2},{type:'mystery'}),'Águila · 2 pistas abiertas');
});
