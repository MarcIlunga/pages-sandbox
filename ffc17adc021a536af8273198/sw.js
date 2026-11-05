// Part Player service worker.
// - App shell (pages, JS, CSS, setlist, manifests): network-first, so a new deploy
//   shows up right away when online; the cached copy is used offline.
// - Song audio: served from the 'pp-songs' cache when the user saved the song;
//   otherwise straight from the network.
const SHELL = 'pp-shell-v2';
const SONGS = 'pp-songs-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['./', './index.html'])).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== SONGS) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith('.m4a')) {
    // saved songs come from the cache, unless the app asks for a fresh copy (retry)
    if (req.cache === 'reload') return;
    e.respondWith((async () => (await caches.match(req, { cacheName: SONGS })) ?? fetch(req))());
    return;
  }

  // network-first for everything else in scope
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(req, copy)).catch(() => undefined);
      }
      return res;
    } catch {
      return (await caches.match(req)) ??
        (req.mode === 'navigate' ? caches.match('./index.html') : undefined) ??
        Response.error();
    }
  })());
});
