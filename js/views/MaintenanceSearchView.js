// ============================================================
// MaintenanceSearchView.js
// صفحة "البحث والفلترة المتقدمة" - تجميع بلاغات الأعطال (tickets)
// وسجلات الصيانة الوقائية (pmRecords) في مكان واحد، مع بحث نصي
// وفلاتر (النوع/الحالة/الماكينة/الأولوية) وترتيب النتائج.
// المنطق الفعلي (تحميل البيانات + الفلترة + العرض) في
// js/maintenanceSearch.js - نفس أسلوب knowledgeBase.js / KnowledgeBaseView.js
// ============================================================

export const MaintenanceSearchView = () => `
<div class="p-4 max-w-md mx-auto pb-24 space-y-4 text-white">

  <!-- زر الرجوع -->
  <button
    type="button"
    onclick="window.navigateTo('maintenance')"
    class="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-white font-bold transition active:scale-95 shadow-sm">
    ⬅ رجوع
  </button>

  <div class="bg-[#1E293B] rounded-2xl p-4 border border-gray-800 shadow-xl space-y-4">

    <h2 class="text-xl font-bold text-blue-400 mb-1 flex items-center gap-2">
      <span>🔎</span>
      <span>البحث والفلترة المتقدمة</span>
    </h2>
    <p class="text-[11px] text-gray-400">
      بحث موحّد في بلاغات الأعطال وسجلات الصيانة الوقائية، مع فلترة حسب الحالة والماكينة والأولوية.
    </p>

    <!-- بحث نصي -->
    <input id="mSearchInput" type="text"
      oninput="window.applyMaintenanceSearchFilters()"
      placeholder="🔍 ابحث بالماكينة، الوصف، اسم الفني..."
      class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs outline-none focus:border-blue-500 transition shadow-sm">

    <!-- نوع السجل -->
    <div class="grid grid-cols-3 gap-2" id="mTypeTabs">
      <button type="button" onclick="window.switchMaintenanceSearchType('all')" data-type="all"
        class="m-type-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95">
        الكل
      </button>
      <button type="button" onclick="window.switchMaintenanceSearchType('ticket')" data-type="ticket"
        class="m-type-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95">
        🚨 بلاغات
      </button>
      <button type="button" onclick="window.switchMaintenanceSearchType('pm')" data-type="pm"
        class="m-type-btn py-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95">
        📝 صيانة وقائية
      </button>
    </div>

    <!-- فلاتر إضافية -->
    <div class="grid grid-cols-2 gap-2">

      <select id="mStatusFilter" onchange="window.applyMaintenanceSearchFilters()"
        class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-[11px] outline-none focus:border-blue-500 transition">
        <option value="all">كل الحالات</option>
        <option value="pending">جديد</option>
        <option value="assigned">تم الإسناد</option>
        <option value="in_progress">قيد التنفيذ</option>
        <option value="resolved">بانتظار تأكيد المُبلغ</option>
        <option value="closed">مغلقة</option>
      </select>

      <select id="mPriorityFilter" onchange="window.applyMaintenanceSearchFilters()"
        class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-[11px] outline-none focus:border-blue-500 transition">
        <option value="all">كل الأولويات</option>
        <option value="High">🔴 عالية</option>
        <option value="Medium">🟡 متوسطة</option>
        <option value="Low">🟢 منخفضة</option>
      </select>

      <select id="mMachineFilter" onchange="window.applyMaintenanceSearchFilters()"
        class="col-span-2 w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-[11px] outline-none focus:border-blue-500 transition">
        <option value="all">كل الماكينات</option>
        <option value="Coil Handling">Coil Handling</option>
        <option value="Baler">Baler</option>
        <option value="Cupper">Cupper</option>
        <option value="Bodymaker">Bodymaker</option>
        <option value="Trimmer">Trimmer</option>
        <option value="Washer">Washer</option>
        <option value="Decorator">Decorator</option>
        <option value="Spray">Spray</option>
        <option value="IBO">IBO</option>
        <option value="Necker">Necker</option>
        <option value="Palletizer">Palletizer</option>
        <option value="Depalletizer">Depalletizer</option>
        <option value="Front End Line Control">Front End Line Control</option>
        <option value="Mid Line Control">Mid Line Control</option>
        <option value="Back End Line Control">Back End Line Control</option>
        <option value="machine2">Machine 2</option>
        <option value="line1">Coating Line 1</option>
      </select>

      <select id="mSortFilter" onchange="window.applyMaintenanceSearchFilters()"
        class="col-span-2 w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-[11px] outline-none focus:border-blue-500 transition">
        <option value="newest">🕓 الأحدث أولاً</option>
        <option value="oldest">🕘 الأقدم أولاً</option>
      </select>

    </div>

    <!-- ملخص النتائج -->
    <div id="mResultsSummary" class="text-[10px] text-gray-500 px-1"></div>

    <!-- النتائج -->
    <div id="mResultsBox" class="space-y-2"></div>

  </div>
</div>
`;
