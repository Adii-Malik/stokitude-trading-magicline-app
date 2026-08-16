/**
 * Minimal service worker.
 *
 * Vite fingerprints asset filenames, so those are safe to cache forever - a new
 * build produces new names. Everything else goes to the network first, which
 * keeps a deploy from being masked by a stale cached shell.
 */
const CACHE = 'financial-reading-v1';

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest'])));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const { request } = e;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    // Never cache the API or the socket - stale portfolio data is worse than none.
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;

    // Fingerprinted assets can be served from cache immediately.
    if (url.pathname.startsWith('/assets/')) {
        e.respondWith(
            caches.match(request).then((hit) => hit || fetch(request).then((res) => {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(request, copy));
                return res;
            }))
        );
        return;
    }

    // Everything else: network first, cache only as an offline fallback.
    e.respondWith(
        fetch(request)
            .then((res) => {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(request, copy));
                return res;
            })
            .catch(() => caches.match(request).then((hit) => hit || caches.match('/')))
    );
});
