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

/**
 * Web Push.
 *
 * This is the only part of the app that runs when the app is shut, which is the
 * entire point: a stop being reached at 11am is worth nothing if it needs the
 * tab to be open to be seen.
 */
/**
 * The browser replaced this device's subscription.
 *
 * Apple and the other push services rotate an endpoint from time to time, and
 * when they do the old one is dead and the server is still holding it. Every
 * alert then goes to an address nobody is at, gets a 410, and the row is
 * deleted - so the phone goes quiet with no subscription left and nothing said.
 *
 * A worker cannot tell the server itself: the API wants a token that lives in
 * the page's localStorage, which is not reachable from here. What it can do is
 * take out a new subscription with the same key, so there is something live to
 * report - and push.sync() sends it the next time the app is opened.
 */
self.addEventListener('pushsubscriptionchange', (e) => {
    const key = e.oldSubscription?.options?.applicationServerKey;
    if (!key) return;
    e.waitUntil(
        self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
            .catch(() => { })
    );
});

self.addEventListener('push', (e) => {
    // A push with no payload still has to show something. Browsers may drop a
    // subscription that receives a push and shows no notification.
    let payload = { title: 'Financial Reading', body: 'You have a new alert.' };
    try {
        if (e.data) payload = { ...payload, ...e.data.json() };
    } catch {
        if (e.data) payload.body = e.data.text();
    }

    e.waitUntil(self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        // Urgent means a stop. Let it interrupt rather than arrive silently.
        requireInteraction: payload.priority === 'urgent',
        // One tag per notification, so two alerts on different symbols do not
        // replace one another in the tray.
        tag: payload.notificationId || undefined,
        data: { actionUrl: payload.actionUrl || '/' }
    }));
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const target = e.notification.data?.actionUrl || '/';

    // Focus the app if it is already open rather than stacking another copy of
    // it - on iOS the Home Screen app is a single window and opening again
    // would lose whatever was on screen.
    e.waitUntil((async () => {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
            if (new URL(client.url).origin === self.location.origin) {
                await client.focus();
                if ('navigate' in client) await client.navigate(target);
                return;
            }
        }
        await self.clients.openWindow(target);
    })());
});
