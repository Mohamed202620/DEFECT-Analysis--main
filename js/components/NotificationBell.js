// ============================================================
// NotificationBell.js
// جرس الإشعارات - زر عائم (Draggable) يمكن سحبه بالماوس أو باللمس
// لأي مكان في الشاشة، وموضعه الأخير بيتحفظ في localStorage عشان
// يفضل في نفس المكان عند فتح التطبيق تاني. تبويبين (جديدة / أرشيف)
// + تحديد الكل كمقروء. كل الإشعارات بتتجاب مرة واحدة عبر اشتراك
// لحظي واحد (onSnapshot) والتبويبين والعداد بيتفلتروا محلياً من
// نفس القائمة - بدون أي طلبات إضافية لـ Firestore وبدون مشاكل
// Composite Index.
// ============================================================

import {
  markNotificationReadApi,
  markAllNotificationsAsRead,
  subscribeToMyNotificationsApi
} from '../services/api.js';

let unsubscribeFn = null;
let resizeCleanupFn = null;
let allNotifications = [];
let activeTab = "unread"; // "unread" | "archive"

// ============================================================
// Drag & Drop (سحب وإفلات الزر العائم)
// ============================================================

const POSITION_STORAGE_KEY = "notificationBellPosition";
const BELL_SIZE = 44; // w-11 h-11
const EDGE_MARGIN = 8;
const DRAG_THRESHOLD = 6; // px قبل ما نعتبرها سحب مش ضغطة

function clampPosition(top, left) {
  const maxTop = Math.max(window.innerHeight - BELL_SIZE - EDGE_MARGIN, EDGE_MARGIN);
  const maxLeft = Math.max(window.innerWidth - BELL_SIZE - EDGE_MARGIN, EDGE_MARGIN);

  return {
    top: Math.min(Math.max(top, EDGE_MARGIN), maxTop),
    left: Math.min(Math.max(left, EDGE_MARGIN), maxLeft)
  };
}

function loadSavedPosition() {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return null;

    const pos = JSON.parse(raw);

    if (typeof pos?.top !== "number" || typeof pos?.left !== "number") {
      return null;
    }

    return clampPosition(pos.top, pos.left);
  } catch (error) {
    return null;
  }
}

function savePosition(top, left) {
  try {
    localStorage.setItem(
      POSITION_STORAGE_KEY,
      JSON.stringify({ top, left })
    );
  } catch (error) {
    console.error("Error saving notification bell position:", error);
  }
}

function applySavedPosition(wrapper) {
  const saved = loadSavedPosition();

  if (!saved) return; // هيفضل على الموضع الافتراضي (top-4 left-4)

  wrapper.style.top = `${saved.top}px`;
  wrapper.style.left = `${saved.left}px`;
}

/**
 * تفعيل السحب والإفلات على الزر العائم - بيشتغل بالماوس واللمس
 * سوا عبر Pointer Events. بيفرّق بين الضغطة العادية (فتح القائمة)
 * والسحب الفعلي عن طريق عتبة حركة صغيرة (DRAG_THRESHOLD).
 */
function makeDraggable(wrapper, handle) {
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let startTop = 0;
  let startLeft = 0;

  handle.style.touchAction = "none"; // يمنع تمرير الصفحة أثناء السحب باللمس
  handle.style.cursor = "grab";

  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return; // زر الماوس الأيسر فقط

    dragging = true;
    moved = false;

    startX = e.clientX;
    startY = e.clientY;

    const rect = wrapper.getBoundingClientRect();

    startTop = rect.top;
    startLeft = rect.left;

    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    if (!moved) {
      moved = true;
      handle.style.cursor = "grabbing";

      document
        .getElementById("notificationDropdown")
        ?.classList.add("hidden");
    }

    const { top, left } = clampPosition(
      startTop + dy,
      startLeft + dx
    );

    wrapper.style.top = `${top}px`;
    wrapper.style.left = `${left}px`;
  });

  const endDrag = (e) => {
    if (!dragging) return;

    dragging = false;
    handle.style.cursor = "grab";

    if (moved) {
      const rect = wrapper.getBoundingClientRect();

      savePosition(rect.top, rect.left);
    }
  };

  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  // بعد السحب، أول ضغطة (click) بتتولّد تلقائياً من المتصفح - نمنعها
  // من فتح/قفل القائمة المنبثقة عشان السحب ما يتحولش لفتح غير مقصود
  handle.addEventListener("click", (e) => {
    if (moved) {
      e.preventDefault();
      e.stopPropagation();

      moved = false;
    }
  });

  // لو الشاشة اتغيّر حجمها (تدوير الموبايل مثلاً)، حافظ على الزر جوه الحدود
  const onResize = () => {
    const rect = wrapper.getBoundingClientRect();

    const { top, left } = clampPosition(
      rect.top,
      rect.left
    );

    wrapper.style.top = `${top}px`;
    wrapper.style.left = `${left}px`;
  };

  window.addEventListener("resize", onResize);

  resizeCleanupFn = () =>
    window.removeEventListener("resize", onResize);
}

/**
 * يحدد اتجاه فتح القائمة المنبثقة (فوق/تحت، يمين/يسار) حسب موضع
 * الزر الحالي على الشاشة عشان القائمة متطلعش برّه حدود الشاشة
 */
function positionDropdown(wrapper, dropdown) {
  const margin = 8;
  const ddWidth = 288; // w-72
  const ddMaxHeight = 384; // max-h-96

  const rect = wrapper.getBoundingClientRect();

  dropdown.style.top = "";
  dropdown.style.bottom = "";
  dropdown.style.left = "";
  dropdown.style.right = "";

  const spaceBelow = window.innerHeight - rect.bottom;

  if (spaceBelow >= Math.min(ddMaxHeight, rect.top) + margin) {
    dropdown.style.top = "calc(100% + 8px)";
  } else {
    dropdown.style.bottom = "calc(100% + 8px)";
  }

  const spaceLeft = rect.left;
  const spaceRight = window.innerWidth - rect.right;

  if (spaceLeft >= ddWidth || spaceLeft >= spaceRight) {
    dropdown.style.left = "0";
  } else {
    dropdown.style.right = "0";
  }
}

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
        class="hidden absolute w-72 max-h-96 overflow-hidden flex flex-col bg-[#1E293B] border border-gray-700 rounded-2xl shadow-2xl">

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
  const unreadCount = allNotifications.filter(
    n => !n.read
  ).length;

  const tabUnread = document.getElementById("notifTabUnread");
  const tabArchive = document.getElementById("notifTabArchive");

  if (!tabUnread || !tabArchive) return;

  tabUnread.textContent =
    `الجديدة${unreadCount ? ` (${unreadCount})` : ""}`;

  tabArchive.textContent = "الأرشيف";

  tabUnread.className =
    `flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${
      activeTab === "unread"
        ? "bg-blue-500 text-white"
        : "text-gray-400"
    }`;

  tabArchive.className =
    `flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${
      activeTab === "archive"
        ? "bg-blue-500 text-white"
        : "text-gray-400"
    }`;
}

function renderList() {
  const list = document.getElementById("notificationList");

  if (!list) return;

  const items = allNotifications.filter(
    n => activeTab === "unread" ? !n.read : n.read
  );

  if (!items.length) {
    list.innerHTML = `
      <div class="text-center text-gray-500 text-[11px] py-6">
        ${
          activeTab === "unread"
            ? "لا توجد إشعارات جديدة"
            : "الأرشيف فارغ"
        }
      </div>
    `;

    return;
  }

  list.innerHTML = items.map(n => `
    <div
      onclick="window.handleNotificationClick('${n.id}', '${n.ticketId || ""}')"
      class="p-2.5 rounded-xl mb-1 cursor-pointer transition-all ${
        n.read
          ? "opacity-60"
          : "bg-blue-500/10 border border-blue-500/20"
      } hover:opacity-100">

      <div class="text-[11px] font-bold text-gray-100">
        ${n.title || n.message || ""}
      </div>

      ${
        n.title
          ? `<div class="text-[10px] text-gray-400 mt-0.5">
              ${n.message || ""}
             </div>`
          : ""
      }

      <div class="text-[9px] text-gray-600 mt-1">
        ${
          n.createdAt
            ? new Date(n.createdAt).toLocaleString("ar-EG")
            : ""
        }
      </div>

    </div>
  `).join("");
}

function renderDropdown() {
  renderTabs();
  renderList();
}

window.handleNotificationClick = async function (
  notificationId,
  ticketId
) {
  await markNotificationReadApi(notificationId);

  const dropdown =
    document.getElementById("notificationDropdown");

  if (dropdown) {
    dropdown.classList.add("hidden");
  }

  if (
    ticketId &&
    typeof window.openTicketDetails === "function"
  ) {
    window.openTicketDetails(ticketId);
  }
};

/**
 * تفعيل جرس الإشعارات - تُستدعى بعد نجاح تسجيل الدخول، وعند
 * إعادة تحميل الصفحة لو فيه جلسة دخول محفوظة بالفعل (راجع
 * authHandlers.js و renderCore.js)
 */
window.initNotificationBell = function () {

  if (
    document.getElementById("notificationBellWrapper")
  ) {
    return; // مُفعّل بالفعل
  }

  const myUid =
    localStorage.getItem("userId") || "";

  if (!myUid) return;

  document.body.insertAdjacentHTML(
    "beforeend",
    bellButtonHtml()
  );

  activeTab = "unread";

  const wrapper =
    document.getElementById("notificationBellWrapper");

  const bellBtn =
    document.getElementById("notificationBellBtn");

  applySavedPosition(wrapper);
  makeDraggable(wrapper, bellBtn);

  bellBtn.addEventListener("click", () => {

    const dropdown =
      document.getElementById("notificationDropdown");

    if (!dropdown) return;

    const isHidden =
      dropdown.classList.contains("hidden");

    if (isHidden) {
      positionDropdown(wrapper, dropdown);
      dropdown.classList.remove("hidden");
      renderDropdown();
    } else {
      dropdown.classList.add("hidden");
    }
  });

  document
    .getElementById("notifTabUnread")
    .addEventListener("click", () => {
      activeTab = "unread";
      renderDropdown();
    });

  document
    .getElementById("notifTabArchive")
    .addEventListener("click", () => {
      activeTab = "archive";
      renderDropdown();
    });

  document
    .getElementById("notifMarkAllBtn")
    .addEventListener("click", async () => {
      await markAllNotificationsAsRead(myUid);

      // التحديث بيوصل تلقائياً عبر الاشتراك اللحظي (onSnapshot)
    });

  unsubscribeFn =
    subscribeToMyNotificationsApi(
      myUid,
      (result) => {

        allNotifications =
          result.status === "success"
            ? result.data
            : [];

        const badge =
          document.getElementById("notificationBadge");

        const unreadCount =
          allNotifications.filter(
            n => !n.read
          ).length;

        if (badge) {

          if (unreadCount > 0) {
            badge.textContent =
              unreadCount > 99
                ? "99+"
                : String(unreadCount);

            badge.classList.remove("hidden");
          } else {
            badge.classList.add("hidden");
          }
        }

        const dropdown =
          document.getElementById(
            "notificationDropdown"
          );

        if (
          dropdown &&
          !dropdown.classList.contains("hidden")
        ) {
          renderDropdown();
        }
      }
    );
};

/**
 * إزالة الجرس والاشتراك اللحظي عند تسجيل الخروج
 */
window.destroyNotificationBell = function () {

  if (typeof unsubscribeFn === "function") {
    unsubscribeFn();
    unsubscribeFn = null;
  }

  if (typeof resizeCleanupFn === "function") {
    resizeCleanupFn();
    resizeCleanupFn = null;
  }

  allNotifications = [];
  activeTab = "unread";

  document
    .getElementById("notificationBellWrapper")
    ?.remove();
};
