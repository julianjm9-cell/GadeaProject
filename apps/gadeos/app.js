import { restaurants, clearRestaurantMap } from './restaurants.js';
const $ = id => document.getElementById(id);
const apiRoot = '/api/arena-chinchon';
const art = name => '/aventura-chinchon-assets/art/' + name + '-v2.webp';
const total = () => state.campaign.stations.length;
// Percent coordinates on the native 1024 × 1536 illustration, from the start to the town.
const routeStops = [[58,93], [47,82], [70,72], [40,65], [28,55.5], [64,50.5], [20,35.6], [75,28.5], [49,23.3]];
let state, busy = false, selectedCard = null;
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const icon = name => { const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); const use = document.createElementNS(node.namespaceURI, 'use'); use.setAttribute('href', '#i-' + name); node.append(use); node.setAttribute('aria-hidden', 'true'); return node; };
function button(text, action, className = '') { const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', action); return node; }
function note(text) { $('notice').textContent = text; $('notice').hidden = !text; clearTimeout(note.timer); note.timer = setTimeout(() => { $('notice').hidden = true; }, 6000); }

async function api(path, body) {
  const response = await fetch(apiRoot + path, { credentials: 'same-origin', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) { const error = new Error(typeof data.detail === 'string' ? data.detail : 'No se ha podido completar la operación. Revisa los datos.'); error.status = response.status; throw error; }
  return data;
}
async function load() {
  try { state = await api('/state'); showGame(); render(); }
  catch (error) { if (error.status === 401) showLogin(); else note(error.message); }
}
function showLogin() { clearRestaurantMap(); state = null; document.body.dataset.view = 'login'; $('login-screen').hidden = false; $('game-screen').hidden = true; for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); }
function showGame() { $('login-screen').hidden = true; $('game-screen').hidden = false; }

$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  busy = true; const submit = event.target.querySelector('[type=submit]'); submit.disabled = true; $('login-error').hidden = true;
  try { await api('/login', Object.fromEntries(new FormData(event.target))); event.target.elements.password.value = ''; await load(); }
  catch (error) { $('login-error').textContent = error.message; $('login-error').hidden = false; }
  finally { busy = false; submit.disabled = false; }
});
$('logout').addEventListener('click', async () => { try { await api('/logout', {}); showLogin(); } catch (error) { note(error.message); } });
document.querySelectorAll('dialog .close').forEach(node => node.addEventListener('click', () => node.closest('dialog').close()));
const rewardDialog = $('reward');
rewardDialog.addEventListener('click', () => { if (rewardDialog.dataset.rewardView === 'celebration') rewardDialog.close(); });
rewardDialog.addEventListener('keydown', event => {
  if (rewardDialog.dataset.rewardView === 'celebration' && ['Enter', ' '].includes(event.key)) { event.preventDefault(); rewardDialog.close(); }
});
rewardDialog.addEventListener('close', () => {
  const celebrate = rewardDialog.dataset.rewardView === 'celebration';
  delete rewardDialog.dataset.rewardView;
  if (!celebrate || !state) return;
  const page = state.completed >= total() ? 'batalla' : 'recorrido';
  if (location.hash !== '#' + page) location.hash = page;
  else render();
  requestAnimationFrame(() => {
    if (!state) return;
    const next = document.querySelector('[data-station="' + (state.completed + 1) + '"]') || $('main');
    next.focus({ preventScroll: true });
  });
});
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

async function action(path, payload = {}) {
  const request = { ...payload, revision: state.revision, request_id: crypto.randomUUID() };
  const storageKey = 'arena-pending:' + state.account.id;
  try {
    const pending = JSON.parse(sessionStorage.getItem(storageKey));
    if (pending?.path === path && JSON.stringify(pending.payload) === JSON.stringify(payload) && pending.revision === state.revision) request.request_id = pending.id;
    sessionStorage.setItem(storageKey, JSON.stringify({ path, payload, revision: state.revision, id: request.request_id }));
  } catch {}
  try {
    const result = await api(path, request);
    state = result;
    try { sessionStorage.removeItem(storageKey); } catch {}
    return result;
  } catch (error) {
    if (error.status === 409) await load();
    if (error.status === 401) showLogin();
    throw error;
  }
}

function cardArt(card) {
  const node = el('button', 'collectible' + (card.owned ? '' : ' locked'));
  node.type = 'button'; node.setAttribute('aria-label', card.owned ? 'Ver carta ' + card.title : 'Carta ' + card.id + ', bloqueada');
  if (card.owned && card.image) { const img = el('img'); img.src = card.image; img.alt = ''; img.loading = 'lazy'; node.append(img); }
  else { const image = el('img', 'card-emblem'); image.src = art('emblem'); image.alt = ''; node.append(image); }
  node.append(el('strong', '', card.owned ? card.title : 'Sobre ' + card.id));
  return node;
}
function packArt(className = '') {
  const pack = el('div', 'envelope ' + className); pack.setAttribute('aria-hidden', 'true');
  const image = el('img'); image.src = state.campaign.media?.envelope || art('envelope'); image.alt = ''; pack.append(image);
  return pack;
}
function reward() {
  const host = $('reward-content'); host.replaceChildren();
  const pair = el('div', 'reward-pair'); pair.append(packArt('earned-pack'), packArt('earned-pack')); host.append(pair);
  rewardDialog.dataset.rewardView = 'celebration';
  rewardDialog.removeAttribute('aria-labelledby');
  rewardDialog.setAttribute('aria-label', 'Dos sobres conseguidos. Toca para continuar o pulsa Intro o Escape.');
  if (!rewardDialog.open) rewardDialog.showModal();
  rewardDialog.focus();
}
function home(host) {
  const schedule = state.campaign.planning || { day: 'Viernes', place: 'Chinchón', start: '16:00', final: '22:00' };
  const overview = el('div', 'home-overview'); host.append(overview);
  overview.append(el('p', 'greeting', 'TU TRIBUTO · ' + state.account.name));
  const hero = el('section', 'home-hero');
  const image = el('img', 'event-poster'); image.src = art('alliance-hero'); image.alt = ''; image.fetchPriority = 'high'; hero.append(image);
  const copy = el('div', 'poster-copy'); copy.append(el('p', 'eyebrow', schedule.day + ' · ' + schedule.place), el('h1', '', state.campaign.title), el('p', '', state.campaign.intro)); hero.append(copy); overview.append(hero);
  const next = el('a', 'primary next-step', state.completed >= total() ? 'Ir a la batalla final →' : state.completed ? 'Continuar: prueba ' + (state.completed + 1) + ' →' : 'Empezar el recorrido →'); next.href = state.completed >= total() ? '#batalla' : '#recorrido'; overview.append(next);
  const planning = el('section', 'planning'); planning.append(el('h2', '', 'Vuestro planning'));
  if (schedule.transport) planning.append(el('p', 'planning-transport', schedule.transport));
  for (const [index, day] of (schedule.days || []).entries()) {
    const section = el('section', 'planning-day');
    const head = el('div', 'planning-day-title'); head.append(el('span', 'day-symbol', index ? '☀' : '☾'), el('h3', '', day.title)); section.append(head);
    if (day.locked) { const blocked = el('p', 'planning-locked'); blocked.append(icon('lock'), document.createTextNode('BLOQUEADO')); section.append(blocked); planning.append(section); continue; }
    section.append(el('p', 'day-subtitle', day.subtitle));
    const list = el('ol', 'planning-list');
    for (const activity of day.activities) { const row = el('li', activity.locked ? 'planning-locked' : ''); if (activity.locked) row.append(icon('lock'), el('span', '', 'BLOQUEADO')); else row.append(el('time', 'planning-time', activity.time), el('span', '', activity.text)); list.append(row); }
    section.append(list); planning.append(section);
  }
  const food = el('a', 'planning-food-link', 'Dónde comer en Chinchón →'); food.href = '#restaurantes'; planning.append(food); host.append(planning);
}

function journey(host) {
  const heading = el('header', 'journey-heading'), count = el('span', 'route-count', state.completed + ' / ' + total());
  count.setAttribute('aria-label', state.completed + ' de ' + total() + ' pruebas completadas');
  heading.append(el('h1', '', 'Recorrido'), count); host.append(heading);
  const list = el('div', 'journey');
  list.setAttribute('role', 'group'); list.setAttribute('aria-label', 'Camino de las nueve pruebas');
  const image = el('img', 'journey-map'); image.src = art('journey'); image.alt = ''; image.width = 1024; image.height = 1536; list.append(image);
  for (const station of state.campaign.stations) {
    const node = button(String(station.number), () => challenge(station), 'station ' + (station.locked ? 'locked' : station.completed ? 'done' : 'current'));
    node.disabled = station.locked; node.dataset.station = station.number;
    node.setAttribute('aria-label', 'Prueba ' + station.number + (station.locked ? ', bloqueada' : station.completed ? ', completada' : ', siguiente prueba'));
    if (!station.locked && !station.completed) node.setAttribute('aria-current', 'step');
    const [x, y] = routeStops[station.number - 1]; node.style.left = x + '%'; node.style.top = y + '%'; list.append(node);
  }
  host.append(list);
  requestAnimationFrame(() => {
    if (!list.isConnected) return;
    const next = list.querySelector('.current'); if (!next) return;
    const bounds = next.getBoundingClientRect(), bottom = document.querySelector('.bottom-nav').getBoundingClientRect().top;
    if (bounds.top < 8 || bounds.bottom > bottom - 12) next.scrollIntoView({ block: 'center' });
  });
}

function challenge(station) {
  const host = $('challenge-content'); host.replaceChildren();
  host.append(el('p', 'eyebrow', 'PRUEBA ' + String(station.number).padStart(2, '0') + ' / ' + total()));
  const title = el('h2', 'challenge-prompt', station.title); title.id = 'challenge-title'; host.append(title);
  if (station.completed) {
    host.append(button('Ver sobres', () => { $('challenge').close(); reward(); }, 'primary'));
    $('challenge').showModal(); return;
  }
  const form = el('form'), error = el('p', 'error'); error.setAttribute('role', 'alert'); error.hidden = true;
  const label = el('label', '', 'Tu respuesta'), input = el('input'); input.name = 'answer'; input.required = true; input.autocomplete = 'off'; input.maxLength = 100; label.append(input); form.append(label);
  let answer = ''; input.addEventListener('input', () => { answer = input.value; });

  const submit = el('button', 'primary', 'Comprobar'); submit.type = 'submit'; form.append(submit, error);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return; error.hidden = true;
    if (!answer || (Array.isArray(answer) && !answer.length)) { error.textContent = 'Resuelve la prueba antes de comprobar.'; error.hidden = false; return; }
    busy = true; submit.disabled = true;
    try { await action('/stations/answer', { station: station.number, campaign_revision: state.campaign.revision, answer }); $('challenge').close(); render(); reward(); }
    catch (problem) { error.textContent = problem.message; error.hidden = false; }
    finally { busy = false; submit.disabled = false; }
  });
  host.append(form); $('challenge').showModal();
}

async function startBattle() {
  if (busy) return; busy = true;
  try { await action('/battle/start'); selectedCard = null; render(); } catch (error) { note(error.message); } finally { busy = false; }
}
async function move(actionName) {
  if (busy) return; busy = true; document.querySelectorAll('.battle-actions button').forEach(node => { node.disabled = true; });
  try { await action('/battle/action', { action: actionName, card: selectedCard }); selectedCard = null; render(); } catch (error) { note(error.message); } finally { busy = false; document.querySelectorAll('.battle-actions button').forEach(node => { node.disabled = false; }); }
}
function battle(host) {
  host.append(el('p', 'eyebrow', 'LA ÚLTIMA ALIANZA'), el('h1', '', 'La batalla final'));
  if (state.completed < total()) { const locked = el('section', 'battle-lock'); locked.append(icon('lock'), el('h2', '', 'La arena aún no está abierta'), el('p', '', 'Completa las ' + total() + ' pruebas del recorrido para enfrentarte al centinela.'), button('Volver al recorrido', () => { location.hash = 'recorrido'; }, 'primary')); host.append(locked); return; }
  const fight = state.battle;
  if (!fight || fight.state !== 'playing') {
    const start = el('section', 'battle-result'); start.append(el('div', 'trophy'), el('h2', '', fight?.state === 'won' ? 'Vuestra alianza ha vencido' : fight?.state === 'lost' ? 'La arena te da otra oportunidad' : state.campaign.boss),
      el('p', '', fight?.state === 'won' ? state.campaign.ending : 'Lee la intención del centinela, elige tu estrategia y usa tus cartas. Tienes doce turnos. Tus sobres y estaciones siempre se conservan.'),
      button(fight ? 'Jugar otra batalla' : 'Entrar en la arena', startBattle, 'primary')); host.append(start); return;
  }
  const arena = el('section', 'battle-arena'), fighters = el('div', 'combatants'); arena.dataset.intent = fight.intent;
  for (const [name, energy, max, symbol, cls] of [[state.account.name, fight.energy, 28, '✦', ''], [state.campaign.boss, fight.boss_energy, 30, '♜', ' boss']]) {
    const actor = el('div', 'combatant' + cls); const meter = el('progress'); meter.max = max; meter.value = energy; meter.setAttribute('aria-label', 'Energía de ' + name); actor.append(el('small', '', name), el('strong', '', symbol), meter, el('p', '', energy + '/' + max)); fighters.append(actor);
  }
  arena.append(fighters, el('p', 'intent', ({ strike: 'Levanta su arma. Defenderse frenará el ataque.', feint: 'Baja la guardia. Es tu momento para atacar.', charge: 'Acumula energía. Concéntrate para recuperar fuerzas.' })[fight.intent])); host.append(arena);
  const line = el('div', 'section-line'); line.append(el('small', '', 'TURNO ' + (fight.turn + 1) + ' / 12'), el('small', '', fight.focus ? 'Concentración ×' + fight.focus : 'Elige tu siguiente movimiento')); host.append(line);
  const actions = el('div', 'battle-actions');
  for (const [id, symbol, title, sub] of [['attack', '↗', 'Atacar', 'Aprovecha su guardia'], ['guard', '◇', 'Defender', 'Protege tu energía'], ['focus', '✧', 'Concentrar', 'Prepara tu fuerza']]) { const control = button('', () => move(id)); control.dataset.move = id; control.append(el('span', '', symbol), el('strong', '', title), el('small', '', sub)); actions.append(control); }
  host.append(actions, button(selectedCard ? 'Carta preparada: ' + state.cards[selectedCard - 1].title + ' · cambiar' : 'Preparar una carta · bonus de alianza', chooseCard, 'card-select'), el('p', 'battle-log', fight.log));
}
function chooseCard() {
  rewardDialog.dataset.rewardView = 'cards'; rewardDialog.removeAttribute('aria-label'); rewardDialog.setAttribute('aria-labelledby', 'reward-title');
  const host = $('reward-content'); host.replaceChildren(); const title = el('h2', '', 'Tu carta de alianza'); title.id = 'reward-title'; host.append(title, el('p', 'muted', 'Cada carta puede usarse una vez por batalla. Añade fuerza o recuperación a tu siguiente movimiento.'));
  const grid = el('div', 'collection'); for (const card of state.cards) { const node = cardArt(card); node.disabled = state.battle.used_cards.includes(card.id); const clone = node.cloneNode(true); clone.addEventListener('click', () => { selectedCard = card.id; $('reward').close(); render(); }); grid.append(clone); }
  host.append(grid, button('Jugar sin carta', () => { selectedCard = null; $('reward').close(); render(); }, 'quiet')); $('reward').showModal();
}
function render() {
  if (!state) return;
  const page = ['inicio', 'recorrido', 'batalla', 'restaurantes'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio';
  document.body.dataset.view = page;
  clearRestaurantMap(); $('main').replaceChildren();
  ({ inicio: home, recorrido: journey, batalla: battle, restaurantes: restaurants })[page]($('main'));
  document.querySelectorAll('.bottom-nav a').forEach(node => { if (node.hash === '#' + page) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
}
load();
