// Service worker Informatycznej Przygody.
//
// Strategie:
// - strona (index.html): najpierw sieć (z limitem czasu), offline — kopia z cache;
// - skrypty i style (pliki z ?v=N): z cache, w tle odświeżane; nowe ?v pobierane z sieci;
// - obrazki, gify, kolorowanki: z cache, a gdy brak — z sieci i do cache;
// - czcionki Google: z cache, w tle odświeżane.
//
// Po pierwszym uruchomieniu strona prosi o pobranie wszystkich zasobów (komunikat
// 'precache'), więc aplikacja działa offline także w zadaniach jeszcze nieotwartych.
// Lista zasobów jest wyszukiwana automatycznie w index.html i skryptach, nie trzeba jej
// utrzymywać ręcznie. Zmiana SHELL_CACHE / ASSETS_CACHE wymusza pobranie wszystkiego od nowa.

const SHELL_CACHE = 'inf-shell-v1';
const ASSETS_CACHE = 'inf-assets-v2';
const FONTS_CACHE = 'inf-fonts-v1';
const CACHES = [SHELL_CACHE, ASSETS_CACHE, FONTS_CACHE];

const INDEX_URL = new URL('./index.html', self.registration.scope).href;
const NETWORK_TIMEOUT_MS = 4000;

const STATIC_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon.svg',
  './assets/icons/favicon-32.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-192.png',
  './assets/icons/maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const index = await fetch(INDEX_URL, { cache: 'no-store' });
    if (!index.ok) throw new Error('Nie udało się pobrać index.html');
    const html = await index.clone().text();
    await cache.put(INDEX_URL, index);
    const rest = STATIC_SHELL.filter((url) => url !== './index.html' && url !== './');
    await Promise.all([...rest, ...shellUrlsFromHtml(html)].map((url) => cacheUrl(cache, url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => !CACHES.includes(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const type = event.data?.type;
  if (type === 'precache') {
    event.waitUntil(precacheAssets());
  } else if (type === 'check-update') {
    event.waitUntil(checkForUpdate().then((updated) => {
      if (updated) event.source?.postMessage({ type: 'update-available' });
    }));
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONTS_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  if (request.mode === 'navigate' || isIndex(url)) {
    event.respondWith(networkFirstPage(request));
  } else if (/\.(js|css|webmanifest)$/.test(url.pathname) && !url.pathname.includes('/assets/')) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
  } else {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
  }
});

function isIndex(url) {
  return url.href.split(/[?#]/)[0] === INDEX_URL || url.href.split(/[?#]/)[0] === self.registration.scope;
}

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL_CACHE);
  const key = isIndex(new URL(request.url)) ? INDEX_URL : request;
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (response.ok) await cache.put(key, response.clone());
    return response;
  } catch {
    return (await cache.match(key, { ignoreSearch: true }))
      || (await cache.match(INDEX_URL))
      || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(async (response) => {
    if (response.ok || response.type === 'opaque') {
      if (cacheName === SHELL_CACHE) await putVersioned(cache, request, response.clone());
      else await cache.put(request, response.clone());
    }
    return response;
  });
  if (cached) {
    network.catch(() => {});
    return cached;
  }
  try {
    return await network;
  } catch {
    // Offline, a w cache jest tylko inna wersja (?v=) tego pliku — lepsza niż nic.
    return (await cache.match(request, { ignoreSearch: true })) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(stripSearch(request.url), response.clone());
  return response;
}

// Zapisuje plik i usuwa z cache jego starsze wersje (ten sam plik, inne ?v=).
async function putVersioned(cache, request, response) {
  const url = new URL(request.url);
  const old = await cache.keys(request, { ignoreSearch: true });
  await Promise.all(old.filter((req) => req.url !== url.href).map((req) => cache.delete(req)));
  await cache.put(request, response);
}

async function cacheUrl(cache, url, { versioned = false } = {}) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  if (versioned) await putVersioned(cache, new Request(url), response);
  else await cache.put(url, response);
}

// Sprawdza, czy na serwerze jest nowsza wersja strony. Jeśli tak — zapisuje ją
// razem z nowymi skryptami, żeby po odświeżeniu działała także offline.
async function checkForUpdate() {
  try {
    const cache = await caches.open(SHELL_CACHE);
    const [response, cached] = await Promise.all([
      fetch(INDEX_URL, { cache: 'no-store' }),
      cache.match(INDEX_URL)
    ]);
    if (!response.ok) return false;
    const html = await response.clone().text();
    if (cached && (await cached.text()) === html) return false;
    await Promise.all(shellUrlsFromHtml(html).map((url) => cacheUrl(cache, url, { versioned: true })));
    await cache.put(INDEX_URL, response);
    precacheAssets();
    return Boolean(cached);
  } catch {
    return false;
  }
}

function shellUrlsFromHtml(html) {
  const urls = new Set();
  for (const match of html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)="([^"]+)"/g)) {
    const url = new URL(match[1], INDEX_URL);
    if (url.origin === self.location.origin) urls.add(url.href);
  }
  return [...urls];
}

let precaching = null;

function precacheAssets() {
  precaching ||= doPrecacheAssets().finally(() => { precaching = null; });
  return precaching;
}

async function doPrecacheAssets() {
  const shell = await caches.open(SHELL_CACHE);
  const index = await shell.match(INDEX_URL);
  if (!index) return;
  const sources = [await index.text()];
  for (const url of shellUrlsFromHtml(sources[0])) {
    const response = await shell.match(url);
    if (response) sources.push(await response.text());
  }

  const assets = new Set();
  for (const source of sources) {
    for (const [path] of source.matchAll(/assets\/[\w\-./]+\.(?:png|jpe?g|gif|svg|webp|avif|mp3|wav|ogg|js)\b/g)) {
      assets.add(path);
      // Kolorowanki są wczytywane jako assets/coloring/<id>.js (adres składany w kodzie).
      const coloring = path.match(/^assets\/coloring\/([\w-]+)\.svg$/);
      if (coloring) assets.add(`assets/coloring/${coloring[1]}.js`);
    }
  }

  const cache = await caches.open(ASSETS_CACHE);
  const queue = [...assets].map((path) => new URL(path, INDEX_URL).href);
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      if (await cache.match(url)) continue;
      try {
        await cacheUrl(cache, url);
      } catch {
        // Brakujący plik nie może zatrzymać pobierania reszty.
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
}

function stripSearch(href) {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  return url.href;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}
