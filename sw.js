/*
 * Service worker: lets the site be installed as an app and opened offline.
 *
 * - Files on this site: network first, so a new version shows up on the next load.
 *   The copy in the cache is used only when the network is unavailable.
 * - Files from CDNs (three.js, Google Fonts): cache first. Their URLs carry a version,
 *   so a cached copy never goes stale.
 * - On install, the list page and every catalogue in catalogues.json are cached,
 *   so all catalogues open offline once the app has been opened online.
 *   (3D catalogues also need three.js, which is cached the first time one is opened.)
 */
const CACHE = 'cg-zukan-v1';
const CDN_CACHE = 'cg-zukan-cdn-v1';
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

const SHELL = [
  './', 'catalogues.json', 'manifest.webmanifest',
  'assets/css/base.css', 'assets/css/series.css', 'assets/css/index.css',
  'assets/js/g2d.js', 'assets/js/g3d.js', 'assets/js/series.js', 'assets/js/index.js',
  'assets/icons/icon.svg', 'assets/icons/icon-192.png', 'assets/icons/apple-touch-icon.png'
];

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  // catalogue pages: a missing file must not stop the install
  try {
    const data = await (await fetch('catalogues.json', { cache: 'no-cache' })).json();
    const urls = [];
    for (const c of data.catalogues || []) {
      if (!c.path) continue;
      urls.push(c.path, c.path + 'main.js');
      if (c.thumbnail) urls.push(c.thumbnail);
    }
    await Promise.all(urls.map((u) => cache.add(u).catch(() => {})));
  } catch (e) { /* offline during install: pages are cached as they are visited */ }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== CDN_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CDN_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(req));
  else if (CDN_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(req));
});
