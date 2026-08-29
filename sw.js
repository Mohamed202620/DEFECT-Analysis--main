// تحديث رقم الإصدار مهم جداً عندما تقوم بتعديل أي ملف ليقوم المتصفح بتحديث الكاش
// (تم رفعه من v1.8 إلى v1.9 هنا: دعم اختيار/إرفاق أكثر من صورة أو
// ملف في نفس العملية (مع إضافة لاحقة وحذف مستقل لكل عنصر) في كل
// كروت صفحة الصيانة - issueView.js/suggestionView.js/ActionModal.js
// + دعم تخزين وعرض الصور المتعددة (imageUrls) في ticketsApi.js/
// suggestionsApi.js/imageUpload.js/TicketDetailsModal.js/kaizenBoard.js/
// maintenanceSearch.js/ticketsBoard.js/workflow.js/renderCore.js -
// رقم الكاش القديم v1.8 كان موجوداً بالفعل في الملف من قبل هذه
// التعديلات، فلو المستخدم كان فاتح التطبيق قبل كده وعنده Service
// Worker مثبّت بنفس الرقم v1.8، هيفضل يقرأ النسخة القديمة من هذه
// الملفات (Stale-While-Revalidate) وميشوفش أي تغيير في الواجهة حتى
// لو الكود اتغيّر فعلاً على السيرفر - رفع الرقم هنا يجبر المتصفح
// يمسح الكاش القديم بالكامل)
const CACHE_NAME = 'maint-system-v5.1'; 

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

  // نكيّش طلبات GET بس (ملفات الواجهة: HTML/JS/CSS/الصور).
  if (req.method !== 'GET') {
    return; // سيب الطلب يمشي للشبكة عادي من غير أي تدخل من الـ SW
  }

  const url = new URL(req.url);

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
