import { exportToPdf, PAGE_BREAK_CLASS } from './services/exportUtility.js';
import { buildPdfStatsCardsHtml } from './branding.js';
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
  markNotificationReadApi,
  fetchTicketsForReportApi
} from './services/api.js';
import { translations } from './config.js';

// إصلاح (ترجمة شاملة): كل نصوص هذه اللوحة (التبويبات، تسميات
// الحالات، النوافذ المنبثقة، التقرير الشهري) كانت ثابتة بالعربي -
// دلوقتي بتتقرأ من translations.ticketsBoard حسب window.currentLang
function t() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).ticketsBoard;
}

function common() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).common;
}

function notifT() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).notifications;
}

const STATUS_CLASSES = {
  pending: "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black",
  assigned: "bg-blue-500/20 text-blue-300 border border-blue-500/40 font-black",
  in_progress: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-black",
  resolved: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black",
  closed: "bg-slate-700/60 text-slate-300 border border-slate-600 font-bold",
  reopened: "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-black"
};

const STATUS_BAR_ACCENTS = {
  pending: "bg-amber-500 shadow-amber-500/40",
  assigned: "bg-blue-500 shadow-blue-500/40",
  in_progress: "bg-indigo-500 shadow-indigo-500/40",
  resolved: "bg-emerald-500 shadow-emerald-500/40",
  closed: "bg-slate-500 shadow-slate-500/40",
  reopened: "bg-purple-500 shadow-purple-500/40"
};

function getActionButtonStyle(actionKey) {
  switch (actionKey) {
    case 'resolve':
      return 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 border border-emerald-500';
    case 'start':
      return 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 border border-blue-500';
    case 'assign':
      return 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 border border-indigo-500';
    case 'close':
      return 'bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600';
    case 'reopen':
      return 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30 border border-amber-500';
    default:
      return 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30';
  }
}

function ticketCardHtml(ticket) {

  const actions = getTicketActions(ticket);
  const tr = t();

  const actionsHtml = actions.map(a => `
    <button
      onclick="window.handleTicketAction('${ticket.id}', '${a.key}')"
      class="min-h-[40px] text-xs font-black px-4 py-2 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 ${getActionButtonStyle(a.key)}">
      ${a.label}
    </button>
  `).join("");

  const status = String(ticket.status || "").trim().toLowerCase();
  const machineName = ticket.machine || ticket.machineName || "-";
  const accentClass = STATUS_BAR_ACCENTS[status] || "bg-slate-600";

  return `
    <div class="bg-[#1E293B] border border-slate-800 rounded-2xl p-4 mb-3 relative overflow-hidden shadow-xl hover:border-slate-700 transition-all">
      <!-- شريط الحالة الجانبي عالي التباين لتحديد نوع العطل فورا بالعين -->
      <div class="absolute inset-y-0 rtl:right-0 ltr:left-0 w-2 ${accentClass} shadow-sm"></div>

      <div class="rtl:pr-2.5 ltr:pl-2.5 space-y-2.5">
        <div class="flex justify-between items-center gap-2">
          <div class="flex items-center gap-2">
            <span class="font-black text-sm text-slate-100">${machineName}</span>
            ${ticket.line ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">${ticket.line}</span>` : ""}
          </div>
          <span class="text-[11px] px-2.5 py-0.5 rounded-full ${STATUS_CLASSES[status] || "bg-slate-700 text-slate-300"}">
            ${tr.status[status] || status}
          </span>
        </div>

        <p class="text-xs font-medium text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
          ${ticket.description || ""}
        </p>

        <div class="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-slate-400">
          ${ticket.reportedBy ? `<span class="flex items-center gap-1">👤 <span class="text-slate-500">${tr.reportedByLabel}</span> <b class="text-slate-300">${ticket.reportedBy}</b></span>` : ""}
          ${ticket.assignedTo ? `<span class="flex items-center gap-1">🛠️ <span class="text-slate-500">${tr.assignedToLabel}</span> <b class="text-slate-300">${ticket.assignedTo}</b></span>` : ""}
          ${ticket.type ? `<span class="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-[10px] font-bold text-slate-300">🏷️ ${ticket.type}</span>` : ""}
          ${ticket.priority ? `<span class="px-2 py-0.5 rounded text-[10px] font-black ${
            ticket.priority === 'High' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
            ticket.priority === 'Medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
            'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          }">⚡ ${ticket.priority}</span>` : ""}
        </div>

        ${ticket.mechanicNotes ? `
          <div class="text-xs bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5 text-emerald-300">
            🔧 <span class="font-bold">${tr.mechanicNotesLabel}</span> ${ticket.mechanicNotes}
          </div>
        ` : ""}

        ${ticket.operatorFeedback ? `
          <div class="text-xs bg-red-950/40 border border-red-500/30 rounded-xl p-2.5 text-red-300">
            ⚠️ <span class="font-bold">${tr.operatorFeedbackLabel}</span> ${ticket.operatorFeedback}
          </div>
        ` : ""}

        ${actionsHtml ? `<div class="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">${actionsHtml}</div>` : ""}
      </div>
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
// تحميل متدرج (Infinite Scroll) بلا حدود للصفحات
// ============================================================
const BOARD_CHUNK_SIZE = 20;
let boardVisibleCount = BOARD_CHUNK_SIZE;
let boardAllTickets = [];

function renderBoardPage(containerId, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const tr = t();

  const visibleItems = boardAllTickets.slice(0, boardVisibleCount);
  const listHtml = visibleItems.length
    ? visibleItems.map(ticketCardHtml).join("")
    : `<div class="text-center text-gray-500 text-xs py-8">${emptyMessage}</div>`;

  const loaderHtml = boardVisibleCount < boardAllTickets.length 
    ? `<div id="infiniteScrollTarget" class="py-4 text-center text-gray-500 text-[11px] animate-pulse">
         جاري تحميل المزيد... ( ${boardVisibleCount} من ${boardAllTickets.length} )
       </div>` 
    : ``;

  container.innerHTML = listHtml + loaderHtml;

  if (boardVisibleCount < boardAllTickets.length) {
    setTimeout(() => {
      const target = document.getElementById('infiniteScrollTarget');
      if (target) {
        const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            observer.disconnect();
            window.loadMoreTickets(containerId, emptyMessage);
          }
        }, { rootMargin: "150px" });
        observer.observe(target);
      }
    }, 150);
  }
}

window.loadMoreTickets = function (containerId, emptyMessage) {
  boardVisibleCount += BOARD_CHUNK_SIZE;
  renderBoardPage(containerId, emptyMessage);
};

// ============================================================
// دالة تحديد التبويبات حسب دور المستخدم
// ============================================================

function getTabsForRole(role) {
  const tr = t();

  if (role === 'technician' || role === 'operator' || role === 'engineer') {
    return [
      { key: "assigned_to_me", label: tr.tabAssignedToMe },
      { key: "my_tickets", label: tr.tabMyTickets },
      { key: "awaiting_confirm", label: tr.tabAwaitingConfirm }
    ];
  }
  // للأدمن والمدير
  return [
    { key: "all", label: tr.tabAll },
    { key: "pending", label: tr.tabPending },
    { key: "in_progress", label: tr.tabInProgress },
    { key: "resolved", label: tr.tabResolved },
    { key: "closed", label: tr.tabClosed }
  ];
}

let currentStatusFilter = null;
let unsubscribeTicketsListener = null;

function renderStatusTabs(role) {

  const container = document.getElementById("ticketsTabsContainer");
  if (!container) return;

  const tabs = getTabsForRole(role);

  // ضبط الفلتر الافتراضي إذا لم يكن محدداً أو إذا كان الفلتر الحالي غير موجود في التبويبات المتاحة
  if (!currentStatusFilter || !tabs.some(tab => tab.key === currentStatusFilter)) {
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
  boardVisibleCount = BOARD_CHUNK_SIZE;

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
    renderTicketsList("ticketsBoardContainer", [], t().noPermission);
    return;
  }

  container.innerHTML = `
    <div class="text-center text-gray-400 text-xs py-8">${t().loadingTickets}</div>
  `;

  unsubscribeTicketsListener = subscribeToTicketsBoardApi(
    { role, myUid, myName, status: currentStatusFilter },
    (result) => {

      if (!result || result.status !== "success") {
        console.error("Ticket subscription error:", result?.message);
        container.innerHTML = `
          <div class="text-red-400 text-center text-xs py-6">
            ${t().loadError}
          </div>
        `;
        return;
      }

      // فلترة الصلاحيات اتطبقت بالفعل جوه subscribeToTicketsBoardApi (حسب
      // role/myUid/myName) - هنا بس بناخد آخر 60 من النتيجة المفلترة والمرتبة
      // وبعدين نعرضها بشكل متدرج (Infinite Scroll) باستخدام IntersectionObserver
      const tickets = Array.isArray(result.data) ? result.data : [];
      boardAllTickets = tickets;
      renderBoardPage("ticketsBoardContainer", t().empty);

    }
  );

};

/**
 * تغيير تبويب الفلتر
 */
window.setTicketsStatusFilter = function (status) {

  if (status === currentStatusFilter) return;

  currentStatusFilter = status;
  boardVisibleCount = BOARD_CHUNK_SIZE;
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
  const tr = t();

  if (action === "details") {
    openTicketDetailsModal(ticketId);
    return;
  }

  if (action === "assign") {

    const techResult = await fetchTechniciansApi();
    const technicians = techResult.status === "success" ? techResult.data : [];

    if (!technicians.length) {
      alert(tr.noTechnicians);
      return;
    }

    const values = await openActionModal({
      title: tr.assignTitle,
      submitLabel: tr.assignSubmit,
      fields: [
        {
          id: "type",
          label: tr.typeLabel,
          type: "select",
          options: [
            { value: "Breakdown", label: tr.typeBreakdown },
            { value: "PM", label: tr.typePM },
            { value: "Other", label: tr.typeOther }
          ]
        },
        {
          id: "assignedTo",
          label: tr.assignToLabel,
          type: "select",
          options: technicians.map(tech => ({ value: `${tech.id}::${tech.name}`, label: `${tech.name} (${tech.role})` }))
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
      title: tr.resolveTitle,
      submitLabel: tr.resolveSubmit,
      fields: [
        { id: "mechanicNotes", label: tr.mechanicNotesField, type: "textarea", placeholder: tr.mechanicNotesPlaceholder, required: true },
        { id: "afterImages", label: tr.afterImagesField, type: "images", required: true }
      ]
    });

    if (!values || !values.mechanicNotes) return;

    result = await resolveTicketApi(ticketId, values.mechanicNotes, values.afterImages);

  } else if (action === "confirm") {

    result = await closeTicketApi(ticketId);

  } else if (action === "reject") {

    const values = await openActionModal({
      title: tr.rejectTitle,
      submitLabel: tr.rejectSubmit,
      fields: [
        { id: "operatorFeedback", label: tr.operatorFeedbackField, type: "textarea", placeholder: tr.operatorFeedbackPlaceholder, required: true }
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

    alert("❌ " + (isArabicMessage ? msg : tr.genericActionError));
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
  panel.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">${common().loading}</div>`;

  const myUid = localStorage.getItem("userId") || "";
  const result = await fetchMyNotificationsApi(myUid);

  if (result.status !== "success" || !result.data.length) {
    panel.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-4">${notifT().empty}</div>`;
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
  const currentLang = window.currentLang || "ar";
  try {
    return new Date(iso).toLocaleDateString(currentLang === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
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

  const tr = t();
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
          ${escapeReportHtml(tr.status[status] || ticket.status || "-")}
        </span>
      </div>
      <div style="font-size:11px; color:#475569; margin-bottom:6px;">
        📅 ${formatReportDate(ticket.createdAt)} &nbsp;|&nbsp;
        👤 ${tr.reportedByLabel} ${escapeReportHtml(ticket.reportedBy || "-")} &nbsp;|&nbsp;
        🛠️ ${tr.assignedToLabel} ${escapeReportHtml(ticket.assignedTo || "-")}
      </div>
      ${ticket.description ? `<div style="font-size:11px; color:#1e293b; margin-bottom:6px;"><b>${tr.reportDescLabel}</b> ${escapeReportHtml(ticket.description)}</div>` : ""}
      ${ticket.mechanicNotes ? `<div style="font-size:11px; color:#065f46; margin-bottom:6px;"><b>${tr.reportMechanicNotesLabel}</b> ${escapeReportHtml(ticket.mechanicNotes)}</div>` : ""}
      ${imagesHtml}
    </div>
  `;

}

window.generateMonthlyReport = async function () {
  const btn = document.getElementById("monthlyReportBtn");
  const originalLabel = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "⏳ جاري تجهيز التقرير...";
  }

  try {
    const role = getCurrentRole();
    const myName = localStorage.getItem("name") || "";
    const myUid = localStorage.getItem("userId") || "";
    const since = new Date();
    since.setDate(since.getDate() - 30);
    
    const result = await fetchTicketsForReportApi({
      role, myName, myUid, sinceISO: since.toISOString()
    });
    
    if (result.status !== "success") {
      alert(tr.reportGenerateError);
      return;
    }
    
    const tickets = result.data;
    if (!tickets.length) {
      alert(tr.reportNoData);
      return;
    }
    
    const ticketsWithImages = [];
    for (const ticket of tickets) {
      const mediaUrls = (ticket.imageUrls && Array.isArray(ticket.imageUrls) && ticket.imageUrls.length > 0) 
                        ? ticket.imageUrls : (ticket.imageUrl ? [ticket.imageUrl] : []);
      const dataUrls = [];
      for (const url of mediaUrls.slice(0, 4)) {
        const dataUrl = await loadImageAsCompressedDataUrl(url);
        if (dataUrl) dataUrls.push(dataUrl);
      }
      ticketsWithImages.push({ ticket, dataUrls });
    }
    
    const isAr = (window.currentLang || "ar") === "ar";
    
    let blocksHtml = ticketsWithImages.map(({ ticket, dataUrls }) => {
      let html = buildReportTicketBlockHtml(ticket, dataUrls);
      return html.replace(/<div style="border:1px solid #cbd5e1;/, `<div class="${PAGE_BREAK_CLASS}" style="border:1px solid #cbd5e1;`);
    }).join("");
    
    const closedCount = tickets.filter(t => t.status === "closed").length;
    const resolvedCount = tickets.filter(t => t.status === "resolved").length;
    const inProgressCount = tickets.filter(t => t.status === "in_progress" || t.status === "assigned").length;
    const pendingCount = tickets.length - closedCount - resolvedCount - inProgressCount;

    const cardsHtml = buildPdfStatsCardsHtml([
      { label: isAr ? "إجمالي البلاغات" : "Total", value: tickets.length, color: "#2563eb", bg: "#eff6ff" },
      { label: isAr ? "معلقة / قيد الانتظار" : "Pending", value: pendingCount, color: "#dc2626", bg: "#fef2f2" },
      { label: isAr ? "جاري العمل" : "In Progress", value: inProgressCount, color: "#d97706", bg: "#fffbeb" },
      { label: isAr ? "مغلقة / تم الحل" : "Closed", value: closedCount + resolvedCount, color: "#059669", bg: "#ecfdf5" }
    ]);

    const htmlContent = `
      ${cardsHtml}
      <div id="mPdfRecordsContainer">
        ${blocksHtml}
      </div>
    `;

    const title = isAr ? "🗓️ التقرير الشهري لأعطال الصيانة" : "🗓️ Maintenance Monthly Report";
    const filename = `${t().reportFileName}-${new Date().toISOString().slice(0, 10)}.pdf`;

    const infoRows = [
      { label: isAr ? "الفترة" : "Period", value: isAr ? "آخر 30 يوم" : "Last 30 days" }
    ];

    await exportToPdf(title, infoRows, htmlContent, filename);

  } catch (error) {
    console.error("Error generating monthly report:", error);
    alert(t().reportGenerateError);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  }
};
