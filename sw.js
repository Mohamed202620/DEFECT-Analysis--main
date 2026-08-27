// تحديث رقم الإصدار مهم جداً عندما تقوم بتعديل أي ملف ليقوم المتصفح بتحديث الكاش
// (تم رفعه من v1.7 إلى v1.8 هنا: استبدال قائمة الماكينات الطويلة بـ
// Dropdown حقيقي على خطوتين (نوع الماكينة ثم رقم الوحدة) في machines.js
// + تحديث issueView.js/suggestionView.js/MaintenanceSearchView.js/
// errorScanner.js/ErrorScannerView.js لاستخدام النظام الجديد - رقم
// الكاش القديم v1.7 كان موجوداً بالفعل في الملف من قبل هذه التعديلات،
// فلو المستخدم كان فاتح التطبيق قبل كده وعنده Service Worker مثبّت
// بنفس الرقم v1.7، هيفضل يقرأ النسخة القديمة من هذه الملفات
// (Stale-While-Revalidate) وميشوفش أي تغيير في الواجهة حتى لو الكود
// اتغيّر فعلاً على السيرفر - رفع الرقم هنا يجبر المتصفح يمسح الكاش
// القديم بالكامل)
const CACHE_NAME = 'maint-system-v1.8'; 

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
self.addEventListener('fetch', (e) => {
  const req = e.request;

  // نكيّش طلبات GET بس (ملفات الواجهة: HTML/JS/CSS/الصور).
  // طلبات الكتابة (POST/PUT..) بتاعة Firestore/ImgBB مالهاش لازمة
  // في الكاش أصلاً، وCache API مش بيدعمها أساساً (كانت بتطلع
  // خطأ "Request method 'POST' is unsupported" في الكونسول).
  if (req.method !== 'GET') {
    return; // سيب الطلب يمشي للشبكة عادي من غير أي تدخل من الـ SW
  }

  e.respondWith(
    caches.match(req).then((cachedRes) => {
      // استراتيجية (Stale-While-Revalidate)
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
