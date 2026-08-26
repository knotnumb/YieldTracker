// YieldTracker viewer service worker.
// - HTML pages (navigations) + master.csv: network-first, so the newest page and data
//   always load when online and fall back to the last cached copy offline. This is why
//   the old cache-first shell needed a Ctrl+F5 after every deploy — network-first fixes
//   that: a normal reload now always gets the freshest index.html/chart.html.
// - Static assets (JS/icons/manifest): cache-first, so the viewer opens instantly.
// Bump CACHE_VERSION on any shell change to purge the old cache on activate.
const CACHE_VERSION = 'yt-viewer-v5';
const SHELL = [
  './',
  './index.html',
  './chart.html',
  './assets/chart.umd.min.js',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/ys-logo.png',
  './manifest.json',
];
const MASTER = 'master.csv';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (e.g. DefiLlama ↗ links)

  // master.csv (any query string) → network-first, cached under a stable key.
  if (url.pathname.endsWith('/' + MASTER) || url.pathname.endsWith(MASTER)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(MASTER, copy));
          return res;
        })
        .catch(() => caches.match(MASTER))
    );
    return;
  }

  // HTML pages (navigations, or a direct .html request) → network-first, so a deploy
  // shows up on a normal reload with no Ctrl+F5. Falls back to cache offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Static assets (JS/icons/manifest) → cache-first, fall back to network and cache it.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => hit))
  );
});
