/* Personalization is a view preference: never remove saved subjects or materials. */
(() => {
  const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim().replace(/\s+/g,' ');
  function unique(values){const seen=new Set();return values.filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim()).filter(value=>{const normalized=key(value);if(seen.has(normalized))return false;seen.add(normalized);return true;});}
  function selected(profile){return unique(Array.isArray(profile?.subjects)?profile.subjects:[]);}
  function allows(profile,value){const chosen=selected(profile);return !chosen.length||!String(value||'').trim()||chosen.some(subject=>key(subject)===key(value));}
  function choices(profile,values){return unique(values).filter(value=>allows(profile,value));}
  window.profesorSubjects={key,unique,selected,allows,choices};
})();
function teacherAllowsSubject(value){return window.profesorSubjects.allows(state.teacherProfile,value);}
function teacherSubjectChoices(values){return window.profesorSubjects.choices(state.teacherProfile,values);}
function teacherOfferedSubjects(){return window.profesorSubjects.selected(state.teacherProfile);}
function teacherStudentSubjects(pupil){return teacherSubjectChoices(pupil?.subjects||[]);}
function teacherMaterialVisible(material){return teacherAllowsSubject(material.subject||material.activity?.context?.subject||'');}
function teacherSubjectNotice(hiddenCount=0){const chosen=teacherOfferedSubjects();if(!chosen.length)return '';return `<div class="teacher-subject-notice"><span><strong>Tus asignaturas:</strong> ${chosen.map(esc).join(' · ')}${hiddenCount?`<small>${hiddenCount} ${hiddenCount===1?'material de otra asignatura sigue guardado':'materiales de otras asignaturas siguen guardados'}.</small>`:''}</span><button type="button" data-action="accountSettings" data-settings-panel="subjects">Cambiar asignaturas</button></div>`;}
function teacherResetSubjectFilters(){
  if(materialSubject&&!teacherAllowsSubject(materialSubject))materialSubject='';
  materialPage=0;
  materialQuery='';materialCourse='';materialType='';
  for(const filters of Object.values(materialFilterViews)){if(filters.subject&&!teacherAllowsSubject(filters.subject))filters.subject='';filters.page=0;filters.query='';filters.course='';filters.type='';}
  if(subject&&!teacherAllowsSubject(subject))subject=teacherStudentSubjects(student(selected))[0]||teacherOfferedSubjects()[0]||'';
  if(temarioSubject&&!teacherAllowsSubject(temarioSubject)){temarioSubject=teacherOfferedSubjects()[0]||'Matemáticas';temarioSelected='';}
}
