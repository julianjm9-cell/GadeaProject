/* Juegos breves de repaso. La fuente de cada respuesta es el temario ya publicado. */
(function (root) {
  'use strict';

  function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
    return result >>> 0;
  }

  function shuffle(items, seed) {
    const copy = [...items];
    let value = hash(seed);
    for (let index = copy.length - 1; index > 0; index -= 1) {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      const other = value % (index + 1);
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  function companions(topic, module, count = 3) {
    const others = module.tasks.filter(item => item.id !== topic.id);
    const start = Math.max(0, module.tasks.findIndex(item => item.id === topic.id));
    const ordered = [...others.slice(start), ...others.slice(0, start)];
    return ordered.slice(0, count);
  }

  function topicQuiz(topic, module, modelUnits = {}) {
    const authored = modelUnits[topic.id]?.questions || [];
    if (authored.length >= 3) return authored.slice(0, 4).map(([prompt, choices, correct, explanation], index) => ({
      prompt: String(prompt),
      choices: [...choices].map(String),
      correct: Number(correct),
      explanation: String(explanation || topic.note || ''),
      id: `${topic.id}:authored:${index}`,
    }));

    const peers = companions(topic, module, 3);
    const rounds = [
      {prompt: `¿Qué se trabaja en «${topic.title}»?`, field: 'detail', explanation: topic.detail},
      {prompt: `¿Qué consejo te ayuda con «${topic.title}»?`, field: 'note', explanation: topic.note},
      {prompt: `¿Qué ejemplo pertenece a «${topic.title}»?`, field: 'example', explanation: topic.example},
    ];
    return rounds.map((round, index) => {
      const source = [topic, ...peers].filter(item => String(item[round.field] || '').trim());
      const unique = source.filter((item, position) => source.findIndex(candidate => candidate[round.field] === item[round.field]) === position);
      const choices = shuffle(unique.map(item => ({text: String(item[round.field]), topicId: item.id})), `${topic.id}:${round.field}`);
      return {
        prompt: round.prompt,
        choices: choices.map(item => item.text),
        correct: choices.findIndex(item => item.topicId === topic.id),
        explanation: String(round.explanation || ''),
        id: `${topic.id}:association:${index}`,
      };
    }).filter(question => question.correct >= 0 && question.choices.length >= 3);
  }

  function topicPairs(topic, module) {
    const peers = companions(topic, module, 3);
    const entries = [topic, ...peers].filter(item => item.title && item.detail);
    const cards = entries.flatMap(item => [
      {id: `${item.id}:title`, pair: item.id, text: String(item.title), kind: 'tema'},
      {id: `${item.id}:detail`, pair: item.id, text: String(item.detail), kind: 'idea'},
    ]);
    return shuffle(cards, `${topic.id}:pairs`);
  }

  function pairsScore(moves, pairCount) {
    return Math.max(40, Math.min(100, Math.round((pairCount / Math.max(pairCount, moves)) * 100)));
  }

  const topicArtNames = {
    'len-comprension':'public-biblioteca-inference.webp',
    'len-resumen':'public-museo-expositivo.webp',
    'len-gramatica':'public-archivo-sintagmas.webp',
    'len-ortografia':'public-isla-tildes.webp',
    'len-redaccion':'public-redaccion-titulares.webp',
    'len-literatura':'public-biblioteca-secreta.webp',
    'len-textos-vida':'public-central-mensajes.webp',
    'len-medios':'public-hemeroteca-fuentes.webp',
    'len-argumentacion':'public-tribunal-ambiguedad.webp',
    'len-comentario':'public-sala-comentario.webp',
    'len-presentacion':'public-museo-expositivo.webp',
    'ing-reading':'public-biblioteca-inference.webp',
    'ing-vocabulary':'public-fabrica-palabras.webp',
    'ing-grammar':'public-estudio-advanced-tenses.webp',
    'ing-writing':'public-redaccion-compuesta.webp',
    'ing-listening':'public-plaza-saludos.webp',
    'ing-dialogues':'public-plaza-saludos.webp',
    'ing-forms':'public-aeropuerto-habitos.webp',
    'ing-connectors':'public-puente-subjuntivo.webp',
    'ing-exam-strategy':'public-estudio-habitos.webp',
    'geo-mapas':'public-atlas-explorador.webp',
    'geo-relieve':'public-safari-parque.webp',
    'geo-poblacion':'public-mapa-migraciones.webp',
    'geo-economia':'public-ciudad-economica.webp',
    'geo-global':'public-atlas-explorador.webp',
    'geo-espana-europa':'public-atlas-explorador.webp',
    'geo-medioambiente':'public-bosque-vivo.webp',
    'geo-fuentes':'public-hemeroteca-fuentes.webp',
    'geo-ciudad':'public-ciudad-direcciones.webp',
    'geo-trabajo':'public-mercado-monedas.webp',
    'his-antigua':'public-museo-expositivo.webp',
    'his-medieval':'public-biblioteca-secreta.webp',
    'his-moderna':'public-cronica-pasado.webp',
    'his-contemporanea':'public-archivo-contemporaneo.webp',
    'his-sigloxx':'public-cronica-pasado.webp',
    'his-ciudadania':'public-asamblea-revoluciones.webp',
    'his-espana':'public-archivo-contemporaneo.webp',
    'his-andalucia':'public-museo-expositivo.webp',
    'his-valores':'public-asamblea-revoluciones.webp',
    'his-fuentes':'public-hemeroteca-fuentes.webp',
    'his-musica-cultura':'public-cronica-pasado.webp',
    'mat-numeros':'public-observatorio-numeros.webp',
    'mat-proporciones':'public-feria-porcentajes.webp',
    'mat-algebra':'public-camara-matrices.webp',
    'mat-geometria':'public-laboratorio-medidas.webp',
    'mat-funciones':'public-observatorio-ondas.webp',
    'mat-estadistica':'public-observatorio-decimales.webp',
    'mat-medida':'public-laboratorio-medidas.webp',
    'mat-finanzas':'public-mercado-monedas.webp',
    'mat-problemas':'public-cocina-fracciones.webp',
    'mat-graficas-examen':'public-observatorio-ondas.webp',
    'mat-calculadora':'public-observatorio-numeros.webp',
    'mat-razonamiento':'public-boveda-racionales.webp',
    'cie-metodo':'public-laboratorio-mezclas.webp',
    'cie-biologia':'public-atlas-cuerpo.webp',
    'cie-ecologia':'public-bosque-vivo.webp',
    'cie-materia':'public-laboratorio-atomo.webp',
    'cie-fisica':'public-centro-cinematica.webp',
    'cie-tecnologia':'public-taller-circuitos.webp',
    'cie-tierra':'public-atlas-explorador.webp',
    'cie-cuerpo':'public-atlas-cuerpo.webp',
    'cie-laboratorio':'public-laboratorio-mezclas.webp',
    'cie-sostenibilidad':'public-invernadero-cientifico.webp',
    'cie-digitalizacion':'public-taller-circuitos.webp',
    'cie-proyecto':'public-taller-circuitos.webp',
  };
  const fallbackArt = {
    lengua:'public-biblioteca-secreta.webp',
    ingles:'public-plaza-saludos.webp',
    geografia:'public-atlas-explorador.webp',
    historia:'public-archivo-contemporaneo.webp',
    matematicas:'public-observatorio-numeros.webp',
    ciencias:'public-laboratorio-atomo.webp',
  };

  // Las tres escenas de Inglés son fondos sin texto. Las piezas jugables y su
  // corrección siguen siendo HTML para funcionar con ratón, teclado y táctil.
  const englishScenes = {
    'ing-reading':{art:'eso-english-desk.webp',place:'Mesa de lectura',task:'Lee el texto y encuentra la pista',piece:'Fragmento',symbol:'▤',stations:['Texto','Pista','Conclusión'],kind:'desk'},
    'ing-vocabulary':{art:'eso-english-cafe.webp',place:'Plaza de conversaciones',task:'Elige la expresión que encaja',piece:'Expresión',symbol:'◇',stations:['Situación','Expresión','Uso'],kind:'cafe'},
    'ing-grammar':{art:'eso-english-desk.webp',place:'Mesa de estudio',task:'Elige la pieza que completa la idea',piece:'Ficha',symbol:'▣',stations:['Borrador','Revisión','Versión final'],kind:'desk'},
    'ing-writing':{art:'eso-english-desk.webp',place:'Estudio de escritura',task:'Prepara el mensaje antes de enviarlo',piece:'Mensaje',symbol:'✉',stations:['Borrador','Mensaje','Envío'],kind:'desk'},
    'ing-listening':{art:'eso-english-cafe.webp',place:'Café de la plaza',task:'Resuelve una situación cotidiana',piece:'Respuesta',symbol:'☕',stations:['Mostrador','Conversación','Salida'],kind:'cafe'},
    'ing-dialogues':{art:'eso-english-cafe.webp',place:'Café de la plaza',task:'Encuentra la respuesta apropiada',piece:'Diálogo',symbol:'❞',stations:['Saludo','Petición','Despedida'],kind:'cafe'},
    'ing-forms':{art:'eso-english-travel.webp',place:'Mostrador de información',task:'Localiza el dato que necesitas',piece:'Dato',symbol:'▤',stations:['Horario','Formulario','Confirmación'],kind:'travel'},
    'ing-connectors':{art:'eso-english-desk.webp',place:'Mesa de redacción',task:'Conecta las ideas del mensaje',piece:'Conector',symbol:'↗',stations:['Inicio','Enlace','Cierre'],kind:'desk'},
    'ing-exam-strategy':{art:'eso-english-desk.webp',place:'Mesa de examen',task:'Selecciona la mejor estrategia',piece:'Pista',symbol:'✓',stations:['Lectura','Respuesta','Revisión'],kind:'desk'},
  };

  function englishScene(topic) {
    return englishScenes[topic?.id] || null;
  }

  function missionFor(topic, module) {
    const catalogs = {ingles:root.EsoEnglishMissions,matematicas:root.EsoMathMissions,lengua:root.EsoLanguageMissions,geografia:root.EsoGeographyMissions,historia:root.EsoHistoryMissions,ciencias:root.EsoScienceMissions};
    return catalogs[module?.id]?.[topic?.id] || null;
  }

  function topicArt(topic, module) {
    const file = englishScene(topic)?.art || missionFor(topic,module)?.art || topicArtNames[topic.id] || fallbackArt[module.id];
    const localPreview = root.location?.protocol === 'file:' || root.location?.pathname?.includes('/apps/e25/');
    return `${localPreview ? '../profesor/assets/games/' : '/assets/games/'}${file}`;
  }

  function topicQuest(topic, module, modelUnits = {}) {
    const mission = missionFor(topic,module);
    if (mission) return {
      mode:'story', title:mission.title, brief:mission.brief, place:mission.place, symbol:mission.symbol,
      stations:mission.stages.map((stage, id) => ({...stage, id})),
    };
    const stations = topicQuiz(topic, module, modelUnits).slice(0, 3).map((question, index) => ({
      id: index,
      prompt: question.prompt,
      answer: question.choices[question.correct],
      explanation: question.explanation,
    })).filter(station => station.answer);
    if (stations.length < 3) return null;
    const answers = stations.map(station => ({station:station.id, text:station.answer}));
    const correctTexts = new Set(answers.map(item => item.text.trim().toLocaleLowerCase()));
    const distractors = [];
    for (const question of topicQuiz(topic, module, modelUnits)) {
      for (const choice of question.choices) {
        const normalized = choice.trim().toLocaleLowerCase();
        if (normalized && !correctTexts.has(normalized) && !distractors.some(item => item.text.trim().toLocaleLowerCase() === normalized)) {
          distractors.push({station:null, text:choice});
        }
        if (distractors.length === 2) break;
      }
      if (distractors.length === 2) break;
    }
    const cards = shuffle([...answers, ...distractors].map((item, index) => ({...item, id:index})), `${topic.id}:quest`);
    return {stations, cards};
  }

  function questScore(mistakes) {
    return Math.max(0, 100 - Math.max(0, mistakes) * 20);
  }

  const api = {topicQuiz, topicPairs, topicQuest, topicArt, englishScene, missionFor, pairsScore, questScore};
  root.EsoAdultGames = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);

if (typeof window !== 'undefined') {
  let gameSubject = null;
  let gameRun = null;

  window.installGamesShortcut = function () {
    const shortcuts = document.querySelector('.today-shortcuts');
    if (!shortcuts || shortcuts.querySelector('[data-games-shortcut]')) return;
    const button = document.createElement('button');
    button.className = 'today-shortcut tone-game';
    button.type = 'button';
    button.dataset.gamesShortcut = '1';
    button.onclick = () => openGames();
    button.innerHTML = '<span class="home-icon" aria-hidden="true">✦</span><span class="shortcut-arrow" aria-hidden="true">→</span><strong>Juegos</strong><span class="shortcut-description">Practica cada tema</span><span class="shortcut-art" aria-hidden="true"></span>';
    shortcuts.insertBefore(button, shortcuts.lastElementChild);
  };

  window.openGames = function (subjectId, topicId) {
    captureExamDraft();
    if (currentView === 'workspace' && state.activeTopic && Number.isInteger(state.activeLesson)) {
      if (document.getElementById('lessonAiNotes')) saveLessonNotes(state.activeTopic, state.activeLesson, false);
      if (document.getElementById('modelEvidenceAnswer')) saveModelEvidence(state.activeTopic, state.activeLesson, false);
    }
    if (subjectId && MODULES.some(module => module.id === subjectId)) gameSubject = subjectId;
    else if (gameSubject === null) gameSubject = MODULES.some(module => module.id === state.activeModule && !['exam', 'oficial'].includes(module.id)) ? state.activeModule : MODULES[0].id;
    gameRun = null;
    currentView = 'games';
    closeProfile();
    if (topicId) startGame(topicId);
    else renderGames();
    renderView();
    window.scrollTo({top: 0, behavior: 'auto'});
  };

  window.filterGames = function (subjectId) {
    gameSubject = subjectId;
    gameRun = null;
    renderGames();
  };

  window.renderGames = function () {
    const root = document.getElementById('gamesView');
    if (!root) return;
    if (gameRun) return renderGameRun();
    const subjects = MODULES.filter(module => !['exam', 'oficial'].includes(module.id));
    const visible = subjects.filter(module => gameSubject === 'all' || module.id === gameSubject);
    const completed = Object.values(state.gameResults || {}).reduce((sum, results) => sum + ['quiz', 'pairs', 'quest'].filter(kind => results?.[kind]).length, 0);
    root.innerHTML = `<div class="eso-games-filters" role="group" aria-label="Filtrar juegos por asignatura"><strong>Asignaturas</strong><button type="button" class="${gameSubject === 'all' ? 'active' : ''}" aria-pressed="${gameSubject === 'all'}" onclick="filterGames('all')">Todas</button>${subjects.map(module => `<button type="button" class="${gameSubject === module.id ? 'active' : ''}" aria-pressed="${gameSubject === module.id}" onclick="filterGames('${module.id}')">${escapeHtml(module.title)}</button>`).join('')}</div>
      <div class="eso-games-groups">${visible.map(module => `<section class="eso-game-subject" style="--subject-color:${moduleColor(module.id)}"><div class="eso-game-subject-head"><span class="subject-symbol" aria-hidden="true">${escapeHtml(topicVisual({}, module.id))}</span><div><h3>${escapeHtml(module.title)}</h3><small>${module.tasks.length} temas · tres juegos propios y uno externo por tema</small></div></div><div class="eso-game-cards">${module.tasks.map((topic, index) => {
        const results = state.gameResults?.[topic.id] || {};
        const scores = [results.quiz?.best, results.pairs?.best, results.quest?.best].filter(Number.isFinite);
        const external = window.EsoExternalGames?.forTopic(topic.id);
        return `<article class="eso-game-card ${module.id === 'ingles' ? 'eso-english-game-card' : ''}"><img class="game-card-art" src="${EsoAdultGames.topicArt(topic,module)}" alt="" loading="lazy" width="640" height="360"><div class="game-card-top"><span class="game-card-index">${String(index + 1).padStart(2, '0')}</span><span class="game-card-best">${scores.length ? `Mejor: ${Math.max(...scores)} %` : 'Por descubrir'}</span></div><h4>${escapeHtml(topic.title)}</h4><p>${escapeHtml(topic.detail)}</p><div class="game-card-actions"><button type="button" onclick="startGame('${topic.id}','quiz')">Reto rápido</button><button type="button" onclick="startGame('${topic.id}','pairs')">Parejas</button><button type="button" onclick="startGame('${topic.id}','quest')">${EsoAdultGames.missionFor(topic,module) ? 'Misión del tema' : 'Mapa del tema'} ✦</button>${external ? `<a class="eso-external-game" href="${escapeHtml(external.url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir juego externo de ${escapeHtml(topic.title)} en ${escapeHtml(external.provider)}, se abre en otra pestaña">Juego externo ↗<small>${escapeHtml(external.provider)}</small></a>` : ''}</div></article>`;
      }).join('')}</div></section>`).join('')}</div><p class="eso-games-empty">${completed} juegos completados · puedes repetirlos cuando quieras.</p>`;
  };

  window.startGame = function (topicId, kind = 'quiz') {
    const topic = allTasks().find(item => item.id === topicId);
    if (!topic) return;
    const module = moduleById(topic.module);
    const mode = ['quiz', 'pairs', 'quest'].includes(kind) ? kind : 'quiz';
    const questions = mode === 'quiz' ? EsoAdultGames.topicQuiz(topic, module, MODEL_UNITS) : [];
    const cards = mode === 'pairs' ? EsoAdultGames.topicPairs(topic, module) : [];
    const quest = mode === 'quest' ? EsoAdultGames.topicQuest(topic, module, MODEL_UNITS) : null;
    if ((mode === 'quiz' && !questions.length) || (mode === 'pairs' && cards.length < 4) || (mode === 'quest' && !quest)) return;
    gameSubject = module.id;
    currentView = 'games';
    gameRun = {topic, module, kind: mode, questions, cards, quest, questSelected:null, questPlaced:{}, questMistakes:0, questFeedback:'Elige una pieza y colócala en su estación, o arrástrala.', missionStep:0, missionWrong:null, missionTried:{}, missionFeedback:'', round: 0, answers: [], selected: null, first: null, second: null, matched: new Set(), moves: 0, locked: false, finished: false};
    renderGames();
    renderView();
    window.scrollTo({top: 0, behavior: 'auto'});
  };

  function renderGameRun() {
    const root = document.getElementById('gamesView');
    const run = gameRun;
    if (!root || !run) return;
    const label = run.kind === 'quiz' ? 'Reto rápido' : run.kind === 'pairs' ? 'Parejas de conceptos' : run.quest?.mode === 'story' ? 'Misión del tema' : 'Mapa del tema';
    const total = run.kind === 'quiz' ? run.questions.length : run.kind === 'pairs' ? run.cards.length / 2 : run.quest.stations.length;
    const progress = run.kind === 'quiz' ? run.round + (run.selected === null ? 0 : 1) : run.kind === 'pairs' ? run.matched.size : Object.keys(run.questPlaced).length;
    const head = `<div class="eso-game-run-head"><button type="button" onclick="openGames('${run.module.id}')" aria-label="Volver a los juegos">←</button><div><h2>${escapeHtml(run.topic.title)}</h2><p>${escapeHtml(run.module.title)} · ${label}</p></div></div>`;
    if (run.finished) {
      const score = run.score;
      const detail = run.kind === 'quiz' ? `${run.answers.filter(Boolean).length} de ${total} respuestas correctas` : run.kind === 'pairs' ? `${total} parejas encontradas en ${run.moves} intentos` : `${total} ${run.quest?.mode === 'story' ? 'etapas' : 'estaciones'} completadas con ${run.questMistakes} intentos fallidos`;
      const saveMessage = run.saveStatus === 'saved' ? 'Tu resultado está guardado.' : run.saveStatus === 'failed' ? 'No se ha podido guardar el resultado. Sigue en esta pantalla; puedes reintentar o descargar una copia de tu progreso.' : 'Guardando tu resultado…';
      root.innerHTML = `<div class="eso-game-run">${head}<div class="eso-game-result"><span class="result-medal" aria-hidden="true">${score >= 70 ? '★' : '↻'}</span><h3>${score >= 70 ? '¡Buen trabajo!' : 'Sigue practicando'}</h3><p>${detail} · ${score} %.</p><p role="status">${saveMessage}</p><div class="result-actions">${run.saveStatus === 'failed' ? '<button type="button" onclick="retryGameSave()">Reintentar guardado</button><button type="button" onclick="downloadEsoProgress()">Descargar copia</button>' : ''}<button class="primary" type="button" onclick="startGame('${run.topic.id}','${run.kind}')">Jugar de nuevo</button><button type="button" onclick="openGames('${run.module.id}')">Ver más juegos</button><button type="button" onclick="openModule('${run.module.id}');openTopic('${run.topic.id}')">Estudiar el tema</button></div></div></div>`;
      return;
    }
    if (run.kind === 'quiz') {
      const question = run.questions[run.round];
      const answered = run.selected !== null;
      if (EsoAdultGames.englishScene(run.topic)) {
        renderEnglishQuiz(root, head, run, question, answered, total, progress);
        return;
      }
      root.innerHTML = `<div class="eso-game-run">${head}<div class="eso-game-progress" role="progressbar" aria-label="Rondas completadas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${progress}"><span style="width:${progress / total * 100}%"></span></div><div class="eso-game-question"><span class="round-label">Ronda ${run.round + 1} de ${total}</span><h3>${escapeHtml(question.prompt)}</h3><div class="eso-game-options">${question.choices.map((choice, index) => `<button type="button" class="${answered && index === question.correct ? 'correct' : answered && index === run.selected ? 'wrong' : ''}" onclick="chooseGameAnswer(${index})" ${answered ? 'disabled' : ''}><b>${String.fromCharCode(65 + index)}</b><span>${escapeHtml(choice)}</span></button>`).join('')}</div><div class="eso-game-feedback ${answered && run.selected !== question.correct ? 'error' : ''}" role="status">${answered ? `<strong>${run.selected === question.correct ? '✓ Correcto' : 'Respuesta para repasar'}</strong>${escapeHtml(question.explanation)}` : 'Elige una respuesta para avanzar.'}</div></div><div class="eso-game-next">${answered ? `<button class="primary" type="button" onclick="nextGameRound()">${run.round + 1 < total ? 'Siguiente ronda' : 'Ver resultado'} →</button>` : ''}</div></div>`;
      return;
    }
    if (run.kind === 'quest') {
      if (run.quest.mode === 'story') return renderStoryMission(root, head, run, total, progress);
      renderQuestRun(root, head, run, total, progress);
      return;
    }
    if (EsoAdultGames.englishScene(run.topic)) {
      renderEnglishPairs(root, head, run, total, progress);
      return;
    }
    root.innerHTML = `<div class="eso-game-run">${head}<div class="eso-game-progress" role="progressbar" aria-label="Parejas encontradas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${progress}"><span style="width:${progress / total * 100}%"></span></div><div class="eso-game-question"><span class="round-label">${progress} de ${total} parejas</span><h3>Une cada tema con su idea principal</h3><div class="eso-game-pairs">${run.cards.map((card, index) => {
      const revealed = run.matched.has(card.pair) || run.first === index || run.second === index;
      return `<button type="button" class="${run.matched.has(card.pair) ? 'matched' : revealed ? 'revealed' : ''}" onclick="flipGameCard(${index})" aria-label="${revealed ? escapeHtml(card.kind + ': ' + card.text) : `Destapar tarjeta ${index + 1}`}" ${run.matched.has(card.pair) || run.locked ? 'disabled' : ''}>${revealed ? escapeHtml(card.text) : '✦'}</button>`;
    }).join('')}</div><div class="eso-game-pairs-status" role="status">${run.locked ? 'Estas tarjetas no forman pareja.' : run.first !== null ? 'Elige la tarjeta que completa la pareja.' : `${run.moves} intentos · observa los temas y sus ideas.`}</div></div></div>`;
  }

  function renderEnglishQuiz(root, head, run, question, answered, total, progress) {
    const scene = EsoAdultGames.englishScene(run.topic);
    const art = EsoAdultGames.topicArt(run.topic, run.module);
    root.innerHTML = `<div class="eso-game-run eso-english-run" data-scene="${scene.kind}">${head}
      <div class="eso-game-progress" role="progressbar" aria-label="Rondas completadas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${progress}"><span style="width:${progress / total * 100}%"></span></div>
      <div class="eso-english-play-scene"><img class="eso-english-backdrop" src="${art}" alt="" width="1440" height="810">
        <div class="eso-english-scene-tag"><span aria-hidden="true">${escapeHtml(scene.symbol)}</span>${escapeHtml(scene.place)}</div>
        <div class="eso-game-question"><div class="eso-english-prompt"><span class="round-label">Ronda ${run.round + 1} de ${total} · ${escapeHtml(scene.task)}</span><h3>${escapeHtml(question.prompt)}</h3></div>
          <div class="eso-game-options">${question.choices.map((choice, index) => `<button type="button" class="${answered && index === question.correct ? 'correct' : answered && index === run.selected ? 'wrong' : ''}" onclick="chooseGameAnswer(${index})" ${answered ? 'disabled' : ''}><b>${escapeHtml(scene.symbol)}</b><span><small>${escapeHtml(scene.piece)} ${index + 1}</small>${escapeHtml(choice)}</span></button>`).join('')}</div>
          <div class="eso-game-feedback ${answered && run.selected !== question.correct ? 'error' : ''}" role="status">${answered ? `<strong>${run.selected === question.correct ? '✓ Correcto' : 'Respuesta para repasar'}</strong>${escapeHtml(question.explanation)}` : 'Elige la pieza que responda a la pregunta.'}</div>
        </div>
      </div><div class="eso-game-next">${answered ? `<button class="primary" type="button" onclick="nextGameRound()">${run.round + 1 < total ? 'Siguiente ronda' : 'Ver resultado'} →</button>` : ''}</div></div>`;
  }

  function renderEnglishPairs(root, head, run, total, progress) {
    const scene = EsoAdultGames.englishScene(run.topic);
    const art = EsoAdultGames.topicArt(run.topic, run.module);
    root.innerHTML = `<div class="eso-game-run eso-english-run" data-scene="${scene.kind}">${head}
      <div class="eso-game-progress" role="progressbar" aria-label="Parejas encontradas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${progress}"><span style="width:${progress / total * 100}%"></span></div>
      <div class="eso-english-play-scene eso-english-pairs-scene"><img class="eso-english-backdrop" src="${art}" alt="" width="1440" height="810">
        <div class="eso-english-scene-tag"><span aria-hidden="true">${escapeHtml(scene.symbol)}</span>${escapeHtml(scene.place)}</div>
        <div class="eso-game-question"><div class="eso-english-prompt"><span class="round-label">${progress} de ${total} parejas</span><h3>Encuentra cada tema y su idea principal</h3></div>
          <div class="eso-game-pairs">${run.cards.map((card, index) => {
            const matched = run.matched.has(card.pair);
            const revealed = matched || run.first === index || run.second === index;
            return `<button type="button" class="${matched ? 'matched' : revealed ? 'revealed' : ''}" onclick="flipGameCard(${index})" aria-label="${revealed ? escapeHtml(card.kind + ': ' + card.text) : `Destapar tarjeta ${index + 1}`}" ${matched || run.locked ? 'disabled' : ''}>${revealed ? `<small>${escapeHtml(card.kind === 'tema' ? 'Tema' : 'Idea')}</small><span>${escapeHtml(card.text)}</span>` : `<span class="eso-english-card-symbol" aria-hidden="true">${escapeHtml(scene.symbol)}</span><small>${escapeHtml(scene.piece)}</small>`}</button>`;
          }).join('')}</div><div class="eso-game-pairs-status" role="status">${run.locked ? 'Estas piezas no forman pareja.' : run.first !== null ? 'Busca la pieza que completa la pareja.' : `${run.moves} intentos · destapa dos piezas.`}</div>
        </div>
      </div></div>`;
  }

  function renderStoryMission(root, head, run, total, progress) {
    const scene = EsoAdultGames.englishScene(run.topic) || {kind:run.module.id,place:run.quest.place || 'Misión del tema',symbol:run.quest.symbol || '✦'};
    const stage = run.quest.stations[run.missionStep];
    const solved = Number.isInteger(run.questPlaced[stage.id]);
    const art = EsoAdultGames.topicArt(run.topic, run.module);
    root.innerHTML = `<div class="eso-game-run eso-english-run eso-mission-run ${({matematicas:'eso-math-run',lengua:'eso-language-run',geografia:'eso-geo-run',historia:'eso-history-run',ciencias:'eso-science-run'})[run.module.id] || ''}" data-scene="${scene.kind}">${head}
      <div class="eso-game-progress" role="progressbar" aria-label="Etapas completadas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${progress}"><span style="width:${progress / total * 100}%"></span></div>
      <div class="eso-mission-scene"><img class="eso-mission-backdrop" src="${art}" alt="" width="1440" height="810">
        <div class="eso-mission-layout"><div class="eso-mission-header"><span class="eso-mission-symbol" aria-hidden="true">${escapeHtml(scene.symbol)}</span><div><small>${escapeHtml(scene.place)} · misión ${run.missionStep + 1} de ${total}</small><h3>${escapeHtml(run.quest.title)}</h3><p>${escapeHtml(run.quest.brief)}</p></div></div>
          <div class="eso-mission-steps" aria-label="Etapas de la misión">${run.quest.stations.map((item,index)=>`<span class="${index === run.missionStep ? 'current' : index < run.missionStep ? 'complete' : ''}" ${index === run.missionStep ? 'aria-current="step"' : ''}><b>${index < run.missionStep ? '✓' : index + 1}</b>${escapeHtml(item.place)}</span>`).join('')}</div>
          <div class="eso-mission-panel"><span class="eso-mission-context">${escapeHtml(stage.context)}</span><h4>${escapeHtml(stage.prompt)}</h4><div class="eso-mission-choices">${stage.choices.map((choice,index)=>`<button type="button" class="${solved && index === stage.correct ? 'correct' : run.missionTried[stage.id]?.includes(index) ? 'wrong' : ''}" onclick="chooseMissionAnswer(${index})" ${solved || run.missionTried[stage.id]?.includes(index) ? 'disabled' : ''}><span aria-hidden="true">${String.fromCharCode(65+index)}</span>${escapeHtml(choice)}</button>`).join('')}</div><div class="eso-mission-bottom"><p class="eso-mission-feedback ${run.missionWrong !== null && !solved ? 'error' : solved ? 'success' : ''}" role="status" aria-live="polite">${escapeHtml(run.missionFeedback || 'Elige la respuesta que resuelve esta etapa.')}</p>${solved ? `<button type="button" class="primary" onclick="nextMissionStep()">${run.missionStep + 1 < total ? 'Siguiente etapa' : 'Ver resultado'} →</button>` : ''}</div></div>
        </div>
      </div>
    </div>`;
  }

  window.chooseMissionAnswer = function (index) {
    const run = gameRun;
    if (!run || run.kind !== 'quest' || run.quest?.mode !== 'story' || run.finished) return;
    const stage = run.quest.stations[run.missionStep];
    if (!stage || Number.isInteger(run.questPlaced[stage.id]) || !Number.isInteger(index) || index < 0 || index >= stage.choices.length || run.missionTried[stage.id]?.includes(index)) return;
    if (index !== stage.correct) {
      run.questMistakes += 1;
      (run.missionTried[stage.id] ||= []).push(index);
      run.missionWrong = index;
      run.missionFeedback = 'Esa opción no encaja. Lee de nuevo la situación y prueba otra.';
    } else {
      run.questPlaced[stage.id] = index;
      run.missionWrong = null;
      run.missionFeedback = `¡Correcto! ${stage.explanation}`;
    }
    renderGameRun();
  };

  window.nextMissionStep = function () {
    const run = gameRun;
    if (!run || run.kind !== 'quest' || run.quest?.mode !== 'story' || run.finished) return;
    const stage = run.quest.stations[run.missionStep];
    if (!stage || !Number.isInteger(run.questPlaced[stage.id])) return;
    if (run.missionStep + 1 >= run.quest.stations.length) return finishGame(EsoAdultGames.questScore(run.questMistakes));
    run.missionStep += 1;
    run.missionWrong = null;
    run.missionFeedback = '';
    renderGameRun();
  };

  function renderQuestRun(root, head, run, total, progress) {
    const art = EsoAdultGames.topicArt(run.topic, run.module);
    const english = EsoAdultGames.englishScene(run.topic);
    const placed = new Set(Object.values(run.questPlaced));
    const currentStation = run.quest.stations.findIndex(station => !Number.isInteger(run.questPlaced[station.id]));
    root.innerHTML = `<div class="eso-game-run eso-quest-run ${english ? 'eso-english-run eso-english-quest-run' : ''}" ${english ? `data-scene="${english.kind}"` : ''} style="--quest-tone:${moduleColor(run.module.id)}">${head}
      <div class="eso-game-progress" role="progressbar" aria-label="Estaciones completadas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${progress}"><span style="width:${progress / total * 100}%"></span></div>
      <div class="eso-quest-board ${english ? 'eso-english-quest-board' : ''}">
        <img class="eso-quest-backdrop" src="${art}" alt="" width="1200" height="675">
        <div class="eso-quest-content"><div class="eso-quest-intro"><span>${english ? escapeHtml(english.place) : '✦ MISIÓN DEL TEMA'}</span><strong>${english ? escapeHtml(english.task) : `Completa el mapa de ${escapeHtml(run.topic.title)}`}</strong><small>${progress} de ${total} estaciones · ${run.questMistakes} fallos</small></div>
          <div class="eso-quest-stations">${run.quest.stations.map((station, index) => {
            const cardIndex = run.questPlaced[station.id];
            const complete = Number.isInteger(cardIndex);
            return `<button type="button" class="eso-quest-station ${complete ? 'complete' : ''} ${currentStation === index ? 'current' : ''} ${run.questErrorStation === index ? 'wrong' : ''}" onclick="placeQuestCard(${index})" ondragover="event.preventDefault()" ondrop="dropQuestCard(event,${index})" ${complete ? 'disabled' : ''} ${currentStation === index ? 'aria-current="step"' : ''}><span class="eso-quest-station-number">${String(index + 1).padStart(2, '0')}</span><span class="eso-quest-station-content">${english ? `<span class="eso-english-station-place">${escapeHtml(english.stations[index])}</span>` : ''}<strong>${escapeHtml(station.prompt)}</strong><small>${complete ? escapeHtml(run.quest.cards[cardIndex].text) : 'Toca aquí después de elegir una pieza'}</small></span><span class="eso-quest-station-state" aria-hidden="true">${complete ? '✓' : '＋'}</span></button>`;
          }).join('')}</div></div>
      </div>
      <div class="eso-quest-bank"><div class="eso-quest-bank-head"><strong>Piezas de respuesta</strong><span>Selecciona una y toca su estación, o arrástrala.</span></div><div class="eso-quest-pieces">${run.quest.cards.map((card, index) => placed.has(index) ? '' : `<button type="button" draggable="true" class="eso-quest-piece ${run.questSelected === index ? 'selected' : ''}" aria-pressed="${run.questSelected === index}" onclick="selectQuestCard(${index})" ondragstart="dragQuestCard(event,${index})"><span aria-hidden="true">✦</span>${escapeHtml(card.text)}</button>`).join('')}</div></div>
      <p class="eso-quest-feedback ${run.questErrorStation !== null ? 'error' : ''}" role="status" aria-live="polite">${escapeHtml(run.questFeedback)}</p>
    </div>`;
  }

  window.selectQuestCard = function (index) {
    const run = gameRun;
    if (!run || run.kind !== 'quest' || run.finished || !run.quest.cards[index] || Object.values(run.questPlaced).includes(index)) return;
    run.questSelected = run.questSelected === index ? null : index;
    run.questErrorStation = null;
    run.questFeedback = run.questSelected === null ? 'Selecciona otra pieza para continuar.' : 'Ahora toca la estación a la que corresponde la pieza.';
    renderGameRun();
  };

  window.dragQuestCard = function (event, index) {
    if (!gameRun || gameRun.kind !== 'quest' || gameRun.finished) return;
    event.dataTransfer.setData('text/plain', String(index));
    event.dataTransfer.effectAllowed = 'move';
  };

  window.dropQuestCard = function (event, stationIndex) {
    event.preventDefault();
    const value = event.dataTransfer.getData('text/plain');
    if (!/^\d+$/.test(value)) return;
    const index = Number(value);
    if (Number.isInteger(index)) placeQuestCard(stationIndex, index);
  };

  window.placeQuestCard = function (stationIndex, droppedCardIndex) {
    const run = gameRun;
    if (!run || run.kind !== 'quest' || run.finished || !run.quest.stations[stationIndex] || Number.isInteger(run.questPlaced[stationIndex])) return;
    const cardIndex = Number.isInteger(droppedCardIndex) ? droppedCardIndex : run.questSelected;
    if (!Number.isInteger(cardIndex) || !run.quest.cards[cardIndex] || Object.values(run.questPlaced).includes(cardIndex)) {
      run.questFeedback = 'Elige primero una pieza de respuesta.';
      renderGameRun();
      return;
    }
    const station = run.quest.stations[stationIndex];
    if (run.quest.cards[cardIndex].station !== station.id) {
      run.questMistakes += 1;
      run.questErrorStation = stationIndex;
      run.questFeedback = 'Esa pieza no corresponde a esta estación. Prueba en otra o elige otra respuesta.';
      renderGameRun();
      return;
    }
    run.questPlaced[stationIndex] = cardIndex;
    run.questSelected = null;
    run.questErrorStation = null;
    run.questFeedback = `¡Bien colocado! ${station.explanation || 'Has relacionado la idea con su lugar en el mapa.'}`;
    if (Object.keys(run.questPlaced).length === run.quest.stations.length) finishGame(EsoAdultGames.questScore(run.questMistakes));
    else renderGameRun();
  };

  window.chooseGameAnswer = function (index) {
    const run = gameRun;
    if (!run || run.finished || run.kind !== 'quiz' || run.selected !== null) return;
    const question = run.questions[run.round];
    if (!Number.isInteger(index) || index < 0 || index >= question.choices.length) return;
    run.selected = index;
    run.answers.push(index === question.correct);
    renderGameRun();
  };

  window.nextGameRound = function () {
    const run = gameRun;
    if (!run || run.selected === null) return;
    if (run.round + 1 >= run.questions.length) return finishGame(Math.round(run.answers.filter(Boolean).length / run.questions.length * 100));
    run.round += 1;
    run.selected = null;
    renderGameRun();
  };

  window.flipGameCard = function (index) {
    const run = gameRun;
    if (!run || run.kind !== 'pairs' || run.finished || run.locked || !run.cards[index] || run.matched.has(run.cards[index].pair) || index === run.first) return;
    if (run.first === null) { run.first = index; renderGameRun(); return; }
    run.second = index;
    run.moves += 1;
    run.locked = true;
    renderGameRun();
    if (run.cards[run.first].pair === run.cards[index].pair) {
      run.matched.add(run.cards[index].pair);
      run.first = null;
      run.second = null;
      run.locked = false;
      if (run.matched.size === run.cards.length / 2) finishGame(EsoAdultGames.pairsScore(run.moves, run.matched.size));
      else renderGameRun();
      return;
    }
    window.setTimeout(() => {
      if (gameRun !== run || run.finished) return;
      run.first = null;
      run.second = null;
      run.locked = false;
      renderGameRun();
    }, 850);
  };

  function finishGame(score) {
    const run = gameRun;
    if (!run || run.finished) return;
    run.finished = true;
    run.score = score;
    run.saveStatus = 'pending';
    state.gameResults = state.gameResults && typeof state.gameResults === 'object' ? state.gameResults : {};
    const topicResults = state.gameResults[run.topic.id] || {};
    const previous = topicResults[run.kind];
    topicResults[run.kind] = {best: Math.max(score, Number(previous?.best || 0)), last: score, completedAt: new Date().toISOString()};
    state.gameResults[run.topic.id] = topicResults;
    recordStudyActivity();
    run.rewardPending = score >= 70 && Number(previous?.best || 0) < 70;
    void persistGameResult(run);
    renderShell();
    renderGameRun();
  }
  async function persistGameResult(run) {
    const saved = await saveState();
    run.saveStatus = saved ? 'saved' : 'failed';
    if (saved && run.rewardPending) {
      run.rewardPending = false;
      void grantGamificationReward('EXERCISE_SET_COMPLETED', `game:${run.kind}:${run.topic.id}`, {topic_id: run.topic.id, module_id: run.module.id, score:run.score});
    }
    if (gameRun === run) renderGameRun();
  }
  window.retryGameSave = function () {
    const run = gameRun;
    if (!run?.finished || run.saveStatus !== 'failed') return;
    run.saveStatus = 'pending';
    renderGameRun();
    void persistGameResult(run);
  };
}
