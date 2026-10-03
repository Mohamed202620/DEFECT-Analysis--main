// ============================================================
// إصدار الكاش (بند M5): كان رقم يدوي (maint-system-v6.6) - لو حد نسي يرفعه
// بعد نشر، المتصفح بيفضل يخلط ملفات قديمة وجديدة من نفس الكاش (شاشة بيضاء
// بسبب import/export غير متطابقين). دلوقتي __BUILD_ID__ بيتبدّل تلقائياً
// وقت النشر بـ commit SHA (scripts/build.mjs في خطوة Build بـ CI)، فكل
// نشر = كاش جديد كلياً والقديم بيتمسح في activate. محلياً (بدون استبدال)
// بيشتغل بإصدار 'dev'.
// ============================================================
const BUILD_ID = '__BUILD_ID__';
const CACHE_NAME = 'maint-system-' + (BUILD_ID.startsWith('__') ? 'dev' : BUILD_ID);

// مهلة انتظار الشبكة قبل الرجوع للنسخة المخزّنة (ملفات JS/HTML/CSS)
const NETWORK_FIRST_TIMEOUT_MS = 4000;

// لو الشبكة ردّت فعلاً مؤخراً (اتصال شغّال)، مانرجعش لنسخة مخزّنة بسبب بطء
// لحظي في ملف واحد: ده كان بيخلط نسخة قديمة من وحدة مع جديدة من باقي
// الوحدات بعد النشر. بنزوّد المهلة طالما الشبكة ثبت إنها شغالة.
const NETWORK_RECENTLY_OK_MS = 30000;
const NETWORK_FIRST_TIMEOUT_WHEN_ONLINE_MS = 20000;
let lastNetworkOkAt = 0;

// نكتفي بالملفات الأساسية المضمونة لتجنب فشل التثبيت
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/branding/company-banner.png',
  './css/managerDesktop.css', // MGR-DESKTOP
  './js/vendor/jsQR.js' // QR-IMPROVE
];

// حدث التثبيت (Install Event)
// مكتبات تصدير PDF (بتتحمّل عند أول تصدير بدل ما تتحمّل مع كل فتح للتطبيق) -
// بنسخّن كاشها في الخلفية عند التثبيت عشان التصدير يفضل شغال أوفلاين.
// فشل أي واحدة هنا مايفشلش التثبيت (allSettled) والتطبيق بيحمّلها وقت الحاجة.
const OPTIONAL_CDN_WARMUP = [
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching Core Assets");
      return cache.addAll(CORE_ASSETS).then(() =>
        Promise.allSettled(
          OPTIONAL_CDN_WARMUP.map((url) =>
            fetch(url, { mode: 'no-cors' }).then((res) => cache.put(url, res))
          )
        )
      );
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

  // السماح بتكييش مكتبات الواجهة وCDN الأساسية (Tailwind, Chart.js, ExcelJS, dayjs, jsPDF)
  const isCdnAsset =
    url.hostname === 'cdn.tailwindcss.com' ||
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'cdnjs.cloudflare.com' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  // هام جداً: تجاهل أي طلب خارجي آخر (Firebase Firestore, Auth, Storage, ImgBB, Google APIs...)
  // لكي لا يتدخل Service Worker في اتصالات قواعد البيانات والاستعلامات الحية
  if (url.origin !== self.location.origin && !isCdnAsset) {
    return;
  }

  // إذا كان طلباً لأحد مكتبات CDN الخارجية الأساسية: نستخدم Cache-First مع التحديث في الخلفية
  if (isCdnAsset) {
    e.respondWith(
      caches.match(req).then((cachedRes) => {
        const fetchPromise = fetch(req).then((networkRes) => {
          if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        }).catch(() => null);

        return cachedRes || fetchPromise;
      })
    );
    return;
  }

  // لملفات الجافاسكريبت والـ HTML نستخدم Network-First لضمان أحدث كود دائماً
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname.endsWith('.css') || url.pathname === '/' || url.pathname.includes('/js/')) {
    // إصلاح (تحميل فعلي على شبكة ضعيفة): Network-First كان بيستنى الشبكة بلا حد
    // أقصى - على اتصال "شغّال بس بطيء/متقطع" (الواي فاي في الورشة) كل ملفات
    // الـ JS (عشرات الوحدات) كانت بتعلّق والتطبيق ما يفتحش رغم إن النسخة
    // المخزّنة جاهزة. دلوقتي: لو الشبكة ما ردّتش خلال NETWORK_FIRST_TIMEOUT_MS
    // وفيه نسخة مخزّنة نخدمها فوراً، والطلب يكمّل في الخلفية ويحدّث الكاش.
    // (لو مفيش نسخة مخزّنة بنكمّل نستنى الشبكة زي الأول - مفيش تغيير.)
    e.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);

      // Navigation بـ query string (مثلاً ?utm=...) مش بتطابق المخزّن حرفياً
      const cachedMatch = () =>
        caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));

      const networkPromise = fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200 && networkRes.type !== 'opaque') {
          lastNetworkOkAt = Date.now();
          cache.put(req, networkRes.clone());
        }
        return networkRes;
      });

      const cached = await cachedMatch();

      if (!cached) {
        // مفيش نسخة: لازم نستنى الشبكة (وبتفشل بشكل طبيعي لو أوفلاين)
        return networkPromise;
      }

      const timeoutMs = (Date.now() - lastNetworkOkAt) < NETWORK_RECENTLY_OK_MS
        ? NETWORK_FIRST_TIMEOUT_WHEN_ONLINE_MS
        : NETWORK_FIRST_TIMEOUT_MS;
      const timeout = new Promise((resolve) =>
        setTimeout(() => resolve(cached), timeoutMs)
      );

      // أول واحد يرد: الشبكة (لو نجحت قبل المهلة) أو النسخة المخزّنة
      // الفشل السريع للشبكة (أوفلاين) برضه بيرجّع النسخة المخزّنة
      return Promise.race([networkPromise.catch(() => cached), timeout]);
    })());
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
