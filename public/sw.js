/* Sandman DB — Service Worker (PWA offline-first para o shell) */
const VERSION = 'sandman-db-v1';

// Shell do app: é o que dá para abrir sem rede.
const SHELL = [
  '/',
  '/index.html',
  '/crud.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

// Instalação: pré-cacheia o shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// Ativação: limpa caches antigos e assume o controle.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // POST/PUT/DELETE sempre vão pra rede

  const url = new URL(request.url);

  // API e health check: sempre rede (dados vivos do PostgreSQL).
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
    event.respondWith(fetch(request));
    return;
  }

  // Navegação (abrir o app): rede primeiro, cai pro cache offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Assets estáticos: cache primeiro, rede depois (atualiza o cache).
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return res;
        })
    )
  );
});
