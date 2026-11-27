(() => {
  const labels = {folio:'Enfocado', atlas:'Ruta', signal:'Directo'};
  const design = document.documentElement.dataset.design;
  const landing = !document.body.classList.contains('english-studio');
  const requested = new URLSearchParams(location.search).get('screen');
  const tabs = {
    home:['Inicio','sesion'], session:['Sesión en curso','sesion'], syllabus:['Temario','b2'], lesson:['Detalle de lección','b2'],
    route:['Recorrido de juegos','juegos'], catalog:['Catálogo de juegos','juegos'], mission:['Partida','juegos'],
    library:['Biblioteca','temas'], practice:['Selector de práctica','entrenar'], speaking:['Speaking','recitar'], writing:['Writing','escrita'],
    listening:['Listening','examenes'], audio:['Listening · ejercicio','examenes'], mock:['Listening · simulacro','examenes'],
    progress:['Progreso','progreso'], history:['Historial','historial'], profile:['Perfil','perfil'], settings:['Configuración','config'],
    notifications:['Notificaciones','sesion'], tutor:['Profesor IA','sesion']
  };
  const primary = {sesion:'home',b2:'syllabus',juegos:'route',temas:'library',entrenar:'practice',recitar:'speaking',escrita:'writing',examenes:'listening',progreso:'progress',historial:'history',perfil:'profile',config:'settings'};
  const urlFor = (name,screen) => screen === 'landing' ? `/cambridge-info?design=${name}` : `/cambridge?design=${name}&screen=${screen}`;
  const bar = document.createElement('div');
  bar.className = 'design-bar';
  bar.innerHTML = `<a class="design-back" href="/">← Diseños</a><div class="design-switch" aria-label="Cambiar propuesta">${Object.entries(labels).map(([name,label]) => `<a data-preview-theme="${name}" href="${urlFor(name,'home')}" ${name === design ? 'aria-current="true"' : ''}>${label}</a>`).join('')}</div><label class="design-screen"><span>Pantalla</span><select aria-label="Pantalla de la vista previa"><option value="landing">Landing</option>${Object.entries(tabs).map(([id,[label]]) => `<option value="${id}">${label}</option>`).join('')}</select></label>`;
  document.body.prepend(bar);
  const picker = bar.querySelector('select');
  picker.addEventListener('change', () => {
    if (landing || picker.value === 'landing') location.href = urlFor(design,picker.value);
    else open(picker.value);
  });

  function update(screen) {
    picker.value = screen;
    for (const link of bar.querySelectorAll('[data-preview-theme]')) link.href = urlFor(link.dataset.previewTheme, screen);
  }

  if (landing) {
    document.body.classList.add('design-landing');
    document.querySelector('.google-entry').href = `/auth/google/login?design=${design}`;
    document.querySelector('.workspace-scene img').src = `/preview/assets/${design}.webp`;
    const copy = {
      folio:['Una lección cada vez.', 'Prepara tu examen de inglés con sesiones cortas que puedes retomar cuando quieras.', 'lessons', 'Ver una lección'],
      atlas:['Avanza de misión en misión.', 'Viaja por la ruta de tu nivel, resuelve un reto y abre la siguiente parada.', 'games', 'Probar una misión'],
      signal:['Elige qué quieres practicar.', 'Abre Speaking, Writing o Listening y empieza con un ejercicio de tu nivel.', 'practice', 'Probar una destreza']
    }[design];
    document.getElementById('hero-title').textContent = copy[0];
    document.querySelector('.hero .lead').textContent = copy[1];
    const preview = document.querySelector('.workspace-grid');
    const featured = preview.querySelector(`[data-preview-open="${copy[2]}"]`);
    preview.prepend(featured);
    document.querySelector('.hero-actions').insertAdjacentHTML('beforeend', `<button type="button" class="ux-public-demo">${copy[3]} →</button>`);
    document.querySelector('.ux-public-demo').addEventListener('click', () => featured.click());
    update('landing');
    return;
  }

  const brand = document.querySelector('.workspace-brand');
  brand.querySelector('span').innerHTML = `Inglés <small>${labels[design]}</small>`;
  const home = document.getElementById('sessionEmpty');
  const session = home.querySelector('.quick-session');
  const originalTitle = document.getElementById('quickSessionTitle');
  originalTitle.textContent = 'Sesión personalizada';
  originalTitle.removeAttribute('data-workspace-title');
  const homeBody = document.createElement('div');
  homeBody.id = 'uxHome';
  home.prepend(homeBody);
  const custom = document.createElement('details');
  custom.className = 'ux-custom';
  custom.innerHTML = '<summary>Elegir duración o retomar una sesión</summary>';
  home.append(custom);
  custom.append(session);
  home.querySelector('.quick-modes').hidden = true;
  const nav = document.querySelector('.workspace-header .main-actions');
  const navigation = {
    folio:[['sesion','Hoy','◷'],['b2','Estudiar','▤'],['entrenar','Práctica','◎']],
    atlas:[['sesion','Inicio','⌂'],['juegos','Mapa','◇'],['b2','Temario','▤'],['entrenar','Práctica','◎']],
    signal:[['sesion','Inicio','⌂'],['entrenar','Practicar','◎'],['b2','Temas','▤'],['juegos','Juegos','◇'],['progreso','Progreso','↗']]
  }[design];
  nav.innerHTML = navigation.map(([id,label,icon]) => `<button class="nav-pill" data-tab-btn="${id}" data-ux-tab="${id}" data-ux-icon="${icon}" type="button"><span>${label}</span></button>`).join('');
  for (const [index,button] of [...nav.children].entries()) button.dataset.designIndex = `0${index+1}`;
  const study = document.getElementById('b2LessonOverview');
  const studyTitle = document.getElementById('englishSyllabusTitle');
  studyTitle.classList.remove('workspace-sr-only');
  studyTitle.classList.add('ux-page-title');
  studyTitle.after(Object.assign(document.createElement('div'), {className:'ux-study-links',innerHTML:'<button type="button" data-ux-tab="temas">Biblioteca ↗</button><button type="button" data-ux-tab="juegos">Juegos ↗</button>'}));
  const libraryTitle = document.querySelector('#tab-temas [data-workspace-title]');
  libraryTitle.classList.remove('workspace-sr-only');
  libraryTitle.classList.add('ux-page-title');
  if (design !== 'atlas') {
    const writing = document.querySelector('.writing-layout');
    const tabs = document.createElement('div');
    tabs.className = 'ux-writing-switch';
    tabs.setAttribute('role','group');
    tabs.setAttribute('aria-label','Vista de Writing');
    tabs.innerHTML = '<button type="button" aria-pressed="true" data-writing-view="draft">Redactar</button><button type="button" aria-pressed="false" data-writing-view="review">Corrección y versiones</button>';
    writing.before(tabs);
    function setWritingView(view) {
      writing.dataset.view = view;
      for (const button of tabs.children) button.setAttribute('aria-pressed',String(button.dataset.writingView === view));
    }
    setWritingView('draft');
    tabs.addEventListener('click',event => {
      const button = event.target.closest('[data-writing-view]');
      if (button) setWritingView(button.dataset.writingView);
    });
    const correct = document.getElementById('correctWritingBtn');
    correct.addEventListener('click', () => {
      if (document.getElementById('writingAnswer').value.trim() && correct.disabled) setWritingView('review');
    });
  }
  const progress = document.getElementById('tab-progreso');
  const profile = document.getElementById('tab-perfil');
  const setting = document.querySelector('.study-look-setting');
  const styleLabel = setting.querySelector('[data-study-look-label]');
  styleLabel.removeAttribute('data-study-look-label');
  styleLabel.textContent = labels[design];
  const styleButton = setting.querySelector('button');
  styleButton.before(Object.assign(document.createElement('a'), {className:'design-profile-link',href:'/',textContent:'Comparar estilos'}));
  styleButton.remove();
  profile.querySelector('[onclick="logoutWeb()"]')?.addEventListener('click', event => {
    event.stopImmediatePropagation();
    location.href = urlFor(design,'landing');
  }, true);

  const tabLink = (tab,label) => `<button type="button" class="ux-link" data-ux-tab="${tab}">${label}<span aria-hidden="true">↗</span></button>`;
  function renderHome() {
    const level = state.examLevel;
    const lessons = englishRouteLessons();
    const nextLesson = lessons.find(lesson => !state.b2Progress[lesson.id]?.completed) || lessons[0];
    const totals = englishRouteProgressSummary(level);
    let markup;
    if (design === 'folio') {
      markup = `<div class="ux-focus-head"><span class="design-eyebrow">${escHtml(level)}</span><h1 data-workspace-title tabindex="-1">Tu siguiente lección</h1><p>Una idea, un ejemplo y una pregunta para comprobarla.</p></div>
      <article class="ux-focus-card"><div><span class="ux-kicker">${escHtml(nextLesson.skill)}</span><h2>${escHtml(nextLesson.title)}</h2><p>${escHtml(nextLesson.idea)}</p></div><button type="button" class="ux-primary" data-ux-lesson="${nextLesson.id}">${state.b2Progress[nextLesson.id]?.completed ? 'Repasar lección' : 'Abrir lección'} <span aria-hidden="true">→</span></button></article>
      <nav class="ux-focus-links" aria-label="Otros accesos">${tabLink('juegos','Juegos')}${tabLink('temas','Biblioteca')}${tabLink('progreso','Mi progreso')}</nav>`;
    } else if (design === 'atlas') {
      const stops = lessons.map(lesson => {
        const game = englishRouteGame(englishLessonMission(lesson));
        const end = englishJourneyChapters(game).find(item => item.lesson.id === lesson.id).end;
        return {lesson,game,done:state.b2Games[game.id]?.completed || (state.b2GameRuns[game.id]?.stage || 0) >= end};
      });
      const next = stops.findIndex(stop => !stop.done);
      const selected = stops[next];
      const offset = Math.max(0,(next < 0 ? stops.length : next)-1);
      const nearby = stops.slice(offset,offset+3);
      markup = `<div class="ux-route-home"><section class="ux-route-poster"><div><span class="design-eyebrow">${escHtml(level)} · ${stops.filter(stop => stop.done).length}/${stops.length} paradas</span><h1 data-workspace-title tabindex="-1">Tu ruta de inglés</h1><p>${selected ? 'Siguiente misión · '+escHtml(selected.game.title) : 'Has completado el recorrido.'}</p>${selected ? `<button type="button" class="ux-primary" data-ux-game="${selected.game.id}">Jugar la siguiente misión <span aria-hidden="true">→</span></button>` : tabLink('juegos','Volver al mapa')}</div></section>
      <aside class="ux-route-stops"><h2>Paradas cercanas</h2><ol>${nearby.map(stop => `<li data-stop-state="${stop.done ? 'done' : stop === selected ? 'next' : 'later'}"><span aria-hidden="true">${stop.done?'✓':String(stops.indexOf(stop)+1).padStart(2,'0')}</span><div><strong>${escHtml(stop.lesson.title)}</strong><small>${stop.done?'Completada':stop === selected?'Siguiente':'Por abrir'}</small></div></li>`).join('')}</ol>${tabLink('juegos','Ver mapa completo')}</aside></div>
      <nav class="ux-focus-links" aria-label="Otros accesos">${tabLink('temas','Biblioteca')}${tabLink('progreso','Mi progreso')}</nav>`;
    } else {
      const draft = state.writingPractice?.answer?.trim();
      const skills = [['recitar','Speaking','◉','Graba una respuesta','Elige una consigna y practica en voz alta.'],['escrita','Writing','✎',draft?'Retoma tu borrador':'Escribe un texto',draft?'Sigue donde lo dejaste.':'Elige una consigna y revisa tu texto.'],['examenes','Listening','◒','Escucha y responde','Abre un audio de tu nivel.']];
      markup = `<header class="ux-direct-head"><div><span class="design-eyebrow">${escHtml(level)}</span><h1 data-workspace-title tabindex="-1">¿Qué quieres practicar?</h1></div><span>${totals.doneLessons}/${totals.lessons} lecciones completadas</span></header>
      <div class="ux-skill-grid">${skills.map(([tab,label,icon,title,body]) => `<button type="button" class="ux-skill-card" data-ux-tab="${tab}"><span class="ux-skill-icon" aria-hidden="true">${icon}</span><small>${label}</small><strong>${title}</strong><span>${body}</span><b aria-hidden="true">→</b></button>`).join('')}</div>
      <nav class="ux-focus-links" aria-label="Otros accesos">${tabLink('temas','Biblioteca')}</nav>`;
    }
    if (homeBody.dataset.rendered !== markup) {
      homeBody.innerHTML = markup;
      homeBody.dataset.rendered = markup;
    }
  }

  function navigate(tab) {
    if (tab === 'b2' && study.hidden) closeB2Lesson();
    showTab(tab);
    if (tab === 'juegos') showGames(design !== 'atlas');
    if (tab === 'examenes') openListeningView('hub');
  }

  function showGames(catalog) {
    if (document.getElementById('b2GameBoard').children.length) closeEnglishGame(catalog);
    else showEnglishGameCatalog(catalog);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-ux-tab],[data-ux-lesson],[data-ux-game]');
    if (!button) return;
    if (button.dataset.uxLesson) {
      navigate('b2');
      openB2Lesson(button.dataset.uxLesson);
    } else if (button.dataset.uxGame) {
      showEnglishGameCatalog(false);
      openB2Game(button.dataset.uxGame,true);
    } else navigate(button.dataset.uxTab);
  });

  function open(screen) {
    if (!Object.hasOwn(tabs,screen)) screen = 'home';
    const tab = tabs[screen][1];
    showTab(tab);
    if (screen === 'syllabus') closeB2Lesson();
    if (screen === 'session') startSessionWithTopic('Present perfect y past simple',false,15);
    if (screen === 'lesson') openB2Lesson(englishRouteLessons().at(-4).id);
    if (screen === 'catalog') showGames(true);
    if (screen === 'route') showGames(false);
    if (screen === 'mission') openB2Game(englishExpansion().missions[1].id);
    if (screen === 'audio') openListeningView('brief');
    if (screen === 'listening') openListeningView('hub');
    if (screen === 'mock') {
      if (state.examLevel !== 'B2 First') setExamLevel('B2 First');
      openListeningView('mock');
    }
    if (screen === 'notifications') document.querySelector('[data-app-notifications]').click();
    if (screen === 'tutor' && document.getElementById('englishTeacherPanel').hidden) toggleEnglishTeacher();
    update(screen);
    history.replaceState(null,'',urlFor(design,screen));
  }

  function currentScreen() {
    if (document.querySelector('.app-notifications-dialog[open]')) return 'notifications';
    if (!document.getElementById('englishTeacherPanel').hidden) return 'tutor';
    const id = document.querySelector('main .tab.active')?.id.replace('tab-','');
    if (id === 'sesion' && document.getElementById('sessionActive').style.display !== 'none') return 'session';
    if (id === 'b2' && document.getElementById('b2LessonOverview').hidden) return 'lesson';
    if (id === 'juegos' && document.getElementById('b2GameBoard').children.length) return 'mission';
    if (id === 'juegos' && document.getElementById('englishJourney').hidden) return 'catalog';
    if (id === 'examenes' && listeningView === 'brief') return 'audio';
    if (id === 'examenes' && listeningView === 'mock') return 'mock';
    return primary[id] || 'home';
  }
  function refreshPreview() {
    const screen = currentScreen();
    if (screen === 'home') renderHome();
    update(screen);
  }
  document.addEventListener('click', () => setTimeout(refreshPreview,0));
  document.getElementById('headerExamLevel').addEventListener('change', refreshPreview);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setTimeout(() => update(currentScreen()),0);
  });
  for (const node of [progress,profile]) node.classList.add('design-account-screen');

  window.designPreviewReady.then(() => {
    renderHome();
    open(requested || 'home');
    document.body.dataset.previewReady = 'true';
  }).catch(error => {
    console.error(error);
    const message = document.createElement('p');
    message.className = 'design-load-error';
    message.setAttribute('role','alert');
    message.textContent = 'No se ha podido abrir la vista. Recarga la página o vuelve a los diseños.';
    bar.after(message);
  });
})();
