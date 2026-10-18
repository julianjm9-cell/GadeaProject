// Exercise the actual markup functions with public session payloads from the backend.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const labels=html.split('\n').find(line=>line.startsWith('const activityLabels='));
const types=html.split('\n').filter(line=>/^const (visualTypes|puzzleTypes|openAnswerTypes|sequenceTypes)=/.test(line));
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const personal=fs.readFileSync(path.join(root,'profesor-activity-play.js'),'utf8');
const local={window:{},esc:escape,materialTone:()=> 'blue'};vm.createContext(local);
vm.runInContext(labels+'\n'+types.join('\n')+'\n'+personal.slice(personal.indexOf('  const shuffle'),personal.indexOf('  function recordAnswer'))+personal.slice(personal.indexOf('  function flashcardFace('),personal.indexOf('  function mountHangman(')),local);
const live=fs.readFileSync(path.join(root,'profesor-live.js'),'utf8'),shared={window:{},document:{getElementById:()=>null}};vm.createContext(shared);
vm.runInContext(live.slice(live.indexOf('  const escape'),live.indexOf('  function mountSentence(')),shared);
for(let i=0;i<input.length;i++){
 const {source,public:question}=input[i],session={id:'render-qa',status:'in_progress',questions:[question],progress:{responses:{},grades:{},parts:{}}};
 const own=local.questionMarkup(source,i,['4','8']);assert.ok(own.includes('data-type="'+source.type+'"'),source.type);
 for(const teacher of [false,true]){const markup=shared.questionMarkup(session,0,teacher);assert.ok(markup.includes('data-live-type="'+source.type+'"'),source.type);assert.ok(!markup.includes('undefined'),source.type)}
}
process.stdout.write(JSON.stringify({rendered:input.length,modes:3}));
