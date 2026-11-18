const $ = id => document.getElementById(id);
const apiRoot = '/api/private-apps/gadeos';
const art = name => '/private-app-assets/gadeos/art/' + name + '-v2.webp';
const total = () => state.campaign.stations.length;
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
function showLogin() { state = null; document.body.dataset.view = 'login'; $('login-screen').hidden = false; $('game-screen').hidden = true; for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); }
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
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

async function action(path, payload = {}) {
  const request = { ...payload, revision: state.revision, request_id: crypto.randomUUID() };
  const storageKey = 'gadeos-pending:' + state.account.id;
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

function cardArt(card, large = false) {
  const node = el(large ? 'div' : 'button', large ? 'reward-card' : 'collectible' + (card.owned ? '' : ' locked'));
  if (!large) { node.type = 'button'; node.setAttribute('aria-label', card.owned ? 'Ver carta ' + card.title : 'Carta ' + card.id + ', bloqueada'); node.addEventListener('click', () => card.owned ? reward(card, false) : note('Esta carta se consigue al completar la estación ' + card.id + '.')); }
  if (card.owned && card.image) { const img = el('img'); img.src = card.image; img.alt = ''; img.loading = 'lazy'; node.append(img); }
  else { const image = el('img', 'card-emblem'); image.src = art('emblem'); image.alt = ''; node.append(image); }
  node.append(el('strong', '', card.owned ? card.title : 'Sobre ' + card.id));
  if (large) node.append(el('p', '', card.description));
  return node;
}
function packArt(className = '') {
  const pack = el('div', 'envelope ' + className); pack.setAttribute('aria-hidden', 'true');
  const image = el('img'); image.src = state.campaign.media?.envelope || art('envelope'); image.alt = ''; pack.append(image);
  return pack;
}
function reward(card, sealed = true) {
  const host = $('reward-content'); host.replaceChildren();
  const view = el('section', 'reward-view'); view.append(el('p', 'eyebrow', 'COLECCIÓN GADEOS'), el('h2', '', sealed ? '¡Sobre conseguido!' : card.title)); view.querySelector('h2').id = 'reward-title';
  function reveal() {
    envelope.replaceWith(cardArt(card, true)); open.remove();
    const keep = button('Continuar recorrido', () => {
      $('reward').close(); location.hash = state.completed >= total() ? 'batalla' : 'recorrido';
      document.querySelector('[data-station="' + (state.completed + 1) + '"]')?.focus();
    }, 'primary'); view.append(keep); keep.focus();
  }
  const envelope = packArt('earned-pack');
  const open = button('Abrir sobre', reveal, 'primary');
  if (sealed) view.append(el('p', 'earned-label', 'SOBRE ' + card.id + ' DE ' + total() + ' CONSEGUIDO'), envelope, open);
  else view.append(cardArt(card, true), button('Volver', () => $('reward').close(), 'primary'));
  host.append(view); if (!$('reward').open) $('reward').showModal();
}
function home(host) {
  const schedule = state.campaign.planning || { day: 'Viernes', place: 'Chinchón', start: '16:00', final: '22:00' };
  host.append(el('p', 'greeting', 'TU TRIBUTO · ' + state.account.name));
  const hero = el('section', 'home-hero');
  const image = el('img', 'event-poster'); image.src = art('alliance-hero'); image.alt = ''; image.fetchPriority = 'high'; hero.append(image);
  const copy = el('div', 'poster-copy'); copy.append(el('p', 'eyebrow', schedule.day + ' · ' + schedule.place), el('h1', '', state.campaign.title), el('p', '', state.campaign.intro)); hero.append(copy); host.append(hero);
  const next = el('a', 'primary next-step', state.completed >= total() ? 'Ir a la batalla final →' : state.completed ? 'Continuar: prueba ' + (state.completed + 1) + ' →' : 'Empezar el recorrido →'); next.href = state.completed >= total() ? '#batalla' : '#recorrido'; host.append(next);
  const planning = el('section', 'planning'); planning.append(el('div', 'section-line'));
  planning.firstChild.append(el('h2', '', 'Vuestro planning'), el('small', '', schedule.day.toLocaleUpperCase('es')));
  planning.append(el('p', 'planning-start', schedule.start + ' · Empiezan los juegos · ' + schedule.place));
  const list = el('ol', 'planning-list');
  for (const station of state.campaign.stations) {
    const row = el('li', station.completed ? 'is-done' : '');
    row.append(el('span', 'planning-time', String(station.number).padStart(2, '0')),
      el('span', '', station.title.split('\n')[0]), station.completed ? icon('check') : el('span', 'planning-dot'));
    list.append(row);
  }
  const finale = el('li', 'planning-finale'); finale.append(el('span', 'planning-time', schedule.final), el('strong', '', 'Batalla final'), icon('battle')); list.append(finale); planning.append(list); host.append(planning);
}

function journey(host) {
  const intro = el('header', 'journey-intro');
  const image = el('img', 'collection-cover'); image.src = art('alliance-hero'); image.alt = ''; intro.append(image);
  const copy = el('div', 'journey-copy'); copy.append(el('p', 'eyebrow', 'LA COLECCIÓN DE VUESTRA ALIANZA'), el('h1', '', 'Vuestro recorrido'), el('p', '', 'Responde. Abre tu sobre. Sigue la aventura.')); intro.append(copy); host.append(intro);
  const progress = el('div', 'route-progress'), meter = el('progress'); meter.max = total(); meter.value = state.completed; meter.setAttribute('aria-label', 'Pruebas completadas');
  progress.append(el('strong', '', state.completed + ' de ' + total() + ' sobres'), meter); host.append(progress);
  const list = el('div', 'journey');
  for (const station of state.campaign.stations) {
    const node = button('', () => station.completed ? reward(state.cards[station.number - 1]) : challenge(station), 'station ' + (station.locked ? 'locked' : station.completed ? 'done' : 'current'));
    node.disabled = station.locked; node.dataset.station = station.number;
    const number = el('span', 'station-node'); number.append(station.locked ? icon('lock') : station.completed ? icon('check') : document.createTextNode(String(station.number).padStart(2, '0')));
    const copy = el('span', 'station-copy'); copy.append(el('small', '', station.locked ? 'BLOQUEADA' : station.completed ? 'SOBRE CONSEGUIDO' : 'SIGUIENTE PRUEBA'), el('strong', '', station.title.split('\n')[0]));
    node.append(number, copy, packArt('station-pack')); list.append(node);
  }
  host.append(list);
  const final = button(state.completed >= total() ? 'Entrar en la batalla final →' : 'La batalla se abre con los ' + total() + ' sobres', () => { location.hash = 'batalla'; }, 'primary'); final.disabled = state.completed < total(); host.append(final);
}

function challenge(station) {
  const host = $('challenge-content'); host.replaceChildren();
  host.append(el('p', 'eyebrow', 'PRUEBA ' + String(station.number).padStart(2, '0') + ' / ' + total()));
  const title = el('h2', 'challenge-prompt', station.title); title.id = 'challenge-title'; host.append(title);
  const form = el('form'), error = el('p', 'error'); error.setAttribute('role', 'alert'); error.hidden = true;
  const label = el('label', '', 'Tu respuesta'), input = el('input'); input.name = 'answer'; input.required = true; input.autocomplete = 'off'; input.maxLength = 100; label.append(input); form.append(label);
  let answer = ''; input.addEventListener('input', () => { answer = input.value; });

  const submit = el('button', 'primary', 'Comprobar y abrir sobre'); submit.type = 'submit'; form.append(submit, error);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return; error.hidden = true;
    if (!answer || (Array.isArray(answer) && !answer.length)) { error.textContent = 'Resuelve la prueba antes de comprobar.'; error.hidden = false; return; }
    busy = true; submit.disabled = true;
    try { await action('/stations/answer', { station: station.number, campaign_revision: state.campaign.revision, answer }); $('challenge').close(); render(); reward(state.cards[station.number - 1]); }
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
  if (state.completed < total()) { const locked = el('section', 'battle-lock'); locked.append(icon('lock'), el('h2', '', 'La arena aún no está abierta'), el('p', '', 'Consigue los ' + total() + ' sobres del recorrido para enfrentarte al centinela.'), button('Volver al recorrido', () => { location.hash = 'recorrido'; }, 'primary')); host.append(locked); return; }
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
  const host = $('reward-content'); host.replaceChildren(); const title = el('h2', '', 'Tu carta de alianza'); title.id = 'reward-title'; host.append(title, el('p', 'muted', 'Cada carta puede usarse una vez por batalla. Añade fuerza o recuperación a tu siguiente movimiento.'));
  const grid = el('div', 'collection'); for (const card of state.cards) { const node = cardArt(card); node.disabled = state.battle.used_cards.includes(card.id); const clone = node.cloneNode(true); clone.addEventListener('click', () => { selectedCard = card.id; $('reward').close(); render(); }); grid.append(clone); }
  host.append(grid, button('Jugar sin carta', () => { selectedCard = null; $('reward').close(); render(); }, 'quiet')); $('reward').showModal();
}
function render() {
  if (!state) return;
  const page = ['inicio', 'recorrido', 'batalla'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio';
  document.body.dataset.view = page;
  $('main').replaceChildren();
  ({ inicio: home, recorrido: journey, batalla: battle })[page]($('main'));
  document.querySelectorAll('.bottom-nav a').forEach(node => { if (node.hash === '#' + page) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
}
load();
