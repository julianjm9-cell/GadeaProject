const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../../../marketing/app_landings_demo/profesor-anuncios.html'),'utf8');
function renderer(extra={}){
 const context=vm.createContext({...extra});
 const lines=html.split('\n').filter(line=>/^function (esc|uiIcon|choiceValues|syncChoices)\(/.test(line)).join('\n');
 vm.runInContext(lines+'\n'+html.slice(html.indexOf('function teachingGroup('),html.indexOf('function readForm(')),context);
 return code=>vm.runInContext(code,context);
}

test('Existing and new advertisements render subjects and courses as separate labeled groups',()=>{
 const run=renderer();
 for(const ad of [{subject:'Lengua, Inglés',course:'Infantil, 1.º Primaria'},{subjects:'Lengua; Inglés',levels:'Infantil; 1.º Primaria'}]){
  const before=JSON.stringify(ad),markup=run(`card(${before},false)`);
  const subjects=markup.match(/class="ad-teaching-group subjects">([\s\S]*?)<\/div><\/div>/)[1];
  const courses=markup.match(/class="ad-teaching-group courses">([\s\S]*?)<\/div><\/div>/)[1];
  assert.match(subjects,/>Asignaturas</);assert.match(subjects,/>Lengua</);assert.doesNotMatch(subjects,/Primaria|Infantil/);
  assert.match(courses,/>Cursos</);assert.match(courses,/>Infantil</);assert.doesNotMatch(courses,/Lengua|Inglés/);
  assert.equal(JSON.stringify(ad),before);
 }
 assert.match(run(`teachingGroup('Arte <b> & Música','subjects')`),/Arte &lt;b&gt; &amp; Música/);
});

test('The form keeps the selected subjects and courses separate in both payload and preview chips',()=>{
 const nodes={course:{},subject:{},courseSummary:{},subjectSummary:{},courseChosen:{},subjectChosen:{},coursePicker:{classList:{toggle(){}}},subjectPicker:{classList:{toggle(){}}}};
 const chosen={course:[{value:'1.º ESO'},{value:'2.º ESO'}],subject:[{value:'Matemáticas'},{value:'Física y Química'}]};
 const run=renderer({$:id=>nodes[id],document:{querySelectorAll:selector=>chosen[selector.includes('"course"')?'course':'subject']},preview(){}});
 run(`syncChoices('course');syncChoices('subject')`);
 assert.equal(nodes.course.value,'1.º ESO, 2.º ESO');assert.equal(nodes.subject.value,'Matemáticas, Física y Química');
 assert.equal(nodes.courseSummary.textContent,'2 cursos seleccionados');assert.equal(nodes.subjectSummary.textContent,'2 asignaturas seleccionadas');
 assert.doesNotMatch(nodes.courseChosen.innerHTML,/Matemáticas/);assert.doesNotMatch(nodes.subjectChosen.innerHTML,/ESO/);
});
