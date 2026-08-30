// ============================================================
// NotificationsModal.js
// نافذة الإشعارات العامة - قابلة للفتح من أي صفحة في التطبيق
// (تحديداً زر 🔔 "الإشعارات" في الشريط السفلي BottomNav.js)
//
// ملاحظة إصلاح (مراجعة زر الإشعارات بالبوتوم في الصفحة الرئيسية):
// زر "الإشعارات" في BottomNav.js كان بينادي بالترتيب على
// window.openNotificationsModal ثم window.toggleNotifications ثم
// window.showNotificationsModal - وثلاثتهم مكانوش معرّفين في أي
// مكان بالمشروع فعلياً، فكان الزر يقع دايماً على الاحتياطي الأخير
// window.navigateTo('notifications')، وده مسار مفيهوش "case" في
// pageRenderer.js، فكان المستخدم بيتفاجئ بصفحة "🚧 قيد التطوير"
// (أو حتى يترمي لصفحة تسجيل الدخول) بدل شاشة الإشعارات الفعلية.
//
// نظام الإشعارات الحقيقي (forUid/read/type/message/createdAt في
// collection "notifications") كان بالفعل شغّال ومربوط بالكامل عبر
// services/ticketsApi.js + services/suggestionsApi.js، لكنه كان
// ظاهر للمستخدم فقط جوه صفحة "tickets" (متابعة البلاغات) عن طريق
// window.toggleNotificationsPanel في ticketsBoard.js - يعني زر
// الإشعارات في الرئيسية (والصفحات التانية) مكانش وصله للنظام ده
// أصلاً.
//
// هذا الملف بيعرّف window.openNotificationsModal فعلياً (أول دالة
// كان BottomNav.js بيدوّر عليها من الأساس) عشان الزر يشتغل من أي
// صفحة، وبيستخدم بالظبط نفس دوال الـ API الحقيقية المُصدَّرة بالفعل
// من services/api.js (fetchMyNotificationsApi / markNotificationReadApi /
// markAllNotificationsAsRead) - بدون إنشاء أي نظام إشعارات موازٍ
// جديد، وبدون أي تعديل على نظام صفحة "tickets" الحالي (لسه شغال
// زي ما هو لمين بيستخدمه من جوه الصفحة نفسها).
// ============================================================

import {
  fetchMyNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsAsRead
} from '../services/api.js';
import { translations } from '../config.js';

// إصلاح (ترجمة شاملة): نصوص النافذة كانت ثابتة بالعربي - دلوقتي
// بتقرأ من translations.notifications حسب window.currentLang وقت
// كل فتح للنافذة
function t() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).notifications;
}

const NOTIFICATION_ICONS = {
  assigned: "🛠️",
  resolved: "✅",
  closed: "✔️",
  rejected: "❌",
  under_review: "👀",
  revision_requested: "✏️",
  in_progress: "⚙️",
  implemented: "🎉"
};

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

function notificationItemHtml(n) {
  return `
    <div onclick="window.handleGlobalNotificationClick('${n.id}', '${n.ticketId || ""}', '${n.suggestionId || ""}')"
      class="p-2.5 rounded-lg mb-1.5 cursor-pointer border ${n.read ? "bg-transparent border-gray-800 text-gray-500" : "bg-blue-500/5 border-blue-500/20 text-gray-200"}">
      <div class="text-[11px] leading-relaxed">${NOTIFICATION_ICONS[n.type] || "🔔"} ${n.message || ""}</div>
      <div class="text-[9px] text-gray-500 mt-1">${formatDate(n.createdAt)}</div>
    </div>
  `;
}

/**
 * تحديث شارة (Badge) عدد الإشعارات غير المقروءة فوق زر 🔔 في
 * الهيدر - آمنة تماماً لو الهيدر غير ظاهر حالياً في DOM
 * (بترجع فوراً من غير أي تأثير جانبي)
 */
export async function refreshNotificationsBadge() {

  const badge = document.getElementById("headerNotifBadge");
  const myUid = localStorage.getItem("userId") || "";
  if (!badge || !myUid) return;

  const result = await fetchMyNotificationsApi(myUid);
  if (!result || result.status !== "success" || !Array.isArray(result.data)) return;

  const unread = result.data.filter(n => !n.read).length;

  if (unread > 0) {
    badge.textContent = unread > 9 ? "9+" : String(unread);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

}

/**
 * فتح نافذة الإشعارات - تعمل من أي صفحة بالتطبيق (بديل عام لا
 * يعتمد على وجود عناصر #notifPanel/#notifBadge الخاصة بصفحة
 * "tickets" فقط)
 */
export function openNotificationsModal() {

  // منع فتح أكتر من نسخة لو المستخدم ضغط الزرار أكتر من مرة بسرعة
  if (document.getElementById("globalNotifOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "globalNotifOverlay";
  overlay.className =
    "fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-4";

  const tr = t();

  overlay.innerHTML = `
    <div class="bg-[#1E293B] border border-gray-700 rounded-2xl w-full max-w-md p-4 shadow-2xl max-h-[80vh] flex flex-col">
      <div class="flex items-center justify-between mb-3 shrink-0">
        <h3 class="text-sm font-bold text-blue-400">${tr.title}</h3>
        <div class="flex items-center gap-3">
          <button id="globalNotif_markAll" class="text-[10px] text-gray-400 hover:text-blue-300 font-bold">${tr.markAll}</button>
          <button id="globalNotif_close" class="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>
      </div>
      <div id="globalNotif_body" class="text-center text-gray-500 text-xs py-8 overflow-y-auto">
        ${tr.loading}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    // القفل ممكن يكون غيّر حالة "مقروء" لبعض الإشعارات، فنحدّث
    // الشارة فوق الزرار فوراً بدل ما تفضل قيمتها القديمة
    refreshNotificationsBadge();
  };

  overlay.querySelector("#globalNotif_close").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  const load = async () => {

    const body = overlay.querySelector("#globalNotif_body");
    const myUid = localStorage.getItem("userId") || "";

    if (!myUid) {
      body.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">${t().noUser}</div>`;
      return;
    }

    const result = await fetchMyNotificationsApi(myUid);

    if (result.status !== "success") {
      body.innerHTML = `<div class="text-red-400 text-center text-[11px] py-4">${t().loadError}</div>`;
      return;
    }

    if (!result.data.length) {
      body.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">${t().empty}</div>`;
      return;
    }

    body.innerHTML = result.data.map(notificationItemHtml).join("");

  };

  overlay.querySelector("#globalNotif_markAll").addEventListener("click", async () => {
    const myUid = localStorage.getItem("userId") || "";
    if (!myUid) return;
    await markAllNotificationsAsRead(myUid);
    await load();
    refreshNotificationsBadge();
  });

  load();

}

/**
 * الضغط على إشعار مفرد: تعليمه كمقروء، ثم التوجيه لمصدره (تفاصيل
 * تذكرة صيانة أو لوحة متابعة الكايزن) لو متاح - بنفس فكرة
 * window.handleNotificationClick في ticketsBoard.js لكن بتغطية
 * إشعارات الكايزن (suggestionId) كمان
 */
window.handleGlobalNotificationClick = async function (notificationId, ticketId, suggestionId) {

  await markNotificationReadApi(notificationId);

  const overlay = document.getElementById("globalNotifOverlay");
  if (overlay) overlay.remove();

  refreshNotificationsBadge();

  if (ticketId) {
    if (typeof window.openTicketDetailsModal === "function") {
      window.openTicketDetailsModal(ticketId);
    }
  } else if (suggestionId) {
    if (typeof window.navigateTo === "function") {
      window.navigateTo("kaizenBoard");
    }
  }

};

window.openNotificationsModal = openNotificationsModal;
window.refreshNotificationsBadge = refreshNotificationsBadge;
