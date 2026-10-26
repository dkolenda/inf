// Blueprinty JSGame Engine: lista węzłów, kompilator grafu węzłów do TypeScriptu i przykładowy projekt.
//
// Graf Blueprintu: { nodes: [{ id, type, x, y, props, values }], links: [{ from: [węzeł, pin], to: [węzeł, pin] }] }.
// Białe piny (exec) wyznaczają kolejność wykonania, kolorowe przenoszą dane. Każde zdarzenie
// (BeginPlay, Tick, klawisz…) staje się metodą klasy, a łańcuch węzłów za nim — jej treścią.
// Węzły „czyste” (bez białych pinów, np. +, >, Get zmiennej) zamieniają się w wyrażenia.

const GE_RT = geCreateRuntime();

const GE_TYPES = {
  exec: { label: 'Wykonanie', color: '#ffffff' },
  bool: { label: 'Prawda/fałsz (Boolean)', color: '#e0403f' },
  int: { label: 'Liczba całkowita (Integer)', color: '#1fe3af' },
  float: { label: 'Liczba (Float)', color: '#9ee35a' },
  string: { label: 'Tekst (String)', color: '#f25ce1' },
  vector: { label: 'Wektor X, Y (Vector)', color: '#f8c80f' },
  actor: { label: 'Aktor (Actor)', color: '#2ba8f6' },
  // Tylko pin (np. Out Actors z Get All Actors Of Class), nie typ zmiennej.
  actors: { label: 'Tablica aktorów (Array)', color: '#2ba8f6' },
  // Tylko pin: zdarzenie własne podpinane do Event Dispatchera (czerwony kwadrat), nie typ zmiennej.
  delegate: { label: 'Zdarzenie (Event Dispatcher)', color: '#ff3b3b' }
};
const GE_VAR_TYPES = ['bool', 'int', 'float', 'string', 'vector', 'actor'];
const GE_VAR_DEFAULTS = { bool: false, int: 0, float: 0, string: '', vector: { x: 0, y: 0 }, actor: null };

// Kontener zmiennej jak w Unreal Engine (Single / Array / Set / Map) siedzi w typie: „array:int”, „set:string”,
// „map:string|int” (klucz|wartość); tablica aktorów to dawny typ „actors”. Wartość w projekcie to zawsze tablica:
// elementy (Array, Set) albo pary [klucz, wartość] (Map). W kodzie: [...], new Set([...]), new Map([...]).
const GE_CONTAINERS = [['single', 'Pojedyncza (Single)'], ['array', 'Tablica (Array)'], ['set', 'Zbiór (Set)'], ['map', 'Mapa (Map)']];

function geContainer(type) {
  const t = String(type ?? '');
  if (t === 'actors') return { container: 'array', elem: 'actor' };
  const m = /^(array|set|map):(.+)$/.exec(t);
  if (!m) return { container: 'single', elem: t };
  if (m[1] !== 'map') return { container: m[1], elem: m[2] };
  const [elem, value] = m[2].split('|');
  return { container: 'map', elem, value: value || 'float' };
}

function geContainerType(container, elem, value = 'float') {
  if (container === 'array') return elem === 'actor' ? 'actors' : 'array:' + elem;
  if (container === 'set') return 'set:' + elem;
  if (container === 'map') return `map:${elem}|${value}`;
  return elem;
}

// Element Set i klucz Map porównuje się po wartości, więc wektor i Struktura (obiekty) nie mogą nimi być.
const geHashable = (type) => type !== 'vector' && !/^struct:/.test(String(type));

// Nowy typ po zmianie typu elementu (which „type”), kontenera („container”) albo typu wartości Map („valueType”).
function geRetype(type, which, value) {
  const c = { ...geContainer(type), [which === 'type' ? 'elem' : which === 'container' ? 'container' : 'value']: value };
  if ((c.container === 'set' || c.container === 'map') && !geHashable(c.elem)) c.elem = 'string';
  return geContainerType(c.container, c.elem, c.value);
}

// Węzły tablic (For Each, Length, Get) przyjmują tablicę dowolnego typu: typ elementu (props.elem) ustawia
// się przy podłączeniu kabla do pinu Array, jak „wildcard” w Unreal Engine. Bez niego — tablica aktorów.
const GE_ARRAY_NODES = new Set(['for_each', 'array_length', 'array_get']);
const geArrayElem = (n) => n?.props?.elem || 'actor';
const geArrayNodeType = (n) => geContainerType('array', geArrayElem(n));

const GE_KEYS = [
  ['Space', 'Spacja'], ['Enter', 'Enter'], ['Left', '← Strzałka w lewo'], ['Right', '→ Strzałka w prawo'],
  ['Up', '↑ Strzałka w górę'], ['Down', '↓ Strzałka w dół'], ['Shift', 'Shift'], ['Ctrl', 'Ctrl'],
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').map((k) => [k, k])
];
const GE_SOUNDS = [['coin', 'Moneta'], ['jump', 'Skok'], ['hit', 'Uderzenie'], ['explosion', 'Wybuch'], ['blip', 'Pik'], ['win', 'Wygrana'], ['lose', 'Przegrana']];
const GE_AXES = [['horizontal', 'Poziomo (A/D, ←/→)'], ['vertical', 'Pionowo (W/S, ↑/↓)']];

const GE_BP_DEFAULTS = {
  shape: 'box', color: '#4a90d9', w: 64, h: 64, emoji: '🙂', text: 'Tekst', image: null,
  collision: 'block', gravity: false, moveSpeed: 260, jumpSpeed: 680, z: 0, material: null, sprite: null
};

// Rodzaje zasobów w Przeglądarce zawartości. Wszystkie leżą w project.blueprints i różnią się polem kind:
// actor — klasa Blueprint (aktor na poziomie), widget — interfejs na ekranie (bp.widget.elements),
// interface — lista funkcji do wywoływania między klasami (bp.functions), material — wygląd (bp.material),
// texture — zaimportowany obrazek (bp.texture: { src, w, h }), sprite — wycinek tekstury (bp.sprite: { texture, x, y, w, h }),
// animation — Flipbook, czyli sprite'y po kolei (bp.flipbook: { frames, fps, loop }),
// sound — dźwięk z pliku albo wbudowany (bp.sound: { src, preset, volume, duration }),
// input_action — akcja wejścia Enhanced Input (bp.inputAction: { valueType, accumulate, consume, whenPaused, triggers, modifiers }),
// input_context — Input Mapping Context (bp.mappingContext: { mappings: [{ id, action, key, triggers, modifiers }] }).
const GE_KINDS = {
  actor: { label: 'Klasa Blueprint', icon: '📘', prefix: 'BP_', color: '#3d8ee6' },
  widget: { label: 'Widget Blueprint', icon: '🪟', prefix: 'WBP_', color: '#2fb36b' },
  interface: { label: 'Blueprint Interface', icon: '🔌', prefix: 'BPI_', color: '#a46ae0' },
  material: { label: 'Materiał', icon: '🎨', prefix: 'M_', color: '#5bbf3f' },
  texture: { label: 'Tekstura (obrazek)', icon: '🖼', prefix: 'T_', color: '#c9473f' },
  sprite: { label: 'Sprite', icon: '🧩', prefix: 'S_', color: '#e08a2e' },
  animation: { label: 'Animacja (Flipbook)', icon: '🎞', prefix: 'FB_', color: '#d6b52a' },
  sound: { label: 'Dźwięk', icon: '🔊', prefix: 'SFX_', color: '#2bb3c9' },
  input_action: { label: 'Input Action', icon: '🎮', prefix: 'IA_', color: '#e0507a' },
  input_context: { label: 'Input Mapping Context', icon: '⌨', prefix: 'IMC_', color: '#9c6b3f' }
};
const GE_MATERIAL_DEFAULTS = { color: '#e0a030', opacity: 1, glow: 0 };
const GE_FLIPBOOK_DEFAULTS = { frames: [], fps: 8, loop: true };
const GE_SOUND_DEFAULTS = { src: null, preset: 'blip', volume: 1, duration: 0 };

// ---------- Enhanced Input (jak w Unreal Engine 5; działanie — EnhancedInput w game-runtime.js) ----------

const GE_INPUT_ACTION_DEFAULTS = { valueType: 'bool', accumulate: 'highest', consume: true, whenPaused: false, triggers: [], modifiers: [] };
// Typ wartości akcji → typ pinu „Action Value”.
const GE_INPUT_VALUE_TYPES = [['bool', 'Digital (bool)'], ['axis1d', 'Axis1D (float)'], ['axis2d', 'Axis2D (Vector2D)']];
const GE_INPUT_PIN_TYPE = { bool: 'bool', axis1d: 'float', axis2d: 'vector' };
const GE_INPUT_ACCUMULATE = [['highest', 'Take Highest Absolute Value'], ['cumulative', 'Cumulative (suma)']];

// Klawisze mapowań, nazwy jak w Unreal Engine. axis — klawisz daje wartość od −1 do 1 (albo wektor), a nie 0/1.
const GE_INPUT_KEYS = [
  { group: 'Klawiatura', keys: GE_KEYS.map(([key, label]) => [key, label]) },
  { group: 'Mysz', keys: [
    ['LeftMouseButton', 'Lewy przycisk myszy'], ['RightMouseButton', 'Prawy przycisk myszy'], ['MiddleMouseButton', 'Środkowy przycisk myszy'],
    ['MouseWheelUp', 'Kółko myszy w górę'], ['MouseWheelDown', 'Kółko myszy w dół'],
    ['MouseX', 'Mouse X (ruch w poziomie)', 'axis'], ['MouseY', 'Mouse Y (ruch w pionie)', 'axis'], ['Mouse2D', 'Mouse XY 2D-Axis', 'axis']
  ] },
  { group: 'Gamepad', keys: [
    ['Gamepad_FaceButton_Bottom', 'Face Button Bottom (A / ✕)'], ['Gamepad_FaceButton_Right', 'Face Button Right (B / ○)'],
    ['Gamepad_FaceButton_Left', 'Face Button Left (X / □)'], ['Gamepad_FaceButton_Top', 'Face Button Top (Y / △)'],
    ['Gamepad_LeftShoulder', 'Left Shoulder (LB / L1)'], ['Gamepad_RightShoulder', 'Right Shoulder (RB / R1)'],
    ['Gamepad_LeftTriggerAxis', 'Left Trigger Axis (LT / L2)', 'axis'], ['Gamepad_RightTriggerAxis', 'Right Trigger Axis (RT / R2)', 'axis'],
    ['Gamepad_DPad_Up', 'D-Pad Up'], ['Gamepad_DPad_Down', 'D-Pad Down'], ['Gamepad_DPad_Left', 'D-Pad Left'], ['Gamepad_DPad_Right', 'D-Pad Right'],
    ['Gamepad_Special_Left', 'Special Left (Back / Share)'], ['Gamepad_Special_Right', 'Special Right (Start / Options)'],
    ['Gamepad_LeftThumbstick', 'Left Thumbstick Button (L3)'], ['Gamepad_RightThumbstick', 'Right Thumbstick Button (R3)'],
    ['Gamepad_LeftX', 'Left Thumbstick X-Axis', 'axis'], ['Gamepad_LeftY', 'Left Thumbstick Y-Axis (w dół +)', 'axis'],
    ['Gamepad_RightX', 'Right Thumbstick X-Axis', 'axis'], ['Gamepad_RightY', 'Right Thumbstick Y-Axis (w dół +)', 'axis'],
    ['Gamepad_Left2D', 'Left Thumbstick 2D-Axis', 'axis'], ['Gamepad_Right2D', 'Right Thumbstick 2D-Axis', 'axis']
  ] }
];
const geInputKeyLabel = (key) => GE_INPUT_KEYS.flatMap((g) => g.keys).find(([k]) => k === key)?.[1] ?? (key || '(brak klawisza)');
// Klawisze zdarzenia klawisza i „Is Input Key Down”: klawiatura oraz przyciski i kółko myszy (bez osi).
const GE_EVENT_KEYS = [...GE_KEYS, ...GE_INPUT_KEYS.find((g) => g.group === 'Mysz').keys.filter((k) => !k[2]).map(([key, label]) => [key, label])];

// Kursory myszy jak EMouseCursor w Unreal Engine: [nazwa, opis]. Wygląd w przeglądarce — CURSOR_CSS w game-runtime.js.
const GE_CURSORS = [
  ['Default', 'Default (strzałka)'], ['None', 'None (ukryty)'], ['Hand', 'Hand (rączka)'], ['Crosshairs', 'Crosshairs (celownik)'],
  ['TextEditBeam', 'Text Edit Beam (kreska tekstu)'], ['GrabHand', 'Grab Hand (otwarta dłoń)'], ['GrabHandClosed', 'Grab Hand Closed (zaciśnięta dłoń)'],
  ['CardinalCross', 'Cardinal Cross (przesuwanie)'], ['ResizeLeftRight', 'Resize Left Right'], ['ResizeUpDown', 'Resize Up Down'],
  ['SlashedCircle', 'Slashed Circle (zakaz)']
];

// Triggery i Modyfikatory. params: [id, nazwa, domyślna wartość, rodzaj] — rodzaj: number, bool albo action.
// Każdy trigger (poza Chorded Action) ma też Actuation Threshold: od jakiej siły klawisz liczy się jako wciśnięty.
const GE_INPUT_TRIGGERS = {
  down: { label: 'Down', desc: 'Działa (Triggered) w każdej klatce, gdy klawisz jest wciśnięty.', params: [] },
  pressed: { label: 'Pressed', desc: 'Działa raz — w klatce, w której klawisz został wciśnięty.', params: [] },
  released: { label: 'Released', desc: 'Trwa (Ongoing), gdy klawisz jest trzymany, i działa raz po puszczeniu.', params: [] },
  hold: { label: 'Hold', desc: 'Działa po trzymaniu klawisza przez Hold Time. Z One Shot — tylko raz, inaczej w każdej klatce dalej.',
    params: [['holdTime', 'Hold Time Threshold (s)', 0.5, 'number'], ['oneShot', 'Is One Shot', false, 'bool']] },
  hold_release: { label: 'Hold And Release', desc: 'Działa po puszczeniu klawisza, ale tylko gdy był trzymany co najmniej Hold Time.',
    params: [['holdTime', 'Hold Time Threshold (s)', 0.5, 'number']] },
  tap: { label: 'Tap', desc: 'Działa po szybkim stuknięciu: wciśnij i puść przed Tap Release Time. Dłuższe trzymanie anuluje (Canceled).',
    params: [['tapTime', 'Tap Release Time Threshold (s)', 0.2, 'number']] },
  pulse: { label: 'Pulse', desc: 'Przy trzymanym klawiszu działa co Interval sekund (np. strzał z karabinu). Trigger Limit 0 — bez limitu.',
    params: [['interval', 'Interval (s)', 1, 'number'], ['onStart', 'Trigger On Start', true, 'bool'], ['limit', 'Trigger Limit', 0, 'number']] },
  chord: { label: 'Chorded Action', desc: 'Działa tylko wtedy, gdy wybrana akcja też działa (np. Shift + klawisz). Zwykle razem z innym triggerem.',
    params: [['action', 'Chord Action', '', 'action']], noThreshold: true }
};
const GE_INPUT_MODIFIERS = {
  negate: { label: 'Negate', desc: 'Odwraca znak wartości (np. A daje −1 zamiast 1). X / Y — które osie odwrócić.',
    params: [['x', 'X', true, 'bool'], ['y', 'Y', true, 'bool']] },
  swizzle: { label: 'Swizzle Input Axis Values', desc: 'Zamienia osie X i Y miejscami (YXZ) — np. W daje ruch w osi Y akcji Axis2D.', params: [] },
  deadzone: { label: 'Dead Zone', desc: 'Pomija małe wychylenia gałki (poniżej Lower), a resztę przelicza na zakres 0–1.',
    params: [['lower', 'Lower Threshold', 0.2, 'number'], ['upper', 'Upper Threshold', 1, 'number']] },
  scalar: { label: 'Scalar', desc: 'Mnoży wartość osi X i Y (np. czułość myszy).', params: [['x', 'X', 1, 'number'], ['y', 'Y', 1, 'number']] }
};

// Nowy trigger albo modyfikator danego typu z domyślnymi ustawieniami.
function geInputItem(what, type) {
  const def = (what === 'trig' ? GE_INPUT_TRIGGERS : GE_INPUT_MODIFIERS)[type];
  const item = { type, ...Object.fromEntries(def.params.map(([id, , value]) => [id, value])) };
  if (what === 'trig' && !def.noThreshold) item.threshold = 0.5;
  return item;
}
const geInputSummary = (list, defs) => (list ?? []).map((t) => defs[t.type]?.label ?? t.type).join(', ');

// Akcja i kontekst wybrane w węźle (tytuły i piny węzłów nie dostają projektu, więc biorą go z otwartego edytora).
const geEditorProject = () => (typeof ge !== 'undefined' && ge ? ge.project : null);
const geInputActionOf = (id) => {
  const p = geEditorProject();
  return p ? geAsset(p, id, 'input_action') : null;
};
const geInputAssetName = (id, kind) => {
  const p = geEditorProject();
  return (p && geAsset(p, id, kind)?.name) ?? (kind === 'input_action' ? '(wybierz akcję)' : '(wybierz kontekst)');
};
const geInputPinType = (n) => GE_INPUT_PIN_TYPE[geInputActionOf(n.props?.action)?.inputAction.valueType] ?? 'bool';
const geInputCheck = (prop, kind, msg) => (n, bp, project) => (geAsset(project, n.props?.[prop], kind) ? null : msg);
const GE_WIDGET_ELEMENTS = {
  text: { label: 'Tekst', w: 240, h: 40, text: 'Tekst', color: '#ffffff', size: 24, align: 'left' },
  button: { label: 'Przycisk', w: 180, h: 48, text: 'Przycisk', color: '#ffffff', bg: '#2a6fd6', size: 20 },
  box: { label: 'Prostokąt', w: 220, h: 120, bg: '#1e2a3a' },
  // Inny Widget Blueprint wstawiony w ten (kompozycja): el.widget — id klasy, x/y — lewy górny róg,
  // rozmiar wynika z elementów tamtego widgetu.
  widget: { label: 'Widget', w: 0, h: 0, widget: null }
};

// Komponenty klasy aktora (zakładka Viewport): bp.components = [{ id, type, name, …pola z defaults }].
// kind: shape — widoczny kształt, collision — niewidoczny kształt kolizji, movement — zachowanie bez kształtu.
// Położenie i obrót komponentu są względem środka aktora. Nazwa jest identyfikatorem (this.comp("Nazwa")).
const GE_COMP_SHAPE = { x: 0, y: 0, rotation: 0, z: 1, visible: true, collision: 'none', collisionEnabled: true };
const GE_COMP_TYPES = {
  box: { label: 'Prostokąt', ue: 'Cube', base: 'Prostokat', icon: '■', kind: 'shape', cat: 'Podstawowe kształty', defaults: { ...GE_COMP_SHAPE, w: 48, h: 48, color: '#e0a030' } },
  circle: { label: 'Koło', ue: 'Sphere', base: 'Kolo', icon: '●', kind: 'shape', cat: 'Podstawowe kształty', defaults: { ...GE_COMP_SHAPE, w: 48, h: 48, color: '#e04f5f' } },
  triangle: { label: 'Trójkąt', ue: 'Cone', base: 'Trojkat', icon: '▲', kind: 'shape', cat: 'Podstawowe kształty', defaults: { ...GE_COMP_SHAPE, w: 48, h: 48, color: '#5fbf4f' } },
  emoji: { label: 'Emoji', ue: 'Sprite', base: 'Emoji', icon: '🙂', kind: 'shape', cat: 'Podstawowe kształty', defaults: { ...GE_COMP_SHAPE, w: 40, h: 40, emoji: '⭐' } },
  text: { label: 'Napis', ue: 'Text Render', base: 'Napis', icon: 'T', kind: 'shape', cat: 'Podstawowe kształty', defaults: { ...GE_COMP_SHAPE, w: 120, h: 32, text: 'Napis', color: '#ffffff' } },
  image: { label: 'Obrazek', ue: 'Paper Sprite', base: 'Obrazek', icon: '🖼', kind: 'shape', cat: 'Podstawowe kształty', defaults: { ...GE_COMP_SHAPE, w: 64, h: 64, image: null, tile: false } },
  sprite: { label: 'Sprite / Animacja', ue: 'Paper Flipbook', base: 'Flipbook', icon: '🎞', kind: 'shape', cat: 'Podstawowe kształty', defaults: { ...GE_COMP_SHAPE, w: 64, h: 64, sprite: null } },
  box_collision: { label: 'Kolizja prostokątna', ue: 'Box Collision', base: 'KolizjaProstokatna', icon: '⬚', kind: 'collision', cat: 'Kolizja', defaults: { x: 0, y: 0, rotation: 0, w: 96, h: 96, collision: 'overlap', collisionEnabled: true } },
  circle_collision: { label: 'Kolizja okrągła', ue: 'Sphere Collision', base: 'KolizjaOkragla', icon: '◯', kind: 'collision', cat: 'Kolizja', defaults: { x: 0, y: 0, rotation: 0, w: 96, h: 96, collision: 'overlap', collisionEnabled: true } },
  rotating: { label: 'Obracanie', ue: 'Rotating Movement', base: 'Obracanie', icon: '⟳', kind: 'movement', cat: 'Ruch', defaults: { rate: 90, active: true } },
  projectile: { label: 'Pocisk', ue: 'Projectile Movement', base: 'Pocisk', icon: '➤', kind: 'movement', cat: 'Ruch', defaults: { vx: 400, vy: 0, active: true } }
};

const geCompKind = (c) => GE_COMP_TYPES[c?.type]?.kind ?? null;
const geCompOf = (node, bp) => geChainEntry(geProj(), bp, 'components', node.props?.comp)?.item ?? null;
const geCompLabel = (node, bp) => geCompOf(node, bp)?.name ?? '—';
// Ustawienie węzła „Komponent”; of — jakie rodzaje komponentów pasują.
const geCompProp = (of) => ({ id: 'comp', name: 'Komponent', kind: 'component', of });
// Grafy Blueprintu: Event Graph, (w klasach aktorów) Construction Script i grafy własnych funkcji.
const geGraphs = (bp) => [bp.graph, ...(bp.construction ? [bp.construction] : []), ...(bp.funcs ?? []).map((f) => f.graph)];

// Własne funkcje (Mój Blueprint › Funkcje): bp.funcs = [{ id, name, inputs: [{ id, name, type }], outputs: […], graph }].
// Graf funkcji zaczyna się węzłem wejścia (piny = parametry), a kończy węzłami Return Node (piny = wyniki).
// W kodzie funkcja to metoda fn_Nazwa(parametry), która zwraca obiekt z wynikami { Wynik: … }.
// Nazwy funkcji i pinów są od razu identyfikatorami w kodzie (pilnuje tego edytor).
// props.fn — funkcja (także odziedziczona, „idKlasy:idFunkcji”), props.cls — funkcja innej klasy (pin Target).
const geFnOf = (node, bp) => {
  const project = geProj();
  return geChainEntry(project, geVarClass(project, node, bp), 'funcs', node.props?.fn)?.item ?? null;
};
const geFnMethod = (fn) => 'fn_' + fn.name;
const geFnTitle = (node, bp) => geFnOf(node, bp)?.name ?? '(usunięta funkcja)';
const geFnCheck = (node, bp) => (geFnOf(node, bp) ? null : 'Ta funkcja została usunięta. Usuń węzeł.');
// Wyniki funkcji, gdy wykonanie nie dojdzie do żadnego Return Node: domyślne wartości typów.
const geFnDefaultReturn = (fn) => (fn.outputs.length ? `return { ${fn.outputs.map((o) => `${o.name}: ${geLiteral(geVarDefault(o.type), o)}`).join(', ')} };` : '');

const geKind = (bp) => (bp?.id === 'level' ? 'level' : GE_KINDS[bp?.kind] ? bp.kind : 'actor');
// Czy węzeł pasuje do rodzaju Blueprintu (zdarzenia kolizji tylko w aktorze, przyciski tylko w widgecie…).
const geNodeAllowed = (def, bp) => {
  const kind = geKind(bp);
  return !(def.actorOnly && kind !== 'actor') && !(def.widgetOnly && kind !== 'widget') && !(def.classOnly && kind === 'level')
    && !(def.noWidget && kind === 'widget') && !(def.childOnly && !bp?.parent)
    && !(def.animOnly && kind !== 'anim_bp') && !(def.noAnim && kind === 'anim_bp');
};

// ---------- Timeline (jak w Unreal Engine) ----------
// Timeline to węzeł Event Graph z danymi w node.props.tl: { length, useLast, autoPlay, loop, nextTrack, tracks }.
// Ścieżki: float — klucze { t, v, interp, arrive, leave }, vector — osobne krzywe x i y, event — klucze { t }
// (każda ścieżka to biały pin wyjścia), color — klucze { t, color, a }. Każda ścieżka daje pin „trk_<id>”.
// W grze stan trzyma Actor.timeline(klucz) (game-runtime.js), a ustawienia — static timelines klasy.
// Update, Finished i Event Tracki to osobne metody klasy, wywoływane przez Timeline w trakcie gry.
const GE_TL_TRACKS = {
  float: { label: 'Float Track', icon: 'ƒ', pin: 'float', prefix: 'NewTrack_' },
  event: { label: 'Event Track', icon: '◆', pin: 'exec', prefix: 'NewTrack_' },
  vector: { label: 'Vector Track', icon: '↗', pin: 'vector', prefix: 'NewTrack_' },
  color: { label: 'Color Track', icon: '🎨', pin: 'string', prefix: 'NewTrack_' }
};
const GE_TL_INTERP = [['auto', 'Auto'], ['user', 'User'], ['break', 'Break'], ['linear', 'Linear'], ['constant', 'Constant']];
const geNewTimeline = () => ({ length: 5, useLast: false, autoPlay: false, loop: false, nextTrack: 1, tracks: [] });
const geTl = (n) => n?.props?.tl ?? geNewTimeline();
const geTlPin = (track) => 'trk_' + track.id;
// Klucz Timeline'u w grze — taki sam jak id węzła w kompilatorze (klasa podrzędna dopisuje id klasy).
const geTlKey = (bp, nodeId) => (geParentOf(geProj(), bp) ? `${bp.id}_${nodeId}` : nodeId);
const geTlMethod = (bp, nodeId, pin) => `tl_${GE_RT.ident(geTlKey(bp, nodeId))}_${pin}`;
const geTlNodes = (bp) => (bp?.graph?.nodes ?? []).filter((n) => n.type === 'timeline');
// Pierwsza wolna nazwa Timeline_0, Timeline_1… (jak w Unreal Engine).
function geTimelineName(bp, except = null) {
  const taken = geTlNodes(bp).filter((n) => n !== except).map((n) => n.props?.name);
  let i = 0;
  while (taken.includes('Timeline_' + i)) i++;
  return 'Timeline_' + i;
}

// Ustawienia Timeline'u dla gry (static timelines): bez nazw ścieżek, klucze po kolei, z nazwami metod.
function geTimelineConfig(bp, n) {
  const tl = geTl(n);
  const sorted = (keys) => [...(keys ?? [])].sort((a, b) => a.t - b.t);
  return {
    length: Math.max(0, Number(tl.length) || 0), useLast: !!tl.useLast, autoPlay: !!tl.autoPlay, loop: !!tl.loop,
    update: geTlMethod(bp, n.id, 'update'), finished: geTlMethod(bp, n.id, 'finished'),
    tracks: tl.tracks.map((tr) => (tr.type === 'vector' ? { id: tr.id, type: tr.type, x: sorted(tr.x), y: sorted(tr.y) }
      : tr.type === 'event' ? { id: tr.id, type: tr.type, keys: sorted(tr.keys).map((k) => ({ t: k.t })), method: geTlMethod(bp, n.id, geTlPin(tr)) }
        : { id: tr.id, type: tr.type, keys: sorted(tr.keys) }))
  };
}

// Węzły funkcji Timeline'u (jak funkcje UTimelineComponent w UE): props.tl — id węzła Timeline w Event Graph.
const geTlOf = (n, bp) => geTlNodes(bp).find((t) => t.id === n.props?.tl) ?? null;
const geTlName = (n, bp) => geTlOf(n, bp)?.props?.name ?? '(usunięty Timeline)';
const geTlCode = (c) => `this.timeline(${JSON.stringify(geTlKey(c.bp, c.node.props?.tl))})`;
// [typ, nazwa w UE, opis po polsku, rodzaj, pin wejścia, pin wyjścia (argumenty geP), kod]
const GE_TL_FUNCS = [
  ['tl_set_play_rate', 'Set Play Rate', 'Ustaw prędkość odtwarzania (1 — normalnie, 2 — dwa razy szybciej).', 'exec', ['rate', 'New Rate', 'float', 1], null, (t, c) => `${t}.setPlayRate(${c.in('rate')});`],
  ['tl_get_play_rate', 'Get Play Rate', 'Prędkość odtwarzania.', 'pure', null, ['out', 'Return Value', 'float', 0], (t) => `${t}.playRate`],
  ['tl_get_position', 'Get Playback Position', 'Bieżący czas Timeline\'u w sekundach.', 'pure', null, ['out', 'Return Value', 'float', 0], (t) => `${t}.position`],
  ['tl_set_new_time', 'Set New Time', 'Przestawia czas Timeline\'u (uruchamia Update, bez Event Tracków).', 'exec', ['time', 'New Time', 'float', 0], null, (t, c) => `${t}.setNewTime(${c.in('time')});`],
  ['tl_is_playing', 'Is Playing', 'Czy Timeline jest odtwarzany.', 'pure', null, ['out', 'Return Value', 'bool', false], (t) => `${t}.playing`],
  ['tl_is_reversing', 'Is Reversing', 'Czy Timeline jest odtwarzany od końca (Reverse).', 'pure', null, ['out', 'Return Value', 'bool', false], (t) => `${t}.reversed`],
  ['tl_set_looping', 'Set Looping', 'Włącza albo wyłącza zapętlenie.', 'exec', ['looping', 'New Looping', 'bool', true], null, (t, c) => `${t}.setLooping(${c.in('looping')});`],
  ['tl_is_looping', 'Is Looping', 'Czy Timeline jest zapętlony.', 'pure', null, ['out', 'Return Value', 'bool', false], (t) => `${t}.looping`],
  ['tl_set_length', 'Set Timeline Length', 'Ustawia długość Timeline\'u w sekundach (bez Use Last Keyframe).', 'exec', ['length', 'New Length', 'float', 5], null, (t, c) => `${t}.setTimelineLength(${c.in('length')});`],
  ['tl_get_length', 'Get Timeline Length', 'Długość Timeline\'u w sekundach.', 'pure', null, ['out', 'Return Value', 'float', 0], (t) => `${t}.timelineLength`]
];

// ---------- Dziedziczenie klas aktorów ----------
// bp.parent — id klasy nadrzędnej (brak = Actor). Klasa podrzędna dziedziczy kod (class X extends Rodzic),
// zmienne, komponenty i interfejsy. Każda klasa numeruje zmienne i komponenty od 1, więc węzły wskazują
// odziedziczone jako „idKlasy:idElementu”, a własne — samym id.

// Projekt do szukania klas nadrzędnych: ten, który się kompiluje, albo otwarty w edytorze
// (tytuły i piny węzłów dostają tylko Blueprint).
let geActiveProject = null;
const geProj = () => geActiveProject ?? (typeof ge !== 'undefined' && ge ? ge.project : null);

function geParentOf(project, bp) {
  if (!bp?.parent || !project) return null;
  return project.blueprints.find((b) => b.id === bp.parent && geKind(b) === 'actor') ?? null;
}

// Klasy nadrzędne od najbliższej (rodzic, dziadek…). Pętla w danych nie zawiesi edytora.
function geAncestors(project, bp) {
  const list = [];
  for (let p = geParentOf(project, bp); p && p !== bp && !list.includes(p); p = geParentOf(project, p)) list.push(p);
  return list;
}

// Czy do pinu wejściowego węzła prowadzi kabel (w którymkolwiek grafie Blueprintu — id węzłów są wspólne).
const geNodeWired = (bp, nodeId, pinId) => [bp.graph, bp.construction, ...(bp.funcs ?? []).map((f) => f.graph)]
  .some((g) => g?.links?.some((l) => l.to[0] === nodeId && l.to[1] === pinId));

const geDescendants = (project, bp) =>project.blueprints.filter((b) => b !== bp && geAncestors(project, b).includes(bp));

// Zmienne albo komponenty klasy razem z odziedziczonymi (od najstarszego przodka): [{ item, owner, ref }].
function geChainEntries(project, bp, list) {
  const own = (b, ref) => (b?.[list] ?? []).map((item) => ({ item, owner: b, ref: ref(item) }));
  return [...geAncestors(project, bp).reverse().flatMap((a) => own(a, (item) => `${a.id}:${item.id}`)), ...own(bp, (item) => item.id)];
}

function geChainEntry(project, bp, list, ref) {
  return geChainEntries(project, bp, list).find((e) => e.ref === String(ref ?? '')) ?? null;
}

// Interfejsy klasy razem z odziedziczonymi.
const geClassInterfaces = (project, bp) => [...new Set([bp, ...geAncestors(project, bp)].flatMap((b) => b?.interfaces ?? []))];
const geMaterialLook = (m) => ({ color: m.material.color, opacity: m.material.opacity, glow: m.material.glow });

// Ustawienia klasy z nałożonym Materiałem i klatkami sprite'a — tak aktor wygląda w edytorze i w grze.
function geResolveDefaults(project, bp) {
  const d = bp.defaults;
  const m = d?.material && project.blueprints.find((b) => b.id === d.material && geKind(b) === 'material');
  const look = m ? { ...d, ...geMaterialLook(m) } : d;
  return d?.shape === 'sprite' ? { ...look, spriteData: geSpriteData(project, d.sprite) } : look;
}

// Komponenty klasy (z odziedziczonymi) tak, jak wyglądają: z nałożonym Materiałem i (sprites = true) klatkami Sprite'a.
function geLookComponents(project, bp, sprites = true) {
  return geChainEntries(project, bp, 'components').map(({ item: c }) => {
    const m = c.material && project.blueprints.find((b) => b.id === c.material && geKind(b) === 'material');
    const look = m ? { ...c, ...geMaterialLook(m) } : c;
    return sprites && c.type === 'sprite' ? { ...look, spriteData: geSpriteData(project, c.sprite) } : look;
  });
}

const geAsset = (project, id, kind) => project.blueprints.find((b) => b.id === id && geKind(b) === kind) || null;

// Klatki Sprite'a albo Animacji do rysowania: { fps, loop, frames: [{ tex, src, x, y, w, h }] }
// (x, y, w, h — wycinek tekstury w pikselach). Sprite to animacja z jedną klatką. Brak klatek — null.
function geSpriteData(project, id) {
  const frame = (s) => {
    const tex = s && geAsset(project, s.sprite.texture, 'texture');
    return tex?.texture.src ? { tex: tex.id, src: tex.texture.src, x: s.sprite.x, y: s.sprite.y, w: s.sprite.w, h: s.sprite.h } : null;
  };
  const sprite = geAsset(project, id, 'sprite');
  if (sprite) {
    const f = frame(sprite);
    return f ? { fps: 0, loop: true, frames: [f] } : null;
  }
  const anim = geAsset(project, id, 'animation');
  if (!anim) return null;
  const frames = anim.flipbook.frames.map((fid) => frame(geAsset(project, fid, 'sprite'))).filter(Boolean);
  return frames.length ? { fps: anim.flipbook.fps, loop: anim.flipbook.loop, frames } : null;
}

// Czy wartość z węzła „Play Sound 2D” to wbudowany dźwięk albo istniejący zasób Dźwięk.
const geSoundExists = (project, value) => GE_SOUNDS.some(([k]) => k === value) || !!geAsset(project, value, 'sound');

// Funkcja interfejsu zapisana w węźle jako „idInterfejsu:idFunkcji”.
function geIfaceFn(project, ref) {
  const [ifaceId, fnId] = String(ref ?? '').split(':');
  const iface = project?.blueprints.find((b) => b.id === ifaceId && geKind(b) === 'interface');
  const fn = iface?.functions.find((f) => f.id === fnId);
  return fn ? { iface, fn } : null;
}
const geIfaceMethod = (ref) => 'if_' + GE_RT.ident(String(ref ?? '').replace(':', '_'));
// Tytuły węzłów nie dostają projektu, więc biorą go z otwartego edytora.
const geIfaceFnName = (ref) => geIfaceFn(typeof ge !== 'undefined' && ge ? ge.project : null, ref)?.fn.name ?? '(wybierz funkcję)';

// Parametry zdarzenia własnego: n.props.inputs = [{ id, name, type }]. W kodzie to parametry metody arg_1, arg_2…
const geEventInputs = (n) => (Array.isArray(n?.props?.inputs) ? n.props.inputs : []);
const geEventParam = (p) => 'arg_' + p.id;

// Węzeł zdarzenia własnego o tej nazwie: najpierw w tej klasie i jej przodkach, potem w całym projekcie.
function geCustomEventNode(bp, name) {
  const project = geProj();
  const key = GE_RT.ident(String(name ?? ''));
  const list = [bp, ...geAncestors(project, bp), ...(project ? geCodeBlueprints(project) : [])];
  for (const b of list) {
    const node = b?.graph?.nodes.find((n) => n.type === 'ev_custom' && GE_RT.ident(n.props?.name || 'MojeZdarzenie') === key);
    if (node) return node;
  }
  return null;
}

const geX = (id = 'exec', name = '') => ({ id, name, type: 'exec' });
const geP = (id, name, type, def, extra = {}) => ({ id, name, type, def, ...extra });
const geClassName = (n) => geProj()?.blueprints.find((b) => b.id === n.props?.cls)?.name ?? 'Klasa';
// Węzły zmiennej innej klasy (props.cls): pin Target, obiekt w kodzie i sprawdzenie, czy Target jest podłączony.
const geVarTarget = (n) => geP('target', `Target (${geClassName(n)})`, 'actor', null);
const geVarHolder = (c) => (c.node.props?.cls ? `(${c.in('target')})` : 'this');
const geVarTargetCheck = (n, bp) => (n.props?.cls && !geNodeWired(bp, n.id, 'target')
  ? `Podłącz do pinu Target obiekt klasy ${geClassName(n)} (np. Get Game Instance albo Get Game Mode).` : null);
const geSelf = (id = 'target', name = 'Target') => geP(id, name, 'actor', null, { self: true });

// Event Dispatchery (Mój Blueprint › Event Dispatchers): bp.dispatchers = [{ id, name, inputs: [{ id, name, type }] }].
// Jak w Unreal Engine: Bind Event podpina zdarzenie własne (pin Event ← czerwony kwadrat Custom Event), Call uruchamia
// wszystkie podpięte zdarzenia, Unbind odpina jedno, Unbind All — wszystkie. props.disp — dispatcher (także odziedziczony),
// props.cls — dispatcher innej klasy (pin Target z jej obiektem). W grze dispatcher to klucz „idKlasy:idDispatchera”.
const geDispEntry = (node, bp) => {
  const project = geProj();
  return geChainEntry(project, geVarClass(project, node, bp), 'dispatchers', node.props?.disp);
};
const geDispOf = (node, bp) => geDispEntry(node, bp)?.item ?? null;
const geDispName = (node, bp) => geDispOf(node, bp)?.name ?? '(usunięty dispatcher)';
const geDispTarget = (n) => (n.props?.cls ? geVarTarget(n) : geSelf());
const geDispCheck = (n, bp) => (geDispOf(n, bp) ? geVarTargetCheck(n, bp) : 'Ten Event Dispatcher został usunięty. Usuń węzeł.');

// Zdarzenie własne, z którego kabel prowadzi do pinu Event węzła Bind / Unbind.
function geBoundEvent(bp, node) {
  for (const g of geGraphs(bp)) {
    const link = g.links.find((l) => l.to[0] === node.id && l.to[1] === 'event');
    if (link) return g.nodes.find((n) => n.id === link.from[0]) ?? null;
  }
  return null;
}

// Podpięte zdarzenie musi mieć parametry tych samych typów co dispatcher (jak sygnatura w Unreal Engine).
function geDispBindCheck(n, bp) {
  const problem = geDispCheck(n, bp);
  if (problem) return problem;
  const ev = geBoundEvent(bp, n);
  if (!ev) return 'Podłącz do pinu Event czerwony kwadrat (Delegate) zdarzenia własnego.';
  const disp = geDispOf(n, bp);
  const sig = (list) => list.map((p) => geType(p.type).short ?? geType(p.type).label.match(/\((.+)\)/)?.[1] ?? p.type).join(', ');
  return sig(geEventInputs(ev)) === sig(disp.inputs) ? null
    : `Zdarzenie „${ev.props?.name || 'MojeZdarzenie'}” musi mieć takie parametry jak ${disp.name}: (${sig(disp.inputs) || 'brak'}). Ustaw je w Szczegółach zdarzenia.`;
}
const geIndent = (code, pad = '  ') => (code ? code.split('\n').map((line) => (line ? pad + line : line)).join('\n') : '');

const GE_BUTTON_EVENTS = [
  ['ev_button_pressed', 'On Pressed', 'Gdy wciśnięto przycisk', 'onButtonPressed_', 'gracz wciśnie (jeszcze nie puści)'],
  ['ev_button_released', 'On Released', 'Gdy puszczono przycisk', 'onButtonReleased_', 'gracz puści'],
  ['ev_button_hovered', 'On Hovered', 'Gdy kursor najedzie na przycisk', 'onButtonHovered_', 'kursor myszy najedzie na'],
  ['ev_button_unhovered', 'On Unhovered', 'Gdy kursor zjedzie z przycisku', 'onButtonUnhovered_', 'kursor myszy zjedzie z']
];

// Rodzaje węzłów: event (czerwony nagłówek), exec (niebieski — robi coś), flow (szary — sterowanie),
// pure (zielony — tylko liczy). legacy — stary węzeł spoza Unreal Engine (ukryty, tylko dla starszych projektów). „stmt” zwraca jedną instrukcję, po której kompilator dokleja pin „then”;
// „gen” buduje kod sam (rozgałęzienia, pętle); „expr” zwraca wyrażenie dla pinu wyjściowego.
const GE_NODE_LIST = [
  // ---------- Zdarzenia ----------
  { type: 'ev_begin', title: 'Event BeginPlay', pl: 'Na start gry', cat: 'Zdarzenia', kind: 'event', method: 'beginPlay',
    desc: 'Uruchamia się raz, gdy aktor pojawi się w grze.', outs: [geX('then')] },
  { type: 'ev_tick', title: 'Event Tick', pl: 'Co klatkę', cat: 'Zdarzenia', kind: 'event', method: 'tick', params: 'deltaSeconds',
    desc: 'Uruchamia się w każdej klatce gry (ok. 60 razy na sekundę). Delta Seconds to czas od poprzedniej klatki.',
    outs: [geX('then'), geP('delta', 'Delta Seconds', 'float', 0, { expr: 'deltaSeconds' })] },
  { type: 'ev_key', title: (n) => geKeyLabel(n.props?.key ?? 'Space'), pl: 'Klawisz (zdarzenie klawiatury lub myszy)', cat: 'Zdarzenia', kind: 'event',
    desc: 'Uruchamia się, gdy gracz naciśnie (Pressed) albo puści (Released) wybrany klawisz albo przycisk myszy (np. Left Mouse Button — w dowolnym miejscu ekranu).',
    props: [{ id: 'key', name: 'Klawisz', kind: 'key', def: 'Space' }],
    outs: [geX('pressed', 'Pressed'), geX('released', 'Released')],
    methods: (n) => {
      const key = n.props?.key ?? 'Space';
      return [{ pin: 'pressed', name: `onKeyPressed_${key}`, params: '' }, { pin: 'released', name: `onKeyReleased_${key}`, params: '' }];
    } },
  { type: 'ev_any_key', title: 'Any Key', pl: 'Dowolny klawisz', cat: 'Zdarzenia', kind: 'event',
    desc: 'Uruchamia się przy naciśnięciu (Pressed) albo puszczeniu (Released) dowolnego klawisza lub przycisku myszy. Key to jego nazwa, np. Space, A, LeftMouseButton.',
    outs: [geX('pressed', 'Pressed'), geX('released', 'Released'), geP('key', 'Key', 'string', null, { expr: 'anyKey' })],
    methods: () => [{ pin: 'pressed', name: 'onAnyKeyPressed', params: 'anyKey' }, { pin: 'released', name: 'onAnyKeyReleased', params: 'anyKey' }] },
  { type: 'ev_overlap', title: 'Event ActorBeginOverlap', pl: 'Gdy coś na mnie najdzie', cat: 'Zdarzenia', kind: 'event', method: 'onBeginOverlap', params: 'otherActor', actorOnly: true,
    desc: 'Uruchamia się, gdy inny aktor zacznie zachodzić na tego aktora (potrzebna kolizja „Nakłada się” u jednego z nich).',
    outs: [geX('then'), geP('other', 'Other Actor', 'actor', null, { expr: 'otherActor' })] },
  { type: 'ev_end_overlap', title: 'Event ActorEndOverlap', pl: 'Gdy coś ze mnie zejdzie', cat: 'Zdarzenia', kind: 'event', method: 'onEndOverlap', params: 'otherActor', actorOnly: true,
    desc: 'Uruchamia się, gdy inny aktor przestanie zachodzić na tego aktora.',
    outs: [geX('then'), geP('other', 'Other Actor', 'actor', null, { expr: 'otherActor' })] },
  { type: 'ev_hit', title: 'Event Hit', pl: 'Gdy uderzę w przeszkodę', cat: 'Zdarzenia', kind: 'event', method: 'onHit', params: 'otherActor', actorOnly: true,
    desc: 'Uruchamia się, gdy aktor zderzy się z blokującym aktorem.',
    outs: [geX('then'), geP('other', 'Other Actor', 'actor', null, { expr: 'otherActor' })] },
  // Zdarzenia myszy działają, gdy Player Controller ma włączone Enable Click Events / Enable Mouse Over Events (Class Defaults › Mouse Interface).
  { type: 'ev_click', title: 'Event OnClicked', pl: 'Gdy ktoś mnie kliknie', cat: 'Zdarzenia', kind: 'event', method: 'onClicked', params: 'touchedActor, buttonPressed', actorOnly: true,
    desc: 'Uruchamia się, gdy gracz wciśnie przycisk myszy (albo dotknie ekranu) nad aktorem. Button Pressed to nazwa przycisku, np. LeftMouseButton. Działa, gdy Player Controller ma włączone Enable Click Events.',
    outs: [geX('then'), geP('touched', 'Touched Actor', 'actor', null, { expr: 'touchedActor' }), geP('button', 'Button Pressed', 'string', null, { expr: 'buttonPressed' })] },
  { type: 'ev_released', title: 'Event OnReleased', pl: 'Gdy ktoś mnie puści (kliknięcie)', cat: 'Zdarzenia', kind: 'event', method: 'onReleased', params: 'touchedActor, buttonReleased', actorOnly: true,
    desc: 'Uruchamia się, gdy gracz puści przycisk myszy nad aktorem. Działa, gdy Player Controller ma włączone Enable Click Events.',
    outs: [geX('then'), geP('touched', 'Touched Actor', 'actor', null, { expr: 'touchedActor' }), geP('button', 'Button Released', 'string', null, { expr: 'buttonReleased' })] },
  { type: 'ev_cursor_over', title: 'Event ActorBeginCursorOver', pl: 'Gdy kursor najedzie na mnie', cat: 'Zdarzenia', kind: 'event', method: 'onBeginCursorOver', params: 'touchedActor', actorOnly: true,
    desc: 'Uruchamia się, gdy kursor myszy wjedzie na aktora (np. podświetlenie). Działa, gdy Player Controller ma włączone Enable Mouse Over Events.',
    outs: [geX('then'), geP('touched', 'Touched Actor', 'actor', null, { expr: 'touchedActor' })] },
  { type: 'ev_cursor_end', title: 'Event ActorEndCursorOver', pl: 'Gdy kursor zjedzie ze mnie', cat: 'Zdarzenia', kind: 'event', method: 'onEndCursorOver', params: 'touchedActor', actorOnly: true,
    desc: 'Uruchamia się, gdy kursor myszy zjedzie z aktora. Działa, gdy Player Controller ma włączone Enable Mouse Over Events.',
    outs: [geX('then'), geP('touched', 'Touched Actor', 'actor', null, { expr: 'touchedActor' })] },
  { type: 'ev_destroyed', title: 'Event Destroyed', pl: 'Gdy zostanę zniszczony', cat: 'Zdarzenia', kind: 'event', method: 'onDestroyed', actorOnly: true,
    desc: 'Uruchamia się, gdy aktor zostanie zniszczony — także gdy spadnie poniżej Kill Y.', outs: [geX('then')] },
  { type: 'ev_construct', title: 'Event Construct', pl: 'Gdy widget powstanie', cat: 'Zdarzenia', kind: 'event', method: 'beginPlay', widgetOnly: true,
    desc: 'Uruchamia się raz, gdy widget zostanie utworzony węzłem „Create Widget”.', outs: [geX('then')] },
  { type: 'ev_button', title: (n) => `On Clicked (${n.props?.button || 'Przycisk1'})`, pl: 'Gdy kliknięto przycisk', cat: 'Zdarzenia', kind: 'event', widgetOnly: true,
    desc: 'Uruchamia się, gdy gracz kliknie przycisk widgetu o tej nazwie (przyciski dodajesz w Projektancie).',
    props: [{ id: 'button', name: 'Przycisk', kind: 'widget-button', def: 'Przycisk1' }],
    outs: [geX('then')],
    methods: (n) => [{ pin: 'then', name: 'onButton_' + GE_RT.ident(n.props?.button || 'Przycisk1'), params: '' }] },
  // Pozostałe zdarzenia przycisku widgetu, jak w Unreal Engine: [typ, nazwa, opis po polsku, metoda, kiedy].
  ...GE_BUTTON_EVENTS.map(([type, ue, pl, method, when]) => ({
    type, title: (n) => `${ue} (${n.props?.button || 'Przycisk1'})`, pl, cat: 'Zdarzenia', kind: 'event', widgetOnly: true,
    desc: `Uruchamia się, gdy ${when} przycisk widgetu o tej nazwie.`,
    props: [{ id: 'button', name: 'Przycisk', kind: 'widget-button', def: 'Przycisk1' }],
    outs: [geX('then')],
    methods: (n) => [{ pin: 'then', name: method + GE_RT.ident(n.props?.button || 'Przycisk1'), params: '' }]
  })),
  { type: 'ev_custom', title: (n) => n.props?.name || 'Custom Event', pl: 'Zdarzenie własne', cat: 'Zdarzenia', kind: 'event',
    desc: 'Twoje własne zdarzenie. Uruchomisz je węzłem „Call Custom Event”, timerem albo Event Dispatcherem (pin Delegate → Bind Event).',
    props: [{ id: 'name', name: 'Nazwa', kind: 'text', def: 'MojeZdarzenie' }, { id: 'inputs', name: 'Parametry (Inputs)', kind: 'event-inputs', detailsOnly: true }],
    // Pin Delegate (czerwony kwadrat) podłączasz do Bind Event / Unbind Event węzłów Event Dispatchera.
    pins: (n) => ({ ins: [], outs: [geX('then'), geP('delegate', 'Delegate', 'delegate', null, { expr: (c) => `this.delegate(${JSON.stringify(String(c.prop('name') || 'MojeZdarzenie'))})` }),
      ...geEventInputs(n).map((p) => geP(geEventParam(p), p.name, p.type, null, { expr: geEventParam(p) }))] }),
    methods: (n) => [{ pin: 'then', name: 'ev_' + GE_RT.ident(n.props?.name || 'MojeZdarzenie'), params: geEventInputs(n).map(geEventParam).join(', ') }] },
  { type: 'ev_comp_overlap', title: (n, bp) => `On Component Begin Overlap (${geCompLabel(n, bp)})`, pl: 'Gdy coś najdzie na komponent', cat: 'Zdarzenia', kind: 'event', actorOnly: true,
    desc: 'Uruchamia się, gdy inny aktor zacznie zachodzić na wybrany komponent (kolizję albo kształt z kolizją). Jedno z nich musi mieć kolizję „Nakłada się”.',
    props: [geCompProp(['shape', 'collision'])],
    outs: [geX('then'), geP('other', 'Other Actor', 'actor', null, { expr: 'otherActor' })],
    methods: (n, bp) => [{ pin: 'then', name: 'onCompOverlap_' + (geCompOf(n, bp)?.name ?? 'brak'), params: 'otherActor' }] },
  { type: 'ev_comp_end_overlap', title: (n, bp) => `On Component End Overlap (${geCompLabel(n, bp)})`, pl: 'Gdy coś zejdzie z komponentu', cat: 'Zdarzenia', kind: 'event', actorOnly: true,
    desc: 'Uruchamia się, gdy inny aktor przestanie zachodzić na wybrany komponent.',
    props: [geCompProp(['shape', 'collision'])],
    outs: [geX('then'), geP('other', 'Other Actor', 'actor', null, { expr: 'otherActor' })],
    methods: (n, bp) => [{ pin: 'then', name: 'onCompEndOverlap_' + (geCompOf(n, bp)?.name ?? 'brak'), params: 'otherActor' }] },
  // Początek grafu Construction Script — jest w nim zawsze dokładnie jeden i nie da się go usunąć.
  { type: 'ev_construction', title: 'Construction Script', pl: 'Skrypt konstrukcyjny', cat: 'Zdarzenia', kind: 'event', method: 'construct', actorOnly: true, hidden: true,
    desc: 'Uruchamia się, gdy aktor powstaje — przed BeginPlay. W edytorze działa przy każdej zmianie, więc od razu widzisz efekt w Widoku poziomu i w Viewporcie.',
    outs: [geX('then')] },
  // Jak „Parent: BeginPlay” w Unreal Engine: zdarzenie klasy podrzędnej zastępuje zdarzenie rodzica,
  // a ten węzeł uruchamia też wersję rodzica (super). Działa w każdym zdarzeniu i w Construction Script.
  { type: 'call_parent', title: 'Call Parent Event', pl: 'Wywołaj zdarzenie klasy nadrzędnej', cat: 'Zdarzenia', kind: 'exec', childOnly: true,
    desc: 'Uruchamia to samo zdarzenie w klasie nadrzędnej (np. jej BeginPlay albo Construction Script). Bez tego węzła zdarzenie klasy podrzędnej zastępuje zdarzenie rodzica.',
    ins: [geX()], outs: [geX('then')],
    stmt: (c) => {
      const m = c.method();
      return `super.${m.name}?.(${m.paramList});`;
    } },

  // ---------- Sterowanie ----------
  { type: 'branch', title: 'Branch', pl: 'Jeżeli', cat: 'Sterowanie', kind: 'flow',
    desc: 'Gdy warunek jest prawdziwy, idzie dalej pinem True, w przeciwnym razie pinem False.',
    ins: [geX(), geP('cond', 'Condition', 'bool', true)], outs: [geX('true', 'True'), geX('false', 'False')],
    gen: (c) => {
      const yes = c.exec('true');
      const no = c.exec('false');
      if (!yes && !no) return '';
      if (!yes) return `if (!(${c.in('cond')})) {\n${geIndent(no)}\n}`;
      return `if (${c.in('cond')}) {\n${geIndent(yes)}\n}` + (no ? ` else {\n${geIndent(no)}\n}` : '');
    } },
  { type: 'sequence', title: 'Sequence', pl: 'Po kolei', cat: 'Sterowanie', kind: 'flow',
    desc: 'Wykonuje po kolei: najpierw Then 0, potem Then 1, potem Then 2.',
    ins: [geX()], outs: [geX('then0', 'Then 0'), geX('then1', 'Then 1'), geX('then2', 'Then 2')],
    gen: (c) => ['then0', 'then1', 'then2'].map((pin) => c.exec(pin)).filter(Boolean).join('\n') },
  { type: 'for_loop', title: 'For Loop', pl: 'Powtórz', cat: 'Sterowanie', kind: 'flow',
    desc: 'Wykonuje Loop Body dla każdej liczby od First Index do Last Index, potem Completed.',
    ins: [geX(), geP('first', 'First Index', 'int', 0), geP('last', 'Last Index', 'int', 9)],
    outs: [geX('body', 'Loop Body'), geP('index', 'Index', 'int', 0, { local: 'index' }), geX('completed', 'Completed')],
    gen: (c) => {
      const i = c.local('index');
      const done = c.exec('completed');
      return `for (${i} = ${c.in('first')}; ${i} <= ${c.in('last')}; ${i}++) {\n${geIndent(c.exec('body'))}\n}` + (done ? `\n${done}` : '');
    } },
  // Pętla po kopii tablicy — zniszczenie aktora w Loop Body nie przesuwa kolejnych elementów.
  { type: 'for_each', title: 'For Each Loop', pl: 'Dla każdego elementu tablicy', cat: 'Tablice', kind: 'flow',
    desc: 'Wykonuje Loop Body dla każdego elementu tablicy (Array Element, Array Index), potem Completed.',
    pins: (n) => ({
      ins: [geX(), geP('array', 'Array', geArrayNodeType(n), null)],
      outs: [geX('body', 'Loop Body'), geP('element', 'Array Element', geArrayElem(n), null, { local: 'element' }), geP('index', 'Array Index', 'int', 0, { local: 'index' }), geX('completed', 'Completed')]
    }),
    gen: (c) => {
      const el = c.local('element');
      const i = c.local('index');
      const arr = 'arr_' + c.id;
      const done = c.exec('completed');
      return `{\n  const ${arr} = [...(${c.in('array')} ?? [])];\n  for (${i} = 0; ${i} < ${arr}.length; ${i}++) {\n    ${el} = ${arr}[${i}];\n${geIndent(c.exec('body'), '    ')}\n  }\n}` + (done ? `\n${done}` : '');
    } },
  { type: 'delay', title: 'Delay', pl: 'Odczekaj', cat: 'Sterowanie', kind: 'flow',
    desc: 'Czeka podaną liczbę sekund i dopiero wtedy idzie dalej pinem Completed.',
    ins: [geX(), geP('dur', 'Duration', 'float', 1)], outs: [geX('then', 'Completed')],
    gen: (c) => `this.delay('${c.id}', ${c.in('dur')}, () => {\n${geIndent(c.exec('then'))}\n});` },
  { type: 'do_once', title: 'Do Once', pl: 'Tylko raz', cat: 'Sterowanie', kind: 'flow',
    desc: 'Przepuszcza tylko za pierwszym razem, każde kolejne wywołanie jest pomijane.',
    ins: [geX()], outs: [geX('then', 'Completed')],
    gen: (c) => `if (this.doOnce('${c.id}')) {\n${geIndent(c.exec('then'))}\n}` },
  { type: 'flip_flop', title: 'FlipFlop', pl: 'Na przemian', cat: 'Sterowanie', kind: 'flow',
    desc: 'Za każdym wywołaniem idzie na przemian: raz pinem A, raz pinem B.',
    ins: [geX()], outs: [geX('a', 'A'), geX('b', 'B'), geP('isA', 'Is A', 'bool', false, { expr: (c) => `this.flipState('${c.id}')` })],
    gen: (c) => {
      const a = c.exec('a');
      const b = c.exec('b');
      return `if (this.flipFlop('${c.id}')) {\n${geIndent(a)}\n}` + (b ? ` else {\n${geIndent(b)}\n}` : '');
    } },
  { type: 'set_timer', title: 'Set Timer by Function Name', pl: 'Ustaw timer', cat: 'Sterowanie', kind: 'exec',
    desc: 'Po podanym czasie uruchamia zdarzenie własne o tej nazwie. Z Looping — powtarza je w kółko.',
    ins: [geX(), geP('name', 'Function Name', 'string', 'MojeZdarzenie'), geP('time', 'Time', 'float', 1), geP('loop', 'Looping', 'bool', true)], outs: [geX('then')],
    stmt: (c) => `this.setTimer(${c.in('name')}, ${c.in('time')}, ${c.in('loop')});` },
  { type: 'clear_timer', title: 'Clear Timer by Function Name', pl: 'Zatrzymaj timer', cat: 'Sterowanie', kind: 'exec',
    desc: 'Wyłącza timer o podanej nazwie.',
    ins: [geX(), geP('name', 'Function Name', 'string', 'MojeZdarzenie')], outs: [geX('then')],
    stmt: (c) => `this.clearTimer(${c.in('name')});` },
  // Timeline: wejście, którym przyszło wykonanie (c.entry), wybiera akcję. Update, Finished i Event Tracki
  // to osobne metody (methods), wywoływane przez Timeline w kolejnych klatkach gry — węzeł nie ma pinu „then”.
  { type: 'timeline', title: (n) => n.props?.name || 'Timeline', pl: 'Oś czasu (Timeline)', cat: 'Timeline', kind: 'flow', icon: '⏱', noWidget: true,
    desc: 'Odtwarza w czasie ścieżki z kluczami (liczby, wektory, kolory, zdarzenia). Podczas odtwarzania w każdej klatce idzie pinem Update z bieżącymi wartościami ścieżek, a na końcu pinem Finished. Kliknij węzeł dwa razy, żeby edytować ścieżki.',
    props: [{ id: 'name', name: 'Nazwa', kind: 'text', detailsOnly: true }, { id: 'tl', name: 'Timeline', kind: 'timeline', detailsOnly: true }],
    check: (n) => (n.props?.tl ? null : 'Ten Timeline nie ma danych — usuń węzeł i dodaj nowy (Add Timeline…).'),
    pins: (n) => ({
      ins: [geX('play', 'Play'), geX('playFromStart', 'Play from Start'), geX('stop', 'Stop'), geX('reverse', 'Reverse'), geX('reverseFromEnd', 'Reverse from End'),
        geX('setNewTime', 'Set New Time'), geP('newTime', 'New Time', 'float', 0)],
      outs: [geX('update', 'Update'), geX('finished', 'Finished'),
        geP('direction', 'Direction', 'string', null, { expr: (c) => `this.timeline(${JSON.stringify(c.id)}).direction` }),
        ...geTl(n).tracks.map((tr) => (tr.type === 'event' ? geX(geTlPin(tr), tr.name)
          : geP(geTlPin(tr), tr.name, GE_TL_TRACKS[tr.type].pin, null, { expr: (c) => `this.timeline(${JSON.stringify(c.id)}).value(${JSON.stringify(tr.id)})` })))]
    }),
    methods: (n, bp) => ['update', 'finished', ...geTl(n).tracks.filter((tr) => tr.type === 'event').map(geTlPin)]
      .map((pin) => ({ pin, name: geTlMethod(bp, n.id, pin), params: '' })),
    gen: (c) => {
      const tl = `this.timeline(${JSON.stringify(c.id)})`;
      if (c.entry === 'setNewTime') return `${tl}.setNewTime(${c.in('newTime')});`;
      return `${tl}.${{ playFromStart: 'playFromStart', stop: 'stop', reverse: 'reverse', reverseFromEnd: 'reverseFromEnd' }[c.entry] ?? 'play'}();`;
    } },
  { type: 'switch_tl_direction', title: 'Switch on ETimelineDirection', pl: 'Rozgałęzienie po kierunku Timeline\'u', cat: 'Timeline', kind: 'flow',
    desc: 'Idzie pinem Forward, gdy Timeline gra do przodu, albo Backward, gdy gra od końca (Reverse). Podłącz do Selection pin Direction z Timeline\'u.',
    ins: [geX(), geP('sel', 'Selection', 'string', 'Forward')], outs: [geX('forward', 'Forward'), geX('backward', 'Backward')],
    gen: (c) => {
      const fwd = c.exec('forward');
      const back = c.exec('backward');
      if (!fwd && !back) return '';
      if (!fwd) return `if (${c.in('sel')} === "Backward") {\n${geIndent(back)}\n}`;
      return `if (${c.in('sel')} !== "Backward") {\n${geIndent(fwd)}\n}` + (back ? ` else {\n${geIndent(back)}\n}` : '');
    } },
  ...GE_TL_FUNCS.map(([type, ue, desc, kind, inPin, outPin, code]) => ({
    type, title: (n, bp) => `${ue} (${geTlName(n, bp)})`, pl: `${ue} — Timeline`, cat: 'Timeline', kind, hidden: true, noWidget: true,
    desc, check: (n, bp) => (geTlOf(n, bp) ? null : 'Ten Timeline został usunięty. Usuń węzeł.'),
    ins: kind === 'exec' ? [geX(), geP(...inPin)] : [], outs: kind === 'exec' ? [geX('then')] : [geP(...outPin)],
    ...(kind === 'exec' ? { stmt: (c) => code(geTlCode(c), c) } : { expr: (c) => code(geTlCode(c), c) })
  })),
  // Jak w Unreal Engine: węzeł wywołania nazywa się tak jak zdarzenie (props.name), a menu ma osobny wpis dla każdego zdarzenia.
  { type: 'call_event', title: (n) => n.props?.name || 'MojeZdarzenie', pl: 'Wywołaj zdarzenie własne', cat: 'Sterowanie', kind: 'exec', hidden: true,
    desc: 'Uruchamia zdarzenie własne u wybranego aktora (domyślnie u siebie). Jeśli zdarzenie ma parametry, węzeł dostaje dla nich piny.',
    check: (n, bp) => (geCustomEventNode(bp, n.props?.name || 'MojeZdarzenie') ? null : `Nie ma zdarzenia własnego „${n.props?.name || 'MojeZdarzenie'}” — usuń węzeł albo dodaj takie zdarzenie.`),
    pins: (n, bp) => ({
      ins: [geX(), geSelf(), ...geEventInputs(geCustomEventNode(bp, n.props?.name || 'MojeZdarzenie')).map((p) => geP(geEventParam(p), p.name, p.type, geVarDefault(p.type)))],
      outs: [geX('then')]
    }),
    stmt: (c) => {
      const args = c.pins.ins.filter((p) => p.id.startsWith('arg_')).map((p) => c.in(p.id));
      return `${c.in('target')}.callEvent(${[JSON.stringify(String(c.prop('name') || 'MojeZdarzenie')), ...args].join(', ')});`;
    } },
  // Stary węzeł z nazwą zdarzenia w pinie (nie ma go w Unreal Engine) — ukryty, zostaje tylko dla starszych projektów,
  // w których do pinu Event prowadzi kabel (pozostałe przechodzą na call_event przy wczytaniu).
  { type: 'call_event_name', title: 'Call Custom Event', pl: 'Wywołaj zdarzenie', cat: 'Sterowanie', kind: 'exec', hidden: true, legacy: true,
    desc: 'Uruchamia zdarzenie własne o podanej nazwie u wybranego aktora (domyślnie u siebie). Jeśli zdarzenie ma parametry, węzeł dostaje dla nich piny.',
    // Piny parametrów bierze z węzła zdarzenia o nazwie wpisanej w pinie Event.
    pins: (n, bp) => ({
      ins: [geX(), geSelf(), geP('name', 'Event', 'string', 'MojeZdarzenie'),
        ...geEventInputs(geCustomEventNode(bp, n.values?.name ?? 'MojeZdarzenie')).map((p) => geP(geEventParam(p), p.name, p.type, geVarDefault(p.type)))],
      outs: [geX('then')]
    }),
    stmt: (c) => {
      const args = c.pins.ins.filter((p) => p.id.startsWith('arg_')).map((p) => c.in(p.id));
      return `${c.in('target')}.callEvent(${[c.in('name'), ...args].join(', ')});`;
    } },

  // ---------- Aktor ----------
  { type: 'self', title: 'Self', pl: 'Ja (Self)', cat: 'Aktor', kind: 'pure', compact: 'self',
    desc: 'Ten aktor — właściciel Blueprintu.', outs: [geP('out', '', 'actor', null)], expr: () => 'this' },
  { type: 'get_location', title: 'Get Actor Location', pl: 'Pobierz położenie', cat: 'Aktor', kind: 'pure',
    desc: 'Położenie środka aktora (X w prawo, Y w dół).',
    ins: [geSelf()], outs: [geP('out', 'Return Value', 'vector')], expr: (c) => `${c.in('target')}.location` },
  { type: 'set_location', title: 'Set Actor Location', pl: 'Ustaw położenie', cat: 'Aktor', kind: 'exec',
    desc: 'Przenosi aktora w podane miejsce (bez sprawdzania kolizji).',
    ins: [geX(), geSelf(), geP('loc', 'New Location', 'vector', { x: 0, y: 0 })], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.setLocation(${c.in('loc')});` },
  { type: 'add_offset', title: 'Add Actor World Offset', pl: 'Przesuń o', cat: 'Aktor', kind: 'exec',
    desc: 'Przesuwa aktora o podany wektor. Zatrzymuje się na blokujących przeszkodach.',
    ins: [geX(), geSelf(), geP('delta', 'Delta Location', 'vector', { x: 4, y: 0 })], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.addOffset(${c.in('delta')});` },
  { type: 'get_rotation', title: 'Get Actor Rotation', pl: 'Pobierz obrót', cat: 'Aktor', kind: 'pure',
    desc: 'Obrót aktora w stopniach.', ins: [geSelf()], outs: [geP('out', 'Return Value', 'float')], expr: (c) => `${c.in('target')}.rotation` },
  { type: 'set_rotation', title: 'Set Actor Rotation', pl: 'Ustaw obrót', cat: 'Aktor', kind: 'exec',
    desc: 'Ustawia obrót aktora w stopniach.',
    ins: [geX(), geSelf(), geP('deg', 'New Rotation', 'float', 0)], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.setRotation(${c.in('deg')});` },
  { type: 'add_rotation', title: 'Add Actor World Rotation', pl: 'Obróć o', cat: 'Aktor', kind: 'exec',
    desc: 'Obraca aktora o podaną liczbę stopni.',
    ins: [geX(), geSelf(), geP('deg', 'Delta Rotation', 'float', 5)], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.addRotation(${c.in('deg')});` },
  { type: 'get_forward', title: 'Get Actor Forward Vector', pl: 'Kierunek do przodu', cat: 'Aktor', kind: 'pure',
    desc: 'Wektor długości 1 w stronę, w którą aktor jest obrócony (obrót 0 — w prawo, 90 — w dół). Pomnóż go przez prędkość, żeby jechać albo strzelać przed siebie.',
    ins: [geSelf()], outs: [geP('out', 'Return Value', 'vector')], expr: (c) => `${c.in('target')}.forwardVector` },
  { type: 'get_right', title: 'Get Actor Right Vector', pl: 'Kierunek w prawo', cat: 'Aktor', kind: 'pure',
    desc: 'Wektor długości 1 w stronę prawej ręki aktora (prostopadle do przodu) — do chodzenia bokiem.',
    ins: [geSelf()], outs: [geP('out', 'Return Value', 'vector')], expr: (c) => `${c.in('target')}.rightVector` },
  { type: 'set_scale', title: 'Set Actor Scale 3D', pl: 'Ustaw skalę', cat: 'Aktor', kind: 'exec',
    desc: 'Zmienia rozmiar aktora (1 = normalny, -1 = odbicie lustrzane).',
    ins: [geX(), geSelf(), geP('scale', 'New Scale', 'vector', { x: 1, y: 1 })], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.setScale(${c.in('scale')});` },
  { type: 'destroy', title: 'Destroy Actor', pl: 'Zniszcz aktora', cat: 'Aktor', kind: 'exec',
    desc: 'Usuwa aktora z gry.', ins: [geX(), geSelf()], outs: [geX('then')], stmt: (c) => `${c.in('target')}.destroy();` },
  { type: 'set_color', title: 'Set Color', pl: 'Ustaw kolor', cat: 'Aktor', kind: 'exec',
    desc: 'Zmienia kolor aktora (prostokąta, koła albo tekstu).',
    ins: [geX(), geSelf(), geP('color', 'Color', 'string', '#ff4040', { color: true })], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.setColor(${c.in('color')});` },
  // Stary węzeł (w Unreal Engine Set Text jest funkcją komponentu Text Render, tu: Set Text (DefaultSceneRoot)) —
  // ukryty, zostaje dla starszych projektów, w których do pinu Target prowadzi kabel.
  { type: 'set_text', title: 'Set Text', pl: 'Ustaw tekst', cat: 'Aktor', kind: 'exec', hidden: true, legacy: true,
    desc: 'Zmienia napis aktora o kształcie „Tekst”.',
    ins: [geX(), geSelf(), geP('text', 'Text', 'string', 'Hej!')], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.setText(${c.in('text')});` },
  { type: 'set_visible', title: 'Set Actor Hidden In Game', pl: 'Pokaż / ukryj', cat: 'Aktor', kind: 'exec',
    desc: 'Ukrywa aktora (New Hidden zaznaczone) albo znów go pokazuje. Ukryty dalej działa i ma kolizję.',
    ins: [geX(), geSelf(), geP('hidden', 'New Hidden', 'bool', false)], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.setVisible(!${c.in('hidden')});` },
  { type: 'set_material', title: 'Set Material', pl: 'Ustaw materiał', cat: 'Aktor', kind: 'exec',
    desc: 'Nakłada na aktora wybrany Materiał z Przeglądarki zawartości (kolor, krycie, poświata).',
    props: [{ id: 'mat', name: 'Materiał', kind: 'material' }],
    ins: [geX(), geSelf()], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.setMaterial(${c.mat('mat')});` },
  { type: 'set_sprite', title: 'Set Flipbook', pl: 'Ustaw sprite / animację', cat: 'Aktor', kind: 'exec',
    desc: 'Zmienia wygląd aktora na wybrany Sprite albo Animację (Flipbook) z Przeglądarki zawartości — np. bieg, skok, stanie.',
    props: [{ id: 'sprite', name: 'Sprite / animacja', kind: 'sprite' }],
    check: (n, bp, project) => (geAsset(project, n.props?.sprite, 'sprite') || geAsset(project, n.props?.sprite, 'animation') ? null : 'Wybierz Sprite albo Animację w tym węźle.'),
    ins: [geX(), geSelf()], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.setSprite(${JSON.stringify(String(c.prop('sprite') ?? ''))});` },
  { type: 'distance', title: 'Get Distance To', pl: 'Odległość do', cat: 'Aktor', kind: 'pure',
    desc: 'Odległość między środkami dwóch aktorów.',
    ins: [geSelf(), geP('other', 'Other Actor', 'actor', null)], outs: [geP('out', 'Return Value', 'float')],
    expr: (c) => `${c.in('target')}.distanceTo(${c.in('other')})` },
  // Jak „Cast To” w Unreal Engine: sprawdza klasę i od razu daje aktora jako tę klasę (As …).
  { type: 'cast', title: (n) => `Cast To ${geClassName(n)}`, pl: 'Rzutuj na klasę (Czy jest klasy)', cat: 'Aktor', kind: 'flow',
    desc: 'Jeśli aktor jest z wybranej klasy Blueprint, idzie dalej górnym pinem i daje go w pinie As …; w przeciwnym razie idzie pinem Cast Failed.',
    props: [{ id: 'cls', name: 'Klasa', kind: 'class' }],
    pins: (n) => ({
      ins: [geX(), geP('actor', 'Object', 'actor', null)],
      outs: [geX('then'), geX('failed', 'Cast Failed'), geP('as', `As ${geClassName(n)}`, 'actor', null, { local: 'cast' })]
    }),
    gen: (c) => {
      const v = c.local('as');
      const obj = c.in('actor');
      const yes = c.exec('then');
      const no = c.exec('failed');
      return `${v} = G.isA(${obj}, ${c.cls('cls')}) ? ${obj} : null;\nif (${v}) {\n${geIndent(yes)}\n}` + (no ? ` else {\n${geIndent(no)}\n}` : '');
    } },
  // Stary węzeł (nie ma go w Unreal Engine) — ukryty, zostaje tylko dla starszych projektów.
  { type: 'is_a', title: 'Is A', pl: 'Czy jest klasy', cat: 'Aktor', kind: 'pure', hidden: true, legacy: true,
    desc: 'Prawda, jeśli aktor jest z wybranej klasy Blueprint.',
    props: [{ id: 'cls', name: 'Klasa', kind: 'class' }],
    ins: [geP('actor', 'Object', 'actor', null)], outs: [geP('out', 'Is A', 'bool')],
    expr: (c) => `G.isA(${c.in('actor')}, ${c.cls('cls')})` },
  { type: 'is_valid', title: 'Is Valid', pl: 'Czy istnieje', cat: 'Aktor', kind: 'pure',
    desc: 'Prawda, jeśli aktor jest podłączony i nie został zniszczony.',
    ins: [geP('actor', 'Object', 'actor', null)], outs: [geP('out', 'Return Value', 'bool')], expr: (c) => `G.isValid(${c.in('actor')})` },
  { type: 'get_name', title: 'Get Display Name', pl: 'Nazwa aktora', cat: 'Aktor', kind: 'pure',
    desc: 'Nazwa aktora z Outlinera.', ins: [geSelf()], outs: [geP('out', 'Return Value', 'string')], expr: (c) => `${c.in('target')}.name` },

  // ---------- Komponenty (dodajesz je w zakładce Viewport; działają na komponentach tego aktora) ----------
  { type: 'comp_visible', title: (n, bp) => `Set Visibility (${geCompLabel(n, bp)})`, pl: 'Pokaż / ukryj komponent', cat: 'Komponenty', kind: 'exec', actorOnly: true,
    desc: 'Pokazuje albo ukrywa wybrany komponent kształtu.', props: [geCompProp(['shape'])],
    ins: [geX(), geP('visible', 'New Visibility', 'bool', true)], outs: [geX('then')],
    stmt: (c) => `this.comp(${c.comp()}).visible = ${c.in('visible')};` },
  { type: 'comp_color', title: (n, bp) => `Set Color (${geCompLabel(n, bp)})`, pl: 'Kolor komponentu', cat: 'Komponenty', kind: 'exec', actorOnly: true,
    desc: 'Zmienia kolor komponentu (prostokąta, koła, trójkąta albo napisu).', props: [geCompProp(['shape'])],
    ins: [geX(), geP('color', 'Color', 'string', '#ff4040', { color: true })], outs: [geX('then')],
    stmt: (c) => `this.comp(${c.comp()}).color = ${c.in('color')};` },
  { type: 'comp_text', title: (n, bp) => `Set Text (${geCompLabel(n, bp)})`, pl: 'Napis komponentu', cat: 'Komponenty', kind: 'exec', actorOnly: true,
    desc: 'Zmienia tekst komponentu Napis.', props: [geCompProp(['shape'])],
    ins: [geX(), geP('text', 'Text', 'string', 'Hej!')], outs: [geX('then')],
    stmt: (c) => `this.comp(${c.comp()}).text = String(${c.in('text')});` },
  { type: 'comp_location', title: (n, bp) => `Set Relative Location (${geCompLabel(n, bp)})`, pl: 'Przesuń komponent', cat: 'Komponenty', kind: 'exec', actorOnly: true,
    desc: 'Ustawia położenie komponentu względem środka aktora.', props: [geCompProp(['shape', 'collision'])],
    ins: [geX(), geP('loc', 'New Location', 'vector', { x: 0, y: 0 })], outs: [geX('then')],
    stmt: (c) => `this.setComponentLocation(${c.comp()}, ${c.in('loc')});` },
  { type: 'comp_get_location', title: (n, bp) => `Get Relative Location (${geCompLabel(n, bp)})`, pl: 'Położenie komponentu', cat: 'Komponenty', kind: 'pure', actorOnly: true,
    desc: 'Położenie komponentu względem środka aktora.', props: [geCompProp(['shape', 'collision'])],
    outs: [geP('out', 'Return Value', 'vector')], expr: (c) => `this.componentLocation(${c.comp()})` },
  { type: 'comp_rotation', title: (n, bp) => `Set Relative Rotation (${geCompLabel(n, bp)})`, pl: 'Obróć komponent', cat: 'Komponenty', kind: 'exec', actorOnly: true,
    desc: 'Ustawia obrót komponentu (w stopniach, względem aktora).', props: [geCompProp(['shape', 'collision'])],
    ins: [geX(), geP('deg', 'New Rotation', 'float', 0)], outs: [geX('then')],
    stmt: (c) => `this.comp(${c.comp()}).rotation = ${c.in('deg')};` },
  { type: 'comp_size', title: (n, bp) => `Set Size (${geCompLabel(n, bp)})`, pl: 'Rozmiar komponentu', cat: 'Komponenty', kind: 'exec', actorOnly: true,
    desc: 'Zmienia szerokość (X) i wysokość (Y) komponentu.', props: [geCompProp(['shape', 'collision'])],
    ins: [geX(), geP('size', 'New Size', 'vector', { x: 64, y: 64 })], outs: [geX('then')],
    stmt: (c) => `this.setComponentSize(${c.comp()}, ${c.in('size')});` },
  { type: 'comp_collision', title: (n, bp) => `Set Collision Enabled (${geCompLabel(n, bp)})`, pl: 'Włącz / wyłącz kolizję komponentu', cat: 'Komponenty', kind: 'exec', actorOnly: true,
    desc: 'Włącza albo wyłącza kolizję komponentu (np. pułapka działa tylko co jakiś czas).', props: [geCompProp(['shape', 'collision'])],
    ins: [geX(), geP('on', 'Enabled', 'bool', true)], outs: [geX('then')],
    stmt: (c) => `this.comp(${c.comp()}).collisionEnabled = ${c.in('on')};` },
  { type: 'comp_active', title: (n, bp) => `Set Active (${geCompLabel(n, bp)})`, pl: 'Włącz / wyłącz ruch', cat: 'Komponenty', kind: 'exec', actorOnly: true,
    desc: 'Włącza albo wyłącza komponent ruchu (Obracanie, Pocisk). Włączony Pocisk od razu dostaje swoją prędkość.', props: [geCompProp(['movement'])],
    ins: [geX(), geP('on', 'New Active', 'bool', true)], outs: [geX('then')],
    stmt: (c) => `this.setComponentActive(${c.comp()}, ${c.in('on')});` },

  // ---------- Ruch i fizyka ----------
  { type: 'move_input', title: 'Add Movement Input', pl: 'Idź w kierunku', cat: 'Ruch i fizyka', kind: 'exec',
    desc: 'Rusza aktorem w tej klatce z jego Prędkością ruchu. Użyj w „Event Tick”. Z grawitacją liczy się tylko X.',
    ins: [geX(), geSelf(), geP('dir', 'World Direction', 'vector', { x: 1, y: 0 }), geP('scale', 'Scale Value', 'float', 1)], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.addMovementInput(${c.in('dir')}, ${c.in('scale')});` },
  { type: 'jump', title: 'Jump', pl: 'Skocz', cat: 'Ruch i fizyka', kind: 'exec',
    desc: 'Skok z Siłą skoku aktora. Z grawitacją działa tylko, gdy aktor stoi na ziemi.',
    ins: [geX(), geSelf()], outs: [geX('then')], stmt: (c) => `${c.in('target')}.jump();` },
  { type: 'on_ground', title: 'Is Moving On Ground', pl: 'Czy stoi na ziemi', cat: 'Ruch i fizyka', kind: 'pure',
    desc: 'Prawda, gdy aktor z grawitacją stoi na czymś blokującym.', ins: [geSelf()], outs: [geP('out', 'Return Value', 'bool')],
    expr: (c) => `${c.in('target')}.isOnGround()` },
  { type: 'get_velocity', title: 'Get Velocity', pl: 'Pobierz prędkość', cat: 'Ruch i fizyka', kind: 'pure',
    desc: 'Prędkość aktora w pikselach na sekundę.', ins: [geSelf()], outs: [geP('out', 'Return Value', 'vector')],
    expr: (c) => `${c.in('target')}.velocity` },
  { type: 'set_velocity', title: 'Set Velocity', pl: 'Ustaw prędkość', cat: 'Ruch i fizyka', kind: 'exec',
    desc: 'Ustawia prędkość aktora (piksele na sekundę). Aktor sam się przesuwa i zatrzymuje na przeszkodach.',
    ins: [geX(), geSelf(), geP('vel', 'New Velocity', 'vector', { x: 200, y: 0 })], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.setVelocity(${c.in('vel')});` },
  { type: 'launch', title: 'Launch Character', pl: 'Wystrzel', cat: 'Ruch i fizyka', kind: 'exec',
    desc: 'Dodaje do prędkości aktora podany wektor — np. odbicie od trampoliny.',
    ins: [geX(), geSelf(), geP('vel', 'Launch Velocity', 'vector', { x: 0, y: -900 })], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.launch(${c.in('vel')});` },

  // ---------- Wejście ----------
  { type: 'key_down', title: (n) => `Is Input Key Down (${geKeyLabel(n.props?.key ?? 'Space')})`, pl: 'Czy wciśnięty klawisz', cat: 'Wejście', kind: 'pure',
    desc: 'Prawda, dopóki gracz trzyma wybrany klawisz.',
    props: [{ id: 'key', name: 'Klawisz', kind: 'key', def: 'Space' }], outs: [geP('out', 'Return Value', 'bool')],
    expr: (c) => `G.isKeyDown('${c.prop('key')}')` },
  { type: 'axis', title: 'Get Input Axis Value', pl: 'Oś sterowania', cat: 'Wejście', kind: 'pure',
    desc: 'Poziomo: -1 (A, ←), 0 albo 1 (D, →). Pionowo: -1 (W, ↑), 0 albo 1 (S, ↓).',
    props: [{ id: 'axis', name: 'Oś', kind: 'axis', def: 'horizontal' }], outs: [geP('out', 'Axis Value', 'float')],
    expr: (c) => `G.axis('${c.prop('axis')}')` },
  { type: 'mouse_pos', title: 'Get Mouse Position', pl: 'Pozycja myszy', cat: 'Wejście', kind: 'pure',
    desc: 'Miejsce w świecie gry, nad którym jest kursor.', outs: [geP('out', 'Return Value', 'vector')], expr: () => 'G.mouse' },
  { type: 'mouse_screen', title: 'Get Mouse Position on Viewport', pl: 'Pozycja myszy na ekranie', cat: 'Wejście', kind: 'pure',
    desc: 'Miejsce kursora na ekranie gry (lewy górny róg to 0, 0) — tak jak położenie elementów widgetu.',
    outs: [geP('out', 'Return Value', 'vector')], expr: () => 'G.mouseScreen' },
  { type: 'hit_under_cursor', title: 'Get Hit Result Under Cursor', pl: 'Co jest pod kursorem', cat: 'Wejście', kind: 'pure',
    desc: 'Aktor pod kursorem myszy (Hit Actor) i miejsce w świecie (Location). Return Value — czy kursor jest nad jakimś aktorem.',
    outs: [geP('actor', 'Hit Actor', 'actor'), geP('loc', 'Location', 'vector'), geP('out', 'Return Value', 'bool')],
    expr: (c, out) => (out === 'actor' ? 'G.actorUnderCursor()' : out === 'loc' ? 'G.mouse' : 'G.isValid(G.actorUnderCursor())') },
  // Mouse Interface Player Controllera. Target pusty — Player Controller z Ustawień świata.
  { type: 'set_show_cursor', title: 'Set Show Mouse Cursor', pl: 'Pokaż / ukryj kursor myszy', cat: 'Wejście', kind: 'exec',
    desc: 'Pokazuje albo chowa kursor myszy nad grą. Na start ustawisz to w Class Defaults Player Controllera › Mouse Interface.',
    ins: [geX(), geP('target', 'Target (Player Controller)', 'actor', null), geP('show', 'Show Mouse Cursor', 'bool', true)], outs: [geX('then')],
    stmt: (c) => `G.setMouseInterface(${c.in('target')}, 'showMouseCursor', ${c.in('show')});` },
  { type: 'get_show_cursor', title: 'Get Show Mouse Cursor', pl: 'Czy kursor jest widoczny', cat: 'Wejście', kind: 'pure',
    desc: 'Prawda, gdy kursor myszy jest widoczny nad grą.',
    ins: [geP('target', 'Target (Player Controller)', 'actor', null)], outs: [geP('out', 'Show Mouse Cursor', 'bool')],
    expr: (c) => `G.getMouseInterface(${c.in('target')}, 'showMouseCursor')` },
  { type: 'set_click_events', title: 'Set Enable Click Events', pl: 'Włącz / wyłącz klikanie aktorów', cat: 'Wejście', kind: 'exec',
    desc: 'Włącza albo wyłącza zdarzenia „Event OnClicked” i „Event OnReleased” aktorów.',
    ins: [geX(), geP('target', 'Target (Player Controller)', 'actor', null), geP('on', 'Enable Click Events', 'bool', true)], outs: [geX('then')],
    stmt: (c) => `G.setMouseInterface(${c.in('target')}, 'enableClickEvents', ${c.in('on')});` },
  { type: 'set_mouse_over_events', title: 'Set Enable Mouse Over Events', pl: 'Włącz / wyłącz najeżdżanie kursorem', cat: 'Wejście', kind: 'exec',
    desc: 'Włącza albo wyłącza zdarzenia „Event ActorBeginCursorOver” i „Event ActorEndCursorOver” aktorów.',
    ins: [geX(), geP('target', 'Target (Player Controller)', 'actor', null), geP('on', 'Enable Mouse Over Events', 'bool', true)], outs: [geX('then')],
    stmt: (c) => `G.setMouseInterface(${c.in('target')}, 'enableMouseOverEvents', ${c.in('on')});` },
  { type: 'set_cursor_type', title: (n) => `Set Current Mouse Cursor (${n.props?.cursor ?? 'Default'})`, pl: 'Zmień wygląd kursora', cat: 'Wejście', kind: 'exec',
    desc: 'Zmienia wygląd kursora myszy, np. na rączkę albo celownik.',
    props: [{ id: 'cursor', name: 'Kursor', kind: 'cursor', def: 'Default' }],
    ins: [geX(), geP('target', 'Target (Player Controller)', 'actor', null)], outs: [geX('then')],
    stmt: (c) => `G.setMouseInterface(${c.in('target')}, 'defaultMouseCursor', ${JSON.stringify(String(c.prop('cursor')))});` },
  { type: 'input_mode_game', title: 'Set Input Mode Game Only', pl: 'Wejście tylko do gry', cat: 'Wejście', kind: 'exec',
    desc: 'Klawisze i mysz trafiają tylko do gry — przyciski widgetów nie reagują.',
    ins: [geX()], outs: [geX('then')], stmt: () => "G.setInputMode('game');" },
  { type: 'input_mode_ui', title: 'Set Input Mode UI Only', pl: 'Wejście tylko do interfejsu', cat: 'Wejście', kind: 'exec',
    desc: 'Działają tylko przyciski widgetów — zdarzenia klawiszy, Enhanced Input i klikanie aktorów są wyłączone (np. menu pauzy).',
    ins: [geX()], outs: [geX('then')], stmt: () => "G.setInputMode('ui');" },
  { type: 'input_mode_game_ui', title: 'Set Input Mode Game And UI', pl: 'Wejście do gry i interfejsu', cat: 'Wejście', kind: 'exec',
    desc: 'Działa i gra, i przyciski widgetów (tak jest na start gry).',
    ins: [geX()], outs: [geX('then')], stmt: () => "G.setInputMode('gameui');" },

  // Enhanced Input. Menu węzłów pokazuje gotowe warianty dla każdej akcji i kontekstu z Przeglądarki zawartości.
  { type: 'ev_input_action', title: (n) => `EnhancedInputAction ${geInputAssetName(n.props?.action, 'input_action')}`, pl: 'Zdarzenie akcji wejścia (Enhanced Input)', cat: 'Wejście', kind: 'event', hidden: true,
    desc: 'Uruchamia się według Triggerów akcji: Started — akcja zaczęła działać, Ongoing — trwa (np. trzymanie przed czasem Hold), Triggered — zadziałała (przy Down w każdej klatce), Completed — skończyła się, Canceled — przerwana, zanim zadziałała. Klawisze akcji ustawiasz w Input Mapping Context, a kontekst włączasz w Ustawieniach świata albo węzłem „Add Mapping Context”.',
    props: [{ id: 'action', name: 'Input Action', kind: 'input-action' }],
    check: geInputCheck('action', 'input_action', 'Wybierz Input Action w tym węźle.'),
    pins: (n) => ({ ins: [], outs: [
      geX('Triggered', 'Triggered'), geX('Started', 'Started'), geX('Ongoing', 'Ongoing'), geX('Canceled', 'Canceled'), geX('Completed', 'Completed'),
      geP('value', 'Action Value', geInputPinType(n), null, { expr: 'actionValue' }),
      geP('elapsed', 'Elapsed Seconds', 'float', 0, { expr: 'elapsedSeconds' }),
      geP('triggeredSec', 'Triggered Seconds', 'float', 0, { expr: 'triggeredSeconds' })
    ] }),
    methods: (n) => ['Triggered', 'Started', 'Ongoing', 'Canceled', 'Completed'].map((pin) => ({
      pin, name: `onInput_${GE_RT.ident(geInputAssetName(n.props?.action, 'input_action'))}_${pin}`, params: 'actionValue, elapsedSeconds, triggeredSeconds'
    })) },
  { type: 'input_value', title: (n) => `Get ${geInputAssetName(n.props?.action, 'input_action')} (Action Value)`, pl: 'Wartość akcji wejścia', cat: 'Wejście', kind: 'pure', hidden: true,
    desc: 'Obecna wartość akcji: bool, liczba albo wektor X, Y — zależnie od Value Type akcji. Gdy akcja nie działa, wartość to zero (false).',
    props: [{ id: 'action', name: 'Input Action', kind: 'input-action' }],
    check: geInputCheck('action', 'input_action', 'Wybierz Input Action w tym węźle.'),
    pins: (n) => ({ ins: [], outs: [geP('out', 'Action Value', geInputPinType(n))] }),
    expr: (c) => `G.inputValue(${c.asset('action', 'input_action')})` },
  { type: 'add_mapping_context', title: (n) => `Add Mapping Context (${geInputAssetName(n.props?.ctx, 'input_context')})`, pl: 'Włącz mapowanie klawiszy', cat: 'Wejście', kind: 'exec', hidden: true,
    desc: 'Włącza Input Mapping Context. Gdy ten sam klawisz jest w kilku kontekstach, wygrywa ten o wyższym Priority (np. menu ma wyższy niż chodzenie).',
    props: [{ id: 'ctx', name: 'Mapping Context', kind: 'input-context' }],
    check: geInputCheck('ctx', 'input_context', 'Wybierz Input Mapping Context w tym węźle.'),
    ins: [geX(), geP('priority', 'Priority', 'int', 0)], outs: [geX('then')],
    stmt: (c) => `G.addMappingContext(${c.asset('ctx', 'input_context')}, ${c.in('priority')});` },
  { type: 'remove_mapping_context', title: (n) => `Remove Mapping Context (${geInputAssetName(n.props?.ctx, 'input_context')})`, pl: 'Wyłącz mapowanie klawiszy', cat: 'Wejście', kind: 'exec', hidden: true,
    desc: 'Wyłącza Input Mapping Context — jego klawisze przestają uruchamiać akcje.',
    props: [{ id: 'ctx', name: 'Mapping Context', kind: 'input-context' }],
    check: geInputCheck('ctx', 'input_context', 'Wybierz Input Mapping Context w tym węźle.'),
    ins: [geX()], outs: [geX('then')],
    stmt: (c) => `G.removeMappingContext(${c.asset('ctx', 'input_context')});` },
  { type: 'has_mapping_context', title: (n) => `Has Mapping Context (${geInputAssetName(n.props?.ctx, 'input_context')})`, pl: 'Czy mapowanie jest włączone', cat: 'Wejście', kind: 'pure', hidden: true,
    desc: 'Prawda, gdy ten Input Mapping Context jest teraz włączony.',
    props: [{ id: 'ctx', name: 'Mapping Context', kind: 'input-context' }],
    check: geInputCheck('ctx', 'input_context', 'Wybierz Input Mapping Context w tym węźle.'),
    outs: [geP('out', 'Return Value', 'bool')],
    expr: (c) => `G.hasMappingContext(${c.asset('ctx', 'input_context')})` },
  { type: 'clear_mappings', title: 'Clear All Mappings', pl: 'Wyłącz wszystkie mapowania', cat: 'Wejście', kind: 'exec',
    desc: 'Wyłącza wszystkie Input Mapping Context (np. na czas przerywnika filmowego).',
    ins: [geX()], outs: [geX('then')], stmt: () => 'G.clearMappingContexts();' },

  // ---------- Matematyka ----------
  { type: 'add', title: 'float + float', pl: 'Dodaj', cat: 'Matematyka', kind: 'pure', compact: '+',
    ins: [geP('a', '', 'float', 0), geP('b', '', 'float', 1)], outs: [geP('out', '', 'float')], expr: (c) => `(${c.in('a')} + ${c.in('b')})` },
  { type: 'sub', title: 'float - float', pl: 'Odejmij', cat: 'Matematyka', kind: 'pure', compact: '−',
    ins: [geP('a', '', 'float', 0), geP('b', '', 'float', 1)], outs: [geP('out', '', 'float')], expr: (c) => `(${c.in('a')} - ${c.in('b')})` },
  { type: 'mul', title: 'float * float', pl: 'Pomnóż', cat: 'Matematyka', kind: 'pure', compact: '×',
    ins: [geP('a', '', 'float', 0), geP('b', '', 'float', 1)], outs: [geP('out', '', 'float')], expr: (c) => `(${c.in('a')} * ${c.in('b')})` },
  { type: 'div', title: 'float / float', pl: 'Podziel', cat: 'Matematyka', kind: 'pure', compact: '÷',
    ins: [geP('a', '', 'float', 0), geP('b', '', 'float', 1)], outs: [geP('out', '', 'float')], expr: (c) => `(${c.in('a')} / ${c.in('b')})` },
  { type: 'mod', title: 'int % int', pl: 'Reszta z dzielenia', cat: 'Matematyka', kind: 'pure', compact: '%',
    ins: [geP('a', '', 'int', 0), geP('b', '', 'int', 2)], outs: [geP('out', '', 'int')], expr: (c) => `(${c.in('a')} % ${c.in('b')})` },
  { type: 'rand_float', title: 'Random Float in Range', pl: 'Losowa liczba', cat: 'Matematyka', kind: 'pure',
    desc: 'Losowa liczba z przedziału od Min do Max.',
    ins: [geP('min', 'Min', 'float', 0), geP('max', 'Max', 'float', 1)], outs: [geP('out', 'Return Value', 'float')],
    expr: (c) => `G.randomFloat(${c.in('min')}, ${c.in('max')})` },
  { type: 'rand_int', title: 'Random Integer in Range', pl: 'Losowa liczba całkowita', cat: 'Matematyka', kind: 'pure',
    desc: 'Losowa liczba całkowita od Min do Max (włącznie).',
    ins: [geP('min', 'Min', 'int', 1), geP('max', 'Max', 'int', 6)], outs: [geP('out', 'Return Value', 'int')],
    expr: (c) => `G.randomInt(${c.in('min')}, ${c.in('max')})` },
  { type: 'clamp', title: 'Clamp (float)', pl: 'Ogranicz', cat: 'Matematyka', kind: 'pure',
    desc: 'Zwraca wartość, ale nie mniejszą niż Min i nie większą niż Max.',
    ins: [geP('v', 'Value', 'float', 0), geP('min', 'Min', 'float', 0), geP('max', 'Max', 'float', 1)], outs: [geP('out', 'Return Value', 'float')],
    expr: (c) => `Math.min(Math.max(${c.in('v')}, ${c.in('min')}), ${c.in('max')})` },
  { type: 'lerp', title: 'Lerp', pl: 'Interpolacja liniowa', cat: 'Matematyka', kind: 'pure',
    desc: 'Płynne przejście od A do B: Alpha 0 daje A, 1 daje B, 0.5 — środek. Alpha nie jest ograniczana, więc poza 0–1 wynik wychodzi poza A i B.',
    ins: [geP('a', 'A', 'float', 0), geP('b', 'B', 'float', 0), geP('alpha', 'Alpha', 'float', 0)], outs: [geP('out', 'Return Value', 'float')],
    expr: (c) => `((${c.in('a')}) + ((${c.in('b')}) - (${c.in('a')})) * (${c.in('alpha')}))` },
  { type: 'abs', title: 'Absolute (float)', pl: 'Wartość bezwzględna', cat: 'Matematyka', kind: 'pure', compact: 'ABS',
    ins: [geP('a', '', 'float', 0)], outs: [geP('out', '', 'float')], expr: (c) => `Math.abs(${c.in('a')})` },
  { type: 'round', title: 'Round', pl: 'Zaokrąglij', cat: 'Matematyka', kind: 'pure', compact: 'ROUND',
    ins: [geP('a', '', 'float', 0)], outs: [geP('out', '', 'int')], expr: (c) => `Math.round(${c.in('a')})` },
  // Kąty w stopniach, jak obrót aktora (0° — w prawo, 90° — w dół).
  { type: 'sin_deg', title: 'Sin (Degrees)', pl: 'Sinus', cat: 'Matematyka', kind: 'pure', compact: 'SIN',
    ins: [geP('a', '', 'float', 0)], outs: [geP('out', '', 'float')], expr: (c) => `Math.sin((${c.in('a')}) * Math.PI / 180)` },
  { type: 'cos_deg', title: 'Cos (Degrees)', pl: 'Cosinus', cat: 'Matematyka', kind: 'pure', compact: 'COS',
    ins: [geP('a', '', 'float', 0)], outs: [geP('out', '', 'float')], expr: (c) => `Math.cos((${c.in('a')}) * Math.PI / 180)` },
  { type: 'tan_deg', title: 'Tan (Degrees)', pl: 'Tangens', cat: 'Matematyka', kind: 'pure', compact: 'TAN',
    ins: [geP('a', '', 'float', 0)], outs: [geP('out', '', 'float')], expr: (c) => `Math.tan((${c.in('a')}) * Math.PI / 180)` },
  { type: 'asin_deg', title: 'Asin (Degrees)', pl: 'Arcus sinus', cat: 'Matematyka', kind: 'pure', compact: 'ASIN',
    desc: 'Kąt w stopniach, którego sinus to podana liczba (od −1 do 1).',
    ins: [geP('a', '', 'float', 0)], outs: [geP('out', '', 'float')], expr: (c) => `(Math.asin(Math.min(Math.max(${c.in('a')}, -1), 1)) * 180 / Math.PI)` },
  { type: 'acos_deg', title: 'Acos (Degrees)', pl: 'Arcus cosinus', cat: 'Matematyka', kind: 'pure', compact: 'ACOS',
    desc: 'Kąt w stopniach, którego cosinus to podana liczba (od −1 do 1). Z Dot Product dwóch wektorów o długości 1 daje kąt między nimi.',
    ins: [geP('a', '', 'float', 1)], outs: [geP('out', '', 'float')], expr: (c) => `(Math.acos(Math.min(Math.max(${c.in('a')}, -1), 1)) * 180 / Math.PI)` },
  { type: 'atan_deg', title: 'Atan (Degrees)', pl: 'Arcus tangens', cat: 'Matematyka', kind: 'pure', compact: 'ATAN',
    ins: [geP('a', '', 'float', 0)], outs: [geP('out', '', 'float')], expr: (c) => `(Math.atan(${c.in('a')}) * 180 / Math.PI)` },
  { type: 'atan2_deg', title: 'Atan2 (Degrees)', pl: 'Kąt z Y i X', cat: 'Matematyka', kind: 'pure',
    desc: 'Kąt w stopniach (od −180 do 180) kierunku o składowych X i Y. Z różnicy położeń daje obrót, o jaki obrócić aktora, by patrzył na cel.',
    ins: [geP('y', 'Y', 'float', 0), geP('x', 'X', 'float', 1)], outs: [geP('out', 'Return Value', 'float')],
    expr: (c) => `(Math.atan2(${c.in('y')}, ${c.in('x')}) * 180 / Math.PI)` },
  { type: 'game_time', title: 'Get Game Time in Seconds', pl: 'Czas gry', cat: 'Matematyka', kind: 'pure',
    desc: 'Ile sekund trwa gra (bez pauzy).', outs: [geP('out', 'Return Value', 'float')], expr: () => 'G.time' },

  // ---------- Logika ----------
  { type: 'gt', title: 'float > float', pl: 'Większe', cat: 'Logika', kind: 'pure', compact: '>',
    ins: [geP('a', '', 'float', 0), geP('b', '', 'float', 0)], outs: [geP('out', '', 'bool')], expr: (c) => `(${c.in('a')} > ${c.in('b')})` },
  { type: 'lt', title: 'float < float', pl: 'Mniejsze', cat: 'Logika', kind: 'pure', compact: '<',
    ins: [geP('a', '', 'float', 0), geP('b', '', 'float', 0)], outs: [geP('out', '', 'bool')], expr: (c) => `(${c.in('a')} < ${c.in('b')})` },
  { type: 'ge', title: 'float >= float', pl: 'Większe lub równe', cat: 'Logika', kind: 'pure', compact: '≥',
    ins: [geP('a', '', 'float', 0), geP('b', '', 'float', 0)], outs: [geP('out', '', 'bool')], expr: (c) => `(${c.in('a')} >= ${c.in('b')})` },
  { type: 'le', title: 'float <= float', pl: 'Mniejsze lub równe', cat: 'Logika', kind: 'pure', compact: '≤',
    ins: [geP('a', '', 'float', 0), geP('b', '', 'float', 0)], outs: [geP('out', '', 'bool')], expr: (c) => `(${c.in('a')} <= ${c.in('b')})` },
  { type: 'eq', title: 'Equal (float)', pl: 'Równe', cat: 'Logika', kind: 'pure', compact: '==',
    ins: [geP('a', '', 'float', 0), geP('b', '', 'float', 0)], outs: [geP('out', '', 'bool')], expr: (c) => `(${c.in('a')} === ${c.in('b')})` },
  { type: 'neq', title: 'Not Equal (float)', pl: 'Różne', cat: 'Logika', kind: 'pure', compact: '!=',
    ins: [geP('a', '', 'float', 0), geP('b', '', 'float', 0)], outs: [geP('out', '', 'bool')], expr: (c) => `(${c.in('a')} !== ${c.in('b')})` },
  { type: 'str_eq', title: 'Equal (String)', pl: 'Teksty równe', cat: 'Logika', kind: 'pure', compact: '==',
    ins: [geP('a', '', 'string', ''), geP('b', '', 'string', '')], outs: [geP('out', '', 'bool')], expr: (c) => `(${c.in('a')} === ${c.in('b')})` },
  { type: 'and', title: 'AND Boolean', pl: 'I', cat: 'Logika', kind: 'pure', compact: 'AND',
    ins: [geP('a', '', 'bool', false), geP('b', '', 'bool', false)], outs: [geP('out', '', 'bool')], expr: (c) => `(${c.in('a')} && ${c.in('b')})` },
  { type: 'or', title: 'OR Boolean', pl: 'LUB', cat: 'Logika', kind: 'pure', compact: 'OR',
    ins: [geP('a', '', 'bool', false), geP('b', '', 'bool', false)], outs: [geP('out', '', 'bool')], expr: (c) => `(${c.in('a')} || ${c.in('b')})` },
  { type: 'not', title: 'NOT Boolean', pl: 'NIE', cat: 'Logika', kind: 'pure', compact: 'NOT',
    ins: [geP('a', '', 'bool', false)], outs: [geP('out', '', 'bool')], expr: (c) => `!${c.in('a')}` },

  // ---------- Tekst ----------
  { type: 'append', title: 'Append', pl: 'Połącz teksty', cat: 'Tekst', kind: 'pure',
    desc: 'Skleja dwa teksty w jeden. Liczby same zamieniają się w tekst.',
    ins: [geP('a', 'A', 'string', 'Punkty: '), geP('b', 'B', 'string', '')], outs: [geP('out', 'Return Value', 'string')],
    expr: (c) => `(${c.in('a')} + ${c.in('b')})` },

  // ---------- Wektor ----------
  { type: 'make_vec', title: 'Make Vector', pl: 'Utwórz wektor', cat: 'Wektor', kind: 'pure',
    ins: [geP('x', 'X', 'float', 0), geP('y', 'Y', 'float', 0)], outs: [geP('out', 'Return Value', 'vector')],
    expr: (c) => `vec(${c.in('x')}, ${c.in('y')})` },
  { type: 'break_vec', title: 'Break Vector', pl: 'Rozbij wektor', cat: 'Wektor', kind: 'pure',
    ins: [geP('v', 'In Vec', 'vector', { x: 0, y: 0 })], outs: [geP('x', 'X', 'float'), geP('y', 'Y', 'float')],
    expr: (c, pin) => `${c.in('v')}.${pin}` },
  { type: 'vec_add', title: 'vector + vector', pl: 'Dodaj wektory', cat: 'Wektor', kind: 'pure', compact: '+',
    ins: [geP('a', '', 'vector', { x: 0, y: 0 }), geP('b', '', 'vector', { x: 0, y: 0 })], outs: [geP('out', '', 'vector')],
    expr: (c) => `${c.in('a')}.add(${c.in('b')})` },
  { type: 'vec_sub', title: 'vector - vector', pl: 'Odejmij wektory', cat: 'Wektor', kind: 'pure', compact: '−',
    ins: [geP('a', '', 'vector', { x: 0, y: 0 }), geP('b', '', 'vector', { x: 0, y: 0 })], outs: [geP('out', '', 'vector')],
    expr: (c) => `${c.in('a')}.sub(${c.in('b')})` },
  { type: 'vec_scale', title: 'vector * float', pl: 'Pomnóż wektor', cat: 'Wektor', kind: 'pure', compact: '×',
    ins: [geP('a', '', 'vector', { x: 1, y: 0 }), geP('b', '', 'float', 1)], outs: [geP('out', '', 'vector')],
    expr: (c) => `${c.in('a')}.scale(${c.in('b')})` },
  { type: 'vec_lerp', title: 'Lerp (Vector)', pl: 'Interpolacja liniowa wektorów', cat: 'Wektor', kind: 'pure',
    desc: 'Płynne przejście od wektora A do B (osobno X i Y): Alpha 0 daje A, 1 daje B, 0.5 — środek. Alpha nie jest ograniczana, więc poza 0–1 wynik wychodzi poza A i B.',
    ins: [geP('a', 'A', 'vector', { x: 0, y: 0 }), geP('b', 'B', 'vector', { x: 0, y: 0 }), geP('alpha', 'Alpha', 'float', 0)], outs: [geP('out', 'Return Value', 'vector')],
    expr: (c) => `${c.in('a')}.add(${c.in('b')}.sub(${c.in('a')}).scale(${c.in('alpha')}))` },
  { type: 'vec_len', title: 'Vector Length', pl: 'Długość wektora', cat: 'Wektor', kind: 'pure', compact: 'LEN',
    ins: [geP('a', '', 'vector', { x: 0, y: 0 })], outs: [geP('out', '', 'float')], expr: (c) => `${c.in('a')}.length()` },
  { type: 'vec_len_sq', title: 'Vector Length Squared', pl: 'Kwadrat długości wektora', cat: 'Wektor', kind: 'pure', compact: 'LEN²',
    desc: 'Długość wektora do kwadratu (X·X + Y·Y). Szybsza od Vector Length — wystarczy do porównywania odległości.',
    ins: [geP('a', '', 'vector', { x: 0, y: 0 })], outs: [geP('out', '', 'float')], expr: (c) => `${c.in('a')}.lengthSquared()` },
  { type: 'vec_dot', title: 'Dot Product', pl: 'Iloczyn skalarny', cat: 'Wektor', kind: 'pure', compact: '·',
    desc: 'A.X·B.X + A.Y·B.Y. Dla wektorów o długości 1: 1 — ten sam kierunek, 0 — prostopadłe, −1 — przeciwne.',
    ins: [geP('a', 'A', 'vector', { x: 1, y: 0 }), geP('b', 'B', 'vector', { x: 1, y: 0 })], outs: [geP('out', 'Return Value', 'float')],
    expr: (c) => `${c.in('a')}.dot(${c.in('b')})` },
  { type: 'vec_norm', title: 'Normalize', pl: 'Kierunek wektora', cat: 'Wektor', kind: 'pure', compact: 'NORM',
    ins: [geP('a', '', 'vector', { x: 1, y: 0 })], outs: [geP('out', '', 'vector')], expr: (c) => `${c.in('a')}.normalize()` },

  // ---------- Gra ----------
  { type: 'print', title: 'Print String', pl: 'Wypisz tekst', cat: 'Gra', kind: 'exec',
    desc: 'Wyświetla tekst w lewym górnym rogu gry i w Dzienniku — najlepszy sposób, żeby sprawdzić, co się dzieje.',
    ins: [geX(), geP('text', 'In String', 'string', 'Hello')], outs: [geX('then')],
    stmt: (c) => `G.print(${c.in('text')});` },
  { type: 'hud', title: 'Set HUD Text', pl: 'Ustaw napis HUD', cat: 'Gra', kind: 'exec',
    desc: 'Pokazuje stały napis u góry ekranu (np. punkty). Ten sam Slot nadpisuje poprzedni napis, pusty tekst go chowa.',
    ins: [geX(), geP('slot', 'Slot', 'string', 'wynik'), geP('text', 'Text', 'string', 'Punkty: 0')], outs: [geX('then')],
    stmt: (c) => `G.setHud(${c.in('slot')}, ${c.in('text')});` },
  { type: 'message', title: 'Show Message', pl: 'Napis na środku', cat: 'Gra', kind: 'exec',
    desc: 'Duży napis na środku ekranu, np. „WYGRANA!”. Pusty tekst go chowa.',
    ins: [geX(), geP('text', 'Text', 'string', 'WYGRANA!')], outs: [geX('then')],
    stmt: (c) => `G.showMessage(${c.in('text')});` },
  // Stare „zmienne gry” po nazwie (nie ma ich w Unreal Engine) — ukryte, zostają dla starszych projektów, w których
  // do pinu Name prowadzi kabel. Pozostałe przy wczytaniu stają się zmiennymi Game Instance albo GameMode (geMigrateProject).
  { type: 'get_gvar', title: 'Get Game Variable', pl: 'Pobierz zmienną gry', cat: 'Gra', kind: 'pure', hidden: true, legacy: true,
    desc: 'Liczba wspólna dla całej gry (np. punkty). Każdy Blueprint widzi tę samą wartość.',
    ins: [geP('name', 'Name', 'string', 'Punkty')], outs: [geP('out', 'Value', 'float')], expr: (c) => `G.getVar(${c.in('name')})` },
  { type: 'set_gvar', title: 'Set Game Variable', pl: 'Ustaw zmienną gry', cat: 'Gra', kind: 'exec', hidden: true, legacy: true,
    desc: 'Zapisuje liczbę wspólną dla całej gry.',
    ins: [geX(), geP('name', 'Name', 'string', 'Punkty'), geP('value', 'Value', 'float', 0)], outs: [geX('then')],
    stmt: (c) => `G.setVar(${c.in('name')}, ${c.in('value')});` },
  { type: 'add_gvar', title: 'Add to Game Variable', pl: 'Dodaj do zmiennej gry', cat: 'Gra', kind: 'exec', hidden: true, legacy: true,
    desc: 'Zwiększa liczbę wspólną dla całej gry (np. punkty o 1).',
    ins: [geX(), geP('name', 'Name', 'string', 'Punkty'), geP('amount', 'Amount', 'float', 1)], outs: [geX('then')],
    stmt: (c) => `G.addVar(${c.in('name')}, ${c.in('amount')});` },
  { type: 'spawn', title: 'Spawn Actor from Class', pl: 'Stwórz aktora', cat: 'Gra', kind: 'exec',
    desc: 'Tworzy nowego aktora wybranej klasy w podanym miejscu. Return Value to nowy aktor.',
    props: [{ id: 'cls', name: 'Klasa', kind: 'class' }],
    ins: [geX(), geP('loc', 'Location', 'vector', { x: 0, y: 0 })], outs: [geX('then'), geP('actor', 'Return Value', 'actor', null, { local: 'spawned' })],
    stmt: (c) => `${c.local('actor')} = G.spawn(${c.cls('cls')}, ${c.in('loc')});` },
  { type: 'find_actor', title: 'Get Actor Of Class', pl: 'Znajdź aktora klasy', cat: 'Gra', kind: 'pure',
    desc: 'Pierwszy aktor wybranej klasy w grze (albo pusty, gdy go nie ma).',
    props: [{ id: 'cls', name: 'Klasa', kind: 'class' }], outs: [geP('out', 'Return Value', 'actor')], expr: (c) => `G.findActor(${c.cls('cls')})` },
  { type: 'get_all_actors', title: 'Get All Actors Of Class', pl: 'Wszyscy aktorzy klasy (np. policz je węzłem Length)', cat: 'Gra', kind: 'exec',
    desc: 'Tablica wszystkich aktorów wybranej klasy, którzy są teraz w grze. Ilu ich jest — węzeł Length.',
    props: [{ id: 'cls', name: 'Klasa', kind: 'class' }],
    ins: [geX()], outs: [geX('then'), geP('actors', 'Out Actors', 'actors', null, { local: 'all' })],
    stmt: (c) => `${c.local('actors')} = G.allOf(${c.cls('cls')});` },
  // Stary węzeł (nie ma go w Unreal Engine: tam Get All Actors Of Class + Length) — ukryty, dla starszych projektów.
  { type: 'count_class', title: 'Count Actors Of Class', pl: 'Policz aktorów klasy', cat: 'Gra', kind: 'pure', hidden: true, legacy: true,
    desc: 'Ilu aktorów wybranej klasy jest teraz w grze.',
    props: [{ id: 'cls', name: 'Klasa', kind: 'class' }], outs: [geP('out', 'Count', 'int')], expr: (c) => `G.countOf(${c.cls('cls')})` },
  { type: 'get_pawn', title: 'Get Player Pawn', pl: 'Postać gracza', cat: 'Gra', kind: 'pure',
    desc: 'Aktor gracza — Default Pawn z Ustawień świata (albo pusty, gdy go nie ma).',
    outs: [geP('out', 'Return Value', 'actor')], expr: () => 'G.getPlayerPawn()' },
  { type: 'get_gamemode', title: 'Get Game Mode', pl: 'Tryb gry (GameMode)', cat: 'Gra', kind: 'pure',
    desc: 'Aktor GameMode z Ustawień świata (albo pusty, gdy go nie ustawiono).',
    outs: [geP('out', 'Return Value', 'actor')], expr: () => 'G.getGameMode()' },
  { type: 'get_game_instance', title: 'Get Game Instance', pl: 'Game Instance (zmienne na całą grę)', cat: 'Gra', kind: 'pure',
    desc: 'Obiekt Game Instance z Ustawień świata: powstaje raz na całą grę i przetrwa Open Level, więc jego zmienne (np. punkty) przechodzą na kolejne poziomy.',
    outs: [geP('out', 'Return Value', 'actor')], expr: () => 'G.getGameInstance()' },
  { type: 'get_controller', title: 'Get Player Controller', pl: 'Kontroler gracza', cat: 'Gra', kind: 'pure',
    desc: 'Aktor Player Controller z Ustawień świata (albo pusty, gdy go nie ustawiono).',
    outs: [geP('out', 'Return Value', 'actor')], expr: () => 'G.getPlayerController()' },
  { type: 'get_hud', title: 'Get HUD Widget', pl: 'Widget HUD', cat: 'Gra', kind: 'pure',
    desc: 'Widget HUD z Ustawień świata (albo pusty, gdy go nie ustawiono).',
    outs: [geP('out', 'Return Value', 'actor')], expr: () => 'G.getHudWidget()' },
  { type: 'sound', title: 'Play Sound 2D', pl: 'Zagraj dźwięk', cat: 'Gra', kind: 'exec',
    desc: 'Odtwarza dźwięk: wbudowany albo zasób Dźwięk z Przeglądarki zawartości (np. zaimportowany plik MP3).',
    props: [{ id: 'sound', name: 'Dźwięk', kind: 'sound', def: 'coin' }],
    check: (n, bp, project) => (geSoundExists(project, n.props?.sound ?? 'coin') ? null : 'Wybrany dźwięk został usunięty — wybierz inny.'),
    ins: [geX()], outs: [geX('then')], stmt: (c) => `G.playSound(${JSON.stringify(String(c.prop('sound')))});` },
  { type: 'camera', title: 'Set View Target with Blend', pl: 'Kamera śledzi', cat: 'Gra', kind: 'exec',
    desc: 'Kamera będzie podążać za wybranym aktorem.', ins: [geX(), geSelf()], outs: [geX('then')],
    stmt: (c) => `G.cameraFollow(${c.in('target')});` },
  { type: 'pause', title: 'Set Game Paused', pl: 'Pauza', cat: 'Gra', kind: 'exec',
    desc: 'Zatrzymuje albo wznawia grę. Klawisze i kliknięcia działają dalej.',
    ins: [geX(), geP('paused', 'Paused', 'bool', true)], outs: [geX('then')], stmt: (c) => `G.setPaused(${c.in('paused')});` },
  // Stary węzeł (nie ma go w Unreal Engine: tam Open Level + Get Current Level Name) — ukryty, dla starszych projektów.
  { type: 'restart', title: 'Restart Level', pl: 'Zacznij od nowa', cat: 'Gra', kind: 'exec', hidden: true, legacy: true,
    desc: 'Uruchamia poziom od początku.', ins: [geX()], outs: [geX('then')], stmt: () => 'G.restart();' },
  { type: 'open_level', title: 'Open Level (by Name)', pl: 'Przejdź na poziom', cat: 'Gra', kind: 'exec',
    desc: 'Kończy obecny poziom i uruchamia poziom o podanej nazwie (lista poziomów: przycisk 🗺️ na pasku poziomu). Game Instance (z jego zmiennymi) i Bazy danych zostają, a aktorzy i GameMode powstają od nowa — jak przy starcie poziomu. Ten sam poziom od nowa: Level Name z Get Current Level Name.',
    check: (n, bp, project) => {
      if (geNodeWired(bp, n.id, 'level')) return null;
      const name = String(n.values?.level ?? 'Poziom2');
      return geLevels(project).some((l) => l.name === name) ? null : `Nie ma poziomu „${name}” — wpisz nazwę z listy poziomów (🗺️ na pasku poziomu).`;
    },
    ins: [geX(), geP('level', 'Level Name', 'string', 'Poziom2')], outs: [geX('then')], stmt: (c) => `G.openLevel(${c.in('level')});` },
  { type: 'level_name', title: 'Get Current Level Name', pl: 'Nazwa poziomu', cat: 'Gra', kind: 'pure',
    desc: 'Nazwa poziomu, który właśnie trwa (np. do napisu w HUD albo do wyboru następnego poziomu).',
    outs: [geP('out', 'Return Value', 'string')], expr: () => 'G.getLevelName()' },

  // ---------- Tablice ----------
  { type: 'array_length', title: 'Length', pl: 'Długość tablicy (ile elementów)', cat: 'Tablice', kind: 'pure', compact: 'LENGTH',
    desc: 'Liczba elementów tablicy.',
    pins: (n) => ({ ins: [geP('array', '', geArrayNodeType(n), null)], outs: [geP('out', '', 'int')] }), expr: (c) => `(${c.in('array')} ?? []).length` },
  { type: 'array_get', title: 'Get (a copy)', pl: 'Element tablicy o numerze', cat: 'Tablice', kind: 'pure', compact: 'GET',
    desc: 'Element tablicy o podanym numerze (od 0) albo pusty, gdy takiego nie ma.',
    pins: (n) => ({ ins: [geP('array', '', geArrayNodeType(n), null), geP('index', '', 'int', 0)], outs: [geP('out', '', geArrayElem(n))] }),
    expr: (c) => `((${c.in('array')} ?? [])[${c.in('index')}] ?? ${geLiteral(geVarDefault(geArrayElem(c.node)), { type: geArrayElem(c.node) })})` },

  // ---------- Interfejs użytkownika (Widget Blueprinty) ----------
  { type: 'create_widget', title: 'Create Widget', pl: 'Utwórz widget', cat: 'Interfejs (UI)', kind: 'exec',
    desc: 'Tworzy widget wybranej klasy Widget Blueprint. Żeby go zobaczyć, podłącz dalej „Add to Viewport”.',
    props: [{ id: 'cls', name: 'Klasa', kind: 'widget-class' }],
    ins: [geX()], outs: [geX('then'), geP('widget', 'Return Value', 'actor', null, { local: 'widget' })],
    stmt: (c) => `${c.local('widget')} = G.createWidget(${c.cls('cls', 'widget')});` },
  { type: 'add_viewport', title: 'Add to Viewport', pl: 'Pokaż widget na ekranie', cat: 'Interfejs (UI)', kind: 'exec',
    desc: 'Pokazuje widget na ekranie gry, nad wszystkimi aktorami.',
    ins: [geX(), geSelf()], outs: [geX('then')], stmt: (c) => `${c.in('target')}.addToViewport();` },
  { type: 'remove_widget', title: 'Remove from Parent', pl: 'Schowaj widget', cat: 'Interfejs (UI)', kind: 'exec',
    desc: 'Zdejmuje widget z ekranu (można go potem znowu pokazać przez „Add to Viewport”).',
    ins: [geX(), geSelf()], outs: [geX('then')], stmt: (c) => `${c.in('target')}.removeFromParent();` },
  { type: 'set_widget_text', title: 'Set Text (Widget)', pl: 'Ustaw tekst elementu', cat: 'Interfejs (UI)', kind: 'exec',
    desc: 'Zmienia napis elementu widgetu (tekstu albo przycisku) o podanej nazwie z Projektanta.',
    ins: [geX(), geSelf(), geP('name', 'Element', 'string', 'Tekst1'), geP('text', 'In Text', 'string', 'Punkty: 0')], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.setWidgetText(${c.in('name')}, ${c.in('text')});` },
  { type: 'set_widget_visible', title: 'Set Visibility (Widget)', pl: 'Pokaż / ukryj element', cat: 'Interfejs (UI)', kind: 'exec',
    desc: 'Pokazuje albo ukrywa element widgetu o podanej nazwie.',
    ins: [geX(), geSelf(), geP('name', 'Element', 'string', 'Tekst1'), geP('visible', 'Visible', 'bool', true)], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.setWidgetVisible(${c.in('name')}, ${c.in('visible')});` },
  // Menu węzłów podaje gotowe „Get <nazwa>” dla każdego zagnieżdżonego widgetu z Projektanta.
  { type: 'child_widget', title: (n) => `Get ${n.props?.el || 'Widget'}`, pl: 'Zagnieżdżony widget', cat: 'Interfejs (UI)', kind: 'pure', widgetOnly: true, hidden: true,
    desc: 'Zwraca widget zagnieżdżony w tym widgecie (element „Widget” z Projektanta). Podłącz go jako Target do „Set Text (Widget)”, „Set Visibility (Widget)” albo „Call Custom Event”.',
    props: [{ id: 'el', name: 'Widget', kind: 'widget-child', def: '' }],
    outs: [geP('out', 'Widget', 'actor')],
    check: (n, bp) => (bp.widget?.elements.some((el) => el.type === 'widget' && el.name === n.props?.el) ? null : 'Wybierz zagnieżdżony widget w tym węźle (albo został usunięty z Projektanta).'),
    expr: (c) => `this.childWidget(${JSON.stringify(String(c.prop('el') ?? ''))})` },

  // ---------- Blueprint Interface ----------
  { type: 'ev_interface', title: (n) => `Event ${geIfaceFnName(n.props?.fn)}`, pl: 'Zdarzenie funkcji interfejsu', cat: 'Interfejsy', kind: 'event', classOnly: true,
    desc: 'Uruchamia się, gdy ktoś wywoła tę funkcję interfejsu u tego aktora. Klasa musi implementować interfejs (Ustawienia klasy › Interfejsy).',
    props: [{ id: 'fn', name: 'Funkcja', kind: 'iface-fn-own' }],
    outs: [geX('then')],
    methods: (n) => [{ pin: 'then', name: geIfaceMethod(n.props?.fn), params: '' }],
    check: (n, bp, project) => {
      const f = geIfaceFn(project, n.props?.fn);
      if (!f) return 'Wybierz funkcję interfejsu w tym węźle.';
      return geClassInterfaces(project, bp).includes(f.iface.id) ? null : `Ta klasa nie implementuje ${f.iface.name} — zaznacz go w Ustawieniach klasy › Interfejsy.`;
    } },
  { type: 'call_interface', title: (n) => `${geIfaceFnName(n.props?.fn)} (Message)`, pl: 'Wywołaj funkcję interfejsu', cat: 'Interfejsy', kind: 'exec',
    desc: 'Wywołuje funkcję Blueprint Interface u wybranego aktora. Jeśli aktor jej nie implementuje, nic się nie dzieje.',
    props: [{ id: 'fn', name: 'Funkcja', kind: 'iface-fn' }],
    ins: [geX(), geSelf()], outs: [geX('then')],
    check: (n, bp, project) => (geIfaceFn(project, n.props?.fn) ? null : 'Wybierz funkcję interfejsu w tym węźle.'),
    stmt: (c) => `G.callInterface(${c.in('target')}, '${geIfaceMethod(c.prop('fn'))}');` },
  { type: 'does_implement', title: 'Does Implement Interface', pl: 'Czy implementuje interfejs', cat: 'Interfejsy', kind: 'pure',
    desc: 'Prawda, jeśli klasa aktora implementuje wybrany Blueprint Interface.',
    props: [{ id: 'iface', name: 'Interfejs', kind: 'iface' }],
    ins: [geP('actor', 'Test Object', 'actor', null)], outs: [geP('out', 'Return Value', 'bool')],
    check: (n, bp, project) => (project.blueprints.some((b) => b.id === n.props?.iface && geKind(b) === 'interface') ? null : 'Wybierz Blueprint Interface w tym węźle.'),
    expr: (c) => `G.implements(${c.in('actor')}, ${JSON.stringify(String(c.prop('iface') ?? ''))})` },

  // ---------- Funkcje (piny zależą od wejść i wyjść funkcji z Mój Blueprint) ----------
  { type: 'fn_entry', title: geFnTitle, pl: 'Wejście funkcji', cat: 'Funkcje', kind: 'event', hidden: true,
    desc: 'Początek funkcji. Piny po prawej to jej wejścia (parametry) — dodasz je w Szczegółach funkcji.',
    check: geFnCheck,
    pins: (n, bp) => ({ ins: [], outs: [geX('then'), ...(geFnOf(n, bp)?.inputs ?? []).map((p) => geP(p.id, p.name, p.type, null, { expr: p.name }))] }),
    methods: (n, bp) => {
      const fn = geFnOf(n, bp);
      return fn ? [{ pin: 'then', name: geFnMethod(fn), params: fn.inputs.map((p) => p.name).join(', ') }] : [];
    } },
  { type: 'fn_return', title: 'Return Node', pl: 'Zakończ funkcję', cat: 'Funkcje', kind: 'flow', hidden: true,
    desc: 'Kończy funkcję i oddaje wyniki (piny po lewej) węzłowi, który ją wywołał.',
    check: geFnCheck,
    pins: (n, bp) => ({ ins: [geX(), ...(geFnOf(n, bp)?.outputs ?? []).map((p) => geP(p.id, p.name, p.type, geVarDefault(p.type)))], outs: [] }),
    gen: (c) => {
      const fn = c.fn();
      return fn?.outputs.length ? `return { ${fn.outputs.map((o) => `${o.name}: ${c.in(o.id)}`).join(', ')} };` : 'return;';
    } },
  { type: 'call_fn', title: geFnTitle, pl: 'Wywołaj funkcję', cat: 'Funkcje', kind: 'exec', hidden: true,
    desc: 'Uruchamia Twoją funkcję z panelu Mój Blueprint › Funkcje i podaje dalej jej wyniki. Funkcję innej klasy wywołuje u obiektu z pinu Target.',
    check: (n, bp) => geFnCheck(n, bp) ?? geVarTargetCheck(n, bp),
    pins: (n, bp) => {
      const fn = geFnOf(n, bp);
      return {
        ins: [geX(), ...(n.props?.cls ? [geVarTarget(n)] : []), ...(fn?.inputs ?? []).map((p) => geP(p.id, p.name, p.type, geVarDefault(p.type)))],
        outs: [geX('then'), ...(fn?.outputs ?? []).map((p) => geP(p.id, p.name, p.type, null, { local: `out_${p.id}_` }))]
      };
    },
    stmt: (c) => {
      const fn = c.fn();
      if (!fn) return '';
      const call = `${geVarHolder(c)}.${geFnMethod(fn)}(${fn.inputs.map((p) => c.in(p.id)).join(', ')})`;
      return fn.outputs.length ? `({ ${fn.outputs.map((o) => `${o.name}: ${c.local(o.id)}`).join(', ')} } = ${call});` : `${call};`;
    } },

  // ---------- Event Dispatchers (piny parametrów zależą od dispatchera z Mój Blueprint) ----------
  { type: 'dispatch_call', title: (n, bp) => `Call ${geDispName(n, bp)}`, pl: 'Wywołaj Event Dispatcher', cat: 'Event Dispatchers', kind: 'exec', hidden: true,
    desc: 'Uruchamia wszystkie zdarzenia podpięte do dispatchera (węzłem Bind Event) i podaje im parametry. Bez podpiętych zdarzeń nic się nie dzieje.',
    check: geDispCheck,
    pins: (n, bp) => ({ ins: [geX(), geDispTarget(n), ...(geDispOf(n, bp)?.inputs ?? []).map((p) => geP(p.id, p.name, p.type, geVarDefault(p.type)))], outs: [geX('then')] }),
    stmt: (c) => `${c.in('target')}.dispatch(${[c.disp(), ...c.pins.ins.slice(2).map((p) => c.in(p.id))].join(', ')});` },
  { type: 'dispatch_bind', title: (n, bp) => `Bind Event to ${geDispName(n, bp)}`, pl: 'Podepnij zdarzenie do Event Dispatchera', cat: 'Event Dispatchers', kind: 'exec', hidden: true,
    desc: 'Podpina zdarzenie własne (pin Event ← czerwony kwadrat Delegate z Custom Event) do dispatchera. Od teraz każde Call uruchomi też to zdarzenie.',
    check: geDispBindCheck,
    pins: (n) => ({ ins: [geX(), geDispTarget(n), geP('event', 'Event', 'delegate', null)], outs: [geX('then')] }),
    stmt: (c) => `${c.in('target')}.bindEvent(${c.disp()}, ${c.in('event')});` },
  { type: 'dispatch_unbind', title: (n, bp) => `Unbind Event from ${geDispName(n, bp)}`, pl: 'Odepnij zdarzenie od Event Dispatchera', cat: 'Event Dispatchers', kind: 'exec', hidden: true,
    desc: 'Odpina zdarzenie własne (pin Event) od dispatchera — kolejne Call już go nie uruchomią.',
    check: geDispBindCheck,
    pins: (n) => ({ ins: [geX(), geDispTarget(n), geP('event', 'Event', 'delegate', null)], outs: [geX('then')] }),
    stmt: (c) => `${c.in('target')}.unbindEvent(${c.disp()}, ${c.in('event')});` },
  { type: 'dispatch_unbind_all', title: (n, bp) => `Unbind all Events from ${geDispName(n, bp)}`, pl: 'Odepnij wszystkie zdarzenia od Event Dispatchera', cat: 'Event Dispatchers', kind: 'exec', hidden: true,
    desc: 'Odpina od dispatchera wszystkie podpięte zdarzenia.',
    check: geDispCheck,
    pins: (n) => ({ ins: [geX(), geDispTarget(n)], outs: [geX('then')] }),
    stmt: (c) => `${c.in('target')}.unbindAllEvents(${c.disp()});` },

  // ---------- Zmienne (piny zależą od typu zmiennej) ----------
  // props.cls — zmienna innej klasy (np. Game Instance albo GameMode): węzeł dostaje pin Target z obiektem tej klasy.
  { type: 'var_get', title: (n, bp) => geVarOf(n, bp)?.name ?? '(deleted variable)', pl: 'Pobierz zmienną', cat: 'Zmienne', kind: 'pure', hidden: true,
    check: geVarTargetCheck,
    pins: (n, bp) => ({ ins: n.props?.cls ? [geVarTarget(n)] : [], outs: [geP('out', '', geVarOf(n, bp)?.type ?? 'float')] }),
    expr: (c) => `${geVarHolder(c)}.vars.${c.v()}` },
  { type: 'var_set', title: (n, bp) => `Set ${geVarOf(n, bp)?.name ?? '(deleted variable)'}`, pl: 'Ustaw zmienną', cat: 'Zmienne', kind: 'exec', hidden: true,
    check: geVarTargetCheck,
    pins: (n, bp) => {
      const type = geVarOf(n, bp)?.type ?? 'float';
      return {
        ins: [geX(), ...(n.props?.cls ? [geVarTarget(n)] : []), geP('value', '', type, geVarDefault(type))],
        outs: [geX('then'), geP('out', '', type, null, { expr: (c) => `${geVarHolder(c)}.vars.${c.v()}` })]
      };
    },
    stmt: (c) => `${geVarHolder(c)}.vars.${c.v()} = ${c.in('value')};` },

  // ---------- Węzeł pomocniczy (Reroute) — tylko porządkuje kable, przekazuje dalej to, co dostał ----------
  { type: 'reroute', title: 'Reroute Node', pl: 'Węzeł pomocniczy', cat: 'Sterowanie', kind: 'reroute', hidden: true,
    desc: 'Punkt na kablu, przez który można go poprowadzić czytelniej. Niczego nie zmienia.',
    pins: (n) => {
      const type = n.props?.type ?? 'float';
      return type === 'exec' ? { ins: [geX()], outs: [geX('then')] } : { ins: [geP('in', '', type, null)], outs: [geP('out', '', type)] };
    },
    gen: (c) => c.exec('then'),
    expr: (c) => c.in('in') }
];

const GE_NODES = Object.fromEntries(GE_NODE_LIST.map((def) => [def.type, def]));
// Węzły, które mają sens dopiero w trakcie gry, więc nie ma ich w Construction Script (jak w Unreal Engine).
const GE_NO_CONSTRUCTION = new Set(['delay', 'set_timer', 'clear_timer', 'timeline', ...GE_TL_FUNCS.map(([type]) => type), 'move_input', 'jump', 'launch', 'camera', 'pause', 'restart', 'open_level', 'sound', 'create_widget', 'add_viewport', 'remove_widget',
  'input_value', 'add_mapping_context', 'remove_mapping_context', 'has_mapping_context', 'clear_mappings',
  'set_show_cursor', 'set_click_events', 'set_mouse_over_events', 'set_cursor_type', 'input_mode_game', 'input_mode_ui', 'input_mode_game_ui']);
// Funkcja kończy się od razu, więc nie może czekać (jak w Unreal Engine: brak węzłów „latent”).
const GE_NO_FUNCTION = new Set(['delay', 'timeline']);
// Węzły początkowe grafów — w swoim grafie są zawsze dokładnie raz, nie da się ich usunąć ani skopiować.
const GE_FIXED_NODES = new Set(['ev_construction', 'fn_entry']);
const GE_CATS = ['Zdarzenia', 'Sterowanie', 'Timeline', 'Funkcje', 'Event Dispatchers', 'Aktor', 'Komponenty', 'Ruch i fizyka', 'Wejście', 'Gra', 'Interfejs (UI)', 'Interfejsy', 'Matematyka', 'Logika', 'Tekst', 'Wektor', 'Tablice', 'Zmienne'];

function geKeyLabel(key) {
  return { Space: 'Space Bar', Left: 'Left', Right: 'Right', Up: 'Up', Down: 'Down', Enter: 'Enter', Shift: 'Left Shift', Ctrl: 'Left Ctrl' }[key]
    ?? String(key).replace(/([a-z])([A-Z])/g, '$1 $2');
}

// Klasa, w której szukamy zmiennej węzła: inna klasa (props.cls) albo ta, w której jest węzeł.
const geVarClass = (project, node, bp) => (node.props?.cls ? project?.blueprints.find((b) => b.id === node.props.cls) ?? null : bp);

function geVarOf(node, bp) {
  const project = geProj();
  return geChainEntry(project, geVarClass(project, node, bp), 'variables', node.props?.var)?.item ?? null;
}


function gePins(node, bp) {
  const def = GE_NODES[node.type];
  if (!def) return { ins: [], outs: [] };
  if (def.pins) return def.pins(node, bp);
  return { ins: def.ins ?? [], outs: def.outs ?? [] };
}

function geNodeTitle(node, bp) {
  const def = GE_NODES[node.type];
  if (!def) return node.type;
  return typeof def.title === 'function' ? def.title(node, bp) : def.title;
}

function geEventMethods(node, bp) {
  const def = GE_NODES[node.type];
  if (def.methods) return def.methods(node, bp);
  return [{ pin: 'then', name: def.method, params: def.params ?? '' }];
}

// Czy wyjście typu „from” można podłączyć do wejścia typu „to”. Liczby i teksty zamieniają się same.
function geCanConnect(from, to) {
  if (from === 'exec' || to === 'exec' || from === 'delegate' || to === 'delegate') return from === to;
  if (from === to || to === 'string') return true;
  // Obiekt klasy TypeScript pasuje też tam, gdzie czeka obiekt jej klasy bazowej TypeScript.
  if (/^ts:/.test(from) && /^ts:/.test(to)) {
    const project = geProj();
    return !!project && geTsChain(project, geAsset(project, from.slice(3), 'tsclass')).some((c) => c.id === to.slice(3));
  }
  // Enumeracja do pinu liczby daje numer wartości (jak Enum → Byte w Unreal Engine).
  if (/^enum:/.test(from) && (to === 'int' || to === 'float')) return true;
  return (from === 'int' && to === 'float') || (from === 'float' && to === 'int');
}

function geLiteral(value, pin) {
  const c = geContainer(pin.type);
  if (c.container !== 'single') {
    const items = Array.isArray(value) ? value : [];
    const lit = (v, type) => geLiteral(v, { type });
    if (c.container === 'map') return `new Map([${items.map((pair) => `[${lit(pair?.[0], c.elem)}, ${lit(pair?.[1], c.value)}]`).join(', ')}])`;
    const list = `[${items.map((v) => lit(v, c.elem)).join(', ')}]`;
    return c.container === 'set' ? `new Set(${list})` : list;
  }
  switch (pin.type) {
    case 'bool': return value ? 'true' : 'false';
    case 'int': return String(Math.trunc(Number(value) || 0));
    case 'float': return String(Number(value) || 0);
    case 'string': return JSON.stringify(String(value ?? ''));
    case 'vector': return `vec(${Number(value?.x) || 0}, ${Number(value?.y) || 0})`;
    case 'actor': return pin.self ? 'this' : 'null';
    case 'delegate': return 'null';
    default: return pin.self ? 'this' : geDataLiteral(value, pin.type);
  }
}

// Wyrażenie, które zamienia wartość zmiennej Instance Editable zapisaną w aktorze (JSON z projektu) na wartość
// w grze: wektor na vec(), Set i Map na new Set() / new Map(), pola Struktury po nazwach. Aktor to w projekcie
// jego id — game.levelActor() zamienia je na aktora, gdy cały poziom już powstanie.
function geInstValue(expr, type, depth = 0) {
  const c = geContainer(type);
  if (c.container !== 'single') {
    const x = 'x' + depth;
    const list = `(Array.isArray(${expr}) ? ${expr} : [])`;
    if (c.container === 'map') return `new Map(${list}.map((${x}) => [${geInstValue(`${x}?.[0]`, c.elem, depth + 1)}, ${geInstValue(`${x}?.[1]`, c.value, depth + 1)}]))`;
    const items = `${list}.map((${x}) => ${geInstValue(x, c.elem, depth + 1)})`;
    return c.container === 'set' ? `new Set(${items})` : items;
  }
  switch (type) {
    case 'bool': return `Boolean(${expr})`;
    case 'int': return `Math.trunc(Number(${expr}) || 0)`;
    case 'float': return `(Number(${expr}) || 0)`;
    case 'string': return `String(${expr} ?? '')`;
    case 'vector': return `vec(Number(${expr}?.x) || 0, Number(${expr}?.y) || 0)`;
    case 'actor': return `game.levelActor(${expr})`;
  }
  const ref = geTypeRef(type);
  if (ref?.prefix === 'enum') return geEnumInstValue(expr, type);
  if (ref?.prefix !== 'struct' || depth > 8) return 'null';
  const fields = ref.bp?.struct.fields ?? [];
  // W nawiasach, bo stoi też jako wynik funkcji strzałkowej w .map().
  return `({ ${fields.map((f) => {
    const field = `${expr}?.[${JSON.stringify(f.id)}]`;
    const def = geTypeRef(f.type) ? geDataLiteral(f.value, f.type) : geLiteral(f.value, { type: f.type });
    return `${geFieldKey(f)}: ${field} !== undefined ? ${geInstValue(field, f.type, depth + 1)} : ${def}`;
  }).join(', ')} })`;
}

function geConvert(expr, from, to) {
  if (from === to) return expr;
  if (to === 'string' && /^struct:/.test(from)) return `JSON.stringify(${expr})`;
  if (to === 'string' && /^(set|map):/.test(from)) return `JSON.stringify([...${expr}])`;
  if (to === 'string' && from !== 'actors' && geContainer(from).container === 'array') return `JSON.stringify(${expr})`;
  if (to === 'string') return `String(${expr})`;
  if (from === 'float' && to === 'int') return `Math.trunc(${expr})`;
  if (/^enum:/.test(from) && (to === 'int' || to === 'float')) return `Math.max(0, ENUM.${from.slice(5)}.indexOf(${expr}))`;
  return expr;
}

const GE_RESERVED = new Set(['Actor', 'Widget', 'AnimInstance', 'G', 'vec', 'Vec', 'runtime', 'Math', 'String', 'Number', 'Object', 'Array', 'Map', 'Set', 'JSON', 'Date', 'window', 'document', 'console', 'Infinity', 'NaN', 'undefined']);

// Nazwy klas i zmiennych w wygenerowanym kodzie (unikalne, bez polskich znaków).
function geNames(project) {
  const classes = new Map([['level', 'LevelBlueprint']]);
  const used = new Set([...GE_RESERVED, 'LevelBlueprint', ...geTsClasses(project).map((e) => e.name)]);
  geCodeBlueprints(project).slice(1).forEach((bp) => {
    let name = GE_RT.ident(bp.name);
    while (used.has(name)) name += '_';
    used.add(name);
    classes.set(bp.id, name);
  });
  // Klasa podrzędna ma w this.vars także zmienne przodków, więc jej nazwy nie mogą się z nimi pokryć.
  const vars = new Map();
  const takenBy = new Map();
  geCodeBlueprints(project).forEach((bp) => {
    const parent = geParentOf(project, bp);
    const taken = new Set(parent ? takenBy.get(parent.id) : []);
    bp.variables.forEach((v) => {
      let name = GE_RT.ident(v.name);
      while (taken.has(name)) name += '_';
      taken.add(name);
      vars.set(bp.id + ':' + v.id, name);
    });
    takenBy.set(bp.id, taken);
  });
  // Level Blueprinty pozostałych poziomów: każdy to osobna klasa (otwarty poziom to LevelBlueprint).
  const levels = new Map();
  geLevels(project).filter((l) => l.id !== project.levelId).forEach((l) => {
    let name = 'LevelBlueprint_' + GE_RT.ident(l.name);
    while (used.has(name)) name += '_';
    used.add(name);
    levels.set(l.id, name);
  });
  return { classes, vars, levels };
}

// Znacznik w kodzie z breakpointami — zamieniany na listę zmiennych lokalnych metody.
const GE_DEBUG_LOCALS = '/*ge:locals*/';

function geAllBlueprints(project) {
  return [project.level, ...project.blueprints];
}

// Blueprinty z grafem, które kompilują się do klas: Level Blueprint, klasy aktorów, widgety i Animation Blueprinty.
// Klasa nadrzędna zawsze przed podrzędną — w kodzie musi być zadeklarowana wcześniej.
function geCodeBlueprints(project) {
  const list = [];
  const visit = (bp) => {
    if (list.includes(bp)) return;
    const parent = geParentOf(project, bp);
    if (parent && !geAncestors(project, parent).includes(bp)) visit(parent);
    list.push(bp);
  };
  project.blueprints.filter((bp) => ['actor', 'widget', 'anim_bp'].includes(geKind(bp))).forEach(visit);
  return [project.level, ...list];
}

// Kompiluje jeden Blueprint do klasy TypeScriptu. Zwraca { code, errors, warnings } —
// błędy i ostrzeżenia mają pole node, żeby edytor mógł zaznaczyć winny węzeł.
// ts: false — ten sam kod bez typów (JavaScript), który wykonuje silnik w edytorze i w wyeksportowanej grze.
// bpId — id klasy dla silnika (Level Blueprint nieotwartego poziomu ma „level:<id poziomu>”).
// debug — przed węzłami z breakpointem (node.breakpoint) wywołanie G.debugBreak, które zatrzymuje grę w edytorze.
function geCompileBlueprint(project, bp, names, { ts = true, bpId = bp.id, debug = false } = {}) {
  // Graf, który właśnie się kompiluje (Event Graph albo Construction Script). Id węzłów są wspólne
  // dla obu grafów (bp.nextNode), więc nazwy zmiennych lokalnych i błędy się nie mieszają.
  let nodes = new Map();
  let links = [];
  const errors = [];
  const warnings = [];
  const reached = new Set();
  const execStack = new Set();
  const pureStack = new Set();
  let method = null;
  const parent = geParentOf(project, bp);
  // Adnotacja typu z typu pinu („: number”); bez TypeScriptu — nic.
  const type = (pinType) => (ts ? ': ' + geTsTypeName(pinType) : '');

  const error = (node, msg) => {
    if (!errors.some((e) => e.node === node?.id && e.msg === msg)) errors.push({ node: node?.id ?? null, msg });
  };
  const linkInto = (nodeId, pinId) => links.find((l) => l.to[0] === nodeId && l.to[1] === pinId);
  const linkOut = (nodeId, pinId) => links.find((l) => l.from[0] === nodeId && l.from[1] === pinId);

  // entry — pin wejścia, którym przyszło wykonanie (Timeline ma kilka białych wejść: Play, Stop, Reverse…).
  function context(node, entry = null) {
    const def = GE_NODES[node.type];
    const pins = gePins(node, bp);
    return {
      // Klasa podrzędna dzieli z rodzicem stan Delay / Do Once, a numery węzłów obu klas się powtarzają.
      id: parent ? `${bp.id}_${node.id}` : node.id,
      node,
      bp,
      entry,
      pins,
      method: () => method,
      in: (pinId) => inputExpr(node, pins.ins.find((p) => p.id === pinId)),
      exec: (pinId) => execFrom(node, pinId),
      prop: (id) => node.props?.[id] ?? def.props?.find((p) => p.id === id)?.def,
      cls: (id, kind = 'actor') => {
        const name = names.classes.get(node.props?.[id]);
        const target = project.blueprints.find((b) => b.id === node.props?.[id]);
        if (!name || !target || geKind(target) !== kind) {
          error(node, kind === 'widget' ? 'Wybierz klasę Widget Blueprint w tym węźle.' : 'Wybierz klasę Blueprint w tym węźle.');
          return 'null';
        }
        return name;
      },
      mat: (id) => {
        const m = project.blueprints.find((b) => b.id === node.props?.[id] && geKind(b) === 'material');
        if (!m) {
          error(node, 'Wybierz Materiał w tym węźle.');
          return 'null';
        }
        return JSON.stringify(geMaterialLook(m));
      },
      // Input Action / Mapping Context w kodzie to nazwa zasobu (brak zgłasza check węzła).
      asset: (id, kind) => JSON.stringify(geAsset(project, node.props?.[id], kind)?.name ?? ''),
      // Brak komponentu zgłasza pętla po węzłach (geCompOf), tu wystarczy bezpieczna nazwa.
      comp: () => JSON.stringify(geCompOf(node, bp)?.name ?? ''),
      fn: () => geFnOf(node, bp),
      // Klucz Event Dispatchera w grze (brak dispatchera zgłasza check węzła).
      disp: () => {
        const entry = geDispEntry(node, bp);
        return JSON.stringify(entry ? `${entry.owner.id}:${entry.item.id}` : '');
      },
      local: (pinId) => {
        const pin = pins.outs.find((p) => p.id === pinId);
        const name = (pin?.local ?? pinId) + node.id.slice(1);
        method.locals.set(name, pin?.type);
        method.labels.set(name, `${geNodeTitle(node, bp)} › ${pin?.name || pinId}`);
        method.produced.add(name);
        return name;
      },
      v: () => {
        const entry = geChainEntry(project, geVarClass(project, node, bp), 'variables', node.props?.var);
        if (!entry) {
          error(node, 'Ta zmienna została usunięta (albo należy do innej klasy nadrzędnej). Usuń węzeł albo wybierz inną zmienną.');
          return 'usunieta';
        }
        return names.vars.get(entry.owner.id + ':' + entry.item.id);
      }
    };
  }

  function inputExpr(node, pin) {
    if (!pin) return 'undefined';
    const link = linkInto(node.id, pin.id);
    if (link) {
      const src = nodes.get(link.from[0]);
      const out = src && gePins(src, bp).outs.find((p) => p.id === link.from[1]);
      if (out) return geConvert(outputExpr(src, out), out.type, pin.type);
    }
    return geLiteral(node.values?.[pin.id] ?? pin.def, pin);
  }

  function outputExpr(src, out) {
    const def = GE_NODES[src.type];
    if (def.kind === 'event') {
      // Pin Delegate zdarzenia własnego nie zależy od łańcucha, w którym jest użyty.
      if (typeof out.expr === 'function') return out.expr(context(src));
      if (!method.params.includes(out.expr)) {
        error(src, `Pin „${out.name}” działa tylko w łańcuchu tego zdarzenia.`);
        return 'null';
      }
      return out.expr;
    }
    if (def.kind === 'pure' || def.kind === 'reroute') {
      if (pureStack.has(src.id)) {
        error(src, 'Węzły liczą wynik same z siebie (pętla połączeń danych).');
        return '0';
      }
      pureStack.add(src.id);
      const expr = def.expr(context(src), out.id);
      pureStack.delete(src.id);
      return expr;
    }
    if (out.expr) return out.expr(context(src));
    const name = (out.local ?? out.id) + src.id.slice(1);
    if (!method.used.has(name)) method.used.set(name, src);
    return name;
  }

  // Breakpoint: wejścia węzła (jako funkcje — liczone dopiero przy zatrzymaniu) i zmienne lokalne metody.
  // Listę zmiennych lokalnych zna dopiero cała metoda, więc w kodzie zostaje na razie znacznik GE_DEBUG_LOCALS.
  function debugBreak(c) {
    const ins = c.pins.ins.filter((p) => p.type !== 'exec').map((p) => `[${JSON.stringify(p.name || p.id)}, () => ${c.in(p.id)}]`);
    return `G.debugBreak(this, ${JSON.stringify(bpId)}, ${JSON.stringify(c.node.id)}, [${ins.join(', ')}], ${GE_DEBUG_LOCALS});`;
  }

  function execFrom(node, pinId) {
    const link = linkOut(node.id, pinId);
    const target = link && nodes.get(link.to[0]);
    return target ? execNode(target, link.to[1]) : '';
  }

  function execNode(node, entry = null) {
    const def = GE_NODES[node.type];
    if (!def || def.kind === 'pure' || def.kind === 'event') return '';
    if (execStack.has(node.id)) {
      error(node, 'Białe połączenia tworzą pętlę bez końca. Do powtarzania użyj „For Loop” albo timera.');
      return '';
    }
    reached.add(node.id);
    execStack.add(node.id);
    const c = context(node, entry);
    let code;
    if (def.gen) code = def.gen(c);
    else {
      const stmt = def.stmt(c);
      const next = c.exec('then');
      code = next ? `${stmt}\n${next}` : stmt;
    }
    if (debug && node.breakpoint) code = `${debugBreak(c)}\n${code}`;
    execStack.delete(node.id);
    return code;
  }

  const methods = new Map();
  geGraphs(bp).forEach((graph) => {
    const construction = graph === bp.construction;
    const fn = bp.funcs?.find((f) => f.graph === graph) ?? null;
    // Węzeł, od którego zaczyna się graf; w Event Graph — dowolne zdarzenie oprócz węzłów początkowych.
    const start = construction ? 'ev_construction' : fn ? 'fn_entry' : null;
    nodes = new Map(graph.nodes.map((n) => [n.id, n]));
    links = graph.links;
    graph.nodes.forEach((node) => {
      const def = GE_NODES[node.type];
      if (!def) {
        if (node.type !== 'comment') error(node, `Nieznany węzeł „${node.type}”.`);
        return;
      }
      const problem = def.check?.(node, bp, project);
      if (problem) error(node, problem);
      if (!geNodeAllowed(def, bp)) {
        error(node, def.childOnly ? 'Ta klasa nie ma klasy nadrzędnej — ustaw ją (Klasa nadrzędna na pasku) albo usuń węzeł.' : def.widgetOnly ? 'Ten węzeł działa tylko w Widget Blueprincie.' : def.actorOnly ? 'To zdarzenie działa tylko w klasie Blueprint aktora.' : 'Ten węzeł nie działa w Level Blueprincie.');
      }
      if (def.props?.some((p) => p.kind === 'component') && !geCompOf(node, bp)) error(node, 'Wybierz komponent w tym węźle (albo został usunięty).');
      if (construction && GE_NO_CONSTRUCTION.has(node.type)) error(node, 'Ten węzeł nie działa w Construction Script — gra jeszcze nie wystartowała. Przenieś go do Event Graph.');
      if (fn && GE_NO_FUNCTION.has(node.type)) error(node, 'Ten węzeł nie działa w funkcji — funkcja kończy się od razu, bez czekania. Użyj go w Event Graph.');
      if (node.type === 'fn_return' && node.props?.fn !== fn?.id) error(node, 'Return Node działa tylko w grafie swojej funkcji.');
      // Oprócz zdarzeń własne metody mają węzły z „methods” (Timeline: Update, Finished…) — tylko w Event Graph.
      if (def.kind !== 'event' && (!def.methods || start)) return;
      if (def.kind === 'event' && (start ? node.type !== start || (fn && node.props?.fn !== fn.id) : GE_FIXED_NODES.has(node.type))) {
        error(node, construction ? 'W Construction Script nie ma zdarzeń — wszystko zaczyna się od węzła „Construction Script”.'
          : fn ? 'W funkcji nie ma zdarzeń — wszystko zaczyna się od jej węzła wejścia.'
            : node.type === 'fn_entry' ? 'Wejście funkcji pasuje tylko do grafu tej funkcji — usuń ten węzeł.'
              : 'Construction Script ma własną kartę — usuń ten węzeł z Event Graph.');
        return;
      }
      geEventMethods(node, bp).forEach((m) => {
        method = { name: m.name, paramList: m.params ?? '', params: m.params ? m.params.split(/,\s*/) : [], locals: new Map(), labels: new Map(), produced: new Set(), used: new Map() };
        let body = execFrom(node, m.pin);
        if (debug && node.breakpoint && def.kind === 'event') body = [debugBreak(context(node)), body].filter(Boolean).join('\n');
        method.used.forEach((src, name) => {
          if (!method.produced.has(name)) error(src, 'Wynik tego węzła jest używany w innym zdarzeniu niż to, w którym węzeł się wykonuje.');
        });
        // Funkcja trafia do klasy zawsze, nawet pusta — inaczej jej wywołania by nie działały.
        if (!body && !fn) return;
        // Typ parametru to typ pinu zdarzenia, który go podaje (pin.expr = nazwa parametru).
        const outs = gePins(node, bp).outs;
        const params = method.params.map((p) => p + type(outs.find((o) => o.expr === p)?.type)).join(', ');
        const returns = ts && fn?.outputs.length ? `: { ${fn.outputs.map((o) => o.name + type(o.type)).join('; ')} }` : '';
        const entry = methods.get(m.name) ?? { params, returns, parts: [], locals: new Map(), labels: new Map(), titles: [] };
        // Domyślne wyniki dopisujemy tylko, gdy funkcja nie kończy się już własnym „return”.
        const ends = /^return\b/.test(body.split('\n').pop());
        entry.parts.push(fn && !ends ? [body, geFnDefaultReturn(fn)].filter(Boolean).join('\n') : body);
        method.locals.forEach((t, name) => entry.locals.set(name, t));
        const label = geNodeTitle(node, bp);
        method.params.forEach((p) => entry.labels.set(p, `${label} › ${outs.find((o) => o.expr === p)?.name || p}`));
        method.labels.forEach((l, name) => entry.labels.set(name, l));
        if (!entry.titles.includes(label)) entry.titles.push(label);
        methods.set(m.name, entry);
      });
    });

    graph.nodes.forEach((node) => {
      const def = GE_NODES[node.type];
      // Timeline z AutoPlay rusza sam, bez białego kabla.
      if (def && !['pure', 'event', 'reroute'].includes(def.kind) && !reached.has(node.id) && !(node.type === 'timeline' && geTl(node).autoPlay && !start)) {
        warnings.push({ node: node.id, msg: `„${geNodeTitle(node, bp)}” nie jest połączony białym kablem ${construction ? 'z Construction Script' : fn ? 'z wejściem funkcji' : 'ze zdarzeniem'}, więc się nie wykona.` });
      }
    });
  });

  const cls = names.classes.get(bp.id);
  // Klasa nadrzędna: Blueprint, klasa TypeScript z @UCLASS (jak klasa C++ w Unreal Engine) albo Actor / Widget.
  const tsParent = !parent && geKind(bp) === 'actor' ? geAsset(project, bp.parent, 'tsclass') : null;
  const tsProblem = tsParent && geTsParentProblem(project, tsParent);
  if (tsProblem) error(null, `Klasa nadrzędna ${tsParent.name}: ${tsProblem}`);
  const base = parent ? names.classes.get(parent.id) : tsParent && !tsProblem ? tsParent.ts.api.className : { widget: 'Widget', anim_bp: 'AnimInstance' }[geKind(bp)] ?? 'Actor';
  const label = { widget: 'Widget Blueprint', anim_bp: 'Animation Blueprint' }[geKind(bp)] ?? 'Blueprint';
  const lines = [`// ${label}: ${bp.name.replace(/\n/g, ' ')}`, `class ${cls} extends ${base} {`];
  lines.push(`  static bpId = ${JSON.stringify(bpId)};`);
  const interfaces = (bp.id === 'level' ? [] : geClassInterfaces(project, bp)).filter((id) => project.blueprints.some((b) => b.id === id && geKind(b) === 'interface'));
  if (interfaces.length) lines.push(`  static interfaces = ${JSON.stringify(interfaces)};`);
  // Ustawienia i ścieżki Timeline'ów z Event Graph (stan w grze: Actor.timeline(klucz)).
  const timelines = geTlNodes(bp).map((n) => [geTlKey(bp, n.id), geTimelineConfig(bp, n)]);
  if (timelines.length) lines.push(`  static timelines = ${JSON.stringify(Object.fromEntries(timelines))};`);
  // Animation Blueprint: maszyna stanów (game-paperzd.js) — stany, przejścia z warunkami i Jump Nodes.
  if (geKind(bp) === 'anim_bp') lines.push(`  static animGraph = ${JSON.stringify(geZdCompileGraph(project, bp, names, { error: (msg) => error(null, msg), warn: (msg) => warnings.push({ node: null, msg }) }))};`);
  // Nazwy zmiennych z Blueprintów (także odziedziczonych) do podglądu wartości przy breakpoincie.
  if (debug) {
    const vars = Object.fromEntries([bp, ...geAncestors(project, bp)].flatMap((b) => b.variables.map((v) => [names.vars.get(b.id + ':' + v.id), v.name])));
    lines.push(`  static debugVars = ${JSON.stringify(vars)};`);
  }
  // Pola UPROPERTY z klas TypeScript: wartości z Ustawień klasy i z aktora na poziomie.
  const tsLines = bp.id === 'level' || tsProblem ? [] : geTsCtorLines(project, bp);
  if (bp.variables.length || tsLines.length) {
    lines.push('', `  constructor(game${ts ? ': Game' : ''}, data${ts ? ': ActorData' : ''}) {`, '    super(game, data);');
    bp.variables.forEach((v) => {
      const name = names.vars.get(bp.id + ':' + v.id);
      const literal = geLiteral(v.value, { type: v.type });
      const saved = `data.vars[${JSON.stringify(bp.id + ':' + v.id)}]`;
      if (!v.editable) lines.push(`    this.vars.${name} = ${literal};`);
      else if (['bool', 'int', 'float', 'string'].includes(v.type)) lines.push(`    this.vars.${name} = ${saved} ?? ${literal};`);
      else lines.push(`    this.vars.${name} = ${saved} !== undefined ? ${geInstValue(saved, v.type)} : ${literal};`);
    });
    tsLines.forEach((line) => lines.push('    ' + line));
    lines.push('  }');
  }
  methods.forEach((m, name) => {
    lines.push('', `  // ${m.titles.join(', ')}`, `  ${name}(${m.params})${m.returns} {`);
    if (m.locals.size) lines.push(`    let ${[...m.locals].map(([local, t]) => local + type(t)).join(', ')};`);
    const locals = `[${[...m.labels].map(([name, label]) => `[${JSON.stringify(label)}, ${name}]`).join(', ')}]`;
    lines.push(geIndent(m.parts.join('\n'), '    ').split(GE_DEBUG_LOCALS).join(locals), '  }');
  });
  lines.push('}');
  return { code: lines.join('\n').replace(/<\//g, '<\\/'), errors, warnings };
}

// Cały program gry: wszystkie klasy w jednym kodzie, który zwraca listę klas dla silnika.
// Domyślnie JavaScript do wykonania; { ts: true } — ten sam program w TypeScripcie (panel kodu, kopiowanie).
// { debug: true } — z breakpointami (granie w edytorze).
function geCompileProject(project, { ts = false, debug = false } = {}) {
  const names = geNames(project);
  const results = new Map();
  const parts = [
    `// Kod ${ts ? 'TypeScript' : 'gry'} wygenerowany z Blueprintów przez JSGame Engine.`,
    '// Actor — klasa bazowa aktorów, Widget — interfejsu na ekranie, AnimInstance — Animation Blueprintów,',
    '// G — gra (punkty, dźwięki, klawisze…), vec(x, y) — wektor.',
    'const { Actor, Widget, AnimInstance, G, vec } = runtime;'
  ];
  const previous = geActiveProject;
  geActiveProject = project;
  try {
    // Bazy danych i klasy TypeScript (game-data.js) — przed klasami, które z nich korzystają.
    const prelude = geDataPrelude(project, { ts, debug });
    if (prelude) parts.push(prelude);
    geCodeBlueprints(project).forEach((bp) => {
      const result = geCompileBlueprint(project, bp, names, { ts, debug });
      results.set(bp.id, result);
      parts.push('', result.code);
    });
    // Level Blueprinty pozostałych poziomów — kompilowane tak, jakby ten poziom był otwarty.
    geLevels(project).filter((l) => l.id !== project.levelId).forEach((l) => {
      const lvlProject = { ...project, level: l.level, actors: l.actors, levelId: l.id };
      const lvlNames = { ...names, classes: new Map(names.classes).set('level', names.levels.get(l.id)), vars: geNames(lvlProject).vars };
      geActiveProject = lvlProject;
      const result = geCompileBlueprint(lvlProject, l.level, lvlNames, { ts, debug, bpId: 'level:' + l.id });
      results.set('level:' + l.id, result);
      parts.push('', `// Poziom: ${l.name.replace(/\n/g, ' ')}`, result.code);
    });
  } finally {
    geActiveProject = previous;
  }
  parts.push('', `return [${[...names.classes.values(), ...names.levels.values()].join(', ')}];`);
  const errorCount = [...results.values()].reduce((sum, r) => sum + r.errors.length, 0);
  return { code: parts.join('\n'), results, errorCount };
}

// ---------- Starsze węzły → ich odpowiedniki z Unreal Engine ----------
// Wywoływane przy wczytaniu projektu i przy tworzeniu projektu z szablonu. Zamienia:
// wygląd aktora (DefaultSceneRoot nie ma wyglądu) → komponent kształtu (geLookToComponent),
// Is A + Branch → Cast To, Set Actor Hidden In Game z pinem Visible → New Hidden, Set Text aktora → Set Text (komponent Napis),
// Restart Level → Open Level + Get Current Level Name, Count Actors Of Class → Get All Actors Of Class + Length,
// Call Custom Event z nazwą w pinie → węzeł o nazwie zdarzenia, zmienne gry → zmienne GameMode (jeden poziom)
// albo Game Instance (kilka poziomów — tylko Game Instance przetrwa Open Level).
// Czego nie da się zamienić (np. kabel do pinu z nazwą), zostaje starym, ukrytym w menu węzłem.
function geMigrateProject(p) {
  const previous = geActiveProject;
  geActiveProject = p;
  try {
    geMigrateNodes(p);
  } finally {
    geActiveProject = previous;
  }
  return p;
}

// Wygląd klas aktorów → komponenty. Klasa podrzędna z takim samym wyglądem jak rodzic po prostu dziedziczy jego komponent.
function geMigrateLooks(p) {
  const keys = ['shape', 'color', 'emoji', 'text', 'image', 'sprite', 'w', 'h', 'material', 'opacity', 'glow'];
  const actors = geCodeBlueprints(p).filter((b) => b.id !== 'level' && geKind(b) === 'actor');
  const before = new Map(actors.map((b) => [b.id, JSON.stringify(keys.map((k) => b.defaults?.[k] ?? null))]));
  actors.forEach((bp) => {
    if (!bp.defaults?.shape || bp.defaults.shape === 'none') return;
    const parent = geParentOf(p, bp);
    if (parent && before.get(parent.id) === before.get(bp.id)) {
      bp.defaults.shape = 'none';
      bp.defaults.material = null;
    } else geLookToComponent(p, bp);
  });
}

function geMigrateNodes(p) {
  geMigrateLooks(p);
  const otherLevels = geLevels(p).filter((l) => l.id !== p.levelId && l.level).map((l) => l.level);
  const bps = [...geAllBlueprints(p), ...otherLevels].filter((bp) => bp?.graph?.nodes);
  let holder;
  const holderBp = () => {
    if (holder !== undefined) return holder;
    const gi = geLevels(p).length > 1;
    const key = gi ? 'gameInstance' : 'gameMode';
    holder = p.blueprints.find((b) => b.id === p.settings[key] && geKind(b) === 'actor')
      ?? geAddBlueprint(p, gi ? 'BP_GameInstance' : 'BP_GameMode', { shape: 'none', collision: 'none' });
    holder.folder = holder.folder ?? p.folders?.find((f) => f.name === 'Framework')?.id ?? null;
    p.settings[key] = holder.id;
    holder.getter = gi ? 'get_game_instance' : 'get_gamemode';
    return holder;
  };
  const holderVar = (name) => {
    const h = holderBp();
    const ident = GE_RT.ident(name);
    const v = h.variables.find((x) => GE_RT.ident(x.name) === ident);
    if (v) return v.id;
    const id = 'v' + h.nextVar++;
    h.variables.push({ id, name: ident, type: 'float', value: 0, editable: false });
    return id;
  };
  bps.forEach((bp) => geGraphs(bp).filter((g) => g?.nodes).forEach((graph) => {
    const byId = (id) => graph.nodes.find((n) => n.id === id);
    const linksTo = (id, pin) => graph.links.filter((l) => l.to[0] === id && l.to[1] === pin);
    const wired = (id, pin) => linksTo(id, pin).length > 0;
    const link = (a, ap, b, bpin) => graph.links.push({ from: [a.id, ap], to: [b.id, bpin] });
    const add = (type, x, y, props = {}, values = {}) => {
      const n = { id: 'n' + bp.nextNode++, type, x: Math.round(x), y: Math.round(y), props, values };
      graph.nodes.push(n);
      return n;
    };
    const remove = (n) => {
      graph.nodes = graph.nodes.filter((x) => x !== n);
      graph.links = graph.links.filter((l) => l.from[0] !== n.id && l.to[0] !== n.id);
    };
    const moveIn = (n, pin, to, toPin) => linksTo(n.id, pin).forEach((l) => { l.to = [to.id, toPin]; });
    const moveOut = (n, pin, from, fromPin) => graph.links.filter((l) => l.from[0] === n.id && l.from[1] === pin).forEach((l) => { l.from = [from.id, fromPin]; });

    [...graph.nodes].forEach((n) => {
      n.props = n.props || {};
      n.values = n.values || {};
      switch (n.type) {
        case 'is_a': {
          const outs = graph.links.filter((l) => l.from[0] === n.id);
          const branch = outs.length === 1 && outs[0].to[1] === 'cond' ? byId(outs[0].to[0]) : null;
          if (branch?.type !== 'branch') break;
          const cast = add('cast', branch.x, branch.y, { cls: n.props.cls });
          moveIn(branch, 'exec', cast, 'exec');
          moveOut(branch, 'true', cast, 'then');
          moveOut(branch, 'false', cast, 'failed');
          moveIn(n, 'actor', cast, 'actor');
          remove(n);
          remove(branch);
          break;
        }
        case 'set_visible': {
          if (!('visible' in n.values) && !wired(n.id, 'visible')) break;
          if (wired(n.id, 'visible')) {
            const not = add('not', n.x - 128, n.y + 96);
            moveIn(n, 'visible', not, 'a');
            link(not, 'out', n, 'hidden');
          } else n.values.hidden = !(n.values.visible ?? true);
          delete n.values.visible;
          break;
        }
        case 'set_text':
        case 'comp_text': {
          // Napis aktora jest teraz w jego pierwszym komponencie Napis (comp 'root' — wcześniejsza wersja tej zamiany).
          if (n.type === 'comp_text' ? n.props.comp !== 'root' : geKind(bp) !== 'actor' || wired(n.id, 'target')) break;
          const text = geChainEntries(p, bp, 'components').find((e) => e.item.type === 'text');
          n.type = text ? 'comp_text' : 'set_text';
          n.props = text ? { comp: text.ref } : {};
          break;
        }
        case 'restart': {
          n.type = 'open_level';
          link(add('level_name', n.x - 240, n.y + 112), 'out', n, 'level');
          break;
        }
        case 'call_event':
          if (n.props.name !== undefined) break;
          if (wired(n.id, 'name')) {
            n.type = 'call_event_name';
            break;
          }
          n.props.name = String(n.values.name ?? 'MojeZdarzenie');
          delete n.values.name;
          break;
        case 'count_class': {
          // Get All Actors Of Class wykonuje się tuż przed jedynym węzłem z białymi pinami, który korzysta z wyniku.
          const users = new Set();
          const seen = new Set([n.id]);
          const queue = [n.id];
          while (queue.length) {
            const id = queue.shift();
            graph.links.filter((l) => l.from[0] === id).forEach((l) => {
              const t = byId(l.to[0]);
              if (!t || seen.has(t.id)) return;
              seen.add(t.id);
              if (['pure', 'reroute'].includes(GE_NODES[t.type]?.kind)) queue.push(t.id);
              else users.add(t);
            });
          }
          if (users.size !== 1) break;
          const [user] = users;
          if (!gePins(user, bp).ins.some((pin) => pin.id === 'exec')) break;
          const all = add('get_all_actors', user.x, user.y - 176, { cls: n.props.cls });
          moveIn(user, 'exec', all, 'exec');
          link(all, 'then', user, 'exec');
          n.type = 'array_length';
          n.props = {};
          link(all, 'actors', n, 'array');
          break;
        }
        case 'get_gvar':
        case 'set_gvar':
        case 'add_gvar': {
          if (wired(n.id, 'name')) break;
          const h = holderBp();
          const props = { var: holderVar(String(n.values.name ?? 'Punkty')), ...(bp === h ? {} : { cls: h.id }) };
          const targets = [n];
          if (n.type === 'add_gvar') {
            const get = add('var_get', n.x - 288, n.y + 128, { ...props });
            const sum = add('add', n.x - 112, n.y + 128, {}, { b: n.values.amount ?? 1 });
            link(get, 'out', sum, 'a');
            moveIn(n, 'amount', sum, 'b');
            link(sum, 'out', n, 'value');
            targets.push(get);
            n.values = {};
          } else if (n.type === 'set_gvar') n.values = 'value' in n.values ? { value: n.values.value } : {};
          else n.values = {};
          n.type = n.type === 'get_gvar' ? 'var_get' : 'var_set';
          n.props = props;
          if (bp !== h) {
            const getter = add(h.getter, n.x - 224, n.y + (n.type === 'var_get' ? 64 : 96));
            targets.forEach((t) => link(getter, 'out', t, 'target'));
          }
          break;
        }
      }
    });
  }));
  if (holder) delete holder.getter;
}

// ---------- Projekty ----------

function geNewProject(name = 'Moja gra') {
  const project = {
    version: 1,
    name,
    settings: { width: 960, height: 540, background: '#8fd3ff', gravity: 1600, killY: 1200, grid: 16, autosave: 5, gameMode: '', gameInstance: '', playerController: '', defaultPawn: '', hud: '', inputContext: '', spawnX: 120, spawnY: 400, playerStart: false, view: '2d', floorColor: '#5a4a3a', wallHeight: 64, minimap: false },
    level: geNewLevelBp(),
    levels: [{ id: 'lvl0', name: 'Poziom1' }],
    levelId: 'lvl0',
    folders: [],
    blueprints: [],
    actors: [],
    nextId: 1
  };
  return project;
}

// ---------- Poziomy ----------

// Projekt ma listę poziomów (project.levels; pierwszy startuje w wyeksportowanej grze). Otwarty poziom
// (project.levelId) trzyma swoje dane na wierzchu projektu — actors, level (Level Blueprint) i Miejsce
// startu w settings — więc edytor i kompilator pracują jak dotąd na jednym poziomie. Pozostałe poziomy
// mają te same dane we własnym wpisie listy.
const GE_LEVEL_SETTINGS = ['spawnX', 'spawnY', 'playerStart'];
const geLevels = (project) => project?.levels ?? [];
const geCurLevel = (project) => geLevels(project).find((l) => l.id === project.levelId) ?? null;
// Aktorzy ze wszystkich poziomów (np. do sprzątania po usuniętej klasie).
const geAllActors = (project) => [project.actors, ...geLevels(project).filter((l) => l.id !== project.levelId).map((l) => l.actors ?? [])].flat();
// Zostawia na każdym poziomie tylko aktorów spełniających keep.
function geFilterActors(project, keep) {
  project.actors = project.actors.filter(keep);
  geLevels(project).forEach((l) => {
    if (l.id !== project.levelId && l.actors) l.actors = l.actors.filter(keep);
  });
}

function geNewLevelBp() {
  const bp = { id: 'level', name: 'Level Blueprint', variables: [], funcs: [], graph: { nodes: [], links: [] }, nextNode: 1, nextVar: 1 };
  const g = geGraph(bp);
  g.add('ev_begin', 64, 64);
  g.add('ev_tick', 64, 240);
  return bp;
}

// Pełne dane poziomu: otwartego — z wierzchu projektu, pozostałych — z ich wpisu.
function geLevelData(project, lvl) {
  if (lvl.id !== project.levelId) return lvl;
  return { ...lvl, actors: project.actors, level: project.level, ...Object.fromEntries(GE_LEVEL_SETTINGS.map((k) => [k, project.settings[k]])) };
}

// Otwiera inny poziom: dane obecnego wracają do jego wpisu, a dane wybranego idą na wierzch projektu.
function geSwitchLevel(project, id) {
  const cur = geCurLevel(project);
  const next = geLevels(project).find((l) => l.id === id);
  if (!next || next === cur) return false;
  if (cur) Object.assign(cur, geLevelData(project, cur));
  project.actors = next.actors;
  project.level = next.level;
  GE_LEVEL_SETTINGS.forEach((k) => {
    project.settings[k] = next[k];
  });
  ['actors', 'level', ...GE_LEVEL_SETTINGS].forEach((k) => delete next[k]);
  project.levelId = id;
  return true;
}

// Nowy poziom na końcu listy: pusty albo kopia poziomu source.
function geAddLevel(project, name, source = null) {
  const s = geNewProject().settings;
  const data = source ? JSON.parse(JSON.stringify(geLevelData(project, source))) : { actors: [], level: geNewLevelBp() };
  const lvl = { ...Object.fromEntries(GE_LEVEL_SETTINGS.map((k) => [k, s[k]])), ...data, id: 'lvl' + project.nextId++, name };
  project.levels.push(lvl);
  return lvl;
}

// Lista poziomów w projekcie: starszy projekt (bez listy) dostaje jeden poziom z tym, co ma na wierzchu.
// Nazwy poziomów są unikalne — węzeł „Open Level” szuka poziomu po nazwie.
function geNormalizeLevels(p) {
  const s = geNewProject().settings;
  p.levels = (Array.isArray(p.levels) ? p.levels : []).filter((l) => l && typeof l === 'object' && l.id);
  if (!p.levels.some((l) => l.id === p.levelId)) {
    p.levelId = 'lvl' + p.nextId++;
    p.levels.unshift({ id: p.levelId, name: 'Poziom1' });
  }
  const taken = new Set();
  p.levels.forEach((l, i) => {
    let name = String(l.name ?? '').trim() || `Poziom${i + 1}`;
    for (let n = 2; taken.has(name); n++) name = `${String(l.name ?? '').trim() || 'Poziom'}${n}`;
    taken.add(name);
    l.name = name;
    if (l.id === p.levelId) {
      ['actors', 'level', ...GE_LEVEL_SETTINGS].forEach((k) => delete l[k]);
      return;
    }
    l.actors = Array.isArray(l.actors) ? l.actors : [];
    l.level = l.level && typeof l.level === 'object' ? l.level : geNewLevelBp();
    l.level.id = 'level';
    GE_LEVEL_SETTINGS.forEach((k) => {
      if (l[k] === undefined) l[k] = s[k];
    });
  });
}

function geAddBlueprint(project, name, defaults = {}, kind = 'actor') {
  const bp = {
    id: 'bp' + project.nextId++,
    name,
    kind,
    defaults: { ...GE_BP_DEFAULTS, ...defaults },
    variables: [],
    graph: { nodes: [], links: [] },
    nextNode: 1,
    nextVar: 1
  };
  if (kind === 'actor' || kind === 'widget' || kind === 'anim_bp') {
    bp.interfaces = [];
    bp.funcs = [];
  }
  if (kind === 'widget') bp.widget = { elements: [] };
  if (kind === 'interface') Object.assign(bp, { functions: [], properties: [] });
  if (kind === 'material') bp.material = { ...GE_MATERIAL_DEFAULTS };
  if (kind === 'texture') bp.texture = { src: null, w: 0, h: 0 };
  if (kind === 'sprite') bp.sprite = { texture: null, x: 0, y: 0, w: 0, h: 0 };
  if (kind === 'animation') bp.flipbook = { ...GE_FLIPBOOK_DEFAULTS, frames: [] };
  if (kind === 'sound') bp.sound = { ...GE_SOUND_DEFAULTS };
  if (kind === 'input_action') bp.inputAction = { ...GE_INPUT_ACTION_DEFAULTS, triggers: [], modifiers: [] };
  if (kind === 'input_context') bp.mappingContext = { mappings: [] };
  geDataAssetDefaults(bp);
  geZdAssetDefaults(bp);
  if (kind === 'actor') geAddConstruction(bp);
  project.blueprints.push(bp);
  return bp;
}

// Komponenty i graf Construction Script klasy aktora (z jednym, stałym węzłem początkowym).
function geAddConstruction(bp) {
  bp.components = bp.components ?? [];
  bp.nextComp = bp.nextComp ?? 1;
  bp.construction = { nodes: [{ id: 'n' + bp.nextNode++, type: 'ev_construction', x: 0, y: 0, props: {}, values: {} }], links: [] };
}

// Wygląd aktora robią komponenty z „Podstawowych kształtów” — DefaultSceneRoot ma tylko kolizję i ruch.
// Zamienia wygląd zapisany w ustawieniach klasy (shape, color, emoji…) na pierwszy komponent klasy.
// Sprite / Animacja zostaje na korzeniu, chyba że to cały obrazek tekstury (wtedy komponent Obrazek).
function geLookToComponent(project, bp) {
  const d = bp.defaults;
  if (geKind(bp) !== 'actor' || bp.id === 'level' || !d || !d.shape || d.shape === 'none') return null;
  let type = d.shape;
  const extra = {};
  if (type === 'sprite') {
    const f = geSpriteData(project, d.sprite)?.frames;
    const tex = f?.length === 1 && geAsset(project, f[0].tex, 'texture');
    if (tex && !f[0].x && !f[0].y && f[0].w === tex.texture.w && f[0].h === tex.texture.h) {
      type = 'image';
      extra.image = f[0].src;
    } else extra.sprite = d.sprite ?? null;
  }
  if (d.material) extra.material = d.material;
  const def = GE_COMP_TYPES[type];
  if (!def || def.kind !== 'shape') return null;
  bp.components = bp.components ?? [];
  bp.nextComp = bp.nextComp ?? 1;
  const taken = bp.components.map((c) => c.name);
  let name = def.base;
  for (let i = 2; taken.includes(name); i++) name = def.base + i;
  const c = { id: 'c' + bp.nextComp++, type, name, ...JSON.parse(JSON.stringify(def.defaults)), z: 0, w: d.w, h: d.h };
  ['color', 'emoji', 'text', 'image'].forEach((k) => {
    if (k in def.defaults && d[k] != null) c[k] = d[k];
  });
  // Krycie i poświata (np. z Materiału) działają też na komponencie.
  if (d.opacity != null && d.opacity !== 1) c.opacity = d.opacity;
  if (d.glow) c.glow = d.glow;
  Object.assign(c, extra);
  bp.components.unshift(c);
  d.shape = 'none';
  d.material = null;
  return c;
}

// Element widgetu (Projektant): tekst, przycisk albo prostokąt, x/y to lewy górny róg na ekranie gry.
function geAddWidgetElement(bp, type, x = 32, y = 32) {
  const { label, ...base } = GE_WIDGET_ELEMENTS[type];
  const taken = bp.widget.elements.map((el) => el.name);
  let i = 1;
  while (taken.includes(label + i)) i++;
  const el = { id: 'e' + bp.nextVar++, name: label + i, type, x, y, ...base };
  bp.widget.elements.push(el);
  return el;
}

// Dane gry dla silnika (granie w edytorze i eksport): tylko klasy z kodem, Materiały już nałożone.
// Sprite'y i animacje idą osobno (sprites → klatki z id tekstury, textures → obrazek), żeby obrazek
// wspólny dla wielu klatek był w pliku gry tylko raz. Dźwięki z plików — w sounds.
function geGameData(project) {
  const sprites = {};
  const textures = {};
  project.blueprints.filter((b) => ['sprite', 'animation'].includes(geKind(b))).forEach((b) => {
    const data = geSpriteData(project, b.id);
    if (!data) return;
    sprites[b.id] = { ...data, frames: data.frames.map(({ src, ...f }) => {
      textures[f.tex] = src;
      return f;
    }) };
  });
  const sounds = Object.fromEntries(project.blueprints.filter((b) => geKind(b) === 'sound').map((b) => [b.id, { src: b.sound.src, preset: b.sound.preset, volume: b.sound.volume }]));
  return {
    name: project.name,
    settings: project.settings,
    blueprints: geCodeBlueprints(project).slice(1).map((bp) => {
      const { spriteData, ...defaults } = geResolveDefaults(project, bp);
      return {
        id: bp.id, name: bp.name, kind: geKind(bp), defaults, ...(bp.widget ? { widget: bp.widget } : {}),
        ...(geKind(bp) === 'actor' ? { components: geLookComponents(project, bp, false) } : {})
      };
    }),
    actors: project.actors,
    // Poziomy dla „Open Level”: aktorzy, klasa Level Blueprintu i Miejsce startu każdego z nich.
    levels: geLevels(project).map((l) => {
      const { id, name, actors, ...data } = geLevelData(project, l);
      return { id, name, bp: id === project.levelId ? 'level' : 'level:' + id, actors, ...Object.fromEntries(GE_LEVEL_SETTINGS.map((k) => [k, data[k]])) };
    }),
    levelId: project.levelId,
    sprites,
    textures,
    sounds,
    input: geInputData(project),
    animSequences: geZdSequenceData(project)
  };
}

// Enhanced Input dla silnika: akcje i konteksty pod nazwami zasobów (tak jak w kodzie z Blueprintów).
function geInputData(project) {
  const name = (id, kind) => geAsset(project, id, kind)?.name ?? null;
  const items = (list) => (list ?? []).map((t) => (t.type === 'chord' ? { ...t, action: name(t.action, 'input_action') } : { ...t }));
  const actions = Object.fromEntries(project.blueprints.filter((b) => geKind(b) === 'input_action').map((b) => {
    const { triggers, modifiers, ...rest } = b.inputAction;
    return [b.name, { ...rest, triggers: items(triggers), modifiers: items(modifiers) }];
  }));
  const contexts = Object.fromEntries(project.blueprints.filter((b) => geKind(b) === 'input_context').map((b) => [b.name, {
    mappings: b.mappingContext.mappings.map((m) => ({ action: name(m.action, 'input_action'), key: m.key, triggers: items(m.triggers), modifiers: items(m.modifiers) }))
  }]));
  return { actions, contexts, defaultContext: name(project.settings.inputContext, 'input_context') };
}

// Mapowanie klawisza w Input Mapping Context (bp.mappingContext.mappings).
function geAddMapping(bp, action, key = '', extra = {}) {
  const m = { id: 'm' + bp.nextVar++, action, key, triggers: [], modifiers: [], ...extra };
  bp.mappingContext.mappings.push(m);
  return m;
}

// Domyślne „szare” zdarzenia nowego Blueprintu, jak w Unreal Engine.
function geAddDefaultEvents(bp) {
  const g = geGraph(bp);
  g.add('ev_begin', 64, 64);
  g.add('ev_overlap', 64, 224);
  g.add('ev_tick', 64, 400);
}

// Nowa klasa podrzędna, jak w Unreal Engine: BeginPlay, Tick i Construction Script od razu wywołują
// wersję z klasy nadrzędnej (węzeł Call Parent Event), więc dziecko na start zachowuje się jak rodzic.
function geAddChildDefaults(bp) {
  const g = geGraph(bp);
  [['ev_begin', 64], ['ev_tick', 240]].forEach(([type, y]) => g.link(g.add(type, 64, y), 'then', g.add('call_parent', 336, y)));
  const cs = bp.construction;
  const id = 'n' + bp.nextNode++;
  cs.nodes.push({ id, type: 'call_parent', x: 272, y: 0, props: {}, values: {} });
  cs.links.push({ from: [cs.nodes[0].id, 'then'], to: [id, 'exec'] });
}

// Nowy Widget Blueprint: zdarzenia Construct i Tick oraz jeden napis w Projektancie.
function geAddWidgetDefaults(bp) {
  const g = geGraph(bp);
  g.add('ev_construct', 64, 64);
  g.add('ev_tick', 64, 224);
  geAddWidgetElement(bp, 'text', 32, 24).text = 'Witaj!';
}

function geGraph(bp) {
  return {
    add(type, x, y, props = {}, values = {}) {
      const id = 'n' + bp.nextNode++;
      bp.graph.nodes.push({ id, type, x, y, props, values });
      return id;
    },
    link(fromNode, fromPin, toNode, toPin = 'exec') {
      bp.graph.links.push({ from: [fromNode, fromPin], to: [toNode, toPin] });
    },
    variable(name, type, value, editable = false) {
      const id = 'v' + bp.nextVar++;
      bp.variables.push({ id, name, type, value, editable });
      return id;
    }
  };
}

function geAddActor(project, bp, x, y, extra = {}) {
  const count = project.actors.filter((a) => a.bp === bp.id).length + 1;
  const actor = { id: 'a' + project.nextId++, name: bp.name.replace(/^BP_/, '') + count, bp: bp.id, x, y, rotation: 0, scaleX: 1, scaleY: 1, vars: {}, ...extra };
  project.actors.push(actor);
  return actor;
}

// Przykład na start: platformówka z kotem, gwiazdkami do zebrania i ogniem.
function geStarterProject() {
  const p = geNewProject('Kocia platformówka');
  p.level.graph.nodes = [];
  p.level.nextNode = 1;

  const player = geAddBlueprint(p, 'BP_Gracz', { shape: 'emoji', emoji: '🐱', w: 48, h: 48, gravity: true, collision: 'block', moveSpeed: 280, jumpSpeed: 720, z: 2 });
  const star = geAddBlueprint(p, 'BP_Gwiazdka', { shape: 'emoji', emoji: '⭐', w: 36, h: 36, collision: 'overlap', z: 1 });
  const fire = geAddBlueprint(p, 'BP_Ogien', { shape: 'emoji', emoji: '🔥', w: 40, h: 40, collision: 'overlap', z: 1 });
  const ground = geAddBlueprint(p, 'BP_Podloga', { shape: 'box', color: '#5c9e3a', w: 192, h: 32, collision: 'block' });

  // Sterowanie przez Enhanced Input, jak w szablonach Unreal Engine 5: akcje IA_Ruch i IA_Skok,
  // klawisze w IMC_Domyslny (włączony w Ustawieniach świata jako Default Mapping Context).
  const inputFolder = { id: 'f' + p.nextId++, name: 'Input', parent: null };
  p.folders.push(inputFolder);
  const iaMove = geAddBlueprint(p, 'IA_Ruch', {}, 'input_action');
  iaMove.inputAction.valueType = 'axis1d';
  const iaJump = geAddBlueprint(p, 'IA_Skok', {}, 'input_action');
  const imc = geAddBlueprint(p, 'IMC_Domyslny', {}, 'input_context');
  [iaMove, iaJump, imc].forEach((b) => { b.folder = inputFolder.id; });
  const negate = [geInputItem('mod', 'negate')];
  geAddMapping(imc, iaMove.id, 'D');
  geAddMapping(imc, iaMove.id, 'Right');
  geAddMapping(imc, iaMove.id, 'A', { modifiers: negate });
  geAddMapping(imc, iaMove.id, 'Left', { modifiers: negate });
  geAddMapping(imc, iaMove.id, 'Gamepad_LeftX', { modifiers: [geInputItem('mod', 'deadzone')] });
  geAddMapping(imc, iaJump.id, 'Space');
  geAddMapping(imc, iaJump.id, 'Gamepad_FaceButton_Bottom');
  p.settings.inputContext = imc.id;

  // Klasy z Ustawień świata, jak w Unreal Engine: GameMode pilnuje zasad, Player Controller
  // odbiera wejście i steruje postacią (Default Pawn), a HUD pokazuje punkty.
  const frameworkFolder = { id: 'f' + p.nextId++, name: 'Framework', parent: null };
  p.folders.push(frameworkFolder);
  const gameMode = geAddBlueprint(p, 'BP_GameMode', { shape: 'none', collision: 'none' });
  const controller = geAddBlueprint(p, 'BP_KontrolerGracza', { shape: 'none', collision: 'none' });
  const hud = geAddBlueprint(p, 'WBP_HUD', {}, 'widget');
  [gameMode, controller, hud].forEach((b) => { b.folder = frameworkFolder.id; });
  Object.assign(p.settings, { gameMode: gameMode.id, playerController: controller.id, defaultPawn: player.id, hud: hud.id, spawnX: 120, spawnY: 440, playerStart: true });

  // Player Controller: zdarzenia akcji IA_Ruch i IA_Skok sterują postacią z „Get Player Pawn”.
  let g = geGraph(controller);
  const cMoveEv = g.add('ev_input_action', 0, 0, { action: iaMove.id });
  const cMove = g.add('move_input', 336, 0);
  const cPawn1 = g.add('get_pawn', 64, 176);
  g.link(cMoveEv, 'Triggered', cMove);
  g.link(cMoveEv, 'value', cMove, 'scale');
  g.link(cPawn1, 'out', cMove, 'target');
  const cJumpEv = g.add('ev_input_action', 0, 320, { action: iaJump.id });
  const cPawn2 = g.add('get_pawn', 64, 496);
  const cGround = g.add('on_ground', 304, 496);
  const cBranch = g.add('branch', 336, 320);
  const cJump = g.add('jump', 608, 320);
  const cSound = g.add('sound', 880, 320, { sound: 'jump' });
  g.link(cJumpEv, 'Started', cBranch);
  g.link(cPawn2, 'out', cGround, 'target');
  g.link(cGround, 'out', cBranch, 'cond');
  g.link(cBranch, 'true', cJump);
  g.link(cPawn2, 'out', cJump, 'target');
  g.link(cJump, 'then', cSound);

  // Default Pawn: sam nie czyta klawiszy — tylko zaczyna poziom od nowa, gdy zginie.
  g = geGraph(player);
  const pDead = g.add('ev_destroyed', 0, 0);
  const pRestart = g.add('restart', 304, 0);
  g.link(pDead, 'then', pRestart);

  // GameMode: wita gracza i ogłasza wygraną, gdy zniknie ostatnia gwiazdka.
  g = geGraph(gameMode);
  const mBegin = g.add('ev_begin', 0, 0);
  const mPrint = g.add('print', 288, 0, {}, { text: 'Zbierz wszystkie gwiazdki! Chodzisz ←/→ (albo A/D), skaczesz Spacją — albo padem.' });
  g.link(mBegin, 'then', mPrint);
  const mTick = g.add('ev_tick', 0, 192);
  const mCount = g.add('count_class', 0, 352, { cls: star.id });
  const mZero = g.add('eq', 240, 352);
  const mBranch = g.add('branch', 288, 192);
  const mOnce = g.add('do_once', 528, 192);
  const mMsg = g.add('message', 752, 192, {}, { text: 'WYGRANA! 🎉' });
  const mSound = g.add('sound', 1024, 192, { sound: 'win' });
  g.link(mTick, 'then', mBranch);
  g.link(mCount, 'out', mZero, 'a');
  g.link(mZero, 'out', mBranch, 'cond');
  g.link(mBranch, 'true', mOnce);
  g.link(mOnce, 'then', mMsg);
  g.link(mMsg, 'then', mSound);

  // HUD: liczba punktów (zmienna gry „Punkty”) w lewym górnym rogu.
  Object.assign(geAddWidgetElement(hud, 'box', 12, 10), { name: 'Tlo', w: 236, h: 44, bg: '#1e2a3a' });
  Object.assign(geAddWidgetElement(hud, 'text', 24, 12), { name: 'TekstPunkty', text: '⭐ Punkty: 0', size: 22 });
  g = geGraph(hud);
  const hTick = g.add('ev_tick', 0, 0);
  const hSet = g.add('set_widget_text', 288, 0, {}, { name: 'TekstPunkty' });
  const hAppend = g.add('append', 64, 160, {}, { a: '⭐ Punkty: ' });
  const hGet = g.add('get_gvar', 0, 288);
  g.link(hTick, 'then', hSet);
  g.link(hGet, 'out', hAppend, 'b');
  g.link(hAppend, 'out', hSet, 'text');

  g = geGraph(star);
  const value = g.variable('Wartosc', 'int', 1, true);
  const sTick = g.add('ev_tick', 0, 0);
  const sRot = g.add('add_rotation', 288, 0);
  const sMul = g.add('mul', 160, 144, {}, { b: 120 });
  g.link(sTick, 'then', sRot);
  g.link(sTick, 'delta', sMul, 'a');
  g.link(sMul, 'out', sRot, 'deg');
  const sOver = g.add('ev_overlap', 0, 256);
  const sCast = g.add('cast', 288, 256, { cls: player.id });
  g.link(sOver, 'then', sCast);
  g.link(sOver, 'other', sCast, 'actor');
  const sAdd = g.add('add_gvar', 560, 256);
  const sVal = g.add('var_get', 352, 432, { var: value });
  g.link(sCast, 'then', sAdd);
  g.link(sVal, 'out', sAdd, 'amount');
  const sSound = g.add('sound', 800, 256, { sound: 'coin' });
  const sDestroy = g.add('destroy', 1008, 256);
  g.link(sAdd, 'then', sSound);
  g.link(sSound, 'then', sDestroy);

  g = geGraph(fire);
  const fOver = g.add('ev_overlap', 0, 0);
  const fCast = g.add('cast', 288, 0, { cls: player.id });
  const fSound = g.add('sound', 528, 0, { sound: 'hit' });
  const fPrint = g.add('print', 736, 0, {}, { text: 'Au! Gorąco! Spróbuj jeszcze raz.' });
  const fRestart = g.add('restart', 1104, 0);
  g.link(fOver, 'then', fCast);
  g.link(fOver, 'other', fCast, 'actor');
  g.link(fCast, 'then', fSound);
  g.link(fSound, 'then', fPrint);
  g.link(fPrint, 'then', fRestart);

  g = geGraph(p.level);
  g.add('ev_begin', 0, 0);

  [[96, 1], [480, 1], [864, 1], [1440, 1], [1824, 1]].forEach(([x, sx]) => geAddActor(p, ground, x, 512, { scaleX: sx * 2 }));
  geAddActor(p, ground, 704, 384);
  geAddActor(p, ground, 1056, 288);
  geAddActor(p, ground, 1408, 384, { scaleX: 0.75 });
  [[480, 448], [704, 320], [1056, 224], [1408, 320], [1824, 448], [1984, 448]].forEach(([x, y]) => geAddActor(p, star, x, y));
  geAddActor(p, fire, 576, 476);
  geAddActor(p, fire, 1904, 476);
  p.actors.find((a) => a.bp === star.id && a.x === 1056).vars[`${star.id}:${value}`] = 5;
  p.blueprints.forEach((bp) => geLookToComponent(p, bp));
  return p;
}
