/* Activity size, teacher instructions and complete game previews. */
(() => {
 const bundleTypes=new Set(['pairs','gaps','quiz','short','classify','boolean','reading','problem','flashcard','error','numeric','hangman']);
 const limits={multigaps:20,pasapalabra:27,crossword:7,wordsearch:8,memory:8,dragdrop:8,order:8,sentence:8,timeline:8};
 const defaults={pasapalabra:18,multigaps:10,reading:4,problem:3,hangman:3};
 const elementLabel=type=>type==='pasapalabra'?'Letras por rosco':type==='multigaps'?'Huecos por texto':['memory','dragdrop'].includes(type)?'Parejas por tablero':['wordsearch','crossword'].includes(type)?'Palabras por juego':sequenceTypes.includes(type)?'Elementos por secuencia':type==='flashcard'?'Tarjetas por actividad':'Preguntas por actividad';
 const originalMarkup=workshopMarkup;
 workshopMarkup=function(owner,draft,st){
  return originalMarkup(owner,draft,st).replace('<div class="catalog-board">',`<section class="generator-brief"><label for="workshopInstructions">Describe el material que necesitas</label><textarea id="workshopInstructions" name="instructions" maxlength="3000" rows="3" placeholder="Por ejemplo: un relato de unas 250 palabras con 10 huecos para practicar solo imperfecto y pretérito perfecto simple. Incluye los infinitivos, usa vocabulario A2 y evita otros tiempos verbales.">${esc(draft.instructions||'')}</textarea><div class="generator-settings"><label>Extensión de los textos<select id="workshopExtent" name="extent">${[['short','Breve'],['standard','Media'],['long','Amplia']].map(([v,l])=>`<option value="${v}" ${draft.extent===v||!draft.extent&&v==='standard'?'selected':''}>${l}</option>`).join('')}</select></label><label>Tipo de práctica<select id="workshopDifficulty" name="difficulty">${[['guided','Guiada, con apoyo'],['standard','Aplicación autónoma'],['challenge','Reto dentro del nivel']].map(([v,l])=>`<option value="${v}" ${draft.difficulty===v||!draft.difficulty&&v==='standard'?'selected':''}>${l}</option>`).join('')}</select></label></div><p class="generator-help">El tema indica qué enseñar. Aquí puedes concretar formato, longitud, restricciones y objetivos.</p><div id="generatorSizes" class="generator-sizes" aria-label="Contenido de cada actividad"></div></section><div class="catalog-board">`);
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
   $('workshopSelection').textContent=`${activities} ${activities===1?'actividad':'actividades'} · ${questions} preguntas o tableros${questions>80?' · Máximo 80':''}`;
   const invalid=workshopBusy||activities<1||activities>20||questions>80;
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
   const c={studentId:form.get('studentId'),course:form.get('course').trim(),subject:form.get('subject'),topic:form.get('topic').trim(),theme:form.get('theme').trim(),duration:15,instructions:String(form.get('instructions')||'').trim(),extent:form.get('extent'),difficulty:form.get('difficulty'),activitySizes:{}};
   let total=0,totalQuestions=0;
   for(const type of Object.keys(activityLabels)){c[type]=Number(form.get(type));if(!Number.isInteger(c[type])||c[type]<0||c[type]>10)throw Error('Elige de 0 a 10 actividades por tipo.');if(visualTypes.includes(type)&&!isPremium()&&c[type])throw Error('Las fotografías requieren Premium.');total+=c[type];if(c[type]&&!visualTypes.includes(type)){const size=Number(form.get('size-'+type));if(!Number.isInteger(size)||size<(['pasapalabra','wordsearch','crossword','dragdrop'].includes(type)?3:2)||size>(limits[type]||12))throw Error('Revisa el número de preguntas o elementos de '+activityLabels[type]+'.');c.activitySizes[type]=size;}totalQuestions+=c[type]*(bundleTypes.has(type)?c.activitySizes[type]:1);}
   if(!c.topic||total<1||total>20||totalQuestions>80)throw Error('Indica el tema y selecciona hasta 20 actividades, con un máximo de 80 preguntas.');
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
 editActivity=function(source){originalEdit(source);source.activity.questions.forEach((q,i)=>{if(q.type==='multigaps'){$('q-'+i).maxLength=12000;$('q-'+i).rows=8;const hint=$('q-'+i).nextElementSibling;if(hint?.classList.contains('play-editor-hint'))hint.textContent='Texto coherente con entre 2 y 20 huecos ___. Una solución por línea, en el mismo orden.';}if(q.type==='reading')$('text-'+i).maxLength=12000;$('a-'+i).maxLength=2500;if(q.activityGroup){const label=document.createElement('p');label.className='generator-help';label.textContent='Actividad '+q.activityGroup+' · '+activityLabels[q.type];$('q-'+i).closest('.block').prepend(label);}});
  const label=$('form').querySelector('.exercise-jump>span');if(label)label.firstChild.textContent='Pregunta ';
  const update=()=>{const current=Number($('dialog').dataset.editorStep||0),q=source.activity.questions[current];if(q?.activityGroup){const subtitle=$('form').querySelector('.studio-subtitle');subtitle.textContent='Actividad '+q.activityGroup+' · '+activityLabels[q.type]+' · Edita una pregunta cada vez. El material conserva todas sus preguntas.';}if(['gaps','multigaps'].includes(q?.type))$('editorPreview').querySelector('.preview-exercise>p')?.remove();};
  const syncReading=event=>{const match=event.target.id?.match(/^text-(\d+)$/);if(!match)return;const changed=source.activity.questions[Number(match[1])];if(changed?.type!=='reading'||!changed.activityGroup)return;source.activity.questions.forEach((q,i)=>{if(q.type==='reading'&&q.activityGroup===changed.activityGroup)$('text-'+i).value=event.target.value;});};
  source.activity.questions.forEach((q,i)=>{if(q.type==='reading'&&q.activityGroup){const hint=document.createElement('p');hint.className='generator-help';hint.textContent='Este texto se comparte con todas las preguntas de esta actividad. Al editarlo, se actualiza en todas.';$('text-'+i).after(hint);}});
  $('form').addEventListener('input',syncReading);
  $('dialog').addEventListener('close',()=>$('form').removeEventListener('input',syncReading),{once:true});
  const paintPreview=()=>profesorText.paint($('editorPreview'));
  const previewObserver=new MutationObserver(paintPreview);previewObserver.observe($('editorPreview'),{childList:true,subtree:true});paintPreview();
  $('dialog').addEventListener('close',()=>previewObserver.disconnect(),{once:true});
  $('form').addEventListener('input',update);
  $('form').addEventListener('editor:step',update);$('dialog').addEventListener('close',()=>{$('form').removeEventListener('editor:step',update);$('form').removeEventListener('input',update)},{once:true});update();
 };
})();
