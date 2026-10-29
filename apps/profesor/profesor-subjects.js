/* Personalization is a view preference: never remove saved subjects or materials. */
(() => {
  const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim().replace(/\s+/g,' ');
  const courseKey=value=>key(value).replace(/[.·°ºª\s]/g,'');
  function unique(values){const seen=new Set();return values.filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim()).filter(value=>{const normalized=key(value);if(seen.has(normalized))return false;seen.add(normalized);return true;});}
  function uniqueCourses(values){const seen=new Set();return values.filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim()).filter(value=>{const normalized=courseKey(value);if(seen.has(normalized))return false;seen.add(normalized);return true;});}
  function selected(profile){return unique(Array.isArray(profile?.subjects)?profile.subjects:[]);}
  function allows(profile,value){const chosen=selected(profile);return !chosen.length||!String(value||'').trim()||chosen.some(subject=>key(subject)===key(value));}
  function choices(profile,values){return unique(values).filter(value=>allows(profile,value));}
  function selectedCourses(profile){return uniqueCourses(Array.isArray(profile?.courses)?profile.courses:[]);}
  function allowsCourse(profile,value){const chosen=selectedCourses(profile);return !chosen.length||!String(value||'').trim()||chosen.some(course=>courseKey(course)===courseKey(value));}
  function courseChoices(profile,values){return uniqueCourses(values).filter(value=>allowsCourse(profile,value));}
  window.profesorSubjects={key,courseKey,unique,uniqueCourses,selected,allows,choices,selectedCourses,allowsCourse,courseChoices};
})();
function teacherAllowsSubject(value){return window.profesorSubjects.allows(state.teacherProfile,value);}
function teacherAllowsCourse(value){return window.profesorSubjects.allowsCourse(state.teacherProfile,value);}
function teacherSubjectChoices(values){return window.profesorSubjects.choices(state.teacherProfile,values);}
function teacherCourseChoices(values){return window.profesorSubjects.courseChoices(state.teacherProfile,values);}
function teacherOfferedSubjects(){return window.profesorSubjects.selected(state.teacherProfile);}
function teacherOfferedCourses(){return window.profesorSubjects.selectedCourses(state.teacherProfile);}
function teacherStudentSubjects(pupil){return teacherSubjectChoices(pupil?.subjects||[]).filter(value=>teacherAllowsCourse(studentSubjectCourse(pupil,value)));}
function teacherStudentVisible(pupil){return teacherStudentSubjects(pupil).length>0;}
function teacherMaterialVisible(material){
 const subject=material.subject||material.activity?.context?.subject||'',course=materialCourseValue(material);
 const published=String(material.id||'').startsWith('public:')||material.activity?.context?.public===true;
 if(published&&((!subject&&teacherOfferedSubjects().length)||(!course&&teacherOfferedCourses().length)))return false;
 return teacherAllowsSubject(subject)&&teacherAllowsCourse(course);
}
function teacherSubjectNotice(hiddenCount=0){const chosen=teacherOfferedSubjects(),courses=teacherOfferedCourses();if(!chosen.length&&!courses.length)return '';return `<div class="teacher-subject-notice"><span>${chosen.length?`<strong>Asignaturas:</strong> ${chosen.map(esc).join(' · ')}`:''}${courses.length?`${chosen.length?' · ':''}<strong>Cursos y niveles:</strong> ${courses.map(esc).join(' · ')}`:''}${hiddenCount?`<small>${hiddenCount} ${hiddenCount===1?'material fuera de tu selección sigue guardado':'materiales fuera de tu selección siguen guardados'}.</small>`:''}</span><button type="button" data-action="accountSettings" data-settings-panel="subjects">Cambiar selección</button></div>`;}
function teacherResetSubjectFilters(){
  if(materialSubject&&!teacherAllowsSubject(materialSubject))materialSubject='';
  materialPage=0;
  materialQuery='';materialCourse='';materialType='';
  for(const filters of Object.values(materialFilterViews)){if(filters.subject&&!teacherAllowsSubject(filters.subject))filters.subject='';filters.page=0;filters.query='';filters.course='';filters.type='';}
  if(subject&&!teacherStudentSubjects(student(selected)).includes(subject))subject=teacherStudentSubjects(student(selected))[0]||teacherOfferedSubjects()[0]||'';
  if(!teacherAllowsCourse(temarioCourse)||!teacherAllowsSubject(temarioSubject)){temarioCourse=teacherCourseChoices(Object.keys(window.PROFESOR_TEMARIO||{}))[0]||'';temarioSubject=teacherSubjectChoices(Object.keys(window.PROFESOR_TEMARIO?.[temarioCourse]||{}))[0]||'';temarioSelected='';}
}
