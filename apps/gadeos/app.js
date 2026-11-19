import { restaurants, clearRestaurantMap, projectTownPoint } from './restaurants.js';
const $ = id => document.getElementById(id);
const apiRoot = '/api/arena-hambre';
const art = name => '/aventura-hambre-assets/art/' + name + '-v2.webp';
const total = () => state.campaign.stations.length;
const arrived = () => state.campaign.stations[0].completed && state.campaign.stations[1].completed;
// Geographic frame of the town artwork in the shared 1200 × 900 projection.
const townBounds = [[310, 180], [745, 570]];
// Geographic coordinates and offsets as percentages of the map.
const townStops = {
  3: [40.1398503, -3.4224314, 8, 9], // Refugio
  4: [40.1408669, -3.4234410, -4, -7], // Torre del Reloj
  5: [40.1410785, -3.4222572, 10, 0], // Iglesia
  6: [40.1398678, -3.4229153, 0, -10], // Taberna
  7: [40.1413820, -3.4228909, 0, -4], // Teatro
  8: [40.1399504, -3.4230726, -12, 4], // Escudo: ayuntamiento
};
let state, busy = false, selectedCard = null;
let townMap, townView;
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
function showLogin() { clearRestaurantMap(); clearTownMap(); townView = null; state = null; document.body.dataset.view = 'login'; $('login-screen').hidden = false; $('game-screen').hidden = true; for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); }
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
  const schedule = state.campaign.planning || { day: 'Viernes' };
  const overview = el('div', 'home-overview'); host.append(overview);
  overview.append(el('p', 'greeting', 'TU TRIBUTO · ' + state.account.name));
  const hero = el('section', 'home-hero');
  const image = el('img', 'event-poster'); image.src = art('alliance-hero'); image.alt = ''; image.fetchPriority = 'high'; hero.append(image);
  const companions = el('img', 'hero-companions'); companions.src = apiRoot + '/companions.png'; companions.alt = ''; companions.setAttribute('aria-hidden', 'true'); companions.width = 480; companions.height = 728; hero.append(companions);
  const copy = el('div', 'poster-copy'); copy.append(el('p', 'eyebrow', schedule.day), el('h1', '', state.campaign.title), el('p', '', state.campaign.intro)); hero.append(copy); overview.append(hero);
  if (!state.home_only) {
    const next = el('a', 'primary next-step', state.completed >= total() ? 'Ir a la batalla final →' : state.completed ? 'Continuar el recorrido →' : 'Empezar el recorrido →');
    next.href = state.completed >= total() ? '#batalla' : '#recorrido';
    overview.append(next);
  }
  const planning = el('section', 'planning'); planning.append(el('h2', '', 'Vuestro planning'));
  if (schedule.transport) planning.append(el('p', 'planning-transport', schedule.transport));
  for (const [index, day] of (schedule.days || []).entries()) {
    const section = el('section', 'planning-day');
    const head = el('div', 'planning-day-title'); head.append(el('span', 'day-symbol', index ? '☀' : '☾'), el('h3', '', day.title)); section.append(head);
    if (day.locked) { const blocked = el('p', 'planning-locked'); blocked.append(icon('lock'), document.createTextNode('BLOQUEADO')); section.append(blocked); planning.append(section); continue; }
    if (day.subtitle) section.append(el('p', 'day-subtitle', day.subtitle));
    const list = el('ol', 'planning-list');
    for (const activity of day.activities) {
      const row = el('li', activity.locked ? 'planning-locked' : '');
      if (activity.locked) {
        row.append(icon('lock'), el('span', '', 'BLOQUEADO'));
      } else {
        if (activity.time) row.append(el('time', 'planning-time', activity.time));
        row.append(el('span', '', activity.text));
      }
      list.append(row);
    }
    section.append(list); planning.append(section);
  }
  if (!state.home_only && arrived()) {
    const food = el('a', 'planning-food-link', 'Dónde comer →');
    food.href = '#restaurantes';
    planning.append(food);
  }
  host.append(planning);
}

function clearTownMap() {
  if (!townMap) return;
  townMap.remove();
  townMap = null;
}

function townChallenges(section, frame, stations, stop) {
  const L = globalThis.L;
  if (!L) {
    frame.remove();
    const shortcuts = el('div', 'journey-extras');
    for (const station of stations) shortcuts.append(stop(station, 'Prueba ' + station.number));
    section.append(shortcuts);
    return;
  }

  const bounds = L.latLngBounds(townBounds);
  const map = L.map(frame, {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2,
    zoomSnap: 0.1,
    zoomDelta: 0.5,
    maxBounds: bounds.pad(0.45),
    scrollWheelZoom: false,
    zoomControl: false,
    zoomAnimation: false,
    fadeAnimation: false
  });
  townMap = map;
  const fitTown = () => map.fitBounds(bounds, { animate: false });
  if (townView) map.setView(townView.center, townView.zoom);
  else fitTown();
  map.on('moveend', () => { townView = { center: map.getCenter(), zoom: map.getZoom() }; });
  L.control.zoom({ zoomInTitle: 'Ampliar mapa', zoomOutTitle: 'Alejar mapa' }).addTo(map);
  map.attributionControl.setPrefix(false);
  L.imageOverlay('/aventura-hambre-assets/journey-town.svg', bounds, {
    alt: '',
    className: 'journey-map',
    attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap · ODbL</a>'
  }).addTo(map);
  section.querySelector('.town-reset').addEventListener('click', fitTown);

  for (const station of stations) {
    const [lat, lon, dx, dy] = townStops[station.number];
    const [y, x] = projectTownPoint([lat, lon]);
    const point = [y, x];
    const label = [y - dy * 4.35, x + dx * 3.9];
    const control = stop(station);
    L.polyline([point, label], { color: '#f4d285', weight: 1.5, interactive: false }).addTo(map);
    L.circleMarker(point, { className: 'town-anchor', radius: 4, color: '#fff2bb', weight: 1, fillColor: '#e1a24e', fillOpacity: 1, interactive: false }).addTo(map);
    L.DomEvent.disableClickPropagation(control);
    L.marker(label, {
      icon: L.divIcon({ html: control, className: 'town-marker', iconSize: [48, 48], iconAnchor: [24, 24] }),
      keyboard: false
    }).addTo(map);
  }
}

function journey(host) {
  const heading = el('header', 'journey-heading'), count = el('span', 'route-count', state.completed + ' / ' + total());
  count.setAttribute('aria-label', state.completed + ' de ' + total() + ' pruebas completadas');
  heading.append(el('h1', '', 'Recorrido'), count); host.append(heading);
  const [bus, riddle, ...town] = state.campaign.stations;
  function stop(station, text = String(station.number)) {
    const control = button(text, () => challenge(station), 'station ' + (station.locked ? 'locked' : station.completed ? 'done' : 'current'));
    control.disabled = station.locked;
    control.dataset.station = station.number;
    const status = station.pending ? 'pendiente de configurar' : station.locked ? 'bloqueada' : station.completed ? 'completada' : 'disponible';
    control.setAttribute('aria-label', 'Prueba ' + station.number + ', ' + status);
    return control;
  }
  if (!arrived()) {
    const scene = el('section', 'journey journey-bus');
    scene.setAttribute('aria-label', 'Viaje en autobús');
    const image = el('img', 'journey-map');
    image.src = art('journey-bus');
    image.alt = '';
    scene.append(image, el('h2', 'bus-title', 'De camino'));
    const stops = el('div', 'bus-stops');
    stops.append(stop(bus), stop(riddle));
    scene.append(stops);
    host.append(scene);
    return;
  }
  const section = el('section', 'journey-town-section');
  const toolbar = el('div', 'town-toolbar');
  const mapTitle = el('h2', '', 'Mapa de Chinchón');
  mapTitle.id = 'town-map-title';
  section.setAttribute('aria-labelledby', mapTitle.id);
  toolbar.append(mapTitle);
  if (globalThis.L) {
    const reset = el('button', 'quiet town-reset', 'Centrar');
    reset.type = 'button';
    toolbar.append(reset);
  }
  const frame = el('div', 'journey journey-town');
  frame.setAttribute('role', 'region');
  frame.setAttribute('aria-labelledby', mapTitle.id);
  section.append(toolbar, frame);
  host.append(section);
  townChallenges(section, frame, town.slice(0, 6), stop);
  const extras = el('div', 'journey-extras');
  for (const station of town.slice(6)) extras.append(stop(station, 'Prueba ' + station.number + (station.pending ? ' · Pendiente' : '')));
  section.append(extras);
  const previous = el('div', 'journey-extras journey-previous');
  previous.append(stop(bus, '1 · Autobús'), stop(riddle, '2 · Adivinanza'));
  host.append(previous);
  if (state.completed === total()) {
    const finale = el('a', 'primary', 'Ir a la batalla final →');
    finale.href = '#batalla';
    host.append(finale);
  }
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
function dining(host) {
  if (arrived()) {
    restaurants(host);
    return;
  }
  host.append(el('h1', 'food-title', 'Restaurantes'));
  const locked = el('section', 'battle-lock');
  locked.append(icon('lock'), el('p', '', 'Completa las dos pruebas del autobús para descubrir dónde comer.'));
  const route = el('a', 'primary', 'Ir al recorrido →');
  route.href = '#recorrido';
  locked.append(route);
  host.append(locked);
}

function render() {
  if (!state) return;
  const pages = { inicio: home, recorrido: journey, batalla: battle, restaurantes: dining };
  const requested = location.hash.slice(1);
  const page = !state.home_only && Object.keys(pages).includes(requested) ? requested : 'inicio';
  if (state.home_only && requested && requested !== 'inicio') history.replaceState(null, '', '#inicio');
  document.body.dataset.view = page;
  clearRestaurantMap(); clearTownMap(); $('main').replaceChildren();
  pages[page]($('main'));
  for (const link of document.querySelectorAll('.bottom-nav a')) {
    const section = link.dataset.section;
    const locked = state.home_only && section !== 'inicio';
    if (locked) {
      link.removeAttribute('href');
      link.setAttribute('role', 'link');
      link.setAttribute('aria-disabled', 'true');
    } else {
      link.href = '#' + section;
      link.removeAttribute('role');
      link.removeAttribute('aria-disabled');
    }
    link.querySelector('use').setAttribute('href', '#i-' + (locked ? 'lock' : link.dataset.icon));
    if (section === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}
load();
