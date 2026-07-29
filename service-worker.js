// ============================================================
// 呼噜苹果工作台 - Service Worker
// 功能：离线缓存 + 版本更新检测
// ============================================================

const CACHE_VERSION = 'hulu-apple-v2';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

// 需要预缓存的静态资源
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

// ============================================================
// INSTALL: 预缓存核心资源
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.log('[SW] Install error:', err))
  );
});

// ============================================================
// ACTIVATE: 清理旧缓存，接管控制权
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key.startsWith('hulu-apple-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
      .then(() => {
        // 通知所有客户端有新版本
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
          });
        });
      })
  );
});

// ============================================================
// FETCH: 缓存优先 + 网络回退 (离线可用)
// ============================================================
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 同源请求：缓存优先
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request)
        .then((cached) => {
          if (cached) {
            // 后台更新缓存
            fetch(event.request).then((response) => {
              if (response && response.status === 200) {
                caches.open(RUNTIME_CACHE).then((cache) => {
                  cache.put(event.request, response.clone());
                });
              }
            }).catch(() => {});
            return cached;
          }
          // 没有缓存，从网络获取
          return fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                const clone = response.clone();
                caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone));
              }
              return response;
            })
            .catch(() => {
              // 离线回退到 index.html
              return caches.match('./index.html');
            });
        })
    );
  }
});

// ============================================================
// MESSAGE: 处理来自页面的消息
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});
