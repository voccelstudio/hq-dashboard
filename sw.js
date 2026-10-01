// SERVICE WORKER — SYS_DASHBOARD
// El build id lo inyecta el deploy (ver .github/workflows/deploy.yml) con un
// sed sobre el placeholder. Ojo con el sentinel: tiene que ser un valor que
// el sed NO pueda volver a escribir, o el chequeo de "estoy sin versionar"
// queda siempre en false y el cache nunca se versiona en produccion.
const BUILD = '__BUILD_SHA__';
const IS_UNVERSIONED = /^__[A-Z_]+__$/.test(BUILD);
const VERSION = IS_UNVERSIONED ? 'dev' : BUILD.slice(0, 12);
const CACHE = `sys-dashboard-${VERSION}`;

// App shell: todo lo necesario para arrancar sin red.
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './assets/index-Cpp8q40q.js',
  './assets/features.js',
  './assets/command-palette.js',
  './assets/news.js',
  './assets/style-CxH7Ekp1.css',
  './assets/features.css',
  './assets/xp-theme.css',
  './assets/glass.css',
  './assets/layout.css'
];

// Nombres con hash en el path → inmutables, se pueden servir de caché para siempre.
const IMMUTABLE = /\.[0-9a-f]{8,}\.(js|css|woff2?|png|svg|jpg)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // addAll() es atómico: si un solo archivo falla no se instala nada. Eso
      // prefiero a un shell a medias, así que agrego uno por uno y registro
      // los que fallan en vez de abortar.
      const results = await Promise.allSettled(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      );
      const failed = results
        .map((r, i) => (r.status === 'rejected' ? PRECACHE[i] : null))
        .filter(Boolean);
      if (failed.length) console.warn('[sw] no se pudieron precachear:', failed);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// El HTML pide actualizaciones al SW explícitamente (ver index.html).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const isOk = (res) => res && res.ok && (res.type === 'basic' || res.type === 'default');

async function cachePut(request, response) {
  if (!isOk(response)) return; // nunca cachear 404 ni error: envenena el cache
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  } catch (e) {
    console.warn('[sw] cache.put falló:', e);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // CDNs (three.js, vanta, google fonts) los maneja el navegador; meterlos en
  // nuestra cache sin control de versión nos da bugs imposibles de depurar.
  if (url.origin !== self.location.origin) return;

  // Navegación: red primero (querés ver deploys nuevos), cache como red de
  // seguridad offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          await cachePut(request, res);
          return res;
        } catch (e) {
          return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
        }
      })()
    );
    return;
  }

  // Assets con hash: caché primero, es literalmente inmutable.
  if (IMMUTABLE.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        await cachePut(request, res);
        return res;
      })()
    );
    return;
  }

  // Assets con nombre estable (features.js, xp-theme.css, mapa.png…):
  // stale-while-revalidate — respuesta instantánea, se refresca en background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then(async (res) => {
          await cachePut(request, res);
          return res;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return (await network) || Response.error();
    })()
  );
});