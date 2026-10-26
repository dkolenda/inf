// JSGame Engine — edytor gier w stylu Unreal Engine: poziom 2D z aktorami, Blueprinty (programowanie węzłami),
// które kompilują się do TypeScriptu, granie w edytorze (Play) i eksport gry do jednego pliku HTML.
// Działa jako osobna aplikacja desktopowa (Electron, main.js) i zajmuje całe okno.
// Projekt zapisuje się sam co kilka minut (Ustawienia świata › Edytor › Autozapis): w aplikacji desktopowej do folderu
// projektu wybranego przy jego tworzeniu (zasoby jako pliki w Content/, project-host.js), w przeglądarce — w localStorage.
// Silnik gry jest w game-runtime.js, węzły i kompilator w game-blueprints.js.
let ge = null;

const GE_SAVE_KEY = 'game-editor-project';
// Ścieżka pliku .jsgame ostatniego projektu z folderem (aplikacja desktopowa) — otwiera się przy starcie.
const GE_FILE_KEY = 'game-editor-project-file';
const GE_UNDO_LIMIT = 50;
const GE_SNAP = 16;
const GE_SHAPES = [['box', 'Prostokąt'], ['circle', 'Koło / elipsa'], ['triangle', 'Trójkąt'], ['emoji', 'Emoji'], ['text', 'Tekst'], ['image', 'Obrazek'], ['sprite', 'Sprite / animacja'], ['none', 'Niewidoczny']];
const GE_COLLISIONS = [['block', 'Blokuje (BlockAll)'], ['overlap', 'Nakłada się (OverlapAll)'], ['none', 'Brak (NoCollision)']];
const GE_EMOJI = ['🐱', '🐶', '🦊', '🐸', '🐧', '🤖', '👾', '👻', '🧙', '⭐', '🪙', '💎', '🍎', '🍕', '🔥', '💣', '🚀', '🌳', '🧱', '📦', '🏁', '❤️', '⚽', '🌵'];
const GE_KIND_ICON = { event: '◆', exec: 'ƒ', flow: '⇄', pure: 'ƒ', reroute: '•' };
const GE_WORLD_LIMITS = { width: [160, 3840], height: [120, 2160], gravity: [-10000, 10000], killY: [-100000, 100000], grid: [4, 128], autosave: [1, 120], wallHeight: [8, 512], spawnX: [-100000, 100000], spawnY: [-100000, 100000] };
// Klasy z Ustawień świata: GameMode, Player Controller i Default Pawn to Blueprinty aktorów, HUD — Widget Blueprint,
// a Default Mapping Context — Input Mapping Context włączany na start gry.
const GE_WORLD_CLASSES = { gameMode: 'actor', gameInstance: 'actor', playerController: 'actor', defaultPawn: 'actor', hud: 'widget', inputContext: 'input_context' };
const GE_COMMENT_COLORS = [['#ffffff', 'Biały'], ['#4aa3ff', 'Niebieski'], ['#5fd35f', 'Zielony'], ['#ffc83d', 'Żółty'], ['#ff6464', 'Czerwony'], ['#c27bff', 'Fioletowy']];

const geEsc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const geSnap = (value, step = GE_SNAP) => Math.round(value / step) * step;
const geProjectNative = () => window.jsgameNative?.project ?? null;
const geTypeShort = (type) => geType(type).short ?? geType(type).label.match(/\((.+)\)/)?.[1] ?? type;

function openGameEditor() {
  if (ge) return;
  let firstTime = false;
  try {
    firstTime = !localStorage.getItem(GE_SAVE_KEY) && !localStorage.getItem(GE_FILE_KEY);
  } catch {
    // Bez pamięci przeglądarki projekt nie przetrwa odświeżenia, ale edytor działa.
  }
  const root = document.createElement('div');
  root.className = 'ge';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'JSGame Engine');
  root.innerHTML = `
    <header class="ge-menubar">
      <span class="ge-logo" aria-hidden="true">◆</span>
      <strong class="ge-brand">JSGame Engine</strong>
      <nav class="ge-menus" aria-label="Menu edytora">
        <button type="button" data-ge="menu" data-menu="file">Plik</button>
        <button type="button" data-ge="menu" data-menu="edit">Edycja</button>
        <button type="button" data-ge="menu" data-menu="bp">Blueprinty</button>
        <button type="button" data-ge="menu" data-menu="help">Pomoc</button>
      </nav>
      <span class="ge-project"></span>
      <span class="ge-saved" aria-live="polite"></span>
    </header>
    <div class="ge-tabs" role="tablist" aria-label="Otwarte zasoby"></div>
    <div class="ge-page"></div>
    <input class="ge-file" type="file" accept=".json,application/json" hidden />
    <input class="ge-image-file" type="file" accept="image/*" hidden />
    <input class="ge-asset-file" type="file" accept="image/*,audio/*,video/*,.json,application/json" multiple hidden />`;
  document.body.append(root);

  const { project, file, dir, warn } = geLoadProject();
  ge = {
    root,
    project,
    // Plik .jsgame i folder projektu na dysku; null — projekt bez folderu (przeglądarka albo jeszcze niezapisany).
    projectFile: file,
    projectDir: dir,
    tabs: ['level'],
    tab: 'level',
    selActor: null,
    selTile: null,
    // Zaznaczenie w Przeglądarce zawartości (Ctrl/Shift + klik); cbAnchor to punkt startowy zakresu dla Shift.
    cbSel: new Set(),
    cbAnchor: null,
    cbOpen: new Set(['root']),
    // Rozwinięte mapowania klawiszy w edytorze Input Mapping Context (jak strzałki w Unreal Engine).
    imcOpen: new Set(),
    cbFolder: null,
    cbDragFolders: [],
    view: null,
    viewportMode: 'lit',
    // Narzędzie widoku poziomu jak w Unreal Engine: move (W), rotate (E), scale (R).
    vpTool: 'move',
    graphViews: {},
    nodeSel: new Set(),
    bpPanel: null,
    drawer: 'content',
    drawerOpen: true,
    detTab: 'details',
    playing: null,
    undo: [],
    redo: [],
    log: [],
    lastCompile: {},
    dirty: new Set(geAllBlueprints(project).map((bp) => bp.id)),
    codeOpen: true,
    clipboard: null,
    drag: null,
    menu: null,
    ctx: null,
    modal: null,
    saveTimer: 0,
    toastTimer: 0,
    imageTarget: null,
    // Edytor klasy aktora: zakładka (viewport/construction/graph) i widok Viewportu dla każdej karty.
    bpModes: {},
    bpViews: {},
    // Podgląd Construction Script (GE_RT.createPreview) — budowany na nowo po każdej zmianie projektu.
    preview: null,
    previewErrors: new Set()
  };

  root.addEventListener('click', geHandleClick);
  root.addEventListener('change', geHandleChange);
  root.addEventListener('input', geHandleInput);
  root.addEventListener('dblclick', geHandleDblClick);
  root.addEventListener('contextmenu', geHandleContextMenu);
  root.addEventListener('dragstart', geHandleDragStart);
  root.addEventListener('dragend', geCbDragEnd);
  root.addEventListener('pointerdown', (event) => {
    if (ge.menu && !ge.menu.contains(event.target) && !event.target.closest('[data-ge="menu"]')) geCloseMenu();
    if (ge.ctx && !ge.ctx.el.contains(event.target)) geCloseNodeMenu();
  }, true);
  root.querySelector('.ge-file').addEventListener('change', geOpenProjectFile);
  root.querySelector('.ge-image-file').addEventListener('change', geImportImageFile);
  root.querySelector('.ge-asset-file').addEventListener('change', geImportAssetFiles);
  document.addEventListener('keydown', geHandleKey);
  window.addEventListener('beforeunload', () => geSaveNow(true));
  ge.resize = new ResizeObserver(() => {
    geDrawViewport();
    geDrawBpViewport();
    geDrawWidgetViewport();
  });

  gePreloadImages();
  geRender();
  geLog('JSGame Engine gotowy. Pomoc i skróty znajdziesz w menu Pomoc.');
  if (warn) geLog(warn, 'warn');
  else if (file) geLog(`📁 Folder projektu: ${dir}`);
  if (firstTime) geShowHelp();
}

// ---------- Projekt, zapis, cofanie ----------

// Najpierw ostatni projekt z folderu na dysku, potem autozapis z localStorage, a bez nich — przykład.
function geLoadProject() {
  let warn = null;
  const native = geProjectNative();
  let file = null;
  try {
    file = native && localStorage.getItem(GE_FILE_KEY);
  } catch {
    // Bez pamięci przeglądarki nie wiemy, który projekt był otwarty.
  }
  if (file) {
    const res = native.loadSync(file);
    try {
      if (res.error) throw new Error(res.error);
      const project = geNormalizeProject(JSON.parse(res.text));
      if (res.missing.length) warn = `Brakuje plików zasobów w folderze projektu: ${res.missing.join(', ')}.`;
      return { project, file: res.file, dir: res.dir, warn };
    } catch {
      warn = `Nie udało się otworzyć ostatniego projektu (${file}). Otwórz go przez Plik › Otwórz projekt.`;
    }
  }
  try {
    const raw = localStorage.getItem(GE_SAVE_KEY);
    if (raw) return { project: geNormalizeProject(JSON.parse(raw)), file: null, dir: null, warn };
  } catch {
    // Uszkodzony zapis — zaczynamy od przykładu.
  }
  return { project: geMigrateProject(geStarterProject()), file: null, dir: null, warn };
}

function geNormalizeProject(p) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.blueprints) || !Array.isArray(p.actors) || !p.level) {
    throw new Error('To nie jest projekt JSGame Engine.');
  }
  p.name = String(p.name || 'Moja gra');
  p.settings = { ...geNewProject().settings, ...p.settings };
  p.nextId = Number(p.nextId) || 1;
  geNormalizeLevels(p);
  // Level Blueprinty nieotwartych poziomów sprawdzamy tak samo jak resztę.
  const otherLevels = p.levels.filter((l) => l.id !== p.levelId);
  [...geAllBlueprints(p), ...otherLevels.map((l) => l.level)].forEach((bp) => {
    bp.variables = Array.isArray(bp.variables) ? bp.variables : [];
    bp.graph = bp.graph || {};
    bp.graph.nodes = Array.isArray(bp.graph.nodes) ? bp.graph.nodes : [];
    bp.graph.links = Array.isArray(bp.graph.links) ? bp.graph.links : [];
    bp.graph.nodes.forEach((n) => {
      n.props = n.props || {};
      n.values = n.values || {};
    });
    const maxNode = Math.max(0, ...bp.graph.nodes.map((n) => Number(String(n.id).slice(1)) || 0));
    const maxVar = Math.max(0, ...bp.variables.map((v) => Number(String(v.id).slice(1)) || 0));
    bp.nextNode = Math.max(Number(bp.nextNode) || 1, maxNode + 1);
    bp.nextVar = Math.max(Number(bp.nextVar) || 1, maxVar + 1);
    if (bp.id !== 'level') bp.defaults = { ...GE_BP_DEFAULTS, ...bp.defaults };
    if (bp.id === 'level' || ['actor', 'widget', 'anim_bp'].includes(geKind(bp))) geNormalizeFunctions(bp);
  });
  // Zmienne instancji: klucz „idKlasy:idZmiennej” (starsze projekty miały samo id zmiennej).
  geAllActors(p).forEach((a) => {
    a.vars = Object.fromEntries(Object.entries(a.vars || {}).map(([k, v]) => [k.includes(':') ? k : `${a.bp}:${k}`, v]));
  });
  // Foldery Przeglądarki zawartości: { id, name, parent }; parent i bp.folder = null to katalog główny.
  p.folders = Array.isArray(p.folders) ? p.folders.filter((f) => f && f.id) : [];
  const folderIds = new Set(p.folders.map((f) => f.id));
  p.folders.forEach((f) => {
    f.name = String(f.name || 'Folder');
    if (!folderIds.has(f.parent) || f.parent === f.id) f.parent = null;
  });
  p.blueprints.forEach((bp) => {
    if (!folderIds.has(bp.folder)) bp.folder = null;
    // Rodzaj zasobu (GE_KINDS) i jego dane; starsze projekty mają same klasy aktorów.
    bp.kind = geKind(bp);
    if (bp.kind === 'actor' || bp.kind === 'widget') bp.interfaces = Array.isArray(bp.interfaces) ? bp.interfaces : [];
    if (bp.kind === 'widget') bp.widget = { elements: Array.isArray(bp.widget?.elements) ? bp.widget.elements : [] };
    if (bp.kind === 'interface') {
      bp.functions = Array.isArray(bp.functions) ? bp.functions : [];
      bp.properties = (Array.isArray(bp.properties) ? bp.properties : []).filter((v) => v && v.id).map((v) => ({ ...v, type: geIsVarType(v.type) ? v.type : 'float' }));
    }
    if (bp.kind === 'material') bp.material = { ...GE_MATERIAL_DEFAULTS, ...bp.material };
    if (bp.kind === 'texture') bp.texture = { src: null, w: 0, h: 0, ...bp.texture };
    if (bp.kind === 'sprite') bp.sprite = { texture: null, x: 0, y: 0, w: 0, h: 0, ...bp.sprite };
    if (bp.kind === 'animation') bp.flipbook = { ...GE_FLIPBOOK_DEFAULTS, ...bp.flipbook, frames: Array.isArray(bp.flipbook?.frames) ? bp.flipbook.frames : [] };
    if (bp.kind === 'sound') bp.sound = { ...GE_SOUND_DEFAULTS, ...bp.sound };
    geDataAssetDefaults(bp);
    geZdAssetDefaults(bp);
    const list = (x) => (Array.isArray(x) ? x.filter((t) => t && typeof t.type === 'string') : []);
    if (bp.kind === 'input_action') bp.inputAction = { ...GE_INPUT_ACTION_DEFAULTS, ...bp.inputAction, triggers: list(bp.inputAction?.triggers), modifiers: list(bp.inputAction?.modifiers) };
    if (bp.kind === 'input_context') {
      bp.mappingContext = { mappings: (Array.isArray(bp.mappingContext?.mappings) ? bp.mappingContext.mappings : []).filter((m) => m && m.id)
        .map((m) => ({ ...m, action: m.action ?? '', key: m.key ?? '', triggers: list(m.triggers), modifiers: list(m.modifiers) })) };
    }
    const ids = [...(bp.functions ?? []), ...(bp.properties ?? []), ...(bp.widget?.elements ?? []), ...(bp.mappingContext?.mappings ?? [])].map((x) => Number(String(x.id).slice(1)) || 0);
    bp.nextVar = Math.max(bp.nextVar, ...ids.map((n) => n + 1));
    // Klasy aktorów: komponenty (Viewport) i graf Construction Script z jednym węzłem początkowym.
    if (bp.kind === 'actor') geNormalizeComponents(bp);
  });
  // Klasa nadrzędna musi istnieć, być klasą aktora (albo klasą TypeScript) i nie tworzyć pętli.
  p.blueprints.forEach((bp) => {
    if (!bp.parent) return;
    if (bp.kind !== 'actor' || (!geParentOf(p, bp) && !geAsset(p, bp.parent, 'tsclass'))) delete bp.parent;
  });
  p.blueprints.forEach((bp) => {
    for (let a = geParentOf(p, bp), n = 0; a; a = geParentOf(p, a), n++) {
      if (a === bp || n > p.blueprints.length) {
        delete bp.parent;
        break;
      }
    }
  });
  return geMigrateProject(p);
}

function geNormalizeComponents(bp) {
  const taken = [];
  bp.components = (Array.isArray(bp.components) ? bp.components : []).filter((c) => c && GE_COMP_TYPES[c.type]).map((c) => {
    const def = GE_COMP_TYPES[c.type];
    const name = geUniqueName(GE_RT.ident(c.name || def.base), taken);
    taken.push(name);
    return { ...def.defaults, ...c, name };
  });
  const maxComp = Math.max(0, ...bp.components.map((c) => Number(String(c.id).slice(1)) || 0));
  bp.nextComp = Math.max(Number(bp.nextComp) || 1, maxComp + 1);
  const cs = bp.construction;
  if (!cs || !Array.isArray(cs.nodes)) {
    geAddConstruction(bp);
  } else {
    cs.links = Array.isArray(cs.links) ? cs.links : [];
    cs.nodes.forEach((n) => {
      n.props = n.props || {};
      n.values = n.values || {};
    });
    const maxNode = Math.max(0, ...cs.nodes.map((n) => Number(String(n.id).slice(1)) || 0));
    bp.nextNode = Math.max(bp.nextNode, maxNode + 1);
    if (!cs.nodes.some((n) => n.type === 'ev_construction')) cs.nodes.unshift({ id: 'n' + bp.nextNode++, type: 'ev_construction', x: 0, y: 0, props: {}, values: {} });
  }
}

// Własne funkcje: nazwy jako identyfikatory, poprawne piny i graf z węzłem wejścia.
// Id funkcji i pinów liczą się z bp.nextVar, a węzłów ich grafów — z bp.nextNode.
function geNormalizeFunctions(bp) {
  const names = [];
  const pins = (list) => {
    const taken = [];
    return (Array.isArray(list) ? list : []).filter((p) => p?.id && geIsVarType(p.type)).map((p) => {
      const name = geCodeName(p.name, taken);
      taken.push(name);
      return { id: p.id, name, type: p.type };
    });
  };
  bp.funcs = (Array.isArray(bp.funcs) ? bp.funcs : []).filter((f) => f?.id).map((f) => {
    const name = geCodeName(f.name || 'Funkcja', names);
    names.push(name);
    const graph = { nodes: Array.isArray(f.graph?.nodes) ? f.graph.nodes : [], links: Array.isArray(f.graph?.links) ? f.graph.links : [] };
    graph.nodes.forEach((n) => {
      n.props = n.props || {};
      n.values = n.values || {};
    });
    return { id: f.id, name, inputs: pins(f.inputs), outputs: pins(f.outputs), graph };
  });
  // Event Dispatchery: id dispatcherów i ich parametrów też liczą się z bp.nextVar.
  bp.dispatchers = (Array.isArray(bp.dispatchers) ? bp.dispatchers : []).filter((d) => d?.id).map((d) => ({
    id: d.id, name: String(d.name || 'Dispatcher'), inputs: (Array.isArray(d.inputs) ? d.inputs : []).filter((p) => p?.id && geIsVarType(p.type)).map((p) => ({ id: p.id, name: String(p.name || 'Parametr'), type: p.type }))
  }));
  bp.dispatchers.forEach((d) => [d, ...d.inputs].forEach((x) => { bp.nextVar = Math.max(bp.nextVar, (Number(String(x.id).slice(1)) || 0) + 1); }));
  bp.funcs.forEach((f) => {
    const ids = [f, ...f.inputs, ...f.outputs].map((x) => Number(String(x.id).slice(1)) || 0);
    bp.nextVar = Math.max(bp.nextVar, ...ids.map((n) => n + 1));
    bp.nextNode = Math.max(bp.nextNode, ...f.graph.nodes.map((n) => (Number(String(n.id).slice(1)) || 0) + 1));
    if (!f.graph.nodes.some((n) => n.type === 'fn_entry')) f.graph.nodes.unshift({ id: 'n' + bp.nextNode++, type: 'fn_entry', x: 0, y: 0, props: { fn: f.id }, values: {} });
  });
}

// Zmiana czeka na najbliższy autozapis — licznik startuje przy pierwszej zmianie po zapisie.
function geScheduleSave() {
  ge.root.querySelector('.ge-saved').textContent = '● Niezapisane zmiany';
  if (!ge.saveTimer) ge.saveTimer = setTimeout(geSaveNow, (ge.project.settings.autosave || 5) * 60000);
}

// Projekt z folderem zapisuje się na dysk (sync — przy zamykaniu okna, zanim zniknie), bez folderu — w localStorage.
function geSaveNow(sync = false) {
  if (!ge) return;
  clearTimeout(ge.saveTimer);
  ge.saveTimer = 0;
  const label = ge.root.querySelector('.ge-saved');
  const native = geProjectNative();
  if (native && ge.projectFile) {
    const file = ge.projectFile;
    const done = (res) => {
      if (res?.ok) {
        label.textContent = '✓ Zapisano';
        return;
      }
      label.textContent = '⚠ Nie udało się zapisać';
      geLog(`Nie udało się zapisać projektu do ${file}: ${res?.error ?? 'nieznany błąd'}`, 'error');
    };
    const json = JSON.stringify(ge.project);
    if (sync) done(native.saveSync(file, json));
    else native.save(file, json).then(done, (err) => done({ ok: false, error: err?.message }));
    try {
      localStorage.setItem(GE_FILE_KEY, file);
      localStorage.removeItem(GE_SAVE_KEY);
    } catch {
      // Bez pamięci przeglądarki projekt trzeba będzie otworzyć ręcznie.
    }
    return;
  }
  try {
    localStorage.setItem(GE_SAVE_KEY, JSON.stringify(ge.project));
    localStorage.removeItem(GE_FILE_KEY);
    label.textContent = native ? '✓ Zapisano (bez folderu — Ctrl+S wybierze folder)' : '✓ Zapisano';
  } catch {
    label.textContent = native ? '⚠ Za duży do autozapisu — zapisz go w folderze (Ctrl+S)' : '⚠ Za duży do autozapisu — zapisz do pliku';
  }
}

// Napis z nazwą projektu w pasku menu; dymek pokazuje, gdzie projekt leży na dysku.
function geShowProjectName() {
  const el = ge.root.querySelector('.ge-project');
  el.textContent = ge.project.name;
  el.title = ge.projectFile ? `Folder projektu: ${ge.projectDir}` : 'Projekt bez folderu na dysku';
}

// Stany do cofnięcia nie przechowują kopii obrazków i dźwięków (długie napisy data:, nawet po kilka MB):
// każdy taki napis leży raz w tablicy zasobów, a stan ma tylko jego numer. Bez tego 50 kroków cofania
// zajmowałoby setki MB, a każdy krok trwałby długo przy dużym projekcie.
const GE_HISTORY_ASSET = '\u0000ge-asset:';
const geHistoryAssets = { ids: new Map(), list: [] };
function geHistoryPack(project) {
  return JSON.stringify(project, (key, value) => {
    if (typeof value !== 'string' || value.length < 2048) return value;
    let id = geHistoryAssets.ids.get(value);
    if (id === undefined) {
      id = geHistoryAssets.list.push(value) - 1;
      geHistoryAssets.ids.set(value, id);
    }
    return GE_HISTORY_ASSET + id;
  });
}
function geHistoryUnpack(text) {
  return JSON.parse(text, (key, value) => (typeof value === 'string' && value.startsWith(GE_HISTORY_ASSET) ? geHistoryAssets.list[Number(value.slice(GE_HISTORY_ASSET.length))] : value));
}

function geSnapshot() {
  ge.preview = null;
  ge.undo.push(geHistoryPack(ge.project));
  if (ge.undo.length > GE_UNDO_LIMIT) ge.undo.shift();
  ge.redo.length = 0;
}

function geUndo() {
  if (!ge.undo.length) return;
  ge.redo.push(geHistoryPack(ge.project));
  ge.project = geHistoryUnpack(ge.undo.pop());
  geAfterHistory();
}

function geRedo() {
  if (!ge.redo.length) return;
  ge.undo.push(geHistoryPack(ge.project));
  ge.project = geHistoryUnpack(ge.redo.pop());
  geAfterHistory();
}

function geAfterHistory() {
  ge.tabs = ge.tabs.filter((id) => geBp(id));
  if (!ge.tabs.includes(ge.tab)) ge.tab = 'level';
  if (!ge.project.actors.some((a) => a.id === ge.selActor)) ge.selActor = null;
  ge.nodeSel.clear();
  ge.preview = null;
  ge.dirty = new Set(geAllBlueprints(ge.project).map((bp) => bp.id));
  geScheduleSave();
  geRender();
}

// Każda zmiana projektu przechodzi tędy: zapamiętuje stan do cofnięcia, zapisuje i odświeża
// wybrane części ekranu (only), żeby nie przebudowywać wszystkiego przy każdej literce.
function geChange(fn, { bp = null, only = null } = {}) {
  geSnapshot();
  fn();
  if (bp) ge.dirty.add(bp);
  geScheduleSave();
  geRefresh(only);
}

function geRefresh(only = null) {
  const want = (part) => !only || only.includes(part);
  if (want('title')) geShowProjectName();
  if (want('tabs')) geRenderTabs();
  if (ge.tab === 'level') {
    if (want('outliner')) geRenderOutliner();
    if (want('details')) geRenderDetails();
    if (want('drawer')) geRenderDrawer();
    if (want('viewport')) geDrawViewport();
  } else if (geIsAssetTab()) {
    if (want('details')) geRenderAssetPage();
    else if (want('preview')) geDrawAssetPreview();
  } else {
    if (want('components')) geRenderComponents();
    if (want('mybp')) geRenderMyBp();
    if (want('graph')) geRenderGraph();
    if (want('graph') || want('mybp')) geZdRenderGraph();
    if (want('graph') || want('timeline')) geRenderTimeline();
    if (want('details')) geRenderBpDetails();
    else if (want('preview')) geDrawPreview();
    if (want('code')) geRefreshCode();
    if (['components', 'graph', 'details', 'preview', 'bpview'].some(want)) geDrawBpViewport();
    if (['components', 'details'].some(want)) geRenderWdPanels();
    if (['components', 'details', 'preview', 'bpview'].some(want)) geDrawWidgetViewport();
  }
}

// Karta „level” to edytor poziomu, a karta „level-bp” to Level Blueprint (w projekcie ma id „level”).
const geBp = (id) => (id === 'level' || id === 'level-bp' ? ge.project.level : ge.project.blueprints.find((bp) => bp.id === id));
const geCurBp = () => (ge.tab === 'level' ? null : geBp(ge.tab));
const geTabFor = (bpId) => (bpId === 'level' ? 'level-bp' : bpId);
const geSelActor = () => ge.project.actors.find((a) => a.id === ge.selActor) || null;
const geLevelName = () => geCurLevel(ge.project)?.name ?? 'Poziom';
// Player Start (miejsce startu gracza) zaznacza się w Widoku jak aktor — pod tym specjalnym id.
const GE_SPAWN_ID = '@player-start';
const geHasSpawn = () => !!ge.project.settings.playerStart;
const geSpawnSel = () => geHasSpawn() && ge.selActor === GE_SPAWN_ID;
const geKindIcon = (bp) => (bp.id === 'level' ? '📜' : GE_KINDS[geKind(bp)].icon);
const geOfKind = (kind) => ge.project.blueprints.filter((b) => geKind(b) === kind);
// Zakładka edytora klasy aktora: viewport, construction albo graph (Level Blueprint i widgety mają tylko graf).
const geHasViewport = (bp) => !!bp && geKind(bp) === 'actor';
const geIsWidgetBp = (bp) => !!bp && geKind(bp) === 'widget';
// Karty edytora klasy: aktor — Viewport, Construction Script i Event Graph, widget — Projektant i Event Graph,
// Animation Blueprint — Anim Graph (maszyna stanów, game-paperzd.js) i Event Graph.
const geIsAnimBp = (bp) => !!bp && geKind(bp) === 'anim_bp';
const geBpModes = (bp) => (geHasViewport(bp) ? ['viewport', 'construction', 'graph'] : geIsWidgetBp(bp) ? ['designer', 'graph'] : geIsAnimBp(bp) ? ['animgraph', 'graph'] : ['graph']);
const GE_MODE_LABELS = { viewport: '🧊 Viewport', construction: 'ƒ Construction Script', graph: '📈 Event Graph', designer: '🪟 Projektant', animgraph: '🏃 Anim Graph' };
// Oprócz nich karta „fn:<id>” — graf własnej funkcji (jest, dopóki funkcja istnieje).
const geModeFn = (bp, mode) => (String(mode).startsWith('fn:') ? bp?.funcs?.find((f) => f.id === mode.slice(3)) ?? null : null);
// Karta „tl:<id węzła>” — edytor Timeline'u z Event Graph (game-timeline.js), jest, dopóki węzeł istnieje.
const geModeTl = (bp, mode) => (String(mode).startsWith('tl:') ? geTlNodes(bp).find((n) => n.id === mode.slice(3)) ?? null : null);
const geModeOk = (bp, mode) => geBpModes(bp).includes(mode) || !!geModeFn(bp, mode) || !!geModeTl(bp, mode);
const geMode = () => {
  const bp = geCurBp();
  const mode = ge.bpModes[ge.tab] ?? (geIsWidgetBp(bp) ? 'designer' : geIsAnimBp(bp) ? 'animgraph' : 'graph');
  return geModeOk(bp, mode) ? mode : 'graph';
};
const geCurFn = () => geModeFn(geCurBp(), geMode());
const geCurTl = () => geModeTl(geCurBp(), geMode());
// Graf pokazany na karcie: Event Graph, Construction Script albo graf funkcji.
const geCurGraph = () => {
  const bp = geCurBp();
  const fn = geCurFn();
  return bp && (fn ? fn.graph : geMode() === 'construction' ? bp.construction : bp.graph);
};
const geGraphKey = () => `${ge.tab}:${geMode()}`;
const geNodeById = (id) => geCurGraph()?.nodes.find((n) => n.id === id) || null;

function geUniqueName(base, taken) {
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(base + i)) i++;
  return base + i;
}

function gePreloadImages() {
  ge.project.blueprints.forEach((bp) => {
    [bp.defaults?.image, bp.texture?.src, ...(bp.components ?? []).map((c) => c.image)].filter(Boolean).forEach((src) => {
      GE_RT.whenImageReady(src, () => {
        if (!ge) return;
        geDrawViewport();
        if (ge.tab === 'level' && ge.drawer === 'content') geRenderDrawer();
        geDrawPreview();
        geDrawBpViewport();
        if (geIsAssetTab()) geDrawAssetPreview();
      });
    });
  });
}

// ---------- Karty ----------

function geRender() {
  geShowProjectName();
  geRenderTabs();
  geCloseNodeMenu();
  geCloseMenu();
  const page = ge.root.querySelector('.ge-page');
  ge.resize.disconnect();
  if (ge.tab === 'level') geBuildLevelPage(page);
  else if (geIsAssetTab()) geBuildAssetPage(page);
  else geBuildBpPage(page);
}

function geRenderTabs() {
  ge.root.querySelector('.ge-tabs').innerHTML = ge.tabs.map((id) => {
    const bp = geBp(id);
    const label = id === 'level' ? `🗺️ ${ge.project.name} › ${geLevelName()}` : id === 'level-bp' ? `📜 Level Blueprint (${geLevelName()})` : `${geKindIcon(bp)} ${bp.name}`;
    const active = id === ge.tab;
    return `<div class="ge-tab${active ? ' is-active' : ''}" role="presentation">
      <button type="button" role="tab" aria-selected="${active}" data-ge="tab" data-id="${id}">${geEsc(label)}</button>
      ${id === 'level' ? '' : `<button class="ge-tab-x" type="button" data-ge="tab-close" data-id="${id}" aria-label="Zamknij kartę ${geEsc(bp.name)}">×</button>`}
    </div>`;
  }).join('');
}

function geOpenTab(id) {
  if (!geBp(id)) return;
  geStopPlay();
  if (!ge.tabs.includes(id)) ge.tabs.push(id);
  ge.tab = id;
  ge.nodeSel.clear();
  ge.bpPanel = null;
  ge.widgetSel = null;
  geRender();
}

function geCloseTab(id) {
  ge.tabs = ge.tabs.filter((tab) => tab !== id);
  if (ge.tab === id) {
    ge.tab = ge.tabs[ge.tabs.length - 1];
    ge.nodeSel.clear();
    ge.bpPanel = null;
  }
  geRender();
}

// ---------- Edytor poziomu ----------

const GE_VIEW_MODES = [
  ['lit', 'Oświetlony'],
  ['collision', 'Kolizja'],
  ['lights', 'Światła']
];

// Narzędzia transformacji w widoku poziomu: [id, ikona, nazwa, skrót].
const GE_VP_TOOLS = [
  ['move', '✥', 'Przesuń', 'W'],
  ['rotate', '⟳', 'Obróć', 'E'],
  ['scale', '⤢', 'Skaluj', 'R']
];

function geSetVpTool(tool) {
  ge.vpTool = tool;
  ge.root.querySelectorAll('[data-ge="vp-tool"]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.id === tool)));
  geDrawViewport();
}

function geBuildLevelPage(page) {
  page.className = 'ge-page ge-level' + (ge.drawerOpen ? '' : ' is-drawer-closed');
  page.innerHTML = `
    <div class="ge-toolbar">
      <button type="button" data-ge="save" title="Zapisz projekt do pliku (Ctrl+S)"><span class="ge-ic">💾</span>Zapisz</button>
      <span class="ge-sep"></span>
      <button type="button" data-ge="menu" data-menu="levels" title="Poziomy gry: przełącz, dodaj nowy, zmień nazwę"><span class="ge-ic">🗺️</span>${geEsc(geLevelName())} ▾</button>
      <span class="ge-sep"></span>
      <button type="button" data-ge="menu" data-menu="add"><span class="ge-ic ge-ic-green">＋</span>Dodaj ▾</button>
      <button type="button" data-ge="menu" data-menu="blueprints"><span class="ge-ic">📘</span>Blueprinty ▾</button>
      <span class="ge-sep"></span>
      <div class="ge-play-group">
        <button class="ge-play" type="button" data-ge="play" title="Graj w edytorze (Alt+P)" aria-label="Graj"><span>▶</span></button>
        <button class="ge-stop" type="button" data-ge="stop" title="Zatrzymaj (Esc)" aria-label="Zatrzymaj"><span>■</span></button>
        <button type="button" data-ge="play-tab" title="Graj w nowym oknie" aria-label="Graj w nowym oknie">⧉</button>
      </div>
      <span class="ge-sep"></span>
      <button type="button" data-ge="menu" data-menu="platforms"><span class="ge-ic">🌐</span>Platformy ▾</button>
      <span class="ge-fill"></span>
      <button type="button" data-ge="world"><span class="ge-ic">⚙</span>Ustawienia świata</button>
    </div>
    <div class="ge-level-main">
      <section class="ge-panel ge-vp-panel">
        <div class="ge-panel-head"><span class="ge-panel-tab">Widok</span></div>
        <div class="ge-viewport" tabindex="0" aria-label="Widok poziomu — przeciągnij tu Blueprint z Przeglądarki zawartości">
          <canvas class="ge-vp-canvas"></canvas>
          <div class="ge-vp-bar">
            <span class="ge-chip">⬚ 2D</span>
            <label class="ge-chip ge-view-mode" title="Sposób wyświetlania poziomu w edytorze">
              <select data-ge="view-mode" aria-label="Tryb widoku">${GE_VIEW_MODES.map(([id, label]) => `<option value="${id}"${ge.viewportMode === id ? ' selected' : ''}>${label}</option>`).join('')}</select>
            </label>
            <span class="ge-chip ge-view-mode-info"></span>
            <span class="ge-fill"></span>
            <span class="ge-chip ge-vp-tools" role="group" aria-label="Narzędzie transformacji">${GE_VP_TOOLS.map(([id, icon, label, key]) => `<button type="button" data-ge="vp-tool" data-id="${id}" title="${label} (${key})" aria-label="${label}" aria-pressed="${ge.vpTool === id}">${icon}</button>`).join('')}</span>
            <label class="ge-chip" title="Przyciąganie do siatki (Shift — bez przyciągania)">▦
              <select data-scope="world" data-k="grid" aria-label="Siatka">${[8, 16, 32, 64].map((n) => `<option value="${n}"${ge.project.settings.grid === n ? ' selected' : ''}>${n}</option>`).join('')}</select>
            </label>
            <span class="ge-chip ge-vp-zoom">100%</span>
          </div>
          <div class="ge-vp-note">▶ Granie w edytorze — <b>Esc</b> kończy</div>
        </div>
      </section>
      <div class="ge-right">
        <section class="ge-panel ge-outliner">
          <div class="ge-panel-head"><span class="ge-panel-tab">Outliner</span></div>
          <input class="ge-search" type="search" placeholder="Szukaj…" data-filter="outliner" aria-label="Szukaj aktorów" />
          <div class="ge-list-head"><span>Etykieta aktora</span><span>Typ</span></div>
          <div class="ge-outliner-list" role="listbox" aria-label="Aktorzy na poziomie"></div>
          <div class="ge-panel-foot"></div>
        </section>
        <section class="ge-panel ge-details">
          <div class="ge-panel-head">
            <button class="ge-panel-tab" type="button" data-ge="det-tab" data-id="details">Szczegóły</button>
            <button class="ge-panel-tab" type="button" data-ge="det-tab" data-id="world">🌍 Ustawienia świata</button>
          </div>
          <div class="ge-details-body"></div>
        </section>
      </div>
    </div>
    <section class="ge-panel ge-drawer">
      <div class="ge-panel-head">
        <button class="ge-panel-tab" type="button" data-ge="drawer" data-id="content">📁 Przeglądarka zawartości</button>
        <button class="ge-panel-tab" type="button" data-ge="drawer" data-id="log">📜 Dziennik</button>
        <span class="ge-fill"></span>
        <button class="ge-drawer-toggle" type="button" data-ge="drawer-toggle" title="Zwiń / rozwiń panel" aria-label="Zwiń / rozwiń panel"></button>
      </div>
      <div class="ge-drawer-body"></div>
    </section>`;
  const vp = page.querySelector('.ge-viewport');
  vp.addEventListener('pointerdown', geVpDown);
  vp.addEventListener('pointermove', geVpMove);
  vp.addEventListener('pointerup', geVpUp);
  vp.addEventListener('pointercancel', geVpUp);
  vp.addEventListener('wheel', geVpWheel, { passive: false });
  vp.addEventListener('dblclick', (event) => {
    const p = geVpPoint(event);
    const actor = geActorAt(p.wx, p.wy);
    if (actor && !ge.playing) geOpenTab(actor.bp);
  });
  vp.addEventListener('dragover', (event) => {
    if (!event.dataTransfer.types.includes('application/x-ge-bp')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  vp.addEventListener('drop', (event) => {
    const id = event.dataTransfer.getData('application/x-ge-bp');
    if (!id || ge.playing) return;
    event.preventDefault();
    const p = geVpPoint(event);
    gePlaceActor(id, p.wx, p.wy);
  });
  ge.resize.observe(vp);
  geRenderOutliner();
  geRenderDetails();
  geRenderDrawer();
  geDrawViewport();
}

// Wygląd aktora prosto z ustawień klasy (bez Construction Script) — gdy podgląd się nie uda.
function geActorLook(a) {
  const bp = geBp(a.bp);
  const base = bp ? geResolveDefaults(ge.project, bp) : { shape: 'box', color: '#ff00ff', w: 32, h: 32 };
  return { ...base, components: bp ? geLookComponents(ge.project, bp) : [], x: a.x, y: a.y, rotation: a.rotation, scaleX: a.scaleX, scaleY: a.scaleY, visible: true };
}

// Podgląd Construction Script: skompilowany program i silnik bez pętli gry. Budowany leniwie
// i unieważniany przy każdej zmianie projektu (geSnapshot, cofanie).
function gePreview() {
  if (ge.preview) return ge.preview;
  const hooks = {
    onPrint: () => {},
    onError: (text) => {
      if (ge.previewErrors.has(text)) return;
      ge.previewErrors.add(text);
      geLog('Construction Script (podgląd w edytorze): ' + text, 'warn');
    }
  };
  const data = geGameData(ge.project);
  try {
    ge.preview = GE_RT.createPreview(data, new Function('runtime', geCompileProject(ge.project).code), hooks);
  } catch {
    ge.preview = GE_RT.createPreview(data, () => [], hooks);
  }
  return ge.preview;
}

// Wygląd aktorów (instancji z poziomu albo z Viewportu klasy) po Construction Script.
function gePreviewLooks(instances) {
  try {
    return gePreview()(instances);
  } catch {
    return instances.map(geActorLook);
  }
}

// Aktorzy poziomu z wyglądem, w kolejności rysowania (warstwa Z).
// W trakcie przesuwania widoku albo aktora Construction Script nie liczy się od nowa przy każdym ruchu
// myszy: wygląd zostaje z początku przeciągania, a przeciągany aktor jest tylko przesunięty. Po puszczeniu
// myszy (geVpUp) widok rysuje się od nowa, już z Construction Script.
function geLevelLooks() {
  const actors = ge.project.actors;
  const d = ge.drag;
  const steady = d && (d.mode === 'pan' || (d.mode === 'move' && (d.id === GE_SPAWN_ID || d.tool === 'move')));
  if (!steady) {
    const looks = gePreviewLooks(actors);
    return actors.map((actor, i) => ({ actor, look: looks[i] ?? geActorLook(actor) }))
      .sort((p, q) => (p.look.z ?? 0) - (q.look.z ?? 0));
  }
  let c = d.looks;
  if (!c || c.preview !== ge.preview || c.actors !== actors || c.n !== actors.length) {
    const fresh = gePreviewLooks(actors);
    const looks = actors.map((actor, i) => fresh[i] ?? geActorLook(actor));
    c = d.looks = { preview: ge.preview, actors, n: actors.length, looks, from: actors.map((a) => [a.x, a.y]), base: looks.map((l) => [l.x, l.y]) };
  }
  actors.forEach((a, i) => {
    c.looks[i].x = c.base[i][0] + (a.x - c.from[i][0]);
    c.looks[i].y = c.base[i][1] + (a.y - c.from[i][1]);
  });
  return actors.map((actor, i) => ({ actor, look: c.looks[i] })).sort((p, q) => (p.look.z ?? 0) - (q.look.z ?? 0));
}

// Przerysowanie widoku najwyżej raz na klatkę ekranu — mysz potrafi zgłaszać ruch setki razy na sekundę.
let geViewportFrame = 0;
function geQueueViewport() {
  if (geViewportFrame) return;
  geViewportFrame = requestAnimationFrame(() => {
    geViewportFrame = 0;
    geDrawViewport();
  });
}

const geShapeParts = (look) => (look.components ?? []).filter((c) => geCompKind(c) === 'shape' && c.visible !== false);

// Punkt świata w układzie obiektu o środku (ox, oy) obróconego o deg stopni.
function geToLocal(x, y, ox, oy, deg) {
  const r = (-(deg || 0) * Math.PI) / 180;
  const dx = x - (ox || 0);
  const dy = y - (oy || 0);
  return { x: dx * Math.cos(r) - dy * Math.sin(r), y: dx * Math.sin(r) + dy * Math.cos(r) };
}

// Czy punkt trafia w aktora albo w któryś jego komponent kształtu (min — najmniejszy uchwyt w świecie).
function geLookHit(look, wx, wy, min) {
  const sx = look.scaleX ?? 1;
  const sy = look.scaleY ?? 1;
  const p = geToLocal(wx, wy, look.x, look.y, look.rotation);
  const inside = (q, w, h) => Math.abs(q.x) <= Math.max(Math.abs(w * sx) / 2, min) && Math.abs(q.y) <= Math.max(Math.abs(h * sy) / 2, min);
  if (inside(p, look.w, look.h)) return true;
  return geShapeParts(look).some((c) => inside(geToLocal(p.x, p.y, c.x * sx, c.y * sy, c.rotation), c.w, c.h));
}

function geActorAt(wx, wy) {
  const min = 6 / (ge.view?.zoom ?? 1);
  return geLevelLooks().reverse().find(({ look }) => geLookHit(look, wx, wy, min))?.actor || null;
}

// Rysuje wygląd aktora w edytorze: niewidzialny aktor jako przerywaną ramkę, ukryty przez
// Construction Script — półprzezroczyście, do tego obrysy komponentów kolizji.
function geDrawLook(ctx, look, zoom) {
  const sx = look.scaleX ?? 1;
  const sy = look.scaleY ?? 1;
  if (look.shape === 'none' && !geShapeParts(look).length) {
    ctx.save();
    ctx.translate(look.x, look.y);
    ctx.rotate(((look.rotation || 0) * Math.PI) / 180);
    ctx.setLineDash([4 / zoom, 3 / zoom]);
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    const bw = Math.abs(look.w * sx);
    const bh = Math.abs(look.h * sy);
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    ctx.restore();
  } else {
    ctx.save();
    if (look.visible === false) ctx.globalAlpha = 0.35;
    GE_RT.drawActor(ctx, look);
    ctx.restore();
  }
  // Komponenty kolizji są w grze niewidoczne; w edytorze mają obrys (pomarańczowy — nakłada się, niebieski — blokuje).
  const colliders = (look.components ?? []).filter((c) => geCompKind(c) === 'collision');
  if (!colliders.length) return;
  ctx.save();
  ctx.translate(look.x, look.y);
  ctx.rotate(((look.rotation || 0) * Math.PI) / 180);
  ctx.scale(sx, sy);
  colliders.forEach((c) => {
    ctx.setLineDash(c.collisionEnabled === false ? [2 / zoom, 4 / zoom] : [6 / zoom, 4 / zoom]);
    geOutline(ctx, c, zoom * Math.max(0.01, Math.abs(sx)), c.collision === 'block' ? '#4aa3ff' : '#ff9f1a', 1.5);
  });
  ctx.restore();
}

// Widok diagnostyczny kolizji. Pokazuje własną kolizję aktora i wszystkie komponenty,
// które biorą udział w blokowaniu lub zdarzeniach overlap.
function geDrawCollisionLook(ctx, look, zoom) {
  ctx.save();
  ctx.globalAlpha = 0.1;
  GE_RT.drawActor(ctx, { ...look, glow: 0 });
  ctx.restore();

  const drawCollider = (c, color, disabled = false, scaleCorrection = 1) => {
    ctx.save();
    ctx.translate(Number(c.x) || 0, Number(c.y) || 0);
    ctx.rotate(((Number(c.rotation) || 0) * Math.PI) / 180);
    const w = Math.abs(Number(c.w) || 1);
    const h = Math.abs(Number(c.h) || 1);
    const round = c.type === 'circle' || c.type === 'circle_collision';
    ctx.beginPath();
    if (round) ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.globalAlpha = disabled ? 0.08 : 0.2;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = disabled ? 0.65 : 1;
    ctx.lineWidth = 2 / (zoom * Math.max(0.01, scaleCorrection));
    ctx.strokeStyle = color;
    ctx.setLineDash(disabled ? [3 / zoom, 5 / zoom] : []);
    ctx.stroke();
    ctx.restore();
  };
  const color = (mode) => mode === 'block' ? '#4aa3ff' : mode === 'overlap' ? '#ff9f1a' : '#7f8994';
  const sx = look.scaleX ?? 1;
  const sy = look.scaleY ?? 1;

  // Główna kolizja aktora jest w silniku prostokątem bez obrotu.
  drawCollider({ x: look.x, y: look.y, w: look.w * sx, h: look.h * sy, type: 'box' }, color(look.collision), look.collision === 'none');

  ctx.save();
  ctx.translate(look.x, look.y);
  ctx.rotate(((look.rotation || 0) * Math.PI) / 180);
  ctx.scale(sx, sy);
  (look.components ?? []).forEach((c) => {
    if (!['shape', 'collision'].includes(geCompKind(c))) return;
    if (c.collision === 'none' && geCompKind(c) !== 'collision') return;
    drawCollider(c, color(c.collision), c.collisionEnabled === false || c.collision === 'none', Math.max(Math.abs(sx), Math.abs(sy)));
  });
  ctx.restore();
}

// „Światła” izolują materiały emisyjne: reszta sceny zostaje tylko jako delikatny kontekst.
function geDrawLightsLook(ctx, look) {
  ctx.save();
  ctx.globalAlpha = 0.1;
  GE_RT.drawActor(ctx, { ...look, glow: 0 });
  ctx.restore();
  if (!(Number(look.glow) > 0) || look.visible === false) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  GE_RT.drawShape(ctx, look);
  ctx.restore();
}

// Obrys prostokąta albo elipsy części { type, x, y, w, h, rotation } w bieżącym układzie.
function geOutline(ctx, c, zoom, color, width = 2) {
  const round = c.type === 'circle' || c.type === 'circle_collision';
  const w = Math.abs(Number(c.w) || 1);
  const h = Math.abs(Number(c.h) || 1);
  ctx.save();
  ctx.translate(Number(c.x) || 0, Number(c.y) || 0);
  ctx.rotate(((Number(c.rotation) || 0) * Math.PI) / 180);
  ctx.lineWidth = width / zoom;
  ctx.strokeStyle = color;
  ctx.beginPath();
  if (round) ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  else ctx.rect(-w / 2, -h / 2, w, h);
  ctx.stroke();
  ctx.restore();
}

function geVpPoint(event) {
  const r = ge.root.querySelector('.ge-viewport').getBoundingClientRect();
  const sx = event.clientX - r.left;
  const sy = event.clientY - r.top;
  return { sx, sy, wx: ge.view.x + sx / ge.view.zoom, wy: ge.view.y + sy / ge.view.zoom };
}

function geToScreen(wx, wy) {
  return { x: (wx - ge.view.x) * ge.view.zoom, y: (wy - ge.view.y) * ge.view.zoom };
}

// Uchwyt przesuwania (gizmo) o środku c na ekranie: czerwona strzałka X, zielona Y, żółty kwadrat — obie osie.
// Dla obrotu — okrąg o promieniu 60 ('rot'), skala ma te same uchwyty co przesuwanie.
function geGizmoHit(c, sx, sy, tool = 'move') {
  if (tool === 'rotate') return Math.abs(Math.hypot(sx - c.x, sy - c.y) - 60) <= 8 ? 'rot' : null;
  if (sx >= c.x + 4 && sx <= c.x + 24 && sy >= c.y + 4 && sy <= c.y + 24) return 'xy';
  if (Math.abs(sy - c.y) <= 7 && sx >= c.x + 10 && sx <= c.x + 78) return 'x';
  if (Math.abs(sx - c.x) <= 7 && sy >= c.y + 10 && sy <= c.y + 78) return 'y';
  return null;
}

function geDrawViewport() {
  if (!ge || ge.tab !== 'level' || ge.playing) return;
  const vp = ge.root.querySelector('.ge-viewport');
  const canvas = vp?.querySelector('.ge-vp-canvas');
  if (!canvas) return;
  const w = vp.clientWidth;
  const h = vp.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const s = ge.project.settings;
  if (!ge.view) {
    const zoom = Math.min(w / (s.width + 160), h / (s.height + 160));
    ge.view = { zoom, x: s.width / 2 - w / 2 / zoom, y: s.height / 2 - h / 2 / zoom };
  }
  const { x: vx, y: vy, zoom } = ge.view;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const mode = GE_VIEW_MODES.some(([id]) => id === ge.viewportMode) ? ge.viewportMode : 'lit';
  ctx.fillStyle = mode === 'collision' ? '#101820' : mode === 'lights' ? '#05070a' : s.background;
  ctx.fillRect(0, 0, w, h);
  geDrawGrid(ctx, ge.view, w, h, s.grid, mode !== 'lit');

  ctx.save();
  ctx.translate(-vx * zoom, -vy * zoom);
  ctx.scale(zoom, zoom);
  const looks = geLevelLooks();
  looks.forEach(({ look }) => {
    if (mode === 'collision') geDrawCollisionLook(ctx, look, zoom);
    else if (mode === 'lights') geDrawLightsLook(ctx, look);
    else geDrawLook(ctx, look, zoom);
  });
  const sel = geSelActor();
  const selLook = sel && looks.find((item) => item.actor === sel)?.look;
  if (selLook) {
    ctx.save();
    ctx.translate(selLook.x, selLook.y);
    ctx.rotate(((selLook.rotation || 0) * Math.PI) / 180);
    ctx.lineWidth = 2 / zoom;
    ctx.strokeStyle = '#ffa31a';
    const bw = Math.abs(selLook.w * selLook.scaleX);
    const bh = Math.abs(selLook.h * selLook.scaleY);
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    ctx.restore();
  }
  ctx.restore();

  // Ramka ekranu gry na starcie i linia Kill Y.
  const cam = geToScreen(0, 0);
  ctx.save();
  ctx.setLineDash([7, 5]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeRect(Math.round(cam.x) + 0.5, Math.round(cam.y) + 0.5, s.width * zoom, s.height * zoom);
  const kill = geToScreen(0, s.killY).y;
  ctx.strokeStyle = 'rgba(230, 40, 40, 0.9)';
  ctx.beginPath();
  ctx.moveTo(0, Math.round(kill) + 0.5);
  ctx.lineTo(w, Math.round(kill) + 0.5);
  ctx.stroke();
  ctx.restore();
  ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillText('Ekran gry na starcie', cam.x + 4, cam.y - 3);
  ctx.fillStyle = 'rgba(230, 40, 40, 0.95)';
  ctx.fillText('Kill Y — tu aktorzy giną', 8, kill - 3);

  if (geHasSpawn()) geDrawSpawn(ctx, geToScreen(s.spawnX, s.spawnY), geSpawnSel());
  if (sel) geDrawGizmo(ctx, geToScreen(sel.x, sel.y), ge.vpTool, sel.rotation);
  else if (geSpawnSel()) geDrawGizmo(ctx, geToScreen(s.spawnX, s.spawnY));
  const zoomChip = ge.root.querySelector('.ge-vp-zoom');
  if (zoomChip) zoomChip.textContent = `${Math.round(zoom * 100)}%`;
  const gridSelect = ge.root.querySelector('.ge-vp-bar select[data-scope="world"][data-k="grid"]');
  if (gridSelect) gridSelect.value = String(s.grid);
  const modeInfo = vp.querySelector('.ge-view-mode-info');
  if (modeInfo) modeInfo.textContent = mode === 'collision'
    ? 'Niebieski: blokuje · pomarańczowy: nakłada się'
    : mode === 'lights' ? 'Poświata materiałów' : '';
}

// Siatka widoku (co grid pikseli, gęstsza linia co 8 kratek) i osie świata przez punkt (0, 0).
function geDrawGrid(ctx, view, w, h, grid, dark = false) {
  const { x: vx, y: vy, zoom } = view;
  const gridLines = (step, color) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let x = Math.floor(vx / step) * step; x < vx + w / zoom; x += step) {
      const px = Math.round((x - vx) * zoom) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
    }
    for (let y = Math.floor(vy / step) * step; y < vy + h / zoom; y += step) {
      const py = Math.round((y - vy) * zoom) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
    }
    ctx.stroke();
  };
  ctx.lineWidth = 1;
  let step = grid;
  while (step * zoom < 8) step *= 2;
  gridLines(step, dark ? 'rgba(255, 255, 255, 0.045)' : 'rgba(0, 0, 0, 0.07)');
  gridLines(step * 8, dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.16)');
  const ox = Math.round(-vx * zoom) + 0.5;
  const oy = Math.round(-vy * zoom) + 0.5;
  ctx.strokeStyle = 'rgba(214, 48, 49, 0.75)';
  ctx.beginPath();
  ctx.moveTo(0, oy);
  ctx.lineTo(w, oy);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(46, 160, 67, 0.75)';
  ctx.beginPath();
  ctx.moveTo(ox, 0);
  ctx.lineTo(ox, h);
  ctx.stroke();
}

// Znacznik Player Start w punkcie c na ekranie: chorągiewka wbita w miejsce, w którym pojawi się gracz.
function geDrawSpawn(ctx, c, selected) {
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = selected ? 3 : 2;
  ctx.strokeStyle = selected ? '#ffa31a' : 'rgba(0, 0, 0, 0.75)';
  ctx.fillStyle = 'rgba(46, 160, 67, 0.35)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(c.x, c.y - 34);
  ctx.stroke();
  ctx.fillStyle = '#2ea043';
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 34);
  ctx.lineTo(c.x + 20, c.y - 27);
  ctx.lineTo(c.x, c.y - 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.strokeText('Player Start', c.x - 30, c.y + 7);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Player Start', c.x - 30, c.y + 7);
  ctx.restore();
}

function geSpawnHit(sx, sy) {
  if (!geHasSpawn()) return false;
  const c = geToScreen(ge.project.settings.spawnX, ge.project.settings.spawnY);
  return sx >= c.x - 14 && sx <= c.x + 22 && sy >= c.y - 36 && sy <= c.y + 8;
}

// Gizmo narysowane w punkcie c na ekranie: przesuwanie (strzałki), obrót (okrąg) albo skala (kostki).
function geDrawGizmo(ctx, c, tool = 'move', rotation = 0) {
  const arrow = (dx, dy, color) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + dx * 64, c.y + dy * 64);
    ctx.stroke();
    ctx.beginPath();
    if (tool === 'scale') ctx.rect(c.x + dx * 70 - 6, c.y + dy * 70 - 6, 12, 12);
    else {
      ctx.moveTo(c.x + dx * 78, c.y + dy * 78);
      ctx.lineTo(c.x + dx * 62 - dy * 7, c.y + dy * 62 + dx * 7);
      ctx.lineTo(c.x + dx * 62 + dy * 7, c.y + dy * 62 - dx * 7);
      ctx.closePath();
    }
    ctx.fill();
  };
  ctx.save();
  ctx.setLineDash([]);
  if (tool === 'rotate') {
    const a = ((Number(rotation) || 0) * Math.PI) / 180;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2f7de8';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffd600';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(a) * 60, c.y + Math.sin(a) * 60);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(255, 214, 0, 0.55)';
  ctx.fillRect(c.x + 4, c.y + 4, 20, 20);
  arrow(1, 0, '#e8372f');
  arrow(0, 1, '#3fbf3f');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function geVpDown(event) {
  if (ge.playing || !ge.view || event.target.closest('.ge-vp-bar')) return;
  const vp = event.currentTarget;
  vp.focus({ preventScroll: true });
  const p = geVpPoint(event);
  const pan = () => {
    ge.drag = { mode: 'pan', cx: event.clientX, cy: event.clientY, vx: ge.view.x, vy: ge.view.y, moved: false, button: event.button };
    vp.setPointerCapture(event.pointerId);
  };
  if (event.button === 1 || event.button === 2) {
    pan();
    return;
  }
  if (event.button !== 0) return;
  if (ge.actorPick) {
    geFinishActorPick(geActorAt(p.wx, p.wy));
    return;
  }
  const sel = geSelActor();
  const axis = sel ? geGizmoHit(geToScreen(sel.x, sel.y), p.sx, p.sy, ge.vpTool) : null;
  const s = ge.project.settings;
  const spawnAxis = geSpawnSel() ? geGizmoHit(geToScreen(s.spawnX, s.spawnY), p.sx, p.sy) : null;
  if (spawnAxis || (!axis && geSpawnHit(p.sx, p.sy))) {
    if (ge.selActor !== GE_SPAWN_ID) {
      ge.selActor = GE_SPAWN_ID;
      geRefreshLevelSel();
    }
    ge.drag = { mode: 'move', axis: spawnAxis || 'xy', id: GE_SPAWN_ID, wx: p.wx, wy: p.wy, ox: s.spawnX, oy: s.spawnY, moved: false };
    vp.setPointerCapture(event.pointerId);
    return;
  }
  const actor = axis ? sel : geActorAt(p.wx, p.wy);
  if (!actor) {
    if (ge.selActor) {
      ge.selActor = null;
      geRefreshLevelSel();
    }
    pan();
    return;
  }
  if (ge.selActor !== actor.id) {
    ge.selActor = actor.id;
    geRefreshLevelSel();
  }
  // Uchwyt obrotu albo skali zaznaczonego aktora; poza uchwytem przeciąganie zawsze przesuwa.
  const tool = axis && ge.vpTool !== 'move' ? ge.vpTool : 'move';
  ge.drag = { mode: 'move', tool, axis: axis || 'xy', id: actor.id, wx: p.wx, wy: p.wy, sx: p.sx, sy: p.sy, ox: actor.x, oy: actor.y, orot: Number(actor.rotation) || 0, osx: actor.scaleX ?? 1, osy: actor.scaleY ?? 1, moved: false, alt: event.altKey && tool === 'move' };
  vp.setPointerCapture(event.pointerId);
}

// Obrót (co 15°, Shift — płynnie) albo skala (co 0.1, Shift — płynnie) aktora przeciąganego za uchwyt gizma.
function geVpTransform(d, actor, p, free) {
  const c = geToScreen(actor.x, actor.y);
  if (d.tool === 'rotate') {
    const delta = ((Math.atan2(p.sy - c.y, p.sx - c.x) - Math.atan2(d.sy - c.y, d.sx - c.x)) * 180) / Math.PI;
    const rot = free ? Math.round((d.orot + delta) * 10) / 10 : Math.round((d.orot + delta) / 15) * 15;
    actor.rotation = ((((rot + 180) % 360) + 360) % 360) - 180;
    return ['rotation'];
  }
  const dx = (p.sx - d.sx) / 64;
  const dy = (p.sy - d.sy) / 64;
  const factor = (f) => Math.max(0.05, 1 + f);
  const fit = (v) => {
    const r = free ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10;
    return r === 0 ? Math.sign(v) * (free ? 0.01 : 0.1) : r;
  };
  if (d.axis !== 'y') actor.scaleX = fit(d.osx * factor(d.axis === 'xy' ? (dx + dy) / 2 : dx));
  if (d.axis !== 'x') actor.scaleY = fit(d.osy * factor(d.axis === 'xy' ? (dx + dy) / 2 : dy));
  return ['scaleX', 'scaleY'];
}

function geVpMove(event) {
  const d = ge.drag;
  if (!d || ge.playing) return;
  if (d.mode === 'pan') {
    const dx = event.clientX - d.cx;
    const dy = event.clientY - d.cy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    ge.view.x = d.vx - dx / ge.view.zoom;
    ge.view.y = d.vy - dy / ge.view.zoom;
    geQueueViewport();
    return;
  }
  if (d.mode !== 'move') return;
  const p = geVpPoint(event);
  if (!d.moved) {
    if (Math.hypot(p.wx - d.wx, p.wy - d.wy) * ge.view.zoom < 3) return;
    d.moved = true;
    geSnapshot();
    if (d.alt && d.id !== GE_SPAWN_ID) {
      const source = ge.project.actors.find((a) => a.id === d.id);
      const copy = geCopyActor(source);
      d.id = copy.id;
      ge.selActor = copy.id;
      geRenderOutliner();
    }
  }
  const spawn = d.id === GE_SPAWN_ID;
  const actor = spawn ? null : ge.project.actors.find((a) => a.id === d.id);
  if (actor && d.tool !== 'move') {
    const keys = geVpTransform(d, actor, p, event.shiftKey);
    geQueueViewport();
    ge.root.querySelectorAll(keys.map((k) => `[data-scope="actor"][data-k="${k}"]`).join(', ')).forEach((input) => {
      input.value = actor[input.dataset.k];
    });
    return;
  }
  const grid = ge.project.settings.grid;
  let nx = d.ox + (p.wx - d.wx);
  let ny = d.oy + (p.wy - d.wy);
  if (!event.shiftKey) {
    nx = geSnap(nx, grid);
    ny = geSnap(ny, grid);
  }
  if (d.axis === 'x') ny = d.oy;
  if (d.axis === 'y') nx = d.ox;
  if (spawn) {
    ge.project.settings.spawnX = nx;
    ge.project.settings.spawnY = ny;
    geQueueViewport();
    ge.root.querySelectorAll('[data-scope="world"][data-k="spawnX"], [data-scope="world"][data-k="spawnY"]').forEach((input) => {
      input.value = ge.project.settings[input.dataset.k];
    });
    return;
  }
  actor.x = nx;
  actor.y = ny;
  geQueueViewport();
  ge.root.querySelectorAll('[data-scope="actor"][data-k="x"], [data-scope="actor"][data-k="y"]').forEach((input) => {
    input.value = actor[input.dataset.k];
  });
}

function geVpUp(event) {
  const d = ge.drag;
  ge.drag = null;
  if (!d) return;
  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  if (d.mode === 'pan' && d.button === 2 && !d.moved) {
    const p = geVpPoint(event);
    const at = { x: p.wx, y: p.wy };
    const menuAt = { x: event.clientX, y: event.clientY };
    const actor = geSpawnHit(p.sx, p.sy) ? null : geActorAt(p.wx, p.wy);
    if (geSpawnHit(p.sx, p.sy)) {
      ge.selActor = GE_SPAWN_ID;
      geRefreshLevelSel();
      geMenu(menuAt, geSpawnMenu());
    } else if (actor) {
      ge.selActor = actor.id;
      geRefreshLevelSel();
      geMenu(menuAt, geActorMenu(at));
    } else {
      geMenu(menuAt, [
        { label: '▶ Uruchom tutaj', action: () => gePlay(at) },
        '-',
        { label: `🚩 ${geHasSpawn() ? 'Przenieś' : 'Postaw'} tu Player Start`, action: () => gePlaceSpawn(at.x, at.y) }
      ]);
    }
  }
  if (d.mode === 'move' && d.moved) {
    geScheduleSave();
    geRenderDetails();
    // Pełny wygląd po Construction Script (w trakcie przeciągania był zapamiętany z początku).
    geDrawViewport();
  }
}

function geVpWheel(event) {
  if (ge.playing) return;
  event.preventDefault();
  const p = geVpPoint(event);
  const zoom = Math.min(4, Math.max(0.1, ge.view.zoom * Math.pow(1.0015, -event.deltaY)));
  ge.view.x = p.wx - p.sx / zoom;
  ge.view.y = p.wy - p.sy / zoom;
  ge.view.zoom = zoom;
  geDrawViewport();
}

function geRefreshLevelSel() {
  if (ge.selActor) ge.detTab = ge.selActor === GE_SPAWN_ID ? 'world' : 'details';
  geRenderOutliner();
  geRenderDetails();
  geDrawViewport();
}

function geFocusActor(id = ge.selActor) {
  const s = ge.project.settings;
  const actor = id === GE_SPAWN_ID && geHasSpawn() ? { x: s.spawnX, y: s.spawnY } : ge.project.actors.find((a) => a.id === id);
  const vp = ge.root.querySelector('.ge-viewport');
  if (!actor || !vp) return;
  ge.view.x = actor.x - vp.clientWidth / 2 / ge.view.zoom;
  ge.view.y = actor.y - vp.clientHeight / 2 / ge.view.zoom;
  geDrawViewport();
}

function gePlaceActor(bpId, wx, wy) {
  const bp = geBp(bpId);
  if (!bp || bp.id === 'level') return;
  if (geKind(bp) !== 'actor') {
    geLog(`${bp.name} to ${GE_KINDS[geKind(bp)].label} — na poziomie można postawić tylko klasę Blueprint aktora.`, 'warn');
    return;
  }
  const grid = ge.project.settings.grid;
  geChange(() => {
    const actor = geAddActor(ge.project, bp, geSnap(wx, grid), geSnap(wy, grid));
    ge.selActor = actor.id;
  }, { only: ['outliner', 'details', 'viewport'] });
}

function gePlaceAtViewCenter(bpId) {
  const vp = ge.root.querySelector('.ge-viewport');
  if (!vp || !ge.view) return;
  const x = ge.view.x + vp.clientWidth / 2 / ge.view.zoom;
  const y = ge.view.y + vp.clientHeight / 2 / ge.view.zoom;
  if (bpId === GE_SPAWN_ID) gePlaceSpawn(x, y);
  else gePlaceActor(bpId, x, y);
}

// Player Start na Widoku pokazuje i ustawia Miejsce startu z Ustawień świata.
function gePlaceSpawn(wx, wy) {
  const grid = ge.project.settings.grid;
  geChange(() => {
    Object.assign(ge.project.settings, { playerStart: true, spawnX: geSnap(wx, grid), spawnY: geSnap(wy, grid) });
    ge.selActor = GE_SPAWN_ID;
    ge.detTab = 'world';
  }, { only: ['outliner', 'details', 'viewport'] });
}

function geDeleteSpawn() {
  geChange(() => {
    ge.project.settings.playerStart = false;
    if (ge.selActor === GE_SPAWN_ID) ge.selActor = null;
  }, { only: ['outliner', 'details', 'viewport'] });
}

function geSpawnMenu() {
  const s = ge.project.settings;
  return [
    { label: '▶ Uruchom tutaj', action: () => gePlay({ x: s.spawnX, y: s.spawnY }) },
    { label: '🔍 Pokaż w widoku', key: 'F', action: () => geFocusActor(GE_SPAWN_ID) },
    '-',
    { label: 'Usuń Player Start', key: 'Delete', action: geDeleteSpawn }
  ];
}

function geCopyActor(source) {
  const bp = geBp(source.bp);
  const taken = ge.project.actors.map((a) => a.name);
  const copy = { ...JSON.parse(JSON.stringify(source)), id: 'a' + ge.project.nextId++, name: geUniqueName((bp?.name ?? 'Aktor').replace(/^BP_/, ''), taken) };
  ge.project.actors.push(copy);
  return copy;
}

function geDuplicateActor() {
  const actor = geSelActor();
  if (!actor) return;
  geChange(() => {
    const copy = geCopyActor(actor);
    copy.x += ge.project.settings.grid * 2;
    ge.selActor = copy.id;
  }, { only: ['outliner', 'details', 'viewport'] });
}

function geDeleteActor() {
  if (geSpawnSel()) {
    geDeleteSpawn();
    return;
  }
  const actor = geSelActor();
  if (!actor) return;
  geChange(() => {
    ge.project.actors = ge.project.actors.filter((a) => a !== actor);
    ge.selActor = null;
  }, { only: ['outliner', 'details', 'viewport'] });
}

// at — punkt świata kliknięty prawym przyciskiem na Widoku (wtedy menu ma „Uruchom tutaj”).
function geActorMenu(at = null) {
  const actor = geSelActor();
  return [
    ...(at ? [{ label: '▶ Uruchom tutaj', action: () => gePlay(at) }, '-'] : []),
    { label: '✎ Edytuj Blueprint', action: () => geOpenTab(actor.bp) },
    { label: '🔍 Pokaż w widoku', key: 'F', action: () => geFocusActor() },
    '-',
    { label: 'Duplikuj', key: 'Ctrl+D', action: geDuplicateActor },
    { label: 'Usuń', key: 'Delete', action: geDeleteActor }
  ];
}

function geShapeIcon(bp) {
  if (!bp) return '❓';
  const d = bp.defaults;
  return { emoji: d.emoji, box: '■', circle: '●', triangle: '▲', text: 'T', image: '🖼', none: '◌' }[d.shape] ?? '■';
}

function geRenderOutliner() {
  const list = ge.root.querySelector('.ge-outliner-list');
  if (!list) return;
  const query = (ge.root.querySelector('[data-filter="outliner"]')?.value ?? '').trim().toLowerCase();
  const actors = ge.project.actors.filter((a) => !query || a.name.toLowerCase().includes(query) || (geBp(a.bp)?.name ?? '').toLowerCase().includes(query));
  list.innerHTML = actors.map((a) => {
    const bp = geBp(a.bp);
    const sel = a.id === ge.selActor;
    return `<button type="button" class="ge-row${sel ? ' is-selected' : ''}" role="option" aria-selected="${sel}" data-ge="pick-actor" data-id="${a.id}">
      <span class="ge-row-name"><span class="ge-row-ic" style="color:${bp?.defaults.color ?? '#f0f'}">${geEsc(geShapeIcon(bp))}</span>${geEsc(a.name)}</span>
      <span class="ge-row-type">${geEsc(bp?.name ?? '?')}</span>
    </button>`;
  }).join('') || '<p class="ge-empty">Brak aktorów. Przeciągnij Blueprint z Przeglądarki zawartości na Widok.</p>';
  ge.root.querySelector('.ge-outliner .ge-panel-foot').textContent = `${ge.project.actors.length} aktorów${ge.selActor ? ' (zaznaczono 1)' : ''}`;
}

// ---------- Pola w panelu Szczegóły ----------

const geCat = (title, body) => `<details class="ge-cat" open><summary>${geEsc(title)}</summary><div class="ge-cat-body">${body}</div></details>`;
const geRow = (label, control, hint = '') => `<div class="ge-prop"><span class="ge-prop-label"${hint ? ` title="${geEsc(hint)}"` : ''}>${geEsc(label)}${hint ? ' <i class="ge-hint-ic">?</i>' : ''}</span><div class="ge-prop-value">${control}</div></div>`;
const geAttrs = (scope, key, extra = '') => `data-scope="${scope}" data-k="${geEsc(key)}" ${extra}`;
const geNum = (scope, key, value, type = 'float', extra = '') =>
  `<input type="number" step="${type === 'int' ? 1 : 'any'}" data-type="${type}" value="${Number(value) || 0}" ${geAttrs(scope, key, extra)} />`;
const geText = (scope, key, value, extra = '') => `<input type="text" value="${geEsc(value)}" ${geAttrs(scope, key, extra)} />`;
const geColorIn = (scope, key, value, extra = '') => `<input type="color" value="${geEsc(value)}" ${geAttrs(scope, key, extra)} />`;
const geCheck = (scope, key, checked, extra = '') => `<input type="checkbox" ${checked ? 'checked' : ''} ${geAttrs(scope, key, extra)} />`;
const geSelect = (scope, key, value, options, extra = '') =>
  `<select ${geAttrs(scope, key, extra)}>${options.map(([v, label]) => `<option value="${geEsc(v)}"${String(v) === String(value) ? ' selected' : ''}>${geEsc(label)}</option>`).join('')}</select>`;
const geVec2 = (scope, kx, ky, x, y, extra = '') =>
  `<span class="ge-vec2"><label><i class="ge-ax ge-ax-x">X</i>${geNum(scope, kx, x, 'float', extra)}</label><label><i class="ge-ax ge-ax-y">Y</i>${geNum(scope, ky, y, 'float', extra)}</label></span>`;

function geVarInput(scope, key, type, value, extra = '') {
  switch (type) {
    case 'bool': return geCheck(scope, key, value, extra);
    case 'int': return geNum(scope, key, value, 'int', extra);
    case 'float': return geNum(scope, key, value, 'float', extra);
    case 'string': return geText(scope, key, value, extra);
    case 'vector': return `<span class="ge-vec2">
      <label><i class="ge-ax ge-ax-x">X</i>${geNum(scope, key, value?.x ?? 0, 'float', `${extra} data-axis="x"`)}</label>
      <label><i class="ge-ax ge-ax-y">Y</i>${geNum(scope, key, value?.y ?? 0, 'float', `${extra} data-axis="y"`)}</label></span>`;
    case 'actor': if (scope === 'actor-var') return geActorRefInput(key, value, extra);
    // falls through
    default: return geDataValueInput(scope, key, type, value, extra);
  }
}

// Aktor z poziomu w zmiennej Instance Editable (w projekcie: jego id) — lista aktorów i pipeta,
// którą klika się aktora na Widoku.
function geActorRefInput(key, value, extra) {
  const options = [['', 'Brak (None)'], ...ge.project.actors.map((a) => [a.id, a.name])];
  const axis = /data-axis="([^"]*)"/.exec(extra)?.[1] ?? '';
  const on = ge.actorPick?.key === key && ge.actorPick.axis === axis;
  return `<span class="ge-actor-ref">${geSelect('actor-var', key, value ?? '', options, `${extra} data-type="actor"`)}<button type="button" class="ge-pipette${on ? ' is-on' : ''}" data-ge="actor-pick" data-k="${geEsc(key)}" data-axis="${axis}" aria-pressed="${on}" title="${on ? 'Kliknij aktora na Widoku (Esc — anuluj)' : 'Pipeta — wybierz aktora kliknięciem na Widoku'}" aria-label="Pipeta: wybierz aktora na Widoku"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M11.3 1.3a2.1 2.1 0 0 1 3 3l-1.6 1.6.7.7-1.1 1.1-.7-.7-5.7 5.7-2.6.6-.9.9-1-1 .9-.9.6-2.6 5.7-5.7-.7-.7 1.1-1.1.7.7zM4.9 10.3l-.3 1.1 1.1-.3 5.4-5.4-.8-.8z" fill="currentColor"/></svg></button></span>`;
}

// Zmienna Blueprintu z klucza „idKlasy:idZmiennej” w actor.vars i jej wartość w aktorze (bez niej — domyślna).
function geActorVarDef(key) {
  const [owner, id] = String(key).split(':');
  return geBp(owner)?.variables?.find((v) => v.id === id) ?? null;
}
const geActorVarValue = (actor, key) => actor.vars?.[key] ?? geActorVarDef(key)?.value;

// Pipeta: następne kliknięcie aktora na Widoku wpisuje go do zmiennej zaznaczonego aktora.
function geSetActorPick(pick) {
  ge.actorPick = pick;
  ge.root.querySelector('.ge-viewport')?.classList.toggle('is-picking', Boolean(pick));
  geRenderDetails();
}

function geFinishActorPick(target) {
  const pick = ge.actorPick;
  const actor = geSelActor();
  ge.actorPick = null;
  ge.root.querySelector('.ge-viewport')?.classList.remove('is-picking');
  if (!target || !actor || actor.id !== pick.actor) {
    geRenderDetails();
    return;
  }
  geChange(() => {
    actor.vars[pick.key] = pick.axis ? geSetAt(geActorVarValue(actor, pick.key), geActorVarDef(pick.key)?.type, pick.axis, target.id) : target.id;
  }, { only: ['details', 'viewport'] });
}

function geReadInput(el) {
  if (el.type === 'checkbox') return el.checked;
  const type = el.dataset.type;
  if (type === 'actor') return el.value || null;
  if (el.type === 'number' || type === 'int' || type === 'float') {
    const n = Number(el.value);
    const v = Number.isFinite(n) ? n : 0;
    return type === 'int' ? Math.trunc(v) : v;
  }
  return el.value;
}

function geWorldClassSelect(key) {
  const kind = GE_WORLD_CLASSES[key];
  const options = ge.project.blueprints.filter((bp) => geKind(bp) === kind).sort(geByName).map((bp) => [bp.id, bp.name]);
  const select = geSelect('world', key, ge.project.settings[key], [['', 'Brak (None)'], ...options]);
  if (key === 'inputContext') return select;
  // Mały przycisk obok listy otwiera ustawioną klasę w karcie edytora.
  const bp = geBp(ge.project.settings[key]);
  return `${select}<button type="button" class="ge-prop-open" data-ge="open-bp" data-id="${bp?.id ?? ''}" ${bp ? `title="Otwórz ${geEsc(bp.name)}"` : 'title="Najpierw wybierz klasę" disabled'} aria-label="Otwórz ustawioną klasę">✎</button>`;
}

function geRenderWorldSettings(body) {
  const s = ge.project.settings;
  body.innerHTML = `
    ${geCat('Tryb gry', geRow('GameMode', geWorldClassSelect('gameMode'), 'Blueprint aktora z zasadami gry. Silnik tworzy go (niewidzialnego) na starcie poziomu. W grafie: węzeł „Get Game Mode”.')
      + geRow('Game Instance', geWorldClassSelect('gameInstance'), 'Blueprint aktora na zmienne całej gry (np. punkty, życia). Silnik tworzy go raz na start gry i nie usuwa przy Open Level, więc zmienne przechodzą na kolejne poziomy. W grafie: „Get Game Instance” › Get / Set zmiennej z pinem Target.')
      + geRow('Player Controller', geWorldClassSelect('playerController'), 'Blueprint aktora, który odbiera wejście gracza i steruje postacią (np. zdarzenie akcji IA_Skok › „Jump” z Target = „Get Player Pawn”). Silnik tworzy go (niewidzialnego) na starcie poziomu. W jego Class Defaults › Mouse Interface włączysz kursor myszy i klikanie aktorów. W grafie: „Get Player Controller”.')
      + geRow('Default Pawn', geWorldClassSelect('defaultPawn'), 'Postać gracza. Jeśli na poziomie nie ma aktora tej klasy, silnik stworzy go w Miejscu startu. Kamera od razu za nim podąża. W grafie: „Get Player Pawn”.')
      + geRow('HUD', geWorldClassSelect('hud'), 'Widget Blueprint pokazywany na ekranie od początku gry. W grafie: „Get HUD Widget”.')
      + geRow('Miejsce startu', geVec2('world', 'spawnX', 'spawnY', s.spawnX, s.spawnY), 'Tu pojawia się Default Pawn, gdy nie ma go na poziomie.')
      + geRow('Player Start na widoku', geCheck('world', 'playerStart', s.playerStart), 'Pokazuje Miejsce startu na Widoku jako chorągiewkę, którą można przeciągać. PPM na Widoku › „Uruchom tutaj” startuje grę z graczem w klikniętym miejscu.'))}
    ${geCat('Wejście (Enhanced Input)', geRow('Default Mapping Context', geWorldClassSelect('inputContext'), 'Input Mapping Context włączany na start gry (z priorytetem 0). Kolejne włączysz albo wyłączysz w grafie węzłami „Add Mapping Context” i „Remove Mapping Context”.'))}
    ${geCat('Gra', geRow('Nazwa gry', geText('world', 'name', ge.project.name)))}
    ${geCat('Ekran gry', geRow('Szerokość', geNum('world', 'width', s.width, 'int')) + geRow('Wysokość', geNum('world', 'height', s.height, 'int')) + geRow('Kolor tła', geColorIn('world', 'background', s.background)))}
    ${geCat('Widok gry', geRow('Widok', geSelect('world', 'view', s.view, [['2d', '2D (z boku albo z góry)'], ['raycast', '3D oczami gracza (jak Wolfenstein 3D)']]), 'W widoku 3D poziom układasz dalej z góry, a gra pokazuje go oczami aktora, za którym idzie kamera (Default Pawn), w stronę jego obrotu. Ściany to aktorzy z kolizją „Blokuje” i kształtem prostokąta, obrazka albo sprite’a; reszta to obrazki zwrócone do gracza. Niebo ma Kolor tła.')
      + (s.view === 'raycast'
        ? geRow('Kolor podłogi', geColorIn('world', 'floorColor', s.floorColor))
          + geRow('Wysokość ścian', geNum('world', 'wallHeight', s.wallHeight, 'int'), 'W pikselach świata — zwykle tyle, ile kratka mapy (64).')
          + geRow('Minimapa', geCheck('world', 'minimap', s.minimap), 'Mała mapa z góry w lewym dolnym rogu ekranu gry.')
        : ''))}
    ${geCat('Fizyka', geRow('Grawitacja', geNum('world', 'gravity', s.gravity), 'Przyspieszenie spadania w pikselach na sekundę². Działa na aktorów z włączoną Grawitacją.') + geRow('Kill Y', geNum('world', 'killY', s.killY), 'Aktor, który spadnie poniżej tej linii, zostaje zniszczony.'))}
    ${geCat('Edytor', geRow('Siatka', geSelect('world', 'grid', s.grid, [8, 16, 32, 64].map((n) => [n, `${n} px`])))
      + geRow('Autozapis co (min)', geNum('world', 'autosave', s.autosave, 'int'), 'Co ile minut projekt zapisuje się sam — do folderu projektu (bez folderu: w pamięci edytora). Przy zamknięciu okna i Ctrl+S zapisuje się od razu.'))}`;
}

function geRenderDetails() {
  const body = ge.root.querySelector('.ge-details-body');
  if (!body) return;
  ge.root.querySelectorAll('.ge-details [data-ge="det-tab"]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.id === ge.detTab));
  if (ge.detTab === 'world') {
    geRenderWorldSettings(body);
    return;
  }
  const a = geSelActor();
  if (ge.actorPick && ge.actorPick.actor !== a?.id) {
    ge.actorPick = null;
    ge.root.querySelector('.ge-viewport')?.classList.remove('is-picking');
  }
  if (!a) {
    body.innerHTML = '<p class="ge-det-note">Zaznacz aktora w Widoku albo w Outlinerze, żeby zobaczyć jego szczegóły. Ustawienia całej gry są w zakładce <b>Ustawienia świata</b>.</p>';
    return;
  }
  const bp = geBp(a.bp);
  // Zmienne instancji (także odziedziczone) zapisane w aktorze pod kluczem „idKlasy:idZmiennej”.
  const editable = bp ? geChainEntries(ge.project, bp, 'variables').filter(({ item: v }) => v.editable) : [];
  body.innerHTML = `
    <div class="ge-det-top">
      <span class="ge-det-ic" style="color:${bp?.defaults.color ?? '#f0f'}">${geEsc(geShapeIcon(bp))}</span>
      <input class="ge-det-name" type="text" value="${geEsc(a.name)}" ${geAttrs('actor', 'name')} aria-label="Nazwa aktora" />
    </div>
    <div class="ge-det-class"><span>Klasa: <b>${geEsc(bp?.name ?? '?')}</b></span>${bp ? `<button type="button" data-ge="open-bp" data-id="${bp.id}">✎ Edytuj Blueprint</button>` : ''}</div>
    ${geCat('Transformacja', geRow('Lokalizacja', geVec2('actor', 'x', 'y', a.x, a.y)) + geRow('Obrót (°)', geNum('actor', 'rotation', a.rotation)) + geRow('Skala', geVec2('actor', 'scaleX', 'scaleY', a.scaleX, a.scaleY)))}
    ${editable.length ? geCat('Zmienne', editable.map(({ item: v, owner }) => {
      const k = `${owner.id}:${v.id}`;
      const value = a.vars?.[k] ?? v.value;
      return geContainer(v.type).container === 'single' ? geRow(v.name, geVarInput('actor-var', k, v.type, value))
        : geVarContainerInput('actor-var', k, v.type, value, '', `data-k="${geEsc(k)}"`, v.name);
    }).join('')) : ''}
    ${bp && geKind(bp) === 'actor' ? geTsInstanceHtml(bp, a) : ''}
    <div class="ge-det-actions"><button type="button" data-ge="dup-actor">Duplikuj</button><button type="button" class="ge-danger" data-ge="del-actor">Usuń aktora</button></div>`;
}

// ---------- Przeglądarka zawartości i Dziennik ----------

// Zwinięty panel zostawia tylko pasek z zakładkami, a Widok zajmuje resztę.
function geToggleDrawer() {
  ge.drawerOpen = !ge.drawerOpen;
  ge.root.querySelector('.ge-level')?.classList.toggle('is-drawer-closed', !ge.drawerOpen);
}

function geRenderDrawer() {
  const drawer = ge.root.querySelector('.ge-drawer');
  if (!drawer) return;
  drawer.querySelectorAll('[data-ge="drawer"]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.id === ge.drawer));
  const body = drawer.querySelector('.ge-drawer-body');
  if (ge.drawer === 'log') {
    body.innerHTML = `<div class="ge-log">${ge.log.map((entry) => `<div class="ge-log-line ge-log-${entry.level}"><span class="ge-log-time">[${entry.time}]</span> ${geEsc(entry.text)}</div>`).join('')}</div>`;
    const log = body.querySelector('.ge-log');
    log.scrollTop = log.scrollHeight;
    drawer.querySelector('[data-id="log"]').classList.remove('has-error');
    return;
  }
  if (ge.cbFolder && !geFolder(ge.cbFolder)) ge.cbFolder = null;
  // Inne miejsca edytora ustawiają tylko selTile (np. nowy zasób) — wtedy zaznaczony jest wyłącznie on.
  if (ge.selTile && !ge.cbSel.has(ge.selTile)) {
    ge.cbSel = new Set([ge.selTile]);
    ge.cbAnchor = ge.selTile;
  }
  let cb = body.querySelector('.ge-cb');
  if (!cb) {
    body.innerHTML = `
      <div class="ge-cb">
        <div class="ge-cb-bar">
          <button type="button" class="ge-btn-add" data-ge="new-bp" aria-haspopup="menu">＋ Dodaj ▾</button>
          <button type="button" data-ge="new-folder">📁 Nowy folder</button>
          <button type="button" data-ge="import-assets" title="Obrazki (PNG, JPG, GIF…) — Tekstury, Sprite’y albo Animacja (zapytamy), pliki dźwiękowe (MP3, WAV, OGG) — Dźwięki, pliki JSON — Bazy danych klucz → wartość.">⤓ Importuj</button>
          <span class="ge-crumb"></span>
          <span class="ge-fill"></span>
          <select class="ge-cb-kind" data-filter="kind" aria-label="Pokaż rodzaj zasobów">
            <option value="">Wszystkie rodzaje</option>
            ${Object.entries(GE_KINDS).map(([kind, k]) => `<option value="${kind}"${ge.cbKind === kind ? ' selected' : ''}>${k.icon} ${geEsc(k.label)}</option>`).join('')}
          </select>
          <input class="ge-search" type="search" placeholder="Szukaj w zawartości" data-filter="content" aria-label="Szukaj w zawartości" />
        </div>
        <div class="ge-cb-main">
          <nav class="ge-cb-tree" aria-label="Foldery"></nav>
          <div class="ge-cb-grid" role="list"></div>
        </div>
      </div>`;
    cb = body.querySelector('.ge-cb');
    cb.addEventListener('dragover', geCbDragOver);
    cb.addEventListener('dragleave', (event) => {
      if (!cb.contains(event.relatedTarget)) geCbClearDrop();
    });
    cb.addEventListener('drop', geCbDrop);
  }
  const cur = ge.cbFolder;
  const rootOpen = ge.cbOpen.has('root');
  cb.querySelector('.ge-cb-tree').innerHTML = `
    <div class="ge-tree-row${cur ? '' : ' is-selected'}" style="--d:0" data-ge="cb-folder" data-id="" data-drop="" tabindex="0">
      <span class="ge-tree-arrow" data-ge="cb-toggle" data-id="root">${geChildFolders(null).length ? (rootOpen ? '▾' : '▸') : ''}</span><span class="ge-tree-name">📁 Zawartość</span>
    </div>${rootOpen ? geFolderTreeHtml(null, 1) : ''}`;
  cb.querySelector('.ge-crumb').innerHTML = [{ id: '', name: 'Zawartość' }, ...geFolderPath(cur)]
    .map((f) => `<button type="button" class="ge-crumb-part" data-ge="cb-folder" data-id="${f.id}" data-drop="${f.id}">${geEsc(f.name)}</button>`).join('<span class="ge-crumb-sep">›</span>');

  const query = body.querySelector('[data-filter="content"]').value.trim().toLowerCase();
  // Bez wyszukiwania: zawartość bieżącego folderu; z wyszukiwaniem: także wszystkich podfolderów.
  const inView = (folderId) => (query ? geInFolder(folderId, cur) : (folderId ?? null) === cur);
  const folders = ge.project.folders.filter((f) => inView(f.parent) && (!query || f.name.toLowerCase().includes(query))).sort(geByName);
  const bps = ge.project.blueprints.filter((bp) => inView(bp.folder) && (!query || bp.name.toLowerCase().includes(query)) && (!ge.cbKind || geKind(bp) === ge.cbKind));
  const grid = cb.querySelector('.ge-cb-grid');
  grid.dataset.drop = cur ?? '';
  grid.innerHTML = folders.map((f) => `<div class="ge-tile ge-folder-tile${ge.cbSel.has(f.id) ? ' is-selected' : ''}" role="listitem" tabindex="0" draggable="true" data-ge="tile-folder" data-id="${f.id}" data-drop="${f.id}" title="Dwuklik — otwórz folder. Przeciągnij tu Blueprint albo folder, żeby go przenieść.">
      <span class="ge-folder-ic" aria-hidden="true">📁</span>
      <span class="ge-tile-name">${geEsc(f.name)}</span>
      <span class="ge-tile-type">Folder</span>
    </div>`).join('') + bps.map((bp) => {
      const kind = GE_KINDS[geKind(bp)];
      const tip = geKind(bp) === 'actor'
        ? 'Przeciągnij na Widok, żeby postawić aktora, albo na folder, żeby go przenieść. Dwuklik — edytuj Blueprint.'
        : `${kind.label}. Dwuklik — otwórz. Przeciągnij na folder, żeby go przenieść.`;
      return `<div class="ge-tile${ge.cbSel.has(bp.id) ? ' is-selected' : ''}" style="--kc:${kind.color}" role="listitem" tabindex="0" draggable="true" data-ge="tile" data-id="${bp.id}" title="${geEsc(tip)}">
      <canvas width="80" height="80"></canvas>
      <span class="ge-tile-name">${geEsc(bp.name)}</span>
      <span class="ge-tile-type">${kind.label}</span>
    </div>`;
    }).join('') || `<p class="ge-empty">${query || ge.cbKind ? 'Nic nie pasuje.' : cur ? 'Pusty folder. Przeciągnij tu zasób albo kliknij „＋ Dodaj”.' : 'Brak zasobów. Kliknij „＋ Dodaj” (klasa Blueprint, widget, materiał, sprite, animacja, dźwięk…) albo „⤓ Importuj”, żeby dodać obrazki, dźwięki i pliki JSON (Bazy danych) z dysku. Pliki możesz też przeciągnąć tutaj.'}</p>`;
  grid.querySelectorAll('.ge-tile[data-ge="tile"]').forEach((tile) => geDrawThumb(tile.querySelector('canvas'), geBp(tile.dataset.id)));
}

// ---------- Foldery Przeglądarki zawartości ----------

const geFolder = (id) => (id ? ge.project.folders.find((f) => f.id === id) || null : null);
const geByName = (a, b) => a.name.localeCompare(b.name, 'pl');
const geChildFolders = (parent) => ge.project.folders.filter((f) => (f.parent ?? null) === parent).sort(geByName);

// Ścieżka od katalogu głównego do folderu (bez „Zawartość”). Limit chroni przed pętlą w uszkodzonym pliku.
function geFolderPath(id) {
  const path = [];
  for (let f = geFolder(id); f && path.length <= ge.project.folders.length; f = geFolder(f.parent)) path.unshift(f);
  return path;
}

// Czy folder folderId leży w ancestorId (albo nim jest); null to katalog główny, w którym leży wszystko.
function geInFolder(folderId, ancestorId) {
  if (!ancestorId) return true;
  return geFolderPath(folderId).some((f) => f.id === ancestorId);
}

function geFolderTreeHtml(parent, depth) {
  return geChildFolders(parent).map((f) => {
    const open = ge.cbOpen.has(f.id);
    const kids = geChildFolders(f.id).length;
    return `<div class="ge-tree-row${ge.cbFolder === f.id ? ' is-selected' : ''}" style="--d:${depth}" data-ge="cb-folder" data-id="${f.id}" data-drop="${f.id}" draggable="true" tabindex="0">
        <span class="ge-tree-arrow" data-ge="cb-toggle" data-id="${f.id}">${kids ? (open ? '▾' : '▸') : ''}</span><span class="ge-tree-name">📁 ${geEsc(f.name)}</span>
      </div>${open ? geFolderTreeHtml(f.id, depth + 1) : ''}`;
  }).join('');
}

function geOpenFolder(id) {
  ge.cbFolder = id || null;
  geFolderPath(ge.cbFolder).forEach((f) => ge.cbOpen.add(f.parent ?? 'root'));
  geRenderDrawer();
}

const geSiblingNames = (parent, except = null) => geChildFolders(parent).filter((f) => f !== except).map((f) => f.name);

async function geNewFolder(parent = ge.cbFolder) {
  const name = await geDialog({ title: 'Nowy folder', input: 'NowyFolder', buttons: [{ label: 'Utwórz', value: true, primary: true }, { label: 'Anuluj', value: null }] });
  if (!name?.trim()) return;
  geChange(() => {
    const f = { id: 'f' + ge.project.nextId++, name: geUniqueName(name.trim(), geSiblingNames(parent)), parent };
    ge.project.folders.push(f);
    ge.cbOpen.add(parent ?? 'root');
    ge.selTile = f.id;
  }, { only: ['drawer'] });
}

async function geRenameFolder(id) {
  const f = geFolder(id);
  const name = await geDialog({ title: 'Zmień nazwę folderu', input: f.name, buttons: [{ label: 'Zmień', value: true, primary: true }, { label: 'Anuluj', value: null }] });
  if (!name?.trim() || name.trim() === f.name) return;
  geChange(() => {
    f.name = geUniqueName(name.trim(), geSiblingNames(f.parent, f));
  }, { only: ['drawer'] });
}

async function geDeleteFolder(id) {
  const f = geFolder(id);
  const inside = (folderId) => folderId !== null && geInFolder(folderId, id);
  const sub = ge.project.folders.filter((x) => x !== f && inside(x.id));
  const bps = ge.project.blueprints.filter((bp) => inside(bp.folder));
  let mode = 'empty';
  if (sub.length || bps.length) {
    mode = await geDialog({
      title: `Usunąć folder ${geEsc(f.name)}?`,
      text: `W środku: ${bps.length} Blueprintów i ${sub.length} podfolderów. Możesz je usunąć razem z folderem albo przenieść piętro wyżej. Ctrl+Z cofa.`,
      buttons: [{ label: 'Przenieś zawartość wyżej', value: 'keep', primary: true }, { label: 'Usuń z zawartością', value: 'all' }, { label: 'Anuluj', value: null }]
    });
    if (!mode) return;
  }
  geChange(() => {
    if (mode === 'all') {
      const gone = new Set(bps.map((bp) => bp.id));
      const folders = new Set([id, ...sub.map((x) => x.id)]);
      ge.project.blueprints = ge.project.blueprints.filter((bp) => !gone.has(bp.id));
      geFilterActors(ge.project, (a) => !gone.has(a.bp));
      ge.project.folders = ge.project.folders.filter((x) => !folders.has(x.id));
      ge.tabs = ge.tabs.filter((t) => !gone.has(t));
      if (!ge.tabs.includes(ge.tab)) ge.tab = 'level';
      if (!geSelActor()) ge.selActor = null;
    } else {
      ge.project.folders.forEach((x) => {
        if (x.parent === id) {
          x.parent = f.parent;
          x.name = geUniqueName(x.name, geSiblingNames(f.parent, x));
        }
      });
      ge.project.blueprints.forEach((bp) => {
        if (bp.folder === id) bp.folder = f.parent;
      });
      ge.project.folders = ge.project.folders.filter((x) => x !== f);
    }
    if (ge.cbFolder && !geFolder(ge.cbFolder)) ge.cbFolder = f.parent;
    ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
  }, { only: [] });
  geRender();
}

// Przenosi zasoby i foldery (id z zaznaczenia) do folderu parent jednym krokiem Ctrl+Z.
function geMoveItems(ids, parent) {
  const bps = ids.map(geBp).filter((bp) => bp && bp !== ge.project.level && (bp.folder ?? null) !== parent);
  const folders = ids.map(geFolder).filter((f) => f && (f.parent ?? null) !== parent);
  const ok = folders.filter((f) => !parent || !geInFolder(parent, f.id));
  if (ok.length < folders.length) geLog('Nie można przenieść folderu do niego samego ani do jego podfolderu.', 'warn');
  if (!bps.length && !ok.length) return;
  geChange(() => {
    bps.forEach((bp) => { bp.folder = parent; });
    ok.forEach((f) => {
      f.parent = parent;
      f.name = geUniqueName(f.name, geSiblingNames(parent, f));
    });
    ge.cbOpen.add(parent ?? 'root');
  }, { only: ['drawer'] });
  const moved = [...bps, ...ok];
  geLog(`Przeniesiono ${moved.length === 1 ? moved[0].name : `${moved.length} elementów`} do „${geFolder(parent)?.name ?? 'Zawartość'}”.`);
}

// Klik w kafelek: sam — tylko on, Ctrl — dołącz/odłącz, Shift — zakres od ostatnio klikniętego (z Ctrl dopisuje zakres).
function geSelectTile(id, event) {
  const ids = [...ge.root.querySelectorAll('.ge-cb-grid .ge-tile')].map((tile) => tile.dataset.id);
  const ctrl = event.ctrlKey || event.metaKey;
  if (event.shiftKey && ids.includes(ge.cbAnchor)) {
    const [a, b] = [ids.indexOf(ge.cbAnchor), ids.indexOf(id)].sort((x, y) => x - y);
    if (!ctrl) ge.cbSel.clear();
    ids.slice(a, b + 1).forEach((x) => ge.cbSel.add(x));
    ge.selTile = id;
  } else if (ctrl) {
    ge.cbAnchor = id;
    if (ge.cbSel.has(id)) {
      ge.cbSel.delete(id);
      ge.selTile = [...ge.cbSel].at(-1) ?? null;
    } else {
      ge.cbSel.add(id);
      ge.selTile = id;
    }
  } else {
    ge.cbSel = new Set([id]);
    ge.cbAnchor = ge.selTile = id;
  }
  ge.root.querySelectorAll('.ge-cb-grid .ge-tile').forEach((tile) => tile.classList.toggle('is-selected', ge.cbSel.has(tile.dataset.id)));
}

function geFolderMenu(id) {
  if (!id) return [{ label: '📁 Nowy folder…', action: () => geNewFolder(null) }];
  return [
    { label: '📂 Otwórz', action: () => geOpenFolder(id) },
    { label: '📁 Nowy podfolder…', action: () => geNewFolder(id) },
    '-',
    { label: 'Zmień nazwę…', action: () => geRenameFolder(id) },
    { label: 'Usuń…', action: () => geDeleteFolder(id) }
  ];
}

// Cel upuszczenia w Przeglądarce zawartości: wiersz drzewa, kafelek folderu, okruszek albo tło siatki.
function geCbDropTarget(event) {
  const types = event.dataTransfer.types;
  if (!types.includes('application/x-ge-items') && !types.includes('Files')) return null;
  const el = event.target.closest('[data-drop]');
  if (!el) return null;
  const target = el.dataset.drop || null;
  if (target && ge.cbDragFolders.some((id) => geInFolder(target, id))) return null;
  return el;
}

function geCbClearDrop() {
  ge.root.querySelectorAll('.ge-cb .is-drop').forEach((el) => el.classList.remove('is-drop'));
}

function geCbDragOver(event) {
  const el = geCbDropTarget(event);
  geCbClearDrop();
  if (!el) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = event.dataTransfer.types.includes('Files') ? 'copy' : 'move';
  el.classList.add('is-drop');
}

function geCbDrop(event) {
  const el = geCbDropTarget(event);
  geCbClearDrop();
  if (!el) return;
  event.preventDefault();
  const target = el.dataset.drop || null;
  // Pliki z dysku (obrazki, dźwięki, JSON) — import do folderu, na który je upuszczono.
  if (event.dataTransfer.files.length) {
    geImportFiles([...event.dataTransfer.files], target);
    return;
  }
  const ids = event.dataTransfer.getData('application/x-ge-items');
  if (ids) geMoveItems(ids.split(','), target);
}

function geCbDragEnd() {
  ge.cbDragFolders = [];
  geCbClearDrop();
}

function geDrawThumb(canvas, bp) {
  if (!canvas || !bp) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const kind = geKind(bp);
  if (GE_DATA_KINDS.includes(kind)) {
    geDrawDataThumb(ctx, bp, W, H);
    return;
  }
  if (geZdDrawThumb(ctx, bp, W, H)) return;
  if (kind === 'texture' || kind === 'sprite' || kind === 'animation') {
    const data = kind === 'texture' ? geTextureFrame(bp) : geSpriteData(ge.project, bp.id);
    const frame = kind === 'texture' ? data : data?.frames[0];
    if (!geDrawFrame(ctx, frame, 6, 6, W - 12, H - 12)) {
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#8a8a8a';
      ctx.strokeRect(W * 0.2 + 0.5, H * 0.2 + 0.5, W * 0.6, H * 0.6);
      ctx.setLineDash([]);
      ctx.fillStyle = '#8a8a8a';
      ctx.font = `${Math.round(H * 0.3)}px "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(GE_KINDS[kind].icon, W / 2, H / 2);
    }
    if (kind === 'animation') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(W - 34, H - 18, 32, 16);
      ctx.fillStyle = '#ffd84a';
      ctx.font = '700 10px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`▶ ${bp.flipbook.frames.length}`, W - 18, H - 10);
    }
    return;
  }
  if (kind === 'sound') {
    geDrawWave(ctx, bp, 6, H * 0.2, W - 12, H * 0.6);
    return;
  }
  if (kind === 'material') {
    geDrawMaterialBall(ctx, bp, W / 2, H / 2, Math.min(W, H) * 0.36);
    return;
  }
  // Interfejs i zasoby Enhanced Input: plakietka ze skrótem rodzaju i krótką informacją pod nim.
  const badge = {
    interface: ['#3a2a52', '#d2b4ff', 'BPI', () => `${bp.functions.length} ƒ`],
    input_action: ['#4a1f2e', '#ff9ab8', 'IA', () => GE_INPUT_VALUE_TYPES.find(([t]) => t === bp.inputAction.valueType)?.[1].split(' ')[0] ?? ''],
    input_context: ['#3b2a1c', '#e8bf8a', 'IMC', () => `${bp.mappingContext.mappings.length} ⌨`]
  }[kind];
  if (badge) {
    const [bg, fg, text, info] = badge;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(W * 0.12, H * 0.12, W * 0.76, H * 0.76, 10);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = `800 ${Math.round(H * (text.length > 2 ? 0.26 : 0.3))}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, H * 0.44);
    ctx.font = `600 ${Math.round(H * 0.13)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(info(), W / 2, H * 0.7, W * 0.7);
    return;
  }
  if (kind === 'widget') {
    const s = ge.project.settings;
    const scale = Math.min((W - 8) / s.width, (H - 8) / s.height);
    const ox = (W - s.width * scale) / 2;
    const oy = (H - s.height * scale) / 2;
    ctx.fillStyle = '#111a24';
    ctx.fillRect(ox, oy, s.width * scale, s.height * scale);
    ctx.strokeStyle = '#2fb36b';
    ctx.strokeRect(ox + 0.5, oy + 0.5, s.width * scale - 1, s.height * scale - 1);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    GE_RT.drawWidget(ctx, bp.widget.elements, geWidgetKids);
    ctx.restore();
    return;
  }
  const d = geResolveDefaults(ge.project, bp);
  const look = { ...d, components: geLookComponents(ge.project, bp), x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  if (d.shape === 'none' && !geShapeParts(look).length) {
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#8a8a8a';
    ctx.strokeRect(W * 0.25, H * 0.25, W * 0.5, H * 0.5);
    return;
  }
  // Miniatura obejmuje wygląd aktora razem z komponentami kształtów.
  const b = geLookBounds(look);
  const s = Math.min((W - 14) / (b.r - b.l || 1), (H - 14) / (b.b - b.t || 1), 2.5);
  GE_RT.drawActor(ctx, { ...look, x: W / 2 - ((b.l + b.r) / 2) * s, y: H / 2 - ((b.t + b.b) / 2) * s, scaleX: s, scaleY: s });
}

// Prostokąt (w układzie aktora, bez skali) obejmujący wygląd aktora i jego widoczne komponenty kształtów.
function geLookBounds(look) {
  const parts = geShapeParts(look);
  const rects = [...(look.shape !== 'none' || !parts.length ? [{ x: 0, y: 0, w: look.w, h: look.h, rotation: 0 }] : []), ...parts];
  const b = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity };
  rects.forEach((c) => {
    const turn = ((Number(c.rotation) || 0) * Math.PI) / 180;
    const hw = Math.abs(Number(c.w) || 1) / 2;
    const hh = Math.abs(Number(c.h) || 1) / 2;
    const ex = hw * Math.abs(Math.cos(turn)) + hh * Math.abs(Math.sin(turn));
    const ey = hw * Math.abs(Math.sin(turn)) + hh * Math.abs(Math.cos(turn));
    b.l = Math.min(b.l, (Number(c.x) || 0) - ex);
    b.r = Math.max(b.r, (Number(c.x) || 0) + ex);
    b.t = Math.min(b.t, (Number(c.y) || 0) - ey);
    b.b = Math.max(b.b, (Number(c.y) || 0) + ey);
  });
  return b;
}

function geLog(text, level = 'info') {
  if (!ge) return;
  const time = new Date().toLocaleTimeString('pl-PL');
  ge.log.push({ text, level, time });
  if (ge.log.length > 400) ge.log.shift();
  if (ge.tab === 'level' && ge.drawer === 'log') geRenderDrawer();
  else if (level === 'error') ge.root.querySelector('.ge-drawer [data-id="log"]')?.classList.add('has-error');
}

// ---------- Edytor Blueprintów ----------

function geBuildBpPage(page) {
  const bp = geCurBp();
  const actor = geHasViewport(bp);
  const widget = geIsWidgetBp(bp);
  const mode = geMode();
  const fn = geCurFn();
  const tlNode = geCurTl();
  const isGraph = mode === 'graph' || mode === 'construction' || !!fn;
  const firstOpen = isGraph && !ge.graphViews[geGraphKey()];
  const graphName = fn ? fn.name : mode === 'construction' ? 'Construction Script' : 'Event Graph';
  // Otwarta funkcja albo Timeline dostaje własną kartę obok Event Graph.
  const modes = [...geBpModes(bp), ...(fn || tlNode ? [mode] : [])];
  const modeLabel = (id) => GE_MODE_LABELS[id] ?? (geModeTl(bp, id) ? `⏱ ${geEsc(geModeTl(bp, id).props?.name)}` : `ƒ ${geEsc(geModeFn(bp, id)?.name)}`);
  const parent = actor ? geParentOf(ge.project, bp) : null;
  const tsParent = actor && !parent ? geAsset(ge.project, bp.parent, 'tsclass') : null;
  const parentLabel = bp.id === 'level' ? 'Level Script Actor' : widget ? 'User Widget' : geIsAnimBp(bp) ? 'Paper ZD Anim Instance' : parent?.name ?? (tsParent ? `🔷 ${tsParent.ts.api?.className ?? tsParent.name}` : 'Actor');
  page.className = 'ge-page ge-bpage' + (ge.codeOpen ? ' has-code' : '');
  page.innerHTML = `
    <div class="ge-toolbar">
      <button class="ge-compile" type="button" data-ge="compile" title="Kompiluj Blueprint (F7)"><span class="ge-compile-ic"></span>Kompiluj</button>
      <button type="button" data-ge="save" title="Zapisz projekt do pliku (Ctrl+S)"><span class="ge-ic">💾</span>Zapisz</button>
      <span class="ge-sep"></span>
      ${bp.id === 'level' ? '' : geKind(bp) === 'widget' ? '<button type="button" data-ge="class-defaults"><span class="ge-ic">🪟</span>Projektant</button>' : '<button type="button" data-ge="class-defaults"><span class="ge-ic">⚙</span>Ustawienia klasy</button>'}
      ${actor ? '<button type="button" data-ge="menu" data-menu="components"><span class="ge-ic ge-ic-green">＋</span>Dodaj komponent ▾</button>' : ''}
      <button type="button" data-ge="toggle-code" aria-pressed="${ge.codeOpen}"><span class="ge-ic ge-ic-code">{ }</span>Kod TypeScript</button>
      <span class="ge-sep"></span>
      <div class="ge-play-group"><button class="ge-play" type="button" data-ge="play" title="Graj (Alt+P)" aria-label="Graj"><span>▶</span></button></div>
      <span class="ge-fill"></span>
      ${actor ? `<button type="button" class="ge-bp-parent is-button" data-ge="bp-parent" title="Zmień klasę nadrzędną — klasa dziedziczy jej zdarzenia, zmienne i komponenty">Klasa nadrzędna: <b>${geEsc(parentLabel)}</b> ▾</button>`
        : `<span class="ge-bp-parent">Klasa nadrzędna: <b>${geEsc(parentLabel)}</b></span>`}
    </div>
    <div class="ge-bp-main">
      <div class="ge-bp-left${actor || (widget && mode === 'designer') ? '' : ' is-single'}">
        ${widget && mode === 'designer' ? `<aside class="ge-panel ge-wd-palette">
          <div class="ge-panel-head"><span class="ge-panel-tab">Paleta</span></div>
          <div class="ge-wd-palette-body"></div>
        </aside>
        <aside class="ge-panel ge-wd-tree">
          <div class="ge-panel-head"><span class="ge-panel-tab">Hierarchia</span></div>
          <div class="ge-wd-tree-body" role="tree" aria-label="Elementy widgetu"></div>
        </aside>` : ''}
        ${actor ? `<aside class="ge-panel ge-comps">
          <div class="ge-panel-head"><span class="ge-panel-tab">Komponenty</span><span class="ge-fill"></span><button type="button" class="ge-mini ge-mini-add" data-ge="menu" data-menu="components">＋ Dodaj</button></div>
          <div class="ge-comps-body" role="tree" aria-label="Komponenty aktora"></div>
        </aside>` : ''}
        ${widget && mode === 'designer' ? '' : `<aside class="ge-panel ge-mybp">
          <div class="ge-panel-head"><span class="ge-panel-tab">Mój Blueprint</span></div>
          <div class="ge-mybp-body"></div>
        </aside>`}
      </div>
      <section class="ge-panel ge-graph-panel">
        <div class="ge-panel-head ge-mode-tabs"${modes.length > 1 ? ' role="tablist" aria-label="Edytor klasy"' : ''}>${modes.length > 1
          ? modes.map((id) => `<button type="button" class="ge-panel-tab${id === mode ? ' is-active' : ''}" role="tab" aria-selected="${id === mode}" data-ge="bp-mode" data-id="${id}">${modeLabel(id)}</button>`).join('')
          : '<span class="ge-panel-tab">Event Graph</span>'}</div>
        ${mode === 'viewport' ? `<div class="ge-bpvp" tabindex="0" aria-label="Viewport — komponenty aktora. Przeciągnij komponent, prawy przycisk dodaje nowy.">
          <canvas class="ge-vp-canvas"></canvas>
          <div class="ge-vp-bar">
            <span class="ge-chip">⬚ 2D</span>
            <span class="ge-chip" title="Viewport pokazuje aktora po Construction Script, z domyślnymi wartościami zmiennych.">Podgląd z Construction Script</span>
            <span class="ge-fill"></span>
            <span class="ge-chip ge-vp-zoom">100%</span>
          </div>
          <div class="ge-watermark" aria-hidden="true">VIEWPORT</div>
        </div>` : mode === 'designer' ? `<div class="ge-bpvp ge-wdvp" tabindex="0" aria-label="Projektant widgetu — przeciągaj elementy, uchwyty zmieniają rozmiar, prawy przycisk otwiera menu.">
          <canvas class="ge-vp-canvas"></canvas>
          <div class="ge-vp-bar">
            <span class="ge-chip" title="Rozmiar ekranu gry z Ustawień świata">🖥 ${ge.project.settings.width}×${ge.project.settings.height}</span>
            <span class="ge-chip">Przeciągnij element z Palety albo kliknij go</span>
            <span class="ge-fill"></span>
            <span class="ge-chip ge-vp-zoom">100%</span>
          </div>
          <div class="ge-watermark" aria-hidden="true">PROJEKTANT</div>
        </div>` : mode === 'animgraph' ? geZdGraphHtml(bp) : tlNode ? geTlEditorHtml(bp, tlNode) : `<div class="ge-graph" tabindex="0" aria-label="${graphName} — prawy przycisk dodaje węzeł">
          <div class="ge-graph-world"><svg class="ge-wires" width="1" height="1" aria-hidden="true"></svg><div class="ge-nodes"></div></div>
          <div class="ge-crumbs"><b>${geEsc(bp.name)}</b> › ${graphName}</div>
          <div class="ge-watermark" aria-hidden="true">${fn ? 'FUNCTION' : geKind(bp) === 'widget' ? 'WIDGET' : mode === 'construction' ? 'CONSTRUCTION' : 'BLUEPRINT'}</div>
          <div class="ge-marquee" hidden></div>
          <div class="ge-toast" role="status" hidden></div>
        </div>`}
      </section>
      <aside class="ge-panel ge-bp-details">
        <div class="ge-panel-head"><span class="ge-panel-tab">Szczegóły</span></div>
        <div class="ge-bp-details-body"></div>
      </aside>
      <aside class="ge-panel ge-code">
        <div class="ge-panel-head"><span class="ge-panel-tab">TypeScript (na żywo)</span><span class="ge-fill"></span><button type="button" class="ge-mini" data-ge="copy-code">Kopiuj</button></div>
        <pre class="ge-code-body" tabindex="0" aria-label="Kod TypeScript wygenerowany z Blueprintu"></pre>
      </aside>
    </div>
    <section class="ge-panel ge-results">
      <div class="ge-panel-head"><span class="ge-panel-tab">Wyniki kompilatora</span></div>
      <div class="ge-results-body"></div>
    </section>`;
  const graph = page.querySelector('.ge-graph');
  if (graph) {
    graph.addEventListener('pointerdown', geGraphDown);
    graph.addEventListener('pointermove', geGraphMove);
    graph.addEventListener('pointerup', geGraphUp);
    graph.addEventListener('pointercancel', geGraphUp);
    graph.addEventListener('wheel', geGraphWheel, { passive: false });
    graph.addEventListener('dragover', (event) => {
      if (!['application/x-ge-var', 'application/x-ge-fn', 'application/x-ge-disp'].some((t) => event.dataTransfer.types.includes(t))) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });
    graph.addEventListener('drop', geGraphDrop);
  }
  const wdvp = page.querySelector('.ge-wdvp');
  if (wdvp) {
    wdvp.addEventListener('pointerdown', geWdvpDown);
    wdvp.addEventListener('pointermove', geWdvpMove);
    wdvp.addEventListener('pointerup', geWdvpUp);
    wdvp.addEventListener('pointercancel', geWdvpUp);
    wdvp.addEventListener('wheel', geWdvpWheel, { passive: false });
    wdvp.addEventListener('dragover', (event) => {
      if (!event.dataTransfer.types.includes('application/x-ge-wd')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });
    wdvp.addEventListener('drop', geWdvpDrop);
    ge.resize.observe(wdvp);
  }
  const vp = page.querySelector('.ge-bpvp:not(.ge-wdvp)');
  if (vp) {
    vp.addEventListener('pointerdown', geBpvpDown);
    vp.addEventListener('pointermove', geBpvpMove);
    vp.addEventListener('pointerup', geBpvpUp);
    vp.addEventListener('pointercancel', geBpvpUp);
    vp.addEventListener('wheel', geBpvpWheel, { passive: false });
    ge.resize.observe(vp);
  }
  geZdBind(page);
  geRenderComponents();
  geRenderWdPanels();
  geRenderMyBp();
  geRenderGraph();
  geRenderTimeline();
  geRenderBpDetails();
  geRefreshCode();
  geRenderResults();
  geDrawBpViewport();
  geDrawWidgetViewport();
  if (firstOpen) requestAnimationFrame(() => geFitGraph());
}

// Przełącza zakładkę edytora klasy: Viewport, Construction Script, Event Graph, Projektant albo graf funkcji.
function geSetBpMode(mode) {
  if (!geModeOk(geCurBp(), mode) || geMode() === mode) return;
  ge.bpModes[ge.tab] = mode;
  ge.nodeSel.clear();
  if (ge.bpPanel?.kind === 'node') ge.bpPanel = null;
  geRender();
}

function geRenderMyBp() {
  const body = ge.root.querySelector('.ge-mybp-body');
  if (!body) return;
  const bp = geCurBp();
  const sel = ge.bpPanel;
  const mode = geMode();
  const events = bp.graph.nodes.filter((n) => GE_NODES[n.type]?.kind === 'event');
  const inherited = geChainEntries(ge.project, bp, 'variables').filter((e) => e.owner !== bp);
  const dispatchers = geChainEntries(ge.project, bp, 'dispatchers');
  const graphRow = (id, label) => `<div class="ge-row${mode === id ? ' is-current' : ''}" data-ge="bp-mode" data-id="${id}" tabindex="0"><span class="ge-row-name">${label}</span></div>`;
  body.innerHTML = `
    <div class="ge-mb-sec">
      <div class="ge-mb-head"><span>Wykresy</span></div>
      ${geHasViewport(bp) ? graphRow('construction', 'ƒ ConstructionScript') : ''}
      ${geIsAnimBp(bp) ? graphRow('animgraph', '🏃 AnimGraph') : ''}
      ${graphRow('graph', '📈 EventGraph')}
    </div>
    <div class="ge-mb-sec">
      <div class="ge-mb-head"><span>Funkcje</span><button type="button" class="ge-mb-add" data-ge="fn-add" title="Dodaj funkcję" aria-label="Dodaj funkcję">＋</button></div>
      ${(bp.funcs ?? []).map((f) => `<div class="ge-row${mode === 'fn:' + f.id ? ' is-current' : ''}${sel?.kind === 'fn' && sel.id === f.id ? ' is-selected' : ''}" data-ge="pick-fn" data-id="${f.id}" draggable="true" tabindex="0" title="Kliknij — otwórz graf funkcji. Przeciągnij na graf — wywołanie funkcji.">
          <span class="ge-row-name"><span class="ge-fn-ic">ƒ</span>${geEsc(f.name)}</span>
          <span class="ge-row-type" title="Wejścia → wyjścia">${f.inputs.length} → ${f.outputs.length}</span>
        </div>`).join('') || '<p class="ge-empty">Brak funkcji — kliknij ＋.</p>'}
    </div>
    <div class="ge-mb-sec">
      <div class="ge-mb-head"><span>Zmienne</span><button type="button" class="ge-mb-add" data-ge="var-add" title="Dodaj zmienną" aria-label="Dodaj zmienną">＋</button></div>
      ${bp.variables.map((v) => `<div class="ge-row${sel?.kind === 'var' && sel.id === v.id ? ' is-selected' : ''}" data-ge="pick-var" data-id="${v.id}" draggable="true" tabindex="0" title="Przeciągnij na graf: Ctrl — pobierz, Alt — ustaw">
          <span class="ge-row-name">${geTypeIcon(v.type)}${geEsc(v.name)}</span>
          <span class="ge-row-type"><span class="ge-type-name" style="color:${geType(v.type).color}">${geEsc(geTypeShort(v.type))}</span><button type="button" class="ge-var-eye${v.editable ? ' is-on' : ''}" data-ge="var-eye" data-id="${v.id}" aria-pressed="${Boolean(v.editable)}" title="${v.editable ? 'Publiczna (Instance Editable) — kliknij, aby ukryć' : 'Prywatna — kliknij, aby ustawić jako publiczną'}" aria-label="Zmienna publiczna">${v.editable ? '👁' : '◡'}</button></span>
        </div>`).join('') || '<p class="ge-empty">Brak zmiennych — kliknij ＋.</p>'}
      ${inherited.length ? `<div class="ge-mb-sub">Odziedziczone</div>${inherited.map((e) => `<div class="ge-row is-inherited${sel?.kind === 'ivar' && sel.id === e.ref ? ' is-selected' : ''}" data-ge="pick-ivar" data-id="${geEsc(e.ref)}" draggable="true" tabindex="0" title="Z klasy ${geEsc(e.owner.name)}. Przeciągnij na graf: Ctrl — pobierz, Alt — ustaw">
          <span class="ge-row-name">${geTypeIcon(e.item.type)}${geEsc(e.item.name)}</span>
          <span class="ge-row-type">${geEsc(e.owner.name)}</span>
        </div>`).join('')}` : ''}
    </div>
    ${geKind(bp) === 'widget' ? '' : `<div class="ge-mb-sec">
      <div class="ge-mb-head"><span>Timelines</span></div>
      ${geTlNodes(bp).map((n) => `<div class="ge-row${mode === 'tl:' + n.id ? ' is-current' : ''}" data-ge="open-tl" data-id="${n.id}" tabindex="0" title="Kliknij — otwórz edytor Timeline'u.">
          <span class="ge-row-name"><span class="ge-tl-ic">⏱</span>${geEsc(n.props?.name)}</span>
          <span class="ge-row-type">${geTl(n).tracks.length} ${geTlTracksWord(geTl(n).tracks.length)}</span>
        </div>`).join('') || '<p class="ge-empty">Brak — w Event Graph: prawy przycisk › Add Timeline…</p>'}
    </div>`}
    ${bp.id === 'level' ? '' : `<div class="ge-mb-sec">
      <div class="ge-mb-head"><span>Event Dispatchers</span><button type="button" class="ge-mb-add" data-ge="disp-add" title="Dodaj Event Dispatcher" aria-label="Dodaj Event Dispatcher">＋</button></div>
      ${dispatchers.map((e) => `<div class="ge-row${e.owner === bp ? '' : ' is-inherited'}${sel?.kind === 'disp' && sel.id === e.ref ? ' is-selected' : ''}" data-ge="pick-disp" data-id="${geEsc(e.ref)}" draggable="true" tabindex="0" title="${e.owner === bp ? '' : `Z klasy ${geEsc(e.owner.name)}. `}Przeciągnij na graf — Call, Bind, Unbind albo Assign.">
          <span class="ge-row-name"><span class="ge-disp-ic">✉</span>${geEsc(e.item.name)}</span>
          <span class="ge-row-type">${e.owner === bp ? `${e.item.inputs.length} param.` : geEsc(e.owner.name)}</span>
        </div>`).join('') || '<p class="ge-empty">Brak dispatcherów — kliknij ＋.</p>'}
    </div>`}
    <div class="ge-mb-sec">
      <div class="ge-mb-head"><span>Zdarzenia</span></div>
      ${events.map((n) => `<div class="ge-row" data-ge="focus-node" data-id="${n.id}" tabindex="0"><span class="ge-row-name"><span class="ge-ev-ic">◆</span>${geEsc(geNodeTitle(n, bp))}</span></div>`).join('') || '<p class="ge-empty">Brak zdarzeń.</p>'}
    </div>
    <p class="ge-mb-tip">Prawy przycisk na grafie — nowy węzeł.<br />Przeciągnij z kółka pinu — połączenie.</p>`;
}

function geGraphView() {
  const key = geGraphKey();
  ge.graphViews[key] = ge.graphViews[key] || { x: 40, y: 40, zoom: 1 };
  return ge.graphViews[key];
}

function geApplyGraphView() {
  const graph = ge.root.querySelector('.ge-graph');
  if (!graph) return;
  const v = geGraphView();
  graph.querySelector('.ge-graph-world').style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
  const minor = GE_SNAP * v.zoom;
  const major = GE_SNAP * 8 * v.zoom;
  graph.style.backgroundSize = `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`;
  graph.style.backgroundPosition = `${v.x}px ${v.y}px`;
}

// Ikona typu zmiennej jak w Unreal Engine, w kolorze typu: pigułka (Single), siatka (Array), klamry (Set),
// dwie kolumny (Map — klucze w kolorze klucza, wartości w kolorze wartości).
function geTypeIcon(type) {
  const t = geType(type);
  const svg = (body) => `<svg class="ge-ti" viewBox="0 0 16 12" style="--pc:${t.color};--pc2:${t.valueColor ?? t.color}" aria-hidden="true">${body}</svg>`;
  switch (geContainer(type).container) {
    case 'array': return svg('<path d="M2 0h3v3H2zM6.5 0h3v3h-3zM11 0h3v3h-3zM2 4.5h3v3H2zM6.5 4.5h3v3h-3zM11 4.5h3v3h-3zM2 9h3v3H2zM6.5 9h3v3h-3zM11 9h3v3h-3z" />');
    case 'set': return svg('<path class="ge-ti-line" d="M6 .8C4.3.8 4.5 2.5 4.5 4S4 6 2.5 6C4 6 4.5 6.5 4.5 8s-.2 3.2 1.5 3.2M10 .8c1.7 0 1.5 1.7 1.5 3.2S12 6 13.5 6C12 6 11.5 6.5 11.5 8s.2 3.2-1.5 3.2" />');
    case 'map': return svg('<path d="M1.5 0h4v3h-4zM1.5 4.5h4v3h-4zM1.5 9h4v3h-4z" /><path class="ge-ti-v" d="M7 0h7.5v3H7zM7 4.5h7.5v3H7zM7 9h7.5v3H7z" />');
    default: return svg('<rect x="1" y="3" width="14" height="6" rx="3" />');
  }
}

function geDotSvg(type) {
  const container = geContainer(type).container;
  // Zbiór — klamry { }, mapa — dwie kolumny: klucze w kolorze klucza, wartości w kolorze wartości (jak w Unreal Engine).
  if (container === 'set') return '<svg viewBox="0 0 14 14" aria-hidden="true"><path class="ge-dot-open" d="M5 1.5C3.5 1.5 3.5 3 3.5 4.5S3 7 1.5 7C3 7 3.5 8 3.5 9.5S3.5 12.5 5 12.5M9 1.5c1.5 0 1.5 1.5 1.5 3S11 7 12.5 7C11 7 10.5 8 10.5 9.5S10.5 12.5 9 12.5" /><circle cx="7" cy="7" r="1.6" /></svg>';
  if (container === 'map') return `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1h5v3H1zM1 5.5h5v3H1zM1 10h5v3H1z" /><path style="--pc:${geType(type).valueColor}" d="M8 1h5v3H8zM8 5.5h5v3H8zM8 10h5v3H8z" /></svg>`;
  // Delegate (zdarzenie dla Event Dispatchera) — kwadrat, jak w Unreal Engine.
  if (type === 'delegate') return '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 2.5h9v9h-9z" /></svg>';
  return type === 'exec'
    ? '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 2h5L12 7l-4.5 5h-5z" /></svg>'
    : container === 'array'
      // Tablica — siatka 3 × 3, jak w Unreal Engine.
      ? '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1h3v3H1zM5.5 1h3v3h-3zM10 1h3v3h-3zM1 5.5h3v3H1zM5.5 5.5h3v3h-3zM10 5.5h3v3h-3zM1 10h3v3H1zM5.5 10h3v3h-3zM10 10h3v3h-3z" /></svg>'
      : '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="4.4" /></svg>';
}

function gePinWidget(n, p) {
  const v = n.values?.[p.id] ?? p.def;
  const base = `data-scope="node-value" data-node="${n.id}" data-k="${p.id}" data-type="${p.type}" aria-label="${geEsc(p.name || p.id)}"`;
  switch (p.type) {
    case 'bool': return `<input type="checkbox" ${base} ${v ? 'checked' : ''} />`;
    case 'int':
    case 'float': return `<input type="number" step="${p.type === 'int' ? 1 : 'any'}" ${base} value="${Number(v) || 0}" />`;
    case 'string': return p.color
      ? `<input type="color" ${base} value="${geEsc(v)}" />`
      : `<input type="text" ${base} value="${geEsc(v)}" size="${Math.min(22, Math.max(5, String(v ?? '').length + 1))}" />`;
    case 'vector': return `<span class="ge-pin-vec"><input type="number" step="any" ${base} data-axis="x" value="${Number(v?.x) || 0}" /><input type="number" step="any" ${base} data-axis="y" value="${Number(v?.y) || 0}" /></span>`;
    // Pin Target aktora albo obiektu klasy TypeScript, po której Blueprint dziedziczy: pusty — on sam.
    default:
      // Pin Enumeracji — lista jej wartości (jak w Unreal Engine).
      if (geTypeRef(p.type)?.prefix === 'enum') return geEnumSelect('node-value', p.id, p.type, v, `data-node="${n.id}" data-type="${geEsc(p.type)}" aria-label="${geEsc(p.name || p.id)}"`);
      return p.self ? '<span class="ge-pin-self">self</span>' : '';
  }
}

function gePropHtml(n, p) {
  const v = n.props?.[p.id] ?? p.def ?? '';
  const base = `data-scope="node-prop" data-node="${n.id}" data-k="${p.id}" aria-label="${geEsc(p.name)}"`;
  const options = (list) => list.map(([value, label]) => `<option value="${geEsc(value)}"${String(value) === String(v) ? ' selected' : ''}>${geEsc(label)}</option>`).join('');
  switch (p.kind) {
    case 'key': return `<select ${base}>${options(GE_EVENT_KEYS)}</select>`;
    case 'cursor': return `<select ${base}>${options(GE_CURSORS)}</select>`;
    case 'sound': {
      const own = geOfKind('sound').map((bp) => [bp.id, bp.name]);
      const missing = geSoundExists(ge.project, v) ? '' : `<option value="${geEsc(v)}" selected>(usunięty dźwięk)</option>`;
      return `<select ${base}>${missing}${own.length ? `<optgroup label="Dźwięki z Przeglądarki zawartości">${options(own)}</optgroup>` : ''}<optgroup label="Wbudowane">${options(GE_SOUNDS)}</optgroup></select>`;
    }
    case 'sprite': return `<select ${base}><option value="">— wybierz sprite / animację —</option>${options(geSpriteChoices())}</select>`;
    case 'axis': return `<select ${base}>${options(GE_AXES)}</select>`;
    case 'class': return `<select ${base}><option value="">— wybierz klasę —</option>${options(geOfKind('actor').map((bp) => [bp.id, bp.name]))}</select>`;
    case 'widget-class': return `<select ${base}><option value="">— wybierz widget —</option>${options(geOfKind('widget').map((bp) => [bp.id, bp.name]))}</select>`;
    case 'material': return `<select ${base}><option value="">— wybierz materiał —</option>${options(geOfKind('material').map((bp) => [bp.id, bp.name]))}</select>`;
    case 'iface': return `<select ${base}><option value="">— wybierz interfejs —</option>${options(geOfKind('interface').map((bp) => [bp.id, bp.name]))}</select>`;
    case 'input-action': return `<select ${base}><option value="">— wybierz Input Action —</option>${options(geOfKind('input_action').map((bp) => [bp.id, bp.name]))}</select>`;
    case 'input-context': return `<select ${base}><option value="">— wybierz Mapping Context —</option>${options(geOfKind('input_context').map((bp) => [bp.id, bp.name]))}</select>`;
    case 'iface-fn':
    case 'iface-fn-own': {
      // „Own” — tylko interfejsy zaimplementowane przez tę klasę (zdarzenie), inaczej wszystkie (wywołanie).
      const own = geClassInterfaces(ge.project, geCurBp());
      const fns = geOfKind('interface').filter((i) => p.kind === 'iface-fn' || own.includes(i.id))
        .flatMap((i) => i.functions.map((f) => [`${i.id}:${f.id}`, `${i.name} › ${f.name}`]));
      return `<select ${base}><option value="">— wybierz funkcję —</option>${options(fns)}</select>`;
    }
    case 'component': {
      const comps = geCompChoices(geCurBp(), p).map((e) => [e.ref, `${GE_COMP_TYPES[e.item.type].icon} ${e.item.name}${e.owner === geCurBp() ? '' : ` (${e.owner.name})`}`]);
      return `<select ${base}><option value="">— wybierz komponent —</option>${options(comps)}</select>`;
    }
    case 'widget-child': {
      const names = (geCurBp()?.widget?.elements ?? []).filter((el) => el.type === 'widget').map((el) => [el.name, el.name]);
      if (!names.some(([name]) => name === v)) names.unshift([v, v ? `${v} (brak w Projektancie)` : '— wybierz widget —']);
      return `<select ${base}>${options(names)}</select>`;
    }
    case 'widget-button': {
      const names = (geCurBp()?.widget?.elements ?? []).filter((el) => el.type === 'button').map((el) => [el.name, el.name]);
      if (!names.some(([name]) => name === v)) names.unshift([v, `${v} (brak w Projektancie)`]);
      return `<select ${base}>${options(names)}</select>`;
    }
    // Parametry zdarzenia własnego — tylko w panelu Szczegóły (na węźle widać je jako piny).
    case 'event-inputs': {
      const types = geVarTypes(ge.project).map((t) => [t, geTypeShort(t)]);
      const rows = geEventInputs(n).map((inp) => {
        const attrs = `data-node="${n.id}" data-id="${geEsc(inp.id)}"`;
        return `<div class="ge-evin" style="--pc:${geType(inp.type).color}"><span class="ge-pill"></span>
          ${geText('ev-input', 'name', inp.name, `${attrs} aria-label="Nazwa parametru"`)}
          ${geSelect('ev-input', 'type', inp.type, types, `${attrs} aria-label="Typ parametru ${geEsc(inp.name)}"`)}
          <button type="button" class="ge-mini" data-ge="evin-del" ${attrs} aria-label="Usuń parametr ${geEsc(inp.name)}">Usuń</button></div>`;
      }).join('');
      return `<div class="ge-evin-list">${rows}<button type="button" class="ge-mini" data-ge="evin-add" data-node="${n.id}">＋ Dodaj parametr</button></div>`;
    }
    case 'choice': return `<select ${base}><option value="">${geEsc(p.placeholder ?? '—')}</option>${options(p.options(n))}</select>`;
    case 'timeline': return geTlSettingsHtml(n);
    default: return `<input type="text" ${base} value="${geEsc(v)}" />`;
  }
}

function gePinHtml(n, p, dir, linked) {
  const isLinked = linked.has(`${n.id}:${p.id}:${dir}`);
  const name = p.name ? `<span class="ge-pin-name">${geEsc(p.name)}</span>` : '';
  const widget = dir === 'in' && !isLinked ? gePinWidget(n, p) : '';
  return `<div class="ge-pin${isLinked ? ' is-linked' : ''}" data-pin="${p.id}" data-dir="${dir}" data-type="${p.type}" style="--pc:${geType(p.type).color}" title="${geEsc(geType(p.type).label)}"><span class="ge-dot">${geDotSvg(p.type)}</span>${name}${widget}</div>`;
}

function geNodeHtml(n, bp, linked, problems) {
  const sel = ge.nodeSel.has(n.id) ? ' is-selected' : '';
  if (n.type === 'comment') {
    return `<div class="ge-comment${sel}" data-node="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;--cc:${geEsc(n.color || '#ffffff')}">
      <div class="ge-comment-head">${geEsc(n.text)}</div><span class="ge-comment-resize" data-resize aria-hidden="true"></span></div>`;
  }
  const def = GE_NODES[n.type];
  if (!def) return `<div class="ge-node ge-k-exec has-error${sel}" data-node="${n.id}" style="left:${n.x}px;top:${n.y}px"><div class="ge-node-head">❓ ${geEsc(n.type)}</div></div>`;
  const pins = gePins(n, bp);
  const title = geNodeTitle(n, bp);
  const ins = pins.ins.map((p) => gePinHtml(n, p, 'in', linked)).join('');
  const outs = pins.outs.map((p) => gePinHtml(n, p, 'out', linked)).join('');
  const problem = problems.get(n.id);
  const classes = ['ge-node', `ge-k-${def.kind}`];
  if (problem) classes.push(problem.level === 'error' ? 'has-error' : 'has-warning');
  if (n.type === 'timeline') classes.push('is-timeline');
  if (n.breakpoint && geCanBreak(n)) classes.push('has-breakpoint');
  if (ge.lastBreak?.bp === bp && ge.lastBreak.nodeId === n.id) classes.push('is-break-hit');
  const badge = problem ? `<span class="ge-badge" title="${geEsc(problem.msg)}">${problem.level === 'error' ? 'BŁĄD' : 'UWAGA'}</span>` : '';
  const tip = geEsc(`${def.pl}${def.desc ? ' — ' + def.desc : ''}`);
  let inner;
  if (n.type === 'reroute') {
    // Sama kropka (wejście + wyjście) bez nagłówka i bez pól do wpisania wartości.
    classes.push('is-reroute');
    const dot = (p, dir) => `<div class="ge-pin${linked.has(`${n.id}:${p.id}:${dir}`) ? ' is-linked' : ''}" data-pin="${p.id}" data-dir="${dir}" data-type="${p.type}" style="--pc:${geType(p.type).color}" title="${geEsc(geType(p.type).label)}"><span class="ge-dot">${geDotSvg(p.type)}</span></div>`;
    inner = `<div class="ge-node-body" title="${tip}">${pins.ins.map((p) => dot(p, 'in')).join('')}${pins.outs.map((p) => dot(p, 'out')).join('')}</div>`;
  } else if (n.type === 'var_get') {
    classes.push('is-var');
    inner = `<div class="ge-node-body">${ins ? `<div class="ge-pins ge-pins-in">${ins}</div>` : ''}<span class="ge-var-name" title="${tip}">${geEsc(title)}</span><div class="ge-pins ge-pins-out">${outs}</div></div>`;
  } else if (def.compact) {
    classes.push('is-compact');
    inner = `<div class="ge-node-body"><div class="ge-pins ge-pins-in">${ins}</div><span class="ge-compact" title="${tip}">${geEsc(def.compact)}</span><div class="ge-pins ge-pins-out">${outs}</div></div>`;
  } else {
    const props = (def.props ?? []).filter((p) => !p.detailsOnly).map((p) => gePropHtml(n, p)).join('');
    inner = `<div class="ge-node-head" title="${tip}"><span class="ge-node-ic">${def.icon ?? GE_KIND_ICON[def.kind]}</span><span class="ge-node-title">${geEsc(title)}</span></div>
      ${props ? `<div class="ge-node-props">${props}</div>` : ''}
      <div class="ge-node-body"><div class="ge-pins ge-pins-in">${ins}</div><div class="ge-pins ge-pins-out">${outs}</div></div>`;
  }
  const bpDot = classes.includes('has-breakpoint') ? '<span class="ge-bp-dot" title="Breakpoint — gra zatrzyma się przed tym bloczkiem (F9 usuwa)"></span>' : '';
  return `<div class="${classes.join(' ')}${sel}" data-node="${n.id}" style="left:${n.x}px;top:${n.y}px">${bpDot}${badge}${inner}</div>`;
}

// Węzły tablic biorą typ elementu z kabla w pinie Array (np. po zmianie kontenera albo typu zmiennej).
function geSyncArrayNodes(bp, graph) {
  graph.nodes.filter((n) => GE_ARRAY_NODES.has(n.type)).forEach((n) => {
    const link = graph.links.find((l) => l.to[0] === n.id && l.to[1] === 'array');
    const src = link && graph.nodes.find((x) => x.id === link.from[0]);
    const type = src && gePins(src, bp).outs.find((p) => p.id === link.from[1])?.type;
    const c = type ? geContainer(type) : null;
    if (c?.container !== 'array' || geArrayElem(n) === c.elem) return;
    n.props = n.props || {};
    if (c.elem === 'actor') delete n.props.elem;
    else n.props.elem = c.elem;
  });
}

// Kopia węzła z menu z typem elementu tablicy, z której wyciągnięto kabel (For Each z kabla Integer[] → Integer).
function geMenuNode(node, pending) {
  const c = pending?.dir === 'out' ? geContainer(pending.type) : null;
  return GE_ARRAY_NODES.has(node.type) && c?.container === 'array' && c.elem !== 'actor' ? { ...node, props: { ...node.props, elem: c.elem } } : node;
}

// Usuwa połączenia, które przestały pasować (np. po zmianie typu zmiennej albo usunięciu węzła).
function geCleanLinks(bp, graph = geCurGraph()) {
  geSyncArrayNodes(bp, graph);
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  graph.links = graph.links.filter((l) => {
    const a = nodes.get(l.from[0]);
    const b = nodes.get(l.to[0]);
    const out = a && gePins(a, bp).outs.find((p) => p.id === l.from[1]);
    const inp = b && gePins(b, bp).ins.find((p) => p.id === l.to[1]);
    return out && inp && geCanConnect(out.type, inp.type);
  });
}

function geRenderGraph() {
  const graph = ge.root.querySelector('.ge-graph');
  const bp = geCurBp();
  if (!graph || !bp) return;
  geCleanLinks(bp);
  const linked = new Set(geCurGraph().links.flatMap((l) => [`${l.from[0]}:${l.from[1]}:out`, `${l.to[0]}:${l.to[1]}:in`]));
  const problems = new Map();
  const result = ge.lastCompile[bp.id];
  if (result && !ge.dirty.has(bp.id)) {
    result.warnings.forEach((w) => w.node && problems.set(w.node, { level: 'warning', msg: w.msg }));
    result.errors.forEach((e) => e.node && problems.set(e.node, { level: 'error', msg: e.msg }));
  }
  const ordered = [...geCurGraph().nodes.filter((n) => n.type === 'comment'), ...geCurGraph().nodes.filter((n) => n.type !== 'comment')];
  graph.querySelector('.ge-nodes').innerHTML = ordered.map((n) => geNodeHtml(n, bp, linked, problems)).join('');
  geApplyGraphView();
  geDrawWires();
}

function geGraphPoint(event) {
  const graph = ge.root.querySelector('.ge-graph');
  const r = graph.getBoundingClientRect();
  const v = geGraphView();
  return { x: (event.clientX - r.left - v.x) / v.zoom, y: (event.clientY - r.top - v.y) / v.zoom };
}

function gePinPos(nodeId, pinId, dir) {
  const graph = ge.root.querySelector('.ge-graph');
  const dot = graph?.querySelector(`[data-node="${nodeId}"] .ge-pin[data-pin="${pinId}"][data-dir="${dir}"] .ge-dot`);
  if (!dot) return null;
  const r = dot.getBoundingClientRect();
  const g = graph.getBoundingClientRect();
  const v = geGraphView();
  return { x: (r.left + r.width / 2 - g.left - v.x) / v.zoom, y: (r.top + r.height / 2 - g.top - v.y) / v.zoom };
}

function geWirePath(a, b) {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
}

function geDrawWires() {
  const svg = ge.root.querySelector('.ge-wires');
  const bp = geCurBp();
  if (!svg || !bp) return;
  const nodes = new Map(geCurGraph().nodes.map((n) => [n.id, n]));
  // Każdy kabel ma szerszą, niewidoczną kopię — łatwiej go trafić myszą (PPM, dwuklik).
  let html = geCurGraph().links.map((l, i) => {
    const a = gePinPos(l.from[0], l.from[1], 'out');
    const b = gePinPos(l.to[0], l.to[1], 'in');
    if (!a || !b) return '';
    const type = gePins(nodes.get(l.from[0]), bp).outs.find((p) => p.id === l.from[1])?.type ?? 'float';
    const d = geWirePath(a, b);
    return `<g class="ge-link"><path class="ge-wire${type === 'exec' ? ' is-exec' : ''}" d="${d}" stroke="${geType(type).color}" /><path class="ge-wire-hit" data-link="${i}" d="${d}" /></g>`;
  }).join('');
  const t = ge.tempWire;
  if (t) {
    const [a, b] = t.dir === 'out' ? [t.from, t.to] : [t.to, t.from];
    html += `<path class="ge-wire is-temp${t.type === 'exec' ? ' is-exec' : ''}" d="${geWirePath(a, b)}" stroke="${geType(t.type).color}" />`;
  }
  svg.innerHTML = html;
}

function geUpdateNodeSelection() {
  ge.root.querySelectorAll('.ge-nodes [data-node]').forEach((el) => el.classList.toggle('is-selected', ge.nodeSel.has(el.dataset.node)));
}

function geSelectionChanged() {
  geUpdateNodeSelection();
  if (ge.nodeSel.size === 1) ge.bpPanel = { kind: 'node', id: [...ge.nodeSel][0] };
  else if (ge.bpPanel?.kind === 'node') ge.bpPanel = null;
  geRenderComponents();
  geRenderMyBp();
  geRenderBpDetails();
  geDrawBpViewport();
}

function geGraphDown(event) {
  const graph = event.currentTarget;
  if (event.target.closest('.ge-ctx')) return;
  geCloseNodeMenu();
  if (event.target.closest('input, select, textarea, button')) return;
  graph.focus({ preventScroll: true });
  const v = geGraphView();
  const pinEl = event.target.closest('.ge-pin');
  const nodeEl = event.target.closest('[data-node]');
  if (event.button === 0 && pinEl && event.target.closest('.ge-dot, .ge-pin-name')) {
    const pin = { node: nodeEl.dataset.node, pin: pinEl.dataset.pin, dir: pinEl.dataset.dir, type: pinEl.dataset.type };
    if (event.altKey) {
      geBreakPin(pin);
      return;
    }
    ge.drag = { mode: 'wire', ...pin, start: gePinPos(pin.node, pin.pin, pin.dir) };
    graph.setPointerCapture(event.pointerId);
    return;
  }
  if (event.button === 0 && nodeEl) {
    const id = nodeEl.dataset.node;
    const node = geNodeById(id);
    if (event.target.closest('[data-resize]')) {
      ge.drag = { mode: 'resize', id, cx: event.clientX, cy: event.clientY, w: node.w, h: node.h, moved: false };
      graph.setPointerCapture(event.pointerId);
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      if (ge.nodeSel.has(id)) ge.nodeSel.delete(id);
      else ge.nodeSel.add(id);
    } else if (event.shiftKey) ge.nodeSel.add(id);
    else if (!ge.nodeSel.has(id)) ge.nodeSel = new Set([id]);
    geSelectionChanged();
    // Przesuwany komentarz zabiera ze sobą węzły, które w nim leżą.
    const moving = new Set(ge.nodeSel);
    const bp = geCurBp();
    geCurGraph().nodes.filter((n) => n.type === 'comment' && ge.nodeSel.has(n.id)).forEach((c) => {
      geCurGraph().nodes.forEach((n) => {
        if (n.type !== 'comment' && n.x >= c.x && n.y >= c.y && n.x < c.x + c.w && n.y < c.y + c.h) moving.add(n.id);
      });
    });
    ge.drag = { mode: 'nodes', cx: event.clientX, cy: event.clientY, origin: new Map([...moving].map((nid) => {
      const n = geNodeById(nid);
      return [nid, { x: n.x, y: n.y }];
    })), moved: false };
    graph.setPointerCapture(event.pointerId);
    return;
  }
  // Dwuklik na kablu wstawia w nim węzeł pomocniczy (Reroute).
  const wireEl = event.target.closest('.ge-wire-hit');
  if (event.button === 0 && wireEl && event.detail === 2) {
    geAddReroute(Number(wireEl.dataset.link), geGraphPoint(event));
    return;
  }
  if (event.button === 0) {
    const add = event.shiftKey || event.ctrlKey || event.metaKey;
    if (!add && ge.nodeSel.size) {
      ge.nodeSel.clear();
      geSelectionChanged();
    }
    ge.drag = { mode: 'marquee', cx: event.clientX, cy: event.clientY, base: new Set(ge.nodeSel) };
    graph.setPointerCapture(event.pointerId);
    return;
  }
  if (event.button === 1 || event.button === 2) {
    ge.drag = { mode: 'pan', cx: event.clientX, cy: event.clientY, vx: v.x, vy: v.y, moved: false, button: event.button };
    graph.setPointerCapture(event.pointerId);
  }
}

function geGraphMove(event) {
  const d = ge.drag;
  if (!d) return;
  const v = geGraphView();
  const dx = event.clientX - d.cx;
  const dy = event.clientY - d.cy;
  switch (d.mode) {
    case 'pan':
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      v.x = d.vx + dx;
      v.y = d.vy + dy;
      geApplyGraphView();
      break;
    case 'nodes': {
      if (!d.moved) {
        if (Math.hypot(dx, dy) < 3) return;
        d.moved = true;
        geSnapshot();
      }
      d.origin.forEach((o, id) => {
        const n = geNodeById(id);
        n.x = geSnap(o.x + dx / v.zoom);
        n.y = geSnap(o.y + dy / v.zoom);
        const el = ge.root.querySelector(`.ge-nodes [data-node="${id}"]`);
        el.style.left = n.x + 'px';
        el.style.top = n.y + 'px';
      });
      geDrawWires();
      break;
    }
    case 'resize': {
      if (!d.moved) {
        d.moved = true;
        geSnapshot();
      }
      const n = geNodeById(d.id);
      n.w = Math.max(160, geSnap(d.w + dx / v.zoom));
      n.h = Math.max(96, geSnap(d.h + dy / v.zoom));
      const el = ge.root.querySelector(`.ge-nodes [data-node="${d.id}"]`);
      el.style.width = n.w + 'px';
      el.style.height = n.h + 'px';
      break;
    }
    case 'wire':
      ge.tempWire = { from: d.start, to: geGraphPoint(event), dir: d.dir, type: d.type };
      geDrawWires();
      break;
    case 'marquee': {
      const box = ge.root.querySelector('.ge-marquee');
      const g = ge.root.querySelector('.ge-graph').getBoundingClientRect();
      const left = Math.min(d.cx, event.clientX);
      const top = Math.min(d.cy, event.clientY);
      const right = Math.max(d.cx, event.clientX);
      const bottom = Math.max(d.cy, event.clientY);
      box.hidden = false;
      Object.assign(box.style, { left: left - g.left + 'px', top: top - g.top + 'px', width: right - left + 'px', height: bottom - top + 'px' });
      ge.nodeSel = new Set(d.base);
      ge.root.querySelectorAll('.ge-nodes [data-node]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > left && r.left < right && r.bottom > top && r.top < bottom) ge.nodeSel.add(el.dataset.node);
      });
      geUpdateNodeSelection();
      break;
    }
    default:
  }
}

function geGraphUp(event) {
  const d = ge.drag;
  ge.drag = null;
  if (!d) return;
  const graph = ge.root.querySelector('.ge-graph');
  if (graph?.hasPointerCapture?.(event.pointerId)) graph.releasePointerCapture(event.pointerId);
  switch (d.mode) {
    case 'pan': {
      if (d.button !== 2 || d.moved) break;
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const nodeEl = hit?.closest('.ge-nodes [data-node]');
      const wireEl = hit?.closest('.ge-wire-hit');
      if (wireEl) {
        const index = Number(wireEl.dataset.link);
        const p = geGraphPoint(event);
        geMenu({ x: event.clientX, y: event.clientY }, [
          { label: 'Dodaj węzeł pomocniczy (Reroute)', key: 'Dwuklik', action: () => geAddReroute(index, p) },
          { label: 'Usuń połączenie', action: () => geDeleteLink(index) }
        ]);
        break;
      }
      if (!nodeEl) {
        geOpenNodeMenu(event.clientX, event.clientY, null);
        break;
      }
      const id = nodeEl.dataset.node;
      if (!ge.nodeSel.has(id)) ge.nodeSel = new Set([id]);
      geSelectionChanged();
      const pinEl = hit.closest('.ge-pin');
      geMenu({ x: event.clientX, y: event.clientY }, [
        ...(pinEl ? [{ label: 'Rozłącz ten pin', key: 'Alt+klik', action: () => geBreakPin({ node: id, pin: pinEl.dataset.pin, dir: pinEl.dataset.dir }) }, '-'] : []),
        { label: 'Duplikuj', key: 'Ctrl+D', action: () => geCopyNodes() && gePasteNodes() },
        { label: 'Komentarz wokół', key: 'C', action: () => geAddComment() },
        ...(geCanBreak(geNodeById(id)) ? [{ label: geNodeById(id).breakpoint ? '⏺ Usuń breakpoint' : '⏺ Dodaj breakpoint', key: 'F9', action: () => geToggleBreakpoint() }] : []),
        ...(geCurGraph().nodes.some((x) => x.breakpoint) ? [{ label: 'Usuń wszystkie breakpointy w tym grafie', action: geClearBreakpoints }] : []),
        { label: 'Usuń', key: 'Delete', action: geDeleteNodes }
      ]);
      break;
    }
    case 'nodes':
    case 'resize':
      if (d.moved) geScheduleSave();
      break;
    case 'wire': {
      ge.tempWire = null;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const pinEl = target?.closest('.ge-graph .ge-pin');
      if (pinEl) {
        geTryConnect(d, { node: pinEl.closest('[data-node]').dataset.node, pin: pinEl.dataset.pin, dir: pinEl.dataset.dir, type: pinEl.dataset.type });
      } else if (target?.closest('.ge-graph')) {
        geDrawWires();
        geOpenNodeMenu(event.clientX, event.clientY, { node: d.node, pin: d.pin, dir: d.dir, type: d.type });
      } else geDrawWires();
      break;
    }
    case 'marquee':
      ge.root.querySelector('.ge-marquee').hidden = true;
      geSelectionChanged();
      break;
    default:
  }
}

function geGraphWheel(event) {
  if (event.target.closest('.ge-ctx')) return;
  event.preventDefault();
  geCloseNodeMenu();
  const v = geGraphView();
  const r = event.currentTarget.getBoundingClientRect();
  const sx = event.clientX - r.left;
  const sy = event.clientY - r.top;
  const wx = (sx - v.x) / v.zoom;
  const wy = (sy - v.y) / v.zoom;
  v.zoom = Math.min(1.5, Math.max(0.2, v.zoom * Math.pow(1.0015, -event.deltaY)));
  v.x = sx - wx * v.zoom;
  v.y = sy - wy * v.zoom;
  geApplyGraphView();
}

function geGraphDrop(event) {
  const fnId = event.dataTransfer.getData('application/x-ge-fn');
  if (fnId) {
    event.preventDefault();
    const p = geGraphPoint(event);
    geAddNode('call_fn', p.x, p.y, { fn: fnId });
    return;
  }
  const dispRef = event.dataTransfer.getData('application/x-ge-disp');
  if (dispRef) {
    event.preventDefault();
    const disp = geChainEntry(ge.project, geCurBp(), 'dispatchers', dispRef)?.item;
    if (!disp) return;
    const p = geGraphPoint(event);
    const noEvents = geMode() === 'construction' || !!geCurFn();
    geMenu({ x: event.clientX, y: event.clientY }, geDispMenuItems(disp.name, { disp: dispRef }, noEvents).map((item) => ({
      label: item.label, action: () => geAddDispNode(item, p)
    })));
    return;
  }
  const varId = event.dataTransfer.getData('application/x-ge-var');
  if (!varId) return;
  event.preventDefault();
  const bp = geCurBp();
  const v = geChainEntry(ge.project, bp, 'variables', varId)?.item;
  if (!v) return;
  const p = geGraphPoint(event);
  const add = (type) => geAddNode(type, p.x, p.y, { var: varId });
  if (event.ctrlKey) add('var_get');
  else if (event.altKey) add('var_set');
  else geMenu({ x: event.clientX, y: event.clientY }, [{ label: `Get ${v.name}`, key: 'Pobierz', action: () => add('var_get') }, { label: `Set ${v.name}`, key: 'Ustaw', action: () => add('var_set') }]);
}

function geAddNode(type, x, y, props = {}, values = {}) {
  const bp = geCurBp();
  const id = 'n' + bp.nextNode++;
  geChange(() => {
    geCurGraph().nodes.push({ id, type, x: geSnap(x), y: geSnap(y), props, values });
    ge.nodeSel = new Set([id]);
    ge.bpPanel = { kind: 'node', id };
  }, { bp: bp.id, only: ['graph', 'details', 'mybp', 'code'] });
  return id;
}

// Węzeł Event Dispatchera z menu po przeciągnięciu dispatchera na graf (Assign dokłada podpięte zdarzenie).
function geAddDispNode(item, p) {
  const bp = geCurBp();
  const id = 'n' + bp.nextNode++;
  geChange(() => {
    const node = { id, type: item.node.type, x: geSnap(p.x), y: geSnap(p.y), props: { ...item.node.props }, values: {} };
    geCurGraph().nodes.push(node);
    if (item.assign) geAssignDispatcher(bp, geCurGraph(), node);
    ge.nodeSel = new Set([id]);
    ge.bpPanel = { kind: 'node', id };
  }, { bp: bp.id, only: ['graph', 'details', 'mybp', 'code'] });
}

function geToast(text) {
  const toast = ge.root.querySelector('.ge-toast');
  if (!toast) return;
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(ge.toastTimer);
  ge.toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

function geLink(graph, out, inp) {
  graph.links = graph.links.filter((l) => {
    if (inp.type !== 'exec' && l.to[0] === inp.node && l.to[1] === inp.pin) return false;
    if (out.type === 'exec' && l.from[0] === out.node && l.from[1] === out.pin) return false;
    return !(l.from[0] === out.node && l.from[1] === out.pin && l.to[0] === inp.node && l.to[1] === inp.pin);
  });
  graph.links.push({ from: [out.node, out.pin], to: [inp.node, inp.pin] });
}

function geTryConnect(a, b) {
  if (a.node === b.node || a.dir === b.dir) {
    geDrawWires();
    if (a.node !== b.node) geToast('Połącz wyjście (prawa strona węzła) z wejściem (lewa strona).');
    return;
  }
  const out = a.dir === 'out' ? a : b;
  const inp = a.dir === 'out' ? b : a;
  // Pin Array węzłów tablic przyjmuje tablicę dowolnego typu i przejmuje typ jej elementu.
  const arrayIn = GE_ARRAY_NODES.has(geNodeById(inp.node)?.type) && inp.pin === 'array' && geContainer(out.type).container === 'array';
  if (!arrayIn && !geCanConnect(out.type, inp.type)) {
    geDrawWires();
    geToast(`Nie pasuje: ${geType(out.type).label} → ${geType(inp.type).label}`);
    return;
  }
  const bp = geCurBp();
  geChange(() => {
    geLink(geCurGraph(), out, inp);
    if (arrayIn) geCleanLinks(bp);
  }, { bp: bp.id, only: arrayIn ? ['graph', 'details', 'code'] : ['graph', 'code'] });
}

function geBreakPin(pin) {
  const bp = geCurBp();
  const hit = (l) => (pin.dir === 'out' ? l.from[0] === pin.node && l.from[1] === pin.pin : l.to[0] === pin.node && l.to[1] === pin.pin);
  if (!geCurGraph().links.some(hit)) return;
  geChange(() => {
    geCurGraph().links = geCurGraph().links.filter((l) => !hit(l));
  }, { bp: bp.id, only: ['graph', 'code'] });
}

function geDeleteLink(index) {
  const bp = geCurBp();
  if (!geCurGraph().links[index]) return;
  geChange(() => {
    geCurGraph().links.splice(index, 1);
  }, { bp: bp.id, only: ['graph', 'code'] });
}

// Wstawia węzeł pomocniczy (Reroute) w kabel w punkcie p — kabel idzie odtąd przez niego, jak w Unreal Engine.
function geAddReroute(index, p) {
  const bp = geCurBp();
  const graph = geCurGraph();
  const link = graph.links[index];
  if (!link) return;
  const src = graph.nodes.find((n) => n.id === link.from[0]);
  const type = src && gePins(src, bp).outs.find((pin) => pin.id === link.from[1])?.type;
  if (!type) return;
  const exec = type === 'exec';
  geChange(() => {
    const id = 'n' + bp.nextNode++;
    // Kropka ma ok. 36×24 px — środek ląduje tam, gdzie kliknięto.
    graph.nodes.push({ id, type: 'reroute', x: Math.round(p.x - 18), y: Math.round(p.y - 12), props: { type }, values: {} });
    graph.links.splice(index, 1, { from: link.from, to: [id, exec ? 'exec' : 'in'] }, { from: [id, exec ? 'then' : 'out'], to: link.to });
  }, { bp: bp.id, only: ['graph', 'code'] });
}

// ---------- Menu węzłów (prawy przycisk albo kabel puszczony w pustym miejscu) ----------

function geMenuEntries(bp) {
  const items = [];
  const construction = geMode() === 'construction';
  const inFn = geCurFn();
  // W Construction Script i w funkcjach nie ma zdarzeń — graf zaczyna się od stałego węzła.
  const noEvents = construction || !!inFn;
  GE_NODE_LIST.forEach((def) => {
    if (def.hidden || !geNodeAllowed(def, bp)) return;
    if (noEvents && def.kind === 'event') return;
    if (construction && GE_NO_CONSTRUCTION.has(def.type)) return;
    if (inFn && GE_NO_FUNCTION.has(def.type)) return;
    const props = Object.fromEntries((def.props ?? []).filter((p) => p.def !== undefined).map((p) => [p.id, p.def]));
    // Węzły komponentów od razu wskazują pierwszy pasujący komponent; bez komponentów ich nie ma.
    const compProp = def.props?.find((p) => p.kind === 'component');
    if (compProp) {
      const first = geCompChoices(bp, compProp)[0];
      if (!first) return;
      props[compProp.id] = first.ref;
    }
    const label = def.type === 'ev_custom' ? 'Add Custom Event' : def.type === 'timeline' ? 'Add Timeline...' : geNodeTitle({ type: def.type, props }, bp);
    items.push({ cat: def.cat, label, ue: def.pl, node: { type: def.type, props, values: {} } });
  });
  geChainEntries(ge.project, bp, 'variables').forEach(({ item: v, ref }) => {
    items.push({ cat: 'Zmienne', label: `Get ${v.name}`, ue: `Pobierz ${v.name}`, node: { type: 'var_get', props: { var: ref }, values: {} } });
    items.push({ cat: 'Zmienne', label: `Set ${v.name}`, ue: `Ustaw ${v.name}`, node: { type: 'var_set', props: { var: ref }, values: {} } });
  });
  const mine = new Set([bp, ...geAncestors(ge.project, bp)]);
  [...geOfKind('actor'), ...geOfKind('anim_bp')].filter((b) => !mine.has(b)).forEach((b) => geChainEntries(ge.project, b, 'variables').forEach(({ item: v, ref }) => {
    const props = { var: ref, cls: b.id };
    items.push({ cat: 'Zmienne', label: `Get ${v.name} (${b.name})`, ue: `Pobierz ${v.name} z obiektu ${b.name} (Target)`, node: { type: 'var_get', props, values: {} } });
    items.push({ cat: 'Zmienne', label: `Set ${v.name} (${b.name})`, ue: `Ustaw ${v.name} w obiekcie ${b.name} (Target)`, node: { type: 'var_set', props: { ...props }, values: {} } });
  }));
  (geHasViewport(bp) ? geChainEntries(ge.project, bp, 'components') : []).forEach(({ item: c, ref }) => {
    const kind = geCompKind(c);
    const add = (type, label, ue) => {
      if (noEvents && GE_NODES[type].kind === 'event') return;
      items.push({ cat: GE_NODES[type].cat, label, ue, node: { type, props: { comp: ref }, values: {} } });
    };
    if (kind !== 'movement') {
      add('ev_comp_overlap', `On Component Begin Overlap (${c.name})`, `Gdy coś najdzie na ${c.name}`);
      add('comp_location', `Set Relative Location (${c.name})`, `Przesuń ${c.name}`);
    }
    if (kind === 'shape') add('comp_visible', `Set Visibility (${c.name})`, `Pokaż / ukryj ${c.name}`);
    if (kind === 'movement') add('comp_active', `Set Active (${c.name})`, `Włącz / wyłącz ${c.name}`);
  });
  // Jak w Unreal Engine węzeł wywołania nazywa się tak jak zdarzenie; zdarzenia innych klas wywołuje się z pinem Target.
  const called = new Set();
  [bp, ...geAncestors(ge.project, bp), ...geCodeBlueprints(ge.project)].forEach((b) => (b.graph?.nodes ?? []).filter((n) => n.type === 'ev_custom').forEach((n) => {
    const name = n.props?.name || 'MojeZdarzenie';
    if (called.has(GE_RT.ident(name))) return;
    called.add(GE_RT.ident(name));
    const own = mine.has(b);
    items.push({ cat: 'Sterowanie', label: own ? name : `${name} (${b.name})`, ue: own ? `Wywołaj zdarzenie ${name}` : `Wywołaj zdarzenie ${name} w obiekcie ${b.name} (Target)`, node: { type: 'call_event', props: { name }, values: {} } });
  }));
  // Gotowe warianty węzłów dla zasobów z Przeglądarki zawartości (widgety, materiały, interfejsy, przyciski).
  geOfKind('widget').forEach((w) => {
    items.push({ cat: 'Interfejs (UI)', label: `Create ${w.name} Widget`, ue: `Utwórz widget ${w.name}`, node: { type: 'create_widget', props: { cls: w.id }, values: {} } });
  });
  geOfKind('material').forEach((m) => {
    items.push({ cat: 'Aktor', label: `Set Material (${m.name})`, ue: `Ustaw materiał ${m.name}`, node: { type: 'set_material', props: { mat: m.id }, values: {} } });
  });
  // Enhanced Input: zdarzenie i wartość każdej akcji, włączanie i wyłączanie każdego kontekstu.
  // Bez zasobów zostają ogólne węzły z wyborem akcji / kontekstu w węźle, żeby dało się je znaleźć.
  if (!construction) {
    const input = (type, props, label, ue) => items.push({ cat: 'Wejście', label, ue, node: { type, props, values: {} } });
    const actions = geOfKind('input_action');
    const contexts = geOfKind('input_context');
    (actions.length ? actions : [{ id: '', name: 'Input Action' }]).forEach((a) => {
      if (!noEvents) input('ev_input_action', { action: a.id }, `EnhancedInputAction ${a.name}`, `Zdarzenie akcji wejścia ${a.name} (Triggered, Started, Completed…)`);
      input('input_value', { action: a.id }, `Get ${a.name} (Action Value)`, `Wartość akcji wejścia ${a.name}`);
    });
    (contexts.length ? contexts : [{ id: '', name: 'Mapping Context' }]).forEach((m) => {
      input('add_mapping_context', { ctx: m.id }, `Add Mapping Context (${m.name})`, `Włącz mapowanie klawiszy ${m.name}`);
      input('remove_mapping_context', { ctx: m.id }, `Remove Mapping Context (${m.name})`, `Wyłącz mapowanie klawiszy ${m.name}`);
      input('has_mapping_context', { ctx: m.id }, `Has Mapping Context (${m.name})`, `Czy mapowanie ${m.name} jest włączone`);
    });
  }
  geOfKind('interface').forEach((i) => i.functions.forEach((f) => {
    const fn = `${i.id}:${f.id}`;
    items.push({ cat: 'Interfejsy', label: `${f.name} (Message)`, ue: `Wywołaj ${f.name} z ${i.name}`, node: { type: 'call_interface', props: { fn }, values: {} } });
    if (!noEvents && bp.id !== 'level' && geClassInterfaces(ge.project, bp).includes(i.id)) items.push({ cat: 'Interfejsy', label: `Event ${f.name}`, ue: `Zdarzenie ${f.name} z ${i.name}`, node: { type: 'ev_interface', props: { fn }, values: {} } });
  }));
  if (geKind(bp) === 'widget') {
    if (!noEvents) bp.widget.elements.filter((el) => el.type === 'button').forEach((el) => {
      items.push({ cat: 'Zdarzenia', label: `On Clicked (${el.name})`, ue: `Gdy kliknięto ${el.name}`, node: { type: 'ev_button', props: { button: el.name }, values: {} } });
      GE_BUTTON_EVENTS.forEach(([type, ue, pl]) => items.push({ cat: 'Zdarzenia', label: `${ue} (${el.name})`, ue: `${pl} ${el.name}`, node: { type, props: { button: el.name }, values: {} } }));
    });
    bp.widget.elements.filter((el) => el.type === 'widget').forEach((el) => {
      items.push({ cat: 'Interfejs (UI)', label: `Get ${el.name}`, ue: `Zagnieżdżony widget ${el.name}`, node: { type: 'child_widget', props: { el: el.name }, values: {} } });
    });
  }
  // Event Dispatchery: własne i odziedziczone (Target — self) oraz innych klas (pin Target z ich obiektem).
  if (bp.id !== 'level') geChainEntries(ge.project, bp, 'dispatchers').forEach(({ item: d, ref }) => items.push(...geDispMenuItems(d.name, { disp: ref }, noEvents)));
  [...geOfKind('actor'), ...geOfKind('widget')].filter((b) => !mine.has(b)).forEach((b) => geChainEntries(ge.project, b, 'dispatchers').forEach(({ item: d, ref }) => {
    items.push(...geDispMenuItems(`${d.name} (${b.name})`, { disp: ref, cls: b.id }, noEvents));
  }));
  // Funkcje Timeline'ów z Event Graph (jak węzły z pinem Target komponentu Timeline w Unreal Engine).
  if (!construction) geTlNodes(bp).forEach((t) => GE_TL_FUNCS.forEach(([type, ue, desc]) => {
    items.push({ cat: 'Timeline', label: `${ue} (${t.props?.name})`, ue: desc, node: { type, props: { tl: t.id }, values: {} } });
  }));
  // Funkcje własne i odziedziczone (Target — self) oraz funkcje innych klas aktorów (pin Target z ich obiektem, np. z Cast To).
  geChainEntries(ge.project, bp, 'funcs').forEach(({ item: f, ref }) => {
    items.push({ cat: 'Funkcje', label: f.name, ue: `Wywołaj funkcję ${f.name}`, node: { type: 'call_fn', props: { fn: ref }, values: {} } });
  });
  geOfKind('actor').filter((b) => !mine.has(b)).forEach((b) => geChainEntries(ge.project, b, 'funcs').forEach(({ item: f, ref }) => {
    items.push({ cat: 'Funkcje', label: `${f.name} (${b.name})`, ue: `Wywołaj funkcję ${f.name} w obiekcie ${b.name} (Target)`, node: { type: 'call_fn', props: { fn: ref, cls: b.id }, values: {} } });
  }));
  if (inFn) items.push({ cat: 'Funkcje', label: 'Add Return Node', ue: `Zakończ ${inFn.name} i oddaj wyniki`, node: { type: 'fn_return', props: { fn: inFn.id }, values: {} } });
  items.push(...geDataMenuEntries(bp, noEvents));
  items.push(...geZdMenuEntries(bp, noEvents));
  items.push({ cat: 'Inne', label: 'Add Comment', ue: 'Dodaj komentarz (C)', comment: true });
  return items;
}

const geFold = (text) => String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

function geOpenNodeMenu(clientX, clientY, pending) {
  geCloseNodeMenu();
  const graph = ge.root.querySelector('.ge-graph');
  const bp = geCurBp();
  const g = graph.getBoundingClientRect();
  const v = geGraphView();
  const menu = document.createElement('div');
  menu.className = 'ge-ctx';
  menu.innerHTML = `
    <div class="ge-ctx-head">
      <b>Wszystkie akcje dla tego Blueprintu</b>
      <label><input type="checkbox" class="ge-ctx-sens" ${pending ? 'checked' : 'disabled'} /> Kontekstowe</label>
    </div>
    <input class="ge-ctx-search" type="search" placeholder="Szukaj węzła… (np. skok, print, +)" aria-label="Szukaj węzła" />
    <div class="ge-ctx-list" role="listbox"></div>`;
  graph.append(menu);
  ge.ctx = { el: menu, pending, world: { x: (clientX - g.left - v.x) / v.zoom, y: (clientY - g.top - v.y) / v.zoom }, items: geMenuEntries(bp), shown: [], active: 0 };
  const search = menu.querySelector('.ge-ctx-search');
  search.addEventListener('input', () => {
    ge.ctx.active = 0;
    geRenderNodeMenu();
  });
  menu.querySelector('.ge-ctx-sens').addEventListener('change', geRenderNodeMenu);
  search.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const n = ge.ctx.shown.length;
      if (!n) return;
      ge.ctx.active = (ge.ctx.active + (event.key === 'ArrowDown' ? 1 : n - 1)) % n;
      geRenderNodeMenu(false);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = ge.ctx.shown[ge.ctx.active];
      if (item) geCreateFromMenu(item);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      geCloseNodeMenu();
    }
  });
  menu.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-i]');
    if (btn) geCreateFromMenu(ge.ctx.shown[Number(btn.dataset.i)]);
  });
  geRenderNodeMenu();
  // Pozycja dopiero po wypełnieniu listy, żeby menu przy krawędzi nie wychodziło poza graf.
  menu.style.left = Math.max(8, Math.min(clientX - g.left, g.width - menu.offsetWidth - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(clientY - g.top, g.height - menu.offsetHeight - 8)) + 'px';
  search.focus();
}

function geRenderNodeMenu(refilter = true) {
  const ctx = ge.ctx;
  if (!ctx) return;
  const bp = geCurBp();
  if (refilter) {
    const words = geFold(ctx.el.querySelector('.ge-ctx-search').value).split(/\s+/).filter(Boolean);
    const sensitive = ctx.pending && ctx.el.querySelector('.ge-ctx-sens').checked;
    ctx.shown = ctx.items.filter((item) => {
      const hay = geFold(`${item.label} ${item.ue} ${item.cat}`);
      if (!words.every((w) => hay.includes(w))) return false;
      if (!sensitive) return true;
      if (item.comment) return false;
      const pins = gePins({ ...geMenuNode(item.node, ctx.pending), id: 'tmp' }, bp);
      const list = ctx.pending.dir === 'out' ? pins.ins : pins.outs;
      return list.some((p) => (ctx.pending.dir === 'out' ? geCanConnect(ctx.pending.type, p.type) : geCanConnect(p.type, ctx.pending.type)));
    });
    const order = [...GE_CATS, 'Inne'];
    ctx.shown.sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
  }
  let cat = null;
  ctx.el.querySelector('.ge-ctx-list').innerHTML = ctx.shown.map((item, i) => {
    const head = item.cat !== cat ? `<div class="ge-ctx-cat">▾ ${geEsc(item.cat)}</div>` : '';
    cat = item.cat;
    return `${head}<button type="button" class="ge-ctx-item${i === ctx.active ? ' is-active' : ''}" data-i="${i}" role="option" aria-selected="${i === ctx.active}"><span>${geEsc(item.label)}</span><small>${geEsc(item.ue)}</small></button>`;
  }).join('') || '<p class="ge-empty">Nic nie pasuje.</p>';
  ctx.el.querySelector('.ge-ctx-item.is-active')?.scrollIntoView({ block: 'nearest' });
}

function geCloseNodeMenu() {
  if (!ge?.ctx) return;
  ge.ctx.el.remove();
  ge.ctx = null;
}

function geCreateFromMenu(item) {
  const { world, pending } = ge.ctx;
  geCloseNodeMenu();
  const bp = geCurBp();
  if (item.comment) {
    geAddComment(world);
    return;
  }
  geChange(() => {
    const id = 'n' + bp.nextNode++;
    const props = { ...geMenuNode(item.node, pending).props };
    if (item.node.type === 'timeline') {
      props.name = geTimelineName(bp);
      props.tl = geNewTimeline();
    }
    if (item.node.type === 'ev_custom') props.name = geUniqueName('MojeZdarzenie', bp.graph.nodes.filter((n) => n.type === 'ev_custom').map((n) => n.props?.name));
    const node = { id, type: item.node.type, x: geSnap(pending?.dir === 'in' ? world.x - 220 : world.x), y: geSnap(world.y - 16), props, values: { ...item.node.values } };
    geCurGraph().nodes.push(node);
    if (pending) {
      const pins = gePins(node, bp);
      const list = pending.dir === 'out' ? pins.ins : pins.outs;
      const match = list.find((p) => p.type === pending.type)
        ?? list.find((p) => (pending.dir === 'out' ? geCanConnect(pending.type, p.type) : geCanConnect(p.type, pending.type)));
      if (match) {
        const mine = { node: id, pin: match.id, type: match.type };
        if (pending.dir === 'out') geLink(geCurGraph(), pending, mine);
        else geLink(geCurGraph(), mine, pending);
      }
    }
    if (item.assign) geAssignDispatcher(bp, geCurGraph(), node);
    ge.nodeSel = new Set([id]);
    ge.bpPanel = { kind: 'node', id };
  }, { bp: bp.id, only: ['graph', 'details', 'mybp', 'code'] });
}

function geAddComment(at = null) {
  const bp = geCurBp();
  const els = [...ge.root.querySelectorAll('.ge-nodes .ge-node')].filter((el) => ge.nodeSel.has(el.dataset.node));
  let box;
  if (els.length) {
    const nodes = els.map((el) => ({ n: geNodeById(el.dataset.node), w: el.offsetWidth, h: el.offsetHeight }));
    const x1 = Math.min(...nodes.map((o) => o.n.x));
    const y1 = Math.min(...nodes.map((o) => o.n.y));
    const x2 = Math.max(...nodes.map((o) => o.n.x + o.w));
    const y2 = Math.max(...nodes.map((o) => o.n.y + o.h));
    box = { x: geSnap(x1 - 32), y: geSnap(y1 - 64), w: geSnap(x2 - x1 + 64), h: geSnap(y2 - y1 + 96) };
  } else {
    const p = at ?? { x: 0, y: 0 };
    box = { x: geSnap(p.x), y: geSnap(p.y), w: 400, h: 224 };
  }
  geChange(() => {
    const id = 'n' + bp.nextNode++;
    geCurGraph().nodes.unshift({ id, type: 'comment', text: 'Komentarz', color: '#ffffff', ...box, props: {}, values: {} });
    ge.nodeSel = new Set([id]);
    ge.bpPanel = { kind: 'node', id };
  }, { only: ['graph', 'details'] });
}

function geDeleteNodes() {
  const bp = geCurBp();
  // Węzła „Construction Script” nie da się usunąć ani skopiować — w grafie jest zawsze jeden.
  geCurGraph().nodes.forEach((n) => {
    if (GE_FIXED_NODES.has(n.type)) ge.nodeSel.delete(n.id);
  });
  if (!ge.nodeSel.size) return;
  geChange(() => {
    // Usunięty węzeł pomocniczy nie przerywa kabla — to, co do niego wchodziło, łączy się z tym, dokąd wychodził.
    geCurGraph().nodes.filter((n) => n.type === 'reroute' && ge.nodeSel.has(n.id)).forEach((r) => {
      const links = geCurGraph().links;
      const ins = links.filter((l) => l.to[0] === r.id && l.from[0] !== r.id);
      const outs = links.filter((l) => l.from[0] === r.id && l.to[0] !== r.id);
      geCurGraph().links = links.filter((l) => l.from[0] !== r.id && l.to[0] !== r.id)
        .concat(ins.flatMap((a) => outs.map((b) => ({ from: a.from, to: b.to }))));
    });
    geCurGraph().nodes = geCurGraph().nodes.filter((n) => !ge.nodeSel.has(n.id));
    geCurGraph().links = geCurGraph().links.filter((l) => !ge.nodeSel.has(l.from[0]) && !ge.nodeSel.has(l.to[0]));
    ge.nodeSel.clear();
    ge.bpPanel = null;
  }, { bp: bp.id, only: ['graph', 'details', 'mybp', 'code'] });
}

function geCopyNodes() {
  const bp = geCurBp();
  if (!ge.nodeSel.size) return false;
  ge.clipboard = {
    nodes: JSON.parse(JSON.stringify(geCurGraph().nodes.filter((n) => ge.nodeSel.has(n.id) && !GE_FIXED_NODES.has(n.type)))),
    links: JSON.parse(JSON.stringify(geCurGraph().links.filter((l) => ge.nodeSel.has(l.from[0]) && ge.nodeSel.has(l.to[0]))))
  };
  return true;
}

function gePasteNodes() {
  const bp = geCurBp();
  const clip = ge.clipboard;
  if (!clip?.nodes.length) return;
  geChange(() => {
    const ids = new Map();
    clip.nodes.forEach((n) => {
      n.x += 32;
      n.y += 32;
      const copy = { ...JSON.parse(JSON.stringify(n)), id: 'n' + bp.nextNode++ };
      ids.set(n.id, copy.id);
      // Kopia Timeline'u to nowy Timeline (z kopią ścieżek) pod wolną nazwą.
      if (copy.type === 'timeline' && geTlNodes(bp).some((t) => t.props?.name === copy.props?.name)) copy.props.name = geTimelineName(bp);
      if (copy.type === 'comment') geCurGraph().nodes.unshift(copy);
      else geCurGraph().nodes.push(copy);
    });
    clip.links.forEach((l) => geCurGraph().links.push({ from: [ids.get(l.from[0]), l.from[1]], to: [ids.get(l.to[0]), l.to[1]] }));
    ge.nodeSel = new Set(ids.values());
    ge.bpPanel = null;
  }, { bp: bp.id, only: ['graph', 'details', 'mybp', 'code'] });
}

// ---------- Breakpointy ----------
// Breakpoint (node.breakpoint) zatrzymuje grę w edytorze przed bloczkiem i pokazuje wartości zmiennych.
// Działa na bloczkach z białym wejściem i na zdarzeniach — bloczki danych (zielone) liczą się w środku innych.

const geCanBreak = (n) => ['exec', 'flow', 'event'].includes(GE_NODES[n?.type]?.kind);

function geToggleBreakpoint(ids = [...ge.nodeSel]) {
  const nodes = ids.map(geNodeById).filter(geCanBreak);
  if (!nodes.length) {
    if (ids.length) geLog('Breakpoint można postawić na bloczku z białym wejściem albo na zdarzeniu.', 'warn');
    return;
  }
  const on = !nodes.every((n) => n.breakpoint);
  geSnapshot();
  nodes.forEach((n) => {
    if (on) n.breakpoint = true;
    else delete n.breakpoint;
  });
  geScheduleSave();
  geRenderGraph();
}

function geClearBreakpoints() {
  geSnapshot();
  geCurGraph().nodes.forEach((n) => delete n.breakpoint);
  geScheduleSave();
  geRenderGraph();
}

// Blueprint i węzeł z breakpointu (Level Blueprint innego poziomu ma id „level:<id poziomu>”).
function geBreakTarget(hit) {
  const lvlId = hit.bpId.startsWith('level:') ? hit.bpId.slice(6) : null;
  const bp = lvlId ? geLevels(ge.project).find((l) => l.id === lvlId)?.level : geBp(hit.bpId);
  const node = bp && geGraphs(bp).flatMap((g) => g.nodes).find((n) => n.id === hit.nodeId);
  return { bp, node, lvlId };
}

// Gra stanęła na breakpoincie (hook onBreak silnika): panel z wartościami nad widokiem gry.
function geShowBreak(hit) {
  const { bp, node } = geBreakTarget(hit);
  ge.lastBreak = { ...hit, bp };
  const title = node ? geNodeTitle(node, bp) : hit.nodeId;
  const bpName = bp?.id === 'level' || hit.bpId.startsWith('level:') ? 'Level Blueprint' : bp?.name ?? hit.className;
  geLog(`⏸ Breakpoint: ${bpName} › ${title} (aktor ${hit.actor}).`, 'warn');
  const vp = ge.root.querySelector('.ge-viewport');
  vp.querySelector('.ge-debug')?.remove();
  const panel = document.createElement('div');
  panel.className = 'ge-debug';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Gra zatrzymana na breakpoincie');
  const groups = hit.groups.map((g) => `<div class="ge-debug-group"><div class="ge-debug-gtitle">${geEsc(g.title)}</div>
    ${g.rows.map(([name, value]) => `<div class="ge-debug-row"><span class="ge-debug-name" title="${geEsc(name)}">${geEsc(name)}</span><span class="ge-debug-value">${geEsc(value)}</span></div>`).join('')}</div>`).join('');
  panel.innerHTML = `<div class="ge-debug-head"><span class="ge-debug-ic">⏸</span><div><b>Zatrzymano na breakpoincie</b><small>${geEsc(bpName)} › ${geEsc(title)}</small></div></div>
    <div class="ge-debug-where">Aktor: <b>${geEsc(hit.actor)}</b> · czas gry ${hit.time} s</div>
    <div class="ge-debug-body">${groups || '<p class="ge-empty">Brak zmiennych do pokazania.</p>'}</div>
    <p class="ge-debug-note">Wartości z chwili przed wykonaniem bloczka. Reszta tej klatki gry już się wykonała.</p>
    <div class="ge-debug-btns">
      <button type="button" class="is-primary" data-dbg="continue" title="Gra działa dalej do następnego breakpointu (F8)">▶ Kontynuuj <kbd>F8</kbd></button>
      <button type="button" data-dbg="show" title="Kończy grę i otwiera graf z tym bloczkiem">🔎 Pokaż bloczek</button>
      <button type="button" data-dbg="stop" title="Kończy grę (Esc)">■ Zakończ</button>
    </div>`;
  panel.addEventListener('click', (event) => {
    const action = event.target.closest('[data-dbg]')?.dataset.dbg;
    if (action === 'continue') geResumeBreak();
    else if (action === 'show') geShowBreakNode();
    else if (action === 'stop') geStopPlay();
  });
  vp.append(panel);
  panel.querySelector('[data-dbg="continue"]').focus({ preventScroll: true });
}

function geResumeBreak() {
  ge.root.querySelector('.ge-debug')?.remove();
  ge.playing?.debugResume();
  ge.root.querySelector('.ge-viewport')?.focus({ preventScroll: true });
}

// Kończy grę i pokazuje bloczek z breakpointu (podświetlony, aż do następnego grania).
function geShowBreakNode() {
  const hit = ge.lastBreak;
  geStopPlay();
  const { bp, node, lvlId } = geBreakTarget(hit);
  if (!bp || !node) return;
  if (lvlId) geOpenLevel(lvlId);
  geOpenTab(geTabFor(lvlId ? 'level' : bp.id));
  geFocusNode(node.id);
}

function geFocusNode(id) {
  // Węzeł może leżeć w innym grafie (np. błąd z Construction Script albo z funkcji) — wtedy przełączamy zakładkę.
  const bp = geCurBp();
  const fn = bp?.funcs?.find((f) => f.graph.nodes.some((n) => n.id === id));
  const mode = fn ? 'fn:' + fn.id : bp?.construction?.nodes.some((n) => n.id === id) ? 'construction' : 'graph';
  if (geMode() !== mode && geModeOk(bp, mode)) {
    ge.bpModes[ge.tab] = mode;
    geGraphView();
    ge.nodeSel.clear();
    geRender();
  }
  const graph = ge.root.querySelector('.ge-graph');
  const n = geNodeById(id);
  if (!graph || !n) return;
  const v = geGraphView();
  v.x = graph.clientWidth / 2 - (n.x + 100) * v.zoom;
  v.y = graph.clientHeight / 2 - (n.y + 40) * v.zoom;
  ge.nodeSel = new Set([id]);
  geApplyGraphView();
  geDrawWires();
  geSelectionChanged();
}

function geFitGraph() {
  const graph = ge.root.querySelector('.ge-graph');
  const els = [...(graph?.querySelectorAll('.ge-nodes [data-node]') ?? [])];
  if (!graph || !els.length) return;
  const bp = geCurBp();
  const boxes = els.map((el) => {
    const n = geCurGraph().nodes.find((node) => node.id === el.dataset.node);
    return { x1: n.x, y1: n.y, x2: n.x + el.offsetWidth, y2: n.y + el.offsetHeight };
  });
  const x1 = Math.min(...boxes.map((b) => b.x1));
  const y1 = Math.min(...boxes.map((b) => b.y1));
  const x2 = Math.max(...boxes.map((b) => b.x2));
  const y2 = Math.max(...boxes.map((b) => b.y2));
  const v = geGraphView();
  v.zoom = Math.min(1, Math.max(0.5, Math.min((graph.clientWidth - 80) / (x2 - x1), (graph.clientHeight - 80) / (y2 - y1))));
  v.x = (graph.clientWidth - (x2 - x1) * v.zoom) / 2 - x1 * v.zoom;
  v.y = (graph.clientHeight - (y2 - y1) * v.zoom) / 2 - y1 * v.zoom;
  geApplyGraphView();
  geDrawWires();
}

// ---------- Zmienne ----------

function geAddVariable() {
  const bp = geCurBp();
  geChange(() => {
    const id = 'v' + bp.nextVar++;
    bp.variables.push({ id, name: geUniqueName('NowaZmienna', geVarNamesTaken(bp)), type: 'float', value: 0, editable: false });
    ge.bpPanel = { kind: 'var', id };
    ge.nodeSel.clear();
  }, { bp: bp.id, only: ['mybp', 'details', 'graph', 'code'] });
  ge.root.querySelector('.ge-bp-details-body [data-k="name"]')?.select();
}

async function geDeleteVariable(id) {
  const bp = geCurBp();
  const v = bp.variables.find((item) => item.id === id);
  if (!v) return;
  const used = geRefUsers(bp, 'var', id);
  if (used.length) {
    const ok = await geDialog({ title: 'Usunąć zmienną?', text: `Zmienna <b>${geEsc(v.name)}</b> jest używana w ${used.length} węzłach (także w klasach podrzędnych). Usunę ją razem z nimi.`, buttons: [{ label: 'Usuń', value: true, primary: true }, { label: 'Anuluj', value: false }] });
    if (!ok) return;
  }
  geChange(() => {
    bp.variables = bp.variables.filter((item) => item.id !== id);
    geRemoveNodes(used);
    geAllActors(ge.project).forEach((a) => delete a.vars?.[`${bp.id}:${id}`]);
    ge.bpPanel = null;
  }, { bp: bp.id, only: ['mybp', 'details', 'graph', 'code'] });
}

function geUpdateVariable(bp, id, key, value, axis, fromList) {
  const v = bp.variables.find((item) => item.id === id);
  if (!v) return;
  geChange(() => {
    if (key === 'name') {
      const name = String(value).trim();
      if (name) v.name = geUniqueName(name, geVarNamesTaken(bp, v));
    } else if (key === 'type' || key === 'container' || key === 'valueType') {
      // Typ elementu, kontener i typ wartości Map składają się w jeden typ (np. „map:string|int”).
      const type = geRetype(v.type, key, value);
      if (type === v.type) return;
      v.type = type;
      v.value = geVarDefault(type);
      geRefUsers(bp, 'var', id).forEach(({ node }) => {
        node.values = {};
      });
      geAllActors(ge.project).forEach((a) => delete a.vars?.[`${bp.id}:${id}`]);
    } else if (key === 'editable') v.editable = value;
    else if (key === 'value') {
      if (axis) v.value = geSetAt(v.value, v.type, axis, value);
      else v.value = value;
    }
  }, { bp: bp.id, only: key === 'value' || (key === 'editable' && !fromList) ? ['mybp', 'code'] : ['mybp', 'details', 'graph', 'code'] });
}

// ---------- Własne funkcje ----------

const GE_JS_WORDS = new Set('arguments await break case catch class const continue debugger default delete do else enum eval export extends false finally for function if import in instanceof let new null return static super switch this throw true try typeof var void while with yield'.split(' '));

// Nazwa funkcji albo jej pinu jest nazwą w kodzie, więc od razu robimy z niej identyfikator w kodzie.
function geCodeName(name, taken) {
  let base = GE_RT.ident(name);
  if (GE_RESERVED.has(base) || GE_JS_WORDS.has(base)) base += '_';
  return geUniqueName(base, taken);
}

// Otwiera graf funkcji na osobnej karcie edytora i pokazuje jej Szczegóły.
function geOpenFunction(id) {
  ge.bpPanel = { kind: 'fn', id };
  ge.nodeSel.clear();
  if (geMode() === 'fn:' + id) {
    geSelectionChanged();
    return;
  }
  ge.bpModes[ge.tab] = 'fn:' + id;
  geRender();
}

function geAddFunction() {
  const bp = geCurBp();
  let id;
  geChange(() => {
    id = 'f' + bp.nextVar++;
    const entry = { id: 'n' + bp.nextNode++, type: 'fn_entry', x: 0, y: 0, props: { fn: id }, values: {} };
    const ret = { id: 'n' + bp.nextNode++, type: 'fn_return', x: 400, y: 0, props: { fn: id }, values: {} };
    bp.funcs.push({
      id, name: geCodeName('NowaFunkcja', bp.funcs.map((f) => f.name)), inputs: [], outputs: [],
      graph: { nodes: [entry, ret], links: [{ from: [entry.id, 'then'], to: [ret.id, 'exec'] }] }
    });
  }, { bp: bp.id, only: [] });
  geOpenFunction(id);
  ge.root.querySelector('.ge-bp-details-body [data-scope="fn"]')?.select();
}

function geRenameFunction(bp, id, value) {
  const fn = bp.funcs?.find((f) => f.id === id);
  const name = String(value).trim();
  if (!fn || !name) return;
  geChange(() => {
    fn.name = geCodeName(name, bp.funcs.filter((f) => f !== fn).map((f) => f.name));
  }, { bp: bp.id, only: [] });
  // Nazwa jest na karcie grafu, w Mój Blueprint i w tytułach węzłów — przebudowujemy całą stronę.
  geRender();
}

async function geDeleteFunction(id) {
  const bp = geCurBp();
  const fn = bp.funcs?.find((f) => f.id === id);
  if (!fn) return;
  // Wywołania w tej klasie, w klasach podrzędnych i w innych klasach (pin Target).
  const calls = geRefUsers(bp, 'fn', id).filter((u) => u.node.type === 'call_fn' && u.graph !== fn.graph);
  const ok = await geDialog({
    title: 'Usunąć funkcję?',
    text: `Funkcja <b>${geEsc(fn.name)}</b> zniknie razem ze swoim grafem${calls.length ? ` i ${calls.length} węzłami, które ją wywołują` : ''}.`,
    buttons: [{ label: 'Usuń', value: true, primary: true }, { label: 'Anuluj', value: false }]
  });
  if (!ok) return;
  geChange(() => {
    bp.funcs = bp.funcs.filter((f) => f !== fn);
    geRemoveNodes(calls);
    ge.nodeSel.clear();
    ge.bpPanel = null;
  }, { bp: bp.id, only: [] });
  geRender();
}

// Wejścia i wyjścia funkcji (side: inputs albo outputs). Po każdej zmianie usuwamy kable, które przestały pasować —
// we wszystkich grafach, bo węzły wywołania mogą stać także w Event Graph i w innych funkcjach.
function geFnPinChanged(bp) {
  geGraphs(bp).forEach((g) => geCleanLinks(bp, g));
  // Wywołania z klas podrzędnych i z innych klas (pin Target).
  geAllBlueprints(ge.project).filter((b) => b !== bp).forEach((b) => geGraphs(b).forEach((g) => {
    if (g.nodes.some((n) => n.type === 'call_fn')) geCleanLinks(b, g);
  }));
}

function geAddFnPin(fnId, side) {
  const bp = geCurBp();
  const fn = bp.funcs?.find((f) => f.id === fnId);
  if (!fn || !['inputs', 'outputs'].includes(side)) return;
  geChange(() => {
    fn[side].push({ id: 'p' + bp.nextVar++, name: geCodeName(side === 'inputs' ? 'Wejscie' : 'Wynik', fn[side].map((p) => p.name)), type: 'float' });
    ge.bpPanel = { kind: 'fn', id: fn.id };
  }, { bp: bp.id, only: ['mybp', 'details', 'graph', 'code'] });
}

function geDeleteFnPin(fnId, side, pinId) {
  const bp = geCurBp();
  const fn = bp.funcs?.find((f) => f.id === fnId);
  if (!fn?.[side]) return;
  geChange(() => {
    fn[side] = fn[side].filter((p) => p.id !== pinId);
    geFnPinChanged(bp);
  }, { bp: bp.id, only: ['mybp', 'details', 'graph', 'code'] });
}

function geUpdateFnPin(bp, fnId, side, pinId, key, value) {
  const fn = bp.funcs?.find((f) => f.id === fnId);
  const pin = fn?.[side]?.find((p) => p.id === pinId);
  if (!pin) return;
  geChange(() => {
    if (key === 'name') {
      const name = String(value).trim();
      if (name) pin.name = geCodeName(name, fn[side].filter((p) => p !== pin).map((p) => p.name));
    } else if (key === 'type' && geIsVarType(value)) {
      pin.type = value;
      // Wpisane w węzłach wartości starego typu nie pasują do nowego.
      geGraphs(bp).flatMap((g) => g.nodes).filter((n) => n.props?.fn === fn.id).forEach((n) => delete n.values?.[pin.id]);
      geFnPinChanged(bp);
    }
  }, { bp: bp.id, only: ['details', 'graph', 'code'] });
}

function geFnDetailsHtml(bp, fn) {
  const pinRows = (side) => fn[side].map((p) => {
    const extra = `data-fn="${fn.id}" data-side="${side}" data-id="${p.id}"`;
    return `<div class="ge-fn-pin">
      <span class="ge-pill" style="--pc:${geType(p.type).color}"></span>
      ${geText('fn-pin', 'name', p.name, `${extra} aria-label="Nazwa pinu"`)}
      ${geSelect('fn-pin', 'type', p.type, geVarTypes(ge.project).map((t) => [t, geTypeShort(t)]), `${extra} aria-label="Typ pinu ${geEsc(p.name)}"`)}
      <button type="button" class="ge-mini" data-ge="fn-pin-del" data-fn="${fn.id}" data-v="${side}" data-id="${p.id}" aria-label="Usuń pin ${geEsc(p.name)}" title="Usuń">✕</button>
    </div>`;
  }).join('') || `<p class="ge-hint">${side === 'inputs' ? 'Brak wejść — funkcja nie dostaje żadnych wartości.' : 'Brak wyjść — funkcja niczego nie zwraca.'}</p>`;
  const addBtn = (side, label) => `<button type="button" class="ge-mini ge-fn-pin-add" data-ge="fn-pin-add" data-id="${fn.id}" data-v="${side}">＋ ${label}</button>`;
  const params = fn.inputs.map((p) => p.name).join(', ');
  return `<div class="ge-det-node ge-k-exec"><span class="ge-det-kind">ƒ</span><div><b>${geEsc(fn.name)}</b><small>Funkcja · ${fn.inputs.length} wejść → ${fn.outputs.length} wyjść</small></div></div>
    <p class="ge-det-desc">Funkcja to kawałek grafu, którego używasz w wielu miejscach. Wywołasz ją węzłem <b>${geEsc(fn.name)}</b> (prawy przycisk › Funkcje albo przeciągnij ją z Mój Blueprint na graf). Wyniki oddaje węzeł <b>Return Node</b>.</p>
    ${geCat('Funkcja', geRow('Nazwa', geText('fn', 'name', fn.name, `data-id="${fn.id}"`), 'Nazwa w kodzie — bez spacji i polskich znaków (zamienią się same).'))}
    ${geCat('Wejścia (Inputs)', pinRows('inputs') + addBtn('inputs', 'Dodaj wejście'))}
    ${geCat('Wyjścia (Outputs)', pinRows('outputs') + addBtn('outputs', 'Dodaj wyjście'))}
    <p class="ge-hint">W kodzie: <code>this.${geEsc(geFnMethod(fn))}(${geEsc(params)})</code></p>
    <div class="ge-det-actions">
      ${geMode() === 'fn:' + fn.id ? '' : `<button type="button" data-ge="pick-fn" data-id="${fn.id}">Otwórz graf</button>`}
      <button type="button" class="ge-danger" data-ge="fn-del" data-id="${fn.id}">Usuń funkcję</button>
    </div>`;
}

// ---------- Event Dispatchery (Mój Blueprint › Event Dispatchers) ----------

function geAddDispatcher() {
  const bp = geCurBp();
  let id;
  geChange(() => {
    bp.dispatchers = bp.dispatchers ?? [];
    id = 'd' + bp.nextVar++;
    bp.dispatchers.push({ id, name: geUniqueName('NowyDispatcher', geChainEntries(ge.project, bp, 'dispatchers').map((e) => e.item.name)), inputs: [] });
    ge.bpPanel = { kind: 'disp', id };
    ge.nodeSel.clear();
  }, { bp: bp.id, only: ['mybp', 'details', 'graph'] });
  ge.root.querySelector('.ge-bp-details-body [data-scope="disp"]')?.select();
}

async function geDeleteDispatcher(id) {
  const bp = geCurBp();
  const disp = bp.dispatchers?.find((d) => d.id === id);
  if (!disp) return;
  const used = geRefUsers(bp, 'disp', id);
  if (used.length) {
    const ok = await geDialog({ title: 'Usunąć Event Dispatcher?', text: `Dispatcher <b>${geEsc(disp.name)}</b> jest używany w ${used.length} węzłach (także w innych klasach). Usunę go razem z nimi.`, buttons: [{ label: 'Usuń', value: true, primary: true }, { label: 'Anuluj', value: false }] });
    if (!ok) return;
  }
  geChange(() => {
    bp.dispatchers = bp.dispatchers.filter((d) => d !== disp);
    geRemoveNodes(used);
    ge.bpPanel = null;
  }, { bp: bp.id, only: ['mybp', 'details', 'graph', 'code'] });
}

// Nazwa i parametry (Inputs) dispatchera. Zmiana parametrów zmienia piny węzłów Call we wszystkich klasach.
function geUpdateDispatcher(bp, id, pinId, key, value) {
  const disp = bp.dispatchers?.find((d) => d.id === id);
  if (!disp) return;
  geChange(() => {
    const users = geRefUsers(bp, 'disp', id);
    if (key === 'name') {
      const name = String(value).trim();
      if (name) disp.name = geUniqueName(name, geChainEntries(ge.project, bp, 'dispatchers').filter((e) => e.item !== disp).map((e) => e.item.name));
    } else if (key === 'pin-add') {
      disp.inputs.push({ id: 'p' + bp.nextVar++, name: geUniqueName('Parametr', disp.inputs.map((p) => p.name)), type: 'float' });
    } else if (key === 'pin-del') {
      disp.inputs = disp.inputs.filter((p) => p.id !== pinId);
    } else {
      const pin = disp.inputs.find((p) => p.id === pinId);
      if (!pin) return;
      if (key === 'pin-name') pin.name = String(value).trim() || pin.name;
      else if (key === 'pin-type' && geIsVarType(value)) {
        pin.type = value;
        users.forEach(({ node }) => delete node.values?.[pin.id]);
      }
    }
    users.forEach(({ bp: b, graph }) => {
      geCleanLinks(b, graph);
      ge.dirty.add(b.id);
    });
  }, { bp: bp.id, only: key === 'pin-name' ? ['mybp', 'graph', 'code'] : ['mybp', 'details', 'graph', 'code'] });
}

function geDispDetailsHtml(bp, disp) {
  const types = geVarTypes(ge.project).map((t) => [t, geTypeShort(t)]);
  const rows = disp.inputs.map((p) => {
    const extra = `data-id="${disp.id}" data-p="${p.id}"`;
    return `<div class="ge-fn-pin">
      <span class="ge-pill" style="--pc:${geType(p.type).color}"></span>
      ${geText('disp-pin', 'pin-name', p.name, `${extra} aria-label="Nazwa parametru"`)}
      ${geSelect('disp-pin', 'pin-type', p.type, types, `${extra} aria-label="Typ parametru ${geEsc(p.name)}"`)}
      <button type="button" class="ge-mini" data-ge="disp-pin-del" ${extra} aria-label="Usuń parametr ${geEsc(p.name)}" title="Usuń">✕</button>
    </div>`;
  }).join('') || '<p class="ge-hint">Brak parametrów — dispatcher nie podaje zdarzeniom żadnych wartości.</p>';
  return `<div class="ge-det-node ge-k-event"><span class="ge-det-kind">✉</span><div><b>${geEsc(disp.name)}</b><small>Event Dispatcher · ${disp.inputs.length} param.</small></div></div>
    <p class="ge-det-desc">Event Dispatcher to „dzwonek”: inne Blueprinty podpinają do niego swoje zdarzenia węzłem <b>Bind Event to ${geEsc(disp.name)}</b>, a węzeł <b>Call ${geEsc(disp.name)}</b> uruchamia je wszystkie naraz. Przeciągnij dispatcher na graf, żeby wybrać węzeł. <b>Assign</b> od razu tworzy Bind i pasujące zdarzenie.</p>
    ${geCat('Event Dispatcher', geRow('Nazwa', geText('disp', 'name', disp.name, `data-id="${disp.id}"`)))}
    ${geCat('Parametry (Inputs)', rows + `<button type="button" class="ge-mini ge-fn-pin-add" data-ge="disp-pin-add" data-id="${disp.id}">＋ Dodaj parametr</button>`)}
    <p class="ge-hint">Podpinane zdarzenie musi mieć parametry tych samych typów (Szczegóły zdarzenia › Parametry).</p>
    <div class="ge-det-actions"><button type="button" class="ge-danger" data-ge="disp-del" data-id="${disp.id}">Usuń dispatcher</button></div>`;
}

// Węzły Event Dispatchera do wyboru po przeciągnięciu go na graf albo z menu (props: disp, opcjonalnie cls).
function geDispMenuItems(name, props, noEvents) {
  const node = (type) => ({ type, props: { ...props }, values: {} });
  return [
    { cat: 'Event Dispatchers', label: `Call ${name}`, ue: `Wywołaj wszystkie zdarzenia podpięte do ${name}`, node: node('dispatch_call') },
    { cat: 'Event Dispatchers', label: `Bind Event to ${name}`, ue: `Podepnij zdarzenie do ${name}`, node: node('dispatch_bind') },
    { cat: 'Event Dispatchers', label: `Unbind Event from ${name}`, ue: `Odepnij zdarzenie od ${name}`, node: node('dispatch_unbind') },
    { cat: 'Event Dispatchers', label: `Unbind all Events from ${name}`, ue: `Odepnij wszystkie zdarzenia od ${name}`, node: node('dispatch_unbind_all') },
    ...(noEvents ? [] : [{ cat: 'Event Dispatchers', label: `Assign ${name}`, ue: `Bind Event + nowe zdarzenie z parametrami ${name}`, node: node('dispatch_bind'), assign: true }])
  ];
}

// Assign (jak w Unreal Engine): obok węzła Bind powstaje zdarzenie własne z parametrami dispatchera, już podpięte.
function geAssignDispatcher(bp, graph, bind) {
  const disp = geDispOf(bind, bp);
  if (!disp) return;
  const taken = bp.graph.nodes.filter((n) => n.type === 'ev_custom').map((n) => n.props?.name);
  const ev = {
    id: 'n' + bp.nextNode++, type: 'ev_custom', x: bind.x + 320, y: bind.y + 96, values: {},
    props: { name: geUniqueName(GE_RT.ident(disp.name) + '_Event', taken), inputs: disp.inputs.map((p, i) => ({ id: String(i + 1), name: p.name, type: p.type })) }
  };
  graph.nodes.push(ev);
  geLink(graph, { node: ev.id, pin: 'delegate', type: 'delegate' }, { node: bind.id, pin: 'event', type: 'delegate' });
}

// ---------- Komponenty i Viewport klasy aktora ----------

const geSelComp = (bp) => (ge.bpPanel?.kind === 'comp' ? bp?.components?.find((c) => c.id === ge.bpPanel.id) ?? null : null);
// Komponenty do wyboru w węźle (także odziedziczone): [{ item, owner, ref }].
const geCompChoices = (bp, prop) => (geHasViewport(bp) ? geChainEntries(ge.project, bp, 'components') : []).filter((e) => !prop?.of || prop.of.includes(geCompKind(e.item)));
const geCompIcon = (c) => (c.type === 'emoji' ? c.emoji || '🙂' : GE_COMP_TYPES[c.type]?.icon ?? '?');

// Panel Komponenty: aktor (Self), jego wygląd (DefaultSceneRoot), doczepione kształty i kolizje, a pod kreską ruch.
function geRenderComponents() {
  const body = ge.root.querySelector('.ge-comps-body');
  const bp = geCurBp();
  if (!body || !geHasViewport(bp)) return;
  const sel = ge.bpPanel?.kind === 'comp' ? ge.bpPanel.id : null;
  const row = (c) => {
    const def = GE_COMP_TYPES[c.type];
    const color = c.color ?? (def.kind === 'collision' ? (c.collision === 'block' ? '#4aa3ff' : '#ff9f1a') : '#cfcfcf');
    return `<div class="ge-row ge-comp-row${sel === c.id ? ' is-selected' : ''}" style="--d:${def.kind === 'movement' ? 0 : 1}" role="treeitem" aria-selected="${sel === c.id}" data-ge="pick-comp" data-id="${c.id}" tabindex="0" title="${geEsc(`${def.label} (${def.ue})`)}">
      <span class="ge-row-name"><span class="ge-row-ic" style="color:${geEsc(color)}">${geEsc(geCompIcon(c))}</span>${geEsc(c.name)}</span>
      <span class="ge-row-type">${geEsc(def.ue)}</span></div>`;
  };
  const d = geResolveDefaults(ge.project, bp);
  const moves = bp.components.filter((c) => geCompKind(c) === 'movement');
  const inherited = geChainEntries(ge.project, bp, 'components').filter((e) => e.owner !== bp);
  const inheritedRow = (e) => `<div class="ge-row ge-comp-row is-inherited${ge.bpPanel?.kind === 'icomp' && ge.bpPanel.id === e.ref ? ' is-selected' : ''}" style="--d:1" role="treeitem" data-ge="pick-icomp" data-id="${geEsc(e.ref)}" tabindex="0" title="Odziedziczony z ${geEsc(e.owner.name)} — zmienisz go w tamtej klasie">
      <span class="ge-row-name"><span class="ge-row-ic">${geEsc(geCompIcon(e.item))}</span>${geEsc(e.item.name)}</span><span class="ge-row-type">${geEsc(e.owner.name)}</span></div>`;
  body.innerHTML = `
    <div class="ge-row ge-comp-row is-self"><span class="ge-row-name">📘 ${geEsc(bp.name)} (Self)</span></div>
    <div class="ge-row ge-comp-row${ge.bpPanel ? '' : ' is-selected'}" style="--d:0" role="treeitem" aria-selected="${!ge.bpPanel}" data-ge="pick-comp" data-id="" tabindex="0" title="Wygląd i kolizja samego aktora (Ustawienia klasy)">
      <span class="ge-row-name"><span class="ge-row-ic" style="color:${geEsc(d.color)}">${geEsc(geShapeIcon(bp))}</span>DefaultSceneRoot</span><span class="ge-row-type">Wygląd aktora</span></div>
    ${inherited.map(inheritedRow).join('')}
    ${bp.components.filter((c) => geCompKind(c) !== 'movement').map(row).join('')}
    ${moves.length ? `<div class="ge-comps-sep" role="separator"></div>${moves.map(row).join('')}` : ''}
    ${bp.components.length ? '' : '<p class="ge-mb-tip">Kliknij „＋ Dodaj”, żeby doczepić do aktora kształt, kolizję albo ruch.</p>'}`;
}

// Zaznacza komponent (null — wygląd samego aktora, czyli Ustawienia klasy).
function geSelectComp(id) {
  const next = id ? { kind: 'comp', id } : null;
  if (ge.bpPanel?.kind === next?.kind && ge.bpPanel?.id === next?.id) return;
  ge.bpPanel = next;
  ge.nodeSel.clear();
  geUpdateNodeSelection();
  geRenderComponents();
  geRenderMyBp();
  geRenderBpDetails();
  geDrawBpViewport();
}

// Menu „＋ Dodaj komponent”; at — miejsce w Viewporcie, gdzie ma się pojawić.
function geCompAddMenu(at = null) {
  return ['Podstawowe kształty', 'Kolizja', 'Ruch'].flatMap((cat) => [
    { heading: cat },
    ...Object.entries(GE_COMP_TYPES).filter(([, d]) => d.cat === cat)
      .map(([type, d]) => ({ label: `${d.icon} ${d.label}`, key: d.ue, action: () => geAddComponent(type, at) }))
  ]);
}

function geAddComponent(type, at = null) {
  const bp = geCurBp();
  if (!geHasViewport(bp)) return;
  const def = GE_COMP_TYPES[type];
  geChange(() => {
    const c = { id: 'c' + bp.nextComp++, type, name: geUniqueName(def.base, geCompNamesTaken(bp)), ...JSON.parse(JSON.stringify(def.defaults)) };
    if (at && def.kind !== 'movement') Object.assign(c, at);
    bp.components.push(c);
    ge.bpPanel = { kind: 'comp', id: c.id };
    ge.nodeSel.clear();
    if (c.image) gePreloadImages();
  }, { bp: bp.id, only: ['components', 'details', 'graph', 'mybp', 'code'] });
  if (def.kind !== 'movement') geSetBpMode('viewport');
}

function geCopyComponent(bp, c) {
  const base = c.name.replace(/\d+$/, '') || c.name;
  const copy = { ...JSON.parse(JSON.stringify(c)), id: 'c' + bp.nextComp++, name: geUniqueName(base, geCompNamesTaken(bp)) };
  bp.components.splice(bp.components.indexOf(c) + 1, 0, copy);
  return copy;
}

function geDuplicateComponent(id) {
  const bp = geCurBp();
  const c = bp?.components?.find((x) => x.id === id);
  if (!c) return;
  geChange(() => {
    const copy = geCopyComponent(bp, c);
    if (geCompKind(c) !== 'movement') copy.x += ge.project.settings.grid;
    ge.bpPanel = { kind: 'comp', id: copy.id };
  }, { bp: bp.id, only: ['components', 'details', 'code'] });
}

async function geDeleteComponent(id) {
  const bp = geCurBp();
  const c = bp?.components?.find((x) => x.id === id);
  if (!c) return;
  const used = geRefUsers(bp, 'comp', id);
  if (used.length) {
    const ok = await geDialog({ title: 'Usunąć komponent?', text: `Komponent <b>${geEsc(c.name)}</b> jest używany w ${used.length} węzłach (także w klasach podrzędnych). Usunę go razem z nimi (Ctrl+Z cofa).`, buttons: [{ label: 'Usuń', value: true, primary: true }, { label: 'Anuluj', value: false }] });
    if (!ok) return;
  }
  geChange(() => {
    const gone = new Set(used.filter((u) => u.bp === bp).map((u) => u.node.id));
    bp.components = bp.components.filter((x) => x !== c);
    geRemoveNodes(used);
    gone.forEach((nid) => ge.nodeSel.delete(nid));
    if (ge.bpPanel?.id === id || gone.has(ge.bpPanel?.id)) ge.bpPanel = null;
  }, { bp: bp.id, only: ['components', 'details', 'graph', 'mybp', 'code'] });
}

async function geRenameComponent(id) {
  const c = geCurBp()?.components?.find((x) => x.id === id);
  if (!c) return;
  const name = await geDialog({ title: 'Zmień nazwę komponentu', text: 'Bez spacji i polskich znaków — pod tą nazwą komponent jest w kodzie.', input: c.name, buttons: [{ label: 'Zmień', value: true, primary: true }, { label: 'Anuluj', value: null }] });
  if (name?.trim()) geUpdateComponent(id, 'name', name);
}

// Zmiana pola komponentu z panelu Szczegóły (name — z poprawieniem na identyfikator, d — średnica koła).
function geUpdateComponent(id, key, value) {
  const bp = geCurBp();
  const c = bp?.components?.find((x) => x.id === id);
  if (!c) return;
  if (key === 'name') {
    const name = geUniqueName(GE_RT.ident(value), geCompNamesTaken(bp, c));
    if (name === c.name) {
      geRenderBpDetails();
      return;
    }
    geChange(() => { c.name = name; }, { bp: bp.id, only: ['components', 'details', 'graph', 'mybp', 'code'] });
    return;
  }
  geChange(() => {
    if (key === 'd') {
      c.w = Math.max(1, value);
      c.h = c.w;
    } else if (key === 'w' || key === 'h') c[key] = Math.max(1, value);
    else c[key] = value;
  }, { bp: bp.id, only: key === 'emoji' ? ['components', 'details', 'code'] : ['components', 'bpview', 'code'] });
}

function geCompMenu(id) {
  return [
    { label: '🔍 Pokaż w Viewporcie', key: 'F', action: () => {
      geSetBpMode('viewport');
      geFocusComponent(id);
    } },
    '-',
    { label: 'Zmień nazwę…', action: () => geRenameComponent(id) },
    { label: 'Duplikuj', key: 'Ctrl+D', action: () => geDuplicateComponent(id) },
    { label: 'Usuń', key: 'Delete', action: () => geDeleteComponent(id) }
  ];
}

// Zdarzenia, na które nasłuchuje komponent albo przycisk widgetu — sekcja „Zdarzenia” w Szczegółach, jak w UE:
// ＋ dodaje węzeł zdarzenia do Event Graph, a gdy już jest — przycisk pokazuje go w grafie.
const GE_COMP_EVENTS = [['ev_comp_overlap', 'On Component Begin Overlap'], ['ev_comp_end_overlap', 'On Component End Overlap']];
const geCompEvents = (c) => (geCompKind(c) === 'movement' ? [] : GE_COMP_EVENTS);
const geBoundEventOf = (bp, type, key, ref) => bp.graph.nodes.find((n) => n.type === type && String(n.props?.[key] ?? '') === String(ref)) ?? null;

function geEventsCat(bp, events, key, ref) {
  if (!events.length) return '';
  const rows = events.map(([type, label]) => {
    const bound = geBoundEventOf(bp, type, key, ref);
    return geRow(label, `<button type="button" data-ge="bind-event" data-v="${type}" data-prop="${key}" data-id="${geEsc(ref)}" title="${bound ? 'Pokaż węzeł zdarzenia w Event Graph' : 'Dodaj węzeł zdarzenia do Event Graph'}">${bound ? '→ Pokaż' : '＋'}</button>`, GE_NODES[type].desc);
  });
  return geCat('Zdarzenia', rows.join(''));
}

function geBindEvent(type, key, ref) {
  const bp = geCurBp();
  const bound = geBoundEventOf(bp, type, key, ref);
  geSetBpMode('graph');
  if (bound) {
    geFocusNode(bound.id);
    return;
  }
  const y = bp.graph.nodes.reduce((max, n) => Math.max(max, n.y + 176), 64);
  geFocusNode(geAddNode(type, 64, y, { [key]: ref }));
}

function geCompDetailsHtml(bp, c) {
  const def = GE_COMP_TYPES[c.type];
  const ex = `data-id="${c.id}"`;
  const parts = [];
  if (def.kind !== 'movement') {
    const size = c.type === 'circle_collision'
      ? geRow('Średnica', geNum('comp', 'd', c.w, 'float', ex))
      : geRow('Rozmiar', geVec2('comp', 'w', 'h', c.w, c.h, ex), 'Szerokość (X) i wysokość (Y) w pikselach.');
    parts.push(geCat('Transformacja (względem aktora)', geRow('Lokalizacja', geVec2('comp', 'x', 'y', c.x, c.y, ex)) + geRow('Obrót (°)', geNum('comp', 'rotation', c.rotation, 'float', ex)) + size));
  }
  if (def.kind === 'shape') {
    const look = (['box', 'circle', 'triangle', 'text'].includes(c.type) ? geRow('Kolor', geColorIn('comp', 'color', c.color, ex)) : '')
      + (c.type === 'emoji' ? geRow('Emoji', geText('comp', 'emoji', c.emoji, ex)) + `<div class="ge-emoji-grid">${GE_EMOJI.map((em) => `<button type="button" data-ge="emoji" data-comp="${c.id}" data-v="${em}" aria-label="Emoji ${em}">${em}</button>`).join('')}</div>` : '')
      + (c.type === 'text' ? geRow('Tekst', geText('comp', 'text', c.text, ex)) : '')
      + (c.type === 'image' ? geRow('Obrazek', `<button type="button" data-ge="pick-image" data-comp="${c.id}">${c.image ? 'Zmień obrazek…' : 'Wybierz obrazek…'}</button>`)
        + geRow('Kafelkowanie', geCheck('comp', 'tile', !!c.tile, ex), 'Obrazek powtarza się jak płytki w swoim prawdziwym rozmiarze, zamiast się rozciągać — do podłogi, asfaltu albo trawy na dużym aktorze.') : '')
      + (c.type === 'sprite' ? geRow('Sprite / animacja', geSelect('comp', 'sprite', c.sprite ?? '', [['', '— wybierz —'], ...ge.project.blueprints.filter((b) => ['sprite', 'animation'].includes(geKind(b))).map((b) => [b.id, `${GE_KINDS[geKind(b)].icon} ${b.name}`])], ex), 'Sprite albo Animacja (Flipbook) z Przeglądarki zawartości. W grze zmienisz ją węzłem „Set Flipbook”.') : '')
      + (c.type !== 'emoji' ? geRow('Materiał', geSelect('comp', 'material', c.material ?? '', [['', '— brak —'], ...geOfKind('material').map((m) => [m.id, m.name])], ex), 'Kolor, krycie i poświata z Materiału — zastępują kolor komponentu.') : '')
      + geRow('Widoczny', geCheck('comp', 'visible', c.visible !== false, ex))
      + geRow('Kolejność rysowania', geNum('comp', 'z', c.z, 'int', ex), 'Ujemna — pod wyglądem aktora, dodatnia — nad nim. Wyższa liczba jest na wierzchu.');
    parts.push(geCat('Wygląd', look));
  }
  if (def.kind === 'shape' || def.kind === 'collision') {
    const options = def.kind === 'shape' ? GE_COLLISIONS : GE_COLLISIONS.filter(([v]) => v !== 'none');
    parts.push(geCat('Kolizja', geRow('Kolizja', geSelect('comp', 'collision', c.collision, options, ex))
      + geRow('Kolizja włączona', geCheck('comp', 'collisionEnabled', c.collisionEnabled !== false, ex), 'Węzeł „Set Collision Enabled” zmienia to w trakcie gry.')
      + `<p class="ge-hint">${def.kind === 'collision' ? 'W grze niewidoczna — w edytorze ma przerywany obrys. ' : ''}Nakłada się — włącza „On Component Begin Overlap” i „Event ActorBeginOverlap”. Blokuje — działa jak ściana doczepiona do aktora.</p>`));
  }
  if (c.type === 'rotating') {
    parts.push(geCat('Obracanie (Rotating Movement)', geRow('Prędkość obrotu (°/s)', geNum('comp', 'rate', c.rate, 'float', ex), 'Ujemna — w przeciwną stronę.')
      + geRow('Aktywny', geCheck('comp', 'active', c.active !== false, ex))));
  }
  if (c.type === 'projectile') {
    parts.push(geCat('Pocisk (Projectile Movement)', geRow('Prędkość początkowa', geVec2('comp', 'vx', 'vy', c.vx, c.vy, ex), 'Piksele na sekundę. Aktor dostaje tę prędkość, gdy powstaje (przed BeginPlay). Z Grawitacją leci łukiem.')
      + geRow('Aktywny', geCheck('comp', 'active', c.active !== false, ex))));
  }
  parts.push(geEventsCat(bp, geCompEvents(c), 'comp', c.id));
  return `<div class="ge-det-top">
      <span class="ge-det-ic" style="color:${geEsc(c.color ?? '#cfcfcf')}">${geEsc(geCompIcon(c))}</span>
      <input class="ge-det-name" type="text" value="${geEsc(c.name)}" ${geAttrs('comp', 'name', ex)} aria-label="Nazwa komponentu" />
    </div>
    <div class="ge-det-class"><span>Komponent: <b>${geEsc(def.label)}</b> (${geEsc(def.ue)})</span></div>
    ${parts.join('')}
    <p class="ge-hint">W kodzie: <code>this.comp("${geEsc(c.name)}")</code></p>
    <div class="ge-det-actions"><button type="button" data-ge="dup-comp" data-id="${c.id}">Duplikuj</button><button type="button" class="ge-danger" data-ge="del-comp" data-id="${c.id}">Usuń komponent</button></div>`;
}

// Wygląd aktora w Viewporcie: w środku świata, po Construction Script z domyślnymi wartościami zmiennych.
function geBpLook(bp) {
  return gePreviewLooks([{ id: 'preview', name: bp.name, bp: bp.id, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, vars: {} }])[0];
}

const geBpToScreen = (x, y) => {
  const v = ge.bpViews[ge.tab];
  return { x: (x - v.x) * v.zoom, y: (y - v.y) * v.zoom };
};

function geBpvpPoint(event) {
  const r = ge.root.querySelector('.ge-bpvp').getBoundingClientRect();
  const v = ge.bpViews[ge.tab];
  const sx = event.clientX - r.left;
  const sy = event.clientY - r.top;
  return { sx, sy, wx: v.x + sx / v.zoom, wy: v.y + sy / v.zoom };
}

function geDrawBpViewport() {
  if (!ge || ge.tab === 'level' || geMode() !== 'viewport') return;
  const vp = ge.root.querySelector('.ge-bpvp');
  const canvas = vp?.querySelector('.ge-vp-canvas');
  const bp = geCurBp();
  if (!canvas || !bp) return;
  const w = vp.clientWidth;
  const h = vp.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const s = ge.project.settings;
  const look = geBpLook(bp);
  if (!ge.bpViews[ge.tab]) {
    const b = geLookBounds(look);
    const zoom = Math.min(2, Math.max(0.25, Math.min(w / (Math.max(b.r - b.l, 32) * 2.4), h / (Math.max(b.b - b.t, 32) * 2.4))));
    ge.bpViews[ge.tab] = { zoom, x: -w / 2 / zoom, y: -h / 2 / zoom };
  }
  const v = ge.bpViews[ge.tab];
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = s.background;
  ctx.fillRect(0, 0, w, h);
  geDrawGrid(ctx, v, w, h, s.grid);
  ctx.save();
  ctx.translate(-v.x * v.zoom, -v.y * v.zoom);
  ctx.scale(v.zoom, v.zoom);
  geDrawLook(ctx, look, v.zoom);
  const sel = geSelComp(bp);
  const movable = sel && geCompKind(sel) !== 'movement';
  if (movable) geOutline(ctx, sel, v.zoom, '#ffa31a');
  else if (!ge.bpPanel) geOutline(ctx, { type: look.shape === 'circle' ? 'circle' : 'box', x: 0, y: 0, w: look.w, h: look.h }, v.zoom, '#ffa31a');
  ctx.restore();
  if (movable) geDrawGizmo(ctx, geBpToScreen(sel.x, sel.y));
  const chip = vp.querySelector('.ge-vp-zoom');
  if (chip) chip.textContent = `${Math.round(v.zoom * 100)}%`;
}

// Komponent pod kursorem: najpierw kształty (od wierzchu), potem kolizje.
function geCompAt(bp, wx, wy) {
  const min = 6 / (ge.bpViews[ge.tab]?.zoom ?? 1);
  const hit = (c) => {
    const p = geToLocal(wx, wy, c.x, c.y, c.rotation);
    return Math.abs(p.x) <= Math.max(Math.abs(c.w) / 2, min) && Math.abs(p.y) <= Math.max(Math.abs(c.h) / 2, min);
  };
  const shapes = bp.components.map((c, i) => [c, i]).filter(([c]) => geCompKind(c) === 'shape')
    .sort(([a, i], [b, j]) => (Number(b.z) || 0) - (Number(a.z) || 0) || j - i).map(([c]) => c);
  const colliders = bp.components.filter((c) => geCompKind(c) === 'collision').reverse();
  return shapes.find(hit) || colliders.find(hit) || null;
}

function geFocusComponent(id) {
  const vp = ge.root.querySelector('.ge-bpvp');
  const v = ge.bpViews[ge.tab];
  const c = geCurBp()?.components?.find((x) => x.id === id);
  if (!vp || !v || !c || geCompKind(c) === 'movement') return;
  v.x = c.x - vp.clientWidth / 2 / v.zoom;
  v.y = c.y - vp.clientHeight / 2 / v.zoom;
  geSelectComp(id);
  geDrawBpViewport();
}

function geBpvpDown(event) {
  const vp = event.currentTarget;
  const v = ge.bpViews[ge.tab];
  if (!v || event.target.closest('.ge-vp-bar')) return;
  vp.focus({ preventScroll: true });
  const bp = geCurBp();
  const p = geBpvpPoint(event);
  const pan = () => {
    ge.drag = { mode: 'pan', cx: event.clientX, cy: event.clientY, vx: v.x, vy: v.y, moved: false, button: event.button };
    vp.setPointerCapture(event.pointerId);
  };
  if (event.button === 1 || event.button === 2) {
    pan();
    return;
  }
  if (event.button !== 0) return;
  const sel = geSelComp(bp);
  const axis = sel && geCompKind(sel) !== 'movement' ? geGizmoHit(geBpToScreen(sel.x, sel.y), p.sx, p.sy) : null;
  const comp = axis ? sel : geCompAt(bp, p.wx, p.wy);
  geSelectComp(comp?.id ?? null);
  if (!comp) {
    pan();
    return;
  }
  ge.drag = { mode: 'comp', axis: axis || 'xy', id: comp.id, wx: p.wx, wy: p.wy, ox: comp.x, oy: comp.y, moved: false, alt: event.altKey };
  vp.setPointerCapture(event.pointerId);
}

function geBpvpMove(event) {
  const d = ge.drag;
  const v = ge.bpViews[ge.tab];
  if (!d || !v) return;
  if (d.mode === 'pan') {
    const dx = event.clientX - d.cx;
    const dy = event.clientY - d.cy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    v.x = d.vx - dx / v.zoom;
    v.y = d.vy - dy / v.zoom;
    geDrawBpViewport();
    return;
  }
  if (d.mode !== 'comp') return;
  const bp = geCurBp();
  const p = geBpvpPoint(event);
  if (!d.moved) {
    if (Math.hypot(p.wx - d.wx, p.wy - d.wy) * v.zoom < 3) return;
    d.moved = true;
    geSnapshot();
    if (d.alt) {
      const copy = geCopyComponent(bp, bp.components.find((c) => c.id === d.id));
      d.id = copy.id;
      ge.bpPanel = { kind: 'comp', id: copy.id };
      geRenderComponents();
      geRenderBpDetails();
    }
  }
  const c = bp.components.find((x) => x.id === d.id);
  if (!c) return;
  // Komponenty przyciągają się do pół kratki siatki, Shift — bez przyciągania.
  const grid = Math.max(1, ge.project.settings.grid / 2);
  let nx = d.ox + (p.wx - d.wx);
  let ny = d.oy + (p.wy - d.wy);
  if (!event.shiftKey) {
    nx = geSnap(nx, grid);
    ny = geSnap(ny, grid);
  }
  if (d.axis === 'x') ny = d.oy;
  if (d.axis === 'y') nx = d.ox;
  c.x = nx;
  c.y = ny;
  geDrawBpViewport();
  ge.root.querySelectorAll(`[data-scope="comp"][data-id="${c.id}"]`).forEach((input) => {
    if (input.dataset.k === 'x' || input.dataset.k === 'y') input.value = c[input.dataset.k];
  });
}

function geBpvpUp(event) {
  const d = ge.drag;
  ge.drag = null;
  if (!d) return;
  const vp = event.currentTarget;
  if (vp.hasPointerCapture?.(event.pointerId)) vp.releasePointerCapture(event.pointerId);
  if (d.mode === 'pan' && d.button === 2 && !d.moved) {
    const p = geBpvpPoint(event);
    const comp = geCompAt(geCurBp(), p.wx, p.wy);
    const grid = Math.max(1, ge.project.settings.grid / 2);
    if (comp) {
      geSelectComp(comp.id);
      geMenu({ x: event.clientX, y: event.clientY }, geCompMenu(comp.id));
    } else geMenu({ x: event.clientX, y: event.clientY }, geCompAddMenu({ x: geSnap(p.wx, grid), y: geSnap(p.wy, grid) }));
  }
  if (d.mode === 'comp' && d.moved) {
    ge.dirty.add(geCurBp().id);
    geScheduleSave();
    geRefreshCode();
  }
}

function geBpvpWheel(event) {
  const v = ge.bpViews[ge.tab];
  if (!v) return;
  event.preventDefault();
  const p = geBpvpPoint(event);
  const zoom = Math.min(8, Math.max(0.1, v.zoom * Math.pow(1.0015, -event.deltaY)));
  v.x = p.wx - p.sx / zoom;
  v.y = p.wy - p.sy / zoom;
  v.zoom = zoom;
  geDrawBpViewport();
}

// ---------- Dziedziczenie klas ----------

// Szczegóły odziedziczonej zmiennej albo komponentu — zmienia się je w klasie, która je ma.
function geInheritedHtml(label, entry, text) {
  return `<p class="ge-det-note">${label} <b>${geEsc(entry.item.name)}</b> pochodzi z klasy nadrzędnej <b>${geEsc(entry.owner.name)}</b>. ${geEsc(text)}</p>
    <div class="ge-det-actions"><button type="button" data-ge="open-bp" data-id="${entry.owner.id}">✎ Otwórz ${geEsc(entry.owner.name)}</button></div>`;
}

// Klasy, które mogą być rodzicem bp: inne klasy aktorów, ale nie jej potomkowie (powstałaby pętla),
// i klasy TypeScript z @UCLASS(Blueprintable), jak klasy C++ w Unreal Engine.
const geParentChoices = (bp) => [
  ...geOfKind('actor').filter((c) => c !== bp && !(bp && geAncestors(ge.project, c).includes(bp))),
  ...geOfKind('tsclass').filter((c) => !geTsParentProblem(ge.project, c))
];
const geParentIcon = (c) => (geKind(c) === 'tsclass' ? '🔷' : '📘');

function geParentMenu(anchor) {
  const bp = geCurBp();
  const parent = geParentOf(ge.project, bp) ?? geAsset(ge.project, bp.parent, 'tsclass');
  const choices = geParentChoices(bp);
  // Klasa TypeScript, która przestała się nadawać (np. błąd kompilacji), zostaje na liście z zaznaczeniem.
  if (parent && !choices.includes(parent)) choices.push(parent);
  // Odstęp z niełamliwych spacji (zwykłe HTML by zwinął), żeby nazwy stały równo pod zaznaczoną.
  const mark = (on) => (on ? '✓ ' : '   ');
  geMenu(anchor, [
    { heading: 'Klasa nadrzędna' },
    { label: `${mark(!parent)}Actor (bez klasy nadrzędnej)`, action: () => geSetParent(bp, null) },
    ...choices.map((c) => ({ label: `${mark(c === parent)}${geParentIcon(c)} ${c.name}`, action: () => geSetParent(bp, c.id) })),
    ...(parent ? ['-', { label: `✎ Otwórz ${parent.name}`, action: () => geDataOpened(parent.id) || geOpenTab(parent.id) }] : [])
  ]);
}

// Węzły (w klasie i jej potomkach), które wskazują zmienną albo komponent (prop: var / comp) klasy owner.
function geRefUsers(owner, prop, id) {
  const users = [];
  const chain = [owner, ...geDescendants(ge.project, owner)];
  const refOf = (b) => (b === owner ? id : `${owner.id}:${id}`);
  chain.forEach((b) => {
    geGraphs(b).forEach((g) => g.nodes.forEach((node) => {
      // Węzeł zmiennej (albo Event Dispatchera) z props.cls wskazuje element innej klasy (pin Target).
      const crossClass = ['var', 'disp', 'fn'].includes(prop) && node.props?.cls;
      if (node.props?.[prop] === refOf(b) && !crossClass) users.push({ bp: b, graph: g, node });
    }));
  });
  if (prop === 'var' || prop === 'disp' || prop === 'fn') {
    const others = [...geAllBlueprints(ge.project), ...geLevels(ge.project).filter((l) => l.id !== ge.project.levelId && l.level).map((l) => l.level)];
    others.forEach((b) => geGraphs(b).forEach((g) => (g?.nodes ?? []).forEach((node) => {
      const cls = chain.find((c) => c.id === node.props?.cls);
      if (cls && node.props[prop] === refOf(cls)) users.push({ bp: b, graph: g, node });
    })));
  }
  return users;
}

function geRemoveNodes(users) {
  users.forEach(({ bp, graph, node }) => {
    graph.nodes = graph.nodes.filter((n) => n !== node);
    graph.links = graph.links.filter((l) => l.from[0] !== node.id && l.to[0] !== node.id);
    ge.dirty.add(bp.id);
  });
}

// Węzły klasy i jej potomków, które straciłyby odwołanie po zmianie rodzica na newParent.
function geBrokenByReparent(bp, newParent) {
  const ok = (b, n) => (n.props?.var === undefined || !!geChainEntry(ge.project, b, 'variables', n.props.var))
    && (n.props?.comp === undefined || !!geChainEntry(ge.project, b, 'components', n.props.comp))
    && (n.props?.disp === undefined || !!n.props.cls || !!geChainEntry(ge.project, b, 'dispatchers', n.props.disp))
    && (n.type !== 'call_fn' || !!n.props?.cls || !!geChainEntry(ge.project, b, 'funcs', n.props?.fn))
    && (n.type !== 'call_parent' || !!(geParentOf(ge.project, b) || geTsParentOf(ge.project, b)))
    && (!['ev_ts', 'ts_call', 'ts_pure', 'ts_prop_get', 'ts_prop_set'].includes(n.type) || !GE_NODES[n.type].check(n, b, ge.project));
  const nodes = [bp, ...geDescendants(ge.project, bp)].flatMap((b) => geGraphs(b).flatMap((g) => g.nodes.map((n) => [b, n])));
  const before = nodes.filter(([b, n]) => ok(b, n));
  // Na chwilę ustawiamy nowego rodzica, żeby sprawdzić, które odwołania przestaną działać.
  const old = bp.parent;
  bp.parent = newParent?.id;
  const broken = before.filter(([b, n]) => !ok(b, n));
  if (old) bp.parent = old;
  else delete bp.parent;
  return broken;
}

async function geSetParent(bp, parentId) {
  const parent = parentId ? geBp(parentId) : null;
  if ((bp.parent ?? null) === (parentId ?? null)) return;
  const broken = geBrokenByReparent(bp, parent);
  if (broken.length) {
    const ok = await geDialog({ title: 'Zmienić klasę nadrzędną?', text: `${broken.length} węzłów korzysta ze zmiennych, komponentów albo zdarzeń obecnej klasy nadrzędnej — po zmianie pokażą błąd do poprawienia (Ctrl+Z cofa).`, buttons: [{ label: 'Zmień', value: true, primary: true }, { label: 'Anuluj', value: false }] });
    if (!ok) return;
  }
  geChange(() => {
    if (parent) bp.parent = parent.id;
    else delete bp.parent;
    // Komponenty szuka się po nazwie (this.comp("Nazwa")), więc własne nie mogą powtarzać nazw przodków.
    bp.components.forEach((c) => {
      c.name = geUniqueName(c.name, geCompNamesTaken(bp, c));
    });
    ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
  }, { only: [] });
  geRender();
  if (parent && geKind(parent) === 'tsclass') geLog(`${bp.name} dziedziczy teraz po klasie TypeScript ${parent.ts.api?.className ?? parent.name}: widzi jej pola z @UPROPERTY i metody z @UFUNCTION (prawy przycisk na grafie), a „Call Parent Event” uruchamia jej wersję zdarzenia.`);
  else geLog(parent ? `${bp.name} dziedziczy teraz po ${parent.name}: ma jego zdarzenia, zmienne i komponenty. Węzeł „Call Parent Event” uruchamia wersję zdarzenia z ${parent.name}.` : `${bp.name} nie ma już klasy nadrzędnej (dziedziczy po Actor).`);
}

// Nazwy komponentów zajęte dla bp: jej przodków, jej własne i jej potomków (bez komponentu except).
function geCompNamesTaken(bp, except = null) {
  return [...geAncestors(ge.project, bp), bp, ...geDescendants(ge.project, bp)].flatMap((b) => (b.components ?? []).filter((c) => c !== except).map((c) => c.name));
}

// Nazwy zmiennych zajęte dla bp — w this.vars są też zmienne przodków i potomków (bez zmiennej except).
function geVarNamesTaken(bp, except = null) {
  const family = bp.id === 'level' ? [bp] : [...geAncestors(ge.project, bp), bp, ...geDescendants(ge.project, bp)];
  return family.flatMap((b) => b.variables.filter((v) => v !== except).map((v) => v.name));
}

// ---------- Szczegóły w edytorze Blueprintów ----------

function geRenderBpDetails() {
  const body = ge.root.querySelector('.ge-bp-details-body');
  const bp = geCurBp();
  if (!body || !bp) return;
  const panel = ge.bpPanel;
  // Stan, przejście albo Jump Node zaznaczone w Anim Graph (game-paperzd.js).
  if (panel?.kind?.startsWith('zd-')) {
    const html = geMode() === 'animgraph' && geZdDetailsHtml(bp, panel);
    if (html) {
      body.innerHTML = html;
      return;
    }
  }
  if (panel?.kind === 'node') {
    const n = geNodeById(panel.id);
    if (n) {
      body.innerHTML = geNodeDetailsHtml(n, bp);
      return;
    }
  }
  if (panel?.kind === 'var') {
    const v = bp.variables.find((item) => item.id === panel.id);
    if (v) {
      body.innerHTML = geVarDetailsHtml(bp, v);
      return;
    }
  }
  if (panel?.kind === 'disp') {
    const entry = geChainEntry(ge.project, bp, 'dispatchers', panel.id);
    if (entry) {
      body.innerHTML = entry.owner === bp ? geDispDetailsHtml(bp, entry.item)
        : geInheritedHtml('Event Dispatcher', entry, 'Przeciągnij go na graf, żeby dostać węzeł Call, Bind, Unbind albo Assign.');
      return;
    }
  }
  // Funkcja: wybrana w Mój Blueprint albo ta, której graf jest otwarty (gdy nic nie zaznaczono).
  const fn = panel?.kind === 'fn' ? bp.funcs?.find((f) => f.id === panel.id) : !panel ? geCurFn() : null;
  if (fn) {
    body.innerHTML = geFnDetailsHtml(bp, fn);
    return;
  }
  if (panel?.kind === 'ivar') {
    const entry = geChainEntry(ge.project, bp, 'variables', panel.id);
    if (entry) {
      body.innerHTML = geInheritedHtml('Zmienna', entry, `${geType(entry.item.type).label}. Przeciągnij ją na graf, żeby dostać węzeł Get albo Set.`);
      return;
    }
  }
  if (panel?.kind === 'icomp') {
    const entry = geChainEntry(ge.project, bp, 'components', panel.id);
    if (entry) {
      body.innerHTML = geInheritedHtml('Komponent', entry, `${GE_COMP_TYPES[entry.item.type].label} (${GE_COMP_TYPES[entry.item.type].ue}). Węzły komponentów tej klasy mogą go zmieniać w grze.`)
        + geEventsCat(bp, geCompEvents(entry.item), 'comp', entry.ref);
      return;
    }
  }
  if (panel?.kind === 'comp') {
    const c = bp.components?.find((item) => item.id === panel.id);
    if (c) {
      body.innerHTML = geCompDetailsHtml(bp, c);
      return;
    }
  }
  if (bp.id === 'level') {
    body.innerHTML = '<p class="ge-det-note"><b>Level Blueprint</b> to logika całego poziomu: start gry, napisy, zasady. Nie ma wyglądu ani kolizji. Zaznacz węzeł albo zmienną, żeby zobaczyć ich szczegóły.</p>';
    return;
  }
  if (geKind(bp) === 'widget') {
    body.innerHTML = geWidgetDetailsHtml(bp);
    return;
  }
  if (geIsAnimBp(bp)) {
    body.innerHTML = geZdAbpDefaultsHtml(bp);
    return;
  }
  body.innerHTML = geDefaultsHtml(bp);
  geDrawPreview();
}

function geDrawPreview() {
  const bp = geCurBp();
  if (!bp || bp.id === 'level') return;
  if (geKind(bp) === 'widget') {
    geDrawWidgetViewport();
    return;
  }
  const canvas = ge.root.querySelector('.ge-preview canvas');
  if (canvas) geDrawThumb(canvas, bp);
}

// Po przypisaniu interfejsu: brakujące zmienne (właściwości interfejsu) i zdarzenia jego funkcji.
// Zmienną i zdarzenie z klasy nadrzędnej uznajemy za istniejące. Zwraca nazwy tego, co dodano.
function geImplementInterface(bp, iface) {
  const added = { vars: [], events: [] };
  if (!iface) return added;
  const taken = geVarNamesTaken(bp);
  iface.properties.forEach((p) => {
    if (taken.includes(p.name)) return;
    bp.variables.push({ id: 'v' + bp.nextVar++, name: p.name, type: p.type, value: geVarDefault(p.type), editable: false });
    taken.push(p.name);
    added.vars.push(p.name);
  });
  const g = bp.graph;
  const has = new Set([bp, ...geAncestors(ge.project, bp)].flatMap((b) => b.graph.nodes.filter((n) => n.type === 'ev_interface').map((n) => n.props?.fn)));
  let y = g.nodes.reduce((max, n) => Math.max(max, n.y + 160), 64);
  iface.functions.forEach((f) => {
    const fn = `${iface.id}:${f.id}`;
    if (has.has(fn)) return;
    g.nodes.push({ id: 'n' + bp.nextNode++, type: 'ev_interface', x: geSnap(64), y: geSnap(y), props: { fn }, values: {} });
    y += 160;
    added.events.push(f.name);
  });
  return added;
}

// Interfejsy klasy jako lista: „＋ Dodaj interfejs” wybiera z listy z wyszukiwarką, „✕ Usuń” odpina.
function geInterfacesCat(bp) {
  const list = geOfKind('interface');
  if (!list.length) return geCat('Interfejsy', '<p class="ge-hint">Brak Blueprint Interface w projekcie — utwórz go w Przeglądarce zawartości (＋ Dodaj).</p>');
  // Interfejsy klasy nadrzędnej klasa ma zawsze — pokazujemy je bez przycisku usuwania.
  const all = geClassInterfaces(ge.project, bp);
  const info = (i) => `Funkcje: ${i.functions.map((f) => f.name).join(', ') || 'brak'}. Właściwości: ${i.properties.map((v) => v.name).join(', ') || 'brak'}.`;
  const rows = list.filter((i) => all.includes(i.id)).map((i) => (bp.interfaces.includes(i.id)
    ? geRow(i.name, `<button type="button" data-ge="iface-impl-del" data-id="${i.id}" title="Usuń interfejs z klasy">✕ Usuń</button>`, info(i))
    : geRow(i.name, '<span class="ge-hint">odziedziczony</span>', `Odziedziczony z klasy nadrzędnej. ${info(i)}`))).join('');
  const free = list.some((i) => !all.includes(i.id));
  return geCat('Interfejsy', (rows || '<p class="ge-hint">Klasa nie implementuje żadnego interfejsu.</p>')
    + `<div class="ge-det-actions"><button type="button" data-ge="iface-impl-add"${free ? '' : ' disabled'}>＋ Dodaj interfejs</button></div>`
    + '<p class="ge-hint">Po dodaniu interfejsu klasa dostaje brakujące zmienne (właściwości interfejsu) i zdarzenia <i>Event …</i> jego funkcji w Event Graph.</p>');
}

function geInterfaceMenu(anchor, bp) {
  const all = geClassInterfaces(ge.project, bp);
  const free = geOfKind('interface').filter((i) => !all.includes(i.id)).sort((a, b) => a.name.localeCompare(b.name));
  geMenu(anchor, [
    { heading: 'Dodaj interfejs' },
    ...free.map((i) => ({ label: `${GE_KINDS.interface.icon} ${i.name}`, action: () => geSetClassInterface(bp, i.id, true) }))
  ], { search: 'Szukaj interfejsu…' });
}

function geSetClassInterface(bp, id, on) {
  let added = null;
  geChange(() => {
    bp.interfaces = on ? [...new Set([...bp.interfaces, id])] : bp.interfaces.filter((x) => x !== id);
    if (on) added = geImplementInterface(bp, geAsset(ge.project, id, 'interface'));
  }, { bp: bp.id, only: ['details', 'graph', 'mybp', 'code'] });
  if (added && (added.vars.length || added.events.length)) {
    geLog(`${bp.name}: dodano z interfejsu ${[...added.vars.map((n) => `zmienną ${n}`), ...added.events.map((n) => `Event ${n}`)].join(', ')}.`);
  }
}

// ---------- Projektant widgetu ----------
// Karta „Projektant” Widget Blueprintu: ekran gry w środku (przesuwanie, przybliżanie), Paleta i Hierarchia
// po lewej, a w Szczegółach — zaznaczony element. Element „Widget” wstawia inny Widget Blueprint (kompozycja).

const GE_WD_ICON = { text: 'T', button: '▭', box: '■', widget: '🪟' };
const GE_WD_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const geWidgetClass = (id) => geAsset(ge.project, id, 'widget');
// Elementy klasy zagnieżdżonego widgetu do rysowania w edytorze (w grze rysują się elementy instancji).
const geWidgetKids = (el) => geWidgetClass(el.widget)?.widget.elements ?? null;

// Czy widget bp (także głębiej) zawiera widget o id target — wtedy wstawienie target w bp zrobiłoby pętlę.
function geWidgetContains(bp, target, depth = 0) {
  if (!bp || depth > 8) return false;
  return bp.widget.elements.some((el) => el.type === 'widget' && (el.widget === target || geWidgetContains(geWidgetClass(el.widget), target, depth + 1)));
}

// Widgety, które można wstawić do bp: każdy inny, który sam (pośrednio) nie zawiera bp.
const geNestableWidgets = (bp) => geOfKind('widget').filter((w) => w !== bp && !geWidgetContains(w, bp.id));

// Rozmiar widgetu wynika z jego elementów (prawy dolny róg najdalszego).
function geWidgetExtent(bp, depth = 0) {
  if (!bp || depth > 8) return { w: 120, h: 40 };
  let w = 16;
  let h = 16;
  bp.widget.elements.forEach((el) => {
    const box = geWdBox(el, depth + 1);
    w = Math.max(w, box.x + box.w);
    h = Math.max(h, box.y + box.h);
  });
  return { w, h };
}

// Prostokąt elementu na ekranie gry.
function geWdBox(el, depth = 0) {
  if (el.type !== 'widget') return { x: Number(el.x) || 0, y: Number(el.y) || 0, w: Number(el.w) || 1, h: Number(el.h) || 1 };
  const size = geWidgetExtent(geWidgetClass(el.widget), depth);
  return { x: Number(el.x) || 0, y: Number(el.y) || 0, ...size };
}

const geWdSel = (bp) => bp?.widget?.elements.find((el) => el.id === ge.widgetSel) ?? null;

function geRenderWdPanels() {
  const bp = geCurBp();
  const palette = ge.root.querySelector('.ge-wd-palette-body');
  const tree = ge.root.querySelector('.ge-wd-tree-body');
  if (!geIsWidgetBp(bp) || !palette || !tree) return;
  const item = (v, icon, label, hint) => `<button type="button" class="ge-wd-pal" data-ge="wd-add" data-v="${geEsc(v)}" draggable="true" title="${geEsc(hint)}"><span class="ge-row-ic">${icon}</span>${geEsc(label)}</button>`;
  const nestable = geNestableWidgets(bp);
  palette.innerHTML = `
    <div class="ge-mb-head"><span>Podstawowe</span></div>
    ${Object.entries(GE_WIDGET_ELEMENTS).filter(([type]) => type !== 'widget').map(([type, e]) => item(type, GE_WD_ICON[type], e.label, 'Kliknij albo przeciągnij na ekran')).join('')}
    <div class="ge-mb-head"><span>Twoje widgety</span></div>
    ${nestable.map((w) => item('widget:' + w.id, GE_WD_ICON.widget, w.name, 'Wstaw ten Widget Blueprint do środka (kompozycja)')).join('')
      || '<p class="ge-empty">Utwórz drugi Widget Blueprint, żeby wstawić go tutaj (np. pasek życia albo licznik).</p>'}`;
  const els = bp.widget.elements;
  tree.innerHTML = `
    <div class="ge-row ge-comp-row${ge.widgetSel ? '' : ' is-selected'}" style="--d:0" role="treeitem" aria-selected="${!ge.widgetSel}" data-ge="wd-pick" data-id="" tabindex="0">
      <span class="ge-row-name"><span class="ge-row-ic">🖥</span>[${geEsc(bp.name)}]</span><span class="ge-row-type">Ekran</span></div>
    ${[...els].reverse().map((el) => {
      const nested = el.type === 'widget' ? geWidgetClass(el.widget) : null;
      return `<div class="ge-row ge-comp-row${el.id === ge.widgetSel ? ' is-selected' : ''}" style="--d:1" role="treeitem" aria-selected="${el.id === ge.widgetSel}" data-ge="wd-pick" data-id="${el.id}" tabindex="0"${nested ? ` title="Dwuklik otwiera ${geEsc(nested.name)}"` : ''}>
        <span class="ge-row-name"><span class="ge-row-ic">${GE_WD_ICON[el.type]}</span>${geEsc(el.name)}</span>
        <span class="ge-row-type">${el.type === 'widget' ? geEsc(nested?.name ?? '(brak widgetu)') : GE_WIDGET_ELEMENTS[el.type].label}</span></div>`;
    }).join('')}
    ${els.length ? '<p class="ge-mb-tip">Wyżej na liście — na wierzchu.</p>' : '<p class="ge-mb-tip">Pusto — kliknij element w Palecie.</p>'}`;
}

function geSelectWidgetEl(id) {
  if ((ge.widgetSel ?? null) === (id || null)) return;
  ge.widgetSel = id || null;
  ge.bpPanel = null;
  geRenderWdPanels();
  geRenderBpDetails();
  geDrawWidgetViewport();
}

function geWidgetDetailsHtml(bp) {
  const sel = geWdSel(bp);
  if (!sel) {
    const s = ge.project.settings;
    const users = geOfKind('widget').filter((w) => w !== bp && w.widget.elements.some((el) => el.type === 'widget' && el.widget === bp.id));
    return `<p class="ge-det-note"><b>${geEsc(bp.name)}</b> — interfejs na ekranie gry ${s.width}×${s.height}. Zaznacz element w Projektancie albo w Hierarchii, żeby go edytować. Na ekran trafia węzłem <i>Create Widget</i> + <i>Add to Viewport</i> albo jako HUD w Ustawieniach świata.</p>
      ${users.length ? `<p class="ge-hint">Wstawiony w: ${users.map((w) => `<b>${geEsc(w.name)}</b>`).join(', ')}.</p>` : ''}
      ${geInterfacesCat(bp)}`;
  }
  const extra = `data-id="${sel.id}"`;
  const box = geWdBox(sel);
  const common = geRow('Nazwa', geText('widget-el', 'name', sel.name, extra), 'Tej nazwy używają węzły „Set Text (Widget)”, „On Clicked” i „Get” zagnieżdżonego widgetu.')
    + geRow('Położenie', geVec2('widget-el', 'x', 'y', sel.x, sel.y, extra), 'Lewy górny róg na ekranie gry.');
  let props;
  if (sel.type === 'widget') {
    const choices = geNestableWidgets(bp).map((w) => [w.id, w.name]);
    if (!choices.some(([id]) => id === sel.widget)) choices.unshift([sel.widget ?? '', '(brak widgetu)']);
    props = geCat(`Widget: ${sel.name}`, common
      + geRow('Klasa widgetu', geSelect('widget-el', 'widget', sel.widget ?? '', choices, extra))
      + geRow('Rozmiar', `<span class="ge-row-type">${Math.round(box.w)} × ${Math.round(box.h)} (z elementów)</span>`))
      + '<p class="ge-hint">Zagnieżdżony widget ma własne zdarzenia, zmienne i przyciski. W grafie tego widgetu pobierzesz go węzłem <b>Get ' + geEsc(sel.name) + '</b> (prawy przycisk › Interfejs).</p>'
      + (geWidgetClass(sel.widget) ? `<div class="ge-det-actions"><button type="button" data-ge="open-bp" data-id="${geEsc(sel.widget)}">✎ Otwórz ${geEsc(geWidgetClass(sel.widget).name)}</button></div>` : '');
  } else {
    props = geCat(`Element: ${sel.name}`, common
      + geRow('Rozmiar', `<span class="ge-vec2"><label><i class="ge-ax">W</i>${geNum('widget-el', 'w', sel.w, 'float', extra)}</label><label><i class="ge-ax">H</i>${geNum('widget-el', 'h', sel.h, 'float', extra)}</label></span>`)
      + (sel.type !== 'box' ? geRow('Tekst', geText('widget-el', 'text', sel.text, extra)) + geRow('Czcionka', geNum('widget-el', 'size', sel.size, 'int', extra)) + geRow('Kolor tekstu', geColorIn('widget-el', 'color', sel.color, extra)) : '')
      + (sel.type === 'text' ? geRow('Wyrównanie', geSelect('widget-el', 'align', sel.align, [['left', 'Do lewej'], ['center', 'Do środka'], ['right', 'Do prawej']], extra)) : '')
      + (sel.type !== 'text' ? geRow('Tło', geColorIn('widget-el', 'bg', sel.bg, extra)) : ''))
      + (sel.type === 'button' ? geEventsCat(bp, [['ev_button', 'On Clicked'], ...GE_BUTTON_EVENTS.map(([type, ue]) => [type, ue])], 'button', sel.name) : '');
  }
  return props + `<div class="ge-det-actions"><button type="button" data-ge="wd-dup" data-id="${sel.id}">Duplikuj</button><button type="button" class="ge-danger" data-ge="wd-del" data-id="${sel.id}">Usuń element</button></div>`;
}

const geWdToScreen = (x, y) => {
  const v = ge.bpViews[ge.tab];
  return { x: (x - v.x) * v.zoom, y: (y - v.y) * v.zoom };
};

function geWdvpPoint(event) {
  const r = ge.root.querySelector('.ge-wdvp').getBoundingClientRect();
  const v = ge.bpViews[ge.tab];
  const sx = event.clientX - r.left;
  const sy = event.clientY - r.top;
  return { sx, sy, wx: v.x + sx / v.zoom, wy: v.y + sy / v.zoom };
}

// Uchwyty zmiany rozmiaru zaznaczonego elementu (na ekranie), bez zagnieżdżonych widgetów — te mają rozmiar z elementów.
function geWdHandles(el) {
  if (!el || el.type === 'widget') return [];
  const b = geWdBox(el);
  const a = geWdToScreen(b.x, b.y);
  const z = geWdToScreen(b.x + b.w, b.y + b.h);
  const mx = (a.x + z.x) / 2;
  const my = (a.y + z.y) / 2;
  const pos = { nw: [a.x, a.y], n: [mx, a.y], ne: [z.x, a.y], e: [z.x, my], se: [z.x, z.y], s: [mx, z.y], sw: [a.x, z.y], w: [a.x, my] };
  return GE_WD_HANDLES.map((h) => ({ h, x: pos[h][0], y: pos[h][1] }));
}

function geDrawWidgetViewport() {
  if (!ge || ge.tab === 'level' || geMode() !== 'designer') return;
  const vp = ge.root.querySelector('.ge-wdvp');
  const canvas = vp?.querySelector('.ge-vp-canvas');
  const bp = geCurBp();
  if (!canvas || !geIsWidgetBp(bp)) return;
  const w = vp.clientWidth;
  const h = vp.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const s = ge.project.settings;
  if (!ge.bpViews[ge.tab]) {
    const zoom = Math.min(2, Math.max(0.1, Math.min((w - 48) / s.width, (h - 64) / s.height)));
    ge.bpViews[ge.tab] = { zoom, x: s.width / 2 - w / 2 / zoom, y: s.height / 2 - h / 2 / zoom };
  }
  const v = ge.bpViews[ge.tab];
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#161616';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(-v.x * v.zoom, -v.y * v.zoom);
  ctx.scale(v.zoom, v.zoom);
  // Ekran gry: tło świata przyciemnione, jak w podglądzie HUD-u.
  ctx.fillStyle = s.background;
  ctx.fillRect(0, 0, s.width, s.height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, s.width, s.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, s.width, s.height);
  ctx.clip();
  GE_RT.drawWidget(ctx, bp.widget.elements, geWidgetKids);
  ctx.restore();
  ctx.lineWidth = 1 / v.zoom;
  ctx.strokeStyle = '#2fb36b';
  ctx.strokeRect(0, 0, s.width, s.height);
  // Zagnieżdżone widgety: przerywana ramka i nazwa klasy, żeby było widać, gdzie kończą się ich elementy.
  ctx.setLineDash([6 / v.zoom, 4 / v.zoom]);
  ctx.strokeStyle = 'rgba(47, 179, 107, 0.9)';
  ctx.font = `600 ${11 / v.zoom}px "Segoe UI", system-ui, sans-serif`;
  ctx.textBaseline = 'bottom';
  bp.widget.elements.filter((el) => el.type === 'widget').forEach((el) => {
    const b = geWdBox(el);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(47, 179, 107, 0.95)';
    ctx.fillText(geWidgetClass(el.widget)?.name ?? '(brak widgetu)', b.x, b.y - 2 / v.zoom);
  });
  ctx.setLineDash([]);
  const sel = geWdSel(bp);
  if (sel) {
    const b = geWdBox(sel);
    ctx.lineWidth = 2 / v.zoom;
    ctx.strokeStyle = '#ffa31a';
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  ctx.restore();
  ctx.fillStyle = '#ffa31a';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  geWdHandles(sel).forEach((p) => {
    ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
    ctx.strokeRect(p.x - 3.5, p.y - 3.5, 7, 7);
  });
  const chip = vp.querySelector('.ge-vp-zoom');
  if (chip) chip.textContent = `${Math.round(v.zoom * 100)}%`;
}

// Element pod punktem ekranu gry (ostatni na liście leży na wierzchu).
function geWdElementAt(bp, wx, wy) {
  return [...bp.widget.elements].reverse().find((el) => {
    const b = geWdBox(el);
    return wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h;
  }) ?? null;
}

function geWdvpDown(event) {
  const vp = event.currentTarget;
  const v = ge.bpViews[ge.tab];
  if (!v || event.target.closest('.ge-vp-bar')) return;
  vp.focus({ preventScroll: true });
  const bp = geCurBp();
  const p = geWdvpPoint(event);
  const pan = () => {
    ge.drag = { mode: 'pan', cx: event.clientX, cy: event.clientY, vx: v.x, vy: v.y, moved: false, button: event.button };
    vp.setPointerCapture(event.pointerId);
  };
  if (event.button === 1 || event.button === 2) {
    pan();
    return;
  }
  if (event.button !== 0) return;
  const sel = geWdSel(bp);
  const handle = geWdHandles(sel).find((hd) => Math.abs(hd.x - p.sx) <= 6 && Math.abs(hd.y - p.sy) <= 6);
  if (handle) {
    ge.drag = { mode: 'wd-size', h: handle.h, id: sel.id, wx: p.wx, wy: p.wy, box: geWdBox(sel), moved: false };
    vp.setPointerCapture(event.pointerId);
    return;
  }
  const el = geWdElementAt(bp, p.wx, p.wy);
  geSelectWidgetEl(el?.id ?? null);
  if (!el) {
    pan();
    return;
  }
  ge.drag = { mode: 'wd-move', id: el.id, wx: p.wx, wy: p.wy, ox: el.x, oy: el.y, moved: false, alt: event.altKey };
  vp.setPointerCapture(event.pointerId);
}

function geWdvpMove(event) {
  const d = ge.drag;
  const v = ge.bpViews[ge.tab];
  const vp = event.currentTarget;
  if (!d || !v) {
    // Kursor podpowiada, że uchwyt da się złapać.
    const p = v && geWdvpPoint(event);
    const handle = p && geWdHandles(geWdSel(geCurBp())).find((hd) => Math.abs(hd.x - p.sx) <= 6 && Math.abs(hd.y - p.sy) <= 6);
    vp.style.cursor = handle ? `${handle.h}-resize` : '';
    return;
  }
  if (d.mode === 'pan') {
    const dx = event.clientX - d.cx;
    const dy = event.clientY - d.cy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    v.x = d.vx - dx / v.zoom;
    v.y = d.vy - dy / v.zoom;
    geDrawWidgetViewport();
    return;
  }
  if (d.mode !== 'wd-move' && d.mode !== 'wd-size') return;
  const bp = geCurBp();
  const p = geWdvpPoint(event);
  if (!d.moved) {
    if (Math.hypot(p.wx - d.wx, p.wy - d.wy) * v.zoom < 3) return;
    d.moved = true;
    geSnapshot();
    if (d.alt) {
      const copy = geCopyWidgetElement(bp, bp.widget.elements.find((x) => x.id === d.id));
      d.id = copy.id;
      ge.widgetSel = copy.id;
      geRenderWdPanels();
    }
  }
  const el = bp.widget.elements.find((x) => x.id === d.id);
  if (!el) return;
  const snap = event.shiftKey ? 1 : 8;
  const dx = p.wx - d.wx;
  const dy = p.wy - d.wy;
  if (d.mode === 'wd-move') {
    el.x = geSnap(d.ox + dx, snap);
    el.y = geSnap(d.oy + dy, snap);
  } else {
    const b = d.box;
    let l = b.x;
    let t = b.y;
    let r = b.x + b.w;
    let bot = b.y + b.h;
    if (d.h.includes('w')) l = Math.min(r - 8, geSnap(b.x + dx, snap));
    if (d.h.includes('e')) r = Math.max(l + 8, geSnap(b.x + b.w + dx, snap));
    if (d.h.includes('n')) t = Math.min(bot - 8, geSnap(b.y + dy, snap));
    if (d.h.includes('s')) bot = Math.max(t + 8, geSnap(b.y + b.h + dy, snap));
    Object.assign(el, { x: l, y: t, w: r - l, h: bot - t });
  }
  geDrawWidgetViewport();
  ge.root.querySelectorAll(`[data-scope="widget-el"][data-id="${el.id}"]`).forEach((input) => {
    if (['x', 'y', 'w', 'h'].includes(input.dataset.k)) input.value = el[input.dataset.k];
  });
}

function geWdvpUp(event) {
  const d = ge.drag;
  ge.drag = null;
  if (!d) return;
  const vp = event.currentTarget;
  if (vp.hasPointerCapture?.(event.pointerId)) vp.releasePointerCapture(event.pointerId);
  if (d.mode === 'pan' && d.button === 2 && !d.moved) {
    const p = geWdvpPoint(event);
    const bp = geCurBp();
    const el = geWdElementAt(bp, p.wx, p.wy);
    if (el) {
      geSelectWidgetEl(el.id);
      geMenu({ x: event.clientX, y: event.clientY }, geWdElementMenu(el.id));
    } else geMenu({ x: event.clientX, y: event.clientY }, geWdAddMenu({ x: geSnap(p.wx, 8), y: geSnap(p.wy, 8) }));
  }
  if ((d.mode === 'wd-move' || d.mode === 'wd-size') && d.moved) {
    geScheduleSave();
    geRenderBpDetails();
  }
}

function geWdvpWheel(event) {
  const v = ge.bpViews[ge.tab];
  if (!v) return;
  event.preventDefault();
  const p = geWdvpPoint(event);
  const zoom = Math.min(4, Math.max(0.1, v.zoom * Math.pow(1.0015, -event.deltaY)));
  v.x = p.wx - p.sx / zoom;
  v.y = p.wy - p.sy / zoom;
  v.zoom = zoom;
  geDrawWidgetViewport();
}

// Element przeciągnięty z Palety na ekran.
function geWdvpDrop(event) {
  const v = event.dataTransfer.getData('application/x-ge-wd');
  if (!v || !ge.bpViews[ge.tab]) return;
  event.preventDefault();
  const p = geWdvpPoint(event);
  geWidgetElementAction('add', v, { x: geSnap(p.wx, 8), y: geSnap(p.wy, 8) });
}

function geWdAddMenu(at = null) {
  const bp = geCurBp();
  return [
    { heading: 'Dodaj element' },
    ...Object.entries(GE_WIDGET_ELEMENTS).filter(([type]) => type !== 'widget').map(([type, e]) => ({ label: `${GE_WD_ICON[type]} ${e.label}`, action: () => geWidgetElementAction('add', type, at) })),
    ...(geNestableWidgets(bp).length ? [{ heading: 'Wstaw widget' }, ...geNestableWidgets(bp).map((w) => ({ label: `${GE_WD_ICON.widget} ${w.name}`, action: () => geWidgetElementAction('add', 'widget:' + w.id, at) }))] : [])
  ];
}

function geWdElementMenu(id) {
  const el = geCurBp().widget.elements.find((x) => x.id === id);
  const nested = el?.type === 'widget' && geWidgetClass(el.widget);
  return [
    ...(nested ? [{ label: `✎ Otwórz ${nested.name}`, action: () => geOpenTab(nested.id) }, '-'] : []),
    { label: '⤒ Na wierzch', action: () => geWidgetElementAction('front', id) },
    { label: '⤓ Na spód', action: () => geWidgetElementAction('back', id) },
    '-',
    { label: 'Duplikuj', key: 'Ctrl+D', action: () => geWidgetElementAction('dup', id) },
    { label: 'Usuń', key: 'Delete', action: () => geWidgetElementAction('del', id) }
  ];
}

function geCopyWidgetElement(bp, el) {
  const els = bp.widget.elements;
  const copy = { ...JSON.parse(JSON.stringify(el)), id: 'e' + bp.nextVar++, name: geUniqueName(el.name.replace(/\d+$/, '') || el.name, els.map((e) => e.name)) };
  els.splice(els.indexOf(el) + 1, 0, copy);
  return copy;
}

// Dodawanie (type albo „widget:id” — zagnieżdżony widget), duplikowanie, usuwanie i kolejność elementów.
function geWidgetElementAction(action, id, at = null) {
  const bp = geCurBp();
  const els = bp.widget.elements;
  const el = els.find((e) => e.id === id);
  if (action === 'add' && id.startsWith('widget:') && !geNestableWidgets(bp).some((w) => w.id === id.slice(7))) {
    geToast('Tego widgetu nie da się tu wstawić — zawiera ten widget (powstałaby pętla).');
    return;
  }
  geChange(() => {
    if (action === 'add') {
      const s = ge.project.settings;
      const nested = id.startsWith('widget:') ? geWidgetClass(id.slice(7)) : null;
      const size = nested ? geWidgetExtent(nested) : GE_WIDGET_ELEMENTS[id];
      const x = at ? at.x : geSnap((s.width - size.w) / 2, 8);
      const y = at ? at.y : geSnap((s.height - size.h) / 2, 8);
      const added = geAddWidgetElement(bp, nested ? 'widget' : id, x, y);
      if (nested) {
        added.widget = nested.id;
        added.name = geUniqueName((nested.name.replace(/^WBP_/, '') || 'Widget') + '1', els.filter((e) => e !== added).map((e) => e.name));
      }
      ge.widgetSel = added.id;
    } else if (action === 'dup' && el) {
      const copy = geCopyWidgetElement(bp, el);
      copy.x += 16;
      copy.y += 16;
      ge.widgetSel = copy.id;
    } else if (action === 'del' && el) {
      bp.widget.elements = els.filter((e) => e !== el);
      ge.widgetSel = null;
    } else if ((action === 'front' || action === 'back') && el) {
      els.splice(els.indexOf(el), 1);
      if (action === 'front') els.push(el);
      else els.unshift(el);
    }
  }, { bp: bp.id, only: ['details', 'graph', 'code'] });
}

// ---------- Edytory zasobów bez grafu: Interface, Materiał, Tekstura, Sprite, Animacja, Dźwięk ----------

const GE_ASSET_TABS = ['interface', 'material', 'texture', 'sprite', 'animation', 'sound', 'input_action', 'input_context', ...GE_DATA_KINDS];
const geIsAssetTab = () => ge.tab !== 'level' && GE_ASSET_TABS.includes(geKind(geCurBp()));
const GE_ASSET_VIEW_TITLE = {
  interface: 'Funkcje interfejsu', material: 'Podgląd materiału', texture: 'Podgląd tekstury', sprite: 'Edytor sprite’a — wycinek tekstury', animation: 'Podgląd animacji', sound: 'Podgląd dźwięku',
  input_action: 'Szczegóły', input_context: 'Szczegóły',
  ...GE_DATA_VIEW_TITLE
};

function geAssetToolbar(kind) {
  const sep = '<span class="ge-sep"></span>';
  const toClass = '<button type="button" data-ge="asset-class" title="Nowa klasa Blueprint aktora, który wygląda jak ten zasób"><span class="ge-ic">📘</span>Utwórz klasę Blueprint</button>';
  return {
    interface: `${sep}<button type="button" data-ge="iface-add"><span class="ge-ic ge-ic-green">＋</span>Dodaj funkcję</button><button type="button" data-ge="iface-prop-add"><span class="ge-ic ge-ic-green">＋</span>Dodaj właściwość</button>`,
    texture: `${sep}<button type="button" data-ge="asset-replace"><span class="ge-ic">⤓</span>Zamień obrazek…</button><button type="button" data-ge="tex-sprite"><span class="ge-ic">🧩</span>Utwórz Sprite</button><button type="button" data-ge="tex-slice"><span class="ge-ic">🎞</span>Podziel na klatki</button>${toClass}`,
    sprite: `${sep}${toClass}`,
    animation: `${sep}${toClass}`,
    sound: `${sep}<button type="button" data-ge="snd-play"><span class="ge-ic ge-ic-green">▶</span>Odtwórz</button><button type="button" data-ge="snd-stop"><span class="ge-ic">■</span>Zatrzymaj</button><button type="button" data-ge="asset-replace"><span class="ge-ic">⤓</span>Wczytaj plik…</button>`,
    input_context: `${sep}<button type="button" data-ge="imc-add" title="Nowe mapowanie: akcja i klawisz, który ją uruchamia"><span class="ge-ic ge-ic-green">＋</span>Dodaj mapowanie</button><button type="button" data-ge="imc-new-action" title="Nowy zasób Input Action od razu zmapowany w tym kontekście"><span class="ge-ic">🎮</span>Nowa Input Action…</button>`
  }[kind] ?? geDataToolbar(kind);
}

function geBuildAssetPage(page) {
  const bp = geCurBp();
  const kind = geKind(bp);
  page.className = `ge-page ge-apage ge-apage-${kind}`;
  page.innerHTML = `
    <div class="ge-toolbar">
      <button type="button" data-ge="save" title="Zapisz projekt do pliku (Ctrl+S)"><span class="ge-ic">💾</span>Zapisz</button>
      ${geAssetToolbar(kind)}
      <span class="ge-fill"></span>
      <span class="ge-bp-parent">${GE_KINDS[kind].label}: <b>${geEsc(bp.name)}</b></span>
    </div>
    <div class="ge-asset-main">
      <section class="ge-panel ge-asset-view">
        <div class="ge-panel-head"><span class="ge-panel-tab">${GE_ASSET_VIEW_TITLE[kind]}</span></div>
        <div class="ge-asset-view-body"></div>
      </section>
      <aside class="ge-panel ge-asset-details">
        <div class="ge-panel-head"><span class="ge-panel-tab">${kind === 'input_action' || kind === 'input_context' ? 'Pomoc' : 'Szczegóły'}</span></div>
        <div class="ge-asset-details-body"></div>
      </aside>
    </div>`;
  geRenderAssetPage();
}

function geRenderAssetPage() {
  const bp = geCurBp();
  const view = ge.root.querySelector('.ge-asset-view-body');
  const details = ge.root.querySelector('.ge-asset-details-body');
  if (!bp || !view || !details) return;
  const userRow = (b) => `<button type="button" class="ge-row" data-ge="open-bp" data-id="${geTabFor(b.id)}"><span class="ge-row-name">${geKindIcon(b)} ${geEsc(b.name)}</span><span class="ge-row-type">otwórz</span></button>`;
  const kind = geKind(bp);
  if (GE_DATA_PAGES[kind]) {
    GE_DATA_PAGES[kind](bp, view, details);
    return;
  }
  if (['texture', 'sprite', 'animation', 'sound'].includes(kind)) {
    const users = geAssetUsers(bp.id);
    const usedBy = geCat('Używany przez', users.map(userRow).join('') || '<p class="ge-hint">Nic go jeszcze nie używa.</p>');
    const html = { texture: geTextureHtml, sprite: geSpriteHtml, animation: geFlipbookHtml, sound: geSoundHtml }[kind](bp);
    view.innerHTML = html.view;
    details.innerHTML = html.details + usedBy;
    const spriteCanvas = view.querySelector('.ge-sprite-canvas');
    if (spriteCanvas) ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((type) => spriteCanvas.addEventListener(type, geSpritePointer));
    geDrawAssetPreview();
    if (kind === 'animation') geStartAnimPreview();
    return;
  }
  if (kind === 'input_action' || kind === 'input_context') {
    const users = geAssetUsers(bp.id);
    const html = (kind === 'input_action' ? geInputActionHtml : geMappingContextHtml)(bp);
    view.innerHTML = html.view;
    details.innerHTML = html.details + geCat('Używany przez', users.map(userRow).join('') || '<p class="ge-hint">Nic go jeszcze nie używa.</p>');
    return;
  }
  if (kind === 'material') {
    const m = bp.material;
    const users = ge.project.blueprints.filter((b) => b.defaults?.material === bp.id || (b.components ?? []).some((c) => c.material === bp.id));
    view.innerHTML = '<canvas class="ge-mat-canvas" width="720" height="360" aria-label="Podgląd materiału"></canvas>';
    details.innerHTML = `<p class="ge-det-note">Materiał <b>${geEsc(bp.name)}</b> nadpisuje kolor aktora i dodaje krycie oraz poświatę. Nałożysz go w grze węzłem „Set Material”.</p>
      ${geCat('Materiał', geRow('Kolor bazowy', geColorIn('material', 'color', m.color), 'Base Color — kolor prostokąta, koła albo tekstu.')
        + geRow('Krycie', geNum('material', 'opacity', m.opacity, 'float', 'min="0" max="1" step="0.05"'), 'Opacity: 1 — pełny, 0.5 — półprzezroczysty, 0 — niewidoczny.')
        + geRow('Poświata', geNum('material', 'glow', m.glow, 'float', 'min="0" max="100"'), 'Emissive: jak mocno aktor świeci (rozmycie w pikselach, 0 — brak).'))}
      ${geCat('Używany przez', users.map(userRow).join('') || '<p class="ge-hint">Żadna klasa jeszcze go nie używa.</p>')}`;
    geDrawMaterialPreview();
    return;
  }
  const users = ge.project.blueprints.filter((b) => b.interfaces?.includes(bp.id));
  const types = geVarTypes(ge.project).map((t) => [t, geType(t).label]);
  view.innerHTML = `<div class="ge-iface-list"><div class="ge-mb-head"><span>Funkcje</span></div>${bp.functions.map((f) => `<div class="ge-iface-fn">
      <span class="ge-iface-ic" aria-hidden="true">ƒ</span>${geText('iface-fn', 'name', f.name, `data-id="${f.id}" aria-label="Nazwa funkcji"`)}
      <button type="button" class="ge-mini" data-ge="iface-del" data-id="${f.id}" aria-label="Usuń funkcję ${geEsc(f.name)}">Usuń</button>
    </div>`).join('') || '<p class="ge-empty">Brak funkcji — kliknij „＋ Dodaj funkcję”.</p>'}
    <div class="ge-mb-head"><span>Właściwości</span></div>${bp.properties.map((v) => `<div class="ge-iface-fn">
      <span class="ge-iface-ic" aria-hidden="true">x</span>${geText('iface-prop', 'name', v.name, `data-id="${v.id}" aria-label="Nazwa właściwości"`)}
      ${geSelect('iface-prop', 'type', v.type, types, `data-id="${v.id}" aria-label="Typ właściwości"`)}
      <button type="button" class="ge-mini" data-ge="iface-prop-del" data-id="${v.id}" aria-label="Usuń właściwość ${geEsc(v.name)}">Usuń</button>
    </div>`).join('') || '<p class="ge-empty">Brak właściwości — kliknij „＋ Dodaj właściwość”.</p>'}</div>`;
  details.innerHTML = `<p class="ge-det-note"><b>Blueprint Interface</b> to lista funkcji bez treści. Każda klasa, która go implementuje, sama decyduje, co zrobić — np. „Interact” otwiera drzwi, a skrzynię napełnia monetami.</p>
    ${geCat('Jak używać', `<ol class="ge-steps">
      <li>Dodaj funkcje (np. <i>Interact</i>) i właściwości (np. <i>Zycie</i>).</li>
      <li>W klasie: Ustawienia klasy › Interfejsy — zaznacz <b>${geEsc(bp.name)}</b>. Brakujące zmienne i zdarzenia <i>Event …</i> utworzą się same.</li>
      <li>W Event Graph klasy podłącz do zdarzeń <i>Event …</i>, co ma się stać.</li>
      <li>Gdzie indziej węzeł <i>… (Message)</i> wywołuje funkcję u dowolnego aktora.</li></ol>`)}
    ${geCat('Implementują', users.map(userRow).join('') || '<p class="ge-hint">Żadna klasa jeszcze go nie implementuje.</p>')}`;
}

function geDrawMaterialBall(ctx, bp, x, y, r) {
  const look = { ...GE_BP_DEFAULTS, ...geMaterialLook(bp), shape: 'circle', x, y, w: r * 2, h: r * 2 };
  GE_RT.drawShape(ctx, look);
  // Odblask, żeby kółko wyglądało jak kulka materiału z Unreal Engine.
  ctx.save();
  ctx.globalAlpha = 0.35 * Math.min(1, Math.max(0, look.opacity));
  const shine = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x - r * 0.2, y - r * 0.2, r);
  shine.addColorStop(0, '#ffffff');
  shine.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function geDrawMaterialPreview() {
  const canvas = ge.root.querySelector('.ge-mat-canvas');
  const bp = geCurBp();
  if (!canvas || geKind(bp) !== 'material') return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  geDrawMaterialBall(ctx, bp, W * 0.22, H / 2, H * 0.3);
  const look = { ...GE_BP_DEFAULTS, ...geMaterialLook(bp), y: H / 2, rotation: 0, scaleX: 1, scaleY: 1 };
  GE_RT.drawShape(ctx, { ...look, shape: 'box', x: W * 0.52, w: H * 0.5, h: H * 0.5 });
  GE_RT.drawShape(ctx, { ...look, shape: 'text', text: 'Aa', x: W * 0.8, w: H * 0.6, h: H * 0.5 });
}

// ---------- Enhanced Input: Input Action i Input Mapping Context ----------

const geMapping = (bp, id) => bp?.mappingContext?.mappings.find((m) => m.id === id) ?? null;
const geInputActionChoices = () => geOfKind('input_action').sort(geByName).map((a) => [a.id, a.name]);
const geInputTypeLabel = (a) => GE_INPUT_VALUE_TYPES.find(([t]) => t === a?.inputAction.valueType)?.[1] ?? '';

// Lista triggerów albo modyfikatorów: owner „action” — samej akcji, inaczej mapowania o tym id.
function geInputList(bp, owner, what) {
  const host = owner === 'action' ? bp?.inputAction : geMapping(bp, owner);
  return host ? host[what === 'trig' ? 'triggers' : 'modifiers'] : null;
}

function geKeyOptions(value) {
  const known = GE_INPUT_KEYS.some((g) => g.keys.some(([k]) => k === value));
  const groups = GE_INPUT_KEYS.map((g) => `<optgroup label="${geEsc(g.group)}">${g.keys.map(([k, label, axis]) => `<option value="${geEsc(k)}"${k === value ? ' selected' : ''}>${geEsc(label)}${axis ? ' ↔' : ''}</option>`).join('')}</optgroup>`).join('');
  return `<option value=""${value ? '' : ' selected'}>— wybierz klawisz —</option>${value && !known ? `<option value="${geEsc(value)}" selected>${geEsc(value)}</option>` : ''}${groups}`;
}

// Tablica Triggers albo Modifiers jak w panelu Szczegóły Unreal Engine: „N elementów ＋ 🗑”, a pod spodem Index [i] z typem i ustawieniami.
function geInputStackHtml(owner, list, what) {
  const trig = what === 'trig';
  const defs = trig ? GE_INPUT_TRIGGERS : GE_INPUT_MODIFIERS;
  const attrs = (i) => `data-what="${what}" data-owner="${owner}" data-i="${i}"`;
  const items = list.map((t, i) => {
    const def = defs[t.type];
    const params = (def?.params ?? []).map(([id, name, , kind]) => {
      const v = t[id];
      const control = kind === 'bool' ? geCheck('in-item', id, !!v, attrs(i))
        : kind === 'action' ? geSelect('in-item', id, v ?? '', [['', '— wybierz akcję —'], ...geInputActionChoices()], attrs(i))
        : geNum('in-item', id, v, 'float', `${attrs(i)} min="0" step="0.05"`);
      return geRow(name, control);
    });
    if (trig && def && !def.noThreshold) {
      params.push(geRow('Actuation Threshold', geNum('in-item', 'threshold', t.threshold ?? 0.5, 'float', `${attrs(i)} min="0" max="1" step="0.05"`), 'Od jakiej siły (0–1) klawisz albo gałka liczy się jako wciśnięta.'));
    }
    return `<div class="ge-ue-item">
        ${geRow(`Index [ ${i} ]`, `${geSelect('in-item', 'type', t.type, Object.entries(defs).map(([k, d]) => [k, d.label]), `${attrs(i)} aria-label="${trig ? 'Trigger' : 'Modyfikator'} ${i}" title="${geEsc(def?.desc ?? '')}"`)}
          <button type="button" class="ge-ue-btn" data-ge="in-del" ${attrs(i)} title="Usuń element" aria-label="Usuń">🗑</button>`, def?.desc ?? '')}
        ${params.length ? `<div class="ge-ue-sub">${params.join('')}</div>` : ''}
      </div>`;
  }).join('');
  return `<div class="ge-ue-arr">
      ${geRow(trig ? 'Triggers' : 'Modifiers', `<span class="ge-muted ge-ue-count">${list.length} elem.</span>
        <button type="button" class="ge-ue-btn ge-ue-add" data-ge="in-add" data-what="${what}" data-owner="${owner}" title="Dodaj element" aria-label="Dodaj ${trig ? 'trigger' : 'modyfikator'}">＋</button>
        <button type="button" class="ge-ue-btn" data-ge="in-clear" data-what="${what}" data-owner="${owner}" title="Usuń wszystkie elementy" aria-label="Wyczyść">🗑</button>`,
        trig ? 'Triggery decydują, kiedy akcja zadziała. Brak triggerów — działa przy każdej niezerowej wartości (jak Down).' : 'Modyfikatory zmieniają wartość klawisza (np. Negate odwraca znak).')}
      ${items ? `<div class="ge-ue-sub">${items}</div>` : ''}
    </div>`;
}

function geInputActionHtml(bp) {
  const a = bp.inputAction;
  const maps = geOfKind('input_context').flatMap((c) => c.mappingContext.mappings.filter((m) => m.action === bp.id).map((m) => ({ c, m })));
  const keyRow = ({ c, m }) => {
    const extra = [geInputSummary(m.modifiers, GE_INPUT_MODIFIERS), geInputSummary(m.triggers, GE_INPUT_TRIGGERS)].filter(Boolean).join(' · ');
    return `<button type="button" class="ge-row" data-ge="open-bp" data-id="${c.id}"><span class="ge-row-name">⌨ ${geEsc(geInputKeyLabel(m.key))}</span><span class="ge-row-type">${geEsc(c.name)}${extra ? ' · ' + geEsc(extra) : ''}</span></button>`;
  };
  return {
    view: `<div class="ge-ue-details">
      ${geCat('Action', geRow('Value Type', geSelect('input-action', 'valueType', a.valueType, GE_INPUT_VALUE_TYPES), 'Digital — wciśnięty / nie (skok). Axis1D — liczba od −1 do 1 (ruch w lewo i w prawo). Axis2D — wektor X, Y (ruch w czterech kierunkach, gałka pada).')
        + geRow('Accumulation Behavior', geSelect('input-action', 'accumulate', a.accumulate, GE_INPUT_ACCUMULATE), 'Gdy działa kilka klawiszy naraz: Take Highest — wygrywa najsilniejszy, Cumulative — wartości się sumują (A + D = 0).')
        + geRow('Consume Input', geCheck('input-action', 'consume', a.consume), 'Klawisz użyty przez tę akcję nie trafia już do kontekstów o niższym priorytecie.')
        + geRow('Trigger when Paused', geCheck('input-action', 'whenPaused', a.whenPaused), 'Akcja działa też w pauzie (Set Game Paused) — np. przycisk wznowienia gry.')
        + geInputStackHtml('action', a.triggers, 'trig')
        + geInputStackHtml('action', a.modifiers, 'mod'))}
    </div>`,
    details: `<p class="ge-det-note"><b>Input Action</b> to coś, co gracz chce zrobić — np. <i>Skok</i> albo <i>Ruch</i> — bez względu na to, jakim klawiszem. Klawisze przypisujesz w <b>Input Mapping Context</b>, a w grafie reagujesz zdarzeniem <b>EnhancedInputAction ${geEsc(bp.name)}</b>. Triggery i Modyfikatory akcji działają na wartości ze wszystkich jej klawiszy.</p>
      ${geCat('Klawisze tej akcji', maps.length ? maps.map(keyRow).join('') : '<p class="ge-hint">Ta akcja nie ma jeszcze klawiszy. Otwórz Input Mapping Context i kliknij „＋” przy Mappings.</p>')}
      ${geCat('Jak używać', `<ol class="ge-steps">
        <li>Ustaw <b>Value Type</b>.</li>
        <li>W Input Mapping Context dodaj mapowanie tej akcji i wybierz klawisze (np. A z modyfikatorem Negate, D bez).</li>
        <li>Włącz kontekst: Ustawienia świata › Default Mapping Context albo węzeł „Add Mapping Context”.</li>
        <li>W grafie: prawy przycisk › Wejście › <i>EnhancedInputAction ${geEsc(bp.name)}</i>.</li></ol>`)}`
  };
}

// Edytor Input Mapping Context jak w Unreal Engine: tablica Mappings, w niej akcje, a pod każdą jej klawisze (rozwijane strzałką).
function geMappingContextHtml(bp) {
  const maps = bp.mappingContext.mappings;
  const actions = geInputActionChoices();
  const groups = [...new Set(maps.map((m) => m.action))].map((actionId) => {
    const action = geAsset(ge.project, actionId, 'input_action');
    const rows = maps.filter((m) => m.action === actionId).map((m) => {
      const open = ge.imcOpen.has(m.id);
      const chips = [...m.modifiers.map((t) => GE_INPUT_MODIFIERS[t.type]?.label), ...m.triggers.map((t) => GE_INPUT_TRIGGERS[t.type]?.label)].filter(Boolean)
        .map((label, i) => `<span class="ge-imc-chip${i < m.modifiers.length ? ' is-mod' : ''}">${geEsc(label)}</span>`).join('');
      return `<div class="ge-imc-key${open ? ' is-open' : ''}">
          <div class="ge-imc-key-row">
            <button type="button" class="ge-ue-arrow" data-ge="imc-toggle" data-id="${m.id}" aria-expanded="${open}" title="Triggery i Modyfikatory tego klawisza">${open ? '▾' : '▸'}</button>
            <button type="button" class="ge-ue-btn" data-ge="imc-listen" data-id="${m.id}" title="Kliknij i naciśnij klawisz na klawiaturze" aria-label="Wykryj klawisz">⌨</button>
            <select data-scope="imc-map" data-k="key" data-id="${m.id}" aria-label="Klawisz">${geKeyOptions(m.key)}</select>
            <span class="ge-imc-chips">${open ? '' : chips}</span>
            <button type="button" class="ge-ue-btn" data-ge="imc-del" data-id="${m.id}" title="Usuń mapowanie klawisza" aria-label="Usuń mapowanie">🗑</button>
          </div>
          ${open ? `<div class="ge-ue-sub">${geInputStackHtml(m.id, m.triggers, 'trig')}${geInputStackHtml(m.id, m.modifiers, 'mod')}</div>` : ''}
        </div>`;
    }).join('');
    return `<div class="ge-imc-group">
        <div class="ge-imc-head">
          ${geSelect('imc-group', 'action', actionId, [['', '— wybierz Input Action —'], ...actions], `data-id="${geEsc(actionId)}" aria-label="Input Action"`)}
          ${action ? `<button type="button" class="ge-ue-btn" data-ge="open-bp" data-id="${action.id}" title="Otwórz ${geEsc(action.name)}" aria-label="Otwórz akcję">✎</button>` : ''}
          <span class="ge-imc-type">${geEsc(action ? geInputTypeLabel(action) : '')}</span>
          <button type="button" class="ge-ue-btn ge-ue-add" data-ge="imc-add-key" data-id="${geEsc(actionId)}" title="Dodaj klawisz tej akcji" aria-label="Dodaj klawisz">＋</button>
          <button type="button" class="ge-ue-btn" data-ge="imc-del-group" data-id="${geEsc(actionId)}" title="Usuń akcję z kontekstu (wszystkie jej klawisze)" aria-label="Usuń mapowania tej akcji">🗑</button>
        </div>${rows}
      </div>`;
  }).join('');
  return {
    view: `<div class="ge-ue-details">
      ${geCat('Mappings', `${geRow('Mappings', `<span class="ge-muted ge-ue-count">${maps.length} mapowań</span>
          <button type="button" class="ge-ue-btn ge-ue-add" data-ge="imc-add" title="Dodaj mapowanie akcji" aria-label="Dodaj mapowanie">＋</button>
          <button type="button" class="ge-ue-btn" data-ge="imc-clear" title="Usuń wszystkie mapowania" aria-label="Wyczyść mapowania">🗑</button>`)}
        <div class="ge-imc">${groups || '<p class="ge-empty">Brak mapowań — kliknij „＋”.</p>'}</div>`)}
    </div>`,
    details: `<p class="ge-det-note"><b>Input Mapping Context</b> to zestaw klawiszy dla akcji wejścia — np. osobny do chodzenia, a osobny do jazdy autem albo menu.</p>
      ${geCat('Jak używać', `<ol class="ge-steps">
        <li>„＋” przy <b>Mappings</b> — dodaj akcję i wybierz ją z listy (albo „🎮 Nowa Input Action…” na pasku).</li>
        <li>Wybierz klawisz z listy albo kliknij ⌨ i naciśnij klawisz. Kolejny klawisz tej samej akcji: „＋” przy akcji.</li>
        <li>Strzałka ▸ przy klawiszu rozwija jego Triggery i Modyfikatory. Dla A w ruchu w poziomie dodaj modyfikator <i>Negate</i>.</li>
        <li>Włącz kontekst: Ustawienia świata › Default Mapping Context${ge.project.settings.inputContext === bp.id ? ' <b>(ten jest już domyślny ✓)</b>' : ''} albo węzeł „Add Mapping Context” z priorytetem.</li></ol>`)}
      ${geOfKind('input_context').length > 1 ? '<p class="ge-hint">Gdy kilka włączonych kontekstów ma ten sam klawisz, działa ten o wyższym Priority (z węzła „Add Mapping Context”).</p>' : ''}`
  };
}

// Przycisk „⌨ Wykryj”: następny naciśnięty klawisz trafia do mapowania (Esc — anuluj).
function geListenKey(id) {
  const bp = geCurBp();
  geToast('Naciśnij klawisz… (Esc — anuluj)');
  const onKey = (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.removeEventListener('keydown', onKey, true);
    if (event.key === 'Escape') return;
    const key = GE_RT.keyName(event);
    const m = geMapping(bp, id);
    if (!key) geToast('Tego klawisza nie ma na liście — wybierz go z listy.');
    else if (m && geCurBp() === bp) geChange(() => { m.key = key; }, { only: ['details'] });
  };
  window.addEventListener('keydown', onKey, true);
}

// Nowa Input Action od razu zmapowana w otwartym kontekście (ten sam folder).
async function geNewInputActionFor(ctx) {
  const name = await geDialog({ title: GE_NEW_ASSET.input_action.title, text: GE_NEW_ASSET.input_action.text, input: GE_NEW_ASSET.input_action.name, buttons: [{ label: 'Utwórz', value: true, primary: true }, { label: 'Anuluj', value: null }] });
  if (!name?.trim()) return;
  geChange(() => {
    const a = geAddBlueprint(ge.project, geUniqueName(name.trim(), ge.project.blueprints.map((b) => b.name)), {}, 'input_action');
    a.folder = ctx.folder ?? null;
    geAddMapping(ctx, a.id);
    geLog(`Utworzono ${a.name} (Input Action) i dodano ją do ${ctx.name}. Wybierz klawisz.`);
  }, { only: ['details', 'tabs'] });
}

// Typ wartości akcji zmienia typ pinu „Action Value”, więc niepasujące kable znikają, a kod jest liczony na nowo.
function geSetInputValueType(bp, type) {
  geChange(() => {
    bp.inputAction.valueType = type;
    geAllBlueprints(ge.project).filter((b) => b.graph).forEach((b) => geGraphs(b).forEach((g) => geCleanLinks(b, g)));
    ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
  }, { only: ['details'] });
}

function geInputItemChange(bp, el, key, value) {
  const { what, owner } = el.dataset;
  const list = geInputList(bp, owner, what);
  const i = Number(el.dataset.i);
  if (!list?.[i]) return;
  geChange(() => {
    if (key === 'type') {
      list[i] = geInputItem(what, value);
      return;
    }
    const kind = (what === 'trig' ? GE_INPUT_TRIGGERS : GE_INPUT_MODIFIERS)[list[i].type]?.params.find(([id]) => id === key)?.[3];
    if (key === 'threshold') list[i].threshold = Math.min(1, Math.max(0, Number(value) || 0));
    else if (kind === 'bool') list[i][key] = !!value;
    else if (kind === 'action') list[i][key] = String(value);
    else list[i][key] = Math.max(0, Number(value) || 0);
  }, { only: ['details'] });
}

// ---------- Tekstury, Sprite'y, Animacje i Dźwięki ----------

const geTextureFrame = (tex) => (tex.texture.src ? { src: tex.texture.src, x: 0, y: 0, w: tex.texture.w, h: tex.texture.h } : null);
const geAssetBase = (bp) => bp.name.replace(/^(T|S|FB|SFX|BP)_/, '') || 'Zasob';
const geSpriteChoices = () => [...geOfKind('sprite'), ...geOfKind('animation')].map((b) => [b.id, `${GE_KINDS[geKind(b)].icon} ${b.name}`]);

// Szachownica pod obrazkami — widać, które piksele są przezroczyste.
function geChecker(ctx, x, y, w, h, size = 8) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#2e2e2e';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#3a3a3a';
  for (let iy = 0; iy * size < h; iy++) {
    for (let ix = iy % 2; ix * size < w; ix += 2) ctx.fillRect(x + ix * size, y + iy * size, size, size);
  }
  ctx.restore();
}

// Rysuje wycinek tekstury ({ src, x, y, w, h }) wpasowany w prostokąt, z zachowaniem proporcji.
// Powiększona pixel-art zostaje ostra. Zwraca false, gdy nie ma czego rysować.
function geDrawFrame(ctx, frame, x, y, w, h) {
  if (!frame?.src || !frame.w || !frame.h) return false;
  const s = Math.min(w / frame.w, h / frame.h);
  ctx.save();
  ctx.imageSmoothingEnabled = s < 1;
  GE_RT.drawShape(ctx, { shape: 'sprite', spriteData: { fps: 0, frames: [frame] }, x: x + w / 2, y: y + h / 2, w: frame.w * s, h: frame.h * s });
  ctx.restore();
  return true;
}

// Wysokości słupków „fali” dźwięku (0–1). Plik — prawdziwa głośność (liczona raz w tle), wbudowany — wzór z nazwy.
function geSoundPeaks(bp) {
  const s = bp.sound;
  const real = s.src ? geLoadPeaks(s.src) : null;
  const scale = 0.3 + 0.7 * Math.min(1, Math.max(0, Number(s.volume) || 0));
  if (real) return real.map((p) => p * scale);
  let r = [...(s.src ? bp.id : s.preset)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rnd = () => (r = (r * 1103515245 + 12345) >>> 0) / 2 ** 32;
  return Array.from({ length: 40 }, (_, i) => (0.25 + 0.75 * rnd()) * (1 - i / 40) ** 1.5 * scale);
}

function geLoadPeaks(src) {
  ge.wavePeaks = ge.wavePeaks || new Map();
  if (ge.wavePeaks.has(src)) return ge.wavePeaks.get(src);
  ge.wavePeaks.set(src, null);
  try {
    const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
    fetch(src).then((res) => res.arrayBuffer()).then((buf) => ac.decodeAudioData(buf)).then((audio) => {
      const data = audio.getChannelData(0);
      const n = 60;
      const step = Math.max(1, Math.floor(data.length / n));
      const peaks = Array.from({ length: n }, (_, i) => {
        let max = 0;
        for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j += 16) max = Math.max(max, Math.abs(data[j]));
        return max;
      });
      const top = Math.max(0.01, ...peaks);
      ge.wavePeaks.set(src, peaks.map((p) => p / top));
      if (!ge) return;
      if (ge.tab === 'level' && ge.drawer === 'content') geRenderDrawer();
      else if (geIsAssetTab()) geDrawAssetPreview();
    }).catch(() => {});
  } catch {
    // Bez podglądu fali — dźwięk i tak zagra.
  }
  return null;
}

function geDrawWave(ctx, bp, x, y, w, h) {
  const peaks = geSoundPeaks(bp);
  const bw = w / peaks.length;
  ctx.fillStyle = GE_KINDS.sound.color;
  peaks.forEach((p, i) => {
    const bh = Math.max(2, p * h);
    ctx.fillRect(x + i * bw + bw * 0.15, y + (h - bh) / 2, Math.max(1, bw * 0.7), bh);
  });
}

// Zasoby, które korzystają z zasobu id: sprite'y z tekstury, animacje ze sprite'a, klasy z kształtem
// Sprite / animacja oraz Blueprinty z węzłami „Set Flipbook” i „Play Sound 2D”.
function geAssetUsers(id) {
  const uses = (b) => b.sprite?.texture === id || b.flipbook?.frames.includes(id) || b.parent === id
    || b.widget?.elements.some((el) => el.type === 'widget' && el.widget === id)
    || (geKind(b) === 'actor' && b.defaults?.shape === 'sprite' && b.defaults.sprite === id)
    || (b.components ?? []).some((c) => c.type === 'sprite' && c.sprite === id)
    || (b.graph ? geGraphs(b) : []).some((g) => g.nodes.some((n) => (n.type === 'set_sprite' && n.props?.sprite === id) || (n.type === 'sound' && n.props?.sound === id)))
    || geZdUses(b, id);
  return geAllBlueprints(ge.project).filter((b) => b.id !== id && uses(b));
}

function geTextureHtml(bp) {
  const t = bp.texture;
  return {
    view: '<canvas class="ge-asset-canvas" width="880" height="500" aria-label="Podgląd tekstury"></canvas>',
    details: `<p class="ge-det-note"><b>Tekstura</b> to zaimportowany obrazek. Sama nie pojawia się w grze — zrób z niej <b>Sprite</b> (cały obrazek albo jego kawałek) albo podziel arkusz klatek na <b>Animację</b>.</p>
      ${geCat('Tekstura', geRow('Rozmiar', `<span class="ge-muted">${t.src ? `${t.w} × ${t.h} px` : 'brak obrazka'}</span>`))}
      ${geCat('Podział na klatki (arkusz sprite’ów)', geRow('Kolumny', geNum('texture', 'cols', t.cols ?? 1, 'int', 'min="1" max="64"'))
        + geRow('Wiersze', geNum('texture', 'rows', t.rows ?? 1, 'int', 'min="1" max="64"'))
        + '<p class="ge-hint">Siatka jest widoczna na podglądzie. „Podziel na klatki” zrobi z każdej niepustej kratki Sprite i złoży je po kolei w Animację.</p><div class="ge-det-actions"><button type="button" data-ge="tex-slice">🎞 Podziel na klatki</button></div>')}`
  };
}

function geSpriteHtml(bp) {
  const s = bp.sprite;
  const tex = geAsset(ge.project, s.texture, 'texture');
  const size = `<span class="ge-vec2"><label><i class="ge-ax">W</i>${geNum('sprite', 'w', s.w, 'int', 'min="1"')}</label><label><i class="ge-ax">H</i>${geNum('sprite', 'h', s.h, 'int', 'min="1"')}</label></span>`;
  return {
    view: '<canvas class="ge-asset-canvas ge-sprite-canvas" width="880" height="500" aria-label="Tekstura z zaznaczonym wycinkiem — przeciągnij myszą, żeby zaznaczyć nowy"></canvas>',
    details: `<p class="ge-det-note"><b>Sprite</b> to kawałek tekstury, który może być wyglądem aktora (Ustawienia klasy › Kształt: Sprite / animacja) albo klatką Animacji. <b>Przeciągnij myszą</b> po obrazku po lewej, żeby zaznaczyć wycinek.</p>
      ${geCat('Sprite', geRow('Tekstura', geSelect('sprite', 'texture', s.texture ?? '', [['', '— wybierz teksturę —'], ...geOfKind('texture').map((t) => [t.id, t.name])]))
        + (tex ? geRow('Położenie (px)', geVec2('sprite', 'x', 'y', s.x, s.y)) + geRow('Rozmiar (px)', size) + geRow('', '<button type="button" data-ge="sprite-full">Cały obrazek</button>')
          : '<p class="ge-hint">Wybierz teksturę. Nową dodasz przez „⤓ Importuj” w Przeglądarce zawartości.</p>'))}`
  };
}

function geFlipbookHtml(bp) {
  const fb = bp.flipbook;
  const last = fb.frames.length - 1;
  const frames = fb.frames.map((id, i) => `<div class="ge-fb-frame" data-i="${i}" title="${geEsc(geAsset(ge.project, id, 'sprite')?.name ?? '(usunięty sprite)')}">
      <canvas width="72" height="72"></canvas>
      <span class="ge-fb-num">${i + 1}</span>
      <span class="ge-fb-tools"><button type="button" class="ge-mini" data-ge="fb-move" data-i="${i}" data-v="-1" aria-label="Klatka ${i + 1} wcześniej"${i ? '' : ' disabled'}>‹</button><button type="button" class="ge-mini" data-ge="fb-del" data-i="${i}" aria-label="Usuń klatkę ${i + 1}">×</button><button type="button" class="ge-mini" data-ge="fb-move" data-i="${i}" data-v="1" aria-label="Klatka ${i + 1} później"${i < last ? '' : ' disabled'}>›</button></span>
    </div>`).join('');
  const sprites = geOfKind('sprite');
  return {
    view: `<div class="ge-anim-wrap"><canvas class="ge-anim-canvas" width="480" height="300" aria-label="Animacja"></canvas>
      <div class="ge-fb-strip" aria-label="Klatki animacji">${frames || '<p class="ge-empty">Brak klatek — dodaj sprite’y w Szczegółach.</p>'}</div></div>`,
    details: `<p class="ge-det-note"><b>Animacja (Flipbook)</b> pokazuje sprite'y po kolei, jak w kreskówce. Nałożysz ją w klasie (Ustawienia klasy › Kształt: Sprite / animacja) albo w grze węzłem „Set Flipbook” — np. inna animacja do biegu, a inna do skoku.</p>
      ${geCat('Odtwarzanie', geRow('Klatki na sekundę', geNum('flipbook', 'fps', fb.fps, 'float', 'min="0.5" max="60"'))
        + geRow('Zapętlona', geCheck('flipbook', 'loop', fb.loop), 'Bez zapętlenia animacja zatrzymuje się na ostatniej klatce (np. wybuch).')
        + geRow('Długość', `<span class="ge-muted">${fb.frames.length} klatek · ${(fb.frames.length / (fb.fps || 1)).toFixed(2)} s</span>`))}
      ${geCat('Dodaj klatkę', sprites.length
        ? `<div class="ge-fb-add"><select class="ge-fb-pick" aria-label="Sprite do dodania">${sprites.map((s) => `<option value="${s.id}">${geEsc(s.name)}</option>`).join('')}</select><button type="button" class="ge-mini" data-ge="fb-add">＋ Dodaj</button></div>`
        : '<p class="ge-hint">Brak sprite’ów. Zaimportuj obrazek i kliknij w nim „Utwórz Sprite” albo „Podziel na klatki”.</p>')}`
  };
}

function geSoundHtml(bp) {
  const s = bp.sound;
  const source = s.src
    ? geRow('Plik', `<span class="ge-muted">${geEsc(s.file || 'z dysku')}${s.duration ? ` · ${Number(s.duration).toFixed(2)} s` : ''}</span>`) + geRow('', '<button type="button" data-ge="snd-builtin">Użyj wbudowanego</button>')
    : geRow('Wbudowany', geSelect('sound', 'preset', s.preset, GE_SOUNDS)) + geRow('', '<button type="button" data-ge="asset-replace">⤓ Wczytaj plik…</button>');
  return {
    view: '<div class="ge-snd-wrap"><canvas class="ge-asset-canvas" width="880" height="260" aria-label="Kształt dźwięku"></canvas><button type="button" class="ge-snd-big" data-ge="snd-play" aria-label="Odtwórz dźwięk">▶</button></div>',
    details: `<p class="ge-det-note"><b>Dźwięk</b> z pliku (MP3, WAV, OGG) albo jeden z wbudowanych. W grze odtworzysz go węzłem „Play Sound 2D” — wybierz <b>${geEsc(bp.name)}</b> w ustawieniu węzła.</p>
      ${geCat('Dźwięk', source + geRow('Głośność', geNum('sound', 'volume', s.volume, 'float', 'min="0" max="1" step="0.05"'), '1 — pełna, 0.5 — połowa, 0 — cisza.'))}`
  };
}

function geDrawAssetPreview() {
  const bp = geCurBp();
  const kind = geKind(bp);
  if (kind === 'material') {
    geDrawMaterialPreview();
    return;
  }
  if (kind === 'animation') {
    ge.root.querySelectorAll('.ge-fb-frame').forEach((el) => {
      const canvas = el.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      geChecker(ctx, 0, 0, canvas.width, canvas.height, 6);
      const sprite = geAsset(ge.project, bp.flipbook.frames[Number(el.dataset.i)], 'sprite');
      geDrawFrame(ctx, sprite && geSpriteData(ge.project, sprite.id)?.frames[0], 4, 4, canvas.width - 8, canvas.height - 8);
    });
    return;
  }
  const canvas = ge.root.querySelector('.ge-asset-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (kind === 'sound') geDrawWave(ctx, bp, 24, 24, W - 48, H - 48);
  else if (kind === 'texture') geDrawTextureView(ctx, bp, W, H);
  else if (kind === 'sprite') geDrawSpriteView(ctx, bp, W, H);
}

const geNoImage = (ctx, W, H, text) => {
  ctx.fillStyle = '#8a8a8a';
  ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2);
};

function geDrawTextureView(ctx, bp, W, H) {
  const t = bp.texture;
  if (!t.src) {
    geNoImage(ctx, W, H, 'Brak obrazka — kliknij „Zamień obrazek…”.');
    return;
  }
  const s = Math.min((W - 48) / t.w, (H - 48) / t.h, 8);
  const ox = (W - t.w * s) / 2;
  const oy = (H - t.h * s) / 2;
  geChecker(ctx, ox, oy, t.w * s, t.h * s);
  geDrawFrame(ctx, geTextureFrame(bp), ox, oy, t.w * s, t.h * s);
  const cols = Math.max(1, t.cols ?? 1);
  const rows = Math.max(1, t.rows ?? 1);
  ctx.strokeStyle = 'rgba(255, 216, 74, 0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < cols; c++) {
    const x = Math.round(ox + Math.floor(t.w / cols) * c * s) + 0.5;
    ctx.moveTo(x, oy);
    ctx.lineTo(x, oy + t.h * s);
  }
  for (let r = 1; r < rows; r++) {
    const y = Math.round(oy + Math.floor(t.h / rows) * r * s) + 0.5;
    ctx.moveTo(ox, y);
    ctx.lineTo(ox + t.w * s, y);
  }
  ctx.stroke();
}

// Lewa część: cała tekstura z przyciemnieniem poza wycinkiem, prawa: sam wycinek w powiększeniu.
// ge.spriteMap zapamiętuje, gdzie leży tekstura, żeby przeciąganie myszą zaznaczało piksele.
function geDrawSpriteView(ctx, bp, W, H) {
  const tex = geAsset(ge.project, bp.sprite.texture, 'texture');
  ge.spriteMap = null;
  if (!tex?.texture.src) {
    geNoImage(ctx, W, H, 'Wybierz teksturę w Szczegółach.');
    return;
  }
  const t = tex.texture;
  const r = ge.spriteDrag?.id === bp.id ? ge.spriteDrag.rect : bp.sprite;
  const L = W * 0.6;
  const s = Math.min((L - 40) / t.w, (H - 40) / t.h, 8);
  const ox = (L - t.w * s) / 2;
  const oy = (H - t.h * s) / 2;
  ge.spriteMap = { ox, oy, s, tw: t.w, th: t.h };
  geChecker(ctx, ox, oy, t.w * s, t.h * s);
  geDrawFrame(ctx, geTextureFrame(tex), ox, oy, t.w * s, t.h * s);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.rect(ox, oy, t.w * s, t.h * s);
  ctx.rect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s);
  ctx.fill('evenodd');
  ctx.strokeStyle = '#ffa31a';
  ctx.lineWidth = 2;
  ctx.strokeRect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s);
  const px = L + 10;
  const pw = W - px - 20;
  geChecker(ctx, px, 40, pw, H - 80);
  geDrawFrame(ctx, { src: t.src, x: r.x, y: r.y, w: r.w, h: r.h }, px + 8, 48, pw - 16, H - 96);
  ctx.fillStyle = '#bbbbbb';
  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`Wynik: ${r.w} × ${r.h} px`, px + pw / 2, 34);
}

// Zaznaczanie wycinka sprite'a myszą na lewej części podglądu.
function geSpritePointer(event) {
  const map = ge.spriteMap;
  const bp = geCurBp();
  if (!map || geKind(bp) !== 'sprite') return;
  const canvas = event.currentTarget;
  const box = canvas.getBoundingClientRect();
  const tx = Math.min(map.tw, Math.max(0, Math.round(((event.clientX - box.left) * (canvas.width / box.width) - map.ox) / map.s)));
  const ty = Math.min(map.th, Math.max(0, Math.round(((event.clientY - box.top) * (canvas.height / box.height) - map.oy) / map.s)));
  if (event.type === 'pointerdown') {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    ge.spriteDrag = { id: bp.id, x0: tx, y0: ty, rect: { x: tx, y: ty, w: 0, h: 0 } };
    return;
  }
  const d = ge.spriteDrag;
  if (!d || d.id !== bp.id) return;
  d.rect = { x: Math.min(d.x0, tx), y: Math.min(d.y0, ty), w: Math.abs(tx - d.x0), h: Math.abs(ty - d.y0) };
  if (event.type === 'pointermove') {
    geDrawAssetPreview();
    return;
  }
  ge.spriteDrag = null;
  if (d.rect.w >= 1 && d.rect.h >= 1) geChange(() => Object.assign(bp.sprite, d.rect), { only: ['details'] });
  else geDrawAssetPreview();
}

// Podgląd animacji na żywo; pętla kończy się sama, gdy karta animacji zniknie.
function geStartAnimPreview() {
  cancelAnimationFrame(ge.animRaf);
  const start = performance.now();
  const step = (now) => {
    const canvas = ge.root.querySelector('.ge-anim-canvas');
    const bp = geCurBp();
    if (!canvas || geKind(bp) !== 'animation') return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    geChecker(ctx, 0, 0, W, H, 12);
    const data = geSpriteData(ge.project, bp.id);
    let i = -1;
    if (data) {
      const len = data.frames.length;
      const fps = Math.max(0.5, Number(data.fps) || 1);
      // Bez zapętlenia podgląd chwilę stoi na ostatniej klatce i zaczyna od nowa.
      const t = ((now - start) / 1000) % (data.loop ? Infinity : len / fps + 1);
      const n = Math.floor(t * fps);
      i = data.loop ? n % len : Math.min(n, len - 1);
      geDrawFrame(ctx, data.frames[i], 16, 16, W - 32, H - 32);
    } else geNoImage(ctx, W, H, 'Dodaj klatki — sprite’y z Przeglądarki zawartości.');
    ge.root.querySelectorAll('.ge-fb-frame').forEach((el) => el.classList.toggle('is-current', Number(el.dataset.i) === i));
    ge.animRaf = requestAnimationFrame(step);
  };
  ge.animRaf = requestAnimationFrame(step);
}

function geAddSprite(tex, rect, name) {
  const s = geAddBlueprint(ge.project, geUniqueName(name, ge.project.blueprints.map((b) => b.name)), {}, 'sprite');
  s.folder = tex.folder ?? null;
  Object.assign(s.sprite, { texture: tex.id, ...(rect ?? { x: 0, y: 0, w: tex.texture.w, h: tex.texture.h }) });
  return s;
}

function geSpriteFromTexture(tex) {
  if (!tex.texture.src) return;
  let sprite;
  geChange(() => {
    sprite = geAddSprite(tex, null, `S_${geAssetBase(tex)}`);
    ge.selTile = sprite.id;
  }, { only: ['details'] });
  geLog(`Utworzono ${sprite.name} z całej tekstury ${tex.name}. Kliknij go dwukrotnie w Przeglądarce zawartości, żeby wyciąć kawałek.`);
}

const geImageFromSrc = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// Arkusz sprite'ów → Sprite z każdej niepustej kratki siatki (kolumny × wiersze) i Animacja z nich wszystkich.
async function geSliceTexture(tex) {
  const t = tex.texture;
  if (!t.src) return;
  const cols = Math.max(1, t.cols ?? 1);
  const rows = Math.max(1, t.rows ?? 1);
  if (cols * rows === 1) {
    geDialog({ title: 'Podziel na klatki', text: 'Najpierw ustaw w Szczegółach liczbę <b>kolumn</b> i <b>wierszy</b> siatki — np. 4 × 1 dla czterech klatek obok siebie. Siatka pojawi się na podglądzie.', buttons: [{ label: 'OK', value: true, primary: true }] });
    return;
  }
  let cells = [];
  const cw = Math.floor(t.w / cols);
  const ch = Math.floor(t.h / rows);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = t.w;
    canvas.height = t.h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(await geImageFromSrc(t.src), 0, 0);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = ctx.getImageData(c * cw, r * ch, cw, ch).data;
        let filled = false;
        for (let i = 3; i < px.length && !filled; i += 4) filled = px[i] > 8;
        if (filled) cells.push({ x: c * cw, y: r * ch, w: cw, h: ch });
      }
    }
  } catch {
    cells = [];
  }
  if (!cells.length) {
    geLog(`Nie udało się podzielić ${tex.name} — wszystkie kratki są puste.`, 'warn');
    return;
  }
  const base = geAssetBase(tex);
  let anim;
  geChange(() => {
    const frames = cells.map((rect, i) => geAddSprite(tex, rect, `S_${base}_${i + 1}`).id);
    anim = geAddBlueprint(ge.project, geUniqueName(`FB_${base}`, ge.project.blueprints.map((b) => b.name)), {}, 'animation');
    anim.folder = tex.folder ?? null;
    anim.flipbook.frames = frames;
    ge.selTile = anim.id;
  }, { only: [] });
  geLog(`Podzielono ${tex.name} na ${cells.length} sprite'ów i złożono z nich animację ${anim.name}.`);
  geOpenTab(anim.id);
}

// Klasa Blueprint aktora, który wygląda jak tekstura (przez nowy Sprite), Sprite albo Animacja.
function geClassFromAsset(asset) {
  if (geKind(asset) === 'texture' && !asset.texture.src) return;
  let cls;
  geChange(() => {
    const look = geKind(asset) === 'texture' ? geAddSprite(asset, null, `S_${geAssetBase(asset)}`) : asset;
    const frame = geSpriteData(ge.project, look.id)?.frames[0];
    const side = Math.max(frame?.w || 64, frame?.h || 64);
    // Małą pixel-art powiększamy całkowitą skalą (żeby była ostra), dużą zmniejszamy do 128 px.
    const k = side < 48 ? Math.ceil(48 / side) : Math.min(1, 128 / side);
    cls = geAddBlueprint(ge.project, geUniqueName(`BP_${geAssetBase(asset)}`, ge.project.blueprints.map((b) => b.name)), {
      shape: 'sprite', sprite: look.id, w: Math.round((frame?.w || 64) * k), h: Math.round((frame?.h || 64) * k)
    });
    geLookToComponent(ge.project, cls);
    cls.folder = asset.folder ?? null;
    geAddDefaultEvents(cls);
    ge.selTile = cls.id;
    ge.dirty.add(cls.id);
  }, { only: ['details', 'tabs'] });
  geLog(`Utworzono klasę ${cls.name} wyglądającą jak ${asset.name}. Przeciągnij ją z Przeglądarki zawartości na Widok.`);
}

function geAudio() {
  ge.audioHolder = ge.audioHolder || {};
  return ge.audioHolder;
}

function geDefaultsHtml(bp) {
  const d = bp.defaults;
  const parent = geParentOf(ge.project, bp);
  const children = geOfKind('actor').filter((c) => c.parent === bp.id);
  const tsParent = parent ? null : geAsset(ge.project, bp.parent, 'tsclass');
  // Wygląd klasy budują komponenty, więc tu zostają kolizja, ruch, pola z klasy TypeScript i interfejsy.
  return `<p class="ge-det-note">Ustawienia klasy (Class Defaults) — wspólne dla wszystkich aktorów <b>${geEsc(bp.name)}</b>. Wygląd ustawisz w komponentach.</p>
    ${parent ? `<p class="ge-hint">Klasa nadrzędna: <b>${geEsc(parent.name)}</b> — z niej pochodzą odziedziczone zdarzenia, zmienne i komponenty. Kolizja i ruch poniżej należą do tej klasy.</p>
      <div class="ge-det-actions"><button type="button" data-ge="copy-parent-defaults">↺ Skopiuj ustawienia z ${geEsc(parent.name)}</button><button type="button" data-ge="open-bp" data-id="${parent.id}">✎ Otwórz ${geEsc(parent.name)}</button></div>` : ''}
    ${tsParent ? `<p class="ge-hint">Klasa nadrzędna: <b>🔷 ${geEsc(tsParent.ts.api?.className ?? tsParent.name)}</b> (TypeScript) — jej pola z @UPROPERTY są niżej, a metody z @UFUNCTION w menu grafu.</p>
      <div class="ge-det-actions"><button type="button" data-ge="open-ts" data-id="${tsParent.id}">🔷 Otwórz ${geEsc(tsParent.name)}</button></div>` : ''}
    ${children.length ? `<p class="ge-hint">Klasy podrzędne: ${children.map((c) => `<b>${geEsc(c.name)}</b>`).join(', ')}.</p>` : ''}
    <div class="ge-preview"><canvas width="200" height="120"></canvas></div>
    ${geTsDefaultsHtml(bp)}
    ${geCat('Kolizja', geRow('Kolizja', geSelect('defaults', 'collision', d.collision, GE_COLLISIONS)) + geRow('Szerokość', geNum('defaults', 'w', d.w)) + geRow('Wysokość', geNum('defaults', 'h', d.h)) + '<p class="ge-hint">Blokuje — nie da się przejść (podłoga, ściana). Nakłada się — da się przejść, ale włącza zdarzenie „Event ActorBeginOverlap” (moneta, meta, pułapka).</p>')}
    ${geCat('Ruch (Character Movement)', geRow('Grawitacja', geCheck('defaults', 'gravity', d.gravity), 'Aktor spada i może skakać (platformówka).') + geRow('Prędkość ruchu', geNum('defaults', 'moveSpeed', d.moveSpeed), 'Używana przez węzeł „Add Movement Input”. Piksele na sekundę.') + geRow('Siła skoku', geNum('defaults', 'jumpSpeed', d.jumpSpeed), 'Używana przez węzeł „Jump”.'))}
    ${geZdActorCat(bp)}
    ${ge.project.settings.playerController === bp.id ? geMouseInterfaceCat(d) : ''}
    ${geInterfacesCat(bp)}`;
}

// Mouse Interface — tylko w klasie wybranej jako Player Controller w Ustawieniach świata (jak w Unreal Engine).
// Brak wartości (starsze projekty) znaczy „włączone”, tak samo jak w game-runtime.js.
function geMouseInterfaceCat(d) {
  return geCat('Mouse Interface (Player Controller)',
    geRow('Show Mouse Cursor', geCheck('defaults', 'showMouseCursor', d.showMouseCursor !== false), 'Kursor myszy widać nad grą. Wyłącz w grach sterowanych klawiaturą albo z własnym celownikiem. W grze: „Set Show Mouse Cursor”.')
    + geRow('Enable Click Events', geCheck('defaults', 'enableClickEvents', d.enableClickEvents !== false), 'Aktorzy dostają zdarzenia „Event OnClicked” i „Event OnReleased”. W grze: „Set Enable Click Events”.')
    + geRow('Enable Mouse Over Events', geCheck('defaults', 'enableMouseOverEvents', d.enableMouseOverEvents !== false), 'Aktorzy dostają zdarzenia „Event ActorBeginCursorOver” i „Event ActorEndCursorOver”. W grze: „Set Enable Mouse Over Events”.')
    + geRow('Default Mouse Cursor', geSelect('defaults', 'defaultMouseCursor', d.defaultMouseCursor ?? 'Default', GE_CURSORS), 'Wygląd kursora na start gry. W grze: „Set Current Mouse Cursor”.'));
}

// Wartość kontenera jak w Unreal Engine: nagłówek „3 elementy tablicy ⊕ 🗑”, pod nim wiersze „Index [ 0 ]” z polem
// wartości i menu ▾ (Wstaw / Duplikuj / Usuń); w Map zamiast numeru jest pole klucza. scope „var” — wartość domyślna
// w Blueprincie, „actor-var” — wartość w aktorze na poziomie (przyciski data-ge="var-el" / "actor-var-el", data-op).
// path — miejsce kontenera w wartości, gdy jest polem Struktury (np. „f2” albo „0.f2”); trafia do data-axis przycisków.
function geVarContainerInput(scope, key, varType, varValue, extra, btnAttrs, label, path = '') {
  const c = geContainer(varType);
  const items = Array.isArray(varValue) ? varValue : [];
  const input = (type, value, rel) => {
    const at = path ? `${path}.${rel}` : rel;
    if (type === 'vector') return `<span class="ge-vec2"><label><i class="ge-ax ge-ax-x">X</i>${geNum(scope, key, value?.x ?? 0, 'float', `${extra} data-axis="${at}.x"`)}</label><label><i class="ge-ax ge-ax-y">Y</i>${geNum(scope, key, value?.y ?? 0, 'float', `${extra} data-axis="${at}.y"`)}</label></span>`;
    if (geTypeRef(type)?.prefix === 'struct') return geDataValueInput(scope, key, type, value, extra, at + '.');
    return geVarInput(scope, key, type, value, `${extra} data-axis="${at}"`);
  };
  const btn = (op, text, title, i = null) => `<button type="button" class="ge-arr-btn" data-ge="${scope}-el" data-op="${op}" ${btnAttrs}${path ? ` data-axis="${path}"` : ''}${i === null ? '' : ` data-v="${i}"`} title="${title}" aria-label="${title}">${text}</button>`;
  const noun = { array: ['element tablicy', 'elementy tablicy', 'elementów tablicy'], set: ['element zbioru', 'elementy zbioru', 'elementów zbioru'], map: ['para mapy', 'pary mapy', 'par mapy'] }[c.container];
  const n = items.length;
  const count = `${n} ${n === 1 ? noun[0] : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? noun[1] : noun[2]}`;
  const rows = items.map((item, i) => `<div class="ge-prop ge-arr-row">
      <span class="ge-prop-label">${c.container === 'map' ? input(c.elem, item?.[0], `${i}.0`) : `Index [ ${i} ]`}</span>
      <div class="ge-prop-value">${c.container === 'map' ? input(c.value, item?.[1], `${i}.1`) : input(c.elem, item, String(i))}${btn('menu', '▾', `Element ${i}: wstaw, duplikuj albo usuń`, i)}</div></div>`).join('');
  return `<div class="ge-prop ge-arr-head"><span class="ge-prop-label">${geTypeIcon(varType)}${geEsc(label)}</span>
      <div class="ge-prop-value"><span class="ge-arr-count">${count}</span>${btn('add', '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.6" /><path d="M7 4v6M4 7h6" /></svg>', 'Dodaj element')}${btn('clear', '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 3.5h9M5.5 3.5V2h3v1.5M3.8 3.5l.7 8.5h5l.7-8.5M6 5.8v4.4M8 5.8v4.4" /></svg>', 'Usuń wszystkie elementy')}</div></div>${rows}`;
}

// Nowa wartość kontenera po operacji z nagłówka albo z menu ▾ elementu i.
function geContainerEdit(value, type, op, i) {
  const c = geContainer(type);
  const items = Array.isArray(value) ? [...value] : [];
  const blank = () => (c.container === 'map' ? [geVarDefault(c.elem), geVarDefault(c.value)] : geVarDefault(c.elem));
  if (op === 'add') items.push(blank());
  else if (op === 'insert') items.splice(i, 0, blank());
  else if (op === 'dup') items.splice(i + 1, 0, JSON.parse(JSON.stringify(items[i] ?? blank())));
  else if (op === 'del') items.splice(i, 1);
  else if (op === 'clear') items.length = 0;
  return items;
}

// Operacja przycisku kontenera na całej wartości type; kontener w polu Struktury wskazuje data-axis przycisku.
function geContainerEditAt(value, type, btn, op) {
  const i = Number(btn.dataset.v);
  const path = btn.dataset.axis;
  if (!path) return geContainerEdit(value, type, op, i);
  const at = geValueAt(value, type, path);
  return geSetAt(value, type, path, geContainerEdit(at.value, at.type, op, i));
}

// Przycisk kontenera: ▾ otwiera menu elementu, pozostałe (add / clear) działają od razu.
function geContainerBtn(btn, apply) {
  if (btn.dataset.op === 'menu') geMenu(btn, [{ label: 'Wstaw przed', action: () => apply('insert') }, { label: 'Duplikuj', action: () => apply('dup') }, '-', { label: 'Usuń', action: () => apply('del') }]);
  else apply(btn.dataset.op);
}

// Przycisk wyboru typu jak w Unreal Engine: kolorowa ikona, nazwa typu i ▾ (otwiera listę z wyszukiwaniem).
const geTypeBtn = (ge_, id, type, title) => `<button type="button" class="ge-type-btn" data-ge="${ge_}" data-id="${id}" title="${geEsc(title)}">${geTypeIcon(type)}<span>${geEsc(geTypeShort(type))}</span><i class="ge-type-caret">▾</i></button>`;

// Lista typów: element (Set i klucz Map — tylko porównywane po wartości), kontener albo typ wartości Map.
// onPick(which, value) zapisuje wybór; except odrzuca typy (np. Strukturę w niej samej).
function geVarTypeMenu(btn, type, which, onPick, except = () => false) {
  const c = geContainer(type);
  const pick = (value) => () => onPick(which, value);
  if (which === 'container') {
    geMenu(btn, GE_CONTAINERS.map(([id, label]) => ({ label, icon: geTypeIcon(geContainerType(id, c.elem, c.value)), active: id === c.container, action: pick(id) })));
    return;
  }
  const current = which === 'valueType' ? c.value : c.elem;
  const keyOnly = which === 'type' && (c.container === 'set' || c.container === 'map');
  const types = geVarTypes(ge.project, (t) => except(t) || (keyOnly && !geHashable(t)));
  geMenu(btn, types.map((t) => ({ label: geType(t).label, icon: geTypeIcon(t), active: t === current, action: pick(t) })), { search: 'Szukaj typu' });
}

// Typ elementu ▾ i kontener ▾ obok siebie; prefix daje data-ge przycisków: <prefix>-type-pick i <prefix>-cont-pick.
function geContTypeRow(prefix, id, type) {
  const c = geContainer(type);
  return `<span class="ge-var-type">${geTypeBtn(`${prefix}-type-pick`, id, c.elem, geType(c.elem).label)}<button type="button" class="ge-type-btn ge-cont-btn" data-ge="${prefix}-cont-pick" data-id="${id}" title="Kontener: ${geEsc(GE_CONTAINERS.find(([cid]) => cid === c.container)[1])}">${geTypeIcon(type)}<i class="ge-type-caret">▾</i></button></span>`;
}

function geVarDetailsHtml(bp, v) {
  const extra = `data-id="${v.id}"`;
  const canEdit = bp.id !== 'level';
  const c = geContainer(v.type);
  const typeRow = geContTypeRow('var', v.id, v.type);
  const hints = {
    array: 'Tablica (Array) — lista elementów po kolei, numerowanych od 0. Węzły For Each Loop, Length i Get dopasują się do jej typu.',
    set: 'Zbiór (Set) — elementy bez powtórzeń i bez kolejności (powtórzone wartości liczą się raz). W kodzie: new Set().',
    map: 'Mapa (Map) — pary klucz → wartość, każdy klucz najwyżej raz (przy powtórce wygrywa ostatni). W kodzie: new Map().'
  };
  return geCat('Zmienna', geRow('Nazwa', geText('var', 'name', v.name, extra))
      + geRow(c.container === 'map' ? 'Typ klucza' : 'Typ', typeRow, 'Typ zmiennej i kontener (Single / Array / Set / Map) — jak w Unreal Engine.')
      + (c.container === 'map' ? geRow('Typ wartości', `<span class="ge-var-type">${geTypeBtn('var-vtype-pick', v.id, c.value, geType(c.value).label)}</span>`) : '')
      + (canEdit ? geRow('Instance Editable', geCheck('var', 'editable', v.editable, extra), 'Każdy aktor na poziomie może mieć inną wartość — ustawisz ją w Szczegółach aktora.') : '')
      + (hints[c.container] ? `<p class="ge-hint">${hints[c.container]}</p>` : ''))
    + geCat('Wartość domyślna', c.container === 'single' ? geRow(v.name, geVarInput('var', 'value', v.type, v.value, extra)) : geVarContainerInput('var', 'value', v.type, v.value, extra, extra, v.name))
    + `<p class="ge-hint">W kodzie: <code>this.vars.${geEsc(GE_RT.ident(v.name))}</code></p>
      <div class="ge-det-actions"><button type="button" class="ge-danger" data-ge="del-var" data-id="${v.id}">Usuń zmienną</button></div>`;
}

function geNodeDetailsHtml(n, bp) {
  if (n.type === 'comment') {
    return geCat('Komentarz', geRow('Tekst', geText('comment', 'text', n.text, `data-node="${n.id}"`)) + geRow('Kolor', geSelect('comment', 'color', n.color, GE_COMMENT_COLORS, `data-node="${n.id}"`)));
  }
  const def = GE_NODES[n.type];
  if (!def) return '<p class="ge-det-note">Nieznany węzeł.</p>';
  const pins = gePins(n, bp);
  const pinRow = (p, dir) => `<div class="ge-pin-info"><span class="ge-pill" style="--pc:${geType(p.type).color}"></span><span>${geEsc(p.name || (p.type === 'exec' ? (dir === 'in' ? 'wejście' : 'dalej') : 'wynik'))}</span><small>${dir === 'in' ? 'wejście' : 'wyjście'} · ${geEsc(geTypeShort(p.type))}</small></div>`;
  return `<div class="ge-det-node ge-k-${def.kind}"><span class="ge-det-kind">${def.icon ?? GE_KIND_ICON[def.kind]}</span><div><b>${geEsc(geNodeTitle(n, bp))}</b><small>${geEsc(def.pl)} · ${geEsc(def.cat)}</small></div></div>
    ${def.desc ? `<p class="ge-det-desc">${geEsc(def.desc)}</p>` : ''}
    ${def.props?.length ? geCat('Ustawienia węzła', def.props.map((p) => geRow(p.name, gePropHtml(n, p))).join('')) : ''}
    ${geCat('Piny', pins.ins.map((p) => pinRow(p, 'in')).join('') + pins.outs.map((p) => pinRow(p, 'out')).join(''))}`;
}

// ---------- Kompilacja i podgląd kodu ----------

function geCompileAll() {
  const out = geCompileProject(ge.project);
  out.results.forEach((result, id) => {
    ge.lastCompile[id] = result;
  });
  ge.dirty.clear();
  return out;
}

function geCompile() {
  const out = geCompileAll();
  geCodeBlueprints(ge.project).forEach((bp) => {
    const r = out.results.get(bp.id);
    if (r.errors.length) geLog(`Kompilacja ${bp.name}: ${r.errors.length} błąd(ów).`, 'error');
  });
  geLevels(ge.project).forEach((l) => {
    const r = out.results.get('level:' + l.id);
    if (r?.errors.length) geLog(`Kompilacja Level Blueprint poziomu ${l.name}: ${r.errors.length} błąd(ów).`, 'error');
  });
  if (!out.errorCount) geLog('Kompilacja zakończona — bez błędów.');
  if (ge.tab !== 'level') {
    geRenderGraph();
    geRefreshCode();
    geRenderResults();
  }
  return out;
}

function geRefreshCode() {
  const bp = geCurBp();
  if (!bp) return;
  const btn = ge.root.querySelector('.ge-compile');
  if (btn) {
    const r = ge.lastCompile[bp.id];
    const state = ge.dirty.has(bp.id) || !r ? 'dirty' : r.errors.length ? 'error' : r.warnings.length ? 'warning' : 'ok';
    btn.dataset.state = state;
    btn.title = { dirty: 'Blueprint zmieniony — skompiluj (F7)', error: 'Błędy kompilacji', warning: 'Skompilowano z ostrzeżeniami', ok: 'Skompilowano bez błędów' }[state];
  }
  const pre = ge.root.querySelector('.ge-code-body');
  if (pre && ge.codeOpen) {
    const live = geCompileBlueprint(ge.project, bp, geNames(ge.project));
    pre.innerHTML = geHighlight(live.code);
  }
  geRenderResults();
}

function geRenderResults() {
  const body = ge.root.querySelector('.ge-results-body');
  const bp = geCurBp();
  if (!body || !bp) return;
  const r = ge.lastCompile[bp.id];
  if (!r || ge.dirty.has(bp.id)) {
    body.innerHTML = '<p class="ge-result ge-result-info">Kliknij <b>Kompiluj</b> (F7), żeby sprawdzić Blueprint. Kod TypeScript po prawej zmienia się na żywo.</p>';
    return;
  }
  const rows = [
    ...r.errors.map((e) => ['error', '✖', e]),
    ...r.warnings.map((w) => ['warning', '⚠', w])
  ];
  body.innerHTML = rows.map(([level, icon, item]) => {
    const target = item.node ? ` data-ge="focus-node" data-id="${item.node}" tabindex="0"` : '';
    return `<p class="ge-result ge-result-${level}"${target}>${icon} ${geEsc(item.msg)}</p>`;
  }).join('') || `<p class="ge-result ge-result-ok">✔ Kompilacja ${geEsc(bp.name)} zakończona sukcesem.</p>`;
}

function geHighlight(code) {
  const re = /(\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\b(class|extends|const|let|if|else|for|return|new|this|true|false|null|super|constructor|static|number|string|boolean|void|any|interface|type)\b|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)(?=\()/g;
  let html = '';
  let last = 0;
  code.replace(re, (match, comment, str, keyword, num, fn, index) => {
    const kind = comment ? 'com' : str ? 'str' : keyword ? 'kw' : num ? 'num' : 'fn';
    html += geEsc(code.slice(last, index)) + `<span class="ge-c-${kind}">${geEsc(match)}</span>`;
    last = index + match.length;
    return match;
  });
  return html + geEsc(code.slice(last));
}

// ---------- Poziomy ----------

// Otwiera inny poziom w edytorze (dane obecnego zostają w jego wpisie na liście poziomów).
function geOpenLevel(id) {
  if (id === ge.project.levelId || !geLevels(ge.project).some((l) => l.id === id)) return;
  geStopPlay();
  geSwitchLevel(ge.project, id);
  geAfterLevelChange(`🗺️ Otwarto poziom „${geLevelName()}”.`);
}

function geAfterLevelChange(msg) {
  ge.selActor = null;
  ge.nodeSel.clear();
  ge.bpPanel = null;
  ge.preview = null;
  ge.dirty.add('level');
  delete ge.lastCompile.level;
  geScheduleSave();
  geRender();
  if (msg) geLog(msg);
}

async function geNewLevel() {
  const taken = geLevels(ge.project).map((l) => l.name);
  let n = taken.length + 1;
  while (taken.includes('Poziom' + n)) n++;
  const answer = await geDialog({
    title: 'Nowy poziom',
    text: 'Gra przejdzie na ten poziom po węźle <b>Open Level (by Name)</b> z jego nazwą (np. gdy gracz dotknie mety).',
    input: 'Poziom' + n,
    select: { label: 'Zawartość', options: [['empty', 'Pusty poziom'], ['copy', `Kopia poziomu ${geLevelName()}`]], value: 'empty' },
    buttons: [{ label: 'Utwórz', value: true, primary: true }, { label: 'Anuluj', value: null }]
  });
  const name = answer?.text?.trim();
  if (!name) return;
  if (taken.includes(name)) {
    geLog(`Poziom „${name}” już jest — wybierz inną nazwę.`, 'warn');
    return;
  }
  geStopPlay();
  geSnapshot();
  const lvl = geAddLevel(ge.project, name, answer.select === 'copy' ? geCurLevel(ge.project) : null);
  geSwitchLevel(ge.project, lvl.id);
  geAfterLevelChange(`🗺️ Nowy poziom „${name}”. Przejdziesz na niego węzłem „Open Level (by Name)” z Level Name = ${name}.`);
}

// Zmiana nazwy poprawia też węzły „Open Level”, które wskazywały ten poziom.
async function geRenameLevel() {
  const lvl = geCurLevel(ge.project);
  const name = (await geDialog({
    title: 'Nazwa poziomu',
    text: 'Węzły „Open Level” z dotychczasową nazwą dostaną nową.',
    input: lvl.name,
    buttons: [{ label: 'Zmień', value: true, primary: true }, { label: 'Anuluj', value: null }]
  }))?.trim();
  if (!name || name === lvl.name) return;
  if (geLevels(ge.project).some((l) => l.name === name)) {
    geLog(`Poziom „${name}” już jest — wybierz inną nazwę.`, 'warn');
    return;
  }
  const old = lvl.name;
  geSnapshot();
  lvl.name = name;
  const bps = [...geAllBlueprints(ge.project), ...geLevels(ge.project).filter((l) => l.id !== ge.project.levelId).map((l) => l.level)];
  bps.forEach((bp) => [bp.graph, bp.construction, ...(bp.funcs ?? []).map((f) => f.graph)].forEach((g) => g?.nodes.forEach((node) => {
    if (node.type === 'open_level' && String(node.values?.level ?? 'Poziom2') === old) node.values.level = name;
  })));
  ge.dirty = new Set(geAllBlueprints(ge.project).map((bp) => bp.id));
  ge.preview = null;
  geScheduleSave();
  geRender();
  geLog(`✎ Poziom „${old}” nazywa się teraz „${name}”.`);
}

function geSetStartLevel() {
  const lvl = geCurLevel(ge.project);
  geChange(() => {
    ge.project.levels = [lvl, ...ge.project.levels.filter((l) => l !== lvl)];
  }, { only: [] });
  geLog(`⭐ Wyeksportowana gra zacznie się od poziomu „${lvl.name}”.`);
}

async function geDeleteLevel() {
  const levels = geLevels(ge.project);
  const lvl = geCurLevel(ge.project);
  if (levels.length < 2 || !lvl) return;
  const ok = await geDialog({
    title: `Usunąć poziom ${lvl.name}?`,
    text: `Zniknie razem z aktorami (${ge.project.actors.length}) i swoim Level Blueprintem. Ctrl+Z cofa.`,
    buttons: [{ label: 'Usuń', value: true, primary: true }, { label: 'Anuluj', value: false }]
  });
  if (!ok) return;
  geStopPlay();
  geSnapshot();
  const i = levels.indexOf(lvl);
  geSwitchLevel(ge.project, (levels[i + 1] ?? levels[i - 1]).id);
  ge.project.levels = ge.project.levels.filter((l) => l !== lvl);
  geAfterLevelChange(`🗑 Usunięto poziom „${lvl.name}”. Otwarty jest „${geLevelName()}”.`);
}

// ---------- Granie i eksport ----------

// Pierwszy zasób z błędami: { name, open } — open pokazuje go (Level Blueprint innego poziomu najpierw otwiera ten poziom).
function geFirstBroken(out) {
  const bp = geCodeBlueprints(ge.project).find((b) => out.results.get(b.id).errors.length);
  if (bp) return { name: bp.name, open: () => ge.tab !== geTabFor(bp.id) && geOpenTab(geTabFor(bp.id)) };
  const lvl = geLevels(ge.project).find((l) => out.results.get('level:' + l.id)?.errors.length);
  return { name: `Level Blueprint poziomu ${lvl.name}`, open: () => {
    geOpenLevel(lvl.id);
    geOpenTab('level-bp');
  } };
}

// at — punkt świata z „Uruchom tutaj”: gracz (Default Pawn) zaczyna wtedy w nim, a nie w Miejscu startu.
function gePlay(at = null) {
  if (ge.playing) return;
  if (at && !geBp(ge.project.settings.defaultPawn)) geLog('„Uruchom tutaj” potrzebuje Default Pawn w Ustawieniach świata — bez niego gra startuje jak zwykle.', 'warn');
  const out = geCompile();
  if (out.errorCount) {
    const bad = geFirstBroken(out);
    geLog(`Nie można zagrać: ${bad.name} ma błędy (zaznaczone na czerwono).`, 'error');
    bad.open();
    return;
  }
  let program;
  try {
    // W edytorze gra działa z breakpointami; eksport i podgląd kodu używają zwykłej kompilacji.
    program = new Function('runtime', geCompileProject(ge.project, { debug: true }).code);
  } catch (err) {
    geLog('Błąd w wygenerowanym kodzie: ' + err.message, 'error');
    return;
  }
  if (ge.tab !== 'level') geOpenTab('level');
  const vp = ge.root.querySelector('.ge-viewport');
  const canvas = document.createElement('canvas');
  canvas.className = 'ge-game';
  vp.append(canvas);
  ge.root.classList.add('is-playing');
  try {
    const data = JSON.parse(JSON.stringify(geGameData(ge.project)));
    if (at) data.settings.playFrom = { x: Math.round(at.x), y: Math.round(at.y) };
    ge.playing = new GE_RT.Game(data, program, canvas, {
      onPrint: (text) => geLog('LogBlueprintUserMessages: ' + text, 'print'),
      onError: (text) => geLog(text, 'error'),
      onBreak: geShowBreak
    });
    ge.lastBreak = null;
    ge.playing.start();
  } catch (err) {
    geLog('Gra nie wystartowała: ' + err.message, 'error');
    canvas.remove();
    ge.playing = null;
    ge.root.classList.remove('is-playing');
    return;
  }
  vp.focus({ preventScroll: true });
  geLog('▶ Gra w edytorze wystartowała. Esc — koniec.');
}

function geStopPlay() {
  if (!ge?.playing) return;
  ge.playing.stop();
  ge.playing.canvas.remove();
  ge.root.querySelector('.ge-debug')?.remove();
  ge.playing = null;
  ge.root.classList.remove('is-playing');
  geLog('■ Koniec gry.');
  geDrawViewport();
}

function geSlug() {
  return GE_RT.ident(ge.project.name).toLowerCase().replace(/_/g, '-') || 'gra';
}

function geDownload(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Cała gra w jednym pliku HTML: dane poziomu, silnik (kod funkcji geCreateRuntime) i kod z Blueprintów.
function geBuildGameHtml() {
  const out = geCompile();
  if (out.errorCount) {
    const bad = geFirstBroken(out);
    geLog(`Eksport przerwany: ${bad.name} ma błędy.`, 'error');
    bad.open();
    return null;
  }
  const p = ge.project;
  const data = geGameData(p);
  // Wyeksportowana gra zaczyna się od poziomu startowego (pierwszego na liście), a nie od otwartego w edytorze.
  data.levelId = geLevels(p)[0]?.id ?? data.levelId;
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const runtime = geCreateRuntime.toString().replace(/<\/script/gi, '<\\/script');
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${geEsc(p.name)}</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  canvas { display: block; width: 100vw; height: 100vh; object-fit: contain; touch-action: none; outline: none; }
</style>
</head>
<body>
<canvas id="game" tabindex="0" aria-label="${geEsc(p.name)}"></canvas>
<script>
// ${p.name.replace(/[\r\n]/g, ' ')} — gra zrobiona w JSGame Engine (Informatyczna Przygoda).

// Dane poziomu: ustawienia, klasy Blueprint (wygląd, kolizja) i aktorzy.
const PROJECT = ${json};

// Silnik gry 2D.
const RUNTIME = (${runtime})();

// Logika gry — kod wygenerowany z Blueprintów.
function PROGRAM(runtime) {
${geIndent(out.code)}
}

const canvas = document.getElementById('game');
new RUNTIME.Game(PROJECT, PROGRAM, canvas).start();
canvas.focus();
</script>
</body>
</html>
`;
}

function geExport() {
  const html = geBuildGameHtml();
  if (!html) return;
  const file = `${geSlug()}.html`;
  geDownload(file, html, 'text/html');
  geLog(`🌐 Wyeksportowano grę: ${file}. Otwórz plik w przeglądarce albo wrzuć go na dowolny hosting stron.`);
  geDialog({
    title: 'Gra wyeksportowana 🎉',
    text: `Plik <b>${geEsc(file)}</b> jest w Pobranych. To kompletna gra w jednym pliku: otwórz go w przeglądarce (działa bez internetu) albo wrzuć na stronę WWW, np. GitHub Pages lub itch.io.`,
    buttons: [{ label: 'Super!', value: true, primary: true }]
  });
}

function gePlayInTab() {
  const html = geBuildGameHtml();
  if (!html) return;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function geSaveFile() {
  if (geProjectNative()) {
    if (!ge.projectFile) {
      geSaveProjectAs();
      return;
    }
    geSaveNow();
    geLog(`💾 Zapisano projekt w folderze ${ge.projectDir}.`);
    return;
  }
  geSaveNow();
  const file = `${geSlug()}.json`;
  geDownload(file, JSON.stringify(ge.project, null, 1), 'application/json');
  geLog(`💾 Zapisano projekt do pliku ${file}. Otworzysz go przez Plik › Otwórz projekt.`);
}

function geOpenProjectFile(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  file.text().then((text) => {
    const data = JSON.parse(text);
    // Animacja z Web Pivot Animatora to nie projekt — dodajemy ją do obecnego projektu.
    if (data?.format === 'jsgame-animation') {
      geImportAnimationFile(file);
      return;
    }
    const project = geNormalizeProject(data);
    geReplaceProject(project);
    geLog(`📂 Otwarto projekt „${project.name}”. Poprzedni możesz przywrócić przez Ctrl+Z.`);
  }).catch((err) => {
    geDialog({ title: 'Nie udało się otworzyć', text: geEsc(err.message || 'Plik jest uszkodzony.'), buttons: [{ label: 'OK', value: true, primary: true }] });
  });
}

// place — { file, dir } folderu projektu (aplikacja desktopowa); bez niego projekt nie ma folderu.
// W aplikacji poprzedni projekt zostaje zapisany na dysku, więc nie da się do niego wrócić przez Ctrl+Z.
function geReplaceProject(project, place = null) {
  geStopPlay();
  const native = geProjectNative();
  if (native) geSaveNow();
  geSnapshot();
  if (native) {
    ge.undo = [];
    ge.redo = [];
    geHistoryAssets.ids.clear();
    geHistoryAssets.list.length = 0;
  }
  ge.project = project;
  ge.projectFile = place?.file ?? null;
  ge.projectDir = place?.dir ?? null;
  ge.tabs = ['level'];
  ge.tab = 'level';
  ge.selActor = null;
  ge.view = null;
  ge.graphViews = {};
  ge.bpViews = {};
  ge.lastCompile = {};
  ge.dirty = new Set(geAllBlueprints(project).map((bp) => bp.id));
  gePreloadImages();
  geScheduleSave();
  geRender();
}

async function geNewProjectDialog() {
  const native = geProjectNative();
  const choice = await geDialog({
    title: 'Nowy projekt',
    text: native
      ? 'Projekt powstanie w osobnym folderze — za chwilę wybierzesz, gdzie go utworzyć. Obrazki i dźwięki trafią do niego jako pliki (Content), a klasy TypeScript — do Scripts. Obecny projekt zostanie zapisany w swoim folderze.'
      : 'Obecny projekt zostanie zastąpiony (możesz go przywrócić przez Ctrl+Z albo wcześniej zapisać do pliku).',
    choices: GE_TEMPLATES.map((t) => ({ value: t.id, icon: t.icon, title: t.title, text: t.text })),
    buttons: [{ label: 'Anuluj', value: null }],
    wide: true
  });
  const template = GE_TEMPLATES.find((t) => t.id === choice);
  if (!template) return;
  const project = geMigrateProject(template.make());
  let place = null;
  if (native) {
    const name = await geDialog({ title: 'Nazwa projektu', text: 'Tak będzie się nazywał folder projektu i gra.', input: project.name, buttons: [{ label: 'Dalej — wybierz miejsce', value: true, primary: true }, { label: 'Anuluj', value: null }] });
    if (!name?.trim()) return;
    project.name = name.trim();
    place = await native.create(project.name);
    if (!place) return;
    if (place.error) {
      geDialog({ title: 'Nie udało się utworzyć folderu', text: geEsc(place.error), buttons: [{ label: 'OK', value: true, primary: true }] });
      return;
    }
  }
  geReplaceProject(project, place);
  if (place) geSaveNow();
  geLog((choice === 'empty' ? 'Nowy pusty projekt. Zacznij od „＋ Dodaj” w Przeglądarce zawartości.' : `Nowy projekt z szablonu „${template.title}”. Kliknij ▶ (Graj), a potem zajrzyj do Blueprintów.`) + (place ? ` Folder projektu: ${place.dir}` : ''));
}

// Projekt bez folderu (np. pierwszy przykład albo stary plik .json) dostaje folder — jak przy tworzeniu projektu.
async function geSaveProjectAs() {
  const native = geProjectNative();
  const place = await native.create(ge.project.name);
  if (!place) return;
  if (place.error) {
    geDialog({ title: 'Nie udało się utworzyć folderu', text: geEsc(place.error), buttons: [{ label: 'OK', value: true, primary: true }] });
    return;
  }
  ge.projectFile = place.file;
  ge.projectDir = place.dir;
  geSaveNow();
  geShowProjectName();
  geLog(`💾 Zapisano projekt w nowym folderze ${place.dir}. Obrazki i dźwięki są w Content, klasy TypeScript — w Scripts.`);
}

// Plik › Otwórz projekt: w aplikacji okno wyboru pliku .jsgame (albo starego .json), w przeglądarce — pole pliku.
async function geOpenProject() {
  const native = geProjectNative();
  if (!native) {
    ge.root.querySelector('.ge-file').click();
    return;
  }
  const res = await native.open();
  if (!res) return;
  try {
    if (res.error) throw new Error(res.error);
    const data = JSON.parse(res.text);
    if (data?.format === 'jsgame-animation') {
      geImportAnimationFile({ name: res.name }, ge.cbFolder, data);
      return;
    }
    const project = geNormalizeProject(data);
    geReplaceProject(project, res.file ? { file: res.file, dir: res.dir } : null);
    geLog(res.file
      ? `📂 Otwarto projekt „${project.name}” z folderu ${res.dir}.`
      : `📂 Otwarto projekt „${project.name}” z pliku .json. Zapisz go (Ctrl+S), żeby wybrać mu folder na zasoby.`);
    if (res.missing.length) geLog(`Brakuje plików zasobów: ${res.missing.join(', ')}.`, 'warn');
  } catch (err) {
    geDialog({ title: 'Nie udało się otworzyć', text: geEsc(err.message || 'Plik jest uszkodzony.'), buttons: [{ label: 'OK', value: true, primary: true }] });
  }
}

const GE_NEW_ASSET = {
  actor: {
    title: 'Nowa klasa Blueprint', name: 'BP_NowyAktor',
    text: 'Aktor to coś, co stoi na poziomie (gracz, moneta, ściana). Podaj nazwę (zwyczajowo z przedrostkiem BP_) i klasę nadrzędną — <b>Actor</b> to klasa od zera, a wybrana klasa Blueprint daje na start jej zdarzenia, zmienne i komponenty.',
    done: 'Przeciągnij go na Widok albo kliknij dwukrotnie, żeby zaprogramować.'
  },
  widget: {
    title: 'Nowy Widget Blueprint', name: 'WBP_NowyWidget',
    text: 'Klasa nadrzędna: <b>User Widget</b> — napisy, przyciski i panele na ekranie gry (menu, wynik, ekran końca gry). Podaj nazwę (zwyczajowo z przedrostkiem WBP_).',
    done: 'Kliknij dwukrotnie, żeby ułożyć elementy w Projektancie. W grze pokażesz go węzłami „Create Widget” i „Add to Viewport”.'
  },
  interface: {
    title: 'Nowy Blueprint Interface', name: 'BPI_NowyInterfejs',
    text: 'Interfejs to lista funkcji, które różne klasy wykonują po swojemu (np. „Interact” dla drzwi i skrzyni). Podaj nazwę (zwyczajowo z przedrostkiem BPI_).',
    done: 'Dodaj w nim funkcje, a potem zaznacz go w klasie: Ustawienia klasy › Interfejsy.'
  },
  material: {
    title: 'Nowy materiał', name: 'M_NowyMaterial',
    text: 'Materiał określa wygląd aktora: kolor, krycie i poświatę. Podaj nazwę (zwyczajowo z przedrostkiem M_).',
    done: 'Nałożysz go w klasie węzłem „Set Material”.'
  },
  sprite: {
    title: 'Nowy Sprite', name: 'S_NowySprite',
    text: 'Sprite to kawałek tekstury (obrazka) — wygląd aktora albo klatka animacji. Podaj nazwę (zwyczajowo z przedrostkiem S_).',
    done: 'Kliknij go dwukrotnie, wybierz teksturę i zaznacz myszą wycinek.'
  },
  animation: {
    title: 'Nowa animacja (Flipbook)', name: 'FB_NowaAnimacja',
    text: 'Animacja pokazuje sprite’y po kolei, np. bieg albo machanie skrzydłami. Podaj nazwę (zwyczajowo z przedrostkiem FB_).',
    done: 'Kliknij ją dwukrotnie i dodaj klatki. Szybciej: otwórz teksturę-arkusz i kliknij „Podziel na klatki”.'
  },
  sound: {
    title: 'Nowy dźwięk', name: 'SFX_NowyDzwiek',
    text: 'Dźwięk z pliku albo wbudowany (moneta, skok, wybuch…). Podaj nazwę (zwyczajowo z przedrostkiem SFX_). Plik wczytasz potem albo od razu przez „⤓ Importuj”.',
    done: 'Odtworzysz go w grze węzłem „Play Sound 2D”.'
  },
  input_action: {
    title: 'Nowa Input Action', name: 'IA_NowaAkcja',
    text: 'Input Action to coś, co gracz chce zrobić — np. <i>Skok</i> albo <i>Ruch</i> — bez względu na klawisz. Podaj nazwę (zwyczajowo z przedrostkiem IA_).',
    done: 'Ustaw Value Type, a klawisze przypisz w Input Mapping Context.'
  },
  input_context: {
    title: 'Nowy Input Mapping Context', name: 'IMC_NowyKontekst',
    text: 'Input Mapping Context to zestaw klawiszy przypisanych do akcji wejścia (Input Action). Podaj nazwę (zwyczajowo z przedrostkiem IMC_).',
    done: 'Kliknij go dwukrotnie i dodaj mapowania. Włączysz go w Ustawieniach świata › Default Mapping Context albo węzłem „Add Mapping Context”.'
  }
};

// Pozycje menu „＋ Dodaj” — wszystkie rodzaje zasobów Przeglądarki zawartości. Tekstura powstaje tylko z pliku.
// Za Animacją — Animacja z nagrania wideo (rotoskopia, game-rotoscope.js).
const geNewAssetItems = () => Object.entries(GE_KINDS).flatMap(([kind, k]) => (kind === 'texture'
  ? [{ label: `${k.icon} ${k.label} — importuj plik…`, action: () => geAskImport() }]
  : [{ label: `${k.icon} ${k.label}…`, action: () => geNewBlueprint(kind) },
    ...(kind === 'animation' ? [{ label: '🎬 Animacja z wideo (rotoskopia)…', action: () => geRotoAskVideo() }] : [])]));

function geAskImport(target = null) {
  ge.assetTarget = target;
  ge.root.querySelector('.ge-asset-file').click();
}

// parentId — klasa nadrzędna wybrana na start (np. „Utwórz klasę podrzędną” w Przeglądarce zawartości).
async function geNewBlueprint(kind = 'actor', parentId = null) {
  const info = GE_NEW_ASSET[kind] ?? GE_DATA_NEW_ASSET[kind];
  const parents = kind === 'actor' ? geParentChoices(null) : [];
  // Klasa aktora: wybór klasy nadrzędnej (Blueprint albo klasa TypeScript); inne rodzaje mogą mieć własny wybór (info.select).
  const select = parents.length ? { label: 'Klasa nadrzędna', value: parentId ?? '', options: [['', 'Actor (od zera)'], ...parents.map((c) => [c.id, `${geParentIcon(c)} ${c.name}`])] } : info.select ?? null;
  const start = parentId && geBp(parentId);
  const parentBase = start?.name.replace(/^BP_/, '');
  const answer = await geDialog({ title: info.title, text: info.text, input: parentBase ? `BP_${parentBase}${geKind(start) === 'tsclass' ? '' : 'Dziecko'}` : info.name, select, buttons: [{ label: 'Utwórz', value: true, primary: true }, { label: 'Anuluj', value: null }] });
  const name = select ? answer?.text : answer;
  if (!name?.trim()) return;
  const parent = kind === 'actor' && answer.select ? geBp(answer.select) : null;
  geChange(() => {
    // Klasa TypeScript nie ma ustawień aktora do skopiowania — dziecko zaczyna od domyślnych.
    const copied = parent && geKind(parent) === 'actor' ? JSON.parse(JSON.stringify(parent.defaults)) : {};
    const bp = geAddBlueprint(ge.project, geUniqueName(name.trim(), ge.project.blueprints.map((b) => b.name)), copied, kind);
    // DefaultSceneRoot nie ma wyglądu — klasa od zera dostaje komponent Prostokąt (dziecko dziedziczy komponenty rodzica).
    if (kind === 'actor' && !(parent && geKind(parent) === 'actor')) geLookToComponent(ge.project, bp);
    if (kind === 'tsclass') geTsApplyTemplate(bp, answer?.select);
    bp.folder = ge.cbFolder;
    if (parent) {
      bp.parent = parent.id;
      geAddChildDefaults(bp);
    } else if (kind === 'actor') geAddDefaultEvents(bp);
    if (kind === 'widget') geAddWidgetDefaults(bp);
    if (kind === 'interface') bp.functions.push({ id: 'i' + bp.nextVar++, name: 'NowaFunkcja' });
    if (kind === 'sprite') {
      // Na start: zaznaczona w Przeglądarce tekstura (albo pierwsza z projektu), cały obrazek.
      const sel = geAsset(ge.project, ge.selTile, 'texture');
      const tex = sel || geOfKind('texture').find((t) => t.texture.src);
      if (tex) Object.assign(bp.sprite, { texture: tex.id, x: 0, y: 0, w: tex.texture.w, h: tex.texture.h });
    }
    geDataCreated(bp);
    geZdCreated(bp);
    ge.selTile = bp.id;
    ge.dirty.add(bp.id);
    geLog(`Utworzono ${bp.name} (${GE_KINDS[kind].label}${parent ? `, dziedziczy po ${parent.name}` : ''}). ${info.done}`);
  }, { only: ['drawer', 'tabs'] });
}

async function geRenameBlueprint(id) {
  const bp = geBp(id);
  const name = await geDialog({ title: 'Zmień nazwę', input: bp.name, buttons: [{ label: 'Zmień', value: true, primary: true }, { label: 'Anuluj', value: null }] });
  if (!name?.trim() || name.trim() === bp.name) return;
  geChange(() => {
    bp.name = geUniqueName(name.trim(), ge.project.blueprints.filter((b) => b !== bp).map((b) => b.name));
    ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
  });
}

function geDuplicateBlueprint(id) {
  const bp = geBp(id);
  geChange(() => {
    const copy = JSON.parse(JSON.stringify(bp));
    copy.id = 'bp' + ge.project.nextId++;
    copy.name = geUniqueName(bp.name + '_Kopia', ge.project.blueprints.map((b) => b.name));
    ge.project.blueprints.push(copy);
    ge.dirty.add(copy.id);
  }, { only: ['drawer'] });
}

async function geDeleteBlueprint(id) {
  const bp = geBp(id);
  const count = geAllActors(ge.project).filter((a) => a.bp === id).length;
  const users = geAssetUsers(id).length;
  const children = ge.project.blueprints.filter((b) => b.parent === id);
  const parent = geParentOf(ge.project, bp);
  const text = (children.length ? `Klasy podrzędne (${children.map((c) => geEsc(c.name)).join(', ')}) będą dziedziczyć po ${parent ? geEsc(parent.name) : 'Actor'}. ` : '')
    + (count ? `Na poziomach jest ${count} aktorów tej klasy — znikną razem z nią.`
    : users ? `Używa go ${users} innych zasobów — stracą do niego odwołanie (węzły pokażą błąd do poprawienia). Ctrl+Z cofa.`
    : 'Tej operacji można cofnąć przez Ctrl+Z.');
  const ok = await geDialog({ title: `Usunąć ${geEsc(bp.name)}?`, text, buttons: [{ label: 'Usuń', value: true, primary: true }, { label: 'Anuluj', value: false }] });
  if (!ok) return;
  geChange(() => {
    ge.project.blueprints = ge.project.blueprints.filter((b) => b !== bp);
    geFilterActors(ge.project, (a) => a.bp !== id);
    ge.project.blueprints.forEach((b) => {
      if (b.defaults?.material === id) b.defaults.material = null;
      if (b.defaults?.sprite === id) b.defaults.sprite = null;
      (b.components ?? []).forEach((c) => {
        if (c.material === id) c.material = null;
        if (c.sprite === id) c.sprite = null;
      });
      if (b.interfaces) b.interfaces = b.interfaces.filter((x) => x !== id);
      if (b.sprite?.texture === id) b.sprite.texture = null;
      if (b.flipbook) b.flipbook.frames = b.flipbook.frames.filter((x) => x !== id);
      if (b.parent === id) {
        if (parent) b.parent = parent.id;
        else delete b.parent;
      }
      if (b.widget) b.widget.elements = b.widget.elements.filter((el) => !(el.type === 'widget' && el.widget === id));
      geZdForget(b, id);
    });
    ge.tabs = ge.tabs.filter((t) => t !== id);
    if (!ge.tabs.includes(ge.tab)) ge.tab = 'level';
    if (!geSelActor()) ge.selActor = null;
    ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
  }, { only: [] });
  geRender();
}

function geImportImageFile(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  geLoadImage(file).then(({ url, w, h }) => {
    const target = ge.imageTarget;
    if (target === 'new') {
      geChange(() => {
        const base = 'BP_' + GE_RT.ident(file.name.replace(/\.[^.]+$/, ''));
        const bp = geAddBlueprint(ge.project, geUniqueName(base, ge.project.blueprints.map((b) => b.name)), { shape: 'image', image: url, w, h });
        geLookToComponent(ge.project, bp);
        bp.folder = ge.cbFolder;
        geAddDefaultEvents(bp);
        ge.selTile = bp.id;
        ge.dirty.add(bp.id);
      }, { only: ['drawer'] });
    } else if (String(target).startsWith('comp:')) {
      // Obrazek dla komponentu „Obrazek”: imageTarget = „comp:idBlueprintu:idKomponentu”.
      const [, bpId, compId] = target.split(':');
      const c = geBp(bpId)?.components?.find((x) => x.id === compId);
      if (!c) return;
      geChange(() => Object.assign(c, { image: url, w, h }), { only: ['details', 'components'] });
    } else {
      const bp = geBp(target);
      if (!bp) return;
      // DefaultSceneRoot nie ma wyglądu — obrazek trafia do pierwszego komponentu Obrazek (albo nowego).
      geChange(() => {
        const c = bp.components?.find((x) => x.type === 'image');
        if (c) Object.assign(c, { image: url, w, h });
        else {
          Object.assign(bp.defaults, { shape: 'image', image: url, w, h });
          geLookToComponent(ge.project, bp);
        }
      }, { only: ['details', 'components'] });
    }
    gePreloadImages();
  }).catch(() => geLog('Nie udało się wczytać obrazka.', 'error'));
}

// Obrazek zmniejszony do najwyżej max px (żeby projekt mieścił się w pamięci przeglądarki).
// w, h — rozmiar do pokazania aktora (96 px), nw, nh — rozmiar zapisanego obrazka.
function geLoadImage(file, max = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      const show = 96 / Math.max(canvas.width, canvas.height);
      resolve({ url: canvas.toDataURL('image/png'), w: Math.round(canvas.width * show), h: Math.round(canvas.height * show), nw: canvas.width, nh: canvas.height });
    };
    img.onerror = reject;
    img.src = src;
  });
}

// Dźwięk z pliku jako data: URL (cały projekt, łącznie z dźwiękami, mieści się w jednym pliku i w eksporcie gry).
const GE_SOUND_MAX = 3 * 1024 * 1024;
function geLoadSound(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const url = String(reader.result);
      const audio = new Audio();
      const done = (duration) => resolve({ url, duration: Number.isFinite(duration) ? duration : 0 });
      audio.addEventListener('loadedmetadata', () => done(audio.duration), { once: true });
      audio.addEventListener('error', () => done(0), { once: true });
      audio.src = url;
    };
    reader.readAsDataURL(file);
  });
}

function geImportAssetFiles(event) {
  const files = [...event.target.files];
  event.target.value = '';
  const target = geBp(ge.assetTarget);
  ge.assetTarget = null;
  if (files.length) geImportFiles(files, ge.cbFolder, target);
}

// Animacja z Web Pivot Animatora (plik .jsgame.json z arkuszem klatek) → nowy folder z Teksturą,
// Sprite'em z każdej klatki, Animacją (z fps i zapętleniem z Pivota) i gotową klasą Blueprint.
// Arkusza nie zmniejszamy jak zwykłych obrazków — Pivot sam pilnuje jego rozmiaru.
async function geImportAnimationFile(file, folder = ge.cbFolder, data = undefined) {
  if (data === undefined) {
    try {
      data = JSON.parse(await file.text());
    } catch {
      data = null;
    }
  }
  if (data?.format !== 'jsgame-animation' || !String(data.image).startsWith('data:image/')) {
    geLog(`Pominięto ${file.name}: to nie animacja z Web Pivot Animatora. Projekt gry otworzysz przez Plik › Otwórz projekt.`, 'warn');
    return;
  }
  let img;
  try {
    img = await geImageFromSrc(data.image);
  } catch {
    geLog(`Nie udało się wczytać klatek z ${file.name}.`, 'error');
    return;
  }
  const cols = Math.max(1, Math.floor(Number(data.cols)) || 1);
  const rows = Math.max(1, Math.floor(Number(data.rows)) || 1);
  const fw = Math.floor(img.naturalWidth / cols);
  const fh = Math.floor(img.naturalHeight / rows);
  const count = Math.min(cols * rows, Math.max(1, Math.floor(Number(data.frames)) || cols * rows));
  const base = GE_RT.ident(file.name.replace(/(\.jsgame)?\.json$/i, '')) || 'Animacja';
  let anim;
  geChange(() => {
    const names = () => ge.project.blueprints.map((b) => b.name);
    const dir = { id: 'f' + ge.project.nextId++, name: geUniqueName(base, geSiblingNames(folder)), parent: folder };
    ge.project.folders.push(dir);
    ge.cbOpen.add(folder ?? 'root');
    const tex = geAddBlueprint(ge.project, geUniqueName(`T_${base}`, names()), {}, 'texture');
    tex.folder = dir.id;
    Object.assign(tex.texture, { src: data.image, w: img.naturalWidth, h: img.naturalHeight, cols, rows });
    const frames = Array.from({ length: count }, (_, i) => geAddSprite(tex, { x: (i % cols) * fw, y: Math.floor(i / cols) * fh, w: fw, h: fh }, `S_${base}_${i + 1}`).id);
    anim = geAddBlueprint(ge.project, geUniqueName(`FB_${base}`, names()), {}, 'animation');
    anim.folder = dir.id;
    Object.assign(anim.flipbook, { frames, fps: Math.min(60, Math.max(0.5, Number(data.fps) || GE_FLIPBOOK_DEFAULTS.fps)), loop: data.loop !== false });
  }, { only: [] });
  gePreloadImages();
  geLog(`🏃 Zaimportowano animację z ${data.from ?? 'Web Pivot Animatora'}: ${anim.name} (${count} klatek, ${anim.flipbook.fps} kl./s${anim.flipbook.loop ? ', zapętlona' : ''}). Innej klasie nałożysz ją węzłem „Set Flipbook”.`);
  geClassFromAsset(anim);
  geOpenTab(anim.id);
}

const geIsJsonFile = (file) => /\.json$/i.test(file.name) || file.type === 'application/json';

// Plik JSON: animacja z Pivota → Animacja, projekt gry → podpowiedź, a każdy inny → Baza danych klucz → wartość.
async function geImportJsonFile(file, folder = ge.cbFolder) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    geLog(`Pominięto ${file.name}: to nie jest poprawny plik JSON.`, 'warn');
    return;
  }
  if (data?.format === 'jsgame-animation') await geImportAnimationFile(file, folder, data);
  else if (Array.isArray(data?.blueprints)) geLog(`Pominięto ${file.name}: to projekt gry — otworzysz go przez Plik › Otwórz projekt.`, 'warn');
  else geImportDatabaseJson(file.name, data, folder);
}

// Pytanie przy imporcie obrazków: Tekstury, Sprite'y czy Animacja (Flipbook).
// Zwraca { as, cols, rows } albo null (Anuluj). Jeden obrazek jako animacja to arkusz klatek — pytamy o siatkę.
async function geAskImageKind(images) {
  const many = images.length > 1;
  const as = await geDialog({
    title: many ? `Import ${images.length} obrazków` : `Import obrazka ${images[0].file.name}`,
    text: `Jak dodać ${many ? 'te obrazki' : 'ten obrazek'}?<ul>
      <li><b>Tekstura</b> — sam obrazek; Sprite albo Animację zrobisz z niego później.</li>
      <li><b>Sprite</b> — Tekstura i Sprite z całego obrazka, gotowy na wygląd aktora.</li>
      <li><b>Animacja (Flipbook)</b> — ${many ? 'każdy obrazek to jedna klatka (po kolei według nazw plików)' : 'obrazek to arkusz klatek podzielony siatką'}.</li></ul>`,
    buttons: [{ label: 'Tekstura', value: 'texture', primary: true }, { label: 'Sprite', value: 'sprite' }, { label: 'Animacja (Flipbook)', value: 'animation' }, { label: 'Anuluj', value: null }]
  });
  if (as !== 'animation' || many) return as && { as, cols: 1, rows: 1 };
  // Zgadujemy siatkę z proporcji: pasek klatek obok siebie albo jedna pod drugą.
  const { nw, nh } = images[0];
  const guess = nw >= nh * 1.5 ? `${Math.round(nw / nh)}x1` : nh >= nw * 1.5 ? `1x${Math.round(nh / nw)}` : '1x1';
  const grid = await geDialog({
    title: 'Arkusz klatek',
    text: `Na ile klatek podzielić obrazek (${nw} × ${nh} px)? Wpisz <b>kolumny x wiersze</b>, np. 4x1 dla czterech klatek obok siebie. 1x1 — animacja z jedną klatką.`,
    input: guess,
    buttons: [{ label: 'Utwórz', value: true, primary: true }, { label: 'Anuluj', value: null }]
  });
  if (grid === null) return null;
  const m = /^\s*(\d+)\s*[x×*]\s*(\d+)\s*$/i.exec(grid);
  const clamp = (v) => Math.min(64, Math.max(1, Number(v) || 1));
  return { as, cols: clamp(m?.[1]), rows: clamp(m?.[2]) };
}

// Import z dysku: obrazki → Tekstury / Sprite'y / Animacja (pytamy), pliki dźwiękowe → Dźwięki,
// pliki JSON → Animacje z Pivota albo Bazy danych, wideo → okno rotoskopii. Z target — podmienia plik w tym zasobie.
async function geImportFiles(files, folder = ge.cbFolder, target = null) {
  const loaded = [];
  let video = null;
  for (const file of files) {
    try {
      if (file.type.startsWith('video/') || (!file.type && /.(mp4|mov|m4v|mkv)$/i.test(file.name))) {
        if (target || video) geLog(`Pominięto ${file.name}: animację z wideo robimy w oknie rotoskopii, po jednym nagraniu naraz.`, 'warn');
        else video = file;
      } else if (geIsJsonFile(file)) {
        if (target) geLog(`Pliku ${file.name} nie da się wczytać do ${target.name} — zaimportuj go jako nowy zasób.`, 'warn');
        else await geImportJsonFile(file, folder);
      } else if (file.type.startsWith('image/')) loaded.push({ kind: 'texture', file, ...(await geLoadImage(file, 1024)) });
      else if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm)$/i.test(file.name)) {
        if (file.size > GE_SOUND_MAX) {
          geLog(`${file.name} ma ${(file.size / 1048576).toFixed(1)} MB — za duży (najwyżej 3 MB). Przytnij go albo zapisz jako MP3.`, 'warn');
          continue;
        }
        loaded.push({ kind: 'sound', file, ...(await geLoadSound(file)) });
      } else geLog(`Pominięto ${file.name}: to nie obrazek ani dźwięk.`, 'warn');
    } catch {
      geLog(`Nie udało się wczytać ${file.name}.`, 'error');
    }
  }
  if (video) geRotoOpen(video, folder);
  if (!loaded.length) return;
  const fill = (bp, item) => {
    if (item.kind === 'texture') Object.assign(bp.texture, { src: item.url, w: item.nw, h: item.nh });
    else Object.assign(bp.sound, { src: item.url, file: item.file.name, duration: item.duration });
  };
  if (target) {
    const item = loaded.find((x) => x.kind === geKind(target));
    if (!item) {
      geLog(`Ten plik nie pasuje do ${target.name} (${GE_KINDS[geKind(target)].label}).`, 'warn');
      return;
    }
    geChange(() => fill(target, item), { only: ['details'] });
    gePreloadImages();
    geLog(`Podmieniono plik w ${target.name}: ${item.file.name}.`);
    return;
  }
  const images = loaded.filter((x) => x.kind === 'texture').sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true }));
  const pick = images.length ? await geAskImageKind(images) : null;
  const items = [...(pick ? images : []), ...loaded.filter((x) => x.kind !== 'texture')];
  if (!items.length) return;
  // Arkusz klatek (jeden obrazek z siatką) dzieli potem geSliceTexture; inaczej Sprite dostaje każdy obrazek.
  const sheet = pick?.as === 'animation' && pick.cols * pick.rows > 1;
  const sprites = [];
  let tex = null;
  let anim = null;
  geChange(() => {
    const names = () => ge.project.blueprints.map((b) => b.name);
    items.forEach((item) => {
      const base = GE_KINDS[item.kind].prefix + GE_RT.ident(item.file.name.replace(/\.[^.]+$/, ''));
      const bp = geAddBlueprint(ge.project, geUniqueName(base, names()), {}, item.kind);
      bp.folder = folder;
      fill(bp, item);
      ge.selTile = bp.id;
      if (item.kind !== 'texture') return;
      tex = bp;
      if (sheet) Object.assign(bp.texture, { cols: pick.cols, rows: pick.rows });
      else if (pick.as !== 'texture') {
        sprites.push(geAddSprite(bp, null, `S_${geAssetBase(bp)}`));
        ge.selTile = sprites.at(-1).id;
      }
    });
    if (pick?.as === 'animation' && !sheet) {
      // Nazwa z pierwszego pliku bez numeru klatki: run_1.png, run_2.png… → FB_run.
      const base = GE_RT.ident(images[0].file.name.replace(/\.[^.]+$/, '').replace(/[\s_-]*\d+$/, '')) || 'Animacja';
      anim = geAddBlueprint(ge.project, geUniqueName(`FB_${base}`, names()), {}, 'animation');
      anim.folder = folder;
      anim.flipbook.frames = sprites.map((s) => s.id);
      ge.selTile = anim.id;
    }
  }, { only: ['drawer'] });
  gePreloadImages();
  const what = { texture: ' jako Tekstury', sprite: ' jako Sprite’y', animation: ' jako Animację' }[pick?.as] ?? '';
  geLog(`Zaimportowano${what}: ${items.map((x) => x.file.name).join(', ')}.${pick?.as === 'texture' ? ' Dwuklik w teksturę — zrobisz z niej Sprite albo Animację.' : ''}${items.some((x) => x.kind === 'sound') ? ' Dźwięk odtworzysz węzłem „Play Sound 2D”.' : ''}`);
  if (sheet) await geSliceTexture(tex);
  else if (anim) {
    geLog(`Złożono animację ${anim.name} z ${sprites.length} klatek. Nałożysz ją w klasie (Kształt: Sprite / animacja) albo węzłem „Set Flipbook”.`);
    geOpenTab(anim.id);
  }
}

// ---------- Menu, okna dialogowe, pomoc ----------

// opts.search — pole „Szukaj…” na górze menu, które filtruje pozycje po nazwie (Enter wybiera pierwszą).
function geMenu(anchor, items, opts = {}) {
  geCloseMenu();
  const menu = document.createElement('div');
  menu.className = 'ge-popup';
  menu.setAttribute('role', 'menu');
  const search = opts.search ? `<input class="ge-popup-search" type="search" placeholder="${geEsc(opts.search)}" aria-label="${geEsc(opts.search)}" />` : '';
  menu.innerHTML = search + items.map((item, i) => {
    if (item === '-') return '<div class="ge-popup-sep" role="separator"></div>';
    if (item.heading) return `<div class="ge-popup-head">${geEsc(item.heading)}</div>`;
    // item.icon — gotowy HTML ikony przed etykietą (np. kolorowa ikona typu zmiennej), item.active — obecny wybór.
    return `<button type="button" role="menuitem" data-i="${i}"${item.disabled ? ' disabled' : ''}${item.active ? ' class="is-active"' : ''}><span>${item.icon ? `<span class="ge-popup-ic">${item.icon}</span>` : ''}${geEsc(item.label)}</span>${item.key ? `<kbd>${geEsc(item.key)}</kbd>` : ''}</button>`;
  }).join('') + (opts.search ? '<p class="ge-popup-empty" hidden>Brak wyników</p>' : '');
  ge.root.append(menu);
  const rect = anchor instanceof Element ? anchor.getBoundingClientRect() : { left: anchor.x, bottom: anchor.y };
  menu.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 4)) + 'px';
  menu.style.top = Math.max(4, Math.min(rect.bottom + 2, window.innerHeight - menu.offsetHeight - 4)) + 'px';
  const input = menu.querySelector('.ge-popup-search');
  input?.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    menu.querySelectorAll('button[data-i]').forEach((b) => { b.hidden = !!q && !b.textContent.toLowerCase().includes(q); });
    menu.querySelectorAll('.ge-popup-sep, .ge-popup-head').forEach((x) => { x.hidden = !!q; });
    menu.querySelector('.ge-popup-empty').hidden = !q || !!menu.querySelector('button[data-i]:not([hidden])');
  });
  menu.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-i]');
    if (!btn) return;
    geCloseMenu();
    items[Number(btn.dataset.i)].action();
  });
  menu.addEventListener('keydown', (event) => {
    const buttons = [...menu.querySelectorAll('button:not(:disabled)')].filter((b) => !b.hidden);
    const i = buttons.indexOf(document.activeElement);
    if (event.target === input && event.key === 'Enter') {
      event.preventDefault();
      buttons[0]?.click();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const down = event.key === 'ArrowDown';
      // Z pola wyszukiwania strzałką w dół na pierwszą pozycję, z pierwszej pozycji strzałką w górę z powrotem do pola.
      if (input && i === -1) buttons[down ? 0 : buttons.length - 1]?.focus();
      else if (input && i === 0 && !down) input.focus();
      else buttons[(i + (down ? 1 : buttons.length - 1)) % buttons.length]?.focus();
    }
  });
  ge.menu = menu;
  (input ?? menu.querySelector('button:not(:disabled)'))?.focus();
}

function geCloseMenu() {
  if (!ge?.menu) return;
  ge.menu.remove();
  ge.menu = null;
}

function geOpenMainMenu(kind, anchor) {
  if (ge.menu && ge.menuKind === kind) {
    geCloseMenu();
    return;
  }
  const bps = ge.project.blueprints;
  const open = bps.map((bp) => ({ label: `${geKindIcon(bp)} ${bp.name}`, action: () => geOpenTab(bp.id) }));
  const actors = geOfKind('actor');
  const menus = {
    file: [
      { label: '📄 Nowy projekt…', action: geNewProjectDialog },
      { label: '📂 Otwórz projekt…', action: geOpenProject },
      ...(geProjectNative() ? [
        { label: '💾 Zapisz projekt', key: 'Ctrl+S', action: geSaveFile },
        { label: '📁 Zapisz w nowym folderze…', action: geSaveProjectAs },
        { label: '🗂 Pokaż folder projektu', disabled: !ge.projectDir, action: () => geProjectNative().reveal(ge.projectDir) }
      ] : [{ label: '💾 Zapisz projekt do pliku', key: 'Ctrl+S', action: geSaveFile }]),
      '-',
      { label: '✎ Zmień nazwę gry…', action: async () => {
        const name = await geDialog({ title: 'Nazwa gry', input: ge.project.name, buttons: [{ label: 'Zmień', value: true, primary: true }, { label: 'Anuluj', value: null }] });
        if (name?.trim()) geChange(() => { ge.project.name = name.trim(); }, { only: ['title', 'tabs', 'details'] });
      } },
      '-',
      { label: '▶ Graj w nowym oknie', action: gePlayInTab },
      { label: '🌐 Eksportuj grę (HTML)…', action: geExport }
    ],
    edit: [
      { label: 'Cofnij', key: 'Ctrl+Z', disabled: !ge.undo.length, action: geUndo },
      { label: 'Ponów', key: 'Ctrl+Y', disabled: !ge.redo.length, action: geRedo },
      '-',
      { label: 'Duplikuj', key: 'Ctrl+D', action: () => (ge.tab === 'level' ? geDuplicateActor() : geMode() === 'designer' ? ge.widgetSel && geWidgetElementAction('dup', ge.widgetSel) : geSelComp(geCurBp()) ? geDuplicateComponent(ge.bpPanel.id) : geCopyNodes() && gePasteNodes()) },
      { label: 'Usuń', key: 'Delete', action: () => (ge.tab === 'level' ? geDeleteActor() : geMode() === 'designer' ? ge.widgetSel && geWidgetElementAction('del', ge.widgetSel) : geSelComp(geCurBp()) ? geDeleteComponent(ge.bpPanel.id) : geDeleteNodes()) }
    ],
    components: geCompAddMenu(),
    bp: [
      { heading: 'Utwórz' },
      ...geNewAssetItems(),
      '-',
      { label: '📜 Otwórz Level Blueprint', action: () => geOpenTab('level-bp') },
      ...(open.length ? ['-', ...open] : [])
    ],
    help: [
      { label: '❓ Pomoc i skróty', key: 'F1', action: geShowHelp },
      '-',
      { label: '📘 Dokumentacja Blueprintów', action: () => geShowDocs('bp') },
      { label: '🔷 Dokumentacja TypeScript', action: () => geShowDocs('js') },
      { label: '🏃 Animacje postaci (poradnik)', action: () => geShowDocs('zd') },
      '-',
      { label: 'ℹ O edytorze', action: () => geDialog({ title: 'JSGame Engine', text: 'JSGame Engine — edytor gier 2D w stylu Unreal Engine. Blueprinty zamieniają się w TypeScript, a gotową grę eksportujesz jako stronę WWW (Platformy › Web).', buttons: [{ label: 'OK', value: true, primary: true }] }) }
    ],
    add: [
      { heading: 'Postaw na środku widoku' },
      ...(actors.length ? actors.map((bp) => ({ label: `${geShapeIcon(bp)} ${bp.name}`, action: () => gePlaceAtViewCenter(bp.id) })) : [{ label: '(brak Blueprintów)', disabled: true, action: () => {} }]),
      { label: '🚩 Player Start (miejsce startu gracza)', action: () => gePlaceAtViewCenter(GE_SPAWN_ID) },
      '-',
      { label: '＋ Nowa klasa Blueprint…', action: () => geNewBlueprint() }
    ],
    blueprints: [
      { label: '📜 Otwórz Level Blueprint', action: () => geOpenTab('level-bp') },
      '-',
      { label: `${GE_KINDS.actor.icon} Utwórz klasę Blueprint…`, action: () => geNewBlueprint('actor') },
      { label: `${GE_KINDS.interface.icon} Utwórz Blueprint Interface…`, action: () => geNewBlueprint('interface') },
      { label: `${GE_KINDS.widget.icon} Utwórz Widget Blueprint…`, action: () => geNewBlueprint('widget') },
      { label: `${GE_KINDS.tsclass.icon} Utwórz klasę TypeScript…`, action: () => geNewBlueprint('tsclass') }
    ],
    levels: [
      { heading: 'Poziomy (⭐ — startowy w grze)' },
      ...geLevels(ge.project).map((l, i) => ({ label: `${l.id === ge.project.levelId ? '✔' : ' '} ${l.name}${i === 0 ? ' ⭐' : ''}`, action: () => geOpenLevel(l.id) })),
      '-',
      { label: '＋ Nowy poziom…', action: geNewLevel },
      { label: '✎ Zmień nazwę poziomu…', action: geRenameLevel },
      { label: '⭐ Ustaw jako poziom startowy', disabled: geLevels(ge.project)[0]?.id === ge.project.levelId, action: geSetStartLevel },
      { label: '🗑 Usuń poziom…', disabled: geLevels(ge.project).length < 2, action: geDeleteLevel },
      '-',
      { label: '📜 Otwórz Level Blueprint', action: () => geOpenTab('level-bp') }
    ],
    platforms: [
      { heading: 'Web (HTML5)' },
      { label: '🌐 Eksportuj grę do pliku HTML…', action: geExport },
      { label: '▶ Uruchom w nowym oknie', action: gePlayInTab },
      '-',
      { label: 'Windows, Android, iOS — niedostępne w przeglądarce', disabled: true, action: () => {} }
    ]
  };
  geMenu(anchor, menus[kind]);
  ge.menuKind = kind;
}

// select: { label, options: [[wartość, etykieta]], value } — lista pod polem tekstowym; wtedy OK zwraca { text, select }.
// choices: [{ value, icon, title, text }] — kafelki do wyboru; kliknięty kafelek od razu zwraca swoje value.
function geDialog({ title, text = '', input = null, select = null, choices = null, buttons = [{ label: 'OK', value: true, primary: true }], wide = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'ge-modal';
    wrap.innerHTML = `<div class="ge-modal-card${wide ? ' is-wide' : ''}" role="alertdialog" aria-modal="true" aria-label="${geEsc(title)}">
      <h3>${geEsc(title)}</h3>
      ${text ? `<div class="ge-modal-text">${text}</div>` : ''}
      ${input !== null ? `<input class="ge-modal-input" type="text" value="${geEsc(input)}" />` : ''}
      ${select ? `<label class="ge-modal-field"><span>${geEsc(select.label)}</span><select class="ge-modal-select">${select.options.map(([v, l]) => `<option value="${geEsc(v)}"${v === select.value ? ' selected' : ''}>${geEsc(l)}</option>`).join('')}</select></label>` : ''}
      ${choices ? `<div class="ge-modal-choices">${choices.map((c, i) => `<button type="button" class="ge-modal-choice" data-c="${i}"><span class="ge-modal-choice-icon">${geEsc(c.icon)}</span><b>${geEsc(c.title)}</b><span>${geEsc(c.text)}</span></button>`).join('')}</div>` : ''}
      <div class="ge-modal-actions">${buttons.map((b, i) => `<button type="button" class="${b.primary ? 'is-primary' : ''}" data-i="${i}">${geEsc(b.label)}</button>`).join('')}</div>
    </div>`;
    const field = () => {
      const value = wrap.querySelector('.ge-modal-input')?.value ?? null;
      return select ? { text: value, select: wrap.querySelector('.ge-modal-select').value } : value;
    };
    const finish = (value) => {
      wrap.remove();
      if (ge) ge.modal = null;
      resolve(value);
    };
    wrap.addEventListener('click', (event) => {
      const card = event.target.closest('[data-c]');
      if (card) {
        finish(choices[Number(card.dataset.c)].value);
        return;
      }
      const btn = event.target.closest('[data-i]');
      if (!btn) return;
      const b = buttons[Number(btn.dataset.i)];
      finish(b.value === true && input !== null ? field() : b.value);
    });
    wrap.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(null);
      } else if (event.key === 'Enter' && input !== null) {
        event.preventDefault();
        finish(field());
      }
    });
    ge.root.append(wrap);
    ge.modal = wrap;
    const inputEl = wrap.querySelector('.ge-modal-input');
    if (inputEl) inputEl.select();
    else wrap.querySelector('.is-primary')?.focus();
  });
}

async function geShowHelp() {
  const answer = await geDialog({
    title: 'Jak zrobić grę?',
    wide: true,
    text: `<div class="ge-help">
      <section><h4>🗺️ Poziom</h4><ul>
        <li>Przeciągnij Blueprint z <b>Przeglądarki zawartości</b> na <b>Widok</b> — powstanie aktor.</li>
        <li><b>＋ Dodaj</b> tworzy klasę Blueprint, Widget Blueprint (napisy i przyciski na ekranie), Blueprint Interface i Materiał.</li>
        <li><b>＋ Dodaj › 🎬 Animacja z wideo</b> — animacja postaci z nagrania (rotoskopia), bez rysowania klatek ręcznie.</li>
        <li>Lewy przycisk: zaznacz i przesuń (strzałki — jedna oś, <kbd>Alt</kbd> — kopia, <kbd>Shift</kbd> — bez siatki).</li>
        <li><kbd>W</kbd> przesuń, <kbd>E</kbd> obróć, <kbd>R</kbd> skaluj — gizmo zaznaczonego aktora (przyciski też w górnym pasku widoku).</li>
        <li>Prawy przycisk lub przeciąganie tła: przesuwanie widoku, kółko: przybliżenie.</li>
        <li><b>Szczegóły</b> pokazują położenie, obrót i skalę zaznaczonego aktora.</li>
        <li><b>Ustawienia świata</b> (zakładka obok) — GameMode, Player Controller, Default Pawn, HUD, ekran i fizyka gry.</li>
        <li><b>🗺️ Poziomy</b> na pasku — nowy poziom, przełączanie i zmiana nazwy. Na inny poziom gra przechodzi węzłem <b>Open Level (by Name)</b>.</li>
      </ul></section>
      <section><h4>📘 Blueprint</h4><ul>
        <li>Dwuklik w kafelek otwiera graf węzłów. <b>Prawy przycisk</b> na grafie — dodaj węzeł.</li>
        <li>Przeciągnij z kółka pinu do innego pinu — połączenie. <kbd>Alt</kbd>+klik — rozłącz.</li>
        <li>Puść kabel w pustym miejscu — menu tylko z pasującymi węzłami.</li>
        <li><b>Białe</b> kable to kolejność działania, <b>kolorowe</b> — dane (liczby, teksty, aktorzy).</li>
        <li>Panel <b>Kod TypeScript</b> pokazuje, w co zamienia się Twój Blueprint.</li>
        <li><b>Viewport</b>: <b>＋ Dodaj</b> w panelu Komponenty doczepia do aktora kształty, kolizje i ruch. Przeciągnij komponent, żeby go przesunąć.</li>
        <li><b>Construction Script</b> działa, zanim aktor zacznie grę — od razu widać go w Widoku poziomu.</li>
      </ul></section>
      <section><h4>▶ Granie i eksport</h4><ul>
        <li><b>▶</b> (Alt+P) — graj w edytorze, <kbd>Esc</kbd> — stop.</li>
        <li><b>Platformy › Web</b> — gotowa gra jako jeden plik HTML do otwarcia w przeglądarce.</li>
      </ul></section>
      <section><h4>⌨ Skróty</h4><ul>
        <li><kbd>Ctrl+Z</kbd>/<kbd>Ctrl+Y</kbd> cofnij/ponów, <kbd>Ctrl+C</kbd>/<kbd>Ctrl+V</kbd>/<kbd>Ctrl+D</kbd> kopiuj/wklej/duplikuj, <kbd>Delete</kbd> usuń.</li>
        <li><kbd>F7</kbd> kompiluj, <kbd>F9</kbd> breakpoint na zaznaczonym bloczku (gra w edytorze zatrzyma się przed nim i pokaże wartości zmiennych, <kbd>F8</kbd> — dalej), <kbd>C</kbd> komentarz wokół zaznaczonych węzłów, <kbd>Home</kbd> pokaż cały graf, <kbd>F</kbd> pokaż aktora.</li>
      </ul></section>
    </div>`,
    buttons: [{ label: '📖 Dokumentacja', value: 'docs' }, { label: 'Zaczynamy!', value: true, primary: true }]
  });
  if (answer === 'docs') geShowDocs();
}

// ---------- Obsługa zdarzeń ----------

function geHandleClick(event) {
  const btn = event.target.closest('[data-ge]');
  if (!btn || !ge.root.contains(btn) || btn.closest('.ge-popup')) return;
  const id = btn.dataset.id;
  const bp = geCurBp();
  switch (btn.dataset.ge) {
    case 'menu': geOpenMainMenu(btn.dataset.menu, btn); break;
    case 'tab': if (id !== ge.tab) geOpenTab(id); break;
    case 'tab-close': geCloseTab(id); break;
    case 'save': geSaveFile(); break;
    case 'play': gePlay(); break;
    case 'stop': geStopPlay(); break;
    case 'play-tab': gePlayInTab(); break;
    case 'vp-tool': geSetVpTool(id); break;
    case 'world':
    case 'det-tab':
      ge.detTab = id ?? 'world';
      geRenderDetails();
      break;
    case 'drawer':
      ge.drawer = id;
      if (!ge.drawerOpen) geToggleDrawer();
      geRenderDrawer();
      break;
    case 'drawer-toggle': geToggleDrawer(); break;
    case 'pick-actor':
      ge.selActor = id;
      geRefreshLevelSel();
      break;
    case 'open-bp': geOpenTab(id); break;
    // Klasa TypeScript: w aplikacji desktopowej otwiera się w VS Code, w przeglądarce — w karcie.
    case 'open-ts':
      if (!geDataOpened(id)) geOpenTab(id);
      break;
    case 'dup-actor': geDuplicateActor(); break;
    case 'del-actor': geDeleteActor(); break;
    case 'new-bp': geMenu(btn, [{ heading: 'Utwórz zasób' }, ...geNewAssetItems(), '-', { label: '📁 Nowy folder…', action: () => geNewFolder() }]); break;
    case 'wd-add': geWidgetElementAction('add', btn.dataset.v); break;
    case 'wd-dup': geWidgetElementAction('dup', id); break;
    case 'wd-del': geWidgetElementAction('del', id); break;
    case 'wd-pick':
      if (geMode() !== 'designer') geSetBpMode('designer');
      geSelectWidgetEl(id);
      break;
    case 'bp-parent': geParentMenu(btn); break;
    case 'pick-ivar':
    case 'pick-icomp':
      ge.bpPanel = { kind: btn.dataset.ge === 'pick-ivar' ? 'ivar' : 'icomp', id };
      ge.nodeSel.clear();
      geUpdateNodeSelection();
      geRenderComponents();
      geRenderMyBp();
      geRenderBpDetails();
      geDrawBpViewport();
      break;
    case 'copy-parent-defaults': {
      const parent = geParentOf(ge.project, bp);
      if (parent) geChange(() => { bp.defaults = JSON.parse(JSON.stringify(parent.defaults)); }, { only: ['details', 'components'] });
      break;
    }
    case 'iface-impl-add': geInterfaceMenu(btn, bp); break;
    case 'iface-impl-del': geSetClassInterface(bp, id, false); break;
    case 'iface-add':
      geChange(() => bp.functions.push({ id: 'i' + bp.nextVar++, name: geUniqueName('NowaFunkcja', bp.functions.map((f) => f.name)) }), { only: ['details'] });
      break;
    case 'iface-del':
      geChange(() => { bp.functions = bp.functions.filter((f) => f.id !== id); }, { only: ['details'] });
      break;
    case 'iface-prop-add':
      geChange(() => bp.properties.push({ id: 'i' + bp.nextVar++, name: geUniqueName('NowaWlasciwosc', bp.properties.map((v) => v.name)), type: 'float' }), { only: ['details'] });
      break;
    case 'iface-prop-del':
      geChange(() => { bp.properties = bp.properties.filter((v) => v.id !== id); }, { only: ['details'] });
      break;
    case 'evin-add':
    case 'evin-del': {
      const n = geNodeById(btn.dataset.node);
      if (!n) break;
      geChange(() => {
        const list = geEventInputs(n);
        if (btn.dataset.ge === 'evin-del') n.props.inputs = list.filter((p) => p.id !== id);
        else {
          const next = list.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
          n.props = { ...n.props, inputs: [...list, { id: String(next), name: geUniqueName('Parametr', list.map((p) => p.name)), type: 'float' }] };
        }
      }, { bp: bp.id, only: ['graph', 'details', 'code'] });
      break;
    }
    case 'import-image':
      ge.imageTarget = 'new';
      ge.root.querySelector('.ge-image-file').click();
      break;
    case 'import-assets': geAskImport(); break;
    case 'asset-replace': geAskImport(bp?.id); break;
    case 'asset-class': geClassFromAsset(bp); break;
    case 'tex-sprite': geSpriteFromTexture(bp); break;
    case 'tex-slice': geSliceTexture(bp); break;
    case 'sprite-full': {
      const tex = geAsset(ge.project, bp.sprite.texture, 'texture');
      if (tex) geChange(() => Object.assign(bp.sprite, { x: 0, y: 0, w: tex.texture.w, h: tex.texture.h }), { only: ['details'] });
      break;
    }
    case 'fb-add': {
      const pick = ge.root.querySelector('.ge-fb-pick')?.value;
      if (pick) geChange(() => bp.flipbook.frames.push(pick), { only: ['details'] });
      break;
    }
    case 'fb-del':
      geChange(() => bp.flipbook.frames.splice(Number(btn.dataset.i), 1), { only: ['details'] });
      break;
    case 'fb-move': {
      const i = Number(btn.dataset.i);
      const j = i + Number(btn.dataset.v);
      const frames = bp.flipbook.frames;
      if (j >= 0 && j < frames.length) geChange(() => { [frames[i], frames[j]] = [frames[j], frames[i]]; }, { only: ['details'] });
      break;
    }
    case 'snd-play':
      GE_RT.stopSounds(geAudio());
      GE_RT.playSoundData(geAudio(), bp.sound);
      break;
    case 'snd-stop': GE_RT.stopSounds(geAudio()); break;
    // Enhanced Input: mapowania w Input Mapping Context oraz tablice Triggers / Modifiers.
    case 'imc-add':
      geChange(() => { geAddMapping(bp, ''); }, { only: ['details'] });
      break;
    case 'imc-new-action': geNewInputActionFor(bp); break;
    case 'imc-add-key':
      geChange(() => { geAddMapping(bp, id ?? ''); }, { only: ['details'] });
      break;
    case 'imc-del':
      geChange(() => { bp.mappingContext.mappings = bp.mappingContext.mappings.filter((m) => m.id !== id); }, { only: ['details'] });
      break;
    case 'imc-del-group':
      geChange(() => { bp.mappingContext.mappings = bp.mappingContext.mappings.filter((m) => m.action !== (id ?? '')); }, { only: ['details'] });
      break;
    case 'imc-clear':
      if (bp.mappingContext.mappings.length) geChange(() => { bp.mappingContext.mappings = []; }, { only: ['details'] });
      break;
    case 'imc-listen': geListenKey(id); break;
    case 'imc-toggle':
      if (!ge.imcOpen.delete(id)) ge.imcOpen.add(id);
      geRenderAssetPage();
      break;
    case 'in-add':
    case 'in-del':
    case 'in-clear': {
      const { what, owner } = btn.dataset;
      const list = geInputList(bp, owner, what);
      if (!list) break;
      geChange(() => {
        if (btn.dataset.ge === 'in-add') list.push(geInputItem(what, Object.keys(what === 'trig' ? GE_INPUT_TRIGGERS : GE_INPUT_MODIFIERS)[0]));
        else if (btn.dataset.ge === 'in-del') list.splice(Number(btn.dataset.i), 1);
        else list.length = 0;
      }, { only: ['details'] });
      break;
    }
    case 'snd-builtin':
      geChange(() => Object.assign(bp.sound, { src: null, file: '', duration: 0 }), { only: ['details'] });
      break;
    case 'pick-image':
      ge.imageTarget = btn.dataset.comp ? `comp:${bp.id}:${btn.dataset.comp}` : bp?.id;
      ge.root.querySelector('.ge-image-file').click();
      break;
    case 'new-folder': geNewFolder(); break;
    case 'cb-folder': geOpenFolder(id); break;
    case 'cb-toggle':
      if (ge.cbOpen.has(id)) ge.cbOpen.delete(id);
      else ge.cbOpen.add(id);
      geRenderDrawer();
      break;
    case 'tile-folder':
    case 'tile':
      geSelectTile(id, event);
      break;
    case 'compile': geCompile(); break;
    case 'class-defaults':
      ge.nodeSel.clear();
      // „class” zamiast null, żeby w grafie funkcji pokazać ustawienia klasy, a nie szczegóły funkcji.
      ge.bpPanel = { kind: 'class' };
      // W widgecie przycisk „Projektant” otwiera Projektant i odznacza element (Szczegóły pokażą cały widget).
      if (geIsWidgetBp(bp)) {
        ge.widgetSel = null;
        if (geMode() !== 'designer') {
          geSetBpMode('designer');
          break;
        }
        geRenderWdPanels();
        geDrawWidgetViewport();
      }
      geSelectionChanged();
      break;
    case 'toggle-code':
      ge.codeOpen = !ge.codeOpen;
      ge.root.querySelector('.ge-page').classList.toggle('has-code', ge.codeOpen);
      btn.setAttribute('aria-pressed', String(ge.codeOpen));
      geRefreshCode();
      requestAnimationFrame(geDrawWires);
      break;
    case 'copy-code':
      navigator.clipboard?.writeText(ge.root.querySelector('.ge-code-body').textContent).then(() => geToast('Skopiowano kod TypeScript.'), () => {});
      break;
    case 'var-add': geAddVariable(); break;
    case 'fn-add': geAddFunction(); break;
    case 'pick-fn': geOpenFunction(id); break;
    case 'open-tl': geOpenTimeline(id); break;
    case 'fn-del': geDeleteFunction(id); break;
    case 'fn-pin-add': geAddFnPin(id, btn.dataset.v); break;
    case 'fn-pin-del': geDeleteFnPin(btn.dataset.fn, btn.dataset.v, id); break;
    case 'disp-add': geAddDispatcher(); break;
    case 'disp-del': geDeleteDispatcher(id); break;
    case 'disp-pin-add': geUpdateDispatcher(bp, id, null, 'pin-add'); break;
    case 'disp-pin-del': geUpdateDispatcher(bp, id, btn.dataset.p, 'pin-del'); break;
    case 'pick-var':
    case 'pick-disp':
      ge.bpPanel = { kind: btn.dataset.ge === 'pick-var' ? 'var' : 'disp', id };
      ge.nodeSel.clear();
      geUpdateNodeSelection();
      geRenderComponents();
      geRenderMyBp();
      geRenderBpDetails();
      geDrawBpViewport();
      break;
    case 'var-eye': {
      const v = bp.variables.find((item) => item.id === id);
      if (v) geUpdateVariable(bp, id, 'editable', !v.editable, null, true);
      break;
    }
    case 'var-type-pick':
    case 'var-cont-pick':
    case 'var-vtype-pick': {
      const v = bp.variables.find((item) => item.id === id);
      if (v) geVarTypeMenu(btn, v.type, { 'var-type-pick': 'type', 'var-cont-pick': 'container', 'var-vtype-pick': 'valueType' }[btn.dataset.ge], (which, value) => geUpdateVariable(bp, id, which, value));
      break;
    }
    // Elementy kontenera: wartość domyślna (var-el) albo wartość w aktorze na poziomie (actor-var-el).
    case 'var-el':
    case 'actor-var-el': {
      const inActor = btn.dataset.ge === 'actor-var-el';
      const actor = inActor ? geSelActor() : null;
      const key = btn.dataset.k;
      const v = inActor ? geActorVarDef(key) : bp.variables.find((item) => item.id === id);
      if (!v || (inActor && !actor)) break;
      geContainerBtn(btn, (op) => geChange(() => {
        if (inActor) actor.vars[key] = geContainerEditAt(geActorVarValue(actor, key), v.type, btn, op);
        else v.value = geContainerEditAt(v.value, v.type, btn, op);
      }, inActor ? { only: ['details', 'viewport'] } : { bp: bp.id, only: ['details', 'code'] }));
      break;
    }
    case 'actor-pick': {
      const pick = { actor: ge.selActor, key: btn.dataset.k, axis: btn.dataset.axis ?? '' };
      const same = ge.actorPick && ge.actorPick.key === pick.key && ge.actorPick.axis === pick.axis;
      geSetActorPick(same ? null : pick);
      break;
    }
    case 'del-var': geDeleteVariable(id); break;
    case 'focus-node': geFocusNode(id); break;
    case 'bp-mode': geSetBpMode(id); break;
    case 'pick-comp': geSelectComp(id); break;
    case 'dup-comp': geDuplicateComponent(id); break;
    case 'bind-event': geBindEvent(btn.dataset.v, btn.dataset.prop, id); break;
    case 'del-comp': geDeleteComponent(id); break;
    case 'emoji':
      if (btn.dataset.comp) geUpdateComponent(btn.dataset.comp, 'emoji', btn.dataset.v);
      else geChange(() => Object.assign(bp.defaults, { emoji: btn.dataset.v, shape: 'emoji' }), { only: ['details', 'components'] });
      break;
    default:
      if (btn.dataset.ge.startsWith('tl-')) geTlClick(btn, bp);
      else if (btn.dataset.ge.startsWith('zd-')) geZdClick(btn.dataset.ge, id, bp, btn);
      else geDataClick(btn.dataset.ge, id, bp, btn);
  }
}

function geHandleDblClick(event) {
  const folderTile = event.target.closest('.ge-folder-tile');
  if (folderTile) {
    geOpenFolder(folderTile.dataset.id);
    return;
  }
  const tile = event.target.closest('.ge-tile');
  if (tile) {
    if (!geDataOpened(tile.dataset.id)) geOpenTab(tile.dataset.id);
    return;
  }
  const row = event.target.closest('[data-ge="pick-actor"]');
  if (row) {
    geFocusActor(row.dataset.id);
    return;
  }
  const wdRow = event.target.closest('[data-ge="wd-pick"]');
  if (wdRow) {
    const el = geCurBp()?.widget?.elements.find((x) => x.id === wdRow.dataset.id);
    if (el?.type === 'widget' && geWidgetClass(el.widget)) geOpenTab(el.widget);
    return;
  }
  const compRow = event.target.closest('[data-ge="pick-comp"]');
  if (compRow) {
    geSetBpMode('viewport');
    if (compRow.dataset.id) geFocusComponent(compRow.dataset.id);
    return;
  }
  const tlEl = event.target.closest('.ge-nodes .ge-node[data-node]');
  if (tlEl && geNodeById(tlEl.dataset.node)?.type === 'timeline' && !event.target.closest('input, select')) {
    geOpenTimeline(tlEl.dataset.node);
    return;
  }
  const head = event.target.closest('.ge-comment-head');
  if (head) {
    const n = geNodeById(head.closest('[data-node]').dataset.node);
    geDialog({ title: 'Tekst komentarza', input: n.text, buttons: [{ label: 'Zmień', value: true, primary: true }, { label: 'Anuluj', value: null }] }).then((text) => {
      if (text !== null) geChange(() => { n.text = text; }, { only: ['graph', 'details'] });
    });
  }
}

function geHandleContextMenu(event) {
  const folderEl = event.target.closest('.ge-folder-tile, .ge-tree-row');
  if (folderEl) {
    event.preventDefault();
    geMenu({ x: event.clientX, y: event.clientY }, geFolderMenu(folderEl.dataset.id));
    return;
  }
  if (event.target.closest('.ge-cb-grid') && !event.target.closest('.ge-tile')) {
    event.preventDefault();
    geMenu({ x: event.clientX, y: event.clientY }, [
      { label: '📁 Nowy folder…', action: () => geNewFolder() },
      ...geNewAssetItems(),
      { label: '⤓ Importuj obrazki i dźwięki…', action: () => geAskImport() }
    ]);
    return;
  }
  const compRow = event.target.closest('[data-ge="pick-comp"]');
  if (compRow) {
    event.preventDefault();
    const id = compRow.dataset.id;
    geSelectComp(id || null);
    geMenu({ x: event.clientX, y: event.clientY }, id ? geCompMenu(id) : geCompAddMenu());
    return;
  }
  if (event.target.closest('.ge-comps-body')) {
    event.preventDefault();
    geMenu({ x: event.clientX, y: event.clientY }, geCompAddMenu());
    return;
  }
  const wdRow = event.target.closest('[data-ge="wd-pick"]');
  if (wdRow || event.target.closest('.ge-wd-tree-body')) {
    event.preventDefault();
    if (geMode() !== 'designer') geSetBpMode('designer');
    geSelectWidgetEl(wdRow?.dataset.id || null);
    geMenu({ x: event.clientX, y: event.clientY }, wdRow?.dataset.id ? geWdElementMenu(wdRow.dataset.id) : geWdAddMenu());
    return;
  }
  const tile = event.target.closest('.ge-tile');
  const row = event.target.closest('[data-ge="pick-actor"]');
  if (event.target.closest('.ge-viewport, .ge-graph, .ge-bpvp') && !event.target.closest('input')) event.preventDefault();
  if (!tile && !row) return;
  event.preventDefault();
  if (row) {
    ge.selActor = row.dataset.id;
    geRefreshLevelSel();
    geMenu({ x: event.clientX, y: event.clientY }, geActorMenu());
    return;
  }
  const id = tile.dataset.id;
  const asset = geBp(id);
  const kind = geKind(asset);
  const isActor = kind === 'actor';
  // Szybkie akcje zależne od rodzaju zasobu, jak w menu „Asset Actions” w Unreal Engine.
  const extra = {
    actor: [
      { label: '⊕ Postaw na środku widoku', action: () => gePlaceAtViewCenter(id) },
      { label: '📘 Utwórz klasę podrzędną…', action: () => geNewBlueprint('actor', id) }
    ],
    texture: [
      { label: '🧩 Utwórz Sprite', action: () => geSpriteFromTexture(asset) },
      { label: '🎞 Podziel na klatki (animacja)…', action: () => geOpenTab(id) },
      { label: '📘 Utwórz klasę Blueprint', action: () => geClassFromAsset(asset) },
      { label: '⤓ Zamień obrazek…', action: () => geAskImport(id) }
    ],
    sprite: [{ label: '📘 Utwórz klasę Blueprint', action: () => geClassFromAsset(asset) }],
    // Klasa TypeScript z @UCLASS(Blueprintable) — jak klasa C++ w Unreal Engine: Blueprint może po niej dziedziczyć.
    tsclass: kind !== 'tsclass' || geTsParentProblem(ge.project, asset) ? [] : [{ label: '📘 Utwórz klasę Blueprint…', action: () => geNewBlueprint('actor', id) }],
    animation: [{ label: '📘 Utwórz klasę Blueprint', action: () => geClassFromAsset(asset) }],
    sound: [
      { label: '▶ Odtwórz', action: () => GE_RT.playSoundData(geAudio(), asset.sound) },
      { label: '⤓ Wczytaj plik…', action: () => geAskImport(id) }
    ]
  }[kind] ?? [];
  geMenu({ x: event.clientX, y: event.clientY }, [
    { label: isActor ? '✎ Edytuj Blueprint' : '✎ Otwórz', action: () => geDataOpened(id) || geOpenTab(id) },
    ...extra,
    '-',
    { label: 'Zmień nazwę…', action: () => geRenameBlueprint(id) },
    { label: 'Duplikuj', action: () => geDuplicateBlueprint(id) },
    { label: 'Usuń…', action: () => geDeleteBlueprint(id) }
  ]);
}

function geHandleDragStart(event) {
  // Kafelek z zaznaczenia ciągnie całe zaznaczenie; niezaznaczony kafelek i wiersz drzewa — tylko siebie.
  const cbEl = event.target.closest?.('.ge-tile, .ge-tree-row');
  if (cbEl) {
    const id = cbEl.dataset.id;
    if (!id) return;
    const ids = cbEl.classList.contains('ge-tile') && ge.cbSel.has(id) ? [...ge.cbSel] : [id];
    ge.cbDragFolders = ids.filter(geFolder);
    event.dataTransfer.setData('application/x-ge-items', ids.join(','));
    // Na Widok można upuścić tylko jedną klasę — tę, którą chwycono.
    if (!geFolder(id)) event.dataTransfer.setData('application/x-ge-bp', id);
    event.dataTransfer.setData('text/plain', ids.length > 1 ? `${ids.length} elementów` : (geFolder(id) ?? geBp(id))?.name ?? '');
    event.dataTransfer.effectAllowed = geFolder(id) ? 'move' : 'copyMove';
    return;
  }
  const dispRow = event.target.closest?.('[data-ge="pick-disp"]');
  if (dispRow) {
    event.dataTransfer.setData('application/x-ge-disp', dispRow.dataset.id);
    event.dataTransfer.setData('text/plain', dispRow.textContent.trim());
    event.dataTransfer.effectAllowed = 'copy';
    return;
  }
  const fnRow = event.target.closest?.('[data-ge="pick-fn"]');
  if (fnRow) {
    event.dataTransfer.setData('application/x-ge-fn', fnRow.dataset.id);
    event.dataTransfer.setData('text/plain', fnRow.textContent.trim());
    event.dataTransfer.effectAllowed = 'copy';
    return;
  }
  const pal = event.target.closest?.('.ge-wd-pal');
  if (pal) {
    event.dataTransfer.setData('application/x-ge-wd', pal.dataset.v);
    event.dataTransfer.setData('text/plain', pal.textContent.trim());
    event.dataTransfer.effectAllowed = 'copy';
    return;
  }
  const row = event.target.closest?.('[data-ge="pick-var"], [data-ge="pick-ivar"]');
  if (row) {
    event.dataTransfer.setData('application/x-ge-var', row.dataset.id);
    event.dataTransfer.setData('text/plain', row.textContent.trim());
    event.dataTransfer.effectAllowed = 'copy';
  }
}

function geHandleInput(event) {
  const filter = event.target.dataset?.filter;
  if (filter === 'outliner') geRenderOutliner();
  else if (filter === 'content') geRenderDrawer();
  else if (filter === 'kind') {
    ge.cbKind = event.target.value || null;
    geRenderDrawer();
  }
}

function geHandleChange(event) {
  const viewMode = event.target.closest('[data-ge="view-mode"]');
  if (viewMode && ge.root.contains(viewMode)) {
    ge.viewportMode = GE_VIEW_MODES.some(([id]) => id === viewMode.value) ? viewMode.value : 'lit';
    geDrawViewport();
    return;
  }
  const el = event.target.closest('[data-scope]');
  if (!el || !ge.root.contains(el)) return;
  const { scope, k: key } = el.dataset;
  const value = geReadInput(el);
  const bp = geCurBp();
  if (scope.startsWith('zd-') && geZdChange(scope, key, value, el, bp)) return;
  switch (scope) {
    case 'world':
      // Nowy odstęp autozapisu liczy się od teraz.
      if (key === 'autosave') {
        clearTimeout(ge.saveTimer);
        ge.saveTimer = 0;
      }
      geChange(() => {
        if (key === 'name') {
          if (String(value).trim()) ge.project.name = String(value).trim();
        } else if (key === 'background' || key === 'floorColor') ge.project.settings[key] = value;
        else if (key === 'playerStart' || key === 'minimap') ge.project.settings[key] = Boolean(value);
        else if (key === 'view') ge.project.settings.view = value === 'raycast' ? 'raycast' : '2d';
        else if (GE_WORLD_CLASSES[key]) ge.project.settings[key] = String(value);
        else {
          const [min, max] = GE_WORLD_LIMITS[key];
          ge.project.settings[key] = Math.min(max, Math.max(min, Number(value) || 0));
        }
      }, { only: key === 'name' ? ['title', 'tabs'] : key === 'grid' || key === 'view' ? ['viewport', 'details'] : GE_WORLD_CLASSES[key] ? ['details'] : ['viewport'] });
      break;
    case 'actor': {
      const actor = geSelActor();
      if (!actor) return;
      geChange(() => {
        if (key === 'name') actor.name = String(value).trim() || actor.name;
        else actor[key] = value;
      }, { only: key === 'name' ? ['outliner', 'viewport'] : ['viewport'] });
      break;
    }
    case 'actor-var': {
      const actor = geSelActor();
      // Construction Script może zależeć od zmiennych instancji, więc odświeżamy Widok.
      // data-axis — pole wektora, Struktury albo element kontenera (np. „2.x”).
      if (actor) geChange(() => { actor.vars[key] = el.dataset.axis ? geSetAt(geActorVarValue(actor, key), geActorVarDef(key)?.type, el.dataset.axis, value) : value; }, { only: ['viewport'] });
      break;
    }
    case 'defaults':
      geChange(() => {
        bp.defaults[key] = (key === 'w' || key === 'h') ? Math.max(1, value) : key === 'material' || key === 'sprite' ? value || null : value;
        // Nowy sprite: wysokość dopasowana do jego proporcji, żeby obrazek się nie rozciągał.
        const frame = key === 'sprite' && geSpriteData(ge.project, value)?.frames[0];
        if (frame?.w) bp.defaults.h = Math.max(1, Math.round((bp.defaults.w * frame.h) / frame.w));
      }, { only: key === 'shape' || key === 'sprite' ? ['details', 'components'] : ['preview', 'components'] });
      break;
    case 'texture':
      geChange(() => { bp.texture[key] = Math.min(64, Math.max(1, Math.trunc(Number(value) || 1))); }, { only: ['preview'] });
      break;
    case 'sprite':
      geChange(() => {
        if (key === 'texture') {
          const tex = geAsset(ge.project, value, 'texture');
          Object.assign(bp.sprite, { texture: tex?.id ?? null, x: 0, y: 0, w: tex?.texture.w ?? 0, h: tex?.texture.h ?? 0 });
        } else bp.sprite[key] = Math.max(key === 'w' || key === 'h' ? 1 : 0, Math.trunc(Number(value) || 0));
      }, { only: key === 'texture' ? ['details'] : ['preview'] });
      break;
    case 'flipbook':
      geChange(() => {
        bp.flipbook[key] = key === 'loop' ? !!value : Math.min(60, Math.max(0.5, Number(value) || 8));
      }, { only: ['details'] });
      break;
    case 'sound':
      geChange(() => {
        bp.sound[key] = key === 'volume' ? Math.min(1, Math.max(0, Number(value) || 0)) : value;
      }, { only: ['preview'] });
      break;
    case 'widget-el': {
      const item = bp?.widget?.elements.find((x) => x.id === el.dataset.id);
      if (!item) return;
      geChange(() => {
        if (key === 'name') {
          const name = String(value).trim();
          if (name) item.name = geUniqueName(name, bp.widget.elements.filter((x) => x !== item).map((x) => x.name));
        } else if (key === 'w' || key === 'h' || key === 'size') item[key] = Math.max(1, value);
        else if (key === 'widget') {
          if (geNestableWidgets(bp).some((w) => w.id === value)) item.widget = value;
        } else item[key] = value;
      }, { bp: bp.id, only: key === 'name' || key === 'widget' ? ['details', 'graph', 'code'] : ['preview'] });
      break;
    }
    case 'material':
      geChange(() => {
        if (key === 'color') bp.material.color = value;
        else bp.material[key] = Math.min(key === 'opacity' ? 1 : 100, Math.max(0, Number(value) || 0));
      }, { only: ['preview'] });
      break;
    case 'input-action':
      if (key === 'valueType') geSetInputValueType(bp, GE_INPUT_VALUE_TYPES.some(([t]) => t === value) ? value : 'bool');
      else geChange(() => { bp.inputAction[key] = key === 'accumulate' ? String(value) : !!value; }, { only: ['details'] });
      break;
    case 'imc-map': {
      const m = geMapping(bp, el.dataset.id);
      if (m) geChange(() => { m.key = String(value); }, { only: ['details'] });
      break;
    }
    case 'imc-group':
      // Inna akcja dla całej grupy: wszystkie jej klawisze przechodzą do wybranej akcji.
      geChange(() => bp.mappingContext.mappings.forEach((m) => { if (m.action === el.dataset.id) m.action = String(value); }), { only: ['details'] });
      break;
    case 'in-item': geInputItemChange(bp, el, key, value); break;
    case 'iface-fn': {
      const fn = bp.functions.find((f) => f.id === el.dataset.id);
      const name = String(value).trim();
      if (fn && name) geChange(() => { fn.name = geUniqueName(name, bp.functions.filter((f) => f !== fn).map((f) => f.name)); }, { only: ['details'] });
      break;
    }
    case 'iface-prop': {
      const prop = bp.properties.find((v) => v.id === el.dataset.id);
      if (!prop) break;
      // Właściwości stają się zmiennymi klasy, więc ich nazwy od razu są identyfikatorami.
      const name = GE_RT.ident(String(value).trim());
      if (key === 'type') geChange(() => { prop.type = geIsVarType(value) ? value : 'float'; }, { only: ['details'] });
      else if (name) geChange(() => { prop.name = geUniqueName(name, bp.properties.filter((v) => v !== prop).map((v) => v.name)); }, { only: ['details'] });
      break;
    }
    case 'comp':
      geUpdateComponent(el.dataset.id, key, value);
      break;
    case 'var':
      geUpdateVariable(bp, el.dataset.id, key, value, el.dataset.axis);
      break;
    case 'fn':
      geRenameFunction(bp, el.dataset.id, value);
      break;
    case 'fn-pin':
      geUpdateFnPin(bp, el.dataset.fn, el.dataset.side, el.dataset.id, key, value);
      break;
    case 'disp':
    case 'disp-pin':
      geUpdateDispatcher(bp, el.dataset.id, el.dataset.p, key, value);
      break;
    case 'node-value': {
      const n = geNodeById(el.dataset.node);
      if (!n) return;
      geChange(() => {
        n.values = n.values || {};
        if (el.dataset.axis) {
          const pin = gePins(n, bp).ins.find((p) => p.id === key);
          n.values[key] = { ...(n.values[key] ?? pin?.def ?? { x: 0, y: 0 }), [el.dataset.axis]: value };
        } else n.values[key] = value;
        // Inna nazwa zdarzenia w „Call Custom Event” to inne piny parametrów.
      }, { bp: bp.id, only: n.type === 'call_event' && key === 'name' ? ['graph', 'details', 'code'] : ['code'] });
      break;
    }
    case 'ev-input': {
      const n = geNodeById(el.dataset.node);
      if (!n) return;
      geChange(() => {
        n.props.inputs = geEventInputs(n).map((p) => (p.id !== el.dataset.id ? p
          : { ...p, [key]: key === 'name' ? String(value).trim() || p.name : value }));
      }, { bp: bp.id, only: ['graph', 'details', 'code'] });
      break;
    }
    case 'node-prop': {
      const n = geNodeById(el.dataset.node);
      if (!n) return;
      geChange(() => {
        n.props = n.props || {};
        if (n.type === 'ev_custom' && key === 'name') geRenameEventCalls(n.props.name || 'MojeZdarzenie', value);
        n.props[key] = value;
        // Nazwa Timeline'u jest jego nazwą w Blueprincie, więc musi być niepowtarzalna.
        if (n.type === 'timeline' && key === 'name') n.props.name = String(value).trim() && !geTlNodes(bp).some((t) => t !== n && t.props?.name === String(value).trim()) ? String(value).trim() : geTimelineName(bp, n);
      }, { bp: bp.id, only: ['graph', 'mybp', 'code', ...(el.closest('.ge-bp-details') ? ['details'] : [])] });
      // Nazwa Timeline'u jest też na karcie jego edytora.
      if (n.type === 'timeline' && key === 'name' && geCurTl()) geRender();
      break;
    }
    case 'comment': {
      const n = geNodeById(el.dataset.node);
      if (n) geChange(() => { n[key] = value; }, { only: ['graph'] });
      break;
    }
    case 'tl':
    case 'tl-track':
    case 'tl-key':
      geTlChange(scope, key, value, el, bp);
      break;
    default: geDataChange(scope, key, value, el, bp);
  }
}

function geRenameEventCalls(from, to) {
  const key = GE_RT.ident(from);
  [...geAllBlueprints(ge.project), ...geLevels(ge.project).filter((l) => l.id !== ge.project.levelId && l.level).map((l) => l.level)].forEach((b) => geGraphs(b).forEach((g) => (g?.nodes ?? []).forEach((n) => {
    if (n.type !== 'call_event' || GE_RT.ident(n.props?.name || 'MojeZdarzenie') !== key) return;
    n.props.name = to;
    ge.dirty.add(b.id);
  })));
}

function geHandleKey(event) {
  if (!ge || ge.modal) return;
  if (ge.menu) {
    if (event.key === 'Escape') {
      event.preventDefault();
      geCloseMenu();
    }
    return;
  }
  if (ge.ctx) return;
  if (ge.playing) {
    if (event.key === 'Escape') {
      event.preventDefault();
      geStopPlay();
    } else if (event.key === 'F8' && ge.playing.debugPaused) {
      event.preventDefault();
      geResumeBreak();
    }
    return;
  }
  if (ge.actorPick && event.key === 'Escape') {
    event.preventDefault();
    geSetActorPick(null);
    return;
  }
  const typing = event.target.closest?.('input, textarea, select');
  const mod = event.ctrlKey || event.metaKey;
  const k = event.key.toLowerCase();
  if (mod && k === 's') {
    event.preventDefault();
    geSaveFile();
    return;
  }
  if (event.altKey && k === 'p') {
    event.preventDefault();
    gePlay();
    return;
  }
  if (event.key === 'F9' && !typing && geCurBp() && geMode() !== 'designer' && geMode() !== 'viewport') {
    event.preventDefault();
    geToggleBreakpoint();
    return;
  }
  if (event.key === 'F7') {
    event.preventDefault();
    geCompile();
    return;
  }
  if (event.key === 'F1') {
    event.preventDefault();
    geShowHelp();
    return;
  }
  if (typing) return;
  if (mod && k === 'z') {
    event.preventDefault();
    if (event.shiftKey) geRedo();
    else geUndo();
    return;
  }
  if (mod && k === 'y') {
    event.preventDefault();
    geRedo();
    return;
  }
  const del = event.key === 'Delete' || event.key === 'Backspace';
  if (ge.tab === 'level') {
    if (del) geDeleteActor();
    else if (mod && k === 'd') {
      event.preventDefault();
      geDuplicateActor();
    } else if (!mod && k === 'f') geFocusActor();
    else if (!mod && !event.altKey && ['w', 'e', 'r'].includes(k)) geSetVpTool({ w: 'move', e: 'rotate', r: 'scale' }[k]);
    else if (event.key.startsWith('Arrow') && geSelActor() && event.target.closest?.('.ge-viewport')) {
      event.preventDefault();
      const step = ge.project.settings.grid;
      const actor = geSelActor();
      const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      geChange(() => {
        actor.x += dx;
        actor.y += dy;
      }, { only: ['viewport', 'details'] });
    }
    return;
  }
  if (geIsAssetTab() || (!event.target.closest?.('.ge-graph, .ge-bpage') && event.target !== document.body)) return;
  // W Projektancie widgetu skróty działają na zaznaczonym elemencie, strzałki go przesuwają.
  if (geMode() === 'designer') {
    const sel = geWdSel(geCurBp());
    if (!sel) return;
    if (del) {
      event.preventDefault();
      geWidgetElementAction('del', sel.id);
    } else if (mod && k === 'd') {
      event.preventDefault();
      geWidgetElementAction('dup', sel.id);
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      const step = event.shiftKey ? 1 : 8;
      const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      geChange(() => {
        sel.x += dx;
        sel.y += dy;
      }, { only: ['details'] });
    }
    return;
  }
  // W Anim Graph skróty działają na zaznaczonym stanie, przejściu albo Jump Node.
  if (geMode() === 'animgraph') {
    geZdHandleKey(event, del, mod, k);
    return;
  }
  // W edytorze Timeline'u skróty działają na zaznaczonym kluczu ścieżki.
  if (geCurTl()) {
    geTlHandleKey(event, del);
    return;
  }
  // W Viewporcie i w panelu Komponenty skróty działają na zaznaczonym komponencie.
  if (geMode() === 'viewport' || event.target.closest?.('.ge-comps')) {
    const comp = ge.bpPanel?.kind === 'comp' ? ge.bpPanel.id : null;
    if (!comp) return;
    if (del) {
      event.preventDefault();
      geDeleteComponent(comp);
    } else if (mod && k === 'd') {
      event.preventDefault();
      geDuplicateComponent(comp);
    } else if (!mod && k === 'f') {
      geSetBpMode('viewport');
      geFocusComponent(comp);
    }
    return;
  }
  if (del) {
    event.preventDefault();
    geDeleteNodes();
  } else if (mod && k === 'c') geCopyNodes();
  else if (mod && k === 'x') {
    if (geCopyNodes()) geDeleteNodes();
  } else if (mod && k === 'v') gePasteNodes();
  else if (mod && k === 'd') {
    event.preventDefault();
    if (geCopyNodes()) gePasteNodes();
  } else if (mod && k === 'a') {
    event.preventDefault();
    ge.nodeSel = new Set(geCurGraph().nodes.map((n) => n.id));
    geSelectionChanged();
  } else if (!mod && k === 'c' && ge.nodeSel.size) geAddComment();
  else if (event.key === 'Home') geFitGraph();
}
