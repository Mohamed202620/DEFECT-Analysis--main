// ============================================================
// TicketDetailsModal.js
// شاشة "Ticket Details" - بتايملاين لكل تغييرات الحالة + صور
// بعد الإصلاح. بديل خفيف (Modal) بدل صفحة/Route جديدة كاملة،
// عشان نحافظ على الـ Architecture الحالي زي ما هو.
// ============================================================

import { fetchTicketByIdApi, fetchTicketLogsApi } from '../services/api.js';
import { translations } from '../config.js';

// إصلاح (ترجمة شاملة): نصوص النافذة وتسميات الحالات كانت ثابتة
// بالعربي - دلوقتي بتقرأ من translations.ticketDetailsModal حسب
// window.currentLang، ومسميات الحالات بتتشارك نفس مفاتيح فلتر
// الحالة الموجودة أصلاً في translations.maintenanceSearch
function t() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).ticketDetailsModal;
}

function statusLabels() {
  const currentLang = window.currentLang || "ar";
  const s = (translations[currentLang] || translations.ar).maintenanceSearch;
  return {
    pending: s.statusPending,
    assigned: s.statusAssigned,
    in_progress: s.statusInProgress,
    resolved: s.statusResolved,
    closed: s.statusClosed,
    reopened: s.statusInProgress // توافق مع أي بيانات قديمة قبل التحديث
  };
}

const ACTION_ICONS = {
  create: "📝",
  assign: "🛠️",
  start: "▶️",
  resolve: "✅",
  close: "✔️",
  reject: "❌"
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

function timelineItemHtml(log) {
  return `
    <div class="flex gap-3">
      <div class="flex flex-col items-center">
        <div class="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xs">
          ${ACTION_ICONS[log.action] || "•"}
        </div>
        <div class="w-px flex-1 bg-gray-700 my-1"></div>
      </div>
      <div class="pb-4 flex-1">
        <div class="text-[11px] font-bold text-gray-200">
          ${statusLabels()[log.toStatus] || log.toStatus}
        </div>
        <div class="text-[10px] text-gray-500 mt-0.5">
          ${log.by || ""} ${log.byRole ? `(${log.byRole})` : ""} · ${formatDate(log.at)}
        </div>
        ${log.note ? `<div class="text-[11px] text-gray-400 mt-1 bg-[#0F172A] rounded-lg p-2 border border-gray-800">${log.note}</div>` : ""}
      </div>
    </div>
  `;
}

/**
 * فتح نافذة تفاصيل تذكرة معينة (سجل + صور + بيانات كاملة)
 */
export async function openTicketDetailsModal(ticketId) {

  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-4";

  const tr = t();

  overlay.innerHTML = `
    <div class="bg-[#1E293B] border border-gray-700 rounded-2xl w-full max-w-md p-4 shadow-2xl max-h-[85vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-bold text-blue-400">${tr.title}</h3>
        <button id="ticketDetails_close" class="text-gray-400 hover:text-white text-lg leading-none">✕</button>
      </div>
      <div id="ticketDetails_body" class="text-center text-gray-500 text-xs py-8">
        ${tr.loading}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#ticketDetails_close").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  const [ticketResult, logsResult] = await Promise.all([
    fetchTicketByIdApi(ticketId),
    fetchTicketLogsApi(ticketId)
  ]);

  const body = overlay.querySelector("#ticketDetails_body");

  if (ticketResult.status !== "success") {
    body.innerHTML = `<div class="text-red-400 text-xs">${t().loadError}</div>`;
    return;
  }

  const ticket = ticketResult.data;
  const logs = logsResult.status === "success" ? logsResult.data : [];
  const afterImages = Array.isArray(ticket.afterImages) ? ticket.afterImages : [];
  const labels = statusLabels();

  body.innerHTML = `
    <div class="space-y-4 text-right">

      <!-- بيانات أساسية -->
      <div class="bg-[#0F172A] border border-gray-800 rounded-xl p-3 space-y-1.5">
        <div class="flex justify-between text-xs">
          <span class="text-gray-500">${t().machine}</span>
          <span class="text-gray-200 font-bold">${ticket.machine || ticket.machineName || "-"}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span class="text-gray-500">${t().status}</span>
          <span class="text-blue-300 font-bold">${labels[ticket.status] || ticket.status}</span>
        </div>
        ${ticket.reportedBy ? `
        <div class="flex justify-between text-xs">
          <span class="text-gray-500">${t().reportedBy}</span>
          <span class="text-gray-300">${ticket.reportedBy}</span>
        </div>` : ""}
        ${ticket.assignedTo ? `
        <div class="flex justify-between text-xs">
          <span class="text-gray-500">${t().assignedTo}</span>
          <span class="text-gray-300">${ticket.assignedTo}</span>
        </div>` : ""}
        ${ticket.description ? `
        <div class="text-xs text-gray-400 pt-1 border-t border-gray-800 mt-1">${ticket.description}</div>` : ""}
      </div>

      <!-- صور بعد الإصلاح -->
      ${afterImages.length ? `
        <div>
          <div class="text-[11px] font-bold text-gray-300 mb-2">${t().repairImages}</div>
          <div class="grid grid-cols-3 gap-2">
            ${afterImages.map(url => `
              <a href="${url}" target="_blank" rel="noopener">
                <img src="${url}" class="w-full h-20 object-cover rounded-lg border border-gray-800" />
              </a>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <!-- التايملاين -->
      <div>
        <div class="text-[11px] font-bold text-gray-300 mb-2">${t().statusLog}</div>
        ${logs.length ? logs.map(timelineItemHtml).join("") : `<div class="text-[11px] text-gray-500">${t().noLog}</div>`}
      </div>

    </div>
  `;

}

window.openTicketDetailsModal = openTicketDetailsModal;
