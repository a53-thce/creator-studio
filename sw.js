/* 服务工作者：缓存应用外壳，让工作台可离线使用；API 走网络优先 + 缓存兜底 */
const CACHE = 'mcw-shell-v42';
/* 注意：data-daily.js 不放进 SHELL 预缓存，否则安装时会冻一份旧快照；
   它只走 FRESH 网络优先（见下方），每天都会被重新拉取 */
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
/* 每天都会被重新抓取覆盖的文件：必须网络优先，否则用户会一直吃到昨天的缓存 */
const FRESH = ['/assets/js/data-daily.js'];

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

/* 网络优先：用于 API 与每日更新的数据文件。拿不到时回落缓存（永不返回 undefined）。 */
function networkFirst(req) {
  return fetch(req, { cache: 'no-store' })
    .then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return r;
    })
    .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')));
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (API.some(h => url.hostname.includes(h))) {
    e.respondWith(networkFirst(e.request));
    return;
  }
  if (e.request.method !== 'GET') return;
  // 每日更新的数据文件：网络优先，拿不到回落缓存
  if (FRESH.some(p => url.pathname.endsWith(p))) {
    e.respondWith(networkFirst(e.request));
    return;
  }
  // 外壳文件（index.html/app.js/style.css 等）：缓存优先 + 后台静默更新。
  // 这样即使网络/SW 取数异常，页面也能从缓存秒开，绝不会出现“打不开”；
  // 新版本通过 CACHE 版本号升级 + 注册时 reg.update() 自动生效（见 index.html）。
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request, { cache: 'no-store' })
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match('./index.html'))
    )
  );
});
