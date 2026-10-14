import { openActionModal } from "../components/ActionModal.js";
import { fetchTechniciansApi } from "../services/usersApi.js";
import { exportToExcel, exportToPdf } from "../services/exportUtility.js";
import { fetchPmOrdersApi, subscribeToPmOrdersApi, updatePmOrderApi, initializePmTasksApi, updatePmTaskApi, completePmOrderApi, createFollowupFromRemainingTasksApi, reschedulePmTasksApi } from "../services/api.js";
import { escapeHtml, escapeJsArg } from "../utils/escapeHtml.js";
import { hasFullDataAccess, hasPermission } from "../permissions.js";

let pmOrders = [];
let visibleOrders = [];
let selectedOrderIds = new Set();
let filters = { search: "", line: "", machine: "", from: "", to: "", priority: "", status: "", assignment: "", downtime: "" };

const isEn = () => (window.currentLang || "ar") === "en";
const label = (ar, en) => isEn() ? en : ar;
const valueOrDash = value => String(value || "").trim() || label("غير محدد", "Not specified");
const unassignedLabel = () => label("غير مسند", "Unassigned");
const unscheduledLabel = () => label("غير مجدول", "Unscheduled");
const dateValue = value => String(value || "").slice(0, 10);

// تاريخ محلي (YYYY-MM-DD) من أي قيمة تاريخ - يتفادى انزياح اليوم الناتج عن
// اقتطاع ISO بتوقيت UTC لتاريخ الإنشاء
const localDateValue = value => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
};

// تاريخ الفلترة: موعد التنفيذ إن وُجد، وإلا تاريخ الإنشاء - حتى لا تختفي
// الأوامر غير المجدولة (وهي الأغلبية عند التصنيف) بمجرد اختيار فترة
const orderFilterDate = order => localDateValue(order.plannedDate) || localDateValue(order.createdAt);
const formatDisplayDate = value => {
  const key = localDateValue(value);
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(isEn() ? "en-US" : "ar-EG");
};

const canPlanPmOrders = () => hasFullDataAccess();
const canExportPmOrders = () => hasPermission("pm") || hasPermission("reports") || hasFullDataAccess();

const pmStatusLabel = status => ({
  unplanned: label("غير مجدول", "Unscheduled"),
  planned: label("مخطط", "Planned"),
  in_progress: label("قيد التنفيذ", "In progress"),
  completed: label("مكتمل", "Completed"),
  completed_partial: label("مكتمل جزئياً", "Partially completed"),
  deferred: label("مؤجل", "Deferred")
}[status] || valueOrDash(status));

const PM_STATUS_CLASS = {
  completed: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  completed_partial: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  planned: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  in_progress: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
  deferred: "bg-gray-500/20 text-gray-300 border border-gray-500/30",
  unplanned: "bg-amber-500/20 text-amber-300 border border-amber-500/30"
};
const pmStatusBadge = status => {
  const key = status || "unplanned";
  return `<span class="whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-bold ${PM_STATUS_CLASS[key] || PM_STATUS_CLASS.unplanned}">${escapeHtml(pmStatusLabel(key))}</span>`;
};

const PM_TASK_STAGES = ["assigned", "in_progress"];
const PM_CLOSED = ["completed", "completed_partial"];
const taskStageReady = order => PM_TASK_STAGES.includes(order.status);
const canWorkOnOrder = order => canPlanPmOrders() || (!!order.assignedToUid && order.assignedToUid === (localStorage.getItem("userId") || ""));
const isPmEditable = order => canWorkOnOrder(order) && taskStageReady(order) && !PM_CLOSED.includes(order.pmStatus || "unplanned");
const taskStats = order => {
  const tasks = Array.isArray(order.pmTasks) ? order.pmTasks : [];
  return {
    total: tasks.length,
    done: tasks.filter(t => t.status === "done").length,
    notDone: tasks.filter(t => t.status === "not_done").length
  };
};
const localDateKey = () => localDateValue(new Date().toISOString()) || new Date().toISOString().slice(0, 10);

function pmBtn(cls, fn, ticketId, text) {
  return `<button type="button" onclick="window.${fn}('${escapeJsArg(ticketId)}')" class="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white transition ${cls}">${text}</button>`;
}

function getTaskActionButtons(order) {
  const id = order.id;
  const status = order.pmStatus || "unplanned";
  const isClosed = PM_CLOSED.includes(status);
  const { total } = taskStats(order);
  const btns = [];
  if (canPlanPmOrders() && status !== "completed_partial") {
    btns.push(pmBtn("bg-blue-600 hover:bg-blue-500", "editPmOrder", id, label("تخطيط", "Plan")));
  }
  if (canWorkOnOrder(order)) {
    if (total > 0) {
      const editable = isPmEditable(order);
      btns.push(pmBtn(editable ? "bg-emerald-600 hover:bg-emerald-500" : "bg-gray-600 hover:bg-gray-500", "executePmTasks", id, editable ? label("تنفيذ المهام", "Execute tasks") : label("عرض المهام", "View tasks")));
      if (editable) btns.push(pmBtn("bg-indigo-600 hover:bg-indigo-500", "completePmOrder", id, label("إنهاء", "Complete")));
    } else if (!isClosed) {
      if (taskStageReady(order)) {
        btns.push(pmBtn("bg-teal-600 hover:bg-teal-500", "initializePmTasks", id, label("تهيئة المهام", "Init tasks")));
      } else {
        btns.push(`<span class="text-[10px] text-gray-500">${label("بانتظار الإسناد وبدء التنفيذ", "Awaiting assignment")}</span>`);
      }
    }
  }
  if (canPlanPmOrders() && (status === "completed_partial" || status === "deferred")) {
    btns.push(pmBtn("bg-amber-600 hover:bg-amber-500", "reschedulePmOrder", id, label("إعادة جدولة", "Reschedule")));
  }
  if (status === "completed_partial") {
    if (order.followupTicketId) {
      btns.push(`<span class="rounded px-2 py-1 text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">${label("تمت المتابعة", "Follow-up created")}</span>`);
    } else if (canPlanPmOrders() && (order.remainingTasks || []).length) {
      btns.push(pmBtn("bg-rose-600 hover:bg-rose-500", "createFollowupFromRemaining", id, label("متابعة المتبقي", "Follow-up remaining")));
    }
  }
  return btns.length ? `<div class="flex flex-wrap gap-1.5">${btns.join("")}</div>` : "—";
}

function taskProgressCell(order) {
  const { total, done, notDone } = taskStats(order);
  if (!total) return `<span class="text-gray-500">—</span>`;
  const pct = Math.round((done / total) * 100);
  return `<div class="min-w-24">
    <div class="mb-1 text-[11px] font-bold text-gray-200">${done}/${total}${notDone ? ` <span class="text-rose-300">· ❌ ${notDone}</span>` : ""}</div>
    <div class="h-1.5 w-full overflow-hidden rounded bg-gray-700"><div class="h-full bg-emerald-500" style="width:${pct}%"></div></div>
  </div>`;
}

function filteredPmOrders() {
  const search = filters.search.trim().toLocaleLowerCase();
  return pmOrders.filter(order => {
    const statusLabelStr = pmStatusLabel(order.pmStatus || "unplanned");
    const matchSearch = !search || [
      order.issueId, order.id, order.unifiedNumber, order.line, order.machine, order.location, order.description,
      order.reportedBy, order.assignedTo, order.maintenanceNotes, order.delayReason,
      order.category, order.priority, order.pmStatus, statusLabelStr
    ].some(value => String(value || "").toLocaleLowerCase().includes(search));
    const planDate = orderFilterDate(order);
    return matchSearch
      && (!filters.line || order.line === filters.line)
      && (!filters.machine || order.machine === filters.machine)
      && (!filters.from || (planDate && planDate >= filters.from))
      && (!filters.to || (planDate && planDate <= filters.to))
      && (!filters.priority || order.priority === filters.priority)
      && (!filters.status || (order.pmStatus || "unplanned") === filters.status)
      && (!filters.assignment || (filters.assignment === "assigned" ? !!order.assignedTo : !order.assignedTo))
      && (!filters.downtime || String(order.downtimeRequired === true) === filters.downtime);
  });
}

function filterSelect(id, currentValue, options, allLabel) {
  return `<select id="${id}" class="min-w-32 flex-1 rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white">
    <option value="">${allLabel}</option>
    ${options.map(value => `<option value="${escapeHtml(value)}" ${currentValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
  </select>`;
}

function renderPmOrders() {
  const container = document.getElementById("pmOrdersContainer");
  if (!container) return;
  visibleOrders = filteredPmOrders();
  const unscheduledCount = visibleOrders.filter(order => !order.plannedDate).length;
  const unassignedCount = visibleOrders.filter(order => !order.assignedTo).length;
  const downtimeCount = visibleOrders.filter(order => order.downtimeRequired === true).length;
  const lines = [...new Set(pmOrders.map(order => order.line).filter(Boolean))].sort();
  const machines = [...new Set(pmOrders.map(order => order.machine).filter(Boolean))].sort();
  const priorities = [...new Set(pmOrders.map(order => order.priority).filter(Boolean))].sort();

  const isAllVisibleSelected = visibleOrders.length > 0 && visibleOrders.every(order => selectedOrderIds.has(order.id));
  const selectedCount = visibleOrders.filter(order => selectedOrderIds.has(order.id)).length;

  const rows = visibleOrders.map(order => {
    const isChecked = selectedOrderIds.has(order.id);
    return `
    <tr class="border-b border-gray-800 align-top ${isChecked ? 'bg-blue-950/20' : 'hover:bg-gray-800/40'} transition-colors">
      <td class="p-3 text-center">
        <input type="checkbox" data-order-id="${escapeHtml(order.id)}" class="pmRowCheckbox rounded border-gray-600 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4" ${isChecked ? "checked" : ""}>
      </td>
      <td class="p-3 font-mono text-xs text-blue-300 font-bold">${escapeHtml(order.id)}</td>
      <td class="p-3 font-mono text-xs text-amber-300 font-bold">${escapeHtml(order.unifiedNumber || "—")}</td>
      <td class="p-3 font-mono text-xs text-gray-300 font-bold">${escapeHtml(order.issueId || order.id)}</td>
      <td class="p-3 font-bold text-gray-100">${escapeHtml(valueOrDash(order.line))}</td>
      <td class="p-3 font-bold text-gray-100">${escapeHtml(valueOrDash(order.machine))}</td>
      <td class="p-3 min-w-48 whitespace-normal text-gray-200">${escapeHtml(valueOrDash(order.description))}</td>
      <td class="p-3">${escapeHtml(valueOrDash(order.priority))}</td>
      <td class="p-3">
        ${pmStatusBadge(order.pmStatus)}
      </td>
      <td class="p-3 text-gray-300">${escapeHtml(formatDisplayDate(order.createdAt) || valueOrDash(""))}</td>
      <td class="p-3 text-gray-200">${escapeHtml(formatDisplayDate(order.plannedDate) || unscheduledLabel())}</td>
      <td class="p-3 text-gray-300">${escapeHtml(order.assignedTo || unassignedLabel())}</td>
      <td class="p-3">
        ${order.downtimeRequired === true
          ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">⚡ ${label("مطلوب", "Required")}</span>`
          : `<span class="text-gray-400 text-[11px]">${label("غير مطلوب", "Not required")}</span>`}
      </td>
      <td class="p-3 min-w-40 whitespace-normal text-gray-400 text-[11px]">${escapeHtml(order.maintenanceNotes || order.delayReason || "—")}</td>
      <td class="p-3">${taskProgressCell(order)}</td>
      <td class="p-3">${getTaskActionButtons(order)}</td>
    </tr>
  `}).join("");

  container.innerHTML = `
    <div class="space-y-4" dir="${isEn() ? "ltr" : "rtl"}">
      <!-- شريط الإحصائيات والأزرار السريعة -->
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-300 font-bold">${label("غير مجدول", "Unscheduled")}: ${unscheduledCount}</span>
          <span class="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-blue-300 font-bold">${unassignedLabel()}: ${unassignedCount}</span>
          <span class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300 font-bold">⚡ ${label("توقف الخط مطلوب", "Downtime required")}: ${downtimeCount}</span>
          <span class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-200 font-bold">${label("إجمالي النتائج", "Results")}: ${visibleOrders.length}</span>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" id="pmQuickDowntimeBtn" class="rounded-lg border border-rose-500/50 bg-rose-500/20 hover:bg-rose-500/30 px-3 py-2 text-xs font-bold text-rose-300 transition flex items-center gap-1.5">
            <span>⚡</span>
            <span>${filters.downtime === "true" ? label("عرض كل المهام", "Show all tasks") : label("استخراج PM لتوقف الخط", "Line downtime PM")}</span>
          </button>
          <button type="button" id="pmOrdersRefresh" class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-bold text-white hover:bg-gray-700 transition">${label("تحديث", "Refresh")}</button>
        </div>
      </div>

      <!-- فلاتر التصفية المتقدمة -->
      <div class="rounded-xl border border-gray-800 bg-[#1E293B] p-3 space-y-3">
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <input id="pmFilterSearch" value="${escapeHtml(filters.search)}" placeholder="${label("بحث في البلاغ أو المعدة أو الوصف", "Search ticket, asset, or description")}" class="min-w-0 rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white">
          ${filterSelect("pmFilterLine", filters.line, lines, label("كل الخطوط", "All lines"))}
          ${filterSelect("pmFilterMachine", filters.machine, machines, label("كل المعدات", "All machines"))}
          <select id="pmFilterPriority" class="rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white"><option value="">${label("كل الأولويات", "All priorities")}</option>${priorities.map(value => `<option value="${escapeHtml(value)}" ${filters.priority === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select>
          <!-- فلتر من تاريخ -->
          <div class="relative rounded-lg border border-gray-700 bg-[#0F172A] p-2 hover:border-blue-500/50 transition flex flex-col justify-between">
            <div class="flex items-center justify-between text-[10px] font-bold text-gray-400 mb-1 pointer-events-none">
              <span class="flex items-center gap-1 text-blue-300">
                <span>📅</span>
                <span>${label("من تاريخ", "From Date")}</span>
              </span>
              <span class="text-[9px] text-gray-500 font-normal">${label("(تنفيذ / إنشاء)", "(planned / created)")}</span>
            </div>
            <div class="flex items-center justify-between min-h-[26px]">
              <span class="text-xs ${filters.from ? 'text-white font-mono font-bold' : 'text-gray-400'} flex items-center gap-1.5 pointer-events-none">
                ${filters.from
                  ? `<span>🗓️</span> <span>${escapeHtml(formatDisplayDate(filters.from) || filters.from)}</span>`
                  : `<span>📅</span> <span>${label("اختر التاريخ...", "Select date...")}</span>`}
              </span>
              ${filters.from ? `
                <button type="button" onclick="event.stopPropagation(); window.clearPmFilterDate('from')" title="${label("إلغاء التاريخ", "Clear date")}" class="relative z-20 text-gray-400 hover:text-rose-400 text-xs px-1 font-bold leading-none cursor-pointer">✕</button>
              ` : ''}
            </div>
            <input id="pmFilterFrom" type="date" value="${escapeHtml(filters.from)}" aria-label="${label("من تاريخ", "From Date")}" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" ${filters.from ? 'style="width: calc(100% - 28px);"' : ''}>
          </div>

          <!-- فلتر إلى تاريخ -->
          <div class="relative rounded-lg border border-gray-700 bg-[#0F172A] p-2 hover:border-blue-500/50 transition flex flex-col justify-between">
            <div class="flex items-center justify-between text-[10px] font-bold text-gray-400 mb-1 pointer-events-none">
              <span class="flex items-center gap-1 text-blue-300">
                <span>📅</span>
                <span>${label("إلى تاريخ", "To Date")}</span>
              </span>
              <span class="text-[9px] text-gray-500 font-normal">${label("(تنفيذ / إنشاء)", "(planned / created)")}</span>
            </div>
            <div class="flex items-center justify-between min-h-[26px]">
              <span class="text-xs ${filters.to ? 'text-white font-mono font-bold' : 'text-gray-400'} flex items-center gap-1.5 pointer-events-none">
                ${filters.to
                  ? `<span>🗓️</span> <span>${escapeHtml(formatDisplayDate(filters.to) || filters.to)}</span>`
                  : `<span>📅</span> <span>${label("اختر التاريخ...", "Select date...")}</span>`}
              </span>
              ${filters.to ? `
                <button type="button" onclick="event.stopPropagation(); window.clearPmFilterDate('to')" title="${label("إلغاء التاريخ", "Clear date")}" class="relative z-20 text-gray-400 hover:text-rose-400 text-xs px-1 font-bold leading-none cursor-pointer">✕</button>
              ` : ''}
            </div>
            <input id="pmFilterTo" type="date" value="${escapeHtml(filters.to)}" aria-label="${label("إلى تاريخ", "To Date")}" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" ${filters.to ? 'style="width: calc(100% - 28px);"' : ''}>
          </div>
          <select id="pmFilterStatus" class="rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white">
            <option value="">${label("كل الحالات", "All statuses")}</option>
            ${["unplanned", "planned", "in_progress", "completed", "completed_partial", "deferred"].map(status => `<option value="${status}" ${filters.status === status ? "selected" : ""}>${pmStatusLabel(status)}</option>`).join("")}
          </select>
          <select id="pmFilterAssignment" class="rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white">
            <option value="">${label("مسند وغير مسند", "Assigned and unassigned")}</option>
            <option value="assigned" ${filters.assignment === "assigned" ? "selected" : ""}>${label("مسند", "Assigned")}</option>
            <option value="unassigned" ${filters.assignment === "unassigned" ? "selected" : ""}>${unassignedLabel()}</option>
          </select>
          <select id="pmFilterDowntime" class="rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white sm:col-span-2 xl:col-span-2">
            <option value="">${label("كل متطلبات التوقف", "All downtime needs")}</option>
            <option value="true" ${filters.downtime === "true" ? "selected" : ""}>⚡ ${label("يتطلب توقف الخط (فرصة تنفيذ أثناء العطل)", "Downtime required (run during stoppage)")}</option>
            <option value="false" ${filters.downtime === "false" ? "selected" : ""}>${label("لا يتطلب توقفاً", "No downtime required")}</option>
          </select>
          <div class="flex gap-2 sm:col-span-2 xl:col-span-2">
            <button type="button" id="pmResetFiltersBtn" class="w-full rounded-lg border border-gray-700 bg-[#0F172A] hover:bg-gray-800 px-3 py-2 text-xs font-bold text-gray-300 transition">
              ${label("إعادة ضبط الفلاتر", "Reset filters")}
            </button>
          </div>
        </div>

        <!-- أزرار التصدير وشريط التحديد -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-800/80">
          <div class="flex items-center gap-2 text-xs">
            ${selectedCount > 0 ? `
              <span class="rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 px-3 py-1.5 font-bold">
                ✓ ${label(`تم تحديد ${selectedCount} أمر من أصل ${visibleOrders.length}`, `${selectedCount} of ${visibleOrders.length} selected`)}
              </span>
              <button type="button" id="pmClearSelectionBtn" class="text-blue-400 hover:text-blue-300 font-bold underline px-1 text-xs">
                ${label("إلغاء التحديد", "Clear")}
              </button>
            ` : `
              <span class="text-gray-400 text-xs">
                ${label("حدد أوامر لتصديرها، أو صدّر كل النتائج المعروضة:", "Select orders to export, or export all results:")}
              </span>
            `}
          </div>

          <div class="flex items-center gap-2">
            <button type="button" onclick="window.exportPmOrders('excel')" class="rounded-lg bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-md">
              <span>📊 Excel</span>
              <span>${selectedCount > 0 ? `(${selectedCount})` : `(${visibleOrders.length})`}</span>
            </button>
            <button type="button" onclick="window.exportPmOrders('pdf')" class="rounded-lg bg-rose-700 hover:bg-rose-600 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-md">
              <span>📄 PDF</span>
              <span>${selectedCount > 0 ? `(${selectedCount})` : `(${visibleOrders.length})`}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- جدول أوامر PM مع أعمدة التحديد والبيانات الكاملة -->
      ${visibleOrders.length ? `
        <div class="overflow-x-auto rounded-xl border border-gray-800 bg-[#1E293B]">
          <table class="min-w-[1400px] w-full text-start text-xs text-gray-200">
            <thead class="sticky top-0 bg-gray-800 text-gray-300 select-none">
              <tr>
                <th class="p-3 w-10 text-center">
                  <input type="checkbox" id="pmSelectAll" title="${label("تحديد الكل", "Select all")}" ${isAllVisibleSelected ? "checked" : ""} class="rounded border-gray-600 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4">
                </th>
                ${[
                  label("رقم الأمر", "Work order"), label("الرقم الموحد", "Unified #"),
                  label("رقم البلاغ", "Ticket"),
                  label("الخط", "Line"), label("المعدة", "Equipment"),
                  label("وصف المهمة", "Task description"), label("الأولوية", "Priority"),
                  label("الحالة", "Status"), label("تاريخ الإنشاء", "Created"),
                  label("موعد التنفيذ", "Planned date"), label("الفني / الفريق", "Assigned to"),
                  label("توقف الخط", "Downtime"), label("ملاحظات التخطيط / التأجيل", "Planning / delay notes"),
                  label("المهام", "Tasks"), label("الإجراء", "Action")
                ].map(header => `<th class="whitespace-nowrap p-3">${header}</th>`).join("")}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : `<div class="rounded-xl border border-gray-800 bg-[#1E293B] p-8 text-center text-sm text-gray-400">${pmOrders.length ? label("لا توجد أوامر مطابقة للفلاتر.", "No orders match these filters.") : label("لا توجد بلاغات مصنفة PM حتى الآن.", "No tickets have been classified as PM yet.")}</div>`}
    </div>
  `;

  // ربط الأحداث
  container.querySelector("#pmOrdersRefresh")?.addEventListener("click", () => window.loadPmOrdersBoard(true));
  container.querySelector("#pmQuickDowntimeBtn")?.addEventListener("click", () => {
    filters.downtime = filters.downtime === "true" ? "" : "true";
    renderPmOrders();
  });
  container.querySelector("#pmResetFiltersBtn")?.addEventListener("click", () => {
    filters = { search: "", line: "", machine: "", from: "", to: "", priority: "", status: "", assignment: "", downtime: "" };
    selectedOrderIds.clear();
    renderPmOrders();
  });
  container.querySelector("#pmClearSelectionBtn")?.addEventListener("click", () => {
    selectedOrderIds.clear();
    renderPmOrders();
  });

  // تحديد الكل
  const selectAllEl = container.querySelector("#pmSelectAll");
  selectAllEl?.addEventListener("change", e => {
    if (e.target.checked) {
      visibleOrders.forEach(o => selectedOrderIds.add(o.id));
    } else {
      visibleOrders.forEach(o => selectedOrderIds.delete(o.id));
    }
    renderPmOrders();
  });

  // تحديد صف فردي
  container.querySelectorAll(".pmRowCheckbox").forEach(checkbox => {
    checkbox.addEventListener("change", e => {
      const orderId = e.target.dataset.orderId;
      if (e.target.checked) {
        selectedOrderIds.add(orderId);
      } else {
        selectedOrderIds.delete(orderId);
      }
      renderPmOrders();
    });
  });

  const filterFields = {
    pmFilterSearch: "search", pmFilterLine: "line", pmFilterMachine: "machine",
    pmFilterPriority: "priority", pmFilterFrom: "from", pmFilterTo: "to",
    pmFilterStatus: "status", pmFilterAssignment: "assignment", pmFilterDowntime: "downtime"
  };
  for (const [elementId, filterName] of Object.entries(filterFields)) {
    const element = container.querySelector(`#${elementId}`);
    element?.addEventListener(elementId === "pmFilterSearch" ? "input" : "change", event => {
      filters[filterName] = event.target.value;
      renderPmOrders();
    });
  }
}

export const PmOrdersView = () => `
  <section class="app-page space-y-4 p-3 pb-24 text-white sm:p-5" dir="${isEn() ? "ltr" : "rtl"}">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-black text-blue-400 flex items-center gap-2">
          <span>🗓️</span>
          <span>${label("أوامر الصيانة الوقائية (PM)", "Preventive Maintenance Orders (PM)")}</span>
        </h2>
        <p class="mt-1 text-xs text-gray-400">${label("استخراج وتخطيط مهام PM المرتبطة بخطوط الإنتاج والمعدات، وتصدير أوامر العمل الميدانية أثناء التوقف.", "Plan, filter and extract PM work orders linked to production lines and equipment for field downtime work.")}</p>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" onclick="window.navigateTo('pm')" class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-bold text-white hover:bg-gray-700 transition">${label("تسجيل نموذج PM", "Record PM form")}</button>
      </div>
    </div>
    <div id="pmOrdersContainer" aria-live="polite" class="rounded-xl border border-gray-800 bg-[#1E293B] p-6 text-center text-xs text-gray-400">${label("جاري تحميل أوامر PM...", "Loading PM orders...")}</div>
  </section>
`;

window.clearPmFilterDate = function(key) {
  if (key === "from") filters.from = "";
  if (key === "to") filters.to = "";
  renderPmOrders();
};

window.openPmOrdersWithFilter = function(presetFilters = {}) {
  filters = {
    search: "", line: "", machine: "", from: "", to: "",
    priority: "", status: "", assignment: "", downtime: "",
    ...presetFilters
  };
  selectedOrderIds.clear();
  if (typeof window.navigateTo === "function") {
    window.navigateTo("pmOrders");
  }
};

let unsubscribePmOrders = null;

window.cleanupPmOrdersBoard = function() {
  closePmTasksModal();
  if (typeof unsubscribePmOrders === "function") unsubscribePmOrders();
  unsubscribePmOrders = null;
};

// اشتراك لحظي: البيانات تتحدث تلقائياً بدون Refresh؛ الاستدعاءات اللاحقة
// (بعد الحفظ/الزر) تعيد العرض فقط ما دام الاشتراك قائماً.
window.loadPmOrdersBoard = async function(force = false) {
  const container = document.getElementById("pmOrdersContainer");
  if (!container) return;
  if (typeof unsubscribePmOrders === "function" && !force) {
    renderPmOrders();
    return;
  }
  window.cleanupPmOrdersBoard();
  container.innerHTML = `<div class="py-6 text-center text-xs text-gray-400">${label("جاري تحميل أوامر PM...", "Loading PM orders...")}</div>`;
  let first = true;
  unsubscribePmOrders = subscribeToPmOrdersApi((result) => {
    const target = document.getElementById("pmOrdersContainer");
    if (!target) { window.cleanupPmOrdersBoard(); return; }
    if (result.status !== "success") {
      if (first) {
        target.innerHTML = `<div role="alert" class="py-6 text-center text-sm text-red-300">${label("تعذر تحميل أوامر الصيانة الوقائية.", "Could not load PM orders.")} ${escapeHtml(result.message || "")}</div>`;
      }
      return;
    }
    first = false;
    pmOrders = result.data;
    const knownIds = new Set(pmOrders.map(order => order.id));
    selectedOrderIds.forEach(id => { if (!knownIds.has(id)) selectedOrderIds.delete(id); });
    renderPmOrders();
    if (pmTasksModalState) renderPmTasksModal();
  });
};

let pmOrderSaving = false;

window.editPmOrder = async function(ticketId) {
  if (!canPlanPmOrders()) {
    alert(label("ليست لديك صلاحية تخطيط أوامر الصيانة الوقائية.", "You are not allowed to plan PM orders."));
    return;
  }
  if (pmOrderSaving) return;
  const order = pmOrders.find(item => item.id === ticketId);
  if (!order) {
    alert(label("تعذر العثور على أمر PM في البيانات المحملة.", "PM order not found in the loaded data."));
    return;
  }
  const techResult = await fetchTechniciansApi();
  if (techResult.status !== "success") {
    alert(techResult.message || label("تعذر تحميل قائمة الفنيين.", "Could not load technicians."));
    return;
  }
  const technicians = techResult.data || [];
  const technicianOptions = [
    { value: "", label: unassignedLabel() },
    ...technicians.map(tech => ({ value: `${tech.id}::${tech.name}`, label: `${tech.name} (${tech.role})` }))
  ];
  if (order.assignedToUid && !technicians.some(tech => tech.id === order.assignedToUid)) {
    technicianOptions.push({ value: `${order.assignedToUid}::${order.assignedTo}`, label: order.assignedTo });
  }
  const values = await openActionModal({
    title: `${label("تخطيط أمر PM", "Plan PM order")} · ${order.issueId || order.id}`,
    submitLabel: label("حفظ التخطيط", "Save plan"),
    fields: [
      { id: "line", label: label("خط الإنتاج", "Production line"), defaultValue: order.line || "" },
      { id: "machine", label: label("المعدة", "Equipment"), defaultValue: order.machine || "" },
      { id: "location", label: label("الموقع", "Location"), defaultValue: order.location || "" },
      { id: "priority", label: label("الأولوية", "Priority"), type: "select", defaultValue: order.priority || "Medium", options: ["High", "Medium", "Low"].map(v => ({ value: v, label: v })) },
      { id: "plannedDate", label: label("موعد التنفيذ (اتركه فارغاً لغير المجدول)", "Planned date (leave blank if unscheduled)"), type: "date", defaultValue: dateValue(order.plannedDate) },
      { id: "pmStatus", label: label("حالة أمر PM", "PM order status"), type: "select", defaultValue: order.pmStatus || "unplanned", options: ["unplanned", "planned", "in_progress", "completed", "deferred"].map(status => ({ value: status, label: pmStatusLabel(status) })) },
      { id: "assignedTo", label: label("الفني (اختياري)", "Technician (optional)"), type: "select", defaultValue: order.assignedToUid ? `${order.assignedToUid}::${order.assignedTo}` : "", options: technicianOptions },
      { id: "downtimeRequired", label: label("هل يتطلب توقف خط الإنتاج؟", "Does this require line downtime?"), type: "select", defaultValue: order.downtimeRequired === true ? "true" : "false", options: [{ value: "false", label: label("لا / غير محدد", "No / unset") }, { value: "true", label: label("نعم", "Yes") }] },
      { id: "maintenanceNotes", label: label("ملاحظات التخطيط", "Planning notes"), type: "textarea", defaultValue: order.maintenanceNotes || "" },
      { id: "delayReason", label: label("سبب التأجيل (إن وجد)", "Reason for delay (if any)"), type: "textarea", defaultValue: order.delayReason || "" }
    ]
  });
  if (!values) return;
  const [assignedToUid, ...assignedNameParts] = String(values.assignedTo || "").split("::");
  const assignedTo = assignedNameParts.join("::");
  pmOrderSaving = true;
  let result;
  try {
    result = await updatePmOrderApi(ticketId, {
      ...values,
      assignedTo: assignedTo || "",
      assignedToUid: assignedToUid || "",
      downtimeRequired: values.downtimeRequired === "true"
    });
  } finally {
    pmOrderSaving = false;
  }
  if (result.status !== "success") {
    alert(`${label("فشل حفظ التخطيط:", "Failed to save plan:")} ${result.message || ""}`);
    return;
  }
  await window.loadPmOrdersBoard();
};

// ============================================================
// PM Task Execution
// ============================================================

let pmTasksModalState = null; // { ticketId, reasonFor, reasonText, error, busy }

function onPmModalKey(event) {
  if (event.key === "Escape") closePmTasksModal();
}

function closePmTasksModal() {
  document.getElementById("pmTasksOverlay")?.remove();
  document.removeEventListener("keydown", onPmModalKey);
  pmTasksModalState = null;
}

function renderPmTasksModal() {
  const state = pmTasksModalState;
  const overlay = document.getElementById("pmTasksOverlay");
  if (!state || !overlay) return;
  const order = pmOrders.find(item => item.id === state.ticketId);
  if (!order) { closePmTasksModal(); return; }

  const liveReason = overlay.querySelector("#pmReasonInput");
  if (liveReason) state.reasonText = liveReason.value;

  const tasks = Array.isArray(order.pmTasks) ? order.pmTasks : [];
  const { total, done } = taskStats(order);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const editable = isPmEditable(order);
  const dis = state.busy ? "disabled" : "";
  const btn = (act, taskId, cls, text) => `<button type="button" ${dis} data-pm-act="${act}" data-task="${escapeHtml(taskId)}" class="flex-1 rounded-lg px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50 ${cls}">${text}</button>`;

  const taskCards = tasks.map((task, index) => {
    const st = task.status || "pending";
    const badgeCls = st === "done" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
      : st === "not_done" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
      : "bg-amber-500/20 text-amber-300 border border-amber-500/30";
    const badgeText = st === "done" ? label("✅ تم", "✅ Done") : st === "not_done" ? label("❌ لم يتم", "❌ Not done") : label("⏳ بانتظار", "⏳ Pending");
    const who = st !== "pending" && task.completedBy ? `<div class="text-[10px] text-gray-500">${escapeHtml(task.completedBy)}${task.completedAt ? " · " + escapeHtml(formatDisplayDate(task.completedAt)) : ""}</div>` : "";
    let actions = "";
    if (editable) {
      if (state.reasonFor === task.id) {
        actions = `
          <textarea id="pmReasonInput" rows="2" placeholder="${label("سبب عدم التنفيذ (مطلوب)", "Reason (required)")}" class="w-full rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white">${escapeHtml(state.reasonText)}</textarea>
          <div class="flex gap-2">${btn("save", task.id, "bg-rose-600 hover:bg-rose-500", label("حفظ السبب", "Save reason"))}${btn("cancel", task.id, "bg-gray-600 hover:bg-gray-500", label("إلغاء", "Cancel"))}</div>`;
      } else {
        actions = `<div class="flex gap-2">
          ${st !== "done" ? btn("done", task.id, "bg-emerald-600 hover:bg-emerald-500", label("✅ تم التنفيذ", "✅ Done")) : ""}
          ${st !== "not_done" ? btn("notdone", task.id, "bg-rose-600 hover:bg-rose-500", label("❌ لم يتم", "❌ Not done")) : ""}
          ${st !== "pending" ? btn("pending", task.id, "bg-gray-600 hover:bg-gray-500", label("↩️ إعادة للانتظار", "↩️ Reset")) : ""}
        </div>`;
      }
    }
    return `
      <div class="space-y-2 rounded-lg border border-gray-700 bg-[#0F172A] p-3">
        <div class="flex items-start justify-between gap-2">
          <span class="text-sm font-bold text-gray-100">${index + 1}. ${escapeHtml(task.description || "")}</span>
          <span class="whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-bold ${badgeCls}">${badgeText}</span>
        </div>
        ${st === "not_done" && task.reason ? `<div class="rounded bg-rose-500/10 p-2 text-[11px] text-rose-300">${label("السبب:", "Reason:")} ${escapeHtml(task.reason)}</div>` : ""}
        ${who}
        ${actions}
      </div>`;
  }).join("");

  overlay.innerHTML = `
    <div dir="${isEn() ? "ltr" : "rtl"}" class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-700 bg-[#1E293B] p-4 shadow-2xl">
      <div class="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 class="text-sm font-bold text-blue-400">${editable ? label("تنفيذ مهام PM", "Execute PM tasks") : label("مهام PM (عرض فقط)", "PM tasks (view only)")}</h3>
          <div class="mt-1 text-xs text-gray-300">${escapeHtml(order.issueId || order.id)} · ${escapeHtml(valueOrDash(order.machine))} · ${escapeHtml(valueOrDash(order.line))}</div>
        </div>
        ${pmStatusBadge(order.pmStatus)}
      </div>
      <div class="mb-3">
        <div class="mb-1 flex justify-between text-[11px] text-gray-400"><span>${label("التقدم", "Progress")}</span><span>${done}/${total} (${pct}%)</span></div>
        <div class="h-2 w-full overflow-hidden rounded bg-gray-700"><div class="h-full bg-emerald-500" style="width:${pct}%"></div></div>
      </div>
      ${state.error ? `<div role="alert" class="mb-3 rounded bg-red-500/10 p-2 text-[11px] text-red-300">${escapeHtml(state.error)}</div>` : ""}
      <div class="space-y-3">${taskCards || `<div class="p-4 text-center text-xs text-gray-400">${label("لا توجد مهام.", "No tasks.")}</div>`}</div>
      <div class="mt-4 flex gap-2 border-t border-gray-700 pt-3">
        <button type="button" data-pm-act="close" class="flex-1 rounded-lg bg-gray-700 py-2.5 text-xs font-bold text-white hover:bg-gray-600">${label("إغلاق", "Close")}</button>
        ${editable ? `<button type="button" ${dis} data-pm-act="complete" class="flex-1 rounded-lg bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50">${label("إنهاء الأمر", "Complete order")}</button>` : ""}
      </div>
    </div>`;
}

async function handlePmTaskAct(act, taskId) {
  const state = pmTasksModalState;
  if (!state || state.busy) return;
  if (act === "close") { closePmTasksModal(); return; }
  if (act === "complete") {
    state.busy = true;
    const ok = await window.completePmOrder(state.ticketId);
    if (pmTasksModalState !== state) return;
    state.busy = false;
    if (ok) closePmTasksModal(); else renderPmTasksModal();
    return;
  }
  if (act === "notdone") { state.reasonFor = taskId; state.reasonText = ""; state.error = ""; renderPmTasksModal(); return; }
  if (act === "cancel") { state.reasonFor = null; state.error = ""; renderPmTasksModal(); return; }

  let status = act === "done" ? "done" : act === "pending" ? "pending" : "not_done";
  let reason = null;
  if (act === "save") {
    reason = String(document.getElementById("pmReasonInput")?.value || "").trim();
    if (!reason) { state.error = label("السبب مطلوب.", "Reason is required."); renderPmTasksModal(); return; }
  }
  state.busy = true;
  state.error = "";
  renderPmTasksModal();
  const result = await updatePmTaskApi(state.ticketId, taskId, { status, reason });
  if (pmTasksModalState !== state) return;
  state.busy = false;
  if (result.status === "success") {
    state.reasonFor = null;
    const order = pmOrders.find(item => item.id === state.ticketId);
    if (order) {
      order.pmTasks = (order.pmTasks || []).map(task => task.id === taskId ? { ...task, ...result.data } : task);
      if (status !== "pending" && ["unplanned", "planned", undefined, ""].includes(order.pmStatus)) order.pmStatus = "in_progress";
    }
    renderPmOrders();
  } else {
    state.error = `${label("فشل التحديث:", "Update failed:")} ${result.message || ""}`;
  }
  renderPmTasksModal();
}

window.initializePmTasks = async function(ticketId) {
  const order = pmOrders.find(item => item.id === ticketId);
  if (!order) {
    alert(label("تعذر العثور على أمر PM.", "PM order not found."));
    return;
  }
  if (!canWorkOnOrder(order)) {
    alert(label("ليست لديك صلاحية تهيئة مهام PM.", "You are not allowed to initialize PM tasks."));
    return;
  }
  if (!taskStageReady(order)) {
    alert(label("يجب إسناد الأمر لفني وبدء التنفيذ أولاً.", "Assign the order to a technician and start work first."));
    return;
  }
  if (!confirm(label("سيتم تهيئة مهام PM الافتراضية (فحص الهيدروليك، تنظيف الفلاتر، التشحيم). متابعة؟", "Initialize default PM tasks (hydraulic check, filter cleaning, lubrication). Continue?"))) return;

  const result = await initializePmTasksApi(ticketId);
  if (result.status === "success") {
    await window.loadPmOrdersBoard();
  } else {
    alert(`${label("فشل التهيئة:", "Initialization failed:")} ${result.message || ""}`);
  }
};

window.executePmTasks = function(ticketId) {
  const order = pmOrders.find(item => item.id === ticketId);
  if (!order) {
    alert(label("تعذر العثور على أمر PM.", "PM order not found."));
    return;
  }
  if (!canWorkOnOrder(order)) {
    alert(label("ليست لديك صلاحية الوصول لمهام PM.", "You are not allowed to access PM tasks."));
    return;
  }
  if (!(order.pmTasks || []).length) {
    alert(label("لا توجد مهام محددة. اضغط 'تهيئة المهام' أولاً.", "No tasks defined. Click 'Init tasks' first."));
    return;
  }
  closePmTasksModal();
  pmTasksModalState = { ticketId, reasonFor: null, reasonText: "", error: "", busy: false };
  const overlay = document.createElement("div");
  overlay.id = "pmTasksOverlay";
  overlay.className = "fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center";
  overlay.addEventListener("click", event => {
    if (event.target === overlay) { closePmTasksModal(); return; }
    const button = event.target.closest("[data-pm-act]");
    if (button) handlePmTaskAct(button.dataset.pmAct, button.dataset.task || "");
  });
  document.body.appendChild(overlay);
  document.addEventListener("keydown", onPmModalKey);
  renderPmTasksModal();
};

window.completePmOrder = async function(ticketId) {
  const order = pmOrders.find(item => item.id === ticketId);
  if (!order) {
    alert(label("تعذر العثور على أمر PM.", "PM order not found."));
    return false;
  }
  if (!canWorkOnOrder(order)) {
    alert(label("ليست لديك صلاحية إنهاء أوامر PM.", "You are not allowed to complete PM orders."));
    return false;
  }
  if (!isPmEditable(order)) {
    alert(label("لا يمكن إنهاء هذا الأمر في حالته الحالية.", "This order cannot be completed in its current state."));
    return false;
  }
  const tasks = order.pmTasks || [];
  const done = tasks.filter(t => t.status === "done").length;
  const notDone = tasks.filter(t => t.status === "not_done").length;
  const pending = tasks.length - done - notDone;
  const name = order.issueId || order.id;
  const msg = label(
    `أمر PM: ${name}\n✅ منفذة: ${done} | ❌ لم تنفذ: ${notDone} | ⏳ معلقة: ${pending}\n\nالمهام المعلقة ستُسجل كـ "لم يتم تنفيذها" مع سبب تلقائي.\nإذا بقيت مهام غير منفذة، سيكون الأمر "مكتمل جزئياً".\n\nتأكيد الإنهاء؟`,
    `PM Order: ${name}\n✅ Done: ${done} | ❌ Not done: ${notDone} | ⏳ Pending: ${pending}\n\nPending tasks will be marked as "Not done" with an auto reason.\nIf tasks remain not done, the order becomes "Partially completed".\n\nConfirm completion?`
  );
  if (!confirm(msg)) return false;

  const result = await completePmOrderApi(ticketId);
  if (result.status !== "success") {
    alert(`${label("فشل الإنهاء:", "Completion failed:")} ${result.message || ""}`);
    return false;
  }
  const { isPartial, doneCount, notDoneCount } = result.data;
  alert(label(
    `تم إنهاء الأمر ${isPartial ? "جزئياً" : "كاملاً"}.\n✅ منفذة: ${doneCount} | ❌ غير منفذة: ${notDoneCount}\n${isPartial ? "يمكنك متابعة المهام المتبقية من زر 'متابعة المتبقي' أو إعادة الجدولة." : "جميع المهام تمت بنجاح."}`,
    `Order completed ${isPartial ? "partially" : "fully"}.\n✅ Done: ${doneCount} | ❌ Not done: ${notDoneCount}\n${isPartial ? "Use 'Follow-up remaining' or 'Reschedule' for the remaining tasks." : "All tasks completed successfully."}`
  ));
  await window.loadPmOrdersBoard();
  return true;
};

window.createFollowupFromRemaining = async function(ticketId) {
  if (!canPlanPmOrders()) {
    alert(label("ليست لديك صلاحية إنشاء أوامر متابعة.", "You are not allowed to create follow-up orders."));
    return;
  }
  const order = pmOrders.find(item => item.id === ticketId);
  if (!order) {
    alert(label("تعذر العثور على أمر PM.", "PM order not found."));
    return;
  }
  if (order.followupTicketId) {
    alert(label("تم إنشاء أمر متابعة لهذا الأمر مسبقاً.", "A follow-up order already exists."));
    return;
  }
  const remainingTasks = order.remainingTasks || [];
  if (!remainingTasks.length) {
    alert(label("لا توجد مهام متبقية للمتابعة.", "No remaining tasks to follow up."));
    return;
  }
  const name = order.issueId || order.id;
  const title = prompt(label("عنوان أمر المتابعة:", "Follow-up order title:"), `${label("متابعة PM", "PM follow-up")} - ${name}`);
  if (!title || !title.trim()) return;
  const description = prompt(label("وصف أمر المتابعة:", "Follow-up order description:"), `${label("مهام متبقية من PM", "Remaining tasks from PM")} ${name}: ${remainingTasks.map(t => t.description).join(", ")}`);
  if (!description || !description.trim()) return;

  const result = await createFollowupFromRemainingTasksApi(ticketId, { title: title.trim(), description: description.trim() });
  if (result.status === "success") {
    alert(label(`تم إنشاء أمر متابعة جديد: ${result.data.unifiedNumber || result.data.followupTicketId}`, `Follow-up order created: ${result.data.unifiedNumber || result.data.followupTicketId}`));
    await window.loadPmOrdersBoard();
  } else {
    alert(`${label("فشل إنشاء المتابعة:", "Follow-up creation failed:")} ${result.message || ""}`);
  }
};

window.reschedulePmOrder = async function(ticketId) {
  if (!canPlanPmOrders()) {
    alert(label("ليست لديك صلاحية إعادة جدولة أوامر PM.", "You are not allowed to reschedule PM orders."));
    return;
  }
  const order = pmOrders.find(item => item.id === ticketId);
  if (!order) {
    alert(label("تعذر العثور على أمر PM.", "PM order not found."));
    return;
  }
  const techResult = await fetchTechniciansApi();
  if (techResult.status !== "success") {
    alert(techResult.message || label("تعذر تحميل قائمة الفنيين.", "Could not load technicians."));
    return;
  }
  const technicians = techResult.data || [];
  const technicianOptions = [
    { value: "", label: unassignedLabel() },
    ...technicians.map(tech => ({ value: `${tech.id}::${tech.name}`, label: `${tech.name} (${tech.role})` }))
  ];
  if (order.assignedToUid && !technicians.some(tech => tech.id === order.assignedToUid)) {
    technicianOptions.push({ value: `${order.assignedToUid}::${order.assignedTo}`, label: order.assignedTo });
  }

  const values = await openActionModal({
    title: `${label("إعادة جدولة أمر PM", "Reschedule PM order")} · ${order.issueId || order.id}`,
    submitLabel: label("حفظ", "Save"),
    fields: [
      { id: "plannedDate", label: label("موعد التنفيذ الجديد (مطلوب)", "New planned date (required)"), type: "date", defaultValue: "" },
      { id: "assignedTo", label: label("الفني (اختياري)", "Technician (optional)"), type: "select", defaultValue: order.assignedToUid ? `${order.assignedToUid}::${order.assignedTo}` : "", options: technicianOptions },
      { id: "maintenanceNotes", label: label("ملاحظات إعادة الجدولة", "Rescheduling notes"), type: "textarea", defaultValue: order.maintenanceNotes || "" }
    ]
  });
  if (!values) return;
  if (!String(values.plannedDate || "").trim()) {
    alert(label("حدد موعد التنفيذ الجديد.", "Please choose the new planned date."));
    return;
  }

  const [assignedToUid, ...assignedNameParts] = String(values.assignedTo || "").split("::");
  const result = await reschedulePmTasksApi(ticketId, {
    plannedDate: values.plannedDate,
    assignedTo: assignedNameParts.join("::") || "",
    assignedToUid: assignedToUid || "",
    maintenanceNotes: values.maintenanceNotes
  });

  if (result.status === "success") {
    alert(label("تمت إعادة الجدولة بنجاح.", "Rescheduled successfully."));
    await window.loadPmOrdersBoard();
  } else {
    alert(`${label("فشل إعادة الجدولة:", "Rescheduling failed:")} ${result.message || ""}`);
  }
};

window.exportPmOrders = async function(format) {
  if (!canExportPmOrders()) {
    alert(label("ليست لديك صلاحية تصدير تقارير الصيانة الوقائية.", "You are not allowed to export PM reports."));
    return;
  }

  // إذا تم تحديد أوامر بالـ checkboxes، يتم تصدير المحدد فقط؛ وإلا تصدير نتائج الفلتر
  const filtered = filteredPmOrders();
  const selectedData = filtered.filter(order => selectedOrderIds.has(order.id));
  const hasSelected = selectedData.length > 0;
  const data = hasSelected ? selectedData : filtered;

  if (!data.length) {
    alert(label("لا توجد بيانات مطابقة للتصدير.", "No matching data to export."));
    return;
  }

  const headers = [
    label("رقم أمر الصيانة", "Work order ID"),
    label("الرقم الموحد", "Unified #"),
    label("رقم البلاغ", "Ticket"),
    label("النوع", "Type"),
    label("خط الإنتاج", "Production line"),
    label("المعدة", "Equipment"),
    label("الموقع", "Location"),
    label("وصف المهمة", "Task description"),
    label("الأولوية", "Priority"),
    label("الحالة", "Status"),
    label("المهام المنفذة", "Tasks done"),
    label("تاريخ الإنشاء", "Created at"),
    label("موعد التنفيذ المخطط", "Planned date"),
    label("الفني / الفريق", "Assigned technician / team"),
    label("توقف الخط مطلوب", "Downtime required"),
    label("ملاحظات التخطيط", "Planning notes"),
    label("سبب التأجيل", "Delay reason")
  ];

  const rows = data.map(order => [
    order.id,
    order.unifiedNumber || "",
    order.issueId || order.id,
    "PM",
    order.line || "",
    order.machine || "",
    order.location || "",
    order.description || "",
    order.priority || "",
    pmStatusLabel(order.pmStatus || "unplanned"),
    (() => { const st = taskStats(order); return st.total ? `${st.done}/${st.total}` : ""; })(),
    formatDisplayDate(order.createdAt),
    formatDisplayDate(order.plannedDate) || unscheduledLabel(),
    order.assignedTo || unassignedLabel(),
    order.downtimeRequired === true ? label("نعم", "Yes") : label("لا / غير محدد", "No / unset"),
    order.maintenanceNotes || "",
    order.delayReason || ""
  ]);

  const filtersSummary = [
    `${label("الخط", "Line")}: ${filters.line || label("الكل", "All")}`,
    `${label("المعدة", "Equipment")}: ${filters.machine || label("الكل", "All")}`,
    `${label("الفترة", "Planned period")}: ${filters.from || "—"} → ${filters.to || "—"}`,
    `${label("الأولوية", "Priority")}: ${filters.priority || label("الكل", "All")}`,
    `${label("الحالة", "Status")}: ${filters.status ? pmStatusLabel(filters.status) : label("الكل", "All")}`,
    `${label("الإسناد", "Assignment")}: ${filters.assignment === "assigned" ? label("مسند", "Assigned") : filters.assignment === "unassigned" ? unassignedLabel() : label("الكل", "All")}`,
    `${label("توقف الخط", "Downtime")}: ${filters.downtime === "true" ? label("يتطلب توقفاً", "Required") : filters.downtime === "false" ? label("لا يتطلب", "Not required") : label("الكل", "All")}`,
    `${label("النطاق", "Scope")}: ${hasSelected ? label(`محدد يدوياً (${data.length} أمر)`, `Selected (${data.length} orders)`) : label(`نتائج التصفية (${data.length} أمر)`, `All filtered (${data.length} orders)`)}`
  ].join(" | ");

  const isDowntimeFocus = filters.downtime === "true";
  const title = isDowntimeFocus
    ? label("تقرير وخطة مهام الصيانة الوقائية (PM) عند توقف الخط", "Line Downtime PM Work Orders Report")
    : label("تقرير أوامر الصيانة الوقائية", "Preventive Maintenance Work Orders Report");

  const filename = `pm-work-orders-${localDateKey()}`;

  if (format === "excel") {
    await exportToExcel(title, headers, rows, filename, { sheetName: label("أوامر PM", "PM Orders") });
    return;
  }

  const exportTime = new Date().toLocaleString(isEn() ? "en-US" : "ar-EG");
  const tableRows = rows.map(row => `<tr>${row.map(cell => `<td style="border:1px solid #cbd5e1;padding:6px;word-break:break-word;">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  const html = `
    <div dir="${isEn() ? "ltr" : "rtl"}" style="font-family:Tahoma,Arial,sans-serif;color:#0f172a;padding:8px;">
      <div style="border-bottom:2px solid #2563eb;padding-bottom:8px;margin-bottom:12px;">
        <h3 style="margin:0 0 4px 0;color:#1e3a8a;font-size:14px;">${escapeHtml(title)}</h3>
        <p style="margin:0;font-size:10px;color:#475569;line-height:1.6">
          <strong>${escapeHtml(label("تاريخ التصدير", "Exported at"))}:</strong> ${escapeHtml(exportTime)} &nbsp;|&nbsp;
          <strong>${escapeHtml(label("عدد الأوامر", "Total orders"))}:</strong> ${data.length}<br>
          <strong>${escapeHtml(label("الفلاتر", "Filters"))}:</strong> ${escapeHtml(filtersSummary)}
        </p>
      </div>

      ${isDowntimeFocus ? `
        <div style="background:#fef2f2;border:1px solid #f87171;color:#991b1b;padding:8px;border-radius:6px;font-size:10px;margin-bottom:12px;font-weight:bold;">
          ⚡ ${escapeHtml(label("مهام صيانة وقائية مرتبطة بتوقف خط الإنتاج — جاهزة للعمل الميداني الفوري", "PM tasks requiring production line stoppage — ready for immediate field execution"))}
        </div>
      ` : ''}

      <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:8px;direction:${isEn() ? "ltr" : "rtl"};margin-bottom:20px;">
        <thead style="display:table-header-group">
          <tr>${headers.map(header => `<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:6px;color:#1e293b;font-weight:bold;overflow-wrap:anywhere">${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>

      <!-- نموذج توقيعات العمل الميداني والاعتماد -->
      <div style="margin-top:24px;border-top:1px dashed #94a3b8;padding-top:12px;display:flex;justify-content:space-between;font-size:9px;color:#334155;">
        <div style="width:30%;border:1px solid #e2e8f0;padding:8px;border-radius:4px;">
          <strong>${escapeHtml(label("مهندس الصيانة / مشرف الوردية", "Maintenance Engineer / Supervisor"))}:</strong><br><br>
          ${escapeHtml(label("الاسم والتوقيع: ........................", "Name & Signature: ........................"))}
        </div>
        <div style="width:30%;border:1px solid #e2e8f0;padding:8px;border-radius:4px;">
          <strong>${escapeHtml(label("الفني المنفذ / الفريق", "Executing Technician / Team"))}:</strong><br><br>
          ${escapeHtml(label("الاسم والتوقيع: ........................", "Name & Signature: ........................"))}
        </div>
        <div style="width:30%;border:1px solid #e2e8f0;padding:8px;border-radius:4px;">
          <strong>${escapeHtml(label("تأكيد إنجاز العمل وملاحظات التشغيل", "Field Completion & Handover Verification"))}:</strong><br><br>
          ${escapeHtml(label("الوقت والتاريخ: ........................", "Time & Date: ........................"))}
        </div>
      </div>
    </div>`;

  await exportToPdf(title, [{ label: label("الفلاتر المستخدمة", "Applied filters"), value: filtersSummary }], html, `${filename}.pdf`);
};
