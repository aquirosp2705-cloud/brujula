// Service worker: guarda la app en el equipo para que abra rápido y funcione sin internet.
// Al publicar una versión nueva, sube VERSION: la app avisa «Hay una versión nueva» y se actualiza al aceptar.

const VERSION = 'v2';
const CACHE = 'brujula-' + VERSION;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/backup.js', 'js/calc.js', 'js/charts.js', 'js/config.js', 'js/demo.js', 'js/entityforms.js', 'js/fields.js',
  'js/format.js', 'js/icons.js', 'js/install.js', 'js/moveform.js', 'js/store.js', 'js/ui.js',
  'js/views/ajustes.js', 'js/views/apuntes.js', 'js/views/bienvenida.js', 'js/views/common.js', 'js/views/cuentas.js',
  'js/views/deudas.js', 'js/views/historial.js', 'js/views/inicio.js', 'js/views/inversiones.js', 'js/views/mes.js',
  'js/views/metas.js', 'js/views/patrimonio.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('brujula-') && k !== CACHE).map((k) => caches.delete(k)))));
});

self.addEventListener('message', (e) => { if (e.data && e.data.t === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then((r) => r || fetch(req)).catch(() => fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
