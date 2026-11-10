/* Operación Faro. The board and its controls use the same port graph. */
(function (root) {
  'use strict';

  const directions = [
    {id:'N', name:'norte', dx:0, dy:-1, x:50, y:0},
    {id:'E', name:'este', dx:1, dy:0, x:100, y:50},
    {id:'S', name:'sur', dx:0, dy:1, x:50, y:100},
    {id:'W', name:'oeste', dx:-1, dy:0, x:0, y:50}
  ];
  const levels = [
    {name:'La primera señal', limit:3, tip:'Une la central con el faro. Los cables solo conducen cuando se tocan por el mismo borde.', rows:[
      '# # # #', 'S EW SW #', '# # NE B', '# # # #'
    ]},
    {name:'El islote partido', limit:5, tip:'Usa la pieza de tres salidas para alimentar los dos faros. Mantén aislada la boya averiada.', rows:[
      '# # # B #', '# # ES NW #', 'S EW NEW EW B', '# # ! # #'
    ]},
    {name:'Los tres guardianes', limit:6, tip:'Una misma central puede iluminar tres faros. Busca dónde dividir la corriente y evita las dos boyas.', rows:[
      '# B # # #', '# NS ! B #', 'S NEW SW NS #', '# ! NE NEW B', '# # # # #'
    ]},
    {name:'Reserva de emergencia', limit:5, tip:'Hay caminos alternativos. Puedes encender todos los faros con cinco relés activos si cortas los ramales sobrantes.', rows:[
      '# # # B # #', '# NE EW NSE EW B', 'S NEW EW NW ! #', '# NE EW NW # #'
    ]}
  ].map(level => ({...level, width:level.rows[0].split(' ').length, tiles:level.rows.flatMap(row => row.split(' '))}));

  function relay(tile) { return tile.length > 1; }
  function ports(tile, rotation) {
    if (tile === 'S' || tile === 'B' || tile === '!') return [0, 1, 2, 3];
    if (!relay(tile)) return [];
    return [...tile].map(id => (directions.findIndex(direction => direction.id === id) + rotation) % 4).sort();
  }
  function initialRotations(level) {
    return level.tiles.map((tile, index) => {
      if (!relay(tile)) return 0;
      return ['EW', 'NS'].includes(tile) ? 1 : 1 + index % 2;
    });
  }
  function inspect(level, rotations) {
    const connections = level.tiles.map((tile, index) => ports(tile, rotations[index]));
    const source = level.tiles.indexOf('S');
    const queue = [source];
    const live = new Set(queue);
    for (const position of queue) {
      if (['B', '!'].includes(level.tiles[position])) continue;
      for (const direction of connections[position]) {
        const {dx, dy} = directions[direction];
        const x = position % level.width + dx;
        const y = Math.floor(position / level.width) + dy;
        const next = y * level.width + x;
        if (x < 0 || x >= level.width || y < 0 || next >= level.tiles.length || live.has(next)) continue;
        if (!connections[next].includes((direction + 2) % 4)) continue;
        live.add(next);
        queue.push(next);
      }
    }
    const lit = [...live].filter(position => level.tiles[position] === 'B').length;
    const total = level.tiles.filter(tile => tile === 'B').length;
    const load = [...live].filter(position => relay(level.tiles[position])).length;
    const short = [...live].some(position => level.tiles[position] === '!');
    return {live, lit, total, load, short, won:lit === total && !short && load <= level.limit};
  }
  const artwork = {
    source:'<path d="M48 14 25 54h21l-3 32 31-48H52l8-24z"/>',
    beacon:'<path d="M40 43h20l7 38H33zM36 35l14-15 14 15zM40 34h20v12H40zM29 81h42"/><path class="faro-rays" d="m28 26-9-6m10 20H16m56-14 9-6m-10 20h13"/>',
    hazard:'<path d="M50 23 75 73H25z"/><path d="M50 42v13m0 7v1"/>',
    rock:'<path d="m21 70 11-25 19-9 22 13 8 21zM34 45l13 12 14-6 12-2"/>'
  };
  const variants = {
    adult:{label:'Laboratorio de circuitos', text:'Explora la continuidad, las conexiones en paralelo y la carga de una red en cuatro islas.'},
    teacher:{label:'Reto de lógica y electricidad', text:'Gira piezas, divide la corriente y enciende los faros. Cuatro mapas para resolver en clase.'}
  };
  let dialog, model, storageKey, opener;

  function svg(content) {
    return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${content}</svg>`;
  }
  function tileMarkup(tile, position, level, result) {
    const powered = result.live.has(position);
    if (!relay(tile)) {
      const kind = {S:'source', B:'beacon', '!':'hazard', '#':'rock'}[tile];
      const label = {S:'Central eléctrica', B:powered ? 'Faro encendido' : 'Faro apagado', '!':powered ? 'Cortocircuito' : 'Boya averiada', '#':'Roca'}[tile];
      return `<div class="faro-tile faro-${kind}${powered ? ' is-live' : ''}" role="img" aria-label="${label}" title="${label}">${svg(artwork[kind])}</div>`;
    }
    const portsHere = ports(tile, model.rotations[position]);
    const name = `Relé ${Math.floor(position / level.width) + 1}, ${position % level.width + 1}. ${portsHere.map(index => directions[index].name).join(', ')}${powered ? '. Con energía' : ''}`;
    const wires = portsHere.map(index => `M50 50L${directions[index].x} ${directions[index].y}`).join('');
    const lines = `<path class="faro-wire-shadow" d="${wires}"/><path class="faro-wire" d="${wires}"/><circle cx="50" cy="50" r="11"/>`;
    return `<button class="faro-tile faro-relay${powered ? ' is-live' : ''}" type="button" data-faro-rotate="${position}" aria-label="${name}" title="Girar 90°" ${result.won ? 'aria-disabled="true"' : ''}>${svg(lines)}</button>`;
  }
  function render(focusSelector) {
    const level = levels[model.index];
    const result = inspect(level, model.rotations);
    const end = model.index === levels.length - 1;
    const best = model.best[model.index];
    const banner = result.won ? end ? '¡El archipiélago vuelve a tener luz!' : '¡Todos los faros encendidos!' :
      result.short ? 'Cortocircuito en una boya. Aísla ese ramal.' :
      result.load > level.limit ? 'Reserva superada. Desconecta los relés que no necesitas.' :
      'Gira los relés para llevar energía a todos los faros.';
    const status = dialog.querySelector('.faro-status');
    dialog.querySelector('.faro-screen').innerHTML = `<div class="faro-maps" role="group" aria-label="Mapas de la misión">${levels.map((item, index) => `<button type="button" data-faro-level="${index}" aria-pressed="${index === model.index}" ${index > model.best.length ? 'disabled' : ''}><span aria-hidden="true">${Number.isInteger(model.best[index]) ? '✓' : index+1}</span><small>${item.name}</small></button>`).join('')}</div>
      <div class="faro-round"><h3>${level.name}</h3><span>${result.lit}/${result.total} faros</span><span class="${result.load > level.limit ? 'is-over' : ''}">${result.load}/${level.limit} relés activos</span><span>${model.moves} ${model.moves === 1 ? 'giro' : 'giros'}</span></div>
      <div class="faro-grid" role="group" aria-label="Tablero de circuitos" style="--faro-columns:${level.width}">${level.tiles.map((tile, index) => tileMarkup(tile, index, level, result)).join('')}</div>`;
    status.textContent = banner;
    status.dataset.tone = result.won ? 'win' : result.short || result.load > level.limit ? 'warn' : 'neutral';
    dialog.querySelector('.faro-tip').textContent = level.tip;
    dialog.querySelector('.faro-best').textContent = Number.isInteger(best) ? `Mejor marca en este mapa · ${best} giros` : '';
    dialog.querySelector('[data-faro-next]').hidden = !result.won || end;
    const direction=dialog.querySelector('[data-faro-direction]');
    direction.textContent=turnDirection===1?'↻ Giro a la derecha':'↺ Giro a la izquierda';
    direction.setAttribute('aria-pressed',String(turnDirection===-1));
    if (focusSelector) dialog.querySelector(focusSelector)?.focus({preventScroll:true});
  }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(model)); } catch { /* The board still runs when storage is unavailable. */ }
  }
  function restore(key) {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(key)); } catch { /* Start from the first island. */ }
    const best = Array.isArray(saved?.best) ? saved.best.slice(0, levels.length) : [];
    const invalid = best.findIndex(moves => !Number.isInteger(moves) || moves < 0);
    if (invalid !== -1) best.splice(invalid);
    const index = Number.isInteger(saved?.index) && saved.index >= 0 && saved.index < levels.length && saved.index <= best.length ? saved.index : 0;
    const level = levels[index];
    const validRun = saved?.index === index && Array.isArray(saved.rotations) && saved.rotations.length === level.tiles.length &&
      saved.rotations.every(rotation => Number.isInteger(rotation) && rotation >= 0 && rotation < 4) &&
      Number.isInteger(saved.moves) && saved.moves >= 0;
    return {index, best, rotations:validRun ? saved.rotations : initialRotations(level), moves:validRun ? saved.moves : 0};
  }
  function setLevel(index, focusSelector) {
    const level = levels[index];
    if (!level || index > model.best.length) return;
    model = {...model, index, rotations:initialRotations(level), moves:0};
    persist();
    render(focusSelector);
  }
  let turnDirection = 1;
  function rotate(position) {
    const level = levels[model.index];
    if (!relay(level.tiles[position] || '') || inspect(level, model.rotations).won) return;
    model.rotations[position] = (model.rotations[position] + turnDirection + 4) % 4;
    model.moves++;
    const result = inspect(level, model.rotations);
    if (result.won) model.best[model.index] = Math.min(model.best[model.index] ?? Infinity, model.moves);
    persist();
    render(`[data-faro-rotate="${position}"]`);
  }
  function createDialog() {
    const element = document.createElement('dialog');
    element.className = 'faro-dialog';
    element.setAttribute('aria-labelledby', 'faro-title');
    element.innerHTML = `<div class="faro-header"><div><small>MISIÓN ESPECIAL</small><h2 id="faro-title">Operación Faro</h2></div><button type="button" data-faro-close aria-label="Cerrar Operación Faro" autofocus>✕</button></div>
      <div class="faro-content"><div class="faro-screen"></div><p class="faro-status" role="status"></p><div class="faro-controls"><button type="button" data-faro-reset>Reiniciar mapa</button><button type="button" data-faro-direction aria-label="Girar en sentido antihorario" aria-pressed="false"></button><button type="button" data-faro-next hidden>Siguiente isla →</button><span class="faro-best"></span></div><p class="faro-tip"></p></div>`;
    element.addEventListener('click', event => {
      const control = event.target.closest('button');
      if (!control) return;
      if (control.hasAttribute('data-faro-close')) return element.close();
      if (control.hasAttribute('data-faro-reset')) return setLevel(model.index);
      if (control.hasAttribute('data-faro-direction')) {turnDirection=-turnDirection;return render();}
      if (control.hasAttribute('data-faro-next')) {
        const index = model.index + 1;
        return setLevel(index, `[data-faro-level="${index}"]`);
      }
      if (control.dataset.faroRotate !== undefined) return rotate(Number(control.dataset.faroRotate));
      if (control.dataset.faroLevel !== undefined && Number(control.dataset.faroLevel) !== model.index) {
        return setLevel(Number(control.dataset.faroLevel), `[data-faro-level="${control.dataset.faroLevel}"]`);
      }
    });
    element.addEventListener('close', () => opener?.focus({preventScroll:true}));
    document.body.append(element);
    return element;
  }
  function launch(button) {
    const variant = button.dataset.lighthouseLaunch;
    if (!Object.hasOwn(variants, variant) || dialog?.open) return;
    opener = button;
    storageKey = `educame:lighthouse:v1:${variant}:${button.dataset.faroProfile || 'demo'}`;
    model = restore(storageKey);
    turnDirection=1;
    dialog ||= createDialog();
    render();
    dialog.showModal();
  }
  function card(variant, profileId = '') {
    const {label, text} = variants[variant];
    return `<section class="faro-card" aria-label="Misión especial"><div><small>${label} · 4 mapas</small><h2>Operación Faro</h2><p>${text}</p></div><button type="button" data-lighthouse-launch="${variant}" data-faro-profile="${encodeURIComponent(profileId)}">Iniciar misión →</button></section>`;
  }
  if (typeof document !== 'undefined') document.addEventListener('click', event => {
    const button = event.target.closest('[data-lighthouse-launch]');
    if (button) launch(button);
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = {levels, inspect, initialRotations};
  else root.LighthouseMission = {card};
})(globalThis);
