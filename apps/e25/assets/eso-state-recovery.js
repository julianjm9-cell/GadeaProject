/* Pending study edits are private to an account and a tab, never auto-merged. */
(() => {
  'use strict';
  let prefix = '', key = '', version = 0;
  const token = crypto.randomUUID?.() || [...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('');
  function rows() {
    try {
      const found=[];
      for(const name of Object.keys(localStorage).filter(name=>name.startsWith(prefix))) {
        let row;try{row=JSON.parse(localStorage.getItem(name));}catch{}
        if(!row?.snapshot || !(row.at>Date.now()-7*86400000)){localStorage.removeItem(name);continue;}
        found.push({...row,key:name});
      }
      return found;
    } catch { return []; }
  }
  function capture(snapshot, etag) {
    if(!key)return null;
    const serial=++version;
    try {
      localStorage.setItem(key,JSON.stringify({at:Date.now(),serial,etag,snapshot:JSON.parse(snapshot)}));
      rows().sort((a,b)=>b.at-a.at).slice(5).forEach(row=>localStorage.removeItem(row.key));
      return serial;
    } catch { return null; }
  }
  function saved(serial, etag) { if(!key)return;try{if(serial===version)localStorage.removeItem(key);else {const row=JSON.parse(localStorage.getItem(key));if(row){row.etag=etag;localStorage.setItem(key,JSON.stringify(row));}}}catch{} }
  function init(account, etag, current) {
    if(!account)return;
    prefix='eso.pending.'+account+'.';key=prefix+token;
    const pending=rows().sort((a,b)=>b.at-a.at).find(row=>JSON.stringify(row.snapshot)!==JSON.stringify(current));
    if(!pending)return;
    showEsoSaveStatus('error','Hay cambios pendientes de una sesión anterior. Puedes recuperarlos o descargar una copia antes de continuar.');
    const node=document.getElementById('esoSaveStatus');
    const download=document.createElement('button');download.type='button';download.textContent='Descargar copia pendiente';
    download.onclick=()=>{const blob=new Blob([JSON.stringify(pending.snapshot,null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='eso-progreso-recuperable.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};node.append(download);
    if(pending.etag===etag){
      const recover=document.createElement('button');recover.type='button';recover.textContent='Recuperar cambios pendientes';
      recover.onclick=async()=>{if(!confirm('¿Recuperar los cambios pendientes de esta cuenta?'))return;try{await esoStateSaveQueue;await backend('/api/state');if(pending.etag!==esoStateETag){showEsoSaveStatus('error','El progreso guardado ha cambiado. Descarga la copia pendiente antes de revisar ambas versiones.');node.append(download);return;}state={...state,...pending.snapshot};render();if(await saveState())try{localStorage.removeItem(pending.key);}catch{}}catch{showEsoSaveStatus('error','No se ha podido comprobar la versión guardada. Tu copia pendiente se conserva.');node.append(download);}};node.append(recover);
    }else{const text=document.createElement('span');text.textContent='La versión del servidor ha cambiado. Conserva la copia para revisar ambos trabajos.';node.append(text);}
  }
  window.esoRecovery={init,capture,saved};
})();
