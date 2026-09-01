import { translations } from "../config.js";

export const KnowledgeBaseView = () => {
  const currentLang = window.currentLang || "ar";
  const t = (translations[currentLang] || translations.ar).kb;
  const common = (translations[currentLang] || translations.ar).common;

  return `
<div class="app-page p-4 max-w-md mx-auto pb-24 space-y-4 text-white">

  <!-- زر الرجوع والعنوان -->
  <div class="flex items-center justify-between border-b border-gray-800 pb-3">
    <div class="flex items-center gap-3">
      <button
        type="button"
        onclick="window.navigateTo('home')"
        class="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 px-3 py-2 rounded-xl text-amber-400 font-black transition-all duration-150 active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer">
        <span class="text-base rtl:rotate-180">‹</span>
        <span class="text-xs text-slate-200">${common.back || (currentLang === 'en' ? 'Back' : 'رجوع')}</span>
      </button>
      <div>
        <h2 class="text-base font-black text-cyan-400 flex items-center gap-2">
          <span>📚</span> ${t.title || (currentLang === 'en' ? 'Knowledge Base' : 'قاعدة المعرفة')}
        </h2>
        <p class="text-[11px] text-gray-400 mt-0.5 font-medium">${t.subtitle || ''}</p>
      </div>
    </div>
  </div>

  <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] rounded-2xl p-4 border border-gray-800 shadow-xl space-y-4">

    <!-- بحث -->
    <div class="relative">
      <input id="kbSearchInput" type="text"
        oninput="window.filterKbView()"
        placeholder="${t.searchPlaceholder || (currentLang === 'en' ? 'Search solutions and breakdowns...' : 'ابحث في الحلول والأعطال السابقة...')}"
        class="w-full p-3 rtl:pr-10 ltr:pl-10 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-xs outline-none focus:border-cyan-500 transition shadow-inner">
      <span class="absolute top-3.5 rtl:right-3.5 ltr:left-3.5 text-gray-400 text-xs pointer-events-none">🔍</span>
    </div>

    <!-- تبويبات الفترة الزمنية (يومي / أسبوعي / شهري / الكل) -->
    <div class="grid grid-cols-4 gap-2" id="kbPeriodTabs">
      <button type="button" onclick="window.switchKbPeriod('day')" data-period="day"
        class="kb-period-btn py-2 rounded-xl text-[11px] font-black border transition-all duration-150 active:scale-95 cursor-pointer">
        ${t.day || (currentLang === 'en' ? 'Day' : 'اليوم')}
      </button>
      <button type="button" onclick="window.switchKbPeriod('week')" data-period="week"
        class="kb-period-btn py-2 rounded-xl text-[11px] font-black border transition-all duration-150 active:scale-95 cursor-pointer">
        ${t.week || (currentLang === 'en' ? 'Week' : 'الأسبوع')}
      </button>
      <button type="button" onclick="window.switchKbPeriod('month')" data-period="month"
        class="kb-period-btn py-2 rounded-xl text-[11px] font-black border transition-all duration-150 active:scale-95 cursor-pointer">
        ${t.month || (currentLang === 'en' ? 'Month' : 'الشهر')}
      </button>
      <button type="button" onclick="window.switchKbPeriod('all')" data-period="all"
        class="kb-period-btn py-2 rounded-xl text-[11px] font-black border transition-all duration-150 active:scale-95 cursor-pointer">
        ${t.all || (currentLang === 'en' ? 'All' : 'الكل')}
      </button>
    </div>

    <!-- ملخص الفترة المختارة (يتغيّر شكله ولونه حسب التبويب) -->
    <div id="kbSummaryBox"></div>

    <!-- قائمة الأعطال -->
    <div id="kbListBox" class="space-y-2"></div>

  </div>
</div>
`;
};
