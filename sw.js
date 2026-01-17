const CACHE_NAME = 'singer-v2.8';
const ASSETS = [
  'podpis.html',
  'script.js',
  'manifest.json'
];

// 1. Inštalácia - okamžitá aktivácia
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 2. Obsluha požiadaviek
self.addEventListener('fetch', (event) => {
  // POZNÁMKA: Sekcia pre POST (303 redirect) je dočasne vypnutá pre test GET metódy
  
  event.respondWith(
    caches.match(event.request).then((res) => {
      return res || fetch(event.request);
    })
  );
});
