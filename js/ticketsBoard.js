// ============================================================
// ticketsBoard.js
// لوحة متابعة دورة حياة التذكرة - تُعرض حسب دور المستخدم الحالي:
//   - manager/admin       -> تذاكر pending (تصنيف وإسناد) + فلاتر
//   - technician/engineer -> تذاكره (assigned/in_progress)
//   - operator            -> تذاكره (awaiting_confirmation)
// كل بطاقة فيها رابط لصفحة التفاصيل (Timeline كامل).
// ============================================================

import { getCurrentRole, getTicketActions } from './permissions.js';
import { openActionModal } from './components/ActionModal.js';

import {
  fetchPendingTicketsApi,
  fetchTicketsForTechnicianApi,
  fetchAwaitingConfirmationTicketsApi,
  fetchTechniciansApi,
  assignTicketApi,
  startTicketApi,
  completeTicketApi,
  confirmTicketApi,
  rejectTicketApi
} from './services/api.js';

export const STATUS_LABELS = {
  pending: "جديد",
  assigned: "تم الإسناد",
  in_progress: "قيد التنفيذ",
  awaiting_confirmation: "بانتظار تأكيد المُبلغ",
  closed: "مغلق"
};

const STATUS_CLASSES = {
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  assigned: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  in_progress: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  awaiting_confirmation: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  closed: "bg-gray-500/10 text-gray-400 border border-gray-500/20"
};

// كاش بسيط لقائمة الفنيين (لملء فلتر "الفني" ونافذة الإسناد) - بيتحمل
// مرة واحدة لكل زيارة للصفحة، مش بيتكرر مع كل تحديث للقائمة
let techniciansCache = null;
let lastLoadedTickets = [];

async function getTechnicians() {
  if (techniciansCache) return techniciansCache;
  const result = await fetchTechniciansApi();
  techniciansCache = result.status === "success" ? result.data : [];
  return techniciansCache;
}

function ticketCardHtml(ticket) {

  const actions = getTicketActions(ticket);

  const actionsHtml = actions.map(a => `
    <button
      onclick="event.stopPropagation(); window.handleTicketAction('${ticket.id}', '${a.key}')"
      class="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 active:scale-95 transition-all">
      ${a.label}
    </button>
  `).join("");

  const status = String(ticket.status || "").trim().toLowerCase();
  const machineName = ticket.machine || ticket.machineName || "-";

  return `
    <div
      onclick="window.openTicketDetails('${ticket.id}')"
      class="bg-[#1E293B] border border-gray-800 rounded-2xl p-4 space-y-2 mb-3 cursor-pointer hover:border-blue-500/40 transition-all">
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

      ${actionsHtml ? `<div class="flex flex-wrap gap-2 pt-1">${actionsHtml}</div>` : ""}
    </div>
  `;

}

function filtersHtml(tickets, role) {

  if (role !== "manager" && role !== "admin") return "";

  const statuses = [...new Set(tickets.map(t => t.status))];
  const technicianNames = [...new Set(tickets.map(t => t.assignedTo).filter(Boolean))];

  return `
    <div class="flex gap-2 mb-3">
      <select id="ticketsFilterStatus" onchange="window.applyTicketsFilter()"
        class="flex-1 bg-[#0F172A] border border-gray-700 rounded-lg p-2 text-[11px] text-white">
        <option value="">كل الحالات</option>
        ${statuses.map(s => `<option value="${s}">${STATUS_LABELS[s] || s}</option>`).join("")}
      </select>
      <select id="ticketsFilterTechnician" onchange="window.applyTicketsFilter()"
        class="flex-1 bg-[#0F172A] border border-gray-700 rounded-lg p-2 text-[11px] text-white">
        <option value="">كل الفنيين</option>
        ${technicianNames.map(n => `<option value="${n}">${n}</option>`).join("")}
      </select>
    </div>
  `;

}

function renderTicketsList(tickets, emptyMessage) {

  const container = document.getElementById("ticketsBoardContainer");
  if (!container) return;

  const role = getCurrentRole();
  const filtersBlock = document.getElementById("ticketsFiltersContainer");
  if (filtersBlock) {
    filtersBlock.innerHTML = filtersHtml(tickets, role);
  }

  if (!tickets.length) {
    container.innerHTML = `<div class="text-center text-gray-500 text-xs py-8">${emptyMessage}</div>`;
    return;
  }

  container.innerHTML = tickets.map(ticketCardHtml).join("");

}

/**
 * إعادة تطبيق الفلاتر الحالية (status/technician) على آخر قائمة
 * تم تحميلها - بدون طلب جديد من Firestore
 */
window.applyTicketsFilter = function () {

  const statusFilter = document.getElementById("ticketsFilterStatus")?.value || "";
  const techFilter = document.getElementById("ticketsFilterTechnician")?.value || "";

  let filtered = lastLoadedTickets;

  if (statusFilter) {
    filtered = filtered.filter(t => t.status === statusFilter);
  }
  if (techFilter) {
    filtered = filtered.filter(t => t.assignedTo === techFilter);
  }

  const container = document.getElementById("ticketsBoardContainer");
  if (!container) return;

  container.innerHTML = filtered.length
    ? filtered.map(ticketCardHtml).join("")
    : `<div class="text-center text-gray-500 text-xs py-8">لا توجد نتائج مطابقة للفلترة.</div>`;

};

/**
 * تحميل لوحة التذاكر حسب دور المستخدم الحالي - مُستدعاة من
 * pageRenderer.js عند فتح صفحة 'tickets'
 */
window.loadTicketsBoard = async function () {

  const container = document.getElementById("ticketsBoardContainer");
  if (!container) return;

  container.innerHTML = `<div class="text-center text-gray-400 text-xs py-8">جاري تحميل التذاكر...</div>`;

  const role = getCurrentRole();
  const myUid = localStorage.getItem("userId") || "";

  try {

    let result;

    if (role === "manager" || role === "admin") {
      // الأدمن/المدير: شاشة إسناد شاملة (pending) + إمكانية متابعة
      // كل التذاكر النشطة عبر الفلاتر
      const [pendingRes, activeRes, awaitingRes] = await Promise.all([
        fetchPendingTicketsApi(),
        fetchTicketsForTechnicianApi(myUid, { allTickets: true }),
        fetchAwaitingConfirmationTicketsApi(myUid, { allTickets: true })
      ]);

      const merged = [
        ...(pendingRes.status === "success" ? pendingRes.data : []),
        ...(activeRes.status === "success" ? activeRes.data : []),
        ...(awaitingRes.status === "success" ? awaitingRes.data : [])
      ];

      result = { status: "success", data: merged };

    } else if (role === "technician" || role === "engineer") {
      result = await fetchTicketsForTechnicianApi(myUid);

    } else if (role === "operator") {
      result = await fetchAwaitingConfirmationTicketsApi(myUid);

    } else {
      lastLoadedTickets = [];
      renderTicketsList([], "لا توجد صلاحية لعرض التذاكر لهذا الدور.");
      return;
    }

    if (!result || result.status !== "success") {
      container.innerHTML = `
        <div class="text-red-400 text-center text-xs py-6">خطأ: ${result?.message || "فشل تحميل التذاكر"}</div>
      `;
      return;
    }

    lastLoadedTickets = Array.isArray(result.data) ? result.data : [];
    renderTicketsList(lastLoadedTickets, "لا توجد تذاكر حالياً في قائمتك.");

  } catch (error) {

    console.error("Error loading tickets board:", error);
    container.innerHTML = `<div class="text-red-400 text-center text-xs py-6">حدث خطأ أثناء تحميل التذاكر.</div>`;

  }

};


/**
 * تنفيذ إجراء على تذكرة - بيفتح نافذة صغيرة (ActionModal) لجمع
 * البيانات المطلوبة لكل إجراء ثم يستدعي دالة الـ API المناسبة.
 */
window.handleTicketAction = async function (ticketId, action) {

  let result;

  if (action === "assign") {

    const technicians = await getTechnicians();

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

  } else if (action === "complete") {

    const values = await openActionModal({
      title: "✅ تسجيل إتمام الإصلاح",
      submitLabel: "تم الإصلاح",
      fields: [
        { id: "mechanicNotes", label: "ملاحظات الفني", type: "textarea", placeholder: "وصف الإصلاح الذي تم..." },
        { id: "images", label: "صور الإصلاح (1 إلى 3 صور)", type: "file" }
      ]
    });

    if (!values || !values.mechanicNotes) return;

    result = await completeTicketApi(ticketId, values.mechanicNotes, values.images);

  } else if (action === "confirm") {

    result = await confirmTicketApi(ticketId);

  } else if (action === "reject") {

    const values = await openActionModal({
      title: "❌ الإصلاح لم يتم",
      submitLabel: "رفض وإعادة للفني",
      fields: [
        { id: "operatorFeedback", label: "ما المشكلة المتبقية؟", type: "textarea", placeholder: "مثال: لا يزال يوجد تسريب..." }
      ]
    });

    if (!values || !values.operatorFeedback) return;

    result = await rejectTicketApi(ticketId, values.operatorFeedback);

  } else {
    return;
  }

  if (result?.status === "success") {
    window.loadTicketsBoard();
  } else {
    alert("❌ " + (result?.message || "حدث خطأ أثناء تنفيذ الإجراء"));
  }

};
