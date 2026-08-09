// ============================================================
// ticketsBoard.js
// لوحة متابعة دورة حياة التذكرة - تُعرض حسب دور المستخدم الحالي:
//   - manager/admin  -> تذاكر pending (تصنيف وإسناد)
//   - technician/engineer -> تذاكر assigned/reopened المُسندة له
//   - operator        -> تذاكر resolved (فحص وإغلاق/رفض)
// ============================================================

import { getCurrentRole, getTicketActions } from './permissions.js';
import { openActionModal } from './components/ActionModal.js';

import {
  fetchPendingTicketsApi,
  fetchTicketsForTechnicianApi,
  fetchResolvedTicketsApi,
  fetchTechniciansApi,
  assignTicketApi,
  resolveTicketApi,
  closeTicketApi,
  reopenTicketApi
} from './services/api.js';

const STATUS_LABELS = {
  pending: "بانتظار التصنيف",
  assigned: "مُسندة",
  resolved: "بانتظار الفحص",
  closed: "مغلقة",
  reopened: "أُعيد فتحها"
};

const STATUS_CLASSES = {
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  assigned: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  resolved: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  closed: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
  reopened: "bg-red-500/10 text-red-400 border border-red-500/20"
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

/**
 * تحميل لوحة التذاكر حسب دور المستخدم الحالي - مُستدعاة من
 * pageRenderer.js عند فتح صفحة 'tickets' (زي نمط loadUsers()
 * الحالي بالظبط: containerId ثابت + دالة تحميل مرتبطة بـ window)
 */
window.loadTicketsBoard = async function () {

  const container = document.getElementById("ticketsBoardContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="text-center text-gray-400 text-xs py-8">جاري تحميل التذاكر...</div>
  `;

  const role = getCurrentRole();
  const myName = localStorage.getItem("name") || "";
  const myUid = localStorage.getItem("userId") || "";

  try {

    let result;

    if (role === "manager" || role === "admin") {
      result = await fetchPendingTicketsApi();

    } else if (role === "technician" || role === "engineer") {
      result = await fetchTicketsForTechnicianApi(myName);

    } else if (role === "operator") {
      result = await fetchResolvedTicketsApi();

    } else {
      renderTicketsList("ticketsBoardContainer", [], "لا توجد صلاحية لعرض التذاكر لهذا الدور.");
      return;
    }

    if (!result || result.status !== "success") {
      container.innerHTML = `
        <div class="text-red-400 text-center text-xs py-6">
          خطأ: ${result?.message || "فشل تحميل التذاكر"}
        </div>
      `;
      return;
    }

    let tickets = Array.isArray(result.data) ? result.data : [];

    // المُبلّغ (operator) يشوف بس التذاكر اللي هو بلّغ عنها -
    // فلترة على مستوى العميل (راجع ملاحظة fetchResolvedTicketsApi)
    if (role === "operator") {
      tickets = tickets.filter(t => t.reportedByUid === myUid || t.reportedBy === myName);
    }

    renderTicketsList("ticketsBoardContainer", tickets, "لا توجد تذاكر حالياً في قائمتك.");

  } catch (error) {

    console.error("Error loading tickets board:", error);
    container.innerHTML = `
      <div class="text-red-400 text-center text-xs py-6">حدث خطأ أثناء تحميل التذاكر.</div>
    `;

  }

};


/**
 * تنفيذ إجراء على تذكرة (تصنيف/إسناد، حل، تأكيد، رفض) - بيفتح
 * نافذة صغيرة (ActionModal) لجمع البيانات المطلوبة لكل إجراء
 * ثم يستدعي دالة الـ API المناسبة من ticketsApi.js
 */
window.handleTicketAction = async function (ticketId, action) {

  let result;

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

  } else if (action === "resolve") {

    const values = await openActionModal({
      title: "✅ تسجيل إتمام الإصلاح",
      submitLabel: "تم الإصلاح",
      fields: [
        { id: "mechanicNotes", label: "ملاحظات الفني", type: "textarea", placeholder: "وصف الإصلاح الذي تم..." }
      ]
    });

    if (!values || !values.mechanicNotes) return;

    result = await resolveTicketApi(ticketId, values.mechanicNotes);

  } else if (action === "confirm") {

    result = await closeTicketApi(ticketId);

  } else if (action === "reject") {

    const values = await openActionModal({
      title: "❌ رفض الإصلاح",
      submitLabel: "رفض وإعادة فتح",
      fields: [
        { id: "operatorFeedback", label: "ما المشكلة المتبقية؟", type: "textarea", placeholder: "مثال: لا يزال يوجد تسريب..." }
      ]
    });

    if (!values || !values.operatorFeedback) return;

    result = await reopenTicketApi(ticketId, values.operatorFeedback);

  } else {
    return;
  }

  if (result?.status === "success") {
    window.loadTicketsBoard();
  } else {
    alert("❌ " + (result?.message || "حدث خطأ أثناء تنفيذ الإجراء"));
  }

};
