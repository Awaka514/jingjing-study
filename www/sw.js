const CACHE = 'jingjing-v2';
const ASSETS = [
  './', './index.html', './style.css', './manifest.json', './icon.svg',
  './icon-192.png', './icon-512.png',
  './js/store.js', './js/charts.js', './js/gen.js', './js/app.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  // 网络优先：有网就用最新版本，失败再回退缓存（保证迭代时能看到更新，离线仍可用）
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
