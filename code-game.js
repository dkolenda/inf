// Gra „Kod Robota”: zagadki na planszy jak w code.org, ale dziecko WPISUJE program w podzbiorze GDScript
// (język silnika Godot). Robot zbiera kryształy 💎 i idzie do flagi 🚩.
// Własny interpreter (bez eval): podział na linie i tokeny → bloki z wcięć → drzewo poleceń →
// wykonanie jako generator kroków (każdy ruch robota to jeden krok animacji).
// Część „język” (cgCompile, cgCreateWorld, cgExecute, cgRunProgram) nie dotyka DOM — testuje się ją w node.
// Korzysta z funkcji app.js (setQuizProgress, completeLesson, saveStudentPoints…)
// oraz z burstFileGameConfetti z file-game.js.
let codeGame = null;

const CG_STEP_MS = 360;
const CG_TICK_LIMIT = 500;
const CG_CALL_DEPTH = 60;
const CG_STORAGE_KEY = 'informatyczna-przygoda:code-game';
const CG_TIRED = 'Robot się zmęczył — czy Twoja pętla kiedyś się kończy?';

const CG_ACTIONS = { move_right: [1, 0], move_left: [-1, 0], move_up: [0, -1], move_down: [0, 1] };
const CG_WALL_SENSORS = { is_wall_right: [1, 0], is_wall_left: [-1, 0], is_wall_up: [0, -1], is_wall_down: [0, 1] };
// Wbudowane funkcje robota i ile wartości przyjmują w nawiasach.
const CG_BUILTINS = {
  move_right: [0, 1], move_left: [0, 1], move_up: [0, 1], move_down: [0, 1], pick: [0, 0],
  is_wall_right: [0, 0], is_wall_left: [0, 0], is_wall_up: [0, 0], is_wall_down: [0, 0],
  is_gem: [0, 0], is_on_flag: [0, 0], read_sign: [0, 0], dig: [0, 0], range: [1, 2],
  value: [0, 0], value_right: [0, 0], swap: [0, 0], choose: [0, 0], go_to: [1, 1]
};
const CG_KEYWORDS = new Set([
  'func', 'var', 'extends', 'in', 'not', 'and', 'or', 'true', 'false', 'null', 'pass', 'return',
  'if', 'elif', 'else', 'for', 'while', 'break', 'continue'
]);
const CG_CONTROL = new Set(['if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'return', 'pass']);
const CG_HEADERS = new Set(['func', 'for', 'while', 'if', 'elif', 'else']);
const CG_ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=']);
const CG_COMPARE_OPS = new Set(['==', '!=', '<', '>', '<=', '>=']);
const CG_NAME = '[A-Za-z_\\u00C0-\\u017F][\\w\\u00C0-\\u017F]*';
const CG_TOKEN_RE = new RegExp(`[ \\t]*(?:(\\d+)|(${CG_NAME})|(->|:=|==|!=|<=|>=|\\+=|-=|\\*=|\\/=|%=|&&|\\|\\||[-+*/%<>=():,.!])|(["'])|(\\S))`, 'y');

const CG_ROBOT_SVG = `
  <svg viewBox="0 0 40 40" aria-hidden="true">
    <line x1="20" y1="3.5" x2="20" y2="9" stroke="#5b6b8a" stroke-width="2" stroke-linecap="round" />
    <circle class="cg-robot-lamp" cx="20" cy="3.5" r="2.6" fill="#ff4b4b" />
    <rect x="5" y="27" width="5" height="3.4" rx="1.7" fill="#1cb0f6" />
    <rect x="30" y="27" width="5" height="3.4" rx="1.7" fill="#1cb0f6" />
    <rect x="11" y="25" width="18" height="10" rx="3.5" fill="#1189c4" />
    <circle cx="20" cy="30" r="2.2" fill="#ffc800" />
    <rect x="11" y="34.5" width="7" height="3.6" rx="1.8" fill="#3c4b55" />
    <rect x="22" y="34.5" width="7" height="3.6" rx="1.8" fill="#3c4b55" />
    <rect x="7.5" y="8" width="25" height="18.5" rx="6.5" fill="#1cb0f6" stroke="#1189c4" stroke-width="1.6" />
    <rect x="11" y="11.3" width="18" height="11.4" rx="4.5" fill="#e8f7ff" />
    <g class="cg-robot-eyes">
      <circle cx="16" cy="16.2" r="2.3" fill="#25323b" />
      <circle cx="24" cy="16.2" r="2.3" fill="#25323b" />
      <circle cx="16.8" cy="15.4" r="0.8" fill="#fff" />
      <circle cx="24.8" cy="15.4" r="0.8" fill="#fff" />
    </g>
    <path d="M17 19.6 q3 2.2 6 0" stroke="#25323b" stroke-width="1.4" fill="none" stroke-linecap="round" />
  </svg>`;

// ——— Język: błędy, tokeny, wcięcia ———

class CgError extends Error {
  constructor(line, message, bump) {
    super(message);
    this.line = line;
    this.bump = bump || null;
  }
}

function cgFail(line, message, bump) {
  throw new CgError(line, message, bump);
}

function cgIsOp(token, value) {
  return Boolean(token) && token.type === 'op' && token.value === value;
}

function cgIsWord(token, value) {
  return Boolean(token) && token.type === 'name' && token.value === value;
}

function cgTokenize(text, line) {
  const tokens = [];
  CG_TOKEN_RE.lastIndex = 0;
  while (CG_TOKEN_RE.lastIndex < text.length) {
    const match = CG_TOKEN_RE.exec(text);
    if (!match) break;
    if (match[1]) tokens.push({ type: 'num', value: match[1] });
    else if (match[2]) tokens.push({ type: 'name', value: match[2] });
    else if (match[3]) tokens.push({ type: 'op', value: match[3] });
    else if (match[4]) cgFail(line, 'W tej grze nie potrzeba cudzysłowów. Wpisz samą nazwę polecenia albo liczbę.');
    else cgFail(line, `Nieznany znak „${match[5]}”. Sprawdź, czy nie ma tu literówki.`);
  }
  return tokens;
}

// Dzieli kod na niepuste linie z poziomem wcięcia. Wcięcie to Tab albo 4 spacje — w całym programie tak samo.
function cgSplitLines(source) {
  const lines = [];
  let style = null;
  source.replace(/\r/g, '').split('\n').forEach((text, i) => {
    const line = i + 1;
    const code = text.split('#')[0];
    if (!code.trim()) return;
    const lead = code.match(/^[ \t]*/)[0];
    let level = 0;
    if (lead) {
      if (lead.includes('\t') && lead.includes(' ')) {
        cgFail(line, 'We wcięciu są pomieszane Tab i spacje. Usuń je i wciśnij sam Tab.');
      }
      const kind = lead[0] === '\t' ? 'tab' : 'space';
      style = style || kind;
      if (kind !== style) {
        cgFail(line, style === 'tab'
          ? 'Tu wcięcie jest ze spacji, a wyżej z Tab. Używaj wszędzie tego samego — najlepiej klawisza Tab.'
          : 'Tu wcięcie jest z Tab, a wyżej ze spacji. Używaj wszędzie tego samego.');
      }
      if (kind === 'space' && lead.length % 4) cgFail(line, 'Wcięcie ze spacji musi mieć po 4 spacje na poziom. Najprościej wciśnij Tab.');
      level = kind === 'tab' ? lead.length : lead.length / 4;
    }
    lines.push({ line, level, text: code.trim(), tokens: cgTokenize(code.slice(lead.length), line) });
  });
  return lines;
}

function cgCountLines(source) {
  return source.replace(/\r/g, '').split('\n').filter((text) => text.split('#')[0].trim()).length;
}

function cgDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

// Najbardziej podobna nazwa (literówka, wielka litera, brak podkreślnika) albo ''.
function cgSuggest(name, candidates) {
  let best = '';
  let bestScore = Infinity;
  const lower = name.toLowerCase();
  candidates.forEach((candidate) => {
    const score = cgDistance(lower, candidate.toLowerCase());
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  });
  return bestScore <= Math.max(2, Math.floor(name.length / 3)) ? best : '';
}

// ——— Język: wyrażenia ———

function cgCheckParens(tokens, line) {
  let depth = 0;
  tokens.forEach((token) => {
    if (cgIsOp(token, '(')) depth += 1;
    if (cgIsOp(token, ')')) depth -= 1;
    if (depth < 0) cgFail(line, 'Za dużo nawiasów zamykających „)”.');
  });
  if (depth > 0) cgFail(line, 'Brakuje nawiasu zamykającego „)”.');
}

// Parsuje całe tokens[from…to) jako jedno wyrażenie.
function cgParseExpr(tokens, line, known, from = 0, to = tokens.length) {
  const list = tokens.slice(from, to);
  let pos = 0;
  const peek = () => list[pos];
  const next = () => list[pos++];

  function parseOr() {
    let left = parseAnd();
    while (cgIsWord(peek(), 'or') || cgIsOp(peek(), '||')) {
      next();
      left = { type: 'or', left, right: parseAnd() };
    }
    return left;
  }
  function parseAnd() {
    let left = parseNot();
    while (cgIsWord(peek(), 'and') || cgIsOp(peek(), '&&')) {
      next();
      left = { type: 'and', left, right: parseNot() };
    }
    return left;
  }
  function parseNot() {
    if (cgIsWord(peek(), 'not') || cgIsOp(peek(), '!')) {
      next();
      return { type: 'not', arg: parseNot() };
    }
    return parseCompare();
  }
  function parseCompare() {
    const left = parseSum();
    const token = peek();
    if (token && token.type === 'op' && CG_COMPARE_OPS.has(token.value)) {
      next();
      return { type: 'bin', op: token.value, left, right: parseSum(), line };
    }
    if (cgIsOp(token, '=')) cgFail(line, 'Do porównania używamy dwóch znaków „==”, np. if steps == 3:');
    return left;
  }
  function parseSum() {
    let left = parseTerm();
    while (cgIsOp(peek(), '+') || cgIsOp(peek(), '-')) {
      const op = next().value;
      left = { type: 'bin', op, left, right: parseTerm(), line };
    }
    return left;
  }
  function parseTerm() {
    let left = parseUnary();
    while (cgIsOp(peek(), '*') || cgIsOp(peek(), '/') || cgIsOp(peek(), '%')) {
      const op = next().value;
      left = { type: 'bin', op, left, right: parseUnary(), line };
    }
    return left;
  }
  function parseUnary() {
    if (cgIsOp(peek(), '-')) {
      next();
      return { type: 'neg', arg: parseUnary(), line };
    }
    if (cgIsOp(peek(), '+')) next();
    return parsePrimary();
  }
  function parsePrimary() {
    const token = next();
    if (!token) cgFail(line, 'Tu czegoś brakuje — linia urywa się w połowie.');
    if (token.type === 'num') return { type: 'num', value: Number(token.value) };
    if (cgIsOp(token, '(')) {
      const inner = parseOr();
      if (!cgIsOp(peek(), ')')) cgFail(line, 'Brakuje nawiasu zamykającego „)”.');
      next();
      return inner;
    }
    if (token.type !== 'name') cgFail(line, `Nie rozumiem „${token.value}” w tym miejscu.`);
    const name = token.value;
    if (name === 'true' || name === 'false') return { type: 'value', value: name === 'true' };
    if (name === 'null') return { type: 'value', value: null };
    if (CG_KEYWORDS.has(name)) cgFail(line, `Słowo „${name}” nie pasuje w tym miejscu.`);
    if (name === 'position') {
      if (!cgIsOp(peek(), '.')) cgFail(line, 'Napisz position.x albo position.y.');
      next();
      const axis = next();
      if (!axis || (axis.value !== 'x' && axis.value !== 'y')) cgFail(line, 'Po „position.” napisz x albo y.');
      return { type: 'pos', axis: axis.value };
    }
    if (cgIsOp(peek(), '(')) {
      next();
      const args = [];
      if (!cgIsOp(peek(), ')')) {
        args.push(parseOr());
        while (cgIsOp(peek(), ',')) {
          next();
          args.push(parseOr());
        }
      }
      if (!cgIsOp(peek(), ')')) cgFail(line, 'Brakuje nawiasu zamykającego „)”.');
      next();
      return { type: 'call', name, args, line };
    }
    if (cgIsOp(peek(), '.')) cgFail(line, `Nie znam „${name}.” — robot rozumie tylko position.x i position.y.`);
    if (CG_BUILTINS[name] || known.funcs.has(name)) cgFail(line, `Po ${name} brakuje nawiasów — napisz ${name}()`);
    return { type: 'name', name, line };
  }

  if (!list.length) cgFail(line, 'Tu czegoś brakuje — linia urywa się w połowie.');
  const node = parseOr();
  if (pos < list.length) cgLeftover(list, pos, line);
  return node;
}

function cgLeftover(list, pos, line) {
  const token = list[pos];
  const previous = list[pos - 1];
  if (token.type === 'name' && previous && previous.type === 'name') {
    cgFail(line, `W nazwie nie może być spacji. Słowa łączymy podkreślnikiem, np. ${previous.value}_${token.value}`);
  }
  if (token.type === 'name' && cgIsOp(previous, ')')) cgFail(line, 'W jednej linii piszemy jedno polecenie. Przenieś resztę do nowej linii.');
  cgFail(line, `Nie rozumiem „${token.value}” w tym miejscu.`);
}

// ——— Język: polecenia i bloki ———

function cgUnknownCommand(name, line, known) {
  const suggestion = cgSuggest(name, [...Object.keys(CG_BUILTINS), ...known.funcs]);
  cgFail(line, `Nie znam polecenia „${name}”.${suggestion ? ` Czy chodziło o ${suggestion}()?` : ''}`);
}

function cgParseHeader(word, tokens, line, known, depth) {
  if (word === 'func') {
    if (depth > 0) cgFail(line, 'func piszemy na początku linii, bez wcięcia.');
    const name = tokens[1];
    if (!name || name.type !== 'name') cgFail(line, 'Po func podaj nazwę funkcji, np. func skok():');
    if (CG_BUILTINS[name.value]) cgFail(line, `${name.value} to wbudowane polecenie robota. Wymyśl dla swojej funkcji inną nazwę.`);
    if (CG_KEYWORDS.has(name.value)) cgFail(line, `„${name.value}” to słowo GDScript — wymyśl inną nazwę funkcji.`);
    if (!cgIsOp(tokens[2], '(')) cgFail(line, `Po nazwie funkcji brakuje nawiasów: func ${name.value}():`);
    const params = [];
    let pos = 3;
    while (tokens[pos] && !cgIsOp(tokens[pos], ')')) {
      if (tokens[pos].type !== 'name' || CG_KEYWORDS.has(tokens[pos].value)) cgFail(line, 'W nawiasach po nazwie funkcji wpisz nazwy, np. func idz(ile):');
      params.push(tokens[pos].value);
      pos += 1;
      if (cgIsOp(tokens[pos], ',')) pos += 1;
    }
    pos += 1;
    if (cgIsOp(tokens[pos], '->') && tokens[pos + 1]?.type === 'name') pos += 2;
    if (pos < tokens.length) cgFail(line, `Nie rozumiem „${tokens[pos].value}” w tej linii.`);
    return { type: 'func', name: name.value, params, line };
  }
  if (word === 'for') {
    if (tokens[1]?.type !== 'name' || CG_KEYWORDS.has(tokens[1].value) || !cgIsWord(tokens[2], 'in')) {
      cgFail(line, 'Pętlę for piszemy tak: for i in 5:');
    }
    if (tokens.length === 3) cgFail(line, 'Po in napisz, ile razy powtórzyć, np. for i in 5:');
    return { type: 'for', name: tokens[1].value, iter: cgParseExpr(tokens, line, known, 3), line };
  }
  if (word === 'else') {
    if (cgIsWord(tokens[1], 'if')) cgFail(line, 'W GDScript zamiast „else if” piszemy „elif”.');
    if (tokens.length > 1) cgFail(line, 'Po else od razu stawiamy dwukropek: else:');
    return { type: 'else', line };
  }
  if (tokens.length === 1) {
    cgFail(line, word === 'while' ? 'Po while napisz warunek, np. while not is_on_flag():' : `Po ${word} napisz warunek, np. ${word} is_gem():`);
  }
  return { type: word, cond: cgParseExpr(tokens, line, known, 1), line };
}

function cgParseSimple(tokens, line, known, scope, depth) {
  const first = tokens[0];
  const word = first.type === 'name' ? first.value : '';
  if (CG_HEADERS.has(word)) cgFail(line, 'Po dwukropku zacznij nową linię i napisz to z wcięciem.');

  if (word === 'var') {
    const name = tokens[1];
    if (!name || name.type !== 'name' || CG_KEYWORDS.has(name.value)) cgFail(line, 'Po var podaj nazwę zmiennej, np. var steps = 1');
    if (CG_BUILTINS[name.value] || known.funcs.has(name.value)) cgFail(line, `${name.value} to nazwa polecenia. Wymyśl dla zmiennej inną nazwę.`);
    if (name.value === 'position') cgFail(line, 'position już istnieje — to pozycja robota. Wymyśl inną nazwę.');
    if (tokens.length === 2) return { type: 'var', name: name.value, value: null, line };
    if (!cgIsOp(tokens[2], '=') && !cgIsOp(tokens[2], ':=')) cgFail(line, `Zmienną tworzymy tak: var ${name.value} = 1`);
    if (tokens.length === 3) cgFail(line, `Po „=” wpisz wartość, np. var ${name.value} = 1`);
    return { type: 'var', name: name.value, value: cgParseExpr(tokens, line, known, 3), line };
  }
  if (word === 'pass' || word === 'break' || word === 'continue') {
    if (tokens.length > 1) cgFail(line, `Po ${word} nic już nie piszemy w tej linii.`);
    if (word !== 'pass' && !scope.loops) cgFail(line, `${word} działa tylko wewnątrz pętli for albo while.`);
    return { type: word, line };
  }
  if (word === 'return') {
    if (!scope.inFunc) cgFail(line, 'return działa tylko wewnątrz funkcji.');
    return { type: 'return', value: tokens.length > 1 ? cgParseExpr(tokens, line, known, 1) : null, line };
  }
  if (word === 'extends') {
    if (depth > 0 || tokens[1]?.type !== 'name' || tokens.length > 2) cgFail(line, 'extends piszemy na początku programu, np. extends Node2D');
    return { type: 'extends', line };
  }

  const assignAt = tokens.findIndex((token) => token.type === 'op' && CG_ASSIGN_OPS.has(token.value));
  if (assignAt === 0) cgFail(line, 'Przed „=” brakuje nazwy zmiennej.');
  if (assignAt > 0) {
    const op = tokens[assignAt].value;
    if (assignAt === tokens.length - 1) cgFail(line, `Po „${op}” wpisz wartość.`);
    const value = cgParseExpr(tokens, line, known, assignAt + 1);
    const target = tokens.slice(0, assignAt);
    if (cgIsWord(target[0], 'position')) {
      if (target.length !== 3 || !cgIsOp(target[1], '.') || (target[2].value !== 'x' && target[2].value !== 'y')) {
        cgFail(line, 'Napisz position.x albo position.y, np. position.x += 1');
      }
      if (op !== '+=' && op !== '-=') cgFail(line, `Robot chodzi krok po kroku po kratkach. Napisz position.${target[2].value} += 1 albo position.${target[2].value} -= 1`);
      return { type: 'move', axis: target[2].value, sign: op === '+=' ? 1 : -1, value, line };
    }
    if (target.length !== 1 || target[0].type !== 'name' || CG_KEYWORDS.has(target[0].value)) {
      cgFail(line, `Po lewej stronie „${op}” musi stać nazwa zmiennej.`);
    }
    const name = target[0].value;
    if (CG_BUILTINS[name] || known.funcs.has(name)) cgFail(line, `${name} to polecenie, nie zmienna. Napisz ${name}()`);
    return { type: 'assign', name, op, value, line };
  }

  const expr = cgParseExpr(tokens, line, known);
  if (expr.type === 'call') return { type: 'expr', expr, line };
  if (expr.type === 'name') {
    if (known.vars.has(expr.name)) cgFail(line, `Ta linia nic nie robi — „${expr.name}” to zmienna, a nie polecenie.`);
    cgUnknownCommand(expr.name, line, known);
  }
  cgFail(line, 'Ta linia nic nie robi. Wpisz polecenie, np. move_right()');
}

function cgParseLine(entry, known, scope, depth) {
  const { tokens, line } = entry;
  const first = tokens[0];
  const word = first.type === 'name' ? first.value : '';
  if (word && !CG_KEYWORDS.has(word) && CG_KEYWORDS.has(word.toLowerCase())) {
    cgFail(line, `W GDScript słowa piszemy małymi literami: ${word.toLowerCase()}`);
  }
  cgCheckParens(tokens, line);
  const colon = tokens.findIndex((token) => cgIsOp(token, ':'));
  if (CG_HEADERS.has(word)) {
    if (colon === -1) cgFail(line, `Na końcu linii z „${word}” brakuje dwukropka „:”.`);
    const stmt = cgParseHeader(word, tokens.slice(0, colon), line, known, depth);
    stmt.header = entry.text.split(':')[0].trim() + ':';
    stmt.inline = colon < tokens.length - 1 ? tokens.slice(colon + 1) : null;
    return stmt;
  }
  if (colon !== -1) cgFail(line, 'Dwukropek „:” stawiamy tylko na końcu linii z for, while, if, elif, else albo func.');
  return cgParseSimple(tokens, line, known, scope, depth);
}

function cgParseBlocks(lines, known) {
  let i = 0;

  function parseBlock(depth, scope) {
    const body = [];
    while (i < lines.length && lines[i].level >= depth) {
      const entry = lines[i];
      if (entry.level > depth) cgFail(entry.line, 'Niepotrzebne wcięcie. Wcięcie robimy tylko pod linią, która kończy się dwukropkiem „:”.');
      i += 1;
      const stmt = cgParseLine(entry, known, scope, depth);
      if (stmt.header) {
        const loop = stmt.type === 'for' || stmt.type === 'while';
        const inner = stmt.type === 'func' ? { inFunc: true, loops: 0 } : { ...scope, loops: scope.loops + (loop ? 1 : 0) };
        const next = lines[i];
        if (stmt.inline) {
          stmt.body = [cgParseSimple(stmt.inline, entry.line, known, inner, depth + 1)];
        } else if (next && next.level === depth + 1) {
          stmt.body = parseBlock(depth + 1, inner);
        } else if (next && next.level > depth + 1) {
          cgFail(next.line, 'Za duże wcięcie — o jeden Tab za dużo.');
        } else if (next && next.level === depth && !['elif', 'else', 'func'].includes(next.tokens[0].value)) {
          cgFail(next.line, `Brakuje wcięcia. Polecenia wewnątrz „${stmt.header}” przesuń klawiszem Tab.`);
        } else {
          cgFail(entry.line, `Pod „${stmt.header}” brakuje poleceń z wcięciem (Tab).`);
        }
      }
      if (stmt.type === 'elif' || stmt.type === 'else') {
        const previous = body[body.length - 1];
        if (!previous || previous.type !== 'if' || previous.elseBody) {
          cgFail(entry.line, `„${stmt.type}” musi stać zaraz pod blokiem „if”, z takim samym wcięciem jak „if”.`);
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

  if (lines.length && lines[0].level > 0) cgFail(lines[0].line, 'Pierwsza linia programu nie może mieć wcięcia.');
  return parseBlock(0, { inFunc: false, loops: 0 });
}

// Sprawdza wywołania: czy polecenie istnieje, ile ma wartości w nawiasach i czy wolno go użyć na tym poziomie.
function cgValidate(program, level, known) {
  const forbid = new Set(level.forbid || []);
  const visitExpr = (node) => {
    if (!node) return;
    if (node.type === 'call') {
      const builtin = CG_BUILTINS[node.name];
      const user = program.funcs[node.name];
      if (!builtin && !user) cgUnknownCommand(node.name, node.line, known);
      if (forbid.has(node.name)) {
        const msg = CG_ACTIONS[node.name]
          ? `Polecenie ${node.name}() zostało usunięte przez błąd. Zamiast niego napisz ${cgPositionHint(node.name)}`
          : `Na tym poziomie nie używamy ${node.name}().`;
        cgFail(node.line, msg);
      }
      // Liczbę kroków w nawiasach, np. move_right(5), poznaje się na poziomie z level.moveSteps.
      if (CG_ACTIONS[node.name] && node.args.length && !level.moveSteps) {
        cgFail(node.line, `Na tym poziomie ${node.name}() robi zawsze jeden krok — zostaw puste nawiasy: ${node.name}()`);
      }
      const [min, max] = builtin || [user.params.length, user.params.length];
      if (node.args.length < min || node.args.length > max) {
        cgFail(node.line, max === 0
          ? `${node.name}() nie potrzebuje niczego w nawiasach.`
          : `${node.name}() potrzebuje w nawiasach ${min === max ? min : `${min}–${max}`} ${min === 1 && max === 1 ? 'wartość' : 'wartości'}, a dostało ${node.args.length}.`);
      }
      node.args.forEach(visitExpr);
      return;
    }
    ['left', 'right', 'arg'].forEach((key) => visitExpr(node[key]));
  };
  const visitBlock = (list) => list.forEach((stmt) => {
    [stmt.expr, stmt.value, stmt.cond, stmt.iter].forEach(visitExpr);
    (stmt.branches || []).forEach((branch) => {
      visitExpr(branch.cond);
      visitBlock(branch.body);
    });
    if (stmt.elseBody) visitBlock(stmt.elseBody);
    if (stmt.body && stmt.type !== 'if') visitBlock(stmt.body);
  });
  visitBlock(program.top);
  Object.values(program.funcs).forEach((func) => visitBlock(func.body));
}

function cgPositionHint(name) {
  return { move_right: 'position.x += 1', move_left: 'position.x -= 1', move_up: 'position.y -= 1', move_down: 'position.y += 1' }[name];
}

// Kod → program albo wyjątek CgError z numerem linii.
function cgCompile(source, level = {}) {
  const known = { funcs: new Set(), vars: new Set() };
  source.split('\n').forEach((text) => {
    const code = text.split('#')[0];
    const func = code.match(new RegExp(`^\\s*func\\s+(${CG_NAME})`));
    if (func) known.funcs.add(func[1]);
    for (const match of code.matchAll(new RegExp(`\\b(?:var|for)\\s+(${CG_NAME})`, 'g'))) known.vars.add(match[1]);
  });

  const lines = cgSplitLines(source);
  if (!lines.length) cgFail(1, 'Napisz najpierw jakieś polecenie dla robota.');
  const statements = cgParseBlocks(lines, known);
  const program = { top: [], funcs: {} };
  statements.forEach((stmt) => {
    if (stmt.type !== 'func') {
      program.top.push(stmt);
      return;
    }
    if (program.funcs[stmt.name]) cgFail(stmt.line, `Funkcja ${stmt.name}() jest już napisana wyżej. Każda funkcja musi mieć inną nazwę.`);
    program.funcs[stmt.name] = stmt;
  });

  const ready = program.funcs._ready;
  if (ready && ready.params.length) cgFail(ready.line, 'func _ready() nie ma niczego w nawiasach: func _ready():');
  if (level.ready) {
    if (!ready) cgFail(lines[0].line, 'Brakuje „func _ready():” — w Godocie od tej funkcji zaczyna się program.');
    const outside = program.top.find((stmt) => !['var', 'extends', 'pass'].includes(stmt.type));
    if (outside) cgFail(outside.line, 'Ta linia jest poza funkcją. Przenieś ją pod func _ready(): i przesuń klawiszem Tab.');
  }
  if (!ready && !program.top.some((stmt) => !['var', 'extends', 'pass'].includes(stmt.type))) {
    cgFail(lines[0].line, 'Program nic nie każe robotowi zrobić. Dopisz polecenia albo func _ready():');
  }
  cgValidate(program, level, known);
  return program;
}

// ——— Świat: plansza i robot ———
// Mapa: # ściana, . podłoga, R robot, G kryształ, F flaga, S tabliczka, ~ most we mgle, B skrzynka z liczbą.
// Poziom z level.sign = { min, max }: tabliczka pokazuje losową liczbę n, a skarb jest zakopany
// na n-tym polu mostu (~ licząc od lewej). Robot czyta ją read_sign(), stojąc na niej, i kopie dig().
// Skrzynki leżą rząd niżej niż droga robota: value() czyta skrzynkę pod robotem, value_right() — tę
// obok z prawej, swap() zamienia je miejscami, choose() wybiera skrzynkę pod robotem.
// level.boxes — tablica liczb albo { max, sorted }: losowe różne liczby od 1 do max.
// level.sign = { box: true } — tabliczka pokazuje liczbę z jednej ze skrzynek.
// level.goal — 'sorted' (od najmniejszej), 'maxLast' (największa na końcu), 'minFirst' (najmniejsza na początku),
// 'min' (wybierz najmniejszą), 'sign' (wybierz liczbę z tabliczki). level.hidden — skrzynki są zamknięte, value() otwiera je
// (najwyżej level.maxOpen). level.maxMoves — najwięcej kroków robota, level.wave — na polach widać
// odległość od startu. setup = { sign, boxes } ustala liczby (testy, ponowne uruchomienie), inaczej są losowe.

function cgCreateWorld(level, setup = {}) {
  const world = { cols: level.map[0].length, rows: level.map.length, walls: new Set(), gems: new Set(), flag: null, robot: null, picked: 0, moves: 0 };
  const fog = [];
  const boxCells = [];
  level.map.forEach((row, y) => [...row].forEach((char, x) => {
    const cell = `${x},${y}`;
    if (char === '#') world.walls.add(cell);
    if (char === 'G') world.gems.add(cell);
    if (char === 'F') world.flag = { x, y };
    if (char === 'R') world.robot = { x, y };
    if (char === 'S') world.sign = { x, y };
    if (char === '~') fog.push({ x, y });
    if (char === 'B') boxCells.push({ x, y });
  }));
  world.totalGems = world.gems.size;
  world.start = { ...world.robot };
  if (boxCells.length) {
    const values = setup.boxes || cgMakeBoxes(level, boxCells.length, Math.random, true);
    world.boxValues = values;
    world.boxes = new Map(boxCells.map(({ x, y }, id) => [`${x},${y}`, { id, x, y, value: values[id], open: !level.hidden }]));
    world.opened = 0;
    world.chosen = false;
  }
  if (level.sign) {
    world.sign.shown = false;
    if (level.sign.box) {
      world.sign.value = setup.sign ?? world.boxValues[Math.floor(Math.random() * world.boxValues.length)];
    } else {
      const { min, max } = level.sign;
      world.sign.value = setup.sign ?? min + Math.floor(Math.random() * (max - min + 1));
      world.treasure = { ...fog[world.sign.value - 1], dug: false };
    }
  }
  return world;
}

// Liczby na skrzynkach. Do pokazania (fresh) nie bierze ułożenia, które już spełnia cel poziomu.
function cgMakeBoxes(level, count, random, fresh) {
  if (Array.isArray(level.boxes)) return [...level.boxes];
  const { max, sorted } = level.boxes;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const pool = Array.from({ length: max }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const values = pool.slice(0, count);
    if (sorted) return values.sort((a, b) => a - b);
    if (!fresh || !cgBoxGoalDone(level.goal, values)) return values;
  }
  return Array.from({ length: count }, (_, i) => count - i);
}

function cgBoxGoalDone(goal, values) {
  if (goal === 'sorted') return values.every((value, i) => !i || values[i - 1] < value);
  if (goal === 'maxLast') return values[values.length - 1] === Math.max(...values);
  if (goal === 'minFirst') return values[0] === Math.min(...values);
  return false;
}

// Liczby na skrzynkach od lewej do prawej.
function cgBoxRow(world) {
  return [...world.boxes.values()].sort((a, b) => a.x - b.x).map((box) => box.value);
}

function cgBlocked(world, x, y) {
  return x < 0 || y < 0 || x >= world.cols || y >= world.rows || world.walls.has(`${x},${y}`);
}

function cgOnFlag(world) {
  return Boolean(world.flag) && world.robot.x === world.flag.x && world.robot.y === world.flag.y;
}

// Plansza bez flagi (poziom ze skarbem) kończy się, gdy skarb jest wykopany.
function cgGoalReached(world, level = {}) {
  if (world.boxes && level.goal) {
    const chosen = level.goal === 'min' || level.goal === 'sign';
    if (!(chosen ? world.chosen : cgBoxGoalDone(level.goal, cgBoxRow(world)))) return false;
  }
  return !world.gems.size && (!world.treasure || world.treasure.dug) && (!world.flag || cgOnFlag(world));
}

// ——— Wykonanie: generator kroków ———

const CG_BREAK = { signal: 'break' };
const CG_CONTINUE = { signal: 'continue' };

class CgReturn {
  constructor(value) {
    this.value = value;
  }
}

// Licznik kroków programu. Przy przekroczeniu błąd wskazuje najgłębszą działającą pętlę.
function cgTick(ctx, line) {
  ctx.ticks += 1;
  if (ctx.ticks > ctx.limit) cgFail(ctx.loops.length ? ctx.loops[ctx.loops.length - 1] : line, CG_TIRED);
}

function* cgExecute(program, world, options = {}, level = {}) {
  const ctx = { program, world, level, ticks: 0, limit: options.limit || CG_TICK_LIMIT, depth: 0, loops: [], globals: new Map() };
  const top = { ctx, locals: ctx.globals };
  yield* cgExecBlock(program.top, top);
  if (program.funcs._ready) yield* cgCallUser(program.funcs._ready, [], top, program.funcs._ready.line);
}

function* cgExecBlock(list, frame) {
  for (const stmt of list) yield* cgExecStmt(stmt, frame);
}

function* cgExecLoopBody(body, frame) {
  try {
    yield* cgExecBlock(body, frame);
  } catch (signal) {
    if (signal === CG_BREAK) return false;
    if (signal !== CG_CONTINUE) throw signal;
  }
  return true;
}

function* cgExecStmt(stmt, frame) {
  const { ctx } = frame;
  cgTick(ctx, stmt.line);
  switch (stmt.type) {
    case 'expr':
      yield* cgEval(stmt.expr, frame);
      return;
    case 'var':
      frame.locals.set(stmt.name, stmt.value ? yield* cgEval(stmt.value, frame) : null);
      return;
    case 'assign': {
      const scope = frame.locals.has(stmt.name) ? frame.locals : ctx.globals.has(stmt.name) ? ctx.globals : null;
      if (!scope) cgFail(stmt.line, `Nie ma jeszcze zmiennej „${stmt.name}”. Utwórz ją najpierw: var ${stmt.name} = 0`);
      const value = yield* cgEval(stmt.value, frame);
      scope.set(stmt.name, stmt.op === '=' ? value : cgArithmetic(stmt.op[0], scope.get(stmt.name), value, stmt.line));
      return;
    }
    case 'move': {
      const steps = yield* cgEval(stmt.value, frame);
      if (!Number.isInteger(steps)) cgFail(stmt.line, `Po position.${stmt.axis} += musi być liczba kratek, np. 1.`);
      const delta = Math.sign(steps * stmt.sign);
      for (let i = 0; i < Math.abs(steps); i += 1) {
        yield* cgMove(ctx, stmt.axis === 'x' ? delta : 0, stmt.axis === 'y' ? delta : 0, stmt.line);
      }
      return;
    }
    case 'if':
      for (const branch of stmt.branches) {
        if (cgTruthy(yield* cgEval(branch.cond, frame))) {
          yield* cgExecBlock(branch.body, frame);
          return;
        }
      }
      if (stmt.elseBody) yield* cgExecBlock(stmt.elseBody, frame);
      return;
    case 'for': {
      const iter = yield* cgEval(stmt.iter, frame);
      let items = iter;
      if (typeof iter === 'number' && Number.isInteger(iter)) items = Array.from({ length: Math.max(0, iter) }, (_, i) => i);
      if (!Array.isArray(items)) cgFail(stmt.line, 'Po in musi być liczba powtórzeń, np. for i in 5:');
      ctx.loops.push(stmt.line);
      try {
        for (const item of items) {
          cgTick(ctx, stmt.line);
          frame.locals.set(stmt.name, item);
          if (!(yield* cgExecLoopBody(stmt.body, frame))) break;
        }
      } finally {
        ctx.loops.pop();
      }
      return;
    }
    case 'while':
      ctx.loops.push(stmt.line);
      try {
        for (;;) {
          cgTick(ctx, stmt.line);
          if (!cgTruthy(yield* cgEval(stmt.cond, frame))) break;
          if (!(yield* cgExecLoopBody(stmt.body, frame))) break;
        }
      } finally {
        ctx.loops.pop();
      }
      return;
    case 'break':
      throw CG_BREAK;
    case 'continue':
      throw CG_CONTINUE;
    case 'return':
      throw new CgReturn(stmt.value ? yield* cgEval(stmt.value, frame) : null);
    default:
      // pass, extends — nic nie robią.
  }
}

function cgTruthy(value) {
  return Boolean(value);
}

function cgArithmetic(op, a, b, line) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    cgFail(line, a === null || b === null ? 'Zmienna nie ma jeszcze wartości. Nadaj ją, np. var steps = 1' : 'Tu potrzebne są liczby.');
  }
  if ((op === '/' || op === '%') && b === 0) cgFail(line, 'Nie można dzielić przez zero.');
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  if (op === '/') return Math.trunc(a / b);
  return a % b;
}

function* cgEval(node, frame) {
  const { ctx } = frame;
  switch (node.type) {
    case 'num':
    case 'value':
      return node.value;
    case 'name': {
      if (frame.locals.has(node.name)) return frame.locals.get(node.name);
      if (ctx.globals.has(node.name)) return ctx.globals.get(node.name);
      const suggestion = cgSuggest(node.name, [...frame.locals.keys(), ...ctx.globals.keys()]);
      cgFail(node.line, `Nie znam zmiennej „${node.name}”.${suggestion ? ` Czy chodziło o ${suggestion}?` : ` Utwórz ją najpierw: var ${node.name} = 0`}`);
      break;
    }
    case 'pos':
      return ctx.world.robot[node.axis];
    case 'not':
      return !cgTruthy(yield* cgEval(node.arg, frame));
    case 'neg': {
      const value = yield* cgEval(node.arg, frame);
      return cgArithmetic('-', 0, value, node.line);
    }
    case 'and':
      return cgTruthy(yield* cgEval(node.left, frame)) && cgTruthy(yield* cgEval(node.right, frame));
    case 'or':
      return cgTruthy(yield* cgEval(node.left, frame)) || cgTruthy(yield* cgEval(node.right, frame));
    case 'bin': {
      const a = yield* cgEval(node.left, frame);
      const b = yield* cgEval(node.right, frame);
      if (node.op === '==') return a === b;
      if (node.op === '!=') return a !== b;
      if (CG_COMPARE_OPS.has(node.op)) {
        if (typeof a !== 'number' || typeof b !== 'number') cgFail(node.line, 'Porównywać „<” i „>” można tylko liczby.');
        if (node.op === '<') return a < b;
        if (node.op === '>') return a > b;
        if (node.op === '<=') return a <= b;
        return a >= b;
      }
      return cgArithmetic(node.op, a, b, node.line);
    }
    case 'call':
      return yield* cgCall(node, frame);
    default:
      return null;
  }
}

function* cgCall(node, frame) {
  const { ctx } = frame;
  const { world } = ctx;
  const { robot } = world;
  if (CG_ACTIONS[node.name]) {
    const [dx, dy] = CG_ACTIONS[node.name];
    const steps = node.args.length ? yield* cgEval(node.args[0], frame) : 1;
    if (!Number.isInteger(steps) || steps < 0) cgFail(node.line, `W nawiasach wpisz, ile kroków ma zrobić robot, np. ${node.name}(3)`);
    for (let i = 0; i < steps; i += 1) yield* cgMove(ctx, dx, dy, node.line);
    return null;
  }
  if (node.name === 'pick') {
    const cell = `${robot.x},${robot.y}`;
    if (!world.gems.has(cell)) cgFail(node.line, 'Tu nie ma kryształu — pick() działa tylko na polu z 💎.', { pick: true });
    world.gems.delete(cell);
    world.picked += 1;
    yield { kind: 'pick', line: node.line, x: robot.x, y: robot.y };
    return null;
  }
  if (CG_WALL_SENSORS[node.name]) {
    const [dx, dy] = CG_WALL_SENSORS[node.name];
    return cgBlocked(world, robot.x + dx, robot.y + dy);
  }
  if (node.name === 'read_sign') {
    if (!world.sign) cgFail(node.line, 'Na tej planszy nie ma tabliczki 🪧.');
    if (robot.x !== world.sign.x || robot.y !== world.sign.y) {
      cgFail(node.line, 'Robot przeczyta tabliczkę 🪧 tylko wtedy, gdy na niej stoi. Wejdź na nią, przeczytaj ją i zapamiętaj liczbę w zmiennej: var n = read_sign()', { pick: true });
    }
    yield { kind: 'read', line: node.line, value: world.sign.value };
    return world.sign.value;
  }
  if (node.name === 'dig') {
    const { treasure } = world;
    if (!treasure || treasure.x !== robot.x || treasure.y !== robot.y) {
      cgFail(node.line, 'Robot kopie, ale tu nic nie ma. Skarb leży tyle pól w głąb mostu, ile pokazuje tabliczka 🪧.', { pick: true });
    }
    if (treasure.dug) cgFail(node.line, 'Skarb jest już wykopany.', { pick: true });
    treasure.dug = true;
    yield { kind: 'dig', line: node.line, x: robot.x, y: robot.y };
    return null;
  }
  if (node.name === 'value' || node.name === 'value_right') {
    const box = cgBoxAt(ctx, node.name === 'value' ? 0 : 1, node.line);
    yield* cgOpenBox(ctx, box, node.line);
    return box.value;
  }
  if (node.name === 'swap') {
    const left = cgBoxAt(ctx, 0, node.line);
    const right = cgBoxAt(ctx, 1, node.line);
    [left.x, right.x] = [right.x, left.x];
    world.boxes.set(`${left.x},${left.y}`, left);
    world.boxes.set(`${right.x},${right.y}`, right);
    yield { kind: 'swap', line: node.line, boxes: [left, right] };
    return null;
  }
  if (node.name === 'choose') {
    const box = cgBoxAt(ctx, 0, node.line);
    yield* cgOpenBox(ctx, box, node.line);
    const { goal } = ctx.level;
    const want = goal === 'min' ? Math.min(...world.boxValues) : goal === 'sign' ? world.sign.value : null;
    if (want === null) cgFail(node.line, 'Na tym poziomie nie wybieramy skrzynek — ułóż je.');
    if (box.value !== want) {
      cgFail(node.line, goal === 'min'
        ? `Robot wybrał ${box.value}, ale to nie jest najmniejsza liczba.`
        : `Robot wybrał ${box.value}, a na tabliczce jest ${want}.`, { pick: true });
    }
    world.chosen = true;
    yield { kind: 'choose', line: node.line, box };
    return null;
  }
  if (node.name === 'is_gem') return world.gems.has(`${robot.x},${robot.y}`);
  if (node.name === 'is_on_flag') {
    if (!world.flag) cgFail(node.line, 'Na tej planszy nie ma flagi 🚩 — tu szukamy skarbu 💰.');
    return cgOnFlag(world);
  }
  const args = [];
  for (const arg of node.args) args.push(yield* cgEval(arg, frame));
  if (node.name === 'go_to') {
    const [x] = args;
    if (!Number.isInteger(x)) cgFail(node.line, 'W nawiasach go_to() wpisz numer kolumny, np. go_to(3)');
    while (world.robot.x !== x) yield* cgMove(ctx, Math.sign(x - world.robot.x), 0, node.line);
    return null;
  }
  if (node.name === 'range') {
    args.forEach((value) => {
      if (!Number.isInteger(value)) cgFail(node.line, 'W range() wpisz liczby całkowite.');
    });
    const [from, to] = args.length === 1 ? [0, args[0]] : args;
    return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
  }
  return yield* cgCallUser(ctx.program.funcs[node.name], args, frame, node.line);
}

function* cgCallUser(func, args, frame, line) {
  const { ctx } = frame;
  if (ctx.depth >= CG_CALL_DEPTH) cgFail(line, `Funkcja ${func.name}() woła samą siebie bez końca. ${CG_TIRED}`);
  ctx.depth += 1;
  const locals = new Map(func.params.map((name, i) => [name, args[i]]));
  try {
    yield* cgExecBlock(func.body, { ctx, locals, line });
  } catch (signal) {
    if (signal instanceof CgReturn) return signal.value;
    throw signal;
  } finally {
    ctx.depth -= 1;
  }
  return null;
}

function* cgMove(ctx, dx, dy, line) {
  const { world, level } = ctx;
  const x = world.robot.x + dx;
  const y = world.robot.y + dy;
  if (x < 0 || y < 0 || x >= world.cols || y >= world.rows) cgFail(line, 'Robot nie może wyjść poza planszę.', { dx, dy });
  if (world.walls.has(`${x},${y}`)) cgFail(line, 'Bum! Robot uderzył w ścianę.', { dx, dy });
  if (world.boxes?.has(`${x},${y}`)) cgFail(line, 'Robot nie wchodzi na skrzynki — chodzi rzędem nad nimi.', { dx, dy });
  if (level.maxMoves && world.moves >= level.maxMoves) {
    cgFail(line, `Robot zrobił już ${level.maxMoves} kroków i nie ma siły iść dalej. Istnieje krótsza droga — poszukaj jej!`, { dx, dy });
  }
  world.moves += 1;
  world.robot = { x, y };
  yield { kind: 'move', line, dx, dy, x, y };
}

// Skrzynka pod robotem (dx = 0) albo ta obok niej z prawej (dx = 1).
function cgBoxAt(ctx, dx, line) {
  const { world } = ctx;
  const box = world.boxes?.get(`${world.robot.x + dx},${world.robot.y + 1}`);
  if (!box) {
    cgFail(line, dx ? 'Z prawej nie ma już skrzynki — robot doszedł do końca rzędu.' : 'Pod robotem nie ma skrzynki 📦.', { pick: true });
  }
  return box;
}

function* cgOpenBox(ctx, box, line) {
  if (box.open) return;
  const { world, level } = ctx;
  if (level.maxOpen && world.opened >= level.maxOpen) {
    cgFail(line, `Otwarto już ${level.maxOpen} skrzynki — więcej nie wolno. Zaglądaj do środkowej i odrzucaj połowę!`, { pick: true });
  }
  world.opened += 1;
  box.open = true;
  yield { kind: 'open', line, box };
}

// Najmniej kroków od startu robota do każdego pola — algorytm fali (BFS): start ma 0,
// jego sąsiedzi 1, ich jeszcze nieodwiedzeni sąsiedzi 2 i tak dalej.
function cgWave(world) {
  const dist = new Map([[`${world.start.x},${world.start.y}`, 0]]);
  const queue = [world.start];
  while (queue.length) {
    const { x, y } = queue.shift();
    const d = dist.get(`${x},${y}`);
    Object.values(CG_ACTIONS).forEach(([dx, dy]) => {
      const key = `${x + dx},${y + dy}`;
      if (cgBlocked(world, x + dx, y + dy) || dist.has(key)) return;
      dist.set(key, d + 1);
      queue.push({ x: x + dx, y: y + dy });
    });
  }
  return dist;
}

// Uruchamia program do końca bez animacji (testy). Zwraca { ok, error, world, steps }.
function cgRunProgram(source, level, setup) {
  const world = cgCreateWorld(level, setup);
  let steps = 0;
  try {
    const program = cgCompile(source, level);
    for (const event of cgExecute(program, world, {}, level)) if (event) steps += 1;
  } catch (error) {
    if (!(error instanceof CgError)) throw error;
    return { ok: false, error, world, steps };
  }
  return { ok: cgGoalReached(world, level), error: null, world, steps };
}

function cgStars(level, lines) {
  if (lines <= level.stars[0]) return 3;
  if (lines <= level.stars[1]) return 2;
  return 1;
}

// Na poziomie z tabliczką albo losowymi skrzynkami program musi działać dla każdych liczb, a nie tylko
// tych, które akurat widać. Zwraca pierwszy przypadek ({ sign, boxes }), który nie przechodzi poziomu, albo null.
function cgFailingCase(source, level) {
  return cgTestCases(level).find((setup) => !cgRunProgram(source, level, setup).ok) || null;
}

function cgTestCases(level) {
  if (level.sign && !level.sign.box) {
    return Array.from({ length: level.sign.max - level.sign.min + 1 }, (_, i) => ({ sign: level.sign.min + i }));
  }
  if (!level.boxes || Array.isArray(level.boxes)) return [];
  const count = level.map.join('').split('B').length - 1;
  // Stałe ziarno — przy każdym sprawdzeniu te same ułożenia.
  let seed = 12345;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const arrangements = Array.from({ length: level.sign ? 4 : 30 }, () => cgMakeBoxes(level, count, random, false));
  if (!level.boxes.sorted) {
    const ascending = Array.from({ length: count }, (_, i) => i + 1);
    arrangements.unshift(ascending, [...ascending].reverse());
  }
  if (!level.sign) return arrangements.map((boxes) => ({ boxes }));
  return arrangements.flatMap((boxes) => boxes.map((sign) => ({ boxes, sign })));
}

function cgCaseText(setup) {
  if (setup.boxes && setup.sign !== undefined) return `dla skrzynek ${setup.boxes.join(' ')} i liczby ${setup.sign} na tabliczce`;
  if (setup.boxes) return `dla skrzynek ${setup.boxes.join(' ')}`;
  return `gdy na tabliczce jest ${setup.sign}`;
}

function cgGoalMessage(world, level = {}) {
  if (world.boxes && level.goal && !cgGoalReached(world, level)) {
    if (level.goal === 'sorted') return 'Program się skończył, ale skrzynki nie są jeszcze ułożone od najmniejszej do największej.';
    if (level.goal === 'maxLast') return 'Program się skończył, ale największa liczba nie jest na końcu rzędu.';
    if (level.goal === 'minFirst') return 'Program się skończył, ale najmniejsza liczba nie jest na początku rzędu.';
    return 'Program się skończył, a robot nie wybrał skrzynki. Stań nad właściwą i napisz choose()';
  }
  if (world.treasure && !world.treasure.dug) return 'Program się skończył, ale skarb 💰 jest nadal zakopany. Wykop go: dig()';
  const onFlag = cgOnFlag(world);
  const left = world.gems.size;
  if (!onFlag && left) return `Program się skończył. Robot nie dotarł do flagi, a kryształy do zebrania: ${left} 💎.`;
  if (left) return `Robot jest na fladze, ale zostały jeszcze kryształy do zebrania: ${left} 💎.`;
  return 'Program się skończył, ale robot nie stoi na fladze 🚩.';
}

// ——— Kolorowanie składni (kolory edytora Godot) ———

function cgEscape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CG_HIGHLIGHT_RE = new RegExp(`(#.*$)|(\\d+)|(${CG_NAME})|([ \\t]+)|(.)`, 'gy');

function cgHighlightLine(text) {
  let html = '';
  let previousWord = '';
  let previousChar = '';
  CG_HIGHLIGHT_RE.lastIndex = 0;
  let match;
  while (CG_HIGHLIGHT_RE.lastIndex < text.length && (match = CG_HIGHLIGHT_RE.exec(text))) {
    const [piece, comment, number, word, space] = match;
    let kind = '';
    if (comment) kind = 'comment';
    else if (number) kind = 'number';
    else if (word) {
      const after = text.slice(CG_HIGHLIGHT_RE.lastIndex).trimStart()[0];
      if (CG_CONTROL.has(word)) kind = 'control';
      else if (CG_KEYWORDS.has(word)) kind = 'keyword';
      else if (previousWord === 'func') kind = 'funcdef';
      else if (previousWord === 'extends') kind = 'type';
      else if (after === '(') kind = 'call';
      else if (word === 'position' || previousChar === '.') kind = 'member';
    } else if (!space) kind = 'symbol';
    html += kind ? `<span class="cg-t-${kind}">${cgEscape(piece)}</span>` : cgEscape(piece);
    if (word) previousWord = word;
    if (!space) previousChar = piece;
  }
  return html;
}

// ——— Ekran gry ———

function cgReadSave(game) {
  const empty = { stars: {}, code: {} };
  try {
    const stored = readStoredObject(studentKey(`${CG_STORAGE_KEY}:${game.id}`));
    return { stars: stored.stars || {}, code: stored.code || {} };
  } catch {
    return codeGameSessionSave || empty;
  }
}

let codeGameSessionSave = null;

function cgWriteSave(game, save) {
  codeGameSessionSave = save;
  try {
    localStorage.setItem(studentKey(`${CG_STORAGE_KEY}:${game.id}`), JSON.stringify(save));
  } catch {
    // Gra działa dalej, gdy pamięć przeglądarki jest niedostępna.
  }
}

function cgStarText(count) {
  return `${'★'.repeat(count)}${'☆'.repeat(3 - count)}`;
}

function cgLinesWord(count) {
  const tens = count % 100;
  const ones = count % 10;
  if (count === 1) return 'linię';
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return 'linie';
  return 'linii';
}

function cgUnlocked(game, save, levelIndex) {
  if (debugFreeNav) return true;
  return levelIndex === 0 || Boolean(save.stars[levelIndex - 1]);
}

// Legenda na ekranie startowym (game.legend ją zastępuje).
const CG_LEGEND = [
  { icon: '💎', name: 'Kryształ', text: 'podnieś go: pick()' },
  { icon: '🚩', name: 'Flaga', text: 'tu kończy się droga' },
  { icon: '<span class="cg-legend-wall"></span>', name: 'Ściana', text: 'przez nią nie przejdziesz' }
];

function renderCodeGame(topic, index, game) {
  stopCodeGame();
  document.title = `${game.title} — Informatyczna Przygoda`;
  document.querySelector('meta[name="theme-color"]').content = topic.accent;
  app.replaceChildren(quizTemplate.content.cloneNode(true));
  applyTopicTheme(topic);
  app.querySelector('#quiz-close').href = `#/sciezka/${topic.slug}`;
  app.querySelector('#quiz-footer').hidden = true;
  app.querySelector('#quiz-kicker').textContent = game.title;
  app.querySelector('#quiz-prompt').textContent = game.prompt;
  app.querySelector('#quiz-hint').textContent =
    'Napisz program w języku GDScript — tym samym, w którym tworzy się gry w silniku Godot. ' +
    `Robot wykona Twoje polecenia krok po kroku. Przejdź ${game.levels.length} poziomów!`;
  setQuizProgress(0);

  const save = cgReadSave(game);
  const firstOpen = game.levels.findIndex((_, i) => !save.stars[i]);
  const startAt = firstOpen === -1 ? 0 : firstOpen;
  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg-intro cg-intro';
  body.innerHTML = `
    <div class="bg-legend cg-legend">
      <span class="bg-legend-item"><span class="cg-legend-icon cg-legend-robot" aria-hidden="true">${CG_ROBOT_SVG}</span><span><b>Robot</b>słucha Twojego kodu</span></span>
      ${(game.legend || CG_LEGEND).map(({ icon, name, text }) => `
        <span class="bg-legend-item"><span class="cg-legend-icon" aria-hidden="true">${icon}</span><span><b>${name}</b>${text}</span></span>`).join('')}
    </div>
    <p class="ng-legend-title cg-levels-title">Poziomy</p>
    <div class="cg-level-grid">
      ${game.levels.map((level, i) => {
        const open = cgUnlocked(game, save, i);
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
  // Debugowanie: adres z ?poziom=8 (przed #) zaczyna grę od wskazanego poziomu.
  const debugLevel = Number(new URLSearchParams(location.search).get('poziom')) - 1;
  const firstLevel = debugLevel >= 0 && debugLevel < game.levels.length ? debugLevel : startAt;
  body.querySelector('.fg-start').addEventListener('click', () => startCodeLevel(topic, index, game, firstLevel));
  body.querySelectorAll('.cg-level-pick').forEach((button) => {
    button.addEventListener('click', () => startCodeLevel(topic, index, game, Number(button.dataset.level)));
  });
  body.querySelector('.fg-start').focus();
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function startCodeLevel(topic, index, game, levelIndex) {
  stopCodeGame();
  const level = game.levels[levelIndex];
  const save = cgReadSave(game);
  const world = cgCreateWorld(level);
  app.querySelector('#quiz-prompt').textContent = `Poziom ${levelIndex + 1}: ${level.title}`;
  app.querySelector('#quiz-hint').textContent = level.task;
  setQuizProgress(levelIndex / game.levels.length);

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg cg-game';
  body.innerHTML = `
    <div class="fg-hud">
      <span class="fg-score cg-level-nav">
        <button class="cg-level-step cg-prev" type="button" aria-label="Poprzedni poziom" ${levelIndex > 0 ? '' : 'disabled'}>◀</button>
        Poziom <b>${levelIndex + 1}</b> / ${game.levels.length}
        <button class="cg-level-step cg-next" type="button" aria-label="Następny poziom" ${levelIndex < game.levels.length - 1 && cgUnlocked(game, save, levelIndex + 1) ? '' : 'disabled'}>▶</button>
      </span>
      <span class="fg-message" aria-live="polite"></span>
      <button class="secondary-button fg-end cg-clear" type="button">Kod od nowa</button>
    </div>
    <div class="cg">
      <section class="cg-left" aria-label="Edytor kodu">
        ${level.concept ? `
          <div class="cg-concept">
            <p class="cg-concept-name"><span>Nowe pojęcie</span>${level.concept.name}</p>
            <p class="cg-concept-text">${level.concept.text}</p>
            ${level.concept.code ? `<pre class="cg-concept-code">${level.concept.code.split('\n').map(cgHighlightLine).join('\n')}</pre>` : ''}
          </div>` : ''}
        ${level.explain ? `
          <details class="cg-hint cg-explain">
            <summary>${level.explain.title}</summary>
            ${level.explain.html}
          </details>` : ''}
        <div class="cg-editor">
          <div class="cg-editor-bar"><span class="cg-file">robot.gd</span><span class="cg-lines"></span></div>
          <div class="cg-editor-main">
            <div class="cg-gutter" aria-hidden="true"><div class="cg-gutter-inner"></div></div>
            <div class="cg-code">
              <pre class="cg-highlight" aria-hidden="true"></pre>
              <textarea class="cg-input" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"
                aria-label="Kod programu w GDScript. Tab robi wcięcie, Escape wychodzi z edytora."></textarea>
            </div>
          </div>
        </div>
        <div class="cg-palette" aria-label="Wstaw polecenie">
          ${level.buttons.map((snippet) => `<button class="cg-snippet" type="button" data-snippet="${cgEscape(snippet)}">${cgHighlightLine(snippet)}</button>`).join('')}
        </div>
        <p class="cg-status" role="status" aria-live="polite"></p>
        ${level.hint ? `<details class="cg-hint"><summary>Podpowiedź</summary><p>${level.hint}</p></details>` : ''}
        ${cgDocsHtml(game, levelIndex)}
      </section>
      <section class="cg-right" aria-label="Plansza">
        <ul class="ng-goals cg-goals" aria-label="Cele"></ul>
        <div class="cg-stage" style="--cols: ${world.cols}; --rows: ${world.rows}">
          <span class="cg-axis-corner" aria-hidden="true"></span>
          <div class="cg-axis cg-axis-x" aria-hidden="true">${Array.from({ length: world.cols }, (_, x) => `<span>${x}</span>`).join('')}</div>
          <div class="cg-axis cg-axis-y" aria-hidden="true">${Array.from({ length: world.rows }, (_, y) => `<span>${y}</span>`).join('')}</div>
          <div class="cg-board">
            <div class="cg-cells">
              ${cgCellsHtml(level, world)}
            </div>
            <div class="cg-items"></div>
          </div>
        </div>
        <div class="cg-controls">
          <button class="primary-button cg-run" type="button"><span aria-hidden="true">▶</span> Uruchom</button>
          <button class="secondary-button cg-reset" type="button"><span aria-hidden="true">↺</span> Reset</button>
        </div>
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
    input: body.querySelector('.cg-input'),
    highlight: body.querySelector('.cg-highlight'),
    gutter: body.querySelector('.cg-gutter-inner'),
    status: body.querySelector('.cg-status'),
    runButton: body.querySelector('.cg-run'),
    items: body.querySelector('.cg-items'),
    running: false,
    dirty: false,
    timer: 0,
    messageTimer: 0,
    clearTimer: 0,
    activeLine: 0,
    errorLine: 0,
    won: false,
    bestStars: save.stars[levelIndex] || 0
  };
  codeGame = state;

  state.input.value = save.code[levelIndex] ?? level.starter ?? '';
  cgRenderItems(state);
  cgRenderGoals(state);
  cgUpdateEditor(state);
  cgSetStatus(state, 'Napisz program i kliknij ▶ Uruchom.', '');

  state.input.addEventListener('input', () => {
    state.errorLine = 0;
    if (state.dirty && !state.running) cgResetBoard(state);
    cgUpdateEditor(state);
  });
  state.input.addEventListener('scroll', () => cgSyncScroll(state));
  state.input.addEventListener('keydown', (event) => cgEditorKey(state, event));
  body.querySelector('.cg-palette').addEventListener('click', (event) => {
    const button = event.target.closest('.cg-snippet');
    if (button) cgInsertSnippet(state, button.dataset.snippet);
  });
  state.runButton.addEventListener('click', () => (state.running ? cgStopRun(state, 'Zatrzymano program.') : cgRun(state)));
  body.querySelector('.cg-reset').addEventListener('click', () => {
    cgStopRun(state);
    cgResetBoard(state, true);
    cgSetStatus(state, state.world.boxes && !Array.isArray(level.boxes) ? 'Robot wrócił na start. Skrzynki mają nowe liczby.' : 'Robot wrócił na start.', '');
  });
  body.querySelector('.cg-clear').addEventListener('click', (event) => cgClearCode(state, event.currentTarget));
  body.querySelector('.cg-prev').addEventListener('click', () => cgGoToLevel(state, levelIndex - 1));
  body.querySelector('.cg-next').addEventListener('click', () => cgGoToLevel(state, levelIndex + 1));

  const end = state.input.value.length;
  state.input.setSelectionRange(end, end);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Przejście na inny poziom z paska gry — kod bieżącego poziomu zostaje zapisany.
function cgGoToLevel(state, levelIndex) {
  if (levelIndex < 0 || levelIndex >= state.game.levels.length) return;
  cgStopRun(state);
  cgSaveCode(state);
  startCodeLevel(state.topic, state.index, state.game, levelIndex);
}

// Dokumentacja: pojęcia i polecenia poznane na wcześniejszych poziomach.
function cgDocsHtml(game, levelIndex) {
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
            ${concept.code ? `<pre class="cg-concept-code">${concept.code.split('\n').map(cgHighlightLine).join('\n')}</pre>` : ''}
          </li>`).join('')}
      </ul>
    </details>`;
}

function stopCodeGame() {
  if (!codeGame) return;
  clearTimeout(codeGame.timer);
  clearTimeout(codeGame.messageTimer);
  clearTimeout(codeGame.clearTimer);
  codeGame = null;
}

// ——— Edytor ———

function cgIndentUnit(value) {
  return /^ {4}/m.test(value) && !/^\t/m.test(value) ? '    ' : '\t';
}

function cgUpdateEditor(state) {
  const lines = state.input.value.replace(/\r/g, '').split('\n');
  state.highlight.innerHTML = lines.map((text, i) => {
    const tone = i + 1 === state.activeLine ? ' is-active' : i + 1 === state.errorLine ? ' is-error' : '';
    return `<div class="cg-line${tone}">${cgHighlightLine(text) || ' '}</div>`;
  }).join('');
  state.gutter.innerHTML = lines.map((_, i) => {
    const tone = i + 1 === state.activeLine ? ' is-active' : i + 1 === state.errorLine ? ' is-error' : '';
    return `<div class="cg-num${tone}">${i + 1}</div>`;
  }).join('');
  const count = cgCountLines(state.input.value);
  state.body.querySelector('.cg-lines').textContent = `${count} ${count === 1 ? 'linia' : cgLinesWord(count)} kodu`;
  cgSyncScroll(state);
}

function cgSyncScroll(state) {
  const { scrollTop, scrollLeft } = state.input;
  state.highlight.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
  state.gutter.style.transform = `translateY(${-scrollTop}px)`;
}

// Wstawia tekst tak, by działało Ctrl+Z (execCommand), z zapasowym setRangeText.
function cgInsertText(input, text, from, to) {
  input.focus();
  input.setSelectionRange(from, to);
  if (!document.execCommand('insertText', false, text)) {
    input.setRangeText(text, from, to, 'end');
    input.dispatchEvent(new Event('input'));
  }
}

function cgEditorKey(state, event) {
  const { input } = state;
  if (input.readOnly) return;
  const { value, selectionStart: start, selectionEnd: end } = input;
  const unit = cgIndentUnit(value);
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;

  if (event.key === 'Escape') {
    input.blur();
    return;
  }
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    cgRun(state);
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const before = value.slice(lineStart, start);
    const indent = before.match(/^[ \t]*/)[0] + (before.split('#')[0].trimEnd().endsWith(':') ? unit : '');
    cgInsertText(input, `\n${indent}`, start, end);
    return;
  }
  if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
  event.preventDefault();
  const multiLine = value.slice(start, end).includes('\n');
  if (!event.shiftKey && !multiLine) {
    cgInsertText(input, unit, start, end);
    return;
  }
  // Wcięcie albo cofnięcie wcięcia kilku zaznaczonych linii (Shift+Tab — także jednej).
  const blockEnd = value.indexOf('\n', end - (end > start && value[end - 1] === '\n' ? 1 : 0));
  const to = blockEnd === -1 ? value.length : blockEnd;
  const block = value.slice(lineStart, to);
  const changed = block.split('\n').map((line) => {
    if (!event.shiftKey) return unit + line;
    return line.replace(/^(\t| {1,4})/, '');
  }).join('\n');
  if (changed === block) return;
  cgInsertText(input, changed, lineStart, to);
  if (multiLine) input.setSelectionRange(lineStart, lineStart + changed.length);
  else {
    const caret = Math.max(lineStart, start - (block.length - changed.length));
    input.setSelectionRange(caret, caret);
  }
}

// Przycisk polecenia: na pustej linii wstawia w miejscu kursora, a na zapisanej — w nowej linii pod nią.
function cgInsertSnippet(state, snippet) {
  const { input } = state;
  if (input.readOnly) return;
  const { value, selectionStart: start } = input;
  const unit = cgIndentUnit(value);
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const newline = value.indexOf('\n', start);
  const lineEnd = newline === -1 ? value.length : newline;
  const line = value.slice(lineStart, lineEnd);
  let text = snippet;
  let at = start;
  let indent = value.slice(lineStart, start).match(/^[ \t]*/)[0];
  if (line.trim()) {
    indent = line.match(/^[ \t]*/)[0] + (line.split('#')[0].trimEnd().endsWith(':') ? unit : '');
    text = `\n${indent}${snippet}`;
    at = lineEnd;
  }
  if (snippet.endsWith(':')) text += `\n${indent}${unit}`;
  cgInsertText(input, text, at, line.trim() ? at : Math.max(start, input.selectionEnd));
}

function cgClearCode(state, button) {
  if (state.running) return;
  if (!button.classList.contains('is-confirm')) {
    button.classList.add('is-confirm');
    button.textContent = 'Na pewno?';
    clearTimeout(state.clearTimer);
    state.clearTimer = setTimeout(() => {
      button.classList.remove('is-confirm');
      button.textContent = 'Kod od nowa';
    }, 3000);
    return;
  }
  clearTimeout(state.clearTimer);
  button.classList.remove('is-confirm');
  button.textContent = 'Kod od nowa';
  state.input.value = state.level.starter || '';
  state.errorLine = 0;
  cgResetBoard(state);
  cgUpdateEditor(state);
  cgSetStatus(state, 'Kod wrócił do początku.', '');
  state.input.focus();
}

// ——— Plansza ———

// Pola planszy. Na poziomie z level.wave każde pole pokazuje, w ilu najmniej krokach dojdzie do niego robot.
function cgCellsHtml(level, world) {
  const wave = level.wave ? cgWave(world) : null;
  return level.map.flatMap((row, y) => [...row].map((char, x) => {
    const tone = { '#': ' is-wall', '~': ' is-fog', B: ' is-shelf' }[char] || '';
    const steps = wave?.get(`${x},${y}`);
    return `<span class="cg-cell${tone}">${steps ? `<span class="cg-wave">${steps}</span>` : ''}</span>`;
  })).join('');
}

function cgPlace(world, x, y) {
  return `left: ${(x / world.cols) * 100}%; top: ${(y / world.rows) * 100}%`;
}

function cgBoxHtml(world, box) {
  const max = Math.max(...world.boxValues);
  return `<span class="cg-box${box.open ? '' : ' is-closed'}" data-box="${box.id}" style="${cgPlace(world, box.x, box.y)}; --fill: ${box.value / max}">
    <span class="cg-box-bar"></span><b>${box.open ? box.value : '?'}</b></span>`;
}

function cgRenderItems(state) {
  const { world, level } = state;
  const place = (x, y) => cgPlace(world, x, y);
  const gems = [];
  level.map.forEach((row, y) => [...row].forEach((char, x) => {
    if (char === 'G') gems.push(`<span class="cg-gem${world.gems.has(`${x},${y}`) ? '' : ' is-picked'}" data-cell="${x},${y}" style="${place(x, y)}">💎</span>`);
  }));
  const { sign, treasure } = world;
  state.items.innerHTML = `
    ${world.flag ? `<span class="cg-flag" style="${place(world.flag.x, world.flag.y)}">🚩</span>` : ''}
    ${sign ? `<span class="cg-sign" style="${place(sign.x, sign.y)}"><span class="cg-sign-post"></span><span class="cg-sign-board">${sign.shown ? sign.value : '?'}</span></span>` : ''}
    ${treasure ? `<span class="cg-treasure${treasure.dug ? ' is-found' : ''}" style="${place(treasure.x, treasure.y)}">💰</span>` : ''}
    ${gems.join('')}
    ${world.boxes ? [...world.boxes.values()].map((box) => cgBoxHtml(world, box)).join('') : ''}
    <span class="cg-robot" style="${place(world.robot.x, world.robot.y)}">${CG_ROBOT_SVG}</span>`;
  state.robot = state.items.querySelector('.cg-robot');
}

const CG_BOX_GOALS = {
  sorted: 'Ułóż skrzynki od najmniejszej do największej 📦',
  maxLast: 'Przesuń największą liczbę na koniec rzędu 📦',
  minFirst: 'Przesuń najmniejszą liczbę na początek rzędu 📦',
  min: 'Wybierz skrzynkę z najmniejszą liczbą 📦',
  sign: 'Wybierz skrzynkę z liczbą z tabliczki 🪧'
};

function cgRenderGoals(state) {
  const { world, level } = state;
  const goals = [];
  if (world.totalGems) {
    goals.push({ done: !world.gems.size, text: `Zbierz kryształy: ${world.picked} / ${world.totalGems} 💎` });
  }
  if (world.treasure) goals.push({ done: world.treasure.dug, text: 'Wykop skarb 💰' });
  if (world.boxes && level.goal) {
    goals.push({ done: cgGoalReached(world, level), text: CG_BOX_GOALS[level.goal] });
  }
  if (level.maxOpen) goals.push({ done: false, text: `Otwórz najwyżej ${level.maxOpen} skrzynki: ${world.opened} / ${level.maxOpen} 📦` });
  if (world.flag) goals.push({ done: cgGoalReached(world, level), text: 'Dojdź do flagi 🚩' });
  if (level.maxMoves) goals.push({ done: false, text: `Najwyżej ${level.maxMoves} kroków: ${world.moves} / ${level.maxMoves} 👣` });
  const stars = state.bestStars;
  state.body.querySelector('.cg-goals').innerHTML = goals.map((goal) => `
    <li class="ng-goal${goal.done ? ' is-done' : ''}"><span class="ng-goal-mark" aria-hidden="true">${goal.done ? '✓' : ''}</span>${goal.text}</li>`).join('') +
    `<li class="ng-goal cg-goal-stars"><span class="ng-goal-mark" aria-hidden="true">★</span>3 gwiazdki: najwyżej ${level.stars[0]} ${cgLinesWord(level.stars[0])}${stars ? ` · masz ${cgStarText(stars)}` : ''}</li>`;
}

// Skrzynki zostają tak, jak je widać; nowe liczby losuje dopiero przycisk Reset (fresh).
function cgResetBoard(state, fresh) {
  const boxes = fresh ? undefined : state.world.boxValues;
  state.world = cgCreateWorld(state.level, { boxes });
  state.dirty = false;
  state.activeLine = 0;
  cgRenderItems(state);
  cgRenderGoals(state);
  cgUpdateEditor(state);
}

function cgSetStatus(state, text, tone) {
  state.status.textContent = text;
  state.status.className = `cg-status${tone ? ` is-${tone}` : ''}`;
}

function showCodeMessage(state, text, tone) {
  const message = state.body.querySelector('.fg-message');
  message.textContent = text;
  message.className = `fg-message is-${tone}`;
  clearTimeout(state.messageTimer);
  state.messageTimer = setTimeout(() => {
    message.textContent = '';
  }, 2000);
}

// ——— Uruchamianie ———

function cgSaveCode(state) {
  const save = cgReadSave(state.game);
  save.code[state.levelIndex] = state.input.value;
  cgWriteSave(state.game, save);
}

function cgRun(state) {
  if (state.running || state.won) return;
  cgResetBoard(state);
  cgSaveCode(state);
  let program;
  try {
    program = cgCompile(state.input.value, state.level);
  } catch (error) {
    if (!(error instanceof CgError)) throw error;
    cgShowError(state, error);
    return;
  }
  state.running = true;
  state.dirty = true;
  state.input.readOnly = true;
  state.body.classList.add('is-running');
  state.runButton.innerHTML = '<span aria-hidden="true">■</span> Stop';
  state.steps = cgExecute(program, state.world, {}, state.level);
  // Liczba na tabliczce jest losowana od nowa po każdym resecie i widać ją dopiero po uruchomieniu.
  const { sign } = state.world;
  if (sign) {
    sign.shown = true;
    state.items.querySelector('.cg-sign-board').textContent = sign.value;
  }
  cgSetStatus(state, 'Robot wykonuje program…', '');
  cgStep(state);
}

function cgStep(state) {
  if (codeGame !== state || !state.running) return;
  let result;
  try {
    result = state.steps.next();
  } catch (error) {
    if (!(error instanceof CgError)) throw error;
    cgStopRun(state);
    cgShowError(state, error);
    return;
  }
  if (result.done) {
    cgStopRun(state);
    cgFinishRun(state);
    return;
  }
  const event = result.value;
  cgShowLine(state, event.line);
  if (event.kind === 'move') {
    state.robot.style.left = `${(event.x / state.world.cols) * 100}%`;
    state.robot.style.top = `${(event.y / state.world.rows) * 100}%`;
    if (event.dx) state.robot.classList.toggle('is-left', event.dx < 0);
  }
  if (event.kind === 'pick') {
    state.items.querySelector(`.cg-gem[data-cell="${event.x},${event.y}"]`)?.classList.add('is-picked');
  }
  if (event.kind === 'read') {
    const sign = state.items.querySelector('.cg-sign');
    sign.classList.remove('is-read');
    void sign.offsetWidth;
    sign.classList.add('is-read');
    cgSetStatus(state, `Robot przeczytał tabliczkę: ${event.value}. Gdy z niej zejdzie, tę liczbę zapamięta tylko zmienna.`, '');
  }
  if (event.kind === 'dig') state.items.querySelector('.cg-treasure').classList.add('is-found');
  if (event.kind === 'swap') {
    event.boxes.forEach((box) => {
      state.items.querySelector(`.cg-box[data-box="${box.id}"]`).style.left = `${(box.x / state.world.cols) * 100}%`;
    });
  }
  if (event.kind === 'open' || event.kind === 'choose') {
    const element = state.items.querySelector(`.cg-box[data-box="${event.box.id}"]`);
    element.classList.remove('is-closed');
    element.querySelector('b').textContent = event.box.value;
    if (event.kind === 'choose') element.classList.add('is-chosen');
  }
  cgRenderGoals(state);
  state.timer = setTimeout(() => cgStep(state), CG_STEP_MS);
}

function cgShowLine(state, line) {
  state.activeLine = line;
  cgUpdateEditor(state);
  // Przewija edytor tak, by wykonywana linia była widoczna.
  const lineHeight = 24;
  const top = (line - 1) * lineHeight;
  const { input } = state;
  if (top < input.scrollTop || top + lineHeight > input.scrollTop + input.clientHeight) {
    input.scrollTop = Math.max(0, top - input.clientHeight / 2);
    cgSyncScroll(state);
  }
}

function cgStopRun(state, message) {
  clearTimeout(state.timer);
  if (!state.running) return;
  state.running = false;
  state.steps = null;
  state.input.readOnly = false;
  state.body.classList.remove('is-running');
  state.runButton.innerHTML = '<span aria-hidden="true">▶</span> Uruchom';
  if (message) {
    state.activeLine = 0;
    cgUpdateEditor(state);
    cgSetStatus(state, message, '');
  }
}

function cgShowError(state, error) {
  state.activeLine = 0;
  state.errorLine = error.line;
  cgUpdateEditor(state);
  cgSetStatus(state, `Linia ${error.line}: ${error.message}`, 'bad');
  if (error.bump && state.robot) {
    state.robot.classList.toggle('is-wiggle', Boolean(error.bump.pick));
    state.robot.style.setProperty('--bump-x', `${(error.bump.dx || 0) * 30}%`);
    state.robot.style.setProperty('--bump-y', `${(error.bump.dy || 0) * 30}%`);
    state.robot.classList.remove('is-bump');
    void state.robot.offsetWidth;
    state.robot.classList.add('is-bump');
  }
}

function cgFinishRun(state) {
  state.activeLine = 0;
  cgUpdateEditor(state);
  const { level, world } = state;
  if (!cgGoalReached(world, level)) {
    cgSetStatus(state, cgGoalMessage(world, level), 'bad');
    return;
  }
  const bad = cgFailingCase(state.input.value, level);
  if (bad && world.treasure) {
    cgSetStatus(state, `Tym razem na tabliczce było ${world.sign.value} i się udało! Ale tabliczka za każdym razem pokazuje inną liczbę — gdy jest na niej ${bad.sign}, Twój program nie znajdzie skarbu. Nie wpisuj liczby na sztywno: zapamiętaj ją w zmiennej var n = read_sign() i użyj n.`, 'bad');
    return;
  }
  if (bad) {
    cgSetStatus(state, `Tym razem się udało! Ale liczby za każdym razem są inne, a algorytm musi działać zawsze — ${cgCaseText(bad)} Twój program się myli. Wciśnij Reset, by wylosować nowe liczby, i popraw kod.`, 'bad');
    return;
  }
  winCodeLevel(state);
}

// ——— Wygrana, koniec gry ———

function cgGamePoints(game, save) {
  const total = game.levels.reduce((sum, _, i) => sum + (save.stars[i] || 0), 0);
  return { total, points: Math.round((game.reward * total) / (game.levels.length * 3)) };
}

function winCodeLevel(state) {
  state.won = true;
  const { topic, index, game, levelIndex, level } = state;
  const lines = cgCountLines(state.input.value);
  const stars = cgStars(level, lines);
  const save = cgReadSave(game);
  save.stars[levelIndex] = Math.max(save.stars[levelIndex] || 0, stars);
  state.bestStars = save.stars[levelIndex];
  save.code[levelIndex] = state.input.value;
  cgWriteSave(game, save);
  const last = levelIndex === game.levels.length - 1;
  const allDone = game.levels.every((_, i) => save.stars[i]);
  setQuizProgress((levelIndex + 1) / game.levels.length);
  const treasure = Boolean(state.world.treasure);
  const boxes = Boolean(state.world.boxes);
  cgSetStatus(state, treasure ? 'Udało się! Skarb wykopany.' : boxes ? 'Udało się! Algorytm działa.' : 'Udało się! Robot jest na fladze.', 'good');
  showCodeMessage(state, 'Brawo!', 'good');
  state.robot.classList.add('is-happy');
  burstFileGameConfetti(state.robot.getBoundingClientRect(), topic.accent);

  setTimeout(() => {
    if (codeGame !== state) return;
    const overlay = state.body.querySelector('.fg-overlay');
    const card = overlay.querySelector('.fg-overlay-card');
    const finish = last && allDone;
    const { points } = cgGamePoints(game, save);
    card.innerHTML = `
      <div class="summary-icon" aria-hidden="true">${finish ? '🏆' : '🤖'}</div>
      <p class="cg-win-stars" aria-label="Gwiazdki: ${stars} z 3">${cgStarText(stars)}</p>
      <h2>${finish ? 'Wszystkie zagadki rozwiązane!' : treasure ? 'Skarb znaleziony!' : boxes ? 'Zagadka rozwiązana!' : 'Flaga zdobyta!'}</h2>
      <p>Twój program ma ${lines} ${cgLinesWord(lines)}. ${stars < 3 ? `Na 3 gwiazdki wystarczy ${level.stars[0]}.` : 'Mistrzowski kod!'}</p>
      ${level.fact ? `<p class="ng-fact"><b>Czy wiesz?</b> ${level.fact}</p>` : ''}
      <div class="summary-actions">
        ${stars < 3 ? '<button class="secondary-button cg-improve" type="button">Popraw kod</button>' : ''}
        <button class="primary-button quiz-finish" type="button">${finish ? `Odbierz ${points} pkt` : last ? 'Wróć do poziomów' : 'Następny poziom'}</button>
      </div>
    `;
    card.querySelector('.cg-improve')?.addEventListener('click', () => {
      overlay.hidden = true;
      state.won = false;
      state.robot.classList.remove('is-happy');
      cgResetBoard(state);
      cgSetStatus(state, `Spróbuj napisać to krócej — najwyżej ${level.stars[0]} ${cgLinesWord(level.stars[0])}.`, '');
      state.input.focus();
    });
    card.querySelector('.quiz-finish').addEventListener('click', () => {
      if (finish) finishCodeGame(state);
      else if (last) renderCodeGame(topic, index, game);
      else startCodeLevel(topic, index, game, levelIndex + 1);
    });
    overlay.hidden = false;
    card.querySelector('.quiz-finish').focus();
  }, 900);
}

function finishCodeGame(state) {
  const { topic, index, game } = state;
  stopCodeGame();

  const save = cgReadSave(game);
  const { total, points } = cgGamePoints(game, save);
  const earned = Math.max(0, points - readQuizBest(game.id));
  if (earned) {
    saveQuizBest(game.id, points);
    saveStudentPoints(readStudentPoints() + earned);
  }
  completeLesson(topic, index);

  setQuizProgress(1);
  app.querySelector('#quiz-prompt').textContent = 'Brawo, gra ukończona!';
  app.querySelector('#quiz-hint').textContent = game.doneHint || 'Piszesz już prawdziwy GDScript: funkcje, pętle, warunki i zmienne. Tak samo programuje się gry w Godocie.';

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body quiz-summary';
  body.innerHTML = `
    <div class="summary-icon" aria-hidden="true">🏆</div>
    <div class="summary-stats">
      <div><strong>${game.levels.length}</strong><span>rozwiązanych zagadek</span></div>
      <div><strong>${total} / ${game.levels.length * 3}</strong><span>gwiazdek</span></div>
      <div><strong>+${formatPoints(earned)}</strong><span>nowych punktów</span></div>
    </div>
    ${total < game.levels.length * 3 ? '<p class="cg-summary-tip">Popraw kod na poziomach bez 3 gwiazdek, a dostaniesz więcej punktów.</p>' : ''}
    <div class="summary-actions">
      <button class="secondary-button quiz-retry" type="button">Wybierz poziom</button>
      <a class="primary-button quiz-finish" href="#/sciezka/${topic.slug}">Wróć do ścieżki <span aria-hidden="true">→</span></a>
    </div>
  `;
  body.querySelector('.quiz-retry').addEventListener('click', () => renderCodeGame(topic, index, game));
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

