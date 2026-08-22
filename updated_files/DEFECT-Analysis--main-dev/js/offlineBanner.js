// ============================================================
// offlineBanner.js
// بانر أعلى الشاشة يوضّح حالة الاتصال بالإنترنت:
//  - أحمر ثابت عند الانقطاع
//  - أخضر لمدة 3 ثوانٍ عند عودة الاتصال، بعد ما يخلّص مزامنة أي
//    بلاغات محفوظة محلياً (راجع syncOfflineTicketsApi في ticketsApi.js)
// ============================================================

import { syncOfflineTicketsApi } from './services/api.js';

const BANNER_ID = "offlineBanner";

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
  setBanner(true, "⚠️ لا يوجد اتصال بالإنترنت - سيتم حفظ البلاغات محلياً", "bg-red-600 text-white");
});

window.addEventListener("online", async () => {

  setBanner(true, "🔄 تم استعادة الاتصال - جاري المزامنة...", "bg-green-600 text-white");

  try {

    const result = await syncOfflineTicketsApi();
    const synced = result?.synced || 0;

    setBanner(
      true,
      synced > 0 ? `✅ تم رفع ${synced} بلاغ محفوظ بنجاح` : "✅ تم استعادة الاتصال",
      "bg-green-600 text-white"
    );

  } catch (error) {
    console.error("[OfflineSync] فشلت المزامنة التلقائية:", error);
    setBanner(true, "✅ تم استعادة الاتصال", "bg-green-600 text-white");
  }

  setTimeout(hideBanner, 3000);

});

// لو التطبيق اتفتح والنت مقطوع من الأساس، يظهر البانر فوراً
if (typeof navigator !== "undefined" && !navigator.onLine) {
  setBanner(true, "⚠️ لا يوجد اتصال بالإنترنت - سيتم حفظ البلاغات محلياً", "bg-red-600 text-white");
}
