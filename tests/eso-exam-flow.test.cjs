const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('apps/e25/index.html','utf8');
function setup(){
 const nodes={};for(const id of ['viewer','examPrompt','studentAnswer','examOcrText','examOcrStatus','examOcrRead','examOcrTarget','examOcrFile','examCorrectButton','examDraftStatus','correctionOutput','examDraftForm'])nodes[id]={value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,dataset:{},classList:{toggle(){}},focus(){this.focused=true}};
 const state={activeModule:'exam',activeTab:'correccion',currentExam:'Pregunta de prueba',currentExamScope:null,currentExamTopics:[],attempts:[],done:{},examDraft:{id:'draft-1',answer:'Respuesta escrita'}};
 nodes.examPrompt.value=state.currentExam;nodes.studentAnswer.value=state.examDraft.answer;nodes.examDraftForm.dataset.draft='draft-1';nodes.examOcrTarget.value='answer';
 const requests=[],saves=[];
 const ctx={state,nodes,officialRubricHtml:()=>'',examTopicsHtml:()=>'', $:id=>nodes[id],OFFICIAL_SIMULATORS:{},escapeHtml:value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),formatStudyText:value=>value,saveState:async()=>{saves.push(JSON.stringify(state));return true},setTimeout,clearTimeout,backend:async(path,options)=>{requests.push([path,JSON.parse(options.body)]);return path==='/api/ocr'?{text:'Texto de la foto'}:{content:'Corrección orientativa'}},recordStudyActivity(){},markStudySessionStep(){},renderShell(){},renderStudyCockpit(){},grantGamificationReward(){}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('let examOcrUpload='),source.indexOf('\nasync function logout()',source.indexOf('let examOcrUpload='))),ctx);
 return {ctx,state,nodes,requests,saves,run:code=>vm.runInContext(code,ctx)};
}
test('The exam entry offers only four destinations, without a simulator form or redundant tabs',()=>{
 const h=setup();h.run('renderExamHome()');const html=h.nodes.viewer.innerHTML;
 assert.equal((html.match(/<button /g)||[]).length,4);for(const label of ['Practicar','Simulacro','Corregir examen','Historial'])assert.ok(html.includes(label));assert.doesNotMatch(html,/exam-wizard|textarea|select/);
});
test('Typed answers and prompts survive repaint and become reopenable history snapshots',async()=>{
 const h=setup();h.nodes.studentAnswer.value='Respuesta más completa';h.nodes.examPrompt.value='Pregunta editada';
 await h.run('saveOnlyAttempt()');assert.equal(h.state.examDraft.answer,'Respuesta más completa');assert.equal(h.state.currentExam,'Pregunta editada');assert.equal(h.state.attempts[0].exam.answer,'Respuesta más completa');
 await h.run('saveOnlyAttempt()');assert.equal(h.state.attempts.length,1);
 h.run('renderExamCorrection()');assert.match(h.nodes.viewer.innerHTML,/Respuesta más completa/);assert.match(h.nodes.viewer.innerHTML,/Pregunta editada/);
});
test('Photo validation rejects unsupported, empty and oversized files before requesting OCR',()=>{
 const h=setup();for(const file of [null,{type:'application/pdf',size:12},{type:'image/heic',size:12},{type:'image/png',size:0},{type:'image/jpeg',size:8*1024*1024+1}])assert.throws(()=>h.ctx.validExamImage(file));assert.doesNotThrow(()=>h.ctx.validExamImage({type:'image/webp',size:2048}));assert.equal(h.requests.length,0);
});
test('OCR captures the selected destination, supports review and does not overwrite typed text',async()=>{
 const h=setup();h.nodes.examOcrTarget.value='prompt';h.run(`examOcrUpload={data:'data:image/png;base64,aA==',name:'foto.png',mime:'image/png'};renderExamCorrection=()=>{nodes.examPrompt.value=state.currentExam;nodes.studentAnswer.value=examDraft().answer;nodes.examOcrText.value=examDraft().ocrText}`);
 await h.run('runExamOcr()');assert.equal(h.requests[0][1].target,'prompt');assert.equal(h.state.examDraft.ocrTarget,'prompt');assert.equal(h.state.examDraft.ocrText,'Texto de la foto');assert.equal(h.nodes.studentAnswer.value,'Respuesta escrita');
 h.nodes.examOcrText.value='Texto revisado';h.nodes.examOcrTarget.value='answer';h.run('insertExamOcrText()');assert.equal(h.state.currentExam,'Pregunta de prueba\n\nTexto revisado');assert.equal(h.state.examDraft.answer,'Respuesta escrita');
});
test('Missing image errors are visible and a failed OCR request can retry without losing the draft',async()=>{
 const h=setup();await h.run('runExamOcr()');assert.match(h.nodes.examOcrStatus.textContent,/Selecciona primero/);
 h.run(`examOcrUpload={data:'image',name:'foto.png',mime:'image/png'};renderExamCorrection=()=>{nodes.examPrompt.value=state.currentExam;nodes.studentAnswer.value=examDraft().answer;nodes.examOcrText.value=examDraft().ocrText}`);h.ctx.backend=async()=>{throw Error('Servicio ocupado')};await h.run('runExamOcr()');assert.match(h.nodes.examOcrStatus.textContent,/volver a pulsar Leer foto/);assert.equal(h.nodes.examOcrRead.disabled,false);assert.equal(h.state.examDraft.answer,'Respuesta escrita');
 h.ctx.backend=async()=>({text:'Lectura reintentada'});await h.run('runExamOcr()');assert.equal(h.state.examDraft.ocrText,'Lectura reintentada');
});
test('OCR prevents duplicate requests and never repaints another section when it finishes',async()=>{
 const h=setup();let finish;h.ctx.backend=()=>new Promise(resolve=>{finish=resolve});h.run(`examOcrUpload={data:'image',name:'foto.png',mime:'image/png'};renderExamCorrection=()=>{throw Error('Unexpected repaint')}`);
 const pending=h.run('runExamOcr()');await h.run('runExamOcr()');h.state.activeModule='lengua';finish({text:'Texto conservado'});await pending;assert.equal(h.state.examDraft.ocrText,'Texto conservado');
});
test('Correction requires both fields and reviewed OCR; provider failures retain retryable inputs',async()=>{
 const h=setup();h.nodes.studentAnswer.value='';await h.run('correctExamAi()');assert.equal(h.requests.length,0);assert.equal(h.nodes.studentAnswer.focused,true);
 h.nodes.studentAnswer.value='Respuesta escrita';h.nodes.examOcrText.value='Pendiente de revisar';await h.run('correctExamAi()');assert.equal(h.requests.length,0);assert.match(h.nodes.correctionOutput.textContent,/insértalo/);
 h.nodes.examOcrText.value='';h.ctx.backend=async()=>{throw Error('Demasiada carga')};await h.run('correctExamAi()');assert.match(h.nodes.correctionOutput.textContent,/reintentar/);assert.equal(h.nodes.examCorrectButton.disabled,false);assert.equal(h.state.examDraft.answer,'Respuesta escrita');assert.equal(h.state.attempts.length,0);
});
test('A correction is submitted once and stored with its actual questions and answer',async()=>{
 const h=setup();let finish,count=0;h.ctx.backend=()=>{count++;return new Promise(resolve=>{finish=resolve})};const pending=h.run('correctExamAi()');await h.run('correctExamAi()');assert.equal(count,1);finish({content:'Muy bien: revisa las unidades.'});await pending;
 assert.equal(h.state.attempts.length,1);assert.equal(h.state.attempts[0].exam.prompt,'Pregunta de prueba');assert.equal(h.state.attempts[0].exam.answer,'Respuesta escrita');assert.equal(h.state.attempts[0].exam.correction,'Muy bien: revisa las unidades.');
});
test('Editing an answer while correction is running preserves the new draft and archives the submitted version',async()=>{
 const h=setup();let finish;h.ctx.backend=()=>new Promise(resolve=>{finish=resolve});const pending=h.run('correctExamAi()');h.nodes.studentAnswer.value='Nueva respuesta';h.run('captureExamDraft()');finish({content:'Resultado de la versión enviada'});await pending;
 assert.equal(h.state.examDraft.answer,'Nueva respuesta');assert.equal(h.state.examDraft.correction,'');assert.equal(h.state.attempts[0].exam.answer,'Respuesta escrita');assert.match(h.nodes.correctionOutput.textContent,/versión enviada/);
});
test('Editing a corrected exam preserves the previous result in history and hides the stale correction',async()=>{
 const h=setup();await h.run('correctExamAi()');const originalId=h.state.attempts[0].id;
 h.nodes.studentAnswer.value='Respuesta revisada después';await h.run('saveOnlyAttempt()');
 assert.equal(h.state.attempts.length,2);assert.equal(h.state.attempts.find(item=>item.id===originalId).exam.correction,'Corrección orientativa');
 assert.equal(h.nodes.correctionOutput.hidden,true);assert.equal(h.state.attempts[0].exam.answer,'Respuesta revisada después');
});
test('State is never saved before loading and successive snapshots are sent in order',async()=>{
 let release;const sent=[];
 const c=vm.createContext({esoStateReady:false,state:{currentExam:'Primero'},backend:async(_path,options)=>{sent.push(JSON.parse(options.body));if(sent.length===1)await new Promise(resolve=>{release=resolve})}});
 vm.runInContext(source.slice(source.indexOf('let esoStateSaveQueue'),source.indexOf('\nasync function loadGamification',source.indexOf('let esoStateSaveQueue'))),c);
 assert.equal(await vm.runInContext('saveState()',c),false);assert.equal(sent.length,0);
 c.esoStateReady=true;const first=vm.runInContext('saveState()',c);await Promise.resolve();await Promise.resolve();
 c.state.currentExam='Segundo';const second=vm.runInContext('saveState()',c);assert.equal(sent.length,1);release();await first;await second;
 assert.deepEqual(sent.map(item=>item.currentExam),['Primero','Segundo']);
});
test('An AI exam finishing in the background is saved in history without replacing the active draft or page',async()=>{
 const h=setup();h.state.activeTab='simulacro';let finish;
 Object.assign(h.ctx,{updateExamSetup(){},nextStudyItem:()=>null,selectExamTopics:()=>[],examTopicsText:()=>'',backend:()=>new Promise(resolve=>{finish=resolve})});
 const start=source.indexOf('async function createAiExam()');vm.runInContext(source.slice(start,source.indexOf('\nlet examOcrUpload=',start)),h.ctx);
 const request=h.run('createAiExam()');h.state.activeModule='lengua';finish({content:'Enunciado generado'});await request;
 assert.equal(h.state.currentExam,'Pregunta de prueba');assert.equal(h.state.examDraft.answer,'Respuesta escrita');assert.equal(h.state.activeModule,'lengua');assert.match(h.state.attempts[0].exam.prompt,/Enunciado generado/);
});
