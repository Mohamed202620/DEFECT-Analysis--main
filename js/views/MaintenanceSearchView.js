// ============================================================
// MaintenanceSearchView.js
// صفحة "البحث والفلترة المتقدمة" - تجميع بلاغات الأعطال (tickets)
// وسجلات الصيانة الوقائية (pmRecords) في مكان واحد، مع بحث نصي
// وفلاتر (النوع/الحالة/الماكينة/الأولوية) وترتيب النتائج.
// المنطق الفعلي (تحميل البيانات + الفلترة + العرض) في
// js/maintenanceSearch.js - نفس أسلوب knowledgeBase.js / KnowledgeBaseView.js
// ============================================================

import { translations } from '../config.js';
import { buildMachineDropdownHtml } from '../machines.js';

export const MaintenanceSearchView = () => {
  const currentLang = window.currentLang || "ar";
  const t = (translations[currentLang] || translations.ar).maintenanceSearch;
  const common = (translations[currentLang] || translations.ar).common;

  return `
<div class="app-page p-4 max-w-md mx-auto pb-24 space-y-4 text-white">

  <!-- زر الرجوع والعنوان -->
  <div class="flex items-center justify-between border-b border-gray-800 pb-3">
    <div class="flex items-center gap-3">
      <button
        type="button"
        onclick="window.navigateTo('maintenance')"
        class="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 px-3 py-2 rounded-xl text-amber-400 font-black transition-all duration-150 active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer">
        <span class="text-base rtl:rotate-180">‹</span>
        <span class="text-xs text-slate-200">${common.back || (currentLang === 'en' ? 'Back' : 'رجوع')}</span>
      </button>
      <div>
        <h2 class="text-base font-black text-blue-400 flex items-center gap-2">
          <span>🔎</span> ${t.title || (currentLang === 'en' ? 'Advanced Maintenance Search' : 'البحث والفلترة المتقدمة')}
        </h2>
        <p class="text-[11px] text-gray-400 mt-0.5 font-medium">${t.subtitle || ''}</p>
      </div>
    </div>
  </div>

  <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] rounded-2xl p-4 border border-gray-800 shadow-xl space-y-4">

    <!-- بحث نصي -->
    <div class="relative">
      <input id="mSearchInput" type="text"
        oninput="window.applyMaintenanceSearchFilters()"
        placeholder="${t.searchPlaceholder || (currentLang === 'en' ? 'Search tickets, records, keywords...' : 'ابحث برقم البلاغ، اسم الماكينة، العطل...')}"
        class="w-full p-3 rtl:pr-10 ltr:pl-10 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-xs outline-none focus:border-blue-500 transition shadow-inner">
      <span class="absolute top-3.5 rtl:right-3.5 ltr:left-3.5 text-gray-400 text-xs pointer-events-none">🔍</span>
    </div>

    <!-- نوع السجل -->
    <div class="grid grid-cols-4 gap-1.5" id="mTypeTabs">
      <button type="button" onclick="window.switchMaintenanceSearchType('all')" data-type="all"
        class="m-type-btn py-2 rounded-xl text-[10px] font-black border transition-all duration-150 active:scale-95 cursor-pointer">
        ${t.typeAll || (currentLang === 'en' ? 'All' : 'الكل')}
      </button>
      <button type="button" onclick="window.switchMaintenanceSearchType('ticket')" data-type="ticket"
        class="m-type-btn py-2 rounded-xl text-[10px] font-black border transition-all duration-150 active:scale-95 cursor-pointer">
        ${t.typeTicket || (currentLang === 'en' ? 'Tickets' : 'البلاغات')}
      </button>
      <button type="button" onclick="window.switchMaintenanceSearchType('pm')" data-type="pm"
        class="m-type-btn py-2 rounded-xl text-[10px] font-black border transition-all duration-150 active:scale-95 cursor-pointer">
        ${t.typePm || (currentLang === 'en' ? 'PM Records' : 'الوقائية')}
      </button>
      <button type="button" onclick="window.switchMaintenanceSearchType('suggestion')" data-type="suggestion"
        class="m-type-btn py-2 rounded-xl text-[10px] font-black border transition-all duration-150 active:scale-95 cursor-pointer">
        ${t.typeSuggestion || (currentLang === 'en' ? 'Kaizen' : 'كايزن')}
      </button>
    </div>

    <!-- فلتر التاريخ -->
    <div class="grid grid-cols-2 gap-2">
      <select id="mDateFilter" onchange="window.handleMaintenanceSearchDateFilterChange()"
        class="col-span-2 w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-[11px] outline-none focus:border-blue-500 transition shadow-inner cursor-pointer">
        <option value="all">${t.dateAll || (currentLang === 'en' ? 'All Dates' : 'جميع التواريخ')}</option>
        <option value="today">${t.dateToday || (currentLang === 'en' ? 'Today' : 'اليوم')}</option>
        <option value="last7">${t.dateLast7 || (currentLang === 'en' ? 'Last 7 Days' : 'آخر 7 أيام')}</option>
        <option value="month">${t.dateMonth || (currentLang === 'en' ? 'This Month' : 'هذا الشهر')}</option>
        <option value="year">${t.dateYear || (currentLang === 'en' ? 'This Year' : 'هذه السنة')}</option>
        <option value="custom">${t.dateCustom || (currentLang === 'en' ? 'Custom Date Range...' : 'تحديد فترة مخصصة...')}</option>
      </select>

      <input id="mDateFrom" type="date" onchange="window.applyMaintenanceSearchFilters()"
        class="hidden w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-[11px] outline-none focus:border-blue-500 transition shadow-inner">
      <input id="mDateTo" type="date" onchange="window.applyMaintenanceSearchFilters()"
        class="hidden w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-[11px] outline-none focus:border-blue-500 transition shadow-inner">
    </div>

    <!-- فلاتر إضافية -->
    <div class="grid grid-cols-2 gap-2">

      <select id="mStatusFilter" onchange="window.applyMaintenanceSearchFilters()"
        class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-[11px] outline-none focus:border-blue-500 transition shadow-inner cursor-pointer">
        <option value="all">${t.statusAll || (currentLang === 'en' ? 'All Statuses' : 'جميع الحالات')}</option>
        <option value="pending">${t.statusPending || (currentLang === 'en' ? 'Pending' : 'جديد / معلق')}</option>
        <option value="assigned">${t.statusAssigned || (currentLang === 'en' ? 'Assigned' : 'تم التعيين')}</option>
        <option value="in_progress">${t.statusInProgress || (currentLang === 'en' ? 'In Progress' : 'قيد العمل')}</option>
        <option value="resolved">${t.statusResolved || (currentLang === 'en' ? 'Resolved' : 'تم الإصلاح')}</option>
        <option value="closed">${t.statusClosed || (currentLang === 'en' ? 'Closed' : 'مغلق')}</option>
      </select>

      <select id="mPriorityFilter" onchange="window.applyMaintenanceSearchFilters()"
        class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-[11px] outline-none focus:border-blue-500 transition shadow-inner cursor-pointer">
        <option value="all">${t.priorityAll || (currentLang === 'en' ? 'All Priorities' : 'جميع الأولويات')}</option>
        <option value="High">${t.priorityHigh || (currentLang === 'en' ? 'High' : 'عالية')}</option>
        <option value="Medium">${t.priorityMedium || (currentLang === 'en' ? 'Medium' : 'متوسطة')}</option>
        <option value="Low">${t.priorityLow || (currentLang === 'en' ? 'Low' : 'منخفضة')}</option>
      </select>

      <!-- إصلاح M4: نفس Dropdown الماكينات الموحّد (نوع + وحدة فرعية،
           زي Bodymaker 01...11) المستخدم في تسجيل بلاغ عطل ومقترح
           كايزن (machines.js) - بدل قائمة ثابتة يدوية بقيم مش مطابقة
           لأسماء الماكينات الفعلية المحفوظة (زي "Bodymaker" بمفرده،
           أو قيم قديمة زي "machine2"/"line1" مبقتش موجودة في البيانات
           الحالية أصلاً) - مع خيار "الكل" وربط التغيير بـ
           applyMaintenanceSearchFilters() زي باقي فلاتر الصفحة -->
      ${buildMachineDropdownHtml("mMachineFilter", {
        includePlaceholder: false,
        includeAll: true,
        allLabel: t.machineAll || (currentLang === 'en' ? 'All Machines' : 'جميع الماكينات'),
        allValue: 'all',
        typeSelectClass: "col-span-2 w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-[11px] outline-none focus:border-blue-500 transition shadow-inner cursor-pointer",
        unitSelectClass: "col-span-2 w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-[11px] outline-none focus:border-blue-500 transition shadow-inner cursor-pointer mt-2",
        hiddenOnChange: "window.applyMaintenanceSearchFilters()"
      })}

      <select id="mSortFilter" onchange="window.applyMaintenanceSearchFilters()"
        class="col-span-2 w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-[11px] outline-none focus:border-blue-500 transition shadow-inner cursor-pointer">
        <option value="newest">${t.sortNewest || (currentLang === 'en' ? 'Newest First' : 'الأحدث أولاً')}</option>
        <option value="oldest">${t.sortOldest || (currentLang === 'en' ? 'Oldest First' : 'الأقدم أولاً')}</option>
      </select>

    </div>

    <!-- ملخص النتائج + تصدير -->
    <div class="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-gray-800">
      <div id="mResultsSummary" class="text-[10px] text-gray-400 px-1 font-medium"></div>
      <div class="flex items-center gap-1.5">
        <button type="button" onclick="window.exportMaintenanceSearchResults()"
          class="shrink-0 text-[10px] font-black px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 active:scale-95 transition-all duration-150 shadow-sm cursor-pointer">
          📊 ${t.exportExcel || (currentLang === 'en' ? 'Excel' : 'تصدير إكسيل')}
        </button>
        <button type="button" id="mExportPdfBtn" onclick="window.exportMaintenanceSearchResultsPdf()"
          class="shrink-0 text-[10px] font-black px-3 py-1.5 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 active:scale-95 transition-all duration-150 shadow-sm cursor-pointer">
          📄 ${t.exportPdf || (currentLang === 'en' ? 'PDF' : 'تصدير PDF')}
        </button>
      </div>
    </div>

    <!-- النتائج -->
    <div id="mResultsBox" class="space-y-2"></div>

  </div>
</div>
`;
};
