export const ReportsView = () => `
  <div class="p-4 max-w-md mx-auto">
    <button onclick="window.navigateTo('home')" class="mb-4 bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
      ⬅️ ${window.currentLang === 'en' ? 'Back Home' : 'رجوع للرئيسية'}
    </button>
    
    <h2 class="text-base font-bold mb-4 text-blue-400">📄 تصدير التقارير</h2>
    
    <div class="bg-[#1E293B] p-6 rounded-xl border border-gray-800 space-y-3">
      <button onclick="alert('تم تصدير ملف Excel بنجاح!')" class="w-full p-3 bg-green-600 hover:bg-green-700 active:scale-95 rounded-lg font-bold text-xs text-white transition">
        تصدير سجلات الصيانة (Excel) 📊
      </button>
    </div>
  </div>
`;