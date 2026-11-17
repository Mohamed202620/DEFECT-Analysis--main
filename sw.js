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
  './js/vendor/jsQR.js', // QR-IMPROVE
  // GENERATED_MODULE_ASSETS_START
  './js/amTemplateManager.js',
  './js/attendanceCard.js',
  './js/attendancePatternManagement.js',
  './js/auth/login.js',
  './js/authHandlers.js',
  './js/branding.js',
  './js/companyHeaderConfig.js',
  './js/components/ActionModal.js',
  './js/components/BottomNav.js',
  './js/components/NotificationsModal.js',
  './js/components/PageView.js',
  './js/components/Sidebar.js',
  './js/components/TicketDetailsModal.js',
  './js/components/attachmentPicker.js',
  './js/components/headerComponent.js',
  './js/config.js',
  './js/dailyTips.js',
  './js/errorScanner.js',
  './js/firebase.js',
  './js/firebaseDefaults.js',
  './js/holidaysManagement.js',
  './js/kaizenBoard.js',
  './js/knowledgeBase.js',
  './js/machines.js',
  './js/maintenanceSearch.js',
  './js/managerDesktopCore.js',
  './js/notificationPermissionBanner.js',
  './js/offlineBanner.js',
  './js/pageRenderer.js',
  './js/payrollLocalStore.js',
  './js/permissions.js',
  './js/providers/backend/firebaseBackendProvider.js',
  './js/providers/backend/index.js',
  './js/providers/storage/imgbbStorageProvider.js',
  './js/providers/storage/index.js',
  './js/providers/storage/serverProxyStorageProvider.js',
  './js/pushNotifications.js',
  './js/pushSubscription.js',
  './js/renderCore.js',
  './js/router.js',
  './js/services/api.js',
  './js/services/attendanceSettingsApi.js',
  './js/services/checklistApi.js',
  './js/services/crypto.js',
  './js/services/dailyTipsApi.js',
  './js/services/defectsApi.js',
  './js/services/excelPatternParser.js',
  './js/services/exportUtility.js',
  './js/services/googleHolidaysSync.js',
  './js/services/holidaysApi.js',
  './js/services/imageUpload.js',
  './js/services/machineErrorsApi.js',
  './js/services/machinesApi.js',
  './js/services/notificationIds.js',
  './js/services/offlineQueue.js',
  './js/services/offlineSyncPolicy.js',
  './js/services/pmApi.js',
  './js/services/suggestionsApi.js',
  './js/services/ticketsApi.js',
  './js/services/usersApi.js',
  './js/statistics.js',
  './js/theme.js',
  './js/ticketStatusConstants.js',
  './js/ticketsBoard.js',
  './js/utils/departmentUtils.js',
  './js/utils/errorRowsView.js',
  './js/utils/escapeHtml.js',
  './js/utils/lineUtils.js',
  './js/utils/loadExternalScript.js',
  './js/utils/machineErrorOcr.js',
  './js/utils/managerDashboard.js',
  './js/utils/phoneUtils.js',
  './js/utils/pmSchedule.js',
  './js/utils/qrPayload.js',
  './js/utils/recordNumber.js',
  './js/utils/reportData.js',
  './js/views/ChecklistBuilderView.js',
  './js/views/DailyAMView.js',
  './js/views/DailyTipsSettingsView.js',
  './js/views/ErrorScannerView.js',
  './js/views/FiveSView.js',
  './js/views/KnowledgeBaseView.js',
  './js/views/MachineProfileView.js',
  './js/views/MachinesView.js',
  './js/views/MaintenanceSearchView.js',
  './js/views/MaintenanceView.js',
  './js/views/PmOrdersView.js',
  './js/views/QrScannerView.js',
  './js/views/RequestsView.js',
  './js/views/StatsView.js',
  './js/views/SystemView.js',
  './js/views/homeView.js',
  './js/views/issueView.js',
  './js/views/loginView.js',
  './js/views/managerDesktop/ManagerDesktopHome.js',
  './js/views/managerDesktop/ManagerDesktopTickets.js',
  './js/views/registerView.js',
  './js/views/reportView.js',
  './js/views/reportsView.js',
  './js/views/suggestionView.js',
  './js/workflow.js',
  // GENERATED_MODULE_ASSETS_END
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
      return Promise.allSettled(CORE_ASSETS.map((asset) => cache.add(asset))).then((results) => {
        results.forEach((result, index) => {
          if (result.status === 'rejected') console.warn("[SW] Core asset unavailable:", CORE_ASSETS[index]);
        });
        return Promise.allSettled(
          OPTIONAL_CDN_WARMUP.map((url) =>
            fetch(url, { mode: 'no-cors' }).then((res) => cache.put(url, res))
          )
        );
      });
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
// Web Push (works with the app closed). Same tag as the in-app notification => no duplicates.
const PUSH_ICONS = { assigned: '🛠️', resolved: '✅', closed: '✔️', rejected: '❌', under_review: '👀', revision_requested: '✏️', in_progress: '⚙️', implemented: '🎉' };
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = {}; }
  const icon = PUSH_ICONS[d.type] || '🔔';
  e.waitUntil(self.registration.showNotification(`${icon} نظام إدارة الصيانة`, {
    body: d.message || '',
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/icon-192.png',
    tag: d.notificationId || 'maint-push',
    data: { notificationId: d.notificationId || '', ticketId: d.ticketId || '', suggestionId: d.suggestionId || '' }
  }));
});

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
        const target = new URL('./', self.location.href);
        if (data.notificationId) target.searchParams.set('notificationId', data.notificationId);
        if (data.ticketId) target.searchParams.set('ticketId', data.ticketId);
        if (data.suggestionId) target.searchParams.set('suggestionId', data.suggestionId);
        return self.clients.openWindow(target.toString());
      }

    })
  );

});
