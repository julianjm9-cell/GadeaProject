import { restaurants, clearRestaurantMap, projectTownPoint } from './restaurants.js';
const $ = id => document.getElementById(id);
const apiRoot = '/api/arena-hambre';
const art = name => '/aventura-hambre-assets/art/' + name + '-v2.webp';
const total = () => state.campaign.stations.length;
const sectionLabels = { recorrido: 'Recorrido', batalla: 'Batalla final', restaurantes: 'Restaurantes' };
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
let state, busy = false;
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
  const page = state.completed >= total() && state.sections.batalla !== 'disabled' ? 'batalla' : 'recorrido';
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
  if (state.sections.recorrido !== 'disabled') {
    const finalReady = state.completed >= total() && state.sections.batalla !== 'disabled';
    const next = el('a', 'primary next-step', finalReady ? 'Ir a la batalla final →' : state.completed ? 'Continuar el recorrido →' : 'Empezar el recorrido →');
    next.href = finalReady ? '#batalla' : '#recorrido';
    overview.append(next);
  }
  const planning = el('section', 'planning'); planning.append(el('h2', '', 'Vuestro planning'));
  if (schedule.transport) planning.append(el('p', 'planning-transport', schedule.transport));
  for (const [index, day] of (schedule.days || []).entries()) {
    const section = el('section', 'planning-day');
    const head = el('div', 'planning-day-title'); head.append(el('span', 'day-symbol', index ? '☀' : '☾'), el('h3', '', day.title)); section.append(head);
    if (day.locked) {
      const blocked = el('div', 'planning-locked');
      planningLock(blocked, day.unlock_key, 'Desbloquear sábado', 'Sábado');
      section.append(blocked);
      planning.append(section);
      continue;
    }
    if (day.subtitle) section.append(el('p', 'day-subtitle', day.subtitle));
    const list = el('ol', 'planning-list');
    for (const activity of day.activities) {
      const row = el('li', activity.locked ? 'planning-locked' : '');
      if (activity.locked) {
        planningLock(row, activity.unlock_key, 'Desbloquear actividad', 'Viernes');
      } else {
        if (activity.time) row.append(el('time', 'planning-time', activity.time));
        row.append(el('span', '', activity.text || 'Actividad pendiente de definir.'));
      }
      list.append(row);
    }
    section.append(list); planning.append(section);
  }
  if (arrived() && state.sections.restaurantes !== 'disabled') {
    const food = el('a', 'planning-food-link', 'Dónde comer →');
    food.href = '#restaurantes';
    planning.append(food);
  }
  host.append(planning);
}

function planningLock(host, key, title, label) {
  host.append(icon('lock'));
  if (!key) {
    host.append(el('span', '', 'BLOQUEADO'));
    return;
  }
  host.classList.add('planning-has-key');
  const details = el('details', 'planning-unlock');
  details.append(el('summary', '', title));
  unlockForm(details, key, label);
  host.append(details);
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
  if (state.completed === total() && state.sections.batalla !== 'disabled') {
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

async function markWin(tribute) {
  if (busy) return;
  busy = true;
  for (const control of document.querySelectorAll('.tribute-win')) control.disabled = true;
  try {
    await action('/battle/win', { tribute, score_revision: state.score.revision });
    render();
    document.querySelector('.tribute-win[data-tribute="' + tribute + '"]')?.focus({ preventScroll: true });
  } catch (error) {
    note(error.message);
  } finally {
    busy = false;
    for (const control of document.querySelectorAll('.tribute-win')) control.disabled = false;
  }
}

function battle(host) {
  host.append(el('h1', '', 'Batalla final'));
  const board = el('div', 'tribute-scoreboard');
  for (const [index, wins] of state.score.wins.entries()) {
    const tribute = index + 1;
    const name = 'Tributo ' + tribute;
    const control = button('', () => markWin(tribute), 'tribute-win');
    control.dataset.tribute = tribute;
    control.setAttribute('aria-label', 'Anotar victoria para ' + name + '. ' + wins + ' registradas.');
    const label = el('span', 'tribute-win-label');
    label.append(el('strong', '', name), el('span', 'tribute-win-count', String(wins)), el('span', '', wins === 1 ? 'victoria' : 'victorias'), el('span', 'tribute-win-action', '+ Anotar victoria'));
    control.append(label);
    board.append(control);
  }
  host.append(board);
}

function sectionGate(host, section) {
  const label = sectionLabels[section];
  host.append(el('h1', '', label));
  const panel = el('section', 'battle-lock section-gate');
  panel.append(icon('lock'));
  host.append(panel);
  if (state.sections[section] === 'waiting') {
    panel.append(el('p', '', section === 'batalla'
      ? 'Completa las ' + total() + ' pruebas del recorrido para abrir la batalla.'
      : 'Completa las dos pruebas del autobús para descubrir dónde comer.'));
    const route = el('a', 'primary', 'Ir al recorrido →');
    route.href = '#recorrido';
    panel.append(route);
    return;
  }

  unlockForm(panel, section, label);
}

function unlockForm(host, section, label) {
  const form = el('form');
  const field = el('label', '', 'Contraseña de ' + label);
  const password = el('input');
  password.type = 'password';
  password.required = true;
  password.maxLength = 72;
  password.autocomplete = 'off';
  field.append(password);
  const submit = el('button', 'primary', 'Desbloquear');
  submit.type = 'submit';
  const error = el('p', 'error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  form.append(field, submit, error);
  host.append(form);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    submit.disabled = true;
    error.hidden = true;
    try {
      state = await api('/sections/unlock', { section, password: password.value, revision: state.revision, request_id: crypto.randomUUID() });
      render();
      $('main').focus({ preventScroll: true });
    } catch (problem) {
      if (problem.status === 401) showLogin();
      else if (problem.status === 409) await load();
      else {
        error.textContent = problem.message;
        error.hidden = false;
      }
    } finally {
      busy = false;
      submit.disabled = false;
    }
  });
}

function render() {
  if (!state) return;
  const pages = { inicio: home, recorrido: journey, batalla: battle, restaurantes: restaurants };
  const requested = location.hash.slice(1);
  const page = Object.keys(sectionLabels).includes(requested) && state.sections[requested] !== 'disabled' ? requested : 'inicio';
  if (state.sections[requested] === 'disabled') history.replaceState(null, '', '#inicio');
  document.body.dataset.view = page;
  clearRestaurantMap(); clearTownMap(); $('main').replaceChildren();
  if (page === 'inicio' || state.sections[page] === 'open') pages[page]($('main'));
  else sectionGate($('main'), page);
  for (const link of document.querySelectorAll('.bottom-nav a')) {
    const section = link.dataset.section;
    const status = state.sections[section];
    const locked = status === 'disabled';
    if (locked) {
      link.removeAttribute('href');
      link.setAttribute('role', 'link');
      link.setAttribute('aria-disabled', 'true');
    } else {
      link.href = '#' + section;
      link.removeAttribute('role');
      link.removeAttribute('aria-disabled');
    }
    link.querySelector('use').setAttribute('href', '#i-' + (status && status !== 'open' ? 'lock' : link.dataset.icon));
    if (section === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}
load();
