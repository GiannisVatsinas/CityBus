// ═══════════════════════════════════════════════════
//  CityBus Service Worker – Offline-first strategy
// ═══════════════════════════════════════════════════
const CACHE_NAME = 'citybus-v5';

// Files to cache immediately on install (app shell)
const SHELL_FILES = [
    './',
    './index.html',
    './app.js',
    './style.css',
    './data.json',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

// External resources (fonts, leaflet) – cache on first use
const RUNTIME_CACHE = 'citybus-runtime-v1';

// ── Install: cache the app shell ──────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(SHELL_FILES);
        }).then(() => self.skipWaiting())
    );
});

// ── Activate: delete old caches ───────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
                    .map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: serve from cache, fall back to network ─
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle http(s) requests
    if (!url.protocol.startsWith('http')) return;

    // Map tiles: network-first with runtime cache fallback
    if (url.hostname.includes('cartocdn') || url.hostname.includes('openstreetmap')) {
        event.respondWith(
            caches.open(RUNTIME_CACHE).then(cache =>
                fetch(request)
                    .then(response => {
                        if (response.ok) cache.put(request, response.clone());
                        return response;
                    })
                    .catch(() => cache.match(request))
            )
        );
        return;
    }

    // Google Fonts & Leaflet: stale-while-revalidate
    if (
        url.hostname.includes('fonts.googleapis') ||
        url.hostname.includes('fonts.gstatic') ||
        url.hostname.includes('unpkg.com')
    ) {
        event.respondWith(
            caches.open(RUNTIME_CACHE).then(async cache => {
                const cached = await cache.match(request);
                const fetchPromise = fetch(request).then(response => {
                    if (response.ok) cache.put(request, response.clone());
                    return response;
                });
                return cached || fetchPromise;
            })
        );
        return;
    }

    // App shell & data: cache-first
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;
            return fetch(request).then(response => {
                if (response.ok) {
                    caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
                }
                return response;
            });
        })
    );
});
