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
import { translations } from '../config.js';
import { displayRecordNumber } from '../utils/recordNumber.js';

// دعم اللغة (Test 14): كل نصوص المودال كانت ثابتة بالعربي
const L = (ar, en) => (window.currentLang === "en" ? en : ar);
const statusLabel = (st) => {
  const map = (translations[window.currentLang] || translations.ar).ticketsBoard?.status || {};
  return map[st] || STATUS_LABELS_AR[st];
};
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
import { STATUS_LABELS as STATUS_LABELS_AR, STATUS_CLASSES as STATUS_BADGE_CLASSES, isClosedStatus, parseTicketDate } from '../ticketStatusConstants.js';

const PRIORITY_BADGES = {
  High: { get label() { return L("🔴 عالية", "🔴 High"); }, cls: "bg-red-500/15 text-red-300 border border-red-500/30" },
  Medium: { get label() { return L("🟡 متوسطة", "🟡 Medium"); }, cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  Low: { get label() { return L("🟢 منخفضة", "🟢 Low"); }, cls: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" }
};

const TYPE_LABELS = {
  get Breakdown() { return L("🔧 عطل مفاجئ", "🔧 Breakdown"); },
  get Observation() { return L("📋 ملاحظة", "📋 Observation"); },
  get PM() { return L("🗓️ صيانة وقائية", "🗓️ Preventive Maintenance"); },
  get Other() { return L("🏷️ أخرى", "🏷️ Other"); }
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
  review: "bg-blue-600 hover:bg-blue-500 text-white",
  classify_pm: "bg-teal-600 hover:bg-teal-500 text-white",
  open_pm_orders: "bg-teal-700 hover:bg-teal-600 text-white",
  reassign: "bg-amber-600 hover:bg-amber-500 text-white",
  start: "bg-indigo-600 hover:bg-indigo-500 text-white",
  resolve: "bg-emerald-600 hover:bg-emerald-500 text-white",
  self_resolve: "bg-emerald-700 hover:bg-emerald-600 text-white",
  confirm: "bg-emerald-600 hover:bg-emerald-500 text-white",
  decline: "bg-slate-600 hover:bg-slate-500 text-white",
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
    return new Date(iso).toLocaleString(L("ar-EG", "en-US"), {
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
  if (days > 0) parts.push(L(`${days} ${days === 1 ? "يوم" : "أيام"}`, `${days} ${days === 1 ? "day" : "days"}`));
  if (hours > 0) parts.push(L(`${hours} ${hours === 1 ? "ساعة" : "ساعات"}`, `${hours} ${hours === 1 ? "hour" : "hours"}`));
  if (minutes > 0 && days === 0) parts.push(L(`${minutes} دقيقة`, `${minutes} min`));

  return parts.length ? parts.join(L(" و", " and ")) : L("أقل من دقيقة", "less than a minute");
}

// حساب زمن التوقف: من لحظة الإبلاغ (createdAtServer / createdAt) وحتى لحظة الإصلاح
// (resolvedAtServer / resolvedAt، وإلا updatedAt عند الإغلاق)، أو حتى اللحظة الحالية لو البلاغ مفتوح
function computeDowntime(ticket) {
  const status = String(ticket?.status || "").trim().toLowerCase();
  const created = parseTicketDate(ticket?.createdAtServer) || parseTicketDate(ticket);
  if (!created || isNaN(created)) return null;

  const isOpen = !isClosedStatus(status);
  const end = isOpen
    ? new Date()
    : (parseTicketDate(ticket?.resolvedAtServer) || parseTicketDate(ticket?.resolvedAt) || parseTicketDate(ticket?.updatedAt) || new Date());

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
        <div class="text-[11px] font-bold text-white">
          ${statusLabel(log.toStatus) || escapeHtml(log.toStatus || "")}
        </div>
        <div class="text-[11px] text-slate-300 mt-0.5">
          ${escapeHtml(log.by || "")} ${log.byRole ? `(${escapeHtml(log.byRole)})` : ""} · ${formatDate(log.at)}
        </div>
        ${log.note ? `<div class="text-[11px] text-slate-200 mt-1 bg-[#0F172A] rounded-lg p-2 border border-gray-800">${escapeHtml(log.note)}</div>` : ""}
      </div>
    </div>
  `;
}

function infoRowHtml(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return `
    <div class="flex justify-between text-xs gap-3">
      <span class="text-slate-300 shrink-0">${label}</span>
      <span class="text-white font-bold text-left">${value}</span>
    </div>
  `;
}

function imagesGridHtml(title, urls) {
  if (!Array.isArray(urls) || !urls.length) return "";
  return `
    <div>
      <div class="text-[11px] font-bold text-slate-200 mb-2">${title}</div>
      <div class="grid grid-cols-3 gap-2">
        ${urls.map(url => `
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener">
            <img src="${escapeHtml(url)}" loading="lazy" class="w-full h-20 object-cover rounded-lg border border-gray-800" />
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
    <div class="bg-[#1E293B] text-white border border-gray-700 rounded-2xl w-full max-w-md sm:max-w-xl md:max-w-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
      <div class="flex items-center justify-between p-4 pb-3 border-b border-gray-800 shrink-0">
        <h3 class="text-sm font-bold text-blue-300">${L("🔍 تفاصيل البلاغ", "🔍 Ticket Details")}</h3>
        <button id="ticketDetails_close" class="text-slate-300 hover:text-white text-lg leading-none">✕</button>
      </div>
      <div id="ticketDetails_body" class="p-4 flex-1 overflow-y-auto text-center text-slate-300 text-xs py-8">
        ${L("جاري التحميل...", "Loading...")}
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
      body.innerHTML = `<div class="text-red-400 text-xs py-8">${L("تعذر تحميل بيانات التذكرة", "Could not load ticket data")}${ticketResult.message ? `: ${escapeHtml(ticketResult.message)}` : "."}</div>`;
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
    const categoryLabel = ticket.category
      ? `${CATEGORY_ICONS[ticket.category] || "🏷️"} ${ticket.category}`
      : null;

    // ------- زمن التوقف -------
    const downtimeSpanId = "ticketDetails_downtime_value";
    const downtime = computeDowntime(ticket);

    body.innerHTML = `
      <div class="space-y-4 ${window.currentLang === 'en' ? 'text-left' : 'text-right'}">

        <!-- رقم البلاغ + الحالة -->
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-mono text-amber-300 font-semibold">${escapeHtml(displayRecordNumber(ticket))}</span>
          <span class="text-[11px] px-2 py-1 rounded-full font-bold ${STATUS_BADGE_CLASSES[status] || "bg-gray-500/15 text-slate-300 border border-gray-500/30"}">
            ${statusLabel(status) || ticket.status || "-"}
          </span>
        </div>

        <!-- بيانات أساسية -->
        <div class="bg-[#0F172A] border border-gray-800 rounded-xl p-3 space-y-1.5">
          ${infoRowHtml(L("الماكينة", "Machine"), escapeHtml(ticket.machine || ticket.machineName || "-"))}
          ${infoRowHtml(L("الخط", "Line"), escapeHtml(ticket.line || "-"))}
          ${ticket.unifiedNumber ? infoRowHtml(L("الرقم الموحد", "Unified #"), escapeHtml(displayRecordNumber(ticket))) : ""}
          ${priority ? infoRowHtml(L("درجة الأولوية", "Priority"), `<span class="px-2 py-0.5 rounded-full text-[11px] ${priority.cls}">${escapeHtml(priority.label)}</span>`) : ""}
          ${typeLabel ? infoRowHtml(L("نوع البلاغ", "Ticket Type"), escapeHtml(typeLabel)) : ""}
          ${ticket.maintenanceType ? infoRowHtml(L("مسار الصيانة", "Maintenance Route"), ticket.maintenanceType === "PM" ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">🗓️ PM — ${L("صيانة وقائية", "Preventive")}</span>` : `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">🔧 CM — ${L("صيانة تصحيحية", "Corrective")}</span>`) : ""}
          ${categoryLabel ? infoRowHtml(L("نوع العطل", "Fault Category"), escapeHtml(categoryLabel)) : ""}
          ${infoRowHtml(L("مكان العطل", "Fault Location"), ticket.location ? escapeHtml(ticket.location) : "")}
          ${infoRowHtml(L("المُبلّغ", "Reported By"), ticket.reportedBy ? escapeHtml(ticket.reportedBy) : "")}
          ${infoRowHtml(L("مُسندة إلى", "Assigned To"), ticket.assignedTo ? escapeHtml(ticket.assignedTo) : "")}
          ${infoRowHtml(L("تاريخ الإبلاغ", "Reported On"), formatDate(ticket.createdAt))}
          ${ticket.updatedAt ? infoRowHtml(L("آخر تحديث", "Last Updated"), formatDate(ticket.updatedAt)) : ""}
          ${ticket.description ? `<div class="text-xs text-slate-200 pt-1.5 border-t border-gray-800 mt-1.5">${escapeHtml(ticket.description)}</div>` : ""}
          ${ticket.suggestion ? `
            <div class="text-[11px] text-slate-200 bg-[#1E293B] rounded-lg p-2 border border-gray-800 mt-1">
              ${L("💡 اقتراح المُبلّغ:", "💡 Reporter suggestion:")} ${escapeHtml(ticket.suggestion)}
            </div>` : ""}
        </div>

        <!-- زمن التوقف -->
        ${downtime ? `
          <div class="rounded-xl p-3 border ${downtime.isOpen ? "bg-red-500/5 border-red-500/20" : "bg-emerald-500/5 border-emerald-500/20"}">
            <div class="flex justify-between items-center text-xs">
              <span class="${downtime.isOpen ? "text-red-300" : "text-emerald-300"} font-bold">
                ${downtime.isOpen ? L("⏱️ متوقفة حالياً منذ", "⏱️ Down for") : L("⏱️ إجمالي زمن التوقف حتى الإصلاح", "⏱️ Total downtime until repair")}
              </span>
              <span id="${escapeHtml(downtimeSpanId)}" class="font-bold ${downtime.isOpen ? "text-red-300" : "text-emerald-300"}">
                ${formatDurationHours(downtime.hours)}
              </span>
            </div>
          </div>
        ` : ""}

        <!-- الإجراءات المتخذة -->
        ${ticket.mechanicNotes ? `
          <div class="text-[11px] bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5 text-emerald-300">
            🔧 <span class="font-bold">${L("الإجراء المتخذ (ملاحظات الفني):", "Action taken (technician notes):")}</span>
            <div class="text-emerald-200/90 mt-1">${escapeHtml(ticket.mechanicNotes)}</div>
          </div>` : ""}
        ${ticket.operatorFeedback ? `
          <div class="text-[11px] bg-red-500/5 border border-red-500/20 rounded-lg p-2.5 text-red-300">
            ⚠️ <span class="font-bold">${L("ملاحظات المُبلّغ (سبب إعادة الفتح):", "Reporter notes (reason for reopening):")}</span>
            <div class="text-red-200/90 mt-1">${escapeHtml(ticket.operatorFeedback)}</div>
          </div>` : ""}

        ${Array.isArray(ticket.shiftUpdates) && ticket.shiftUpdates.length ? `
          <div class="space-y-2">
            <div class="text-[11px] font-bold text-amber-300">${L("🔄 تحديثات تسليم الورديات", "🔄 Shift Handover Updates")} (${ticket.shiftUpdates.length})</div>
            <div class="space-y-2">
              ${ticket.shiftUpdates.map(u => `
                <div class="text-[11px] bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 space-y-1">
                  <div class="flex items-center justify-between gap-2 text-amber-200 font-bold">
                    <span>${escapeHtml(u.reporterName || L("فني", "Technician"))}${u.shift ? ` • ${escapeHtml(u.shift)}` : ""}</span>
                    <span class="text-slate-300 font-normal">${formatDate(u.createdAt)}</span>
                  </div>
                  ${u.note ? `<div class="text-slate-200 leading-relaxed">${escapeHtml(u.note)}</div>` : ""}
                  ${Array.isArray(u.images) && u.images.length ? `
                    <div class="flex gap-2 overflow-x-auto pt-1">
                      ${u.images.map(url => `
                        <a href="${escapeHtml(url)}" target="_blank" rel="noopener">
                          <img src="${escapeHtml(url)}" loading="lazy" class="w-16 h-16 object-cover rounded-lg border border-gray-700" />
                        </a>
                      `).join("")}
                    </div>
                  ` : ""}
                </div>
              `).join("")}
            </div>
          </div>` : ""}

        <!-- الصور المرفقة -->
        ${imagesGridHtml(L("📷 صور البلاغ", "📷 Ticket images"), beforeImages)}
        ${imagesGridHtml(L("📷 صور بعد الإصلاح", "📷 After-repair images"), afterImages)}

        <!-- التايملاين -->
        <div>
          <div class="text-[11px] font-bold text-slate-200 mb-2">${L("🕒 سجل الحالات", "🕒 Status History")}</div>
          ${logs.length ? logs.map(timelineItemHtml).join("") : `<div class="text-[11px] text-slate-300">${L("لا يوجد سجل بعد.", "No history yet.")}</div>`}
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
        data-action-key="${escapeHtml(a.key)}"
        class="ticketDetails_actionBtn text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95 ${ACTION_BUTTON_STYLES[a.key] || "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"}">
        ${escapeHtml(a.label)}
      </button>
    `).join("");

    footer.querySelectorAll(".ticketDetails_actionBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (typeof window.handleTicketAction !== "function") {
          alert(L("⚠️ تعذر تنفيذ الإجراء (تحديث الصفحة وحاول مرة أخرى).", "⚠️ Could not perform the action (refresh the page and try again)."));
          return;
        }

        footer.querySelectorAll(".ticketDetails_actionBtn").forEach(b => { b.disabled = true; });
        const originalText = btn.innerHTML;
        btn.innerHTML = L("⏳ جاري التنفيذ...", "⏳ Processing...");

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
