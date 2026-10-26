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

  const api = {topicQuiz, topicPairs, pairsScore};
  root.EsoAdultGames = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);

if (typeof window !== 'undefined') {
  let gameSubject = 'all';
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
    const completed = Object.values(state.gameResults || {}).reduce((sum, results) => sum + ['quiz', 'pairs'].filter(kind => results?.[kind]).length, 0);
    root.innerHTML = `<div class="eso-games-hero"><div><span class="eyebrow">Practica a tu ritmo</span><h2>Juegos por tema</h2><p>Elige una asignatura y repasa con preguntas o parejas de conceptos. Guardamos tu mejor resultado y la primera vez que superes el 70 % ganas XP y monedas para tu escritorio.</p></div><span class="eso-games-hero-art" aria-hidden="true">✦</span></div>
      <div class="eso-games-filters" role="group" aria-label="Filtrar juegos por asignatura"><strong>Asignaturas</strong><button type="button" class="${gameSubject === 'all' ? 'active' : ''}" aria-pressed="${gameSubject === 'all'}" onclick="filterGames('all')">Todas</button>${subjects.map(module => `<button type="button" class="${gameSubject === module.id ? 'active' : ''}" aria-pressed="${gameSubject === module.id}" onclick="filterGames('${module.id}')">${escapeHtml(module.title)}</button>`).join('')}</div>
      <div class="eso-games-groups">${visible.map(module => `<section class="eso-game-subject" style="--subject-color:${moduleColor(module.id)}"><div class="eso-game-subject-head"><span class="subject-symbol" aria-hidden="true">${escapeHtml(topicVisual({}, module.id))}</span><div><h3>${escapeHtml(module.title)}</h3><small>${module.tasks.length} temas · dos formas de practicar cada uno</small></div></div><div class="eso-game-cards">${module.tasks.map((topic, index) => {
        const results = state.gameResults?.[topic.id] || {};
        const scores = [results.quiz?.best, results.pairs?.best].filter(Number.isFinite);
        return `<article class="eso-game-card"><div class="game-card-top"><span class="game-card-index">${String(index + 1).padStart(2, '0')}</span><span class="game-card-best">${scores.length ? `Mejor: ${Math.max(...scores)} %` : 'Por descubrir'}</span></div><h4>${escapeHtml(topic.title)}</h4><p>${escapeHtml(topic.detail)}</p><div class="game-card-actions"><button type="button" onclick="startGame('${topic.id}','quiz')">Reto rápido</button><button type="button" onclick="startGame('${topic.id}','pairs')">Parejas</button></div></article>`;
      }).join('')}</div></section>`).join('')}</div><p class="eso-games-empty">${completed} juegos completados · puedes repetirlos cuando quieras.</p>`;
  };

  window.startGame = function (topicId, kind = 'quiz') {
    const topic = allTasks().find(item => item.id === topicId);
    if (!topic) return;
    const module = moduleById(topic.module);
    const mode = kind === 'pairs' ? 'pairs' : 'quiz';
    const questions = mode === 'quiz' ? EsoAdultGames.topicQuiz(topic, module, MODEL_UNITS) : [];
    const cards = mode === 'pairs' ? EsoAdultGames.topicPairs(topic, module) : [];
    if ((mode === 'quiz' && !questions.length) || (mode === 'pairs' && cards.length < 4)) return;
    gameSubject = module.id;
    currentView = 'games';
    gameRun = {topic, module, kind: mode, questions, cards, round: 0, answers: [], selected: null, first: null, second: null, matched: new Set(), moves: 0, locked: false, finished: false};
    renderGames();
    renderView();
    window.scrollTo({top: 0, behavior: 'auto'});
  };

  function renderGameRun() {
    const root = document.getElementById('gamesView');
    const run = gameRun;
    if (!root || !run) return;
    const label = run.kind === 'quiz' ? 'Reto rápido' : 'Parejas de conceptos';
    const total = run.kind === 'quiz' ? run.questions.length : run.cards.length / 2;
    const progress = run.kind === 'quiz' ? run.round + (run.selected === null ? 0 : 1) : run.matched.size;
    const head = `<div class="eso-game-run-head"><button type="button" onclick="openGames('${run.module.id}')" aria-label="Volver a los juegos">←</button><div><h2>${escapeHtml(run.topic.title)}</h2><p>${escapeHtml(run.module.title)} · ${label}</p></div></div>`;
    if (run.finished) {
      const score = run.score;
      root.innerHTML = `<div class="eso-game-run">${head}<div class="eso-game-result"><span class="result-medal" aria-hidden="true">${score >= 70 ? '★' : '↻'}</span><h3>${score >= 70 ? '¡Buen trabajo!' : 'Sigue practicando'}</h3><p>${run.kind === 'quiz' ? `${run.answers.filter(Boolean).length} de ${total} respuestas correctas` : `${total} parejas encontradas en ${run.moves} intentos`} · ${score} %.</p><p>Tu resultado está guardado. Puedes volver al tema o repetir el juego.</p><div class="result-actions"><button class="primary" type="button" onclick="startGame('${run.topic.id}','${run.kind}')">Jugar de nuevo</button><button type="button" onclick="openGames('${run.module.id}')">Ver más juegos</button><button type="button" onclick="openModule('${run.module.id}');openTopic('${run.topic.id}')">Estudiar el tema</button></div></div></div>`;
      return;
    }
    if (run.kind === 'quiz') {
      const question = run.questions[run.round];
      const answered = run.selected !== null;
      root.innerHTML = `<div class="eso-game-run">${head}<div class="eso-game-progress" role="progressbar" aria-label="Rondas completadas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${progress}"><span style="width:${progress / total * 100}%"></span></div><div class="eso-game-question"><span class="round-label">Ronda ${run.round + 1} de ${total}</span><h3>${escapeHtml(question.prompt)}</h3><div class="eso-game-options">${question.choices.map((choice, index) => `<button type="button" class="${answered && index === question.correct ? 'correct' : answered && index === run.selected ? 'wrong' : ''}" onclick="chooseGameAnswer(${index})" ${answered ? 'disabled' : ''}><b>${String.fromCharCode(65 + index)}</b><span>${escapeHtml(choice)}</span></button>`).join('')}</div><div class="eso-game-feedback ${answered && run.selected !== question.correct ? 'error' : ''}" role="status">${answered ? `<strong>${run.selected === question.correct ? '✓ Correcto' : 'Respuesta para repasar'}</strong>${escapeHtml(question.explanation)}` : 'Elige una respuesta para avanzar.'}</div></div><div class="eso-game-next">${answered ? `<button class="primary" type="button" onclick="nextGameRound()">${run.round + 1 < total ? 'Siguiente ronda' : 'Ver resultado'} →</button>` : ''}</div></div>`;
      return;
    }
    root.innerHTML = `<div class="eso-game-run">${head}<div class="eso-game-progress" role="progressbar" aria-label="Parejas encontradas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${progress}"><span style="width:${progress / total * 100}%"></span></div><div class="eso-game-question"><span class="round-label">${progress} de ${total} parejas</span><h3>Une cada tema con su idea principal</h3><div class="eso-game-pairs">${run.cards.map((card, index) => {
      const revealed = run.matched.has(card.pair) || run.first === index || run.second === index;
      return `<button type="button" class="${run.matched.has(card.pair) ? 'matched' : revealed ? 'revealed' : ''}" onclick="flipGameCard(${index})" aria-label="${revealed ? escapeHtml(card.kind + ': ' + card.text) : `Destapar tarjeta ${index + 1}`}" ${run.matched.has(card.pair) || run.locked ? 'disabled' : ''}>${revealed ? escapeHtml(card.text) : '✦'}</button>`;
    }).join('')}</div><div class="eso-game-pairs-status" role="status">${run.locked ? 'Estas tarjetas no forman pareja.' : run.first !== null ? 'Elige la tarjeta que completa la pareja.' : `${run.moves} intentos · observa los temas y sus ideas.`}</div></div></div>`;
  }

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
    state.gameResults = state.gameResults && typeof state.gameResults === 'object' ? state.gameResults : {};
    const topicResults = state.gameResults[run.topic.id] || {};
    const previous = topicResults[run.kind];
    topicResults[run.kind] = {best: Math.max(score, Number(previous?.best || 0)), last: score, completedAt: new Date().toISOString()};
    state.gameResults[run.topic.id] = topicResults;
    recordStudyActivity();
    if (score >= 70 && Number(previous?.best || 0) < 70) void grantGamificationReward('EXERCISE_SET_COMPLETED', `game:${run.kind}:${run.topic.id}`, {topic_id: run.topic.id, module_id: run.module.id, score});
    void saveState();
    renderShell();
    renderGameRun();
  }
}
