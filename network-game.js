// Gra „Sieć komputerowa”: plansza-labirynt z urządzeniami. Gracz ciągnie kable z wypustek urządzeń,
// stawia modemy, routery i access pointy oraz wkłada karty Wi-Fi do komputerów i drukarek (a access point do routera).
// Jak w prawdziwym domu: gniazdko dostawcy → modem → router (port WAN) → urządzenia (porty LAN i Wi-Fi).
// Internet przekazują dalej tylko modem, router i access point — komputer i drukarka są „końcówkami”,
// dlatego kabel komputer–drukarka łączy je ze sobą, ale nie daje drukarce internetu.
// Korzysta z funkcji app.js (setQuizProgress, completeLesson, saveStudentPoints…)
// oraz z burstFileGameConfetti z file-game.js.
let networkGame = null;

const NETWORK_ROUTER_ICON = `
  <svg viewBox="0 0 40 40" aria-hidden="true">
    <rect x="3" y="12" width="34" height="18" rx="5" fill="#3c4b55" />
    <rect x="3" y="12" width="34" height="6" rx="3" fill="#53656f" />
    <circle cx="10" cy="24" r="2.2" fill="#58cc02" />
    <circle cx="16" cy="24" r="2.2" fill="#58cc02" />
    <circle cx="22" cy="24" r="2.2" fill="#ffc800" />
    <rect x="27" y="21.5" width="6" height="5" rx="1" fill="#1d262c" />
  </svg>`;

const NETWORK_MODEM_ICON = `
  <svg viewBox="0 0 40 40" aria-hidden="true">
    <rect x="9" y="5" width="22" height="30" rx="4" fill="#5b6b8a" />
    <rect x="9" y="5" width="22" height="7" rx="3" fill="#71829f" />
    <circle cx="15" cy="18" r="2" fill="#58cc02" />
    <circle cx="15" cy="24" r="2" fill="#58cc02" />
    <circle cx="15" cy="30" r="2" fill="#ffc800" />
    <rect x="20" y="16.8" width="7" height="2.4" rx="1" fill="#c9d3e4" />
    <rect x="20" y="22.8" width="7" height="2.4" rx="1" fill="#c9d3e4" />
    <rect x="20" y="28.8" width="7" height="2.4" rx="1" fill="#c9d3e4" />
  </svg>`;

const NETWORK_DEVICES = {
  internet: { label: 'Internet', icon: '🌐', ports: 1, text: 'gniazdko od dostawcy internetu' },
  // uplink — pierwszy port urządzenia jest tylko na kabel od urządzeń tych typów (WAN routera, wejście modemu).
  modem: {
    label: 'Modem', icon: NETWORK_MODEM_ICON, ports: 2, relay: true, uplink: ['internet'], uplinkName: 'od gniazdka',
    lanFull: 'Modem ma tylko jeden port LAN i jest już zajęty. Podłącz do niego router — on ma więcej portów.',
    text: 'zamienia sygnał z gniazdka na sieć w domu'
  },
  // Do gniazdka router podłączysz tylko z włożonym modułem modemu (ngCableProblem).
  router: {
    label: 'Router', icon: NETWORK_ROUTER_ICON, ports: 5, relay: true, uplink: ['modem', 'internet'], uplinkName: 'WAN',
    lanFull: 'Router: wszystkie 4 porty LAN są zajęte.', slots: ['modemModule', 'apModule'],
    text: 'port WAN do modemu, 4 porty LAN i 2 sloty na wzmocnienia'
  },
  ap: { label: 'Access point', icon: '📡', ports: 1, relay: true, text: 'Wi-Fi przez ściany, ale słabnie' },
  computer: { label: 'Komputer', icon: '🖥️', ports: 1, slots: ['wifi', 'vpn'], text: '1 wypustka i sloty na wzmocnienia' },
  laptop: { label: 'Laptop', icon: '💻', ports: 1, wifi: true, text: 'komputer z wbudowanym Wi-Fi' },
  printer: { label: 'Drukarka', icon: '🖨️', ports: 1, slots: ['wifi'], text: '1 wypustka i slot na wzmocnienie' }
};
// C–G to kolejne komputery, Q i R kolejne drukarki, J drugie gniazdko — poziom rozróżnia je numerkami (pole tags).
const NETWORK_MAP_DEVICES = {
  I: 'internet', J: 'internet', M: 'modem', K: 'computer', C: 'computer', D: 'computer', E: 'computer', F: 'computer', G: 'computer',
  L: 'laptop', P: 'printer', Q: 'printer', R: 'printer'
};
// Sprzęt stawia się na planszy, wzmocnienie wkłada do slotu urządzenia (pole slots w NETWORK_DEVICES).
const NETWORK_TOOLS = {
  modem: { label: 'Modem', icon: NETWORK_MODEM_ICON, group: 'device' },
  router: { label: 'Router', icon: NETWORK_ROUTER_ICON, group: 'device' },
  ap: { label: 'Access point', icon: '📡', group: 'device' },
  wifi: { label: 'Karta Wi-Fi', icon: '📶', group: 'upgrade', text: 'do komputera i drukarki', where: 'Kartę Wi-Fi włóż do slotu komputera albo drukarki.' },
  modemModule: { label: 'Moduł modemu', icon: NETWORK_MODEM_ICON, group: 'upgrade', text: 'do routera — router łączy się prosto z gniazdkiem', where: 'Moduł modemu włóż do slotu routera.' },
  apModule: { label: 'Moduł access point', icon: '📡', group: 'upgrade', text: 'do routera — router nadaje Wi-Fi', where: 'Moduł access point włóż do slotu routera.' },
  // Slot VPN widać tylko na poziomach, które dają usługę VPN (onlyWhenGiven).
  vpn: {
    label: 'Usługa VPN', icon: '🔒', group: 'upgrade', onlyWhenGiven: true,
    text: 'do komputera — komputery z tą usługą łączą się tunelem przez internet', where: 'Usługę VPN włóż do slotu komputera.'
  }
};
const NETWORK_TOOL_GROUPS = [
  { id: 'device', label: 'Sprzęt' },
  { id: 'upgrade', label: 'Wzmocnienia' }
];

function renderNetworkGame(topic, index, game) {
  document.title = `${game.title} — Informatyczna Przygoda`;
  document.querySelector('meta[name="theme-color"]').content = topic.accent;
  app.replaceChildren(quizTemplate.content.cloneNode(true));
  applyTopicTheme(topic);
  app.querySelector('#quiz-close').href = `#/sciezka/${topic.slug}`;
  app.querySelector('#quiz-footer').hidden = true;
  app.querySelector('#quiz-kicker').textContent = game.title;
  app.querySelector('#quiz-prompt').textContent = game.prompt;
  app.querySelector('#quiz-hint').textContent =
    `Internet wchodzi do domu gniazdkiem od dostawcy, a dalej płynie przez modem i router do komputerów. ` +
    `Ciągnij myszką kable przez korytarze labiryntu, stawiaj routery i access pointy Wi-Fi. Przejdź ${game.levels.length} poziomów!`;
  setQuizProgress(0);

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg-intro';
  body.innerHTML = `
    <div class="bg-legend ng-legend">
      ${Object.values(NETWORK_DEVICES).map((device) => `
        <span class="bg-legend-item">
          <span class="ng-legend-icon" aria-hidden="true">${device.icon}</span>
          <span><b>${device.label}</b>${device.text}</span>
        </span>`).join('')}
    </div>
    <p class="ng-legend-title">Wzmocnienia — wkładasz je do slotu urządzenia</p>
    <div class="bg-legend ng-legend">
      ${Object.values(NETWORK_TOOLS).filter((tool) => tool.group === 'upgrade').map((tool) => `
        <span class="bg-legend-item is-upgrade">
          <span class="ng-legend-icon" aria-hidden="true">${tool.icon}</span>
          <span><b>${tool.label}</b>${tool.text}</span>
        </span>`).join('')}
    </div>
    <button class="primary-button fg-start" type="button">Start <span aria-hidden="true">▶</span></button>
  `;
  // Debugowanie: adres z ?poziom=8 (przed #) zaczyna grę od wskazanego poziomu.
  const debugLevel = Number(new URLSearchParams(location.search).get('poziom')) - 1;
  const firstLevel = debugLevel >= 0 && debugLevel < game.levels.length ? debugLevel : 0;
  body.querySelector('.fg-start').addEventListener('click', () => startNetworkLevel(topic, index, game, firstLevel));
  body.querySelector('.fg-start').focus();
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function startNetworkLevel(topic, index, game, levelIndex) {
  stopNetworkGame();
  const level = game.levels[levelIndex];
  const rows = level.map.length;
  const cols = level.map[0].length;
  app.querySelector('#quiz-prompt').textContent = `Poziom ${levelIndex + 1}: ${level.title}`;
  app.querySelector('#quiz-hint').textContent = level.hint;
  setQuizProgress(levelIndex / game.levels.length);

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg ng';
  body.innerHTML = `
    <div class="fg-hud">
      <span class="fg-score">Poziom <b>${levelIndex + 1}</b> / ${game.levels.length}</span>
      <span class="fg-message" aria-live="polite"></span>
      <button class="secondary-button fg-end ng-reset" type="button">Od nowa</button>
    </div>
    <ul class="ng-goals" aria-label="Cele"></ul>
    <div class="ng-tools"></div>
    ${level.rooms ? `
      <div class="ng-rooms" style="--cols: ${cols}">
        ${level.rooms.map((room) => `<span style="grid-column: ${room.from + 1} / ${room.to + 2}">${room.label}</span>`).join('')}
      </div>` : ''}
    <div class="ng-board" style="--cols: ${cols}; --rows: ${rows}">
      <div class="ng-cells"></div>
      <svg class="ng-wires" viewBox="0 0 ${cols} ${rows}" preserveAspectRatio="none" aria-hidden="true"></svg>
      <div class="ng-devices"></div>
    </div>
    <div class="fg-overlay" hidden><div class="fg-overlay-card"></div></div>
  `;

  const state = {
    topic,
    index,
    game,
    levelIndex,
    level,
    body,
    cols,
    rows,
    board: body.querySelector('.ng-board'),
    cells: body.querySelector('.ng-cells'),
    walls: new Set(),
    devices: [],
    cables: [],
    tools: { ...level.tools },
    nextId: 1,
    drag: null,
    selectedTool: null,
    won: false,
    broken: false,
    messageTimer: 0
  };
  level.map.forEach((row, y) => [...row].forEach((char, x) => {
    if (char === '#') state.walls.add(ngCell(state, x, y));
    if (NETWORK_MAP_DEVICES[char]) state.devices.push({ id: char, type: NETWORK_MAP_DEVICES[char], x, y, fixed: true, upgrades: [], tag: level.tags?.[char] });
  }));
  // Kable ułożone na starcie (np. gniazdko–modem) łączą sąsiednie kratki i nie da się ich odłączyć.
  (level.cables || []).forEach(([a, b]) => state.cables.push({ id: state.nextId++, a, b, cells: [], fixed: true }));
  networkGame = state;

  state.cells.innerHTML = Array.from({ length: cols * rows }, (_, cell) =>
    `<span class="ng-cell${state.walls.has(cell) ? ' is-wall' : ''}"></span>`).join('');

  body.querySelector('.ng-reset').addEventListener('click', () => startNetworkLevel(topic, index, game, levelIndex));
  state.board.addEventListener('pointerdown', (event) => ngBoardPointerDown(state, event));
  state.board.addEventListener('pointermove', (event) => ngBoardPointerMove(state, event));
  state.board.addEventListener('pointerup', () => ngBoardPointerUp(state));
  state.board.addEventListener('pointercancel', () => ngBoardPointerUp(state));
  state.board.addEventListener('contextmenu', (event) => event.preventDefault());
  ngRender(state);
}

function stopNetworkGame() {
  if (!networkGame) return;
  clearTimeout(networkGame.messageTimer);
  networkGame = null;
}

// ——— Pomocnicze: komórki planszy ———

function ngCell(state, x, y) {
  return y * state.cols + x;
}

function ngCellCenter(state, cell) {
  return { x: (cell % state.cols) + 0.5, y: Math.floor(cell / state.cols) + 0.5 };
}

// Pozycja wskaźnika w jednostkach planszy (1 = jedna kratka) i kratka pod nim.
function ngPointer(state, clientX, clientY) {
  const rect = state.cells.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * state.cols;
  const y = ((clientY - rect.top) / rect.height) * state.rows;
  const inside = x >= 0 && y >= 0 && x < state.cols && y < state.rows;
  return { x, y, cell: inside ? ngCell(state, Math.floor(x), Math.floor(y)) : null };
}

function ngDeviceAt(state, cell) {
  return state.devices.find((device) => ngCell(state, device.x, device.y) === cell);
}

function ngDeviceById(state, id) {
  return state.devices.find((device) => device.id === id);
}

function ngCableCells(state) {
  return new Set(state.cables.flatMap((cable) => cable.cells));
}

function ngIsFree(state, cell) {
  return !state.walls.has(cell) && !ngDeviceAt(state, cell) && !ngCableCells(state).has(cell);
}

function ngNeighbors(state, cell) {
  const x = cell % state.cols;
  const y = Math.floor(cell / state.cols);
  return [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .filter(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < state.cols && y + dy < state.rows)
    .map(([dx, dy]) => ngCell(state, x + dx, y + dy));
}

function ngUsedPorts(state, device) {
  return state.cables.filter((cable) => cable.a === device.id || cable.b === device.id).length;
}

// Ile kabli wchodzi do portu uplink urządzenia (WAN routera, wejście modemu od gniazdka).
function ngUsedUplinks(state, device) {
  const { uplink } = NETWORK_DEVICES[device.type];
  if (!uplink) return 0;
  return state.cables.filter((cable) =>
    (cable.a === device.id && uplink.includes(ngDeviceById(state, cable.b).type)) ||
    (cable.b === device.id && uplink.includes(ngDeviceById(state, cable.a).type))).length;
}

// Czy device ma wolny port na kabel od partner. Zwraca opis problemu albo ''.
function ngPortProblem(state, device, partner) {
  const info = NETWORK_DEVICES[device.type];
  const used = ngUsedPorts(state, device);
  if (!info.uplink) return used >= info.ports ? `${info.label}: wszystkie wypustki są zajęte.` : '';
  const uplinks = ngUsedUplinks(state, device);
  if (info.uplink.includes(partner.type)) return uplinks ? `${info.label}: port ${info.uplinkName} jest już zajęty.` : '';
  return used - uplinks >= info.ports - 1 ? info.lanFull : '';
}

function ngHasWifi(device) {
  return Boolean(NETWORK_DEVICES[device.type].wifi || device.upgrades.includes('wifi'));
}

// Wi-Fi nadaje access point albo router z access pointem włożonym jako ulepszenie.
function ngIsAccessPoint(device) {
  return device.type === 'ap' || device.upgrades.includes('apModule');
}


// ——— Sieć: Wi-Fi, połączenia i cele ———

// Siła sygnału od access pointa: maleje z odległością i z każdą ścianą po drodze.
function ngSignal(state, from, to) {
  const { range, wallLoss } = state.game.wifi;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const steps = Math.ceil(distance * 10);
  let walls = 0;
  let lastCell = -1;
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const cell = ngCell(state, Math.floor(from.x + 0.5 + dx * t), Math.floor(from.y + 0.5 + dy * t));
    if (cell === lastCell) continue;
    lastCell = cell;
    if (state.walls.has(cell)) walls += 1;
  }
  return Math.max(0, 1 - distance / range - walls * wallLoss);
}

function ngComputeNetwork(state) {
  const accessPoints = state.devices.filter(ngIsAccessPoint);
  state.links = [];
  state.signals = new Map();
  // Urządzenie z Wi-Fi łączy się z najsilniejszym access pointem w zasięgu.
  state.devices.filter(ngHasWifi).forEach((device) => {
    let best = null;
    accessPoints.forEach((ap) => {
      const strength = ngSignal(state, ap, device);
      if (strength > 0 && (!best || strength > best.strength)) best = { ap, device, strength };
    });
    state.signals.set(device.id, best ? best.strength : 0);
    if (best) state.links.push(best);
  });

  // lanEdges — kable i Wi-Fi, edges — do tego tunel VPN.
  state.lanEdges = new Map(state.devices.map((device) => [device.id, []]));
  state.cables.forEach((cable) => {
    state.lanEdges.get(cable.a).push(cable.b);
    state.lanEdges.get(cable.b).push(cable.a);
  });
  state.links.forEach(({ ap, device }) => {
    state.lanEdges.get(ap.id).push(device.id);
    state.lanEdges.get(device.id).push(ap.id);
  });
  // Gniazdko nie przekazuje sygnału dalej, więc dwa gniazdka nie łączą sieci ze sobą.
  state.online = new Set(state.devices.filter((device) => device.type === 'internet')
    .flatMap((socket) => [...ngReach(state, socket.id, state.lanEdges)]));

  // Komputery z usługą VPN łączą się tunelem każdy z każdym. Tunel biegnie przez internet —
  // działa, gdy oba komputery mają internet.
  const vpn = state.devices.filter((device) => device.upgrades.includes('vpn'));
  state.tunnels = vpn.flatMap((a, i) => vpn.slice(i + 1).map((b) => ({ a: a.id, b: b.id })));
  state.edges = new Map([...state.lanEdges].map(([id, next]) => [id, [...next]]));
  state.tunnels.forEach((tunnel) => {
    tunnel.active = state.online.has(tunnel.a) && state.online.has(tunnel.b);
    if (!tunnel.active) return;
    state.edges.get(tunnel.a).push(tunnel.b);
    state.edges.get(tunnel.b).push(tunnel.a);
  });
}

// Do kogo dociera sygnał z urządzenia start — dalej przekazują go tylko modem, router i access point.
// Gniazdko dostawcy przyjmie kabel tylko od modemu, więc internet zawsze płynie przez modem.
function ngReach(state, startId, edges = state.edges) {
  const seen = new Set([startId]);
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    if (id !== startId && !NETWORK_DEVICES[ngDeviceById(state, id).type].relay) continue;
    edges.get(id).forEach((next) => {
      if (seen.has(next)) return;
      seen.add(next);
      queue.push(next);
    });
  }
  return seen;
}

// device, a i b w celu mogą być jednym urządzeniem albo listą.
function ngGoalMet(state, goal) {
  const list = (value) => [].concat(value);
  if (goal.kind === 'internet') return list(goal.device).every((id) => state.online.has(id));
  if (goal.kind === 'offline') return list(goal.device).every((id) => !state.online.has(id));
  // Sale mają być osobno: liczą się kable i Wi-Fi, tunel VPN jest dozwolony.
  if (goal.kind === 'isolated') {
    return list(goal.a).every((a) => {
      const reach = ngReach(state, a, state.lanEdges);
      return list(goal.b).every((b) => !reach.has(b));
    });
  }
  return list(goal.a).every((a) => {
    const reach = ngReach(state, a);
    return list(goal.b).every((b) => reach.has(b));
  });
}

function ngIsRule(goal) {
  return goal.kind === 'offline' || goal.kind === 'isolated';
}

// ——— Rysowanie ———

function ngRender(state) {
  ngComputeNetwork(state);
  ngRenderHeatmap(state);
  ngRenderWires(state);
  ngRenderDevices(state);
  ngRenderTools(state);
  ngRenderGoals(state);
}

function ngRenderHeatmap(state) {
  const accessPoints = state.devices.filter(ngIsAccessPoint);
  [...state.cells.children].forEach((element, cell) => {
    if (state.walls.has(cell)) return;
    const point = { x: cell % state.cols, y: Math.floor(cell / state.cols) };
    const strength = Math.max(0, ...accessPoints.map((ap) => ngSignal(state, ap, point)));
    element.style.background = strength > 0 ? `rgba(28, 176, 246, ${(0.08 + strength * 0.32).toFixed(2)})` : '';
  });
}

function ngPoints(points) {
  return points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

function ngRenderWires(state) {
  const center = (device) => ({ x: device.x + 0.5, y: device.y + 0.5 });
  const links = state.links.map(({ ap, device, strength }) => `
    <line class="ng-link" x1="${ap.x + 0.5}" y1="${ap.y + 0.5}" x2="${device.x + 0.5}" y2="${device.y + 0.5}"
      style="opacity: ${(0.45 + strength * 0.55).toFixed(2)}" />`).join('');

  const cables = state.cables.map((cable) => {
    const a = ngDeviceById(state, cable.a);
    const b = ngDeviceById(state, cable.b);
    const points = ngPoints([center(a), ...cable.cells.map((cell) => ngCellCenter(state, cell)), center(b)]);
    const online = state.online.has(a.id) && state.online.has(b.id);
    return `
      <g class="ng-cable${online ? ' is-online' : ''}" data-cable="${cable.id}">
        <polyline class="ng-cable-line" points="${points}" />
        <polyline class="ng-cable-hit" points="${points}"><title>Kliknij, aby odłączyć kabel</title></polyline>
      </g>`;
  }).join('');

  // Tunel VPN: linia przerywana prosto nad ścianami, z podpisem pośrodku.
  const vpn = state.tunnels.map((tunnel) => {
    const a = center(ngDeviceById(state, tunnel.a));
    const b = center(ngDeviceById(state, tunnel.b));
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return `
      <g class="ng-vpn${tunnel.active ? ' is-active' : ''}">
        <line class="ng-vpn-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />
        <rect class="ng-vpn-badge" x="${mid.x - 0.42}" y="${mid.y - 0.2}" width="0.84" height="0.4" rx="0.2" />
        <text class="ng-vpn-text" x="${mid.x}" y="${mid.y}">VPN</text>
      </g>`;
  }).join('');

  let drag = '';
  if (state.drag) {
    const { from, cells, pointer } = state.drag;
    const points = [center(from), ...cells.map((cell) => ngCellCenter(state, cell))];
    if (pointer) points.push(pointer);
    drag = `<polyline class="ng-cable-drag" points="${ngPoints(points)}" />`;
  }

  state.body.querySelector('.ng-wires').innerHTML = links + cables + vpn + drag;
}

function ngRenderDevices(state) {
  state.body.querySelector('.ng-devices').innerHTML = state.devices.map((device) => {
    const info = NETWORK_DEVICES[device.type];
    const used = ngUsedPorts(state, device);
    const online = state.online.has(device.id);
    // Port uplink (WAN / wejście od gniazdka) jest pierwszy i ma inny kolor, za nim porty LAN.
    const uplinks = ngUsedUplinks(state, device);
    const ports = Array.from({ length: info.ports }, (_, port) => {
      if (info.uplink && port === 0) return `<i class="is-uplink${uplinks ? ' is-used' : ''}"></i>`;
      const lan = info.uplink ? port - 1 : port;
      return `<i class="${lan < used - uplinks ? 'is-used' : ''}"></i>`;
    }).join('');
    let signal = '';
    if (ngHasWifi(device)) {
      const strength = state.signals.get(device.id);
      const tone = strength > 0.5 ? 'is-strong' : strength > 0.2 ? 'is-medium' : strength > 0 ? 'is-weak' : 'is-none';
      signal = `<span class="ng-signal ${tone}" title="Siła Wi-Fi">${strength > 0 ? `${Math.round(strength * 100)}%` : '✗'}</span>`;
    }
    const upgrades = device.upgrades.map((id) => ` + ${NETWORK_TOOLS[id].label}`).join('');
    const label = `${info.label}${device.tag ? ` ${device.tag}` : ''}${upgrades}${online && device.type !== 'internet' ? ' — ma internet' : ''}`;
    // Okienko slotu: puste czeka na wzmocnienie, pełne pokazuje je i po kliknięciu je wyjmuje.
    // Pierwszy slot jest w prawym dolnym rogu, drugi w lewym górnym.
    const slot = (info.slots || []).filter((id) => !NETWORK_TOOLS[id].onlyWhenGiven || id in state.level.tools).map((id, place) => {
      const tool = NETWORK_TOOLS[id];
      return device.upgrades.includes(id)
        ? `<button class="ng-slot is-filled is-place-${place}" type="button" data-upgrade="${id}" title="Wyjmij: ${tool.label}" aria-label="Wyjmij: ${tool.label}">${tool.icon}</button>`
        : `<span class="ng-slot is-place-${place}" title="Pusty slot — włóż tu: ${tool.label}" data-slot="${id}"></span>`;
    }).join('');
    return `
      <div class="ng-device ng-${device.type}${online ? ' is-online' : ''}${device.fixed ? '' : ' is-placed'}"
        data-device="${device.id}" title="${label}"
        style="left: ${(device.x / state.cols) * 100}%; top: ${(device.y / state.rows) * 100}%">
        <span class="ng-device-box">
          <span class="ng-device-icon" aria-hidden="true">${info.icon}</span>
          <span class="ng-ports" aria-hidden="true">${ports}</span>
        </span>
        ${signal}
        ${slot}
        ${device.tag ? `<span class="ng-tag" aria-hidden="true">${device.tag}</span>` : ''}
        ${device.fixed ? '' : `<button class="ng-remove" type="button" title="Zabierz z planszy" aria-label="Zabierz ${info.label}">×</button>`}
      </div>`;
  }).join('');
}

function ngRenderTools(state) {
  const panel = state.body.querySelector('.ng-tools');
  const ids = Object.keys(state.tools);
  panel.hidden = !ids.length;
  ngMarkPlacing(state, state.selectedTool);
  panel.innerHTML = NETWORK_TOOL_GROUPS.map((group) => {
    const groupIds = ids.filter((id) => NETWORK_TOOLS[id].group === group.id);
    if (!groupIds.length) return '';
    return `
      <div class="ng-tool-group is-${group.id}">
        <p class="ng-tool-group-label">${group.label}</p>
        <div class="ng-tool-list">
          ${groupIds.map((id) => `
            <button class="ng-tool${state.selectedTool === id ? ' is-selected' : ''}" type="button" data-tool="${id}" ${state.tools[id] ? '' : 'disabled'}>
              <span class="ng-tool-icon" aria-hidden="true">${NETWORK_TOOLS[id].icon}</span>
              <span><b>${NETWORK_TOOLS[id].label}</b>zostało: ${state.tools[id]}</span>
            </button>`).join('')}
        </div>
      </div>`;
  }).join('');
  panel.querySelectorAll('.ng-tool').forEach((button) => {
    button.addEventListener('pointerdown', (event) => ngToolPointerDown(state, button.dataset.tool, event));
  });
}

// Gdy gracz trzyma wzmocnienie, pasujące puste sloty na planszy migają.
function ngMarkPlacing(state, toolId) {
  state.body.classList.toggle('is-placing', Boolean(toolId));
  state.body.querySelectorAll('.ng-slot[data-slot]').forEach((slot) => {
    slot.classList.toggle('is-target', slot.dataset.slot === toolId);
  });
}

function ngRenderGoals(state) {
  const results = state.level.goals.map((goal) => ({ goal, met: ngGoalMet(state, goal) }));
  state.body.querySelector('.ng-goals').innerHTML = results.map(({ goal, met }) => {
    const rule = ngIsRule(goal);
    const tone = rule ? (met ? 'is-rule' : 'is-broken') : (met ? 'is-done' : '');
    const mark = rule ? (met ? '!' : '✗') : (met ? '✓' : '');
    return `<li class="ng-goal ${tone}"><span class="ng-goal-mark" aria-hidden="true">${mark}</span>${goal.label}</li>`;
  }).join('');

  const broken = results.find(({ goal, met }) => ngIsRule(goal) && !met);
  if (broken && !state.broken) showNetworkMessage(state, broken.goal.alert || 'Ups! Drukarka dostała internet.', 'bad');
  state.broken = Boolean(broken);

  if (!state.won && results.every(({ met }) => met)) winNetworkLevel(state);
}

// ——— Myszka: kable, usuwanie, stawianie ———

function ngBoardPointerDown(state, event) {
  if (state.won || event.button > 0) return;
  event.preventDefault();
  const deviceElement = event.target.closest('.ng-device');
  const device = deviceElement && ngDeviceById(state, deviceElement.dataset.device);

  if (event.target.closest('.ng-remove')) {
    ngRemoveDevice(state, device);
    return;
  }
  const filledSlot = event.target.closest('.ng-slot.is-filled');
  if (filledSlot) {
    const id = filledSlot.dataset.upgrade;
    device.upgrades = device.upgrades.filter((upgrade) => upgrade !== id);
    state.tools[id] = (state.tools[id] || 0) + 1;
    // Bez modemu router nie może już siedzieć na gniazdku — ten kabel się odłącza.
    const unplug = id === 'modemModule' && ngUnplugInternet(state, device);
    showNetworkMessage(state, `Wyjęto: ${NETWORK_TOOLS[id].label}.${unplug ? ' Kabel od gniazdka odłączony.' : ''}`, 'good');
    ngRender(state);
    return;
  }
  const emptySlot = event.target.closest('.ng-slot');
  if (emptySlot && !state.selectedTool) {
    showNetworkMessage(state, `Pusty slot — przeciągnij tu: ${NETWORK_TOOLS[emptySlot.dataset.slot].label}.`, 'good');
    return;
  }

  const pointer = ngPointer(state, event.clientX, event.clientY);
  if (pointer.cell === null) return;
  if (state.selectedTool) {
    ngPlaceTool(state, state.selectedTool, pointer.cell);
    return;
  }

  const cableElement = event.target.closest('[data-cable]');
  if (cableElement) {
    if (state.cables.find((cable) => String(cable.id) === cableElement.dataset.cable).fixed) {
      showNetworkMessage(state, 'Tego kabla nie odłączaj — to łącze od dostawcy internetu.', 'bad');
      return;
    }
    state.cables = state.cables.filter((cable) => String(cable.id) !== cableElement.dataset.cable);
    showNetworkMessage(state, 'Kabel odłączony.', 'good');
    ngRender(state);
    return;
  }

  const target = device || ngDeviceAt(state, pointer.cell);
  if (!target) return;
  if (ngUsedPorts(state, target) >= NETWORK_DEVICES[target.type].ports) {
    showNetworkMessage(state, `${NETWORK_DEVICES[target.type].label}: wszystkie wypustki są zajęte.`, 'bad');
    return;
  }
  state.drag = { from: target, cells: [], pointer, lastCell: pointer.cell };
  state.board.setPointerCapture(event.pointerId);
  ngRenderWires(state);
}

function ngBoardPointerMove(state, event) {
  const { drag } = state;
  if (!drag) return;
  const pointer = ngPointer(state, event.clientX, event.clientY);
  // Idziemy po prostej od poprzedniej pozycji myszki, kratka po kratce — szybki ruch
  // nie przeskoczy ściany, a kabel zatrzymuje się na pierwszej przeszkodzie.
  const previous = drag.pointer;
  const steps = Math.max(1, Math.ceil(Math.hypot(pointer.x - previous.x, pointer.y - previous.y) * 8));
  for (let step = 1; step <= steps && state.drag === drag; step += 1) {
    const t = step / steps;
    const x = Math.floor(previous.x + (pointer.x - previous.x) * t);
    const y = Math.floor(previous.y + (pointer.y - previous.y) * t);
    if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) continue;
    const cell = ngCell(state, x, y);
    if (cell === drag.lastCell) continue;
    drag.lastCell = cell;
    if (!ngExtendCable(state, cell)) break;
  }
  drag.pointer = pointer;
  if (state.drag) ngRenderWires(state);
}

function ngBoardPointerUp(state) {
  if (!state.drag) return;
  const moved = state.drag.cells.length > 0;
  const { problem } = state.drag;
  state.drag = null;
  if (moved && !problem) showNetworkMessage(state, 'Kabel musi dojść do innego urządzenia.', 'bad');
  ngRenderWires(state);
}

// Kabel rośnie tylko o sąsiednią kratkę. Zwraca false, gdy dalej nie da się iść.
function ngExtendCable(state, cell) {
  const { drag } = state;
  const fromCell = ngCell(state, drag.from.x, drag.from.y);
  // Powrót na wcześniejszy kawałek kabla zwija go do tego miejsca.
  if (cell === fromCell) {
    drag.cells = [];
    return true;
  }
  const back = drag.cells.indexOf(cell);
  if (back !== -1) {
    drag.cells.length = back + 1;
    return true;
  }

  const head = drag.cells.length ? drag.cells[drag.cells.length - 1] : fromCell;
  const fromHead = ngNeighbors(state, head);
  if (!fromHead.includes(cell)) {
    // Ruch po skosie: kabel skręca przez wolny róg, ale nigdy przez ścianę.
    const corner = fromHead.find((next) => ngNeighbors(state, cell).includes(next) && ngIsFree(state, next));
    if (corner === undefined) return false;
    drag.cells.push(corner);
  }

  // Zapamiętany powód zostaje na ekranie po puszczeniu myszki zamiast ogólnego komunikatu.
  const target = ngDeviceAt(state, cell);
  drag.problem = target ? ngCableProblem(state, drag.from, target) : '';
  if (drag.problem) {
    showNetworkMessage(state, drag.problem, 'bad');
    return false;
  }
  if (state.walls.has(cell)) {
    showNetworkMessage(state, 'Kabel nie przejdzie przez ścianę.', 'bad');
    return false;
  }
  if (!target && !ngIsFree(state, cell)) {
    showNetworkMessage(state, 'Tu leży już inny kabel.', 'bad');
    return false;
  }
  if (!target) {
    drag.cells.push(cell);
    return true;
  }

  state.cables.push({ id: state.nextId++, a: drag.from.id, b: target.id, cells: drag.cells });
  state.drag = null;
  showNetworkMessage(state, 'Połączone!', 'good');
  ngRender(state);
}

function ngCableProblem(state, from, target) {
  const connected = state.cables.some((cable) =>
    (cable.a === from.id && cable.b === target.id) || (cable.a === target.id && cable.b === from.id));
  if (connected) return 'Te urządzenia są już połączone kablem.';
  const other = from.type === 'internet' ? target : target.type === 'internet' ? from : null;
  if (other && other.type === 'router' && !other.upgrades.includes('modemModule')) {
    return 'Ten router nie ma modemu. Najpierw włóż do jego slotu moduł modemu.';
  }
  if (other && other.type !== 'modem' && other.type !== 'router') {
    return 'Gniazdko od dostawcy podłącz do modemu — dopiero modem zamienia ten sygnał na sieć w domu.';
  }
  return ngPortProblem(state, from, target) || ngPortProblem(state, target, from);
}

function ngRemoveDevice(state, device) {
  state.devices = state.devices.filter((item) => item !== device);
  state.cables = state.cables.filter((cable) => cable.a !== device.id && cable.b !== device.id);
  state.tools[device.type] += 1;
  device.upgrades.forEach((id) => { state.tools[id] += 1; });
  ngRender(state);
}

// Odłącza kabel między urządzeniem a gniazdkiem Internetu. Zwraca true, gdy jakiś był.
function ngUnplugInternet(state, device) {
  const before = state.cables.length;
  state.cables = state.cables.filter((cable) => {
    const partner = cable.a === device.id ? cable.b : cable.b === device.id ? cable.a : null;
    return !partner || ngDeviceById(state, partner).type !== 'internet';
  });
  return state.cables.length < before;
}

// Narzędzie można przeciągnąć na planszę albo kliknąć, a potem kliknąć kratkę.
function ngToolPointerDown(state, toolId, event) {
  if (state.won || !state.tools[toolId] || event.button > 0) return;
  event.preventDefault();
  const start = { x: event.clientX, y: event.clientY };
  const ghost = document.createElement('div');
  ghost.className = 'ng-ghost';
  ghost.innerHTML = NETWORK_TOOLS[toolId].icon;
  ghost.hidden = true;
  document.body.append(ghost);
  let moved = false;

  const move = (moveEvent) => {
    if (!moved && Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) > 6) {
      moved = true;
      ngMarkPlacing(state, toolId);
    }
    ghost.hidden = !moved;
    ghost.style.transform = `translate(${moveEvent.clientX}px, ${moveEvent.clientY}px)`;
  };
  const end = (endEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    ghost.remove();
    if (networkGame !== state) return;
    ngMarkPlacing(state, state.selectedTool);
    if (endEvent.type === 'pointercancel') return;
    if (!moved) {
      state.selectedTool = state.selectedTool === toolId ? null : toolId;
      const upgrade = NETWORK_TOOLS[toolId].group === 'upgrade';
      if (state.selectedTool) showNetworkMessage(state, upgrade ? 'Kliknij urządzenie z pustym slotem.' : 'Kliknij miejsce na planszy.', 'good');
      ngRenderTools(state);
      return;
    }
    const pointer = ngPointer(state, endEvent.clientX, endEvent.clientY);
    if (pointer.cell !== null) ngPlaceTool(state, toolId, pointer.cell);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

function ngPlaceTool(state, toolId, cell) {
  if (!state.tools[toolId]) return;
  const device = ngDeviceAt(state, cell);
  let problem = '';

  const tool = NETWORK_TOOLS[toolId];

  if (tool.group === 'upgrade') {
    // Wzmocnienie trafia tylko do pasującego, pustego slotu.
    if (toolId === 'wifi' && device?.type === 'laptop') problem = 'Laptop ma już wbudowane Wi-Fi.';
    else if (!device || !(NETWORK_DEVICES[device.type].slots || []).includes(toolId)) problem = tool.where;
    else if (device.upgrades.includes(toolId)) problem = 'Ten slot jest już zajęty.';
    else device.upgrades.push(toolId);
  } else if (state.walls.has(cell)) {
    problem = 'Nie można stawiać na ścianie.';
  } else if (device) {
    problem = 'To miejsce jest zajęte.';
  } else if (ngCableCells(state).has(cell)) {
    problem = 'Tu leży kabel — wybierz wolną kratkę.';
  } else {
    state.devices.push({ id: `${toolId}${state.nextId++}`, type: toolId, x: cell % state.cols, y: Math.floor(cell / state.cols), fixed: false, upgrades: [] });
  }

  if (problem) {
    showNetworkMessage(state, problem, 'bad');
    return;
  }
  state.tools[toolId] -= 1;
  if (!state.tools[toolId]) state.selectedTool = null;
  const placedMessage = { wifi: 'Karta Wi-Fi włożona!', apModule: 'Router nadaje teraz Wi-Fi!', modemModule: 'Router ma teraz wbudowany modem!', vpn: 'Usługa VPN włączona!' }[toolId] || 'Ustawione!';
  showNetworkMessage(state, placedMessage, 'good');
  ngRender(state);
}

// ——— Wygrana, komunikaty, koniec gry ———

function winNetworkLevel(state) {
  state.won = true;
  state.selectedTool = null;
  const { topic, index, game, levelIndex } = state;
  const last = levelIndex === game.levels.length - 1;
  setQuizProgress((levelIndex + 1) / game.levels.length);
  state.body.querySelectorAll('.ng-device.is-online').forEach((element) => {
    burstFileGameConfetti(element.getBoundingClientRect(), topic.accent);
  });

  setTimeout(() => {
    if (networkGame !== state) return;
    const overlay = state.body.querySelector('.fg-overlay');
    const card = overlay.querySelector('.fg-overlay-card');
    card.innerHTML = `
      <div class="summary-icon" aria-hidden="true">${last ? '🏆' : '🌐'}</div>
      <h2>${last ? 'Wszystkie sieci działają!' : 'Sieć działa!'}</h2>
      <p>${last ? `Udało Ci się przejść wszystkie ${game.levels.length} poziomów.` : `Poziom ${levelIndex + 1} zaliczony. Czas na kolejny!`}</p>
      ${state.level.fact ? `<p class="ng-fact"><b>Czy wiesz?</b> ${state.level.fact}</p>` : ''}
      <div class="summary-actions">
        <button class="primary-button quiz-finish" type="button">${last ? `Odbierz ${game.reward} pkt` : 'Następny poziom'}</button>
      </div>
    `;
    card.querySelector('.quiz-finish').addEventListener('click', () => {
      if (last) finishNetworkGame(state);
      else startNetworkLevel(topic, index, game, levelIndex + 1);
    });
    overlay.hidden = false;
    card.querySelector('.quiz-finish').focus();
  }, 700);
}

function showNetworkMessage(state, text, tone) {
  const message = state.body.querySelector('.fg-message');
  message.textContent = text;
  message.className = `fg-message is-${tone}`;
  clearTimeout(state.messageTimer);
  state.messageTimer = setTimeout(() => {
    message.textContent = '';
  }, 2000);
}

function finishNetworkGame(state) {
  const { topic, index, game } = state;
  stopNetworkGame();

  const earned = Math.max(0, game.reward - readQuizBest(game.id));
  if (earned) {
    saveQuizBest(game.id, game.reward);
    saveStudentPoints(readStudentPoints() + earned);
  }
  completeLesson(topic, index);

  setQuizProgress(1);
  app.querySelector('#quiz-prompt').textContent = 'Brawo, gra ukończona!';
  app.querySelector('#quiz-hint').textContent = 'Wiesz już, jak zbudowana jest sieć: gniazdko, modem, router, kable i Wi-Fi.';

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body quiz-summary';
  body.innerHTML = `
    <div class="summary-icon" aria-hidden="true">🏆</div>
    <div class="summary-stats">
      <div><strong>${game.levels.length}</strong><span>zbudowanych sieci</span></div>
      <div><strong>+${formatPoints(earned)}</strong><span>nowych punktów</span></div>
    </div>
    <div class="summary-actions">
      <button class="secondary-button quiz-retry" type="button">Zagraj ponownie</button>
      <a class="primary-button quiz-finish" href="#/sciezka/${topic.slug}">Wróć do ścieżki <span aria-hidden="true">→</span></a>
    </div>
  `;
  body.querySelector('.quiz-retry').addEventListener('click', () => startNetworkLevel(topic, index, game, 0));
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
