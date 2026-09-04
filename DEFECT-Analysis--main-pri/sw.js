// تحديث رقم الإصدار مهم جداً عندما تقوم بتعديل أي ملف ليقوم المتصفح بتحديث الكاش
const CACHE_NAME = 'maint-system-v5.7';

// نكتفي بالملفات الأساسية المضمونة لتجنب فشل التثبيت
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/app-icon.png'
];

// حدث التثبيت (Install Event)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching Core Assets");
      return cache.addAll(CORE_ASSETS);
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
            console.log("[SW] Deleting old cache:", key);
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
  const req = e.request;

  // نكيّش طلبات GET بس لملفات الواجهة المحلية (HTML/JS/CSS/الصور)
  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);

  // هام جداً: تجاهل أي طلب خارجي (Firebase Firestore, Auth, Storage, ImgBB, Google APIs...)
  // لكي لا يتدخل Service Worker في اتصالات قواعد البيانات والاستعلامات الحية
  if (url.origin !== self.location.origin) {
    return;
  }

  // لملفات الجافاسكريبت والـ HTML نستخدم Network-First لضمان أحدث كود دائماً
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.includes('/js/')) {
    e.respondWith(
      fetch(req).then((networkRes) => {
        if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkRes;
      }).catch(() => {
        return caches.match(req);
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cachedRes) => {
      const fetchPromise = fetch(req).then((networkRes) => {
        if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkRes;
      }).catch(() => {
        console.warn("[SW] Offline, and resource not in cache:", req.url);
      });

      return cachedRes || fetchPromise;
    })
  );
});

// ============================================================
// حدث الضغط على إشعار (Notification Click) - إضافة (إشعارات
// المتصفح): راجع js/pushNotifications.js لآلية إظهار الإشعار نفسه
// (reg.showNotification). الضغط هنا بيقفل الإشعار، وبيحاول يركّز
// على تبويب مفتوح بالفعل للتطبيق (Focus) بدل ما يفتح تبويب جديد
// دايماً - ولو مفيش تبويب مفتوح، بيفتح واحد جديد على الصفحة الرئيسية
// ============================================================
self.addEventListener('notificationclick', (e) => {

  e.notification.close();

  const data = e.notification.data || {};

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {

      for (const client of clientsList) {
        if ('focus' in client) {
          // إرسال تفاصيل الإشعار للتبويب المفتوح عشان الكود بتاع
          // الواجهة (router.js/renderCore.js) يقرر بنفسه فتح تفاصيل
          // التذكرة/المقترح المناسب - الـ Service Worker نفسه معندوش
          // صلاحية التنقل جوه صفحة SPA واحدة
          client.postMessage({ type: 'NOTIFICATION_CLICK', data });
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }

    })
  );

});
