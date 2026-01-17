const CACHE_NAME = 'singer-v2.7';
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

// 2. Zachytenie zdieľania (Share Target)
self.addEventListener('fetch', (event) => {
  // Ak ide o POST požiadavku na našu action URL z manifestu
  if (event.request.method === 'POST' && event.request.url.includes('podpis.html')) {
    
    // iOS vyžaduje pre Share Target presmerovanie s kódom 303
    event.respondWith(
      Response.redirect('podpis.html?shared=1', 303)
    );
    return;
  }

  // Bežné kešovanie pre offline režim
  event.respondWith(
    caches.match(event.request).then((res) => {
      return res || fetch(event.request);
    })
  );
});
