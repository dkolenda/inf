// Zadania VS Code dla folderu Scripts/ projektu (tasks.json, który zapisuje ts-host.js).
// Uruchamia je sam program JSGame Engine jako Node (ELECTRON_RUN_AS_NODE=1), więc Node.js nie jest potrzebny:
//   jsgame-cli.js build  <folder> [--debug] [--trigger <plik>] — błędy składni, potem odświeżenie klas w edytorze i restart gry,
//   jsgame-cli.js check  <folder> — sprawdzenie typów (tsconfig.json z folderu),
//   jsgame-cli.js lint   <folder> — ostrzeżenia: nieużywane zmienne, var, == zamiast ===, debugger…
// Wynik w formacie „plik(linia,kolumna): error|warning kod: tekst” — VS Code pokazuje go w Problemach.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const [command, folderArg, ...rest] = process.argv.slice(2);
const folder = path.resolve(folderArg ?? '.');
const flag = (name) => rest.includes(name);
const option = (name) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : null);

const tsFiles = () => fs.readdirSync(folder).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts')).map((f) => path.join(folder, f));

function print(diag, severity, code) {
  const text = ts.flattenDiagnosticMessageText(diag.messageText, '\n').replace(/\n/g, ' ');
  if (!diag.file || diag.start === undefined) {
    console.log(`${severity} ${code}: ${text}`);
    return;
  }
  const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
  console.log(`${path.resolve(diag.file.fileName)}(${line + 1},${character + 1}): ${severity} ${code}: ${text}`);
}

function program(extra = {}) {
  const config = path.join(folder, 'tsconfig.json');
  const host = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => print(d, 'error', 'TS' + d.code) };
  const parsed = fs.existsSync(config)
    ? ts.getParsedCommandLineOfConfigFile(config, extra, host)
    : { options: { target: ts.ScriptTarget.ES2020, lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'], noEmit: true, skipLibCheck: true, ...extra }, fileNames: fs.readdirSync(folder).filter((f) => f.endsWith('.ts')).map((f) => path.join(folder, f)) };
  return ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true });
}

const key = (d) => `${d.file?.fileName}:${d.start}:${d.code}`;

function check() {
  const diags = ts.getPreEmitDiagnostics(program());
  diags.forEach((d) => print(d, d.category === ts.DiagnosticCategory.Warning ? 'warning' : 'error', 'TS' + d.code));
  console.log(diags.length ? `TypeScript: ${diags.length} problem(ów).` : 'TypeScript: bez błędów typów.');
  return diags.some((d) => d.category === ts.DiagnosticCategory.Error) ? 1 : 0;
}

// Reguły na drzewie składni — to, czego kompilator sam nie zgłasza.
function lintRules(sf, report) {
  const visit = (node) => {
    if (ts.isVariableDeclarationList(node) && !(node.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const))) {
      report(node, 'no-var', 'Użyj let albo const zamiast var.');
    }
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      const loose = op === ts.SyntaxKind.EqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken;
      const withNull = [node.left, node.right].some((n) => n.kind === ts.SyntaxKind.NullKeyword);
      if (loose && !withNull) report(node.operatorToken, 'eqeqeq', `Użyj ${op === ts.SyntaxKind.EqualsEqualsToken ? '===' : '!=='} — porównanie bez zamiany typów.`);
    }
    if (ts.isDebuggerStatement(node)) report(node, 'no-debugger', 'Instrukcja debugger zatrzyma grę — w VS Code postaw breakpoint (F9).');
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(sf) === 'console') {
      report(node, 'no-console', 'console.* nie trafia do Dziennika wiadomości edytora — użyj G.print(…).');
    }
    if (ts.isBlock(node) && !node.statements.length && ts.isIfStatement(node.parent) && node.parent.thenStatement === node) {
      report(node, 'no-empty', 'Pusty blok if.');
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

function lint() {
  const base = new Set(ts.getPreEmitDiagnostics(program()).map(key));
  const strict = program({ noUnusedLocals: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true });
  let count = 0;
  ts.getPreEmitDiagnostics(strict).filter((d) => !base.has(key(d))).forEach((d) => {
    print(d, 'warning', 'TS' + d.code);
    count++;
  });
  const files = new Set(tsFiles().map((f) => path.resolve(f).toLowerCase()));
  strict.getSourceFiles().filter((sf) => files.has(path.resolve(sf.fileName).toLowerCase())).forEach((sf) => {
    lintRules(sf, (node, rule, text) => {
      print({ file: sf, start: node.getStart(sf), messageText: text }, 'warning', rule);
      count++;
    });
  });
  console.log(count ? `Lint: ${count} ostrzeżeń.` : 'Lint: bez uwag.');
  return 0;
}

// Te same błędy składni, które zatrzymują kompilację w edytorze (typy sprawdza zadanie check).
function syntax() {
  let errors = 0;
  tsFiles().forEach((file) => {
    const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
    (out.diagnostics ?? []).forEach((d) => {
      print(d, 'error', 'TS' + d.code);
      errors++;
    });
  });
  return errors;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Prośba do działającego edytora: plik trigger (obserwuje go ts-host.js), odpowiedź w <trigger>-ack.json.
async function refresh(debug) {
  const trigger = option('--trigger');
  if (!trigger) {
    console.log('error refresh: brak ścieżki --trigger (ustawienie jsgame.trigger w .vscode/settings.json).');
    return 1;
  }
  const ack = trigger.replace(/\.json$/, '-ack.json');
  const id = `${process.pid}-${Date.now()}`;
  fs.mkdirSync(path.dirname(trigger), { recursive: true });
  fs.writeFileSync(trigger, JSON.stringify({ id, dir: folder, debug }));
  for (let waited = 0; waited < 8000; waited += 100) {
    await sleep(100);
    let answer = null;
    try {
      answer = JSON.parse(fs.readFileSync(ack, 'utf8'));
    } catch {
      // Jeszcze nie ma odpowiedzi.
    }
    if (answer?.id !== id) continue;
    console.log(answer.ok ? `JSGame Engine: ${answer.message}` : `error refresh: ${answer.message}`);
    return answer.ok ? 0 : 1;
  }
  console.log('error refresh: JSGame Engine nie odpowiada — uruchom go i otwórz ten projekt.');
  return 1;
}

async function main() {
  if (!fs.existsSync(folder)) {
    console.log(`error cli: nie ma folderu ${folder}`);
    return 1;
  }
  if (command === 'check') return check();
  if (command === 'lint') return lint();
  if (command === 'build') {
    const errors = syntax();
    if (errors) {
      console.log(`Kompilacja: ${errors} błąd(ów) składni — gra nie zostanie odświeżona.`);
      return 1;
    }
    return refresh(flag('--debug'));
  }
  console.log('Użycie: jsgame-cli.js build|check|lint <folder Scripts> [--debug] [--trigger <plik>]');
  return 1;
}

main().then((code) => process.exit(code), (error) => {
  console.log(`error cli: ${error?.stack ?? error}`);
  process.exit(1);
});
