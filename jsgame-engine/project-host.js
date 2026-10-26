// Projekty na dysku (proces główny Electron). Projekt to folder wybrany przy tworzeniu:
//   <Nazwa>/<Nazwa>.jsgame — projekt (JSON), Content/ — zasoby (obrazki, dźwięki), Scripts/ — klasy TypeScript.
// W edytorze zasoby są adresami data: (podgląd, gra i eksport HTML działają bez zmian), a przy zapisie
// każdy trafia do własnego pliku w Content/ (ścieżka jak folder w Przeglądarce zawartości), w projekcie
// zostaje odwołanie „jsgame-asset:Content/…”. Przy wczytaniu pliki wracają jako adresy data:.
const { app, dialog, ipcMain, shell, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const EXT = '.jsgame';
const REF = 'jsgame-asset:';
const DATA_URL = /^data:([\w.+-]+\/[\w.+-]+)?((?:;[^,;]*)*?)(;base64)?,/;
const MIME_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg',
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/flac': 'flac', 'application/json': 'json'
};
const EXT_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm', flac: 'audio/flac', json: 'application/json' };

// Nazwa pliku / folderu bez znaków, których Windows nie przyjmie.
const safeFile = (text, fallback) => String(text ?? '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').trim() || fallback;

// Wszystkie teksty w obiekcie (rekurencyjnie) przepuszczone przez fn(tekst) — zwraca nowy tekst albo ten sam.
function mapStrings(value, fn) {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = mapStrings(value[key], fn);
  }
  return value;
}

function refsOf(text) {
  const refs = new Set();
  try {
    mapStrings(JSON.parse(text), (s) => (s.startsWith(REF) && refs.add(s.slice(REF.length)), s));
  } catch {
    // Uszkodzony stary plik — nic do sprzątania.
  }
  return refs;
}

// Adresy data: → pliki w Content/<folder z Przeglądarki zawartości>/<nazwa zasobu>.<rozszerzenie>.
// Ten sam obrazek użyty w kilku miejscach to jeden plik. Zwraca projekt z odwołaniami i listę plików do zapisania.
function externalize(project) {
  const byUrl = new Map();
  const taken = new Set();
  const files = [];
  const folders = new Map((project.folders ?? []).map((f) => [f.id, f]));
  const folderPath = (id) => {
    const parts = [];
    for (let f = folders.get(id); f && parts.length <= folders.size; f = folders.get(f.parent)) parts.unshift(safeFile(f.name, 'Folder'));
    return parts;
  };
  const convert = (base, dirParts) => (s) => {
    if (s.length < 64) return s;
    const m = DATA_URL.exec(s);
    if (!m) return s;
    if (byUrl.has(s)) return REF + byUrl.get(s);
    const mime = (m[1] || 'application/octet-stream').toLowerCase();
    const payload = s.slice(m[0].length);
    const data = m[3] ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8');
    const ext = MIME_EXT[mime] ?? 'bin';
    let rel;
    for (let i = 1; !rel || taken.has(rel.toLowerCase()); i++) rel = ['Content', ...dirParts, `${base}${i > 1 ? '_' + i : ''}.${ext}`].join('/');
    taken.add(rel.toLowerCase());
    byUrl.set(s, rel);
    files.push({ rel, data });
    return REF + rel;
  };
  (project.blueprints ?? []).forEach((bp) => mapStrings(bp, convert(safeFile(bp.name, 'Zasob'), folderPath(bp.folder))));
  // Reszta projektu (poziomy, aktorzy z własnym obrazkiem) — wspólny folder.
  const rest = convert('Plik', ['Inne']);
  for (const key of Object.keys(project)) if (key !== 'blueprints') project[key] = mapStrings(project[key], rest);
  return { project, files };
}

// Odwołania „jsgame-asset:” → adresy data: z plików w folderze projektu. Brakujący plik — pusty tekst.
function inflate(text, dir) {
  const missing = [];
  const project = mapStrings(JSON.parse(text), (s) => {
    if (!s.startsWith(REF)) return s;
    const rel = s.slice(REF.length);
    const file = path.resolve(dir, rel);
    if (!file.startsWith(path.resolve(dir) + path.sep)) return '';
    try {
      const mime = EXT_MIME[path.extname(file).slice(1).toLowerCase()] ?? 'application/octet-stream';
      return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
    } catch {
      missing.push(rel);
      return '';
    }
  });
  return { text: JSON.stringify(project), missing };
}

function load(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const dir = path.dirname(file);
    return path.extname(file).toLowerCase() === EXT ? { file, dir, ...inflate(text, dir) } : { file: null, dir: null, text, missing: [] };
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
}

// Usuwa puste foldery od dir w górę, aż do Content/.
function pruneDirs(dir, stop) {
  for (let d = dir; d.startsWith(stop + path.sep); d = path.dirname(d)) {
    try {
      fs.rmdirSync(d);
    } catch {
      return;
    }
  }
}

// Zapis: nowe i zmienione pliki zasobów, potem projekt (przez plik tymczasowy), na końcu sprzątanie
// plików, do których stary zapis się odwoływał, a nowy już nie (usunięte albo przemianowane zasoby).
function save({ file, json }) {
  try {
    const dir = path.dirname(file);
    const content = path.join(dir, 'Content');
    const old = fs.existsSync(file) ? refsOf(fs.readFileSync(file, 'utf8')) : new Set();
    const { project, files } = externalize(JSON.parse(json));
    files.forEach(({ rel, data }) => {
      const target = path.join(dir, rel);
      if (fs.existsSync(target) && fs.readFileSync(target).equals(data)) return;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
    });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(project, null, 1));
    fs.renameSync(tmp, file);
    const now = new Set(files.map((f) => f.rel));
    old.forEach((rel) => {
      const target = path.resolve(dir, rel);
      if (now.has(rel) || !target.startsWith(content + path.sep)) return;
      try {
        fs.unlinkSync(target);
        pruneDirs(path.dirname(target), content);
      } catch {
        // Plik już nie istnieje albo jest otwarty w innym programie — zostaje.
      }
    });
    return { ok: true, files: files.length };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

// Nowy projekt: wybór miejsca na dysku, w nim powstaje folder <Nazwa> (z numerem, jeśli już jest zajęty).
async function create(event, { name }) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const res = await dialog.showOpenDialog(win, {
    title: `Gdzie utworzyć projekt „${name}”?`,
    buttonLabel: 'Utwórz projekt tutaj',
    defaultPath: app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory']
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const base = safeFile(name, 'MojaGra');
  let dir = path.join(res.filePaths[0], base);
  for (let i = 2; fs.existsSync(dir); i++) dir = path.join(res.filePaths[0], `${base} ${i}`);
  try {
    fs.mkdirSync(path.join(dir, 'Content'), { recursive: true });
    return { dir, file: path.join(dir, path.basename(dir) + EXT) };
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
}

async function open(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const res = await dialog.showOpenDialog(win, {
    title: 'Otwórz projekt',
    defaultPath: app.getPath('documents'),
    filters: [{ name: 'Projekt JSGame Engine', extensions: ['jsgame', 'json'] }],
    properties: ['openFile']
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return { name: path.basename(res.filePaths[0]), ...load(res.filePaths[0]) };
}

function setupProjectHost() {
  ipcMain.handle('project:create', create);
  ipcMain.handle('project:open', open);
  ipcMain.handle('project:save', (event, info) => save(info));
  // Zapis przy zamykaniu okna musi skończyć się przed zamknięciem, więc idzie synchronicznie.
  ipcMain.on('project:save-sync', (event, info) => {
    event.returnValue = save(info);
  });
  ipcMain.on('project:load-sync', (event, { file }) => {
    event.returnValue = load(file);
  });
  ipcMain.handle('project:reveal', (event, { dir }) => shell.openPath(dir));
}

module.exports = { setupProjectHost };
