const CACHE_NAME = 'singer-v2.6';
const ASSETS = [
  'podpis.html',
  'script.js',
  'manifest.json'
];

// Inštalácia a kešovanie základných súborov
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Zachytenie "Zdieľať do appky"
self.addEventListener('fetch', (event) => {
  if (event.request.method === 'POST' && event.request.url.includes('podpis.html')) {
    event.respondWith(Response.redirect('podpis.html?shared=1'));
    return;
  }
  event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
});
