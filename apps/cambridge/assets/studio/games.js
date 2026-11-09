/* Interactive foregrounds. The existing app owns answers, attempts and saved progress. */
(() => {
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const asset=name=>'/assets/cambridge-studio/'+name;
  const themes={
    editor:{name:'Mesa de edición',object:'Palabras recortadas',place:'Colocar en el artículo',verb:'Una línea lista para publicar',icon:'✎',steps:['Titular','Conexión','Texto final'],goal:'Artículo publicado',hint:'Elige una palabra y colócala en el hueco del periódico.'},
    archive:{name:'Archivo de investigación',object:'Posibles pruebas',place:'Archivar esta prueba',verb:'Una prueba verificada',icon:'⌕',steps:['Biblioteca','Entradas','El taller'],goal:'Caso resuelto',hint:'Elige una carpeta y llévala al expediente para comprobar su prueba.'},
    machine:{name:'Máquina de significado',object:'Tu reformulación',place:'Activar la máquina',verb:'Una transformación completada',icon:'⚙',steps:['El recuerdo','La obligación','El libro'],goal:'Máquina calibrada',hint:'Escribe la expresión que falta y acciona la palanca. También puedes pulsar Intro.'},
    opencloze:{name:'El puente de las palabras',object:'Tablas para el puente',place:'Reparar el paso',verb:'Un tramo del puente reparado',icon:'⌁',steps:['Punto de partida','Duración','Destino'],goal:'¡Al otro lado!',hint:'Elige una tabla y colócala en el hueco del puente. También puedes arrastrarla.'},
    forge:{name:'Forja de palabras',object:'Moldes de palabra',place:'Accionar la forja',verb:'Una palabra forjada',icon:'✦',steps:['El plan','La discusión','Las instrucciones'],goal:'Colección forjada',hint:'Elige un molde, colócalo en el yunque y comprueba la transformación.'},
    mailroom:{name:'Correo en marcha',object:'Frases para tu mensaje',place:'Sellar y enviar',verb:'Un mensaje entregado',icon:'✉',steps:['Información','Recomendación','Una visita'],goal:'Todas las entregas hechas',hint:'Elige una frase y colócala en el sobre antes de enviarlo.'},
    'c1-research':{name:'La oficina de investigación',object:'Notas para el informe',place:'Incorporar al expediente',verb:'Una nota respaldada por las pruebas',icon:'⌕',steps:['Observación','La muestra','Cautela','Propuesta','Evaluación'],goal:'Informe listo para el comité',hint:'Contrasta el dossier y coloca la nota que puedes defender en el informe.'},
    'c1-debate':{name:'Una decisión compartida',object:'Tus posibles intervenciones',place:'Tomar la palabra',verb:'Un paso hacia el acuerdo',icon:'◉',steps:['Escuchar','Contrastar','Matizar','Acordar','Cerrar'],goal:'Acuerdo alcanzado',hint:'Elige tu intervención y llévala a tu turno de palabra en la mesa.'},
    'c2-observatory':{name:'Observatorio de pruebas',object:'Afirmaciones bajo la lupa',place:'Fijar la observación',verb:'Una observación contrastada',icon:'◎',steps:['Dossier A','Dossier B','Dossier C','Síntesis','Decisión'],goal:'Registro editorial completo',hint:'Orienta el observatorio hacia una afirmación y fíjala en el registro.'},
    'c2-press':{name:'Imprenta de precisión',object:'Planchas de impresión',place:'Imprimir la prueba',verb:'Una prueba lista para publicar',icon:'▤',steps:['Precisión','Estructura','Alcance','Matiz','Publicación'],goal:'Edición terminada',hint:'Elige una plancha y colócala en la prensa para imprimir una frase defendible.'}
  };
  const sceneThemes = {
    evidence:{name:'Mesa de investigación',object:'Tarjetas de evidencia',place:'Archivar decisión',verb:'Una decisión contrastada',icon:'⌕',goal:'Expediente completo',hint:'Lee la pista y archiva la tarjeta que puedes defender.'},
    editorial:{name:'Cabina de edición',object:'Versiones candidatas',place:'Aprobar para publicar',verb:'Una prueba lista para publicar',icon:'✎',goal:'Edición aprobada',hint:'Compara las versiones y aprueba la que conserve el significado.'},
    dispatch:{name:'Puesto de comunicación',object:'Mensajes posibles',place:'Transmitir mensaje',verb:'Mensaje transmitido',icon:'↗',goal:'Comunicaciones completadas',hint:'Elige tu mensaje y transmítelo desde la consola.'}
  };
  function themeFor(game) {
    const scene = sceneThemes[game.scene?.kind];
    return scene ? {...scene,steps:game.stages.map(stage => stage.label)} : themes[game.id];
  }
  let active=null;
  const board=()=>document.querySelector('#b2GameBoard .mission-board');
  const feedback=text=>{const node=document.getElementById('b2GameFeedback');if(node)node.textContent=text;};
  function wordSlot(label='Colocar aquí'){
    return `<button class="mission-slot" type="button" data-mission-place aria-label="${escape(label)}" aria-disabled="true"><span class="mission-slot-prompt" data-mission-placeholder>${escape(label)}</span><span class="mission-slot-plus" aria-hidden="true">+</span></button>`;
  }
  function progress(game,index,solved,theme){
    return `<ol class="mission-route" aria-label="Avance de la misión">${game.stages.map((_,i)=>`<li class="${i<index||i===index&&solved?'complete':i===index?'current':''}" ${i===index?'aria-current="step"':''}><span>${i<index||i===index&&solved?'✓':i+1}</span><small>${escape(theme.steps[i]||'Etapa '+(i+1))}</small></li>`).join('')}</ol>`;
  }
  function prior(game,index){
    if(!index)return '<span class="mission-dossier-empty">Tu expediente se irá completando con cada acierto.</span>';
    return game.stages.slice(0,index).map((stage,i)=>`<span class="mission-filed-note"><b>✓ ${i+1}</b>${escape(stage.options?stage.options[stage.correct]:stage.answers[0])}</span>`).join('');
  }
  function sentence(text){
    return text.includes('___')?escape(text).replace('___',wordSlot('Colocar la palabra')):escape(text);
  }
  function choices(game,index){
    const options=game.stages[index].options;
    if(!options)return '';
    const order=Array.from({length:options.length},(_,i)=>(i+index+1)%options.length);
    const type={editor:'word',opencloze:'plank',forge:'mould',mailroom:'letter',archive:'folder','c1-research':'note','c1-debate':'speech','c2-observatory':'observation','c2-press':'plate'}[game.id] || game.scene?.kind || 'word';
    return `<div class="mission-hand" role="group" aria-label="${escape(themeFor(game).object)}">${order.map(i=>`<button class="mission-piece mission-piece-${type} b2-scene-option" type="button" draggable="true" data-mission-choice="${i}" data-answer-index="${i}" aria-pressed="false"><span class="mission-piece-mark" aria-hidden="true">${String.fromCharCode(65+i)}</span><span>${escape(options[i])}</span><span class="mission-piece-grip" aria-hidden="true">⠿</span></button>`).join('')}</div>`;
  }
  function scenario(game,index,theme) {
    const stage = game.stages[index];
    const tabs = game.stages.map((item,i) => `<li class="${i < index ? 'filed' : i === index ? 'current' : ''}"><span aria-hidden="true">${i < index ? '✓' : String(i+1).padStart(2,'0')}</span>${escape(item.label)}</li>`).join('');
    return `<section class="mission-scenario" data-scene="${escape(game.scene.kind)}">
      <article class="mission-scenario-card">
        <small>${escape(stage.label)}</small><p>${escape(stage.text)}</p>
      </article>
      <div class="mission-scenario-console">
        <div class="mission-scenario-title"><span aria-hidden="true">${theme.icon}</span><strong>${escape(theme.name)}</strong><span data-mission-stamp>EN CURSO</span></div>
        ${wordSlot(theme.place)}
        <ol class="mission-scenario-files" aria-label="Registro de la misión">${tabs}</ol>
      </div>
    </section>`;
  }
  function objects(game,index){
    const stage=game.stages[index],t=themeFor(game);
    if(game.scene)return scenario(game,index,t);
    if(game.id==='editor')return `<article class="mission-newspaper"><div class="mission-masthead"><span>THE DAILY WORD</span><small>ENGLISH EDITION · ${index+1}/${game.stages.length}</small></div><div class="mission-paper-rule"></div><span class="mission-paper-label">TU PRÓXIMA LÍNEA</span><p class="mission-article-sentence">${sentence(stage.text)}</p><div class="mission-news-lines" aria-hidden="true"></div><div class="mission-paper-footer"><span>Desk copy</span><span class="mission-stamp" data-mission-stamp>EN EDICIÓN</span></div></article>`;
    if(game.id==='opencloze')return `<div class="mission-bridge-world"><div class="mission-travel-sign"><span>EL SIGUIENTE PASO</span><p>${escape(stage.text)}</p></div><div class="mission-river" aria-hidden="true"></div><div class="mission-bridge"><div class="mission-bridge-rail" aria-hidden="true"></div><span class="mission-bridge-planks" aria-hidden="true"></span>${wordSlot('Colocar la tabla')}<span class="mission-bridge-planks" aria-hidden="true"></span><div class="mission-guide" style="--stop:${15+index*27}%"><img src="${asset('guide-v1.webp')}" alt="El guía avanza por el puente con cada acierto" width="100" height="110"></div><span class="mission-finish-flag" aria-hidden="true">⚑</span></div><div class="mission-bridge-caption" data-mission-effect>Repara el paso para continuar la ruta.</div></div>`;
    if(game.id==='forge'){
      const root=stage.text.match(/\(([^)]+)\)/)?.[1]||'WORD';
      return `<div class="mission-forge"><div class="mission-source-note"><small>LA FRASE DEL ENCARGO</small><p>${escape(stage.text)}</p></div><div class="mission-forge-body"><div class="mission-furnace" aria-hidden="true"><div class="mission-fire">✦</div></div><div class="mission-anvil"><span class="mission-root">BASE · ${escape(root)}</span>${wordSlot('Colocar el molde')}<div class="mission-anvil-base" aria-hidden="true"></div></div><div class="mission-hammer" aria-hidden="true"><i></i></div></div><div class="mission-object-caption" data-mission-effect>Elige la forma que encaja con la frase.</div></div>`;
    }
    if(game.id==='machine')return `<div class="mission-machine"><div class="mission-machine-lamps" aria-hidden="true"><i></i><i></i><i></i></div><div class="mission-machine-display"><small>CONSERVA EL SIGNIFICADO</small><p>${escape(stage.text)}</p></div><div class="mission-machine-flow"><span class="mission-gear" aria-hidden="true">⚙</span><div><label for="b2TypedAnswer">Tu expresión · incluye la palabra clave</label><input id="b2TypedAnswer" class="b2-answer" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="missionTypedHelp"><small id="missionTypedHelp">Entre 2 y 5 palabras. Después, acciona la palanca.</small></div><button type="button" class="mission-lever" data-mission-submit aria-label="Activar la máquina"><i aria-hidden="true"></i><span>Activar</span></button></div><div class="mission-output"><span data-mission-effect>Esperando una reformulación…</span></div></div>`;
    if(game.id==='mailroom'){
      const recipient=['Course office','Library director','A friend'][index];
      return `<div class="mission-mailroom"><div class="mission-source-note"><small>EL ENCARGO</small><p>${escape(stage.text)}</p></div><div class="mission-mail-desk"><article class="mission-envelope"><div class="mission-envelope-head"><small>PARA: <b>${recipient}</b></small><span class="mission-postage" aria-hidden="true">EN<br>✦</span></div>${wordSlot('Colocar la frase en el sobre')}<span class="mission-envelope-seal" data-mission-stamp>SIN ENVIAR</span></article><div class="mission-postbox" aria-hidden="true"><span>POST</span><i></i><small>${index}/${game.stages.length}<br>ENTREGAS</small></div></div><div class="mission-object-caption" data-mission-effect>Tu mensaje necesita el propósito y el tono adecuados.</div></div>`;
    }
    if(game.id==='c1-debate')return `<div class="mission-debate"><div class="mission-partner"><span class="mission-speaker-avatar" aria-hidden="true">P</span><div><small>TU COMPAÑERO · TURNO ${index+1}</small><p>${escape(stage.text)}</p></div></div><div class="mission-round-table"><span class="mission-table-badge" aria-hidden="true">ROUND TABLE</span><div class="mission-your-seat"><small>TU TURNO</small>${wordSlot('Colocar tu intervención')}</div><span class="mission-seat mission-seat-left" aria-hidden="true"></span><span class="mission-seat mission-seat-right" aria-hidden="true"></span></div><div class="mission-object-caption" data-mission-effect>Escucha, contrasta y construye un acuerdo.</div></div>`;
    if(game.id==='c2-observatory')return `<div class="mission-observatory"><div class="mission-source-note"><small>EN EL CAMPO DE OBSERVACIÓN</small><p>${escape(stage.text)}</p></div><div class="mission-observation-deck"><div class="mission-telescope" aria-hidden="true"><i></i><b></b><span></span></div><div class="mission-observation-log"><small>REGISTRO EDITORIAL · ${index+1}</small>${wordSlot('Fijar una afirmación en el registro')}</div></div><div class="mission-stars" aria-label="${index} observaciones registradas">${game.stages.map((_,i)=>`<span class="${i<index?'lit':''}" aria-hidden="true">✦</span>`).join('')}</div><div class="mission-object-caption" data-mission-effect>Orienta la lente hacia una afirmación que las fuentes sostengan.</div></div>`;
    if(game.id==='c2-press')return `<div class="mission-printroom"><div class="mission-source-note"><small>ORDEN DE EDICIÓN · PRUEBA ${index+1}</small><p>${escape(stage.text)}</p></div><div class="mission-printing-press"><div class="mission-press-crossbar" aria-hidden="true"><span>PRECISION PRESS</span></div><div class="mission-press-roller" aria-hidden="true"></div><div class="mission-press-bed">${wordSlot('Colocar la plancha')}</div><div class="mission-printed-sheet"><small>PRUEBA DE IMPRENTA</small><span data-mission-effect>La frase se imprimirá aquí.</span></div><span class="mission-press-wheel" aria-hidden="true">✣</span></div></div>`;
    return `<div class="mission-casework"><div class="mission-case-tabs" aria-hidden="true">${t.steps.map((label,i)=>`<span class="${i===index?'current':i<index?'filed':''}">${escape(label)}</span>`).join('')}</div><article class="mission-evidence-sheet"><span class="mission-pin" aria-hidden="true"></span><small>${game.id==='archive'?'LA PISTA':'DOCUMENTO DEL EXPEDIENTE'}</small><p>${escape(stage.text)}</p></article><div class="mission-dossier"><div class="mission-dossier-tab">${game.id==='archive'?'PRUEBAS DEL CASO':'INFORME PARA EL COMITÉ'}</div>${wordSlot('Colocar la nota en el expediente')}<div class="mission-filed-notes">${prior(game,index)}</div></div><div class="mission-object-caption" data-mission-effect>El expediente acepta únicamente notas respaldadas por el texto.</div></div>`;
  }
  function render(game,index,run){
    const theme=themeFor(game);if(!theme)return null;
    const solved=run.solvedStage===index;
    active={game,index,selected:null,solved};
    const backdrop=game.scene ? asset(game.scene.art) : game.id==='opencloze'?asset('bridge-world-v1.webp'):game.id==='editor'?asset('academy-v2.webp'):null;
    return `<section class="b2-panel mission-panel"><div class="mission-toolbar"><button type="button" data-mission-exit>← Recorrido</button><span>${escape(game.level||'B2 First')} · ${escape(game.skill)}</span><button type="button" data-mission-restart>Reiniciar</button></div><div class="mission-heading"><div><small>${escape(theme.name)}</small><h2 id="englishMissionTitle" tabindex="-1">${escape(game.title)}</h2></div><span class="mission-stage-count">${index+1}<small>/${game.stages.length}</small></span></div>${progress(game,index,solved,theme)}<div class="b2-board mission-board" data-kind="${game.id}" data-status="${solved?'solved':'waiting'}" ${backdrop?`style="--mission-backdrop:url('${backdrop}')"`:''}><div class="mission-atmosphere" aria-hidden="true"></div><div class="mission-workspace">${objects(game,index)}</div><div class="mission-bank"><div class="mission-bank-label"><span>${escape(theme.object)}</span><small>${game.stages[index].options?'ELIGE Y COLOCA':'ESCRIBE Y ACTIVA'}</small></div>${choices(game,index)}<p class="mission-instructions">${escape(theme.hint)}</p></div><div class="mission-celebration" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span></div></div><div class="mission-bottom"><div class="b2-feedback" id="b2GameFeedback" role="status">${solved?'¡Correcto! '+escape(game.stages[index].why):escape(theme.hint)}</div><div id="b2GameNext">${solved?nextButton(game,index):''}</div></div></section>`;
  }
  const nextButton=(game,index)=>`<button type="button" onclick="nextB2GameStage()">${index+1===game.stages.length?'Terminar partida':'Siguiente etapa →'}</button>`;
  function choose(index){
    if(!active||active.solved||!Number.isInteger(index)||!active.game.stages[active.index].options?.[index])return;
    active.selected=index;
    const root=board();if(!root)return;
    root.dataset.status='selected';root.style.setProperty('--look-angle',(index-1)*15+'deg');
    root.querySelectorAll('[data-mission-choice]').forEach(button=>{const selected=Number(button.dataset.missionChoice)===index;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
    root.querySelectorAll('[data-mission-placeholder]').forEach(node=>node.textContent=active.game.stages[active.index].options[index]);
    root.querySelectorAll('[data-mission-place]').forEach(node=>node.setAttribute('aria-disabled','false'));
    feedback('Pieza elegida. '+themeFor(active.game).place+' para comprobarla.');
  }
  function commit(){
    if(!active||active.solved)return;
    if(active.selected===null){feedback('Primero elige una pieza. Después, toca su destino en la escena.');return;}
    window.answerB2Game(active.selected);
  }
  function result(correct,index){
    if(!active)return;
    const root=board();if(!root)return;
    active.solved=correct;
    root.dataset.status=correct?'solved':'retry';
    if(!correct){
      active.selected=null;
      root.querySelectorAll('[data-mission-place]').forEach(node=>{
        node.setAttribute('aria-disabled','true');
        node.querySelector('[data-mission-placeholder]').textContent=node.getAttribute('aria-label');
      });
      root.querySelectorAll('[data-mission-choice]').forEach(node=>{
        node.classList.remove('selected');
        node.setAttribute('aria-pressed','false');
      });
    }
    if(correct){
      const stage=active.game.stages[active.index];
      root.querySelectorAll('[data-mission-placeholder]').forEach(node=>node.textContent=stage.options?stage.options[index]:stage.answers[0]);
      root.querySelectorAll('[data-mission-place],[data-mission-submit]').forEach(node=>node.disabled=true);
      root.querySelectorAll('[data-mission-choice]').forEach(node=>node.draggable=false);
      root.querySelectorAll('[data-mission-stamp]').forEach(node=>node.textContent='✓ VERIFICADO');
      const effect=root.querySelector('[data-mission-effect]');
      if(effect)effect.textContent=active.game.id==='machine'?stage.answers[0]:active.game.id==='c2-press'?stage.options[index]:themeFor(active.game).verb;
      const current=document.querySelector('.mission-route .current');if(current){current.classList.add('complete');current.querySelector('span').textContent='✓';}
      const file=root.querySelector('.mission-scenario-files .current');
      if(file){file.classList.replace('current','filed');file.querySelector('span').textContent='✓';}
      const stars=root.querySelector('.mission-stars');if(stars){stars.setAttribute('aria-label',`${active.index+1} observaciones registradas`);stars.querySelectorAll('span').forEach((node,i)=>node.classList.toggle('lit',i<=active.index));}
    }
  }
  function restored(game,index){if(active?.solved)result(true,game.stages[index].correct);}
  function complete(game,mistakes){
    const theme=themeFor(game);active=null;
    return `<div class="mission-finale"><div class="mission-finale-medal" aria-hidden="true">${theme.icon}</div><span>MISIÓN COMPLETADA</span><h2>${escape(theme.goal)}</h2><p>Has resuelto las ${game.stages.length} etapas de <strong>${escape(game.title)}</strong>.</p><div class="mission-finale-collection">${theme.steps.map(label=>`<span>✓ ${escape(label)}</span>`).join('')}</div><p>${mistakes?`${mistakes} ${mistakes===1?'intento para revisar':'intentos para revisar'}: consulta las explicaciones antes de volver a jugar.`:'¡Todas las decisiones acertadas a la primera!'}</p></div>`;
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-mission-exit]'))return window.closeEnglishGame();
    if(event.target.closest('[data-mission-restart]'))return window.restartB2Game();
    const piece=event.target.closest('[data-mission-choice]');if(piece)return choose(Number(piece.dataset.missionChoice));
    if(event.target.closest('[data-mission-place]'))return commit();
    if(event.target.closest('[data-mission-submit]'))return window.answerB2Game();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.id==='b2TypedAnswer'){event.preventDefault();window.answerB2Game();}});
  document.addEventListener('dragstart',event=>{
    const piece=event.target.closest('[data-mission-choice]');if(!piece||!active||active.solved)return;
    const index=Number(piece.dataset.missionChoice);choose(index);
    event.dataTransfer.setData('text/plain',JSON.stringify({game:active.game.id,stage:active.index,index}));event.dataTransfer.effectAllowed='move';
  });
  document.addEventListener('dragover',event=>{if(event.target.closest('[data-mission-place]')){event.preventDefault();event.dataTransfer.dropEffect='move';}});
  document.addEventListener('drop',event=>{
    if(!event.target.closest('[data-mission-place]')||!active||active.solved)return;event.preventDefault();
    try{const value=JSON.parse(event.dataTransfer.getData('text/plain'));if(value.game!==active.game.id||value.stage!==active.index)return;choose(value.index);if(active.selected===value.index)commit();}catch{}
  });
  window.EnglishMissionBoards={render,result,restored,complete,themes};
})();
