const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
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
  vm.runInContext(labels+"\nlet materialPublicFormat='combined';\n"+functions,context);
  return {run:code=>vm.runInContext(code,context),context};
}
test('All public questions remain available separately with stable identities and their original context',()=>{
  const {run}=library();
  const before=run('JSON.stringify(publicTemarioMaterials())');
  assert.equal(run('publicLibraryMaterials().length'),351);
  assert.equal(run("materialPublicFormat='single';publicLibraryMaterials().length"),2106);
  assert.equal(run('new Set(publicSingleMaterials().map(m=>m.id)).size'),2106);
  assert.equal(run('publicSingleMaterials().every(m=>m.activity.questions.length===1&&m.activity.context.course&&m.subject&&m.activity.context.topic&&publicMaterial(m.id)===m)'),true);
  const original=JSON.parse(before).flatMap(m=>m.activity.questions.map(q=>q.id)).sort();
  const singles=JSON.parse(run('JSON.stringify(publicSingleMaterials().flatMap(m=>m.activity.questions.map(q=>q.id)))')).sort();
  assert.deepEqual(singles,original);
  assert.equal(run('JSON.stringify(publicTemarioMaterials())'),before);
  assert.equal(run("materialPublicFormat='combined';publicLibraryMaterials().length"),351);
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
