const PREFIX = 'yuu-quick-calc-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = PREFIX + 'v1.0.0';
const FILES = ['./', './index.html', './style.css', './manifest.webmanifest', './js/app.js', './js/engine.js', './js/format.js', './js/model.js', './js/storage.js', './js/clipboard.js', './vendor/decimal.mjs', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/favicon.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    if (event.request.mode === 'navigate') return cache.match('./index.html');
    return fetch(event.request);
  }));
});
