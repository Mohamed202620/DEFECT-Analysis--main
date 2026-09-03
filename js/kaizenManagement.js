// ============================================================
// kaizenManagement.js
// منطق صفحة "متابعة وتقييم مقترحات الكايزن" (Kaizen Management &
// Review) - مربوطة بمجموعة Firestore "kaizens" (راجع
// services/kaizensApi.js) - مستقلة تماماً عن kaizenBoard.js/
// suggestionsApi.js (مجموعة "suggestions" المختلفة تماماً).
// ============================================================

import {
  fetchKaizensApi,
  addKaizenApi
} from "./services/api.js";

import { openKaizenFormModal, KAIZEN_CATEGORY_OPTIONS } from "./components/KaizenFormModal.js";
import {
  openKaizenDetailsModal,
  KAIZEN_MGMT_STATUS_LABELS,
  KAIZEN_MGMT_STATUS_CLASSES
} from "./components/KaizenDetailsModal.js";
import { exportKaizenPDF } from "./services/kaizenPdfExport.js";

// ============================================================
// الحالة المحلية للصفحة
// ============================================================

let allKaizens = [];              // كل المستندات المجلوبة من Firestore (بدون فلترة)
let kaizenMgmtItemsById = {};     // خريطة id -> بيانات كاملة (لفتح التفاصيل بدون طلب إضافي)
let kzFilters = { search: "", status: "all", category: "all", machine: "all" };
let kaizenMgmtLoaded = false;

function isEnLang() {
  return (window.currentLang || "ar") === "en";
}

function escapeKzHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatKzMgmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(isEnLang() ? "en-US" : "ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return escapeKzHtml(iso);
  }
}

// ============================================================
// تحميل البيانات (fetchKaizens)
// ============================================================

window.loadKaizenManagement = async function (forceRefresh = false) {

  const dashboardBox = document.getElementById("kzDashboardBox");
  const listBox = document.getElementById("kzListContainer");

  if (!listBox) return;

  if (!kaizenMgmtLoaded || forceRefresh) {
    listBox.innerHTML = `<div class="text-center text-gray-500 text-xs py-8">${isEnLang() ? "Loading kaizen proposals..." : "جاري تحميل مقترحات الكايزن..."}</div>`;

    const result = await fetchKaizensApi({});

    if (result.status !== "success") {
      listBox.innerHTML = `<div class="text-red-400 text-center text-xs py-6">${isEnLang() ? "Failed to load data, please try again." : "تعذر تحميل البيانات، حاول مرة أخرى."}</div>`;
      return;
    }

    allKaizens = Array.isArray(result.data) ? result.data : [];
    kaizenMgmtItemsById = {};
    allKaizens.forEach(item => { kaizenMgmtItemsById[item.id] = item; });
    kaizenMgmtLoaded = true;
  }

  renderKaizenDashboard();
  renderKaizenMachineFilterOptions();
  renderKaizenList();

};

// ============================================================
// Dashboard
// ============================================================

function renderKaizenDashboard() {
  const box = document.getElementById("kzDashboardBox");
  if (!box) return;

  const isEn = isEnLang();
  const total = allKaizens.length;
  const underReview = allKaizens.filter(k => (k.status || "submitted") === "under_review").length;
  const approvedOrImplemented = allKaizens.filter(k => ["approved", "implemented"].includes(k.status)).length;
  const impactCount = allKaizens.filter(k => Array.isArray(k.benefits) && k.benefits.some(b => b && (b.improvement || b.after))).length;

  const cards = [
    { icon: "📋", label: isEn ? "Total Proposals" : "إجمالي المقترحات", value: total, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { icon: "🔍", label: isEn ? "Under Review" : "قيد المراجعة", value: underReview, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    { icon: "✅", label: isEn ? "Approved / Implemented" : "المعتمد / المنفذ", value: approvedOrImplemented, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { icon: "📈", label: isEn ? "Measured Impact" : "الأثر والعائد", value: impactCount, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" }
  ];

  box.innerHTML = cards.map(c => `
    <div class="rounded-2xl border ${c.bg} p-3 text-center">
      <div class="text-lg mb-1">${c.icon}</div>
      <div class="text-lg font-black ${c.color}">${c.value}</div>
      <div class="text-[10px] text-gray-400 font-bold mt-0.5">${c.label}</div>
    </div>
  `).join("");
}

// ============================================================
// خيارات فلتر الماكينة (مبنية ديناميكياً من البيانات الفعلية فقط)
// ============================================================

function renderKaizenMachineFilterOptions() {
  const select = document.getElementById("kzFilterMachine");
  if (!select) return;

  const machines = Array.from(new Set(allKaizens.map(k => k.machine).filter(Boolean))).sort();
  const isEn = isEnLang();
  const current = select.value || "all";

  select.innerHTML = `
    <option value="all">${isEn ? "All Machines" : "كل الماكينات"}</option>
    ${machines.map(m => `<option value="${escapeKzHtml(m)}" ${m === current ? "selected" : ""}>${escapeKzHtml(m)}</option>`).join("")}
  `;
}

// ============================================================
// الفلترة والبحث (Client-side - نفس أسلوب fetchSuggestionsForSearchApi)
// ============================================================

function getFilteredKaizens() {
  const search = kzFilters.search.trim().toLowerCase();

  return allKaizens.filter(k => {

    if (kzFilters.status !== "all" && (k.status || "submitted") !== kzFilters.status) return false;
    if (kzFilters.category !== "all" && (k.category || "") !== kzFilters.category) return false;
    if (kzFilters.machine !== "all" && (k.machine || "") !== kzFilters.machine) return false;

    if (search) {
      const haystack = [
        k.title, k.initiator, k.department, k.machine, k.line, k.kaizenNumber
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

window.setKaizenMgmtSearch = function (value) {
  kzFilters.search = value || "";
  renderKaizenList();
};

window.setKaizenMgmtFilter = function (key, value) {
  kzFilters[key] = value || "all";
  renderKaizenList();
};

// ============================================================
// عرض القائمة - جدول (كمبيوتر) + كروت (موبايل)
// ============================================================

function categoryLabel(value) {
  if (!value) return "—";
  const found = KAIZEN_CATEGORY_OPTIONS.find(o => o.value === value);
  if (!found) return escapeKzHtml(value);
  return escapeKzHtml(isEnLang() ? found.en : found.ar);
}

function statusBadgeHtml(status) {
  const s = status || "submitted";
  const cls = KAIZEN_MGMT_STATUS_CLASSES[s] || "bg-gray-500/10 text-gray-400 border border-gray-500/20";
  const label = KAIZEN_MGMT_STATUS_LABELS[s]?.[isEnLang() ? "en" : "ar"] || s;
  return `<span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${cls}">${label}</span>`;
}

function actionButtonsHtml(id) {
  const isEn = isEnLang();
  return `
    <div class="flex flex-wrap gap-1.5">
      <button onclick="window.openKaizenMgmtDetails('${id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition active:scale-95">
        👁️ ${isEn ? "Details" : "التفاصيل"}
      </button>
      <button onclick="window.exportKaizenMgmtPdf('${id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition active:scale-95">
        📄 PDF
      </button>
    </div>
  `;
}

function kaizenCardHtml(k) {
  const isEn = isEnLang();
  const machineOrLine = [k.line, k.machine].filter(Boolean).join(" - ") || "—";
  return `
    <div class="bg-[#1E293B] border border-gray-800 rounded-2xl p-4 space-y-2 mb-3">
      <div class="flex justify-between items-start gap-2">
        <div class="min-w-0">
          <div class="text-[10px] text-amber-400 font-bold mb-0.5">${escapeKzHtml(k.kaizenNumber || "—")}</div>
          <span class="font-bold text-sm text-gray-100 break-words">${escapeKzHtml(k.title || "-")}</span>
        </div>
        ${statusBadgeHtml(k.status)}
      </div>
      <div class="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
        <span>👤 ${escapeKzHtml(k.initiator || "—")}</span>
        <span>🏢 ${escapeKzHtml(k.department || "—")}</span>
        <span>⚙️ ${escapeKzHtml(machineOrLine)}</span>
        <span>🏷️ ${categoryLabel(k.category)}</span>
        <span>📅 ${formatKzMgmtDate(k.submissionDate || k.createdAt)}</span>
      </div>
      <div class="pt-2 border-t border-gray-800">${actionButtonsHtml(k.id)}</div>
    </div>
  `;
}

function kaizenTableRowHtml(k, index) {
  const machineOrLine = [k.line, k.machine].filter(Boolean).join(" - ") || "—";
  return `
    <tr class="border-b border-gray-800 hover:bg-white/[0.02] transition-colors">
      <td class="p-2.5 text-gray-500 text-[11px]">${index + 1}</td>
      <td class="p-2.5 text-amber-400 text-[11px] font-bold whitespace-nowrap">${escapeKzHtml(k.kaizenNumber || "—")}</td>
      <td class="p-2.5 text-gray-100 text-[11px] font-bold max-w-[220px] truncate" title="${escapeKzHtml(k.title || "")}">${escapeKzHtml(k.title || "-")}</td>
      <td class="p-2.5 text-gray-400 text-[11px]">${escapeKzHtml(k.initiator || "—")}</td>
      <td class="p-2.5 text-gray-400 text-[11px]">${escapeKzHtml(k.department || "—")}</td>
      <td class="p-2.5 text-gray-400 text-[11px] whitespace-nowrap">${escapeKzHtml(machineOrLine)}</td>
      <td class="p-2.5 text-gray-400 text-[11px]">${categoryLabel(k.category)}</td>
      <td class="p-2.5">${statusBadgeHtml(k.status)}</td>
      <td class="p-2.5 text-gray-500 text-[11px] whitespace-nowrap">${formatKzMgmtDate(k.submissionDate || k.createdAt)}</td>
      <td class="p-2.5">${actionButtonsHtml(k.id)}</td>
    </tr>
  `;
}

function renderKaizenList() {
  const listBox = document.getElementById("kzListContainer");
  if (!listBox) return;

  const isEn = isEnLang();
  const filtered = getFilteredKaizens();

  if (!filtered.length) {
    listBox.innerHTML = `
      <div class="text-center text-gray-500 text-xs py-10 bg-[#1E293B] border border-gray-800 rounded-2xl">
        ${isEn ? "No kaizen proposals match the current filters." : "لا توجد مقترحات كايزن مطابقة للفلاتر الحالية."}
      </div>
    `;
    return;
  }

  const tableHtml = `
    <div class="hidden md:block overflow-x-auto bg-[#1E293B] border border-gray-800 rounded-2xl">
      <table class="w-full text-right border-collapse">
        <thead>
          <tr class="bg-[#0F172A] text-gray-400 text-[10px] uppercase">
            <th class="p-2.5 font-bold">#</th>
            <th class="p-2.5 font-bold">${isEn ? "No." : "الرقم"}</th>
            <th class="p-2.5 font-bold">${isEn ? "Title" : "العنوان"}</th>
            <th class="p-2.5 font-bold">${isEn ? "Initiator" : "صاحب المقترح"}</th>
            <th class="p-2.5 font-bold">${isEn ? "Department" : "القسم"}</th>
            <th class="p-2.5 font-bold">${isEn ? "Line / Machine" : "الخط / الماكينة"}</th>
            <th class="p-2.5 font-bold">${isEn ? "Category" : "التصنيف"}</th>
            <th class="p-2.5 font-bold">${isEn ? "Status" : "الحالة"}</th>
            <th class="p-2.5 font-bold">${isEn ? "Date" : "التاريخ"}</th>
            <th class="p-2.5 font-bold">${isEn ? "Actions" : "إجراءات"}</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((k, idx) => kaizenTableRowHtml(k, idx)).join("")}
        </tbody>
      </table>
    </div>
  `;

  const cardsHtml = `
    <div class="md:hidden">
      ${filtered.map(kaizenCardHtml).join("")}
    </div>
  `;

  listBox.innerHTML = tableHtml + cardsHtml;
}

// ============================================================
// الإجراءات: تفاصيل/مراجعة - تصدير PDF - إضافة جديد
// ============================================================

window.openKaizenMgmtDetails = function (id) {
  const kaizen = kaizenMgmtItemsById[id];
  if (!kaizen) return;
  openKaizenDetailsModal(kaizen, {
    onStatusUpdated: () => window.loadKaizenManagement(true)
  });
};

window.exportKaizenMgmtPdf = async function (id) {
  const kaizen = kaizenMgmtItemsById[id];
  if (!kaizen) return;
  await exportKaizenPDF(kaizen);
};

window.openNewKaizenMgmtForm = async function () {
  const data = await openKaizenFormModal();
  if (!data) return;

  const btn = document.getElementById("kzAddNewBtn");
  const original = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = isEnLang() ? "⏳ Saving..." : "⏳ جاري الحفظ...";
  }

  const result = await addKaizenApi(data);

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = original;
  }

  if (result.status !== "success") {
    alert("❌ " + (result.message || (isEnLang() ? "Failed to save, try again." : "فشل الحفظ، حاول مرة أخرى.")));
    return;
  }

  await window.loadKaizenManagement(true);
};
