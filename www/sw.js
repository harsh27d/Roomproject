/**
 * RoomMate Service Worker
 * Provides offline caching and enables standalone PWA / WebAPK installation on mobile devices.
 */

const CACHE_NAME = 'roommate-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/features.html',
  '/auth.html',
  '/common.css',
  '/home.css',
  '/features.css',
  '/auth.css',
  '/auth.js',
  '/supabaseClient.js',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Pre-caching assets warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Network first with cache fallback
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});
