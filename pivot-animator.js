// Przeglądarkowy klon programu Pivot Animator: patyczaki z przegubami, pasek klatek,
// „cebulka” z poprzedniej klatki, odtwarzanie, klatki pośrednie i zapis do GIF-a.
// Otwiera się na pełnym ekranie po kliknięciu przycisku z atrybutem data-pivot-open.
// Projekt zapisuje się sam w localStorage, więc zamknięcie okna niczego nie kasuje.
let pivot = null;

const PIVOT_W = 640;
const PIVOT_H = 400;
const PIVOT_SAVE_KEY = 'pivot-animator-project';
const PIVOT_THUMB_W = 112;
const PIVOT_THUMB_H = 70;

// Każda postać to drzewo przegubów: punkt 0 to pomarańczowy uchwyt (przesuwa całość),
// a każdy odcinek [rodzic, dziecko, rodzaj] łączy dwa przeguby. Odcinki są w kolejności
// od korzenia, więc rodzic zawsze jest policzony przed dzieckiem.
const PIVOT_FIGURES = {
  stickman: {
    label: 'Ludzik',
    width: 9,
    joints: [[0, 0], [0, -52], [0, -94], [-22, -28], [-36, -2], [22, -28], [36, -2], [-14, 32], [-20, 70], [14, 32], [20, 70]],
    segments: [[0, 1, 'line'], [1, 2, 'circle'], [1, 3, 'line'], [3, 4, 'line'], [1, 5, 'line'], [5, 6, 'line'], [0, 7, 'line'], [7, 8, 'line'], [0, 9, 'line'], [9, 10, 'line']],
    // Która część z obrazka wyglądu pasuje do każdego odcinka i w jakiej kolejności je rysować
    // (nogi pod tułowiem, ręce na tułowiu, głowa z kapeluszem na samym wierzchu).
    skin: ['torso', 'head', 'upperArm', 'forearm', 'upperArm', 'forearm', 'thigh', 'shin', 'thigh', 'shin'],
    drawOrder: [6, 7, 8, 9, 0, 2, 3, 4, 5, 1],
    segmentLabels: ['Tułów', 'Głowa', 'Lewe ramię', 'Lewe przedramię', 'Prawe ramię', 'Prawe przedramię', 'Lewe udo', 'Lewa łydka', 'Prawe udo', 'Prawa łydka']
  },
  ball: {
    label: 'Piłka',
    width: 4,
    joints: [[0, 0], [0, -40]],
    segments: [[0, 1, 'circle']]
  },
  stick: {
    label: 'Kij',
    width: 6,
    joints: [[0, 0], [0, -60], [0, -120]],
    segments: [[0, 1, 'line'], [1, 2, 'line']]
  },
  dog: {
    label: 'Piesek',
    width: 8,
    joints: [[0, 0], [50, 0], [68, -22], [82, -30], [-14, -22], [-6, 22], [-10, 46], [44, 22], [40, 46], [6, 22], [2, 46], [58, 22], [54, 46]],
    segments: [[0, 1, 'line'], [1, 2, 'line'], [2, 3, 'circle'], [0, 4, 'line'], [0, 5, 'line'], [5, 6, 'line'], [1, 7, 'line'], [7, 8, 'line'], [0, 9, 'line'], [9, 10, 'line'], [1, 11, 'line'], [11, 12, 'line']]
  }
};

const PIVOT_COLORS = ['#000000', '#e53935', '#1e88e5', '#43a047', '#ff9800', '#8e24aa', '#6d4c41', '#ffffff'];
const PIVOT_BACKGROUNDS = [
  { scene: 'none', color: '#ffffff', label: 'Białe' },
  { scene: 'meadow', color: '#bfe6ff', label: 'Łąka' },
  { scene: 'night', color: '#1a2340', label: 'Noc' },
  { scene: 'beach', color: '#9bd8ff', label: 'Plaża' },
  { scene: 'none', color: '#fff5d6', label: 'Kremowe' },
  { scene: 'none', color: '#d9f2d0', label: 'Zielone' }
];

// Wygląd ludzika to jeden obrazek PNG 1536×1024 px (proporcje 3:2): siatka 3×2 pól po 512 px,
// w każdym polu jedna część ciała stojąca pionowo, wyśrodkowana w poziomie (x = 256 w polu).
// „top” i „bottom” to wysokości w polu, które trafiają na przeguby (np. bark i łokieć) — odstęp
// między nimi to długość odcinka ludzika × 6 px. „up” znaczy, że górny punkt to koniec odcinka.
const PIVOT_SKIN_W = 1536;
const PIVOT_SKIN_CELL = 512;
const PIVOT_SKIN_PARTS = {
  head: { cell: [0, 0], top: 176, bottom: 428, up: true },
  torso: { cell: [1, 0], top: 100, bottom: 412, up: true },
  upperArm: { cell: [2, 0], top: 158, bottom: 354 },
  forearm: { cell: [0, 1], top: 168, bottom: 345 },
  thigh: { cell: [1, 1], top: 151, bottom: 361 },
  shin: { cell: [2, 1], top: 140, bottom: 371 }
};
const PIVOT_SKINS = {
  kowboj: { label: 'Kowboj', src: 'assets/pivot-skins/kowboj.png' },
  policjant: { label: 'Policjant', src: 'assets/pivot-skins/policjant.png' },
  krolewna: { label: 'Królewna', src: 'assets/pivot-skins/krolewna.png' }
};
const pivotSkinImages = new Map();

Object.values(PIVOT_FIGURES).forEach((type) => {
  type.parent = type.joints.map(() => -1);
  type.children = type.joints.map(() => []);
  type.segments.forEach(([from, to]) => {
    type.parent[to] = from;
    type.children[from].push(to);
  });
});

const PIVOT_OPEN_KEY = 'pivot-animator-open';

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-pivot-open]')) openPivotAnimator();
});

// Po odświeżeniu strony wróć do edytora, jeśli był otwarty na tym samym zadaniu.
// Zadziała po app.js, który już narysował stronę zadania z przyciskiem otwierającym.
window.addEventListener('DOMContentLoaded', () => {
  let openedAt = null;
  try {
    openedAt = sessionStorage.getItem(PIVOT_OPEN_KEY);
  } catch {
    // Brak dostępu do pamięci karty — edytor po prostu się nie otworzy sam.
  }
  if (openedAt === window.location.hash && document.querySelector('[data-pivot-open]')) openPivotAnimator();
});

function openPivotAnimator() {
  if (pivot) return;
  const root = document.createElement('div');
  root.className = 'pv';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Web Pivot Animator');
  root.innerHTML = `
    <header class="pv-titlebar">
      <span class="pv-logo" aria-hidden="true">🏃</span>
      <strong class="pv-title">Web Pivot Animator</strong>
      <nav class="pv-menu" aria-label="Plik">
        <button type="button" data-pv="new">📄 Nowy</button>
        <button type="button" data-pv="open">📂 Otwórz</button>
        <button type="button" data-pv="save">💾 Zapisz projekt</button>
        <button type="button" data-pv="gif">🎞️ Zapisz GIF</button>
        <button type="button" data-pv="help">❓ Pomoc</button>
      </nav>
      <button class="pv-close" type="button" data-pv="close" aria-label="Zamknij Web Pivot Animator">×</button>
      <input class="pv-file" type="file" accept=".json,application/json" hidden />
      <input class="pv-bg-file" type="file" accept="image/*" hidden />
      <input class="pv-skin-file" type="file" accept="image/png" hidden />
    </header>
    <div class="pv-timeline">
      <div class="pv-transport">
        <button class="pv-play" type="button" data-pv="play" title="Odtwórz" aria-label="Odtwórz">▶</button>
        <button type="button" data-pv="stop" title="Stop" aria-label="Stop">■</button>
      </div>
      <div class="pv-strip" role="listbox" aria-label="Klatki animacji"></div>
    </div>
    <div class="pv-main">
      <aside class="pv-side">
        <section class="pv-group">
          <p class="pv-frame-label"></p>
          <div class="pv-row">
            <button type="button" data-pv="frame-left" title="Przesuń klatkę w lewo" aria-label="Przesuń klatkę w lewo">◀</button>
            <button type="button" data-pv="frame-delete" title="Usuń klatkę" aria-label="Usuń klatkę">✕</button>
            <button type="button" data-pv="frame-right" title="Przesuń klatkę w prawo" aria-label="Przesuń klatkę w prawo">▶</button>
          </div>
          <label class="pv-field">Klatki pośrednie
            <input class="pv-tweens" type="number" min="0" max="8" step="1" value="0" />
          </label>
        </section>
        <section class="pv-group">
          <label class="pv-check"><input class="pv-loop" type="checkbox" checked /> Zapętl</label>
          <label class="pv-field">Szybkość: <b class="pv-fps-label"></b>
            <input class="pv-fps" type="range" min="1" max="30" step="1" value="10" />
          </label>
          <label class="pv-check"><input class="pv-onion" type="checkbox" checked /> Pokaż poprzednią klatkę</label>
        </section>
        <section class="pv-group">
          <button class="pv-wide" type="button" data-pv="background">🖼️ Tło</button>
          <div class="pv-bg-panel" hidden>
            <div class="pv-bg-presets">
              ${PIVOT_BACKGROUNDS.map((bg, bgIndex) => `<button type="button" data-bg="${bgIndex}">${bg.label}</button>`).join('')}
            </div>
            <label class="pv-field pv-inline">Kolor <input class="pv-bg-color" type="color" value="#ffffff" /></label>
            <div class="pv-row">
              <button type="button" data-pv="bg-image">📷 Obrazek</button>
              <button type="button" data-pv="bg-clear">✕ Bez obrazka</button>
            </div>
          </div>
          <div class="pv-row">
            <select class="pv-figure-type" aria-label="Rodzaj postaci">
              ${Object.entries(PIVOT_FIGURES).map(([key, type]) => `<option value="${key}">${type.label}</option>`).join('')}
            </select>
            <button type="button" data-pv="add-figure">➕ Dodaj postać</button>
          </div>
        </section>
        <section class="pv-group pv-figure-tools">
          <p class="pv-figure-label">Kliknij postać, żeby ją wybrać.</p>
          <div class="pv-swatches">
            ${PIVOT_COLORS.map((color) => `<button class="pv-swatch" type="button" data-color="${color}" style="--swatch: ${color}" aria-label="Kolor ${color}"></button>`).join('')}
            <label class="pv-swatch pv-swatch-custom" title="Inny kolor"><input class="pv-figure-color" type="color" value="#000000" aria-label="Inny kolor" /></label>
          </div>
          <label class="pv-field">Rozmiar: <b class="pv-size-label"></b>
            <input class="pv-size" type="range" min="0.3" max="3" step="0.05" value="1" />
          </label>
          <div class="pv-skin" hidden>
            <label class="pv-field">Wygląd całej postaci
              <select class="pv-skin-all"></select>
            </label>
            <div class="pv-row">
              <button type="button" data-pv="skin-download" title="Pobierz obrazek z częściami ciała">⬇ Pobierz</button>
              <button type="button" data-pv="skin-upload" title="Wgraj własny obrazek z częściami ciała (PNG 3:2)">⬆ Wgraj</button>
            </div>
            <details class="pv-advanced">
              <summary>Zaawansowane</summary>
              <label class="pv-field">Wygląd części: <b class="pv-part-label"></b>
                <select class="pv-skin-part"></select>
              </label>
            </details>
          </div>
          <div class="pv-tool-grid">
            <button type="button" data-pv="flip" title="Odbij w poziomie">⇋ Odbij</button>
            <button type="button" data-pv="duplicate" title="Powiel postać">⧉ Powiel</button>
            <button type="button" data-pv="front" title="Przenieś na wierzch">⬆ Wierzch</button>
            <button type="button" data-pv="back" title="Przenieś pod spód">⬇ Spód</button>
            <button type="button" data-pv="undo" title="Cofnij (Ctrl+Z)">↶ Cofnij</button>
            <button type="button" data-pv="delete-figure" title="Usuń postać z tej klatki">✕ Usuń</button>
          </div>
        </section>
        <button class="pv-add-frame" type="button" data-pv="add-frame">Dodaj klatkę</button>
      </aside>
      <div class="pv-stage">
        <canvas class="pv-canvas" width="${PIVOT_W}" height="${PIVOT_H}" aria-label="Płótno animacji"></canvas>
      </div>
    </div>
    <footer class="pv-statusbar">
      <span class="pv-status"></span>
      <span class="pv-stats"></span>
    </footer>
    <div class="pv-help" hidden>
      <div class="pv-help-card">
        <h2>Jak zrobić animację?</h2>
        <ol>
          <li>Przeciągaj <b class="pv-dot is-red"></b> <b>czerwone kropki</b>, żeby zginać ręce, nogi i głowę.</li>
          <li>Przeciągnij <b class="pv-dot is-orange"></b> <b>pomarańczową kropkę</b> (albo samą postać), żeby przesunąć całą postać.</li>
          <li>Kliknij <b>Dodaj klatkę</b>. Nowa klatka jest kopią poprzedniej — zmień w niej postać tylko <b>trochę</b>.</li>
          <li>Powtarzaj. Szary cień pokazuje poprzednią klatkę, więc łatwo o płynny ruch.</li>
          <li>Kliknij <b>Odtwórz</b>, a na koniec <b>Zapisz GIF</b>.</li>
        </ol>
        <p>Z <b>Shift</b> kropka wydłuża lub skraca odcinek. <b>Ctrl+Z</b> cofa, <b>←</b> <b>→</b> zmieniają klatkę.</p>
        <button class="primary-button" type="button" data-pv="help-close">Rozumiem</button>
      </div>
    </div>
  `;
  document.body.append(root);
  document.body.classList.add('pv-open');
  try {
    sessionStorage.setItem(PIVOT_OPEN_KEY, window.location.hash);
  } catch {
    // Bez pamięci karty edytor nie wróci sam po odświeżeniu.
  }

  const canvas = root.querySelector('.pv-canvas');
  pivot = {
    root,
    canvas,
    ctx: canvas.getContext('2d'),
    stage: root.querySelector('.pv-stage'),
    strip: root.querySelector('.pv-strip'),
    frames: [],
    cur: 0,
    selected: null,
    part: null,
    customSkins: {},
    nextId: 1,
    bg: { scene: 'none', color: '#ffffff', image: '' },
    bgImage: null,
    fps: 10,
    tweens: 0,
    loop: true,
    onion: true,
    drag: null,
    playing: null,
    history: [],
    busy: false,
    renderQueued: false,
    resizeObserver: null
  };

  const saved = readPivotSave();
  if (saved) applyPivotProject(saved);
  else resetPivotProject();

  bindPivotEvents();
  pivot.resizeObserver = new ResizeObserver(fitPivotCanvas);
  pivot.resizeObserver.observe(pivot.stage);
  fitPivotCanvas();
  refreshPivot();
  if (!saved) togglePivotHelp(true);
  else setPivotStatus('Wczytano zapisaną animację. Przeciągaj czerwone kropki, żeby poruszać postacią.');
  root.querySelector('.pv-add-frame').focus();
}

function stopPivotAnimator() {
  if (!pivot) return;
  stopPivotPlayback();
  savePivotProject();
  pivot.resizeObserver.disconnect();
  document.removeEventListener('keydown', handlePivotKey);
  pivot.root.remove();
  document.body.classList.remove('pv-open');
  pivot = null;
  try {
    sessionStorage.removeItem(PIVOT_OPEN_KEY);
  } catch {
    // Nic do sprzątania.
  }
}

// ---------- Projekt ----------

function createPivotFigure(typeKey, x, y) {
  const type = PIVOT_FIGURES[typeKey];
  return {
    id: pivot.nextId++,
    type: typeKey,
    color: '#000000',
    size: 1,
    joints: type.joints.map(([jx, jy]) => [x + jx, y + jy])
  };
}

function resetPivotProject() {
  pivot.nextId = 1;
  pivot.frames = [{ figures: [createPivotFigure('stickman', PIVOT_W / 2, PIVOT_H - 110)] }];
  pivot.cur = 0;
  pivot.selected = pivot.frames[0].figures[0].id;
  pivot.part = null;
  pivot.customSkins = {};
  pivot.bg = { scene: 'none', color: '#ffffff', image: '' };
  pivot.bgImage = null;
  pivot.history = [];
}

function pivotProjectData() {
  return {
    app: 'pivot-web',
    version: 1,
    fps: pivot.fps,
    tweens: pivot.tweens,
    loop: pivot.loop,
    bg: pivot.bg,
    skins: pivot.customSkins,
    frames: pivot.frames
  };
}

function applyPivotProject(data) {
  const frames = Array.isArray(data.frames) ? data.frames : [];
  const valid = frames.length && frames.every((frame) => Array.isArray(frame.figures) && frame.figures.every((fig) =>
    PIVOT_FIGURES[fig.type] && Array.isArray(fig.joints) && fig.joints.length === PIVOT_FIGURES[fig.type].joints.length));
  if (!valid) return false;
  pivot.frames = frames;
  pivot.cur = 0;
  pivot.nextId = Math.max(0, ...frames.flatMap((frame) => frame.figures.map((fig) => fig.id))) + 1;
  pivot.selected = null;
  pivot.part = null;
  pivot.customSkins = Object.fromEntries(Object.entries(data.skins && typeof data.skins === 'object' ? data.skins : {})
    .filter(([, skin]) => typeof skin?.src === 'string' && skin.src.startsWith('data:image/')));
  pivot.fps = Math.min(30, Math.max(1, Number(data.fps) || 10));
  pivot.tweens = Math.min(8, Math.max(0, Number(data.tweens) || 0));
  pivot.loop = data.loop !== false;
  pivot.bg = { scene: 'none', color: '#ffffff', image: '', ...(data.bg || {}) };
  pivot.history = [];
  loadPivotBackgroundImage();
  return true;
}

function readPivotSave() {
  try {
    const raw = localStorage.getItem(PIVOT_SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePivotProject() {
  const data = pivotProjectData();
  // Za duże obrazki (tło, własne wyglądy): zapisz chociaż postacie i klatki.
  const attempts = [data, { ...data, bg: { ...data.bg, image: '' } }, { ...data, bg: { ...data.bg, image: '' }, skins: {} }];
  for (const attempt of attempts) {
    try {
      localStorage.setItem(PIVOT_SAVE_KEY, JSON.stringify(attempt));
      return;
    } catch {
      // Spróbuj mniejszej wersji. Bez dostępu do pamięci przeglądarki animacja zostaje tylko na ekranie.
    }
  }
}

function loadPivotBackgroundImage() {
  pivot.bgImage = null;
  if (!pivot.bg.image) return;
  const image = new Image();
  image.onload = () => {
    if (!pivot || pivot.bg.image !== image.src) return;
    pivot.bgImage = image;
    refreshPivot();
  };
  image.src = pivot.bg.image;
}

function pushPivotHistory() {
  pivot.history.push(JSON.stringify({ frames: pivot.frames, cur: pivot.cur }));
  if (pivot.history.length > 60) pivot.history.shift();
}

function undoPivot() {
  const last = pivot.history.pop();
  if (!last) {
    setPivotStatus('Nie ma już czego cofnąć.');
    return;
  }
  const snapshot = JSON.parse(last);
  pivot.frames = snapshot.frames;
  pivot.cur = Math.min(snapshot.cur, pivot.frames.length - 1);
  if (!currentPivotFigure()) { pivot.selected = null; pivot.part = null; }
  refreshPivot();
}

function currentPivotFrame() {
  return pivot.frames[pivot.cur];
}

function currentPivotFigure() {
  return currentPivotFrame().figures.find((fig) => fig.id === pivot.selected) || null;
}

// ---------- Rysowanie ----------

function drawPivotBackground(ctx) {
  const { scene, color } = pivot.bg;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, PIVOT_W, PIVOT_H);

  if (scene === 'meadow') {
    const sky = ctx.createLinearGradient(0, 0, 0, PIVOT_H);
    sky.addColorStop(0, '#7cc8ff');
    sky.addColorStop(1, '#d8f0ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, PIVOT_W, PIVOT_H);
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(560, 70, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    [[120, 70], [300, 50]].forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.arc(cx + 24, cy - 8, 24, 0, Math.PI * 2);
      ctx.arc(cx + 50, cy, 18, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#7bc96f';
    ctx.beginPath();
    ctx.moveTo(0, 300);
    ctx.quadraticCurveTo(160, 260, 330, 296);
    ctx.quadraticCurveTo(500, 330, PIVOT_W, 284);
    ctx.lineTo(PIVOT_W, PIVOT_H);
    ctx.lineTo(0, PIVOT_H);
    ctx.fill();
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, 346, PIVOT_W, PIVOT_H - 346);
  } else if (scene === 'night') {
    ctx.fillStyle = '#ffffff';
    for (let star = 0; star < 60; star += 1) {
      const sx = (star * 97) % PIVOT_W;
      const sy = (star * 53) % 300;
      ctx.fillRect(sx, sy, star % 3 ? 2 : 3, star % 3 ? 2 : 3);
    }
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(530, 80, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(544, 70, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e3b2c';
    ctx.fillRect(0, 346, PIVOT_W, PIVOT_H - 346);
  } else if (scene === 'beach') {
    ctx.fillStyle = '#2f8fd8';
    ctx.fillRect(0, 250, PIVOT_W, 70);
    ctx.fillStyle = '#f3d98b';
    ctx.beginPath();
    ctx.moveTo(0, 330);
    ctx.quadraticCurveTo(320, 300, PIVOT_W, 326);
    ctx.lineTo(PIVOT_W, PIVOT_H);
    ctx.lineTo(0, PIVOT_H);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(90, 80, 36, 0, Math.PI * 2);
    ctx.fill();
  }

  if (pivot.bgImage) {
    const image = pivot.bgImage;
    const scale = Math.max(PIVOT_W / image.width, PIVOT_H / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, (PIVOT_W - w) / 2, (PIVOT_H - h) / 2, w, h);
  }
}

function pivotSkinInfo(key) {
  return PIVOT_SKINS[key] || pivot?.customSkins[key] || null;
}

// Obrazek wyglądu, jeśli już się wczytał. Wczytuje go przy pierwszym użyciu i odświeża płótno.
function pivotSkinImage(key) {
  const info = pivotSkinInfo(key);
  if (!info) return null;
  let entry = pivotSkinImages.get(info.src);
  if (!entry) {
    entry = { image: new Image(), ready: false };
    pivotSkinImages.set(info.src, entry);
    entry.image.onload = () => {
      entry.ready = true;
      if (pivot && !pivot.playing) {
        renderPivotStrip();
        renderPivotCanvas();
      }
    };
    entry.image.onerror = () => {
      if (pivot) setPivotStatus(`Nie udało się wczytać wyglądu „${info.label}” — postać zostaje patyczakiem.`);
    };
    entry.image.src = info.src;
  }
  return entry.ready ? entry.image : null;
}

// Jedna część ciała z obrazka wyglądu: górny punkt pola trafia na jeden przegub, dolny na drugi.
function drawPivotSkinPart(ctx, image, part, from, to) {
  const [top, bottom] = part.up ? [to, from] : [from, to];
  const length = Math.hypot(bottom[0] - top[0], bottom[1] - top[1]);
  if (length < 0.5) return;
  const k = image.naturalWidth / PIVOT_SKIN_W;
  const cell = PIVOT_SKIN_CELL * k;
  const scale = length / ((part.bottom - part.top) * k);
  ctx.save();
  ctx.translate(top[0], top[1]);
  ctx.rotate(Math.atan2(bottom[1] - top[1], bottom[0] - top[0]) - Math.PI / 2);
  ctx.scale(scale, scale);
  ctx.drawImage(image, part.cell[0] * cell, part.cell[1] * cell, cell, cell, -cell / 2, -part.top * k, cell, cell);
  ctx.restore();
}

function drawPivotFigure(ctx, fig, colorOverride) {
  const type = PIVOT_FIGURES[fig.type];
  const color = colorOverride || fig.color;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = type.width * fig.size;
  (type.drawOrder || type.segments.map((_, index) => index)).forEach((index) => {
    const [from, to, kind] = type.segments[index];
    const image = type.skin && fig.skin?.[index] ? pivotSkinImage(fig.skin[index]) : null;
    if (image) {
      drawPivotSkinPart(ctx, image, PIVOT_SKIN_PARTS[type.skin[index]], fig.joints[from], fig.joints[to]);
      return;
    }
    const [ax, ay] = fig.joints[from];
    const [bx, by] = fig.joints[to];
    ctx.beginPath();
    if (kind === 'circle') {
      ctx.arc((ax + bx) / 2, (ay + by) / 2, Math.hypot(bx - ax, by - ay) / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  });
}

function drawPivotHandles(ctx, frame) {
  const radius = 4.5 * pivotCanvasRatio();
  const selectedFig = frame.figures.find((fig) => fig.id === pivot.selected);
  const partSegment = selectedFig && pivot.part !== null ? PIVOT_FIGURES[selectedFig.type].segments[pivot.part] : null;
  if (partSegment) {
    const [from, to, kind] = partSegment;
    const [ax, ay] = selectedFig.joints[from];
    const [bx, by] = selectedFig.joints[to];
    ctx.save();
    ctx.strokeStyle = 'rgba(28, 176, 246, 0.55)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 7 * pivotCanvasRatio();
    ctx.beginPath();
    if (kind === 'circle') ctx.arc((ax + bx) / 2, (ay + by) / 2, Math.hypot(bx - ax, by - ay) / 2, 0, Math.PI * 2);
    else {
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
    ctx.restore();
  }
  frame.figures.forEach((fig) => {
    const selected = fig.id === pivot.selected;
    fig.joints.forEach(([x, y], jointIndex) => {
      ctx.beginPath();
      ctx.arc(x, y, selected ? radius * 1.2 : radius, 0, Math.PI * 2);
      ctx.fillStyle = jointIndex === 0 ? '#ff9800' : '#e53935';
      ctx.fill();
      ctx.lineWidth = selected ? 1.6 : 1;
      ctx.strokeStyle = selected ? '#ffffff' : 'rgba(0, 0, 0, 0.35)';
      ctx.stroke();
    });
  });
}

function drawPivotFrame(ctx, frame, options = {}) {
  drawPivotBackground(ctx);
  if (options.onion) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    options.onion.figures.forEach((fig) => drawPivotFigure(ctx, fig, '#555555'));
    ctx.restore();
  }
  frame.figures.forEach((fig) => drawPivotFigure(ctx, fig));
  if (options.handles) drawPivotHandles(ctx, frame);
}

function renderPivotCanvas() {
  pivot.renderQueued = false;
  if (pivot.playing) return;
  const onion = pivot.onion && pivot.cur > 0 ? pivot.frames[pivot.cur - 1] : null;
  drawPivotFrame(pivot.ctx, currentPivotFrame(), { handles: true, onion });
}

function queuePivotRender() {
  if (pivot.renderQueued) return;
  pivot.renderQueued = true;
  requestAnimationFrame(() => pivot && renderPivotCanvas());
}

function drawPivotThumb(canvas, frame) {
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(PIVOT_THUMB_W / PIVOT_W, PIVOT_THUMB_H / PIVOT_H);
  drawPivotFrame(ctx, frame);
  ctx.restore();
}

function renderPivotStrip() {
  pivot.strip.innerHTML = pivot.frames.map((frame, frameIndex) => `
    <button class="pv-thumb${frameIndex === pivot.cur ? ' is-current' : ''}" type="button" role="option" aria-selected="${frameIndex === pivot.cur}" data-frame="${frameIndex}" aria-label="Klatka ${frameIndex + 1}">
      <canvas width="${PIVOT_THUMB_W}" height="${PIVOT_THUMB_H}"></canvas>
      <span>${frameIndex + 1}</span>
    </button>`).join('');
  pivot.strip.querySelectorAll('.pv-thumb').forEach((thumb, frameIndex) => drawPivotThumb(thumb.querySelector('canvas'), pivot.frames[frameIndex]));
  scrollPivotThumbIntoView(pivot.cur);
}

function updatePivotThumb(frameIndex) {
  const canvas = pivot.strip.querySelector(`[data-frame="${frameIndex}"] canvas`);
  if (canvas) drawPivotThumb(canvas, pivot.frames[frameIndex]);
}

function markPivotThumb(frameIndex) {
  pivot.strip.querySelectorAll('.pv-thumb').forEach((thumb, thumbIndex) => {
    thumb.classList.toggle('is-current', thumbIndex === frameIndex);
    thumb.setAttribute('aria-selected', String(thumbIndex === frameIndex));
  });
  scrollPivotThumbIntoView(frameIndex);
}

function scrollPivotThumbIntoView(frameIndex) {
  const thumb = pivot.strip.querySelector(`[data-frame="${frameIndex}"]`);
  if (!thumb) return;
  const left = thumb.offsetLeft - pivot.strip.offsetLeft;
  if (left < pivot.strip.scrollLeft || left + thumb.offsetWidth > pivot.strip.scrollLeft + pivot.strip.clientWidth) {
    pivot.strip.scrollLeft = left - (pivot.strip.clientWidth - thumb.offsetWidth) / 2;
  }
}

function refreshPivot() {
  renderPivotStrip();
  updatePivotPanel();
  renderPivotCanvas();
  savePivotProject();
}

function updatePivotPanel() {
  const { root } = pivot;
  root.querySelector('.pv-frame-label').innerHTML = `Klatka <b>${pivot.cur + 1}</b> z ${pivot.frames.length}`;
  root.querySelector('[data-pv="frame-left"]').disabled = pivot.cur === 0;
  root.querySelector('[data-pv="frame-right"]').disabled = pivot.cur === pivot.frames.length - 1;
  root.querySelector('[data-pv="frame-delete"]').disabled = pivot.frames.length === 1;
  root.querySelector('[data-pv="undo"]').disabled = !pivot.history.length;
  root.querySelector('.pv-tweens').value = pivot.tweens;
  root.querySelector('.pv-loop').checked = pivot.loop;
  root.querySelector('.pv-onion').checked = pivot.onion;
  root.querySelector('.pv-fps').value = pivot.fps;
  root.querySelector('.pv-fps-label').textContent = `${pivot.fps} klatek/s`;
  root.querySelector('.pv-bg-color').value = pivot.bg.color;

  const fig = currentPivotFigure();
  const tools = root.querySelector('.pv-figure-tools');
  tools.classList.toggle('is-empty', !fig);
  tools.querySelectorAll('button, input, select').forEach((control) => {
    if (control.dataset.pv !== 'undo') control.disabled = !fig;
  });
  updatePivotSkinPanel(fig);
  root.querySelector('.pv-figure-label').innerHTML = fig
    ? `Wybrana postać: <b>${PIVOT_FIGURES[fig.type].label}</b>`
    : 'Kliknij postać, żeby ją wybrać.';
  if (fig) {
    root.querySelector('.pv-size').value = fig.size;
    root.querySelector('.pv-size-label').textContent = `${Math.round(fig.size * 100)}%`;
    root.querySelector('.pv-figure-color').value = fig.color;
    root.querySelector('.pv-swatch-custom').style.setProperty('--swatch', fig.color);
    tools.querySelectorAll('.pv-swatch[data-color]').forEach((swatch) => swatch.classList.toggle('is-active', swatch.dataset.color === fig.color));
  } else {
    root.querySelector('.pv-size-label').textContent = '—';
  }

  const seconds = pivotSequence().length / pivot.fps;
  root.querySelector('.pv-stats').innerHTML = `Klatki: <b>${pivot.frames.length}</b> · Czas: <b>${seconds.toFixed(1).replace('.', ',')} s</b>`;
}

function pivotSkinOptions(selected) {
  const skins = [['', 'Patyczak'], ...Object.entries(PIVOT_SKINS).map(([key, skin]) => [key, skin.label]),
    ...Object.entries(pivot.customSkins).map(([key, skin]) => [key, skin.label])];
  const mixed = selected === null ? '<option value="" disabled selected>Mieszany</option>' : '';
  return mixed + skins.map(([key, label]) => `<option value="${key}"${key === selected ? ' selected' : ''}>${label}</option>`).join('');
}

function updatePivotSkinPanel(fig) {
  const panel = pivot.root.querySelector('.pv-skin');
  const type = fig && PIVOT_FIGURES[fig.type];
  panel.hidden = !type?.skin;
  if (panel.hidden) return;
  const skin = type.segments.map((_, index) => fig.skin?.[index] || '');
  panel.querySelector('.pv-skin-all').innerHTML = pivotSkinOptions(skin.every((key) => key === skin[0]) ? skin[0] : null);
  const partSelect = panel.querySelector('.pv-skin-part');
  const hasPart = pivot.part !== null && pivot.part < skin.length;
  partSelect.innerHTML = pivotSkinOptions(hasPart ? skin[pivot.part] : '');
  partSelect.disabled = !hasPart;
  panel.querySelector('.pv-part-label').textContent = hasPart ? type.segmentLabels[pivot.part] : 'kliknij część ludzika';
}

function setPivotStatus(text) {
  pivot.root.querySelector('.pv-status').textContent = text;
}

function fitPivotCanvas() {
  if (!pivot) return;
  const styles = getComputedStyle(pivot.stage);
  const width = pivot.stage.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
  const height = pivot.stage.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
  const scale = Math.max(0.1, Math.min(width / PIVOT_W, height / PIVOT_H));
  pivot.canvas.style.width = `${Math.floor(PIVOT_W * scale)}px`;
  pivot.canvas.style.height = `${Math.floor(PIVOT_H * scale)}px`;
  queuePivotRender();
}

// Ile jednostek płótna przypada na jeden piksel ekranu (uchwyty mają stały rozmiar na ekranie).
function pivotCanvasRatio() {
  const width = pivot.canvas.getBoundingClientRect().width;
  return width ? Math.min(3, Math.max(0.6, PIVOT_W / width)) : 1;
}

// ---------- Przeciąganie ----------

function pivotPointer(event) {
  const rect = pivot.canvas.getBoundingClientRect();
  return [(event.clientX - rect.left) * (PIVOT_W / rect.width), (event.clientY - rect.top) * (PIVOT_H / rect.height)];
}

function findPivotHandle(point, touch) {
  const reach = (touch ? 16 : 10) * pivotCanvasRatio();
  let best = null;
  const figures = currentPivotFrame().figures;
  for (let figIndex = figures.length - 1; figIndex >= 0; figIndex -= 1) {
    const fig = figures[figIndex];
    fig.joints.forEach(([x, y], joint) => {
      const distance = Math.hypot(point[0] - x, point[1] - y);
      // Przy remisie wygrywa wybrana postać, a potem dalszy przegub (dłoń przed łokciem).
      const score = distance - (fig.id === pivot.selected ? 2 : 0);
      if (distance <= reach && (!best || score <= best.score)) best = { fig, joint, score };
    });
  }
  return best;
}

function findPivotFigureAt(point) {
  const figures = currentPivotFrame().figures;
  for (let figIndex = figures.length - 1; figIndex >= 0; figIndex -= 1) {
    const fig = figures[figIndex];
    const type = PIVOT_FIGURES[fig.type];
    // Od wierzchu: głowa i ręce wygrywają z tułowiem, który leży pod nimi.
    const order = [...(type.drawOrder || type.segments.map((_, index) => index))].reverse();
    const segment = order.find((index) => {
      const [from, to, kind] = type.segments[index];
      const a = fig.joints[from];
      const b = fig.joints[to];
      if (kind === 'circle') {
        const radius = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
        return Math.hypot(point[0] - (a[0] + b[0]) / 2, point[1] - (a[1] + b[1]) / 2) <= radius + 3;
      }
      // Części z obrazka są grubsze niż kreska patyczaka.
      const half = fig.skin?.[index] ? 12 * fig.size : (type.width * fig.size) / 2 + 4;
      return pivotSegmentDistance(point, a, b) <= half;
    });
    if (segment !== undefined) return { fig, segment };
  }
  return null;
}

function pivotSegmentDistance([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function pivotSubtree(type, joint) {
  const result = [joint];
  for (let i = 0; i < result.length; i += 1) result.push(...type.children[result[i]]);
  return result;
}

function handlePivotPointerDown(event) {
  if (pivot.playing || pivot.busy || event.button > 0) return;
  const point = pivotPointer(event);
  const handle = findPivotHandle(point, event.pointerType === 'touch');
  const hit = handle ? null : findPivotFigureAt(point);
  const fig = handle ? handle.fig : hit?.fig;
  if (!fig) {
    pivot.selected = null;
    pivot.part = null;
    updatePivotPanel();
    renderPivotCanvas();
    return;
  }
  pushPivotHistory();
  // Kropka wybiera odcinek, który się na niej kończy (łokieć → ramię), pomarańczowa — żaden.
  const segments = PIVOT_FIGURES[fig.type].segments;
  const part = handle ? segments.findIndex(([, to]) => to === handle.joint) : hit.segment;
  pivot.part = part >= 0 ? part : null;
  pivot.selected = fig.id;
  pivot.drag = { fig, joint: handle ? handle.joint : 0, last: point, stretch: event.shiftKey };
  pivot.canvas.setPointerCapture(event.pointerId);
  pivot.canvas.classList.add('is-dragging');
  updatePivotPanel();
  renderPivotCanvas();
  event.preventDefault();
}

function handlePivotPointerMove(event) {
  if (!pivot.drag) {
    if (event.pointerType === 'mouse' && !pivot.playing) {
      const point = pivotPointer(event);
      pivot.canvas.style.cursor = findPivotHandle(point) ? 'pointer' : findPivotFigureAt(point) ? 'move' : 'default';
    }
    return;
  }
  const point = pivotPointer(event);
  const { fig, joint } = pivot.drag;
  const type = PIVOT_FIGURES[fig.type];

  if (joint === 0) {
    const dx = point[0] - pivot.drag.last[0];
    const dy = point[1] - pivot.drag.last[1];
    fig.joints.forEach((position) => {
      position[0] += dx;
      position[1] += dy;
    });
  } else {
    const pivotJoint = fig.joints[type.parent[joint]];
    const moving = pivotSubtree(type, joint);
    if (pivot.drag.stretch || event.shiftKey) {
      // Rozciąganie: przegub idzie za kursorem, dalsze części przesuwają się razem z nim.
      const dx = point[0] - fig.joints[joint][0];
      const dy = point[1] - fig.joints[joint][1];
      moving.forEach((index) => {
        fig.joints[index][0] += dx;
        fig.joints[index][1] += dy;
      });
    } else {
      // Obrót: cała dalsza część kończyny obraca się wokół przegubu-rodzica.
      const [cx, cy] = pivotJoint;
      const before = Math.atan2(fig.joints[joint][1] - cy, fig.joints[joint][0] - cx);
      const after = Math.atan2(point[1] - cy, point[0] - cx);
      const cos = Math.cos(after - before);
      const sin = Math.sin(after - before);
      moving.forEach((index) => {
        const x = fig.joints[index][0] - cx;
        const y = fig.joints[index][1] - cy;
        fig.joints[index][0] = cx + x * cos - y * sin;
        fig.joints[index][1] = cy + x * sin + y * cos;
      });
    }
  }
  pivot.drag.last = point;
  queuePivotRender();
}

function handlePivotPointerUp() {
  if (!pivot.drag) return;
  pivot.drag = null;
  pivot.canvas.classList.remove('is-dragging');
  updatePivotThumb(pivot.cur);
  updatePivotPanel();
  savePivotProject();
}

// ---------- Klatki ----------

function selectPivotFrame(frameIndex) {
  if (pivot.playing) stopPivotPlayback();
  pivot.cur = Math.max(0, Math.min(pivot.frames.length - 1, frameIndex));
  if (!currentPivotFigure()) { pivot.selected = currentPivotFrame().figures[0]?.id ?? null; pivot.part = null; }
  markPivotThumb(pivot.cur);
  updatePivotPanel();
  renderPivotCanvas();
}

function addPivotFrame() {
  if (pivot.playing) stopPivotPlayback();
  pushPivotHistory();
  pivot.frames.splice(pivot.cur + 1, 0, JSON.parse(JSON.stringify(currentPivotFrame())));
  pivot.cur += 1;
  refreshPivot();
  setPivotStatus(`Dodano klatkę ${pivot.cur + 1}. Zmień postać tylko trochę — ruch będzie płynny.`);
}

function deletePivotFrame() {
  if (pivot.frames.length === 1) return;
  pushPivotHistory();
  pivot.frames.splice(pivot.cur, 1);
  pivot.cur = Math.min(pivot.cur, pivot.frames.length - 1);
  if (!currentPivotFigure()) { pivot.selected = null; pivot.part = null; }
  refreshPivot();
}

function movePivotFrame(direction) {
  const target = pivot.cur + direction;
  if (target < 0 || target >= pivot.frames.length) return;
  pushPivotHistory();
  [pivot.frames[pivot.cur], pivot.frames[target]] = [pivot.frames[target], pivot.frames[pivot.cur]];
  pivot.cur = target;
  refreshPivot();
}

// ---------- Postacie ----------

function addPivotFigure() {
  pushPivotHistory();
  const typeKey = pivot.root.querySelector('.pv-figure-type').value;
  const offset = [0, 150, -170, 240, -240][currentPivotFrame().figures.length % 5];
  const y = typeKey === 'ball' ? PIVOT_H - 60 : typeKey === 'stick' ? PIVOT_H - 60 : typeKey === 'dog' ? PIVOT_H - 80 : PIVOT_H - 110;
  const fig = createPivotFigure(typeKey, PIVOT_W / 2 + offset, y);
  currentPivotFrame().figures.push(fig);
  pivot.selected = fig.id;
  pivot.part = null;
  refreshPivot();
  setPivotStatus(`Dodano postać: ${PIVOT_FIGURES[typeKey].label}. Pojawi się też w każdej nowej klatce.`);
}

function editPivotFigure(action) {
  const fig = currentPivotFigure();
  if (!fig) return;
  const figures = currentPivotFrame().figures;
  const index = figures.indexOf(fig);
  pushPivotHistory();

  if (action === 'flip') {
    const rootX = fig.joints[0][0];
    fig.joints.forEach((position) => { position[0] = 2 * rootX - position[0]; });
  } else if (action === 'duplicate') {
    const copy = JSON.parse(JSON.stringify(fig));
    copy.id = pivot.nextId++;
    copy.joints.forEach((position) => { position[0] += 30; });
    figures.push(copy);
    pivot.selected = copy.id;
  } else if (action === 'front') {
    figures.push(...figures.splice(index, 1));
  } else if (action === 'back') {
    figures.unshift(...figures.splice(index, 1));
  } else if (action === 'delete-figure') {
    figures.splice(index, 1);
    pivot.selected = null;
    pivot.part = null;
  }
  refreshPivot();
}

function setPivotFigureColor(color) {
  const fig = currentPivotFigure();
  if (!fig || fig.color === color) return;
  pushPivotHistory();
  // Kolor należy do postaci, więc zmienia się we wszystkich klatkach.
  pivot.frames.forEach((frame) => frame.figures.forEach((item) => {
    if (item.id === fig.id) item.color = color;
  }));
  refreshPivot();
}

function setPivotFigureSize(size) {
  const fig = currentPivotFigure();
  if (!fig) return;
  const factor = size / fig.size;
  const [rx, ry] = fig.joints[0];
  fig.joints.forEach((position) => {
    position[0] = rx + (position[0] - rx) * factor;
    position[1] = ry + (position[1] - ry) * factor;
  });
  fig.size = size;
  pivot.root.querySelector('.pv-size-label').textContent = `${Math.round(size * 100)}%`;
  queuePivotRender();
}

// Wygląd zmienia się tylko w aktywnej klatce (nowe klatki go skopiują). Bez numeru części — cała postać.
function setPivotFigureSkin(key, segment = null) {
  const fig = currentPivotFigure();
  if (!fig || !PIVOT_FIGURES[fig.type].skin) return;
  pushPivotHistory();
  const skin = PIVOT_FIGURES[fig.type].segments.map((_, index) => fig.skin?.[index] || '');
  if (segment === null) skin.fill(key);
  else skin[segment] = key;
  if (skin.some(Boolean)) fig.skin = skin;
  else delete fig.skin;
  refreshPivot();
  const label = pivotSkinInfo(key)?.label || 'Patyczak';
  setPivotStatus(segment === null ? `Wygląd postaci: ${label}.` : `${PIVOT_FIGURES[fig.type].segmentLabels[segment]}: ${label}.`);
}

// Pusty szablon: części patyczaka dokładnie tam, gdzie mają być narysowane w obrazku wyglądu.
function pivotSkinTemplate() {
  const canvas = document.createElement('canvas');
  canvas.width = PIVOT_SKIN_W;
  canvas.height = PIVOT_SKIN_CELL * 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineCap = 'round';
  ctx.lineWidth = PIVOT_FIGURES.stickman.width * 6;
  Object.entries(PIVOT_SKIN_PARTS).forEach(([name, part]) => {
    const x = part.cell[0] * PIVOT_SKIN_CELL + PIVOT_SKIN_CELL / 2;
    const y = part.cell[1] * PIVOT_SKIN_CELL;
    ctx.beginPath();
    if (name === 'head') ctx.arc(x, y + (part.top + part.bottom) / 2, (part.bottom - part.top) / 2, 0, Math.PI * 2);
    else {
      ctx.moveTo(x, y + part.top);
      ctx.lineTo(x, y + part.bottom);
    }
    if (name === 'head') ctx.fill();
    else ctx.stroke();
  });
  return canvas;
}

function downloadPivotSkin() {
  const fig = currentPivotFigure();
  if (!fig) return;
  const key = (pivot.part !== null && fig.skin?.[pivot.part]) || fig.skin?.find(Boolean) || '';
  const info = pivotSkinInfo(key);
  if (!info) {
    pivotSkinTemplate().toBlob((blob) => downloadPivotBlob(blob, 'ludzik-szablon.png'));
    setPivotStatus('Pobrano szablon ludzik-szablon.png. Narysuj części ciała na kreskach i wgraj obrazek przyciskiem Wgraj.');
    return;
  }
  const link = document.createElement('a');
  link.href = info.src;
  link.download = `${info.label.toLowerCase().replace(/\s+/g, '-')}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setPivotStatus(`Pobrano wygląd „${info.label}”. Możesz go przemalować i wgrać jako własny.`);
}

function uploadPivotSkin(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      if (Math.abs(image.width / image.height - 1.5) > 0.05) {
        setPivotStatus(`Obrazek ma ${image.width}×${image.height} px, a musi mieć proporcje 3:2 (np. 1536×1024). Pobierz szablon i rysuj na nim.`);
        return;
      }
      // Połowa pełnego rozmiaru wystarcza na płótno i mieści się w pamięci przeglądarki.
      const canvas = document.createElement('canvas');
      canvas.width = PIVOT_SKIN_W / 2;
      canvas.height = PIVOT_SKIN_CELL;
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const number = Object.keys(pivot.customSkins).length + 1;
      const key = `wlasny-${Date.now().toString(36)}`;
      pivot.customSkins[key] = { label: `Mój wygląd ${number}`, src: canvas.toDataURL('image/png') };
      setPivotFigureSkin(key);
    };
    image.onerror = () => setPivotStatus('Nie udało się wczytać tego obrazka.');
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// ---------- Odtwarzanie ----------

function lerpPivotFigure(a, b, t) {
  const type = PIVOT_FIGURES[a.type];
  const joints = a.joints.map(() => [0, 0]);
  joints[0] = [a.joints[0][0] + (b.joints[0][0] - a.joints[0][0]) * t, a.joints[0][1] + (b.joints[0][1] - a.joints[0][1]) * t];
  type.segments.forEach(([from, to]) => {
    const angleA = Math.atan2(a.joints[to][1] - a.joints[from][1], a.joints[to][0] - a.joints[from][0]);
    const angleB = Math.atan2(b.joints[to][1] - b.joints[from][1], b.joints[to][0] - b.joints[from][0]);
    let turn = angleB - angleA;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    const lengthA = Math.hypot(a.joints[to][0] - a.joints[from][0], a.joints[to][1] - a.joints[from][1]);
    const lengthB = Math.hypot(b.joints[to][0] - b.joints[from][0], b.joints[to][1] - b.joints[from][1]);
    const angle = angleA + turn * t;
    const length = lengthA + (lengthB - lengthA) * t;
    joints[to] = [joints[from][0] + Math.cos(angle) * length, joints[from][1] + Math.sin(angle) * length];
  });
  return { ...a, size: a.size + (b.size - a.size) * t, joints };
}

// Wszystkie obrazki filmu: klatki i (opcjonalnie) wyliczone klatki pośrednie między nimi.
function pivotSequence() {
  const sequence = [];
  pivot.frames.forEach((frame, frameIndex) => {
    sequence.push({ frame, source: frameIndex });
    const next = pivot.frames[frameIndex + 1];
    if (!next) return;
    for (let step = 1; step <= pivot.tweens; step += 1) {
      const t = step / (pivot.tweens + 1);
      sequence.push({
        source: frameIndex,
        frame: {
          figures: frame.figures.map((fig) => {
            const target = next.figures.find((item) => item.id === fig.id);
            return target ? lerpPivotFigure(fig, target, t) : fig;
          })
        }
      });
    }
  });
  return sequence;
}

function startPivotPlayback() {
  if (pivot.playing) return;
  pivot.drag = null;
  const sequence = pivotSequence();
  let position = 0;
  const showNext = () => {
    const item = sequence[position];
    drawPivotFrame(pivot.ctx, item.frame);
    markPivotThumb(item.source);
    position += 1;
    if (position >= sequence.length) {
      if (!pivot.loop) {
        pivot.playing = setTimeout(() => stopPivotPlayback(), 1000 / pivot.fps);
        return;
      }
      position = 0;
    }
    pivot.playing = setTimeout(showNext, 1000 / pivot.fps);
  };
  pivot.playing = -1;
  pivot.root.classList.add('is-playing');
  pivot.root.querySelector('.pv-play').disabled = true;
  setPivotStatus('Odtwarzam animację… Kliknij Stop, żeby wrócić do rysowania.');
  showNext();
}

function stopPivotPlayback() {
  if (!pivot.playing) return;
  clearTimeout(pivot.playing);
  pivot.playing = null;
  pivot.root.classList.remove('is-playing');
  pivot.root.querySelector('.pv-play').disabled = false;
  markPivotThumb(pivot.cur);
  renderPivotCanvas();
  setPivotStatus('Zatrzymano. Przeciągaj kropki, żeby dalej animować.');
}

// ---------- Pliki ----------

function downloadPivotBlob(blob, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}

function savePivotFile() {
  downloadPivotBlob(new Blob([JSON.stringify(pivotProjectData())], { type: 'application/json' }), 'animacja-pivot.json');
  setPivotStatus('Zapisano projekt animacja-pivot.json — otworzysz go przyciskiem Otwórz.');
}

function openPivotFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data = null;
    try {
      data = JSON.parse(reader.result);
    } catch {
      data = null;
    }
    if (!data || !applyPivotProject(data)) {
      setPivotStatus('Ten plik nie jest projektem z Web Pivot Animatora.');
      return;
    }
    refreshPivot();
    setPivotStatus(`Otwarto projekt: ${file.name}`);
  };
  reader.readAsText(file);
}

function setPivotBackgroundImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    // Zmniejszamy obrazek do rozmiaru płótna, żeby projekt dał się zapisać.
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, Math.max(PIVOT_W / image.width, PIVOT_H / image.height) * 1.5);
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      pivot.bg.image = canvas.toDataURL('image/jpeg', 0.85);
      loadPivotBackgroundImage();
      savePivotProject();
      setPivotStatus('Ustawiono obrazek jako tło.');
    };
    image.onerror = () => setPivotStatus('Nie udało się wczytać tego obrazka.');
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

async function exportPivotGif() {
  if (pivot.busy) return;
  stopPivotPlayback();
  pivot.busy = true;
  const button = pivot.root.querySelector('[data-pv="gif"]');
  button.disabled = true;
  const sequence = pivotSequence();
  const canvas = document.createElement('canvas');
  canvas.width = PIVOT_W;
  canvas.height = PIVOT_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const encoder = createPivotGifEncoder(PIVOT_W, PIVOT_H, Math.max(2, Math.round(100 / pivot.fps)), pivot.loop);
  for (let index = 0; index < sequence.length; index += 1) {
    if (!pivot) return;
    setPivotStatus(`Zapisuję GIF… ${Math.round((index / sequence.length) * 100)}%`);
    drawPivotFrame(ctx, sequence[index].frame);
    try {
      encoder.addFrame(ctx.getImageData(0, 0, PIVOT_W, PIVOT_H).data);
    } catch {
      // Strona otwarta z dysku (file://): przeglądarka nie pozwala odczytać płótna z obrazkami wyglądów.
      pivot.busy = false;
      button.disabled = false;
      setPivotStatus('Nie da się zapisać GIF-a z gotowymi wyglądami, gdy strona jest otwarta z pliku. Otwórz ją przez serwer albo użyj własnego wyglądu.');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (!pivot) return;
  downloadPivotBlob(encoder.finish(), 'animacja.gif');
  pivot.busy = false;
  button.disabled = false;
  setPivotStatus(`Gotowe! Zapisano animacja.gif (${sequence.length} klatek).`);
}

// Prosty koder GIF89a: stała paleta 6×6×6 kolorów + 40 odcieni szarości i kompresja LZW.
function createPivotGifEncoder(width, height, delay, loop) {
  const bytes = [];
  const word = (value) => bytes.push(value & 255, (value >> 8) & 255);
  const text = (value) => [...value].forEach((char) => bytes.push(char.charCodeAt(0)));

  const palette = [];
  for (let r = 0; r < 6; r += 1) for (let g = 0; g < 6; g += 1) for (let b = 0; b < 6; b += 1) palette.push([r * 51, g * 51, b * 51]);
  for (let gray = 0; gray < 40; gray += 1) {
    const value = Math.round(((gray + 1) * 255) / 41);
    palette.push([value, value, value]);
  }

  text('GIF89a');
  word(width);
  word(height);
  bytes.push(0xf7, 0, 0);
  palette.forEach((color) => bytes.push(...color));
  if (loop) {
    bytes.push(0x21, 0xff, 11);
    text('NETSCAPE2.0');
    bytes.push(3, 1, 0, 0, 0);
  }

  const indices = new Uint8Array(width * height);
  const colorIndex = (r, g, b) => {
    // Szarości mają osobne, gęstsze odcienie — ładniejsze cienie i kontury.
    if (Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - b) < 10) {
      const level = (r + g + b) / 3;
      if (level < 3) return 0;
      if (level > 252) return 215;
      return 216 + Math.min(39, Math.max(0, Math.round((level * 41) / 255) - 1));
    }
    return Math.round(r / 51) * 36 + Math.round(g / 51) * 6 + Math.round(b / 51);
  };

  return {
    addFrame(rgba) {
      for (let pixel = 0, offset = 0; pixel < indices.length; pixel += 1, offset += 4) {
        indices[pixel] = colorIndex(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
      }
      bytes.push(0x21, 0xf9, 4, 0x04);
      word(delay);
      bytes.push(0, 0);
      bytes.push(0x2c);
      word(0);
      word(0);
      word(width);
      word(height);
      bytes.push(0, 8);
      const data = pivotLzw(indices);
      for (let start = 0; start < data.length; start += 255) {
        const chunk = data.subarray(start, start + 255);
        bytes.push(chunk.length);
        for (let i = 0; i < chunk.length; i += 1) bytes.push(chunk[i]);
      }
      bytes.push(0);
    },
    finish() {
      bytes.push(0x3b);
      return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
    }
  };
}

function pivotLzw(indices) {
  const out = [];
  let buffer = 0;
  let bits = 0;
  let size = 9;
  const write = (code) => {
    buffer |= code << bits;
    bits += size;
    while (bits >= 8) {
      out.push(buffer & 255);
      buffer >>>= 8;
      bits -= 8;
    }
  };
  let table = new Map();
  let next = 258;
  write(256);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i += 1) {
    const value = indices[i];
    const key = prefix * 256 + value;
    const known = table.get(key);
    if (known !== undefined) {
      prefix = known;
      continue;
    }
    write(prefix);
    if (next === 4096) {
      write(256);
      table = new Map();
      next = 258;
      size = 9;
    } else {
      if (next >= 1 << size) size += 1;
      table.set(key, next);
      next += 1;
    }
    prefix = value;
  }
  write(prefix);
  write(257);
  if (bits > 0) out.push(buffer & 255);
  return Uint8Array.from(out);
}

// ---------- Zdarzenia ----------

function togglePivotHelp(show) {
  pivot.root.querySelector('.pv-help').hidden = !show;
  if (show) pivot.root.querySelector('[data-pv="help-close"]').focus();
}

function handlePivotAction(action) {
  switch (action) {
    case 'close': stopPivotAnimator(); break;
    case 'new':
      if (!window.confirm('Zacząć nową animację? Obecna zniknie (zapisz ją wcześniej, jeśli chcesz ją zachować).')) return;
      stopPivotPlayback();
      resetPivotProject();
      refreshPivot();
      setPivotStatus('Nowa animacja. Przeciągaj czerwone kropki, żeby poruszać ludzikiem.');
      break;
    case 'open': pivot.root.querySelector('.pv-file').click(); break;
    case 'save': savePivotFile(); break;
    case 'gif': exportPivotGif(); break;
    case 'help': togglePivotHelp(true); break;
    case 'help-close': togglePivotHelp(false); break;
    case 'frame-left': movePivotFrame(-1); break;
    case 'frame-right': movePivotFrame(1); break;
    case 'frame-delete': deletePivotFrame(); break;
    case 'play': startPivotPlayback(); break;
    case 'stop': stopPivotPlayback(); break;
    case 'background': {
      const panel = pivot.root.querySelector('.pv-bg-panel');
      panel.hidden = !panel.hidden;
      break;
    }
    case 'bg-image': pivot.root.querySelector('.pv-bg-file').click(); break;
    case 'bg-clear':
      pivot.bg.image = '';
      pivot.bgImage = null;
      refreshPivot();
      break;
    case 'add-figure': addPivotFigure(); break;
    case 'skin-download': downloadPivotSkin(); break;
    case 'skin-upload': pivot.root.querySelector('.pv-skin-file').click(); break;
    case 'undo': undoPivot(); break;
    case 'add-frame': addPivotFrame(); break;
    default: editPivotFigure(action);
  }
}

function handlePivotKey(event) {
  if (!pivot) return;
  const typing = event.target.matches('input, select, textarea');
  if (event.key === 'Escape') {
    if (!pivot.root.querySelector('.pv-help').hidden) togglePivotHelp(false);
    else stopPivotAnimator();
    return;
  }
  if (typing) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undoPivot();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    selectPivotFrame(pivot.cur - 1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    selectPivotFrame(pivot.cur + 1);
  } else if (event.key === 'Delete' && currentPivotFigure()) {
    editPivotFigure('delete-figure');
  }
}

function bindPivotEvents() {
  const { root, canvas } = pivot;
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-pv]');
    if (button && !button.disabled) handlePivotAction(button.dataset.pv);
    const thumb = event.target.closest('[data-frame]');
    if (thumb) selectPivotFrame(Number(thumb.dataset.frame));
    const bgButton = event.target.closest('[data-bg]');
    if (bgButton) {
      const preset = PIVOT_BACKGROUNDS[Number(bgButton.dataset.bg)];
      pivot.bg.scene = preset.scene;
      pivot.bg.color = preset.color;
      refreshPivot();
    }
    const swatch = event.target.closest('.pv-swatch[data-color]');
    if (swatch && !swatch.disabled) setPivotFigureColor(swatch.dataset.color);
  });
  root.querySelector('.pv-help').addEventListener('click', (event) => {
    if (event.target.classList.contains('pv-help')) togglePivotHelp(false);
  });

  canvas.addEventListener('pointerdown', handlePivotPointerDown);
  canvas.addEventListener('pointermove', handlePivotPointerMove);
  canvas.addEventListener('pointerup', handlePivotPointerUp);
  canvas.addEventListener('pointercancel', handlePivotPointerUp);
  canvas.addEventListener('lostpointercapture', handlePivotPointerUp);

  root.querySelector('.pv-tweens').addEventListener('change', (event) => {
    pivot.tweens = Math.min(8, Math.max(0, Math.round(Number(event.target.value) || 0)));
    updatePivotPanel();
    savePivotProject();
  });
  root.querySelector('.pv-loop').addEventListener('change', (event) => {
    pivot.loop = event.target.checked;
    savePivotProject();
  });
  root.querySelector('.pv-onion').addEventListener('change', (event) => {
    pivot.onion = event.target.checked;
    renderPivotCanvas();
  });
  root.querySelector('.pv-fps').addEventListener('input', (event) => {
    pivot.fps = Number(event.target.value);
    updatePivotPanel();
    savePivotProject();
  });
  root.querySelector('.pv-bg-color').addEventListener('input', (event) => {
    pivot.bg.scene = 'none';
    pivot.bg.color = event.target.value;
    renderPivotCanvas();
  });
  root.querySelector('.pv-bg-color').addEventListener('change', refreshPivot);
  root.querySelector('.pv-figure-color').addEventListener('change', (event) => setPivotFigureColor(event.target.value));
  root.querySelector('.pv-skin-all').addEventListener('change', (event) => setPivotFigureSkin(event.target.value));
  root.querySelector('.pv-skin-part').addEventListener('change', (event) => setPivotFigureSkin(event.target.value, pivot.part));

  const size = root.querySelector('.pv-size');
  size.addEventListener('pointerdown', pushPivotHistory);
  size.addEventListener('keydown', (event) => {
    if (event.key.startsWith('Arrow')) pushPivotHistory();
  });
  size.addEventListener('input', () => setPivotFigureSize(Number(size.value)));
  size.addEventListener('change', () => {
    updatePivotThumb(pivot.cur);
    updatePivotPanel();
    savePivotProject();
  });

  root.querySelector('.pv-file').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) openPivotFile(file);
    event.target.value = '';
  });
  root.querySelector('.pv-bg-file').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) setPivotBackgroundImage(file);
    event.target.value = '';
  });
  root.querySelector('.pv-skin-file').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) uploadPivotSkin(file);
    event.target.value = '';
  });

  document.addEventListener('keydown', handlePivotKey);
}
