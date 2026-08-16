// YieldTracker viewer service worker.
// - App shell (HTML/JS/icon): cache-first, so the viewer opens instantly and offline.
// - master.csv: network-first, so it's fresh online and falls back to the last cached
//   copy offline. Bump CACHE_VERSION whenever a shell file changes to force a refresh.
const CACHE_VERSION = 'yt-viewer-v4';
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

  // Everything else (shell) → cache-first, fall back to network and cache it.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => hit))
  );
});
