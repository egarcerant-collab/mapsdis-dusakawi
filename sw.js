// ================================================================
//  DUSAKAWI EPSI — Service Worker (PWA Offline)
//  Versión: 3.0
// ================================================================

const CACHE = 'dusakawi-mapsdis-v4';
const ASSETS = [
  './formulario.html',
  './manifest.json',
  './logo_dusakawi.png'
];

// Instalación: guarda archivos en caché
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

// Interceptar peticiones: caché primero, luego red
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Sin conexión: retornar el formulario principal
        return caches.match('./formulario.html');
      });
    })
  );
});

// Recibir mensajes del cliente
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
