// ============================================================
// ticketsBoard.js
// لوحة متابعة دورة حياة التذكرة - تُعرض ديناميكياً حسب دور المستخدم
// ============================================================

import { getCurrentRole, getTicketActions } from './permissions.js';
import { openActionModal } from './components/ActionModal.js';
import { openTicketDetailsModal } from './components/TicketDetailsModal.js';

import {
  subscribeToTicketsBoardApi,
  fetchTechniciansApi,
  assignTicketApi,
  startTicketApi,
  resolveTicketApi,
  closeTicketApi,
  reopenTicketApi,
  fetchMyNotificationsApi,
  markNotificationReadApi
} from './services/api.js';

const STATUS_LABELS = {
  pending: "جديد",
  assigned: "تم الإسناد",
  in_progress: "قيد التنفيذ",
  resolved: "بانتظار تأكيد المُبلغ",
  closed: "مغلقة",
  reopened: "قيد التنفيذ"
};

const STATUS_CLASSES = {
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  assigned: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  in_progress: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  resolved: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  closed: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
  reopened: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
};

function ticketCardHtml(ticket) {

  const actions = getTicketActions(ticket);

  const actionsHtml = actions.map(a => `
    <button
      onclick="window.handleTicketAction('${ticket.id}', '${a.key}')"
      class="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 active:scale-95 transition-all">
      ${a.label}
    </button>
  `).join("");

  const status = String(ticket.status || "").trim().toLowerCase();
  const machineName = ticket.machine || ticket.machineName || "-";

  return `
    <div class="bg-[#1E293B] border border-gray-800 rounded-2xl p-4 space-y-2 mb-3">
      <div class="flex justify-between items-center">
        <span class="font-bold text-sm text-gray-100">${machineName}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full ${STATUS_CLASSES[status] || "bg-gray-500/10 text-gray-400"}">
          ${STATUS_LABELS[status] || status}
        </span>
      </div>

      <p class="text-xs text-gray-400">${ticket.description || ""}</p>

      <div class="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
        ${ticket.reportedBy ? `<span>👤 بلّغ: ${ticket.reportedBy}</span>` : ""}
        ${ticket.assignedTo ? `<span>🛠️ مُسندة إلى: ${ticket.assignedTo}</span>` : ""}
        ${ticket.type ? `<span>🏷️ ${ticket.type}</span>` : ""}
      </div>

      ${ticket.mechanicNotes ? `
        <div class="text-[11px] bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2 text-emerald-300">
          🔧 ملاحظات الفني: ${ticket.mechanicNotes}
        </div>
      ` : ""}

      ${ticket.operatorFeedback ? `
        <div class="text-[11px] bg-red-500/5 border border-red-500/20 rounded-lg p-2 text-red-300">
          ⚠️ ملاحظات المُبلّغ: ${ticket.operatorFeedback}
        </div>
      ` : ""}

      ${actionsHtml ? `<div class="flex flex-wrap gap-2 pt-1">${actionsHtml}</div>` : ""}
    </div>
  `;

}

function renderTicketsList(containerId, tickets, emptyMessage) {

  const container = document.getElementById(containerId);
  if (!container) return;

  if (!tickets.length) {
    container.innerHTML = `
      <div class="text-center text-gray-500 text-xs py-8">${emptyMessage}</div>
    `;
    return;
  }

  container.innerHTML = tickets.map(ticketCardHtml).join("");

}

// ============================================================
// دالة تحديد التبويبات حسب دور المستخدم
// ============================================================

function getTabsForRole(role) {
  if (role === 'technician' || role === 'operator' || role === 'engineer') {
    return [
      { key: "assigned_to_me", label: "🛠️ المُسندة إليّ" },
      { key: "my_tickets", label: "📌 بلاغاتي" },
      { key: "awaiting_confirm", label: "🔍 بانتظار تأكيدي" }
    ];
  }
  // للأدمن والمدير
  return [
    { key: "all", label: "الكل" },
    { key: "pending", label: "📥 جديدة" },
    { key: "in_progress", label: "⚙️ قيد التنفيذ" },
    { key: "resolved", label: "🔍 قيد المراجعة" },
    { key: "closed", label: "✔️ مغلقة" }
  ];
}

let currentStatusFilter = null;
let unsubscribeTicketsListener = null;

function renderStatusTabs(role) {

  const container = document.getElementById("ticketsTabsContainer");
  if (!container) return;

  const tabs = getTabsForRole(role);

  // ضبط الفلتر الافتراضي إذا لم يكن محدداً أو إذا كان الفلتر الحالي غير موجود في التبويبات المتاحة
  if (!currentStatusFilter || !tabs.some(t => t.key === currentStatusFilter)) {
    currentStatusFilter = tabs[0].key;
  }

  container.innerHTML = tabs.map(tab => `
    <button
      onclick="window.setTicketsStatusFilter('${tab.key}')"
      class="shrink-0 px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
        currentStatusFilter === tab.key
          ? "bg-blue-600 border-blue-600 text-white"
          : "bg-[#1E293B] border-gray-800 text-gray-400 hover:border-gray-700"
      }">
      ${tab.label}
    </button>
  `).join("");

}

/**
 * تحميل لوحة التذاكر حسب دور المستخدم والتبويب الحالي
 */
window.loadTicketsBoard = function () {

  const role = getCurrentRole();
  renderStatusTabs(role);

  const container = document.getElementById("ticketsBoardContainer");
  if (!container) return;

  if (typeof unsubscribeTicketsListener === "function") {
    unsubscribeTicketsListener();
    unsubscribeTicketsListener = null;
  }

  const myUid = localStorage.getItem("userId") || "";
  const myName = localStorage.getItem("name") || "";

  loadNotificationsBadge();

  if (!role) {
    renderTicketsList("ticketsBoardContainer", [], "لا توجد صلاحية لعرض التذاكر لهذا الدور.");
    return;
  }

  container.innerHTML = `
    <div class="text-center text-gray-400 text-xs py-8">جاري تحميل التذاكر...</div>
  `;

  unsubscribeTicketsListener = subscribeToTicketsBoardApi(
    { role, myUid, myName, status: currentStatusFilter },
    (result) => {

      if (!result || result.status !== "success") {
        console.error("Ticket subscription error:", result?.message);
        container.innerHTML = `
          <div class="text-red-400 text-center text-xs py-6">
            تعذر تحميل التذاكر حالياً. حاول مرة أخرى، ولو استمرت المشكلة تواصل مع الأدمن.
          </div>
        `;
        return;
      }

      const tickets = Array.isArray(result.data) ? result.data : [];
      renderTicketsList("ticketsBoardContainer", tickets, "لا توجد تذاكر حالياً في قائمتك.");

    }
  );

};

/**
 * تغيير تبويب الفلتر
 */
window.setTicketsStatusFilter = function (status) {

  if (status === currentStatusFilter) return;

  currentStatusFilter = status;
  window.loadTicketsBoard();

};

/**
 * إيقاف المستمع عند المغادرة
 */
window.cleanupTicketsBoard = function () {

  if (typeof unsubscribeTicketsListener === "function") {
    unsubscribeTicketsListener();
    unsubscribeTicketsListener = null;
  }

};

/**
 * تنفيذ الإجراءات على التذكرة
 */
window.handleTicketAction = async function (ticketId, action) {

  let result;

  if (action === "details") {
    openTicketDetailsModal(ticketId);
    return;
  }

  if (action === "assign") {

    const techResult = await fetchTechniciansApi();
    const technicians = techResult.status === "success" ? techResult.data : [];

    if (!technicians.length) {
      alert("⚠️ لا يوجد فنيون/مهندسون نشطون حالياً لإسناد التذكرة لهم.");
      return;
    }

    const values = await openActionModal({
      title: "🛠️ تصنيف وإسناد التذكرة",
      submitLabel: "إسناد",
      fields: [
        {
          id: "type",
          label: "نوع البلاغ",
          type: "select",
          options: [
            { value: "Breakdown", label: "عطل مفاجئ (Breakdown)" },
            { value: "PM", label: "صيانة وقائية (PM)" },
            { value: "Other", label: "أخرى" }
          ]
        },
        {
          id: "assignedTo",
          label: "إسناد إلى",
          type: "select",
          options: technicians.map(t => ({ value: `${t.id}::${t.name}`, label: `${t.name} (${t.role})` }))
        }
      ]
    });

    if (!values) return;

    const [assignedToUid, assignedTo] = (values.assignedTo || "").split("::");
    if (!assignedTo) return;

    result = await assignTicketApi(ticketId, { type: values.type, assignedTo, assignedToUid });

  } else if (action === "start") {

    result = await startTicketApi(ticketId);

  } else if (action === "resolve") {

    const values = await openActionModal({
      title: "✅ تسجيل إتمام الإصلاح",
      submitLabel: "تم الإصلاح",
      fields: [
        { id: "mechanicNotes", label: "ملاحظات الفني", type: "textarea", placeholder: "وصف الإصلاح الذي تم...", required: true },
        { id: "afterImages", label: "صور بعد الإصلاح", type: "images", required: true }
      ]
    });

    if (!values || !values.mechanicNotes) return;

    result = await resolveTicketApi(ticketId, values.mechanicNotes, values.afterImages);

  } else if (action === "confirm") {

    result = await closeTicketApi(ticketId);

  } else if (action === "reject") {

    const values = await openActionModal({
      title: "❌ رفض الإصلاح",
      submitLabel: "رفض وإعادة فتح",
      fields: [
        { id: "operatorFeedback", label: "ما المشكلة المتبقية؟", type: "textarea", placeholder: "مثال: لا يزال يوجد تسريب...", required: true }
      ]
    });

    if (!values || !values.operatorFeedback) return;

    result = await reopenTicketApi(ticketId, values.operatorFeedback);

  } else {
    return;
  }

  if (result?.status !== "success") {
    const msg = result?.message || "";
    const isArabicMessage = /[\u0600-\u06FF]/.test(msg);

    if (!isArabicMessage) {
      console.error("Ticket action error:", msg);
    }

    alert("❌ " + (isArabicMessage ? msg : "حدث خطأ أثناء تنفيذ الإجراء، حاول مرة أخرى أو تواصل مع الأدمن."));
  }

};

// ============================================================
// الإشعارات Inside-App
// ============================================================

const NOTIFICATION_ICONS = {
  assigned: "🛠️",
  resolved: "✅",
  closed: "✔️",
  rejected: "❌"
};

async function loadNotificationsBadge() {

  const badge = document.getElementById("notifBadge");
  const myUid = localStorage.getItem("userId") || "";
  if (!badge || !myUid) return;

  const result = await fetchMyNotificationsApi(myUid);
  if (result.status !== "success") return;

  const unread = result.data.filter(n => !n.read).length;

  if (unread > 0) {
    badge.textContent = unread > 9 ? "9+" : String(unread);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

}

window.toggleNotificationsPanel = async function () {

  const panel = document.getElementById("notifPanel");
  if (!panel) return;

  const isHidden = panel.classList.contains("hidden");

  if (!isHidden) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");
  panel.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">جاري التحميل...</div>`;

  const myUid = localStorage.getItem("userId") || "";
  const result = await fetchMyNotificationsApi(myUid);

  if (result.status !== "success" || !result.data.length) {
    panel.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">لا توجد إشعارات.</div>`;
    return;
  }

  panel.innerHTML = result.data.map(n => `
    <div onclick="window.handleNotificationClick('${n.id}', '${n.ticketId}')"
      class="p-2.5 rounded-lg mb-1.5 cursor-pointer border ${n.read ? "bg-transparent border-gray-800 text-gray-500" : "bg-blue-500/5 border-blue-500/20 text-gray-200"}">
      <div class="text-[11px]">${NOTIFICATION_ICONS[n.type] || "🔔"} ${n.message}</div>
    </div>
  `).join("");

};

window.handleNotificationClick = async function (notificationId, ticketId) {

  await markNotificationReadApi(notificationId);
  document.getElementById("notifPanel")?.classList.add("hidden");
  loadNotificationsBadge();

  if (ticketId) {
    openTicketDetailsModal(ticketId);
  }

};
