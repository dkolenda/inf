// Gra „Kod Planszy”: robotem steruje się klawiszami W A S D, a dziecko programuje elementy planszy
// w GDScript (język silnika Godot). Każdy element to węzeł sceny ze skryptem .gd: przycisk, drzwi,
// klejnot, klucz, portal… Godot (tu: nasz silnik) woła funkcje skryptów przy zdarzeniach:
// _ready() na start sceny, _on_body_entered(body) / _on_body_exited(body), gdy robot wejdzie na pole
// lub z niego zejdzie, i _input(event) przy każdym klawiszu. Ruch robota też jest kodem (robot.gd),
// więc na ostatnich poziomach dziecko dopisuje robotowi nowe zachowania.
// Własny interpreter (bez eval), wykonywany od razu przy zdarzeniu. Część „silnik” (kpCompileAll,
// kpCreateWorld, kpPress, kpSimulate, kpFailingCheck) nie dotyka DOM — testuje się ją w node.
// Korzysta z code-game.js (CG_ROBOT_SVG, cgSuggest, cgEscape, edytor kodu) oraz z funkcji app.js
// (setQuizProgress, completeLesson, saveStudentPoints…) i burstFileGameConfetti z file-game.js.
let boardGame = null;

const KP_TICK_LIMIT = 3000;
const KP_CALL_DEPTH = 40;
const KP_EVENT_LIMIT = 60;
const KP_PRESS_MS = 110;
const KP_STORAGE_KEY = 'informatyczna-przygoda:board-game';
const KP_TIRED = 'Skrypt pracuje bez końca — czy Twoja pętla kiedyś się kończy?';

// Litery na mapie: # ściana, . podłoga, ~ woda, reszta to węzły sceny. Powtórzona litera daje kolejne
// węzły z numerem: Gem, Gem2, Gem3. Węzeł ma skrypt <typ>.gd, jeśli poziom go podaje w scripts.
const KP_LEGEND = {
  R: { type: 'robot', name: 'Robot' },
  F: { type: 'goal', name: 'Goal' },
  B: { type: 'button', name: 'Button' },
  D: { type: 'door', name: 'Door' },
  G: { type: 'gem', name: 'Gem' },
  K: { type: 'key', name: 'Key' },
  L: { type: 'lock', name: 'Lock' },
  P: { type: 'portal', name: 'Portal' },
  E: { type: 'exit', name: 'Exit' },
  '=': { type: 'bridge', name: 'Bridge', hidden: true }
};
// area — Area2D: wysyła body_entered / body_exited, gdy robot wejdzie na pole albo z niego zejdzie.
const KP_TYPES = {
  robot: { cls: 'CharacterBody2D', label: 'Robot', icon: '🤖' },
  goal: { cls: 'Area2D', label: 'Meta', icon: '🏁', area: true },
  button: { cls: 'Area2D', label: 'Przycisk', icon: '🔴', area: true },
  door: { cls: 'StaticBody2D', label: 'Drzwi', icon: '🚪' },
  gem: { cls: 'Area2D', label: 'Klejnot', icon: '💎', area: true },
  key: { cls: 'Area2D', label: 'Klucz', icon: '🔑', area: true },
  lock: { cls: 'Area2D', label: 'Zamek', icon: '🔒', area: true },
  portal: { cls: 'Area2D', label: 'Portal', icon: '🌀', area: true },
  exit: { cls: 'Marker2D', label: 'Wyjście portalu', icon: '✨' },
  bridge: { cls: 'StaticBody2D', label: 'Most', icon: '🪵' }
};
const KP_CLASSES = new Set(['Vector2', 'Node2D', ...Object.values(KP_TYPES).map((type) => type.cls)]);

// Akcje z Mapy wejścia Godota i klawisze, które je wywołują. Klawisze w checks poziomu to w a s d i spacja.
const KP_ACTION_KEYS = {
  ui_right: ['d', 'arrowright'],
  ui_left: ['a', 'arrowleft'],
  ui_up: ['w', 'arrowup'],
  ui_down: ['s', 'arrowdown'],
  ui_accept: [' ', 'enter']
};
const KP_KEY_ACTIONS = Object.fromEntries(Object.entries(KP_ACTION_KEYS).flatMap(([action, keys]) => keys.map((key) => [key, action])));

// Funkcje, które Godot woła sam, i ile wartości im podaje.
const KP_CALLBACKS = { _ready: 0, _input: 1, _on_body_entered: 1, _on_body_exited: 1 };
// Wbudowane funkcje: [najmniej, najwięcej] wartości w nawiasach.
const KP_GLOBAL_FUNCS = { print: [0, 9], str: [1, 1], Vector2: [0, 2], range: [1, 2] };
const KP_NODE_METHODS = { queue_free: [0, 0], show: [0, 0], hide: [0, 0], get_node: [1, 1], get_tree: [0, 0] };
const KP_ROBOT_METHODS = { move_and_collide: [1, 1] };
const KP_NODE_PROPS = ['position', 'visible', 'name'];
const KP_VECTORS = { RIGHT: [1, 0], LEFT: [-1, 0], UP: [0, -1], DOWN: [0, 1], ZERO: [0, 0], ONE: [1, 1] };

const KP_KEYWORDS = new Set([
  'func', 'var', 'const', 'extends', 'in', 'not', 'and', 'or', 'true', 'false', 'null', 'self', 'pass', 'return',
  'if', 'elif', 'else', 'for', 'while', 'break', 'continue'
]);
const KP_CONTROL = new Set(['if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'return', 'pass']);
const KP_HEADERS = new Set(['func', 'for', 'while', 'if', 'elif', 'else']);
const KP_ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=']);
const KP_COMPARE_OPS = new Set(['==', '!=', '<', '>', '<=', '>=']);
const KP_OPS = ['->', ':=', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '&&', '||', '+', '-', '*', '/', '%', '<', '>', '=', '(', ')', ':', ',', '.', '!'];
const KP_NAME_RE = /^[A-Za-z_À-ſ][\wÀ-ſ]*/;
const KP_BLOCK_REASONS = {
  edge: 'tam kończy się plansza',
  wall: 'tam jest ściana',
  water: 'tam jest woda, a robot nie umie pływać',
  door: 'tam są zamknięte drzwi'
};

// ——— Wartości ———

class KpError extends Error {
  constructor(line, message, file) {
    super(message);
    this.line = line;
    this.file = file || '';
  }
}

function kpFail(line, message, file) {
  throw new KpError(line, message, file);
}

class KpVec {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

class KpType {
  constructor(name) {
    this.name = name;
  }
}

class KpEvent {
  constructor(action) {
    this.action = action;
  }
}

class KpTree {}

class KpReturn {
  constructor(value) {
    this.value = value;
  }
}

const KP_VECTOR2 = new KpType('Vector2');
const KP_BREAK = { signal: 'break' };
const KP_CONTINUE = { signal: 'continue' };

function kpIsNode(value) {
  return Boolean(value) && typeof value === 'object' && value.kind === 'node';
}

function kpTruthy(value) {
  if (value instanceof KpVec) return Boolean(value.x || value.y);
  return Boolean(value);
}

function kpEquals(a, b) {
  if (a instanceof KpVec && b instanceof KpVec) return a.x === b.x && a.y === b.y;
  return a === b;
}

// Tekst wartości tak, jak wypisuje go print() w Godocie.
function kpFormat(value) {
  if (value === null || value === undefined) return '<null>';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof KpVec) return `(${value.x}, ${value.y})`;
  if (kpIsNode(value)) return `${value.name}:<${KP_TYPES[value.type].cls}>`;
  if (value instanceof KpEvent) return 'InputEvent';
  if (value instanceof KpTree) return 'SceneTree';
  if (value instanceof KpType) return value.name;
  return String(value);
}

function kpTypeName(value) {
  if (value === null || value === undefined) return 'null (nic)';
  if (typeof value === 'number') return 'liczba';
  if (typeof value === 'string') return 'tekst';
  if (typeof value === 'boolean') return 'true/false';
  if (value instanceof KpVec) return 'Vector2';
  if (kpIsNode(value)) return `węzeł ${value.name}`;
  if (value instanceof KpEvent) return 'event';
  return kpFormat(value);
}

// ——— Język: tokeny i linie ———

function kpIsValueEnd(token) {
  return Boolean(token) && (token.type === 'num' || token.type === 'str' || token.type === 'name' || token.type === 'path' || (token.type === 'op' && token.value === ')'));
}

function kpIsOp(token, value) {
  return Boolean(token) && token.type === 'op' && token.value === value;
}

function kpIsWord(token, value) {
  return Boolean(token) && token.type === 'name' && token.value === value;
}

// $Door, $"../Door" i %Door wskazują węzeł sceny. Zostawiamy samą nazwę.
function kpPathName(raw) {
  return raw.split('/').filter((part) => part && part !== '..' && part !== '.').pop() || '';
}

function kpTokenize(text, line) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ' ' || ch === '\t') {
      i += 1;
      continue;
    }
    if (ch === '#') break;
    const rest = text.slice(i);
    const number = rest.match(/^\d+(?:\.\d+)?/);
    if (number) {
      tokens.push({ type: 'num', value: Number(number[0]) });
      i += number[0].length;
      continue;
    }
    const word = rest.match(KP_NAME_RE);
    if (word) {
      tokens.push({ type: 'name', value: word[0] });
      i += word[0].length;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const end = text.indexOf(ch, i + 1);
      if (end === -1) kpFail(line, `Brakuje cudzysłowu zamykającego ${ch}. Tekst piszemy tak: "ui_accept"`);
      tokens.push({ type: 'str', value: text.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if ('„”“'.includes(ch)) kpFail(line, 'To cudzysłów z edytora tekstu. W kodzie użyj zwykłego: "');
    if (ch === '$' || (ch === '%' && !kpIsValueEnd(tokens[tokens.length - 1]) && /[A-Za-z_"]/.test(text[i + 1] || ''))) {
      const after = text.slice(i + 1);
      const quoted = after.match(/^"([^"]*)"/);
      const plain = after.match(KP_NAME_RE);
      if (!quoted && !plain) kpFail(line, `Po ${ch} napisz nazwę węzła, np. ${ch}Door`);
      tokens.push({ type: 'path', value: kpPathName(quoted ? quoted[1] : plain[0]) });
      i += 1 + (quoted ? quoted[0].length : plain[0].length);
      continue;
    }
    const op = KP_OPS.find((candidate) => rest.startsWith(candidate));
    if (op) {
      tokens.push({ type: 'op', value: op });
      i += op.length;
      continue;
    }
    kpFail(line, `Nieznany znak „${ch}”. Sprawdź, czy nie ma tu literówki.`);
  }
  return tokens;
}

// Dzieli kod na niepuste linie z poziomem wcięcia. Wcięcie to Tab albo 4 spacje — w całym skrypcie tak samo.
function kpSplitLines(source) {
  const lines = [];
  let style = null;
  source.replace(/\r/g, '').split('\n').forEach((text, i) => {
    const line = i + 1;
    const lead = text.match(/^[ \t]*/)[0];
    const tokens = kpTokenize(text.slice(lead.length), line);
    if (!tokens.length) return;
    let level = 0;
    if (lead) {
      if (lead.includes('\t') && lead.includes(' ')) kpFail(line, 'We wcięciu są pomieszane Tab i spacje. Usuń je i wciśnij sam Tab.');
      const kind = lead[0] === '\t' ? 'tab' : 'space';
      style = style || kind;
      if (kind !== style) {
        kpFail(line, style === 'tab'
          ? 'Tu wcięcie jest ze spacji, a wyżej z Tab. Używaj wszędzie tego samego — najlepiej klawisza Tab.'
          : 'Tu wcięcie jest z Tab, a wyżej ze spacji. Używaj wszędzie tego samego.');
      }
      if (kind === 'space' && lead.length % 4) kpFail(line, 'Wcięcie ze spacji musi mieć po 4 spacje na poziom. Najprościej wciśnij Tab.');
      level = kind === 'tab' ? lead.length : lead.length / 4;
    }
    lines.push({ line, level, text: text.trim(), tokens });
  });
  return lines;
}

function kpCheckParens(tokens, line) {
  let depth = 0;
  tokens.forEach((token) => {
    if (kpIsOp(token, '(')) depth += 1;
    if (kpIsOp(token, ')')) depth -= 1;
    if (depth < 0) kpFail(line, 'Za dużo nawiasów zamykających „)”.');
  });
  if (depth > 0) kpFail(line, 'Brakuje nawiasu zamykającego „)”.');
}

// Indeks pierwszego tokenu spełniającego warunek poza nawiasami albo -1.
function kpFindTop(tokens, test) {
  let depth = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    if (kpIsOp(tokens[i], '(')) depth += 1;
    if (kpIsOp(tokens[i], ')')) depth -= 1;
    if (!depth && test(tokens[i])) return i;
  }
  return -1;
}

// ——— Język: wyrażenia ———

function kpParseExpr(tokens, line, from = 0, to = tokens.length) {
  const list = tokens.slice(from, to);
  let pos = 0;
  const peek = () => list[pos];
  const next = () => list[pos++];

  function parseArgs() {
    const args = [];
    if (!kpIsOp(peek(), ')')) {
      args.push(parseOr());
      while (kpIsOp(peek(), ',')) {
        next();
        args.push(parseOr());
      }
    }
    if (!kpIsOp(peek(), ')')) kpFail(line, 'Brakuje nawiasu zamykającego „)”.');
    next();
    return args;
  }
  function parseOr() {
    let left = parseAnd();
    while (kpIsWord(peek(), 'or') || kpIsOp(peek(), '||')) {
      next();
      left = { type: 'or', left, right: parseAnd() };
    }
    return left;
  }
  function parseAnd() {
    let left = parseNot();
    while (kpIsWord(peek(), 'and') || kpIsOp(peek(), '&&')) {
      next();
      left = { type: 'and', left, right: parseNot() };
    }
    return left;
  }
  function parseNot() {
    if (kpIsWord(peek(), 'not') || kpIsOp(peek(), '!')) {
      next();
      return { type: 'not', arg: parseNot() };
    }
    return parseCompare();
  }
  function parseCompare() {
    const left = parseSum();
    const token = peek();
    if (token && token.type === 'op' && KP_COMPARE_OPS.has(token.value)) {
      next();
      return { type: 'bin', op: token.value, left, right: parseSum(), line };
    }
    if (kpIsOp(token, '=')) kpFail(line, 'Do porównania używamy dwóch znaków „==”, np. if presses == 3:');
    return left;
  }
  function parseSum() {
    let left = parseTerm();
    while (kpIsOp(peek(), '+') || kpIsOp(peek(), '-')) {
      const op = next().value;
      left = { type: 'bin', op, left, right: parseTerm(), line };
    }
    return left;
  }
  function parseTerm() {
    let left = parseUnary();
    while (kpIsOp(peek(), '*') || kpIsOp(peek(), '/') || kpIsOp(peek(), '%')) {
      const op = next().value;
      left = { type: 'bin', op, left, right: parseUnary(), line };
    }
    return left;
  }
  function parseUnary() {
    if (kpIsOp(peek(), '-')) {
      next();
      return { type: 'neg', arg: parseUnary(), line };
    }
    if (kpIsOp(peek(), '+')) next();
    return parsePostfix();
  }
  function parsePostfix() {
    let node = parsePrimary();
    while (kpIsOp(peek(), '.')) {
      next();
      const member = next();
      if (!member || member.type !== 'name') kpFail(line, 'Po kropce napisz nazwę, np. $Robot.gems albo $Door.open()');
      if (kpIsOp(peek(), '(')) {
        next();
        node = { type: 'method', obj: node, name: member.value, args: parseArgs(), line };
      } else {
        node = { type: 'member', obj: node, prop: member.value, line };
      }
    }
    return node;
  }
  function parsePrimary() {
    const token = next();
    if (!token) kpFail(line, 'Tu czegoś brakuje — linia urywa się w połowie.');
    if (token.type === 'num') return { type: 'num', value: token.value };
    if (token.type === 'str') return { type: 'str', value: token.value };
    if (token.type === 'path') return { type: 'path', name: token.value, line };
    if (kpIsOp(token, '(')) {
      const inner = parseOr();
      if (!kpIsOp(peek(), ')')) kpFail(line, 'Brakuje nawiasu zamykającego „)”.');
      next();
      return inner;
    }
    if (token.type !== 'name') kpFail(line, `Nie rozumiem „${token.value}” w tym miejscu.`);
    const name = token.value;
    if (name === 'true' || name === 'false') return { type: 'value', value: name === 'true' };
    if (name === 'null') return { type: 'value', value: null };
    if (name === 'self') return { type: 'self' };
    if (KP_KEYWORDS.has(name)) kpFail(line, `Słowo „${name}” nie pasuje w tym miejscu.`);
    if (kpIsOp(peek(), '(')) {
      next();
      return { type: 'call', name, args: parseArgs(), line };
    }
    return { type: 'name', name, line };
  }

  if (!list.length) kpFail(line, 'Tu czegoś brakuje — linia urywa się w połowie.');
  const node = parseOr();
  if (pos < list.length) kpLeftover(list, pos, line);
  return node;
}

function kpLeftover(list, pos, line) {
  const token = list[pos];
  const previous = list[pos - 1];
  if (token.type === 'name' && previous && previous.type === 'name') {
    kpFail(line, `W nazwie nie może być spacji. Słowa łączymy podkreślnikiem, np. ${previous.value}_${token.value}`);
  }
  if (kpIsOp(previous, ')') && (token.type === 'name' || token.type === 'path')) {
    kpFail(line, 'W jednej linii piszemy jedno polecenie. Przenieś resztę do nowej linii.');
  }
  kpFail(line, `Nie rozumiem „${token.value}” w tym miejscu.`);
}

// ——— Język: polecenia i bloki ———

function kpParseHeader(word, tokens, line, depth) {
  if (word === 'func') {
    if (depth > 0) kpFail(line, 'func piszemy na początku linii, bez wcięcia.');
    const name = tokens[1];
    if (!name || name.type !== 'name') kpFail(line, 'Po func podaj nazwę funkcji, np. func open():');
    if (KP_KEYWORDS.has(name.value)) kpFail(line, `„${name.value}” to słowo GDScript — wymyśl inną nazwę funkcji.`);
    if (!kpIsOp(tokens[2], '(')) kpFail(line, `Po nazwie funkcji brakuje nawiasów: func ${name.value}():`);
    const params = [];
    let pos = 3;
    while (tokens[pos] && !kpIsOp(tokens[pos], ')')) {
      if (tokens[pos].type !== 'name' || KP_KEYWORDS.has(tokens[pos].value)) kpFail(line, 'W nawiasach po nazwie funkcji wpisz nazwy, np. func walk(dir):');
      params.push(tokens[pos].value);
      pos += 1;
      if (kpIsOp(tokens[pos], ':') && tokens[pos + 1]?.type === 'name') pos += 2;
      if (kpIsOp(tokens[pos], ',')) pos += 1;
    }
    pos += 1;
    if (kpIsOp(tokens[pos], '->') && tokens[pos + 1]?.type === 'name') pos += 2;
    if (pos < tokens.length) kpFail(line, `Nie rozumiem „${tokens[pos].value}” w tej linii.`);
    return { type: 'func', name: name.value, params, line };
  }
  if (word === 'for') {
    if (tokens[1]?.type !== 'name' || KP_KEYWORDS.has(tokens[1].value) || !kpIsWord(tokens[2], 'in')) kpFail(line, 'Pętlę for piszemy tak: for i in 5:');
    if (tokens.length === 3) kpFail(line, 'Po in napisz, ile razy powtórzyć, np. for i in 5:');
    return { type: 'for', name: tokens[1].value, iter: kpParseExpr(tokens, line, 3), line };
  }
  if (word === 'else') {
    if (kpIsWord(tokens[1], 'if')) kpFail(line, 'W GDScript zamiast „else if” piszemy „elif”.');
    if (tokens.length > 1) kpFail(line, 'Po else od razu stawiamy dwukropek: else:');
    return { type: 'else', line };
  }
  if (tokens.length === 1) {
    kpFail(line, word === 'while' ? 'Po while napisz warunek, np. while locks > 0:' : `Po ${word} napisz warunek, np. ${word} $Robot.has_key:`);
  }
  return { type: word, cond: kpParseExpr(tokens, line, 1), line };
}

function kpParseSimple(tokens, line, scope, depth) {
  const first = tokens[0];
  const word = first.type === 'name' ? first.value : '';
  if (KP_HEADERS.has(word)) kpFail(line, 'Po dwukropku zacznij nową linię i napisz to z wcięciem.');

  if (word === 'var' || word === 'const') {
    const name = tokens[1];
    if (!name || name.type !== 'name' || KP_KEYWORDS.has(name.value)) kpFail(line, `Po ${word} podaj nazwę zmiennej, np. var presses = 0`);
    if (KP_NODE_PROPS.includes(name.value)) kpFail(line, `${name.value} już istnieje — każdy węzeł go ma. Wymyśl inną nazwę.`);
    let pos = 2;
    if (kpIsOp(tokens[pos], ':') && tokens[pos + 1]?.type === 'name') pos += 2;
    if (pos === tokens.length) return { type: 'var', name: name.value, value: null, line };
    if (!kpIsOp(tokens[pos], '=') && !kpIsOp(tokens[pos], ':=')) kpFail(line, `Zmienną tworzymy tak: var ${name.value} = 0`);
    if (pos === tokens.length - 1) kpFail(line, `Po „=” wpisz wartość, np. var ${name.value} = 0`);
    return { type: 'var', name: name.value, value: kpParseExpr(tokens, line, pos + 1), line };
  }
  if (word === 'pass' || word === 'break' || word === 'continue') {
    if (tokens.length > 1) kpFail(line, `Po ${word} nic już nie piszemy w tej linii.`);
    if (word !== 'pass' && !scope.loops) kpFail(line, `${word} działa tylko wewnątrz pętli for albo while.`);
    return { type: word, line };
  }
  if (word === 'return') {
    if (!scope.inFunc) kpFail(line, 'return działa tylko wewnątrz funkcji.');
    return { type: 'return', value: tokens.length > 1 ? kpParseExpr(tokens, line, 1) : null, line };
  }
  if (word === 'extends') {
    if (depth > 0 || tokens[1]?.type !== 'name' || tokens.length > 2) kpFail(line, 'extends piszemy na początku skryptu, np. extends Area2D');
    return { type: 'extends', cls: tokens[1].value, line };
  }

  const assignAt = kpFindTop(tokens, (token) => token.type === 'op' && KP_ASSIGN_OPS.has(token.value));
  if (assignAt === 0) kpFail(line, 'Przed „=” brakuje nazwy zmiennej.');
  if (assignAt > 0) {
    const op = tokens[assignAt].value;
    if (assignAt === tokens.length - 1) kpFail(line, `Po „${op}” wpisz wartość.`);
    const target = kpParseExpr(tokens, line, 0, assignAt);
    if (target.type !== 'name' && target.type !== 'member') {
      kpFail(line, target.type === 'path'
        ? `Węzła nie można zastąpić. Zmień jego właściwość, np. $${target.name}.visible = false`
        : `Po lewej stronie „${op}” musi stać nazwa zmiennej, np. presses ${op} 1`);
    }
    return { type: 'assign', target, op, value: kpParseExpr(tokens, line, assignAt + 1), line };
  }

  const expr = kpParseExpr(tokens, line);
  if (expr.type === 'call' || expr.type === 'method') return { type: 'expr', expr, line };
  if (expr.type === 'path') kpFail(line, `Sam węzeł nic nie robi. Każ mu coś zrobić, np. $${expr.name}.open()`);
  if (expr.type === 'member' || expr.type === 'name') {
    const name = expr.type === 'member' ? expr.prop : expr.name;
    kpFail(line, `Ta linia nic nie robi. Jeśli „${name}” to polecenie, dopisz nawiasy: ${name}()`);
  }
  kpFail(line, 'Ta linia nic nie robi. Wpisz polecenie, np. $Door.open()');
}

function kpParseLine(entry, scope, depth) {
  const { tokens, line } = entry;
  const word = tokens[0].type === 'name' ? tokens[0].value : '';
  if (word && !KP_KEYWORDS.has(word) && KP_KEYWORDS.has(word.toLowerCase())) {
    kpFail(line, `W GDScript słowa piszemy małymi literami: ${word.toLowerCase()}`);
  }
  kpCheckParens(tokens, line);
  const colon = word === 'var' || word === 'const' ? -1 : kpFindTop(tokens, (token) => kpIsOp(token, ':'));
  if (KP_HEADERS.has(word)) {
    if (colon === -1) kpFail(line, `Na końcu linii z „${word}” brakuje dwukropka „:”.`);
    const stmt = kpParseHeader(word, tokens.slice(0, colon), line, depth);
    stmt.header = entry.text.slice(0, entry.text.indexOf(':') + 1);
    stmt.inline = colon < tokens.length - 1 ? tokens.slice(colon + 1) : null;
    return stmt;
  }
  if (colon !== -1) kpFail(line, 'Dwukropek „:” stawiamy tylko na końcu linii z func, if, elif, else, for albo while.');
  return kpParseSimple(tokens, line, scope, depth);
}

function kpParseBlocks(lines) {
  let i = 0;

  function parseBlock(depth, scope) {
    const body = [];
    while (i < lines.length && lines[i].level >= depth) {
      const entry = lines[i];
      if (entry.level > depth) kpFail(entry.line, 'Niepotrzebne wcięcie. Wcięcie robimy tylko pod linią, która kończy się dwukropkiem „:”.');
      i += 1;
      const stmt = kpParseLine(entry, scope, depth);
      if (stmt.header) {
        const loop = stmt.type === 'for' || stmt.type === 'while';
        const inner = stmt.type === 'func' ? { inFunc: true, loops: 0 } : { ...scope, loops: scope.loops + (loop ? 1 : 0) };
        const next = lines[i];
        if (stmt.inline) {
          stmt.body = [kpParseSimple(stmt.inline, entry.line, inner, depth + 1)];
        } else if (next && next.level === depth + 1) {
          stmt.body = parseBlock(depth + 1, inner);
        } else if (next && next.level > depth + 1) {
          kpFail(next.line, 'Za duże wcięcie — o jeden Tab za dużo.');
        } else if (next && next.level === depth && !['elif', 'else', 'func'].includes(next.tokens[0].value)) {
          kpFail(next.line, `Brakuje wcięcia. Polecenia wewnątrz „${stmt.header}” przesuń klawiszem Tab.`);
        } else {
          kpFail(entry.line, `Pod „${stmt.header}” brakuje poleceń z wcięciem (Tab). Jeśli ma tu nic nie być, napisz pass`);
        }
      }
      if (stmt.type === 'elif' || stmt.type === 'else') {
        const previous = body[body.length - 1];
        if (!previous || previous.type !== 'if' || previous.elseBody) {
          kpFail(entry.line, `„${stmt.type}” musi stać zaraz pod blokiem „if”, z takim samym wcięciem jak „if”.`);
        }
        if (stmt.type === 'elif') previous.branches.push({ cond: stmt.cond, body: stmt.body });
        else previous.elseBody = stmt.body;
        continue;
      }
      if (stmt.type === 'if') {
        stmt.branches = [{ cond: stmt.cond, body: stmt.body }];
        stmt.elseBody = null;
      }
      body.push(stmt);
    }
    return body;
  }

  if (lines.length && lines[0].level > 0) kpFail(lines[0].line, 'Pierwsza linia skryptu nie może mieć wcięcia.');
  return parseBlock(0, { inFunc: false, loops: 0 });
}

// Wywołania bez kropki, które zna węzeł danego typu.
function kpSelfMethods(type) {
  return type === 'robot' ? { ...KP_NODE_METHODS, ...KP_ROBOT_METHODS } : KP_NODE_METHODS;
}

// Sprawdza nazwy i wywołania przed uruchomieniem — jak edytor Godota, który podkreśla błędy od razu.
// hints — nazwy zmiennych i funkcji z innych skryptów (podpowiedź „Napisz $Robot.gems”).
function kpValidate(program, type, names, hints) {
  const methods = kpSelfMethods(type);
  const callables = [...Object.keys(program.funcs), ...Object.keys(KP_GLOBAL_FUNCS), ...Object.keys(methods)];
  const values = [...names, ...KP_NODE_PROPS];
  const elsewhere = (name, kind) => {
    const owner = hints[kind].get(name);
    if (!owner) return '';
    const prefix = `$${owner}`;
    return kind === 'funcs'
      ? ` ${name}() to funkcja węzła ${owner}. Napisz ${prefix}.${name}()`
      : ` „${name}” to zmienna węzła ${owner}. Napisz ${prefix}.${name}`;
  };
  const visitExpr = (node) => {
    if (!node) return;
    if (node.type === 'call') {
      const range = KP_GLOBAL_FUNCS[node.name] || methods[node.name];
      const user = program.funcs[node.name];
      if (!range && !user) {
        if (KP_ROBOT_METHODS[node.name]) kpFail(node.line, `${node.name}() umie tylko robot (robot.gd).`);
        const suggestion = cgSuggest(node.name, callables);
        kpFail(node.line, `Nie znam polecenia „${node.name}”.${elsewhere(node.name, 'funcs') || (suggestion ? ` Czy chodziło o ${suggestion}()?` : '')}`);
      }
      const [min, max] = range || [user.params.length, user.params.length];
      if (node.args.length < min || node.args.length > max) {
        kpFail(node.line, max === 0
          ? `${node.name}() nie potrzebuje niczego w nawiasach.`
          : `${node.name}() potrzebuje w nawiasach ${min === max ? min : `${min}–${max}`} ${min === 1 && max === 1 ? 'wartość' : 'wartości'}, a dostało ${node.args.length}.`);
      }
    }
    if (node.type === 'name' && !names.has(node.name) && !KP_NODE_PROPS.includes(node.name) && node.name !== 'Vector2') {
      if (program.funcs[node.name] || KP_GLOBAL_FUNCS[node.name] || methods[node.name]) kpFail(node.line, `Po ${node.name} brakuje nawiasów — napisz ${node.name}()`);
      if (KP_CLASSES.has(node.name)) kpFail(node.line, `${node.name} to nazwa typu węzła. Piszemy ją tylko po extends.`);
      const suggestion = cgSuggest(node.name, values);
      kpFail(node.line, `Nie znam „${node.name}”.${elsewhere(node.name, 'members') || (suggestion ? ` Czy chodziło o ${suggestion}?` : ` Utwórz zmienną: var ${node.name} = 0`)}`);
    }
    [node.left, node.right, node.arg, node.obj, ...(node.args || [])].forEach(visitExpr);
  };
  const visitBlock = (list) => list.forEach((stmt) => {
    [stmt.expr, stmt.value, stmt.cond, stmt.iter, stmt.target].forEach(visitExpr);
    (stmt.branches || []).forEach((branch) => {
      visitExpr(branch.cond);
      visitBlock(branch.body);
    });
    if (stmt.elseBody) visitBlock(stmt.elseBody);
    if (stmt.body && stmt.type !== 'if') visitBlock(stmt.body);
  });
  program.vars.forEach((stmt) => visitExpr(stmt.value));
  Object.values(program.funcs).forEach((func) => visitBlock(func.body));
}

// Kod skryptu → program { vars, funcs } albo wyjątek KpError z numerem linii.
function kpCompile(source, type, hints = { members: new Map(), funcs: new Map() }) {
  const lines = kpSplitLines(source);
  const names = new Set();
  lines.forEach(({ tokens }) => {
    if ((kpIsWord(tokens[0], 'var') || kpIsWord(tokens[0], 'const') || kpIsWord(tokens[0], 'for')) && tokens[1]?.type === 'name') names.add(tokens[1].value);
    if (kpIsWord(tokens[0], 'func')) {
      tokens.slice(3).forEach((token, i, rest) => {
        if (token.type === 'name' && !kpIsOp(rest[i - 1], ':') && !kpIsOp(rest[i - 1], '->')) names.add(token.value);
      });
    }
  });

  const program = { vars: [], funcs: {} };
  kpParseBlocks(lines).forEach((stmt) => {
    if (stmt.type === 'func') {
      if (program.funcs[stmt.name]) kpFail(stmt.line, `Funkcja ${stmt.name}() jest już napisana wyżej. Każda funkcja musi mieć inną nazwę.`);
      if (stmt.name === '_process' || stmt.name === '_physics_process') {
        kpFail(stmt.line, 'Robot chodzi po kratkach, więc zamiast _process używamy _input(event) — Godot woła ją przy każdym klawiszu.');
      }
      if (stmt.name.startsWith('_') && !(stmt.name in KP_CALLBACKS)) {
        const suggestion = cgSuggest(stmt.name, Object.keys(KP_CALLBACKS));
        kpFail(stmt.line, `Godot sam nie zawoła funkcji ${stmt.name}().${suggestion ? ` Czy chodziło o ${suggestion}?` : ''}`);
      }
      if (stmt.name in KP_CALLBACKS && stmt.params.length !== KP_CALLBACKS[stmt.name]) {
        const expected = { _ready: 'func _ready():', _input: 'func _input(event):' }[stmt.name] || `func ${stmt.name}(body):`;
        kpFail(stmt.line, `Godot woła tę funkcję tak: ${expected}`);
      }
      if (KP_GLOBAL_FUNCS[stmt.name] || kpSelfMethods(type)[stmt.name]) kpFail(stmt.line, `${stmt.name}() to wbudowana funkcja. Wymyśl dla swojej inną nazwę.`);
      program.funcs[stmt.name] = stmt;
    } else if (stmt.type === 'var') {
      program.vars.push(stmt);
    } else if (stmt.type === 'extends') {
      const cls = KP_TYPES[type]?.cls;
      if (cls && stmt.cls !== cls) kpFail(stmt.line, `Ten węzeł to ${cls}. Napisz: extends ${cls}`);
    } else if (stmt.type !== 'pass') {
      kpFail(stmt.line, 'Ta linia jest poza funkcją. Polecenia piszemy wewnątrz funkcji, np. pod func _on_body_entered(body): z wcięciem (Tab).');
    }
  });
  kpValidate(program, type, names, hints);
  return program;
}

// ——— Scena ———

function kpFileType(file) {
  return file.replace(/\.gd$/, '');
}

// Węzły z mapy w kolejności drzewa sceny: najpierw robot, potem od lewej do prawej, z góry na dół.
function kpSceneNodes(level) {
  const nodes = [];
  const counts = {};
  level.map.forEach((row, y) => [...row].forEach((char, x) => {
    const def = KP_LEGEND[char];
    if (!def) return;
    counts[char] = (counts[char] || 0) + 1;
    const name = counts[char] > 1 ? `${def.name}${counts[char]}` : def.name;
    const file = level.scripts[`${def.type}.gd`] ? `${def.type}.gd` : '';
    nodes.push({ name, type: def.type, x, y, hidden: Boolean(def.hidden), file });
  }));
  return nodes.sort((a, b) => (b.type === 'robot') - (a.type === 'robot'));
}

function kpScriptCode(level, codes, file) {
  const script = level.scripts[file];
  return script.edit ? codes[file] ?? script.code : script.code;
}

// Kompiluje wszystkie skrypty poziomu. codes — aktualny kod skryptów do edycji.
function kpCompileAll(level, codes = {}) {
  const hints = { members: new Map(), funcs: new Map() };
  const owners = {};
  kpSceneNodes(level).forEach((node) => {
    if (node.file && !owners[node.file]) owners[node.file] = node.name;
  });
  Object.keys(level.scripts).forEach((file) => {
    const owner = owners[file];
    if (!owner) return;
    kpScriptCode(level, codes, file).split('\n').forEach((text) => {
      const match = text.match(/^(var|const|func)\s+([A-Za-z_]\w*)/);
      if (match) hints[match[1] === 'func' ? 'funcs' : 'members'].set(match[2], owner);
    });
  });
  const programs = {};
  Object.keys(level.scripts).forEach((file) => {
    const own = { members: new Map(), funcs: new Map() };
    ['members', 'funcs'].forEach((kind) => hints[kind].forEach((owner, name) => {
      if (owner !== owners[file]) own[kind].set(name, owner);
    }));
    try {
      programs[file] = kpCompile(kpScriptCode(level, codes, file), kpFileType(file), own);
    } catch (error) {
      if (error instanceof KpError) error.file = file;
      throw error;
    }
  });
  return programs;
}

// Świat gry. programs — skompilowane skrypty albo null (plansza w edytorze, bez uruchamiania kodu).
function kpCreateWorld(level, programs) {
  const world = {
    level,
    map: level.map,
    cols: level.map[0].length,
    rows: level.map.length,
    nodes: [],
    byName: new Map(),
    robot: null,
    queue: [],
    trace: [],
    output: [],
    loops: [],
    ticks: 0,
    depth: 0,
    won: false,
    restart: false
  };
  kpSceneNodes(level).forEach((def) => {
    const node = {
      kind: 'node',
      name: def.name,
      type: def.type,
      x: def.x,
      y: def.y,
      start: { x: def.x, y: def.y },
      visible: !def.hidden,
      freed: false,
      file: def.file,
      program: programs && def.file ? programs[def.file] : null,
      members: new Map()
    };
    world.nodes.push(node);
    world.byName.set(node.name, node);
    if (node.type === 'robot') world.robot = node;
  });
  if (!programs) return world;
  // Godot najpierw tworzy wszystkie węzły ze zmiennymi, a potem woła _ready().
  world.nodes.forEach((node) => {
    if (!node.program) return;
    const frame = { world, node, locals: new Map() };
    node.program.vars.forEach((stmt) => {
      try {
        kpTick(world, stmt.line, node.file);
        node.members.set(stmt.name, stmt.value ? kpEval(stmt.value, frame) : null);
      } catch (error) {
        if (error instanceof KpError && !error.file) error.file = node.file;
        throw error;
      }
    });
  });
  world.ticks = 0;
  world.nodes.forEach((node) => kpEmit(world, node, '_ready', []));
  kpFlush(world);
  return world;
}

function kpNodesAt(world, x, y) {
  return world.nodes.filter((node) => !node.freed && node.x === x && node.y === y);
}

// Czemu robot nie może stanąć na polu (klucz z KP_BLOCK_REASONS) albo ''.
function kpBlocked(world, x, y) {
  if (x < 0 || y < 0 || x >= world.cols || y >= world.rows) return 'edge';
  const char = world.map[y][x];
  if (char === '#') return 'wall';
  const here = kpNodesAt(world, x, y);
  if (here.some((node) => node.type === 'door' && !kpTruthy(node.members.get('is_open')))) return 'door';
  if ((char === '~' || char === '=') && !here.some((node) => node.type === 'bridge' && node.visible)) return 'water';
  return '';
}

function kpIsPressed(world, node) {
  const { robot } = world;
  return node.type === 'button' && Boolean(robot) && !robot.freed && robot.x === node.x && robot.y === node.y;
}

// Przesuwa robota i kolejkuje sygnały body_exited / body_entered pól, z których zszedł i na które wszedł.
function kpPlaceRobot(world, x, y, kind) {
  const { robot } = world;
  const from = { x: robot.x, y: robot.y };
  robot.x = x;
  robot.y = y;
  world.trace.push({ kind, x, y, dx: x - from.x, dy: y - from.y });
  world.nodes.forEach((node) => {
    if (node.freed || node === robot || !KP_TYPES[node.type].area) return;
    if (node.x === from.x && node.y === from.y) world.queue.push({ node, fn: '_on_body_exited' });
  });
  world.nodes.forEach((node) => {
    if (node.freed || node === robot || !KP_TYPES[node.type].area) return;
    if (node.x === x && node.y === y) world.queue.push({ node, fn: '_on_body_entered' });
  });
}

function kpSetPosition(world, node, value, line) {
  if (!(value instanceof KpVec)) kpFail(line, `position to Vector2, a nie ${kpTypeName(value)}. Np. position = Vector2(3, 1)`);
  if (!Number.isInteger(value.x) || !Number.isInteger(value.y)) kpFail(line, 'Węzły stoją na kratkach — w position wpisz liczby całkowite.');
  if (node !== world.robot) {
    if (value.x < 0 || value.y < 0 || value.x >= world.cols || value.y >= world.rows) kpFail(line, `To miejsce jest poza planszą: ${kpFormat(value)}.`);
    node.x = value.x;
    node.y = value.y;
    return;
  }
  if (value.x === node.x && value.y === node.y) return;
  const reason = kpBlocked(world, value.x, value.y);
  if (reason) {
    world.output.push({ text: `Robot nie może stanąć na ${kpFormat(value)} — ${KP_BLOCK_REASONS[reason]}.`, tone: 'warn' });
    world.trace.push({ kind: 'bump', dx: Math.sign(value.x - node.x), dy: Math.sign(value.y - node.y) });
    return;
  }
  const far = Math.abs(value.x - node.x) + Math.abs(value.y - node.y);
  const straight = value.x === node.x || value.y === node.y;
  kpPlaceRobot(world, value.x, value.y, straight && far <= 3 ? 'jump' : 'teleport');
}

// move_and_collide(): krok po kroku, aż robot w coś uderzy. Zwraca null albo true (zderzenie).
function kpMoveAndCollide(world, motion, line) {
  if (!(motion instanceof KpVec)) kpFail(line, `move_and_collide() potrzebuje Vector2, np. move_and_collide(Vector2.RIGHT), a dostało ${kpTypeName(motion)}.`);
  const { robot } = world;
  const steps = [...Array(Math.abs(motion.x)).fill([Math.sign(motion.x), 0]), ...Array(Math.abs(motion.y)).fill([0, Math.sign(motion.y)])];
  for (const [dx, dy] of steps) {
    if (kpBlocked(world, robot.x + dx, robot.y + dy)) {
      world.trace.push({ kind: 'bump', dx, dy });
      return true;
    }
    kpPlaceRobot(world, robot.x + dx, robot.y + dy, 'walk');
  }
  return null;
}

// ——— Wykonanie ———

function kpTick(world, line, file) {
  world.ticks += 1;
  if (world.ticks > KP_TICK_LIMIT) {
    const loop = world.loops[world.loops.length - 1];
    kpFail(loop ? loop.line : line, KP_TIRED, loop ? loop.file : file);
  }
}

// Woła funkcję węzła, jeśli jego skrypt ją ma (np. Godot woła _on_body_entered przy sygnale).
function kpEmit(world, node, fn, args) {
  const func = node.program?.funcs[fn];
  if (!func || node.freed) return;
  kpRunFunc(world, node, func, args.slice(0, func.params.length), func.line);
}

// Sygnały czekają w kolejce i wykonują się po kolei, gdy skończy się bieżąca funkcja.
function kpFlush(world) {
  let count = 0;
  while (world.queue.length) {
    const event = world.queue.shift();
    count += 1;
    if (count > KP_EVENT_LIMIT) {
      const func = event.node.program?.funcs[event.fn];
      kpFail(func ? func.line : 1, 'Za dużo zdarzeń naraz — robot skacze tam i z powrotem bez końca. Czy dwa portale nie odsyłają go do siebie?', event.node.file || 'robot.gd');
    }
    kpEmit(world, event.node, event.fn, [world.robot]);
  }
}

// Naciśnięcie klawisza: Godot woła _input(event) we wszystkich węzłach, potem wykonują się sygnały.
function kpPress(world, action) {
  if (world.won) return;
  world.ticks = 0;
  const event = new KpEvent(action);
  world.nodes.forEach((node) => kpEmit(world, node, '_input', [event]));
  kpFlush(world);
}

function kpRunFunc(world, node, func, args, line) {
  if (world.depth >= KP_CALL_DEPTH) kpFail(line, `Funkcja ${func.name}() woła samą siebie bez końca. ${KP_TIRED}`, node.file);
  world.depth += 1;
  const frame = { world, node, locals: new Map(func.params.map((name, i) => [name, args[i] ?? null])) };
  try {
    kpExecBlock(func.body, frame);
  } catch (signal) {
    if (signal instanceof KpReturn) return signal.value;
    if (signal instanceof KpError && !signal.file) signal.file = node.file;
    throw signal;
  } finally {
    world.depth -= 1;
  }
  return null;
}

function kpExecBlock(list, frame) {
  for (const stmt of list) kpExecStmt(stmt, frame);
}

function kpExecLoopBody(body, frame) {
  try {
    kpExecBlock(body, frame);
  } catch (signal) {
    if (signal === KP_BREAK) return false;
    if (signal !== KP_CONTINUE) throw signal;
  }
  return true;
}

function kpExecStmt(stmt, frame) {
  const { world } = frame;
  kpTick(world, stmt.line, frame.node.file);
  switch (stmt.type) {
    case 'expr':
      kpEval(stmt.expr, frame);
      return;
    case 'var':
      frame.locals.set(stmt.name, stmt.value ? kpEval(stmt.value, frame) : null);
      return;
    case 'assign': {
      const value = kpEval(stmt.value, frame);
      kpStore(stmt.target, stmt.op === '=' ? value : kpArithmetic(stmt.op[0], kpEval(stmt.target, frame), value, stmt.line), frame, stmt.line);
      return;
    }
    case 'if':
      for (const branch of stmt.branches) {
        if (kpTruthy(kpEval(branch.cond, frame))) {
          kpExecBlock(branch.body, frame);
          return;
        }
      }
      if (stmt.elseBody) kpExecBlock(stmt.elseBody, frame);
      return;
    case 'for': {
      const iter = kpEval(stmt.iter, frame);
      let items = iter;
      if (typeof iter === 'number' && Number.isInteger(iter)) items = Array.from({ length: Math.max(0, iter) }, (_, i) => i);
      if (!Array.isArray(items)) kpFail(stmt.line, 'Po in musi być liczba powtórzeń, np. for i in 3:');
      world.loops.push({ line: stmt.line, file: frame.node.file });
      try {
        for (const item of items) {
          kpTick(world, stmt.line, frame.node.file);
          frame.locals.set(stmt.name, item);
          if (!kpExecLoopBody(stmt.body, frame)) break;
        }
      } finally {
        world.loops.pop();
      }
      return;
    }
    case 'while':
      world.loops.push({ line: stmt.line, file: frame.node.file });
      try {
        for (;;) {
          kpTick(world, stmt.line, frame.node.file);
          if (!kpTruthy(kpEval(stmt.cond, frame))) break;
          if (!kpExecLoopBody(stmt.body, frame)) break;
        }
      } finally {
        world.loops.pop();
      }
      return;
    case 'break':
      throw KP_BREAK;
    case 'continue':
      throw KP_CONTINUE;
    case 'return':
      throw new KpReturn(stmt.value ? kpEval(stmt.value, frame) : null);
    default:
      // pass — nic nie robi.
  }
}

// Zapis do zmiennej, właściwości węzła ($Robot.gems) albo składowej wektora (position.x).
function kpStore(target, value, frame, line) {
  const { world, node } = frame;
  if (target.type === 'name') {
    if (frame.locals.has(target.name)) frame.locals.set(target.name, value);
    else if (node.members.has(target.name) || KP_NODE_PROPS.includes(target.name)) kpSetProp(world, node, target.name, value, line);
    else kpFail(line, `Nie ma jeszcze zmiennej „${target.name}”. Utwórz ją najpierw: var ${target.name} = 0`);
    return;
  }
  const obj = kpEval(target.obj, frame);
  if (kpIsNode(obj)) {
    kpSetProp(world, obj, target.prop, value, line);
    return;
  }
  if (obj instanceof KpVec) {
    if (target.prop !== 'x' && target.prop !== 'y') kpFail(line, 'Vector2 ma tylko x i y.');
    if (typeof value !== 'number') kpFail(line, `${target.prop} musi być liczbą.`);
    kpStore(target.obj, target.prop === 'x' ? new KpVec(value, obj.y) : new KpVec(obj.x, value), frame, line);
    return;
  }
  kpFail(line, `Tu nie można nic zapisać — to ${kpTypeName(obj)}.`);
}

function kpMemberHint(node, prop) {
  const options = [...node.members.keys(), ...KP_NODE_PROPS];
  const suggestion = cgSuggest(prop, options);
  return suggestion ? ` Czy chodziło o ${suggestion}?` : '';
}

function kpGetProp(world, node, prop, line) {
  if (node.members.has(prop)) return node.members.get(prop);
  if (prop === 'position') return new KpVec(node.x, node.y);
  if (prop === 'visible') return node.visible;
  if (prop === 'name') return node.name;
  if (node.program?.funcs[prop]) kpFail(line, `Po ${prop} brakuje nawiasów — napisz ${prop}()`);
  kpFail(line, `Węzeł ${node.name} nie ma zmiennej „${prop}”.${kpMemberHint(node, prop)}`);
}

function kpSetProp(world, node, prop, value, line) {
  if (node.members.has(prop)) {
    node.members.set(prop, value);
    return;
  }
  if (prop === 'position') {
    kpSetPosition(world, node, value, line);
    return;
  }
  if (prop === 'visible') {
    node.visible = kpTruthy(value);
    return;
  }
  if (prop === 'name') kpFail(line, 'Nazwy węzła nie zmieniamy w kodzie — tylko w drzewie sceny.');
  kpFail(line, `Węzeł ${node.name} nie ma zmiennej „${prop}”.${kpMemberHint(node, prop)}`);
}

function kpGetNode(world, name, line) {
  const node = world.byName.get(name);
  if (!node) {
    const suggestion = cgSuggest(name, [...world.byName.keys()]);
    kpFail(line, `Na scenie nie ma węzła „${name}”.${suggestion ? ` Czy chodziło o $${suggestion}?` : ''}`);
  }
  if (node.freed) kpFail(line, `Węzła ${name} już nie ma — został usunięty przez queue_free().`);
  return node;
}

function kpArithmetic(op, a, b, line) {
  if (op === '+' && typeof a === 'string' && typeof b === 'string') return a + b;
  if (typeof a === 'string' || typeof b === 'string') {
    kpFail(line, op === '+' ? 'Tekst i liczbę łączymy przez str(), np. "Klejnoty: " + str(gems)' : 'Na tekście nie można liczyć.');
  }
  if (a instanceof KpVec || b instanceof KpVec) {
    if (a instanceof KpVec && b instanceof KpVec && (op === '+' || op === '-')) {
      return op === '+' ? new KpVec(a.x + b.x, a.y + b.y) : new KpVec(a.x - b.x, a.y - b.y);
    }
    const vec = a instanceof KpVec ? a : b;
    const num = a instanceof KpVec ? b : a;
    if (typeof num === 'number' && (op === '*' || (op === '/' && a instanceof KpVec))) {
      if (op === '/' && num === 0) kpFail(line, 'Nie można dzielić przez zero.');
      return op === '*' ? new KpVec(vec.x * num, vec.y * num) : new KpVec(Math.trunc(vec.x / num), Math.trunc(vec.y / num));
    }
    kpFail(line, 'Wektory dodajemy do wektorów (position + Vector2.RIGHT), a mnożymy przez liczbę (direction * 2).');
  }
  if (typeof a !== 'number' || typeof b !== 'number') {
    kpFail(line, a === null || b === null ? 'Zmienna nie ma jeszcze wartości. Nadaj ją, np. var presses = 0' : `Tu potrzebne są liczby, a jest ${kpTypeName(typeof a === 'number' ? b : a)}.`);
  }
  if ((op === '/' || op === '%') && b === 0) kpFail(line, 'Nie można dzielić przez zero.');
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  if (op === '/') return Number.isInteger(a) && Number.isInteger(b) ? Math.trunc(a / b) : a / b;
  return a % b;
}

function kpEval(node, frame) {
  const { world } = frame;
  switch (node.type) {
    case 'num':
    case 'str':
    case 'value':
      return node.value;
    case 'self':
      return frame.node;
    case 'path':
      return kpGetNode(world, node.name, node.line);
    case 'name':
      if (frame.locals.has(node.name)) return frame.locals.get(node.name);
      if (frame.node.members.has(node.name) || KP_NODE_PROPS.includes(node.name)) return kpGetProp(world, frame.node, node.name, node.line);
      if (node.name === 'Vector2') return KP_VECTOR2;
      kpFail(node.line, `Zmienna „${node.name}” nie istnieje w tym miejscu. Utwórz ją najpierw: var ${node.name} = 0`);
      break;
    case 'member': {
      const obj = kpEval(node.obj, frame);
      if (kpIsNode(obj)) return kpGetProp(world, obj, node.prop, node.line);
      if (obj instanceof KpVec) {
        if (node.prop === 'x' || node.prop === 'y') return obj[node.prop];
        kpFail(node.line, 'Vector2 ma tylko x i y.');
      }
      if (obj === KP_VECTOR2) {
        const vec = KP_VECTORS[node.prop];
        if (!vec) kpFail(node.line, `Nie ma Vector2.${node.prop}. Są: ${Object.keys(KP_VECTORS).join(', ')}.`);
        return new KpVec(...vec);
      }
      kpFail(node.line, `${kpTypeName(obj)} nie ma „${node.prop}”.`);
      break;
    }
    case 'not':
      return !kpTruthy(kpEval(node.arg, frame));
    case 'neg':
      return kpArithmetic('-', 0, kpEval(node.arg, frame), node.line);
    case 'and':
      return kpTruthy(kpEval(node.left, frame)) && kpTruthy(kpEval(node.right, frame));
    case 'or':
      return kpTruthy(kpEval(node.left, frame)) || kpTruthy(kpEval(node.right, frame));
    case 'bin': {
      const a = kpEval(node.left, frame);
      const b = kpEval(node.right, frame);
      if (node.op === '==') return kpEquals(a, b);
      if (node.op === '!=') return !kpEquals(a, b);
      if (KP_COMPARE_OPS.has(node.op)) {
        if (typeof a !== 'number' || typeof b !== 'number') {
          kpFail(node.line, a === null || b === null ? 'Zmienna nie ma jeszcze wartości — nie ma czego porównać.' : 'Porównywać „<” i „>” można tylko liczby.');
        }
        if (node.op === '<') return a < b;
        if (node.op === '>') return a > b;
        if (node.op === '<=') return a <= b;
        return a >= b;
      }
      return kpArithmetic(node.op, a, b, node.line);
    }
    case 'call': {
      const user = frame.node.program?.funcs[node.name];
      const args = node.args.map((arg) => kpEval(arg, frame));
      if (user) return kpRunFunc(world, frame.node, user, args, node.line);
      if (KP_GLOBAL_FUNCS[node.name]) return kpGlobal(world, node.name, args, node.line);
      return kpBuiltinMethod(world, frame.node, node.name, args, node.line);
    }
    case 'method': {
      const obj = kpEval(node.obj, frame);
      const args = node.args.map((arg) => kpEval(arg, frame));
      return kpCallMethod(world, obj, node.name, args, node.line);
    }
    default:
      return null;
  }
}

function kpGlobal(world, name, args, line) {
  if (name === 'print') {
    world.output.push({ text: args.map(kpFormat).join(''), tone: '' });
    return null;
  }
  if (name === 'str') return kpFormat(args[0]);
  if (name === 'Vector2') {
    if (args.length === 1) kpFail(line, 'Vector2() potrzebuje dwóch liczb: x i y, np. Vector2(3, 1)');
    const [x = 0, y = 0] = args;
    if (typeof x !== 'number' || typeof y !== 'number') kpFail(line, 'W Vector2() wpisz dwie liczby, np. Vector2(3, 1)');
    return new KpVec(x, y);
  }
  // range()
  args.forEach((value) => {
    if (!Number.isInteger(value)) kpFail(line, 'W range() wpisz liczby całkowite.');
  });
  const [from, to] = args.length === 1 ? [0, args[0]] : args;
  return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
}

function kpCheckArgs(name, args, range, line) {
  const [min, max] = range;
  if (args.length < min || args.length > max) {
    kpFail(line, max === 0 ? `${name}() nie potrzebuje niczego w nawiasach.` : `${name}() potrzebuje w nawiasach ${min} ${min === 1 ? 'wartość' : 'wartości'}.`);
  }
}

function kpBuiltinMethod(world, node, name, args, line) {
  const range = kpSelfMethods(node.type)[name];
  if (!range) {
    const options = [...Object.keys(node.program?.funcs || {}), ...Object.keys(kpSelfMethods(node.type))].filter((option) => !option.startsWith('_'));
    const suggestion = cgSuggest(name, options);
    kpFail(line, `Węzeł ${node.name} nie ma funkcji „${name}”.${suggestion ? ` Czy chodziło o ${suggestion}()?` : options.length ? ` Ma: ${options.map((option) => `${option}()`).join(', ')}.` : ''}`);
  }
  kpCheckArgs(name, args, range, line);
  if (name === 'queue_free') {
    node.freed = true;
    if (node === world.robot) world.trace.push({ kind: 'free' });
    return null;
  }
  if (name === 'show' || name === 'hide') {
    node.visible = name === 'show';
    return null;
  }
  if (name === 'get_node') {
    if (typeof args[0] !== 'string') kpFail(line, 'W get_node() wpisz nazwę węzła w cudzysłowie, np. get_node("Door")');
    return kpGetNode(world, kpPathName(args[0]), line);
  }
  if (name === 'get_tree') return new KpTree();
  return kpMoveAndCollide(world, args[0], line);
}

function kpCallMethod(world, obj, name, args, line) {
  if (kpIsNode(obj)) {
    if (obj.freed) kpFail(line, `Węzła ${obj.name} już nie ma — został usunięty przez queue_free().`);
    const user = obj.program?.funcs[name];
    if (user) {
      if (args.length !== user.params.length) kpFail(line, `${name}() w węźle ${obj.name} potrzebuje w nawiasach ${user.params.length} ${user.params.length === 1 ? 'wartość' : 'wartości'}.`);
      return kpRunFunc(world, obj, user, args, line);
    }
    return kpBuiltinMethod(world, obj, name, args, line);
  }
  if (obj instanceof KpEvent) {
    if (name !== 'is_action_pressed' && name !== 'is_action' && name !== 'is_action_released') {
      kpFail(line, 'Klawisz sprawdzamy tak: event.is_action_pressed("ui_accept")');
    }
    if (args.length !== 1 || typeof args[0] !== 'string') kpFail(line, `Nazwę akcji wpisz w cudzysłowie: event.${name}("ui_right")`);
    if (!KP_ACTION_KEYS[args[0]]) {
      const suggestion = cgSuggest(args[0], Object.keys(KP_ACTION_KEYS));
      kpFail(line, `Nie ma akcji „${args[0]}”.${suggestion ? ` Czy chodziło o "${suggestion}"?` : ` Są: ${Object.keys(KP_ACTION_KEYS).join(', ')}.`}`);
    }
    return name === 'is_action_released' ? false : obj.action === args[0];
  }
  if (obj instanceof KpTree) {
    if (name === 'change_scene_to_file') {
      world.won = true;
      return null;
    }
    if (name === 'reload_current_scene') {
      world.restart = true;
      return null;
    }
    kpFail(line, `get_tree() nie ma funkcji „${name}”. Ma: change_scene_to_file(), reload_current_scene().`);
  }
  if (obj === KP_VECTOR2) kpFail(line, 'Nowy wektor tworzymy tak: Vector2(1, 0)');
  kpFail(line, `${kpTypeName(obj)} nie ma funkcji ${name}().`);
}

// ——— Sprawdzanie poziomu bez ekranu ———

// Uruchamia scenę i naciska klawisze (w a s d, spacja). Zwraca świat po ostatnim klawiszu.
function kpSimulate(level, programs, keys) {
  const world = kpCreateWorld(level, programs);
  for (const key of keys) {
    if (world.won || world.restart) break;
    world.trace = [];
    kpPress(world, KP_KEY_ACTIONS[key]);
  }
  return world;
}

function kpCheckValue(world, check) {
  if (check.prop === 'won') return world.won;
  const node = world.byName.get(check.node);
  if (check.prop === 'exists') return !node.freed;
  if (check.prop === 'position') return [node.x, node.y];
  if (check.prop === 'visible') return node.visible;
  if (check.prop === 'x') return node.x;
  return node.members.get(check.prop);
}

// Warunek celu z level.goals: is (liczba, true/false, [x, y]), min (co najmniej) albo max (co najwyżej).
function kpGoalMet(world, check) {
  const value = kpCheckValue(world, check);
  if (check.min !== undefined) return typeof value === 'number' && value >= check.min;
  if (check.max !== undefined) return typeof value === 'number' && value <= check.max;
  if (Array.isArray(check.is)) {
    const [x, y] = value instanceof KpVec ? [value.x, value.y] : value || [];
    return x === check.is[0] && y === check.is[1];
  }
  return typeof check.is === 'boolean' ? kpTruthy(value) === check.is : value === check.is;
}

// Poziom ma checks — sytuacje, w których plansza ma działać inaczej niż „do mety”. Np. drzwi nie mogą
// się otworzyć, gdy robot ma za mało klejnotów. Zwraca pierwszy niespełniony { check, error? } albo null.
function kpFailingCheck(level, programs) {
  for (const check of level.checks || []) {
    let world;
    try {
      world = kpSimulate(level, programs, check.keys);
    } catch (error) {
      if (!(error instanceof KpError)) throw error;
      return { check, error };
    }
    const value = kpCheckValue(world, check);
    const same = Array.isArray(check.is) ? value[0] === check.is[0] && value[1] === check.is[1] : value === check.is;
    if (!same) return { check };
  }
  return null;
}

// ——— Kolorowanie składni (kolory edytora Godot) ———

const KP_HIGHLIGHT_RE = /(#.*$)|("[^"]*"?|'[^']*'?)|([$%](?:[A-Za-z_][\w]*|"[^"]*"?))|(\d+(?:\.\d+)?)|([A-Za-z_À-ſ][\wÀ-ſ]*)|([ \t]+)|(.)/gy;

function kpHighlightLine(text) {
  let html = '';
  let previousWord = '';
  let previousChar = '';
  KP_HIGHLIGHT_RE.lastIndex = 0;
  let match;
  while (KP_HIGHLIGHT_RE.lastIndex < text.length && (match = KP_HIGHLIGHT_RE.exec(text))) {
    const [piece, comment, string, path, number, word, space] = match;
    let kind = '';
    if (comment) kind = 'comment';
    else if (string) kind = 'string';
    else if (path) kind = 'path';
    else if (number) kind = 'number';
    else if (word) {
      const after = text.slice(KP_HIGHLIGHT_RE.lastIndex).trimStart()[0];
      if (KP_CONTROL.has(word)) kind = 'control';
      else if (KP_KEYWORDS.has(word)) kind = 'keyword';
      else if (previousWord === 'func') kind = 'funcdef';
      else if (KP_CLASSES.has(word)) kind = 'type';
      else if (after === '(') kind = 'call';
      else if (previousChar === '.' || KP_NODE_PROPS.includes(word)) kind = 'member';
    } else if (!space) kind = 'symbol';
    html += kind ? `<span class="cg-t-${kind}">${cgEscape(piece)}</span>` : cgEscape(piece);
    if (word) previousWord = word;
    if (!space) previousChar = piece;
  }
  return html;
}

function kpCodeHtml(code) {
  return code.split('\n').map(kpHighlightLine).join('\n');
}

// ——— Ekran gry ———

let boardGameSessionSave = null;

function kpReadSave(game) {
  try {
    const stored = readStoredObject(studentKey(`${KP_STORAGE_KEY}:${game.id}`));
    return { done: stored.done || {}, code: stored.code || {} };
  } catch {
    return boardGameSessionSave || { done: {}, code: {} };
  }
}

function kpWriteSave(game, save) {
  boardGameSessionSave = save;
  try {
    localStorage.setItem(studentKey(`${KP_STORAGE_KEY}:${game.id}`), JSON.stringify(save));
  } catch {
    // Gra działa dalej, gdy pamięć przeglądarki jest niedostępna.
  }
}

function kpUnlocked(save, levelIndex) {
  if (debugFreeNav) return true;
  return levelIndex === 0 || Boolean(save.done[levelIndex - 1]);
}

function renderBoardGame(topic, index, game) {
  stopBoardGame();
  document.title = `${game.title} — Informatyczna Przygoda`;
  document.querySelector('meta[name="theme-color"]').content = topic.accent;
  app.replaceChildren(quizTemplate.content.cloneNode(true));
  applyTopicTheme(topic);
  app.querySelector('#quiz-close').href = `#/sciezka/${topic.slug}`;
  app.querySelector('#quiz-footer').hidden = true;
  app.querySelector('#quiz-kicker').textContent = game.title;
  app.querySelector('#quiz-prompt').textContent = game.prompt;
  app.querySelector('#quiz-hint').textContent =
    'Tym razem robotem sterujesz Ty — klawiszami W A S D. Za to plansza jest pusta w środku: ' +
    'przyciski, drzwi i klejnoty działają dopiero wtedy, gdy napiszesz ich kod w GDScript, jak w silniku Godot.';
  setQuizProgress(0);

  const save = kpReadSave(game);
  const firstOpen = game.levels.findIndex((_, i) => !save.done[i]);
  const startAt = firstOpen === -1 ? 0 : firstOpen;
  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg-intro cg-intro';
  body.innerHTML = `
    <div class="bg-legend cg-legend">
      <span class="bg-legend-item"><span class="cg-legend-icon cg-legend-robot" aria-hidden="true">${CG_ROBOT_SVG}</span><span><b>Robot</b>chodzi klawiszami W A S D</span></span>
      <span class="bg-legend-item"><span class="cg-legend-icon" aria-hidden="true"><span class="kp-legend-plate"></span></span><span><b>Przycisk</b>robi to, co zaprogramujesz</span></span>
      <span class="bg-legend-item"><span class="cg-legend-icon" aria-hidden="true">💎</span><span><b>Klejnot</b>też ma swój kod</span></span>
      <span class="bg-legend-item"><span class="cg-legend-icon" aria-hidden="true">🏁</span><span><b>Meta</b>tu kończy się poziom</span></span>
    </div>
    <p class="ng-legend-title cg-levels-title">Poziomy</p>
    <div class="cg-level-grid">
      ${game.levels.map((level, i) => {
        const open = kpUnlocked(save, i);
        const done = Boolean(save.done[i]);
        return `
          <button class="cg-level-pick${done ? ' is-done' : ''}" type="button" data-level="${i}" ${open ? '' : 'disabled'} title="${level.title}">
            <b>${open ? i + 1 : '🔒'}</b>
            <span class="cg-level-stars kp-level-done">${done ? '✓' : ''}</span>
          </button>`;
      }).join('')}
    </div>
    <button class="primary-button fg-start" type="button">${firstOpen > 0 ? 'Graj dalej' : 'Start'} <span aria-hidden="true">▶</span></button>
  `;
  // Debugowanie: adres z ?poziom=8 (przed #) zaczyna grę od wskazanego poziomu.
  const debugLevel = Number(new URLSearchParams(location.search).get('poziom')) - 1;
  const firstLevel = debugLevel >= 0 && debugLevel < game.levels.length ? debugLevel : startAt;
  body.querySelector('.fg-start').addEventListener('click', () => startBoardLevel(topic, index, game, firstLevel));
  body.querySelectorAll('.cg-level-pick').forEach((button) => {
    button.addEventListener('click', () => startBoardLevel(topic, index, game, Number(button.dataset.level)));
  });
  body.querySelector('.fg-start').focus();
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function startBoardLevel(topic, index, game, levelIndex) {
  stopBoardGame();
  const level = game.levels[levelIndex];
  const save = kpReadSave(game);
  const world = kpCreateWorld(level, null);
  const files = Object.keys(level.scripts);
  app.querySelector('#quiz-prompt').textContent = `Poziom ${levelIndex + 1}: ${level.title}`;
  app.querySelector('#quiz-hint').innerHTML = '<ul class="ng-goals kp-goals" aria-label="Cele"></ul>';
  setQuizProgress(levelIndex / game.levels.length);

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg kp-game';
  body.innerHTML = `
    <div class="fg-hud">
      <span class="fg-score cg-level-nav">
        <button class="cg-level-step cg-prev" type="button" aria-label="Poprzedni poziom" ${levelIndex > 0 ? '' : 'disabled'}>◀</button>
        Poziom <b>${levelIndex + 1}</b> / ${game.levels.length}
        <button class="cg-level-step cg-next" type="button" aria-label="Następny poziom" ${levelIndex < game.levels.length - 1 && kpUnlocked(save, levelIndex + 1) ? '' : 'disabled'}>▶</button>
      </span>
      <span class="fg-message" aria-live="polite"></span>
      <button class="secondary-button fg-end kp-clear" type="button">Skrypt od nowa</button>
    </div>
    <div class="kp">
      <section class="kp-left" aria-label="Edytor skryptów">
        ${level.concept ? `
          <details class="cg-concept kp-concept"${kpConceptClosed(level) ? '' : ' open'}>
            <summary class="cg-concept-name"><span>Nowe pojęcie</span>${level.concept.name}</summary>
            <p class="cg-concept-text">${level.concept.text}</p>
            ${level.concept.code ? `<pre class="cg-concept-code">${kpCodeHtml(level.concept.code)}</pre>` : ''}
          </details>` : ''}
        <div class="cg-editor kp-editor">
          <div class="kp-tabs" role="tablist" aria-label="Skrypty">
            ${files.map((file) => `
              <button class="kp-tab${level.scripts[file].edit ? ' is-edit' : ''}" type="button" role="tab" data-file="${file}">
                <span aria-hidden="true">${level.scripts[file].edit ? '✎' : '📜'}</span>${file}
              </button>`).join('')}
          </div>
          <p class="kp-file-note"></p>
          <div class="cg-editor-main">
            <div class="cg-gutter" aria-hidden="true"><div class="cg-gutter-inner"></div></div>
            <div class="cg-code">
              <pre class="cg-highlight" aria-hidden="true"></pre>
              <textarea class="cg-input" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"
                aria-label="Kod skryptu w GDScript. Tab robi wcięcie, Escape wychodzi z edytora."></textarea>
            </div>
          </div>
        </div>
        <div class="cg-palette" aria-label="Wstaw kod">
          ${level.buttons.map((snippet) => `<button class="cg-snippet" type="button" data-snippet="${cgEscape(snippet).replace(/"/g, '&quot;')}">${kpHighlightLine(snippet)}</button>`).join('')}
        </div>
        <p class="kp-status" role="status" aria-live="polite"></p>
        ${level.hint ? `<details class="cg-hint"><summary>Podpowiedź</summary><p>${level.hint}</p></details>` : ''}
        ${kpDocsHtml(game, levelIndex)}
      </section>
      <section class="kp-right" aria-label="Scena">
        <div class="kp-controls">
          <button class="primary-button kp-play" type="button" title="F5"><span aria-hidden="true">▶</span> Uruchom scenę</button>
          <button class="secondary-button kp-restart" type="button" title="Uruchom od nowa" aria-label="Uruchom od nowa" disabled><span aria-hidden="true">↺</span></button>
        </div>
        <div class="cg-stage" style="--cols: ${world.cols}; --rows: ${world.rows}">
          <span class="cg-axis-corner" aria-hidden="true"></span>
          <div class="cg-axis cg-axis-x" aria-hidden="true">${Array.from({ length: world.cols }, (_, x) => `<span>${x}</span>`).join('')}</div>
          <div class="cg-axis cg-axis-y" aria-hidden="true">${Array.from({ length: world.rows }, (_, y) => `<span>${y}</span>`).join('')}</div>
          <div class="kp-board" tabindex="-1" style="--cols: ${world.cols}; --rows: ${world.rows}">
            <div class="kp-cells">
              ${level.map.flatMap((row) => [...row].map((char) => `<span class="kp-cell${{ '#': ' is-wall', '~': ' is-water', '=': ' is-water' }[char] || ''}"></span>`)).join('')}
            </div>
            <div class="kp-items"></div>
          </div>
        </div>
        <div class="kp-pad" aria-label="Sterowanie">
          <span class="kp-pad-keys" aria-hidden="true">
            <kbd data-action="ui_up">W</kbd>
            <span><kbd data-action="ui_left">A</kbd><kbd data-action="ui_down">S</kbd><kbd data-action="ui_right">D</kbd></span>
          </span>
          ${level.jump ? '<kbd class="kp-pad-space" data-action="ui_accept" aria-hidden="true">Spacja</kbd>' : ''}
          <p class="kp-pad-text">
            <b>Robotem sterujesz klawiszami W A S D${level.jump ? ', a Spacja to skok' : ''}.</b>
            <span class="kp-pad-off">Najpierw uruchom scenę ▶.</span>
            <span class="kp-pad-on">Scena działa — ruszaj robotem!</span>
          </p>
        </div>
        <div class="kp-dock">
          <div class="kp-panel">
            <p class="kp-panel-title">Scena</p>
            <ul class="kp-tree"></ul>
          </div>
          <div class="kp-panel">
            <p class="kp-panel-title">Inspektor</p>
            <dl class="kp-inspector"></dl>
          </div>
        </div>
        <div class="kp-panel kp-output">
          <p class="kp-panel-title">Wyjście</p>
          <div class="kp-log" aria-live="polite"></div>
        </div>
      </section>
    </div>
    <div class="fg-overlay is-screen" hidden><div class="fg-overlay-card"></div></div>
  `;

  const codes = {};
  files.forEach((file) => {
    // Szkic kodu jest zapisany pod tytułem poziomu, żeby po zmianie poziomu nie wczytał się stary kod.
    if (level.scripts[file].edit) codes[file] = save.code[level.title]?.[file] ?? level.scripts[file].code;
  });
  const state = {
    topic,
    index,
    game,
    levelIndex,
    level,
    body,
    world,
    codes,
    programs: null,
    file: '',
    selected: '',
    error: null,
    input: body.querySelector('.cg-input'),
    highlight: body.querySelector('.cg-highlight'),
    gutter: body.querySelector('.cg-gutter-inner'),
    status: body.querySelector('.kp-status'),
    board: body.querySelector('.kp-board'),
    items: body.querySelector('.kp-items'),
    goals: app.querySelector('#quiz-hint .kp-goals'),
    log: body.querySelector('.kp-log'),
    playButton: body.querySelector('.kp-play'),
    restartButton: body.querySelector('.kp-restart'),
    nodeEls: new Map(),
    robotEl: null,
    playing: false,
    won: false,
    lastPress: 0,
    shownOutput: 0,
    messageTimer: 0,
    clearTimer: 0,
    effectTimer: 0
  };
  boardGame = state;

  const firstNode = world.nodes.find((node) => node.file === level.open) || world.nodes[0];
  kpBuildItems(state);
  kpSelect(state, firstNode.name, level.open);
  kpRenderGoals(state);
  kpRenderOutput(state);
  kpSetStatus(state, 'Kliknij element planszy, żeby zobaczyć jego skrypt. Potem ▶ Uruchom scenę i steruj robotem.', '');

  state.input.addEventListener('input', () => {
    if (state.input.readOnly) return;
    state.codes[state.file] = state.input.value;
    if (state.error?.file === state.file) state.error = null;
    kpSaveCode(state);
    if (state.playing) kpStop(state, 'Scena zatrzymana — zmieniasz kod. Uruchom ją ponownie ▶, żeby zadziałał.');
    kpUpdateEditor(state);
  });
  state.input.addEventListener('scroll', () => cgSyncScroll(state));
  state.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      kpPlay(state);
      return;
    }
    cgEditorKey(state, event);
  });
  body.querySelector('.kp-tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('.kp-tab');
    if (!tab) return;
    const owner = state.world.nodes.find((node) => node.file === tab.dataset.file);
    kpSelect(state, owner ? owner.name : state.selected, tab.dataset.file);
  });
  body.querySelector('.cg-palette').addEventListener('click', (event) => {
    const button = event.target.closest('.cg-snippet');
    if (!button) return;
    if (state.input.readOnly) {
      const owner = state.world.nodes.find((node) => node.file === level.open);
      kpSelect(state, owner.name, level.open);
    }
    cgInsertSnippet(state, button.dataset.snippet);
  });
  state.items.addEventListener('click', (event) => {
    const el = event.target.closest('.kp-node');
    if (el) kpSelect(state, el.dataset.node);
  });
  body.querySelector('.kp-tree').addEventListener('click', (event) => {
    const item = event.target.closest('.kp-tree-node');
    if (item) kpSelect(state, item.dataset.node);
  });
  body.querySelector('.kp-concept')?.addEventListener('toggle', (event) => kpSetConceptClosed(level, !event.currentTarget.open));
  state.playButton.addEventListener('click', () => (state.playing ? kpStop(state, 'Scena zatrzymana. Robot wrócił na start.') : kpPlay(state)));
  state.restartButton.addEventListener('click', () => kpPlay(state));
  body.querySelector('.kp-clear').addEventListener('click', (event) => kpClearCode(state, event.currentTarget));
  body.querySelector('.cg-prev').addEventListener('click', () => kpGoToLevel(state, levelIndex - 1));
  body.querySelector('.cg-next').addEventListener('click', () => kpGoToLevel(state, levelIndex + 1));
  document.addEventListener('keydown', kpKeydown);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function kpGoToLevel(state, levelIndex) {
  if (levelIndex < 0 || levelIndex >= state.game.levels.length) return;
  kpSaveCode(state);
  startBoardLevel(state.topic, state.index, state.game, levelIndex);
}

// Dokumentacja: pojęcia poznane na wcześniejszych poziomach.
function kpDocsHtml(game, levelIndex) {
  const learned = game.levels.slice(0, levelIndex).filter((level) => level.concept);
  if (!learned.length) return '';
  return `
    <details class="cg-hint cg-docs">
      <summary>Dokumentacja</summary>
      <ul class="cg-docs-list">
        ${learned.map(({ concept }) => `
          <li class="cg-docs-item">
            <p class="cg-concept-name">${concept.name}</p>
            <p class="cg-concept-text">${concept.text}</p>
            ${concept.code ? `<pre class="cg-concept-code">${kpCodeHtml(concept.code)}</pre>` : ''}
          </li>`).join('')}
      </ul>
    </details>`;
}

function stopBoardGame() {
  if (!boardGame) return;
  clearTimeout(boardGame.messageTimer);
  clearTimeout(boardGame.clearTimer);
  clearTimeout(boardGame.effectTimer);
  document.removeEventListener('keydown', kpKeydown);
  boardGame = null;
}

// ——— Edytor ———

function kpUpdateEditor(state) {
  const lines = state.input.value.replace(/\r/g, '').split('\n');
  const errorLine = state.error?.file === state.file ? state.error.line : 0;
  state.highlight.innerHTML = lines.map((text, i) => `<div class="cg-line${i + 1 === errorLine ? ' is-error' : ''}">${kpHighlightLine(text) || ' '}</div>`).join('');
  state.gutter.innerHTML = lines.map((_, i) => `<div class="cg-num${i + 1 === errorLine ? ' is-error' : ''}">${i + 1}</div>`).join('');
  cgSyncScroll(state);
}

// Otwiera skrypt w edytorze (jak kliknięcie ikony skryptu w drzewie sceny Godota).
function kpOpenFile(state, file) {
  const script = state.level.scripts[file];
  if (!script) return;
  const changed = state.file !== file;
  state.file = file;
  state.input.value = script.edit ? state.codes[file] : script.code;
  state.input.readOnly = !script.edit;
  state.body.querySelectorAll('.kp-tab').forEach((tab) => {
    const active = tab.dataset.file === file;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  const owners = state.world.nodes.filter((node) => node.file === file).map((node) => node.name);
  const shared = owners.length > 1 ? ` Ten skrypt mają węzły: ${owners.join(', ')} — działa w każdym z nich.` : '';
  const note = state.body.querySelector('.kp-file-note');
  note.textContent = script.edit
    ? `✎ Ten skrypt piszesz Ty.${shared}`
    : `🔒 Gotowy skrypt — możesz go czytać, ale nie zmieniać.${shared}`;
  note.classList.toggle('is-edit', Boolean(script.edit));
  state.body.querySelector('.kp-clear').disabled = !script.edit;
  if (changed) {
    state.input.scrollTop = 0;
    state.input.scrollLeft = 0;
  }
  kpUpdateEditor(state);
}

function kpSelect(state, name, file) {
  const node = state.world.byName.get(name);
  state.selected = name;
  const target = file || node?.file;
  if (target) kpOpenFile(state, target);
  else if (node) kpSetStatus(state, `${node.name} (${KP_TYPES[node.type].cls}) nie ma skryptu. Inne skrypty mogą go użyć: $${node.name}`, '');
  kpSyncItems(state);
  kpRenderTree(state);
  kpRenderInspector(state);
}

function kpClearCode(state, button) {
  const script = state.level.scripts[state.file];
  if (!script?.edit) return;
  if (!button.classList.contains('is-confirm')) {
    button.classList.add('is-confirm');
    button.textContent = 'Na pewno?';
    clearTimeout(state.clearTimer);
    state.clearTimer = setTimeout(() => {
      button.classList.remove('is-confirm');
      button.textContent = 'Skrypt od nowa';
    }, 3000);
    return;
  }
  clearTimeout(state.clearTimer);
  button.classList.remove('is-confirm');
  button.textContent = 'Skrypt od nowa';
  if (state.playing) kpStop(state);
  state.codes[state.file] = script.code;
  state.error = null;
  kpSaveCode(state);
  kpOpenFile(state, state.file);
  kpSetStatus(state, `${state.file} wrócił do początku.`, '');
  state.input.focus();
}

function kpSaveCode(state) {
  const save = kpReadSave(state.game);
  save.code[state.level.title] = { ...state.codes };
  kpWriteSave(state.game, save);
}

// ——— Plansza ———

function kpPlace(world, x, y) {
  return `left: ${(x / world.cols) * 100}%; top: ${(y / world.rows) * 100}%`;
}

function kpNodeInner(node) {
  if (node.type === 'robot') return CG_ROBOT_SVG;
  if (node.type === 'button') return '<span class="kp-plate"></span>';
  if (node.type === 'door') return '<span class="kp-door-leaf"></span>';
  if (node.type === 'bridge') return '<span class="kp-planks"></span>';
  return `<span class="kp-icon">${KP_TYPES[node.type].icon}</span>`;
}

// Elementy planszy dla bieżącego świata — tworzone raz, potem kpSyncItems zmienia tylko klasy.
function kpBuildItems(state) {
  const { world, level } = state;
  state.items.innerHTML = world.nodes.map((node) => {
    const editable = node.file && level.scripts[node.file].edit;
    const robot = node.type === 'robot' ? ' cg-robot' : '';
    return `<span class="kp-node kp-${node.type}${robot}" data-node="${node.name}" style="${kpPlace(world, node.x, node.y)}" title="${node.name} — ${KP_TYPES[node.type].label}">${kpNodeInner(node)}${editable ? '<span class="kp-badge" aria-hidden="true">✎</span>' : ''}</span>`;
  }).join('');
  state.nodeEls = new Map([...state.items.querySelectorAll('.kp-node')].map((el) => [el.dataset.node, el]));
  state.robotEl = state.nodeEls.get('Robot');
  kpSyncItems(state);
}

function kpSyncItems(state) {
  const { world } = state;
  world.nodes.forEach((node) => {
    const el = state.nodeEls.get(node.name);
    if (!el) return;
    if (node !== world.robot) {
      el.style.left = `${(node.x / world.cols) * 100}%`;
      el.style.top = `${(node.y / world.rows) * 100}%`;
    }
    el.classList.toggle('is-freed', node.freed);
    el.classList.toggle('is-hidden', !node.visible);
    el.classList.toggle('is-open', node.type === 'door' && kpTruthy(node.members.get('is_open')));
    el.classList.toggle('is-pressed', kpIsPressed(world, node));
    el.classList.toggle('is-on', node.type === 'button' && kpTruthy(node.members.get('pressed')));
    el.classList.toggle('is-selected', state.selected === node.name);
  });
}

// Animacja robota po naciśnięciu klawisza: krok, skok, teleport albo odbicie od przeszkody.
function kpAnimateRobot(state, trace) {
  const { world } = state;
  const el = state.robotEl;
  const { robot } = world;
  if (!el || !robot) return;
  const moves = trace.filter((step) => step.kind !== 'bump' && step.kind !== 'free');
  const turn = [...trace].reverse().find((step) => step.dx);
  if (turn) el.classList.toggle('is-left', turn.dx < 0);
  const effect = moves.some((step) => step.kind === 'teleport') ? 'is-teleport' : moves.some((step) => step.kind === 'jump') ? 'is-jump' : '';
  el.classList.remove('is-teleport', 'is-jump', 'is-bump');
  if (effect || (!moves.length && trace.some((step) => step.kind === 'bump'))) {
    const bump = trace.find((step) => step.kind === 'bump');
    if (!effect) {
      el.style.setProperty('--bump-x', `${bump.dx * 30}%`);
      el.style.setProperty('--bump-y', `${bump.dy * 30}%`);
    }
    void el.offsetWidth;
    el.classList.add(effect || 'is-bump');
    clearTimeout(state.effectTimer);
    state.effectTimer = setTimeout(() => el.classList.remove('is-teleport', 'is-jump', 'is-bump'), 500);
  }
  el.style.left = `${(robot.x / world.cols) * 100}%`;
  el.style.top = `${(robot.y / world.rows) * 100}%`;
}

function kpRenderTree(state) {
  const { world, level } = state;
  state.body.querySelector('.kp-tree').innerHTML = `
    <li class="kp-tree-root"><span aria-hidden="true">🌳</span> Poziom <small>Node2D</small></li>
    ${world.nodes.map((node) => {
      const script = node.file ? level.scripts[node.file] : null;
      const mark = script ? `<span class="kp-tree-script${script.edit ? ' is-edit' : ''}" title="${node.file}">${script.edit ? '✎' : '📜'}</span>` : '';
      return `
        <li><button class="kp-tree-node${state.selected === node.name ? ' is-selected' : ''}${node.freed ? ' is-freed' : ''}" type="button" data-node="${node.name}">
          <span aria-hidden="true">${KP_TYPES[node.type].icon}</span><b>${node.name}</b><small>${KP_TYPES[node.type].cls}</small>${mark}
        </button></li>`;
    }).join('')}`;
}

function kpInspectValue(value) {
  return typeof value === 'string' ? `"${value}"` : kpFormat(value);
}

// Inspektor: właściwości zaznaczonego węzła. Zmienne ze skryptu widać, gdy scena działa.
function kpRenderInspector(state) {
  const node = state.world.byName.get(state.selected);
  const list = state.body.querySelector('.kp-inspector');
  if (!node) {
    list.innerHTML = '';
    return;
  }
  const rows = [['position', kpFormat(new KpVec(node.x, node.y))], ['visible', kpFormat(node.visible)]];
  node.members.forEach((value, key) => rows.push([key, kpInspectValue(value)]));
  list.innerHTML = `
    <div class="kp-inspector-head"><span aria-hidden="true">${KP_TYPES[node.type].icon}</span><b>${node.name}</b> <small>${KP_TYPES[node.type].cls}</small>${node.freed ? ' <em>usunięty</em>' : ''}</div>
    ${rows.map(([key, value]) => `<div class="kp-prop"><dt>${key}</dt><dd>${cgEscape(value)}</dd></div>`).join('')}
    ${!state.programs && node.file ? '<p class="kp-inspector-tip">Zmienne skryptu zobaczysz po uruchomieniu sceny ▶</p>' : ''}`;
}

function kpRenderGoals(state) {
  const { world, level } = state;
  const goals = [];
  const gems = world.nodes.filter((node) => node.type === 'gem').length;
  if (gems && level.countGems !== false) {
    const have = world.robot.members.get('gems');
    goals.push({ done: typeof have === 'number' && have >= gems, text: `Klejnoty: ${typeof have === 'number' ? have : 0} / ${gems} 💎` });
  }
  // Raz spełniony cel zostaje odhaczony do końca tej sceny.
  // Gdy choć raz zajdzie sytuacja z unless (np. drzwi otwarte bez klucza), cel jest zablokowany do końca sceny.
  world.goalsDone = world.goalsDone || new Set();
  world.goalsBroken = world.goalsBroken || new Set();
  (level.goals || []).forEach((goal, i) => {
    if (state.programs) {
      const unless = goal.unless && (Array.isArray(goal.unless[0]) ? goal.unless : [goal.unless]);
      if (unless && unless.some((set) => set.every((check) => kpGoalMet(world, check)))) world.goalsBroken.add(i);
      if (!world.goalsBroken.has(i) && goal.when.every((check) => kpGoalMet(world, check))) world.goalsDone.add(i);
    }
    goals.push({ done: world.goalsDone.has(i), text: goal.text });
  });
  goals.push({ done: world.won, text: 'Dojdź do mety 🏁' });
  state.goals.innerHTML = goals.map((goal) => `
    <li class="ng-goal${goal.done ? ' is-done' : ''}"><span class="ng-goal-mark" aria-hidden="true">${goal.done ? '✓' : ''}</span>${goal.text}</li>`).join('');
}

function kpRenderOutput(state) {
  const { output } = state.world;
  if (state.shownOutput > output.length) state.shownOutput = 0;
  if (!state.shownOutput) state.log.innerHTML = '';
  output.slice(state.shownOutput).forEach((entry) => {
    const line = document.createElement('div');
    line.className = `kp-log-line${entry.tone ? ` is-${entry.tone}` : ''}`;
    line.textContent = entry.text;
    state.log.append(line);
  });
  state.shownOutput = output.length;
  if (!state.log.childElementCount) state.log.innerHTML = '<div class="kp-log-line is-empty">Tu pojawi się to, co wypisze print().</div>';
  state.log.scrollTop = state.log.scrollHeight;
}

function kpSetStatus(state, text, tone) {
  state.status.textContent = text;
  state.status.className = `kp-status${tone ? ` is-${tone}` : ''}`;
}

function showBoardMessage(state, text, tone) {
  const message = state.body.querySelector('.fg-message');
  message.textContent = text;
  message.className = `fg-message is-${tone}`;
  clearTimeout(state.messageTimer);
  state.messageTimer = setTimeout(() => {
    message.textContent = '';
  }, 2000);
}

// ——— Uruchamianie sceny ———

function kpSetPlaying(state, playing) {
  state.playing = playing;
  state.body.classList.toggle('is-playing', playing);
  state.restartButton.disabled = !playing;
  state.playButton.innerHTML = playing ? '<span aria-hidden="true">■</span> Zatrzymaj' : '<span aria-hidden="true">▶</span> Uruchom scenę';
  state.playButton.title = playing ? 'F8' : 'F5';
}

function kpPlay(state) {
  if (state.won) return;
  let programs;
  try {
    programs = kpCompileAll(state.level, state.codes);
  } catch (error) {
    if (!(error instanceof KpError)) throw error;
    kpStop(state);
    kpShowError(state, error);
    return;
  }
  state.programs = programs;
  state.error = null;
  state.shownOutput = 0;
  try {
    state.world = kpCreateWorld(state.level, programs);
  } catch (error) {
    if (!(error instanceof KpError)) throw error;
    kpStop(state);
    kpShowError(state, error);
    return;
  }
  kpSetPlaying(state, true);
  kpBuildItems(state);
  kpUpdateEditor(state);
  kpSetStatus(state, `Scena działa! Steruj robotem: W A S D${state.level.jump ? ', Spacja to ui_accept' : ''}.`, 'run');
  document.activeElement?.blur();
  state.board.focus({ preventScroll: true });
  kpAfterStep(state);
}

// Zatrzymuje scenę i ustawia planszę na start (bez uruchamiania skryptów).
function kpStop(state, message) {
  kpSetPlaying(state, false);
  state.programs = null;
  state.world = kpCreateWorld(state.level, null);
  kpBuildItems(state);
  kpRenderTree(state);
  kpRenderInspector(state);
  kpRenderGoals(state);
  if (message) kpSetStatus(state, message, '');
}

function kpShowError(state, error) {
  state.error = { file: error.file, line: error.line };
  const owner = state.world.nodes.find((node) => node.file === error.file);
  kpSelect(state, owner ? owner.name : state.selected, error.file);
  kpSetStatus(state, `${error.file}, linia ${error.line}: ${error.message}`, 'bad');
  showBoardMessage(state, 'Błąd w skrypcie', 'bad');
}

function kpKeydown(event) {
  const state = boardGame;
  if (!state || !state.body.isConnected) return;
  if (event.key === 'F5' || event.key === 'F8') {
    event.preventDefault();
    if (event.key === 'F5') kpPlay(state);
    else if (state.playing) kpStop(state, 'Scena zatrzymana. Robot wrócił na start.');
    return;
  }
  if (!state.playing || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.target instanceof Element && event.target.closest('textarea, input, select')) return;
  const action = KP_KEY_ACTIONS[event.key.toLowerCase()];
  if (!action) return;
  event.preventDefault();
  kpFlashKey(state, action);
  kpHandlePress(state, action);
}

// Podświetla klawisz w podpowiedzi pod planszą, żeby było widać, co robi naciśnięcie.
function kpFlashKey(state, action) {
  const key = state.body.querySelector(`.kp-pad kbd[data-action="${action}"]`);
  if (!key) return;
  key.classList.remove('is-down');
  void key.offsetWidth;
  key.classList.add('is-down');
}

// Zwinięta karta „Nowe pojęcie” zostaje zwinięta po powrocie do poziomu.
function kpConceptKey(level) {
  return `kp-concept-closed:${level.concept.name}`;
}

function kpConceptClosed(level) {
  try {
    return localStorage.getItem(kpConceptKey(level)) === '1';
  } catch {
    return false;
  }
}

function kpSetConceptClosed(level, closed) {
  try {
    if (closed) localStorage.setItem(kpConceptKey(level), '1');
    else localStorage.removeItem(kpConceptKey(level));
  } catch {
    // Bez pamięci przeglądarki karta po prostu otworzy się następnym razem.
  }
}

function kpHandlePress(state, action) {
  if (!state.playing) return;
  const now = performance.now();
  if (now - state.lastPress < KP_PRESS_MS) return;
  state.lastPress = now;
  try {
    kpPress(state.world, action);
  } catch (error) {
    if (!(error instanceof KpError)) throw error;
    kpAfterStep(state, true);
    kpSetPlaying(state, false);
    kpShowError(state, error);
    return;
  }
  kpAfterStep(state);
}

// Pokazuje skutki kodu: ruch robota, elementy, wyjście print(), cele i inspektor.
function kpAfterStep(state, quiet) {
  const { world } = state;
  kpAnimateRobot(state, world.trace);
  world.trace = [];
  kpSyncItems(state);
  kpRenderTree(state);
  kpRenderInspector(state);
  kpRenderOutput(state);
  kpRenderGoals(state);
  if (quiet) return;
  if (world.restart) {
    kpPlay(state);
    return;
  }
  if (world.won) kpReachGoal(state);
}

function kpReachGoal(state) {
  kpSetPlaying(state, false);
  const failed = kpFailingCheck(state.level, state.programs);
  if (failed) {
    const { check, error } = failed;
    if (error) {
      kpShowError(state, error);
      kpSetStatus(state, `Robot doszedł do mety! Ale gdy sprawdziłem planszę jeszcze raz, pojawił się błąd — ${error.file}, linia ${error.line}: ${error.message}`, 'bad');
    } else {
      kpSetStatus(state, `Robot doszedł do mety! Ale gdy sprawdziłem planszę jeszcze raz, coś nie zadziałało: ${check.fail}`, 'bad');
    }
    showBoardMessage(state, 'Prawie!', 'bad');
    return;
  }
  winBoardLevel(state);
}

// ——— Wygrana, koniec gry ———

function winBoardLevel(state) {
  state.won = true;
  const { topic, index, game, levelIndex, level } = state;
  const save = kpReadSave(game);
  save.done[levelIndex] = true;
  save.code[level.title] = { ...state.codes };
  kpWriteSave(game, save);
  const last = levelIndex === game.levels.length - 1;
  const allDone = game.levels.every((_, i) => save.done[i]);
  const finish = last && allDone;
  setQuizProgress((levelIndex + 1) / game.levels.length);
  kpSetStatus(state, 'Udało się! Twoja plansza działa.', 'good');
  showBoardMessage(state, 'Brawo!', 'good');
  state.robotEl?.classList.add('is-happy');
  if (state.robotEl) burstFileGameConfetti(state.robotEl.getBoundingClientRect(), topic.accent);

  setTimeout(() => {
    if (boardGame !== state) return;
    const overlay = state.body.querySelector('.fg-overlay');
    const card = overlay.querySelector('.fg-overlay-card');
    card.innerHTML = `
      <div class="summary-icon" aria-hidden="true">${finish ? '🏆' : '🏁'}</div>
      <h2>${finish ? 'Wszystkie plansze zaprogramowane!' : 'Poziom ukończony!'}</h2>
      ${level.fact ? `<p class="ng-fact"><b>Czy wiesz?</b> ${level.fact}</p>` : ''}
      <div class="summary-actions">
        <button class="secondary-button kp-again" type="button">Zagraj jeszcze raz</button>
        <button class="primary-button quiz-finish" type="button">${finish ? `Odbierz ${game.reward} pkt` : last ? 'Wróć do poziomów' : 'Następny poziom'}</button>
      </div>
    `;
    card.querySelector('.kp-again').addEventListener('click', () => {
      overlay.hidden = true;
      state.won = false;
      state.robotEl?.classList.remove('is-happy');
      kpStop(state, 'Plansza gotowa. Uruchom scenę ▶ jeszcze raz.');
    });
    card.querySelector('.quiz-finish').addEventListener('click', () => {
      if (finish) finishBoardGame(state);
      else if (last) renderBoardGame(topic, index, game);
      else startBoardLevel(topic, index, game, levelIndex + 1);
    });
    overlay.hidden = false;
    card.querySelector('.quiz-finish').focus();
  }, 900);
}

function finishBoardGame(state) {
  const { topic, index, game } = state;
  stopBoardGame();
  const earned = Math.max(0, game.reward - readQuizBest(game.id));
  if (earned) {
    saveQuizBest(game.id, game.reward);
    saveStudentPoints(readStudentPoints() + earned);
  }
  completeLesson(topic, index);

  setQuizProgress(1);
  app.querySelector('#quiz-prompt').textContent = 'Brawo, gra ukończona!';
  app.querySelector('#quiz-hint').textContent = 'Programujesz jak w Godocie: węzły, sygnały, zmienne i sterowanie postacią. Tak powstają prawdziwe gry.';

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body quiz-summary';
  body.innerHTML = `
    <div class="summary-icon" aria-hidden="true">🏆</div>
    <div class="summary-stats">
      <div><strong>${game.levels.length}</strong><span>zaprogramowanych plansz</span></div>
      <div><strong>+${formatPoints(earned)}</strong><span>nowych punktów</span></div>
    </div>
    <div class="summary-actions">
      <button class="secondary-button quiz-retry" type="button">Wybierz poziom</button>
      <a class="primary-button quiz-finish" href="#/sciezka/${topic.slug}">Wróć do ścieżki <span aria-hidden="true">→</span></a>
    </div>
  `;
  body.querySelector('.quiz-retry').addEventListener('click', () => renderBoardGame(topic, index, game));
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
