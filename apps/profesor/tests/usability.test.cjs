const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
function outbox(transport){
 const jobs=new Map(),states=[];let next=0;const context={window:{},setTimeout,clearTimeout};vm.createContext(context);
 vm.runInContext(readFileSync(join(__dirname,'../profesor-live-sync.js'),'utf8'),context);
 const sync=context.window.profesorCreateLiveSync({transport,onStatus:s=>states.push(s.state),schedule:(fn,delay)=>{jobs.set(++next,{fn,delay});return next},cancel:id=>jobs.delete(id)});
 return {sync,states,jobs};
}
test('An offline answer stays pending and navigation waits until the latest answer reaches the server',async()=>{
 let online=false;const sent=[];const {sync,states}=outbox(async move=>{if(!online)throw Error('offline');sent.push(move);return {ok:true}});
 sync.stage(0,'Primera versión');await assert.rejects(sync.flush());assert.equal(sync.status().state,'pending');
 sync.stage(0,'Última versión');await assert.rejects(sync.send({action:'next'}));assert.equal(sent.length,0);
 online=true;await sync.send({action:'next'});assert.equal(sent[0].value,'Última versión');assert.equal(sent[1].action,'next');
 assert.equal(sync.status().pending,0);assert.equal(sync.status().state,'saved');assert.ok(states.includes('saving')&&states.includes('pending'));sync.dispose();
});
test('Editing while a request is in flight cannot acknowledge an older answer as the latest one',async()=>{
 let release;const held=new Promise(resolve=>release=resolve),sent=[];let calls=0;
 const {sync}=outbox(async move=>{sent.push(move.value);if(++calls===1)await held;return {ok:true}});
 sync.stage(2,['A']);const pending=sync.flush();await Promise.resolve();await Promise.resolve();
 sync.stage(2,['A','B']);release();await pending;
 assert.deepEqual(sent.map(value=>Array.from(value)),[['A'],['A','B']]);assert.equal(sync.status().state,'saved');sync.dispose();
});
test('Transient errors retry drafts, while grading is never replayed and access failures stop automatic retries',async()=>{
 const calls=[];let fail=true;const {sync,jobs}=outbox(async move=>{calls.push(move.action);if(fail)throw Object.assign(Error('busy'),{status:503});return {ok:true}});
 await assert.rejects(sync.send({action:'check',question_index:0,value:'x'}));assert.equal(jobs.size,0);assert.deepEqual(calls,['check']);
 sync.stage(0,'x');await assert.rejects(sync.flush());assert.equal(jobs.size,1);assert.ok([...jobs.values()][0].delay>=1500);
 fail=false;await sync.resume();assert.equal(sync.status().state,'saved');sync.dispose();
 const denied=outbox(async()=>{throw Object.assign(Error('expired'),{status:401})});denied.sync.stage(0,'x');await assert.rejects(denied.sync.flush());assert.equal(denied.sync.status().state,'blocked');assert.equal(denied.jobs.size,0);denied.sync.dispose();
});
test('Public and private filters retain their independent searches, courses, types and pages',()=>{
 const context={student:()=>({course:'2.º ESO'})};vm.createContext(context);
 vm.runInContext(html.slice(html.indexOf("let homeStudentQuery=''"),html.indexOf('function materialResultSummary()')),context);
 const run=code=>vm.runInContext(code,context);
 run("materialQuery='gato';materialSubject='Lengua';materialCourse='3.º ESO';materialType='memory';materialPage=2;switchMaterialMode('public');materialQuery='fracciones';materialCourse='1.º ESO';materialPage=4;switchMaterialMode('mine')");
 assert.equal(run('materialQuery'),'gato');assert.equal(run('materialCourse'),'3.º ESO');assert.equal(run('materialType'),'memory');assert.equal(run('materialPage'),2);
 run("switchMaterialMode('public')");assert.equal(run('materialQuery'),'fracciones');assert.equal(run('materialPage'),4);
 assert.equal(run("materialCourseValue({course:'A2'})"),'A2');assert.equal(run("materialCourseValue({studentId:'test'})"),'2.º ESO');
});
test('Editor validation identifies the actual question and field, including board and numeric errors',()=>{
 const source=readFileSync(join(__dirname,'../profesor-generator.js'),'utf8');
 const context={activityLabels:{quiz:'Quiz',numeric:'Número',wordsearch:'Sopa',gaps:'Completar'},optionTypes:['quiz','wordsearch'],sequenceTypes:[],puzzleTypes:['wordsearch'],visualTypes:[],limits:{wordsearch:12},uid:()=> 'question',puzzleRows:()=>{throw Error('Escribe al menos tres palabras')},window:{}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf(' validateActivityQuestions=function('),source.indexOf(' openWorkshop=function(')),context);
 const q={type:'quiz',prompt:'Elige',answer:'C',options:['A','B']};
 assert.throws(()=>context.validateActivityQuestions([q]),error=>error.fieldId==='a-0'&&error.questionIndex===0);
 assert.throws(()=>context.validateActivityQuestions([{...q,answer:'A'},{type:'numeric',prompt:'Calcula',answer:'texto',options:[]}]),error=>error.fieldId==='a-1'&&error.questionIndex===1);
 assert.throws(()=>context.validateActivityQuestions([{type:'wordsearch',prompt:'Busca',answer:'Completado',options:['SOL','MAR']}]),error=>error.fieldId==='o-0');
});
test('Submitting an editor handles the save without native navigation and keeps validation failures in the form',async()=>{
 const handler=html.split('\n').find(line=>line.startsWith("$('form').addEventListener('submit',async e=>"));assert.ok(handler);
 let submit,closed=0,prevented=0,shown=null,fail=false;const button={disabled:false},form={querySelector:()=>button,addEventListener:(type,fn)=>submit=fn},dialog={close:()=>closed++,classList:{contains:()=>false}};
 const context={$:id=>id==='form'?form:id==='dialog'?dialog:null,clearFormErrors:()=>{},showFormError:err=>shown=err.message,modalHandler:async()=>{if(fail)throw Error('Corrige la solución');return true},FormData:class{}};
 vm.createContext(context);vm.runInContext(handler,context);
 const event={target:form,preventDefault:()=>prevented++};await submit(event);assert.equal(closed,1);assert.equal(prevented,1);assert.equal(button.disabled,false);
 fail=true;await submit(event);assert.equal(closed,1);assert.equal(prevented,2);assert.equal(shown,'Corrige la solución');assert.equal(button.disabled,false);
});
test('An invalid successful HTTP response never reports an answer as saved',async()=>{
 const source=readFileSync(join(__dirname,'../profesor-live.js'),'utf8');let payload=null;
 const context={window:{},fetch:async()=>({status:200,ok:true,json:async()=>payload})};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('  async function request('),source.indexOf('  const path=id=>')),context);
 await assert.rejects(context.request('/test/move',{action:'draft'}),error=>error.status===502);
 payload={ok:true};await assert.rejects(context.request('/test/move',{action:'draft'}),error=>error.status===502);
 payload={ok:true,revision:2,status:'in_progress'};assert.equal((await context.request('/test/move',{action:'draft'})).revision,2);
});
