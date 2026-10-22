// Simple cache so repeat visits are fast and nothing heavy is downloaded twice.
//   Photos, relief image, map tiles, fonts and libraries: served from the cache once seen.
//   Pages, code, data and texts: always fetched fresh, with the cache as offline fallback.
// Bump VERSION when a photo or another cached file is replaced under the same name.
// (index.html also carries ?v= on its scripts and styles: bump it on each release.)
const VERSION = "v1";
const STATIC = `bolivia-static-${VERSION}`, CODE = `bolivia-code-${VERSION}`, TILES = `bolivia-tiles-${VERSION}`;
const MAX_TILES = 600;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keep = [STATIC, CODE, TILES];
    for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

const isStatic = url =>
  /\/(photos|assets)\//.test(url.pathname) ||
  ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname);
const isTile = url => url.hostname === "server.arcgisonline.com";

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (isTile(url)) event.respondWith(cacheFirst(req, TILES, MAX_TILES));
  else if (isStatic(url)) event.respondWith(cacheFirst(req, STATIC));
  else if (url.origin === location.origin) event.respondWith(networkFirst(req));
});

async function cacheFirst(req, name, max){
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // Opaque (no-CORS) answers take a lot of storage quota: keep them only for the few libraries.
  if (res.ok || (res.type === "opaque" && !max)){
    await cache.put(req, res.clone());
    if (max) trim(cache, max);
  }
  return res;
}
async function networkFirst(req){
  const cache = await caches.open(CODE);
  try {
    const res = await fetch(req, {cache: "no-cache"});   // revalidate, so a new deploy shows at once
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, {ignoreSearch: req.mode === "navigate"});
    if (hit) return hit;
    throw e;
  }
}
async function trim(cache, max){
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
