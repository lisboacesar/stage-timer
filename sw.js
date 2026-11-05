// Keeps the app working at events with weak or no Wi-Fi.
// Network first, so a new version arrives when online. The cache answers when
// the network fails or takes longer than a few seconds.

const CACHE = 'stage-timer-v1';
const NETWORK_TIMEOUT_MS = 3000;
const FILES = [
  './',
  'index.html',
  'stage.html',
  'styles.css',
  'manifest.webmanifest',
  'icon.svg',
  'src/timer.js',
  'src/sync.js',
  'src/stage.js',
  'src/control.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  });
  const timeout = new Promise((resolve) => { setTimeout(resolve, NETWORK_TIMEOUT_MS, null); });
  try {
    const response = await Promise.race([network, timeout]);
    if (response) return response;
  } catch {
    // Offline: the cache answers below.
  }
  const cached = await cache.match(request, { ignoreSearch: true });
  return cached ?? network;
}
