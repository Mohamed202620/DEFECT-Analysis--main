// تحديث رقم الإصدار مهم جداً عندما تقوم بتعديل أي ملف ليقوم المتصفح بتحديث الكاش
//
// إصلاح: كان رقم الإصدار ده واقف على v1.3 من فترة طويلة رغم إن ملفات
// JS كتير اتعدّلت بعده (lang.js / LanguageToggle.js / NotificationBell.js
// وغيرهم) - يعني أي تعديل بعد أول مرة اتفتح فيها الصفحة كان بيتخزن جوه
// نفس الـ Cache القديم (v1.3) من غير ما يتمسح، فالمتصفح فضل يقرأ نسخ
// قديمة من الملفات دي (زرار اللغة مثلاً من قبل ما يتضاف، أو جرس
// الإشعارات من قبل إصلاحه) - راجع تفصيل استراتيجية الجلب تحت كمان
const CACHE_NAME = 'maint-system-v1.4';

// نكتفي بالملفات الأساسية المضمونة لتجنب فشل التثبيت
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './1000230635.png'
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
//
// إصلاح: كل الطلبات (حتى ملفات JS بتاعة التطبيق نفسه) كانت بتتعامل
// بنفس استراتيجية Stale-While-Revalidate (تعرض النسخة المخزنة فوراً
// لو موجودة، وتجيب نسخة أحدث في الخلفية للمرة الجاية بس) - ده معناه
// إن أي تعديل على كود التطبيق (js/*.js) كان بياخد "تحديث واحد زيادة"
// قبل ما يظهر فعلياً للمستخدم (يظهر بعد أول Reload تاني بعد التعديل،
// مش فور التعديل)، وده اللي كان بيدي إحساس إن ميزات زي زرار اللغة أو
// جرس الإشعارات "مش شغالة" أو "بتختفي" بعد أي تحديث - مع إن الكود
// نفسه سليم، المتصفح كان بيعرض نسخة قديمة مخزّنة.
//
// الحل: ملفات التطبيق نفسها (HTML + JS المحلي) بقت Network First
// (يجيب من الشبكة الأول، ولو فشل - زي انقطاع النت - يرجع للكاش كـ
// احتياطي بس) عشان أي تعديل يظهر فوراً. باقي الملفات (صور/مكتبات
// CDN خارجية زي Tailwind/Chart.js) فضلت على نفس استراتيجية
// Stale-While-Revalidate القديمة لأنها بتتغيّر نادراً والسرعة/العمل
// أوفلاين أهم بالنسبالها.
self.addEventListener('fetch', (e) => {
  const req = e.request;

  // نكيّش طلبات GET بس (ملفات الواجهة: HTML/JS/CSS/الصور).
  // طلبات الكتابة (POST/PUT..) بتاعة Firestore/ImgBB مالهاش لازمة
  // في الكاش أصلاً، وCache API مش بيدعمها أساساً (كانت بتطلع
  // خطأ "Request method 'POST' is unsupported" في الكونسول).
  if (req.method !== 'GET') {
    return; // سيب الطلب يمشي للشبكة عادي من غير أي تدخل من الـ SW
  }

  const url = new URL(req.url);
  const isAppShell =
    url.origin === self.location.origin &&
    (req.mode === 'navigate' || url.pathname.endsWith('.js') || url.pathname.endsWith('.html'));

  if (isAppShell) {
    // Network First: أي تعديل في كود التطبيق يظهر من أول Reload
    e.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(req)) // أوفلاين → آخر نسخة متاحة بالكاش
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cachedRes) => {
      // استراتيجية (Stale-While-Revalidate) - للملفات الثابتة/الخارجية بس
      // جلب النسخة الأحدث من الشبكة لتحديث الكاش في الخلفية
      const fetchPromise = fetch(req).then((networkRes) => {
        // التأكد من أن الاستجابة صالحة قبل تخزينها
        // type 'basic' للملفات المحلية، و 'opaque' للملفات الخارجية (CDN)
        if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkRes;
      }).catch(() => {
        // ماذا يحدث لو انقطع الإنترنت والملف غير موجود في الكاش؟
        console.warn("[SW] Offline, and resource not in cache:", req.url);
      });

      // إذا كان الملف في الكاش، اعرضه للمستخدم فوراً (سرعة عالية).
      // وإذا لم يكن، انتظر جلب الشبكة.
      return cachedRes || fetchPromise;
    })
  );
});
