/* service worker — version e60573059c */
const V = "prepa-e60573059c";
const CORE = ["./", "index.html", "config.js", "manifest.webmanifest", "icons/favicon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png", "vendor/react.production.min.js", "vendor/react-dom.production.min.js", "vendor/htm.umd.js", "vendor/firebase-app-compat.js", "vendor/firebase-auth-compat.js", "vendor/firebase-firestore-compat.js", "fonts/barlow-400.woff2", "fonts/barlow-500.woff2", "fonts/barlow-600.woff2", "fonts/barlow-700.woff2", "fonts/barlow-condensed-600.woff2", "fonts/barlow-condensed-700.woff2"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return; /* Firebase, Open Food Facts : toujours le réseau */
  const fresh = r.mode === "navigate" || /\/(index\.html|config\.js|ciqual\.json|i18n_[a-z]+\.json)?$/.test(u.pathname);
  if (fresh) {
    e.respondWith(fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r).then((m) => m || caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; })));
});
