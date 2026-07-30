const CACHE_NAME = 'defect-app-v2';

// قائمة الموديولات والملفات المراد تخزينها للعمل Off-line
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './1000230635.png',
  './js/config.js',
  './js/router.js',
  './js/workflow.js',
  './js/views/homeView.js',
  './js/views/reportView.js',
  './js/views/suggestionView.js',
  './js/views/pmView.js',
  './js/views/reportsView.js'
];

// 1. تثبيت الـ Service Worker وتخزين الملفات
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. تفعيل الـ Service Worker وتنظيف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. جلب الملفات من الكاش في حالة عدم وجود إنترنت
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
