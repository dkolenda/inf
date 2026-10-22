// Gra „Kosmo Kroki” (na wzór Scottie Go!): dziecko układa program z kart — Idź, W lewo, W prawo, Przeskocz,
// Podnieś, Podaj, Rzuć, Unikaj, Przesuń, Przełącz, Powtórz, Jeśli, Gdy i Funkcja — a kosmita Kosmo wykonuje go
// krok po kroku na planszy.
// Cel: zebrać kryształy (i zanieść baterie do rakiety) i skończyć program z Kosmo na rakiecie. Mniej kart = więcej gwiazdek.
// Program zaczyna stały bloczek Start (jest tylko jeden).
// Program to drzewo: { main: [...], funcs: [{ id, name, body: [...] }] }, karta to { card, digits?, body? (Powtórz, Jeśli, Gdy),
// cond? (bloczek włożony w gniazdo karty: przedmiot-warunek Jeśli, postać Przełącz, zdarzenie Gdy), fn? (Funkcja — id wołanej funkcji) }.
// Funkcji może być kilka. Funkcja może wołać inną funkcję, ale nie samą siebie (także przez inne funkcje) —
// chyba że poziom ma recursion: wtedy wolno (rekurencja), a silnik pilnuje, by nie wołała się bez końca.
// Na planszy z kilkoma postaciami (Kosmo w trzech kolorach, Robo) karta Przełącz mówi, kogo słuchają karty.
// Karta Gdy nie wykonuje się po kolei — czeka na zdarzenie (złapany przedmiot, meteoryt) i wtedy wykonuje swój środek.
// Część „silnik” (kkParse, kkCreateWorld, kkExecute, kkRun, kkCount) nie dotyka DOM — testuje się ją w node.
// Korzysta z funkcji app.js (setQuizProgress, completeLesson, saveStudentPoints…) i burstFileGameConfetti z file-game.js.
let kosmoGame = null;

// v2 — poziomy ułożone od nowa, więc stare gwiazdki i programy nie pasują do nowych numerów.
const KK_STORAGE_KEY = 'informatyczna-przygoda:kosmo-kroki';
const KK_SAVE_VERSION = 'v2';
const KK_STEP_MS = 420;
const KK_MAX_CARDS = 40;
// Rekurencja: najwyżej tyle funkcji naraz w środku siebie, a cały program — najwyżej tyle kart do wykonania.
const KK_MAX_DEPTH = 50;
const KK_MAX_TICKS = 2000;
const KK_DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const KK_TURNS = {
  left: { N: 'W', W: 'S', S: 'E', E: 'N' },
  right: { N: 'E', E: 'S', S: 'W', W: 'N' }
};
const KK_ANGLES = { N: 0, E: 90, S: 180, W: 270 };

// digits — karta trzyma po prawej bloczki z cyframi 0–9, czytane razem jak jedna liczba (1 i 2 to 12).
// Idź bez cyfr to 1 krok, Powtórz bez cyfr nie działa. Cyfry to nie karty programu — nie liczą się do gwiazdek.
// body — karta ma środek, do którego wkłada się inne karty (Powtórz, Jeśli).
// Jeśli ma po prawej gniazdo na jeden przedmiot (KK_CONDS) — on mówi, co sprawdzić. Przedmiot też nie liczy się do gwiazdek.
const KK_CARDS = {
  step: { icon: '⬆', label: 'Idź', digits: true },
  left: { icon: '↶', label: 'W lewo' },
  right: { icon: '↷', label: 'W prawo' },
  jump: { icon: '⤴', label: 'Przeskocz' },
  take: { icon: '✋', label: 'Podnieś' },
  give: { icon: '🤝', label: 'Podaj' },
  throw: { icon: '🎯', label: 'Rzuć' },
  dodge: { icon: '💨', label: 'Unikaj' },
  push: { icon: '💪', label: 'Przesuń' },
  swap: { icon: '🔄', label: 'Przełącz' },
  repeat: { icon: '🔁', label: 'Powtórz', digits: true, body: true },
  if: { icon: '❓', label: 'Jeśli', body: true },
  on: { icon: '📡', label: 'Gdy', body: true },
  call: { icon: '⭐', label: 'Funkcja' },
  number: { icon: '🔢', label: 'Cyfry' },
  cond: { icon: '💎', label: 'Przedmioty' },
  who: { icon: '👽', label: 'Postacie' },
  event: { icon: '📡', label: 'Zdarzenia' }
};
const KK_MAX_DIGITS = 2;

// Przedmioty do gniazda karty Jeśli. Sprawdzają postać, która właśnie słucha kart.
const KK_CONDS = {
  crystal: { icon: '💎', label: 'Kryształ', text: 'stoisz na krysztale' },
  free: { icon: '🟩', label: 'Wolne', text: 'pole przed Tobą jest wolne' },
  crater: { icon: '🕳️', label: 'Krater', text: 'przed Tobą jest krater' },
  box: { icon: '📦', label: 'Skrzynia', text: 'przed Tobą stoi skrzynia' }
};

// Postacie do gniazda karty Przełącz. Kosmo w kolorach to ta sama grafika z przesuniętą barwą (kkWhoIcon).
const KK_WHO = {
  kosmo: { label: 'Zielony' },
  blue: { label: 'Niebieski' },
  pink: { label: 'Różowy' },
  robo: { icon: '🤖', label: 'Robo' }
};

// Zdarzenia do gniazda karty Gdy. Zdarzenie dzieje się jednej postaci — to ona wykonuje środek karty.
const KK_EVENTS = {
  catch: { icon: '🤲', label: 'Złapiesz', text: 'gdy złapiesz przedmiot' },
  meteor: { icon: '☄️', label: 'Meteoryt', text: 'gdy spada na Ciebie meteoryt' }
};

// Bloczki, które wkłada się w gniazdo po prawej stronie karty: rodzaj → karta, która go przyjmuje.
const KK_SLOTS = {
  cond: { host: 'if', items: KK_CONDS, hint: 'Przeciągnij przedmiot na kartę Jeśli.' },
  who: { host: 'swap', items: KK_WHO, hint: 'Przeciągnij postać na kartę Przełącz.' },
  event: { host: 'on', items: KK_EVENTS, hint: 'Przeciągnij zdarzenie na kartę Gdy.' }
};

function kkSlotOf(card) {
  return Object.keys(KK_SLOTS).find((kind) => KK_SLOTS[kind].host === card);
}

// Funkcje mają id f1–f4. Ikona zależy od id, więc nie zmienia się, gdy inna funkcja zniknie.
const KK_MAX_FUNCS = 4;
const KK_FUNC_ICONS = ['⭐', '🌙', '☀️', '🪐'];

// Kategorie na belce z kartami. Nad nimi zwinięta kategoria „Sugerowane” z kartami poziomu.
const KK_GROUPS = [
  ['Ruch', ['step', 'left', 'right', 'jump']],
  ['Akcje', ['take', 'give', 'throw', 'dodge', 'push']],
  ['Postacie', ['swap', 'who']],
  ['Pętle', ['repeat']],
  ['Warunki', ['if', 'cond']],
  ['Zdarzenia', ['on', 'event']],
  ['Cyfry', ['number']],
  ['Funkcje', ['call']]
];

// Grafiki gry. Gdy pliku brak, w jego miejscu pokazuje się emoji. Bez pliku w KK_ART od razu emoji.
const KK_ART = {
  kosmo: 'assets/kosmo-kroki/kosmo.png',
  kosmoFallen: 'assets/kosmo-kroki/kosmo-knocked-out.png',
  rocket: 'assets/kosmo-kroki/rakieta.png',
  crystal: 'assets/kosmo-kroki/krysztal.png',
  rock: 'assets/kosmo-kroki/skala.png',
  slime: 'assets/kosmo-kroki/sluz.png',
  ground: 'assets/kosmo-kroki/teren.png',
  cover: 'assets/kosmo-kroki/okladka.png'
};
const KK_EMOJI = { kosmo: '👽', robo: '🤖', rocket: '🚀', crystal: '💎', rock: '🪨', box: '📦', crater: '🕳️', battery: '🔋', meteor: '☄️', slime: '', cover: '' };
const KK_NAMES = { kosmo: 'Kosmo', blue: 'Niebieski Kosmo', pink: 'Różowy Kosmo', robo: 'Robo' };
// Litery postaci na mapie: K Kosmo (zielony), N niebieski, P różowy, D Robo. Kolejność to też kolejność przełączania bez bloczka.
const KK_CHAR_TILES = { K: 'kosmo', S: 'kosmo', N: 'blue', P: 'pink', D: 'robo' };

// Komunikaty, gdy postać nie może wejść na pole. „Kosmo” zamienia się na imię postaci, która słucha kart.
const KK_BLOCKED = {
  edge: 'Tam kończy się plansza — Kosmo by spadł!',
  '#': 'Ojej, skała! Kosmo nie przejdzie przez nią.',
  '~': 'Fuj, śluz! Kosmo poślizgnął się i przewrócił.',
  o: 'Krater! Kosmo by do niego wpadł.',
  box: 'Na drodze stoi skrzynia — przesuń ją kartą Przesuń.'
};

// ——— Silnik ———

// Zapis tekstowy programu (do rozwiązań w quizzes.js i testów): F3 idź 3, L, R, T podnieś, J przeskocz, B przesuń,
// G podaj, W rzuć, U unikaj, Z przełącz (Zk / Zn / Zp / Zr — na zielonego, niebieskiego, różowego Kosmo, na Robo),
// X funkcja (X2 — funkcja f2), P3( … ) powtórz 3 razy,
// Ic( … ) / If( … ) / Io( … ) / Ib( … ) jeśli kryształ / wolne / krater / skrzynia,
// Ec( … ) / Em( … ) gdy złapiesz przedmiot / gdy spada meteoryt.
function kkParse(text = '') {
  const tokens = text.match(/P\d*\(|[IE][a-z]\(|F\d*|X\d*|Z[knpr]?|[LRTJBGWU)]/g) || [];
  const names = { F: 'step', L: 'left', R: 'right', T: 'take', J: 'jump', B: 'push', G: 'give', W: 'throw', U: 'dodge' };
  const conds = { c: 'crystal', f: 'free', o: 'crater', b: 'box' };
  const events = { c: 'catch', m: 'meteor' };
  const who = { k: 'kosmo', n: 'blue', p: 'pink', r: 'robo' };
  let pos = 0;
  const list = () => {
    const out = [];
    while (pos < tokens.length && tokens[pos] !== ')') {
      const token = tokens[pos++];
      const n = Number(token.replace(/\D/g, ''));
      if (token[0] === 'P') {
        out.push({ card: 'repeat', digits: String(n || 2), body: list() });
        pos += 1;
      } else if (token[0] === 'I') {
        out.push({ card: 'if', cond: conds[token[1]], body: list() });
        pos += 1;
      } else if (token[0] === 'E') {
        out.push({ card: 'on', cond: events[token[1]], body: list() });
        pos += 1;
      } else if (token[0] === 'F') out.push(n ? { card: 'step', digits: String(n) } : { card: 'step' });
      else if (token[0] === 'X') out.push({ card: 'call', fn: `f${n || 1}` });
      else if (token[0] === 'Z') out.push(token[1] ? { card: 'swap', cond: who[token[1]] } : { card: 'swap' });
      else out.push({ card: names[token] });
    }
    return out;
  };
  return list();
}

// Mapa: K Kosmo (N niebieski, P różowy), D Robo, S Kosmo na rakiecie, R rakieta, C kryształ, E bateria, B skrzynia,
// o krater, # skała, ~ śluz, . grunt.
// Poziom z meteors: tyle meteorytów spada na losowe pola gruntu — za każdym razem gdzie indziej (random).
function kkCreateWorld(level, random = Math.random) {
  const world = {
    cols: level.map[0].length,
    rows: level.map.length,
    crystals: new Set(),
    numbers: new Map(Object.entries(level.labels || {})),
    taken: [],
    boxes: new Set(),
    batteries: new Set(),
    loaded: 0,
    filled: new Set(),
    meteors: new Set(),
    rocket: null,
    chars: [],
    active: 0,
    ticks: 0,
    steps: 0,
    best: level.best || 0,
    handlers: [],
    depth: 0
  };
  const dir = level.dir || 'E';
  // face — w którą stronę (E albo W) patrzy obrazek postaci. Przy obrocie na N albo S zostaje poprzednia.
  const char = (who, x, y, d) => ({ who, x, y, dir: d, angle: KK_ANGLES[d], face: d === 'W' ? 'W' : 'E', holding: null });
  const ground = [];
  level.map.forEach((row, y) => [...row].forEach((tile, x) => {
    const who = KK_CHAR_TILES[tile];
    if (who) world.chars.push(char(who, x, y, level.dirs?.[who] || (who === 'robo' && level.roboDir) || dir));
    if (tile === 'R' || tile === 'S') world.rocket = { x, y };
    if (tile === 'C') world.crystals.add(`${x},${y}`);
    if (tile === 'B') world.boxes.add(`${x},${y}`);
    if (tile === 'E') world.batteries.add(`${x},${y}`);
    if (tile === '.') ground.push(`${x},${y}`);
  }));
  const order = Object.values(KK_CHAR_TILES);
  world.chars.sort((a, b) => order.indexOf(a.who) - order.indexOf(b.who));
  world.kosmo = world.chars[0];
  for (let i = 0; i < (level.meteors || 0) && ground.length; i++) {
    world.meteors.add(ground.splice(Math.floor(random() * ground.length), 1)[0]);
  }
  world.total = world.crystals.size;
  world.batteryTotal = world.batteries.size;
  return world;
}

function kkTile(level, x, y) {
  const tile = level.map[y]?.[x];
  return tile === undefined ? 'edge' : tile;
}

function kkActive(world) {
  return world.chars[world.active];
}

function kkCharAt(world, x, y) {
  return world.chars.find((ch) => ch.x === x && ch.y === y);
}

// Co jest teraz na polu: edge, #, ~, o (krater), box, char (inna postać) albo . (da się wejść).
// Zasypany krater jest zwykłym gruntem.
function kkSpot(level, world, x, y) {
  const tile = kkTile(level, x, y);
  const key = `${x},${y}`;
  if (tile === 'edge' || tile === '#' || tile === '~') return tile;
  if (tile === 'o' && !world.filled.has(key)) return 'o';
  if (world.boxes.has(key)) return 'box';
  if (kkCharAt(world, x, y)) return 'char';
  return '.';
}

// Dlaczego postać ch nie wejdzie na pole x, y (null, gdy wejdzie). Robo jeździ po śluzie, Kosmo wchodzi na niego i się przewraca.
function kkBlockMessage(spot, ch, world, x, y) {
  if (spot === '.' || (spot === '~' && ch.who === 'robo')) return null;
  if (spot === 'char') return `Tam stoi ${KK_NAMES[kkCharAt(world, x, y)?.who] || 'ktoś inny'}!`;
  return KK_BLOCKED[spot].replace(/Kosmo/g, KK_NAMES[ch.who]);
}

function kkCheck(cond, level, world) {
  const ch = kkActive(world);
  if (cond === 'crystal') return world.crystals.has(`${ch.x},${ch.y}`);
  const [dx, dy] = KK_DIRS[ch.dir];
  const [x, y] = [ch.x + dx, ch.y + dy];
  const spot = kkSpot(level, world, x, y);
  if (cond === 'crater') return spot === 'o';
  if (cond === 'box') return spot === 'box';
  return !kkBlockMessage(spot, ch, world, x, y);
}

function kkCount(list) {
  return list.reduce((sum, node) => sum + 1 + (node.body ? kkCount(node.body) : 0), 0);
}

// Starszy zapis (i rozwiązania w quizzes.js) ma jedną funkcję w polu func — to funkcja f1.
function kkFuncs(program) {
  return program.funcs || (program.func ? [{ id: 'f1', body: program.func }] : []);
}

// Id funkcji wołanych w liście kart (także w środku Powtórz i Jeśli).
function kkCallsIn(list, out = new Set()) {
  list.forEach((node) => {
    if (node.card === 'call') out.add(node.fn || 'f1');
    if (node.body) kkCallsIn(node.body, out);
  });
  return out;
}

// Czy funkcja from woła (wprost albo przez inne funkcje) funkcję to.
function kkReaches(program, from, to, seen = new Set()) {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  const func = kkFuncs(program).find((f) => f.id === from);
  return Boolean(func) && [...kkCallsIn(func.body)].some((fn) => kkReaches(program, fn, to, seen));
}

// Karta funkcji fn w środku funkcji inFunc nie może zrobić kółka wywołań — chyba że poziom pozwala na rekurencję.
function kkCanCall(program, inFunc, fn, recursion) {
  return recursion || !inFunc || fn === 'new' || !kkReaches(program, fn, inFunc);
}

function kkProgramCount(program) {
  return kkCount(program.main) + kkFuncs(program).reduce((sum, func) => sum + kkCount(func.body), 0);
}

function kkOnRocket(world, ch) {
  return ch.x === world.rocket.x && ch.y === world.rocket.y;
}

// Wygrana: wszystkie kryształy zebrane, baterie w rakiecie, a któryś Kosmo (nie Robo) stoi na rakiecie.
// Na poziomie z najkrótszą drogą (best) Kosmo nie może zrobić więcej kroków.
function kkGoalReached(world) {
  if (world.crystals.size || world.loaded < world.batteryTotal) return false;
  if (world.best && world.steps > world.best) return false;
  return world.chars.some((ch) => ch.who !== 'robo' && kkOnRocket(world, ch));
}

// Liczba na krysztale, który trzeba podnieść teraz: najmniejsza (sort asc) albo największa (desc) z leżących.
function kkNextNumber(world, sort) {
  const left = [...world.crystals].map((key) => world.numbers.get(key));
  return sort === 'desc' ? Math.max(...left) : Math.min(...left);
}

// Karty Gdy z całego programu. Nie wykonują się po kolei — czekają na swoje zdarzenie.
function kkHandlers(program) {
  const out = [];
  const search = (list) => list.forEach((node) => {
    if (node.card === 'on') out.push(node);
    else if (node.body) search(node.body);
  });
  search(program.main);
  kkFuncs(program).forEach((func) => search(func.body));
  return out;
}

// Wykonuje program krok po kroku. Każdy krok zmienia świat i zwraca zdarzenie dla animacji:
// { node, type: move | turn | jump | take | grab | give | throw | load | dodge | meteor | crash | push | swap |
//   loop | if | call | event | error, … }.
// Po zdarzeniu error program się kończy.
function* kkExecute(program, level, world) {
  world.program = program;
  world.handlers = kkHandlers(program);
  yield* kkExecList(program.main, program, level, world, []);
}

// stack — funkcje, które właśnie się wykonują.
function* kkExecList(list, program, level, world, stack) {
  for (const node of list) {
    if (node.card === 'on') continue;
    if (++world.ticks > KK_MAX_TICKS) {
      yield { node, type: 'error', message: 'Program działa i działa… Czy pętla albo funkcja nie kręci się bez końca?' };
      return true;
    }
    if (node.card === 'repeat') {
      if (!node.digits) {
        yield { node, type: 'error', message: 'Karta Powtórz nie wie, ile razy — połóż po jej prawej bloczki z cyframi.' };
        return true;
      }
      for (let round = 1; round <= Number(node.digits); round++) {
        yield { node, type: 'loop', round };
        if (yield* kkExecList(node.body, program, level, world, stack)) return true;
      }
    } else if (node.card === 'if') {
      if (!node.cond) {
        yield { node, type: 'error', message: 'Karta Jeśli nie wie, co sprawdzić — połóż po jej prawej przedmiot, np. kryształ.' };
        return true;
      }
      const ok = kkCheck(node.cond, level, world);
      yield { node, type: 'if', ok };
      if (ok && (yield* kkExecList(node.body, program, level, world, stack))) return true;
    } else if (node.card === 'call') {
      const func = kkFuncs(program).find((f) => f.id === (node.fn || 'f1'));
      if (!func) {
        yield { node, type: 'error', message: 'Tej funkcji już nie ma — usuń jej kartę.' };
        return true;
      }
      // Bez rekurencji funkcja nie woła samej siebie — edytor na to nie pozwala, a silnik pilnuje na wszelki wypadek.
      if (stack.includes(func.id) && !level.recursion) {
        yield { node, type: 'error', message: 'Funkcja nie może wołać samej siebie.' };
        return true;
      }
      if (stack.length >= KK_MAX_DEPTH) {
        yield { node, type: 'error', message: 'Funkcja woła samą siebie bez końca! Włóż to wołanie do karty Jeśli, żeby wiedziała, kiedy przestać.' };
        return true;
      }
      yield { node, type: 'call' };
      if (yield* kkExecList(func.body, program, level, world, [...stack, func.id])) return true;
    } else if (yield* kkAct(node, level, world)) return true;
  }
  return false;
}

// Zdarzenie spotkało postać ch: każda karta Gdy z tym zdarzeniem wykonuje swój środek, a karty słucha wtedy ch.
// Potem karty znowu słuchają postaci, która słuchała przedtem. Zwraca true przy błędzie.
function* kkFire(event, ch, level, world) {
  const handlers = world.handlers.filter((node) => node.cond === event);
  if (!handlers.length) return false;
  if (world.depth >= 12) {
    yield { node: handlers[0], type: 'error', message: 'Postacie rzucają do siebie bez końca! Ktoś musi przestać rzucać.' };
    return true;
  }
  const before = world.active;
  world.depth += 1;
  for (const node of handlers) {
    world.active = world.chars.indexOf(ch);
    yield { node, type: 'event', event };
    if (yield* kkExecList(node.body, world.program, level, world, [])) return true;
  }
  world.depth -= 1;
  world.active = before;
  return false;
}

// Postać weszła na pole: z baterią na rakiecie wkłada ją do środka, a na polu z meteorytem musi zrobić unik.
function* kkLand(node, ch, level, world) {
  if (ch.holding && kkOnRocket(world, ch)) {
    ch.holding = null;
    world.loaded += 1;
    yield { node, type: 'load' };
  }
  const key = `${ch.x},${ch.y}`;
  if (!world.meteors.has(key)) return false;
  world.meteors.delete(key);
  ch.dodged = false;
  yield { node, type: 'meteor', key };
  if (yield* kkFire('meteor', ch, level, world)) return true;
  if (!ch.dodged) {
    const listens = world.handlers.some((on) => on.cond === 'meteor');
    yield {
      node,
      type: 'error',
      hit: true,
      message: listens
        ? `Meteoryt trafił ${KK_NAMES[ch.who]}! W karcie Gdy ☄️ zabrakło karty Unikaj.`
        : `Meteoryt trafił ${KK_NAMES[ch.who]}! Nie wiadomo, gdzie spadnie — połóż kartę Gdy ☄️ z kartą Unikaj w środku.`
    };
    return true;
  }
  yield { node, type: 'crash', key };
  return false;
}

// Postać ch dostała przedmiot (podany albo złapany w locie).
function* kkCaught(node, ch, level, world) {
  if (yield* kkFire('catch', ch, level, world)) return true;
  if (ch.holding && kkOnRocket(world, ch)) {
    ch.holding = null;
    world.loaded += 1;
    yield { node, type: 'load' };
  }
  return false;
}

// Zwraca true, gdy wystąpił błąd i program trzeba zatrzymać.
function* kkAct(node, level, world) {
  const ch = kkActive(world);
  const name = KK_NAMES[ch.who];
  const fail = (message, bump = ch.dir) => ({ node, type: 'error', message, bump });
  const slip = () => ({ node, type: 'error', message: kkBlockMessage('~', ch, world), slip: true });
  if (node.card === 'left' || node.card === 'right') {
    ch.dir = KK_TURNS[node.card][ch.dir];
    ch.angle += node.card === 'left' ? -90 : 90;
    if (ch.dir === 'E' || ch.dir === 'W') ch.face = ch.dir;
    yield { node, type: 'turn' };
    return false;
  }
  if (node.card === 'take') {
    const key = `${ch.x},${ch.y}`;
    if (world.batteries.has(key)) {
      if (ch.holding) {
        yield fail(`${name} ma już pełne ręce.`, 'take');
        return true;
      }
      world.batteries.delete(key);
      ch.holding = 'battery';
      yield { node, type: 'grab', key };
      return false;
    }
    if (!world.crystals.has(key)) {
      yield fail(world.batteryTotal ? 'Tu nie ma kryształu ani baterii do podniesienia.' : 'Tu nie ma kryształu do podniesienia.', 'take');
      return true;
    }
    if (world.numbers.size) {
      const need = kkNextNumber(world, level.sort);
      if (world.numbers.get(key) !== need) {
        yield fail(`Nie po kolei! Najpierw kryształ z liczbą ${need} — ${level.sort === 'desc' ? 'od największej do najmniejszej' : 'od najmniejszej do największej'}.`, 'take');
        return true;
      }
    }
    world.crystals.delete(key);
    world.taken.push(key);
    yield { node, type: 'take', key };
    return false;
  }
  if (node.card === 'swap') {
    if (node.cond) {
      const at = world.chars.findIndex((other) => other.who === node.cond);
      if (at === -1) {
        yield fail(`Na tej planszy nie ma postaci ${KK_WHO[node.cond].label === 'Robo' ? 'Robo' : `${KK_WHO[node.cond].label} Kosmo`}.`, 'take');
        return true;
      }
      world.active = at;
    } else {
      if (world.chars.length < 2) {
        yield fail('Na tej planszy nie ma drugiej postaci.', 'take');
        return true;
      }
      world.active = (world.active + 1) % world.chars.length;
    }
    yield { node, type: 'swap' };
    return false;
  }
  if (node.card === 'dodge') {
    ch.dodged = true;
    yield { node, type: 'dodge' };
    return false;
  }
  const [dx, dy] = KK_DIRS[ch.dir];
  if (node.card === 'give') {
    const other = kkCharAt(world, ch.x + dx, ch.y + dy);
    if (!ch.holding) {
      yield fail(`${name} nie ma nic w rękach — najpierw podnieś baterię.`, 'take');
      return true;
    }
    if (!other) {
      yield fail('Podać można tylko komuś, kto stoi tuż przed Tobą.', 'take');
      return true;
    }
    if (other.holding) {
      yield fail(`${KK_NAMES[other.who]} ma już pełne ręce.`, 'take');
      return true;
    }
    other.holding = ch.holding;
    ch.holding = null;
    yield { node, type: 'give', from: world.chars.indexOf(ch), to: world.chars.indexOf(other) };
    return yield* kkCaught(node, other, level, world);
  }
  if (node.card === 'throw') {
    if (!ch.holding) {
      yield fail(`${name} nie ma nic w rękach — najpierw podnieś baterię.`, 'take');
      return true;
    }
    // Rzucona bateria leci nad kraterami i śluzem, aż ktoś ją złapie albo trafi do rakiety.
    let [x, y] = [ch.x + dx, ch.y + dy];
    for (;;) {
      const tile = kkTile(level, x, y);
      const other = kkCharAt(world, x, y);
      const from = world.chars.indexOf(ch);
      if (tile === 'edge' || tile === '#' || world.boxes.has(`${x},${y}`)) {
        ch.holding = null;
        yield { node, type: 'throw', from, x: x - dx, y: y - dy, lost: true };
        yield fail(tile === 'edge' ? 'Bateria wyleciała poza planszę — nikt jej nie złapał.' : `Bateria odbiła się od ${tile === '#' ? 'skały' : 'skrzyni'} i się zgubiła.`, 'take');
        return true;
      }
      if (other) {
        if (other.holding) {
          yield fail(`${KK_NAMES[other.who]} ma już pełne ręce — nie złapie.`, 'take');
          return true;
        }
        other.holding = ch.holding;
        ch.holding = null;
        yield { node, type: 'throw', from, x, y, to: world.chars.indexOf(other) };
        return yield* kkCaught(node, other, level, world);
      }
      if (world.rocket.x === x && world.rocket.y === y) {
        ch.holding = null;
        world.loaded += 1;
        yield { node, type: 'throw', from, x, y, rocket: true };
        yield { node, type: 'load' };
        return false;
      }
      x += dx;
      y += dy;
    }
  }
  if (node.card === 'jump') {
    if (ch.who === 'robo') {
      yield fail('Robo jest za ciężki — nie umie skakać.', 'take');
      return true;
    }
    const over = kkSpot(level, world, ch.x + dx, ch.y + dy);
    if (over === 'edge' || over === '#' || over === 'box' || over === 'char') {
      yield fail(over === 'edge' ? KK_BLOCKED.edge
        : over === '#' ? 'Skała jest za wysoka — nie da się jej przeskoczyć.'
        : over === 'box' ? 'Skrzynia jest za wysoka — nie da się jej przeskoczyć.'
        : 'Nie skacz nad innymi — to niebezpieczne!');
      return true;
    }
    const [lx, ly] = [ch.x + 2 * dx, ch.y + 2 * dy];
    const land = kkSpot(level, world, lx, ly);
    const why = land !== '~' && kkBlockMessage(land, ch, world, lx, ly);
    if (why) {
      yield fail(`${name} nie ma gdzie wylądować. ${why}`);
      return true;
    }
    ch.x = lx;
    ch.y = ly;
    world.steps += 2;
    yield { node, type: 'jump' };
    if (land === '~') {
      yield slip();
      return true;
    }
    return yield* kkLand(node, ch, level, world);
  }
  if (node.card === 'push') {
    const [bx, by] = [ch.x + dx, ch.y + dy];
    if (kkSpot(level, world, bx, by) !== 'box') {
      yield fail('Przed Tobą nie ma skrzyni do przesunięcia.', 'take');
      return true;
    }
    const [tx, ty] = [bx + dx, by + dy];
    const target = kkSpot(level, world, tx, ty);
    const to = `${tx},${ty}`;
    const fill = target === 'o';
    if (!fill && (target !== '.' || world.crystals.has(to) || world.batteries.has(to) || (world.rocket.x === tx && world.rocket.y === ty))) {
      yield fail(target === '~' ? 'Skrzynia ugrzęzłaby w śluzie — nie da się jej tam wepchnąć.' : 'Skrzynia nie przesunie się — za nią nie ma wolnego pola.');
      return true;
    }
    const from = `${bx},${by}`;
    world.boxes.delete(from);
    if (fill) world.filled.add(to);
    else world.boxes.add(to);
    ch.x = bx;
    ch.y = by;
    world.steps += 1;
    yield { node, type: 'push', from, to, fill };
    return yield* kkLand(node, ch, level, world);
  }
  for (let step = 1; step <= (node.digits ? Number(node.digits) : 1); step++) {
    const [x, y] = [ch.x + dx, ch.y + dy];
    const spot = kkSpot(level, world, x, y);
    const why = spot !== '~' && kkBlockMessage(spot, ch, world, x, y);
    if (why) {
      yield fail(why);
      return true;
    }
    ch.x = x;
    ch.y = y;
    world.steps += 1;
    yield { node, type: 'move', step };
    if (spot === '~' && kkBlockMessage(spot, ch, world)) {
      yield slip();
      return true;
    }
    if (yield* kkLand(node, ch, level, world)) return true;
  }
  return false;
}

// Uruchamia cały program od razu (test i sprawdzanie rozwiązań).
function kkRun(level, program, random = Math.random) {
  const world = kkCreateWorld(level, random);
  let error = null;
  for (const event of kkExecute(program, level, world)) {
    if (event.type === 'error') error = event.message;
  }
  return { world, error, won: !error && kkGoalReached(world) };
}

function kkStars(level, count) {
  return count <= level.stars[0] ? 3 : count <= level.stars[1] ? 2 : 1;
}

function kkGoalMessage(world) {
  if (world.crystals.size) {
    const left = world.crystals.size;
    return `Zostało jeszcze ${left} ${left === 1 ? 'kryształ' : left < 5 ? 'kryształy' : 'kryształów'} do zebrania.`;
  }
  if (world.loaded < world.batteryTotal) return 'Bateria nie dotarła do rakiety — bez niej rakieta nie poleci.';
  const kosmos = world.chars.filter((ch) => ch.who !== 'robo');
  if (world.best && world.steps > world.best && kosmos.some((ch) => kkOnRocket(world, ch))) {
    return `Kosmo doszedł, ale okrężną drogą: ${world.steps} kroków. Najkrótsza droga ma ${world.best} — poszukaj jej!`;
  }
  return kosmos.length > 1 ? 'Program się skończył, a żaden Kosmo nie stoi na rakiecie.' : 'Program się skończył, a Kosmo nie stoi na rakiecie.';
}

// ——— Losowe plansze ———
// Poziom z random dostaje przy każdym wejściu nową planszę (kkMakeLevel): path — losowe skały i najkrótsza droga,
// sort — kryształy z losowymi liczbami (scatter: także w losowych miejscach). Gwiazdki liczy solver (kkSolve),
// a plansza, na której potrzeba więcej niż limit kart, jest losowana od nowa.

// Prosty generator liczb losowych z ziarnem — ta sama liczba daje tę samą planszę.
function kkRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kkWalkable(level, x, y) {
  return '.CKRSE'.includes(kkTile(level, x, y));
}

function kkFindTile(level, tiles) {
  for (let y = 0; y < level.map.length; y++) {
    const x = [...level.map[y]].findIndex((tile) => tiles.includes(tile));
    if (x !== -1) return [x, y];
  }
  return null;
}

// Odległość (w krokach) każdego pola od pola x, y — chodząc po gruncie.
function kkDistances(level, x, y) {
  const dist = new Map([[`${x},${y}`, 0]]);
  const queue = [[x, y]];
  while (queue.length) {
    const [cx, cy] = queue.shift();
    Object.values(KK_DIRS).forEach(([dx, dy]) => {
      const [nx, ny] = [cx + dx, cy + dy];
      if (!kkWalkable(level, nx, ny) || dist.has(`${nx},${ny}`)) return;
      dist.set(`${nx},${ny}`, dist.get(`${cx},${cy}`) + 1);
      queue.push([nx, ny]);
    });
  }
  return dist;
}

// Najmniej kart (Idź z liczbą, W lewo, W prawo, Podnieś), by zebrać kryształy w kolejności order i stanąć na rakiecie.
// dist — odległości od rakiety: wtedy każdy krok musi przybliżać do rakiety (sama najkrótsza droga). Pętle się nie liczą.
function kkSolve(level, order = [], dist = null) {
  const [sx, sy] = kkFindTile(level, 'K');
  const [rx, ry] = kkFindTile(level, 'R');
  const start = [sx, sy, level.dir || 'E', 0];
  const seen = new Set([start.join()]);
  let layer = [start];
  for (let cards = 0; layer.length; cards++) {
    const next = [];
    const push = (state) => {
      if (seen.has(state.join())) return;
      seen.add(state.join());
      next.push(state);
    };
    for (const [x, y, d, k] of layer) {
      if (k === order.length && x === rx && y === ry) return cards;
      push([x, y, KK_TURNS.left[d], k]);
      push([x, y, KK_TURNS.right[d], k]);
      if (order[k] === `${x},${y}`) push([x, y, d, k + 1]);
      const [dx, dy] = KK_DIRS[d];
      for (let n = 1, cx = x, cy = y; n <= 99; n++) {
        const [nx, ny] = [cx + dx, cy + dy];
        if (!kkWalkable(level, nx, ny) || (dist && dist.get(`${nx},${ny}`) !== dist.get(`${cx},${cy}`) - 1)) break;
        [cx, cy] = [nx, ny];
        push([cx, cy, d, k]);
      }
    }
    layer = next;
  }
  return null;
}

function kkMakeLevel(level, seed) {
  if (!level.random) return level;
  const random = kkRandom(seed);
  for (let tries = 0; tries < 300; tries++) {
    const made = level.random === 'path' ? kkMakePath(level, random) : kkMakeSort(level, random);
    if (made) return made;
  }
  // Gdy los nie dał dobrej planszy, zostaje mapa z poziomu.
  return level;
}

// Losowe skały między Kosmo (lewy brzeg) a rakietą (prawy brzeg). Droga musi istnieć i nie być prosta.
function kkMakePath(level, random) {
  const [cols, rows] = level.size;
  const ky = Math.floor(random() * rows);
  const ry = Math.floor(random() * rows);
  const map = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => (
    x === 0 && y === ky ? 'K' : x === cols - 1 && y === ry ? 'R' : random() < level.rocks ? '#' : '.'
  )).join(''));
  const made = { ...level, map };
  const dist = kkDistances(made, cols - 1, ry);
  const best = dist.get(`0,${ky}`);
  if (best === undefined || best < cols - 1 + Math.abs(ky - ry) + 2) return null;
  const min = kkSolve(made, [], dist);
  return min > level.limit ? null : { ...made, best, stars: [min, min + 2] };
}

// Kryształy z losowymi liczbami (różnymi, 1–max) — zbiera się je po kolei: od najmniejszej (albo od największej).
function kkMakeSort(level, random) {
  const map = level.map.map((row) => [...row]);
  if (level.scatter) {
    const free = [];
    map.forEach((row, y) => row.forEach((tile, x) => {
      if (tile === '.') free.push([x, y]);
    }));
    for (let i = 0; i < level.scatter; i++) {
      const [x, y] = free.splice(Math.floor(random() * free.length), 1)[0];
      map[y][x] = 'C';
    }
  }
  const cells = [];
  map.forEach((row, y) => row.forEach((tile, x) => {
    if (tile === 'C') cells.push(`${x},${y}`);
  }));
  const pool = Array.from({ length: level.max || 20 }, (_, i) => i + 1);
  const labels = {};
  cells.forEach((key) => {
    labels[key] = pool.splice(Math.floor(random() * pool.length), 1)[0];
  });
  const made = { ...level, map: map.map((row) => row.join('')), labels };
  const order = [...cells].sort((a, b) => (level.sort === 'desc' ? labels[b] - labels[a] : labels[a] - labels[b]));
  const min = kkSolve(made, order);
  return min === null || min > level.limit ? null : { ...made, stars: [min, min + 2] };
}

// ——— Zapis postępów ———

let kosmoGameSessionSave = null;

function kkReadSave(game) {
  try {
    const stored = readStoredObject(studentKey(`${KK_STORAGE_KEY}:${KK_SAVE_VERSION}:${game.id}`));
    return { stars: stored.stars || {}, programs: stored.programs || {} };
  } catch {
    return kosmoGameSessionSave || { stars: {}, programs: {} };
  }
}

function kkWriteSave(game, save) {
  kosmoGameSessionSave = save;
  try {
    localStorage.setItem(studentKey(`${KK_STORAGE_KEY}:${KK_SAVE_VERSION}:${game.id}`), JSON.stringify(save));
  } catch {
    // Gra działa dalej, gdy pamięć przeglądarki jest niedostępna.
  }
}

function kkUnlocked(save, levelIndex) {
  if (debugFreeNav) return true;
  return levelIndex === 0 || Boolean(save.stars[levelIndex - 1]);
}

function kkCardsWord(count) {
  const tens = count % 100;
  const ones = count % 10;
  if (count === 1) return 'kartę';
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return 'karty';
  return 'kart';
}

function kkStepsWord(count) {
  const tens = count % 100;
  const ones = count % 10;
  if (count === 1) return 'krok';
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return 'kroki';
  return 'kroków';
}

// ——— Widok ———

function kkArt(key, className = '') {
  if (!KK_ART[key]) return `<span class="kk-art kk-emoji ${className}" aria-hidden="true">${KK_EMOJI[key]}</span>`;
  return `<img class="kk-art ${className}" src="${KK_ART[key]}" alt="" data-art="${key}" draggable="false" />`;
}

// Grafika postaci: Kosmo w kolorach to ten sam obrazek, przebarwiony w CSS (klasa kk-is-blue / kk-is-pink).
function kkCharArt(who) {
  return kkArt(who === 'robo' ? 'robo' : 'kosmo');
}

// Ikona bloczka do gniazda karty (przedmiot, postać, zdarzenie).
function kkItemIcon(kind, key) {
  if (kind === 'who' && key !== 'robo') return `<span class="kk-tint kk-is-${key}">${kkArt('kosmo')}</span>`;
  return KK_SLOTS[kind].items[key].icon;
}

// Brakująca grafika: obrazek zamienia się w emoji (albo znika, gdy emoji nie ma).
function kkArtFallback(event) {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.art) return;
  const emoji = KK_EMOJI[img.dataset.art];
  if (!emoji) {
    img.remove();
    return;
  }
  const span = document.createElement('span');
  span.className = `${img.className} kk-emoji`;
  span.textContent = emoji;
  img.replaceWith(span);
}

function kkPickHtml(card, icon, label, extra = '') {
  return `
          <button class="kk-card kk-c-${card} kk-pick" type="button" data-card="${card}"${extra} title="${label}" aria-label="${label}">
            <span class="kk-card-icon" aria-hidden="true">${icon}</span>
            <span class="kk-card-label">${label}</span>
          </button>`;
}

// only — w Sugerowanych: które bloczki do gniazd pokazać, np. { cond: ['crystal'], who: ['kosmo', 'blue'] }.
function kkPaletteGroup(name, cards, open, only = {}) {
  return `
    <details class="kk-group${open ? '' : ' is-suggested'}"${open ? ' open' : ''}>
      <summary>${name}</summary>
      <div class="kk-group-cards">
        ${cards.map((card) => card === 'number' ? `
          <div class="kk-digit-picks">
            ${[...'0123456789'].map((digit) => `
              <button class="kk-card kk-c-number kk-pick" type="button" data-card="number" data-digit="${digit}" aria-label="Cyfra ${digit}">
                <span class="kk-card-icon" aria-hidden="true">${digit}</span>
              </button>`).join('')}
          </div>` : card === 'call' ? `
          <div class="kk-func-picks"></div>` : KK_SLOTS[card]
          ? (only[card] || Object.keys(KK_SLOTS[card].items)).map((key) => kkPickHtml(card, kkItemIcon(card, key), KK_SLOTS[card].items[key].label, ` data-cond="${key}"`)).join('')
          : kkPickHtml(card, KK_CARDS[card].icon, KK_CARDS[card].label)).join('')}
      </div>
    </details>`;
}

// Zwinięta belka pokazuje na kartach same ikony. Wybór zapamiętuje przeglądarka.
function kkPaletteCompact(value) {
  const key = `${KK_STORAGE_KEY}:compact`;
  try {
    if (value === undefined) return localStorage.getItem(key) === '1';
    localStorage.setItem(key, value ? '1' : '0');
  } catch {}
  return Boolean(value);
}

// Zwinięty pasek celów pokazuje tylko ikony i skrót celu. Wybór zapamiętuje przeglądarka.
function kkGoalsCompact(value) {
  const key = `${KK_STORAGE_KEY}:goals-compact`;
  try {
    if (value === undefined) return localStorage.getItem(key) === '1';
    localStorage.setItem(key, value ? '1' : '0');
  } catch {}
  return Boolean(value);
}

function renderKosmoGame(topic, index, game) {
  stopKosmoGame();
  document.title = `${game.title} — Informatyczna Przygoda`;
  document.querySelector('meta[name="theme-color"]').content = topic.accent;
  app.replaceChildren(quizTemplate.content.cloneNode(true));
  applyTopicTheme(topic);
  app.querySelector('#quiz-close').href = `#/sciezka/${topic.slug}`;
  app.querySelector('#quiz-footer').hidden = true;
  app.querySelector('#quiz-kicker').textContent = game.title;
  app.querySelector('#quiz-prompt').textContent = game.prompt;
  app.querySelector('#quiz-hint').textContent =
    'Rakieta Kosmo wylądowała awaryjnie. Ułóż z kart program, a Kosmo wykona go krok po kroku: ' +
    `zbierze kryształy energii i wróci do rakiety. Przejdź ${game.levels.length} poziomów!`;
  setQuizProgress(0);

  const save = kkReadSave(game);
  const firstOpen = game.levels.findIndex((_, i) => !save.stars[i]);
  const startAt = firstOpen === -1 ? 0 : firstOpen;
  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg-intro kk-intro';
  body.addEventListener('error', kkArtFallback, true);
  body.innerHTML = `
    ${kkArt('cover', 'kk-cover')}
    <div class="bg-legend">
      ${[['kosmo', 'Kosmo', 'wykonuje Twoje karty'], ['crystal', 'Kryształ', 'zbierz go kartą Podnieś'], ['rocket', 'Rakieta', 'tu kończy się droga'], ['rock', 'Skała', 'przez nią nie przejdziesz'], ['crater', 'Krater', 'przeskocz go albo zasyp skrzynią'], ['box', 'Skrzynia', 'przesuń ją kartą Przesuń'], ['robo', 'Robo', 'jeździ po śluzie, ale nie skacze'], ['battery', 'Bateria', 'podnieś, podaj albo rzuć — do rakiety'], ['meteor', 'Meteoryt', 'spada nagle — zrób unik']]
        .map(([art, name, text]) => `
          <span class="bg-legend-item"><span class="kk-legend-icon" aria-hidden="true">${kkArt(art)}</span><span><b>${name}</b>${text}</span></span>`).join('')}
    </div>
    <p class="ng-legend-title cg-levels-title">Poziomy</p>
    <div class="cg-level-grid">
      ${game.levels.map((level, i) => {
        const open = kkUnlocked(save, i);
        const stars = save.stars[i] || 0;
        return `
          <button class="cg-level-pick${stars ? ' is-done' : ''}" type="button" data-level="${i}" ${open ? '' : 'disabled'} title="${level.title}">
            <b>${open ? i + 1 : '🔒'}</b>
            <span class="cg-level-stars" aria-label="Gwiazdki: ${stars} z 3">${open ? cgStarText(stars) : ''}</span>
          </button>`;
      }).join('')}
    </div>
    <button class="primary-button fg-start" type="button">${firstOpen > 0 ? 'Graj dalej' : 'Start'} <span aria-hidden="true">▶</span></button>
  `;
  body.querySelector('.fg-start').addEventListener('click', () => startKosmoLevel(topic, index, game, startAt));
  body.querySelectorAll('.cg-level-pick').forEach((button) => {
    button.addEventListener('click', () => startKosmoLevel(topic, index, game, Number(button.dataset.level)));
  });
  body.querySelector('.fg-start').focus();
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// seed — ziarno losowej planszy (poziomy z random). Bez niego za każdym wejściem plansza jest nowa.
function startKosmoLevel(topic, index, game, levelIndex, seed = Math.floor(Math.random() * 2 ** 31)) {
  stopKosmoGame();
  const level = kkMakeLevel(game.levels[levelIndex], seed);
  const save = kkReadSave(game);
  const world = kkCreateWorld(level);
  app.querySelector('#quiz-prompt').textContent = `Poziom ${levelIndex + 1}: ${level.title}`;
  app.querySelector('#quiz-hint').textContent = level.task;
  setQuizProgress(levelIndex / game.levels.length);

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg kk-game';
  body.addEventListener('error', kkArtFallback, true);
  body.innerHTML = `
    <div class="fg-hud">
      <span class="fg-score cg-level-nav">
        <button class="cg-level-step kk-prev" type="button" aria-label="Poprzedni poziom" ${levelIndex > 0 ? '' : 'disabled'}>◀</button>
        Poziom <b>${levelIndex + 1}</b> / ${game.levels.length}
        <button class="cg-level-step kk-next" type="button" aria-label="Następny poziom" ${levelIndex < game.levels.length - 1 && kkUnlocked(save, levelIndex + 1) ? '' : 'disabled'}>▶</button>
      </span>
      <span class="fg-message" aria-live="polite"></span>
      <button class="secondary-button fg-end kk-clear" type="button">Wyczyść karty</button>
    </div>
    <div class="kk-goals${kkGoalsCompact() ? ' is-compact' : ''}" aria-label="Cele poziomu">
      <span class="kk-goals-title">Cel</span>
      <ol class="kk-goals-list"></ol>
      <button class="kk-goals-toggle" type="button"></button>
    </div>
    <div class="kk${kkPaletteCompact() ? ' is-compact' : ''}">
      <aside class="kk-palette" aria-label="Karty do wyboru">
        <button class="kk-palette-toggle" type="button"></button>
        ${kkPaletteGroup('Sugerowane', [
          ...level.cards.flatMap((card) => (kkSlotOf(card) ? [card, kkSlotOf(card)] : [card])),
          ...(level.numbers || level.cards.includes('repeat') ? ['number'] : [])
        ], false, { cond: level.conds, who: world.chars.length > 1 ? world.chars.map((ch) => ch.who) : undefined, event: level.events })}
        ${KK_GROUPS.map(([name, cards]) => kkPaletteGroup(name, cards, true)).join('')}
      </aside>
      <section class="kk-side kk-code" aria-label="Program z kart">
        <div class="kk-program"></div>
        ${level.hint ? `<details class="cg-hint"><summary>Podpowiedź</summary><p>${level.hint}</p></details>` : ''}
      </section>
      <section class="kk-side" aria-label="Plansza">
        ${level.concept ? `
          <div class="cg-concept">
            <p class="cg-concept-name"><span>Nowe pojęcie</span>${level.concept.name}</p>
            <p class="cg-concept-text">${level.concept.text}</p>
          </div>` : ''}
        <div class="kk-board" style="--cols: ${world.cols}; --rows: ${world.rows}; --kk-ground: url('${KK_ART.ground}')">
          <div class="kk-cells">
            ${level.map.map((row, y) => [...row].map((tile, x) => `
              <span class="kk-cell${tile === '#' ? ' is-rock' : tile === '~' ? ' is-slime' : tile === 'o' ? ' is-crater' : ''}" data-key="${x},${y}">${tile === '#' ? kkArt('rock') : tile === '~' ? kkArt('slime') : ''}</span>`).join('')).join('')}
          </div>
          <div class="kk-items"></div>
        </div>
        <div class="cg-controls">
          <button class="primary-button kk-run" type="button"><span aria-hidden="true">▶</span> Start</button>
          <button class="secondary-button kk-reset" type="button"><span aria-hidden="true">↺</span> Reset</button>
          ${level.random ? '<button class="secondary-button kk-reroll" type="button"><span aria-hidden="true">🎲</span> Nowa plansza</button>' : ''}
        </div>
        <p class="cg-status" role="status" aria-live="polite"></p>
      </section>
    </div>
    <div class="fg-overlay is-screen" hidden><div class="fg-overlay-card"></div></div>
  `;

  const state = {
    topic,
    index,
    game,
    levelIndex,
    level,
    body,
    world,
    program: kkLoadProgram(save.programs[levelIndex]),
    cursor: { list: 'main', index: 0 },
    items: body.querySelector('.kk-items'),
    status: body.querySelector('.cg-status'),
    runButton: body.querySelector('.kk-run'),
    running: false,
    dirty: false,
    timer: 0,
    messageTimer: 0,
    won: false,
    nextId: 1
  };
  kosmoGame = state;
  // Poziom z funkcjami od razu pokazuje pustą kolumnę pierwszej funkcji.
  if (level.func && !state.program.funcs.length) state.program.funcs.push({ id: 'f1', name: '', body: [] });
  kkAssignIds(state, state.program.main);
  state.program.funcs.forEach((func) => kkAssignIds(state, func.body));
  state.cursor.index = state.program.main.length;

  kkRenderItems(state);
  kkRenderProgram(state);
  kkFitProgram(state);

  const layout = body.querySelector('.kk');
  const paletteToggle = body.querySelector('.kk-palette-toggle');
  const syncPaletteToggle = () => {
    const compact = layout.classList.contains('is-compact');
    paletteToggle.textContent = compact ? '»' : '« Zwiń';
    paletteToggle.setAttribute('aria-expanded', String(!compact));
    paletteToggle.setAttribute('aria-label', compact ? 'Rozwiń belkę z kartami' : 'Zwiń belkę z kartami');
  };
  syncPaletteToggle();
  paletteToggle.addEventListener('click', () => {
    kkPaletteCompact(layout.classList.toggle('is-compact'));
    syncPaletteToggle();
  });

  const goalsBar = body.querySelector('.kk-goals');
  const goalsToggle = body.querySelector('.kk-goals-toggle');
  const syncGoalsToggle = () => {
    const compact = goalsBar.classList.contains('is-compact');
    goalsToggle.textContent = compact ? '▾ Rozwiń' : '▴ Zwiń';
    goalsToggle.setAttribute('aria-expanded', String(!compact));
    goalsToggle.setAttribute('aria-label', compact ? 'Rozwiń opis celów' : 'Zwiń opis celów');
  };
  syncGoalsToggle();
  goalsToggle.addEventListener('click', () => {
    kkGoalsCompact(goalsBar.classList.toggle('is-compact'));
    syncGoalsToggle();
    kkFitProgram(state);
  });
  body.querySelector('.kk-palette').addEventListener('click', (event) => {
    const button = event.target.closest('.kk-pick');
    if (button) kkAddCard(state, button.dataset.card, button.dataset.digit, button.dataset.fn, button.dataset.cond);
  });
  body.querySelector('.kk-program').addEventListener('click', (event) => kkProgramClick(state, event));
  body.querySelector('.kk-program').addEventListener('input', (event) => {
    if (event.target.matches('.kk-func-name')) kkRenameFunc(state, event.target);
  });
  kkBindDrag(state);
  state.runButton.addEventListener('click', () => (state.running ? kkStopRun(state, 'Zatrzymano program.') : kkStartRun(state)));
  body.querySelector('.kk-reset').addEventListener('click', () => {
    kkStopRun(state);
    kkResetBoard(state);
    kkSetStatus(state, 'Kosmo wrócił na start.', '');
  });
  body.querySelector('.kk-clear').addEventListener('click', () => {
    kkStopRun(state);
    kkResetBoard(state);
    // Funkcje zostają (z nazwami), znikają tylko karty.
    state.program = { main: [], funcs: state.program.funcs.map((func) => ({ ...func, body: [] })) };
    state.cursor = { list: 'main', index: 0 };
    kkRenderProgram(state);
    kkSaveProgram(state);
    kkSetStatus(state, 'Program jest pusty. Ułóż go od nowa.', '');
  });
  body.querySelector('.kk-reroll')?.addEventListener('click', () => kkGoToLevel(state, levelIndex));
  body.querySelector('.kk-prev').addEventListener('click', () => kkGoToLevel(state, levelIndex - 1));
  body.querySelector('.kk-next').addEventListener('click', () => kkGoToLevel(state, levelIndex + 1));
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function kkGoToLevel(state, levelIndex) {
  if (levelIndex < 0 || levelIndex >= state.game.levels.length) return;
  kkStopRun(state);
  startKosmoLevel(state.topic, state.index, state.game, levelIndex);
}

// Kolumna z programem i belka z kartami mieszczą się w oknie przeglądarki — nadmiar przewija się w środku.
function kkFitProgram(state) {
  const fit = (el) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    return Math.round(Math.min(window.innerHeight - 24, Math.max(320, window.innerHeight - top - 16)));
  };
  const column = state.body.querySelector('.kk-code');
  column.style.setProperty('--kk-code-h', `${fit(column)}px`);
  const palette = state.body.querySelector('.kk-palette');
  palette.style.setProperty('--kk-palette-h', `${fit(palette)}px`);
}

function kkOnResize() {
  if (kosmoGame) kkFitProgram(kosmoGame);
}
window.addEventListener('resize', kkOnResize);

function stopKosmoGame() {
  if (!kosmoGame) return;
  clearTimeout(kosmoGame.timer);
  clearTimeout(kosmoGame.messageTimer);
  kosmoGame.flyer?.remove();
  kosmoGame = null;
}

// ——— Program z kart ———

function kkLoadProgram(stored) {
  const clean = (list) => (Array.isArray(list) ? list : [])
    .filter((node) => KK_CARDS[node?.card])
    .map((node) => {
      // Starsze zapisy trzymały liczbę w n.
      const digits = KK_CARDS[node.card].digits && String(node.digits ?? node.n ?? '').replace(/\D/g, '').slice(0, KK_MAX_DIGITS);
      return {
        card: node.card,
        ...(digits ? { digits } : {}),
        ...(KK_CARDS[node.card].body ? { body: clean(node.body) } : {}),
        ...(kkSlotOf(node.card) && KK_SLOTS[kkSlotOf(node.card)].items[node.cond] ? { cond: node.cond } : {}),
        ...(node.card === 'call' ? { fn: /^f\d+$/.test(node.fn) ? node.fn : 'f1' } : {})
      };
    });
  // Starsze zapisy miały jedną funkcję: func i name.
  const funcs = Array.isArray(stored?.funcs)
    ? stored.funcs
      .filter((func, i, all) => /^f[1-9]$/.test(func?.id) && Number(func.id.slice(1)) <= KK_MAX_FUNCS && all.findIndex((f) => f?.id === func.id) === i)
      .map((func) => ({ id: func.id, name: kkCleanFuncName(func.name), body: clean(func.body) }))
    : stored?.func?.length || stored?.name ? [{ id: 'f1', name: kkCleanFuncName(stored.name), body: clean(stored.func) }] : [];
  const program = { main: clean(stored?.main), funcs };
  kkPruneCalls(program);
  return program;
}

// Usuwa karty wołające funkcje, których już nie ma.
function kkPruneCalls(program) {
  const ids = new Set(program.funcs.map((func) => func.id));
  const prune = (list) => {
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].card === 'call' && !ids.has(list[i].fn)) list.splice(i, 1);
      else if (list[i].body) prune(list[i].body);
    }
  };
  prune(program.main);
  program.funcs.forEach((func) => prune(func.body));
}

// Nazwa funkcji, którą dziecko wpisuje nad jej kolumną. Bez znaków HTML, bo trafia do etykiet kart.
const KK_MAX_FUNC_NAME = 14;

function kkCleanFuncName(name) {
  return String(name ?? '').replace(/[<>&"]/g, '').slice(0, KK_MAX_FUNC_NAME);
}

function kkFunc(state, id) {
  return state.program.funcs.find((func) => func.id === id);
}

function kkFuncIcon(id) {
  return KK_FUNC_ICONS[Number(id.slice(1)) - 1] || KK_CARDS.call.icon;
}

// Bez wpisanej nazwy: „Funkcja”, a gdy funkcji jest kilka — „Funkcja 2” (numer z id).
function kkFuncDefaultName(state, id) {
  return state.program.funcs.length > 1 ? `${KK_CARDS.call.label} ${id.slice(1)}` : KK_CARDS.call.label;
}

function kkFuncLabel(state, id) {
  return kkFunc(state, id)?.name.trim() || kkFuncDefaultName(state, id);
}

function kkNewFuncId(state) {
  for (let n = 1; ; n++) if (!kkFunc(state, `f${n}`)) return `f${n}`;
}

// Zmiana nazwy nie przerysowuje programu (pole straciłoby fokus) — podmienia tylko etykiety kart tej funkcji.
function kkRenameFunc(state, input) {
  const func = kkFunc(state, input.dataset.fn);
  if (!func) return;
  const name = kkCleanFuncName(input.value);
  if (name !== input.value) input.value = name;
  func.name = name;
  const label = kkFuncLabel(state, func.id);
  state.body.querySelectorAll(`.kk-program .kk-c-call[data-fn="${func.id}"]`).forEach((el) => {
    el.querySelector('.kk-card-label').textContent = label;
    el.querySelector(':scope > .kk-card-face').setAttribute('aria-label', el.matches('.kk-start')
      ? `${label} — kliknij, by dokładać karty na początku funkcji`
      : `${label} — kliknij, by dokładać karty za nią`);
    el.querySelector(':scope > .kk-remove')?.setAttribute('aria-label', `Usuń kartę ${label}`);
  });
  state.body.querySelector(`.kk-func-delete[data-fn="${func.id}"]`)?.setAttribute('aria-label', `Usuń funkcję ${label}`);
  const tab = state.body.querySelector(`.kk-tab[data-tab="${func.id}"] .kk-tab-label`);
  if (tab) tab.textContent = label;
  kkRenderFuncPicks(state);
  kkSaveProgram(state);
}

function kkDeleteFunc(state, id) {
  const func = kkFunc(state, id);
  if (!func) return;
  if (func.body.length && !confirm(`Usunąć funkcję „${kkFuncLabel(state, id)}” razem z jej kartami?`)) return;
  state.program.funcs = state.program.funcs.filter((f) => f !== func);
  kkPruneCalls(state.program);
  if (!kkFindList(state, state.cursor.list)) state.cursor = { list: 'main', index: state.program.main.length };
  kkAfterEdit(state);
}

function kkSaveProgram(state) {
  const strip = (list) => list.map(({ card, digits, cond, body, fn }) => ({ card, ...(digits ? { digits } : {}), ...(cond ? { cond } : {}), ...(body ? { body: strip(body) } : {}), ...(fn ? { fn } : {}) }));
  const save = kkReadSave(state.game);
  save.programs[state.levelIndex] = {
    main: strip(state.program.main),
    funcs: state.program.funcs.map(({ id, name, body }) => ({ id, ...(name ? { name } : {}), body: strip(body) }))
  };
  kkWriteSave(state.game, save);
}

function kkAssignIds(state, list) {
  list.forEach((node) => {
    node.id = `k${state.nextId++}`;
    if (node.body) kkAssignIds(state, node.body);
  });
}

// Szuka listy kart po id: main, id funkcji albo id karty Powtórz (wtedy jej środek).
// inFunc — id funkcji, w której leży lista (null w programie).
function kkFindList(state, listId) {
  if (listId === 'main') return { list: state.program.main, inFunc: null };
  const func = kkFunc(state, listId);
  if (func) return { list: func.body, inFunc: func.id };
  const search = (list, inFunc) => {
    for (const node of list) {
      if (!node.body) continue;
      if (node.id === listId) return { list: node.body, inFunc };
      const found = search(node.body, inFunc);
      if (found) return found;
    }
    return null;
  };
  return search(state.program.main, null) || state.program.funcs.reduce((found, func) => found || search(func.body, func.id), null);
}

function kkAddCard(state, card, digit, fn, cond) {
  const listId = kkFindList(state, state.cursor.list) ? state.cursor.list : 'main';
  if (card === 'number') kkAddDigit(state, listId, state.cursor.index, digit);
  else if (KK_SLOTS[card]) kkAddCond(state, listId, state.cursor.index, card, cond);
  else kkInsertCard(state, card, listId, state.cursor.index, fn);
}

// fn — przy karcie Funkcja: id wołanej funkcji albo new (nowa funkcja).
function kkInsertCard(state, card, listId, index, fn) {
  if (state.running) return;
  const target = kkFindList(state, listId);
  if (card === 'call' && !kkCanCall(state.program, target.inFunc, fn, state.level.recursion)) {
    kkShowMessage(state, fn === target.inFunc ? 'Funkcja nie może wołać samej siebie!' : 'Te funkcje wołałyby się w kółko!', 'bad');
    return;
  }
  if (card === 'call' && fn === 'new' && state.program.funcs.length >= KK_MAX_FUNCS) {
    kkShowMessage(state, `Najwyżej ${KK_MAX_FUNCS} funkcje!`, 'bad');
    return;
  }
  if (kkProgramCount(state.program) >= KK_MAX_CARDS) {
    kkShowMessage(state, `Najwyżej ${KK_MAX_CARDS} kart!`, 'bad');
    return;
  }
  const node = { card, id: `k${state.nextId++}` };
  if (KK_CARDS[card].body) node.body = [];
  if (card === 'call') {
    node.fn = fn === 'new' ? kkNewFuncId(state) : fn;
    if (fn === 'new') state.program.funcs.push({ id: node.fn, name: '', body: [] });
  }
  const at = Math.min(index, target.list.length);
  target.list.splice(at, 0, node);
  // Po położeniu Powtórz albo Jeśli kolejne karty trafiają do jej środka, a po nowej funkcji — do jej kolumny.
  state.cursor = node.body ? { list: node.id, index: 0 }
    : fn === 'new' ? { list: node.fn, index: 0 }
    : { list: listId, index: at + 1 };
  kkAfterEdit(state);
}

function kkFindNode(state, id) {
  const search = (list) => {
    for (const node of list) {
      if (node.id === id) return node;
      const found = node.body && search(node.body);
      if (found) return found;
    }
    return null;
  };
  return search(state.program.main) || state.program.funcs.reduce((found, func) => found || search(func.body), null);
}

// Kliknięta cyfra dokleja się na koniec liczby karty tuż przed kursorem (albo Powtórz, w której środku stoi kursor).
function kkAddDigit(state, listId, index, digit) {
  if (state.running) return;
  const list = kkFindList(state, listId)?.list || [];
  const host = index > 0 ? list[index - 1] : kkFindNode(state, listId);
  if (!host || !KK_CARDS[host.card].digits) {
    kkShowMessage(state, 'Przeciągnij cyfrę na kartę Idź albo Powtórz.', 'bad');
    return;
  }
  kkInsertDigit(state, host, (host.digits || '').length, digit);
}

// Kliknięty bloczek (przedmiot, postać, zdarzenie) trafia do gniazda karty tuż przed kursorem
// (albo tej, w której środku stoi kursor). Bloczek, który już tam leżał, zostaje podmieniony.
function kkAddCond(state, listId, index, kind, cond) {
  if (state.running) return;
  const list = kkFindList(state, listId)?.list || [];
  const host = index > 0 ? list[index - 1] : kkFindNode(state, listId);
  if (host?.card !== KK_SLOTS[kind].host) {
    kkShowMessage(state, KK_SLOTS[kind].hint, 'bad');
    return;
  }
  host.cond = cond;
  kkAfterEdit(state);
}

function kkInsertDigit(state, host, index, digit) {
  const digits = host.digits || '';
  if (digits.length >= KK_MAX_DIGITS) {
    kkShowMessage(state, `Na karcie mieszczą się najwyżej ${KK_MAX_DIGITS} cyfry.`, 'bad');
    return false;
  }
  host.digits = digits.slice(0, index) + digit + digits.slice(index);
  kkAfterEdit(state);
  return true;
}

// ——— Przeciąganie kart ———
// Na wskaźniku (mysz, palec, rysik): karta z belki trafia do programu, karta z programu zmienia miejsce,
// a karta upuszczona poza programem znika. Krótkie kliknięcie działa jak dotąd.

const KK_DRAG_START = 6;
const KK_SCROLL_EDGE = 40;

function kkBindDrag(state) {
  state.body.addEventListener('pointerdown', (event) => kkDragDown(state, event));
  // Po upuszczeniu przeglądarka wysyła jeszcze click — nie może on dołożyć karty ani przesunąć kursora.
  state.body.addEventListener('click', (event) => {
    if (!state.dragEnded) return;
    state.dragEnded = false;
    event.stopPropagation();
    event.preventDefault();
  }, true);
}

function kkDragDown(state, event) {
  if (state.running || event.button !== 0) return;
  const pick = event.target.closest('.kk-pick');
  const face = event.target.closest('.kk-card-face');
  const digit = event.target.closest('.kk-digit[data-i]');
  const item = event.target.closest('.kk-cond[data-cond]');
  if (pick?.disabled || face?.closest('.kk-start') || (!pick && !face && !digit && !item)) return;
  const source = pick ? { card: pick.dataset.card, digit: pick.dataset.digit, fn: pick.dataset.fn, cond: pick.dataset.cond, el: pick }
    : digit ? { card: 'number', digit: digit.textContent, el: digit, item: digit, from: digit.closest('.kk-card').dataset.id, fromIndex: Number(digit.dataset.i) }
    : item ? { card: item.dataset.kind, cond: item.dataset.cond, el: item, item, from: item.closest('.kk-card').dataset.id }
    : { el: face.closest('.kk-card') };
  if (face) {
    source.id = source.el.dataset.id;
    source.list = source.el.dataset.list;
    source.item = source.el.parentElement.matches('.kk-loop') ? source.el.parentElement : source.el;
  }
  const start = { x: event.clientX, y: event.clientY };
  let drag = null;
  const move = (e) => {
    if (!drag) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < KK_DRAG_START) return;
      drag = kkDragBegin(state, source);
    }
    kkDragMove(state, drag, e);
  };
  const up = (e) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (!drag) return;
    state.dragEnded = true;
    setTimeout(() => { state.dragEnded = false; }, 0);
    kkDragEnd(state, drag, e.type === 'pointerup');
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

function kkDragBegin(state, source) {
  const ghost = source.el.cloneNode(true);
  ghost.classList.add('kk-ghost');
  ghost.classList.remove('is-running');
  ghost.removeAttribute('data-id');
  document.body.append(ghost);
  source.item?.classList.add('is-dragging');
  state.body.classList.add('is-dragging');
  const marker = source.card === 'number' || KK_SLOTS[source.card] ?document.createElement('span') : kkDragPreview(state, source);
  if (!marker.classList.contains('kk-preview')) marker.className = 'kk-drop';
  return { source, ghost, marker, target: null, outside: true };
}

// Podgląd karty w miejscu, gdzie wyląduje — wygląda jak już wstawiona, tylko półprzezroczysta.
function kkDragPreview(state, source) {
  let preview;
  if (source.id) {
    preview = source.item.cloneNode(true);
    preview.classList.remove('is-dragging');
  } else {
    const node = { card: source.card, id: '' };
    if (source.card === 'call') node.fn = source.fn === 'new' ? kkNewFuncId(state) : source.fn;
    const html = KK_CARDS[source.card].body
      ? `<span class="kk-loop${kkLoopClass(source.card)}">${kkCardHtml(state, node, '')}${kkListHtml(state, [], '', 'włóż tu karty')}</span>`
      : kkCardHtml(state, node, '');
    const box = document.createElement('div');
    box.innerHTML = html.trim();
    preview = box.firstElementChild;
  }
  // Bez identyfikatorów podgląd nie myli się z prawdziwymi kartami programu.
  [preview, ...preview.querySelectorAll('[data-id], [data-loop], [data-list]')].forEach((el) => {
    el.removeAttribute('data-id');
    el.removeAttribute('data-loop');
    el.removeAttribute('data-list');
  });
  preview.classList.add('kk-preview');
  preview.setAttribute('aria-hidden', 'true');
  return preview;
}

function kkDragMove(state, drag, event) {
  const { clientX: x, clientY: y } = event;
  drag.ghost.style.left = `${x}px`;
  drag.ghost.style.top = `${y}px`;
  const under = document.elementFromPoint(x, y);
  const program = state.body.querySelector('.kk-program');
  drag.outside = !program.contains(under);
  kkDragScroll(under?.closest('.kk-scroll'), x, y);
  if (program.contains(under)) kkDragScroll(program, x, y);
  // Karta nad zakładką otwiera ją — wtedy można ją upuścić w tej funkcji albo w programie.
  const tab = under?.closest('.kk-tab');
  if (tab && program.contains(tab)) kkShowTab(state, tab.dataset.tab);
  if (drag.source.card === 'number') {
    drag.x = x;
    kkDragNumber(state, drag, under, program);
    return;
  }
  if (KK_SLOTS[drag.source.card]) {
    kkDragCond(state, drag, under, program);
    return;
  }

  const listEl = under?.closest('.kk-list') || under?.closest('.kk-strip')?.querySelector('.kk-list');
  const target = listEl && program.contains(listEl) && kkFindList(state, listEl.dataset.list);
  const calls = drag.source.id
    ? kkCallsIn(kkFindList(state, drag.source.list).list.filter((node) => node.id === drag.source.id))
    : new Set(drag.source.card === 'call' ? [drag.source.fn] : []);
  // Nie wolno włożyć Powtórz do niej samej ani zrobić kółka wywołań funkcji.
  if (!target || drag.source.item?.contains(listEl) || [...calls].some((fn) => !kkCanCall(state.program, target.inFunc, fn, state.level.recursion))) {
    drag.target = null;
    drag.marker.remove();
    drag.source.item?.classList.remove('is-moved');
    drag.ghost.style.visibility = '';
    return;
  }
  // Przenoszona karta znika ze starego miejsca, a karta przy wskaźniku — póki jej podgląd stoi w programie.
  drag.source.item?.classList.add('is-moved');
  drag.ghost.style.visibility = 'hidden';
  const items = [...listEl.children].filter((child) => child.matches('.kk-card:not(.kk-start), .kk-loop') && !child.matches('.kk-preview, .is-moved'));
  const column = listEl.classList.contains('is-col');
  let index = items.findIndex((item) => {
    const rect = item.getBoundingClientRect();
    return column ? y < rect.top + rect.height / 2 : x < rect.left + rect.width / 2;
  });
  const before = index === -1 ? null : items[index];
  // Indeks liczy też ukrytą przenoszoną kartę — tak jak lista w programie.
  const all = [...listEl.children].filter((child) => child.matches('.kk-card:not(.kk-start), .kk-loop') && !child.matches('.kk-preview'));
  index = before ? all.indexOf(before) : all.length;
  if (drag.marker.nextElementSibling !== before || drag.marker.parentElement !== listEl) {
    listEl.insertBefore(drag.marker, before || listEl.querySelector(':scope > .kk-empty'));
  }
  drag.target = { listId: listEl.dataset.list, index };
}

// Przy krawędzi okna programu przewija je, żeby dało się upuścić kartę daleko w programie.
function kkDragScroll(box, x, y) {
  if (!box) return;
  const rect = box.getBoundingClientRect();
  const speed = (distance) => (distance < KK_SCROLL_EDGE ? Math.round((KK_SCROLL_EDGE - distance) / 2) : 0);
  box.scrollTop += speed(rect.bottom - y) - speed(y - rect.top);
  box.scrollLeft += speed(rect.right - x) - speed(x - rect.left);
}

// Cyfra nie leży w liście kart — wchodzi między cyfry karty Idź albo Powtórz pod wskaźnikiem.
function kkDragNumber(state, drag, under, program) {
  const cardEl = under?.closest('.kk-card[data-id]');
  const host = cardEl && program.contains(cardEl) && kkFindNode(state, cardEl.dataset.id);
  const target = host && KK_CARDS[host.card].digits ? cardEl : null;
  if (drag.hostEl !== target) {
    drag.hostEl?.classList.remove('is-number-target');
    target?.classList.add('is-number-target');
    drag.hostEl = target;
  }
  if (!target) {
    drag.target = null;
    drag.marker.remove();
    return;
  }
  const slot = target.querySelector('.kk-digits');
  const items = [...slot.querySelectorAll('.kk-digit[data-i]')];
  let index = items.findIndex((item) => {
    const rect = item.getBoundingClientRect();
    return drag.x < rect.left + rect.width / 2;
  });
  if (index === -1) index = items.length;
  slot.insertBefore(drag.marker, items[index] || null);
  drag.target = { id: target.dataset.id, index };
}

// Bloczek do gniazda nie leży w liście kart — wchodzi do gniazda karty pod wskaźnikiem (Jeśli, Przełącz albo Gdy).
function kkDragCond(state, drag, under, program) {
  const cardEl = under?.closest('.kk-card[data-id]');
  const host = cardEl && program.contains(cardEl) && kkFindNode(state, cardEl.dataset.id);
  const target = host && host.card === KK_SLOTS[drag.source.card].host ? cardEl : null;
  if (drag.hostEl !== target) {
    drag.hostEl?.classList.remove('is-number-target');
    target?.classList.add('is-number-target');
    drag.hostEl = target;
  }
  drag.target = target ? { id: target.dataset.id } : null;
}

// Bloczek upuszczony na kartę podmienia jej bloczek, a wyciągnięty poza program — znika.
function kkDropCond(state, drag) {
  const { source, target } = drag;
  const from = source.from && kkFindNode(state, source.from);
  if (!target && (!from || !drag.outside)) return;
  const host = target && kkFindNode(state, target.id);
  if (from && from !== host) delete from.cond;
  if (host) host.cond = source.cond;
  kkAfterEdit(state);
}

function kkDropNumber(state, drag) {
  const { source, target } = drag;
  const from = source.from && kkFindNode(state, source.from);
  if (!target) {
    if (!from || !drag.outside) return;
    from.digits = from.digits.slice(0, source.fromIndex) + from.digits.slice(source.fromIndex + 1);
    if (!from.digits) delete from.digits;
    kkAfterEdit(state);
    return;
  }
  const host = kkFindNode(state, target.id);
  let { index } = target;
  if (from) {
    if (from === host && source.fromIndex < index) index -= 1;
    from.digits = from.digits.slice(0, source.fromIndex) + from.digits.slice(source.fromIndex + 1);
    if (!from.digits) delete from.digits;
  }
  if (!kkInsertDigit(state, host, index, source.digit) && from) {
    // Na pełnej karcie cyfra wraca tam, skąd przyszła.
    from.digits = (from.digits || '').slice(0, source.fromIndex) + source.digit + (from.digits || '').slice(source.fromIndex);
  }
}

function kkDragEnd(state, drag, dropped) {
  const { source, target } = drag;
  drag.ghost.remove();
  drag.marker.remove();
  drag.hostEl?.classList.remove('is-number-target');
  source.item?.classList.remove('is-dragging', 'is-moved');
  state.body.classList.remove('is-dragging');
  if (kosmoGame !== state) return;
  // Przy przeciąganiu otwarto inną zakładkę: kursor przechodzi na jej koniec.
  if (state.tab !== kkCursorTab(state) && kkFindList(state, state.tab)) {
    state.cursor = { list: state.tab, index: kkFindList(state, state.tab).list.length };
    kkRenderProgram(state);
  }
  if (!dropped) return;

  if (source.card === 'number') {
    kkDropNumber(state, drag);
    return;
  }
  if (KK_SLOTS[source.card]) {
    kkDropCond(state, drag);
    return;
  }
  if (!source.id) {
    if (target) kkInsertCard(state, source.card, target.listId, target.index, source.fn);
    return;
  }
  const from = kkFindList(state, source.list).list;
  const at = from.findIndex((node) => node.id === source.id);
  if (!target) {
    if (!drag.outside) return;
    from.splice(at, 1);
    if (!kkFindList(state, state.cursor.list)) state.cursor = { list: 'main', index: state.program.main.length };
    else if (state.cursor.list === source.list && state.cursor.index > at) state.cursor.index -= 1;
    kkAfterEdit(state);
    return;
  }
  const [node] = from.splice(at, 1);
  const to = kkFindList(state, target.listId).list;
  const index = to === from && at < target.index ? target.index - 1 : target.index;
  to.splice(index, 0, node);
  state.cursor = { list: target.listId, index: index + 1 };
  kkAfterEdit(state);
}

function kkProgramClick(state, event) {
  // Zakładki działają także w czasie wykonywania programu — wtedy tylko podglądają.
  const tab = event.target.closest('.kk-tab');
  if (tab) {
    if (state.running) kkShowTab(state, tab.dataset.tab);
    else kkOpenTab(state, tab.dataset.tab);
    return;
  }
  // Pole z nazwą funkcji: przerysowanie programu zabrałoby mu fokus.
  if (state.running || event.target.closest('.kk-func-name')) return;
  const remove = event.target.closest('.kk-func-delete');
  if (remove) {
    kkDeleteFunc(state, remove.dataset.fn);
    return;
  }
  // Kliknięty Start (albo głowa funkcji): nowe karty trafią na początek programu (funkcji).
  const head = event.target.closest('.kk-start');
  if (head) {
    state.cursor = { list: head.dataset.list, index: 0 };
    kkRenderProgram(state);
    return;
  }
  const cardEl = event.target.closest('[data-id]');
  const listEl = event.target.closest('.kk-list') || event.target.closest('.kk-strip')?.querySelector('.kk-list');
  if (!cardEl || !listEl?.contains(cardEl)) {
    // Kliknięcie w puste miejsce paska: nowe karty trafią na jego koniec.
    if (listEl) {
      state.cursor = { list: listEl.dataset.list, index: kkFindList(state, listEl.dataset.list).list.length };
      kkRenderProgram(state);
    }
    return;
  }
  const { list } = kkFindList(state, cardEl.dataset.list);
  const at = list.findIndex((node) => node.id === cardEl.dataset.id);
  const node = list[at];

  if (event.target.closest('.kk-remove')) {
    list.splice(at, 1);
    if (!kkFindList(state, state.cursor.list)) state.cursor = { list: cardEl.dataset.list, index: at };
    else if (state.cursor.list === cardEl.dataset.list && state.cursor.index > at) state.cursor.index -= 1;
    kkAfterEdit(state);
    return;
  }
  state.cursor = { list: cardEl.dataset.list, index: at + 1 };
  kkRenderProgram(state);
}

function kkAfterEdit(state) {
  if (state.dirty) kkResetBoard(state);
  kkRenderProgram(state);
  kkSaveProgram(state);
}

// Ramka wokół karty ze środkiem: Powtórz (bez klasy), Jeśli, Gdy.
function kkLoopClass(card) {
  return card === 'if' ? ' is-if' : card === 'on' ? ' is-on' : '';
}

function kkCardHtml(state, node, listId) {
  const def = node.card === 'call'
    ? { ...KK_CARDS.call, icon: kkFuncIcon(node.fn), label: kkFuncLabel(state, node.fn) }
    : KK_CARDS[node.card];
  const kind = kkSlotOf(node.card);
  const item = kind && KK_SLOTS[kind].items[node.cond];
  // Gniazdo na cyfry: bez cyfr Idź pokazuje w nim półprzezroczystą 1, Powtórz — puste miejsce.
  // Gniazdo Jeśli / Gdy / Przełącz: włożony bloczek albo puste miejsce (Przełącz bez postaci przełącza na następną).
  const slot = kind ? `
      <span class="kk-digits">${item
        ? `<button class="kk-digit kk-cond kk-slot-${kind}" type="button" data-kind="${kind}" data-cond="${node.cond}" title="${item.label}" aria-label="${item.label} — przeciągnij, by przenieść albo usunąć">${kkItemIcon(kind, node.cond)}</button>`
        : `<span class="kk-digit kk-cond kk-slot-${kind} is-empty" aria-hidden="true">${kind === 'who' ? '⇄' : '?'}</span>`}</span>`
    : !def.digits ? '' : `
      <span class="kk-digits">${node.digits
        ? [...node.digits].map((digit, i) => `<button class="kk-digit" type="button" data-i="${i}" aria-label="Cyfra ${digit} — przeciągnij, by przenieść albo usunąć">${digit}</button>`).join('')
        : `<span class="kk-digit ${node.card === 'step' ? 'is-ghost' : 'is-empty'}" aria-hidden="true">${node.card === 'step' ? '1' : '?'}</span>`}</span>`;
  return `
    <span class="kk-card kk-c-${node.card}" data-id="${node.id}" data-list="${listId}"${node.fn ? ` data-fn="${node.fn}"` : ''}>
      <button class="kk-card-face" type="button" aria-label="${def.label}${node.digits ? ` ${Number(node.digits)}` : ''}${item ? ` ${item.label.toLowerCase()}` : ''} — kliknij, by dokładać karty za nią">
        <span class="kk-card-icon" aria-hidden="true">${def.icon}</span>
        <span class="kk-card-label" aria-hidden="true">${def.label}</span>
      </button>
      ${slot}
      <button class="kk-remove" type="button" aria-label="Usuń kartę ${def.label}">×</button>
    </span>`;
}

// Karty idą z góry na dół — tak samo w programie, w funkcjach i w środku Powtórz i Jeśli.
function kkListHtml(state, list, listId, empty) {
  const active = state.cursor.list === listId;
  const caret = '<span class="kk-caret" aria-hidden="true"></span>';
  const parts = list.map((node) => node.body
    ? `<span class="kk-loop${kkLoopClass(node.card)}" data-loop="${node.id}">${kkCardHtml(state, node, listId)}${kkListHtml(state, node.body, node.id, 'włóż tu karty')}</span>`
    : kkCardHtml(state, node, listId));
  if (active) parts.splice(Math.min(state.cursor.index, parts.length), 0, caret);
  // Stały bloczek na górze programu (Start) i funkcji (jej nazwa) — nie da się go usunąć ani przenieść.
  const head = listId === 'main'
    ? { css: 'kk-c-start', icon: '🚩', label: 'Start', aria: 'Start — kliknij, by dokładać karty na początku programu' }
    : kkFunc(state, listId) && {
      css: 'kk-c-call',
      fn: listId,
      icon: kkFuncIcon(listId),
      label: kkFuncLabel(state, listId),
      aria: `${kkFuncLabel(state, listId)} — kliknij, by dokładać karty na początku funkcji`
    };
  if (head) {
    parts.unshift(`
      <span class="kk-card ${head.css} kk-start" data-list="${listId}"${head.fn ? ` data-fn="${head.fn}"` : ''}>
        <button class="kk-card-face" type="button" aria-label="${head.aria}">
          <span class="kk-card-icon" aria-hidden="true">${head.icon}</span>
          <span class="kk-card-label" aria-hidden="true">${head.label}</span>
        </button>
      </span>`);
  }
  return `<span class="kk-list is-col${active ? ' is-active' : ''}" data-list="${listId}">${parts.join('')}${list.length ? '' : `<span class="kk-empty">${empty}</span>`}</span>`;
}

function kkRenderProgram(state) {
  const { level, program } = state;
  const count = kkProgramCount(program);
  const box = state.body.querySelector('.kk-program');
  // Nowy HTML zeruje przewinięcie okien programu — zapamiętujemy je i przywracamy.
  const scroll = [...box.querySelectorAll('.kk-scroll')].map((el) => [el.scrollLeft, el.scrollTop]);
  // Program i funkcje to zakładki u góry (jak pliki) — widać jedną, tę z kursorem.
  state.tab = kkCursorTab(state);
  const tab = (id, icon, label, extra = '') => `
    <button class="kk-tab${extra}${id === state.tab ? ' is-active' : ''}" type="button" role="tab" data-tab="${id}" aria-selected="${id === state.tab}">
      <span class="kk-tab-icon" aria-hidden="true">${icon}</span><span class="kk-tab-label">${label}</span>
    </button>`;
  box.innerHTML = `
    <div class="kk-tabs" role="tablist" aria-label="Program i funkcje">
      ${tab('main', '🚩', 'Program')}
      ${program.funcs.map((func) => tab(func.id, kkFuncIcon(func.id), kkFuncLabel(state, func.id), ' is-func')).join('')}
    </div>
    <div class="kk-strip${state.tab === 'main' ? '' : ' is-hidden'}" data-tab="main" role="tabpanel">
      <p class="kk-strip-title"><span>Program</span><span class="kk-strip-count">${count} ${kkCardsWord(count)} · na ★★★ najwyżej ${level.stars[0]}</span></p>
      <div class="kk-scroll">${kkListHtml(state, program.main, 'main', 'Klikaj albo przeciągaj tu karty z belki po lewej')}</div>
    </div>
    ${program.funcs.map((func) => {
      const label = kkFuncLabel(state, func.id);
      const icon = kkFuncIcon(func.id);
      return `
        <div class="kk-strip is-func${state.tab === func.id ? '' : ' is-hidden'}" data-tab="${func.id}" role="tabpanel">
          <p class="kk-strip-title">
            <label class="kk-func-title">${icon} <input class="kk-func-name" type="text" data-fn="${func.id}" maxlength="${KK_MAX_FUNC_NAME}" placeholder="${kkFuncDefaultName(state, func.id)}" value="${func.name}" aria-label="Nazwa funkcji — wpisz własną" spellcheck="false" autocomplete="off"></label>
            <button class="kk-func-delete" type="button" data-fn="${func.id}" title="Usuń funkcję" aria-label="Usuń funkcję ${label}">×</button>
          </p>
          <div class="kk-scroll">${kkListHtml(state, func.body, func.id, `Karty funkcji — wykonają się przy każdej karcie ${icon}`)}</div>
        </div>`;
    }).join('')}
  `;
  box.querySelectorAll('.kk-scroll').forEach((el, i) => {
    if (scroll[i]) [el.scrollLeft, el.scrollTop] = scroll[i];
  });
  kkRenderFuncPicks(state);
  kkRenderGoals(state);
}

// Zakładka z kursorem: program albo funkcja, w której leży lista kursora (także w środku Powtórz).
function kkCursorTab(state) {
  return kkFindList(state, state.cursor.list)?.inFunc || 'main';
}

// Pokazuje zakładkę bez przerysowania — przy przeciąganiu karty i przy wykonywaniu programu.
function kkShowTab(state, id) {
  if (state.tab === id) return;
  state.tab = id;
  state.body.querySelectorAll('.kk-program .kk-tab').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.tab === id);
    el.setAttribute('aria-selected', String(el.dataset.tab === id));
  });
  state.body.querySelectorAll('.kk-program .kk-strip').forEach((el) => el.classList.toggle('is-hidden', el.dataset.tab !== id));
}

// Kliknięta zakładka: nowe karty trafią na koniec jej programu albo funkcji.
function kkOpenTab(state, id) {
  const found = kkFindList(state, id);
  if (!found) return;
  state.cursor = { list: id, index: found.list.length };
  kkRenderProgram(state);
}

// Na belce: karta każdej funkcji i karta „Nowa”, która zakłada kolejną funkcję.
// Karta funkcji jest wyłączona, gdy w miejscu kursora zrobiłaby kółko wywołań.
function kkRenderFuncPicks(state) {
  const inFunc = kkFindList(state, state.cursor.list)?.inFunc;
  const { funcs } = state.program;
  const pick = (fn, icon, label, disabled, extra = '') => `
    <button class="kk-card kk-c-call kk-pick${extra}" type="button" data-card="call" data-fn="${fn}" title="${fn === 'new' ? 'Nowa funkcja' : label}" aria-label="${fn === 'new' ? 'Nowa funkcja' : label}"${disabled ? ' disabled' : ''}>
      <span class="kk-card-icon" aria-hidden="true">${icon}</span>
      <span class="kk-card-label">${label}</span>
    </button>`;
  const html = funcs.map((func) => pick(func.id, kkFuncIcon(func.id), kkFuncLabel(state, func.id), !kkCanCall(state.program, inFunc, func.id, state.level.recursion))).join('') +
    (funcs.length < KK_MAX_FUNCS ? pick('new', '＋', funcs.length ? 'Nowa' : KK_CARDS.call.label, false, ' kk-new-func') : '');
  state.body.querySelectorAll('.kk-func-picks').forEach((el) => { el.innerHTML = html; });
}

// ——— Plansza ———

function kkPlace(world, x, y) {
  return `left: ${(x * 100) / world.cols}%; top: ${(y * 100) / world.rows}%`;
}

function kkRenderItems(state) {
  const { world } = state;
  const [rx, ry] = [world.rocket.x, world.rocket.y];
  state.items.innerHTML = `
    <span class="kk-item kk-rocket" style="${kkPlace(world, rx, ry)}">${kkArt('rocket')}</span>
    ${[...world.crystals].map((key) => {
      const [x, y] = key.split(',').map(Number);
      const number = world.numbers.get(key);
      return `<span class="kk-item kk-crystal" data-key="${key}" style="${kkPlace(world, x, y)}">${kkArt('crystal')}${number ? `<b class="kk-num">${number}</b>` : ''}</span>`;
    }).join('')}
    ${[...world.batteries].map((key) => {
      const [x, y] = key.split(',').map(Number);
      return `<span class="kk-item kk-battery" data-key="${key}" style="${kkPlace(world, x, y)}">${kkArt('battery')}</span>`;
    }).join('')}
    ${[...world.boxes].map((key) => {
      const [x, y] = key.split(',').map(Number);
      return `<span class="kk-item kk-box" data-key="${key}" style="${kkPlace(world, x, y)}">${kkArt('box')}</span>`;
    }).join('')}
    ${world.chars.map((ch, i) => `
      <span class="kk-item kk-kosmo kk-is-${ch.who}" data-char="${i}" style="${kkPlace(world, ch.x, ch.y)}">
        <span class="kk-ground" aria-hidden="true"><span class="kk-heading" style="transform: rotate(${ch.angle}deg)"><span class="kk-nose"></span></span></span>
        <span class="kk-up" aria-hidden="true"></span>
        <span class="kk-kosmo-body"><span class="kk-kosmo-walk"><span class="kk-kosmo-face">${kkCharArt(ch.who)}${ch.who !== 'robo' ? kkArt('kosmoFallen', 'kk-fallen') : ''}</span></span></span>
        <span class="kk-hold" aria-hidden="true">${kkArt('battery')}</span>
      </span>`).join('')}
  `;
  // Zasypane kratery wracają do początku razem z planszą.
  state.body.querySelectorAll('.kk-cell.is-crater').forEach((cell) => cell.classList.toggle('is-filled', world.filled.has(cell.dataset.key)));
  state.charEls = [...state.items.querySelectorAll('.kk-kosmo')];
  state.kosmo = state.charEls[0];
  world.chars.forEach((ch, i) => {
    state.charEls[i].classList.toggle('is-left', ch.face === 'W');
    state.charEls[i].classList.toggle('is-up', ch.dir === 'N');
  });
  kkMarkActive(state);
  kkRenderGoals(state);
}

// Bateria w rękach postaci: mały obrazek przy jej ramieniu.
function kkSyncHolding(state) {
  state.world.chars.forEach((ch, i) => state.charEls[i].classList.toggle('is-holding', Boolean(ch.holding)));
}

// Pasek celów nad grą: kryształy (gdy są na planszy), rakieta i limit kart na 3 gwiazdki.
// Odhacza się na bieżąco podczas wykonywania programu.
function kkRenderGoals(state) {
  const list = state.body.querySelector('.kk-goals-list');
  if (!list) return;
  const { world, level } = state;
  const taken = world.total - world.crystals.size;
  const count = kkProgramCount(state.program);
  const goals = [];
  if (world.total) {
    goals.push({
      art: 'crystal',
      done: !world.crystals.size,
      text: world.numbers.size
        ? `Podnoś kryształy po kolei: od <b>${level.sort === 'desc' ? 'największej' : 'najmniejszej'}</b> liczby do <b>${level.sort === 'desc' ? 'najmniejszej' : 'największej'}</b>`
        : `Zbierz ${world.total === 1 ? 'kryształ' : `wszystkie kryształy`} kartą <b>Podnieś</b>`,
      short: world.numbers.size ? (level.sort === 'desc' ? '9 → 1' : '1 → 9') : 'Podnieś',
      badge: `${taken} / ${world.total}`
    });
  }
  if (world.batteryTotal) {
    goals.push({
      art: 'battery',
      done: world.loaded >= world.batteryTotal,
      text: 'Dostarcz baterię do rakiety — wnieś ją albo wrzuć',
      short: 'Bateria',
      badge: `${world.loaded} / ${world.batteryTotal}`
    });
  }
  const kosmos = world.chars.filter((ch) => ch.who !== 'robo').length;
  goals.push({
    art: 'rocket',
    done: state.won,
    text: kosmos > 1 ? 'Jeden z Kosmo musi stanąć na rakiecie' : world.chars.length > 1 ? 'Kosmo musi dojść do rakiety' : world.total ? 'Potem wróć do rakiety' : 'Dojdź do rakiety',
    short: 'Rakieta'
  });
  if (world.best) {
    goals.push({
      icon: '📏',
      done: state.won,
      text: `Idź najkrótszą drogą: <b>${world.best}</b> ${kkStepsWord(world.best)}`,
      short: `${world.best} ${kkStepsWord(world.best)}`,
      badge: `masz ${world.steps}`,
      bad: world.steps > world.best
    });
  }
  goals.push({
    icon: '⭐',
    done: count > 0 && count <= level.stars[0],
    text: `Na 3 gwiazdki: najwyżej <b>${level.stars[0]}</b> ${kkCardsWord(level.stars[0])}`,
    short: `≤ ${level.stars[0]}`,
    badge: `masz ${count}`,
    bad: count > level.stars[0]
  });
  list.innerHTML = goals.map((goal) => `
    <li class="kk-goal${goal.done ? ' is-done' : ''}">
      <span class="kk-goal-icon" aria-hidden="true">${goal.done ? '✔' : goal.art ? kkArt(goal.art) : goal.icon}</span>
      <span class="kk-goal-text">${goal.text}</span>
      <span class="kk-goal-short">${goal.short}</span>
      ${goal.badge ? `<span class="kk-goal-badge${goal.bad ? ' is-bad' : ''}">${goal.badge}</span>` : ''}
    </li>`).join('');
}

// Postać, która teraz słucha kart, ma obwódkę (tylko gdy na planszy są dwie).
function kkMarkActive(state) {
  const { world } = state;
  state.charEls.forEach((el, i) => el.classList.toggle('is-active', world.chars.length > 1 && i === world.active));
}

// Krok to chód (kołysanie z noga na nogę), obrót to przestąpienie w miejscu, skok — łuk nad polem.
function kkDrawKosmo(state, type) {
  const ch = kkActive(state.world);
  const el = state.charEls[state.world.active];
  el.style.cssText = kkPlace(state.world, ch.x, ch.y);
  el.querySelector('.kk-heading').style.transform = `rotate(${ch.angle}deg)`;
  el.classList.toggle('is-left', ch.face === 'W');
  el.classList.toggle('is-up', ch.dir === 'N');
  el.classList.remove('is-walk', 'is-turn', 'is-jump', 'is-dodge');
  void el.offsetWidth;
  el.classList.add(type === 'move' || type === 'push' ? 'is-walk' : type === 'jump' ? 'is-jump' : type === 'dodge' ? 'is-dodge' : 'is-turn');
}

// Rzucona bateria leci od postaci do celu (postaci, rakiety albo tam, gdzie spadła). Po locie znika, a ręce się odświeżają.
function kkDrawThrow(state, event) {
  const { world } = state;
  const from = world.chars[event.from];
  state.charEls[event.from].classList.remove('is-holding');
  const fly = document.createElement('span');
  fly.className = 'kk-item kk-fly';
  fly.setAttribute('aria-hidden', 'true');
  fly.innerHTML = kkArt('battery');
  fly.style.cssText = kkPlace(world, from.x, from.y);
  state.items.append(fly);
  void fly.offsetWidth;
  fly.style.cssText = kkPlace(world, event.x, event.y);
  fly.classList.toggle('is-lost', Boolean(event.lost));
  setTimeout(() => {
    if (kosmoGame !== state) return;
    fly.remove();
    kkSyncHolding(state);
  }, KK_STEP_MS - 40);
}

// Meteoryt spada z nieba na pole key. Po uniku rozbija się obok (is-crash).
function kkDrawMeteor(state, key) {
  const [x, y] = key.split(',').map(Number);
  const meteor = document.createElement('span');
  meteor.className = 'kk-item kk-meteor';
  meteor.dataset.key = key;
  meteor.setAttribute('aria-hidden', 'true');
  meteor.style.cssText = kkPlace(state.world, x, y);
  meteor.innerHTML = kkArt('meteor');
  state.items.append(meteor);
}

// Skrzynia jedzie o pole dalej, a wepchnięta do krateru zasypuje go.
function kkDrawPush(state, event) {
  const box = state.items.querySelector(`.kk-box[data-key="${event.from}"]`);
  if (!box) return;
  const [x, y] = event.to.split(',').map(Number);
  box.dataset.key = event.to;
  box.style.cssText = kkPlace(state.world, x, y);
  if (!event.fill) return;
  box.classList.add('is-filled');
  state.body.querySelector(`.kk-cell[data-key="${event.to}"]`)?.classList.add('is-filled');
}

function kkResetBoard(state) {
  state.world = kkCreateWorld(state.level);
  state.dirty = false;
  state.won = false;
  kkRenderItems(state);
  kkHighlight(state, null);
}

// no — karta Jeśli, której warunek się nie spełnił: świeci na szaro.
function kkHighlight(state, node, no = false) {
  state.body.querySelectorAll('.kk-card.is-running').forEach((el) => el.classList.remove('is-running', 'is-no'));
  const card = node && state.body.querySelector(`.kk-card[data-id="${node.id}"]`);
  if (!card) return;
  card.classList.add('is-running');
  card.classList.toggle('is-no', no);
  kkShowTab(state, card.closest('.kk-strip').dataset.tab);
  kkScrollTo(card.closest('.kk-scroll'), card);
  kkScrollTo(state.body.querySelector('.kk-program'), card);
}

// Przewija tylko okno programu (nie całą stronę), żeby wykonywana karta była widoczna.
function kkScrollTo(box, el) {
  if (!box) return;
  const outer = box.getBoundingClientRect();
  const inner = el.getBoundingClientRect();
  const pad = 16;
  if (inner.top < outer.top + pad) box.scrollTop -= outer.top + pad - inner.top;
  else if (inner.bottom > outer.bottom - pad) box.scrollTop += inner.bottom - outer.bottom + pad;
  if (inner.left < outer.left + pad) box.scrollLeft -= outer.left + pad - inner.left;
  else if (inner.right > outer.right - pad) box.scrollLeft += inner.right - outer.right + pad;
}

function kkSetStatus(state, text, tone) {
  state.status.textContent = text;
  state.status.className = `cg-status${tone ? ` is-${tone}` : ''}`;
}

function kkShowMessage(state, text, tone) {
  const message = state.body.querySelector('.fg-message');
  message.textContent = text;
  message.className = `fg-message is-${tone}`;
  clearTimeout(state.messageTimer);
  state.messageTimer = setTimeout(() => { message.textContent = ''; }, 1800);
}

// ——— Uruchamianie ———

function kkStartRun(state) {
  if (!state.program.main.length) {
    kkSetStatus(state, 'Program jest pusty. Kliknij karty na belce po lewej, by go ułożyć.', 'bad');
    return;
  }
  if (state.dirty) kkResetBoard(state);
  state.running = true;
  state.dirty = true;
  state.steps = kkExecute(state.program, state.level, state.world);
  state.body.classList.add('is-running');
  state.runButton.innerHTML = '<span aria-hidden="true">■</span> Stop';
  kkSetStatus(state, 'Kosmo wykonuje program…', '');
  kkNextStep(state);
}

function kkNextStep(state) {
  if (kosmoGame !== state || !state.running) return;
  const { value: event, done } = state.steps.next();
  if (done) {
    kkStopRun(state);
    kkHighlight(state, null);
    kkFinishRun(state);
    return;
  }
  kkHighlight(state, event.node, event.type === 'if' && !event.ok);
  if (['move', 'turn', 'jump', 'push', 'dodge'].includes(event.type)) kkDrawKosmo(state, event.type);
  if (event.type === 'push') kkDrawPush(state, event);
  // Karta Gdy na chwilę oddaje karty postaci, której przytrafiło się zdarzenie — obwódka idzie za nią.
  kkMarkActive(state);
  if (event.type === 'take' || event.type === 'grab') {
    const item = state.items.querySelector(`.kk-crystal[data-key="${event.key}"], .kk-battery[data-key="${event.key}"]`);
    item?.classList.add('is-taken');
  }
  if (event.type === 'throw') kkDrawThrow(state, event);
  if (event.type === 'meteor') kkDrawMeteor(state, event.key);
  if (event.type === 'load') {
    const rocket = state.items.querySelector('.kk-rocket');
    rocket.classList.remove('is-loaded');
    void rocket.offsetWidth;
    rocket.classList.add('is-loaded');
  }
  if (event.type === 'crash') state.items.querySelector(`.kk-meteor[data-key="${event.key}"]`)?.classList.add('is-crash');
  if (event.type !== 'throw') kkSyncHolding(state);
  kkRenderGoals(state);
  if (event.type === 'error') {
    kkStopRun(state);
    kkSetStatus(state, event.message, 'bad');
    kkShowMessage(state, 'Ups!', 'bad');
    const el = state.charEls[state.world.active];
    // Kosmo na śluzie: błąd przychodzi, gdy już doszedł na pole, więc przewraca się od razu. Meteoryt też go przewraca.
    if (event.slip || event.hit) {
      el.classList.add('is-fallen');
      return;
    }
    const [dx, dy] = KK_DIRS[event.bump] || [0, 0];
    const ch = kkActive(state.world);
    // Odwrócona w lewo postać ma lustrzany obrazek, więc przesunięcie w poziomie też trzeba odwrócić.
    el.style.setProperty('--bump-x', `${dx * (ch.face === 'W' ? -30 : 30)}%`);
    el.style.setProperty('--bump-y', `${dy * 30}%`);
    el.classList.toggle('is-wiggle', event.bump === 'take');
    el.classList.remove('is-bump');
    void el.offsetWidth;
    el.classList.add('is-bump');
    return;
  }
  // Wejście w pętlę, funkcję, sprawdzenie warunku, zmiana postaci i zdarzenie tylko podświetlają kartę, więc trwają krócej.
  const delay = ['loop', 'call', 'if', 'swap', 'event', 'load'].includes(event.type) ? KK_STEP_MS / 2 : KK_STEP_MS;
  state.timer = setTimeout(() => kkNextStep(state), delay);
}

function kkStopRun(state, message) {
  clearTimeout(state.timer);
  if (!state.running) return;
  state.running = false;
  state.steps = null;
  state.body.classList.remove('is-running');
  state.runButton.innerHTML = '<span aria-hidden="true">▶</span> Start';
  if (message) {
    kkHighlight(state, null);
    kkSetStatus(state, message, '');
  }
}

function kkFinishRun(state) {
  if (!kkGoalReached(state.world)) {
    kkSetStatus(state, kkGoalMessage(state.world), 'bad');
    return;
  }
  winKosmoLevel(state);
}

// ——— Wygrana, koniec gry ———

function kkGamePoints(game, save) {
  const total = game.levels.reduce((sum, _, i) => sum + (save.stars[i] || 0), 0);
  return { total, points: Math.round((game.reward * total) / (game.levels.length * 3)) };
}

function winKosmoLevel(state) {
  state.won = true;
  kkRenderGoals(state);
  const { topic, index, game, levelIndex, level } = state;
  const count = kkProgramCount(state.program);
  const stars = kkStars(level, count);
  const save = kkReadSave(game);
  save.stars[levelIndex] = Math.max(save.stars[levelIndex] || 0, stars);
  kkWriteSave(game, save);
  kkSaveProgram(state);
  const last = levelIndex === game.levels.length - 1;
  const allDone = game.levels.every((_, i) => save.stars[i]);
  setQuizProgress((levelIndex + 1) / game.levels.length);
  kkSetStatus(state, 'Udało się! Kosmo jest w rakiecie.', 'good');
  kkShowMessage(state, 'Brawo!', 'good');
  // Do rakiety wsiada Kosmo, który na niej stoi (na planszy może ich być kilku).
  const pilot = state.world.chars.findIndex((ch) => ch.who !== 'robo' && kkOnRocket(state.world, ch));
  state.kosmo = state.charEls[pilot];
  state.pilot = state.world.chars[pilot].who;
  burstFileGameConfetti(state.kosmo.getBoundingClientRect(), topic.accent);
  kkLaunchRocket(state);

  setTimeout(() => {
    if (kosmoGame !== state) return;
    const overlay = state.body.querySelector('.fg-overlay');
    const card = overlay.querySelector('.fg-overlay-card');
    const finish = last && allDone;
    const { points } = kkGamePoints(game, save);
    card.innerHTML = `
      <div class="summary-icon" aria-hidden="true">${finish ? '🏆' : '🚀'}</div>
      <p class="cg-win-stars" aria-label="Gwiazdki: ${stars} z 3">${cgStarText(stars)}</p>
      <h2>${finish ? 'Wszystkie poziomy przebyte!' : 'Kosmo w rakiecie!'}</h2>
      <p>Twój program ma ${count} ${kkCardsWord(count)}. ${stars < 3 ? `Na 3 gwiazdki wystarczy ${level.stars[0]}.` : 'Mistrzowski program!'}</p>
      ${level.fact ? `<p class="ng-fact"><b>Czy wiesz?</b> ${level.fact}</p>` : ''}
      <div class="summary-actions">
        ${stars < 3 ? '<button class="secondary-button kk-improve" type="button">Popraw program</button>' : ''}
        <button class="primary-button quiz-finish" type="button">${finish ? `Odbierz ${points} pkt` : last ? 'Wróć do poziomów' : 'Następny poziom'}</button>
      </div>
    `;
    card.querySelector('.kk-improve')?.addEventListener('click', () => {
      overlay.hidden = true;
      kkResetBoard(state);
      kkSetStatus(state, `Spróbuj ułożyć to z mniejszej liczby kart — najwyżej ${level.stars[0]}.`, '');
    });
    card.querySelector('.quiz-finish').addEventListener('click', () => {
      if (finish) finishKosmoGame(state);
      else if (last) renderKosmoGame(topic, index, game);
      else startKosmoLevel(topic, index, game, levelIndex + 1);
    });
    overlay.hidden = false;
    card.querySelector('.quiz-finish').focus();
  }, KK_LAUNCH_MS);
}

// Kosmo wsiada do rakiety (znika z planszy, widać go w okienku), a rakieta wylatuje poza okno przeglądarki.
// Lecąca rakieta to kopia przypięta do okna, bo plansza przycina wszystko, co wystaje poza nią.
const KK_LAUNCH_MS = 2300;

function kkLaunchRocket(state) {
  const rocket = state.items.querySelector('.kk-rocket');
  const art = rocket.firstElementChild;
  state.kosmo.classList.add('is-boarding');
  state.timer = setTimeout(() => {
    if (kosmoGame !== state) return;
    const rect = art.getBoundingClientRect();
    const flyer = document.createElement('div');
    flyer.className = 'kk-flyer';
    flyer.setAttribute('aria-hidden', 'true');
    flyer.style.cssText = `left: ${rect.left}px; top: ${rect.top}px; width: ${rect.width}px; height: ${rect.height}px; --fly-y: ${-Math.ceil(rect.bottom + 20)}px`;
    flyer.innerHTML = `${art.outerHTML}<span class="kk-window kk-is-${state.pilot}">${kkArt('kosmo')}</span>`;
    document.body.append(flyer);
    rocket.style.visibility = 'hidden';
    state.flyer = flyer;
    setTimeout(() => flyer.remove(), KK_LAUNCH_MS);
  }, 420);
}

function finishKosmoGame(state) {
  const { topic, index, game } = state;
  stopKosmoGame();

  const save = kkReadSave(game);
  const { total, points } = kkGamePoints(game, save);
  const earned = Math.max(0, points - readQuizBest(game.id));
  if (earned) {
    saveQuizBest(game.id, points);
    saveStudentPoints(readStudentPoints() + earned);
  }
  completeLesson(topic, index);

  setQuizProgress(1);
  app.querySelector('#quiz-prompt').textContent = 'Brawo, Kosmo leci do domu!';
  app.querySelector('#quiz-hint').textContent = game.doneHint;

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body quiz-summary';
  body.innerHTML = `
    <div class="summary-icon" aria-hidden="true">🏆</div>
    <div class="summary-stats">
      <div><strong>${game.levels.length}</strong><span>przebytych poziomów</span></div>
      <div><strong>${total} / ${game.levels.length * 3}</strong><span>gwiazdek</span></div>
      <div><strong>+${formatPoints(earned)}</strong><span>nowych punktów</span></div>
    </div>
    ${total < game.levels.length * 3 ? '<p class="cg-summary-tip">Ułóż krótsze programy na poziomach bez 3 gwiazdek, a dostaniesz więcej punktów.</p>' : ''}
    <div class="summary-actions">
      <button class="secondary-button quiz-retry" type="button">Wybierz poziom</button>
      <a class="primary-button quiz-finish" href="#/sciezka/${topic.slug}">Wróć do ścieżki <span aria-hidden="true">→</span></a>
    </div>
  `;
  body.querySelector('.quiz-retry').addEventListener('click', () => renderKosmoGame(topic, index, game));
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
