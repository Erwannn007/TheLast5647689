// Hors ligne : on garde une copie de chaque fichier ; le réseau d'abord, pour recevoir les mises à jour.
const CACHE = 'thelast-v4';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'src/main.js', 'src/gfx.js', 'src/bank.js', 'src/state.js', 'src/game.js', 'src/render.js', 'src/ui.js', 'src/audio.js',
  'src/items.js', 'src/world.js', 'src/palette.js', 'src/raster.js', 'src/solids.js',
  'src/sprites/tiles.js', 'src/sprites/nature.js', 'src/sprites/build.js', 'src/sprites/props.js', 'src/sprites/cars.js', 'src/sprites/player.js', 'src/sprites/icons.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
