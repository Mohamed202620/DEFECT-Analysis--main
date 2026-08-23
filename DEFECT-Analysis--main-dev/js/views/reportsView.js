export const ReportsView = () => {
  const isEn = window.currentLang === 'en';

  return `
  <div class="p-4 max-w-md mx-auto pb-10">
    <!-- زر الرجوع -->
    <button onclick="window.navigateTo('maintenance')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2">
      <span>${isEn ? '← Back' : '← رجوع'}</span>
    </button>
    
    <!-- العنوان -->
    <div class="mb-5">
      <h2 class="text-lg font-bold text-blue-400 flex items-center gap-2">
        <span>📄</span> ${isEn ? 'Export Reports' : 'تصدير التقارير'}
      </h2>
      <p class="text-[11px] text-gray-400 mt-1">
        ${isEn ? 'Download maintenance and defect logs' : 'تحميل سجلات الصيانة والأعطال'}
      </p>
    </div>
    
    <!-- خيارات التصدير -->
    <div class="bg-[#1E293B] p-6 rounded-xl border border-gray-800 space-y-5 shadow-lg text-center">
      <div class="w-16 h-16 rounded-2xl bg-green-500/10 text-green-400 flex items-center justify-center text-3xl mx-auto mb-2">
        📊
      </div>
      
      <button onclick="alert(window.currentLang === 'en' ? 'Excel file exported successfully!' : 'تم تصدير ملف Excel بنجاح!')" class="w-full p-3.5 bg-green-600 hover:bg-green-700 active:scale-[0.98] rounded-xl font-bold text-xs text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/20">
        <span>${isEn ? 'Export Maintenance Logs (Excel)' : 'تصدير سجلات الصيانة (Excel)'}</span>
      </button>
    </div>
  </div>
  `;
};
