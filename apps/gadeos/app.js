const $ = id => document.getElementById(id);
const apiRoot = '/api/private-apps/gadeos';
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
function showLogin() { state = null; $('login-screen').hidden = false; $('game-screen').hidden = true; for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); }
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
window.addEventListener('hashchange', render);

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
  else node.append(el('span', '', card.owned ? ['✦', '◇', '☽', '⌂', '☀', '♜', '∞', '✧'][card.id - 1] : '◇'));
  node.append(el('strong', '', card.owned ? card.title : 'Sobre ' + card.id));
  if (large) node.append(el('p', '', card.description));
  return node;
}
function reward(card, sealed = true) {
  const host = $('reward-content'); host.replaceChildren();
  const view = el('section', 'reward-view'); view.append(el('p', 'eyebrow', 'COLECCIÓN GADEOS'), el('h2', '', sealed ? 'Un sobre para vuestra alianza' : card.title)); view.querySelector('h2').id = 'reward-title';
  function reveal() { envelope.replaceWith(cardArt(card, true)); open.remove(); view.append(button('Guardar en mi colección', () => $('reward').close(), 'primary')); }
  const envelope = el('div', 'envelope'); envelope.setAttribute('aria-hidden', 'true'); envelope.append(el('span', '', 'G'));
  const open = button('Abrir sobre', reveal, 'primary');
  if (sealed) view.append(envelope, el('p', 'muted', 'La estación está completada y tu carta ya está guardada.'), open);
  else view.append(cardArt(card, true), button('Volver', () => $('reward').close(), 'primary'));
  host.append(view); if (!$('reward').open) $('reward').showModal();
}
function home(host) {
  host.append(el('p', 'greeting', 'TU TRIBUTO · ' + state.account.name), el('h1', '', 'Toda gran historia\nempieza con una alianza.'));
  const hero = el('section', 'home-hero'); hero.append(el('p', 'eyebrow', 'RUMBO A CHINCHÓN'), el('h2', '', state.campaign.title), el('p', '', state.campaign.intro));
  const start = el('a', 'primary', state.completed === 8 ? 'Entrar en la batalla final ↗' : state.completed ? 'Continuar recorrido ↗' : 'Comenzar el recorrido ↗'); start.href = state.completed === 8 ? '#batalla' : '#recorrido'; hero.append(start); host.append(hero);
  const strip = el('section', 'progress-strip'), medal = el('div', 'progress-medal'); medal.style.setProperty('--angle', (state.completed * 45) + 'deg'); medal.append(el('span', '', state.completed + '/8'));
  const copy = el('div'); copy.append(el('strong', '', state.completed === 8 ? 'Los ocho sobres son vuestros' : 'Próxima parada: ' + state.campaign.stations[state.completed].title), el('p', '', state.completed === 8 ? 'La arena final os espera.' : 'Una estación cada vez. Tu progreso siempre queda guardado.'));
  strip.append(medal, copy); host.append(strip);
  const line = el('div', 'section-line'); line.append(el('h2', '', 'Vuestra colección'), el('small', '', state.completed + ' de 8 cartas')); host.append(line);
  const collection = el('div', 'collection'); collection.append(...state.cards.map(card => cardArt(card))); host.append(collection);
  if (state.victory) { const trophy = el('section', 'battle-result'); trophy.append(el('div', 'trophy'), el('h2', '', 'Vuestra alianza ha vencido'), el('p', '', state.campaign.ending)); host.append(trophy); }
}
function journey(host) {
  const intro = el('header', 'journey-intro'); intro.append(el('p', 'eyebrow', 'VUESTRO VIAJE'), el('h1', '', 'Ocho estaciones.\nUn mismo destino.'), el('p', '', state.completed + '/8 completadas · Cada sobre se abre al superar su prueba.')); host.append(intro);
  const list = el('div', 'journey');
  for (const station of state.campaign.stations) {
    const node = button('', () => station.completed ? reward(state.cards[station.number - 1], false) : challenge(station), 'station ' + (station.locked ? 'locked' : station.completed ? 'done' : 'current'));
    node.disabled = station.locked; node.dataset.station = station.number;
    const number = el('span', 'station-node'); number.append(station.locked ? icon('lock') : station.completed ? icon('check') : document.createTextNode(String(station.number).padStart(2, '0')));
    const copy = el('span', 'station-copy'); copy.append(el('small', '', station.locked ? 'COMPLETA LA ANTERIOR' : station.completed ? 'SOBRE CONSEGUIDO' : 'TU SIGUIENTE PRUEBA'), el('strong', '', station.title));
    node.append(number, copy); list.append(node);
  }
  host.append(list);
  const final = button(state.completed === 8 ? 'La batalla final está abierta ↗' : 'Batalla final · Se abre tras las ocho estaciones', () => { location.hash = 'batalla'; }, 'primary'); final.disabled = state.completed < 8; host.append(final);
}

function challenge(station) {
  const host = $('challenge-content'); host.replaceChildren();
  host.append(el('p', 'eyebrow', 'ESTACIÓN ' + String(station.number).padStart(2, '0')));
  const title = el('h2', '', station.title); title.id = 'challenge-title'; host.append(title, el('p', 'challenge-story', station.story), el('p', 'challenge-prompt', station.prompt));
  const form = el('form'), error = el('p', 'error'); error.setAttribute('role', 'alert'); error.hidden = true;
  let answer = '', selections = [], pairs = [], flipped = [], matched = new Set(), memoryBusy = false;
  if (station.kind === 'code') {
    const label = el('label', '', 'Palabra o código de la estación'), input = el('input'); input.name = 'answer'; input.required = true; input.autocomplete = 'off'; input.maxLength = 100; label.append(input); form.append(label); input.addEventListener('input', () => { answer = input.value; });
  } else if (station.kind === 'choice') {
    const options = el('div', 'choice-list'); for (const option of station.options) { const choice = button(option, () => { answer = option; options.querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed', String(node === choice))); }); choice.setAttribute('aria-pressed', 'false'); options.append(choice); } form.append(options);
  } else if (station.kind === 'order') {
    const slot = el('div', 'order-slot'); slot.setAttribute('aria-label', 'Tu orden'); const options = el('div', 'choice-list');
    const refresh = () => { slot.replaceChildren(...selections.map((text, i) => el('span', '', (i + 1) + '. ' + text))); options.querySelectorAll('button').forEach(node => { node.disabled = selections.includes(node.textContent); }); answer = selections; };
    for (const option of shuffled(station.options)) options.append(button(option, () => { selections = [...selections, option]; refresh(); }));
    form.append(slot, options, button('Deshacer último paso', () => { selections = selections.slice(0, -1); refresh(); }, 'quiet'));
  } else {
    const board = el('div', 'memory-board');
    for (const index of shuffled(station.options.map((_, i) => i))) {
      const card = button('◇', () => {
        if (memoryBusy || flipped.includes(index) || matched.has(index)) return;
        flipped.push(index); card.textContent = station.options[index]; card.setAttribute('aria-label', station.options[index]);
        if (flipped.length === 2) {
          const [a, b] = flipped;
          if (station.options[a] === station.options[b]) { matched.add(a); matched.add(b); pairs.push(a, b); flipped = []; answer = [...pairs]; }
          else { memoryBusy = true; setTimeout(() => { for (const n of board.querySelectorAll('button')) if (flipped.includes(Number(n.dataset.index))) { n.textContent = '◇'; n.setAttribute('aria-label', 'Carta oculta'); } flipped = []; memoryBusy = false; }, 650); }
        }
      }); card.dataset.index = index; card.setAttribute('aria-label', 'Carta oculta'); board.append(card);
    }
    form.append(board);
  }
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
function shuffled(list) { const copy = [...list]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }

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
  if (state.completed < 8) { const locked = el('section', 'battle-lock'); locked.append(icon('lock'), el('h2', '', 'La arena aún no está abierta'), el('p', '', 'Consigue las ocho cartas del recorrido para enfrentarte al centinela.'), button('Volver al recorrido', () => { location.hash = 'recorrido'; }, 'primary')); host.append(locked); return; }
  const fight = state.battle;
  if (!fight || fight.state !== 'playing') {
    const start = el('section', 'battle-result'); start.append(el('div', 'trophy'), el('h2', '', fight?.state === 'won' ? 'Vuestra alianza ha vencido' : fight?.state === 'lost' ? 'La arena te da otra oportunidad' : state.campaign.boss),
      el('p', '', fight?.state === 'won' ? state.campaign.ending : 'Lee la intención del centinela, elige tu estrategia y usa tus cartas. Tienes doce turnos. Tus sobres y estaciones siempre se conservan.'),
      button(fight ? 'Jugar otra batalla' : 'Entrar en la arena', startBattle, 'primary')); host.append(start); return;
  }
  const arena = el('section', 'battle-arena'), fighters = el('div', 'combatants');
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
  $('main').replaceChildren();
  ({ inicio: home, recorrido: journey, batalla: battle })[page]($('main'));
  document.querySelectorAll('.bottom-nav a').forEach(node => { if (node.hash === '#' + page) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
}
load();
