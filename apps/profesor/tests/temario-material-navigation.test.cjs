const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const code=readFileSync(join(__dirname,'../profesor-temario.js'),'utf8');
const start=code.indexOf('function temarioUseInMaterial(topic) {');
const fn=code.slice(start,code.indexOf("\ndocument.addEventListener('click'",start));
function screen(open){
  const listeners=[],timers=[],events=[],created=[];
  const dialog={open,addEventListener(name,callback){listeners.push(callback);},close(){this.open=false;events.push('close requested');}};
  const context={temarioCourse:'B2',temarioSubject:'Español',selected:'old-pupil',view:'Temario',materialLibraryMode:'public',$:()=>dialog,setTimeout:callback=>timers.push(callback),render:()=>events.push('render'),openWorkshop:prefill=>{events.push('creator');created.push(JSON.parse(JSON.stringify(prefill)));}};
  vm.createContext(context);vm.runInContext(fn,context);
  return {context,events,created,timers,closeEvent(){events.push('old dialog cleaned');listeners.forEach(callback=>callback());}};
}
test('Opening the creator waits for lesson teardown and preserves the original topic filters',()=>{
  const ui=screen(true);
  ui.context.temarioUseInMaterial({title:'Contrastar indicativo y subjuntivo'});
  assert.deepEqual(ui.events,['close requested']);
  assert.equal(ui.timers.length,0,'a timer alone must not race against the close event');
  ui.context.temarioCourse='3.º ESO';
  ui.closeEvent();ui.timers.forEach(callback=>callback());
  assert.deepEqual(ui.events,['close requested','old dialog cleaned','render','creator']);
  assert.deepEqual(ui.created,[{studentId:'',course:'B2',subject:'Español',topic:'Contrastar indicativo y subjuntivo',theme:''}]);
  assert.equal(ui.context.view,'Biblioteca');assert.equal(ui.context.materialLibraryMode,'mine');assert.equal(ui.context.selected,null);
});
test('Creation from the topic sidebar opens directly without an intermediate modal',()=>{
  const ui=screen(false);
  ui.context.temarioUseInMaterial({title:'Hipótesis y condiciones'});
  assert.deepEqual(ui.events,['render','creator']);
  assert.equal(ui.created[0].topic,'Hipótesis y condiciones');
});
