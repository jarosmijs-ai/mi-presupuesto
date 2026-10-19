const CACHE_VERSION = 'finance-established-v3';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(async (cache) => {
        await cache.addAll(APP_SHELL);
        // Vite emits hashed scripts and styles. Cache the shell's current assets
        // so the installed PWA can load its JavaScript without a connection.
        const documentResponse = await cache.match('/index.html');
        const html = documentResponse ? await documentResponse.text() : '';
        const assetPaths = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g)]
          .map((match) => match[1]);
        await Promise.all([...new Set(assetPaths)].map(async (path) => {
          const response = await fetch(path, { cache: 'no-store' });
          if (response.ok) await cache.put(path, response);
        }));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      const absoluteTarget = new URL(targetUrl, self.location.origin).href;
      for (const client of windowClients) {
        if ('navigate' in client) await client.navigate(absoluteTarget);
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(absoluteTarget);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/recover.html') {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(request).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          await cache.put(request, response.clone());
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(request);
        return cached || Response.error();
      })
    );
    return;
  }

  if (url.pathname.startsWith('/src/') || url.pathname.startsWith('/@vite/')) return;

  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkRequest = fetch(request)
          .then((response) => {
            if (!response || response.status !== 200) return response;
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached);
        return cached || networkRequest;
      })
    );
  }
});