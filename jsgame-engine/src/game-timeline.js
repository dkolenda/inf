// Edytor Timeline'u (jak Timeline Editor w Unreal Engine): karta „tl:<id węzła>” w edytorze Blueprintu.
// Dane leżą w węźle (node.props.tl, opis w game-blueprints.js), a krzywe liczy GE_RT.evalCurve — to samo co w grze.
//
// Na ścieżce: Shift + klik — nowy klucz, przeciąganie — przesuwa klucz (albo styczną zaznaczonego klucza),
// prawy przycisk — menu klucza (interpolacja, usuń) albo „Dodaj klucz”, przeciąganie prawym / środkowym — przesuwa
// widok, kółko — przybliża czas (z Ctrl — wartości), F — dopasuj widok, Delete — usuń zaznaczony klucz.
// Zaznaczony klucz: ge.tlSel = { node, track, axis, index } (axis — „x” / „y” na ścieżce Vector).

const GE_TL_MARGIN = { l: 44, r: 10, t: 18, b: 8 };
const GE_TL_AXES = [['x', 'X', '#e05a4f'], ['y', 'Y', '#6cc04a']];
const GE_TL_HANDLE = 44;
const geTlFmt = (n) => String(Math.round((Number(n) || 0) * 1000) / 1000);
const geTlTracksWord = (count) => (count === 1 ? 'ścieżka' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'ścieżki' : 'ścieżek');

// Klucze krzywej ścieżki: float, event i color mają keys, vector — osobne krzywe x i y.
const geTlKeys = (tr, axis) => (tr.type === 'vector' ? (tr[axis] = tr[axis] ?? []) : (tr.keys = tr.keys ?? []));
const geTlSorted = (keys) => keys.sort((a, b) => a.t - b.t);
const geTlHidden = (tr, axis) => ge.tlHidden?.has(`${tr.id}:${axis}`);

function geTlNodeOf(id) {
  return geTlNodes(geCurBp()).find((n) => n.id === id) ?? null;
}

// Otwiera edytor Timeline'u na osobnej karcie obok Event Graph (jak dwuklik na węźle Timeline w UE).
function geOpenTimeline(id) {
  const bp = geCurBp();
  if (!geModeTl(bp, 'tl:' + id)) {
    geToast('Timeline działa tylko w Event Graph.');
    return;
  }
  ge.bpModes[ge.tab] = 'tl:' + id;
  ge.nodeSel = new Set([id]);
  ge.bpPanel = { kind: 'node', id };
  if (ge.tlSel?.node !== id) ge.tlSel = null;
  geRender();
}

// Widok edytora: wspólna oś czasu i zakres wartości każdej ścieżki (zapamiętany dla karty i węzła).
function geTlView(n) {
  ge.tlViews = ge.tlViews ?? {};
  const key = `${ge.tab}:${n.id}`;
  if (!ge.tlViews[key]) {
    ge.tlViews[key] = { t0: 0, t1: 1, tracks: {} };
    geTlFit(n, ge.tlViews[key]);
  }
  return ge.tlViews[key];
}

function geTlFitTrack(tr, view) {
  const values = tr.type === 'vector' ? GE_TL_AXES.flatMap(([a]) => geTlKeys(tr, a).map((k) => Number(k.v) || 0)) : geTlKeys(tr).map((k) => Number(k.v) || 0);
  let lo = values.length ? Math.min(...values) : 0;
  let hi = values.length ? Math.max(...values) : 1;
  if (hi - lo < 1e-6) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.12;
  view.tracks[tr.id] = { v0: lo - pad, v1: hi + pad };
}

function geTlFit(n, view = geTlView(n)) {
  const tl = geTl(n);
  const end = Math.max(Number(tl.length) || 0, GE_RT.timelineLastKey(tl), 0.1);
  view.t0 = -end * 0.04;
  view.t1 = end * 1.06;
  tl.tracks.forEach((tr) => geTlFitTrack(tr, view));
}

// ---------- HTML ----------

// Szkielet karty; treść (pasek ustawień i ścieżki) wypełnia geRenderTimeline.
function geTlEditorHtml(bp, n) {
  return `<div class="ge-tled" tabindex="0" data-node="${n.id}" aria-label="Edytor Timeline ${geEsc(n.props?.name)}">
    <div class="ge-tled-bar"></div>
    <div class="ge-tled-tracks"></div>
    <div class="ge-tled-tip">Shift + klik — nowy klucz · przeciągnij klucz albo styczną · prawy przycisk — menu klucza · kółko — przybliż czas (Ctrl — wartości) · F — dopasuj widok · Delete — usuń klucz</div>
  </div>`;
}

// Ustawienia Timeline'u jak na pasku edytora w UE (Length, Use Last Keyframe, AutoPlay, Loop).
function geTlSettingsFields(n) {
  const tl = geTl(n);
  const attrs = `data-node="${n.id}"`;
  return `<label class="ge-tled-field" title="Długość Timeline'u w sekundach">Length ${geNum('tl', 'length', geTlFmt(tl.length), 'float', `${attrs} min="0" step="0.1"${tl.useLast ? ' disabled' : ''}`)}</label>
    <label class="ge-tled-check" title="Długość = czas ostatniego klucza na wszystkich ścieżkach">${geCheck('tl', 'useLast', tl.useLast, attrs)} Use Last Keyframe</label>
    <label class="ge-tled-check" title="Timeline zaczyna grać sam, gdy aktor pojawi się w grze">${geCheck('tl', 'autoPlay', tl.autoPlay, attrs)} AutoPlay</label>
    <label class="ge-tled-check" title="Po dojściu do końca gra od nowa (bez Finished)">${geCheck('tl', 'loop', tl.loop, attrs)} Loop</label>`;
}

// Panel Szczegóły węzła Timeline.
function geTlSettingsHtml(n) {
  const tl = geTl(n);
  const tracks = tl.tracks.map((tr) => `<li><span class="ge-tl-ic">${GE_TL_TRACKS[tr.type].icon}</span>${geEsc(tr.name)} <small>${GE_TL_TRACKS[tr.type].label}</small></li>`).join('');
  return `<div class="ge-tl-settings">${geTlSettingsFields(n)}
    <ul class="ge-tl-list">${tracks || '<li class="ge-muted">Brak ścieżek</li>'}</ul>
    <button type="button" class="ge-mini" data-ge="open-tl" data-id="${n.id}">⏱ Otwórz edytor Timeline'u</button></div>`;
}

function geTlTrackHtml(n, tr) {
  const sel = ge.tlSel?.node === n.id && ge.tlSel.track === tr.id ? ge.tlSel : null;
  const key = sel && geTlKeys(tr, sel.axis)[sel.index];
  const attrs = `data-node="${n.id}" data-id="${tr.id}"`;
  const keyAttrs = key ? `${attrs} data-axis="${sel.axis ?? ''}" data-i="${sel.index}"` : '';
  let fields = '';
  if (key) {
    fields = `<label class="ge-tled-field">Time ${geNum('tl-key', 't', geTlFmt(key.t), 'float', `${keyAttrs} step="0.01" min="0"`)}</label>`;
    if (tr.type === 'float' || tr.type === 'vector') {
      fields += `<label class="ge-tled-field">Value ${geNum('tl-key', 'v', geTlFmt(key.v), 'float', `${keyAttrs} step="0.01"`)}</label>
        <label class="ge-tled-field">${geSelect('tl-key', 'interp', key.interp ?? 'linear', GE_TL_INTERP, `${keyAttrs} aria-label="Interpolacja klucza"`)}</label>`;
      if (key.interp === 'user') fields += `<label class="ge-tled-field">Tangent ${geNum('tl-key', 'arrive', geTlFmt(key.arrive), 'float', `${keyAttrs} step="0.1"`)}</label>`;
      if (key.interp === 'break') {
        fields += `<label class="ge-tled-field">Arrive ${geNum('tl-key', 'arrive', geTlFmt(key.arrive), 'float', `${keyAttrs} step="0.1"`)}</label>
          <label class="ge-tled-field">Leave ${geNum('tl-key', 'leave', geTlFmt(key.leave), 'float', `${keyAttrs} step="0.1"`)}</label>`;
      }
    }
    if (tr.type === 'color') {
      fields += `<label class="ge-tled-field">Color ${geColorIn('tl-key', 'color', key.color ?? '#ffffff', keyAttrs)}</label>
        <label class="ge-tled-field">Alpha ${geNum('tl-key', 'a', geTlFmt(key.a ?? 1), 'float', `${keyAttrs} step="0.05" min="0" max="1"`)}</label>`;
    }
  }
  const axes = tr.type === 'vector' ? GE_TL_AXES.map(([a, label, color]) => `<button type="button" class="ge-tled-axis${geTlHidden(tr, a) ? '' : ' is-on'}" style="--ac:${color}" data-ge="tl-axis" ${attrs} data-axis="${a}" aria-pressed="${!geTlHidden(tr, a)}" title="Pokaż / ukryj krzywą ${label}">${label}</button>`).join('') : '';
  return `<div class="ge-tlt ge-tlt-${tr.type}" data-track="${tr.id}">
    <div class="ge-tlt-head">
      <span class="ge-tl-ic" title="${GE_TL_TRACKS[tr.type].label}">${GE_TL_TRACKS[tr.type].icon}</span>
      ${geText('tl-track', 'name', tr.name, `${attrs} aria-label="Nazwa ścieżki" class="ge-tlt-name"`)}
      ${axes}
      <span class="ge-tlt-fields">${fields}</span>
      <span class="ge-fill"></span>
      <button type="button" class="ge-mini" data-ge="tl-fit-track" ${attrs} title="Dopasuj zakres wartości (Zoom to Fit)">⤢</button>
      <button type="button" class="ge-mini" data-ge="tl-del-track" ${attrs} title="Usuń ścieżkę" aria-label="Usuń ścieżkę ${geEsc(tr.name)}">🗑</button>
    </div>
    <canvas class="ge-tlt-canvas" data-node="${n.id}" data-track="${tr.id}" aria-label="Krzywa ścieżki ${geEsc(tr.name)}"></canvas>
  </div>`;
}

function geRenderTimeline() {
  const root = ge.root.querySelector('.ge-tled');
  const n = geCurTl();
  if (!root || !n) return;
  const tl = geTl(n);
  if (ge.tlSel && (ge.tlSel.node !== n.id || !tl.tracks.find((tr) => tr.id === ge.tlSel.track))) ge.tlSel = null;
  root.querySelector('.ge-tled-bar').innerHTML = `
    <button type="button" class="ge-mini ge-tled-add" data-ge="tl-add-track" data-node="${n.id}" title="Dodaj ścieżkę">＋ Track ▾</button>
    <span class="ge-tled-name">⏱ ${geEsc(n.props?.name)}</span>
    ${geTlSettingsFields(n)}
    <span class="ge-fill"></span>
    <button type="button" class="ge-mini" data-ge="tl-fit" data-node="${n.id}" title="Dopasuj widok do kluczy (F)">⤢ Zoom to Fit</button>`;
  root.querySelector('.ge-tled-tracks').innerHTML = tl.tracks.map((tr) => geTlTrackHtml(n, tr)).join('')
    || '<p class="ge-empty">Timeline nie ma ścieżek. Kliknij <b>＋ Track</b> i wybierz rodzaj: Float (liczba), Vector (X, Y), Event (zdarzenia w czasie) albo Color (kolor).</p>';
  if (!root.dataset.bound) {
    root.dataset.bound = '1';
    root.addEventListener('pointerdown', geTlDown);
    root.addEventListener('pointermove', geTlMove);
    root.addEventListener('pointerup', geTlUp);
    root.addEventListener('pointercancel', geTlUp);
    root.addEventListener('wheel', geTlWheel, { passive: false });
    root.addEventListener('contextmenu', (event) => {
      if (event.target.closest('.ge-tlt-canvas')) event.preventDefault();
    });
  }
  ge.tlResize = ge.tlResize ?? new ResizeObserver(() => geDrawTimeline());
  root.querySelectorAll('.ge-tlt-canvas').forEach((c) => ge.tlResize.observe(c));
  geDrawTimeline();
}

// ---------- Rysowanie ----------

// Przeliczanie czasu i wartości na piksele płótna ścieżki (i z powrotem).
function geTlMap(canvas, view, tr) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const m = GE_TL_MARGIN;
  const range = view.tracks[tr.id] ?? { v0: -1, v1: 1 };
  const flat = tr.type === 'event' || tr.type === 'color';
  return {
    w, h, range,
    x: (t) => m.l + ((t - view.t0) / (view.t1 - view.t0)) * (w - m.l - m.r),
    t: (x) => view.t0 + ((x - m.l) / (w - m.l - m.r)) * (view.t1 - view.t0),
    y: (v) => (flat ? (m.t + h - m.b) / 2 : m.t + ((range.v1 - v) / (range.v1 - range.v0)) * (h - m.t - m.b)),
    v: (y) => range.v1 - ((y - m.t) / (h - m.t - m.b)) * (range.v1 - range.v0),
    // Ile pikseli na sekundę i na jednostkę wartości (do stycznych).
    sx: (w - m.l - m.r) / (view.t1 - view.t0),
    sy: (h - m.t - m.b) / (range.v1 - range.v0)
  };
}

// Ładny krok podziałki (1, 2, 5 × 10^n) dla zakresu i liczby kresek.
function geTlStep(span, count) {
  const raw = span / Math.max(1, count);
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((k) => k * pow).find((s) => s >= raw) ?? raw;
}

// Uchwyty stycznych zaznaczonego klucza (Cubic): [{ side, x, y }].
function geTlHandles(map, keys, i) {
  const k = keys[i];
  if (!k || !['auto', 'user', 'break'].includes(k.interp)) return [];
  const kx = map.x(k.t);
  const ky = map.y(Number(k.v) || 0);
  return [['arrive', -1], ['leave', 1]].filter(([side]) => (side === 'arrive' ? i > 0 : i < keys.length - 1)).map(([side, dir]) => {
    const slope = GE_RT.keyTangent(keys, i, side);
    const dx = map.sx;
    const dy = -slope * map.sy;
    const len = Math.hypot(dx, dy) || 1;
    return { side, x: kx + (dir * dx * GE_TL_HANDLE) / len, y: ky + (dir * dy * GE_TL_HANDLE) / len };
  });
}

function geDrawTimeline() {
  const n = geCurTl();
  if (!n) return;
  const tl = geTl(n);
  const view = geTlView(n);
  const len = tl.useLast ? GE_RT.timelineLastKey(tl) : Number(tl.length) || 0;
  ge.root.querySelectorAll('.ge-tlt-canvas').forEach((canvas) => {
    const tr = tl.tracks.find((t) => t.id === canvas.dataset.track);
    if (!tr) return;
    if (!view.tracks[tr.id]) geTlFitTrack(tr, view);
    const dpr = window.devicePixelRatio || 1;
    const map = geTlMap(canvas, view, tr);
    if (!map.w || !map.h) return;
    canvas.width = Math.round(map.w * dpr);
    canvas.height = Math.round(map.h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const m = GE_TL_MARGIN;
    const bottom = map.h - m.b;
    ctx.fillStyle = '#151515';
    ctx.fillRect(0, 0, map.w, map.h);
    // Czas poza długością Timeline'u jest przyciemniony, jak w Unreal Engine.
    ctx.fillStyle = '#202020';
    const x0 = Math.max(m.l, map.x(0));
    const x1 = Math.min(map.w - m.r, map.x(len));
    if (x1 > x0) ctx.fillRect(x0, m.t, x1 - x0, bottom - m.t);
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.textBaseline = 'middle';
    // Podziałka czasu (u góry) i wartości (z lewej).
    const tStep = geTlStep(view.t1 - view.t0, map.w / 90);
    ctx.strokeStyle = '#2a2a2a';
    ctx.fillStyle = '#8a8a8a';
    ctx.textAlign = 'center';
    for (let t = Math.ceil(view.t0 / tStep) * tStep; t <= view.t1; t += tStep) {
      const x = Math.round(map.x(t)) + 0.5;
      if (x < m.l) continue;
      ctx.beginPath();
      ctx.moveTo(x, m.t);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.fillText(geTlFmt(t), x, m.t / 2);
    }
    if (tr.type === 'float' || tr.type === 'vector') {
      const vStep = geTlStep(map.range.v1 - map.range.v0, (bottom - m.t) / 28);
      ctx.textAlign = 'right';
      for (let v = Math.ceil(map.range.v0 / vStep) * vStep; v <= map.range.v1; v += vStep) {
        const y = Math.round(map.y(v)) + 0.5;
        ctx.strokeStyle = Math.abs(v) < vStep / 2 ? '#3d3d3d' : '#262626';
        ctx.beginPath();
        ctx.moveTo(m.l, y);
        ctx.lineTo(map.w - m.r, y);
        ctx.stroke();
        ctx.fillText(geTlFmt(v), m.l - 5, y);
      }
    }
    // Koniec Timeline'u (Length).
    ctx.strokeStyle = '#b3402f';
    ctx.beginPath();
    ctx.moveTo(Math.round(map.x(len)) + 0.5, m.t);
    ctx.lineTo(Math.round(map.x(len)) + 0.5, bottom);
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.l, m.t - 6, map.w - m.l - m.r, bottom - m.t + 12);
    ctx.clip();
    const sel = ge.tlSel?.node === n.id && ge.tlSel.track === tr.id ? ge.tlSel : null;
    const diamond = (x, y, r, fill, stroke = '#000') => {
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };
    if (tr.type === 'float' || tr.type === 'vector') {
      const curves = tr.type === 'vector' ? GE_TL_AXES.filter(([a]) => !geTlHidden(tr, a)) : [[null, '', '#e6e6e6']];
      curves.forEach(([axis, , color]) => {
        const keys = geTlKeys(tr, axis);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = m.l; x <= map.w - m.r; x += 2) {
          const y = map.y(GE_RT.evalCurve(keys, map.t(x)));
          if (x === m.l) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
        keys.forEach((k, i) => {
          const on = sel && sel.axis === axis && sel.index === i;
          diamond(map.x(k.t), map.y(Number(k.v) || 0), on ? 6 : 5, on ? '#f5a623' : '#d8d8d8');
        });
        if (sel && sel.axis === axis) {
          geTlHandles(map, keys, sel.index).forEach((hd) => {
            const k = keys[sel.index];
            ctx.strokeStyle = '#c9c9c9';
            ctx.beginPath();
            ctx.moveTo(map.x(k.t), map.y(Number(k.v) || 0));
            ctx.lineTo(hd.x, hd.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(hd.x, hd.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#9a9a9a';
            ctx.fill();
          });
        }
      });
    } else if (tr.type === 'event') {
      const y = map.y(0);
      ctx.strokeStyle = '#4a4a4a';
      ctx.beginPath();
      ctx.moveTo(m.l, y);
      ctx.lineTo(map.w - m.r, y);
      ctx.stroke();
      geTlKeys(tr).forEach((k, i) => diamond(map.x(k.t), y, 7, sel?.index === i ? '#f5a623' : '#d63c3c'));
    } else if (tr.type === 'color') {
      const keys = geTlKeys(tr);
      const top = m.t + 4;
      const h = bottom - top - 16;
      geChecker(ctx, m.l, top, map.w - m.l - m.r, h, 6);
      for (let x = m.l; x <= map.w - m.r; x += 2) {
        ctx.fillStyle = keys.length ? GE_RT.evalColor(keys, map.t(x)) : '#ffffff';
        ctx.fillRect(x, top, 2, h);
      }
      keys.forEach((k, i) => {
        const x = map.x(k.t);
        const on = sel?.index === i;
        ctx.fillStyle = k.color ?? '#ffffff';
        ctx.strokeStyle = on ? '#f5a623' : '#000';
        ctx.lineWidth = on ? 2 : 1;
        ctx.fillRect(x - 5, bottom - 13, 10, 10);
        ctx.strokeRect(x - 5, bottom - 13, 10, 10);
        ctx.beginPath();
        ctx.moveTo(x, top + h);
        ctx.lineTo(x, bottom - 13);
        ctx.stroke();
        ctx.lineWidth = 1;
      });
    }
    ctx.restore();
  });
}

// ---------- Mysz ----------

function geTlCanvasAt(event) {
  const canvas = event.target.closest?.('.ge-tlt-canvas');
  const n = canvas && geTlNodeOf(canvas.dataset.node);
  const tr = n && geTl(n).tracks.find((t) => t.id === canvas.dataset.track);
  if (!tr) return null;
  const r = canvas.getBoundingClientRect();
  const map = geTlMap(canvas, geTlView(n), tr);
  return { canvas, n, tr, map, x: event.clientX - r.left, y: event.clientY - r.top };
}

// Klucz pod kursorem: { axis, index } albo null.
function geTlKeyAt(hit) {
  const { tr, map, x, y } = hit;
  const axes = tr.type === 'vector' ? GE_TL_AXES.map(([a]) => a).filter((a) => !geTlHidden(tr, a)) : [null];
  let best = null;
  axes.forEach((axis) => geTlKeys(tr, axis).forEach((k, index) => {
    const ky = tr.type === 'color' ? map.h - GE_TL_MARGIN.b - 8 : map.y(Number(k.v) || 0);
    const d = tr.type === 'color' ? Math.abs(map.x(k.t) - x) + (y > map.h - GE_TL_MARGIN.b - 20 ? 0 : 99) : Math.hypot(map.x(k.t) - x, ky - y);
    if (d <= 8 && (!best || d < best.d)) best = { axis, index, d };
  }));
  return best;
}

function geTlSelect(n, tr, axis, index) {
  ge.tlSel = index === null ? null : { node: n.id, track: tr.id, axis, index };
}

// Nowy klucz w punkcie (Shift + klik albo menu). Wektor — na każdej widocznej osi, kolor — kolor z gradientu.
function geTlAddKey(n, tr, t, v) {
  const time = Math.max(0, Math.round(t * 1000) / 1000);
  let sel = null;
  geChange(() => {
    const axes = tr.type === 'vector' ? GE_TL_AXES.map(([a]) => a).filter((a) => !geTlHidden(tr, a)) : [null];
    axes.forEach((axis) => {
      const keys = geTlKeys(tr, axis);
      const key = tr.type === 'event' ? { t: time }
        : tr.type === 'color' ? { t: time, color: (keys.length ? GE_RT.evalColor(keys, time) : '#ffffff').slice(0, 7), a: 1 }
          : { t: time, v: Math.round(v * 1000) / 1000, interp: 'linear', arrive: 0, leave: 0 };
      keys.push(key);
      geTlSorted(keys);
      sel = { axis, index: keys.indexOf(key) };
    });
    if (sel) geTlSelect(n, tr, sel.axis, sel.index);
  }, { bp: geCurBp().id, only: ['timeline', 'code'] });
}

function geTlDeleteKey() {
  const s = ge.tlSel;
  const n = s && geTlNodeOf(s.node);
  const tr = n && geTl(n).tracks.find((t) => t.id === s.track);
  if (!tr) return;
  geChange(() => {
    geTlKeys(tr, s.axis).splice(s.index, 1);
    ge.tlSel = null;
  }, { bp: geCurBp().id, only: ['timeline', 'code'] });
}

function geTlDown(event) {
  const hit = geTlCanvasAt(event);
  if (!hit) return;
  event.preventDefault();
  ge.root.querySelector('.ge-tled')?.focus({ preventScroll: true });
  const { canvas, n, tr, map, x, y } = hit;
  const view = geTlView(n);
  const base = { node: n.id, track: tr.id, cx: event.clientX, cy: event.clientY, moved: false, button: event.button };
  canvas.setPointerCapture(event.pointerId);
  if (event.button !== 0) {
    ge.tlDrag = { ...base, mode: 'pan', t0: view.t0, t1: view.t1, range: { ...map.range }, sx: map.sx, sy: map.sy, x, y };
    return;
  }
  // Uchwyt stycznej zaznaczonego klucza.
  const s = ge.tlSel;
  if (s?.node === n.id && s.track === tr.id && (tr.type === 'float' || tr.type === 'vector')) {
    const handle = geTlHandles(map, geTlKeys(tr, s.axis), s.index).find((hd) => Math.hypot(hd.x - x, hd.y - y) <= 7);
    if (handle) {
      ge.tlDrag = { ...base, mode: 'tangent', side: handle.side, axis: s.axis, index: s.index };
      return;
    }
  }
  const key = geTlKeyAt(hit);
  if (key) {
    geTlSelect(n, tr, key.axis, key.index);
    const k = geTlKeys(tr, key.axis)[key.index];
    ge.tlDrag = { ...base, mode: 'key', axis: key.axis, key: k, ot: k.t, ov: Number(k.v) || 0 };
    geTlRefreshFields();
    geDrawTimeline();
    return;
  }
  if (event.shiftKey) {
    geTlAddKey(n, tr, map.t(x), map.v(y));
    // Karta przebudowała się razem z płótnem — przeciąganie nowego klucza łapie nowe płótno.
    ge.root.querySelector(`.ge-tlt-canvas[data-track="${tr.id}"]`)?.setPointerCapture(event.pointerId);
    const s2 = ge.tlSel;
    const k = s2 && geTlKeys(tr, s2.axis)[s2.index];
    if (k) ge.tlDrag = { ...base, mode: 'key', axis: s2.axis, key: k, ot: k.t, ov: Number(k.v) || 0, moved: true, snap: true };
    return;
  }
  if (ge.tlSel) {
    ge.tlSel = null;
    geTlRefreshFields();
    geDrawTimeline();
  }
}

function geTlMove(event) {
  const d = ge.tlDrag;
  if (!d) return;
  const n = geTlNodeOf(d.node);
  const tr = n && geTl(n).tracks.find((t) => t.id === d.track);
  if (!tr) return;
  const dx = event.clientX - d.cx;
  const dy = event.clientY - d.cy;
  if (!d.moved && Math.hypot(dx, dy) < 3) return;
  const view = geTlView(n);
  if (d.mode === 'pan') {
    d.moved = true;
    const dt = dx / d.sx;
    view.t0 = d.t0 - dt;
    view.t1 = d.t1 - dt;
    if (tr.type === 'float' || tr.type === 'vector') {
      const dv = dy / d.sy;
      view.tracks[tr.id] = { v0: d.range.v0 + dv, v1: d.range.v1 + dv };
    }
    geDrawTimeline();
    return;
  }
  d.moved = true;
  // Jeden krok cofania na całe przeciągnięcie.
  if (!d.snap) {
    d.snap = true;
    geSnapshot();
  }
  const canvas = ge.root.querySelector(`.ge-tlt-canvas[data-track="${tr.id}"]`);
  const map = geTlMap(canvas, view, tr);
  const keys = geTlKeys(tr, d.axis);
  if (d.mode === 'key') {
    d.key.t = Math.max(0, Math.round((d.ot + dx / map.sx) * 1000) / 1000);
    if (tr.type === 'float' || tr.type === 'vector') d.key.v = Math.round((d.ov - dy / map.sy) * 1000) / 1000;
    geTlSorted(keys);
    ge.tlSel = { node: n.id, track: tr.id, axis: d.axis, index: keys.indexOf(d.key) };
  } else if (d.mode === 'tangent') {
    const k = keys[d.index];
    const r = canvas.getBoundingClientRect();
    const hx = event.clientX - r.left - map.x(k.t);
    const hy = event.clientY - r.top - map.y(Number(k.v) || 0);
    // Uchwyt nie może przejść na drugą stronę klucza.
    const px = d.side === 'leave' ? Math.max(1, hx) : Math.min(-1, hx);
    const slope = Math.round((-hy / map.sy / (px / map.sx)) * 1000) / 1000;
    // Jak w Unreal Engine: przeciągnięcie stycznej klucza Auto / Linear zmienia go na User.
    if (k.interp !== 'break') {
      k.interp = 'user';
      k.arrive = slope;
      k.leave = slope;
    } else k[d.side] = slope;
  }
  geDrawTimeline();
  geTlRefreshFields();
}

function geTlUp(event) {
  const d = ge.tlDrag;
  ge.tlDrag = null;
  if (!d) return;
  const canvas = event.target.closest?.('.ge-tlt-canvas');
  if (canvas?.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  const n = geTlNodeOf(d.node);
  const tr = n && geTl(n).tracks.find((t) => t.id === d.track);
  if (!tr) return;
  if (d.mode === 'pan') {
    if (d.button === 2 && !d.moved) geTlContextMenu(event, n, tr);
    return;
  }
  if (d.snap) {
    ge.dirty.add(geCurBp().id);
    geScheduleSave();
    geRefresh(['timeline', 'code']);
  }
}

// Pola zaznaczonego klucza (Time, Value…) na paskach ścieżek — bez przebudowy płócien (przeciąganie trwa dalej).
function geTlRefreshFields() {
  const n = geCurTl();
  if (!n) return;
  geTl(n).tracks.forEach((tr) => {
    const el = ge.root.querySelector(`.ge-tlt[data-track="${tr.id}"] .ge-tlt-fields`);
    if (!el) return;
    const fresh = document.createElement('div');
    fresh.innerHTML = geTlTrackHtml(n, tr);
    el.replaceWith(fresh.querySelector('.ge-tlt-fields'));
  });
}

function geTlContextMenu(event, n, tr) {
  const hit = geTlCanvasAt(event) ?? { tr, map: null };
  const key = hit.map ? geTlKeyAt(hit) : null;
  if (key) {
    geTlSelect(n, tr, key.axis, key.index);
    geRenderTimeline();
    const k = geTlKeys(tr, key.axis)[key.index];
    const interp = tr.type === 'float' || tr.type === 'vector'
      ? [{ heading: 'Interpolacja klucza' }, ...GE_TL_INTERP.map(([id, label]) => ({ label, active: (k.interp ?? 'linear') === id, action: () => geTlSetKey('interp', id) })), '-'] : [];
    geMenu({ x: event.clientX, y: event.clientY }, [...interp, { label: 'Usuń klucz', key: 'Delete', action: geTlDeleteKey }]);
    return;
  }
  const t = hit.map ? hit.map.t(hit.x) : 0;
  const v = hit.map ? hit.map.v(hit.y) : 0;
  geMenu({ x: event.clientX, y: event.clientY }, [
    { label: `Dodaj klucz (czas ${geTlFmt(Math.max(0, t))})`, key: 'Shift+klik', action: () => geTlAddKey(n, tr, t, v) },
    { label: 'Dopasuj widok', key: 'F', action: () => { geTlFit(n); geDrawTimeline(); } }
  ]);
}

function geTlWheel(event) {
  const hit = geTlCanvasAt(event);
  if (!hit) return;
  event.preventDefault();
  const { n, tr, map, x, y } = hit;
  const view = geTlView(n);
  const f = Math.exp(event.deltaY * 0.0015);
  if (event.ctrlKey && (tr.type === 'float' || tr.type === 'vector')) {
    const v = map.v(y);
    view.tracks[tr.id] = { v0: v - (v - map.range.v0) * f, v1: v + (map.range.v1 - v) * f };
  } else {
    const t = map.t(x);
    view.t0 = t - (t - view.t0) * f;
    view.t1 = t + (view.t1 - t) * f;
  }
  geDrawTimeline();
}

// ---------- Zmiany z pól i przycisków ----------

// Zmiana pola zaznaczonego klucza (także z menu interpolacji).
function geTlSetKey(key, value) {
  const s = ge.tlSel;
  const n = s && geTlNodeOf(s.node);
  const tr = n && geTl(n).tracks.find((t) => t.id === s.track);
  const keys = tr && geTlKeys(tr, s.axis);
  const k = keys?.[s.index];
  if (!k) return;
  geChange(() => {
    if (key === 't') k.t = Math.max(0, Number(value) || 0);
    else if (key === 'a') k.a = Math.min(1, Math.max(0, Number(value) || 0));
    else if (key === 'color' || key === 'interp') {
      // Nowe styczne User / Break zaczynają od tych, które klucz miał do tej pory.
      if (key === 'interp' && (value === 'user' || value === 'break') && !['user', 'break'].includes(k.interp)) {
        k.arrive = GE_RT.keyTangent(keys, s.index, 'arrive');
        k.leave = value === 'user' ? k.arrive : GE_RT.keyTangent(keys, s.index, 'leave');
      }
      k[key] = value;
    } else {
      k[key] = Number(value) || 0;
      if (key === 'arrive' && k.interp === 'user') k.leave = k.arrive;
    }
    geTlSorted(keys);
    s.index = keys.indexOf(k);
  }, { bp: geCurBp().id, only: ['timeline', 'code'] });
}

function geTlChange(scope, key, value, el, bp) {
  const n = geNodeById(el.dataset.node);
  if (!n || n.type !== 'timeline') return;
  const tl = geTl(n);
  if (scope === 'tl') {
    geChange(() => {
      if (key === 'length') tl.length = Math.max(0, Number(value) || 0);
      else tl[key] = !!value;
    }, { bp: bp.id, only: ['timeline', 'details', 'code', 'graph', 'mybp'] });
    return;
  }
  const tr = tl.tracks.find((t) => t.id === el.dataset.id);
  if (!tr) return;
  if (scope === 'tl-track') {
    const name = String(value).trim();
    if (name) geChange(() => { tr.name = geUniqueName(name, tl.tracks.filter((t) => t !== tr).map((t) => t.name)); }, { bp: bp.id, only: ['timeline', 'details', 'code', 'graph', 'mybp'] });
    else geRenderTimeline();
    return;
  }
  ge.tlSel = { node: n.id, track: tr.id, axis: el.dataset.axis || null, index: Number(el.dataset.i) };
  geTlSetKey(key, value);
}

function geTlAddTrack(n, type) {
  const tl = geTl(n);
  geChange(() => {
    const id = 't' + tl.nextTrack++;
    let i = 0;
    while (tl.tracks.some((t) => t.name === 'NewTrack_' + i)) i++;
    const tr = { id, name: 'NewTrack_' + i, type };
    if (type === 'vector') Object.assign(tr, { x: [], y: [] });
    else tr.keys = [];
    tl.tracks.push(tr);
  }, { bp: geCurBp().id, only: ['timeline', 'details', 'code', 'graph', 'mybp'] });
}

async function geTlDeleteTrack(n, id) {
  const tl = geTl(n);
  const tr = tl.tracks.find((t) => t.id === id);
  if (!tr) return;
  const bp = geCurBp();
  const pin = geTlPin(tr);
  const linked = bp.graph.links.some((l) => (l.from[0] === n.id && l.from[1] === pin));
  if (linked) {
    const ok = await geDialog({ title: 'Usunąć ścieżkę?', text: `Pin <b>${geEsc(tr.name)}</b> węzła ${geEsc(n.props?.name)} jest podłączony. Usunę ścieżkę razem z jego kablami.`, buttons: [{ label: 'Usuń', value: true, primary: true }, { label: 'Anuluj', value: false }] });
    if (!ok) return;
  }
  geChange(() => {
    tl.tracks = tl.tracks.filter((t) => t !== tr);
    bp.graph.links = bp.graph.links.filter((l) => !(l.from[0] === n.id && l.from[1] === pin));
    if (ge.tlSel?.track === id) ge.tlSel = null;
  }, { bp: bp.id, only: ['timeline', 'details', 'code', 'graph', 'mybp'] });
}

function geTlClick(btn) {
  const n = geNodeById(btn.dataset.node);
  if (!n || n.type !== 'timeline') return;
  const id = btn.dataset.id;
  switch (btn.dataset.ge) {
    case 'tl-add-track':
      geMenu(btn, [{ heading: 'Dodaj ścieżkę' }, ...Object.entries(GE_TL_TRACKS).map(([type, t]) => ({
        label: `${t.icon}  Add ${t.label}`, action: () => geTlAddTrack(n, type)
      }))]);
      break;
    case 'tl-del-track': geTlDeleteTrack(n, id); break;
    case 'tl-fit':
      geTlFit(n);
      geDrawTimeline();
      break;
    case 'tl-fit-track': {
      const tr = geTl(n).tracks.find((t) => t.id === id);
      if (tr) geTlFitTrack(tr, geTlView(n));
      geDrawTimeline();
      break;
    }
    case 'tl-axis': {
      ge.tlHidden = ge.tlHidden ?? new Set();
      const k = `${id}:${btn.dataset.axis}`;
      if (ge.tlHidden.has(k)) ge.tlHidden.delete(k);
      else ge.tlHidden.add(k);
      if (ge.tlSel?.track === id && ge.tlSel.axis === btn.dataset.axis) ge.tlSel = null;
      geRenderTimeline();
      break;
    }
    default:
  }
}

function geTlHandleKey(event, del) {
  if (del) {
    event.preventDefault();
    if (ge.tlSel) geTlDeleteKey();
  } else if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey) {
    geTlFit(geCurTl());
    geDrawTimeline();
  }
}
