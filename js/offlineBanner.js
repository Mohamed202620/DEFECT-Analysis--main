// ============================================================
// offlineBanner.js
// بانر أعلى الشاشة يوضّح حالة الاتصال بالإنترنت:
//  - أحمر ثابت عند الانقطاع
//  - أخضر لمدة 3 ثوانٍ عند عودة الاتصال، بعد ما يخلّص مزامنة أي
//    بلاغات محفوظة محلياً (راجع syncOfflineTicketsApi في ticketsApi.js)
// ============================================================

import { syncOfflineTicketsApi, syncOfflineTicketActionsApi } from './services/api.js';
import { translations } from './config.js';

const BANNER_ID = "offlineBanner";

// إصلاح (ترجمة شاملة): نصوص البانر كانت ثابتة بالعربي بغض النظر عن
// اللغة المختارة - دلوقتي بتقرأ من translations.offline حسب
// window.currentLang الحالي وقت كل ظهور للبانر
function t() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).offline;
}

function ensureBannerEl() {

  let el = document.getElementById(BANNER_ID);

  if (!el) {
    el = document.createElement("div");
    el.id = BANNER_ID;
    document.body.appendChild(el);
  }

  return el;

}

function setBanner(visible, message, colorClass) {

  const el = ensureBannerEl();

  el.textContent = message || "";
  el.className =
    "fixed top-0 inset-x-0 z-[200] text-center text-xs font-bold py-2 " +
    "transition-transform duration-300 " +
    (visible ? "translate-y-0 " : "-translate-y-full ") +
    (colorClass || "");

}

function hideBanner() {
  setBanner(false, "", "");
}

window.addEventListener("offline", () => {
  setBanner(true, t().offlineMsg, "bg-red-600 text-white");
});

window.addEventListener("online", async () => {

  setBanner(true, t().syncing, "bg-green-600 text-white");

  try {

    // إضافة (تحسين Workflow - دعم Offline لتحديث الحالة): مزامنة
    // البلاغات الجديدة المحفوظة محلياً + إجراءات دورة حياة التذاكر
    // (بدء تنفيذ/تم الإصلاح/تأكيد الإغلاق) مع بعض عند عودة الاتصال
    const [ticketsResult, actionsResult] = await Promise.all([
      syncOfflineTicketsApi(),
      syncOfflineTicketActionsApi()
    ]);
    const synced = (ticketsResult?.synced || 0) + (actionsResult?.synced || 0);

    setBanner(
      true,
      synced > 0 ? t().syncedWithCount.replace("{n}", synced) : t().restored,
      "bg-green-600 text-white"
    );

  } catch (error) {
    console.error("[OfflineSync] فشلت المزامنة التلقائية:", error);
    setBanner(true, t().restored, "bg-green-600 text-white");
  }

  setTimeout(hideBanner, 3000);

});

// لو التطبيق اتفتح والنت مقطوع من الأساس، يظهر البانر فوراً
if (typeof navigator !== "undefined" && !navigator.onLine) {
  setBanner(true, t().offlineMsg, "bg-red-600 text-white");
}
