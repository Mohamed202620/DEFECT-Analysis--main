// ============================================================
// ticketDetails.js
// صفحة تفاصيل التذكرة - Timeline رأسي كامل (حالات/أشخاص/تواريخ/
// عمليات/صور) + بيانات البلاغ الأساسية.
// ============================================================

import { fetchTicketByIdApi, fetchTicketLogsApi } from './services/api.js';
import { STATUS_LABELS } from './ticketsBoard.js';

const LOG_ICONS = {
  created: "📝",
  assigned: "🛠️",
  started: "▶️",
  completed: "✅",
  confirmed: "✔️",
  rejected: "❌"
};

/**
 * فتح صفحة تفاصيل تذكرة معيّنة - بما إن الراوتر الحالي (router.js/
 * renderCore.js) بيتعامل مع اسم الصفحة كنص بسيط بدون باراميترات،
 * بنحتفظ بمعرّف التذكرة المطلوب عرضها في متغيّر عام واحد بدل تعديل
 * شكل الـ hash/التوجيه بالكامل (أقل تأثير ممكن على البنية الحالية).
 */
window.openTicketDetails = function (ticketId) {
  window.__currentTicketId = ticketId;
  window.navigateTo("ticketDetails");
};

function timelineItemHtml(log) {

  const icon = LOG_ICONS[log.action] || "•";

  const imagesHtml = Array.isArray(log.images) && log.images.length
    ? `
      <div class="flex gap-2 mt-2 flex-wrap">
        ${log.images.map(url => `
          <img src="${url}" loading="lazy"
            class="w-16 h-16 rounded-lg object-cover border border-gray-700 cursor-pointer"
            onclick="window.open('${url}', '_blank')" />
        `).join("")}
      </div>
    `
    : "";

  return `
    <div class="relative pr-8 pb-6 last:pb-0">
      <div class="absolute right-0 top-0 w-6 h-6 rounded-full bg-[#1E293B] border-2 border-blue-500 flex items-center justify-center text-xs">
        ${icon}
      </div>
      <div class="absolute right-[11px] top-6 bottom-0 w-0.5 bg-gray-800 last:hidden"></div>

      <div class="bg-[#1E293B] border border-gray-800 rounded-xl p-3">
        <p class="text-xs text-gray-200 font-bold">${log.message || ""}</p>
        <div class="flex justify-between items-center mt-1 text-[10px] text-gray-500">
          <span>👤 ${log.by || "-"}</span>
          <span>${log.createdAt ? new Date(log.createdAt).toLocaleString("ar-EG") : ""}</span>
        </div>
        ${imagesHtml}
      </div>
    </div>
  `;

}

window.loadTicketDetails = async function () {

  const container = document.getElementById("ticketDetailsContainer");
  const ticketId = window.__currentTicketId;

  if (!container) return;

  if (!ticketId) {
    container.innerHTML = `<div class="text-center text-gray-500 text-xs py-8">لم يتم تحديد تذكرة لعرضها.</div>`;
    return;
  }

  container.innerHTML = `<div class="text-center text-gray-400 text-xs py-8">جاري تحميل التفاصيل...</div>`;

  const [ticketResult, logsResult] = await Promise.all([
    fetchTicketByIdApi(ticketId),
    fetchTicketLogsApi(ticketId)
  ]);

  if (!ticketResult || ticketResult.status !== "success") {
    container.innerHTML = `
      <div class="text-red-400 text-center text-xs py-6">
        ${ticketResult?.message || "تعذّر تحميل بيانات التذكرة (قد لا يكون لديك صلاحية لعرضها)."}
      </div>
    `;
    return;
  }

  const ticket = ticketResult.data;
  const logs = logsResult.status === "success" ? logsResult.data : [];
  const status = String(ticket.status || "").trim().toLowerCase();

  container.innerHTML = `
    <div class="bg-[#1E293B] border border-gray-800 rounded-2xl p-4 mb-5 space-y-2">
      <div class="flex justify-between items-center">
        <span class="font-bold text-sm text-gray-100">${ticket.machine || ticket.machineName || "-"}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
          ${STATUS_LABELS[status] || status}
        </span>
      </div>
      <p class="text-xs text-gray-400">${ticket.description || ""}</p>
      <div class="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500 pt-1">
        ${ticket.reportedBy ? `<span>👤 بلّغ: ${ticket.reportedBy}</span>` : ""}
        ${ticket.assignedTo ? `<span>🛠️ الفني: ${ticket.assignedTo}</span>` : ""}
        ${ticket.type ? `<span>🏷️ ${ticket.type}</span>` : ""}
      </div>
      ${ticket.mechanicNotes ? `
        <div class="text-[11px] bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2 text-emerald-300 mt-2">
          🔧 ملاحظات الفني: ${ticket.mechanicNotes}
        </div>` : ""}
      ${ticket.operatorFeedback ? `
        <div class="text-[11px] bg-red-500/5 border border-red-500/20 rounded-lg p-2 text-red-300 mt-2">
          ⚠️ ملاحظات المُبلّغ: ${ticket.operatorFeedback}
        </div>` : ""}
      ${Array.isArray(ticket.repairImages) && ticket.repairImages.length ? `
        <div class="pt-2">
          <span class="text-[10px] text-gray-500 block mb-1">📷 صور الإصلاح</span>
          <div class="flex gap-2 flex-wrap">
            ${ticket.repairImages.map(url => `
              <img src="${url}" loading="lazy"
                class="w-20 h-20 rounded-lg object-cover border border-gray-700 cursor-pointer"
                onclick="window.open('${url}', '_blank')" />
            `).join("")}
          </div>
        </div>` : ""}
    </div>

    <h3 class="text-xs font-bold text-blue-400 mb-3">📜 سجل العمليات (Timeline)</h3>
    <div>
      ${logs.length ? logs.map(timelineItemHtml).join("") : `<div class="text-center text-gray-500 text-xs py-6">لا يوجد سجل عمليات بعد.</div>`}
    </div>
  `;

};
