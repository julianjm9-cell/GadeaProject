const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('apps/e25/index.html','utf8');
// Exercise existing session logic used by the new home, including resume safety.
function harness(){
 const ctx=vm.createContext({state:{done:{},sessionDuration:null},MODULES:[{id:'lengua',tasks:[{id:'reading',title:'Lectura'}]}],todayKey:()=> '2026-09-27',renderStudyCockpit(){},renderTeacherPanel(){},saveState(){},crypto:{randomUUID:()=> 'new-session'}});
 for(const name of ['recommendedStudyModule','buildSessionSteps','setSessionDuration']){
  const start=source.indexOf('function '+name+'('); const end=source.indexOf('\nfunction ',start+1);
  vm.runInContext(source.slice(start,end),ctx);
 }
 return ctx;
}
test('15, 30 and 45 minutes create one, two and three study steps',()=>{
 for(const [duration,count] of [[15,1],[30,2],[45,3]]){const c=harness();c.setSessionDuration(duration);assert.equal(c.state.activeSession.duration,duration);assert.equal(c.state.activeSession.steps.length,count);assert.equal(c.state.activeSession.steps[0].topic,'reading');if(duration===45)assert.equal(c.state.activeSession.steps[2].module,'exam');}
});
test('starting the same daily session preserves completed steps and identity',()=>{
 const c=harness();c.setSessionDuration(30);const session=c.state.activeSession;session.completedStepKeys.push('study:reading');c.setSessionDuration(30);assert.equal(c.state.activeSession,session);assert.deepEqual(Array.from(session.completedStepKeys),['study:reading']);
});
test('a new day creates a new plan without erasing academic completion',()=>{
 const c=harness();c.setSessionDuration(30);c.state.activeSession.day='2026-09-26';c.state.done.reading=true;const old=c.state.activeSession;c.setSessionDuration(30);assert.notEqual(c.state.activeSession,old);assert.equal(c.state.done.reading,true);assert.equal(c.state.activeSession.completedStepKeys.length,0);
});
test('the application inline scripts remain valid JavaScript',()=>{
 for(const match of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(match[1].trim())new vm.Script(match[1]);}
});
