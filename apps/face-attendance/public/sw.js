// Minimal app-shell service worker (Phase 1). Offline clock-in is NOT
// handled here; that is a later phase and will need a proper queue.
//
//   * Precaches the offline page, the manifest and the icons.
//   * Next's hashed build files (/_next/static/) are cache-first: a file
//     name never changes content, so a cached copy is always right.
//   * Page navigations are network-first and fall back to the offline page.
//     Pages are never cached: they depend on who is signed in.
//   * Everything else (Supabase, the API, other origins) is not touched.

const SHELL_CACHE = 'abbys-attendance-shell-v1';
const STATIC_CACHE = 'abbys-attendance-static-v1';
const SHELL_FILES = ['/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = [SHELL_CACHE, STATIC_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      }))
    );
    return;
  }

  if (SHELL_FILES.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
});
