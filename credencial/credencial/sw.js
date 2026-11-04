// Guarda la página para que abra aunque no haya señal. Los datos se piden siempre en línea.
const CACHE = "cpic-credencial-v2";
const ARCHIVOS = ["./", "index.html", "config.js", "fondo.jpg", "icono-192.png", "icono-512.png", "manifest.json",
  "lib/qrcode.min.js", "lib/fuentes.css", "lib/figtree-400.woff2", "lib/figtree-500.woff2",
  "lib/figtree-600.woff2", "lib/figtree-700.woff2", "lib/figtree-800.woff2"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.hostname.endsWith("google.com") || url.hostname.endsWith("googleusercontent.com")) return;
  // Primero la red (para recibir cambios); si no hay conexión, lo guardado.
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && url.origin === location.origin) {
        const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia));
      }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
