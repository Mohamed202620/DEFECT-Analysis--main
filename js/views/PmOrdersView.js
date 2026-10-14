import { openActionModal } from "../components/ActionModal.js";
import { fetchTechniciansApi } from "../services/usersApi.js";
import { exportToExcel, exportToPdf } from "../services/exportUtility.js";
import { fetchPmOrdersApi, subscribeToPmOrdersApi, updatePmOrderApi, setPmDowntimeApi, initializePmTasksApi, updatePmTaskApi, completePmOrderApi, createFollowupFromRemainingTasksApi, reschedulePmTasksApi } from "../services/api.js";
import { escapeHtml, escapeJsArg } from "../utils/escapeHtml.js";
import { hasFullDataAccess, hasPermission } from "../permissions.js";

let pmOrders = [];
let visibleOrders = [];
let selectedOrderIds = new Set();
const emptyFilters = () => ({ search: "", line: "", machine: "", from: "", to: "", priority: "", status: "", assignment: "", downtime: "", quick: "" });
let filters = emptyFilters();
let filtersOpen = false;

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

const todayKey = () => localDateKey();
const isOpenOrder = order => !PM_CLOSED.includes(order.pmStatus || "unplanned");
const isOverdue = order => { const d = localDateValue(order.plannedDate); return isOpenOrder(order) && !!d && d < todayKey(); };
const isUnscheduled = order => isOpenOrder(order) && !localDateValue(order.plannedDate);
const isUnassigned = order => isOpenOrder(order) && !order.assignedTo;
const isDowntime = order => order.downtimeRequired === true;
const orderNumber = order => order.unifiedNumber || order.id;
const quickPredicates = { overdue: isOverdue, unscheduled: isUnscheduled, unassigned: isUnassigned };

function pmBtn(cls, fn, ticketId, text, title = "") {
  return `<button type="button" ${title ? `title="${escapeHtml(title)}"` : ""} onclick="window.${fn}('${escapeJsArg(ticketId)}')" class="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white transition ${cls}">${text}</button>`;
}

// الإجراءات: زر رئيسي واحد (تنفيذ) + كارت + تخطيط، والباقي حسب الحالة
function getTaskActionButtons(order) {
  const id = order.id;
  const status = order.pmStatus || "unplanned";
  const isClosed = PM_CLOSED.includes(status);
  const { total } = taskStats(order);
  const btns = [];
  if (canWorkOnOrder(order)) {
    if (total > 0) {
      const editable = isPmEditable(order);
      btns.push(pmBtn(editable ? "bg-emerald-600 hover:bg-emerald-500" : "bg-gray-600 hover:bg-gray-500", "executePmTasks", id, editable ? label("▶ تنفيذ", "▶ Execute") : label("المهام", "Tasks")));
    } else if (!isClosed) {
      if (taskStageReady(order)) {
        btns.push(pmBtn("bg-emerald-600 hover:bg-emerald-500", "executePmTasks", id, label("▶ تنفيذ", "▶ Execute")));
      } else {
        btns.push(`<span class="text-[10px] text-gray-500">${label("بانتظار الإسناد", "Awaiting assignment")}</span>`);
      }
    }
  }
  btns.push(pmBtn("bg-slate-600 hover:bg-slate-500", "printPmCard", id, "🖨️", label("كارت PM للطباعة", "Printable PM card")));
  if (canPlanPmOrders() && status !== "completed_partial") {
    btns.push(pmBtn("bg-blue-600 hover:bg-blue-500", "editPmOrder", id, label("تخطيط", "Plan")));
  }
  if (canPlanPmOrders() && (status === "completed_partial" || status === "deferred")) {
    btns.push(pmBtn("bg-amber-600 hover:bg-amber-500", "reschedulePmOrder", id, label("إعادة جدولة", "Reschedule")));
  }
  if (status === "completed_partial") {
    if (order.followupTicketId) {
      btns.push(`<span class="rounded px-2 py-1 text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">${label("تمت المتابعة", "Follow-up created")}</span>`);
    } else if (canPlanPmOrders() && (order.remainingTasks || []).length) {
      btns.push(pmBtn("bg-rose-600 hover:bg-rose-500", "createFollowupFromRemaining", id, label("متابعة المتبقي", "Follow-up")));
    }
  }
  return `<div class="flex flex-wrap items-center gap-1.5">${btns.join("")}</div>`;
}

function taskProgressCell(order) {
  const { total, done, notDone } = taskStats(order);
  if (!total) return "";
  const pct = Math.round((done / total) * 100);
  return `<div class="mt-1.5 flex items-center gap-2"><div class="h-1.5 w-16 overflow-hidden rounded bg-gray-700"><div class="h-full bg-emerald-500" style="width:${pct}%"></div></div><span class="text-[10px] font-bold text-gray-300">${done}/${total}${notDone ? ` · ❌${notDone}` : ""}</span></div>`;
}

function filteredPmOrders() {
  const search = filters.search.trim().toLocaleLowerCase();
  const quick = quickPredicates[filters.quick];
  const list = pmOrders.filter(order => {
    const statusLabelStr = pmStatusLabel(order.pmStatus || "unplanned");
    const matchSearch = !search || [
      order.issueId, order.id, order.unifiedNumber, order.originalUnifiedNumber, order.line, order.machine, order.location, order.description,
      order.reportedBy, order.assignedTo, order.maintenanceNotes, order.delayReason,
      order.category, order.priority, order.pmStatus, statusLabelStr
    ].some(value => String(value || "").toLocaleLowerCase().includes(search));
    const planDate = orderFilterDate(order);
    return matchSearch
      && (!quick || quick(order))
      && (!filters.line || order.line === filters.line)
      && (!filters.machine || order.machine === filters.machine)
      && (!filters.from || (planDate && planDate >= filters.from))
      && (!filters.to || (planDate && planDate <= filters.to))
      && (!filters.priority || order.priority === filters.priority)
      && (!filters.status || (order.pmStatus || "unplanned") === filters.status)
      && (!filters.assignment || (filters.assignment === "assigned" ? !!order.assignedTo : !order.assignedTo))
      && (!filters.downtime || String(isDowntime(order)) === filters.downtime);
  });
  // الترتيب: المتأخر ثم المجدول (الأقرب أولاً) ثم غير المجدول ثم المنتهي
  const rank = order => isOverdue(order) ? 0 : (isOpenOrder(order) ? (localDateValue(order.plannedDate) ? 1 : 2) : 3);
  return list.sort((a, b) => rank(a) - rank(b)
    || (localDateValue(a.plannedDate) || "9999").localeCompare(localDateValue(b.plannedDate) || "9999")
    || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

const selectOptions = (id, current, options, allLabel) => `<select id="${id}" class="min-w-0 rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white">
  <option value="">${allLabel}</option>
  ${options.map(([value, text]) => `<option value="${escapeHtml(value)}" ${current === value ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
</select>`;

const GRID_COLS = "md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]";

function orderRow(order) {
  const checked = selectedOrderIds.has(order.id);
  const status = order.pmStatus || "unplanned";
  const overdue = isOverdue(order);
  const planned = formatDisplayDate(order.plannedDate);
  const downtime = isDowntime(order);
  const canMark = canPlanPmOrders() && status !== "completed_partial";
  const downtimeBadge = canMark
    ? `<button type="button" data-downtime-toggle="${escapeHtml(order.id)}" title="${label("تبديل توقف الخط", "Toggle line downtime")}" class="rounded px-2 py-0.5 text-[10px] font-bold border transition ${downtime ? "bg-rose-500/25 text-rose-200 border-rose-500/50" : "bg-transparent text-gray-500 border-gray-700 hover:text-rose-300 hover:border-rose-500/40"}">⚡ ${downtime ? label("توقف الخط", "Downtime") : ""}</button>`
    : (downtime ? `<span class="rounded px-2 py-0.5 text-[10px] font-bold border bg-rose-500/25 text-rose-200 border-rose-500/50">⚡ ${label("توقف الخط", "Downtime")}</span>` : "");
  return `
    <div class="flex gap-2 border-b border-gray-800 p-3 transition-colors ${checked ? "bg-blue-950/20" : overdue ? "bg-rose-950/10" : "hover:bg-gray-800/40"}">
      <input type="checkbox" data-order-id="${escapeHtml(order.id)}" ${checked ? "checked" : ""} aria-label="${label("تحديد", "Select")}" class="pmRowCheckbox mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-600 bg-slate-900 text-blue-600">
      <div class="grid min-w-0 flex-1 grid-cols-1 items-center gap-2 ${GRID_COLS}">
        <div class="min-w-0">
          <div class="font-mono text-xs font-bold text-blue-300">${escapeHtml(orderNumber(order))}</div>
          <div class="truncate text-[10px] text-gray-400">${label("البلاغ", "Ticket")}: ${escapeHtml(order.issueId || order.id)}</div>
        </div>
        <div class="min-w-0">
          <div class="truncate text-xs font-bold text-gray-100">${escapeHtml(valueOrDash(order.machine))}</div>
          <div class="truncate text-[10px] text-gray-400">${escapeHtml(valueOrDash(order.line))}${order.description ? ` · ${escapeHtml(order.description)}` : ""}</div>
        </div>
        <div class="text-xs ${overdue ? "font-bold text-rose-300" : "text-gray-200"}">
          ${planned ? `📅 ${escapeHtml(planned)}` : `<span class="text-amber-300">${unscheduledLabel()}</span>`}
          ${overdue ? `<div class="text-[10px] font-bold text-rose-400">⏰ ${label("متأخر", "Overdue")}</div>` : ""}
        </div>
        <div class="truncate text-xs ${order.assignedTo ? "text-gray-200" : "text-blue-300"}">👤 ${escapeHtml(order.assignedTo || unassignedLabel())}</div>
        <div>
          <div class="flex flex-wrap items-center gap-1.5">${pmStatusBadge(status)}${downtimeBadge}</div>
          ${taskProgressCell(order)}
        </div>
        ${getTaskActionButtons(order)}
      </div>
    </div>`;
}

function chipButton(key, text, count, active, onCls) {
  return `<button type="button" ${key === "downtime" ? 'id="pmQuickDowntimeBtn"' : ""} data-chip="${key}" aria-pressed="${active}" class="rounded-lg border px-3 py-2 text-xs font-bold transition ${active ? onCls : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"}">${text}: ${count}</button>`;
}

function renderPmOrders() {
  const container = document.getElementById("pmOrdersContainer");
  if (!container) return;
  const activeEl = typeof document !== "undefined" ? document.activeElement : null;
  const focusId = activeEl && activeEl.id && container.contains(activeEl) ? activeEl.id : "";
  const caret = focusId && typeof activeEl.selectionStart === "number" ? activeEl.selectionStart : null;

  visibleOrders = filteredPmOrders();
  const uniq = key => [...new Set(pmOrders.map(order => order[key]).filter(Boolean))].sort().map(v => [v, v]);
  const counts = {
    overdue: pmOrders.filter(isOverdue).length,
    unscheduled: pmOrders.filter(isUnscheduled).length,
    unassigned: pmOrders.filter(isUnassigned).length,
    downtime: pmOrders.filter(order => isOpenOrder(order) && isDowntime(order)).length
  };
  const selectedVisible = visibleOrders.filter(order => selectedOrderIds.has(order.id));
  const selectedCount = selectedVisible.length;
  const allSelected = visibleOrders.length > 0 && selectedCount === visibleOrders.length;
  const scopeCount = selectedCount || visibleOrders.length;
  const hasExtra = !!(filters.machine || filters.priority || filters.assignment || filters.from || filters.to || filters.downtime);
  const showExtra = filtersOpen || hasExtra;
  const dateInput = (id, value, text) => `<label class="flex items-center gap-1.5 text-[11px] text-gray-400"><span>${text}</span><input id="${id}" type="date" value="${escapeHtml(value)}" class="min-w-0 flex-1 rounded-lg border border-gray-700 bg-[#0F172A] p-1.5 text-xs text-white"></label>`;

  container.innerHTML = `
    <div class="space-y-3 text-start" dir="${isEn() ? "ltr" : "rtl"}">
      <div class="flex flex-wrap items-center gap-2">
        ${chipButton("all", label("الكل", "All"), pmOrders.length, !filters.quick && filters.downtime !== "true", "border-blue-500/60 bg-blue-500/20 text-blue-200")}
        ${chipButton("overdue", `⏰ ${label("متأخر", "Overdue")}`, counts.overdue, filters.quick === "overdue", "border-rose-500/60 bg-rose-500/20 text-rose-200")}
        ${chipButton("unscheduled", label("غير مجدول", "Unscheduled"), counts.unscheduled, filters.quick === "unscheduled", "border-amber-500/60 bg-amber-500/20 text-amber-200")}
        ${chipButton("unassigned", unassignedLabel(), counts.unassigned, filters.quick === "unassigned", "border-sky-500/60 bg-sky-500/20 text-sky-200")}
        ${chipButton("downtime", `⚡ ${label("توقف الخط", "Line downtime")}`, counts.downtime, filters.downtime === "true", "border-orange-500/60 bg-orange-500/20 text-orange-200")}
        <button type="button" id="pmOrdersRefresh" class="ms-auto rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-bold text-white hover:bg-gray-700">↻ ${label("تحديث", "Refresh")}</button>
      </div>

      <div class="space-y-2 rounded-xl border border-gray-800 bg-[#1E293B] p-3">
        <div class="flex flex-wrap items-center gap-2">
          <input id="pmFilterSearch" value="${escapeHtml(filters.search)}" placeholder="🔍 ${label("بحث: رقم الأمر / البلاغ / المعدة / الفني", "Search: order / ticket / machine / technician")}" class="min-w-0 flex-1 basis-56 rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white">
          ${selectOptions("pmFilterStatus", filters.status, ["unplanned", "planned", "in_progress", "completed", "completed_partial", "deferred"].map(s => [s, pmStatusLabel(s)]), label("كل الحالات", "All statuses"))}
          ${selectOptions("pmFilterLine", filters.line, uniq("line"), label("كل الخطوط", "All lines"))}
          <button type="button" id="pmToggleFilters" class="rounded-lg border px-3 py-2 text-xs font-bold ${hasExtra ? "border-blue-500/60 text-blue-300" : "border-gray-700 text-gray-300"} bg-[#0F172A] hover:bg-gray-800">⚙️ ${label("المزيد", "More")}</button>
        </div>
        ${showExtra ? `
        <div class="grid grid-cols-1 gap-2 border-t border-gray-800 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          ${selectOptions("pmFilterMachine", filters.machine, uniq("machine"), label("كل المعدات", "All machines"))}
          ${selectOptions("pmFilterPriority", filters.priority, uniq("priority"), label("كل الأولويات", "All priorities"))}
          ${selectOptions("pmFilterAssignment", filters.assignment, [["assigned", label("مسند", "Assigned")], ["unassigned", unassignedLabel()]], label("مسند وغير مسند", "Assigned & unassigned"))}
          ${selectOptions("pmFilterDowntime", filters.downtime, [["true", label("يتطلب توقف الخط", "Downtime required")], ["false", label("لا يتطلب توقفاً", "No downtime")]], label("كل متطلبات التوقف", "All downtime needs"))}
          ${dateInput("pmFilterFrom", filters.from, label("من", "From"))}
          ${dateInput("pmFilterTo", filters.to, label("إلى", "To"))}
          <button type="button" id="pmResetFiltersBtn" class="rounded-lg border border-gray-700 bg-[#0F172A] px-3 py-2 text-xs font-bold text-gray-300 hover:bg-gray-800 sm:col-span-2">${label("إعادة ضبط الفلاتر", "Reset filters")}</button>
        </div>` : ""}
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs">
        <label class="flex cursor-pointer items-center gap-2 text-gray-300">
          <input type="checkbox" id="pmSelectAll" ${allSelected ? "checked" : ""} class="h-4 w-4 cursor-pointer rounded border-gray-600 bg-slate-900 text-blue-600">
          <span>${selectedCount ? label(`محدد ${selectedCount} من ${visibleOrders.length}`, `${selectedCount} of ${visibleOrders.length} selected`) : label(`تحديد الكل (${visibleOrders.length})`, `Select all (${visibleOrders.length})`)}</span>
        </label>
        ${selectedCount ? `<button type="button" id="pmClearSelectionBtn" class="font-bold text-blue-400 underline">${label("إلغاء التحديد", "Clear")}</button>` : ""}
        <div class="ms-auto flex flex-wrap items-center gap-2">
          ${selectedCount && canPlanPmOrders() ? `
            <button type="button" id="pmBulkDowntimeOn" class="rounded-lg border border-rose-500/50 bg-rose-500/20 px-3 py-2 font-bold text-rose-200 hover:bg-rose-500/30">⚡ ${label("علّم توقف الخط", "Mark downtime")}</button>
            <button type="button" id="pmBulkDowntimeOff" class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-bold text-gray-300 hover:bg-gray-700">${label("إلغاء التوقف", "Unmark")}</button>` : ""}
          <button type="button" onclick="window.printPmCards()" class="rounded-lg bg-slate-600 px-3 py-2 font-bold text-white hover:bg-slate-500">🖨️ ${label("كروت PM", "PM cards")} (${scopeCount})</button>
          ${canExportPmOrders() ? `
            <button type="button" onclick="window.exportPmOrders('excel')" class="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white hover:bg-emerald-600">📊 Excel (${scopeCount})</button>
            <button type="button" onclick="window.exportPmOrders('pdf')" class="rounded-lg bg-rose-700 px-3 py-2 font-bold text-white hover:bg-rose-600">📄 PDF (${scopeCount})</button>` : ""}
        </div>
      </div>

      ${visibleOrders.length ? `
        <div class="overflow-hidden rounded-xl border border-gray-800 bg-[#1E293B]">
          <div class="hidden gap-2 border-b border-gray-800 bg-gray-800 p-3 ps-9 text-[11px] font-bold text-gray-300 md:grid ${GRID_COLS}">
            <span>${label("الأمر / البلاغ", "Order / ticket")}</span><span>${label("المعدة / الخط", "Machine / line")}</span><span>${label("موعد التنفيذ", "Planned")}</span><span>${label("الفني", "Technician")}</span><span>${label("الحالة", "Status")}</span><span>${label("الإجراء", "Action")}</span>
          </div>
          ${visibleOrders.map(orderRow).join("")}
        </div>
      ` : `<div class="rounded-xl border border-gray-800 bg-[#1E293B] p-8 text-center text-sm text-gray-400">${pmOrders.length ? label("لا توجد أوامر مطابقة للفلاتر.", "No orders match these filters.") : label("لا توجد بلاغات مصنفة PM حتى الآن.", "No tickets have been classified as PM yet.")}</div>`}
    </div>
  `;

  const on = (selector, event, handler) => container.querySelector(selector)?.addEventListener(event, handler);
  on("#pmOrdersRefresh", "click", () => window.loadPmOrdersBoard(true));
  on("#pmToggleFilters", "click", () => { filtersOpen = !showExtra; renderPmOrders(); });
  on("#pmResetFiltersBtn", "click", () => { filters = emptyFilters(); selectedOrderIds.clear(); renderPmOrders(); });
  on("#pmClearSelectionBtn", "click", () => { selectedOrderIds.clear(); renderPmOrders(); });
  on("#pmBulkDowntimeOn", "click", () => window.setPmDowntimeSelected(true));
  on("#pmBulkDowntimeOff", "click", () => window.setPmDowntimeSelected(false));
  on("#pmSelectAll", "change", event => {
    visibleOrders.forEach(order => event.target.checked ? selectedOrderIds.add(order.id) : selectedOrderIds.delete(order.id));
    renderPmOrders();
  });
  container.querySelectorAll("[data-chip]").forEach(button => button.addEventListener("click", () => {
    const key = button.dataset.chip;
    if (key === "all") { filters.quick = ""; filters.downtime = ""; }
    else if (key === "downtime") { filters.downtime = filters.downtime === "true" ? "" : "true"; }
    else { filters.quick = filters.quick === key ? "" : key; }
    renderPmOrders();
  }));
  container.querySelectorAll("[data-downtime-toggle]").forEach(button => button.addEventListener("click", () => window.togglePmDowntime(button.dataset.downtimeToggle)));
  container.querySelectorAll(".pmRowCheckbox").forEach(checkbox => checkbox.addEventListener("change", event => {
    const orderId = event.target.dataset.orderId;
    if (event.target.checked) selectedOrderIds.add(orderId); else selectedOrderIds.delete(orderId);
    renderPmOrders();
  }));

  const filterFields = {
    pmFilterSearch: "search", pmFilterLine: "line", pmFilterMachine: "machine",
    pmFilterPriority: "priority", pmFilterFrom: "from", pmFilterTo: "to",
    pmFilterStatus: "status", pmFilterAssignment: "assignment", pmFilterDowntime: "downtime"
  };
  for (const [elementId, filterName] of Object.entries(filterFields)) {
    container.querySelector(`#${elementId}`)?.addEventListener(elementId === "pmFilterSearch" ? "input" : "change", event => {
      filters[filterName] = event.target.value;
      renderPmOrders();
    });
  }

  if (focusId) {
    const el = container.querySelector(`#${focusId}`);
    if (el) {
      el.focus();
      if (caret !== null && el.setSelectionRange) { try { el.setSelectionRange(caret, caret); } catch (_) { /* غير مدعوم لهذا النوع */ } }
    }
  }
}

// ============================================================
// كارت PM ميداني للطباعة
// ============================================================

const DEFAULT_PM_TASKS = () => [
  label("فحص ضغط الهيدروليك", "Check hydraulic pressure"),
  label("تنظيف الفلاتر ونظام التبريد", "Clean filters & cooling system"),
  label("التشحيم والتزييت الدوري", "Periodic lubrication")
];

function pmCardHtml(order) {
  const e = escapeHtml;
  const status = order.pmStatus || "unplanned";
  const saved = Array.isArray(order.pmTasks) && order.pmTasks.length ? order.pmTasks : null;
  const rows = saved
    ? saved.map(t => ({ desc: t.description, st: t.status, reason: t.reason }))
    : [...(order.description ? [order.description] : []), ...DEFAULT_PM_TASKS()].map(desc => ({ desc, st: "", reason: "" }));
  const box = on => (on ? "☑" : "☐");
  const notes = [order.maintenanceNotes, order.delayReason].filter(Boolean).join(" | ");
  const ticketRef = [order.issueId || order.id, order.originalUnifiedNumber].filter(Boolean).join(" · ");
  const field = (name, value) => `<td class="k">${name}</td><td class="v">${e(value || "—")}</td>`;
  return `
  <section class="pm-card" dir="${isEn() ? "ltr" : "rtl"}">
    <div class="hd"><div><div class="t">${label("بطاقة صيانة وقائية (PM)", "Preventive Maintenance (PM) Card")}</div><div class="s">${label("طُبعت", "Printed")}: ${e(formatDisplayDate(new Date().toISOString()))}</div></div><div class="n">${e(orderNumber(order))}</div></div>
    <table class="info"><tr>${field(label("البلاغ الأصلي", "Original ticket"), ticketRef)}${field(label("موعد التنفيذ", "Planned date"), formatDisplayDate(order.plannedDate) || unscheduledLabel())}</tr>
      <tr>${field(label("الخط", "Line"), order.line)}${field(label("المعدة", "Equipment"), order.machine)}</tr>
      <tr>${field(label("الفني", "Technician"), order.assignedTo || "")}${field(label("توقف الخط", "Line downtime"), isDowntime(order) ? label("مطلوب ⚡", "Required ⚡") : label("غير مطلوب", "Not required"))}</tr></table>
    <table class="tasks"><thead><tr><th style="width:24px">#</th><th>${label("مهام الصيانة", "Maintenance tasks")}</th><th style="width:54px">${label("تم", "Done")}</th><th style="width:64px">${label("لم يتم", "Not done")}</th><th style="width:30%">${label("السبب / ملاحظة", "Reason / note")}</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${e(r.desc)}</td><td class="c">${box(r.st === "done")}</td><td class="c">${box(r.st === "not_done")}</td><td>${e(r.reason || "")}</td></tr>`).join("")}
    </tbody></table>
    <div class="res"><b>${label("نتيجة التنفيذ", "Result")}:</b> ${box(status === "completed")} ${label("مكتمل", "Completed")} &nbsp; ${box(status === "completed_partial")} ${label("مكتمل جزئياً", "Partial")} &nbsp; ${box(status === "deferred")} ${label("مؤجل", "Deferred")}</div>
    <div class="notes"><b>${label("ملاحظات", "Notes")}:</b> ${e(notes)}</div>
    <div class="sig"><div>${label("الفني المنفذ", "Technician")}: ..................</div><div>${label("المشرف", "Supervisor")}: ..................</div><div>${label("التاريخ / الوقت", "Date / time")}: ............</div></div>
  </section>`;
}

const PM_CARD_CSS = `
  #pmCardOverlay .pm-card{background:#fff;color:#111;border:1.5px solid #111;border-radius:6px;padding:12px;margin:0 auto 12px;font-family:Tahoma,Arial,sans-serif;font-size:12px;break-inside:avoid}
  #pmCardOverlay .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px}
  #pmCardOverlay .t{font-size:15px;font-weight:700}#pmCardOverlay .s{font-size:10px;color:#555}
  #pmCardOverlay .n{font-size:20px;font-weight:800;font-family:monospace;border:2px solid #111;padding:2px 10px;border-radius:4px}
  #pmCardOverlay table{width:100%;border-collapse:collapse}
  #pmCardOverlay .info td{border:1px solid #888;padding:4px 6px}#pmCardOverlay .info .k{background:#eee;font-weight:700;width:16%}#pmCardOverlay .info .v{width:34%}
  #pmCardOverlay .tasks{margin-top:8px}#pmCardOverlay .tasks th,#pmCardOverlay .tasks td{border:1px solid #888;padding:6px}#pmCardOverlay .tasks th{background:#ddd}
  #pmCardOverlay .c{text-align:center;font-size:16px}
  #pmCardOverlay .res,#pmCardOverlay .notes{margin-top:8px;border:1px solid #888;padding:6px}#pmCardOverlay .notes{min-height:44px}
  #pmCardOverlay .sig{display:flex;justify-content:space-between;gap:8px;margin-top:14px;font-size:11px}
  @media print{
    body > *:not(#pmCardOverlay){display:none !important}
    #pmCardOverlay{position:static !important;inset:auto !important;overflow:visible !important;background:#fff !important;padding:0 !important}
    #pmCardOverlay .no-print{display:none !important}
    #pmCardOverlay .pm-card{margin:0 0 8mm;border-radius:0}
    @page{size:A4;margin:10mm}
  }`;

function onPmCardKey(event) { if (event.key === "Escape") closePmCards(); }
function closePmCards() {
  document.getElementById("pmCardOverlay")?.remove();
  document.removeEventListener("keydown", onPmCardKey);
}

function openPmCards(orders) {
  if (!orders.length) {
    alert(label("لا توجد أوامر لطباعتها.", "No orders to print."));
    return;
  }
  if (orders.length > 30 && !confirm(label(`سيتم تجهيز ${orders.length} كارت. متابعة؟`, `Prepare ${orders.length} cards. Continue?`))) return;
  closePmCards();
  const overlay = document.createElement("div");
  overlay.id = "pmCardOverlay";
  overlay.className = "fixed inset-0 z-[120] overflow-auto bg-gray-200 p-3";
  overlay.innerHTML = `<style>${PM_CARD_CSS}</style>
    <div class="no-print mx-auto mb-3 flex max-w-3xl items-center justify-between gap-2" dir="${isEn() ? "ltr" : "rtl"}">
      <span class="text-sm font-bold text-gray-800">${label("معاينة كروت PM", "PM cards preview")} (${orders.length})</span>
      <div class="flex gap-2">
        <button type="button" data-pm-card-act="print" class="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500">🖨️ ${label("طباعة", "Print")}</button>
        <button type="button" data-pm-card-act="close" class="rounded-lg bg-gray-700 px-4 py-2 text-xs font-bold text-white hover:bg-gray-600">✕ ${label("إغلاق", "Close")}</button>
      </div>
    </div>
    <div class="mx-auto max-w-3xl">${orders.map(pmCardHtml).join("")}</div>`;
  overlay.addEventListener("click", event => {
    const button = event.target.closest("[data-pm-card-act]");
    if (!button) return;
    if (button.dataset.pmCardAct === "print") window.print(); else closePmCards();
  });
  document.body.appendChild(overlay);
  document.addEventListener("keydown", onPmCardKey);
}

window.printPmCard = function(ticketId) {
  const order = pmOrders.find(item => item.id === ticketId);
  if (order) openPmCards([order]);
};

// المحدد (من المعروض) وإلا كل النتائج المعروضة
window.printPmCards = function() {
  const filtered = filteredPmOrders();
  const selected = filtered.filter(order => selectedOrderIds.has(order.id));
  openPmCards(selected.length ? selected : filtered);
};

// ============================================================
// تحديد أوامر توقف الخط
// ============================================================

window.togglePmDowntime = async function(ticketId) {
  if (!canPlanPmOrders()) {
    alert(label("ليست لديك صلاحية تعديل توقف الخط.", "You are not allowed to change line downtime."));
    return;
  }
  const order = pmOrders.find(item => item.id === ticketId);
  if (!order) return;
  const next = !isDowntime(order);
  const result = await setPmDowntimeApi([ticketId], next);
  if (result.status === "success") {
    order.downtimeRequired = next;
    renderPmOrders();
  } else {
    alert(`${label("تعذر التحديث:", "Update failed:")} ${result.message || ""}`);
  }
};

window.setPmDowntimeSelected = async function(value) {
  if (!canPlanPmOrders()) return;
  const targets = visibleOrders.filter(order => selectedOrderIds.has(order.id) && order.pmStatus !== "completed_partial");
  if (!targets.length) {
    alert(label("حدد أوامر أولاً.", "Select orders first."));
    return;
  }
  const result = await setPmDowntimeApi(targets.map(order => order.id), value);
  if (result.status !== "success") {
    alert(`${label("تعذر التحديث:", "Update failed:")} ${result.message || ""}`);
    return;
  }
  targets.forEach(order => { order.downtimeRequired = value; });
  if (result.data.failed) alert(label(`تم تحديث ${result.data.updated} وتعذر ${result.data.failed}.`, `${result.data.updated} updated, ${result.data.failed} failed.`));
  renderPmOrders();
};

export const PmOrdersView = () => `
  <section class="app-page space-y-3 p-3 pb-24 text-white sm:p-5" dir="${isEn() ? "ltr" : "rtl"}">
    <div>
      <h2 class="flex items-center gap-2 text-lg font-black text-blue-400">
        <span>🗓️</span>
        <span>${label("أوامر الصيانة الوقائية (PM)", "Preventive Maintenance Orders (PM)")}</span>
      </h2>
      <p class="mt-1 text-xs text-gray-400">${label("تخطيط وتنفيذ أوامر PM وطباعة كروت الفنيين وتصدير أوامر توقف الخط.", "Plan and execute PM orders, print technician cards and export line-downtime orders.")}</p>
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
  filters = { ...emptyFilters(), ...presetFilters };
  selectedOrderIds.clear();
  if (typeof window.navigateTo === "function") {
    window.navigateTo("pmOrders");
  }
};

let unsubscribePmOrders = null;

window.cleanupPmOrdersBoard = function() {
  closePmTasksModal();
  closePmCards();
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
    title: `${label("تخطيط أمر PM", "Plan PM order")} · ${orderNumber(order)}`,
    submitLabel: label("حفظ", "Save"),
    fields: [
      { id: "plannedDate", label: label("موعد التنفيذ", "Planned date"), type: "date", defaultValue: dateValue(order.plannedDate) },
      { id: "assignedTo", label: label("الفني", "Technician"), type: "select", defaultValue: order.assignedToUid ? `${order.assignedToUid}::${order.assignedTo}` : "", options: technicianOptions },
      { id: "downtimeRequired", label: label("توقف الخط", "Line downtime"), type: "select", defaultValue: order.downtimeRequired === true ? "true" : "false", options: [{ value: "false", label: label("غير مطلوب", "Not required") }, { value: "true", label: label("مطلوب ⚡", "Required ⚡") }] },
      { id: "pmStatus", label: label("الحالة", "Status"), type: "select", defaultValue: order.pmStatus || "unplanned", options: ["unplanned", "planned", "in_progress", "completed", "deferred"].map(status => ({ value: status, label: pmStatusLabel(status) })) },
      { id: "maintenanceNotes", label: label("ملاحظات", "Notes"), type: "textarea", defaultValue: order.maintenanceNotes || "" },
      { id: "delayReason", label: label("سبب التأجيل (إن وجد)", "Delay reason (if any)"), type: "textarea", defaultValue: order.delayReason || "" }
    ]
  });
  if (!values) return;
  const [assignedToUid, ...assignedNameParts] = String(values.assignedTo || "").split("::");
  const plannedDate = String(values.plannedDate || "").trim();
  // الحالة تتبع وجود الموعد تلقائياً لتقليل الخطوات
  let pmStatus = values.pmStatus;
  if (pmStatus === "unplanned" && plannedDate) pmStatus = "planned";
  else if (pmStatus === "planned" && !plannedDate) pmStatus = "unplanned";
  pmOrderSaving = true;
  let result;
  try {
    result = await updatePmOrderApi(ticketId, {
      line: order.line || "",
      machine: order.machine || "",
      location: order.location || "",
      priority: order.priority || "Medium",
      plannedDate,
      pmStatus,
      assignedTo: assignedNameParts.join("::") || "",
      assignedToUid: assignedToUid || "",
      downtimeRequired: values.downtimeRequired === "true",
      maintenanceNotes: values.maintenanceNotes,
      delayReason: values.delayReason
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

window.executePmTasks = async function(ticketId) {
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
    // لا مهام بعد: تُهيَّأ المهام الافتراضية تلقائياً (خطوة واحدة بدل زر منفصل)
    if (!isPmEditable(order)) {
      alert(label("لا توجد مهام لهذا الأمر.", "This order has no tasks."));
      return;
    }
    const initResult = await initializePmTasksApi(ticketId);
    if (initResult.status !== "success") {
      alert(`${label("فشل التهيئة:", "Initialization failed:")} ${initResult.message || ""}`);
      return;
    }
    order.pmTasks = initResult.data;
    if ((order.pmStatus || "unplanned") === "unplanned") order.pmStatus = "planned";
    renderPmOrders();
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

  const isDowntimeFocus = filters.downtime === "true" || (hasSelected && data.every(isDowntime));
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
