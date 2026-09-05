import { BottomNav } from "../components/BottomNav.js";
import { translations } from "../config.js";

export const StatsView = () => {
  const currentLang = window.currentLang || "ar";
  const t = (translations[currentLang] || translations.ar).stats;
  const common = (translations[currentLang] || translations.ar).common;

  return `
<div class="app-page p-4 max-w-md mx-auto pb-28 space-y-4 text-white">

  <!-- هيدر الداشبورد وزر الرجوع والتحديث -->
  <div class="flex items-center justify-between border-b border-gray-800 pb-3">
    <div class="flex items-center gap-3">
      <button
        type="button"
        id="statsViewBackBtn"
        onclick="window.goBack('maintenance')"
        aria-label="${common.back || (currentLang === 'en' ? 'Back' : 'رجوع')}"
        class="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 px-3 py-2 rounded-xl text-amber-400 font-black transition-all duration-150 active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer">
        <span class="text-base rtl:rotate-180" aria-hidden="true">‹</span>
        <span class="text-xs text-slate-200 font-bold">${common.back || (currentLang === 'en' ? 'Back' : 'رجوع')}</span>
      </button>
      <div>
        <div class="flex items-center gap-2">
          <span class="flex h-2.5 w-2.5 relative">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <h2 class="text-sm font-black text-blue-400 flex items-center gap-1.5">
            ${t.title || (currentLang === 'en' ? 'Maintenance Dashboard & Analytics' : 'داشبورد الصيانة والتحليلات')}
          </h2>
        </div>
        <p class="text-[10px] text-gray-400 mt-0.5 font-medium">${t.subtitle || ''}</p>
      </div>
    </div>

    <!-- زر التحديث السريع -->
    <button
      type="button"
      id="statsRefreshBtn"
      onclick="window.refreshStatsDashboard()"
      aria-label="Refresh Dashboard"
      class="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-cyan-400 active:scale-90 transition-all text-xs font-bold flex items-center justify-center cursor-pointer shadow-sm">
      🔄
    </button>
  </div>

  <!-- تبويبات الفترة الزمنية التفاعلية -->
  <div class="grid grid-cols-4 gap-2" id="statsPeriodTabs">
    <button id="statsPeriodDay" data-period="day" onclick="window.switchStatsPeriod('day')"
      class="stats-period-btn py-2 rounded-xl text-[11px] font-black border transition-all duration-150 active:scale-95 bg-[#0F172A] border-gray-700 text-gray-400 hover:border-gray-600 cursor-pointer">
      🔴 ${t.day || (currentLang === 'en' ? 'Day' : 'اليوم')}
    </button>
    <button id="statsPeriodWeek" data-period="week" onclick="window.switchStatsPeriod('week')"
      class="stats-period-btn py-2 rounded-xl text-[11px] font-black border transition-all duration-150 active:scale-95 bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm cursor-pointer">
      🟠 ${t.week || (currentLang === 'en' ? 'Week' : 'الأسبوع')}
    </button>
    <button id="statsPeriodMonth" data-period="month" onclick="window.switchStatsPeriod('month')"
      class="stats-period-btn py-2 rounded-xl text-[11px] font-black border transition-all duration-150 active:scale-95 bg-[#0F172A] border-gray-700 text-gray-400 hover:border-gray-600 cursor-pointer">
      🟡 ${t.month || (currentLang === 'en' ? 'Month' : 'الشهر')}
    </button>
    <button id="statsPeriodAll" data-period="all" onclick="window.switchStatsPeriod('all')"
      class="stats-period-btn py-2 rounded-xl text-[11px] font-black border transition-all duration-150 active:scale-95 bg-[#0F172A] border-gray-700 text-gray-400 hover:border-gray-600 cursor-pointer">
      📚 ${t.all || (currentLang === 'en' ? 'All' : 'الكل')}
    </button>
  </div>

  <!-- بطاقات مؤشرات الأداء الحيوية الأساسية (Top KPIs Grid) -->
  <div id="statsSummaryBox" class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
    <div class="text-center text-gray-500 text-[11px] py-4 col-span-2 sm:col-span-4">${t.loadingStats || (currentLang === 'en' ? 'Analyzing metrics...' : 'جاري تحليل وتحديث مؤشرات الداشبورد...')}</div>
  </div>

  <!-- شريط مؤشر كفاءة الإغلاق والجاهزية التشغيلية -->
  <div id="statsEfficiencyBanner" class="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 p-3.5 rounded-2xl shadow-md">
    <div class="flex items-center justify-between text-xs font-bold mb-2">
      <span class="flex items-center gap-1.5 text-indigo-200">
        <span>⚡</span> ${t.kpiEfficiency || (currentLang === 'en' ? 'Resolution Efficiency' : 'كفاءة إغلاق البلاغات')}
      </span>
      <span id="statsEfficiencyPercent" class="text-emerald-400 font-black text-sm">--%</span>
    </div>
    <div class="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
      <div id="statsEfficiencyBar" class="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500" style="width: 0%"></div>
    </div>
    <div class="flex items-center justify-between text-[10px] text-gray-400 mt-2 font-medium">
      <span id="statsEfficiencyResolved">0 تم حلها</span>
      <span id="statsEfficiencyPending">0 قيد العمل</span>
    </div>
  </div>

  <!-- رسم بياني 1: معدل وتدفق الأعطال اليومية (Daily Breakdown Trend) -->
  <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-black text-gray-200 flex items-center gap-1.5">
        <span>📉</span> ${t.breakdownTrend || (currentLang === 'en' ? 'Ticket Trend & Daily Intake' : 'اتجاه ومعدل البلاغات اليومي')}
      </span>
      <span id="statsTrendBadge" class="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 font-bold">
        --
      </span>
    </div>
    <div style="height: 180px;" class="relative">
      <canvas id="statsTrendChart" class="hidden"></canvas>
      <div id="statsTrendEmpty" class="hidden text-center text-gray-500 text-[11px] py-12">
        ${t.noChartData || (currentLang === 'en' ? 'No chart data' : 'لا توجد بيانات كافية')}
      </div>
    </div>
  </div>

  <!-- شبكة الرسوم التفاعلية: ماكينات عطلاً + توزيع الأولويات (2 Charts) -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <!-- أكثر الماكينات عطلاً -->
    <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
      <div class="flex items-center justify-between border-b border-gray-800 pb-2">
        <span class="text-xs font-black text-gray-200 flex items-center gap-1.5">
          <span>🏭</span> ${t.topMachines || (currentLang === 'en' ? 'Top Problematic Machines' : 'أكثر الماكينات تكراراً للأعطال')}
        </span>
      </div>
      <div style="height: 200px;" class="relative">
        <canvas id="statsMachineChart" class="hidden"></canvas>
        <div id="statsMachineEmpty" class="hidden text-center text-gray-500 text-[11px] py-12">
          ${t.noChartData || (currentLang === 'en' ? 'No chart data' : 'لا توجد بيانات')}
        </div>
      </div>
    </div>

    <!-- توزيع الأولويات ودرجة الخطورة -->
    <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
      <div class="flex items-center justify-between border-b border-gray-800 pb-2">
        <span class="text-xs font-black text-gray-200 flex items-center gap-1.5">
          <span>🎯</span> ${t.priorityDist || (currentLang === 'en' ? 'Priority Distribution' : 'توزيع الأولويات ودرجة الخطورة')}
        </span>
      </div>
      <div style="height: 200px;" class="relative">
        <canvas id="statsPriorityChart" class="hidden"></canvas>
        <div id="statsPriorityEmpty" class="hidden text-center text-gray-500 text-[11px] py-12">
          ${t.noChartData || (currentLang === 'en' ? 'No chart data' : 'لا توجد بيانات')}
        </div>
      </div>
    </div>
  </div>

  <!-- متوسط زمن الإصلاح MTTR (كارت تشغيلي مخصص) -->
  <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] border border-cyan-500/30 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-black text-cyan-300 flex items-center gap-1.5">
        <span>⏱️</span> ${t.mttr || (currentLang === 'en' ? 'MTTR (Mean Time to Repair)' : 'متوسط زمن الإصلاح (MTTR)')}
      </span>
      <span class="text-[10px] text-cyan-400/80 bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-800/60 font-mono">
        Speed KPI
      </span>
    </div>
    <div id="statsMttrBox">
      <div class="text-center text-gray-500 text-[11px] py-4">${common.loading || (currentLang === 'en' ? 'Loading...' : 'جاري التحميل...')}</div>
    </div>
  </div>

  <!-- توزيع الأعطال حسب خطوط الإنتاج -->
  <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-black text-gray-200 flex items-center gap-1.5">
        <span>🏗️</span> ${t.lineDist || (currentLang === 'en' ? 'Defect Density by Production Line' : 'كثافة الأعطال حسب خطوط الإنتاج')}
      </span>
    </div>
    <div id="statsLineBreakdown" class="space-y-2.5">
      <div class="text-center text-gray-500 text-[11px] py-4">${common.loading || (currentLang === 'en' ? 'Loading...' : 'جاري التحميل...')}</div>
    </div>
  </div>

  <!-- أداء الفنيين وسجل الإنجازات -->
  <div class="bg-gradient-to-b from-[#1E293B] to-[#0F172A] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-black text-gray-200 flex items-center gap-1.5">
        <span>🧑‍🔧</span> ${t.techPerf || (currentLang === 'en' ? 'Technicians Performance' : 'سجل إنجازات الفنيين المعتمدة')}
      </span>
    </div>
    <div id="statsTechBox" class="space-y-2.5">
      <div class="text-center text-gray-500 text-[11px] py-4">${common.loading || (currentLang === 'en' ? 'Loading...' : 'جاري التحميل...')}</div>
    </div>
  </div>

</div>

${BottomNav("maintenance")}
`;
};
