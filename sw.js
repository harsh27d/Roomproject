/**
 * RoomMate Service Worker v3
 * Auto-activates and provides resilient offline and navigation routing.
 */

const CACHE_NAME = 'roommate-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/features',
  '/features.html',
  '/auth',
  '/auth.html',
  '/common.css',
  '/home.css',
  '/features.css',
  '/auth.css',
  '/auth.js',
  '/supabaseClient.js',
  '/manifest.json',
  '/assets/icon-96.png',
  '/assets/icon-144.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable-192.png',
  '/assets/icon-maskable-512.png',
  '/assets/app-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) =>
          fetch(url, { cache: 'reload' })
            .then((response) => {
              if (response.ok) return cache.put(url, response);
            })
            .catch((err) => console.warn('Pre-cache skip:', url, err))
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Network-first strategy with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache valid same-origin responses
        if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Look in cache for exact match
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // If navigation request failed, try fallback pages
        if (event.request.mode === 'navigate') {
          if (url.pathname.includes('feature')) {
            return (await caches.match('/features.html')) || (await caches.match('/features'));
          }
          if (url.pathname.includes('auth')) {
            return (await caches.match('/auth.html')) || (await caches.match('/auth'));
          }
          return (await caches.match('/index.html')) || (await caches.match('/'));
        }

        return new Response('Network error occurred', {
          status: 408,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});
