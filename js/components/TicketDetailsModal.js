// ============================================================
// TicketDetailsModal.js
// شاشة "Ticket Details" - كل بيانات البلاغ (رقم البلاغ، الأولوية،
// نوع العطل، زمن التوقف، الصور، الإجراءات المتخذة) + تايملاين لكل
// تغييرات الحالة + أزرار التحكم في دورة حياة البلاغ حسب دور المستخدم.
// بديل خفيف (Modal) بدل صفحة/Route جديدة كاملة، عشان نحافظ على
// الـ Architecture الحالي زي ما هو.
// ============================================================

import { fetchTicketByIdApi, fetchTicketLogsApi } from '../services/api.js';
import { getTicketActions } from '../permissions.js';
// إصلاح (تنظيف/Refactor): كانت دي نسخة رابعة مكررة (يدوياً) من نفس
// تسميات حالة البلاغ الموجودة أصلاً في ticketStatusConstants.js -
// موحّدة دلوقتي مع باقي الملفات (workflow.js/statistics.js/
// maintenanceSearch.js/ticketsBoard.js) عشان أي حالة جديدة تتضاف
// تبان في كل مكان مرة واحدة. الفرق الوحيد اللي كان موجود هنا هو
// "مغلق" (مذكّر) بدل "مغلقة" (مؤنث) - اتوحّد على النسخة المشتركة.
// STATUS_CLASSES و isClosedStatus بقوا مستوردين هنا كمان لنفس السبب -
// كان فيه STATUS_BADGE_CLASSES محلي مطابق حرفياً لـ STATUS_CLASSES
// المشتركة، وOPEN_STATUSES محلي منفصل كان ممكن ينحرف عن isClosedStatus
// لو حالة جديدة اتضافت مستقبلاً وحد نسي يحدّث الاتنين مع بعض
import { STATUS_LABELS as STATUS_LABELS_AR, STATUS_CLASSES as STATUS_BADGE_CLASSES, isClosedStatus } from '../ticketStatusConstants.js';

const PRIORITY_BADGES = {
  High: { label: "🔴 عالية", cls: "bg-red-500/10 text-red-400 border border-red-500/20" },
  Medium: { label: "🟡 متوسطة", cls: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  Low: { label: "🟢 منخفضة", cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" }
};

const TYPE_LABELS = {
  Breakdown: "🔧 عطل مفاجئ",
  Observation: "📋 ملاحظة",
  PM: "🗓️ صيانة وقائية",
  Other: "🏷️ أخرى"
};

const CATEGORY_ICONS = {
  "كهرباء": "⚡",
  "ميكانيكا": "⚙️",
  "برمجة": "💻",
  "Safety": "🛡️",
  "جودة": "📦",
  "أخرى": "❓"
};

const ACTION_ICONS = {
  create: "📝",
  assign: "🛠️",
  reassign: "🔄",
  start: "▶️",
  resolve: "✅",
  close: "✔️",
  reject: "❌",
  reopen: "🔄"
};

// أزرار التحكم (Ticket Lifecycle Actions) - نفس مفاتيح getTicketActions
// الموجودة في permissions.js، وبتتنفّذ فعلياً عبر window.handleTicketAction
// (المُعرَّفة في ticketsBoard.js) عشان نحافظ على منطق واحد فقط لكل إجراء
// (فتح نافذة إدخال البيانات المطلوبة + استدعاء الـ API + الإشعارات)
// بدل تكرار/ازدواج نفس المنطق هنا من جديد
const ACTION_BUTTON_STYLES = {
  assign: "bg-blue-600 hover:bg-blue-500 text-white",
  reassign: "bg-amber-600 hover:bg-amber-500 text-white",
  start: "bg-indigo-600 hover:bg-indigo-500 text-white",
  resolve: "bg-emerald-600 hover:bg-emerald-500 text-white",
  confirm: "bg-emerald-600 hover:bg-emerald-500 text-white",
  reject: "bg-red-600/90 hover:bg-red-600 text-white"
};

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

// تنسيق مدة زمنية (بالساعات) بصيغة عربية مختصرة ومقروءة: "يوم و3 ساعات"
function formatDurationHours(totalHours) {
  if (!isFinite(totalHours) || totalHours < 0) return "-";

  const totalMinutes = Math.round(totalHours * 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "يوم" : "أيام"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "ساعة" : "ساعات"}`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} دقيقة`);

  return parts.length ? parts.join(" و") : "أقل من دقيقة";
}

// حساب زمن التوقف: من لحظة الإبلاغ (createdAt) وحتى لحظة الإصلاح
// (updatedAt عند resolved/closed)، أو حتى اللحظة الحالية لو البلاغ
// لسه مفتوح (بنفس منطق حساب MTTR المُستخدم فعلياً في statistics.js)
function computeDowntime(ticket) {
  const status = String(ticket?.status || "").trim().toLowerCase();
  const created = ticket?.createdAt ? new Date(ticket.createdAt) : null;
  if (!created || isNaN(created)) return null;

  // إصلاح (تنظيف/Refactor): "مفتوحة" هنا = عكس isClosedStatus بالظبط
  // (نفس المصدر المشترك) بدل قائمة OPEN_STATUSES منفصلة كانت ممكن
  // تنحرف عن CLOSED_STATUSES لو حالة جديدة اتضافت مستقبلاً ونسي حد
  // يحدّث الاتنين مع بعض
  const isOpen = !isClosedStatus(status);
  const end = isOpen
    ? new Date()
    : (ticket?.updatedAt ? new Date(ticket.updatedAt) : new Date());

  if (isNaN(end) || end < created) return null;

  const hours = (end - created) / (1000 * 60 * 60);
  return { hours, isOpen };
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
          ${STATUS_LABELS_AR[log.toStatus] || log.toStatus || ""}
        </div>
        <div class="text-[10px] text-gray-500 mt-0.5">
          ${escapeHtml(log.by || "")} ${log.byRole ? `(${escapeHtml(log.byRole)})` : ""} · ${formatDate(log.at)}
        </div>
        ${log.note ? `<div class="text-[11px] text-gray-400 mt-1 bg-[#0F172A] rounded-lg p-2 border border-gray-800">${escapeHtml(log.note)}</div>` : ""}
      </div>
    </div>
  `;
}

function infoRowHtml(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return `
    <div class="flex justify-between text-xs gap-3">
      <span class="text-gray-500 shrink-0">${label}</span>
      <span class="text-gray-200 font-bold text-left">${value}</span>
    </div>
  `;
}

function imagesGridHtml(title, urls) {
  if (!Array.isArray(urls) || !urls.length) return "";
  return `
    <div>
      <div class="text-[11px] font-bold text-gray-300 mb-2">${title}</div>
      <div class="grid grid-cols-3 gap-2">
        ${urls.map(url => `
          <a href="${url}" target="_blank" rel="noopener">
            <img src="${url}" loading="lazy" class="w-full h-20 object-cover rounded-lg border border-gray-800" />
          </a>
        `).join("")}
      </div>
    </div>
  `;
}

/**
 * فتح نافذة تفاصيل تذكرة معينة (بيانات كاملة + زمن توقف + صور + سجل
 * + أزرار تحكم) - بتُستخدم في أكثر من صفحة (لوحة البلاغات، البحث
 * والفلترة المتقدمة، الإشعارات...) بنفس المكوّن الموحّد
 */
export async function openTicketDetailsModal(ticketId) {

  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-4";

  overlay.innerHTML = `
    <div class="bg-[#1E293B] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
      <div class="flex items-center justify-between p-4 pb-3 border-b border-gray-800 shrink-0">
        <h3 class="text-sm font-bold text-blue-400">🔍 تفاصيل البلاغ</h3>
        <button id="ticketDetails_close" class="text-gray-400 hover:text-white text-lg leading-none">✕</button>
      </div>
      <div id="ticketDetails_body" class="p-4 flex-1 overflow-y-auto text-center text-gray-500 text-xs py-8">
        جاري التحميل...
      </div>
      <div id="ticketDetails_footer" class="hidden shrink-0 border-t border-gray-800 p-3 flex flex-wrap gap-2 justify-end bg-[#1E293B]"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  let downtimeInterval = null;

  const close = () => {
    if (downtimeInterval) clearInterval(downtimeInterval);
    overlay.remove();
  };

  overlay.querySelector("#ticketDetails_close").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  const body = overlay.querySelector("#ticketDetails_body");
  const footer = overlay.querySelector("#ticketDetails_footer");

  async function render() {

    if (downtimeInterval) {
      clearInterval(downtimeInterval);
      downtimeInterval = null;
    }

    const [ticketResult, logsResult] = await Promise.all([
      fetchTicketByIdApi(ticketId),
      fetchTicketLogsApi(ticketId)
    ]);

    if (ticketResult.status !== "success") {
      body.innerHTML = `<div class="text-red-400 text-xs py-8">تعذر تحميل بيانات التذكرة${ticketResult.message ? `: ${escapeHtml(ticketResult.message)}` : "."}</div>`;
      footer.classList.add("hidden");
      footer.innerHTML = "";
      return;
    }

    const ticket = ticketResult.data;
    const logs = logsResult.status === "success" ? logsResult.data : [];
    const status = String(ticket.status || "").trim().toLowerCase();
    // دعم الاسم الجديد (imageUrls - عدة صور) مع التوافق مع الاسم
    // القديم (imageUrl - صورة مفردة) للتذاكر المُنشأة قبل هذا التحديث
    const beforeImages = Array.isArray(ticket.imageUrls) && ticket.imageUrls.length
      ? ticket.imageUrls
      : (ticket.imageUrl ? [ticket.imageUrl] : []);
    const afterImages = Array.isArray(ticket.afterImages) ? ticket.afterImages : [];
    const priority = PRIORITY_BADGES[ticket.priority] || null;
    const typeLabel = TYPE_LABELS[ticket.type] || ticket.type || null;
    // إضافة: تصنيف العمل اللي اختاره المسؤول وقت الإسناد (workType) -
    // منفصل تمامًا عن typeLabel الأصلي اللي اختاره العامل المُبلّغ
    const workTypeLabel = ticket.workType
      ? (TYPE_LABELS[ticket.workType] || ticket.workType)
      : null;
    const categoryLabel = ticket.category
      ? `${CATEGORY_ICONS[ticket.category] || "🏷️"} ${ticket.category}`
      : null;

    // ------- زمن التوقف -------
    const downtimeSpanId = "ticketDetails_downtime_value";
    const downtime = computeDowntime(ticket);

    body.innerHTML = `
      <div class="space-y-4 text-right">

        <!-- رقم البلاغ + الحالة -->
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-mono text-gray-400">#${escapeHtml(ticket.issueId || ticket.id || "-")}</span>
          <span class="text-[11px] px-2 py-1 rounded-full font-bold ${STATUS_BADGE_CLASSES[status] || "bg-gray-500/10 text-gray-400 border border-gray-500/20"}">
            ${STATUS_LABELS_AR[status] || ticket.status || "-"}
          </span>
        </div>

        <!-- بيانات أساسية -->
        <div class="bg-[#0F172A] border border-gray-800 rounded-xl p-3 space-y-1.5">
          ${infoRowHtml("الماكينة", escapeHtml(ticket.machine || ticket.machineName || "-"))}
          ${infoRowHtml("الخط", escapeHtml(ticket.line || "-"))}
          ${priority ? infoRowHtml("درجة الأولوية", `<span class="px-2 py-0.5 rounded-full text-[10px] ${priority.cls}">${priority.label}</span>`) : ""}
          ${typeLabel ? infoRowHtml("نوع البلاغ", escapeHtml(typeLabel)) : ""}
          ${workTypeLabel ? infoRowHtml("تصنيف العمل (عند الإسناد)", escapeHtml(workTypeLabel)) : ""}
          ${categoryLabel ? infoRowHtml("نوع العطل", escapeHtml(categoryLabel)) : ""}
          ${infoRowHtml("مكان العطل", ticket.location ? escapeHtml(ticket.location) : "")}
          ${infoRowHtml("المُبلّغ", ticket.reportedBy ? escapeHtml(ticket.reportedBy) : "")}
          ${infoRowHtml("مُسندة إلى", ticket.assignedTo ? escapeHtml(ticket.assignedTo) : "")}
          ${infoRowHtml("تاريخ الإبلاغ", formatDate(ticket.createdAt))}
          ${ticket.updatedAt ? infoRowHtml("آخر تحديث", formatDate(ticket.updatedAt)) : ""}
          ${ticket.description ? `<div class="text-xs text-gray-400 pt-1.5 border-t border-gray-800 mt-1.5">${escapeHtml(ticket.description)}</div>` : ""}
          ${ticket.suggestion ? `
            <div class="text-[11px] text-gray-400 bg-[#1E293B] rounded-lg p-2 border border-gray-800 mt-1">
              💡 اقتراح المُبلّغ: ${escapeHtml(ticket.suggestion)}
            </div>` : ""}
        </div>

        <!-- زمن التوقف -->
        ${downtime ? `
          <div class="rounded-xl p-3 border ${downtime.isOpen ? "bg-red-500/5 border-red-500/20" : "bg-emerald-500/5 border-emerald-500/20"}">
            <div class="flex justify-between items-center text-xs">
              <span class="${downtime.isOpen ? "text-red-300" : "text-emerald-300"} font-bold">
                ${downtime.isOpen ? "⏱️ متوقفة حالياً منذ" : "⏱️ إجمالي زمن التوقف حتى الإصلاح"}
              </span>
              <span id="${downtimeSpanId}" class="font-bold ${downtime.isOpen ? "text-red-300" : "text-emerald-300"}">
                ${formatDurationHours(downtime.hours)}
              </span>
            </div>
          </div>
        ` : ""}

        <!-- الإجراءات المتخذة -->
        ${ticket.mechanicNotes ? `
          <div class="text-[11px] bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5 text-emerald-300">
            🔧 <span class="font-bold">الإجراء المتخذ (ملاحظات الفني):</span>
            <div class="text-emerald-200/90 mt-1">${escapeHtml(ticket.mechanicNotes)}</div>
          </div>` : ""}
        ${ticket.operatorFeedback ? `
          <div class="text-[11px] bg-red-500/5 border border-red-500/20 rounded-lg p-2.5 text-red-300">
            ⚠️ <span class="font-bold">ملاحظات المُبلّغ (سبب إعادة الفتح):</span>
            <div class="text-red-200/90 mt-1">${escapeHtml(ticket.operatorFeedback)}</div>
          </div>` : ""}

        <!-- الصور المرفقة -->
        ${imagesGridHtml("📷 صور البلاغ", beforeImages)}
        ${imagesGridHtml("📷 صور بعد الإصلاح", afterImages)}

        <!-- التايملاين -->
        <div>
          <div class="text-[11px] font-bold text-gray-300 mb-2">🕒 سجل الحالات</div>
          ${logs.length ? logs.map(timelineItemHtml).join("") : `<div class="text-[11px] text-gray-500">لا يوجد سجل بعد.</div>`}
        </div>

      </div>
    `;

    // تحديث "زمن التوقف" حياً كل دقيقة طالما البلاغ لسه مفتوح، بدون
    // إعادة تحميل بيانات التذكرة كاملة من السيرفر
    if (downtime && downtime.isOpen) {
      downtimeInterval = setInterval(() => {
        const span = document.getElementById(downtimeSpanId);
        if (!span || !document.body.contains(overlay)) {
          clearInterval(downtimeInterval);
          downtimeInterval = null;
          return;
        }
        const fresh = computeDowntime(ticket);
        if (fresh) span.textContent = formatDurationHours(fresh.hours);
      }, 60 * 1000);
    }

    // ------- أزرار التحكم -------
    const actions = getTicketActions(ticket).filter(a => a.key !== "details");

    if (!actions.length) {
      footer.classList.add("hidden");
      footer.innerHTML = "";
      return;
    }

    footer.classList.remove("hidden");
    footer.innerHTML = actions.map(a => `
      <button
        data-action-key="${a.key}"
        class="ticketDetails_actionBtn text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95 ${ACTION_BUTTON_STYLES[a.key] || "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"}">
        ${a.label}
      </button>
    `).join("");

    footer.querySelectorAll(".ticketDetails_actionBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (typeof window.handleTicketAction !== "function") {
          alert("⚠️ تعذر تنفيذ الإجراء (تحديث الصفحة وحاول مرة أخرى).");
          return;
        }

        footer.querySelectorAll(".ticketDetails_actionBtn").forEach(b => { b.disabled = true; });
        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳ جاري التنفيذ...";

        try {
          await window.handleTicketAction(ticket.id, btn.dataset.actionKey);
        } finally {
          if (document.body.contains(overlay)) {
            await render();
          }
        }
      });
    });

  }

  await render();

}

window.openTicketDetailsModal = openTicketDetailsModal;
