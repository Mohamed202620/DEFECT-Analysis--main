// ============================================================
// NotificationBell.js
// جرس الإشعارات - زر يظهر في أعلى يسار الصفحة بجانب زر الثيم
// ============================================================

import {
  markNotificationReadApi,
  markAllNotificationsAsRead,
  subscribeToMyNotificationsApi
} from '../services/api.js';

let unsubscribeFn = null;
let allNotifications = [];
let activeTab = "unread"; // "unread" | "archive"

function bellButtonHtml() {
  return `
    <div id="notificationBellWrapper" class="absolute top-4 left-20 z-50">
      <button id="notificationBellBtn"
        class="w-11 h-11 rounded-full bg-[#1E293B] border border-gray-700 shadow-xl flex items-center justify-center relative active:scale-95 transition-all">
        <span class="text-lg">🔔</span>

        <span id="notificationBadge"
          class="hidden absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          0
        </span>
      </button>

            <div id="notificationDropdown"
        class="hidden absolute top-full left-0 mt-2 w-64 max-h-96 overflow-hidden flex flex-col bg-[#1E293B] border border-gray-700 rounded-2xl shadow-2xl z-50">
 

        <div class="flex items-center gap-1 p-2 border-b border-gray-700">
          <button id="notifTabUnread"
            class="flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all">
            الجديدة
          </button>

          <button id="notifTabArchive"
            class="flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all">
            الأرشيف
          </button>
        </div>

        <div id="notificationList"
          class="overflow-y-auto p-2 flex-1">
        </div>

        <div class="p-2 border-t border-gray-700">
          <button id="notifMarkAllBtn"
            class="w-full text-[11px] font-bold py-1.5 rounded-lg bg-blue-500/10 text-blue-400 active:scale-95 transition-all">
            تحديد الكل كمقروء
          </button>
        </div>

      </div>
    </div>
  `;
}

function renderTabs() {
  const unreadCount = allNotifications.filter(n => !n.read).length;
  const tabUnread = document.getElementById("notifTabUnread");
  const tabArchive = document.getElementById("notifTabArchive");

  if (!tabUnread || !tabArchive) return;

  tabUnread.textContent = `الجديدة${unreadCount ? ` (${unreadCount})` : ""}`;
  tabArchive.textContent = "الأرشيف";

  tabUnread.className = `flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${
    activeTab === "unread" ? "bg-blue-500 text-white" : "text-gray-400"
  }`;

  tabArchive.className = `flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${
    activeTab === "archive" ? "bg-blue-500 text-white" : "text-gray-400"
  }`;
}

function renderList() {
  const list = document.getElementById("notificationList");
  if (!list) return;

  const items = allNotifications.filter(n => activeTab === "unread" ? !n.read : n.read);

  if (!items.length) {
    list.innerHTML = `
      <div class="text-center text-gray-500 text-[11px] py-6">
        ${activeTab === "unread" ? "لا توجد إشعارات جديدة" : "الأرشيف فارغ"}
      </div>
    `;
    return;
  }

  list.innerHTML = items.map(n => `
    <div
      onclick="window.handleNotificationClick('${n.id}', '${n.ticketId || ""}', '${n.suggestionId || ""}')"
      class="p-2.5 rounded-xl mb-1 cursor-pointer transition-all ${
        n.read ? "opacity-60" : "bg-blue-500/10 border border-blue-500/20"
      } hover:opacity-100">
      <div class="text-[11px] font-bold text-gray-100">${n.title || n.message || ""}</div>
      ${n.title ? `<div class="text-[10px] text-gray-400 mt-0.5">${n.message || ""}</div>` : ""}
      <div class="text-[9px] text-gray-600 mt-1">${n.createdAt ? new Date(n.createdAt).toLocaleString("ar-EG") : ""}</div>
    </div>
  `).join("");
}

function renderDropdown() {
  renderTabs();
  renderList();
}

window.handleNotificationClick = async function (notificationId, ticketId, suggestionId) {
  await markNotificationReadApi(notificationId);
  const dropdown = document.getElementById("notificationDropdown");
  if (dropdown) dropdown.classList.add("hidden");

  if (ticketId && typeof window.openTicketDetails === "function") {
    window.openTicketDetails(ticketId);
  } else if (suggestionId && typeof window.navigateTo === "function") {
    // مفيش تخزين محلي مستقل لتفاصيل مقترح بعينه خارج صفحة لوحة
    // الكايزن نفسها، فبنكتفي بتوجيه المستخدم لصفحة اللوحة (نفس ما
    // بيحصل مع باقي أزرار التنقل في المشروع) - بدون أي طلب إضافي
    // أو ملف جديد
    window.navigateTo("kaizenBoard");
  }
};

window.initNotificationBell = function () {
  if (document.getElementById("notificationBellWrapper")) return;

  const myUid = localStorage.getItem("userId") || "";
  if (!myUid) return;

  document.body.insertAdjacentHTML("beforeend", bellButtonHtml());

  activeTab = "unread";

  document.getElementById("notificationBellBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById("notificationDropdown");
    dropdown.classList.toggle("hidden");
    if (!dropdown.classList.contains("hidden")) renderDropdown();
  });

  document.addEventListener("click", (e) => {
    const wrapper = document.getElementById("notificationBellWrapper");
    const dropdown = document.getElementById("notificationDropdown");
    if (wrapper && dropdown && !wrapper.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });

  document.getElementById("notifTabUnread").addEventListener("click", () => {
    activeTab = "unread";
    renderDropdown();
  });

  document.getElementById("notifTabArchive").addEventListener("click", () => {
    activeTab = "archive";
    renderDropdown();
  });

  document.getElementById("notifMarkAllBtn").addEventListener("click", async () => {
    await markAllNotificationsAsRead(myUid);
  });

  unsubscribeFn = subscribeToMyNotificationsApi(myUid, (result) => {
    allNotifications = result.status === "success" ? result.data : [];
    const badge = document.getElementById("notificationBadge");
    const unreadCount = allNotifications.filter(n => !n.read).length;

    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    }

    const dropdown = document.getElementById("notificationDropdown");
    if (dropdown && !dropdown.classList.contains("hidden")) renderDropdown();
  });
};

window.destroyNotificationBell = function () {
  if (typeof unsubscribeFn === "function") {
    unsubscribeFn();
    unsubscribeFn = null;
  }
  allNotifications = [];
  activeTab = "unread";
  document.getElementById("notificationBellWrapper")?.remove();
};
