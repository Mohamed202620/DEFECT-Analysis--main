import { BottomNav } from "../components/BottomNav.js";
import { translations } from "../config.js";

export const StatsView = () => {
  const currentLang = window.currentLang || "ar";
  const t = (translations[currentLang] || translations.ar).stats;
  const common = (translations[currentLang] || translations.ar).common;

  return `
<div class="app-page p-4 max-w-md mx-auto pb-24 space-y-4 text-white">

  <!-- زر الرجوع والعنوان -->
  <div class="flex items-center justify-between border-b border-gray-800 pb-3">
    <div class="flex items-center gap-3">
      <button
        type="button"
        onclick="window.navigateTo('quality')"
        class="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 px-3 py-2 rounded-xl text-amber-400 font-black transition-all duration-150 active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer">
        <span class="text-base rtl:rotate-180">‹</span>
        <span class="text-xs text-slate-200">${common.back || (currentLang === 'en' ? 'Back' : 'رجوع')}</span>
      </button>
      <div>
        <h2 class="text-base font-black text-blue-400 flex items-center gap-2">
          <span>📈</span> ${t.title || (currentLang === 'en' ? 'Analytics & Performance' : 'الإحصائيات والأداء')}
        </h2>
        <p class="text-[11px] text-gray-400 mt-0.5 font-medium">${t.subtitle || ''}</p>
      </div>
    </div>
  </div>

  <!-- تبويبات الفترة الزمنية -->
  <div class="grid grid-cols-4 gap-2">
    <button data-period="day" onclick="window.switchStatsPeriod('day')"
      class="stats-period-btn py-2 rounded-xl text-[11px] font-black border transition-all duration-150 active:scale-95 bg-[#0F172A] border-gray-700 text-gray-400 hover:border-gray-600 cursor-pointer">
      🔴 ${t.day || (currentLang === 'en' ? 'Day' : 'اليوم')}
    </button>
    <button data-period="week" onclick="window.switchStatsPeriod('week')"
      class="stats-period-btn py-2 rounded-xl text-[11px] font-black border transition-all duration-150 active:scale-95 bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm cursor-pointer">
      🟠 ${t.week || (currentLang === 'en' ? 'Week' : 'الأسبوع')}
    </button>
    <button data-period="month" onclick="window.switchStatsPeriod('month')"
      class="stats-period-btn py-2 rounded-xl text-[11px] font-black border transition-all duration-150 active:scale-95 bg-[#0F172A] border-gray-700 text-gray-400 hover:border-gray-600 cursor-pointer">
      🟡 ${t.month || (currentLang === 'en' ? 'Month' : 'الشهر')}
    </button>
    <button data-period="all" onclick="window.switchStatsPeriod('all')"
      class="stats-period-btn py-2 rounded-xl text-[11px] font-black border transition-all duration-150 active:scale-95 bg-[#0F172A] border-gray-700 text-gray-400 hover:border-gray-600 cursor-pointer">
      📚 ${t.all || (currentLang === 'en' ? 'All' : 'الكل')}
    </button>
  </div>

  <!-- بطاقات الملخص -->
  <div id="statsSummaryBox" class="grid grid-cols-4 gap-2">
    <div class="text-center text-gray-500 text-[11px] py-4 col-span-4">${t.loadingStats || (currentLang === 'en' ? 'Loading metrics...' : 'جاري تحميل الإحصائيات...')}</div>
  </div>

  <!-- أكثر الماكينات عطلاً -->
  <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-black text-gray-200 flex items-center gap-1.5">
        <span>🏭</span> ${t.topMachines || (currentLang === 'en' ? 'Top Problematic Machines' : 'أكثر الماكينات عطلاً')}
      </span>
    </div>
    <div style="height: 200px;" class="relative">
      <canvas id="statsMachineChart" class="hidden"></canvas>
      <div id="statsMachineEmpty" class="hidden text-center text-gray-500 text-[11px] py-8">
        ${t.noChartData || (currentLang === 'en' ? 'No chart data' : 'لا توجد بيانات')}
      </div>
    </div>
  </div>

  <!-- توزيع الأولويات -->
  <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-black text-gray-200 flex items-center gap-1.5">
        <span>🎯</span> ${t.priorityDist || (currentLang === 'en' ? 'Priority Distribution' : 'توزيع الأولويات')}
      </span>
    </div>
    <div style="height: 180px;" class="relative">
      <canvas id="statsPriorityChart" class="hidden"></canvas>
      <div id="statsPriorityEmpty" class="hidden text-center text-gray-500 text-[11px] py-8">
        ${t.noChartData || (currentLang === 'en' ? 'No chart data' : 'لا توجد بيانات')}
      </div>
    </div>
  </div>

  <!-- توزيع الخطوط -->
  <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-black text-gray-200 flex items-center gap-1.5">
        <span>🏗️</span> ${t.lineDist || (currentLang === 'en' ? 'Production Lines Breakdown' : 'توزيع خطوط الإنتاج')}
      </span>
    </div>
    <div id="statsLineBreakdown" class="space-y-2.5">
      <div class="text-center text-gray-500 text-[11px] py-4">${common.loading || (currentLang === 'en' ? 'Loading...' : 'جاري التحميل...')}</div>
    </div>
  </div>

  <!-- متوسط زمن الإصلاح (MTTR) -->
  <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-black text-gray-200 flex items-center gap-1.5">
        <span>⏱️</span> ${t.mttr || (currentLang === 'en' ? 'MTTR (Mean Time to Repair)' : 'متوسط زمن الإصلاح')}
      </span>
    </div>
    <div id="statsMttrBox">
      <div class="text-center text-gray-500 text-[11px] py-4">${common.loading || (currentLang === 'en' ? 'Loading...' : 'جاري التحميل...')}</div>
    </div>
  </div>

  <!-- أداء الفنيين -->
  <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-black text-gray-200 flex items-center gap-1.5">
        <span>🧑‍🔧</span> ${t.techPerf || (currentLang === 'en' ? 'Technicians Performance' : 'أداء الفنيين')}
      </span>
    </div>
    <div id="statsTechBox" class="space-y-2.5">
      <div class="text-center text-gray-500 text-[11px] py-4">${common.loading || (currentLang === 'en' ? 'Loading...' : 'جاري التحميل...')}</div>
    </div>
  </div>

</div>

${BottomNav("quality")}
`;
};
