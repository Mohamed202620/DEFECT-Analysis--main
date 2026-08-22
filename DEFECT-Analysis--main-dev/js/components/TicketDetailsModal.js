// ============================================================
// TicketDetailsModal.js
// شاشة "Ticket Details" - بتايملاين لكل تغييرات الحالة + صور
// بعد الإصلاح. بديل خفيف (Modal) بدل صفحة/Route جديدة كاملة،
// عشان نحافظ على الـ Architecture الحالي زي ما هو.
// ============================================================

import { fetchTicketByIdApi, fetchTicketLogsApi } from '../services/api.js';

const STATUS_LABELS_AR = {
  pending: "جديد",
  assigned: "تم الإسناد",
  in_progress: "قيد التنفيذ",
  resolved: "بانتظار تأكيد المُبلغ",
  closed: "مغلق",
  reopened: "قيد التنفيذ" // توافق مع أي بيانات قديمة قبل التحديث
};

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
          ${STATUS_LABELS_AR[log.toStatus] || log.toStatus}
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

  overlay.innerHTML = `
    <div class="bg-[#1E293B] border border-gray-700 rounded-2xl w-full max-w-md p-4 shadow-2xl max-h-[85vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-bold text-blue-400">🔍 تفاصيل البلاغ</h3>
        <button id="ticketDetails_close" class="text-gray-400 hover:text-white text-lg leading-none">✕</button>
      </div>
      <div id="ticketDetails_body" class="text-center text-gray-500 text-xs py-8">
        جاري التحميل...
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
    body.innerHTML = `<div class="text-red-400 text-xs">تعذر تحميل بيانات التذكرة.</div>`;
    return;
  }

  const ticket = ticketResult.data;
  const logs = logsResult.status === "success" ? logsResult.data : [];
  const afterImages = Array.isArray(ticket.afterImages) ? ticket.afterImages : [];

  body.innerHTML = `
    <div class="space-y-4 text-right">

      <!-- بيانات أساسية -->
      <div class="bg-[#0F172A] border border-gray-800 rounded-xl p-3 space-y-1.5">
        <div class="flex justify-between text-xs">
          <span class="text-gray-500">الماكينة</span>
          <span class="text-gray-200 font-bold">${ticket.machine || ticket.machineName || "-"}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span class="text-gray-500">الحالة</span>
          <span class="text-blue-300 font-bold">${STATUS_LABELS_AR[ticket.status] || ticket.status}</span>
        </div>
        ${ticket.reportedBy ? `
        <div class="flex justify-between text-xs">
          <span class="text-gray-500">المُبلّغ</span>
          <span class="text-gray-300">${ticket.reportedBy}</span>
        </div>` : ""}
        ${ticket.assignedTo ? `
        <div class="flex justify-between text-xs">
          <span class="text-gray-500">مُسندة إلى</span>
          <span class="text-gray-300">${ticket.assignedTo}</span>
        </div>` : ""}
        ${ticket.description ? `
        <div class="text-xs text-gray-400 pt-1 border-t border-gray-800 mt-1">${ticket.description}</div>` : ""}
      </div>

      <!-- صور بعد الإصلاح -->
      ${afterImages.length ? `
        <div>
          <div class="text-[11px] font-bold text-gray-300 mb-2">📷 صور بعد الإصلاح</div>
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
        <div class="text-[11px] font-bold text-gray-300 mb-2">🕒 سجل الحالات</div>
        ${logs.length ? logs.map(timelineItemHtml).join("") : `<div class="text-[11px] text-gray-500">لا يوجد سجل بعد.</div>`}
      </div>

    </div>
  `;

}

window.openTicketDetailsModal = openTicketDetailsModal;
