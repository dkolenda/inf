// Klasy TypeScript z Przeglądarki zawartości (proces główny Electron).
// Każda klasa to plik <Nazwa>.ts w folderze projektu (Scripts/; projekt bez folderu — dane programu › scripts), który otwiera się w VS Code.
// Folder dostaje też jsgame.d.ts (typy silnika i Struktur z projektu) i tsconfig.json, więc VS Code podpowiada.
// Zapis pliku w VS Code → kompilacja do JavaScriptu → wiadomość „ts:changed” do edytora.
// Folder ma też .vscode/ (launch.json, tasks.json, settings.json): zadania z tools/jsgame-cli.js (kompilacja i odświeżenie gry,
// lint, sprawdzenie typów) i debuger podłączany do edytora (port DEBUG_PORT); mapy źródeł prowadzą breakpointy do plików .ts.
const { app, ipcMain, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');

// Port debugowania edytora (main.js) — launch.json podłącza do niego debuger VS Code.
const DEBUG_PORT = 9333;

const TSCONFIG = {
  compilerOptions: { target: 'ES2020', lib: ['ES2020', 'DOM'], strict: false, noEmit: true, skipLibCheck: true },
  include: ['*.ts']
};

// id klasy → { file, watcher, timer, last } — pliki, które edytor obserwuje.
const files = new Map();
let sender = null;

// Zadania VS Code uruchamiają ten sam program jako Node; skrypt i TypeScript leżą poza app.asar (asarUnpack w package.json).
const CLI = path.join(__dirname, 'tools', 'jsgame-cli.js').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
const triggerFile = () => path.join(app.getPath('userData'), 'vscode', 'refresh.json');
const PROBLEMS = {
  owner: 'jsgame',
  fileLocation: 'absolute',
  pattern: { regexp: '^(.*)\\((\\d+),(\\d+)\\): (error|warning) (\\S+): (.*)$', file: 1, line: 2, column: 3, severity: 4, code: 5, message: 6 }
};
const task = (label, args, extra = {}) => ({
  label,
  type: 'process',
  command: '${config:jsgame.engine}',
  args: ['${config:jsgame.cli}', ...args],
  options: { env: { ELECTRON_RUN_AS_NODE: '1' } },
  problemMatcher: PROBLEMS,
  presentation: { reveal: 'silent', clear: true },
  ...extra
});
const TASKS = {
  version: '2.0.0',
  tasks: [
    task('JSGame: Kompiluj i odśwież', ['build', '${workspaceFolder}', '--trigger', '${config:jsgame.trigger}'], { group: { kind: 'build', isDefault: true } }),
    task('JSGame: Kompiluj i odśwież (debuger)', ['build', '${workspaceFolder}', '--debug', '--trigger', '${config:jsgame.trigger}'], { hide: true }),
    task('JSGame: Lint', ['lint', '${workspaceFolder}'], { group: 'test' }),
    task('JSGame: Sprawdź TypeScript', ['check', '${workspaceFolder}'], { group: { kind: 'test', isDefault: true } })
  ]
};
const LAUNCH = {
  version: '0.2.0',
  configurations: [
    {
      name: 'JSGame: Debuguj grę',
      type: 'chrome',
      request: 'attach',
      port: DEBUG_PORT,
      urlFilter: '*src/index.html*',
      webRoot: '${workspaceFolder}',
      sourceMaps: true,
      resolveSourceMapLocations: null,
      preLaunchTask: 'JSGame: Kompiluj i odśwież (debuger)'
    }
  ]
};

const safeName = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'Klasa';

function projectDir(project, projectFolder) {
  const dir = projectFolder ? path.join(projectFolder, 'Scripts') : path.join(app.getPath('userData'), 'scripts', safeName(project));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Typ z deklaracji jako tekst (number, string, Punkt…); brak adnotacji — „any”.
const typeText = (node, source) => (node?.type ? node.type.getText(source) : 'any');
const paramsOf = (fn, source) => fn.parameters.map((p) => ({ name: p.name.getText(source), type: typeText(p, source), optional: !!p.questionToken || !!p.initializer }));
const hasModifier = (node, kind) => !!node.modifiers?.some((m) => m.kind === kind);

// Dekoratory jak makra z Unreal Engine: @UCLASS(Blueprintable), @UPROPERTY(EditAnywhere, BlueprintReadWrite, { Category: 'Ruch' }),
// @UFUNCTION(BlueprintCallable). Mówią tylko edytorowi, co widać w Blueprintach — z kodu gry znikają przed kompilacją.
const U_DECORATORS = new Set(['UCLASS', 'UPROPERTY', 'UFUNCTION']);
const decoratorName = (d) => {
  const callee = ts.isCallExpression(d.expression) ? d.expression.expression : d.expression;
  return ts.isIdentifier(callee) ? callee.text : null;
};

// Wartość literału (liczba, tekst, true / false, -5); inne wyrażenia — undefined.
function literalOf(node) {
  if (!node) return undefined;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isStringLiteralLike(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);
  return undefined;
}

// Dekorator name na elemencie: { specifiers: ['EditAnywhere', …], meta: { Category: 'Ruch' } } albo null.
// Specyfikator to nazwa albo tekst, a obiekt { Klucz: wartość } — metadane (Category, DisplayName, ToolTip).
function readDecorator(node, name, sf) {
  const d = (ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : []).find((x) => decoratorName(x) === name);
  if (!d) return null;
  const spec = { specifiers: [], meta: {} };
  (ts.isCallExpression(d.expression) ? d.expression.arguments : []).forEach((arg) => {
    if (ts.isIdentifier(arg) || ts.isStringLiteralLike(arg)) spec.specifiers.push(arg.text);
    else if (ts.isObjectLiteralExpression(arg)) {
      arg.properties.forEach((p) => {
        if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) return;
        spec.meta[p.name.text] = literalOf(p.initializer) ?? p.initializer.getText(sf);
      });
    }
  });
  return spec;
}

// Typ pola: z adnotacji, a bez niej — z wartości początkowej (licznik = 0 → number).
function fieldType(m, sf) {
  if (m.type) return m.type.getText(sf);
  const value = literalOf(m.initializer);
  return value === undefined ? 'any' : typeof value;
}

// Publiczne API pierwszej klasy w pliku (albo tej o nazwie wanted): klasa bazowa, konstruktor, metody i pola z typami.
// Metody i pola z dekoratorami dostają ich specyfikatory (ufunction / uproperty), a klasa — uclass.
function readApi(sf, wanted) {
  const classes = sf.statements.filter((s) => ts.isClassDeclaration(s) && s.name);
  const cls = classes.find((c) => c.name.text === wanted) ?? classes[0];
  if (!cls) return null;
  const base = cls.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression;
  const api = {
    className: cls.name.text,
    base: base && ts.isIdentifier(base) ? base.text : null,
    uclass: readDecorator(cls, 'UCLASS', sf),
    ctor: [],
    ctorDeclared: false,
    methods: [],
    props: []
  };
  cls.members.forEach((m) => {
    if (hasModifier(m, ts.SyntaxKind.PrivateKeyword) || (m.name && ts.isPrivateIdentifier(m.name))) return;
    const isStatic = hasModifier(m, ts.SyntaxKind.StaticKeyword);
    // protected — tylko z dekoratorem (np. BlueprintImplementableEvent wywoływany z wnętrza klasy).
    const ufunction = readDecorator(m, 'UFUNCTION', sf);
    if (hasModifier(m, ts.SyntaxKind.ProtectedKeyword) && !ufunction && !ts.isConstructorDeclaration(m)) return;
    if (ts.isConstructorDeclaration(m)) {
      api.ctor = paramsOf(m, sf);
      api.ctorDeclared = true;
    } else if (ts.isMethodDeclaration(m) && m.name && ts.isIdentifier(m.name)) {
      api.methods.push({ name: m.name.text, static: isStatic, params: paramsOf(m, sf), returns: m.type ? m.type.getText(sf) : 'void', ufunction });
    } else if (ts.isPropertyDeclaration(m) && m.name && ts.isIdentifier(m.name) && !isStatic) {
      const uproperty = readDecorator(m, 'UPROPERTY', sf);
      if (uproperty) api.props.push({ name: m.name.text, type: fieldType(m, sf), value: literalOf(m.initializer) ?? null, uproperty });
    }
  });
  return api;
}

// Kod bez dekoratorów UCLASS / UPROPERTY / UFUNCTION. Ich znaki zamieniamy na spacje (nowe linie zostają),
// więc numery linii i kolumn w błędach kompilacji zgadzają się z plikiem w VS Code.
function stripDecorators(source, sf) {
  const ranges = [];
  const visit = (node) => {
    if (ts.isDecorator(node)) {
      if (U_DECORATORS.has(decoratorName(node))) ranges.push([node.getStart(sf), node.end]);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  let out = source;
  ranges.sort((a, b) => b[0] - a[0]).forEach(([start, end]) => {
    out = out.slice(0, start) + out.slice(start, end).replace(/[^\r\n]/g, ' ') + out.slice(end);
  });
  return out;
}

// TypeScript → JavaScript. Tylko błędy składni — typy sprawdza VS Code.
// „export” jest zbędny (wszystkie klasy gry są w jednym programie), więc znika z wyniku.
// Z plikiem na dysku wynik ma też mapę źródeł (adres data:) — debuger VS Code pokazuje wtedy ten plik zamiast JavaScriptu.
function compile(source, wanted, file = null) {
  const text = String(source ?? '');
  const sf = ts.createSourceFile('klasa.ts', text, ts.ScriptTarget.ES2020, true);
  const out = ts.transpileModule(stripDecorators(text, sf), {
    reportDiagnostics: true,
    fileName: file ?? 'klasa.ts',
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, removeComments: false, sourceMap: !!file }
  });
  const errors = (out.diagnostics ?? []).map((d) => {
    const text = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    if (!d.file || d.start === undefined) return text;
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
    return `${line + 1}:${character + 1} ${text}`;
  });
  const js = out.outputText.replace(/^export\s+(default\s+)?/gm, '').replace(/^import\s.*$/gm, '').replace(/^\/\/# sourceMappingURL=.*$/gm, '').trimEnd();
  const api = readApi(sf, wanted);
  if (!api && !errors.length) errors.push('W pliku nie ma klasy (class Nazwa { … }).');
  return { js, api, errors, map: sourceMap(out.sourceMapText, file) };
}

// Linie wyniku zostają na miejscu (trimEnd wyżej), więc mapa z kompilatora pasuje; źródło — pełny adres pliku .ts.
function sourceMap(text, file) {
  if (!text || !file) return '';
  const map = JSON.parse(text);
  map.sources = [pathToFileURL(file).href];
  delete map.sourceRoot;
  return 'data:application/json;base64,' + Buffer.from(JSON.stringify(map)).toString('base64');
}

const classFile = ({ name, project, dir }) => path.join(projectDir(project, dir), `${safeName(name)}.ts`);
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// .vscode/: launch.json i tasks.json tylko, gdy ich nie ma (można je zmieniać), a w settings.json zawsze aktualne ścieżki programu.
function writeVsCode(dir) {
  const vscode = path.join(dir, '.vscode');
  fs.mkdirSync(vscode, { recursive: true });
  const write = (name, value) => fs.writeFileSync(path.join(vscode, name), JSON.stringify(value, null, 2) + '\n');
  if (!fs.existsSync(path.join(vscode, 'launch.json'))) write('launch.json', LAUNCH);
  if (!fs.existsSync(path.join(vscode, 'tasks.json'))) write('tasks.json', TASKS);
  const file = path.join(vscode, 'settings.json');
  const old = readJson(file);
  // settings.json z komentarzami (JSONC) nie da się bezpiecznie przepisać — zostaje.
  if (fs.existsSync(file) && !old) return;
  const settings = { 'task.saveBeforeRun': 'always', ...old, 'jsgame.engine': process.execPath, 'jsgame.cli': CLI, 'jsgame.trigger': triggerFile() };
  if (JSON.stringify(settings) !== JSON.stringify(old)) write('settings.json', settings);
}

function writeSupport(dir, decl) {
  fs.writeFileSync(path.join(dir, 'jsgame.d.ts'), String(decl ?? ''));
  const config = path.join(dir, 'tsconfig.json');
  if (!fs.existsSync(config)) fs.writeFileSync(config, JSON.stringify(TSCONFIG, null, 2));
  writeVsCode(dir);
}

function stopWatching(id) {
  const entry = files.get(id);
  if (!entry) return;
  entry.watcher?.close();
  clearTimeout(entry.timer);
  files.delete(id);
}

// Zapis w VS Code bywa kilkoma zdarzeniami naraz, więc czekamy chwilę i porównujemy treść.
function watch(id, file, wanted) {
  stopWatching(id);
  const entry = { file, wanted, last: fs.readFileSync(file, 'utf8'), timer: 0, watcher: null };
  entry.watcher = fs.watch(file, () => {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      let source;
      try {
        source = fs.readFileSync(file, 'utf8');
      } catch {
        return;
      }
      if (source === entry.last) return;
      entry.last = source;
      if (sender && !sender.isDestroyed()) sender.send('ts:changed', { id, source, result: compile(source, entry.wanted, file) });
    }, 150);
  });
  files.set(id, entry);
}

// Plik klasy z treścią z projektu. Zmieniona nazwa klasy — stary plik zostaje przeniesiony pod nową nazwę.
function writeClass({ id, name, project, dir: projectFolder, source, decl }) {
  const dir = projectDir(project, projectFolder);
  writeSupport(dir, decl);
  const file = path.join(dir, `${safeName(name)}.ts`);
  const old = files.get(id)?.file;
  if (old && old !== file && fs.existsSync(old)) {
    try {
      fs.renameSync(old, file);
    } catch {
      // Nie udało się przenieść — zapisujemy nowy plik obok.
    }
  }
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== source) fs.writeFileSync(file, String(source ?? ''));
  watch(id, file, name);
  return { dir, file };
}

// VS Code z linii poleceń („code”); bez niego plik otwiera się w programie domyślnym dla .ts.
function openInCode(dir, file) {
  return new Promise((resolve) => {
    let done = false;
    const fallback = async () => {
      if (done) return;
      done = true;
      const error = await shell.openPath(file);
      resolve({ ok: !error, editor: 'default', error: error || null });
    };
    try {
      // Ścieżka danych programu ma spację („JSGame Engine”), a z shell: true argumenty trzeba ująć w cudzysłów.
      const child = spawn(`code "${dir}" "${file}"`, { shell: true, detached: true, stdio: 'ignore', windowsHide: true });
      child.on('error', fallback);
      child.on('exit', (code) => {
        if (code === 0 && !done) {
          done = true;
          resolve({ ok: true, editor: 'vscode', error: null });
        } else fallback();
      });
      child.unref();
    } catch {
      fallback();
    }
  });
}

// Zadanie „Kompiluj i odśwież” z VS Code: plik trigger → edytor wczytuje klasy z dysku (ts:reload) i restartuje grę,
// a odpowiedź (ts:refreshed) trafia do refresh-ack.json, na który czeka jsgame-cli.js.
function watchTrigger() {
  const file = triggerFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let timer = 0;
  let last = null;
  fs.watch(path.dirname(file), (type, name) => {
    if (name !== path.basename(file)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const request = readJson(file);
      if (!request?.id || request.id === last) return;
      last = request.id;
      if (sender && !sender.isDestroyed()) sender.send('ts:refresh', request);
      else answer(request.id, false, 'Edytor nie jest gotowy.');
    }, 50);
  });
}

function answer(id, ok, message) {
  fs.writeFileSync(triggerFile().replace(/\.json$/, '-ack.json'), JSON.stringify({ id, ok, message }));
}

// Klasy projektu prosto z plików .ts (VS Code mógł je zmienić, zanim edytor zaczął je obserwować).
function reload({ request, project, dir, classes }) {
  if (!samePath(projectDir(project, dir), request.dir)) return { ok: false, error: 'W JSGame Engine otwarty jest inny projekt.' };
  return {
    ok: true,
    classes: classes.map((info) => {
      const file = classFile(info);
      if (!fs.existsSync(file)) fs.writeFileSync(file, String(info.source ?? ''));
      const source = fs.readFileSync(file, 'utf8');
      watch(info.id, file, info.name);
      return { id: info.id, source, result: compile(source, info.name, file) };
    })
  };
}

function setupTsHost() {
  watchTrigger();
  // Edytor zgłasza się zaraz po starcie, żeby odświeżenie z VS Code działało bez otwierania klasy.
  ipcMain.handle('ts:listen', (event) => {
    sender = event.sender;
  });
  ipcMain.handle('ts:compile', (event, { source, name, project, dir }) => compile(source, name, project || dir ? classFile({ name, project, dir }) : null));
  ipcMain.handle('ts:reload', (event, info) => {
    try {
      return reload(info);
    } catch (error) {
      return { ok: false, error: String(error?.message ?? error) };
    }
  });
  ipcMain.handle('ts:refreshed', (event, { id, ok, message }) => answer(id, ok, message));
  ipcMain.handle('ts:write', (event, info) => {
    sender = event.sender;
    if (!files.has(info.id)) return { written: false };
    writeClass(info);
    return { written: true };
  });
  ipcMain.handle('ts:open', async (event, info) => {
    sender = event.sender;
    try {
      const { dir, file } = writeClass(info);
      return { ...(await openInCode(dir, file)), file };
    } catch (error) {
      return { ok: false, editor: null, error: String(error?.message ?? error) };
    }
  });
  ipcMain.handle('ts:forget', (event, { id }) => stopWatching(id));
}

module.exports = { setupTsHost, DEBUG_PORT };
