import { BottomNav } from "../components/BottomNav.js";

export const StatsView = () => `
<div class="app-page p-4 max-w-md mx-auto pb-24 space-y-4 text-white">

  <!-- زر الرجوع والعنوان -->
  <div class="flex items-center justify-between border-b border-gray-800 pb-3">
    <div class="flex items-center gap-3">
      <button
        onclick="window.navigateTo('quality')"
        class="bg-gray-800 hover:bg-gray-700 p-2 rounded-lg text-white transition active:scale-95 shadow-sm">
        ⬅
      </button>
      <div>
        <h2 class="text-base font-bold text-blue-400 flex items-center gap-2">
          <span>📈</span> الإحصائيات
        </h2>
        <p class="text-[11px] text-gray-400 mt-0.5">تحليل بلاغات الأعطال حسب الفترة</p>
      </div>
    </div>
  </div>

  <!-- تبويبات الفترة الزمنية -->
  <div class="grid grid-cols-4 gap-2">
    <button data-period="day" onclick="window.switchStatsPeriod('day')"
      class="stats-period-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95 bg-[#0F172A] border-gray-700 text-gray-400">
      🔴 اليوم
    </button>
    <button data-period="week" onclick="window.switchStatsPeriod('week')"
      class="stats-period-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95 bg-amber-500/15 border-amber-500/50 text-amber-300">
      🟠 الأسبوع
    </button>
    <button data-period="month" onclick="window.switchStatsPeriod('month')"
      class="stats-period-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95 bg-[#0F172A] border-gray-700 text-gray-400">
      🟡 الشهر
    </button>
    <button data-period="all" onclick="window.switchStatsPeriod('all')"
      class="stats-period-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95 bg-[#0F172A] border-gray-700 text-gray-400">
      📚 الكل
    </button>
  </div>

  <!-- بطاقات الملخص -->
  <div id="statsSummaryBox" class="grid grid-cols-4 gap-2">
    <div class="text-center text-gray-500 text-[11px] py-4 col-span-4">جاري تحميل الإحصائيات...</div>
  </div>

  <!-- أكثر الماكينات عطلاً -->
  <div class="bg-[#1E293B] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-bold text-gray-200">🏭 أكثر الماكينات عطلاً</span>
    </div>
    <div style="height: 200px;" class="relative">
      <canvas id="statsMachineChart" class="hidden"></canvas>
      <div id="statsMachineEmpty" class="hidden text-center text-gray-500 text-[11px] py-8">
        لا توجد بلاغات كافية لعرض الرسم البياني خلال هذه الفترة.
      </div>
    </div>
  </div>

  <!-- توزيع الأولويات -->
  <div class="bg-[#1E293B] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-bold text-gray-200">🎯 توزيع الأولويات</span>
    </div>
    <div style="height: 180px;" class="relative">
      <canvas id="statsPriorityChart" class="hidden"></canvas>
      <div id="statsPriorityEmpty" class="hidden text-center text-gray-500 text-[11px] py-8">
        لا توجد بلاغات كافية لعرض الرسم البياني خلال هذه الفترة.
      </div>
    </div>
  </div>

  <!-- توزيع الخطوط -->
  <div class="bg-[#1E293B] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-bold text-gray-200">🏗️ توزيع البلاغات حسب الخط</span>
    </div>
    <div id="statsLineBreakdown" class="space-y-2.5">
      <div class="text-center text-gray-500 text-[11px] py-4">جاري التحميل...</div>
    </div>
  </div>

  <!-- متوسط زمن الإصلاح (MTTR) -->
  <div class="bg-[#1E293B] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-bold text-gray-200">⏱️ متوسط زمن الإصلاح</span>
    </div>
    <div id="statsMttrBox">
      <div class="text-center text-gray-500 text-[11px] py-4">جاري التحميل...</div>
    </div>
  </div>

  <!-- أداء الفنيين -->
  <div class="bg-[#1E293B] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-2">
      <span class="text-xs font-bold text-gray-200">🧑‍🔧 أداء الفنيين (الأكثر إنجازاً)</span>
    </div>
    <div id="statsTechBox" class="space-y-2.5">
      <div class="text-center text-gray-500 text-[11px] py-4">جاري التحميل...</div>
    </div>
  </div>

</div>

${BottomNav("quality")}
`;
