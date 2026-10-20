/* Shared piece builder: sentences and chronological timelines. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.profesorSentenceBoard = function(root, config) {
    const words = [...config.options], ids = [];
    const timeline=config.kind==='timeline';
    const datedTimeline=timeline&&!!config.label&&words.some(word=>config.label(word,false)!==word);
    const display=word=>config.label?config.label(word,reviewed):word;
    // Match occurrences, not just labels: repeated words are separate pieces.
    for (const value of config.values || []) {
      const id = words.findIndex((word,n) => word === value && !ids.includes(n));
      if (id >= 0) ids.push(id);
    }
    let reviewed = !!config.reviewed, pointer=null, suppressClick=false;
    const values = () => ids.map(id => words[id]);
    const full = () => ids.length === words.length;
    function changed(focus) {
      reviewed = false;
      draw(focus);
      config.onChange?.(values());
    }
    function place(id, target=ids.length) {
      if(config.locked || !Number.isInteger(id) || id<0 || id>=words.length)return;
      const from=ids.indexOf(id);
      if(from>=0)ids.splice(from,1);
      ids.splice(Math.max(0,Math.min(target,ids.length)),0,id);
      changed(ids.indexOf(id));
    }
    function draw(focus=null) {
      const used=new Set(ids), expected=config.expected;
      root.innerHTML=`<div class="sentence-board ${timeline?'timeline-board':''}"><div class="sentence-instruction"><span aria-hidden="true">✦</span><p>${timeline?datedTimeline?'Toca o arrastra cada acontecimiento. Las fechas aparecen al comprobar.':'Toca o arrastra las etapas de la primera a la última.':'Toca las piezas o arrástralas para construir la frase.'}</p></div><section class="sentence-bank" aria-label="${timeline?datedTimeline?'Acontecimientos disponibles':'Etapas disponibles':'Piezas disponibles'}"><div class="sentence-section-title">${timeline?datedTimeline?'Acontecimientos disponibles':'Etapas disponibles':'Piezas disponibles'} <span>${words.length-ids.length}</span></div><div class="sentence-pieces">${words.map((word,id)=>`<button type="button" class="sentence-piece tone-${id%5}" data-sentence-piece="${id}" draggable="false" aria-label="Añadir ${escape(display(word))}" ${config.locked||used.has(id)?'disabled':''} ${used.has(id)?'hidden':''}>${timeline?'<span class="timeline-event-icon" aria-hidden="true">◷</span>':''}<span>${escape(display(word))}</span></button>`).join('')}${full()?'<span class="sentence-bank-complete">✓ '+(timeline?datedTimeline?'Todos los acontecimientos colocados':'Todas las etapas colocadas':'Todas las piezas colocadas')+'</span>':''}</div></section><section class="sentence-answer" aria-label="${timeline?'Tu línea temporal':'Tu frase'}"><div class="sentence-section-title">${timeline?'Tu línea temporal':'Tu frase'} <small>Retira una pieza tocándola · Reordena con ← y →</small></div>${timeline?datedTimeline?'<div class="timeline-direction"><span>Más antiguo</span><span>Más reciente →</span></div>':'<div class="timeline-direction"><span>Primero</span><span>Después →</span></div>':''}<div class="sentence-slots">${words.map((_,position)=>{const id=ids[position],filled=id!==undefined,right=expected&&filled&&words[id]===expected[position];return `<button type="button" class="sentence-slot ${filled?'filled':''} ${reviewed&&filled?(expected?right?'answer-right':'answer-wrong':config.partResults?.[String(position)]==='incorrect'?'answer-wrong':config.partResults?.[String(position)]==='correct'||config.result==='correct'?'answer-right':''):''}" data-sentence-slot="${position}" data-sequence-row="${position}" ${filled?`data-sentence-piece="${id}"`:''} draggable="false" aria-label="${filled?'Retirar '+escape(display(words[id]))+' de la posición '+(position+1):'Hueco '+(position+1)}" ${config.locked?'disabled':''}><span class="sentence-slot-number" aria-hidden="true">${position+1}</span>${filled?`<span>${escape(display(words[id]))}</span><span class="sentence-remove" aria-hidden="true">×</span>`:'<span class="sentence-empty" aria-hidden="true">···</span>'}</button>`}).join('')}</div></section><div class="sentence-bottom"><p class="sentence-status" role="status">${ids.length} de ${words.length} ${timeline?datedTimeline?'acontecimientos colocados':'etapas colocadas':'piezas colocadas'}${full()?' · Ya puedes comprobar el orden.':''}</p>${config.locked?'':`<div class="sentence-actions"><button type="button" data-sentence-reset ${ids.length?'':'disabled'}>↻ Reiniciar</button><button type="button" class="primary" data-confirm-order ${full()?'':'disabled'}>✓ Comprobar</button></div>`}</div></div>`;
      if(focus!==null)root.querySelector(`[data-sentence-slot="${focus}"]`)?.focus({preventScroll:true});
    }
    root.onclick=event=>{
      if(suppressClick){suppressClick=false;return}
      if(config.locked)return;
      const button=event.target.closest('button');if(!button||button.disabled||!root.contains(button))return;
      if(button.hasAttribute('data-sentence-reset')){ids.length=0;changed();root.querySelector('[data-sentence-piece]:not([disabled])')?.focus({preventScroll:true});return}
      if(button.hasAttribute('data-confirm-order')){if(full())config.onCheck?.(values());return}
      if(button.hasAttribute('data-sentence-slot')){
        const pos=Number(button.dataset.sentenceSlot);
        if(pos<ids.length){const id=ids.splice(pos,1)[0];changed();root.querySelector(`.sentence-bank [data-sentence-piece="${id}"]`)?.focus({preventScroll:true});}
        else root.querySelector('.sentence-status').textContent=timeline?datedTimeline?'Toca un acontecimiento disponible para añadirlo a la línea temporal.':'Toca una etapa disponible para añadirla a la línea temporal.':'Toca una pieza disponible para añadirla a la frase.';
      } else if(button.hasAttribute('data-sentence-piece'))place(Number(button.dataset.sentencePiece));
    };
    root.onkeydown=event=>{
      if(config.locked||!['ArrowLeft','ArrowRight'].includes(event.key))return;
      const slot=event.target.closest('[data-sentence-slot]');if(!slot)return;
      const from=Number(slot.dataset.sentenceSlot),to=from+(event.key==='ArrowLeft'?-1:1);
      if(from>=ids.length||to<0||to>=ids.length)return;
      event.preventDefault();place(ids[from],to);
    };
    root.onpointerdown=event=>{
      suppressClick=false;
      const piece=event.target.closest('[data-sentence-piece]');
      if(config.locked||!piece||piece.disabled||event.button!==0)return;
      pointer={id:Number(piece.dataset.sentencePiece),x:event.clientX,y:event.clientY,moved:false};
    };
    root.onpointermove=event=>{
      if(!pointer)return;
      if(event.buttons!==1){pointer=null;root.classList.remove('sentence-dragging');return}
      if(Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>8){
        pointer.moved=true;root.setPointerCapture(event.pointerId);
        root.classList.add('sentence-dragging');
      }
    };
    root.onpointercancel=()=>{pointer=null;root.classList.remove('sentence-dragging')};
    root.onpointerup=event=>{
      const drag=pointer;pointer=null;root.classList.remove('sentence-dragging');
      if(!drag?.moved)return;
      suppressClick=true;
      const target=document.elementFromPoint(event.clientX,event.clientY);
      if(!target||!root.contains(target))return;
      const slot=target.closest('[data-sentence-slot]');
      if(slot)place(drag.id,Number(slot.dataset.sentenceSlot));
      else if(target.closest('.sentence-bank')){const from=ids.indexOf(drag.id);if(from>=0){ids.splice(from,1);changed();}}
      else if(target.closest('.sentence-answer'))place(drag.id);
    };
    draw();
    return {values};
  };
})();
