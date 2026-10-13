import { openActionModal } from "../components/ActionModal.js";
import { fetchTechniciansApi } from "../services/usersApi.js";
import { exportToExcel, exportToPdf } from "../services/exportUtility.js";
import { fetchPmOrdersApi, updatePmOrderApi } from "../services/api.js";
import { escapeHtml, escapeJsArg } from "../utils/escapeHtml.js";
import { hasFullDataAccess } from "../permissions.js";

let pmOrders = [];
let visibleOrders = [];
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
const pmStatusLabel = status => ({
  unplanned: label("غير مجدول", "Unscheduled"),
  planned: label("مخطط", "Planned"),
  in_progress: label("قيد التنفيذ", "In progress"),
  completed: label("مكتمل", "Completed"),
  deferred: label("مؤجل", "Deferred")
}[status] || valueOrDash(status));

function filteredPmOrders() {
  const search = filters.search.trim().toLocaleLowerCase();
  return pmOrders.filter(order => {
    const matchSearch = !search || [
      order.issueId, order.id, order.line, order.machine, order.location, order.description,
      order.reportedBy, order.assignedTo, order.maintenanceNotes
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
  const lines = [...new Set(pmOrders.map(order => order.line).filter(Boolean))].sort();
  const machines = [...new Set(pmOrders.map(order => order.machine).filter(Boolean))].sort();
  const priorities = [...new Set(pmOrders.map(order => order.priority).filter(Boolean))].sort();

  const rows = visibleOrders.map(order => `
    <tr class="border-b border-gray-800 align-top">
      <td class="p-3 font-mono text-xs">${escapeHtml(order.issueId || order.id)}</td>
      <td class="p-3 font-mono text-xs">${escapeHtml(order.issueId || order.id)}</td>
      <td class="p-3">${escapeHtml(valueOrDash(order.line))}</td>
      <td class="p-3">${escapeHtml(valueOrDash(order.machine))}</td>
      <td class="p-3 min-w-48 whitespace-normal">${escapeHtml(valueOrDash(order.description))}</td>
      <td class="p-3">${escapeHtml(valueOrDash(order.priority))}</td>
      <td class="p-3">${escapeHtml(pmStatusLabel(order.pmStatus || "unplanned"))}</td>
      <td class="p-3">${escapeHtml(formatDisplayDate(order.createdAt) || valueOrDash(""))}</td>
      <td class="p-3">${escapeHtml(formatDisplayDate(order.plannedDate) || unscheduledLabel())}</td>
      <td class="p-3">${escapeHtml(order.assignedTo || unassignedLabel())}</td>
      <td class="p-3">${order.downtimeRequired === true ? label("مطلوب", "Required") : label("غير مطلوب / غير محدد", "Not required / unset")}</td>
      <td class="p-3 min-w-40 whitespace-normal">${escapeHtml(order.maintenanceNotes || order.delayReason || "—")}</td>
      <td class="p-3">${canPlanPmOrders() ? `<button type="button" onclick="window.editPmOrder('${escapeJsArg(order.id)}')" class="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500">${label("تخطيط / تعديل", "Plan / edit")}</button>` : "—"}</td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div class="space-y-4" dir="${isEn() ? "ltr" : "rtl"}">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-300">${label("غير مجدول", "Unscheduled")}: ${unscheduledCount}</span>
          <span class="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-blue-300">${unassignedLabel()}: ${unassignedCount}</span>
          <span class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-200">${label("إجمالي النتائج", "Results")}: ${visibleOrders.length}</span>
        </div>
        <button type="button" id="pmOrdersRefresh" class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-bold text-white">${label("تحديث", "Refresh")}</button>
      </div>

      <div class="rounded-xl border border-gray-800 bg-[#1E293B] p-3">
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <input id="pmFilterSearch" value="${escapeHtml(filters.search)}" placeholder="${label("بحث في البلاغ أو المعدة أو الوصف", "Search ticket, asset, or description")}" class="min-w-0 rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white">
          ${filterSelect("pmFilterLine", filters.line, lines, label("كل الخطوط", "All lines"))}
          ${filterSelect("pmFilterMachine", filters.machine, machines, label("كل المعدات", "All machines"))}
          <select id="pmFilterPriority" class="rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white"><option value="">${label("كل الأولويات", "All priorities")}</option>${priorities.map(value => `<option value="${escapeHtml(value)}" ${filters.priority === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select>
          <input id="pmFilterFrom" type="date" value="${escapeHtml(filters.from)}" aria-label="${label("من تاريخ (التنفيذ أو الإنشاء)", "From date (planned or created)")}" title="${label("من تاريخ (التنفيذ أو الإنشاء)", "From date (planned or created)")}" class="rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white">
          <input id="pmFilterTo" type="date" value="${escapeHtml(filters.to)}" aria-label="${label("إلى تاريخ (التنفيذ أو الإنشاء)", "To date (planned or created)")}" title="${label("إلى تاريخ (التنفيذ أو الإنشاء)", "To date (planned or created)")}" class="rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white">
          <select id="pmFilterStatus" class="rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white">
            <option value="">${label("كل الحالات", "All statuses")}</option>
            ${["unplanned", "planned", "in_progress", "completed", "deferred"].map(status => `<option value="${status}" ${filters.status === status ? "selected" : ""}>${pmStatusLabel(status)}</option>`).join("")}
          </select>
          <select id="pmFilterAssignment" class="rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white">
            <option value="">${label("مسند وغير مسند", "Assigned and unassigned")}</option>
            <option value="assigned" ${filters.assignment === "assigned" ? "selected" : ""}>${label("مسند", "Assigned")}</option>
            <option value="unassigned" ${filters.assignment === "unassigned" ? "selected" : ""}>${unassignedLabel()}</option>
          </select>
          <select id="pmFilterDowntime" class="rounded-lg border border-gray-700 bg-[#0F172A] p-2 text-xs text-white">
            <option value="">${label("كل متطلبات التوقف", "All downtime needs")}</option>
            <option value="true" ${filters.downtime === "true" ? "selected" : ""}>${label("يتطلب توقفاً", "Downtime required")}</option>
            <option value="false" ${filters.downtime === "false" ? "selected" : ""}>${label("لا يتطلب توقفاً", "No downtime required")}</option>
          </select>
          <div class="flex gap-2 sm:col-span-2 xl:col-span-4">
            <button type="button" onclick="window.exportPmOrders('excel')" class="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600">Excel</button>
            <button type="button" onclick="window.exportPmOrders('pdf')" class="flex-1 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white hover:bg-rose-600">PDF</button>
          </div>
        </div>
      </div>

      ${visibleOrders.length ? `
        <div class="overflow-x-auto rounded-xl border border-gray-800 bg-[#1E293B]">
          <table class="min-w-[1150px] w-full text-start text-xs text-gray-200">
            <thead class="sticky top-0 bg-gray-800 text-gray-300">
              <tr>${[
                label("رقم الأمر", "Work order"), label("رقم البلاغ", "Ticket"),
                label("الخط", "Line"), label("المعدة", "Equipment"),
                label("وصف المهمة", "Task description"), label("الأولوية", "Priority"),
                label("الحالة", "Status"), label("تاريخ الإنشاء", "Created"),
                label("موعد التنفيذ", "Planned date"), label("الفني / الفريق", "Assigned to"),
                label("توقف الخط", "Downtime"), label("ملاحظات التخطيط / التأجيل", "Planning / delay notes"),
                label("الإجراء", "Action")
              ].map(header => `<th class="whitespace-nowrap p-3">${header}</th>`).join("")}</tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : `<div class="rounded-xl border border-gray-800 bg-[#1E293B] p-8 text-center text-sm text-gray-400">${pmOrders.length ? label("لا توجد أوامر مطابقة للفلاتر.", "No orders match these filters.") : label("لا توجد بلاغات مصنفة PM حتى الآن.", "No tickets have been classified as PM yet.")}</div>`}
    </div>
  `;

  container.querySelector("#pmOrdersRefresh")?.addEventListener("click", () => window.loadPmOrdersBoard());
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
        <h2 class="text-lg font-black text-blue-400">${label("أوامر الصيانة الوقائية (PM)", "Preventive Maintenance Orders (PM)")}</h2>
        <p class="mt-1 text-xs text-gray-400">${label("كل أمر مرتبط بالبلاغ الأصلي؛ الإسناد والموعد اختياريان حتى يتم التخطيط لهما.", "Every order stays linked to its source ticket; assignment and schedule remain optional until planned.")}</p>
      </div>
      <button type="button" onclick="window.navigateTo('pm')" class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-bold text-white">${label("تسجيل نموذج PM", "Record PM form")}</button>
    </div>
    <div id="pmOrdersContainer" aria-live="polite" class="rounded-xl border border-gray-800 bg-[#1E293B] p-6 text-center text-xs text-gray-400">${label("جاري تحميل أوامر PM...", "Loading PM orders...")}</div>
  </section>
`;

window.loadPmOrdersBoard = async function() {
  const container = document.getElementById("pmOrdersContainer");
  if (!container) return;
  container.innerHTML = `<div class="py-6 text-center text-xs text-gray-400">${label("جاري تحميل أوامر PM...", "Loading PM orders...")}</div>`;
  const result = await fetchPmOrdersApi();
  if (result.status !== "success") {
    container.innerHTML = `<div role="alert" class="py-6 text-center text-sm text-red-300">${label("تعذر تحميل أوامر الصيانة الوقائية.", "Could not load PM orders.")} ${escapeHtml(result.message || "")}</div>`;
    return;
  }
  pmOrders = result.data;
  renderPmOrders();
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

window.exportPmOrders = async function(format) {
  const data = filteredPmOrders();
  if (!data.length) {
    alert(label("لا توجد بيانات مطابقة للتصدير.", "No matching data to export."));
    return;
  }
  const headers = [
    label("رقم أمر الصيانة", "Work order ID"), label("النوع", "Type"),
    label("خط الإنتاج", "Production line"), label("المعدة", "Equipment"),
    label("الموقع", "Location"), label("وصف المهمة", "Task description"),
    label("الأولوية", "Priority"), label("الحالة", "Status"),
    label("تاريخ الإنشاء", "Created at"), label("موعد التنفيذ المخطط", "Planned date"),
    label("الفني / الفريق", "Assigned technician / team"),
    label("توقف الخط مطلوب", "Downtime required"), label("ملاحظات التخطيط", "Planning notes"),
    label("سبب التأجيل", "Delay reason")
  ];
  const rows = data.map(order => [
    order.issueId || order.id, "PM", order.line || "",
    order.machine || "", order.location || "", order.description || "",
    order.priority || "", pmStatusLabel(order.pmStatus || "unplanned"),
    formatDisplayDate(order.createdAt), formatDisplayDate(order.plannedDate) || unscheduledLabel(),
    order.assignedTo || unassignedLabel(),
    order.downtimeRequired === true ? label("نعم", "Yes") : label("لا / غير محدد", "No / unset"),
    order.maintenanceNotes || "", order.delayReason || ""
  ]);
  const filtersSummary = [
    `${label("الخط", "Line")}: ${filters.line || label("الكل", "All")}`,
    `${label("المعدة", "Equipment")}: ${filters.machine || label("الكل", "All")}`,
    `${label("الفترة", "Planned period")}: ${filters.from || "—"} → ${filters.to || "—"}`,
    `${label("الأولوية", "Priority")}: ${filters.priority || label("الكل", "All")}`,
    `${label("الحالة", "Status")}: ${filters.status ? pmStatusLabel(filters.status) : label("الكل", "All")}`,
    `${label("الإسناد", "Assignment")}: ${filters.assignment === "assigned" ? label("مسند", "Assigned") : filters.assignment === "unassigned" ? unassignedLabel() : label("الكل", "All")}`,
    `${label("توقف الخط", "Downtime")}: ${filters.downtime === "true" ? label("يتطلب توقفاً", "Required") : filters.downtime === "false" ? label("لا يتطلب", "Not required") : label("الكل", "All")}`
  ].join(" | ");
  const title = label("تقرير أوامر الصيانة الوقائية", "Preventive Maintenance Work Orders Report");
  const filename = `pm-work-orders-${new Date().toISOString().slice(0, 10)}`;

  if (format === "excel") {
    await exportToExcel(title, headers, rows, filename, { sheetName: label("أوامر PM", "PM Orders") });
    return;
  }

  const exportTime = new Date().toLocaleString(isEn() ? "en-US" : "ar-EG");
  const tableRows = rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  const html = `
    <div dir="${isEn() ? "ltr" : "rtl"}" style="font-family:Tahoma,Arial,sans-serif;color:#172033">
      <p style="font-size:10px;line-height:1.7">${escapeHtml(label("وقت التصدير", "Exported at"))}: ${escapeHtml(exportTime)}<br>${escapeHtml(label("الفلاتر", "Filters"))}: ${escapeHtml(filtersSummary)}</p>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:8px;direction:${isEn() ? "ltr" : "rtl"}">
        <thead style="display:table-header-group"><tr>${headers.map(header => `<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:5px;overflow-wrap:anywhere">${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
  await exportToPdf(title, [{ label: label("الفلاتر المستخدمة", "Applied filters"), value: filtersSummary }], html, `${filename}.pdf`);
};
