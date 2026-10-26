// Wątek roboczy rotoskopii (uruchamia go game-rotoscope.js, kilka naraz): wycinanie postaci, AI i styl klatek
// liczą się tu, poza oknem edytora, więc kilka klatek powstaje jednocześnie, a edytor nie zamarza.
// Zadanie przychodzi jako { type, ... }, odpowiedź to { result } albo { error }:
//   detect — AI (MediaPipe Pose Landmarker) na klatce: maska człowieka w rozmiarze klatki i szkielet,
//   cut    — wycinek postaci z klatki (sposób z o.mode; przy AI z gotowej maski),
// Oba dostają matte — miejsca zamalowane pędzlem „Maluj tło” (1 = zawsze tło): AI ich nie widzi, a postaci tam nie wycinamy.
//   style  — styl i kontur na gotowej komórce arkusza.

const GE_ROTO_DIR = 'vendor/mediapipe/';

// Każdy wątek ma własny model — wczytuje go przy pierwszej klatce z AI i trzyma do końca sesji edytora.
let geRotoPose = null;

const geRotoRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0);

function geRotoModel() {
  if (!geRotoPose) {
    geRotoPose = (async () => {
      if (!self.Vision) importScripts(GE_ROTO_DIR + 'vision_bundle.js');
      return Vision.PoseLandmarker.createFromOptions(
        { wasmLoaderPath: GE_ROTO_DIR + 'vision_wasm_internal.js', wasmBinaryPath: GE_ROTO_DIR + 'vision_wasm_internal.wasm' },
        { baseOptions: { modelAssetPath: GE_ROTO_DIR + 'pose_landmarker_full.task', delegate: 'CPU' }, runningMode: 'IMAGE', numPoses: 1, outputSegmentationMasks: true }
      );
    })();
    geRotoPose.catch(() => { geRotoPose = null; });
  }
  return geRotoPose;
}

// Maska człowieka (0–1) przeskalowana do rozmiaru klatki i szkielet w jej pikselach; null, gdy nikogo nie ma w kadrze.
async function geRotoDetect(img, matte) {
  const model = await geRotoModel();
  const { width: w, height: h } = img;
  // Zamalowane tło zakrywamy szarością — np. druga osoba w kadrze nie odciągnie AI od postaci.
  if (matte) for (let i = 0; i < matte.length; i++) if (matte[i]) img.data.fill(128, i * 4, i * 4 + 3);
  const result = model.detect(img);
  const m = result.segmentationMasks?.[0];
  let mask = null;
  if (m) {
    const src = m.getAsFloat32Array();
    const { width: mw, height: mh } = m;
    mask = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = Math.min(mh - 1, Math.floor((y * mh) / h)) * mw;
      for (let x = 0; x < w; x++) mask[y * w + x] = src[row + Math.min(mw - 1, Math.floor((x * mw) / w))];
    }
  }
  const pose = result.landmarks?.[0]?.map((p) => ({ x: p.x * w, y: p.y * h, z: p.z })) ?? null;
  result.segmentationMasks?.forEach((one) => one.close());
  return { mask, pose };
}

// Rozmycie pudełkowe (w miejscu) — uspokaja szum kamery przed porównaniem z tłem.
function geRotoBlur(values, w, h, r) {
  const tmp = new Float32Array(values.length);
  const pass = (src, dst, along, across, step, line) => {
    for (let a = 0; a < across; a++) {
      let sum = 0;
      const base = a * line;
      for (let i = -r; i <= r; i++) sum += src[base + Math.min(along - 1, Math.max(0, i)) * step];
      for (let i = 0; i < along; i++) {
        dst[base + i * step] = sum / (r * 2 + 1);
        sum += src[base + Math.min(along - 1, i + r + 1) * step] - src[base + Math.max(0, i - r) * step];
      }
    }
  };
  pass(values, tmp, w, h, 1, w);
  pass(tmp, values, h, w, w, 1);
}

// Zostawia duże plamy postaci (co najmniej 20% największej), a kropki szumu w tle usuwa.
// seed — punkt „To postać”: zostaje plama najbliżej niego i jej kawałki obok (ręka, noga), reszta ruchu w kadrze znika;
// clean — przy seed usuwa też kropki szumu w polu postaci.
function geRotoKeepBlobs(alpha, w, h, seed = null, clean = true) {
  const label = new Int32Array(w * h);
  const sizes = [0];
  const near = [Infinity];
  const boxes = [null];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < alpha.length; start++) {
    if (label[start] || alpha[start] < 40) continue;
    const id = sizes.length;
    let top = 0;
    let size = 0;
    let dist = Infinity;
    const box = [w, h, -1, -1];
    stack[top++] = start;
    label[start] = id;
    while (top) {
      const i = stack[--top];
      size++;
      const x = i % w;
      if (seed) {
        const y = (i - x) / w;
        dist = Math.min(dist, (x - seed.x) ** 2 + (y - seed.y) ** 2);
        box[0] = Math.min(box[0], x);
        box[1] = Math.min(box[1], y);
        box[2] = Math.max(box[2], x);
        box[3] = Math.max(box[3], y);
      }
      const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const j of next) {
        if (j < 0 || j >= alpha.length || label[j] || alpha[j] < 40) continue;
        label[j] = id;
        stack[top++] = j;
      }
    }
    sizes.push(size);
    near.push(dist);
    boxes.push(box);
  }
  const biggest = Math.max(...sizes);
  if (!seed) {
    for (let i = 0; i < alpha.length; i++) if (sizes[label[i]] < biggest * 0.2) alpha[i] = 0;
    return;
  }
  // Najbliższa plama — ale nie kropka szumu tuż obok punktu.
  let best = 0;
  for (let id = 1; id < sizes.length; id++) if (sizes[id] >= Math.max(20, biggest * 0.01) && near[id] < near[best]) best = id;
  if (!best) return;
  const [bx0, by0, bx1, by1] = boxes[best];
  const m = Math.max(bx1 - bx0, by1 - by0) * 0.15;
  const keep = sizes.map((size, id) => {
    if (id === best) return true;
    if (!id || size < (clean ? sizes[best] * 0.05 : 0)) return false;
    const [x0, y0, x1, y1] = boxes[id];
    return x1 >= bx0 - m && x0 <= bx1 + m && y1 >= by0 - m && y0 <= by1 + m;
  });
  for (let i = 0; i < alpha.length; i++) if (!keep[label[i]]) alpha[i] = 0;
}

// Wycinek postaci: { img (tylko pole postaci), x, y, cx, cy } albo null — na klatce nie ma postaci.
// bg — klatka z pustym tłem (tryb diff), mask — maska z AI w rozmiarze klatki (tryb ai),
// matte — zamalowane tło, seed — punkt „To postać” (tryby key i diff).
function geRotoCut(img, o, bg, mask, matte, seed) {
  const { width: w, height: h, data: d } = img;
  const n = w * h;
  const alpha = new Uint8ClampedArray(n);
  if (o.mode === 'key') {
    const [kr, kg, kb] = geRotoRgb(o.key);
    const lo = o.keyTol * 4.42;
    const soft = Math.max(1, o.keySoft * 4.42);
    for (let i = 0; i < n; i++) alpha[i] = ((Math.hypot(d[i * 4] - kr, d[i * 4 + 1] - kg, d[i * 4 + 2] - kb) - lo) / soft) * 255;
  } else if (o.mode === 'diff') {
    const b = bg.data;
    const diff = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      diff[i] = Math.max(Math.abs(d[j] - b[j]), Math.abs(d[j + 1] - b[j + 1]), Math.abs(d[j + 2] - b[j + 2]));
    }
    geRotoBlur(diff, w, h, 2);
    const lo = o.diffTol * 2.55;
    const soft = Math.max(1, o.diffSoft * 2.55);
    for (let i = 0; i < n; i++) alpha[i] = ((diff[i] - lo) / soft) * 255;
  } else {
    const lo = o.aiThr - 0.12;
    for (let i = 0; i < n; i++) alpha[i] = ((mask[i] - lo) / 0.24) * 255;
  }
  if (matte) for (let i = 0; i < n; i++) if (matte[i]) alpha[i] = 0;
  if (o.clean || seed) geRotoKeepBlobs(alpha, w, h, seed, o.clean);
  // Poświata: zielone tło odbija się na brzegach postaci — przycinamy kanał koloru tła do pozostałych.
  const key = geRotoRgb(o.key);
  const c = key.indexOf(Math.max(...key));
  const despill = o.mode === 'key' && o.despill && Math.max(...key) - Math.min(...key) > 60;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  let mass = 0;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    d[i * 4 + 3] = alpha[i];
    if (alpha[i] < 24) continue;
    mass += alpha[i];
    sumX += (i % w) * alpha[i];
    sumY += Math.floor(i / w) * alpha[i];
    if (despill) d[i * 4 + c] = Math.min(d[i * 4 + c], Math.max(d[i * 4 + (c + 1) % 3], d[i * 4 + (c + 2) % 3]));
    const x = i % w;
    const y = (i - x) / w;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  if (x1 < 0) return null;
  const cw = x1 - x0 + 1;
  const out = new ImageData(cw, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) out.data.set(d.subarray((y * w + x0) * 4, (y * w + x1 + 1) * 4), (y - y0) * cw * 4);
  // cx, cy — środek ciężkości postaci. Przy „Postać w miejscu” klatki wyrównujemy do cx, a punkt „To postać”
  // następnej klatki stawiamy w (cx, cy) — tak śledzimy postać, która idzie przez kadr.
  return { img: out, x: x0, y: y0, cx: sumX / mass, cy: sumY / mass };
}

// Styl na gotowej komórce (w pikselach arkusza, więc kontur ma dokładnie tyle px, ile ustawiono).
function geRotoStylize(img, o) {
  const { width: w, height: h, data: d } = img;
  const n = w * h;
  const [lr, lg, lb] = geRotoRgb(o.outlineColor);
  let edges = null;
  if (o.style === 'cartoon') {
    // Kreski tam, gdzie jasność zmienia się gwałtownie (filtr Sobela) — jak tusz w komiksie.
    const lum = new Float32Array(n);
    for (let i = 0; i < n; i++) lum[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
    edges = new Uint8Array(n);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (d[i * 4 + 3] < 128) continue;
        const gx = lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1];
        const gy = lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1];
        edges[i] = Math.hypot(gx, gy) > 140 ? 1 : 0;
      }
    }
  }
  if (o.style === 'poster' || o.style === 'cartoon') {
    const k = Math.max(1, o.levels - 1);
    for (let i = 0; i < n * 4; i++) if (i % 4 !== 3) d[i] = (Math.round((d[i] / 255) * k) / k) * 255;
  }
  if (o.style === 'flat') {
    const [fr, fg, fb] = geRotoRgb(o.flat);
    for (let i = 0; i < n; i++) [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]] = [fr, fg, fb];
  }
  if (edges) for (let i = 0; i < n; i++) if (edges[i]) [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]] = [lr, lg, lb];
  if (o.outline > 0) {
    // Kontur wokół sylwetki: maska pogrubiona o o.outline px (na zmianę krzyżyk i kwadrat — prawie okrąg).
    let grown = new Uint8Array(n);
    for (let i = 0; i < n; i++) grown[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    for (let step = 0; step < Math.round(o.outline); step++) {
      const next = grown.slice();
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (grown[i]) continue;
          const near = (x > 0 && grown[i - 1]) || (x < w - 1 && grown[i + 1]) || (y > 0 && grown[i - w]) || (y < h - 1 && grown[i + w])
            || (step % 2 === 1 && ((x > 0 && y > 0 && grown[i - w - 1]) || (x < w - 1 && y > 0 && grown[i - w + 1]) || (x > 0 && y < h - 1 && grown[i + w - 1]) || (x < w - 1 && y < h - 1 && grown[i + w + 1])));
          if (near) next[i] = 1;
        }
      }
      grown = next;
    }
    for (let i = 0; i < n; i++) {
      if (!grown[i]) continue;
      const a = d[i * 4 + 3] / 255;
      d[i * 4] = d[i * 4] * a + lr * (1 - a);
      d[i * 4 + 1] = d[i * 4 + 1] * a + lg * (1 - a);
      d[i * 4 + 2] = d[i * 4 + 2] * a + lb * (1 - a);
      d[i * 4 + 3] = 255;
    }
  }
  return img;
}

self.onmessage = async ({ data: job }) => {
  try {
    let result;
    let send = [];
    if (job.type === 'detect') {
      result = await geRotoDetect(job.img, job.matte);
      if (result.mask) send = [result.mask.buffer];
    } else if (job.type === 'cut') {
      result = geRotoCut(job.img, job.o, job.bg, job.mask, job.matte, job.seed);
      if (result) send = [result.img.data.buffer];
    } else {
      result = geRotoStylize(job.img, job.o);
      send = [result.data.buffer];
    }
    self.postMessage({ result }, send);
  } catch (err) {
    self.postMessage({ error: String(err?.message || err) });
  }
};
