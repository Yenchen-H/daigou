// 離線快取：程式本體用「先給快取、背景更新」，商品圖片永久快取，清單資料一律走網路（app 自己會在離線時用上次的資料）
var SHELL = 'daigou-shell-v4';
var IMG = 'daigou-img';
var FILES = ['./', 'index.html', 'app.css', 'app.js', 'icons.js', 'rate.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== SHELL && k !== IMG; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  var isImg = url.pathname.indexOf('/data/img/') >= 0 && (url.origin === location.origin || url.hostname === 'raw.githubusercontent.com');
  if (url.origin !== location.origin && !isImg) return;
  if (url.pathname.indexOf('/data/items.json') >= 0 || url.pathname.indexOf('admin') >= 0) return;
  if (isImg) {
    e.respondWith(caches.open(IMG).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; });
      });
    }));
    return;
  }
  e.respondWith(caches.open(SHELL).then(function (c) {
    return c.match(req, {ignoreSearch: true}).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
