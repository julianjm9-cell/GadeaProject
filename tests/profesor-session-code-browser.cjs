const {chromium}=require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const teacher=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    teacher.on('pageerror',error=>errors.push(error.message));
    await teacher.goto(pathToFileURL(path.resolve('apps/profesor/index.html')).href);
    await teacher.evaluate(()=>{
      state=fresh();state.teacherProfile.plan='premium';
      state.students=[{id:'s1',name:'María',course:'3.º ESO',subjects:['Matemáticas']}];
      state.library=[{id:'m1',title:'Sumas',subject:'Matemáticas',activity:{questions:[{type:'quiz',prompt:'2 + 2',answer:'4',options:['3','4']}]}}];
      studentAccessData={accesses:[{id:'access1',student_id:'s1',name:'María',meet_uri:''}]};
      studentLiveSessions=[{id:'session1',student_id:'s1',title:'Sumas',status:'pending',join_code:'ABCD234567'}];
      view='Accesos';render();
    });
    assert.match(await teacher.locator('.access-page').innerText(),/ABCD234567/);
    assert.doesNotMatch(await teacher.locator('.access-page').innerText(),/Contraseña|Nombre de usuario|Crear acceso/);
    assert.equal(await teacher.locator('.access-session-code').count(),1);
    assert.equal(await teacher.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await teacher.screenshot({path:'tmp/session-codes-teacher.png'});
    await teacher.evaluate(()=>{
      demo=false;
      api=async(route,body)=>{
        if(route==='/api/profesor/material-sessions'&&body)return {session:{id:'session2'}};
        if(route==='/api/profesor/material-sessions/session2')return {session:{id:'session2',title:'Sumas',subject:'Matemáticas',student_name:'María',status:'pending',revision:0,join_code:'NEWC234567',questions:[{type:'quiz',prompt:'2 + 2',answer:'4',options:['3','4']}],progress:{current_index:0,responses:{}}}};
        if(route==='/api/profesor/session-students')return {accesses:[{id:'access1',student_id:'s1',name:'María',meet_uri:''}]};
        if(route==='/api/profesor/material-sessions')return {sessions:[{id:'session2',student_id:'s1',title:'Sumas',status:'pending',join_code:'NEWC234567'}]};
        throw Error(route);
      };
    });
    await teacher.getByRole('button',{name:/Crear sesión/}).first().click();
    await teacher.locator('[data-live-teacher="choose-material"]').first().click();
    await teacher.getByRole('button',{name:'Crear sesión y código'}).click();
    await teacher.locator('.live-join-code').waitFor();
    assert.match(await teacher.locator('.live-join-code').innerText(),/NEWC234567/);

    const pupil=await browser.newPage({viewport:{width:390,height:844}});
    pupil.on('pageerror',error=>errors.push(error.message));
    let joined=false;
    await pupil.route('**/*',route=>{
      const url=new URL(route.request().url()),key=url.pathname;
      const scripts=new Set(['/profesor-live.js','/profesor-live-sync.js','/profesor-rich-text.js','/profesor-puzzle-boards.js','/profesor-challenge-games.js','/profesor-mini-games.js','/profesor-sentence-board.js']);
      const file=key==='/profesor/alumno'?'backend/app/static/profesor-alumno.html':scripts.has(key)?'apps/profesor/'+key.slice(1):key==='/assets/profesor-live.css'?'apps/profesor/assets/profesor-live.css':null;
      if(file)return route.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(path.resolve(file))});
      if(key==='/auth/profesor/student-me')return route.fulfill({status:joined?200:401,contentType:'application/json',body:JSON.stringify(joined?{student:{name:'María',course:'3.º ESO'},teacher:{name:'Profesor'},meet_uri:''}:{detail:'Sin sesión'})});
      if(key==='/auth/profesor/student-join'){joined=true;return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});}
      if(key==='/api/profesor/student-material-sessions')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sessions:[{id:'session1',title:'Sumas',subject:'Matemáticas',count:1,status:'pending'}]})});
      if(key==='/api/profesor/student-material-sessions/session1')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({session:{id:'session1',title:'Sumas',subject:'Matemáticas',status:'pending',revision:0,questions:[{type:'quiz',prompt:'¿Cuánto es 2 + 2?',options:['3','4']}],progress:{current_index:0,responses:{}}}})});
      return route.fulfill({status:404,body:''});
    });
    await pupil.goto('http://educa.test/profesor/alumno');
    await pupil.locator('#studentJoinGate:visible').waitFor();
    await pupil.locator('#studentJoinCode').fill('ABCD234567');
    await pupil.getByRole('button',{name:'Entrar en la sesión'}).click();
    await pupil.locator('#studentJoinGate').waitFor({state:'hidden'});
    await pupil.getByRole('button',{name:/Sumas/}).click();
    assert.match(await pupil.locator('#studentMaterials').innerText(),/Empezar/);
    assert.equal(await pupil.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await pupil.screenshot({path:'tmp/session-code-student.png'});
    assert.deepEqual(errors,[]);
    console.log('PASS session code teacher view and account-free student entry');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
