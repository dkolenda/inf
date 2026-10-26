// Rotoskopia — animacja postaci 2D z nagrania wideo, bez rysowania klatek ręcznie.
// Okno otwiera „＋ Dodaj › Animacja z wideo” albo import pliku wideo w Przeglądarce zawartości.
// Sposób wycinania postaci (opts.mode):
//   key  — jednolite tło (np. zielona ściana): piksele w kolorze tła stają się przezroczyste,
//   diff — nieruchoma kamera: postać to wszystko, czym klatka różni się od klatki z pustym tłem,
//   ai   — MediaPipe Pose Landmarker wycina człowieka z dowolnego tła (maska segmentacji),
//   pose — ten sam model daje szkielet (33 punkty), na którym rysujemy prostą postać — w grze nie ma nagrania.
// Model (src/vendor/mediapipe) działa offline i wczytuje się dopiero przy pierwszym użyciu AI.
// Na podglądzie nagrania można pomóc wycinaniu: „Maluj tło” zaznacza miejsca, w których nigdy nie ma postaci
// (ro.matte — to samo miejsce na każdej klatce, więc przydaje się przy nieruchomej kamerze), a „To postać”
// (ro.seed, tryby key i diff) wskazuje, którą z ruchomych plam wyciąć — dalej punkt idzie za postacią klatka po klatce.
// Klatki z nagrania odczytujemy tu po kolei, a wycinanie, AI i styl liczy kilka wątków roboczych naraz
// (game-rotoscope-worker.js) — szybciej, a okno edytora nie zamarza.
// Gotowe klatki składamy w arkusz i dodajemy do projektu jak animację z Web Pivot Animatora (geImportAnimationFile).

const GE_ROTO_DIR = 'vendor/mediapipe/';
// Wysokość klatki roboczej (px), na której wycinamy postać — niezależnie od rozdzielczości nagrania.
const GE_ROTO_WORK = 360;
const GE_ROTO_MAX_FRAMES = 120;
const GE_ROTO_SHEET = 4096;
const GE_ROTO_MODES = [
  ['key', '🟩', 'Jednolite tło', 'Nagranie na tle w jednym kolorze (zielona albo biała ściana). Kliknij tło na podglądzie nagrania, żeby wybrać jego kolor.'],
  ['diff', '📷', 'Nieruchoma kamera', 'Kamera stoi w miejscu, a na początku albo końcu nagrania nie ma nikogo w kadrze — wskaż tę klatkę z pustym tłem.'],
  ['ai', '🤖', 'AI: wytnij osobę', 'Sztuczna inteligencja wycina człowieka z dowolnego tła. Postać w grze wygląda jak na nagraniu.'],
  ['pose', '🦴', 'AI: szkielet → postać', 'AI rozpoznaje ręce, nogi i głowę, a ruch przenosi na narysowaną postać — w grze nie widać nagrania.']
];
const GE_ROTO_STYLES = [['none', 'Oryginalne kolory'], ['poster', 'Plakat (mniej kolorów)'], ['cartoon', 'Kreskówka (kolory i kreski)'], ['flat', 'Sylwetka (jeden kolor)']];
const GE_ROTO_FIGURES = [['puppet', 'Ludzik'], ['stick', 'Patyczak']];
const GE_ROTO_DEFAULTS = {
  mode: 'key', start: 0, end: 3, fps: 12, height: 128, loop: true, inPlace: true,
  key: '#00b140', keyTol: 22, keySoft: 10, despill: true,
  bgTime: 0, diffTol: 10, diffSoft: 8,
  aiThr: 0.5, aiSmooth: true, clean: true, brush: 24,
  style: 'none', levels: 4, flat: '#2b2b2b', outline: 2, outlineColor: '#141414',
  figure: 'puppet', shirt: '#3d8ee6', pants: '#3b4a6b', skin: '#f2c49b'
};
// Ustawienia, które zależą od konkretnego nagrania — nie przechodzą na następne.
const GE_ROTO_PER_VIDEO = ['start', 'end', 'bgTime'];

// Liczba wątków roboczych — o jeden mniej niż rdzeni procesora (zostaje dla okna edytora), najwyżej 4,
// bo każdy wątek z AI trzyma w pamięci własny model.
const GE_ROTO_THREADS = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));

const geRotoHex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

function geRotoCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
}

// Składanie arkusza liczy w głównym wątku i na chwilę blokuje okno — przed takim krokiem dajemy przeglądarce
// narysować napis o tym, co się dzieje (inaczej edytor wygląda na zawieszony).
// Zminimalizowane okno nie rysuje klatek (requestAnimationFrame stoi), więc czekamy najwyżej 50 ms.
const geRotoPaint = () => new Promise((resolve) => {
  const go = () => setTimeout(resolve);
  requestAnimationFrame(go);
  setTimeout(go, 50);
});

// ---------- Wątki robocze ----------

// Wątki (game-rotoscope-worker.js) powstają przy pierwszym zadaniu i zostają do końca sesji edytora.
// Każdy liczy jedno zadanie naraz; reszta czeka w kolejce. aiReady — któryś wątek ma już wczytany model AI.
const geRotoPool = { workers: [], queue: [], aiReady: false };

// Zadanie dla wolnego wątku ({ type: 'detect' | 'cut' | 'style', ... }) → obietnica wyniku.
// send — bufory oddawane wątkowi bez kopiowania (po wysłaniu przestają działać tutaj).
function geRotoRun(job, send = []) {
  return new Promise((resolve, reject) => {
    geRotoPool.queue.push({ job, send, resolve, reject });
    geRotoPump();
  });
}

function geRotoPump() {
  const pool = geRotoPool;
  while (pool.queue.length) {
    let worker = pool.workers.find((w) => !w.task);
    if (!worker && pool.workers.length < GE_ROTO_THREADS) worker = geRotoWorker();
    if (!worker) return;
    worker.task = pool.queue.shift();
    worker.postMessage(worker.task.job, worker.task.send);
  }
}

function geRotoWorker() {
  const pool = geRotoPool;
  const worker = new Worker('game-rotoscope-worker.js');
  worker.task = null;
  worker.onmessage = ({ data }) => {
    const task = worker.task;
    worker.task = null;
    if (data.error) {
      // Po błędzie AI (Aborted) model w wątku jest zepsuty i następne klatki by na nim utknęły — wątek wyrzucamy.
      if (task.job.type === 'detect') {
        worker.terminate();
        pool.workers.splice(pool.workers.indexOf(worker), 1);
      }
      task.reject(new Error(data.error));
    } else {
      if (task.job.type === 'detect') pool.aiReady = true;
      task.resolve(data.result);
    }
    geRotoPump();
  };
  // Wątek, który się wysypał (np. brak pliku), wyrzucamy — następne zadanie dostanie nowy.
  worker.onerror = (event) => {
    event.preventDefault();
    worker.terminate();
    pool.workers.splice(pool.workers.indexOf(worker), 1);
    worker.task?.reject(new Error(event.message || 'błąd wątku roboczego'));
    geRotoPump();
  };
  pool.workers.push(worker);
  return worker;
}

// ---------- Klatki nagrania ----------

function geRotoSeek(video, t) {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      resolve();
    };
    const timer = setTimeout(done, 4000);
    video.addEventListener('seeked', done);
    video.currentTime = Math.min(Math.max(0, t), Math.max(0, video.duration - 0.001));
  });
}

// Klatka z chwili t w rozmiarze roboczym; zostaje też na ro.work (z niego rysujemy podgląd nagrania).
async function geRotoGrab(ro, t) {
  await geRotoSeek(ro.video, t);
  const ctx = ro.work.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(ro.video, 0, 0, ro.work.width, ro.work.height);
  return ctx.getImageData(0, 0, ro.work.width, ro.work.height);
}

// Wideo ma jeden suwak czasu, więc podgląd i generowanie czekają na siebie w kolejce.
function geRotoQueue(ro, job) {
  const run = ro.lock.then(job);
  ro.lock = run.catch(() => {});
  return run;
}

function geRotoTimes(o, duration) {
  const start = Math.max(0, Math.min(o.start, duration));
  const end = Math.max(start, Math.min(o.end, duration));
  const times = [];
  for (let i = 0; start + i / o.fps < end - 1e-6; i++) times.push(start + i / o.fps);
  return times;
}

// ---------- Wycinanie postaci ----------

// Tło dla trybu „Nieruchoma kamera” — klatka z chwili opts.bgTime, zapamiętana do następnej zmiany.
async function geRotoBackground(ro) {
  if (ro.bg?.at !== ro.opts.bgTime) ro.bg = { at: ro.opts.bgTime, img: await geRotoGrab(ro, ro.opts.bgTime) };
  return ro.bg.img;
}

// Jedna klatka animacji z chwili t. Klatkę z nagrania odczytujemy tutaj i po kolei (wideo ma jeden suwak czasu),
// a postać wycinają wątki robocze. Zwraca { done } — obietnicę wycinka postaci { canvas, x, y, cx } albo (tryb pose)
// szkieletu; null — brak postaci. Następną klatkę można więc odczytać, zanim ta będzie gotowa.
// state — pamięć między kolejnymi klatkami generowania (wygładzanie maski AI); w podglądzie pusty.
// state.say(tekst) — pokazuje, co się teraz dzieje.
async function geRotoFrame(ro, t, state = {}) {
  const o = { ...ro.opts };
  const say = state.say ?? (() => {});
  const matte = ro.hasMatte ? ro.matte : null;
  if (o.mode === 'diff' && ro.bg?.at !== o.bgTime) say('odczytuję klatkę z pustym tłem');
  const bg = o.mode === 'diff' ? await geRotoBackground(ro) : null;
  say('odczytuję klatkę z nagrania');
  const img = await geRotoGrab(ro, t);
  ro.img = img;
  if (o.mode === 'key' || o.mode === 'diff') {
    say('wycinam postać z tła');
    const job = { type: 'cut', img, o, bg, matte };
    if (!ro.seed) return { done: geRotoRun(job).then(geRotoCutout) };
    // Punkt „To postać” stoi na każdej klatce w środku postaci z poprzedniej — te klatki wycinamy więc po kolei.
    const prev = state.seed ?? Promise.resolve(ro.seed);
    const cut = prev.then((seed) => geRotoRun({ ...job, seed }));
    state.seed = Promise.all([cut, prev]).then(([c, seed]) => (c ? { x: c.cx, y: c.cy } : seed));
    return { done: cut.then(geRotoCutout) };
  }
  say(geRotoPool.aiReady ? (o.mode === 'pose' ? 'AI rozpoznaje szkielet postaci' : 'AI szuka osoby na klatce') : 'wczytuję model AI (pierwszy raz trwa kilka sekund)');
  const found = geRotoRun({ type: 'detect', img, matte });
  if (o.mode === 'pose') return { done: found.then((r) => r.pose) };
  // Maska z AI drga na brzegach — mieszamy ją z poprzednią klatką (więc maski składamy po kolei, choć AI liczy je naraz).
  const last = state.mask ?? Promise.resolve(null);
  const mask = Promise.all([found, last]).then(([{ mask: m }, prev]) => (m && o.aiSmooth && prev?.length === m.length ? m.map((v, i) => v * 0.65 + prev[i] * 0.35) : m));
  state.mask = mask;
  return {
    done: mask.then((m) => {
      if (!m) return null;
      say('wycinam osobę według maski AI');
      return geRotoRun({ type: 'cut', img, o, mask: m, matte }).then(geRotoCutout);
    })
  };
}

// Wycinek z wątku (ImageData) → płótno, które da się narysować na komórce arkusza.
function geRotoCutout(cut) {
  if (!cut) return null;
  const canvas = geRotoCanvas(cut.img.width, cut.img.height);
  canvas.getContext('2d').putImageData(cut.img, 0, 0);
  return { canvas, x: cut.x, y: cut.y, cx: cut.cx };
}

// ---------- Wygląd klatek ----------

// Styl i kontur liczy wątek roboczy (w pikselach arkusza, więc kontur ma dokładnie tyle px, ile ustawiono).
async function geRotoStylize(ctx, w, h, o) {
  if (o.style === 'none' && !(o.outline > 0)) return;
  const img = ctx.getImageData(0, 0, w, h);
  ctx.putImageData(await geRotoRun({ type: 'style', img, o: { ...o } }, [img.data.buffer]), 0, 0);
}

// Wycinki → komórki arkusza. Wspólne pole wszystkich klatek, żeby postać nie skakała, i skala do wysokości klatki.
// „Postać w miejscu” zdejmuje przesuwanie w poziomie (idzie przez kadr, a w animacji idzie w miejscu — ruch robi aktor w grze).
// Styl nakładają wątki robocze, kilka komórek naraz.
async function geRotoCells(frames, o) {
  if (o.inPlace) frames = frames.map((f) => f && { ...f, x: f.x - f.cx });
  const got = frames.filter(Boolean);
  if (!got.length) return null;
  const x0 = Math.min(...got.map((f) => f.x));
  const y0 = Math.min(...got.map((f) => f.y));
  const x1 = Math.max(...got.map((f) => f.x + f.canvas.width));
  const y1 = Math.max(...got.map((f) => f.y + f.canvas.height));
  const pad = Math.ceil(o.outline) + 1;
  const k = Math.min(2, Math.max(4, o.height - pad * 2) / (y1 - y0));
  const fw = Math.round((x1 - x0) * k) + pad * 2;
  const fh = Math.round((y1 - y0) * k) + pad * 2;
  const cells = await Promise.all(frames.map(async (f) => {
    const cell = geRotoCanvas(fw, fh);
    if (!f) return cell;
    const ctx = cell.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(f.canvas, pad + (f.x - x0) * k, pad + (f.y - y0) * k, f.canvas.width * k, f.canvas.height * k);
    await geRotoStylize(ctx, fw, fh, o);
    return cell;
  }));
  return { cells, fw, fh };
}

// Szkielety bez dziury i bez drżenia: brakujące klatki biorą sąsiedni szkielet, potem średnia 1-2-1 z sąsiadami.
function geRotoSmoothPoses(poses) {
  const filled = poses.slice();
  for (let i = 1; i < filled.length; i++) filled[i] ??= filled[i - 1];
  for (let i = filled.length - 2; i >= 0; i--) filled[i] ??= filled[i + 1];
  if (!filled[0]) return null;
  return filled.map((pose, i) => {
    const a = filled[Math.max(0, i - 1)];
    const b = filled[Math.min(filled.length - 1, i + 1)];
    return pose.map((p, j) => ({ x: (a[j].x + p.x * 2 + b[j].x) / 4, y: (a[j].y + p.y * 2 + b[j].y) / 4, z: (a[j].z + p.z * 2 + b[j].z) / 4 }));
  });
}

const geRotoMid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
// Długość tułowia — miara, od której zależy grubość rąk, nóg i wielkość głowy.
const geRotoTorso = (p) => {
  const sh = geRotoMid(p[11], p[12]);
  const hip = geRotoMid(p[23], p[24]);
  return Math.max(4, Math.hypot(sh.x - hip.x, sh.y - hip.y));
};

// Postać na szkielecie MediaPipe (0 nos, 2/5 oczy, 7/8 uszy, 11/12 barki, 13/14 łokcie, 15/16 nadgarstki,
// 19/20 palce dłoni, 23/24 biodra, 25/26 kolana, 27/28 kostki, 31/32 palce stóp; nieparzyste — lewa strona ciała).
// border — grubość konturu w jednostkach szkieletu.
function geRotoFigure(ctx, p, o, border) {
  const u = geRotoTorso(p);
  const sh = geRotoMid(p[11], p[12]);
  const hip = geRotoMid(p[23], p[24]);
  const head = geRotoMid(p[7], p[8]);
  const r = Math.max(u * 0.3, Math.hypot(p[7].x - p[8].x, p[7].y - p[8].y) * 0.65);
  const stick = o.figure === 'stick';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = (pts, close = false) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach((q) => ctx.lineTo(q.x, q.y));
    if (close) ctx.closePath();
  };
  const line = (pts, width, color) => {
    path(pts);
    if (border > 0 && !stick) {
      ctx.lineWidth = width + border * 2;
      ctx.strokeStyle = o.outlineColor;
      ctx.stroke();
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  const circle = (c, radius, color) => {
    if (border > 0 && !stick) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, radius + border, 0, Math.PI * 2);
      ctx.fillStyle = o.outlineColor;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  // Dalsza od kamery strona ciała (większe z) idzie pod spód.
  const back = p[11].z + p[23].z > p[12].z + p[24].z ? 0 : 1;
  const arm = (s) => {
    const pts = [p[11 + s], p[13 + s], p[15 + s]];
    if (stick) line(pts, u * 0.08, o.outlineColor);
    else {
      line(pts, u * 0.2, o.shirt);
      circle(geRotoMid(p[15 + s], p[19 + s]), u * 0.11, o.skin);
    }
  };
  const leg = (s) => {
    const pts = [p[23 + s], p[25 + s], p[27 + s]];
    if (stick) line([...pts, p[31 + s]], u * 0.08, o.outlineColor);
    else {
      line([p[27 + s], p[31 + s]], u * 0.18, o.outlineColor);
      line(pts, u * 0.26, o.pants);
    }
  };
  arm(back);
  leg(back);
  leg(1 - back);
  if (stick) {
    line([head, sh, hip], u * 0.08, o.outlineColor);
    line([p[11], p[12]], u * 0.08, o.outlineColor);
    line([p[23], p[24]], u * 0.08, o.outlineColor);
    circle(head, r, o.outlineColor);
  } else {
    const torso = [p[11], p[12], p[24], p[23]];
    path(torso, true);
    if (border > 0) {
      ctx.lineWidth = u * 0.4 + border * 2;
      ctx.strokeStyle = o.outlineColor;
      ctx.stroke();
    }
    ctx.fillStyle = o.shirt;
    ctx.fill();
    ctx.lineWidth = u * 0.4;
    ctx.strokeStyle = o.shirt;
    ctx.stroke();
    line([sh, head], u * 0.16, o.skin);
    circle(head, r, o.skin);
    circle(p[2], r * 0.08, o.outlineColor);
    circle(p[5], r * 0.08, o.outlineColor);
  }
  arm(1 - back);
}

// Szkielety → komórki arkusza z narysowaną postacią (pole wspólne dla wszystkich klatek, jak w geRotoCells).
function geRotoPoseCells(poses, o) {
  if (!poses) return null;
  if (o.inPlace) {
    poses = poses.map((pose) => {
      const cx = (pose[23].x + pose[24].x) / 2;
      return pose.map((q) => ({ ...q, x: q.x - cx }));
    });
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  poses.forEach((pose) => {
    const m = geRotoTorso(pose) * 0.6;
    pose.forEach((q) => {
      x0 = Math.min(x0, q.x - m);
      y0 = Math.min(y0, q.y - m);
      x1 = Math.max(x1, q.x + m);
      y1 = Math.max(y1, q.y + m);
    });
  });
  const k = Math.max(4, o.height - 2) / (y1 - y0);
  const fw = Math.round((x1 - x0) * k) + 2;
  const fh = Math.round((y1 - y0) * k) + 2;
  const cells = poses.map((pose) => {
    const cell = geRotoCanvas(fw, fh);
    const ctx = cell.getContext('2d');
    ctx.setTransform(k, 0, 0, k, 1 - x0 * k, 1 - y0 * k);
    geRotoFigure(ctx, pose, o, o.outline / k);
    return cell;
  });
  return { cells, fw, fh };
}

// Komórki → jeden arkusz, możliwie kwadratowy (najwyżej GE_ROTO_SHEET px szerokości).
function geRotoSheet({ cells, fw, fh }) {
  const n = cells.length;
  const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt((n * fh) / fw)), Math.floor(GE_ROTO_SHEET / fw)));
  const rows = Math.ceil(n / cols);
  const sheet = geRotoCanvas(cols * fw, rows * fh);
  const ctx = sheet.getContext('2d');
  cells.forEach((cell, i) => ctx.drawImage(cell, (i % cols) * fw, Math.floor(i / cols) * fh));
  return { image: sheet.toDataURL('image/png'), cols, rows };
}

// ---------- Okno ----------

function geRotoAskVideo(folder = ge.cbFolder) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.addEventListener('change', () => {
    if (input.files[0]) geRotoOpen(input.files[0], folder);
  });
  input.click();
}

function geRotoLoadVideo(url) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('loadeddata', () => resolve(video), { once: true });
    video.addEventListener('error', () => reject(new Error('codec')), { once: true });
    video.src = url;
  }).then(async (video) => {
    // WebM nagrany w przeglądarce (np. nagrywarką ekranu) nie zna swojej długości, dopóki nie przewiniemy go na koniec.
    if (video.duration === Infinity) {
      await geRotoSeek(video, 1e9);
      await geRotoSeek(video, 0);
    }
    return video;
  });
}

async function geRotoOpen(file, folder = ge.cbFolder) {
  if (ge.modal) return;
  const url = URL.createObjectURL(file);
  let video;
  try {
    video = await geRotoLoadVideo(url);
    if (!video.videoWidth || !Number.isFinite(video.duration)) throw new Error('codec');
  } catch {
    URL.revokeObjectURL(url);
    geDialog({ title: 'Nie da się odczytać nagrania', text: `Edytor nie umie otworzyć pliku <b>${geEsc(file.name)}</b>. Zapisz nagranie jako <b>MP4 (H.264)</b> albo <b>WebM</b> i spróbuj jeszcze raz.` });
    return;
  }
  const duration = video.duration;
  const opts = { ...GE_ROTO_DEFAULTS, ...ge.rotoOpts, start: 0, end: Math.floor(Math.min(duration, 3) * 100) / 100, bgTime: 0 };
  // Szerokość — wielokrotność 4: MediaPipe na CPU wywraca się (Aborted) na obrazie o innej szerokości, np. 203 px z pionowego nagrania.
  const work = geRotoCanvas(Math.max(4, Math.round((video.videoWidth * GE_ROTO_WORK) / video.videoHeight / 4) * 4), GE_ROTO_WORK);
  const ro = { file, folder, url, video, duration, opts, work, lock: Promise.resolve(), time: 0, token: 0, timer: 0, bg: null, img: null, running: false, cancel: false };
  // view — klatka na podglądzie nagrania, overlay — zamalowane tło nad nią; tool — narzędzie na nagraniu.
  Object.assign(ro, {
    view: geRotoCanvas(work.width, work.height), overlay: geRotoCanvas(work.width, work.height),
    matte: new Uint8Array(work.width * work.height), hasMatte: false, seed: null, tool: opts.mode === 'key' ? 'pick' : null
  });
  geRotoShow(ro);
}

// ---------- Pomoc przy wycinaniu: tło i punkt postaci ----------

const GE_ROTO_TOOLS = {
  pick: 'Kliknij tło na nagraniu, żeby wybrać jego kolor.',
  paint: 'Zamaluj miejsca, które zawsze są tłem: ruszającą się firankę, cień na ścianie, drugą osobę. Tam nie będzie postaci na żadnej klatce (AI też ich nie widzi). Zamalowane miejsce jest takie samo na każdej klatce, więc to działa, gdy kamera stoi.',
  erase: 'Gumka zdejmuje zamalowane tło.',
  seed: 'Kliknij postać na nagraniu, najlepiej na pierwszej klatce fragmentu. Zostanie tylko ona, nawet gdy w kadrze rusza się coś jeszcze — edytor idzie za nią na kolejnych klatkach.'
};

// Punkt na nagraniu (w pikselach klatki roboczej) pod kursorem. Płótno ma object-fit: contain, więc obraz bywa mniejszy niż element.
function geRotoSrcPoint(canvas, event) {
  const box = canvas.getBoundingClientRect();
  const s = Math.min(box.width / canvas.width, box.height / canvas.height);
  const x = (event.clientX - box.left - (box.width - canvas.width * s) / 2) / s;
  const y = (event.clientY - box.top - (box.height - canvas.height * s) / 2) / s;
  return { x, y, inside: x >= 0 && y >= 0 && x < canvas.width && y < canvas.height };
}

// Pociągnięcie pędzlem od a do b: koła co pół promienia, żeby szybki ruch myszy nie zostawił przerw.
function geRotoStamp(ro, a, b) {
  const { width: w, height: h } = ro.work;
  const r = ro.opts.brush / 2;
  const value = ro.tool === 'paint' ? 1 : 0;
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (r / 2)));
  for (let s = 0; s <= steps; s++) {
    const cx = a.x + ((b.x - a.x) * s) / steps;
    const cy = a.y + ((b.y - a.y) * s) / steps;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) ro.matte[y * w + x] = value;
      }
    }
  }
}

// Podgląd nagrania: klatka, na niej zamalowane tło (czerwone) i punkt „To postać”.
function geRotoDrawSrc(ro) {
  const ctx = ro.wrap.querySelector('.ge-roto-src').getContext('2d');
  ctx.clearRect(0, 0, ro.view.width, ro.view.height);
  ctx.drawImage(ro.view, 0, 0);
  if (ro.hasMatte || ro.painting) {
    const octx = ro.overlay.getContext('2d');
    const img = octx.createImageData(ro.overlay.width, ro.overlay.height);
    for (let i = 0; i < ro.matte.length; i++) if (ro.matte[i]) img.data.set([255, 64, 64, 120], i * 4);
    octx.putImageData(img, 0, 0);
    ctx.drawImage(ro.overlay, 0, 0);
  }
  if (ro.seed && (ro.opts.mode === 'key' || ro.opts.mode === 'diff')) {
    const { x, y } = ro.seed;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#141414';
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 11, y);
    ctx.lineTo(x + 11, y);
    ctx.moveTo(x, y - 11);
    ctx.lineTo(x, y + 11);
    ctx.stroke();
  }
}

const geRotoRow = (label, control, modes = '', extra = '') => `<label class="ge-roto-row"${modes ? ` data-modes="${modes}"` : ''}${extra}><span>${label}</span>${control}</label>`;

function geRotoFormHtml(ro) {
  const o = ro.opts;
  const num = (key, min, max, step) => `<input type="number" data-r="${key}" min="${min}" max="${max}" step="${step}" value="${o[key]}" />`;
  const range = (key, min, max, step) => `<span class="ge-roto-range"><input type="range" data-r="${key}" min="${min}" max="${max}" step="${step}" value="${o[key]}" /><output>${o[key]}</output></span>`;
  const color = (key) => `<input type="color" data-r="${key}" value="${o[key]}" />`;
  const check = (key) => `<input type="checkbox" data-r="${key}"${o[key] ? ' checked' : ''} />`;
  const select = (key, options) => `<select data-r="${key}">${options.map(([v, l]) => `<option value="${v}"${v === o[key] ? ' selected' : ''}>${geEsc(l)}</option>`).join('')}</select>`;
  const cut = 'key diff ai';
  return `<div class="ge-roto-modes" role="radiogroup" aria-label="Sposób">${GE_ROTO_MODES.map(([mode, icon, title, text]) => `<button type="button" role="radio" class="ge-roto-mode" data-mode="${mode}" title="${geEsc(text)}"><span>${icon}</span><b>${geEsc(title)}</b></button>`).join('')}</div>
    <p class="ge-roto-about"></p>
    <h4>Fragment nagrania</h4>
    ${geRotoRow('Od (s)', num('start', 0, ro.duration.toFixed(2), 0.1))}
    ${geRotoRow('Do (s)', num('end', 0, ro.duration.toFixed(2), 0.1))}
    <p class="ge-roto-note">Długość nagrania: ${ro.duration.toFixed(2)} s.</p>
    ${geRotoRow('Klatki na sekundę', num('fps', 1, 30, 1))}
    ${geRotoRow('Wysokość klatki (px)', num('height', 32, 512, 8))}
    ${geRotoRow('Zapętlona', check('loop'))}
    ${geRotoRow('Postać w miejscu', check('inPlace'), '', ' title="Postać przechodzi przez kadr, a w animacji idzie w miejscu — w grze przesuwa ją aktor."')}
    <h4 data-modes="${cut}">Tło</h4>
    ${geRotoRow('Kolor tła', color('key'), 'key')}
    ${geRotoRow('Tolerancja', range('keyTol', 1, 60, 1), 'key')}
    ${geRotoRow('Miękkie brzegi', range('keySoft', 0, 40, 1), 'key')}
    ${geRotoRow('Usuń poświatę tła', check('despill'), 'key')}
    ${geRotoRow('Puste tło w chwili (s)', `<span class="ge-roto-inline">${num('bgTime', 0, ro.duration.toFixed(2), 0.1)}<button type="button" class="ge-mini" data-r-act="bg-here">Ta klatka</button></span>`, 'diff')}
    ${geRotoRow('Czułość', range('diffTol', 2, 60, 1), 'diff')}
    ${geRotoRow('Miękkie brzegi', range('diffSoft', 0, 40, 1), 'diff')}
    ${geRotoRow('Pewność AI', range('aiThr', 0.1, 0.9, 0.05), 'ai')}
    ${geRotoRow('Wygładzaj brzegi w czasie', check('aiSmooth'), 'ai')}
    ${geRotoRow('Usuń drobne plamy', check('clean'), cut)}
    <h4 data-modes="${cut}">Wygląd</h4>
    ${geRotoRow('Styl', select('style', GE_ROTO_STYLES), cut)}
    ${geRotoRow('Liczba kolorów', range('levels', 2, 8, 1), cut, ' data-styles="poster cartoon"')}
    ${geRotoRow('Kolor sylwetki', color('flat'), cut, ' data-styles="flat"')}
    <h4 data-modes="pose">Postać</h4>
    ${geRotoRow('Rodzaj', select('figure', GE_ROTO_FIGURES), 'pose')}
    ${geRotoRow('Koszulka', color('shirt'), 'pose', ' data-figures="puppet"')}
    ${geRotoRow('Spodnie', color('pants'), 'pose', ' data-figures="puppet"')}
    ${geRotoRow('Skóra', color('skin'), 'pose', ' data-figures="puppet"')}
    ${geRotoRow('Kontur (px)', range('outline', 0, 8, 1))}
    ${geRotoRow('Kolor konturu i kresek', color('outlineColor'))}`;
}

function geRotoShow(ro) {
  const wrap = document.createElement('div');
  wrap.className = 'ge-modal';
  wrap.innerHTML = `<div class="ge-modal-card ge-roto" role="dialog" aria-modal="true" aria-label="Animacja z wideo">
    <h3>🎬 Animacja z wideo (rotoskopia) — ${geEsc(ro.file.name)}</h3>
    <div class="ge-roto-body">
      <div class="ge-roto-view">
        <div class="ge-roto-panes">
          <figure><canvas class="ge-roto-src" width="${ro.work.width}" height="${ro.work.height}"></canvas><figcaption>Nagranie</figcaption></figure>
          <figure><canvas class="ge-roto-out" width="360" height="360"></canvas><figcaption>Klatka animacji</figcaption></figure>
        </div>
        <div class="ge-roto-tools" role="toolbar" aria-label="Pomoc przy wycinaniu">
          <button type="button" class="ge-mini" data-r-tool="pick" data-modes="key">💧 Kolor tła</button>
          <button type="button" class="ge-mini" data-r-tool="paint">🖌 Maluj tło</button>
          <button type="button" class="ge-mini" data-r-tool="erase">🧽 Gumka</button>
          <button type="button" class="ge-mini" data-r-tool="seed" data-modes="key diff">🎯 To postać</button>
          <label class="ge-roto-brush"><span>Pędzel</span><span class="ge-roto-range"><input type="range" data-r="brush" min="4" max="80" step="2" value="${ro.opts.brush}" /><output>${ro.opts.brush}</output></span></label>
          <button type="button" class="ge-mini" data-r-act="marks-clear">✖ Wyczyść</button>
        </div>
        <p class="ge-roto-hint"></p>
        <label class="ge-roto-time"><span>Podgląd chwili</span><input type="range" data-r-time min="0" max="${ro.duration}" step="0.01" value="0" /><output>0.00 s</output></label>
        <progress class="ge-roto-progress" max="1" value="0" hidden></progress>
        <p class="ge-roto-status" aria-live="polite"></p>
      </div>
      <div class="ge-roto-form">${geRotoFormHtml(ro)}</div>
    </div>
    <div class="ge-modal-actions"><button type="button" data-r-act="cancel">Anuluj</button><button type="button" class="is-primary" data-r-act="generate">🎞 Utwórz animację</button></div>
  </div>`;
  ro.wrap = wrap;
  const close = () => {
    if (ro.running) {
      ro.cancel = true;
      return;
    }
    clearTimeout(ro.timer);
    ro.token++;
    URL.revokeObjectURL(ro.url);
    ro.video.removeAttribute('src');
    wrap.remove();
    if (ge) ge.modal = null;
    ge.rotoOpts = Object.fromEntries(Object.entries(ro.opts).filter(([key]) => !GE_ROTO_PER_VIDEO.includes(key)));
  };
  ro.close = close;
  // Zdarzenia okna nie idą dalej do edytora (jego skróty i pola Szczegółów).
  ['click', 'input', 'change', 'dblclick', 'contextmenu'].forEach((type) => wrap.addEventListener(type, (event) => event.stopPropagation()));
  wrap.addEventListener('click', (event) => {
    const mode = event.target.closest('[data-mode]');
    const tool = event.target.closest('[data-r-tool]')?.dataset.rTool;
    const act = event.target.closest('[data-r-act]')?.dataset.rAct;
    if (ro.running && act !== 'cancel') return;
    if (mode) {
      ro.opts.mode = mode.dataset.mode;
      if (ro.opts.mode === 'key' && !ro.tool) ro.tool = 'pick';
      geRotoSync(ro);
      geRotoPreview(ro);
    } else if (tool) {
      ro.tool = ro.tool === tool ? null : tool;
      geRotoSync(ro);
    } else if (act === 'marks-clear') {
      ro.matte.fill(0);
      ro.hasMatte = false;
      ro.seed = null;
      geRotoSync(ro);
      geRotoPreview(ro);
    } else if (act === 'cancel') close();
    else if (act === 'generate') geRotoGenerate(ro);
    else if (act === 'bg-here') {
      ro.opts.bgTime = Math.round(ro.time * 100) / 100;
      wrap.querySelector('[data-r="bgTime"]').value = ro.opts.bgTime;
      geRotoPreview(ro);
    }
  });
  wrap.addEventListener('input', (event) => {
    const el = event.target;
    if (el.matches('[data-r-time]')) {
      ro.time = Number(el.value);
      el.nextElementSibling.value = `${ro.time.toFixed(2)} s`;
      geRotoPreview(ro);
      return;
    }
    const key = el.dataset.r;
    if (!key) return;
    const def = GE_ROTO_DEFAULTS[key];
    let value = typeof def === 'boolean' ? el.checked : typeof def === 'number' ? Number(el.value) : el.value;
    if (typeof def === 'number' && !Number.isFinite(value)) return;
    if (el.type === 'number') value = Math.min(Number(el.max), Math.max(Number(el.min), value));
    ro.opts[key] = value;
    if (el.type === 'range') el.nextElementSibling.value = value;
    if (key === 'brush') return;
    if (key === 'start') {
      ro.time = value;
      wrap.querySelector('[data-r-time]').value = value;
      wrap.querySelector('[data-r-time] + output').value = `${value.toFixed(2)} s`;
    }
    geRotoSync(ro);
    geRotoPreview(ro);
  });
  wrap.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });
  // Narzędzia na nagraniu: kliknięcie wybiera kolor tła albo punkt postaci, przeciąganie maluje (albo ściera) tło.
  const src = wrap.querySelector('.ge-roto-src');
  let last = null;
  src.addEventListener('pointerdown', (event) => {
    const p = geRotoSrcPoint(src, event);
    if (!ro.tool || ro.running || event.button !== 0 || !p.inside) return;
    if (ro.tool === 'pick') {
      if (!ro.img) return;
      const [r, g, b] = ro.view.getContext('2d').getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data;
      ro.opts.key = geRotoHex(r, g, b);
      wrap.querySelector('[data-r="key"]').value = ro.opts.key;
      geRotoPreview(ro);
    } else if (ro.tool === 'seed') {
      ro.seed = { x: p.x, y: p.y };
      geRotoSync(ro);
      geRotoPreview(ro);
    } else {
      src.setPointerCapture(event.pointerId);
      last = p;
      ro.painting = true;
      geRotoStamp(ro, p, p);
      geRotoDrawSrc(ro);
    }
  });
  src.addEventListener('pointermove', (event) => {
    if (!last) return;
    const p = geRotoSrcPoint(src, event);
    geRotoStamp(ro, last, p);
    last = p;
    geRotoDrawSrc(ro);
  });
  const stop = () => {
    if (!last) return;
    last = null;
    ro.painting = false;
    ro.hasMatte = ro.matte.some(Boolean);
    geRotoSync(ro);
    geRotoPreview(ro);
  };
  src.addEventListener('pointerup', stop);
  src.addEventListener('pointercancel', stop);
  ge.root.append(wrap);
  ge.modal = wrap;
  geRotoSync(ro);
  geRotoPreview(ro, true);
  wrap.querySelector('[data-r-act="generate"]').focus();
}

// Widoczność pól dla wybranego sposobu i stylu oraz licznik klatek.
function geRotoSync(ro) {
  const o = ro.opts;
  const wrap = ro.wrap;
  wrap.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === o.mode)));
  wrap.querySelector('.ge-roto-about').textContent = GE_ROTO_MODES.find(([mode]) => mode === o.mode)[3];
  wrap.querySelectorAll('[data-modes]').forEach((el) => {
    el.hidden = !el.dataset.modes.split(' ').includes(o.mode)
      || (el.dataset.styles && !el.dataset.styles.split(' ').includes(o.style))
      || (el.dataset.figures && !el.dataset.figures.split(' ').includes(o.figure));
  });
  wrap.querySelectorAll('[data-r-tool]').forEach((b) => {
    if (b.hidden && ro.tool === b.dataset.rTool) ro.tool = null;
  });
  wrap.querySelectorAll('[data-r-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rTool === ro.tool)));
  wrap.querySelector('.ge-roto-brush').hidden = ro.tool !== 'paint' && ro.tool !== 'erase';
  wrap.querySelector('[data-r-act="marks-clear"]').disabled = !ro.hasMatte && !ro.seed;
  wrap.querySelector('.ge-roto-hint').textContent = GE_ROTO_TOOLS[ro.tool] ?? '';
  wrap.querySelector('.ge-roto-src').classList.toggle('is-picker', !!ro.tool);
  geRotoDrawSrc(ro);
  const count = geRotoTimes(o, ro.duration).length;
  const tooMany = count > GE_ROTO_MAX_FRAMES;
  wrap.querySelector('[data-r-act="generate"]').disabled = !count || tooMany || ro.running;
  ro.info = !count ? '⚠ Fragment jest pusty — ustaw „Do” później niż „Od”.'
    : tooMany ? `⚠ ${count} klatek to za dużo (najwyżej ${GE_ROTO_MAX_FRAMES}) — skróć fragment albo zmniejsz liczbę klatek na sekundę.`
      : `Animacja: ${count} klatek, ${(count / o.fps).toFixed(2)} s.`;
  geRotoStatus(ro);
}

function geRotoStatus(ro, text = '') {
  ro.wrap.querySelector('.ge-roto-status').textContent = text || ro.info;
}

// Podgląd jednej klatki (z chwili na suwaku) — z opóźnieniem, żeby przeciąganie suwaków nie kolejkowało setek klatek.
function geRotoPreview(ro, now = false) {
  clearTimeout(ro.timer);
  const token = ++ro.token;
  ro.timer = setTimeout(() => geRotoQueue(ro, async () => {
    if (token !== ro.token) return;
    const ai = ro.opts.mode === 'ai' || ro.opts.mode === 'pose';
    const say = (text) => geRotoStatus(ro, `⏳ Podgląd: ${text}…`);
    let built;
    try {
      const frame = await (await geRotoFrame(ro, ro.time, { say })).done;
      if (token !== ro.token) return;
      built = ro.opts.mode === 'pose' ? geRotoPoseCells(frame && [frame], ro.opts) : await geRotoCells([frame], ro.opts);
    } catch (err) {
      geRotoStatus(ro, `⚠ ${ai ? 'Nie udało się uruchomić AI' : 'Błąd podglądu'}: ${err.message || err}`);
      return;
    }
    if (token !== ro.token) return;
    geRotoStatus(ro);
    ro.view.getContext('2d').drawImage(ro.work, 0, 0);
    geRotoDrawSrc(ro);
    const out = ro.wrap.querySelector('.ge-roto-out');
    const ctx = out.getContext('2d');
    ctx.clearRect(0, 0, out.width, out.height);
    geChecker(ctx, 0, 0, out.width, out.height, 12);
    if (!built) {
      geNoImage(ctx, out.width, out.height, ai ? 'AI nie widzi tu człowieka.' : 'Nie widać postaci — zmień ustawienia tła.');
      return;
    }
    const s = Math.min((out.width - 20) / built.fw, (out.height - 20) / built.fh);
    ctx.imageSmoothingEnabled = s < 1;
    ctx.drawImage(built.cells[0], (out.width - built.fw * s) / 2, (out.height - built.fh * s) / 2, built.fw * s, built.fh * s);
  }), now ? 0 : 150);
}

async function geRotoGenerate(ro) {
  const o = ro.opts;
  const times = geRotoTimes(o, ro.duration);
  if (!times.length || times.length > GE_ROTO_MAX_FRAMES) return;
  clearTimeout(ro.timer);
  ro.token++;
  ro.running = true;
  ro.cancel = false;
  const progress = ro.wrap.querySelector('.ge-roto-progress');
  progress.hidden = false;
  progress.value = 0;
  ro.wrap.querySelector('.ge-roto-form').inert = true;
  ro.wrap.querySelector('.ge-roto-tools').inert = true;
  ro.wrap.querySelector('[data-r-time]').disabled = true;
  ro.wrap.querySelector('[data-r-act="generate"]').disabled = true;
  ro.wrap.querySelector('[data-r-act="cancel"]').textContent = 'Przerwij';
  let sheet = null;
  let note = '';
  // Napis pod paskiem postępu: ile klatek gotowych, co się teraz dzieje i ile mniej więcej zostało.
  const started = performance.now();
  let done = 0;
  let doing = '';
  const threads = GE_ROTO_THREADS === 1 ? 'w 1 wątku' : `w ${GE_ROTO_THREADS} wątkach`;
  const say = (text = doing) => {
    doing = text;
    const left = done >= 2 ? Math.ceil(((performance.now() - started) / done) * (times.length - done) / 1000) : null;
    const eta = left === null ? '' : left < 2 ? ' · zaraz koniec' : ` · zostało ok. ${left} s`;
    geRotoStatus(ro, `⏳ Gotowe klatki: ${done} z ${times.length} (liczę ${threads}): ${doing}…${eta}`);
  };
  const step = async (text) => {
    geRotoStatus(ro, `⏳ ${text}…`);
    await geRotoPaint();
  };
  try {
    const frames = await geRotoQueue(ro, async () => {
      const state = { say };
      const out = [];
      // Nagranie odczytujemy najwyżej o dwie klatki na wątek przed tym, co już policzone — reszta nie czeka w pamięci.
      const ahead = GE_ROTO_THREADS * 2;
      for (const t of times) {
        if (ro.cancel) return null;
        if (out.length >= ahead) await out[out.length - ahead];
        const { done: frame } = await geRotoFrame(ro, t, state);
        frame.then(() => {
          done++;
          progress.value = done / times.length;
          say();
        }, () => {});
        out.push(frame);
      }
      const all = await Promise.all(out);
      return ro.cancel ? null : all;
    });
    if (frames) {
      await step(o.mode === 'pose' ? 'Rysuję postać na każdej klatce' : 'Dopasowuję rozmiar klatek i nakładam styl');
      const built = o.mode === 'pose' ? geRotoPoseCells(geRotoSmoothPoses(frames), o) : await geRotoCells(frames, o);
      if (built) {
        await step('Składam klatki w jeden arkusz');
        sheet = geRotoSheet(built);
        await step('Dodaję animację do projektu');
      }
      else note = o.mode === 'pose' || o.mode === 'ai' ? '⚠ AI nie znalazło człowieka w tym fragmencie.' : '⚠ Na żadnej klatce nie widać postaci — zmień ustawienia tła.';
    } else note = 'Przerwano.';
  } catch (err) {
    note = `⚠ Nie udało się: ${err.message || err}`;
  } finally {
    ro.running = false;
    progress.hidden = true;
    ro.wrap.querySelector('.ge-roto-form').inert = false;
    ro.wrap.querySelector('.ge-roto-tools').inert = false;
    ro.wrap.querySelector('[data-r-time]').disabled = false;
    ro.wrap.querySelector('[data-r-act="cancel"]').textContent = 'Anuluj';
    geRotoSync(ro);
    // geRotoSync wpisał licznik klatek — komunikat o wyniku ma zostać na wierzchu.
    if (note) geRotoStatus(ro, note);
  }
  if (!sheet) return;
  ro.close();
  const base = GE_RT.ident(ro.file.name.replace(/\.[^.]+$/, '')) || 'Wideo';
  await geImportAnimationFile({ name: `${base}.json` }, ro.folder, {
    format: 'jsgame-animation', from: 'nagrania wideo (rotoskopia)', image: sheet.image, cols: sheet.cols, rows: sheet.rows, frames: times.length, fps: o.fps, loop: o.loop
  });
}
