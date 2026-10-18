/* Activity size, teacher instructions and complete game previews. */
(() => {
 const bundleTypes=new Set(['pairs','gaps','quiz','short','classify','boolean','reading','problem','flashcard','error','numeric','hangman','mystery','intruder']);
 const limits={multigaps:20,pasapalabra:27,crossword:7,wordsearch:8,memory:8,dragdrop:8,order:8,sentence:8,timeline:8,bingo:9};
 const defaults={pasapalabra:18,multigaps:10,reading:4,problem:3,hangman:3,mystery:3,intruder:5,bingo:9};
 const unitLabels={pairs:'parejas',gaps:'frases',multigaps:'huecos',numeric:'preguntas',quiz:'preguntas',short:'preguntas',order:'elementos',classify:'elementos',boolean:'preguntas',reading:'preguntas',problem:'problemas',flashcard:'tarjetas',memory:'parejas',sentence:'fragmentos',timeline:'eventos',error:'frases',wordsearch:'palabras',crossword:'palabras',dragdrop:'parejas',pasapalabra:'letras',hangman:'palabras',visualquiz:'imagen',imagepoint:'imagen',mystery:'misterios',intruder:'rondas',bingo:'conceptos'};
 const minSize=type=>type==='bingo'?9:['pasapalabra','wordsearch','crossword','dragdrop'].includes(type)?3:2;
 const maxSize=type=>limits[type]||12;
 const recoverableGenerationError=error=>{
  const status=Number(error?.status);
  if(status===503&&/no hay una ia configurada|configura|clave|modelo/i.test(error?.message||''))return false;
  return error?.recoverable===true||[429,500,502,503,504].includes(status);
 };
 function showGenerationRetry(notice,error){
  if(!notice)return;
  const status=Number(error?.status),busy=[429,503,504].includes(status);
  const completed=Number(error?.completed)||0,total=Number(error?.total)||0;
  notice.querySelector('strong').textContent=busy?'La IA está ocupada temporalmente':'La generación se ha interrumpido';
  const progress=completed&&total?`${completed} de ${total} elementos válidos están guardados. `:'';
  const billing=status?' Si el material sigue incompleto, no se han descontado créditos.':' Se consultará el mismo intento sin crear otro material.';
  notice.querySelector('p').textContent=progress+(busy?'Espera unos segundos y reintenta. ':'Puedes reintentar con los mismos datos. ')+(error?.message||'')+billing;
  notice.hidden=false;
 }
 async function generateInBackground(body,status){
  let job;
  try{job=await api('/api/profesor/generation/start',body)}catch(error){if(!error?.status)error.recoverable=true;throw error}
  let networkFailures=0;
  const started=Date.now();
  while(job.status==='running'||job.status==='queued'){
   if(status)status.textContent=job.completed?`${job.completed} de ${job.total} elementos preparados. Comprobando los restantes…`:'Preparando el contenido y comprobando las respuestas…';
   if(Date.now()-started>25*60*1000)throw Object.assign(new Error('El material sigue en proceso. Pulsa Reintentar para consultar el mismo intento.'),{recoverable:true,completed:job.completed,total:job.total});
   await new Promise(resolve=>setTimeout(resolve,1500));
   try{job=await api('/api/profesor/generation/'+encodeURIComponent(body.request_id));networkFailures=0}
   catch(error){
    if(++networkFailures>=6)throw Object.assign(new Error('No se pudo consultar el progreso. La generación puede continuar en el servidor; pulsa Reintentar para recuperarla.'),{recoverable:true,completed:job.completed,total:job.total});
    if(status)status.textContent='Reconectando… El progreso está guardado.';
   }
  }
  if(job.status!=='completed'||!job.result?.questions)throw Object.assign(new Error(job.error||'El intento se interrumpió. Pulsa Reintentar para recuperar el progreso guardado.'),{status:job.error_status,code:job.error_code,completed:job.completed,total:job.total,recoverable:job.status==='interrupted'});
  return job.result;
 }
 window.profesorResumeGeneration=async function(job,status){
  const result=await generateInBackground({...job.context,request_id:job.request_id},status);
  return {id:job.request_id,generationRequestId:job.request_id,title:job.context.topic||'Material recuperado',subject:job.context.subject,kind:'Actividad interactiva',body:'',activity:{version:1,context:job.context,questions:validateActivityQuestions(result.questions).map(q=>({...q,id:q.id||uid()}))}};
 };
 const originalMarkup=workshopMarkup;
 workshopMarkup=function(owner,draft,st){
  return originalMarkup(owner,draft,st).replace('<div class="catalog-board">',`<section class="generator-brief"><label for="workshopInstructions">Describe el material que necesitas</label><textarea id="workshopInstructions" name="instructions" maxlength="3000" rows="2" placeholder="Por ejemplo: un relato con huecos para practicar imperfecto y pretérito perfecto simple, con vocabulario A2.">${esc(draft.instructions||'')}</textarea></section><div class="catalog-board">`);
 };
 const originalSetup=setupWorkshop;
 setupWorkshop=function(owner,draft,st){
  originalSetup(owner,draft,st);
  const form=$('form'),controller=new AbortController();
  const sizes={...(draft.activitySizes||{})};
  for(const type of Object.keys(activityLabels)){
   const input=document.createElement('input');
   input.type='hidden';input.name=input.id='size-'+type;
   input.value=String(visualTypes.includes(type)?1:Math.max(minSize(type),Math.min(maxSize(type),Number(sizes[type])||defaults[type]||6)));
   form.querySelector('.studio-counts').append(input);
   const tile=form.querySelector(`[data-exercise="${type}"]`);
   if(!tile)continue;
   const quantity=tile.querySelector('.tile-quantity');
   const unit=document.createElement('span');unit.className='tile-unit';unit.textContent=unitLabels[type];
   quantity.setAttribute('aria-label',`Número de ${unitLabels[type]} de ${activityLabels[type]}`);
   quantity.querySelector('output').after(unit);
   tile.querySelectorAll('[data-step]').forEach(control=>{
    control.setAttribute('aria-label',`${control.dataset.step==='1'?'Añadir':'Quitar'} ${unitLabels[type]} de ${activityLabels[type]}`);
    const change=event=>{event.stopPropagation();event.preventDefault();if(tile.disabled||workshopBusy||Number($('count-'+type).value)!==1||visualTypes.includes(type))return;input.value=String(Math.max(minSize(type),Math.min(maxSize(type),Number(input.value)+Number(control.dataset.step))));refreshSizes()};
    control.onclick=change;
    control.onkeydown=event=>{if(event.key==='Enter'||event.key===' ')change(event)};
   });
  }
  function refreshSizes(){
   const selectedTypes=Object.keys(activityLabels).filter(type=>Number($('count-'+type).value)>0);
   for(const type of Object.keys(activityLabels)){
    const tile=form.querySelector(`[data-exercise="${type}"]`),selected=selectedTypes.includes(type),size=Number($('size-'+type).value);
    if(!tile)continue;
    tile.querySelector('output').textContent=selected?String(size):'0';
    tile.querySelectorAll('[data-step]').forEach(control=>control.setAttribute('aria-disabled',String(!selected||visualTypes.includes(type)||size<=(control.dataset.step==='-1'?minSize(type):0)||control.dataset.step==='1'&&size>=maxSize(type))));
    tile.querySelector('.tile-quantity').classList.toggle('fixed-size',visualTypes.includes(type));
   }
   const type=selectedTypes[0],size=type?Number($('size-'+type).value):0;
   const advanced=advancedTypes.includes(type),remaining=advancedAiRemaining();
   $('workshopContinue').textContent='✦ Generar con IA'+(advanced?(isPremium()?' · sin límite diario':remaining?' · 1 disponible hoy':' · cupo agotado hoy'):'');
   $('workshopContinue').title=advanced?'El cupo diario se comparte entre todos los juegos avanzados. La creación manual es libre.':'';
   const badge=form.querySelector('.advanced-family .advanced-plan-allowance');
   if(badge)badge.textContent=isPremium()?'IA sin límite diario':`${remaining}/1 ${remaining===1?'disponible':'disponibles'} con IA hoy`;
   $('workshopSelection').textContent=selectedTypes.length===1?`Una actividad de ${activityLabels[type]} · ${size} ${unitLabels[type]}`:'Selecciona una actividad';
   const invalid=workshopBusy||selectedTypes.length!==1||size<1;
   $('workshopSelection').classList.toggle('error',selectedTypes.length>1);
   $('workshopManual').disabled=invalid;$('workshopContinue').disabled=invalid||type&&visualTypes.includes(type);
  }
  form.addEventListener('click',()=>setTimeout(()=>{if(!controller.signal.aborted&&form.isConnected&&$('dialog').open&&$('form')===form)refreshSizes()},0),{signal:controller.signal,capture:true});
  form.addEventListener('change',()=>queueMicrotask(refreshSizes),{signal:controller.signal});
  form.addEventListener('workshop:refresh',refreshSizes,{signal:controller.signal});
  const family=form.querySelector('.advanced-family .family-heading');
  if(family){const badge=document.createElement('span');badge.className='advanced-plan-allowance';family.querySelector('strong').after(badge)}
  $('dialog').addEventListener('close',()=>controller.abort(),{once:true});refreshSizes();
  refreshProfesorLimits().catch(()=>{});
 };
 // Larger texts use the same contract in the editor, player and PDF export.
 const oldPuzzleRows=puzzleRows;
 puzzleRows=function(type,options){if(type!=='multigaps')return oldPuzzleRows(type,options);const rows=options.map(v=>String(v).trim()).filter(Boolean);if(rows.length<2||rows.length>20||rows.some(v=>v.length>100))throw Error('Texto con huecos: escribe entre 2 y 20 soluciones en el orden de los huecos.');return rows;};
 validateActivityQuestions=function(questions,requireImages=true){
  if(!Array.isArray(questions)||!questions.length||questions.length>80)throw Error('El material debe tener entre 1 y 80 preguntas.');
  const clean=questions.map((source,index)=>{
   const q=JSON.parse(JSON.stringify(source)),number=index+1;
   const invalid=(message,field='q')=>{throw Object.assign(Error(message),{questionIndex:index,fieldId:field+'-'+index})};
   try{
   if(!Object.hasOwn(activityLabels,q.type)||typeof q.prompt!=='string'||typeof q.answer!=='string')throw Error('Formato de ejercicio no válido.');
   q.prompt=q.prompt.trim();q.answer=q.answer.trim();q.text=q.text||'';
   if(!q.prompt)invalid(`Escribe el enunciado del ejercicio ${number}.`);
   if(q.prompt.length>(q.type==='multigaps'?12000:1500))invalid(`Acorta el enunciado del ejercicio ${number}.`);
   if(q.answer.length>2500)invalid(`Acorta la solución del ejercicio ${number}.`,'a');
   if(typeof q.text!=='string'||q.text.length>12000)invalid(`Revisa el texto de lectura del ejercicio ${number}.`,'text');
   if(!q.answer&&!sequenceTypes.includes(q.type)&&q.type!=='memory'&&!puzzleTypes.includes(q.type)&&q.type!=='imagepoint')invalid(`Escribe la solución del ejercicio ${number}.`,'a');
   const gaps=(q.prompt.match(/___/g)||[]).length;
   if(q.type==='gaps'&&gaps!==1)throw Error(`El ejercicio ${number} debe tener exactamente un hueco ___.`);
   if(q.type==='multigaps'&&(gaps<2||gaps>20))throw Error('El texto debe tener entre 2 y 20 huecos ___.');
   q.options=optionTypes.includes(q.type)?q.options:[];
   if(!Array.isArray(q.options)||q.options.some(v=>typeof v!=='string'))throw Error('Opciones no válidas.');
   q.options=q.options.map(v=>v.trim()).filter(Boolean);
   if(optionTypes.includes(q.type)){
    const max=q.type==='mystery'?3:limits[q.type]||5;
    if(q.options.length<2||q.options.length>max||q.options.some(v=>v.length>300)||q.type!=='multigaps'&&new Set(q.options.map(v=>v.toLocaleLowerCase())).size!==q.options.length)invalid(`Revisa las opciones del ejercicio ${number}: comprueba su cantidad, longitud y que no se repitan.`,'o');
    if(sequenceTypes.includes(q.type))q.answer=q.options.join(' → ');
    else if(q.type==='memory'){validateMemory(q.options);q.answer='Completado';}
    else if(puzzleTypes.includes(q.type)){puzzleRows(q.type,q.options);q.answer=q.type==='multigaps'?q.options.join(' | '):'Completado';}
    else if(q.type==='mystery'){window.profesorMiniGames.validate(q);}
    else if(!q.options.includes(q.answer))invalid(`La solución del ejercicio ${number} debe coincidir con una opción.`,'a');
   }
   if(['mystery','intruder','bingo'].includes(q.type))window.profesorMiniGames.validate(q);
   if(q.type==='multigaps'&&gaps!==q.options.length)invalid('Añade una solución por cada hueco.','o');
   if(q.type==='boolean'&&(q.options.length!==2||!q.options.includes('Verdadero')||!q.options.includes('Falso')))throw Error('Verdadero / Falso requiere esas dos opciones.');
   if(q.type==='reading'&&!q.text.trim())invalid('Añade el texto de lectura.','text');
   if(q.type==='numeric'&&(!q.answer.trim()||!Number.isFinite(Number(q.answer.replace(',','.')))))invalid('Escribe un número como solución; puedes usar coma decimal.','a');
   if(q.type==='hangman'&&!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{1,39}$/.test(q.answer))invalid('Ahorcado: usa una palabra o expresión de 2 a 40 caracteres.','a');
   for(const [key,limit] of [['explanation',1500],['rubric',1000],['unit',30],['errorSegment',200],['correctedSegment',200]])if(q[key]!=null&&(typeof q[key]!=='string'||q[key].length>limit))invalid(`Revisa ${key} del ejercicio ${number}.`,key);
   if(q.errorSegment&&!q.prompt.includes(q.errorSegment))invalid('El fragmento erróneo debe aparecer exactamente en el enunciado.','errorSegment');
   if(q.type==='error'&&q.correctedSegment&&(!q.errorSegment||q.correctedSegment.trim().toLocaleLowerCase('es')===q.errorSegment.trim().toLocaleLowerCase('es')))invalid('La corrección debe ser distinta del fragmento erróneo.','correctedSegment');
   for(const [key,count,limit] of [['hints',3,300],['alternatives',6,100],['wordBank',12,100]])if(q[key]!=null&&(!Array.isArray(q[key])||q[key].length>count||q[key].some(v=>typeof v!=='string'||!v.trim()||v.length>limit)))invalid(`Revisa las pistas y alternativas del ejercicio ${number}.`,key);
   if(q.optionFeedback!=null&&(!['quiz','boolean','classify'].includes(q.type)||!Array.isArray(q.optionFeedback)||q.optionFeedback.length!==q.options.length||new Set(q.optionFeedback.map(row=>row?.option)).size!==q.options.length||q.optionFeedback.some(row=>!row||!q.options.includes(row.option)||typeof row.explanation!=='string'||!row.explanation.trim()||row.explanation.length>400)))throw Error('Revisa la explicación de cada opción.');
   if(q.itemExplanations!=null&&(!Object.hasOwn(limits,q.type)||!Array.isArray(q.itemExplanations)||q.itemExplanations.length!==q.options.length||q.itemExplanations.some(value=>typeof value!=='string'||!value.trim()||value.length>300)))throw Error('Añade una explicación por elemento en el mismo orden que sus opciones.');
   if(q.calculation!=null&&(q.type!=='numeric'||typeof q.calculation!=='string'||q.calculation.length>160))throw Error('Cálculo de comprobación no válido.');
   if(q.tolerance!=null&&(!Number.isFinite(q.tolerance)||q.tolerance<0||q.tolerance>1e6))invalid('La tolerancia debe ser un número entre 0 y 1000000.','tolerance');
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
   }catch(error){error.questionIndex=index;if(!error.fieldId)error.fieldId=(q.type==='reading'?'text':optionTypes.includes(q.type)?'o':'q')+'-'+index;throw error}
  });
  const pairs=clean.filter(q=>q.type==='pairs').map(q=>(q.activityGroup||0)+'|'+q.answer.toLocaleLowerCase());
  if(new Set(pairs).size!==pairs.length)throw Error('Las respuestas de Relacionar deben ser distintas en cada actividad.');return clean;
 };
 openWorkshop=function(prefill={}){
  if(!Object.keys(prefill).length)try{const saved=JSON.parse(sessionStorage.getItem('profesor.generatorRetry')||'null');if(saved?.body&&saved.account===accountEmail)prefill=saved.body}catch{}
  const owner=Object.hasOwn(prefill,'studentId')?prefill.studentId:selected||'',draft=isPremium()?{...prefill}:{...prefill,visualquiz:0,imagepoint:0},st=student(owner);
  modal('Crear material',workshopMarkup(owner,draft,st),async form=>{
   const retryNotice=$('workshopRetryNotice');
   if(retryNotice)retryNotice.hidden=true;
   const c={studentId:form.get('studentId'),course:form.get('course').trim(),subject:form.get('subject'),topic:form.get('topic').trim(),theme:form.get('theme').trim(),duration:15,instructions:String(form.get('instructions')||'').trim(),extent:'standard',difficulty:'standard',activitySizes:{},qualityVersion:1};
   let total=0,totalQuestions=0;
   for(const type of Object.keys(activityLabels)){c[type]=Number(form.get(type));if(!Number.isInteger(c[type])||c[type]<0||c[type]>MAX_GENERATOR_ACTIVITIES)throw Error('Elige un único tipo de actividad.');if(visualTypes.includes(type)&&!isPremium()&&c[type])throw Error('Las fotografías requieren Premium.');total+=c[type];if(c[type]&&!visualTypes.includes(type)){const size=Number(form.get('size-'+type));if(!Number.isInteger(size)||size<(['pasapalabra','wordsearch','crossword','dragdrop'].includes(type)?3:2)||size>(limits[type]||12))throw Error('Revisa el número de preguntas o elementos de '+activityLabels[type]+'.');c.activitySizes[type]=size;}totalQuestions+=c[type]*(bundleTypes.has(type)?c.activitySizes[type]:1);}
   const selectedTypes=Object.keys(activityLabels).filter(type=>c[type]>0);
   if(!c.topic||selectedTypes.length!==MAX_GENERATOR_TYPES||total<1||total>MAX_GENERATOR_ACTIVITIES||totalQuestions>80)throw Error('Indica el tema y selecciona un único tipo de actividad.');
   let group=0;
   const blank=[];
   for(const type of Object.keys(activityLabels))for(let n=0;n<c[type];n++){group++;for(let i=0;i<(bundleTypes.has(type)?c.activitySizes[type]:1);i++)blank.push({id:uid(),type,activityGroup:group,prompt:'',answer:'',text:'',options:type==='boolean'?['Verdadero','Falso']:optionTypes.includes(type)?Array(type==='mystery'?3:type==='intruder'?4:['quiz','classify'].includes(type)?3:c.activitySizes[type]||3).fill(''):[]});}
   let questions=blank,completedRequestId='';
   if(form.get('mode')==='ai'){
    workshopBusy=true;const controls=[...$('form').querySelectorAll('input,textarea,select,button')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);
    $('workshopStatus').textContent='Preparando actividades completas y revisando sus respuestas…';
    try{
     const focus=st?String(learningSummary(st,c.subject).reinforce||'').slice(0,350):'';
     const fingerprint=JSON.stringify({...c,focus});
     try{const saved=JSON.parse(sessionStorage.getItem('profesor.generatorRetry')||'null');if(saved?.fingerprint===fingerprint&&(!saved.account||saved.account===accountEmail))generatorRetry=saved;}catch{}
     if(!generatorRetry||generatorRetry.fingerprint!==fingerprint)generatorRetry={fingerprint,id:crypto.randomUUID()};
     generatorRetry.body={...c,focus};generatorRetry.account=accountEmail;generatorRetry.recoverable=true;
     try{sessionStorage.setItem('profesor.generatorRetry',JSON.stringify(generatorRetry));}catch{}
     const response=await generateInBackground({...c,visualquiz:0,imagepoint:0,focus,request_id:generatorRetry.id},$('workshopStatus'));
     completedRequestId=generatorRetry.id;
     await refreshProfesorLimits().catch(()=>{});
     const generated=validateActivityQuestions(response.questions);
     for(const type of Object.keys(activityLabels).filter(k=>!visualTypes.includes(k)))if(generated.filter(q=>q.type===type).length!==c[type]*(bundleTypes.has(type)?c.activitySizes[type]||0:1))throw Error('La IA devolvió una cantidad de preguntas distinta a la solicitada.');
     questions=generated.map(q=>({...q,id:uid()}));const lastGroup=Math.max(0,...questions.map(q=>q.activityGroup||0));let photoGroup=lastGroup;
     for(const q of blank.filter(q=>visualTypes.includes(q.type)))questions.push({...q,activityGroup:++photoGroup});generatorRetry=null;try{sessionStorage.removeItem('profesor.generatorRetry')}catch{}
    }catch(error){
     if(error.code==='advanced_daily_limit'){generatorRetry=null;try{sessionStorage.removeItem('profesor.generatorRetry')}catch{}await refreshProfesorLimits().catch(()=>{});openPremiumInfo(error.message);return false;}
     if(recoverableGenerationError(error)){
      if(generatorRetry){generatorRetry.recoverable=true;try{sessionStorage.setItem('profesor.generatorRetry',JSON.stringify(generatorRetry))}catch{}}
      showGenerationRetry(retryNotice,error);
      return false;
     }
     generatorRetry=null;try{sessionStorage.removeItem('profesor.generatorRetry')}catch{}
     throw error;
    }finally{workshopBusy=false;controls.forEach(([el,disabled])=>el.disabled=disabled);$('workshopStatus').textContent='';$('form').dispatchEvent(new Event('workshop:refresh'));}
   }
   const material={id:completedRequestId||uid(),...(completedRequestId?{generationRequestId:completedRequestId}:{}),title:c.topic,subject:c.subject,studentId:c.studentId,kind:'Actividad interactiva',body:'',activity:{version:1,context:c,questions}};
   setTimeout(()=>editActivity(material),0);
  });setupWorkshop(owner,draft,st);
  try{const saved=JSON.parse(sessionStorage.getItem('profesor.generatorRetry')||'null');if(saved?.recoverable&&saved.body&&saved.account===accountEmail)showGenerationRetry($('workshopRetryNotice'),{message:'Tienes un intento anterior. Pulsa Reintentar para continuarlo.'})}catch{}
  const retry=$('workshopRetryButton');
  if(retry)retry.onclick=()=>{$('workshopContinue').click()};
 };
 const originalPreview=puzzlePreview;
 puzzlePreview=function(type,options){if(type!=='pasapalabra')return originalPreview(type,options);try{const rows=puzzleRows(type,options);return `<div class="rosco-preview"><div class="pasapalabra-wheel" aria-label="Vista previa del rosco">${rows.map(([letter],i)=>{const a=i/rows.length*Math.PI*2-Math.PI/2;return `<span style="left:${50+43*Math.cos(a)}%;top:${50+43*Math.sin(a)}%">${esc(letter)}</span>`}).join('')}<div class="rosco-center"><strong>${rows.length}</strong><span>letras</span></div></div><p class="generator-help">Una pista por letra · responde, pasa y vuelve a las pendientes</p><ol class="rosco-clue-preview">${rows.slice(0,3).map(([letter,clue])=>`<li><b>${esc(letter)}</b> ${esc(clue)}</li>`).join('')}</ol></div>`;}catch(error){return `<p>${esc(error.message)}</p>`;}};
 const originalEdit=editActivity;
 const originalNavigation=setupEditorNavigation;
 setupEditorNavigation=function(material){$('form').editorMaterial=material;return originalNavigation(material)};
 const originalCollect=collectEditorMaterial;
 collectEditorMaterial=function(material,fields){
  material.activity.questions.forEach((q,i)=>Object.assign(q,readQuestionFeedback(i,q,true)));
  return originalCollect(material,fields);
 };
 function readQuestionFeedback(index,q,requireComplete=false){
  const root=$('questionFeedback-'+index),options=$('o-'+index)?.value.split('\n').map(v=>v.trim()).filter(Boolean)||[];
  const values=root?[...root.querySelectorAll('textarea')].map(input=>input.value.trim()):[];
  if(requireComplete&&values.some(Boolean)&&values.some(value=>!value)){root.closest('details').open=true;throw Object.assign(Error('Completa todas las explicaciones del ejercicio '+(index+1)+' o déjalas todas vacías.'),{questionIndex:index,fieldId:'feedbackField-'+index+'-'+values.findIndex(value=>!value)});}
  return {optionFeedback:['quiz','boolean','classify'].includes(q.type)&&values.length>0&&values.length===options.length&&values.every(Boolean)?options.map((option,n)=>({option,explanation:values[n]})):undefined,
   itemExplanations:Object.hasOwn(limits,q.type)&&values.length>0&&values.length===options.length&&values.every(Boolean)?values:undefined};
 }
 function editorDraft(){
  const material=JSON.parse(JSON.stringify($('form').editorMaterial)),fields=new FormData($('form'));
  material.title=String(fields.get('title')||'');
  material.activity.questions=material.activity.questions.map((q,i)=>({...q,prompt:String(fields.get('q-'+i)||''),answer:String(fields.get('a-'+i)||''),text:q.type==='reading'?String(fields.get('text-'+i)||''):'',options:optionTypes.includes(q.type)?String(fields.get('o-'+i)||'').split('\n').map(v=>v.trim()).filter(Boolean):[],explanation:String(fields.get('explanation-'+i)||''),hints:String(fields.get('hints-'+i)||'').split('\n').map(v=>v.trim()).filter(Boolean),rubric:String(fields.get('rubric-'+i)||''),unit:String(fields.get('unit-'+i)||''),tolerance:Number(fields.get('tolerance-'+i)||0),alternatives:String(fields.get('alternatives-'+i)||'').split('\n').map(v=>v.trim()).filter(Boolean),wordBank:String(fields.get('wordBank-'+i)||'').split('\n').map(v=>v.trim()).filter(Boolean),errorSegment:String(fields.get('errorSegment-'+i)||''),correctedSegment:String(fields.get('correctedSegment-'+i)||''),...readQuestionFeedback(i,q)}));
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
    for(const field of ['explanation','rubric','unit','errorSegment','correctedSegment','tolerance'])set(field+'-'+index,next[field]);
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
     const response=await generateInBackground(body,status),result=validateActivityQuestions(response.questions);
     await refreshProfesorLimits().catch(()=>{});
     if(result.length!==1||result[0].type!==original.type)throw Error('La IA no devolvió una única pregunta del mismo tipo.');
     const next={...result[0],id:original.id,activityGroup:original.activityGroup};
     if(original.type==='reading'&&original.text&&next.text!==original.text)throw Error('El texto compartido debe conservarse.');
     if(original.type==='classify'&&JSON.stringify([...next.options].sort())!==JSON.stringify([...original.options].sort()))throw Error('Las categorías compartidas deben conservarse.');
     previous=original;replaceQuestion(next);retry=null;undo.hidden=false;button.textContent='Regenerar con IA';status.textContent='Pregunta mejorada. Las demás se conservan. Guarda el material para conservar el cambio.';
    }catch(error){
     if(recoverableGenerationError(error)){
      status.textContent=`${Number(error.completed)||0} de ${Number(error.total)||1} elementos preparados. ${error.message} El intento se conserva y no se han descontado créditos. Pulsa Reintentar.`;
      button.textContent='Reintentar';
     }else{status.textContent=error.message;button.textContent='Regenerar con IA';if(error.code==='advanced_daily_limit')openPremiumInfo(error.message)}
    }
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
