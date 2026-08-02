const CACHE_NAME = 'maint-system-v1'; // تم تعديل Const إلى const
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './1000230635.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// حدث التثبيت (Install Event)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // محاولة إضافة الملفات للكاش
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.error("فشل إضافة بعض الملفات للكاش:", err));
    })
  );
  self.skipWaiting(); // تفعيل النسخة الجديدة فوراً
});

// حدث التفعيل (Activate Event) لتنظيف الكاش القديم
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim(); // السيطرة على كل الصفحات المفتوحة فوراً
});

// حدث جلب البيانات (Fetch Event)
self.addEventListener('fetch', (e) => {
  // استراتيجية Cache-First: ابحث في الكاش أولاً، وإن لم تجده اطلبه من الإنترنت
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
