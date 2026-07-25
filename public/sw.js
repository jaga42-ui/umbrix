/* Umbrix service worker — minimal + safe.
 * - Static assets: cache-first (fast repeat loads, offline shell).
 * - Pages: network-first, fall back to cache when offline.
 * - /api/ is NEVER cached — job data, matches, and auth must always be fresh.
 * Bump CACHE to invalidate old caches on deploy.
 */
const CACHE = "umbrix-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin alone
  if (url.pathname.startsWith("/api/")) return; // always network, never cache

  const isAsset =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|svg|ico|webp|woff2?|css|js|json|txt)$/.test(url.pathname);

  if (isAsset) {
    // Cache-first for immutable/static assets.
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      })
    );
    return;
  }

  // Network-first for pages/navigations; fall back to cache, then to home.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || caches.match("/");
      })
  );
});
