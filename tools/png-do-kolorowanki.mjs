// Zamienia czarno-białe kolorowanki PNG z assets/coloring na SVG dla zadania „Kolorowanka online”,
// a z każdego assets/coloring/*.svg robi skrypt <nazwa>.js, który gra wczytuje po wyborze obrazka
// (działa też z pliku file://, gdzie fetch jest zablokowany).
// Uruchom z katalogu projektu: node tools/png-do-kolorowanki.mjs  (potrzebny ffmpeg w PATH).
//
// Białe obszary obrazka stają się polami (class="c"). Pola mniejsze niż REQUIRED_REGION są opcjonalne
// (data-optional) — można je pokolorować, ale nie trzeba; okruchy mniejsze niż MIN_REGION znikają pod
// liniami. Pola rozrastają się pod czarne linie, więc między farbą a linią nie zostaje biała szczelina.
// Linie obrysowujemy z obrazka powiększonego 2× i rysujemy jedną ścieżką nad polami.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const DIR = 'assets/coloring';
const VIEW_W = 800;
const VIEW_H = 600;
const REGION_W = 1200;
const REGION_H = 900;
const REQUIRED_REGION = 3000; // px² przy 1200×900 — ok. 36×36 jednostek obrazka 800×600
const MIN_REGION = 60;
const LINE_W = 2400;
const LINE_H = 1800;
const MIN_SPECK = 40; // czarne kropki mniejsze od tego (px² przy 2400×1800) to szum
const INK = 128;

// Niektóre ilustracje mają bardzo wąskie przejścia między semantycznie osobnymi polami.
// Wirtualnie pogrubiamy linie tylko podczas segmentacji; widoczny kontur nadal pochodzi
// z niezmienionego PNG. Dzięki temu wiaderko nie łączy np. nieba z roślinnością.
const REGION_EROSION = { stworki: 7 };

function readGray(file, width, height) {
  return execFileSync('ffmpeg', [
    '-v', 'error', '-i', file,
    '-vf', `scale=${width}:${height}:flags=bicubic`,
    '-f', 'rawvideo', '-pix_fmt', 'gray', '-'
  ], { maxBuffer: width * height + 1024 });
}

// Spójne składowe (sąsiedztwo 4) pikseli spełniających warunek: etykiety i rozmiary.
function components(width, height, inside) {
  const label = new Int32Array(width * height).fill(-1);
  const sizes = [];
  const stack = new Int32Array(width * height);
  for (let start = 0; start < width * height; start++) {
    if (label[start] >= 0 || !inside(start)) continue;
    const id = sizes.length;
    let top = 0;
    let size = 0;
    stack[top++] = start;
    label[start] = id;
    while (top) {
      const p = stack[--top];
      size++;
      const x = p % width;
      const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width];
      for (const q of neighbours) {
        if (q >= 0 && q < width * height && label[q] < 0 && inside(q)) {
          label[q] = id;
          stack[top++] = q;
        }
      }
    }
    sizes.push(size);
  }
  return { label, sizes };
}

// Odległość Manhattan każdego piksela od czarnego konturu. Pole o marginesie N
// zachowuje tylko piksele odległe od linii o więcej niż N pikseli.
function distanceFromInk(gray, width, height) {
  const distance = new Uint16Array(width * height);
  distance.fill(65535);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  for (let p = 0; p < distance.length; p++) {
    if (gray[p] < INK) {
      distance[p] = 0;
      queue[tail++] = p;
    }
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const next = distance[p] + 1;
    const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width];
    for (const q of neighbours) {
      if (q >= 0 && q < distance.length && distance[q] > next) {
        distance[q] = next;
        queue[tail++] = q;
      }
    }
  }
  return distance;
}

// Kontury obszaru po krawędziach pikseli: wnętrze zawsze po prawej, dziury jako osobne pętle.
function traceLoops(width, height, owner, count) {
  const corner = (x, y) => y * (width + 1) + x;
  const edges = Array.from({ length: count }, () => new Map());
  const add = (region, from, to) => {
    const map = edges[region];
    if (map.has(from)) map.get(from).push(to);
    else map.set(from, [to]);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const region = owner[y * width + x];
      if (region < 0) continue;
      if (y === 0 || owner[(y - 1) * width + x] !== region) add(region, corner(x, y), corner(x + 1, y));
      if (x === width - 1 || owner[y * width + x + 1] !== region) add(region, corner(x + 1, y), corner(x + 1, y + 1));
      if (y === height - 1 || owner[(y + 1) * width + x] !== region) add(region, corner(x + 1, y + 1), corner(x, y + 1));
      if (x === 0 || owner[y * width + x - 1] !== region) add(region, corner(x, y + 1), corner(x, y));
    }
  }
  return edges.map((map) => {
    const loops = [];
    for (const [start, ends] of map) {
      while (ends.length) {
        const loop = [start];
        let at = ends.pop();
        while (at !== start) {
          loop.push(at);
          at = map.get(at).pop();
        }
        loops.push(loop.map((c) => [c % (width + 1), Math.floor(c / (width + 1))]));
      }
    }
    return loops;
  });
}

function segmentDistance([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function simplifyOpen(points, tolerance) {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const ranges = [[0, points.length - 1]];
  while (ranges.length) {
    const [a, b] = ranges.pop();
    let worst = 0;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const distance = segmentDistance(points[i], points[a], points[b]);
      if (distance > worst) { worst = distance; index = i; }
    }
    if (worst > tolerance) {
      keep[index] = 1;
      ranges.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// Zamknięta pętla: tniemy w najdalszym od startu punkcie i upraszczamy obie połówki (Douglas–Peucker).
function simplifyLoop(loop, tolerance) {
  let far = 0;
  let best = -1;
  loop.forEach(([x, y], i) => {
    const distance = Math.hypot(x - loop[0][0], y - loop[0][1]);
    if (distance > best) { best = distance; far = i; }
  });
  const first = simplifyOpen(loop.slice(0, far + 1), tolerance);
  const second = simplifyOpen([...loop.slice(far), loop[0]], tolerance);
  return [...first, ...second.slice(1, -1)];
}

// Ścieżka ze współrzędnymi względnymi (zaokrąglonymi do 0,1 jednostki), żeby plik był mniejszy.
function pathData(loops, scale, tolerance) {
  const tenths = (value) => Math.round(value * scale * 10);
  const number = (value) => String(value / 10).replace(/^(-?)0\./, '$1.');
  const pair = (x, y) => `${number(x)}${y < 0 ? '' : ','}${number(y)}`;
  return loops
    .map((loop) => simplifyLoop(loop, tolerance).map(([x, y]) => [tenths(x), tenths(y)]))
    .filter((loop) => loop.length >= 3)
    .map((loop) => {
      const moves = loop.slice(1).map(([x, y], i) => pair(x - loop[i][0], y - loop[i][1]));
      return `M${pair(...loop[0])}l${moves.join(' ')}z`;
    })
    .join('');
}

function regionPaths(file) {
  const gray = readGray(file, REGION_W, REGION_H);
  const name = file.slice(file.lastIndexOf('/') + 1, -4);
  const erosion = REGION_EROSION[name] || 0;
  const distance = erosion ? distanceFromInk(gray, REGION_W, REGION_H) : null;
  const { label, sizes } = components(REGION_W, REGION_H, (p) =>
    gray[p] >= INK && (!distance || distance[p] > erosion));

  // Białe obszary to pola, posortowane od największego — mniejsze leżą wyżej.
  const order = sizes.map((size, id) => [size, id]).filter(([size]) => size >= MIN_REGION).sort((a, b) => b[0] - a[0]);
  const regionOf = new Int32Array(sizes.length).fill(-1);
  order.forEach(([, id], index) => { regionOf[id] = index; });

  // Linie i okruchy dostają pole, do którego mają najbliżej (BFS ze wszystkich pól naraz).
  const owner = new Int32Array(REGION_W * REGION_H).fill(-1);
  const queue = new Int32Array(REGION_W * REGION_H);
  let head = 0;
  let tail = 0;
  for (let p = 0; p < owner.length; p++) {
    if (label[p] >= 0 && regionOf[label[p]] >= 0) {
      owner[p] = regionOf[label[p]];
      queue[tail++] = p;
    }
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % REGION_W;
    const neighbours = [x > 0 ? p - 1 : -1, x < REGION_W - 1 ? p + 1 : -1, p - REGION_W, p + REGION_W];
    for (const q of neighbours) {
      if (q >= 0 && q < owner.length && owner[q] < 0) {
        owner[q] = owner[p];
        queue[tail++] = q;
      }
    }
  }

  return traceLoops(REGION_W, REGION_H, owner, order.length).map((loops, index) => ({
    d: pathData(loops, VIEW_W / REGION_W, 1),
    optional: order[index][0] < REQUIRED_REGION
  }));
}

function linePath(file) {
  const gray = readGray(file, LINE_W, LINE_H);
  const { label, sizes } = components(LINE_W, LINE_H, (p) => gray[p] < INK);
  const owner = new Int32Array(LINE_W * LINE_H).fill(-1);
  for (let p = 0; p < owner.length; p++) {
    if (label[p] >= 0 && sizes[label[p]] >= MIN_SPECK) owner[p] = 0;
  }
  return pathData(traceLoops(LINE_W, LINE_H, owner, 1)[0], VIEW_W / LINE_W, 0.9);
}

function pngToSvg(name) {
  const file = `${DIR}/${name}.png`;
  const regions = regionPaths(file);
  const lines = linePath(file);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" width="${VIEW_W}" height="${VIEW_H}">`,
    ...regions.map(({ d, optional }, i) =>
      `  <path id="pole-${i + 1}" class="c" d="${d}" fill="#ffffff" fill-rule="evenodd" clip-rule="evenodd"${optional ? ' data-optional=""' : ''}/>`),
    `  <path id="linie" pointer-events="none" d="${lines}" fill="#222222" fill-rule="evenodd"/>`,
    '</svg>',
    ''
  ].join('\n');
  fs.writeFileSync(`${DIR}/${name}.svg`, svg);
  const required = regions.filter((region) => !region.optional).length;
  console.log(`${name}.svg: ${required} pól + ${regions.length - required} opcjonalnych, ${Math.round(svg.length / 1024)} KB`);
}

function svgToScript(name) {
  const svg = fs.readFileSync(`${DIR}/${name}.svg`, 'utf8').trimEnd();
  fs.writeFileSync(`${DIR}/${name}.js`, [
    `// Wygenerowane z ${name}.svg przez tools/png-do-kolorowanki.mjs — nie edytuj ręcznie.`,
    `COLORING_SVGS['${name}'] = \`${svg}\`;`,
    ''
  ].join('\n'));
}

fs.readdirSync(DIR).filter((file) => file.endsWith('.png')).forEach((file) => pngToSvg(file.slice(0, -4)));
fs.readdirSync(DIR).filter((file) => file.endsWith('.svg')).forEach((file) => svgToScript(file.slice(0, -4)));
