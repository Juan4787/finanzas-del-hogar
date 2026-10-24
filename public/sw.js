const CACHE_NAME = 'finanzas-hogar-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
];

// Instalación: precargar activos esenciales del shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activación: limpiar cachés obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepción de solicitudes de red (Network First con fallback a Cache para HTML, y Stale-While-Revalidate para estáticos GET)
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones no HTTP/HTTPS o esquemas especiales (chrome-extension, etc.)
  if (!event.request.url.startsWith('http')) return;

  // Nunca interceptar métodos distintos de GET (POST /api/sync, etc.) ni endpoints de API
  if (event.request.method !== 'GET') return;
  try {
    const reqUrl = new URL(event.request.url);
    if (reqUrl.pathname.startsWith('/api/')) return;
  } catch {}

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // En segundo plano actualizamos el caché si hay red
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {
          // Sin conexión: el caché ya respondió perfectamente
        });
        return cachedResponse;
      }

      // Si no está en caché, intentar red y cachear
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback offline para navegación o imágenes si hiciera falta
        if (event.request.destination === 'image') {
          return caches.match('/icon.svg');
        }
      });
    })
  );
});
