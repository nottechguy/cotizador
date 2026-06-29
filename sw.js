const CACHE_NAME = 'quotation-pwa-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/styles.css',
    './js/base.js',
    './js/app.js',
    './js/jspdf.js',
    './js/BusinessView.js',
    './js/ClientsView.js',
    './js/ProductsCategoriesView.js',
    './js/ProductsView.js',
    './js/QuotationView.js',
    './js/ServicesView.js',
    './manifest.json'
];

// 1. Install Event - Caches the app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[Service Worker] Caching App Shell...');
            
            // Loop through each file and cache it individually
            for (let asset of ASSETS_TO_CACHE) {
                try {
                    await cache.add(asset);
                    console.log('[Service Worker] Successfully cached:', asset);
                } catch (err) {
                    // If one file fails (like a missing manifest.json), it won't crash the rest!
                    console.error('[Service Worker] Failed to cache:', asset, err);
                }
            }
        })
    );
    self.skipWaiting();
});

// 2. Activate Event - Cleans up old caches when you update the version number
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing Old Cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    // Claim control of all open clients immediately
    self.clients.claim();
});

// 3. Fetch Event - Cache-First Strategy
self.addEventListener('fetch', (event) => {
    // Only intercept GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return the cached asset if found
            if (cachedResponse) {
                return cachedResponse;
            }

            // Otherwise, fetch from the network
            return fetch(event.request).then((networkResponse) => {
                // Optionally cache new successful requests dynamically
                // (Good if you load external fonts or images)
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // If both cache and network fail, you can serve a fallback offline page here
                console.log('[Service Worker] Fetch failed, and no cache found.');
            });
        })
    );
});