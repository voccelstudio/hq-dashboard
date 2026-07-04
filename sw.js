// SYS_DASHBOARD V4.2 - Service Worker
const CACHE = 'sys-dashboard-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './favicon.svg',
  './manifest.webmanifest',
  './assets/style-CxH7Ekp1.css',
  './assets/features.css',
  './assets/xp-theme.css',
  './assets/index-Cpp8q40q.js',
  './assets/features.js',
  './mapa.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(PRECACHE_URLS)
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-only for API calls
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first for navigation (index.html or root)
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('./')))
    );
    return;
  }

  // Cache-first for static assets (CSS, JS, images, sounds)
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
        return res;
      });
    })
  );
});
