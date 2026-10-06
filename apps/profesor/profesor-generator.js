/* Activity size, teacher instructions and complete game previews. */
(() => {
 const bundleTypes=new Set(['pairs','gaps','quiz','short','classify','boolean','reading','problem','flashcard','error','numeric','hangman']);
 const limits={multigaps:20,pasapalabra:27,crossword:7,wordsearch:8,memory:8,dragdrop:8,order:8,sentence:8,timeline:8};
 const defaults={pasapalabra:18,multigaps:10,reading:4,problem:3,hangman:3};
 const elementLabel=type=>type==='pasapalabra'?'Letras por rosco':type==='multigaps'?'Huecos por texto':['memory','dragdrop'].includes(type)?'Parejas por tablero':['wordsearch','crossword'].includes(type)?'Palabras por juego':sequenceTypes.includes(type)?'Elementos por secuencia':type==='flashcard'?'Tarjetas por actividad':'Preguntas por actividad';
 const originalMarkup=workshopMarkup;
 workshopMarkup=function(owner,draft,st){
  return originalMarkup(owner,draft,st).replace('<div class="catalog-board">',`<section class="generator-brief"><label for="workshopInstructions">Describe el material que necesitas</label><textarea id="workshopInstructions" name="instructions" maxlength="3000" rows="2" placeholder="Por ejemplo: un relato con huecos para practicar imperfecto y pretérito perfecto simple, con vocabulario A2.">${esc(draft.instructions||'')}</textarea><div id="generatorSizes" class="generator-sizes" aria-label="Contenido de cada actividad"></div></section><div class="catalog-board">`);
 };
 const originalSetup=setupWorkshop;
 setupWorkshop=function(owner,draft,st){
  originalSetup(owner,draft,st);
  const form=$('form'),controller=new AbortController();
  const sizes={...(draft.activitySizes||{})};
  function refreshSizes(){
   const selected=Object.keys(activityLabels).filter(type=>Number($('count-'+type).value)>0&&!visualTypes.includes(type));
   const root=$('generatorSizes');
   if(root.dataset.selection!==selected.join('|')){
    root.dataset.selection=selected.join('|');
    root.innerHTML=selected.map(type=>`<label>${esc(activityLabels[type])}<span>${elementLabel(type)}</span><input name="size-${type}" id="size-${type}" type="number" min="${type==='pasapalabra'||['crossword','wordsearch','dragdrop'].includes(type)?3:2}" max="${limits[type]||12}" value="${sizes[type]||defaults[type]||6}"></label>`).join('');
    root.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{sizes[input.id.slice(5)]=Number(input.value);refreshSizes()},{signal:controller.signal}));
   }
   let activities=0,questions=0,photos=0;
   for(const type of Object.keys(activityLabels)){const n=Number($('count-'+type).value)||0;activities+=n;if(visualTypes.includes(type))photos+=n;questions+=n*(bundleTypes.has(type)?Number($('size-'+type)?.value||defaults[type]||6):1)}
   $('workshopSelection').textContent=`${activities} de ${MAX_GENERATOR_ACTIVITIES} actividades · ${questions} preguntas o tableros${questions>80?' · Máximo 80':''}`;
   const invalid=workshopBusy||activities<1||activities>MAX_GENERATOR_ACTIVITIES||questions>80;
   $('workshopSelection').classList.toggle('error',activities>MAX_GENERATOR_ACTIVITIES||questions>80);
   $('workshopManual').disabled=invalid;$('workshopContinue').disabled=invalid||photos===activities;
  }
  form.addEventListener('click',()=>setTimeout(()=>{if($('dialog').open&&$('generatorSizes'))refreshSizes()},0),{signal:controller.signal,capture:true});
  form.addEventListener('change',()=>queueMicrotask(refreshSizes),{signal:controller.signal});
  form.addEventListener('workshop:refresh',refreshSizes,{signal:controller.signal});
  $('dialog').addEventListener('close',()=>controller.abort(),{once:true});refreshSizes();
 };
 // Larger texts use the same contract in the editor, player and PDF export.
 const oldPuzzleRows=puzzleRows;
 puzzleRows=function(type,options){if(type!=='multigaps')return oldPuzzleRows(type,options);const rows=options.map(v=>String(v).trim()).filter(Boolean);if(rows.length<2||rows.length>20||rows.some(v=>v.length>100))throw Error('Texto con huecos: escribe entre 2 y 20 soluciones en el orden de los huecos.');return rows;};
 validateActivityQuestions=function(questions,requireImages=true){
  if(!Array.isArray(questions)||!questions.length||questions.length>80)throw Error('El material debe tener entre 1 y 80 preguntas.');
  const clean=questions.map((source,index)=>{
   const q=JSON.parse(JSON.stringify(source)),number=index+1;
   if(!Object.hasOwn(activityLabels,q.type)||typeof q.prompt!=='string'||typeof q.answer!=='string')throw Error('Formato de ejercicio no válido.');
   q.prompt=q.prompt.trim();q.answer=q.answer.trim();q.text=q.text||'';
   if(!q.prompt||q.prompt.length>(q.type==='multigaps'?12000:1500)||q.answer.length>2500||typeof q.text!=='string'||q.text.length>12000||!q.answer&&!sequenceTypes.includes(q.type)&&q.type!=='memory'&&!puzzleTypes.includes(q.type)&&q.type!=='imagepoint')throw Error(`Completa el enunciado y la solución del ejercicio ${number}.`);
   const gaps=(q.prompt.match(/___/g)||[]).length;
   if(q.type==='gaps'&&gaps!==1)throw Error(`El ejercicio ${number} debe tener exactamente un hueco ___.`);
   if(q.type==='multigaps'&&(gaps<2||gaps>20))throw Error('El texto debe tener entre 2 y 20 huecos ___.');
   q.options=optionTypes.includes(q.type)?q.options:[];
   if(!Array.isArray(q.options)||q.options.some(v=>typeof v!=='string'))throw Error('Opciones no válidas.');
   q.options=q.options.map(v=>v.trim()).filter(Boolean);
   if(optionTypes.includes(q.type)){
    const max=limits[q.type]||5;
    if(q.options.length<2||q.options.length>max||q.options.some(v=>v.length>300)||q.type!=='multigaps'&&new Set(q.options.map(v=>v.toLocaleLowerCase())).size!==q.options.length)throw Error(`Revisa las opciones del ejercicio ${number}.`);
    if(sequenceTypes.includes(q.type))q.answer=q.options.join(' → ');
    else if(q.type==='memory'){validateMemory(q.options);q.answer='Completado';}
    else if(puzzleTypes.includes(q.type)){puzzleRows(q.type,q.options);q.answer=q.type==='multigaps'?q.options.join(' | '):'Completado';}
    else if(!q.options.includes(q.answer))throw Error(`La solución del ejercicio ${number} debe coincidir con una opción.`);
   }
   if(q.type==='multigaps'&&gaps!==q.options.length)throw Error('Añade una solución por cada hueco.');
   if(q.type==='boolean'&&(q.options.length!==2||!q.options.includes('Verdadero')||!q.options.includes('Falso')))throw Error('Verdadero / Falso requiere esas dos opciones.');
   if(q.type==='reading'&&!q.text.trim())throw Error('Añade el texto de lectura.');
   if(q.type==='numeric'&&(!q.answer.trim()||!Number.isFinite(Number(q.answer.replace(',','.')))))throw Error('La solución numérica debe ser un número.');
   if(q.type==='hangman'&&!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{1,39}$/.test(q.answer))throw Error('Ahorcado: usa una palabra o expresión de 2 a 40 caracteres.');
   for(const [key,limit] of [['explanation',1500],['rubric',1000],['unit',30],['errorSegment',200]])if(q[key]!=null&&(typeof q[key]!=='string'||q[key].length>limit))throw Error(`Revisa ${key} del ejercicio ${number}.`);
   if(q.errorSegment&&!q.prompt.includes(q.errorSegment))throw Error('El fragmento erróneo debe aparecer en el enunciado.');
   for(const [key,count,limit] of [['hints',3,300],['alternatives',6,100],['wordBank',12,100]])if(q[key]!=null&&(!Array.isArray(q[key])||q[key].length>count||q[key].some(v=>typeof v!=='string'||!v.trim()||v.length>limit)))throw Error(`Revisa las pistas y alternativas del ejercicio ${number}.`);
   if(q.optionFeedback!=null&&(!['quiz','boolean','classify'].includes(q.type)||!Array.isArray(q.optionFeedback)||q.optionFeedback.length!==q.options.length||new Set(q.optionFeedback.map(row=>row?.option)).size!==q.options.length||q.optionFeedback.some(row=>!row||!q.options.includes(row.option)||typeof row.explanation!=='string'||!row.explanation.trim()||row.explanation.length>400)))throw Error('Revisa la explicación de cada opción.');
   if(q.itemExplanations!=null&&(!Object.hasOwn(limits,q.type)||!Array.isArray(q.itemExplanations)||q.itemExplanations.length!==q.options.length||q.itemExplanations.some(value=>typeof value!=='string'||!value.trim()||value.length>300)))throw Error('Añade una explicación por elemento en el mismo orden que sus opciones.');
   if(q.calculation!=null&&(q.type!=='numeric'||typeof q.calculation!=='string'||q.calculation.length>160))throw Error('Cálculo de comprobación no válido.');
   if(q.tolerance!=null&&(!Number.isFinite(q.tolerance)||q.tolerance<0||q.tolerance>1e6))throw Error('Tolerancia numérica no válida.');
   if(visualTypes.includes(q.type)){
    if(q.image&&(typeof q.image.id!=='string'||!q.image.id||typeof q.image.filename!=='string'))throw Error('Imagen no válida.');
    if(requireImages&&!q.image)throw Error(`Selecciona una imagen para el ejercicio ${number}.`);
    if(q.type==='imagepoint'){
     if(q.target){for(const key of ['x','y','width','height'])if(q.target[key]!=null&&(!Number.isFinite(Number(q.target[key]))||Number(q.target[key])<(key==='x'||key==='y'?0:1)||Number(q.target[key])>100))throw Error('Zona de imagen no válida.');if(q.target.x==null||q.target.y==null)throw Error('Indica el centro de la zona.');}
     else if(requireImages)throw Error('Marca la zona correcta de la imagen.');q.answer='Zona marcada';
    }
   }
   if(q.type==='pasapalabra'){
    const key=v=>v.toLocaleUpperCase().replace('Ñ','\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace('\u0001','Ñ');
    if(puzzleRows(q.type,q.options).some(([letter,,answer])=>!key(answer).includes(key(letter))))throw Error('Cada respuesta del rosco debe empezar por su letra o contenerla.');
   }
   if(q.activityGroup!=null&&(!Number.isInteger(q.activityGroup)||q.activityGroup<1||q.activityGroup>20))throw Error('Grupo de actividad no válido.');
   q.id=q.id||uid();q.text=q.text.trim();return q;
  });
  const pairs=clean.filter(q=>q.type==='pairs').map(q=>(q.activityGroup||0)+'|'+q.answer.toLocaleLowerCase());
  if(new Set(pairs).size!==pairs.length)throw Error('Las respuestas de Relacionar deben ser distintas en cada actividad.');return clean;
 };
 openWorkshop=function(prefill={}){
  const owner=selected||prefill.studentId||'',draft=isPremium()?{...prefill}:{...prefill,visualquiz:0,imagepoint:0},st=student(owner);
  modal('Crear material',workshopMarkup(owner,draft,st),async form=>{
   const c={studentId:form.get('studentId'),course:form.get('course').trim(),subject:form.get('subject'),topic:form.get('topic').trim(),theme:form.get('theme').trim(),duration:15,instructions:String(form.get('instructions')||'').trim(),extent:'standard',difficulty:'standard',activitySizes:{},qualityVersion:1};
   let total=0,totalQuestions=0;
   for(const type of Object.keys(activityLabels)){c[type]=Number(form.get(type));if(!Number.isInteger(c[type])||c[type]<0||c[type]>MAX_GENERATOR_ACTIVITIES)throw Error('Elige hasta 3 actividades en total.');if(visualTypes.includes(type)&&!isPremium()&&c[type])throw Error('Las fotografías requieren Premium.');total+=c[type];if(c[type]&&!visualTypes.includes(type)){const size=Number(form.get('size-'+type));if(!Number.isInteger(size)||size<(['pasapalabra','wordsearch','crossword','dragdrop'].includes(type)?3:2)||size>(limits[type]||12))throw Error('Revisa el número de preguntas o elementos de '+activityLabels[type]+'.');c.activitySizes[type]=size;}totalQuestions+=c[type]*(bundleTypes.has(type)?c.activitySizes[type]:1);}
   if(!c.topic||total<1||total>MAX_GENERATOR_ACTIVITIES||totalQuestions>80)throw Error('Indica el tema y selecciona entre 1 y 3 actividades.');
   let group=0;
   const blank=[];
   for(const type of Object.keys(activityLabels))for(let n=0;n<c[type];n++){group++;for(let i=0;i<(bundleTypes.has(type)?c.activitySizes[type]:1);i++)blank.push({id:uid(),type,activityGroup:group,prompt:'',answer:'',text:'',options:type==='boolean'?['Verdadero','Falso']:optionTypes.includes(type)?Array(['quiz','classify'].includes(type)?3:c.activitySizes[type]||3).fill(''):[]});}
   let questions=blank;
   if(form.get('mode')==='ai'){
    workshopBusy=true;const controls=[...$('form').querySelectorAll('input,textarea,select,button')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);
    $('workshopStatus').textContent='Preparando actividades completas y revisando sus respuestas…';
    try{
     const fingerprint=JSON.stringify(c);if(!generatorRetry||generatorRetry.fingerprint!==fingerprint)generatorRetry={fingerprint,id:crypto.randomUUID()};
     const response=await api('/api/profesor/generate',{...c,visualquiz:0,imagepoint:0,focus:st?String(learningSummary(st,c.subject).reinforce||'').slice(0,350):'',request_id:generatorRetry.id});
     const generated=validateActivityQuestions(response.questions);
     for(const type of Object.keys(activityLabels).filter(k=>!visualTypes.includes(k)))if(generated.filter(q=>q.type===type).length!==c[type]*(bundleTypes.has(type)?c.activitySizes[type]||0:1))throw Error('La IA devolvió una cantidad de preguntas distinta a la solicitada.');
     questions=generated.map(q=>({...q,id:uid()}));const lastGroup=Math.max(0,...questions.map(q=>q.activityGroup||0));let photoGroup=lastGroup;
     for(const q of blank.filter(q=>visualTypes.includes(q.type)))questions.push({...q,activityGroup:++photoGroup});generatorRetry=null;
    }finally{workshopBusy=false;controls.forEach(([el,disabled])=>el.disabled=disabled);$('workshopStatus').textContent='';$('form').dispatchEvent(new Event('workshop:refresh'));}
   }
   const material={id:uid(),title:c.topic,subject:c.subject,studentId:c.studentId,kind:'Actividad interactiva',body:'',activity:{version:1,context:c,questions}};
   setTimeout(()=>editActivity(material),0);
  });setupWorkshop(owner,draft,st);
 };
 const originalPreview=puzzlePreview;
 puzzlePreview=function(type,options){if(type!=='pasapalabra')return originalPreview(type,options);try{const rows=puzzleRows(type,options);return `<div class="rosco-preview"><div class="pasapalabra-wheel" aria-label="Vista previa del rosco">${rows.map(([letter],i)=>{const a=i/rows.length*Math.PI*2-Math.PI/2;return `<span style="left:${50+43*Math.cos(a)}%;top:${50+43*Math.sin(a)}%">${esc(letter)}</span>`}).join('')}<div class="rosco-center"><strong>${rows.length}</strong><span>letras</span></div></div><p class="generator-help">Una pista por letra · responde, pasa y vuelve a las pendientes</p><ol class="rosco-clue-preview">${rows.slice(0,3).map(([letter,clue])=>`<li><b>${esc(letter)}</b> ${esc(clue)}</li>`).join('')}</ol></div>`;}catch(error){return `<p>${esc(error.message)}</p>`;}};
 const originalEdit=editActivity;
 const originalNavigation=setupEditorNavigation;
 setupEditorNavigation=function(material){$('form').editorMaterial=material;originalNavigation(material)};
 const originalCollect=collectEditorMaterial;
 collectEditorMaterial=function(material,fields){
  material.activity.questions.forEach((q,i)=>Object.assign(q,readQuestionFeedback(i,q,true)));
  return originalCollect(material,fields);
 };
 function readQuestionFeedback(index,q,requireComplete=false){
  const root=$('questionFeedback-'+index),options=$('o-'+index)?.value.split('\n').map(v=>v.trim()).filter(Boolean)||[];
  const values=root?[...root.querySelectorAll('textarea')].map(input=>input.value.trim()):[];
  if(requireComplete&&values.some(Boolean)&&values.some(value=>!value)){root.closest('details').open=true;throw Error('Completa todas las explicaciones del ejercicio '+(index+1)+' o déjalas todas vacías.');}
  return {optionFeedback:['quiz','boolean','classify'].includes(q.type)&&values.length>0&&values.length===options.length&&values.every(Boolean)?options.map((option,n)=>({option,explanation:values[n]})):undefined,
   itemExplanations:Object.hasOwn(limits,q.type)&&values.length>0&&values.length===options.length&&values.every(Boolean)?values:undefined};
 }
 function editorDraft(){
  const material=JSON.parse(JSON.stringify($('form').editorMaterial)),fields=new FormData($('form'));
  material.title=String(fields.get('title')||'');
  material.activity.questions=material.activity.questions.map((q,i)=>({...q,prompt:String(fields.get('q-'+i)||''),answer:String(fields.get('a-'+i)||''),text:q.type==='reading'?String(fields.get('text-'+i)||''):'',options:optionTypes.includes(q.type)?String(fields.get('o-'+i)||'').split('\n').map(v=>v.trim()).filter(Boolean):[],explanation:String(fields.get('explanation-'+i)||''),hints:String(fields.get('hints-'+i)||'').split('\n').map(v=>v.trim()).filter(Boolean),rubric:String(fields.get('rubric-'+i)||''),unit:String(fields.get('unit-'+i)||''),tolerance:Number(fields.get('tolerance-'+i)||0),alternatives:String(fields.get('alternatives-'+i)||'').split('\n').map(v=>v.trim()).filter(Boolean),wordBank:String(fields.get('wordBank-'+i)||'').split('\n').map(v=>v.trim()).filter(Boolean),errorSegment:String(fields.get('errorSegment-'+i)||''),...readQuestionFeedback(i,q)}));
  return material;
 }
 editActivity=function(source){originalEdit(source);source.activity.questions.forEach((q,i)=>{if(q.type==='multigaps'){$('q-'+i).maxLength=12000;$('q-'+i).rows=8;const hint=$('q-'+i).nextElementSibling;if(hint?.classList.contains('play-editor-hint'))hint.textContent='Texto coherente con entre 2 y 20 huecos ___. Una solución por línea, en el mismo orden.';}if(q.type==='reading')$('text-'+i).maxLength=12000;$('a-'+i).maxLength=2500;if(q.activityGroup){const label=document.createElement('p');label.className='generator-help';label.textContent='Actividad '+q.activityGroup+' · '+activityLabels[q.type];$('q-'+i).closest('.block').prepend(label);}});
  const label=$('form').querySelector('.exercise-jump>span');if(label)label.firstChild.textContent='Pregunta ';
  const update=()=>{const current=Number($('dialog').dataset.editorStep||0),q=source.activity.questions[current];if(q?.activityGroup){const subtitle=$('form').querySelector('.studio-subtitle');subtitle.textContent='Actividad '+q.activityGroup+' · '+activityLabels[q.type]+' · Edita una pregunta cada vez. El material conserva todas sus preguntas.';}if(['gaps','multigaps'].includes(q?.type))$('editorPreview').querySelector('.preview-exercise>p')?.remove();};
  const syncReading=event=>{const match=event.target.id?.match(/^text-(\d+)$/);if(!match)return;const changed=source.activity.questions[Number(match[1])];if(changed?.type!=='reading'||!changed.activityGroup)return;source.activity.questions.forEach((q,i)=>{if(q.type==='reading'&&q.activityGroup===changed.activityGroup)$('text-'+i).value=event.target.value;});};
  source.activity.questions.forEach((q,i)=>{if(q.type==='reading'&&q.activityGroup){const hint=document.createElement('p');hint.className='generator-help';hint.textContent='Este texto se comparte con todas las preguntas de esta actividad. Al editarlo, se actualiza en todas.';$('text-'+i).after(hint);}});
  source.activity.questions.forEach((q,index)=>{
   const section=$('q-'+index).closest('.activity-edit-block'),options=$('o-'+index);
   if(q.type==='numeric')for(const name of ['q','a','unit','tolerance'])$('form').elements.namedItem(name+'-'+index)?.addEventListener('input',()=>{delete $('form').editorMaterial.activity.questions[index].calculation});
   if(['quiz','boolean','classify'].includes(q.type)||Object.hasOwn(limits,q.type)){
    const details=document.createElement('details');details.className='pedagogy-editor question-feedback-editor';
    details.innerHTML=`<summary>${q.type==='multigaps'?'Explicación de cada hueco':['quiz','boolean','classify'].includes(q.type)?'Corrección de cada opción':'Explicación de cada elemento'}</summary><p class="generator-help">Explica el razonamiento concreto. Si completas todas las explicaciones se mostrarán al corregir.</p><div id="questionFeedback-${index}"></div>`;
    section.append(details);let entries=[];
    function drawFeedback(question){
     const current=options.value.split('\n').map(v=>v.trim()).filter(Boolean),previous=entries.slice();
     if(!question)previous.forEach((row,n)=>row.explanation=$('feedbackField-'+index+'-'+n)?.value||'');
     entries=current.map((option,n)=>{const old=previous.find(row=>row.option===option&&!row.used);if(old)old.used=true;return{option,explanation:question?question.optionFeedback?.find(row=>row.option===option)?.explanation||question.itemExplanations?.[n]||'':old?.explanation||''}});
     $('questionFeedback-'+index).innerHTML=entries.map((row,n)=>`<label>${esc((n+1)+'. '+row.option)}<textarea id="feedbackField-${index}-${n}" rows="2" maxlength="${['quiz','boolean','classify'].includes(q.type)?400:300}" placeholder="Qué razonamiento o pista del contexto justifica esta respuesta">${esc(row.explanation)}</textarea></label>`).join('');
     Object.assign($('form').editorMaterial.activity.questions[index],readQuestionFeedback(index,q));
    }
    details.resetFeedback=drawFeedback;options.addEventListener('input',()=>drawFeedback());drawFeedback(q);
   }
   if(visualTypes.includes(q.type))return;
   const details=document.createElement('details');details.className='regenerate-question';
   details.innerHTML=`<summary>↻ Regenerar esta pregunta</summary><label for="regenerateInstructions-${index}">¿Qué quieres mejorar?<textarea id="regenerateInstructions-${index}" maxlength="1500" rows="2" placeholder="Por ejemplo: más contexto, otra situación o distractores que ayuden a detectar errores comunes."></textarea></label><div class="regenerate-actions"><small>Solo sustituye esta pregunta · 1 crédito al completarse</small><button type="button" data-regenerate="${index}">Regenerar con IA</button><button type="button" data-undo-regenerate="${index}" hidden>Deshacer cambio</button></div><p role="status" class="generator-help"></p>`;
   section.querySelector('h3').after(details);
   let retry=null,busy=false,previous=null;
   const status=details.querySelector('[role="status"]'),button=details.querySelector('[data-regenerate]'),undo=details.querySelector('[data-undo-regenerate]');
   function replaceQuestion(next){
    const material=$('form').editorMaterial;material.activity.questions[index]=next;
    const set=(name,value)=>{const input=$('form').elements.namedItem(name);if(input)input.value=value||''};
    set('q-'+index,next.prompt);set('a-'+index,next.answer);set('text-'+index,next.text);
    set('o-'+index,(next.options||[]).join('\n'));
    options?.dispatchEvent(new Event('editor:options'));
    for(const field of ['explanation','rubric','unit','errorSegment','tolerance'])set(field+'-'+index,next[field]);
    for(const field of ['hints','alternatives','wordBank'])set(field+'-'+index,(next[field]||[]).join('\n'));
    section.querySelector('.question-feedback-editor')?.resetFeedback(next);
    $('form').dispatchEvent(new Event('input',{bubbles:true}));
   }
   undo.onclick=()=>{if(previous){replaceQuestion(previous);previous=null;undo.hidden=true;status.textContent='Se ha recuperado la pregunta anterior.'}};
   button.onclick=async()=>{
    if(busy)return;
    if(demo)return status.textContent='Inicia sesión para regenerar con IA.';
    const draft=editorDraft(),original=draft.activity.questions[index],context=draft.activity.context||{};
    const sameGroup=other=>!original.activityGroup||other.activityGroup===original.activityGroup;
    const body={course:context.course||student(draft.studentId)?.course||'3.º ESO',subject:context.subject||draft.subject,topic:context.topic||draft.title,theme:context.theme||'',instructions:context.instructions||'',extent:context.extent||'standard',difficulty:context.difficulty||'standard',qualityVersion:1,regenerate:{question:original,siblings:draft.activity.questions.filter((other,n)=>n!==index&&other.type===original.type&&(original.type!=='reading'||sameGroup(other))).map(other=>({type:other.type,prompt:other.prompt,answer:other.answer,activityGroup:other.activityGroup||original.activityGroup||1})),instructions:$('regenerateInstructions-'+index).value.trim()}};
    const fingerprint=JSON.stringify(body);if(!retry||retry.fingerprint!==fingerprint)retry={fingerprint,id:crypto.randomUUID()};body.request_id=retry.id;
    const controls=[...$('dialog').querySelectorAll('input,textarea,select,button')].map(el=>[el,el.disabled]);
    const preventClose=event=>event.preventDefault();$('dialog').addEventListener('cancel',preventClose);
    busy=true;controls.forEach(([el])=>el.disabled=true);status.textContent='Mejorando esta pregunta y comprobando su solución…';
    try{
     const response=await api('/api/profesor/generate',body),result=validateActivityQuestions(response.questions);
     if(result.length!==1||result[0].type!==original.type)throw Error('La IA no devolvió una única pregunta del mismo tipo.');
     const next={...result[0],id:original.id,activityGroup:original.activityGroup};
     if(original.type==='reading'&&original.text&&next.text!==original.text)throw Error('El texto compartido debe conservarse.');
     if(original.type==='classify'&&JSON.stringify([...next.options].sort())!==JSON.stringify([...original.options].sort()))throw Error('Las categorías compartidas deben conservarse.');
     previous=original;replaceQuestion(next);retry=null;undo.hidden=false;status.textContent='Pregunta mejorada. Las demás se conservan. Guarda el material para conservar el cambio.';
    }catch(error){status.textContent=error.message}
    finally{busy=false;controls.forEach(([el,disabled])=>el.disabled=disabled);$('dialog').removeEventListener('cancel',preventClose)}
   };
  });
  $('form').addEventListener('input',syncReading);
  $('dialog').addEventListener('close',()=>$('form').removeEventListener('input',syncReading),{once:true});
  const paintPreview=()=>{
   const root=$('editorPreview'),index=Number($('dialog').dataset.editorStep||0),q=$('form').editorMaterial?.activity.questions[index];
   if(q&&!root.querySelector('[data-preview-feedback]')){
    const metadata=readQuestionFeedback(index,q),explanation=$('form').elements.namedItem('explanation-'+index)?.value||'';
    const rows=metadata.optionFeedback?.map(row=>[row.option,row.explanation])||metadata.itemExplanations?.map((value,n)=>[q.type==='multigaps'?'Hueco '+(n+1):q.options[n]?.split('|')[0]||String(n+1),value])||[];
    const details=document.createElement('details');details.dataset.previewFeedback='';details.className='play-item-reasons';
    details.innerHTML='<summary>Corrección y explicaciones</summary>'+(explanation?profesorText.rich(explanation):'<p>Añade una explicación de la solución.</p>')+rows.map(([label,value])=>'<p><b>'+esc(label)+':</b> '+profesorText.rich(value)+'</p>').join('');root.append(details);
   }
   profesorText.paint(root);
  };
  const previewObserver=new MutationObserver(paintPreview);previewObserver.observe($('editorPreview'),{childList:true,subtree:true});paintPreview();
  $('dialog').addEventListener('close',()=>previewObserver.disconnect(),{once:true});
  $('form').addEventListener('input',update);
  $('form').addEventListener('editor:step',update);$('dialog').addEventListener('close',()=>{$('form').removeEventListener('editor:step',update);$('form').removeEventListener('input',update)},{once:true});update();
 };
})();
