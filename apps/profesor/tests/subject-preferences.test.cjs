const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function preferences(profile={}){const ctx={window:{PROFESOR_TEMARIO:{}},state:{teacherProfile:profile},studentSubjectCourse:(pupil,subject)=>subject==='Español'?(pupil?.spanishLevel||'A1'):(pupil?.course||''),materialCourseValue:material=>material.activity?.context?.course||material.course||''};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'profesor-subjects.js'),'utf8'),ctx);return {ctx,run:code=>vm.runInContext(code,ctx),api:ctx.window.profesorSubjects};}

test('Existing accounts keep all subjects until they save a personal selection',()=>{
 const {api}=preferences();for(const profile of [{},{subjects:[]},{subjects:null}])assert.equal(api.allows(profile,'Matemáticas'),true);
 assert.deepEqual(Array.from(api.selected({subjects:[' Inglés ','inglés','Matemáticas']})),['Inglés','Matemáticas']);
});
test('Subject matching accepts accents and custom names without changing the original materials',()=>{
 const {ctx,run}=preferences({subjects:['Inglés','Tecnología']});
 ctx.materials=[{id:'1',subject:'INGLES'},{id:'2',subject:'Matemáticas'},{id:'3',activity:{context:{subject:'Tecnología'}}},{id:'4',subject:''}];
 const before=JSON.stringify(ctx.materials);assert.deepEqual(Array.from(run('materials.filter(teacherMaterialVisible).map(item=>item.id)')),['1','3','4']);assert.equal(JSON.stringify(ctx.materials),before);
 assert.equal(run("teacherAllowsSubject('Ciencias Naturales')"),false);
});
test('Courses and subjects must both match; unclassified private materials stay accessible',()=>{
 const {ctx,run,api}=preferences({subjects:['Matemáticas','Español'],courses:['2.º Primaria','B1']});
 assert.equal(api.allowsCourse({courses:[]},'1.º ESO'),true);
 assert.equal(api.allowsCourse(ctx.state.teacherProfile,'2.º Primaria'),true);
 assert.equal(api.allowsCourse(ctx.state.teacherProfile,'1.º Primaria'),false);
 assert.equal(api.allowsCourse({courses:['3.º ESO']},'3º ESO'),true);
 assert.deepEqual(Array.from(api.uniqueCourses(['3.º ESO','3º ESO','B1'])),['3.º ESO','B1']);
 const materials=[
  {id:'right',subject:'Matemáticas',activity:{context:{course:'2.º Primaria'}}},
  {id:'wrong-course',subject:'Matemáticas',activity:{context:{course:'1.º Primaria'}}},
  {id:'wrong-subject',subject:'Lengua',activity:{context:{course:'2.º Primaria'}}},
  {id:'spanish',subject:'Español',activity:{context:{course:'B1'}}},
  {id:'spanish-other-level',subject:'Español',activity:{context:{course:'A1'}}},
  {id:'general',subject:'Matemáticas'},
 ];
 ctx.materials=materials;
 assert.deepEqual(Array.from(run('materials.filter(teacherMaterialVisible).map(item=>item.id)')),['right','spanish','general']);
 ctx.pupil={course:'1.º Primaria',spanishLevel:'B1',subjects:['Matemáticas','Español']};
 assert.deepEqual(Array.from(run('teacherStudentSubjects(pupil)')),['Español']);
 assert.equal(run('teacherStudentVisible(pupil)'),true);
 ctx.state.teacherProfile.courses=['2.º Primaria'];
 assert.equal(run('teacherStudentVisible(pupil)'),false);
});
test('Private, public and syllabus sources respect preferences while preserving their cached catalogue',()=>{
 const {ctx,run}=preferences({subjects:['Inglés']});
 ctx.state.library=[{id:'private-math',subject:'Matemáticas'},{id:'private-en',subject:'Inglés'}];
 ctx.publicLibraryMaterials=()=>[{id:'public-en',subject:'Inglés'},{id:'public-math',subject:'Matemáticas'}];
 ctx.temarioLibraryMaterials=()=>[{id:'topic-en',subject:'Inglés'},{id:'topic-math',subject:'Matemáticas'}];
 const source=fs.readFileSync(path.join(root,'index.html'),'utf8').split('\n').filter(line=>/^function materialLibrary(?:Raw)?Source\(\)/.test(line)).join('\n');
 vm.runInContext(source,ctx);
 for(const mode of ['mine','public','temario']){ctx.materialLibraryMode=mode;const rows=run('materialLibrarySource()');assert.equal(rows.length,1);assert.equal(rows[0].subject,'Inglés');}
 assert.equal(ctx.state.library.length,2);
 ctx.state.teacherProfile.subjects=['Matemáticas'];assert.equal(run("materialLibrarySource()[0].id"),'topic-math');
});
test('A preference change clears only stale view filters, without removing pupil subjects',()=>{
 const {ctx,run}=preferences({subjects:['Inglés']});
 Object.assign(ctx,{materialSubject:'Matemáticas',materialPage:3,materialFilterViews:{mine:{subject:'Matemáticas',page:2},public:{subject:'Inglés',page:4}},subject:'Matemáticas',selected:'p1',student:()=>({course:'3.º ESO',subjects:['Inglés','Matemáticas']}),temarioCourse:'3.º ESO',temarioSubject:'Matemáticas',temarioSelected:'topic-old'});
 run('teacherResetSubjectFilters()');assert.equal(ctx.materialSubject,'');assert.equal(ctx.materialPage,0);assert.equal(ctx.subject,'Inglés');assert.equal(ctx.materialFilterViews.mine.subject,'');assert.equal(ctx.materialFilterViews.public.subject,'Inglés');assert.equal(ctx.temarioSelected,'');
});

test('Custom subject names remain literal text in pupil creation',()=>{
 const {ctx,run}=preferences({subjects:['Arte " & <taller>']});
 ctx.canAddStudent=()=>true;ctx.subjects=[];ctx.state.students=[];
 ctx.esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 ctx.offeredCourseChoices=ctx.offeredSpanishLevelField=ctx.submit=()=>'';
 let markup='';ctx.modal=(_title,html)=>{markup=html};ctx.document={querySelector:()=>({hidden:false})};
 const source=fs.readFileSync(path.join(root,'index.html'),'utf8').split('\n');
 vm.runInContext(source.filter(line=>/^function (newStudent|materialSubjects)\(/.test(line)).join('\n'),ctx);
 run('newStudent()');assert.ok(markup.includes('value="Arte &quot; &amp; &lt;taller&gt;"'));assert.ok(!markup.includes('<taller>'));
});
