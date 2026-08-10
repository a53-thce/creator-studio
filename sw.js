/* 服务工作者：缓存应用外壳，让工作台可离线使用；API 走网络优先 + 缓存兜底 */
const CACHE = 'mcw-shell-v20';
const SHELL = [
  './',
  './index.html',
  './icon.svg',
  './assets/img/mascot.png',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/js/data-english.js',
  './assets/js/data-content.js',
  './assets/js/data-tcm.js',
  './assets/js/data-videos.js'
];
const API = ['open-meteo.com', '60s.viki.moe', 'allorigins.win', 'quotable.io', 'openlibrary.org', 'hnrss.org', 'covers.openlibrary.org'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (API.some(h => url.hostname.includes(h))) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return r;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
