const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
const start=html.indexOf("const backgroundPreferenceKey=");
const source=html.slice(start,html.indexOf('\nconst student=',start));
function appearance(saved={},blocked=false){
  const values=new Map(Object.entries(saved)),classes=new Set(),attributes={};
  const button={textContent:'',setAttribute:(key,value)=>attributes[key]=value};
  const context={localStorage:{getItem:key=>{if(blocked)throw Error('Storage unavailable');return values.get(key)??null;},setItem:(key,value)=>{if(blocked)throw Error('Storage unavailable');values.set(key,value);}},document:{documentElement:{classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}},querySelectorAll:()=>[button]}};
  vm.createContext(context);vm.runInContext(source,context);
  return {classes,values,button,attributes,cycle:()=>context.cycleTeacherBackground(),markup:()=>context.teacherBackgroundButton()};
}
test('One control cycles existing, academy and plain appearance, then restores the original',()=>{
  const ui=appearance();
  assert.equal(ui.button.textContent,'◈ Fondo 1');
  assert.deepEqual([...ui.classes],['teacher-study-theme']);
  assert.match(ui.markup(),/Cambiar a Fondo 2/);
  ui.cycle();assert.equal(ui.button.textContent,'◈ Fondo 2');assert.deepEqual([...ui.classes],['teacher-academy-theme']);
  assert.equal(ui.values.get('profesor-background-mode'),'academy');
  assert.deepEqual([...appearance(Object.fromEntries(ui.values)).classes],['teacher-academy-theme']);
  ui.cycle();assert.equal(ui.button.textContent,'◈ Sin fondo');assert.deepEqual([...ui.classes],['teacher-plain-background']);
  ui.cycle();assert.equal(ui.button.textContent,'◈ Fondo 1');assert.deepEqual([...ui.classes],['teacher-study-theme']);
  assert.equal(ui.values.size,1,'appearance must not touch teacher account or material data');
});
test('Existing hidden background is preserved; an explicit three-mode choice takes priority',()=>{
  assert.deepEqual([...appearance({'profesor-hide-background':'true'}).classes],['teacher-plain-background']);
  assert.deepEqual([...appearance({'profesor-hide-background':'false'}).classes],['teacher-study-theme']);
  assert.deepEqual([...appearance({'profesor-hide-background':'true','profesor-background-mode':'academy'}).classes],['teacher-academy-theme']);
  assert.deepEqual([...appearance({'profesor-background-mode':'study','profesor-hide-background':'true'}).classes],['teacher-study-theme']);
  assert.deepEqual([...appearance({'profesor-background-mode':'invalid','profesor-hide-background':'true'}).classes],['teacher-plain-background']);
});
test('Unavailable browser storage does not prevent using the three appearances',()=>{
  const ui=appearance({},true);ui.cycle();assert.equal(ui.button.textContent,'◈ Fondo 2');
  ui.cycle();assert.equal(ui.button.textContent,'◈ Sin fondo');ui.cycle();assert.deepEqual([...ui.classes],['teacher-study-theme']);
});
