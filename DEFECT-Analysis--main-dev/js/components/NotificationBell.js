// ============================================================
// NotificationBell.js
// جرس الإشعارات - عنصر عائم (Fixed) يُضاف مرة واحدة لكل الصفحات
// بعد تسجيل الدخول. عدد غير المقروء لحظي (onSnapshot).
// ============================================================

import {
  fetchMyNotificationsApi,
  markNotificationReadApi,
  subscribeToUnreadCount
} from '../services/api.js';

let unsubscribeFn = null;

function bellButtonHtml() {
  return `
    <div id="notificationBellWrapper" class="fixed top-4 left-4 z-40">
      <button id="notificationBellBtn"
        class="w-11 h-11 rounded-full bg-[#1E293B] border border-gray-700 shadow-lg flex items-center justify-center relative active:scale-95 transition-all">
        <span class="text-lg">🔔</span>
        <span id="notificationBadge"
          class="hidden absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          0
        </span>
      </button>
      <div id="notificationDropdown"
        class="hidden absolute top-14 left-0 w-72 max-h-80 overflow-y-auto bg-[#1E293B] border border-gray-700 rounded-2xl shadow-2xl p-2">
      </div>
    </div>
  `;
}

async function renderDropdown() {

  const dropdown = document.getElementById("notificationDropdown");
  if (!dropdown) return;

  const myUid = localStorage.getItem("userId") || "";
  dropdown.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">جاري التحميل...</div>`;

  const result = await fetchMyNotificationsApi(myUid);
  const items = result.status === "success" ? result.data : [];

  if (!items.length) {
    dropdown.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">لا توجد إشعارات.</div>`;
    return;
  }

  dropdown.innerHTML = items.map(n => `
    <div
      onclick="window.handleNotificationClick('${n.id}', '${n.ticketId || ""}')"
      class="p-2.5 rounded-xl mb-1 cursor-pointer transition-all ${n.read ? "opacity-60" : "bg-blue-500/10 border border-blue-500/20"} hover:opacity-100">
      <div class="text-[11px] font-bold text-gray-100">${n.title || ""}</div>
      <div class="text-[10px] text-gray-400 mt-0.5">${n.message || ""}</div>
      <div class="text-[9px] text-gray-600 mt-1">${n.createdAt ? new Date(n.createdAt).toLocaleString("ar-EG") : ""}</div>
    </div>
  `).join("");

}

window.handleNotificationClick = async function (notificationId, ticketId) {

  await markNotificationReadApi(notificationId);

  const dropdown = document.getElementById("notificationDropdown");
  if (dropdown) dropdown.classList.add("hidden");

  if (ticketId && typeof window.openTicketDetails === "function") {
    window.openTicketDetails(ticketId);
  }

};

/**
 * تفعيل جرس الإشعارات - تُستدعى بعد نجاح تسجيل الدخول، وعند
 * إعادة تحميل الصفحة لو فيه جلسة دخول محفوظة بالفعل (راجع
 * authHandlers.js و renderCore.js)
 */
window.initNotificationBell = function () {

  if (document.getElementById("notificationBellWrapper")) return; // مُفعّل بالفعل

  const myUid = localStorage.getItem("userId") || "";
  if (!myUid) return;

  document.body.insertAdjacentHTML("beforeend", bellButtonHtml());

  document.getElementById("notificationBellBtn").addEventListener("click", () => {
    const dropdown = document.getElementById("notificationDropdown");
    if (!dropdown) return;
    const isHidden = dropdown.classList.contains("hidden");
    dropdown.classList.toggle("hidden");
    if (isHidden) renderDropdown();
  });

  unsubscribeFn = subscribeToUnreadCount(myUid, count => {
    const badge = document.getElementById("notificationBadge");
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  });

};

/**
 * إزالة الجرس والاشتراك اللحظي عند تسجيل الخروج
 */
window.destroyNotificationBell = function () {

  if (typeof unsubscribeFn === "function") {
    unsubscribeFn();
    unsubscribeFn = null;
  }

  document.getElementById("notificationBellWrapper")?.remove();

};
