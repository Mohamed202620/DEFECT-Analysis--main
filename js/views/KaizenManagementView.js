// ============================================================
// KaizenManagementView.js
// صفحة "متابعة وتقييم مقترحات الكايزن" (Kaizen Management & Review)
// - Dashboard + بحث/فلترة + جدول (كمبيوتر) / كروت (موبايل) - مربوطة
// بالكامل بمجموعة Firestore "kaizens" (راجع js/kaizenManagement.js
// وjs/services/kaizensApi.js). صفحة مستقلة تماماً عن 'kaizenBoard'
// (نظام مقترحات الكايزن اليومي - مجموعة "suggestions").
// ============================================================

import { KAIZEN_MGMT_STATUSES } from "../services/api.js";
import { KAIZEN_MGMT_STATUS_LABELS } from "../components/KaizenDetailsModal.js";
import { KAIZEN_CATEGORY_OPTIONS } from "../components/KaizenFormModal.js";

export const KaizenManagementView = () => {
  const currentLang = window.currentLang || "ar";
  const isEn = currentLang === "en";

  const statusOptionsHtml = KAIZEN_MGMT_STATUSES.map(s => `
    <option value="${s}">${KAIZEN_MGMT_STATUS_LABELS[s]?.[isEn ? "en" : "ar"] || s}</option>
  `).join("");

  const categoryOptionsHtml = KAIZEN_CATEGORY_OPTIONS.map(o => `
    <option value="${o.value}">${isEn ? o.en : o.ar}</option>
  `).join("");

  return `
<div class="app-page p-4 pb-24 space-y-4 text-white">

  <!-- الهيدر وزر الرجوع -->
  <div class="flex items-center justify-between border-b border-gray-800 pb-3 flex-wrap gap-2">
    <div class="flex items-center gap-3">
      <button
        type="button"
        onclick="window.navigateTo('maintenance')"
        class="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 px-3 py-2 rounded-xl text-amber-400 font-black transition-all duration-150 active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer">
        <span class="text-base rtl:rotate-180">‹</span>
        <span class="text-xs text-slate-200">${isEn ? "Back" : "رجوع"}</span>
      </button>
      <div>
        <h2 class="text-base font-black text-blue-400 flex items-center gap-2">
          <span>🏆</span> ${isEn ? "Kaizen Management & Review" : "متابعة وتقييم مقترحات الكايزن"}
        </h2>
        <p class="text-[11px] text-gray-400 mt-0.5 font-medium">
          ${isEn ? "Track, evaluate and document Kaizen improvement proposals" : "متابعة وتقييم وتوثيق مقترحات تحسين الكايزن رسمياً"}
        </p>
      </div>
    </div>

    <button
      id="kzAddNewBtn"
      type="button"
      onclick="window.openNewKaizenMgmtForm()"
      class="shrink-0 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-xl px-4 py-2.5 font-bold text-white text-xs transition-all shadow-md flex items-center gap-1.5">
      <span>➕</span> ${isEn ? "New Proposal" : "إضافة مقترح جديد"}
    </button>
  </div>

  <!-- Dashboard -->
  <div id="kzDashboardBox" class="grid grid-cols-2 md:grid-cols-4 gap-2.5">
    <div class="col-span-2 md:col-span-4 text-center text-gray-500 text-[11px] py-4">
      ${isEn ? "Loading dashboard..." : "جاري تحميل لوحة المتابعة..."}
    </div>
  </div>

  <!-- البحث والفلترة -->
  <div class="bg-[#1E293B] border border-gray-800 rounded-2xl p-3 space-y-2.5">
    <input
      type="text"
      id="kzSearchInput"
      oninput="window.setKaizenMgmtSearch(this.value)"
      placeholder="${isEn ? "Search by title, initiator, department, machine..." : "بحث بالعنوان / صاحب المقترح / القسم / الماكينة..."}"
      class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
    />

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <select
        id="kzFilterStatus"
        onchange="window.setKaizenMgmtFilter('status', this.value)"
        class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white">
        <option value="all">${isEn ? "All Statuses" : "كل الحالات"}</option>
        ${statusOptionsHtml}
      </select>

      <select
        id="kzFilterCategory"
        onchange="window.setKaizenMgmtFilter('category', this.value)"
        class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white">
        <option value="all">${isEn ? "All Categories" : "كل التصنيفات"}</option>
        ${categoryOptionsHtml}
      </select>

      <select
        id="kzFilterMachine"
        onchange="window.setKaizenMgmtFilter('machine', this.value)"
        class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white">
        <option value="all">${isEn ? "All Machines" : "كل الماكينات"}</option>
      </select>
    </div>

    <button
      type="button"
      onclick="window.loadKaizenManagement(true)"
      class="w-full bg-[#0F172A] border border-gray-700 hover:border-gray-600 rounded-lg p-2 font-bold text-gray-300 text-[11px] transition">
      🔄 ${isEn ? "Refresh" : "تحديث القائمة"}
    </button>
  </div>

  <!-- القائمة (جدول كمبيوتر / كروت موبايل) -->
  <div id="kzListContainer">
    <div class="text-center text-gray-500 text-xs py-8">
      ${isEn ? "Loading kaizen proposals..." : "جاري تحميل مقترحات الكايزن..."}
    </div>
  </div>

</div>
  `;
};
