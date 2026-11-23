/* Local, tab-scoped administrative drafts. Passwords and provider keys are excluded. */
(() => {
  const prefix='terrace-management-draft:',ownerKey='terrace-management-owner';let restoring=false,loading=false,timer;
  const scope=new URLSearchParams(location.search),suffix=(scope.get('app')||'todas')+'/'+(scope.get('area')||'resumen');
  const owner=()=>sessionStorage.getItem(ownerKey)||'existing-session';
  const key=()=>prefix+owner()+':'+suffix;
  const read=()=>{try{return JSON.parse(sessionStorage.getItem(key()));}catch{return null;}};
  const write=data=>{try{sessionStorage.setItem(key(),JSON.stringify(data));}catch{}};
  function forget(){try{for(const name of Object.keys(sessionStorage))if(name.startsWith(prefix))sessionStorage.removeItem(name);sessionStorage.removeItem(ownerKey);}catch{}}
  function capture(event){
    if(restoring||!event.target.closest('form')||event.target.closest('#authScreen'))return;
    const form=event.target.closest('form');if(!form.id)return;
    const fields={};for(const input of form.querySelectorAll('input[id],textarea[id],select[id]')){
      if(['password','file','hidden','submit','button'].includes(input.type)||/password|secret|token|key/i.test(input.id)||input.readOnly||input.closest('[hidden]'))continue;
      fields[input.id]=input.type==='checkbox'?input.checked:input.value;
    }
    if(!Object.keys(fields).length)return;
    const previous=read(),data={form:form.id,fields,pending:true,at:Date.now(),selected:typeof selectedUserId==='string'?selectedUserId:'',aiDrafts:typeof aiDrafts==='object'?aiDrafts:undefined};
    if(previous?.form===data.form)data.fields={...previous.fields,...fields};write(data);
  }
  function show(){
    const banner=document.getElementById('management-recovery'),data=read(),page=document.getElementById('adminPage');
    if(banner)banner.hidden=!data?.pending||!page||page.hidden;
    const button=document.getElementById('management-recover-button');if(button)button.disabled=loading;
  }
  function restore(){
    const data=read();if(!data?.pending)return;
    restoring=true;
    try{
      if(data.form==='editUserForm'&&data.selected&&typeof openUser==='function')openUser(data.selected);
      if(data.form==='createUserForm'&&typeof toggleCreateUser==='function')toggleCreateUser(true);
      if(data.aiDrafts&&typeof aiDrafts==='object'){Object.assign(aiDrafts,data.aiDrafts);if(view==='ai')renderAI();}
      for(const [id,value]of Object.entries(data.fields)){
        const input=document.getElementById(id);if(!input||input.closest('form')?.id!==data.form||input.type==='password'||/password|secret|token|key/i.test(id))continue;
        if(input.type==='checkbox')input.checked=!!value;else input.value=value;
        input.dispatchEvent(new Event('input',{bubbles:true}));
      }
      const form=document.getElementById(data.form);if(form)form.scrollIntoView({block:'nearest'});
      const status=document.getElementById('management-recovery-status');status.textContent='Borrador recuperado. Revisa los datos antes de guardar. Las contraseñas no se conservan.';
    }finally{restoring=false;}
  }
  window.addEventListener('terrace-admin-login',event=>{const next=String(event.detail.identifier||'').trim().toLowerCase();if(owner()!==next)forget();try{sessionStorage.setItem(ownerKey,next);}catch{}});
  window.addEventListener('terrace-admin-forget-drafts',forget);
  window.addEventListener('terrace-admin-loading',event=>{loading=event.detail.loading;show();});
  window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===parent&&event.data?.type==='terrace-admin-forget-drafts')forget();});
  window.addEventListener('terrace-admin-request',event=>{
    const data=read();if(data&&event.detail.method!=='GET'){data.pending=!event.detail.ok;write(data);}
    clearTimeout(timer);timer=setTimeout(show,200);
  });
  document.addEventListener('input',capture);
  document.addEventListener('change',capture);
  document.addEventListener('DOMContentLoaded',()=>{
    if(!document.getElementById('adminPage'))return;
    const aiForm=document.getElementById('aiEditor')?.closest('form');if(aiForm)aiForm.id='managementAIForm';
    const banner=document.createElement('section');banner.id='management-recovery';banner.hidden=true;banner.className='notice';banner.style.margin='12px 20px';
    const text=document.createElement('p');text.id='management-recovery-status';text.textContent='Hay un borrador local sin guardar. Puedes recuperarlo y revisarlo.';
    const button=document.createElement('button');button.id='management-recover-button';button.type='button';button.textContent='Recuperar borrador';button.addEventListener('click',restore);
    const discard=document.createElement('button');discard.type='button';discard.textContent='Descartar borrador';discard.addEventListener('click',()=>{try{sessionStorage.removeItem(key());}catch{}show();});banner.append(text,button,discard);document.getElementById('adminPage').before(banner);
    new MutationObserver(show).observe(document.getElementById('adminPage'),{attributes:true,attributeFilter:['hidden']});show();
  });
})();
