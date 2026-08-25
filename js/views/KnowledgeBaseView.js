export const KnowledgeBaseView = () => `
<div class="app-page p-4 max-w-md mx-auto pb-24 space-y-4 text-white">

  <!-- زر الرجوع -->
  <button
    type="button"
    onclick="window.navigateTo('quality')"
    class="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-white font-bold transition active:scale-95 shadow-sm">
    ⬅ رجوع
  </button>

  <div class="bg-[#1E293B] rounded-2xl p-4 border border-gray-800 shadow-xl space-y-4">

    <h2 class="text-xl font-bold text-cyan-400 mb-1 flex items-center gap-2">
      <span>📚</span>
      <span>قاعدة المعرفة</span>
    </h2>
    <p class="text-[11px] text-gray-400">
      دليل الإصلاح والحلول لأعطال الماكينات المسجلة، مع إمكانية تصفح الأكثر تكراراً حسب الفترة.
    </p>

    <!-- بحث -->
    <input id="kbSearchInput" type="text"
      oninput="window.filterKbView()"
      placeholder="🔍 ابحث بكود العطل، الماكينة، أو كلمة..."
      class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs outline-none focus:border-cyan-500 transition shadow-sm">

    <!-- تبويبات الفترة الزمنية (يومي / أسبوعي / شهري / الكل) -->
    <div class="grid grid-cols-4 gap-2" id="kbPeriodTabs">
      <button type="button" onclick="window.switchKbPeriod('day')" data-period="day"
        class="kb-period-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95">
        يومي
      </button>
      <button type="button" onclick="window.switchKbPeriod('week')" data-period="week"
        class="kb-period-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95">
        أسبوعي
      </button>
      <button type="button" onclick="window.switchKbPeriod('month')" data-period="month"
        class="kb-period-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95">
        شهري
      </button>
      <button type="button" onclick="window.switchKbPeriod('all')" data-period="all"
        class="kb-period-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95">
        الكل
      </button>
    </div>

    <!-- ملخص الفترة المختارة (يتغيّر شكله ولونه حسب التبويب) -->
    <div id="kbSummaryBox"></div>

    <!-- قائمة الأعطال -->
    <div id="kbListBox" class="space-y-2"></div>

  </div>
</div>
`;
