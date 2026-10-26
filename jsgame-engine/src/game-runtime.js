// Silnik gier 2D dla JSGame Engine (game-editor.js) i dla gier z niego wyeksportowanych.
// Cały silnik jest w jednej funkcji, która nie korzysta z niczego na zewnątrz: eksport wkleja
// jej kod źródłowy (geCreateRuntime.toString()) do pliku HTML gry, więc gra działa bez edytora.
//
// Świat: x w prawo, y w dół, jednostka = 1 piksel ekranu gry. Pozycja aktora to jego środek.
// Kolizje liczone są na prostokątach (bez obrotu), co wystarcza do platformówek i gier z góry.
function geCreateRuntime() {
  const KEY_NAMES = {
    ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down',
    Space: 'Space', Enter: 'Enter', NumpadEnter: 'Enter',
    ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl'
  };
  const SCROLL_KEYS = ['Left', 'Right', 'Up', 'Down', 'Space'];
  const EPS = 0.01;

  function keyName(event) {
    if (KEY_NAMES[event.code]) return KEY_NAMES[event.code];
    if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
    if (/^Digit\d$/.test(event.code)) return event.code.slice(5);
    return null;
  }

  // Nazwa z Blueprintu (np. „Skok w górę”) → bezpieczny identyfikator JavaScriptu („Skok_w_gore”).
  // Gra pyta o te same nazwy co klatkę (zdarzenia wejścia, timery), więc wyniki są zapamiętywane.
  const PL = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z', Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z' };
  const identCache = new Map();
  function ident(name) {
    const key = String(name ?? '');
    let id = identCache.get(key);
    if (id !== undefined) return id;
    id = key
      .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => PL[ch])
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!id) id = 'x';
    if (/^\d/.test(id)) id = '_' + id;
    identCache.set(key, id);
    return id;
  }

  const round2 = (n) => Math.round(n * 100) / 100;

  class Vec {
    constructor(x = 0, y = 0) {
      this.x = Number(x) || 0;
      this.y = Number(y) || 0;
    }
    add(v) { return new Vec(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec(this.x - v.x, this.y - v.y); }
    scale(s) { return new Vec(this.x * s, this.y * s); }
    length() { return Math.hypot(this.x, this.y); }
    lengthSquared() { return this.x * this.x + this.y * this.y; }
    dot(v) { return this.x * v.x + this.y * v.y; }
    normalize() {
      const len = this.length();
      return len ? this.scale(1 / len) : new Vec();
    }
    toString() { return `X=${round2(this.x)} Y=${round2(this.y)}`; }
  }
  const vec = (x, y) => new Vec(x, y);

  // ---------- Timeline (jak FTimeline i FRichCurve w Unreal Engine) ----------
  // Krzywa to klucze posortowane po czasie: { t, v, interp, arrive, leave }. interp jak w menu klucza w UE:
  // auto (Cubic, styczne liczone same, płaskie na końcach i w szczytach), user (jedna styczna), break (osobne
  // styczne wejścia i wyjścia), linear, constant. Rodzaj odcinka wyznacza klucz na jego początku.
  function keyTangent(keys, i, side) {
    const k = keys[i];
    const prev = keys[i - 1];
    const next = keys[i + 1];
    const v = Number(k.v) || 0;
    switch (k.interp) {
      case 'user': return Number(k.arrive) || 0;
      case 'break': return Number(side === 'leave' ? k.leave : k.arrive) || 0;
      case 'constant': return 0;
      case 'linear': {
        const other = side === 'leave' ? next ?? prev : prev ?? next;
        return other && other.t !== k.t ? ((Number(other.v) || 0) - v) / (other.t - k.t) : 0;
      }
      default: {
        if (!prev || !next) return 0;
        const pv = Number(prev.v) || 0;
        const nv = Number(next.v) || 0;
        if ((v >= pv && v >= nv) || (v <= pv && v <= nv)) return 0;
        return (nv - pv) / Math.max(1e-6, next.t - prev.t);
      }
    }
  }

  function evalCurve(keys, time) {
    const n = keys?.length ?? 0;
    if (!n) return 0;
    if (n === 1 || time <= keys[0].t) return Number(keys[0].v) || 0;
    if (time >= keys[n - 1].t) return Number(keys[n - 1].v) || 0;
    let i = 0;
    while (keys[i + 1].t <= time) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const av = Number(a.v) || 0;
    const bv = Number(b.v) || 0;
    const diff = b.t - a.t;
    const s = (time - a.t) / diff;
    if (a.interp === 'constant') return av;
    if (a.interp === 'linear') return av + (bv - av) * s;
    // Odcinek Cubic: krzywa Béziera z punktami kontrolnymi na stycznych (1/3 odcinka), jak w Unreal Engine.
    const p1 = av + (keyTangent(keys, i, 'leave') * diff) / 3;
    const p2 = bv - (keyTangent(keys, i + 1, 'arrive') * diff) / 3;
    const u = 1 - s;
    return u * u * u * av + 3 * u * u * s * p1 + 3 * u * s * s * p2 + s * s * s * bv;
  }

  // Ścieżka koloru: klucze { t, color: '#rrggbb', a } — kanały liczone liniowo. Wynik: '#rrggbb' albo '#rrggbbaa'.
  function evalColor(keys, time) {
    const channels = (k) => {
      const hex = /^#?([0-9a-f]{6})/i.exec(String(k.color ?? ''))?.[1] ?? 'ffffff';
      return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(Math.round(Math.min(1, Math.max(0, k.a ?? 1)) * 255));
    };
    const curves = [0, 1, 2, 3].map((c) => (keys ?? []).map((k) => ({ t: k.t, v: channels(k)[c], interp: 'linear' })));
    const [r, g, b, a] = curves.map((keysOf) => (keysOf.length ? Math.round(Math.min(255, Math.max(0, evalCurve(keysOf, time)))) : 255));
    const hex = (n) => n.toString(16).padStart(2, '0');
    return '#' + hex(r) + hex(g) + hex(b) + (a < 255 ? hex(a) : '');
  }

  // Ostatni klucz na wszystkich ścieżkach (Use Last Keyframe).
  function timelineLastKey(cfg) {
    const times = (cfg.tracks ?? []).flatMap((tr) => (tr.type === 'vector' ? [...(tr.x ?? []), ...(tr.y ?? [])] : tr.keys ?? []).map((k) => k.t));
    return times.length ? Math.max(0, ...times) : 0;
  }

  // Stan jednego Timeline'u aktora. Metody i kolejność wywołań jak w UTimelineComponent / FTimeline.
  class Timeline {
    constructor(actor, cfg) {
      this.actor = actor;
      this.cfg = cfg;
      this.position = 0;
      this.playRate = 1;
      this.reversed = false;
      this.looping = !!cfg.loop;
      this.length = Number(cfg.length) || 0;
      // AutoPlay: Play przy aktywacji komponentu, czyli zanim zadziała BeginPlay.
      this.playing = !!cfg.autoPlay;
      this.values = {};
      this.evaluate();
    }
    get timelineLength() { return this.cfg.useLast ? timelineLastKey(this.cfg) : this.length; }
    get direction() { return this.reversed ? 'Backward' : 'Forward'; }
    value(id) {
      if (!(id in this.values)) this.evaluate();
      return this.values[id];
    }
    evaluate() {
      (this.cfg.tracks ?? []).forEach((tr) => {
        if (tr.type === 'float') this.values[tr.id] = evalCurve(tr.keys, this.position);
        else if (tr.type === 'vector') this.values[tr.id] = vec(evalCurve(tr.x, this.position), evalCurve(tr.y, this.position));
        else if (tr.type === 'color') this.values[tr.id] = evalColor(tr.keys, this.position);
      });
    }
    // SetPlaybackPosition: nowe wartości ścieżek, potem klucze Event Tracków z mijanego odcinka, na końcu Update.
    setPosition(pos, fireEvents, fireUpdate = true) {
      const old = this.position;
      this.position = pos;
      this.evaluate();
      const fired = [];
      if (fireEvents) {
        let min = this.reversed ? pos : old;
        let max = this.reversed ? old : pos;
        // Klucz dokładnie na końcu (albo na początku przy cofaniu) też się liczy.
        if (!this.reversed && max === this.timelineLength) max += 1e-6;
        if (this.reversed && min === 0) min -= 1e-6;
        (this.cfg.tracks ?? []).filter((tr) => tr.type === 'event').forEach((tr) => (tr.keys ?? []).forEach((k) => {
          if (this.reversed ? k.t > min && k.t <= max : k.t >= min && k.t < max) fired.push(tr.method);
        }));
      }
      fired.forEach((method) => this.actor.game.call(this.actor, method));
      if (fireUpdate) this.actor.game.call(this.actor, this.cfg.update);
    }
    play() {
      this.reversed = false;
      this.playing = true;
    }
    reverse() {
      this.reversed = true;
      this.playing = true;
    }
    stop() { this.playing = false; }
    playFromStart() {
      this.setPosition(0, false);
      this.play();
    }
    reverseFromEnd() {
      this.setPosition(this.timelineLength, false);
      this.reverse();
    }
    setNewTime(t) { this.setPosition(Number(t) || 0, false); }
    setPlayRate(rate) { this.playRate = Number(rate) || 0; }
    setLooping(on) { this.looping = !!on; }
    setTimelineLength(len) {
      this.length = Number(len) || 0;
      if (this.position > this.timelineLength) this.position = this.timelineLength;
    }
    // TickTimeline: przesuwa pozycję, przy końcu zawija (Loop) albo zatrzymuje i wywołuje Finished.
    tick(dt) {
      if (!this.playing) return;
      const len = this.timelineLength;
      const step = dt * (this.reversed ? -this.playRate : this.playRate);
      let pos = this.position + step;
      let finished = false;
      if (step > 0 && pos > len) {
        if (this.looping) {
          this.setPosition(len, true);
          this.setPosition(0, false);
          if (len > 0) while (pos > len) pos -= len;
          else pos = 0;
        } else {
          pos = len;
          this.stop();
          finished = true;
        }
      } else if (step < 0 && pos < 0) {
        if (this.looping) {
          this.setPosition(0, true);
          this.setPosition(len, false);
          if (len > 0) while (pos < 0) pos += len;
          else pos = 0;
        } else {
          pos = 0;
          this.stop();
          finished = true;
        }
      }
      this.setPosition(pos, true);
      if (finished) this.actor.game.call(this.actor, this.cfg.finished);
    }
  }

  // Ustawienia Timeline'u z klasy aktora albo jej klas nadrzędnych (static timelines = { klucz: { … } }).
  function timelineConfigs(cls) {
    const all = {};
    for (let c = cls; c && c !== Object; c = Object.getPrototypeOf(c)) {
      if (Object.prototype.hasOwnProperty.call(c, 'timelines')) Object.entries(c.timelines).forEach(([key, cfg]) => { if (!(key in all)) all[key] = cfg; });
    }
    return all;
  }

  // Wartość zmiennej jako krótki tekst do podglądu przy breakpoincie (aktor — nazwą, tablice — kilkoma elementami).
  function debugValue(v, depth = 0) {
    if (v === null || v === undefined) return 'None';
    if (typeof v === 'number') return String(Math.round(v * 1000) / 1000);
    if (typeof v === 'string') return depth ? JSON.stringify(v) : `„${v}”`;
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (v instanceof Vec) return v.toString();
    if (v instanceof Actor) return v.dead ? `${v.name} (zniszczony)` : v.name || v.className || 'Aktor';
    if (depth > 2) return '…';
    const list = (items, open, close) => {
      const shown = items.slice(0, 10).join(', ');
      return `${open}${shown}${items.length > 10 ? `, … (${items.length})` : ''}${close}`;
    };
    if (Array.isArray(v)) return list(v.map((x) => debugValue(x, depth + 1)), '[', ']');
    if (v instanceof Set) return list([...v].map((x) => debugValue(x, depth + 1)), '{', '}');
    if (v instanceof Map) return list([...v].map(([k, x]) => `${debugValue(k, depth + 1)} → ${debugValue(x, depth + 1)}`), '{', '}');
    if (typeof v === 'object') return list(Object.keys(v).map((k) => `${k}: ${debugValue(v[k], depth + 1)}`), '{ ', ' }');
    return String(v);
  }

  // Aktor z poziomu ustawiony w zmiennej Instance Editable. W konstruktorze inni aktorzy mogą jeszcze nie
  // istnieć, więc zmienna dostaje najpierw ten znacznik, a resolveActorRefs() zamienia go na aktora.
  class ActorRef {
    constructor(id) { this.id = id; }
  }

  const images = new Map();
  function getImage(src) {
    if (!src) return null;
    let img = images.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      images.set(src, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }
  // Wywołuje fn, gdy obrazek będzie gotowy do rysowania (edytor odświeża wtedy widok).
  function whenImageReady(src, fn) {
    if (getImage(src)) return;
    images.get(src)?.addEventListener('load', fn, { once: true });
  }

  // Wzór kafelkowania obrazka, zapamiętany dla każdego płótna (tworzenie wzoru co klatkę jest kosztowne).
  const patterns = new WeakMap();
  function tilePattern(ctx, img) {
    let own = patterns.get(ctx);
    if (!own) patterns.set(ctx, (own = new WeakMap()));
    let pattern = own.get(img);
    if (!pattern) {
      pattern = ctx.createPattern(img, 'repeat');
      if (pattern) own.set(img, pattern);
    }
    return pattern;
  }

  // Rysuje wygląd aktora: { x, y, w, h, rotation, scaleX, scaleY, shape, color, emoji, text, image,
  // opacity, glow } — dwa ostatnie pochodzą z Materiału (krycie 0–1, poświata w pikselach).
  function drawShape(ctx, look) {
    const w = Number(look.w) || 1;
    const h = Number(look.h) || 1;
    ctx.save();
    ctx.translate(look.x || 0, look.y || 0);
    ctx.rotate(((look.rotation || 0) * Math.PI) / 180);
    // flipX — odbicie lustrzane (Animation Blueprint: brakujący kierunek sekwencji z Odbiciem).
    ctx.scale((look.scaleX ?? 1) * (look.flipX ? -1 : 1), look.scaleY ?? 1);
    ctx.fillStyle = look.color || '#4a90d9';
    if (look.opacity != null) ctx.globalAlpha *= Math.min(1, Math.max(0, Number(look.opacity)));
    if (look.glow > 0) {
      ctx.shadowColor = look.color || '#ffffff';
      ctx.shadowBlur = Number(look.glow);
    }
    switch (look.shape) {
      case 'circle':
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(w / 2, h / 2);
        ctx.lineTo(-w / 2, h / 2);
        ctx.closePath();
        ctx.fill();
        break;
      case 'emoji':
        ctx.font = `${Math.min(w, h) * 0.9}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(look.emoji || '🙂', 0, Math.min(w, h) * 0.06);
        break;
      case 'text': {
        const lines = String(look.text ?? '').split('\n');
        const size = Math.max(6, h / lines.length) * 0.8;
        ctx.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * size * 1.2, w));
        break;
      }
      case 'image': {
        const img = getImage(look.image);
        // Kafelkowanie: obrazek powtarza się w swoim naturalnym rozmiarze (piksel obrazka = piksel świata),
        // zamiast rozciągać się na cały kształt — np. asfalt albo trawa na dużym, przeskalowanym aktorze.
        const pattern = img && look.tile ? tilePattern(ctx, img) : null;
        if (pattern?.setTransform && typeof DOMMatrix === 'function') {
          const sx = Math.abs((look.scaleX ?? 1) * (look.parentScaleX ?? 1)) || 1;
          const sy = Math.abs((look.scaleY ?? 1) * (look.parentScaleY ?? 1)) || 1;
          pattern.setTransform(new DOMMatrix([1 / sx, 0, 0, 1 / sy, -w / 2, -h / 2]));
          ctx.fillStyle = pattern;
          ctx.fillRect(-w / 2, -h / 2, w, h);
        } else if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
        else {
          ctx.globalAlpha = 0.35;
          ctx.fillRect(-w / 2, -h / 2, w, h);
        }
        break;
      }
      // Sprite albo Animacja (Flipbook): spriteData = { fps, loop, frames: [{ src, x, y, w, h }] },
      // klatka zależy od animTime (sekundy od startu animacji).
      case 'sprite': {
        const sd = look.spriteData;
        const frames = sd?.frames ?? [];
        let i = 0;
        if (frames.length > 1 && sd.fps > 0) {
          const n = Math.floor((Number(look.animTime) || 0) * sd.fps);
          i = sd.loop ? n % frames.length : Math.min(n, frames.length - 1);
        }
        const f = frames[i];
        const img = f && getImage(f.src);
        if (img) ctx.drawImage(img, f.x, f.y, Math.max(1, f.w), Math.max(1, f.h), -w / 2, -h / 2, w, h);
        else {
          ctx.globalAlpha = 0.35;
          ctx.fillRect(-w / 2, -h / 2, w, h);
        }
        break;
      }
      case 'none':
        break;
      default:
        ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  function box(a) {
    const hw = Math.abs(a.w * a.scaleX) / 2;
    const hh = Math.abs(a.h * a.scaleY) / 2;
    return { l: a.x - hw, r: a.x + hw, t: a.y - hh, b: a.y + hh };
  }
  const intersects = (A, B) => A.r > B.l + EPS && A.l < B.r - EPS && A.b > B.t + EPS && A.t < B.b - EPS;

  // Komponenty aktora (dodawane w zakładce Viewport Blueprintu). Położenie (x, y) i obrót komponentu
  // są względem środka aktora, więc komponent przesuwa się, obraca i skaluje razem z aktorem.
  const SHAPE_PARTS = ['box', 'circle', 'triangle', 'emoji', 'text', 'image', 'sprite'];
  const COLLISION_PARTS = ['box_collision', 'circle_collision'];
  const shapeParts = (a) => (a.components || []).filter((c) => SHAPE_PARTS.includes(c.type) && c.visible !== false);

  // Rysuje aktora razem z widocznymi komponentami kształtów. Kolejność rysowania (z) komponentu
  // jest względem wyglądu aktora: ujemna — pod nim, dodatnia — nad nim.
  function drawActor(ctx, a) {
    const parts = shapeParts(a);
    if (!parts.length) {
      drawShape(ctx, a);
      return;
    }
    ctx.save();
    ctx.translate(a.x || 0, a.y || 0);
    ctx.rotate(((a.rotation || 0) * Math.PI) / 180);
    ctx.scale(a.scaleX ?? 1, a.scaleY ?? 1);
    // Wygląd aktora rysujemy w jego własnym układzie (środek w 0, 0), z wszystkimi polami wyglądu.
    const root = { ...a, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, z: 0, parentScaleX: a.scaleX ?? 1, parentScaleY: a.scaleY ?? 1 };
    // Komponent Sprite / Animacja liczy klatki od animTime aktora (Set Flipbook zaczyna ją od nowa).
    [root, ...parts.map((c) => ({ animTime: a.animTime, ...c, shape: c.type, parentScaleX: a.scaleX ?? 1, parentScaleY: a.scaleY ?? 1 }))]
      .sort((p, q) => (Number(p.z) || 0) - (Number(q.z) || 0))
      .forEach((look) => drawShape(ctx, look));
    ctx.restore();
  }

  // Promień koła wokół środka aktora, w którym mieści się wszystko, co aktor rysuje (komponenty, poświata,
  // napisy) — z zapasem. Aktor dalej niż ten promień od ekranu nie jest rysowany.
  function drawReach(a) {
    const sx = Math.abs(a.scaleX ?? 1);
    const sy = Math.abs(a.scaleY ?? 1);
    const glow = (g) => (g > 0 ? Number(g) * 2 : 0);
    // 1.25 — emoji i napisy potrafią wystawać poza swój prostokąt.
    let reach = (Math.hypot((Number(a.w) || 1) * sx, (Number(a.h) || 1) * sy) / 2) * 1.25 + glow(a.glow);
    shapeParts(a).forEach((c) => {
      const off = Math.hypot((Number(c.x) || 0) * sx, (Number(c.y) || 0) * sy);
      // Komponent obrócony wewnątrz nierówno przeskalowanego aktora rozciąga się najwyżej o większą ze skal.
      const size = (Math.hypot((Number(c.w) || 1) * Math.abs(c.scaleX ?? 1), (Number(c.h) || 1) * Math.abs(c.scaleY ?? 1)) / 2) * 1.25 * Math.max(sx, sy);
      reach = Math.max(reach, off + size + glow(c.glow));
    });
    return reach + 16;
  }

  // Prostokąt (bez obrotu) obejmujący komponent w świecie gry; koła mają też środek i promień.
  function partBox(a, c) {
    const rad = ((a.rotation || 0) * Math.PI) / 180;
    const sx = a.scaleX ?? 1;
    const sy = a.scaleY ?? 1;
    const ox = (Number(c.x) || 0) * sx;
    const oy = (Number(c.y) || 0) * sy;
    const cx = a.x + ox * Math.cos(rad) - oy * Math.sin(rad);
    const cy = a.y + ox * Math.sin(rad) + oy * Math.cos(rad);
    const hw = Math.abs((Number(c.w) || 1) * sx) / 2;
    const hh = Math.abs((Number(c.h) || 1) * sy) / 2;
    const turn = rad + ((Number(c.rotation) || 0) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(turn));
    const sin = Math.abs(Math.sin(turn));
    const round = c.type === 'circle' || c.type === 'circle_collision';
    const ex = round ? Math.hypot(hw * cos, hh * sin) : hw * cos + hh * sin;
    const ey = round ? Math.hypot(hw * sin, hh * cos) : hw * sin + hh * cos;
    const out = { l: cx - ex, r: cx + ex, t: cy - ey, b: cy + ey };
    if (round) out.circle = { x: cx, y: cy, r: (hw + hh) / 2 };
    return out;
  }

  // Wszystkie kształty kolizji aktora: jego własny prostokąt i komponenty z kolizją.
  // mode: 'block' albo 'overlap'; comp: nazwa komponentu (dla zdarzeń On Component Begin Overlap).
  // W jednej klatce silnik pyta o nie wiele razy, więc są liczone od nowa tylko wtedy, gdy zmieniło się
  // coś, od czego zależą: położenie, rozmiar, obrót, skala, rodzaj kolizji albo komponenty.
  const NO_PARTS = [];
  const PART_KEYS = ['collisionEnabled', 'collision', 'type', 'x', 'y', 'w', 'h', 'rotation', 'name'];
  function sameParts(saved, comps) {
    if (saved.length !== comps.length * PART_KEYS.length) return false;
    let i = 0;
    for (const c of comps) {
      for (const k of PART_KEYS) if (saved[i++] !== c[k]) return false;
    }
    return true;
  }
  // Prostokąt obejmujący wszystkie kształty z listy albo null, gdy lista jest pusta.
  function unionBox(list) {
    if (!list.length) return null;
    const out = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity };
    list.forEach((s) => {
      out.l = Math.min(out.l, s.l);
      out.r = Math.max(out.r, s.r);
      out.t = Math.min(out.t, s.t);
      out.b = Math.max(out.b, s.b);
    });
    return out;
  }
  function colliderCache(a) {
    const comps = a.components || NO_PARTS;
    let k = a._colliders;
    if (k && k.x === a.x && k.y === a.y && k.w === a.w && k.h === a.h && k.sx === a.scaleX && k.sy === a.scaleY && k.rot === a.rotation
      && k.mode === a.collision && k.widget === a.isWidget && k.comps === comps && sameParts(k.parts, comps)) return k;
    const list = [];
    if (a.collision !== 'none' && !a.isWidget) list.push({ ...box(a), mode: a.collision, comp: null });
    const parts = [];
    comps.forEach((c) => {
      PART_KEYS.forEach((key) => parts.push(c[key]));
      if (c.collisionEnabled === false || !c.collision || c.collision === 'none') return;
      if (!SHAPE_PARTS.includes(c.type) && !COLLISION_PARTS.includes(c.type)) return;
      list.push({ ...partBox(a, c), mode: c.collision, comp: c.name });
    });
    const block = list.filter((s) => s.mode === 'block');
    k = {
      x: a.x, y: a.y, w: a.w, h: a.h, sx: a.scaleX, sy: a.scaleY, rot: a.rotation, mode: a.collision, widget: a.isWidget, comps, parts,
      list, block, bounds: unionBox(list), blockBounds: unionBox(block), loose: block.length < list.length
    };
    a._colliders = k;
    return k;
  }
  const colliders = (a) => colliderCache(a).list;

  // Siatka przestrzenna: aktorzy zapisani w kratkach, które zajmują ich kształty kolizji. Dzięki niej aktor
  // sprawdza kolizje tylko z sąsiadami, a nie z każdym aktorem poziomu. Bardzo duzi aktorzy (np. całe
  // podłoże) i aktorzy o dziwnych wymiarach leżą na osobnej liście i są sprawdzani zawsze.
  const GRID_CELL = 128;
  const GRID_MAX_CELLS = 1024;
  const GRID_LIMIT = 1 << 20;
  // Mniej aktorów sprawdza się szybciej po kolei niż przez siatkę.
  const GRID_MIN_ACTORS = 32;
  let gridStamp = 0;
  class SpatialGrid {
    constructor() {
      this.cells = new Map();
      this.big = [];
      this.entries = new Map();
    }
    // Zakres kratek prostokąta b albo null, gdy b jest za duży albo nie ma sensownych wymiarów.
    static range(b) {
      if (!b) return null;
      const x0 = Math.floor(b.l / GRID_CELL);
      const x1 = Math.floor(b.r / GRID_CELL);
      const y0 = Math.floor(b.t / GRID_CELL);
      const y1 = Math.floor(b.b / GRID_CELL);
      if (!(x0 >= -GRID_LIMIT && x1 < GRID_LIMIT && y0 >= -GRID_LIMIT && y1 < GRID_LIMIT && x0 <= x1 && y0 <= y1)) return null;
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > GRID_MAX_CELLS) return null;
      return { x0, x1, y0, y1 };
    }
    static key(x, y) { return (x + GRID_LIMIT) * GRID_LIMIT * 2 + (y + GRID_LIMIT); }
    // index — kolejność aktora; wyniki query są w tej kolejności, żeby gra działała tak samo jak bez siatki.
    insert(actor, b, index) {
      const e = { actor, index, bounds: b, range: SpatialGrid.range(b), seen: 0 };
      this.entries.set(actor, e);
      this.place(e);
    }
    place(e) {
      const r = e.range;
      if (!r) {
        this.big.push(e);
        return;
      }
      for (let x = r.x0; x <= r.x1; x++) {
        for (let y = r.y0; y <= r.y1; y++) {
          const key = SpatialGrid.key(x, y);
          const cell = this.cells.get(key);
          if (cell) cell.push(e);
          else this.cells.set(key, [e]);
        }
      }
    }
    unplace(e) {
      const r = e.range;
      const drop = (list) => {
        const i = list.indexOf(e);
        if (i >= 0) list.splice(i, 1);
      };
      if (!r) {
        drop(this.big);
        return;
      }
      for (let x = r.x0; x <= r.x1; x++) {
        for (let y = r.y0; y <= r.y1; y++) drop(this.cells.get(SpatialGrid.key(x, y)));
      }
    }
    // Aktor zmienił kształty kolizji (b — nowy prostokąt albo null, gdy nie ma ich wcale).
    update(actor, b) {
      const e = this.entries.get(actor);
      // Ten sam obiekt z colliderCache — kształty się nie zmieniły (np. ściana, która stoi w miejscu).
      if (!e || e.bounds === b) return;
      e.bounds = b;
      const r = SpatialGrid.range(b);
      const same = r && e.range ? r.x0 === e.range.x0 && r.x1 === e.range.x1 && r.y0 === e.range.y0 && r.y1 === e.range.y1 : r === e.range;
      if (same) return;
      this.unplace(e);
      e.range = r;
      this.place(e);
    }
    // Aktorzy, których kratki stykają się z prostokątem b (zawsze z dużymi), w kolejności index.
    query(b) {
      const r = SpatialGrid.range(b);
      if (!r) return [...this.entries.values()].sort((p, q) => p.index - q.index);
      const stamp = ++gridStamp;
      const out = [];
      const add = (e) => {
        if (e.seen === stamp) return;
        e.seen = stamp;
        out.push(e);
      };
      this.big.forEach(add);
      for (let x = r.x0; x <= r.x1; x++) {
        for (let y = r.y0; y <= r.y1; y++) this.cells.get(SpatialGrid.key(x, y))?.forEach(add);
      }
      return out.sort((p, q) => p.index - q.index);
    }
  }
  const within = (inner, outer) => !!inner && inner.l >= outer.l && inner.r <= outer.r && inner.t >= outer.t && inner.b <= outer.b;

  // Dokładniejsze sprawdzenie dla nakładania: koło z kołem i koło z prostokątem.
  function touches(A, B) {
    if (!intersects(A, B)) return false;
    if (A.circle && B.circle) return Math.hypot(A.circle.x - B.circle.x, A.circle.y - B.circle.y) < A.circle.r + B.circle.r;
    const c = A.circle || B.circle;
    if (!c) return true;
    const R = A.circle ? B : A;
    return Math.hypot(c.x - Math.max(R.l, Math.min(c.x, R.r)), c.y - Math.max(R.t, Math.min(c.y, R.b))) < c.r;
  }

  // Klasa bazowa wszystkich Blueprintów. Wygenerowany kod dziedziczy po niej (class BP_X extends Actor).
  class Actor {
    constructor(game, data) {
      this.game = game;
      this.uid = ++game.uidCounter;
      this.id = data.id;
      this.name = data.name;
      this.className = data.className;
      this.shape = data.shape ?? 'box';
      this.color = data.color ?? '#4a90d9';
      this.w = Number(data.w) || 64;
      this.h = Number(data.h) || 64;
      this.emoji = data.emoji ?? '';
      this.text = data.text ?? '';
      this.image = data.image ?? null;
      this.collision = data.collision ?? 'block';
      this.gravity = !!data.gravity;
      this.moveSpeed = Number(data.moveSpeed) || 0;
      this.jumpSpeed = Number(data.jumpSpeed) || 0;
      this.z = Number(data.z) || 0;
      this.opacity = data.opacity ?? 1;
      this.glow = Number(data.glow) || 0;
      this.spriteData = data.spriteData ?? game.spriteData?.(data.sprite) ?? null;
      this.animTime = 0;
      this.x = Number(data.x) || 0;
      this.y = Number(data.y) || 0;
      this.rotation = Number(data.rotation) || 0;
      this.scaleX = data.scaleX ?? 1;
      this.scaleY = data.scaleY ?? 1;
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.visible = true;
      this.dead = false;
      this.vars = {};
      this._input = null;
      this._usedInput = false;
      this._delays = new Map();
      this._timers = new Map();
      this._flags = new Map();
      this._binds = new Map();
      this._timelines = new Map();
      this._colliders = null;
      // Animation Blueprint z Ustawień klasy (Game.create tworzy jego instancję w this.anim) i komponent, który rysuje.
      this.animBp = data.animBp ?? null;
      this.animComp = data.animComp ?? '';
      this.anim = null;
      // Każdy aktor ma własne kopie komponentów, więc Construction Script i węzły zmieniają tylko jego.
      this.components = (data.components || []).map((c) => ({
        visible: true, collisionEnabled: true, active: true, ...c,
        ...(c.type === 'sprite' && !c.spriteData ? { spriteData: game.spriteData?.(c.sprite) ?? null } : {})
      }));
    }

    get location() { return vec(this.x, this.y); }
    setLocation(v) { this.x = v.x; this.y = v.y; }
    addOffset(v) { this.game.moveActor(this, v.x, v.y); }
    setRotation(deg) { this.rotation = Number(deg) || 0; }
    addRotation(deg) { this.rotation = (this.rotation + (Number(deg) || 0)) % 360; }
    setScale(v) { this.scaleX = v.x; this.scaleY = v.y; }
    // Kierunek „przodu” aktora z jego obrotu (0° — w prawo, 90° — w dół) i kierunek na jego prawą rękę.
    get forwardVector() {
      const rad = (this.rotation * Math.PI) / 180;
      return vec(Math.cos(rad), Math.sin(rad));
    }
    get rightVector() {
      const rad = (this.rotation * Math.PI) / 180;
      return vec(-Math.sin(rad), Math.cos(rad));
    }
    get velocity() { return vec(this.vx, this.vy); }
    setVelocity(v) { this.vx = v.x; this.vy = v.y; }
    launch(v) {
      this.vx += v.x;
      this.vy += v.y;
      this.onGround = false;
    }
    addMovementInput(direction, scale = 1) {
      const add = direction.scale(Number(scale) || 0);
      this._input = this._input ? this._input.add(add) : add;
    }
    jump() {
      if (this.gravity && !this.onGround) return;
      this.vy = -this.jumpSpeed;
      this.onGround = false;
    }
    isOnGround() { return this.onGround; }
    destroy() { this.game.destroyActor(this); }
    // Wygląd aktora: sam aktor (stare projekty z kształtem w Ustawieniach klasy) albo — skoro DefaultSceneRoot
    // nie ma wyglądu — pierwszy komponent kształtu (type: tylko komponent tego rodzaju, jeśli jest).
    lookPart(type) {
      if (this.shape !== 'none') return this;
      const shapes = this.components.filter((c) => SHAPE_PARTS.includes(c.type));
      return shapes.find((c) => c.type === type) ?? shapes[0] ?? this;
    }
    setColor(color) { this.lookPart().color = String(color); }
    setText(text) { this.lookPart('text').text = String(text); }
    setVisible(visible) { this.visible = !!visible; }
    setMaterial(m) {
      if (!m) return;
      const look = this.lookPart();
      look.color = m.color;
      look.opacity = m.opacity;
      look.glow = m.glow;
    }
    // Węzeł Set Flipbook: nowy Sprite albo Animacja, animacja startuje od pierwszej klatki.
    setSprite(id) {
      const data = this.game.spriteData(id);
      if (!data) return;
      const look = this.lookPart('sprite');
      if (data !== look.spriteData) this.animTime = 0;
      look.spriteData = data;
      if (look === this) this.shape = 'sprite';
      else look.type = 'sprite';
    }
    distanceTo(other) { return other ? Math.hypot(other.x - this.x, other.y - this.y) : 0; }

    // Animation Blueprint: węzły z pinem Target działają na aktorze (jego Anim Instance) i na samej Anim Instance.
    animInstance() { return this.isAnim ? this : this.anim && !this.dead ? this.anim : null; }
    jumpToAnimNode(name) { this.animInstance()?.jumpTo(String(name)); }
    playAnimationOverride(key, rate, done) { this.animInstance()?.playOverride(key, rate, done); }
    stopAllAnimationOverrides() { this.animInstance()?.stopAllOverrides(); }
    animStateName() { return this.animInstance()?.currentStateName() ?? ''; }
    setAnimBlueprint(Cls) {
      if (this.isAnim || this.isWidget) return;
      this.anim = Cls ? this.game.createAnim(this, Cls.bpId) : null;
    }

    // Komponenty (w kodzie: this.comp("Nazwa")). Brakujący komponent zwraca pusty obiekt, żeby gra nie stanęła.
    comp(name) { return this.components.find((c) => c.name === name) || { x: 0, y: 0 }; }
    componentLocation(name) {
      const c = this.comp(name);
      return vec(c.x, c.y);
    }
    setComponentLocation(name, v) {
      const c = this.comp(name);
      c.x = v.x;
      c.y = v.y;
    }
    setComponentSize(name, v) {
      const c = this.comp(name);
      c.w = Math.max(1, Number(v.x) || 1);
      c.h = Math.max(1, Number(v.y) || 1);
    }
    // Włączony komponent Pocisk od razu dostaje swoją prędkość.
    setComponentActive(name, active) {
      const c = this.comp(name);
      const was = c.active;
      c.active = !!active;
      if (c.type === 'projectile' && c.active && !was) this.launch(vec(c.vx, c.vy));
    }

    callEvent(name, ...args) {
      const method = 'ev_' + ident(name);
      if (typeof this[method] === 'function') this.game.call(this, method, ...args);
      else this.game.reportError(new Error(`Brak zdarzenia „${name}” w ${this.className}`), this, 'callEvent');
    }

    // Event Dispatchery: pod kluczem dispatchera lista podpiętych zdarzeń { actor, method }.
    // delegate() to pin Delegate zdarzenia własnego — to samo zdarzenie tego samego aktora podpina się tylko raz.
    delegate(name) { return { actor: this, method: 'ev_' + ident(name) }; }
    bindEvent(key, d) {
      if (!d?.actor) return;
      const list = this._binds.get(key) ?? [];
      if (!list.some((b) => b.actor === d.actor && b.method === d.method)) list.push(d);
      this._binds.set(key, list);
    }
    unbindEvent(key, d) {
      const list = this._binds.get(key);
      if (list && d) this._binds.set(key, list.filter((b) => b.actor !== d.actor || b.method !== d.method));
    }
    unbindAllEvents(key) { this._binds.delete(key); }
    // Kopia listy — zdarzenie może w trakcie odpiąć siebie albo inne. Zniszczeni aktorzy wypadają z listy.
    dispatch(key, ...args) {
      const list = (this._binds.get(key) ?? []).filter((b) => !b.actor.dead);
      this._binds.set(key, list);
      list.slice().forEach((b) => this.game.call(b.actor, b.method, ...args));
    }

    // Węzeł Delay: drugie wywołanie w trakcie odliczania jest pomijane (tak jak w Unreal Engine).
    delay(key, seconds, fn) {
      if (!this._delays.has(key)) this._delays.set(key, { at: this.game.time + (Number(seconds) || 0), fn });
    }
    doOnce(key) {
      if (this._flags.get(key)) return false;
      this._flags.set(key, true);
      return true;
    }
    flipFlop(key) {
      const isA = !this._flags.get(key);
      this._flags.set(key, isA);
      return isA;
    }
    flipState(key) { return !!this._flags.get(key); }
    setTimer(name, seconds, looping) {
      const every = Math.max(0.01, Number(seconds) || 0);
      this._timers.set(String(name), { at: this.game.time + every, every, looping: !!looping });
    }
    clearTimer(name) { this._timers.delete(String(name)); }
    // Węzeł Timeline: stan tworzy się przy pierwszym użyciu (albo w pierwszej klatce, gdy ma AutoPlay).
    timeline(key) {
      let tl = this._timelines.get(key);
      if (!tl) {
        tl = new Timeline(this, timelineConfigs(this.constructor)[key] ?? { tracks: [] });
        this._timelines.set(key, tl);
      }
      return tl;
    }
    toString() { return this.name; }
  }

  // Klasa bazowa Widget Blueprintów: interfejs rysowany na ekranie (nie w świecie gry) z elementów
  // z Projektanta — teksty, przyciski, prostokąty. Działa jak aktor bez wyglądu i kolizji, więc ma
  // zdarzenia, zmienne i timery. Na ekranie jest dopiero po Add to Viewport.
  class Widget extends Actor {
    constructor(game, data) {
      super(game, { ...data, shape: 'none', collision: 'none', gravity: false });
      this.isWidget = true;
      this.inViewport = false;
      this.elements = (data.widget?.elements || []).map((el) => ({ ...el }));
    }
    addToViewport() {
      if (this.dead || this.inViewport) return;
      this.inViewport = true;
      this.game.widgets.push(this);
    }
    removeFromParent() {
      this.inViewport = false;
      this.game.widgets = this.game.widgets.filter((w) => w !== this);
    }
    element(name) { return this.elements.find((el) => el.name === String(name)) || null; }
    setWidgetText(name, text) {
      const el = this.element(name);
      if (el) el.text = String(text);
      else this.game.reportError(new Error(`Brak elementu „${name}” w ${this.className}`), this, 'setWidgetText');
    }
    setWidgetVisible(name, visible) {
      const el = this.element(name);
      if (el) el.hidden = !visible;
    }
    // Zagnieżdżony widget (element „Widget” z Projektanta) — jego instancja albo null.
    childWidget(name) { return this.element(name)?.child ?? null; }
    // Przycisk pod punktem ekranu: { owner, el } — owner to widget, do którego przycisk należy
    // (także zagnieżdżony, wtedy jego elementy są przesunięte o x, y elementu „Widget”).
    buttonAt(sx, sy) {
      for (const el of [...this.elements].reverse()) {
        if (el.hidden) continue;
        if (el.type === 'widget') {
          const hit = el.child && el.child.visible && !el.child.dead && el.child.buttonAt(sx - el.x, sy - el.y);
          if (hit) return hit;
        } else if (el.type === 'button' && sx >= el.x && sx <= el.x + el.w && sy >= el.y && sy <= el.y + el.h) return { owner: this, el };
      }
      return null;
    }
  }

  // Rysuje elementy widgetu w układzie ekranu gry (x, y to lewy górny róg elementu).
  // kids(el) zwraca elementy zagnieżdżonego widgetu: w grze — jego instancji, w edytorze — jego klasy.
  // ---------- Animacje postaci (jak plugin Paper ZD do Unreal Engine) ----------
  // Anim Source to zestaw sekwencji: project.animSequences = { "idSource:idSekwencji": { name, dirs, frames, mirror, notifies } }.
  // Sekwencja kierunkowa ma Flipbook na każdy kierunek (frames): 1, 2 (prawo, lewo), 4 (prawo, dół, lewo, góra)
  // albo 8 (co 45°, od prawej zgodnie ze wskazówkami zegara). Kąt kierunku w stopniach: 0 — w prawo, 90 — w dół.
  // Mirror: brakujący kierunek bierze Flipbook z lustrzanej strony (lewo ↔ prawo) i rysuje go odbitego.
  const ANIM_MIRROR = { 2: [1, 0], 4: [2, 1, 0, 3], 8: [4, 3, 2, 1, 0, 7, 6, 5] };
  function animSlot(dirs, angle) {
    if (dirs <= 1) return 0;
    const a = ((Number(angle) % 360) + 360) % 360;
    if (dirs === 2) return a > 90 && a < 270 ? 1 : 0;
    return Math.round(a / (360 / dirs)) % dirs;
  }
  const ANIM_OPS = {
    '==': (a, b) => a === b, '!=': (a, b) => a !== b, '>': (a, b) => a > b, '<': (a, b) => a < b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b
  };
  const animCompare = (a, op, b) => (ANIM_OPS[op] ?? ANIM_OPS['=='])(Number(a) || 0, Number(b) || 0);

  // Klasa bazowa Animation Blueprintów (Anim Instance). Każdy aktor z Animation Blueprintem w Ustawieniach klasy
  // ma własną instancję (actor.anim). Nie stoi na poziomie: nie rysuje się i nie ma kolizji, ale ma zmienne,
  // zdarzenia i timery. Co klatkę (po fizyce): Event Blueprint Update Animation, przejścia maszyny stanów,
  // odtwarzanie sekwencji (z notify) i ustawienie Flipbooka na komponencie Sprite właściciela.
  // static animGraph = { entry, states: [{ id, name, seq, loop, rate, rateVar, dir, dirVar, enter, exit }],
  // transitions: [{ id, from, to, auto, conds: [{ v, op, value }] }], jumps: { nazwa: idStanu } }.
  class AnimInstance extends Actor {
    constructor(game, data) {
      super(game, { ...data, shape: 'none', collision: 'none', gravity: false, components: [] });
      this.isAnim = true;
      this.owner = data.owner ?? null;
      this.graph = this.constructor.animGraph ?? { entry: null, states: [], transitions: [], jumps: {} };
      // Kierunek z prędkości właściciela: pełny kąt (start — w dół, przodem do gracza) i strona (0 — prawo, 180 — lewo).
      this.velAngle = 90;
      this.side = 0;
      this.state = null;
      this.play = null;
      this.override = null;
      this.started = false;
      this.lastTransition = null;
      this.enterState(this.graph.entry, false);
      this.applyPose();
    }
    tryGetPawnOwner() { return this.owner && !this.owner.dead ? this.owner : null; }
    currentStateName() { return this.state?.name ?? ''; }
    stateById(id) { return this.graph.states.find((s) => s.id === id) ?? null; }
    newPlay(key, loop) { return { key, loop, time: 0, fired: -1, done: false, sd: null, flip: false }; }
    // fire — notify wyjścia ze starego stanu i wejścia do nowego (bez nich przy tworzeniu instancji).
    enterState(id, fire = true) {
      const next = this.stateById(id);
      if (!next) return;
      if (fire && this.state?.exit) this.notify(this.state.exit);
      this.state = next;
      this.play = this.newPlay(next.seq, next.loop !== false);
      if (fire && next.enter) this.notify(next.enter);
    }
    // Jump Node: nazwany punkt wejścia — maszyna stanów od razu przechodzi do jego stanu, z dowolnego miejsca.
    jumpTo(name) {
      const id = this.graph.jumps?.[name];
      if (!id) {
        this.game.reportError(new Error(`Brak Jump Node „${name}”`), this, 'jumpToNode');
        return;
      }
      this.enterState(id);
      this.lastTransition = { jump: name, at: this.game.time };
    }
    // Animation Override: jednorazowa sekwencja, która przykrywa maszynę stanów (ta dalej działa pod spodem).
    playOverride(key, rate, done) {
      if (!this.game.project.animSequences?.[key]) {
        this.game.reportError(new Error('Sekwencja animacji nie istnieje (usunięta z Anim Source?)'), this, 'playAnimationOverride');
        return;
      }
      this.override = { ...this.newPlay(key, false), rate: Number(rate) || 1, onDone: done ?? null };
    }
    stopAllOverrides() { this.override = null; }
    // Notify z nazwą: zdarzenie AnimNotify w Animation Blueprincie i u właściciela.
    notify(name) {
      const method = 'onNotify_' + ident(name);
      this.game.call(this, method);
      if (this.tryGetPawnOwner()) this.game.call(this.owner, method);
    }
    fireNotify(nf) {
      if (nf.sound) this.game.playSound(nf.sound);
      if (nf.name) this.notify(nf.name);
    }
    // Kąt kierunku dla sekwencji o dirs kierunkach — ze zmiennej, stały albo z prędkości właściciela.
    facing(dirs) {
      const s = this.state;
      if (s?.dir === 'var') return Number(this.vars[s.dirVar]) || 0;
      if (s?.dir === 'none') return 0;
      return dirs === 2 ? this.side : this.velAngle;
    }
    resolve(play) {
      const seq = this.game.project.animSequences?.[play.key];
      if (!seq) return null;
      const dirs = Number(seq.dirs) || 1;
      let slot = animSlot(dirs, this.facing(dirs));
      let flip = false;
      if (!seq.frames[slot] && seq.mirror && ANIM_MIRROR[dirs]) {
        slot = ANIM_MIRROR[dirs][slot];
        flip = !!seq.frames[slot];
      }
      const id = seq.frames[slot] ?? seq.frames.find(Boolean);
      return { seq, sd: id ? this.game.animSprite(id, play.loop) : null, flip };
    }
    // Przesuwa czas sekwencji i wysyła notify z klatek, przez które przeszła (także po zapętleniu).
    advance(play, dt, rate) {
      const r = this.resolve(play);
      play.sd = r?.sd ?? null;
      play.flip = !!r?.flip;
      play.time += dt * Math.max(0, Number(rate) || 0);
      const len = play.sd?.frames.length ?? 0;
      const fps = Number(play.sd?.fps) || 0;
      if (!len || fps <= 0) {
        play.done = true;
        return;
      }
      const n = Math.floor(play.time * fps + 1e-9);
      for (let k = play.fired + 1; k <= n && (play.loop || k < len); k++) {
        (r.seq.notifies ?? []).forEach((nf) => {
          if (nf.frame === k % len) this.fireNotify(nf);
        });
      }
      play.fired = Math.max(play.fired, n);
      play.done = n >= len;
    }
    rateOf(s) {
      const rate = Number(s?.rate ?? 1);
      return s?.rateVar ? rate * (Number(this.vars[s.rateVar]) || 0) : rate;
    }
    tickAnim(dt) {
      if (!this.started) {
        this.started = true;
        this.game.call(this, 'animInit');
      }
      this.game.runTimers(this, dt);
      this.game.call(this, 'animUpdate', dt);
      const o = this.tryGetPawnOwner();
      if (o && Math.hypot(o.vx, o.vy) > 5) this.velAngle = (Math.atan2(o.vy, o.vx) * 180) / Math.PI;
      if (o && Math.abs(o.vx) > 5) this.side = o.vx < 0 ? 180 : 0;
      // Przejścia z obecnego stanu po kolei: pierwsze spełnione wygrywa (najwyżej jedno na klatkę).
      // Automatyczne czeka na koniec sekwencji stanu; przejście bez warunków i bez „Automatyczne” nigdy nie działa.
      const from = this.state;
      if (from) {
        for (const t of this.graph.transitions) {
          if (t.from !== from.id || (t.auto && !this.play?.done) || (!t.auto && !t.conds.length)) continue;
          if (!t.conds.every((c) => animCompare(this.vars[c.v], c.op, c.value))) continue;
          this.enterState(t.to);
          this.lastTransition = { id: t.id, at: this.game.time };
          break;
        }
      }
      if (this.play) this.advance(this.play, this.state === from ? dt : 0, this.rateOf(this.state));
      const ov = this.override;
      if (ov) {
        this.advance(ov, dt, ov.rate);
        if (ov.done && this.override === ov) {
          this.override = null;
          if (ov.onDone) {
            try {
              ov.onDone();
            } catch (err) {
              this.game.reportError(err, this, 'playAnimationOverride');
            }
          }
        }
      }
      this.applyPose();
    }
    // Komponent, który pokazuje animację: wybrany w Ustawieniach klasy, pierwszy Sprite albo wygląd aktora.
    renderTarget() {
      const o = this.owner;
      return (o.animComp && o.components.find((c) => c.name === o.animComp)) || o.components.find((c) => c.type === 'sprite') || o.lookPart('sprite');
    }
    applyPose() {
      const o = this.owner;
      const p = this.override?.sd ? this.override : this.play;
      if (!o || !p) return;
      if (!p.sd) {
        const r = this.resolve(p);
        p.sd = r?.sd ?? null;
        p.flip = !!r?.flip;
      }
      if (!p.sd) return;
      const look = this.renderTarget();
      look.spriteData = p.sd;
      look.animTime = p.time;
      look.flipX = p.flip;
      if (look === o) o.shape = 'sprite';
      else look.type = 'sprite';
    }
  }

  const widgetKids = (el) => (el.child && el.child.visible && !el.child.dead ? el.child.elements : null);
  function drawWidget(ctx, elements, kids = widgetKids, depth = 0) {
    elements.forEach((el) => {
      if (el.hidden) return;
      if (el.type === 'widget') {
        const inner = depth < 8 && kids(el);
        if (!inner) return;
        ctx.save();
        ctx.translate(Number(el.x) || 0, Number(el.y) || 0);
        drawWidget(ctx, inner, kids, depth + 1);
        ctx.restore();
        return;
      }
      const w = Number(el.w) || 1;
      const h = Number(el.h) || 1;
      ctx.save();
      if (el.type === 'box' || el.type === 'button') {
        ctx.fillStyle = el.bg || '#2a6fd6';
        ctx.beginPath();
        const r = el.type === 'button' ? Math.min(10, h / 2) : 0;
        if (ctx.roundRect) ctx.roundRect(el.x, el.y, w, h, r);
        else ctx.rect(el.x, el.y, w, h);
        ctx.fill();
      }
      if (el.type === 'text' || el.type === 'button') {
        const size = Number(el.size) || 20;
        const align = el.type === 'button' ? 'center' : el.align || 'left';
        ctx.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = el.color || '#ffffff';
        ctx.lineWidth = Math.max(2, size / 6);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        const tx = align === 'center' ? el.x + w / 2 : align === 'right' ? el.x + w : el.x;
        const lines = String(el.text ?? '').split('\n');
        lines.forEach((line, i) => {
          const ty = el.y + h / 2 + (i - (lines.length - 1) / 2) * size * 1.2;
          if (el.type === 'text') ctx.strokeText(line, tx, ty, w);
          ctx.fillText(line, tx, ty, w);
        });
      }
      ctx.restore();
    });
  }

  // ---------- Widok 3D (raycasting, jak w Wolfenstein 3D) ----------
  //
  // Poziom dalej jest płaską mapą widzianą z góry, ale ekran pokazuje go oczami aktora, za którym idzie
  // kamera (zwykle Default Pawn), patrzącego w stronę swojego obrotu. Ściany to aktorzy z kolizją „Blokuje”
  // i kształtem prostokąta, obrazka albo sprite'a — mają wysokość wallHeight z Ustawień świata. Pozostali
  // widoczni aktorzy to płaskie obrazki zawsze zwrócone do gracza (jak przeciwnicy i przedmioty w Wolfensteinie).
  // Wygląd ściany: jej komponent Prostokąt albo Obrazek (wszystkie widoczne kształty aktora muszą być takie),
  // a w starszych projektach — sam aktor z kształtem prostokąta, obrazka albo sprite'a. null — to nie ściana.
  function wallLook(a) {
    if (a.collision !== 'block') return null;
    const parts = shapeParts(a);
    if (!parts.length) return ['box', 'image', 'sprite'].includes(a.shape) ? a : null;
    if (a.shape !== 'none' || !parts.every((c) => c.type === 'box' || c.type === 'image')) return null;
    return { ...parts[0], shape: parts[0].type };
  }
  const isWall = (a) => !!wallLook(a);

  // Odległość wzdłuż promienia (ox, oy) + t·(dx, dy) do prostokąta b albo −1, gdy promień go nie trafia.
  // Strona trafienia trafia do raySide: 0 — ściana pionowa na mapie, 1 — pozioma (bez tworzenia obiektów,
  // bo promieni jest kilkaset na klatkę).
  let raySide = 0;
  function rayBox(ox, oy, dx, dy, b) {
    let tmin = -Infinity;
    let tmax = Infinity;
    let side = 0;
    if (dx) {
      const t1 = (b.l - ox) / dx;
      const t2 = (b.r - ox) / dx;
      tmin = Math.min(t1, t2);
      tmax = Math.max(t1, t2);
    } else if (ox <= b.l || ox >= b.r) return -1;
    if (dy) {
      const t1 = (b.t - oy) / dy;
      const t2 = (b.b - oy) / dy;
      if (Math.min(t1, t2) > tmin) {
        tmin = Math.min(t1, t2);
        side = 1;
      }
      tmax = Math.min(tmax, Math.max(t1, t2));
    } else if (oy <= b.t || oy >= b.b) return -1;
    // Oko w środku ściany (np. drzwi, które właśnie znikają) — tej ściany nie widać.
    if (tmin < 0 || tmax < tmin) return -1;
    raySide = side;
    return tmin;
  }

  // Najbliższa ściana na promieniu: { index, t, side } albo null. Przy remisie wygrywa ściana wcześniejsza
  // na liście. Przy wielu ścianach promień idzie kratka po kratce przez siatkę (DDA, jak w Wolfensteinie)
  // i sprawdza tylko ściany z kratek, przez które przechodzi.
  const RAY_GRID_MIN = 24;
  function wallCaster(walls) {
    const hit = { index: -1, t: 0, side: 0 };
    const test = (k, ox, oy, dx, dy) => {
      const t = rayBox(ox, oy, dx, dy, walls[k].b);
      if (t < 0 || (hit.index >= 0 && (t > hit.t || (t === hit.t && k > hit.index)))) return;
      hit.index = k;
      hit.t = t;
      hit.side = raySide;
    };
    const all = (ox, oy, dx, dy) => {
      hit.index = -1;
      for (let k = 0; k < walls.length; k++) test(k, ox, oy, dx, dy);
      return hit.index >= 0 ? hit : null;
    };
    if (walls.length < RAY_GRID_MIN) return all;
    const area = unionBox(walls.map((w) => w.b));
    if (![area.l, area.r, area.t, area.b].every(Number.isFinite)) return all;
    const W = area.r - area.l;
    const H = area.b - area.t;
    const avg = walls.reduce((sum, w) => sum + (w.b.r - w.b.l + w.b.b - w.b.t) / 2, 0) / walls.length;
    const cell = Math.max(16, Math.min(1024, avg), Math.sqrt((W * H) / 65536));
    const nx = Math.floor(W / cell) + 1;
    const ny = Math.floor(H / cell) + 1;
    const cells = new Array(nx * ny);
    // Ściana trafia też do kratek, o które ledwo zahacza, żeby trafienie na granicy kratek nie umknęło.
    const near = 1e-3;
    const cx = (x) => Math.min(nx - 1, Math.max(0, Math.floor((x - area.l) / cell)));
    const cy = (y) => Math.min(ny - 1, Math.max(0, Math.floor((y - area.t) / cell)));
    walls.forEach((w, k) => {
      for (let x = cx(w.b.l - near); x <= cx(w.b.r + near); x++) {
        for (let y = cy(w.b.t - near); y <= cy(w.b.b + near); y++) {
          const i = y * nx + x;
          if (cells[i]) cells[i].push(k);
          else cells[i] = [k];
        }
      }
    });
    const seen = new Int32Array(walls.length);
    let ray = 0;
    return (ox, oy, dx, dy) => {
      if (!Number.isFinite(ox) || !Number.isFinite(oy)) return all(ox, oy, dx, dy);
      hit.index = -1;
      ray++;
      // Wejście promienia w obszar ścian (oko może stać poza nim).
      let t0 = 0;
      let t1 = Infinity;
      if (dx) {
        const a = (area.l - ox) / dx;
        const b = (area.r - ox) / dx;
        t0 = Math.max(t0, Math.min(a, b));
        t1 = Math.min(t1, Math.max(a, b));
      } else if (ox < area.l || ox > area.r) return null;
      if (dy) {
        const a = (area.t - oy) / dy;
        const b = (area.b - oy) / dy;
        t0 = Math.max(t0, Math.min(a, b));
        t1 = Math.min(t1, Math.max(a, b));
      } else if (oy < area.t || oy > area.b) return null;
      if (t1 < t0) return null;
      let x = cx(ox + dx * t0);
      let y = cy(oy + dy * t0);
      const sx = dx > 0 ? 1 : -1;
      const sy = dy > 0 ? 1 : -1;
      let nextX = dx ? (area.l + (x + (dx > 0 ? 1 : 0)) * cell - ox) / dx : Infinity;
      let nextY = dy ? (area.t + (y + (dy > 0 ? 1 : 0)) * cell - oy) / dy : Infinity;
      const stepX = dx ? cell / Math.abs(dx) : Infinity;
      const stepY = dy ? cell / Math.abs(dy) : Infinity;
      for (;;) {
        const list = cells[y * nx + x];
        if (list) {
          for (const k of list) {
            if (seen[k] === ray) continue;
            seen[k] = ray;
            test(k, ox, oy, dx, dy);
          }
        }
        // Trafienie wyraźnie przed wyjściem z kratki — dalsze ściany nie mogą być bliżej.
        const exit = Math.min(nextX, nextY);
        if (hit.index >= 0 && hit.t < exit - 1e-6 * (1 + exit)) break;
        if (nextX < nextY) {
          x += sx;
          if (x < 0 || x >= nx) break;
          nextX += stepX;
        } else {
          y += sy;
          if (y < 0 || y >= ny) break;
          nextY += stepY;
        }
      }
      return hit.index >= 0 ? hit : null;
    };
  }

  // Obrazek ściany (kształt Obrazek albo Sprite / Animacja): { img, sx, sy, sw, sh } albo null.
  function wallTexture(a) {
    if (a.shape === 'image') {
      const img = getImage(a.image);
      return img ? { img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight } : null;
    }
    const sd = a.spriteData;
    const frames = sd?.frames ?? [];
    if (a.shape !== 'sprite' || !frames.length) return null;
    const n = Math.floor((Number(a.animTime) || 0) * (sd.fps || 0));
    const f = frames[frames.length > 1 && sd.fps > 0 ? (sd.loop ? n % frames.length : Math.min(n, frames.length - 1)) : 0];
    const img = getImage(f.src);
    return img ? { img, sx: f.x, sy: f.y, sw: Math.max(1, f.w), sh: Math.max(1, f.h) } : null;
  }

  const SOUNDS = {
    coin: [['square', 988, 988, 0, 0.08], ['square', 1319, 1319, 0.08, 0.22]],
    jump: [['square', 300, 720, 0, 0.16]],
    hit: [['sawtooth', 220, 60, 0, 0.25]],
    blip: [['sine', 660, 660, 0, 0.08]],
    win: [['square', 523, 523, 0, 0.12], ['square', 659, 659, 0.12, 0.12], ['square', 784, 784, 0.24, 0.12], ['square', 1047, 1047, 0.36, 0.3]],
    lose: [['triangle', 392, 392, 0, 0.2], ['triangle', 262, 196, 0.2, 0.4]],
    explosion: 'noise'
  };

  // Krótkie dźwięki z plików (strzał, moneta) są dekodowane raz do Web Audio, a nie przy każdym odtworzeniu.
  // Pierwsze odtworzenie i długie pliki (np. muzyka, której nie warto trzymać rozpakowanej) grają przez <audio>.
  const BUFFER_MAX_SRC = 400000;
  const buffers = new Map(); // src → AudioBuffer, null (trwa dekodowanie) albo false (nie da się)
  function decodeLater(ac, src) {
    if (buffers.has(src) || src.length > BUFFER_MAX_SRC) return;
    const comma = src.indexOf(',');
    if (!src.startsWith('data:') || !src.slice(0, comma).endsWith(';base64')) return;
    buffers.set(src, null);
    try {
      const bin = atob(src.slice(comma + 1));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      ac.decodeAudioData(bytes.buffer).then((buf) => buffers.set(src, buf), () => buffers.set(src, false));
    } catch {
      buffers.set(src, false);
    }
  }

  // Odtwarza dźwięk { src, preset, volume }: plik (src, np. data:audio/mpeg) albo wbudowany preset.
  // holder (gra albo edytor) trzyma AudioContext i grające pliki, żeby dało się je zatrzymać.
  function playSoundData(holder, sound) {
    const volume = Math.min(1, Math.max(0, Number(sound?.volume ?? 1)));
    try {
      if (sound?.src) {
        holder.playingAudio = holder.playingAudio || new Set();
        const ac = holder.audio || (window.AudioContext || window.webkitAudioContext ? (holder.audio = new (window.AudioContext || window.webkitAudioContext)()) : null);
        if (ac?.state === 'suspended') ac.resume();
        const buffer = buffers.get(sound.src);
        if (buffer && ac.state === 'running') {
          const src = ac.createBufferSource();
          const gain = ac.createGain();
          gain.gain.value = volume;
          src.buffer = buffer;
          src.connect(gain).connect(ac.destination);
          const playing = {
            pause: () => {
              try {
                src.stop();
              } catch {
                // Już skończył grać.
              }
            }
          };
          holder.playingAudio.add(playing);
          src.onended = () => holder.playingAudio.delete(playing);
          src.start();
          return;
        }
        if (ac) decodeLater(ac, sound.src);
        const audio = new Audio(sound.src);
        audio.volume = volume;
        holder.playingAudio.add(audio);
        audio.addEventListener('ended', () => holder.playingAudio.delete(audio), { once: true });
        audio.play().catch(() => holder.playingAudio.delete(audio));
        return;
      }
      const preset = SOUNDS[sound?.preset];
      if (!preset) return;
      holder.audio = holder.audio || new (window.AudioContext || window.webkitAudioContext)();
      const ac = holder.audio;
      if (ac.state === 'suspended') ac.resume();
      const now = ac.currentTime;
      if (preset === 'noise') {
        // Szum wybuchu liczony raz na AudioContext.
        if (holder.noise?.ac !== ac) {
          const len = Math.floor(ac.sampleRate * 0.5);
          const buffer = ac.createBuffer(1, len, ac.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
          holder.noise = { ac, buffer };
        }
        const src = ac.createBufferSource();
        const gain = ac.createGain();
        gain.gain.value = 0.35 * volume;
        src.buffer = holder.noise.buffer;
        src.connect(gain).connect(ac.destination);
        src.start(now);
        return;
      }
      preset.forEach(([type, from, to, start, dur]) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, now + start);
        osc.frequency.exponentialRampToValueAtTime(to, now + start + dur);
        gain.gain.setValueAtTime(Math.max(0.0011, 0.12 * volume), now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(gain).connect(ac.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
      });
    } catch {
      // Bez dźwięku, jeśli przeglądarka go nie obsługuje.
    }
  }

  function stopSounds(holder) {
    holder.playingAudio?.forEach((audio) => audio.pause());
    holder.playingAudio?.clear();
  }

  // ---------- Enhanced Input (jak w Unreal Engine 5) ----------
  //
  // Input Action (IA_) to „co gracz chce zrobić” (Skok, Ruch) z typem wartości: bool, axis1d albo axis2d.
  // Input Mapping Context (IMC_) to lista mapowań klawisz → akcja; każde mapowanie ma własne Modyfikatory
  // (zmieniają wartość klawisza, np. Negate) i Triggery (decydują, kiedy akcja zadziała, np. Hold).
  // Aktywne konteksty mają priorytet: klawisz użyty w kontekście o wyższym priorytecie nie trafia do niższych.
  // data: { actions: { nazwa: { valueType, accumulate, consume, whenPaused, triggers, modifiers } },
  //         contexts: { nazwa: { mappings: [{ action, key, triggers, modifiers }] } } }

  // Stan triggera: 0 — None, 1 — Ongoing (trwa, np. trzymanie przed czasem Hold), 2 — Triggered.
  const NONE = 0;
  const ONGOING = 1;
  const TRIGGERED = 2;
  const IMPLICIT_TRIGGERS = ['chord'];
  const magnitude = (v, type) => (type === 'axis2d' ? v.length() : Math.abs(v.x));
  // Wartość klawisza zamieniona na typ akcji: bool i axis1d biorą tylko X (bool — 1 albo 0).
  function castValue(v, type) {
    if (type === 'axis2d') return v;
    if (type === 'axis1d') return vec(v.x, 0);
    return vec(v.length() > 0 ? 1 : 0, 0);
  }

  function modify(list, v, type) {
    (list || []).forEach((m) => {
      switch (m.type) {
        case 'negate':
          v = vec(m.x === false ? v.x : -v.x, m.y === false ? v.y : -v.y);
          break;
        case 'swizzle':
          v = vec(v.y, v.x);
          break;
        case 'scalar':
          v = vec(v.x * (Number(m.x ?? 1) || 0), v.y * (Number(m.y ?? 1) || 0));
          break;
        case 'deadzone': {
          // Wszystko poniżej Lower to zero, a reszta jest przeliczona z [Lower, Upper] na [0, 1].
          const lo = Number(m.lower ?? 0.2) || 0;
          const hi = Math.max(lo + 0.001, Number(m.upper ?? 1) || 1);
          const len = magnitude(v, type === 'axis2d' ? 'axis2d' : 'axis1d');
          const k = len <= lo ? 0 : Math.min(1, (len - lo) / (hi - lo)) / len;
          v = v.scale(k);
          break;
        }
        default:
      }
    });
    return v;
  }

  class EnhancedInput {
    constructor(data) {
      this.actions = data?.actions || {};
      this.contexts = data?.contexts || {};
      this.active = [];
      this.states = new Map();
      this.trigStates = new Map();
    }

    addContext(name, priority = 0) {
      if (!this.contexts[name]) return;
      this.active = this.active.filter((c) => c.name !== name);
      this.active.push({ name, priority: Number(priority) || 0 });
      this.active.sort((a, b) => b.priority - a.priority);
    }
    removeContext(name) { this.active = this.active.filter((c) => c.name !== name); }
    clear() {
      this.active = [];
      this.trigStates.clear();
    }
    hasContext(name) { return this.active.some((c) => c.name === name); }

    state(name) {
      let s = this.states.get(name);
      if (!s) {
        s = { state: NONE, value: vec(), elapsed: 0, triggered: 0 };
        this.states.set(name, s);
      }
      return s;
    }

    // Wartość akcji dla węzła „Get Action Value”: bool, liczba albo wektor — zależnie od typu akcji.
    value(name) {
      const type = this.actions[name]?.valueType || 'bool';
      const v = this.states.get(name)?.value || vec();
      if (type === 'bool') return v.x > 0;
      if (type === 'axis1d') return v.x;
      return vec(v.x, v.y);
    }

    // Jeden trigger dla wartości v; s to jego zapamiętany stan (czas trzymania, poprzednia klatka…).
    trigger(t, s, v, dt, type, chord) {
      const on = magnitude(v, type) >= (Number(t.threshold ?? 0.5) || 0.001);
      const was = !!s.on;
      s.on = on;
      switch (t.type) {
        case 'pressed': return on && !was ? TRIGGERED : NONE;
        case 'released': return on ? ONGOING : was ? TRIGGERED : NONE;
        case 'hold': {
          if (!on) {
            s.time = 0;
            s.fired = false;
            return NONE;
          }
          s.time = (was ? s.time : 0) + dt;
          if (s.time < (Number(t.holdTime ?? 0.5) || 0)) return ONGOING;
          if (t.oneShot && s.fired) return NONE;
          s.fired = true;
          return TRIGGERED;
        }
        case 'hold_release':
          if (on) {
            s.time = (was ? s.time : 0) + dt;
            return ONGOING;
          }
          return was && s.time >= (Number(t.holdTime ?? 0.5) || 0) ? TRIGGERED : NONE;
        case 'tap':
          if (on) {
            s.time = (was ? s.time : 0) + dt;
            return s.time > (Number(t.tapTime ?? 0.2) || 0) ? NONE : ONGOING;
          }
          return was && s.time <= (Number(t.tapTime ?? 0.2) || 0) ? TRIGGERED : NONE;
        case 'pulse': {
          if (!on) return NONE;
          const limit = Math.trunc(Number(t.limit) || 0);
          if (!was) {
            s.time = 0;
            s.count = 0;
            if (t.onStart === false) return ONGOING;
            s.count = 1;
            return TRIGGERED;
          }
          if (limit > 0 && s.count >= limit) return NONE;
          s.time += dt;
          if (s.time < (Number(t.interval ?? 1) || 0.01)) return ONGOING;
          s.time = 0;
          s.count++;
          return TRIGGERED;
        }
        case 'chord': return chord(t.action) === TRIGGERED ? TRIGGERED : NONE;
        default: return on ? TRIGGERED : NONE;
      }
    }

    // Lista triggerów jak w Unreal Engine: jawne (Pressed, Hold…) — wystarczy jeden spełniony,
    // niejawne (Chorded Action) — muszą być spełnione wszystkie. null, gdy lista jest pusta.
    triggers(key, list, v, dt, type, chord) {
      if (!list?.length) return null;
      let explicit = -1;
      let implicit = -1;
      list.forEach((t, i) => {
        const id = key + ':' + i;
        if (!this.trigStates.has(id)) this.trigStates.set(id, {});
        const st = this.trigger(t, this.trigStates.get(id), v, dt, type, chord);
        if (IMPLICIT_TRIGGERS.includes(t.type)) implicit = implicit < 0 ? st : Math.min(implicit, st);
        else explicit = Math.max(explicit, st);
      });
      if (implicit < 0) return explicit;
      return explicit < 0 ? implicit : Math.min(explicit, implicit);
    }

    // Jedna klatka: read(klawisz) zwraca wektor wartości klawisza. Zwraca zdarzenia
    // [{ action, event: 'Started' | 'Ongoing' | 'Triggered' | 'Completed' | 'Canceled', value, elapsed, triggered }].
    update(dt, read) {
      const found = new Map();
      const consumed = new Set();
      const chord = (name) => found.get(name)?.state ?? this.states.get(name)?.state ?? NONE;
      this.active.forEach(({ name: ctx }) => {
        const used = [];
        (this.contexts[ctx]?.mappings || []).forEach((m, i) => {
          const action = this.actions[m.action];
          if (!action || !m.key || consumed.has(m.key)) return;
          const type = action.valueType || 'bool';
          const v = castValue(modify(m.modifiers, castValue(read(m.key), type), type), type);
          const own = this.triggers(`${ctx}:${i}`, m.triggers, v, dt, type, chord);
          // Mapowanie bez triggerów działa przy każdej niezerowej wartości.
          const st = own ?? (magnitude(v, type) > 0 ? TRIGGERED : NONE);
          const r = found.get(m.action) ?? { state: NONE, value: vec(), withTriggers: false };
          found.set(m.action, r);
          if (own !== null) r.withTriggers = true;
          if (st === NONE) return;
          r.state = Math.max(r.state, st);
          if (action.accumulate === 'cumulative') r.value = r.value.add(v);
          else r.value = vec(Math.abs(v.x) > Math.abs(r.value.x) ? v.x : r.value.x, Math.abs(v.y) > Math.abs(r.value.y) ? v.y : r.value.y);
          if (action.consume !== false) used.push(m.key);
        });
        used.forEach((key) => consumed.add(key));
      });

      const events = [];
      Object.entries(this.actions).forEach(([name, action]) => {
        const type = action.valueType || 'bool';
        const r = found.get(name) ?? { state: NONE, value: vec(), withTriggers: false };
        const value = castValue(modify(action.modifiers, r.value, type), type);
        const own = this.triggers('action:' + name, action.triggers, value, dt, type, chord);
        let st = r.state;
        if (own !== null) st = r.withTriggers ? Math.min(own, r.state) : own;
        const s = this.state(name);
        const prev = s.state;
        s.value = st === NONE ? vec() : value;
        s.elapsed = prev === NONE ? 0 : s.elapsed + dt;
        if (st === TRIGGERED) s.triggered = prev === TRIGGERED ? s.triggered + dt : 0;
        s.state = st;
        const emit = (event) => events.push({ action: name, event, value: this.value(name), elapsed: s.elapsed, triggered: s.triggered });
        if (prev === NONE && st !== NONE) emit('Started');
        if (st === ONGOING) emit('Ongoing');
        if (st === TRIGGERED) emit('Triggered');
        if (prev !== NONE && st === NONE) emit(prev === TRIGGERED ? 'Completed' : 'Canceled');
      });
      return events;
    }
  }

  // Przyciski pada w układzie „standard” przeglądarki (Gamepad API), nazwy jak w Unreal Engine.
  const PAD_BUTTONS = [
    'Gamepad_FaceButton_Bottom', 'Gamepad_FaceButton_Right', 'Gamepad_FaceButton_Left', 'Gamepad_FaceButton_Top',
    'Gamepad_LeftShoulder', 'Gamepad_RightShoulder', 'Gamepad_LeftTriggerAxis', 'Gamepad_RightTriggerAxis',
    'Gamepad_Special_Left', 'Gamepad_Special_Right', 'Gamepad_LeftThumbstick', 'Gamepad_RightThumbstick',
    'Gamepad_DPad_Up', 'Gamepad_DPad_Down', 'Gamepad_DPad_Left', 'Gamepad_DPad_Right'
  ];
  const MOUSE_BUTTONS = ['LeftMouseButton', 'MiddleMouseButton', 'RightMouseButton'];
  // Kursory z Mouse Interface (nazwy jak EMouseCursor w Unreal Engine) → kursory CSS.
  const CURSOR_CSS = {
    Default: 'default', None: 'none', Hand: 'pointer', Crosshairs: 'crosshair', TextEditBeam: 'text', GrabHand: 'grab',
    GrabHandClosed: 'grabbing', CardinalCross: 'move', ResizeLeftRight: 'ew-resize', ResizeUpDown: 'ns-resize', SlashedCircle: 'not-allowed'
  };
  // Mouse Interface z Class Defaults Player Controllera. Brak ustawienia (starsze projekty, gra bez
  // Player Controllera) — kursor widać, a kliknięcia i najeżdżanie działają.
  const mouseInterface = (d) => ({
    showMouseCursor: d?.showMouseCursor ?? true,
    enableClickEvents: d?.enableClickEvents ?? true,
    enableMouseOverEvents: d?.enableMouseOverEvents ?? true,
    defaultMouseCursor: d?.defaultMouseCursor ?? 'Default'
  });

  class Game {
    constructor(project, program, canvas, hooks = {}) {
      this.project = project;
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.hooks = hooks;
      this.settings = { width: 960, height: 540, background: '#87ceeb', gravity: 1600, killY: 1200, ...project.settings };
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(this.settings.width * this.dpr);
      canvas.height = Math.round(this.settings.height * this.dpr);
      this.uidCounter = 0;
      this.spawnCounter = 0;
      this.keys = new Set();
      this.pressed = [];
      this.released = [];
      this.clicks = [];
      this.mouse = vec();
      // Kursor na ekranie gry (mouseInside — czy jest nad grą); this.mouse to ten sam punkt w świecie.
      this.mouseScreen = vec();
      this.mouseInside = false;
      this.mouseButtons = new Set();
      this.mouseDelta = vec();
      this.wheel = 0;
      this.pad = null;
      this.input = new EnhancedInput(project.input);
      this.prints = [];
      this.errors = new Set();
      this.stopped = false;
      // Poziom, który trwa (project.levels), i poziom czekający na „Open Level”.
      this.levelId = project.levelId ?? project.levels?.[0]?.id ?? null;
      this.nextLevel = null;
      const classes = program({ Actor, Widget, AnimInstance, G: this, vec, Vec }) || [];
      this.classes = new Map(classes.map((cls) => [cls.bpId, cls]));
      this.loop = this.loop.bind(this);
    }

    start() {
      this.bindInput();
      this.reset();
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.loop);
      return this;
    }

    stop() {
      this.stopped = true;
      cancelAnimationFrame(this.frame);
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onBlur);
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.canvas.removeEventListener('pointermove', this.onPointerMove);
      this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
      window.removeEventListener('pointerup', this.onPointerUp);
      this.canvas.removeEventListener('wheel', this.onWheel);
      this.canvas.removeEventListener('contextmenu', this.onContextMenu);
      this.canvas.style.cursor = '';
      this.audio?.close?.();
      stopSounds(this);
    }

    reset() {
      // Open Level: zmienne gry zostają (jak w GameInstance z Unreal Engine), reszta zaczyna się od nowa.
      const opening = this.nextLevel;
      if (opening) {
        this.levelId = opening;
        this.nextLevel = null;
        delete this.settings.playFrom;
      }
      const lvl = this.currentLevel();
      ['spawnX', 'spawnY', 'playerStart'].forEach((k) => {
        if (lvl && lvl[k] !== undefined) this.settings[k] = lvl[k];
      });
      this.actors = [];
      this.widgets = [];
      if (!opening) this.vars = {};
      this.hud = new Map();
      this.message = '';
      this.time = 0;
      this.paused = false;
      this.restartPending = false;
      this.overlaps = new Map();
      this.compOverlaps = new Map();
      this.contacts = new Map();
      this.camera = { x: 0, y: 0, target: null, snap: false };
      // Mysz: aktor i przycisk widgetu pod kursorem, wciśnięty przycisk widgetu, tryb wejścia (Set Input Mode).
      this.hoverActor = null;
      this.hoverButton = null;
      this.pressedButton = null;
      this.inputMode = 'gameui';
      // Domyślny Input Mapping Context z Ustawień świata (Default Mapping Context), z priorytetem 0.
      this.input.clear();
      if (this.project.input?.defaultContext) this.input.addContext(this.project.input.defaultContext, 0);
      this.createGameInstance();
      this.level = this.create(lvl?.bp ?? 'level', { id: 'level', name: lvl?.name ?? 'Poziom' });
      ((lvl ? lvl.actors : this.project.actors) || []).forEach((inst) => this.create(inst.bp, inst));
      this.resolveActorRefs();
      this.spawnWorldClasses();
      // Jak w Unreal Engine: najpierw Construction Script wszystkich aktorów, potem ich BeginPlay,
      // a na końcu BeginPlay Level Blueprintu.
      this.actors.slice(1).forEach((actor) => this.constructActor(actor));
      [...this.actors.slice(1), this.level].forEach((actor) => this.call(actor, 'beginPlay'));
    }

    levelActor(id) { return typeof id === 'string' && id ? new ActorRef(id) : null; }

    // Znaczniki ActorRef w zmiennych (także w tablicach, zbiorach, mapach i Strukturach) → aktorzy poziomu.
    resolveActorRefs() {
      const byId = new Map(this.actors.map((a) => [a.id, a]));
      const fix = (v) => {
        if (v instanceof ActorRef) return byId.get(v.id) ?? null;
        if (Array.isArray(v)) v.forEach((item, i) => { v[i] = fix(item); });
        else if (v instanceof Set) {
          const items = [...v].map(fix);
          v.clear();
          items.forEach((item) => v.add(item));
        } else if (v instanceof Map) {
          const pairs = [...v].map(([k, item]) => [fix(k), fix(item)]);
          v.clear();
          pairs.forEach(([k, item]) => v.set(k, item));
        } else if (v && Object.getPrototypeOf(v) === Object.prototype) Object.keys(v).forEach((k) => { v[k] = fix(v[k]); });
        return v;
      };
      this.actors.forEach((a) => fix(a.vars));
    }

    // Construction Script, a po nim start komponentów ruchu (Pocisk dostaje prędkość początkową).
    constructActor(actor) {
      this.call(actor, 'construct');
      actor.components.forEach((c) => {
        if (c.type !== 'projectile' || !c.active) return;
        actor.vx += Number(c.vx) || 0;
        actor.vy += Number(c.vy) || 0;
      });
    }

    // Ustawienia świata, jak w Unreal Engine: GameMode (niewidzialny aktor z zasadami gry),
    // Player Controller (niewidzialny aktor, który odbiera wejście i steruje postacią),
    // Default Pawn (postać gracza, za którą idzie kamera) i HUD (widget od początku na ekranie).
    spawnWorldClasses() {
      const s = this.settings;
      const bpOf = (id, kind) => (id && this.classes.has(id) ? (this.project.blueprints || []).find((bp) => bp.id === id && (bp.kind || 'actor') === kind) : null);
      const hidden = { shape: 'none', collision: 'none', gravity: false };
      const gm = bpOf(s.gameMode, 'actor');
      this.gameMode = gm ? this.create(gm.id, { id: 'gamemode', name: gm.name, ...hidden }) : null;
      const pc = bpOf(s.playerController, 'actor');
      this.playerController = pc ? this.create(pc.id, { id: 'playercontroller', name: pc.name, ...hidden }) : null;
      const pawnBp = bpOf(s.defaultPawn, 'actor');
      this.playerPawn = null;
      if (pawnBp) {
        const Cls = this.classes.get(pawnBp.id);
        this.playerPawn = this.actors.find((a) => a.constructor === Cls && a !== this.gameMode && a !== this.playerController)
          || this.create(pawnBp.id, { id: 'pawn', name: pawnBp.name, x: Number(s.spawnX) || 0, y: Number(s.spawnY) || 0 });
        // „Uruchom tutaj” w edytorze: gracz zaczyna w klikniętym miejscu, także gdy stoi już na poziomie.
        if (s.playFrom) {
          this.playerPawn.x = Number(s.playFrom.x) || 0;
          this.playerPawn.y = Number(s.playFrom.y) || 0;
        }
        this.cameraFollow(this.playerPawn);
      }
      const hudBp = bpOf(s.hud, 'widget');
      this.hudWidget = hudBp ? this.create(hudBp.id, { id: 'hud', name: hudBp.name }) : null;
      this.hudWidget?.addToViewport();
      // Show Mouse Cursor, Enable Click Events… z Class Defaults Player Controllera (jak w Unreal Engine).
      this.noController = mouseInterface(null);
      if (this.playerController) Object.assign(this.playerController, mouseInterface(pc.defaults));
    }
    // Game Instance, jak w Unreal Engine: jeden obiekt na całą grę (klasa z Ustawień świata), który przetrwa
    // Open Level i Restart. Nie ma go na poziomie — nie rysuje się, nie dostaje Tick ani kolizji, trzyma tylko zmienne.
    createGameInstance() {
      if (this.gameInstance !== undefined) return;
      const id = this.settings.gameInstance;
      const bp = id && this.classes.has(id) ? (this.project.blueprints || []).find((b) => b.id === id && (b.kind || 'actor') === 'actor') : null;
      this.gameInstance = bp ? this.create(bp.id, { id: 'gameinstance', name: bp.name, shape: 'none', collision: 'none', gravity: false }) : null;
      if (this.gameInstance) this.actors = this.actors.filter((a) => a !== this.gameInstance);
    }
    getGameInstance() { return this.gameInstance ?? null; }
    getPlayerPawn() { return this.isValid(this.playerPawn) ? this.playerPawn : null; }
    getGameMode() { return this.isValid(this.gameMode) ? this.gameMode : null; }
    getPlayerController() { return this.isValid(this.playerController) ? this.playerController : null; }
    getHudWidget() { return this.isValid(this.hudWidget) ? this.hudWidget : null; }
    // Mouse Interface (Show Mouse Cursor, Enable Click Events, Enable Mouse Over Events, Default Mouse Cursor):
    // pola Player Controllera; pusty Target — Player Controller z Ustawień świata (bez niego — ustawienia gry).
    mouseSettings() { return this.getPlayerController() ?? this.noController ?? mouseInterface(null); }
    setMouseInterface(target, key, value) {
      const pc = target ?? this.mouseSettings();
      pc[key] = key === 'defaultMouseCursor' ? String(value) : !!value;
    }
    getMouseInterface(target, key) { return (target ?? this.mouseSettings())[key]; }
    // 'game' — tylko gra, 'ui' — tylko przyciski widgetów, 'gameui' — jedno i drugie (Set Input Mode).
    setInputMode(mode) { this.inputMode = mode; }
    actorUnderCursor() { return this.mouseInside ? this.actorAt(this.mouse) : null; }

    create(bpId, inst) {
      const bp = (this.project.blueprints || []).find((item) => item.id === bpId);
      const Cls = this.classes.get(bpId) || Actor;
      const isLevel = bpId === 'level' || String(bpId).startsWith('level:');
      const base = isLevel ? { shape: 'none', collision: 'none', className: 'Poziom' } : { ...(bp?.defaults || {}), widget: bp?.widget, components: bp?.components, className: bp?.name || '?' };
      const actor = new Cls(this, { ...base, ...inst, vars: inst.vars || {} });
      this.actors.push(actor);
      if (actor.animBp && !actor.isWidget && !isLevel) actor.anim = this.createAnim(actor, actor.animBp);
      // Widget z zagnieżdżonymi widgetami: każdy dostaje własną instancję (zdarzenia, zmienne, przyciski).
      const depth = inst.depth ?? 0;
      if (actor.isWidget && depth < 8) {
        actor.elements.forEach((el) => {
          if (el.type !== 'widget' || !(this.classes.get(el.widget)?.prototype instanceof Widget)) return;
          el.child = this.create(el.widget, { id: `${actor.id}.${el.id}`, name: el.name, depth: depth + 1 });
          el.child.parentWidget = actor;
        });
      }
      return actor;
    }

    // Anim Instance klasy Animation Blueprint dla aktora (nie trafia na listę aktorów poziomu).
    createAnim(owner, bpId) {
      const Cls = this.classes.get(bpId);
      if (!Cls || !(Cls.prototype instanceof AnimInstance)) return null;
      const bp = (this.project.blueprints || []).find((b) => b.id === bpId);
      return new Cls(this, { id: owner.id + '.anim', name: `${owner.name}.${bp?.name ?? 'Anim'}`, className: bp?.name ?? 'AnimInstance', owner, vars: {} });
    }

    // ---------- API dla Blueprintów (w kodzie: G.coś) ----------

    spawn(Cls, location) {
      if (!Cls) return null;
      const n = ++this.spawnCounter;
      const actor = this.create(Cls.bpId, { id: 'spawn' + n, name: `${Cls.name}_${n}`, x: location?.x || 0, y: location?.y || 0 });
      this.constructActor(actor);
      if (!this.previewing) this.call(actor, 'beginPlay');
      return actor;
    }
    // Aktor z klasy TypeScript (new w jej konstruktorze): trafia na poziom i dostaje BeginPlay, potem Tick.
    addActor(actor) {
      if (!actor || this.actors.includes(actor)) return actor;
      this.actors.push(actor);
      if (!this.previewing) this.call(actor, 'beginPlay');
      return actor;
    }
    createWidget(Cls) {
      if (!Cls) return null;
      const n = ++this.spawnCounter;
      const widget = this.create(Cls.bpId, { id: 'widget' + n, name: `${Cls.name}_${n}` });
      this.startWidget(widget);
      return widget;
    }
    // Event Construct widgetu — najpierw zagnieżdżonych, jak w Unreal Engine.
    startWidget(widget) {
      widget.elements.forEach((el) => {
        if (el.child) this.startWidget(el.child);
      });
      this.call(widget, 'beginPlay');
    }
    // Wywołanie funkcji Blueprint Interface: aktor bez tej funkcji po prostu ją pomija (jak w Unreal Engine).
    callInterface(actor, method) {
      if (actor && !actor.dead && typeof actor[method] === 'function') this.call(actor, method);
    }
    implements(actor, interfaceId) { return !!actor && (actor.constructor.interfaces || []).includes(interfaceId); }
    findActor(Cls) { return this.actors.find((a) => !a.dead && a instanceof Cls) || null; }
    countOf(Cls) { return this.actors.filter((a) => !a.dead && a instanceof Cls).length; }
    allOf(Cls) { return Cls ? this.actors.filter((a) => !a.dead && a instanceof Cls) : []; }
    isA(actor, Cls) { return !!actor && !!Cls && actor instanceof Cls; }
    isValid(actor) { return !!actor && !actor.dead; }
    isKeyDown(key) { return this.keys.has(key); }
    // Enhanced Input: konteksty mapowań i wartość akcji (nazwy zasobów IMC_ / IA_).
    addMappingContext(name, priority) { this.input?.addContext(String(name), priority); }
    removeMappingContext(name) { this.input?.removeContext(String(name)); }
    clearMappingContexts() { this.input?.clear(); }
    hasMappingContext(name) { return !!this.input?.hasContext(String(name)); }
    inputValue(name) { return this.input ? this.input.value(String(name)) : false; }

    // Wartość klawisza jako wektor: przyciski 0 albo 1, osie od −1 do 1 (w dół i w prawo to +),
    // ruch myszy w pikselach na klatkę. Nazwy klawiszy jak w Unreal Engine.
    keyValue(key) {
      const pad = this.pad;
      const stick = (i) => {
        const x = pad?.axes[i] ?? 0;
        return Math.abs(x) < 0.08 ? 0 : x;
      };
      switch (key) {
        case 'MouseX': return vec(this.mouseDelta.x, 0);
        case 'MouseY': return vec(this.mouseDelta.y, 0);
        case 'Mouse2D': return vec(this.mouseDelta.x, this.mouseDelta.y);
        case 'MouseWheelUp': return vec(this.wheel < 0 ? 1 : 0, 0);
        case 'MouseWheelDown': return vec(this.wheel > 0 ? 1 : 0, 0);
        case 'Gamepad_LeftX': return vec(stick(0), 0);
        case 'Gamepad_LeftY': return vec(stick(1), 0);
        case 'Gamepad_RightX': return vec(stick(2), 0);
        case 'Gamepad_RightY': return vec(stick(3), 0);
        case 'Gamepad_Left2D': return vec(stick(0), stick(1));
        case 'Gamepad_Right2D': return vec(stick(2), stick(3));
        default:
      }
      if (MOUSE_BUTTONS.includes(key)) return vec(this.mouseButtons.has(key) ? 1 : 0, 0);
      const b = PAD_BUTTONS.indexOf(key);
      if (b >= 0) return vec(pad?.buttons[b]?.value ?? 0, 0);
      return vec(this.keys.has(key) ? 1 : 0, 0);
    }

    // Pierwszy podłączony pad (Gamepad API trzeba odpytywać co klatkę).
    pollGamepad() {
      try {
        this.pad = [...(navigator.getGamepads?.() || [])].find((p) => p && p.connected) || null;
      } catch {
        this.pad = null;
      }
    }

    // Zdarzenia Enhanced Input: metody onInput_IA_Nazwa_Triggered (Started, Ongoing, Completed, Canceled).
    // W pauzie działają tylko akcje z „Trigger when Paused”, tak jak w Unreal Engine.
    processInput(dt) {
      this.pollGamepad();
      const events = this.input.update(dt, (key) => this.keyValue(key));
      this.mouseDelta = vec();
      this.wheel = 0;
      events.forEach((e) => {
        if (this.inputMode === 'ui') return;
        if (this.paused && !this.input.actions[e.action]?.whenPaused) return;
        const method = `onInput_${ident(e.action)}_${e.event}`;
        [...this.actors].forEach((a) => this.call(a, method, e.value, e.elapsed, e.triggered));
      });
    }
    axis(name) {
      const k = (...list) => (list.some((key) => this.keys.has(key)) ? 1 : 0);
      if (name === 'vertical') return k('Down', 'S') - k('Up', 'W');
      return k('Right', 'D') - k('Left', 'A');
    }
    randomFloat(min, max) { return min + Math.random() * (max - min); }
    randomInt(min, max) {
      const lo = Math.ceil(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      return lo + Math.floor(Math.random() * (hi - lo + 1));
    }
    getVar(name) { return this.vars[name] ?? 0; }
    setVar(name, value) { this.vars[name] = value; }
    addVar(name, amount) { this.vars[name] = (Number(this.vars[name]) || 0) + (Number(amount) || 0); }
    setHud(slot, text) {
      if (text === '' || text == null) this.hud.delete(String(slot));
      else this.hud.set(String(slot), String(text));
    }
    showMessage(text) { this.message = String(text ?? ''); }
    setPaused(paused) { this.paused = !!paused; }
    restart() { this.restartPending = true; }
    currentLevel() { return (this.project.levels || []).find((l) => l.id === this.levelId) || null; }
    getLevelName() { return this.currentLevel()?.name ?? ''; }
    // Przejście na inny poziom po nazwie — na końcu klatki, tak jak Restart Level.
    openLevel(name) {
      const lvl = (this.project.levels || []).find((l) => l.name === String(name ?? ''));
      if (!lvl) {
        this.reportError(new Error(`Nie ma poziomu „${name}”`), null, 'openLevel');
        return;
      }
      this.nextLevel = lvl.id;
      this.restartPending = true;
    }
    cameraFollow(actor) {
      this.camera.target = actor;
      this.camera.snap = true;
    }
    print(text, color = '#38b6ff') {
      const line = String(text);
      this.prints.unshift({ text: line, color, until: performance.now() + 3000 });
      this.prints.length = Math.min(this.prints.length, 12);
      if (this.hooks.onPrint) this.hooks.onPrint(line);
      else console.log(line);
    }
    // name to wbudowany dźwięk (coin, jump…) albo id zasobu Dźwięk z project.sounds.
    playSound(name) {
      if (this.previewing) return;
      playSoundData(this, this.project.sounds?.[name] ?? { preset: name });
    }
    // Klatki Sprite'a / Animacji o danym id (z project.sprites i project.textures), zapamiętane na całą grę.
    spriteData(id) {
      const s = this.project.sprites?.[id];
      if (!s) return null;
      this.spriteCache = this.spriteCache || new Map();
      if (!this.spriteCache.has(id)) this.spriteCache.set(id, { ...s, frames: s.frames.map((f) => ({ ...f, src: this.project.textures?.[f.tex] })) });
      return this.spriteCache.get(id);
    }
    // Te same klatki z zapętleniem ze stanu Animation Blueprintu (zamiast ustawienia Flipbooka).
    animSprite(id, loop) {
      const base = this.spriteData(id);
      if (!base || !!base.loop === loop) return base;
      this.animSprites = this.animSprites || new Map();
      const key = `${id}:${loop}`;
      if (!this.animSprites.has(key)) this.animSprites.set(key, { ...base, loop });
      return this.animSprites.get(key);
    }

    // ---------- Pętla gry ----------

    call(actor, method, ...args) {
      if (actor.dead && method !== 'onDestroyed' && method !== 'onEndOverlap') return;
      const fn = actor[method];
      if (typeof fn !== 'function') return;
      // Kod Blueprintu może zmienić dowolnego aktora, więc siatka przeszkód zbuduje się od nowa.
      this.blockGrid = null;
      try {
        fn.apply(actor, args);
      } catch (err) {
        this.reportError(err, actor, method);
      }
    }

    reportError(err, actor, method) {
      let msg = err?.message || String(err);
      if (err instanceof TypeError && /null|undefined/.test(msg)) msg = 'Odwołanie do pustego aktora (None) — sprawdź, czy pin Cel jest podłączony.';
      const text = `${actor?.className || 'Gra'}.${method}: ${msg}`;
      if (this.errors.has(text)) return;
      this.errors.add(text);
      if (this.hooks.onError) this.hooks.onError(text);
      else console.error(text);
    }

    loop(now) {
      if (this.stopped || this.debugPaused) return;
      // Breakpoint z BeginPlay (zanim ruszyła pętla) zatrzymuje grę przed pierwszą klatką.
      if (!this.debugHit) {
        const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
        this.last = now;
        this.update(dt);
      }
      this.render();
      if (this.debugHit) {
        this.debugPaused = true;
        this.hooks.onBreak(this.debugHit);
        return;
      }
      this.frame = requestAnimationFrame(this.loop);
    }

    // ---------- Debugowanie (breakpointy w edytorze) ----------

    // Wywołanie wstawione przed węzłem z breakpointem (geCompileProject z { debug: true }). Kod JavaScriptu
    // nie umie stanąć w połowie metody, więc zapamiętujemy wartości z tej chwili, a gra staje po bieżącej klatce.
    // inputs — [nazwa pinu, () => wartość], locals — [opis, wartość]. Kolejne breakpointy tej klatki są pomijane.
    debugBreak(actor, bpId, nodeId, inputs, locals) {
      if (this.debugHit || !this.hooks.onBreak) return;
      const groups = [];
      const add = (title, rows) => rows.length && groups.push({ title, rows });
      add('Wejścia bloczka', inputs.map(([name, get]) => {
        try {
          return [name, debugValue(get())];
        } catch (err) {
          return [name, '⚠ ' + (err?.message || err)];
        }
      }));
      add('Zmienne lokalne', locals.map(([name, v]) => [name, v === undefined ? '— (jeszcze nie ustawiona)' : debugValue(v)]));
      const varNames = actor.constructor.debugVars ?? {};
      add('Zmienne', Object.keys(actor.vars ?? {}).map((k) => [varNames[k] ?? k, debugValue(actor.vars[k])]));
      if (actor.isAnim) add('Anim Instance', [['Stan', actor.state?.name ?? '—'], ['Właściciel', actor.owner?.name ?? '—']]);
      else if (actor !== this.level && !actor.isWidget) {
        add('Aktor', [['Położenie', `X=${round2(actor.x)} Y=${round2(actor.y)}`], ['Obrót', String(round2(actor.rotation || 0))], ['Prędkość', `X=${round2(actor.vx || 0)} Y=${round2(actor.vy || 0)}`]]);
      }
      if (this.gameInstance && this.gameInstance !== actor) {
        const giNames = this.gameInstance.constructor.debugVars ?? {};
        add('Game Instance', Object.keys(this.gameInstance.vars ?? {}).map((k) => [giNames[k] ?? k, debugValue(this.gameInstance.vars[k])]));
      }
      this.debugHit = { bpId, nodeId, actor: actor.name || actor.className || 'Aktor', className: actor.className, time: round2(this.time), groups };
    }

    // Kontynuuj po breakpoincie: klawisze wciśnięte w czasie przerwy się nie liczą.
    debugResume() {
      if (!this.debugPaused || this.stopped) return;
      this.debugHit = null;
      this.debugPaused = false;
      this.pressed.length = 0;
      this.released.length = 0;
      this.clicks.length = 0;
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.loop);
    }

    update(dt) {
      const pressed = this.pressed.splice(0);
      const released = this.released.splice(0);
      const clicks = this.clicks.splice(0);
      // Set Input Mode UI Only: klawisze (i przyciski myszy jako klawisze) nie trafiają do gry.
      if (this.inputMode !== 'ui') {
        pressed.forEach((key) => [...this.actors].forEach((a) => {
          this.call(a, 'onKeyPressed_' + key);
          this.call(a, 'onAnyKeyPressed', key);
        }));
        released.forEach((key) => [...this.actors].forEach((a) => {
          this.call(a, 'onKeyReleased_' + key);
          this.call(a, 'onAnyKeyReleased', key);
        }));
      }
      this.processInput(dt);
      // Kamera mogła się ruszyć, więc kursor stojący w miejscu wskazuje inny punkt świata.
      if (this.mouseInside) this.mouse = vec(this.mouseScreen.x + this.camera.x, this.mouseScreen.y + this.camera.y);
      clicks.forEach((click) => this.handleClick(click));
      this.updateHover();
      this.updateCursor();

      if (!this.paused) {
        this.time += dt;
        [...this.actors].forEach((a) => this.runTimers(a, dt));
        this.actors.forEach((a) => { a.animTime += dt; });
        [...this.actors].forEach((a) => this.call(a, 'tick', dt));
        const contacts = new Map();
        this.contactsNow = contacts;
        this.inPhysics = true;
        this.blockGrid = null;
        this.actors.forEach((a) => {
          if (a.dead || a === this.level || a.isWidget) return;
          this.physics(a, dt);
          this.blockGrid?.update(a, a.dead ? null : colliderCache(a).blockBounds);
        });
        this.inPhysics = false;
        this.blockGrid = null;
        contacts.forEach(([a, b], key) => {
          if (this.contacts.has(key)) return;
          this.call(a, 'onHit', b);
          this.call(b, 'onHit', a);
        });
        this.contacts = contacts;
        this.updateOverlaps();
        // Animation Blueprinty po fizyce — widzą prędkość i stanie na ziemi z tej klatki.
        [...this.actors].forEach((a) => {
          if (a.anim && !a.dead) a.anim.tickAnim(dt);
        });
      }

      this.actors = this.actors.filter((a) => !a.dead);
      this.widgets = this.widgets.filter((w) => !w.dead);
      this.updateCamera(dt);
      if (this.restartPending) this.reset();
    }

    // Przycisk widgetu pod punktem ekranu (najwyższy widget pierwszy): { owner, el } albo null.
    buttonAt(screen) {
      for (const widget of [...this.widgets].reverse()) {
        const hit = widget.visible && widget.buttonAt(screen.x, screen.y);
        if (hit) return hit;
      }
      return null;
    }

    // Wciśnięcie (down) albo puszczenie przycisku myszy. Najpierw przyciski widgetów (leżą nad światem gry),
    // dopiero potem aktorzy. Jak w Unreal Engine: On Pressed przy wciśnięciu, On Released po puszczeniu,
    // On Clicked — gdy puszczono na tym samym przycisku, który wciśnięto.
    handleClick({ world, screen, button, down }) {
      const hit = this.inputMode !== 'game' ? this.buttonAt(screen) : null;
      const same = (a, b) => a && b && a.owner === b.owner && a.el === b.el;
      if (button === 'LeftMouseButton') {
        if (down && hit) {
          this.pressedButton = hit;
          this.call(hit.owner, 'onButtonPressed_' + ident(hit.el.name));
          return;
        }
        const was = this.pressedButton;
        if (!down && was) {
          this.pressedButton = null;
          this.call(was.owner, 'onButtonReleased_' + ident(was.el.name));
          if (same(hit, was)) this.call(was.owner, 'onButton_' + ident(was.el.name));
          return;
        }
      }
      if (hit || this.inputMode === 'ui' || !this.mouseSettings().enableClickEvents) return;
      const actor = this.actorAt(world);
      if (actor) this.call(actor, down ? 'onClicked' : 'onReleased', actor, button);
    }

    // Najeżdżanie kursorem: On Hovered / On Unhovered przycisków widgetów i Begin / End Cursor Over aktorów.
    updateHover() {
      const btn = this.mouseInside && this.inputMode !== 'game' ? this.buttonAt(this.mouseScreen) : null;
      const old = this.hoverButton;
      if (btn?.el !== old?.el || btn?.owner !== old?.owner) {
        this.hoverButton = btn;
        if (old) this.call(old.owner, 'onButtonUnhovered_' + ident(old.el.name));
        if (btn) this.call(btn.owner, 'onButtonHovered_' + ident(btn.el.name));
      }
      const over = !btn && this.mouseInside && this.inputMode !== 'ui' && this.mouseSettings().enableMouseOverEvents ? this.actorAt(this.mouse) : null;
      const prev = this.hoverActor;
      if (over === prev) return;
      this.hoverActor = over;
      if (prev) this.call(prev, 'onEndCursorOver', prev);
      if (over) this.call(over, 'onBeginCursorOver', over);
    }

    // Show Mouse Cursor i Default Mouse Cursor → kursor nad ekranem gry.
    updateCursor() {
      const m = this.mouseSettings();
      const css = m.showMouseCursor ? CURSOR_CSS[m.defaultMouseCursor] ?? 'default' : 'none';
      if (this.canvas.style.cursor !== css) this.canvas.style.cursor = css;
    }

    runTimers(a, dt) {
      if (a.dead) return;
      if (!a._timelinesReady) {
        a._timelinesReady = true;
        Object.keys(timelineConfigs(a.constructor)).forEach((key) => a.timeline(key));
      }
      a._timelines.forEach((tl) => {
        if (!a.dead) tl.tick(dt);
      });
      a._delays.forEach((delay, key) => {
        if (this.time < delay.at) return;
        a._delays.delete(key);
        try {
          delay.fn();
        } catch (err) {
          this.reportError(err, a, 'Delay');
        }
      });
      a._timers.forEach((timer, name) => {
        if (this.time < timer.at) return;
        if (timer.looping) timer.at += timer.every;
        else a._timers.delete(name);
        a.callEvent(name);
      });
    }

    physics(a, dt) {
      a.components.forEach((c) => {
        if (c.type === 'rotating' && c.active) a.rotation = (a.rotation + (Number(c.rate) || 0) * dt) % 360;
      });
      if (a._input) {
        let input = a._input;
        if (input.length() > 1) input = input.normalize();
        a.vx = input.x * a.moveSpeed;
        if (!a.gravity) a.vy = input.y * a.moveSpeed;
        a._usedInput = true;
        a._input = null;
      } else if (a._usedInput) {
        a.vx = 0;
        if (!a.gravity) a.vy = 0;
      }
      if (a.gravity) a.vy = Math.min(a.vy + this.settings.gravity * dt, 2500);
      if (!a.vx && !a.vy) return;
      if (a.gravity) a.onGround = false;
      this.moveActor(a, a.vx * dt, a.vy * dt);
      if (box(a).t > this.settings.killY) this.destroyActor(a);
    }

    // Przesuwa aktora i zatrzymuje go na blokujących przeszkodach (oś po osi, małymi krokami).
    // Blokują: własny prostokąt aktora (kolizja „Blokuje”) i komponenty z kolizją „Blokuje”.
    moveActor(a, dx, dy) {
      const solids = colliderCache(a).block;
      if (!solids.length) {
        a.x += dx;
        a.y += dy;
        return;
      }
      const hw = Math.max(1, Math.min(...solids.map((s) => (s.r - s.l) / 2)));
      const hh = Math.max(1, Math.min(...solids.map((s) => (s.b - s.t) / 2)));
      const steps = Math.min(16, Math.max(1, Math.ceil(Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh))));
      for (let i = 0; i < steps; i++) {
        this.moveAxis(a, dx / steps, 0);
        this.moveAxis(a, 0, dy / steps);
      }
    }

    // Przeszkody sprawdzane są po kolei, tak jak leżą na poziomie. W czasie fizyki (wiele ruchów w jednej
    // klatce) siatka podpowiada, które przeszkody leżą blisko; reszty nie trzeba sprawdzać.
    moveAxis(a, dx, dy) {
      if (!dx && !dy) return;
      a.x += dx;
      a.y += dy;
      const grid = this.physicsGrid();
      const mine = colliderCache(a).blockBounds;
      if (!grid || !mine) {
        for (const b of this.actors) this.pushOut(a, b, dx, dy);
        return;
      }
      // Zapas na wypchnięcie: aktor zwykle cofa się najwyżej o ten krok.
      const pad = Math.abs(dx) + Math.abs(dy) + 8;
      const area = { l: mine.l - pad, r: mine.r + pad, t: mine.t - pad, b: mine.b + pad };
      for (const { actor: b, index } of grid.query(area)) {
        if (!this.pushOut(a, b, dx, dy) || within(colliderCache(a).blockBounds, area)) continue;
        // Aktor wypchnięty poza sprawdzany obszar — pozostałe przeszkody sprawdzamy po kolei, wszystkie.
        for (let j = index + 1; j < this.actors.length; j++) this.pushOut(a, this.actors[j], dx, dy);
        return;
      }
    }

    // Siatka przeszkód (aktorów z kolizją „Blokuje”) na czas fizyki; null — sprawdzamy wszystkich po kolei.
    physicsGrid() {
      if (!this.inPhysics || this.actors.length < GRID_MIN_ACTORS) return null;
      if (!this.blockGrid) {
        const grid = new SpatialGrid();
        this.actors.forEach((b, i) => {
          if (b.dead || b === this.level) return;
          const bounds = colliderCache(b).blockBounds;
          if (bounds) grid.insert(b, bounds, i);
        });
        this.blockGrid = grid;
      }
      return this.blockGrid;
    }

    // Wypycha aktora a z przeszkody b (o największe wejście któregokolwiek jego kształtu); true — gdy go przesunął.
    pushOut(a, b, dx, dy) {
      if (b === a || b.dead || b === this.level) return false;
      let moved = false;
      for (const B of colliderCache(b).block) {
        let push = 0;
        colliderCache(a).block.forEach((A) => {
          if (!intersects(A, B)) return;
          push = Math.max(push, dx > 0 ? A.r - B.l : dx < 0 ? B.r - A.l : dy > 0 ? A.b - B.t : B.b - A.t);
        });
        if (push <= 0) continue;
        moved = true;
        if (dx > 0) a.x -= push;
        else if (dx < 0) a.x += push;
        if (dy > 0) {
          a.y -= push;
          a.onGround = true;
          a.vy = 0;
        } else if (dy < 0) {
          a.y += push;
          a.vy = 0;
        }
        if (dx) a.vx = 0;
        if (this.contactsNow) this.contactsNow.set(Math.min(a.uid, b.uid) + ':' + Math.max(a.uid, b.uid), [a, b]);
      }
      return moved;
    }

    updateOverlaps() {
      const now = new Map();
      const parts = new Map();
      const list = this.actors.filter((a) => !a.dead && a !== this.level && colliders(a).length);
      const pair = (a, b) => {
        let hit = false;
        colliders(a).forEach((A) => colliders(b).forEach((B) => {
          if ((A.mode === 'block' && B.mode === 'block') || !touches(A, B)) return;
          hit = true;
          if (A.comp) parts.set(`${a.uid}:${A.comp}:${b.uid}`, [a, A.comp, b]);
          if (B.comp) parts.set(`${b.uid}:${B.comp}:${a.uid}`, [b, B.comp, a]);
        }));
        if (hit) now.set(a.uid + ':' + b.uid, [a, b]);
      };
      if (list.length < GRID_MIN_ACTORS) {
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) pair(list[i], list[j]);
        }
      } else {
        // Pary w tej samej kolejności co przy sprawdzaniu każdego z każdym, ale tylko sąsiedzi z siatki.
        // Dwa kształty „Blokuje” nigdy się nie nakładają, więc pary samych ścian są pomijane od razu.
        const grid = new SpatialGrid();
        list.forEach((a, i) => grid.insert(a, colliderCache(a).bounds, i));
        list.forEach((a, i) => {
          const loose = colliderCache(a).loose;
          grid.query(colliderCache(a).bounds).forEach(({ actor: b, index }) => {
            if (index > i && (loose || colliderCache(b).loose)) pair(a, b);
          });
        });
      }
      // Zdarzenia On Component Begin/End Overlap — osobno dla każdego komponentu.
      parts.forEach(([a, comp, b], key) => {
        if (!this.compOverlaps.has(key)) this.call(a, 'onCompOverlap_' + comp, b);
      });
      this.compOverlaps.forEach(([a, comp, b], key) => {
        if (!parts.has(key)) this.call(a, 'onCompEndOverlap_' + comp, b);
      });
      this.compOverlaps = parts;
      now.forEach(([a, b], key) => {
        if (this.overlaps.has(key)) return;
        this.call(a, 'onBeginOverlap', b);
        this.call(b, 'onBeginOverlap', a);
      });
      this.overlaps.forEach(([a, b], key) => {
        if (now.has(key)) return;
        this.call(a, 'onEndOverlap', b);
        this.call(b, 'onEndOverlap', a);
      });
      this.overlaps = now;
    }

    destroyActor(a) {
      if (a.dead) return;
      a.dead = true;
      this.call(a, 'onDestroyed');
    }

    actorAt(point) {
      const list = this.actors.filter((a) => !a.dead && a.visible && a !== this.level && !a.isWidget).sort((a, b) => b.z - a.z);
      const inside = (B) => point.x >= B.l && point.x <= B.r && point.y >= B.t && point.y <= B.b;
      return list.find((a) => inside(box(a)) || shapeParts(a).some((c) => inside(partBox(a, c)))) || null;
    }

    updateCamera(dt) {
      const cam = this.camera;
      const target = cam.target;
      if (!target) return;
      const tx = target.x - this.settings.width / 2;
      const ty = target.y - this.settings.height / 2;
      const k = cam.snap ? 1 : 1 - Math.pow(0.0005, dt);
      cam.x += (tx - cam.x) * k;
      cam.y += (ty - cam.y) * k;
      cam.snap = false;
    }

    render() {
      const { ctx, settings: s } = this;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const eye = s.view === 'raycast' ? this.camera.target : null;
      if (eye && !eye.dead) this.renderRaycast(eye);
      else {
        ctx.fillStyle = s.background;
        ctx.fillRect(0, 0, s.width, s.height);
        ctx.save();
        const left = Math.round(this.camera.x);
        const top = Math.round(this.camera.y);
        ctx.translate(-left, -top);
        // Aktorzy poza ekranem i tak nie byliby widoczni, więc ich nie rysujemy.
        const onScreen = (a) => {
          const r = drawReach(a);
          return a.x + r >= left && a.x - r <= left + s.width && a.y + r >= top && a.y - r <= top + s.height;
        };
        this.actors
          .filter((a) => a.visible && !a.dead && a !== this.level && !a.isWidget && onScreen(a))
          .sort((a, b) => a.z - b.z)
          .forEach((a) => drawActor(ctx, a));
        ctx.restore();
      }
      this.widgets.forEach((widget) => {
        if (widget.visible) drawWidget(ctx, widget.elements);
      });

      // HUD w prawym górnym rogu, napisy z Print String w lewym (jak w Unreal Engine).
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.font = '800 24px "Segoe UI", system-ui, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillStyle = '#ffffff';
      [...this.hud.values()].forEach((line, i) => {
        ctx.strokeText(line, s.width - 14, 12 + i * 30);
        ctx.fillText(line, s.width - 14, 12 + i * 30);
      });
      if (this.message) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 56px "Segoe UI", system-ui, sans-serif';
        ctx.lineWidth = 8;
        ctx.strokeText(this.message, s.width / 2, s.height / 2);
        ctx.fillText(this.message, s.width / 2, s.height / 2);
      }

      const now = performance.now();
      this.prints = this.prints.filter((p) => p.until > now);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '600 15px Consolas, "Courier New", monospace';
      this.prints.forEach((p, i) => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillText(p.text, 11, 9 + i * 19);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, 10, 8 + i * 19);
      });
    }

    // Widok 3D oczami aktora eye: niebo (Kolor tła) i podłoga, ściany promień po promieniu, potem
    // reszta aktorów jako obrazki od najdalszego, przycięte tam, gdzie zasłania je bliższa ściana.
    renderRaycast(eye) {
      const { ctx, settings: s } = this;
      const W = s.width;
      const H = s.height;
      const horizon = H / 2;
      const wallH = Math.max(8, Number(s.wallHeight) || 64);
      const fog = Math.max(100, Number(s.fogDistance) || 900);
      const fov = (Math.min(120, Math.max(30, Number(s.fov) || 66)) * Math.PI) / 180;
      const proj = W / 2 / Math.tan(fov / 2);
      const dir = (eye.rotation * Math.PI) / 180;
      const cos = Math.cos(dir);
      const sin = Math.sin(dir);

      ctx.fillStyle = s.background;
      ctx.fillRect(0, 0, W, horizon);
      ctx.fillStyle = s.floorColor || '#5a4a3a';
      ctx.fillRect(0, horizon, W, H - horizon);
      // Im bliżej horyzontu, tym ciemniej — daleko jest „mgła”.
      const shadeSky = ctx.createLinearGradient(0, 0, 0, horizon);
      shadeSky.addColorStop(0, 'rgba(0, 0, 0, 0)');
      shadeSky.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      ctx.fillStyle = shadeSky;
      ctx.fillRect(0, 0, W, horizon);
      const shadeFloor = ctx.createLinearGradient(0, horizon, 0, H);
      shadeFloor.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
      shadeFloor.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadeFloor;
      ctx.fillRect(0, horizon, W, H - horizon);

      const shown = this.actors.filter((a) => a !== eye && a.visible && !a.dead && a !== this.level && !a.isWidget);
      const walls = shown.map((a) => ({ a, look: wallLook(a), b: box(a) })).filter((w) => w.look);
      const cast = wallCaster(walls);
      const step = 2;
      const cols = Math.ceil(W / step);
      const depth = new Float32Array(cols);
      for (let i = 0; i < cols; i++) {
        const x = i * step;
        const ang = dir + Math.atan((x + step / 2 - W / 2) / proj);
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        const hit = cast(eye.x, eye.y, dx, dy);
        if (!hit) {
          depth[i] = Infinity;
          continue;
        }
        // Odległość prostopadła do kierunku patrzenia — bez niej ściany wyglądałyby jak przez rybie oko.
        const dist = Math.max(1, hit.t * Math.cos(ang - dir));
        depth[i] = dist;
        const h = (wallH * proj) / dist;
        const top = horizon - h / 2;
        const { look, b } = walls[hit.index];
        const tex = wallTexture(look);
        if (tex) {
          // Obrazek powtarza się co wallHeight wzdłuż ściany.
          const along = hit.side ? eye.x + dx * hit.t - b.l : eye.y + dy * hit.t - b.t;
          const u = (((along % wallH) + wallH) % wallH) / wallH;
          ctx.drawImage(tex.img, tex.sx + Math.min(tex.sw - 1, Math.floor(u * tex.sw)), tex.sy, 1, tex.sh, x, top, step, h);
        } else {
          ctx.fillStyle = look.color || '#8a8a8a';
          ctx.fillRect(x, top, step, h);
        }
        const dark = (hit.side ? 0.25 : 0) + Math.min(0.75, dist / fog);
        if (dark > 0) {
          ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.85, dark)})`;
          ctx.fillRect(x, top, step, h);
        }
      }

      // Aktorzy przed graczem jako obrazki: duże stoją na podłodze, małe (pociski, monety) unoszą się na wysokości oczu.
      shown
        .filter((a) => !isWall(a) && (a.shape !== 'none' || shapeParts(a).length))
        .map((a) => {
          const rx = a.x - eye.x;
          const ry = a.y - eye.y;
          return { a, d: rx * cos + ry * sin, side: -rx * sin + ry * cos };
        })
        .filter((t) => t.d > 4)
        .sort((p, q) => q.d - p.d)
        .forEach(({ a, d, side }) => {
          const k = proj / d;
          const size = Math.max(Math.abs(a.w * a.scaleX), Math.abs(a.h * a.scaleY));
          const lift = size >= wallH * 0.4 ? size / 2 : wallH * 0.4;
          const sx = W / 2 + side * k;
          const sy = horizon + (wallH / 2 - lift) * k;
          const half = (size * k) / 2;
          const from = Math.max(0, Math.floor((sx - half) / step));
          const to = Math.min(cols - 1, Math.floor((sx + half) / step));
          if (from > to) return;
          ctx.save();
          ctx.beginPath();
          let run = -1;
          for (let i = from; i <= to + 1; i++) {
            const open = i <= to && depth[i] > d;
            if (open && run < 0) run = i;
            if (!open && run >= 0) {
              ctx.rect(run * step, 0, (i - run) * step, H);
              run = -1;
            }
          }
          ctx.clip();
          ctx.globalAlpha = Math.max(0.35, 1 - (d / fog) * 0.6);
          drawActor(ctx, { ...a, x: sx, y: sy, rotation: 0, scaleX: (a.scaleX || 1) * k, scaleY: Math.abs(a.scaleY || 1) * k });
          ctx.restore();
        });

      if (s.minimap) this.renderMinimap(eye, walls, shown);
    }

    // Mała mapa w lewym dolnym rogu: ściany, inni aktorzy (kropki) i gracz (strzałka w stronę patrzenia).
    renderMinimap(eye, walls, shown) {
      const { ctx, settings: s } = this;
      const size = Math.round(Math.min(s.width, s.height) * 0.28);
      const x0 = 12;
      const y0 = s.height - size - 12;
      const k = size / 900;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, size, size);
      ctx.clip();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(x0, y0, size, size);
      ctx.translate(x0 + size / 2, y0 + size / 2);
      ctx.scale(k, k);
      ctx.translate(-eye.x, -eye.y);
      walls.forEach(({ look, b }) => {
        ctx.fillStyle = look.color || '#8a8a8a';
        ctx.fillRect(b.l, b.t, b.r - b.l, b.b - b.t);
      });
      ctx.fillStyle = '#ffd34d';
      shown.filter((a) => !isWall(a) && a.collision !== 'none').forEach((a) => {
        ctx.beginPath();
        ctx.arc(a.x, a.y, 7 / k / 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.translate(eye.x, eye.y);
      ctx.rotate((eye.rotation * Math.PI) / 180);
      ctx.fillStyle = '#4cff7a';
      ctx.beginPath();
      ctx.moveTo(12 / k, 0);
      ctx.lineTo(-7 / k, 7 / k);
      ctx.lineTo(-7 / k, -7 / k);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, y0, size, size);
    }

    // ---------- Wejście ----------

    toWorld(event) {
      const r = this.canvas.getBoundingClientRect();
      const { width: W, height: H } = this.settings;
      const scale = Math.min(r.width / W, r.height / H) || 1;
      const ox = (r.width - W * scale) / 2;
      const oy = (r.height - H * scale) / 2;
      return vec((event.clientX - r.left - ox) / scale + this.camera.x, (event.clientY - r.top - oy) / scale + this.camera.y);
    }

    bindInput() {
      this.onKeyDown = (event) => {
        if (event.target?.closest?.('input, textarea, select')) return;
        const key = keyName(event);
        if (!key) return;
        if (SCROLL_KEYS.includes(key)) event.preventDefault();
        if (event.repeat || this.keys.has(key)) return;
        this.keys.add(key);
        this.pressed.push(key);
      };
      this.onKeyUp = (event) => {
        const key = keyName(event);
        if (!key || !this.keys.has(key)) return;
        this.keys.delete(key);
        this.released.push(key);
      };
      this.onBlur = () => {
        this.keys.forEach((key) => this.released.push(key));
        this.keys.clear();
        this.mouseButtons.clear();
      };
      // Kursor nad grą: położenie w świecie (this.mouse) i na ekranie gry (this.mouseScreen).
      const point = (event) => {
        this.mouse = this.toWorld(event);
        this.mouseScreen = vec(this.mouse.x - this.camera.x, this.mouse.y - this.camera.y);
      };
      // Przyciski myszy są też klawiszami (zdarzenie klawisza, Any Key, Is Input Key Down) i kliknięciami (OnClicked / OnReleased).
      this.onPointerDown = (event) => {
        point(event);
        this.mouseInside = true;
        const button = MOUSE_BUTTONS[event.button];
        if (!button || this.mouseButtons.has(button)) return;
        this.mouseButtons.add(button);
        this.keys.add(button);
        this.pressed.push(button);
        this.clicks.push({ world: this.mouse, screen: this.mouseScreen, button, down: true });
      };
      this.onPointerUp = (event) => {
        const button = MOUSE_BUTTONS[event.button];
        if (!button || !this.mouseButtons.has(button)) return;
        point(event);
        this.mouseButtons.delete(button);
        this.keys.delete(button);
        this.released.push(button);
        this.clicks.push({ world: this.mouse, screen: this.mouseScreen, button, down: false });
      };
      this.onPointerMove = (event) => {
        point(event);
        this.mouseInside = true;
        // Ruch myszy (MouseX / MouseY) w pikselach ekranu gry.
        const scale = this.canvas.getBoundingClientRect().width / this.settings.width || 1;
        this.mouseDelta = this.mouseDelta.add(vec((event.movementX || 0) / scale, (event.movementY || 0) / scale));
      };
      this.onPointerLeave = () => { this.mouseInside = false; };
      this.onWheel = (event) => {
        event.preventDefault();
        this.wheel += Math.sign(event.deltaY);
        // Kółko to klawisz, który od razu się puszcza: Pressed i Released w tej samej klatce.
        const key = event.deltaY < 0 ? 'MouseWheelUp' : event.deltaY > 0 ? 'MouseWheelDown' : null;
        if (key) {
          this.pressed.push(key);
          this.released.push(key);
        }
      };
      this.onContextMenu = (event) => event.preventDefault();
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.onBlur);
      this.canvas.addEventListener('pointerdown', this.onPointerDown);
      this.canvas.addEventListener('pointermove', this.onPointerMove);
      this.canvas.addEventListener('pointerleave', this.onPointerLeave);
      window.addEventListener('pointerup', this.onPointerUp);
      this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
      this.canvas.addEventListener('contextmenu', this.onContextMenu);
    }
  }

  // Podgląd dla edytora: tworzy aktorów i uruchamia ich Construction Script — bez pętli gry, ekranu
  // i dźwięku. Zwraca funkcję, która dla listy aktorów poziomu zwraca ich wygląd po konstrukcji.
  function createPreview(project, program, hooks = {}) {
    const game = Object.create(Game.prototype);
    Object.assign(game, {
      project, hooks, previewing: true,
      settings: { width: 960, height: 540, background: '#87ceeb', gravity: 1600, killY: 1200, ...project.settings },
      uidCounter: 0, spawnCounter: 0, keys: new Set(), pressed: [], released: [], clicks: [],
      mouse: vec(), mouseScreen: vec(), prints: [], errors: new Set(), time: 0, widgets: []
    });
    const classes = program({ Actor, Widget, AnimInstance, G: game, vec, Vec }) || [];
    game.classes = new Map(classes.map((cls) => [cls.bpId, cls]));
    return (instances) => {
      Object.assign(game, { actors: [], vars: {}, hud: new Map(), message: '', camera: { x: 0, y: 0, target: null, snap: false } });
      const actors = instances.map((inst) => game.create(inst.bp, inst));
      game.resolveActorRefs();
      actors.forEach((actor) => game.constructActor(actor));
      return actors;
    };
  }

  return { Game, Actor, Widget, AnimInstance, animSlot, Vec, vec, evalCurve, evalColor, keyTangent, timelineLastKey, drawShape, drawActor, drawWidget, createPreview, whenImageReady, playSoundData, stopSounds, keyName, ident };
}
