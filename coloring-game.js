// Zadanie „Kolorowanka online”: uczeń wybiera obrazek SVG i koloruje go jak na kolorujonline.pl.
// Każde pole obrazka to osobny kształt z klasą „c”. Narzędzia: wiaderko (wypełnia pole), gumka,
// pędzel (maluje swobodnie) i magiczny pędzel (maluje tylko w polu, w którym zaczęto ruch).
// Bez wymogów: zadanie zalicza się samo po pokolorowaniu pierwszego pola. Pola z data-optional
// (drobne kawałki obrazków z tools/png-do-kolorowanki.mjs) nie liczą się do paska postępu.
// Korzysta z funkcji app.js (setQuizProgress, completeLesson, saveStudentPoints…).
let coloringGame = null;

// Obrazek wczytujemy dopiero po wyborze: assets/coloring/<id>.js dopisuje się do COLORING_SVGS
// (skrypt, nie fetch — działa też z pliku file://).
const COLORING_SVGS = {};

const SVG_NS = 'http://www.w3.org/2000/svg';
const COLORING_BLANK = '#ffffff';
const COLORING_PALETTE = [
  '#ffffff', '#ffe0bd', '#f8bbd0', '#f06292', '#e53935',
  '#b71c1c', '#ff7043', '#ff9800', '#ffc107', '#ffeb3b',
  '#cddc39', '#8bc34a', '#43a047', '#1b5e20', '#26c6da',
  '#81d4fa', '#1e88e5', '#283593', '#7e57c2', '#ba68c8',
  '#d7a77a', '#8d6e63', '#5d4037', '#bdbdbd', '#616161', '#212121'
];
const COLORING_TOOLS = [
  { id: 'brush', icon: '🖌️', label: 'Pędzel' },
  { id: 'magic', icon: '🪄', label: 'Magiczny pędzel' },
  { id: 'fill', icon: '🪣', label: 'Wiaderko' },
  { id: 'erase', icon: '🧽', label: 'Gumka' }
];

function renderColoringGame(topic, index, game) {
  stopColoringGame();
  document.title = `${game.title} — Informatyczna Przygoda`;
  document.querySelector('meta[name="theme-color"]').content = topic.accent;
  app.replaceChildren(quizTemplate.content.cloneNode(true));
  applyTopicTheme(topic);
  app.querySelector('#quiz-close').href = `#/sciezka/${topic.slug}`;
  app.querySelector('#quiz-footer').hidden = true;
  app.querySelector('#quiz-kicker').textContent = game.title;
  app.querySelector('#quiz-prompt').textContent = game.prompt;
  app.querySelector('#quiz-hint').textContent =
    'Wybierz obrazek i pokoloruj go tak, jak chcesz.';
  setQuizProgress(0);

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body cg-pick';
  body.innerHTML = `
    <div class="cg-pages">
      ${game.pages.map((page, pageIndex) => `
        <button class="cg-page" type="button" data-page="${pageIndex}">
          <img src="${page.src}" alt="" loading="lazy" />
          <span>${page.label}</span>
        </button>`).join('')}
    </div>
  `;
  body.querySelectorAll('.cg-page').forEach((button) => button.addEventListener('click', async () => {
    const page = game.pages[Number(button.dataset.page)];
    button.disabled = true;
    try {
      await loadColoringPage(page);
    } catch {
      button.disabled = false;
      app.querySelector('#quiz-hint').textContent = 'Nie udało się wczytać obrazka — spróbuj jeszcze raz.';
      return;
    }
    if (body.isConnected) startColoringGame(topic, index, game, page);
  }));
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function loadColoringPage(page) {
  if (COLORING_SVGS[page.id]) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `assets/coloring/${page.id}.js${page.revision ? `?v=${page.revision}` : ''}`;
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error(`Brak obrazka ${page.id}`));
    };
    document.head.append(script);
  });
}

function startColoringGame(topic, index, game, page) {
  stopColoringGame();
  app.querySelector('#quiz-prompt').textContent = page.label;
  app.querySelector('#quiz-hint').textContent =
    'Wybierz narzędzie i kolor. Magiczny pędzel nie wyjdzie za linie, a wiaderko wypełni całe pole.';

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body cg-coloring';
  body.innerHTML = `
    <div class="cg-workspace">
      <div class="cg-board"></div>
      <aside class="cg-panel" aria-label="Narzędzia">
        <div class="cg-grid cg-tools">
          ${COLORING_TOOLS.map((tool) => `
            <button class="cg-tool" type="button" data-tool="${tool.id}" aria-pressed="false" title="${tool.label}">
              <span aria-hidden="true">${tool.icon}</span><small>${tool.label}</small>
            </button>`).join('')}
        </div>
        <p class="cg-panel-title">Kolor: <span class="cg-current" aria-hidden="true"></span></p>
        <div class="cg-palette" role="radiogroup" aria-label="Kolory">
          ${COLORING_PALETTE.map((color) => `
            <button class="cg-swatch" type="button" role="radio" aria-checked="false" data-color="${color}" style="--swatch: ${color}" aria-label="${color === COLORING_BLANK ? 'Biały' : `Kolor ${color}`}" title="${color === COLORING_BLANK ? 'Biały' : ''}"></button>`).join('')}
          <label class="cg-custom" title="Własny kolor">
            <input type="color" value="#00bfa5" aria-label="Własny kolor" />
          </label>
        </div>
        <div class="cg-size-block">
          <label class="cg-panel-title" for="cg-size">Rozmiar pędzla:</label>
          <div class="cg-size">
            <input id="cg-size" type="range" min="4" max="48" step="2" value="14" />
            <span class="cg-size-dot" aria-hidden="true"></span>
          </div>
        </div>
        <div class="cg-grid cg-actions">
          <button class="cg-action" type="button" data-action="undo" title="Cofnij" disabled><span aria-hidden="true">↶</span><small>Cofnij</small></button>
          <button class="cg-action" type="button" data-action="redo" title="Przywróć" disabled><span aria-hidden="true">↷</span><small>Przywróć</small></button>
          <button class="cg-action" type="button" data-action="download" title="Pobierz obrazek jako PNG"><span aria-hidden="true">📥</span><small>Pobierz</small></button>
          <button class="cg-action" type="button" data-action="reset" title="Wymaż cały obrazek"><span aria-hidden="true">🗑️</span><small>Wymaż</small></button>
        </div>
      </aside>
    </div>
  `;

  const svg = new DOMParser().parseFromString(COLORING_SVGS[page.id], 'image/svg+xml').documentElement;
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('class', 'cg-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Kolorowanka: ${page.label}`);
  const board = body.querySelector('.cg-board');
  board.replaceChildren(svg);

  // Swobodne pociągnięcia pędzla leżą nad całym obrazkiem; magiczne — w grupie przyciętej do pola.
  const defs = document.createElementNS(SVG_NS, 'defs');
  const freeLayer = document.createElementNS(SVG_NS, 'g');
  freeLayer.setAttribute('class', 'cg-free-layer');
  svg.prepend(defs);
  svg.append(freeLayer);

  const state = {
    topic,
    index,
    game,
    page,
    body,
    board,
    svg,
    defs,
    freeLayer,
    regions: [...svg.querySelectorAll('.c')],
    magicLayers: new Map(),
    strokes: [],
    drawing: null,
    color: COLORING_PALETTE[4],
    tool: 'magic',
    size: 14,
    undoStack: [],
    redoStack: []
  };
  coloringGame = state;

  body.querySelectorAll('.cg-swatch').forEach((swatch) => swatch.addEventListener('click', () => selectColoringColor(swatch.dataset.color)));
  const custom = body.querySelector('.cg-custom input');
  custom.addEventListener('input', () => selectColoringColor(custom.value));
  body.querySelectorAll('.cg-tool').forEach((button) => button.addEventListener('click', () => selectColoringTool(button.dataset.tool)));
  const size = body.querySelector('#cg-size');
  size.addEventListener('input', () => {
    state.size = Number(size.value);
    updateColoringSizeDot();
  });
  body.querySelector('[data-action="undo"]').addEventListener('click', undoColoring);
  body.querySelector('[data-action="redo"]').addEventListener('click', redoColoring);
  body.querySelector('[data-action="download"]').addEventListener('click', downloadColoring);
  body.querySelector('[data-action="reset"]').addEventListener('click', resetColoring);

  svg.addEventListener('pointerdown', coloringPointerDown);
  svg.addEventListener('pointermove', coloringPointerMove);
  svg.addEventListener('pointerup', coloringPointerUp);
  svg.addEventListener('pointercancel', coloringPointerUp);

  restoreColoring();
  selectColoringColor(state.color);
  selectColoringTool(state.tool);
  updateColoringSizeDot();
  updateColoringStatus();
}

function stopColoringGame() {
  coloringGame = null;
}

function selectColoringColor(color) {
  const state = coloringGame;
  state.color = color.toLowerCase();
  state.body.querySelectorAll('.cg-swatch').forEach((swatch) => {
    swatch.setAttribute('aria-checked', String(swatch.dataset.color === state.color));
  });
  const custom = state.body.querySelector('.cg-custom');
  custom.classList.toggle('is-active', !COLORING_PALETTE.includes(state.color));
  custom.style.setProperty('--swatch', state.color);
  state.body.querySelector('.cg-current').style.setProperty('--swatch', state.color);
  if (state.tool === 'erase') selectColoringTool('fill');
  updateColoringSizeDot();
  updateColoringCursor();
}

function selectColoringTool(tool) {
  const state = coloringGame;
  state.tool = tool;
  state.body.querySelectorAll('.cg-tool').forEach((button) => {
    const active = button.dataset.tool === tool;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  state.board.dataset.tool = tool;
  const brush = tool === 'brush' || tool === 'magic';
  state.body.querySelector('.cg-size-block').classList.toggle('is-disabled', !brush);
  state.body.querySelector('#cg-size').disabled = !brush;
  updateColoringCursor();
}

// Kursor wiaderka: farba w wybranym kolorze kapie na celownik — to punkt, w którym pole się wypełni.
function updateColoringCursor() {
  const state = coloringGame;
  if (state.tool !== 'fill') {
    state.board.style.cursor = '';
    return;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <g transform="rotate(-35 24 14)" stroke="#222" stroke-width="2" stroke-linejoin="round">
      <path d="M16 9c0-6 14-6 14 0" fill="none"/>
      <path d="M13 9h20l-3 17H16z" fill="#fff"/>
      <path d="M13.6 12.5h18.8l-.6 3.5H14.2z" fill="${state.color}" stroke="none"/>
    </g>
    <path d="M13 21c-3 2-6 5-6 10" fill="none" stroke="#222" stroke-width="5" stroke-linecap="round"/>
    <path d="M13 21c-3 2-6 5-6 10" fill="none" stroke="${state.color}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="6" cy="34" r="5" fill="none" stroke="#fff" stroke-width="4"/>
    <circle cx="6" cy="34" r="5" fill="none" stroke="#222" stroke-width="2"/>
    <circle cx="6" cy="34" r="1.6" fill="#222"/>
  </svg>`;
  state.board.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 6 34, crosshair`;
}

function updateColoringSizeDot() {
  const state = coloringGame;
  const dot = state.body.querySelector('.cg-size-dot');
  dot.style.setProperty('--size', `${Math.max(6, Math.min(36, state.size * 0.75))}px`);
  dot.style.setProperty('--swatch', state.color);
}

function regionColor(region) {
  return (region.getAttribute('fill') || COLORING_BLANK).toLowerCase();
}

// Punkt wskaźnika w układzie współrzędnych elementu (pole może leżeć w przesuniętej grupie).
function coloringPoint(event, element) {
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(element.getScreenCTM().inverse());
  return `${Math.round(point.x * 10) / 10} ${Math.round(point.y * 10) / 10}`;
}

function coloringPointerDown(event) {
  const state = coloringGame;
  if (!state || event.button > 0) return;
  const region = event.target.closest('.c');

  if (state.tool === 'fill' || state.tool === 'erase') {
    event.preventDefault();
    if (state.tool === 'erase') eraseColoringAt(event.target, region);
    else if (region) fillColoringRegion(region);
    return;
  }

  // Magiczny pędzel zaczyna tylko na polu i maluje wyłącznie w jego wnętrzu.
  const magic = state.tool === 'magic';
  if (magic && !region) return;
  event.preventDefault();
  const stroke = {
    region: magic ? state.regions.indexOf(region) : -1,
    color: state.color,
    width: state.size,
    d: ''
  };
  const space = magic ? region.parentNode : state.svg;
  const point = coloringPoint(event, space);
  stroke.d = `M${point} L${point}`;
  state.drawing = { stroke, space, before: [...state.strokes] };
  state.strokes.push(stroke);
  renderColoringStroke(stroke);
  state.svg.setPointerCapture(event.pointerId);
}

function coloringPointerMove(event) {
  const drawing = coloringGame?.drawing;
  if (!drawing) return;
  const samples = event.getCoalescedEvents?.() || [];
  (samples.length ? samples : [event]).forEach((sample) => { drawing.stroke.d += ` L${coloringPoint(sample, drawing.space)}`; });
  drawing.stroke.element.setAttribute('d', drawing.stroke.d);
}

function coloringPointerUp() {
  const state = coloringGame;
  if (!state?.drawing) return;
  const { before } = state.drawing;
  state.drawing = null;
  pushColoringAction({ fills: [], before, after: [...state.strokes] });
}

function magicLayerFor(regionIndex) {
  const state = coloringGame;
  if (state.magicLayers.has(regionIndex)) return state.magicLayers.get(regionIndex);
  const region = state.regions[regionIndex];

  const clip = document.createElementNS(SVG_NS, 'clipPath');
  clip.id = `cg-clip-${regionIndex}`;
  const shape = region.cloneNode(false);
  shape.removeAttribute('id');
  shape.removeAttribute('class');
  clip.append(shape);
  state.defs.append(clip);

  const layer = document.createElementNS(SVG_NS, 'g');
  layer.setAttribute('class', 'cg-magic');
  layer.setAttribute('clip-path', `url(#${clip.id})`);
  // Kontur pola rysujemy jeszcze raz nad farbą, żeby linia została czarna.
  const outline = region.cloneNode(false);
  outline.removeAttribute('id');
  outline.setAttribute('class', 'cg-outline');
  outline.setAttribute('fill', 'none');
  region.after(layer, outline);
  state.magicLayers.set(regionIndex, layer);
  return layer;
}

function renderColoringStroke(stroke) {
  const state = coloringGame;
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('class', stroke.region < 0 ? 'cg-paint cg-free' : 'cg-paint');
  path.setAttribute('d', stroke.d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', stroke.color);
  path.setAttribute('stroke-width', stroke.width);
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  stroke.element = path;
  (stroke.region < 0 ? state.freeLayer : magicLayerFor(stroke.region)).append(path);
}

// Po cofnięciu i przywróceniu rysujemy wszystkie pociągnięcia od nowa, w kolejności z listy.
function renderColoringStrokes() {
  const state = coloringGame;
  state.svg.querySelectorAll('.cg-paint').forEach((path) => path.remove());
  state.strokes.forEach(renderColoringStroke);
}

function fillColoringRegion(region) {
  const state = coloringGame;
  const previous = regionColor(region);
  if (previous === state.color) return;
  region.setAttribute('fill', state.color);
  pushColoringAction({ fills: [[region, previous, state.color]] });
}

// Gumka zmazuje kliknięte pociągnięcie pędzla albo całe pole razem z magicznym pędzlem.
function eraseColoringAt(target, region) {
  const state = coloringGame;
  const before = [...state.strokes];
  const freeStroke = target.classList.contains('cg-free') && state.strokes.find((stroke) => stroke.element === target);
  if (freeStroke) {
    state.strokes = state.strokes.filter((stroke) => stroke !== freeStroke);
    freeStroke.element.remove();
    pushColoringAction({ fills: [], before, after: [...state.strokes] });
    return;
  }
  if (!region) return;
  const regionIndex = state.regions.indexOf(region);
  const previous = regionColor(region);
  const removed = state.strokes.filter((stroke) => stroke.region === regionIndex);
  if (previous === COLORING_BLANK && !removed.length) return;
  region.setAttribute('fill', COLORING_BLANK);
  removed.forEach((stroke) => stroke.element.remove());
  state.strokes = state.strokes.filter((stroke) => stroke.region !== regionIndex);
  pushColoringAction({
    fills: previous === COLORING_BLANK ? [] : [[region, previous, COLORING_BLANK]],
    before,
    after: [...state.strokes]
  });
}

function resetColoring() {
  const state = coloringGame;
  const fills = state.regions
    .filter((region) => regionColor(region) !== COLORING_BLANK)
    .map((region) => [region, regionColor(region), COLORING_BLANK]);
  if (!fills.length && !state.strokes.length) return;
  if (!confirm('Wymazać cały obrazek? Możesz to potem cofnąć.')) return;
  const before = [...state.strokes];
  fills.forEach(([region]) => region.setAttribute('fill', COLORING_BLANK));
  state.strokes = [];
  renderColoringStrokes();
  pushColoringAction({ fills, before, after: [] });
}

// Akcja: zmienione wypełnienia pól [pole, przed, po] i lista pociągnięć przed/po (jeśli się zmieniła).
function pushColoringAction(action) {
  const state = coloringGame;
  state.undoStack.push(action);
  state.redoStack = [];
  saveColoring();
}

function applyColoringAction(action, undo) {
  const state = coloringGame;
  action.fills.forEach(([region, before, after]) => region.setAttribute('fill', undo ? before : after));
  if (action.before) {
    state.strokes = [...(undo ? action.before : action.after)];
    renderColoringStrokes();
  }
  saveColoring();
}

function undoColoring() {
  const state = coloringGame;
  const action = state.undoStack.pop();
  if (!action) return;
  state.redoStack.push(action);
  applyColoringAction(action, true);
}

function redoColoring() {
  const state = coloringGame;
  const action = state.redoStack.pop();
  if (!action) return;
  state.undoStack.push(action);
  applyColoringAction(action, false);
}

// Białe pola do pokolorowania — bez pól opcjonalnych.
function blankColoringRegions() {
  const state = coloringGame;
  const painted = new Set(state.strokes.map((stroke) => stroke.region));
  return state.regions.filter((region, regionIndex) =>
    !region.hasAttribute('data-optional') && regionColor(region) === COLORING_BLANK && !painted.has(regionIndex));
}

function updateColoringStatus() {
  const state = coloringGame;
  const blank = blankColoringRegions().length;
  const total = state.regions.filter((region) => !region.hasAttribute('data-optional')).length || 1;
  setQuizProgress((total - blank) / total);
  if (blank < total || state.strokes.length) awardColoring();
  state.body.querySelector('[data-action="undo"]').disabled = !state.undoStack.length;
  state.body.querySelector('[data-action="redo"]').disabled = !state.redoStack.length;
}

function coloringSaveKey(page) {
  return `kolorowanka:${page.id}${page.revision ? `:v${page.revision}` : ''}`;
}

function readColoringSave(page) {
  try {
    const saved = JSON.parse(localStorage.getItem(coloringSaveKey(page)));
    if (Array.isArray(saved)) return { fills: saved, strokes: [] };
    return saved || { fills: [], strokes: [] };
  } catch {
    return { fills: [], strokes: [] };
  }
}

function restoreColoring() {
  const state = coloringGame;
  const saved = readColoringSave(state.page);
  state.regions.forEach((region, regionIndex) => {
    if (saved.fills[regionIndex]) region.setAttribute('fill', saved.fills[regionIndex]);
  });
  state.strokes = (saved.strokes || []).map(({ r, c, w, d }) => ({ region: r, color: c, width: w, d }));
  renderColoringStrokes();
}

function saveColoring() {
  const state = coloringGame;
  try {
    localStorage.setItem(coloringSaveKey(state.page), JSON.stringify({
      fills: state.regions.map((region) => {
        const color = regionColor(region);
        return color === COLORING_BLANK ? 0 : color;
      }),
      strokes: state.strokes.map(({ region, color, width, d }) => ({ r: region, c: color, w: width, d }))
    }));
  } catch {
    // Bez zapisu obrazek i tak działa — przepada tylko po odświeżeniu strony.
  }
  updateColoringStatus();
}

function downloadColoring() {
  const state = coloringGame;
  const [, , width, height] = (state.svg.getAttribute('viewBox') || '0 0 800 600').split(/[\s,]+/).map(Number);
  const clone = state.svg.cloneNode(true);
  clone.setAttribute('width', width);
  clone.setAttribute('height', height);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `kolorowanka-${state.page.id}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, 'image/png');
  };
  image.src = url;
}

// Pierwsze pokolorowane pole zalicza zadanie — bez przerywania malowania.
function awardColoring() {
  const state = coloringGame;
  const { topic, index, game } = state;
  if (getCompletedLessons(topic).has(index)) return;
  const earned = Math.max(0, game.reward - readQuizBest(game.id));
  if (earned) {
    saveQuizBest(game.id, game.reward);
    saveStudentPoints(readStudentPoints() + earned);
  }
  completeLesson(topic, index);
  syncStudentProfile();
  if (earned) app.querySelector('#quiz-hint').textContent = `Brawo, zadanie zaliczone: +${formatPoints(earned)} pkt! Koloruj dalej, ile chcesz.`;
}
