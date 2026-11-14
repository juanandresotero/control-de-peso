// Service worker: deja abrir la app sin internet.
// Red primero (así siempre ves la última versión) y, si no hay conexión, lo guardado.
const CACHE = "control-peso-v4";
const ARCHIVOS = [
  "./", "index.html", "styles.css", "manifest.webmanifest", "icon-192.png", "icon-512.png",
  "vendor/chart.umd.min.js",
  "js/app.js", "js/ui.js", "js/fechas.js", "js/calculos.js", "js/datos.js", "js/sync.js", "js/respaldo.js",
  "js/cargar.js", "js/semanas.js", "js/resumen.js", "js/graficas.js", "js/ajustes.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const pedido = e.request;
  if (pedido.method !== "GET" || new URL(pedido.url).origin !== location.origin) return; // la sincronización va directo
  e.respondWith(
    fetch(pedido, { cache: "no-cache" }) // siempre pregunta si hay versión nueva (no usa la copia vieja del navegador)
      .then((resp) => {
        if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(pedido, copia)); }
        return resp;
      })
      .catch(() => caches.match(pedido, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))),
  );
});
