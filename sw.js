const CACHE_NAME = 'ibra-ba-v4';
const APP_SHELL = ['/', '/index.html', '/script.js', '/styles.css', '/logo.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((response) => response || caches.match('/index.html'))));
});
