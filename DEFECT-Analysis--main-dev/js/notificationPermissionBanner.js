// ============================================================
// notificationPermissionBanner.js
// بانر بسيط أسفل الشاشة يطلب من المستخدم تفعيل إشعارات المتصفح
// (Notification.requestPermission) بضغطة واضحة ومقصودة منه، مش نداء
// تلقائي صامت عند فتح التطبيق - أغلب المتصفحات بترفض/تتجاهل طلبات
// الصلاحية اللي مش مرتبطة بضغطة فعلية من المستخدم، وعشان مايبانش
// للمستخدم كطلب مفاجئ غير مبرر.
//
// بيظهر بس لو:
// - المتصفح بيدعم Notification API + Service Worker أصلاً
// - لسه ماتسألش قبل كده (Notification.permission === "default")
// - المستخدم مسجّل دخوله بالفعل (userId موجود في localStorage)
// - المستخدم مقفلش البانر قبل كده على نفس الجهاز
// ============================================================

import { translations } from './config.js';
import { initBrowserNotifications } from './pushNotifications.js';

const BANNER_ID = "notifPermissionBanner";
const DISMISSED_KEY = "notifPermissionBannerDismissed";

function t() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).notifPermission;
}

function isSupported() {
  return typeof Notification !== "undefined" && "serviceWorker" in navigator;
}

function shouldShow() {
  if (!isSupported()) return false;
  if (Notification.permission !== "default") return false;
  if (!localStorage.getItem("userId")) return false;
  if (localStorage.getItem(DISMISSED_KEY) === "true") return false;
  return true;
}

function removeBanner() {
  const el = document.getElementById(BANNER_ID);
  if (el) el.remove();
}

/**
 * عرض بانر طلب تفعيل الإشعارات لو الشروط متوفرة - آمنة تُستدعى
 * أكتر من مرة (مش هتكرر البانر لو موجود بالفعل، ومش هتظهره لو أي
 * شرط من فوق مش متحقق)
 */
export function renderNotificationPermissionBanner() {

  if (!shouldShow()) {
    removeBanner();
    return;
  }

  if (document.getElementById(BANNER_ID)) return;

  const tr = t();
  const el = document.createElement("div");
  el.id = BANNER_ID;
  el.className =
    "fixed bottom-20 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-lg sm:w-full z-[150] bg-[#1E293B] border border-blue-500/40 rounded-xl p-3 shadow-2xl flex items-center justify-between gap-2";
  el.innerHTML = `
    <span class="text-[11px] text-gray-200 font-bold">${tr.message}</span>
    <div class="flex gap-2 shrink-0">
      <button id="notifPermission_enable" class="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white active:scale-95 transition-all">${tr.enableBtn}</button>
      <button id="notifPermission_dismiss" class="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white active:scale-95 transition-all">✕</button>
    </div>
  `;
  document.body.appendChild(el);

  el.querySelector("#notifPermission_enable").addEventListener("click", async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        initBrowserNotifications();
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
    removeBanner();
  });

  el.querySelector("#notifPermission_dismiss").addEventListener("click", () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    removeBanner();
  });

}

window.renderNotificationPermissionBanner = renderNotificationPermissionBanner;
