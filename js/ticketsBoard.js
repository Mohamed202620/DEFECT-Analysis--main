// ============================================================
// ticketsBoard.js
// لوحة متابعة دورة حياة التذكرة - تُعرض ديناميكياً حسب دور المستخدم
// ============================================================

import { getCurrentRole, getTicketActions } from './permissions.js';
import { openActionModal } from './components/ActionModal.js';
import { openTicketDetailsModal } from './components/TicketDetailsModal.js';
import { computeMTTR } from './statistics.js';
import {
  buildPdfBrandHeaderHtml,
  buildPdfTitleBlockHtml,
  buildPdfStatsCardsHtml,
  buildPdfSignatureBlockHtml,
  getCompanyLogoDataUrl
} from './branding.js';

import {
  subscribeToTicketsBoardApi,
  fetchTechniciansApi,
  assignTicketApi,
  startTicketApi,
  resolveTicketApi,
  closeTicketApi,
  reopenTicketApi,
  fetchMyNotificationsApi,
  markNotificationReadApi,
  fetchTicketsForReportApi
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
// حد أقصى 60 بلاغ (بعد فلترة الصلاحيات) + Pagination محلي
// 20 بلاغ/صفحة × 3 صفحات كحد أقصى = 60
// ============================================================

const MAX_BOARD_TICKETS = 60;
const BOARD_PAGE_SIZE = 20;
const BOARD_MAX_PAGES = 3;

let boardCurrentPage = 1;
let boardCappedTickets = [];

function renderBoardPage(containerId, emptyMessage) {

  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPages = Math.min(
    BOARD_MAX_PAGES,
    Math.max(1, Math.ceil(boardCappedTickets.length / BOARD_PAGE_SIZE))
  );
  if (boardCurrentPage > totalPages) boardCurrentPage = totalPages;
  if (boardCurrentPage < 1) boardCurrentPage = 1;

  const pageStart = (boardCurrentPage - 1) * BOARD_PAGE_SIZE;
  const pageItems = boardCappedTickets.slice(pageStart, pageStart + BOARD_PAGE_SIZE);

  const bannerHtml = `
    <div class="text-[11px] text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 mb-3">
      ℹ️ يتم عرض آخر ${MAX_BOARD_TICKETS} بلاغ فقط.
    </div>
  `;

  const listHtml = pageItems.length
    ? pageItems.map(ticketCardHtml).join("")
    : `<div class="text-center text-gray-500 text-xs py-8">${emptyMessage}</div>`;

  const paginationHtml = totalPages > 1 ? `
    <div class="flex items-center justify-center gap-1.5 pt-3">
      <button
        onclick="window.setTicketsPage(${boardCurrentPage - 1})"
        ${boardCurrentPage <= 1 ? "disabled" : ""}
        class="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-gray-800 transition-all ${
          boardCurrentPage <= 1 ? "text-gray-600 cursor-not-allowed" : "text-gray-300 hover:border-gray-700 active:scale-95"
        }">السابق</button>
      ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
        <button
          onclick="window.setTicketsPage(${p})"
          class="w-7 h-7 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
            p === boardCurrentPage ? "bg-blue-600 border-blue-600 text-white" : "border-gray-800 text-gray-400 hover:border-gray-700"
          }">${p}</button>
      `).join("")}
      <button
        onclick="window.setTicketsPage(${boardCurrentPage + 1})"
        ${boardCurrentPage >= totalPages ? "disabled" : ""}
        class="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-gray-800 transition-all ${
          boardCurrentPage >= totalPages ? "text-gray-600 cursor-not-allowed" : "text-gray-300 hover:border-gray-700 active:scale-95"
        }">التالي</button>
    </div>
  ` : "";

  container.innerHTML = bannerHtml + listHtml + paginationHtml;

}

/**
 * التنقل بين صفحات لوحة التذاكر (Pagination محلي - بدون أي طلب
 * إضافي لـ Firestore، البيانات الـ 60 محفوظة بالفعل في boardCappedTickets)
 */
window.setTicketsPage = function (page) {

  const totalPages = Math.min(
    BOARD_MAX_PAGES,
    Math.max(1, Math.ceil(boardCappedTickets.length / BOARD_PAGE_SIZE))
  );

  if (page < 1 || page > totalPages || page === boardCurrentPage) return;

  boardCurrentPage = page;
  renderBoardPage("ticketsBoardContainer", "لا توجد تذاكر حالياً في قائمتك.");

};

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
  boardCurrentPage = 1;

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

      // فلترة الصلاحيات اتطبقت بالفعل جوه subscribeToTicketsBoardApi (حسب
      // role/myUid/myName) - هنا بس بناخد آخر 60 من النتيجة المفلترة والمرتبة
      // (الأحدث أولاً) وبعدين نقسمها Pagination محلي 20/صفحة × 3 صفحات
      const tickets = Array.isArray(result.data) ? result.data : [];
      boardCappedTickets = tickets.slice(0, MAX_BOARD_TICKETS);
      renderBoardPage("ticketsBoardContainer", "لا توجد تذاكر حالياً في قائمتك.");

    }
  );

};

/**
 * تغيير تبويب الفلتر
 */
window.setTicketsStatusFilter = function (status) {

  if (status === currentStatusFilter) return;

  currentStatusFilter = status;
  boardCurrentPage = 1;
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

// ============================================================
// التقرير الشهري (PDF) - آخر 30 يوم، مع تطبيق نفس صلاحيات
// المستخدم المُستخدمة في لوحة التذاكر، ويشمل صور البلاغات
// (مضغوطة) + البيانات الأساسية بشكل منظم
// ============================================================

const REPORT_DAYS = 30;
const REPORT_PAGE_WIDTH_PX = 794; // عرض صفحة A4 تقريباً بدقة 96dpi

function formatReportDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch (error) {
    return iso || "-";
  }
}

function escapeReportHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * تحميل صورة من رابطها وضغطها (تصغير الأبعاد + جودة JPEG منخفضة)
 * قبل تضمينها في التقرير - عشان الملف النهائي يفضل صغير حتى لو
 * فيه عدد كبير من الصور. بترجع null لو تعذر تحميل الصورة (مثلاً
 * بسبب مشكلة اتصال أو CORS) بدل ما توقف التقرير كله.
 */
async function loadImageAsCompressedDataUrl(url, maxDim = 480, quality = 0.55) {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("تعذر فك ترميز الصورة"));
      el.src = objectUrl;
    });

    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);

    URL.revokeObjectURL(objectUrl);
    return canvas.toDataURL("image/jpeg", quality);
  } catch (error) {
    console.warn("تعذر تحميل/ضغط صورة للتقرير:", url, error);
    return null;
  }
}

function buildReportTicketBlockHtml(ticket, imageDataUrls) {

  const status = String(ticket.status || "").trim().toLowerCase();
  const machineName = ticket.machine || ticket.machineName || "-";

  const imagesHtml = imageDataUrls.length ? `
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
      ${imageDataUrls.map(src => `
        <img src="${src}" style="width:100px; height:100px; object-fit:cover; border-radius:6px; border:1px solid #e2e8f0;" />
      `).join("")}
    </div>
  ` : "";

  return `
    <div style="border:1px solid #cbd5e1; border-radius:10px; padding:14px; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-weight:bold; font-size:13px; color:#0f172a;">${escapeReportHtml(machineName)} — #${escapeReportHtml(ticket.issueId || ticket.id)}</span>
        <span style="font-size:11px; padding:2px 10px; border-radius:10px; background:#e2e8f0; color:#334155;">
          ${escapeReportHtml(STATUS_LABELS[status] || ticket.status || "-")}
        </span>
      </div>
      <div style="font-size:11px; color:#475569; margin-bottom:6px;">
        📅 ${formatReportDate(ticket.createdAt)} &nbsp;|&nbsp;
        👤 بلّغ: ${escapeReportHtml(ticket.reportedBy || "-")} &nbsp;|&nbsp;
        🛠️ مُسندة إلى: ${escapeReportHtml(ticket.assignedTo || "-")}
      </div>
      ${ticket.description ? `<div style="font-size:11px; color:#1e293b; margin-bottom:6px;"><b>وصف البلاغ:</b> ${escapeReportHtml(ticket.description)}</div>` : ""}
      ${ticket.mechanicNotes ? `<div style="font-size:11px; color:#065f46; margin-bottom:6px;"><b>ملاحظات الفني:</b> ${escapeReportHtml(ticket.mechanicNotes)}</div>` : ""}
      ${imagesHtml}
    </div>
  `;

}

function buildReportSummaryTableHtml(tickets) {
  const rows = tickets.map(ticket => {
    const status = String(ticket.status || "").trim().toLowerCase();
    const isClosed = status === "closed";
    const rowBg = isClosed ? "#ecfdf5" : "#fffbeb";
    const statusColor = isClosed ? "#047857" : "#b45309";
    const machineName = ticket.machine || ticket.machineName || "-";

    return `
      <tr style="background:${rowBg};">
        <td style="border:1px solid #e2e8f0; padding:6px 8px; font-weight:bold;">#${escapeReportHtml(ticket.issueId || ticket.id)}</td>
        <td style="border:1px solid #e2e8f0; padding:6px 8px;">${escapeReportHtml(machineName)}</td>
        <td style="border:1px solid #e2e8f0; padding:6px 8px; font-weight:bold; color:${statusColor};">${escapeReportHtml(STATUS_LABELS[status] || ticket.status || "-")}</td>
        <td style="border:1px solid #e2e8f0; padding:6px 8px;">${escapeReportHtml(ticket.reportedBy || "-")}</td>
        <td style="border:1px solid #e2e8f0; padding:6px 8px;">${escapeReportHtml(ticket.assignedTo || "-")}</td>
        <td style="border:1px solid #e2e8f0; padding:6px 8px;">${formatReportDate(ticket.createdAt)}</td>
      </tr>
    `;
  }).join("");

  return `
    <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:18px;" dir="rtl">
      <thead>
        <tr style="background:#1d4ed8; color:#ffffff;">
          <th style="border:1px solid #1d4ed8; padding:7px 8px;">رقم البلاغ</th>
          <th style="border:1px solid #1d4ed8; padding:7px 8px;">الماكينة</th>
          <th style="border:1px solid #1d4ed8; padding:7px 8px;">الحالة</th>
          <th style="border:1px solid #1d4ed8; padding:7px 8px;">بلّغ</th>
          <th style="border:1px solid #1d4ed8; padding:7px 8px;">مُسندة إلى</th>
          <th style="border:1px solid #1d4ed8; padding:7px 8px;">التاريخ</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

window.generateMonthlyReport = async function () {

  if (typeof window.jspdf === "undefined" || typeof window.html2canvas === "undefined") {
    alert("❌ مكتبات إنشاء التقرير غير محملة حالياً، تأكد من الاتصال بالإنترنت وحاول تاني.");
    return;
  }

  const btn = document.getElementById("monthlyReportBtn");
  const originalLabel = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "⏳ جاري تجهيز التقرير...";
  }

  let offscreen = null;

  try {

    const role = getCurrentRole();
    const myUid = localStorage.getItem("userId") || "";
    const myName = localStorage.getItem("name") || "";

    const since = new Date();
    since.setDate(since.getDate() - REPORT_DAYS);

    // 1) جلب التذاكر - نفس منطق فلترة الصلاحيات المُستخدم في لوحة
    // التذاكر (Admin/PM يشوفوا الكل، الفني يشوف بلاغاته + المُسندة
    // إليه فقط) ومحصورة بآخر 30 يوم
    const result = await fetchTicketsForReportApi({
      role, myUid, myName, sinceISO: since.toISOString()
    });

    if (result.status !== "success") {
      alert("❌ تعذر تجهيز بيانات التقرير، حاول مرة أخرى.");
      return;
    }

    const tickets = result.data;

    if (!tickets.length) {
      alert("ℹ️ لا توجد بلاغات خلال آخر 30 يوم لعرضها في التقرير.");
      return;
    }

    // 2) تحميل وضغط صور كل تذكرة (صورة البلاغ + صور ما بعد الإصلاح)
    const ticketsWithImages = [];
    for (const ticket of tickets) {
      const urls = [
        ...(Array.isArray(ticket.imageUrls) ? ticket.imageUrls : (ticket.imageUrl ? [ticket.imageUrl] : [])),
        ...(Array.isArray(ticket.afterImages) ? ticket.afterImages : [])
      ]
        .filter(Boolean)
        .slice(0, 4);

      const dataUrls = [];
      for (const url of urls) {
        const dataUrl = await loadImageAsCompressedDataUrl(url);
        if (dataUrl) dataUrls.push(dataUrl);
      }
      ticketsWithImages.push({ ticket, images: dataUrls });
    }

    // تحميل لوجو الشركة (Data URL مُخزَّن مسبقاً) والانتظار عليه
    // *قبل* التقاط الصورة، عشان يضمن ظهوره في التقرير من أول مرة
    const logoDataUrl = await getCompanyLogoDataUrl();

    // 3) بناء محتوى التقرير كـ HTML خارج الشاشة (بالخط والاتجاه
    // العربي الطبيعي للمتصفح) عشان يترسم بشكل صحيح عند تحويله لصورة
    offscreen = document.createElement("div");
    offscreen.style.position = "fixed";
    offscreen.style.top = "-99999px";
    offscreen.style.left = "0";
    offscreen.style.width = `${REPORT_PAGE_WIDTH_PX}px`;
    offscreen.style.padding = "24px";
    offscreen.style.background = "#ffffff";
    offscreen.style.color = "#0f172a";
    offscreen.style.fontFamily = "Tahoma, Arial, sans-serif";
    offscreen.dir = "rtl";

    const roleLabel = { admin: "مدير النظام", manager: "مدير الإنتاج" }[role] || "فني/مهندس";

    const openCount = tickets.filter(t => String(t.status || "").trim().toLowerCase() !== "closed").length;
    const closedCount = tickets.length - openCount;
    const mttr = computeMTTR(tickets);
    const mttrLabel = mttr.avgHours != null ? `${mttr.avgHours.toFixed(1)} ساعة` : "-";

    offscreen.innerHTML = `
      ${buildPdfBrandHeaderHtml(logoDataUrl)}
      ${buildPdfTitleBlockHtml("تقرير الصيانة الدورية وتتبع البلاغات", [
        { label: "تاريخ التصدير", value: new Date().toLocaleDateString("ar-EG") },
        { label: "الفني/المشرف", value: myName || "-" },
        { label: "الصلاحية", value: roleLabel },
        { label: "الفترة", value: `آخر ${REPORT_DAYS} يوم` }
      ])}
      ${buildPdfStatsCardsHtml([
        { label: "إجمالي البلاغات", value: tickets.length, color: "#7e22ce", bg: "#faf5ff" },
        { label: "مفتوحة", value: openCount, color: "#b45309", bg: "#fffbeb" },
        { label: "تم إصلاحها", value: closedCount, color: "#047857", bg: "#ecfdf5" },
        { label: "متوسط زمن الإصلاح (MTTR)", value: mttrLabel, color: "#0e7490", bg: "#ecfeff" }
      ])}
      ${buildReportSummaryTableHtml(tickets)}
      <div id="reportTicketsContainer"></div>
      ${buildPdfSignatureBlockHtml()}
    `;

    offscreen.querySelector("#reportTicketsContainer").innerHTML =
      ticketsWithImages.map(({ ticket, images }) => buildReportTicketBlockHtml(ticket, images)).join("");

    document.body.appendChild(offscreen);

    // 4) تحويل المحتوى لصورة (Canvas) ثم تقسيمها على صفحات PDF
    const canvas = await window.html2canvas(offscreen, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: "#ffffff"
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "pt", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.72); // ضغط إضافي لصورة الصفحة الكاملة

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(`تقرير-شهري-${new Date().toISOString().slice(0, 10)}.pdf`);

  } catch (error) {
    console.error("Error generating monthly report:", error);
    alert("❌ حدث خطأ أثناء إنشاء التقرير، حاول مرة أخرى.");
  } finally {
    if (offscreen && offscreen.parentNode) offscreen.parentNode.removeChild(offscreen);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  }

};
