// js/views/reportsView.js
const ReportsViewModule = {
  render: () => `
    <div class="p-4 max-w-md mx-auto space-y-4 text-xs">
      <button onclick="navigateTo('home')" class="bg-gray-800 text-white px-3 py-1.5 rounded-lg font-bold">⬅️ رجوع</button>
      <h2 class="text-base font-bold text-blue-400">📊 استخراج التقارير والإحصائيات</h2>

      <div class="grid grid-cols-2 gap-2">
        <button onclick="ReportsViewModule.exportExcel('defects')" class="p-3 bg-[#1E293B] border border-gray-700 rounded-xl text-right">
          <div class="font-bold text-blue-400">📋 تقارير الأعطال</div>
          <div class="text-[10px] text-gray-400">مفتوحة / مغلقة / شيفتات</div>
        </button>
        <button onclick="ReportsViewModule.exportExcel('pm')" class="p-3 bg-[#1E293B] border border-gray-700 rounded-xl text-right">
          <div class="font-bold text-green-400">🛠️ تقارير PM</div>
          <div class="text-[10px] text-gray-400">الوقائية والمنجزة</div>
        </button>
        <button onclick="ReportsViewModule.exportExcel('suggestions')" class="p-3 bg-[#1E293B] border border-gray-700 rounded-xl text-right">
          <div class="font-bold text-yellow-400">💡 الاقتراحات</div>
          <div class="text-[10px] text-gray-400">أفكار التطوير المرفوعة</div>
        </button>
        <button onclick="ReportsViewModule.exportExcel('shifts')" class="p-3 bg-[#1E293B] border border-gray-700 rounded-xl text-right">
          <div class="font-bold text-purple-400">🔄 أداء الشيفتات</div>
          <div class="text-[10px] text-gray-400">Green / Blue / Red</div>
        </button>
      </div>

      <button onclick="alert('جاري تحميل التقرير الشامل صيغة Excel...')" class="w-full p-3 bg-green-600 rounded-xl font-bold text-white text-center">
        تصدير التقرير الشامل (Excel) 📊
      </button>
    </div>
  `,

  exportExcel: (type) => {
    alert(`جاري تصدير تقرير (${type})...`);
  }
};