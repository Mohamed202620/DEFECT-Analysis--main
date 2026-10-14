import { openActionModal } from "../components/ActionModal.js";
import { fetchTechniciansApi } from "../services/usersApi.js";
import { exportToExcel, exportToPdf } from "../services/exportUtility.js";
import {
  fetchPmOrdersApi,
  subscribeToPmOrdersApi,
  updatePmOrderApi,
  setPmDowntimeApi,
  initializePmTasksApi,
  addPmTaskApi,
  deletePmTaskApi,
  updatePmTaskApi,
  completePmOrderApi,
  createFollowupFromRemainingTasksApi,
  reschedulePmTasksApi,
  PM_FREQUENCIES,
  getFrequencyLabel,
  calculateNextDueDate,
  calculateDueStatus,
  fetchPmPlansApi,
  subscribeToPmPlansApi,
  savePmPlanApi,
  deletePmPlanApi,
  savePmExecutionApi,
  fetchPmExecutionsApi
} from "../services/api.js";
import { escapeHtml, escapeJsArg } from "../utils/escapeHtml.js";
import { loadScriptWithFallback } from "../utils/loadExternalScript.js";
import { hasFullDataAccess, hasPermission, isAdminRole } from "../permissions.js";
import { getMachineTypeEntries } from "../machines.js";

let pmOrders = [];
let visibleOrders = [];
let selectedOrderIds = new Set();
const emptyFilters = () => ({ search: "", line: "", machine: "", from: "", to: "", priority: "", status: "", assignment: "", downtime: "", quick: "" });
let filters = emptyFilters();
let filtersOpen = false;

let activePmTab = "plans"; // "plans" | "downtime" | "assigned"
let pmPlans = [];
let plansSearch = "";
let plansLineFilter = "";
let plansStatusFilter = "";

let downtimeSelectedLine = "Line 1";
let downtimeSelectedMachine = "";

function getAllAvailableMachines(lineFilter = "") {
  try {
    const entries = getMachineTypeEntries({ includeInactive: false, filterByUserDepartment: false });
    const list = [];
    entries.forEach(m => {
      const mLine = m.line ? (String(m.line).startsWith("Line") ? String(m.line) : `Line ${m.line}`) : "";
      const filterNormalized = lineFilter ? (String(lineFilter).startsWith("Line") ? String(lineFilter) : `Line ${lineFilter}`) : "";
      if (filterNormalized && mLine && mLine !== filterNormalized) return;
      if (m.units && m.units.length) {
        m.units.forEach(u => list.push({ name: `${m.key} ${u}`, key: m.key, unit: u, department: m.department || "backend", line: mLine || filterNormalized || "Line 1" }));
      } else {
        list.push({ name: m.key, key: m.key, unit: "", department: m.department || "backend", line: mLine || filterNormalized || "Line 1" });
      }
    });
    return list;
  } catch (err) {
    console.warn("Could not get machine entries:", err);
    return [];
  }
}

function preparePlanAsCard(plan) {
  return {
    id: plan.id,
    unifiedNumber: `PLAN-${(plan.line || "L1").replace(/\\s+/g, "")}-${plan.machine}`,
    issueId: plan.id,
    maintenanceType: "PM",
    line: plan.line || "Line 1",
    machine: plan.machine,
    location: plan.department === "frontend" ? label("قسم Front-End", "Front-End Area") : label("قسم Back-End", "Back-End Area"),
    description: `${label("خطة صيانة وقائية دورية", "Periodic Preventive Maintenance Plan")} (${plan.frequencyLabel || plan.frequency})`,
    priority: "High",
    pmStatus: plan.lastExecution?.result || "planned",
    plannedDate: plan.nextDueDate,
    assignedTo: plan.lastExecution?.technicianName || label("فريق الصيانة الدورية", "Periodic PM Team"),
    downtimeRequired: true,
    pmTasks: (plan.tasks || []).map((t, idx) => ({
      id: t.id || `task_${idx + 1}`,
      description: t.text || t.description,
      status: "pending"
    })),
    maintenanceNotes: plan.notes || (plan.frequencyLabel ? `${label("دورية الصيانة:", "Frequency:")} ${plan.frequencyLabel}` : "")
  };
}

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

window.switchPmTab = function(tabName) {
  activePmTab = tabName;
  renderPmOrders();
};

window.selectDowntimeLine = function(line) {
  downtimeSelectedLine = line;
  downtimeSelectedMachine = "";
  renderPmOrders();
};

window.selectDowntimeMachine = function(machine) {
  downtimeSelectedMachine = machine;
  renderPmOrders();
};

function renderPlanCard(plan) {
  const e = escapeHtml;
  const dueInfo = calculateDueStatus(plan.nextDueDate, plan.lastExecution?.executedAt);
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const freqLabel = plan.frequencyLabel || getFrequencyLabel(plan.frequency, plan.customDays);
  const lastExec = plan.lastExecution;

  const lastExecText = lastExec?.executedAt
    ? `${formatDisplayDate(lastExec.executedAt)} (${escapeHtml(lastExec.technicianName || lastExec.executedBy || "")})`
    : label("لم يُسجل تنفيذ بعد", "Never executed");

  const lastResultBadge = lastExec?.result === "completed"
    ? `<span class="text-emerald-400 font-bold text-[10px]">✅ ${label("مكتمل", "Done")}</span>`
    : lastExec?.result === "completed_partial"
    ? `<span class="text-amber-400 font-bold text-[10px]">⚠️ ${label("جزئي", "Partial")}</span>`
    : lastExec?.result === "deferred"
    ? `<span class="text-rose-400 font-bold text-[10px]">⏸️ ${label("مؤجل", "Deferred")}</span>`
    : "";

  return `
    <div class="rounded-xl border border-gray-800 bg-[#1E293B] hover:border-gray-700 transition p-4 space-y-3 flex flex-col justify-between shadow-md">
      <div>
        <div class="flex items-start justify-between gap-2 border-b border-gray-800/80 pb-2.5">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-base font-black text-white">${e(plan.machine)}</span>
              <span class="rounded px-1.5 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">${e(plan.line || "Line 1")}</span>
            </div>
            <div class="text-[11px] text-gray-400 mt-0.5">
              ${plan.department === "frontend" ? "Front-End" : "Back-End"} · ⏱️ ${plan.estimatedDurationMinutes || 30} ${label("دقيقة", "min")}
            </div>
          </div>
          <span class="rounded px-2 py-0.5 text-[10px] font-bold ${dueInfo.badgeClass} whitespace-nowrap">
            ${dueInfo.label}
          </span>
        </div>

        <div class="mt-2.5 space-y-1.5 text-xs">
          <div class="flex justify-between items-center text-gray-300">
            <span class="text-gray-400 font-medium">${label("الدورية:", "Frequency:")}</span>
            <span class="font-bold text-amber-300">🔄 ${e(freqLabel)}</span>
          </div>

          <div class="flex justify-between items-center text-gray-300">
            <span class="text-gray-400 font-medium">${label("آخر تنفيذ:", "Last Run:")}</span>
            <span class="text-gray-200 text-[11px] flex items-center gap-1">
              ${lastExecText} ${lastResultBadge}
            </span>
          </div>

          <div class="flex justify-between items-center text-gray-300">
            <span class="text-gray-400 font-medium">${label("الموعد القادم:", "Next Due:")}</span>
            <span class="font-bold ${dueInfo.status === 'overdue' ? 'text-red-400 font-black' : 'text-emerald-300'}">
              📅 ${formatDisplayDate(plan.nextDueDate) || unscheduledLabel()}
            </span>
          </div>
        </div>

        <!-- قائمة المهام مختصرة -->
        <div class="mt-3 bg-[#0F172A] rounded-lg p-2.5 border border-gray-800/80">
          <div class="flex items-center justify-between text-[11px] font-bold text-gray-300 mb-1.5">
            <span>📋 ${label("مهام الصيانة المحددة", "Maintenance Tasks")} (${tasks.length})</span>
          </div>
          <ul class="text-[11px] text-gray-400 space-y-1">
            ${tasks.slice(0, 3).map((t, idx) => `
              <li class="truncate flex items-center gap-1.5">
                <span class="text-blue-400 text-[9px]">▪</span>
                <span>${idx + 1}. ${e(t.text || t.description || "")}</span>
              </li>
            `).join("")}
            ${tasks.length > 3 ? `<li class="text-[10px] text-gray-500 italic">+ ${tasks.length - 3} ${label("مهام إضافية...", "more tasks...")}</li>` : ""}
          </ul>
        </div>
      </div>

      <!-- أزرار الإجراءات -->
      <div class="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-800">
        <button
          type="button"
          onclick="window.openRecordPmExecutionModal('${escapeJsArg(plan.id)}')"
          class="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[11px] transition text-center"
        >
          ▶️ ${label("تسجيل تنفيذ", "Execute")}
        </button>

        <button
          type="button"
          onclick="window.printMachinePmPlanCard('${escapeJsArg(plan.id)}')"
          title="${label("طباعة كارت PM للمعدة", "Print PM Card")}"
          class="py-1.5 px-2.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-bold text-[11px] transition"
        >
          🖨️
        </button>

        ${canPlanPmOrders() ? `
          <button
            type="button"
            onclick="window.openAddEditPlanModal('${escapeJsArg(plan.id)}')"
            title="${label("تعديل الخطة والمهام", "Edit Plan & Tasks")}"
            class="py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition"
          >
            ✏️
          </button>
        ` : ""}

        <button
          type="button"
          onclick="window.openPmExecutionsHistoryModal('${escapeJsArg(plan.id)}')"
          title="${label("سجل التنفيذات السابقة", "Execution History")}"
          class="py-1.5 px-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold text-[11px] transition"
        >
          📜
        </button>

        ${isAdminRole() ? `
          <button
            type="button"
            onclick="window.deletePmPlan('${escapeJsArg(plan.id)}')"
            title="${label("حذف الخطة", "Delete Plan")}"
            class="py-1.5 px-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:border-red-500 hover:text-red-300 text-[11px] transition"
          >
            🗑️
          </button>
        ` : ""}
      </div>
    </div>
  `;
}

function renderPeriodicPlansTabHtml() {
  const q = plansSearch.trim().toLowerCase();
  const filteredPlans = pmPlans.filter(p => {
    const matchSearch = !q || [p.machine, p.line, p.department, p.notes, ...(p.tasks || []).map(t => t.text)].some(v => String(v || "").toLowerCase().includes(q));
    const matchLine = !plansLineFilter || p.line === plansLineFilter;
    const dueInfo = calculateDueStatus(p.nextDueDate, p.lastExecution?.executedAt);
    const matchStatus = !plansStatusFilter || (
      plansStatusFilter === "overdue" ? (dueInfo.status === "overdue" || dueInfo.status === "due_today") :
      plansStatusFilter === "upcoming" ? dueInfo.status === "upcoming" :
      plansStatusFilter === "never" ? dueInfo.status === "never_executed" : true
    );
    return matchSearch && matchLine && matchStatus;
  });

  const totalPlans = pmPlans.length;
  const overdueCount = pmPlans.filter(p => ["overdue", "due_today"].includes(calculateDueStatus(p.nextDueDate, p.lastExecution?.executedAt).status)).length;
  const upcomingCount = pmPlans.filter(p => calculateDueStatus(p.nextDueDate, p.lastExecution?.executedAt).status === "upcoming").length;
  const pendingFirst = pmPlans.filter(p => calculateDueStatus(p.nextDueDate, p.lastExecution?.executedAt).status === "never_executed").length;

  return `
    <div class="space-y-4">
      <!-- شريط الإحصائيات السريعة -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div class="bg-[#0F172A] border border-gray-700/80 rounded-xl p-3 text-center">
          <div class="text-[11px] text-gray-400 font-bold">${label("إجمالي خطط الماكينات", "Total Machine Plans")}</div>
          <div class="text-xl font-black text-blue-400 mt-1">${totalPlans}</div>
        </div>
        <div class="bg-[#0F172A] border border-red-500/30 rounded-xl p-3 text-center">
          <div class="text-[11px] text-red-300 font-bold">${label("مستحق الآن / متأخر", "Due Now / Overdue")}</div>
          <div class="text-xl font-black text-red-400 mt-1">${overdueCount}</div>
        </div>
        <div class="bg-[#0F172A] border border-emerald-500/30 rounded-xl p-3 text-center">
          <div class="text-[11px] text-emerald-300 font-bold">${label("ساري ومجدول", "Scheduled / Up-to-date")}</div>
          <div class="text-xl font-black text-emerald-400 mt-1">${upcomingCount}</div>
        </div>
        <div class="bg-[#0F172A] border border-amber-500/30 rounded-xl p-3 text-center">
          <div class="text-[11px] text-amber-300 font-bold">${label("بانتظار أول تنفيذ", "Pending First Run")}</div>
          <div class="text-xl font-black text-amber-400 mt-1">${pendingFirst}</div>
        </div>
      </div>

      <!-- شريط البحث والفلاتر + زر إضافة خطة -->
      <div class="flex flex-wrap items-center gap-2 bg-[#1E293B] p-3 rounded-xl border border-gray-800">
        <input
          id="pmPlanSearchInput"
          type="text"
          value="${escapeHtml(plansSearch)}"
          placeholder="🔍 ${label("بحث بالماكينة أو الخط أو المهمة...", "Search machine, line, task...")}"
          class="flex-1 min-w-[200px] p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />

        <select id="pmPlanLineSelect" class="p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white">
          <option value="">${label("كل الخطوط", "All Lines")}</option>
          <option value="Line 1" ${plansLineFilter === "Line 1" ? "selected" : ""}>Line 1</option>
          <option value="Line 2" ${plansLineFilter === "Line 2" ? "selected" : ""}>Line 2</option>
        </select>

        <select id="pmPlanStatusSelect" class="p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white">
          <option value="">${label("كل الحالات", "All Statuses")}</option>
          <option value="overdue" ${plansStatusFilter === "overdue" ? "selected" : ""}>🔴 ${label("مستحق الآن / متأخر", "Due / Overdue")}</option>
          <option value="upcoming" ${plansStatusFilter === "upcoming" ? "selected" : ""}>🟢 ${label("ساري ومجدول", "Scheduled")}</option>
          <option value="never" ${plansStatusFilter === "never" ? "selected" : ""}>⚪ ${label("بانتظار أول تنفيذ", "Pending First")}</option>
        </select>

        ${canPlanPmOrders() ? `
          <button
            type="button"
            onclick="window.openAddEditPlanModal()"
            class="ms-auto flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs py-2 px-3.5 rounded-lg transition shadow-md shadow-blue-500/20"
          >
            <span>➕</span>
            <span>${label("إضافة خطة PM جديدة", "Add New PM Plan")}</span>
          </button>
        ` : ""}
      </div>

      <!-- قائمة الخطط -->
      ${filteredPlans.length ? `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          ${filteredPlans.map(renderPlanCard).join("")}
        </div>
      ` : `
        <div class="rounded-xl border border-gray-800 bg-[#1E293B] p-10 text-center space-y-3">
          <div class="text-3xl">📋</div>
          <div class="text-sm font-bold text-gray-200">
            ${pmPlans.length ? label("لا توجد خطط PM مطابقة للفلاتر.", "No PM plans match these filters.") : label("لم يتم إنشاء خطط PM دورية للماكينات بعد.", "No periodic PM plans created yet.")}
          </div>
          <p class="text-xs text-gray-400 max-w-md mx-auto">
            ${label("أنشئ خطة صيانة وقائية دورية مستقلة لكل ماكينة مع تحديد مهامها ودوريتها ومواعيد استحقاقها.", "Create an independent periodic PM plan for each machine with its tasks, frequency, and due dates.")}
          </p>
          ${canPlanPmOrders() ? `
            <button
              type="button"
              onclick="window.openAddEditPlanModal()"
              class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition shadow-lg shadow-blue-500/20"
            >
              <span>➕</span>
              <span>${label("إنشاء خطة PM الآن", "Create PM Plan Now")}</span>
            </button>
          ` : ""}
        </div>
      `}
    </div>
  `;
}

function renderLineDowntimeTabHtml() {
  const e = escapeHtml;
  const line = downtimeSelectedLine || "Line 1";
  const lineMachines = getAllAvailableMachines(line);

  // إذا لم تكن الماكينة المختارة ضمن ماكينات هذا الخط، اختر أول ماكينة
  if (!downtimeSelectedMachine && lineMachines.length) {
    downtimeSelectedMachine = lineMachines[0].name;
  }

  const selectedMachine = downtimeSelectedMachine || (lineMachines[0]?.name || "");
  const plan = pmPlans.find(p => p.machine === selectedMachine && (p.line === line || !p.line));

  // أوامر PM المسندة من الأعطال المفتوحة لنفس الخط والماكينة
  const machineAssignedOrders = pmOrders.filter(order => {
    return order.machine === selectedMachine && (order.line === line || !order.line) && isOpenOrder(order);
  });

  return `
    <div class="space-y-4">
      <!-- لافتة توجيه العمل الميداني السريع -->
      <div class="bg-gradient-to-r from-amber-950/70 via-[#1E293B] to-[#0F172A] border border-amber-500/40 rounded-2xl p-4 text-xs text-amber-200 flex items-start gap-3 shadow-lg">
        <span class="text-2xl shrink-0">⚡</span>
        <div class="space-y-1">
          <div class="font-bold text-sm text-amber-300">
            ${label("استخراج PM الميداني السريع عند توقف الخط", "Quick Field PM Extraction on Line Stoppage")}
          </div>
          <p class="text-gray-300 leading-relaxed text-[11px]">
            ${label("اختر خط الإنتاج ثم المعدة لعرض خطة الصيانة الوقائية وبطاقة العمل وتصديرها أو طباعتها فوراً، واستعراض أوامر الأعطال المسندة لنفس المعدة لتنفيذها أثناء التوقف.", "Select the line and machine to instantly view the PM plan, print or export the work card (PDF/Excel), and review open assigned PM breakdown orders to execute during downtime.")}
          </p>
        </div>
      </div>

      <!-- اختيار الخط والمعدة -->
      <div class="bg-[#1E293B] border border-gray-800 rounded-2xl p-4 space-y-3 shadow-md">
        <div class="text-xs font-bold text-gray-300 flex items-center gap-2">
          <span>1️⃣</span>
          <span>${label("اختر خط الإنتاج:", "Select Production Line:")}</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            onclick="window.selectDowntimeLine('Line 1')"
            class="py-3 px-4 rounded-xl font-black text-xs sm:text-sm border transition flex items-center justify-center gap-2 ${line === 'Line 1' ? 'border-amber-500 bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-600/30 scale-[1.01]' : 'border-gray-700 bg-[#0F172A] text-gray-300 hover:bg-gray-800'}"
          >
            <span>🏭</span>
            <span>Line 1 (${label("خط 1", "Line 1")})</span>
          </button>

          <button
            type="button"
            onclick="window.selectDowntimeLine('Line 2')"
            class="py-3 px-4 rounded-xl font-black text-xs sm:text-sm border transition flex items-center justify-center gap-2 ${line === 'Line 2' ? 'border-amber-500 bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-600/30 scale-[1.01]' : 'border-gray-700 bg-[#0F172A] text-gray-300 hover:bg-gray-800'}"
          >
            <span>🏭</span>
            <span>Line 2 (${label("خط 2", "Line 2")})</span>
          </button>
        </div>

        <div class="text-xs font-bold text-gray-300 flex items-center gap-2 pt-2 border-t border-gray-800">
          <span>2️⃣</span>
          <span>${label("اختر الماكينة / المعدة:", "Select Equipment / Machine:")}</span>
        </div>
        <div>
          <select
            id="downtimeMachineSelect"
            onchange="window.selectDowntimeMachine(this.value)"
            class="w-full p-3 rounded-xl bg-[#0F172A] border border-gray-700 text-white font-bold text-xs sm:text-sm focus:outline-none focus:border-amber-500 transition shadow-inner"
          >
            ${lineMachines.map(m => `
              <option value="${e(m.name)}" ${m.name === selectedMachine ? "selected" : ""}>
                ⚙️ ${e(m.name)} (${m.department === "frontend" ? "Front-End" : "Back-End"})
              </option>
            `).join("")}
          </select>
        </div>
      </div>

      <!-- تفاصيل الماكينة المختارة وخطة PM وأوامر الأعطال -->
      ${selectedMachine ? `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- كارت خطة PM الدورية للمعدة (عمودان على الديسكتوب) -->
          <div class="lg:col-span-2 bg-[#1E293B] border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-black text-blue-400">⚙️ ${e(selectedMachine)}</h3>
                  <span class="rounded px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">${e(line)}</span>
                </div>
                <div class="text-[11px] text-gray-400 mt-1">
                  ${label("خطة الصيانة الوقائية الدورية للمعدة", "Periodic Preventive Maintenance Plan")}
                </div>
              </div>

              ${plan ? `
                <span class="rounded px-2.5 py-1 text-xs font-bold ${calculateDueStatus(plan.nextDueDate, plan.lastExecution?.executedAt).badgeClass}">
                  ${calculateDueStatus(plan.nextDueDate, plan.lastExecution?.executedAt).label}
                </span>
              ` : `
                <span class="rounded px-2.5 py-1 text-xs font-bold bg-gray-700 text-gray-300">
                  ${label("لا توجد خطة مسجلة", "No plan recorded")}
                </span>
              `}
            </div>

            ${plan ? `
              <!-- بيانات دورية الخطة وتاريخها -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div class="bg-[#0F172A] p-2.5 rounded-lg border border-gray-800">
                  <div class="text-[10px] text-gray-400">${label("الدورية", "Frequency")}</div>
                  <div class="font-bold text-amber-300 mt-0.5">🔄 ${e(plan.frequencyLabel || plan.frequency)}</div>
                </div>
                <div class="bg-[#0F172A] p-2.5 rounded-lg border border-gray-800">
                  <div class="text-[10px] text-gray-400">${label("الموعد القادم", "Next Due")}</div>
                  <div class="font-bold text-emerald-300 mt-0.5">📅 ${formatDisplayDate(plan.nextDueDate)}</div>
                </div>
                <div class="bg-[#0F172A] p-2.5 rounded-lg border border-gray-800">
                  <div class="text-[10px] text-gray-400">${label("آخر تنفيذ", "Last Execution")}</div>
                  <div class="font-bold text-gray-200 mt-0.5 truncate">${plan.lastExecution?.executedAt ? formatDisplayDate(plan.lastExecution.executedAt) : label("لم ينفذ بعد", "None")}</div>
                </div>
                <div class="bg-[#0F172A] p-2.5 rounded-lg border border-gray-800">
                  <div class="text-[10px] text-gray-400">${label("المدة المقدرة", "Duration")}</div>
                  <div class="font-bold text-gray-200 mt-0.5">⏱️ ${plan.estimatedDurationMinutes || 30} ${label("دقيقة", "min")}</div>
                </div>
              </div>

              <!-- جدول مهام الصيانة الوقائية -->
              <div class="space-y-2">
                <div class="font-bold text-xs text-gray-200 flex items-center justify-between">
                  <span>📋 ${label("قائمة مهام الصيانة المطلوب فحصها:", "Required Maintenance Checklist:")}</span>
                  <span class="text-[11px] text-gray-400">${(plan.tasks || []).length} ${label("مهام", "tasks")}</span>
                </div>
                <div class="overflow-x-auto rounded-xl border border-gray-800">
                  <table class="w-full text-xs text-start">
                    <thead class="bg-gray-800/90 text-[11px] text-gray-300">
                      <tr>
                        <th class="p-2.5 w-10 text-center">#</th>
                        <th class="p-2.5 text-start">${label("مهمة الصيانة الوقائية", "Maintenance Task")}</th>
                        <th class="p-2.5 w-20 text-center">${label("الحالة", "Status")}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-800 bg-[#0F172A]">
                      ${(plan.tasks || []).map((t, idx) => `
                        <tr>
                          <td class="p-2.5 text-center font-bold text-gray-400">${idx + 1}</td>
                          <td class="p-2.5 text-gray-200 font-medium">${e(t.text || t.description || "")}</td>
                          <td class="p-2.5 text-center text-gray-400">⬜ ${label("للتنفيذ", "Pending")}</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- أزرار العمليات الميدانية السريعة -->
              <div class="bg-gradient-to-r from-gray-900 via-[#1E293B] to-gray-900 p-3.5 rounded-xl border border-gray-700/80 space-y-3">
                <div class="text-[11px] font-bold text-gray-300">${label("إجراءات استخراج وتنفيذ بطاقة PM:", "PM Card Actions:")}</div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onclick="window.printMachinePmPlanCard('${escapeJsArg(plan.id)}')"
                    class="py-2.5 px-3 rounded-xl bg-slate-600 hover:bg-slate-500 active:scale-95 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow"
                  >
                    <span>🖨️</span>
                    <span>${label("طباعة كارت PM", "Print Card")}</span>
                  </button>

                  <button
                    type="button"
                    onclick="window.exportDowntimePmPlan('pdf', '${escapeJsArg(plan.id)}')"
                    class="py-2.5 px-3 rounded-xl bg-rose-700 hover:bg-rose-600 active:scale-95 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow"
                  >
                    <span>📄</span>
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    onclick="window.exportDowntimePmPlan('excel', '${escapeJsArg(plan.id)}')"
                    class="py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow"
                  >
                    <span>📊</span>
                    <span>Excel</span>
                  </button>

                  <button
                    type="button"
                    onclick="window.openRecordPmExecutionModal('${escapeJsArg(plan.id)}')"
                    class="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 col-span-2 sm:col-span-1"
                  >
                    <span>✅</span>
                    <span>${label("تسجيل التنفيذ الفعلي", "Record Run")}</span>
                  </button>
                </div>
              </div>
            ` : `
              <div class="p-6 text-center space-y-3 bg-[#0F172A] rounded-xl border border-gray-800">
                <div class="text-3xl">⚠️</div>
                <div class="text-sm font-bold text-gray-200">${label("لم يتم إنشاء خطة PM دورية لهذه الماكينة بعد.", "No periodic PM plan exists for this machine yet.")}</div>
                <p class="text-xs text-gray-400 max-w-sm mx-auto">
                  ${label("يمكنك إنشاء خطة صيانة دورية مستقلة لهذه الماكينة الآن لتحديد مهامها وتكرارها ومواعيد استحقاقها.", "Create an independent PM plan for this machine now to specify its tasks, frequency, and due dates.")}
                </p>
                ${canPlanPmOrders() ? `
                  <button
                    type="button"
                    onclick="window.openAddEditPlanModal(null, '${escapeJsArg(selectedMachine)}', '${escapeJsArg(line)}')"
                    class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition shadow"
                  >
                    <span>➕</span>
                    <span>${label("إنشاء خطة PM لهذه المعدة", "Create PM Plan")}</span>
                  </button>
                ` : ""}
              </div>
            `}

            <!-- تنبيه عدم اعتبار الاستخراج تنفيذاً -->
            <div class="text-[11px] text-gray-400 bg-[#0F172A]/70 p-3 rounded-xl border border-gray-800 flex items-center gap-2">
              <span class="text-base text-blue-400 shrink-0">ℹ️</span>
              <span>
                ${label("تنبيه إجرائي: طباعة أو تصدير كارت PM لا يعتبر تنفيذاً للصيانة. يتم تسجيل التنفيذ وتحديث موعد الصيانة القادم حصراً عند الضغط على «تسجيل نتيجة التنفيذ الفعلي» وحفظ نتيجة التنفيذ.", "Procedure notice: Printing or exporting PM card does not count as execution. Execution is recorded and next due date is updated only upon clicking 'Record Run' and submitting actual results.")}
              </span>
            </div>
          </div>

          <!-- أوامر PM المسندة من الأعطال لنفس المعدة (عمود 3 على الديسكتوب) -->
          <div class="bg-[#1E293B] border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg flex flex-col justify-between">
            <div class="space-y-3">
              <div class="flex items-center justify-between border-b border-gray-800 pb-2.5">
                <div class="font-bold text-xs text-indigo-300 flex items-center gap-1.5">
                  <span>🛠️</span>
                  <span>${label("أوامر الأعطال المسندة", "Breakdown PM Orders")}</span>
                </div>
                <span class="rounded-full bg-indigo-500/20 text-indigo-300 px-2 py-0.5 text-[10px] font-bold border border-indigo-500/30">
                  ${machineAssignedOrders.length}
                </span>
              </div>
              <p class="text-[11px] text-gray-400">
                ${label("أوامر PM المحولة من بلاغات الأعطال المفتوحة المرتبطة بنفس الماكينة والخط والمتاحة للتنفيذ أثناء توقف الخط.", "Open PM orders converted from breakdown tickets on this equipment, ready for execution during downtime.")}
              </p>

              ${machineAssignedOrders.length ? `
                <div class="space-y-2.5 max-h-[380px] overflow-y-auto">
                  ${machineAssignedOrders.map(order => `
                    <div class="p-3 rounded-xl bg-[#0F172A] border border-gray-800 hover:border-indigo-500/50 transition space-y-2 text-xs">
                      <div class="flex items-start justify-between gap-1.5">
                        <span class="font-mono font-bold text-white text-[11px]">${e(order.unifiedNumber || order.id)}</span>
                        ${pmStatusBadge(order.pmStatus)}
                      </div>
                      <div class="text-gray-300 text-[11px] font-medium line-clamp-2">${e(order.description || label("صيانة وقائية لعطل", "PM for breakdown"))}</div>
                      <div class="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-800/80">
                        <span>👤 ${e(order.assignedTo || unassignedLabel())}</span>
                        <span class="font-bold text-amber-300">${e(order.priority || "Medium")}</span>
                      </div>
                      <div class="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onclick="window.executePmTasks('${escapeJsArg(order.id)}')"
                          class="flex-1 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition text-center"
                        >
                          ▶️ ${label("تنفيذ", "Execute")}
                        </button>
                        <button
                          type="button"
                          onclick="window.printPmCard('${escapeJsArg(order.id)}')"
                          title="${label("طباعة كارت أمر العطل", "Print ticket card")}"
                          class="py-1 px-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-bold text-[10px] transition"
                        >
                          🖨️
                        </button>
                      </div>
                    </div>
                  `).join("")}
                </div>
              ` : `
                <div class="p-6 text-center text-xs text-gray-400 bg-[#0F172A] rounded-xl border border-gray-800/80">
                  <div class="text-2xl mb-1">✨</div>
                  ${label("لا توجد أوامر PM مفتوحة مسندة من الأعطال لهذه المعدة حالياً.", "No open breakdown PM orders for this equipment.")}
                </div>
              `}
            </div>

            <div class="pt-2 border-t border-gray-800 text-center">
              <button
                type="button"
                onclick="window.switchPmTab('assigned')"
                class="text-indigo-400 hover:text-indigo-300 text-[11px] font-bold underline"
              >
                ${label("الانتقال لجميع أوامر PM المسندة ←", "View All Assigned PM Orders →")}
              </button>
            </div>
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function renderAssignedOrdersTabHtml(counts, selectedVisible, selectedCount, allSelected, scopeCount, showExtra, uniq, dateInput) {
  return `
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
          <button type="button" id="pmToggleFilters" class="rounded-lg border px-3 py-2 text-xs font-bold ${filtersOpen ? "border-blue-500/60 text-blue-300" : "border-gray-700 text-gray-300"} bg-[#0F172A] hover:bg-gray-800">⚙️ ${label("المزيد", "More")}</button>
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

  const overduePlansCount = pmPlans.filter(p => ["overdue", "due_today"].includes(calculateDueStatus(p.nextDueDate, p.lastExecution?.executedAt).status)).length;
  const assignedOpenCount = pmOrders.filter(isOpenOrder).length;

  const tabsNavHtml = `
    <div class="mb-4 flex flex-wrap items-center gap-2 border-b border-gray-800 pb-3" dir="${isEn() ? "ltr" : "rtl"}">
      <button
        type="button"
        id="tabBtnPlans"
        onclick="window.switchPmTab('plans')"
        class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${activePmTab === 'plans' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'}"
      >
        <span>📋</span>
        <span>${label("خطط PM الدورية للماكينات", "Periodic PM Plans")}</span>
        <span class="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">${pmPlans.length}</span>
        ${overduePlansCount ? `<span class="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white animate-pulse">${overduePlansCount} ${label("مستحق", "due")}</span>` : ""}
      </button>

      <button
        type="button"
        id="tabBtnDowntime"
        onclick="window.switchPmTab('downtime')"
        class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${activePmTab === 'downtime' ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20' : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'}"
      >
        <span>⚡</span>
        <span>${label("استخراج PM عند توقف الخط", "Line Stoppage Quick PM")}</span>
        <span class="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-200">${label("ميداني سريع", "Quick Field")}</span>
      </button>

      <button
        type="button"
        id="tabBtnAssigned"
        onclick="window.switchPmTab('assigned')"
        class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${activePmTab === 'assigned' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'}"
      >
        <span>🛠️</span>
        <span>${label("أوامر PM المسندة من الأعطال", "Assigned PM Work Orders")}</span>
        <span class="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">${pmOrders.length}</span>
        ${assignedOpenCount ? `<span class="rounded-full bg-blue-500/30 px-1.5 py-0.5 text-[9px] text-blue-200">${assignedOpenCount} ${label("مفتوح", "open")}</span>` : ""}
      </button>
    </div>
  `;

  let contentHtml = "";
  if (activePmTab === "plans") {
    contentHtml = renderPeriodicPlansTabHtml();
  } else if (activePmTab === "downtime") {
    contentHtml = renderLineDowntimeTabHtml();
  } else {
    contentHtml = renderAssignedOrdersTabHtml(counts, selectedVisible, selectedCount, allSelected, scopeCount, showExtra, uniq, dateInput);
  }

  container.innerHTML = `
    <div class="text-start" dir="${isEn() ? "ltr" : "rtl"}">
      ${tabsNavHtml}
      ${contentHtml}
    </div>
  `;

  if (activePmTab === "plans") {
    const searchInput = container.querySelector("#pmPlanSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", event => {
        plansSearch = event.target.value;
        renderPmOrders();
      });
    }
    const lineSelect = container.querySelector("#pmPlanLineSelect");
    if (lineSelect) {
      lineSelect.addEventListener("change", event => {
        plansLineFilter = event.target.value;
        renderPmOrders();
      });
    }
    const statusSelect = container.querySelector("#pmPlanStatusSelect");
    if (statusSelect) {
      statusSelect.addEventListener("change", event => {
        plansStatusFilter = event.target.value;
        renderPmOrders();
      });
    }
  } else if (activePmTab === "assigned") {
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

let qrLibLoadPromise = null;
function loadQrCodeLib() {
  if (typeof window !== "undefined" && window.qrcode) return Promise.resolve(window.qrcode);
  if (qrLibLoadPromise) return qrLibLoadPromise;
  qrLibLoadPromise = loadScriptWithFallback(
    ['./js/vendor/qrcode-generator.js'],
    () => window.qrcode
  ).catch(err => {
    qrLibLoadPromise = null;
    throw err;
  });
  return qrLibLoadPromise;
}

function generatePmQrSvg(text, targetSize = 52) {
  if (typeof window === "undefined" || !window.qrcode) return "";
  try {
    const utf8Text = unescape(encodeURIComponent(text));
    let qr = null;
    for (let typeNumber = 1; typeNumber <= 40; typeNumber += 1) {
      try {
        qr = window.qrcode(typeNumber, 'M');
        qr.addData(utf8Text);
        qr.make();
        break;
      } catch (_) {}
    }
    if (!qr) return "";
    const moduleCount = qr.getModuleCount();
    const margin = 1;
    const total = moduleCount + margin * 2;
    const cellSize = Number((targetSize / total).toFixed(2));
    const size = Number((total * cellSize).toFixed(2));
    let paths = [];
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.isDark(r, c)) {
          paths.push(`M${((c + margin) * cellSize).toFixed(2)},${((r + margin) * cellSize).toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z`);
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-label="QR Code" style="display:block"><rect width="${size}" height="${size}" fill="#fff"/><path d="${paths.join(" ")}" fill="#000"/></svg>`;
  } catch (err) {
    console.warn("Failed to generate PM QR SVG:", err);
    return "";
  }
}

function pmCardHtml(order) {
  const e = escapeHtml;
  const status = order.pmStatus || "unplanned";
  const saved = Array.isArray(order.pmTasks) && order.pmTasks.length ? order.pmTasks : null;
  const defaultTaskDesc = (order.description || "").trim() || label("صيانة وقائية دورية", "Periodic preventive maintenance");
  // عرض المهمة الأصلية (1) فقط بشكل افتراضي دون إضافة المهام (2 و3 و4) تلقائياً،
  // مع الحفاظ على كل المهام المحفوظة فعلياً لكل أمر دون فقدان البيانات
  const rows = saved
    ? saved.map(t => ({ desc: t.description || "", st: t.status || "", reason: t.reason || "" }))
    : [{ desc: defaultTaskDesc, st: "", reason: "" }];
  const box = on => (on ? "☑" : "☐");
  const notes = [order.maintenanceNotes, order.delayReason].filter(Boolean).join(" | ");
  const ticketRef = [order.issueId || order.id, order.originalUnifiedNumber].filter(Boolean).join(" · ");
  const field = (name, value) => `<td class="k">${name}</td><td class="v">${e(value || "—")}</td>`;
  const orderNum = orderNumber(order);
  const qrSvg = generatePmQrSvg(`PM:${order.id}`, 52);

  return `
  <section class="pm-card" dir="${isEn() ? "ltr" : "rtl"}">
    <div class="hd">
      <div class="hd-info">
        <div class="t">${label("بطاقة صيانة وقائية (PM)", "Preventive Maintenance (PM) Card")}</div>
        <div class="s">${label("طُبعت", "Printed")}: ${e(formatDisplayDate(new Date().toISOString()))}</div>
      </div>
      <div class="hd-badge">
        ${qrSvg ? `<div class="hd-qr" title="${e(label("امسح الرمز لتنفيذ أمر الصيانة مباشرة", "Scan QR to execute PM order"))}">${qrSvg}</div>` : ""}
        <div class="hd-num-box">
          <div class="n" title="${e(orderNum)}">${e(orderNum)}</div>
          ${qrSvg ? `<div class="qr-hint">${label("مسح سريع 📷", "Quick scan 📷")}</div>` : ""}
        </div>
      </div>
    </div>
    <table class="info">
      <tr>${field(label("البلاغ الأصلي", "Original ticket"), ticketRef)}${field(label("موعد التنفيذ", "Planned date"), formatDisplayDate(order.plannedDate) || unscheduledLabel())}</tr>
      <tr>${field(label("الخط", "Line"), order.line)}${field(label("المعدة", "Equipment"), order.machine)}</tr>
      <tr>${field(label("الفني", "Technician"), order.assignedTo || "")}${field(label("توقف الخط", "Line downtime"), isDowntime(order) ? label("مطلوب ⚡", "Required ⚡") : label("غير مطلوب", "Not required"))}</tr>
    </table>
    <table class="tasks">
      <thead>
        <tr>
          <th style="width:28px">#</th>
          <th>${label("مهام الصيانة", "Maintenance tasks")}</th>
          <th style="width:55px">${label("تم", "Done")}</th>
          <th style="width:65px">${label("لم يتم", "Not done")}</th>
          <th style="width:30%">${label("السبب / ملاحظة", "Reason / note")}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${e(r.desc)}</td><td class="c">${box(r.st === "done")}</td><td class="c">${box(r.st === "not_done")}</td><td>${e(r.reason || "")}</td></tr>`).join("")}
      </tbody>
    </table>
    <div class="res"><b>${label("نتيجة التنفيذ", "Result")}:</b> &nbsp; ${box(status === "completed")} ${label("مكتمل", "Completed")} &nbsp;&nbsp; ${box(status === "completed_partial")} ${label("مكتمل جزئياً", "Partial")} &nbsp;&nbsp; ${box(status === "deferred")} ${label("مؤجل", "Deferred")}</div>
    <div class="notes"><b>${label("ملاحظات", "Notes")}:</b> ${e(notes)}</div>
    <div class="sig">
      <div>${label("الفني المنفذ", "Technician")}: ......................</div>
      <div>${label("مشرف الصيانة", "Supervisor")}: ......................</div>
      <div>${label("التاريخ / الوقت", "Date / time")}: ....................</div>
    </div>
  </section>`;
}

const PM_CARD_CSS = `
  #pmCardOverlay .pm-card{background:#fff;color:#111;border:1.5px solid #111;border-radius:6px;padding:14px 16px;margin:0 auto 16px;font-family:Tahoma,Arial,-apple-system,sans-serif;font-size:11.5px;line-height:1.4;box-sizing:border-box;break-inside:avoid;page-break-inside:avoid}
  #pmCardOverlay .hd{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px}
  #pmCardOverlay .hd-info{min-width:0;flex:1 1 auto}
  #pmCardOverlay .t{font-size:15px;font-weight:700;line-height:1.25;color:#0f172a}
  #pmCardOverlay .s{font-size:10px;color:#555;margin-top:2px}
  #pmCardOverlay .hd-badge{flex:0 1 auto;max-width:52%;display:flex;align-items:center;gap:8px;justify-content:flex-end}
  [dir="rtl"] #pmCardOverlay .hd-badge{justify-content:flex-start}
  #pmCardOverlay .hd-qr{flex-shrink:0;width:52px;height:52px;background:#fff;border:1.5px solid #111;border-radius:4px;padding:2px;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
  #pmCardOverlay .hd-qr svg{width:100%;height:100%;display:block}
  #pmCardOverlay .hd-num-box{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0}
  #pmCardOverlay .qr-hint{font-size:8px;font-weight:700;color:#475569;white-space:nowrap;letter-spacing:-0.2px}
  #pmCardOverlay .n{font-size:12px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;border:1.5px solid #111;padding:3px 8px;border-radius:4px;background:#f8fafc;color:#0f172a;max-width:100%;word-break:break-word;overflow-wrap:anywhere;white-space:normal;text-align:center;line-height:1.35;box-sizing:border-box}
  #pmCardOverlay table{width:100%;border-collapse:collapse;table-layout:fixed}
  #pmCardOverlay .info td{border:1px solid #444;padding:5px 8px;font-size:11px;vertical-align:middle;word-break:break-word;overflow-wrap:anywhere}
  #pmCardOverlay .info .k{background:#f1f5f9;font-weight:700;width:18%;color:#1e293b}
  #pmCardOverlay .info .v{width:32%;color:#0f172a}
  #pmCardOverlay .tasks{margin-top:10px}
  #pmCardOverlay .tasks th,#pmCardOverlay .tasks td{border:1px solid #444;padding:6px 8px;font-size:11px;vertical-align:middle;word-break:break-word;overflow-wrap:anywhere}
  #pmCardOverlay .tasks th{background:#e2e8f0;font-weight:700;color:#0f172a}
  #pmCardOverlay .c{text-align:center;font-size:15px;font-weight:bold;color:#0f172a}
  #pmCardOverlay .res{margin-top:10px;border:1px solid #444;padding:7px 10px;font-size:11px;background:#fafafa;border-radius:4px;color:#0f172a}
  #pmCardOverlay .notes{margin-top:10px;border:1px solid #444;padding:7px 10px;font-size:11px;min-height:52px;border-radius:4px;background:#fff;color:#0f172a;word-break:break-word}
  #pmCardOverlay .sig{display:flex;justify-content:space-between;gap:16px;margin-top:18px;font-size:11px}
  #pmCardOverlay .sig > div{flex:1;border-top:1px dashed #666;padding-top:8px;text-align:center;color:#334155}
  @media print{
    @page{size:A4 portrait;margin:10mm}
    html,body{background:#fff !important;color:#000 !important;margin:0 !important;padding:0 !important;width:100% !important;height:auto !important}
    body > *:not(#pmCardOverlay){display:none !important}
    #pmCardOverlay{position:static !important;inset:auto !important;width:100% !important;max-width:100% !important;overflow:visible !important;background:#fff !important;padding:0 !important;margin:0 !important}
    #pmCardOverlay .no-print{display:none !important}
    #pmCardOverlay .pm-cards-container{max-width:100% !important;width:100% !important;margin:0 !important;padding:0 !important}
    #pmCardOverlay .pm-card{margin:0 0 12mm 0 !important;padding:8mm 10mm !important;border:1.5px solid #000 !important;border-radius:0 !important;break-inside:avoid !important;page-break-inside:avoid !important;box-sizing:border-box !important;width:100% !important;max-width:100% !important}
    #pmCardOverlay .pm-card:not(:last-child){page-break-after:always !important;break-after:page !important}
    #pmCardOverlay .hd-qr{border:1.5px solid #000 !important}
    #pmCardOverlay .hd-qr svg{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    #pmCardOverlay .qr-hint{color:#000 !important}
    *{ -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important}
  }`;

function onPmCardKey(event) { if (event.key === "Escape") closePmCards(); }
function closePmCards() {
  document.getElementById("pmCardOverlay")?.remove();
  document.removeEventListener("keydown", onPmCardKey);
}

async function openPmCards(orders) {
  if (!orders.length) {
    alert(label("لا توجد أوامر لطباعتها.", "No orders to print."));
    return;
  }
  if (orders.length > 30 && !confirm(label(`سيتم تجهيز ${orders.length} كارت. متابعة؟`, `Prepare ${orders.length} cards. Continue?`))) return;
  try {
    await loadQrCodeLib();
  } catch (err) {
    console.warn("Could not load QR generator library:", err);
  }
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
    <div class="pm-cards-container mx-auto max-w-3xl">${orders.map(pmCardHtml).join("")}</div>`;
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

// مسح QR لكارت أمر PM من الكاميرا لفتح نافذة التنفيذ مباشرة
window.openPmOrderTasksFromQr = async function(ticketId) {
  if (!ticketId) return;
  if (typeof window.navigateTo === "function") {
    window.navigateTo("pmOrders");
  }
  if (!pmOrders || !pmOrders.length) {
    if (typeof window.loadPmOrdersBoard === "function") {
      await window.loadPmOrdersBoard();
    }
  }
  const tryOpen = (attempts = 0) => {
    const order = pmOrders.find(item => item.id === ticketId || item.unifiedNumber === ticketId);
    if (order && typeof window.executePmTasks === "function") {
      window.executePmTasks(order.id);
    } else if (attempts < 6) {
      setTimeout(() => tryOpen(attempts + 1), 200);
    } else if (typeof window.executePmTasks === "function") {
      window.executePmTasks(ticketId);
    }
  };
  setTimeout(() => tryOpen(), 100);
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
  if (presetFilters.tab) {
    activePmTab = presetFilters.tab;
  }
  if (presetFilters.machine || presetFilters.line) {
    plansSearch = presetFilters.machine || "";
    plansLineFilter = presetFilters.line || "";
    downtimeSelectedLine = presetFilters.line || downtimeSelectedLine || "Line 1";
    downtimeSelectedMachine = presetFilters.machine || "";
  }
  if (typeof window.navigateTo === "function") {
    window.navigateTo("pmOrders");
  }
};

let unsubscribePmOrders = null;
let unsubscribePmPlans = null;

window.cleanupPmOrdersBoard = function() {
  closePmTasksModal();
  closePmCards();
  document.getElementById("pmPlanEditOverlay")?.remove();
  document.getElementById("pmExecutionModalOverlay")?.remove();
  document.getElementById("pmHistoryOverlay")?.remove();
  if (typeof unsubscribePmOrders === "function") unsubscribePmOrders();
  if (typeof unsubscribePmPlans === "function") unsubscribePmPlans();
  unsubscribePmOrders = null;
  unsubscribePmPlans = null;
};

// اشتراك لحظي: البيانات تتحدث تلقائياً بدون Refresh؛ الاستدعاءات اللاحقة
// (بعد الحفظ/الزر) تعيد العرض فقط ما دام الاشتراك قائماً.
window.loadPmOrdersBoard = async function(force = false) {
  const container = document.getElementById("pmOrdersContainer");
  if (!container) return;
  if (typeof unsubscribePmOrders === "function" && typeof unsubscribePmPlans === "function" && !force) {
    renderPmOrders();
    return;
  }
  window.cleanupPmOrdersBoard();
  container.innerHTML = `<div class="py-6 text-center text-xs text-gray-400">${label("جاري تحميل بيانات الصيانة الوقائية...", "Loading PM data...")}</div>`;

  unsubscribePmPlans = subscribeToPmPlansApi((result) => {
    if (result.status === "success") {
      pmPlans = result.data || [];
      renderPmOrders();
    }
  });

  unsubscribePmOrders = subscribeToPmOrdersApi((result) => {
    const target = document.getElementById("pmOrdersContainer");
    if (!target) { window.cleanupPmOrdersBoard(); return; }
    if (result.status === "success") {
      pmOrders = result.data || [];
      const knownIds = new Set(pmOrders.map(order => order.id));
      selectedOrderIds.forEach(id => { if (!knownIds.has(id)) selectedOrderIds.delete(id); });
      renderPmOrders();
      if (pmTasksModalState) renderPmTasksModal();
    }
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
        const canDelete = tasks.length > 1 && st === "pending";
        actions = `<div class="flex flex-wrap items-center gap-2">
          ${st !== "done" ? btn("done", task.id, "bg-emerald-600 hover:bg-emerald-500", label("✅ تم التنفيذ", "✅ Done")) : ""}
          ${st !== "not_done" ? btn("notdone", task.id, "bg-rose-600 hover:bg-rose-500", label("❌ لم يتم", "❌ Not done")) : ""}
          ${st !== "pending" ? btn("pending", task.id, "bg-gray-600 hover:bg-gray-500", label("↩️ إعادة للانتظار", "↩️ Reset")) : ""}
          ${canDelete ? `<button type="button" ${dis} data-pm-act="delete_manual_task" data-task="${escapeHtml(task.id)}" title="${label("حذف المهمة", "Delete task")}" class="rounded-lg border border-gray-700 bg-gray-800/80 px-2.5 py-2 text-xs text-gray-400 hover:border-rose-500/50 hover:text-rose-300">🗑️</button>` : ""}
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
      ${editable ? `
        <div class="mb-3 rounded-xl border border-gray-700/80 bg-[#0F172A]/80 p-3 space-y-2">
          <div class="text-[11px] font-bold text-gray-300">➕ ${label("إضافة مهمة صيانة يدوياً", "Add maintenance task manually")}</div>
          <div class="flex gap-2">
            <input type="text" id="pmNewTaskDesc" placeholder="${label("اكتب وصف المهمة الإضافية هنا...", "Type additional task description here...")}" class="min-w-0 flex-1 rounded-lg border border-gray-700 bg-[#1E293B] p-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
            <button type="button" ${dis} data-pm-act="add_manual_task" class="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-500 disabled:opacity-50">
              ${label("إضافة", "Add")}
            </button>
          </div>
        </div>
      ` : ""}
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

  if (act === "add_manual_task") {
    const input = document.getElementById("pmNewTaskDesc");
    const desc = String(input?.value || "").trim();
    if (!desc) {
      state.error = label("يرجى كتابة وصف المهمة أولاً.", "Please enter task description first.");
      renderPmTasksModal();
      return;
    }
    state.busy = true;
    state.error = "";
    renderPmTasksModal();
    const result = await addPmTaskApi(state.ticketId, desc);
    if (pmTasksModalState !== state) return;
    state.busy = false;
    if (result.status === "success") {
      const order = pmOrders.find(item => item.id === state.ticketId);
      if (order) {
        order.pmTasks = [...(order.pmTasks || []), result.data];
      }
      renderPmOrders();
    } else {
      state.error = `${label("فشل إضافة المهمة:", "Failed to add task:")} ${result.message || ""}`;
    }
    renderPmTasksModal();
    return;
  }

  if (act === "delete_manual_task") {
    if (!confirm(label("هل تريد بالتأكيد حذف هذه المهمة من أمر PM؟", "Are you sure you want to delete this task?"))) return;
    state.busy = true;
    state.error = "";
    renderPmTasksModal();
    const result = await deletePmTaskApi(state.ticketId, taskId);
    if (pmTasksModalState !== state) return;
    state.busy = false;
    if (result.status === "success") {
      const order = pmOrders.find(item => item.id === state.ticketId);
      if (order) {
        order.pmTasks = (order.pmTasks || []).filter(t => t.id !== taskId);
      }
      renderPmOrders();
    } else {
      state.error = `${label("فشل حذف المهمة:", "Failed to delete task:")} ${result.message || ""}`;
    }
    renderPmTasksModal();
    return;
  }

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
  if (!confirm(label("سيتم تهيئة مهام أمر PM بالمهمة الأصلية فقط. متابعة؟", "Initialize PM order with original task only. Continue?"))) return;

  const origDesc = (order.description || "").trim() || label("صيانة وقائية دورية", "Periodic preventive maintenance");
  const result = await initializePmTasksApi(ticketId, [{ id: "task_1", description: origDesc }]);
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
    // لا مهام بعد: تُهيَّأ المهمة الأصلية (1) فقط افتراضياً دون إضافة مهام 2 و3 و4 تلقائياً
    if (!isPmEditable(order)) {
      alert(label("لا توجد مهام لهذا الأمر.", "This order has no tasks."));
      return;
    }
    const origDesc = (order.description || "").trim() || label("صيانة وقائية دورية", "Periodic preventive maintenance");
    const initResult = await initializePmTasksApi(ticketId, [{ id: "task_1", description: origDesc }]);
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

// ============================================================
// PERIODIC PM PLAN MANAGEMENT & MODALS
// إدارة وتعديل خطط PM الدورية وتسجيل التنفيذ الفعلي
// ============================================================

const PM_COMMON_TASK_PRESETS = [
  "فحص ضغط الهيدروليك ومستويات الزيت والتسريبات",
  "تنظيف الفلاتر ومسارات الهواء ونظام التبريد",
  "التشحيم والتزييت الدوري للمحامل ونقاط الحركة",
  "فحص السيور والتروس ومحاذاة الحوامل وسلاسل الحركة",
  "فحص الاهتزازات غير الطبيعية ودرجات حرارة المحركات",
  "معايرة الحساسات ومفاتيح نهاية الشوط وفحص لوحة الكهرباء"
];

let planModalState = null;

function closePlanEditModal() {
  document.getElementById("pmPlanEditOverlay")?.remove();
  planModalState = null;
}

window.addPlanTaskItem = function() {
  if (!planModalState) return;
  const input = document.getElementById("newPlanTaskInput");
  const text = (input?.value || "").trim();
  if (!text) return;
  planModalState.tasks.push({
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text,
    order: planModalState.tasks.length + 1
  });
  renderPlanEditModal();
};

window.deletePlanTaskItem = function(index) {
  if (!planModalState) return;
  planModalState.tasks.splice(index, 1);
  planModalState.tasks.forEach((t, i) => { t.order = i + 1; });
  renderPlanEditModal();
};

window.movePlanTaskItem = function(index, direction) {
  if (!planModalState) return;
  const target = index + direction;
  if (target < 0 || target >= planModalState.tasks.length) return;
  const temp = planModalState.tasks[index];
  planModalState.tasks[index] = planModalState.tasks[target];
  planModalState.tasks[target] = temp;
  planModalState.tasks.forEach((t, i) => { t.order = i + 1; });
  renderPlanEditModal();
};

window.addPresetPlanTask = function(text) {
  if (!planModalState) return;
  if (!planModalState.tasks.some(t => t.text === text)) {
    planModalState.tasks.push({
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text,
      order: planModalState.tasks.length + 1
    });
    renderPlanEditModal();
  }
};

function renderPlanEditModal() {
  const state = planModalState;
  if (!state) return;
  const e = escapeHtml;

  let overlay = document.getElementById("pmPlanEditOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "pmPlanEditOverlay";
    overlay.className = "fixed inset-0 z-[120] overflow-y-auto bg-black/75 backdrop-blur-sm p-3 flex items-center justify-center";
    document.body.appendChild(overlay);
  }

  const availableMachines = getAllAvailableMachines(state.line);

  overlay.innerHTML = `
    <div dir="${isEn() ? "ltr" : "rtl"}" class="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-700 bg-[#1E293B] p-4 sm:p-6 shadow-2xl text-white space-y-4">
      <div class="flex items-center justify-between border-b border-gray-700 pb-3">
        <h3 class="text-base font-black text-blue-400 flex items-center gap-2">
          <span>📋</span>
          <span>${state.isEdit ? label("تعديل خطة PM دورية", "Edit Periodic PM Plan") : label("إنشاء خطة PM دورية جديدة", "New Periodic PM Plan")}</span>
        </h3>
        <button type="button" onclick="closePlanEditModal()" class="text-gray-400 hover:text-white font-bold text-sm p-1">✕</button>
      </div>

      ${state.error ? `<div role="alert" class="p-2.5 rounded-lg bg-red-500/20 text-red-200 border border-red-500/40 text-xs">${e(state.error)}</div>` : ""}

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label class="block font-bold text-gray-300 mb-1">${label("خط الإنتاج", "Production Line")} <span class="text-red-400">*</span></label>
          <select id="editPlanLine" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white focus:outline-none focus:border-blue-500">
            <option value="Line 1" ${state.line === "Line 1" ? "selected" : ""}>Line 1</option>
            <option value="Line 2" ${state.line === "Line 2" ? "selected" : ""}>Line 2</option>
          </select>
        </div>

        <div>
          <label class="block font-bold text-gray-300 mb-1">${label("المعدة / الماكينة", "Equipment / Machine")} <span class="text-red-400">*</span></label>
          ${state.isEdit ? `
            <input type="text" disabled value="${e(state.machine)}" class="w-full p-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 font-bold" />
          ` : `
            <select id="editPlanMachine" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white focus:outline-none focus:border-blue-500 font-bold">
              <option value="">${label("اختر الماكينة...", "Select machine...")}</option>
              ${availableMachines.map(m => `
                <option value="${e(m.name)}" ${m.name === state.machine ? "selected" : ""}>
                  ${e(m.name)} (${m.department === "frontend" ? "Front-End" : "Back-End"})
                </option>
              `).join("")}
            </select>
          `}
        </div>

        <div>
          <label class="block font-bold text-gray-300 mb-1">${label("دورية الصيانة", "PM Frequency")} <span class="text-red-400">*</span></label>
          <select id="editPlanFreq" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white focus:outline-none focus:border-blue-500">
            ${PM_FREQUENCIES.map(f => `
              <option value="${f.id}" ${state.frequency === f.id ? "selected" : ""}>
                ${isEn() ? f.en : f.ar}
              </option>
            `).join("")}
          </select>
        </div>

        <div id="customDaysContainer" class="${state.frequency === "custom" ? "" : "hidden"}">
          <label class="block font-bold text-gray-300 mb-1">${label("عدد الأيام بين كل صيانة", "Days Interval")}</label>
          <input type="number" min="1" id="editPlanCustomDays" value="${state.customDays || 14}" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label class="block font-bold text-gray-300 mb-1">${label("المدة المقدرة (بالدقائق)", "Estimated Duration (min)")}</label>
          <input type="number" min="5" step="5" id="editPlanDuration" value="${state.estimatedDurationMinutes || 30}" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label class="block font-bold text-gray-300 mb-1">${label("تاريخ بدء / استحقاق الخطة", "First Scheduled Date")}</label>
          <input type="date" id="editPlanStartDate" value="${escapeHtml(state.startDate || localDateKey())}" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <!-- منشئ قائمة المهام -->
      <div class="space-y-2 border-t border-gray-700/80 pt-3">
        <div class="flex items-center justify-between text-xs font-bold text-gray-200">
          <span>📋 ${label("مهام الصيانة الوقائية بالخطة:", "Maintenance Tasks Checklist:")}</span>
          <span class="text-blue-400 font-normal text-[11px]">${state.tasks.length} ${label("مهام", "tasks")}</span>
        </div>

        <!-- أزرار الإضافة السريعة المقترحة -->
        <div class="bg-[#0F172A] p-2.5 rounded-xl border border-gray-800 space-y-1.5">
          <div class="text-[10px] font-bold text-gray-400">${label("إضافة سريعة لبنود قياسية:", "Quick presets:")}</div>
          <div class="flex flex-wrap gap-1.5">
            ${PM_COMMON_TASK_PRESETS.map(preset => `
              <button
                type="button"
                onclick="window.addPresetPlanTask('${escapeJsArg(preset)}')"
                class="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-700 transition"
              >
                + ${e(preset.slice(0, 28))}...
              </button>
            `).join("")}
          </div>
        </div>

        <!-- إضافة مهمة جديدة يدوياً -->
        <div class="flex gap-2">
          <input
            type="text"
            id="newPlanTaskInput"
            placeholder="${label("اكتب نص مهمة الصيانة الجديدة...", "Enter maintenance task description...")}"
            class="flex-1 p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onclick="window.addPlanTaskItem()"
            class="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs transition whitespace-nowrap"
          >
            ➕ ${label("إضافة", "Add")}
          </button>
        </div>

        <!-- قائمة المهام الحالية مع الترتيب والحذف -->
        <div class="space-y-1.5 max-h-48 overflow-y-auto pt-1">
          ${state.tasks.map((task, idx) => `
            <div class="flex items-center gap-2 p-2 rounded-lg bg-[#0F172A] border border-gray-800 text-xs">
              <span class="w-5 text-center font-bold text-gray-500 shrink-0">${idx + 1}</span>
              <input
                type="text"
                value="${e(task.text)}"
                onchange="planModalState.tasks[${idx}].text = this.value"
                class="flex-1 bg-transparent border-0 text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5"
              />
              <div class="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="${label("تحريك لأعلى", "Move up")}"
                  onclick="window.movePlanTaskItem(${idx}, -1)"
                  ${idx === 0 ? "disabled" : ""}
                  class="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                >⬆️</button>
                <button
                  type="button"
                  title="${label("تحريك لأسفل", "Move down")}"
                  onclick="window.movePlanTaskItem(${idx}, 1)"
                  ${idx === state.tasks.length - 1 ? "disabled" : ""}
                  class="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                >⬇️</button>
                <button
                  type="button"
                  title="${label("حذف المهمة", "Delete task")}"
                  onclick="window.deletePlanTaskItem(${idx})"
                  class="p-1 text-red-400 hover:text-red-300"
                >🗑️</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- ملاحظات عامة -->
      <div>
        <label class="block font-bold text-gray-300 text-xs mb-1">${label("ملاحظات / تعليمات الصيانة", "Maintenance Notes")}</label>
        <textarea id="editPlanNotes" rows="2" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500 resize-none">${e(state.notes)}</textarea>
      </div>

      <!-- أزرار الحفظ والإلغاء -->
      <div class="flex gap-2 border-t border-gray-700 pt-3">
        <button
          type="button"
          onclick="closePlanEditModal()"
          class="flex-1 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-xs transition"
        >
          ${label("إلغاء", "Cancel")}
        </button>

        <button
          type="button"
          id="btnSavePlanSubmit"
          onclick="window.handleSavePlanSubmit()"
          class="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs transition shadow-lg shadow-blue-500/20"
        >
          ${state.busy ? label("جاري الحفظ...", "Saving...") : label("💾 حفظ الخطة", "💾 Save Plan")}
        </button>
      </div>
    </div>
  `;

  // ربط أحداث التغيير
  const lineEl = overlay.querySelector("#editPlanLine");
  if (lineEl && !state.isEdit) {
    lineEl.addEventListener("change", ev => {
      state.line = ev.target.value;
      renderPlanEditModal();
    });
  }

  const freqEl = overlay.querySelector("#editPlanFreq");
  if (freqEl) {
    freqEl.addEventListener("change", ev => {
      state.frequency = ev.target.value;
      const customContainer = overlay.querySelector("#customDaysContainer");
      if (customContainer) {
        if (state.frequency === "custom") customContainer.classList.remove("hidden");
        else customContainer.classList.add("hidden");
      }
    });
  }
}

window.openAddEditPlanModal = function(planId = null, prefillMachine = "", prefillLine = "") {
  if (!canPlanPmOrders()) {
    alert(label("ليست لديك صلاحية إدارة خطط الصيانة الوقائية.", "You are not allowed to manage PM plans."));
    return;
  }

  const existing = planId ? pmPlans.find(p => p.id === planId) : null;
  const isEdit = !!existing;

  const initialLine = existing?.line || prefillLine || "Line 1";
  const initialMachine = existing?.machine || prefillMachine || "";
  const initialFreq = existing?.frequency || "monthly";
  const initialCustomDays = existing?.customDays || 14;
  const initialDuration = existing?.estimatedDurationMinutes || 30;
  const initialStartDate = existing?.nextDueDate || localDateKey();
  const initialNotes = existing?.notes || "";

  const initialTasks = Array.isArray(existing?.tasks) && existing.tasks.length
    ? existing.tasks.map((t, idx) => ({ id: t.id || `task_${idx + 1}`, text: t.text || t.description || "", order: idx + 1 }))
    : [
        { id: "task_1", text: "فحص واختبار الصيانة الوقائية الأساسية للمعدة", order: 1 }
      ];

  planModalState = {
    planId: existing?.id || null,
    isEdit,
    line: initialLine,
    machine: initialMachine,
    frequency: initialFreq,
    customDays: initialCustomDays,
    estimatedDurationMinutes: initialDuration,
    startDate: initialStartDate,
    notes: initialNotes,
    tasks: initialTasks,
    busy: false,
    error: ""
  };

  renderPlanEditModal();
};

window.handleSavePlanSubmit = async function() {
  const state = planModalState;
  if (!state || state.busy) return;

  const overlay = document.getElementById("pmPlanEditOverlay");
  if (!overlay) return;

  const line = overlay.querySelector("#editPlanLine")?.value || state.line;
  const machine = state.isEdit ? state.machine : (overlay.querySelector("#editPlanMachine")?.value || state.machine);
  const frequency = overlay.querySelector("#editPlanFreq")?.value || state.frequency;
  const customDays = parseInt(overlay.querySelector("#editPlanCustomDays")?.value, 10) || state.customDays;
  const duration = parseInt(overlay.querySelector("#editPlanDuration")?.value, 10) || state.estimatedDurationMinutes;
  const startDate = overlay.querySelector("#editPlanStartDate")?.value || state.startDate;
  const notes = overlay.querySelector("#editPlanNotes")?.value || state.notes;

  if (!machine) {
    state.error = label("يرجى اختيار الماكينة أولاً.", "Please select a machine first.");
    renderPlanEditModal();
    return;
  }

  if (!state.tasks.length || !state.tasks.some(t => t.text.trim())) {
    state.error = label("يرجى إضافة مهمة صيانة واحدة على الأقل للخطة.", "Please add at least one maintenance task to the plan.");
    renderPlanEditModal();
    return;
  }

  state.busy = true;
  state.error = "";
  const saveBtn = overlay.querySelector("#btnSavePlanSubmit");
  if (saveBtn) saveBtn.disabled = true;

  try {
    const payload = {
      id: state.planId || undefined,
      line,
      machine,
      frequency,
      customDays,
      estimatedDurationMinutes: duration,
      startDate,
      notes,
      tasks: state.tasks.filter(t => t.text.trim())
    };

    const res = await savePmPlanApi(payload);
    if (res.status === "success") {
      alert(res.message || label("تم حفظ الخطة بنجاح ✅", "Plan saved successfully ✅"));
      closePlanEditModal();
      await window.loadPmOrdersBoard();
    } else {
      state.error = res.message || label("فشل حفظ الخطة.", "Failed to save plan.");
      state.busy = false;
      renderPlanEditModal();
    }
  } catch (err) {
    state.error = err.message || label("خطأ في الاتصال.", "Connection error.");
    state.busy = false;
    renderPlanEditModal();
  }
};

// ============================================================
// EXECUTION MODAL: تسجيل نتيجة التنفيذ الفعلي
// ============================================================

let executionModalState = null;

function closeExecutionModal() {
  document.getElementById("pmExecutionModalOverlay")?.remove();
  executionModalState = null;
}

window.openRecordPmExecutionModal = function(planId) {
  const plan = pmPlans.find(p => p.id === planId);
  if (!plan) {
    alert(label("تعذر العثور على خطة PM المحددة.", "Plan not found."));
    return;
  }

  const tasks = (plan.tasks || []).map((t, idx) => ({
    id: t.id || `task_${idx + 1}`,
    text: t.text || t.description || "",
    status: "done", // افتراض تم التنفيذ افتراضياً لتقليل الخطوات الميدانية
    note: ""
  }));

  executionModalState = {
    planId: plan.id,
    plan,
    technicianName: localStorage.getItem("name") || "فني صيانة",
    supervisorName: "",
    result: "completed",
    notes: "",
    tasks,
    busy: false,
    error: ""
  };

  renderExecutionModal();
};

function renderExecutionModal() {
  const state = executionModalState;
  if (!state) return;
  const e = escapeHtml;
  const plan = state.plan;

  let overlay = document.getElementById("pmExecutionModalOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "pmExecutionModalOverlay";
    overlay.className = "fixed inset-0 z-[120] overflow-y-auto bg-black/75 backdrop-blur-sm p-3 flex items-center justify-center";
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div dir="${isEn() ? "ltr" : "rtl"}" class="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-700 bg-[#1E293B] p-4 sm:p-6 shadow-2xl text-white space-y-4">
      <div class="flex items-center justify-between border-b border-gray-700 pb-3">
        <div>
          <h3 class="text-base font-black text-emerald-400 flex items-center gap-2">
            <span>✅</span>
            <span>${label("تسجيل نتيجة التنفيذ الفعلي لـ PM", "Record Actual PM Execution")}</span>
          </h3>
          <div class="text-xs text-gray-300 mt-1">
            ⚙️ ${e(plan.machine)} · ${e(plan.line || "Line 1")} · 🔄 ${e(plan.frequencyLabel || plan.frequency)}
          </div>
        </div>
        <button type="button" onclick="closeExecutionModal()" class="text-gray-400 hover:text-white font-bold text-sm p-1">✕</button>
      </div>

      ${state.error ? `<div role="alert" class="p-2.5 rounded-lg bg-red-500/20 text-red-200 border border-red-500/40 text-xs">${e(state.error)}</div>` : ""}

      <!-- بيانات الفني والتاريخ -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label class="block font-bold text-gray-300 mb-1">${label("الفني المنفذ", "Executing Technician")} <span class="text-red-400">*</span></label>
          <input
            type="text"
            id="execTechName"
            value="${e(state.technicianName)}"
            class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white font-bold focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label class="block font-bold text-gray-300 mb-1">${label("مشرف الصيانة (اختياري)", "Supervisor (optional)")}</label>
          <input
            type="text"
            id="execSupervisorName"
            value="${e(state.supervisorName)}"
            placeholder="${label("اسم المشرف المعتمد...", "Supervisor name...")}"
            class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <!-- قائمة التحقق من المهام المنفذة وغير المنفذة -->
      <div class="space-y-2 border-t border-gray-700/80 pt-3">
        <div class="flex items-center justify-between text-xs font-bold text-gray-200">
          <span>📋 ${label("التحقق من تنفيذ المهام:", "Tasks Execution Verification:")}</span>
          <span class="text-[11px] text-gray-400">${state.tasks.length} ${label("مهام", "tasks")}</span>
        </div>

        <div class="space-y-2 max-h-52 overflow-y-auto">
          ${state.tasks.map((task, idx) => `
            <div class="p-2.5 rounded-xl border ${task.status === "done" ? "border-emerald-500/40 bg-emerald-950/20" : "border-rose-500/40 bg-rose-950/20"} space-y-1.5 text-xs transition">
              <div class="flex items-center justify-between gap-2">
                <label class="flex items-center gap-2 cursor-pointer font-bold ${task.status === "done" ? "text-emerald-200" : "text-rose-200"} flex-1">
                  <input
                    type="checkbox"
                    ${task.status === "done" ? "checked" : ""}
                    onchange="window.toggleExecutionTaskStatus(${idx}, this.checked)"
                    class="w-4 h-4 rounded text-emerald-600 bg-gray-900 border-gray-700 cursor-pointer"
                  />
                  <span>${idx + 1}. ${e(task.text)}</span>
                </label>
                <span class="text-[10px] font-black uppercase ${task.status === "done" ? "text-emerald-400" : "text-rose-400"}">
                  ${task.status === "done" ? label("تم", "Done") : label("لم يتم", "Not Done")}
                </span>
              </div>

              ${task.status !== "done" ? `
                <input
                  type="text"
                  placeholder="${label("سبب عدم التنفيذ أو ملاحظة...", "Reason for not completing...")}"
                  value="${e(task.note)}"
                  onchange="executionModalState.tasks[${idx}].note = this.value"
                  class="w-full p-1.5 rounded-lg bg-[#0F172A] border border-rose-500/50 text-[11px] text-rose-200 placeholder-rose-400/50"
                />
              ` : ""}
            </div>
          `).join("")}
        </div>
      </div>

      <!-- نتيجة التنفيذ العامة -->
      <div class="space-y-1.5 border-t border-gray-700/80 pt-3">
        <label class="block font-bold text-xs text-gray-200">${label("نتيجة التنفيذ العامة:", "Overall Result:")}</label>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <label class="flex items-center justify-center gap-1.5 p-2 rounded-xl border cursor-pointer font-bold ${state.result === "completed" ? "border-emerald-500 bg-emerald-600/30 text-emerald-200" : "border-gray-700 bg-[#0F172A] text-gray-400"}">
            <input type="radio" name="execResultRadio" value="completed" ${state.result === "completed" ? "checked" : ""} onchange="executionModalState.result = this.value; renderExecutionModal()" class="sr-only" />
            <span>✅ ${label("مكتمل", "Completed")}</span>
          </label>
          <label class="flex items-center justify-center gap-1.5 p-2 rounded-xl border cursor-pointer font-bold ${state.result === "completed_partial" ? "border-amber-500 bg-amber-600/30 text-amber-200" : "border-gray-700 bg-[#0F172A] text-gray-400"}">
            <input type="radio" name="execResultRadio" value="completed_partial" ${state.result === "completed_partial" ? "checked" : ""} onchange="executionModalState.result = this.value; renderExecutionModal()" class="sr-only" />
            <span>⚠️ ${label("جزئي", "Partial")}</span>
          </label>
          <label class="flex items-center justify-center gap-1.5 p-2 rounded-xl border cursor-pointer font-bold ${state.result === "deferred" ? "border-rose-500 bg-rose-600/30 text-rose-200" : "border-gray-700 bg-[#0F172A] text-gray-400"}">
            <input type="radio" name="execResultRadio" value="deferred" ${state.result === "deferred" ? "checked" : ""} onchange="executionModalState.result = this.value; renderExecutionModal()" class="sr-only" />
            <span>⏸️ ${label("مؤجل", "Deferred")}</span>
          </label>
        </div>
      </div>

      <!-- ملاحظات ختامية -->
      <div>
        <label class="block font-bold text-gray-300 text-xs mb-1">${label("ملاحظات / أعمال إضافية تم تنفيذها", "Observations & Handover Notes")}</label>
        <textarea id="execNotes" rows="2" placeholder="${label("هل ظهرت أصوات غير طبيعية أو تسريبات أثناء التشغيل؟", "Any unusual noises or leaks during test?")}" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none">${e(state.notes)}</textarea>
      </div>

      <!-- أزرار الإجراءات -->
      <div class="flex gap-2 border-t border-gray-700 pt-3">
        <button
          type="button"
          onclick="closeExecutionModal()"
          class="flex-1 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-xs transition"
        >
          ${label("إلغاء", "Cancel")}
        </button>

        <button
          type="button"
          id="btnSaveExecutionSubmit"
          onclick="window.handleSaveExecutionSubmit()"
          class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs transition shadow-lg shadow-emerald-600/30"
        >
          ${state.busy ? label("جاري تسجيل التنفيذ...", "Saving...") : label("💾 اعتماد التنفيذ وتحديث الموعد", "💾 Record Run & Update Due Date")}
        </button>
      </div>
    </div>
  `;
}

window.toggleExecutionTaskStatus = function(idx, isDone) {
  if (!executionModalState || !executionModalState.tasks[idx]) return;
  executionModalState.tasks[idx].status = isDone ? "done" : "not_done";
  // إذا كانت كل المهام تم التنفيذ => النتيجة مكتمل، وإذا جزء لم يتم => جزئي
  const allDone = executionModalState.tasks.every(t => t.status === "done");
  const anyDone = executionModalState.tasks.some(t => t.status === "done");
  if (allDone) executionModalState.result = "completed";
  else if (anyDone) executionModalState.result = "completed_partial";
  renderExecutionModal();
};

window.handleSaveExecutionSubmit = async function() {
  const state = executionModalState;
  if (!state || state.busy) return;

  const overlay = document.getElementById("pmExecutionModalOverlay");
  if (!overlay) return;

  const techName = (overlay.querySelector("#execTechName")?.value || state.technicianName).trim();
  const supervisorName = (overlay.querySelector("#execSupervisorName")?.value || state.supervisorName).trim();
  const notes = (overlay.querySelector("#execNotes")?.value || state.notes).trim();

  if (!techName) {
    state.error = label("يرجى كتابة اسم الفني المنفذ.", "Please enter technician name.");
    renderExecutionModal();
    return;
  }

  state.busy = true;
  state.error = "";
  const saveBtn = overlay.querySelector("#btnSaveExecutionSubmit");
  if (saveBtn) saveBtn.disabled = true;

  try {
    const payload = {
      planId: state.plan.id,
      machine: state.plan.machine,
      line: state.plan.line,
      department: state.plan.department,
      technicianName: techName,
      supervisorName,
      executedBy: techName,
      executedByUid: localStorage.getItem("userId") || "",
      executedAt: new Date().toISOString(),
      result: state.result,
      tasks: state.tasks,
      notes,
      source: "line_downtime",
      clientToken: `exec_${state.plan.id}_${Date.now()}`
    };

    const res = await savePmExecutionApi(payload);
    if (res.status === "success") {
      alert(`${label("تم تسجيل التنفيذ بنجاح وتحديث موعد الصيانة القادم إلى:", "Execution recorded! Next due date:")} ${res.nextDueDate || "محدث"} ✅`);
      closeExecutionModal();
      await window.loadPmOrdersBoard();
    } else {
      state.error = res.message || label("فشل تسجيل التنفيذ.", "Failed to record execution.");
      state.busy = false;
      renderExecutionModal();
    }
  } catch (err) {
    state.error = err.message || label("خطأ في الاتصال.", "Connection error.");
    state.busy = false;
    renderExecutionModal();
  }
};

// ============================================================
// HISTORY MODAL: عرض سجل التنفيذات السابقة
// ============================================================

function closeHistoryModal() {
  document.getElementById("pmHistoryOverlay")?.remove();
}

window.openPmExecutionsHistoryModal = async function(planId) {
  const plan = pmPlans.find(p => p.id === planId);
  if (!plan) return;
  const e = escapeHtml;

  let overlay = document.getElementById("pmHistoryOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "pmHistoryOverlay";
    overlay.className = "fixed inset-0 z-[120] overflow-y-auto bg-black/75 backdrop-blur-sm p-3 flex items-center justify-center";
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div dir="${isEn() ? "ltr" : "rtl"}" class="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-700 bg-[#1E293B] p-5 shadow-2xl text-white space-y-4">
      <div class="flex items-center justify-between border-b border-gray-700 pb-3">
        <div>
          <h3 class="text-base font-black text-blue-400 flex items-center gap-2">
            <span>📜</span>
            <span>${label("سجل تنفيذات الصيانة الوقائية", "PM Execution History")}</span>
          </h3>
          <div class="text-xs text-gray-300 mt-1">⚙️ ${e(plan.machine)} · ${e(plan.line || "Line 1")}</div>
        </div>
        <button type="button" onclick="closeHistoryModal()" class="text-gray-400 hover:text-white font-bold text-sm p-1">✕</button>
      </div>

      <div id="pmHistoryListContainer" class="py-8 text-center text-xs text-gray-400">
        ${label("جاري تحميل سجل التنفيذ...", "Loading execution history...")}
      </div>
    </div>
  `;

  try {
    const res = await fetchPmExecutionsApi({ planId: plan.id, machine: plan.machine });
    const container = document.getElementById("pmHistoryListContainer");
    if (!container) return;

    if (res.status === "success" && res.data?.length) {
      container.innerHTML = `
        <div class="space-y-3 text-start">
          ${res.data.map((exec, idx) => {
            const stBadge = exec.result === "completed"
              ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ ${label("مكتمل", "Done")}</span>`
              : exec.result === "completed_partial"
              ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">⚠️ ${label("جزئي", "Partial")}</span>`
              : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">⏸️ ${label("مؤجل", "Deferred")}</span>`;

            return `
              <div class="p-3.5 rounded-xl bg-[#0F172A] border border-gray-800 space-y-2 text-xs">
                <div class="flex items-start justify-between gap-2">
                  <div class="font-bold text-gray-200">
                    <span>📅 ${formatDisplayDate(exec.executedAt)}</span>
                    <span class="text-gray-400 font-normal text-[11px] block sm:inline sm:ms-2">👤 ${e(exec.technicianName || exec.executedBy || "")}</span>
                  </div>
                  ${stBadge}
                </div>

                ${exec.tasksSummary ? `
                  <div class="text-[11px] text-gray-400 flex items-center gap-3">
                    <span>${label("المهام المنجزة:", "Completed:")} <strong class="text-emerald-400">${exec.tasksSummary.done || 0}/${exec.tasksSummary.total || 0}</strong></span>
                    ${exec.tasksSummary.notDone ? `<span class="text-rose-400">${label("لم تنفذ:", "Not done:")} ${exec.tasksSummary.notDone}</span>` : ""}
                  </div>
                ` : ""}

                ${exec.notes ? `
                  <div class="p-2 rounded bg-gray-800/80 text-[11px] text-gray-300 border border-gray-700/60">
                    <strong>${label("ملاحظات:", "Notes:")}</strong> ${e(exec.notes)}
                  </div>
                ` : ""}
              </div>
            `;
          }).join("")}
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="p-6 text-center text-xs text-gray-400">
          <div class="text-2xl mb-1">📋</div>
          ${label("لا توجد سجلات تنفيذ مسجلة لهذه الماكينة حتى الآن.", "No execution records found for this machine yet.")}
        </div>
      `;
    }
  } catch (err) {
    const container = document.getElementById("pmHistoryListContainer");
    if (container) container.innerHTML = `<div class="p-4 text-center text-red-300 text-xs">${e(err.message)}</div>`;
  }
};

// ============================================================
// PRINT & EXPORT PM PLANS
// ============================================================

window.printMachinePmPlanCard = function(planId) {
  const plan = pmPlans.find(p => p.id === planId);
  if (!plan) {
    alert(label("الخطة غير موجودة.", "Plan not found."));
    return;
  }
  const cardData = preparePlanAsCard(plan);
  openPmCards([cardData]);
};

window.exportDowntimePmPlan = async function(format, planId) {
  const plan = pmPlans.find(p => p.id === planId);
  if (!plan) return;
  const isEnDoc = isEn();

  const title = isEnDoc
    ? `Line Downtime PM Checklist - ${plan.machine} (${plan.line || "Line 1"})`
    : `خطة الصيانة الوقائية عند توقف الخط - ${plan.machine} (${plan.line || "خط 1"})`;

  const filename = `downtime-pm-${(plan.machine || "machine").replace(/\s+/g, "-")}-${localDateKey()}`;

  const headers = [
    label("م", "#"),
    label("المعدة", "Equipment"),
    label("خط الإنتاج", "Line"),
    label("مهمة الصيانة الوقائية", "Maintenance Task"),
    label("الحالة المطلوبة", "Required Status"),
    label("ملاحظات الفحص والتشغيل", "Observations & Notes"),
    label("الدورية", "Frequency")
  ];

  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const rows = tasks.map((t, idx) => [
    idx + 1,
    plan.machine,
    plan.line || "Line 1",
    t.text || t.description || "",
    label("⬜ تم / لم يتم", "⬜ Done / Not Done"),
    "",
    plan.frequencyLabel || plan.frequency
  ]);

  if (format === "excel") {
    await exportToExcel(title, headers, rows, filename, { sheetName: label("مهام PM", "PM Tasks") });
    return;
  }

  // تصدير PDF احترافي مع نماذج التوقيعات الميدانية
  const exportTime = new Date().toLocaleString(isEnDoc ? "en-US" : "ar-EG");
  const dueInfo = calculateDueStatus(plan.nextDueDate, plan.lastExecution?.executedAt);

  const tableRows = rows.map(r => `
    <tr>
      <td style="border:1px solid #94a3b8;padding:6px;text-align:center;width:30px;">${r[0]}</td>
      <td style="border:1px solid #94a3b8;padding:6px;font-weight:bold;width:120px;">${escapeHtml(r[1])}</td>
      <td style="border:1px solid #94a3b8;padding:6px;width:70px;text-align:center;">${escapeHtml(r[2])}</td>
      <td style="border:1px solid #94a3b8;padding:6px;font-size:10px;">${escapeHtml(r[3])}</td>
      <td style="border:1px solid #94a3b8;padding:6px;text-align:center;width:90px;font-size:9px;">${escapeHtml(r[4])}</td>
      <td style="border:1px solid #94a3b8;padding:6px;width:160px;"></td>
      <td style="border:1px solid #94a3b8;padding:6px;text-align:center;width:80px;font-size:9px;">${escapeHtml(r[6])}</td>
    </tr>
  `).join("");

  const html = `
    <div dir="${isEnDoc ? "ltr" : "rtl"}" style="font-family:Tahoma,Arial,sans-serif;color:#0f172a;padding:10px;">
      <div style="border-bottom:2.5px solid #d97706;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h2 style="margin:0 0 4px 0;color:#92400e;font-size:16px;font-weight:bold;">⚡ ${escapeHtml(title)}</h2>
          <p style="margin:0;font-size:10px;color:#475569;line-height:1.6">
            <strong>${escapeHtml(label("تاريخ الاستخراج:", "Export Date:"))}</strong> ${escapeHtml(exportTime)} &nbsp;|&nbsp;
            <strong>${escapeHtml(label("حالة الاستحقاق:", "Due Status:"))}</strong> ${escapeHtml(dueInfo.label)} &nbsp;|&nbsp;
            <strong>${escapeHtml(label("الموعد المجدول:", "Scheduled Due:"))}</strong> ${escapeHtml(formatDisplayDate(plan.nextDueDate))}<br>
            <strong>${escapeHtml(label("دورية الخطة:", "Frequency:"))}</strong> ${escapeHtml(plan.frequencyLabel || plan.frequency)} &nbsp;|&nbsp;
            <strong>${escapeHtml(label("المدة المقدرة:", "Duration:"))}</strong> ${plan.estimatedDurationMinutes || 30} ${escapeHtml(label("دقيقة", "minutes"))}
          </p>
        </div>
      </div>

      <div style="background:#fffbeb;border:1px solid #f59e0b;color:#78350f;padding:8px 12px;border-radius:6px;font-size:10px;margin-bottom:14px;font-weight:bold;">
        ⚡ ${escapeHtml(label("بطاقة مهام صيانة وقائية ميدانية جاهزة للتنفيذ الفوري أثناء توقف الخط الإنتاجي — يُرجى التأشير والتوقيع واعتماد النتيجة.", "Field PM work order checklist for immediate execution during production downtime — please check off tasks, note any defects, and sign below."))}
      </div>

      <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px;direction:${isEnDoc ? "ltr" : "rtl"};margin-bottom:24px;">
        <thead>
          <tr style="background:#f1f5f9;color:#0f172a;">
            ${headers.map(h => `<th style="border:1px solid #94a3b8;padding:6px;font-weight:bold;">${escapeHtml(h)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <!-- ملاحظات ختامية للعمل الميداني -->
      <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px;margin-bottom:20px;font-size:9px;min-height:50px;">
        <strong>${escapeHtml(label("ملاحظات الفني وقطع الغيار المستهلكة:", "Technician remarks & replaced spare parts:"))}</strong>
      </div>

      <!-- توقيعات الاعتماد الميداني -->
      <div style="display:flex;justify-content:space-between;font-size:9px;color:#334155;gap:12px;">
        <div style="flex:1;border:1px solid #cbd5e1;padding:8px;border-radius:6px;">
          <strong>${escapeHtml(label("الفني المنفذ / الفريق:", "Executing Technician / Team:"))}</strong><br><br>
          ${escapeHtml(label("الاسم والتوقيع: .................................", "Name & Signature: ................................."))}<br><br>
          ${escapeHtml(label("الوقت المنقضي: ......... دقيقة", "Actual duration: ......... minutes"))}
        </div>
        <div style="flex:1;border:1px solid #cbd5e1;padding:8px;border-radius:6px;">
          <strong>${escapeHtml(label("مشرف الصيانة / المهندس:", "Supervisor / Engineer:"))}</strong><br><br>
          ${escapeHtml(label("الاسم والتوقيع: .................................", "Name & Signature: ................................."))}<br><br>
          ${escapeHtml(label("الاعتماد: [ ] مكتمل   [ ] جزئي   [ ] مؤجل", "Verification: [ ] Done   [ ] Partial   [ ] Deferred"))}
        </div>
        <div style="flex:1;border:1px solid #cbd5e1;padding:8px;border-radius:6px;">
          <strong>${escapeHtml(label("تسليم وتشغيل خط الإنتاج:", "Line Handover & Startup:"))}</strong><br><br>
          ${escapeHtml(label("الاسم والتوقيع: .................................", "Name & Signature: ................................."))}<br><br>
          ${escapeHtml(label("ساعة عودة الخط للعمل: ..................", "Startup time: .................."))}
        </div>
      </div>
    </div>
  `;

  await exportToPdf(title, [{ label: label("الماكينة والخط", "Machine & Line"), value: `${plan.machine} (${plan.line || "Line 1"})` }], html, `${filename}.pdf`);
};

window.deletePmPlan = async function(planId) {
  if (!confirm(label("هل أنت متأكد من رغبتك في حذف خطة الصيانة الوقائية لهذه الماكينة؟", "Are you sure you want to delete this machine PM plan?"))) return;
  const res = await deletePmPlanApi(planId);
  if (res.status === "success") {
    alert(label("تم حذف الخطة بنجاح.", "Plan deleted successfully."));
    await window.loadPmOrdersBoard();
  } else {
    alert(`${label("تعذر حذف الخطة:", "Failed to delete plan:")} ${res.message || ""}`);
  }
};

