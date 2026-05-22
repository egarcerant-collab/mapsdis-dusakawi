// ================================================================
//  DUSAKAWI EPSI — Service Worker (PWA Offline)
//  Versión: 5.0
// ================================================================

const CACHE = 'dusakawi-mapsdis-v5';
const ASSETS = [
  './manifest.json',
  './logo_dusakawi.png'
];

// Instalación: guarda assets estáticos en caché (NO el HTML)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activación: limpia cachés viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Interceptar peticiones
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // formulario.html → RED PRIMERO para siempre tener la versión más reciente
  // Solo cae a caché si no hay conexión
  if (url.includes('formulario.html') || url.endsWith('/')) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./formulario.html'))
    );
    return;
  }

  // Otros recursos (logo, manifest, etc.): caché primero
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./formulario.html'));
    })
  );
});

// Recibir mensajes del cliente
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
