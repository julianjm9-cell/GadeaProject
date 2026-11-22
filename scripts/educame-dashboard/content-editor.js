const $=id=>document.getElementById(id);
const names={temario:'Temario',juegos:'Juegos',interfaz:'Interfaz',landing:'Landing'};
const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
export function setupContentEditor({api,feedback}){
  const app=$('content-app'),kind=$('content-kind'),search=$('content-search'),results=$('content-results'),dialog=$('content-dialog'),fields=$('content-fields'),note=$('content-note');
  let generation=0,selectionGeneration=0,selected,values={},revision=0,saving=Promise.resolve(),timer,searchTimer,blocked=false,requestId,submitting=false;
  const key=id=>'terrace-content-draft:'+id;
  const error=message=>{const host=$('content-error');host.textContent=message||'';host.hidden=!message;};
  function localSave(){if(!selected)return;try{localStorage.setItem(key(selected.id),JSON.stringify({version:selected.version,values,note:note.value,requestId}));}catch{} }
  function changed(){return selected?.fields.filter(f=>Object.hasOwn(values,f.id)&&values[f.id]!==f.value)||[];}
  function controls(){ $('content-submit').disabled=submitting||blocked||!changed().length;$('content-request').disabled=submitting||blocked||!note.value.trim(); }
  function draft(){
    clearTimeout(timer);localSave();controls();
    const entry=selected;if(!entry||blocked)return saving;
    const snapshot={id:entry.id,version:entry.version,values:{...values},note:note.value};
    saving=saving.catch(()=>{}).then(async()=>{
      if(selected!==entry||blocked)return;
      $('content-draft-status').textContent='Guardando borrador…';
      try{const data=await api('/api/content/draft','PUT',{...snapshot,revision});if(selected===entry){revision=data.revision;$('content-draft-status').textContent='Borrador guardado en LA TERRAZA.';}}
      catch(problem){if(selected===entry){if(problem.status===409)blocked=true;error(problem.message);$('content-draft-status').textContent='El borrador sigue conservado en este navegador.';controls();}}
    });return saving;
  }
  function schedule(){requestId=undefined;localSave();controls();clearTimeout(timer);timer=setTimeout(draft,550);}
  async function load(fresh=false){
    const current=++generation;$('content-status').textContent='Buscando en el contenido de tus apps…';
    try{
      const data=await api('/api/content/catalog?'+new URLSearchParams({app:app.value,kind:kind.value,q:search.value,...(fresh?{refresh:'1'}:{})}));
      if(current!==generation)return;
      const chosen=app.value;app.replaceChildren(new Option('Todas las apps',''),...data.apps.map(row=>new Option(row.name+' · '+row.count,row.id)));app.value=chosen;
      $('content-live').hidden=app.value!=='gadeos';
      $('content-status').textContent=data.total+' piezas'+(data.total>data.items.length?' · Mostrando '+data.items.length+'. Usa la búsqueda para encontrar el resto.':'. Selecciona una para revisar sus campos.');
      results.replaceChildren();
      for(const item of data.items){
        const card=node('button',undefined,'content-card');card.type='button';card.dataset.contentId=item.id;
        const meta=node('span',undefined,'content-meta');meta.append(node('span',data.apps.find(a=>a.id===item.app)?.name||item.app),node('span',names[item.category]));
        card.append(meta,node('strong',item.title),node('span',item.preview,'content-preview'),node('span',item.fields+' campos · Revisar →','content-card-action'));card.addEventListener('click',()=>open(item.id));results.append(card);
      }
      if(!data.items.length)results.append(node('p','No hay coincidencias. Prueba con otra palabra o con Todo.','card'));
      const issues=$('content-issues');issues.hidden=!data.issues.length;issues.querySelector('div').replaceChildren(...data.issues.map(row=>node('p',row.file+' · '+row.message)));
    }catch(problem){if(current===generation)$('content-status').textContent=problem.message;}
  }
  async function open(id){
    const selection=++selectionGeneration;
    if(dialog.open)await draft();
    selected=undefined;fields.replaceChildren(node('p','Abriendo contenido…'));error('');$('content-item-title').textContent='Contenido';if(!dialog.open)dialog.showModal();
    try{
      const entry=await api('/api/content/item?id='+encodeURIComponent(id));
      if(!dialog.open||selection!==selectionGeneration)return;
      selected=entry;revision=entry.draft.revision;blocked=false;requestId=undefined;
      let restored;try{restored=JSON.parse(localStorage.getItem(key(id)));}catch{}
      const draftData=restored||entry.draft;values={...draftData.values};note.value=draftData.note||'';requestId=draftData.requestId;
      $('content-item-title').textContent=entry.title;$('content-item-app').textContent=entry.appName+' · '+names[entry.category];$('content-source').textContent=entry.file;
      const parent=$('content-parent');parent.replaceChildren();if(entry.parent){const back=node('button','← '+entry.parent.title,'button secondary');back.type='button';back.addEventListener('click',()=>open(entry.parent.id));parent.append(back);}
      const children=$('content-children');children.hidden=!entry.children.length;children.querySelector('div').replaceChildren(...entry.children.map(child=>{const link=node('button',child.title+' →','button secondary');link.type='button';link.addEventListener('click',()=>open(child.id));return link;}));
      fields.replaceChildren();
      for(const field of entry.fields){
        const wrapper=node('label',undefined,'content-field'),caption=node('span',field.label);wrapper.append(caption);
        let input;
        if(field.choices){input=node('select');for(const option of field.choices)input.append(new Option(values[option.fieldId]??option.label,String(option.value)));input.value=String(values[field.id]??field.value);}
        else if(typeof field.value==='boolean'){input=node('select');input.append(new Option('Sí','true'),new Option('No','false'));input.value=String(values[field.id]??field.value);}
        else if(typeof field.value==='number'){input=node('input');input.type='number';input.value=String(values[field.id]??field.value);input.step='any';}
        else{input=node('textarea');input.value=values[field.id]??field.value;input.rows=field.value.length>250?6:field.value.length>90?3:2;input.maxLength=30000;}
        input.dataset.contentField=field.id;
        input.setAttribute('aria-label',field.label);
        input.addEventListener('input',()=>{
          values[field.id]=typeof field.value==='number'?Number(input.value):typeof field.value==='boolean'?input.value==='true':input.value;
          for(const choiceField of selected.fields.filter(f=>f.choices)){
            const select=fields.querySelector('[data-content-field="'+choiceField.id+'"]');
            choiceField.choices.forEach((option,index)=>{if(select?.options[index])select.options[index].textContent=values[option.fieldId]??option.label;});
          }
          schedule();
        });
        wrapper.append(input);
        const original=node('details',undefined,'content-original');original.append(node('summary','Ver texto actual'),node('p',String(field.choices?.find(o=>o.value===field.value)?.label??field.value)));wrapper.append(original);fields.append(wrapper);
      }
      $('content-draft-status').textContent=draftData.version&&draftData.version!==entry.version?'Hay un borrador de una versión anterior. Compara cada campo con «Ver texto actual» antes de aplicarlo.':'Puedes editar los campos. El borrador se guarda automáticamente.';
      controls();
    }catch(problem){error(problem.message);}
  }
  async function submit(improvement=false){
    if(submitting||!selected||blocked)return;error('');await draft();if(blocked)return;
    if(improvement&&changed().length){error('Aplica primero las correcciones de los campos. Después puedes encargar una mejora sobre la nueva versión.');return;}
    submitting=true;controls();requestId ||= crypto.randomUUID();localSave();
    let engine='codex',model;try{engine=localStorage.getItem('terrace-chat-provider')||'codex';model=localStorage.getItem('terrace-chat-model-'+engine)||(engine==='codex'?localStorage.getItem('terrace-chat-model'):undefined)||undefined;}catch{}
    try{
      await api('/api/content/submit','POST',{id:selected.id,version:selected.version,values:improvement?{}:values,note:improvement?note.value:'',requestId,engine,...(model?{model}:{})});
      localStorage.removeItem(key(selected.id));
      // Retire this draft only if it is still ours; newer tabs must keep their changes.
      await api('/api/content/draft','PUT',{id:selected.id,version:selected.version,revision,values:{},note:''}).catch(()=>{});
      selected=undefined;dialog.close();feedback('Corrección guardada en Encargos. Puedes seguir editando otras piezas.');location.hash='chat';
    }catch(problem){error(problem.message);localSave();}
    finally{submitting=false;controls();}
  }
  $('content-close').addEventListener('click',async()=>{await draft();dialog.close();});
  dialog.addEventListener('cancel',()=>{void draft();});
  dialog.addEventListener('close',()=>{clearTimeout(timer);selected=undefined;selectionGeneration++;});
  $('content-submit').addEventListener('click',()=>submit(false));$('content-request').addEventListener('click',()=>submit(true));note.addEventListener('input',schedule);
  $('content-refresh').addEventListener('click',()=>load(true));app.addEventListener('change',()=>load());kind.addEventListener('change',()=>load());search.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(load,250);});
  $('content-live').addEventListener('click',()=>window.dispatchEvent(new Event('terrace-content-live')));
  window.addEventListener('terrace-content-app',event=>{if(![...app.options].some(o=>o.value===event.detail.app))app.add(new Option(event.detail.app,event.detail.app));app.value=event.detail.app;search.value='';kind.value='';void load();});
  window.addEventListener('hashchange',()=>{if(location.hash==='#contenido')void load();});if(location.hash==='#contenido')void load();
}
