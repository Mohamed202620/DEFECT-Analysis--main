// ============================================================
// NotificationsModal.js
// نافذة الإشعارات العامة المعاد تصميمها فائقة الوضوح والسهولة
// تدعم الفلترة، تمييز غير المقروء، التنقل المباشر، وتحديث الـ Badges
// ============================================================

import { escapeHtml, escapeJsArg } from "../utils/escapeHtml.js";
import {
  fetchMyNotificationsApi,
  countUnreadNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsAsRead
} from '../services/api.js';
import { translations } from '../config.js';

function t() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).notifications;
}

const TYPE_CONFIG = {
  assigned: {
    icon: "🛠️",
    badgeAr: "إسناد بلاغ",
    badgeEn: "Assigned",
    theme: "border-blue-500/40 bg-blue-500/10 text-blue-400",
    glow: "bg-blue-500"
  },
  resolved: {
    icon: "✅",
    badgeAr: "تم الإصلاح",
    badgeEn: "Resolved",
    theme: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    glow: "bg-emerald-500"
  },
  closed: {
    icon: "✔️",
    badgeAr: "مغلق نهائياً",
    badgeEn: "Closed",
    theme: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
    glow: "bg-cyan-500"
  },
  rejected: {
    icon: "❌",
    badgeAr: "رفض / تنبيه",
    badgeEn: "Rejected",
    theme: "border-red-500/40 bg-red-500/10 text-red-400",
    glow: "bg-red-500"
  },
  under_review: {
    icon: "⏳",
    badgeAr: "قيد المراجعة",
    badgeEn: "Under Review",
    theme: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    glow: "bg-amber-500"
  },
  revision_requested: {
    icon: "✏️",
    badgeAr: "مطلوب تعديل",
    badgeEn: "Revision",
    theme: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    glow: "bg-amber-500"
  },
  in_progress: {
    icon: "⚙️",
    badgeAr: "جاري العمل",
    badgeEn: "In Progress",
    theme: "border-indigo-500/40 bg-indigo-500/10 text-indigo-400",
    glow: "bg-indigo-500"
  },
  implemented: {
    icon: "🏆",
    badgeAr: "تم الاعتماد",
    badgeEn: "Implemented",
    theme: "border-purple-500/40 bg-purple-500/10 text-purple-400",
    glow: "bg-purple-500"
  }
};

function formatSmartDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const isEn = (window.currentLang || "ar") === "en";

    if (diffMin < 2) return isEn ? "Just now" : "الآن";
    if (diffMin < 60) return isEn ? `${diffMin}m ago` : `منذ ${diffMin} دقيقة`;

    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString(isEn ? "en-US" : "ar-EG", {
      hour: "2-digit",
      minute: "2-digit"
    });

    if (isToday) return `${isEn ? "Today" : "اليوم"} ${timeStr}`;
    if (isYesterday) return `${isEn ? "Yesterday" : "أمس"} ${timeStr}`;

    return d.toLocaleDateString(isEn ? "en-US" : "ar-EG", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

let activeFilterTab = "all";
let cachedNotifications = [];

function renderNotificationCard(n) {
  const isEn = (window.currentLang || "ar") === "en";
  const conf = TYPE_CONFIG[n.type] || {
    icon: "🔔",
    badgeAr: n.ticketId ? "بلاغ صيانة" : (n.suggestionId ? "مقترح كايزن" : "تنبيه عام"),
    badgeEn: n.ticketId ? "Ticket" : (n.suggestionId ? "Kaizen" : "Notice"),
    theme: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    glow: "bg-blue-400"
  };

  const badgeText = isEn ? conf.badgeEn : conf.badgeAr;
  const isUnread = !n.read;
  const timeFormatted = formatSmartDate(n.createdAt);

  return `
    <div
      role="button"
      tabindex="0"
      onclick="window.handleGlobalNotificationClick('${escapeJsArg(n.id)}', '${escapeJsArg(n.ticketId || "")}', '${escapeJsArg(n.suggestionId || "")}')"
      class="group relative text-start p-3.5 sm:p-4 rounded-xl border transition-all duration-200 cursor-pointer active:scale-[0.99] select-none ${
        isUnread
          ? "bg-gradient-to-r from-blue-950/60 via-slate-900 to-slate-900/90 border-blue-500/50 shadow-md shadow-blue-950/40 hover:border-blue-400"
          : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700 text-slate-300"
      }"
    >
      ${isUnread ? `
        <!-- شريط عمودي بارز للدلالة الفورية على الرسائل غير المقروءة -->
        <div class="absolute inset-y-0 rtl:right-0 ltr:left-0 w-1.5 rounded-full bg-gradient-to-b from-blue-400 to-indigo-500"></div>
      ` : ""}

      <div class="flex items-start gap-3">
        <!-- أيقونة الحدث مع خلفية ملونة -->
        <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl border shadow-inner ${conf.theme}">
          ${conf.icon}
        </div>

        <!-- تفاصيل الإشعار -->
        <div class="flex-1 min-w-0 pr-1 rtl:pr-1 ltr:pl-1">
          <div class="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <div class="flex items-center gap-1.5">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold border ${conf.theme}">
                ${badgeText}
              </span>
              ${isUnread ? `
                <span class="inline-flex items-center gap-1 text-[10px] font-black text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded-full">
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
                  ${isEn ? "New" : "جديد"}
                </span>
              ` : ""}
            </div>

            <span class="text-[11px] text-slate-400 font-medium inline-flex items-center gap-1">
              <span>🕒</span>
              <span>${timeFormatted}</span>
            </span>
          </div>

          <!-- نص الرسالة بخط عريض وواضح -->
          <p class="text-xs sm:text-sm leading-relaxed ${isUnread ? "text-white font-bold" : "text-slate-300 font-normal"}">
            ${escapeHtml(n.message || "")}
          </p>

          <!-- زر/سهم الانتقال للمصدر -->
          <div class="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800/70 text-[11px]">
            <span class="text-blue-400 group-hover:text-blue-300 font-bold flex items-center gap-1 transition-colors">
              <span>${n.ticketId ? (isEn ? "View Ticket Details" : "عرض تفاصيل البلاغ") : (n.suggestionId ? (isEn ? "View Kaizen Idea" : "عرض فكرة الكايزن") : (isEn ? "Details" : "التفاصيل"))}</span>
              <span class="rtl:rotate-180 transition-transform group-hover:translate-x-1">‹</span>
            </span>

            ${n.ticketId ? `<span class="text-[10px] font-mono text-slate-500">#${escapeHtml(n.ticketId)}</span>` : ""}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderListHtml(notifications, filter) {
  const isEn = (window.currentLang || "ar") === "en";

  let filtered = notifications;
  if (filter === "unread") {
    filtered = notifications.filter(n => !n.read);
  } else if (filter === "tickets") {
    filtered = notifications.filter(n => !!n.ticketId);
  } else if (filter === "kaizen") {
    filtered = notifications.filter(n => !!n.suggestionId);
  }

  if (!filtered.length) {
    let emptyMsg = isEn ? "No notifications found." : "لا توجد إشعارات في هذا القسم.";
    if (filter === "unread") {
      emptyMsg = isEn ? "All caught up! No unread notifications." : "رائع! لقد قرأت جميع الإشعارات.";
    }

    return `
      <div class="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
        <div class="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-3xl shadow-inner">
          🔔
        </div>
        <p class="text-sm font-bold text-slate-300">${emptyMsg}</p>
        <p class="text-xs text-slate-500 max-w-xs leading-relaxed">
          ${isEn ? "New ticket updates, assignments, and Kaizen approvals will appear here automatically." : "تحديثات بلاغات الصيانة، الإسنادات، واعتمادات الكايزن ستظهر هنا فور إرسالها."}
        </p>
      </div>
    `;
  }

  return `
    <div class="space-y-2.5">
      ${filtered.map(renderNotificationCard).join("")}
    </div>
  `;
}

export async function refreshNotificationsBadge() {
  const badge = document.getElementById("headerNotifBadge");
  const myUid = localStorage.getItem("userId") || "";
  if (!badge || !myUid) return;

  const result = await countUnreadNotificationsApi(myUid);
  if (!result || result.status !== "success") return;

  const unread = result.count;
  if (unread > 0) {
    badge.textContent = unread > 99 ? "99+" : String(unread);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

  // تحديث أي شارة أخرى في الواجهة مثل صفحة التذاكر
  const ticketsBadge = document.getElementById("notifBadge");
  if (ticketsBadge) {
    ticketsBadge.textContent = unread > 99 ? "99+" : String(unread);
    if (unread > 0) ticketsBadge.classList.remove("hidden");
    else ticketsBadge.classList.add("hidden");
  }
}

export function openNotificationsModal() {
  if (document.getElementById("globalNotifOverlay")) return;

  const isEn = (window.currentLang || "ar") === "en";
  const tr = t();

  const overlay = document.createElement("div");
  overlay.id = "globalNotifOverlay";
  overlay.className =
    "fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4 animate-fade-in";

  overlay.innerHTML = `
    <div class="bg-[#1E293B] border border-slate-700/80 rounded-2xl sm:rounded-3xl w-full max-w-lg sm:max-w-xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden">
      
      <!-- الهيدر الرئيسي -->
      <div class="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60 shrink-0">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center text-lg shadow-inner shrink-0">
              🔔
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base sm:text-lg font-black text-white">
                  ${isEn ? "Notifications Center" : "مركز الإشعارات والتنبيهات"}
                </h3>
                <span id="modalUnreadCountBadge" class="hidden px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  0 ${isEn ? "new" : "جديد"}
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">
                ${isEn ? "Real-time updates on defects, assignments & Kaizen" : "متابعة حية للأعطال المسندة، التحديثات، ومقترحات الكايزن"}
              </p>
            </div>
          </div>

          <!-- زر الإغلاق وزر تحديد الكل -->
          <div class="flex items-center gap-2">
            <button
              id="globalNotif_close"
              type="button"
              aria-label="${isEn ? "Close" : "إغلاق"}"
              class="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition active:scale-95 cursor-pointer">
              ✕
            </button>
          </div>
        </div>

        <!-- تبويبات التصفية السريعة + زر قراءة الكل -->
        <div class="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-800/80 flex-wrap">
          <div class="flex items-center gap-1.5 overflow-x-auto py-0.5" id="notifFilterTabs">
            <button
              type="button"
              data-tab="all"
              class="notif-tab-btn active px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer bg-blue-600 border-blue-500 text-white shadow-sm">
              ${isEn ? "All" : "الكل"}
              <span id="tabCountAll" class="mr-1 text-[10px] opacity-80">(0)</span>
            </button>

            <button
              type="button"
              data-tab="unread"
              class="notif-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600">
              ${isEn ? "Unread" : "غير المقروءة"}
              <span id="tabCountUnread" class="mr-1 text-[10px] text-amber-400 font-bold">(0)</span>
            </button>

            <button
              type="button"
              data-tab="tickets"
              class="notif-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600">
              ${isEn ? "Tickets" : "الأعطال"}
            </button>

            <button
              type="button"
              data-tab="kaizen"
              class="notif-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600">
              ${isEn ? "Kaizen" : "الكايزن"}
            </button>
          </div>

          <button
            id="globalNotif_markAll"
            type="button"
            class="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-blue-500/10 transition active:scale-95 cursor-pointer">
            <span>✓✓</span>
            <span>${tr.markAll || (isEn ? "Mark all as read" : "تحديد الكل كمقروء")}</span>
          </button>
        </div>
      </div>

      <!-- جسم القائمة -->
      <div id="globalNotif_body" class="p-3 sm:p-4 overflow-y-auto flex-1 min-h-[220px] max-h-[60vh]">
        <div class="flex flex-col items-center justify-center py-12 text-center text-slate-400">
          <div class="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <span class="text-xs font-medium">${tr.loading || "جاري تحميل الإشعارات..."}</span>
        </div>
      </div>

      <!-- الفوتر -->
      <div class="p-3 border-t border-slate-800 bg-slate-900/40 text-center shrink-0">
        <span class="text-[11px] text-slate-400 font-medium">
          💡 ${isEn ? "Tap any notification to view full details" : "اضغط على أي إشعار للانتقال مباشرة إلى تفاصيل البلاغ أو المقترح"}
        </span>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.classList.add("opacity-0");
    setTimeout(() => {
      overlay.remove();
      refreshNotificationsBadge();
    }, 150);
  };

  overlay.querySelector("#globalNotif_close").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  const escHandler = (e) => {
    if (e.key === "Escape") {
      close();
      window.removeEventListener("keydown", escHandler);
    }
  };
  window.addEventListener("keydown", escHandler);

  const updateTabCounts = () => {
    const unreadCount = cachedNotifications.filter(n => !n.read).length;
    const allCount = cachedNotifications.length;

    const elAll = overlay.querySelector("#tabCountAll");
    if (elAll) elAll.textContent = `(${allCount})`;

    const elUnread = overlay.querySelector("#tabCountUnread");
    if (elUnread) elUnread.textContent = `(${unreadCount})`;

    const badgeEl = overlay.querySelector("#modalUnreadCountBadge");
    if (badgeEl) {
      if (unreadCount > 0) {
        badgeEl.textContent = `${unreadCount} ${isEn ? "new" : "جديد"}`;
        badgeEl.classList.remove("hidden");
      } else {
        badgeEl.classList.add("hidden");
      }
    }
  };

  const renderCurrentList = () => {
    const body = overlay.querySelector("#globalNotif_body");
    if (!body) return;
    body.innerHTML = renderListHtml(cachedNotifications, activeFilterTab);
    updateTabCounts();
  };

  // ربط أزرار التبويبات
  const tabBtns = overlay.querySelectorAll(".notif-tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => {
        b.className = "notif-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600";
      });
      btn.className = "notif-tab-btn active px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer bg-blue-600 border-blue-500 text-white shadow-sm";
      activeFilterTab = btn.getAttribute("data-tab") || "all";
      renderCurrentList();
    });
  });

  const load = async () => {
    const body = overlay.querySelector("#globalNotif_body");
    const myUid = localStorage.getItem("userId") || "";

    if (!myUid) {
      body.innerHTML = `
        <div class="text-center text-amber-400 text-xs py-8 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          ⚠️ ${tr.noUser || "يرجى تسجيل الدخول لعرض إشعاراتك الخاصة."}
        </div>
      `;
      return;
    }

    const result = await fetchMyNotificationsApi(myUid);

    if (result.status !== "success") {
      body.innerHTML = `
        <div class="text-center text-red-400 text-xs py-8 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2">
          <p>⚠️ ${tr.loadError || "تعذر تحميل الإشعارات حالياً."}</p>
          <button onclick="window.openNotificationsModal()" class="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold">إعادة المحاولة</button>
        </div>
      `;
      return;
    }

    cachedNotifications = Array.isArray(result.data) ? result.data : [];
    renderCurrentList();
  };

  overlay.querySelector("#globalNotif_markAll").addEventListener("click", async () => {
    const myUid = localStorage.getItem("userId") || "";
    if (!myUid) return;

    const btn = overlay.querySelector("#globalNotif_markAll");
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span>⏳</span> <span>${isEn ? "Marking..." : "جاري التحديث..."}</span>`;

    await markAllNotificationsAsRead(myUid);
    cachedNotifications = cachedNotifications.map(n => ({ ...n, read: true }));
    renderCurrentList();
    refreshNotificationsBadge();

    btn.innerHTML = originalText;
  });

  load();
}

window.handleGlobalNotificationClick = async function (notificationId, ticketId, suggestionId) {
  await markNotificationReadApi(notificationId);

  // تحديث محلي سريع في الذاكرة لتجنب أي تأخير
  const item = cachedNotifications.find(n => n.id === notificationId);
  if (item) item.read = true;

  const overlay = document.getElementById("globalNotifOverlay");
  if (overlay) overlay.remove();

  refreshNotificationsBadge();

  if (ticketId && ticketId !== "undefined") {
    if (typeof window.openTicketDetailsModal === "function") {
      window.openTicketDetailsModal(ticketId);
    } else {
      window.navigateTo("tickets");
    }
  } else if (suggestionId && suggestionId !== "undefined") {
    if (typeof window.navigateTo === "function") {
      window.navigateTo("kaizenBoard");
      setTimeout(() => {
        if (typeof window.openKaizenSuggestionDetails === "function") {
          window.openKaizenSuggestionDetails(suggestionId);
        }
      }, 400);
    }
  }
};

window.openNotificationsModal = openNotificationsModal;
window.refreshNotificationsBadge = refreshNotificationsBadge;
window.toggleNotificationsPanel = function () {
  openNotificationsModal();
};
